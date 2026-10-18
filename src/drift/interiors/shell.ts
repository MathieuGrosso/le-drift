import * as THREE from 'three'
import { GeoBuilder, UNIT } from '../builder'
import { PAL } from '../palette'
import { SURF } from '../surface'
import {
  LINKS, PARTS, PORTHOLES, PORTHOLE_D, RECT_WINDOWS, WALL_T, partById,
  type PartDef, type Side,
} from './layout'
import type { ColliderSpec, DoorDef, PaneDef } from './types'

interface Hole { u0: number; u1: number; v0: number; v1: number }
interface Rect { u0: number; u1: number; v0: number; v1: number }

const OPP: Record<Side, Side> = { n: 's', s: 'n', w: 'e', e: 'w' }

export function panelRects(u0: number, u1: number, v0: number, v1: number, holes: Hole[]): Rect[] {
  const cuts = new Set<number>([u0, u1])
  for (const h of holes) {
    if (h.u1 <= u0 || h.u0 >= u1) continue
    cuts.add(Math.max(u0, h.u0))
    cuts.add(Math.min(u1, h.u1))
  }
  const us = [...cuts].sort((a, b) => a - b)
  const out: Rect[] = []
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i]!
    const b = us[i + 1]!
    if (b - a < 1e-4) continue
    const covering = holes
      .filter((h) => h.u0 <= a + 1e-4 && h.u1 >= b - 1e-4)
      .map((h) => [Math.max(v0, h.v0), Math.min(v1, h.v1)] as const)
      .filter(([x, y]) => y > x)
      .sort((p, q) => p[0] - q[0])
    let v = v0
    for (const [h0, h1] of covering) {
      if (h0 > v + 1e-4) out.push({ u0: a, u1: b, v0: v, v1: h0 })
      v = Math.max(v, h1)
    }
    if (v1 > v + 1e-4) out.push({ u0: a, u1: b, v0: v, v1 })
  }
  return out
}

export interface WallFrame {
  axisU: 'x' | 'z'
  u0: number; u1: number
  plane: number
  inward: THREE.Vector3
}

export function wallFrame(p: PartDef, side: Side): WallFrame {
  const T = WALL_T
  switch (side) {
    case 'n': return { axisU: 'x', u0: p.x0, u1: p.x1, plane: p.z0 + T / 2, inward: new THREE.Vector3(0, 0, 1) }
    case 's': return { axisU: 'x', u0: p.x0, u1: p.x1, plane: p.z1 - T / 2, inward: new THREE.Vector3(0, 0, -1) }
    case 'w': return { axisU: 'z', u0: p.z0 + T, u1: p.z1 - T, plane: p.x0 + T / 2, inward: new THREE.Vector3(1, 0, 0) }
    case 'e': return { axisU: 'z', u0: p.z0 + T, u1: p.z1 - T, plane: p.x1 - T / 2, inward: new THREE.Vector3(-1, 0, 0) }
  }
}

export function wallPoint(f: WallFrame, u: number, y: number, depth = 0): THREE.Vector3 {
  const d = f.plane + (f.axisU === 'x' ? f.inward.z : f.inward.x) * depth
  return f.axisU === 'x' ? new THREE.Vector3(u, y, d) : new THREE.Vector3(d, y, u)
}

function isGable(p: PartDef, side: Side): boolean {
  if (p.roof !== 'arch') return false
  return p.axis === 'x' ? side === 'w' || side === 'e' : side === 'n' || side === 's'
}

export interface ShellOut {
  colliders: ColliderSpec[]
  doors: DoorDef[]
  panes: PaneDef[]
}

