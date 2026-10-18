import type { RoomId } from '../../core/types'
import { PAL } from '../palette'
import { FOOTPRINTS, GRANDE_VITRE, WALL_T, mapX, mapZ, quarterPoint } from '../../core/quarter'

export type Side = 'n' | 's' | 'w' | 'e'
export type FloorKind = 'bois' | 'metal' | 'tapis' | 'carrelage' | 'none'

export interface PartDef {
  id: string
  room: RoomId
  x0: number; x1: number; z0: number; z1: number
  floorY: number
  wallH: number
  roof: 'arch' | 'flat'
  archH: number
  axis: 'x' | 'z'
  floor: FloorKind
  wall: number
  wainscot: number
  hull: number
  swayMul: number
  roofHole?: { x0: number; x1: number; z0: number; z1: number }
}

export interface LinkDef {
  a: string
  b: string | null
  side: Side
  at: number
  width: number
  height: number
  door?: string
}

export interface PortholeDef { part: string; side: Side; at: number; y: number }
export interface RectWindowDef { id: string; part: string; side: Side; at: number; y0: number; w: number; h: number }

export { WALL_T }

type Style = Pick<PartDef, 'id' | 'room' | 'floor' | 'wall'> & Partial<Pick<PartDef, 'swayMul' | 'hull' | 'wainscot'>>

const W = (p: Style): PartDef => {
  const f = FOOTPRINTS[p.id]!
  return { swayMul: 1, hull: PAL.rouille, wainscot: 0x9a6b4d, ...f, ...p }
}

const SHAFT = FOOTPRINTS['echelle-toit']!
const ROOF_HOLE = { x0: SHAFT.x0 + 0.2, x1: SHAFT.x1 - 0.2, z0: SHAFT.z0 + 0.2, z1: SHAFT.z1 - 0.2 }

export const PARTS: readonly PartDef[] = [
  { ...W({ id: 'sas', room: 'sas', floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.rouille }), roofHole: ROOF_HOLE },
  W({ id: 'sas-chambre', room: 'sas', floor: 'metal', wall: PAL.metal, wainscot: PAL.metalSombre, hull: PAL.rouille }),
  { ...W({ id: 'echelle-toit', room: 'echelle-toit', floor: 'none', wall: PAL.metal, wainscot: PAL.metalSombre, hull: PAL.rouille }), roofHole: ROOF_HOLE },
  W({ id: 'coursive-sud', room: 'coursive-sud', floor: 'bois', wall: PAL.creme, hull: PAL.teal }),
  W({ id: 'cabine', room: 'cabine', floor: 'tapis', wall: 0xe2cdaa, hull: PAL.laiton }),
  W({ id: 'cabines-voisins', room: 'cabines-voisins', floor: 'tapis', wall: PAL.platre, hull: PAL.teal }),
  W({ id: 'refectoire', room: 'refectoire', floor: 'bois', wall: PAL.creme, hull: PAL.rouille }),
  W({ id: 'cuisine', room: 'cuisine', floor: 'carrelage', wall: PAL.platre, hull: PAL.laiton }),
  W({ id: 'passerelle-1', room: 'passerelle-1', floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 1.8 }),
  W({ id: 'marche', room: 'marche', floor: 'bois', wall: PAL.creme, hull: PAL.laiton }),
  W({ id: 'passerelle-3', room: 'passerelle-3', floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 1.8 }),
  W({ id: 'passerelle-2', room: 'passerelle-2', floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 1.8 }),
  W({ id: 'passerelle-nef', room: 'passerelle-nef' as RoomId, floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 0 }),
  W({ id: 'salle-des-cartes', room: 'salle-des-cartes', floor: 'tapis', wall: PAL.platre, hull: PAL.rouille }),
]

const DOOR = { width: 1.9, height: 2.4 }
export const BALCONY = { at: -10.25, width: 4.2 }
const LOCK_DOOR = { width: 2.2, height: 2.5 }
const LANE = (width: number, height: number) => ({ width, height })
const MID = mapZ('coursive-sud', 62)
const P3 = (FOOTPRINTS['passerelle-3']!.z0 + FOOTPRINTS['passerelle-3']!.z1) / 2

