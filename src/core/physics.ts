import RAPIER from '@dimforge/rapier3d-compat'
import { PHYSICS } from './tuning'
import type { ColliderKind, ColliderTag, PhysicsWorld, RayHit, Vec3 } from './types'

export const GROUPS = { TERRAIN: 0x0001, HERO: 0x0002, FAUNA: 0x0004, TRIGGER: 0x0008 } as const

export function interactionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff)
}

export interface PhysicsRuntime {
  physics: PhysicsWorld
  step(dt: number): number
}

export async function createPhysics(): Promise<PhysicsRuntime> {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  world.timestep = PHYSICS.step
  const tags = new Map<number, ColliderTag>()
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })

  const physics: PhysicsWorld = {
    rapier: RAPIER,
    world,
    tag(collider, tag) {
      tags.set(collider.handle, tag)
    },
    untag(collider) {
      tags.delete(collider.handle)
    },
    tagOf(handle) {
      return tags.get(handle)
    },
    raycast(origin: Vec3, dir: Vec3, maxDist: number, opts?: { excludeKinds?: ColliderKind[] }): RayHit | null {
      const len = Math.hypot(dir.x, dir.y, dir.z)
      if (len === 0) return null
      ray.origin = { x: origin.x, y: origin.y, z: origin.z }
      ray.dir = { x: dir.x / len, y: dir.y / len, z: dir.z / len }
      const exclude = opts?.excludeKinds
      const predicate = exclude && exclude.length > 0
        ? (c: RAPIER.Collider) => {
            const t = tags.get(c.handle)
            return !t || !exclude.includes(t.kind)
          }
        : undefined
      const hit = world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, undefined, undefined, predicate)
      if (!hit) return null
      const d = hit.timeOfImpact
      const tag = tags.get(hit.collider.handle)
      return {
        point: { x: ray.origin.x + ray.dir.x * d, y: ray.origin.y + ray.dir.y * d, z: ray.origin.z + ray.dir.z * d },
        normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
        distance: d,
        handle: hit.collider.handle,
        ...(tag ? { tag } : {}),
      }
    },
    groups: { ...GROUPS },
  }

  let accumulator = 0
  return {
    physics,
    step(dt) {
      accumulator += dt
      let steps = 0
      while (accumulator >= PHYSICS.step && steps < PHYSICS.maxSubsteps) {
        world.step()
        accumulator -= PHYSICS.step
        steps++
      }
      if (steps === PHYSICS.maxSubsteps) accumulator = Math.min(accumulator, PHYSICS.step)
      return steps
    },
  }
}
