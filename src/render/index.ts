import * as THREE from 'three'
import { BLOOM_HAZE_MUL, HAZE_BY_VISIBILITY } from '../core/tuning'
import type { DayPhase, GameContext, RenderService, System, Vec3 } from '../core/types'
import { createCelFactory, createPatchWater, type CelParams } from './cel'
import { createEnvironment, FX_LAYER, type Environment } from './environment'
import { createGlassFactory, createGlassPassUniforms, GLASS_LAYER, type GlassParams } from './glass'
import { GlassLights, type GlassLight } from './glasslights'
import { PALETTE } from './palette'
import { createPost, type Post } from './post'
import { createShadowPass, type ShadowPass } from './shadow'
import { createShafts, type Shafts } from './shafts'
import { computeSun, createSunState, phaseAt } from './sun'
import { createInternalUniforms, createPublicUniforms, MAX_RIPPLES, MAX_WIPES, shaderUniforms, type PublicUniforms } from './uniforms'

export type { GlassLight, GlassParams }
export type { CelParams } from './cel'
export { GLASS_LAYER }

export interface RenderServiceV2 extends RenderService {
  cel(params: CelParams): THREE.Material
  readonly uniforms: PublicUniforms
  glass(params?: GlassParams): THREE.Material
  setGlassLights(lights: GlassLight[] | null): void
  wipeGlass(p: Vec3): void
  seaVisible(): boolean
}

function hazeForVisibility(v: number): number {
  const keys = Object.keys(HAZE_BY_VISIBILITY).map(Number).sort((a, b) => a - b)
  if (v <= keys[0]!) return HAZE_BY_VISIBILITY[keys[0]!]!
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!
    const b = keys[i]!
    if (v <= b) return THREE.MathUtils.lerp(HAZE_BY_VISIBILITY[a]!, HAZE_BY_VISIBILITY[b]!, (v - a) / (b - a))
  }
  return HAZE_BY_VISIBILITY[keys[keys.length - 1]!]!
}

const C = (hex: number) => new THREE.Color(hex)
const BASE = {
  abysse: C(PALETTE.abysse), profond: C(PALETTE.profond), milieu: C(PALETTE.milieu),
  clair: C(PALETTE.clair), plafond: C(PALETTE.plafond), nuit: C(PALETTE.nuit), plancton: C(PALETTE.plancton),
  aube: C(PALETTE.soleilAube), airBrume: C(PALETTE.airBrume),
}
const AIR_TINT: Record<string, { color: THREE.Color; k: number }> = {
  serres: { color: C(0xb9d98a), k: 0.3 },
  machines: { color: C(0xc98e5e), k: 0.22 },
  scellees: { color: C(0x8fb8b0), k: 0.2 },
}

