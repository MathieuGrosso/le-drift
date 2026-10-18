import * as THREE from 'three'
import { DISTRICT_BY_ID, DISTRICT_NEIGHBOURS, DRIFT_BOUNDS, DRIFT_Y, PLACES, districtAt, inDistrict } from '../core/layout'
import type { CameraEnv, CellId, DistrictId, DriftService, GameContext, LockId, Medium, RoomId, System, Vec3 } from '../core/types'
import { ForecastBoard } from './board'
import { ChartTable } from './chart'
import { Chatter } from './chatter'
import { City, type Anchor, type CellDef } from './city'
import { dirToWorld, toLocal, toWorld, yawToWorld, type DriftPose } from './frame'
import { Hulls } from './hulls'
import { LOCK_OUTSIDE, PORTHOLES, RECT_WINDOWS, partById } from './interiors/layout'
import { Quarter } from './interiors/quarter'
import { createMats, type Mats } from './materials'
import { Npcs } from './npcs'
import { PAL } from './palette'
import { registerDriftPoses } from './poses'
import { METERS_PER_GAME_HOUR, currentGate, minimumProgressForAct, poseAt } from './route'
import { drawingsTexture, gratingTexture, planksTexture } from './textures'
import { Windows } from './windows'

export type DriftAnchor = Anchor | { kind: 'ring'; id: string; at: Vec3 }
export type DriftSiteKind = 'dome' | 'scellee' | 'trouvaille' | 'couchette' | 'etal' | 'table-carte'

// One entry per interactable place; `id` is the collider ownerId gameplay resolves (lunette-<domeId>, scellee-cs-01, tr-01…).
export interface DriftSite {
  id: string
  kind: DriftSiteKind
  local: Vec3
  at: Vec3
  district: DistrictId
  cell: CellId | null
  yaw: number
}
export interface DomeSite extends DriftSite {
  kind: 'dome'
  dome: string
  lunetteId: string
  lunette: Vec3
  top: Vec3 | null
}
export interface ScelleeSite extends DriftSite {
  kind: 'scellee'
  num: number
  doorId: string
  pump: Vec3; valve: Vec3; lever: Vec3; nacre: Vec3
  pumpId: string; valveId: string; leverId: string; nacreId: string
  grilleId: string
}
// Grouped views keep gameplay's v1 keys: domes[].id is the DomeId and scellees[].id the 'cs-xx' cell.
export interface DriftSites {
  all: readonly DriftSite[]
  domes: readonly (Omit<DomeSite, 'id'> & { id: string })[]
  scellees: readonly (Omit<ScelleeSite, 'id'> & { id: string })[]
  trouvailles: readonly DriftSite[]
  couchettes: readonly DriftSite[]
  etals: readonly DriftSite[]
  tables: readonly DriftSite[]
}
export interface DriftServiceV2 extends DriftService {
  anchorsNear(local: Vec3, r: number): DriftAnchor[]
  ceilingAt(local: Vec3): number | null
  sites(): DriftSites
  siteById(id: string): DriftSite | null
  visibleCells(): readonly CellId[]
  glassPortalsVisible(): number
  setValve(id: string, open: boolean): void
  cycleLock(id: LockId, dir: 'in' | 'out'): Promise<void>
  riding(): boolean
}

const QUARTER_GATES: Record<string, number> = { 'porte-nef': 2, 'porte-grand-marche': 2 }

