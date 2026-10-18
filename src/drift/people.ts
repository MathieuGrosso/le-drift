import * as THREE from 'three'
import type { Mats } from './materials'
import { PAL } from './palette'

export type Role = 'cook' | 'engineer' | 'gardener' | 'kid' | 'elder' | 'vendor'
export const ROLES: readonly Role[] = ['cook', 'engineer', 'gardener', 'kid', 'elder', 'vendor']

// Channels pick which per-instance colour multiplies the vertex colour; 0 keeps the vertex colour as is.
const CH = { fixed: 0, cloth: 1, accent: 2, skin: 3, hair: 4, legs: 5, hand: 6 } as const
type Ch = (typeof CH)[keyof typeof CH]

export const F = {
  apron: 1, bib: 2, smock: 3, shawl: 4, vest: 5, sailor: 6, scarf: 7,
  hairShort: 11, hairBob: 12, hairBun: 13, pigtails: 14, elder: 15, beard: 16, glasses: 17,
  toque: 18, cap: 19, straw: 20, kerchief: 21, beanie: 22, moustache: 23,
} as const
const bit = (f: number) => 2 ** (f - 1)
export const mask = (...fs: number[]) => fs.reduce((m, f) => m + bit(f), 0)

// Limb codes drive the crowd rig's vertex shader (swing, sit, width, head scale).
const L = { body: 0, thighL: 1, thighR: 2, armL: 3, armR: 4, head: 5, shinL: 6, shinR: 7 } as const

export const RIG = { hip: 0.8, thigh: 0.38, shin: 0.4, shY: 0.47, shX: 0.215, headY: 0.76, headR: 0.16, legX: 0.095, neckY: 0.6 }

class FigB {
  pos: number[] = []
  nor: number[] = []
  col: number[] = []
  ch: number[] = []
  feat: number[] = []
  limb: number[] = []
  idx: number[] = []
  private nm = new THREE.Matrix3()

  add(g: THREE.BufferGeometry, m: THREE.Matrix4, ch: Ch, shade: THREE.ColorRepresentation, feat: number, limb: number): void {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    this.nm.getNormalMatrix(m)
    const base = this.pos.length / 3
    const c = new THREE.Color(shade)
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m)
      this.pos.push(v.x, v.y, v.z)
      v.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize()
      this.nor.push(v.x, v.y, v.z)
      this.col.push(c.r, c.g, c.b)
      this.ch.push(ch)
      this.feat.push(feat)
      this.limb.push(limb)
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(g.index.getX(i) + base)
    else for (let i = 0; i < p.count; i++) this.idx.push(i + base)
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    const fig: number[] = []
    for (let i = 0; i < this.ch.length; i++) fig.push(this.ch[i]!, this.feat[i]!, this.limb[i]!)
    g.setAttribute('aFig', new THREE.Float32BufferAttribute(fig, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

interface Detail { blob: THREE.SphereGeometry; small: THREE.SphereGeometry; head: THREE.SphereGeometry; seg: number }
const DETAIL: Record<'hi' | 'lo', Detail> = {
  hi: { blob: new THREE.SphereGeometry(1, 12, 9), small: new THREE.SphereGeometry(1, 7, 5), head: new THREE.SphereGeometry(1, 18, 14), seg: 14 },
  lo: { blob: new THREE.SphereGeometry(1, 8, 6), small: new THREE.SphereGeometry(1, 5, 3), head: new THREE.SphereGeometry(1, 11, 8), seg: 8 },
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()

// One part writer: `at` places the part in its parent frame (identity for articulated parts, rest pose for the rig).
class Part {
  constructor(readonly b: FigB, readonly at: THREE.Matrix4, readonly d: Detail, readonly limb: number, readonly feats: ReadonlySet<number> | null) {}
  on(f: number): boolean {
    return f === 0 || !this.feats || this.feats.has(f)
  }
  geo(g: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, ch: Ch, shade: THREE.ColorRepresentation, f = 0, rx = 0, ry = 0, rz = 0): void {
    if (!this.on(f)) return
    const m = new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))
    this.b.add(g, m.premultiply(this.at), ch, shade, f, this.limb)
  }
  ell(x: number, y: number, z: number, sx: number, sy: number, sz: number, ch: Ch, shade: THREE.ColorRepresentation, f = 0, rx = 0, ry = 0, rz = 0): void {
    this.geo(this.d.blob, x, y, z, sx, sy, sz, ch, shade, f, rx, ry, rz)
  }
  dot(x: number, y: number, z: number, sx: number, sy: number, sz: number, ch: Ch, shade: THREE.ColorRepresentation, f = 0, rx = 0, ry = 0, rz = 0): void {
    this.geo(this.d.small, x, y, z, sx, sy, sz, ch, shade, f, rx, ry, rz)
  }
  tube(x: number, y0: number, y1: number, z: number, r0: number, r1: number, ch: Ch, shade: THREE.ColorRepresentation, f = 0, depth = 1, open = false): void {
    if (!this.on(f)) return
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, this.d.seg, 1, open)
    this.geo(g, x, (y0 + y1) / 2, z, 1, 1, depth, ch, shade, f)
  }
  arc(y0: number, y1: number, r0: number, r1: number, depth: number, a0: number, len: number, ch: Ch, shade: THREE.ColorRepresentation, f: number, dz = 0): void {
    if (!this.on(f)) return
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, Math.max(4, Math.round(this.d.seg * len / 3)), 1, true, a0, len)
    this.geo(g, 0, (y0 + y1) / 2, dz, 1, 1, depth, ch, shade, f)
    const back = g.clone()
    const ix = back.index!
    for (let i = 0; i < ix.count; i += 3) {
      const t = ix.getX(i + 1)
      ix.setX(i + 1, ix.getX(i + 2))
      ix.setX(i + 2, t)
    }
    const nn = back.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i))
    this.geo(back, 0, (y0 + y1) / 2, dz, 0.985, 1, depth * 0.985, ch, new THREE.Color(shade).multiplyScalar(0.7), f)
  }
  lathe(prof: [number, number][], r: number, depth: number, ch: Ch, shade: THREE.ColorRepresentation, f = 0, y = 0): void {
    if (!this.on(f)) return
    const g = new THREE.LatheGeometry(prof.map(([px, py]) => new THREE.Vector2(Math.max(px * r, 0.0005), py)), this.d.seg)
    this.geo(g, 0, y, 0, 1, 1, depth, ch, shade, f)
  }
}

