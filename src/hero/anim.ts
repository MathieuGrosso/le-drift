import * as THREE from 'three'
import { BONES, type BoneName, type HeroModel } from './model'

export type ClipId =
  | 'idle' | 'idle-floor' | 'walk' | 'run' | 'swim' | 'swim-sprint' | 'kick' | 'sink' | 'land'
  | 'climb' | 'climb-idle' | 'climb-jump' | 'glide' | 'scrub' | 'ride' | 'exhausted' | 'talk' | 'hand-on-ceiling'
  | 'idle-dry' | 'walk-dry' | 'run-dry' | 'stairs-up' | 'stairs-down' | 'ladder' | 'ladder-top' | 'fall' | 'land-dry'
  | 'shake-off' | 'sit-down' | 'sit' | 'eat' | 'stand-up' | 'lean' | 'open-hatch' | 'lie-down' | 'sleep' | 'wake'
  | 'sprint' | 'jump' | 'roll' | 'skid' | 'land-hard' | 'zip' | 'slide' | 'tube-in' | 'tube-out'
  | 'carry-idle' | 'carry-walk' | 'clip-ring' | 'hand-on-glass' | 'turn-valve' | 'pump' | 'ladder-slide' | 'climb-slip'

export type GestureClip = 'hand-on-glass' | 'turn-valve' | 'pump' | 'open-hatch' | 'clip-ring' | 'talk' | 'eat' | 'shake-off'

export interface AnimParams {
  t: number
  phase: number
  clipTime: number
  speed: number
  bank: number
  pitch: number
  climbX: number
  climbY: number
  wet: number
  exhausted: boolean
  inWater: boolean
  swing: number
}

const NB = BONES.length

class PoseBuf {
  q = new Float32Array(NB * 4)
  pitch = 0
  roll = 0
  twist = 0
  lift = 0
  hipsY = 0
  copy(o: PoseBuf): void {
    this.q.set(o.q)
    this.pitch = o.pitch
    this.roll = o.roll
    this.twist = o.twist
    this.lift = o.lift
    this.hipsY = o.hipsY
  }
}

const e = new THREE.Euler()
const qa = new THREE.Quaternion()
const qb = new THREE.Quaternion()

class PoseOut {
  buf: PoseBuf = new PoseBuf()
  private set = new Uint8Array(NB)
  reset(target: PoseBuf): void {
    this.buf = target
    this.set.fill(0)
    target.pitch = target.roll = target.twist = target.lift = target.hipsY = 0
  }
  r(b: BoneName, x: number, y = 0, z = 0): void {
    const i = BONES.indexOf(b)
    qa.setFromEuler(e.set(x, y, z, 'XYZ'))
    this.buf.q[i * 4] = qa.x
    this.buf.q[i * 4 + 1] = qa.y
    this.buf.q[i * 4 + 2] = qa.z
    this.buf.q[i * 4 + 3] = qa.w
    this.set[i] = 1
  }
  finish(): void {
    for (let i = 0; i < NB; i++) {
      if (this.set[i]) continue
      this.buf.q[i * 4] = this.buf.q[i * 4 + 1] = this.buf.q[i * 4 + 2] = 0
      this.buf.q[i * 4 + 3] = 1
    }
  }
}

type Clip = (o: PoseOut, s: AnimParams) => void
const { sin, cos, PI, min, max } = Math
const TAU = PI * 2

function arms(o: PoseOut, ux: number, uz: number, fx: number, side: 'both' | 'L' | 'R' = 'both', mirrorX = 0): void {
  if (side !== 'R') {
    o.r('upperArmL', ux - mirrorX, 0, -uz)
    o.r('foreArmL', fx)
  }
  if (side !== 'L') {
    o.r('upperArmR', ux + mirrorX, 0, uz)
    o.r('foreArmR', fx)
  }
}

function legs(o: PoseOut, tl: number, kl: number, tr: number, kr: number, spread = 0.06): void {
  o.r('thighL', tl, 0, -spread)
  o.r('shinL', kl)
  o.r('thighR', tr, 0, spread)
  o.r('shinR', kr)
}

function breathe(o: PoseOut, s: AnimParams, depth = 1): void {
  const b = sin(s.t * 1.7) * 0.025 * depth
  o.r('spine', -b * 0.5)
  o.r('chest', b)
  o.r('neck', -b * 0.5)
}

