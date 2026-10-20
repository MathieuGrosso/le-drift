import * as THREE from 'three'
import { DRIFT_BOUNDS } from '../core/layout'
import type { GameContext, Vec3 } from '../core/types'

export type StageKind = 'window' | 'hull' | 'dome' | 'sortie' | 'free'

const PROBES = [1.2, 2.2, 3.5, 5, 7.5, 11, 16, 24] as const
const EVAL_SECONDS = 0.2
const KEEP_RANGE = 45

/** Drift-local <-> world, read from state once per frame (same maths as the drift's frame). */
export class DriftFrame {
  readonly origin = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  heading = 0
  private c = 1
  private s = 0

  sync(ctx: GameContext): void {
    const d = ctx.state.drift
    this.origin.set(d.position.x, d.position.y, d.position.z)
    this.velocity.set(d.velocity.x, d.velocity.y, d.velocity.z)
    this.heading = d.heading
    this.c = Math.cos(d.heading)
    this.s = Math.sin(d.heading)
  }

  toWorld(l: Vec3, out: THREE.Vector3): THREE.Vector3 {
    return out.set(l.x * this.c - l.z * this.s + this.origin.x, l.y + this.origin.y, l.x * this.s + l.z * this.c + this.origin.z)
  }

  toLocal(p: Vec3, out: THREE.Vector3): THREE.Vector3 {
    const dx = p.x - this.origin.x, dz = p.z - this.origin.z
    return out.set(dx * this.c + dz * this.s, p.y - this.origin.y, -dx * this.s + dz * this.c)
  }

  dirToWorld(d: Vec3, out: THREE.Vector3): THREE.Vector3 {
    return out.set(d.x * this.c - d.z * this.s, d.y, d.x * this.s + d.z * this.c)
  }

  dirToLocal(d: Vec3, out: THREE.Vector3): THREE.Vector3 {
    return out.set(d.x * this.c + d.z * this.s, d.y, -d.x * this.s + d.z * this.c)
  }
}

/**
 * Where the sea is being watched from: the glass the camera looks through (or Ilo during a sortie),
 * with its outward normal. Stored in the Drift frame so it rides along with the ship.
 */
export class Stage {
  readonly pos = new THREE.Vector3()
  readonly normal = new THREE.Vector3(0, 0, 1)
  readonly tangent = new THREE.Vector3(1, 0, 0)
  readonly up = new THREE.Vector3(0, 1, 0)
  readonly viewer = new THREE.Vector3()
  kind: StageKind = 'free'
  windowId: string | null = null
  visible = true
  /** Bumps when the stage jumps somewhere else, so creatures can re-place instead of swimming through the hull. */
  epoch = 0
  private readonly localPos = new THREE.Vector3()
  private readonly localNormal = new THREE.Vector3(0, 0, 1)
  private evalIn = 0
  private readonly fwd = new THREE.Vector3()
  private readonly probe = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private readonly tmp2 = new THREE.Vector3()

  constructor(private readonly ctx: GameContext, private readonly frame: DriftFrame) {}

  /** Signed distance of `p` in front of the glass plane. */
  depth(p: Vec3): number {
    return (p.x - this.pos.x) * this.normal.x + (p.y - this.pos.y) * this.normal.y + (p.z - this.pos.z) * this.normal.z
  }