export const LINKS: readonly LinkDef[] = [
  { a: 'sas', b: 'sas-chambre', side: 's', at: 0, ...LOCK_DOOR, door: 'sas-interieure' },
  { a: 'sas-chambre', b: null, side: 's', at: 0, ...LOCK_DOOR, door: 'sas-exterieure' },
  { a: 'coursive-sud', b: 'sas', side: 's', at: 0, ...LANE(5.0, 3.4) },
  { a: 'coursive-sud', b: 'refectoire', side: 'e', at: MID, ...LANE(3.2, 3.4) },
  { a: 'coursive-sud', b: 'passerelle-1', side: 'w', at: MID, ...LANE(2.6, 2.6) },
  { a: 'cabine', b: 'coursive-sud', side: 'n', at: mapX('cabine', -7), ...DOOR, door: 'porte-cabine' },
  { a: 'cabines-voisins', b: 'coursive-sud', side: 's', at: mapX('cabines-voisins', -6), ...DOOR, door: 'porte-voisins' },
  { a: 'refectoire', b: 'cuisine', side: 'n', at: 31.2, ...LANE(2.6, 3.0) },
  { a: 'refectoire', b: 'passerelle-2', side: 'e', at: MID, ...LANE(2.6, 2.6) },
  { a: 'marche', b: 'passerelle-1', side: 'e', at: MID, ...DOOR, door: 'porte-marche' },
  { a: 'passerelle-3', b: 'marche', side: 'w', at: P3, ...LANE(2.6, 2.6) },
  { a: 'passerelle-3', b: 'cabines-voisins', side: 'e', at: P3, ...LANE(2.6, 2.6) },
  { a: 'salle-des-cartes', b: 'passerelle-2', side: 'w', at: MID, ...DOOR, door: 'porte-cartes' },
  { a: 'coursive-sud', b: 'passerelle-nef', side: 'n', at: -8.9, ...LANE(7.0, 4.0) },
  { a: 'cabines-voisins', b: 'passerelle-nef', side: 'e', at: 51.5, ...LANE(2.6, 2.6) },
  { a: 'passerelle-nef', b: null, side: 'n', at: -6.6, ...DOOR, door: 'porte-nef' },
  { a: 'passerelle-nef', b: null, side: 'n', at: BALCONY.at, width: BALCONY.width, height: 4.2 },
  { a: 'passerelle-nef', b: null, side: 'e', at: 44.5, ...DOOR },
  { a: 'marche', b: null, side: 'w', at: 60.75, ...DOOR, door: 'porte-grand-marche' },
]

const LEGACY_PORTHOLES: readonly PortholeDef[] = [
  { part: 'sas', side: 'e', at: 68.4, y: 1.5 },
  { part: 'coursive-sud', side: 'n', at: 2, y: 1.45 },
  { part: 'coursive-sud', side: 'n', at: 6.5, y: 1.45 },
  { part: 'coursive-sud', side: 's', at: 6.5, y: 1.45 },
  { part: 'cabine', side: 's', at: -7, y: 1.35 },
  { part: 'cabine', side: 'w', at: 65.2, y: 1.35 },
  { part: 'cabines-voisins', side: 'n', at: -8.4, y: 1.35 },
  { part: 'cabines-voisins', side: 'n', at: -7.0, y: 1.35 },
  { part: 'refectoire', side: 'e', at: 58.5, y: 2.1 },
  { part: 'refectoire', side: 'e', at: 68.5, y: 2.1 },
  { part: 'refectoire', side: 'w', at: 67, y: 2.1 },
  { part: 'refectoire', side: 'w', at: 70, y: 2.1 },
  { part: 'cuisine', side: 'w', at: 52, y: 1.5 },
  { part: 'cuisine', side: 'n', at: 14, y: 1.5 },
  { part: 'passerelle-1', side: 'n', at: -23, y: 1.25 },
  { part: 'passerelle-1', side: 's', at: -23, y: 1.25 },
  { part: 'marche', side: 's', at: -37, y: 1.8 },
  { part: 'marche', side: 's', at: -33, y: 1.8 },
  { part: 'marche', side: 's', at: -29, y: 1.8 },
  { part: 'marche', side: 'w', at: 58, y: 1.8 },
  { part: 'marche', side: 'w', at: 66, y: 1.8 },
  { part: 'passerelle-3', side: 'n', at: -20, y: 1.25 },
  { part: 'passerelle-3', side: 's', at: -20, y: 1.25 },
  { part: 'passerelle-2', side: 'n', at: 31, y: 1.25 },
  { part: 'passerelle-2', side: 's', at: 31, y: 1.25 },
  { part: 'salle-des-cartes', side: 'e', at: 62, y: 1.5 },
  { part: 'passerelle-nef', side: 'e', at: 52, y: 1.25 },
  { part: 'salle-des-cartes', side: 'n', at: 40, y: 1.5 },
]

