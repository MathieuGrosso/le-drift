import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import type { Bubbles } from './bubbles'
import { whaleGeometry } from './models'
import type { Rider } from './rider'
import { yawOf } from './rider'
import { celMaterial, floorAt, patchVertex, writeBasis } from './shared'

const SPEED = 3.6
const HALF_PATH = 320
const RIDE_SECONDS = 28
const SEAT = new THREE.Vector3(0, 1.95, 0.6)

/** A whale passing the hero on a long straight line. The hero can hold on to its back for a while. */
export class Whale {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.Mesh
  private readonly swim = { value: 0 }
  private active = false
  private readonly a = new THREE.Vector3()
  private readonly b = new THREE.Vector3()
  private u = 0
  private duration = 1
  private readonly p = new THREE.Vector3()
  private readonly dir = new THREE.Vector3()
  private nextBlow = 0
  private rideLeft = 0
  private readonly seat = new THREE.Vector3()
  private readonly basis = new Float32Array(16)
  private readonly tmp = new THREE.Vector3()
  private readonly rng: () => number

  constructor(private readonly ctx: GameContext, private readonly bubbles: Bubbles, private readonly rider: Rider) {
    this.rng = ctx.rng('fauna:whale')
    const mat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.6 })
    patchVertex(mat, {
      key: 'whale',
      uniforms: { uWhalePhase: this.swim },
      header: 'uniform float uWhalePhase;',
      vertex: `float wTail = smoothstep(2.0, -8.5, position.z);
transformed.y += sin(uWhalePhase - position.z * 0.26) * 0.85 * wTail * wTail;
transformed.y += sin(uWhalePhase * 0.5 + 1.3) * 0.15;`,
    })
    this.mesh = new THREE.Mesh(whaleGeometry(), mat)
    this.mesh.matrixAutoUpdate = false
    this.mesh.name = 'fauna-whale'
    this.group.add(this.mesh)
    this.group.visible = false
  }

  get isActive(): boolean {
    return this.active
  }

  get position(): Vec3 {
    return this.p
  }

  /** Starts a pass whose closest point is `lateral` metres from `around`. */
  pass(around: Vec3, lateral: number): void {
    const ctx = this.ctx
    const r = this.rng
    const ang = r() * Math.PI * 2
    this.dir.set(Math.cos(ang), 0, Math.sin(ang))
    const side = r() < 0.5 ? 1 : -1
    const cx = around.x - this.dir.z * lateral * side
    const cz = around.z + this.dir.x * lateral * side
    const cy = Math.min(100, Math.max(around.y + 7, floorAt(ctx, cx, cz) + 12))
    this.a.set(cx, cy, cz).addScaledVector(this.dir, -HALF_PATH)
    this.b.set(cx, cy, cz).addScaledVector(this.dir, HALF_PATH)
    this.u = 0
    this.duration = (HALF_PATH * 2) / SPEED
    this.active = true
    this.group.visible = true
    this.nextBlow = 4
    this.p.copy(this.a)
    ctx.bus.emit('whale:pass', { position: { x: cx, y: cy, z: cz } })
  }

  update(dt: number): void {
    if (!this.active) return
    const ctx = this.ctx
    this.u += dt / this.duration
    this.swim.value += dt * 1.15
    if (this.u >= 1) {
      this.stop()
      return
    }
    const prevX = this.p.x, prevY = this.p.y, prevZ = this.p.z
    this.p.lerpVectors(this.a, this.b, this.u)
    this.p.y += Math.sin(this.u * Math.PI * 3) * 3
    this.p.y = Math.max(this.p.y, floorAt(ctx, this.p.x, this.p.z) + 9)
    const dx = this.p.x - prevX, dy = this.p.y - prevY, dz = this.p.z - prevZ
    writeBasis(this.basis, 0, this.p.x, this.p.y, this.p.z, dx, dy * 0.5, dz, 1)
    this.mesh.matrix.fromArray(this.basis)
    this.mesh.matrixWorldNeedsUpdate = true

    this.nextBlow -= dt
    if (this.nextBlow <= 0) {
      this.nextBlow = 10 + this.rng() * 8
      const head = this.tmp.set(0, 1.7, 5.2).applyMatrix4(this.mesh.matrix)
      this.bubbles.burst(head.x, head.y, head.z, 40, 0.8, 2.4, 0.18)
    }

    this.seat.copy(SEAT).applyMatrix4(this.mesh.matrix)
    if (this.rider.mount === 'baleine') {
      this.rideLeft -= dt
      if (ctx.input.pressed('interact') || this.rideLeft <= 0 || this.u > 0.94) {
        this.rider.end()
        this.rider.clearHint('baleine')
      } else {
        this.rider.hint('baleine', 'Lâcher la baleine')
      }
      return
    }
    const hero = ctx.state.hero.position
    const near = this.seat.distanceTo(this.tmp.set(hero.x, hero.y + 0.9, hero.z)) < 6.5
    if (near && this.rider.canMount && this.u < 0.85) {
      this.rider.hint('baleine', "S'accrocher à la baleine")
      if (ctx.input.pressed('interact') && this.rider.begin('baleine')) this.rideLeft = RIDE_SECONDS
    } else {
      this.rider.clearHint('baleine')
    }
  }

  lateUpdate(): void {
    if (this.active && this.rider.mount === 'baleine') this.rider.place(this.seat, yawOf(this.dir.x, this.dir.z))
  }

  stop(): void {
    if (this.rider.mount === 'baleine') this.rider.end()
    this.rider.clearHint('baleine')
    this.active = false
    this.group.visible = false
  }

  dispose(): void {
    this.group.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