export function createRenderSystem(): System {
  const pub = createPublicUniforms()
  const int = createInternalUniforms()
  const shared = shaderUniforms(pub, int)
  const sun = createSunState()
  let env: Environment | null = null
  let shafts: Shafts | null = null
  let shadow: ShadowPass | null = null
  let post: Post | null = null
  let hemi: THREE.HemisphereLight | null = null
  let dirLight: THREE.DirectionalLight | null = null
  let unsubs: (() => void)[] = []
  let rippleIdx = 0
  let hazeInit = false
  let lastMs = 0
  let phase: DayPhase = 'aube'
  let lastRenderer: THREE.WebGLRenderer | null = null
  let wasLocked = false
  let wipeIdx = 0
  let seaVis = true
  const glassPass = createGlassPassUniforms()
  let glassSeenFrame = -1000
  let frameNo = 0
  const glassFactory = createGlassFactory(shared, glassPass, () => {
    glassSeenFrame = frameNo
  })
  const glassLights = new GlassLights(int, glassFactory)
  let lastDt = 1 / 60
  let snapFrame = true

  const addRipple = (x: number, z: number, strength: number) => {
    const r = int.rdRipples.value[rippleIdx]!
    r.set(x, z, pub.uTime.value, Math.max(0, strength))
    rippleIdx = (rippleIdx + 1) % MAX_RIPPLES
  }

  const shadowCenter = new THREE.Vector3()

  const service: RenderServiceV2 = {
    cel: createCelFactory(shared),
    patchWater: createPatchWater(shared),
    glass: glassFactory,
    setGlassLights: (lights) => glassLights.set(lights),
    wipeGlass(p) {
      int.rdWipes.value[wipeIdx]!.set(p.x, p.y, p.z, int.rdHours.value)
      wipeIdx = (wipeIdx + 1) % MAX_WIPES
    },
    seaVisible: () => seaVis,
    uniforms: pub,
    addRipple,
    sunPhase: () => phase,
    stats: () => ({
      drawCalls: lastRenderer?.info.render.calls ?? 0,
      triangles: lastRenderer?.info.render.triangles ?? 0,
      ms: lastMs,
    }),
    draw(ctx: GameContext) {
      const t0 = performance.now()
      const { renderer, scene, camera } = ctx
      if (!post || !env || !shafts) {
        renderer.render(scene, camera)
        return
      }
      camera.layers.enable(FX_LAYER)
      env.follow(camera)
      env.backdrop.visible = seaVis
      env.ceiling.visible = seaVis
      post.begin(renderer)

      const indoor = pub.uIndoor.value
      if (shadow && ctx.quality.shadows && indoor < 0.5) {
        const hp = pub.uHeroPos.value
        shadowCenter.copy(hp.lengthSq() > 0 ? hp : camera.position)
        shadow.render(renderer, scene, shadowCenter, pub.uSunDir.value)
      } else {
        int.rdShadowOn.value = 0
      }

      const layerMask = camera.layers.mask
      camera.layers.disable(GLASS_LAYER)
      renderer.setRenderTarget(post.sceneTarget)
      renderer.clear(true, true, true)
      renderer.render(scene, camera)

      let color: THREE.Texture = post.sceneTarget.texture
      if (frameNo - glassSeenFrame < 30 || glassLights.liveGlass > 0) {
        const merged = post.prepareGlass(renderer, glassPass)
        glassPass.rgLive.value = 1
        camera.layers.set(GLASS_LAYER)
        const autoClearG = renderer.autoClear
        renderer.autoClear = false
        renderer.setRenderTarget(merged)
        renderer.render(scene, camera)
        renderer.autoClear = autoClearG
        glassPass.rgLive.value = 0
        color = merged.texture
      }
      camera.layers.mask = layerMask
      frameNo++

      const st = post.shaftTarget
      const inside = pub.uIndoor.value > 0.01
      shafts.setCamera(camera, inside && glassLights.active > 0, inside)
      shafts.bindDepth(post.sceneTarget.depthTexture!, st.width, st.height, camera.near, camera.far)
      renderer.setRenderTarget(st)
      renderer.setClearColor(0x000000, 1)
      renderer.clear(true, false, false)
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      renderer.render(shafts.scene, camera)
      renderer.autoClear = autoClear
      renderer.setClearColor(int.rdAbysse.value, 1)

      post.finish(renderer, camera, { sunDir: pub.uSunDir.value, warm: sun.warm, night: sun.night, dt: lastDt, snap: snapFrame, color })
      snapFrame = false
      renderer.setRenderTarget(null)
      lastMs = performance.now() - t0
    },
  }


  const tmpColor = new THREE.Color()

  const updateEnvironment = (dt: number, ctx: GameContext) => {
    const s = ctx.state
    lastDt = dt
    pub.uTime.value = ctx.clock.elapsed
    const c = s.env.current
    pub.uCurrent.value.set(c.x, c.y, c.z)
    const hp = s.hero.position
    pub.uHeroPos.value.set(hp.x, hp.y, hp.z)

    computeSun(s.time.hours, sun)
    phase = phaseAt(s.time.hours)
    pub.uSunDir.value.copy(sun.waterDir)
    int.rdSunAir.value.copy(sun.airDir)
    pub.uSunColor.value.copy(sun.color)
    int.rdSunI.value = sun.intensity
    int.rdDay.value = sun.day
    int.rdPlankton.value = s.env.bloom
    int.rdRain.value = s.env.rain

    const night = sun.night
    const plank = s.env.bloom
    int.rdAbysse.value.copy(BASE.abysse).lerp(BASE.nuit, night * 0.6).multiplyScalar(1 - night * 0.45)
    int.rdProfond.value.copy(BASE.profond).lerp(BASE.nuit, night * 0.7).multiplyScalar(1 - night * 0.4)
    int.rdMilieu.value.copy(BASE.milieu).lerp(BASE.nuit, night * 0.75).lerp(BASE.plancton, plank * 0.3)
    int.rdMilieu.value.multiplyScalar(1 - night * 0.35)
    tmpColor.copy(BASE.clair).lerp(BASE.aube, sun.warm * 0.14)
    int.rdClair.value.copy(tmpColor).lerp(BASE.nuit, night * 0.8).lerp(BASE.plancton, plank * 0.25)
    int.rdClair.value.multiplyScalar(1 - night * 0.3)
    int.rdPlafond.value.copy(BASE.plafond).lerp(BASE.aube, sun.warm * 0.12).lerp(BASE.nuit, night * 0.75)
    int.rdPlafond.value.multiplyScalar(1 - night * 0.45)

    const locked = s.debug.cameraLocked
    const snap = locked !== wasLocked
    wasLocked = locked
    if (snap || locked) snapFrame = true
    const target = hazeForVisibility(s.env.visibility) * (1 - (1 - BLOOM_HAZE_MUL) * plank)
    if (!hazeInit || snap) {
      pub.uHazeDist.value = target
      hazeInit = true
    } else {
      pub.uHazeDist.value += (target - pub.uHazeDist.value) * (1 - Math.exp(-dt * 0.5))
    }

    const camEnv = ctx.services.drift?.cameraEnv()
    const inside = camEnv ? camEnv.indoor : s.mode === 'inside' && s.hero.medium === 'air' ? 1 : 0
    const k = locked || snap ? 1 : 1 - Math.exp(-dt * 4)
    pub.uIndoor.value += (inside - pub.uIndoor.value) * k
    if (Math.abs(inside - pub.uIndoor.value) < 1e-3) pub.uIndoor.value = inside
    const airHaze = camEnv?.airHaze ?? 0
    pub.uAirHaze.value += (airHaze - pub.uAirHaze.value) * k
    pub.uGlassDist.value = camEnv?.glassDist ?? 4
    const tint = AIR_TINT[camEnv?.district ?? ''] ?? null
    int.rdAirBrume.value.lerp(BASE.airBrume, k)
    const at = int.rdAirTint.value
    if (tint) at.set(at.x + (tint.color.r - at.x) * k, at.y + (tint.color.g - at.y) * k, at.z + (tint.color.b - at.z) * k, at.w + (tint.k - at.w) * k)
    else at.w += (0 - at.w) * k

    int.rdHours.value = (s.time.day - 1) * 24 + s.time.hours
    const cond = (s.env as { condensation?: number }).condensation
    int.rdCondensation.value = THREE.MathUtils.clamp(cond ?? 0, 0, 1)

    const fill = int.rdLampFill.value.setRGB(0, 0, 0)
    const lamps = pub.uLamps.value
    let wsum = 0
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i]!
      if (l.w <= 0) continue
      const d = Math.hypot(l.x - ctx.camera.position.x, l.y - ctx.camera.position.y, l.z - ctx.camera.position.z)
      const w = Math.max(0, 1 - d / (l.w * 1.6))
      fill.r += pub.uLampColors.value[i]!.r * w
      fill.g += pub.uLampColors.value[i]!.g * w
      fill.b += pub.uLampColors.value[i]!.b * w
      wsum += w
    }
    if (wsum > 0) fill.multiplyScalar(Math.min(1, wsum * 0.6) / wsum)

    glassLights.update(dt, ctx.scene, ctx.camera, pub.uIndoor.value)
    const drift = ctx.services.drift as { glassPortalsVisible?: () => number } | undefined
    const portals = typeof drift?.glassPortalsVisible === 'function' ? drift.glassPortalsVisible() : -1
    seaVis = portals < 0 || pub.uIndoor.value < 0.99 || portals > 0

    if (hemi && dirLight) {
      hemi.color.copy(int.rdPlafond.value)
      hemi.groundColor.copy(int.rdProfond.value)
      dirLight.color.copy(sun.color)
      dirLight.intensity = 1.6 * sun.intensity
      dirLight.position.copy(sun.waterDir).multiplyScalar(100)
    }
    shafts?.setStrength(0.38 * (1 - pub.uIndoor.value * 0.6))
  }

  return {
    id: 'render',
    init(ctx) {
      const { renderer, scene, camera } = ctx
      lastRenderer = renderer
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.NoToneMapping
      renderer.setClearColor(int.rdAbysse.value, 1)
      if (camera.far < 3000) {
        camera.far = 4000
        camera.updateProjectionMatrix()
      }
      camera.layers.enable(FX_LAYER)

      hemi = new THREE.HemisphereLight(PALETTE.plafond, PALETTE.profond, 1.1)
      dirLight = new THREE.DirectionalLight(PALETTE.soleilJour, 1.6)
      hemi.name = 'render-hemi'
      dirLight.name = 'render-sun'
      scene.add(hemi, dirLight)

      env = createEnvironment(scene, shared)
      shafts = createShafts(shared, ctx.rng('render:shafts'), ctx.quality.level)
      shadow = createShadowPass(int, ctx.quality.shadows ? ctx.quality.shadowMapSize : 0)
      post = createPost(pub, int, ctx.quality)

      unsubs.push(ctx.quality.onChange((q) => {
        shadow?.setSize(q.shadows ? q.shadowMapSize : 0)
        shafts?.setQuality(q.level)
        post?.setQuality(q)
      }))
      unsubs.push(ctx.bus.on('ceiling:ripple', ({ x, z, strength }) => addRipple(x, z, strength)))

      ctx.services.render = service
      updateEnvironment(0, ctx)
    },
    update(dt, ctx) {
      updateEnvironment(dt, ctx)
    },
    dispose() {
      for (const u of unsubs) u()
      unsubs = []
      env?.dispose()
      shafts?.dispose()
      shadow?.dispose()
      post?.dispose()
      hemi?.removeFromParent()
      dirLight?.removeFromParent()
      env = null
      shafts = null
      shadow = null
      post = null
    },
  }
}
