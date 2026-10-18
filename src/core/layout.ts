import { quarterPoint } from '../drift/interiors/scale'
import type { DeckId, DistrictId, GameMode, PlaceId, RegionId, RoomId, Vec3 } from './types'

export const SEED = 0x0d21f7
export const WORLD_HALF = 1024
export const WORLD_SIZE = 2048
export const CEILING_Y = 120
export const HERO_MAX_Y = 118
export const CHUNK_SIZE = 128
export const CHUNKS_PER_SIDE = 16
export const BLEU_EDGE = 980

export type XZ = { x: number; z: number }

export function chunkOrigin(cx: number, cz: number): XZ {
  return { x: cx * CHUNK_SIZE - WORLD_HALF, z: cz * CHUNK_SIZE - WORLD_HALF }
}

export function chunkOf(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor((x + WORLD_HALF) / CHUNK_SIZE),
    cz: Math.floor((z + WORLD_HALF) / CHUNK_SIZE),
  }
}

export const REGIONS: Record<Exclude<RegionId, 'bleu'>, XZ> = {
  prairie: { x: 0, z: 600 },
  laminaires: { x: -620, z: 0 },
  pilier: { x: 0, z: 0 },
  cheminee: { x: 820, z: 380 },
  coques: { x: 560, z: -520 },
  blanc: { x: 0, z: -850 },
}

export const BLANC_SLOPE = { zStart: -650, yStart: 30, zEnd: -1000, yEnd: 112 }

export const LANDMARKS = {
  pilier: { x: 0, z: 0, topY: 95 },
  panache: { x: 820, z: 380, radiusBottom: 15, radiusTop: 60 },
  canopee: { x: -620, z: 0, topY: 90 },
  drift: { width: 260, depth: 160, yMin: 40, yMax: 75, hulls: 400, walkableHulls: 12 },
} as const

export interface SondeDef { id: string; region: RegionId; x: number; z: number; topY: number }
export const SONDES: readonly SondeDef[] = [
  { id: 'sonde-promontoire', region: 'prairie', x: -40, z: 660, topY: 60 },
  { id: 'sonde-pilier', region: 'pilier', x: 0, z: 0, topY: 100 },
  { id: 'sonde-laminaires', region: 'laminaires', x: -640, z: 60, topY: 85 },
  { id: 'sonde-cheminee', region: 'cheminee', x: 760, z: 300, topY: 90 },
  { id: 'sonde-coques', region: 'coques', x: 560, z: -520, topY: 80 },
  { id: 'sonde-blanc', region: 'blanc', x: -100, z: -700, topY: 95 },
]

export interface HautFondDef { id: string; x: number; z: number; topBelowCeiling: number; rule: string }
export const HAUTS_FONDS: readonly HautFondDef[] = [
  { id: 'hf-01', x: -320, z: 520, topBelowCeiling: 12, rule: 'bubble-lift' },
  { id: 'hf-02', x: 260, z: 700, topBelowCeiling: 12, rule: 'lens-gate' },
  { id: 'hf-03', x: -520, z: -240, topBelowCeiling: 12, rule: 'lane-float' },
  { id: 'hf-04', x: -760, z: 360, topBelowCeiling: 12, rule: 'kelp-timing' },
  { id: 'hf-05', x: 180, z: -160, topBelowCeiling: 12, rule: 'mirror-shells' },
  { id: 'hf-06', x: 620, z: 620, topBelowCeiling: 12, rule: 'heat-voile' },
  { id: 'hf-07', x: 880, z: -140, topBelowCeiling: 12, rule: 'bubble-bell' },
  { id: 'hf-08', x: 380, z: -360, topBelowCeiling: 12, rule: 'fish-food' },
  { id: 'hf-09', x: -380, z: -780, topBelowCeiling: 10, rule: 'coat-race' },
  { id: 'hf-10', x: 300, z: -820, topBelowCeiling: 10, rule: 'light-lens-current' },
  { id: 'hf-11', x: -160, z: -900, topBelowCeiling: 9, rule: 'bubbles-weights' },
  { id: 'hf-12', x: 120, z: -960, topBelowCeiling: 8, rule: 'seuil' },
]

export const CAMPS: readonly XZ[] = [
  { x: -300, z: 420 },
  { x: -560, z: -160 },
  { x: 640, z: 220 },
  { x: 420, z: -320 },
  { x: -80, z: -560 },
]

export interface LaneDef { id: string; points: readonly XZ[]; width: number; speed: number }
export const LANES: readonly LaneDef[] = [
  { id: 'lane-sud', points: [{ x: -900, z: 800 }, { x: -300, z: 700 }, { x: 300, z: 640 }, { x: 900, z: 520 }], width: 30, speed: 8 },
  { id: 'lane-ouest', points: [{ x: -880, z: -600 }, { x: -700, z: -100 }, { x: -640, z: 500 }], width: 25, speed: 10 },
  { id: 'lane-nord', points: [{ x: 500, z: 300 }, { x: 420, z: -100 }, { x: 200, z: -500 }, { x: -100, z: -720 }], width: 30, speed: 9 },
]
// Water flows in point order (lane-ouest goes south, +z).
export const VENT_UPDRAFT = { x: 820, z: 380, radius: 40, speed: 7 }

