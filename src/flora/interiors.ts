import * as THREE from 'three'
import type { GameContext, QualityLevel } from '../core/types'
import { PlantGeo } from './plantgeo'
import { floorPlant, hangingBasket, railPlanter, shelfSprouts } from './plants'
import type { ShapeSpec } from './ship'
import { quarterPoint } from '../drift/interiors/scale'

interface Hang { x: number; z: number; hook: number; drop: number; r: number; vines: number; len: number }
interface Floor { x: number; y: number; z: number; scale: number }
interface Shelf { x0: number; x1: number; y: number; z: number; alongZ: boolean }

// Drift-local spots in the v1 quarter; hooks are re-snapped to drift's real ceiling when it answers.
const HANGS: readonly Hang[] = ([
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
] as const).map((h) => {
  const p = quarterPoint({ x: h.x, y: h.hook, z: h.z })
  return { ...h, x: p.x, z: p.z, hook: p.y }
})

const FLOORS: readonly Floor[] = [
  { x: 10.65, y: 0, z: 71.25, scale: 1.6 },
  { x: 25.35, y: 0, z: 71.25, scale: 1.6 },
  { x: 10.55, y: 0, z: 65.6, scale: 1.1 },
  { x: 25.4, y: 0, z: 64.6, scale: 1.2 },
  { x: -39.4, y: 0, z: 69.4, scale: 1.3 },
  { x: -26.65, y: 0, z: 55.0, scale: 1.2 },
  { x: 37.15, y: 0, z: 66.3, scale: 1.25 },
  { x: 18.0, y: 0.6, z: 71.55, scale: 0.45 },
].map((f) => quarterPoint(f))

const SHELVES: readonly Shelf[] = [
  { x0: 11.0, x1: 14.2, y: 2.22, z: 48.35, alongZ: false },
].map((s) => {
  const a = quarterPoint({ x: s.x0, y: s.y, z: s.z })
  return { ...s, x0: a.x, x1: a.x + (s.x1 - s.x0), y: a.y, z: a.z }
})

// Mirrors drift's Nef hall (city/world.ts NEF): gallery edges, levels and rail gaps, Drift-local.
const NEF = {
  x0: -36, x1: 36, z0: -36, z1: 36, D: 6.75, floor: -6, levels: [0, 8, 16],
  gaps: [
    ...([['w', 0, -1.6, 1.6], ['e', 0, -1.6, 1.6], ['n', 8, -1.6, 1.6], ['s', 8, -1.6, 1.6], ['w', 16, -1.6, 1.6], ['e', 16, -1.6, 1.6],
      ['s', 0, -15, -11], ['s', 0, 11, 15], ['w', 0, 8.4, 10.8], ['w', 8, -5.2, -2.8], ['e', 8, 5.6, 8], ['e', 16, 19.2, 21.6],
      ['e', 8, -13.8, -10], ['n', 8, 8, 13], ['n', 16, 8, 13], ['s', 0, 16, 21], ['s', 8, 16, 21], ['w', 16, 22, 29.3],
      ['s', 16, -29.3, -20], ['w', 8, 14, 17], ['w', 16, 14, 17], ['n', 0, -10.6, -9.4], ['n', 0, 21.4, 22.6], ['w', 0, 25.4, 26.6],
      ['s', 16, -9, 9]] as const),
  ].map(([side, y, u0, u1]) => ({ side, y, u0, u1 })),
} as const

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
  const step = level === 'high' ? 6 : level === 'medium' ? 8 : 11
  const keep = level === 'low' ? 0.6 : 0.8
  for (const y of NEF.levels) {
    const vineMax = Math.min(6.2, y - NEF.floor - 1.6)
    const top = y + 1.0
    for (const side of ['w', 'e', 'n', 's'] as const) {
      const along = side === 'n' || side === 's'
      const fixed = side === 'w' ? NEF.x0 + NEF.D : side === 'e' ? NEF.x1 - NEF.D : side === 'n' ? NEF.z0 + NEF.D : NEF.z1 - NEF.D
      const inward = side === 'w' || side === 'n' ? 1 : -1
      const u0 = (along ? NEF.x0 : NEF.z0) + NEF.D + 1.5
      const u1 = (along ? NEF.x1 : NEF.z1) - NEF.D - 1.5
      const gaps = NEF.gaps.filter((g) => g.side === side && g.y === y)
      for (let u = u0 + rng() * 2; u < u1; u += step * (0.8 + rng() * 0.4)) {
        if (rng() > keep) continue
        const len = 1.4 + rng() * 1.2
        if (gaps.some((g) => u + len / 2 > g.u0 - 0.4 && u - len / 2 < g.u1 + 0.4)) continue
        const off = fixed + inward * 0.22
        if (along) railPlanter(n, rng, u, top, off, false, len, 0, inward, vineMax)
        else railPlanter(n, rng, off, top, u, true, len, inward, 0, vineMax)
      }
    }
  }
  return { quarter: q.build(), nef: n.build(), colliders }
}
