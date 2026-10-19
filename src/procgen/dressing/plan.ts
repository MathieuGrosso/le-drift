import { hashString, mulberry32 } from '../../core/rng'
import type { Vec3 } from '../../core/types'
import { ARCHETYPES } from '../archetypes'
import type { ArchetypeDef, Box, CellSpec, Job, Rect, ColliderSpec, DressInput, DressSlot, DistrictShell, LampSpec, Rng } from '../types'
import { CLUSTERS, facade, murDecor, pipeRun, type Frame } from './clusters'
import { MOODS, type Mood } from './moods'
import { RECIPES, type ClusterId, type Recipe, type Weighted } from './recipes'
import { DRESS } from './tuning'

export type PropKind =
  | 'caisse' | 'tonneau' | 'sac' | 'panier' | 'bocaux' | 'seau' | 'etagere' | 'table' | 'tabouret' | 'banc'
  | 'comptoir' | 'bobine' | 'rouleau' | 'bassin' | 'claie' | 'fourneau' | 'enclume' | 'toles' | 'lunette'
  | 'livres' | 'horloge' | 'couchette' | 'berceau' | 'cierges' | 'vanne' | 'manometre' | 'tuyaux' | 'engrenage'
  | 'jardiniere' | 'arrosoir' | 'chat' | 'jouets' | 'bouee' | 'marionnette' | 'epuisette'
  | 'fougere' | 'herbes' | 'lierre' | 'laminaire'

export type LampKind = 'suspension' | 'applique' | 'lampadaire' | 'lanterne' | 'verte' | 'globe'
export type ClothLineKind = 'linge' | 'fanions' | 'ampoules' | 'filet' | 'poissons'
export type EmitterKind = 'vapeur' | 'poussiere' | 'gouttes' | 'etincelles' | 'bulles' | 'braises'

export interface DressPalette { mur: number; bois: number; boisOmbre: number; metal: number; tissu: readonly number[]; accent: number; lampe: number }

export interface PropPlacement { kind: PropKind; x: number; y: number; z: number; rot: number; s: number; tint: number; glass: boolean }
export interface ClothPiece { x: number; y: number; z: number; w: number; h: number; rot: number; pitch: number; color: number; t?: number }
export interface Pipe { a: Vec3; b: Vec3; r: number; color: number; brackets: number }
export interface Wire { a: Vec3; b: Vec3; r: number }
export interface Bulb { x: number; y: number; z: number; color: number; size: number }
export interface DressLamp { kind: LampKind; cell: string; x: number; y: number; z: number; rot: number; color: number; radius: number; drop: number; live: boolean }
export interface Emitter { kind: EmitterKind; box: Box; count: number }
export interface Porthole { x: number; y: number; z: number; nx: number; nz: number; lit: boolean; color: number }
export interface Pool { x: number; y: number; z: number; r: number; color: number; opacity: number }

export interface DressPlan {
  palette: DressPalette
  ambient: number
  props: readonly PropPlacement[]
  cloth: readonly ClothPiece[]
  pipes: readonly Pipe[]
  wires: readonly Wire[]
  bulbs: readonly Bulb[]
  lamps: readonly DressLamp[]
  bakeLamps: readonly LampSpec[]
  emitters: readonly Emitter[]
  portholes: readonly Porthole[]
  pools: readonly Pool[]
}

// Half extents of the solid props at scale 1 (climbable, so Ilo can use clutter as steps).
const SOLID: Partial<Record<PropKind, readonly [number, number, number]>> = {
  caisse: [0.3, 0.3, 0.3], tonneau: [0.32, 0.43, 0.32], etagere: [0.6, 0.95, 0.18], table: [0.7, 0.38, 0.4],
  banc: [0.8, 0.25, 0.19], comptoir: [0.9, 0.5, 0.35], bobine: [0.5, 0.5, 0.25], bassin: [0.6, 0.28, 0.6],
  fourneau: [0.5, 0.47, 0.35], enclume: [0.35, 0.43, 0.15], couchette: [0.98, 0.25, 0.43], horloge: [0.23, 0.95, 0.15],
  jardiniere: [0.7, 0.25, 0.25], engrenage: [0.85, 0.75, 0.1],
}

export const isSolid = (kind: PropKind) => SOLID[kind] !== undefined

export function pick<T>(rng: Rng, list: Weighted<T>): T {
  let total = 0
  for (const [, w] of list) total += w
  let r = rng() * total
  for (const [v, w] of list) {
    r -= w
    if (r <= 0) return v
  }
  return list[list.length - 1]![0]
}

export function pickOne<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]!
}

function shiftColor(hex: number, dh: number, dv: number): number {
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  h = (((h * 60 + dh) % 360) + 360) % 360
  const l2 = Math.min(1, Math.max(0, l * (1 + dv)))
  const c = (1 - Math.abs(2 * l2 - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l2 - c / 2
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v + m)) * 255)
  return (to(r1) << 16) | (to(g1) << 8) | to(b1)
}

