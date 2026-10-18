import type { RoomId } from '../../core/types'
import { PAL } from '../palette'

export type Side = 'n' | 's' | 'w' | 'e'
export type FloorKind = 'bois' | 'metal' | 'tapis' | 'none'

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

export const WALL_T = 0.2

const W = (p: Omit<PartDef, 'swayMul' | 'hull' | 'wainscot'> & Partial<Pick<PartDef, 'swayMul' | 'hull' | 'wainscot'>>): PartDef => ({
  swayMul: 1,
  hull: PAL.rouille,
  wainscot: PAL.bois,
  ...p,
})

export const PARTS: readonly PartDef[] = [
  W({ id: 'sas', room: 'sas', x0: -3, x1: 3, z0: 63.2, z1: 70, floorY: 0, wallH: 2.8, roof: 'flat', archH: 0, axis: 'z',
    floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.rouille,
    roofHole: { x0: -2.8, x1: -1.8, z0: 64.1, z1: 65.1 } }),
  W({ id: 'sas-chambre', room: 'sas', x0: -1.6, x1: 1.6, z0: 70, z1: 73.5, floorY: 0, wallH: 2.8, roof: 'flat', archH: 0, axis: 'z',
    floor: 'metal', wall: PAL.metal, wainscot: PAL.metalSombre, hull: PAL.rouille }),
  W({ id: 'echelle-toit', room: 'echelle-toit', x0: -3, x1: -1.6, z0: 63.9, z1: 65.3, floorY: 2.8, wallH: 3.2, roof: 'flat', archH: 0, axis: 'z',
    floor: 'none', wall: PAL.metal, wainscot: PAL.metalSombre, hull: PAL.rouille,
    roofHole: { x0: -2.8, x1: -1.8, z0: 64.1, z1: 65.1 } }),
  W({ id: 'coursive-sud', room: 'coursive-sud', x0: -14, x1: 10, z0: 60.8, z1: 63.2, floorY: 0, wallH: 2.3, roof: 'arch', archH: 1.1, axis: 'x',
    floor: 'bois', wall: PAL.creme, hull: PAL.teal }),
  W({ id: 'cabine', room: 'cabine', x0: -9, x1: -5, z0: 63.2, z1: 67.2, floorY: 0, wallH: 2.2, roof: 'arch', archH: 1.0, axis: 'z',
    floor: 'tapis', wall: PAL.vertDoux, hull: PAL.laiton }),
  W({ id: 'cabines-voisins', room: 'cabines-voisins', x0: -9, x1: -3, z0: 55, z1: 60.8, floorY: 0, wallH: 2.2, roof: 'arch', archH: 1.1, axis: 'x',
    floor: 'tapis', wall: PAL.platre, hull: PAL.teal }),
  W({ id: 'refectoire', room: 'refectoire', x0: 10, x1: 26, z0: 56, z1: 72, floorY: 0, wallH: 4.6, roof: 'arch', archH: 3.2, axis: 'x',
    floor: 'bois', wall: PAL.creme, hull: PAL.rouille }),
  W({ id: 'cuisine', room: 'cuisine', x0: 10, x1: 18, z0: 48, z1: 56, floorY: 0, wallH: 2.6, roof: 'arch', archH: 1.6, axis: 'x',
    floor: 'metal', wall: PAL.platre, hull: PAL.laiton }),
  W({ id: 'passerelle-1', room: 'passerelle-1', x0: -26, x1: -14, z0: 61, z1: 63, floorY: 0, wallH: 1.9, roof: 'arch', archH: 1.0, axis: 'x',
    floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 1.8 }),
  W({ id: 'marche', room: 'marche', x0: -40, x1: -26, z0: 54, z1: 70, floorY: 0, wallH: 3.4, roof: 'arch', archH: 3.0, axis: 'z',
    floor: 'bois', wall: PAL.creme, hull: PAL.laiton }),
  W({ id: 'passerelle-3', room: 'passerelle-3', x0: -26, x1: -9, z0: 56.5, z1: 58.5, floorY: 0, wallH: 1.9, roof: 'arch', archH: 1.0, axis: 'x',
    floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 1.8 }),
  W({ id: 'passerelle-2', room: 'passerelle-2', x0: 26, x1: 36, z0: 61, z1: 63, floorY: 0, wallH: 1.9, roof: 'arch', archH: 1.0, axis: 'x',
    floor: 'metal', wall: PAL.bleuDoux, wainscot: PAL.metal, hull: PAL.teal, swayMul: 1.8 }),
  W({ id: 'salle-des-cartes', room: 'salle-des-cartes', x0: 36, x1: 44, z0: 57, z1: 67, floorY: 0, wallH: 2.8, roof: 'arch', archH: 2.0, axis: 'z',
    floor: 'tapis', wall: PAL.vertDoux, hull: PAL.rouille }),
]

