import type { DebugPose, DebugRegistry, GameContext, Vec3 } from '../core/types'
import type { DriftPose } from './frame'
import { toWorld } from './frame'

interface LocalPose { hour: number; from: Vec3; to: Vec3; fov?: number; place?: string }

const POSES: Record<string, LocalPose> = {
  sas: { hour: 6.1, from: { x: -2.0, y: 1.8, z: 69.3 }, to: { x: 1.8, y: 1.2, z: 64.4 } },
  refectoire: { hour: 7.8, from: { x: 24.6, y: 3.4, z: 57.4 }, to: { x: 15, y: 1.0, z: 68 } },
  'refectoire-vitre': { hour: 7.8, from: { x: 19.2, y: 1.25, z: 66.4 }, to: { x: 18.4, y: 2.5, z: 76 }, fov: 60 },
  'refectoire-window': { hour: 7.6, from: { x: 18.2, y: 1.7, z: 58.6 }, to: { x: 18.2, y: 2.3, z: 72 }, fov: 60, place: 'refectoire' },
  'grande-vitre': { hour: 7.5, from: { x: 19.4, y: 1.3, z: 65.4 }, to: { x: 18.6, y: 2.6, z: 74 }, fov: 60, place: 'grande-vitre' },
  'atrium-vista': { hour: 9.5, from: { x: -26.2, y: 18.1, z: 28.4 }, to: { x: 8, y: 7, z: -18 }, fov: 62, place: 'nef-haut' },
  'nef-haut': { hour: 12, from: { x: -2, y: 17.6, z: 27.5 }, to: { x: 4, y: 2, z: -12 }, fov: 62, place: 'nef-haut' },
  nef: { hour: 10, from: { x: 1.8, y: 9.7, z: 27 }, to: { x: -2, y: 9, z: 0 }, fov: 60, place: 'nef' },
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
      return {
        hour: p.hour,
        ...(p.place ? { place: p.place } : {}),
        camera: { position: toWorld(d, p.from), target: toWorld(d, p.to), fov: p.fov ?? 60 },
      }
    }
    if (typeof reg.registerFactory === 'function') reg.registerFactory(name, make)
    else reg.registerPose(name, make(ctx))
  }
}
