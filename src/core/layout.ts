import type { RegionId, RoomId } from './types'

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
