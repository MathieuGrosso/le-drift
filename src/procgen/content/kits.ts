import * as THREE from 'three'
import { GeoBuilder, UNIT } from '../../drift/builder'
import type { LandmarkKitId, Rng } from '../types'
import { COQUE_KIT, PHARE_KIT, type FarForm, type KitDef } from './landmarks'

export interface KitPalette { mur: number; bois: number; metal: number; tissu: readonly number[]; accent: number; lampe: number; glow: number }
export interface KitLamp { x: number; y: number; z: number; color: number; radius: number; power?: number }
type P3 = readonly [number, number, number]

const CONE = new THREE.CylinderGeometry(0, 1, 1, 10)
const Y = new THREE.Vector3(0, 1, 0)
const Zv = new THREE.Vector3(0, 0, 1)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

const ROUILLE = 0xc46a4a
const CORDE = 0xc9a66b
const PIERRE = 0xb8ab98
const VERT = 0x7fae6a
const SOMBRE = 0x4a3c48

// Kit-local frame: origin at the base, +z the front, y up; `frame` places, turns and scales it.
export class Kb {
  readonly lamps: KitLamp[] = []
  constructor(readonly o: GeoBuilder, readonly e: GeoBuilder, private readonly frame: THREE.Matrix4) {}

  private put(geom: THREE.BufferGeometry, local: THREE.Matrix4, color: number, lit: boolean): void {
    ;(lit ? this.e : this.o).add(geom, _m.multiplyMatrices(this.frame, local), color)
  }

  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number, ry = 0, lit = false): void {
    this.put(UNIT.box, new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromAxisAngle(Y, ry), new THREE.Vector3(sx, sy, sz)), c, lit)
  }

  cyl(x: number, y: number, z: number, r: number, h: number, c: number, axis: 'x' | 'y' | 'z' = 'y', lit = false): void {
    const q = new THREE.Quaternion()
    if (axis === 'x') q.setFromAxisAngle(Zv, Math.PI / 2)
    if (axis === 'z') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    this.put(UNIT.cyl, new THREE.Matrix4().compose(_v.set(x, y, z), q, new THREE.Vector3(r, h, r)), c, lit)
  }

  cone(x: number, y: number, z: number, r: number, h: number, c: number, lit = false): void {
    this.put(CONE, new THREE.Matrix4().compose(_v.set(x, y + h / 2, z), _q.identity(), new THREE.Vector3(r, h, r)), c, lit)
  }

  ball(x: number, y: number, z: number, r: number, c: number, lit = false, ry = r): void {
    this.put(UNIT.sphere, new THREE.Matrix4().compose(_v.set(x, y, z), _q.identity(), new THREE.Vector3(r, ry, r)), c, lit)
  }

  beam(a: P3, b: P3, t: number, c: number, lit = false): void {
    _a.set(...a)
    _b.set(...b)
    const d = _b.clone().sub(_a)
    const len = d.length()
    if (len < 1e-4) return
    _q.setFromUnitVectors(Zv, d.multiplyScalar(1 / len))
    this.put(UNIT.box, new THREE.Matrix4().compose(_a.lerp(_b, 0.5), _q, new THREE.Vector3(t, t, len)), c, lit)
  }

  ring(x: number, y: number, z: number, r: number, t: number, c: number, axis: 'x' | 'y' | 'z' = 'y', n = 16, lit = false): void {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      this.beam(this.circ(x, y, z, r, a0, axis), this.circ(x, y, z, r, a1, axis), t, c, lit)
    }
  }

  circ(x: number, y: number, z: number, r: number, a: number, axis: 'x' | 'y' | 'z'): P3 {
    const u = Math.cos(a) * r
    const v = Math.sin(a) * r
    if (axis === 'y') return [x + u, y, z + v]
    if (axis === 'x') return [x, y + u, z + v]
    return [x + u, y + v, z]
  }

  lamp(x: number, y: number, z: number, color: number, r = 0.35, radius = 9): void {
    this.ball(x, y, z, r, color, true)
    _v.set(x, y, z).applyMatrix4(this.frame)
    this.lamps.push({ x: _v.x, y: _v.y, z: _v.z, color, radius })
  }

  rail(y: number, r: number, c: number, posts = 12): void {
    this.ring(0, y + 1, 0, r, 0.08, c, 'y', posts)
    for (let i = 0; i < posts; i++) {
      const [px, , pz] = this.circ(0, 0, 0, r, (i / posts) * Math.PI * 2, 'y')
      this.box(px, y + 0.5, pz, 0.08, 1, 0.08, c)
    }
  }

  deck(y: number, r: number, c: number): void {
    this.cyl(0, y, 0, r, 0.3, c)
  }
}

type KitFn = (k: Kb, p: KitPalette, rng: Rng) => void

const pickT = (p: KitPalette, rng: Rng) => p.tissu[Math.floor(rng() * p.tissu.length)] ?? p.accent

