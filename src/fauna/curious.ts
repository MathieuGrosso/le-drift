import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import type { Bubbles } from './bubbles'
import { curiousBodyGeometry, curiousEyesGeometry } from './models'
import { PALETTE, celMaterial, clampWaterY, fitInstances, hideInstance, patchVertex, writeBasis } from './shared'
import type { Stage } from './stage'

const MAX = 7
const AWAY = 0, COME = 1, NOSE = 2, FLEE = 3
const LINGER_FIRST = 1.2
const LINGER_EACH = 2.4
const NEAR_GLASS = 4.5
const HERO_CLEAR = 1.5
const SIGHT_CLEAR = 0.45
const TINTS = [PALETTE.corail2, 0xf3d36b, PALETTE.corail1, PALETTE.clair, PALETTE.corail3, 0x9fd3e6, 0xf6efe0]

/**
 * « Les curieux »: a handful of round reef fish that come and press their noses to the glass when Ilo
 * stays near a window, follow where he looks, bump the pane now and then, and bolt at a tap or a shadow.
 * During a sortie a few of them tag along a couple of metres off.
 */
export class Curious {
  readonly group = new THREE.Group()
  private readonly body: THREE.InstancedMesh
  private readonly eyes: THREE.InstancedMesh
  private readonly pos = new Float32Array(MAX * 3)
  private readonly vel = new Float32Array(MAX * 3)
  private readonly state = new Uint8Array(MAX)
  private readonly timer = new Float32Array(MAX)
  private readonly fade = new Float32Array(MAX)
  private readonly lat = new Float32Array(MAX)
  private readonly hgt = new Float32Array(MAX)
  private readonly kiss = new Float32Array(MAX)
  private readonly size = new Float32Array(MAX)
  private readonly rng: () => number
  private linger = 0
  private epoch = -1
  private boldness = 0
  private readonly lastViewer = new THREE.Vector3()
  private readonly gaze = new THREE.Vector3()
  private readonly fwd = new THREE.Vector3()
  private readonly target = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private readonly ray = new THREE.Vector3()

