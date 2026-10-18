import * as THREE from 'three'
import type { DistrictId, Vec3 } from '../../core/types'
import type { Mats } from '../materials'
import { PAL } from '../palette'

type Pose = 'stand' | 'walk' | 'work' | 'sit' | 'sleep' | 'look'
interface Stop { from: number; to: number; pose: Pose; at?: Vec3 & { yaw: number }; path?: { pts: Vec3[]; loop: boolean; speed: number } }
interface FolkDef {
  id: string
  district: DistrictId
  clothes: number; trousers: number; skin: number; hair: number
  hat: { color: number; brim: number; crown: number } | null
  height: number
  day: Stop[]
}

const P = (x: number, y: number, z: number, yaw: number) => ({ x, y, z, yaw })
const L = (pts: [number, number, number][], loop: boolean, speed: number) => ({ pts: pts.map(([x, y, z]) => ({ x, y, z })), loop, speed })

// Named residents outside the v1 quarter, by the hour (BIBLE §8). Hours wrap: a stop with from > to spans midnight.
const ROSTER: readonly FolkDef[] = [
  {
    id: 'bastien', district: 'machines', clothes: 0x6e5a4a, trousers: 0x3f4a66, skin: PAL.peau2, hair: PAL.cheveux1,
    hat: { color: PAL.rouille, brim: 0.17, crown: 0.09 }, height: 1.02,
    day: [
      { from: 6, to: 12, pose: 'work', at: P(4.8, -22, -3.6, 2.2) },
      { from: 12, to: 13.5, pose: 'walk', path: L([[9.8, -14, 0], [0, -14, 9.8], [-9.8, -14, 0], [0, -14, -9.8]], true, 0.9) },
      { from: 13.5, to: 21, pose: 'work', at: P(-4.2, -22, -3.2, -0.9) },
      { from: 21, to: 6, pose: 'sit', at: P(5.6, -21.54, 4.6, -2.4) },
    ],
  },
  {
    id: 'nour', district: 'serres', clothes: 0x8fbf6a, trousers: 0x5e4a5c, skin: PAL.peau4, hair: PAL.cheveux2,
    hat: { color: 0xe3c98f, brim: 0.32, crown: 0.08 }, height: 0.97,
    day: [
      { from: 6.5, to: 12, pose: 'work', at: P(92.3, 0, 31, -Math.PI / 2) },
      { from: 12, to: 13, pose: 'sit', at: P(77, 0.46, 30, Math.PI / 2) },
      { from: 13, to: 17.5, pose: 'walk', path: L([[86, 0, 2], [86, 0, 41], [86, 0, 47], [86, 0, 69]], false, 0.6) },
      { from: 17.5, to: 21, pose: 'work', at: P(84.6, 0, 52, Math.PI / 2) },
    ],
  },
  {
    id: 'mme-cassis', district: 'marche', clothes: 0xb0405a, trousers: 0x3e3a5a, skin: PAL.peau3, hair: PAL.cheveux3,
    hat: { color: PAL.tissu2, brim: 0.13, crown: 0.12 }, height: 0.95,
    day: [
      { from: 6.5, to: 12, pose: 'stand', at: P(-92.25, 0, 2, Math.PI / 2) },
      { from: 12, to: 13, pose: 'walk', path: L([[-95.5, 0, 2], [-95.5, 0, 38], [-88, 0, 52], [-88, 0, 68]], false, 0.7) },
      { from: 13, to: 19.5, pose: 'stand', at: P(-92.25, 0, 2, Math.PI / 2) },
    ],
  },
  {
    id: 'maitre-noeud', district: 'ateliers', clothes: 0x6e8fb0, trousers: 0x52576a, skin: PAL.peau1, hair: PAL.cheveux4,
    hat: null, height: 1.0,
    day: [
      { from: 7, to: 12, pose: 'walk', path: L([[-106, 0, -37.75], [-64, 0, -37.75]], false, 0.35) },
      { from: 12, to: 13, pose: 'sit', at: P(-58, 0.46, -40.5, Math.PI) },
      { from: 13, to: 18.5, pose: 'work', at: P(-62.8, 0, -36.9, Math.PI) },
      { from: 18.5, to: 21, pose: 'look', at: P(-57, 0, -24.5, 0) },
    ],
  },
  {
    id: 'veilleuse-ida', district: 'scellees', clothes: 0x4f6d7a, trousers: 0x3e3a5a, skin: PAL.peau3, hair: PAL.cheveux1,
    hat: { color: 0x7a8a6a, brim: 0.16, crown: 0.16 }, height: 0.93,
    day: [
      { from: 6, to: 14, pose: 'sit', at: P(110.6, 0.46, -24.2, Math.PI / 2) },
      { from: 14, to: 16.5, pose: 'walk', path: L([[60, 0, -30], [118, 0, -30]], false, 0.5) },
      { from: 16.5, to: 22, pose: 'sit', at: P(113.4, 0.46, -24.2, -Math.PI / 2) },
      { from: 22, to: 6, pose: 'sleep', at: P(116, 0.32, -23.5, 2.6) },
    ],
  },
  {
    id: 'gardien-proue', district: 'proue', clothes: PAL.creme, trousers: 0x3f4a66, skin: PAL.peau2, hair: PAL.cheveux3,
    hat: { color: 0x2f4e7a, brim: 0.15, crown: 0.2 }, height: 1.04,
    day: [
      { from: 6, to: 12, pose: 'stand', at: P(6.4, 16, -52.6, Math.PI / 2) },
      { from: 12, to: 13.5, pose: 'sit', at: P(0, 16.46, -69.3, 0) },
      { from: 13.5, to: 21.5, pose: 'look', at: P(-1.5, 16, -70.6, 0) },
      { from: 21.5, to: 6, pose: 'sleep', at: P(-3.2, 16.5, -53.4, Math.PI / 2) },
    ],
  },
]

