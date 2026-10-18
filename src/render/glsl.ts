import { MAX_LAMPS, MAX_RIPPLES } from './uniforms'

export const GLSL_UNIFORMS = /* glsl */ `
uniform float rdTime;
uniform vec3 rdSunDir;
uniform vec3 rdSunColor;
uniform vec3 rdCurrent;
uniform vec3 rdHeroPos;
uniform float rdHazeDist;
uniform float rdHazeMax;
uniform float rdIndoor;
uniform vec4 rdLamps[${MAX_LAMPS}];
uniform vec3 rdLampColors[${MAX_LAMPS}];
uniform vec3 rdAbysse;
uniform vec3 rdProfond;
uniform vec3 rdMilieu;
uniform vec3 rdClair;
uniform vec3 rdPlafond;
uniform vec3 rdSable;
uniform vec3 rdInterieur;
uniform float rdSunI;
uniform float rdDay;
uniform float rdPlankton;
uniform float rdRain;
uniform vec3 rdSunAir;
uniform float rdCeilY;
uniform sampler2D rdShadowMap;
uniform mat4 rdShadowMatrix;
uniform float rdShadowOn;
uniform float rdShadowTexel;
uniform vec4 rdRipples[${MAX_RIPPLES}];
`

export const GLSL_NOISE = /* glsl */ `
float rd_sat(float x) { return clamp(x, 0.0, 1.0); }
float rd_hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 rd_hash2(vec2 p) {
  float n = rd_hash(p);
  return vec2(n, rd_hash(p + n + 17.17));
}
float rd_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rd_hash(i), rd_hash(i + vec2(1.0, 0.0)), u.x),
             mix(rd_hash(i + vec2(0.0, 1.0)), rd_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// F2 - F1 of an animated cellular field: small along cell borders.
float rd_cellEdge(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = rd_hash2(i + g);
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      float d = length(g + o - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return f2 - f1;
}
`

export const GLSL_WATER = /* glsl */ `
vec3 rd_hazeColor(vec3 v, float worldY) {
  float up = clamp(v.y * 0.5 + 0.5, 0.0, 1.0);
  float depth01 = clamp(worldY / rdCeilY, 0.0, 1.0);
  vec3 c = mix(rdAbysse, rdMilieu, smoothstep(0.0, 0.55, up));
  c = mix(c, rdClair, smoothstep(0.45, 1.0, 0.6 * up + 0.4 * depth01));
  c = mix(c, rdPlafond, smoothstep(0.58, 0.95, up) * 0.55);
  float sd = max(dot(v, rdSunDir), 0.0);
  c += rdSunColor * rdSunI * (pow(sd, 6.0) * 0.35 + sd * sd * 0.08);
  float north = smoothstep(0.2, 1.0, -v.z) * exp(-abs(v.y - 0.08) * 5.0);
  c = mix(c, rdPlafond, north * 0.28 * (0.4 + 0.6 * rdSunI));
  return c;
}
float rd_hazeAmount(float d) {
  return 1.0 - exp(-pow(d / rdHazeDist, 1.35));
}
vec3 rd_applyHaze(vec3 col, vec3 wp, bool absorb, out float hz) {
  vec3 dv = wp - cameraPosition;
  float d = length(dv);
  vec3 v = dv / max(d, 1e-4);
  hz = min(rd_hazeAmount(d), rdHazeMax);
  if (absorb) col *= mix(vec3(1.0), vec3(0.88, 0.97, 1.0), hz);
  return mix(col, rd_hazeColor(v, wp.y), hz);
}
float rd_caustics(vec3 wp) {
  vec3 L = rdSunDir;
  vec2 uv = (wp.xz - L.xz / max(L.y, 0.2) * wp.y) * 0.16;
  float aa = 1.0 - smoothstep(0.12, 0.45, length(fwidth(uv)));
  if (aa <= 0.0) return 0.35;
  vec2 drift = rdCurrent.xz * rdTime * 0.08;
  float a = rd_cellEdge(uv + drift, rdTime * 0.9);
  float b = rd_cellEdge(uv * 1.43 + vec2(5.2, 1.3) - drift * 0.6, rdTime * 0.7 + 1.7);
  float ea = 1.0 - smoothstep(0.0, 0.09, a);
  float eb = 1.0 - smoothstep(0.0, 0.12, b);
  return mix(0.35, ea * 1.1 + eb * 0.7 + ea * eb * 1.4, aa);
}
float rd_causticsStrength(vec3 wp) {
  float depth = clamp(rdCeilY - wp.y, 0.0, rdCeilY);
  return 0.35 * (1.0 - 0.55 * depth / rdCeilY) * rdDay * (1.0 - rdIndoor);
}
float rd_shadow(vec3 wp, float ndl) {
  if (rdShadowOn < 0.5) return 1.0;
  vec4 sc = rdShadowMatrix * vec4(wp, 1.0);
  vec3 s = sc.xyz / sc.w;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  float bias = 0.0006 + 0.0025 * (1.0 - clamp(ndl, 0.0, 1.0));
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)) * rdShadowTexel * 1.2;
      sum += step(s.z - bias, texture2D(rdShadowMap, s.xy + o).r);
    }
  }
  float lit = sum / 9.0;
  vec2 e = min(s.xy, 1.0 - s.xy);
  float edge = smoothstep(0.0, 0.08, min(e.x, e.y));
  return mix(1.0, smoothstep(0.25, 0.75, lit), edge);
}
`

export const GLSL_VERTEX = GLSL_UNIFORMS + GLSL_NOISE
export const GLSL_COMMON = GLSL_UNIFORMS + GLSL_NOISE + GLSL_WATER
