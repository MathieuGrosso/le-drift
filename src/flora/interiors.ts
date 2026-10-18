import * as THREE from 'three'
import { NEF_VOID } from '../core/layout'
import type { GameContext, QualityLevel } from '../core/types'
import { PlantGeo } from './plantgeo'
import { floorPlant, hangingBasket, railPlanter, shelfSprouts } from './plants'
import type { ShapeSpec } from './ship'

interface Hang { x: number; z: number; hook: number; drop: number; r: number; vines: number; len: number }
interface Floor { x: number; y: number; z: number; scale: number }
interface Shelf { x0: number; x1: number; y: number; z: number; alongZ: boolean }

// Drift-local spots in the v1 quarter; hooks are re-snapped to drift's real ceiling when it answers.
const HANGS: readonly Hang[] = [
  { x: -8.4, z: 66.6, hook: 2.9, drop: 0.3, r: 0.13, vines: 4, len: 0.9 },
  { x: -11.5, z: 61.25, hook: 3.1, drop: 0.25, r: 0.11, vines: 3, len: 0.7 },
  { x: -1.5, z: 61.25, hook: 3.1, drop: 0.25, r: 0.11, vines: 3, len: 0.75 },
  { x: 5.0, z: 62.75, hook: 3.1, drop: 0.25, r: 0.11, vines: 3, len: 0.6 },
  { x: 15.5, z: 63.3, hook: 7.75, drop: 1.8, r: 0.28, vines: 8, len: 1.7 },
  { x: 20.5, z: 63.3, hook: 7.75, drop: 1.6, r: 0.26, vines: 7, len: 1.5 },
  { x: 11.0, z: 63.6, hook: 7.6, drop: 2.3, r: 0.22, vines: 6, len: 1.4 },
  { x: 25.0, z: 63.6, hook: 7.6, drop: 2.2, r: 0.22, vines: 6, len: 1.4 },
  { x: 31.0, z: 62.0, hook: 2.85, drop: 0.15, r: 0.1, vines: 3, len: 0.45 },
  { x: 43.2, z: 66.0, hook: 3.95, drop: 0.5, r: 0.15, vines: 5, len: 1.0 },
  { x: -33.0, z: 56.2, hook: 6.3, drop: 1.4, r: 0.26, vines: 7, len: 1.5 },
  { x: -33.0, z: 68.4, hook: 6.3, drop: 1.3, r: 0.24, vines: 6, len: 1.3 },
  { x: 11.2, z: 50.0, hook: 3.95, drop: 0.6, r: 0.14, vines: 4, len: 0.8 },
]

const FLOORS: readonly Floor[] = [
  { x: 10.65, y: 0, z: 71.25, scale: 1.6 },
  { x: 25.35, y: 0, z: 71.25, scale: 1.6 },
  { x: 10.55, y: 0, z: 65.6, scale: 1.1 },
  { x: 25.4, y: 0, z: 64.6, scale: 1.2 },
  { x: -39.4, y: 0, z: 69.4, scale: 1.3 },
  { x: -26.65, y: 0, z: 55.0, scale: 1.2 },
  { x: 37.15, y: 0, z: 66.3, scale: 1.25 },
  { x: 18.0, y: 0.6, z: 71.55, scale: 0.45 },
]

const SHELVES: readonly Shelf[] = [
  { x0: 11.0, x1: 14.2, y: 2.22, z: 48.35, alongZ: false },
]

export interface InteriorBuild {
  quarter: THREE.BufferGeometry
  nef: THREE.BufferGeometry
  colliders: ShapeSpec[]
}

export function buildInteriors(ctx: GameContext, rng: () => number, level: QualityLevel): InteriorBuild {
  const drift = ctx.services.drift
  const q = new PlantGeo()
  const colliders: ShapeSpec[] = []
  for (const h of HANGS) {
    let hook = h.hook
    if (drift) {
      const w = drift.toWorld({ x: h.x, y: h.hook - 0.6, z: h.z })
      const c = drift.roomCeilingAt(w)
      if (c !== null) {
        const local = c - drift.pose().position.y
        if (local > h.hook - 1.5 && local < h.hook + 3) hook = local - 0.04
      }
    }
    hangingBasket(q, rng, new THREE.Vector3(h.x, hook, h.z), h.drop, h.r, h.vines, h.len)
  }
  for (const f of FLOORS) {
    floorPlant(q, rng, f.x, f.y, f.z, f.scale)
    if (f.scale > 0.8) colliders.push({ shape: 'cyl', x: f.x, y: f.y + 0.2 * f.scale, z: f.z, r: 0.24 * f.scale, hh: 0.2 * f.scale })
  }
  for (const s of SHELVES) shelfSprouts(q, rng, s.x0, s.x1, s.y, s.z, s.alongZ)

  const n = new PlantGeo()
  const V = NEF_VOID
  const step = level === 'high' ? 6.5 : level === 'medium' ? 8.5 : 12
  const keep = level === 'low' ? 0.55 : 0.75
  for (const y of [8, 16]) {
    const vineMax = y === 16 ? 5.2 : 5.8
    const top = y + 0.95
    for (const side of [-1, 1]) {
      const rx = side * (V.x1 - 4)
      for (let z = V.z0 + 4 + 2.5; z <= V.z1 - 4 - 2.5; z += step) {
        if (y === 16 && Math.abs(z) < 2.5) continue
        if (rng() > keep) continue
        const zz = z + (rng() - 0.5) * 1.5
        railPlanter(n, rng, rx - side * 0.25, top, zz, true, 1.5 + rng() * 1.2, -side, 0, vineMax)
      }
      const rz = side * (V.z1 - 4)
      for (let x = V.x0 + 4 + 2.5; x <= V.x1 - 4 - 2.5; x += step) {
        if (y === 8 && Math.abs(x) < 2.8) continue
        if (rng() > keep) continue
        const xx = x + (rng() - 0.5) * 1.5
        railPlanter(n, rng, xx, top, rz - side * 0.25, false, 1.5 + rng() * 1.2, 0, -side, vineMax)
      }
    }
  }
  return { quarter: q.build(), nef: n.build(), colliders }
}
