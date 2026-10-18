import * as THREE from 'three'
import type { GameContext, RoomId, Vec3 } from '../core/types'

export type HeroAnchor =
  | { kind: 'ladder'; id: string; bottom: Vec3; top: Vec3; normal: Vec3 }
  | { kind: 'zip'; id: string; from: Vec3; to: Vec3 }
  | { kind: 'tube'; id: string; at: Vec3; station: string }
  | { kind: 'slide'; id: string; path: Vec3[] }
  | { kind: 'seat' | 'bed' | 'hammock' | 'lunette' | 'chart-table'; id: string; at: Vec3; yaw: number }
  | { kind: 'ring'; id: string; at: Vec3 }

type V2Drift = { anchorsNear?: (local: Vec3, r: number) => HeroAnchor[]; ceilingAt?: (local: Vec3) => number | null }

const ROOMS: readonly RoomId[] = [
  'sas', 'coursive-sud', 'refectoire', 'rebord', 'cuisine', 'marche',
  'passerelle-1', 'passerelle-2', 'passerelle-3', 'salle-des-cartes', 'cabine', 'cabines-voisins', 'echelle-toit',
]

const seg = new THREE.Vector3()
const ap = new THREE.Vector3()
const sq = new THREE.Vector3()
const sp = new THREE.Vector3()

export function closestOnSegment(p: Vec3, a: Vec3, b: Vec3, out: THREE.Vector3): number {
  seg.set(b.x - a.x, b.y - a.y, b.z - a.z)
  ap.set(p.x - a.x, p.y - a.y, p.z - a.z)
  const l2 = seg.lengthSq()
  const t = l2 > 1e-9 ? THREE.MathUtils.clamp(ap.dot(seg) / l2, 0, 1) : 0
  out.set(a.x + seg.x * t, a.y + seg.y * t, a.z + seg.z * t)
  return t
}

export function anchorDistance(a: HeroAnchor, p: Vec3, tmp: THREE.Vector3): number {
  switch (a.kind) {
    case 'ladder':
      closestOnSegment(p, a.bottom, a.top, tmp)
      break
    case 'zip':
      closestOnSegment(p, a.from, a.to, tmp)
      break
    case 'slide': {
      let best = Infinity
      sp.set(p.x, p.y, p.z)
      for (let i = 0; i + 1 < a.path.length; i++) {
        closestOnSegment(p, a.path[i]!, a.path[i + 1]!, sq)
        const d = sq.distanceToSquared(sp)
        if (d < best) {
          best = d
          tmp.copy(sq)
        }
      }
      return Math.sqrt(best)
    }
    default:
      tmp.set(a.at.x, a.at.y, a.at.z)
  }
  return Math.hypot(tmp.x - p.x, tmp.y - p.y, tmp.z - p.z)
}

export class AnchorBook {
  private extra = new Map<string, HeroAnchor[]>()
  private v1Cache: HeroAnchor[] = []
  private v1At = -1
  private tmp = new THREE.Vector3()

  constructor(private ctx: GameContext) {}

  set(source: string, anchors: HeroAnchor[] | null): void {
    if (anchors && anchors.length > 0) this.extra.set(source, anchors)
    else this.extra.delete(source)
  }

  near(local: Vec3, r: number, out: HeroAnchor[]): HeroAnchor[] {
    out.length = 0
    const drift = this.ctx.services.drift as (V2Drift & GameContext['services']['drift']) | undefined
    const v2 = drift?.anchorsNear?.(local, r)
    if (v2) for (const a of v2) out.push(a)
    for (const list of this.extra.values()) {
      for (const a of list) if (anchorDistance(a, local, this.tmp) <= r) out.push(a)
    }
    if (!drift?.anchorsNear) {
      for (const a of this.v1Ladders()) if (anchorDistance(a, local, this.tmp) <= r) out.push(a)
    }
    return out
  }

  byId(id: string, local: Vec3): HeroAnchor | null {
    const list = this.near(local, 30, [])
    return list.find((a) => a.id === id) ?? null
  }

  private v1Ladders(): HeroAnchor[] {
    const t = this.ctx.clock.elapsed
    if (t - this.v1At < 1 && this.v1At >= 0) return this.v1Cache
    this.v1At = t
    this.v1Cache = []
    const drift = this.ctx.services.drift
    if (!drift?.ladders) return this.v1Cache
    const seen = new Set<string>()
    for (const room of ROOMS) {
      let list: ReturnType<typeof drift.ladders> = []
      try {
        list = drift.ladders(room)
      } catch {
        continue
      }
      for (const l of list) {
        if (seen.has(l.id)) continue
        seen.add(l.id)
        const bottom = drift.toLocal(l.bottom)
        const top = drift.toLocal(l.top)
        const tip = drift.toLocal({ x: l.bottom.x + l.normal.x, y: l.bottom.y + l.normal.y, z: l.bottom.z + l.normal.z })
        this.v1Cache.push({
          kind: 'ladder', id: l.id, bottom, top,
          normal: { x: tip.x - bottom.x, y: tip.y - bottom.y, z: tip.z - bottom.z },
        })
      }
    }
    return this.v1Cache
  }
}

export function ceilingLocal(ctx: GameContext, world: Vec3): number | null {
  const drift = ctx.services.drift as (V2Drift & GameContext['services']['drift']) | undefined
  if (!drift) return null
  if (drift.ceilingAt) {
    const l = drift.toLocal(world)
    const c = drift.ceilingAt(l)
    return c === null ? null : c + (world.y - l.y)
  }
  return drift.roomCeilingAt?.(world) ?? null
}
