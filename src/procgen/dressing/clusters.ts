import type { Vec3 } from '../../core/types'
import type { DressSlot } from '../types'
import { pickOne, type Dresser, type LampKind, type PropKind } from './plan'
import type { ClusterId } from './recipes'
import { DRESS } from './tuning'

// Slot frame: u runs along the wall (w), v into the room (d), y up from the slot's anchor.
export interface Frame {
  slot: DressSlot
  d: Dresser
  at(u: number, v: number, y?: number): Vec3
  rot(local?: number): number
}

const STACKABLE: readonly PropKind[] = ['caisse', 'tonneau', 'sac', 'panier', 'seau']
const SMALL: readonly PropKind[] = ['bocaux', 'livres', 'panier', 'seau', 'arrosoir', 'jouets', 'cierges']

function put(f: Frame, kind: PropKind, u: number, v: number, y = 0, local = 0, s = 1): boolean {
  const p = f.at(u, v, y)
  return f.d.prop(kind, p.x, p.y, p.z, f.rot(local), s)
}

function spread(f: Frame, n: number, margin = 0.4): number[] {
  const w = Math.max(0, f.slot.w - margin * 2)
  if (n <= 1) return [0]
  return Array.from({ length: n }, (_, i) => -w / 2 + (w * i) / (n - 1) + (f.d.rng() - 0.5) * 0.15)
}

function lampOf(f: Frame, kind: LampKind, u: number, v: number, floorY: number): void {
  const { d, slot } = f
  const p = f.at(u, v)
  const roof = d.roof(slot.cell, slot.at.y + 3.2)
  const color = d.pal.lampe
  switch (kind) {
    case 'suspension':
    case 'globe':
    case 'lanterne': {
      const drop = Math.min(1.6, Math.max(0.4, roof - floorY - 2.3))
      d.lamp({ kind, cell: slot.cell, x: p.x, y: roof - 0.05, z: p.z, rot: f.rot(), color, radius: kind === 'lanterne' ? 5 : 7, drop })
      break
    }
    case 'applique':
      if (slot.kind !== 'mur' && slot.kind !== 'seuil') {
        lampOf(f, 'suspension', u, v, floorY)
        break
      }
      d.lamp({ kind, cell: slot.cell, x: p.x, y: floorY + 2.1, z: p.z, rot: f.rot(), color, radius: 5, drop: 0 })
      break
    case 'lampadaire':
      d.lamp({ kind, cell: slot.cell, x: p.x, y: floorY + 2.6, z: p.z, rot: f.rot(), color, radius: 7, drop: 0 })
      break
    case 'verte':
      d.lamp({ kind, cell: slot.cell, x: p.x, y: floorY + 1.15, z: p.z, rot: f.rot(), color: 0xffd9a0, radius: 3.5, drop: 0 })
      break
  }
}

function maybeCat(f: Frame, u: number, v: number, y: number): void {
  if (f.d.rng() < f.d.catChance(f.slot.cell)) put(f, 'chat', u, v, y, (f.d.rng() - 0.5) * 2.5)
}

function rug(f: Frame, u: number, v: number, w: number, h: number): void {
  const p = f.at(u, v, 0.012)
  f.d.sheet({ ...p, w, h, rot: f.rot(), pitch: Math.PI / 2, color: f.d.tissu(f.slot.cell) })
}

const pile = (f: Frame) => {
  const { d } = f
  const goods = d.recipe.goods.filter((g) => STACKABLE.includes(g))
  const pool = goods.length > 0 ? goods : STACKABLE
  const n = 2 + Math.floor(d.rng() * Math.min(5, f.slot.w / 0.7))
  let top = 0
  spread(f, n).forEach((u, i) => {
    const kind = pickOne(d.rng, pool)
    const v = 0.4 + d.rng() * Math.min(0.6, f.slot.d - 0.5)
    put(f, kind, u, v, 0, d.rng() * 0.8 - 0.4, 0.85 + d.rng() * 0.3)
    if (kind === 'caisse' && d.rng() < 0.45) {
      put(f, 'caisse', u + 0.05, v, 0.62, d.rng() - 0.5, 0.8)
      if (i === 0) top = 1.12
    }
  })
  if (top > 0) maybeCat(f, spread(f, n)[0]!, 0.6, top)
  else maybeCat(f, 0, 0.6, 0.62)
}

