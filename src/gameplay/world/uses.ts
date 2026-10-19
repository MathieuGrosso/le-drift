import type { Vec3 } from '../../core/types'
import type { Candidate, Gp, InteractKind } from '../context'
import type { Owned } from './sites'

export interface Use { label: string; kind: InteractKind; run(): void; reach?: number }
export type UseFn = (owner: string) => Use | null

const RAY_REACH = 2.4
const NEAR = 1.9
const RIDE = /^(tube-|tyrolienne-)/

// Drift props are found two ways: what Ilo is facing (collider ownerId) and what is close by
// (sites() positions, then every tagged collider drift registered).
export interface Uses {
  on(prefix: RegExp, fn: UseFn): void
  candidates(out: Candidate[]): void
  resolve(owner: string): Use | null
}

export function createUses(gp: Gp): Uses {
  const ctx = gp.ctx
  const handlers: { prefix: RegExp; fn: UseFn }[] = []
  const nearby: Owned[] = []

  const resolve = (owner: string): Use | null => {
    for (const h of handlers) if (h.prefix.test(owner)) return h.fn(owner)
    return null
  }

  return {
    on(prefix, fn) {
      handlers.push({ prefix, fn })
    },
    resolve,
    candidates(out) {
      if (ctx.state.hero.medium !== 'air') return
      const head = gp.headPos()
      const f = gp.heroForward()
      const hit = ctx.physics.raycast(head, f, RAY_REACH) ?? ctx.physics.raycast(head, { x: f.x, y: -0.45, z: f.z }, RAY_REACH + 0.4)
      const owner = hit?.tag?.ownerId
      const taken = new Set<string>()
      if (hit && owner) {
        const local = ctx.services.drift?.toLocal(hit.point) ?? hit.point
        gp.sites.remember(owner, local)
        const u = resolve(owner)
        if (u) {
          taken.add(owner)
          out.push({ id: owner, kind: u.kind, label: u.label, key: 'interact', dist: hit.distance - 0.4, run: u.run })
        }
      }
      const hl = gp.heroLocal()
      const drift = ctx.services.drift
      const fl = drift ? drift.toLocal({ x: gp.heroPos().x + f.x, y: gp.heroPos().y, z: gp.heroPos().z + f.z }) : null
      const facing = (h: Vec3, p: Vec3, d: number) => !fl || ((p.x - h.x) * (fl.x - h.x) + (p.z - h.z) * (fl.z - h.z)) / d > 0.35
      const near = (id: string, p: Vec3 | null) => {
        if (!p || taken.has(id)) return
        const u = resolve(id)
        if (!u) return
        const d = Math.hypot(hl.x - p.x, hl.y + 1 - p.y, hl.z - p.z)
        if (d > (u.reach ?? NEAR)) return
        if (id.startsWith('tube-') && d > 0.9 && !facing(hl, p, d)) return
        taken.add(id)
        out.push({ id, kind: u.kind, label: u.label, key: 'interact', dist: d, run: u.run })
      }
      const s = gp.sites.get()
      for (const d of s.domes) near(`lunette-${d.id}`, d.lunette)
      for (const c of s.scellees) {
        near(`pompe-${c.id}`, c.pump)
        near(`vanne-${c.id}`, c.valve)
        near(`levier-${c.id}`, c.lever)
        near(`nacre-${c.id}`, c.nacre)
      }
      for (const a of gp.sites.near(hl, NEAR + 0.5)) {
        if (a.kind === 'lunette') near(`lunette-${a.id}`, a.at)
        else if (a.kind === 'chart-table' || a.kind === 'hammock' || a.kind === 'bed' || a.kind === 'seat') near(a.id, a.at)
      }
      for (const o of gp.sites.ownedNear(hl, NEAR + 1.4, nearby)) {
        if (o.kind === 'ladder' || o.kind === 'window') continue
        if (o.kind === 'door' && !RIDE.test(o.id)) continue
        near(o.id, o.at)
      }
    },
  }
}
