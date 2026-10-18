import * as THREE from 'three'

type FlFn = (x: number, y: number, z: number) => [number, number, number, number]

class Builder {
  private pos: number[] = []
  private nor: number[] = []
  private fl: number[] = []
  private idx: number[] = []

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, fl: readonly number[]): number {
    this.pos.push(x, y, z)
    this.nor.push(nx, ny, nz)
    this.fl.push(fl[0] ?? 0, fl[1] ?? 1, fl[2] ?? 0, fl[3] ?? 0)
    return this.pos.length / 3 - 1
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c)
  }

  add(geom: THREE.BufferGeometry, m: THREE.Matrix4, fl: FlFn): void {
    const g = geom
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    const nm = new THREE.Matrix3().getNormalMatrix(m)
    const v = new THREE.Vector3()
    const w = new THREE.Vector3()
    const start = this.pos.length / 3
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m)
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize()
      this.vert(v.x, v.y, v.z, w.x, w.y, w.z, fl(v.x, v.y, v.z))
    }
    if (g.index) {
      const ix = g.index
      for (let i = 0; i < ix.count; i++) this.idx.push(start + ix.getX(i))
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(start + i)
    }
    geom.dispose()
  }

  build(): THREE.InstancedBufferGeometry {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('aFl', new THREE.Float32BufferAttribute(this.fl, 4))
    g.setIndex(this.idx)
    g.instanceCount = 0
    return g
  }
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

function segmentMatrix(a: THREE.Vector3, b: THREE.Vector3): THREE.Matrix4 {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  tmpQ.setFromUnitVectors(UP, dir.normalize())
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  return tmpM.compose(mid, tmpQ, new THREE.Vector3(1, len, 1)).clone()
}

export function grassBladeGeometry(): THREE.InstancedBufferGeometry {
  const b = new Builder()
  const v0 = b.vert(-0.5, 0, 0, 0, 0, 1, [0, 1, 0, 0])
  const v1 = b.vert(0.5, 0, 0, 0, 0, 1, [0, 1, 0, 0])
  const v2 = b.vert(-0.36, 0.55, 0.07, 0, 0.3, 1, [0.55, 1, 0, 0])
  const v3 = b.vert(0.36, 0.55, 0.07, 0, 0.3, 1, [0.55, 1, 0, 0])
  const v4 = b.vert(0, 1, 0.2, 0, 0.6, 1, [1, 1, 0, 0])
  b.tri(v0, v1, v2)
  b.tri(v1, v3, v2)
  b.tri(v2, v3, v4)
  return b.build()
}

export function grassTuftGeometry(): THREE.InstancedBufferGeometry {
  const b = new Builder()
  const spikes = 5
  for (let plane = 0; plane < 2; plane++) {
    const az = plane * 1.7 + 0.2
    const ca = Math.cos(az)
    const sa = Math.sin(az)
    const n = [-sa, 0.4, ca] as const
    const off = plane === 0 ? 0 : 0.12
    for (let i = 0; i < spikes; i++) {
      const x0 = -0.5 + i / spikes
      const x1 = x0 + 1 / spikes
      const h = 0.65 + 0.35 * Math.sin(i * 2.3 + plane) ** 2
      const lean = (x0 + x1) * 0.35
      const p = (x: number, z: number): [number, number] => [ca * x - sa * z, sa * x + ca * z + off]
      const [ax, az0] = p(x0, 0)
      const [cx, cz] = p(x1, 0)
      const [tx, tz] = p((x0 + x1) * 0.5 + lean, 0.08)
      const a = b.vert(ax, 0, az0, n[0], n[1], n[2], [0, 1, 0, 0])
      const c = b.vert(cx, 0, cz, n[0], n[1], n[2], [0, 1, 0, 0])
      const t = b.vert(tx, h, tz, n[0], n[1], n[2], [h, 1, 0, 0])
      b.tri(a, c, t)
    }
  }
  return b.build()
}