function districtPalette(a: ArchetypeDef, rng: Rng): DressPalette {
  const dh = (rng() * 2 - 1) * DRESS.hueShiftDeg
  const dv = (rng() * 2 - 1) * DRESS.valueShift
  const s = (hex: number) => shiftColor(hex, dh, dv)
  return {
    mur: s(a.palette.mur), bois: s(a.palette.bois), boisOmbre: s(0x5e4a5c), metal: s(a.palette.metal),
    tissu: a.palette.tissu.map(s), accent: s(a.palette.accent), lampe: a.light.lampe,
  }
}

function inside(b: Box, x: number, y: number, z: number, pad = 0): boolean {
  return x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad && z >= b.z0 - pad && z <= b.z1 + pad
}

// Collects everything clusters emit, in the drift-local frame, rejecting what falls in content's reserved boxes.
export class Dresser {
  readonly props: PropPlacement[] = []
  readonly cloth: ClothPiece[] = []
  readonly pipes: Pipe[] = []
  readonly wires: Wire[] = []
  readonly bulbs: Bulb[] = []
  readonly lamps: DressLamp[] = []
  readonly bakeLamps: LampSpec[] = []
  readonly emitters: Emitter[] = []

  constructor(
    readonly rng: Rng,
    readonly pal: DressPalette,
    readonly recipe: Recipe,
    readonly shell: DistrictShell,
    private readonly keepOut: readonly Box[],
    private readonly moods: ReadonlyMap<string, Mood>,
    private readonly tints: ReadonlyMap<string, number>,
  ) {}

  mood(cell: string): Mood {
    return this.moods.get(cell) ?? MOODS.range
  }

  // Each room keeps one dominant cloth colour so neighbouring rooms read apart.
  tissu(cell: string): number {
    const own = this.tints.get(cell)
    return own !== undefined && this.rng() < DRESS.roomTint ? own : pickOne(this.rng, this.pal.tissu)
  }

  catChance(cell: string): number {
    return this.recipe.cats * this.mood(cell).cats
  }

  roof(cell: string, fallback: number): number {
    return this.shell.cells.find((c) => c.id === cell)?.roof ?? fallback
  }

  blocked(x: number, y: number, z: number): boolean {
    return this.keepOut.some((b) => inside(b, x, y, z, 0.3))
  }

  prop(kind: PropKind, x: number, y: number, z: number, rot: number, s = 1, glass = false): boolean {
    if (this.blocked(x, y, z)) return false
    const tint = 1 + (this.rng() * 2 - 1) * DRESS.tintJitter
    this.props.push({ kind, x, y, z, rot, s, tint, glass })
    return true
  }

  sheet(p: ClothPiece): void {
    if (!this.blocked(p.x, p.y, p.z)) this.cloth.push(p)
  }

  lamp(l: Omit<DressLamp, 'live'>): void {
    if (this.blocked(l.x, l.y - l.drop, l.z) || this.rng() > this.mood(l.cell).lamps) return
    this.lamps.push({ ...l, live: false })
  }

  bake(cell: string, at: Vec3, color: number, radius: number): void {
    this.bakeLamps.push({ cell, at, color, radius, live: false })
  }

