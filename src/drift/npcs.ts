import * as THREE from 'three'
import { NPC_LOD } from '../core/tuning'
import type { GameContext } from '../core/types'
import type { EmoteId, NpcOrderView, NpcPlace } from '../shared/protocol'
import { PORTHOLES } from './interiors/layout'
import type { Quarter } from './interiors/quarter'
import type { Spot } from './interiors/types'
import type { Mats } from './materials'
import { PAL } from './palette'
import { F, figureMaterial, figureParts, instanceLooks, lookFor, mask, RIG, ROLE_FEATS, touchInstances, writeLook, type Look, type Role as Fig } from './people'
import { mapX, mapZ } from '../core/quarter'

type PoseKind = 'stand' | 'look' | 'walk' | 'run' | 'sit' | 'eat' | 'talk' | 'clap' | 'cook' | 'lean' | 'write' | 'hand' | 'post' | 'sleep' | 'cheer'

interface Activity {
  key: string
  pose: PoseKind
  part?: string
  spot?: Spot
  path?: { x: number; z: number }[]
  loop?: boolean
  y?: number
  speed?: number
  hidden?: boolean
}

type Role = 'stall' | 'shopper' | 'walker' | 'voisin' | 'diner' | 'ailleurs'

interface NpcDef {
  id: string
  kind: 'adult' | 'kid' | 'elder'
  clothes: number
  skin: number
  hair: number
  trousers: number
  hat: 'toque' | 'bonnet' | null
  role?: Role
  index: number
  look: Look
}

interface Npc {
  def: NpcDef
  scale: number
  act: Activity | null
  pos: THREE.Vector3
  yaw: number
  part: string
  s: number
  dir: number
  t: number
  phase: number
  hiddenWritten: boolean
  visible: boolean
}

type SceneId = 'petit-dejeuner' | 'rebord' | 'grand-pere-pluie' | 'chose-vitre'

// Places outside the Écluse quarter (or without a spot) hide the NPC: it has gone there.
const PLACE_SPOT: Partial<Record<NpcPlace, string>> = {
  'cabine-grand-pere': 'grand-pere-table', cuisine: 'cuistot-fourneau', rebord: 'rebord-mila', sas: 'chambre-sas',
  'tableau-meteo': 'rouille-tableau', marche: 'marche-banc', refectoire: 'cuistot-allee',
}
const EMOTE_POSE: Record<EmoteId, PoseKind> = {
  salut: 'hand', oui: 'look', non: 'look', rire: 'cheer', applaudir: 'clap', montrer: 'hand', assis: 'sit', dort: 'sleep', pluie: 'hand',
}

const PATHS = mapPaths({
  coursive: { part: 'coursive-sud', pts: [{ x: -12.5, z: 62.2 }, { x: 8.5, z: 62.2 }], loop: false },
  coursiveKids: { part: 'coursive-sud', pts: [{ x: -12, z: 61.7 }, { x: 8, z: 61.7 }], loop: false },
  marche: { part: 'marche', pts: [{ x: -35, z: 60 }, { x: -30.6, z: 60 }, { x: -30.6, z: 66.6 }, { x: -35, z: 66.6 }], loop: true },
  marcheKids: { part: 'marche', pts: [{ x: -34, z: 61.8 }, { x: -31.5, z: 63.6 }, { x: -34, z: 65.2 }, { x: -35.2, z: 63.4 }], loop: true },
  service: { part: 'refectoire', pts: [{ x: 15.5, z: 56.6 }, { x: 17.0, z: 58.5 }, { x: 18.0, z: 58.6 }, { x: 18.0, z: 66.3 }], loop: false },
} as const)

function mapPaths<T extends Record<string, { part: string; pts: readonly { x: number; z: number }[]; loop: boolean }>>(paths: T): T {
  const out = {} as Record<string, unknown>
  for (const [k, p] of Object.entries(paths)) out[k] = { ...p, pts: p.pts.map((q) => ({ x: mapX(p.part, q.x), z: mapZ(p.part, q.z) })) }
  return out as T
}


