import * as THREE from 'three'
import type { DistrictId, Vec3 } from '../../core/types'
import type { Mats } from '../materials'
import { PAL } from '../palette'
import { F, RIG, figureMaterial, instanceLooks, lookFor, mask, rigGeometry, ROLE_FEATS, touchInstances, writeLook, writePose, type Look, type Role } from '../people'

type Pose = 'stand' | 'walk' | 'work' | 'sit' | 'sleep' | 'look'
interface Stop { from: number; to: number; pose: Pose; at?: Vec3 & { yaw: number }; path?: { pts: Vec3[]; loop: boolean; speed: number } }
interface FolkDef {
  id: string
  district: DistrictId
  clothes: number; trousers: number; skin: number; hair: number
  hat: { color: number; brim: number; crown: number } | null
  height: number
  role: Role
  feat?: number
  day: Stop[]
}

const P = (x: number, y: number, z: number, yaw: number) => ({ x, y, z, yaw })
const L = (pts: [number, number, number][], loop: boolean, speed: number) => ({ pts: pts.map(([x, y, z]) => ({ x, y, z })), loop, speed })

// Named residents outside the v1 quarter, by the hour (BIBLE §8). Hours wrap: a stop with from > to spans midnight.
const ROSTER: readonly FolkDef[] = [
  {
    id: 'bastien', district: 'machines', clothes: 0x6e5a4a, trousers: 0x3f4a66, skin: PAL.peau2, hair: PAL.cheveux1,
    hat: { color: PAL.rouille, brim: 0.17, crown: 0.09 }, height: 1.02, role: 'engineer', feat: mask(F.bib, F.cap, F.hairShort),
    day: [
      { from: 6, to: 12, pose: 'work', at: P(4.8, -22, -3.6, 2.2) },
      { from: 12, to: 13.5, pose: 'walk', path: L([[9.8, -14, 0], [0, -14, 9.8], [-9.8, -14, 0], [0, -14, -9.8]], true, 0.9) },
      { from: 13.5, to: 21, pose: 'work', at: P(-4.2, -22, -3.2, -0.9) },
      { from: 21, to: 6, pose: 'sit', at: P(5.6, -21.54, 4.6, -2.4) },
    ],
  },
  {
    id: 'nour', district: 'serres', clothes: 0x8fbf6a, trousers: 0x5e4a5c, skin: PAL.peau4, hair: PAL.cheveux2,
    hat: { color: 0xe3c98f, brim: 0.32, crown: 0.08 }, height: 0.97, role: 'gardener', feat: mask(F.smock, F.straw, F.hairBun),
    day: [
      { from: 6.5, to: 12, pose: 'work', at: P(92.3, 0, 31, -Math.PI / 2) },
      { from: 12, to: 13, pose: 'sit', at: P(77, 0.46, 30, Math.PI / 2) },
      { from: 13, to: 17.5, pose: 'walk', path: L([[86, 0, 2], [86, 0, 41], [86, 0, 47], [86, 0, 69]], false, 0.6) },
      { from: 17.5, to: 21, pose: 'work', at: P(84.6, 0, 52, Math.PI / 2) },
    ],
  },
  {
    id: 'mme-cassis', district: 'marche', clothes: 0xb0405a, trousers: 0x3e3a5a, skin: PAL.peau3, hair: PAL.cheveux3,
    hat: { color: PAL.tissu2, brim: 0.13, crown: 0.12 }, height: 0.95, role: 'vendor', feat: mask(F.vest, F.kerchief),
    day: [
      { from: 6.5, to: 12, pose: 'stand', at: P(-92.25, 0, 2, Math.PI / 2) },
      { from: 12, to: 13, pose: 'walk', path: L([[-95.5, 0, 2], [-95.5, 0, 38], [-88, 0, 52], [-88, 0, 68]], false, 0.7) },
      { from: 13, to: 19.5, pose: 'stand', at: P(-92.25, 0, 2, Math.PI / 2) },
    ],
  },
  {
    id: 'maitre-noeud', district: 'ateliers', clothes: 0x6e8fb0, trousers: 0x52576a, skin: PAL.peau1, hair: PAL.cheveux4,
    hat: null, height: 0.92, role: 'elder', feat: mask(F.shawl, F.elder, F.moustache, F.glasses),
    day: [
      { from: 7, to: 12, pose: 'walk', path: L([[-106, 0, -37.75], [-64, 0, -37.75]], false, 0.35) },
      { from: 12, to: 13, pose: 'sit', at: P(-58, 0.46, -40.5, Math.PI) },
      { from: 13, to: 18.5, pose: 'work', at: P(-62.8, 0, -36.9, Math.PI) },
      { from: 18.5, to: 21, pose: 'look', at: P(-57, 0, -24.5, 0) },
    ],
  },
  {
    id: 'veilleuse-ida', district: 'scellees', clothes: 0x4f6d7a, trousers: 0x3e3a5a, skin: PAL.peau3, hair: PAL.cheveux1,
    hat: { color: 0x7a8a6a, brim: 0.16, crown: 0.16 }, height: 0.93, role: 'engineer', feat: mask(F.bib, F.beanie, F.hairBob),
    day: [
      { from: 6, to: 14, pose: 'sit', at: P(110.6, 0.46, -24.2, Math.PI / 2) },
      { from: 14, to: 16.5, pose: 'walk', path: L([[60, 0, -30], [118, 0, -30]], false, 0.5) },
      { from: 16.5, to: 22, pose: 'sit', at: P(113.4, 0.46, -24.2, -Math.PI / 2) },
      { from: 22, to: 6, pose: 'sleep', at: P(116, 0.32, -23.5, 2.6) },
    ],
  },
  {
    id: 'gardien-proue', district: 'proue', clothes: PAL.creme, trousers: 0x3f4a66, skin: PAL.peau2, hair: PAL.cheveux3,
    hat: { color: 0x2f4e7a, brim: 0.15, crown: 0.2 }, height: 1.04, role: 'engineer', feat: mask(F.bib, F.cap, F.hairShort, F.scarf),
    day: [
      { from: 6, to: 12, pose: 'stand', at: P(6.4, 16, -52.6, Math.PI / 2) },
      { from: 12, to: 13.5, pose: 'sit', at: P(0, 16.46, -69.3, 0) },
      { from: 13.5, to: 21.5, pose: 'look', at: P(-1.5, 16, -70.6, 0) },
      { from: 21.5, to: 6, pose: 'sleep', at: P(-3.2, 16.5, -53.4, Math.PI / 2) },
    ],
  },
]