  line(kind: ClothLineKind, a: Vec3, b: Vec3, sag: number, cell: string): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (len < 1.2) return
    const rot = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2
    const spacing = kind === 'fanions' ? DRESS.cloth.flagSpacing : kind === 'ampoules' ? DRESS.cloth.bulbSpacing : DRESS.cloth.lineSpacing
    const n = Math.max(2, Math.round(len / spacing))
    const at = (t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, z: a.z + (b.z - a.z) * t })
    let prev = at(0)
    for (let i = 1; i <= n; i++) {
      const p = at(i / n)
      this.wires.push({ a: prev, b: p, r: 0.012 })
      prev = p
    }
    const tissu = this.pal.tissu
    let k = Math.floor(this.rng() * tissu.length)
    for (let i = 1; i < n; i++) {
      const p = at(i / n)
      if (this.blocked(p.x, p.y, p.z)) continue
      switch (kind) {
        case 'linge': {
          if (this.rng() < 0.22) break
          const h = 0.45 + this.rng() * 0.7
          const color = this.rng() < 0.45 ? pickOne(this.rng, [0xf4f1e6, 0xefe3c4, 0xe9dcc2]) : pickOne(this.rng, tissu)
          this.cloth.push({ x: p.x, y: p.y - h / 2 - 0.02, z: p.z, w: 0.35 + this.rng() * 0.4, h, rot: rot + (this.rng() - 0.5) * 0.15, pitch: (this.rng() - 0.5) * 0.12, color })
          break
        }
        case 'fanions':
          this.cloth.push({ x: p.x, y: p.y - 0.17, z: p.z, w: 0.3, h: 0.32, rot, pitch: 0, color: tissu[k++ % tissu.length]! })
          break
        case 'poissons':
          for (let j = 0; j < 2; j++) {
            const off = (j - 0.5) * 0.18
            this.cloth.push({ x: p.x + Math.cos(rot) * off, y: p.y - 0.2 - this.rng() * 0.1, z: p.z - Math.sin(rot) * off, w: 0.1, h: 0.34, rot, pitch: 0, color: 0x9fb8c8 })
          }
          break
        case 'filet':
          this.wires.push({ a: p, b: { x: p.x, y: p.y - 0.9 - this.rng() * 0.6, z: p.z }, r: 0.008 })
          if (i % 3 === 0) this.cloth.push({ x: p.x, y: p.y - 0.08, z: p.z, w: 0.16, h: 0.1, rot, pitch: 0, color: 0xe3b95f })
          break
        case 'ampoules':
          this.bulbs.push({ x: p.x, y: p.y - 0.1, z: p.z, color: this.pal.lampe, size: 0.08 })
          if (i % DRESS.cloth.bulbBakeEvery === 0) this.bake(cell, { x: p.x, y: p.y - 0.2, z: p.z }, this.pal.lampe, 4.5)
          break
      }
    }
  }

  emit(kind: EmitterKind, box: Box, density: number): void {
    const vol = Math.max(1, (box.x1 - box.x0) * (box.y1 - box.y0) * (box.z1 - box.z0))
    const count = Math.round(Math.min(DRESS.emitMax, Math.max(12, vol * DRESS.emitPerM3[kind] * density)))
    this.emitters.push({ kind, box, count })
  }
}

// Layout's convention: yaw turns +z into the room (v), sol and plafond slots are anchored at their centre.
function frameOf(slot: DressSlot, d: Dresser): Frame {
  const c = Math.cos(slot.yaw)
  const s = Math.sin(slot.yaw)
  const back = slot.kind === 'sol' || slot.kind === 'plafond' ? slot.d / 2 : 0
  return {
    slot,
    d,
    at: (u, v, y = 0) => ({ x: slot.at.x + c * u + s * (v - back), y: slot.at.y + y, z: slot.at.z - s * u + c * (v - back) }),
    rot: (local = 0) => slot.yaw + local,
  }
}

// A floor slot on a walked tile moves to the tile's edge beside the path (a corner at a turn), facing it.
function sidestepper(shell: DistrictShell, rng: Rng): (slot: DressSlot) => DressSlot {
  const at = new Map(shell.walk.nodes.map((n) => [n.id, n.at]))
  const dirs = new Map<string, { x: number; z: number }[]>()
  const key = (p: Vec3) => `${Math.round(p.x * 2)}:${Math.round(p.y)}:${Math.round(p.z * 2)}`
  for (const e of shell.walk.edges) {
    const a = at.get(e.a)
    const b = at.get(e.b)
    if (!a || !b) continue
    for (const [p, q] of [[a, b], [b, a]] as const) {
      const list = dirs.get(key(p)) ?? []
      list.push({ x: q.x - p.x, z: q.z - p.z })
      dirs.set(key(p), list)
    }
  }
  const { depth } = DRESS.aside
  return (slot) => {
    if (slot.kind !== 'sol' || !slot.onPath) return slot
    const ds = dirs.get(key(slot.at))
    if (!ds) return slot
    const alongX = ds.some((v) => Math.abs(v.x) > Math.abs(v.z))
    const alongZ = ds.some((v) => Math.abs(v.z) >= Math.abs(v.x))
    const sx = rng() < 0.5 ? -1 : 1
    const sz = rng() < 0.5 ? -1 : 1
    const hx = slot.w / 2 - depth / 2
    const hz = slot.d / 2 - depth / 2
    if (alongX && alongZ) {
      const inset = DRESS.aside.cornerInset
      return { ...slot, kind: 'coin', at: { x: slot.at.x + sx * (slot.w / 2 - inset), y: slot.at.y, z: slot.at.z + sz * (slot.d / 2 - inset) }, yaw: Math.atan2(-sx, -sz), w: depth, d: depth }
    }
    const off = alongX ? { x: 0, z: sz * hz } : { x: sx * hx, z: 0 }
    const yaw = alongX ? (sz > 0 ? Math.PI : 0) : sx > 0 ? -Math.PI / 2 : Math.PI / 2
    return { ...slot, at: { x: slot.at.x + off.x, y: slot.at.y, z: slot.at.z + off.z }, yaw, w: alongX ? slot.w : slot.d, d: depth }
  }
}

