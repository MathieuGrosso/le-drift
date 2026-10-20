import { mulberry32 } from '../../core/rng'
import type { ColliderKind, DeckId, Vec3 } from '../../core/types'
import type { Anchor } from '../../drift/procgen-hook'
import { ARCHETYPES } from '../archetypes'
import { planShip } from '../ship'
import type {
  Box, CellSpec, ColliderSpec, DistrictPlan, DressSlot, FloorSpec, FloorStyle, HullSpec, LampSpec, LinkSpec, PortSpec,
  Rect, VoidSpec, WalkEdge, WalkNode, WaterSpec, WindowSpec,
} from '../types'
import { cellX, cellZ, DIRS, type Dir, type Fosse, type Grid, K, type Lot, opposite, walkable } from './grid'
import { ARRIVAL, BRIDGE, DECK_AT, FOSSE, GRID, HULL, LAMPS, LEVELS, PORT, WATER, WINDOWS } from './tuning'

export interface Door { lot: number; dir: Dir; storey: number; at: number; w: number }
export interface Bridge { a: number; b: number; dir: Dir; storey: number; at: number; from: number; to: number }
export interface Stair { lot: number; storey: number; alongX: boolean; lateral: number; s0: number; s1: number; up: 1 | -1 }
export interface Ladder { id: string; lot: number; dir: Dir; at: number; cell: number }

export interface Skeleton {
  grid: Grid
  doors: Door[]
  bridges: Bridge[]
  stairs: Stair[]
  ladders: Ladder[]
  outer: Dir[]
}

export function deckAt(y: number): DeckId {
  let deck: DeckId = 'cale'
  for (const [dy, d] of DECK_AT) if (y >= dy - 1) deck = d
  return deck
}

export function lotRect(g: Grid, lot: Lot): Rect {
  return { x0: g.x0 + lot.i0 * GRID, x1: g.x0 + (lot.i1 + 1) * GRID, z0: g.z0 + lot.j0 * GRID, z1: g.z0 + (lot.j1 + 1) * GRID }
}

const storeyY = (g: Grid, k: number) => g.ground + HULL_STOREY * k
const HULL_STOREY = LEVELS.haut.storey

export function longX(r: Rect): boolean { return r.x1 - r.x0 >= r.z1 - r.z0 }

let shipCache: readonly DistrictPlan[] | null = null
const CORE = { x: 130, z0: -80, z1: 80 }

function outerSides(plan: DistrictPlan): Dir[] {
  shipCache ??= planShip().districts
  const b = plan.bounds
  const out: Dir[] = []
  const touches = (d: Dir) => shipCache!.some((o) => {
    if (o.id === plan.id || o.layer !== plan.layer) return false
    const ob = o.bounds
    if (d === 1 || d === 2) {
      const x = d === 1 ? b.x1 : b.x0
      const ox = d === 1 ? ob.x0 : ob.x1
      return Math.abs(x - ox) < 1 && Math.min(b.z1, ob.z1) - Math.max(b.z0, ob.z0) > 1
    }
    const z = d === 3 ? b.z1 : b.z0
    const oz = d === 3 ? ob.z0 : ob.z1
    return Math.abs(z - oz) < 1 && Math.min(b.x1, ob.x1) - Math.max(b.x0, ob.x0) > 1
  })
  const core = (d: Dir) => (d === 1 || d === 2) && Math.abs(d === 1 ? b.x1 : b.x0) === CORE.x && b.z0 < CORE.z1 && b.z1 > CORE.z0
  for (const d of [1, 2, 3, 4] as const) if (!touches(d) && !core(d)) out.push(d)
  return out
}

function frontCells(g: Grid, lot: Lot, d: Dir): number[] {
  const out: number[] = []
  const [dx, dz] = DIRS[d]
  const alongX = d === 3 || d === 4
  const a0 = alongX ? lot.i0 : lot.j0
  const a1 = alongX ? lot.i1 : lot.j1
  for (let a = a0; a <= a1; a++) {
    const i = alongX ? a : dx > 0 ? lot.i1 + 1 : lot.i0 - 1
    const j = alongX ? (dz > 0 ? lot.j1 + 1 : lot.j0 - 1) : a
    if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) continue
    const c = j * g.nx + i
    if (walkable(g.kind[c]!) && !g.ramp[c] && Math.abs(g.h[c]! - g.ground) < 0.5) out.push(c)
  }
  return out
}

