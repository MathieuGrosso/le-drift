import * as THREE from 'three'
import { CEILING_Y } from '../core/layout'
import type { GameContext, Vec3 } from '../core/types'
import type { Bubbles } from './bubbles'
import type { FishSchools } from './fish'
import { buildBird, type BirdModel } from './models'
import { PALETTE, celMaterial, clampWaterY, disposeObject } from './shared'
import type { DriftFrame, Stage } from './stage'

type Phase = 'descend' | 'grab' | 'approach' | 'hover' | 'ascend'
interface Job { target: Vec3; close: boolean; resolve: () => void }

const ABOVE = CEILING_Y + 12
const UP = new THREE.Vector3(0, 1, 0)
const ORIGIN = new THREE.Vector3()

function bezier(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u: number): THREE.Vector3 {
  const v = 1 - u
  const w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u
  return out.set(
    a.x * w0 + b.x * w1 + c.x * w2 + d.x * w3,
    a.y * w0 + b.y * w1 + c.y * w2 + d.y * w3,
    a.z * w0 + b.z * w1 + c.z * w2 + d.z * w3,
  )
}

/**
 * La Chose, always seen through glass. A dive: falls through the ceiling (rings, bubbles), takes one fish,
 * goes back up. A close dive (act 3) glides down to the window, hovers side-on with one eye on whoever is
 * behind the glass, holding the fish like grandfather holds his pen, then leaves through the ceiling.
 */
export class Chose {
  readonly group = new THREE.Group()
  private readonly bird: BirdModel
  private readonly heldMat: THREE.Material
  private readonly jobs: Job[] = []
  private job: Job | null = null
  private phase: Phase = 'descend'
  private t = 0
  private dur = 1
  private prey = -1
  private readonly preyPos = new THREE.Vector3()
  private readonly pos = new THREE.Vector3()
  private readonly prevPos = new THREE.Vector3()
  private readonly fwd = new THREE.Vector3(0, -1, 0.2)
  private readonly want = new THREE.Vector3()
  private readonly b0 = new THREE.Vector3()
  private readonly b1 = new THREE.Vector3()
  private readonly b2 = new THREE.Vector3()
  private readonly b3 = new THREE.Vector3()
  private readonly hover = new THREE.Vector3()
  private readonly hoverLocal = new THREE.Vector3()
  private readonly sideLocal = new THREE.Vector3()
  private readonly viewer = new THREE.Vector3()
  private readonly side = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private readonly mat4 = new THREE.Matrix4()
  private readonly quat = new THREE.Quaternion()
  private readonly color = new THREE.Color()
  private beatPhase = 0
  private beatAmp = 0
  private beatFreq = 1
  private spread = 0.2
  private trail = 0
  private readonly rng: () => number
  lastDiveElapsed = -Infinity
  onRipple: (x: number, z: number, strength: number) => void = (x, z, strength) => this.ctx.bus.emit('ceiling:ripple', { x, z, strength })

  constructor(
    private readonly ctx: GameContext,
    private readonly stage: Stage,
    private readonly frame: DriftFrame,
    private readonly bubbles: Bubbles,
    private readonly fish: FishSchools,
  ) {
    this.rng = ctx.rng('fauna:chose')
    this.heldMat = celMaterial(ctx, { color: PALETTE.corail1, vertexColors: true, rim: 0.5 })
    this.bird = buildBird(
      ({ double }) => celMaterial(ctx, { color: 0xffffff, vertexColors: true, rim: 0.9, side: double ? THREE.DoubleSide : THREE.FrontSide }),
      this.heldMat,
    )
    this.group.add(this.bird.root)
    this.group.visible = false
  }

  get busy(): boolean {
    return this.job !== null || this.jobs.length > 0
  }

  get position(): Vec3 | null {
    return this.job ? this.pos : null
  }

