import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DistrictId, Vec3 } from '../../core/types'
import { GeoBuilder } from '../../drift/builder'
import { ATELIERS, SCELLEES } from '../../drift/city/world'
import { PAL } from '../../drift/palette'
import type { Anchor, ProcgenHost } from '../../drift/procgen-hook'
import type { ArrondissementId, Box, BuiltPart, CellSpec, ColliderSpec, DistrictShell, ShipPlan, Spot } from '../types'
import { BOOTH, NEF_ARRIVAL, NEF_HUB, NEF_LINES, PASSAGE } from './tuning'

// The core end walls the gates open through (docs/MONDE.md §3.1: drift owns the door, procgen the walk to it).
const HALL_EDGE: Partial<Record<DistrictId, number>> = { ateliers: ATELIERS.x0, scellees: SCELLEES.x1 }

export type RideTarget = { district: ArrondissementId } | { local: Spot }

export interface Piece {
  b: GeoBuilder
  glass: GeoBuilder
  colliders: ColliderSpec[]
  cells: CellSpec[]
  rides: Map<string, RideTarget>
  anchors: Anchor[]
}

export interface BuiltPiece extends BuiltPart {
  body: RAPIER.RigidBody | null
}

export const piece = (): Piece => ({ b: new GeoBuilder(), glass: new GeoBuilder(), colliders: [], cells: [], rides: new Map(), anchors: [] })

const token = (id: string) => id.replace(/[^a-z]/g, '')

export function booth(p: Piece, station: string, dest: string, at: Vec3, faceYaw: number, to: RideTarget): Box {
  const { r, height } = BOOTH
  const fx = Math.sin(faceYaw)
  const fz = -Math.cos(faceYaw)
  const brass = new THREE.Color(PAL.laiton)
  p.b.cyl(at.x, at.y + 0.08, at.z, r + 0.15, 0.16, brass.clone().multiplyScalar(0.9))
  p.b.cyl(at.x, at.y + height + 0.15, at.z, r + 0.15, 0.3, brass)
  const shell = new THREE.CylinderGeometry(r, r, height, 20, 1, true, faceYaw + Math.PI / 2 + 0.7, Math.PI * 2 - 1.4)
  p.b.add(shell, new THREE.Matrix4().makeTranslation(at.x, at.y + height / 2 + 0.1, at.z), brass.clone().multiplyScalar(0.75))
  p.b.add(shell, new THREE.Matrix4().makeTranslation(at.x, at.y + height / 2 + 0.1, at.z), new THREE.Color(PAL.boisOmbre).multiplyScalar(1.3), true)
  p.b.cyl(at.x, at.y + height + 1.9, at.z, 0.32, 3.4, brass.clone().multiplyScalar(0.85))
  const pane = new THREE.CylinderGeometry(r, r, height - 0.3, 12, 1, true, faceYaw + Math.PI / 2 - 0.7, 1.4)
  p.glass.add(pane, new THREE.Matrix4().makeTranslation(at.x, at.y + height / 2, at.z), new THREE.Color(0xcfefe3))
  p.glass.sphere(at.x + fx * (r + 0.05), at.y + 2.5, at.z + fz * (r + 0.05), 0.1, 0.1, 0.1, new THREE.Color(0x8fe0a0).multiplyScalar(1.5))
  const id = `tube-${token(station)}-${token(dest)}`
  p.colliders.push({ kind: 'wall', climbable: true, x: at.x, y: at.y + height / 2 + 0.1, z: at.z, hx: r * 0.7, hy: height / 2, hz: r * 0.7 })
  p.colliders.push({ kind: 'door', climbable: false, ownerId: id, x: at.x + fx * (r + 0.05), y: at.y + 1.2, z: at.z + fz * (r + 0.05), hx: BOOTH.reach, hy: 1, hz: BOOTH.reach })
  p.rides.set(id, to)
  p.anchors.push({ kind: 'tube', id, at: { ...at }, station: token(station) })
  return { x0: at.x - BOOTH.side / 2, x1: at.x + BOOTH.side / 2, y0: at.y, y1: at.y + height + 4, z0: at.z - BOOTH.side / 2, z1: at.z + BOOTH.side / 2 }
}

