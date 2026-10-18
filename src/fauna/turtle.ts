import * as THREE from 'three'
import type { GameContext } from '../core/types'
import { turtleGeometry } from './models'
import { celMaterial, clampWaterY, patchVertex, writeBasis } from './shared'

const PASS_SECONDS = 16
const LEAVE_SECONDS = 25

/** « Une tortue ! Une première ! »: one turtle crossing in front of the big window, then away. */
export class Turtle {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.Mesh
  private readonly stroke = { value: 0 }
  private t = -1
  private readonly a = new THREE.Vector3()
  private readonly b = new THREE.Vector3()
  private readonly away = new THREE.Vector3()
  private readonly p = new THREE.Vector3()
  private readonly prev = new THREE.Vector3()
  private readonly basis = new Float32Array(16)

  constructor(private readonly ctx: GameContext) {
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
    this.mesh = new THREE.Mesh(turtleGeometry().scale(1.2, 1.2, 1.2), mat)
    this.mesh.matrixAutoUpdate = false
    this.mesh.name = 'fauna-tortue'
    this.group.add(this.mesh)
    this.group.visible = false
  }

  start(): void {
    const ctx = this.ctx
    const hero = ctx.state.hero.position
    const win = ctx.services.drift?.nearestWindow(hero, 60) ?? null
    let cx: number, cy: number, cz: number, nx: number, nz: number
    if (win) {
      const nl = Math.hypot(win.normal.x, win.normal.z) || 1
      nx = win.normal.x / nl; nz = win.normal.z / nl
      cx = win.position.x + nx * 6; cy = win.position.y + 0.5; cz = win.position.z + nz * 6
    } else {
      const yaw = ctx.state.hero.yaw
      nx = -Math.sin(yaw); nz = Math.cos(yaw)
      cx = hero.x - nx * 7; cy = hero.y + 1.5; cz = hero.z - nz * 7
    }
    cy = clampWaterY(ctx, cx, cy, cz, 1.5)
    const sx = -nz, sz = nx
    this.a.set(cx - sx * 20, cy - 1, cz - sz * 20)
    this.b.set(cx + sx * 20, cy + 1, cz + sz * 20)
    this.away.set(cx + sx * 45 + nx * 30, cy + 8, cz + sz * 45 + nz * 30)
    this.p.copy(this.a)
    this.t = 0
    this.group.visible = true
  }

  update(dt: number): void {
    if (this.t < 0) return
    this.t += dt
    this.stroke.value += dt * 1.6
    this.prev.copy(this.p)
    if (this.t < PASS_SECONDS) {
      const u = this.t / PASS_SECONDS
      this.p.lerpVectors(this.a, this.b, u)
      this.p.y += Math.sin(u * Math.PI) * 0.8
    } else if (this.t < PASS_SECONDS + LEAVE_SECONDS) {
      const u = (this.t - PASS_SECONDS) / LEAVE_SECONDS
      this.p.lerpVectors(this.b, this.away, u * u)
    } else {
      this.t = -1
      this.group.visible = false
      return
    }
    const p = this.p, q = this.prev
    writeBasis(this.basis, 0, p.x, p.y, p.z, p.x - q.x, (p.y - q.y) * 0.4, p.z - q.z, 1)
    this.mesh.matrix.fromArray(this.basis)
    this.mesh.matrixWorldNeedsUpdate = true
  }

  dispose(): void {
    this.group.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
