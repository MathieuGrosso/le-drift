import type { DistrictId } from '../core/types'
import type { StepSurface } from './sfx'

export type Flavor = 'home' | 'market' | 'garden' | 'nave' | 'engine' | 'workshop' | 'sealed' | 'heights' | 'prow'
export type Scene = 'kids-game' | 'supper-song' | 'cook-hum' | 'engine-beat'

export interface Emitter {
  id: string
  every: readonly [number, number]
  amount?: readonly [number, number]
  spread?: number
  hours?: readonly [number, number]
  crowd?: boolean
  glass?: boolean
}

export interface Profile {
  room: number
  hall: number
  hum: number
  crowd: number
  drips: number
  wind: number
  trickle: number
  floor: StepSurface
  flavor: Flavor
  emitters: readonly Emitter[]
  scenes: readonly Scene[]
}

const CREAK: Emitter = { id: 'creak', every: [8, 20], amount: [0.3, 0.9], spread: 10 }
const TICK: Emitter = { id: 'hull-tick', every: [14, 40], amount: [0.3, 0.8], spread: 14 }
const KNOCK: Emitter = { id: 'pipe-knock', every: [25, 60], amount: [0.2, 0.5], spread: 16 }

export const DISTRICT_PROFILES: Record<DistrictId, Profile> = {
  ecluse: {
    room: 0.8, hall: 0.25, hum: 0.06, crowd: 0.45, drips: 0.1, wind: 0, trickle: 0, floor: 'bois', flavor: 'home',
    emitters: [
      CREAK, TICK, KNOCK,
      { id: 'voices', every: [3, 9], amount: [0.3, 0.7], spread: 14, crowd: true },
      { id: 'crockery', every: [6, 16], amount: [0.2, 0.5], spread: 12, crowd: true },
      { id: 'laugh', every: [25, 70], amount: [0.3, 0.6], spread: 16, crowd: true },
      { id: 'kid-call', every: [20, 50], amount: [0.3, 0.6], spread: 18, hours: [8, 19] },
    ],
    scenes: [],
  },
  marche: {
    room: 0.35, hall: 0.6, hum: 0.03, crowd: 1, drips: 0, wind: 0, trickle: 0, floor: 'bois', flavor: 'market',
    emitters: [
      CREAK,
      { id: 'voices', every: [0.8, 3], amount: [0.4, 0.9], spread: 16, crowd: true },
      { id: 'vendor-call', every: [5, 14], amount: [0.4, 0.8], spread: 20, crowd: true, hours: [6.5, 19] },
      { id: 'coins', every: [3, 9], amount: [0.3, 0.7], spread: 10, crowd: true },
      { id: 'crockery', every: [4, 10], amount: [0.2, 0.5], spread: 14, crowd: true },
      { id: 'laugh', every: [10, 30], amount: [0.4, 0.7], spread: 18, crowd: true },
      { id: 'kid-call', every: [12, 30], amount: [0.3, 0.6], spread: 20, hours: [8, 19] },
      { id: 'clock', every: [6, 6], amount: [0.4, 0.4], spread: 20 },
      { id: 'clock-bell', every: [180, 260], amount: [0.5, 0.8], spread: 26, hours: [7, 21] },
    ],
    scenes: [],
  },
  serres: {
    room: 0.3, hall: 0.55, hum: 0.05, crowd: 0.2, drips: 1, wind: 0, trickle: 0.8, floor: 'mouille', flavor: 'garden',
    emitters: [
      { id: 'drip', every: [0.4, 1.8], amount: [0.3, 1], spread: 10 },
      { id: 'pot', every: [12, 30], amount: [0.2, 0.4], spread: 14 },
      { id: 'steam', every: [10, 30], amount: [0.2, 0.5], spread: 16 },
      { id: 'voices', every: [10, 25], amount: [0.2, 0.4], spread: 18, crowd: true },
      TICK,
    ],
    scenes: [],
  },
  nef: {
    room: 0.1, hall: 1, hum: 0.08, crowd: 0.6, drips: 0, wind: 0.25, trickle: 0, floor: 'grille', flavor: 'nave',
    emitters: [
      CREAK, KNOCK,
      { id: 'voices', every: [1.5, 5], amount: [0.2, 0.5], spread: 30, crowd: true },
      { id: 'zip', every: [30, 80], amount: [0.2, 0.4], spread: 35, hours: [6.5, 21] },
      { id: 'tube', every: [40, 90], amount: [0.2, 0.4], spread: 35, hours: [6, 22] },
      { id: 'hammer', every: [30, 70], amount: [0.15, 0.3], spread: 40, hours: [8, 18] },
      { id: 'gong', every: [240, 400], amount: [0.15, 0.25], spread: 40 },
      { id: 'steam', every: [15, 30], amount: [0.15, 0.3], spread: 24 },
    ],
    scenes: [],
  },
  machines: {
    room: 0.2, hall: 0.9, hum: 0.6, crowd: 0.1, drips: 0.3, wind: 0, trickle: 0, floor: 'grille', flavor: 'engine',
    emitters: [
      KNOCK,
      { id: 'steam', every: [2, 7], amount: [0.4, 1], spread: 14 },
      { id: 'hammer', every: [12, 30], amount: [0.3, 0.6], spread: 20 },
      { id: 'pipe-knock', every: [5, 14], amount: [0.4, 0.8], spread: 14 },
      { id: 'drip', every: [3, 9], amount: [0.3, 0.6], spread: 10 },
      { id: 'voices', every: [12, 30], amount: [0.3, 0.5], spread: 14, crowd: true },
    ],
    scenes: ['engine-beat'],
  },
  ateliers: {
    room: 0.6, hall: 0.4, hum: 0.08, crowd: 0.5, drips: 0, wind: 0, trickle: 0, floor: 'bois', flavor: 'workshop',
    emitters: [
      CREAK,
      { id: 'hammer', every: [3, 10], amount: [0.4, 0.8], spread: 18, hours: [7, 19] },
      { id: 'saw', every: [8, 20], amount: [0.4, 0.8], spread: 14, hours: [7, 19] },
      { id: 'rope', every: [5, 14], amount: [0.4, 0.8], spread: 12 },
      { id: 'voices', every: [3, 10], amount: [0.3, 0.6], spread: 16, crowd: true },
      { id: 'kid-call', every: [15, 40], amount: [0.3, 0.6], spread: 20, hours: [8.5, 16] },
    ],
    scenes: [],
  },
  scellees: {
    room: 0.1, hall: 1, hum: 0.12, crowd: 0, drips: 0.6, wind: 0.1, trickle: 0.2, floor: 'metal', flavor: 'sealed',
    emitters: [
      { id: 'drip-echo', every: [1.5, 5], amount: [0.4, 1], spread: 14 },
      { id: 'hull-tick', every: [5, 15], amount: [0.4, 1], spread: 16 },
      { id: 'groan', every: [40, 90], amount: [0.2, 0.4], spread: 20 },
      { id: 'pipe-knock', every: [20, 50], amount: [0.3, 0.6], spread: 20 },
    ],
    scenes: [],
  },
  hauts: {
    room: 0.5, hall: 0.4, hum: 0.02, crowd: 0.05, drips: 0, wind: 1, trickle: 0, floor: 'metal', flavor: 'heights',
    emitters: [TICK, { id: 'creak', every: [10, 25], amount: [0.2, 0.5], spread: 14 }],
    scenes: [],
  },
  proue: {
    room: 0.7, hall: 0.3, hum: 0.03, crowd: 0.1, drips: 0, wind: 0.2, trickle: 0, floor: 'bois', flavor: 'prow',
    emitters: [CREAK, TICK, { id: 'clock', every: [6, 6], amount: [0.3, 0.3], spread: 6 }],
    scenes: [],
  },
}

