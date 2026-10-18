import * as THREE from 'three'
import type { DistrictId } from '../../core/types'
import type { HullDef } from '../hulls'
import { PAL } from '../palette'
import { softColor } from '../figure'
import { SURF } from '../surface'
import { NOMS, PANNEAUX } from '../text'
import { buildHall, GALLERY_D, type HallDef } from './hall'
import { C, Kit } from './kit'
import { booth, dome, engine, gangway, glassTube, mast, shrine, tower, zipline } from './parts'
import { ringFloor, ringRail, ringWall } from './rings'

export interface CityBuild {
  kits: Map<DistrictId, Kit>
  links: Kit
  hulls: (HullDef & { inside: boolean })[]
  halls: HallDef[]
  reserved: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[]
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const ALL: DistrictId[] = ['ecluse', 'nef', 'machines', 'marche', 'serres', 'ateliers', 'scellees', 'proue', 'hauts']
const SEEDS: Record<DistrictId, number> = { ecluse: 11, nef: 23, machines: 37, marche: 41, serres: 53, ateliers: 67, scellees: 71, proue: 83, hauts: 97 }

export const NEF: HallDef = {
  id: 'nef', nom: NOMS.nef, district: 'nef', deck: 'principal',
  x0: -36, x1: 36, z0: -36, z1: 36, floorY: -6, floor: 'pierre',
  levels: [0, 8, 16],
  tiers: { n: [-6, 0, 8, 16], s: [-6, 0, 8, 16], w: [-6, 0, 8, 16], e: [-6, 0, 8, 16] },
  spring: 24, rise: 8, axis: 'z',
  openings: [
    { side: 's', u: -6, y: 0, w: 3.2, h: 3.0 },
    { side: 's', u: 0, y: 16, w: 13, h: 7.6 },
    { side: 's', u: 20, y: -6, w: 3.2, h: 3.0 },
    { side: 'n', u: -20, y: -6, w: 3.2, h: 3.0 },
    { side: 'w', u: 20, y: 0, w: 3.2, h: 3.2 },
    { side: 'e', u: 20, y: 0, w: 3.2, h: 3.2 },
    { side: 'w', u: -28, y: 0, w: 3.2, h: 3.2 },
    { side: 'e', u: -28, y: 0, w: 3.2, h: 3.2 },
    { side: 'n', u: 0, y: 8, w: 3.2, h: 3.2 },
  ],
  railGaps: [
    { side: 'w', y: 0, u0: -1.6, u1: 1.6 }, { side: 'e', y: 0, u0: -1.6, u1: 1.6 },
    { side: 'n', y: 8, u0: -1.6, u1: 1.6 }, { side: 's', y: 8, u0: -1.6, u1: 1.6 },
    { side: 'w', y: 16, u0: -1.6, u1: 1.6 }, { side: 'e', y: 16, u0: -1.6, u1: 1.6 },
    { side: 's', y: 0, u0: -15, u1: -11 }, { side: 's', y: 0, u0: 11, u1: 15 },
    { side: 'w', y: 0, u0: 8.4, u1: 10.8 }, { side: 'w', y: 8, u0: -5.2, u1: -2.8 },
    { side: 'e', y: 8, u0: 5.6, u1: 8 }, { side: 'e', y: 16, u0: 19.2, u1: 21.6 },
    { side: 'e', y: 8, u0: -13.8, u1: -10 },
    { side: 'n', y: 8, u0: 8, u1: 13 }, { side: 'n', y: 16, u0: 8, u1: 13 }, { side: 'n', y: 8, u0: 22.9, u1: 25.1 },
    { side: 's', y: 0, u0: 16, u1: 21 }, { side: 's', y: 8, u0: 16, u1: 21 },
    { side: 'w', y: 16, u0: 22, u1: 29.3 }, { side: 's', y: 16, u0: -29.3, u1: -20 },
    { side: 'w', y: 8, u0: 14, u1: 17 }, { side: 'w', y: 16, u0: 14, u1: 17 },
    { side: 'n', y: 0, u0: -10.6, u1: -9.4 }, { side: 'n', y: 0, u0: 21.4, u1: 22.6 }, { side: 'w', y: 0, u0: 25.4, u1: 26.6 },
  ],
  noGallery: [{ side: 's', y: 16, u0: -8, u1: 8 }],
  noHull: [{ side: 's', y: 16, u0: -9, u1: 9 }],
  paints: [0x9a6a48, PAL.teal, 0xb08440, 0x7a8a84, 0x5a7a8a, 0xa8503e],
  wall: 0xa48a70,
  floorHole: { x: 0, z: 0, r: 11 },
  air: 1,
  pvs: ['nef', 'machines', 'ecluse', 'hauts'],
  spawn: { x: 0, y: 8, z: 24, yaw: 0 },
}

export const MARCHE: HallDef = {
  id: 'grand-marche', nom: NOMS.marche, district: 'marche', deck: 'principal',
  x0: -104, x1: -72, z0: -6, z1: 72, floorY: 0, floor: 'pierre',
  levels: [6.5, 13],
  tiers: { w: [0, 6.5, 13], e: [0, 6.5, 13] },
  spring: 19.5, rise: 6.5, axis: 'z',
  openings: [
    { side: 'e', u: 20, y: 0, w: 3.2, h: 3.2 },
    { side: 'e', u: 60.75, y: 0, w: 3.2, h: 3.2 },
    { side: 'n', u: -88, y: 0, w: 3.2, h: 3.2 },
    { side: 'w', u: 20, y: 0, w: 3.2, h: 3.0 },
  ],
  railGaps: [
    { side: 'w', y: 6.5, u0: 8.5, u1: 11.5 }, { side: 'e', y: 6.5, u0: 8.5, u1: 11.5 },
    { side: 'w', y: 6.5, u0: 56.5, u1: 59.5 }, { side: 'e', y: 6.5, u0: 56.5, u1: 59.5 },
    { side: 'w', y: 13, u0: 42.5, u1: 45.5 }, { side: 'e', y: 13, u0: 42.5, u1: 45.5 },
    { side: 'w', y: 6.5, u0: 18.5, u1: 20.9 },
    { side: 'e', y: 6.5, u0: 37.6, u1: 40 }, { side: 'e', y: 13, u0: 49.1, u1: 51.5 },
    { side: 'e', y: 6.5, u0: 66.2, u1: 68.6 },
    { side: 'w', y: 6.5, u0: 26.2, u1: 28.6 }, { side: 'w', y: 13, u0: 15.1, u1: 17.5 }, { side: 'w', y: 13, u0: 30.6, u1: 32.6 },
  ],
  noGallery: [], noHull: [],
  paints: [0xb0503e, 0x9a6a48, 0xb08440, 0x8a7a68, 0x5a6f8a, 0x7a8a5a],
  wall: 0xb08e70,
  air: 0.9,
  pvs: ['marche', 'hauts'],
  spawn: { x: -88, y: 0, z: 30, yaw: 0 },
}

export const SERRES: HallDef = {
  id: 'serre-cathedrale', nom: NOMS.serres, district: 'serres', deck: 'principal',
  x0: 72, x1: 108, z0: -6, z1: 72, floorY: 0, floor: 'bois',
  levels: [7],
  tiers: { w: [0, 7], e: [0, 7] },
  spring: 14, rise: 12, axis: 'z',
  openings: [
    { side: 'w', u: 20, y: 0, w: 3.2, h: 3.2 },
    { side: 'n', u: 90, y: 0, w: 3.2, h: 3.2 },
    { side: 'e', u: 10, y: 0, w: 3.2, h: 3.0 },
    { side: 'e', u: 50, y: 0, w: 3.2, h: 3.0 },
  ],
  railGaps: [
    { side: 'w', y: 7, u0: 42.5, u1: 45.5 }, { side: 'e', y: 7, u0: 42.5, u1: 45.5 },
    { side: 'w', y: 7, u0: 17.8, u1: 20.2 }, { side: 'e', y: 7, u0: 59.8, u1: 62.2 },
    { side: 'w', y: 7, u0: 8.5, u1: 11.5 }, { side: 'e', y: 7, u0: 8.5, u1: 11.5 },
  ],
  noGallery: [], noHull: [],
  paints: [0x5f7d4a, 0x8a8a6a, 0x9a7a4a, 0x7a9a5a, PAL.teal],
  wall: 0xa49e7c,
  air: 0.8,
  pvs: ['serres', 'hauts'],
  spawn: { x: 90, y: 0, z: 30, yaw: 0 },
}

export const ATELIERS: HallDef = {
  id: 'ateliers', nom: NOMS.ateliers, district: 'ateliers', deck: 'principal',
  x0: -124, x1: -52, z0: -46, z1: -18, floorY: 0, floor: 'bois',
  levels: [6.5],
  tiers: { n: [0, 6.5], s: [0, 6.5] },
  spring: 13, rise: 6, axis: 'x',
  openings: [
    { side: 's', u: -88, y: 0, w: 3.2, h: 3.2 },
    { side: 'e', u: -28, y: 0, w: 3.2, h: 3.2 },
    { side: 'n', u: -100, y: 0, w: 3.2, h: 3.0 },
    { side: 'n', u: -70, y: 0, w: 3.2, h: 3.0 },
  ],
  railGaps: [
    { side: 'n', y: 6.5, u0: -106.5, u1: -103.5 }, { side: 's', y: 6.5, u0: -106.5, u1: -103.5 },
    { side: 'n', y: 6.5, u0: -71.5, u1: -68.5 }, { side: 's', y: 6.5, u0: -71.5, u1: -68.5 },
    { side: 's', y: 6.5, u0: -90.9, u1: -88.5 }, { side: 'n', y: 6.5, u0: -81.5, u1: -79.1 },
    { side: 'n', y: 6.5, u0: -113.5, u1: -110.5 },
  ],
  noGallery: [], noHull: [],
  paints: [0x4f6a88, PAL.teal, 0x9a7a52, 0x7a8288, 0x5a7a8a],
  wall: 0x98948a,
  air: 0.85,
  pvs: ['ateliers'],
  spawn: { x: -80, y: 0, z: -32, yaw: Math.PI / 2 },
}

export const SCELLEES: HallDef = {
  id: 'coques-scellees', nom: NOMS.scellees, district: 'scellees', deck: 'principal',
  x0: 52, x1: 124, z0: -46, z1: -18, floorY: 0, floor: 'metal',
  levels: [6.5],
  tiers: { n: [0, 6.5], s: [0, 6.5] },
  spring: 13, rise: 6, axis: 'x',
  openings: [
    { side: 's', u: 90, y: 0, w: 3.2, h: 3.2 },
    { side: 'w', u: -28, y: 0, w: 3.2, h: 3.2 },
    { side: 'n', u: 66, y: 0, w: 3.2, h: 3.0 },
    { side: 'n', u: 88, y: 0, w: 3.2, h: 3.0 },
    { side: 'n', u: 110, y: 0, w: 3.2, h: 3.0 },
  ],
  railGaps: [
    { side: 'n', y: 6.5, u0: 73.5, u1: 76.5 }, { side: 's', y: 6.5, u0: 73.5, u1: 76.5 },
    { side: 'n', y: 6.5, u0: 98.5, u1: 101.5 }, { side: 's', y: 6.5, u0: 98.5, u1: 101.5 },
    { side: 's', y: 6.5, u0: 79.1, u1: 81.5 }, { side: 'n', y: 6.5, u0: 110.5, u1: 113.5 },
  ],
  noGallery: [], noHull: [],
  paints: [PAL.teal, 0x52576a, PAL.bleuDoux, 0x6f8f4e, PAL.metal],
  wall: 0x7d8a8e,
  air: 0.7,
  pvs: ['scellees'],
  spawn: { x: 80, y: 0, z: -32, yaw: -Math.PI / 2 },
}

const HALLS = [NEF, MARCHE, SERRES, ATELIERS, SCELLEES]

export function buildCity(): CityBuild {
  const kits = new Map<DistrictId, Kit>()
  for (const d of ALL) kits.set(d, new Kit(d, SEEDS[d]))
  const K = (d: DistrictId) => kits.get(d)!
  const hulls: (HullDef & { inside: boolean })[] = []
  for (const h of HALLS) hulls.push(...buildHall(K(h.district), h).hulls)

  nef(K('nef'))
  puits(K('machines'))
  marche(K('marche'))
  serres(K('serres'))
  ateliers(K('ateliers'))
  scellees(K('scellees'))
  proue(K('proue'))
  ecluse(K('ecluse'))
  hauts(K('hauts'))
  const links = new Kit('nef', 101)
  gangways(kits, links)
  trouvailles(kits)

  const reserved = [
    ...HALLS.map((h) => ({ x0: h.x0 - 4, x1: h.x1 + 4, y0: h.floorY - 3, y1: h.spring + h.rise + 2, z0: h.z0 - 4, z1: h.z1 + 4 })),
    { x0: -14, x1: 14, y0: -27, y1: -5, z0: -14, z1: 14 },
    { x0: -48, x1: 52, y0: -1.5, y1: 9.5, z0: 42, z1: 84 },
    { x0: -12, x1: 12, y0: 4, y1: 34, z0: -76, z1: -36 },
    { x0: -8, x1: 8, y0: -1, y1: 26, z0: 30, z1: 56 },
    { x0: -92, x1: 94, y0: 24, y1: 30, z0: 40, z1: 48 },
    { x0: -74, x1: -38, y0: -1, y1: 4, z0: 58, z1: 66 },
    { x0: -74, x1: -34, y0: -1, y1: 4, z0: 16, z1: 24 },
    { x0: 34, x1: 74, y0: -1, y1: 4, z0: 16, z1: 24 },
    { x0: -54, x1: -34, y0: -1, y1: 4, z0: -32, z1: -24 },
    { x0: 34, x1: 54, y0: -1, y1: 4, z0: -32, z1: -24 },
    { x0: -92, x1: -84, y0: -1, y1: 4, z0: -20, z1: -4 },
    { x0: 86, x1: 94, y0: -1, y1: 4, z0: -20, z1: -4 },
    { x0: 10, x1: 32, y0: -8, y1: 1, z0: 38, z1: 56 },
    { x0: -32, x1: -8, y0: -8, y1: 1, z0: -56, z1: -36 },
    { x0: -118, x1: -102, y0: -2, y1: 8, z0: 12, z1: 28 },
    { x0: 106, x1: 126, y0: -2, y1: 8, z0: 2, z1: 58 },
    { x0: -110, x1: -60, y0: -2, y1: 8, z0: -64, z1: -46 },
    { x0: 56, x1: 120, y0: -2, y1: 8, z0: -64, z1: -46 },
    { x0: 10, x1: 30, y0: -24, y1: -14, z0: -8, z1: 8 },
    { x0: -30, x1: -10, y0: -24, y1: -14, z0: -8, z1: 8 },
  ]
  return { kits, links, hulls, halls: HALLS, reserved }
}

function nef(k: Kit): void {
  const ring = (y: number, holes: { x: number; z: number; r: number }[]) => ringFloor(k, 0, 0, y, 2.5, 5.6, 'bois', holes)
  ring(0, [])
  ring(8, [{ x: 2.9, z: 0, r: 0.7 }])
  ring(16, [{ x: -2.9, z: 0, r: 0.7 }])
  ringFloor(k, 0, 0, 27, 2.5, 3.8, 'grille', [{ x: 0, z: -2.95, r: 0.7 }])
  for (const y of [0, 8, 16]) {
    const gaps: [number, number][] = y === 8 ? [[Math.PI / 2 - 0.3, Math.PI / 2 + 0.3], [-Math.PI / 2 - 0.3, -Math.PI / 2 + 0.3]] : [[-0.3, 0.3], [Math.PI - 0.3, Math.PI + 0.3]]
    ringRail(k, 0, 0, y, 5.5, gaps, 28)
  }
  ringRail(k, 0, 0, 27, 3.7, [[Math.PI / 2 - 0.25, Math.PI / 2 + 0.25]], 20)
  mast(k, 0, 0, -22, 33, 2.4, [-14, -2, 6, 14, 22, 29])
  k.ladder('mat-0-8', 2.9, 0, 0, 8.1, 1, 0, ['nef'])
  k.ladder('mat-8-16', -2.9, 0, 8, 16.1, -1, 0, ['nef'])
  k.ladder('mat-16-27', 0, -2.95, 16, 27.1, 0, -1, ['nef'])
  k.ladder('mat-27-dome', 0, 2.95, 27, 32.3, 0, 1, ['nef', 'dome-nef'])
  dome(k, 'dome-nef', 'nef', 0, 32.2, 0, 4.4, { nom: NOMS.domeNef, pvs: ['nef', 'hauts', 'marche', 'serres', 'proue', 'ecluse'], deck: 'domes', hole: { x: 0, z: 2.95 } })

  const bw = 1.6
  k.slab(-29.25, -5.4, -bw, bw, 0, 'bois')
  k.slab(5.4, 29.25, -bw, bw, 0, 'bois')
  k.slab(-bw, bw, -29.25, -5.4, 8, 'bois')
  k.slab(-bw, bw, 5.4, 29.25, 8, 'bois')
  k.slab(-29.25, -5.4, -bw, bw, 16, 'bois')
  k.slab(5.4, 29.25, -bw, bw, 16, 'bois')
  for (const y of [0, 16]) {
    for (const [a, b] of [[-29.25, -5.6], [5.6, 29.25]] as const) {
      k.rail(a, -bw, b, -bw, y)
      k.rail(a, bw, b, bw, y)
      for (let x = a + 1; x < b; x += 2) k.beam(x, y - 0.4, -bw, x, y - 0.4, bw, 0.18, C(PAL.boisOmbre, 1.2))
    }
  }
  for (const [a, b] of [[-29.25, -5.6], [5.6, 29.25]] as const) {
    k.rail(-bw, a, -bw, b, 8)
    k.rail(bw, a, bw, b, 8)
    for (let z = a + 1; z < b; z += 2) k.beam(-bw, 7.6, z, bw, 7.6, z, 0.18, C(PAL.boisOmbre, 1.2))
  }
  for (const x of [-18, 18]) {
    k.beam(x, -6, -bw - 0.4, x, -0.3, -bw - 0.4, 0.3, C(PAL.laiton, 0.8))
    k.beam(x, -6, bw + 0.4, x, -0.3, bw + 0.4, 0.3, C(PAL.laiton, 0.8))
  }

  k.stairs(-15, -11, 20.85, 29.25, -6, 0, '+z')
  k.stairs(11, 15, 20.85, 29.25, -6, 0, '+z')
  k.slab(-29.25, -26.85, 8.4, 10.8, 0, 'bois')
  k.stairs(-29.25, -26.85, -2.8, 8.4, 0, 8, '-z')
  k.slab(-29.25, -26.85, -5.2, -2.8, 8, 'bois')
  k.rail(-26.85, -5.2, -26.85, -2.8, 8)
  k.rail(-29.25, -5.2, -26.85, -5.2, 8)
  k.rail(-26.85, 8.4, -26.85, 10.8, 0)
  k.rail(-29.25, 10.8, -26.85, 10.8, 0)
  k.slab(26.85, 29.25, 5.6, 8, 8, 'bois')
  k.stairs(26.85, 29.25, 8, 19.2, 8, 16, '+z')
  k.slab(26.85, 29.25, 19.2, 21.6, 16, 'bois')
  k.rail(26.85, 5.6, 26.85, 8, 8)
  k.rail(26.85, 5.6, 29.25, 5.6, 8)
  k.rail(26.85, 19.2, 26.85, 21.6, 16)
  k.rail(26.85, 21.6, 29.25, 21.6, 16)

  ringRail(k, 0, 0, -6, 11.5, [[Math.PI / 2 - 0.12, Math.PI / 2 + 0.12], [-Math.PI / 2 - 0.12, -Math.PI / 2 + 0.12]], 40)
  k.ladder('puits-nord', 0, -11.3, -14, -5.9, 0, 1, ['nef', 'puits'])
  k.ladder('puits-sud', 0, 11.3, -14, -5.9, 0, -1, ['nef', 'puits'])
  k.ladder('nef-mur-nord', -10, -29.0, -6, 0.1, 0, 1, ['nef'])
  k.ladder('nef-mur-nord-2', 22, -29.0, -6, 0.1, 0, 1, ['nef'])
  k.netV(8, -29.1, 13, -29.1, 8.1, 16, 'filet-nef-nord')
  k.netV(16, 29.1, 21, 29.1, 0.1, 8, 'filet-nef-sud')
  k.netV(-29.1, 14, -29.1, 17, 8.2, 16, 'filet-nef-ouest')
  k.slab(-29.25, -20, 22, 29.25, 16, 'bois')
  k.rail(-20, 22, -20, 24.3, 16)
  k.rail(-20, 25.7, -20, 29.25, 16)
  k.rail(-29.25, 22, -20, 22, 16)
  for (let x = -28.5; x < -20; x += 2) k.beam(x, 15.55, 22, x, 15.55, 29.25, 0.2, C(PAL.boisOmbre, 1.2))
  k.beam(-20.3, 8, 22.3, -20.3, 15.6, 22.3, 0.22, C(PAL.laiton, 0.8))
  k.plant(-28.4, 16, 22.8, 1.2)
  k.bench('banc-belvedere', -26, 16, 22.6, 2.6, true, Math.PI)
  k.ladder('nef-mur-ouest', -29.0, 26, -6, 0.1, 1, 0, ['nef'])

  zipline(k, 'tyrolienne-nef-ouest', V(-19.7, 18.2, 25), V(8, -4.1, 18))
  k.toboggan('toboggan-nef', [V(24, 8.05, -31.2), V(24, 7.75, -29), V(24, -2.6, -17.2), V(24, -5.55, -13.6), V(24, -5.95, -12.3)])
  k.hammock('couchette-nef-belvedere', -28.3, 24.2, -28.3, 28.6, 16, PAL.tissu2)

  const benches: [number, number, number][] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    benches.push([Math.cos(a) * 13.2, Math.sin(a) * 13.2, a])
  }
  benches.forEach(([x, z, a], i) => {
    const alongX = Math.abs(Math.sin(a)) > 0.7
    k.bench(`banc-nef-${i + 1}`, x, -6, z, 2.4, alongX, Math.atan2(Math.cos(a), -Math.sin(a)) + Math.PI)
  })
  for (const [x, z] of [[-20, 12], [20, 12], [-20, -12], [20, -12], [-26, 0], [26, 0]] as const) {
    k.b.cyl(x, -3.4, z, 0.1, 5.2, C(PAL.metalSombre))
    k.b.cyl(x, -6 + 0.2, z, 0.3, 0.4, C(PAL.metalSombre))
    k.lamp(x, -0.6, z, { style: 'globe', radius: 12, bake: 1.2 })
  }
  for (const [x, z] of [[-24, 18], [24, 18], [-24, -14], [16, -18]] as const) {
    k.table(x, -6, z, 1.4, 1.4)
    k.bench(null, x - 1.1, -6, z, 1.4, false, Math.PI / 2)
    k.bench(null, x + 1.1, -6, z, 1.4, false, -Math.PI / 2)
    k.plant(x + 1.6, -6, z + 1.4, 1.1)
  }
  k.crates(-30, -6, -26, 3)
  k.crates(-28.5, -6, -27.5, 2)
  k.barrel(30, -6, -27)
  k.barrel(29, -6, -25.6)
  k.crates(30, -6, 26, 2)
  for (let i = 0; i < 5; i++) k.sack(-31 + i * 0.7, -6, 27 + (i % 2) * 0.5)