const etagere = (f: Frame) => {
  const { d } = f
  const n = Math.max(1, Math.floor(f.slot.w / 1.3))
  for (const u of spread(f, n, 0.65)) {
    put(f, 'etagere', u, 0.2)
    if (d.rng() < 0.5) put(f, pickOne(d.rng, SMALL), u + (d.rng() - 0.5) * 0.6, 0.2, 1.92, d.rng() - 0.5, 0.8)
  }
  if (d.rng() < 0.4) put(f, 'tabouret', (d.rng() - 0.5) * f.slot.w * 0.6, 0.9)
}

const etal = (f: Frame) => {
  const { d } = f
  const goods = d.recipe.goods.filter((g) => SMALL.includes(g) || g === 'horloge' || g === 'bouee')
  put(f, 'comptoir', 0, 0.75)
  for (let i = 0; i < 4; i++) {
    const g = goods.length > 0 ? pickOne(d.rng, goods) : 'bocaux'
    put(f, g, -0.65 + i * 0.43, 0.8, 1.0, d.rng() - 0.5, g === 'horloge' ? 0.25 : g === 'bouee' ? 0.45 : 0.75)
  }
  const color = d.tissu(f.slot.cell)
  const a = f.at(0, 0.95, 2.45)
  d.sheet({ ...a, w: 2.1, h: 1.3, rot: f.rot(), pitch: -1.05, color })
  for (let i = 0; i < 6; i++) {
    const p = f.at(-0.875 + i * 0.35, 1.52, 2.12)
    d.sheet({ ...p, w: 0.34, h: 0.22, rot: f.rot(), pitch: 0, color: i % 2 ? color : d.pal.tissu[(d.pal.tissu.indexOf(color) + 1) % d.pal.tissu.length]! })
  }
  put(f, 'tabouret', 0.4, 0.15)
  if (d.rng() < 0.7) put(f, pickOne(d.rng, STACKABLE), 1.25, 0.6, 0, d.rng() - 0.5)
  const l = f.at(0.6, 1.3, 2.3)
  d.lamp({ kind: 'lanterne', cell: f.slot.cell, x: l.x, y: l.y, z: l.z, rot: f.rot(), color: d.pal.lampe, radius: 4.5, drop: 0.3 })
}

const table = (f: Frame) => {
  const { d, slot } = f
  const v = Math.max(1, slot.d / 2)
  const long = slot.w > 2.6 && d.rng() < 0.6
  put(f, 'table', 0, v, 0, long ? 0 : Math.PI / 2 * Math.round(d.rng()))
  if (long) {
    put(f, 'banc', 0, v - 0.75, 0, 0)
    put(f, 'banc', 0, v + 0.75, 0, Math.PI)
  } else {
    for (const [u, dv] of [[-0.9, 0], [0.9, 0], [0, 0.65], [0.2, -0.65]] as const) if (d.rng() < 0.75) put(f, 'tabouret', u, v + dv)
  }
  if (d.rng() < 0.6) put(f, pickOne(d.rng, SMALL), (d.rng() - 0.5) * 0.8, v, 0.77, d.rng() * 3, 0.7)
  if (d.rng() < 0.55) lampOf(f, d.recipe.lamps.includes('verte') ? 'verte' : 'suspension', d.recipe.lamps.includes('verte') ? 0.4 : 0, v, slot.at.y)
  maybeCat(f, -0.5, v, 0.77)
}

const atelier = (f: Frame) => {
  const { d, slot } = f
  const [main, ...rest] = d.recipe.work
  if (!main) return
  put(f, main, 0, Math.min(1, slot.d / 2))
  for (const u of spread(f, Math.min(3, rest.length + 1), 0.3).slice(1)) {
    const kind = pickOne(d.rng, rest.length > 0 ? rest : [main])
    put(f, kind, u + (u > 0 ? 0.6 : -0.6), 0.45 + d.rng() * 0.5, 0, d.rng() * 1.2 - 0.6, 0.9)
  }
  if (main === 'claie' && slot.w > 3.5) put(f, 'claie', slot.w / 2 - 1, 1.2, 0, 0.2)
  lampOf(f, d.recipe.lamps[1] ?? d.recipe.lamps[0] ?? 'applique', 0, 0.05, slot.at.y)
}

