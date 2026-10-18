import * as THREE from 'three'
import { PALETTE } from './model'

export interface ScarfInput {
  anchor: THREE.Vector3
  right: THREE.Vector3
  flow: THREE.Vector3
  inWater: boolean
  wetness: number
  t: number
  colliders: { c: THREE.Vector3; r: number }[]
  floorY: number
  gravity: THREE.Vector3
}

interface TailDef {
  n: number
  length: number
  width0: number
  width1: number
  side: number
  fwd: number
  drop: number
  phase: number
}

const RING = 14
const THICK = 0.017

const TAILS: readonly TailDef[] = [
  { n: 20, length: 0.98, width0: 0.07, width1: 0.078, side: 0.04, fwd: 0, drop: 0.0, phase: 0 },
  { n: 9, length: 0.36, width0: 0.05, width1: 0.064, side: -0.06, fwd: 0.18, drop: 0.045, phase: 1.7 },
]

class Tail {
  readonly p: THREE.Vector3[] = []
  readonly prev: THREE.Vector3[] = []
  readonly seg: number
  constructor(readonly def: TailDef, readonly vertexOffset: number) {
    this.seg = def.length / (def.n - 1)
    for (let i = 0; i < def.n; i++) {
      this.p.push(new THREE.Vector3(0, -i * this.seg, 0))
      this.prev.push(new THREE.Vector3(0, -i * this.seg, 0))
    }
  }
}

export class Scarf {
  readonly mesh: THREE.Mesh
  private tails: Tail[] = []
  private geo: THREE.BufferGeometry
  private pos: Float32Array
  private dir = new THREE.Vector3()
  private side = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  private acc = new THREE.Vector3()
  private back = new THREE.Vector3()
  private root = new THREE.Vector3()
  private rel = new THREE.Vector3()
  private lastAnchor = new THREE.Vector3()
  private anchorVel = new THREE.Vector3()
  private settle = true
  private hasRight = false

