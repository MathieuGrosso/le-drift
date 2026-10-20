import * as THREE from 'three'
import type { DeckId, DistrictId } from '../../core/types'
import type { PlacedHull } from '../hulls'
import { bakeHomes, type ClosedDoor, type DoorSlot, type HomeDef, type WallFrame } from '../homes/plan'
import { DISTRICT_BY_ID } from '../../core/layout'
import { PAL } from '../palette'
import { SURF } from '../surface'
import { C, type Kit } from './kit'

export type Side = 'n' | 's' | 'w' | 'e'

export interface Opening { side: Side; u: number; y: number; w: number; h: number }
export interface Span { side: Side; y: number; u0: number; u1: number }

export interface HallDef {
  id: string
  nom: string
  district: DistrictId
  deck: DeckId
  x0: number; x1: number; z0: number; z1: number
  floorY: number
  floor: 'bois' | 'pierre' | 'metal' | 'grille'
  levels: number[]
  tiers: Partial<Record<Side, number[]>>
  spring: number
  rise: number
  axis: 'x' | 'z'
  openings: Opening[]
  railGaps: Span[]
  noGallery: Span[]
  noHull: Span[]
  paints: readonly number[]
  wall: number
  floorHole?: { x: number; z: number; r: number }
  oculus?: boolean
  depth?: number
  air?: number
  pvs: DistrictId[]
  spawn: { x: number; y: number; z: number; yaw: number }
}

export const GALLERY_D = 6.75
export const HULL_W = 6.5

export interface HallOut {
  hulls: PlacedHull[]
  homes: HomeDef[]
  closed: ClosedDoor[]
  inward: Record<Side, { x: number; z: number }>
  roofAt(x: number, z: number): number
}

const INWARD: Record<Side, { x: number; z: number }> = { w: { x: 1, z: 0 }, e: { x: -1, z: 0 }, n: { x: 0, z: 1 }, s: { x: 0, z: -1 } }

function plane(h: HallDef, s: Side): number {
  return s === 'w' ? h.x0 : s === 'e' ? h.x1 : s === 'n' ? h.z0 : h.z1
}
function uRange(h: HallDef, s: Side): [number, number] {
  return s === 'n' || s === 's' ? [h.x0, h.x1] : [h.z0, h.z1]
}
export function wallPoint(h: HallDef, s: Side, u: number, y: number, depth: number): THREE.Vector3 {
  const p = plane(h, s)
  const n = INWARD[s]
  return s === 'n' || s === 's' ? new THREE.Vector3(u, y, p + n.z * depth) : new THREE.Vector3(p + n.x * depth, y, u)
}

function wallFrame(h: HallDef, s: Side): WallFrame {
  return { along: s === 'n' || s === 's', plane: plane(h, s), inX: INWARD[s].x, inZ: INWARD[s].z }
}

function nextLevel(h: HallDef, y: number): number {
  const all = [h.floorY, ...h.levels].sort((a, b) => a - b)
  const above = all.find((v) => v > y + 0.01)
  return above ?? h.spring
}

export function vaultY(h: HallDef, x: number, z: number): number {
  const t = h.axis === 'z' ? (x - h.x0) / (h.x1 - h.x0) : (z - h.z0) / (h.z1 - h.z0)
  return h.spring + h.rise * Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1))
}

function inSpan(list: readonly Span[], s: Side, y: number, u0: number, u1: number): boolean {
  return list.some((g) => g.side === s && Math.abs(g.y - y) < 0.5 && u1 > g.u0 && u0 < g.u1)
}

function openingHit(h: HallDef, s: Side, u0: number, u1: number, y0: number, y1: number): boolean {
  return h.openings.some((o) => o.side === s && u1 > o.u - o.w / 2 && u0 < o.u + o.w / 2 && y1 > o.y && y0 < o.y + o.h)
}