const KIT_FNS: Readonly<Record<LandmarkKitId, KitFn>> = {
  'grande-lunette': (k, p) => {
    k.cyl(0, 2, 0, 3, 4, p.metal)
    k.cyl(0, 9, 0, 1, 10, p.bois)
    k.deck(14, 3.6, p.bois)
    k.rail(14, 3.6, p.metal)
    k.beam([0, 15.5, 1], [0, 23, -12], 1.4, p.metal)
    for (const t of [0.2, 0.5, 0.8]) k.ring(0, 15.5 + 7.5 * t, 1 - 13 * t, 0.85, 0.12, p.accent, 'z', 10)
    k.cyl(0, 15.2, 1.4, 0.3, 0.6, p.metal, 'z')
    k.lamp(2.6, 15.6, 2.6, p.lampe)
    k.lamp(-2.6, 15.6, -2.6, p.lampe)
  },
  'oeil-du-plafond': (k, p) => {
    for (let i = 0; i < 8; i++) {
      const [x, , z] = k.circ(0, 0, 0, 8.5, (i / 8) * Math.PI * 2, 'y')
      k.box(x, 6, z, 0.7, 12, 0.7, p.mur)
    }
    k.ring(0, 12, 0, 8.5, 0.6, p.metal, 'y', 16)
    for (let i = 0; i < 8; i++) k.beam(k.circ(0, 12, 0, 8.5, (i / 8) * Math.PI * 2, 'y'), [0, 21, 0], 0.25, p.metal)
    k.cyl(0, 6, 0, 1.3, 12, p.bois)
    k.deck(12, 3.4, p.bois)
    k.cyl(0, 12.6, 0, 1.6, 0.5, p.glow, 'y', true)
    k.lamp(0, 20.4, 0, p.lampe, 0.6, 14)
  },
  'lanterne-de-poupe': (k, p) => {
    k.cyl(0, 9, 0, 2.6, 18, p.mur)
    for (let y = 3; y < 18; y += 5) k.ring(0, y, 0, 2.65, 0.25, p.metal, 'y', 12)
    k.deck(18, 3.4, p.bois)
    k.rail(18, 3.4, p.metal)
    k.cyl(0, 20, 0, 1.7, 3.6, p.glow, 'y', true)
    k.lamp(0, 20, 0, p.lampe, 1.2, 24)
    k.cone(0, 21.8, 0, 2.4, 3.6, ROUILLE)
  },
  'corderie-cent-metres': (k, p) => {
    for (let z = -48; z <= 48; z += 6) {
      k.box(-2.6, 1.6, z, 0.3, 3.2, 0.3, p.bois)
      k.box(2.6, 1.6, z, 0.3, 3.2, 0.3, p.bois)
      k.box(0, 3.25, z, 5.6, 0.25, 0.3, p.bois)
      if (z % 12 === 0) k.lamp(0, 2.9, z, p.lampe, 0.3, 8)
    }
    for (const [x, y] of [[-0.8, 1.2], [0, 1.4], [0.8, 1.2]] as const) k.beam([x, y, -48], [x, y, 48], 0.09, CORDE)
    for (const z of [-49, 49]) {
      k.box(0, 1.4, z, 4, 2.8, 1.2, p.bois)
      k.ring(0, 2.2, z + Math.sign(z) * 0.8, 1.2, 0.15, p.metal, 'z', 10)
    }
  },
  'rouet-geant': (k, p) => {
    k.ring(0, 8, 0, 6, 0.45, p.bois, 'x', 20)
    for (let i = 0; i < 10; i++) k.beam([0, 8, 0], k.circ(0, 8, 0, 6, (i / 10) * Math.PI * 2, 'x'), 0.22, p.bois)
    k.cyl(0, 8, 0, 0.7, 1.4, p.metal, 'x')
    for (const z of [-2.2, 2.2]) {
      k.beam([-1.5, 0, z], [0, 8, z * 0.3], 0.4, p.bois)
      k.beam([1.5, 0, z], [0, 8, z * 0.3], 0.4, p.bois)
    }
    k.beam([0, 3, -8], [0, 3, 2], 0.3, p.bois)
    k.cyl(0, 3, -7, 0.9, 1.4, CORDE, 'z')
    k.beam([0, 14, 0], [0, 3, -7], 0.06, CORDE)
    k.lamp(1.8, 8, 0, p.lampe)
  },
  'cascade-des-lavoirs': (k, p, rng) => {
    for (const [y, r] of [[0.5, 7], [6.5, 5], [12.5, 3]] as const) {
      k.cyl(0, y, 0, r, 1, p.mur)
      k.cyl(0, y + 0.45, 0, r - 0.4, 0.2, p.glow, 'y', true)
      for (let i = 0; i < 6; i++) {
        const [x, , z] = k.circ(0, 0, 0, r - 0.8, (i / 6) * Math.PI * 2, 'y')
        if (y > 1) k.box(x, y - 3, z, 0.5, 6, 0.5, p.mur)
      }
    }
    for (const a of [0.4, 2.5, 4.6]) {
      const [x, , z] = k.circ(0, 0, 0, 1.2, a, 'y')
      k.beam([x, 13, z], [x * 0.5, 20, z * 0.5], 0.5, p.metal)
      k.ball(x * 0.5, 20.3, z * 0.5, 0.9, 0xf6efe0, true)
    }
    for (let i = 0; i < 9; i++) k.box(-6 + i * 1.5, 9.5 - (i % 2), 6.2, 1.1, 1.6, 0.05, pickT(p, rng))
    k.beam([-7, 10.6, 6.2], [7, 10.6, 6.2], 0.05, CORDE)
    k.lamp(4, 8, 4, p.lampe)
    k.lamp(-4, 2, -5, p.lampe)
  },
  'foret-de-draps': (k, p, rng) => {
    for (let ix = -2; ix <= 2; ix++) for (let iz = -1; iz <= 2; iz++) k.box(ix * 5, 7, iz * 5 - 2.5, 0.25, 14, 0.25, p.bois)
    for (let iz = -1; iz <= 2; iz++) {
      for (const y of [5, 9, 13]) {
        k.beam([-10, y, iz * 5 - 2.5], [10, y, iz * 5 - 2.5], 0.05, CORDE)
        for (let x = -9.4; x < 9.6; x += 1.4) if (rng() < 0.75) k.box(x, y - 1.3 - rng() * 0.5, iz * 5 - 2.5, 1.2, 2.4 + rng(), 0.04, pickT(p, rng))
      }
    }
    k.lamp(0, 3, 0, p.lampe, 0.4, 12)
  },
  'rideau-d-argent': (k, p, rng) => {
    for (const x of [-12, 12]) k.box(x, 9, 0, 0.6, 18, 0.6, p.bois)
    for (let y = 3; y <= 17; y += 1.6) {
      k.box(0, y, 0, 24, 0.18, 0.3, p.bois)
      for (let x = -11.3; x < 11.4; x += 0.8) if (rng() < 0.8) k.box(x, y - 0.55, 0, 0.18, 0.8, 0.06, 0xd8e4e8, rng() * 0.6)
    }
    for (let i = 0; i < 5; i++) k.lamp(-10 + i * 5, 2, 1.5, p.lampe, 0.3, 10)
  },
  'tour-aux-chats': (k, p, rng) => {
    let x = 0
    let z = 0
    for (let y = 0; y < 18; y += 3) {
      const r = (rng() - 0.5) * 0.3
      k.box(x, y + 1.5, z, 3.6 - y * 0.08, 3, 3.6 - y * 0.08, rng() < 0.5 ? p.bois : p.mur, r)
      k.box(x, y + 3.05, z, 4.6, 0.2, 4.6, p.bois, r)
      const cx = x + (rng() - 0.5) * 3.6
      const cz = z + (rng() - 0.5) * 3.6
      k.ball(cx, y + 3.4, cz, 0.25, rng() < 0.5 ? 0x3a3030 : 0xd89a5a, false, 0.18)
      k.ball(cx + 0.2, y + 3.6, cz, 0.13, 0x3a3030)
      x += (rng() - 0.5) * 0.6
      z += (rng() - 0.5) * 0.6
    }
    k.cone(x, 18.1, z, 2.6, 3.4, ROUILLE)
    k.lamp(x, 17.2, z + 2, p.lampe, 0.4, 10)
  },
  'arbre-aux-lanternes': (k, p, rng) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      k.beam([Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2], [Math.cos(a + 1) * 0.5, 11, Math.sin(a + 1) * 0.5], 0.45, i % 2 ? ROUILLE : p.metal)
    }
    k.deck(11, 2.8, p.bois)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.3
      const r = 4 + rng() * 5
      const y = 9 + rng() * 9
      const tip: P3 = [Math.cos(a) * r, y, Math.sin(a) * r]
      k.beam([0, y - 2.5, 0], tip, 0.2, p.metal)
      k.beam(tip, [tip[0], tip[1] - 1, tip[2]], 0.04, CORDE)
      const c = p.tissu[i % p.tissu.length] ?? p.lampe
      if (i % 3 === 0) k.lamp(tip[0], tip[1] - 1.4, tip[2], c, 0.45, 7)
      else k.ball(tip[0], tip[1] - 1.4, tip[2], 0.4, c, true)
    }
  },
  'coque-retournee': (k, p) => {
    k.ball(0, 0, 0, 13, p.bois, false, 11)
    k.beam([0, 11.2, -13], [0, 11.2, 13], 0.8, SOMBRE)
    for (let z = -10; z <= 10; z += 4) k.ring(0, 0, z, Math.sqrt(169 - z * z) * 0.86, 0.3, SOMBRE, 'z', 14)
    k.box(0, 2, 12.4, 3, 4, 1, SOMBRE)
    for (let i = -3; i <= 3; i++) k.ball(i * 3.2, 6, Math.sqrt(Math.max(1, 120 - i * i * 10)), 0.55, p.lampe, true)
    k.lamp(0, 4.6, 13.2, p.lampe, 0.5, 12)
  },
  'table-cent-couverts': (k, p, rng) => {
    k.box(0, 0.85, 0, 2.2, 0.12, 52, p.bois)
    for (let z = -25; z <= 25; z += 2.5) {
      k.box(0, 0.4, z, 1.8, 0.8, 0.15, p.bois)
      for (const x of [-1.7, 1.7]) k.box(x, 0.45, z, 0.5, 0.1, 2.2, p.bois)
      for (const x of [-0.6, 0.6]) k.cyl(x, 0.93, z + (rng() - 0.5), 0.22, 0.04, 0xefe3c4)
    }
    k.beam([0, 4.6, -26], [0, 4.6, 26], 0.05, CORDE)
    for (let z = -24; z <= 24; z += 6) k.lamp(0, 4, z, p.lampe, 0.35, 8)
  },
  'cheminee-tressee': (k, p) => {
    k.cyl(0, 1.5, 0, 3.4, 3, PIERRE)
    k.lamp(0, 1.4, 3.3, 0xff7a3a, 0.7, 10)
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < 28; i++) {
        const a0 = s * 2.09 + i * 0.5
        const a1 = s * 2.09 + (i + 1) * 0.5
        k.beam([Math.cos(a0) * 1.4, 3 + i * 0.9, Math.sin(a0) * 1.4], [Math.cos(a1) * 1.4, 3 + (i + 1) * 0.9, Math.sin(a1) * 1.4], 0.75, s === 1 ? 0xd98a5a : p.metal)
      }
    }
    k.deck(22, 3, p.metal)
    k.rail(22, 3, p.metal)
  },
  'marteau-pilon': (k, p) => {
    for (const x of [-3.5, 3.5]) k.box(x, 9, 0, 1.4, 18, 1.4, SOMBRE)
    k.box(0, 17.5, 0, 9, 1.6, 2, SOMBRE)
    k.cyl(0, 15, 0, 1.2, 4, p.metal)
    k.box(0, 9, 0, 3, 4, 2.4, p.metal)
    k.box(0, 0.8, 0, 4, 1.6, 3, SOMBRE)
    k.box(0, 1.7, 0, 1.6, 0.3, 1.2, 0xffb060, 0, true)
    k.lamp(0, 2.2, 2, 0xff8a3a, 0.4, 12)
    k.deck(12, 2.2, p.metal)
  },
  'fontaine-d-etincelles': (k, p, rng) => {
    for (let i = 0; i < 4; i++) k.box(Math.cos(i * 1.57) * 3, 1, Math.sin(i * 1.57) * 3, 0.5, 2, 0.5, SOMBRE)
    k.cyl(0, 2.6, 0, 4.2, 1.2, SOMBRE)
    k.cyl(0, 3.25, 0, 3.8, 0.1, 0xffa040, 'y', true)
    k.cyl(0, 5, 0, 0.6, 4, p.metal)
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2
      const t = rng()
      const r = 0.5 + t * 3.6
      k.ball(Math.cos(a) * r, 7 + Math.sin(t * Math.PI) * 2.8 - t * 3, Math.sin(a) * r, 0.08 + rng() * 0.06, 0xffd27a, true)
    }
    k.lamp(0, 7.4, 0, 0xffa040, 0.5, 14)
  },
  'mur-mille-hublots': (k, p, rng) => {
    k.box(0, 12, -0.6, 32, 24, 1.2, p.mur)
    for (let y = 1.5; y < 23; y += 2.4) {
      for (let x = -15; x <= 15; x += 2.2) {
        k.ring(x, y, 0.05, 0.55, 0.12, p.metal, 'z', 8)
        k.cyl(x, y, 0.02, 0.48, 0.05, rng() < 0.7 ? p.lampe : SOMBRE, 'z', true)
      }
      if (Math.round(y * 10) % 3 === 0) k.box(0, y - 1.15, 0.8, 32, 0.15, 1.6, p.bois)
    }
  },
  'voute-aux-hamacs': (k, p, rng) => {
    for (let z = -10; z <= 10; z += 4) {
      for (let i = 0; i < 10; i++) {
        const a0 = (i / 10) * Math.PI
        const a1 = ((i + 1) / 10) * Math.PI
        k.beam([Math.cos(a0) * 11, Math.sin(a0) * 15, z], [Math.cos(a1) * 11, Math.sin(a1) * 15, z], 0.5, p.bois)
      }
    }
    for (let i = 0; i < 12; i++) {
      const y = 4 + rng() * 9
      const z = -9 + rng() * 18
      const w = 2.5 + rng() * 3
      const x = (rng() - 0.5) * 8
      k.beam([x - w, y + 0.8, z], [x + w, y + 0.8, z], 0.04, CORDE)
      k.box(x, y, z, w * 1.4, 0.15, 1.3, pickT(p, rng), rng() * 0.2)
      if (i % 3 === 0) k.lamp(x, y + 1.6, z, p.lampe, 0.3, 8)
    }
  },
  'clocher-englouti': (k, p) => {
    k.box(0, 8, 0, 5, 16, 5, PIERRE)
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]] as const) k.box(x, 18, z, 0.7, 4, 0.7, PIERRE)
    k.box(0, 16.2, 0, 5.6, 0.4, 5.6, PIERRE)
    k.box(0, 20.2, 0, 5.6, 0.4, 5.6, PIERRE)
    k.ball(0, 18.4, 0, 1.3, 0xb08a4a, false, 1.5)
    k.cone(0, 20.4, 0, 3.4, 4, 0x4f6d7a)
    for (let y = 2; y < 15; y += 4) k.box(0, y, 2.55, 1.1, 1.8, 0.1, p.lampe, 0, true)
    k.lamp(0, 17.4, 0, p.lampe, 0.4, 12)
  },
  'rue-sous-l-eau': (k, p) => {
    for (const x of [-2.4, 2.4]) k.beam([x, 0.1, -14], [x, 0.1, 14], 0.3, p.metal)
    for (let z = -14; z <= 14; z += 3.5) {
      k.box(0, 0.1, z, 5, 0.25, 0.25, p.metal)
      k.box(0, 0.02, z + 1.75, 4.6, 0.04, 3.2, p.glow, 0, true)
    }
    for (let z = -12; z <= 12; z += 8) {
      k.box(0, -3, z + 1, 0.3, 4, 0.3, ROUILLE)
      k.lamp(0, -1, z + 1, p.lampe, 0.35, 6)
    }
  },
  'grues-a-filets': (k, p) => {
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]] as const) k.box(x, 10, z, 0.4, 20, 0.4, p.metal)
    for (let y = 2; y < 20; y += 3) k.ring(0, y, 0, 2.1, 0.15, p.metal, 'y', 4)
    k.deck(20, 2.8, p.bois)
    k.box(0, 22, 1, 3, 3, 3, p.mur)
    k.box(0, 22, 2.55, 1.6, 1, 0.1, p.lampe, 0, true)
    k.beam([0, 21, 2], [0, 22, -15], 0.8, ROUILLE)
    k.box(0, 20.4, 5, 2.4, 2.4, 2.4, SOMBRE)
    k.beam([0, 22, -14.5], [0, 8, -14.5], 0.05, CORDE)
    for (let i = 0; i < 6; i++) {
      const y = 3 + i
      k.ring(0, y, -14.5, 1.5 + Math.sin((i / 5) * Math.PI) * 1.2, 0.05, CORDE, 'y', 10)
    }
    k.ball(0, 3.8, -14.5, 1.5, 0xd8e4e8, false, 1)
    k.lamp(0, 19, -14.5, p.lampe, 0.4, 12)
  },
  'phare-de-la-baie': (k, p) => {
    for (let i = 0; i < 7; i++) k.cyl(0, 1.5 + i * 3, 0, 2.6 - i * 0.12, 3, i % 2 ? ROUILLE : 0xf1e4c8)
    k.deck(21.5, 3.4, p.metal)
    k.rail(21.5, 3.4, p.metal)
    k.cyl(0, 23.6, 0, 1.6, 3.6, p.glow, 'y', true)
    k.lamp(0, 23.6, 0, p.lampe, 1.3, 30)
    k.cone(0, 25.4, 0, 2.2, 2.6, ROUILLE)
  },
  'citerne-cathedrale': (k, p) => {
    for (let i = 0; i < 20; i++) {
      if (i === 5) continue
      const a = (i / 20) * Math.PI * 2
      const [x, , z] = k.circ(0, 0, 0, 10, a, 'y')
      k.box(x, 7, z, 3.2, 14, 0.5, p.metal, -a + Math.PI / 2)
    }
    for (const y of [1, 5, 9, 13]) k.ring(0, y, 0, 10.3, 0.3, ROUILLE, 'y', 20)
    for (let i = 0; i < 24; i++) {
      const a = i * 0.5
      const [x, , z] = k.circ(0, 0, 0, 8.6, a, 'y')
      k.box(x, i * 0.55, z, 1.6, 0.15, 1.2, p.metal, -a)
    }
    k.lamp(0, 12, 0, p.lampe, 0.6, 16)
    k.lamp(0, 2, 0, p.lampe, 0.4, 10)
  },
  'vanne-maitresse': (k, p) => {
    k.cyl(0, 3, 0, 2.4, 14, p.metal, 'x')
    k.cyl(0, 3, 0, 1.4, 6, p.metal)
    k.cyl(0, 6.4, 0, 0.5, 1.2, p.metal)
    k.ring(0, 7.5, 0, 5, 0.4, ROUILLE, 'z', 20)
    for (let i = 0; i < 6; i++) k.beam([0, 7.5, 0], k.circ(0, 7.5, 0, 5, (i / 6) * Math.PI * 2, 'z'), 0.3, ROUILLE)
    k.cyl(3, 4.5, 1.6, 0.6, 0.15, 0xefe3c4, 'z', true)
    k.lamp(-3, 6, 2, p.lampe)
  },
  'vitrail-de-quille': (k, p) => {
    k.cyl(0, 0.05, 0, 9.6, 0.1, p.glow, 'y', true)
    k.ring(0, 0.2, 0, 9.8, 0.5, PIERRE, 'y', 24)
    for (let i = 0; i < 8; i++) k.beam([0, 0.15, 0], k.circ(0, 0.15, 0, 9.6, (i / 8) * Math.PI * 2, 'y'), 0.2, SOMBRE)
    for (let i = 0; i < 12; i++) {
      const [x, , z] = k.circ(0, 0, 0, 11, (i / 12) * Math.PI * 2, 'y')
      k.box(x, 0.6, z, 0.3, 1.2, 0.3, p.bois)
      k.lamp(x, 1.35, z, 0xffc27a, 0.12, 4)
    }
  },
  'orgue-a-vapeur': (k, p) => {
    for (let i = -7; i <= 7; i++) {
      const h = 14 - Math.abs(i) * 1.3
      k.cyl(i * 1, h / 2 + 1, 0, 0.38, h, p.metal)
      k.ball(i, h + 1.4, 0, 0.5, 0xf6efe0, true, 0.3)
    }
    k.box(0, 0.5, -1, 16, 1, 1.6, p.bois)
    k.box(0, 1.4, 2, 3.6, 1.4, 1.2, p.bois)
    k.lamp(0, 2.5, 2.6, p.lampe, 0.25, 6)
    k.lamp(-6, 3, 1.2, p.lampe, 0.25, 6)
    k.lamp(6, 3, 1.2, p.lampe, 0.25, 6)
  },
  'laminaire-mere': (k, p, rng) => {
    for (let i = 0; i < 12; i++) {
      const [x, , z] = k.circ(0, 0, 0, 5, (i / 12) * Math.PI * 2, 'y')
      k.box(x, 14, z, 0.18, 28, 0.18, p.metal)
    }
    for (let y = 0.2; y <= 28; y += 4) k.ring(0, y, 0, 5, 0.18, p.metal, 'y', 12)
    let x = 0
    let z = 0
    for (let y = 0; y < 27; y += 1.5) {
      const nx = Math.sin(y * 0.35) * 1.2
      const nz = Math.cos(y * 0.27) * 1.1
      k.beam([x, y, z], [nx, y + 1.5, nz], 0.45, 0x8a7a3a)
      if (rng() < 0.8) k.box(nx + (rng() - 0.5) * 2, y + 1, nz + (rng() - 0.5) * 2, 0.9, 2.6, 0.08, VERT, rng() * 3)
      x = nx
      z = nz
    }
    k.deck(20, 1.2, p.bois)
    k.box(0, 20, 5.8, 3, 0.25, 1.6, p.bois)
    k.lamp(0, 0.6, 0, 0xb9d98a, 0.8, 16)
  },
  'serre-effondree': (k, p, rng) => {
    for (let i = 0; i < 9; i++) {
      const tilt = i > 5 ? 0.5 + rng() * 0.4 : 0
      for (let j = 0; j < 8; j++) {
        const a0 = (j / 8) * Math.PI
        const a1 = ((j + 1) / 8) * Math.PI
        const z = -12 + i * 3
        k.beam([Math.cos(a0) * 12, Math.sin(a0) * 15 * (1 - tilt * (j / 8)), z], [Math.cos(a1) * 12, Math.sin(a1) * 15 * (1 - tilt * ((j + 1) / 8)), z], 0.25, p.metal)
      }
    }
    for (let i = 0; i < 22; i++) k.ball((rng() - 0.5) * 20, rng() * 3, (rng() - 0.5) * 22, 1 + rng() * 2, rng() < 0.5 ? VERT : 0x9ccf7a)
    k.lamp(0, 6, 0, 0xb9d98a, 0.5, 14)
  },
  'mobile-des-berceaux': (k, p, rng) => {
    k.cyl(0, 11, 0, 0.35, 22, p.bois)
    for (const [y, r] of [[19, 8], [14, 6], [9.5, 4]] as const) {
      const a = rng() * Math.PI
      k.beam([Math.cos(a) * -r, y, Math.sin(a) * -r], [Math.cos(a) * r, y, Math.sin(a) * r], 0.15, p.metal)
      for (const s of [-1, 1]) {
        const tx = Math.cos(a) * r * s
        const tz = Math.sin(a) * r * s
        k.beam([tx, y, tz], [tx, y - 2.4, tz], 0.03, CORDE)
        k.ball(tx, y - 3, tz, 1.1, pickT(p, rng), false, 0.55)
        k.cone(tx + 1.1, y - 3, tz, 0.5, 0.9, p.accent)
      }
    }
    k.deck(9, 2, p.bois)
    for (let i = 0; i < 5; i++) {
      const [x, , z] = k.circ(0, 0, 0, 5, (i / 5) * Math.PI * 2, 'y')
      k.box(x, 0.5, z, 1.4, 0.7, 0.9, p.bois, i)
    }
    k.lamp(0, 21.5, 0, p.lampe, 0.6, 14)
  },
  'toboggan-spirale': (k, p) => {
    k.cyl(0, 8.5, 0, 0.9, 17, p.bois)
    k.deck(17, 2.4, p.bois)
    k.rail(17, 2.4, p.accent, 8)
    k.cone(0, 19.2, 0, 3, 2.6, p.accent)
    k.lamp(0, 18.6, 0, p.lampe, 0.4, 10)
  },
  'roue-a-eau': (k, p) => {
    k.ring(0, 7.5, 0, 7, 0.4, p.bois, 'x', 24)
    k.ring(1.6, 7.5, 0, 7, 0.4, p.bois, 'x', 24)
    for (let i = 0; i < 16; i++) {
      const [, y, z] = k.circ(0, 7.5, 0, 7, (i / 16) * Math.PI * 2, 'x')
      k.box(0.8, y, z, 1.8, 0.1, 1.2, p.bois, 0)
      if (i % 2 === 0) k.beam([0.8, 7.5, 0], [0.8, y, z], 0.2, p.bois)
    }
    k.cyl(0.8, 7.5, 0, 0.6, 4, p.metal, 'x')
    k.box(0.8, 15, -3, 2, 0.8, 8, p.bois)
    for (let i = 0; i < 4; i++) {
      k.beam([3, 2, -6 + i * 4], [3, 9, -6 + i * 4], 0.12, p.metal)
      k.cone(3, 8.4, -6 + i * 4, 0.9, 0.8, p.accent)
      k.lamp(3, 8.2, -6 + i * 4, p.lampe, 0.25, 7)
    }
  },
  'jardins-suspendus': (k, p, rng) => {
    k.cyl(0, 9, 0, 0.6, 18, p.bois)
    k.deck(12, 2.4, p.bois)
    for (const [y, r] of [[4, 9], [8, 7], [14, 5]] as const) {
      for (let i = 0; i < 8; i++) {
        const [x, , z] = k.circ(0, 0, 0, r, (i / 8) * Math.PI * 2 + y, 'y')
        k.beam([0, y + 3, 0], [x, y + 0.5, z], 0.05, p.metal)
        k.box(x, y, z, 2, 0.8, 1.2, 0xb36a4a, -Math.atan2(z, x))
        k.ball(x, y + 0.8, z, 0.9 + rng() * 0.4, VERT, false, 0.6)
        if (i % 2 === 0) k.lamp(x, y + 2.4, z, p.lampe, 0.25, 6)
      }
    }
  },
  'escalier-des-journaux': (k, p, rng) => {
    k.cyl(0, 14, 0, 1.2, 28, p.bois)
    for (let i = 0; i < 56; i++) {
      const a = i * 0.42
      const y = i * 0.45
      const [x, , z] = k.circ(0, 0, 0, 3.4, a, 'y')
      k.box(x, y, z, 2.4, 0.15, 1.1, p.bois, -a)
      const [ox, , oz] = k.circ(0, 0, 0, 5.4, a, 'y')
      k.box(ox, y + 1.2, oz, 1.6, 2.4, 0.5, SOMBRE, -a + Math.PI / 2)
      for (let b = 0; b < 3; b++) k.box(ox * 0.96, y + 0.5 + b * 0.75, oz * 0.96, 1.3, 0.55, 0.3, pickT(p, rng), -a + Math.PI / 2)
      if (i % 7 === 0) k.lamp(ox * 0.85, y + 2, oz * 0.85, 0x9fd88a, 0.22, 6)
    }
    k.deck(24.5, 2.2, p.bois)
  },
  'grand-ecran': (k, p) => {
    k.box(0, 8.5, -2, 26, 13, 0.1, 0xffe8c0, 0, true)
    k.box(0, 15.4, -2, 28, 1, 0.8, 0x7a2c34)
    for (const x of [-13.6, 13.6]) k.box(x, 7.5, -2, 1, 15, 0.8, 0x7a2c34)
    k.box(0, 1, -1, 28, 2, 2, p.bois)
    for (let x = -12; x <= 12; x += 2) k.lamp(x, 2.2, 0, p.lampe, 0.15, 5)
    for (let row = 0; row < 4; row++) k.box(0, 0.45, 6 + row * 2.2, 14 - row, 0.3, 0.6, p.bois)
  },
  'vivier-rond': (k, p, rng) => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const [x, , z] = k.circ(0, 0, 0, 10, a, 'y')
      k.box(x, 6, z, 2.7, 4, 0.3, p.glow, -a + Math.PI / 2, true)
      k.box(x * 1.06, 8.1, z * 1.06, 3, 0.25, 4, p.metal, -a + Math.PI / 2)
    }
    for (let i = 0; i < 8; i++) {
      const [x, , z] = k.circ(0, 0, 0, 10, (i / 8) * Math.PI * 2, 'y')
      k.box(x, 2, z, 0.6, 4, 0.6, p.metal)
    }
    for (let i = 0; i < 18; i++) {
      const [x, , z] = k.circ(0, 0, 0, 9.6 + rng() * 0.8, rng() * Math.PI * 2, 'y')
      k.box(x, 5 + rng() * 2, z, 0.5, 0.2, 0.15, 0xe8b45a, rng() * 3)
    }
    k.lamp(0, 3, 0, 0x9fd6d0, 0.5, 16)
  },
  'grand-volant': (k, p) => {
    k.ring(0, 13, 0, 11.5, 1.6, p.metal, 'x', 28)
    for (let i = 0; i < 6; i++) k.beam([0, 13, 0], k.circ(0, 13, 0, 11, (i / 6) * Math.PI * 2, 'x'), 0.9, SOMBRE)
    k.cyl(0, 13, 0, 1.6, 3, p.metal, 'x')
    for (const x of [-2.5, 2.5]) k.box(x, 6.5, 0, 1.2, 13, 3, SOMBRE)
    k.lamp(3.6, 4, 3, 0xff8a3a, 0.4, 12)
    k.lamp(-3.6, 4, -3, 0xff8a3a, 0.4, 12)
  },
  'orgues-de-pression': (k, p, rng) => {
    for (let i = -6; i <= 6; i++) {
      const h = 8 + rng() * 6
      k.cyl(i * 1.3, h / 2, 0, 0.5, h, i % 2 ? ROUILLE : p.metal)
      k.cyl(i * 1.3, h * 0.6, 0.55, 0.35, 0.1, 0xefe3c4, 'z', true)
    }
    k.cyl(0, 1.2, 0, 0.8, 18, p.metal, 'x')
    k.lamp(0, 3, 2, 0xff8a3a, 0.35, 10)
  },
  [PHARE_KIT]: (k, p) => {
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]] as const) k.beam([x * 1.6, 0, z * 1.6], [x, 22, z], 0.3, p.metal)
    for (let y = 3; y < 22; y += 3.5) k.ring(0, y, 0, 1.9 - y * 0.03, 0.12, p.metal, 'y', 4)
    k.deck(22, 2.6, p.bois)
    k.rail(22, 2.6, p.metal, 8)
    k.box(0, 24, 0, 1.6, 2, 1.6, 0xffe2a8, 0, true)
    k.lamp(0, 24, 0, 0xffe2a8, 0.9, 26)
    k.cone(0, 25, 0, 1.8, 1.4, ROUILLE)
    k.beam([0, 26.4, 0], [0, 29, 0], 0.08, p.metal)
    k.box(0.9, 28.4, 0, 1.6, 0.9, 0.04, p.accent)
  },
  [COQUE_KIT]: (k, p) => {
    k.ring(0, 2.2, 0, 2.2, 0.45, p.metal, 'z', 18)
    k.cyl(0, 2.2, -0.1, 2, 0.25, SOMBRE, 'z')
    k.ring(0, 2.2, 0.2, 0.9, 0.12, p.metal, 'z', 10)
    for (let i = 0; i < 4; i++) k.beam([0, 2.2, 0.2], k.circ(0, 2.2, 0.2, 0.9, (i / 4) * Math.PI * 2, 'z'), 0.1, p.metal)
    k.cyl(0, 3.6, 0.1, 0.3, 0.05, p.glow, 'z', true)
    k.lamp(0, 4.8, 0.4, p.glow, 0.2, 5)
  },
}

