import * as THREE from 'three'
import type { DeckId, DistrictId, DomeId } from '../../core/types'
import { PAL } from '../palette'
import { C, type Kit, type LockRule, yawFacing } from './kit'

const UP = new THREE.Vector3(0, 1, 0)

function portholePlate(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.5, -0.5)
  s.lineTo(0.5, -0.5)
  s.lineTo(0.5, 0.5)
  s.lineTo(-0.5, 0.5)
  s.lineTo(-0.5, -0.5)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true)
  s.holes.push(hole)
  return new THREE.ShapeGeometry(s, 16)
}
const PLATE = portholePlate()
const RING = new THREE.TorusGeometry(0.34, 0.045, 6, 20)
const DISC = new THREE.CircleGeometry(0.33, 20)

export interface GangwayOpts {
  id: string
  nom: string
  district: DistrictId
  deck: DeckId
  pvs: DistrictId[]
  w?: number
  wall?: number
  floor?: 'bois' | 'metal' | 'grille'
  portholes?: boolean
  ends?: [DistrictId, DistrictId]
}

export function gangway(k: Kit, axis: 'x' | 'z', fixed: number, u0: number, u1: number, y: number, o: GangwayOpts): void {
  const w = o.w ?? 2.6
  const hw = w / 2
  const straight = 1.5
  const along = axis === 'x'
  const P = (u: number, yy: number, d: number) => (along ? new THREE.Vector3(u, yy, fixed + d) : new THREE.Vector3(fixed + d, yy, u))
  const lo = Math.min(u0, u1)
  const hi = Math.max(u0, u1)
  const len = hi - lo
  const mid = (lo + hi) / 2
  const wallC = new THREE.Color(o.wall ?? PAL.bleuDoux)
  if (along) k.slab(lo, hi, fixed - hw, fixed + hw, y, o.floor ?? 'metal', 0.3)
  else k.slab(fixed - hw, fixed + hw, lo, hi, y, o.floor ?? 'metal', 0.3)
  const ports: number[] = []
  if (o.portholes !== false) for (let u = lo + 2.5; u < hi - 2; u += 3) ports.push(u)
  for (const side of [-1, 1]) {
    for (let u = lo; u < hi - 0.01; u += 1) {
      const eu = Math.min(1, hi - u)
      const cu = u + eu / 2
      const isPort = ports.some((p) => Math.abs(p - cu) < 0.5)
      for (let yy = y; yy < y + straight - 0.01; yy += 0.75) {
        const c = P(cu, yy + 0.375, side * (hw + 0.1))
        const shade = (yy < y + 0.6 ? 0.85 : 1) * (0.93 + k.rand() * 0.1)
        if (isPort && yy > y + 0.6) {
          const m = new THREE.Matrix4().compose(P(cu, y + 1.15, side * (hw + 0.1)), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), along ? new THREE.Vector3(0, 0, side) : new THREE.Vector3(side, 0, 0)), new THREE.Vector3(1, 0.75 / 0.75, 1))
          k.b.add(PLATE, m, wallC.clone().multiplyScalar(shade))
          k.b.add(PLATE, m, wallC.clone().multiplyScalar(shade * 0.9), true)
          k.b.add(RING, m, C(PAL.laiton, 1.05))
          k.glass.add(DISC, m, C(0x9fd6d0))
          continue
        }
        if (along) k.b.box(c.x, c.y, c.z, eu - 0.03, 0.73, 0.18, wallC.clone().multiplyScalar(shade))
        else k.b.box(c.x, c.y, c.z, 0.18, 0.73, eu - 0.03, wallC.clone().multiplyScalar(shade))
      }
    }
    const wc = P(mid, y + 1.4, side * (hw + 0.15))
    k.cols.push({ kind: 'wall', climbable: false, x: wc.x, y: wc.y, z: wc.z, hx: along ? len / 2 : 0.15, hy: 1.4, hz: along ? 0.15 : len / 2 })
    const r0 = P(lo, y + 0.95, side * (hw - 0.08))
    const r1 = P(hi, y + 0.95, side * (hw - 0.08))
    k.beam(r0.x, r0.y, r0.z, r1.x, r1.y, r1.z, 0.06, C(PAL.laiton, 1.0))
  }
  const N = 8
  for (let u = lo; u < hi - 0.01; u += 1.2) {
    const eu = Math.min(1.2, hi - u)
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI
      const a1 = ((i + 1) / N) * Math.PI
      const pa = P(u + eu / 2, y + straight + Math.sin(a0) * hw, Math.cos(a0) * (hw + 0.1))
      const pb = P(u + eu / 2, y + straight + Math.sin(a1) * hw, Math.cos(a1) * (hw + 0.1))
      const seg = pa.distanceTo(pb)
      const c = pa.clone().lerp(pb, 0.5)
      const dir = pb.clone().sub(pa).normalize()
      const lenAxis = along ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(lenAxis, dir, new THREE.Vector3().crossVectors(lenAxis, dir)))
      const m = new THREE.Matrix4().compose(c, q, new THREE.Vector3(eu - 0.03, seg + 0.02, 0.16))
      k.b.add(BOX, m, wallC.clone().multiplyScalar(0.92 + 0.1 * Math.sin(a0) + k.rand() * 0.06))
    }
  }
  for (let u = lo + 0.6; u < hi; u += 2.4) {
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI
      const a1 = ((i + 1) / 10) * Math.PI
      const pa = P(u, y + straight + Math.sin(a0) * hw, Math.cos(a0) * hw)
      const pb = P(u, y + straight + Math.sin(a1) * hw, Math.cos(a1) * hw)
      k.beam(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 0.12, C(PAL.laiton, 0.85))
    }
    for (const side of [-1, 1]) {
      const pa = P(u, y, side * hw)
      const pb = P(u, y + straight, side * hw)
      k.beam(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 0.12, C(PAL.laiton, 0.85))
    }
  }
  const rc = P(mid, y + straight + hw + 0.2, 0)
  k.cols.push({ kind: 'wall', climbable: false, x: rc.x, y: rc.y, z: rc.z, hx: along ? len / 2 : hw + 0.2, hy: 0.2, hz: along ? hw + 0.2 : len / 2 })
  for (let u = lo + 3; u < hi - 1; u += 6) {
    const lp = P(u, y + straight + hw - 0.35, 0)
    k.lamp(lp.x, lp.y, lp.z, { radius: 6, bake: 0.9, style: 'globe', live: true })
  }
  const yawA = along ? Math.PI / 2 : Math.PI
  const sp = P(mid, y, 0)
  if (o.ends) {
    const ea = P(lo, y + 1.2, 0)
    const eb = P(hi, y + 1.2, 0)
    k.portals.push({ cell: o.id, a: { x: ea.x, y: ea.y, z: ea.z }, b: { x: eb.x, y: eb.y, z: eb.z }, da: o.ends[0], db: o.ends[1] })
  }
  k.cell({
    id: o.id, district: o.district, deck: o.deck, nom: o.nom,
    boxes: [along ? { x0: lo, x1: hi, y0: y - 0.6, y1: y + straight + hw + 0.3, z0: fixed - hw - 0.2, z1: fixed + hw + 0.2 } : { x0: fixed - hw - 0.2, x1: fixed + hw + 0.2, y0: y - 0.6, y1: y + straight + hw + 0.3, z0: lo, z1: hi }],
    spawn: { x: sp.x, y: sp.y, z: sp.z, yaw: yawA }, air: 0, roof: y + straight + hw, pvs: o.pvs, glass: ports.length > 0,
  })
}