export interface RouteWaypoint { id: string; x: number; z: number; gate: boolean }
export const DRIFT_ROUTE: readonly RouteWaypoint[] = [
  { id: 'start', x: 80, z: 520, gate: false },
  { id: 'halte-prairie', x: 300, z: 450, gate: true },
  { id: 'virage-nord', x: 450, z: 250, gate: false },
  { id: 'halte-coques', x: 300, z: -450, gate: true },
  { id: 'bord-du-blanc', x: 100, z: -640, gate: true },
]
export const DRIFT_SPEED = 0.5
export const DRIFT_Y = 55

export const VISTA = { hero: { x: -260, z: 760, yaw: Math.PI / 4 }, ridgeY: 38 }
export const SEUIL = { x: 120, z: -960, topY: 112 }

export const ROOMS: readonly RoomId[] = [
  'sas', 'coursive-sud', 'refectoire', 'rebord', 'cuisine', 'marche',
  'passerelle-1', 'passerelle-2', 'passerelle-3', 'salle-des-cartes', 'cabine',
  'cabines-voisins', 'echelle-toit',
]

export const CHOSE_DIVE_HOURS = [7, 17.5] as const

export const DRIFT_BOUNDS = { x0: -130, x1: 130, z0: -80, z1: 80, y0: -24, y1: 30 } as const

export const DECKS: Record<DeckId, { nom: string; y: number }> = {
  cale: { nom: 'La Cale', y: -22 },
  machines: { nom: 'Le Pont des Machines', y: -14 },
  bas: { nom: 'Le Pont Bas', y: -6 },
  principal: { nom: 'Le Pont Principal', y: 0 },
  haut: { nom: 'Le Pont Haut', y: 8 },
  toits: { nom: 'Les Toits', y: 16 },
  domes: { nom: 'Les Dômes', y: 22 },
}

export interface DistrictDef {
  id: DistrictId
  nom: string
  x0: number; x1: number; z0: number; z1: number
  y0: number; y1: number
  hulls: number
  decks: readonly DeckId[]
  accent: number
}

// Lookup order matters where boxes overlap: the first match owns the point (see districtAt).
export const DISTRICTS: readonly DistrictDef[] = [
  { id: 'ecluse', nom: "Le Quartier de l'Écluse", x0: -50, x1: 62, z0: 40, z1: 80, y0: -24, y1: 18, hulls: 34, decks: ['cale', 'machines', 'bas', 'principal', 'haut', 'toits'], accent: 0xd9b48f },
  { id: 'proue', nom: 'La Proue', x0: -30, x1: 30, z0: -80, z1: -50, y0: 4, y1: 30, hulls: 26, decks: ['haut', 'toits', 'domes'], accent: 0xefe3c4 },
  { id: 'machines', nom: 'Le Puits des Machines', x0: -40, x1: 40, z0: -60, z1: 40, y0: -24, y1: -10, hulls: 44, decks: ['cale', 'machines'], accent: 0xc46a4a },
  { id: 'nef', nom: 'La Grande Nef', x0: -50, x1: 50, z0: -40, z1: 40, y0: -10, y1: 30, hulls: 40, decks: ['bas', 'principal', 'haut', 'toits'], accent: 0xd9b48f },
  { id: 'hauts', nom: 'Les Hauts', x0: -130, x1: 130, z0: -80, z1: 80, y0: 19, y1: 30, hulls: 30, decks: ['domes'], accent: 0xcfefe3 },
  { id: 'marche', nom: 'Le Grand Marché', x0: -130, x1: -50, z0: -10, z1: 80, y0: -10, y1: 19, hulls: 70, decks: ['bas', 'principal', 'haut', 'toits'], accent: 0xd8644e },
  { id: 'serres', nom: 'Les Serres', x0: 50, x1: 130, z0: -10, z1: 80, y0: -10, y1: 19, hulls: 48, decks: ['bas', 'principal', 'haut', 'toits'], accent: 0x8fbf6a },
  { id: 'ateliers', nom: 'Les Ateliers', x0: -130, x1: -30, z0: -80, z1: -10, y0: -10, y1: 19, hulls: 56, decks: ['bas', 'principal', 'haut'], accent: 0x6e8fb0 },
  { id: 'scellees', nom: 'Les Coques Scellées', x0: 30, x1: 130, z0: -80, z1: -10, y0: -24, y1: 19, hulls: 52, decks: ['cale', 'bas', 'principal', 'haut'], accent: 0x4f6d7a },
]

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<DistrictId, DistrictDef>

