import type { DebugPose, DebugRegistry, GameContext, Vec3 } from '../core/types'
import type { DriftPose } from './frame'
import { toWorld } from './frame'

interface LocalPose { hour: number; from: Vec3; to: Vec3; fov?: number }

const POSES: Record<string, LocalPose> = {
  sas: { hour: 6.1, from: { x: -2.0, y: 1.8, z: 69.3 }, to: { x: 1.8, y: 1.2, z: 64.4 } },
  refectoire: { hour: 7.8, from: { x: 24.6, y: 3.4, z: 57.4 }, to: { x: 15, y: 1.0, z: 68 } },
  'refectoire-vitre': { hour: 7.8, from: { x: 19.2, y: 1.25, z: 66.4 }, to: { x: 18.4, y: 2.5, z: 76 }, fov: 60 },
  rebord: { hour: 9.5, from: { x: 20.8, y: 1.6, z: 68.0 }, to: { x: 17.5, y: 0.9, z: 71 } },
  'salle-des-cartes': { hour: 14, from: { x: 42.6, y: 2.1, z: 58.0 }, to: { x: 40, y: 0.9, z: 62 } },
  cabine: { hour: 6.0, from: { x: -8.6, y: 1.6, z: 63.8 }, to: { x: -5.6, y: 0.8, z: 66.4 } },
  marche: { hour: 10.5, from: { x: -27.2, y: 2.3, z: 55.2 }, to: { x: -35, y: 1.0, z: 66 } },
  'drift-poupe': { hour: 7.6, from: { x: 30, y: 6, z: 100 }, to: { x: 5, y: 1, z: 66 }, fov: 55 },
  'drift-vitre': { hour: 7.75, from: { x: 18.5, y: 2.4, z: 79 }, to: { x: 18, y: 2.2, z: 66 }, fov: 55 },
}

type Factory = (ctx: GameContext) => DebugPose
type WithFactory = DebugRegistry & { registerFactory?: (name: string, f: Factory) => void }

export function registerDriftPoses(ctx: GameContext, pose: () => DriftPose): void {
  const reg = ctx.services.debug as WithFactory
  for (const [name, p] of Object.entries(POSES)) {
    const make: Factory = () => {
      const d = pose()
      return { hour: p.hour, camera: { position: toWorld(d, p.from), target: toWorld(d, p.to), fov: p.fov ?? 60 } }
    }
    if (typeof reg.registerFactory === 'function') reg.registerFactory(name, make)
    else reg.registerPose(name, make(ctx))
  }
}
