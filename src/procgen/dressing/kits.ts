import { SURF } from '../../drift/surface'
import type { Frame } from './clusters'
import { GLINT, pickOne, type PropKind } from './plan'

// Archetype-only dressing. Wall kits stand against the wall face at v = WALL, floor kits on a slot's centre.
export type KitId =
  | 'cartes' | 'vitrine' | 'corderie' | 'echeveaux' | 'lessive' | 'etendoir' | 'claies' | 'sel'
  | 'bricabrac' | 'tapis' | 'four' | 'marmites' | 'foyer' | 'outils' | 'malles' | 'pateres'
  | 'epave' | 'coulures' | 'amarres' | 'casiers' | 'vannes' | 'jauge' | 'exvotos' | 'chandelier'
  | 'bacs' | 'treille' | 'mobile' | 'cubes' | 'semis' | 'jardin' | 'rayonnages' | 'lecture'
  | 'scene' | 'affiches' | 'aquarium' | 'filets' | 'orgue' | 'rouages'

export const WALL = -0.2
const IRON = 0x3e3a4a
const BRASS = 0xd9b48f
const CREAM = 0xf1e4c8
const GLASS = 0x9fd6d0
const EMBER = 0xff8a3a
const HEMP = 0xd2ad6e
const HALF_PI = Math.PI / 2

// A box centred at (u, v, y) in the frame; `cyl` makes it an upright cylinder, `roll` lays it along u.
function bx(f: Frame, u: number, v: number, y: number, w: number, h: number, t: number, color: number, pat: number = SURF.paint, extra: { local?: number; pitch?: number; roll?: number; cyl?: boolean } = {}): void {
  const p = f.at(u, v, y)
  f.d.sheet({ ...p, w, h, t, rot: f.rot(extra.local ?? 0), pitch: extra.pitch ?? 0, roll: extra.roll, color, pat, cyl: extra.cyl })
}

const cy = (f: Frame, u: number, v: number, y: number, r: number, h: number, color: number, pat: number = SURF.paint, roll?: number, pitch?: number) =>
  bx(f, u, v, y, r * 2, h, r * 2, color, pat, { cyl: true, roll, pitch })

const lay = (f: Frame, u: number, v: number, y: number, r: number, len: number, color: number, pat: number = SURF.paint) => cy(f, u, v, y, r, len, color, pat, HALF_PI)

function put(f: Frame, kind: PropKind, u: number, v: number, y = 0, local = 0, s = 1): void {
  const p = f.at(u, v, y)
  f.d.prop(kind, p.x, p.y, p.z, f.rot(local), s)
}

function glow(f: Frame, u: number, v: number, y: number, color: number, radius: number): void {
  f.d.bake(f.slot.cell, f.at(u, v, y), color, radius)
}

const span = (f: Frame, margin = 0.3) => Math.max(0.6, f.slot.w - margin * 2)
const steps = (f: Frame, every: number, margin = 0.3) => {
  const w = span(f, margin)
  const n = Math.max(1, Math.floor(w / every))
  return Array.from({ length: n }, (_, i) => -w / 2 + (w * (i + 0.5)) / n)
}
const mid = (f: Frame) => f.slot.d / 2

function board(f: Frame, w: number, y: number, h: number, color: number, pat: number = SURF.planksX): void {
  bx(f, 0, WALL + 0.03, y, w, h, 0.04, color, pat)
}

function rail(f: Frame, y: number, w: number, color = IRON): void {
  lay(f, 0, WALL + 0.18, y, 0.022, w, color, SURF.steel)
  for (const u of [-w / 2 + 0.1, w / 2 - 0.1]) bx(f, u, WALL + 0.09, y, 0.04, 0.04, 0.18, color)
}

function shelf(f: Frame, w: number, y: number, depth: number, color: number): void {
  bx(f, 0, WALL + depth / 2, y, w, 0.04, depth, color, SURF.planksX)
  for (const u of [-w / 2 + 0.15, w / 2 - 0.15]) bx(f, u, WALL + 0.04, y - 0.12, 0.04, 0.22, 0.06, color)
}