export const CELL_PROFILES: Record<string, Partial<Profile>> = {
  cabine: {
    room: 1, hall: 0, crowd: 0.05, floor: 'bois',
    emitters: [CREAK, { id: 'clock', every: [6, 6], amount: [0.2, 0.2], spread: 3 }, { id: 'snore', every: [5, 12], amount: [0.3, 0.6], spread: 6, hours: [21.5, 6] }],
  },
  'cabines-voisins': {
    room: 1, hall: 0.1, crowd: 0.2, floor: 'tapis',
    emitters: [CREAK, { id: 'snore', every: [4, 9], amount: [0.3, 0.7], spread: 8, hours: [21.5, 6] }, { id: 'voices', every: [8, 20], amount: [0.2, 0.4], spread: 8, crowd: true }],
  },
  sas: {
    room: 1, hall: 0.2, crowd: 0, hum: 0.1, floor: 'grille',
    emitters: [{ id: 'drip', every: [1, 3], amount: [0.4, 0.8], spread: 4 }, TICK, { id: 'pipe-knock', every: [15, 40], amount: [0.3, 0.5], spread: 6 }],
  },
  refectoire: {
    room: 0.5, hall: 0.6, crowd: 1.2, floor: 'bois',
    emitters: [
      CREAK,
      { id: 'voices', every: [0.6, 2.2], amount: [0.3, 0.8], spread: 14, crowd: true },
      { id: 'crockery', every: [1.2, 4], amount: [0.3, 0.8], spread: 12, crowd: true },
      { id: 'laugh', every: [8, 25], amount: [0.4, 0.8], spread: 14, crowd: true },
      { id: 'kid-call', every: [12, 30], amount: [0.3, 0.6], spread: 14, hours: [7, 20] },
    ],
    scenes: ['supper-song', 'kids-game'],
  },
  rebord: { scenes: ['kids-game'], room: 0.5, hall: 0.5 },
  cuisine: {
    room: 0.9, hall: 0.1, crowd: 0.4, floor: 'tapis', hum: 0.04,
    emitters: [
      { id: 'sizzle', every: [2, 5], amount: [0.4, 1], spread: 5, hours: [5.5, 21] },
      { id: 'pot', every: [2.5, 6], amount: [0.4, 0.8], spread: 5 },
      { id: 'chop', every: [5, 12], amount: [0.5, 0.9], spread: 5, hours: [5.5, 20.5] },
      { id: 'crockery', every: [3, 8], amount: [0.3, 0.7], spread: 6 },
      { id: 'kettle', every: [40, 90], amount: [0.6, 1], spread: 5 },
      { id: 'steam', every: [6, 16], amount: [0.2, 0.4], spread: 5 },
    ],
    scenes: ['cook-hum'],
  },
  marche: {
    room: 0.4, hall: 0.4, crowd: 0.8,
    emitters: [
      CREAK,
      { id: 'voices', every: [1, 4], amount: [0.3, 0.7], spread: 12, crowd: true },
      { id: 'vendor-call', every: [8, 20], amount: [0.4, 0.8], spread: 14, crowd: true, hours: [6.5, 19] },
      { id: 'coins', every: [4, 11], amount: [0.3, 0.6], spread: 8, crowd: true },
    ],
  },
  'salle-des-cartes': {
    room: 0.9, hall: 0.1, crowd: 0, floor: 'tapis',
    emitters: [CREAK, { id: 'clock', every: [6, 6], amount: [0.35, 0.35], spread: 4 }, { id: 'stylo', every: [6, 18], amount: [0.4, 0.8], spread: 3 }, { id: 'paper', every: [15, 40], amount: [0.3, 0.6], spread: 3 }],
    scenes: [],
  },
  'echelle-toit': { room: 0.7, hall: 0.2, floor: 'echelle', wind: 0.4 },
}