const BOX = new THREE.BoxGeometry(1, 1, 1)

export function glassTube(k: Kit, axis: 'x' | 'z', fixed: number, u0: number, u1: number, y: number, o: GangwayOpts, gap?: { u0: number; u1: number; d0: number; d1: number }): void {
  const r = (o.w ?? 3.2) / 2
  const along = axis === 'x'
  const lo = Math.min(u0, u1)
  const hi = Math.max(u0, u1)
  const len = hi - lo
  const mid = (lo + hi) / 2
  const cy = y + r - 0.35
  const P = (u: number, yy: number, d: number) => (along ? new THREE.Vector3(u, yy, fixed + d) : new THREE.Vector3(fixed + d, yy, u))
  const fl = (a: number, b: number, d0: number, d1: number) => {
    if (b - a < 0.05 || d1 - d0 < 0.05) return
    if (along) k.slab(a, b, fixed + d0, fixed + d1, y, 'bois', 0.25)
    else k.slab(fixed + d0, fixed + d1, a, b, y, 'bois', 0.25)
  }
  if (gap) {
    fl(lo, gap.u0, -r * 0.85, r * 0.85)
    fl(gap.u1, hi, -r * 0.85, r * 0.85)
    fl(gap.u0, gap.u1, -r * 0.85, gap.d0)
    fl(gap.u0, gap.u1, gap.d1, r * 0.85)
  } else fl(lo, hi, -r * 0.85, r * 0.85)
  const cyl = new THREE.CylinderGeometry(r, r, len, 20, 1, true)
  const q = new THREE.Quaternion().setFromUnitVectors(UP, along ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1))
  k.glass.add(cyl, new THREE.Matrix4().compose(P(mid, cy, 0), q, new THREE.Vector3(1, 1, 1)), C(0x9fd6d0))
  for (let u = lo; u <= hi + 0.01; u += 3) {
    const ring = new THREE.TorusGeometry(r + 0.04, 0.07, 5, 24)
    const rq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), along ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1))
    k.b.add(ring, new THREE.Matrix4().compose(P(u, cy, 0), rq, new THREE.Vector3(1, 1, 1)), C(PAL.laiton, 1.0))
  }
  for (const side of [-1, 1]) {
    const a = P(lo, y + 0.95, side * (r * 0.8))
    const b = P(hi, y + 0.95, side * (r * 0.8))
    k.beam(a.x, a.y, a.z, b.x, b.y, b.z, 0.06, C(PAL.laiton))
    const a2 = P(lo, y - 0.1, side * (r * 0.86))
    const b2 = P(hi, y - 0.1, side * (r * 0.86))
    k.beam(a2.x, a2.y, a2.z, b2.x, b2.y, b2.z, 0.2, C(PAL.laiton, 0.8))
    const wc = P(mid, cy, side * (r + 0.1))
    k.cols.push({ kind: 'glass', climbable: false, x: wc.x, y: wc.y, z: wc.z, hx: along ? len / 2 : 0.12, hy: r, hz: along ? 0.12 : len / 2 })
  }
  const rc = P(mid, cy + r + 0.1, 0)
  k.cols.push({ kind: 'glass', climbable: false, x: rc.x, y: rc.y, z: rc.z, hx: along ? len / 2 : r, hy: 0.12, hz: along ? r : len / 2 })
  for (let u = lo + 6; u < hi - 3; u += 12) {
    const lp = P(u, y + 0.25, side1(u) * r * 0.7)
    k.lamp(lp.x, lp.y, lp.z, { radius: 5, bake: 0.6, style: 'globe', live: true, color: PAL.lampeChaude })
  }
  const sp = P(mid, y, 0)
  k.cell({
    id: o.id, district: o.district, deck: o.deck, nom: o.nom,
    boxes: [along ? { x0: lo, x1: hi, y0: y - 0.5, y1: cy + r + 0.2, z0: fixed - r, z1: fixed + r } : { x0: fixed - r, x1: fixed + r, y0: y - 0.5, y1: cy + r + 0.2, z0: lo, z1: hi }],
    spawn: { x: sp.x, y: sp.y, z: sp.z, yaw: along ? Math.PI / 2 : Math.PI }, air: 0.15, roof: cy + r, pvs: o.pvs, glass: true,
  })
}

