import * as THREE from 'three'

export const SWAY = { hang: 0, upright: 1, ribbon: 2, trail: 3, rigid: 4 } as const
export type SwayKind = (typeof SWAY)[keyof typeof SWAY]

export interface Sway {
  px: number; py: number; pz: number
  flex: number
  phase: number
  kind: SwayKind
  grow: number
}

export const RIGID: Sway = { px: 0, py: 0, pz: 0, flex: 0, phase: 0, kind: SWAY.rigid, grow: -1 }

const _v = new THREE.Vector3()
const _n = new THREE.Vector3()
const _c = new THREE.Color()
const _m3 = new THREE.Matrix3()

export class PlantGeo {
  private pos: number[] = []
  private nor: number[] = []
  private col: number[] = []
  private sw: number[] = []
  private sw2: number[] = []
  private idx: number[] = []

  get vertexCount(): number {
    return this.pos.length / 3
  }

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, color: THREE.Color, s: Sway): number {
    this.pos.push(x, y, z)
    this.nor.push(nx, ny, nz)
    this.col.push(color.r, color.g, color.b)
    this.sw.push(s.px, s.py, s.pz, s.flex)
    this.sw2.push(s.phase, s.kind, s.grow, 0)
    return this.pos.length / 3 - 1
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c)
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d)
  }

  add(geom: THREE.BufferGeometry, m: THREE.Matrix4, color: number | THREE.Color, s: Sway, shade?: (y: number) => number): void {
    const p = geom.getAttribute('position') as THREE.BufferAttribute
    let n = geom.getAttribute('normal') as THREE.BufferAttribute | undefined
    if (!n) {
      geom.computeVertexNormals()
      n = geom.getAttribute('normal') as THREE.BufferAttribute
    }
    _m3.getNormalMatrix(m)
    const base = typeof color === 'number' ? new THREE.Color(color) : color
    const start = this.vertexCount
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(m)
      _n.fromBufferAttribute(n, i).applyMatrix3(_m3).normalize()
      _c.copy(base)
      if (shade) _c.multiplyScalar(shade(_v.y))
      this.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, _c, s)
    }
    if (geom.index) {
      const ix = geom.index
      for (let i = 0; i < ix.count; i++) this.idx.push(start + ix.getX(i))
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(start + i)
    }
    geom.dispose()
  }

  // A flat ribbon through `pts` (width per point), facing `side` (perpendicular to the ribbon's run).
  ribbon(pts: THREE.Vector3[], widths: number[], side: THREE.Vector3[], colors: THREE.Color[], s: Sway, sways?: Sway[]): void {
    let prevA = -1
    let prevB = -1
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      const w = widths[i]! * 0.5
      const sd = side[i]!
      const next = pts[Math.min(i + 1, pts.length - 1)]!
      const prev = pts[Math.max(i - 1, 0)]!
      _v.subVectors(next, prev).normalize()
      _n.crossVectors(sd, _v).normalize()
      const sw = sways?.[i] ?? s
      const a = this.vert(p.x - sd.x * w, p.y - sd.y * w, p.z - sd.z * w, _n.x, _n.y, _n.z, colors[i]!, sw)
      const b = this.vert(p.x + sd.x * w, p.y + sd.y * w, p.z + sd.z * w, _n.x, _n.y, _n.z, colors[i]!, sw)
      if (prevA >= 0) this.quad(prevA, prevB, b, a)
      prevA = a
      prevB = b
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aSw', new THREE.Float32BufferAttribute(this.sw, 4))
    g.setAttribute('aSw2', new THREE.Float32BufferAttribute(this.sw2, 4))
    if (this.vertexCount > 65535) g.setIndex(new THREE.Uint32BufferAttribute(this.idx, 1))
    else g.setIndex(this.idx)
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}
