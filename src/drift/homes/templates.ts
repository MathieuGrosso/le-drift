import type { PropModel } from '../city/kit'
import { PAL } from '../palette'
import type { TemplateId } from './text'

export type FurnKind =
  | 'lit' | 'hamac' | 'table' | 'etagere' | 'coffre' | 'poele' | 'etabli' | 'comptoir' | 'caisses'
  | 'tapis' | 'cadre' | 'filet' | 'jouets' | 'theiere' | 'bouee' | 'poissons' | 'coussins'

export interface Furn { kind: FurnKind; u: number; d: number; y: number; su: number; sd: number; sh: number; color: number; solid: boolean }
export interface HomeProp { model: PropModel; u: number; d: number; y: number; yaw: number }
export interface Room { u0: number; u1: number; du: number; d0: number; d1: number; floor: number; height: number }
export type OwnerPose = 'stand' | 'sit' | 'work'
export interface HomeLayout {
  wall: number
  wainscot: number
  floor: number
  lamp: number
  furn: Furn[]
  props: HomeProp[]
  owner: { u: number; d: number; pose: OwnerPose; faceDoor: boolean }
  porthole: number
}

interface Recipe {
  wall: readonly number[]
  floor: readonly number[]
  lamp: number
  left: FurnKind
  back: readonly FurnKind[]
  right: FurnKind
  extras: readonly FurnKind[]
  props: readonly PropModel[]
  owner: OwnerPose
}

const RECIPES: Record<TemplateId, Recipe> = {
  famille: { wall: [PAL.creme, 0xe8d4b0], floor: [PAL.bois], lamp: PAL.lampe, left: 'lit', back: ['poele', 'etagere'], right: 'table', extras: ['tapis', 'cadre', 'coussins'], props: ['chaise', 'chaise-ronde', 'plante-pot', 'livres'], owner: 'stand' },
  cabine: { wall: [PAL.platre, 0xd9cdb6], floor: [0x9a6b4d], lamp: PAL.lampe, left: 'hamac', back: ['coffre'], right: 'etagere', extras: ['tapis', 'cadre'], props: ['radio', 'plante-2', 'tabouret'], owner: 'sit' },
  atelier: { wall: [0xc9c2b0, PAL.bleuDoux], floor: [PAL.metal], lamp: PAL.lampeChaude, left: 'etabli', back: ['caisses', 'etagere'], right: 'etabli', extras: ['filet'], props: ['tabouret', 'lampe', 'radio'], owner: 'work' },
  echoppe: { wall: [PAL.creme, 0xe9d8b8], floor: [PAL.bois], lamp: PAL.lampe, left: 'comptoir', back: ['etagere', 'caisses'], right: 'etagere', extras: ['poissons', 'tapis'], props: ['plante-1', 'livres', 'tabouret'], owner: 'stand' },
  'salon-the': { wall: [0xe6d2c0, PAL.creme], floor: [PAL.bois], lamp: PAL.lampeChaude, left: 'coussins', back: ['theiere', 'etagere'], right: 'table', extras: ['tapis', 'cadre'], props: ['chaise-ronde', 'plante-pot', 'plante-3', 'lampe'], owner: 'sit' },
  'chambre-enfants': { wall: [0xd9e4d2, 0xf0dcc0], floor: [PAL.bois], lamp: PAL.lampe, left: 'lit', back: ['jouets', 'coffre'], right: 'lit', extras: ['tapis', 'bouee'], props: ['livres', 'plante-2'], owner: 'stand' },
  'vieux-marin': { wall: [0xcbb89a, PAL.platre], floor: [0x8a5e44], lamp: PAL.lampeChaude, left: 'hamac', back: ['coffre', 'etagere'], right: 'table', extras: ['filet', 'bouee', 'cadre'], props: ['radio', 'chaise', 'livres'], owner: 'sit' },
}

