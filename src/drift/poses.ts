import type { DebugPose, DebugRegistry, GameContext, Vec3 } from '../core/types'
import type { DriftPose } from './frame'
import { toWorld, yawToWorld } from './frame'

interface LocalPose { hour: number; from: Vec3; to: Vec3; fov?: number; place?: string; hero?: Vec3 & { yaw: number } }

const POSES: Record<string, LocalPose> = {
  sas: { hour: 6.1, from: { x: -2.0, y: 1.8, z: 69.3 }, to: { x: 1.8, y: 1.2, z: 64.4 } },
  refectoire: { hour: 7.8, from: { x: 24.6, y: 3.4, z: 57.4 }, to: { x: 15, y: 1.0, z: 68 } },
  'refectoire-vitre': { hour: 7.8, from: { x: 19.2, y: 1.25, z: 66.4 }, to: { x: 18.4, y: 2.5, z: 76 }, fov: 60 },
  'refectoire-window': { hour: 7.6, from: { x: 18.2, y: 1.7, z: 58.6 }, to: { x: 18.2, y: 2.3, z: 72 }, fov: 60, place: 'refectoire' },
  'grande-vitre': { hour: 7.5, from: { x: 19.4, y: 1.3, z: 65.4 }, to: { x: 18.6, y: 2.6, z: 74 }, fov: 60, place: 'grande-vitre' },
  'atrium-vista': { hour: 9.5, from: { x: -26.8, y: 18.3, z: 28.6 }, to: { x: 6, y: 5, z: -16 }, fov: 64, place: 'nef-haut' },
  'nef-haut': { hour: 12, from: { x: -27.5, y: 17.9, z: 27.8 }, to: { x: 10, y: 10, z: -20 }, fov: 62, place: 'nef-haut' },
  nef: { hour: 10, from: { x: 1.8, y: 9.7, z: 27 }, to: { x: -2, y: 9, z: 0 }, fov: 60, place: 'nef' },
  'nef-place': { hour: 8.5, from: { x: 18, y: -4.2, z: 26 }, to: { x: -4, y: 4, z: -10 }, fov: 64, hero: { x: 16, y: -6, z: 24, yaw: -0.8 } },
  'marche-horloge': { hour: 10.5, from: { x: -95.5, y: 15.1, z: 44 }, to: { x: -86, y: 5, z: 12 }, fov: 62, hero: { x: -94, y: 13, z: 44, yaw: Math.PI } },
  'grand-marche': { hour: 11, from: { x: -88, y: 1.7, z: 1 }, to: { x: -88, y: 4, z: 40 }, fov: 60, hero: { x: -88, y: 0, z: 2.5, yaw: Math.PI } },
  'serre-cathedrale': { hour: 11, from: { x: 77.5, y: 8.8, z: 4 }, to: { x: 96, y: 7, z: 46 }, fov: 62, hero: { x: 76, y: 7, z: 6, yaw: Math.PI * 0.85 } },
  'tube-haut': { hour: 13, from: { x: -30, y: 28.6, z: 44.3 }, to: { x: 20, y: 26, z: 40 }, fov: 64, hero: { x: -28, y: 27, z: 44, yaw: Math.PI / 2 } },
  puits: { hour: 15, from: { x: 8.2, y: -8.6, z: 5.6 }, to: { x: -2, y: -21, z: -3 }, fov: 64, hero: { x: 9, y: -14, z: 5, yaw: -2.3 } },
  'dome-machines': { hour: 12, from: { x: 0.6, y: -24.7, z: 8.0 }, to: { x: 0.2, y: -40, z: 11 }, fov: 70, hero: { x: -1, y: -26.2, z: 8, yaw: Math.PI } },
  ateliers: { hour: 10, from: { x: -54.5, y: 6.2, z: -21.5 }, to: { x: -110, y: 3, z: -36 }, fov: 60, hero: { x: -57, y: 0, z: -30, yaw: -Math.PI / 2 } },
  scellees: { hour: 16, from: { x: 54.5, y: 5.2, z: -43 }, to: { x: 112, y: 2, z: -24 }, fov: 60, hero: { x: 58, y: 0, z: -30, yaw: Math.PI / 2 } },
  'proue-vigie': { hour: 9, from: { x: 0, y: 17.7, z: -61 }, to: { x: 0, y: 17.5, z: -95 }, fov: 60, hero: { x: -1, y: 16, z: -64, yaw: 0 } },
  'dome-proue': { hour: 9, from: { x: 0, y: 25.8, z: -56 }, to: { x: 0, y: 27, z: -90 }, fov: 64, hero: { x: 1, y: 24, z: -58, yaw: 0 } },
  'dome-ecluse': { hour: 7, from: { x: -4, y: 17.8, z: 44 }, to: { x: 6, y: 12, z: -20 }, fov: 62, hero: { x: -2, y: 16, z: 40, yaw: 0 } },
  'salle-des-cartes': { hour: 14, from: { x: 42.6, y: 2.1, z: 58.0 }, to: { x: 40, y: 0.9, z: 62 } },
  rebord: { hour: 9.5, from: { x: 20.8, y: 1.6, z: 68.0 }, to: { x: 17.5, y: 0.9, z: 71 } },
  cabine: { hour: 6.0, from: { x: -8.6, y: 1.6, z: 63.8 }, to: { x: -5.6, y: 0.8, z: 66.4 } },
  marche: { hour: 10.5, from: { x: -27.2, y: 2.3, z: 55.2 }, to: { x: -35, y: 1.0, z: 66 } },
  'drift-poupe': { hour: 7.6, from: { x: 30, y: 6, z: 100 }, to: { x: 5, y: 1, z: 66 }, fov: 55 },
  'drift-vitre': { hour: 7.75, from: { x: 18.5, y: 2.4, z: 79 }, to: { x: 18, y: 2.2, z: 66 }, fov: 55 },
  'drift-dehors': { hour: 9, from: { x: 170, y: 55, z: 150 }, to: { x: 0, y: 0, z: 0 }, fov: 50 },
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
        ...(p.hero ? { hero: { position: toWorld(d, p.hero), yaw: yawToWorld(d, p.hero.yaw) } } : {}),
        camera: { position: toWorld(d, p.from), target: toWorld(d, p.to), fov: p.fov ?? 60 },
      }
    }
    if (typeof reg.registerFactory === 'function') reg.registerFactory(name, make)
    else reg.registerPose(name, make(ctx))
  }
}
