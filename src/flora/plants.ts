import * as THREE from 'three'
import { PLANT_COLORS as P } from './palette'
import { PlantGeo, RIGID, SWAY, type Sway } from './plantgeo'

type Rng = () => number

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _t = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!
const col = (hex: number, jitter = 0, rng?: Rng) => {
  const c = new THREE.Color(hex)
  if (rng && jitter > 0) c.multiplyScalar(1 - jitter + rng() * jitter * 2)
  return c
}

export function sway(p: THREE.Vector3, kind: Sway['kind'], flex: number, phase: number, grow = -1): Sway {
  return { px: p.x, py: p.y, pz: p.z, flex, phase, kind, grow }
}

function place(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, yaw = 0): THREE.Matrix4 {
  _q.setFromAxisAngle(UP, yaw)
  return _m.compose(_t.set(x, y, z), _q, _s.set(sx, sy, sz))
}

export function pot(g: PlantGeo, rng: Rng, x: number, y: number, z: number, r: number, h: number, kind: 'terre' | 'fer' | 'bocal' = 'terre'): number {
  const color = kind === 'terre' ? pick(rng, [P.terreCuite, P.terreCuiteClaire, P.terreCuite]) : kind === 'fer' ? pick(rng, [P.ferBlanc, P.teal, P.rouille]) : P.verreBocal
  const pts = [
    new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.72, 0), new THREE.Vector2(r * 0.95, h * 0.85),
    new THREE.Vector2(r * 1.05, h * 0.86), new THREE.Vector2(r * 1.05, h), new THREE.Vector2(r * 0.9, h),
    new THREE.Vector2(r * 0.86, h * 0.9), new THREE.Vector2(0, h * 0.9),
  ]
  if (kind === 'fer') pts.splice(2, 4, new THREE.Vector2(r, 0.02), new THREE.Vector2(r, h), new THREE.Vector2(r * 0.95, h))
  const lathe = new THREE.LatheGeometry(pts, kind === 'fer' ? 10 : 9)
  g.add(lathe, place(x, y, z, 1, 1, 1, rng() * 6.28), col(color, 0.08, rng), RIGID, (vy) => 0.82 + 0.18 * Math.min(1, Math.max(0, (vy - y) / h)))
  if (kind === 'fer') {
    const band = new THREE.CylinderGeometry(r * 1.01, r * 1.01, h * 0.35, 10, 1, true)
    g.add(band, place(x, y + h * 0.5, z), col(pick(rng, [P.tissu1, P.tissu2, P.tissu3])), RIGID)
  }
  const soil = new THREE.CircleGeometry(r * 0.88, 9)
  soil.rotateX(-Math.PI / 2)
  g.add(soil, place(x, y + h * 0.88, z), col(P.terreau), RIGID)
  return y + h * 0.88
}

