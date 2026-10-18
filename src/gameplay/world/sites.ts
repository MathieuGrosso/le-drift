import type { DistrictId, DriftService, GameContext, Vec3 } from '../../core/types'

// Drift owns every place (BIBLE §4.1). Gameplay reads them through sites()/anchorsNear() and, as a
// fallback, through the ownerId of the colliders drift tagged (pompe-cs-01, couchette-*, etal-marche-*…).

export type SiteAnchor =
  | { kind: 'ladder'; id: string; bottom: Vec3; top: Vec3; normal: Vec3 }
  | { kind: 'zip'; id: string; from: Vec3; to: Vec3 }
  | { kind: 'tube'; id: string; at: Vec3; station: string }
  | { kind: 'slide'; id: string; path: Vec3[] }
  | { kind: 'seat' | 'bed' | 'hammock' | 'lunette' | 'chart-table'; id: string; at: Vec3; yaw: number }
  | { kind: 'ring'; id: string; at: Vec3 }
  | { kind: 'trouvaille'; id: string; at: Vec3 }

export interface ShrineFrame {
  id: string
  origin: Vec3
  t: Vec3
  n: Vec3
  at(u: number, d: number, y: number): Vec3
}
export interface ScelleeSite { id: string; at: Vec3; pump: Vec3 | null; valve: Vec3 | null; lever: Vec3 | null; nacre: Vec3 | null; frame: ShrineFrame | null }
export interface DriftSites {
  domes: { id: string; at: Vec3; lunette: Vec3 | null }[]
  scellees: ScelleeSite[]
  trouvailles: { id: string; at: Vec3 }[]
}
export interface Owned { id: string; at: Vec3; kind: string }
type RawSite = { id: string; local?: Vec3; at?: Vec3; lunette?: Vec3; pump?: Vec3; valve?: Vec3; lever?: Vec3; nacre?: Vec3 }

interface DriftV2 {
  sites?(): { domes?: RawSite[]; scellees?: RawSite[]; trouvailles?: RawSite[] } | null
  anchorsNear?(local: Vec3, r: number): readonly SiteAnchor[]
  riding?(): boolean
}

export const MAP_DOMES = ['dome-ecluse', 'dome-marche', 'dome-serres', 'dome-nef', 'dome-machines', 'dome-ateliers', 'dome-scellees'] as const
export const SCELLEES = ['cs-01', 'cs-02', 'cs-03', 'cs-04', 'cs-05', 'cs-06', 'cs-07', 'cs-08', 'cs-09', 'cs-10', 'cs-11', 'cs-12'] as const
export const DOME_DISTRICT: Record<string, DistrictId> = {
  'dome-ecluse': 'ecluse', 'dome-marche': 'marche', 'dome-serres': 'serres', 'dome-nef': 'nef',
  'dome-machines': 'machines', 'dome-ateliers': 'ateliers', 'dome-scellees': 'scellees', 'dome-proue': 'proue', vigie: 'proue',
}
export const CHART_ROOMS: readonly string[] = ['vigie', 'salle-des-cartes']

// Plan-icon fallbacks (Drift-local) used until sites() answers.
export const PLAN_FALLBACK: Record<string, { x: number; z: number }> = {
  'dome-ecluse': { x: 0, z: 39 }, 'dome-nef': { x: 0, z: 0 }, 'dome-marche': { x: -88, z: 33 }, 'dome-serres': { x: 90, z: 33 },
  'dome-machines': { x: 0, z: 10 }, 'dome-ateliers': { x: -88, z: -32 }, 'dome-scellees': { x: 112, z: -32 },
  'cs-01': { x: 20, z: 42 }, 'cs-05': { x: -20, z: -42 },
  'cs-02': { x: -100, z: 10 }, 'cs-03': { x: 100, z: 50 }, 'cs-04': { x: 100, z: 10 }, 'cs-06': { x: -12, z: 20 }, 'cs-07': { x: 12, z: 20 },
  'cs-08': { x: -116, z: -40 }, 'cs-09': { x: -60, z: -40 }, 'cs-10': { x: 66, z: -50 }, 'cs-11': { x: 88, z: -50 }, 'cs-12': { x: 110, z: -50 },
}

// drift's shrine kit: spawn sits 5.5 m in from the hatch, pit spans u ±6, d 7..11 (city/parts.ts `shrine`).
const SHRINE_SPAWN_D = 5.5

export interface Sites {
  drift(): (DriftService & DriftV2) | null
  get(): DriftSites
  near(local: Vec3, r: number): readonly SiteAnchor[]
  owned(): readonly Owned[]
  ownedNear(local: Vec3, r: number, out: Owned[]): Owned[]
  remember(owner: string, local: Vec3): void
  where(owner: string): Vec3 | null
  cellOf(local: Vec3): string | null
  shrine(id: string): ShrineFrame | null
  rescan(): void
}

function frameFrom(id: string, spawn: Vec3, yaw: number): ShrineFrame {
  const nx = Math.round(Math.sin(yaw))
  const nz = Math.round(-Math.cos(yaw))
  const along = Math.abs(nx) < 0.5
  const t = { x: along ? 1 : 0, y: 0, z: along ? 0 : 1 }
  const n = { x: nx, y: 0, z: nz }
  const origin = { x: spawn.x - n.x * SHRINE_SPAWN_D, y: spawn.y, z: spawn.z - n.z * SHRINE_SPAWN_D }
  return { id, origin, t, n, at: (u, d, y) => ({ x: origin.x + t.x * u + n.x * d, y: origin.y + y, z: origin.z + t.z * u + n.z * d }) }
}

