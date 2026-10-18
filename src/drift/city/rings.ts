import * as THREE from 'three'
import { PAL } from '../palette'
import { C, type Kit } from './kit'

export interface Hole { x: number; z: number; r: number }

export function ringFloor(k: Kit, cx: number, cz: number, y: number, r0: number, r1: number, style: 'bois' | 'grille' | 'metal', holes: readonly Hole[] = [], t = 0.3): void {
  const s = 1
  const ext = Math.ceil(r1)
  for (let x = -ext; x < ext; x += s) {
    for (let z = -ext; z < ext; z += s) {
      const mx = x + s / 2
      const mz = z + s / 2
      const d = Math.hypot(mx, mz)
      if (d > r1 - 0.2 || d < r0 + 0.3) continue
      if (holes.some((h) => Math.hypot(cx + mx - h.x, cz + mz - h.z) < h.r)) continue
      k.slab(cx + x, cx + x + s, cz + z, cz + z + s, y, style, t)
    }
  }
}

export function ringRail(k: Kit, cx: number, cz: number, y: number, r: number, gaps: readonly [number, number][] = [], segs = 32): void {
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2
    const a1 = ((i + 1) / segs) * Math.PI * 2
    const am = (a0 + a1) / 2
    if (gaps.some(([g0, g1]) => angleIn(am, g0, g1))) continue
    k.rail(cx + Math.cos(a0) * r, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cz + Math.sin(a1) * r, y)
  }
}

function angleIn(a: number, g0: number, g1: number): boolean {
  const n = (v: number) => ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const x = n(a - g0)
  return x <= n(g1 - g0)
}

export function ringWall(k: Kit, cx: number, cz: number, y0: number, y1: number, r: number, color: number, gaps: readonly { a: number; w: number; y0: number; y1: number }[] = []): void {
  const segs = 36
  const T = 2
  const wc = new THREE.Color(color)
  for (let i = 0; i < segs; i++) {
    const a = ((i + 0.5) / segs) * Math.PI * 2
    const chord = 2 * r * Math.sin(Math.PI / segs) + 0.1
    let runStart: number | null = null
    const flush = (yEnd: number) => {
      if (runStart === null) return
      k.cols.push({ kind: 'wall', climbable: true, x: cx + Math.cos(a) * (r + 0.2), y: (runStart + yEnd) / 2, z: cz + Math.sin(a) * (r + 0.2), hx: 0.25, hy: (yEnd - runStart) / 2, hz: chord / 2, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a) })
      runStart = null
    }
    for (let y = y0; y < y1 - 0.01; y += T) {
      const blocked = gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) < g.w / (2 * r) && y + T > g.y0 && y < g.y1)
      if (blocked) {
        flush(y)
        continue
      }
      if (runStart === null) runStart = y
      k.b.box(cx + Math.cos(a) * (r + 0.2), y + T / 2, cz + Math.sin(a) * (r + 0.2), 0.4, T - 0.05, chord, wc.clone().multiplyScalar(0.88 + k.rand() * 0.14), -a)
    }
    flush(y1)
    if (i % 3 === 0) k.beam(cx + Math.cos(a) * (r - 0.1), y0, cz + Math.sin(a) * (r - 0.1), cx + Math.cos(a) * (r - 0.1), y1, cz + Math.sin(a) * (r - 0.1), 0.22, C(PAL.laiton, 0.75))
  }
}
