import * as THREE from 'three'
import { TIME } from '../core/tuning'
import type { CellId, DistrictId, FloraService, GameContext, QualityLevel, QualitySettings, System, Vec3 } from '../core/types'
import { HullCoat } from './coat'
import { CoralField } from './coral'
import { Drifters } from './drifters'
import { bubbleMaterial, createFxUniforms, tankMaterial, type FxUniforms } from './fx'
import { CORAL_TYPES, grassBladeGeometry, grassTuftGeometry, type CoralType } from './geometry'
import { createGround, type Ground } from './ground'
import { GrassLayer, grassSlotsFor, radiusForSlots } from './grass'
import { buildInteriors } from './interiors'
import { KELP_LOD, KelpField } from './kelp'
import { BENDER_COUNT, createFloraMaterial, createFloraUniforms, type FloraMaterial, type FloraUniforms } from './material'
import { smoothstep } from './noise'
import { FLORA_COLORS, PLANT_COLORS } from './palette'
import { createPlantMaterial, createPlantUniforms, setPlantEmissive, type PlantUniforms } from './plantmat'
import { buildSerres } from './serres'
import { ShipFrame } from './ship'
import { quarterPoint } from '../core/layout'

export { SERRE_COLUMNS, SERRE_HALL, SERRE_TRELLIS } from './serres'

export const FLORA_FLAGS = { lumiere: 'serres-lumiere', eau: 'serres-eau' } as const

const BLADE_CELL = 8
const BLADE_SUB = 4
const BLADE_PER_SUB = 32
const TUFT_CELL = 32
const TUFT_SUB = 8
const TUFT_PER_SUB = 1

const TUFT_RADIUS: Record<QualityLevel, number> = { high: 170, medium: 130, low: 95 }
const CORAL: Record<QualityLevel, { radius: number; perCell: number }> = {
  high: { radius: 220, perCell: 50 },
  medium: { radius: 170, perCell: 38 },
  low: { radius: 120, perCell: 26 },
}
const COAT_BY_ACT = [0.85, 0.85, 1.05, 1.35] as const