const alongWall = (part: string, side: Side, at: number) => (side === 'n' || side === 's' ? mapX(part, at) : mapZ(part, at))

export const PORTHOLES: readonly PortholeDef[] = LEGACY_PORTHOLES.map((h) => ({ ...h, at: alongWall(h.part, h.side, h.at) }))

const WINDOW_GROWTH = 1.4

export const RECT_WINDOWS: readonly RectWindowDef[] = [
  { id: 'grande-vitre', part: 'refectoire', side: 's', ...GRANDE_VITRE },
  { id: 'verriere-galerie', part: 'passerelle-nef', side: 'w', at: 42.6, y0: 0.9, w: 10, h: 3.0 },
  { id: 'vitre-grand-pere', part: 'salle-des-cartes', side: 's', at: mapX('salle-des-cartes', 40), y0: 0.8, w: 3 * WINDOW_GROWTH, h: 2.0 * WINDOW_GROWTH },
]

export const PORTHOLE_D = 0.7

const REF = FOOTPRINTS.refectoire!
export const REBORD = {
  x0: mapX('refectoire', 12.5), x1: mapX('refectoire', 23.5), z0: mapZ('refectoire', 68.8), z1: REF.z1 - 0.2,
  y0: 0.25, y1: REF.wallH, top: 0.6, stepZ: mapZ('refectoire', 69.4),
}

export const ROOM_NEIGHBOURS: Record<RoomId, RoomId[]> = {
  sas: ['coursive-sud', 'echelle-toit'],
  'echelle-toit': ['sas'],
  'coursive-sud': ['sas', 'refectoire', 'passerelle-1', 'cabine', 'cabines-voisins', 'passerelle-nef' as RoomId],
  cabine: ['coursive-sud', 'passerelle-nef' as RoomId],
  'cabines-voisins': ['coursive-sud', 'passerelle-3', 'passerelle-nef' as RoomId],
  refectoire: ['rebord', 'coursive-sud', 'cuisine', 'passerelle-2'],
  rebord: ['refectoire', 'cuisine'],
  cuisine: ['refectoire', 'rebord'],
  'passerelle-1': ['coursive-sud', 'marche'],
  marche: ['passerelle-1', 'passerelle-3'],
  'passerelle-3': ['marche', 'cabines-voisins'],
  'passerelle-2': ['refectoire', 'salle-des-cartes'],
  'salle-des-cartes': ['passerelle-2'],
  ...({ 'passerelle-nef': ['cabines-voisins', 'coursive-sud', 'cabine'] } as Record<string, RoomId[]>),
}

export const LOCK_OUTSIDE = quarterPoint({ x: 0, y: 1.1, z: 75.2 })

export function partById(id: string): PartDef {
  const p = PARTS.find((q) => q.id === id)
  if (!p) throw new Error(`unknown part ${id}`)
  return p
}

export function partCenter(p: PartDef): { x: number; y: number; z: number } {
  return { x: (p.x0 + p.x1) / 2, y: p.floorY, z: (p.z0 + p.z1) / 2 }
}

export function partTop(p: PartDef): number {
  return p.floorY + p.wallH + (p.roof === 'arch' ? p.archH : 0) + WALL_T
}