function roster(rand: () => number): NpcDef[] {
  const base = (role: Fig, over: Partial<Look> = {}) => ({ ...lookFor(role, rand), ...over })
  const named: NpcDef[] = [
    { id: 'grand-pere', kind: 'elder', clothes: PAL.tissu3, skin: PAL.peau1, hair: PAL.blanc, trousers: PAL.boisOmbre, hat: null, index: 0,
      look: base('elder', { cloth: 0x5e6e8a, accent: 0xc9a98a, hair: 0xeeeae2, legs: 0x4a4250, hand: 0x9a8e86, feat: mask(F.shawl, F.elder, F.beard, F.glasses), width: 1.02, height: 0.92 }) },
    { id: 'cuistot', kind: 'adult', clothes: 0xd9c9a6, skin: PAL.peau2, hair: PAL.cheveux1, trousers: PAL.pantalon, hat: 'toque', index: 1,
      look: base('cook', { skin: PAL.peau2, hand: PAL.peau2, accent: 0xc9644e, legs: 0x8a7a8e, width: 1.42, height: 1.06, feat: mask(F.apron, F.scarf, F.hairShort, F.toque, F.moustache) }) },
    { id: 'mme-rouille', kind: 'adult', clothes: PAL.rouille, skin: PAL.peau3, hair: PAL.cheveux4, trousers: PAL.boisOmbre, hat: 'bonnet', index: 2,
      look: base('vendor', { accent: 0xb8664e, skin: PAL.peau3, hand: PAL.peau3, feat: mask(F.vest, F.kerchief), width: 1.3 }) },
    { id: 'mila', kind: 'kid', clothes: PAL.tissu2, skin: PAL.peau1, hair: PAL.cheveux2, trousers: PAL.tissu3, hat: null, index: 3,
      look: base('kid', { cloth: 0xe3b95f, accent: 0xd8644e, skin: PAL.peau1, hair: PAL.cheveux2, hand: 0xd8644e, feat: mask(F.scarf, F.pigtails), height: 0.76 }) },
    { id: 'tao', kind: 'kid', clothes: PAL.teal, skin: PAL.peau4, hair: PAL.cheveux1, trousers: PAL.pantalon, hat: null, index: 4,
      look: base('kid', { cloth: 0x6e8fb0, accent: 0xf1e4c8, skin: PAL.peau4, hair: PAL.cheveux1, hand: 0xe3b95f, feat: mask(F.sailor, F.hairShort, F.beanie), height: 0.72 }) },
    { id: 'pepin', kind: 'kid', clothes: PAL.tissu1, skin: PAL.peau3, hair: PAL.cheveux2, trousers: PAL.pantalon, hat: null, index: 5,
      look: base('kid', { cloth: 0xd8644e, accent: 0x3e4a6a, skin: PAL.peau3, hair: 0x8a5a3a, hand: 0x9bb7c4, feat: mask(F.sailor, F.hairBob), height: 0.68 }) },
  ]
  const stallIds = ['marchand-poissons', 'marchande-algues', 'collectionneuse', 'brocanteur']
  const roles: Role[] = []
  for (let i = 0; i < 34; i++) {
    roles.push(i < 4 ? 'stall' : i < 10 ? 'shopper' : i < 13 ? 'walker' : i < 15 ? 'voisin' : i < 21 ? 'diner' : 'ailleurs')
  }
  const mix: Fig[] = ['engineer', 'gardener', 'vendor', 'elder', 'engineer', 'gardener', 'kid', 'elder']
  roles.forEach((role, i) => {
    const fig: Fig = role === 'stall' ? 'vendor' : role === 'walker' ? (i % 2 ? 'engineer' : 'gardener') : mix[(i * 5 + 3) % mix.length]!
    const look = base(fig)
    named.push({
      id: i < 4 ? stallIds[i]! : `habitant-${String(i + 1).padStart(2, '0')}`,
      kind: fig === 'elder' ? 'elder' : fig === 'kid' ? 'kid' : 'adult',
      clothes: look.cloth, skin: look.skin, hair: look.hair, trousers: look.legs, hat: null, role, index: named.length, look,
    })
  })
  return named
}

const PARTS_PER_NPC = { torso: 1, head: 1, arm: 2, thigh: 2, shin: 2 } as const
type PartKey = keyof typeof PARTS_PER_NPC
type Lod = 'hi' | 'lo'
const LODS: readonly Lod[] = ['hi', 'lo']
// Torso and head carry the clothes and hair features, so they are built per role with only that role's features.
const BODY: readonly PartKey[] = ['torso', 'head']
const LIMBS: readonly PartKey[] = ['arm', 'thigh', 'shin']
interface Batch { meshes: Partial<Record<PartKey, THREE.InstancedMesh>>; used: number }