  const hub = [
    { st: 'marche', label: PANNEAUX.versMarche, to: { x: -93, y: 0, z: -1.2, yaw: Math.PI } },
    { st: 'serres', label: PANNEAUX.versSerres, to: { x: 86, y: 0, z: -1.2, yaw: Math.PI } },
    { st: 'ateliers', label: PANNEAUX.versAteliers, to: { x: -57.7, y: 0, z: -24.2, yaw: -Math.PI / 2 } },
    { st: 'scellees', label: PANNEAUX.versScellees, to: { x: 57.7, y: 0, z: -24.2, yaw: Math.PI / 2 } },
    { st: 'proue', label: PANNEAUX.versProue, to: { x: 4.9, y: 8, z: -55, yaw: -Math.PI / 2 } },
  ]
  hub.forEach((h, i) => booth(k, 'nef', h.st, h.label, -12 + i * 6, -6, -24.5, Math.PI, h.to, { act: 2 }))
  k.sign(NOMS.nef, 0, -1.2, -28.8, Math.PI, 5.2, 0.9, PANNEAUX.tubes)

  for (const [a, b, s] of [
    [V(-29, 22.5, -22), V(29, 22, 14), 1.6], [V(-29, 21.5, 18), V(29, 22.5, -10), 1.6],
    [V(-22, 14.5, -29), V(18, 14.5, 29), 1.4], [V(-29, 6.5, 6), V(-6, 5.5, 29), 0.8], [V(29, 6.2, -6), V(10, 6.5, -29), 0.8],
  ] as const) k.bulbString(a, b, s)
  for (const [a, b] of [[V(-29, 12, -24), V(-20, 12.2, -29)], [V(29, 4, 24), V(24, 4, 29)], [V(-29, 20, -10), V(-29, 20, 4)]] as const) k.laundry(a, b, 0.5)
  for (const [x, z] of [[-14, -14], [12, 10], [-8, 16], [16, -6]] as const) k.shafts.push({ x, z, top: 30, bottom: -6, r: 2.6 + (Math.abs(x) % 3) * 0.4, tint: 0x9fd6d0 })