  dive(target: Vec3, close: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.jobs.push({ target: { x: target.x, y: target.y, z: target.z }, close, resolve })
    })
  }

  private begin(job: Job): void {
    const ctx = this.ctx
    this.job = job
    this.lastDiveElapsed = ctx.clock.elapsed
    const tg = job.target
    if (job.close) this.setupHover(tg)
    const guess = job.close ? this.hover : this.tmp.set(tg.x, tg.y, tg.z)
    this.fish.ensureNear(guess, 25)
    this.prey = this.fish.nearestFish(guess, 40)
    if (this.prey >= 0) this.fish.fishPosition(this.prey, this.preyPos)
    else this.preyPos.copy(guess)
    this.preyPos.y = clampWaterY(ctx, this.preyPos.x, this.preyPos.y, this.preyPos.z, 2, 6)

    let cx: number, cz: number
    const st = this.stage
    const nh = Math.hypot(st.normal.x, st.normal.z)
    if (st.kind !== 'sortie' && nh > 0.5) {
      const th = (0.15 + this.rng() * 0.7) * Math.PI
      cx = st.tangent.x * Math.cos(th) + st.normal.x / nh * Math.sin(th)
      cz = st.tangent.z * Math.cos(th) + st.normal.z / nh * Math.sin(th)
    } else {
      const a = this.rng() * Math.PI * 2
      cx = Math.cos(a); cz = Math.sin(a)
    }
    const reach = job.close ? 45 : 28
    this.b0.set(this.preyPos.x + cx * reach, ABOVE, this.preyPos.z + cz * reach)
    this.b1.copy(this.b0).add(this.tmp.set(0, -16, 0))
    this.pos.copy(this.b0)
    this.prevPos.copy(this.b0)
    this.fwd.set(-cx * 0.4, -1, -cz * 0.4).normalize()
    this.bird.heldFish.visible = false
    this.group.visible = true
    this.enter('descend', job.close ? 7.5 : 3.4)
    ctx.bus.emit('chose:dive', { position: { x: this.preyPos.x, y: this.preyPos.y, z: this.preyPos.z }, phase: 'descend' })
    ctx.bus.emit('audio:cue', { cue: 'wonder' })
  }

  private setupHover(target: Vec3): void {
    const ctx = this.ctx
    const st = this.stage
    const win = ctx.services.drift?.nearestWindow(target, 14) ?? null
    let px: number, py: number, pz: number, nx: number, nz: number
    if (win) {
      px = win.position.x; py = win.position.y; pz = win.position.z
      nx = win.normal.x; nz = win.normal.z
    } else if (st.kind !== 'sortie' && st.kind !== 'free') {
      px = st.pos.x; py = st.pos.y; pz = st.pos.z
      nx = st.normal.x; nz = st.normal.z
    } else {
      const d = this.frame.origin
      px = target.x; py = target.y; pz = target.z
      nx = target.x - d.x; nz = target.z - d.z
    }
    const nl = Math.hypot(nx, nz) || 1
    nx /= nl; nz /= nl
    const eye = st.viewer
    const hy = Math.hypot(eye.x - px, eye.z - pz) < 25 ? eye.y : py
    this.hover.set(px + nx * 6.5, hy - 0.7, pz + nz * 6.5)
    this.hover.y = clampWaterY(ctx, this.hover.x, this.hover.y, this.hover.z, 4, 6)
    this.frame.toLocal(this.hover, this.hoverLocal)
    this.side.set(-nz, 0, nx)
    this.frame.dirToLocal(this.side, this.sideLocal)
    this.viewer.copy(st.viewer)
  }

  private followDrift(): void {
    this.frame.toWorld(this.hoverLocal, this.hover)
    this.frame.dirToWorld(this.sideLocal, this.side)
    this.viewer.copy(this.stage.viewer)
  }

  private enter(p: Phase, dur: number): void {
    this.phase = p
    this.t = 0
    this.dur = dur
  }

  private finish(): void {
    const job = this.job
    this.job = null
    this.group.visible = false
    this.bird.heldFish.visible = false
    this.fish.setThreat(null, 0)
    job?.resolve()
  }

  update(dt: number): void {
    if (!this.job) {
      const next = this.jobs.shift()
      if (!next) return
      this.begin(next)
    }
    const job = this.job
    if (!job) return
    this.t += dt
    const u = Math.min(1, this.t / this.dur)
    this.prevPos.copy(this.pos)
    let lookSide = false

    if (this.phase === 'descend') {
      if (this.prey >= 0) this.fish.fishPosition(this.prey, this.preyPos)
      this.b3.copy(this.preyPos)
      this.b2.copy(this.preyPos).add(this.tmp.set(0, 7, 0)).addScaledVector(this.fwd, -4)
      const e = job.close ? u * u * (3 - 2 * u) : Math.pow(u, 1.6)
      bezier(this.pos, this.b0, this.b1, this.b2, this.b3, e)
      this.spread = job.close ? 0.85 : u < 0.72 ? 0.08 : THREE.MathUtils.lerp(0.08, 1, (u - 0.72) / 0.28)
      this.beatAmp = job.close ? 0.18 : 0.05
      this.beatFreq = job.close ? 0.35 : 2
      if (u >= 1) this.startGrab()
    } else if (this.phase === 'grab') {
      this.pos.addScaledVector(this.fwd, dt * 2)
      this.spread = 1
      this.beatAmp = 0.7
      this.beatFreq = 1.4
      if (u >= 1) {
        if (job.close) {
          this.b0.copy(this.pos)
          this.enter('approach', 4)
        } else this.startAscend(4.2, 22)
      }
    } else if (this.phase === 'approach') {
      this.followDrift()
      const e = u * u * (3 - 2 * u)
      this.pos.lerpVectors(this.b0, this.hover, e)
      this.spread = 1
      this.beatAmp = 0.45
      this.beatFreq = 0.45
      lookSide = u > 0.5
      if (u >= 1) this.enter('hover', 9)
    } else if (this.phase === 'hover') {
      this.followDrift()
      this.pos.copy(this.hover)
      this.pos.y += Math.sin(this.t * 0.9) * 0.6
      this.pos.addScaledVector(this.side, Math.sin(this.t * 0.45) * 0.8)
      this.spread = 1
      this.beatAmp = 0.55
      this.beatFreq = 0.3
      lookSide = true
      if (u >= 1) this.startAscend(8, 34)
    } else {
      const e = job.close ? u * u * (3 - 2 * u) : u
      bezier(this.pos, this.b0, this.b1, this.b2, this.b3, e)
      this.spread = 1
      this.beatAmp = job.close ? 0.7 : 0.9
      this.beatFreq = job.close ? 0.5 : 1.3
      if (u >= 1) {
        this.finish()
        return
      }
    }

    const crossedDown = this.prevPos.y >= CEILING_Y && this.pos.y < CEILING_Y
    const crossedUp = this.prevPos.y < CEILING_Y && this.pos.y >= CEILING_Y
    if (crossedDown || crossedUp) this.splash(this.pos.x, this.pos.z, crossedDown)
    const under = this.pos.y < CEILING_Y
    this.fish.setThreat(under ? this.pos : null, job.close ? 8 : 15)
    if (under) {
      this.trail += dt * (this.phase === 'descend' && !job.close ? 40 : 8)
      while (this.trail >= 1) {
        this.trail -= 1
        this.bubbles.burst(this.pos.x, this.pos.y, this.pos.z, 1, 2.5, 0.6, 0.1)
      }
    }
    this.pose(dt, lookSide)
  }

  private startGrab(): void {
    const job = this.job
    if (!job) return
    this.enter('grab', job.close ? 0.9 : 0.6)
    if (this.prey >= 0) {
      this.fish.fishColor(this.prey, this.color)
      this.fish.take(this.prey)
      const m = this.heldMat as THREE.Material & { color?: THREE.Color }
      if (m.color) m.color.copy(this.color)
    }
    this.bird.heldFish.visible = true
    this.bubbles.burst(this.pos.x, this.pos.y, this.pos.z, 30, 2, 1, 0.12)
    this.ctx.bus.emit('chose:dive', { position: { x: this.pos.x, y: this.pos.y, z: this.pos.z }, phase: 'grab' })
  }

  private startAscend(dur: number, run: number): void {
    const h = Math.hypot(this.fwd.x, this.fwd.z) > 0.2 ? this.tmp.set(this.fwd.x, 0, this.fwd.z).normalize() : this.tmp.set(1, 0, 0)
    if (this.job?.close) h.copy(this.side)
    this.b0.copy(this.pos)
    this.b1.copy(this.pos).addScaledVector(h, 8).add(this.want.set(0, 3, 0))
    this.b3.copy(this.pos).addScaledVector(h, run)
    this.b3.y = CEILING_Y + 14
    this.b2.copy(this.b3).add(this.want.set(0, -12, 0))
    this.enter('ascend', dur)
    this.ctx.bus.emit('chose:dive', { position: { x: this.pos.x, y: this.pos.y, z: this.pos.z }, phase: 'ascend' })
  }

  private splash(x: number, z: number, down: boolean): void {
    this.bubbles.rings(x, z, 1.3)
    this.bubbles.burst(x, CEILING_Y - 1.2, z, 90, 4, down ? -3.5 : 1.2, 0.2)
    this.onRipple(x, z, 1)
  }

  private pose(dt: number, lookSide: boolean): void {
    const b = this.bird
    if (lookSide) {
      this.want.copy(this.side)
    } else {
      this.want.subVectors(this.pos, this.prevPos)
      if (this.want.lengthSq() < 1e-6) this.want.copy(this.fwd)
    }
    this.want.normalize()
    this.fwd.lerp(this.want, Math.min(1, dt * (lookSide ? 1.5 : 5))).normalize()
    this.mat4.lookAt(this.fwd, ORIGIN, UP)
    this.quat.setFromRotationMatrix(this.mat4)
    b.root.quaternion.copy(this.quat)
    b.root.position.copy(this.pos)
    b.root.updateMatrixWorld(true)

    this.beatPhase += dt * this.beatFreq * Math.PI * 2
    const beat = Math.sin(this.beatPhase) * this.beatAmp
    const lag = Math.sin(this.beatPhase - 0.8) * this.beatAmp
    const fold = 1 - this.spread
    for (const w of b.wings) {
      const s = w.side
      w.inner.rotation.set(0.12 * fold, s * fold * 1.05, s * (beat + 0.06 - fold * 0.25))
      w.outer.rotation.set(0.05 * fold, s * fold * 1.75, s * (lag * 0.8 - fold * 0.05))
    }
    b.tail.rotation.set(-0.15 + Math.sin(this.beatPhase) * 0.08 * this.beatAmp, 0, 0)
    const delicate = this.phase === 'hover' || this.phase === 'approach'
    const talonX = this.bird.heldFish.visible ? (delicate ? -1.2 : -0.5) : 0.3
    b.talon.rotation.x += (talonX - b.talon.rotation.x) * Math.min(1, dt * 3)
    b.talon.rotation.z = delicate ? Math.sin(this.t * 0.6) * 0.08 : 0

    let turn = 0
    if (lookSide) {
      b.root.worldToLocal(this.tmp.copy(this.viewer))
      turn = THREE.MathUtils.clamp(Math.atan2(this.tmp.x, this.tmp.z), -1.0, 1.0)
    }
    b.neck.rotation.y += (turn - b.neck.rotation.y) * Math.min(1, dt * 1.5)
    b.neck.rotation.x = this.phase === 'descend' && !this.job?.close ? 0.25 : 0
  }

  dispose(): void {
    for (const j of this.jobs) j.resolve()
    this.jobs.length = 0
    this.job?.resolve()
    this.job = null
    this.group.removeFromParent()
    disposeObject(this.bird.root)
  }
}