interface Rt { def: FolkDef; stop: Stop | null; s: number; dir: number; pos: THREE.Vector3; yaw: number; t: number; phase: number; visible: boolean }

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()

export class Folk {
  readonly group = new THREE.Group()
  private readonly rts: Rt[]
  private readonly looks: Look[]
  private readonly meshes = new Map<Role, THREE.InstancedMesh>()
  private active: ReadonlySet<DistrictId> | null = null
  private time = 0

  constructor(mats: Mats) {
    this.group.name = 'drift-habitants'
    const mat = figureMaterial(mats, true)
    let st = 977
    const rand = () => {
      st = (st * 16807) % 2147483647
      return st / 2147483647
    }
    this.looks = ROSTER.map((d) => ({
      ...lookFor(d.role, rand), cloth: d.clothes, legs: d.trousers, skin: d.skin, hair: d.hair, accent: d.hat?.color ?? d.clothes,
      height: d.height * 0.98, ...(d.feat ? { feat: d.feat } : {}),
    }))
    for (const role of new Set(ROSTER.map((d) => d.role))) {
      const n = ROSTER.filter((d) => d.role === role).length
      const geo = rigGeometry(ROLE_FEATS[role], 'lo')
      instanceLooks(geo, n, true)
      const im = new THREE.InstancedMesh(geo, mat, n)
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      im.name = `habitants:${role}`
      this.meshes.set(role, im)
      this.group.add(im)
    }
    this.rts = ROSTER.map((def, i) => ({ def, stop: null, s: 0, dir: 1, pos: new THREE.Vector3(), yaw: 0, t: 0, phase: i * 1.7, visible: false }))
  }

  setActive(loaded: ReadonlySet<DistrictId> | null): void {
    this.active = loaded
  }

  position(id: string): THREE.Vector3 | null {
    const r = this.rts.find((q) => q.def.id === id)
    return r && r.stop ? r.pos : null
  }

  ids(): string[] {
    return ROSTER.map((d) => d.id)
  }