export function buildHall(k: Kit, h: HallDef): HallOut {
  const D = h.depth ?? GALLERY_D
  const hulls: PlacedHull[] = []
  const slots: DoorSlot[] = []
  const peak = h.spring + h.rise

  k.cell({
    id: h.id, district: h.district, deck: h.deck, nom: h.nom,
    boxes: [{ x0: h.x0, x1: h.x1, y0: h.floorY - 0.6, y1: peak + 0.5, z0: h.z0, z1: h.z1 }],
    spawn: h.spawn, air: h.air ?? 1, roof: peak, pvs: h.pvs, glass: true,
  })

  const sides: Side[] = ['n', 's', 'w', 'e']
  k.shelled(() => {
    buildFloor(k, h)
    for (const s of sides) buildWall(k, h, s)
    buildVault(k, h)
  })

  for (const s of sides) {
    const tiers = h.tiers[s] ?? []
    const [ua, ub] = uRange(h, s)
    const along = s === 'n' || s === 's'
    for (const ty of tiers) {
      const hh = nextLevel(h, ty) - ty - 1.6
      if (hh < 3) continue
      let u = ua + (hasPerp(h, s, ty) ? 7.4 : 2.5) + k.rand() * 2
      const uEnd = ub - (hasPerp(h, s, ty) ? 7.4 : 2.5)
      let n = 0
      while (u < uEnd - 8) {
        const keel = k.rand() < 0.68
        let len = keel ? k.pick([18, 24, 24, 32]) : k.pick([10, 14])
        if (u + len > uEnd) len = Math.floor(uEnd - u)
        if (len < 9) break
        const w = keel ? HULL_W : HULL_W - 0.4
        const blocked = openingHit(h, s, u - 1, u + len + 1, ty - 0.5, ty + hh) || inSpan(h.noHull, s, ty, u - 1, u + len + 1)
        if (!blocked) {
          const c = u + len / 2
          const cy = ty + hh * 0.3
          const p = wallPoint(h, s, c, cy, 0)
          const paint = h.paints[(n + Math.floor(k.rand() * 3)) % h.paints.length]!
          hulls.push({
            kind: keel ? 'keel' : 'barrel', district: h.district, x: p.x, y: cy, z: p.z,
            yaw: along ? Math.PI / 2 : 0, w, h: hh, l: len, paint, row: n, tier: ty, inside: true,
          })
          facade(k, h, s, u, len, ty, hh, w, keel, hulls.length - 1, slots)
          n++
        }
        u += len + 2.2 + k.rand() * 2.4
      }
    }
  }

  for (const y of h.levels) {
    for (const s of sides) {
      if (!(h.tiers[s] ?? []).includes(y)) continue
      buildGallery(k, h, s, y, D)
    }
  }

  const baked = bakeHomes(k, h, slots)
  for (const i of baked.hollow) hulls[i]!.hollow = true
  return {
    hulls,
    homes: baked.homes,
    closed: baked.closed,
    inward: INWARD,
    roofAt: (x, z) => vaultY(h, x, z),
  }
}

function hasPerp(h: HallDef, s: Side, y: number): boolean {
  const perp: Side[] = s === 'n' || s === 's' ? ['w', 'e'] : ['n', 's']
  return perp.some((p) => (h.tiers[p] ?? []).includes(y))
}

function buildFloor(k: Kit, h: HallDef): void {
  const hole = h.floorHole
  if (!hole) {
    k.slab(h.x0, h.x1, h.z0, h.z1, h.floorY, h.floor, 0.5)
    return
  }
  const T = 4
  for (let x = h.x0; x < h.x1 - 0.01; x += T) {
    for (let z = h.z0; z < h.z1 - 0.01; z += T) {
      const ex = Math.min(T, h.x1 - x)
      const ez = Math.min(T, h.z1 - z)
      const far = Math.max(Math.abs(x + ex / 2 - hole.x) - ex / 2, 0) ** 2 + Math.max(Math.abs(z + ez / 2 - hole.z) - ez / 2, 0) ** 2
      if (far < hole.r * hole.r) {
        for (let xx = x; xx < x + ex - 0.01; xx += 1) {
          for (let zz = z; zz < z + ez - 0.01; zz += 1) {
            if (Math.hypot(xx + 0.5 - hole.x, zz + 0.5 - hole.z) < hole.r + 0.5) continue
            k.slab(xx, xx + 1, zz, zz + 1, h.floorY, h.floor, 0.5)
          }
        }
      } else k.slab(x, x + ex, z, z + ez, h.floorY, h.floor, 0.5)
    }
  }
  const segs = 40
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2
    const a1 = ((i + 1) / segs) * Math.PI * 2
    const r = hole.r + 0.5
    k.beam(hole.x + Math.cos(a0) * r, h.floorY + 0.06, hole.z + Math.sin(a0) * r, hole.x + Math.cos(a1) * r, h.floorY + 0.06, hole.z + Math.sin(a1) * r, 0.14, C(PAL.laiton, 0.95))
  }
}

