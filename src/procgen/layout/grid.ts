import { mulberry32 } from '../../core/rng'
import { ARCHETYPES } from '../archetypes'
import type { Vec3 } from '../../core/types'
import type { DistrictPlan, PortPlan, Rng } from '../types'
import { FOSSE, GRID, LEVELS, LOT, RAMP, SHAPE_VOID, STREET, WATER } from './tuning'

export const enum K { Empty = 0, Street = 1, Void = 2, Water = 3, Lot = 4 }

// Ramp direction: the side the surface rises toward. 0 = flat.
export const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const
export type Dir = 1 | 2 | 3 | 4
export const opposite = (d: Dir): Dir => (d === 1 ? 2 : d === 2 ? 1 : d === 3 ? 4 : 3)

export interface Lot { id: number; i0: number; i1: number; j0: number; j1: number; storeys: number }

export interface Entry { port: PortPlan; cell: number; head: number; open: Dir | 0 }

export interface CellRect { i0: number; i1: number; j0: number; j1: number }
export interface Fosse extends CellRect { landing: number; flooded: boolean }

export interface Grid {
  nx: number
  nz: number
  x0: number
  z0: number
  ground: number
  kind: Uint8Array
  h: Float32Array
  ramp: Uint8Array
  rise: Float32Array
  fixed: Uint8Array
  main: Uint8Array
  lot: Int16Array
  lots: Lot[]
  entries: Entry[]
  voids: CellRect[]
  fosses: Fosse[]
  sunk: Uint8Array
  focus: Vec3 | null
  hub: number
}

export const walkable = (k: number) => k === K.Street || k === K.Void || k === K.Water

export function cellX(g: Grid, i: number): number { return g.x0 + (i + 0.5) * GRID }
export function cellZ(g: Grid, j: number): number { return g.z0 + (j + 0.5) * GRID }

function noiseField(nx: number, nz: number, rng: Rng): Float32Array {
  const step = 5
  const cx = Math.ceil(nx / step) + 2
  const cz = Math.ceil(nz / step) + 2
  const coarse = Float32Array.from({ length: cx * cz }, () => rng())
  const out = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const u = i / step
      const v = j / step
      const a = Math.floor(u)
      const b = Math.floor(v)
      const fu = u - a
      const fv = v - b
      const s = (x: number, y: number) => coarse[y * cx + x]!
      const top = s(a, b) * (1 - fu) + s(a + 1, b) * fu
      const bot = s(a, b + 1) * (1 - fu) + s(a + 1, b + 1) * fu
      out[j * nx + i] = top * (1 - fv) + bot * fv
    }
  }
  return out
}

// A* over the grid with a value-noise cost, so streets bend organically instead of running straight.
function carvePath(g: Grid, noise: Float32Array, from: number, to: number): number[] {
  const n = g.nx * g.nz
  const cost = new Float32Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const pdir = new Int8Array(n)
  const open: number[] = [from]
  cost[from] = 0
  const tx = to % g.nx
  const tz = Math.floor(to / g.nx)
  const est = (c: number) => Math.abs((c % g.nx) - tx) + Math.abs(Math.floor(c / g.nx) - tz)
  while (open.length) {
    let bi = 0
    for (let k = 1; k < open.length; k++) if (cost[open[k]!]! + est(open[k]!) < cost[open[bi]!]! + est(open[bi]!)) bi = k
    const c = open[bi]!
    open[bi] = open[open.length - 1]!
    open.pop()
    if (c === to) break
    const ci = c % g.nx
    const cj = Math.floor(c / g.nx)
    for (let d = 1; d <= 4; d++) {
      const ni = ci + DIRS[d]![0]
      const nj = cj + DIRS[d]![1]
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue
      const nc = nj * g.nx + ni
      if (g.fixed[nc] && nc !== to) continue
      const k = g.kind[nc]!
      const step = (walkable(k) ? 0.35 : 1 + STREET.noise * noise[nc]!) + (pdir[c] && pdir[c] !== d ? STREET.turnCost : 0)
      const total = cost[c]! + step
      if (total < cost[nc]!) {
        if (cost[nc] === Infinity) open.push(nc)
        cost[nc] = total
        prev[nc] = c
        pdir[nc] = d
      }
    }
  }
  const path: number[] = []
  for (let c = to; c !== -1; c = prev[c]!) path.push(c)
  return path[path.length - 1] === from ? path.reverse() : []
}