  constructor(material: THREE.Material) {
    let verts = 0
    for (const d of TAILS) {
      this.tails.push(new Tail(d, verts))
      verts += d.n * RING
    }
    this.geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(verts * 3)
    const col = new Float32Array(verts * 3)
    const base = new THREE.Color(PALETTE.echarpe)
    const band = new THREE.Color(0xc9a54b)
    const tip = new THREE.Color(0xf2b27a)
    const c = new THREE.Color()
    const idx: number[] = []
    for (const tail of this.tails) {
      const n = tail.def.n
      const long = n > 10
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1)
        for (let j = 0; j < RING; j++) {
          c.copy(base)
          if (long && (Math.abs(k - 0.8) < 0.025 || Math.abs(k - 0.87) < 0.025)) c.copy(band)
          if (k > 0.94) c.lerp(tip, 0.55)
          const face = Math.abs(Math.cos((j / RING) * Math.PI * 2))
          const rib = j % 2 === 0 ? 1.0 : 0.82
          c.multiplyScalar(face > 0.92 ? 0.8 : rib * (i % 2 === 0 ? 1 : 0.95))
          col.set([c.r, c.g, c.b], (tail.vertexOffset + i * RING + j) * 3)
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < RING; j++) {
          const a = tail.vertexOffset + i * RING + j
          const b = tail.vertexOffset + i * RING + ((j + 1) % RING)
          idx.push(a, a + RING, b, b, a + RING, b + RING)
        }
      }
    }
    this.geo.setIndex(idx)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.mesh = new THREE.Mesh(this.geo, material)
    this.mesh.name = 'hero-scarf'
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
  }

  reset(anchor: THREE.Vector3): void {
    const bx = this.hasRight ? this.back.x : 0
    const bz = this.hasRight ? this.back.z : 1
    for (const tail of this.tails) {
      for (let i = 0; i < tail.def.n; i++) {
        const back = Math.min(i, 3) * tail.seg * 0.5
        tail.p[i]!.set(anchor.x + bx * back, anchor.y - i * tail.seg * 0.9, anchor.z + bz * back)
        tail.prev[i]!.copy(tail.p[i]!)
      }
    }
    this.lastAnchor.copy(anchor)
    this.anchorVel.set(0, 0, 0)
    this.settle = true
  }

  carry(delta: THREE.Vector3, turn: number, pivot: THREE.Vector3): void {
    const move = (p: THREE.Vector3) => {
      if (turn !== 0) {
        this.tmp.subVectors(p, pivot).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -turn)
        p.copy(pivot).add(this.tmp)
      }
      p.add(delta)
    }
    for (const tail of this.tails) {
      for (let i = 0; i < tail.def.n; i++) {
        move(tail.p[i]!)
        move(tail.prev[i]!)
      }
    }
    move(this.lastAnchor)
  }

  update(dt: number, s: ScarfInput): void {
    if (!(dt > 0)) return
    if (this.lastAnchor.distanceToSquared(s.anchor) > 25) this.reset(s.anchor)
    this.anchorVel.subVectors(s.anchor, this.lastAnchor).divideScalar(dt)
    this.lastAnchor.copy(s.anchor)
    this.back.set(-s.right.z, 0, s.right.x)
    this.hasRight = true
    if (this.settle) {
      this.settle = false
      this.anchorVel.set(0, 0, 0)
      for (let st = 0; st < 150; st++) for (const tail of this.tails) this.stepTail(tail, s, 1 / 90, 1)
    }
    const steps = 3
    const h = Math.min(dt, 1 / 30) / steps
    for (let st = 0; st < steps; st++) {
      const k = (st + 1) / steps
      for (const tail of this.tails) this.stepTail(tail, s, h, k)
    }
    this.writeMesh(s)
  }

  private stepTail(tail: Tail, s: ScarfInput, h: number, k: number): void {
    const { n, side, drop, phase } = tail.def
    const seg = tail.seg
    const heavy = THREE.MathUtils.clamp(s.wetness * 1.5 - 0.5, 0, 1)
    this.root.copy(s.anchor).addScaledVector(this.anchorVel, (k - 1) * h * 3)
    this.root.addScaledVector(s.right, side).addScaledVector(this.back, -tail.def.fwd)
    this.root.y -= drop
    const p0 = tail.p[0]!
    tail.prev[0]!.copy(p0)
    p0.copy(this.root)
    for (let i = 1; i < n; i++) {
      const p = tail.p[i]!
      const q = tail.prev[i]!
      const vx = (p.x - q.x) / h
      const vy = (p.y - q.y) / h
      const vz = (p.z - q.z) / h
      const along = i / (n - 1)
      if (s.inWater) {
        const drag = 2.4
        const wave = Math.sin(s.t * 3.1 - i * 0.55 + phase)
        const flutter = wave * (0.5 + i * 0.12)
        this.acc.set(
          (s.flow.x - vx) * drag + s.right.x * flutter,
          (s.flow.y - vy) * drag + 0.7 + Math.cos(s.t * 2.3 - i * 0.6 + phase) * 0.4,
          (s.flow.z - vz) * drag + s.right.z * flutter,
        )
      } else {
        const drag = 0.55 + heavy * 0.9
        this.acc.set(s.gravity.x - vx * drag, s.gravity.y - vy * drag, s.gravity.z - vz * drag)
        this.rel.set(vx, vy, vz)
        const sp = this.rel.length()
        if (sp > 1.4 && heavy < 0.9) {
          this.side.crossVectors(this.rel, THREE.Object3D.DEFAULT_UP)
          if (this.side.lengthSq() < 1e-6) this.side.copy(s.right)
          this.side.normalize()
          const flap = Math.sin(s.t * (11 + i * 0.6) - i * 0.9 + phase) * Math.min(sp - 1.4, 6) ** 1.15 * 0.9 * along * (1 - heavy)
          this.acc.addScaledVector(this.side, flap)
          this.acc.y += Math.cos(s.t * 9.3 - i * 0.7 + phase) * flap * 0.4
        }
      }
      const damp = s.inWater ? 0.985 : 0.993 - heavy * 0.012
      q.copy(p)
      p.set(
        p.x + vx * h * damp + this.acc.x * h * h,
        p.y + vy * h * damp + this.acc.y * h * h,
        p.z + vz * h * damp + this.acc.z * h * h,
      )
    }
    const settle = this.tmp.copy(this.root).addScaledVector(this.back, seg * (tail.def.fwd > 0 ? -0.6 : 0.55))
    settle.y -= seg * 0.8
    tail.p[1]!.lerp(settle, 0.18)
    for (let it = 0; it < 5; it++) {
      p0.copy(this.root)
      for (let i = 1; i < n; i++) {
        const a = tail.p[i - 1]!
        const b = tail.p[i]!
        this.tmp.subVectors(b, a)
        const d = this.tmp.length() || 1e-6
        const diff = (d - seg) / d
        if (i === 1) b.addScaledVector(this.tmp, -diff)
        else {
          a.addScaledVector(this.tmp, diff * 0.5)
          b.addScaledVector(this.tmp, -diff * 0.5)
        }
      }
      const bendMin = seg * 1.55
      for (let i = 2; i < n; i++) {
        const a = tail.p[i - 2]!
        const b = tail.p[i]!
        this.tmp.subVectors(b, a)
        const d = this.tmp.length() || 1e-6
        if (d >= bendMin) continue
        const corr = (bendMin - d) / d * 0.25
        if (i - 2 > 0) a.addScaledVector(this.tmp, -corr)
        b.addScaledVector(this.tmp, corr)
      }
      for (let i = 1; i < n; i++) {
        const b = tail.p[i]!
        if (b.y < s.floorY + 0.03) {
          b.y = s.floorY + 0.03
          const q = tail.prev[i]!
          q.x += (b.x - q.x) * 0.35
          q.z += (b.z - q.z) * 0.35
        }
        for (const col of s.colliders) {
          this.tmp.subVectors(b, col.c)
          const d = this.tmp.length()
          if (d < col.r && d > 1e-5) b.addScaledVector(this.tmp, (col.r - d) / d)
        }
      }
    }
  }

  private writeMesh(s: ScarfInput): void {
    const pos = this.pos
    const nrm = this.geo.getAttribute('normal') as THREE.BufferAttribute
    const flat = this.acc
    for (const tail of this.tails) {
      const { n, width0, width1, phase } = tail.def
      for (let i = 0; i < n; i++) {
        const a = tail.p[Math.max(0, i - 1)]!
        const b = tail.p[Math.min(n - 1, i + 1)]!
        this.dir.subVectors(b, a).normalize()
        this.side.copy(s.right).addScaledVector(this.dir, -s.right.dot(this.dir))
        if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0)
        this.side.normalize()
        const k = i / (n - 1)
        const twist = Math.sin(s.t * 1.7 + i * 0.45 + phase) * 0.4 * k + Math.sin(i * 0.7 + phase) * 0.25 * k
        this.side.applyAxisAngle(this.dir, twist)
        flat.crossVectors(this.side, this.dir).normalize()
        const w = (width0 + (width1 - width0) * k) * (i === 0 ? 0.6 : 1) * (1 + Math.sin(i * 1.3 + phase) * 0.1)
        const cup = Math.sin(i * 0.9 + phase * 2) * w * 0.35
        const th = (i === n - 1 ? 0.25 : 1) * THICK * (i % 2 === 0 ? 1.12 : 0.9)
        const fringe = i === n - 1 ? 0.035 : 0
        const p = tail.p[i]!
        for (let j = 0; j < RING; j++) {
          const ang = (j / RING) * Math.PI * 2
          const u = Math.cos(ang)
          const v = Math.sin(ang)
          const along = fringe * (j % 2)
          const off = cup * (1 - u * u)
          const o = (tail.vertexOffset + i * RING + j) * 3
          pos[o] = p.x + this.side.x * u * w + flat.x * (v * th + off) + this.dir.x * along
          pos[o + 1] = p.y + this.side.y * u * w + flat.y * (v * th + off) + this.dir.y * along
          pos[o + 2] = p.z + this.side.z * u * w + flat.z * (v * th + off) + this.dir.z * along
          const nx = this.side.x * u * th + flat.x * v * w - this.side.x * u * cup * 0.6
          const ny = this.side.y * u * th + flat.y * v * w - this.side.y * u * cup * 0.6
          const nz = this.side.z * u * th + flat.z * v * w - this.side.z * u * cup * 0.6
          const l = Math.hypot(nx, ny, nz) || 1
          nrm.setXYZ(tail.vertexOffset + i * RING + j, nx / l, ny / l, nz / l)
        }
      }
    }
    ;(this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    nrm.needsUpdate = true
  }

  point(i: number): THREE.Vector3 {
    const t = this.tails[0]!
    return t.p[Math.max(0, Math.min(t.def.n - 1, i))]!
  }
}