// Glazed walk from a core hall end wall to the arrondissement's gate, over the gap between the hulls.
function passage(p: Piece, ship: ShipPlan): void {
  for (const plan of ship.districts) {
    for (const port of plan.ports) {
      const wall = port.core ? HALL_EDGE[port.to as DistrictId] : undefined
      if (wall === undefined) continue
      const s = Math.sign(port.at.x)
      const xa = wall - s * 0.3
      const xb = port.at.x + s * PASSAGE.overlap
      const x0 = Math.min(xa, xb)
      const x1 = Math.max(xa, xb)
      const cx = (x0 + x1) / 2
      const len = x1 - x0
      const { y, z } = port.at
      const half = PASSAGE.width / 2
      const h = PASSAGE.height
      const sol = new THREE.Color(PAL.boisOmbre).lerp(new THREE.Color(PAL.laiton), 0.35)
      const brass = new THREE.Color(PAL.laiton)
      p.b.box(cx, y - PASSAGE.slab / 2, z, len, PASSAGE.slab, PASSAGE.width + 0.4, sol)
      p.colliders.push({ kind: 'floor', climbable: false, x: cx, y: y - PASSAGE.slab / 2, z, hx: len / 2, hy: PASSAGE.slab / 2, hz: half + 0.2 })
      for (const side of [-1, 1]) {
        const wz = z + side * (half + 0.1)
        p.glass.box(cx, y + h / 2, wz, len, h, 0.06, new THREE.Color(PAL.clair))
        p.colliders.push({ kind: 'glass', climbable: false, x: cx, y: y + h / 2, z: wz, hx: len / 2, hy: h / 2, hz: 0.1 })
        p.b.box(cx, y + 1.05, wz - side * 0.06, len, 0.07, 0.07, brass)
        for (let x = x0; x <= x1 + 0.01; x += PASSAGE.postEvery) p.b.box(x, y + h / 2, wz, 0.1, h, 0.14, brass)
      }
      p.glass.box(cx, y + h + 0.05, z, len, 0.06, PASSAGE.width + 0.2, new THREE.Color(PAL.clair))
      p.colliders.push({ kind: 'hull', climbable: false, x: cx, y: y + h + 0.1, z, hx: len / 2, hy: 0.1, hz: half + 0.2 })
      for (let x = x0; x <= x1 + 0.01; x += PASSAGE.postEvery) p.b.box(x, y + h + 0.1, z, 0.12, 0.12, PASSAGE.width + 0.3, brass)
      p.glass.sphere(cx, y + h - 0.35, z, 0.22, 0.22, 0.22, new THREE.Color(0xffd9a0).multiplyScalar(1.4))
      p.cells.push({
        id: `${plan.id}/passage`, district: plan.id, quartier: port.to as DistrictId, deck: 'principal', nom: null,
        boxes: [{ x0, x1, y0: y - 0.5, y1: y + h, z0: z - half, z1: z + half }],
        roof: y + h, air: PASSAGE.air, glass: true,
        spawn: { x: cx, y, z, yaw: s > 0 ? Math.PI / 2 : -Math.PI / 2 },
      })
    }
  }
}

function nefLines(p: Piece): void {
  for (const line of NEF_LINES) booth(p, 'nef', line.token, { x: line.x, y: NEF_HUB.y, z: NEF_HUB.z }, NEF_HUB.faceYaw, { district: line.to })
}

// The way home from every arrondissement: a booth beside its main entrance, back to the Nef hub.
export function returnBooth(p: Piece, shell: DistrictShell): Box {
  const sp = shell.cells.find((c) => c.id === shell.plan.id)!.spawn
  const rx = Math.cos(sp.yaw)
  const rz = Math.sin(sp.yaw)
  const at = { x: sp.x + rx * BOOTH.side, y: sp.y, z: sp.z + rz * BOOTH.side }
  return booth(p, shell.plan.id, 'nef', at, Math.atan2(-rx, rz), { local: NEF_ARRIVAL })
}

export function staticLiaisons(ship: ShipPlan): Piece {
  const p = piece()
  passage(p, ship)
  nefLines(p)
  return p
}

export function buildPiece(p: Piece, host: ProcgenHost, name: string, onto: RAPIER.RigidBody | null): BuiltPiece {
  const physics = host.ctx.physics
  const R = physics.rapier
  const group = new THREE.Group()
  group.name = name
  const geos: THREE.BufferGeometry[] = []
  const add = (gb: GeoBuilder, mat: THREE.Material) => {
    if (gb.vertexCount === 0) return
    const geo = gb.build()
    geos.push(geo)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.matrixAutoUpdate = false
    group.add(mesh)
  }
  add(p.b, host.mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, side: THREE.DoubleSide }))
  add(p.glass, host.mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, emissive: 0x6a8a80 }))
  let body = onto
  if (!body) {
    const pose = host.pose()
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.heading)
    body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }))
  }
  const cols: RAPIER.Collider[] = []
  for (const c of p.colliders) {
    const desc = R.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z).setCollisionGroups(host.terrainGroups)
    const col = physics.world.createCollider(desc, body)
    physics.tag(col, { kind: c.kind, climbable: c.climbable, ...(c.ownerId ? { ownerId: c.ownerId } : {}) })
    cols.push(col)
  }
  const own = onto ? null : body
  return {
    group,
    body: own,
    stats: { draws: group.children.length, triangles: geos.reduce((s, g) => s + (g.index ? g.index.count / 3 : 0), 0), geometries: geos.length, buildMs: 0 },
    dispose() {
      group.removeFromParent()
      for (const g of geos) g.dispose()
      try {
        for (const c of cols) physics.untag(c)
        if (own) physics.world.removeRigidBody(own)
        else for (const c of cols) physics.world.removeCollider(c, false)
      } catch {
        /* world already torn down */
      }
    },
  }
}