const couchage = (f: Frame) => {
  const { d, slot } = f
  const bed: PropKind = d.recipe.work.includes('berceau') ? 'berceau' : 'couchette'
  const n = Math.max(1, Math.floor(slot.w / 2.2))
  for (const u of spread(f, n, 1)) {
    put(f, bed, u, 0.45)
    const top = bed === 'couchette' ? 0.53 : 0.66
    const p = f.at(u + 0.15, 0.48, top)
    d.sheet({ ...p, w: bed === 'couchette' ? 1.3 : 0.7, h: bed === 'couchette' ? 0.82 : 0.45, rot: f.rot(), pitch: Math.PI / 2, color: d.tissu(slot.cell) })
    if (d.rng() < 0.5) put(f, pickOne(d.rng, ['livres', 'jouets', 'panier'] as const), u + 0.8, 1.05, 0, d.rng() * 3, 0.7)
    maybeCat(f, u - 0.4, 0.5, top + 0.05)
  }
  if (d.recipe.lamps.includes('applique')) lampOf(f, 'applique', 0, 0.05, slot.at.y)
}

const hamac = (f: Frame) => {
  const { d, slot } = f
  const span = Math.min(3.2, slot.w - 0.4)
  if (span < 1.8) return
  const a = f.at(-span / 2, 0.6, 1.9)
  const b = f.at(span / 2, 0.6, 1.9)
  const color = d.tissu(slot.cell)
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4
    const sag = Math.sin(t * Math.PI) * 0.7
    const p = f.at(-span / 2 + span * t, 0.6, 1.9 - sag - 0.2)
    d.sheet({ ...p, w: (span / 4) * 1.05, h: 0.9, rot: f.rot(), pitch: Math.PI / 2, color })
  }
  d.wires.push({ a, b: f.at(-span / 2 + 0.3, 0.6, 1.7), r: 0.015 }, { a: b, b: f.at(span / 2 - 0.3, 0.6, 1.7), r: 0.015 })
  if (d.rng() < 0.5) put(f, 'livres', 0, 0.2, 0, 0.4, 0.6)
}

const suspendu = (f: Frame) => {
  const { d, slot } = f
  const n = slot.w > 3 ? 2 : 1
  for (const u of spread(f, n, 0.8)) lampOf(f, pickOne(d.rng, d.recipe.lamps.filter((l) => l !== 'applique' && l !== 'lampadaire' && l !== 'verte').concat('suspension')), u, slot.d / 2, slot.at.y - Math.max(2.4, slot.h))
  if (d.recipe.plants.includes('lierre') || d.rng() < 0.4) {
    for (const u of spread(f, 2 + Math.floor(d.rng() * 2), 0.3)) {
      const s = 0.6 + d.rng() * 0.7
      put(f, 'lierre', u, slot.d / 2 + (d.rng() - 0.5) * 0.8, -DRESS.ivyLength * s, d.rng() * 6, s)
    }
  }
}

const linge = (f: Frame) => {
  const { d, slot } = f
  const ceiling = slot.kind === 'plafond'
  const y = ceiling ? -0.4 - d.rng() * 0.5 : 2.1
  const v = Math.max(0.5, slot.d / 2)
  const a = f.at(-slot.w / 2 + 0.2, v, y)
  const b = f.at(slot.w / 2 - 0.2, v, y + (d.rng() - 0.5) * 0.3)
  if (!ceiling) {
    d.wires.push({ a, b: f.at(-slot.w / 2 + 0.2, v, 0), r: 0.03 }, { a: b, b: f.at(slot.w / 2 - 0.2, v, 0), r: 0.03 })
    if (d.rng() < 0.6) put(f, 'panier', 0.3, v + 0.5, 0, d.rng())
  }
  d.line('linge', a, b, 0.25, slot.cell)
}