function buildWall(k: Kit, h: HallDef, s: Side): void {
  const [ua, ub] = uRange(h, s)
  const gable = (h.axis === 'z' && (s === 'n' || s === 's')) || (h.axis === 'x' && (s === 'w' || s === 'e'))
  const midU = (ua + ub) / 2
  const oc = h.oculus !== false && gable ? { u: midU, y: h.spring + h.rise * 0.42, r: Math.min(h.rise * 0.4, (ub - ua) * 0.16) } : null
  const T = 2
  const along = s === 'n' || s === 's'
  const wallC = new THREE.Color(h.wall)
  const skin = new THREE.Color(DISTRICT_BY_ID[h.district].accent).multiplyScalar(0.78).lerp(new THREE.Color(PAL.teal), 0.18)
  const keel = new THREE.Color(DISTRICT_BY_ID[h.district].accent).multiplyScalar(0.55).lerp(new THREE.Color(PAL.rouille), 0.25)
  const tiers = [h.floorY, ...h.levels]
  const lit = [0xffd9a0, 0xffc27a, 0xffe2b8]
  let row = 0
  for (let y = h.floorY - 1; y < (gable ? h.spring + h.rise : h.spring) - 0.01; y += T, row++) {
    const cy = y + T / 2
    const low = cy < h.floorY + 2
    const band = row % 3 === 2
    const plaster = wallC.clone().multiplyScalar(low ? 0.8 : 0.94 + (row % 2) * 0.03)
    const sk = (low ? keel : skin).clone().multiplyScalar(0.94 + (row % 2) * 0.05)
    let runStart: number | null = null
    const flush = (u1: number) => {
      if (runStart === null) return
      const len = u1 - runStart
      const um = (runStart + u1) / 2
      const c = wallPoint(h, s, um, cy, -0.2)
      k.cols.push({ kind: 'wall', climbable: true, x: c.x, y: c.y, z: c.z, hx: along ? len / 2 : 0.25, hy: T / 2, hz: along ? 0.25 : len / 2 })
      const hgt = T
      const ch = cy
      const ci = wallPoint(h, s, um, ch, -0.2)
      k.b.with(SURF.plaster, () => {
        if (along) k.b.box(ci.x, ci.y, ci.z, len, hgt, 0.4, plaster)
        else k.b.box(ci.x, ci.y, ci.z, 0.4, hgt, len, plaster)
      })
      const o = wallPoint(h, s, um, ch, -0.45)
      k.skin.with(SURF.hull, () => {
        if (along) k.skin.box(o.x, o.y, o.z, len + 0.02, hgt + 0.02, 0.1, sk)
        else k.skin.box(o.x, o.y, o.z, 0.1, hgt + 0.02, len + 0.02, sk)
      })
      if (band) {
        const bt = wallPoint(h, s, um, y + hgt - 0.12, -0.52)
        k.skin.with(SURF.brass, () => {
          if (along) k.skin.box(bt.x, bt.y, bt.z, len + 0.02, 0.24, 0.06, C(PAL.laiton, 0.7))
          else k.skin.box(bt.x, bt.y, bt.z, 0.06, 0.24, len + 0.02, C(PAL.laiton, 0.7))
        })
      }
      runStart = null
    }
    for (let u = ua; u < ub - 0.01; u += T) {
      const eu = Math.min(T, ub - u)
      const cu = u + eu / 2
      const top = gable && y + T > h.spring ? THREE.MathUtils.lerp(h.spring, h.spring + h.rise, Math.sin(Math.PI * (cu - ua) / (ub - ua))) : h.spring
      const skip = cy > top || openingHit(h, s, u + 0.05, u + eu - 0.05, y + 0.05, y + T - 0.05) || (oc && Math.hypot(cu - oc.u, cy - oc.y) < oc.r + 0.2)
      if (skip) {
        flush(u)
        continue
      }
      if (runStart === null) runStart = u
      if (!band && !low && tiers.some((ty) => Math.abs(cy - (ty + 2.6)) < 1.01) && Math.round(u / T) % 2 === 0) {
        const wpt = wallPoint(h, s, cu, cy, -0.52)
        const on = k.rand() < 0.7
        const tgt = on ? k.e : k.skin
        const lc = on ? C(k.pick(lit), 0.95) : C(PAL.interieurOmbre)
        if (along) tgt.box(wpt.x, wpt.y, wpt.z, 0.7, 0.9, 0.04, lc)
        else tgt.box(wpt.x, wpt.y, wpt.z, 0.04, 0.9, 0.7, lc)
        const sill = wallPoint(h, s, cu, cy - 0.5, -0.56)
        if (along) k.skin.box(sill.x, sill.y, sill.z, 0.9, 0.08, 0.1, C(PAL.laiton, 0.75))
        else k.skin.box(sill.x, sill.y, sill.z, 0.1, 0.08, 0.9, C(PAL.laiton, 0.75))
        const hood = wallPoint(h, s, cu, cy + 0.52, -0.6)
        if (along) k.skin.box(hood.x, hood.y, hood.z, 0.86, 0.06, 0.18, C(PAL.boisOmbre))
        else k.skin.box(hood.x, hood.y, hood.z, 0.18, 0.06, 0.86, C(PAL.boisOmbre))
      }
    }
    flush(ub)
  }
  for (let u = ua + 2; u < ub - 1; u += 4) {
    let y0 = h.floorY
    const yTop = gable ? THREE.MathUtils.lerp(h.spring, h.spring + h.rise, Math.sin(Math.PI * (u - ua) / (ub - ua))) - 0.2 : h.spring
    const ys: number[] = []
    for (let y = h.floorY; y < yTop; y += 0.5) ys.push(y)
    const segs: [number, number][] = []
    for (const y of ys) {
      const blocked = openingHit(h, s, u - 0.2, u + 0.2, y, y + 0.5) || (oc && Math.hypot(u - oc.u, y - oc.y) < oc.r + 0.3)
      if (blocked) {
        if (y > y0 + 0.4) segs.push([y0, y])
        y0 = y + 0.5
      }
    }
    if (yTop > y0 + 0.4) segs.push([y0, yTop])
    for (const [a, b] of segs) {
      const pa = wallPoint(h, s, u, a, 0.12)
      const pb = wallPoint(h, s, u, b, 0.12)
      k.beam(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 0.24, C(PAL.laiton, 0.75))
      const pc = wallPoint(h, s, u, (a + b) / 2, 0.15)
      k.cols.push({ kind: 'rib', climbable: true, x: pc.x, y: pc.y, z: pc.z, hx: along ? 0.12 : 0.15, hy: (b - a) / 2, hz: along ? 0.15 : 0.12 })
      if (Math.round((u - ua - 2) / 4) % 2 === 1) continue
      const qa = wallPoint(h, s, u, a, -0.55)
      const qb = wallPoint(h, s, u, b, -0.55)
      k.beam(qa.x, qa.y, qa.z, qb.x, qb.y, qb.z, 0.28, C(DISTRICT_BY_ID[h.district].accent, 0.45).lerp(C(PAL.boisOmbre), 0.5), k.skin)
    }
  }
  if (oc) {
    const c = wallPoint(h, s, oc.u, oc.y, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(along ? 0 : 1, 0, along ? 1 : 0))
    const m = new THREE.Matrix4().compose(c, q, new THREE.Vector3(oc.r, oc.r, 1))
    k.glass.add(DISC, m, C(0x9fd6d0))
    const ring = new THREE.TorusGeometry(1, 0.035, 6, 48)
    k.b.add(ring, m, C(PAL.laiton, 1.05))
    k.b.add(new THREE.TorusGeometry(0.55, 0.03, 6, 36), m, C(PAL.laiton))
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const a1 = wallPoint(h, s, oc.u + Math.cos(a) * oc.r * 0.15, oc.y + Math.sin(a) * oc.r * 0.15, 0)
      const a2 = wallPoint(h, s, oc.u + Math.cos(a) * oc.r, oc.y + Math.sin(a) * oc.r, 0)
      k.beam(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, 0.08, C(PAL.laiton, 0.9))
    }
    k.cols.push({ kind: 'glass', climbable: false, x: c.x, y: c.y, z: c.z, hx: along ? oc.r : 0.2, hy: oc.r, hz: along ? 0.2 : oc.r })
    const cIn = wallPoint(h, s, oc.u, oc.y - oc.r * 0.3, 6)
    k.lamps.push({ x: cIn.x, y: cIn.y, z: cIn.z, color: 0x9fd6d0, radius: Math.max(14, oc.r * 3), live: false, bake: 0.55 })
  }
}

