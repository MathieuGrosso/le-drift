import * as THREE from 'three'
import type { ColliderKind, DeckId, DistrictId, DomeId, Vec3 } from '../../core/types'
import { PROPS } from '../../core/tuning'
import { GeoBuilder, UNIT } from '../builder'
import { PAL } from '../palette'
import { PANNEAUX } from '../text'
import { SURF } from '../surface'

const TOBOGGAN = PANNEAUX.toboggan

export interface ColSpec {
  kind: ColliderKind
  climbable: boolean
  ownerId?: string
  x: number; y: number; z: number
  hx: number; hy: number; hz: number
  q?: THREE.Quaternion
}

export interface CellBox { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

export interface CellDef {
  id: string
  district: DistrictId
  deck: DeckId
  nom: string
  boxes: CellBox[]
  spawn: { x: number; y: number; z: number; yaw: number }
  air: number
  roof: number
  pvs: DistrictId[]
  glass?: boolean
}

export interface LockRule { act?: number; item?: string; flag?: string }

export interface LadderSpec { id: string; cells: string[]; bottom: Vec3; top: Vec3; normal: Vec3 }
export interface SeatSpec { id: string; x: number; y: number; z: number; yaw: number; bed: boolean }
export interface DoorSpec {
  id: string
  x: number; y: number; z: number
  w: number; h: number
  axis: 'x' | 'z' | 'y'
  style: 'hatch' | 'grate'
  open: boolean
  lock?: LockRule
  sign?: string
}
export interface RideSpec {
  id: string
  kind: 'zip' | 'tube'
  from: Vec3
  to: Vec3
  yaw: number
  lock?: LockRule
}
export type PropModel = keyof typeof PROPS.height
export const PROP_MODELS = Object.keys(PROPS.height) as readonly PropModel[]
const PLANTS: readonly PropModel[] = ['plante-pot', 'plante-1', 'plante-2', 'plante-3']
const TABLE_CLUTTER: readonly PropModel[] = ['livres', 'radio', 'lampe']
export interface PropSpec { model: PropModel; x: number; y: number; z: number; yaw: number; height: number }
export interface PathSpec { district: DistrictId; pts: { x: number; z: number }[]; y: number; loop: boolean; busy: number; work: boolean }
export interface SpotSpec { district: DistrictId; x: number; y: number; z: number; yaw: number; pose: 'lean' | 'stand' | 'sit' | 'work' | 'talk' }
export interface DomeSpec { id: DomeId | 'dome-proue'; district: DistrictId; x: number; y: number; z: number; r: number; lunette: Vec3 }
export interface ScelleeSpec {
  id: string; num: number; district: DistrictId
  door: Vec3; entry: Vec3; pump: Vec3; valve: Vec3; lever: Vec3; nacre: Vec3
  water: WaterSpec; floor: number; depth: number
}
export type PlaceKind = 'couchette' | 'etal' | 'table-carte'
export interface PlaceSpec { id: string; kind: PlaceKind; district: DistrictId; at: Vec3; yaw: number }
export interface SignSpec { text: string; sub?: string; x: number; y: number; z: number; yaw: number; w: number; h: number; ink: number; paper: number }
export interface WaterSpec { x0: number; x1: number; z0: number; z1: number; y: number }
export interface ShaftSpec { x: number; z: number; top: number; bottom: number; r: number; tint: number }
export interface LampSpec { x: number; y: number; z: number; color: number; radius: number; live: boolean; bake: number }
export interface TrouvailleSpec { id: string; x: number; y: number; z: number; kind: number }
export interface PistonSpec { x: number; y: number; z: number; r: number; stroke: number; phase: number }
export interface KelpSpec { x: number; y: number; z: number; h: number; seed: number }

export type Anchor =
  | { kind: 'ladder'; id: string; bottom: Vec3; top: Vec3; normal: Vec3 }
  | { kind: 'zip'; id: string; from: Vec3; to: Vec3 }
  | { kind: 'tube'; id: string; at: Vec3; station: string }
  | { kind: 'slide'; id: string; path: Vec3[] }
  | { kind: 'seat' | 'bed' | 'hammock' | 'lunette' | 'chart-table'; id: string; at: Vec3; yaw: number }

export type StairDir = '+x' | '-x' | '+z' | '-z'

const UP = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _d = new THREE.Vector3()
const _s = new THREE.Vector3()

export const C = (hex: number, k = 1) => new THREE.Color(hex).multiplyScalar(k)

export class Kit {
  b = new GeoBuilder()
  readonly cloth = new GeoBuilder()
  e = new GeoBuilder()
  readonly shell = new GeoBuilder()
  readonly shellE = new GeoBuilder()
  readonly skin = new GeoBuilder()
  readonly glass = new GeoBuilder()
  readonly lines: number[] = []
  readonly cols: ColSpec[] = []
  readonly lamps: LampSpec[] = []
  readonly ladders: LadderSpec[] = []
  readonly anchors: Anchor[] = []
  readonly seats: SeatSpec[] = []
  readonly cells: CellDef[] = []
  readonly doors: DoorSpec[] = []
  readonly rides: RideSpec[] = []
  readonly paths: PathSpec[] = []
  readonly spots: SpotSpec[] = []
  readonly domes: DomeSpec[] = []
  readonly signs: SignSpec[] = []
  readonly waters: WaterSpec[] = []
  readonly shafts: ShaftSpec[] = []
  readonly trouvailles: TrouvailleSpec[] = []
  readonly props: PropSpec[] = []
  readonly pistons: PistonSpec[] = []
  readonly kelp: KelpSpec[] = []
  readonly steam: Vec3[] = []
  readonly scellees: ScelleeSpec[] = []
  readonly places: PlaceSpec[] = []
  readonly valves: { id: string; at: Vec3; axis: Vec3 }[] = []
  readonly portals: { cell: string; a: Vec3; b: Vec3; da: DistrictId; db: DistrictId }[] = []
  private seed: number