  update(dt: number, hours: number): void {
    this.time += dt
    const slots = new Map<Role, number>()
    this.rts.forEach((r, i) => {
      const stop = r.def.day.find((s) => (s.from <= s.to ? hours >= s.from && hours < s.to : hours >= s.from || hours < s.to)) ?? null
      if (stop !== r.stop) {
        r.stop = stop
        r.t = 0
        if (stop?.at) {
          r.pos.set(stop.at.x, stop.at.y, stop.at.z)
          r.yaw = stop.at.yaw
        }
        if (stop?.path) r.s = (i * 7.3) % pathLen(stop.path.pts, stop.path.loop)
      }
      r.t += dt
      const shown = !!stop && (!this.active || this.active.has(r.def.district))
      if (!shown) return
      if (stop!.path) this.walk(r, stop!.path, dt)
      const im = this.meshes.get(r.def.role)!
      const slot = slots.get(r.def.role) ?? 0
      slots.set(r.def.role, slot + 1)
      this.pose(r, im, slot, this.looks[i]!, stop!.pose)
    })
    for (const [role, im] of this.meshes) {
      im.count = slots.get(role) ?? 0
      im.visible = im.count > 0
      if (!im.visible) continue
      touchInstances(im)
      im.computeBoundingSphere()
    }
  }

  private walk(r: Rt, path: NonNullable<Stop['path']>, dt: number): void {
    const len = pathLen(path.pts, path.loop)
    r.s += path.speed * r.dir * dt
    if (path.loop) r.s = ((r.s % len) + len) % len
    else if (r.s > len) {
      r.s = len
      r.dir = -1
    } else if (r.s < 0) {
      r.s = 0
      r.dir = 1
    }
    const px = r.pos.x
    const pz = r.pos.z
    pointAt(path.pts, path.loop, r.s, r.pos)
    const dx = r.pos.x - px
    const dz = r.pos.z - pz
    if (dx * dx + dz * dz > 1e-8) {
      const target = Math.atan2(dx, -dz)
      let d = target - r.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      r.yaw += d * Math.min(1, dt * 6)
    }
  }

  private pose(r: Rt, im: THREE.InstancedMesh, slot: number, look: Look, pose: Pose): void {
    const t = this.time + r.phase
    let lean = Math.sin(t * 0.7) * 0.03
    let swing = 0
    let bend = 0
    let y = r.pos.y
    let lying = false
    const speed = pose === 'walk' ? (r.stop?.path?.speed ?? 0.6) : 0
    if (pose === 'walk') {
      swing = 0.45
      lean = 0.06
      y += Math.abs(Math.sin(t * 5.2)) * 0.03
    } else if (pose === 'work') lean = 0.32 + Math.sin(t * 1.8) * 0.06
    else if (pose === 'sit') {
      bend = 1.45
      y -= RIG.hip * look.height
      lean = 0.1
    } else if (pose === 'look') lean = -0.05
    else if (pose === 'sleep') lying = true
    _e.set(lying ? -Math.PI / 2 : -lean, -r.yaw, 0, 'YXZ')
    _q.setFromEuler(_e)
    _m.compose(_v.set(r.pos.x, lying ? y + 0.15 : y, r.pos.z), _q, _s.setScalar(look.height))
    if (lying) _m.multiply(new THREE.Matrix4().makeTranslation(0, -0.9, 0))
    im.setMatrixAt(slot, _m)
    writeLook(im.geometry, slot, look)
    writePose(im.geometry, slot, 5.2 * Math.max(0.6, speed * 1.4), r.phase, swing, bend)
  }

  dispose(): void {
    for (const im of this.meshes.values()) im.geometry.dispose()
    this.group.removeFromParent()
  }
}

function pathLen(pts: readonly Vec3[], loop: boolean): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)
  if (loop && pts.length > 2) l += Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.z - pts[pts.length - 1]!.z)
  return Math.max(l, 1e-3)
}

function pointAt(pts: readonly Vec3[], loop: boolean, s: number, out: THREE.Vector3): void {
  const list = loop ? [...pts, pts[0]!] : pts
  let left = s
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]!
    const b = list[i]!
    const l = Math.hypot(b.x - a.x, b.z - a.z)
    if (left <= l || i === list.length - 1) {
      const k = l > 0 ? Math.min(1, left / l) : 0
      out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k)
      return
    }
    left -= l
  }
}
