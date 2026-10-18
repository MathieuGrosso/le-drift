import * as THREE from 'three'
import { CEILING_Y } from '../core/layout'
import type { GameContext } from '../core/types'
import { hideInstance, patchVertex } from './shared'

const BUBBLES = 600
const RINGS = 96

/** Bubble bursts and expanding rings under the ceiling. Two instanced draws. */
export class Bubbles {
  readonly group = new THREE.Group()
  private readonly bubbleMesh: THREE.InstancedMesh
  private readonly ringMesh: THREE.InstancedMesh
  private readonly ringAlpha: THREE.InstancedBufferAttribute
  private readonly bp = new Float32Array(BUBBLES * 3)
  private readonly bv = new Float32Array(BUBBLES * 3)
  private readonly bLife = new Float32Array(BUBBLES)
  private readonly bSize = new Float32Array(BUBBLES)
  private bNext = 0
  private readonly rp = new Float32Array(RINGS * 2)
  private readonly rAge = new Float32Array(RINGS).fill(-1)
  private readonly rDur = new Float32Array(RINGS)
  private readonly rMax = new Float32Array(RINGS)
  private rNext = 0
  private readonly rng: () => number

  constructor(ctx: GameContext) {
    this.rng = ctx.rng('fauna:bubbles')
    const bMat = new THREE.MeshBasicMaterial({ color: 0xeafff8, transparent: true, opacity: 0.55, depthWrite: false })
    ctx.services.render?.patchWater(bMat)
    this.bubbleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), bMat, BUBBLES)
    this.bubbleMesh.frustumCulled = false
    this.bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const bArr = this.bubbleMesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < BUBBLES; i++) hideInstance(bArr, i * 16)

    const rGeo = new THREE.RingGeometry(0.86, 1.0, 48).rotateX(Math.PI / 2)
    this.ringAlpha = new THREE.InstancedBufferAttribute(new Float32Array(RINGS), 1)
    this.ringAlpha.setUsage(THREE.DynamicDrawUsage)
    rGeo.setAttribute('aAlpha', this.ringAlpha)
    const rMat = new THREE.MeshBasicMaterial({ color: 0xf2fff8, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    ctx.services.render?.patchWater(rMat)
    patchVertex(rMat, {
      key: 'ring',
      header: 'attribute float aAlpha;\nvarying float vRingAlpha;',
      vertex: 'vRingAlpha = aAlpha;',
      fragmentHeader: 'varying float vRingAlpha;',
      fragment: { after: '#include <opaque_fragment>', code: 'gl_FragColor.a *= vRingAlpha;' },
    })
    this.ringMesh = new THREE.InstancedMesh(rGeo, rMat, RINGS)
    this.ringMesh.frustumCulled = false
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const rArr = this.ringMesh.instanceMatrix.array as Float32Array
    for (let i = 0; i < RINGS; i++) hideInstance(rArr, i * 16)
    this.group.add(this.bubbleMesh, this.ringMesh)
  }

  burst(x: number, y: number, z: number, count: number, spread: number, upSpeed = 1.6, size = 0.12): void {
    const r = this.rng
    for (let n = 0; n < count; n++) {
      const i = this.bNext
      this.bNext = (this.bNext + 1) % BUBBLES
      this.bp[i * 3] = x + (r() - 0.5) * spread
      this.bp[i * 3 + 1] = y + (r() - 0.5) * spread
      this.bp[i * 3 + 2] = z + (r() - 0.5) * spread
      this.bv[i * 3] = (r() - 0.5) * 0.8
      this.bv[i * 3 + 1] = upSpeed * (0.6 + r() * 0.8)
      this.bv[i * 3 + 2] = (r() - 0.5) * 0.8
      this.bLife[i] = 4 + r() * 6
      this.bSize[i] = size * (0.4 + r() * 1.2)
    }
  }

  ring(x: number, z: number, maxRadius: number, duration: number, delay = 0): void {
    const i = this.rNext
    this.rNext = (this.rNext + 1) % RINGS
    this.rp[i * 2] = x
    this.rp[i * 2 + 1] = z
    this.rAge[i] = -delay - 1e-4
    this.rDur[i] = duration
    this.rMax[i] = maxRadius
    ;(this.ringAlpha.array as Float32Array)[i] = 0
  }

  rings(x: number, z: number, strength: number): void {
    const n = Math.round(3 + strength * 4)
    for (let k = 0; k < n; k++) this.ring(x, z, (6 + k * 2.5) * strength + 2, 2.6 + k * 0.35, k * 0.28)
  }

  update(dt: number): void {
    const bArr = this.bubbleMesh.instanceMatrix.array as Float32Array
    const t = performance.now() * 0.001
    for (let i = 0; i < BUBBLES; i++) {
      if (this.bLife[i] <= 0) continue
      const o = i * 16
      this.bLife[i] -= dt
      const k = i * 3
      this.bp[k] += this.bv[k] * dt + Math.sin(t * 5 + i) * 0.15 * dt
      this.bv[k + 1] = Math.min(this.bv[k + 1] + 3 * dt, 2.4)
      this.bp[k + 1] += this.bv[k + 1] * dt
      this.bp[k + 2] += this.bv[k + 2] * dt + Math.cos(t * 4 + i) * 0.15 * dt
      this.bv[k] *= 0.98
      this.bv[k + 2] *= 0.98
      const y = this.bp[k + 1]
      if (this.bLife[i] <= 0 || y > CEILING_Y - 0.15) {
        this.bLife[i] = 0
        if (y > CEILING_Y - 0.15 && this.bSize[i] > 0.12 && this.rng() < 0.2) this.ring(this.bp[k], this.bp[k + 2], 1.2, 1.4)
        hideInstance(bArr, o)
        continue
      }
      const s = this.bSize[i] * Math.min(1, this.bLife[i] * 2)
      bArr.fill(0, o, o + 16)
      bArr[o] = s; bArr[o + 5] = s * 0.85; bArr[o + 10] = s
      bArr[o + 12] = this.bp[k]; bArr[o + 13] = y; bArr[o + 14] = this.bp[k + 2]; bArr[o + 15] = 1
    }
    this.bubbleMesh.instanceMatrix.needsUpdate = true

    const rArr = this.ringMesh.instanceMatrix.array as Float32Array
    const alpha = this.ringAlpha.array as Float32Array
    for (let i = 0; i < RINGS; i++) {
      const age = this.rAge[i]
      if (age === -1) continue
      const o = i * 16
      const a = age + dt
      this.rAge[i] = a
      if (a < 0) continue
      const u = a / this.rDur[i]
      if (u >= 1) {
        this.rAge[i] = -1
        hideInstance(rArr, o)
        alpha[i] = 0
        continue
      }
      const r = this.rMax[i] * (1 - Math.pow(1 - u, 2.2))
      rArr.fill(0, o, o + 16)
      rArr[o] = r; rArr[o + 5] = 1; rArr[o + 10] = r
      rArr[o + 12] = this.rp[i * 2]; rArr[o + 13] = CEILING_Y - 0.25; rArr[o + 14] = this.rp[i * 2 + 1]; rArr[o + 15] = 1
      alpha[i] = 0.75 * (1 - u) * Math.min(1, u * 8)
    }
    this.ringMesh.instanceMatrix.needsUpdate = true
    this.ringAlpha.needsUpdate = true
  }

  dispose(): void {
    this.group.removeFromParent()
    for (const m of [this.bubbleMesh, this.ringMesh]) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
      m.dispose()
    }
  }
}