function carve(g: Grid, cells: readonly number[], kind: K.Street | K.Void | K.Water, main: boolean, width: number, rng: Rng): void {
  const side = rng() < 0.5 ? 1 : -1
  for (let p = 0; p < cells.length; p++) {
    const c = cells[p]!
    const i = c % g.nx
    const j = Math.floor(c / g.nx)
    for (let w = 0; w < width; w++) {
      const prevC = cells[Math.max(0, p - 1)]!
      const nextC = cells[Math.min(cells.length - 1, p + 1)]!
      const alongX = Math.floor(prevC / g.nx) === Math.floor(nextC / g.nx)
      const ii = alongX ? i : i + side * w
      const jj = alongX ? j + side * w : j
      if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz) continue
      const cc = jj * g.nx + ii
      if (g.fixed[cc]) continue
      if (g.kind[cc] === K.Empty) g.kind[cc] = kind
      if (main) g.main[cc] = 1
    }
  }
}

function fillRect(g: Grid, i0: number, j0: number, i1: number, j1: number, kind: K): void {
  for (let j = Math.max(0, j0); j <= Math.min(g.nz - 1, j1); j++)
    for (let i = Math.max(0, i0); i <= Math.min(g.nx - 1, i1); i++) if (!g.fixed[j * g.nx + i] && !g.sunk[j * g.nx + i]) g.kind[j * g.nx + i] = kind
}

const inRect = (r: CellRect, c: number, nx: number) => {
  const i = c % nx
  const j = Math.floor(c / nx)
  return i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1
}

function nearEntry(g: Grid, c: number): boolean {
  const i = c % g.nx
  const j = Math.floor(c / g.nx)
  const r = FOSSE.portClear
  return g.entries.some((e) => [e.cell, e.head].some((x) => Math.abs((x % g.nx) - i) <= r && Math.abs(Math.floor(x / g.nx) - j) <= r))
    || g.fixed[c] === 1
}

function sink(g: Grid, f: Fosse, kind: K): void {
  const floor = g.ground - FOSSE.depth
  for (let j = f.j0; j <= f.j1; j++) for (let i = f.i0; i <= f.i1; i++) {
    const c = j * g.nx + i
    if (nearEntry(g, c) || g.sunk[c]) continue
    g.sunk[c] = 1
    g.kind[c] = kind
    g.h[c] = floor
  }
}

// A ramp hugging the rim, from a ground landing where a street meets the fosse down to its floor.
function rampDown(g: Grid, f: Fosse, rim: number, out: Dir): boolean {
  const steps = Math.round(FOSSE.depth / RAMP.risePerCell)
  const tangents = (out === 1 || out === 2 ? [3, 4] : [1, 2]) as Dir[]
  for (const t of tangents) {
    const lane: number[] = []
    for (let k = 0; k <= steps + 1; k++) {
      const i = (rim % g.nx) + DIRS[t][0] * k
      const j = Math.floor(rim / g.nx) + DIRS[t][1] * k
      const c = j * g.nx + i
      if (i < f.i0 || i > f.i1 || j < f.j0 || j > f.j1 || !g.sunk[c] || g.ramp[c]) break
      lane.push(c)
    }
    if (lane.length < steps + 2) continue
    const [landing, ...rest] = lane
    g.h[landing!] = g.ground
    g.kind[landing!] = K.Street
    g.main[landing!] = 1
    for (let k = 0; k < steps; k++) {
      const c = rest[k]!
      g.kind[c] = K.Street
      g.ramp[c] = opposite(t)
      g.rise[c] = RAMP.risePerCell
      g.h[c] = g.ground - RAMP.risePerCell * (k + 1)
      g.main[c] = 1
    }
    if (f.landing < 0) f.landing = landing!
    return true
  }
  return false
}

function rimCrossings(g: Grid, f: Fosse, path: readonly number[]): { rim: number; out: Dir }[] {
  const out: { rim: number; out: Dir }[] = []
  for (let p = 1; p < path.length; p++) {
    const a = path[p - 1]!
    const b = path[p]!
    const ia = g.sunk[a] === 1 && inRect(f, a, g.nx)
    const ib = g.sunk[b] === 1 && inRect(f, b, g.nx)
    if (ia === ib) continue
    const [rim, outside] = ia ? [a, b] : [b, a]
    const di = (outside % g.nx) - (rim % g.nx)
    const dj = Math.floor(outside / g.nx) - Math.floor(rim / g.nx)
    out.push({ rim, out: di > 0 ? 1 : di < 0 ? 2 : dj > 0 ? 3 : 4 })
  }
  return out
}