export const LINKS: readonly LinkDef[] = [
  { a: 'sas', b: 'sas-chambre', side: 's', at: 0, width: 1.0, height: 1.85, door: 'sas-interieure' },
  { a: 'sas-chambre', b: null, side: 's', at: 0, width: 1.0, height: 1.85, door: 'sas-exterieure' },
  { a: 'coursive-sud', b: 'sas', side: 's', at: 0, width: 1.3, height: 2.1 },
  { a: 'coursive-sud', b: 'refectoire', side: 'e', at: 62, width: 1.6, height: 2.15 },
  { a: 'coursive-sud', b: 'passerelle-1', side: 'w', at: 62, width: 1.4, height: 1.85 },
  { a: 'coursive-sud', b: 'cabine', side: 's', at: -7, width: 0.95, height: 1.85, door: 'porte-cabine' },
  { a: 'coursive-sud', b: 'cabines-voisins', side: 'n', at: -6, width: 0.95, height: 1.85, door: 'porte-voisins' },
  { a: 'refectoire', b: 'cuisine', side: 'n', at: 13, width: 1.6, height: 2.2 },
  { a: 'refectoire', b: 'passerelle-2', side: 'e', at: 62, width: 1.4, height: 1.85 },
  { a: 'passerelle-1', b: 'marche', side: 'w', at: 62, width: 1.0, height: 1.8, door: 'porte-marche' },
  { a: 'passerelle-3', b: 'marche', side: 'w', at: 57.5, width: 1.4, height: 1.85 },
  { a: 'passerelle-3', b: 'cabines-voisins', side: 'e', at: 57.5, width: 1.4, height: 1.85 },
  { a: 'passerelle-2', b: 'salle-des-cartes', side: 'e', at: 62, width: 1.0, height: 1.8, door: 'porte-cartes' },
]

export const PORTHOLES: readonly PortholeDef[] = [
  { part: 'sas', side: 'e', at: 68.4, y: 1.5 },
  { part: 'coursive-sud', side: 'n', at: 2, y: 1.45 },
  { part: 'coursive-sud', side: 'n', at: 6.5, y: 1.45 },
  { part: 'coursive-sud', side: 's', at: 6.5, y: 1.45 },
  { part: 'cabine', side: 's', at: -7, y: 1.35 },
  { part: 'cabine', side: 'w', at: 65.2, y: 1.35 },
  { part: 'cabines-voisins', side: 'n', at: -7.5, y: 1.35 },
  { part: 'cabines-voisins', side: 'n', at: -4.5, y: 1.35 },
  { part: 'refectoire', side: 'e', at: 58.5, y: 2.1 },
  { part: 'refectoire', side: 'e', at: 68.5, y: 2.1 },
  { part: 'refectoire', side: 'w', at: 67, y: 2.1 },
  { part: 'refectoire', side: 'w', at: 70, y: 2.1 },
  { part: 'cuisine', side: 'w', at: 52, y: 1.5 },
  { part: 'cuisine', side: 'n', at: 14, y: 1.5 },
  { part: 'passerelle-1', side: 'n', at: -23, y: 1.25 },
  { part: 'passerelle-1', side: 'n', at: -17, y: 1.25 },
  { part: 'passerelle-1', side: 's', at: -23, y: 1.25 },
  { part: 'passerelle-1', side: 's', at: -17, y: 1.25 },
  { part: 'marche', side: 's', at: -37, y: 1.8 },
  { part: 'marche', side: 's', at: -33, y: 1.8 },
  { part: 'marche', side: 's', at: -29, y: 1.8 },
  { part: 'marche', side: 'w', at: 58, y: 1.8 },
  { part: 'marche', side: 'w', at: 66, y: 1.8 },
  { part: 'passerelle-3', side: 'n', at: -20, y: 1.25 },
  { part: 'passerelle-3', side: 'n', at: -14, y: 1.25 },
  { part: 'passerelle-3', side: 's', at: -20, y: 1.25 },
  { part: 'passerelle-3', side: 's', at: -14, y: 1.25 },
  { part: 'passerelle-2', side: 'n', at: 31, y: 1.25 },
  { part: 'passerelle-2', side: 's', at: 31, y: 1.25 },
  { part: 'salle-des-cartes', side: 'e', at: 62, y: 1.5 },
  { part: 'salle-des-cartes', side: 'n', at: 40, y: 1.5 },
]

export const RECT_WINDOWS: readonly RectWindowDef[] = [
  { id: 'grande-vitre', part: 'refectoire', side: 's', at: 18, y0: 1.0, w: 10, h: 3.2 },
  { id: 'vitre-grand-pere', part: 'salle-des-cartes', side: 's', at: 40, y0: 0.9, w: 3, h: 2.0 },
]

export const PORTHOLE_D = 0.7

export const REBORD = { x0: 12.5, x1: 23.5, z0: 68.8, z1: 71.8, y0: 0.25, y1: 4.6, top: 0.6, stepZ: 69.4 }

export const ROOM_NEIGHBOURS: Record<RoomId, RoomId[]> = {
  sas: ['coursive-sud', 'echelle-toit'],
  'echelle-toit': ['sas'],
  'coursive-sud': ['sas', 'refectoire', 'passerelle-1', 'cabine', 'cabines-voisins'],
  cabine: ['coursive-sud'],
  'cabines-voisins': ['coursive-sud', 'passerelle-3'],
  refectoire: ['rebord', 'coursive-sud', 'cuisine', 'passerelle-2'],
  rebord: ['refectoire', 'cuisine'],
  cuisine: ['refectoire', 'rebord'],
  'passerelle-1': ['coursive-sud', 'marche'],
  marche: ['passerelle-1', 'passerelle-3'],
  'passerelle-3': ['marche', 'cabines-voisins'],
  'passerelle-2': ['refectoire', 'salle-des-cartes'],
  'salle-des-cartes': ['passerelle-2'],
}

export const LOCK_OUTSIDE = { x: 0, y: 1.1, z: 75.2 }

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
