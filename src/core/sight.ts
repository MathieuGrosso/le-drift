import type { ColliderKind, PhysicsWorld, Vec3 } from './types'

const SEE_THROUGH: ColliderKind[] = ['trigger', 'fauna', 'glass', 'window', 'prop', 'seat', 'kelp', 'net']

// Cast from the speaker, so the first untagged hit is the hero's capsule, which never hides anyone.
export function hiddenFrom(physics: PhysicsWorld, eye: Vec3, at: Vec3): boolean {
  const dir = { x: eye.x - at.x, y: eye.y - at.y, z: eye.z - at.z }
  const d = Math.hypot(dir.x, dir.y, dir.z)
  if (d < 0.5) return false
  return physics.raycast(at, dir, d - 0.3, { excludeKinds: SEE_THROUGH })?.tag !== undefined
}
