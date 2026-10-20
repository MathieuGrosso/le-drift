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

export const BAKE = { ambient: { haut: 0.55, bas: 0.42 } as const, ambientMix: 0.55, radius: 1.2, power: 0.7, rim: 0.3, slice: 30000, ceilingGap: 0.1 }

export const BRIDGE = { width: 2.4, maxGap: 4, chance: 0.6, perHull: 2 }

export const RAMP = { risePerCell: 2 }

export const PORT = { w: 4, h: 4.6 }

export const WATER = { depth: 0.45, surface: 0.33 }

// The haut layer's main void is sunk to deck bas (y −6): the landmark square, ramps down its rim.
export const FOSSE = { depth: 6, portClear: 1, ramps: 4, rampGap: 1, tries: 8, flood: 0.5, plain: [6, 6] as const }

export const WINDOWS = { hublotEvery: 6, hublotR: 0.7, baie: { w: 12, h: 7 } }

export const LAMPS = {
  streetEvery: 16, radius: 9,
  key: 0xffb36b, keyRadius: 10, keyHeight: 3.2,
  wallEvery: 14, wallHeight: 5, wallInset: 0.8, wallRadius: 11,
}

// Spawn on the void rim; `side` mirrors liaisons' BOOTH.side (the return booth stands to its right).
export const ARRIVAL = { side: 3.2, clear: 5, mainBonus: 6 }

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
  arrivalHold: 6,
  // The bake blocks the main thread (~100-200 ms): only for a district the hero lingers in.
  navDwell: 20,
}

export const SILHOUETTE = {
  color: 0xa07a5c, tint: 0.3, valueJitter: 0.14, girth: 0.92, capSegments: 2, radial: 8,
  // Window cards: `span` of the hull length carries them, `sill` of a storey up, `off` share unlit.
  windows: { w: 1.1, h: 1.5, every: 3.2, span: 0.6, sill: 0.45, lift: 0.12, off: 0.3, dim: 0.35, jitter: 0.12 },
}