const DISC = new THREE.CircleGeometry(1, 40)

function buildVault(k: Kit, h: HallDef): void {
  const N = 14
  const alongZ = h.axis === 'z'
  const span = alongZ ? [h.x0, h.x1] : [h.z0, h.z1]
  const len = alongZ ? [h.z0, h.z1] : [h.x0, h.x1]
  const pt = (t: number, l: number) => {
    const a = span[0]! + (span[1]! - span[0]!) * t
    const y = h.spring + h.rise * Math.sin(Math.PI * t)
    return alongZ ? new THREE.Vector3(a, y, l) : new THREE.Vector3(l, y, a)
  }
  const iron = C(0x5a4a5e, 1.1)
  const brass = C(PAL.laiton, 0.9)
  for (let l = len[0]!; l <= len[1]! + 0.01; l += 6) {
    for (let i = 0; i < N; i++) {
      const a = pt(i / N, l)
      const b = pt((i + 1) / N, l)
      k.beam(a.x, a.y, a.z, b.x, b.y, b.z, 0.28, iron)
      if (i % 3 === 1) {
        const c = pt((i + 0.5) / N, l)
        k.beam(c.x, c.y, c.z, c.x, c.y - 0.5, c.z, 0.08, brass)
      }
    }
  }
  for (let i = 0; i <= N; i++) {
    const a = pt(i / N, len[0]!)
    const b = pt(i / N, len[1]!)
    k.beam(a.x, a.y, a.z, b.x, b.y, b.z, i % 2 === 0 ? 0.16 : 0.1, i % 2 === 0 ? iron : brass)
  }
  for (let i = 0; i < N; i++) {
    const a0 = pt(i / N, len[0]!)
    const a1 = pt((i + 1) / N, len[0]!)
    const b0 = pt(i / N, len[1]!)
    const b1 = pt((i + 1) / N, len[1]!)
    quad(k, a0, a1, b1, b0, C(0x9fd6d0))
  }
}

