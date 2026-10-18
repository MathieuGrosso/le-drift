import { BLEU_EDGE, CEILING_Y, DRIFT_ROUTE, REGIONS } from '../core/layout'
import type { GameContext } from '../core/types'
import { fbm, smoothstep } from './noise'

export interface Ground {
  height(x: number, z: number): number
  upness(x: number, z: number): number
  outside(x: number, z: number): boolean
}

export function createGround(ctx: GameContext): Ground {
  return {
    height(x, z) {
      const w = ctx.services.world
      return w ? w.heightAt(x, z) : 0
    },
    upness(x, z) {
      const w = ctx.services.world
      if (!w) return 1
      return w.normalAt(x, z).y
    },
    outside(x, z) {
      const w = ctx.services.world
      if (w && w.regionAt(x, z) === 'bleu') return true
      return x < -BLEU_EDGE || z > BLEU_EDGE || x > BLEU_EDGE + 30 || z < -1010
    },
  }
}

function near(x: number, z: number, c: { x: number; z: number }, sigma: number): number {
  const dx = (x - c.x) / sigma
  const dz = (z - c.z) / sigma
  return Math.exp(-(dx * dx + dz * dz))
}

export function blancFactor(z: number): number {
  return smoothstep(-600, -720, z)
}

export function grassDensity(x: number, z: number, y: number, up: number): number {
  if (y > CEILING_Y - 8) return 0
  let d = 0.42 + 0.58 * near(x, z, REGIONS.prairie, 520)
  d *= 1 - 0.95 * near(x, z, REGIONS.cheminee, 230)
  d *= 1 - 0.55 * near(x, z, REGIONS.laminaires, 300)
  d *= 1 - 0.5 * near(x, z, REGIONS.coques, 220)
  d *= 1 - blancFactor(z)
  d *= smoothstep(0.78, 0.9, up)
  const patches = fbm(x / 70 + 13.1, z / 70 - 7.7, 911)
  d *= smoothstep(0.3, 0.52, patches + 0.12 * d)
  return Math.max(0, Math.min(1, d))
}

export function forestFactor(x: number, z: number): number {
  const dx = x - REGIONS.laminaires.x
  const dz = z - REGIONS.laminaires.z
  const r = Math.hypot(dx, dz) + (fbm(x / 120, z / 120, 77) - 0.5) * 90
  return 1 - smoothstep(290, 350, r)
}

export function forestEdge(x: number, z: number): number {
  const r = Math.hypot(x - REGIONS.laminaires.x, z - REGIONS.laminaires.z)
  return smoothstep(200, 270, r) * (1 - smoothstep(320, 360, r))
}

export function coralDensity(x: number, z: number): number {
  let d = 0.1
  d += 1.2 * blancFactor(z)
  d += 0.8 * near(x, z, REGIONS.pilier, 240)
  d += 0.6 * near(x, z, REGIONS.coques, 260)
  d += 0.8 * near(x, z, REGIONS.cheminee, 200)
  d += 0.06 * forestFactor(x, z)
  d *= 0.25 + 0.75 * smoothstep(0.35, 0.68, fbm(x / 50 - 3.3, z / 50 + 9.1, 4242))
  return Math.min(1, d)
}

export function ventFactor(x: number, z: number): number {
  return near(x, z, REGIONS.cheminee, 200)
}

export function distanceToDriftRoute(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < DRIFT_ROUTE.length - 1; i++) {
    const a = DRIFT_ROUTE[i]!
    const b = DRIFT_ROUTE[i + 1]!
    const abx = b.x - a.x
    const abz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)))
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)))
  }
  return best
}