export function holesFor(p: PartDef, side: Side): { holes: Hole[]; portholes: { u: number; y: number; idx: number }[]; rects: { id: string; u: number; y0: number; w: number; h: number }[] } {
  const holes: Hole[] = []
  const portholes: { u: number; y: number; idx: number }[] = []
  const rects: { id: string; u: number; y0: number; w: number; h: number }[] = []
  for (const l of LINKS) {
    const mine = (l.a === p.id && l.side === side) || (l.b === p.id && OPP[l.side] === side)
    if (!mine) continue
    holes.push({ u0: l.at - l.width / 2, u1: l.at + l.width / 2, v0: p.floorY, v1: p.floorY + l.height })
  }
  PORTHOLES.forEach((h, idx) => {
    if (h.part !== p.id || h.side !== side) return
    const r = PORTHOLE_D / 2
    holes.push({ u0: h.at - r, u1: h.at + r, v0: p.floorY + h.y - r, v1: p.floorY + h.y + r })
    portholes.push({ u: h.at, y: p.floorY + h.y, idx })
  })
  for (const w of RECT_WINDOWS) {
    if (w.part !== p.id || w.side !== side) continue
    holes.push({ u0: w.at - w.w / 2, u1: w.at + w.w / 2, v0: p.floorY + w.y0, v1: p.floorY + w.y0 + w.h })
    rects.push({ id: w.id, u: w.at, y0: p.floorY + w.y0, w: w.w, h: w.h })
  }
  return { holes, portholes, rects }
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _v = new THREE.Vector3()

function quatFromBasis(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

const porthPlate = (() => {
  const s = new THREE.Shape()
  const r = PORTHOLE_D / 2
  s.moveTo(-r, -r)
  s.lineTo(r, -r)
  s.lineTo(r, r)
  s.lineTo(-r, r)
  s.lineTo(-r, -r)
  const hole = new THREE.Path()
  hole.absarc(0, 0, r * 0.86, 0, Math.PI * 2, true)
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, { depth: WALL_T, bevelEnabled: false, curveSegments: 16 })
  g.translate(0, 0, -WALL_T / 2)
  return g
})()
const ringGeo = new THREE.TorusGeometry(PORTHOLE_D * 0.43, 0.035, 6, 20)
const boltGeo = new THREE.SphereGeometry(0.022, 6, 4)
const archGeo = new THREE.CylinderGeometry(1, 1, 1, 22, 1, true, -Math.PI / 2, Math.PI)
const ribGeo = new THREE.TorusGeometry(1, 0.06, 5, 22, Math.PI)
const RIB = 0x7e5a4a
const gableGeo = (() => {
  const s = new THREE.Shape()
  s.moveTo(-1, 0)
  s.absellipse(0, 0, 1, 1, Math.PI, 0, true, 0)
  s.lineTo(-1, 0)
  return new THREE.ShapeGeometry(s, 18)
})()

const SEA_TEAL = new THREE.Color(PAL.teal)
const outerHull = (hex: number) => new THREE.Color(hex).offsetHSL(0, -0.28, -0.06).lerp(SEA_TEAL, 0.3)

export function buildShell(p: PartDef, b: GeoBuilder, out: ShellOut): void {
  const T = WALL_T
  const cx = (p.x0 + p.x1) / 2
  const cz = (p.z0 + p.z1) / 2
  const fy = p.floorY
  const top = fy + p.wallH
  const inner = (n: THREE.Vector3, at: THREE.Vector3) => {
    _v.set(cx - at.x, 0, cz - at.z)
    return n.x * _v.x + n.z * _v.z
  }
  const wallColor = (pp: THREE.Vector3, n: THREE.Vector3) => {
    if (Math.abs(n.y) > 0.5) return outerHull(p.hull).multiplyScalar(0.8)
    const d = inner(n, pp)
    if (d > 0.05) return new THREE.Color(pp.y < fy + 1.0 + 1e-3 ? p.wainscot : p.wall)
    return outerHull(p.hull)
  }

  const metal = p.wall === PAL.bleuDoux || p.wall === PAL.metal
  b.patFn = (pp, n) => {
    if (Math.abs(n.y) > 0.5) return SURF.paint
    if (inner(n, pp) <= 0.05) return SURF.hull
    if (metal) return SURF.steel
    return pp.y < fy + 1.0 + 1e-3 ? SURF.boards : SURF.plaster
  }
  if (p.floor !== 'none') {
    b.box(cx, fy - 0.15, cz, p.x1 - p.x0, 0.3, p.z1 - p.z0, (_pp, n) => n.y > 0.5 ? new THREE.Color(PAL.boisOmbre) : outerHull(p.hull))
    out.colliders.push({ part: p.id, kind: 'interior', climbable: false, hx: (p.x1 - p.x0) / 2, hy: 0.15, hz: (p.z1 - p.z0) / 2, x: cx, y: fy - 0.15, z: cz })
  }

  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    const f = wallFrame(p, side)
    const { holes, portholes, rects } = holesFor(p, side)
    const rectsAll = panelRects(f.u0, f.u1, fy, top, holes)
    for (const r of rectsAll) {
      const um = (r.u0 + r.u1) / 2
      const pieces = r.v0 < fy + 1.0 && r.v1 > fy + 1.0 ? [[r.v0, fy + 1.0], [fy + 1.0, r.v1]] : [[r.v0, r.v1]]
      for (const [v0, v1] of pieces) {
        const c = wallPoint(f, um, (v0! + v1!) / 2)
        if (f.axisU === 'x') b.box(c.x, c.y, c.z, r.u1 - r.u0, v1! - v0!, T, wallColor)
        else b.box(c.x, c.y, c.z, T, v1! - v0!, r.u1 - r.u0, wallColor)
      }
      const c = wallPoint(f, um, (r.v0 + r.v1) / 2)
      out.colliders.push({
        part: p.id, kind: 'interior', climbable: false,
        hx: f.axisU === 'x' ? (r.u1 - r.u0) / 2 : T / 2, hy: (r.v1 - r.v0) / 2, hz: f.axisU === 'x' ? T / 2 : (r.u1 - r.u0) / 2,
        x: c.x, y: c.y, z: c.z,
      })
    }
    const outward = f.inward.clone().negate()
    const up = new THREE.Vector3(0, 1, 0)
    for (const ph of portholes) {
      const c = wallPoint(f, ph.u, ph.y)
      const q = quatFromBasis(new THREE.Vector3().crossVectors(up, outward), up, outward)
      b.add(porthPlate, _m.compose(c, q, _s.set(1, 1, 1)), wallColor)
      const ci = wallPoint(f, ph.u, ph.y, T / 2 + 0.01)
      b.add(ringGeo, _m.compose(ci, q, _s.set(1, 1, 1)), PAL.laiton)
      const co = wallPoint(f, ph.u, ph.y, -T / 2 - 0.01)
      b.add(ringGeo, _m.compose(co, q, _s.set(1, 1, 1)), PAL.laiton)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8
        const bp = wallPoint(f, ph.u + Math.cos(a) * PORTHOLE_D * 0.47, ph.y + Math.sin(a) * PORTHOLE_D * 0.47, T / 2 + 0.008)
        b.add(boltGeo, _m.compose(bp, q, _s.set(1, 1, 1)), 0xb08a62)
      }
      const def = PORTHOLES[ph.idx]!
      const id = `hublot-${def.part}-${PORTHOLES.filter((q2, j) => q2.part === def.part && j < ph.idx).length + 1}`
      out.panes.push({ id, part: p.id, shape: 'round', x: c.x, y: c.y, z: c.z, nx: outward.x, nz: outward.z, w: PORTHOLE_D * 0.88, h: PORTHOLE_D * 0.88 })
      out.colliders.push({
        part: p.id, kind: 'window', climbable: false, ownerId: id,
        hx: f.axisU === 'x' ? PORTHOLE_D / 2 : 0.04, hy: PORTHOLE_D / 2, hz: f.axisU === 'x' ? 0.04 : PORTHOLE_D / 2,
        x: c.x, y: c.y, z: c.z,
      })
    }
    for (const w of rects) {
      const c = wallPoint(f, w.u, w.y0 + w.h / 2)
      const fr = 0.12
      const addBar = (u: number, y: number, su: number, sy: number) => {
        const pc = wallPoint(f, u, y)
        if (f.axisU === 'x') b.box(pc.x, pc.y, pc.z, su, sy, T + 0.06, PAL.laiton)
        else b.box(pc.x, pc.y, pc.z, T + 0.06, sy, su, PAL.laiton)
      }
      addBar(w.u, w.y0 - fr / 2, w.w + fr * 2, fr)
      addBar(w.u, w.y0 + w.h + fr / 2, w.w + fr * 2, fr)
      addBar(w.u - w.w / 2 - fr / 2, w.y0 + w.h / 2, fr, w.h)
      addBar(w.u + w.w / 2 + fr / 2, w.y0 + w.h / 2, fr, w.h)
      const n = Math.max(1, Math.round(w.w / 2))
      for (let i = 1; i < n; i++) addBar(w.u - w.w / 2 + (i * w.w) / n, w.y0 + w.h / 2, 0.06, w.h)
      if (w.h > 2.5) addBar(w.u, w.y0 + w.h * 0.62, w.w, 0.06)
      out.panes.push({ id: w.id, part: p.id, shape: 'rect', x: c.x, y: c.y, z: c.z, nx: outward.x, nz: outward.z, w: w.w, h: w.h })
      out.colliders.push({
        part: p.id, kind: 'window', climbable: false, ownerId: w.id,
        hx: f.axisU === 'x' ? w.w / 2 : 0.05, hy: w.h / 2, hz: f.axisU === 'x' ? 0.05 : w.w / 2,
        x: c.x, y: c.y, z: c.z,
      })
    }
    for (const l of LINKS) {
      if (!l.door || l.a !== p.id || l.side !== side) continue
      out.doors.push({
        id: l.door, part: p.id, kind: 'wall', side, at: l.at, width: l.width, height: l.height, y: fy, plane: f.plane,
        inward: 1,
      })
      const fr = 0.1
      const bar = (u: number, y: number, su: number, sy: number) => {
        const pc = wallPoint(f, u, y)
        if (f.axisU === 'x') b.box(pc.x, pc.y, pc.z, su, sy, T + 0.08, PAL.laiton)
        else b.box(pc.x, pc.y, pc.z, T + 0.08, sy, su, PAL.laiton)
      }
      bar(l.at - l.width / 2 - fr / 2, fy + l.height / 2, fr, l.height)
      bar(l.at + l.width / 2 + fr / 2, fy + l.height / 2, fr, l.height)
      bar(l.at, fy + l.height + fr / 2, l.width + fr * 2, fr)
    }
    b.patFn = null
    buildTrims(p, f, holes, b, metal)
    if (isGable(p, side)) buildGable(p, side, b, out)
    b.patFn = (pp, n) => {
      if (Math.abs(n.y) > 0.5) return SURF.paint
      if (inner(n, pp) <= 0.05) return SURF.hull
      if (metal) return SURF.steel
      return pp.y < fy + 1.0 + 1e-3 ? SURF.boards : SURF.plaster
    }
  }
  b.patFn = null

  if (p.roof === 'flat') {
    const holes = p.roofHole ? [{ u0: p.roofHole.x0, u1: p.roofHole.x1, v0: p.roofHole.z0, v1: p.roofHole.z1 }] : []
    for (const r of panelRects(p.x0, p.x1, p.z0, p.z1, holes)) {
      const x = (r.u0 + r.u1) / 2
      const z = (r.v0 + r.v1) / 2
      b.box(x, top + T / 2, z, r.u1 - r.u0, T, r.v1 - r.v0, (_pp, n) => n.y < -0.5 ? new THREE.Color(p.wall) : outerHull(p.hull))
      out.colliders.push({ part: p.id, kind: 'hull', climbable: true, hx: (r.u1 - r.u0) / 2, hy: T / 2, hz: (r.v1 - r.v0) / 2, x, y: top + T / 2, z })
    }
    if (p.roofHole) {
      const h = p.roofHole
      const hx = (h.x0 + h.x1) / 2
      const hz = (h.z0 + h.z1) / 2
      b.add(ringGeo, _m.compose(_v.set(hx, top + T + 0.02, hz), _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), _s.set(1.5, 1.5, 1.5)), PAL.laiton)
      out.doors.push({
        id: p.id === 'sas' ? 'toit-interieure' : 'toit-exterieure', part: p.id, kind: 'floor', at: hz,
        width: h.x1 - h.x0, height: h.z1 - h.z0, y: top + T / 2, plane: h.x1, inward: 1,
      })
    }
  } else {
    buildArch(p, b, out)
  }
}

