import * as THREE from 'three'
import type { GameContext } from '../core/types'

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vColor;
varying vec4 vMat;
attribute vec3 color;
attribute vec4 aMat;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vColor = color;
  vMat = aMat;
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * objectNormal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShadow;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uIndoor;
uniform vec4 uLamps[8];
uniform vec3 uLampColors[8];
uniform float uWet;
uniform float uFade;
uniform float uHazeDist;
uniform float uHazeMax;
uniform vec3 uSea;
uniform vec4 uKey;
uniform vec3 uKeyColor;
uniform vec4 uFill;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vColor;
varying vec4 vMat;

float band(float x, float e) { return smoothstep(e - 0.04, e + 0.04, x); }
float bandW(float x, float e, float w) { return smoothstep(e - w, e + w, x); }

float knit(vec2 k) {
  float fw = max(fwidth(k.x), fwidth(k.y));
  float x = fract(k.x) * 2.0 - 1.0;
  float vv = fract(k.y + abs(x) * 0.6);
  float loop = smoothstep(0.0, 0.3, vv) * smoothstep(1.0, 0.62, vv);
  float valley = smoothstep(1.0, 0.72, abs(x));
  float s = mix(0.74, 1.08, loop * valley);
  return mix(s, 0.93, smoothstep(0.3, 0.75, fw));
}

