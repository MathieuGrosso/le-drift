import * as THREE from 'three'
import type { DeckId, DistrictId, HomeRequest } from '../../core/types'
import { HOMES } from '../../core/tuning'
import { seededRng } from '../../core/rng'
import { PAL } from '../palette'
import { C, type Kit } from '../city/kit'
import type { Role } from '../people'
import { layoutHome, type HomeLayout, type Room } from './templates'
import { DEMANDES, FAMILLES, MOTS, NOM_TEMPLATE, PAROLES, PRENOMS, ROLE_TEMPLATE, type TemplateId } from './text'

const TEMPLATES: readonly TemplateId[] = ['famille', 'cabine', 'atelier', 'echoppe', 'salon-the', 'chambre-enfants', 'vieux-marin']

export interface WallFrame { along: boolean; plane: number; inX: number; inZ: number }

export interface DoorSlot {
  hull: number
  frame: WallFrame
  u: number
  floor: number
  reachable: boolean
  hullU0: number
  hullU1: number
  cy: number
  hh: number
  w: number
}

export interface HomeDef {
  id: string
  district: DistrictId
  frame: WallFrame
  room: Room
  doorD: number
  // Outer face of the door reveal, where the leaf hangs so it shows even before the hull is cut open.
  doorOuter: number
  template: TemplateId
  nom: string
  owner: string | null
  role: Role
  lines: readonly string[]
  request: HomeRequest | null
  layout: HomeLayout
}

export interface ClosedDoor { id: string; note: string | null }

export function framePoint(f: WallFrame, u: number, y: number, d: number, out = new THREE.Vector3()): THREE.Vector3 {
  return f.along ? out.set(u, y, f.plane + f.inZ * d) : out.set(f.plane + f.inX * d, y, u)
}

export function frameSize(f: WallFrame, su: number, sd: number): { sx: number; sz: number } {
  return f.along ? { sx: su, sz: sd } : { sx: sd, sz: su }
}

export function faceDepth(s: Pick<DoorSlot, 'cy' | 'hh' | 'w'>, y: number): number {
  const r = (y - s.cy) / (s.hh / 2)
  return (s.w / 2) * Math.sqrt(Math.max(0, 1 - r * r))
}

const _p = new THREE.Vector3()

function solid(k: Kit, f: WallFrame, u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, kind: 'hull' | 'wall' | 'floor', owner?: string): void {
  if (u1 - u0 < 0.02 || y1 - y0 < 0.02 || d1 - d0 < 0.02) return
  framePoint(f, (u0 + u1) / 2, (y0 + y1) / 2, (d0 + d1) / 2, _p)
  const { sx, sz } = frameSize(f, u1 - u0, d1 - d0)
  k.col({ kind, climbable: kind === 'hull', x: _p.x, y: _p.y, z: _p.z, hx: sx / 2, hy: (y1 - y0) / 2, hz: sz / 2, ...(owner ? { ownerId: owner } : {}) })
}

function bakeBox(k: Kit, f: WallFrame, u: number, y: number, d: number, su: number, sy: number, sd: number, color: THREE.Color, emissive = false): void {
  framePoint(f, u, y, d, _p)
  const { sx, sz } = frameSize(f, su, sd)
  ;(emissive ? k.e : k.b).box(_p.x, _p.y, _p.z, sx, sy, sz, color)
}

function hollowHull(k: Kit, s: DoorSlot, room: Room): void {
  const f = s.frame
  const bottom = s.cy - s.hh / 2
  const top = s.cy + s.hh / 2
  const reach = s.w / 2
  const half = HOMES.doorW / 2
  const ceil = room.floor + room.height
  const hc = (s.hullU0 + s.hullU1) / 2
  const hl = (s.hullU1 - s.hullU0) * 0.45
  solid(k, f, hc - hl, room.u0, bottom, top, 0, reach, 'hull')
  solid(k, f, room.u1, hc + hl, bottom, top, 0, reach, 'hull')
  solid(k, f, room.u0, room.u1, bottom, room.floor, 0, reach, 'floor')
  solid(k, f, room.u0, room.u1, ceil, top, 0, reach, 'hull')
  solid(k, f, room.u0, room.u1, room.floor, ceil, 0, room.d0, 'wall')
  solid(k, f, room.u0, room.du - half, room.floor, ceil, room.d1, reach, 'hull')
  solid(k, f, room.du + half, room.u1, room.floor, ceil, room.d1, reach, 'hull')
  solid(k, f, room.du - half, room.du + half, room.floor + HOMES.doorH, ceil, room.d1, reach, 'hull')
}

function revealOuter(s: DoorSlot, room: Room): number {
  return faceDepth(s, room.floor + HOMES.doorH / 2) + 0.06
}

function reveal(k: Kit, s: DoorSlot, room: Room): void {
  const f = s.frame
  const half = HOMES.doorW / 2
  const t = HOMES.wallT
  const outer = revealOuter(s, room)
  const depth = outer - room.d1
  const dc = (outer + room.d1) / 2
  const trim = C(PAL.laiton, 0.9)
  for (const side of [-1, 1]) bakeBox(k, f, room.du + side * (half + t / 2), room.floor + HOMES.doorH / 2, dc, t, HOMES.doorH, depth, trim)
  bakeBox(k, f, room.du, room.floor + HOMES.doorH + t / 2, dc, HOMES.doorW + 2 * t, t, depth, trim)
  bakeBox(k, f, room.du, room.floor + 0.01, dc, HOMES.doorW, 0.02, depth, C(PAL.boisOmbre, 1.1))
}

