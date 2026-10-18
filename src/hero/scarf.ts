import * as THREE from 'three'
import { PALETTE } from './model'

const N = 12
const LENGTH = 1.6
const SEG = LENGTH / (N - 1)

export interface ScarfInput {
  anchor: THREE.Vector3
  right: THREE.Vector3
  flow: THREE.Vector3
  inWater: boolean
  wetness: number
  t: number
  colliders: { c: THREE.Vector3; r: number }[]
  floorY: number
}

export class Scarf {
  readonly mesh: THREE.Mesh
  private p: THREE.Vector3[] = []
  private prev: THREE.Vector3[] = []
  private pos: Float32Array
  private geo: THREE.BufferGeometry
  private dir = new THREE.Vector3()
  private side = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  private acc = new THREE.Vector3()

  constructor(material: THREE.Material) {
    for (let i = 0; i < N; i++) {
      this.p.push(new THREE.Vector3(0, -i * SEG, 0))
      this.prev.push(new THREE.Vector3(0, -i * SEG, 0))
    }
    this.geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(N * 2 * 3)
    const col = new Float32Array(N * 2 * 3)
    const c = new THREE.Color(PALETTE.echarpe)
    const tip = new THREE.Color(0xf7b267)
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1)
      const cc = c.clone().lerp(tip, k > 0.85 ? (k - 0.85) / 0.15 * 0.6 : 0)
      for (let j = 0; j < 2; j++) {
        col.set([cc.r, cc.g, cc.b], (i * 2 + j) * 3)
      }
    }
    const idx: number[] = []
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.geo.setIndex(idx)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.mesh = new THREE.Mesh(this.geo, material)
    this.mesh.name = 'hero-scarf'
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
  }

  reset(anchor: THREE.Vector3): void {
    for (let i = 0; i < N; i++) {
      this.p[i]!.set(anchor.x, anchor.y - i * SEG, anchor.z + i * 0.02)
      this.prev[i]!.copy(this.p[i]!)
    }
  }

  update(dt: number, s: ScarfInput): void {
    if (!(dt > 0)) return
    const anchorJump = this.p[0]!.distanceToSquared(s.anchor)
    if (anchorJump > 25) this.reset(s.anchor)
    const steps = 2
    const h = Math.min(dt, 1 / 30) / steps
    const heavy = THREE.MathUtils.clamp(s.wetness * 1.5 - 0.5, 0, 1)
    for (let st = 0; st < steps; st++) {
      this.p[0]!.copy(s.anchor)
      for (let i = 1; i < N; i++) {
        const p = this.p[i]!
        const q = this.prev[i]!
        const vx = (p.x - q.x) / h
        const vy = (p.y - q.y) / h
        const vz = (p.z - q.z) / h
        if (s.inWater) {
          const k = 2.6
          const wave = Math.sin(s.t * 3.1 - i * 0.55)
          const flutter = wave * (0.6 + i * 0.12)
          this.acc.set(
            (s.flow.x - vx) * k + s.right.x * flutter,
            (s.flow.y - vy) * k + 0.05 + Math.cos(s.t * 2.3 - i * 0.6) * 0.5,
            (s.flow.z - vz) * k + s.right.z * flutter,
          )
        } else {
          const drag = 0.6 + heavy * 0.8
          this.acc.set(-vx * drag, -9.81 - vy * drag, -vz * drag)
        }
        const damp = s.inWater ? 0.985 : 0.992 - heavy * 0.01
        q.copy(p)
        p.set(
          p.x + vx * h * damp + this.acc.x * h * h,
          p.y + vy * h * damp + this.acc.y * h * h,
          p.z + vz * h * damp + this.acc.z * h * h,
        )
      }
      for (let it = 0; it < 4; it++) {
        this.p[0]!.copy(s.anchor)
        for (let i = 1; i < N; i++) {
          const a = this.p[i - 1]!
          const b = this.p[i]!
          this.tmp.subVectors(b, a)
          const d = this.tmp.length() || 1e-6
          const diff = (d - SEG) / d
          if (i === 1) b.addScaledVector(this.tmp, -diff)
          else {
            a.addScaledVector(this.tmp, diff * 0.5)
            b.addScaledVector(this.tmp, -diff * 0.5)
          }
        }
        for (let i = 1; i < N; i++) {
          const b = this.p[i]!
          if (b.y < s.floorY + 0.03) {
            b.y = s.floorY + 0.03
            const q = this.prev[i]!
            q.x += (b.x - q.x) * 0.3
            q.z += (b.z - q.z) * 0.3
          }
          for (const col of s.colliders) {
            this.tmp.subVectors(b, col.c)
            const d = this.tmp.length()
            if (d < col.r && d > 1e-5) b.addScaledVector(this.tmp, (col.r - d) / d)
          }
        }
      }
    }
    this.writeMesh(s)
  }

  private writeMesh(s: ScarfInput): void {
    const pos = this.pos
    const nrm = this.geo.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < N; i++) {
      const a = this.p[Math.max(0, i - 1)]!
      const b = this.p[Math.min(N - 1, i + 1)]!
      this.dir.subVectors(b, a).normalize()
      this.side.copy(s.right).addScaledVector(this.dir, -s.right.dot(this.dir))
      if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0)
      this.side.normalize()
      const twist = Math.sin(s.t * 1.7 + i * 0.45) * 0.5 * (i / N)
      this.side.applyAxisAngle(this.dir, twist)
      const k = i / (N - 1)
      const w = (0.085 - k * 0.04) * (i === 0 ? 0.6 : 1)
      const p = this.p[i]!
      pos[i * 6] = p.x - this.side.x * w
      pos[i * 6 + 1] = p.y - this.side.y * w
      pos[i * 6 + 2] = p.z - this.side.z * w
      pos[i * 6 + 3] = p.x + this.side.x * w
      pos[i * 6 + 4] = p.y + this.side.y * w
      pos[i * 6 + 5] = p.z + this.side.z * w
      this.tmp.crossVectors(this.side, this.dir).normalize()
      nrm.setXYZ(i * 2, this.tmp.x, this.tmp.y, this.tmp.z)
      nrm.setXYZ(i * 2 + 1, this.tmp.x, this.tmp.y, this.tmp.z)
    }
    ;(this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    nrm.needsUpdate = true
  }

  tail(): THREE.Vector3 {
    return this.p[N - 1]!
  }

  point(i: number): THREE.Vector3 {
    return this.p[Math.max(0, Math.min(N - 1, i))]!
  }
}
