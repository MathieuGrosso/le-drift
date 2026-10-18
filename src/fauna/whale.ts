import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import type { Bubbles } from './bubbles'
import { fishGeometry, whaleGeometry } from './models'
import { celMaterial, clampWaterY, hideInstance, patchVertex, writeBasis } from './shared'
import type { DriftFrame, Stage } from './stage'

const SPEED = 3.2
const HALF_PATH = 130
const CALF_OFFSET = new THREE.Vector3(-4.5, -3.2, -2.5)
const PILOTS = 8
const LINGER = 0.09

/**
 * The whale passing the glass: a long slow line across the window, close enough to fill it. It slows
 * in front of the glass and rolls a little to look in with one eye; pilot fish ride under its chin.
 * The path lives in the Drift frame so the pass stays framed while the city moves.
 */
export class Whale {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.Mesh
  private readonly calf: THREE.Mesh
  private readonly swim = { value: 0 }
  private readonly calfSwim = { value: 1.3 }
  private active = false
  private withCalf = false
  private readonly aL = new THREE.Vector3()
  private readonly bL = new THREE.Vector3()
  private u = 0
  private duration = 1
  private readonly local = new THREE.Vector3()
  private readonly p = new THREE.Vector3()
  private readonly prev = new THREE.Vector3()
  private readonly cp = new THREE.Vector3()
  private nextBlow = 0
  private readonly basis = new Float32Array(16)
  private readonly tmp = new THREE.Vector3()
  private readonly rng: () => number
  private readonly pilots: THREE.InstancedMesh
  private readonly m = new THREE.Matrix4()
  private readonly roll = new THREE.Matrix4()
  private readonly glassL = new THREE.Vector3()
  private rollSign = 1
  private rollAmt = 0.3

  constructor(private readonly ctx: GameContext, private readonly frame: DriftFrame, private readonly bubbles: Bubbles) {
    this.rng = ctx.rng('fauna:whale')
    const geo = whaleGeometry()
    this.mesh = new THREE.Mesh(geo, this.material('whale', this.swim))
    this.calf = new THREE.Mesh(geo, this.material('whale-calf', this.calfSwim))
    for (const m of [this.mesh, this.calf]) {
      m.matrixAutoUpdate = false
      m.frustumCulled = false
      this.group.add(m)
    }
    this.mesh.name = 'fauna-baleine'
    this.calf.name = 'fauna-baleineau'
    const pGeo = fishGeometry()
    const phase = new Float32Array(PILOTS)
    for (let i = 0; i < PILOTS; i++) phase[i] = this.rng()
    pGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const pMat = celMaterial(this.ctx, { color: 0xffffff, vertexColors: true, rim: 0.5 })
    patchVertex(pMat, {
      key: 'whale-pilot',
      header: 'attribute float aPhase;',
      vertex: `float pt = clamp(-position.z / 0.3, 0.0, 1.0);
transformed.x += sin(uFaunaTime * 10.0 + aPhase * 6.2831 + position.z * 9.0) * 0.05 * (0.2 + pt * 1.4);`,
    })
    this.pilots = new THREE.InstancedMesh(pGeo, pMat, PILOTS)
    const col = new THREE.Color()
    for (let i = 0; i < PILOTS; i++) this.pilots.setColorAt(i, col.setHex(i % 3 === 0 ? 0xf2d06b : 0xe8eef0))
    this.pilots.frustumCulled = false
    this.pilots.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.pilots.name = 'fauna-poissons-pilotes'
    this.group.add(this.pilots)
    this.group.visible = false
  }

  private material(key: string, phase: { value: number }): THREE.Material {
    const mat = celMaterial(this.ctx, { color: 0xffffff, vertexColors: true, rim: 0.6 })
    patchVertex(mat, {
      key,
      uniforms: { uWhalePhase: phase },
      header: 'uniform float uWhalePhase;',
      vertex: `float wTail = smoothstep(2.0, -8.5, position.z);
transformed.y += sin(uWhalePhase - position.z * 0.26) * 0.85 * wTail * wTail;
transformed.y += sin(uWhalePhase * 0.5 + 1.3) * 0.15;
float wFin = smoothstep(1.4, 2.6, abs(position.x)) * step(2.0, position.z);
transformed.y += sin(uWhalePhase * 0.5 + 0.6) * 0.5 * wFin;`,
    })
    return mat
  }

  get isActive(): boolean {
    return this.active
  }

  get position(): Vec3 {
    return this.p
  }

