import type * as THREE from 'three'
import { NOISE_GLSL } from './materials'
import { PAL } from './palette'

export const SURF = {
  paint: 0,
  planksX: 1,
  planksZ: 2,
  boards: 3,
  plaster: 4,
  steel: 5,
  tiles: 6,
  fabric: 7,
  stone: 8,
  brass: 9,
  hull: 10,
} as const

const VERT_DECL = 'attribute float aPat;\nvarying float vPat;\nvarying vec3 vPatP;\nvarying vec3 vPatN;\n'
const VERT_BODY = /* glsl */ `
vPat = aPat;
vPatP = position;
vPatN = normal;
#ifdef USE_INSTANCING
vPatP = (instanceMatrix * vec4(position, 1.0)).xyz;
vPatN = mat3(instanceMatrix) * normal;
#endif
`

// Patterns run in the drift's local frame (object space), so they never swim when the Drift moves or sways.
const FRAG_DECL = /* glsl */ `
varying float vPat;
varying vec3 vPatP;
varying vec3 vPatN;
${NOISE_GLSL.replace(/dHash/g, 'sHash').replace(/dNoise/g, 'sNoise').replace(/dFbm/g, 'sFbm')}
float sLine(float x, float w) {
  float d = min(fract(x), 1.0 - fract(x));
  float aa = fwidth(x) * 1.2;
  return 1.0 - smoothstep(w, w + aa, d);
}
float sFade(vec2 st) {
  float f = max(fwidth(st.x), fwidth(st.y));
  return 1.0 - smoothstep(0.03, 0.12, f);
}
vec3 sDesat(vec3 c, float k) { return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, k); }
vec3 sSurface(vec3 col, float pat, vec3 p, vec3 n) {
  vec3 an = abs(n);
  vec2 st = an.y > 0.6 ? p.xz : (an.x > an.z ? vec2(p.z, p.y) : vec2(p.x, p.y));
  float fade = sFade(st * 6.0);
  float id = floor(pat + 0.5);
  float brush = sFbm(st * vec2(1.6, 4.5) + p.y * 0.3);
  float big = sNoise(st * 0.35 + 7.0);
  col *= mix(1.0, 0.93 + 0.12 * brush, 0.8) * (0.97 + 0.06 * big);
  if (id == 1.0 || id == 2.0) {
    vec2 b = id == 1.0 ? (an.y > 0.6 ? p.xz : st) : (an.y > 0.6 ? p.zx : st);
    float row = floor(b.y / 0.21);
    float off = sHash(vec2(row, 1.7)) * 3.0;
    float seg = floor((b.x + off) / 2.3);
    float tone = sHash(vec2(row, seg)) - 0.5;
    float grain = sNoise(vec2(b.x * 0.9, b.y * 38.0)) * sNoise(vec2(b.x * 3.0, b.y * 9.0));
    col = sDesat(col, 0.72);
    col *= 1.0 + tone * 0.14 - grain * 0.1 * fade;
    float seam = max(sLine(b.y / 0.21, 0.03), sLine((b.x + off) / 2.3, 0.004));
    col = mix(col, col * vec3(0.52, 0.44, 0.52), seam * 0.6 * fade);
    float knot = smoothstep(0.08, 0.0, length(fract(b * vec2(0.55, 1.0 / 0.21)) - vec2(0.37, 0.5)) - 0.02 * sHash(vec2(row, seg + 3.0)));
    col *= 1.0 - knot * 0.25 * step(0.7, sHash(vec2(seg, row + 5.0))) * fade;
  } else if (id == 3.0) {
    float u = st.x / 0.13;
    float tone = sHash(vec2(floor(u), 3.3)) - 0.5;
    col = sDesat(col, 0.82);
    col *= 1.0 + tone * 0.07 - sNoise(vec2(st.x * 30.0, st.y * 0.8)) * 0.08 * fade;
    col = mix(col, col * vec3(0.55, 0.47, 0.56), sLine(u, 0.035) * 0.55 * fade);
    col *= 1.0 + 0.05 * smoothstep(0.3, 0.48, abs(fract(u) - 0.5)) * fade;
  } else if (id == 4.0) {
    float stroke = sNoise(vec2(st.x * 2.2, st.y * 11.0)) * 0.6 + sNoise(st * 23.0) * 0.4;
    col *= 0.965 + stroke * 0.07;
    float chip = smoothstep(0.82, 0.86, sFbm(st * 3.1 + 11.0)) * step(0.55, sNoise(st * 0.7));
    col = mix(col, vec3(0.62, 0.43, 0.32) * (col.r + col.g) * 0.55, chip * 0.6 * fade);
  } else if (id == 5.0 || id == 10.0) {
    float pw = id == 10.0 ? 2.4 : 1.2;
    float ph = id == 10.0 ? 1.1 : 0.9;
    float rowv = floor(st.y / ph);
    vec2 g = vec2((st.x + rowv * pw * 0.5) / pw, st.y / ph);
    float seam = max(sLine(g.x, 0.008), sLine(g.y, 0.012));
    vec2 rv = vec2(st.x / 0.16, g.y);
    float rivet = (1.0 - smoothstep(0.16, 0.26, length(vec2(fract(rv.x) - 0.5, (fract(rv.y + 0.035) - 0.5) * ph / 0.16 * 0.6))))
      * (1.0 - smoothstep(0.0, 0.07, min(fract(g.y + 0.035), 1.0 - fract(g.y + 0.035)) * ph));
    float plate = sHash(floor(g) + 2.0) - 0.5;
    col *= 1.0 + plate * 0.1;
    float rust = smoothstep(0.62, 0.9, sFbm(vec2(st.x * 4.0, st.y * 1.2) + 3.0)) * smoothstep(0.25, 0.0, fract(g.y + 0.035));
    float fadeB = id == 10.0 ? sFade(st * 0.7) : fade;
    col = mix(col, vec3(0.55, 0.3, 0.22) * 0.9, rust * 0.35 * fadeB);
    col = mix(col, col * vec3(0.45, 0.4, 0.5), seam * 0.7 * fadeB);
    col = mix(col, col * 1.25 + vec3(0.05), rivet * 0.7 * fade);
  } else if (id == 6.0) {
    vec2 t = st / 0.15;
    vec2 cell = floor(t);
    float tone = sHash(cell) - 0.5;
    col = sDesat(col, 0.7) * (1.0 + tone * 0.07);
    float chipped = step(0.94, sHash(cell + 9.0)) * smoothstep(0.3, 0.1, length(fract(t) - vec2(0.85, 0.15)));
    col *= 1.0 - chipped * 0.18 * fade;
    float grout = max(sLine(t.x, 0.035), sLine(t.y, 0.035));
    col = mix(col, col * vec3(0.8, 0.76, 0.78), grout * fade);
  } else if (id == 7.0) {
    float weave = sin(st.x * 260.0) * sin(st.y * 260.0);
    col = sDesat(col, 0.78);
    col *= 1.0 + weave * 0.035 * sFade(st * 40.0);
    vec2 pc = floor(st / 0.42);
    float pPatch = step(0.88, sHash(pc + 4.0));
    col = mix(col, col * vec3(1.08, 0.95, 0.85), pPatch * 0.6);
    vec2 pf = fract(st / 0.42);
    float stitch = pPatch * max(sLine(pf.x * 1.0 + 0.0, 0.015), sLine(pf.y, 0.015)) * step(0.5, fract((st.x + st.y) * 30.0));
    col = mix(col, col * 1.2 + 0.05, stitch * 0.3 * fade);
  } else if (id == 8.0) {
    float rowv = floor(st.y / 0.6);
    vec2 g = vec2((st.x + sHash(vec2(rowv, 0.0)) * 0.9) / 0.9, st.y / 0.6);
    float tone = sHash(floor(g) + 1.0) - 0.5;
    col = sDesat(col, 0.75) * (1.0 + tone * 0.12);
    col *= 0.94 + 0.1 * sFbm(st * 2.5);
    float grout = max(sLine(g.x, 0.02), sLine(g.y, 0.03));
    col = mix(col, col * vec3(0.62, 0.56, 0.62), grout * fade);
    col *= 1.0 - smoothstep(0.6, 0.85, sFbm(st * 1.3 + 5.0)) * 0.12;
  } else if (id == 9.0) {
    float tarnish = smoothstep(0.55, 0.8, sFbm(st * 3.0 + 1.0));
    col = mix(col, vec3(0.5, 0.66, 0.6) * (col.r + col.g) * 0.5, tarnish * 0.35);
  }
  return col;
}
`

export function surfacePatch(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`)
  shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace(
    '#include <color_fragment>',
    '#include <color_fragment>\ndiffuseColor.rgb = sSurface(diffuseColor.rgb, vPat, vPatP, normalize(vPatN + vec3(1e-5)));',
  )
}

const BY_COLOR = new Map<number, number>([
  [PAL.bois, 1], [PAL.boisClair, 1], [PAL.boisOmbre, 1],
  [PAL.tissu1, 7], [PAL.tissu2, 7], [PAL.tissu3, 7], [PAL.toile, 7], [PAL.blanc, 7], [PAL.echarpe, 7],
  [PAL.laiton, 9], [PAL.metal, 5], [PAL.metalSombre, 5],
])

export function patForColor(hex: number): number {
  return BY_COLOR.get(hex) ?? 0
}
