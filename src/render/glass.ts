import * as THREE from 'three'
import { GLSL_COMMON } from './glsl'
import { MAX_LAMPS, MAX_WIPES, type AllUniforms } from './uniforms'
import { PALETTE } from './palette'

export interface GlassParams {
  coat?: boolean
  tint?: number
  condensation?: boolean
  dome?: boolean
  round?: boolean
}

export interface GlassUniforms {
  rgCoat: { value: number }
  rgTint: { value: THREE.Color }
}

const GLASS_VS = /* glsl */ `
attribute float aCoat;
attribute float aSeed;
attribute vec2 aSize;
varying vec2 vUv;
varying vec2 vMeters;
varying float vCoat;
varying float vSeed;
varying vec3 vW;
varying vec3 vN;
uniform float rgCoat;
void main() {
  vUv = uv;
  vMeters = (uv - 0.5) * aSize;
  vCoat = max(aCoat, rgCoat);
  vSeed = aSeed;
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const GLASS_FS = /* glsl */ `
uniform vec3 rgTint;
uniform float rgRound;
uniform float rgDome;
uniform float rgCoatOn;
uniform float rgCondense;
varying vec2 vUv;
varying vec2 vMeters;
varying float vCoat;
varying float vSeed;
varying vec3 vW;
varying vec3 vN;

float rg_fbm(vec2 p) {
  return rd_noise(p) * 0.5 + rd_noise(p * 2.03 + 7.1) * 0.3 + rd_noise(p * 4.1 + 3.3) * 0.2;
}
float rg_wiped(vec3 p) {
  float c = 0.0;
  for (int i = 0; i < ${MAX_WIPES}; i++) {
    vec4 w = rdWipes[i];
    float age = rdHours - w.w;
    if (age < 0.0 || age > 2.0) continue;
    float d = length(p - w.xyz);
    float edge = 0.32 + 0.06 * rd_noise(p.xy * 9.0 + p.z * 5.0);
    c = max(c, (1.0 - smoothstep(edge * 0.75, edge, d)) * (1.0 - smoothstep(1.4, 2.0, age)));
  }
  return c;
}

void main() {
  vec2 c = vUv - 0.5;
  float edgeDist = rgRound > 0.5 ? length(c) * 2.0 : max(abs(c.x), abs(c.y)) * 2.0;
  if (rgRound > 0.5 && edgeDist > 1.0) discard;
  if (rgDome > 0.5) edgeDist = 0.35;
  vec2 q = rgDome > 0.5 ? vW.xz * 0.5 + vec2(vW.y * 0.7) : vMeters;
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  bool outside = dot(V, N) > 0.0;
  vec3 Nf = outside ? N : -N;
  float ndv = clamp(dot(Nf, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.0);
  float dist = length(vW - cameraPosition);

  float n = rg_fbm(q * 5.0 + vSeed * 17.0);
  float fine = rd_noise(q * 38.0 + vSeed * 3.0);
  float mask = edgeDist * 0.55 + n * 0.55 + fine * 0.12;
  float thr = 1.15 - vCoat * 1.3;
  float on = step(0.02, vCoat) * rgCoatOn;
  float cover = smoothstep(thr - 0.05, thr + 0.08, mask) * on;
  float thick = smoothstep(thr, thr + 0.4, mask) * on;
  float rim = cover * (1.0 - smoothstep(thr + 0.02, thr + 0.16, mask));

  vec3 col;
  float a;
  if (!outside) {
    a = 0.06 + 0.4 * fres;
    col = rgTint * (0.55 + 0.45 * rdDay) * 0.8;
    col += rdCreme * fres * 0.5;
    vec3 R = reflect(-V, Nf);
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      vec4 lp = rdLamps[i];
      if (lp.w <= 0.0) continue;
      vec3 tl = lp.xyz - vW;
      float d = length(tl);
      float s = pow(max(dot(R, tl / d), 0.0), 900.0) * (1.0 - smoothstep(lp.w * 0.4, lp.w * 1.2, d));
      col += rdLampColors[i] * s * 1.4;
      a += s * 0.4;
    }
    vec3 back = rdRevetement * (0.18 + 0.55 * (1.0 - thick)) * (0.3 + 0.7 * rdDay);
    back += rdRevetement * rim * 0.9 * rdDay;
    col = mix(col, back, cover);
    a = mix(a, 0.7 + 0.25 * thick, cover);
    if (rgCondense > 0.5 && rdCondensation > 0.001) {
      float fog = rdCondensation * (1.0 - rg_wiped(vW));
      fog *= 0.75 + 0.25 * rd_noise(q * 3.0);
      float drops = 1.0 - smoothstep(0.0, 0.07, rd_cellEdge(q * 9.0 + vec2(0.0, rdTime * 0.01), 0.0));
      vec3 fogC = mix(rdCreme * 0.8, rdLampFill * 0.6 + rdCreme * 0.4, 0.4);
      col = mix(col, fogC, fog * 0.75) + rdCreme * drops * fog * 0.15;
      a = mix(a, 0.6, fog);
    }
    float ah = rd_airAmount(dist);
    col = mix(col, rd_airColor(), ah);
  } else {
    vec3 glow = rdVitreLumiere * (0.18 + 0.55 * (1.0 - rdDay));
    col = mix(rgTint * 0.45, glow, 0.55);
    a = 0.3 + 0.55 * fres;
    vec3 R = reflect(-V, N);
    float sp = pow(max(dot(R, rdSunDir), 0.0), 70.0);
    col += rdSunColor * rdSunI * sp * 1.6 + rdPlafond * fres * 0.35;
    a += sp * 0.5;
    vec3 fur = mix(rdRevetement * 0.6, rdRevetement * 1.2, n) * (0.85 + fine * 0.3);
    fur *= 0.55 + 0.45 * rdSunI + rd_caustics(vW) * rd_causticsStrength(vW) * 1.4;
    col = mix(col, fur, cover);
    a = mix(a, 0.97, cover);
    float hz;
    col = rd_applyHaze(col, vW, true, hz);
  }
  float streak = smoothstep(0.93, 1.0, sin((vUv.x + vUv.y) * 9.0 + vSeed * 6.0)) * (1.0 - cover) * (0.12 + 0.25 * fres);
  col += rdPlafond * streak;
  a = clamp(a + streak * 0.3, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`

export function createGlassFactory(shared: AllUniforms) {
  return function glass(params: GlassParams = {}): THREE.ShaderMaterial {
    const own = {
      rgCoat: { value: 0 },
      rgTint: { value: new THREE.Color(params.tint ?? PALETTE.vitreMer) },
      rgRound: { value: params.round ? 1 : 0 },
      rgDome: { value: params.dome ? 1 : 0 },
      rgCoatOn: { value: params.coat === false ? 0 : 1 },
      rgCondense: { value: params.condensation ? 1 : 0 },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...own },
      vertexShader: GLASS_VS,
      fragmentShader: GLSL_COMMON + GLASS_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    Object.assign(mat.defaultAttributeValues as Record<string, number[]>, { aCoat: [0], aSeed: [0], aSize: [1, 1] })
    mat.userData.rdGlass = true
    mat.userData.glassUniforms = own satisfies GlassUniforms
    mat.name = params.dome ? 'rd-glass-dome' : 'rd-glass'
    return mat
  }
}