const SPAWNS: Record<RoomId, { x: number; y: number; z: number; yaw: number }> = {
  sas: { x: 0, y: 0, z: 66.4, yaw: Math.PI },
  'coursive-sud': { x: -4, y: 0, z: 62, yaw: Math.PI / 2 },
  refectoire: { x: 18, y: 0, z: 57.9, yaw: Math.PI },
  rebord: { x: 18, y: 0.6, z: 70.2, yaw: Math.PI },
  cuisine: { x: 13.5, y: 0, z: 54.6, yaw: 0 },
  marche: { x: -31, y: 0, z: 62, yaw: -Math.PI / 2 },
  'passerelle-1': { x: -20, y: 0, z: 62, yaw: -Math.PI / 2 },
  'passerelle-2': { x: 31, y: 0, z: 62, yaw: Math.PI / 2 },
  'passerelle-3': { x: -17, y: 0, z: 57.5, yaw: -Math.PI / 2 },
  'salle-des-cartes': { x: 40, y: 0, z: 64.4, yaw: 0 },
  cabine: { x: -7, y: 0, z: 65.4, yaw: 0 },
  'cabines-voisins': { x: -6, y: 0, z: 59.6, yaw: 0 },
  'echelle-toit': { x: -2.35, y: 3.05, z: 64.6, yaw: Math.PI / 2 },
}
const EXTRA_SPAWNS: Record<string, { x: number; y: number; z: number; yaw: number }> = {
  'passerelle-nef': { x: -6, y: 0, z: 46, yaw: 0 },
}

const LOCK_ANCHORS: Record<'sas' | 'echelle-toit', Vec3> = {
  sas: LOCK_OUTSIDE,
  'echelle-toit': { x: -2.3, y: 6.6, z: 64.6 },
}
const ATRIUM_AIR: Partial<Record<string, number>> = { refectoire: 0.15, marche: 0.2 }
const SEAT_ALIAS: Record<string, string> = { 'lit-cabine': 'couchette-cabine' }

function glassPoints(): Map<string, Vec3[]> {
  const out = new Map<string, Vec3[]>()
  const at = (partId: string, side: string, a: number, y: number): Vec3 => {
    const p = partById(partId)
    if (side === 'n') return { x: a, y: p.floorY + y, z: p.z0 }
    if (side === 's') return { x: a, y: p.floorY + y, z: p.z1 }
    if (side === 'w') return { x: p.x0, y: p.floorY + y, z: a }
    return { x: p.x1, y: p.floorY + y, z: a }
  }
  const push = (partId: string, v: Vec3) => {
    const room = partById(partId).room
    const list = out.get(room) ?? []
    list.push(v)
    out.set(room, list)
  }
  for (const h of PORTHOLES) push(h.part, at(h.part, h.side, h.at, h.y))
  for (const w of RECT_WINDOWS) {
    for (const k of [-0.4, 0, 0.4]) push(w.part, at(w.part, w.side, w.at + k * w.w, w.y0 + w.h / 2))
  }
  return out
}

const GUIDE_ROPE: readonly [number, number, number][] = [
  [0.7, 0.4, 73.7], [3.5, -0.2, 74.6], [8, 0.1, 73.4], [12.4, 0.6, 72.4], [23.6, 0.6, 72.4],
  [27, -0.3, 70.5], [33, 0.1, 68.4], [38.2, 0.5, 67.4], [42, 0.4, 67.4],
]

const near3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

function anchorDist(a: DriftAnchor, l: Vec3): number {
  if (a.kind === 'ladder') return segDist(l, a.bottom, a.top)
  if (a.kind === 'zip') return segDist(l, a.from, a.to)
  if (a.kind === 'slide') {
    let best = Infinity
    for (let i = 1; i < a.path.length; i++) best = Math.min(best, segDist(l, a.path[i - 1]!, a.path[i]!))
    return best
  }
  return near3(a.at, l)
}

function segDist(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const l2 = abx * abx + aby * aby + abz * abz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2)) : 0
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z)
}