// Long wall runs become bays of a few metres, each with its own cluster, so a corridor never repeats one prop.
function bays(slot: DressSlot, rng: Rng): DressSlot[] {
  const { min, max, gap, split } = DRESS.bay
  if ((slot.kind !== 'mur' && slot.kind !== 'rambarde') || slot.w <= split) return [slot]
  const out: DressSlot[] = []
  const c = Math.cos(slot.yaw)
  const s = Math.sin(slot.yaw)
  let u = -slot.w / 2
  while (slot.w / 2 - u >= min) {
    const w = Math.min(slot.w / 2 - u, min + rng() * (max - min))
    const mid = u + w / 2
    out.push({ ...slot, at: { x: slot.at.x + c * mid, y: slot.at.y, z: slot.at.z - s * mid }, w: w - gap })
    u += w
  }
  return out
}

// Doors make the street: every seuil gets a facade, and neighbouring doors are strung together.
function dressStreets(d: Dresser, shell: DistrictShell): void {
  const doors = shell.slots.filter((s) => s.kind === 'seuil')
  for (const s of doors) facade(frameOf(s, d))
  const [near, far] = DRESS.facade.garlandSpan
  doors.forEach((a, i) => {
    const b = doors.slice(i + 1).find((o) => o.cell === a.cell && Math.abs(o.at.y - a.at.y) < 1 && Math.hypot(o.at.x - a.at.x, o.at.z - a.at.z) > near && Math.hypot(o.at.x - a.at.x, o.at.z - a.at.z) < far)
    if (!b || d.rng() > DRESS.facade.garland) return
    const y = DRESS.facade.garlandY
    const back = (s: DressSlot) => ({ x: s.at.x - Math.sin(s.yaw) * (s.d - 0.2), y: s.at.y + y, z: s.at.z - Math.cos(s.yaw) * (s.d - 0.2) })
    const pa = back(a)
    const pb = back(b)
    d.line(d.rng() < 0.5 ? 'ampoules' : 'fanions', pa, pb, Math.hypot(pb.x - pa.x, pb.z - pa.z) * 0.06, a.cell)
  })
}

// Life left on the ground beside the walked line: scraps in the archetype's trade, now and then a dropped object.
function dressPaths(d: Dresser, shell: DistrictShell, cells: ReadonlyMap<string, CellSpec>): void {
  const { every, chance, reach, objet } = DRESS.scrap
  const at = new Map(shell.walk.nodes.map((n) => [n.id, n] as const))
  const { colors, size, count } = SCRAPS[d.recipe.scraps]
  const small = d.recipe.goods.filter((g) => !isSolid(g) && g !== 'chat')
  for (const e of shell.walk.edges) {
    if (e.kind !== 'sol') continue
    const a = at.get(e.a)
    const b = at.get(e.b)
    if (!a || !b || Math.abs(a.at.y - b.at.y) > 0.3) continue
    const len = Math.hypot(b.at.x - a.at.x, b.at.z - a.at.z)
    const nx = (b.at.z - a.at.z) / (len || 1)
    const nz = -(b.at.x - a.at.x) / (len || 1)
    for (let t = d.rng() * every; t < len; t += every) {
      if (d.rng() > chance * (e.main ? 1 : 0.5)) continue
      const side = (d.rng() < 0.5 ? -1 : 1) * (reach[0] + d.rng() * (reach[1] - reach[0]))
      const x = a.at.x + ((b.at.x - a.at.x) * t) / len + nx * side
      const z = a.at.z + ((b.at.z - a.at.z) * t) / len + nz * side
      const fy = floorUnder(shell, cells, a.cell, x, a.at.y + 0.5, z)
      if (fy === null || Math.abs(fy - a.at.y) > 0.3) continue
      if (small.length > 0 && d.rng() < objet) {
        d.prop(pickOne(d.rng, small), x, fy, z, d.rng() * 6, 0.6 + d.rng() * 0.3)
        continue
      }
      for (let i = 0, n = 1 + Math.floor(d.rng() * count); i < n; i++) {
        const k = size * (0.7 + d.rng() * 0.6)
        d.sheet({ x: x + (d.rng() - 0.5) * 0.6, y: fy + 0.012 + i * 0.002, z: z + (d.rng() - 0.5) * 0.6, w: k * 0.8, h: k, rot: d.rng() * 6, pitch: Math.PI / 2, color: pickOne(d.rng, colors), t: 0.004 })
      }
    }
  }
}