function entries(g: Grid, plan: DistrictPlan): void {
  const { ground } = LEVELS[plan.layer]
  for (const port of plan.ports) {
    const boundary = port.facing.x !== 0 || port.facing.z !== 0
    let i = Math.min(g.nx - 1, Math.max(0, Math.floor((port.at.x - g.x0) / GRID)))
    let j = Math.min(g.nz - 1, Math.max(0, Math.floor((port.at.z - g.z0) / GRID)))
    const inward: Dir = port.facing.x > 0 ? 2 : port.facing.x < 0 ? 1 : port.facing.z > 0 ? 4 : port.facing.z < 0 ? 3 : plan.layer === 'haut' ? 3 : 4
    const n = Math.ceil(Math.abs(port.at.y - ground) / RAMP.risePerCell - 1e-6)
    const cells: number[] = []
    const start = j * g.nx + i
    let y = port.at.y
    const dy = n ? (ground - port.at.y) / n : 0
    if (boundary) {
      for (let k = 0; k < n; k++) {
        const c = j * g.nx + i
        cells.push(c)
        g.kind[c] = K.Street
        g.fixed[c] = 1
        g.main[c] = 1
        g.ramp[c] = dy > 0 ? inward : opposite(inward)
        g.h[c] = Math.min(y, y + dy)
        g.rise[c] = Math.abs(dy)
        y += dy
        i += DIRS[inward][0]
        j += DIRS[inward][1]
      }
    } else {
      g.kind[start] = K.Street
      g.fixed[start] = 1
      g.main[start] = 1
      g.h[start] = port.at.y
      for (let k = 0; k < n; k++) {
        i += DIRS[inward][0]
        j += DIRS[inward][1]
        const c = j * g.nx + i
        g.kind[c] = K.Street
        g.fixed[c] = 1
        g.main[c] = 1
        g.ramp[c] = dy > 0 ? inward : opposite(inward)
        g.h[c] = Math.min(y, y + dy)
        g.rise[c] = Math.abs(dy)
        y += dy
      }
      i += DIRS[inward][0]
      j += DIRS[inward][1]
    }
    const head = j * g.nx + i
    g.entries.push({ port, cell: start, head, open: boundary ? 0 : opposite(inward) })
  }
}

function packLots(g: Grid, rng: Rng, water: boolean): void {
  const pick = (r: readonly [number, number]) => r[0] + Math.floor(rng() * (r[1] - r[0] + 1))
  const leftover = water ? K.Water : K.Street
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      if (g.kind[j * g.nx + i] !== K.Empty) continue
      const along = rng() < 0.5
      const tw = along ? pick(LOT.maxSide) : pick(LOT.maxLong)
      const td = along ? pick(LOT.maxLong) : pick(LOT.maxSide)
      let w = 0
      while (w < tw && i + w < g.nx && g.kind[j * g.nx + i + w] === K.Empty) w++
      let d = 0
      grow: while (d < td && j + d < g.nz) {
        for (let k = 0; k < w; k++) if (g.kind[(j + d) * g.nx + i + k] !== K.Empty) break grow
        d++
      }
      if (w < LOT.minSide || d < LOT.minSide) {
        for (let k = 0; k < Math.max(1, Math.min(w, LOT.kioskMax)); k++) g.kind[j * g.nx + i + k] = leftover
        continue
      }
      const lot: Lot = { id: g.lots.length, i0: i, i1: i + w - 1, j0: j, j1: j + d - 1, storeys: 1 }
      g.lots.push(lot)
      for (let jj = lot.j0; jj <= lot.j1; jj++) for (let ii = lot.i0; ii <= lot.i1; ii++) {
        g.kind[jj * g.nx + ii] = K.Lot
        g.lot[jj * g.nx + ii] = lot.id
      }
    }
  }
}

function frontage(g: Grid, lot: Lot): number {
  let n = 0
  const test = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return
    const c = j * g.nx + i
    if (walkable(g.kind[c]!) && !g.ramp[c] && g.h[c] === g.ground) n++
  }
  for (let i = lot.i0; i <= lot.i1; i++) { test(i, lot.j0 - 1); test(i, lot.j1 + 1) }
  for (let j = lot.j0; j <= lot.j1; j++) { test(lot.i0 - 1, j); test(lot.i1 + 1, j) }
  return n
}

