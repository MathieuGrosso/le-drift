import { MAX_GLASS, MAX_LAMPS, MAX_RIPPLES, MAX_WIPES } from './uniforms'

export const GLSL_UNIFORMS = /* glsl */ `
uniform float rdTime;
uniform vec3 rdSunDir;
uniform vec3 rdSunColor;
uniform vec3 rdCurrent;
uniform vec3 rdHeroPos;
uniform float rdHazeDist;
uniform float rdHazeMax;
uniform float rdIndoor;
uniform float rdAirHaze;
uniform float rdGlassDist;
uniform vec3 rdAirBrume;
uniform vec3 rdCreme;
uniform vec3 rdBoisOmbre;
uniform vec3 rdVitreMer;
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
uniform vec3 rdGravity;
uniform vec3 rdVitreLumiere;
uniform vec3 rdRevetement;
uniform vec4 rdGlassA[${MAX_GLASS}];
uniform vec4 rdGlassB[${MAX_GLASS}];
uniform vec4 rdGlassC[${MAX_GLASS}];
uniform float rdHours;
uniform float rdCondensation;
uniform vec4 rdWipes[${MAX_WIPES}];
uniform vec3 rdLampFill;
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
// Sea haze is water between the eye and the thing: from inside, only the stretch beyond the glass counts.
// Air haze is dust in a big room, over the in-air stretch only. Never mix the two.
float rd_airAmount(float d) {
  return (1.0 - exp(-pow(d / 56.0, 1.8))) * 0.65 * rdAirHaze * rdIndoor;
}
vec3 rd_airColor() {
  float near = step(0.001, rdLamps[0].w);
  return 0.78 * mix(rdAirBrume, rdAirBrume * mix(vec3(1.0), rdLampColors[0] / max(max(rdLampColors[0].r, rdLampColors[0].g), 1e-3), 0.2), near);
}
vec3 rd_applyHaze(vec3 col, vec3 wp, bool absorb, out float hz) {
  vec3 dv = wp - cameraPosition;
  float d = length(dv);
  vec3 v = dv / max(d, 1e-4);
  float dAir = mix(0.0, min(d, rdGlassDist), rdIndoor);
  hz = min(rd_hazeAmount(max(d - dAir, 0.0)), rdHazeMax);
  if (absorb) col *= mix(vec3(1.0), vec3(0.88, 0.97, 1.0), hz);
  col = mix(col, rd_hazeColor(v, wp.y), hz);
  float ah = rd_airAmount(dAir);
  hz = max(hz, ah);
  return mix(col, rd_airColor(), ah);
}
vec3 rd_applyIndoorHaze(vec3 col, vec3 wp, out float hz) {
  vec3 dv = wp - cameraPosition;
  float d = length(dv);
  float sea = min(rd_hazeAmount(d), rdHazeMax) * (1.0 - rdIndoor);
  col = mix(col, rd_hazeColor(dv / max(d, 1e-4), wp.y), sea);
  float ah = rd_airAmount(d);
  hz = max(sea, ah);
  return mix(col, rd_airColor(), ah);
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
  float raw = ea * 1.1 + eb * 0.7 + ea * eb * 1.4;
  return mix(0.35, 0.42 + (raw - 0.42) * 0.45, aa);
}
float rd_causticsStrength(vec3 wp) {
  float depth = clamp(rdCeilY - wp.y, 0.0, rdCeilY);
  float far = smoothstep(6.0, 48.0, distance(wp, cameraPosition));
  return 0.24 * (1.0 - 0.75 * depth / rdCeilY) * (1.0 - 0.7 * far) * rdDay * (1.0 - rdIndoor);
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

// Glass slots: A = centre.xyz + half width, B = inward normal.xyz + half height, C = (clean, round, strength, roof).
export const GLSL_GLASS = /* glsl */ `
vec3 rd_glassT(vec3 n) {
  vec3 t = cross(vec3(0.0, 1.0, 0.0), n);
  if (dot(t, t) < 1e-4) t = vec3(1.0, 0.0, 0.0);
  return normalize(t);
}
float rd_glassMask(vec2 uv, vec4 A, vec4 B, vec4 C, float soft) {
  vec2 h = max(vec2(A.w, B.w), vec2(1e-3));
  if (C.y > 0.5) return 1.0 - smoothstep(-soft, soft, length(uv) - h.x);
  vec2 q = abs(uv) - h;
  return 1.0 - smoothstep(-soft, soft, max(q.x, q.y));
}
// Underwater light arrives from above (Snell's window): every pane throws its beam down and inward.
vec3 rd_beamDir(vec3 nIn) {
  vec2 s = rdSunDir.xz;
  return normalize(vec3(0.0, 1.0, 0.0) - nIn * 0.8 + vec3(s.x, 0.0, s.y) * 0.3);
}
vec3 rd_beamColor() {
  vec3 day = mix(rdVitreMer, rdSunColor, 0.4) * rdSunI * rdDay;
  vec3 night = rdVitreMer * 0.05 + vec3(0.25, 0.4, 0.12) * rdPlankton * 0.5;
  return day + night * (1.0 - rdDay);
}
// Big panes break their light into separate shafts (waves above, mullions); portholes stay whole.
float rd_beamStreak(vec2 uv, float halfW, int i) {
  float k = smoothstep(0.7, 1.8, halfW);
  if (k <= 0.0) return 1.0;
  float roof = rdGlassC[i].w;
  uv *= mix(1.0, 0.28, roof);
  float s = rd_noise(vec2(uv.x * 0.9 + uv.y * 0.22 + float(i) * 7.3 + rdTime * 0.04, rdTime * 0.06 + float(i)));
  float s2 = rd_noise(vec2(uv.x * 2.3 - rdTime * 0.05, 3.0 + float(i)));
  return mix(1.0, mix(0.12, 0.0, roof) + 0.88 * smoothstep(mix(0.38, 0.62, roof), mix(0.72, 0.8, roof), s * 0.75 + s2 * 0.25), k);
}
float rd_beamAt(vec3 P, int i, out float along) {
  along = 0.0;
  vec4 A = rdGlassA[i];
  vec4 B = rdGlassB[i];
  vec4 C = rdGlassC[i];
  if (C.z <= 0.0) return 0.0;
  vec3 rel = P - A.xyz;
  float front = dot(rel, B.xyz);
  if (front < 0.0) return 0.0;
  vec3 Lb = rd_beamDir(B.xyz);
  float t = -front / min(dot(Lb, B.xyz), -0.05);
  along = t;
  vec3 hit = rel + Lb * t;
  vec3 T = rd_glassT(B.xyz);
  vec2 uv = vec2(dot(hit, T), dot(hit, cross(B.xyz, T)));
  return rd_glassMask(uv, A, B, C, 0.06 + t * 0.05) * rd_beamStreak(uv, A.w, i) * C.x * C.z * exp(-t * mix(0.09, 0.022, C.w)) * smoothstep(0.0, 0.25, front) * mix(1.0, 0.12, C.w);
}
vec3 rd_glassLight(vec3 W, vec3 N, float foot, out vec3 patchLight) {
  vec3 fill = vec3(0.0);
  patchLight = vec3(0.0);
  vec3 beam = rd_beamColor();
  for (int i = 0; i < ${MAX_GLASS}; i++) {
    vec4 A = rdGlassA[i];
    vec4 B = rdGlassB[i];
    vec4 C = rdGlassC[i];
    if (C.z <= 0.0) continue;
    vec3 rel = W - A.xyz;
    float front = dot(rel, B.xyz);
    if (front < -0.02) continue;
    float area = 4.0 * A.w * B.w;
    float d2 = dot(rel, rel) + 0.05;
    vec3 L = -rel * inversesqrt(d2);
    float ndl = clamp(dot(N, L) * 0.65 + 0.35, 0.0, 1.0);
    float facing = smoothstep(0.15, 0.75, front * inversesqrt(d2));
    float reach = 2.2 + 0.5 * max(A.w, B.w);
    float k = 1.0 - sqrt(d2) / reach;
    float cone = (smoothstep(0.0, 0.1, k) * 0.35 + smoothstep(0.4, 0.5, k) * 0.65) * (1.0 - C.w);
    fill += rdVitreMer * (0.3 + 0.7 * C.x) * C.z * area * facing * ndl * cone / (area + d2 * 1.4) * (0.25 + 0.75 * rdDay);

    vec3 Lb = rd_beamDir(B.xyz);
    float denom = min(dot(Lb, B.xyz), -0.05);
    float t = -front / denom;
    if (t <= 0.0 || t > mix(16.0, 48.0, C.w)) continue;
    vec3 hit = rel + Lb * t;
    vec3 T = rd_glassT(B.xyz);
    vec2 uv = vec2(dot(hit, T), dot(hit, cross(B.xyz, T)));
    float m = rd_glassMask(uv, A, B, C, 0.03 + t * 0.025) * rd_beamStreak(uv, A.w, i);
    if (m <= 0.0) continue;
    float lit = m * smoothstep(-0.05, 0.3, dot(N, Lb)) * exp(-t * mix(0.06, 0.02, C.w)) * C.x * C.z * mix(1.0, 0.5, C.w);
    vec2 cu = uv * 2.4 + vec2(rdTime * 0.07, -rdTime * 0.05) + float(i) * 3.7;
    float aa = 1.0 - smoothstep(0.03, 0.12, foot * 2.4);
    float pattern = 0.8;
    if (aa > 0.0) {
      float e1 = 1.0 - smoothstep(0.0, 0.11, rd_cellEdge(cu, rdTime * 0.9));
      float e2 = 1.0 - smoothstep(0.0, 0.16, rd_cellEdge(cu * 1.37 + 4.1, rdTime * 0.7 + 1.3));
      pattern = mix(0.8, 0.45 + 0.75 * e1 + 0.45 * e2 + e1 * e2 * 0.8, aa);
    }
    patchLight += beam * lit * pattern;
  }
  return fill;
}
`

export const GLSL_VERTEX = GLSL_UNIFORMS + GLSL_NOISE
export const GLSL_COMMON = GLSL_UNIFORMS + GLSL_NOISE + GLSL_WATER + GLSL_GLASS