const plantes = (f: Frame) => {
  const { d, slot } = f
  const plants = d.recipe.plants
  const n = 2 + Math.floor(d.rng() * Math.min(4, slot.w / 0.6))
  for (const u of spread(f, n, 0.3)) {
    const kind = pickOne(d.rng, plants)
    const s = 0.7 + d.rng() * 0.6
    put(f, kind, u, 0.35 + d.rng() * Math.min(1, slot.d - 0.4), 0, d.rng() * 6, s)
  }
  if (d.rng() < 0.35) put(f, 'jardiniere', 0, Math.min(1.2, slot.d - 0.3), 0, 0)
  if (plants.includes('laminaire') && d.recipe.lamps.includes('lampadaire') && d.rng() < 0.5) lampOf(f, 'lampadaire', slot.w / 2 - 0.3, 0.3, slot.at.y)
}

const rebord = (f: Frame) => {
  const { d, slot } = f
  for (const u of spread(f, 1 + Math.floor(d.rng() * 3), 0.2)) {
    if (d.rng() < d.catChance(slot.cell) * 0.6) put(f, 'chat', u, 0.15, 0, d.rng() * 3)
    else put(f, pickOne(d.rng, ['herbes', 'bocaux', 'herbes', 'livres'] as const), u, 0.12, 0, d.rng() * 3, 0.55)
  }
  if (d.recipe.goods.includes('lunette') && slot.d > 0.8) put(f, 'lunette', 0, 0.6, -Math.min(slot.at.y, 0), 0)
}

// Seuil frame: the door is at v = -slot.d, the street beyond v = 0.
const seuil = (f: Frame) => {
  const { d, slot } = f
  const wall = -slot.d
  rug(f, 0, wall + 0.5, 1.0, 0.6)
  if (d.rng() < 0.7) put(f, pickOne(d.rng, ['panier', 'seau', 'sac', 'epuisette'] as const), slot.w / 2 - 0.25, wall + 0.35, 0, d.rng())
  if (d.rng() < 0.6) put(f, pickOne(d.rng, d.recipe.plants), -slot.w / 2 + 0.1, wall + 0.3, 0, d.rng() * 6, 0.8 + d.rng() * 0.4)
  lampOf(f, 'applique', -slot.w / 2 + 0.2, wall + 0.05, slot.at.y)
  if (d.rng() < DRESS.wall.sign) enseigne(f, slot.w / 2 + 0.15, wall)
}

// A shop sign on an iron arm, perpendicular to the wall so it reads from down the street.
function enseigne(f: Frame, u: number, wall: number): void {
  const { d } = f
  const board = d.tissu(f.slot.cell)
  const arm = f.at(u, wall + 0.45, 2.95)
  d.pipes.push({ a: f.at(u, wall, 2.95), b: arm, r: 0.025, color: 0x3e3a4a, brackets: 0 })
  const w = 0.6 + d.rng() * 0.3
  const h = 0.4 + d.rng() * 0.2
  const c = f.at(u, wall + 0.5, 2.9 - h / 2)
  d.sheet({ ...c, w: 0.04, h, rot: f.rot(), pitch: 0, color: 0x5e4a3a, t: w + 0.06 })
  for (const side of [-1, 1]) {
    const p = f.at(u + side * 0.025, wall + 0.5, 2.9 - h / 2)
    d.sheet({ ...p, w: w - 0.08, h: h - 0.08, rot: f.rot(Math.PI / 2), pitch: 0, color: board, t: 0.01 })
  }
}