export function trailingVine(g: PlantGeo, rng: Rng, start: THREE.Vector3, length: number, pivot: THREE.Vector3, opts: { out?: THREE.Vector2; flower?: number; kind?: Sway['kind']; flex?: number } = {}): void {
  const kind = opts.kind ?? SWAY.hang
  const steps = Math.max(4, Math.round(length / 0.12))
  const out = opts.out ?? new THREE.Vector2(0, 0)
  const phase = rng() * 6.28
  const s = sway(pivot, kind, opts.flex ?? 1, phase)
  const pts: THREE.Vector3[] = []
  const sides: THREE.Vector3[] = []
  const widths: number[] = []
  const colors: THREE.Color[] = []
  const wob = rng() * 6.28
  const stem = col(P.tige, 0.1, rng)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bow = Math.sin(t * Math.PI) * 0.12
    pts.push(new THREE.Vector3(
      start.x + out.x * (Math.sqrt(t) * 0.35 + bow) + Math.sin(t * 7 + wob) * 0.04,
      start.y - t * length,
      start.z + out.y * (Math.sqrt(t) * 0.35 + bow) + Math.cos(t * 6 + wob) * 0.04,
    ))
    sides.push(new THREE.Vector3(Math.cos(wob), 0, Math.sin(wob)))
    widths.push(0.018)
    colors.push(stem)
  }
  g.ribbon(pts, widths, sides, colors, s)
  const greens = [P.feuille, P.feuilleClaire, P.feuilleSombre, P.feuille]
  for (let i = 1; i <= steps; i++) {
    const p = pts[i]!
    const n = rng() < 0.6 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const t = i / steps
      const size = (0.07 + rng() * 0.07) * (1.15 - 0.45 * t)
      const a = rng() * Math.PI * 2
      const dx = Math.cos(a)
      const dz = Math.sin(a)
      const tip = new THREE.Vector3(p.x + dx * size * 1.8, p.y - size * 0.4 + rng() * size, p.z + dz * size * 1.8)
      const mid = new THREE.Vector3((p.x + tip.x) / 2, (p.y + tip.y) / 2 + size * 0.15, (p.z + tip.z) / 2)
      const sd = new THREE.Vector3(-dz, 0.3, dx).normalize().multiplyScalar(size * 0.75)
      const c = col(pick(rng, greens), 0.12, rng)
      const nx = -dz * 0.2
      const nz = dx * 0.2
      const a0 = g.vert(p.x, p.y, p.z, nx, 1, nz, c, s)
      const a1 = g.vert(mid.x + sd.x, mid.y + sd.y, mid.z + sd.z, nx, 1, nz, c, s)
      const a2 = g.vert(tip.x, tip.y, tip.z, nx, 1, nz, c.clone().multiplyScalar(1.12), s)
      const a3 = g.vert(mid.x - sd.x, mid.y - sd.y, mid.z - sd.z, nx, 1, nz, c, s)
      g.quad(a0, a1, a2, a3)
    }
    if (opts.flower && rng() < opts.flower) {
      const f = col(pick(rng, [P.fleur1, P.fleur2, P.fleur3]))
      const sph = new THREE.IcosahedronGeometry(0.035, 0)
      g.add(sph, place(p.x + (rng() - 0.5) * 0.1, p.y, p.z + (rng() - 0.5) * 0.1), f, s)
    }
  }
}

export function leafyCrown(g: PlantGeo, rng: Rng, c: THREE.Vector3, count: number, len: number, opts: { greens?: number[]; spread?: number; droop?: number; kind?: Sway['kind']; grow?: number; width?: number } = {}): void {
  const greens = opts.greens ?? [P.feuille, P.feuilleClaire, P.feuilleSombre]
  const kind = opts.kind ?? SWAY.upright
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.6
    const L = len * (0.65 + rng() * 0.5)
    const lift = 0.55 + rng() * 0.6
    const spread = (opts.spread ?? 0.7) * (0.7 + rng() * 0.5)
    const droop = (opts.droop ?? 0.6) * (0.7 + rng() * 0.6)
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const pts: THREE.Vector3[] = []
    const widths: number[] = []
    const sides: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    const base = col(pick(rng, greens), 0.1, rng)
    const n = 7
    const w = (opts.width ?? 0.11) * L
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const r = spread * L * t
      const y = lift * L * t - droop * L * t * t
      pts.push(new THREE.Vector3(c.x + dx * r, c.y + y, c.z + dz * r))
      widths.push(w * Math.sin(Math.min(1, t * 1.15) * Math.PI) + 0.004)
      sides.push(new THREE.Vector3(-dz, 0, dx))
      colors.push(base.clone().multiplyScalar(0.7 + 0.45 * t))
    }
    g.ribbon(pts, widths, sides, colors, sway(c, kind, 1, rng() * 6.28, opts.grow ?? -1))
  }
}

