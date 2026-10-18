import * as THREE from 'three'
import { REGIONS, VISTA } from '../core/layout'
import { TIME } from '../core/tuning'
import type { FloraService, GameContext, QualityLevel, QualitySettings, System, Vec3 } from '../core/types'
import { CoralField } from './coral'
import { CORAL_TYPES, grassBladeGeometry, grassTuftGeometry, type CoralType } from './geometry'
import { createGround, type Ground } from './ground'
import { GrassLayer, grassSlotsFor, radiusForSlots } from './grass'
import { KELP_LOD, KelpField } from './kelp'
import { BENDER_COUNT, createFloraMaterial, createFloraUniforms, type FloraMaterial, type FloraUniforms } from './material'
import { smoothstep } from './noise'
import { FLORA_COLORS } from './palette'

const BLADE_CELL = 8
const BLADE_SUB = 4
const BLADE_PER_SUB = 32
const TUFT_CELL = 32
const TUFT_SUB = 8
const TUFT_PER_SUB = 1

const TUFT_RADIUS: Record<QualityLevel, number> = { high: 170, medium: 130, low: 95 }
const INDOOR_BLADES: Record<QualityLevel, number> = { high: 30_000, medium: 15_000, low: 6_000 }
const CORAL: Record<QualityLevel, { radius: number; perCell: number }> = {
  high: { radius: 220, perCell: 50 },
  medium: { radius: 170, perCell: 38 },
  low: { radius: 120, perCell: 26 },
}

interface Bender { x: number; y: number; z: number; r: number; life: number }