function side1(u: number): number {
  return Math.floor(u / 12) % 2 === 0 ? 1 : -1
}

export function tower(k: Kit, id: string, x: number, z: number, y0: number, levels: readonly number[], top: number, cells: string[], open: readonly { y: number; side: 'n' | 's' | 'w' | 'e' }[] = [], size = 4.4): void {
  const h = size / 2
  const iron = C(0x5a4a5e, 1.15)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    k.beam(x + dx * h, y0, z + dz * h, x + dx * h, top + 1.1, z + dz * h, 0.22, iron)
    k.cols.push({ kind: 'pipe', climbable: true, x: x + dx * h, y: (y0 + top) / 2, z: z + dz * h, hx: 0.12, hy: (top - y0) / 2, hz: 0.12 })
  }
  for (let y = y0 + 2; y < top; y += 3) {
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
      k.beam(x + ax * h, y, z + az * h, x + bx * h, y + 2.6, z + bz * h, 0.08, iron)
    }
  }
  const all = [...levels, top]
  all.forEach((ly) => {
    k.slab(x - h - 0.6, x + h + 0.6, z - h - 0.6, z + h + 0.6, ly, 'grille', 0.2)
    const rh = h + 0.6
    const shut = (s: 'n' | 's' | 'w' | 'e') => !open.some((o) => o.side === s && Math.abs(o.y - ly) < 0.3)
    if (shut('n')) k.rail(x - rh, z - rh, x + rh, z - rh, ly)
    if (shut('e')) k.rail(x + rh, z - rh, x + rh, z + rh, ly)
    k.rail(x - rh, z + rh, x - 0.5, z + rh, ly)
    k.rail(x + 0.9, z + rh, x + rh, z + rh, ly)
    if (shut('w')) k.rail(x - rh, z - rh, x - rh, z + rh, ly)
    k.lamp(x + h, ly + 2.3, z + h, { radius: 7, bake: 0.9, style: 'cage' })
  })
  const stops = [y0, ...all]
  for (let i = 0; i < stops.length - 1; i++) {
    k.ladder(`${id}-echelle-${i}`, x + 0.2, z + h + 0.75, stops[i]!, stops[i + 1]! + 0.1, 0, 1, cells)
  }
}