export function skeleton(plan: DistrictPlan, g: Grid, seed: number): Skeleton {
  const rng = mulberry32(seed ^ 0x5bd1e995)
  const doors: Door[] = []
  const stairs: Stair[] = []
  const ladders: Ladder[] = []
  const bridges: Bridge[] = []
  for (const lot of g.lots) {
    const r = lotRect(g, lot)
    const lx = longX(r)
    for (const d of [1, 2, 3, 4] as const) {
      const cells = frontCells(g, lot, d)
      if (!cells.length) continue
      const n = Math.max(1, Math.round(cells.length / HULL.door.every))
      const off = Math.floor(rng() * cells.length)
      const picked = new Set<number>()
      for (let k = 0; k < n; k++) picked.add(cells[(off + Math.floor((k * cells.length) / n)) % cells.length]!)
      for (const c of picked) doors.push({ lot: lot.id, dir: d, storey: 0, at: d === 3 || d === 4 ? cellX(g, c % g.nx) : cellZ(g, Math.floor(c / g.nx)), w: HULL.door.w })
      const rest = cells.filter((c) => !picked.has(c))
      if (rest.length && lot.storeys >= 2 && !ladders.some((l) => l.lot === lot.id)) {
        const c = rest[Math.floor(rng() * rest.length)]!
        const at = d === 3 || d === 4 ? cellX(g, c % g.nx) : cellZ(g, Math.floor(c / g.nx))
        ladders.push({ id: `${plan.id}/echelle-${lot.id}`, lot: lot.id, dir: d, at, cell: c })
        doors.push({ lot: lot.id, dir: d, storey: 1, at, w: 1.6 })
      }
    }
    const mid = lx ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2
    const centre = lx ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2
    const side = rng() < 0.5 ? 1 : -1
    for (let k = 0; k < lot.storeys - 1; k++) {
      const up = ((k % 2 === 0) === rng() < 0.5 ? 1 : -1) as 1 | -1
      const half = HULL.stair.run / 2
      stairs.push({ lot: lot.id, storey: k, alongX: lx, lateral: centre + side * (k % 2 === 0 ? 1 : -1) * HULL.stair.offset, s0: mid - half, s1: mid + half, up })
    }
  }
  const perHull = new Map<number, number>()
  for (const a of g.lots) {
    for (const d of [1, 3] as const) {
      const cands: { b: number; t: number; gap: number }[] = []
      const alongX = d === 3
      const t0 = alongX ? a.i0 + 1 : a.j0 + 1
      const t1 = alongX ? a.i1 - 1 : a.j1 - 1
      for (let t = t0; t <= t1; t++) {
        for (let s = 1; s <= BRIDGE.maxGap + 1; s++) {
          const i = alongX ? t : a.i1 + s
          const j = alongX ? a.j1 + s : t
          if (i >= g.nx || j >= g.nz) break
          const c = j * g.nx + i
          if (g.kind[c] === K.Lot) {
            const b = g.lots[g.lot[c]!]!
            const inner = alongX ? t > b.i0 && t < b.i1 : t > b.j0 && t < b.j1
            if (s > 1 && inner) cands.push({ b: b.id, t, gap: s - 1 })
            break
          }
          if (!walkable(g.kind[c]!) || g.fixed[c]) break
        }
      }
      if (!cands.length) continue
      const byB = new Map<number, typeof cands>()
      for (const c of cands) byB.set(c.b, [...(byB.get(c.b) ?? []), c])
      for (const [bId, list] of byB) {
        const b = g.lots[bId]!
        const top = Math.min(a.storeys, b.storeys) - 1
        if (top < 1 || rng() > BRIDGE.chance) continue
        if ((perHull.get(a.id) ?? 0) >= BRIDGE.perHull || (perHull.get(b.id) ?? 0) >= BRIDGE.perHull) continue
        const pick = list[Math.floor(list.length / 2)]!
        const storey = 1 + Math.floor(rng() * top)
        const at = alongX ? cellX(g, pick.t) : cellZ(g, pick.t)
        const ra = lotRect(g, a)
        const rb = lotRect(g, b)
        bridges.push({ a: a.id, b: b.id, dir: d, storey, at, from: alongX ? ra.z1 : ra.x1, to: alongX ? rb.z0 : rb.x0 })
        doors.push({ lot: a.id, dir: d, storey, at, w: BRIDGE.width }, { lot: b.id, dir: opposite(d), storey, at, w: BRIDGE.width })
        perHull.set(a.id, (perHull.get(a.id) ?? 0) + 1)
        perHull.set(b.id, (perHull.get(b.id) ?? 0) + 1)
      }
    }
  }
  return { grid: g, doors, bridges, stairs, ladders, outer: outerSides(plan) }
}

interface Range { lo: number; hi: number }

function edgeRange(g: Grid, c: number, d: Dir): Range {
  if (g.kind[c] === K.Lot) return { lo: g.ground, hi: g.ground }
  const h = g.h[c]!
  const r = g.ramp[c] as Dir | 0
  if (!r) return { lo: h, hi: h }
  const top = h + g.rise[c]!
  if (r === d) return { lo: top, hi: top }
  if (r === opposite(d)) return { lo: h, hi: h }
  return { lo: h, hi: top }
}

const MATCH = 0.55

export interface EdgeWall { c: number; d: Dir; y0: number; y1: number }

export function edgeWalls(g: Grid): { walls: EdgeWall[]; links: [number, number][] } {
  const walls: EdgeWall[] = []
  const links: [number, number][] = []
  const openOf = new Map<number, Dir>()
  for (const e of g.entries) if (e.open) openOf.set(e.cell, e.open)
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      const c = j * g.nx + i
      for (const d of [1, 3] as const) {
        const ni = i + DIRS[d][0]
        const nj = j + DIRS[d][1]
        if (ni >= g.nx || nj >= g.nz) continue
        const n = nj * g.nx + ni
        const kc = g.kind[c]!
        const kn = g.kind[n]!
        if (kc === K.Lot && kn === K.Lot) continue
        if (!walkable(kc) && kc !== K.Lot) continue
        if (!walkable(kn) && kn !== K.Lot) continue
        const a = edgeRange(g, c, d)
        const b = edgeRange(g, n, opposite(d))
        const open = openOf.get(c) === d ? c : openOf.get(n) === opposite(d) ? n : -1
        if (open >= 0) {
          const other = open === c ? b : a
          const pad = open === c ? a : b
          if (other.hi > pad.hi + 2.2) walls.push({ c, d, y0: other.hi - HULL.slab, y1: other.hi + HULL.rail })
          continue
        }
        if (Math.abs(a.lo - b.lo) < MATCH && Math.abs(a.hi - b.hi) < MATCH) {
          if (kc !== K.Lot && kn !== K.Lot) links.push([c, n])
          continue
        }
        walls.push({ c, d, y0: Math.min(a.lo, b.lo) - HULL.slab, y1: Math.max(a.hi, b.hi) + HULL.rail })
      }
    }
  }
  return { walls, links }
}

// Greedy merge of equal-height flat cells into rectangles: few colliders, no seams.
export function mergeFlat(g: Grid, key: (c: number) => number | null): { r: Rect; h: number }[] {
  const used = new Uint8Array(g.kind.length)
  const out: { r: Rect; h: number }[] = []
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      const c = j * g.nx + i
      const h = key(c)
      if (used[c] || h === null) continue
      let w = 1
      while (i + w < g.nx && !used[c + w] && key(c + w) === h) w++
      let d = 1
      grow: while (j + d < g.nz) {
        for (let k = 0; k < w; k++) {
          const cc = (j + d) * g.nx + i + k
          if (used[cc] || key(cc) !== h) break grow
        }
        d++
      }
      for (let jj = j; jj < j + d; jj++) for (let ii = i; ii < i + w; ii++) used[jj * g.nx + ii] = 1
      out.push({ r: { x0: g.x0 + i * GRID, x1: g.x0 + (i + w) * GRID, z0: g.z0 + j * GRID, z1: g.z0 + (j + d) * GRID }, h })
    }
  }
  return out
}

