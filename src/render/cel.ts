import * as THREE from 'three'
import type { CelMaterialParams } from '../core/types'
import { GLSL_COMMON } from './glsl'
import { MAX_LAMPS, type AllUniforms } from './uniforms'
import { PALETTE } from './palette'

const NORMAL_GATE = '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )'

const CEL_FRAGMENT = /* glsl */ `
uniform vec3 rdCelShadow;
uniform float rdCelRim;
uniform vec3 rdCelEmissive;
varying vec3 vRdW;
varying vec3 vRdN;

vec3 rd_cel(vec3 albedo, vec3 N, vec3 V, vec3 W) {
  vec3 L = rdSunDir;
  float ndl = dot(N, L);
  float up = N.y * 0.5 + 0.5;
  vec3 hemi = mix(rdProfond, rdPlafond, up) * 0.55 + rdSable * 0.15 * max(-N.y, 0.0);
  vec3 shadowHue = rdCelShadow / max(max(rdCelShadow.r, rdCelShadow.g), max(rdCelShadow.b, 1e-3));
  vec3 shadowTint = mix(vec3(1.0), shadowHue, 0.62);
  vec3 sun = rdSunColor * rdSunI;
#ifdef CEL_INDOOR
  // Hemisphere: cream from above, plum-brown from below; the sea only adds a cool rim of glass light.
  vec3 amb = mix(rdBoisOmbre * 0.25, rdCreme * 0.35, smoothstep(0.15, 0.85, up));
  vec3 sea = rdVitreMer * 0.12 * rdDay;
  vec3 col = albedo * (mix(shadowTint * amb, amb, 0.5 + 0.5 * smoothstep(-0.2, 0.3, N.y)) + sea);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    vec4 lp = rdLamps[i];
    if (lp.w <= 0.0) continue;
    vec3 tl = lp.xyz - W;
    float d = length(tl);
    float a = 1.0 - clamp(d / lp.w, 0.0, 1.0);
    a = smoothstep(0.08, 0.16, a) * 0.55 + smoothstep(0.45, 0.53, a) * 0.45;
    float nl = dot(N, tl / max(d, 1e-4));
    float band = mix(0.45, 1.0, smoothstep(0.0, 0.08, nl));
    vec3 lampTint = mix(shadowTint, vec3(1.0), band);
    col += albedo * mix(vec3(1.0), rdLampColors[i], 0.3) * lampTint * 1.05 * a * band;
  }
  float rimI = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * rdCelRim * 0.5;
  col += rdInterieur * rimI;
  float hz;
  col = rd_applyIndoorHaze(col, W, hz);
  return col + rdCelEmissive * 1.6 * (1.0 - 0.6 * hz);
#else
  float sh = rd_shadow(W, ndl);
  float b1 = smoothstep(-0.08, 0.0, ndl);
  float b2 = smoothstep(0.36, 0.44, ndl);
  float ramp = (0.62 * b1 + 0.38 * b2) * sh;
  float hemiL = dot(hemi, vec3(0.3, 0.5, 0.2));
  vec3 shadeK = shadowTint * (0.3 * rdSunI + hemiL * 0.7 + hemi * 0.25);
  vec3 litK = max(sun * 0.8 + hemi * 0.3, shadeK * 1.2);
  vec3 col = albedo * mix(shadeK, litK, ramp);
  float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  float sunSide = 0.35 + 0.65 * clamp(ndl + 0.3, 0.0, 1.0);
  float back = 1.0 + 1.2 * pow(max(dot(-V, L), 0.0), 2.0);
  col += sun * fr * rdCelRim * 1.5 * sunSide * back * max(ramp, 0.35);
#ifdef CEL_CAUSTICS
  float cm = smoothstep(0.3, 0.6, N.y) * ramp;
  if (cm > 0.001) col += albedo * sun * rd_caustics(W) * rd_causticsStrength(W) * cm * 2.4;
#endif
  float hz;
  col = rd_applyHaze(col, W, true, hz);
  return col + rdCelEmissive * 1.6 * (1.0 - 0.6 * hz);
#endif
}
`

const VERTEX_DECL = 'varying vec3 vRdW;\nvarying vec3 vRdN;\n'
const VERTEX_BODY = /* glsl */ `
vRdW = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);
#ifdef RD_HAS_NORMAL
vRdN = transformedNormal * mat3(viewMatrix);
#else
vRdN = vec3(0.0);
#endif
`

