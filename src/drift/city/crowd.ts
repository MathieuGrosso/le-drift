import * as THREE from 'three'
import type { DistrictId, QualityLevel } from '../../core/types'
import type { Mats } from '../materials'
import { PAL } from '../palette'
import type { PathSpec, SpotSpec } from './kit'

interface Walker {
  district: DistrictId
  path: PathSpec | null
  len: number
  spot: SpotSpec | null
  s: number
  dir: number
  speed: number
  phase: number
  scale: number
  kid: boolean
  x: number; y: number; z: number; yaw: number
  from: number; to: number
  breakfast: boolean
}

const CLOTHES = [PAL.tissu1, PAL.tissu2, PAL.tissu3, PAL.teal, PAL.vertDoux, PAL.rouille, PAL.bleuDoux, PAL.laiton, PAL.creme, 0x8fbf6a, 0xb0405a]
const SKINS = [PAL.peau1, PAL.peau2, PAL.peau3, PAL.peau4]
const HAIRS = [PAL.cheveux1, PAL.cheveux2, PAL.cheveux3, PAL.cheveux4, PAL.cheveux1, PAL.tissu2, PAL.toile]
const MAX: Record<QualityLevel, number> = { high: 600, medium: 300, low: 120 }

function bodyGeo(): THREE.BufferGeometry {
  const torso = new THREE.CapsuleGeometry(0.2, 0.5, 3, 8)
  torso.scale(1, 1, 0.78)
  torso.translate(0, 1.08, 0)
  const skirt = new THREE.CylinderGeometry(0.2, 0.25, 0.78, 8)
  skirt.translate(0, 0.42, 0)
  return merge([torso, skirt])
}

function headGeo(): THREE.BufferGeometry {
  const head = new THREE.SphereGeometry(0.15, 10, 8)
  head.translate(0, 1.6, 0)
  return head
}