function gait(o: PoseOut, s: AnimParams, k: { stride: number; knee: number; arm: number; lean: number; bounce: number; floaty: number }): void {
  const p = s.phase * TAU
  const sw = sin(p)
  const lk = max(0, sin(p + PI * 0.5))
  const rk = max(0, sin(p + PI * 1.5))
  legs(o, sw * k.stride, -0.15 - lk * k.knee, -sw * k.stride, -0.15 - rk * k.knee)
  o.r('footL', 0.15 * sin(p - 0.6) + 0.1)
  o.r('footR', -0.15 * sin(p - 0.6) + 0.1)
  const lag = sin(p - 0.9) * k.arm * 0.45
  arms(o, -sw * k.arm, 0.12 + k.floaty * 0.25, 0.35 + k.floaty * 0.25 + max(0, -lag), 'L')
  arms(o, sw * k.arm, 0.12 + k.floaty * 0.25, 0.35 + k.floaty * 0.25 + max(0, lag), 'R')
  o.r('hips', 0, -sw * 0.07, 0)
  o.r('spine', -k.lean, sw * 0.08, 0)
  o.r('chest', 0, -sw * 0.12, s.bank * 0.4)
  o.r('head', 0.05 + k.lean * 0.5, sw * 0.05, 0)
  o.buf.hipsY = -abs2(cos(p)) * k.bounce
  o.buf.roll = s.bank * 0.3
}

function abs2(x: number): number {
  return x < 0 ? -x : x
}

