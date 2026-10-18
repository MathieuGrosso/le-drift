import * as THREE from 'three'
import type { GameContext } from '../core/types'

const N = 30
const SLACK = 1.8

export class Longe {
  readonly mesh: THREE.InstancedMesh
  private p: THREE.Vector3[] = []
  private prev: THREE.Vector3[] = []
  private ready = false
  private tmp = new THREE.Vector3()
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private s = new THREE.Vector3()
  private yAxis = new THREE.Vector3(0, 1, 0)
  private payout = 0

  constructor(ctx: GameContext) {
    const g = new THREE.CylinderGeometry(0.022, 0.022, 1, 5, 1, true)
    g.translate(0, 0.5, 0)
    const mat = ctx.services.render?.cel({ color: 0xe6cf9e, shadowColor: 0x6b5a48, caustics: false })
      ?? new THREE.MeshBasicMaterial({ color: 0xe6cf9e })
    this.mesh = new THREE.InstancedMesh(g, mat, N - 1)
    this.mesh.name = 'hero-longe'
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    for (let i = 0; i < N; i++) {
      this.p.push(new THREE.Vector3())
      this.prev.push(new THREE.Vector3())
    }
  }

  hide(): void {
    this.mesh.visible = false
    this.ready = false
  }

  update(dt: number, from: THREE.Vector3, to: THREE.Vector3, maxLength: number, flow: THREE.Vector3): void {
    const dist = from.distanceTo(to)
    const want = Math.min(maxLength, dist + SLACK)
    this.payout = this.ready ? this.payout + THREE.MathUtils.clamp(want - this.payout, -3 * dt, 6 * dt) : want
    this.payout = Math.max(this.payout, Math.min(dist, maxLength))
    if (!this.ready) {
      for (let i = 0; i < N; i++) {
        const k = i / (N - 1)
        this.p[i]!.lerpVectors(from, to, k)
        this.p[i]!.y -= Math.sin(k * Math.PI) * 0.6
        this.prev[i]!.copy(this.p[i]!)
      }
      this.ready = true
    }
    const seg = Math.max(dist, this.payout) / (N - 1)
    const h = Math.min(dt, 1 / 30)
    for (let i = 1; i < N - 1; i++) {
      const p = this.p[i]!
      const q = this.prev[i]!
      const vx = (p.x - q.x) / h
      const vy = (p.y - q.y) / h
      const vz = (p.z - q.z) / h
      const drag = 1.6
      const ax = (flow.x - vx) * drag
      const ay = (flow.y - vy) * drag - 0.45
      const az = (flow.z - vz) * drag
      q.copy(p)
      p.set(p.x + vx * h * 0.98 + ax * h * h, p.y + vy * h * 0.98 + ay * h * h, p.z + vz * h * 0.98 + az * h * h)
    }
    for (let it = 0; it < 10; it++) {
      this.p[0]!.copy(from)
      this.p[N - 1]!.copy(to)
      for (let i = 1; i < N; i++) {
        const a = this.p[i - 1]!
        const b = this.p[i]!
        this.tmp.subVectors(b, a)
        const d = this.tmp.length() || 1e-6
        if (d <= seg) continue
        const diff = (d - seg) / d
        const wa = i === 1 ? 0 : 0.5
        const wb = i === N - 1 ? 0 : 0.5
        const sum = wa + wb || 1
        a.addScaledVector(this.tmp, (diff * wa) / sum)
        b.addScaledVector(this.tmp, (-diff * wb) / sum)
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const a = this.p[i]!
      this.tmp.subVectors(this.p[i + 1]!, a)
      const len = this.tmp.length()
      this.q.setFromUnitVectors(this.yAxis, this.tmp.divideScalar(len || 1))
      this.s.set(1, len, 1)
      this.m.compose(a, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.visible = true
  }

  get taut(): boolean {
    return this.ready && this.p[0]!.distanceTo(this.p[N - 1]!) > this.payout - 0.05
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
  }
}
