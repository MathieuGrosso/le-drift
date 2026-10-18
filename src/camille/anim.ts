import * as THREE from 'three'
import type { CamilleModel, Joint } from './model'

export type Pose =
  | 'idle' | 'walk' | 'prune' | 'look-up' | 'sit' | 'sit-look-up' | 'eat' | 'shy' | 'talk'
  | 'breathe-glass' | 'draw' | 'hand-on-glass' | 'wave' | 'laugh' | 'pockets' | 'sip' | 'look-hand'

type Rot = [number, number, number]
type Target = Partial<Record<Joint, Rot>> & { lift?: number; lean?: number }

const { sin, cos, abs } = Math
const e = new THREE.Euler()
const q = new THREE.Quaternion()

function frame(pose: Pose, t: number, speed: number): Target {
  const breath = sin(t * 1.7) * 0.025
  const sway = sin(t * 0.6) * 0.04
  const locks = (k: number): Pick<Target, 'lockL' | 'lockR'> => ({
    lockL: [sin(t * 1.3) * 0.03 * k, 0, sin(t * 0.9) * 0.03 * k],
    lockR: [sin(t * 1.3 + 0.7) * 0.05 * k, 0, sin(t * 0.9 + 0.4) * 0.05 * k],
  })
  switch (pose) {
    case 'walk': {
      const p = t * 7.5 * Math.max(0.6, speed)
      return {
        ...locks(2.5),
        lift: abs(sin(p)) * 0.035,
        hips: [0, sin(p) * 0.08, 0],
        chest: [-0.06, -sin(p) * 0.12, 0],
        head: [0.04, sin(p) * 0.05, 0],
        legL: [sin(p) * 0.55, 0, 0], shinL: [-Math.max(0, -cos(p)) * 0.7, 0, 0],
        legR: [-sin(p) * 0.55, 0, 0], shinR: [-Math.max(0, cos(p)) * 0.7, 0, 0],
        armL: [-sin(p) * 0.45, 0, -0.08], foreL: [0.25, 0, 0],
        armR: [sin(p) * 0.45, 0, 0.08], foreR: [0.25, 0, 0],
      }
    }
    case 'prune': {
      const snip = Math.max(0, sin(t * 6)) * 0.35
      const pause = sin(t * 0.45) > 0.6
      return {
        ...locks(1),
        lean: 0.18,
        chest: [-0.28 + breath, sway, 0],
        head: [-0.3, pause ? 0.4 : sin(t * 0.8) * 0.15, pause ? 0.15 : 0],
        armR: [1.0, 0, 0.15], foreR: [0.7 + (pause ? 0 : snip), 0, -0.2],
        armL: [0.85, 0, -0.2], foreL: [0.6, 0, 0.3],
        legL: [0.1, 0, 0], legR: [-0.05, 0, 0], shinL: [-0.15, 0, 0],
      }
    }
    case 'look-up':
      return {
        ...locks(0.7),
        hips: [0, sway * 0.5, 0],
        chest: [0.12 + breath, 0, sway * 0.4],
        head: [0.62 + sin(t * 0.35) * 0.08, sin(t * 0.22) * 0.35, 0],
        armL: [-0.35, 0, -0.12], foreL: [0.4, 0, 0.6],
        armR: [-0.35, 0, 0.12], foreR: [0.4, 0, -0.6],
      }
    case 'sit':
    case 'sit-look-up': {
      const up = pose === 'sit-look-up'
      return {
        ...locks(0.6),
        lift: -0.4,
        chest: [(up ? 0.1 : -0.05) + breath, 0, 0],
        head: [up ? 0.55 + sin(t * 0.3) * 0.06 : -0.05 + sin(t * 0.5) * 0.05, sin(t * 0.2) * 0.2, 0],
        legL: [1.5, 0, -0.04], shinL: [-1.45 + sin(t * 1.4) * 0.12, 0, 0],
        legR: [1.5, 0, 0.04], shinR: [-1.45 + sin(t * 1.4 + 1.6) * 0.12, 0, 0],
        armL: [0.25, 0, -0.1], foreL: [0.9, 0, 0.3],
        armR: [0.25, 0, 0.1], foreR: [0.9, 0, -0.3],
      }
    }
    case 'eat': {
      const spoon = Math.max(0, sin(t * 1.6))
      return {
        ...locks(0.8),
        chest: [breath, sway, 0],
        head: [-0.1 + spoon * 0.08, sin(t * 0.4) * 0.2, 0],
        armL: [0.6, 0, -0.1], foreL: [0.9, 0, 0.5],
        armR: [0.5 + spoon * 0.5, 0, 0.1], foreR: [1.1 + spoon * 0.6, 0, -0.4],
      }
    }
    case 'shy':
      return {
        ...locks(1),
        hips: [0, sin(t * 2) * 0.12, 0],
        chest: [-0.08 + breath, 0, 0],
        head: [-0.28, sin(t * 0.9) * 0.18, sin(t * 2) * 0.05],
        armL: [0.45, 0, 0.25], foreL: [0.9, 0, 0.55],
        armR: [0.45, 0, -0.25], foreR: [0.9, 0, -0.55],
        legL: [0, 0, 0], legR: [sin(t * 2) * 0.12, 0, 0], shinR: [-0.2, 0, 0],
      }
    case 'talk':
      return {
        ...locks(1.2),
        chest: [breath, sin(t * 0.8) * 0.1, 0],
        head: [0.05 + sin(t * 2.4) * 0.05, sin(t * 0.7) * 0.15, sin(t * 1.1) * 0.06],
        armR: [0.35 + sin(t * 2.2) * 0.25, 0, 0.25], foreR: [0.9 + sin(t * 3.1) * 0.3, 0, -0.3],
        armL: [0.1, 0, -0.1], foreL: [0.3, 0, 0],
      }
    case 'breathe-glass':
      return {
        ...locks(0.5),
        lean: 0.12,
        chest: [-0.2, 0, 0],
        head: [-0.05 + sin(t * 3) * 0.04, 0, 0],
        armL: [1.2, 0, -0.1], foreL: [0.4, 0, 0],
        armR: [0.4, 0, 0.1], foreR: [0.5, 0, 0],
      }
    case 'draw':
      return {
        ...locks(0.8),
        lean: 0.06,
        chest: [-0.06, sin(t * 1.5) * 0.06, 0],
        head: [0, sin(t * 1.5) * 0.12, sin(t * 1.1) * 0.08],
        armR: [1.45 + sin(t * 5) * 0.18, 0, 0.12 + cos(t * 5) * 0.2], foreR: [0.25, 0, -0.1],
        armL: [0.2, 0, -0.1], foreL: [0.5, 0, 0.3],
      }
    case 'hand-on-glass':
      return {
        ...locks(0.4),
        chest: [0.05 + breath, 0, 0],
        head: [0.25 + sin(t * 0.4) * 0.05, 0.08, 0],
        armR: [1.6, 0, 0.05], foreR: [0.1, 0, 0],
        armL: [0.3, 0, -0.15], foreL: [0.6, 0, 0.4],
      }
    case 'wave':
      return {
        ...locks(1.4),
        chest: [breath, 0, -0.05],
        head: [0.08, 0, 0.1],
        armR: [0.2, 0, 2.5], foreR: [0, 0, 0.35 * sin(t * 9)],
        armL: [0.05, 0, -0.1],
      }
    case 'laugh':
      return {
        ...locks(2),
        lift: abs(sin(t * 8)) * 0.02,
        chest: [-0.2 + abs(sin(t * 8)) * 0.08, 0, 0],
        head: [0.15 + abs(sin(t * 8)) * 0.08, 0, 0.05],
        armL: [0.6, 0, 0.2], foreL: [1.2, 0, 0.6],
        armR: [0.6, 0, -0.2], foreR: [1.2, 0, -0.6],
      }
    case 'pockets':
      return {
        ...locks(0.8),
        hips: [0, sway * 0.4, sway * 0.5],
        chest: [breath, sway * 0.4, -sway * 0.3],
        head: [sin(t * 0.45) * 0.05, sin(t * 0.23) * 0.35, 0.06 + sin(t * 0.3) * 0.04],
        armL: [0.22, 0, -0.16], foreL: [0.45, 0, 0.25],
        armR: [0.22, 0, 0.16], foreR: [0.45, 0, -0.25],
        legL: [0, 0, -0.02], legR: [0.04, 0, 0.03], shinR: [-0.08, 0, 0],
      }
    case 'sip': {
      const up = Math.max(0, sin(t * 0.7)) ** 2
      return {
        ...locks(0.7),
        chest: [breath, sway * 0.4, 0],
        head: [-0.05 - up * 0.12, sin(t * 0.3) * 0.25 * (1 - up), 0.04],
        armR: [0.35 + up * 0.35, 0, 0.12 + up * 0.08], foreR: [1.3 + up * 0.75, 0, -0.25 - up * 0.3],
        armL: [0.22, 0, -0.16], foreL: [0.45, 0, 0.25],
      }
    }
    case 'look-hand':
      return {
        ...locks(0.6),
        chest: [-0.06 + breath, 0, 0],
        head: [-0.38, 0.05, 0.12 + sin(t * 0.6) * 0.06],
        armL: [0.55, 0, 0.18], foreL: [1.25, 0, 0.45 + sin(t * 0.9) * 0.08],
        armR: [0.22, 0, 0.16], foreR: [0.45, 0, -0.25],
      }
    case 'idle':
    default: {
      const fidget = sin(t * 0.31) > 0.75
      return {
        ...locks(1),
        hips: [0, 0, sway * 0.6],
        chest: [breath, sway * 0.5, -sway * 0.4],
        head: [sin(t * 0.5) * 0.06, sin(t * 0.27) * 0.4, sin(t * 0.4) * 0.05],
        armL: [0.05, 0, -0.08], foreL: [0.15, 0, 0],
        armR: fidget ? [0.9, 0, -0.35] : [0.05, 0, 0.08],
        foreR: fidget ? [1.9, 0, -0.2] : [0.15, 0, 0],
        legL: [0, 0, -0.02], legR: [0, 0, 0.02],
      }
    }
  }
}

const JOINTS: Joint[] = ['hips', 'chest', 'head', 'lockL', 'lockR', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR']

export class Animator {
  pose: Pose = 'idle'
  speed = 0
  private t = Math.random() * 10

  constructor(private readonly m: CamilleModel) {}

  update(dt: number): void {
    this.t += dt
    const target = frame(this.pose, this.t, this.speed)
    const k = 1 - Math.exp(-dt * 9)
    for (const name of JOINTS) {
      const r = target[name] ?? [0, 0, 0]
      q.setFromEuler(e.set(r[0], r[1], r[2], 'XYZ'))
      this.m.joints[name].quaternion.slerp(q, k)
    }
    const hips = this.m.joints.hips
    hips.position.y += (this.m.hipsY + (target.lift ?? 0) - hips.position.y) * k
    hips.position.z += (-(target.lean ?? 0) * 0.3 - hips.position.z) * k
    const pulse = 0.4 + 0.08 * sin(this.t * 2.3) + 0.04 * sin(this.t * 7.1)
    this.m.glow.scale.setScalar(pulse)
  }
}