export interface DomeOpts { nom: string; pvs: DistrictId[]; deck: DeckId; hole?: { x: number; z: number }; door?: number; veille?: boolean }

export function dome(k: Kit, id: DomeId | 'dome-proue', district: DistrictId, x: number, y: number, z: number, r: number, cell: DomeOpts): void {
  const ring = Math.ceil(r)
  const hole = cell.hole
  const door = cell.door
  for (let xx = -ring; xx < ring; xx += 1) {
    for (let zz = -ring; zz < ring; zz += 1) {
      if (Math.hypot(xx + 0.5, zz + 0.5) > r - 0.3) continue
      if (hole && Math.abs(x + xx + 0.5 - hole.x) < 0.9 && Math.abs(z + zz + 0.5 - hole.z) < 0.9) continue
      k.slab(x + xx, x + xx + 1, z + zz, z + zz + 1, y, 'bois', 0.3)
    }
  }
  const base = new THREE.CylinderGeometry(r, r, 0.9, 32, 1, true)
  k.b.add(base, new THREE.Matrix4().makeTranslation(x, y + 0.45, z), C(PAL.laiton, 0.85))
  k.b.add(base, new THREE.Matrix4().makeTranslation(x, y + 0.45, z), C(PAL.boisOmbre, 1.2), true)
  const gapA = 0.32
  const half = door === undefined
    ? new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    : new THREE.SphereGeometry(r, 28, 12, Math.PI - door + gapA, Math.PI * 2 - gapA * 2, 0, Math.PI / 2)
  k.glass.add(half, new THREE.Matrix4().makeTranslation(x, y + 0.9, z), C(0x9fd6d0))
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    let px = x + Math.cos(a) * r
    let py = y + 0.9
    let pz = z + Math.sin(a) * r
    for (let j = 1; j <= 8; j++) {
      const t = (j / 8) * (Math.PI / 2)
      const nx = x + Math.cos(a) * Math.cos(t) * r
      const ny = y + 0.9 + Math.sin(t) * r
      const nz = z + Math.sin(a) * Math.cos(t) * r
      k.beam(px, py, pz, nx, ny, nz, 0.1, C(PAL.laiton, 1.05))
      px = nx
      py = ny
      pz = nz
    }
  }
  for (const t of [0.35, 0.75]) {
    const rr = Math.cos(t * (Math.PI / 2)) * r
    const tor = new THREE.TorusGeometry(rr, 0.05, 4, 32)
    tor.rotateX(Math.PI / 2)
    k.b.add(tor, new THREE.Matrix4().makeTranslation(x, y + 0.9 + Math.sin(t * (Math.PI / 2)) * r, z), C(PAL.laiton))
  }
  const segs = 12
  for (let i = 0; i < segs; i++) {
    const a = ((i + 0.5) / segs) * Math.PI * 2
    if (door !== undefined && Math.abs(Math.atan2(Math.sin(a - door), Math.cos(a - door))) < 0.4) continue
    k.cols.push({ kind: 'glass', climbable: false, x: x + Math.cos(a) * r, y: y + 0.9 + r / 2, z: z + Math.sin(a) * r, hx: 0.15, hy: r / 2 + 0.6, hz: (Math.PI * r) / segs, q: new THREE.Quaternion().setFromAxisAngle(UP, -a) })
  }
  const lx = x + r * 0.35
  const lz = z - r * 0.35
  k.beam(lx, y, lz, lx - 0.25, y + 1.2, lz, 0.05, C(PAL.boisOmbre))
  k.beam(lx, y, lz, lx + 0.2, y + 1.2, lz + 0.15, 0.05, C(PAL.boisOmbre))
  k.beam(lx, y, lz, lx + 0.05, y + 1.2, lz - 0.25, 0.05, C(PAL.boisOmbre))
  k.beam(lx - 0.1, y + 1.25, lz + 0.5, lx + 0.25, y + 1.5, lz - 0.7, 0.12, C(PAL.laiton, 1.1), k.b, true)
  k.cols.push({ kind: 'prop', climbable: false, ownerId: `lunette-${id}`, x: lx, y: y + 0.8, z: lz, hx: 0.3, hy: 0.8, hz: 0.3 })
  k.anchors.push({ kind: 'lunette', id, at: { x: lx, y, z: lz }, yaw: Math.PI / 4 })
  if (cell.veille !== false) k.domes.push({ id, district, x, y: y + 0.9 + r, z, r, lunette: { x: lx, y, z: lz } })
  k.lamps.push({ x, y: y + 2.2, z, color: 0x9fd6d0, radius: r * 2.4, live: false, bake: 0.7 })
  k.cell({
    id, district, deck: cell.deck, nom: cell.nom,
    boxes: [{ x0: x - r, x1: x + r, y0: y - 0.5, y1: y + r + 1, z0: z - r, z1: z + r }],
    spawn: { x: x - r * 0.4, y, z: z + r * 0.3, yaw: 0 }, air: 0, roof: y + r, pvs: cell.pvs, glass: true,
  })
}