  k.paths.push({ district: 'nef', pts: [{ x: -26, z: -26 }, { x: 26, z: -26 }, { x: 26, z: 26 }, { x: -26, z: 26 }], y: -6, loop: true, busy: 1, work: false })
  k.paths.push({ district: 'nef', pts: [{ x: -18, z: 0 }, { x: 0, z: -16 }, { x: 18, z: 0 }, { x: 0, z: 16 }], y: -6, loop: true, busy: 1, work: false })
  for (const y of [0, 8, 16]) {
    const e = 36 - (GALLERY_D - 1.7)
    k.paths.push({ district: 'nef', pts: [{ x: -e, z: -e }, { x: e, z: -e }, { x: e, z: e }, { x: -e, z: e }], y, loop: true, busy: y === 0 ? 0.8 : 0.5, work: false })
  }
  k.paths.push({ district: 'nef', pts: [{ x: -28, z: 0 }, { x: -6, z: 0 }], y: 0, loop: false, busy: 0.4, work: false })
  k.paths.push({ district: 'nef', pts: [{ x: 0, z: 28 }, { x: 0, z: 6 }], y: 8, loop: false, busy: 0.4, work: false })
  for (let i = 0; i < 10; i++) {
    const side = i % 4
    const u = -24 + ((i * 13) % 48)
    const y = [0, 8, 16][i % 3]!
    const e = 36 - GALLERY_D + 0.4
    const p = side === 0 ? { x: u, z: -e, yaw: Math.PI } : side === 1 ? { x: u, z: e, yaw: 0 } : side === 2 ? { x: -e, z: u, yaw: Math.PI / 2 } : { x: e, z: u, yaw: -Math.PI / 2 }
    k.spots.push({ district: 'nef', x: p.x, y, z: p.z, yaw: p.yaw, pose: 'lean' })
  }
  benches.forEach(([x, z, a]) => k.spots.push({ district: 'nef', x: x * 0.98, y: -6, z: z * 0.98, yaw: Math.atan2(Math.cos(a), -Math.sin(a)), pose: 'sit' }))
  k.spots.push({ district: 'nef', x: -1.2, y: 27, z: -2.6, yaw: Math.PI, pose: 'lean' })
}

function puits(k: Kit): void {
  ringWall(k, 0, 0, -22, -6.3, 11.8, 0x8a6e5e, [{ a: 0, w: 3.2, y0: -22, y1: -19 }, { a: Math.PI, w: 3.2, y0: -22, y1: -19 }])
  ringFloor(k, 0, 0, -14, 7.8, 11.8, 'grille', [{ x: 0, z: -11.3, r: 0.7 }, { x: 0, z: 11.3, r: 0.7 }, { x: 10.8, z: 0, r: 0.7 }, { x: -10.8, z: 0, r: 0.7 }], 0.2)
  ringRail(k, 0, 0, -14, 7.9, [], 32)
  k.netH(-7.6, 7.6, -7.6, 7.6, -14.3, 'filet-puits', { x: 0, z: 0, r: 2.7 })
  ringFloor(k, 0, 0, -22, 2.5, 11.8, 'grille', [{ x: 0, z: 9, r: 0.9 }], 0.4)
  k.ladder('puits-bas-est', 11.1, 0, -22, -13.9, -1, 0, ['puits'])
  k.ladder('puits-bas-ouest', -11.1, 0, -22, -13.9, 1, 0, ['puits'])
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    engine(k, Math.cos(a) * 7, -22, Math.sin(a) * 7, -a + Math.PI / 2)
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15
    const r = 11.2
    k.pipe([{ x: Math.cos(a) * r, y: -22, z: Math.sin(a) * r }, { x: Math.cos(a) * r, y: -6.5, z: Math.sin(a) * r }], 0.16 + (i % 3) * 0.05, i % 2 ? PAL.laiton : PAL.rouille, true)
  }
  for (const y of [-19, -10]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5
      k.lamp(Math.cos(a) * 11, y, Math.sin(a) * 11, { color: 0xe08a4e, radius: 10, bake: 1.2, style: 'cage' })
    }
  }
  k.cell({
    id: 'puits', district: 'machines', deck: 'machines', nom: NOMS.puits,
    boxes: [{ x0: -11.8, x1: 11.8, y0: -22.6, y1: -6.3, z0: -11.8, z1: 11.8 }],
    spawn: { x: 5, y: -22, z: -8, yaw: 0 }, air: 0.6, roof: -6, pvs: ['machines', 'nef'], glass: true,
  })
  k.ladder('bulle-echelle', 0, 9.6, -26.2, -21.9, 0, -1, ['puits', 'dome-machines'])
  bubble(k)
  shrine(k, { id: 'cs-06', num: 6, x: 11.9, y: -22, z: 0, nx: 1, nz: 0, district: 'machines', deck: 'cale', pvs: ['machines'] })
  shrine(k, { id: 'cs-07', num: 7, x: -11.9, y: -22, z: 0, nx: -1, nz: 0, district: 'machines', deck: 'cale', pvs: ['machines'] })
  k.spots.push({ district: 'machines', x: 4, y: -22, z: 3.5, yaw: -0.8, pose: 'work' })
  k.spots.push({ district: 'machines', x: -4.2, y: -22, z: -3.2, yaw: 2.4, pose: 'work' })
  k.paths.push({ district: 'machines', pts: [{ x: 9.8, z: 0 }, { x: 0, z: 9.8 }, { x: -9.8, z: 0 }, { x: 0, z: -9.8 }], y: -14, loop: true, busy: 0.4, work: true })
}

function bubble(k: Kit): void {
  const cx = 0
  const cz = 9
  const cy = -25.4
  const r = 3.3
  const sph = new THREE.SphereGeometry(r, 28, 18)
  k.glass.add(sph, new THREE.Matrix4().makeTranslation(cx, cy, cz), C(0x9fd6d0))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    let prev: THREE.Vector3 | null = null
    for (let j = 0; j <= 12; j++) {
      const t = (j / 12) * Math.PI
      const p = V(cx + Math.cos(a) * Math.sin(t) * r, cy + Math.cos(t) * r, cz + Math.sin(a) * Math.sin(t) * r)
      if (prev) k.beam(prev.x, prev.y, prev.z, p.x, p.y, p.z, 0.09, C(PAL.laiton))
      prev = p
    }
  }
  ringFloor(k, cx, cz, -26.2, 0, 2.7, 'grille', [], 0.15)
  const tor = new THREE.TorusGeometry(2.7, 0.08, 4, 32)
  tor.rotateX(Math.PI / 2)
  k.b.add(tor, new THREE.Matrix4().makeTranslation(cx, -26.25, cz), C(PAL.laiton))
  ringRail(k, cx, cz, -26.2, 2.6, [[-Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4]], 16)
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2
    k.cols.push({ kind: 'glass', climbable: false, x: cx + Math.cos(a) * r, y: cy, z: cz + Math.sin(a) * r, hx: 0.15, hy: r, hz: 0.95, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a) })
  }
  k.beam(cx + 1.2, -26.2, cz + 1, cx + 1.4, -25, cz + 1.5, 0.06, C(PAL.boisOmbre))
  k.beam(cx + 1.4, -24.9, cz + 1.5, cx + 1.1, -25.6, cz + 2.4, 0.13, C(PAL.laiton, 1.1), k.b, true)
  k.cols.push({ kind: 'prop', climbable: false, ownerId: 'lunette-dome-machines', x: cx + 1.3, y: -25.4, z: cz + 1.5, hx: 0.3, hy: 0.8, hz: 0.3 })
  k.anchors.push({ kind: 'lunette', id: 'dome-machines', at: { x: cx + 1.3, y: -26.2, z: cz + 1.5 }, yaw: Math.PI })
  k.domes.push({ id: 'dome-machines', district: 'machines', x: cx, y: cy - r, z: cz, r, lunette: { x: cx + 1.3, y: -26.2, z: cz + 1.5 } })
  k.lamps.push({ x: cx, y: -25, z: cz, color: 0x9fd6d0, radius: 8, live: true, bake: 0.6 })
  k.cell({
    id: 'dome-machines', district: 'machines', deck: 'cale', nom: NOMS.domeMachines,
    boxes: [{ x0: cx - r, x1: cx + r, y0: cy - r, y1: -21.9, z0: cz - r, z1: cz + r }],
    spawn: { x: cx - 1, y: -26.2, z: cz - 1, yaw: Math.PI }, air: 0, roof: -22.2, pvs: ['machines'], glass: true,
  })
}