export interface FloraExtras {
  greenhouseGrowth(cell: CellId): number
  seaVisible(): boolean
}

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
  let ship: ShipFrame | null = null
  let drifters: Drifters | null = null
  let coat: HullCoat | null = null
  let fx: FxUniforms | null = null
  let bubbleMat: THREE.ShaderMaterial | null = null
  let glowMat: THREE.Material | null = null
  const uIn: PlantUniforms = createPlantUniforms()
  const uHull: PlantUniforms = createPlantUniforms()
  const uWorld: PlantUniforms = createPlantUniforms()
  const materials: THREE.Material[] = []
  const geometries: THREE.BufferGeometry[] = []
  const unsubs: (() => void)[] = []
  const benders: { x: number; y: number; z: number; r: number; life: number }[] = []
  const serreMeshes: THREE.Object3D[] = []
  let nefMesh: THREE.Mesh | null = null
  let stalks: { base: Vec3; height: number }[] = []
  const growth = [0.6, 0.6, 0.7, 1]
  const scanQueue: { id: DistrictId; wait: number }[] = []
  let benderCursor = 0
  let level: QualityLevel = 'high'
  let built = false
  let seaOn = true
  let frame = 0
  let stripsHidden = false
  let ctxRef: GameContext | null = null
  const current = new THREE.Vector3(0, 0, -0.4)
  const heroLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  let rngDrift: () => number = Math.random

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
  }

  const applyQuality = (q: QualitySettings) => {
    if (q.level === level && blades) return
    level = q.level
    buildGrass(q)
    kelp?.setSpec(KELP_LOD[level])
    coral?.configure(CORAL[level].radius, CORAL[level].perCell)
    drifters?.setQuality(level)
  }

  const flatten = (p: Vec3, r: number) => {
    const slot = 1 + (benderCursor++ % (BENDER_COUNT - 1))
    const b = benders[slot]
    if (!b) return
    b.x = p.x
    b.y = p.y
    b.z = p.z
    b.r = r
    b.life = 1
  }

  const seaVisible = (): boolean => {
    const ctx = ctxRef
    if (!ctx) return true
    const fromRender = (ctx.services.render as { seaVisible?: () => boolean } | undefined)?.seaVisible
    if (fromRender) return fromRender()
    const env = ctx.services.drift?.cameraEnv()
    if (!env || ctx.state.mode === 'sortie' || env.indoor < 0.5) return true
    if (env.glassDist < 18) return true
    if (typeof env.cell === 'string' && env.cell.startsWith('nef')) return true
    return env.district === 'hauts' || env.district === 'serres' || env.district === 'proue'
  }

  const greenhouseGrowth = (cell: CellId): number => {
    if (cell === 'serre-cathedrale' || cell === 'serres' || cell === 'quai-serres') return (growth[0]! + growth[1]! + growth[2]!) / 3
    if (cell === 'dome-serres' || cell === 'serre-tour') return growth[2]!
    return 0
  }

  const service: FloraService & FloraExtras = {
    climbableKelpNear(p, r) {
      if (!ship) return []
      const out: { base: Vec3; height: number }[] = []
      for (const s of stalks) {
        const w = ship.toWorld(s.base)
        if (Math.hypot(w.x - p.x, w.z - p.z) <= r) out.push({ base: w, height: s.height })
      }
      return out
    },
    flatten,
    greenhouseGrowth,
    seaVisible,
  }

  const buildShip = (ctx: GameContext) => {
    if (built || !ctx.services.drift || !ship) return
    built = true
    ship.sync()
    const rng = ctx.rng('flora:bord')
    const inMat = createPlantMaterial(ctx, uIn, { indoor: true, shadow: 0x5e4a5c })
    glowMat = createPlantMaterial(ctx, uIn, { indoor: true, emissive: PLANT_COLORS.bio1 })
    const hullMat = createPlantMaterial(ctx, uHull, { indoor: false, rim: 0.7 })
    const serreMat = createPlantMaterial(ctx, uIn, { indoor: true, shadow: 0x4a3a4e, translucent: 0.9 })
    materials.push(inMat, glowMat, hullMat, serreMat)
    fx = createFxUniforms()
    const tank = tankMaterial(fx)
    bubbleMat = bubbleMaterial(fx)
    materials.push(tank, bubbleMat)

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, order = 0): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat)
      m.name = name
      m.matrixAutoUpdate = false
      m.renderOrder = order
      m.userData.noShadow = true
      geometries.push(geo)
      ship!.group.add(m)
      return m
    }

    const interiors = buildInteriors(ctx, rng, level)
    add(interiors.quarter, inMat, 'flora-quartier')
    nefMesh = add(interiors.nef, inMat, 'flora-nef')
    for (const c of interiors.colliders) ship.addCollider(c, { kind: 'prop', climbable: false, ownerId: 'pot-de-fleurs' })

    const serre = buildSerres(rng, level)
    serreMeshes.push(
      add(serre.plants, serreMat, 'flora-serres'),
      add(serre.glow, glowMat, 'flora-serres-lueurs'),
      add(serre.tanks, tank, 'flora-serres-cuves', 3),
    )
    const pts = new THREE.Points(serre.bubbles, bubbleMat)
    pts.name = 'flora-serres-bulles'
    pts.matrixAutoUpdate = false
    pts.renderOrder = 4
    geometries.push(serre.bubbles)
    ship.group.add(pts)
    serreMeshes.push(pts)
    for (const c of serre.colliders) ship.addCollider(c.spec, c.tag)
    stalks = serre.stalks

    coat = new HullCoat(hullMat)
    ship.group.add(coat.mesh)
    for (const d of ctx.services.drift.loadedDistricts()) scanQueue.push({ id: d, wait: 3 })
  }

  const scanStep = (ctx: GameContext) => {
    if (!coat || !ship || scanQueue.length === 0) return
    const job = scanQueue[0]!
    if (job.wait-- > 0) return
    scanQueue.shift()
    if (coat.has(job.id)) return
    const rng = ctx.rng(`flora:manteau:${job.id}`)
    coat.scan(job.id, ship, (o, d, max) => {
      const h = ctx.physics.raycast(o, d, max, { excludeKinds: ['kelp', 'prop', 'trigger', 'fauna', 'seat', 'door'] })
      return h ? { point: h.point, normal: h.normal, kind: h.tag?.kind } : null
    }, rng, level)
    if (scanQueue.length === 0) coat.flush()
  }

  const updateGrowth = (ctx: GameContext, dt: number) => {
    const f = ctx.state.flags
    const base = 0.6 + 0.05 * Math.min(ctx.state.time.day - 1, 4)
    const light = f[FLORA_FLAGS.lumiere] ? 0.3 : 0
    const eau = f[FLORA_FLAGS.eau] ? 0.3 : 0
    const targets = [base + light, base + eau, base + 0.12 + (light + eau) * 0.5, COAT_BY_ACT[ctx.state.act] ?? 1]
    const k = 1 - Math.exp(-dt * 0.35)
    for (let i = 0; i < 4; i++) growth[i]! += (Math.min(1, targets[i]!) - growth[i]!) * k
    uIn.uPlGrow.value.set(growth[0]!, growth[1]!, growth[2]!, 1)
    uHull.uPlGrow.value.set(1, 1, 1, growth[3]!)
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

      const worldMat = createPlantMaterial(ctx, uWorld, { indoor: false, rim: 0.8 })
      materials.push(worldMat)
      rngDrift = ctx.rng('flora:derive-flux')
      drifters = new Drifters(ctx, worldMat, ctx.rng('flora:derive'), level)
      ctx.scene.add(drifters.group)
      ship = new ShipFrame(ctx)

      ctx.services.flora = service
      unsubs.push(ctx.quality.onChange(applyQuality))
      unsubs.push(ctx.bus.on('hero:landed', ({ speed }) => {
        if (speed > 1.5) flatten(ctx.state.hero.position, Math.min(3.5, 1.2 + speed * 0.4))
      }))
      unsubs.push(ctx.bus.on('hero:kick', () => flatten(ctx.state.hero.position, 1.8)))
      unsubs.push(ctx.bus.on('district:streamed', ({ loaded }) => {
        for (const d of loaded) if (coat && !coat.has(d) && !scanQueue.some((j) => j.id === d)) scanQueue.push({ id: d, wait: 3 })
      }))
      registerPoses(ctx)
      ctx.camera.updateMatrixWorld()
      kelp.updateLod(ctx.camera)
    },

    update(dt: number, ctx: GameContext) {
      if (!uniforms || !root) return
      frame++
      if (!built) buildShip(ctx)
      const st = ctx.state
      const u = uniforms
      const t = ctx.clock.elapsed
      u.uFlTime.value = t
      const env = st.env.current
      const k = Math.min(1, dt * 0.5)
      current.x += (env.x - current.x) * k
      current.y += (env.y - current.y) * k
      current.z += (env.z - current.z) * k
      u.uFlCurrent.value.copy(current)
      const cl = Math.hypot(current.x, current.z)
      const base = cl > 0.01 ? Math.atan2(current.z, current.x) : -Math.PI / 2
      const ang = base + 0.35 * Math.sin(t * 0.031)
      u.uFlGust.value.set(Math.cos(ang), Math.sin(ang), 0.55 + 0.35 * Math.min(cl, 1) + 0.15 * Math.sin(t * 0.07), 0.7)
      const h = st.time.hours
      const night = Math.max(
        smoothstep(TIME.phases.nuit, TIME.phases.nuit + 1, h),
        1 - smoothstep(TIME.phases.aube - 0.5, TIME.phases.aube + 0.5, h),
      )
      u.uFlNight.value = night
      const cam = ctx.camera.position
      u.uFlCam.value.copy(cam)
      const hp = st.hero.position
      u.uFlHero.value.set(hp.x, hp.y, hp.z)

      benders[0]!.x = hp.x
      benders[0]!.y = hp.y
      benders[0]!.z = hp.z
      benders[0]!.r = st.mode === 'sortie' ? 1.3 : 0
      benders[0]!.life = 1
      for (let i = 0; i < BENDER_COUNT; i++) {
        const b = benders[i]!
        if (i > 0 && b.life > 0) b.life = Math.max(0, b.life - dt / 1.4)
        u.uFlBenders.value[i]!.set(b.x, b.y, b.z, b.life > 0 ? b.r * (0.5 + 0.5 * b.life) : 0)
      }

      const vis = seaVisible()
      if (vis !== seaOn) {
        seaOn = vis
        root.visible = vis
        if (drifters) drifters.group.visible = vis
        if (coat) coat.mesh.visible = vis
      }
      const sortie = st.mode === 'sortie'
      if (blades) blades.mesh.visible = vis && sortie
      if (vis) {
        if (sortie) blades?.update(cam.x, cam.z, 3)
        tufts?.update(cam.x, cam.z, 2)
        coral?.update(cam.x, cam.z)
        if (kelp && frame % 4 === 0) kelp.updateLod(ctx.camera)
        drifters?.update(dt, cam, rngDrift, current)
      }

      uWorld.uPlTime.value = t
      uWorld.uPlFlow.value.set(current.x * 0.3, 0, current.z * 0.3)
      uWorld.uPlHero.value.w = 0

      const drift = ctx.services.drift
      uIn.uPlTime.value = t
      uHull.uPlTime.value = t
      const local = st.hero.localPosition ?? (drift ? drift.toLocal(hp) : null)
      if (local) {
        heroLocal.x = local.x
        heroLocal.y = local.y
        heroLocal.z = local.z
      }
      uIn.uPlHero.value.set(heroLocal.x, heroLocal.y, heroLocal.z, sortie ? 0 : 1.1)
      uHull.uPlHero.value.set(heroLocal.x, heroLocal.y, heroLocal.z, sortie ? 1.8 : 0)
      uIn.uPlFlow.value.set(0.05 * Math.sin(t * 0.05), 0, 0.06)
      uIn.uPlLean.value.set(0, st.act >= 2 ? -0.35 : -0.08)
      if (drift) {
        const pose = drift.pose()
        const c = Math.cos(pose.heading)
        const s = Math.sin(pose.heading)
        const rx = current.x - pose.velocity.x
        const rz = current.z - pose.velocity.z
        uHull.uPlFlow.value.set(rx * c + rz * s, 0, -rx * s + rz * c)
      }
      updateGrowth(ctx, dt)
      if (glowMat) setPlantEmissive(glowMat, PLANT_COLORS.bio1, 0.35 + 0.9 * night)
      if (fx) {
        fx.uTime.value = t
        fx.uGlow.value = night
      }
      if (bubbleMat) bubbleMat.uniforms.uPx!.value = ctx.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov) / 2))

      if (drift && frame % 20 === 0) {
        const loaded = drift.loadedDistricts()
        const camDistrict = drift.cameraEnv().district
        const serresOn = loaded.includes('serres') || camDistrict === 'serres'
        for (const m of serreMeshes) m.visible = serresOn
        if (serresOn && (!stripsHidden || frame % 120 === 0)) ctx.scene.traverse(hideDriftStrips)
        stripsHidden = serresOn
        if (nefMesh) nefMesh.visible = loaded.includes('nef') || camDistrict === 'nef'
      }
      scanStep(ctx)
    },

    lateUpdate() {
      ship?.sync()
    },

    dispose() {
      for (const un of unsubs.splice(0)) un()
      blades?.dispose()
      tufts?.dispose()
      coral?.dispose()
      if (ctxRef) kelp?.dispose(ctxRef)
      drifters?.dispose()
      coat?.dispose()
      ship?.dispose()
      for (const g of geometries.splice(0)) g.dispose()
      for (const m of materials.splice(0)) m.dispose()
      root?.removeFromParent()
      root = null
    },
  }
}

