import type RAPIER from '@dimforge/rapier3d-compat'
import type { GameContext, Vec3 } from '../core/types'
import { dirToWorld, toLocal, toWorld, type DriftPose } from '../drift/frame'
import type { Box } from './types'

// Walkability audit (docs/WALKABILITY.md method) with the hero's controller settings, in the Drift frame.
const KCC = { offset: 0.03, capHalf: 0.5, capR: 0.3, step: 0.5, stepWidth: 0.15, snap: 0.35, slopeDeg: 40, lift: 0.02 }
const PROBE = { headroom: 1.8, sub: 0.25, reach: 0.35, climb: 0.6, push: 0.8, freeDirs: 3, moved: 0.3 }

export interface AuditNode { x: number; y: number; z: number }
export interface AuditReport {
  nodes: number
  edges: number
  components: number
  largest: number
  reachedFromSeed: number
  stuck: AuditNode[]
  targets: { id: string; reached: boolean }[]
  ms: number
}

export interface AuditOptions {
  box: Box
  step: number
  seed: Vec3
  targets?: readonly { id: string; at: Vec3 }[]
  // Climbs the hero takes as links (ladders, stairs the grid misses), both ways.
  links?: readonly { from: Vec3; to: Vec3 }[]
  stuckCheck?: boolean
}

