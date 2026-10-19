import * as THREE from 'three'
import type { Mats } from '../materials'
import { surfacePatch } from '../surface'

export interface BakeLamp { x: number; y: number; z: number; color: THREE.Color; radius: number; power: number }
export interface SkyBake { y0: number; y1: number; color: THREE.Color; power: number }

export const CITY_UNIFORMS = {
  uCitySky: { value: 1 },
  uCityLamp: { value: 1 },
}

const VERT_DECL = 'attribute vec3 aGlow;\nattribute float aSky;\nvarying vec3 vGlow;\nvarying float vSky;\n'
const FRAG_DECL = 'uniform float uCitySky;\nuniform float uCityLamp;\nvarying vec3 vGlow;\nvarying float vSky;\n'
const CEL_CALL = 'outgoingLight = rd_cel(outgoingLight, rdN, rdV, vRdW);'
// Baked light is a floor, never added on top of the live lamps: max() keeps near lamps from blowing out.
const GLOW_CALL = /* glsl */ `
vec3 rdAlb = outgoingLight;
vec3 rdLit = rd_cel(rdAlb, rdN, rdV, vRdW);
float rdGh;
vec3 rdBaked = rdAlb * (vGlow * uCityLamp + vec3(0.62, 0.86, 0.9) * vSky * uCitySky);
vec3 rdGlow = rd_applyIndoorHaze(rdBaked, vRdW, rdGh);
outgoingLight = max(rdLit, rdGlow);`

function onShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  surfacePatch(shader)
  shader.uniforms.uCitySky = CITY_UNIFORMS.uCitySky
  shader.uniforms.uCityLamp = CITY_UNIFORMS.uCityLamp
  shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvGlow = aGlow;\nvSky = aSky;')
  if (shader.fragmentShader.includes(CEL_CALL)) {
    shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace(CEL_CALL, GLOW_CALL)
  }
}

export function glowMaterial(mats: Mats, opts: { side?: THREE.Side; rim?: number; patch?: (shader: THREE.WebGLProgramParametersWithUniforms) => void } = {}): THREE.Material {
  return mats.cel({
    color: 0xffffff,
    vertexColors: true,
    indoor: true,
    rim: opts.rim ?? 0.35,
    shadowColor: 0x6a5a7a,
    ...(opts.side !== undefined ? { side: opts.side } : {}),
    onShader: opts.patch
      ? (shader) => {
          onShader(shader)
          opts.patch!(shader)
        }
      : onShader,
  })
}

const _n = new THREE.Vector3()
const _l = new THREE.Vector3()

export function lightAt(
  x: number, y: number, z: number, nx: number, ny: number, nz: number,
  lamps: readonly BakeLamp[], base: THREE.Color, out: THREE.Color,
): THREE.Color {
  out.copy(base)
  for (const l of lamps) {
    const dx = l.x - x
    const dy = l.y - y
    const dz = l.z - z
    const d2 = dx * dx + dy * dy + dz * dz
    const r2 = l.radius * l.radius
    if (d2 >= r2) continue
    const d = Math.sqrt(d2)
    const a = 1 - d / l.radius
    const facing = d > 1e-3 ? Math.max(0, (nx * dx + ny * dy + nz * dz) / d) * 0.65 + 0.35 : 1
    const k = a * a * l.power * facing
    out.r += l.color.r * k
    out.g += l.color.g * k
    out.b += l.color.b * k
  }
  const m = Math.max(out.r, out.g, out.b)
  if (m > 1.5) out.multiplyScalar(1.5 / m)
  return out
}

export function skyAt(y: number, ny: number, sky: SkyBake | null): number {
  if (!sky) return 0
  const t = THREE.MathUtils.smoothstep(y, sky.y0, sky.y1)
  return t * sky.power * (0.55 + 0.45 * Math.max(0, ny))
}

export function bakeGlow(geo: THREE.BufferGeometry, near: (x: number, y: number, z: number) => readonly BakeLamp[], base: THREE.Color, sky: SkyBake | null): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute
  const n = pos.count
  const glow = new Float32Array(n * 3)
  const skyA = new Float32Array(n)
  const c = new THREE.Color()
  for (let i = 0; i < n; i++) {
    _l.fromBufferAttribute(pos, i)
    _n.fromBufferAttribute(nor, i)
    lightAt(_l.x, _l.y, _l.z, _n.x, _n.y, _n.z, near(_l.x, _l.y, _l.z), base, c)
    glow[i * 3] = c.r
    glow[i * 3 + 1] = c.g
    glow[i * 3 + 2] = c.b
    skyA[i] = skyAt(_l.y, _n.y, sky)
  }
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 3))
  geo.setAttribute('aSky', new THREE.BufferAttribute(skyA, 1))
}

export function instanceGlow(geo: THREE.BufferGeometry, glow: Float32Array, sky: Float32Array): void {
  geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glow, 3))
  geo.setAttribute('aSky', new THREE.InstancedBufferAttribute(sky, 1))
}

export class LampGrid {
  private readonly cells = new Map<string, BakeLamp[]>()
  private static readonly S = 16

  constructor(lamps: readonly BakeLamp[]) {
    for (const l of lamps) {
      const r = Math.ceil(l.radius / LampGrid.S)
      const cx = Math.floor(l.x / LampGrid.S)
      const cy = Math.floor(l.y / LampGrid.S)
      const cz = Math.floor(l.z / LampGrid.S)
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        const key = `${cx + i},${cy + j},${cz + k}`
        const list = this.cells.get(key)
        if (list) list.push(l)
        else this.cells.set(key, [l])
      }
    }
  }

  near = (x: number, y: number, z: number): readonly BakeLamp[] => {
    const S = LampGrid.S
    return this.cells.get(`${Math.floor(x / S)},${Math.floor(y / S)},${Math.floor(z / S)}`) ?? EMPTY
  }
}
const EMPTY: BakeLamp[] = []
