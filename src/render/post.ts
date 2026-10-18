import * as THREE from 'three'
import type { QualitySettings } from '../core/types'
import type { GlassPassUniforms } from './glass'
import type { InternalUniforms, PublicUniforms } from './uniforms'

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  c /= 8.0;
  if (uThreshold > 0.0) {
    float br = max(c.r, max(c.g, c.b));
    float knee = uThreshold * 0.5;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    float z = texture2D(tDepth, vUv).r * 2.0 - 1.0;
    float vz = 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    c *= w * smoothstep(1.0, 1.8, vz);
  }
  gl_FragColor = vec4(c, 1.0);
}
`

const UP_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb
      + texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb
     + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}
`

const RADIAL_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uSun;
uniform float uSunVis;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
float viewZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
void main() {
  if (uSunVis <= 0.001) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 uv = vUv;
  vec2 delta = (uv - uSun) * (0.85 / 40.0);
  float decay = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    uv -= delta;
    vec2 s = clamp(uv, 0.0, 1.0);
    float far = smoothstep(150.0, 600.0, viewZ(texture2D(tDepth, s).r));
    vec3 c = texture2D(tScene, s).rgb;
    float br = max(c.r, max(c.g, c.b));
    acc += c * smoothstep(0.55, 1.4, br) * far * decay;
    decay *= 0.955;
  }
  gl_FragColor = vec4(acc / 40.0 * uSunVis, 1.0);
}
`

const COPY_FS = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }
`

const SOFT_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) c += texture2D(tSrc, vUv + vec2(float(x), float(y)) * uTexel * 1.5).rgb;
  gl_FragColor = vec4(c / 9.0, 1.0);
}
`

const AO_FS = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform float uProjScale;
uniform float uRadius;
uniform vec2 uTexel;
uniform vec2 uFull;
varying vec2 vUv;
vec2 snapUv(vec2 uv) { return (floor(uv / uFull) + 0.5) * uFull; }
vec3 viewPos(vec2 uv) {
  uv = snapUv(uv);
  float d = texture2D(tDepth, uv).r;
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  vec2 uv0 = snapUv(vUv);
  vec3 P = viewPos(uv0);
  float z = -P.z;
  if (z > 90.0) { gl_FragColor = vec4(1.0); return; }
  vec3 px = viewPos(uv0 + vec2(uFull.x, 0.0)) - P;
  vec3 nx = P - viewPos(uv0 - vec2(uFull.x, 0.0));
  vec3 py = viewPos(uv0 + vec2(0.0, uFull.y)) - P;
  vec3 ny = P - viewPos(uv0 - vec2(0.0, uFull.y));
  vec3 dx = abs(px.z) < abs(nx.z) ? px : nx;
  vec3 dy = abs(py.z) < abs(ny.z) ? py : ny;
  vec3 N = normalize(cross(dx, dy));
  float rUv = uRadius * uProjScale / max(z, 0.3);
  rUv = min(rUv, 0.12);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float occ = 0.0;
  const int N_S = 12;
  for (int i = 0; i < N_S; i++) {
    float f = (float(i) + jit) / float(N_S);
    float a = f * 43.98 + jit * 6.283;
    vec2 o = vec2(cos(a), sin(a)) * rUv * (0.15 + 0.85 * f * f);
    vec3 v = viewPos(uv0 + o) - P;
    float l2 = dot(v, v);
    float nd = dot(N, v) * inversesqrt(l2 + 1e-4);
    occ += max(nd - 0.1, 0.0) * (1.0 - smoothstep(0.0, uRadius * uRadius * 4.0, l2));
  }
  float ao = 1.0 - clamp(occ / float(N_S) * 3.2, 0.0, 1.0);
  ao = mix(1.0, ao, 1.0 - smoothstep(50.0, 90.0, z));
  gl_FragColor = vec4(ao, ao, ao, 1.0);
}
`

const AO_BLUR_FS = /* glsl */ `
uniform sampler2D tAO;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
float viewZ(vec2 uv) {
  float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
void main() {
  float z0 = viewZ(vUv);
  float acc = 0.0;
  float wsum = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 uv = vUv + (vec2(float(x), float(y)) - 1.5) * uTexel;
      float w = 1.0 / (1.0 + abs(viewZ(uv) - z0) / max(z0 * 0.03, 0.02));
      acc += texture2D(tAO, uv).r * w;
      wsum += w;
    }
  }
  float ao = acc / wsum;
  gl_FragColor = vec4(ao, ao, ao, 1.0);
}
`