const W = (k: number, r = 1, g = 1, b = 1) => new THREE.Color(k * r, k * g, k * b)
const BELT = 0x4a3a3e
const BOOT = 0x4e3a36
const BRASS = 0xc9a26a
const WHITE = 0xf2ece0
const STRAW = 0xd6b878
const LEATHER = 0x6b4a3a

const DEPTH = 0.8

function torso(p: Part): void {
  const r = 0.2
  p.lathe([[0, -0.05], [0.96, -0.05], [1.06, 0.02], [1.12, 0.13], [1.04, 0.24], [0.98, 0.3], [1.02, 0.4], [0.95, 0.48], [0.72, 0.54], [0.4, 0.58], [0.0, 0.6]], r, DEPTH, CH.cloth, W(1))
  p.tube(0, 0.25, 0.31, 0, r * 1.0, r * 1.0, CH.fixed, BELT, 0, DEPTH * 1.02)
  p.ell(0, 0.28, -r * DEPTH - 0.004, 0.03, 0.026, 0.012, CH.fixed, BRASS)
  p.tube(0, 0.5, 0.66, 0, 0.065, 0.058, CH.skin, W(0.92))
  p.tube(0, 0.5, 0.56, 0, 0.11, 0.085, CH.cloth, W(0.86), 0, 0.95)
  for (const y of [0.38, 0.45]) p.dot(0, y, -r * DEPTH * 1.01, 0.012, 0.012, 0.008, CH.cloth, W(0.55))

  p.arc(-0.34, 0.44, 0.24, 0.215, DEPTH, Math.PI - 0.95, 1.9, CH.fixed, WHITE, F.apron, -0.004)
  p.tube(0, 0.27, 0.32, 0, 0.214, 0.214, CH.fixed, W(0.92, 0.95, 0.93, 0.9), F.apron, DEPTH * 1.04)
  p.geo(new THREE.BoxGeometry(1, 1, 1), 0, 0.02, -0.235, 0.14, 0.1, 0.012, CH.fixed, W(0.84, 0.95, 0.92, 0.88), F.apron)
  for (const s of [-1, 1]) p.ell(s * 0.06, 0.52, -0.06, 0.02, 0.06, 0.12, CH.fixed, WHITE, F.apron, 0.6, 0, 0)

  p.arc(0.08, 0.44, 0.215, 0.205, DEPTH, Math.PI - 0.7, 1.4, CH.legs, W(1), F.bib, -0.003)
  for (const s of [-1, 1]) {
    p.geo(new THREE.BoxGeometry(1, 1, 1), s * 0.09, 0.5, 0, 0.035, 0.012, 0.36, CH.legs, W(0.92), F.bib, 0, 0, 0)
    p.dot(s * 0.09, 0.42, -0.165, 0.016, 0.016, 0.01, CH.fixed, BRASS, F.bib)
  }
  p.geo(new THREE.BoxGeometry(1, 1, 1), 0.02, 0.27, -0.172, 0.12, 0.08, 0.01, CH.legs, W(0.8), F.bib)
  p.geo(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), 0.17, 0.12, 0.08, 1, 1, 1, CH.fixed, 0x8a8f99, F.bib, 0.2, 0, 0.3)

  p.tube(0, -0.22, 0.28, 0, 0.29, 0.2, CH.cloth, W(0.95), F.smock, DEPTH)
  p.tube(0, -0.24, -0.2, 0, 0.295, 0.29, CH.cloth, W(0.78), F.smock, DEPTH)
  p.geo(new THREE.BoxGeometry(1, 1, 1), 0, 0.3, 0, 0.035, 0.62, 0.36, CH.fixed, LEATHER, F.smock, 0, 0, 0.62)
  p.geo(new THREE.BoxGeometry(1, 1, 1), 0.23, 0.02, 0, 0.07, 0.15, 0.17, CH.fixed, 0x8a6448, F.smock)

  p.lathe([[0.62, 0.0], [1.25, -0.06], [1.42, -0.2], [1.38, -0.24], [1.15, -0.12], [0.55, 0.02]], 0.19, 0.88, CH.accent, W(1), F.shawl, 0.56)
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.55 + (i / 8) * 0.9)
    p.dot(Math.sin(a) * 0.265, 0.3, Math.cos(a) * 0.235, 0.012, 0.035, 0.012, CH.accent, W(0.85), F.shawl)
  }
  for (const y of [0.1, 0.2, 0.3]) p.dot(0, y, -0.17, 0.014, 0.014, 0.01, CH.fixed, 0xd9c9a6, F.shawl)

  for (const s of [-1, 1]) p.arc(0.18, 0.5, 0.215, 0.2, DEPTH, Math.PI + (s > 0 ? 0.12 : -1.12), 1.0, CH.accent, W(1), F.vest, -0.004)
  p.arc(0.16, 0.48, 0.225, 0.205, DEPTH, -0.9, 1.8, CH.accent, W(0.9), F.vest)
  for (let k = 0; k < 6; k++) {
    const a0 = Math.PI - 0.84 + k * 0.28
    p.arc(-0.28, 0.24, 0.245, 0.225, DEPTH, a0, 0.28, CH.fixed, k % 2 ? 0xe6d8be : 0x9a5a50, F.vest, -0.006)
  }
  p.ell(-0.19, 0.12, -0.12, 0.05, 0.065, 0.035, CH.fixed, LEATHER, F.vest)

  p.geo(new THREE.BoxGeometry(1, 1, 1), 0, 0.5, 0.12, 0.3, 0.012, 0.16, CH.accent, W(1), F.sailor, -0.35, 0, 0)
  for (const s of [-1, 1]) p.geo(new THREE.BoxGeometry(1, 1, 1), s * 0.06, 0.45, -0.15, 0.03, 0.14, 0.012, CH.accent, W(1), F.sailor, 0.3, 0, s * 0.45)
  p.dot(0, 0.39, -0.17, 0.035, 0.03, 0.02, CH.accent, W(0.85), F.sailor)

  p.geo(new THREE.TorusGeometry(0.12, 0.045, 6, p.d.seg), 0, 0.55, 0, 1, 1, 0.85, CH.accent, W(1), F.scarf, Math.PI / 2, 0, 0)
  p.geo(new THREE.BoxGeometry(1, 1, 1), 0.07, 0.42, -0.135, 0.075, 0.22, 0.03, CH.accent, W(0.88), F.scarf, -0.15, 0, 0.12)
}