const SCRAPS: Readonly<Record<Recipe['scraps'], { colors: readonly number[]; size: number; count: number }>> = {
  papier: { colors: [0xf1e4c8, 0xe9dcc2, 0xefe3c4, 0xd9c7a2], size: 0.16, count: 2 },
  linge: { colors: [0xf4f1e6, 0xe9dcc2, 0x9fc4d6, 0xe8a598], size: 0.28, count: 1 },
  ecailles: { colors: [0x9fb8c8, 0xc5d6de, 0x7f98a8], size: 0.045, count: 6 },
  limaille: { colors: [0x52576a, 0x6a5c52, 0x8a8f99], size: 0.06, count: 5 },
  feuilles: { colors: [0x8fbf6a, 0x6f9a5a, 0xc9a66b, 0xa8b860], size: 0.09, count: 5 },
  sciure: { colors: [0xd9b48f, 0xc9a66b, 0xe3c79a], size: 0.07, count: 6 },
}

function dressMoods(d: Dresser, shell: DistrictShell): void {
  for (const c of shell.cells) {
    const mood = d.mood(c.id)
    const b = c.boxes[0]
    if (!b) continue
    if (mood.dust) d.emit('poussiere', { x0: b.x0 + 0.5, x1: b.x1 - 0.5, y0: b.y0 + 0.3, y1: Math.min(c.roof, b.y1), z0: b.z0 + 0.5, z1: b.z1 - 0.5 }, DRESS.dustRoom)
    if (!mood.lines) continue
    const y = Math.min(c.roof, b.y1) - DRESS.cloth.festoonDrop
    if (y - b.y0 < 2.6) continue
    const n = 1 + Math.floor(d.rng() * 3)
    for (let i = 0; i < n; i++) {
      const t0 = d.rng()
      const t1 = d.rng()
      const alongX = b.x1 - b.x0 > b.z1 - b.z0
      const a = alongX ? { x: b.x0 + 0.3, y, z: b.z0 + (b.z1 - b.z0) * t0 } : { x: b.x0 + (b.x1 - b.x0) * t0, y, z: b.z0 + 0.3 }
      const e = alongX ? { x: b.x1 - 0.3, y: y - d.rng() * 0.4, z: b.z0 + (b.z1 - b.z0) * t1 } : { x: b.x0 + (b.x1 - b.x0) * t1, y: y - d.rng() * 0.4, z: b.z1 - 0.3 }
      d.line(pick(d.rng, mood.lines), a, e, Math.hypot(e.x - a.x, e.z - a.z) * 0.05, c.id)
    }
  }
}

function nearVoid(shell: DistrictShell, p: Vec3): boolean {
  const r = DRESS.voidReach
  return shell.voids.some((v) => p.x > v.box.x0 - r && p.x < v.box.x1 + r && p.z > v.box.z0 - r && p.z < v.box.z1 + r)
}

function floorUnder(shell: DistrictShell, cells: ReadonlyMap<string, CellSpec>, cell: string, x: number, y: number, z: number): number | null {
  let best: number | null = null
  for (const f of shell.floors) {
    if (x < f.box.x0 || x > f.box.x1 || z < f.box.z0 || z > f.box.z1 || f.box.y1 > y) continue
    if (best === null || f.box.y1 > best) best = f.box.y1
  }
  if (best !== null) return best
  const c = cells.get(cell)
  if (!c) return null
  for (const b of c.boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y0 <= y) return b.y0
  return null
}

function dressVoids(d: Dresser, shell: DistrictShell): void {
  const { rng, recipe } = d
  for (const v of shell.voids) {
    const b = v.box
    const [lo, hi] = recipe.linesPerVoid
    const n = lo + Math.floor(rng() * (hi - lo + 1))
    const alongX = b.x1 - b.x0 < b.z1 - b.z0
    for (let i = 0; i < n; i++) {
      const y = b.y0 + 3 + rng() * Math.max(1, b.y1 - b.y0 - 5)
      const t0 = rng()
      const t1 = Math.min(1, Math.max(0, t0 + (rng() - 0.5) * 0.4))
      const a = alongX ? { x: b.x0, y, z: b.z0 + (b.z1 - b.z0) * t0 } : { x: b.x0 + (b.x1 - b.x0) * t0, y, z: b.z0 }
      const e = alongX ? { x: b.x1, y: y + (rng() - 0.5) * 1.5, z: b.z0 + (b.z1 - b.z0) * t1 } : { x: b.x0 + (b.x1 - b.x0) * t1, y: y + (rng() - 0.5) * 1.5, z: b.z1 }
      const span = Math.hypot(e.x - a.x, e.z - a.z)
      d.line(pick(rng, recipe.lines), a, e, span * (0.04 + rng() * 0.04), v.cell)
    }
    const kind = recipe.emitters.vide
    if (kind) d.emit(kind, { x0: b.x0 + 1, x1: b.x1 - 1, y0: b.y0, y1: b.y1, z0: b.z0 + 1, z1: b.z1 - 1 }, 1)
  }
  const water = recipe.emitters.eau
  if (water) {
    const picks = sampleByArea(shell.waters, (w) => w.rect, Math.min(DRESS.waterEmitters, shell.waters.length), rng)
    const density = (0.4 * shell.waters.length) / Math.max(1, picks.length)
    for (const w of picks) d.emit(water, { x0: w.rect.x0, x1: w.rect.x1, y0: w.y - 3, y1: w.y, z0: w.rect.z0, z1: w.rect.z1 }, density)
  }
}