export function createDriftSystem(): System {
  const pose: DriftPose = { position: { x: 0, y: DRIFT_Y, z: 0 }, heading: 0, velocity: { x: 0, y: 0, z: 0 } }
  const root = new THREE.Group()
  root.name = 'le-drift'
  let mats: Mats
  let hulls: Hulls | null = null
  let city: City | null = null
  let quarter: Quarter | null = null
  let windows: Windows | null = null
  let npcs: Npcs | null = null
  let board: ForecastBoard | null = null
  let chart: ChartTable | null = null
  let chatter: Chatter | null = null
  let ctxRef: GameContext | null = null
  let district: DistrictId = 'ecluse'
  let loadedKey = ''
  let visibleKey = ''
  const loaded = new Set<DistrictId>()
  const visibleDistricts = new Set<DistrictId>()
  const glass = glassPoints()
  const camEnv: CameraEnv = { indoor: 1, glassDist: 4, airHaze: 0, district: 'ecluse', cell: 'cabine' }
  let visible: CellId[] = []
  let glassVisible = 1
  let lastProgress = 0
  let creakIn = 10
  let groanCooldown = 0
  let lastHeading = 0
  let altitudeTarget = DRIFT_Y
  let sitesCache: DriftSites | null = null
  const fallbackLights: THREE.PointLight[] = []
  const offs: (() => void)[] = []
  const heroLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  const camLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  const tmp: Vec3 = { x: 0, y: 0, z: 0 }
  const tmpV = new THREE.Vector3()

  const syncPose = (ctx: GameContext) => {
    const st = ctx.state
    const gate = currentGate(st)
    st.drift.progress = Math.min(gate.distance, Math.max(st.drift.progress, minimumProgressForAct(st)))
    const moving = st.drift.progress < gate.distance - 1e-3
    poseAt(st.drift.progress, moving, st.time.scale, pose, st.drift.altitude || DRIFT_Y)
    st.drift.position = { ...pose.position }
    st.drift.heading = pose.heading
    st.drift.velocity = { ...pose.velocity }
    st.drift.gate = gate.id
    root.position.set(pose.position.x, pose.position.y, pose.position.z)
    root.rotation.set(0, -pose.heading, 0)
    root.updateMatrixWorld(true)
  }

  const heroPlace = (ctx: GameContext) => (local: Vec3) => {
    const hero = ctx.services.hero
    if (hero) hero.teleport(toWorld(pose, local), ctx.state.hero.yaw)
  }

  const sfx = (ctx: GameContext, id: string, at?: Vec3) => {
    try {
      ctx.services.audio?.sfx(id, at)
    } catch {
      /* audio is optional */
    }
  }

  const cityCell = (l: Vec3): CellDef | null => city?.cellAt(l) ?? null
  const nearCity = (l: Vec3, m: number): boolean => {
    if (!city) return false
    for (const c of city.cells) {
      for (const b of c.boxes) {
        if (l.x > b.x0 - m && l.x < b.x1 + m && l.z > b.z0 - m && l.z < b.z1 + m && l.y > b.y0 - m && l.y < b.y1 + m) return true
      }
    }
    return false
  }

  const localMedium = (l: Vec3): Medium => {
    if (quarter?.partAt(l)) return quarter.mediumAt(l)
    if (cityCell(l)) return 'air'
    if (ctxRef?.state.mode === 'inside' && nearCity(l, 0.9)) return 'air'
    return quarter ? quarter.mediumAt(l) : 'water'
  }
  const localCell = (l: Vec3): CellId | null => quarter?.roomAt(l) ?? cityCell(l)?.id ?? (quarter?.partAt(l)?.id ?? null)
  const spawnOf = (cell: string): { x: number; y: number; z: number; yaw: number } | null => {
    const s = (SPAWNS as Record<string, { x: number; y: number; z: number; yaw: number }>)[cell] ?? EXTRA_SPAWNS[cell]
    if (s) return s
    const c = city?.cellById(cell)
    if (c) return c.spawn
    const place = PLACES[cell]
    return place && place.mode === 'inside' ? { ...place.local, yaw: place.yaw } : null
  }

  const quarterAnchors = (): DriftAnchor[] => {
    const out: DriftAnchor[] = []
    for (const l of quarter?.furniture.ladders ?? []) out.push({ kind: 'ladder', id: l.id, bottom: l.bottom, top: l.top, normal: l.normal })
    for (const s of quarter?.furniture.seats ?? []) out.push({ kind: s.lying ? 'bed' : 'seat', id: s.id, at: { x: s.x, y: s.y, z: s.z }, yaw: s.yaw })
    out.push({ kind: 'chart-table', id: 'table-carte', at: { x: 40, y: 0, z: 62.6 }, yaw: Math.PI })
    return out
  }
  let quarterAnchorList: DriftAnchor[] = []

  const buildSites = (): DriftSites => {
    const all: DriftSite[] = []
    const domes: (Omit<DomeSite, 'id'> & { id: string })[] = []
    const scellees: (Omit<ScelleeSite, 'id'> & { id: string })[] = []
    const site = (id: string, kind: DriftSiteKind, local: Vec3, d: DistrictId | null, yaw = 0): DriftSite => {
      const l = { x: local.x, y: local.y, z: local.z }
      return { id, kind, local: l, at: l, district: d ?? districtAt(l), cell: localCell({ x: l.x, y: l.y + 0.5, z: l.z }), yaw }
    }
    if (city) {
      const cs = city.sites()
      const tops = new Map(cs.domes.map((d) => [d.id, d]))
      for (const a of city.anchorsNear({ x: 0, y: 0, z: 0 }, 1e6)) {
        if (a.kind !== 'lunette') continue
        const top = tops.get(a.id)
        const base = site(`lunette-${a.id}`, 'dome', a.at, top?.district ?? null, a.yaw)
        const dome: DomeSite = { ...base, kind: 'dome', dome: a.id, lunetteId: `lunette-${a.id}`, lunette: base.local, top: top?.top ?? null }
        all.push(dome)
        domes.push({ ...dome, id: a.id })
      }
      for (const s of cs.scellees) {
        const base = site(`scellee-${s.id}`, 'scellee', s.entry, s.district, 0)
        const sc: ScelleeSite = {
          ...base, kind: 'scellee', cell: s.id, num: s.num, doorId: `scellee-${s.id}`, grilleId: `grille-${s.id}`,
          pump: s.pump, valve: s.valve, lever: s.lever, nacre: s.nacre,
          pumpId: `pompe-${s.id}`, valveId: `vanne-${s.id}`, leverId: `levier-${s.id}`, nacreId: `nacre-${s.id}`,
        }
        all.push(sc)
        scellees.push({ ...sc, id: s.id })
      }
      for (const t of cs.trouvailles) all.push(site(t.id, 'trouvaille', t.local, t.district))
      for (const p of cs.places) all.push(site(p.id, p.kind, p.at, p.district, p.yaw))
    }
    for (const o of quarter?.owned() ?? []) {
      if (o.ownerId.startsWith('couchette-')) all.push(site(o.ownerId, 'couchette', o, 'ecluse'))
      else if (o.ownerId.startsWith('etal-')) all.push(site(o.ownerId, 'etal', o, 'ecluse'))
      else if (o.ownerId === 'table-carte') all.push(site(o.ownerId, 'table-carte', o, 'ecluse', Math.PI))
    }
    all.sort((a, b) => a.id.localeCompare(b.id))
    const of = (k: DriftSiteKind) => all.filter((s) => s.kind === k)
    return { all, domes, scellees, trouvailles: of('trouvaille'), couchettes: of('couchette'), etals: of('etal'), tables: of('table-carte') }
  }

  const cycleQuarterLock = (lockId: 'sas' | 'echelle-toit', dir: 'in' | 'out'): Promise<void> => {
    const ctx = ctxRef
    if (!quarter || !ctx) return Promise.resolve()
    return quarter.cycleAirlock(lockId, dir, heroPlace(ctx), () => toLocal(pose, ctx.state.hero.position))
  }

  const service: DriftServiceV2 = {
    pose: () => ({ position: { ...pose.position }, heading: pose.heading, velocity: { ...pose.velocity } }),
    lockPosition: () => toWorld(pose, LOCK_OUTSIDE),
    nearestWindow: (p, maxDist) => windows?.nearest(pose, p, maxDist) ?? null,
    scrub: (id, amount) => windows?.scrub(id, amount) ?? 0,
    npcPosition: (id) => {
      const l = npcs?.position(id) ?? city?.npcLocal(id) ?? null
      return l ? toWorld(pose, l) : null
    },
    playScene: (id) => npcs?.playScene(id) ?? Promise.resolve(),
    mediumAt: (p): Medium => localMedium(toLocal(pose, p, tmp)),
    roomAt: (p) => localCell(toLocal(pose, p, tmp)) as RoomId | null,
    toLocal: (p) => toLocal(pose, p),
    toWorld: (p) => toWorld(pose, p),
    roomSpawn: (room) => {
      const s = spawnOf(room) ?? SPAWNS.sas
      return { position: toWorld(pose, s), yaw: yawToWorld(pose, s.yaw) }
    },
    ladders: (room) => {
      const q = (quarter?.furniture.ladders ?? []).filter((l) => l.rooms.includes(room))
      const c = city?.ladderList(room) ?? []
      return [...q, ...c].map((l) => ({ id: l.id, bottom: toWorld(pose, l.bottom), top: toWorld(pose, l.top), normal: dirToWorld(pose, l.normal) }))
    },
    seat: (raw) => {
      const id = SEAT_ALIAS[raw] ?? raw
      const s = quarter?.furniture.seats.find((q) => q.id === id) ?? city?.seat(id)
      if (!s) return null
      return { position: toWorld(pose, s), yaw: yawToWorld(pose, s.yaw) }
    },
    openDoor: (id, open) => {
      if (city?.hasDoor(id)) {
        city.openDoor(id, open)
        return
      }
      const gate = QUARTER_GATES[id]
      const st = ctxRef?.state
      if (open && gate !== undefined && st && st.act < gate && !st.flags[`${id}:ouverte`]) {
        if (ctxRef) sfx(ctxRef, 'hatch-clang')
        ;(ctxRef?.bus as unknown as { emit(k: string, p: unknown): void } | undefined)?.emit('door:locked', { at: { x: 0, y: 0, z: 0 }, doorId: id })
        return
      }
      quarter?.openDoor(id, open)
    },
    cycleAirlock: (lockId, dir) => cycleQuarterLock(lockId, dir),
    cycleLock: (id, dir) => {
      const lock = id === 'sas' || id === 'sas-ecluse' ? 'sas' : id === 'echelle-toit' ? 'echelle-toit' : null
      if (lock) return cycleQuarterLock(lock, dir)
      ctxRef?.bus.emit('airlock:cycle', { lockId: id, dir, phase: 'done' })
      return Promise.resolve()
    },
    roomCeilingAt: (p) => {
      const l = toLocal(pose, p, tmp)
      const y = quarter?.ceilingAt(l) ?? city?.ceilingAt(l) ?? null
      return y === null ? null : y + pose.position.y
    },
    ceilingAt: (l) => quarter?.ceilingAt(l) ?? city?.ceilingAt(l) ?? null,
    lockAnchor: (lockId: LockId) => {
      const key = lockId === 'sas-ecluse' ? 'sas' : lockId
      const a = key === 'sas' || key === 'echelle-toit' ? LOCK_ANCHORS[key] : null
      return a ? toWorld(pose, a) : null
    },
    districtAt: (local) => cityCell(local)?.district ?? districtAt(local),
    cellAt: (local): CellId | null => localCell(local),
    cellSpawn: (cell) => {
      const s = spawnOf(cell)
      return s ? { local: { x: s.x, y: s.y, z: s.z }, yaw: s.yaw } : null
    },
    loadedDistricts: () => [...loaded],
    cameraEnv: () => camEnv,
    anchorsNear: (l, r) => {
      const out: DriftAnchor[] = city?.anchorsNear(l, r) ?? []
      for (const a of quarterAnchorList) if (anchorDist(a, l) <= r) out.push(a)
      return out
    },
    sites: () => (sitesCache ??= buildSites()),
    siteById: (id) => service.sites().all.find((s) => s.id === id) ?? null,
    visibleCells: () => visible,
    glassPortalsVisible: () => glassVisible,
    setValve: (id, open) => {
      ;(ctxRef?.bus as unknown as { emit(k: string, p: unknown): void } | undefined)?.emit('valve:changed', { id, open })
    },
    riding: () => false,
  }

  const updateCameraEnv = (st: GameContext['state']) => {
    const room = quarter?.roomAt(camLocal) ?? null
    const cc = room ? null : cityCell(camLocal)
    camEnv.district = cc?.district ?? districtAt(camLocal)
    camEnv.cell = room ?? cc?.id ?? null
    if (room && quarter?.mediumAt(camLocal) === 'air') {
      camEnv.indoor = 1
      camEnv.airHaze = ATRIUM_AIR[room] ?? 0
      let best = 30
      for (const g of glass.get(room) ?? []) best = Math.min(best, near3(g, camLocal))
      camEnv.glassDist = Math.max(0.5, best)
    } else if (cc) {
      camEnv.indoor = 1
      camEnv.airHaze = cc.air
      camEnv.glassDist = Math.max(1.5, cc.roof - camLocal.y)
    } else {
      const heroInside = st.mode === 'inside' && st.hero.medium === 'air' && !st.debug.cameraLocked
      camEnv.indoor = heroInside ? 1 : 0
      camEnv.airHaze = 0
      camEnv.glassDist = heroInside ? 4 : 0
    }
  }

  const levelLoad = (ctx: GameContext): number => {
    const q = ctx.quality.level
    return q === 'high' ? 99 : q === 'medium' ? 2 : 1
  }

  const inBounds = (l: Vec3) => l.x > DRIFT_BOUNDS.x0 - 2 && l.x < DRIFT_BOUNDS.x1 + 2 && l.z > DRIFT_BOUNDS.z0 - 2 && l.z < DRIFT_BOUNDS.z1 + 2 && l.y > DRIFT_BOUNDS.y0 - 6 && l.y < DRIFT_BOUNDS.y1 + 4

  const updateStreaming = (ctx: GameContext) => {
    const st = ctx.state
    const ref = st.mode === 'inside' && st.hero.localPosition ? st.hero.localPosition : heroLocal
    const here = cityCell(ref)?.district ?? districtAt(ref)
    if (here !== district && !inDistrict(DISTRICT_BY_ID[district], ref, 20)) {
      const from = district
      district = here
      st.hero.district = here
      ctx.bus.emit('district:entered', { district: here, from })
    }
    loaded.clear()
    loaded.add(district)
    for (const n of DISTRICT_NEIGHBOURS[district].slice(0, levelLoad(ctx))) loaded.add(n)
    loaded.add('ecluse')
    const key = [...loaded].sort().join(',')
    if (key !== loadedKey) {
      loadedKey = key
      hulls?.setLoaded(loaded)
      city?.setLoaded(loaded, pose)
      ctx.bus.emit('district:streamed', { loaded: [...loaded] })
    }
  }

  const updateCulling = (ctx: GameContext) => {
    const st = ctx.state
    const room = quarter?.roomAt(camLocal) ?? null
    const cc = room ? null : cityCell(camLocal)
    visibleDistricts.clear()
    let showQuarter = true
    let outside = false
    if (room) {
      visibleDistricts.add('ecluse')
      if (room === ('passerelle-nef' as RoomId) || room === 'cabines-voisins') visibleDistricts.add('nef')
      visible = [room]
      glassVisible = glass.has(room) ? 1 : 0
    } else if (cc) {
      city!.visibleFrom(cc, camLocal, visibleDistricts)
      showQuarter = visibleDistricts.has('ecluse')
      visible = city!.cells.filter((c) => c.id === cc.id || (visibleDistricts.has(c.district) && c.district === cc.district)).map((c) => c.id)
      glassVisible = city!.isGlass(cc.id) ? 1 : 0
    } else {
      outside = !inBounds(camLocal) || st.mode === 'sortie' || !nearCity(camLocal, 3)
      visible = []
      glassVisible = 1
    }
    const k = outside ? '*' : [...visibleDistricts].sort().join(',')
    if (k !== visibleKey) {
      visibleKey = k
      city?.setVisible(outside ? null : visibleDistricts)
      hulls?.setVisible(outside ? null : visibleDistricts)
    }
    if (quarter) quarter.root.visible = outside || showQuarter
  }

  const updateAltitude = (ctx: GameContext, dt: number) => {
    const st = ctx.state
    const target = st.act >= 3 ? Math.max(altitudeTarget, 80) : altitudeTarget
    const cur = st.drift.altitude || DRIFT_Y
    if (Math.abs(target - cur) < 1e-3) return
    const step = Math.sign(target - cur) * Math.min(Math.abs(target - cur), dt * 0.35 * Math.max(1, st.time.scale))
    st.drift.altitude = cur + step
  }

  const chatterUpdate = (ctx: GameContext, dt: number, indoor: boolean) => {
    if (!chatter) return
    const near: { id: string; world: THREE.Vector3; key: string; height: number }[] = []
    if (indoor && npcs) {
      tmpV.set(heroLocal.x, heroLocal.y, heroLocal.z)
      for (const n of npcs.nearby(tmpV, 3.5)) {
        const kid = n.id === 'mila' || n.id === 'tao' || n.id === 'pepin'
        near.push({ id: n.id, key: n.key, world: new THREE.Vector3().copy(toWorld(pose, n.pos)), height: kid ? 1.25 : 1.95 })
      }
    }
    if (indoor && city) {
      for (const id of city.folk.ids()) {
        const p = city.folk.position(id)
        if (p && near3(p, heroLocal) < 4) near.push({ id, key: id, world: new THREE.Vector3().copy(toWorld(pose, p)), height: 2.0 })
      }
      const cc = cityCell(heroLocal)
      if (cc) {
        for (const w of city.crowdNearby(heroLocal, 3.2, ctx.state.time.hours)) {
          near.push({ id: w.id, key: w.kid ? 'enfant' : `ville-${w.district}`, world: new THREE.Vector3().copy(toWorld(pose, w)), height: w.kid ? 1.3 : 1.95 })
        }
      }
    }
    chatter.update(dt, indoor, near, (windows?.coat('grande-vitre') ?? 0) > 0.55)
  }

  return {
    id: 'drift',
    init(ctx) {
      ctxRef = ctx
      mats = createMats(ctx)
      if (!ctx.state.drift.altitude) ctx.state.drift.altitude = DRIFT_Y
      altitudeTarget = ctx.state.act >= 3 || ctx.state.flags['lest-vide'] ? 80 : ctx.state.drift.altitude
      syncPose(ctx)
      lastProgress = ctx.state.drift.progress
      lastHeading = pose.heading
      ctx.scene.add(root)

      board = new ForecastBoard()
      board.draw(ctx.state.env, ctx.state.time.day)
      chart = new ChartTable()
      const textures = {
        floors: { bois: planksTexture(), tapis: planksTexture(), metal: gratingTexture() },
        board: board.texture,
        chart: chart.texture,
        drawings: drawingsTexture(),
      }

      quarter = new Quarter(ctx, mats, textures, pose)
      root.add(quarter.root)
      quarterAnchorList = quarterAnchors()
      try {
        city = new City(ctx, mats, root, pose)
      } catch (err) {
        console.error('[drift] city', err)
      }
      try {
        const c = city
        hulls = c
          ? new Hulls(ctx, mats, root, pose, c.build.hulls, c.build.reserved, c.insideHullMat, (h) => c.glowOfHull(h))
          : new Hulls(ctx, mats, root, pose, [], [], mats.cel({ color: 0xffffff, vertexColors: true, indoor: true }), () => ({ glow: [1, 1, 1], sky: 0 }))
      } catch (err) {
        console.error('[drift] hulls', err)
      }
      district = ctx.state.hero.localPosition ? districtAt(ctx.state.hero.localPosition) : ctx.state.hero.district
      windows = new Windows(ctx, mats, quarter, quarter.root)
      npcs = new Npcs(ctx, mats, quarter)
      quarter.root.add(npcs.group)
      chatter = new Chatter(ctx)

      const curve = new THREE.CatmullRomCurve3(GUIDE_ROPE.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
      const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.035, 5), mats.cel({ color: PAL.corde }))
      rope.name = 'corde-guide'
      root.add(rope)

      if (mats.fallback) {
        ctx.scene.add(new THREE.HemisphereLight(0xcfefe3, 0x3e3a5a, 1.1))
        const sun = new THREE.DirectionalLight(0xfff1c9, 1.2)
        sun.position.set(40, 120, 30)
        ctx.scene.add(sun)
        for (let i = 0; i < 4; i++) {
          const l = new THREE.PointLight(PAL.lampe, 0, 7, 1.6)
          ctx.scene.add(l)
          fallbackLights.push(l)
        }
      }

      registerDriftPoses(ctx, () => pose)
      ctx.services.drift = service

      const loose = ctx.bus as unknown as { on(k: string, fn: (p: never) => void): () => void }
      offs.push(ctx.bus.on('sleep:done', ({ fromHour, toHour }) => {
        const hours = (((toHour - fromHour) % 24) + 24) % 24
        ctx.state.drift.progress += hours * METERS_PER_GAME_HOUR
      }))
      offs.push(ctx.bus.on('weather:changed', ({ env }) => board?.draw(env, ctx.state.time.day)))
      offs.push(ctx.bus.on('time:hour', ({ day }) => board?.draw(ctx.state.env, day)))
      offs.push(ctx.bus.on('act:changed', ({ act }) => {
        board?.draw(ctx.state.env, ctx.state.time.day)
        if (act >= 3) altitudeTarget = 80
      }))
      offs.push(loose.on('drift:altitude', (p: { y: number }) => {
        altitudeTarget = p.y
      }))
      offs.push(ctx.bus.on('collectible:found', () => {
        sitesCache = null
      }))
    },

    update(dt, ctx) {
      if (!quarter) return
      const st = ctx.state
      st.drift.progress += METERS_PER_GAME_HOUR * st.time.scale * dt
      updateAltitude(ctx, dt)
      syncPose(ctx)
      const jumped = Math.abs(st.drift.progress - lastProgress) > 5
      lastProgress = st.drift.progress

      toLocal(pose, st.hero.position, heroLocal)
      const cp = ctx.camera.position
      toLocal(pose, { x: cp.x, y: cp.y, z: cp.z }, camLocal)

      updateCameraEnv(st)
      updateStreaming(ctx)
      updateCulling(ctx)
      hulls?.update(dt, pose, jumped)
      city?.update(dt, pose, jumped)
      quarter.update(dt, pose, heroLocal, camLocal, jumped)
      const inQuarter = quarter.roomAt(camLocal) !== null
      const cc = inQuarter ? null : cityCell(camLocal) ?? cityCell(heroLocal)
      if (city && cc) city.writeLamps({ x: cp.x, y: cp.y, z: cp.z }, cc)
      windows?.update(dt)
      npcs?.update(dt)
      chart?.update(dt, ctx, quarter.isDetailVisible('salle-des-cartes'))

      const indoor = st.hero.medium === 'air' && (quarter.roomAt(heroLocal) !== null || cityCell(heroLocal) !== null)
      creakIn -= dt
      groanCooldown -= dt
      if (indoor && creakIn <= 0) {
        creakIn = 8 + Math.random() * 12
        sfx(ctx, 'creak', st.hero.position)
      }
      let dh = pose.heading - lastHeading
      dh = Math.atan2(Math.sin(dh), Math.cos(dh))
      lastHeading = pose.heading
      if (indoor && dt > 0 && Math.abs(dh / dt) > 0.003 && groanCooldown <= 0) {
        groanCooldown = 25
        sfx(ctx, 'hull-groan', st.hero.position)
      }
      chatterUpdate(ctx, dt, indoor)

      if (fallbackLights.length > 0) {
        const lamps = quarter.nearestLamps(st.hero.position, fallbackLights.length)
        fallbackLights.forEach((l, i) => {
          const src = lamps[i]
          l.intensity = src && indoor ? 6 : 0
          if (src) {
            l.position.copy(src.position)
            l.color.copy(src.color)
          }
        })
      }
    },

    dispose() {
      for (const off of offs.splice(0)) off()
      chatter?.dispose()
      npcs?.dispose()
      quarter?.dispose()
      hulls?.dispose()
      city?.dispose()
      root.removeFromParent()
      if (ctxRef && ctxRef.services.drift === service) delete ctxRef.services.drift
    },
  }
}
