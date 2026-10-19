import * as THREE from 'three'
import type { Vec3 } from '../core/types'
import type { DriftAnchor } from '../drift'
import type { DriftNavmesh, ProcgenCell, ProcgenHost, ProcgenWorld } from '../drift/procgen-hook'
import { buildContent, buildFarLandmarks, createDecouvertes, populate } from './content'
import { dress } from './dressing'
import { buildLayout, layout, massing } from './layout'
import { buildSilhouette } from './layout/silhouette'
import { STREAM } from './layout/tuning'
import { planShip } from './ship'
import type { BuiltLayout, BuiltPart, CellSpec, ContentSet, DistrictPlan, DistrictShell, Job } from './types'

interface Built {
  shell: DistrictShell
  content: ContentSet
  cells: CellSpec[]
  anchors: DriftAnchor[]
  layout: BuiltLayout
  parts: BuiltPart[]
  group: THREE.Group
  nav: Promise<DriftNavmesh | null> | null
  navReady: DriftNavmesh | null
}

interface Slot {
  index: number
  plan: DistrictPlan
  built: Built | null
  job: Job<Built> | null
}

const UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()

function boxDist(p: DistrictPlan, l: Vec3): number {
  const b = p.bounds
  const dx = Math.max(b.x0 - l.x, 0, l.x - b.x1)
  const dy = Math.max(b.y0 - l.y, 0, l.y - b.y1)
  const dz = Math.max(b.z0 - l.z, 0, l.z - b.z1)
  return Math.hypot(dx, dy, dz)
}

const inBox = (b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, l: Vec3, m = 0) =>
  l.x >= b.x0 - m && l.x <= b.x1 + m && l.y >= b.y0 - m && l.y <= b.y1 + m && l.z >= b.z0 - m && l.z <= b.z1 + m

const vol = (c: CellSpec) => c.boxes.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0), 0)

function anchorDist(a: DriftAnchor, l: Vec3): number {
  const p = 'at' in a ? a.at : 'bottom' in a ? a.bottom : 'from' in a ? a.from : a.path[0]!
  return Math.hypot(p.x - l.x, p.y - l.y, p.z - l.z)
}

