import type { ColliderKind, Vec3 } from '../../core/types'
import type { Anchor } from '../../drift/procgen-hook'
import type { Box, ColliderSpec, Spot } from '../types'
import type { MicroDefi } from './tuning'

export type DefiMat = 'bois' | 'metal' | 'accent' | 'tissu' | 'corde' | 'sombre'

// Local frame: origin on the floor, +z towards the path, y up. Sizes are full; a ring faces z (size.x diameter).
export interface DefiPart {
  shape: 'box' | 'cyl' | 'ring'
  at: Vec3
  size: Vec3
  mat: DefiMat
  solid: ColliderKind | null
  climbable: boolean
}

interface DefiRecipe {
  minH: number
  build(h: number): { parts: DefiPart[]; ladders: { x: number; z: number; top: number; nz: number }[]; prize: Vec3; lamp?: Vec3 }
}

const part = (shape: DefiPart['shape'], x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: DefiMat, solid: ColliderKind | null = 'prop', climbable = true): DefiPart =>
  ({ shape, at: { x, y, z }, size: { x: sx, y: sy, z: sz }, mat, solid, climbable })

const RECIPES: Readonly<Record<MicroDefi, DefiRecipe>> = {
  'sur-une-lampe': {
    minH: 3,
    build: (h) => {
      const top = Math.min(3.6, h)
      return {
        parts: [
          part('cyl', 0, top / 2, -0.6, 0.22, top, 0.22, 'metal'),
          part('box', 0, top + 0.06, -0.6, 1.1, 0.12, 1.1, 'metal'),
          part('box', 0, 0.12, -0.6, 0.7, 0.24, 0.7, 'sombre'),
        ],
        ladders: [{ x: 0, z: -0.42, top, nz: 1 }],
        prize: { x: 0, y: top + 0.35, z: -0.6 },
        lamp: { x: 0, y: top - 0.35, z: -0.6 },
      }
    },
  },
  'au-bout-d-une-poutre': {
    minH: 3.4,
    build: (h) => {
      const y = Math.min(3.8, h - 0.4)
      return {
        parts: [
          part('box', -2.2, y / 2, -1, 0.3, y, 0.3, 'bois'),
          part('box', 0.4, y + 0.1, -1, 5.6, 0.2, 0.34, 'bois', 'prop', false),
          part('box', 2.9, y - 0.5, -1, 0.12, 1, 0.12, 'corde', null),
          part('box', -2.2, y + 0.25, -1, 0.9, 0.1, 0.9, 'bois'),
        ],
        ladders: [{ x: -2.2, z: -0.83, top: y, nz: 1 }],
        prize: { x: 3, y: y + 0.4, z: -1 },
      }
    },
  },
  'en-haut-d-un-filet': {
    minH: 3.2,
    build: (h) => {
      const y = Math.min(3.6, h - 0.5)
      return {
        parts: [
          part('box', -1.1, y / 2, -1.2, 0.14, y, 0.14, 'bois'),
          part('box', 1.1, y / 2, -1.2, 0.14, y, 0.14, 'bois'),
          part('box', 0, y / 2, -1.12, 2.1, y, 0.06, 'corde', 'net', true),
          part('box', 0, y + 0.05, -1.7, 2.4, 0.1, 1.1, 'bois'),
        ],
        ladders: [],
        prize: { x: 0, y: y + 0.4, z: -1.8 },
      }
    },
  },
  'dans-un-tuyau': {
    minH: 2.4,
    build: () => ({
      parts: [
        part('box', -0.9, 1.05, -1.6, 0.16, 2.1, 3.6, 'metal', 'pipe', false),
        part('box', 0.9, 1.05, -1.6, 0.16, 2.1, 3.6, 'metal', 'pipe', false),
        part('box', 0, 2.15, -1.6, 1.96, 0.16, 3.6, 'metal', 'pipe', true),
        part('ring', 0, 1.05, 0.15, 2.3, 0.18, 0, 'accent', null),
        part('ring', 0, 1.05, -3.35, 2.3, 0.18, 0, 'accent', null),
      ],
      ladders: [],
      prize: { x: 0, y: 0.35, z: -2.2 },
    }),
  },
  'derriere-une-trappe': {
    minH: 2.6,
    build: () => ({
      parts: [
        part('box', 0, 0.75, -1.2, 2.2, 1.5, 1.6, 'bois'),
        part('box', 0, 1.6, -0.4, 1, 0.08, 0.7, 'accent', null),
        part('box', 0, 1.9, -1.7, 1.2, 0.8, 0.6, 'bois'),
      ],
      ladders: [],
      prize: { x: 0.5, y: 1.85, z: -1 },
    }),
  },
  'sous-une-passerelle': {
    minH: 2.6,
    build: () => ({
      parts: [
        part('box', 0, 1.7, -1.4, 4.2, 0.16, 1.4, 'bois', 'floor', false),
        ...[-1.95, 1.95].flatMap((x) => [part('box', x, 0.85, -0.8, 0.16, 1.7, 0.16, 'bois'), part('box', x, 0.85, -2, 0.16, 1.7, 0.16, 'bois')]),
        part('box', 0, 0.06, -1.4, 1.2, 0.12, 0.9, 'tissu', null),
      ],
      ladders: [{ x: 1.95, z: -0.65, top: 1.7, nz: 1 }],
      prize: { x: 0, y: 0.45, z: -1.5 },
    }),
  },
  'dans-un-nid-de-chat': {
    minH: 3,
    build: () => ({
      parts: [
        part('box', 0.9, 0.35, -0.9, 1, 0.7, 1, 'bois'),
        part('box', 0, 0.7, -1.7, 1, 1.4, 1, 'bois'),
        part('box', -0.9, 1.05, -2.5, 1, 2.1, 1, 'bois'),
        part('cyl', -0.9, 2.25, -2.5, 0.8, 0.3, 0.8, 'corde', null),
      ],
      ladders: [],
      prize: { x: -0.9, y: 2.55, z: -2.5 },
    }),
  },
}