export function createSites(ctx: GameContext): Sites {
  const seen = new Map<string, Vec3>()
  const owned = new Map<string, Owned>()
  const empty: DriftSites = { domes: [], scellees: [], trouvailles: [] }
  let cache: DriftSites | null = null
  let cacheFrame = -999
  let scanFrame = -999
  let ownedList: Owned[] = []
  const frames = new Map<string, ShrineFrame | null>()

  const drift = () => (ctx.services.drift as (DriftService & DriftV2) | undefined) ?? null

  const scan = () => {
    const d = drift()
    const w = ctx.physics?.world as unknown as { forEachCollider?(fn: (c: { handle: number; translation(): Vec3 }) => void): void } | undefined
    if (!d || !w?.forEachCollider) return
    owned.clear()
    w.forEachCollider((c) => {
      const tag = ctx.physics.tagOf(c.handle)
      const id = tag?.ownerId
      if (!id || id === 'nef' || id.startsWith('coque-')) return
      const prev = owned.get(id)
      if (prev && prev.kind === 'prop') return
      const p = c.translation()
      owned.set(id, { id, at: d.toLocal({ x: p.x, y: p.y, z: p.z }), kind: tag.kind })
    })
    ownedList = [...owned.values()]
    scanFrame = ctx.clock.frame
  }

  const ensureScan = () => {
    const age = ctx.clock.frame - scanFrame
    if (age > 600 || (ownedList.length === 0 && age > 60)) scan()
  }

  const shrine = (id: string): ShrineFrame | null => {
    if (frames.has(id)) return frames.get(id)!
    const d = drift()
    const site = api.get().scellees.find((s) => s.id === id)
    const spawn = d?.cellSpawn(id)
    if (!site || !spawn) return null
    const f = frameFrom(id, spawn.local, spawn.yaw)
    frames.set(id, f)
    return f
  }

  const api: Sites = {
    drift,
    get() {
      if (cache && ctx.clock.frame - cacheFrame < 600) return cache
      const d = drift()
      const s = d?.sites?.()
      cacheFrame = ctx.clock.frame
      const pos = (r: RawSite): Vec3 => r.at ?? r.local ?? { x: 0, y: -999, z: 0 }
      const lunettes = new Map<string, Vec3>()
      for (const a of d?.anchorsNear?.({ x: 0, y: 0, z: 0 }, 1000) ?? []) if (a.kind === 'lunette') lunettes.set(a.id, a.at)
      ensureScan()
      const ownedAt = (k: string) => owned.get(k)?.at ?? null
      cache = s
        ? {
            domes: (s.domes ?? []).map((r) => ({ id: r.id, at: pos(r), lunette: r.lunette ?? lunettes.get(r.id) ?? ownedAt(`lunette-${r.id}`) })),
            scellees: (s.scellees ?? []).map((r) => {
              const spawn = d?.cellSpawn(r.id)
              const f = spawn ? frameFrom(r.id, spawn.local, spawn.yaw) : null
              frames.set(r.id, f)
              return {
                id: r.id,
                at: pos(r),
                pump: r.pump ?? ownedAt(`pompe-${r.id}`) ?? f?.at(-4.8, 5.7, 0.6) ?? null,
                valve: r.valve ?? ownedAt(`vanne-${r.id}`) ?? f?.at(5.6, 5.8, 1.4) ?? null,
                lever: r.lever ?? ownedAt(`levier-${r.id}`) ?? f?.at(1.8, 12.3, 0.6) ?? null,
                nacre: r.nacre ?? ownedAt(`nacre-${r.id}`) ?? f?.at(-4.5, 12.3, 3.6) ?? null,
                frame: f,
              }
            }),
            trouvailles: (s.trouvailles ?? []).map((r) => ({ id: r.id, at: pos(r) })),
          }
        : empty
      return cache
    },
    near(local, r) {
      return drift()?.anchorsNear?.(local, r) ?? []
    },
    owned() {
      ensureScan()
      return ownedList
    },
    ownedNear(local, r, out) {
      ensureScan()
      out.length = 0
      const r2 = r * r
      for (const o of ownedList) {
        const dx = o.at.x - local.x
        const dy = o.at.y - local.y
        const dz = o.at.z - local.z
        if (dx * dx + dy * dy + dz * dz <= r2) out.push(o)
      }
      return out
    },
    remember(owner, local) {
      seen.set(owner, { ...local })
    },
    where(owner) {
      const s = api.get()
      if (owner.startsWith('lunette-')) {
        const d = s.domes.find((x) => `lunette-${x.id}` === owner)
        if (d?.lunette) return d.lunette
      }
      const m = /^(pompe|vanne|levier|nacre)-(cs-\d\d)$/.exec(owner)
      if (m) {
        const sc = s.scellees.find((x) => x.id === m[2])
        const key = m[1] === 'pompe' ? 'pump' : m[1] === 'vanne' ? 'valve' : m[1] === 'levier' ? 'lever' : 'nacre'
        if (sc?.[key]) return sc[key]
      }
      return owned.get(owner)?.at ?? seen.get(owner) ?? null
    },
    cellOf(local) {
      return drift()?.cellAt(local) ?? null
    },
    shrine,
    rescan() {
      scanFrame = -999
      cacheFrame = -999
      frames.clear()
    },
  }
  ctx.bus.on('district:streamed', () => api.rescan())
  return api
}