interface Bed { cell: string; rect: Rect; top: number; water: number | null }

const areaOf = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0)

// n picks weighted by area (with repeats): water comes as hundreds of grid tiles, never as one basin.
function sampleByArea<T>(items: readonly T[], rect: (t: T) => Rect, n: number, rng: Rng): T[] {
  const total = items.reduce((s, t) => s + areaOf(rect(t)), 0)
  if (total <= 0) return []
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    let r = rng() * total
    const hit = items.find((t) => (r -= areaOf(rect(t))) <= 0)
    if (hit) out.push(hit)
  }
  return out
}

function nearWalk(shell: DistrictShell, x: number, y: number, z: number, r: number): boolean {
  const at = new Map(shell.walk.nodes.map((n) => [n.id, n.at]))
  return shell.walk.edges.some((e) => {
    const a = at.get(e.a)
    const b = at.get(e.b)
    if (!a || !b || Math.abs((a.y + b.y) / 2 - y) > 2.5) return false
    const dx = b.x - a.x
    const dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)))
    return Math.hypot(a.x + dx * t - x, a.z + dz * t - z) < r
  })
}

// Kelp groves: on the floor of glass voids where the archetype grows kelp, and in every flooded street.
function dressGroves(d: Dresser, shell: DistrictShell, cells: ReadonlyMap<string, CellSpec>): void {
  const { rng } = d
  const { areaPer, maxClumps, perClump, scale, clear, clearWater } = DRESS.grove
  const beds: Bed[] = shell.waters.map((w) => ({ cell: w.cell, rect: w.rect, top: w.y + 0.5, water: w.y }))
  if (d.recipe.plants.includes('laminaire')) for (const v of shell.voids) beds.push({ cell: v.cell, rect: v.box, top: v.box.y1, water: null })
  const area = beds.reduce((s, b) => s + areaOf(b.rect), 0)
  for (const bed of sampleByArea(beds, (b) => b.rect, Math.min(maxClumps, Math.round(area / areaPer)), rng)) {
    const { x0, x1, z0, z1 } = bed.rect
    const cx = x0 + 0.5 + rng() * Math.max(0, x1 - x0 - 1)
    const cz = z0 + 0.5 + rng() * Math.max(0, z1 - z0 - 1)
    const fy = floorUnder(shell, cells, bed.cell, cx, bed.top, cz)
    if (fy === null || nearWalk(shell, cx, fy, cz, bed.water === null ? clear : clearWater)) continue
    const room = bed.water === null ? scale[1] : Math.max(0.4, (bed.water - fy + 0.6) / DRESS.kelpHeight)
    const k = perClump[0] + Math.floor(rng() * (perClump[1] - perClump[0] + 1))
    for (let j = 0; j < k; j++) {
      const a = rng() * Math.PI * 2
      const r = (0.3 + rng() * 1.4) * (bed.water === null ? 1 : 0.35)
      d.prop('laminaire', cx + Math.cos(a) * r, fy, cz + Math.sin(a) * r, rng() * 6, Math.min(room, scale[0] + rng() * (scale[1] - scale[0])) * (1 - r * 0.15))
    }
  }
}

function dressWindows(d: Dresser, shell: DistrictShell, cells: ReadonlyMap<string, CellSpec>, pools: Pool[]): void {
  for (const w of shell.windows) {
    const len = Math.hypot(w.normal.x, w.normal.z) || 1
    const nx = -w.normal.x / len
    const nz = -w.normal.z / len
    const reach = Math.min(4, 1 + w.h * 0.6)
    const px = w.at.x + nx * reach
    const pz = w.at.z + nz * reach
    const fy = floorUnder(shell, cells, w.cell, px, w.at.y, pz)
    if (fy !== null && w.at.y - fy < DRESS.pool.maxDrop) pools.push({ x: px, y: fy + 0.02, z: pz, r: Math.max(1.2, w.w * 0.8), color: 0x9fd6d0, opacity: DRESS.pool.glassOpacity })
    if (!d.recipe.curtains || w.kind === 'dome' || w.kind === 'verriere') continue
    const rot = Math.atan2(nx, nz)
    const color = d.tissu(w.cell)
    for (const side of [-1, 1]) {
      const off = (w.w / 2 + 0.15) * side
      d.sheet({ x: w.at.x + nx * 0.12 + Math.cos(rot) * off, y: w.at.y, z: w.at.z + nz * 0.12 - Math.sin(rot) * off, w: 0.45, h: w.h + 0.4, rot, pitch: 0, color })
    }
  }
}