const KITS: Readonly<Record<KitId, { at: 'mur' | 'sol'; make: (f: Frame) => void }>> = {
  cartes: { at: 'mur', make(f) {
    const w = Math.min(3.2, span(f))
    board(f, w, 1.75, 1.2, 0x5e4a3a, SURF.boards)
    const pins: { u: number; y: number }[] = []
    for (let i = 0; i < 4; i++) {
      const u = -w / 2 + 0.45 + (i * (w - 0.9)) / 3
      const y = 1.6 + (f.d.rng() - 0.5) * 0.4
      bx(f, u, WALL + 0.06, y, 0.62, 0.46, 0.008, pickOne(f.d.rng, [CREAM, 0xe9dcc2, 0xd9e4e8]), SURF.plaster, { local: (f.d.rng() - 0.5) * 0.1 })
      bx(f, u + 0.05, WALL + 0.068, y - 0.05, 0.32, 0.18, 0.004, 0x6e8fb0)
      bx(f, u, WALL + 0.075, y + 0.2, 0.035, 0.035, 0.02, 0xc46a4a)
      pins.push({ u, y: y + 0.2 })
    }
    for (let i = 1; i < pins.length; i++) f.d.wires.push({ a: f.at(pins[i - 1]!.u, WALL + 0.08, pins[i - 1]!.y), b: f.at(pins[i]!.u, WALL + 0.08, pins[i]!.y), r: 0.004 })
    rail(f, 2.45, w, BRASS)
    shelf(f, w, 1.0, 0.32, 0x5e4a3a)
    for (const u of [-0.6, 0, 0.6]) cy(f, u, WALL + 0.16, 1.1, 0.07, 0.16, BRASS, SURF.brass)
  } },
  vitrine: { at: 'mur', make(f) {
    for (const u of steps(f, 1.4, 0.4)) {
      bx(f, u, WALL + 0.25, 1.15, 1.2, 2.3, 0.5, 0x6a4a34, SURF.planksZ)
      bx(f, u, WALL + 0.05, 1.25, 1.04, 1.9, 0.02, 0x2e3a4a)
      for (const y of [0.55, 1.05, 1.55, 2.0]) bx(f, u, WALL + 0.28, y, 1.04, 0.03, 0.4, BRASS, SURF.brass)
      for (let i = 0; i < 6; i++) cy(f, u - 0.36 + (i % 3) * 0.36, WALL + 0.28, 0.66 + Math.floor(i / 3) * 0.5 + 0.08, 0.06 + (i % 2) * 0.03, 0.16, i % 2 ? BRASS : GLASS, SURF.brass)
      bx(f, u, WALL + 0.52, 1.25, 1.06, 1.92, 0.012, GLASS)
      bx(f, u, WALL + 0.53, 1.25, 0.03, 1.92, 0.02, BRASS)
    }
  } },
  corderie: { at: 'mur', make(f) {
    const w = span(f, 0.1)
    for (const u of [-w / 2 + 0.1, 0, w / 2 - 0.1]) {
      bx(f, u, 0.05, 0.75, 0.14, 1.5, 0.14, 0x5e4a3a, SURF.planksZ)
      for (const y of [0.95, 1.1, 1.25]) bx(f, u, 0.05, y, 0.22, 0.03, 0.05, IRON)
    }
    for (const [y, c] of [[0.95, HEMP], [1.1, 0xa58660], [1.25, 0xc9a66b]] as const) lay(f, 0, 0.05, y - 0.03, 0.03, w, c, SURF.fabric)
    cy(f, w / 2 - 0.5, 0.25, 0.8, 0.55, 0.08, 0x6a4a34, SURF.planksX, undefined, HALF_PI)
    for (let i = 0; i < 6; i++) bx(f, w / 2 - 0.5, 0.25, 0.8, 0.05, 1.05, 0.04, 0x5e4a3a, SURF.paint, { local: 0, pitch: 0, roll: (i / 6) * Math.PI })
    put(f, 'bobine', -w / 2 + 0.9, 0.2, 0, 0.1, 0.8)
  } },
  echeveaux: { at: 'mur', make(f) {
    const w = span(f)
    board(f, w, 1.5, 0.18, 0x5e4a3a)
    steps(f, 0.45).forEach((u, i) => {
      bx(f, u, WALL + 0.12, 1.5, 0.04, 0.04, 0.2, IRON)
      const r = 0.16 + (i % 3) * 0.04
      cy(f, u, WALL + 0.16, 1.5 - r, r, 0.1, i % 2 ? 0xa58660 : HEMP, SURF.fabric, undefined, HALF_PI)
    })
    for (const u of steps(f, 1.1, 0.5)) {
      cy(f, u, 0.1, 0.22, 0.18, 0.44, 0x2e2a2a, SURF.steel)
      cy(f, u, 0.1, 0.45, 0.16, 0.02, 0x1a1616)
    }
  } },
  lessive: { at: 'mur', make(f) {
    for (const u of steps(f, 0.9, 0.4)) {
      bx(f, u, WALL + 0.12, 0.42, 0.42, 0.8, 0.04, 0xc9a66b, SURF.planksX, { pitch: -0.18 })
      for (let i = 0; i < 7; i++) bx(f, u, WALL + 0.16 - i * 0.012, 0.26 + i * 0.06, 0.36, 0.02, 0.025, 0xa8b0b4, SURF.steel, { pitch: -0.18 })
    }
    for (const u of steps(f, 1.3, 0.6)) {
      cy(f, u, 0.15, 0.2, 0.32, 0.4, 0xa8b0b4, SURF.steel)
      cy(f, u, 0.15, 0.38, 0.29, 0.02, 0xb8dce8)
      bx(f, u + 0.1, 0.15, 0.45, 0.4, 0.12, 0.3, 0xf6efe0, SURF.fabric, { pitch: 0.3 })
    }
    cy(f, -span(f) / 2 + 0.3, WALL + 0.3, 0.6, 0.28, 1.2, 0xc98a5a, SURF.brass)
  } },
  etendoir: { at: 'sol', make(f) {
    const v = mid(f)
    for (const u of [-0.9, 0.9]) bx(f, u, v, 0.8, 0.06, 1.6, 0.9, 0x8a6a44, SURF.planksZ)
    for (const y of [0.9, 1.25, 1.55]) {
      lay(f, 0, v, y, 0.02, 1.8, 0x8a6a44)
      bx(f, (f.d.rng() - 0.5) * 0.4, v + 0.04, y - 0.22, 0.9 + f.d.rng() * 0.5, 0.42, 0.01, f.d.tissu(f.slot.cell), SURF.fabric)
    }
    put(f, 'panier', 0.5, v + 0.8, 0, 0.3)
  } },
  claies: { at: 'mur', make(f) {
    const w = span(f, 0.2)
    for (const u of [-w / 2, w / 2]) bx(f, u, 0.05, 1.2, 0.08, 2.4, 0.08, 0x8a6a44, SURF.planksZ)
    for (const y of [2.25, 1.55, 0.85]) {
      lay(f, 0, 0.05, y, 0.025, w, 0x8a6a44)
      for (let u = -w / 2 + 0.15; u < w / 2 - 0.1; u += 0.13) {
        const h = 0.28 + f.d.rng() * 0.12
        bx(f, u, 0.05, y - h / 2 - 0.03, 0.1, h, 0.025, f.d.rng() < 0.3 ? 0xc5d6de : 0x9fb8c8, SURF.paint, { local: (f.d.rng() - 0.5) * 0.4 })
        if (f.d.rng() < 0.5) bx(f, u + 0.02, 0.07, y - h * 0.35, 0.025, 0.08, 0.03, GLINT)
      }
    }
    put(f, 'chat', w / 2 - 0.4, 0.4, 0, 2)
  } },
  sel: { at: 'sol', make(f) {
    const v = mid(f)
    for (const [u, dv] of [[-0.6, 0], [0.1, 0.35], [0.7, -0.2]] as const) {
      cy(f, u, v + dv, 0.4, 0.32, 0.8, 0x8a6a44, SURF.planksZ)
      cy(f, u, v + dv, 0.84, 0.3, 0.12, 0xf8f8f2, SURF.stone)
    }
    cy(f, 0, v + 0.9, 0.12, 0.6, 0.24, 0xf4f4ee, SURF.stone)
    bx(f, 0.3, v + 0.9, 0.3, 0.1, 0.06, 0.4, 0x8a6a44, SURF.paint, { pitch: 0.4 })
    put(f, 'sac', -0.8, v + 0.8, 0, 0.5)
  } },
  bricabrac: { at: 'mur', make(f) {
    const w = span(f)
    board(f, w, 1.7, 1.6, 0x8a6a44, SURF.boards)
    for (let i = 0; i < Math.floor(w * 3); i++) {
      const u = -w / 2 + 0.2 + f.d.rng() * (w - 0.4)
      const y = 1.05 + f.d.rng() * 1.3
      const k = f.d.rng()
      if (k < 0.3) cy(f, u, WALL + 0.07, y, 0.12 + f.d.rng() * 0.1, 0.05, k < 0.15 ? CREAM : BRASS, SURF.brass, undefined, HALF_PI)
      else if (k < 0.6) bx(f, u, WALL + 0.07, y, 0.22 + f.d.rng() * 0.2, 0.18 + f.d.rng() * 0.2, 0.03, pickOne(f.d.rng, f.d.pal.tissu), SURF.paint)
      else bx(f, u, WALL + 0.09, y, 0.12, 0.2, 0.08, pickOne(f.d.rng, [0xe8674a, 0x6e8fb0, BRASS, GLASS]), SURF.paint, { local: f.d.rng() })
    }
    put(f, 'bouee', w / 2 - 0.4, 0.1, 0, 0, 0.9)
  } },
  tapis: { at: 'sol', make(f) {
    const v = mid(f)
    bx(f, 0, v, 0.03, 2.2, 0.02, 1.5, f.d.pal.look.floor[0], SURF.fabric)
    bx(f, 0, v, 0.045, 1.8, 0.01, 1.1, f.d.pal.look.floor[1], SURF.fabric)
    for (let i = 0; i < 6; i++) put(f, pickOne(f.d.rng, ['bocaux', 'horloge', 'livres', 'jouets', 'panier'] as const), -0.8 + (i % 3) * 0.8, v - 0.35 + Math.floor(i / 3) * 0.7, 0.05, f.d.rng() * 6, 0.6)
    put(f, 'tabouret', 1.3, v)
  } },
  four: { at: 'mur', make(f) {
    const look = f.d.pal.look
    bx(f, 0, WALL + 0.6, 0.6, 2.0, 1.2, 1.2, look.wall[0], SURF.stone)
    bx(f, 0, WALL + 0.55, 1.45, 1.7, 0.5, 1.0, look.wall[0], SURF.stone)
    bx(f, 0, WALL + 0.55, 1.85, 1.2, 0.3, 0.8, look.wall[0], SURF.stone)
    bx(f, 0, WALL + 1.2, 0.85, 0.8, 0.55, 0.03, 0x2a1a14)
    bx(f, 0, WALL + 1.21, 0.75, 0.6, 0.28, 0.03, EMBER)
    bx(f, 0, WALL + 1.22, 1.15, 0.92, 0.08, 0.06, 0xf1d2a8, SURF.stone)
    cy(f, 0.4, WALL + 0.4, 2.9, 0.16, 1.8, 0x6a5a5e, SURF.steel)
    glow(f, 0, WALL + 1.6, 0.9, 0xff9e5e, 4)
    for (let i = 0; i < 5; i++) lay(f, -1.4 + (i % 2) * 0.1, WALL + 0.3 + (i % 3) * 0.15, 0.1 + Math.floor(i / 2) * 0.16, 0.08, 0.7, 0x8a6a44, SURF.planksZ)
  } },
  marmites: { at: 'mur', make(f) {
    const w = Math.min(3, span(f))
    rail(f, 2.1, w, 0xc98a5a)
    steps(f, 0.42, (f.slot.w - w) / 2 + 0.2).forEach((u, i) => {
      const r = 0.13 + (i % 3) * 0.04
      f.d.wires.push({ a: f.at(u, WALL + 0.18, 2.1), b: f.at(u, WALL + 0.18, 1.9 - r), r: 0.006 })
      if (i % 3 === 2) bx(f, u, WALL + 0.18, 1.75, 0.05, 0.4, 0.03, 0xc98a5a, SURF.brass)
      else cy(f, u, WALL + 0.2, 1.85 - r, r, r * 1.3, 0xc98a5a, SURF.brass)
    })
    shelf(f, w, 1.25, 0.28, 0x8a6a44)
    for (let i = 0; i < 7; i++) cy(f, -w / 2 + 0.3 + i * ((w - 0.6) / 6), WALL + 0.14, 1.35, 0.05, 0.18, pickOne(f.d.rng, [0xe07a3a, 0xc46a4a, 0xe0b04a, 0x8fbf6a]))
  } },
  foyer: { at: 'mur', make(f) {
    bx(f, 0, WALL + 0.5, 0.45, 1.6, 0.9, 1.0, 0x5a4038, SURF.stone)
    bx(f, 0, WALL + 0.5, 0.92, 1.2, 0.06, 0.7, EMBER)
    for (let i = 0; i < 5; i++) bx(f, -0.4 + i * 0.2, WALL + 0.5 + (f.d.rng() - 0.5) * 0.3, 0.97, 0.12, 0.06, 0.12, i % 2 ? 0xffb060 : 0x2a1a14)
    bx(f, 0, WALL + 0.45, 2.3, 1.4, 0.6, 0.9, 0x3e3a4a, SURF.steel, { pitch: 0.1 })
    cy(f, 0, WALL + 0.35, 3.4, 0.22, 1.7, 0x3e3a4a, SURF.steel)
    bx(f, 1.05, WALL + 0.5, 0.7, 0.35, 0.5, 0.6, 0x6a3a2a, SURF.fabric, { pitch: 0.2 })
    glow(f, 0, WALL + 1, 1.2, 0xff8a3a, 4.5)
  } },
  outils: { at: 'mur', make(f) {
    const w = Math.min(3, span(f))
    board(f, w, 1.6, 1.2, 0x3e3a4a, SURF.boards)
    for (const u of steps(f, 0.32, (f.slot.w - w) / 2 + 0.2)) {
      const k = f.d.rng()
      bx(f, u, WALL + 0.07, 1.55, 0.04, 0.6, 0.03, 0x8a6a44)
      if (k < 0.5) bx(f, u, WALL + 0.08, 1.88, 0.2, 0.1, 0.06, 0x52576a, SURF.steel)
      else bx(f, u + 0.04, WALL + 0.08, 1.25, 0.04, 0.3, 0.03, 0x52576a, SURF.steel, { local: 0, roll: 0.3 })
    }
    cy(f, w / 2 + 0.2, 0.1, 0.35, 0.3, 0.7, 0x52576a, SURF.steel)
    cy(f, w / 2 + 0.2, 0.1, 0.69, 0.27, 0.02, 0x34505e)
  } },
  malles: { at: 'sol', make(f) {
    const v = mid(f)
    const tones = f.d.pal.tissu
    for (let i = 0; i < 4; i++) {
      const u = (i % 2) * 0.9 - 0.45
      const y = Math.floor(i / 2) * 0.5
      const c = i % 2 ? 0x6a4a34 : tones[i % tones.length]!
      bx(f, u, v, y + 0.24, 0.85, 0.48, 0.5, c, SURF.planksX, { local: (f.d.rng() - 0.5) * 0.3 })
      bx(f, u, v, y + 0.24, 0.87, 0.06, 0.52, BRASS, SURF.brass)
      bx(f, u, v + 0.26, y + 0.36, 0.08, 0.1, 0.02, BRASS)
    }
  } },
  pateres: { at: 'mur', make(f) {
    const w = span(f)
    bx(f, 0, WALL + 0.03, 1.75, w, 0.12, 0.04, 0x8a6a44, SURF.planksX)
    for (const u of steps(f, 0.45)) {
      bx(f, u, WALL + 0.1, 1.72, 0.03, 0.03, 0.12, BRASS)
      if (f.d.rng() < 0.7) bx(f, u, WALL + 0.14, 1.25, 0.38, 0.9, 0.08, pickOne(f.d.rng, f.d.pal.tissu), SURF.fabric, { local: (f.d.rng() - 0.5) * 0.2 })
      if (f.d.rng() < 0.5) bx(f, u + 0.05, 0.05, 0.06, 0.26, 0.12, 0.1, 0x5e4a3a)
    }
  } },
  epave: { at: 'sol', make(f) {
    const v = mid(f)
    for (let i = 0; i < 5; i++) bx(f, (i - 2) * 0.35, v + (f.d.rng() - 0.5) * 0.6, 0.35, 0.22, 1.6, 0.05, 0x5e4a3a, SURF.planksZ, { local: f.d.rng(), pitch: 0.6 + f.d.rng() * 0.6 })
    cy(f, 0.8, v + 0.3, 0.25, 0.3, 0.5, 0x6a5a5e, SURF.steel, 1.2)
    for (let i = 0; i < 6; i++) bx(f, -0.8 + i * 0.3, v - 0.3, 0.5 + f.d.rng() * 0.4, 0.06, 0.9 + f.d.rng() * 0.6, 0.02, 0x4f6d5a, SURF.paint, { local: f.d.rng() * 3 })
    bx(f, 0, v, 0.03, 2.4, 0.02, 1.8, 0x34505e)
  } },
  coulures: { at: 'mur', make(f) {
    for (const u of steps(f, 0.5)) {
      const h = 1 + f.d.rng() * 2.2
      bx(f, u, WALL + 0.025, 3.1 - h / 2, 0.14 + f.d.rng() * 0.2, h, 0.01, pickOne(f.d.rng, [0x4f6d5a, 0x5e6a4a, 0x6a7a6a]))
    }
    bx(f, 0, 0.3, 0.025, span(f) * 0.8, 0.012, 0.9, 0x34505e)
    lay(f, 0, WALL + 0.12, 2.9, 0.07, span(f, 0), 0x8a5a3a, SURF.steel)
  } },
  amarres: { at: 'mur', make(f) {
    for (const u of steps(f, 1.6, 0.6)) {
      cy(f, u, 0.15, 0.3, 0.16, 0.6, 0x3e3a4a, SURF.steel)
      cy(f, u, 0.15, 0.62, 0.22, 0.06, 0x3e3a4a, SURF.steel)
      for (let i = 0; i < 3; i++) cy(f, u + 0.5, 0.2, 0.04 + i * 0.07, 0.34 - i * 0.06, 0.07, i % 2 ? 0xa58660 : HEMP, SURF.fabric)
    }
    lay(f, 0, WALL + 0.1, 0.9, 0.035, span(f), 0x52576a, SURF.steel)
  } },
  casiers: { at: 'mur', make(f) {
    steps(f, 0.7, 0.3).forEach((u, i) => {
      for (let k = 0; k < 1 + (i % 3); k++) {
        bx(f, u, WALL + 0.32, 0.25 + k * 0.5, 0.6, 0.48, 0.55, 0x8a6a44, SURF.fabric, { local: (f.d.rng() - 0.5) * 0.2 })
        bx(f, u, WALL + 0.32, 0.25 + k * 0.5, 0.64, 0.04, 0.58, 0x5e4a3a)
      }
      if (i % 2 === 0) cy(f, u + 0.3, 0.2, 0.15, 0.13, 0.26, i % 4 ? 0xe8674a : 0xf4f1e6)
    })
  } },
  vannes: { at: 'mur', make(f) {
    const w = span(f)
    lay(f, 0, WALL + 0.2, 2.4, 0.1, w, f.d.pal.metal, SURF.steel)
    for (const u of steps(f, 0.9)) {
      cy(f, u, WALL + 0.2, 1.65, 0.07, 1.5, f.d.pal.metal, SURF.steel)
      cy(f, u, WALL + 0.36, 1.4, 0.2, 0.04, 0xc46a4a, SURF.brass, undefined, HALF_PI)
      bx(f, u, WALL + 0.37, 1.4, 0.36, 0.035, 0.03, 0xc46a4a)
      bx(f, u, WALL + 0.37, 1.4, 0.035, 0.36, 0.03, 0xc46a4a)
      cy(f, u + 0.22, WALL + 0.26, 1.95, 0.09, 0.05, BRASS, SURF.brass, undefined, HALF_PI)
      cy(f, u + 0.22, WALL + 0.29, 1.95, 0.075, 0.01, CREAM, SURF.paint, undefined, HALF_PI)
    }
  } },
  jauge: { at: 'mur', make(f) {
    for (const u of steps(f, 1.2, 0.5)) {
      cy(f, u, WALL + 0.2, 1.6, 0.09, 2.6, GLASS)
      cy(f, u, WALL + 0.2, 0.3 + f.d.rng() * 0.9, 0.07, 0.6 + f.d.rng() * 1.2, 0x3e8a88)
      for (const y of [0.25, 2.95]) cy(f, u, WALL + 0.2, y, 0.13, 0.12, BRASS, SURF.brass)
      for (let i = 0; i < 8; i++) bx(f, u + 0.16, WALL + 0.06, 0.5 + i * 0.3, 0.12, 0.02, 0.01, i % 4 ? 0x2e2a2a : 0xc46a4a)
    }
  } },
  exvotos: { at: 'mur', make(f) {
    const w = Math.min(3, span(f))
    for (let i = 0; i < Math.floor(w * 5); i++) {
      const u = -w / 2 + 0.15 + f.d.rng() * (w - 0.3)
      const y = 1.4 + f.d.rng() * 1.2
      const s = 0.12 + f.d.rng() * 0.14
      bx(f, u, WALL + 0.035, y, s, s * 1.25, 0.02, f.d.rng() < 0.4 ? BRASS : CREAM, SURF.brass)
    }
    shelf(f, w, 1.0, 0.3, 0x5e4a3a)
    for (let i = 0; i < 9; i++) {
      const u = -w / 2 + 0.2 + i * ((w - 0.4) / 8)
      const h = 0.12 + (i % 3) * 0.06
      cy(f, u, WALL + 0.15, 1.02 + h / 2, 0.025, h, CREAM)
      bx(f, u, WALL + 0.15, 1.05 + h, 0.025, 0.05, 0.025, 0xffd08a)
    }
    glow(f, 0, WALL + 0.5, 1.3, 0xffc27a, 2.5)
  } },
  chandelier: { at: 'sol', make(f) {
    const v = mid(f)
    for (let k = 0; k < 3; k++) bx(f, 0, v, 0.3 + k * 0.3, 1.4 - k * 0.4, 0.06, 0.6 - k * 0.12, BRASS, SURF.brass)
    cy(f, 0, v, 0.45, 0.05, 0.9, BRASS, SURF.brass)
    for (let i = 0; i < 14; i++) {
      const k = i % 3
      const u = -0.6 + k * 0.2 + (Math.floor(i / 3) % 5) * ((1.2 - k * 0.4) / 5)
      cy(f, u, v + (f.d.rng() - 0.5) * 0.3, 0.42 + k * 0.3, 0.02, 0.18, CREAM)
      bx(f, u, v, 0.55 + k * 0.3, 0.02, 0.05, 0.02, 0xffd08a)
    }
    glow(f, 0, v, 1.1, 0xffc27a, 3)
  } },
  bacs: { at: 'sol', make(f) {
    const v = mid(f)
    bx(f, 0, v, 0.35, 2.4, 0.7, 0.9, 0x6a4a34, SURF.planksX)
    bx(f, 0, v, 0.69, 2.3, 0.02, 0.8, 0x3e7a6a)
    for (const s of [-1, 1]) bx(f, 0, v + s * 0.46, 0.85, 2.4, 0.35, 0.015, GLASS)
    for (let i = 0; i < 4; i++) put(f, 'laminaire', -0.9 + i * 0.6, v + (f.d.rng() - 0.5) * 0.4, 0.7, f.d.rng() * 6, 0.45 + f.d.rng() * 0.2)
  } },
  treille: { at: 'mur', make(f) {
    const w = span(f)
    for (let i = -6; i <= 6; i++) {
      bx(f, i * 0.35, WALL + 0.06, 1.7, 0.04, 3.0, 0.03, 0xd8b04a, SURF.planksZ, { roll: 0.6 })
      bx(f, i * 0.35, WALL + 0.08, 1.7, 0.04, 3.0, 0.03, 0xd8b04a, SURF.planksZ, { roll: -0.6 })
    }
    bx(f, 0, WALL + 0.04, 0.12, w, 0.24, 0.06, 0x6a4a34)
    for (const u of steps(f, 0.3)) {
      const h = 0.8 + f.d.rng() * 1.1
      bx(f, u, WALL + 0.14, 2.9 - h / 2, 0.14, h, 0.012, pickOne(f.d.rng, [0xc79a3b, 0x9aa858, 0xd8b04a]), SURF.paint, { local: (f.d.rng() - 0.5) * 0.5 })
    }
    rail(f, 2.95, w, 0xd8b04a)
  } },
  mobile: { at: 'mur', make(f) {
    const u0 = (f.d.rng() - 0.5) * Math.max(0, f.slot.w - 1.6)
    bx(f, u0, 0, 2.6, 1.2, 0.03, 0.03, 0x8a6a44)
    lay(f, u0, 0.3, 2.3, 0.015, 0.8, 0x8a6a44)
    const colors = [0xe8674a, 0xe0b04a, 0xa9c8d8, 0x8fbf6a, 0xf2c6a0]
    for (let i = 0; i < 6; i++) {
      const u = u0 - 0.5 + i * 0.2
      const drop = 0.3 + f.d.rng() * 0.5
      f.d.wires.push({ a: f.at(u, 0.3, 2.3), b: f.at(u, 0.3, 2.3 - drop), r: 0.004 })
      bx(f, u, 0.3, 2.3 - drop - 0.07, 0.16, 0.12, 0.02, colors[i % colors.length]!, SURF.paint, { local: f.d.rng() * 3 })
    }
    put(f, 'berceau', u0, 0.4)
  } },
  cubes: { at: 'mur', make(f) {
    const w = span(f)
    shelf(f, w, 0.5, 0.35, 0xf2c6a0)
    shelf(f, w, 1.0, 0.35, 0xf2c6a0)
    for (let i = 0; i < Math.floor(w * 4); i++) {
      const s = 0.12 + f.d.rng() * 0.08
      bx(f, -w / 2 + 0.15 + f.d.rng() * (w - 0.3), WALL + 0.18, (f.d.rng() < 0.5 ? 0.52 : 1.02) + s / 2, s, s, s, pickOne(f.d.rng, [0xe8674a, 0xe0b04a, 0xa9c8d8, 0x8fbf6a]), SURF.planksX, { local: f.d.rng() })
    }
    put(f, 'jouets', 0, 0.3, 0, 1)
  } },
  semis: { at: 'mur', make(f) {
    const w = span(f)
    for (let k = 0; k < 3; k++) {
      const y = 0.45 + k * 0.5
      bx(f, 0, WALL + 0.45 - k * 0.12, y, w, 0.12, 0.42, 0x6a4a34, SURF.planksX)
      bx(f, 0, WALL + 0.45 - k * 0.12, y + 0.065, w - 0.06, 0.01, 0.38, 0x4a3628)
      for (let u = -w / 2 + 0.1; u < w / 2 - 0.05; u += 0.14) bx(f, u, WALL + 0.45 - k * 0.12 + (f.d.rng() - 0.5) * 0.2, y + 0.11, 0.06, 0.08 + f.d.rng() * 0.08, 0.06, f.d.rng() < 0.5 ? 0x8fbf6a : 0x6f9a5a)
    }
    for (const u of [-w / 2 + 0.1, w / 2 - 0.1]) bx(f, u, WALL + 0.25, 0.75, 0.05, 1.5, 0.5, 0x5e4a3a, SURF.planksZ)
  } },
  jardin: { at: 'mur', make(f) {
    for (const u of steps(f, 0.35, 0.5)) {
      bx(f, u, WALL + 0.12, 0.85, 0.04, 1.7, 0.04, 0x8a6a44, SURF.planksZ, { pitch: -0.12 })
      bx(f, u, WALL + 0.16, 0.1, 0.18, 0.22, 0.03, 0x8a8f99, SURF.steel, { pitch: -0.12 })
    }
    put(f, 'arrosoir', span(f) / 2, 0.2, 0, 0.5)
    put(f, 'sac', -span(f) / 2, 0.2, 0, 0.3)
  } },
  rayonnages: { at: 'mur', make(f) {
    const w = span(f, 0.15)
    const top = Math.min(2.9, f.d.roof(f.slot.cell, f.slot.at.y + 4) - f.slot.at.y - 0.3)
    for (const u of [-w / 2, w / 2]) bx(f, u, WALL + 0.2, top / 2, 0.06, top, 0.4, 0x4a3628, SURF.planksZ)
    const tones = [0x8a2a2a, 0x3e5a46, 0x6e8fb0, 0xc9a66b, 0x5e4a5c, 0xe0b04a]
    for (let y = 0.1; y < top - 0.3; y += 0.48) {
      bx(f, 0, WALL + 0.2, y, w, 0.03, 0.4, 0x4a3628, SURF.planksX)
      let u = -w / 2 + 0.05
      while (u < w / 2 - 0.1) {
        const bw = 0.1 + f.d.rng() * 0.16
        const bh = 0.24 + f.d.rng() * 0.1
        if (f.d.rng() > 0.08) bx(f, u + bw / 2, WALL + 0.18, y + 0.015 + bh / 2, bw, bh, 0.24, pickOne(f.d.rng, tones))
        u += bw + 0.012
      }
    }
    bx(f, w * 0.25, 0.1, top / 2, 0.42, top, 0.04, 0x6a4a34, SURF.paint, { pitch: -0.18 })
  } },
  lecture: { at: 'sol', make(f) {
    const v = mid(f)
    put(f, 'table', 0, v, 0, 0)
    put(f, 'tabouret', 0, v + 0.7)
    bx(f, -0.2, v, 0.785, 0.42, 0.01, 0.3, CREAM, SURF.plaster, { local: 0.2 })
    for (let i = 0; i < 4; i++) bx(f, 0.45, v - 0.1, 0.8 + i * 0.05, 0.3, 0.05, 0.22, pickOne(f.d.rng, [0x8a2a2a, 0x3e5a46, 0x6e8fb0]), SURF.paint, { local: f.d.rng() * 0.4 })
    const p = f.at(-0.5, v - 0.2)
    f.d.lamp({ kind: 'verte', cell: f.slot.cell, x: p.x, y: f.slot.at.y + 1.15, z: p.z, rot: f.rot(), color: 0xffd9a0, radius: 3.5, drop: 0 })
  } },
  scene: { at: 'mur', make(f) {
    const w = Math.min(4, span(f))
    bx(f, 0, WALL + 0.6, 0.3, w, 0.6, 1.2, 0x6a4a34, SURF.planksX)
    bx(f, 0, WALL + 0.06, 1.9, w, 2.6, 0.04, 0x2a1a24)
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) bx(f, s * (w / 2 - 0.15 - i * 0.12), WALL + 0.12 + i * 0.03, 1.9, 0.16, 2.6, 0.06, i % 2 ? 0x8a2a3a : 0x6a1a2a, SURF.fabric)
    bx(f, 0, WALL + 0.14, 3.1, w + 0.1, 0.4, 0.08, 0x8a2a3a, SURF.fabric)
    bx(f, 0, WALL + 0.18, 3.32, w + 0.2, 0.08, 0.1, 0xe0b04a, SURF.brass)
    for (const u of steps(f, 0.5, (f.slot.w - w) / 2 + 0.3)) f.d.bulbs.push({ ...f.at(u, WALL + 1.18, 0.64), color: 0xffc27a, size: 0.05 })
    glow(f, 0, WALL + 1.4, 1.2, 0xffc27a, 3.5)
  } },
  affiches: { at: 'mur', make(f) {
    for (const u of steps(f, 1.0, 0.4)) {
      const y = 1.7 + (f.d.rng() - 0.5) * 0.2
      bx(f, u, WALL + 0.03, y, 0.78, 1.08, 0.04, 0xe0b04a, SURF.brass)
      bx(f, u, WALL + 0.055, y, 0.68, 0.98, 0.01, pickOne(f.d.rng, [0x8a2a3a, 0x3e4a7a, 0xe8674a, 0xefe3c4]), SURF.plaster)
      bx(f, u, WALL + 0.062, y + 0.15, 0.36, 0.36, 0.004, pickOne(f.d.rng, [0xefe3c4, 0xe0b04a, 0x2a1a24]))
      bx(f, u, WALL + 0.062, y - 0.32, 0.5, 0.08, 0.004, 0xefe3c4)
    }
  } },
  aquarium: { at: 'mur', make(f) {
    for (const u of steps(f, 1.8, 0.3)) {
      bx(f, u, WALL + 0.35, 0.4, 1.6, 0.8, 0.7, 0x4a3628, SURF.planksX)
      bx(f, u, WALL + 0.06, 1.35, 1.5, 1.1, 0.04, 0x2e6a70)
      bx(f, u, WALL + 0.35, 0.83, 1.5, 0.06, 0.62, 0xd8c8a0, SURF.stone)
      for (const s of [-1, 1]) bx(f, u + s * 0.77, WALL + 0.35, 1.35, 0.05, 1.1, 0.7, 0xc98a5a, SURF.brass)
      bx(f, u, WALL + 0.35, 1.92, 1.6, 0.05, 0.7, 0xc98a5a, SURF.brass)
      bx(f, u, WALL + 0.68, 1.35, 1.5, 1.04, 0.012, GLASS)
      for (let i = 0; i < 5; i++) {
        const fu = u - 0.55 + f.d.rng() * 1.1
        const fy = 1.0 + f.d.rng() * 0.75
        bx(f, fu, WALL + 0.3 + f.d.rng() * 0.25, fy, 0.16, 0.07, 0.02, pickOne(f.d.rng, [0xe8674a, 0xe0b04a, 0x9fb8c8]))
        bx(f, fu + 0.1, WALL + 0.3, fy, 0.05, 0.08, 0.015, GLINT)
      }
      put(f, 'laminaire', u + 0.5, WALL + 0.3, 0.86, 0, 0.25)
      glow(f, u, WALL + 0.9, 1.4, 0xffc27a, 2.2)
    }
  } },
  filets: { at: 'mur', make(f) {
    const w = span(f)
    const n = Math.max(3, Math.floor(w / 0.3))
    for (let i = 0; i <= n; i++) {
      const u = -w / 2 + (w * i) / n
      f.d.wires.push({ a: f.at(u, WALL + 0.1, 2.8), b: f.at(u + 0.1, WALL + 0.15, 0.8 + Math.sin(i) * 0.2), r: 0.006 })
    }
    for (const y of [2.5, 2.1, 1.7, 1.3]) f.d.wires.push({ a: f.at(-w / 2, WALL + 0.12, y), b: f.at(w / 2, WALL + 0.12, y - 0.1), r: 0.006 })
    for (const u of steps(f, 0.5)) {
      if (f.d.rng() < 0.5) cy(f, u, WALL + 0.18, 2.75, 0.07, 0.12, 0xe0b04a, SURF.fabric, HALF_PI)
      else bx(f, u, WALL + 0.2, 1.2 + f.d.rng() * 1.2, 0.18, 0.18, 0.18, GLASS)
    }
    put(f, 'epuisette', w / 2 - 0.3, 0.1, 0, 0.4)
  } },
  orgue: { at: 'mur', make(f) {
    const w = Math.min(3.6, span(f))
    bx(f, 0, WALL + 0.35, 0.5, w, 1.0, 0.7, 0x5e4a3a, SURF.planksX)
    const n = Math.floor(w / 0.2)
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + 0.1 + i * (w - 0.2) / Math.max(1, n - 1)
      const h = 1.2 + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 1.8 + (i % 2) * 0.2
      cy(f, u, WALL + 0.25, 1 + h / 2, 0.075, h, i % 3 ? 0xc07a4a : BRASS, SURF.brass)
      bx(f, u, WALL + 0.33, 1.25, 0.06, 0.04, 0.02, 0x2a1a14)
    }
  } },
  rouages: { at: 'mur', make(f) {
    for (const u of steps(f, 1.4, 0.5)) {
      const r = 0.35 + f.d.rng() * 0.35
      const y = 1.4 + f.d.rng() * 1.2
      cy(f, u, WALL + 0.08, y, r, 0.08, f.d.pal.metal, SURF.steel, undefined, HALF_PI)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        bx(f, u + Math.cos(a) * r, WALL + 0.08, y + Math.sin(a) * r, 0.1, 0.1, 0.08, f.d.pal.metal, SURF.steel, { roll: a })
      }
      cy(f, u, WALL + 0.14, y, 0.08, 0.1, BRASS, SURF.brass, undefined, HALF_PI)
    }
  } },
}

export function kitAt(id: KitId): 'mur' | 'sol' {
  return KITS[id].at
}

export function runKit(id: KitId, f: Frame): void {
  KITS[id].make(f)
}