const EXPOSURE_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tPrev;
uniform float uK;
uniform float uIndoor;
uniform float uNight;
varying vec2 vUv;
void main() {
  float acc = 0.0;
  float wsum = 0.0;
  for (int y = 0; y < 7; y++) {
    for (int x = 0; x < 7; x++) {
      vec2 uv = (vec2(float(x), float(y)) + 0.5) / 7.0;
      float w = 1.0 - 0.6 * length(uv - 0.5);
      vec3 c = texture2D(tSrc, uv).rgb;
      acc += log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-3)) * w;
      wsum += w;
    }
  }
  float avg = exp(acc / wsum);
  float key = mix(0.36, 0.3, uIndoor);
  float target = clamp(key / max(avg, 1e-3), mix(0.86, 0.82, uIndoor), mix(1.18, mix(1.1, 1.0, uNight), uIndoor));
  float prev = texture2D(tPrev, vec2(0.5)).r;
  if (prev <= 0.0) prev = 1.0;
  float e = mix(prev, target, uK);
  gl_FragColor = vec4(e, e, e, 1.0);
}
`

const COMPOSITE_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tShafts;
uniform sampler2D tRadial;
uniform sampler2D tAO;
uniform sampler2D tExposure;
uniform float uAO;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform float uIndoor;
uniform float uAirHaze;
uniform float uWarm;
uniform float uNight;
uniform vec3 uProfond;
uniform vec3 uShadowTone;
uniform vec3 uHighTone;
uniform vec3 uInterieur;
varying vec2 vUv;

float viewZ(vec2 uv) {
  float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

#ifdef PAINTERLY
vec3 kuwahara(vec2 uv) {
  vec3 m[4];
  vec3 s[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec3 c = texture2D(tScene, uv + vec2(float(i), float(j)) * uTexel).rgb;
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; }
      if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; }
      if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; }
      if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; }
    }
  }
  vec3 best = vec3(0.0);
  float bestV = 1e9;
  for (int k = 0; k < 4; k++) {
    vec3 mu = m[k] / 9.0;
    vec3 v = abs(s[k] / 9.0 - mu * mu);
    float vv = v.r + v.g + v.b;
    if (vv < bestV) { bestV = vv; best = mu; }
  }
  return best;
}
#endif

void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  float dc = viewZ(vUv);
#ifdef PAINTERLY
  float farMix = smoothstep(60.0, 220.0, dc) * (1.0 - uIndoor);
  if (farMix > 0.01) col = mix(col, kuwahara(vUv), farMix);
#endif
#ifdef OUTLINE
  vec2 o = uTexel;
  float d1 = viewZ(vUv + vec2(o.x, 0.0));
  float d2 = viewZ(vUv - vec2(o.x, 0.0));
  float d3 = viewZ(vUv + vec2(0.0, o.y));
  float d4 = viewZ(vUv - vec2(0.0, o.y));
  float lap = abs(d1 + d2 + d3 + d4 - 4.0 * dc) / max(dc, 0.5);
  float edge = smoothstep(0.06, 0.2, lap) * (1.0 - smoothstep(40.0, 220.0, dc));
  col = mix(col, col * 0.55 + uProfond * 0.45, edge * 0.4);
#endif
  if (uAO > 0.0) {
    float ao = texture2D(tAO, vUv).r;
    vec3 plum = uInterieur / max(max(uInterieur.r, uInterieur.g), uInterieur.b);
    vec3 aoTint = mix(vec3(1.0), mix(uShadowTone / max(max(uShadowTone.r, uShadowTone.g), uShadowTone.b), plum, uIndoor), 0.55);
    float d = (1.0 - ao) * uAO * mix(0.6, 1.0, uIndoor);
    col *= mix(vec3(1.0), aoTint, d) * (1.0 - 0.6 * d);
  }
  if (dc < 28.0 && dc > 1.0) {
    vec2 px = uTexel * max(1.0, 1.0 / (uTexel.y * 720.0)) * 2.5;
    vec3 wrap = vec3(0.0);
    float wn = 0.0;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7854;
      vec2 o = vec2(cos(a), sin(a)) * px;
      float far = smoothstep(1.35, 1.9, viewZ(vUv + o) / dc);
      wrap += texture2D(tScene, vUv + o).rgb * far;
      wn += far;
    }
    if (wn > 0.0) {
      vec3 bg = wrap / wn;
      float lift = smoothstep(0.0, 0.25, luma(bg) - luma(col));
      vec3 coolBg = mix(bg, bg * vec3(0.82, 1.04, 1.1), uIndoor);
      float coolK = smoothstep(0.0, 0.08, bg.b - bg.r) * uIndoor;
      col += coolBg * lift * min(wn / 3.0, 1.0) * mix(0.55, 1.1, coolK) * smoothstep(1.2, 2.2, dc) * (1.0 - smoothstep(14.0, 28.0, dc));
    }
  }
  col *= mix(1.0, mix(0.6, 1.0, smoothstep(0.35, 1.6, dc)), uIndoor);
  col *= texture2D(tExposure, vec2(0.5)).r;
  col += texture2D(tShafts, vUv).rgb;
#ifdef RADIAL
  col += texture2D(tRadial, vUv).rgb * 0.9 * (1.0 - uIndoor);
#endif
  col += texture2D(tBloom, vUv).rgb * mix(0.55, mix(0.3, 0.45, clamp(uAirHaze, 0.0, 1.0)), uIndoor);

  float l = luma(col);
  vec3 shadowTone = mix(uShadowTone, uInterieur, uIndoor);
  col = mix(col, col * shadowTone * 1.6, (1.0 - smoothstep(0.0, 0.3, l)) * mix(0.22, 0.16, uIndoor));
  col = mix(col, col * uHighTone, smoothstep(0.45, 1.2, l) * mix(0.18 + 0.2 * uWarm, 0.08, uIndoor));
  float lc = max(luma(col), 1e-4);
  float pivot = 0.22;
  float lcC = pivot * pow(lc / pivot, 1.0 + 0.3 * uIndoor);
  col *= mix(1.0, lcC / lc, smoothstep(0.0, 0.02, lc));
  l = luma(col);
  float mid = smoothstep(0.03, 0.15, l) * (1.0 - smoothstep(0.45, 0.85, l));
  col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.92), mid * uIndoor);
  col = mix(vec3(l), col, 1.06 - uIndoor * (0.02 + 0.12 * mid) - 0.1 * uNight - 0.08 * smoothstep(0.5, 1.0, l));
  float m = max(col.r, max(col.g, col.b));
  if (m > 0.82) col *= (0.82 + 0.18 * (1.0 - exp(-(m - 0.82) / 0.18))) / m;

  col *= mix(vec3(1.0), vec3(0.72, 0.84, 1.12), uNight * (1.0 - 0.75 * uIndoor));
  vec2 vq = vUv - 0.5;
  float vig = smoothstep(0.25, 0.95, length(vq * vec2(1.15, 1.0)));
  vec3 plumHue = uInterieur / max(max(uInterieur.r, uInterieur.g), uInterieur.b);
  vec3 vigCol = mix(col * 0.6 + uProfond * 0.25, col * plumHue * 0.5, uIndoor);
  col = mix(col, vigCol, vig * mix(0.35, 0.5, uIndoor));
  vec3 toe = vec3(0.027, 0.023, 0.058);
  col = max(col, toe * 0.5) + toe * 0.5 * (1.0 - smoothstep(0.0, 0.05, luma(col)));

  col = toSRGB(col);
  float g = hash(vUv * 1000.0 + fract(uTime) * 37.0) - 0.5;
#ifdef PAINTERLY
  float paper = hash(floor(vUv / uTexel / 2.0)) - 0.5;
  col += paper * 0.012;
#endif
  col += g * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`