export function kelpGeometry(lod: 0 | 1 | 2, rng: () => number): THREE.InstancedBufferGeometry {
  const b = new Builder()
  if (lod === 0) {
    const segs = 16
    const sides = 5
    const r = 0.12
    const ring: number[][] = []
    for (let i = 0; i <= segs; i++) {
      const y = i / segs
      const row: number[] = []
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2
        row.push(b.vert(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), [y, 0.55 + 0.45 * y, 0, 0]))
      }
      ring.push(row)
    }
    for (let i = 0; i < segs; i++) {
      for (let k = 0; k < sides; k++) {
        const a = ring[i]![k]!
        const c = ring[i]![(k + 1) % sides]!
        const d = ring[i + 1]![k]!
        const e = ring[i + 1]![(k + 1) % sides]!
        b.tri(a, d, c)
        b.tri(c, d, e)
      }
    }
    const fronds = 15
    for (let f = 0; f < fronds; f++) {
      const y0 = 0.12 + (f / fronds) * 0.86 + (rng() - 0.5) * 0.02
      const az = f * 2.39996 + rng() * 0.4
      const len = 1.6 + rng() * 1.4 + (f >= fronds - 3 ? 1.5 : 0)
      const wid = 0.42 + rng() * 0.2
      const ca = Math.cos(az)
      const sa = Math.sin(az)
      const steps = 4
      const ids: number[] = []
      for (let s = 0; s <= steps; s++) {
        const u = s / steps
        const rr = 0.1 + u * len
        const yy = y0 + u * 0.018 + Math.sin(u * 3) * 0.004
        const w = wid * (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) * 0.85) * 0.5
        const cx = ca * rr
        const cz = sa * rr
        ids.push(b.vert(cx - sa * w, yy, cz + ca * w, 0, 1, 0, [yy, 1, u, 0]))
        ids.push(b.vert(cx + sa * w, yy, cz - ca * w, 0, 1, 0, [yy, 1, u, 0]))
      }
      for (let s = 0; s < steps; s++) {
        const a = ids[s * 2]!
        const c = ids[s * 2 + 1]!
        const d = ids[s * 2 + 2]!
        const e = ids[s * 2 + 3]!
        b.tri(a, c, d)
        b.tri(c, e, d)
      }
      const bl = new THREE.OctahedronGeometry(0.17, 0)
      const m = new THREE.Matrix4().makeTranslation(ca * 0.22, y0, sa * 0.22)
      b.add(bl, m, (_x, y) => [y, 1, 0, 0.55])
    }
    return b.build()
  }
  if (lod === 1) {
    for (let plane = 0; plane < 2; plane++) {
      const az = plane * Math.PI * 0.5
      const ca = Math.cos(az)
      const sa = Math.sin(az)
      const ids: number[] = []
      for (let i = 0; i <= 8; i++) {
        const y = i / 8
        ids.push(b.vert(-ca * 0.28, y, -sa * 0.28, -sa, 0.3, ca, [y, 0.55 + 0.45 * y, 0, 0]))
        ids.push(b.vert(ca * 0.28, y, sa * 0.28, -sa, 0.3, ca, [y, 0.55 + 0.45 * y, 0, 0]))
      }
      for (let i = 0; i < 8; i++) {
        b.tri(ids[i * 2]!, ids[i * 2 + 1]!, ids[i * 2 + 2]!)
        b.tri(ids[i * 2 + 1]!, ids[i * 2 + 3]!, ids[i * 2 + 2]!)
      }
    }
    for (let f = 0; f < 11; f++) {
      const y0 = 0.1 + (f / 11) * 0.88
      const az = f * 2.39996
      const ca = Math.cos(az)
      const sa = Math.sin(az)
      const len = 2.6 + rng() * 1.4
      const w = 0.6
      const tipY = y0 + 0.03
      const a = b.vert(-sa * w * 0.3, y0, ca * w * 0.3, 0, 1, 0, [y0, 1, 0, 0])
      const c = b.vert(sa * w * 0.3, y0, -ca * w * 0.3, 0, 1, 0, [y0, 1, 0, 0])
      const d = b.vert(ca * len * 0.5 - sa * w, (y0 + tipY) * 0.5, sa * len * 0.5 + ca * w, 0, 1, 0, [y0, 1, 0.5, 0])
      const e = b.vert(ca * len * 0.5 + sa * w, (y0 + tipY) * 0.5, sa * len * 0.5 - ca * w, 0, 1, 0, [y0, 1, 0.5, 0])
      const t = b.vert(ca * len, tipY, sa * len, 0, 1, 0, [tipY, 1, 1, 0])
      b.tri(a, c, d)
      b.tri(c, e, d)
      b.tri(d, e, t)
    }
    return b.build()
  }
  const segs = 4
  const width = 2.1
  for (let plane = 0; plane < 2; plane++) {
    const ids: number[] = []
    const az = plane * Math.PI * 0.5 + 0.3
    const ca = Math.cos(az)
    const sa = Math.sin(az)
    for (let i = 0; i <= segs; i++) {
      const y = i / segs
      const leaf = 0.55 + 0.45 * Math.sin(y * 19 + plane * 2) ** 2
      const w = width * leaf * (y < 0.08 ? y / 0.08 : 1) * 0.5
      const n = [-sa, 0.5, ca]
      ids.push(b.vert(-ca * w, y, -sa * w, n[0]!, n[1]!, n[2]!, [y, 0.6 + 0.4 * y, 0, 0]))
      ids.push(b.vert(ca * w, y, sa * w, n[0]!, n[1]!, n[2]!, [y, 0.6 + 0.4 * y, 0, 0]))
    }
    for (let i = 0; i < segs; i++) {
      const a = ids[i * 2]!
      const c = ids[i * 2 + 1]!
      const d = ids[i * 2 + 2]!
      const e = ids[i * 2 + 3]!
      b.tri(a, c, d)
      b.tri(c, e, d)
    }
  }
  return b.build()
}