// Wall-height dressing above whatever stands on the floor: posters, a frame, ivy, a clock.
export const murDecor = (f: Frame) => {
  const { d, slot } = f
  const wall = -0.47
  const kind = d.rng()
  if (kind < 0.45) {
    const n = 1 + Math.floor(d.rng() * Math.min(3, slot.w / 0.8))
    for (const u of spread(f, n, 0.5)) {
      const h = 0.45 + d.rng() * 0.35
      const p = f.at(u, wall, 1.55 + d.rng() * 0.4)
      d.sheet({ ...p, w: h * 0.72, h, rot: f.rot((d.rng() - 0.5) * 0.08), pitch: 0, color: pickOne(d.rng, PAPER), t: 0.006 })
      const band = f.at(u, wall + 0.006, p.y - slot.at.y + h * 0.18)
      d.sheet({ ...band, w: h * 0.6, h: h * 0.16, rot: f.rot(), pitch: 0, color: d.tissu(slot.cell), t: 0.006 })
    }
  } else if (kind < 0.7) {
    const w = 0.7 + d.rng() * 0.6
    const u = (d.rng() - 0.5) * Math.max(0, slot.w - w - 0.6)
    d.sheet({ ...f.at(u, wall, 1.8), w: w + 0.12, h: w * 0.75 + 0.12, rot: f.rot(), pitch: 0, color: 0x5e4a3a, t: 0.04 })
    d.sheet({ ...f.at(u, wall + 0.03, 1.8), w, h: w * 0.75, rot: f.rot(), pitch: 0, color: pickOne(d.rng, [0x6e8fb0, 0x8fb59a, d.pal.accent, 0xc9a66b]), t: 0.02 })
  } else if (kind < 0.88) {
    for (const u of spread(f, 2 + Math.floor(d.rng() * 3), 0.3)) {
      const s = 0.7 + d.rng() * 0.6
      put(f, 'lierre', u, wall + 0.08, slot.h - DRESS.ivyLength * s, d.rng() * 6, s)
    }
  } else {
    put(f, 'horloge', (d.rng() - 0.5) * slot.w * 0.5, wall + 0.2, 0, 0, 0.9)
  }
}

// A pipe along the whole wall run, on brackets, sometimes doubled; the Drift's walls are never bare.
export const pipeRun = (f: Frame) => {
  const { d, slot } = f
  const [lo, hi] = DRESS.wall.pipeY
  const y = Math.min(lo + d.rng() * (hi - lo), d.roof(slot.cell, slot.at.y + 4) - slot.at.y - 0.3)
  const color = pickOne(d.rng, [d.pal.metal, 0xc98a5a, 0x8a8f99])
  const n = d.rng() < 0.4 ? 2 : 1
  for (let i = 0; i < n; i++) {
    const r = 0.05 + d.rng() * 0.05
    const yy = y - i * 0.24
    d.pipes.push({ a: f.at(-slot.w / 2, -0.38, yy), b: f.at(slot.w / 2, -0.38, yy), r, color, brackets: Math.max(1, Math.floor(slot.w / DRESS.wall.bracketEvery)) })
  }
}

// Street face around a door: painted windows with shutters and a sill garden, lit from inside or not.
export const facade = (f: Frame) => {
  const { d, slot } = f
  const wall = -slot.d + 0.03
  for (const side of [-1, 1]) {
    if (d.rng() > DRESS.facade.window) continue
    const u = side * (slot.w / 2 + 0.8 + d.rng() * 0.7)
    const w = 0.8 + d.rng() * 0.4
    const h = 1 + d.rng() * 0.3
    const y = 1.35 + h / 2
    d.sheet({ ...f.at(u, wall, y), w: w + 0.16, h: h + 0.16, rot: f.rot(), pitch: 0, color: d.pal.boisOmbre, t: 0.05 })
    const lit = d.rng() < d.recipe.skinLit
    d.sheet({ ...f.at(u, wall + 0.03, y), w, h, rot: f.rot(), pitch: 0, color: lit ? 0xffc27a : 0x34505e, t: 0.02 })
    d.sheet({ ...f.at(u, wall + 0.04, y), w: 0.04, h, rot: f.rot(), pitch: 0, color: d.pal.boisOmbre, t: 0.02 })
    if (lit) d.bake(slot.cell, f.at(u, wall + 0.6, y), d.pal.lampe, DRESS.facade.glow)
    const shutter = d.tissu(slot.cell)
    for (const s of [-1, 1]) {
      const open = d.rng() * 0.9
      d.sheet({ ...f.at(u + s * (w / 2 + 0.2 + Math.sin(open) * 0.05), wall + 0.05 + Math.sin(open) * 0.2, y), w: 0.4, h: h + 0.1, rot: f.rot(s * open), pitch: 0, color: shutter, t: 0.03 })
    }
    d.sheet({ ...f.at(u, wall + 0.12, 1.3), w: w + 0.2, h: 0.2, rot: f.rot(), pitch: 0, color: d.pal.bois, t: 0.22 })
    for (let i = 0; i < 3; i++) if (d.rng() < 0.75) put(f, pickOne(d.rng, d.recipe.plants.filter((p) => p !== 'laminaire').concat('herbes')), u - w / 2 + 0.15 + i * (w - 0.3) / 2, wall + 0.12, 1.4, d.rng() * 6, 0.55)
  }
}