void main() {
  if (uFade < 0.999) {
    float d = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
    if (d > uFade) discard;
  }
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec3 albedo = vColor * mix(1.0, 0.72, uWet);
  if (vMat.y > 0.5) albedo *= knit(vMat.zw);
  float skin = vMat.x;
  float sw = mix(0.04, 0.3, skin);
  float se = -0.12 * skin;
  float wool = step(0.5, vMat.y);
  vec3 albedoSh = mix(albedo, albedo * vec3(0.70, 0.60, 1.11), skin);
  albedoSh = mix(albedoSh, albedo * vec3(0.72, 0.66, 0.80), wool);

  float ndl = dot(n, normalize(uSunDir));
  float lit = 0.55 * bandW(ndl, se, sw) + 0.45 * bandW(ndl, 0.45, sw);
  vec3 sun = mix(vec3(1.0), uSunColor, 0.6);
  vec3 outside = mix(albedoSh * mix(vec3(1.0), uShadow, 0.55 * (1.0 - skin)) * 0.78, albedo * sun * 1.08, lit);
  outside += albedo * vec3(0.3, 0.05, 0.02) * exp(-ndl * ndl * 14.0) * skin;
  outside += albedo * mix(uGround, uSky, n.y * 0.5 + 0.5) * 0.28;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * (0.45 + 0.55 * max(ndl + 0.3, 0.0));
  outside += uSunColor * rim * 0.6;

  vec3 lamp = vec3(0.0);
  vec3 lampDir = vec3(0.0);
  float sss = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 l = uLamps[i];
    if (l.w <= 0.0) continue;
    vec3 dl = l.xyz - vWorldPos;
    float dist = length(dl);
    float att = clamp(1.0 - dist / l.w, 0.0, 1.0);
    float nl = dot(n, dl / max(dist, 1e-3));
    float step1 = 0.5 * bandW(nl, se, sw) + 0.5 * bandW(nl, 0.5, sw);
    lamp += mix(vec3(1.0), uLampColors[i], 0.4 - 0.25 * wool) * att * att * (mix(0.35, 0.18, skin) + mix(0.65, 0.82, skin) * step1) * (1.0 - 0.18 * wool);
    sss += att * att * exp(-nl * nl * 14.0);
    lampDir += dl / max(dist, 1e-3) * att * att;
  }
  vec3 amb = mix(vec3(0.24, 0.23, 0.35), vec3(0.95, 0.9, 0.8), 0.35);
  float warmth = vColor.r - vColor.b;
  amb = mix(amb, amb * vec3(1.12, 0.92, 0.9), clamp(warmth * 2.0, 0.0, 1.0) * (1.0 - wool));
  vec3 inside = mix(albedoSh, albedo, 0.25) * amb + albedo * lamp;
  float kl = dot(n, uKey.xyz);
  inside += albedo * uKeyColor * uKey.w * (0.5 * bandW(kl, se, sw) + 0.5 * bandW(kl, 0.4, sw));
  sss += uKey.w * exp(-kl * kl * 14.0);
  float fw = clamp(dot(n, uFill.xyz) * 0.5 + 0.5, 0.0, 1.0);
  inside += albedo * mix(vec3(1.0, 0.74, 0.5), vec3(1.0, 0.86, 0.74), wool) * uFill.w * mix(fw * 0.6 + 0.4, fw * fw * 1.4, skin);
  inside += albedo * vec3(0.32, 0.06, 0.03) * min(sss, 1.5) * skin;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
  float lampSide = length(lampDir) > 1e-3 ? dot(n, normalize(lampDir)) * 0.5 + 0.5 : 0.5;
  vec3 coolRim = mix(vec3(0.62, 0.86, 0.88), uKeyColor, step(0.001, uKey.w));
  float coolSide = max(lampSide < 0.5 ? 1.0 - lampSide : 0.0, uKey.w > 0.0 ? smoothstep(-0.2, 0.5, kl) : 0.0);
  inside += vec3(1.0, 0.76, 0.48) * fres * smoothstep(0.45, 0.8, lampSide) * 0.3;
  inside += coolRim * smoothstep(mix(0.55, 0.3, uKey.w), 0.8, fres) * coolSide * (0.35 + uKey.w * 0.5);

  vec3 col = mix(outside, inside, uIndoor);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, mix(vec3(lum), col, 0.84), wool * uIndoor);
  float sea = 1.0 - uIndoor;
  if (sea > 0.001) {
    float d = length(cameraPosition - vWorldPos);
    float h = (1.0 - exp(-d / max(uHazeDist, 1.0) * 2.5)) * uHazeMax * sea;
    col = mix(col, uSea, clamp(h, 0.0, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

export interface HeroMaterials {
  body: THREE.ShaderMaterial
  cloth: THREE.ShaderMaterial
  wet: { value: number }
  fade: { value: number }
  key: { value: THREE.Vector4 }
  fill: { value: THREE.Vector4 }
}

function lampDefaults(): { lamps: THREE.Vector4[]; colors: THREE.Color[] } {
  const lamps: THREE.Vector4[] = []
  const colors: THREE.Color[] = []
  for (let i = 0; i < 8; i++) {
    lamps.push(new THREE.Vector4(0, 0, 0, 0))
    colors.push(new THREE.Color(0xffc27a))
  }
  return { lamps, colors }
}

export function createHeroMaterials(ctx: GameContext): HeroMaterials {
  const shared = ctx.services.render?.uniforms
  const fallback = lampDefaults()
  const wet = { value: 0 }
  const fade = { value: 1 }
  const key = { value: new THREE.Vector4(0, 0, 0, 0) }
  const fill = { value: new THREE.Vector4(0, 0, 0, 0) }
  const keyColor = { value: new THREE.Color(0x9fd6e0) }
  const make = (side: THREE.Side) => {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog])
    Object.assign(uniforms, {
      uSunDir: shared?.uSunDir ?? { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
      uSunColor: shared?.uSunColor ?? { value: new THREE.Color(0xfff1c9) },
      uShadow: { value: new THREE.Color(0x45507a) },
      uSky: { value: new THREE.Color(0xcfefe3) },
      uGround: { value: new THREE.Color(0x1b5e73) },
      uIndoor: shared?.uIndoor ?? { value: 0 },
      uLamps: shared?.uLamps ?? { value: fallback.lamps },
      uLampColors: shared?.uLampColors ?? { value: fallback.colors },
      uWet: wet,
      uFade: fade,
      uHazeDist: shared?.uHazeDist ?? { value: 170 },
      uHazeMax: shared?.uHazeMax ?? { value: 0.9 },
      uSea: { value: new THREE.Color(0x2e7f8c) },
      uKey: key,
      uKeyColor: keyColor,
      uFill: fill,
    })
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true, side })
    m.name = 'hero-cel'
    return m
  }
  return { body: make(THREE.FrontSide), cloth: make(THREE.DoubleSide), wet, fade, key, fill }
}
