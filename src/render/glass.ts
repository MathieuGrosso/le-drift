import * as THREE from 'three'
import { GLSL_COMMON } from './glsl'
import { MAX_LAMPS, MAX_WIPES, type AllUniforms } from './uniforms'
import { PALETTE } from './palette'

export const GLASS_LAYER = 2

export interface GlassParams {
  coat?: boolean
  tint?: number
  condensation?: boolean
  dome?: boolean
  round?: boolean
  vertexColors?: boolean
}

export interface GlassUniforms {
  rgCoat: { value: number }
  rgTint: { value: THREE.Color }
}

export interface GlassPassUniforms {
  rgScene: { value: THREE.Texture | null }
  rgSceneSoft: { value: THREE.Texture | null }
  rgDepth: { value: THREE.Texture | null }
  rgRes: { value: THREE.Vector2 }
  rgLive: { value: number }
}

export function createGlassPassUniforms(): GlassPassUniforms {
  return {
    rgScene: { value: null },
    rgSceneSoft: { value: null },
    rgDepth: { value: null },
    rgRes: { value: new THREE.Vector2(1, 1) },
    rgLive: { value: 0 },
  }
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
varying vec3 vTint;
uniform float rgCoat;
void main() {
  vUv = uv;
  vMeters = (uv - 0.5) * aSize;
  vCoat = max(aCoat, rgCoat);
  vSeed = aSeed;
  vTint = vec3(1.0);
#ifdef USE_COLOR
  vTint = color;
#endif
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
uniform float rgSkip;
uniform float rgUseColor;
uniform sampler2D rgScene;
uniform sampler2D rgSceneSoft;
uniform sampler2D rgDepth;
uniform vec2 rgRes;
uniform float rgLive;
varying vec2 vUv;
varying vec2 vMeters;
varying float vCoat;
varying float vSeed;
varying vec3 vW;
varying vec3 vN;
varying vec3 vTint;

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
vec3 rg_behind(vec2 uv, vec2 off, float soft) {
  vec2 o = uv + off;
  if (texture2D(rgDepth, o).r < gl_FragCoord.z) o = uv;
  vec3 sharp = vec3(
    texture2D(rgScene, o + off * 0.12).r,
    texture2D(rgScene, o).g,
    texture2D(rgScene, o - off * 0.12).b);
  if (soft <= 0.001) return sharp;
  vec2 t = 2.5 / rgRes;
  vec3 blur = texture2D(rgSceneSoft, o).rgb * 0.4
    + (texture2D(rgSceneSoft, o + vec2(t.x, t.y)).rgb + texture2D(rgSceneSoft, o - vec2(t.x, t.y)).rgb
    + texture2D(rgSceneSoft, o + vec2(t.x, -t.y)).rgb + texture2D(rgSceneSoft, o - vec2(t.x, -t.y)).rgb) * 0.15;
  return mix(sharp, blur, soft);
}

void main() {
  if (rgSkip > 0.5) discard;
  vec2 c = vUv - 0.5;
  float edgeDist = rgRound > 0.5 ? length(c) * 2.0 : max(abs(c.x), abs(c.y)) * 2.0;
  if (rgRound > 0.5 && edgeDist > 1.0) discard;
  vec2 suv = gl_FragCoord.xy / rgRes;
  if (rgLive > 0.5 && texture2D(rgDepth, suv).r < gl_FragCoord.z - 1e-6) discard;
  if (rgDome > 0.5) edgeDist = 0.35;
  vec2 q = rgDome > 0.5 ? vW.xz * 0.5 + vec2(vW.y * 0.7) : vMeters;
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  bool outside = dot(V, N) > 0.0;
  vec3 Nf = outside ? N : -N;
  float ndv = clamp(dot(Nf, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.0);
  float dist = length(vW - cameraPosition);
  vec3 tint = rgUseColor > 0.5 ? vTint : rgTint;

  float n = rg_fbm(q * 5.0 + vSeed * 17.0);
  float fineAA = 1.0 - smoothstep(0.25, 0.9, length(fwidth(q * 38.0)));
  float fine = mix(0.5, rd_noise(q * 38.0 + vSeed * 3.0), fineAA);
  vec2 qs = vec2(q.x * 0.8 + q.y * 0.6, q.y * 0.8 - q.x * 0.6);
  float strand = mix(0.5, rd_noise(qs * vec2(70.0, 9.0) + vSeed * 11.0), fineAA);
  float mask = edgeDist * 0.55 + n * 0.55 + fine * 0.12;
  float thr = 1.15 - vCoat * 1.3;
  float on = step(0.02, vCoat) * rgCoatOn;
  float cover = smoothstep(thr - 0.05, thr + 0.08, mask) * on;
  float thick = smoothstep(thr, thr + 0.4, mask) * on;
  float rim = cover * (1.0 - smoothstep(thr + 0.02, thr + 0.16, mask));

  float wob = rd_noise(q * 1.7 + vSeed * 5.0) - 0.5;
  float wob2 = rd_noise(q.yx * 3.9 + 11.0) - 0.5;
  float lens = rgRound > 0.5 ? pow(edgeDist, 3.0) : pow(edgeDist, 6.0);
  vec2 off = (vec2(wob, wob2) * 0.0045 + c * lens * 0.02 * (rgDome > 0.5 ? 0.0 : 1.0)) / max(0.6, dist * 0.08);
  if (rgDome > 0.5) off += vec2(wob, wob2) * 0.01;

  vec3 col;
  float a = 1.0;
  if (!outside) {
    float fog = 0.0;
    if (rgCondense > 0.5 && rdCondensation > 0.001) {
      fog = rdCondensation * (1.0 - rg_wiped(vW)) * (0.7 + 0.3 * rd_noise(q * 3.0));
    }
    vec3 behind = rgLive > 0.5 ? rg_behind(suv, off, max(fog, thick * 0.6)) : rdVitreMer * (0.35 + 0.5 * rdDay);
    float dayG = 0.55 + 0.45 * rdDay;
    float vy = rgDome > 0.5 ? smoothstep(-0.1, 0.95, -V.y) : smoothstep(-0.45, 0.5, c.y);
    vec3 seaFloor = mix(vec3(0.15, 0.44, 0.41), vec3(0.62, 0.86, 0.77), vy * vy * (3.0 - 2.0 * vy));
    vec3 sunUp = normalize(rdSunDir + vec3(0.0, 1.2, 0.0));
    float hot = pow(max(dot(-V, sunUp), 0.0), 7.0) * (rgDome > 0.5 ? 1.0 : 0.45);
    seaFloor += vec3(0.75, 0.95, 0.86) * hot * 0.8;
    seaFloor *= dayG * (1.0 + 0.2 * rdSunI);
    vec3 tinted = behind * mix(vec3(1.0), tint / max(max(tint.r, tint.g), tint.b), 0.18);
    col = rgLive > 0.5 ? tinted * 1.05 + seaFloor * 0.08 : seaFloor * 0.7 + tinted * 0.32;
    col *= 1.0 - 0.12 * smoothstep(0.86, 1.0, edgeDist) * (1.0 - rgRound * 0.5) * (1.0 - rgDome);
    vec3 edgeC = vec3(0.80, 1.0, 0.92);
    col += edgeC * (fres * 0.35 + smoothstep(0.9, 0.99, edgeDist) * 0.18 * (1.0 - rgDome)) * dayG;
    col += rdLampFill * 0.12 * fres;
    vec3 R = reflect(-V, Nf);
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      vec4 lp = rdLamps[i];
      if (lp.w <= 0.0) continue;
      vec3 tl = lp.xyz - vW;
      float d = length(tl);
      float s = pow(max(dot(R, tl / d), 0.0), 2500.0) * (1.0 - smoothstep(lp.w * 0.5, lp.w * 1.6, d));
      col += rdLampColors[i] * s * 0.9;
    }
    float soft = rd_noise(q * 2.2 + vSeed * 5.0) * 0.6 + n * 0.4;
    vec3 algae = mix(vec3(0.42, 0.62, 0.30), vec3(0.78, 0.90, 0.48), soft);
    vec3 seen = rgLive > 0.5 ? tinted : seaFloor;
    vec3 furBack = seen * mix(vec3(1.0), algae / max(algae.g, 1e-3), 0.55) * (0.6 + 0.3 * soft);
    furBack += vec3(0.86, 0.95, 0.52) * rim * 0.3 * dayG;
    col = mix(col, furBack, cover * (0.35 + 0.25 * thick));
    if (fog > 0.0) {
      float drops = 1.0 - smoothstep(0.0, 0.07, rd_cellEdge(q * 9.0 + vec2(0.0, rdTime * 0.01), 0.0));
      vec3 fogC = mix(rdCreme * 0.55, rdLampFill * 0.5 + rdCreme * 0.3, 0.45);
      col = mix(col, col * 0.7 + fogC * 0.45, fog * 0.7) + rdCreme * drops * fog * 0.12;
    }
    float ah = rd_airAmount(dist) * 0.6;
    col = mix(col, rd_airColor(dist), ah);
  } else {
    vec3 behind = rgLive > 0.5 ? rg_behind(suv, off * 1.3, thick * 0.5) : rdVitreLumiere * 0.4;
    vec3 glow = rdVitreLumiere * (0.08 + 0.4 * (1.0 - rdDay));
    col = behind * mix(vec3(1.0), tint, 0.3) * 0.92 + glow;
    vec3 R = reflect(-V, N);
    float sp = pow(max(dot(R, rdSunDir), 0.0), 70.0);
    col = mix(col, rd_hazeColor(R, vW.y) * 0.9, fres * 0.7);
    col += rdSunColor * rdSunI * sp * 1.4;
    vec3 fur = mix(rdRevetement * 0.5, rdRevetement * 1.12, n) * (0.78 + strand * 0.3 + fine * 0.12);
    fur *= mix(0.82, 1.0, thick);
    fur += vec3(0.85, 0.9, 0.45) * smoothstep(0.62, 0.92, strand * 0.6 + fine * 0.4) * 0.12;
    fur *= 0.6 + 0.4 * rdSunI + rd_caustics(vW) * rd_causticsStrength(vW) * 1.4;
    fur += mix(rdRevetement, vec3(0.8, 0.9, 0.5), 0.45) * rim * 0.4;
    fur += rdVitreLumiere * (1.0 - thick) * (0.08 + 0.4 * (1.0 - rdDay)) * dot(behind, vec3(0.33));
    col = mix(col, fur, cover * (0.88 + 0.12 * thick));
    float hz;
    col = rd_applyHaze(col, vW, true, hz);
  }
  float streak = smoothstep(0.93, 1.0, sin((vUv.x + vUv.y) * 9.0 + vSeed * 6.0)) * (1.0 - cover) * (0.05 + 0.2 * fres);
  col += rdPlafond * streak;
  if (rgLive < 0.5) a = outside ? mix(0.4 + 0.5 * fres, 0.97, cover) : mix(0.12 + 0.4 * fres, 0.85, cover);
  gl_FragColor = vec4(col, a);
}
`

export function createGlassFactory(shared: AllUniforms, pass: GlassPassUniforms, seen: () => void) {
  return function glass(params: GlassParams = {}): THREE.ShaderMaterial {
    const own = {
      rgCoat: { value: 0 },
      rgTint: { value: new THREE.Color(params.tint ?? PALETTE.vitreMer) },
      rgRound: { value: params.round ? 1 : 0 },
      rgDome: { value: params.dome ? 1 : 0 },
      rgCoatOn: { value: params.coat === false ? 0 : 1 },
      rgCondense: { value: params.condensation ? 1 : 0 },
      rgSkip: { value: 0 },
      rgUseColor: { value: params.vertexColors ? 1 : 0 },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...pass, ...own },
      vertexShader: GLASS_VS,
      fragmentShader: GLSL_COMMON + GLASS_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: params.vertexColors ?? false,
    })
    Object.assign(mat.defaultAttributeValues as Record<string, number[]>, { aCoat: [0], aSeed: [0], aSize: [1, 1] })
    // Glass is drawn in its own pass over a copy of the frame (refraction); the first frame moves it there.
    mat.onBeforeRender = (_r, _s, _c, _g, object) => {
      const onLayer = object.layers.mask === 1 << GLASS_LAYER
      if (!onLayer) object.layers.set(GLASS_LAYER)
      const skip = onLayer ? 0 : 1
      if (own.rgSkip.value !== skip) {
        own.rgSkip.value = skip
        mat.uniformsNeedUpdate = true
      }
      seen()
    }
    mat.userData.rdGlass = true
    mat.userData.glassUniforms = own satisfies GlassUniforms
    mat.name = params.dome ? 'rd-glass-dome' : 'rd-glass'
    return mat
  }
}
