import type { Vec3 } from '../../core/types'

export const QUARTER_SCALE = 1.6
export const WALL_T = 0.2

export interface Footprint {
  x0: number; x1: number; z0: number; z1: number
  floorY: number
  wallH: number
  archH: number
  roof: 'arch' | 'flat'
  axis: 'x' | 'z'
}

const F = (x0: number, x1: number, z0: number, z1: number, floorY: number, wallH: number, archH: number, axis: 'x' | 'z' = 'x'): Footprint =>
  ({ x0, x1, z0, z1, floorY, wallH, archH, roof: archH > 0 ? 'arch' : 'flat', axis })

// The quarter as first authored, Ilo-cramped. Every quarter literal outside this file is written in this frame
// and goes through quarterPoint()/partPoint() to reach the built quarter.
const LEGACY: Record<string, Footprint> = {
  'echelle-toit': F(-3, -1.6, 63.9, 65.3, 2.8, 3.2, 0, 'z'),
  'sas-chambre': F(-1.6, 1.6, 70, 73.5, 0, 2.8, 0, 'z'),
  sas: F(-3, 3, 63.2, 70, 0, 2.8, 0, 'z'),
  'coursive-sud': F(-14, 10, 60.8, 63.2, 0, 2.3, 1.1),
  cabine: F(-9, -5, 63.2, 67.2, 0, 2.2, 1.0, 'z'),
  'cabines-voisins': F(-9, -3, 55, 60.8, 0, 2.2, 1.1),
  refectoire: F(10, 26, 56, 72, 0, 4.6, 3.2),
  cuisine: F(10, 18, 48, 56, 0, 2.6, 1.6),
  'passerelle-1': F(-26, -14, 61, 63, 0, 1.9, 1.0),
  marche: F(-40, -26, 54, 70, 0, 3.4, 3.0, 'z'),
  'passerelle-3': F(-26, -9, 56.5, 58.5, 0, 1.9, 1.0),
  'passerelle-2': F(26, 36, 61, 63, 0, 1.9, 1.0),
  'passerelle-nef': F(-7, -5, 36, 55, 0, 1.9, 1.0, 'z'),
  'salle-des-cartes': F(36, 44, 57, 67, 0, 2.8, 2.0, 'z'),
}

const ORIGIN = { x: 0, z: 63.2 }
const sx = (x: number) => ORIGIN.x + (x - ORIGIN.x) * QUARTER_SCALE
const sz = (z: number) => ORIGIN.z + (z - ORIGIN.z) * QUARTER_SCALE
const band = (legacyCenter: number, w = 3.6): [number, number] => [sz(legacyCenter) - w / 2, sz(legacyCenter) + w / 2]
const scaled = (id: string, wallH: number, archH: number): Footprint => {
  const l = LEGACY[id]!
  return { ...l, x0: sx(l.x0), x1: sx(l.x1), z0: sz(l.z0), z1: sz(l.z1), wallH, archH }
}

function axisMap(a0: number, a1: number, b0: number, b1: number, v: number): number {
  const m = Math.min(1.2, (a1 - a0) / 4)
  if (v <= a0 + m) return b0 + (v - a0)
  if (v >= a1 - m) return b1 - (a1 - v)
  return b0 + m + ((v - a0 - m) * (b1 - b0 - 2 * m)) / (a1 - a0 - 2 * m)
}

const sas = scaled('sas', 3.8, 0)
// The roof shaft keeps its size and rides with the sas wall it leans on.
const shaftDx = axisMap(-3, 3, sas.x0, sas.x1, -2.3) + 2.3
const shaftDz = axisMap(63.2, 70, sas.z0, sas.z1, 64.6) - 64.6

