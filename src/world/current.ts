import { BLEU_EDGE, CEILING_Y, LANES, SONDES, VENT_UPDRAFT } from '../core/layout'
import type { Vec3 } from '../core/types'
import { heightAt, smoothstep } from './terrain'

// Near the Drift the big lanes are felt by the whole city, not by a swimmer on its flank.
export function currentAt(p: Vec3, global: Vec3, drift: Vec3 | null = null): Vec3 {
  let vx = global.x
  let vy = global.y
  let vz = global.z
  let floor = Number.NaN
  let calm = 1
  let shelter = 0
  if (drift) {
    shelter = 1 - smoothstep(170, 280, Math.hypot(p.x - drift.x, p.z - drift.z))
    calm = 1 - shelter
  }
  for (const s of SONDES) calm = Math.min(calm, smoothstep(14, 34, Math.hypot(p.x - s.x, p.z - s.z)))

  for (const lane of LANES) {
    const half = lane.width / 2
    let best = Infinity
    let dx = 0
    let dz = 0
    for (let i = 0; i < lane.points.length - 1; i++) {
      const a = lane.points[i]!
      const b = lane.points[i + 1]!
      const abx = b.x - a.x
      const abz = b.z - a.z
      const len2 = abx * abx + abz * abz
      let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const ex = p.x - (a.x + abx * t)
      const ez = p.z - (a.z + abz * t)
      const d = ex * ex + ez * ez
      if (d < best) {
        best = d
        const l = Math.sqrt(len2)
        dx = abx / l
        dz = abz / l
      }
    }
    const d = Math.sqrt(best)
    if (d > half * 1.6) continue
    if (Number.isNaN(floor)) floor = heightAt(p.x, p.z)
    const w = (1 - smoothstep(half * 0.6, half * 1.6, d)) * (1 - smoothstep(floor + 45, floor + 80, p.y)) * calm
    vx += dx * lane.speed * w
    vz += dz * lane.speed * w
  }

  const rv = Math.hypot(p.x - VENT_UPDRAFT.x, p.z - VENT_UPDRAFT.z)
  if (rv < VENT_UPDRAFT.radius * 2) {
    const ventFloor = heightAt(VENT_UPDRAFT.x, VENT_UPDRAFT.z)
    const k = Math.max(0, (p.y - ventFloor) / (CEILING_Y - ventFloor))
    const radius = VENT_UPDRAFT.radius * (1 + 0.5 * k)
    const w = (1 - smoothstep(radius * 0.5, radius * 1.3, rv)) * smoothstep(ventFloor - 12, ventFloor + 2, p.y)
    vy += VENT_UPDRAFT.speed * w * (1 - 0.6 * smoothstep(0.85, 1, k))
  }

  if (shelter > 0 && drift) {
    vx *= 1 - 0.6 * shelter
    vz *= 1 - 0.6 * shelter
    vy -= 0.25 * shelter * smoothstep(drift.y - 26, drift.y - 40, p.y)
  }

  const south = smoothstep(BLEU_EDGE - 30, BLEU_EDGE + 40, p.z)
  const west = smoothstep(BLEU_EDGE - 30, BLEU_EDGE + 40, -p.x)
  vz -= south * 3
  vx += west * 3
  if (south > 0 || west > 0) vy += Math.max(south, west) * 1.2

  return { x: vx, y: vy, z: vz }
}