interface PoseParams {
  hipY: number; lean: number; headYaw: number; headPitch: number
  armL: [number, number]; armR: [number, number]
  thighL: number; kneeL: number; thighR: number; kneeR: number
  lying: boolean
  cheer: boolean
}

const _base = new THREE.Matrix4()
const _hip = new THREE.Matrix4()
const _m = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _r = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _one = new THREE.Vector3(1, 1, 1)

const DIALOGUE_RELEASE_S = 1.5

export class Npcs {
  private readonly list: Npc[] = []
  private readonly batches = new Map<string, Batch>()
  private readonly overrides = new Map<string, { act: Activity; until: number }>()
  private readonly orders = new Map<string, Activity>()
  private standAll = 0
  private time = 0
  private readonly held = new Map<string, number>()
  private readonly offs: (() => void)[] = []
  private readonly seats: (Spot & { part: string })[]
  private readonly portholeSpots: (Spot & { part: string })[] = []
  readonly group = new THREE.Group()

  constructor(private readonly ctx: GameContext, mats: Mats, private readonly quarter: Quarter) {
    this.group.name = 'drift-habitants'
    this.offs.push(ctx.bus.on('dialogue:start', ({ npcId }) => this.held.set(npcId, Infinity)))
    this.offs.push(ctx.bus.on('dialogue:end', ({ npcId }) => this.held.set(npcId, this.time + DIALOGUE_RELEASE_S)))
    const mat = figureMaterial(mats, false)
    const defs = roster(ctx.rng('drift-habitants'))
    const n = defs.length
    const batch = (name: string, parts: readonly PartKey[], geo: Record<PartKey, THREE.BufferGeometry>, count: number) => {
      const b: Batch = { meshes: {}, used: 0 }
      for (const key of parts) {
        instanceLooks(geo[key], count * PARTS_PER_NPC[key], false)
        const im = new THREE.InstancedMesh(geo[key], mat, count * PARTS_PER_NPC[key])
        im.userData.fadeable = true
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        im.name = `habitants:${name}:${key}`
        b.meshes[key] = im
        this.group.add(im)
      }
      this.batches.set(name, b)
    }
    for (const lod of LODS) {
      batch(lod, LIMBS, figureParts(lod, null), n)
      for (const role of new Set(defs.map((d) => d.look.role))) {
        batch(`${lod}:${role}`, BODY, figureParts(lod, ROLE_FEATS[role]), defs.filter((d) => d.look.role === role).length)
      }
    }
    defs.forEach((d, i) => {
      this.list.push({
        def: d, scale: d.look.height,
        act: null, pos: new THREE.Vector3(), yaw: 0, part: 'refectoire', s: 0, dir: 1, t: 0, phase: i * 1.37,
        hiddenWritten: false, visible: false,
      })
    })
    const sp = quarter.furniture.spots
    const named = ['grand-pere-refectoire']
    this.seats = quarter.furniture.benchSeats.filter((s) => !named.some((k) => sp[k] && Math.hypot(sp[k]!.x - s.x, sp[k]!.z - s.z) < 0.3))
    PORTHOLES.forEach((p) => {
      const part = quarter.parts.get(p.part)!.def
      const inward = 0.75
      let x = 0
      let z = 0
      let yaw = 0
      if (p.side === 'n') { x = p.at; z = part.z0 + inward; yaw = 0 }
      if (p.side === 's') { x = p.at; z = part.z1 - inward; yaw = Math.PI }
      if (p.side === 'w') { x = part.x0 + inward; z = p.at; yaw = -Math.PI / 2 }
      if (p.side === 'e') { x = part.x1 - inward; z = p.at; yaw = Math.PI / 2 }
      if (p.part === 'refectoire' || p.part.startsWith('passerelle') || p.part === 'coursive-sud' || p.part === 'marche') {
        this.portholeSpots.push({ part: p.part, x, y: 0, z, yaw })
      }
    })
  }

  private spot(id: string): (Spot & { part: string }) | undefined {
    return this.quarter.furniture.spots[id]
  }

