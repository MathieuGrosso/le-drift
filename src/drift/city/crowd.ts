import * as THREE from 'three'
import type { DistrictId, QualityLevel } from '../../core/types'
import type { Mats } from '../materials'
import { figureMaterial, instanceLooks, lookFor, rigGeometry, ROLE_FEATS, ROLES, touchLooks, writeLook, writePose, type Look, type Role } from '../people'
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
  look: Look
}

const MAX: Record<QualityLevel, number> = { high: 600, medium: 300, low: 120 }

const BY_DISTRICT: Partial<Record<DistrictId, Role[]>> = {
  marche: ['vendor', 'vendor', 'engineer', 'gardener', 'elder', 'kid', 'vendor', 'elder'],
  serres: ['gardener', 'gardener', 'gardener', 'elder', 'kid', 'engineer'],
  machines: ['engineer', 'engineer', 'engineer', 'engineer', 'elder'],
  ateliers: ['engineer', 'engineer', 'vendor', 'elder', 'kid'],
  nef: ['engineer', 'gardener', 'vendor', 'elder', 'kid', 'kid', 'cook'],
}
const ANY: Role[] = ['engineer', 'gardener', 'vendor', 'elder', 'kid']

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

// The many: cheap residents walking district paths and holding spots, by the hour.
export class Crowd {
  readonly group = new THREE.Group()
  private readonly walkers: Walker[] = []
  private readonly meshes = new Map<Role, THREE.InstancedMesh>()
  private time = 0
  private active: ReadonlySet<DistrictId> | null = null
  private shown: ReadonlySet<DistrictId> | null = null

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
    const mat = figureMaterial(mats, true)
    for (const role of ROLES) {
      const n = Math.max(1, this.walkers.filter((w) => w.look.role === role).length)
      const geo = rigGeometry(ROLE_FEATS[role])
      instanceLooks(geo, n, true)
      const im = new THREE.InstancedMesh(geo, mat, n)
      im.count = 0
      im.frustumCulled = false
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      im.name = `foule:${role}`
      this.meshes.set(role, im)
      this.group.add(im)
    }
  }

  private make(district: DistrictId, path: PathSpec | null, spot: SpotSpec | null, rand: () => number, t: number): Walker {
    const pool = BY_DISTRICT[district] ?? ANY
    const role: Role = spot && district === 'marche' && spot.pose !== 'sit' ? 'vendor' : pool[Math.floor(rand() * pool.length)]!
    const look = lookFor(role, rand)
    const kid = role === 'kid'
    const early = rand() < 0.5
    const len = path ? pathLen(path) : 0
    return {
      look,
      district, path, len, spot, s: t * len, dir: rand() < 0.5 ? 1 : -1, kid,
      speed: kid ? 1.4 + rand() * 0.5 : 0.75 + rand() * 0.55, phase: rand() * 10, scale: look.height,
      x: spot?.x ?? 0, y: spot?.y ?? 0, z: spot?.z ?? 0, yaw: spot?.yaw ?? 0,
      from: path?.work || spot?.pose === 'work' ? 6 + rand() : early ? 5.8 + rand() * 1.6 : 7 + rand() * 3,
      to: district === 'machines' ? 24.5 : 19 + rand() * 3.5,
      breakfast: !spot || spot.pose !== 'work' ? rand() < 0.7 : false,
    }
  }

  setActive(loaded: ReadonlySet<DistrictId> | null): void {
    this.active = loaded
  }

  setVisible(v: ReadonlySet<DistrictId> | null): void {
    this.shown = v
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
    const meal = hours >= 7.5 && hours < 8.5
    const slots = new Map<Role, number>()
    for (const r of ROLES) slots.set(r, 0)
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i]!
      const h = w.to > 24 && hours < w.to - 24 ? hours + 24 : hours
      const out = h >= w.from && h < w.to && !(meal && w.breakfast)
      if (!out || (this.active && !this.active.has(w.district))) continue
      const drawn = !this.shown || this.shown.has(w.district)
      let bob = 0
      let lean = 0
      let roll = 0
      let swing = 0
      let bend = 0
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
        bob = Math.abs(Math.sin(step)) * (w.kid ? 0.05 : 0.03)
        roll = Math.sin(step) * 0.03
        lean = 0.05
        swing = w.kid ? 0.6 : 0.45
      } else if (w.spot) {
        const pose = w.spot.pose
        if (pose === 'work') lean = 0.2 + Math.sin(this.time * 2 + w.phase) * 0.08
        else if (pose === 'lean') lean = 0.1 + Math.sin(this.time * 0.5 + w.phase) * 0.03
        else if (pose === 'talk') roll = Math.sin(this.time * 1.3 + w.phase) * 0.05
        if (pose === 'sit') {
          bend = 1.45
          bob = 0.46 - 0.8 * w.scale
        }
      }
      if (!drawn) continue
      const im = this.meshes.get(w.look.role)!
      const slot = slots.get(w.look.role)!
      slots.set(w.look.role, slot + 1)
      _e.set(-lean, -w.yaw, roll, 'YXZ')
      _q.setFromEuler(_e)
      _m.compose(_p.set(w.x, w.y + bob, w.z), _q, _s.setScalar(w.scale))
      im.setMatrixAt(slot, _m)
      writeLook(im.geometry, slot, w.look)
      writePose(im.geometry, slot, w.speed * 5.5, w.phase * w.speed * 5.5, swing, bend)
    }
    for (const [role, im] of this.meshes) {
      im.count = slots.get(role)!
      im.visible = im.count > 0
      im.instanceMatrix.needsUpdate = true
      touchLooks(im.geometry)
      ;(im.geometry.getAttribute('iPose') as THREE.InstancedBufferAttribute).needsUpdate = true
    }
  }

  dispose(): void {
    for (const im of this.meshes.values()) im.geometry.dispose()
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