function awning(k: Kit, cx: number, z: number, face: 1 | -1, len: number, cloth: THREE.Color): void {
  const back = { x: cx - face * 0.85, y: 3.05 }
  const front = { x: cx + face * 1.12, y: 2.62 }
  const stripes = 7
  const sw = len / stripes
  const segs = 6
  const cream = C(PAL.creme, 0.92)
  for (let i = 0; i < stripes; i++) {
    const z0 = z - len / 2 + i * sw
    const pos: number[] = []
    const idx: number[] = []
    for (let j = 0; j <= segs; j++) {
      const t = j / segs
      const x = back.x + (front.x - back.x) * t
      const y = back.y + (front.y - back.y) * t - Math.sin(t * Math.PI) * 0.12
      for (const dz of [0, sw]) {
        const edge = dz === 0 ? 0 : 1
        pos.push(x, y - Math.sin(t * Math.PI) * 0.05 * (0.5 - Math.abs(edge - 0.5)), z0 + dz)
      }
      if (j > 0) {
        const a0 = (j - 1) * 2
        idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    k.cloth.add(g, new THREE.Matrix4(), i % 2 ? cream : cloth)
    const flap = new THREE.Matrix4().compose(V(front.x + face * 0.005, front.y - 0.01, z0 + sw / 2), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2), V(sw / 2 * 0.98, sw / 2 * 0.98, 1))
    k.cloth.add(SCALLOP, flap, i % 2 ? cream : cloth)
  }
  k.beam(front.x, front.y, z - len / 2 - 0.05, front.x, front.y, z + len / 2 + 0.05, 0.05, C(PAL.boisOmbre, 1.1))
  k.beam(back.x, back.y, z - len / 2 - 0.05, back.x, back.y, z + len / 2 + 0.05, 0.06, C(PAL.boisOmbre, 1.1))
}

const SCALLOP = (() => {
  const g = new THREE.CircleGeometry(1, 8, Math.PI, Math.PI)
  return g
})()

const STALL_GOODS = [0x9fb8c8, 0x7fa86a, 0xd8644e, 0xe3b95f, 0xf4f1e6, 0xc79a3b, 0x6e8fb0]

function stall(k: Kit, id: string, x: number, z: number, face: 1 | -1, awningColor: number): void {
  const cx = x
  const cloth = softColor(C(awningColor), 0.62).multiplyScalar(0.9)
  const wood = C(0x7a5644)
  const dark = C(PAL.boisOmbre, 1.15)
  k.b.with(SURF.planksX, () => {
    k.b.rbox(cx, 0.5, z, 0.96, 0.96, 2.56, wood, 0.03)
    k.cols.push({ kind: 'prop', climbable: true, ownerId: id, x: cx, y: 0.5, z, hx: 0.5, hy: 0.5, hz: 1.3 })
    k.b.rbox(cx + face * 0.02, 1.02, z, 1.12, 0.06, 2.74, C(0x8a644a), 0.02)
  })
  for (let i = 0; i < 5; i++) {
    const bz = z - 1.0 + i * 0.5
    k.b.with(SURF.planksZ, () => k.b.rbox(cx + face * 0.49, 0.52, bz, 0.04, 0.84, 0.46, C(0x7a5644, 0.88 + (i % 2) * 0.14), 0.012))
  }
  for (const dz of [-1.3, 1.3]) k.b.rbox(cx + face * 0.5, 0.53, z + dz, 0.1, 1.06, 0.1, dark, 0.02)
  k.b.box(cx + face * 0.52, 0.22, z, 0.03, 0.06, 2.5, dark)
  k.place(id, 'etal', { x: cx + face * 0.9, y: 0, z }, face > 0 ? -Math.PI / 2 : Math.PI / 2)
  for (let i = 0; i < 9; i++) {
    const vz = z - 1.25 + (i + 0.5) * (2.5 / 9)
    const m = new THREE.Matrix4().compose(V(cx + face * 0.535, 0.99, vz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2), V(2.5 / 18, 0.14, 1))
    k.cloth.add(SCALLOP, m, i % 2 ? C(PAL.creme, 0.9) : cloth)
  }
  for (let bi = 0; bi < 3; bi++) {
    const bz = z - 0.85 + bi * 0.85
    k.b.with(SURF.fabric, () => k.b.cyl(cx + face * 0.1, 1.12, bz, 0.3, 0.14, C(0x9a7650)))
    k.b.cyl(cx + face * 0.1, 1.19, bz, 0.31, 0.03, C(0x7a5640))
    const good = k.pick(STALL_GOODS)
    for (let g = 0; g < 5; g++) {
      const a = (g / 5) * Math.PI * 2 + k.rand()
      const r = g === 4 ? 0 : 0.14
      k.b.sphere(cx + face * 0.1 + Math.cos(a) * r, 1.22 + (g === 4 ? 0.06 : 0), bz + Math.sin(a) * r, 0.1, 0.07, 0.13, softColor(C(good), 0.7))
    }
  }
  k.crate(cx - face * 1.3, 0, z + 0.7, 0.6)
  k.barrel(cx - face * 1.3, 0, z - 0.6, 0.3, 0.8)
  if (k.rand() < 0.6) {
    k.b.with(SURF.fabric, () => k.b.cyl(cx + face * 0.85, 0.16, z + (k.rand() - 0.5) * 1.6, 0.24, 0.32, C(0x9a7650)))
  }
  for (const dz of [-1.3, 1.3]) k.b.rbox(cx - face * 0.7, 1.55, z + dz, 0.09, 3.1, 0.09, dark, 0.02)
  k.b.rbox(cx + face * 0.62, 1.42, z + 1.18, 0.03, 0.34, 0.42, C(0x34403c), 0.01)
  k.b.box(cx + face * 0.64, 1.47, z + 1.18, 0.01, 0.03, 0.26, C(0xe8dfcc, 0.9))
  k.b.box(cx + face * 0.64, 1.39, z + 1.14, 0.01, 0.03, 0.18, C(0xe8dfcc, 0.8))
  awning(k, cx, z, face, 2.9, cloth)
  k.cols.push({ kind: 'prop', climbable: true, x: cx + face * 0.1, y: 2.85, z, hx: 0.95, hy: 0.05, hz: 1.45 })
  k.lamp(cx + face * 0.6, 2.45, z, { radius: 6, bake: 0.7, style: 'shade', hang: 0.3, color: k.rand() < 0.5 ? PAL.lampe : PAL.lampeChaude })
  k.spots.push({ district: k.district, x: cx - face * 0.6, y: 0, z, yaw: face > 0 ? Math.PI / 2 : -Math.PI / 2, pose: 'work' })
  for (const dz of [-0.7, 0.6]) {
    if (k.rand() < 0.75) k.spots.push({ district: k.district, x: cx + face * (1.55 + k.rand() * 0.3), y: 0, z: z + dz + (k.rand() - 0.5) * 0.3, yaw: face > 0 ? -Math.PI / 2 + (k.rand() - 0.5) * 0.6 : Math.PI / 2 + (k.rand() - 0.5) * 0.6, pose: 'talk' })
  }
}

function marche(k: Kit): void {
  const awnings = [PAL.tissu1, PAL.tissu2, PAL.tissu3, 0x8fbf6a, 0xd8644e]
  let n = 1
  for (let z = 2; z < 68; z += 4.2) {
    if (z > 38 && z < 50) continue
    stall(k, `etal-marche-${n++}`, -91.6, z, 1, k.pick(awnings))
    stall(k, `etal-marche-${n++}`, -84.4, z + 1.2, -1, k.pick(awnings))
  }
  tower(k, 'horloge', -88, 44, 0, [6.5, 13], 21, ['grand-marche', 'dome-marche'])
  for (const s of [-1, 1]) {
    const f = V(-88 + s * 2.25, 16.5, 44)
    k.e.add(new THREE.CircleGeometry(1.15, 24), new THREE.Matrix4().compose(f, new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(s, 0, 0)), V(1, 1, 1)), C(PAL.creme, 1.25))
    k.b.add(new THREE.TorusGeometry(1.2, 0.08, 5, 24), new THREE.Matrix4().compose(f, new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(s, 0, 0)), V(1, 1, 1)), C(PAL.laiton, 1.1))
    k.beam(f.x + s * 0.05, f.y, f.z, f.x + s * 0.05, f.y + 0.75, f.z + 0.2, 0.07, C(PAL.boisOmbre))
    k.beam(f.x + s * 0.05, f.y, f.z, f.x + s * 0.05, f.y - 0.2, f.z + 0.55, 0.06, C(PAL.boisOmbre))
  }
  k.b.box(-88, 16.5, 44, 3.8, 3.2, 3.6, C(PAL.tissu1, 0.85))
  k.lamps.push({ x: -88, y: 16.5, z: 44, color: PAL.lampe, radius: 10, live: false, bake: 0.9 })
  k.slab(-97.25, -90.8, 42.5, 45.5, 13, 'bois')
  k.slab(-85.2, -78.75, 42.5, 45.5, 13, 'bois')
  for (const [a, b] of [[-97.25, -90.8], [-85.2, -78.75]] as const) {
    k.rail(a, 42.5, b, 42.5, 13)
    k.rail(a, 45.5, b, 45.5, 13)
  }
  for (const z of [10, 58]) {
    k.slab(-97.25, -78.75, z - 1.5, z + 1.5, 6.5, 'bois')
    k.rail(-97.25, z - 1.5, -78.75, z - 1.5, 6.5)
    k.rail(-97.25, z + 1.5, -78.75, z + 1.5, 6.5)
    for (let x = -96; x < -79; x += 2) k.beam(x, 6.1, z - 1.5, x, 6.1, z + 1.5, 0.18, C(PAL.boisOmbre, 1.2))
  }
  k.stairs(-97.25, -94.85, 20.9, 30, 0, 6.5, '-z')
  k.slab(-97.25, -94.85, 18.5, 20.9, 6.5, 'bois')
  k.rail(-94.85, 18.5, -94.85, 20.9, 6.5)
  k.rail(-97.25, 18.5, -94.85, 18.5, 6.5)
  k.slab(-81.15, -78.75, 37.6, 40, 6.5, 'bois')
  k.stairs(-81.15, -78.75, 40, 49.1, 6.5, 13, '+z')
  k.slab(-81.15, -78.75, 49.1, 51.5, 13, 'bois')
  for (const [x, z0, z1, y] of [[-81.15, 37.6, 40, 6.5], [-81.15, 49.1, 51.5, 13]] as const) k.rail(x, z0, x, z1, y)
  k.rail(-81.15, 37.6, -78.75, 37.6, 6.5)
  k.rail(-81.15, 51.5, -78.75, 51.5, 13)
  k.stairs(-81.15, -78.75, 57.1, 66.2, 0, 6.5, '+z')
  k.slab(-81.15, -78.75, 66.2, 68.6, 6.5, 'bois')
  k.rail(-81.15, 66.2, -81.15, 68.6, 6.5)
  k.rail(-81.15, 68.6, -78.75, 68.6, 6.5)
  k.slab(-97.25, -94.85, 26.2, 28.6, 6.5, 'bois')
  k.stairs(-97.25, -94.85, 17.5, 26.2, 6.5, 13, '-z')
  k.slab(-97.25, -94.85, 15.1, 17.5, 13, 'bois')
  k.rail(-94.85, 26.2, -94.85, 28.6, 6.5)
  k.rail(-97.25, 28.6, -94.85, 28.6, 6.5)
  k.rail(-94.85, 15.1, -94.85, 17.5, 13)
  k.rail(-97.25, 15.1, -94.85, 15.1, 13)

  zipline(k, 'tyrolienne-marche', V(-88, 15.0, 40.2), V(-88, 1.9, 4))
  k.toboggan('toboggan-marche', [V(-98.8, 13.05, 31.6), V(-96.4, 12.75, 31.6), V(-96.4, 12.4, 33), V(-96.4, 0.55, 52.4), V(-96.4, 0.05, 54)], 0xd8644e)
  const flags = [PAL.tissu1, PAL.tissu2, PAL.tissu3, 0x8fbf6a, PAL.creme, 0xd8644e]
  for (let z = 4; z < 70; z += 7) {
    k.bunting(V(-97.2, 11.5, z), V(-78.8, 11.5, z + 3.5), 1.6, flags)
    k.bunting(V(-97.2, 17.8, z + 2), V(-78.8, 17.8, z - 1.5), 1.2, flags)
  }
  for (let z = 6; z < 70; z += 11) k.bulbString(V(-97, 5.4, z), V(-79, 5.4, z + 5), 1.0, PAL.lampe, 1.4, 3)
  for (let z = 4; z < 70; z += 16) k.lamp(-86.4, 9.5, z, { style: 'globe', radius: 14, bake: 1.2, hang: 9.6 })
  for (const [x, z] of [[-88, 20], [-88, 54]] as const) k.shafts.push({ x, z, top: 26, bottom: 0, r: 2.8, tint: 0x9fd6d0 })
  k.sign(NOMS.marche, -88, 9.2, -5.4, Math.PI, 6, 1.0, PANNEAUX.marcheSous)
  booth(k, 'marche', 'nef', PANNEAUX.versNef, -93, 0, -2.8, Math.PI, { x: 0, y: -6, z: -21, yaw: Math.PI }, { act: 2 })
  shrine(k, { id: 'cs-02', num: 2, x: -104.3, y: 0, z: 20, nx: -1, nz: 0, district: 'marche', deck: 'principal', pvs: ['marche'] })

  k.paths.push({ district: 'marche', pts: [{ x: -88, z: 1 }, { x: -88, z: 38 }], y: 0, loop: false, busy: 2.2, work: false })
  k.paths.push({ district: 'marche', pts: [{ x: -87, z: 3 }, { x: -89.2, z: 37 }], y: 0, loop: false, busy: 1.6, work: false })
  k.paths.push({ district: 'marche', pts: [{ x: -88, z: 50 }, { x: -88, z: 70 }], y: 0, loop: false, busy: 2, work: false })
  k.paths.push({ district: 'marche', pts: [{ x: -95.5, z: 1 }, { x: -95.5, z: 70 }], y: 0, loop: false, busy: 0.9, work: false })
  k.paths.push({ district: 'marche', pts: [{ x: -80.5, z: 1 }, { x: -80.5, z: 70 }], y: 0, loop: false, busy: 0.9, work: false })
  for (const y of [6.5, 13]) {
    k.paths.push({ district: 'marche', pts: [{ x: -99, z: -2 }, { x: -99, z: 70 }], y, loop: false, busy: 0.5, work: false })
    k.paths.push({ district: 'marche', pts: [{ x: -77, z: -2 }, { x: -77, z: 70 }], y, loop: false, busy: 0.5, work: false })
  }
  for (let i = 0; i < 8; i++) k.spots.push({ district: 'marche', x: i % 2 ? -97.5 : -78.5, y: i % 3 ? 6.5 : 13, z: 6 + i * 8, yaw: i % 2 ? Math.PI / 2 : -Math.PI / 2, pose: 'lean' })
}