type PartKey = 'torso' | 'head' | 'hair' | 'hat' | 'armL' | 'armR' | 'legL' | 'legR' | 'apron'

function geos(): Record<PartKey, THREE.BufferGeometry> {
  const torso = new THREE.CapsuleGeometry(0.21, 0.42, 3, 10)
  torso.scale(1, 1, 0.75)
  const head = new THREE.SphereGeometry(0.145, 12, 9)
  const hair = new THREE.SphereGeometry(0.158, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.55)
  hair.translate(0, 0.01, 0.015)
  const brim = new THREE.CylinderGeometry(1, 1, 0.03, 16)
  const crown = new THREE.CylinderGeometry(0.62, 0.7, 1, 14)
  crown.translate(0, 0.5, 0)
  const hat = mergeTwo(brim, crown)
  const arm = new THREE.CapsuleGeometry(0.055, 0.46, 2, 6)
  arm.translate(0, -0.27, 0)
  const leg = new THREE.CapsuleGeometry(0.085, 0.66, 2, 6)
  leg.translate(0, -0.41, 0)
  const apron = new THREE.BoxGeometry(0.34, 0.5, 0.03)
  return { torso, head, hair, hat, armL: arm, armR: arm.clone(), legL: leg, legR: leg.clone(), apron }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let base = 0
  for (const g of [a, b]) {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    const ix = g.index!
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base)
    base += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}

interface Rt { def: FolkDef; stop: Stop | null; s: number; dir: number; pos: THREE.Vector3; yaw: number; t: number; phase: number; visible: boolean }

const _root = new THREE.Matrix4()
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

export class Folk {
  readonly group = new THREE.Group()
  private readonly rts: Rt[]
  private readonly meshes: Record<PartKey, THREE.InstancedMesh>
  private active: ReadonlySet<DistrictId> | null = null
  private time = 0

