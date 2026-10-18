import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type ColorFn = (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color
export type ColorSpec = THREE.ColorRepresentation | ColorFn

const _p = new THREE.Vector3()
const _n = new THREE.Vector3()
const _nm = new THREE.Matrix3()
const _c = new THREE.Color()

export class GeoBuilder {
  private pos: number[] = []
  private nor: number[] = []
  private col: number[] = []
  private uv: number[] = []
  private idx: number[] = []
  private pt: number[] = []
  pat = 0
  patFn: ((p: THREE.Vector3, n: THREE.Vector3) => number) | null = null
  colorPat: ((hex: number) => number) | null = null
  shade: ((p: THREE.Vector3, n: THREE.Vector3) => number) | null = null
  jitter = 0.05
  private seed = 1

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  get vertexCount(): number {
    return this.pos.length / 3
  }

  add(geom: THREE.BufferGeometry, matrix: THREE.Matrix4, color: ColorSpec, flip = false): this {
    const g = geom
    const pa = g.getAttribute('position') as THREE.BufferAttribute
    const na = g.getAttribute('normal') as THREE.BufferAttribute | undefined
    const ua = g.getAttribute('uv') as THREE.BufferAttribute | undefined
    _nm.getNormalMatrix(matrix)
    const base = this.pos.length / 3
    const fixed = typeof color === 'function' ? null : _c.set(color).clone()
    const tint = 1 + (this.rand() - 0.5) * this.jitter * 2
    const pat = this.pat !== 0 || !this.colorPat || typeof color !== 'number' ? this.pat : this.colorPat(color)
    for (let i = 0; i < pa.count; i++) {
      _p.fromBufferAttribute(pa, i).applyMatrix4(matrix)
      if (na) _n.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize()
      else _n.set(0, 1, 0)
      if (flip) _n.negate()
      this.pos.push(_p.x, _p.y, _p.z)
      this.nor.push(_n.x, _n.y, _n.z)
      const c = fixed ?? (color as ColorFn)(_p, _n)
      const s = (this.shade ? this.shade(_p, _n) : 1) * tint
      this.col.push(c.r * s, c.g * s, c.b * s)
      this.pt.push(this.patFn ? this.patFn(_p, _n) : pat)
      if (ua) this.uv.push(ua.getX(i), ua.getY(i))
      else this.uv.push(0, 0)
    }
    if (g.index) {
      const ia = g.index
      for (let i = 0; i < ia.count; i += 3) {
        const a = ia.getX(i) + base
        const b = ia.getX(i + 1) + base
        const c = ia.getX(i + 2) + base
        if (flip) this.idx.push(a, c, b)
        else this.idx.push(a, b, c)
      }
    } else {
      for (let i = 0; i < pa.count; i += 3) {
        if (flip) this.idx.push(base + i, base + i + 2, base + i + 1)
        else this.idx.push(base + i, base + i + 1, base + i + 2)
      }
    }
    return this
  }

  with(pat: number, fn: () => void): this {
    const prev = this.pat
    this.pat = pat
    fn()
    this.pat = prev
    return this
  }

  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: ColorSpec, rotY = 0): this {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(sx, sy, sz),
    )
    return this.add(UNIT.box, m, color)
  }

  rbox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: ColorSpec, r = 0.025, rotY = 0): this {
    const rr = Math.min(r, sx * 0.49, sy * 0.49, sz * 0.49)
    const key = `${sx.toFixed(3)}:${sy.toFixed(3)}:${sz.toFixed(3)}:${rr.toFixed(3)}`
    let g = ROUNDED.get(key)
    if (!g) {
      g = new RoundedBoxGeometry(sx, sy, sz, 1, rr)
      ROUNDED.set(key, g)
    }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(1, 1, 1))
    return this.add(g, m, color)
  }

  cyl(cx: number, cy: number, cz: number, r: number, h: number, color: ColorSpec, axis: 'x' | 'y' | 'z' = 'y'): this {
    const q = new THREE.Quaternion()
    if (axis === 'x') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    if (axis === 'z') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(r, h, r))
    return this.add(UNIT.cyl, m, color)
  }

  sphere(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: ColorSpec): this {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), new THREE.Vector3(rx, ry, rz))
    return this.add(UNIT.sphere, m, color)
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('aPat', new THREE.Float32BufferAttribute(this.pt, 1))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

const ROUNDED = new Map<string, THREE.BufferGeometry>()

export const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 12, 8),
}

export function basis(across: THREE.Vector3, up: THREE.Vector3): THREE.Matrix4 {
  const third = new THREE.Vector3().crossVectors(across, up)
  return new THREE.Matrix4().makeBasis(across, up, third)
}
