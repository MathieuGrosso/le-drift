import * as THREE from 'three'
import type { CelMaterialParams } from '../core/types'
import { GLSL_COMMON } from './glsl'
import { MAX_GLASS, MAX_LAMPS, type AllUniforms } from './uniforms'
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
  vec3 plum = rdInterieur / max(max(rdInterieur.r, rdInterieur.g), max(rdInterieur.b, 1e-3));
  float dayK = 0.55 + 0.45 * rdDay;
  vec3 skyB = rdCreme * mix(0.17, 0.26, rdAirHaze);
  vec3 floorB = rdBoisOmbre * 0.22 + rdCreme * 0.025;
  vec3 amb = mix(floorB, skyB, smoothstep(0.0, 1.0, up)) * mix(mix(vec3(1.0), plum, 0.6), vec3(1.0), smoothstep(0.0, 0.9, N.y) * 0.6);
  amb *= dayK * (1.0 + 0.3 * rdAirHaze * rdDay);
  float fillL = dot(rdLampFill, vec3(0.33));
  amb += mix(vec3(fillL), rdLampFill, 0.6) * 0.1;
  vec3 key = vec3(0.0);
  vec3 lampRim = vec3(0.0);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    vec4 lp = rdLamps[i];
    if (lp.w <= 0.0) continue;
    vec3 tl = lp.xyz - W;
    float d = length(tl);
    float x = clamp(d / lp.w, 0.0, 1.0);
    float att = (1.0 - x * x);
    att *= att;
    att /= 1.0 + x * x * 5.0 + d * d * 0.03;
    float flick = 1.0 + 0.035 * sin(rdTime * (5.1 + float(i) * 1.7) + float(i) * 2.3) * sin(rdTime * 1.3 + float(i));
    float band = smoothstep(0.015, 0.05, att) * 0.18 + smoothstep(0.13, 0.2, att) * 0.38 + smoothstep(0.38, 0.48, att) * 0.22 + att * 0.7;
    float down = (lp.y - W.y) / max(d, 1e-3);
    float shade = mix(0.3, 1.0, smoothstep(-0.15, 0.5, down));
    vec3 Ld = tl / max(d, 1e-4);
    float nl = dot(N, Ld);
    float wrap = smoothstep(-0.2, 0.3, nl);
    vec3 tone = mix(plum * 0.3, vec3(1.0), wrap);
    vec3 lc = mix(vec3(1.0), rdLampColors[i], 0.4);
    float pool = smoothstep(0.55, 0.92, down) * smoothstep(0.35, 0.85, N.y) * smoothstep(0.0, 0.35, att);
    key += lc * (tone * band * shade + pool * 0.55) * flick;
    lampRim += rdLampColors[i] * smoothstep(0.0, 0.25, att) * smoothstep(-0.1, 0.6, dot(-V, Ld)) * (1.0 - smoothstep(0.3, 0.75, nl));
  }
  key = (1.0 - exp(-key * 1.4)) * 0.82;
  vec3 canopy = mix(rdVitreMer, rdCreme, 0.6) * rdAirHaze * (0.25 + 0.75 * rdDay);
  canopy *= smoothstep(0.1, 0.5, N.y) * 0.26 + smoothstep(0.6, 0.85, N.y) * 0.14;
  vec3 patchL;
  vec3 sea = rd_glassLight(W, N, length(fwidth(W)), patchL);
  vec3 col = albedo * (amb + key + canopy + sea * 2.0 + patchL * 1.2);
  float rimI = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * rdCelRim;
  float rimEdge = smoothstep(0.25, 0.45, rimI);
  vec3 backRim = vec3(0.0);
  for (int i = 0; i < ${MAX_GLASS}; i++) {
    vec4 gC = rdGlassC[i];
    if (gC.z <= 0.0) continue;
    vec3 tg = rdGlassA[i].xyz - W;
    float dg = length(tg);
    vec3 Lg = tg / max(dg, 1e-3);
    float behind = smoothstep(-0.1, 0.55, dot(-V, Lg));
    float face = smoothstep(-0.05, 0.4, dot(N, Lg));
    float size = rdGlassA[i].w * rdGlassB[i].w;
    backRim += vec3(0.82, 1.0, 0.94) * behind * face * gC.z * (0.45 + 0.55 * gC.x) * min(1.0, size * 0.6) / (1.0 + dg * dg * mix(0.006, 0.0015, gC.w));
  }
  backRim *= 0.3 + 0.7 * rdDay;
  col += (sea * 0.9 + lampRim * 0.55) * rimEdge + backRim * 0.8 * smoothstep(0.1, 0.32, rimI) + rdCreme * 0.02 * dayK * rimI;
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
#ifdef CEL_SILHOUETTE
  float rimK = 0.55;
