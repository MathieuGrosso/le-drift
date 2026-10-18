import { REGIONS, VISTA } from './layout'
import type { DebugPose, DebugRegistry, GameContext, Vec3 } from './types'

export type PoseSource = DebugPose | ((ctx: GameContext) => DebugPose)

export interface PoseRegistry extends DebugRegistry {
  names(): string[]
  resolve(name: string, ctx: GameContext): DebugPose | null
  registerFactory(name: string, factory: (ctx: GameContext) => DebugPose): void
}

export function createPoseRegistry(): PoseRegistry {
  const poses = new Map<string, PoseSource>()
  return {
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
}

const ground = (ctx: GameContext, x: number, z: number) => ctx.services.world?.heightAt(x, z) ?? 0

function forward(yaw: number): Vec3 {
  return { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) }
}

export function registerCorePoses(reg: PoseRegistry): void {
  reg.registerFactory('vista', (ctx) => {
    const { x, z, yaw } = VISTA.hero
    const y = ctx.services.world ? ground(ctx, x, z) : VISTA.ridgeY
    const f = forward(yaw)
    const r = { x: Math.cos(yaw), z: Math.sin(yaw) }
    return {
      hour: 6.5,
      hero: { position: { x, y, z }, yaw },
      camera: {
        position: { x: x - f.x * 5 + r.x * 1.0, y: y + 1.2 + 1.5, z: z - f.z * 5 + r.z * 1.0 },
        target: { x: x + f.x * 60, y: y - 4, z: z + f.z * 60 },
        fov: 55,
      },
    }
  })
  reg.registerFactory('drift-vitre', (ctx) => {
    const d = ctx.services.drift?.pose() ?? { position: ctx.state.drift.position, heading: ctx.state.drift.heading }
    const f = forward(d.heading)
    const p = d.position
    return {
      hour: 7.75,
      camera: {
        position: { x: p.x + f.x * 110, y: p.y + 2, z: p.z + f.z * 110 },
        target: { x: p.x + f.x * 80, y: p.y, z: p.z + f.z * 80 },
        fov: 55,
      },
    }
  })
  reg.registerFactory('laminaires', (ctx) => {
    const { x, z } = REGIONS.laminaires
    const y = ground(ctx, x, z)
    return {
      hour: 12,
      hero: { position: { x, y, z }, yaw: 0 },
      camera: { position: { x: x + 3, y: y + 3, z: z + 7 }, target: { x, y: y + 25, z: z - 30 }, fov: 55 },
    }
  })
  reg.registerFactory('cheminee', (ctx) => {
    const { x, z } = REGIONS.cheminee
    const cx = x - 70
    const cz = z + 70
    const y = ground(ctx, cx, cz)
    return {
      hour: 12,
      camera: { position: { x: cx, y: y + 4, z: cz }, target: { x, y: 90, z }, fov: 55 },
    }
  })
  reg.registerFactory('blanc', (ctx) => {
    const { x, z } = REGIONS.blanc
    const y = ground(ctx, x, z)
    return {
      hour: 12,
      hero: { position: { x, y, z }, yaw: 0 },
      camera: { position: { x: x + 1, y: y + 2.7, z: z + 5 }, target: { x, y: y + 8, z: z - 80 }, fov: 55 },
    }
  })
  reg.registerFactory('plafond', (ctx) => {
    const x = 0
    const z = 600
    const y = ground(ctx, x, z) + 20
    return {
      hour: 12,
      camera: { position: { x, y, z }, target: { x: 0.01, y: y + 100, z: z - 0.5 }, fov: 70 },
    }
  })
  reg.registerFactory('heros', (ctx) => {
    const { x, z, yaw } = VISTA.hero
    const y = ctx.services.world ? ground(ctx, x, z) : VISTA.ridgeY
    const f = forward(yaw)
    return {
      hour: 9,
      hero: { position: { x, y, z }, yaw },
      camera: {
        position: { x: x + f.x * 2.4, y: y + 1.4, z: z + f.z * 2.4 },
        target: { x, y: y + 1.1, z },
        fov: 45,
      },
    }
  })
}