function components(g: Grid): number[][] {
  const seen = new Uint8Array(g.kind.length)
  const out: number[][] = []
  for (let c = 0; c < g.kind.length; c++) {
    if (seen[c] || g.kind[c] !== K.Empty) continue
    const comp: number[] = []
    const stack = [c]
    seen[c] = 1
    while (stack.length) {
      const x = stack.pop()!
      comp.push(x)
      const i = x % g.nx
      const j = Math.floor(x / g.nx)
      for (let d = 1; d <= 4; d++) {
        const ni = i + DIRS[d]![0]
        const nj = j + DIRS[d]![1]
        if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue
        const nc = nj * g.nx + ni
        if (!seen[nc] && g.kind[nc] === K.Empty) {
          seen[nc] = 1
          stack.push(nc)
        }
      }
    }
    out.push(comp)
  }
  return out
}

function nearestWalkable(g: Grid, from: number): number {
  const seen = new Uint8Array(g.kind.length)
  const queue = [from]
  seen[from] = 1
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!
    if (c !== from && walkable(g.kind[c]!) && !g.ramp[c] && !g.fixed[c]) return c
    const i = c % g.nx
    const j = Math.floor(c / g.nx)
    for (let d = 1; d <= 4; d++) {
      const ni = i + DIRS[d]![0]
      const nj = j + DIRS[d]![1]
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue
      const nc = nj * g.nx + ni
      if (!seen[nc]) {
        seen[nc] = 1
        queue.push(nc)
      }
    }
  }
  return from
}

const MAX_STOREYS: Readonly<Record<string, number>> = { rue: 2, atrium: 3, 'nef-longue': 2, grappe: 3, puits: 2, archipel: 2, terrasses: 3 }