export function createFloraSystem(): System {
  let root: THREE.Group | null = null
  let uniforms: FloraUniforms | null = null
  let ground: Ground | null = null
  let blades: GrassLayer | null = null
  let tufts: GrassLayer | null = null
  let kelp: KelpField | null = null
  let coral: CoralField | null = null
  let bladeMat: FloraMaterial | null = null
  let tuftMat: FloraMaterial | null = null
  const materials: THREE.Material[] = []
  const unsubs: (() => void)[] = []
  const benders: Bender[] = []
  let benderCursor = 0
  let level: QualityLevel = 'high'
  let indoor = false
  let frame = 0
  let ctxRef: GameContext | null = null
  const current = new THREE.Vector3(0, 0, -0.4)

  const buildGrass = (q: QualitySettings) => {
    if (!root || !ground || !bladeMat || !tuftMat) return
    blades?.dispose()
    tufts?.dispose()
    const perCell = BLADE_SUB * BLADE_SUB * BLADE_PER_SUB
    const slots = grassSlotsFor(q.grassDensity, perCell)
    const bladeRadius = radiusForSlots(slots, BLADE_CELL)
    blades = new GrassLayer(
      { name: 'flora-grass', cellSize: BLADE_CELL, sub: BLADE_SUB, perSub: BLADE_PER_SUB, slots, radius: bladeRadius, innerRadius: 0, tuft: false },
      grassBladeGeometry(), bladeMat.material, ground, bladeMat.fade,
    )
    const tr = TUFT_RADIUS[q.level]
    const tuftSlots = Math.ceil((Math.PI * (tr + TUFT_CELL * Math.SQRT2) ** 2) / (TUFT_CELL * TUFT_CELL))
    tufts = new GrassLayer(
      { name: 'flora-grass-far', cellSize: TUFT_CELL, sub: TUFT_SUB, perSub: TUFT_PER_SUB, slots: tuftSlots, radius: tr, innerRadius: bladeRadius * 0.85, tuft: true },
      grassTuftGeometry(), tuftMat.material, ground, tuftMat.fade,
    )
    root.add(blades.mesh, tufts.mesh)
    applyIndoor()
  }

  const applyIndoor = () => {
    if (!blades || !tufts) return
    const perCell = blades.perCell
    blades.setBudget(indoor ? grassSlotsFor(INDOOR_BLADES[level], perCell) : blades.spec.slots)
    tufts.mesh.visible = !indoor
  }

  const applyQuality = (q: QualitySettings) => {
    if (q.level === level && blades) return
    level = q.level
    buildGrass(q)
    kelp?.setSpec(KELP_LOD[level])
    const c = CORAL[level]
    coral?.configure(indoor ? Math.min(70, c.radius) : c.radius, c.perCell)
  }

  const flatten = (p: Vec3, r: number) => {
    const slot = 1 + (benderCursor++ % (BENDER_COUNT - 1))
    const b = benders[slot]
    if (b) {
      b.x = p.x
      b.y = p.y
      b.z = p.z
      b.r = r
      b.life = 1
    }
  }

  const service: FloraService = {
    climbableKelpNear(p, r) {
      if (!kelp) return []
      return kelp.near(p, r).map(({ base, height }) => ({ base, height }))
    },
    flatten,
  }

  return {
    id: 'flora',
    init(ctx: GameContext) {
      ctxRef = ctx
      const render = ctx.services.render
      uniforms = createFloraUniforms(render)
      ground = createGround(ctx)
      root = new THREE.Group()
      root.name = 'flora'
      root.matrixAutoUpdate = false
      for (let i = 0; i < BENDER_COUNT; i++) benders.push({ x: 0, y: 0, z: 0, r: 0, life: 0 })

      const DS = THREE.DoubleSide
      bladeMat = createFloraMaterial(uniforms, { kind: 'grass', base: FLORA_COLORS.herbeOmbre, tip: FLORA_COLORS.herbePointe, side: DS }, render)
      tuftMat = createFloraMaterial(uniforms, { kind: 'tuft', base: FLORA_COLORS.herbeOmbre, tip: FLORA_COLORS.herbePointe, side: DS }, render)
      const kelpMats = [0, 1, 2].map(() =>
        createFloraMaterial(uniforms!, { kind: 'kelp', base: FLORA_COLORS.laminaire, tip: FLORA_COLORS.laminaireClair, shadow: FLORA_COLORS.laminaireOmbre, side: DS }, render))
      const coralMats = {} as Record<CoralType, FloraMaterial>
      for (const t of CORAL_TYPES) {
        coralMats[t] = createFloraMaterial(uniforms, {
          kind: t === 'anemone' ? 'anemone' : 'coral',
          base: FLORA_COLORS.corail1,
          tip: t === 'anemone' ? FLORA_COLORS.bio1 : t === 'tube' ? FLORA_COLORS.echarpe : FLORA_COLORS.blanc,
          side: t === 'eventail' ? DS : THREE.FrontSide,
        }, render)
      }
      materials.push(bladeMat.material, tuftMat.material, ...kelpMats.map((m) => m.material),
        ...CORAL_TYPES.map((t) => coralMats[t].material))

      level = ctx.quality.level
      kelp = new KelpField(ground, kelpMats.map((m) => m.material), KELP_LOD[level])
      coral = new CoralField(ground, coralMats, CORAL[level].radius, CORAL[level].perCell)
      root.add(kelp.group, coral.group)
      buildGrass(ctx.quality)
      ctx.scene.add(root)

      ctx.services.flora = service
      unsubs.push(ctx.quality.onChange(applyQuality))
      unsubs.push(ctx.bus.on('hero:landed', ({ speed }) => {
        if (speed > 1.5) flatten(ctx.state.hero.position, Math.min(3.5, 1.2 + speed * 0.4))
      }))
      unsubs.push(ctx.bus.on('hero:kick', () => flatten(ctx.state.hero.position, 1.8)))
      registerPoses(ctx, ground)
      ctx.camera.updateMatrixWorld()
      kelp.updateLod(ctx.camera)
    },

    update(dt: number, ctx: GameContext) {
      if (!uniforms || !root) return
      frame++
      const st = ctx.state
      const u = uniforms
      u.uFlTime.value = ctx.clock.elapsed
      const env = st.env.current
      const k = Math.min(1, dt * 0.5)
      current.x += (env.x - current.x) * k
      current.y += (env.y - current.y) * k
      current.z += (env.z - current.z) * k
      u.uFlCurrent.value.copy(current)
      const cl = Math.hypot(current.x, current.z)
      const base = cl > 0.01 ? Math.atan2(current.z, current.x) : -Math.PI / 2
      const ang = base + 0.35 * Math.sin(ctx.clock.elapsed * 0.031)
      u.uFlGust.value.set(Math.cos(ang), Math.sin(ang),
        0.55 + 0.35 * Math.min(cl, 1) + 0.15 * Math.sin(ctx.clock.elapsed * 0.07), 0.7)
      const h = st.time.hours
      u.uFlNight.value = Math.max(
        smoothstep(TIME.phases.nuit, TIME.phases.nuit + 1, h),
        1 - smoothstep(TIME.phases.aube - 0.5, TIME.phases.aube + 0.5, h),
      )
      const cam = ctx.camera.position
      u.uFlCam.value.copy(cam)
      const hp = st.hero.position
      u.uFlHero.value.set(hp.x, hp.y, hp.z)

      benders[0]!.x = hp.x
      benders[0]!.y = hp.y
      benders[0]!.z = hp.z
      benders[0]!.r = st.hero.medium === 'water' ? 1.3 : 0
      benders[0]!.life = 1
      for (let i = 0; i < BENDER_COUNT; i++) {
        const b = benders[i]!
        if (i > 0 && b.life > 0) b.life = Math.max(0, b.life - dt / 1.4)
        u.uFlBenders.value[i]!.set(b.x, b.y, b.z, b.life > 0 ? b.r * (0.5 + 0.5 * b.life) : 0)
      }

      const nowIndoor = st.hero.medium === 'air'
      if (nowIndoor !== indoor) {
        indoor = nowIndoor
        applyIndoor()
        const c = CORAL[level]
        coral?.configure(indoor ? Math.min(70, c.radius) : c.radius, c.perCell)
      }

      blades?.update(cam.x, cam.z, 3)
      if (!indoor) tufts?.update(cam.x, cam.z, 2)
      coral?.update(cam.x, cam.z)
      if (kelp && frame % 4 === 0) kelp.updateLod(ctx.camera)
      if (kelp && frame % 15 === 0) kelp.updateColliders(ctx.physics, hp, !indoor && st.hero.room === null)
    },

    dispose() {
      for (const un of unsubs.splice(0)) un()
      blades?.dispose()
      tufts?.dispose()
      coral?.dispose()
      if (ctxRef) kelp?.dispose(ctxRef)
      for (const m of materials.splice(0)) m.dispose()
      root?.removeFromParent()
      root = null
    },
  }
}