export function subtract(r: Rect, hole: Rect): Rect[] {
  if (hole.x1 <= r.x0 || hole.x0 >= r.x1 || hole.z1 <= r.z0 || hole.z0 >= r.z1) return [r]
  const out: Rect[] = []
  const hx0 = Math.max(r.x0, hole.x0)
  const hx1 = Math.min(r.x1, hole.x1)
  if (hole.z0 > r.z0) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: hole.z0 })
  if (hole.z1 < r.z1) out.push({ x0: r.x0, x1: r.x1, z0: hole.z1, z1: r.z1 })
  const z0 = Math.max(r.z0, hole.z0)
  const z1 = Math.min(r.z1, hole.z1)
  if (hx0 > r.x0) out.push({ x0: r.x0, x1: hx0, z0, z1 })
  if (hx1 < r.x1) out.push({ x0: hx1, x1: r.x1, z0, z1 })
  return out
}

export function stairRect(s: Stair): Rect {
  const w = HULL.stair.width / 2 + 0.1
  return s.alongX
    ? { x0: s.s0, x1: s.s1, z0: s.lateral - w, z1: s.lateral + w }
    : { x0: s.lateral - w, x1: s.lateral + w, z0: s.s0, z1: s.s1 }
}

export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind: ColliderKind, climbable = false, ownerId?: string): ColliderSpec {
  return { kind, climbable, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hy: Math.abs(y1 - y0) / 2, hz: Math.abs(z1 - z0) / 2, ...(ownerId ? { ownerId } : {}) }
}

export function ramp(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, rises: Dir, kind: ColliderKind): ColliderSpec {
  const alongX = rises === 1 || rises === 2
  const run = alongX ? x1 - x0 : z1 - z0
  const rise = y1 - y0
  const sign = rises === 1 || rises === 3 ? 1 : -1
  const slope = Math.atan2(rise, run)
  const a = alongX ? (sign * slope) / 2 : (-sign * slope) / 2
  const q: readonly [number, number, number, number] = alongX ? [0, 0, Math.sin(a), Math.cos(a)] : [Math.sin(a), 0, 0, Math.cos(a)]
  const half = Math.hypot(rise, run) / 2
  const width = alongX ? z1 - z0 : x1 - x0
  return {
    kind, climbable: false, x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 0.16, z: (z0 + z1) / 2,
    hx: alongX ? half : width / 2, hy: 0.12, hz: alongX ? width / 2 : half, q,
  }
}

// Wall pieces along one axis with door gaps: returns [a0, a1, y0, y1] spans.
export function wallPieces(a0: number, a1: number, y0: number, y1: number, gaps: readonly { at: number; w: number; y0: number; y1: number }[]): [number, number, number, number][] {
  const out: [number, number, number, number][] = []
  const sorted = [...gaps].sort((p, q) => p.at - q.at)
  let cur = a0
  for (const gp of sorted) {
    const g0 = Math.max(a0, gp.at - gp.w / 2)
    const g1 = Math.min(a1, gp.at + gp.w / 2)
    if (g1 <= cur) continue
    if (g0 > cur) out.push([cur, g0, y0, y1])
    if (gp.y0 > y0) out.push([g0, g1, y0, gp.y0])
    if (gp.y1 < y1) out.push([g0, g1, gp.y1, y1])
    cur = g1
  }
  if (cur < a1) out.push([cur, a1, y0, y1])
  return out
}

export interface Shelled {
  cells: CellSpec[]
  floors: FloorSpec[]
  colliders: ColliderSpec[]
  links: LinkSpec[]
  windows: WindowSpec[]
  voids: VoidSpec[]
  waters: WaterSpec[]
  slots: DressSlot[]
  lamps: LampSpec[]
  nodes: WalkNode[]
  edges: WalkEdge[]
  ports: PortSpec[]
  anchors: Anchor[]
  hulls: HullSpec[]
}

const FLOOR_STYLE: Readonly<Record<string, FloorStyle>> = {
  archipel: 'bois', puits: 'grille', atrium: 'carrelage', rue: 'pierre', 'nef-longue': 'bois', grappe: 'bois', terrasses: 'carrelage',
}

