import { SURF } from '../../drift/surface'
import type { ArchetypeId } from '../types'

type Pat = (typeof SURF)[keyof typeof SURF]

// What a district owns on screen: the ground you walk, the lower wall beside you, the lamp light, the metal.
export interface Look {
  floor: readonly [main: number, alt: number]
  floorPat: Pat
  wall: readonly [low: number, band: number]
  wallPat: Pat
  rail: number
  metal: number
  shade: number
  lamp: number
}

const L = (floor: Look['floor'], floorPat: Pat, wall: Look['wall'], wallPat: Pat, rail: number, metal: number, shade: number, lamp = 0xffc27a): Look =>
  ({ floor, floorPat, wall, wallPat, rail, metal, shade, lamp })

export const LOOKS: Readonly<Record<ArchetypeId, Look>> = {
  observatoires: L([0x56708c, 0xc9a46a], SURF.tiles, [0xb8913f, 0x8fb4cc], SURF.steel, 0xe0c27a, 0xc9a46a, 0xd9b48f, 0xffd9a0),
  corderie: L([0xd2ad6e, 0x8a6a44], SURF.planksX, [0x4a3a30, 0xe0a24a], SURF.boards, 0xc9a66b, 0x9a5a3a, 0xc98a5a),
  lavoirs: L([0xe8eef0, 0x7aaac4], SURF.tiles, [0x9cc4d8, 0xf6efe0], SURF.tiles, 0xc98a5a, 0xc98a5a, 0xf1e4c8),
  sechoirs: L([0xc8ccc4, 0x8aa0a8], SURF.boards, [0xeef0ea, 0x6cbab2], SURF.plaster, 0x7f98a8, 0xb8c4c8, 0xf1e4c8),
  bazar: L([0xb8443a, 0xe0b04a], SURF.fabric, [0xe0b04a, 0x6e8fb0], SURF.planksX, 0xd8644e, 0xd9b48f, 0xe0b04a, 0xff9e5e),
  fourneaux: L([0xe07a3a, 0x9a3a2a], SURF.tiles, [0xd8643a, 0xf1d2a8], SURF.stone, 0xc98a5a, 0xc98a5a, 0xe8674a, 0xff9e5e),
  forges: L([0x4a4648, 0x6a3a2a], SURF.steel, [0x5a4038, 0xe08a4e], SURF.stone, 0x3e3a4a, 0x6a5a5e, 0x52576a, 0xffa860),
  dortoirs: L([0xd89a70, 0x6e8fb0], SURF.fabric, [0xe8c8a8, 0x6e8fb0], SURF.plaster, 0xb07a4f, 0xd9b48f, 0xf2c6a0),
  noye: L([0x5a7068, 0x3e4e48], SURF.stone, [0x7c9a8a, 0x4f6d5a], SURF.plaster, 0x5e6a4a, 0x6a7a6a, 0xc9a66b, 0xffb870),
  quais: L([0x8a8070, 0xe0b04a], SURF.steel, [0xc0583a, 0xefe3c4], SURF.steel, 0xe0b04a, 0x8a8f99, 0xe8674a),
  citernes: L([0x5f7a80, 0x3e4a50], SURF.steel, [0x6f8a8a, 0xc46a4a], SURF.steel, 0xc46a4a, 0x6f8a8a, 0xc98a5a),
  chapelle: L([0xdccba8, 0x8a7a5a], SURF.stone, [0xefe3c4, 0x3e4a7a], SURF.plaster, 0xd9b48f, 0xd9b48f, 0xe0c27a),
  laminaires: L([0x9aa858, 0xd8b04a], SURF.planksZ, [0x5f7a34, 0xd8b04a], SURF.boards, 0xd8b04a, 0xc9a44a, 0xd8b04a, 0xffd08a),
  nurserie: L([0xf2c6a0, 0xa9c8d8], SURF.fabric, [0xf6dcc8, 0xe8674a], SURF.plaster, 0xe0b04a, 0xd9b48f, 0xf2c6a0),
  potagers: L([0x7a5a3c, 0x8fbf6a], SURF.planksX, [0x7aa060, 0xefe3c4], SURF.boards, 0xc98a5a, 0xc98a5a, 0x8fbf6a),
  bibliotheque: L([0x6a4a34, 0x8a2a2a], SURF.planksX, [0x3e5a46, 0xd9b48f], SURF.boards, 0xd9b48f, 0xd9b48f, 0x3f6a4e, 0xffd9a0),
  theatre: L([0x8a2a3a, 0xe0b04a], SURF.fabric, [0x5a2a3a, 0xe0b04a], SURF.fabric, 0xe0b04a, 0xd9b48f, 0x8a2a3a, 0xff9e5e),
  viviers: L([0x5aa8a0, 0xd8eee8], SURF.tiles, [0xd8eee8, 0x3e8a88], SURF.tiles, 0xc98a5a, 0xc98a5a, 0xefe3c4),
  cathedrale: L([0x7a6a5a, 0x4a3e38], SURF.steel, [0xc07a4a, 0x52576a], SURF.steel, 0xd9b48f, 0xc07a4a, 0xc98a5a, 0xffa860),
}