export function kelpStalk(g: PlantGeo, rng: Rng, base: THREE.Vector3, height: number, opts: { grow?: number; kind?: Sway['kind']; flex?: number; tint?: number; bladeLen?: number } = {}): void {
  const kind = opts.kind ?? SWAY.ribbon
  const s = sway(base, kind, opts.flex ?? 1, rng() * 6.28, opts.grow ?? -1)
  const steps = Math.max(5, Math.round(height / 0.3))
  const twist = rng() * 6.28
  const pts: THREE.Vector3[] = []
  const sides: THREE.Vector3[] = []
  const widths: number[] = []
  const colors: THREE.Color[] = []
  const stipe = col(P.stipe, 0.08, rng)
  const lean = new THREE.Vector2(rng() - 0.5, rng() - 0.5).multiplyScalar(0.15)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push(new THREE.Vector3(base.x + lean.x * t * height + Math.sin(t * 5 + twist) * 0.05, base.y + t * height, base.z + lean.y * t * height + Math.cos(t * 4 + twist) * 0.05))
    const a = twist + t * 3
    sides.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))
    widths.push(0.05 * (1 - t * 0.5))
    colors.push(stipe.clone().multiplyScalar(0.75 + 0.35 * t))
  }
  g.ribbon(pts, widths, sides, colors, s)
  const tint = opts.tint ?? pick(rng, [P.varech, P.laminaire, P.varechClair, P.varech])
  const bladeLen = opts.bladeLen ?? 0.75
  for (let i = 2; i < steps; i++) {
    if (rng() < 0.12) continue
    const p = pts[i]!
    const t = i / steps
    const a = twist + i * 2.4
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const L = bladeLen * (0.55 + rng() * 0.6) * (1.1 - 0.4 * t)
    const bp: THREE.Vector3[] = []
    const bw: number[] = []
    const bs: THREE.Vector3[] = []
    const bc: THREE.Color[] = []
    const c = col(tint, 0.12, rng)
    for (let k = 0; k <= 5; k++) {
      const u = k / 5
      bp.push(new THREE.Vector3(p.x + dx * L * u * 0.55, p.y + L * u * 0.8, p.z + dz * L * u * 0.55))
      bw.push(0.24 * L * Math.sin(Math.min(1, u * 1.2) * Math.PI) + 0.01)
      bs.push(new THREE.Vector3(-dz, 0, dx))
      bc.push(c.clone().multiplyScalar(0.8 + 0.4 * u))
    }
    g.ribbon(bp, bw, bs, bc, s)
    const bulb = new THREE.IcosahedronGeometry(0.035, 0)
    g.add(bulb, place(p.x + dx * 0.03, p.y + 0.02, p.z + dz * 0.03), col(P.flotteur), s)
  }
  const crown = pts[pts.length - 1]!
  for (let k = 0; k < 3; k++) {
    const a = twist + k * 2.1
    const tp = [crown, new THREE.Vector3(crown.x + Math.cos(a) * 0.3, crown.y + 0.5, crown.z + Math.sin(a) * 0.3), new THREE.Vector3(crown.x + Math.cos(a) * 0.55, crown.y + 0.85, crown.z + Math.sin(a) * 0.55)]
    const c = col(P.varechClair, 0.1, rng)
    g.ribbon(tp, [0.02, 0.14, 0.02], tp.map(() => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))), [c, c, c.clone().multiplyScalar(1.15)], s)
  }
}

export function hangingBasket(g: PlantGeo, rng: Rng, hook: THREE.Vector3, drop: number, r: number, vines: number, vineLen: number): void {
  const by = hook.y - drop
  const potTop = pot(g, rng, hook.x, by - r * 1.1, hook.z, r, r * 1.1, rng() < 0.3 ? 'fer' : 'terre')
  const rope = col(P.corde)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4
    const rim = new THREE.Vector3(hook.x + Math.cos(a) * r, by, hook.z + Math.sin(a) * r)
    const len = rim.distanceTo(hook)
    const cyl = new THREE.CylinderGeometry(0.008, 0.008, len, 3)
    const mid = rim.clone().add(hook).multiplyScalar(0.5)
    const dir = hook.clone().sub(rim).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir)
    g.add(cyl, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), rope, sway(hook, SWAY.hang, 0.35, 0))
  }
  const top = new THREE.Vector3(hook.x, potTop, hook.z)
  leafyCrown(g, rng, top, 6 + Math.floor(rng() * 4), r * 2.2, { spread: 0.8, droop: 0.9, kind: SWAY.hang })
  for (let i = 0; i < vines; i++) {
    const a = rng() * Math.PI * 2
    const out = new THREE.Vector2(Math.cos(a), Math.sin(a))
    const start = new THREE.Vector3(hook.x + out.x * r * 0.95, potTop, hook.z + out.y * r * 0.95)
    trailingVine(g, rng, start, vineLen * (0.5 + rng() * 0.6), hook, { out, flower: 0.08 })
  }
}