export function booth(k: Kit, station: string, dest: string, label: string, x: number, y: number, z: number, faceYaw: number, to: { x: number; y: number; z: number; yaw: number }, lock?: LockRule): void {
  const r = 0.85
  const fx = Math.sin(faceYaw)
  const fz = -Math.cos(faceYaw)
  k.b.cyl(x, y + 0.08, z, r + 0.15, 0.16, C(PAL.laiton, 0.9))
  k.b.cyl(x, y + 2.75, z, r + 0.15, 0.3, C(PAL.laiton, 1.0))
  const shell = new THREE.CylinderGeometry(r, r, 2.6, 20, 1, true, faceYaw + Math.PI / 2 + 0.7, Math.PI * 2 - 1.4)
  k.b.add(shell, new THREE.Matrix4().makeTranslation(x, y + 1.4, z), C(PAL.laiton, 0.75))
  k.b.add(shell, new THREE.Matrix4().makeTranslation(x, y + 1.4, z), C(PAL.boisOmbre, 1.3), true)
  const glass = new THREE.CylinderGeometry(r, r, 2.3, 12, 1, true, faceYaw + Math.PI / 2 - 0.7, 1.4)
  k.glass.add(glass, new THREE.Matrix4().makeTranslation(x, y + 1.3, z), C(0xcfefe3))
  k.b.cyl(x, y + 4.5, z, 0.32, 3.4, C(PAL.laiton, 0.85))
  k.e.sphere(x + fx * (r + 0.05), y + 2.5, z + fz * (r + 0.05), 0.1, 0.1, 0.1, C(0x8fe0a0, 1.5))
  k.cols.push({ kind: 'wall', climbable: true, x, y: y + 1.4, z, hx: r * 0.7, hy: 1.4, hz: r * 0.7 })
  const id = `tube-${station}-${dest}`
  k.cols.push({ kind: 'door', climbable: false, ownerId: id, x: x + fx * (r + 0.05), y: y + 1.2, z: z + fz * (r + 0.05), hx: 0.45, hy: 1.0, hz: 0.45 })
  k.rides.push({ id, kind: 'tube', from: { x, y, z }, to: { x: to.x, y: to.y, z: to.z }, yaw: to.yaw, ...(lock ? { lock } : {}) })
  k.anchors.push({ kind: 'tube', id, at: { x, y, z }, station })
  k.sign(label, x + fx * (r + 0.25), y + 3.05, z + fz * (r + 0.25), faceYaw, 1.7, 0.42, undefined, PAL.boisOmbre, PAL.creme)
  k.lamps.push({ x: x + fx * 1.2, y: y + 2.4, z: z + fz * 1.2, color: 0x8fe0a0, radius: 3.5, live: false, bake: 0.35 })
}

export function zipline(k: Kit, id: string, from: THREE.Vector3, to: THREE.Vector3, lock?: LockRule): void {
  k.line(from.x, from.y + 0.1, from.z, to.x, to.y + 0.1, to.z)
  k.line(from.x + 0.02, from.y + 0.12, from.z, to.x + 0.02, to.y + 0.12, to.z)
  for (const p of [from, to]) {
    k.b.cyl(p.x, p.y + 0.1, p.z, 0.16, 0.3, C(PAL.laiton, 1.05))
    k.b.cyl(p.x, p.y - 1.1, p.z, 0.08, 2.4, C(PAL.metalSombre))
  }
  const dir = to.clone().sub(from).setY(0).normalize()
  const bar = from.clone().addScaledVector(dir, 0.6)
  k.beam(bar.x - dir.z * 0.35, bar.y - 0.35, bar.z + dir.x * 0.35, bar.x + dir.z * 0.35, bar.y - 0.35, bar.z - dir.x * 0.35, 0.07, C(PAL.rouille, 1.1))
  k.beam(bar.x, bar.y + 0.1, bar.z, bar.x, bar.y - 0.35, bar.z, 0.03, C(PAL.metal))
  k.cols.push({ kind: 'door', climbable: false, ownerId: id, x: bar.x, y: bar.y - 0.6, z: bar.z, hx: 0.45, hy: 0.45, hz: 0.45 })
  k.rides.push({ id, kind: 'zip', from: { x: from.x, y: from.y, z: from.z }, to: { x: to.x, y: to.y, z: to.z }, yaw: yawFacing(dir.x, dir.z), ...(lock ? { lock } : {}) })
  k.anchors.push({ kind: 'zip', id, from: { x: from.x, y: from.y, z: from.z }, to: { x: to.x, y: to.y, z: to.z } })
}