function closedDoor(k: Kit, s: DoorSlot, id: string, rand: () => number): ClosedDoor {
  const f = s.frame
  const y = s.floor + 1.0
  const d = faceDepth(s, y) + 0.03
  bakeBox(k, f, s.u, y, d, 1.3, 2.25, 0.1, C(PAL.laiton, 0.9))
  const paint = [PAL.teal, PAL.tissu3, PAL.rouille, PAL.vertDoux, PAL.tissu1][Math.floor(rand() * 5)]!
  bakeBox(k, f, s.u, y - 0.05, d + 0.02, 1.05, 1.95, 0.1, C(paint, 0.95))
  const note = s.reachable && rand() < HOMES.noteChance ? MOTS[Math.floor(rand() * MOTS.length)]! : null
  if (note) {
    bakeBox(k, f, s.u + 0.18, y + 0.35, d + 0.09, 0.42, 0.3, 0.02, C(PAL.toile, 1.05), true)
    for (let i = 0; i < 3; i++) bakeBox(k, f, s.u + 0.16, y + 0.42 - i * 0.07, d + 0.1, 0.3 - i * 0.06, 0.018, 0.02, C(PAL.boisOmbre))
    solid(k, f, s.u - 0.55, s.u + 0.55, s.floor + 0.1, s.floor + 2.0, d - 0.05, d + 0.12, 'wall', `mot-${id}`)
  }
  return { id, note }
}

function pickOpen(slots: readonly DoorSlot[], want: number, rand: () => number): Set<number> {
  const byHull = new Map<number, number>()
  slots.forEach((s, i) => {
    if (s.reachable && !byHull.has(s.hull) && s.hh >= HOMES.heightMin + 0.6) byHull.set(s.hull, i)
  })
  const pool = [...byHull.values()]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return new Set(pool.slice(0, want))
}

export function bakeHomes(k: Kit, hall: { id: string; district: DistrictId; deck: DeckId; pvs: DistrictId[] }, slots: readonly DoorSlot[]): { homes: HomeDef[]; closed: ClosedDoor[]; hollow: Set<number> } {
  const rand = seededRng(`maisons:${hall.id}`)
  const open = pickOpen(slots, HOMES.open[hall.district] ?? 0, rand)
  const homes: HomeDef[] = []
  const closed: ClosedDoor[] = []
  const hollow = new Set<number>()
  slots.forEach((s, i) => {
    const id = `maison-${hall.id}-${i}`
    if (!open.has(i)) {
      closed.push(closedDoor(k, s, id, rand))
      return
    }
    const height = THREE.MathUtils.clamp(s.hh * 0.8 - 0.35, HOMES.heightMin, HOMES.heightMax)
    const d1 = Math.min(faceDepth(s, s.floor), faceDepth(s, s.floor + height)) - HOMES.frontPad
    const u0 = Math.max(s.hullU0 + HOMES.endPad, s.u - HOMES.halfLen)
    const u1 = Math.min(s.hullU1 - HOMES.endPad, s.u + HOMES.halfLen)
    const room: Room = { u0, u1, du: s.u, d0: HOMES.backD, d1, floor: s.floor, height }
    const hr = seededRng(id)
    const template = TEMPLATES[Math.floor(hr() * TEMPLATES.length)]!
    const famille = FAMILLES[Math.floor(hr() * FAMILLES.length)]!
    const prenom = PRENOMS[Math.floor(hr() * PRENOMS.length)]!
    const inhabited = hr() < 0.8
    const paroles = PAROLES[template]
    const home: HomeDef = {
      id, district: hall.district, frame: s.frame, room, doorD: d1, doorOuter: revealOuter(s, room), template,
      nom: NOM_TEMPLATE[template](famille, prenom),
      owner: inhabited ? (template === 'famille' || template === 'echoppe' || template === 'chambre-enfants' ? `${prenom} ${famille}` : prenom) : null,
      role: ROLE_TEMPLATE[template],
      lines: paroles[Math.floor(hr() * paroles.length)]!,
      request: inhabited && hr() < 0.45 ? DEMANDES[Math.floor(hr() * DEMANDES.length)]! : null,
      layout: layoutHome(template, room, hr),
    }
    hollow.add(s.hull)
    hollowHull(k, s, room)
    reveal(k, s, room)
    for (const fu of home.layout.furn) {
      if (fu.solid) solid(k, s.frame, fu.u - fu.su / 2, fu.u + fu.su / 2, fu.y, fu.y + fu.sh, fu.d - fu.sd / 2, fu.d + fu.sd / 2, 'wall')
    }
    if (home.owner) {
      const o = home.layout.owner
      solid(k, s.frame, o.u - 0.22, o.u + 0.22, room.floor, room.floor + 1.6, o.d - 0.22, o.d + 0.22, 'wall', `habitant-${id}`)
    }
    const a = framePoint(s.frame, u0, room.floor - 0.6, HOMES.backD - 0.2)
    const b = framePoint(s.frame, u1, room.floor + height, d1 + 0.02)
    k.cell({
      id, district: hall.district, deck: hall.deck, nom: home.nom,
      boxes: [{ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: a.y, y1: b.y, z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }],
      spawn: { ...framePoint(s.frame, s.u, room.floor + 0.05, (HOMES.backD + d1) / 2), yaw: 0 },
      air: 0, roof: room.floor + height, pvs: hall.pvs,
    })
    homes.push(home)
  })
  return { homes, closed, hollow }
}