function skin(d: Dresser, shell: DistrictShell): Porthole[] {
  const out: Porthole[] = []
  const { rng } = d
  const { pitch, rowLift, offset, maxPerDistrict } = DRESS.skin
  const lit = d.recipe.skinLit
  const warm = [d.pal.lampe, 0xffc27a, 0xff9e5e]
  for (const h of shell.hulls) {
    if (h.shape === 'ellipsoide') continue
    const ax = Math.sin(h.yaw)
    const az = Math.cos(h.yaw)
    const half = h.length / 2 - Math.min(h.rx, h.length / 4)
    const phase = rng() * pitch
    for (const fy of h.floors) {
      const y = fy + rowLift
      const dy = (y - h.center.y) / h.ry
      if (Math.abs(dy) > 0.9) continue
      const r = h.rx * Math.sqrt(1 - dy * dy) + offset
      const skipRun = rng() < 0.3 ? Math.floor(rng() * 4) + 2 : 0
      let i = 0
      for (let t = -half + phase; t <= half; t += pitch, i++) {
        if (skipRun && i % (skipRun + 3) < skipRun) continue
        for (const side of [-1, 1]) {
          const nx = az * side
          const nz = -ax * side
          const x = h.center.x + ax * t + nx * r
          const z = h.center.z + az * t + nz * r
          if (shell.windows.some((w) => Math.hypot(w.at.x - x, w.at.y - y, w.at.z - z) < 1.6)) continue
          const on = rng() < lit
          out.push({ x, y, z, nx, nz, lit: on, color: on ? pickOne(rng, warm) : 0x4f6d7a })
          if (out.length >= maxPerDistrict) return out
        }
      }
    }
  }
  return out
}

function settleLamps(d: Dresser, shell: DistrictShell, cells: ReadonlyMap<string, CellSpec>, pools: Pool[]): void {
  const perCell = new Map<string, number>()
  for (const l of shell.lamps) if (l.live) perCell.set(l.cell, (perCell.get(l.cell) ?? 0) + 1)
  const lit = new Set<string>([...shell.lamps.map((l) => l.cell), ...d.lamps.map((l) => l.cell)])
  for (const c of shell.cells) {
    if (lit.has(c.id)) continue
    const b = c.boxes[0]
    if (!b) continue
    const x = (b.x0 + b.x1) / 2
    const z = (b.z0 + b.z1) / 2
    d.lamp({ kind: pickOne(d.rng, d.recipe.lamps), cell: c.id, x, y: Math.min(c.roof, b.y1) - 0.05, z, rot: 0, color: d.pal.lampe, radius: 6, drop: 0.9 })
  }
  const order = d.lamps.map((l, i) => ({ l, i, k: d.rng() }))
  order.sort((a, b) => a.k - b.k)
  for (const { l } of order) {
    const n = perCell.get(l.cell) ?? 0
    if (n >= DRESS.liveLampsPerCell) continue
    perCell.set(l.cell, n + 1)
    l.live = true
  }
  for (const l of d.lamps) {
    const by = l.y - l.drop
    const fy = floorUnder(shell, cells, l.cell, l.x, by, l.z)
    if (fy !== null && by - fy < DRESS.pool.maxDrop) pools.push({ x: l.x, y: fy + 0.025, z: l.z, r: Math.min(4, 1.2 + (by - fy) * 0.55), color: l.color, opacity: DRESS.pool.opacity })
  }
}

export function collidersOf(props: readonly PropPlacement[]): ColliderSpec[] {
  const out: ColliderSpec[] = []
  for (const p of props) {
    const half = SOLID[p.kind]
    if (!half) continue
    const q = [0, Math.sin(p.rot / 2), 0, Math.cos(p.rot / 2)] as const
    out.push({ kind: 'prop', climbable: true, x: p.x, y: p.y + half[1] * p.s, z: p.z, hx: half[0] * p.s, hy: half[1] * p.s, hz: half[2] * p.s, q })
  }
  return out
}

// One draw per kind: over the cap, the archetype's signature kinds stay and the rarest others go.
function capKinds(props: PropPlacement[], signature: ReadonlySet<PropKind>): PropPlacement[] {
  const count = new Map<PropKind, number>()
  for (const p of props) count.set(p.kind, (count.get(p.kind) ?? 0) + 1)
  if (count.size <= DRESS.budget.propKinds) return props
  const rank = (k: PropKind, n: number) => (signature.has(k) ? 1e9 : 0) + n
  const keep = new Set([...count.entries()].sort((a, b) => rank(b[0], b[1]) - rank(a[0], a[1])).slice(0, DRESS.budget.propKinds).map(([k]) => k))
  return props.filter((p) => keep.has(p.kind))
}