function archFrame(p: PartDef): { axisDir: THREE.Vector3; across: THREE.Vector3; center: THREE.Vector3; W: number; L: number } {
  const up = new THREE.Vector3(0, 1, 0)
  const axisDir = p.axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
  const across = new THREE.Vector3().crossVectors(axisDir, up)
  const W = p.axis === 'x' ? p.z1 - p.z0 : p.x1 - p.x0
  const L = p.axis === 'x' ? p.x1 - p.x0 : p.z1 - p.z0
  const center = new THREE.Vector3((p.x0 + p.x1) / 2, p.floorY + p.wallH, (p.z0 + p.z1) / 2)
  return { axisDir, across, center, W, L }
}

function buildArch(p: PartDef, b: GeoBuilder, out: ShellOut): void {
  const T = WALL_T
  const up = new THREE.Vector3(0, 1, 0)
  const { axisDir, across, center, W, L } = archFrame(p)
  const B = new THREE.Matrix4().makeBasis(across, axisDir, up)
  const outer = new THREE.Matrix4().copy(B).multiply(new THREE.Matrix4().makeScale(W / 2, L, p.archH + T))
  outer.setPosition(center)
  b.pat = SURF.hull
  b.add(archGeo, outer, outerHull(p.hull))
  b.pat = p.wall === PAL.bleuDoux || p.wall === PAL.metal ? SURF.steel : SURF.plaster
  const innerM = new THREE.Matrix4().copy(B).multiply(new THREE.Matrix4().makeScale(W / 2 - T, L - 2 * T, p.archH))
  innerM.setPosition(center)
  b.add(archGeo, innerM, p.wall, true)
  const ribs = Math.max(2, Math.floor(L / 1.6))
  const rb = new THREE.Matrix4().makeBasis(across, up, new THREE.Vector3().crossVectors(across, up))
  for (let i = 1; i < ribs; i++) {
    const pos = center.clone().addScaledVector(axisDir, -L / 2 + (i * L) / ribs)
    const m = rb.clone().multiply(new THREE.Matrix4().makeScale(W / 2 - T - 0.03, p.archH - 0.03, 1))
    m.setPosition(pos)
    b.with(SURF.paint, () => b.add(ribGeo, m, RIB))
  }
  b.pat = SURF.paint
  const segs = 6
  for (let i = 0; i < segs; i++) {
    const t0 = (i / segs) * Math.PI
    const t1 = ((i + 1) / segs) * Math.PI
    const a = W / 2 + 0.02
    const bb = p.archH + T + 0.02
    const p0 = new THREE.Vector2(a * Math.cos(t0), bb * Math.sin(t0))
    const p1 = new THREE.Vector2(a * Math.cos(t1), bb * Math.sin(t1))
    const mid = p0.clone().add(p1).multiplyScalar(0.5)
    const d = p1.clone().sub(p0)
    const len = d.length()
    d.normalize()
    const eSeg = across.clone().multiplyScalar(d.x).addScaledVector(up, d.y)
    const eThick = new THREE.Vector3().crossVectors(axisDir, eSeg)
    const q = quatFromBasis(eSeg, eThick, axisDir)
    const c = center.clone().addScaledVector(across, mid.x).addScaledVector(up, mid.y).addScaledVector(eThick, 0.1)
    out.colliders.push({ part: p.id, kind: 'hull', climbable: true, hx: len / 2 + 0.05, hy: 0.12, hz: L / 2, x: c.x, y: c.y, z: c.z, q })
  }
}

