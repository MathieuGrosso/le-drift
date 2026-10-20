import { Crowd, init, NavMeshQuery, type NavMesh, type OffMeshConnectionParams } from '@recast-navigation/core'
import { generateTiledNavMesh } from '@recast-navigation/generators'
import { NavMeshHelper } from '@recast-navigation/three'
import * as THREE from 'three'
import { NAV } from '../../core/tuning'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DriftNav, PhysicsWorld, Vec3, WalkReport } from '../../core/types'
import { colliderSoup, ladderLink, type NavLink } from './soup'

type LadderLike = Parameters<typeof ladderLink>[0]

function segmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz || 1)))
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z)
}

const voxels = (metres: number, size: number) => Math.ceil(metres / size)

// The Drift's walkable surface in Drift-local coordinates, shared by the crowd and gameplay brains.
export class DriftNavmesh implements DriftNav {
  readonly query: NavMeshQuery
  readonly polys: number

  private constructor(readonly navMesh: NavMesh) {
    this.query = new NavMeshQuery(navMesh, { maxNodes: NAV.queryNodes })
    this.query.defaultQueryHalfExtents = { ...NAV.snapExtent }
    let polys = 0
    for (let t = 0; t < navMesh.getMaxTiles(); t++) polys += navMesh.getTile(t).header()?.polyCount() ?? 0
    this.polys = polys
  }

  static async bake(physics: PhysicsWorld, bodies: readonly RAPIER.RigidBody[], links: readonly NavLink[]): Promise<DriftNavmesh> {
    await init()
    const soup = colliderSoup(physics, bodies)
    const offMeshConnections: OffMeshConnectionParams[] = links.map((l) => ({ startPosition: l.from, endPosition: l.to, radius: NAV.linkRadius, bidirectional: l.both }))
    const res = generateTiledNavMesh(soup.positions, soup.indices, {
      cs: NAV.cellSize,
      ch: NAV.cellHeight,
      tileSize: NAV.tileSize,
      walkableSlopeAngle: NAV.slopeDeg,
      walkableHeight: voxels(NAV.agentHeight, NAV.cellHeight),
      walkableClimb: voxels(NAV.agentClimb, NAV.cellHeight),
      walkableRadius: voxels(NAV.agentRadius, NAV.cellSize),
      maxEdgeLen: voxels(NAV.maxEdgeLen, NAV.cellSize),
      maxSimplificationError: NAV.simplifyError,
      minRegionArea: NAV.minRegionArea,
      mergeRegionArea: NAV.mergeRegionArea,
      offMeshConnections,
    })
    if (!res.success) throw new Error(`navmesh: ${res.error}`)
    return new DriftNavmesh(res.navMesh)
  }

  snap(p: Vec3): Vec3 | null {
    const r = this.query.findClosestPoint(p)
    return r.success && r.polyRef ? r.point : null
  }

  // Floor around a climbable support, ringed so the hollow inside of a box collider never counts as its foot.
  private feetAround(p: Vec3): Vec3[] {
    const { reach, depth, probes } = NAV.climbFoot
    const out: Vec3[] = []
    for (let i = 0; i < probes; i++) {
      const a = (i / probes) * Math.PI * 2
      const r = this.query.findClosestPoint({ x: p.x + Math.cos(a) * reach, y: p.y - depth / 2, z: p.z + Math.sin(a) * reach }, { halfExtents: { x: reach / 2, y: depth / 2, z: reach / 2 } })
      if (r.success && r.polyRef) out.push(r.point)
    }
    return out
  }

  private reaches(from: Vec3, to: Vec3): boolean {
    const end = this.path(from, to).at(-1)
    return !!end && Math.hypot(end.x - to.x, end.y - to.y, end.z - to.z) <= NAV.auditReach
  }

  path(from: Vec3, to: Vec3): Vec3[] {
    const r = this.query.computePath(from, to, { maxPathPolys: NAV.maxPathPolys, maxStraightPathPoints: NAV.maxPathPolys })
    return r.success ? r.path : []
  }

  // Unreachable = no path ends within pick-up reach of the target; off-mesh = the target has no floor under it.
  // A target on a ladder (a shaft with no floor) is reached through that ladder's foot, one on a climbable
  // prop through the floor at the prop's foot.
  audit(from: Vec3, targets: readonly { id: string; at: Vec3 }[], ladders: readonly LadderLike[] = [], climbable: (at: Vec3) => boolean = () => false): WalkReport {
    const report: WalkReport = { from, checked: targets.length, unreachable: [], offMesh: [] }
    for (const t of targets) {
      const ladder = ladders.find((l) => segmentDistance(t.at, l.bottom, l.top) <= NAV.auditReach)
      const snapped = this.snap(ladder ? ladderLink(ladder).from : t.at)
      const feet = snapped ? [snapped] : climbable(t.at) ? this.feetAround(t.at) : []
      if (feet.length === 0) report.offMesh.push(t)
      else if (!feet.some((f) => this.reaches(from, f))) report.unreachable.push(t)
    }
    return report
  }

  crowd(maxAgents: number): Crowd {
    return new Crowd(this.navMesh, { maxAgents, maxAgentRadius: NAV.agentRadius * 2 })
  }

  helper(): NavMeshHelper {
    const h = new NavMeshHelper(this.navMesh, { navMeshMaterial: new THREE.MeshBasicMaterial({ color: NAV.debugColor, transparent: true, opacity: 0.45, depthWrite: false }) })
    h.name = 'navmesh-debug'
    return h
  }

  dispose(): void {
    this.query.destroy()
    this.navMesh.destroy()
  }
}