export const DISTRICT_NEIGHBOURS: Record<DistrictId, readonly DistrictId[]> = {
  ecluse: ['nef', 'marche', 'serres', 'machines', 'hauts'],
  nef: ['ecluse', 'marche', 'serres', 'ateliers', 'scellees', 'machines', 'proue', 'hauts'],
  marche: ['ecluse', 'nef', 'ateliers', 'hauts'],
  serres: ['ecluse', 'nef', 'scellees', 'hauts'],
  machines: ['nef', 'ecluse', 'scellees', 'ateliers'],
  ateliers: ['marche', 'nef', 'proue', 'machines'],
  scellees: ['serres', 'nef', 'proue', 'machines'],
  hauts: ['nef', 'ecluse', 'marche', 'serres', 'proue'],
  proue: ['nef', 'ateliers', 'scellees', 'hauts'],
}

// The open atrium of La Nef: no hull may sit inside this box, at any height.
export const NEF_VOID = { x0: -28, x1: 28, z0: -30, z1: 30, y0: -10, y1: 30 } as const

export function inDistrict(d: DistrictDef, l: Vec3, margin = 0): boolean {
  return l.x >= d.x0 - margin && l.x <= d.x1 + margin && l.z >= d.z0 - margin && l.z <= d.z1 + margin
    && l.y >= d.y0 - margin && l.y <= d.y1 + margin
}

export function districtAt(l: Vec3): DistrictId {
  for (const d of DISTRICTS) if (inDistrict(d, l)) return d.id
  let best: DistrictDef = DISTRICTS[0]!
  let bd = Infinity
  for (const d of DISTRICTS) {
    const dx = Math.max(d.x0 - l.x, 0, l.x - d.x1)
    const dz = Math.max(d.z0 - l.z, 0, l.z - d.z1)
    const dy = Math.max(d.y0 - l.y, 0, l.y - d.y1)
    const dd = dx * dx + dy * dy + dz * dz
    if (dd < bd) {
      bd = dd
      best = d
    }
  }
  return best.id
}

export const TETHER = { length: 35, reelSpeed: 4, ringSpacing: 25 } as const

export interface PlaceDef {
  nom: string
  mode: GameMode
  district: DistrictId
  room: RoomId | null
  local: Vec3
  yaw: number
}

// Named teleport targets, Drift-local. `room` null + mode 'inside' = a cell drift builds outside the v1 quarter.
export const PLACES: Record<PlaceId, PlaceDef> = {
  cabine: { nom: 'Ta cabine', mode: 'inside', district: 'ecluse', room: 'cabine', local: quarterPoint({ x: -7, y: 0, z: 65.4 }), yaw: 0 },
  coursive: { nom: 'La coursive', mode: 'inside', district: 'ecluse', room: 'coursive-sud', local: quarterPoint({ x: -4, y: 0, z: 62 }), yaw: Math.PI / 2 },
  sas: { nom: "L'écluse", mode: 'inside', district: 'ecluse', room: 'sas', local: quarterPoint({ x: 0, y: 0, z: 66.4 }), yaw: Math.PI },
  refectoire: { nom: 'Le Réfectoire', mode: 'inside', district: 'ecluse', room: 'refectoire', local: quarterPoint({ x: 18, y: 0, z: 57.9 }), yaw: Math.PI },
  'grande-vitre': { nom: 'La Grande Vitre', mode: 'inside', district: 'ecluse', room: 'refectoire', local: quarterPoint({ x: 18.6, y: 0, z: 66.6 }), yaw: Math.PI },
  rebord: { nom: 'Le rebord', mode: 'inside', district: 'ecluse', room: 'rebord', local: quarterPoint({ x: 18, y: 0.6, z: 70.2 }), yaw: Math.PI },
  cuisine: { nom: 'La cuisine', mode: 'inside', district: 'ecluse', room: 'cuisine', local: quarterPoint({ x: 13.5, y: 0, z: 54.6 }), yaw: 0 },
  marche: { nom: 'Le petit marché', mode: 'inside', district: 'ecluse', room: 'marche', local: quarterPoint({ x: -31, y: 0, z: 62 }), yaw: -Math.PI / 2 },
  'salle-des-cartes': { nom: 'La Salle des Cartes', mode: 'inside', district: 'ecluse', room: 'salle-des-cartes', local: quarterPoint({ x: 40, y: 0, z: 64.4 }), yaw: 0 },
  'cabines-voisins': { nom: 'Les cabines voisines', mode: 'inside', district: 'ecluse', room: 'cabines-voisins', local: quarterPoint({ x: -6, y: 0, z: 59.6 }), yaw: 0 },
  'echelle-toit': { nom: "L'échelle du toit", mode: 'inside', district: 'ecluse', room: 'echelle-toit', local: quarterPoint({ x: -2.35, y: 3.05, z: 64.6 }), yaw: Math.PI / 2 },
  nef: { nom: 'La Grande Nef', mode: 'inside', district: 'nef', room: null, local: { x: 0, y: 8, z: 24 }, yaw: 0 },
  'nef-haut': { nom: 'La Grande Nef', mode: 'inside', district: 'nef', room: null, local: { x: -24, y: 16, z: 26 }, yaw: 0.75 },
  sortie: { nom: 'Dehors, au bout de la longe', mode: 'sortie', district: 'ecluse', room: null, local: quarterPoint({ x: 4, y: 1.5, z: 82 }), yaw: 0 },
}