function head(p: Part): void {
  const r = RIG.headR
  p.geo(p.d.head, 0, 0, 0, r, r * 0.97, r * 0.98, CH.skin, W(1))
  const fz = -r * 0.9
  for (const s of [-1, 1]) {
    p.ell(s * r * 0.36, -r * 0.02, fz - 0.006, r * 0.17, r * 0.24, r * 0.1, CH.fixed, 0x2a2233)
    p.dot(s * r * 0.36 + r * 0.06, r * 0.07, fz - r * 0.12, r * 0.05, r * 0.05, r * 0.03, CH.fixed, 0xfff6e8)
    p.ell(s * r * 0.4, r * 0.34, fz + r * 0.01, r * 0.2, r * 0.05, r * 0.07, CH.hair, W(0.85), 0, 0, 0, s * -0.15)
    p.dot(s * r * 0.56, -r * 0.3, fz + r * 0.12, r * 0.17, r * 0.1, r * 0.05, CH.skin, W(1.05, 1.08, 0.82, 0.8))
    p.ell(s * r * 0.98, -r * 0.04, 0, r * 0.16, r * 0.26, r * 0.16, CH.skin, W(0.96))
  }
  p.ell(0, -r * 0.16, fz - r * 0.1, r * 0.17, r * 0.15, r * 0.17, CH.skin, W(1.0, 1.04, 0.92, 0.9))
  p.ell(0, -r * 0.5, fz + r * 0.06, r * 0.17, r * 0.035, r * 0.05, CH.fixed, 0x7a4048)

  const cap = (f: number, ch: Ch, k: number, tilt: number, shade = W(1)) => {
    if (!p.on(f)) return
    const g = new THREE.SphereGeometry(1, p.d.seg + 2, Math.max(4, p.d.seg / 2), 0, Math.PI * 2, 0, Math.PI * 0.52)
    p.geo(g, 0, r * 0.05, r * 0.06, r * k, r * k, r * k, ch, shade, f, tilt, 0, 0)
  }
  cap(F.hairShort, CH.hair, 1.08, 0.5)
  for (let i = 0; i < 4; i++) p.ell((i - 1.5) * r * 0.32, r * 0.55, -r * 0.82, r * 0.24, r * 0.16, r * 0.14, CH.hair, W(0.94 + (i % 2) * 0.08), F.hairShort, 0.3, 0, (i - 1.5) * 0.2)
  cap(F.hairBob, CH.hair, 1.1, 0.42)
  p.ell(0, -r * 0.15, r * 0.3, r * 1.12, r * 0.95, r * 0.85, CH.hair, W(0.96), F.hairBob)
  for (let i = 0; i < 5; i++) p.ell((i - 2) * r * 0.28, r * 0.58, -r * 0.8, r * 0.22, r * 0.2, r * 0.14, CH.hair, W(0.92 + (i % 2) * 0.1), F.hairBob, 0.2, 0, 0)
  cap(F.hairBun, CH.hair, 1.07, 0.55)
  p.ell(0, r * 0.75, r * 0.8, r * 0.48, r * 0.44, r * 0.44, CH.hair, W(1.05), F.hairBun)
  p.ell(0, r * 0.6, r * 0.62, r * 0.36, r * 0.1, r * 0.3, CH.accent, W(1), F.hairBun, 0.6, 0, 0)
  cap(F.pigtails, CH.hair, 1.08, 0.48)
  for (const s of [-1, 1]) {
    p.ell(s * r * 1.05, -r * 0.35, r * 0.3, r * 0.3, r * 0.48, r * 0.3, CH.hair, W(1), F.pigtails, 0, 0, s * 0.4)
    p.dot(s * r * 0.95, -r * 0.02, r * 0.3, r * 0.14, r * 0.14, r * 0.14, CH.accent, W(1), F.pigtails)
  }
  for (const s of [-1, 1]) {
    p.ell(s * r * 0.88, r * 0.1, r * 0.25, r * 0.3, r * 0.42, r * 0.55, CH.hair, W(1), F.elder)
    p.ell(s * r * 0.42, r * 0.38, fz - r * 0.01, r * 0.26, r * 0.1, r * 0.1, CH.hair, W(1.05), F.elder, 0, 0, s * -0.25)
  }
  p.ell(0, -r * 0.05, r * 0.72, r * 0.8, r * 0.5, r * 0.38, CH.hair, W(0.98), F.elder)
  for (const s of [-1, 1]) p.ell(s * r * 0.2, -r * 0.36, fz - r * 0.08, r * 0.26, r * 0.11, r * 0.12, CH.hair, W(1.02), F.moustache, 0, 0, s * 0.3)
  p.ell(0, -r * 0.62, -r * 0.6, r * 0.62, r * 0.55, r * 0.42, CH.hair, W(1), F.beard)
  for (const s of [-1, 1]) {
    p.geo(new THREE.TorusGeometry(r * 0.25, r * 0.035, 4, 12), s * r * 0.36, -r * 0.02, fz - r * 0.16, 1, 1, 1, CH.fixed, BRASS, F.glasses)
    p.geo(new THREE.CylinderGeometry(r * 0.02, r * 0.02, r * 0.8, 4), s * r * 0.82, r * 0.02, -r * 0.45, 1, 1, 1, CH.fixed, BRASS, F.glasses, Math.PI / 2, 0, 0)
  }
  p.geo(new THREE.CylinderGeometry(r * 0.02, r * 0.02, r * 0.22, 4), 0, r * 0.02, fz - r * 0.17, 1, 1, 1, CH.fixed, BRASS, F.glasses, 0, 0, Math.PI / 2)

  p.tube(0, r * 0.45, r * 0.95, 0, r * 1.04, r * 1.1, CH.fixed, WHITE, F.toque)
  p.ell(0, r * 1.3, 0, r * 1.3, r * 0.65, r * 1.25, CH.fixed, W(0.98, 1, 0.99, 0.95), F.toque)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    p.ell(Math.sin(a) * r * 0.75, r * 1.22, Math.cos(a) * r * 0.75, r * 0.5, r * 0.45, r * 0.5, CH.fixed, WHITE, F.toque)
  }
  p.ell(0, r * 0.62, r * 0.05, r * 1.12, r * 0.55, r * 1.14, CH.accent, W(1), F.cap)
  p.ell(0, r * 0.5, -r * 0.95, r * 0.75, r * 0.1, r * 0.55, CH.accent, W(0.78), F.cap, -0.12, 0, 0)
  p.dot(0, r * 1.14, r * 0.05, r * 0.12, r * 0.08, r * 0.12, CH.accent, W(0.8), F.cap)
  p.tube(0, r * 0.38, r * 0.42, 0, r * 2.1, r * 2.0, CH.fixed, STRAW, F.straw)
  p.tube(0, r * 0.4, r * 1.05, 0, r * 1.05, r * 0.88, CH.fixed, W(1.04, 1, 0.98, 0.9).multiply(new THREE.Color(STRAW)), F.straw)
  p.tube(0, r * 0.45, r * 0.6, 0, r * 1.06, r * 1.04, CH.accent, W(1), F.straw)
  cap(F.kerchief, CH.accent, 1.14, 0.62)
  p.ell(0, -r * 0.05, r * 1.02, r * 0.3, r * 0.28, r * 0.22, CH.accent, W(0.88), F.kerchief)
  p.ell(r * 0.1, -r * 0.35, r * 1.04, r * 0.16, r * 0.3, r * 0.08, CH.accent, W(0.82), F.kerchief, 0.2, 0, 0.3)
  cap(F.beanie, CH.accent, 1.13, 0.3)
  p.tube(0, r * 0.4, r * 0.65, r * 0.07, r * 1.12, r * 1.08, CH.accent, W(0.85), F.beanie)
  p.dot(0, r * 1.18, r * 0.2, r * 0.3, r * 0.3, r * 0.3, CH.hair, W(1), F.beanie)
}

