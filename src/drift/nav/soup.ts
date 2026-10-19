import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { NAV } from '../../core/tuning'
import type { ColliderKind, PhysicsWorld, Vec3 } from '../../core/types'

export interface NavSoup { positions: number[]; indices: number[] }
export interface NavLink { from: Vec3; to: Vec3; both: boolean }

export function ladderLink(l: { bottom: Vec3; top: Vec3; normal: Vec3 }): NavLink {
  return { from: { x: l.bottom.x + l.normal.x * NAV.ladderFoot, y: l.bottom.y, z: l.bottom.z + l.normal.z * NAV.ladderFoot }, to: l.top, both: true }
}

const BOX_SIDES = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]
const BOX_TOP = [2, 6, 3, 3, 6, 7]
// Only these get a top face: furniture, walls and glass block the crowd without becoming islands on top.
const FLOORS: ReadonlySet<ColliderKind> = new Set<ColliderKind>(['floor', 'stair', 'interior', 'hull', 'net', 'terrain'])
const SKIP: ReadonlySet<ColliderKind> = new Set<ColliderKind>(['door', 'trigger', 'ladder', 'fauna', 'hull-outside'])
const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _one = new THREE.Vector3(1, 1, 1)

// Box colliders of the given bodies in their parent frame (Drift-local), loaded or not.
export function colliderSoup(physics: PhysicsWorld, bodies: readonly RAPIER.RigidBody[]): NavSoup {
  const R = physics.rapier
  const soup: NavSoup = { positions: [], indices: [] }
  for (const body of bodies) {
    for (let i = 0; i < body.numColliders(); i++) {
      const c = body.collider(i)
      if (c.isSensor()) continue
      const kind = physics.tagOf(c.handle)?.kind
      if (kind && SKIP.has(kind)) continue
      const shape = c.shape
      if (shape.type !== R.ShapeType.Cuboid && shape.type !== R.ShapeType.RoundCuboid) continue
      const h = (shape as RAPIER.Cuboid).halfExtents
      const r = shape.type === R.ShapeType.RoundCuboid ? (shape as RAPIER.RoundCuboid).borderRadius : 0
      const t = c.translationWrtParent()
      const q = c.rotationWrtParent()
      if (!t || !q) continue
      _m.compose(_v.set(t.x, t.y, t.z), _q.set(q.x, q.y, q.z, q.w), _one)
      const base = soup.positions.length / 3
      for (let k = 0; k < 8; k++) {
        _v.set(k & 1 ? h.x + r : -h.x - r, k & 2 ? h.y + r : -h.y - r, k & 4 ? h.z + r : -h.z - r).applyMatrix4(_m)
        soup.positions.push(_v.x, _v.y, _v.z)
      }
      for (const idx of BOX_SIDES) soup.indices.push(base + idx)
      if (!kind || FLOORS.has(kind)) for (const idx of BOX_TOP) soup.indices.push(base + idx)
    }
  }
  return soup
}