export interface DefiPlaced {
  defi: MicroDefi
  at: Spot
  parts: readonly DefiPart[]
  prize: Spot
  lampLocal: Vec3 | null
  colliders: readonly ColliderSpec[]
  anchors: readonly Anchor[]
  bounds: Box
}

function toWorld(s: Spot, x: number, y: number, z: number): Vec3 {
  const c = Math.cos(s.yaw)
  const n = Math.sin(s.yaw)
  return { x: s.x + x * c + z * n, y: s.y + y, z: s.z - x * n + z * c }
}

export function defiFits(defi: MicroDefi, headroom: number): boolean {
  return headroom >= RECIPES[defi].minH
}

const FOOTPRINT = [[-2.5, 0.3], [3.2, 0.3], [-2.5, -3.6], [3.2, -3.6]] as const

export function defiCorners(at: Spot): Vec3[] {
  return FOOTPRINT.map(([x, z]) => toWorld(at, x, 0, z))
}

export function placeDefi(id: string, defi: MicroDefi, at: Spot, headroom: number): DefiPlaced {
  const r = RECIPES[defi].build(headroom)
  const q = [0, Math.sin(at.yaw / 2), 0, Math.cos(at.yaw / 2)] as const
  const colliders: ColliderSpec[] = r.parts
    .filter((p) => p.solid !== null)
    .map((p) => {
      const w = toWorld(at, p.at.x, p.at.y, p.at.z)
      return { kind: p.solid!, climbable: p.climbable, ownerId: id, x: w.x, y: w.y, z: w.z, hx: p.size.x / 2, hy: p.size.y / 2, hz: p.size.z / 2, q }
    })
  const normal = toWorld({ ...at, x: 0, y: 0, z: 0 }, 0, 0, 1)
  const anchors: Anchor[] = r.ladders.map((l, i) => {
    const bottom = toWorld(at, l.x, 0, l.z)
    return { kind: 'ladder', id: `${id}/echelle-${i}`, bottom, top: { ...bottom, y: at.y + l.top }, normal: { x: normal.x * l.nz, y: 0, z: normal.z * l.nz } }
  })
  const corners = defiCorners(at)
  const prize = toWorld(at, r.prize.x, r.prize.y, r.prize.z)
  return {
    defi, at, parts: r.parts, prize: { ...prize, yaw: at.yaw },
    lampLocal: r.lamp ?? null,
    colliders, anchors,
    bounds: {
      x0: Math.min(...corners.map((c) => c.x)), x1: Math.max(...corners.map((c) => c.x)),
      y0: at.y, y1: Math.max(prize.y + 0.5, at.y + 2.4),
      z0: Math.min(...corners.map((c) => c.z)), z1: Math.max(...corners.map((c) => c.z)),
    },
  }
}