function serres(k: Kit): void {
  for (const cx of [82, 90, 98]) {
    for (const [z0, z1] of [[1, 18], [22, 40], [48, 68]] as const) {
      k.solid(cx - 1.25, 0.35, (z0 + z1) / 2, 0.3, 0.7, z1 - z0, C(PAL.bois, 0.95), 'prop', true)
      k.solid(cx + 1.25, 0.35, (z0 + z1) / 2, 0.3, 0.7, z1 - z0, C(PAL.bois, 0.95), 'prop', true)
      k.solid(cx, 0.35, z0, 2.8, 0.7, 0.3, C(PAL.bois, 0.95), 'prop', true)
      k.solid(cx, 0.35, z1, 2.8, 0.7, 0.3, C(PAL.bois, 0.95), 'prop', true)
      k.cols.push({ kind: 'prop', climbable: true, x: cx, y: 0.3, z: (z0 + z1) / 2, hx: 1.1, hy: 0.3, hz: (z1 - z0) / 2 - 0.15 })
      k.waters.push({ x0: cx - 1.1, x1: cx + 1.1, z0: z0 + 0.15, z1: z1 - 0.15, y: 0.6 })
      for (let z = z0 + 0.8; z < z1 - 0.5; z += 0.9 + k.rand() * 0.5) {
        k.kelp.push({ x: cx + (k.rand() - 0.5) * 1.4, y: 0.5, z, h: 3 + k.rand() * 6.5, seed: k.rand() })
      }
    }
    }
  for (let z = 4; z < 70; z += 8) {
    if (z > 39 && z < 49) continue
    for (const x of [86, 94]) {
      let prev: THREE.Vector3 | null = null
      for (let i = 0; i <= 10; i++) {
        const t = (i / 10) * Math.PI
        const p = V(x + Math.cos(t) * 2.8, 4.2 + Math.sin(t) * 2.2, z)
        if (prev) k.beam(prev.x, prev.y, prev.z, p.x, p.y, p.z, 0.1, C(PAL.bois, 1.05))
        prev = p
      }
      k.beam(x - 2.8, 0, z, x - 2.8, 4.2, z, 0.12, C(PAL.bois))
      k.beam(x + 2.8, 0, z, x + 2.8, 4.2, z, 0.12, C(PAL.bois))
      for (let i = 0; i < 6; i++) {
        const t = k.rand() * Math.PI
        k.b.sphere(x + Math.cos(t) * 2.8, 4.2 + Math.sin(t) * 2.2, z + (k.rand() - 0.5) * 0.4, 0.3, 0.25, 0.3, C(k.pick([0x7fa86a, 0x8fbf6a, 0xb9d98a, 0x5e8f5a])))
      }
    }
  }
  tower(k, 'serre-tour', 90, 44, 0, [7], 21, ['serre-cathedrale', 'dome-serres'])
  k.slab(78.75, 87.2, 42.5, 45.5, 7, 'bois')
  k.slab(92.8, 101.25, 42.5, 45.5, 7, 'bois')
  for (const [a, b] of [[78.75, 87.2], [92.8, 101.25]] as const) {
    k.rail(a, 42.5, b, 42.5, 7)
    k.rail(a, 45.5, b, 45.5, 7)
  }
  k.slab(78.75, 101.25, 8.5, 11.5, 7, 'bois')
  k.rail(78.75, 8.5, 101.25, 8.5, 7)
  k.rail(78.75, 11.5, 101.25, 11.5, 7)
  k.stairs(78.75, 81.15, 20.2, 30, 0, 7, '-z')
  k.slab(78.75, 81.15, 17.8, 20.2, 7, 'bois')
  k.rail(81.15, 17.8, 81.15, 20.2, 7)
  k.rail(78.75, 17.8, 81.15, 17.8, 7)
  k.stairs(98.85, 101.25, 50, 59.8, 0, 7, '+z')
  k.slab(98.85, 101.25, 59.8, 62.2, 7, 'bois')
  k.rail(98.85, 59.8, 98.85, 62.2, 7)
  k.rail(98.85, 62.2, 101.25, 62.2, 7)
  for (let z = 6; z < 70; z += 12) {
    k.lamp(86, 12.5, z, { color: 0xb9d98a, radius: 14, bake: 1.1, style: 'globe', hang: 10 })
    k.lamp(94, 12.5, z + 6, { color: PAL.lampe, radius: 14, bake: 1.1, style: 'globe', hang: 10 })
  }
  for (let z = 6; z < 70; z += 14) k.shafts.push({ x: 90, z, top: 26, bottom: 0, r: 3.2, tint: 0xb9d98a })
  for (const z of [16, 30, 56]) {
    k.bench(`banc-serres-${z}`, 77, 0, z, 2.4, false, Math.PI / 2)
    k.plant(77, 0, z + 2, 1.3)
  }
  for (let i = 0; i < 6; i++) k.plant(103 + (i % 2), 0, 4 + i * 11, 1.2 + (i % 3) * 0.2)
  k.cot('couchette-serres', 101.5, 0, 20.4, false, 0x8fbf6a)
  k.plant(101.5, 0, 18.6, 0.9)
  k.sign(NOMS.serres, 90, 6.8, -5.4, Math.PI, 5, 0.9, PANNEAUX.serresSous)
  booth(k, 'serres', 'nef', PANNEAUX.versNef, 86, 0, -2.8, Math.PI, { x: 0, y: -6, z: -21, yaw: Math.PI }, { act: 2 })
  shrine(k, { id: 'cs-03', num: 3, x: 108.3, y: 0, z: 10, nx: 1, nz: 0, district: 'serres', deck: 'principal', pvs: ['serres'] })
  shrine(k, { id: 'cs-04', num: 4, x: 108.3, y: 0, z: 50, nx: 1, nz: 0, district: 'serres', deck: 'principal', pvs: ['serres'] })
  k.spots.push({ district: 'serres', x: 92.4, y: 0, z: 26, yaw: -Math.PI / 2, pose: 'work' })
  k.spots.push({ district: 'serres', x: 84.6, y: 0, z: 52, yaw: Math.PI / 2, pose: 'work' })
  k.spots.push({ district: 'serres', x: 100.4, y: 0, z: 12, yaw: -Math.PI / 2, pose: 'work' })
  k.paths.push({ district: 'serres', pts: [{ x: 86, z: 1 }, { x: 86, z: 70 }, { x: 94, z: 70 }, { x: 94, z: 1 }], y: 0, loop: true, busy: 0.7, work: false })
  k.paths.push({ district: 'serres', pts: [{ x: 77, z: 1 }, { x: 77, z: 70 }], y: 0, loop: false, busy: 0.5, work: false })
  k.paths.push({ district: 'serres', pts: [{ x: 75, z: 0 }, { x: 75, z: 70 }], y: 7, loop: false, busy: 0.3, work: false })
}