const CLIPS: Record<ClipId, Clip> = {
  idle(o, s) {
    const t = s.t
    o.buf.pitch = -0.18 + s.pitch * 0.3
    o.buf.lift = sin(t * 1.3) * 0.05
    breathe(o, s)
    o.r('head', 0.08 + sin(t * 0.7) * 0.05, sin(t * 0.45) * 0.15)
    const scull = sin(t * 2.2) * 0.25
    o.r('upperArmL', 0.25 + scull * 0.3, 0, -0.55 - scull * 0.2)
    o.r('foreArmL', 0.5, 0, 0)
    o.r('handL', 0, scull, 0)
    o.r('upperArmR', 0.25 - scull * 0.3, 0, 0.55 + scull * 0.2)
    o.r('foreArmR', 0.5)
    o.r('handR', 0, -scull, 0)
    const f = sin(t * 2.4) * 0.18
    legs(o, 0.15 + f, -0.45 - f * 0.5, 0.05 - f, -0.3 + f * 0.5, 0.1)
    o.r('footL', -0.5)
    o.r('footR', -0.5)
  },
  'idle-floor'(o, s) {
    breathe(o, s)
    o.buf.lift = sin(s.t * 0.9) * 0.01
    o.r('head', 0.04 + sin(s.t * 0.5) * 0.04, sin(s.t * 0.33) * 0.25)
    const drift = sin(s.t * 1.1) * 0.12
    arms(o, 0.05 + drift * 0.3, 0.32 + drift, 0.35)
    legs(o, 0.03, -0.08, -0.03, -0.05, 0.08)
    o.r('spine', 0, 0, sin(s.t * 0.8) * 0.03)
  },
  walk(o, s) {
    gait(o, s, { stride: 0.42, knee: 0.75, arm: 0.35, lean: 0.06, bounce: 0.06, floaty: 1 })
    o.buf.lift = 0.04 + max(0, sin(s.phase * TAU * 2)) * 0.05
  },
  run(o, s) {
    gait(o, s, { stride: 0.7, knee: 1.25, arm: 0.6, lean: 0.22, bounce: 0.09, floaty: 0.6 })
    o.buf.lift = 0.06 + max(0, sin(s.phase * TAU * 2)) * 0.1
  },
  'idle-dry'(o, s) {
    breathe(o, s, 0.8)
    const w = sin(s.t * 0.23 + sin(s.t * 0.11) * 1.3)
    const ws = w * w * w
    o.r('head', 0.02 + sin(s.t * 0.5) * 0.03, sin(s.t * 0.27) * 0.3, ws * 0.05)
    arms(o, 0.04, 0.12, 0.2 + sin(s.t * 1.7 - 0.6) * 0.02)
    const lift = sin(s.t * 1.7) * 0.012
    o.r('upperArmL', 0.04 + ws * 0.04, 0, -0.12 - max(0, ws) * 0.04 - lift)
    o.r('upperArmR', 0.04 - ws * 0.04, 0, 0.12 + max(0, -ws) * 0.04 + lift)
    legs(o, 0.02 + max(0, ws) * 0.08, -0.04 - max(0, ws) * 0.16, -0.02 + max(0, -ws) * 0.08, -0.02 - max(0, -ws) * 0.16, 0.06)
    o.r('spine', 0, 0, sin(s.t * 0.6) * 0.02 - ws * 0.035)
    o.r('chest', sin(s.t * 1.7) * 0.02, 0, ws * 0.03)
    o.buf.roll = ws * 0.022
    o.buf.hipsY = -abs2(ws) * 0.012
  },
  'walk-dry'(o, s) {
    gait(o, s, { stride: 0.38, knee: 0.6, arm: 0.3, lean: 0.03, bounce: 0.035, floaty: 0 })
  },
  'run-dry'(o, s) {
    gait(o, s, { stride: 0.75, knee: 1.35, arm: 0.75, lean: 0.25, bounce: 0.07, floaty: 0 })
    arms(o, -sin(s.phase * TAU) * 0.8, 0.15, 1.3, 'L')
    arms(o, sin(s.phase * TAU) * 0.8, 0.15, 1.3, 'R')
  },
  'stairs-up'(o, s) {
    gait(o, s, { stride: 0.5, knee: 1.1, arm: 0.3, lean: 0.12, bounce: 0.03, floaty: 0 })
    const p = s.phase * TAU
    o.r('thighL', max(0.0, sin(p)) * 0.9, 0, -0.06)
    o.r('thighR', max(0.0, -sin(p)) * 0.9, 0, 0.06)
  },
  'stairs-down'(o, s) {
    gait(o, s, { stride: 0.35, knee: 0.9, arm: 0.25, lean: -0.05, bounce: 0.05, floaty: 0 })
    o.r('head', -0.25)
  },
  swim(o, s) {
    const p = s.phase * TAU
    const go = THREE.MathUtils.smoothstep(s.speed, 0.5, 1.6)
    const t = s.t
    o.buf.pitch = -1.12 - go * 0.2 + s.pitch
    o.buf.twist = s.bank * 0.6 + (1 - go) * 0.28
    o.buf.roll = (1 - go) * sin(t * 0.8) * 0.04
    o.buf.lift = sin(p * 2) * 0.03 * go + sin(t * 1.1) * 0.02 * (1 - go)
    const c = (s.phase % 1)
    let ux: number, uz: number, fx: number
    if (c < 0.35) {
      const k = c / 0.35
      ux = 2.8 - k * 1.0
      uz = 0.2 + k * 0.9
      fx = 0.3 + k * 0.4
    } else if (c < 0.6) {
      const k = (c - 0.35) / 0.25
      ux = 1.8 - k * 1.1
      uz = 1.1 - k * 0.6
      fx = 0.7 + k * 1.2
    } else {
      const k = (c - 0.6) / 0.4
      const e = k * k * (3 - 2 * k)
      ux = 0.7 + e * 2.1
      uz = 0.5 - e * 0.3
      fx = 1.9 - e * 1.6
    }
    const lerp = THREE.MathUtils.lerp
    const scull = sin(t * 2.3)
    const reach = sin(t * 0.7) * 0.08
    o.r('upperArmL', lerp(2.35 + reach, ux, go), lerp(-0.25, 0, go), -lerp(0.62 - reach, uz, go))
    o.r('foreArmL', lerp(0.42, fx, go))
    o.r('handL', lerp(-0.55, 0, go), lerp(0.35, 0, go), 0)
    o.r('upperArmR', lerp(0.75 + scull * 0.2, ux, go), 0, lerp(0.55 + scull * 0.15, uz, go))
    o.r('foreArmR', lerp(1.15 - scull * 0.15, fx, go))
    o.r('handR', 0, -scull * 0.4 * (1 - go), 0)
    const f = sin(p * 2) * 0.32 * go + sin(t * 1.9) * 0.12 * (1 - go)
    const bendL = lerp(0.95, 0.25, go)
    legs(o, lerp(0.42, -0.05, go) + f, -bendL - max(0, f) * 0.6, -0.08 - f, -lerp(0.3, 0.25, go) - max(0, -f) * 0.6, 0.1)
    o.r('footL', -0.85)
    o.r('footR', -0.95)
    o.r('spine', -0.1 * (1 - go), 0.12 * (1 - go), 0)
    o.r('chest', 0.05, lerp(0.18, 0, go), s.bank * 0.3)
    o.r('head', lerp(0.62, 0.75, go), lerp(0.32, 0, go), 0)
  },
  'swim-sprint'(o, s) {
    const p = s.phase * TAU
    o.buf.pitch = -1.45 + s.pitch
    o.buf.twist = s.bank * 0.6 + sin(p) * 0.35
    const l = p
    const r = p + PI
    o.r('upperArmL', PI * 0.5 - cos(l) * 1.45, 0, -0.25 - max(0, sin(l)) * 0.5)
    o.r('foreArmL', 0.25 + max(0, sin(l)) * 1.2)
    o.r('upperArmR', PI * 0.5 - cos(r) * 1.45, 0, 0.25 + max(0, sin(r)) * 0.5)
    o.r('foreArmR', 0.25 + max(0, sin(r)) * 1.2)
    const f = sin(p * 3) * 0.38
    legs(o, f, -0.15 - max(0, f) * 0.4, -f, -0.15 - max(0, -f) * 0.4, 0.05)
    o.r('footL', -1.0)
    o.r('footR', -1.0)
    o.r('head', 0.7, sin(l) * 0.35, 0)
    o.r('chest', 0, sin(p) * 0.2, 0)
  },
  kick(o, s) {
    const k = min(1, s.clipTime / 0.55)
    const snap = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75
    o.buf.pitch = -0.35 + s.pitch * 0.5
    o.buf.lift = 0
    legs(o, 0.55 - snap * 0.9, -1.3 + snap * 1.2, 0.55 - snap * 0.9, -1.3 + snap * 1.2, 0.04)
    o.r('footL', -1.1 * snap - 0.2)
    o.r('footR', -1.1 * snap - 0.2)
    arms(o, 1.8 - snap * 1.9, 0.6 + snap * 0.2, 0.3)
    o.r('spine', -0.1 + snap * 0.2)
    o.r('head', 0.35)
  },
  sink(o, s) {
    const t = s.t
    breathe(o, s)
    o.buf.pitch = 0.05
    const fl = sin(t * 2.6) * 0.18
    o.r('upperArmL', 0.3, 0, -1.1 - fl)
    o.r('foreArmL', 0.35)
    o.r('upperArmR', 0.3, 0, 1.1 + fl)
    o.r('foreArmR', 0.35)
    legs(o, 0.3 + fl * 0.5, -0.7, 0.1 - fl * 0.5, -0.45, 0.12)
    o.r('footL', -0.4)
    o.r('footR', -0.4)
    o.r('head', -0.25)
  },
  land(o, s) {
    const k = min(1, s.clipTime / 0.45)
    const d = sin(k * PI) * (s.inWater ? 0.6 : 1)
    legs(o, 0.9 * d, -1.6 * d, 0.9 * d, -1.6 * d, 0.1)
    o.r('footL', -0.7 * d)
    o.r('footR', -0.7 * d)
    o.r('spine', -0.35 * d)
    arms(o, 0.6 * d, 0.5 * d, 0.6)
    o.buf.hipsY = -0.28 * d
  },
  'land-dry'(o, s) {
    CLIPS.land(o, { ...s, inWater: false })
  },
  climb(o, s) {
    const p = s.phase * TAU
    const side = s.climbX
    const a = sin(p)
    o.buf.pitch = 0.12 + s.pitch
    o.r('upperArmL', 2.6 + a * 0.45, 0, -0.35 - min(0, side) * 0.5)
    o.r('foreArmL', 0.7 - a * 0.5)
    o.r('upperArmR', 2.6 - a * 0.45, 0, 0.35 + max(0, side) * 0.5)
    o.r('foreArmR', 0.7 + a * 0.5)
    legs(o, 0.7 - a * 0.45, -1.2 + a * 0.4, 0.7 + a * 0.45, -1.2 - a * 0.4, 0.22)
    o.r('footL', -0.3)
    o.r('footR', -0.3)
    o.r('head', 0.35, side * 0.3, 0)
    o.r('chest', 0, a * 0.1, 0)
    o.buf.hipsY = sin(p * 2) * 0.03
  },
  'climb-idle'(o, s) {
    const b = sin(s.t * 1.6) * 0.04 * (s.exhausted ? 2.5 : 1)
    o.buf.pitch = 0.12 + s.pitch
    o.r('upperArmL', 2.55 + b, 0, -0.45)
    o.r('foreArmL', 0.75)
    o.r('upperArmR', 2.4 - b, 0, 0.45)
    o.r('foreArmR', 0.9)
    legs(o, 0.65, -1.15, 0.45, -0.9, 0.22)
    o.r('head', 0.25 + b, sin(s.t * 0.4) * 0.4, 0)
    o.r('chest', b)
  },
  'climb-jump'(o, s) {
    const k = min(1, s.clipTime / 0.4)
    o.buf.pitch = 0.08
    arms(o, 2.95, 0.25 - k * 0.1, 0.1)
    legs(o, 0.2 - k * 0.3, -0.25, 0.1 - k * 0.3, -0.2, 0.12)
    o.r('footL', -0.8)
    o.r('footR', -0.8)
    o.r('head', 0.5)
  },
  glide(o, s) {
    const t = s.t
    o.buf.pitch = -0.55 + s.pitch * 0.3
    o.buf.twist = s.bank * 0.5
    o.buf.roll = s.bank * 0.4
    const w = sin(t * 1.8) * 0.05
    o.r('upperArmL', 0.25, 0, -2.75 + w)
    o.r('foreArmL', 0.35)
    o.r('upperArmR', 0.25, 0, 2.75 - w)
    o.r('foreArmR', 0.35)
    legs(o, -0.25 + sin(t * 2.1) * 0.08, -0.3, -0.15 - sin(t * 2.1) * 0.08, -0.45, 0.05)
    o.r('footL', -0.9)
    o.r('footR', -0.9)
    o.r('head', 0.45, 0, -s.bank * 0.3)
    o.r('chest', 0.1, 0, s.bank * 0.3)
  },
  scrub(o, s) {
    const w = s.t * 7.5
    o.r('upperArmR', 1.35 + sin(w) * 0.32, 0, 0.35 + cos(w) * 0.3)
    o.r('foreArmR', 0.45 + sin(w + 1) * 0.15)
    o.r('handR', -0.4, 0, 0)
    o.r('upperArmL', 1.25, 0, -0.35)
    o.r('foreArmL', 0.3)
    o.r('handL', -1.0)
    o.r('chest', 0, sin(w) * 0.08, cos(w) * 0.05)
    o.r('spine', -0.06, 0, 0)
    o.r('head', 0.1, -sin(w) * 0.06, 0)
    if (s.inWater) {
      const f = sin(s.t * 3) * 0.15
      legs(o, 0.2 + f, -0.5, 0.1 - f, -0.4, 0.14)
      o.r('footL', -0.6)
      o.r('footR', -0.6)
    } else legs(o, 0.05, -0.1, -0.1, -0.05, 0.12)
  },
  ride(o, s) {
    o.buf.pitch = -0.55
    legs(o, 1.2, -1.3, 1.2, -1.3, 0.55)
    arms(o, 1.2, 0.35, 0.5)
    o.r('head', 0.55)
    o.r('chest', 0, 0, s.bank * 0.4)
    o.buf.hipsY = -0.25
  },
  exhausted(o, s) {
    const b = sin(s.t * 2.6) * 0.07
    if (s.inWater) {
      o.buf.pitch = 0.25
      o.buf.lift = sin(s.t * 0.8) * 0.05
      arms(o, 0.2, 0.7, 0.6)
      legs(o, 0.4, -0.9, 0.2, -0.6, 0.18)
      o.r('head', -0.55 + b)
      o.r('spine', -0.25)
      o.r('chest', b)
      return
    }
    o.r('spine', -0.35)
    o.r('chest', -0.1 + b)
    o.r('head', -0.45 + b * 0.5)
    arms(o, 0.15, 0.06, 0.15)
    legs(o, 0.2, -0.35, 0.05, -0.25, 0.1)
    o.buf.hipsY = -0.08
  },
  talk(o, s) {
    CLIPS[s.inWater ? 'idle-floor' : 'idle-dry'](o, s)
    const g = sin(s.t * 3.1)
    o.r('upperArmR', 0.35 + g * 0.12, 0, 0.25)
    o.r('foreArmR', 1.2 + sin(s.t * 4.3) * 0.2)
    o.r('handR', 0, g * 0.4, 0)
    o.r('head', 0.05 + sin(s.t * 5.2) * 0.04, sin(s.t * 0.9) * 0.1)
  },
  'hand-on-ceiling'(o, s) {
    o.buf.pitch = 0.05
    o.buf.lift = sin(s.t * 0.8) * 0.02
    o.r('upperArmR', 0.2, 0, 2.95)
    o.r('foreArmR', 0.05)
    o.r('handR', 1.4)
    o.r('upperArmL', 0.4, 0, -0.9)
    o.r('foreArmL', 0.5)
    legs(o, 0.15, -0.35, 0.05, -0.2, 0.08)
    o.r('footL', -0.6)
    o.r('footR', -0.6)
    o.r('head', 0.75)
    breathe(o, s, 0.6)
  },
  ladder(o, s) {
    const p = s.phase * TAU
    const a = sin(p)
    o.r('upperArmL', 2.3 + a * 0.35, 0, -0.18)
    o.r('foreArmL', 0.9 - a * 0.4)
    o.r('upperArmR', 2.3 - a * 0.35, 0, 0.18)
    o.r('foreArmR', 0.9 + a * 0.4)
    legs(o, 0.6 + a * 0.5, -1.1 - a * 0.3, 0.6 - a * 0.5, -1.1 + a * 0.3, 0.1)
    o.r('head', 0.2)
  },
  'ladder-top'(o, s) {
    const k = min(1, s.clipTime / 0.9)
    o.r('spine', -0.6 * sin(k * PI))
    arms(o, 1.4 - k * 1.2, 0.2, 0.9 - k * 0.6)
    legs(o, 1.1 * (1 - k), -1.3 * (1 - k), 0.5 * (1 - k), -0.6 * (1 - k))
  },
  fall(o, s) {
    const fl = sin(s.t * 9) * 0.25
    arms(o, 0.6, 1.4 + fl, 0.4)
    legs(o, 0.5 + fl, -0.9, 0.2 - fl, -0.5, 0.12)
    o.r('head', 0.2)
  },
  'shake-off'(o, s) {
    const k = min(1, s.clipTime / 1.3)
    const amp = sin(k * PI) * (1 - k * 0.3)
    const w = sin(s.t * 34) * amp
    o.r('spine', -0.15 * amp, w * 0.25, 0)
    o.r('chest', 0, w * 0.35, 0)
    o.r('head', -0.1, -w * 0.6, w * 0.15)
    arms(o, 0.1, 0.3 + amp * 0.2 + w * 0.2, 0.3)
    legs(o, 0.05, -0.15, -0.05, -0.12, 0.12)
    o.buf.hipsY = -0.04 * amp
  },
  'sit-down'(o, s) {
    const k = min(1, s.clipTime / 0.7)
    sitPose(o, k)
  },
  sit(o, s) {
    sitPose(o, 1)
    breathe(o, s, 0.7)
    o.r('head', 0.05 + sin(s.t * 0.3) * 0.04, sin(s.t * 0.21) * 0.2)
  },
  eat(o, s) {
    sitPose(o, 1)
    const c = (s.t * 0.45) % 1
    const up = c < 0.4 ? sin((c / 0.4) * PI) : 0
    o.r('upperArmR', 0.55 + up * 0.35, 0, 0.15)
    o.r('foreArmR', 1.0 + up * 1.2)
    o.r('head', -0.15 + up * 0.15)
  },
  'stand-up'(o, s) {
    sitPose(o, 1 - min(1, s.clipTime / 0.6))
  },
  lean(o, s) {
    breathe(o, s, 0.6)
    o.r('spine', -0.45)
    o.r('chest', -0.2)
    o.r('head', -0.35, sin(s.t * 0.3) * 0.25, 0)
    arms(o, 1.05, 0.35, 0.35)
    o.r('handL', -0.9)
    o.r('handR', -0.9)
    legs(o, 0.22, -0.05, 0.15, -0.05, 0.12)
    o.buf.hipsY = -0.02
  },
  'open-hatch'(o, s) {
    const w = s.t * 6
    o.r('upperArmL', 1.35 + sin(w) * 0.2, 0, -0.25 + cos(w) * 0.2)
    o.r('foreArmL', 0.35)
    o.r('upperArmR', 1.35 - sin(w) * 0.2, 0, 0.25 - cos(w) * 0.2)
    o.r('foreArmR', 0.35)
    o.r('spine', -0.1, sin(w) * 0.06, 0)
    legs(o, 0.25, -0.2, -0.15, -0.1, 0.12)
  },
  'lie-down'(o, s) {
    lyingPose(o, s, min(1, s.clipTime / 1.0))
  },
  sleep(o, s) {
    lyingPose(o, s, 1)
  },
  wake(o, s) {
    lyingPose(o, s, 1 - min(1, s.clipTime / 1.0))
  },
  sprint(o, s) {
    gait(o, s, { stride: 0.88, knee: 1.55, arm: 0.95, lean: 0.36, bounce: 0.09, floaty: 0 })
    arms(o, -sin(s.phase * TAU) * 1.0, 0.12, 1.55, 'L')
    arms(o, sin(s.phase * TAU) * 1.0, 0.12, 1.55, 'R')
    o.r('head', 0.25, sin(s.phase * TAU) * 0.05, 0)
    o.buf.lift = 0.05 + max(0, sin(s.phase * TAU * 2)) * 0.12
  },
  jump(o, s) {
    const k = min(1, s.clipTime / 0.35)
    const tuck = sin(min(1, k * 1.4) * PI * 0.5)
    legs(o, 0.95 * tuck, -1.35 * tuck, 0.25 * tuck, -0.55 * tuck, 0.1)
    o.r('footL', 0.35 * tuck)
    o.r('footR', -0.25)
    o.r('upperArmL', -0.6 * tuck, 0, -0.55 - 0.4 * tuck)
    o.r('foreArmL', 0.6)
    o.r('upperArmR', 1.2 * tuck, 0, 0.45 + 0.3 * tuck)
    o.r('foreArmR', 0.7)
    o.r('spine', -0.12 * tuck)
    o.r('head', -0.1)
    o.buf.roll = s.bank * 0.4
  },
  roll(o, s) {
    const k = min(1, s.clipTime / 0.72)
    const e = k * k * (3 - 2 * k)
    o.buf.pitch = -TAU * e
    o.buf.lift = -0.42 * sin(k * PI)
    const t = sin(k * PI)
    legs(o, 1.7 * t, -2.1 * t, 1.6 * t, -2.0 * t, 0.12)
    arms(o, 1.0 * t, 0.35, 1.7 * t)
    o.r('spine', -0.5 * t)
    o.r('head', 0.6 * t)
  },
  skid(o, s) {
    o.r('spine', 0.22, 0, s.bank * 0.4)
    o.r('chest', 0.08)
    legs(o, 0.65, -0.15, -0.35, -0.75, 0.16)
    o.r('footL', -0.35)
    arms(o, 0.35, 1.0, 0.5)
    o.r('head', -0.15)
    o.buf.hipsY = -0.12
    o.buf.roll = s.bank * 0.5
  },
  'land-hard'(o, s) {
    const k = min(1, s.clipTime / 0.9)
    const d = k < 0.2 ? k / 0.2 : 1 - ((k - 0.2) / 0.8) ** 2
    legs(o, 1.35 * d, -2.2 * d, 1.1 * d, -1.9 * d, 0.18)
    o.r('footL', -0.8 * d)
    o.r('footR', -0.7 * d)
    o.r('spine', -0.55 * d)
    o.r('head', 0.35 * d)
    arms(o, 0.95 * d, 0.55 * d, 0.9)
    o.r('handL', -0.9 * d)
    o.r('handR', -0.9 * d)
    o.buf.hipsY = -0.45 * d
  },
  zip(o, s) {
    const legSwing = sin(s.t * 2.6) * 0.18 + s.swing * 0.8
    o.r('upperArmR', 0.12, 0, 2.92)
    o.r('foreArmR', 0.15)
    o.r('handR', 0.3)
    o.r('upperArmL', 0.2, 0, -2.78)
    o.r('foreArmL', 0.35)
    legs(o, 0.35 + legSwing, -0.55 - max(0, legSwing) * 0.4, 0.15 + legSwing * 0.7, -0.35, 0.1)
    o.r('footL', -0.5)
    o.r('footR', -0.6)
    o.r('spine', -0.05 - s.swing * 0.2)
    o.r('head', 0.05, sin(s.t * 0.7) * 0.2, 0)
    o.buf.lift = 0
  },
  slide(o, s) {
    sitPose(o, 1)
    const w = sin(s.t * 5)
    o.r('spine', 0.32, 0, -s.bank * 0.5)
    o.r('chest', 0.05, 0, -s.bank * 0.3)
    o.r('upperArmL', 0.4, 0, -1.15 - w * 0.12)
    o.r('foreArmL', 0.35)
    o.r('upperArmR', 0.4, 0, 1.15 + w * 0.12)
    o.r('foreArmR', 0.35)
    legs(o, 1.2, -0.35, 1.25, -0.3, 0.14)
    o.r('head', -0.2, 0, s.bank * 0.4)
    o.buf.hipsY = -0.5
  },
  'tube-in'(o, s) {
    const k = min(1, s.clipTime / 0.6)
    arms(o, 2.7 * k, 0.15, 0.1)
    o.r('spine', -0.7 * k)
    legs(o, 0.6 * k, -1.0 * k, 0.4 * k, -0.6 * k, 0.08)
    o.buf.pitch = -0.6 * k * k
    o.buf.hipsY = -0.2 * sin(k * PI)
  },
  'tube-out'(o, s) {
    const k = min(1, s.clipTime / 0.7)
    const d = 1 - k
    legs(o, 0.9 * d, -1.4 * d, 0.6 * d, -0.9 * d, 0.14)
    arms(o, 0.4 * d, 0.6 * d + 0.1, 0.5)
    o.r('spine', -0.4 * d)
    o.r('head', 0.2 * d, sin(s.t * 9) * 0.15 * d, 0)
    o.buf.hipsY = -0.3 * d
  },
  'carry-idle'(o, s) {
    CLIPS['idle-dry'](o, s)
    carryArms(o)
  },
  'carry-walk'(o, s) {
    gait(o, s, { stride: 0.34, knee: 0.6, arm: 0, lean: -0.04, bounce: 0.04, floaty: 0 })
    carryArms(o)
  },
  'clip-ring'(o, s) {
    const k = min(1, s.clipTime / 0.8)
    const reach = sin(k * PI)
    CLIPS[s.inWater ? 'idle' : 'idle-dry'](o, s)
    o.r('upperArmR', 1.1 + reach * 0.6, 0, 0.2)
    o.r('foreArmR', 0.25 + (1 - reach) * 0.8)
    o.r('handR', -0.4 * reach)
    o.r('head', 0.3 * reach)
  },
  'hand-on-glass'(o, s) {
    breathe(o, s, 0.6)
    o.r('upperArmR', 1.42, 0, 0.12)
    o.r('foreArmR', 0.08)
    o.r('handR', -1.35)
    arms(o, 0.06, 0.1, 0.2, 'L')
    legs(o, 0.04, -0.06, -0.06, -0.04, 0.08)
    o.r('spine', -0.04)
    o.r('head', -0.12 + sin(s.t * 0.4) * 0.03, 0.08, 0.05)
  },
  'turn-valve'(o, s) {
    CLIPS['open-hatch'](o, s)
    o.r('spine', -0.18, sin(s.t * 3) * 0.1, 0)
  },
  pump(o, s) {
    const w = sin(s.t * 4.2)
    arms(o, 0.95 + w * 0.45, 0.2, 0.7 - w * 0.4)
    o.r('spine', -0.25 - max(0, -w) * 0.25)
    legs(o, 0.35, -0.5 - max(0, -w) * 0.3, -0.1, -0.2, 0.16)
    o.buf.hipsY = -0.08 - max(0, -w) * 0.08
    o.r('head', 0.1)
  },
  'ladder-slide'(o, s) {
    o.r('upperArmL', 2.25, 0, -0.32)
    o.r('foreArmL', 0.7)
    o.r('upperArmR', 2.25, 0, 0.32)
    o.r('foreArmR', 0.7)
    legs(o, 0.45, -0.25, 0.4, -0.3, 0.32)
    o.r('footL', -0.4)
    o.r('footR', -0.4)
    o.r('head', -0.35, sin(s.t * 11) * 0.04, 0)
  },
  'climb-slip'(o, s) {
    CLIPS['climb-idle'](o, s)
    const j = sin(s.t * 23) * 0.12
    o.r('upperArmL', 2.7 + j, 0, -0.5)
    o.r('upperArmR', 2.7 - j, 0, 0.5)
    legs(o, 0.3 + j, -0.5, 0.2 - j, -0.4, 0.3)
    o.r('head', 0.55)
  },
}