const SIZE: Record<FurnKind, { su: number; sd: number; sh: number; solid: boolean }> = {
  lit: { su: 1.9, sd: 0.95, sh: 0.5, solid: true },
  hamac: { su: 2.0, sd: 0.8, sh: 0.9, solid: false },
  table: { su: 1.1, sd: 0.75, sh: 0.74, solid: true },
  etagere: { su: 1.2, sd: 0.35, sh: 1.9, solid: true },
  coffre: { su: 0.9, sd: 0.5, sh: 0.5, solid: true },
  poele: { su: 0.7, sd: 0.6, sh: 0.9, solid: true },
  etabli: { su: 1.6, sd: 0.7, sh: 0.88, solid: true },
  comptoir: { su: 1.8, sd: 0.6, sh: 1.0, solid: true },
  caisses: { su: 1.0, sd: 0.6, sh: 0.9, solid: true },
  tapis: { su: 2.0, sd: 1.2, sh: 0.02, solid: false },
  cadre: { su: 0.6, sd: 0.04, sh: 0.45, solid: false },
  filet: { su: 1.6, sd: 0.06, sh: 1.0, solid: false },
  jouets: { su: 0.8, sd: 0.5, sh: 0.35, solid: false },
  theiere: { su: 0.9, sd: 0.5, sh: 0.85, solid: true },
  bouee: { su: 0.7, sd: 0.1, sh: 0.7, solid: false },
  poissons: { su: 1.4, sd: 0.1, sh: 0.6, solid: false },
  coussins: { su: 1.6, sd: 0.9, sh: 0.35, solid: false },
}

const ACCENTS = [PAL.tissu1, PAL.tissu2, PAL.tissu3, PAL.teal, PAL.vertDoux, 0xc9a15a] as const
const HUNG: ReadonlySet<FurnKind> = new Set(['cadre', 'filet', 'bouee', 'poissons'])

export function layoutHome(tpl: TemplateId, room: Room, rand: () => number): HomeLayout {
  const r = RECIPES[tpl]
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]!
  const furn: Furn[] = []
  const place = (kind: FurnKind, u: number, d: number, y = room.floor) => {
    const s = SIZE[kind]
    furn.push({ kind, u, d, y, ...s, color: kind === 'tapis' || kind === 'coussins' || kind === 'lit' ? pick(ACCENTS) : PAL.bois })
  }
  const L = room.u1 - room.u0
  const mid = (room.d0 + room.d1) / 2
  const endU = (kind: FurnKind, left: boolean) => (left ? room.u0 + SIZE[kind].su / 2 + 0.1 : room.u1 - SIZE[kind].su / 2 - 0.1)
  const backD = (kind: FurnKind) => room.d0 + SIZE[kind].sd / 2 + 0.06
  place(r.left, endU(r.left, true), backD(r.left))
  place(r.right, endU(r.right, false), r.right === 'table' ? mid : backD(r.right))
  const span0 = room.u0 + SIZE[r.left].su + 0.4
  const span1 = room.u1 - SIZE[r.right].su - 0.4
  r.back.forEach((kind, i) => {
    const t = (i + 0.5) / r.back.length
    const u = span0 + (span1 - span0) * t
    if (span1 - span0 > SIZE[kind].su) place(kind, u, backD(kind))
  })
  for (const kind of r.extras) {
    if (kind === 'tapis' || kind === 'coussins') place(kind, room.du, mid)
    else if (HUNG.has(kind)) place(kind, room.u0 + L * (0.25 + rand() * 0.5), room.d0 + 0.04, room.floor + 1.45)
  }
  const props: HomeProp[] = r.props.map((model, i) => {
    const t = (i + 0.5) / r.props.length
    const table = furn.find((f) => f.kind === 'table')
    if (table && (model === 'chaise' || model === 'chaise-ronde')) return { model, u: table.u - 0.75, d: table.d, y: room.floor, yaw: Math.PI / 2 }
    if (table && (model === 'livres' || model === 'lampe' || model === 'radio')) return { model, u: table.u + (rand() - 0.5) * 0.5, d: table.d, y: room.floor + table.sh, yaw: rand() * Math.PI * 2 }
    return { model, u: room.u0 + 0.5 + (L - 1) * t, d: room.d1 - 0.35, y: room.floor, yaw: rand() * Math.PI * 2 }
  })
  const seat = r.owner === 'sit' ? furn.find((f) => f.kind === 'table' || f.kind === 'coussins' || f.kind === 'hamac') : null
  const bench = r.owner === 'work' ? furn.find((f) => f.kind === 'etabli') : null
  const owner = seat
    ? { u: seat.u + (seat.kind === 'table' ? 0.75 : 0), d: seat.kind === 'table' ? seat.d : mid, pose: 'sit' as const, faceDoor: true }
    : bench
      ? { u: bench.u, d: bench.d + 0.65, pose: 'work' as const, faceDoor: false }
      : { u: room.du + (room.du - room.u0 > room.u1 - room.du ? -1.4 : 1.4), d: mid, pose: 'stand' as const, faceDoor: true }
  return {
    wall: pick(r.wall), wainscot: PAL.boisOmbre, floor: pick(r.floor), lamp: r.lamp, furn, props, owner,
    porthole: room.u0 + L * (0.35 + rand() * 0.3),
  }
}
