import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { CameraEnv, DeckId, DistrictId, GameContext, Medium, RoomId, Vec3 } from '../core/types'
import type { DriftAnchor, DriftServiceV2 } from './index'
import { toLocal, toWorld, yawToWorld, type DriftPose } from './frame'
import type { Mats } from './materials'
import type { DriftNavmesh } from './nav/navmesh'
import type { NavLink } from './nav/soup'
import type { ChartEntry } from '../procgen/types'

export type { Anchor } from './city/kit'
export type { DriftPose } from './frame'
export type { Mats } from './materials'
export type { DriftNavmesh } from './nav/navmesh'
export type { NavLink } from './nav/soup'

// What drift lends to src/procgen (docs/MONDE.md §4.1).
export interface ProcgenHost {
  readonly ctx: GameContext
  readonly root: THREE.Object3D
  readonly mats: Mats
  readonly terrainGroups: number
  pose(): DriftPose
  bakeNav(bodies: readonly RAPIER.RigidBody[], links: readonly NavLink[]): Promise<DriftNavmesh>
}

export interface ProcgenCell {
  id: string
  district: string
  quartier: DistrictId
  deck: DeckId
  roof: number
  air: number
  glass: boolean
}

// What src/procgen gives back.
export interface ProcgenWorld {
  update(dt: number, heroLocal: Vec3, camLocal: Vec3): void
  cellAt(local: Vec3, margin?: number): ProcgenCell | null
  spawn(id: string): { x: number; y: number; z: number; yaw: number } | null
  anchorsNear(local: Vec3, r: number): DriftAnchor[]
  glassVisible(): number
  nav(district: string): DriftNavmesh | null
  ride(id: string): boolean
  chart(): readonly ChartEntry[]
  dispose(): void
}

export interface ProcgenAware { procgen?(): ProcgenWorld | null }

export interface ProcgenSlot {
  update(dt: number, heroLocal: Vec3, camLocal: Vec3): void
  dispose(): void
}

const MEDIUM_MARGIN = 0.9

export function mountProcgen(ctx: GameContext, root: THREE.Object3D, mats: Mats, pose: () => DriftPose, service: DriftServiceV2 & ProcgenAware): ProcgenSlot {
  let world: ProcgenWorld | null = null
  let disposed = false
  let camCell: ProcgenCell | null = null
  const env: CameraEnv = { indoor: 1, glassDist: 4, airHaze: 0, district: null, cell: null }
  const tmp: Vec3 = { x: 0, y: 0, z: 0 }
  const local = (p: Vec3) => toLocal(pose(), p, tmp)

  if (!new URLSearchParams(location.search).has('noprocgen')) {
    const host: ProcgenHost = {
      ctx, root, mats, pose,
      terrainGroups: ((ctx.physics.groups.TERRAIN & 0xffff) << 16) | 0xffff,
      bakeNav: async (bodies, links) => (await import('./nav/navmesh')).DriftNavmesh.bake(ctx.physics, bodies, links),
    }
    import('../procgen')
      .then(({ createProcgen }) => {
        if (!disposed) world = createProcgen(host)
      })
      .catch((err) => console.error('[drift] procgen', err))
  }

  const s = { ...service }
  service.procgen = () => world
  service.cellAt = (l) => s.cellAt(l) ?? world?.cellAt(l)?.id ?? null
  service.roomAt = (p) => s.roomAt(p) ?? ((world?.cellAt(local(p))?.id ?? null) as RoomId | null)
  service.cellSpawn = (cell) => {
    const hit = s.cellSpawn(cell)
    if (hit) return hit
    const w = world?.spawn(cell)
    return w ? { local: { x: w.x, y: w.y, z: w.z }, yaw: w.yaw } : null
  }
  service.roomSpawn = (room) => {
    const w = world?.spawn(room)
    return w ? { position: toWorld(pose(), w), yaw: yawToWorld(pose(), w.yaw) } : s.roomSpawn(room)
  }
  service.ceilingAt = (l) => s.ceilingAt(l) ?? world?.cellAt(l)?.roof ?? null
  service.roomCeilingAt = (p) => {
    const hit = s.roomCeilingAt(p)
    if (hit !== null) return hit
    const roof = world?.cellAt(local(p))?.roof
    return roof === undefined ? null : roof + pose().position.y
  }
  service.anchorsNear = (l, r) => {
    const out = s.anchorsNear(l, r)
    if (world) out.push(...world.anchorsNear(l, r))
    return out
  }
  service.mediumAt = (p): Medium => (world?.cellAt(local(p), MEDIUM_MARGIN) ? 'air' : s.mediumAt(p))
  service.districtAt = (l) => world?.cellAt(l)?.quartier ?? s.districtAt(l)
  service.cameraEnv = () => (camCell ? env : s.cameraEnv())
  service.openDoor = (id, open) => {
    if (!world?.ride(id)) s.openDoor(id, open)
  }
  service.glassPortalsVisible = () => (camCell ? world?.glassVisible() ?? 0 : s.glassPortalsVisible())

  return {
    update(dt, heroLocal, camLocal) {
      if (!world) return
      world.update(dt, heroLocal, camLocal)
      camCell = world.cellAt(camLocal)
      if (!camCell) return
      env.indoor = 1
      env.airHaze = camCell.air
      env.glassDist = Math.max(1.5, camCell.roof - camLocal.y)
      env.district = camCell.quartier
      env.cell = camCell.id
    },
    dispose() {
      disposed = true
      world?.dispose()
      world = null
      camCell = null
      Object.assign(service, s)
      delete service.procgen
    },
  }
}