export interface ShrineAt { id: string; num: number; x: number; y: number; z: number; nx: number; nz: number; district: DistrictId; deck: DeckId; pvs: DistrictId[] }

export function shrine(k: Kit, s: ShrineAt): void {
  const { x, y, z, nx, nz } = s
  const along = Math.abs(nx) < 0.5
  const tx = along ? 1 : 0
  const tz = along ? 0 : 1
  const P = (u: number, d: number, yy: number) => new THREE.Vector3(x + tx * u + nx * d, y + yy, z + tz * u + nz * d)
  const box = (u0: number, u1: number, d0: number, d1: number, y0: number, y1: number, color: THREE.ColorRepresentation, kind: 'wall' | 'floor' | null = 'wall', climb = true) => {
    const a = P(u0, d0, y0)
    const b = P(u1, d1, y1)
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const cz = (a.z + b.z) / 2
    const sx = Math.abs(b.x - a.x)
    const sy = Math.abs(b.y - a.y)
    const sz = Math.abs(b.z - a.z)
    k.b.box(cx, cy, cz, sx, sy, sz, color)
    if (kind) k.cols.push({ kind, climbable: climb, x: cx, y: cy, z: cz, hx: sx / 2, hy: sy / 2, hz: sz / 2 })
  }
  const teal = C(PAL.teal, 1.05)
  const dark = C(PAL.metalSombre, 1.05)
  const D0 = 0.3
  const D1 = 4.5
  box(-1.4, -1.1, D0, D1, 0, 2.6, teal)
  box(1.1, 1.4, D0, D1, 0, 2.6, teal)
  box(-1.4, 1.4, D0, D1, 2.6, 2.9, dark)
  box(-1.1, 1.1, D0, D1, -0.3, 0, C(PAL.metal), 'floor', true)
  k.doors.push({ id: `scellee-${s.id}`, x: P(0, D0 + 0.1, 0).x, y, z: P(0, D0 + 0.1, 0).z, w: 1.3, h: 2.2, axis: along ? 'z' : 'x', style: 'hatch', open: false, lock: { act: 2 }, sign: `Coque scellée n° ${s.num}` })
  const R0 = D1
  const R1 = D1 + 9
  const RW = 6
  box(-RW, RW, R0, R1, -1.6, -1.3, C(PAL.metalSombre, 0.9), 'floor', true)
  box(-RW, -1.1, R0, R0 + 2.5, -0.3, 0, C(PAL.metal), 'floor', true)
  box(1.1, RW, R0, R0 + 2.5, -0.3, 0, C(PAL.metal), 'floor', true)
  box(-1.1, 1.1, R0, R0 + 2.5, -0.3, 0, C(PAL.metal), 'floor', true)
  box(-RW, RW, R1 - 2.5, R1, -0.3, 0, C(PAL.metal), 'floor', true)
  box(-RW - 0.3, -RW, R0, R1, -1.6, 6, teal)
  box(RW, RW + 0.3, R0, R1, -1.6, 6, teal)
  box(-RW - 0.3, RW + 0.3, R1, R1 + 0.3, -1.6, 6, teal)
  box(-RW - 0.3, -1.4, R0 - 0.3, R0, -1.6, 6, teal)
  box(1.4, RW + 0.3, R0 - 0.3, R0, -1.6, 6, teal)
  box(-1.4, 1.4, R0 - 0.3, R0, 2.6, 6, teal)
  box(-RW - 0.3, RW + 0.3, R0 - 0.3, R1 + 0.3, 6, 6.3, dark, 'wall', false)
  for (let u = -RW + 1; u < RW; u += 2) {
    const a = P(u, R0, 6)
    const b = P(u, R1, 6)
    k.beam(a.x, a.y - 0.15, a.z, b.x, b.y - 0.15, b.z, 0.18, C(PAL.laiton, 0.7))
  }
  const wc = P(0, (R0 + R1) / 2, -0.55)
  k.waters.push({ x0: Math.min(P(-RW, R0 + 2.5, 0).x, P(RW, R1 - 2.5, 0).x), x1: Math.max(P(-RW, R0 + 2.5, 0).x, P(RW, R1 - 2.5, 0).x), z0: Math.min(P(-RW, R0 + 2.5, 0).z, P(RW, R1 - 2.5, 0).z), z1: Math.max(P(-RW, R0 + 2.5, 0).z, P(RW, R1 - 2.5, 0).z), y: wc.y })
  const pump = P(-RW + 1.2, R0 + 1.2, 0)
  k.b.cyl(pump.x, pump.y + 0.6, pump.z, 0.3, 1.2, C(PAL.rouille, 1.05))
  k.b.cyl(pump.x, pump.y + 1.25, pump.z, 0.36, 0.1, C(PAL.laiton))
  k.beam(pump.x, pump.y + 1.3, pump.z, pump.x + 0.6, pump.y + 1.6, pump.z + 0.2, 0.06, C(PAL.laiton))
  k.cols.push({ kind: 'prop', climbable: true, ownerId: `pompe-${s.id}`, x: pump.x, y: pump.y + 0.65, z: pump.z, hx: 0.35, hy: 0.65, hz: 0.35 })
  const valve = P(RW - 0.4, R0 + 1.3, 1.4)
  k.b.add(new THREE.TorusGeometry(0.32, 0.04, 6, 18), new THREE.Matrix4().compose(valve, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(tx, 0, tz)), new THREE.Vector3(1, 1, 1)), C(PAL.tissu1))
  k.pipe([P(RW - 0.15, R0 + 1.3, -1.2), P(RW - 0.15, R0 + 1.3, 5.6)], 0.12, PAL.metal, true, `vanne-${s.id}`)
  k.cols.push({ kind: 'prop', climbable: false, ownerId: `vanne-${s.id}`, x: valve.x, y: valve.y, z: valve.z, hx: 0.3, hy: 0.35, hz: 0.3 })
  k.valves.push({ id: `vanne-${s.id}`, at: { x: valve.x, y: valve.y, z: valve.z }, axis: { x: tx, y: 0, z: tz } })
  const lever = P(1.8, R1 - 1.2, 0)
  k.b.box(lever.x, lever.y + 0.3, lever.z, 0.4, 0.6, 0.3, C(PAL.metalSombre))
  k.beam(lever.x, lever.y + 0.5, lever.z, lever.x + 0.2, lever.y + 1.3, lever.z, 0.06, C(PAL.rouille))
  k.e.sphere(lever.x + 0.2, lever.y + 1.33, lever.z, 0.08, 0.08, 0.08, C(PAL.tissu1, 1.3))
  k.cols.push({ kind: 'prop', climbable: false, ownerId: `levier-${s.id}`, x: lever.x, y: lever.y + 0.6, z: lever.z, hx: 0.3, hy: 0.6, hz: 0.3 })
  box(-RW, -RW + 3, R1 - 2.5, R1, 2.8, 3.1, C(PAL.bois), 'floor', true)
  k.ladder(`echelle-${s.id}`, P(-RW + 1.5, R1 - 2.7, 0).x, P(-RW + 1.5, R1 - 2.7, 0).z, 0, 3.1, -nx, -nz, [s.id])
  const gr = P(-RW + 1.5, R1 - 2.5, 3.1)
  k.doors.push({ id: `grille-${s.id}`, x: gr.x, y: gr.y, z: gr.z, w: 2.4, h: 2.2, axis: along ? 'z' : 'x', style: 'grate', open: false })
  const ped = P(-RW + 1.5, R1 - 1.2, 3.1)
  k.b.cyl(ped.x, ped.y + 0.45, ped.z, 0.25, 0.9, C(PAL.laiton, 0.9))
  k.e.sphere(ped.x, ped.y + 1.05, ped.z, 0.15, 0.15, 0.15, C(0xf4f1e6, 1.4))
  k.cols.push({ kind: 'prop', climbable: true, ownerId: `nacre-${s.id}`, x: ped.x, y: ped.y + 0.5, z: ped.z, hx: 0.3, hy: 0.55, hz: 0.3 })
  const glow = P(0, R1 - 0.4, 3.6)
  k.e.add(new THREE.CircleGeometry(0.55, 20), new THREE.Matrix4().compose(glow, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-nx, 0, -nz)), new THREE.Vector3(1, 1, 1)), C(0x4f8f9a, 1.1))
  k.lamps.push({ x: glow.x, y: glow.y, z: glow.z, color: 0x7cc6bf, radius: 12, live: true, bake: 0.9 })
  k.lamp(P(-3, R0 + 1.2, 5.2).x, y + 5.2, P(-3, R0 + 1.2, 5.2).z, { radius: 7, bake: 0.6, style: 'cage', color: PAL.froid })
  const wtr = k.waters[k.waters.length - 1]!
  const v3 = (v: THREE.Vector3) => ({ x: v.x, y: v.y, z: v.z })
  k.scellees.push({
    id: s.id, num: s.num, district: s.district,
    door: v3(P(0, D0 + 0.1, 0)), entry: v3(P(0, R0 + 1, 0)), pump: v3(pump.clone().setY(pump.y + 1.0)), valve: v3(valve), lever: v3(lever.clone().setY(lever.y + 1.0)), nacre: v3(ped.clone().setY(ped.y + 1.05)),
    water: wtr, floor: y - 1.3, depth: 1.25,
  })
  const a = P(-RW - 0.3, R0 - 0.3, -1.7)
  const b = P(RW + 0.3, R1 + 0.3, 6.3)
  k.cell({
    id: s.id, district: s.district, deck: s.deck, nom: `Coque scellée n° ${s.num}`,
    boxes: [
      { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: y - 1.7, y1: y + 6.3, z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) },
      { x0: Math.min(P(-1.1, -0.6, 0).x, P(1.1, D1, 0).x), x1: Math.max(P(-1.1, -0.6, 0).x, P(1.1, D1, 0).x), y0: y - 0.5, y1: y + 2.6, z0: Math.min(P(-1.1, -0.6, 0).z, P(1.1, D1, 0).z), z1: Math.max(P(-1.1, -0.6, 0).z, P(1.1, D1, 0).z) },
    ],
    spawn: { x: P(0, R0 + 1, 0).x, y, z: P(0, R0 + 1, 0).z, yaw: yawFacing(nx, nz) }, air: 0, roof: y + 6, pvs: s.pvs,
  })
}