function ateliers(k: Kit): void {
  for (const z of [-36.5, -39]) {
    k.line(-108, 1.1, z, -62, 1.1, z)
    k.line(-108, 1.13, z + 0.05, -62, 1.13, z + 0.05)
    for (let x = -108; x <= -62; x += 9.2) {
      k.b.box(x, 0.6, z, 0.18, 1.2, 0.18, C(PAL.boisOmbre))
      k.b.box(x, 1.1, z, 0.35, 0.18, 0.9, C(PAL.bois))
      k.cols.push({ kind: 'prop', climbable: true, x, y: 0.6, z, hx: 0.12, hy: 0.6, hz: 0.12 })
    }
  }
  k.b.cyl(-62, 0.8, -37.7, 0.6, 1.6, C(PAL.bois))
  k.cols.push({ kind: 'prop', climbable: true, x: -62, y: 0.8, z: -37.7, hx: 0.6, hy: 0.8, hz: 0.6 })
  k.solid(-118, 1.6, -38, 4, 3.2, 3.2, C(PAL.rouille, 0.9), 'prop', true)
  k.e.box(-118, 1.2, -36.35, 2.2, 1.3, 0.1, C(0xff7a2e, 1.4))
  k.lamps.push({ x: -118, y: 1.4, z: -35, color: 0xe08a4e, radius: 12, live: true, bake: 1.3 })
  k.pipe([{ x: -119, y: 3.2, z: -38 }, { x: -119, y: 17, z: -38 }], 0.45, PAL.metalSombre, true)
  k.steam.push({ x: -119, y: 17.4, z: -38 })
  for (const x of [-113, -110]) {
    k.b.box(x, 0.4, -36, 0.6, 0.8, 0.4, C(PAL.metalSombre))
    k.b.box(x, 0.85, -36, 0.9, 0.15, 0.35, C(PAL.metal, 1.1))
    k.cols.push({ kind: 'prop', climbable: true, x, y: 0.45, z: -36, hx: 0.45, hy: 0.45, hz: 0.25 })
  }
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) k.bench(null, -58 + j * 2.2, 0, -40.5 + i * 1.5, 1.6, true, 0)
  }
  k.b.box(-56.9, 1.5, -41.9, 3.2, 3, 0.1, C(PAL.boisOmbre))
  k.sign(PANNEAUX.ecole, -56.9, 2.2, -41.8, Math.PI, 3, 1.4, PANNEAUX.ecoleSous, 0xf4f1e6, 0x2f4e3a)
  for (let x = -120; x < -95; x += 2.6) k.shelf(x, 6.5, -45.5, 2.4, 3.6, true, 0.45)
  k.sign(PANNEAUX.bibliotheque, -107, 10.6, -45.6, Math.PI, 4, 0.7)
  tower(k, 'ateliers-tour', -112, -32, 0, [6.5], 14, ['ateliers', 'dome-ateliers'])
  dome(k, 'dome-ateliers', 'ateliers', -112, 19.6, -32, 3.8, { nom: NOMS.domeAteliers, pvs: ['ateliers', 'marche', 'nef'], deck: 'domes', hole: { x: -111.8, z: -29.05 } })
  k.ladder('ateliers-tour-dome', -112 + 0.2, -32 + 2.95, 14, 19.7, 0, 1, ['ateliers', 'dome-ateliers'])
  k.slab(-113.6, -110.4, -39.25, -34.8, 6.5, 'grille', 0.2)
  k.rail(-113.6, -39.25, -113.6, -34.8, 6.5)
  k.rail(-110.4, -39.25, -110.4, -34.8, 6.5)
  for (const x of [-105, -70]) {
    k.slab(x - 1.5, x + 1.5, -39.25, -24.75, 6.5, 'bois')
    k.rail(x - 1.5, -39.25, x - 1.5, -24.75, 6.5)
    k.rail(x + 1.5, -39.25, x + 1.5, -24.75, 6.5)
  }
  k.stairs(-100, -90.9, -27.15, -24.75, 0, 6.5, '+x')
  k.slab(-90.9, -88.5, -27.15, -24.75, 6.5, 'bois')
  k.rail(-90.9, -27.15, -88.5, -27.15, 6.5)
  k.rail(-88.5, -27.15, -88.5, -24.75, 6.5)
  k.stairs(-79.1, -70, -39.25, -36.85, 0, 6.5, '-x')
  k.slab(-81.5, -79.1, -39.25, -36.85, 6.5, 'bois')
  k.rail(-81.5, -36.85, -79.1, -36.85, 6.5)
  k.rail(-81.5, -39.25, -81.5, -36.85, 6.5)
  for (let x = -116; x < -56; x += 12) k.lamp(x, 10, -32, { style: 'globe', radius: 13, bake: 1.1, hang: 7 })
  for (let x = -114; x < -58; x += 9) k.bulbString(V(x, 5.8, -39.2), V(x + 4, 5.8, -24.8), 0.9)
  for (const x of [-100, -76]) k.shafts.push({ x, z: -32, top: 19, bottom: 0, r: 2.4, tint: 0x9fd6d0 })
  booth(k, 'ateliers', 'nef', PANNEAUX.versNef, -56, 0, -24.2, -Math.PI / 2, { x: 0, y: -6, z: -21, yaw: Math.PI }, { act: 2 })
  shrine(k, { id: 'cs-08', num: 8, x: -100, y: 0, z: -46.3, nx: 0, nz: -1, district: 'ateliers', deck: 'principal', pvs: ['ateliers'] })
  shrine(k, { id: 'cs-09', num: 9, x: -70, y: 0, z: -46.3, nx: 0, nz: -1, district: 'ateliers', deck: 'principal', pvs: ['ateliers'] })
  k.cot('couchette-ateliers-1', -121.4, 0, -24.4, true, PAL.tissu3)
  k.cot('couchette-ateliers-2', -121.4, 0, -26.1, true, PAL.tissu1)
  k.hammock('couchette-ateliers-3', -118.6, -23.6, -118.6, -27.6, 0, PAL.tissu2)
  k.sign(PANNEAUX.dortoir, -123.6, 2.4, -25.2, Math.PI / 2, 1.8, 0.4)
  k.lamp(-120.4, 2.6, -25.2, { radius: 5, bake: 0.7, style: 'shade', hang: 0.3, color: PAL.lampeChaude })
  k.sign(PANNEAUX.cordiers, -85, 2.6, -35.6, Math.PI, 2.2, 0.45)
  k.sign(PANNEAUX.forge, -118, 3.6, -36.2, Math.PI, 2, 0.45, undefined, PAL.creme, PAL.boisOmbre)
  k.crates(-84, 0, -42, 3)
  k.crates(-85.2, 0, -42.8, 2)
  for (let i = 0; i < 6; i++) k.sack(-78 + i * 0.7, 0, -23.5)
  k.paths.push({ district: 'ateliers', pts: [{ x: -120, z: -28.5 }, { x: -56, z: -28.5 }], y: 0, loop: false, busy: 0.7, work: false })
  k.paths.push({ district: 'ateliers', pts: [{ x: -106, z: -33 }, { x: -60, z: -33 }], y: 0, loop: false, busy: 0.6, work: false })
  k.paths.push({ district: 'ateliers', pts: [{ x: -122, z: -42 }, { x: -55, z: -42 }], y: 6.5, loop: false, busy: 0.3, work: false })
  for (const x of [-104, -94, -84, -74, -66]) k.spots.push({ district: 'ateliers', x, y: 0, z: -37.75, yaw: x % 20 === 0 ? 0 : Math.PI, pose: 'work' })
  for (let i = 0; i < 6; i++) k.spots.push({ district: 'ateliers', x: -58 + (i % 2) * 2.2, y: 0, z: -40.1 + Math.floor(i / 2) * 1.5, yaw: Math.PI, pose: 'sit' })
}

function scellees(k: Kit): void {
  k.waters.push({ x0: 53, x1: 123, z0: -45, z1: -19, y: 0.06 })
  for (let i = 0; i < 18; i++) {
    const x = 58 + k.rand() * 60
    const z = -44 + k.rand() * 24
    if (Math.abs(z + 32) < 3 && x > 66) continue
    if (k.rand() < 0.5) k.crates(x, 0, z, 1 + Math.floor(k.rand() * 3))
    else k.barrel(x, 0, z, 0.36, 0.95, k.pick([PAL.rouille, PAL.teal, PAL.bois]))
  }
  for (const [x, z] of [[116, -22], [119, -22]] as const) k.hammock(`couchette-scellees-${x}`, x - 1, z - 0.5, x + 1, z - 2.5, 0, k.pick([PAL.tissu1, PAL.tissu2, PAL.tissu3]))
  k.b.cyl(112, 0.2, -24, 0.5, 0.4, C(PAL.metalSombre))
  k.e.sphere(112, 0.55, -24, 0.3, 0.25, 0.3, C(0xff8a3a, 1.3))
  k.lamps.push({ x: 112, y: 0.8, z: -24, color: 0xff9e5e, radius: 8, live: true, bake: 1.1 })
  k.steam.push({ x: 112, y: 0.9, z: -24 })
  for (const x of [109, 115]) k.bench(null, x, 0, -24.2, 1.6, false, x < 112 ? Math.PI / 2 : -Math.PI / 2)
  for (let x = 58; x < 122; x += 11) k.lamp(x, 9, -32, { style: 'cage', radius: 10, bake: x % 2 ? 0.55 : 0.9, hang: 6, color: x % 3 ? PAL.froid : PAL.lampe })
  for (const x of [75, 100]) {
    k.slab(x - 1.5, x + 1.5, -39.25, -24.75, 6.5, 'grille')
    k.rail(x - 1.5, -39.25, x - 1.5, -24.75, 6.5)
    k.rail(x + 1.5, -39.25, x + 1.5, -24.75, 6.5)
  }
  k.stairs(70, 79.1, -27.15, -24.75, 0, 6.5, '+x')
  k.slab(79.1, 81.5, -27.15, -24.75, 6.5, 'grille')
  k.rail(79.1, -27.15, 81.5, -27.15, 6.5)
  k.rail(81.5, -27.15, 81.5, -24.75, 6.5)
  tower(k, 'scellees-tour', 112, -32, 0, [6.5], 14, ['coques-scellees', 'dome-scellees'])
  dome(k, 'dome-scellees', 'scellees', 112, 19.6, -32, 3.8, { nom: NOMS.domeScellees, pvs: ['scellees', 'serres', 'nef'], deck: 'domes', hole: { x: 112.2, z: -29.05 } })
  k.ladder('scellees-tour-dome', 112 + 0.2, -32 + 2.95, 14, 19.7, 0, 1, ['coques-scellees', 'dome-scellees'])
  k.slab(110.4, 113.6, -39.25, -34.8, 6.5, 'grille', 0.2)
  k.rail(110.4, -39.25, 110.4, -34.8, 6.5)
  k.rail(113.6, -39.25, 113.6, -34.8, 6.5)
  for (const x of [64, 86, 106]) k.shafts.push({ x, z: -32, top: 19, bottom: 0, r: 2.2, tint: 0x7cc6bf })
  k.sign(NOMS.scellees, 54, 8.5, -32, Math.PI / 2, 5.6, 0.9, PANNEAUX.scelleesSous)
  booth(k, 'scellees', 'nef', PANNEAUX.versNef, 56, 0, -24.2, Math.PI / 2, { x: 0, y: -6, z: -21, yaw: Math.PI }, { act: 2 })
  shrine(k, { id: 'cs-10', num: 10, x: 66, y: 0, z: -46.3, nx: 0, nz: -1, district: 'scellees', deck: 'principal', pvs: ['scellees'] })
  shrine(k, { id: 'cs-11', num: 11, x: 88, y: 0, z: -46.3, nx: 0, nz: -1, district: 'scellees', deck: 'principal', pvs: ['scellees'] })
  shrine(k, { id: 'cs-12', num: 12, x: 110, y: 0, z: -46.3, nx: 0, nz: -1, district: 'scellees', deck: 'principal', pvs: ['scellees'] })
  k.paths.push({ district: 'scellees', pts: [{ x: 56, z: -30 }, { x: 120, z: -30 }], y: 0, loop: false, busy: 0.25, work: false })
  k.spots.push({ district: 'scellees', x: 110.6, y: 0, z: -24.2, yaw: Math.PI / 2, pose: 'sit' })
  k.spots.push({ district: 'scellees', x: 113.4, y: 0, z: -24.2, yaw: -Math.PI / 2, pose: 'sit' })
}