#else
  float rimK = 1.0;
#endif
  col += sun * fr * rdCelRim * 1.5 * rimK * sunSide * back * max(ramp, 0.35);
#ifdef CEL_SILHOUETTE
  col += albedo * rdPlafond * smoothstep(0.15, 0.9, N.y) * 0.3 * (0.35 + 0.65 * rdDay);
  col *= mix(0.7, 1.0, smoothstep(-0.85, 0.15, N.y));
  float causticK = 0.3;
#else
  float causticK = 1.0;
#endif
#ifdef CEL_CAUSTICS
  float cm = smoothstep(0.3, 0.6, N.y) * ramp;
  if (cm > 0.001) col += albedo * sun * rd_caustics(W) * rd_causticsStrength(W) * cm * 2.4 * causticK;
#endif
  float hz;
#ifdef CEL_SILHOUETTE
  vec3 sdv = W - cameraPosition;
  float sd = length(sdv);
  float sAir = rdIndoor * min(sd, rdGlassDist);
  float shz = min(rd_hazeAmount(max(sd - sAir, 0.0)), 0.5 + 0.38 * smoothstep(260.0, 700.0, sd));
  col *= mix(vec3(1.0), vec3(0.88, 0.97, 1.0), shz);
  col = mix(col, rd_hazeColor(sdv / max(sd, 1e-4), W.y) * 0.84, shz);
  col += rdPlafond * fr * 0.1 * (1.0 - 0.5 * shz) * (0.4 + 0.6 * rdDay);
  hz = shz * 0.6;
#else
  col = rd_applyHaze(col, W, true, hz);
#endif
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

export interface CelParams extends CelMaterialParams {
  // Outside hull shells: capped sea haze, top light, dark keels, so the Drift reads as a city from far.
  silhouette?: boolean
}

export function createCelFactory(shared: AllUniforms) {
  return function cel(params: CelParams): THREE.Material {
    const mat = new THREE.MeshBasicMaterial({
      color: params.color,
      map: params.map ?? null,
      vertexColors: params.vertexColors ?? false,
      transparent: params.transparent ?? false,
      side: params.side ?? THREE.FrontSide,
    })
    const indoor = params.indoor ?? false
    const caustics = !indoor && (params.caustics ?? true)
    const silhouette = !indoor && (params.silhouette ?? false)
    const own = {
      rdCelShadow: { value: new THREE.Color(params.shadowColor ?? PALETTE.rocheOmbre) },
      rdCelRim: { value: params.rim ?? 0.6 },
      rdCelEmissive: { value: new THREE.Color(params.emissive ?? 0x000000) },
    }
    mat.userData.celUniforms = own
    const onShader = params.onShader
    const key = `cel:${indoor ? 1 : 0}${caustics ? 1 : 0}${silhouette ? 1 : 0}:${onShader ? onShader.toString() : ''}`
    mat.customProgramCacheKey = () => key
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, own)
      if (indoor) shader.defines = { ...shader.defines, CEL_INDOOR: '' }
      if (caustics) shader.defines = { ...shader.defines, CEL_CAUSTICS: '' }
      if (silhouette) shader.defines = { ...shader.defines, CEL_SILHOUETTE: '' }
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