  /** A pass across the stage: closest point `lateral` m out from the glass, in the Drift frame. */
  pass(stage: Stage, lateral: number): void {
    const r = this.rng
    const f = this.frame
    const side = r() < 0.5 ? 1 : -1
    const mid = stage.point(lateral, (r() - 0.5) * 10, stage.normal.y > 0.6 ? 0 : -2 + r() * 6, this.tmp)
    if (stage.normal.y > 0.6) mid.y += lateral * 0.3
    mid.y = clampWaterY(this.ctx, mid.x, mid.y, mid.z, 10, 10)
    f.toLocal(mid, this.local)
    f.dirToLocal(stage.normal, this.glassL).negate()
    this.rollAmt = stage.kind === 'sortie' ? 0.15 : 0.32
    const dir = this.prev.copy(stage.tangent).multiplyScalar(side).addScaledVector(stage.normal, (r() - 0.5) * 0.25)
    dir.y = 0
    dir.normalize()
    f.dirToLocal(dir, this.cp)
    this.aL.copy(this.local).addScaledVector(this.cp, -HALF_PATH)
    this.bL.copy(this.local).addScaledVector(this.cp, HALF_PATH)
    this.u = 0
    this.duration = (HALF_PATH * 2) / SPEED
    this.active = true
    this.withCalf = this.ctx.state.act >= 2 || r() < 0.4
    this.calf.visible = this.withCalf
    this.group.visible = true
    this.nextBlow = 6
    f.toWorld(this.aL, this.p)
    this.local.copy(this.aL)
    this.ctx.bus.emit('whale:pass', { position: { x: mid.x, y: mid.y, z: mid.z } })
  }

  update(dt: number): void {
    if (!this.active) return
    const f = this.frame
    this.u += dt / this.duration / (1 - LINGER * 2 * Math.PI * Math.cos(2 * Math.PI * this.u))
    this.swim.value += dt * 1.05
    this.calfSwim.value += dt * 1.7
    if (this.u >= 1) {
      this.stop()
      return
    }
    this.prev.copy(this.local)
    this.local.lerpVectors(this.aL, this.bL, this.u)
    this.local.y += Math.sin(this.u * Math.PI * 2.5) * 2.2
    f.toWorld(this.local, this.p)
    f.dirToWorld(this.tmp.subVectors(this.local, this.prev), this.tmp)
    const vx = this.tmp.x, vy = this.tmp.y, vz = this.tmp.z
    writeBasis(this.basis, 0, this.p.x, this.p.y, this.p.z, vx, vy * 0.5, vz, 1)
    this.m.fromArray(this.basis)
    if (this.u < 0.02) {
      const side = this.tmp.set(this.basis[0]!, this.basis[1]!, this.basis[2]!)
      f.dirToWorld(this.glassL, this.cp)
      this.rollSign = side.dot(this.cp) > 0 ? 1 : -1
    }
    const look = Math.exp(-Math.pow((this.u - 0.5) / 0.11, 2))
    this.roll.makeRotationZ(this.rollSign * this.rollAmt * look + Math.sin(this.swim.value * 0.4) * 0.04)
    this.mesh.matrix.multiplyMatrices(this.m, this.roll)
    this.mesh.matrixWorldNeedsUpdate = true
    this.updatePilots(vx, vy, vz)

    if (this.withCalf) {
      const lag = Math.sin(this.calfSwim.value * 0.3) * 0.8
      this.cp.set(CALF_OFFSET.x + lag, CALF_OFFSET.y + Math.sin(this.calfSwim.value * 0.4) * 0.5, CALF_OFFSET.z).applyMatrix4(this.mesh.matrix)
      writeBasis(this.basis, 0, this.cp.x, this.cp.y, this.cp.z, vx, vy * 0.5, vz, 0.42)
      this.calf.matrix.fromArray(this.basis)
      this.calf.matrixWorldNeedsUpdate = true
    }

    this.nextBlow -= dt
    if (this.nextBlow <= 0) {
      this.nextBlow = 9 + this.rng() * 8
      const head = this.tmp.set(0, 1.7, 5.2).applyMatrix4(this.mesh.matrix)
      this.bubbles.burst(head.x, head.y, head.z, 45, 0.8, 2.4, 0.18)
    }
  }

  private updatePilots(vx: number, vy: number, vz: number): void {
    const arr = this.pilots.instanceMatrix.array as Float32Array
    const t = this.swim.value
    for (let i = 0; i < PILOTS; i++) {
      const a = i * 2.39996
      const ox = Math.cos(a) * (0.5 + (i % 3) * 0.35) + Math.sin(t * 0.9 + i) * 0.15
      const oy = -2.05 - (i % 2) * 0.35 + Math.sin(t * 1.3 + i * 0.7) * 0.12
      const oz = 4.6 + (i % 4) * 0.55 + Math.sin(t * 0.7 + a) * 0.25
      const w = this.cp.set(ox, oy, oz).applyMatrix4(this.mesh.matrix)
      if (this.u > 0.97) hideInstance(arr, i * 16)
      else writeBasis(arr, i * 16, w.x, w.y, w.z, vx + Math.sin(t + i) * 0.05, vy * 0.5, vz, 1.1)
    }
    this.pilots.instanceMatrix.needsUpdate = true
  }

  stop(): void {
    this.active = false
    this.group.visible = false
  }

  dispose(): void {
    this.group.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    ;(this.calf.material as THREE.Material).dispose()
    this.pilots.geometry.dispose()
    ;(this.pilots.material as THREE.Material).dispose()
    this.pilots.dispose()
  }
}