// Pure and sliced: same shell + keepOut + seed gives the same dressing on every machine.
export function* planDressing(input: DressInput): Job<DressPlan> {
  const { shell, keepOut } = input
  const arch = ARCHETYPES[shell.plan.archetype]
  const recipe = RECIPES[shell.plan.archetype]
  const rng = mulberry32((shell.plan.seed ^ hashString('habillage')) >>> 0)
  const pal = districtPalette(arch, rng)
  const moods = new Map(shell.cells.map((c) => [c.id, MOODS[pick(rng, recipe.moods)]] as const))
  const tints = new Map(shell.cells.map((c) => [c.id, pickOne(rng, pal.tissu)] as const))
  const d = new Dresser(rng, pal, recipe, shell, keepOut, moods, tints)
  const cells = new Map(shell.cells.map((c) => [c.id, c]))
  const last = new Map<string, ClusterId>()

  const fillOf = (slot: DressSlot) => {
    const base = slot.onPath ? DRESS.fill.onPath : DRESS.fill.offPath
    return (base * recipe.density * slot.weight + (nearVoid(shell, slot.at) ? DRESS.fill.voidBonus : 0)) * d.mood(slot.cell).fill
  }
  yield
  for (const s of shell.slots) if (s.kind === 'mur' && s.w > DRESS.wall.pipeMin && rng() < DRESS.wall.pipe && d.pipes.length < DRESS.wall.maxPipes) pipeRun(frameOf(s, d))
  const aside = sidestepper(shell, rng)
  const slots = shell.slots.map(aside).flatMap((s) => bays(s, rng)).filter((s) => recipe.slots[s.kind])
  const fills = slots.map(fillOf)
  const expected = fills.reduce((a, f) => a + Math.min(1, f), 0)
  const scale = Math.min(1, DRESS.maxClusters / Math.max(1, expected))
  for (let i = 0; i < slots.length; i++) {
    if (i % DRESS.sliceSlots === 0) yield
    const slot = slots[i]!
    const options = recipe.slots[slot.kind]!
    const mood = d.mood(slot.cell)
    if (rng() > fills[i]! * (slot.onPath ? Math.sqrt(scale) : scale)) continue
    const biased: Weighted<ClusterId> = options.map(([c, w]) => [c, w * (mood.bias[c] ?? 1)] as const)
    const roll = () => ((slot.kind === 'sol' || slot.kind === 'coin') && rng() < DRESS.vignetteChance * (mood.bias.vignette ?? 1) ? 'vignette' : pick(rng, biased))
    let cluster = roll()
    if (cluster === last.get(slot.cell) && cluster !== 'vide') cluster = roll()
    last.set(slot.cell, cluster)
    CLUSTERS[cluster](frameOf(slot, d))
    if (slot.kind === 'mur' && rng() < DRESS.wall.decor * mood.fill) murDecor(frameOf(slot, d))
    if (slot.kind === 'atelier' && recipe.emitters.atelier) {
      const a = slot.at
      d.emit(recipe.emitters.atelier, { x0: a.x - 0.6, x1: a.x + 0.6, y0: a.y + 0.9, y1: a.y + 3.5, z0: a.z - 0.6, z1: a.z + 0.6 }, 1)
    }
    if (slot.kind === 'plafond' && recipe.emitters.plafond && rng() < 0.3) {
      const a = slot.at
      d.emit(recipe.emitters.plafond, { x0: a.x - 1, x1: a.x + 1, y0: a.y - Math.max(2, slot.h), y1: a.y, z0: a.z - 1, z1: a.z + 1 }, 1)
    }
  }
  yield
  dressStreets(d, shell)
  dressGroves(d, shell, cells)
  yield
  dressPaths(d, shell, cells)
  yield
  dressVoids(d, shell)
  dressMoods(d, shell)
  const pools: Pool[] = []
  dressWindows(d, shell, cells, pools)
  yield
  const portholes = skin(d, shell)
  settleLamps(d, shell, cells, pools)
  for (const l of d.lamps) d.bakeLamps.push({ cell: l.cell, at: { x: l.x, y: l.y - l.drop, z: l.z }, color: l.color, radius: l.radius, live: l.live })

  const props = capKinds(d.props, new Set<PropKind>([...recipe.work.slice(0, 2), ...(shell.waters.length > 0 || recipe.plants.includes('laminaire') ? ['laminaire' as const] : [])]))
  return {
    palette: pal,
    ambient: DRESS.ambient,
    props,
    cloth: d.cloth,
    pipes: d.pipes,
    wires: d.wires,
    bulbs: d.bulbs,
    lamps: d.lamps,
    bakeLamps: d.bakeLamps,
    emitters: d.emitters,
    portholes,
    pools,
  }
}