  constructor(private readonly ctx: GameContext, private readonly stage: Stage, private readonly bubbles: Bubbles) {
    this.rng = ctx.rng('fauna:curieux')
    const phase = new Float32Array(MAX)
    for (let i = 0; i < MAX; i++) {
      phase[i] = this.rng()
      this.size[i] = 0.85 + this.rng() * 0.5
    }
    const bodyGeo = curiousBodyGeometry()
    bodyGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const bodyMat = celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.7 })
    patchVertex(bodyMat, {
      key: 'curious',
      header: 'attribute float aPhase;',
      vertex: `float cTail = clamp(-position.z / 0.42, 0.0, 1.0);
float cFin = smoothstep(0.1, 0.22, abs(position.x)) * step(-0.1, position.z);
transformed.x += sin(uFaunaTime * (5.0 + aPhase * 2.0) + aPhase * 6.2831 + position.z * 6.0) * 0.06 * cTail * cTail;
transformed.y += sin(uFaunaTime * 9.0 + aPhase * 12.0) * 0.03 * cFin;`,
    })
    this.body = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX)
    this.eyes = new THREE.InstancedMesh(curiousEyesGeometry(), celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.2 }), MAX)
    const col = new THREE.Color()
    for (let i = 0; i < MAX; i++) {
      col.setHex(TINTS[i % TINTS.length]!).offsetHSL((this.rng() - 0.5) * 0.04, 0, (this.rng() - 0.5) * 0.06)
      this.body.setColorAt(i, col)
    }
    for (const m of [this.body, this.eyes]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      const arr = m.instanceMatrix.array as Float32Array
      for (let i = 0; i < MAX; i++) hideInstance(arr, i * 16)
    }
    this.body.name = 'fauna-curieux'
    this.eyes.name = 'fauna-curieux-yeux'
    this.group.add(this.body, this.eyes)
  }

  /** A tap on the glass, a shadow, a sudden move: everyone bolts, and comes back bolder. */
  startle(at: Vec3 | null = null): void {
    const st = this.stage
    for (let i = 0; i < MAX; i++) {
      if (this.state[i] === AWAY || this.state[i] === FLEE) continue
      const k = i * 3
      let dx = st.kind === 'sortie' ? this.pos[k]! - st.pos.x : st.normal.x
      let dy = st.kind === 'sortie' ? this.pos[k + 1]! - st.pos.y : st.normal.y
      let dz = st.kind === 'sortie' ? this.pos[k + 2]! - st.pos.z : st.normal.z
      if (at) { dx = this.pos[k]! - at.x; dy = this.pos[k + 1]! - at.y; dz = this.pos[k + 2]! - at.z }
      const l = Math.hypot(dx, dy, dz) || 1
      const side = (this.rng() - 0.5) * 4
      this.vel[k] = (dx / l) * 7 + st.tangent.x * side
      this.vel[k + 1] = (dy / l) * 7 + 1.5
      this.vel[k + 2] = (dz / l) * 7 + st.tangent.z * side
      this.state[i] = FLEE
      this.timer[i] = 1.1 + this.rng() * 0.5
      this.bubbles.burst(this.pos[k]!, this.pos[k + 1]!, this.pos[k + 2]!, 4, 0.2, 1.2, 0.04)
    }
    this.boldness = Math.min(1, this.boldness + 0.35)
  }

  private wanted(dt: number): number {
    const ctx = this.ctx
    const st = this.stage
    const v = st.viewer
    const speed = this.lastViewer.distanceTo(v) / Math.max(dt, 1e-3)
    this.lastViewer.copy(v)
    if (st.kind === 'sortie') {
      this.linger = speed < 4 ? this.linger + dt : Math.max(0, this.linger - dt * 3)
      return this.linger > 4 ? 3 : 0
    }
    if (st.kind !== 'window' || !st.visible) {
      this.linger = Math.max(0, this.linger - dt * 4)
      return 0
    }
    const off = -st.depth(v)
    const close = off > -0.5 && off < NEAR_GLASS * 2
    if (off < NEAR_GLASS && speed > 7 && this.linger > LINGER_FIRST) this.startle(null)
    if (close && speed < 3) this.linger += dt * (1 + this.boldness) * (off < NEAR_GLASS ? 1 : 0.5)
    else this.linger = Math.max(0, this.linger - dt * 1.5)
    if (this.linger < LINGER_FIRST) return 0
    const n = 1 + Math.floor((this.linger - LINGER_FIRST) / LINGER_EACH)
    const night = st.night && ctx.state.env.bloom < 0.4
    return Math.min(night ? 2 : MAX, n)
  }

  /** Where the viewer's gaze meets the glass, kept within reach of where the viewer stands. */
  private gazePoint(): void {
    const st = this.stage
    const v = st.viewer
    this.ctx.camera.getWorldDirection(this.fwd)
    const along = this.fwd.dot(st.normal)
    const toPlane = -st.depth(v)
    if (along > 0.15) this.gaze.copy(v).addScaledVector(this.fwd, toPlane / along)
    else this.gaze.copy(v).addScaledVector(st.normal, toPlane)
    const foot = this.tmp.copy(v).addScaledVector(st.normal, toPlane)
    const d = this.gaze.distanceTo(foot)
    if (d > 3.5) this.gaze.lerp(foot, 1 - 3.5 / d)
  }

  private spawn(i: number): void {
    const st = this.stage
    const r = this.rng
    const k = i * 3
    if (st.kind === 'sortie') st.point(9 + r() * 6, (r() - 0.5) * 14, (r() - 0.5) * 6, this.tmp)
    else this.tmp.copy(this.gaze).addScaledVector(st.normal, 10 + r() * 6).addScaledVector(st.tangent, (r() - 0.5) * 16).addScaledVector(st.up, (r() - 0.6) * 5)
    this.tmp.y = clampWaterY(this.ctx, this.tmp.x, this.tmp.y, this.tmp.z, 2, 3)
    this.pos[k] = this.tmp.x; this.pos[k + 1] = this.tmp.y; this.pos[k + 2] = this.tmp.z
    this.vel[k] = 0; this.vel[k + 1] = 0; this.vel[k + 2] = 0
    this.lat[i] = (r() - 0.5) * 1.8
    this.hgt[i] = (r() - 0.5) * 1.1
    this.kiss[i] = 2 + r() * 4
    this.fade[i] = 0
    this.state[i] = COME
  }

  /** Out of a sphere around Ilo and out of the cone from the camera to him, so no fish hides the hero. */
  private keepClear(p: THREE.Vector3, size: number): void {
    const st = this.stage
    const hero = st.pos
    const r = HERO_CLEAR + size * 0.5
    const off = this.ray.subVectors(p, hero)
    const d = off.length()
    if (d < r) p.copy(hero).addScaledVector(d > 1e-4 ? off.divideScalar(d) : st.tangent, r)
    const seg = this.ray.subVectors(hero, st.viewer)
    const len2 = seg.lengthSq()
    if (len2 < 1e-4) return
    const t = THREE.MathUtils.clamp(((p.x - st.viewer.x) * seg.x + (p.y - st.viewer.y) * seg.y + (p.z - st.viewer.z) * seg.z) / len2, 0, 1)
    const rc = THREE.MathUtils.lerp(SIGHT_CLEAR + size * 0.4, r, t)
    const qx = st.viewer.x + seg.x * t, qy = st.viewer.y + seg.y * t, qz = st.viewer.z + seg.z * t
    const ox = p.x - qx, oy = p.y - qy, oz = p.z - qz
    const od = Math.hypot(ox, oy, oz)
    if (od >= rc) return
    if (od > 1e-4) p.set(qx + (ox / od) * rc, qy + (oy / od) * rc, qz + (oz / od) * rc)
    else p.set(qx, qy, qz).addScaledVector(st.tangent, rc)
  }

  update(dt: number): void {
    const st = this.stage
    const now = this.ctx.clock.elapsed
    const jumped = st.epoch !== this.epoch
    this.epoch = st.epoch
    if (jumped) {
      for (let i = 0; i < MAX; i++) this.state[i] = AWAY
      this.linger = 0
    }
    this.boldness = Math.max(0, this.boldness - dt * 0.01)
    const want = this.wanted(dt)
    if (st.kind !== 'sortie') this.gazePoint()
    let present = 0
    for (let i = 0; i < MAX; i++) if (this.state[i] === COME || this.state[i] === NOSE) present++
    for (let i = 0; i < MAX && present < want; i++) {
      if (this.state[i] !== AWAY || this.timer[i]! > 0) continue
      this.spawn(i)
      present++
    }
    const bArr = this.body.instanceMatrix.array as Float32Array
    const eArr = this.eyes.instanceMatrix.array as Float32Array
    const v = st.viewer
    let rank = 0
    for (let i = 0; i < MAX; i++) {
      const k = i * 3
      const o = i * 16
      const s0 = this.state[i]!
      this.timer[i] = Math.max(0, this.timer[i]! - dt)
      if (s0 === AWAY) {
        hideInstance(bArr, o)
        hideInstance(eArr, o)
        continue
      }
      if ((s0 === COME || s0 === NOSE) && rank >= want) {
        this.state[i] = FLEE
        this.timer[i] = 2
        const side = this.rng() < 0.5 ? -1 : 1
        this.vel[k] = st.normal.x * 1.5 + st.tangent.x * side * 1.5
        this.vel[k + 1] = 0.3
        this.vel[k + 2] = st.normal.z * 1.5 + st.tangent.z * side * 1.5
      }
      if (this.state[i] === COME || this.state[i] === NOSE) rank++
      const state = this.state[i]!
      let px = this.pos[k]!, py = this.pos[k + 1]!, pz = this.pos[k + 2]!
      let vx = this.vel[k]!, vy = this.vel[k + 1]!, vz = this.vel[k + 2]!
      let faceX = vx, faceY = vy * 0.5, faceZ = vz
      if (state === FLEE) {
        this.fade[i] = this.timer[i]! < 0.7 ? Math.max(0, this.fade[i]! - dt * 1.6) : this.fade[i]!
        vx *= 1 - dt * 0.8; vy *= 1 - dt * 0.8; vz *= 1 - dt * 0.8
        if (this.timer[i] === 0) {
          this.state[i] = AWAY
          this.timer[i] = 2.5 + this.rng() * 3 * (1 - this.boldness)
        }
      } else {
        this.fade[i] = Math.min(1, this.fade[i]! + dt * 0.8)
        const wob = Math.sin(now * 0.9 + i * 2.1)
        if (st.kind === 'sortie') {
          const a = now * 0.25 + i * 2.2
          st.point(2.2 + Math.sin(a) * 0.6, Math.cos(a) * 2.2 + this.lat[i]!, 0.4 + this.hgt[i]! + wob * 0.3, this.target)
          this.keepClear(this.target, this.size[i]!)
        } else {
          this.kiss[i] = this.kiss[i]! - dt
          const k01 = this.kiss[i]! < 0 ? Math.sin(Math.min(1, -this.kiss[i]! / 0.7) * Math.PI) : 0
          if (this.kiss[i]! < -0.35 && this.kiss[i]! + dt >= -0.35) {
            this.bubbles.burst(px - st.normal.x * 0.2, py, pz - st.normal.z * 0.2, 2, 0.05, 0.6, 0.03)
          }
          if (this.kiss[i]! < -0.7) this.kiss[i] = 3 + this.rng() * 5
          const d = 0.6 + wob * 0.08 - k01 * 0.38
          this.target.copy(this.gaze)
            .addScaledVector(st.normal, d)
            .addScaledVector(st.tangent, this.lat[i]! + Math.sin(now * 0.4 + i) * 0.25)
            .addScaledVector(st.up, this.hgt[i]! + Math.sin(now * 0.7 + i * 1.3) * 0.12)
        }
        const dx = this.target.x - px, dy = this.target.y - py, dz = this.target.z - pz
        const dist = Math.hypot(dx, dy, dz)
        const max = state === COME ? 2.4 : 1.4
        const gain = Math.min(max, dist * 1.6) / (dist || 1)
        const ease = Math.min(1, dt * (state === COME ? 1.6 : 4))
        vx += (dx * gain - vx) * ease; vy += (dy * gain - vy) * ease; vz += (dz * gain - vz) * ease
        if (state === COME && dist < 0.5) this.state[i] = NOSE
        faceX = vx; faceY = vy * 0.5; faceZ = vz
        if (this.state[i] === NOSE) {
          const lx = v.x - px, ly = v.y - py, lz = v.z - pz
          const ll = Math.hypot(lx, ly, lz) || 1
          const sway = Math.sin(now * 0.6 + i * 1.7) * 0.35
          faceX = lx / ll + st.tangent.x * sway
          faceY = (ly / ll) * 0.6
          faceZ = lz / ll + st.tangent.z * sway
        }
      }
      px += vx * dt; py += vy * dt; pz += vz * dt
      if (st.kind === 'sortie') {
        this.keepClear(this.tmp.set(px, py, pz), this.size[i]!)
        px = this.tmp.x; py = this.tmp.y; pz = this.tmp.z
      } else {
        this.tmp.set(px, py, pz)
        const dd = st.depth(this.tmp)
        if (dd < 0.18) { const f = 0.18 - dd; px += st.normal.x * f; py += st.normal.y * f; pz += st.normal.z * f }
      }
      this.pos[k] = px; this.pos[k + 1] = py; this.pos[k + 2] = pz
      this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz
      const s = Math.max(1e-3, this.size[i]! * this.fade[i]!)
      writeBasis(bArr, o, px, py, pz, faceX, faceY, faceZ, s)
      eArr.set(bArr.subarray(o, o + 16), o)
    }
    this.body.instanceMatrix.needsUpdate = true
    this.eyes.instanceMatrix.needsUpdate = true
    fitInstances(this.body, 0.1)
    fitInstances(this.eyes, 0)
  }

  dispose(): void {
    this.group.removeFromParent()
    for (const m of [this.body, this.eyes]) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
      m.dispose()
    }
  }
}