  private at(id: string, pose: PoseKind, key = id): Activity {
    const s = this.spot(id)
    if (!s) return { key: `cache:${key}`, pose, hidden: true }
    return { key: `${key}:${pose}`, pose, part: s.part, spot: s }
  }

  private seat(i: number, pose: PoseKind): Activity {
    const s = this.seats[i % this.seats.length]!
    return { key: `banc:${i}:${pose}`, pose, part: s.part, spot: s }
  }

  private walk(path: keyof typeof PATHS, pose: 'walk' | 'run', speed: number): Activity {
    const p = PATHS[path]
    return { key: `chemin:${path}:${pose}`, pose, part: p.part, path: [...p.pts], loop: p.loop, speed }
  }

  private hidden(): Activity {
    return { key: 'cache', pose: 'stand', hidden: true }
  }

  private schedule(n: Npc, h: number): Activity {
    const id = n.def.id
    const meal = (h >= 7.5 && h < 8.5) || (h >= 19 && h < 21)
    const night = h >= 21 || h < 6
    const dusk = h >= 17.5 && h < 18.75
    const kidSeat = { mila: 0, tao: 1, pepin: 2 } as Record<string, number>
    switch (id) {
      case 'grand-pere':
        if (meal) return this.at('grand-pere-refectoire', 'eat')
        if (h >= 6 && h < 7.5) return this.at('grand-pere-fenetre', 'look')
        if (dusk) return this.at('grand-pere-fenetre', 'look')
        if (h >= 13 && h < 14.5) return this.at('grand-pere-fauteuil', 'sit')
        return this.at('grand-pere-table', night ? 'lean' : 'write')
      case 'cuistot':
        if (night && !(h >= 5.5 && h < 6)) return this.hidden()
        if (meal) return h < 7.95 || (h >= 19 && h < 19.4) ? this.at('cuistot-comptoir', 'cook') : this.walk('service', 'walk', 0.9)
        return Math.floor(h * 3) % 2 === 0 ? this.at('cuistot-fourneau', 'cook') : this.at('cuistot-table', 'cook')
      case 'mme-rouille':
        if (h >= 21 || h < 5.5) return this.hidden()
        if (h < 6.5) return this.at('rouille-tableau', 'post')
        if (meal) return this.seat(30, 'eat')
        return this.at('rouille-tabouret', 'sit')
      case 'mila':
      case 'tao':
      case 'pepin': {
        if (night) return this.hidden()
        if (h >= 7.5 && h < 8.5) return this.at(`rebord-${id}`, 'clap')
        if (meal) return this.seat(40 + kidSeat[id]!, 'eat')
        if (h < 7.5) return this.walk('coursiveKids', 'run', 2.0 + kidSeat[id]! * 0.2)
        if (h >= 8.5 && h < 12) return this.at(`rebord-${id}`, 'clap')
        if (dusk) return this.at(`rebord-${id}`, 'look')
        if (h >= 12 && h < 17.5) return this.walk('marcheKids', 'run', 1.8 + kidSeat[id]! * 0.25)
        return this.at(`rebord-${id}`, 'clap')
      }
    }
    const i = n.def.index - 6
    const role = n.def.role ?? 'ailleurs'
    if (meal) return this.seat(i, h >= 19 ? 'talk' : 'eat')
    if (night) {
      if (role === 'voisin') return this.at(i === 13 ? 'voisin-lit-a' : 'voisin-lit-b', 'sleep')
      return this.hidden()
    }
    if (dusk && role !== 'stall' && role !== 'voisin' && role !== 'ailleurs') {
      const s = this.portholeSpots[i % this.portholeSpots.length]
      if (s) return { key: `hublot:${i}`, pose: 'look', part: s.part, spot: s }
    }
    if (h < 7.5) {
      if (role === 'walker') return this.walk('coursive', 'walk', 1.0 + (i % 3) * 0.15)
      if (role === 'voisin') return this.at(i === 13 ? 'voisin-debout' : 'voisin-table', i === 13 ? 'stand' : 'sit')
      return this.hidden()
    }
    switch (role) {
      case 'stall': {
        const ids = ['etal-poissons', 'etal-algues', 'etal-trouvailles', 'etal-bric-a-brac']
        return h < 18 ? this.at(ids[i]!, 'stand') : this.hidden()
      }
      case 'shopper':
        return h < 18 ? this.walk('marche', 'walk', 0.8 + (i % 4) * 0.12) : this.hidden()
      case 'walker':
        return this.walk('coursive', 'walk', 1.0 + (i % 3) * 0.15)
      case 'voisin':
        return this.at(i === 13 ? 'voisin-table' : 'voisin-debout', i === 13 ? 'sit' : 'stand')
      case 'diner':
        return h < 17.5 ? this.seat(i + 6, 'talk') : this.hidden()
      default:
        return this.hidden()
    }
  }