function registerPoses(ctx: GameContext, ground: Ground): void {
  const reg = ctx.services.debug
  const hx = -150
  const hz = 640
  const hy = ground.height(hx, hz)
  reg.registerPose('herbes', {
    camera: { position: { x: hx - 3, y: hy + 1.4, z: hz + 4 }, target: { x: hx + 18, y: hy + 0.5, z: hz - 20 }, fov: 55 },
    hero: { position: { x: hx, y: hy + 0.2, z: hz }, yaw: Math.PI / 4 },
    hour: 8,
  })
  const L = REGIONS.laminaires
  const ly = ground.height(L.x + 40, L.z + 30)
  reg.registerPose('canopee', {
    camera: { position: { x: L.x + 40, y: ly + 2, z: L.z + 30 }, target: { x: L.x + 30, y: ly + 50, z: L.z }, fov: 60 },
    hour: 12,
  })
  const vy = ground.height(VISTA.hero.x, VISTA.hero.z)
  reg.registerPose('herbes-vista', {
    camera: { position: { x: VISTA.hero.x - 2, y: vy + 1.2, z: VISTA.hero.z + 3 }, target: { x: VISTA.hero.x + 30, y: vy - 4, z: VISTA.hero.z - 30 }, fov: 55 },
    hour: 6.5,
  })
}