function buildGable(p: PartDef, side: Side, b: GeoBuilder, out: ShellOut): void {
  const T = WALL_T
  const up = new THREE.Vector3(0, 1, 0)
  const f = wallFrame(p, side)
  const outward = f.inward.clone().negate()
  const W = p.axis === 'x' ? p.z1 - p.z0 : p.x1 - p.x0
  const cU = p.axis === 'x' ? (p.z0 + p.z1) / 2 : (p.x0 + p.x1) / 2
  const top = p.floorY + p.wallH
  const outerPos = wallPoint(f, cU, top, -T / 2)
  const uOut = new THREE.Vector3().crossVectors(up, outward)
  const mo = new THREE.Matrix4().makeBasis(uOut, up, outward).multiply(new THREE.Matrix4().makeScale(W / 2, p.archH + T, 1))
  mo.setPosition(outerPos)
  b.pat = SURF.hull
  b.add(gableGeo, mo, outerHull(p.hull))
  b.pat = p.wall === PAL.bleuDoux || p.wall === PAL.metal ? SURF.steel : SURF.plaster
  const innerPos = wallPoint(f, cU, top, T / 2)
  const uIn = new THREE.Vector3().crossVectors(up, f.inward)
  const mi = new THREE.Matrix4().makeBasis(uIn, up, f.inward).multiply(new THREE.Matrix4().makeScale(W / 2 - T, p.archH, 1))
  mi.setPosition(innerPos)
  b.add(gableGeo, mi, p.wall)
  b.pat = SURF.paint
  const c = wallPoint(f, cU, 0)
  const lowH = p.archH * 0.6
  const hiH = p.archH * 0.45
  const span = (w: number) => (f.axisU === 'x' ? { hx: w / 2, hz: T / 2 } : { hx: T / 2, hz: w / 2 })
  out.colliders.push({ part: p.id, kind: 'hull', climbable: true, ...span(W * 0.92), hy: lowH / 2, x: c.x, y: top + lowH / 2, z: c.z })
  out.colliders.push({ part: p.id, kind: 'hull', climbable: true, ...span(W * 0.62), hy: hiH / 2, x: c.x, y: top + lowH + hiH / 2 - 0.05, z: c.z })
}