  playScene(id: SceneId): Promise<void> {
    const dur = id === 'grand-pere-pluie' ? 12 : id === 'chose-vitre' ? 9 : 10
    const until = this.time + dur
    if (id === 'petit-dejeuner') {
      for (const n of this.list) this.overrides.set(n.def.id, { act: this.schedule(n, 7.75), until })
      this.overrides.set('cuistot', { act: this.walk('service', 'walk', 1.1), until })
    } else if (id === 'rebord') {
      for (const k of ['mila', 'tao', 'pepin']) this.overrides.set(k, { act: this.at(`rebord-${k}`, 'clap', `scene-${k}`), until })
    } else if (id === 'grand-pere-pluie') {
      this.overrides.set('grand-pere', { act: this.at('grand-pere-fenetre', 'hand', 'scene-pluie'), until: until + 40 })
    } else {
      this.standAll = until
    }
    return new Promise((resolve) => {
      const check = () => {
        if (this.time >= until) resolve()
        else this.waiters.push(check)
      }
      this.waiters.push(check)
    })
  }
  private waiters: (() => void)[] = []

  /** A server-decided order replaces the routine until it is withdrawn (null); scenes and dialogue still win. */
  order(id: string, o: NpcOrderView | null): void {
    const n = this.list.find((q) => q.def.id === id)
    if (!n) return
    if (!o) {
      this.orders.delete(id)
      return
    }
    const tag = `ordre:${o.kind}:${o.place}:${o.emote}:${o.until}`
    if (o.kind === 'emote') {
      const cur = n.act
      if (!cur || cur.hidden) return
      const spot = { part: n.part, x: n.pos.x, y: cur.spot?.y ?? 0, z: n.pos.z, yaw: n.yaw }
      this.orders.set(id, { key: tag, pose: EMOTE_POSE[o.emote as EmoteId] ?? 'stand', part: n.part, spot })
      return
    }
    if (o.kind === 'sit' && o.place === 'refectoire') {
      this.orders.set(id, { ...this.seat(50 + n.def.index, 'sit'), key: tag })
      return
    }
    const spotId = PLACE_SPOT[o.place as NpcPlace]
    const act = spotId ? this.at(spotId, o.kind === 'sit' ? 'sit' : 'stand') : this.hidden()
    this.orders.set(id, { ...act, key: tag })
  }

  position(id: string): THREE.Vector3 | null {
    const n = this.list.find((q) => q.def.id === id)
    if (!n || !n.act || n.act.hidden) return null
    return n.pos
  }

  roomOf(id: string): string | null {
    const n = this.list.find((q) => q.def.id === id)
    if (!n || !n.act || n.act.hidden) return null
    return n.part
  }

  nearby(local: THREE.Vector3, r: number): { id: string; pos: THREE.Vector3; key: string }[] {
    const out: { id: string; pos: THREE.Vector3; key: string }[] = []
    for (const n of this.list) {
      if (!n.act || n.act.hidden || !n.visible) continue
      if (n.pos.distanceTo(local) < r) out.push({ id: n.def.id, pos: n.pos, key: n.act.key })
    }
    return out
  }