interface Target { rt: THREE.WebGLRenderTarget; div: number }

export interface Post {
  sceneTarget: THREE.WebGLRenderTarget
  shaftTarget: THREE.WebGLRenderTarget
  begin(renderer: THREE.WebGLRenderer): void
  prepareGlass(renderer: THREE.WebGLRenderer, pass: GlassPassUniforms): THREE.WebGLRenderTarget
  finish(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, frame: PostFrame): void
  setQuality(q: QualitySettings): void
  dispose(): void
}

export interface PostFrame {
  sunDir: THREE.Vector3
  warm: number
  night: number
  dt: number
  snap: boolean
  color: THREE.Texture
}

const AO_LEVELS: Record<QualitySettings['level'], number> = { high: 1, medium: 0.85, low: 0 }

export function createPost(pub: PublicUniforms, int: InternalUniforms, quality: QualitySettings): Post {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const quad = new THREE.Mesh(geo)
  quad.frustumCulled = false

  const hf = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter }
  const depthTex = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: true, depthTexture: depthTex, samples: quality.level === 'low' ? 0 : 4,
  })
  const mergedTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const softTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const shaftTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const radialTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const aoTarget = new THREE.WebGLRenderTarget(1, 1, { ...hf, type: THREE.UnsignedByteType })
  const aoBlurTarget = new THREE.WebGLRenderTarget(1, 1, { ...hf, type: THREE.UnsignedByteType })
  const bloom: Target[] = [2, 4, 8].map((div) => ({ rt: new THREE.WebGLRenderTarget(1, 1, hf), div }))
  const targets: Target[] = [
    { rt: mergedTarget, div: 1 }, { rt: softTarget, div: 4 }, { rt: shaftTarget, div: 2 }, { rt: radialTarget, div: 4 },
    { rt: aoTarget, div: 2 }, { rt: aoBlurTarget, div: 2 }, ...bloom,
  ]
  const exposure = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }))
  let expIdx = 0

  const quadMat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}) =>
    new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader, depthTest: false, depthWrite: false, ...extra })

  const downMat = quadMat(DOWN_FS, {
    tSrc: { value: null }, tDepth: { value: depthTex }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 },
    uNear: { value: 0.1 }, uFar: { value: 4000 },
  })
  const upMat = quadMat(UP_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, {
    blending: THREE.AdditiveBlending, transparent: true,
  })
  const copyMat = quadMat(COPY_FS, { tSrc: { value: null } })
  const softMat = quadMat(SOFT_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } })
  const aoMat = quadMat(AO_FS, {
    tDepth: { value: depthTex }, uProjInv: { value: new THREE.Matrix4() }, uProjScale: { value: 1 },
    uRadius: { value: 0.75 }, uTexel: { value: new THREE.Vector2() }, uFull: { value: new THREE.Vector2() },
  })
  const aoBlurMat = quadMat(AO_BLUR_FS, {
    tAO: { value: aoTarget.texture }, tDepth: { value: depthTex }, uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.1 }, uFar: { value: 4000 },
  })
  const expMat = quadMat(EXPOSURE_FS, {
    tSrc: { value: softTarget.texture }, tPrev: { value: null }, uK: { value: 1 }, uIndoor: pub.uIndoor, uNight: { value: 0 },
  })
  const radialMat = quadMat(RADIAL_FS, {
    tScene: { value: sceneTarget.texture }, tDepth: { value: depthTex }, uSun: { value: new THREE.Vector2() },
    uSunVis: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 4000 },
  })
  const compositeUniforms = {
    tScene: { value: sceneTarget.texture as THREE.Texture }, tDepth: { value: depthTex }, tBloom: { value: bloom[0]!.rt.texture },
    tShafts: { value: shaftTarget.texture }, tRadial: { value: radialTarget.texture },
    tAO: { value: aoBlurTarget.texture }, tExposure: { value: exposure[0]!.texture }, uAO: { value: AO_LEVELS[quality.level] },
    uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 4000 },
    uTime: pub.uTime, uIndoor: pub.uIndoor, uAirHaze: pub.uAirHaze, uWarm: { value: 0 }, uNight: { value: 0 },
    uProfond: int.rdProfond,
    uShadowTone: { value: new THREE.Color(0x45507a) },
    uHighTone: { value: new THREE.Color(1.08, 1.0, 0.86) },
    uInterieur: int.rdInterieur,
  }
  const compositeMat = quadMat(COMPOSITE_FS, compositeUniforms)

  const setDefines = (q: QualitySettings) => {
    const defines: Record<string, string> = {}
    if (q.outline) defines.OUTLINE = ''
    if (q.painterly) defines.PAINTERLY = ''
    if (q.godRayPass) defines.RADIAL = ''
    compositeMat.defines = defines
    compositeMat.needsUpdate = true
    compositeUniforms.uAO.value = AO_LEVELS[q.level]
    const samples = q.level === 'low' ? 0 : 4
    if (sceneTarget.samples !== samples) {
      sceneTarget.samples = samples
      sceneTarget.dispose()
    }
  }
  setDefines(quality)
  let godRays = quality.godRayPass

  const size = new THREE.Vector2()
  const sunNdc = new THREE.Vector3()
  const pass = (renderer: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null, clear: boolean) => {
    quad.material = mat
    renderer.setRenderTarget(target)
    if (clear) renderer.clear(true, false, false)
    renderer.render(quad, camera)
  }
  const soft = (renderer: THREE.WebGLRenderer, src: THREE.Texture) => {
    softMat.uniforms.tSrc!.value = src
    softMat.uniforms.uTexel!.value.set(1 / sceneTarget.width, 1 / sceneTarget.height)
    pass(renderer, softMat, softTarget, false)
  }
  let softFresh = false

  return {
    sceneTarget,
    shaftTarget,
    begin(renderer) {
      renderer.getDrawingBufferSize(size)
      const w = Math.max(1, Math.floor(size.x))
      const h = Math.max(1, Math.floor(size.y))
      if (sceneTarget.width !== w || sceneTarget.height !== h) {
        sceneTarget.setSize(w, h)
        for (const t of targets) t.rt.setSize(Math.max(1, Math.floor(w / t.div)), Math.max(1, Math.floor(h / t.div)))
        compositeUniforms.uTexel.value.set(1 / w, 1 / h)
      }
      softFresh = false
    },
    prepareGlass(renderer, glass) {
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      copyMat.uniforms.tSrc!.value = sceneTarget.texture
      pass(renderer, copyMat, mergedTarget, false)
      soft(renderer, sceneTarget.texture)
      softFresh = true
      renderer.autoClear = autoClear
      glass.rgScene.value = sceneTarget.texture
      glass.rgSceneSoft.value = softTarget.texture
      glass.rgDepth.value = depthTex
      glass.rgRes.value.set(sceneTarget.width, sceneTarget.height)
      return mergedTarget
    },
    finish(renderer, cam, f) {
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      compositeUniforms.uNear.value = cam.near
      compositeUniforms.uFar.value = cam.far
      compositeUniforms.uWarm.value = f.warm
      compositeUniforms.uNight.value = f.night
      expMat.uniforms.uNight!.value = f.night
      compositeUniforms.tScene.value = f.color
      radialMat.uniforms.tScene!.value = f.color

      if (!softFresh) soft(renderer, f.color)
      const prev = exposure[expIdx]!
      expIdx = 1 - expIdx
      expMat.uniforms.tPrev!.value = f.snap ? null : prev.texture
      expMat.uniforms.uK!.value = f.snap ? 1 : 1 - Math.exp(-f.dt * 1.6)
      pass(renderer, expMat, exposure[expIdx]!, false)
      compositeUniforms.tExposure.value = exposure[expIdx]!.texture

      if (compositeUniforms.uAO.value > 0) {
        const a = aoMat.uniforms
        a.uProjInv!.value.copy(cam.projectionMatrixInverse)
        a.uProjScale!.value = cam.projectionMatrix.elements[5]! * 0.5
        a.uTexel!.value.set(1 / aoTarget.width, 1 / aoTarget.height)
        a.uFull!.value.set(1 / sceneTarget.width, 1 / sceneTarget.height)
        pass(renderer, aoMat, aoTarget, false)
        const b = aoBlurMat.uniforms
        b.uTexel!.value.set(1 / aoTarget.width, 1 / aoTarget.height)
        b.uNear!.value = cam.near
        b.uFar!.value = cam.far
        pass(renderer, aoBlurMat, aoBlurTarget, false)
      }

      if (godRays) {
        sunNdc.copy(cam.position).addScaledVector(f.sunDir, 1000).project(cam)
        const facing = sunNdc.z < 1 ? 1 : 0
        const r = radialMat.uniforms
        r.uSun!.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5)
        const off = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y))
        r.uSunVis!.value = facing * (1 - THREE.MathUtils.smoothstep(off, 1.2, 2.6)) * (1 - pub.uIndoor.value) * int.rdDay.value
        r.uNear!.value = cam.near
        r.uFar!.value = cam.far
        pass(renderer, radialMat, radialTarget, true)
      }

      let src: THREE.Texture = f.color
      let srcW = sceneTarget.width
      let srcH = sceneTarget.height
      for (let i = 0; i < bloom.length; i++) {
        const t = bloom[i]!.rt
        downMat.uniforms.tSrc!.value = src
        downMat.uniforms.uTexel!.value.set(1 / srcW, 1 / srcH)
        downMat.uniforms.uThreshold!.value = i === 0 ? 1.15 + pub.uIndoor.value * 0.3 : 0
        downMat.uniforms.uNear!.value = cam.near
        downMat.uniforms.uFar!.value = cam.far
        pass(renderer, downMat, t, true)
        src = t.texture
        srcW = t.width
        srcH = t.height
      }
      for (let i = bloom.length - 1; i > 0; i--) {
        const from = bloom[i]!.rt
        upMat.uniforms.tSrc!.value = from.texture
        upMat.uniforms.uTexel!.value.set(1 / from.width, 1 / from.height)
        pass(renderer, upMat, bloom[i - 1]!.rt, false)
      }

      pass(renderer, compositeMat, null, true)
      renderer.autoClear = autoClear
    },
    setQuality(q) {
      setDefines(q)
      godRays = q.godRayPass
    },
    dispose() {
      sceneTarget.dispose()
      for (const t of targets) t.rt.dispose()
      for (const t of exposure) t.dispose()
      depthTex.dispose()
      for (const m of [downMat, upMat, copyMat, softMat, aoMat, aoBlurMat, expMat, radialMat, compositeMat]) m.dispose()
      geo.dispose()
    },
  }
}