export type CoralType = 'branche' | 'dome' | 'eventail' | 'tube' | 'anemone'
export const CORAL_TYPES: readonly CoralType[] = ['branche', 'dome', 'eventail', 'tube', 'anemone']

export function coralGeometry(type: CoralType, rng: () => number): THREE.InstancedBufferGeometry {
  const b = new Builder()
  switch (type) {
    case 'branche': {
      const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
        const end = a.clone().addScaledVector(dir, len)
        const cyl = new THREE.CylinderGeometry(r * 0.7, r, 1, 4, 1, true)
        const tip = depth === 0 ? 1 : 0
        b.add(cyl, segmentMatrix(a, end), (_x, y) => [0, 0.45 + 0.55 * Math.min(1, y / 1.2), 0, tip * Math.min(1, y / 1.2)])
        if (depth === 0) return
        const n = depth === 2 ? 3 : 2
        for (let i = 0; i < n; i++) {
          const d = dir.clone()
          d.x += (rng() - 0.5) * 1.3
          d.z += (rng() - 0.5) * 1.3
          d.y += 0.25
          grow(end, d.normalize(), len * (0.65 + rng() * 0.2), r * 0.7, depth - 1)
        }
      }
      grow(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 1, 0), 0.4, 0.09, 2)
      grow(new THREE.Vector3(0.12, -0.05, 0.05), new THREE.Vector3(0.5, 0.8, 0.2).normalize(), 0.32, 0.07, 1)
      break
    }
    case 'dome': {
      const ico = new THREE.IcosahedronGeometry(0.6, 1)
      const p = ico.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i)
        const y = p.getY(i)
        const z = p.getZ(i)
        const k = 1 + Math.sin(x * 11) * Math.sin(z * 9) * 0.06
        p.setXYZ(i, x * k, Math.max(y * 0.62 * k, -0.05) + 0.12, z * k)
      }
      ico.computeVertexNormals()
      b.add(ico, new THREE.Matrix4(), (_x, y) => [0, 0.4 + 0.6 * Math.min(1, y / 0.5), 0, 0])
      break
    }
    case 'eventail': {
      const steps = 9
      const center = b.vert(0, 0.15, 0, 0, 0.6, 0.8, [0.1, 0.5, 0, 0])
      const rim: number[] = []
      for (let i = 0; i <= steps; i++) {
        const a = 0.35 + (i / steps) * (Math.PI - 0.7)
        const rr = 0.85 + Math.sin(i * 1.7) * 0.12
        rim.push(b.vert(Math.cos(a) * rr, 0.15 + Math.sin(a) * rr, 0, 0, 0.6, 0.8, [1, 1, 0, 0.35]))
      }
      for (let i = 0; i < steps; i++) b.tri(center, rim[i]!, rim[i + 1]!)
      const stalk = new THREE.CylinderGeometry(0.03, 0.05, 1, 4, 1, true)
      b.add(stalk, segmentMatrix(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.2, 0)), () => [0, 0.5, 0, 0])
      break
    }
    case 'tube': {
      for (let i = 0; i < 6; i++) {
        const h = 0.55 + rng() * 0.9
        const r = 0.06 + rng() * 0.06
        const a = rng() * Math.PI * 2
        const d = i === 0 ? 0 : 0.12 + rng() * 0.18
        const base = new THREE.Vector3(Math.cos(a) * d, -0.05, Math.sin(a) * d)
        const top = base.clone().add(new THREE.Vector3((rng() - 0.5) * 0.15, h, (rng() - 0.5) * 0.15))
        const cyl = new THREE.CylinderGeometry(r, r * 0.85, 1, 6, 1, true)
        b.add(cyl, segmentMatrix(base, top), (_x, y) => {
          const u = Math.min(1, Math.max(0, y / (h + 0.05)))
          return [u * 0.5, 0.45 + 0.55 * u, 0, u > 0.88 ? 1 : 0]
        })
      }
      break
    }
    case 'anemone': {
      const col = new THREE.CylinderGeometry(0.2, 0.26, 1, 7, 1, false)
      b.add(col, segmentMatrix(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.3, 0)), (_x, y) => [0, 0.45 + 0.55 * Math.min(1, y / 0.3), 0, 0])
      const n = 16
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.2
        const ring = i % 2 === 0 ? 0.17 : 0.1
        const base = new THREE.Vector3(Math.cos(a) * ring, 0.29, Math.sin(a) * ring)
        const out = 0.28 + rng() * 0.12
        const tip = new THREE.Vector3(Math.cos(a) * (ring + out), 0.29 + 0.32 + rng() * 0.12, Math.sin(a) * (ring + out))
        const cone = new THREE.ConeGeometry(0.035, 1, 3, 1, true)
        const len = base.distanceTo(tip)
        b.add(cone, segmentMatrix(base, tip), (x, y, z) => {
          const u = Math.min(1, Math.max(0, Math.hypot(x - base.x, y - base.y, z - base.z) / len))
          return [u, 0.8 + 0.2 * u, 0, u * u]
        })
      }
      break
    }
  }
  return b.build()
}