export function profileFor(district: DistrictId, cell: string | null): Profile {
  const base = DISTRICT_PROFILES[district]
  const over = cell ? CELL_PROFILES[cell] : undefined
  if (!over) return base
  return { ...base, ...over, emitters: over.emitters ?? base.emitters, scenes: over.scenes ?? base.scenes }
}

/** 0..1 how many people are about at this hour, scaled per place. */
export function crowdAt(hours: number, cell: string | null, flavor: Flavor): number {
  const h = ((hours % 24) + 24) % 24
  const band = (a: number, b: number) => h >= a && h < b
  if (cell === 'refectoire') {
    if (band(7.3, 8.6)) return 1
    if (band(19, 21)) return 0.9
    if (band(12, 13.5)) return 0.6
    if (band(6.3, 7.3) || band(8.6, 9.5)) return 0.4
    return band(21, 24) || band(0, 6) ? 0.02 : 0.15
  }
  if (flavor === 'market') {
    if (band(8, 18)) return 1
    if (band(6.3, 8) || band(18, 20)) return 0.55
    return 0.05
  }
  if (band(21.5, 24) || band(0, 5.8)) return 0.05
  if (band(5.8, 7)) return 0.35
  if (band(7, 8.6)) return 0.55
  if (band(17.3, 18)) return 0.85
  if (band(19, 21.5)) return 0.6
  return 0.7
}

export function inHours(h: number, range: readonly [number, number] | undefined): boolean {
  if (!range) return true
  const x = ((h % 24) + 24) % 24
  const [a, b] = range
  return a <= b ? x >= a && x < b : x >= a || x < b
}