function carryArms(o: PoseOut): void {
  o.r('upperArmL', 1.05, 0, -0.32)
  o.r('foreArmL', 0.95, 0, 0)
  o.r('handL', 0, 0.6, 0)
  o.r('upperArmR', 1.05, 0, 0.32)
  o.r('foreArmR', 0.95)
  o.r('handR', 0, -0.6, 0)
  o.r('chest', -0.06)
}

function sitPose(o: PoseOut, k: number): void {
  legs(o, 1.5 * k, -1.5 * k, 1.45 * k, -1.45 * k, 0.1)
  o.r('footL', 0.1 * k)
  o.r('footR', 0.1 * k)
  o.r('spine', 0.05 * k)
  arms(o, 0.5 * k, 0.12, 0.9 * k)
  o.buf.hipsY = -0.47 * k
}

function lyingPose(o: PoseOut, s: AnimParams, k: number): void {
  o.buf.pitch = (PI / 2) * k
  o.buf.lift = -0.42 * k
  o.r('upperArmR', 0.6 * k, 0, 0.1)
  o.r('foreArmR', 1.5 * k)
  o.r('upperArmL', 0.05, 0, -0.25 * k)
  legs(o, 0.15 * k, -0.25 * k, 0.05, -0.1 * k, 0.1)
  o.r('head', 0.15 * k, -0.35 * k, 0)
  o.r('chest', sin(s.t * 0.9) * 0.03 * k)
}