function quad(k: Kit, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color): void {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.computeVertexNormals()
  k.glass.add(g, new THREE.Matrix4(), color)
}

function buildGallery(k: Kit, h: HallDef, s: Side, y: number, D: number): void {
  const [ua0, ub0] = uRange(h, s)
  const along = s === 'n' || s === 's'
  const perp: Side[] = along ? ['w', 'e'] : ['n', 's']
  const cutA = !along && (h.tiers[perp[0]!] ?? []).includes(y)
  const cutB = !along && (h.tiers[perp[1]!] ?? []).includes(y)
  const ua = cutA ? ua0 + D : ua0
  const ub = cutB ? ub0 - D : ub0
  const segs: [number, number][] = [[ua, ub]]
  for (const g of h.noGallery) {
    if (g.side !== s || Math.abs(g.y - y) > 0.5) continue
    for (let i = segs.length - 1; i >= 0; i--) {
      const [a, b] = segs[i]!
      if (g.u1 <= a || g.u0 >= b) continue
      segs.splice(i, 1)
      if (g.u0 > a) segs.push([a, g.u0])
      if (g.u1 < b) segs.push([g.u1, b])
    }
  }
  const p0 = plane(h, s)
  const n = INWARD[s]
  for (const [a, b] of segs) {
    if (b - a < 0.5) continue
    const d0 = p0
    const d1 = p0 + (along ? n.z : n.x) * D
    if (along) k.slab(a, b, Math.min(d0, d1), Math.max(d0, d1), y, 'bois', 0.36)
    else k.slab(Math.min(d0, d1), Math.max(d0, d1), a, b, y, 'bois', 0.36)
    {
      const fa = wallPoint(h, s, a, y - 0.26, D + 0.03)
      const fb = wallPoint(h, s, b, y - 0.26, D + 0.03)
      const mid = fa.clone().add(fb).multiplyScalar(0.5)
      const L = b - a
      const paint = C(h.paints[Math.floor(Math.abs(a + y) * 7) % h.paints.length]!, 0.82)
      const sc = (len: number, hgt: number, t: number) => new THREE.Vector3(along ? len : t, hgt, along ? t : len)
      k.b.with(SURF.planksX, () => k.b.add(FASCIA, new THREE.Matrix4().compose(mid, new THREE.Quaternion(), sc(L, 0.46, 0.08)), paint))
      k.b.add(FASCIA, new THREE.Matrix4().compose(mid.clone().setY(y - 0.07), new THREE.Quaternion(), sc(L, 0.05, 0.1)), C(PAL.creme, 0.85))
      k.b.add(FASCIA, new THREE.Matrix4().compose(mid.clone().setY(y - 0.47), new THREE.Quaternion(), sc(L, 0.04, 0.1)), C(PAL.laiton, 0.85))
      const nIn = new THREE.Vector3(along ? 0 : INWARD[s].x, 0, along ? INWARD[s].z : 0)
      const qf = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nIn)
      const flap = [C(PAL.creme, 0.9), paint.clone().multiplyScalar(1.12)]
      let i = 0
      for (let u = a + 0.3; u < b - 0.2; u += 0.62) {
        const p = wallPoint(h, s, u, y - 0.5, D + 0.075)
        k.cloth.add(SCALLOP, new THREE.Matrix4().compose(p, qf, new THREE.Vector3(0.3, 0.2, 1)), flap[i++ % 2]!)
      }
      for (let u = a + 2.2; u < b - 1.5; u += 6.5) {
        const p = wallPoint(h, s, u, y + 1.0, D + 0.18)
        k.b.box(p.x, p.y, p.z, along ? 1.0 : 0.26, 0.2, along ? 0.26 : 1.0, C(PAL.bois, 0.85))
        for (let f = 0; f < 4; f++) {
          const o = (f - 1.5) * 0.24
          k.b.sphere(p.x + (along ? o : 0), p.y + 0.18, p.z + (along ? 0 : o), 0.14, 0.16, 0.14, C(k.pick([0x7fa86a, 0x5e8f5a, PAL.tissu1, PAL.tissu2, 0x8fbf6a])))
        }
      }
    }
    for (let u = a + 1; u < b; u += 2.2) {
      const pa = wallPoint(h, s, u, y - 0.45, 0.2)
      const pb = wallPoint(h, s, u, y - 0.45, D - 0.1)
      k.beam(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 0.22, C(PAL.boisOmbre, 1.15))
    }
    for (let u = a + 3; u < b - 1; u += 9) {
      const pa = wallPoint(h, s, u, y - 2.6, 0.3)
      const pb = wallPoint(h, s, u, y - 0.4, D * 0.55)
      k.beam(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 0.16, C(PAL.laiton, 0.8))
    }
    const edgeGaps = h.railGaps.filter((g) => g.side === s && Math.abs(g.y - y) < 0.5).map((g) => [g.u0, g.u1] as [number, number])
    const fixed = p0 + (along ? n.z : n.x) * D
    const galA = (h.tiers[perp[0]!] ?? []).includes(y)
    const galB = (h.tiers[perp[1]!] ?? []).includes(y)
    const railLo = along && galA ? Math.max(a, ua0 + D) : a
    const railHi = along && galB ? Math.min(b, ub0 - D) : b
    k.railRun(along ? 'x' : 'z', fixed, railLo, railHi, y, edgeGaps)
    for (const [end, natural] of [[a, ua], [b, ub]] as const) {
      if (Math.abs(end - natural) < 0.01) continue
      const pa = wallPoint(h, s, end, y, 0.3)
      const pb = wallPoint(h, s, end, y, D)
      k.rail(pa.x, pa.z, pb.x, pb.z, y)
    }
    for (let u = a + 4.5; u < b - 2; u += 9) {
      if (edgeGaps.some(([g0, g1]) => u > g0 - 0.6 && u < g1 + 0.6)) continue
      const p = wallPoint(h, s, u, y + 2.05, D - 0.05)
      k.b.box(p.x, y + 1.05, p.z, 0.08, 2.1, 0.08, C(PAL.laiton, 0.8))
      k.lamp(p.x, p.y, p.z, { radius: 9, bake: 1.0, style: 'cage', color: k.rand() < 0.25 ? PAL.lampeChaude : PAL.lampe })
    }
    if (k.rand() < 0.8) {
      const u = a + (b - a) * (0.2 + k.rand() * 0.6)
      const pa = wallPoint(h, s, u, y + 3.6, D - 0.1)
      const pb = wallPoint(h, s, u + 5 + k.rand() * 4, y + 3.4, D - 0.1)
      k.laundry(pa, pb, 0.35)
    }
  }
}

