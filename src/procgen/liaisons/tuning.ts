import type { Vec3 } from '../../core/types'
import type { ArrondissementId } from '../types'

export const PASSAGE = { width: 3.6, height: 3.4, slab: 0.3, overlap: 0.6, postEvery: 1.5, air: 0.2 }

export const BOOTH = { r: 0.85, height: 2.6, side: 3.2, reach: 0.45 }

// Gameplay's prompt shows the token after `tube-<station>-`, so tokens are one plain French word.
export const NEF_LINES: readonly { token: string; to: ArrondissementId; x: number }[] = [
  { token: 'quais', to: 'quais-babord', x: -24 },
  { token: 'forges', to: 'forges', x: -18 },
  { token: 'viviers', to: 'viviers', x: 18 },
  { token: 'fumoir', to: 'fumoir', x: 24 },
]
export const NEF_HUB = { y: -6, z: -24.5, faceYaw: Math.PI }
export const NEF_ARRIVAL: Vec3 & { yaw: number } = { x: 0, y: -6, z: -21, yaw: Math.PI }
export const RIDE_ACT = 2