const PAPER = [0xf1e4c8, 0xefe3c4, 0xe9dcc2, 0xf4f1e6] as const

const rambarde = (f: Frame) => {
  const { d, slot } = f
  for (const u of spread(f, 1 + Math.floor(d.rng() * 3), 0.3)) put(f, pickOne(d.rng, ['herbes', 'herbes', 'rouleau', 'seau'] as const), u, 0.1, 0, d.rng() * 3, 0.6)
  if (slot.w > 2.5 && d.rng() < 0.6) d.line(d.rng() < 0.5 ? 'fanions' : 'linge', f.at(-slot.w / 2, 0.05, 0.1), f.at(slot.w / 2, 0.05, 0.1), 0.18, slot.cell)
  if (d.rng() < 0.4) {
    const p = f.at(slot.w / 2 - 0.1, 0.05, 0.6)
    d.lamp({ kind: 'lanterne', cell: slot.cell, x: p.x, y: p.y, z: p.z, rot: f.rot(), color: d.pal.lampe, radius: 4.5, drop: 0 })
  }
}

const VIGNETTES: readonly ((f: Frame) => void)[] = [
  (f) => {
    rug(f, 0, 1, 1.6, 1.2)
    put(f, 'panier', -0.3, 1, 0.01, 0.4)
    put(f, 'bocaux', 0.35, 1.2, 0.01, 1.3, 0.7)
    maybeCat(f, 0.4, 0.7, 0.01)
  },
  (f) => {
    put(f, 'sac', 0, 0.7, 0, 1.4, 0.9)
    for (let i = 0; i < 3; i++) put(f, 'bocaux', 0.3 + i * 0.25, 0.9 + f.d.rng() * 0.4, 0, f.d.rng() * 6, 0.5)
    put(f, 'panier', -0.7, 0.5, 0, 2.1, 0.9)
  },
  (f) => {
    put(f, 'tabouret', 0, 0.8)
    put(f, 'livres', 0.5, 0.7, 0, 0.3, 0.8)
    lampOf(f, 'verte', 0.55, 0.9, f.slot.at.y - 0.75)
    rug(f, 0.1, 0.8, 1.2, 0.9)
  },
  (f) => {
    put(f, 'caisse', 0, 0.7, 0, 0.3)
    put(f, 'engrenage', 0.7, 0.6, 0, 1.2, 0.35)
    put(f, 'seau', -0.6, 0.6)
    const p = f.at(0.3, 1.2)
    f.d.lamp({ kind: 'lanterne', cell: f.slot.cell, x: p.x, y: p.y + 0.35, z: p.z, rot: f.rot(), color: f.d.pal.lampe, radius: 3.5, drop: 0 })
  },
  (f) => {
    rug(f, 0, 0.9, 1.8, 0.8)
    put(f, 'jouets', 0.2, 0.9, 0.01, 0.6, 0.9)
    put(f, 'livres', -0.5, 0.8, 0.01, 2.2, 0.6)
    maybeCat(f, -0.1, 1.1, 0.01)
  },
]

const vignette = (f: Frame) => pickOne(f.d.rng, VIGNETTES)(f)

export const CLUSTERS: Readonly<Record<ClusterId, (f: Frame) => void>> = {
  pile, etagere, etal, table, atelier, couchage, hamac, suspendu, linge, plantes, rebord, seuil, vignette, rambarde,
  vide: () => {},
}