function proue(k: Kit): void {
  const wall = C(PAL.creme, 0.95)
  const X0 = -10
  const X1 = 10
  const Z0 = -72
  const Z1 = -50
  const solidWall = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => k.solid((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, wall, 'wall', true)
  k.slab(X0, X1, Z0, Z1, 8, 'bois')
  k.slab(-7.1, X1, Z0, Z1, 16, 'bois')
  k.slab(X0, -7.1, Z0, -63.2, 16, 'bois')
  k.slab(X0, 7.1, Z0, Z1, 24, 'bois')
  k.slab(7.1, X1, Z0, -63.2, 24, 'bois')
  solidWall(X0 - 0.4, X0, 7.5, 24, Z0, Z1)
  solidWall(X1, X1 + 0.4, 7.5, 24, Z0, Z1)
  solidWall(X0, -1.6, 7.5, 24, Z1, Z1 + 0.4)
  solidWall(1.6, X1, 7.5, 24, Z1, Z1 + 0.4)
  solidWall(-1.6, 1.6, 10.8, 24, Z1, Z1 + 0.4)
  solidWall(X0, X1, 7.5, 16, Z0 - 0.4, Z0)
  solidWall(X0, X1, 21, 24, Z0 - 0.4, Z0)
  solidWall(X0, -6.5, 16, 21, Z0 - 0.4, Z0)
  solidWall(6.5, X1, 16, 21, Z0 - 0.4, Z0)
  k.glass.add(new THREE.PlaneGeometry(13, 5), new THREE.Matrix4().makeTranslation(0, 18.5, Z0 - 0.2), C(0x9fd6d0))
  k.cols.push({ kind: 'glass', climbable: false, x: 0, y: 18.5, z: Z0 - 0.2, hx: 6.5, hy: 2.5, hz: 0.1 })
  for (let x = -6.5; x <= 6.5; x += 2.6) k.b.box(x, 18.5, Z0 - 0.2, 0.12, 5, 0.2, C(PAL.laiton))
  for (const y of [16.05, 18.5, 20.95]) k.b.box(0, y, Z0 - 0.2, 13, 0.12, 0.2, C(PAL.laiton))
  k.lamps.push({ x: 0, y: 18, z: Z0 + 4, color: 0x9fd6d0, radius: 14, live: false, bake: 0.8 })
  k.stairs(X0, -7.6, -63.2, -52, 8, 16, '-z')
  k.rail(-7.1, -63.2, -7.1, Z1, 16)
  k.rail(X0, -52, -7.1, -52, 16)
  k.doors.push({ id: 'grille-proue', x: 8.8, y: 16, z: -51.2, w: 2.4, h: 2.6, axis: 'z', style: 'grate', open: false, lock: { act: 3 }, sign: PANNEAUX.escalierNoye })
  k.stairs(7.6, X1, -63.2, -52, 16, 24, '-z', true)
  k.waters.push({ x0: 7.4, x1: X1, z0: -63, z1: -52, y: 19.5 })
  k.rail(7.1, -63.2, 7.1, -52, 24)
  k.lamp(0, 14.5, -60, { style: 'globe', radius: 12, bake: 1.0, hang: 0.8 })
  k.lamp(0, 22.5, -64, { style: 'globe', radius: 12, bake: 1.0, hang: 0.8 })
  k.lamp(-6, 11, -56, { style: 'shade', radius: 7, bake: 0.8, hang: 0.6 })
  k.table(2, 16, -66, 2.4, 1.4, 0.95, PAL.bois)
  k.cols.push({ kind: 'prop', climbable: false, ownerId: 'table-carte-vigie', x: 2, y: 16.5, z: -66, hx: 1.2, hy: 0.5, hz: 0.7 })
  k.anchors.push({ kind: 'chart-table', id: 'table-carte-vigie', at: { x: 2, y: 16, z: -64.8 }, yaw: Math.PI })
  k.place('table-carte-vigie', 'table-carte', { x: 2, y: 16, z: -64.8 }, Math.PI)
  k.b.box(2, 16.97, -66, 2.0, 0.02, 1.1, C(PAL.toile, 1.05))
  k.shelf(-9.4, 16, -66, 4, 3.4, false, 0.45)
  k.bench('banc-vigie', 0, 16, -69.5, 3, true, 0)
  k.cot('couchette-vigie', -3.2, 16, -53.4, true, PAL.tissu3)
  k.sign(PANNEAUX.vigieCarte, 2, 17.2, -66.55, Math.PI, 0.9, 0.2)
  k.plant(-5.5, 16, -70.8, 1.2)
  k.plant(5.5, 16, -70.8, 1.2)
  k.beam(4.2, 16, -69.8, 4.4, 17.3, -70.3, 0.05, C(PAL.boisOmbre))
  k.beam(4.4, 17.3, -70.3, 4.6, 17.7, -71.5, 0.13, C(PAL.laiton, 1.1), k.b, true)
  k.cols.push({ kind: 'prop', climbable: false, ownerId: 'lunette-vigie', x: 4.3, y: 16.8, z: -70, hx: 0.3, hy: 0.8, hz: 0.3 })
  k.anchors.push({ kind: 'lunette', id: 'vigie', at: { x: 4.3, y: 16, z: -69.6 }, yaw: 0 })
  k.sign(NOMS.vigie, 0, 21.8, Z0 + 0.1, Math.PI, 3.2, 0.6)
  k.sign(NOMS.proue, 0, 11.6, Z1 - 0.1, 0, 3.6, 0.7)
  booth(k, 'proue', 'nef', PANNEAUX.versNef, 6.5, 8, -55, -Math.PI / 2, { x: 0, y: -6, z: -21, yaw: Math.PI }, { act: 2 })
  k.cell({
    id: 'proue-vestibule', district: 'proue', deck: 'haut', nom: NOMS.proue,
    boxes: [{ x0: X0, x1: X1, y0: 7.4, y1: 15.7, z0: Z0, z1: Z1 }, { x0: X0, x1: -7.1, y0: 7.4, y1: 16.5, z0: -63.2, z1: Z1 }],
    spawn: { x: 0, y: 8, z: -52, yaw: 0 }, air: 0.2, roof: 15.6, pvs: ['proue', 'nef'],
  })
  k.cell({
    id: 'vigie', district: 'proue', deck: 'toits', nom: NOMS.vigie,
    boxes: [{ x0: X0, x1: X1, y0: 15.7, y1: 23.7, z0: Z0, z1: Z1 }],
    spawn: { x: 0, y: 16, z: -62, yaw: 0 }, air: 0.2, roof: 23.6, pvs: ['proue', 'nef'], glass: true,
  })
  dome(k, 'dome-proue', 'proue', 0, 24, -61, 7.5, { nom: NOMS.domeProue, pvs: ['proue', 'nef', 'hauts'], deck: 'domes', veille: false })
  k.cells[k.cells.length - 1]!.boxes.push({ x0: X0, x1: X1, y0: 23.7, y1: 25, z0: Z0, z1: Z1 })
  k.paths.push({ district: 'proue', pts: [{ x: -4, z: -66 }, { x: 4, z: -66 }], y: 16, loop: false, busy: 0.2, work: false })
}

function ecluse(k: Kit): void {
  const wall = C(PAL.platre, 0.95)
  k.solid(-5.2, 9.45, 44.5, 0.4, 12.9, 3.6, wall, 'wall', true)
  k.solid(-1.8, 7.85, 44.5, 0.4, 15.7, 3.6, wall, 'wall', true)
  k.solid(-3.5, 7.85, 42.6, 3.8, 15.7, 0.4, wall, 'wall', true)
  k.solid(-3.5, 7.85, 46.4, 3.8, 15.7, 0.4, wall, 'wall', true)
  k.slab(-5, -2, 42.8, 46.2, 0, 'metal')
  k.ladder('puits-echelle-ecluse', -3.5, 45.9, 0, 16.1, 0, -1, ['puits-echelle', 'dome-ecluse'])
  for (let y = 4; y < 16; y += 5) k.lamp(-2.3, y, 43.2, { style: 'cage', radius: 6, bake: 0.9 })
  k.cell({
    id: 'puits-echelle', district: 'ecluse', deck: 'principal', nom: NOMS.puitsEchelle,
    boxes: [{ x0: -5, x1: -2, y0: -0.5, y1: 16, z0: 42.8, z1: 46.2 }],
    spawn: { x: -3.5, y: 0, z: 44, yaw: 0 }, air: 0, roof: 16, pvs: ['ecluse'],
  })
  for (let x = -6; x < 6; x += 1) {
    for (let z = 31; z < 47; z += 1) {
      if (x >= -5 && x < -2 && z >= 43 && z < 46) continue
      k.slab(x, x + 1, z, z + 1, 16, z < 36 ? 'grille' : 'bois', 0.3)
    }
  }
  k.rail(-5, 43, -2, 43, 16)
  k.rail(-5, 43, -5, 46, 16)
  k.rail(-2, 43, -2, 46, 16)
  k.solid(-6.2, 17.75, 41.5, 0.4, 3.5, 11, wall, 'wall', true)
  k.solid(6.2, 17.75, 41.5, 0.4, 3.5, 11, wall, 'wall', true)
  k.solid(0, 17.75, 47.2, 12.8, 3.5, 0.4, wall, 'wall', true)
  const r = 5.6
  k.glass.add(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 19.5, 42), C(0x9fd6d0))
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    let p = V(Math.cos(a) * r, 19.5, 42 + Math.sin(a) * r)
    for (let j = 1; j <= 8; j++) {
      const t = (j / 8) * (Math.PI / 2)
      const q = V(Math.cos(a) * Math.cos(t) * r, 19.5 + Math.sin(t) * r, 42 + Math.sin(a) * Math.cos(t) * r)
      k.beam(p.x, p.y, p.z, q.x, q.y, q.z, 0.1, C(PAL.laiton, 1.05))
      p = q
    }
  }
  const pane = (x0: number, x1: number) => {
    k.glass.add(new THREE.PlaneGeometry(x1 - x0, 3.3), new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 17.75, 30.9), C(0x9fd6d0))
    k.cols.push({ kind: 'glass', climbable: false, x: (x0 + x1) / 2, y: 17.75, z: 30.9, hx: (x1 - x0) / 2, hy: 1.75, hz: 0.1 })
  }
  pane(-6, 3.45)
  pane(4.55, 6)
  k.glass.add(new THREE.PlaneGeometry(1.1, 1.1), new THREE.Matrix4().makeTranslation(4, 18.85, 30.9), C(0x9fd6d0))
  k.cols.push({ kind: 'glass', climbable: false, x: 4, y: 18.85, z: 30.9, hx: 0.55, hy: 0.6, hz: 0.1 })
  for (const x of [-6]) {
    const ry = new THREE.Matrix4().makeRotationY(Math.PI / 2)
    for (const sx of [x, -x]) {
      k.glass.add(new THREE.PlaneGeometry(5, 3.3), new THREE.Matrix4().makeTranslation(sx, 17.75, 33.5).multiply(ry), C(0x9fd6d0))
      k.cols.push({ kind: 'glass', climbable: false, x: sx, y: 17.75, z: 33.5, hx: 0.1, hy: 1.75, hz: 2.5 })
      k.b.box(sx, 19.45, 33.5, 0.14, 0.12, 5, C(PAL.laiton))
    }
  }
  k.b.box(0, 19.45, 30.9, 12, 0.12, 0.14, C(PAL.laiton))
  for (const x of [-6, -3, 0, 3.45, 4.55, 6]) k.b.box(x, 17.75, 30.9, 0.1, 3.4, 0.14, C(PAL.laiton))
  k.doors.push({ id: 'trappe-tyrolienne', x: 4, y: 16, z: 30.9, w: 1.0, h: 2.2, axis: 'z', style: 'hatch', open: false, lock: { item: 'poulie', act: 2 }, sign: PANNEAUX.tyrolienne })
  k.slab(3, 5, 29.4, 30.8, 16, 'grille', 0.2)
  k.rail(3, 29.4, 3, 30.8, 16)
  k.rail(5, 29.4, 5, 30.8, 16)
  zipline(k, 'tyrolienne-ecluse', V(4, 18.2, 29.4), V(30.5, 10.6, -12))
  k.ladder('dome-ecluse-hauts', 0, 44.6, 16, 27.1, 0, -1, ['dome-ecluse', 'tube-hauts'])
  k.b.cyl(0, 21.5, 45.1, 0.08, 11, C(PAL.laiton))
  k.doors.push({ id: 'trappe-hauts', x: 0, y: 27, z: 44, w: 1.6, h: 2.0, axis: 'y', style: 'hatch', open: false, lock: { act: 2 } })
  const lx = 3.5
  const lz = 43
  k.beam(lx, 16, lz, lx - 0.25, 17.2, lz, 0.05, C(PAL.boisOmbre))
  k.beam(lx, 16, lz, lx + 0.2, 17.2, lz + 0.15, 0.05, C(PAL.boisOmbre))
  k.beam(lx - 0.1, 17.25, lz + 0.5, lx + 0.15, 17.5, lz - 0.7, 0.12, C(PAL.laiton, 1.1), k.b, true)
  k.cols.push({ kind: 'prop', climbable: false, ownerId: 'lunette-dome-ecluse', x: lx, y: 16.8, z: lz, hx: 0.3, hy: 0.8, hz: 0.3 })
  k.anchors.push({ kind: 'lunette', id: 'dome-ecluse', at: { x: lx, y: 16, z: lz }, yaw: 0 })
  k.domes.push({ id: 'dome-ecluse', district: 'ecluse', x: 0, y: 25.1, z: 42, r, lunette: { x: lx, y: 16, z: lz } })
  k.lamp(-4, 18.6, 45.5, { style: 'shade', radius: 7, bake: 0.9 })
  k.lamp(4, 18.6, 38, { style: 'shade', radius: 7, bake: 0.9 })
  k.bench('banc-dome-ecluse', -3, 16, 38.4, 2.2, true, Math.PI)
  k.crates(4.6, 16, 46, 2)
  k.sign(PANNEAUX.domeEcluse, 0, 18.6, 46.95, Math.PI, 3.4, 0.6)
  k.cell({
    id: 'dome-ecluse', district: 'ecluse', deck: 'toits', nom: NOMS.domeEcluse,
    boxes: [{ x0: -6, x1: 6, y0: 15.5, y1: 25.2, z0: 31, z1: 47 }, { x0: -1, x1: 1, y0: 24, y1: 27.6, z0: 43, z1: 46 }],
    spawn: { x: -2, y: 16, z: 40, yaw: 0 }, air: 0.1, roof: 25, pvs: ['ecluse', 'nef', 'hauts'], glass: true,
  })
  k.spots.push({ district: 'ecluse', x: -1.5, y: 16, z: 32, yaw: 0, pose: 'lean' })
}

