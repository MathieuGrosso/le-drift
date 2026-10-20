import * as THREE from 'three'
import { GRADE, type GradeMood, type GradeMoodId } from '../core/tuning'
import type { DistrictId } from '../core/types'

export const MOOD_IDS = Object.keys(GRADE.moods) as GradeMoodId[]
export const LUT_SLOTS = 4

const DISTRICT_MOOD: Partial<Record<DistrictId, GradeMoodId>> = {
  serres: 'serres',
  machines: 'machines',
  scellees: 'scellees',
}

// The atlas is indexed by sqrt(colour) so the shadows get most of the grid.
export const LUT_GLSL = /* glsl */ `
uniform sampler2D tLut;
uniform vec4 uLutMood;
uniform vec4 uLutWeight;
const float LUT_N = ${GRADE.lutSize}.0;
const float LUT_M = ${MOOD_IDS.length}.0;
vec3 lutSlot(float mood, vec3 e) {
  vec3 s = e * (LUT_N - 1.0);
  float b0 = floor(s.b);
  float b1 = min(b0 + 1.0, LUT_N - 1.0);
  float v = (mood * LUT_N + s.g + 0.5) / (LUT_N * LUT_M);
  vec3 c0 = texture2D(tLut, vec2((b0 * LUT_N + s.r + 0.5) / (LUT_N * LUT_N), v)).rgb;
  vec3 c1 = texture2D(tLut, vec2((b1 * LUT_N + s.r + 0.5) / (LUT_N * LUT_N), v)).rgb;
  return mix(c0, c1, s.b - b0);
}
vec3 applyLut(vec3 col) {
  vec3 e = sqrt(clamp(col, 0.0, 1.0));
  vec3 acc = lutSlot(uLutMood.x, e) * uLutWeight.x;
  if (uLutWeight.y > 0.0) acc += lutSlot(uLutMood.y, e) * uLutWeight.y;
  if (uLutWeight.z > 0.0) acc += lutSlot(uLutMood.z, e) * uLutWeight.z;
  if (uLutWeight.w > 0.0) acc += lutSlot(uLutMood.w, e) * uLutWeight.w;
  return acc;
}
`

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function normalizedTint(hex: number): THREE.Color {
  const c = new THREE.Color(hex)
  return c.multiplyScalar(1 / Math.max(1e-4, luma(c.r, c.g, c.b)))
}

function gradeFn(m: GradeMood): (rgb: [number, number, number]) => void {
  const shadow = normalizedTint(m.shadowTint)
  const high = normalizedTint(m.highTint)
  const toe = new THREE.Color(m.toe)
  const pivot = 0.22
  return (c) => {
    let l = luma(c[0], c[1], c[2])
    const ws = (1 - smooth(0, 0.3, l)) * m.shadowK
    const wh = smooth(0.45, 1.2, l) * m.highK
    c[0] *= 1 + (shadow.r - 1) * ws + (high.r - 1) * wh
    c[1] *= 1 + (shadow.g - 1) * ws + (high.g - 1) * wh
    c[2] *= 1 + (shadow.b - 1) * ws + (high.b - 1) * wh
    l = Math.max(luma(c[0], c[1], c[2]), 1e-4)
    const k = 1 + ((pivot * Math.pow(l / pivot, m.contrast)) / l - 1) * smooth(0, 0.02, l)
    l *= k
    const mid = smooth(0.03, 0.15, l) * (1 - smooth(0.45, 0.85, l))
    const sat = m.saturation - m.midDesat * mid - 0.08 * smooth(0.5, 1, l)
    const toeRgb = [toe.r, toe.g, toe.b]
    for (let i = 0; i < 3; i++) {
      const v = Math.max(0, (l + (c[i]! * k - l) * sat) * m.gain[i]!)
      const t = Math.max(toeRgb[i]!, 1e-4)
      c[i] = Math.min(1, v + t * Math.exp(-v / t))
    }
  }
}

export function createLutAtlas(): THREE.DataTexture {
  const n = GRADE.lutSize
  const w = n * n
  const h = n * MOOD_IDS.length
  const data = new Uint16Array(w * h * 4)
  const rgb: [number, number, number] = [0, 0, 0]
  MOOD_IDS.forEach((id, mi) => {
    const grade = gradeFn(GRADE.moods[id])
    for (let g = 0; g < n; g++) {
      for (let b = 0; b < n; b++) {
        for (let r = 0; r < n; r++) {
          rgb[0] = (r / (n - 1)) ** 2
          rgb[1] = (g / (n - 1)) ** 2
          rgb[2] = (b / (n - 1)) ** 2
          grade(rgb)
          const o = ((mi * n + g) * w + b * n + r) * 4
          data[o] = THREE.DataUtils.toHalfFloat(rgb[0])
          data[o + 1] = THREE.DataUtils.toHalfFloat(rgb[1])
          data[o + 2] = THREE.DataUtils.toHalfFloat(rgb[2])
          data[o + 3] = THREE.DataUtils.toHalfFloat(1)
        }
      }
    }
  })
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

export interface MoodInputs {
  indoor: number
  night: number
  warm: number
  district: DistrictId | null
}

export class MoodMixer {
  private readonly weights = new Float32Array(MOOD_IDS.length)
  private readonly target = new Float32Array(MOOD_IDS.length)
  private primed = false

  update(inp: MoodInputs, dt: number, snap: boolean, outMood: THREE.Vector4, outWeight: THREE.Vector4): void {
    const t = this.target
    t.fill(0)
    const out = 1 - inp.indoor
    const day = 1 - inp.night
    const room = (inp.district && DISTRICT_MOOD[inp.district]) || 'foyer'
    const add = (id: GradeMoodId, v: number) => {
      const i = MOOD_IDS.indexOf(id)
      t[i] = t[i]! + v
    }
    add('mer', out * day * (1 - inp.warm))
    add('merAube', out * day * inp.warm)
    add('merNuit', out * inp.night)
    add(room, inp.indoor * day)
    add('foyerNuit', inp.indoor * inp.night)
    const k = snap || !this.primed ? 1 : 1 - Math.exp(-dt * GRADE.rate)
    this.primed = true
    for (let i = 0; i < t.length; i++) this.weights[i] = this.weights[i]! + (t[i]! - this.weights[i]!) * k

    const order = MOOD_IDS.map((_, i) => i).sort((a, b) => this.weights[b]! - this.weights[a]!).slice(0, LUT_SLOTS)
    const sum = order.reduce((s, i) => s + this.weights[i]!, 0) || 1
    outMood.set(order[0]!, order[1]!, order[2]!, order[3]!)
    outWeight.set(...(order.map((i) => this.weights[i]! / sum) as [number, number, number, number]))
  }
}
