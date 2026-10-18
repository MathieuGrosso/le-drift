import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import { mantaGeometry } from './models'
import type { Rider } from './rider'
import { yawOf } from './rider'
import { celMaterial, clampWaterY, currentAt, floorAt, patchVertex, writeBasis } from './shared'

export const MANTA_EDDY = { x: 470, z: 330, radius: 9 }
const SEAT = new THREE.Vector3(0, 0.42, 0.15)

type MantaState = 'absent' | 'coincee' | 'libre' | 'montee'

/** La raie manta: caught circling in an eddy (a2-raie), then tamed: follows the whistle and can be ridden. */
export class Manta {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.Mesh
  private readonly flap = { value: 0 }
  private readonly amp = { value: 1 }
  private state: MantaState = 'absent'
  private readonly p = new THREE.Vector3()
  private readonly v = new THREE.Vector3(0, 0, 1)
  private readonly goal = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private readonly rng: () => number
  private yaw = 0
  private pitch = 0
  private speed = 3
  private called = 0
  private angle = 0
  private readonly seat = new THREE.Vector3()
  private readonly basis = new Float32Array(16)
  private readonly handle: { position: Vec3; mount(): void; dismount(): void }

  constructor(private readonly ctx: GameContext, private readonly rider: Rider) {
    this.rng = ctx.rng('fauna:manta')
    const mat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.7, side: THREE.DoubleSide })
    patchVertex(mat, {
      key: 'manta',
      uniforms: { uMantaPhase: this.flap, uMantaAmp: this.amp },
      header: 'uniform float uMantaPhase;\nuniform float uMantaAmp;',
      vertex: `float mx = abs(position.x);
float mw = pow(clamp((mx - 0.35) / 2.3, 0.0, 1.0), 1.4);
transformed.y += sin(uMantaPhase - mx * 0.9) * 0.95 * mw * uMantaAmp;
transformed.y += sin(uMantaPhase * 0.5 - position.z * 1.2) * 0.12 * smoothstep(-0.8, -3.2, position.z);`,
    })
    this.mesh = new THREE.Mesh(mantaGeometry(), mat)
    this.mesh.matrixAutoUpdate = false
    this.mesh.name = 'fauna-manta'
    this.group.add(this.mesh)
    this.group.visible = false
    this.handle = {
      position: this.p,
      mount: () => this.mount(),
      dismount: () => this.dismount(),
    }
  }

  get tamed(): boolean {
    const s = this.ctx.state
    return !!s.flags['raie-apprivoisee'] || s.quests['a2-raie'] === 'done'
  }

  api(): { position: Vec3; mount(): void; dismount(): void } | null {
    return this.state === 'absent' ? null : this.handle
  }

  spawnCaught(): void {
    if (this.state !== 'absent') return
    this.state = 'coincee'
    const y = floorAt(this.ctx, MANTA_EDDY.x, MANTA_EDDY.z) + 7
    this.p.set(MANTA_EDDY.x + MANTA_EDDY.radius, y, MANTA_EDDY.z)
    this.group.visible = true
  }

  mount(): void {
    if (this.state !== 'libre' || !this.tamed) return
    const hero = this.ctx.state.hero.position
    if (this.p.distanceTo(this.tmp.set(hero.x, hero.y, hero.z)) > 6) return
    if (!this.rider.begin('manta')) return
    this.state = 'montee'
    this.yaw = yawOf(this.v.x, this.v.z)
  }

  dismount(): void {
    if (this.state !== 'montee') return
    this.state = 'libre'
    this.rider.end()
  }

  update(dt: number): void {
    const ctx = this.ctx
    if (this.state === 'absent') {
      if (this.tamed && ctx.state.act >= 2) {
        const h = ctx.state.hero.position
        this.p.set(h.x + 30, clampWaterY(ctx, h.x + 30, h.y + 4, h.z, 4), h.z)
        this.state = 'libre'
        this.group.visible = true
      } else return
    }
    if (this.state === 'coincee' && this.tamed) this.state = 'libre'
    const hero = ctx.state.hero.position
    const inWater = ctx.state.hero.medium === 'water'
    if (this.state === 'libre' && inWater && ctx.input.pressed('whistle')) this.called = 20

    let vx = 0, vy = 0, vz = 0
    if (this.state === 'coincee') {
      this.angle += dt * 0.35
      const y = floorAt(ctx, MANTA_EDDY.x, MANTA_EDDY.z) + 7 + Math.sin(this.angle * 2.3) * 1.5
      const tx = MANTA_EDDY.x + Math.cos(this.angle) * MANTA_EDDY.radius
      const tz = MANTA_EDDY.z + Math.sin(this.angle) * MANTA_EDDY.radius
      const k = Math.min(1, dt * 2) / Math.max(dt, 1e-3)
      vx = (tx - this.p.x) * k
      vy = (y - this.p.y) * k
      vz = (tz - this.p.z) * k
    } else if (this.state === 'libre') {
      this.called = Math.max(0, this.called - dt)
      const dHero = Math.hypot(hero.x - this.p.x, hero.z - this.p.z)
      if (this.called > 0 || (inWater && dHero > 28)) {
        this.goal.set(hero.x + 2.5, hero.y + 0.6, hero.z + 2.5)
      } else if (this.p.distanceTo(this.goal) < 4 || this.goal.lengthSq() === 0) {
        const a = this.rng() * Math.PI * 2
        const base = inWater ? hero : this.p
        this.goal.set(base.x + Math.cos(a) * 18, 0, base.z + Math.sin(a) * 18)
        this.goal.y = clampWaterY(ctx, this.goal.x, (inWater ? hero.y : this.p.y) + 3, this.goal.z, 3)
      }
      const dx = this.goal.x - this.p.x, dy = this.goal.y - this.p.y, dz = this.goal.z - this.p.z
      const d = Math.hypot(dx, dy, dz) + 1e-3
      const want = this.called > 0 ? Math.min(10, d * 0.8) : Math.min(3.5, d * 0.5)
      if (this.called > 0 && d < 3.5) this.called = 0
      this.speed += (want - this.speed) * Math.min(1, dt * 1.5)
      vx = this.v.x + (dx / d * this.speed - this.v.x) * Math.min(1, dt * 1.2)
      vy = this.v.y + (dy / d * this.speed - this.v.y) * Math.min(1, dt * 1.2)
      vz = this.v.z + (dz / d * this.speed - this.v.z) * Math.min(1, dt * 1.2)
    } else {
      const input = ctx.input
      if (input.pressed('interact') || !inWater) {
        this.dismount()
      } else {
        this.yaw += input.move.x * 1.5 * dt
        const throttle = 5 + Math.max(0, input.move.y) * 6 + (input.down('sprint') ? 4 : 0) - Math.max(0, -input.move.y) * 3.5
        this.speed += (throttle - this.speed) * Math.min(1, dt * 1.2)
        const climb = (input.down('up') ? 1 : 0) - (input.down('down') ? 1 : 0)
        this.pitch += (climb * 0.45 - this.pitch) * Math.min(1, dt * 2)
        const cur = currentAt(ctx, this.p)
        vx = Math.sin(this.yaw) * this.speed * Math.cos(this.pitch) + cur.x
        vy = Math.sin(this.pitch) * this.speed + cur.y * 0.5
        vz = -Math.cos(this.yaw) * this.speed * Math.cos(this.pitch) + cur.z
      }
    }
    this.v.set(vx, vy, vz)
    this.p.addScaledVector(this.v, dt)
    this.p.y = clampWaterY(ctx, this.p.x, this.p.y, this.p.z, 1.6, 2.5)
    const floor = floorAt(ctx, this.p.x, this.p.z)
    if (this.p.y - floor < 3) ctx.services.flora?.flatten(this.p, 3)

    const hs = Math.hypot(this.v.x, this.v.z)
    this.flap.value += dt * (1.1 + Math.min(hs, 15) * 0.18)
    this.amp.value = this.state === 'montee' ? 0.8 + Math.min(hs, 15) * 0.02 : 1
    writeBasis(this.basis, 0, this.p.x, this.p.y, this.p.z, this.v.x, this.v.y * 0.6, this.v.z, 1)
    this.mesh.matrix.fromArray(this.basis)
    this.mesh.matrixWorldNeedsUpdate = true
    this.seat.copy(SEAT).applyMatrix4(this.mesh.matrix)

    if (!ctx.services.gameplay && this.state === 'libre' && this.tamed && inWater) {
      const near = this.p.distanceTo(this.tmp.set(hero.x, hero.y, hero.z)) < 5
      if (near) {
        this.rider.hint('manta', 'Monter sur la raie')
        if (ctx.input.pressed('interact')) this.mount()
      } else this.rider.clearHint('manta')
    }
  }

  lateUpdate(): void {
    if (this.state === 'montee') this.rider.place(this.seat, this.yaw)
  }

  dispose(): void {
    if (this.state === 'montee') this.rider.end()
    this.group.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