  update(dt: number): void {
    this.time += dt
    const ws = this.waiters.splice(0)
    for (const w of ws) w()
    const h = this.ctx.state.time.hours
    const q = this.ctx.quality.level
    let seatedBudget = q === 'high' ? 40 : q === 'medium' ? 25 : 12
    let walkBudget = q === 'high' ? 12 : q === 'medium' ? 8 : 4
    for (const b of this.batches.values()) b.used = 0
    for (const n of this.list) {
      const ov = this.overrides.get(n.def.id)
      const heldUntil = this.held.get(n.def.id)
      if (heldUntil !== undefined && heldUntil <= this.time) this.held.delete(n.def.id)
      const held = n.act !== null && heldUntil !== undefined && heldUntil > this.time
      let act: Activity
      if (held) act = n.act!
      else if (ov && ov.until > this.time) act = ov.act
      else {
        if (ov) this.overrides.delete(n.def.id)
        act = this.orders.get(n.def.id) ?? this.schedule(n, h)
      }
      if (!n.act || n.act.key !== act.key) this.enter(n, act)
      n.act = act
      if (act.hidden) {
        n.visible = false
        continue
      }
      n.hiddenWritten = false
      if (act.path && !held) this.advance(n, act, dt)
      const vis = this.quarter.isDetailVisible(n.part)
      n.visible = vis
      if (!vis) continue
      const moving = act.pose === 'walk' || act.pose === 'run'
      const live = moving ? walkBudget-- > 0 : seatedBudget-- > 0
      if (live) n.t += dt
      this.pose(n, act)
    }
    let shown = 0
    for (const b of this.batches.values()) {
      shown += b.used
      for (const [key, im] of Object.entries(b.meshes) as [PartKey, THREE.InstancedMesh][]) {
        im.count = b.used * PARTS_PER_NPC[key]
        im.visible = im.count > 0
        if (!im.visible) continue
        touchInstances(im)
        im.computeBoundingSphere()
      }
    }
    this.group.visible = shown > 0
  }

  private enter(n: Npc, act: Activity): void {
    n.t = 0
    if (act.hidden) return
    if (act.part) n.part = act.part
    if (act.spot) {
      n.pos.set(act.spot.x, 0, act.spot.z)
      n.yaw = act.spot.yaw
    } else if (act.path) {
      const len = pathLength(act.path, !!act.loop)
      n.s = ((n.def.index * 3.7) % len)
      n.dir = n.def.index % 2 === 0 ? 1 : -1
      this.advance(n, act, 0)
    }
  }

  private advance(n: Npc, act: Activity, dt: number): void {
    const path = act.path!
    const loop = !!act.loop
    const len = pathLength(path, loop)
    n.s += dt * (act.speed ?? 1) * n.dir
    if (loop) n.s = ((n.s % len) + len) % len
    else if (n.s > len) {
      n.s = len - (n.s - len)
      n.dir = -1
    } else if (n.s < 0) {
      n.s = -n.s
      n.dir = 1
    }
    let s = n.s
    const segs = loop ? path.length : path.length - 1
    for (let i = 0; i < segs; i++) {
      const a = path[i]!
      const b = path[(i + 1) % path.length]!
      const l = Math.hypot(b.x - a.x, b.z - a.z)
      if (s <= l || i === segs - 1) {
        const t = l > 0 ? Math.min(1, s / l) : 0
        n.pos.set(a.x + (b.x - a.x) * t, act.y ?? 0, a.z + (b.z - a.z) * t)
        const dx = (b.x - a.x) * n.dir
        const dz = (b.z - a.z) * n.dir
        const target = Math.atan2(dx, -dz)
        let d = target - n.yaw
        d = Math.atan2(Math.sin(d), Math.cos(d))
        n.yaw += d * Math.min(1, dt * 6 + (dt === 0 ? 1 : 0))
        break
      }
      s -= l
    }
  }