export function ceilingAt(p: PartDef, lx: number, lz: number): number {
  const top = p.floorY + p.wallH
  if (p.roof === 'flat') return top
  const W = p.axis === 'x' ? p.z1 - p.z0 : p.x1 - p.x0
  const off = p.axis === 'x' ? lz - (p.z0 + p.z1) / 2 : lx - (p.x0 + p.x1) / 2
  const a = W / 2 - WALL_T
  const r = Math.min(1, Math.abs(off) / a)
  return top + p.archH * Math.sqrt(1 - r * r)
}

export function allParts(): readonly PartDef[] {
  return PARTS
}

export { partById, UNIT }

function freeSpans(u0: number, u1: number, holes: readonly Hole[], y0: number, y1: number): [number, number][] {
  const spans: [number, number][] = [[u0, u1]]
  for (const h of holes) {
    if (h.v1 <= y0 || h.v0 >= y1) continue
    for (let i = spans.length - 1; i >= 0; i--) {
      const [a, c] = spans[i]!
      if (h.u1 <= a || h.u0 >= c) continue
      spans.splice(i, 1)
      if (h.u0 > a) spans.push([a, h.u0])
      if (h.u1 < c) spans.push([h.u1, c])
    }
  }
  return spans.filter(([a, c]) => c - a > 0.08)
}

