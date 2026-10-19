import type { DeckId } from '../../core/types'
import type { Layer } from '../types'

export const GRID = 4

export const LEVELS: Readonly<Record<Layer, { ground: number; storey: number; storeys: number; top: number }>> = {
  haut: { ground: 0, storey: 8, storeys: 3, top: 30 },
  bas: { ground: -22, storey: 8, storeys: 2, top: -6 },
}

export const DECK_AT: readonly (readonly [y: number, deck: DeckId])[] = [
  [-22, 'cale'], [-14, 'machines'], [-6, 'bas'], [0, 'principal'], [8, 'haut'], [16, 'toits'], [22, 'domes'],
]

export const STREET = {
  mainWidth: 2,
  noise: 3.2,
  turnCost: 1.6,
  plazaEvery: 7,
  alleyComponent: 70,
}

export const LOT = {
  minSide: 3,
  maxSide: [3, 6] as const,
  maxLong: [4, 8] as const,
  kioskMax: 3,
}

export const HULL = {
  wall: 0.3,
  slab: 0.4,
  door: { w: 2.4, h: 3.4, every: 3 },
  stair: { width: 2.4, run: 12, offset: 3 },
  rail: 1.1,
  ribEvery: 3,
  roofRise: 3.5,
}

export const BRIDGE = { width: 2.4, maxGap: 4, chance: 0.6, perHull: 2 }

export const RAMP = { risePerCell: 2 }

export const PORT = { w: 4, h: 4.6 }

export const WATER = { depth: 0.45, surface: 0.15 }

export const WINDOWS = { hublotEvery: 6, hublotR: 0.7, baie: { w: 12, h: 7 } }

export const LAMPS = { streetEvery: 16, radius: 9 }

export const SHAPE_VOID: Readonly<Record<string, readonly [w: number, d: number] | null>> = {
  rue: null,
  atrium: [8, 9],
  'nef-longue': [4, 0],
  grappe: [5, 5],
  puits: [6, 6],
  archipel: [6, 7],
  terrasses: [5, 8],
}

export const STREAM = {
  buildDist: 60,
  disposeDist: 120,
  maxBuilt: { high: 4, medium: 3, low: 2 } as const,
  budgetMs: { high: 2, medium: 1.5, low: 1 } as const,
  variants: 3,
}

export const SILHOUETTE = { color: 0x6f6a78, tint: 0.45, valueJitter: 0.12, girth: 0.92, capSegments: 2, radial: 8 }
