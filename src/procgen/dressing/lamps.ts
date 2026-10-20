import * as THREE from 'three'
import { GeoBuilder } from '../../drift/builder'
import { SURF } from '../../drift/surface'
import { cyl } from './props'
import type { Bulb, DressLamp, DressPalette } from './plan'

const IRON = 0x3e3a4a
const BRASS = 0xd9b48f
const GREEN = 0x3f6a4e

// Lamp fittings for one district in one merged geometry; returns the glowing bulbs to instance.
export function buildLamps(b: GeoBuilder, lamps: readonly DressLamp[], pal: DressPalette): Bulb[] {
  const bulbs: Bulb[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  for (const l of lamps) {
    const fx = Math.sin(l.rot)
    const fz = Math.cos(l.rot)
    const by = l.y - l.drop
    switch (l.kind) {
      case 'suspension':
        b.box(l.x, l.y - l.drop / 2, l.z, 0.015, l.drop, 0.015, IRON)
        b.add(CONE, m.compose(new THREE.Vector3(l.x, by + 0.12, l.z), q.identity(), new THREE.Vector3(0.32, 0.22, 0.32)), pal.look.shade)
        bulbs.push({ x: l.x, y: by + 0.02, z: l.z, color: l.color, size: 0.09 })
        break
      case 'globe':
        b.box(l.x, l.y - l.drop / 2, l.z, 0.015, l.drop, 0.015, IRON)
        cyl(b, l.x, by + 0.2, l.z, 0.06, 0.06, BRASS)
        bulbs.push({ x: l.x, y: by, z: l.z, color: l.color, size: 0.2 })
        break
      case 'lanterne':
        if (l.drop > 0) b.box(l.x, l.y - l.drop / 2, l.z, 0.012, l.drop, 0.012, IRON)
        b.with(SURF.brass, () => {
          cyl(b, l.x, by + 0.16, l.z, 0.12, 0.05, IRON)
          cyl(b, l.x, by - 0.2, l.z, 0.13, 0.05, IRON)
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + l.rot
            b.box(l.x + Math.cos(a) * 0.1, by - 0.02, l.z + Math.sin(a) * 0.1, 0.02, 0.36, 0.02, IRON)
          }
          b.add(CONE, m.compose(new THREE.Vector3(l.x, by + 0.26, l.z), q.identity(), new THREE.Vector3(0.14, 0.14, 0.14)), IRON)
        })
        bulbs.push({ x: l.x, y: by - 0.02, z: l.z, color: l.color, size: 0.1 })
        break
      case 'applique': {
        b.with(SURF.brass, () => {
          b.box(l.x, l.y, l.z, 0.14, 0.24, 0.04, BRASS, l.rot)
          b.box(l.x + fx * 0.14, l.y + 0.02, l.z + fz * 0.14, 0.03, 0.03, 0.28, BRASS, l.rot)
        })
        q.setFromAxisAngle(up, l.rot)
        b.add(CONE, m.compose(new THREE.Vector3(l.x + fx * 0.28, l.y + 0.16, l.z + fz * 0.28), q, new THREE.Vector3(0.16, 0.14, 0.16)), pal.look.shade)
        bulbs.push({ x: l.x + fx * 0.28, y: l.y + 0.06, z: l.z + fz * 0.28, color: l.color, size: 0.07 })
        break
      }
      case 'lampadaire':
        b.with(SURF.brass, () => {
          cyl(b, l.x, l.y - 1.3, l.z, 0.035, 2.6, IRON)
          cyl(b, l.x, l.y - 2.58, l.z, 0.2, 0.05, IRON)
          b.box(l.x + fx * 0.25, l.y, l.z + fz * 0.25, 0.03, 0.03, 0.5, IRON, l.rot)
        })
        b.add(CONE, m.compose(new THREE.Vector3(l.x + fx * 0.5, l.y - 0.02, l.z + fz * 0.5), q.identity(), new THREE.Vector3(0.24, 0.18, 0.24)), pal.look.shade)
        bulbs.push({ x: l.x + fx * 0.5, y: l.y - 0.14, z: l.z + fz * 0.5, color: l.color, size: 0.08 })
        break
      case 'verte':
        cyl(b, l.x, l.y - 0.33, l.z, 0.09, 0.03, BRASS)
        b.box(l.x, l.y - 0.2, l.z, 0.025, 0.28, 0.025, BRASS)
        cyl(b, l.x, l.y - 0.03, l.z, 0.12, 0.08, GREEN, 'x')
        bulbs.push({ x: l.x, y: l.y - 0.08, z: l.z, color: l.color, size: 0.05 })
        break
    }
  }
  return bulbs
}

const CONE = (() => {
  const g = new THREE.CylinderGeometry(0.25, 1, 1, 8, 1, true)
  g.translate(0, -0.5, 0)
  const back = g.clone()
  back.scale(0.98, 1, 0.98)
  const idx = back.index!
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i)
    idx.setX(i, idx.getX(i + 2))
    idx.setX(i + 2, a)
  }
  const n = back.getAttribute('normal') as THREE.BufferAttribute
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  const out = new THREE.BufferGeometry()
  const merge = (attr: string) => {
    const a = g.getAttribute(attr) as THREE.BufferAttribute
    const c = back.getAttribute(attr) as THREE.BufferAttribute
    const arr = new Float32Array(a.array.length + c.array.length)
    arr.set(a.array as Float32Array)
    arr.set(c.array as Float32Array, a.array.length)
    out.setAttribute(attr, new THREE.BufferAttribute(arr, a.itemSize))
  }
  merge('position')
  merge('normal')
  merge('uv')
  const offset = g.getAttribute('position').count
  out.setIndex([...Array.from(g.index!.array), ...Array.from(idx.array, (v) => v + offset)])
  g.dispose()
  back.dispose()
  return out
})()