export function createCelFactory(shared: AllUniforms) {
  return function cel(params: CelMaterialParams): THREE.Material {
    const mat = new THREE.MeshBasicMaterial({
      color: params.color,
      map: params.map ?? null,
      vertexColors: params.vertexColors ?? false,
      transparent: params.transparent ?? false,
      side: params.side ?? THREE.FrontSide,
    })
    const indoor = params.indoor ?? false
    const caustics = !indoor && (params.caustics ?? true)
    const own = {
      rdCelShadow: { value: new THREE.Color(params.shadowColor ?? PALETTE.rocheOmbre) },
      rdCelRim: { value: params.rim ?? 0.6 },
      rdCelEmissive: { value: new THREE.Color(params.emissive ?? 0x000000) },
    }
    mat.userData.celUniforms = own
    const onShader = params.onShader
    const key = `cel:${indoor ? 1 : 0}${caustics ? 1 : 0}:${onShader ? onShader.toString() : ''}`
    mat.customProgramCacheKey = () => key
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, own)
      if (indoor) shader.defines = { ...shader.defines, CEL_INDOOR: '' }
      if (caustics) shader.defines = { ...shader.defines, CEL_CAUSTICS: '' }
      let vs = shader.vertexShader
      const hasGate = vs.includes(NORMAL_GATE)
      if (hasGate) vs = vs.replace(NORMAL_GATE, '#if 1')
      vs = (hasGate ? '#define RD_HAS_NORMAL\n' : '') + VERTEX_DECL + vs
      vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_BODY}`)
      shader.vertexShader = vs
      shader.fragmentShader = GLSL_COMMON + CEL_FRAGMENT + shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
          vec3 rdN = vRdN;
          if (dot(rdN, rdN) < 1e-6) rdN = cross(dFdx(vRdW), dFdy(vRdW));
          rdN = normalize(rdN);
          #ifdef DOUBLE_SIDED
          rdN = gl_FrontFacing ? rdN : -rdN;
          #endif
          vec3 rdV = normalize(cameraPosition - vRdW);
          outgoingLight = rd_cel(outgoingLight, rdN, rdV, vRdW);
        }
        #include <opaque_fragment>`,
      )
      onShader?.(shader)
    }
    return mat
  }
}

const WATER_VERTEX_INSTANCED = 'vRdW = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);'
const WATER_VERTEX_FALLBACK = 'vRdW = (modelMatrix * vec4(position, 1.0)).xyz;'

const WATER_FRAGMENT = /* glsl */ `
varying vec3 vRdW;
vec3 rd_water(vec3 col) {
  vec3 n = normalize(cross(dFdx(vRdW), dFdy(vRdW)));
  if (n.y < 0.0) n = -n;
  float cm = smoothstep(0.3, 0.6, n.y) * smoothstep(-0.05, 0.1, dot(n, rdSunDir));
  if (cm > 0.001) col += col * rdSunColor * rdSunI * rd_caustics(vRdW) * rd_causticsStrength(vRdW) * cm * 1.6;
  float hz;
  return rd_applyHaze(col, vRdW, true, hz);
}
`

function insertBeforeLastBrace(src: string, code: string): string {
  const i = src.lastIndexOf('}')
  return i < 0 ? src : `${src.slice(0, i)}\n${code}\n${src.slice(i)}`
}

export function createPatchWater(shared: AllUniforms) {
  return function patchWater(material: THREE.Material): void {
    if (material.userData.rdWater) return
    material.userData.rdWater = true
    const prevCompile = material.onBeforeCompile.bind(material)
    const prevKey = material.customProgramCacheKey.bind(material)
    material.customProgramCacheKey = () => `water:${prevKey()}`
    material.onBeforeCompile = (shader, renderer) => {
      prevCompile(shader, renderer)
      Object.assign(shader.uniforms, shared)
      let vs = 'varying vec3 vRdW;\n' + shader.vertexShader
      if (vs.includes('#include <project_vertex>')) {
        vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${WATER_VERTEX_INSTANCED}`)
      } else {
        vs = insertBeforeLastBrace(vs, WATER_VERTEX_FALLBACK)
      }
      shader.vertexShader = vs
      shader.fragmentShader = insertBeforeLastBrace(
        GLSL_COMMON + WATER_FRAGMENT + shader.fragmentShader,
        'gl_FragColor.rgb = rd_water(gl_FragColor.rgb);',
      )
    }
    material.needsUpdate = true
  }
}