  /** stage + normal*d + tangent*lat + up*h, written into `out`. */
  point(d: number, lat: number, h: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos).addScaledVector(this.normal, d).addScaledVector(this.tangent, lat).addScaledVector(this.up, h)
  }

  get night(): boolean {
    const h = this.ctx.state.time.hours
    return h >= 19.5 || h < 5.5
  }

  update(dt: number): void {
    const ctx = this.ctx
    const cam = ctx.camera
    cam.getWorldDirection(this.fwd)
    this.viewer.copy(cam.position)
    this.evalIn -= dt
    if (this.evalIn <= 0) {
      this.evalIn = EVAL_SECONDS
      this.evaluate()
    }
    if (this.kind === 'sortie') {
      const h = ctx.state.hero.position
      this.pos.set(h.x, h.y + 0.9, h.z)
      const l = this.frame.toLocal(h, this.tmp)
      const b = DRIFT_BOUNDS
      const ex = l.x / ((b.x1 - b.x0) / 2)
      const ez = l.z / ((b.z1 - b.z0) / 2)
      const face = Math.abs(ex) > Math.abs(ez) ? this.tmp2.set(Math.sign(ex), 0, 0) : this.tmp2.set(0, 0, Math.sign(ez) || 1)
      this.frame.dirToWorld(face, this.normal)
    } else if (this.kind !== 'free') {
      this.frame.toWorld(this.localPos, this.pos)
      this.frame.dirToWorld(this.localNormal, this.normal)
    }
    this.basis()
    this.visible = this.seaVisible()
  }

  private basis(): void {
    const n = this.normal
    if (Math.abs(n.y) > 0.8) {
      this.tangent.set(1, 0, 0).applyAxisAngle(this.up.set(0, 1, 0), -this.frame.heading)
      this.up.crossVectors(n, this.tangent).normalize()
    } else {
      this.up.set(0, 1, 0)
      this.tangent.crossVectors(this.up, n).normalize()
      this.up.crossVectors(n, this.tangent).normalize()
    }
  }

  private seaVisible(): boolean {
    const ctx = this.ctx
    if (ctx.state.mode === 'sortie' || ctx.state.hero.medium === 'water') return true
    if (ctx.state.debug.cameraLocked) return true
    const env = ctx.services.drift?.cameraEnv()
    if (!env) return true
    if (env.indoor < 0.5) return true
    if (env.seaInView === false) return false
    if (this.kind === 'window') return true
    return env.glassDist < 29 || env.airHaze >= 0.5
  }

  private setLocal(kind: StageKind, world: Vec3, normalWorld: Vec3, windowId: string | null): void {
    const before = this.tmp2.copy(this.localPos)
    this.frame.toLocal(world, this.localPos)
    this.frame.dirToLocal(normalWorld, this.localNormal).normalize()
    const moved = before.distanceTo(this.localPos)
    const jumped = this.kind !== kind || (this.windowId !== windowId && moved > 6) || moved > 25
    if (jumped) this.epoch++
    this.kind = kind
    this.windowId = windowId
  }

  private evaluate(): void {
    const ctx = this.ctx
    const st = ctx.state
    if (st.mode === 'sortie' || (st.hero.medium === 'water' && !st.debug.cameraLocked)) {
      if (this.kind !== 'sortie') this.epoch++
      this.kind = 'sortie'
      this.windowId = null
      return
    }
    const drift = ctx.services.drift
    const cam = this.viewer
    if (drift) {
      for (const k of PROBES) {
        this.probe.copy(cam).addScaledVector(this.fwd, k)
        const w = drift.nearestWindow(this.probe, 0.6 + k * 0.18)
        if (!w) continue
        if (w.normal.x * this.fwd.x + w.normal.y * this.fwd.y + w.normal.z * this.fwd.z < 0.1) continue
        this.setLocal('window', w.position, w.normal, w.id)
        return
      }
    }
    if ((this.kind === 'window' || this.kind === 'hull' || this.kind === 'dome') && this.pos.distanceTo(cam) < KEEP_RANGE) return
    if (!this.hullExit()) {
      if (this.kind !== 'free') this.epoch++
      this.kind = 'free'
      this.windowId = null
      this.pos.copy(cam).addScaledVector(this.fwd, 12)
      this.normal.copy(this.fwd)
    }
  }

  /** Where the view ray leaves the Drift's envelope; the domes and the Hauts look up through the roof. */
  private hullExit(): boolean {
    const l = this.frame.toLocal(this.viewer, this.tmp)
    const b = DRIFT_BOUNDS
    const inside = l.x > b.x0 && l.x < b.x1 && l.z > b.z0 && l.z < b.z1 && l.y > b.y0 && l.y < b.y1
    if (!inside) return false
    const d = this.frame.dirToLocal(this.fwd, this.probe)
    let tBest = Infinity
    let face = 0
    const test = (t: number, f: number) => { if (t > 0 && t < tBest) { tBest = t; face = f } }
    if (d.x > 1e-4) test((b.x1 - l.x) / d.x, 1)
    if (d.x < -1e-4) test((b.x0 - l.x) / d.x, 2)
    if (d.z > 1e-4) test((b.z1 - l.z) / d.z, 3)
    if (d.z < -1e-4) test((b.z0 - l.z) / d.z, 4)
    if (d.y > 1e-4) test((b.y1 - l.y) / d.y, 5)
    if (d.y < -1e-4) test((b.y0 - l.y) / d.y, 6)
    if (!isFinite(tBest)) return false
    const hit = this.tmp2.copy(l).addScaledVector(d, tBest)
    const n = face === 1 ? [1, 0, 0] : face === 2 ? [-1, 0, 0] : face === 3 ? [0, 0, 1] : face === 4 ? [0, 0, -1] : face === 5 ? [0, 1, 0] : [0, -1, 0]
    const kind: StageKind = face === 5 ? 'dome' : 'hull'
    if (this.kind !== kind || this.localPos.distanceTo(hit) > 25) this.epoch++
    this.kind = kind
    this.windowId = null
    this.localPos.copy(hit)
    this.localNormal.set(n[0]!, n[1]!, n[2]!)
    return true
  }
}