export function shell(plan: DistrictPlan, sk: Skeleton): Shelled {
  const g = sk.grid
  const lv = LEVELS[plan.layer]
  const arch = ARCHETYPES[plan.archetype]
  const b = plan.bounds
  const G = g.ground
  const id = plan.id
  const streetCell = id
  const o: Shelled = { cells: [], floors: [], colliders: [], links: [], windows: [], voids: [], waters: [], slots: [], lamps: [], nodes: [], edges: [], ports: [], anchors: [], hulls: [] }
  const col = (c: ColliderSpec) => o.colliders.push(c)
  const sn = (c: number) => `s${c}`
  const hn = (lot: number, k: number) => `h${lot}-${k}`
  const cellIdOf = (lot: number, k: number) => `${id}/c${lot}-${k}`
  const surf = (c: number) => g.h[c]! + (g.ramp[c] ? g.rise[c]! / 2 : 0)
  const edge = (a: string, bb: string, kind: WalkEdge['kind'], pa: Vec3, pb: Vec3) =>
    o.edges.push({ a, b: bb, kind, main: false, length: Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) })
  const nodeAt = new Map<string, Vec3>()
  const node = (nid: string, cell: string, at: Vec3) => {
    nodeAt.set(nid, at)
    o.nodes.push({ id: nid, cell, at })
  }

  const flatKey = (c: number) => (g.ramp[c] ? null : g.kind[c] === K.Lot || walkable(g.kind[c]!) ? Math.round(g.h[c]! * 100) / 100 : null)
  for (const { r, h } of mergeFlat(g, flatKey)) {
    const y0 = h > G + 0.01 ? G : h - HULL.slab
    col(box(r.x0, r.x1, y0, h, r.z0, r.z1, 'floor'))
    o.floors.push({ cell: streetCell, box: { x0: r.x0, x1: r.x1, y0: h, y1: h, z0: r.z0, z1: r.z1 }, style: FLOOR_STYLE[plan.shape] ?? 'bois' })
  }
  for (let c = 0; c < g.kind.length; c++) {
    if (!g.ramp[c]) continue
    const i = c % g.nx
    const j = Math.floor(c / g.nx)
    const x0 = g.x0 + i * GRID
    const z0 = g.z0 + j * GRID
    const lo = g.h[c]!
    col(ramp(x0, x0 + GRID, z0, z0 + GRID, lo, lo + g.rise[c]!, g.ramp[c] as Dir, 'stair'))
    if (lo > G + 0.2) col(box(x0, x0 + GRID, G, lo - 0.15, z0, z0 + GRID, 'wall'))
  }
  for (let c = 0; c < g.kind.length; c++) {
    if (g.kind[c] !== K.Water || g.ramp[c]) continue
    const i = c % g.nx
    const j = Math.floor(c / g.nx)
    o.waters.push({ cell: streetCell, rect: { x0: g.x0 + i * GRID, x1: g.x0 + (i + 1) * GRID, z0: g.z0 + j * GRID, z1: g.z0 + (j + 1) * GRID }, y: g.h[c]! + (g.sunk[c] ? FOSSE.flood : WATER.surface) })
  }
  const { walls, links } = edgeWalls(g)
  for (const w of walls) {
    const i = w.c % g.nx
    const j = Math.floor(w.c / g.nx)
    const t = 0.15
    if (w.d === 1) {
      const x = g.x0 + (i + 1) * GRID
      col(box(x - t, x + t, w.y0, w.y1, g.z0 + j * GRID, g.z0 + (j + 1) * GRID, 'wall'))
    } else {
      const z = g.z0 + (j + 1) * GRID
      col(box(g.x0 + i * GRID, g.x0 + (i + 1) * GRID, w.y0, w.y1, z - t, z + t, 'wall'))
    }
  }

  // Perimeter: full-height skin with openings at the boundary ports.
  const perim: { d: Dir; gaps: { at: number; w: number; y0: number; y1: number }[] }[] = ([1, 2, 3, 4] as const).map((d) => ({ d, gaps: [] }))
  for (const e of g.entries) {
    const f = e.port.facing
    const d: Dir | 0 = f.x > 0 ? 1 : f.x < 0 ? 2 : f.z > 0 ? 3 : f.z < 0 ? 4 : 0
    if (!d) continue
    perim[d - 1]!.gaps.push({ at: d <= 2 ? e.port.at.z : e.port.at.x, w: PORT.w, y0: e.port.at.y, y1: e.port.at.y + PORT.h })
  }
  const yTop = lv.top
  for (const p of perim) {
    const alongZ = p.d <= 2
    const a0 = alongZ ? b.z0 : b.x0
    const a1 = alongZ ? b.z1 : b.x1
    const fixed = p.d === 1 ? b.x1 : p.d === 2 ? b.x0 : p.d === 3 ? b.z1 : b.z0
    const inward = p.d === 1 || p.d === 3 ? -1 : 1
    for (const [s0, s1, y0, y1] of wallPieces(a0, a1, b.y0, yTop, p.gaps)) {
      const f0 = fixed + inward * HULL.wall
      if (alongZ) col(box(Math.min(fixed, f0), Math.max(fixed, f0), y0, y1, s0, s1, 'hull'))
      else col(box(s0, s1, y0, y1, Math.min(fixed, f0), Math.max(fixed, f0), 'hull'))
    }
  }
  for (const d of sk.outer) {
    const alongZ = d <= 2
    const a0 = alongZ ? b.z0 : b.x0
    const a1 = alongZ ? b.z1 : b.x1
    const fixed = d === 1 ? b.x1 : d === 2 ? b.x0 : d === 3 ? b.z1 : b.z0
    const nrm: Vec3 = { x: DIRS[d][0], y: 0, z: DIRS[d][1] }
    const mid = (a0 + a1) / 2
    const inset = -HULL.wall - 0.05
    const at = (a: number, y: number): Vec3 => (alongZ ? { x: fixed + nrm.x * inset, y, z: a } : { x: a, y, z: fixed + nrm.z * inset })
    const baie = sk.outer[0] === d
    if (baie) o.windows.push({ id: `${id}/baie`, cell: streetCell, kind: 'baie', at: at(mid, G + 1.2 + WINDOWS.baie.h / 2), normal: nrm, w: WINDOWS.baie.w, h: WINDOWS.baie.h, outer: true })
    for (let row = 0; row < lv.storeys; row++) {
      const y = G + 2.6 + row * lv.storey
      for (let a = a0 + WINDOWS.hublotEvery / 2; a < a1; a += WINDOWS.hublotEvery) {
        if (baie && row === 0 && Math.abs(a - mid) < WINDOWS.baie.w / 2 + 1) continue
        if (perim[d - 1]!.gaps.some((gp) => Math.abs(gp.at - a) < gp.w)) continue
        o.windows.push({ id: `${id}/hublot-${d}-${row}-${Math.round(a)}`, cell: streetCell, kind: 'hublot', at: at(a, y), normal: nrm, w: WINDOWS.hublotR * 2, h: WINDOWS.hublotR * 2, outer: true })
      }
    }
  }

  // Hulls: walls with door gaps per storey, floors with stair holes, stairs with a stepped plinth.
  o.hulls.push(...hullSpecs(plan, g, sk.outer))
  const doorsOf = (lot: number, d: Dir, k: number) => sk.doors.filter((dr) => dr.lot === lot && dr.dir === d && dr.storey === k)
  for (const lot of g.lots) {
    const r = lotRect(g, lot)
    const lx = longX(r)
    for (let k = 0; k < lot.storeys; k++) {
      const y = storeyY(g, k)
      const yb = k === 0 ? G - HULL.slab : y
      const yt = y + HULL_STOREY
      for (const d of [1, 2, 3, 4] as const) {
        const alongZ = d <= 2
        const fixed = d === 1 ? r.x1 : d === 2 ? r.x0 : d === 3 ? r.z1 : r.z0
        const inward = d === 1 || d === 3 ? -1 : 1
        const gaps = doorsOf(lot.id, d, k).map((dr) => ({ at: dr.at, w: dr.w, y0: y, y1: y + HULL.door.h }))
        const f0 = fixed + inward * HULL.wall
        for (const [s0, s1, y0, y1] of wallPieces(alongZ ? r.z0 : r.x0, alongZ ? r.z1 : r.x1, yb, yt, gaps)) {
          if (alongZ) col(box(Math.min(fixed, f0), Math.max(fixed, f0), y0, y1, s0, s1, 'wall'))
          else col(box(s0, s1, y0, y1, Math.min(fixed, f0), Math.max(fixed, f0), 'wall'))
        }
      }
      const cid = cellIdOf(lot.id, k)
      const centre: Vec3 = { x: (r.x0 + r.x1) / 2, y, z: (r.z0 + r.z1) / 2 }
      const roof = k === lot.storeys - 1 ? yt + HULL.roofRise : yt - HULL.slab
      const below = sk.stairs.find((s) => s.lot === lot.id && s.storey === k - 1)
      const spawn = below
        ? (lx ? { x: centre.x, y, z: below.lateral > centre.z ? centre.z - 2.5 : centre.z + 2.5 } : { x: below.lateral > centre.x ? centre.x - 2.5 : centre.x + 2.5, y, z: centre.z })
        : centre
      o.cells.push({ id: cid, district: id, quartier: plan.quartier, deck: deckAt(y), nom: null, boxes: [{ x0: r.x0, x1: r.x1, y0: y - 0.2, y1: yt - 0.2, z0: r.z0, z1: r.z1 }], roof, air: arch.light.airHaze * 0.5, glass: false, spawn: { ...spawn, yaw: 0 } })
      node(hn(lot.id, k), cid, { ...spawn })
      o.lamps.push({ cell: cid, at: { x: centre.x, y: yt - 1.4, z: centre.z }, color: arch.light.lampe, radius: LAMPS.radius, live: k === 0 })
      if (k > 0) {
        let rects: Rect[] = [r]
        if (below) rects = rects.flatMap((rr) => subtract(rr, stairRect(below)))
        for (const rr of rects) col(box(rr.x0, rr.x1, y - HULL.slab, y, rr.z0, rr.z1, 'floor'))
        o.floors.push({ cell: cid, box: { x0: r.x0, x1: r.x1, y0: y, y1: y, z0: r.z0, z1: r.z1 }, style: 'bois' })
        if (below) {
          const hr = stairRect(below)
          const lowEnd = below.up > 0 ? (below.alongX ? hr.x0 : hr.z0) : below.alongX ? hr.x1 : hr.z1
          const t = 0.06
          if (below.alongX) {
            col(box(hr.x0, hr.x1, y, y + HULL.rail, hr.z0 - t, hr.z0 + t, 'wall'))
            col(box(hr.x0, hr.x1, y, y + HULL.rail, hr.z1 - t, hr.z1 + t, 'wall'))
            col(box(lowEnd - t, lowEnd + t, y, y + HULL.rail, hr.z0, hr.z1, 'wall'))
          } else {
            col(box(hr.x0 - t, hr.x0 + t, y, y + HULL.rail, hr.z0, hr.z1, 'wall'))
            col(box(hr.x1 - t, hr.x1 + t, y, y + HULL.rail, hr.z0, hr.z1, 'wall'))
            col(box(hr.x0, hr.x1, y, y + HULL.rail, lowEnd - t, lowEnd + t, 'wall'))
          }
        }
      }
      slotsForRoom(o, plan, r, k, y, cid, doorsOf, lot.id, below ? stairRect(below) : null)
    }
  }
  for (const s of sk.stairs) {
    const y0 = storeyY(g, s.storey)
    const y1 = y0 + HULL_STOREY
    const hw = HULL.stair.width / 2
    const rises: Dir = s.alongX ? (s.up > 0 ? 1 : 2) : s.up > 0 ? 3 : 4
    const sr = s.alongX
      ? { x0: s.s0, x1: s.s1, z0: s.lateral - hw, z1: s.lateral + hw }
      : { x0: s.lateral - hw, x1: s.lateral + hw, z0: s.s0, z1: s.s1 }
    col(ramp(sr.x0, sr.x1, sr.z0, sr.z1, y0, y1, rises, 'stair'))
    const run = s.s1 - s.s0
    for (let m = 1; m < 4; m++) {
      const a = s.up > 0 ? s.s0 + (run * m) / 10 : s.s1 - (run * (m + 1)) / 10
      const bnd = a + run / 10
      const yTopPl = y0 + ((y1 - y0) * m) / 10 - 0.2
      if (s.alongX) col(box(a, bnd, y0, yTopPl, sr.z0, sr.z1, 'wall'))
      else col(box(sr.x0, sr.x1, y0, yTopPl, a, bnd, 'wall'))
    }
    const lot = s.lot
    const low: Vec3 = s.alongX ? { x: s.up > 0 ? s.s0 : s.s1, y: y0, z: s.lateral } : { x: s.lateral, y: y0, z: s.up > 0 ? s.s0 : s.s1 }
    const high: Vec3 = s.alongX ? { x: s.up > 0 ? s.s1 : s.s0, y: y1, z: s.lateral } : { x: s.lateral, y: y1, z: s.up > 0 ? s.s1 : s.s0 }
    o.links.push({ id: `${id}/escalier-${lot}-${s.storey}`, kind: 'escalier', from: low, to: high, both: true, cells: [cellIdOf(lot, s.storey), cellIdOf(lot, s.storey + 1)] })
    o.lamps.push({ cell: cellIdOf(lot, s.storey), at: { x: (low.x + high.x) / 2, y: y1 - 1, z: (low.z + high.z) / 2 }, color: LAMPS.key, radius: LAMPS.keyRadius, live: false })
    edge(hn(lot, s.storey), hn(lot, s.storey + 1), 'escalier', nodeAt.get(hn(lot, s.storey))!, nodeAt.get(hn(lot, s.storey + 1))!)
  }
  for (const br of sk.bridges) {
    const y = storeyY(g, br.storey)
    const hw = BRIDGE.width / 2
    const alongX = br.dir === 1
    const t = 0.06
    if (alongX) {
      col(box(br.from, br.to, y - HULL.slab, y, br.at - hw, br.at + hw, 'floor'))
      col(box(br.from, br.to, y, y + HULL.rail, br.at - hw - t, br.at - hw + t, 'wall'))
      col(box(br.from, br.to, y, y + HULL.rail, br.at + hw - t, br.at + hw + t, 'wall'))
    } else {
      col(box(br.at - hw, br.at + hw, y - HULL.slab, y, br.from, br.to, 'floor'))
      col(box(br.at - hw - t, br.at - hw + t, y, y + HULL.rail, br.from, br.to, 'wall'))
      col(box(br.at + hw - t, br.at + hw + t, y, y + HULL.rail, br.from, br.to, 'wall'))
    }
    const pa: Vec3 = alongX ? { x: br.from, y, z: br.at } : { x: br.at, y, z: br.from }
    const pb: Vec3 = alongX ? { x: br.to, y, z: br.at } : { x: br.at, y, z: br.to }
    o.links.push({ id: `${id}/passerelle-${br.a}-${br.b}`, kind: 'passerelle', from: pa, to: pb, both: true, cells: [cellIdOf(br.a, br.storey), cellIdOf(br.b, br.storey)] })
    edge(hn(br.a, br.storey), hn(br.b, br.storey), 'passerelle', nodeAt.get(hn(br.a, br.storey))!, nodeAt.get(hn(br.b, br.storey))!)
    const len = Math.abs(br.to - br.from)
    o.slots.push({ kind: 'rambarde', cell: streetCell, at: { x: (pa.x + pb.x) / 2, y, z: (pa.z + pb.z) / 2 }, yaw: alongX ? 0 : Math.PI / 2, w: len, d: BRIDGE.width, h: HULL.rail, weight: 0.6, onPath: true })
  }

  // Street cells, walk graph and the district-wide street cell.
  for (let c = 0; c < g.kind.length; c++) {
    if (!walkable(g.kind[c]!)) continue
    node(sn(c), streetCell, { x: cellX(g, c % g.nx), y: surf(c), z: cellZ(g, Math.floor(c / g.nx)) })
  }
  for (const [a, bb] of links) edge(sn(a), sn(bb), 'sol', nodeAt.get(sn(a))!, nodeAt.get(sn(bb))!)
  for (const dr of sk.doors) {
    if (dr.storey !== 0) continue
    const lot = g.lots[dr.lot]!
    const cells = frontCells(g, lot, dr.dir)
    const c = cells.find((cc) => Math.abs((dr.dir >= 3 ? cellX(g, cc % g.nx) : cellZ(g, Math.floor(cc / g.nx))) - dr.at) < 0.1)
    if (c === undefined) continue
    edge(sn(c), hn(dr.lot, 0), 'porte', nodeAt.get(sn(c))!, nodeAt.get(hn(dr.lot, 0))!)
    const r = lotRect(g, lot)
    const p = doorPoint(r, dr.dir, dr.at, G)
    o.slots.push({ kind: 'seuil', cell: streetCell, at: { x: p.x + DIRS[dr.dir][0] * 1.2, y: G, z: p.z + DIRS[dr.dir][1] * 1.2 }, yaw: dirYaw(dr.dir), w: 2.4, d: 1.2, h: 3, weight: 0.5, onPath: g.main[c] === 1 })
  }
  for (const l of sk.ladders) {
    const lot = g.lots[l.lot]!
    const r = lotRect(g, lot)
    const p = doorPoint(r, l.dir, l.at, G)
    const nx = DIRS[l.dir][0]
    const nz = DIRS[l.dir][1]
    const x = p.x + nx * 0.3
    const z = p.z + nz * 0.3
    const alongZ = l.dir <= 2
    col({ kind: 'ladder', climbable: true, ownerId: l.id, x, y: G + HULL_STOREY / 2, z, hx: alongZ ? 0.04 : 0.25, hy: HULL_STOREY / 2, hz: alongZ ? 0.25 : 0.04 })
    o.anchors.push({ kind: 'ladder', id: l.id, bottom: { x, y: G, z }, top: { x, y: G + HULL_STOREY, z }, normal: { x: nx, y: 0, z: nz } })
    o.links.push({ id: l.id, kind: 'echelle', from: { x: x + nx * 0.5, y: G, z: z + nz * 0.5 }, to: { x: x - nx * 0.6, y: G + HULL_STOREY, z: z - nz * 0.6 }, both: true, cells: [streetCell, cellIdOf(l.lot, 1)] })
    edge(sn(l.cell), hn(l.lot, 1), 'echelle', nodeAt.get(sn(l.cell))!, nodeAt.get(hn(l.lot, 1))!)
  }
  for (const e of g.entries) {
    const pid = `p:${e.port.id}`
    node(pid, streetCell, { ...e.port.at })
    edge(pid, sn(e.cell), e.open ? 'escalier' : 'porte', e.port.at, nodeAt.get(sn(e.cell))!)
    o.ports.push({ port: e.port.id, cell: streetCell, at: { ...e.port.at } })
    if (e.port.kind === 'escalier') o.lamps.push({ cell: streetCell, at: { x: e.port.at.x, y: e.port.at.y + LAMPS.keyHeight, z: e.port.at.z }, color: LAMPS.key, radius: LAMPS.keyRadius, live: true })
  }
  for (const f of g.fosses) {
    if (f.landing < 0) continue
    o.lamps.push({ cell: streetCell, at: { x: cellX(g, f.landing % g.nx), y: G + LAMPS.keyHeight, z: cellZ(g, Math.floor(f.landing / g.nx)) }, color: LAMPS.key, radius: LAMPS.keyRadius, live: false })
  }
  if (plan.layer === 'bas') wallLamps(o, plan, perim.map((p) => p.gaps), G)
  markMain(o, g.entries.map((e) => `p:${e.port.id}`))
  for (const v of g.voids) {
    const floor = g.fosses.some((f) => f.i0 === v.i0 && f.j0 === v.j0) ? G - FOSSE.depth : G
    const vb: Box = { x0: g.x0 + v.i0 * GRID, x1: g.x0 + (v.i1 + 1) * GRID, y0: floor, y1: lv.top, z0: g.z0 + v.j0 * GRID, z1: g.z0 + (v.j1 + 1) * GRID }
    const kind = plan.shape === 'archipel' ? 'bassin' : plan.shape === 'puits' ? 'puits' : plan.shape === 'nef-longue' ? 'nef' : 'atrium'
    o.voids.push({ id: `${id}/vide-${o.voids.length}`, cell: streetCell, kind, box: vb })
    o.lamps.push({ cell: streetCell, at: { x: (vb.x0 + vb.x1) / 2, y: G + (lv.top - G) * 0.6, z: (vb.z0 + vb.z1) / 2 }, color: arch.light.lampe, radius: LAMPS.radius * 2, live: true })
  }
  let mainCount = 0
  for (let c = 0; c < g.kind.length; c++) {
    if (!walkable(g.kind[c]!)) continue
    const p: Vec3 = { x: cellX(g, c % g.nx), y: surf(c), z: cellZ(g, Math.floor(c / g.nx)) }
    if (g.main[c] && !g.ramp[c] && ++mainCount % (LAMPS.streetEvery / GRID) === 0) {
      o.lamps.push({ cell: streetCell, at: { x: p.x, y: p.y + 4, z: p.z }, color: arch.light.lampe, radius: LAMPS.radius, live: false })
    }
    if (g.kind[c] === K.Void || (g.kind[c] === K.Street && !g.main[c] && !g.ramp[c])) {
      o.slots.push({ kind: 'sol', cell: streetCell, at: p, yaw: 0, w: GRID * 0.7, d: GRID * 0.7, h: 3, weight: g.kind[c] === K.Void ? 1 : 0.4, onPath: g.main[c] === 1 })
    }
  }
  for (const w of o.windows) o.slots.push({ kind: 'fenetre', cell: streetCell, at: { ...w.at }, yaw: Math.atan2(-w.normal.x, -w.normal.z), w: w.w, d: 0.6, h: w.h, weight: w.kind === 'baie' ? 1 : 0.3, onPath: false })
  o.cells.push({
    id: streetCell, district: id, quartier: plan.quartier, deck: deckAt(G), nom: plan.nom,
    boxes: [{ ...b }], roof: lv.top, air: arch.light.airHaze, glass: sk.outer.length > 0,
    spawn: arrival(g),
  })
  return o
}

