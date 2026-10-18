import { PLACES } from './layout'
import type { DebugPose, DebugRegistry, GameContext, Vec3 } from './types'

export type PoseSource = DebugPose | ((ctx: GameContext) => DebugPose)

export interface PoseRegistry extends DebugRegistry {
  names(): string[]
  resolve(name: string, ctx: GameContext): DebugPose | null
  registerFactory(name: string, factory: (ctx: GameContext) => DebugPose): void
}

export function createPoseRegistry(): PoseRegistry {
  const poses = new Map<string, PoseSource>()
  const reg: PoseRegistry = {
    registerPose(name, pose) {
      poses.set(name, pose)
    },
    registerFactory(name, factory) {
      poses.set(name, factory)
    },
    names: () => [...poses.keys()],
    resolve(name, ctx) {
      const p = poses.get(name)
      if (!p) return null
      return typeof p === 'function' ? p(ctx) : p
    },
  }
  return reg
}

function forward(yaw: number): Vec3 {
  return { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) }
}

const fallbackPose = (ctx: GameContext): DebugPose => {
  const p = ctx.state.hero.position
  return { camera: { position: { x: p.x, y: p.y + 2, z: p.z + 4 }, target: { x: p.x, y: p.y + 1, z: p.z } } }
}

export function registerCorePoses(reg: PoseRegistry): void {
  reg.registerFactory('vista', (ctx) => reg.resolve('atrium-vista', ctx) ?? fallbackPose(ctx))
  reg.registerFactory('heros', (ctx) => {
    const drift = ctx.services.drift
    const pl = PLACES.coursive!
    if (!drift) return fallbackPose(ctx)
    const at = drift.toWorld(pl.local)
    const yaw = pl.yaw + drift.pose().heading
    const f = forward(yaw)
    return {
      hour: 9,
      place: 'coursive',
      camera: {
        position: { x: at.x + f.x * 2.2, y: at.y + 1.4, z: at.z + f.z * 2.2 },
        target: { x: at.x, y: at.y + 1.1, z: at.z },
        fov: 45,
      },
    }
  })
  reg.registerFactory('sortie', (ctx) => {
    const drift = ctx.services.drift
    if (!drift) return fallbackPose(ctx)
    const at = drift.toWorld(PLACES.sortie!.local)
    const eye = drift.toWorld({ x: 9, y: 4, z: 89 })
    const look = drift.toWorld({ x: 0, y: 1.5, z: 72 })
    return { hour: 7.2, place: 'sortie', camera: { position: eye, target: { x: (at.x + look.x) / 2, y: (at.y + look.y) / 2, z: (at.z + look.z) / 2 }, fov: 55 } }
  })
  reg.registerFactory('sortie-loin', (ctx) => {
    const drift = ctx.services.drift
    if (!drift) return fallbackPose(ctx)
    return {
      hour: 8,
      place: 'sortie',
      camera: { position: drift.toWorld({ x: 150, y: 22, z: 120 }), target: drift.toWorld({ x: 0, y: 0, z: 0 }), fov: 55 },
    }
  })
}