interface LocalPose { from: Vec3; to: Vec3; hour: number; fov?: number }

const LOCAL_POSES: Record<string, LocalPose> = {
  'serre-colonnes': { from: { x: 86, y: 1.7, z: 9 }, to: { x: 90, y: 7, z: 22 }, hour: 10, fov: 66 },
  'serre-galerie': { from: { x: 77.5, y: 8.7, z: 2 }, to: { x: 92, y: 2.5, z: 34 }, hour: 11, fov: 64 },
  'serre-bacs': { from: { x: 94, y: 2.2, z: 50 }, to: { x: 90, y: 1.2, z: 62 }, hour: 9, fov: 62 },
  'nef-jardins': { from: { x: -31, y: 17.7, z: 22 }, to: { x: 20, y: 6, z: -10 }, hour: 12, fov: 64 },
  'refectoire-plantes': { from: quarterPoint({ x: 24.8, y: 2.0, z: 57.0 }), to: quarterPoint({ x: 17, y: 4.2, z: 66 }), hour: 7.8, fov: 64 },
  'barbe-coque': { from: { x: 12, y: -38, z: 78 }, to: { x: 4, y: -26, z: 50 }, hour: 12, fov: 60 },
}

type Factory = (ctx: GameContext) => { camera: { position: Vec3; target: Vec3; fov?: number }; hour?: number }

function registerPoses(ctx: GameContext): void {
  const reg = ctx.services.debug as typeof ctx.services.debug & { registerFactory?: (name: string, f: Factory) => void }
  for (const [name, p] of Object.entries(LOCAL_POSES)) {
    const make: Factory = (c) => {
      const d = c.services.drift
      const w = (v: Vec3) => (d ? d.toWorld(v) : v)
      return { hour: p.hour, camera: { position: w(p.from), target: w(p.to), fov: p.fov ?? 60 } }
    }
    if (typeof reg.registerFactory === 'function') reg.registerFactory(name, make)
    else reg.registerPose(name, make(ctx))
  }
  reg.registerPose('sargasses', {
    camera: { position: { x: 80, y: 96, z: 520 }, target: { x: 60, y: 118, z: 470 }, fov: 62 },
    hour: 12,
  })
}

// The Serres' laminaria are flora's; drift's flat placeholder strips in the same beds stay hidden.
function hideDriftStrips(o: THREE.Object3D): void {
  if (o.name === 'laminaires-serre' && (o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).count = 0
}