  constructor(readonly district: DistrictId, seed: number) {
    this.seed = seed
    this.b.jitter = 0.035
    this.cloth.jitter = 0.05
    this.cloth.pat = SURF.fabric
    this.e.jitter = 0
    this.glass.jitter = 0
    this.shell.jitter = 0.02
    this.shellE.jitter = 0
    this.skin.jitter = 0.03
  }

  // Geometry seen from outside the Drift too (hall envelope); everything else is culled during the sortie.
  shelled(fn: () => void): void {
    const b = this.b
    const e = this.e
    this.b = this.shell
    this.e = this.shellE
    try {
      fn()
    } finally {
      this.b = b
      this.e = e
    }
  }

  rand(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  pick<T>(a: readonly T[]): T {
    return a[Math.floor(this.rand() * a.length)]!
  }

  col(c: ColSpec): void {
    this.cols.push(c)
  }

  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation, rotY = 0): void {
    this.b.box(cx, cy, cz, sx, sy, sz, color, rotY)
  }

  solid(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation, kind: ColliderKind = 'prop', climbable = true, ownerId?: string): void {
    this.b.box(cx, cy, cz, sx, sy, sz, color)
    this.cols.push({ kind, climbable, x: cx, y: cy, z: cz, hx: sx / 2, hy: sy / 2, hz: sz / 2, ...(ownerId ? { ownerId } : {}) })
  }

  beam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number, color: THREE.ColorRepresentation, target: GeoBuilder = this.b, round = false): void {
    _a.set(ax, ay, az)
    _b.set(bx, by, bz)
    _d.subVectors(_b, _a)
    const len = _d.length()
    if (len < 1e-4) return
    _q.setFromUnitVectors(Z, _d.multiplyScalar(1 / len))
    _m.compose(_a.lerp(_b, 0.5), _q, _s.set(t, t, len))
    if (round) {
      const g = UNIT.cylLow
      const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
      const m2 = new THREE.Matrix4().compose(new THREE.Vector3(), rq, new THREE.Vector3(0.5, 1, 0.5))
      target.add(g, _m.clone().multiply(m2), color)
    } else target.add(UNIT.box, _m, color)
  }

  line(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    this.lines.push(ax, ay, az, bx, by, bz)
  }