function arm(p: Part): void {
  p.ell(0, -0.02, 0, 0.078, 0.085, 0.078, CH.cloth, W(0.98))
  p.tube(0, -0.42, -0.02, 0, 0.056, 0.07, CH.cloth, W(0.95))
  p.tube(0, -0.45, -0.39, 0, 0.06, 0.062, CH.cloth, W(0.8))
  p.ell(0, -0.51, -0.006, 0.058, 0.078, 0.05, CH.hand, W(1))
  p.ell(0, -0.47, -0.046, 0.026, 0.04, 0.026, CH.hand, W(0.92), 0, 0.5, 0, 0)
}

function thigh(p: Part): void {
  p.tube(0, -RIG.thigh, 0.02, 0, 0.074, 0.092, CH.legs, W(1))
  p.ell(0, -RIG.thigh, 0, 0.074, 0.06, 0.074, CH.legs, W(0.96))
}

function shin(p: Part): void {
  p.tube(0, -0.24, 0, 0, 0.064, 0.074, CH.legs, W(0.96))
  p.tube(0, -0.36, -0.2, 0, 0.072, 0.075, CH.fixed, BOOT)
  p.tube(0, -0.215, -0.18, 0, 0.08, 0.08, CH.fixed, W(1.1).multiply(new THREE.Color(BOOT)))
  p.ell(0, -0.355, -0.06, 0.078, 0.06, 0.13, CH.fixed, BOOT)
  p.geo(new THREE.BoxGeometry(1, 1, 1), 0, -RIG.shin + 0.012, -0.045, 0.15, 0.024, 0.26, CH.fixed, 0x2e2a34)
}