  private params(n: Npc, act: Activity): PoseParams {
    const t = n.t + n.phase
    const breathe = Math.sin(t * 1.6) * 0.012
    const p: PoseParams = {
      hipY: RIG.hip + breathe * 0.3, lean: 0.03 + breathe, headYaw: Math.sin(t * 0.31) * 0.25, headPitch: Math.sin(t * 0.23) * 0.06,
      armL: [0.06, 0.1], armR: [0.06, -0.1], thighL: 0, kneeL: 0, thighR: 0, kneeR: 0, lying: false, cheer: false,
    }
    let pose = act.pose
    if (this.standAll > this.time && (n.part === 'refectoire' || n.part === 'cuisine')) pose = 'cheer'
    const sitBase = () => {
      p.hipY = 0.1
      p.thighL = p.thighR = 1.5
      p.kneeL = p.kneeR = -1.5
      p.armL = [0.45, 0.12]
      p.armR = [0.45, -0.12]
    }
    switch (pose) {
      case 'look':
        p.headPitch = 0.12 + Math.sin(t * 0.4) * 0.04
        p.headYaw = Math.sin(t * 0.2) * 0.15
        break
      case 'cheer':
        p.cheer = true
        p.headPitch = 0.22
        p.headYaw = 0
        p.armL = [0.5 + Math.sin(t * 2) * 0.1, 0.2]
        p.armR = [0.5 + Math.cos(t * 2) * 0.1, -0.2]
        break
      case 'walk':
      case 'run': {
        const run = pose === 'run'
        const ph = t * (run ? 9 : 5.5)
        const a = run ? 0.75 : 0.45
        p.thighL = a * Math.sin(ph)
        p.thighR = -a * Math.sin(ph)
        p.kneeL = -Math.max(0, Math.cos(ph)) * (run ? 1.1 : 0.6)
        p.kneeR = -Math.max(0, -Math.cos(ph)) * (run ? 1.1 : 0.6)
        p.armL = [-a * 0.9 * Math.sin(ph), 0.1]
        p.armR = [a * 0.9 * Math.sin(ph), -0.1]
        p.hipY = RIG.hip - 0.02 + Math.abs(Math.sin(ph)) * 0.04
        p.lean = run ? 0.18 : 0.06
        p.headYaw = 0
        break
      }
      case 'sit':
        sitBase()
        break
      case 'eat': {
        sitBase()
        p.lean = 0.12
        const cyc = (t * 0.35) % 1
        const lift = cyc < 0.3 ? Math.sin((cyc / 0.3) * Math.PI) : 0
        p.armR = [0.6 + lift * 1.4, -0.35 * lift - 0.1]
        p.headPitch = -0.15 + lift * 0.1
        p.headYaw = Math.sin(t * 0.2) * 0.1
        break
      }
      case 'talk':
        sitBase()
        p.headYaw = Math.sin(t * 0.9) * 0.45
        p.armR = [0.7 + Math.sin(t * 2.3) * 0.25, -0.25]
        break
      case 'clap': {
        p.hipY = RIG.thigh + 0.07
        p.thighL = p.thighR = 0
        p.kneeL = p.kneeR = -1.55
        const beat = Math.sin(t * Math.PI * 2 * 1.6)
        const cross = Math.sin(t * Math.PI * 1.6) > 0
        p.armL = [1.25 + beat * 0.2, cross ? 0.35 : -0.15 + beat * 0.15]
        p.armR = [1.25 - beat * 0.2, cross ? 0.15 - beat * 0.15 : -0.35]
        p.headPitch = Math.sin(t * Math.PI * 3.2) * 0.08
        p.headYaw = 0
        p.lean = 0.1 + beat * 0.03
        break
      }
      case 'cook':
        p.lean = 0.16
        p.armR = [1.0 + Math.sin(t * 3) * 0.15, -0.3 * Math.cos(t * 3)]
        p.armL = [0.7, 0.2]
        p.headPitch = -0.3
        break
      case 'lean':
        p.lean = 0.55
        p.armL = [1.25, 0.15]
        p.armR = [1.25, -0.15]
        p.headPitch = -0.35
        if (act.spot && act.spot.y > 0.2) {
          sitBase()
          p.lean = 0.45
          p.armL = [1.3, 0.12]
          p.armR = [1.3, -0.12]
        }
        break
      case 'write':
        sitBase()
        p.lean = 0.42
        p.headPitch = -0.4
        p.armL = [1.2, 0.15]
        p.armR = [1.15 + Math.sin(t * 5) * 0.05, -0.2 + Math.sin(t * 3.3) * 0.08]
        break
      case 'hand':
        p.lean = 0.0
        p.headPitch = 0.18
        p.headYaw = 0
        p.armR = [1.5, -0.05]
        p.armL = [0.1, 0.12]
        break
      case 'post':
        p.armR = [2.1 + Math.sin(t * 4) * 0.1, -0.15 + Math.cos(t * 4) * 0.1]
        p.headPitch = 0.15
        p.headYaw = 0
        break
      case 'sleep':
        p.lying = true
        p.hipY = 0
        p.headYaw = 0
        p.headPitch = 0
        p.armL = [0.1, 0.12]
        p.armR = [0.1, -0.12]
        p.lean = Math.sin(t * 0.9) * 0.02
        break
      case 'stand':
        break
    }
    if (n.def.kind === 'elder' && !p.lying) p.lean += 0.12
    return p
  }