function buildTrims(p: PartDef, f: WallFrame, holes: readonly Hole[], b: GeoBuilder, metal: boolean): void {
  const T = WALL_T
  const fy = p.floorY
  const top = fy + p.wallH
  const run = (y: number, h: number, d: number, color: number, pat: number) => {
    b.pat = pat
    for (const [a, c] of freeSpans(f.u0, f.u1, holes, y - h / 2, y + h / 2)) {
      const pc = wallPoint(f, (a + c) / 2, y, T / 2 + d / 2)
      if (f.axisU === 'x') b.box(pc.x, pc.y, pc.z, c - a, h, d, color)
      else b.box(pc.x, pc.y, pc.z, d, h, c - a, color)
    }
    b.pat = SURF.paint
  }
  if (metal) {
    run(fy + 0.06, 0.12, 0.03, PAL.metalSombre, SURF.paint)
    run(fy + 1.0, 0.06, 0.04, 0xa8875f, SURF.brass)
    run(top - 0.05, 0.1, 0.05, PAL.metalSombre, SURF.paint)
    return
  }
  run(fy + 0.07, 0.14, 0.035, 0x5a4250, SURF.paint)
  run(fy + 1.0, 0.07, 0.05, 0x7a5444, SURF.paint)
  run(fy + 0.955, 0.025, 0.07, 0x8e6650, SURF.paint)
  run(top - 0.06, 0.12, 0.07, 0x7a5444, SURF.paint)
  run(top - 0.15, 0.04, 0.04, 0x8e6650, SURF.paint)
}