export function planGrid(plan: DistrictPlan, variant: number): Grid {
  const rng = mulberry32((plan.seed + variant * 0x9e3779b1) >>> 0)
  const b = plan.bounds
  const nx = Math.round((b.x1 - b.x0) / GRID)
  const nz = Math.round((b.z1 - b.z0) / GRID)
  const n = nx * nz
  const lv = LEVELS[plan.layer]
  const g: Grid = {
    nx, nz, x0: b.x0, z0: b.z0, ground: lv.ground,
    kind: new Uint8Array(n), h: new Float32Array(n).fill(lv.ground), ramp: new Uint8Array(n), rise: new Float32Array(n),
    fixed: new Uint8Array(n), main: new Uint8Array(n), lot: new Int16Array(n).fill(-1), lots: [], entries: [], voids: [],
    fosses: [], sunk: new Uint8Array(n), focus: null, hub: 0,
  }
  const noise = noiseField(nx, nz, rng)
  const water = plan.shape === 'archipel'
  const voidKind = water ? K.Water : K.Void

  const flooded = water || ARCHETYPES[plan.archetype].materials.includes('eau')
  const vs = SHAPE_VOID[plan.shape] ?? FOSSE.plain
  entries(g, plan)
  const vw = Math.min(nx - 4, vs[0] + Math.floor(rng() * 2))
  const vd = vs[1] === 0 ? nz - 4 : Math.min(nz - 4, vs[1] + Math.floor(rng() * 2))
  const clear = (r: CellRect) => {
    for (let j = r.j0 - FOSSE.portClear; j <= r.j1 + FOSSE.portClear; j++)
      for (let i = r.i0 - FOSSE.portClear; i <= r.i1 + FOSSE.portClear; i++) if (i >= 0 && j >= 0 && i < nx && j < nz && g.fixed[j * nx + i]) return false
    return !g.entries.some((e) => inRect({ i0: r.i0 - 1, i1: r.i1 + 1, j0: r.j0 - 1, j1: r.j1 + 1 }, e.head, nx))
  }
  let vr: CellRect | null = null
  for (let k = 0; k < FOSSE.tries && !(vr && clear(vr)); k++) {
    const ci = Math.floor(nx / 2 + (rng() - 0.5) * nx * (k ? 0.6 : 0.25))
    const cj = Math.floor(nz / 2 + (rng() - 0.5) * nz * (k ? 0.6 : 0.2))
    const i0 = Math.max(2, Math.min(nx - 2 - vw, ci - Math.floor(vw / 2)))
    const j0 = Math.max(2, Math.min(nz - 2 - vd, cj - Math.floor(vd / 2)))
    vr = { i0, i1: i0 + vw - 1, j0, j1: j0 + vd - 1 }
  }
  g.voids.push(vr!)
  if (plan.layer === 'haut' && vs[1] > 0) {
    const f: Fosse = { ...g.voids[0]!, landing: -1, flooded }
    sink(g, f, flooded ? K.Water : K.Void)
    g.fosses.push(f)
  }
  for (const v of g.voids) fillRect(g, v.i0, v.j0, v.i1, v.j1, voidKind)
  const v0 = g.voids[0]
  g.focus = v0 ? { x: g.x0 + ((v0.i0 + v0.i1 + 1) / 2) * GRID, y: g.fosses.length ? lv.ground - FOSSE.depth : lv.ground, z: g.z0 + ((v0.j0 + v0.j1 + 1) / 2) * GRID } : null
  g.hub = v0
    ? Math.floor((v0.j0 + v0.j1) / 2) * nx + Math.floor((v0.i0 + v0.i1) / 2)
    : Math.floor(nz / 2 + (rng() - 0.5) * 4) * nx + Math.floor(nx / 2 + (rng() - 0.5) * 4)

  const heads = g.entries.map((e) => e.head)
  const paths: number[][] = []
  const main = (from: number, to: number) => {
    const p = carvePath(g, noise, from, to)
    paths.push(p)
    carve(g, p, K.Street, true, STREET.mainWidth, rng)
  }
  for (const h of heads) main(h, g.hub)
  if (plan.shape === 'rue' || plan.shape === 'terrasses' || heads.length < 2) {
    const a = Math.floor(nx * (0.25 + rng() * 0.5))
    const z = Math.floor(nx * (0.25 + rng() * 0.5))
    main(1 * nx + a, g.hub)
    main(g.hub, (nz - 2) * nx + z)
  }
  for (const f of g.fosses) {
    const landings: number[] = []
    const near = (c: number) => landings.some((l) => Math.max(Math.abs((l % nx) - (c % nx)), Math.abs(Math.floor(l / nx) - Math.floor(c / nx))) <= FOSSE.rampGap)
    for (const x of paths.flatMap((p) => rimCrossings(g, f, p))) {
      if (landings.length >= FOSSE.ramps || near(x.rim)) continue
      if (rampDown(g, f, x.rim, x.out)) landings.push(x.rim)
    }
  }
  for (let c = 0, run = 0; c < n; c++) {
    if (!g.main[c] || g.fixed[c]) continue
    if (++run % STREET.plazaEvery !== 0) continue
    const i = c % nx
    const j = Math.floor(c / nx)
    fillRect(g, i - 1, j - 1, i + 1, j + 1, voidKind)
  }
  for (let guard = 0; guard < 24; guard++) {
    const big = components(g).filter((comp) => comp.length > STREET.alleyComponent)
    if (!big.length) break
    const comp = big[0]!
    const mid = comp[Math.floor(rng() * comp.length)]!
    const to = nearestWalkable(g, mid)
    carve(g, carvePath(g, noise, mid, to), water ? K.Water : K.Street, false, 1, rng)
  }
  packLots(g, rng, water)
  const leftover = water ? K.Water : K.Street
  for (const lot of g.lots) {
    if (frontage(g, lot) > 0) continue
    for (let j = lot.j0; j <= lot.j1; j++) for (let i = lot.i0; i <= lot.i1; i++) {
      g.kind[j * nx + i] = leftover
      g.lot[j * nx + i] = -1
    }
    lot.storeys = 0
  }
  g.lots = g.lots.filter((l) => l.storeys > 0).map((l, id) => ({ ...l, id }))
  g.lot.fill(-1)
  const maxS = Math.min(lv.storeys, MAX_STOREYS[plan.shape] ?? 2)
  for (const lot of g.lots) {
    const long = Math.max(lot.i1 - lot.i0, lot.j1 - lot.j0) + 1
    lot.storeys = long >= 4 ? 1 + Math.floor(rng() * maxS) : 1
    if (long >= 4 && lot.storeys === 1 && rng() < 0.5) lot.storeys = Math.min(maxS, 2)
    for (let j = lot.j0; j <= lot.j1; j++) for (let i = lot.i0; i <= lot.i1; i++) g.lot[j * nx + i] = lot.id
  }
  for (let c = 0; c < n; c++) if (g.kind[c] === K.Water && !g.ramp[c] && !g.fixed[c] && !g.sunk[c]) g.h[c] = lv.ground - WATER.depth
  return g
}
