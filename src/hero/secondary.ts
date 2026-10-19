import * as THREE from 'three'
import type { HeroModel } from './model'

const DOWN = new THREE.Vector3(0, -1, 0)

export class Secondary {
  private blinkIn = 2
  private blinkT = -1
  private double = false
  private tip = new THREE.Vector3()
  private prev = new THREE.Vector3()
  private root = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private q = new THREE.Quaternion()
  private ready = false
  private readonly len = 0.07

  constructor(private model: HeroModel) {}

  reset(): void {
    this.ready = false
  }

  carry(delta: THREE.Vector3, turn: number, pivot: THREE.Vector3): void {
    for (const p of [this.tip, this.prev]) {
      if (turn !== 0) p.sub(pivot).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -turn).add(pivot)
      p.add(delta)
    }
  }

  update(dt: number, gravity: THREE.Vector3, opts: { lids: number; inWater: boolean; flow: THREE.Vector3 }): void {
    this.blink(dt, opts.lids)
    this.hair(dt, gravity, opts.inWater, opts.flow)
  }

  private blink(dt: number, lids: number): void {
    this.blinkIn -= dt
    if (this.blinkIn <= 0 && this.blinkT < 0) {
      this.blinkT = 0
      this.double = Math.random() < 0.2
      this.blinkIn = 2.2 + Math.random() * 3.5
    }
    let shut = 0
    if (this.blinkT >= 0) {
      this.blinkT += dt
      const dur = this.double ? 0.36 : 0.15
      const k = this.blinkT / 0.15
      shut = this.double && this.blinkT > 0.18 ? Math.sin(Math.min(1, (this.blinkT - 0.18) / 0.15) * Math.PI) : Math.sin(Math.min(1, k) * Math.PI)
      if (this.blinkT > dur) this.blinkT = -1
    }
    const c = Math.max(shut, lids)
    this.model.eyes.scale.set(1, Math.max(0.08, 1 - c), 1)
  }

  private hair(dt: number, gravity: THREE.Vector3, inWater: boolean, flow: THREE.Vector3): void {
    const tuft = this.model.tuft
    tuft.updateWorldMatrix(true, false)
    tuft.getWorldPosition(this.root)
    if (!this.ready || this.tip.distanceToSquared(this.root) > 1) {
      this.tip.copy(this.root).addScaledVector(DOWN, this.len)
      this.prev.copy(this.tip)
      this.ready = true
    }
    const h = Math.min(dt, 1 / 30)
    if (h > 0) {
      const damp = inWater ? 0.9 : 0.965
      const vx = (this.tip.x - this.prev.x) * damp
      const vy = (this.tip.y - this.prev.y) * damp
      const vz = (this.tip.z - this.prev.z) * damp
      this.prev.copy(this.tip)
      const g = inWater ? 0.15 : 1
      this.tip.x += vx + (gravity.x * g + (inWater ? flow.x * 2 : 0)) * h * h
      this.tip.y += vy + (gravity.y * g + (inWater ? 1.2 : 0)) * h * h
      this.tip.z += vz + (gravity.z * g + (inWater ? flow.z * 2 : 0)) * h * h
    }
    this.dir.subVectors(this.tip, this.root)
    const d = this.dir.length() || 1e-6
    this.tip.copy(this.root).addScaledVector(this.dir, this.len / d)
    const parent = tuft.parent
    if (!parent) return
    parent.getWorldQuaternion(this.q).invert()
    this.dir.normalize().applyQuaternion(this.q)
    if (this.dir.z < 0.15) this.dir.z = 0.15
    if (this.dir.y > 0.3) this.dir.y = 0.3
    this.dir.normalize()
    tuft.quaternion.setFromUnitVectors(DOWN, this.dir)
  }
}
