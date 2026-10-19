import { Crowd, init, NavMeshQuery, type NavMesh, type OffMeshConnectionParams } from '@recast-navigation/core'
import { generateTiledNavMesh } from '@recast-navigation/generators'
import { NavMeshHelper } from '@recast-navigation/three'
import * as THREE from 'three'
import { NAV } from '../../core/tuning'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DriftNav, PhysicsWorld, Vec3, WalkReport } from '../../core/types'
import { colliderSoup, type NavLink } from './soup'

const voxels = (metres: number, size: number) => Math.ceil(metres / size)

// The Drift's walkable surface in Drift-local coordinates, shared by the crowd and gameplay brains.
export class DriftNavmesh implements DriftNav {
  readonly query: NavMeshQuery
  readonly polys: number

  private constructor(readonly navMesh: NavMesh) {
    this.query = new NavMeshQuery(navMesh)
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

  path(from: Vec3, to: Vec3): Vec3[] {
    const r = this.query.computePath(from, to, { maxPathPolys: NAV.maxPathPolys, maxStraightPathPoints: NAV.maxPathPolys })
    return r.success ? r.path : []
  }

  // Unreachable = no path ends within reach of the target; off-mesh = the target has no floor under it.
  audit(from: Vec3, targets: readonly { id: string; at: Vec3 }[]): WalkReport {
    const report: WalkReport = { from, checked: targets.length, unreachable: [], offMesh: [] }
    for (const t of targets) {
      const snapped = this.snap(t.at)
      if (!snapped) {
        report.offMesh.push(t)
        continue
      }
      const end = this.path(from, snapped).at(-1)
      if (!end || Math.hypot(end.x - snapped.x, end.y - snapped.y, end.z - snapped.z) > NAV.crowd.waypointReach) report.unreachable.push(t)
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