export interface FigParts {
  torso: THREE.BufferGeometry
  head: THREE.BufferGeometry
  arm: THREE.BufferGeometry
  thigh: THREE.BufferGeometry
  shin: THREE.BufferGeometry
}

export function figureParts(): FigParts {
  const one = (fn: (p: Part) => void) => {
    const b = new FigB()
    fn(new Part(b, new THREE.Matrix4(), DETAIL.hi, 0, null))
    return b.build()
  }
  return { torso: one(torso), head: one(head), arm: one(arm), thigh: one(thigh), shin: one(shin) }
}

// Whole figure in one mesh, standing at rest, feet at y = 0; only the features `feats` lists are built.
export function rigGeometry(feats: readonly number[]): THREE.BufferGeometry {
  const b = new FigB()
  const set = new Set(feats)
  const d = DETAIL.lo
  const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z)
  torso(new Part(b, T(0, RIG.hip, 0), d, L.body, set))
  head(new Part(b, T(0, RIG.hip + RIG.headY, 0), d, L.head, set))
  for (const s of [-1, 1]) {
    arm(new Part(b, T(s * RIG.shX, RIG.hip + RIG.shY, 0).multiply(new THREE.Matrix4().makeRotationZ(s * 0.07)), d, s < 0 ? L.armL : L.armR, set))
    thigh(new Part(b, T(s * RIG.legX, RIG.hip, 0), d, s < 0 ? L.thighL : L.thighR, set))
    shin(new Part(b, T(s * RIG.legX, RIG.hip - RIG.thigh, 0), d, s < 0 ? L.shinL : L.shinR, set))
  }
  return b.build()
}