const heroYaw = (dx: number, dz: number) => Math.atan2(dx, -dz)

function flatGround(g: Grid, x: number, z: number): boolean {
  const i = Math.floor((x - g.x0) / GRID)
  const j = Math.floor((z - g.z0) / GRID)
  if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return false
  const c = j * g.nx + i
  return walkable(g.kind[c]!) && !g.ramp[c] && !g.sunk[c] && !g.fixed[c] && g.h[c] === g.ground
}

// The arrival spot: on the main void's rim, looking down at its centre (the landmark's square).
// The return tube booth stands ARRIVAL.side to the spawn's right, so that spot must be rim too.
function overlook(g: Grid, f: Fosse): { c: number; yaw: number } | null {
  const focus = g.focus!
  const lx = cellX(g, f.landing % g.nx)
  const lz = cellZ(g, Math.floor(f.landing / g.nx))
  let best: { c: number; yaw: number; score: number } | null = null
  for (let c = 0; c < g.kind.length; c++) {
    const i = c % g.nx
    const j = Math.floor(c / g.nx)
    const x = cellX(g, i)
    const z = cellZ(g, j)
    if (!flatGround(g, x, z)) continue
    const rim = ([1, 2, 3, 4] as const).some((d) => {
      const ni = i + DIRS[d][0]
      const nj = j + DIRS[d][1]
      const n = nj * g.nx + ni
      return ni >= 0 && nj >= 0 && ni < g.nx && nj < g.nz && g.sunk[n] === 1 && !g.ramp[n] && g.h[n]! < g.ground - 1
    })
    if (!rim) continue
    const yaw = heroYaw(focus.x - x, focus.z - z)
    const rx = Math.cos(yaw)
    const rz = Math.sin(yaw)
    if (![ARRIVAL.side - 0.9, ARRIVAL.side + 0.9].every((s) => flatGround(g, x + rx * s, z + rz * s))) continue
    const bx = x + rx * ARRIVAL.side
    const bz = z + rz * ARRIVAL.side
    const away = f.landing >= 0 ? Math.hypot(bx - lx, bz - lz) : ARRIVAL.clear
    if (away < ARRIVAL.clear) continue
    const score = Math.hypot(x - lx, z - lz) - (g.main[c] ? ARRIVAL.mainBonus : 0)
    if (!best || score < best.score) best = { c, yaw, score }
  }
  return best
}