export function mast(k: Kit, x: number, z: number, y0: number, y1: number, r: number, rings: readonly number[]): void {
  k.b.cyl(x, (y0 + y1) / 2, z, r, y1 - y0, C(PAL.laiton, 0.95))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    k.b.cyl(x + Math.cos(a) * (r + 0.18), (y0 + y1) / 2, z + Math.sin(a) * (r + 0.18), 0.16, y1 - y0, C(i % 2 ? PAL.rouille : PAL.metal, 1.0))
  }
  for (let y = y0 + 1.2; y < y1; y += 2.4) {
    const tor = new THREE.TorusGeometry(r + 0.22, 0.06, 4, 24)
    tor.rotateX(Math.PI / 2)
    k.b.add(tor, new THREE.Matrix4().makeTranslation(x, y, z), C(PAL.laiton, 0.8))
  }
  for (const ry of rings) {
    const tor = new THREE.TorusGeometry(r + 0.9, 0.16, 6, 32)
    tor.rotateX(Math.PI / 2)
    k.b.add(tor, new THREE.Matrix4().makeTranslation(x, ry, z), C(PAL.laiton, 1.1))
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2
      k.e.sphere(x + Math.cos(a) * (r + 0.9), ry - 0.18, z + Math.sin(a) * (r + 0.9), 0.13, 0.15, 0.13, C(PAL.lampe, 1.6))
    }
    k.lamps.push({ x, y: ry - 0.3, z, color: PAL.lampe, radius: 16, live: false, bake: 1.1 })
  }
  k.cols.push({ kind: 'pipe', climbable: true, x, y: (y0 + y1) / 2, z, hx: r + 0.2, hy: (y1 - y0) / 2, hz: r + 0.2 })
}