export const ROLE_FEATS: Record<Role, number[]> = {
  cook: [F.apron, F.scarf, F.hairShort, F.toque, F.moustache],
  engineer: [F.bib, F.hairShort, F.cap, F.beanie, F.scarf],
  gardener: [F.smock, F.straw, F.hairBob, F.hairBun],
  kid: [F.sailor, F.scarf, F.hairShort, F.pigtails, F.hairBob, F.beanie],
  elder: [F.shawl, F.elder, F.moustache, F.beard, F.glasses, F.hairBun],
  vendor: [F.vest, F.kerchief, F.hairBun, F.hairShort, F.moustache],
}

export interface Look {
  role: Role
  cloth: number; accent: number; skin: number; hair: number; legs: number; hand: number
  feat: number
  width: number
  head: number
  height: number
}

const SKINS = [PAL.peau1, PAL.peau2, PAL.peau3, PAL.peau4]
const HAIRS = [PAL.cheveux1, PAL.cheveux2, 0x4a3328, 0x8a5a3a, PAL.cheveux1]
const GREYS = [0xe8e4dc, 0xcfcac2, 0xb8b2aa]

export function lookFor(role: Role, rand: () => number): Look {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]!
  const skin = pick(SKINS)
  const hair = pick(HAIRS)
  const v = (lo: number, hi: number) => lo + rand() * (hi - lo)
  switch (role) {
    case 'cook':
      return { role, cloth: 0xe6dcc6, accent: pick([0xc9644e, 0x6e8fb0]), skin, hair, legs: pick([0x8a7a8e, 0x7a8a9a]), hand: skin,
        feat: mask(F.apron, F.scarf, F.hairShort, F.toque, ...(rand() < 0.6 ? [F.moustache] : [])), width: v(1.25, 1.4), head: 1.0, height: v(1.0, 1.05) }
    case 'engineer': {
      const hat = rand()
      return { role, cloth: pick([0xb4c2c4, 0xcfc4a8, 0xa88a72, 0xc9b49a]), accent: pick([0xb8664e, 0x4e5a6e, 0x7a8f6a, 0xc9a15a]), skin, hair,
        legs: pick([0x4f6d7a, 0x55638a, 0x6b5a4a, 0x5e6e5a]), hand: pick([0x6b5a4a, 0x8a6e4b]),
        feat: mask(F.bib, F.hairShort, ...(hat < 0.45 ? [F.cap] : hat < 0.75 ? [F.beanie] : [F.scarf])), width: v(1.08, 1.28), head: 1.0, height: v(0.97, 1.06) }
    }
    case 'gardener':
      return { role, cloth: pick([0x8fb59a, 0xa9b87e, 0xc2b98c, 0x9ab0a0]), accent: pick([0xd8644e, 0xe3b95f, 0x6e8fb0]), skin, hair,
        legs: pick([0x6b5a4a, 0x5e4a5c, 0x4f5e4a]), hand: pick([0x8a9a5a, 0x7a8a4e]),
        feat: mask(F.smock, rand() < 0.5 ? F.hairBob : F.hairBun, ...(rand() < 0.75 ? [F.straw] : [])), width: v(0.88, 1.0), head: 1.0, height: v(1.0, 1.08) }
    case 'kid': {
      const hs = rand()
      return { role, cloth: pick([0xd8644e, 0xe3b95f, 0x6e8fb0, 0x8fb59a, 0xc98a6a]), accent: pick([0xf1e4c8, 0x3e4a6a, 0xd8644e, 0xe3b95f]), skin,
        hair, legs: pick([0x3f4a66, 0x6b4a3a, 0x5e4a5c]), hand: pick([0xe3b95f, 0xd8644e, 0x9bb7c4, 0xf1e4c8]),
        feat: mask(rand() < 0.5 ? F.sailor : F.scarf, hs < 0.35 ? F.pigtails : hs < 0.65 ? F.hairBob : F.hairShort, ...(rand() < 0.2 ? [F.beanie] : [])),
        width: v(1.0, 1.15), head: 1.32, height: v(0.6, 0.7) }
    }
    case 'elder': {
      const bald = rand() < 0.6
      return { role, cloth: pick([0x8a7a6a, 0x6e6a80, 0x7a6a5a, 0x5e6e7a]), accent: pick([0xb07a7a, 0x9a8a5a, 0x7a9a9a, 0xc9a98a]), skin, hair: pick(GREYS),
        legs: pick([0x4a4250, 0x5e4a5c, 0x3f4a66]), hand: pick([0xb8a890, 0x9a8e86, skin]),
        feat: mask(F.shawl, bald ? F.elder : F.hairBun, ...(bald && rand() < 0.6 ? [rand() < 0.5 ? F.beard : F.moustache] : []), ...(rand() < 0.5 ? [F.glasses] : [])),
        width: v(0.95, 1.15), head: 1.04, height: v(0.88, 0.95) }
    }
    case 'vendor':
      return { role, cloth: pick([0xe6d8be, 0xd9c9a6, 0xcfd6d0]), accent: pick([0x8a4a4a, 0x4f6d7a, 0x7a6a3a, 0x6e8f6a, 0x9a6a8a]), skin, hair,
        legs: pick([0x4a4250, 0x3f4a66, 0x6b5a4a]), hand: skin,
        feat: mask(F.vest, ...(rand() < 0.55 ? [F.kerchief] : [rand() < 0.5 ? F.hairBun : F.hairShort]), ...(rand() < 0.3 ? [F.moustache] : [])),
        width: v(1.2, 1.38), head: 1.03, height: v(0.94, 1.02) }
  }
}