export function auditWalk(ctx: GameContext, pose: DriftPose, opt: AuditOptions): AuditReport {
  const t0 = performance.now()
  const R = ctx.physics.rapier
  const W = ctx.physics.world
  const groups = ((ctx.physics.groups.HERO & 0xffff) << 16) | ctx.physics.groups.TERRAIN
  const shape = new R.Capsule(KCC.capHalf, KCC.capR)
  const col = W.createCollider(R.ColliderDesc.capsule(KCC.capHalf, KCC.capR).setTranslation(0, -9999, 0).setCollisionGroups(groups))
  const kcc = W.createCharacterController(KCC.offset)
  kcc.setUp({ x: 0, y: 1, z: 0 })
  kcc.setSlideEnabled(true)
  kcc.enableAutostep(KCC.step, KCC.stepWidth, false)
  kcc.enableSnapToGround(KCC.snap)
  kcc.setMaxSlopeClimbAngle((KCC.slopeDeg * Math.PI) / 180)
  const down = dirToWorld(pose, { x: 0, y: -1, z: 0 })
  const up = { x: 0, y: 1, z: 0 }

  const ray = (o: Vec3, d: Vec3, max: number): RAPIER.RayColliderHit | null =>
    W.castRayAndGetNormal(new R.Ray(toWorld(pose, o), d), max, false, R.QueryFilterFlags.EXCLUDE_SENSORS, groups, col) as RAPIER.RayColliderHit | null

  const blocked = (p: Vec3) =>
    W.intersectionWithShape(toWorld(pose, { x: p.x, y: p.y + KCC.capHalf + KCC.capR + 0.06, z: p.z }), { x: 0, y: 0, z: 0, w: 1 }, shape, R.QueryFilterFlags.EXCLUDE_SENSORS, groups, col) !== null

  const nodes: AuditNode[] = []
  const index = new Map<string, number>()
  const key = (ix: number, iz: number, y: number) => `${ix},${iz},${Math.round(y * 2)}`
  const b = opt.box
  const nx = Math.floor((b.x1 - b.x0) / opt.step)
  const nz = Math.floor((b.z1 - b.z0) / opt.step)
  const columns: number[][] = []
  for (let ix = 0; ix <= nx; ix++) {
    for (let iz = 0; iz <= nz; iz++) {
      const x = b.x0 + ix * opt.step
      const z = b.z0 + iz * opt.step
      const col: number[] = []
      let y = b.y1
      while (y > b.y0) {
        const h = ray({ x, y, z }, down, y - b.y0) as (RAPIER.RayColliderIntersection & { normal: Vec3 }) | null
        if (!h) break
        const fy = y - h.timeOfImpact
        if (h.normal.y > 0.7) {
          const head = ray({ x, y: fy + 0.05, z }, up, PROBE.headroom)
          const p = { x, y: fy, z }
          if (!head && !blocked(p)) {
            index.set(key(ix, iz, fy), nodes.length)
            col.push(nodes.length)
            nodes.push(p)
          }
        }
        y = fy - 0.3
      }
      columns[ix * (nz + 1) + iz] = col
    }
  }

  const move = (from: AuditNode, dx: number, dz: number): AuditNode => {
    const p = { ...from }
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / PROBE.sub))
    for (let i = 0; i < n; i++) {
      const d = dirToWorld(pose, { x: dx / n, y: -0.12, z: dz / n })
      const attempt = (lift: number) => {
        col.setTranslation(toWorld(pose, { x: p.x, y: p.y + KCC.capHalf + KCC.capR + KCC.offset + lift, z: p.z }))
        kcc.computeColliderMovement(col, { x: d.x, y: d.y - lift, z: d.z }, R.QueryFilterFlags.EXCLUDE_SENSORS, groups)
        return kcc.computedMovement()
      }
      let m = attempt(0)
      if (Math.hypot(m.x, m.z) < Math.hypot(d.x, d.z) * 0.25) m = attempt(KCC.lift)
      const l = toLocal(pose, { x: m.x + pose.position.x, y: m.y + pose.position.y, z: m.z + pose.position.z })
      p.x += l.x
      p.y += l.y
      p.z += l.z
    }
    return p
  }

  const adj: number[][] = nodes.map(() => [])
  let edges = 0
  for (let ix = 0; ix <= nx; ix++) {
    for (let iz = 0; iz <= nz; iz++) {
      for (const a of columns[ix * (nz + 1) + iz]!) {
        for (const [ddx, ddz] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          const jx = ix + ddx
          const jz = iz + ddz
          if (jx < 0 || jz < 0 || jx > nx || jz > nz) continue
          const from = nodes[a]!
          const end = move(from, ddx * opt.step, ddz * opt.step)
          for (const c of columns[jx * (nz + 1) + jz]!) {
            const to = nodes[c]!
            if (Math.hypot(end.x - to.x, end.z - to.z) < PROBE.reach && Math.abs(end.y - to.y) < PROBE.climb) {
              adj[a]!.push(c)
              edges++
            }
          }
        }
      }
    }
  }

  const nearest = (p: Vec3) => {
    let best = -1
    let bd = Infinity
    nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - p.x, (n.y - p.y) * 2, n.z - p.z)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return bd < opt.step * 1.5 ? best : -1
  }
  for (const l of opt.links ?? []) {
    const a = nearest(l.from)
    const c = nearest(l.to)
    if (a < 0 || c < 0) continue
    adj[a]!.push(c)
    adj[c]!.push(a)
    edges += 2
  }

  const comp = new Int32Array(nodes.length).fill(-1)
  const sizes: number[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (comp[i] !== -1) continue
    const id = sizes.length
    let size = 0
    const stack = [i]
    comp[i] = id
    while (stack.length) {
      const n = stack.pop()!
      size++
      for (const m of adj[n]!) {
        if (comp[m] !== -1) continue
        comp[m] = id
        stack.push(m)
      }
    }
    sizes.push(size)
  }

  const seed = nearest(opt.seed)
  const seedComp = seed >= 0 ? comp[seed]! : -2
  const targets = (opt.targets ?? []).map((t) => {
    const n = nearest(t.at)
    return { id: t.id, reached: n >= 0 && comp[n] === seedComp }
  })

  const stuck: AuditNode[] = []
  if (opt.stuckCheck) {
    for (const n of nodes) {
      let free = 0
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4
        const e = move(n, Math.cos(a) * PROBE.push, Math.sin(a) * PROBE.push)
        if (Math.hypot(e.x - n.x, e.z - n.z) > PROBE.moved) free++
      }
      if (free <= PROBE.freeDirs) stuck.push(n)
    }
  }

  W.removeCollider(col, false)
  W.removeCharacterController(kcc)
  return {
    nodes: nodes.length, edges, components: sizes.length, largest: Math.max(0, ...sizes),
    reachedFromSeed: seedComp >= 0 ? sizes[seedComp]! : 0, stuck, targets, ms: Math.round(performance.now() - t0),
  }
}