  sag(a: Vec3, b: Vec3, sag: number, n: number, fn: (p: THREE.Vector3, i: number, t: number) => void, drawLine = true): void {
    let px = a.x
    let py = a.y
    let pz = a.z
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      const y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag
      if (i > 0 && drawLine) this.line(px, py, pz, x, y, z)
      fn(_a.set(x, y, z), i, t)
      px = x
      py = y
      pz = z
    }
  }

  slab(x0: number, x1: number, z0: number, z1: number, y: number, style: 'bois' | 'metal' | 'grille' | 'pierre' | 'tapis', t = 0.3): void {
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    const sx = x1 - x0
    const sz = z1 - z0
    this.b.box(cx, y - t / 2 - 0.02, cz, sx, t, sz, style === 'pierre' ? C(0x8e7f72) : C(PAL.boisOmbre, 1.1))
    const alongX = sx >= sz
    const prevPat = this.b.pat
    this.b.pat = style === 'bois' ? (alongX ? SURF.planksX : SURF.planksZ) : style === 'pierre' ? SURF.stone : style === 'tapis' ? SURF.fabric : SURF.steel
    if (style === 'bois') {
      const w = 0.42
      const n = Math.max(1, Math.round((alongX ? sz : sx) / w))
      const ww = (alongX ? sz : sx) / n
      for (let i = 0; i < n; i++) {
        const k = 0.88 + this.rand() * 0.2
        const c = i % 3 === 0 ? C(0x7a6050, k) : C(0x6a5040, k * 1.04)
        if (alongX) this.b.box(cx, y - 0.02, z0 + ww * (i + 0.5), sx, 0.04, ww * 0.94, c)
        else this.b.box(x0 + ww * (i + 0.5), y - 0.02, cz, ww * 0.94, 0.04, sz, c)
      }
    } else if (style === 'pierre') {
      this.b.box(cx, y - 0.02, cz, sx, 0.04, sz, C(0x8a7966, 0.96 + this.rand() * 0.06))
    } else if (style === 'tapis') {
      this.b.box(cx, y - 0.02, cz, sx, 0.04, sz, C(PAL.tissu1, 0.85))
      this.b.box(cx, y - 0.01, cz, sx * 0.86, 0.04, sz * 0.86, C(PAL.tissu2, 0.9))
    } else {
      const grid = style === 'grille'
      this.b.box(cx, y - 0.03, cz, sx, 0.04, sz, grid ? C(PAL.metalSombre, 0.9) : C(PAL.metal, 1.0))
      const step = grid ? 0.6 : 1.6
      if (alongX) {
        for (let z = z0 + step; z < z1 - 0.05; z += step) this.b.box(cx, y - 0.005, z, sx, 0.03, grid ? 0.06 : 0.03, C(PAL.metal, 1.15))
      } else {
        for (let x = x0 + step; x < x1 - 0.05; x += step) this.b.box(x, y - 0.005, cz, grid ? 0.06 : 0.03, 0.03, sz, C(PAL.metal, 1.15))
      }
    }
    this.b.pat = prevPat
    this.cols.push({ kind: 'floor', climbable: false, x: cx, y: y - t / 2, z: cz, hx: sx / 2, hy: t / 2, hz: sz / 2 })
  }

  rail(x0: number, z0: number, x1: number, z1: number, y: number, color: number = PAL.laiton): void {
    const len = Math.hypot(x1 - x0, z1 - z0)
    if (len < 0.2) return
    const prev = this.b.pat
    if (color === PAL.laiton) this.b.pat = SURF.brass
    this.beam(x0, y + 1.0, z0, x1, y + 1.0, z1, 0.07, C(color, 1.05))
    this.beam(x0, y + 0.52, z0, x1, y + 0.52, z1, 0.035, C(color, 0.9))
    const posts = Math.max(1, Math.round(len / 1.6))
    for (let i = 0; i <= posts; i++) {
      const t = i / posts
      this.b.box(x0 + (x1 - x0) * t, y + 0.5, z0 + (z1 - z0) * t, 0.06, 1.0, 0.06, C(color, 0.85))
    }
    this.b.pat = prev
    const rot = Math.atan2(x1 - x0, z1 - z0)
    const q = new THREE.Quaternion().setFromAxisAngle(UP, rot)
    this.cols.push({ kind: 'wall', climbable: false, x: (x0 + x1) / 2, y: y + 0.6, z: (z0 + z1) / 2, hx: 0.06, hy: 0.6, hz: len / 2, q })
  }

  railRun(axis: 'x' | 'z', fixed: number, u0: number, u1: number, y: number, gaps: readonly [number, number][] = [], color: number = PAL.laiton): void {
    const segs: [number, number][] = [[u0, u1]]
    for (const [g0, g1] of gaps) {
      for (let i = segs.length - 1; i >= 0; i--) {
        const [s0, s1] = segs[i]!
        if (g1 <= s0 || g0 >= s1) continue
        segs.splice(i, 1)
        if (g0 > s0) segs.push([s0, g0])
        if (g1 < s1) segs.push([g1, s1])
      }
    }
    for (const [s0, s1] of segs) {
      if (s1 - s0 < 0.3) continue
      if (axis === 'x') this.rail(s0, fixed, s1, fixed, y, color)
      else this.rail(fixed, s0, fixed, s1, y, color)
    }
  }

  stairs(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, dir: StairDir, side = true): void {
    const alongX = dir === '+x' || dir === '-x'
    const run = alongX ? x1 - x0 : z1 - z0
    const width = alongX ? z1 - z0 : x1 - x0
    const rise = y1 - y0
    const n = Math.max(2, Math.round(rise / 0.24))
    const sign = dir === '+x' || dir === '+z' ? 1 : -1
    const start = sign > 0 ? (alongX ? x0 : z0) : alongX ? x1 : z1
    const cw = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2
    for (let i = 0; i < n; i++) {
      const u = start + sign * (run / n) * (i + 0.5)
      const yy = y0 + (rise / n) * (i + 1)
      const k = 0.9 + this.rand() * 0.18
      if (alongX) {
        this.b.box(u, yy - 0.05, cw, run / n + 0.03, 0.1, width, C(PAL.boisClair, k))
        this.b.box(u - sign * (run / n) * 0.45, yy - 0.15, cw, 0.04, 0.22, width, C(PAL.boisOmbre))
      } else {
        this.b.box(cw, yy - 0.05, u, width, 0.1, run / n + 0.03, C(PAL.boisClair, k))
        this.b.box(cw, yy - 0.15, u - sign * (run / n) * 0.45, width, 0.22, 0.04, C(PAL.boisOmbre))
      }
    }
    const slope = Math.atan2(rise, run)
    const half = Math.hypot(rise, run) / 2
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    const cy = (y0 + y1) / 2 - 0.16
    const q = new THREE.Quaternion()
    if (alongX) q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * slope)
    else q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -sign * slope)
    this.cols.push({ kind: 'stair', climbable: false, x: cx, y: cy, z: cz, hx: alongX ? half : width / 2, hy: 0.12, hz: alongX ? width / 2 : half, q })
    const s0 = start
    const s1 = start + sign * run
    for (const e of side ? [-1, 1] : []) {
      const w = cw + e * (width / 2 + 0.05)
      if (alongX) {
        this.beam(s0, y0 - 0.2, w, s1, y1 - 0.2, w, 0.12, C(PAL.boisOmbre, 1.2))
        this.beam(s0, y0 + 0.95, w, s1, y1 + 0.95, w, 0.06, C(PAL.laiton))
        for (let i = 0; i <= 4; i++) {
          const t = i / 4
          this.b.box(s0 + (s1 - s0) * t, y0 + rise * t + 0.45, w, 0.05, 0.95, 0.05, C(PAL.laiton, 0.85))
        }
        const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * slope)
        this.cols.push({ kind: 'wall', climbable: false, x: cx, y: cy + 0.75, z: w, hx: half, hy: 0.55, hz: 0.05, q: qr })
      } else {
        this.beam(w, y0 - 0.2, s0, w, y1 - 0.2, s1, 0.12, C(PAL.boisOmbre, 1.2))
        this.beam(w, y0 + 0.95, s0, w, y1 + 0.95, s1, 0.06, C(PAL.laiton))
        for (let i = 0; i <= 4; i++) {
          const t = i / 4
          this.b.box(w, y0 + rise * t + 0.45, s0 + (s1 - s0) * t, 0.05, 0.95, 0.05, C(PAL.laiton, 0.85))
        }
        const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -sign * slope)
        this.cols.push({ kind: 'wall', climbable: false, x: w, y: cy + 0.75, z: cz, hx: 0.05, hy: 0.55, hz: half, q: qr })
      }
    }
  }

  ladder(id: string, x: number, z: number, y0: number, y1: number, nx: number, nz: number, cells: string[]): void {
    const alongZ = Math.abs(nx) > 0.5
    const w = 0.5
    const h = y1 - y0
    for (const s of [-1, 1]) {
      if (alongZ) this.b.box(x, y0 + h / 2, z + (s * w) / 2, 0.05, h + 0.9, 0.05, C(PAL.metal, 1.05))
      else this.b.box(x + (s * w) / 2, y0 + h / 2, z, 0.05, h + 0.9, 0.05, C(PAL.metal, 1.05))
    }
    for (let y = y0 + 0.3; y < y1 + 0.1; y += 0.3) {
      if (alongZ) this.b.cyl(x, y, z, 0.022, w, C(PAL.laiton), 'z')
      else this.b.cyl(x, y, z, 0.022, w, C(PAL.laiton), 'x')
    }
    this.cols.push({ kind: 'ladder', climbable: true, ownerId: id, x, y: y0 + h / 2, z, hx: alongZ ? 0.04 : w / 2, hy: h / 2, hz: alongZ ? w / 2 : 0.04 })
    const spec: LadderSpec = { id, cells, bottom: { x, y: y0, z }, top: { x, y: y1, z }, normal: { x: nx, y: 0, z: nz } }
    this.ladders.push(spec)
    this.anchors.push({ kind: 'ladder', id, bottom: spec.bottom, top: spec.top, normal: spec.normal })
  }

  netV(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, owner: string): void {
    const len = Math.hypot(bx - ax, bz - az)
    const nu = Math.max(2, Math.round(len / 0.45))
    const nv = Math.max(2, Math.round((y1 - y0) / 0.45))
    for (let i = 0; i <= nu; i++) {
      const t = i / nu
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      const bulge = Math.sin(t * Math.PI) * 0.12
      this.line(x, y1, z, x + bulge * 0.3, y0, z + bulge * 0.3)
    }
    for (let j = 0; j <= nv; j++) {
      const y = y0 + ((y1 - y0) * j) / nv
      this.line(ax, y, az, bx, y, bz)
    }
    const rot = Math.atan2(bx - ax, bz - az)
    this.cols.push({
      kind: 'net', climbable: true, ownerId: owner, x: (ax + bx) / 2, y: (y0 + y1) / 2, z: (az + bz) / 2,
      hx: 0.08, hy: (y1 - y0) / 2, hz: len / 2, q: new THREE.Quaternion().setFromAxisAngle(UP, rot),
    })
  }

  netH(x0: number, x1: number, z0: number, z1: number, y: number, owner: string, hole?: { x: number; z: number; r: number }): void {
    const step = 0.7
    const inHole = (x: number, z: number) => !!hole && Math.hypot(x - hole.x, z - hole.z) < hole.r
    for (let x = x0; x <= x1 + 0.01; x += step) {
      let start: number | null = null
      for (let z = z0; z <= z1 + 0.01; z += step / 2) {
        const ok = !inHole(x, z)
        if (ok && start === null) start = z
        if ((!ok || z + step / 2 > z1 + 0.01) && start !== null) {
          const end = ok ? z : z - step / 2
          if (end > start) this.line(x, y - 0.05, start, x, y - 0.05, end)
          start = null
        }
      }
    }
    for (let z = z0; z <= z1 + 0.01; z += step) {
      let start: number | null = null
      for (let x = x0; x <= x1 + 0.01; x += step / 2) {
        const ok = !inHole(x, z)
        if (ok && start === null) start = x
        if ((!ok || x + step / 2 > x1 + 0.01) && start !== null) {
          const end = ok ? x : x - step / 2
          if (end > start) this.line(start, y - 0.05, z, end, y - 0.05, z)
          start = null
        }
      }
    }
    this.cols.push({ kind: 'net', climbable: true, ownerId: owner, x: (x0 + x1) / 2, y: y - 0.1, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hy: 0.06, hz: (z1 - z0) / 2 })
  }

  lamp(x: number, y: number, z: number, opts: { color?: number; radius?: number; live?: boolean; bake?: number; hang?: number; style?: 'shade' | 'cage' | 'globe' } = {}): void {
    const color = opts.color ?? PAL.lampe
    const hang = opts.hang ?? 0
    const style = opts.style ?? 'shade'
    if (hang > 0) this.b.box(x, y + hang / 2 + 0.1, z, 0.015, hang, 0.015, C(PAL.boisOmbre))
    if (style === 'shade') {
      this.b.add(SHADE, new THREE.Matrix4().makeTranslation(x, y + 0.12, z), C(PAL.laiton, 0.95))
      this.e.sphere(x, y, z, 0.12, 0.12, 0.12, C(color, 1.5))
    } else if (style === 'cage') {
      this.b.cyl(x, y + 0.2, z, 0.12, 0.04, C(PAL.metalSombre))
      this.b.cyl(x, y - 0.2, z, 0.12, 0.04, C(PAL.metalSombre))
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        this.b.box(x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12, 0.02, 0.4, 0.02, C(PAL.metalSombre))
      }
      this.e.sphere(x, y, z, 0.1, 0.16, 0.1, C(color, 1.5))
    } else {
      this.e.sphere(x, y, z, 0.22, 0.22, 0.22, C(color, 1.35))
      this.b.cyl(x, y + 0.24, z, 0.08, 0.08, C(PAL.laiton))
    }
    this.lamps.push({ x, y, z, color, radius: opts.radius ?? 9, live: opts.live ?? true, bake: opts.bake ?? 1 })
  }

  bulbString(a: Vec3, b: Vec3, sag: number, color: number = PAL.lampe, every = 1.6, bakeEvery = 4): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const n = Math.max(2, Math.round(len / every))
    this.sag(a, b, sag, n, (p, i) => {
      if (i === 0 || i === n) return
      this.e.sphere(p.x, p.y - 0.12, p.z, 0.07, 0.09, 0.07, C(color, 1.6))
      if (i % bakeEvery === 0) this.lamps.push({ x: p.x, y: p.y - 0.2, z: p.z, color, radius: 5, live: false, bake: 0.45 })
    })
  }

  bunting(a: Vec3, b: Vec3, sag: number, colors: readonly number[]): void {
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(2, Math.round(len / 0.55))
    const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
    let k = Math.floor(this.rand() * colors.length)
    this.sag(a, b, sag, n, (p, i) => {
      if (i === n) return
      const c = C(colors[k++ % colors.length]!)
      const g = FLAG.clone()
      const m = new THREE.Matrix4().compose(p.clone(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir), new THREE.Vector3(1, 1, 1))
      this.cloth.add(g, m, c)
    })
  }

  laundry(a: Vec3, b: Vec3, sag: number): void {
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(2, Math.round(len / 0.9))
    const rot = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2
    const cloth = [PAL.tissu1, PAL.tissu2, PAL.tissu3, PAL.blanc, PAL.creme, PAL.vertDoux, PAL.bleuDoux]
    this.sag(a, b, sag, n, (p, i) => {
      if (i === 0 || i === n || this.rand() < 0.25) return
      const h = 0.5 + this.rand() * 0.6
      const w = 0.4 + this.rand() * 0.35
      this.cloth.box(p.x, p.y - h / 2 - 0.03, p.z, w, h, 0.02, C(this.pick(cloth)), rot)
    })
  }

  crate(x: number, y: number, z: number, s: number, rot = 0, solid = true): void {
    this.b.with(SURF.planksX, () => this.crateRaw(x, y, z, s, rot, solid))
  }

  private crateRaw(x: number, y: number, z: number, s: number, rot = 0, solid = true): void {
    const k = 0.85 + this.rand() * 0.25
    this.b.box(x, y + s / 2, z, s, s, s, C(this.rand() > 0.5 ? PAL.bois : PAL.boisClair, k), rot)
    this.b.box(x, y + s / 2, z, s * 1.02, s * 0.14, s * 1.02, C(PAL.boisOmbre), rot)
    this.b.box(x, y + s * 0.15, z, s * 1.02, s * 0.08, s * 1.02, C(PAL.boisOmbre), rot)
    if (solid) this.cols.push({ kind: 'prop', climbable: true, x, y: y + s / 2, z, hx: s / 2, hy: s / 2, hz: s / 2, q: new THREE.Quaternion().setFromAxisAngle(UP, rot) })
  }

  crates(x: number, y: number, z: number, n: number): void {
    let h = y
    for (let i = 0; i < n; i++) {
      const s = 0.6 + this.rand() * 0.35
      this.crate(x + (this.rand() - 0.5) * 0.2, h, z + (this.rand() - 0.5) * 0.2, s, (this.rand() - 0.5) * 0.6)
      h += s
    }
  }

  barrel(x: number, y: number, z: number, r = 0.34, h = 0.9, color: number = PAL.bois): void {
    this.b.with(SURF.planksX, () => this.barrelRaw(x, y, z, r, h, color))
  }

  private barrelRaw(x: number, y: number, z: number, r = 0.34, h = 0.9, color: number = PAL.bois): void {
    this.b.cyl(x, y + h / 2, z, r, h, C(color, 0.95 + this.rand() * 0.15))
    for (const yy of [0.15, 0.5, 0.85]) this.b.cyl(x, y + h * yy, z, r * 1.03, 0.05, C(PAL.metalSombre))
    this.cols.push({ kind: 'prop', climbable: true, x, y: y + h / 2, z, hx: r * 0.9, hy: h / 2, hz: r * 0.9 })
  }

  sack(x: number, y: number, z: number): void {
    this.b.sphere(x, y + 0.22, z, 0.3, 0.24, 0.26, C(PAL.toile, 0.85 + this.rand() * 0.1))
    this.b.sphere(x, y + 0.45, z, 0.12, 0.08, 0.12, C(PAL.corde))
  }

  prop(model: PropModel, x: number, y: number, z: number, yaw: number, s = 1): void {
    this.props.push({ model, x, y, z, yaw, height: PROPS.height[model] * s })
  }

  plant(x: number, y: number, z: number, s = 1): void {
    this.prop(this.pick(PLANTS), x, y, z, this.rand() * Math.PI * 2, s)
  }

  // At yaw 0 the sitter faces +z (Kenney chair back on -z).
  chair(x: number, y: number, z: number, yaw: number): void {
    this.prop(this.pick(['chaise', 'chaise-ronde'] as const), x, y, z, yaw)
    const h = PROPS.chairHalf
    this.cols.push({ kind: 'prop', climbable: true, x, y: y + h, z, hx: h, hy: h, hz: h })
  }

  // Chairs on both long sides and one lived-in object on the top.
  dinette(x: number, y: number, z: number, sx: number, sz: number, h = 0.78): void {
    this.table(x, y, z, sx, sz, h)
    const alongX = sx >= sz
    const half = (alongX ? sz : sx) / 2 + PROPS.chairGap / 2
    for (const s of [-1, 1]) {
      const yaw = alongX ? (s > 0 ? Math.PI : 0) : s > 0 ? -Math.PI / 2 : Math.PI / 2
      this.chair(x + (alongX ? 0 : s * half), y, z + (alongX ? s * half : 0), yaw)
    }
    const u = (this.rand() - 0.5) * 0.4
    this.prop(this.pick(TABLE_CLUTTER), x + (alongX ? u * sx : 0), y + h, z + (alongX ? 0 : u * sz), this.rand() * Math.PI * 2)
  }

  table(x: number, y: number, z: number, sx: number, sz: number, h = 0.78, color: number = PAL.bois): void {
    this.b.with(SURF.planksX, () => this.tableRaw(x, y, z, sx, sz, h, color))
  }

  private tableRaw(x: number, y: number, z: number, sx: number, sz: number, h = 0.78, color: number = PAL.bois): void {
    this.b.box(x, y + h - 0.03, z, sx, 0.06, sz, C(color, 1.05))
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) this.b.box(x + dx * (sx / 2 - 0.06), y + (h - 0.06) / 2, z + dz * (sz / 2 - 0.06), 0.06, h - 0.06, 0.06, C(PAL.boisOmbre))
    this.cols.push({ kind: 'prop', climbable: true, x, y: y + h / 2, z, hx: sx / 2, hy: h / 2, hz: sz / 2 })
  }

  bench(id: string | null, x: number, y: number, z: number, len: number, alongX: boolean, yaw: number): void {
    this.b.with(SURF.planksX, () => this.benchRaw(id, x, y, z, len, alongX, yaw))
  }

  private benchRaw(id: string | null, x: number, y: number, z: number, len: number, alongX: boolean, yaw: number): void {
    const sx = alongX ? len : 0.42
    const sz = alongX ? 0.42 : len
    for (const s of [-1, 1]) {
      const o = s * 0.105
      this.b.rbox(x + (alongX ? 0 : o), y + 0.44, z + (alongX ? o : 0), alongX ? len : 0.2, 0.06, alongX ? 0.2 : len, C(PAL.bois, 0.78 + s * 0.05), 0.02)
    }
    const legs = Math.max(2, Math.round(len / 1.2))
    for (let i = 0; i <= legs - 1; i++) {
      const t = legs === 1 ? 0.5 : i / (legs - 1)
      const u = -len / 2 + 0.15 + (len - 0.3) * t
      this.b.rbox(x + (alongX ? u : 0), y + 0.2, z + (alongX ? 0 : u), alongX ? 0.07 : 0.38, 0.4, alongX ? 0.38 : 0.07, C(PAL.boisOmbre), 0.015)
      this.b.box(x + (alongX ? u : 0), y + 0.08, z + (alongX ? 0 : u), alongX ? 0.09 : 0.44, 0.05, alongX ? 0.44 : 0.09, C(PAL.boisOmbre, 0.9))
    }
    this.b.box(x, y + 0.14, z, alongX ? len - 0.3 : 0.04, 0.05, alongX ? 0.04 : len - 0.3, C(PAL.boisOmbre))
    this.cols.push({ kind: id ? 'seat' : 'prop', climbable: true, x, y: y + 0.23, z, hx: sx / 2, hy: 0.23, hz: sz / 2, ...(id ? { ownerId: id } : {}) })
    if (id) {
      this.seats.push({ id, x, y: y + 0.46, z, yaw, bed: false })
      this.anchors.push({ kind: 'seat', id, at: { x, y: y + 0.46, z }, yaw })
    }
  }

  hammock(id: string, ax: number, az: number, bx: number, bz: number, y: number, color: number): void {
    const a = { x: ax, y: y + 0.6, z: az }
    const b = { x: bx, y: y + 0.6, z: bz }
    const rot = Math.atan2(bx - ax, bz - az)
    this.sag(a, b, 0.5, 8, (p, i) => {
      if (i === 0 || i === 8) return
      this.cloth.box(p.x, p.y, p.z, 0.8, 0.05, 0.4, C(color, 0.9 + (i % 2) * 0.1), rot + Math.PI / 2)
    })
    for (const p of [a, b]) this.b.cyl(p.x, y + 0.9, p.z, 0.06, 1.8, C(PAL.boisOmbre))
    const mx = (ax + bx) / 2
    const mz = (az + bz) / 2
    this.cols.push({ kind: 'seat', climbable: false, ownerId: id, x: mx, y: y + 0.15, z: mz, hx: 0.35, hy: 0.15, hz: Math.hypot(bx - ax, bz - az) / 2 - 0.4, q: new THREE.Quaternion().setFromAxisAngle(UP, rot) })
    this.seats.push({ id, x: mx, y: y + 0.1, z: mz, yaw: rot, bed: true })
    this.anchors.push({ kind: 'hammock', id, at: { x: mx, y: y + 0.1, z: mz }, yaw: rot })
    if (id.startsWith('couchette')) this.places.push({ id, kind: 'couchette', district: this.district, at: { x: mx, y: y + 0.1, z: mz }, yaw: rot })
  }

  cot(id: string, x: number, y: number, z: number, alongX: boolean, blanket: number): void {
    this.b.with(SURF.planksX, () => this.cotRaw(id, x, y, z, alongX, blanket))
  }

  private cotRaw(id: string, x: number, y: number, z: number, alongX: boolean, blanket: number): void {
    const sx = alongX ? 2.0 : 0.85
    const sz = alongX ? 0.85 : 2.0
    this.b.box(x, y + 0.32, z, sx, 0.12, sz, C(PAL.bois, 1.05))
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) this.b.box(x + dx * (sx / 2 - 0.06), y + 0.14, z + dz * (sz / 2 - 0.06), 0.07, 0.28, 0.07, C(PAL.boisOmbre))
    this.cloth.box(x, y + 0.42, z, sx * 0.96, 0.1, sz * 0.94, C(PAL.creme, 0.95))
    this.cloth.box(x + (alongX ? sx * 0.12 : 0), y + 0.49, z + (alongX ? 0 : sz * 0.12), alongX ? sx * 0.7 : sz * 0.98, 0.06, alongX ? sz * 0.98 : sx * 0.7, C(blanket))
    this.cloth.sphere(x - (alongX ? sx * 0.36 : 0), y + 0.53, z - (alongX ? 0 : sz * 0.36), alongX ? 0.18 : 0.3, 0.08, alongX ? 0.3 : 0.18, C(PAL.blanc))
    const yaw = alongX ? Math.PI / 2 : 0
    this.cols.push({ kind: 'seat', climbable: true, ownerId: id, x, y: y + 0.25, z, hx: sx / 2, hy: 0.25, hz: sz / 2 })
    this.seats.push({ id, x, y: y + 0.5, z, yaw, bed: true })
    this.anchors.push({ kind: 'bed', id, at: { x, y: y + 0.5, z }, yaw })
    this.places.push({ id, kind: 'couchette', district: this.district, at: { x, y: y + 0.5, z }, yaw })
  }

  toboggan(id: string, pts: readonly Vec3[], color: number = PAL.laiton): void {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      _d.set(b.x - a.x, b.y - a.y, b.z - a.z)
      const len = _d.length()
      const flat = Math.hypot(_d.x, _d.z) || 1
      const sx = -_d.z / flat
      const sz = _d.x / flat
      const n = Math.max(1, Math.round(len / 0.5))
      for (let j = 0; j < n; j++) {
        const t0 = j / n
        const t1 = (j + 1) / n
        const p0 = { x: a.x + _d.x * t0, y: a.y + _d.y * t0, z: a.z + _d.z * t0 }
        const p1 = { x: a.x + _d.x * t1, y: a.y + _d.y * t1, z: a.z + _d.z * t1 }
        this.beam(p0.x, p0.y - 0.06, p0.z, p1.x, p1.y - 0.06, p1.z, 0.1, C(PAL.boisClair, 0.95 + (j % 2) * 0.08))
        for (const s of [-1, 1]) {
          for (const w of [0.18, 0.36]) this.beam(p0.x + sx * s * w, p0.y - 0.04 + (w - 0.18) * 0.6, p0.z + sz * s * w, p1.x + sx * s * w, p1.y - 0.04 + (w - 0.18) * 0.6, p1.z + sz * s * w, 0.09, C(PAL.boisClair, 0.9))
          this.beam(p0.x + sx * s * 0.5, p0.y + 0.22, p0.z + sz * s * 0.5, p1.x + sx * s * 0.5, p1.y + 0.22, p1.z + sz * s * 0.5, 0.07, C(color, 1.05))
        }
      }
      for (let t = 0; t <= len; t += 2.2) {
        const k = t / len
        const p = { x: a.x + _d.x * k, y: a.y + _d.y * k, z: a.z + _d.z * k }
        this.beam(p.x, p.y - 0.12, p.z, p.x, p.y - 0.12 - Math.min(2.5, 0.6 + k), p.z, 0.06, C(PAL.metalSombre))
      }
    }
    this.anchors.push({ kind: 'slide', id, path: pts.map((p) => ({ x: p.x, y: p.y, z: p.z })) })
    const p0 = pts[0]!
    const p1 = pts[1]!
    this.sign(TOBOGGAN, p0.x, p0.y + 2.1, p0.z, yawFacing(p0.x - p1.x, p0.z - p1.z), 1.1, 0.32, undefined, PAL.boisOmbre, PAL.creme)
  }

  place(id: string, kind: PlaceKind, at: Vec3, yaw: number): void {
    this.places.push({ id, kind, district: this.district, at: { x: at.x, y: at.y, z: at.z }, yaw })
  }

  shelf(x: number, y: number, z: number, len: number, h: number, alongX: boolean, depth = 0.4, fill: readonly number[] = [PAL.toile, PAL.tissu3, PAL.rouille, PAL.tissu2]): void {
    this.b.with(SURF.planksX, () => this.shelfRaw(x, y, z, len, h, alongX, depth, fill))
  }

  private shelfRaw(x: number, y: number, z: number, len: number, h: number, alongX: boolean, depth = 0.4, fill: readonly number[] = [PAL.toile, PAL.tissu3, PAL.rouille, PAL.tissu2]): void {
    const sx = alongX ? len : depth
    const sz = alongX ? depth : len
    for (const s of [-1, 1]) this.b.box(x + (alongX ? (s * len) / 2 : 0), y + h / 2, z + (alongX ? 0 : (s * len) / 2), alongX ? 0.06 : depth, h, alongX ? depth : 0.06, C(PAL.boisOmbre, 1.1))
    for (let yy = y + 0.35; yy < y + h; yy += 0.55) {
      this.b.box(x, yy, z, sx, 0.04, sz, C(PAL.bois))
      let u = -len / 2 + 0.1
      while (u < len / 2 - 0.15) {
        const w = 0.05 + this.rand() * 0.07
        const hh = 0.24 + this.rand() * 0.2
        this.b.box(x + (alongX ? u + w / 2 : 0), yy + hh / 2 + 0.02, z + (alongX ? 0 : u + w / 2), alongX ? w : depth * 0.8, hh, alongX ? depth * 0.8 : w, C(this.pick(fill), 0.8 + this.rand() * 0.3))
        u += w + 0.01
      }
    }
    this.cols.push({ kind: 'shelf', climbable: true, x, y: y + h / 2, z, hx: sx / 2, hy: h / 2, hz: sz / 2 })
  }

  pipe(pts: readonly Vec3[], r: number, color: number, climbable = true, owner?: string): void {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      this.beam(a.x, a.y, a.z, b.x, b.y, b.z, r * 2, C(color), this.b, true)
      this.b.sphere(b.x, b.y, b.z, r * 1.15, r * 1.15, r * 1.15, C(PAL.laiton, 0.9))
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      for (let t = 1; t < len; t += 1.5) {
        const k = t / len
        const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }
        this.beam(p.x - (b.x - a.x) / len * 0.04, p.y - (b.y - a.y) / len * 0.04, p.z - (b.z - a.z) / len * 0.04, p.x + (b.x - a.x) / len * 0.04, p.y + (b.y - a.y) / len * 0.04, p.z + (b.z - a.z) / len * 0.04, r * 2.5, C(PAL.laiton, 0.85), this.b, true)
      }
      _d.set(b.x - a.x, b.y - a.y, b.z - a.z)
      _q.setFromUnitVectors(Z, _d.clone().normalize())
      this.cols.push({ kind: 'pipe', climbable, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, hx: r, hy: r, hz: len / 2, q: _q.clone(), ...(owner ? { ownerId: owner } : {}) })
    }
  }

  sign(text: string, x: number, y: number, z: number, yaw: number, w: number, h: number, sub?: string, ink: number = PAL.boisOmbre, paper: number = PAL.toile): void {
    this.signs.push({ text, ...(sub ? { sub } : {}), x, y, z, yaw, w, h, ink, paper })
    const back = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.05)
    this.b.box(x + back.x, y, z + back.z, w + 0.14, h + 0.14, 0.05, C(PAL.boisOmbre), -yaw)
  }

  cell(def: CellDef): void {
    this.cells.push(def)
  }

  trouvaille(id: string, x: number, y: number, z: number): void {
    this.trouvailles.push({ id, x, y, z, kind: Math.floor(this.rand() * 6) })
  }
}

const SHADE = (() => {
  const g = new THREE.ConeGeometry(0.24, 0.2, 12, 1, true)
  g.translate(0, 0, 0)
  return g
})()

const FLAG = (() => {
  const g = new THREE.BufferGeometry()
  const p = [0, 0, -0.012, 0.42, 0, -0.012, 0.21, -0.36, -0.012, 0, 0, 0.012, 0.21, -0.36, 0.012, 0.42, 0, 0.012]
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  return g
})()

export function yawFacing(nx: number, nz: number): number {
  return Math.atan2(nx, -nz)
}