function hauts(k: Kit): void {
  const y = 27
  glassTube(k, 'x', 44, -84.2, 86.2, y, { id: 'tube-hauts', nom: NOMS.tubeHauts, district: 'hauts', deck: 'domes', pvs: ['hauts', 'marche', 'serres', 'ecluse', 'nef'] }, { u0: -0.8, u1: 0.8, d0: -1.0, d1: 1.0 })
  dome(k, 'dome-marche', 'marche', -88, y, 44, 4.2, { nom: NOMS.domeMarche, pvs: ['hauts', 'marche', 'nef'], deck: 'domes', hole: { x: -87.8, z: 46.95 }, door: 0 })
  dome(k, 'dome-serres', 'serres', 90, y, 44, 4.2, { nom: NOMS.domeSerres, pvs: ['hauts', 'serres', 'nef'], deck: 'domes', hole: { x: 90.2, z: 46.95 }, door: Math.PI })
  k.ladder('horloge-dome', -88 + 0.2, 44 + 2.95, 21, 27.1, 0, 1, ['grand-marche', 'dome-marche'])
  k.ladder('serre-tour-dome', 90 + 0.2, 44 + 2.95, 21, 27.1, 0, 1, ['serre-cathedrale', 'dome-serres'])
  k.paths.push({ district: 'hauts', pts: [{ x: -80, z: 44 }, { x: 80, z: 44 }], y, loop: false, busy: 0.15, work: false })
  for (const x of [-60, -30, 30, 60]) k.spots.push({ district: 'hauts', x, y, z: 45.1, yaw: Math.PI, pose: 'lean' })
}

function gangways(kits: Map<DistrictId, Kit>, links: Kit): void {
  const K = (d: DistrictId) => kits.get(d)!
  gangway(links, 'x', 20, -72, -36, 0, { id: 'passerelle-marche', nom: NOMS.passerelleMarche, district: 'marche', deck: 'principal', pvs: ['marche', 'nef'], ends: ['marche', 'nef'] })
  gangway(links, 'x', 20, 36, 72, 0, { id: 'passerelle-serres', nom: NOMS.passerelleSerres, district: 'serres', deck: 'principal', pvs: ['serres', 'nef'], wall: PAL.vertDoux, ends: ['nef', 'serres'] })
  gangway(links, 'x', -28, -52, -36, 0, { id: 'passerelle-ateliers', nom: NOMS.passerelleAteliers, district: 'ateliers', deck: 'principal', pvs: ['ateliers', 'nef'], ends: ['ateliers', 'nef'] })
  gangway(links, 'x', -28, 36, 52, 0, { id: 'passerelle-scellees', nom: NOMS.passerelleScellees, district: 'scellees', deck: 'principal', pvs: ['scellees', 'nef'], wall: PAL.teal, ends: ['nef', 'scellees'] })
  gangway(links, 'z', 0, -50, -36, 8, { id: 'passerelle-proue', nom: NOMS.passerelleProue, district: 'proue', deck: 'haut', pvs: ['proue', 'nef'], wall: PAL.creme, ends: ['proue', 'nef'] })
  gangway(links, 'z', -88, -18, -6, 0, { id: 'passerelle-marche-ateliers', nom: NOMS.passerelleMarcheAteliers, district: 'ateliers', deck: 'principal', pvs: ['ateliers', 'marche'], ends: ['ateliers', 'marche'] })
  gangway(links, 'z', 90, -18, -6, 0, { id: 'passerelle-serres-scellees', nom: NOMS.passerelleSerresScellees, district: 'scellees', deck: 'principal', pvs: ['scellees', 'serres'], wall: PAL.teal, ends: ['scellees', 'serres'] })
  gangway(links, 'x', 60.75, -72, -40, 0, { id: 'passerelle-petit-marche', nom: NOMS.passerellePetitMarche, district: 'marche', deck: 'principal', pvs: ['marche', 'ecluse'], ends: ['marche', 'ecluse'] })
  shrine(K('ecluse'), { id: 'cs-01', num: 1, x: 20, y: -6, z: 36.3, nx: 0, nz: 1, district: 'ecluse', deck: 'bas', pvs: ['ecluse', 'nef'] })
  shrine(K('nef'), { id: 'cs-05', num: 5, x: -20, y: -6, z: -36.3, nx: 0, nz: -1, district: 'nef', deck: 'bas', pvs: ['nef'] })
}

function trouvailles(kits: Map<DistrictId, Kit>): void {
  const spots: [DistrictId, number, number, number][] = [
    ['nef', 0, 27.4, 3.2], ['nef', -33, 16.2, -33], ['nef', 33, 0.2, 33], ['nef', -12, -5.8, 30], ['nef', 25, 8.2, -31],
    ['nef', -31, -5.8, -4], ['nef', 4.8, 16.2, 0.5], ['nef', -3, -13.9, 6], ['nef', 31, 16.2, 31], ['nef', -20, 0.2, -33],
    ['machines', 9, -21.8, -5], ['machines', -6, -13.8, 9.5], ['machines', 0.5, -26, 10], ['machines', -9, -21.8, 6],
    ['marche', -88, 21.2, 45], ['marche', -101, 13.2, 66], ['marche', -75, 6.7, 2], ['marche', -91.6, 3.05, 30], ['marche', -84.4, 3.05, 61],
    ['marche', -101, 0.2, 70], ['marche', -75, 13.2, 30], ['marche', -96, 6.7, 58],
    ['serres', 90, 21.2, 45], ['serres', 82, 0.75, 30], ['serres', 105, 7.2, 68], ['serres', 75, 7.2, 3], ['serres', 98, 0.75, 60],
    ['serres', 86, 6.5, 12], ['serres', 105, 0.2, -3],
    ['ateliers', -112, 14.2, -33], ['ateliers', -121, 0.2, -20], ['ateliers', -60, 1.7, -32], ['ateliers', -105, 6.7, -32],
    ['ateliers', -55, 6.7, -44], ['ateliers', -118, 3.3, -38], ['ateliers', -88, 0.2, -10],
    ['scellees', 120, 0.2, -44], ['scellees', 112, 14.2, -33], ['scellees', 75, 6.7, -32], ['scellees', 58, 6.7, -20],
    ['scellees', 100, 0.2, -20], ['scellees', 90, 0.2, -12],
    ['proue', -9, 16.2, -71], ['proue', 9, 8.2, -51], ['proue', 0, 8.2, -71],
    ['ecluse', -3.5, 0.2, 43.4], ['ecluse', 5.4, 16.2, 46.4], ['ecluse', 4, 16.2, 29.8], ['ecluse', -4.5, 16.2, 31.5],
    ['hauts', -40, 27.2, 44.9], ['hauts', 44, 27.2, 43.1], ['hauts', -86, 27.2, 41], ['hauts', 92, 27.2, 46],
    ['nef', 0, 32.4, -2.5], ['ateliers', -112, 19.8, -30], ['scellees', 112, 19.8, -34],
    ['marche', -60, 0.2, 60], ['serres', 60, 0.2, 19.1], ['proue', 0, 8.2, -43], ['nef', -44, 0.2, -28],
  ]
  spots.forEach(([d, x, y, z], i) => kits.get(d)!.trouvaille(`tr-${String(i + 1).padStart(2, '0')}`, x, y, z))
}