// The streamer (docs/MONDE.md §4.3): plans everything at boot, builds districts near the hero in sliced jobs.
export function createProcgen(host: ProcgenHost): ProcgenWorld {
  const ship = planShip()
  const ctx = host.ctx
  const slots: Slot[] = ship.districts.map((plan, index) => ({ index, plan, built: null, job: null }))
  const root = new THREE.Group()
  root.name = 'procgen'
  host.root.add(root)
  const silhouette = buildSilhouette(ship.districts, (plan) => massing(plan).hulls, host.mats)
  root.add(silhouette.mesh)
  const far = buildFarLandmarks(ship.districts, host.mats)
  root.add(far.group)
  const decouvertes = createDecouvertes(host, ship.districts)
  const debug = new URLSearchParams(location.search).has('procgen')
  let camCell: CellSpec | null = null
  let clock = 0
  let hours = 0

  function* buildJob(slot: Slot): Job<Built> {
    const geoBefore = ctx.renderer.info.memory.geometries
    const t0 = performance.now()
    const raw = yield* layout(slot.plan)
    const content = populate(raw.plan, raw)
    const shell: DistrictShell = { ...raw, colliders: [...raw.colliders, ...content.colliders], anchors: [...raw.anchors, ...content.anchors] }
    yield
    const built = yield* buildLayout(shell, host)
    const parts: BuiltPart[] = []
    const dressed = yield* dress({ shell, keepOut: content.reserved }, host)
    parts.push(dressed)
    if (dressed.colliders?.length) {
      const R = ctx.physics.rapier
      for (const c of dressed.colliders) {
        const desc = R.ColliderDesc.cuboid(Math.max(0.02, c.hx), Math.max(0.02, c.hy), Math.max(0.02, c.hz)).setTranslation(c.x, c.y, c.z).setCollisionGroups(host.terrainGroups)
        if (c.q) desc.setRotation({ x: c.q[0], y: c.q[1], z: c.q[2], w: c.q[3] })
        ctx.physics.tag(ctx.physics.world.createCollider(desc, built.body), { kind: c.kind, climbable: c.climbable, ...(c.ownerId ? { ownerId: c.ownerId } : {}) })
      }
    }
    yield
    parts.push(yield* buildContent(content, shell, host))
    const group = new THREE.Group()
    group.name = `arrondissement:${shell.plan.id}`
    group.add(built.group, ...parts.map((p) => p.group))
    const cells = [...shell.cells].sort((a, b) => vol(a) - vol(b))
    if (debug) {
      const draws = built.stats.draws + parts.reduce((s, p) => s + p.stats.draws, 0)
      const tris = built.stats.triangles + parts.reduce((s, p) => s + p.stats.triangles, 0)
      console.info(`[procgen] ${shell.plan.id} built in ${(performance.now() - t0).toFixed(0)} ms (wall), ${draws} draws, ${(tris / 1000).toFixed(0)}k tris, ${shell.colliders.length} colliders, ${cells.length} cells, geometries +${ctx.renderer.info.memory.geometries - geoBefore}`)
    }
    return { shell, content, cells, anchors: [...shell.anchors], layout: built, parts, group, nav: null, navReady: null }
  }

  const attach = (slot: Slot, b: Built) => {
    slot.built = b
    root.add(b.group)
    silhouette.hide(slot.index, true)
    far.hide(slot.plan.id, true)
  }

  const release = (slot: Slot) => {
    const b = slot.built
    if (!b) return
    slot.built = null
    for (const p of b.parts) p.dispose()
    b.layout.dispose()
    b.group.removeFromParent()
    b.navReady?.dispose()
    silhouette.hide(slot.index, false)
    far.hide(slot.plan.id, false)
    if (debug) console.info(`[procgen] ${slot.plan.id} disposed, geometries ${ctx.renderer.info.memory.geometries}`)
  }

  const finish = (slot: Slot) => {
    slot.job ??= buildJob(slot)
    for (;;) {
      const r = slot.job.next()
      if (r.done) {
        slot.job = null
        attach(slot, r.value)
        return
      }
    }
  }

  const step = (budgetMs: number) => {
    const t0 = performance.now()
    for (const slot of slots) {
      if (!slot.job) continue
      while (performance.now() - t0 < budgetMs) {
        const r = slot.job.next()
        if (r.done) {
          slot.job = null
          attach(slot, r.value)
          break
        }
      }
      return
    }
  }

  const schedule = (hero: Vec3) => {
    const q = ctx.quality.level
    const max = STREAM.maxBuilt[q]
    const ranked = slots.map((s) => ({ s, d: boxDist(s.plan, hero) })).sort((a, b) => a.d - b.d)
    ranked.forEach(({ s, d }, rank) => {
      const wanted = d < STREAM.buildDist && rank < max
      if (wanted && !s.built && !s.job) s.job = buildJob(s)
      if (s.built && (d > STREAM.disposeDist || rank >= max + 1)) release(s)
    })
  }

  const builtAt = (l: Vec3, margin = 0): Slot | null => {
    for (const s of slots) if (s.built && inBox(s.plan.bounds, l, margin)) return s
    return null
  }

  const cellOf = (l: Vec3, margin = 0): CellSpec | null => {
    const s = builtAt(l, margin)
    if (!s?.built) return null
    for (const c of s.built.cells) if (c.boxes.some((b) => inBox(b, l, margin))) return c
    return null
  }

  const toCell = (c: CellSpec): ProcgenCell => ({ id: c.id, district: c.district, quartier: c.quartier, deck: c.deck, roof: c.roof, air: c.air, glass: c.glass })

  const arr = new URLSearchParams(location.search).get('arr')
  let pendingArr = arr && slots.some((s) => s.plan.id === arr) ? arr : null

  console.info(`[procgen] ${ship.districts.length} arrondissements, seed ${ship.seed.toString(16)} v${ship.version}, quality ${ctx.quality.level}`)

  return {
    update(dt, heroLocal, camLocal) {
      clock += dt
      hours = ctx.state.time.hours
      if (pendingArr) {
        const slot = slots.find((s) => s.plan.id === pendingArr)!
        pendingArr = null
        finish(slot)
        const sp = slot.built!.cells.find((c) => c.id === slot.plan.id)!.spawn
        ctx.services.hero?.teleportLocal({ x: sp.x, y: sp.y + 0.1, z: sp.z }, sp.yaw)
      }
      if (clock > 0.25) {
        clock = 0
        schedule(heroLocal)
      }
      step(STREAM.budgetMs[ctx.quality.level])
      const pose = host.pose()
      _q.setFromAxisAngle(UP, -pose.heading)
      const sets: ContentSet[] = []
      for (const s of slots) {
        const b = s.built
        if (!b) continue
        b.layout.body.setNextKinematicTranslation(pose.position)
        b.layout.body.setNextKinematicRotation(_q)
        for (const p of b.parts) p.update?.(dt, hours)
        sets.push(b.content)
      }
      decouvertes.update(dt, heroLocal, sets)
      camCell = cellOf(camLocal)
    },
    cellAt(l, margin) {
      const c = cellOf(l, margin ?? 0)
      return c ? toCell(c) : null
    },
    spawn(id) {
      const slot = slots.find((s) => s.plan.id === id || id.startsWith(`${s.plan.id}/`))
      if (!slot) return null
      if (!slot.built) finish(slot)
      const c = slot.built!.cells.find((cc) => cc.id === id)
      return c ? { ...c.spawn } : null
    },
    anchorsNear(l, r) {
      const out: DriftAnchor[] = []
      for (const s of slots) {
        if (!s.built || boxDist(s.plan, l) > r) continue
        for (const a of s.built.anchors) if (anchorDist(a, l) <= r) out.push(a)
      }
      return out
    },
    glassVisible: () => (camCell?.glass ? 1 : 0),
    nav(district) {
      const b = slots.find((s) => s.plan.id === district)?.built
      if (!b) return null
      b.nav ??= host
        .bakeNav([b.layout.body], b.shell.links.map((k) => ({ from: k.from, to: k.to, both: k.both })))
        .then((n) => (b.navReady = n))
        .catch((err: unknown) => {
          console.warn(`[procgen] nav ${district}`, err)
          return null
        })
      return b.navReady
    },
    dispose() {
      for (const s of slots) release(s)
      silhouette.dispose()
      far.dispose()
      root.removeFromParent()
    },
  }
}