const _c = new THREE.Color()
const SOFT = { h: 0, s: 0, l: 0 }

export function instanceLooks(geo: THREE.BufferGeometry, n: number, rig: boolean): void {
  geo.setAttribute('iCa', new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(16777215), 4).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('iCb', new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(16777215), 4).setUsage(THREE.DynamicDrawUsage))
  if (rig) geo.setAttribute('iPose', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage))
}

function pack(hex: number, soft: boolean): number {
  _c.setHex(hex, THREE.SRGBColorSpace)
  if (soft) {
    _c.getHSL(SOFT, THREE.SRGBColorSpace)
    _c.setHSL(SOFT.h, SOFT.s * 0.78, SOFT.l, THREE.SRGBColorSpace)
  }
  return _c.getHex(THREE.SRGBColorSpace)
}

export function writeLook(geo: THREE.BufferGeometry, i: number, look: Look, featMask = look.feat): void {
  ;(geo.getAttribute('iCa') as THREE.InstancedBufferAttribute).setXYZW(i, pack(look.cloth, true), pack(look.accent, true), pack(look.skin, false), pack(look.hair, true))
  const shape = Math.round(look.width * 1000) * 2000 + Math.round(look.head * 1000)
  ;(geo.getAttribute('iCb') as THREE.InstancedBufferAttribute).setXYZW(i, pack(look.legs, true), pack(look.hand, true), featMask, shape)
}

export function touchLooks(geo: THREE.BufferGeometry): void {
  for (const k of ['iCa', 'iCb']) (geo.getAttribute(k) as THREE.InstancedBufferAttribute).needsUpdate = true
}

