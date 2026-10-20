import * as THREE from 'three'
import { N8AOPostPass } from 'n8ao'
import { BloomEffect, EffectPass, SMAAEffect } from 'postprocessing'
import { POST } from '../core/tuning'
import type { QualitySettings } from '../core/types'
import { GradeEffect } from './grade'
import type { MoodInputs } from './lut'
import { PALETTE } from './palette'
import type { GlassPassUniforms } from './glass'
import type { InternalUniforms, PublicUniforms } from './uniforms'

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
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

const E = Object.fromEntries(Object.entries(POST.exposure).map(([k, v]) => [k, v.toFixed(3)])) as Record<keyof typeof POST.exposure, string>
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
  float key = mix(${E.keyOut}, ${E.keyIn}, uIndoor);
  float lo = mix(${E.minOut}, ${E.minIn}, uIndoor);
  float hi = mix(${E.maxOut}, mix(${E.maxIn}, ${E.maxInNight}, uNight), uIndoor);
  float target = clamp(key / max(avg, 1e-3), lo, hi);
  float prev = texture2D(tPrev, vec2(0.5)).r;
  if (prev <= 0.0) prev = 1.0;
  float e = mix(prev, target, uK);
  gl_FragColor = vec4(e, e, e, 1.0);
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
  mood: MoodInputs
  dt: number
  snap: boolean
  color: THREE.WebGLRenderTarget
}

const msaaSamples = (q: QualitySettings) => (q.level === 'low' ? 0 : 4)