export function buildKit(id: LandmarkKitId, k: Kb, p: KitPalette, rng: Rng): void {
  const fn = KIT_FNS[id]
  if (!fn) throw new Error(`[procgen] no kit builder for ${id}`)
  fn(k, p, rng)
}

// A few hundred triangles that read at 300 m: form + glow crown, drawn with the silhouette.
export function buildFar(def: KitDef, k: Kb, p: KitPalette): void {
  const { h, r } = def
  const glow = def.glow ?? p.lampe
  const forms: Readonly<Record<FarForm, () => void>> = {
    tour: () => {
      k.cyl(0, h * 0.42, 0, r * 0.35, h * 0.84, p.mur)
      k.cyl(0, h * 0.86, 0, r * 0.3, h * 0.1, glow, 'y', true)
      k.cone(0, h * 0.9, 0, r * 0.45, h * 0.1, ROUILLE)
    },
    colonne: () => {
      k.cyl(0, h / 2, 0, r * 0.3, h, p.metal)
      k.ball(0, h, 0, r * 0.35, glow, true)
    },
    roue: () => {
      k.ring(0, h / 2, 0, h / 2, 0.8, p.bois, 'x', 12)
      k.ball(0, h / 2, 0, 0.8, glow, true)
    },
    dome: () => {
      k.ball(0, 0, 0, r, p.mur, false, h * 0.8)
      k.ball(0, h * 0.8, 0, r * 0.2, glow, true)
    },
    arbre: () => {
      k.cyl(0, h * 0.3, 0, 0.8, h * 0.6, p.metal)
      k.ball(0, h * 0.7, 0, r * 0.8, glow, true, h * 0.3)
    },
    mur: () => k.box(0, h / 2, 0, r * 2, h, 1, glow, 0, true),
    nef: () => k.box(0, h / 2, 0, 4, h, r * 2, glow, 0, true),
    cuve: () => {
      k.cyl(0, h / 2, 0, r, h, p.metal)
      k.cyl(0, h + 0.1, 0, r * 0.9, 0.2, glow, 'y', true)
    },
    ecran: () => k.box(0, h / 2, 0, r * 2, h, 0.4, glow, 0, true),
  }
  forms[def.form]()
}
