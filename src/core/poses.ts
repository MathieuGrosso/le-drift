import { PLACES } from './layout'
import type { DebugPose, DebugRegistry, GameContext, Vec3 } from './types'
import { quarterPoint } from '../drift/interiors/scale'

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
    const pl = PLACES['grande-vitre']!
    if (!drift) return fallbackPose(ctx)
    const at = drift.toWorld(pl.local)
    const yaw = pl.yaw + drift.pose().heading
    const f = forward(yaw)
    return {
      hour: 9,
      place: 'grande-vitre',
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
    const eye = drift.toWorld(quarterPoint({ x: 9, y: 4, z: 89 }))
    const look = drift.toWorld(quarterPoint({ x: 0, y: 1.5, z: 72 }))
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

  registerArtPoses(reg)
}

const ART_ALIASES: Record<string, { base: string; hour?: number }> = {
  'art-atrium': { base: 'atrium-vista', hour: 10 },
  'art-refectoire': { base: 'refectoire-window', hour: 7.7 },
  'art-serre': { base: 'serre-cathedrale', hour: 11.5 },
  'art-sortie': { base: 'sortie', hour: 7.2 },
  'art-ilo': { base: 'heros', hour: 8 },
}

function registerArtPoses(reg: PoseRegistry): void {
  for (const [name, { base, hour }] of Object.entries(ART_ALIASES)) {
    reg.registerFactory(name, (ctx) => {
      const p = reg.resolve(base, ctx) ?? fallbackPose(ctx)
      return hour === undefined ? p : { ...p, hour }
    })
  }
  const local = (hour: number, from: Vec3, to: Vec3, fov: number, hero: Vec3 & { yaw: number }) => (ctx: GameContext): DebugPose => {
    const drift = ctx.services.drift
    if (!drift) return fallbackPose(ctx)
    return {
      hour,
      hero: { position: drift.toWorld(hero), yaw: hero.yaw + drift.pose().heading },
      camera: { position: drift.toWorld(from), target: drift.toWorld(to), fov },
    }
  }
  reg.registerFactory('art-cabine', local(5.9, quarterPoint({ x: -8.7, y: 1.75, z: 63.5 }), quarterPoint({ x: -6.2, y: 1.15, z: 65.15 }), 64, quarterPoint({ x: -7.15, y: 0, z: 66.5, yaw: Math.PI })))
  reg.registerFactory('art-cartes', local(15, quarterPoint({ x: 43.2, y: 1.3, z: 59.8 }), quarterPoint({ x: 39.72, y: 1.05, z: 61.77 }), 60, quarterPoint({ x: 43.5, y: 0, z: 58.9, yaw: -Math.PI / 2 })))
  reg.registerFactory('art-cuisine', local(7.2, quarterPoint({ x: 11.0, y: 1.6, z: 55.2 }), quarterPoint({ x: 16.0, y: 1.15, z: 49.4 }), 62, quarterPoint({ x: 12.0, y: 0, z: 50.2, yaw: Math.PI / 2 })))
  reg.registerFactory('art-marche', local(10.5, { x: -86.5, y: 2.6, z: 4 }, { x: -89, y: 3.2, z: 40 }, 60, { x: -87.2, y: 0, z: 9, yaw: Math.PI }))
}
