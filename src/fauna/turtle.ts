import * as THREE from 'three'
import type { GameContext } from '../core/types'
import type { Bubbles } from './bubbles'
import { turtleGeometry } from './models'
import { celMaterial, clampWaterY, patchVertex, writeBasis } from './shared'
import type { DriftFrame, Stage } from './stage'

const IN = 9
const LOOK = 6
const OUT = 9
const LEAVE = 22

/** « Une tortue ! Une première ! »: one turtle crossing in front of the glass, nosing the pane to look in, then away. */
export class Turtle {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.Mesh
  private readonly stroke = { value: 0 }
  private t = -1
  private readonly aL = new THREE.Vector3()
  private readonly mL = new THREE.Vector3()
  private readonly bL = new THREE.Vector3()
  private readonly awayL = new THREE.Vector3()
  private readonly inwardL = new THREE.Vector3()
  private readonly headL = new THREE.Vector3()
  private readonly local = new THREE.Vector3()
  private readonly p = new THREE.Vector3()
  private readonly prev = new THREE.Vector3()
  private readonly dir = new THREE.Vector3()
  private readonly look = new THREE.Vector3()
  private readonly basis = new Float32Array(16)
  private readonly rng: () => number
  private bumped = false
  private approach = 0

  constructor(
    private readonly ctx: GameContext,
    private readonly stage: Stage,
    private readonly frame: DriftFrame,
    private readonly bubbles: Bubbles,
  ) {
    this.rng = ctx.rng('fauna:tortue')
    const mat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.6 })
    patchVertex(mat, {
      key: 'turtle',
      uniforms: { uTurtlePhase: this.stroke },
      header: 'uniform float uTurtlePhase;',
      vertex: `float tx = abs(position.x);
float tFront = step(0.0, position.z) * smoothstep(0.5, 1.3, tx);
float tBack = step(position.z, -0.3) * smoothstep(0.3, 0.7, tx);
transformed.y += sin(uTurtlePhase) * 0.35 * tFront * (tx - 0.4);
transformed.z += cos(uTurtlePhase) * 0.18 * tFront * (tx - 0.4);
transformed.y += sin(uTurtlePhase * 2.0) * 0.06 * tBack;`,
    })
    this.mesh = new THREE.Mesh(turtleGeometry().scale(1.25, 1.25, 1.25), mat)
    this.mesh.matrixAutoUpdate = false
    this.mesh.frustumCulled = false
    this.mesh.name = 'fauna-tortue'
    this.group.add(this.mesh)
    this.group.visible = false
  }

  get active(): boolean {
    return this.t >= 0
  }

  start(): void {
    const st = this.stage
    const f = this.frame
    const side = this.rng() < 0.5 ? 1 : -1
    const v = this.p
    const depth = st.kind === 'sortie' ? 5 : 3.4
    const put = (out: THREE.Vector3, d: number, lat: number, h: number) => {
      st.point(d, lat * side, h, v)
      v.y = clampWaterY(this.ctx, v.x, v.y, v.z, 1.5)
      f.toLocal(v, out)
    }
    put(this.aL, depth + 3, -22, -1.2)
    put(this.mL, depth, 0, 0.3)
    put(this.bL, depth + 2, 20, 1)
    put(this.awayL, depth + 30, 48, 9)
    f.dirToLocal(st.normal, this.inwardL).negate()
    this.approach = st.kind === 'sortie' ? 0 : Math.max(0, depth - 1.75)
    this.bumped = false
    this.local.copy(this.aL)
    this.headL.subVectors(this.mL, this.aL).normalize()
    f.toWorld(this.local, this.p)
    this.t = 0
    this.group.visible = true
  }

  update(dt: number): void {
    if (this.t < 0) return
    const f = this.frame
    this.t += dt
    let rate = 1.6
    let lookW = 0
    this.prev.copy(this.local)
    if (this.t < IN) {
      const u = this.t / IN
      const e = 1 - (1 - u) * (1 - u)
      this.local.lerpVectors(this.aL, this.mL, e)
    } else if (this.t < IN + LOOK) {
      const u = (this.t - IN) / LOOK
      this.local.copy(this.mL)
      this.local.y += Math.sin(u * Math.PI) * 0.35
      const nose = Math.sin(Math.min(1, u * 1.4) * Math.PI)
      this.local.addScaledVector(this.inwardL, this.approach * nose)
      if (!this.bumped && u > 0.36) {
        this.bumped = true
        const head = this.look.copy(this.local).addScaledVector(this.inwardL, 1.3)
        f.toWorld(head, head)
        this.bubbles.burst(head.x, head.y, head.z, 6, 0.15, 0.7, 0.05)
      }
      lookW = Math.sin(u * Math.PI)
      rate = 0.7
    } else if (this.t < IN + LOOK + OUT) {
      const u = (this.t - IN - LOOK) / OUT
      this.local.lerpVectors(this.mL, this.bL, u * u)
    } else if (this.t < IN + LOOK + OUT + LEAVE) {
      const u = (this.t - IN - LOOK - OUT) / LEAVE
      this.local.lerpVectors(this.bL, this.awayL, u * u * (3 - 2 * u))
    } else {
      this.t = -1
      this.group.visible = false
      return
    }
    this.stroke.value += dt * rate
    f.toWorld(this.local, this.p)
    const p = this.p
    this.look.subVectors(this.local, this.prev)
    if (Math.hypot(this.look.x, this.look.z) > 1e-4) this.headL.set(this.look.x, this.look.y * 0.4, this.look.z).normalize()
    f.dirToWorld(this.headL, this.dir)
    this.dir.normalize()
    if (lookW > 0) {
      f.dirToWorld(this.inwardL, this.look)
      this.dir.lerp(this.look, lookW * 0.75).normalize()
    }
    writeBasis(this.basis, 0, p.x, p.y, p.z, this.dir.x, this.dir.y, this.dir.z, 1)
    this.mesh.matrix.fromArray(this.basis)
    this.mesh.matrixWorldNeedsUpdate = true
  }

  dispose(): void {
    this.group.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
