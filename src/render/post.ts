import * as THREE from 'three'
import type { QualitySettings } from '../core/types'
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
uniform vec2 uTexel;
uniform float uThreshold;
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
    c *= w;
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

const COMPOSITE_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tShafts;
uniform sampler2D tRadial;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform float uIndoor;
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
  col += texture2D(tShafts, vUv).rgb;
#ifdef RADIAL
  col += texture2D(tRadial, vUv).rgb * 0.9 * (1.0 - uIndoor);
#endif
  col += texture2D(tBloom, vUv).rgb * 0.55;

  float l = luma(col);
  col = mix(col, col * uShadowTone * 1.6, (1.0 - smoothstep(0.0, 0.35, l)) * 0.22);
  col = mix(col, col * uHighTone, smoothstep(0.45, 1.2, l) * mix(0.18 + 0.2 * uWarm, 0.08, uIndoor));
  l = luma(col);
  col = mix(vec3(l), col, 1.06 - 0.1 * uNight - 0.08 * smoothstep(0.5, 1.0, l));
  float m = max(col.r, max(col.g, col.b));
  if (m > 0.82) col *= (0.82 + 0.18 * (1.0 - exp(-(m - 0.82) / 0.18))) / m;

  col *= mix(vec3(1.0), vec3(0.72, 0.84, 1.12), uNight * (1.0 - 0.75 * uIndoor));
  vec2 vq = vUv - 0.5;
  float vig = smoothstep(0.35, 0.95, length(vq * vec2(1.15, 1.0)));
  col = mix(col, col * 0.6 + mix(uProfond, uInterieur, uIndoor) * 0.25, vig * 0.35);

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
  finish(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3, warm: number, night: number): void
  setQuality(q: QualitySettings): void
  dispose(): void
}

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
  const shaftTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const radialTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const bloom: Target[] = [2, 4, 8].map((div) => ({ rt: new THREE.WebGLRenderTarget(1, 1, hf), div }))
  const targets: Target[] = [{ rt: shaftTarget, div: 2 }, { rt: radialTarget, div: 4 }, ...bloom]

  const downMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } },
    vertexShader: QUAD_VS, fragmentShader: DOWN_FS, depthTest: false, depthWrite: false,
  })
  const upMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VS, fragmentShader: UP_FS, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending, transparent: true,
  })
  const radialMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneTarget.texture }, tDepth: { value: depthTex }, uSun: { value: new THREE.Vector2() },
      uSunVis: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 4000 },
    },
    vertexShader: QUAD_VS, fragmentShader: RADIAL_FS, depthTest: false, depthWrite: false,
  })
  const compositeUniforms = {
    tScene: { value: sceneTarget.texture }, tDepth: { value: depthTex }, tBloom: { value: bloom[0]!.rt.texture },
    tShafts: { value: shaftTarget.texture }, tRadial: { value: radialTarget.texture },
    uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 4000 },
    uTime: pub.uTime, uIndoor: pub.uIndoor, uWarm: { value: 0 }, uNight: { value: 0 },
    uProfond: int.rdProfond,
    uShadowTone: { value: new THREE.Color(0x45507a) },
    uHighTone: { value: new THREE.Color(1.08, 1.0, 0.86) },
    uInterieur: int.rdInterieur,
  }
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: compositeUniforms, vertexShader: QUAD_VS, fragmentShader: COMPOSITE_FS, depthTest: false, depthWrite: false,
  })

  const setDefines = (q: QualitySettings) => {
    const defines: Record<string, string> = {}
    if (q.outline) defines.OUTLINE = ''
    if (q.painterly) defines.PAINTERLY = ''
    if (q.godRayPass) defines.RADIAL = ''
    compositeMat.defines = defines
    compositeMat.needsUpdate = true
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
    },
    finish(renderer, cam, sunDir, warm, night) {
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      compositeUniforms.uNear.value = cam.near
      compositeUniforms.uFar.value = cam.far
      compositeUniforms.uWarm.value = warm
      compositeUniforms.uNight.value = night

      if (godRays) {
        sunNdc.copy(cam.position).addScaledVector(sunDir, 1000).project(cam)
        const facing = sunNdc.z < 1 ? 1 : 0
        const r = radialMat.uniforms
        r.uSun!.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5)
        const off = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y))
        r.uSunVis!.value = facing * (1 - THREE.MathUtils.smoothstep(off, 1.2, 2.6)) * (1 - pub.uIndoor.value) * int.rdDay.value
        r.uNear!.value = cam.near
        r.uFar!.value = cam.far
        pass(renderer, radialMat, radialTarget, true)
      }

      let src: THREE.Texture = sceneTarget.texture
      let srcW = sceneTarget.width
      let srcH = sceneTarget.height
      for (let i = 0; i < bloom.length; i++) {
        const t = bloom[i]!.rt
        downMat.uniforms.tSrc!.value = src
        downMat.uniforms.uTexel!.value.set(1 / srcW, 1 / srcH)
        downMat.uniforms.uThreshold!.value = i === 0 ? 1.25 : 0
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
      depthTex.dispose()
      for (const m of [downMat, upMat, radialMat, compositeMat]) m.dispose()
      geo.dispose()
    },
  }
}