  constructor(mats: Mats) {
    this.group.name = 'drift-habitants'
    const mat = mats.cel({ color: 0xffffff, indoor: true, rim: 0.7, shadowColor: 0x6a5a7a })
    const g = geos()
    const n = ROSTER.length
    this.meshes = {} as Record<PartKey, THREE.InstancedMesh>
    for (const key of Object.keys(g) as PartKey[]) {
      const im = new THREE.InstancedMesh(g[key], mat, n)
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      im.frustumCulled = false
      im.name = `habitants:${key}`
      this.meshes[key] = im
      this.group.add(im)
    }
    const c = new THREE.Color()
    ROSTER.forEach((d, i) => {
      this.meshes.torso.setColorAt(i, c.set(d.clothes))
      this.meshes.apron.setColorAt(i, c.set(d.id === 'nour' || d.id === 'mme-cassis' ? PAL.toile : d.clothes).multiplyScalar(0.85))
      this.meshes.armL.setColorAt(i, c.set(d.clothes).multiplyScalar(0.92))
      this.meshes.armR.setColorAt(i, c.set(d.clothes).multiplyScalar(0.92))
      this.meshes.legL.setColorAt(i, c.set(d.trousers))
      this.meshes.legR.setColorAt(i, c.set(d.trousers))
      this.meshes.head.setColorAt(i, c.set(d.skin))
      this.meshes.hair.setColorAt(i, c.set(d.hair))
      this.meshes.hat.setColorAt(i, c.set(d.hat?.color ?? d.hair))
    })
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
      if (!shown) {
        for (const im of Object.values(this.meshes)) im.setMatrixAt(i, ZERO)
        return
      }
      if (stop!.path) this.walk(r, stop!.path, dt)
      this.pose(r, i, stop!.pose)
    })
    for (const im of Object.values(this.meshes)) {
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
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

  private pose(r: Rt, i: number, pose: Pose): void {
    const t = this.time + r.phase
    const h = r.def.height
    let hip = 0.9
    let lean = 0
    let legL = 0
    let legR = 0
    let armL = 0.08
    let armR = -0.08
    const armOut = 0.12
    let headPitch = 0
    let bob = 0
    let lying = false
    switch (pose) {
      case 'walk': {
        const k = Math.sin(t * 5.2)
        legL = k * 0.5
        legR = -k * 0.5
        armL = -k * 0.45
        armR = k * 0.45
        bob = Math.abs(Math.cos(t * 5.2)) * 0.04
        lean = 0.06
        break
      }
      case 'work':
        lean = 0.32 + Math.sin(t * 1.8) * 0.06
        armL = 0.9 + Math.sin(t * 3.1) * 0.35
        armR = 0.9 - Math.sin(t * 3.1) * 0.35
        headPitch = 0.35
        break
      case 'sit':
        hip = 0.46
        legL = 1.45
        legR = 1.4
        armL = 0.35
        armR = 0.3
        lean = 0.1 + Math.sin(t * 0.6) * 0.03
        break
      case 'look':
        headPitch = -0.18 + Math.sin(t * 0.4) * 0.05
        armL = 0.25
        armR = 0.25
        break
      case 'sleep':
        lying = true
        break
      default:
        lean = Math.sin(t * 0.7) * 0.03
        armL = 0.05 + Math.sin(t * 0.9) * 0.05
        armR = -0.05 - Math.sin(t * 0.9) * 0.05
    }
    _e.set(lying ? Math.PI / 2 : 0, -r.yaw, 0, 'YXZ')
    _q.setFromEuler(_e)
    const baseY = lying ? r.pos.y + 0.12 : r.pos.y - (pose === 'sit' ? 0.46 : 0)
    _root.compose(_v.set(r.pos.x, baseY + bob, r.pos.z), _q, _s.setScalar(h))
    if (lying) _root.multiply(_m.makeTranslation(0, -0.9, 0))
    const part = (key: PartKey, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx = 1, sy = 1, sz = 1) => {
      _e.set(rx, ry, rz, 'XYZ')
      _q.setFromEuler(_e)
      _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz))
      this.meshes[key].setMatrixAt(i, _m.premultiply(_root))
    }
    const tq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -lean)
    const torsoC = new THREE.Vector3(0, 0.36, 0).applyQuaternion(tq).add(new THREE.Vector3(0, hip, 0))
    const shoulder = new THREE.Vector3(0, 0.55, 0).applyQuaternion(tq).add(new THREE.Vector3(0, hip, 0))
    const neck = new THREE.Vector3(0, 0.78, 0).applyQuaternion(tq).add(new THREE.Vector3(0, hip, 0))
    part('torso', torsoC.x, torsoC.y, torsoC.z, -lean, 0, 0)
    part('apron', 0, torsoC.y - 0.12, torsoC.z - 0.17, -lean, 0, 0)
    part('head', neck.x, neck.y, neck.z, -headPitch - lean * 0.5, 0, 0)
    part('hair', neck.x, neck.y, neck.z, -headPitch - lean * 0.5, 0, 0)
    const hat = r.def.hat
    if (hat) part('hat', neck.x, neck.y + 0.11, neck.z, -headPitch - lean * 0.5, 0, 0, hat.brim, hat.crown + 0.04, hat.brim)
    else this.meshes.hat.setMatrixAt(i, ZERO)
    part('armL', -0.26, shoulder.y, shoulder.z, armL, 0, armOut)
    part('armR', 0.26, shoulder.y, shoulder.z, armR, 0, -armOut)
    part('legL', -0.1, hip, 0, legL, 0, 0.02)
    part('legR', 0.1, hip, 0, legR, 0, -0.02)
  }

  dispose(): void {
    for (const im of Object.values(this.meshes)) im.geometry.dispose()
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
