import * as THREE from 'three'
import type { GameContext } from '../core/types'
import { mantaGeometry } from './models'
import { celMaterial, clampWaterY, patchVertex, writeBasis } from './shared'
import type { DriftFrame, Stage } from './stage'

const COUNT = 3
const SPEED = 2.6
const HALF_PATH = 70
const FORMATION: readonly [number, number, number][] = [[0, 0, 0], [-4.5, -1.6, -5], [5, 1.2, -9]]

/** Mantas gliding past the glass in a loose line, banking a little; backdrop only (no riding inside the Drift). */
export class Manta {
  readonly group = new THREE.Group()
  private readonly meshes: THREE.Mesh[] = []
  private readonly flap = { value: 0 }
  private active = false
  private n = 0
  private u = 0
  private readonly aL = new THREE.Vector3()
  private readonly bL = new THREE.Vector3()
  private readonly local = new THREE.Vector3()
  private readonly dirL = new THREE.Vector3()
  private readonly sideL = new THREE.Vector3()
  private readonly p = new THREE.Vector3()
  private readonly d = new THREE.Vector3()
  private readonly basis = new Float32Array(16)
  private readonly m = new THREE.Matrix4()
  private readonly roll = new THREE.Matrix4()

  constructor(private readonly ctx: GameContext, private readonly frame: DriftFrame) {
    const mat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.7, side: THREE.DoubleSide })
    patchVertex(mat, {
      key: 'manta',
      uniforms: { uMantaPhase: this.flap },
      header: 'uniform float uMantaPhase;',
      vertex: `float mx = abs(position.x);
float mw = pow(clamp((mx - 0.35) / 2.3, 0.0, 1.0), 1.4);
transformed.y += sin(uMantaPhase - mx * 0.9) * 0.95 * mw;
transformed.y += sin(uMantaPhase * 0.5 - position.z * 1.2) * 0.12 * smoothstep(-0.8, -3.2, position.z);`,
    })
    const geo = mantaGeometry().scale(1.3, 1.3, 1.3)
    for (let i = 0; i < COUNT; i++) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      mesh.name = 'fauna-raie'
      this.meshes.push(mesh)
      this.group.add(mesh)
    }
    this.group.visible = false
  }

  get isActive(): boolean {
    return this.active
  }

  pass(stage: Stage, depth: number, count = COUNT): void {
    const f = this.frame
    const side = Math.random() < 0.5 ? 1 : -1
    const mid = stage.point(depth, (Math.random() - 0.5) * 12, stage.normal.y > 0.6 ? depth * 0.2 : 1 + Math.random() * 6, this.p)
    mid.y = clampWaterY(this.ctx, mid.x, mid.y, mid.z, 6, 6)
    f.toLocal(mid, this.local)
    f.dirToLocal(this.d.copy(stage.tangent).multiplyScalar(side), this.dirL)
    this.dirL.y = 0
    this.dirL.normalize()
    this.sideL.set(this.dirL.z, 0, -this.dirL.x)
    this.aL.copy(this.local).addScaledVector(this.dirL, -HALF_PATH)
    this.bL.copy(this.local).addScaledVector(this.dirL, HALF_PATH)
    this.n = Math.max(1, Math.min(COUNT, count))
    this.meshes.forEach((m, i) => { m.visible = i < this.n })
    this.u = 0
    this.active = true
    this.group.visible = true
  }

  update(dt: number): void {
    if (!this.active) return
    const f = this.frame
    this.u += dt * SPEED / (HALF_PATH * 2)
    this.flap.value += dt * 1.3
    if (this.u >= 1) {
      this.active = false
      this.group.visible = false
      return
    }
    f.dirToWorld(this.dirL, this.d)
    for (let i = 0; i < this.n; i++) {
      const [ox, oy, oz] = FORMATION[i]!
      const wave = Math.sin(this.u * Math.PI * 4 + i * 1.7)
      this.local.lerpVectors(this.aL, this.bL, this.u)
        .addScaledVector(this.sideL, ox + wave * 1.2)
        .addScaledVector(this.dirL, oz)
      this.local.y += oy + Math.sin(this.u * Math.PI * 3 + i) * 1.5
      f.toWorld(this.local, this.p)
      const pitch = Math.cos(this.u * Math.PI * 3 + i) * 0.05
      writeBasis(this.basis, 0, this.p.x, this.p.y, this.p.z, this.d.x, pitch, this.d.z, 1)
      this.m.fromArray(this.basis)
      this.roll.makeRotationZ(Math.cos(this.u * Math.PI * 4 + i * 1.7) * 0.22)
      this.meshes[i]!.matrix.multiplyMatrices(this.m, this.roll)
      this.meshes[i]!.matrixWorldNeedsUpdate = true
    }
  }

  dispose(): void {
    this.group.removeFromParent()
    this.meshes[0]?.geometry.dispose()
    ;(this.meshes[0]?.material as THREE.Material | undefined)?.dispose()
  }
}