export function railPlanter(g: PlantGeo, rng: Rng, x: number, y: number, z: number, alongZ: boolean, len: number, outX: number, outZ: number, vineMax: number): void {
  const sx = alongZ ? 0.32 : len
  const sz = alongZ ? len : 0.32
  const box = new THREE.BoxGeometry(sx, 0.34, sz)
  g.add(box, place(x, y - 0.17, z), col(pick(rng, [P.boisPlanche, P.boisPlancheClair]), 0.06, rng), RIGID)
  const band = new THREE.BoxGeometry(sx + 0.02, 0.05, sz + 0.02)
  g.add(band, place(x, y - 0.08, z), col(P.laiton), RIGID)
  const soil = new THREE.PlaneGeometry(sx * 0.9, sz * 0.9)
  soil.rotateX(-Math.PI / 2)
  g.add(soil, place(x, y - 0.02, z), col(P.terreau), RIGID)
  const n = Math.max(2, Math.round(len / 0.45))
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5
    const px = x + (alongZ ? 0 : t * len)
    const pz = z + (alongZ ? t * len : 0)
    const top = new THREE.Vector3(px, y - 0.02, pz)
    if (rng() < 0.6) leafyCrown(g, rng, top, 4, 0.35 + rng() * 0.25, { spread: 0.5, droop: 0.5 })
    const vines = rng() < 0.75 ? 1 + Math.floor(rng() * 2) : 0
    for (let k = 0; k < vines; k++) {
      const start = new THREE.Vector3(px + outX * sx * 0.5 + (rng() - 0.5) * 0.1, y - 0.06, pz + outZ * sz * 0.5 + (rng() - 0.5) * 0.1)
      trailingVine(g, rng, start, vineMax * (0.35 + rng() * 0.65), start, { out: new THREE.Vector2(outX, outZ).multiplyScalar(0.4), flower: 0.05 })
    }
  }
}

export function floorPlant(g: PlantGeo, rng: Rng, x: number, y: number, z: number, scale: number): void {
  const style = rng()
  const r = 0.22 * scale
  const h = 0.36 * scale
  if (style < 0.4) {
    const top = pot(g, rng, x, y, z, r, h, 'terre')
    leafyCrown(g, rng, new THREE.Vector3(x, top, z), 9, 0.75 * scale, { spread: 0.65, droop: 0.55, width: 0.16 })
  } else if (style < 0.75) {
    const top = pot(g, rng, x, y, z, r * 0.9, h * 1.3, 'fer')
    for (let k = 0; k < 3; k++) kelpStalk(g, rng, new THREE.Vector3(x + (rng() - 0.5) * r, top, z + (rng() - 0.5) * r), (0.7 + rng() * 0.6) * scale, { kind: SWAY.upright, flex: 0.6, bladeLen: 0.35 })
  } else {
    const top = pot(g, rng, x, y, z, r * 1.1, h * 0.8, 'terre')
    leafyCrown(g, rng, new THREE.Vector3(x, top, z), 14, 0.45 * scale, { spread: 0.9, droop: 0.9, width: 0.09, greens: [P.feuilleClaire, P.feuille, P.fougere] })
    for (let i = 0; i < 4; i++) {
      const a = rng() * 6.28
      const out = new THREE.Vector2(Math.cos(a), Math.sin(a))
      trailingVine(g, rng, new THREE.Vector3(x + out.x * r, top, z + out.y * r), (0.25 + rng() * 0.2) * scale, new THREE.Vector3(x, top, z), { out, flower: 0.15 })
    }
  }
}

export function shelfSprouts(g: PlantGeo, rng: Rng, x0: number, x1: number, y: number, z: number, alongZ: boolean): void {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / 0.55))
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const a = x0 + (x1 - x0) * t
    const px = alongZ ? x0 : a
    const pz = alongZ ? z + (x1 - x0) * (t - 0.5) : z
    const top = pot(g, rng, px, y, pz, 0.07, 0.11, rng() < 0.5 ? 'fer' : 'terre')
    if (rng() < 0.5) leafyCrown(g, rng, new THREE.Vector3(px, top, pz), 6, 0.18, { spread: 0.5, droop: 0.4, greens: [P.herbe, P.feuilleClaire] })
    else {
      const out = new THREE.Vector2(alongZ ? 1 : 0, alongZ ? 0 : 1)
      trailingVine(g, rng, new THREE.Vector3(px, top, pz), 0.3 + rng() * 0.4, new THREE.Vector3(px, top, pz), { out })
    }
  }
}

export function cord(g: PlantGeo, a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, s: Sway = RIGID): void {
  const len = a.distanceTo(b)
  if (len < 1e-3) return
  const cyl = new THREE.CylinderGeometry(r, r, len, 4)
  const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())
  g.add(cyl, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), col(color), s)
}
