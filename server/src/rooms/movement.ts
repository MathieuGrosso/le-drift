import type { DistrictDef } from '../../../src/core/layout'
import { GUARDS } from '../config'

export interface Tracked {
  x: number
  y: number
  z: number
  at: number
  teleportAt: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Keeps a reported position inside the district box (plus margin, a sortie swims along the hull)
 * and under the speed cap. One jump past the cap is allowed per cooldown: sleep, tubes and scene
 * hand-offs teleport legitimately.
 */
export function constrainMove(prev: Tracked, p: readonly [number, number, number], box: DistrictDef, now: number): Tracked {
  const m = GUARDS.moveMarginM
  const x = clamp(p[0], box.x0 - m, box.x1 + m)
  const y = clamp(p[1], box.y0 - m, box.y1 + m)
  const z = clamp(p[2], box.z0 - m, box.z1 + m)
  const dx = x - prev.x
  const dy = y - prev.y
  const dz = z - prev.z
  const dist = Math.hypot(dx, dy, dz)
  const reach = GUARDS.moveSpeedMax * Math.max(0, now - prev.at) / 1000
  if (dist <= reach) return { x, y, z, at: now, teleportAt: prev.teleportAt }
  if (now - prev.teleportAt >= GUARDS.teleportCooldownMs) return { x, y, z, at: now, teleportAt: now }
  const k = reach / dist
  return { x: prev.x + dx * k, y: prev.y + dy * k, z: prev.z + dz * k, at: now, teleportAt: prev.teleportAt }
}