function arrival(g: Grid): { x: number; y: number; z: number; yaw: number } {
  const f = g.fosses[0]
  const o = f && g.focus ? overlook(g, f) : null
  const c = o?.c ?? g.entries[0]?.head ?? g.hub
  const x = cellX(g, c % g.nx)
  const z = cellZ(g, Math.floor(c / g.nx))
  const yaw = o?.yaw ?? (g.focus ? heroYaw(g.focus.x - x, g.focus.z - z) : 0)
  return { x, y: g.h[c]!, z, yaw }
}

// The keel has no sea light: warm sconces along its hull skin keep the far walls readable.
function wallLamps(o: Shelled, plan: DistrictPlan, gaps: readonly { at: number; w: number }[][], G: number): void {
  const b = plan.bounds
  const arch = ARCHETYPES[plan.archetype]
  for (const d of [1, 2, 3, 4] as const) {
    const alongZ = d <= 2
    const a0 = alongZ ? b.z0 : b.x0
    const a1 = alongZ ? b.z1 : b.x1
    const fixed = (d === 1 ? b.x1 : d === 2 ? b.x0 : d === 3 ? b.z1 : b.z0) - (d === 1 || d === 3 ? 1 : -1) * LAMPS.wallInset
    for (let a = a0 + LAMPS.wallEvery / 2; a < a1; a += LAMPS.wallEvery) {
      if (gaps[d - 1]!.some((gp) => Math.abs(gp.at - a) < gp.w)) continue
      const at: Vec3 = alongZ ? { x: fixed, y: G + LAMPS.wallHeight, z: a } : { x: a, y: G + LAMPS.wallHeight, z: fixed }
      o.lamps.push({ cell: plan.id, at, color: arch.light.lampe, radius: LAMPS.wallRadius, live: false })
    }
  }
}

