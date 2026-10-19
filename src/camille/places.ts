import type { Vec3 } from '../core/types'
import type { Pose } from './anim'
import { quarterPoint } from '../core/layout'

export type Where = 'refectoire' | 'serres' | 'proue' | 'dodo'

export interface Spot { at: Vec3; yaw: number; pose: Pose }

// Yaw convention of the model: forward = (-sin yaw, 0, -cos yaw).
export const FACE_AFT = Math.PI
export const FACE_FORE = 0
export const faceDir = (dx: number, dz: number) => Math.atan2(-dx, -dz)

export const REFECTOIRE: Spot = { at: quarterPoint({ x: 18.0, y: 0, z: 67.3 }), yaw: FACE_AFT, pose: 'sip' }
export const FINALE_SOL: Spot = { at: quarterPoint({ x: 18.25, y: 0, z: 67.6 }), yaw: FACE_AFT, pose: 'talk' }
export const FINALE_VITRE: Spot = { at: quarterPoint({ x: 18.4, y: 0.6, z: 71.3 }), yaw: FACE_AFT, pose: 'hand-on-glass' }

// Les Serres hall (x 72..108, z -6..72): aisles run along z at x 86 and 94 between the beds.
export const SERRES_PTS: readonly Spot[] = [
  { at: { x: 86, y: 0, z: 10 }, yaw: -Math.PI / 2, pose: 'prune' },
  { at: { x: 86, y: 0, z: 30 }, yaw: Math.PI / 2, pose: 'prune' },
  { at: { x: 93, y: 0, z: 45.4 }, yaw: faceDir(1, -1.4), pose: 'look-hand' },
  { at: { x: 94, y: 0, z: 20 }, yaw: FACE_FORE, pose: 'pockets' },
  { at: { x: 86, y: 0, z: 56 }, yaw: -Math.PI / 2, pose: 'prune' },
]
export const POUSSE: Vec3 = { x: 94, y: 0, z: 44 }
export const BOCAUX: readonly Vec3[] = [
  { x: 86, y: 0.05, z: 12.5 },
  { x: 75.5, y: 7.05, z: 52 },
  { x: 104.5, y: 7.05, z: 24 },
]

export const COURSIVE: Spot = { at: { x: -10.4, y: 0, z: 60.3 }, yaw: faceDir(-0.8, 2.9), pose: 'pockets' }
export const COURSIVE_DEPART: readonly Vec3[] = [{ x: -2, y: 0, z: 60.4 }, { x: 11.5, y: 0, z: 60.8 }]
export const DODO: Spot = { at: { x: -17.6, y: 0, z: 56.9 }, yaw: FACE_AFT, pose: 'pockets' }
export const DEJEUNER: Spot = { at: quarterPoint({ x: 19.86, y: 0, z: 67.0 }), yaw: FACE_AFT, pose: 'sit' }
export const ETAGERE: Spot = { at: quarterPoint({ x: 24.75, y: 0, z: 70.3 }), yaw: faceDir(1, 0), pose: 'prune' }
export const ETAGERE_MEUBLE: Vec3 = quarterPoint({ x: 25.5, y: 0, z: 70.3 })

export const VIGIE_BANC: Vec3 = { x: 0, y: 16, z: -69.5 }
export const VIGIE_FINALE: Spot = { at: { x: -2.5, y: 16, z: -70.6 }, yaw: FACE_FORE, pose: 'look-up' }

export const CABINE_CADEAUX: Record<'feuille' | 'dessin' | 'ligne' | 'bocal', Vec3> = {
  feuille: quarterPoint({ x: -5.04, y: 1.5, z: 64.6 }),
  dessin: quarterPoint({ x: -5.04, y: 1.55, z: 65.4 }),
  ligne: quarterPoint({ x: -5.04, y: 1.5, z: 66.2 }),
  bocal: quarterPoint({ x: -5.45, y: 0.62, z: 66.6 }),
}

export function routine(hours: number): Where {
  const h = ((hours % 24) + 24) % 24
  if (h >= 22 || h < 6) return 'dodo'
  if (h >= 7.5 && h < 8.5) return 'refectoire'
  if (h >= 18.5) return 'proue'
  return 'serres'
}