// freq (rad/s), phase, swing amplitude, sit bend (rad, thighs forward, shins back down).
export function writePose(geo: THREE.BufferGeometry, i: number, freq: number, phase: number, swing: number, bend: number): void {
  ;(geo.getAttribute('iPose') as THREE.InstancedBufferAttribute).setXYZW(i, freq, phase, swing, bend)
}

const VERT_DECL = /* glsl */ `
attribute vec3 aFig;
attribute vec4 iCa;
attribute vec4 iCb;
#define aCh aFig.x
#define aFeat aFig.y
#define aLimb aFig.z
#define iFeat iCb.z
vec3 figRGB(float f) {
  float r = floor(f / 65536.0);
  float g = floor((f - r * 65536.0) / 256.0);
  float b = f - r * 65536.0 - g * 256.0;
  return pow(vec3(r, g, b) / 255.0, vec3(2.2));
}
vec2 figShape() { float w = floor(iCb.w / 2000.0); return vec2(w / 1000.0, (iCb.w - w * 2000.0) / 1000.0); }
#ifdef FIG_RIG
attribute vec4 iPose;
uniform float rdTime;
mat3 figRx(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
float figSw() { return sin(rdTime * iPose.x + iPose.y) * iPose.z; }
float figSide() { return (aLimb == 1.0 || aLimb == 3.0 || aLimb == 6.0) ? -1.0 : 1.0; }
float figThigh() { return iPose.w + figSide() * figSw(); }
float figKnee() { return -iPose.w - max(0.0, -figSide() * cos(rdTime * iPose.x + iPose.y)) * iPose.z * 1.2; }
float figArm() { return -figSide() * figSw() * 0.9 + iPose.w * 0.25; }
vec3 figPos(vec3 p) {
  vec2 iShape = figShape();
  float w = iShape.x;
  float side = figSide();
  if (aLimb < 0.5) { p.x *= w; p.z *= mix(1.0, w, 0.55); return p; }
  if (aLimb == 5.0) { vec3 nk = vec3(0.0, ${(RIG.hip + RIG.neckY).toFixed(3)}, 0.0); return nk + (p - nk) * iShape.y; }
  if (aLimb == 3.0 || aLimb == 4.0) {
    vec3 sh = vec3(side * ${RIG.shX.toFixed(3)}, ${(RIG.hip + RIG.shY).toFixed(3)}, 0.0);
    p = sh + figRx(figArm()) * (p - sh);
    p.x += side * (w - 1.0) * ${RIG.shX.toFixed(3)};
    return p;
  }
  vec3 hip = vec3(side * ${RIG.legX.toFixed(3)}, ${RIG.hip.toFixed(3)}, 0.0);
  if (aLimb >= 6.0) {
    vec3 kn = vec3(hip.x, ${(RIG.hip - RIG.thigh).toFixed(3)}, 0.0);
    p = kn + figRx(figKnee()) * (p - kn);
  }
  p = hip + figRx(figThigh()) * (p - hip);
  p.x += side * (w - 1.0) * 0.06;
  return p;
}
vec3 figNor(vec3 n) {
  if (aLimb == 3.0 || aLimb == 4.0) return figRx(figArm()) * n;
  if (aLimb == 1.0 || aLimb == 2.0) return figRx(figThigh()) * n;
  if (aLimb >= 6.0) return figRx(figThigh()) * (figRx(figKnee()) * n);
  return n;
}
#endif
bool figOn() { return aFeat < 0.5 || mod(floor(iFeat / exp2(aFeat - 1.0) + 0.001), 2.0) > 0.5; }
`

export function figureMaterial(mats: Mats, rig: boolean): THREE.Material {
  return mats.cel({
    color: 0xffffff, indoor: true, vertexColors: true, rim: 0.75, shadowColor: 0x5e4a6e,
    onShader: (shader) => {
      let vs = VERT_DECL + shader.vertexShader
      if (rig) vs = '#define FIG_RIG\n' + vs
      vs = vs.replace('#include <color_vertex>', /* glsl */ `#include <color_vertex>
        {
          float pk = aCh < 1.5 ? iCa.x : aCh < 2.5 ? iCa.y : aCh < 3.5 ? iCa.z : aCh < 4.5 ? iCa.w : aCh < 5.5 ? iCb.x : iCb.y;
          vec3 tint = aCh < 0.5 ? vec3(1.0) : figRGB(pk);
          vColor.rgb = color.rgb * tint;
        }`)
      if (rig) vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = figNor(objectNormal);')
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${rig ? 'transformed = figPos(transformed);\n' : ''}if (!figOn()) transformed = vec3(0.0);`)
      shader.vertexShader = vs
    },
  })
}