export const FOOTPRINTS: Record<string, Footprint> = {
  'echelle-toit': F(-3 + shaftDx, -1.6 + shaftDx, 63.9 + shaftDz, 65.3 + shaftDz, sas.wallH, 3.2, 0, 'z'),
  'sas-chambre': scaled('sas-chambre', 3.8, 0),
  sas,
  'coursive-sud': scaled('coursive-sud', 3.4, 1.6),
  cabine: scaled('cabine', 3.4, 1.6),
  'cabines-voisins': scaled('cabines-voisins', 3.4, 1.7),
  refectoire: scaled('refectoire', 6.2, 5.0),
  // East of the cs-01 sealed hull, whose roof tops out just above the floor at x 14..26.
  cuisine: F(27, 27 + 8 * QUARTER_SCALE, sz(48), sz(56), 0, 3.8, 2.4),
  // Pinned to the city: the marché's west door meets the petit-marché gangway, the nef gangway the Nef and the puits.
  'passerelle-1': F(-26, sx(-14), ...band(62), 0, 2.8, 1.4),
  marche: F(-40, -26, sz(54), sz(70), 0, 4.6, 3.0, 'z'),
  'passerelle-3': F(-26, sx(-9), ...band(57.5), 0, 2.8, 1.4),
  'passerelle-2': F(sx(26), sx(26) + 6, ...band(62), 0, 2.8, 1.4),
  'passerelle-nef': F(-8.6, -5, 36.5, sz(55), 0, 2.6, 1.1, 'z'),
  'salle-des-cartes': F(sx(26) + 6, sx(26) + 6 + 8 * QUARTER_SCALE, sz(57), sz(67), 0, 3.8, 3.0, 'z'),
}

export function ceilingOf(p: Footprint, x: number, z: number): number {
  const top = p.floorY + p.wallH
  if (p.roof === 'flat') return top
  const W = p.axis === 'x' ? p.z1 - p.z0 : p.x1 - p.x0
  const off = p.axis === 'x' ? z - (p.z0 + p.z1) / 2 : x - (p.x0 + p.x1) / 2
  const r = Math.min(1, Math.abs(off) / (W / 2 - WALL_T))
  return top + p.archH * Math.sqrt(1 - r * r)
}

export function mapX(id: string, x: number): number {
  const a = LEGACY[id]!
  const b = FOOTPRINTS[id]!
  return axisMap(a.x0, a.x1, b.x0, b.x1, x)
}

export function mapZ(id: string, z: number): number {
  const a = LEGACY[id]!
  const b = FOOTPRINTS[id]!
  return axisMap(a.z0, a.z1, b.z0, b.z1, z)
}

// Furniture height (below 2 m) is kept, the space up to the local ceiling stretches, anything above the roof keeps its offset.
export function partPoint(id: string, x: number, y: number, z: number): Vec3 {
  const a = LEGACY[id]!
  const b = FOOTPRINTS[id]!
  const nx = mapX(id, x)
  const nz = mapZ(id, z)
  const rel = y - a.floorY
  const c0 = ceilingOf(a, x, z) - a.floorY
  const c1 = ceilingOf(b, nx, nz) - b.floorY
  let ny: number
  if (rel >= c0) ny = c1 + rel - c0
  else if (rel <= 2) ny = rel
  else ny = 2 + ((rel - 2) * (c1 - 2)) / (c0 - 2)
  return { x: nx, y: b.floorY + ny, z: nz }
}

export function legacyPartAt(v: Vec3): string {
  const ids = Object.keys(LEGACY)
  for (const id of ids) {
    const p = LEGACY[id]!
    if (v.x > p.x0 && v.x < p.x1 && v.z > p.z0 && v.z < p.z1 && v.y > p.floorY - 0.3 && v.y < ceilingOf(p, v.x, v.z) + WALL_T) return id
  }
  let best = ids[0]!
  let bestD = Infinity
  let bestFloor = -Infinity
  for (const id of ids) {
    const p = LEGACY[id]!
    const d = Math.hypot(Math.max(p.x0 - v.x, 0, v.x - p.x1), Math.max(p.z0 - v.z, 0, v.z - p.z1))
    const floor = p.floorY <= v.y ? p.floorY : -Infinity
    if (d < bestD - 1e-6 || (Math.abs(d - bestD) < 1e-6 && floor > bestFloor)) {
      best = id
      bestD = d
      bestFloor = floor
    }
  }
  return best
}

export function quarterPoint<T extends Vec3>(v: T): T {
  return { ...v, ...partPoint(legacyPartAt(v), v.x, v.y, v.z) }
}

export function quarterPoints<K extends string, T extends Vec3>(table: Record<K, T>): Record<K, T> {
  return Object.fromEntries(Object.entries<T>(table).map(([k, v]) => [k, quarterPoint(v)])) as Record<K, T>
}