export function engine(k: Kit, x: number, y: number, z: number, rot: number): void {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const L = (u: number, v: number) => ({ x: x + u * c - v * s, z: z + u * s + v * c })
  const base = L(0, 0)
  k.solid(base.x, y + 0.6, base.z, 3.2, 1.2, 3.2, C(PAL.rouille, 0.9), 'prop', true)
  for (let i = 0; i < 3; i++) {
    const p = L(-1 + i, 0)
    k.b.cyl(p.x, y + 2.2, p.z, 0.42, 2.0, C(PAL.metal, 1.05))
    k.b.cyl(p.x, y + 3.25, p.z, 0.5, 0.12, C(PAL.laiton))
    k.pistons.push({ x: p.x, y: y + 3.3, z: p.z, r: 0.2, stroke: 0.8, phase: i * 2.1 + rot })
  }
  k.cols.push({ kind: 'prop', climbable: true, x: base.x, y: y + 2.3, z: base.z, hx: 1.4, hy: 1.1, hz: 1.4 })
  const fb = L(0, 1.75)
  k.b.box(fb.x, y + 0.9, fb.z, 1.4, 1.2, 0.3, C(PAL.metalSombre), -rot)
  k.e.box(fb.x, y + 0.85, fb.z, 1.0, 0.7, 0.34, C(0xff8a3a, 1.4), -rot)
  k.lamps.push({ x: fb.x, y: y + 1.0, z: fb.z, color: 0xe08a4e, radius: 9, live: true, bake: 1.2 })
  k.pipe([{ x: L(1.2, -1.2).x, y: y + 1.2, z: L(1.2, -1.2).z }, { x: L(1.2, -1.2).x, y: y + 6.5, z: L(1.2, -1.2).z }], 0.2, PAL.laiton, true)
  k.steam.push({ x: L(1.2, -1.2).x, y: y + 6.6, z: L(1.2, -1.2).z })
}