function hairGeo(): THREE.BufferGeometry {
  const cap = new THREE.SphereGeometry(0.163, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.55)
  cap.translate(0, 1.615, 0.015)
  const knot = new THREE.SphereGeometry(0.07, 6, 5)
  knot.translate(0, 1.7, 0.12)
  return merge([cap, knot])
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let base = 0
  for (const g of list) {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base)
    else for (let i = 0; i < p.count; i++) idx.push(i + base)
    base += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

// The many: cheap residents walking district paths and holding spots, by the hour.
export class Crowd {
  readonly group = new THREE.Group()
  private readonly walkers: Walker[] = []
  private readonly meshes: THREE.InstancedMesh[]
  private time = 0
  private active: ReadonlySet<DistrictId> | null = null

  constructor(mats: Mats, paths: readonly PathSpec[], spots: readonly SpotSpec[], quality: QualityLevel, seed = 4242) {
    this.group.name = 'drift-foule'
    let st = seed
    const rand = () => {
      st = (st * 16807) % 2147483647
      return st / 2147483647
    }
    for (const p of paths) {
      const len = pathLen(p)
      const n = Math.max(1, Math.round((len / 7) * p.busy))
      for (let i = 0; i < n; i++) this.walkers.push(this.make(p.district, p, null, rand, i / n))
    }
    for (const s of spots) if (rand() < 0.9) this.walkers.push(this.make(s.district, null, s, rand, 0))
    const max = MAX[quality]
    while (this.walkers.length > max) this.walkers.splice(Math.floor(rand() * this.walkers.length), 1)
    const n = this.walkers.length
    const mat = mats.cel({ color: 0xffffff, indoor: true, rim: 0.5, shadowColor: 0x6a5a7a })
    const body = new THREE.InstancedMesh(bodyGeo(), mat, Math.max(1, n))
    const head = new THREE.InstancedMesh(headGeo(), mat, Math.max(1, n))
    const hair = new THREE.InstancedMesh(hairGeo(), mat, Math.max(1, n))
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      body.setColorAt(i, c.set(CLOTHES[Math.floor(rand() * CLOTHES.length)]!).multiplyScalar(0.92 + rand() * 0.16))
      head.setColorAt(i, c.set(SKINS[Math.floor(rand() * SKINS.length)]!))
      hair.setColorAt(i, c.set(HAIRS[Math.floor(rand() * HAIRS.length)]!))
    }
    this.meshes = [body, head, hair]
    for (const im of this.meshes) {
      im.count = n
      im.frustumCulled = false
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      im.name = 'foule'
      this.group.add(im)
    }
  }

  private make(district: DistrictId, path: PathSpec | null, spot: SpotSpec | null, rand: () => number, t: number): Walker {
    const kid = rand() < 0.16
    const early = rand() < 0.5
    const len = path ? pathLen(path) : 0
    return {
      district, path, len, spot, s: t * len, dir: rand() < 0.5 ? 1 : -1, kid,
      speed: kid ? 1.4 + rand() * 0.5 : 0.75 + rand() * 0.55, phase: rand() * 10, scale: kid ? 0.66 : 0.9 + rand() * 0.18,
      x: spot?.x ?? 0, y: spot?.y ?? 0, z: spot?.z ?? 0, yaw: spot?.yaw ?? 0,
      from: path?.work || spot?.pose === 'work' ? 6 + rand() : early ? 5.8 + rand() * 1.6 : 7 + rand() * 3,
      to: district === 'machines' ? 24.5 : 19 + rand() * 3.5,
      breakfast: !spot || spot.pose !== 'work' ? rand() < 0.7 : false,
    }
  }

  setActive(loaded: ReadonlySet<DistrictId> | null): void {
    this.active = loaded
  }

  count(): number {
    return this.walkers.length
  }

  nearby(l: { x: number; y: number; z: number }, r: number, hours: number, max = 4): { id: string; x: number; y: number; z: number; district: DistrictId; kid: boolean }[] {
    const out: { id: string; x: number; y: number; z: number; district: DistrictId; kid: boolean }[] = []
    const r2 = r * r
    for (let i = 0; i < this.walkers.length && out.length < max; i++) {
      const w = this.walkers[i]!
      if (hours < w.from || hours >= w.to) continue
      if (this.active && !this.active.has(w.district)) continue
      const dx = w.x - l.x
      const dy = w.y - l.y
      const dz = w.z - l.z
      if (dx * dx + dy * dy + dz * dz < r2) out.push({ id: `foule-${i}`, x: w.x, y: w.y, z: w.z, district: w.district, kid: w.kid })
    }
    return out
  }

  update(dt: number, hours: number): void {
    this.time += dt
    const [body, head, hair] = this.meshes as [THREE.InstancedMesh, THREE.InstancedMesh, THREE.InstancedMesh]
    const meal = hours >= 7.5 && hours < 8.5
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i]!
      const h = w.to > 24 && hours < w.to - 24 ? hours + 24 : hours
      const out = h >= w.from && h < w.to && !(meal && w.breakfast)
      if (!out || (this.active && !this.active.has(w.district))) {
        body.setMatrixAt(i, ZERO)
        head.setMatrixAt(i, ZERO)
        hair.setMatrixAt(i, ZERO)
        continue
      }
      let bob = 0
      let lean = 0
      let roll = 0
      if (w.path) {
        const len = w.len
        w.s += w.speed * w.dir * dt
        if (w.path.loop) w.s = ((w.s % len) + len) % len
        else if (w.s > len) {
          w.s = len
          w.dir = -1
        } else if (w.s < 0) {
          w.s = 0
          w.dir = 1
        }
        const prevX = w.x
        const prevZ = w.z
        pointAt(w.path, w.s, _p)
        w.x = _p.x
        w.z = _p.z
        w.y = w.path.y
        if (Math.abs(w.x - prevX) + Math.abs(w.z - prevZ) > 1e-4) {
          const target = Math.atan2(w.x - prevX, -(w.z - prevZ))
          let d = target - w.yaw
          d = Math.atan2(Math.sin(d), Math.cos(d))
          w.yaw += d * Math.min(1, dt * 7)
        }
        const step = (this.time + w.phase) * w.speed * 5.5
        bob = Math.abs(Math.sin(step)) * (w.kid ? 0.07 : 0.045)
        roll = Math.sin(step) * 0.04
        lean = 0.05
      } else if (w.spot) {
        const pose = w.spot.pose
        if (pose === 'work') lean = 0.2 + Math.sin(this.time * 2 + w.phase) * 0.08
        else if (pose === 'lean') lean = 0.1 + Math.sin(this.time * 0.5 + w.phase) * 0.03
        else if (pose === 'talk') roll = Math.sin(this.time * 1.3 + w.phase) * 0.05
        bob = pose === 'sit' ? -0.42 : 0
      }
      _e.set(-lean, -w.yaw, roll, 'YXZ')
      _q.setFromEuler(_e)
      _m.compose(_p.set(w.x, w.y + bob, w.z), _q, _s.setScalar(w.scale))
      body.setMatrixAt(i, _m)
      head.setMatrixAt(i, _m)
      hair.setMatrixAt(i, _m)
    }
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    for (const im of this.meshes) im.geometry.dispose()
    this.group.removeFromParent()
  }
}

function pathLen(p: PathSpec): number {
  let l = 0
  const pts = p.pts
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)
  if (p.loop && pts.length > 2) l += Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.z - pts[pts.length - 1]!.z)
  return Math.max(l, 1e-3)
}

function pointAt(p: PathSpec, s: number, out: THREE.Vector3): void {
  const pts = p.pts
  const n = p.loop ? pts.length + 1 : pts.length
  let left = s
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1]!
    const b = pts[i % pts.length]!
    const l = Math.hypot(b.x - a.x, b.z - a.z)
    if (left <= l || i === n - 1) {
      const t = l > 0 ? Math.min(1, left / l) : 0
      out.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t)
      return
    }
    left -= l
  }
  out.set(pts[0]!.x, 0, pts[0]!.z)
}