  private pose(n: Npc, act: Activity): void {
    const p = this.params(n, act)
    _w.copy(n.pos).applyMatrix4(this.group.matrixWorld)
    const lod: Lod = _w.distanceTo(this.ctx.camera.position) < NPC_LOD.hiDistance ? 'hi' : 'lo'
    const look = n.def.look
    const body = this.batches.get(`${lod}:${look.role}`)!
    const limbs = this.batches.get(lod)!
    const b = body.used++
    const i = limbs.used++
    for (const [batch, slot] of [[body, b], [limbs, i]] as const) {
      for (const [key, im] of Object.entries(batch.meshes) as [PartKey, THREE.InstancedMesh][]) {
        for (let k = 0; k < PARTS_PER_NPC[key]; k++) writeLook(im.geometry, slot * PARTS_PER_NPC[key] + k, look)
      }
    }
    const s = n.scale
    const w = look.width
    _base.copy(this.quarter.swayOf(n.part))
    _m.compose(n.pos, _q.setFromAxisAngle(_v.set(0, 1, 0), -n.yaw), _one)
    _base.multiply(_m)
    _base.multiply(_m.makeScale(s, s, s))
    const spotY = act.spot?.y ?? 0
    const seatY = p.cheer && spotY < 0.55 ? 0 : spotY
    if (p.lying) {
      _base.multiply(_m.makeTranslation(0, (seatY + 0.12) / s, -0.1))
      _base.multiply(_m.makeRotationX(Math.PI / 2))
      _hip.copy(_base)
    } else {
      _hip.copy(_base).multiply(_m.makeTranslation(0, p.hipY + seatY / s, 0))
    }
    const torso = _m2.copy(_hip).multiply(_r.makeRotationX(-p.lean))
    body.meshes.torso!.setMatrixAt(b, _m.copy(torso).multiply(_r.makeScale(w, 1, 1 + (w - 1) * 0.55)))
    const headM = _m.copy(torso).multiply(_r.makeTranslation(0, RIG.headY + (look.head - 1) * RIG.headR, 0))
    _e.set(p.headPitch, p.headYaw, 0, 'YXZ')
    headM.multiply(_r.makeRotationFromEuler(_e)).multiply(_r.makeScale(look.head, look.head, look.head))
    body.meshes.head!.setMatrixAt(b, headM)
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1
      const [pitch, roll] = k === 0 ? p.armL : p.armR
      const arm = _m.copy(torso).multiply(_r.makeTranslation(side * RIG.shX * w, RIG.shY, 0))
      _e.set(pitch, 0, roll + side * 0.07, 'XYZ')
      arm.multiply(_r.makeRotationFromEuler(_e))
      limbs.meshes.arm!.setMatrixAt(i * 2 + k, arm)
      const thigh = _m.copy(_hip).multiply(_r.makeTranslation(side * (RIG.legX + (w - 1) * 0.06), 0, 0))
      thigh.multiply(_r.makeRotationX(k === 0 ? p.thighL : p.thighR))
      limbs.meshes.thigh!.setMatrixAt(i * 2 + k, thigh)
      const shin = thigh.multiply(_r.makeTranslation(0, -RIG.thigh, 0)).multiply(_r.makeRotationX(k === 0 ? p.kneeL : p.kneeR))
      limbs.meshes.shin!.setMatrixAt(i * 2 + k, shin)
    }
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off()
    for (const b of this.batches.values()) for (const im of Object.values(b.meshes)) im.geometry.dispose()
    this.group.removeFromParent()
  }
}

function pathLength(path: readonly { x: number; z: number }[], loop: boolean): number {
  let l = 0
  const segs = loop ? path.length : path.length - 1
  for (let i = 0; i < segs; i++) {
    const a = path[i]!
    const b = path[(i + 1) % path.length]!
    l += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return l
}

export const NPC_IDS = ['grand-pere', 'cuistot', 'mme-rouille', 'mila', 'tao', 'pepin', 'marchand-poissons', 'marchande-algues', 'collectionneuse', 'brocanteur'] as const
