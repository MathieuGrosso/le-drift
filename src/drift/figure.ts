import * as THREE from 'three'
import { GeoBuilder } from './builder'
import { SURF } from './surface'

// Vertex colours multiply the instance colour: 1 keeps it, < 1 darkens it (belts, boots, pupils).
const W = (k: number, r = 1, g = 1, b = 1) => new THREE.Color(k * r, k * g, k * b)

function fresh(): GeoBuilder {
  const b = new GeoBuilder()
  b.jitter = 0
  return b
}

const SPH = new THREE.SphereGeometry(1, 7, 5)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

function blob(b: GeoBuilder, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: THREE.Color, rz = 0): void {
  _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(0, 0, rz)), new THREE.Vector3(sx, sy, sz))
  b.add(SPH, _m, c)
}

export function whiten(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = (g.getAttribute('position') as THREE.BufferAttribute).count
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  return g
}

// Faces look down -z, like the hair caps that sit toward +z.
export function headGeo(r: number): THREE.BufferGeometry {
  const b = fresh()
  b.add(new THREE.SphereGeometry(r, 12, 9), new THREE.Matrix4(), W(1))
  const f = -r * 0.93
  for (const s of [-1, 1]) {
    blob(b, s * r * 0.36, r * 0.06, f, r * 0.1, r * 0.15, r * 0.08, W(0.12, 1, 0.9, 1.1))
    blob(b, s * r * 0.33, r * 0.11, f - r * 0.03, r * 0.035, r * 0.035, r * 0.02, W(4.5))
    blob(b, s * r * 0.38, r * 0.33, f + r * 0.08, r * 0.17, r * 0.035, r * 0.06, W(0.3, 1, 0.85, 0.9), s * -0.18)
    blob(b, s * r * 0.55, -r * 0.2, f + r * 0.2, r * 0.17, r * 0.11, r * 0.06, W(1.06, 1.08, 0.86, 0.84))
    blob(b, s * r * 0.98, -r * 0.02, 0, r * 0.14, r * 0.22, r * 0.12, W(0.93))
  }
  blob(b, 0, -r * 0.12, f - r * 0.04, r * 0.13, r * 0.11, r * 0.12, W(0.96, 1.04, 0.9, 0.88))
  blob(b, 0, -r * 0.42, f + r * 0.06, r * 0.16, r * 0.03, r * 0.05, W(0.45, 1, 0.75, 0.75))
  return b.build()
}

export function hairGeo(r: number, back: number): THREE.BufferGeometry {
  const b = fresh()
  const cap = new THREE.SphereGeometry(r * 1.09, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.56)
  b.add(cap, new THREE.Matrix4().makeTranslation(0, r * 0.08, back), W(1))
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.9 + (i / 5) * Math.PI * 0.8
    blob(b, Math.cos(a) * r * 0.78, r * 0.42 + (i % 2) * r * 0.08, Math.sin(a) * r * 0.72, r * 0.32, r * 0.24, r * 0.3, W(0.92 + (i % 3) * 0.06))
  }
  blob(b, 0, r * 0.3, r * 0.9, r * 0.5, r * 0.55, r * 0.35, W(0.95))
  return b.build()
}

export function torsoGeo(r: number, h: number, y0: number, depth: number): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [0.001, 0], [1.08, 0], [1.12, 0.06], [1.0, 0.3], [0.92, 0.48], [1.0, 0.68], [0.96, 0.82], [0.62, 0.95], [0.3, 1.0], [0.001, 1.0],
  ]
  const lathe = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * r, y * h)), 14)
  const b = fresh()
  b.pat = SURF.fabric
  b.add(lathe, new THREE.Matrix4().compose(new THREE.Vector3(0, y0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, depth)), (p) => {
    const t = (p.y - y0) / h
    if (t < 0.05) return W(0.78)
    if (t > 0.41 && t < 0.48) return W(0.55, 1, 0.9, 0.85)
    if (t > 0.86) return W(1.14)
    return W(1)
  })
  blob(b, 0, y0 + h * 0.445, -r * depth * 0.93, r * 0.12, r * 0.1, r * 0.06, W(1.6, 1.1, 1, 0.75))
  for (const k of [0.6, 0.72]) blob(b, 0, y0 + h * k, -r * depth * 0.96, r * 0.05, r * 0.05, r * 0.04, W(0.6))
  return b.build()
}

export function armGeo(r: number, len: number, y0: number): THREE.BufferGeometry {
  const b = fresh()
  const cap = new THREE.CapsuleGeometry(r, len, 2, 6)
  const bottom = y0 - len / 2 - r
  b.add(cap, new THREE.Matrix4().makeTranslation(0, y0, 0), (p) => (p.y < bottom + r * 2.6 && p.y > bottom + r * 1.6 ? W(0.72) : W(1)))
  blob(b, 0, bottom - r * 0.2, -r * 0.15, r * 1.25, r * 1.4, r * 1.15, W(1.25, 1.02, 1, 0.92))
  blob(b, r * 0.9, bottom + r * 0.1, -r * 0.5, r * 0.5, r * 0.6, r * 0.5, W(1.25, 1.02, 1, 0.92))
  return b.build()
}

export function legGeo(r: number, len: number, y0: number, bootFrom: number): THREE.BufferGeometry {
  const b = fresh()
  const cap = new THREE.CapsuleGeometry(r, len, 2, 6)
  const bottom = y0 - len / 2 - r
  const boot = W(0.42, 1.05, 0.9, 0.95)
  b.add(cap, new THREE.Matrix4().makeTranslation(0, y0, 0), (p) => (p.y < bottom + bootFrom ? boot : p.y < bottom + bootFrom + r * 0.6 ? W(0.62) : W(1)))
  blob(b, 0, bottom + r * 0.45, -r * 0.65, r * 1.05, r * 0.7, r * 1.65, boot)
  return b.build()
}

const SOFT = { h: 0, s: 0, l: 0 }
export function softColor(c: THREE.Color, k = 0.72): THREE.Color {
  c.getHSL(SOFT)
  return c.setHSL(SOFT.h, SOFT.s * k, SOFT.l)
}