export function dirYaw(d: Dir): number {
  return Math.atan2(DIRS[d][0], DIRS[d][1])
}

export function doorPoint(r: Rect, d: Dir, at: number, y: number): Vec3 {
  if (d === 1) return { x: r.x1, y, z: at }
  if (d === 2) return { x: r.x0, y, z: at }
  if (d === 3) return { x: at, y, z: r.z1 }
  return { x: at, y, z: r.z0 }
}

function slotsForRoom(o: Shelled, plan: DistrictPlan, r: Rect, k: number, y: number, cell: string, doorsOf: (lot: number, d: Dir, k: number) => Door[], lot: number, hole: Rect | null): void {
  for (const d of [1, 2, 3, 4] as const) {
    const alongZ = d <= 2
    const a0 = alongZ ? r.z0 : r.x0
    const a1 = alongZ ? r.z1 : r.x1
    const gaps = doorsOf(lot, d, k).map((dr) => ({ at: dr.at, w: dr.w + 1.2, y0: y, y1: y + 8 }))
    for (const [s0, s1] of wallPieces(a0 + 0.6, a1 - 0.6, y, y + 8, gaps)) {
      if (s1 - s0 < 1.2) continue
      const mid = (s0 + s1) / 2
      const p = doorPoint(r, d, mid, y)
      o.slots.push({ kind: 'mur', cell, at: { x: p.x - DIRS[d][0] * 0.5, y, z: p.z - DIRS[d][1] * 0.5 }, yaw: dirYaw(opposite(d)), w: s1 - s0, d: 0.9, h: 3, weight: 0.6, onPath: false })
    }
  }
  const cx = (r.x0 + r.x1) / 2
  const cz = (r.z0 + r.z1) / 2
  for (const [x, z] of [[r.x0 + 1, r.z0 + 1], [r.x1 - 1, r.z0 + 1], [r.x0 + 1, r.z1 - 1], [r.x1 - 1, r.z1 - 1]] as const) {
    o.slots.push({ kind: 'coin', cell, at: { x, y, z }, yaw: Math.atan2(cx - x, cz - z), w: 1.4, d: 1.4, h: 3, weight: 0.4, onPath: false })
  }
  o.slots.push({ kind: 'plafond', cell, at: { x: cx, y: y + 8 - 0.6, z: cz }, yaw: 0, w: r.x1 - r.x0 - 2, d: r.z1 - r.z0 - 2, h: 0.6, weight: 0.5, onPath: false })
  const inHole = hole && cx > hole.x0 - 1 && cx < hole.x1 + 1 && cz > hole.z0 - 1 && cz < hole.z1 + 1
  if (!inHole) {
    const kind = k === 0 ? (plan.shape === 'rue' ? 'etal' : 'atelier') : 'couchage'
    o.slots.push({ kind, cell, at: { x: cx, y, z: cz }, yaw: 0, w: 3, d: 2, h: 2.5, weight: 0.8, onPath: false })
  }
}