export class Animator {
  private from = new PoseBuf()
  private cur = new PoseBuf()
  private out = new PoseBuf()
  private writer = new PoseOut()
  private clip: ClipId = 'idle-dry'
  private clipStart = 0
  private blend = 1
  private blendTime = 0.25
  private qWork = new THREE.Quaternion()
  private headEuler = new THREE.Euler()

  constructor(private model: HeroModel) {
    this.writer.reset(this.out)
    this.writer.finish()
  }

  get current(): ClipId {
    return this.clip
  }

  timeIn(t: number): number {
    return t - this.clipStart
  }

  play(id: ClipId, t: number, fade = 0.22): void {
    if (id === this.clip) return
    this.from.copy(this.out)
    this.clip = id
    this.clipStart = t
    this.blend = fade <= 0 ? 1 : 0
    this.blendTime = fade
  }

  update(dt: number, s: AnimParams, headLook?: (e: THREE.Euler) => void): void {
    s.clipTime = s.t - this.clipStart
    this.writer.reset(this.cur)
    CLIPS[this.clip](this.writer, s)
    this.writer.finish()
    this.blend = min(1, this.blend + dt / max(this.blendTime, 1e-3))
    const k = this.blend * this.blend * (3 - 2 * this.blend)
    const q = this.out.q
    for (let i = 0; i < NB; i++) {
      qa.fromArray(this.from.q, i * 4)
      qb.fromArray(this.cur.q, i * 4)
      qa.slerp(qb, k)
      qa.toArray(q, i * 4)
    }
    const lerp = THREE.MathUtils.lerp
    this.out.pitch = lerp(this.from.pitch, this.cur.pitch, k)
    this.out.roll = lerp(this.from.roll, this.cur.roll, k)
    this.out.twist = lerp(this.from.twist, this.cur.twist, k)
    this.out.lift = lerp(this.from.lift, this.cur.lift, k)
    this.out.hipsY = lerp(this.from.hipsY, this.cur.hipsY, k)

    const m = this.model
    BONES.forEach((name, i) => m.pose[name].quaternion.fromArray(q, i * 4))
    m.pose.hips.position.y = m.rest.hips.y + this.out.hipsY
    m.pivot.rotation.set(this.out.pitch, this.out.twist, this.out.roll, 'XYZ')
    m.pivot.position.y = m.pivotHeight + this.out.lift
    if (headLook) {
      this.headEuler.set(0, 0, 0)
      headLook(this.headEuler)
      this.qWork.setFromEuler(this.headEuler)
      m.pose.head.quaternion.premultiply(this.qWork)
    }
    m.rig.update(dt, this.clip, this.blendTime, s.speed, this.out.hipsY)
  }
}