export function createPost(
  pub: PublicUniforms, int: InternalUniforms, quality: QualitySettings, scene: THREE.Scene, mainCamera: THREE.PerspectiveCamera,
): Post {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const quad = new THREE.Mesh(geo)
  quad.frustumCulled = false

  const hf = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter }
  const depthTex = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: true, depthTexture: depthTex, samples: msaaSamples(quality),
  })
  const mergedTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const aoColorTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const gradedTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const softTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const shaftTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const radialTarget = new THREE.WebGLRenderTarget(1, 1, hf)
  const targets: Target[] = [
    { rt: mergedTarget, div: 1 }, { rt: aoColorTarget, div: 1 }, { rt: gradedTarget, div: 1 },
    { rt: softTarget, div: 4 }, { rt: shaftTarget, div: 2 }, { rt: radialTarget, div: 4 },
  ]
  const exposure = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }))
  let expIdx = 0

  const quadMat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader, depthTest: false, depthWrite: false })

  const copyMat = quadMat(COPY_FS, { tSrc: { value: null } })
  const softMat = quadMat(SOFT_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } })
  const expMat = quadMat(EXPOSURE_FS, {
    tSrc: { value: softTarget.texture }, tPrev: { value: null }, uK: { value: 1 }, uIndoor: pub.uIndoor, uNight: { value: 0 },
  })
  const radialMat = quadMat(RADIAL_FS, {
    tScene: { value: sceneTarget.texture }, tDepth: { value: depthTex }, uSun: { value: new THREE.Vector2() },
    uSunVis: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 4000 },
  })

  const bloom = new BloomEffect({
    mipmapBlur: true, levels: POST.bloom.levels, radius: POST.bloom.radius,
    luminanceThreshold: POST.bloom.threshold, luminanceSmoothing: POST.bloom.smoothing,
  })
  const ao = new N8AOPostPass(scene, mainCamera, 1, 1)
  ao.setDepthTexture(depthTex)
  ao.autoDetectTransparency = false
  Object.assign(ao.configuration, {
    aoRadius: POST.ao.radius, distanceFalloff: POST.ao.falloff, halfRes: true, depthAwareUpsampling: true,
    gammaCorrection: false, screenSpaceRadius: false, colorMultiply: true, transparencyAware: false,
  })
  const aoTint = new THREE.Color()
  const seaShadow = new THREE.Color(PALETTE.rocheOmbre)
  const plum = new THREE.Color()
  const white = new THREE.Color(1, 1, 1)

  const grade = new GradeEffect(pub, int, { depth: depthTex, shafts: shaftTarget.texture, radial: radialTarget.texture })
  const gradePass = new EffectPass(mainCamera, grade)
  const smaaPass = new EffectPass(mainCamera, new SMAAEffect())
  for (const p of [gradePass, smaaPass]) p.fullscreenMaterial.dithering = true

  let settings = quality
  const applyQuality = (q: QualitySettings) => {
    settings = q
    grade.setFeatures(q)
    const lvl = POST.ao.levels[q.level]
    if (lvl.k > 0) ao.setQualityMode(lvl.mode)
    const samples = msaaSamples(q)
    if (sceneTarget.samples !== samples) {
      sceneTarget.samples = samples
      sceneTarget.dispose()
    }
  }
  applyQuality(quality)

  const size = new THREE.Vector2()
  const sunNdc = new THREE.Vector3()
  let initialized = false
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
      if (!initialized) {
        bloom.initialize(renderer, false, THREE.HalfFloatType)
        gradePass.initialize(renderer, false, THREE.HalfFloatType)
        smaaPass.initialize(renderer, false, THREE.HalfFloatType)
        initialized = true
      }
      renderer.getDrawingBufferSize(size)
      const w = Math.max(1, Math.floor(size.x))
      const h = Math.max(1, Math.floor(size.y))
      if (sceneTarget.width !== w || sceneTarget.height !== h) {
        sceneTarget.setSize(w, h)
        for (const t of targets) t.rt.setSize(Math.max(1, Math.floor(w / t.div)), Math.max(1, Math.floor(h / t.div)))
        bloom.setSize(w, h)
        ao.setSize(w, h)
        gradePass.setSize(w, h)
        smaaPass.setSize(w, h)
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
      const indoor = pub.uIndoor.value
      expMat.uniforms.uNight!.value = f.mood.night
      radialMat.uniforms.tScene!.value = f.color.texture

      if (!softFresh) soft(renderer, f.color.texture)
      const prev = exposure[expIdx]!
      expIdx = 1 - expIdx
      expMat.uniforms.tPrev!.value = f.snap ? null : prev.texture
      expMat.uniforms.uK!.value = f.snap ? 1 : 1 - Math.exp(-f.dt * POST.exposure.rate)
      pass(renderer, expMat, exposure[expIdx]!, false)

      if (settings.godRayPass) {
        sunNdc.copy(cam.position).addScaledVector(f.sunDir, 1000).project(cam)
        const facing = sunNdc.z < 1 ? 1 : 0
        const r = radialMat.uniforms
        r.uSun!.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5)
        const off = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y))
        r.uSunVis!.value = facing * (1 - THREE.MathUtils.smoothstep(off, 1.2, 2.6)) * (1 - indoor) * int.rdDay.value
        r.uNear!.value = cam.near
        r.uFar!.value = cam.far
        pass(renderer, radialMat, radialTarget, true)
      }

      let color = f.color
      const aoK = POST.ao.levels[settings.level].k
      if (aoK > 0) {
        plum.copy(int.rdInterieur.value).multiplyScalar(1 / Math.max(int.rdInterieur.value.r, int.rdInterieur.value.g, int.rdInterieur.value.b))
        aoTint.copy(seaShadow).multiplyScalar(1 / Math.max(seaShadow.r, seaShadow.g, seaShadow.b))
        aoTint.lerp(plum, indoor).lerp(white, 1 - POST.ao.tintMix).multiplyScalar(POST.ao.floor)
        ao.configuration.color.copy(aoTint).convertLinearToSRGB()
        ao.configuration.intensity = POST.ao.intensity * aoK * THREE.MathUtils.lerp(POST.ao.indoorScale, 1, indoor)
        ao.camera = cam
        ao.render(renderer, color, aoColorTarget)
        color = aoColorTarget
      }

      bloom.luminanceMaterial.threshold = POST.bloom.threshold + indoor * POST.bloom.indoorThreshold
      bloom.update(renderer, f.color, f.dt)
      grade.setFrame(cam, bloom.texture, exposure[expIdx]!.texture, f.mood, f.dt, f.snap)
      const smaa = sceneTarget.samples === 0
      gradePass.renderToScreen = !smaa
      gradePass.render(renderer, color, smaa ? gradedTarget : null)
      if (smaa) {
        smaaPass.renderToScreen = true
        smaaPass.render(renderer, gradedTarget, null)
      }
      renderer.autoClear = autoClear
    },
    setQuality: applyQuality,
    dispose() {
      sceneTarget.dispose()
      for (const t of targets) t.rt.dispose()
      for (const t of exposure) t.dispose()
      depthTex.dispose()
      for (const m of [copyMat, softMat, expMat, radialMat]) m.dispose()
      bloom.dispose()
      ao.dispose()
      gradePass.dispose()
      smaaPass.dispose()
      geo.dispose()
    },
  }
}