function markMain(o: Shelled, ports: readonly string[]): void {
  if (ports.length < 2) return
  const adj = new Map<string, { to: string; e: number }[]>()
  o.edges.forEach((e, i) => {
    adj.set(e.a, [...(adj.get(e.a) ?? []), { to: e.b, e: i }])
    adj.set(e.b, [...(adj.get(e.b) ?? []), { to: e.a, e: i }])
  })
  const src = ports[0]!
  const dist = new Map<string, number>([[src, 0]])
  const via = new Map<string, number>()
  const open = [src]
  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (dist.get(open[i]!)! < dist.get(open[bi]!)!) bi = i
    const n = open.splice(bi, 1)[0]!
    for (const { to, e } of adj.get(n) ?? []) {
      const d = dist.get(n)! + o.edges[e]!.length
      if (d < (dist.get(to) ?? Infinity)) {
        if (!dist.has(to)) open.push(to)
        dist.set(to, d)
        via.set(to, e)
      }
    }
  }
  for (const p of ports.slice(1)) {
    let n = p
    for (let guard = 0; via.has(n) && n !== src && guard < 10000; guard++) {
      const e = o.edges[via.get(n)!]!
      e.main = true
      n = e.a === n ? e.b : e.a
    }
  }
}

export function hullSpecs(plan: DistrictPlan, g: Grid, outer: readonly Dir[] = outerSides(plan)): HullSpec[] {
  const b = plan.bounds
  return g.lots.map((lot) => {
    const r = lotRect(g, lot)
    const lx = longX(r)
    const top = storeyY(g, lot.storeys)
    const long = lx ? r.x1 - r.x0 : r.z1 - r.z0
    const short = lx ? r.z1 - r.z0 : r.x1 - r.x0
    return {
      id: `${plan.id}/coque-${lot.id}`, district: plan.id, shape: long >= 24 ? 'quille' : long >= 12 && short >= 12 ? 'tonneau' : 'capsule',
      center: { x: (r.x0 + r.x1) / 2, y: (g.ground + top) / 2, z: (r.z0 + r.z1) / 2 }, length: long, rx: short / 2, ry: (top - g.ground) / 2 + HULL.roofRise / 2,
      yaw: lx ? Math.PI / 2 : 0, floors: Array.from({ length: lot.storeys }, (_, k) => storeyY(g, k)),
      outer: outer.some((d) => (d === 1 && r.x1 >= b.x1) || (d === 2 && r.x0 <= b.x0) || (d === 3 && r.z1 >= b.z1) || (d === 4 && r.z0 <= b.z0)),
    }
  })
}