function facade(k: Kit, h: HallDef, s: Side, u: number, len: number, ty: number, hh: number, w: number, keel: boolean, hull: number, slots: DoorSlot[]): void {
  const cy = ty + hh * 0.3
  const frame = wallFrame(h, s)
  const reachable = ty === h.floorY || h.levels.includes(ty)
  const face = (y: number) => {
    const r = (y - cy) / (hh / 2)
    return (w / 2) * Math.sqrt(Math.max(0, 1 - r * r))
  }
  const along = s === 'n' || s === 's'
  const lit = [0xffd9a0, 0xffc27a, 0xffe2b8, 0xfff0d0]
  const doors = len >= 22 ? 2 : 1
  for (let i = 0; i < doors; i++) {
    const du = u + len * ((i + 0.5) / doors) + (k.rand() - 0.5) * 2
    const off = face(ty + 1.0) + 0.03
    slots.push({ hull, frame, u: du, floor: ty, reachable, hullU0: u, hullU1: u + len, cy, hh, w })
    const lp = wallPoint(h, s, du + 0.85, ty + 2.35, face(ty + 2.35) + 0.25)
    k.e.sphere(lp.x, lp.y, lp.z, 0.09, 0.11, 0.09, C(PAL.lampe, 1.6))
    k.lamps.push({ x: lp.x, y: lp.y, z: lp.z, color: PAL.lampe, radius: 4.5, live: false, bake: 0.5 })
    const step = wallPoint(h, s, du, ty + 0.06, off + 0.35)
    k.b.box(step.x, step.y, step.z, along ? 1.4 : 0.7, 0.12, along ? 0.7 : 1.4, C(PAL.boisOmbre, 1.2))
    if (k.rand() < 0.6) k.plant(step.x + (along ? 0.9 : 0), ty, step.z + (along ? 0 : 0.9), 0.8)
  }
  const rows = hh > 5 ? [ty + 2.7, ty + 4.0] : [ty + 2.4]
  rows.forEach((wy, ri) => {
    const off = face(wy) + 0.02
    for (let wu = u + 1.4; wu < u + len - 1.2; wu += 2.6 + ri * 0.4) {
      const p = wallPoint(h, s, wu, wy, off)
      const on = k.rand() < 0.4
      const rr = keel ? 0.3 : 0.26
      const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(along ? 0 : INWARD[s].x, 0, along ? INWARD[s].z : 0)), new THREE.Vector3(rr, rr, 1))
      if (on) k.nightLit.add(DISC_SMALL, m, C(k.pick(lit), 0.95 + k.rand() * 0.2))
      else k.b.add(DISC_SMALL, m, C(0x2e3c44))
      k.b.add(RING_SMALL, m, C(PAL.laiton, 1.0))
      if (ri === 0 && k.rand() < 0.18) {
        const bp = wallPoint(h, s, wu, wy - 0.42, off + 0.15)
        k.b.box(bp.x, bp.y, bp.z, along ? 0.7 : 0.25, 0.18, along ? 0.25 : 0.7, C(PAL.bois))
        for (let f = 0; f < 3; f++) k.b.sphere(bp.x + (along ? (f - 1) * 0.2 : 0), bp.y + 0.16, bp.z + (along ? 0 : (f - 1) * 0.2), 0.1, 0.1, 0.1, C(k.pick([PAL.tissu1, PAL.tissu2, 0x8fbf6a, PAL.blanc])))
      }
    }
  })
  const top = wallPoint(h, s, u + len / 2, ty + hh * 0.8 - 0.2, 0.2)
  if (k.rand() < 0.4) k.b.cyl(top.x, top.y + 0.8, top.z, 0.12, 1.6, C(PAL.metalSombre))
}

const DISC_SMALL = new THREE.CircleGeometry(1, 14)
const FASCIA = new THREE.BoxGeometry(1, 1, 1)
const SCALLOP = new THREE.CircleGeometry(1, 7, Math.PI, Math.PI)
const RING_SMALL = new THREE.TorusGeometry(1.08, 0.12, 4, 14)
