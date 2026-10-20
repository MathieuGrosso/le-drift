import * as THREE from 'three'
import { grassDensity, type Ground } from './ground'
import { InstanceBounds, InstanceBuffers, makeMesh } from './instances'
import { cellRng, fbm, smoothstep } from './noise'

export interface GrassLayerSpec {
  name: string
  cellSize: number
  sub: number
  perSub: number
  slots: number
  radius: number
  innerRadius: number
  tuft: boolean
}

const BLADE_REACH = 2.5
const WARM = [1.1, 1.04, 0.78] as const
const COOL = [0.84, 0.98, 1.04] as const

export class GrassLayer {
  readonly mesh: THREE.Mesh
  readonly perCell: number
  private readonly buf: InstanceBuffers
  private readonly geometry: THREE.InstancedBufferGeometry
  private readonly cellOf = new Map<number, number>()
  private readonly free: number[] = []
  private pending: number[] = []
  private lastCx = Number.NaN
  private lastCz = Number.NaN
  private lastX = Number.NaN
  private lastZ = Number.NaN
  private budget: number
  private readonly heights: Float32Array
  private readonly slotY: Float32Array
  private readonly bounds: InstanceBounds

  constructor(
    readonly spec: GrassLayerSpec,
    geometry: THREE.InstancedBufferGeometry,
    material: THREE.Material,
    private readonly ground: Ground,
    private readonly fade: { value: THREE.Vector4 },
  ) {
    this.perCell = spec.sub * spec.sub * spec.perSub
    this.geometry = geometry
    this.buf = new InstanceBuffers(spec.slots * this.perCell, geometry)
    geometry.instanceCount = spec.slots * this.perCell
    this.mesh = makeMesh(geometry, material, spec.name)
    this.bounds = new InstanceBounds(geometry)
    this.slotY = new Float32Array(spec.slots * 2)
    for (let i = spec.slots - 1; i >= 0; i--) this.free.push(i)
    this.budget = spec.slots
    this.heights = new Float32Array((spec.sub + 1) * (spec.sub + 1))
    this.setRadius(spec.radius)
  }

  private radius = 0

  private setRadius(r: number): void {
    this.radius = r
    const inner = this.spec.innerRadius
    if (inner > 0) this.fade.value.set(inner * 0.55, inner * 0.9, r * 0.75, r)
    else this.fade.value.set(-2, -1, r * 0.55, r)
  }

  setBudget(slots: number): void {
    const b = Math.max(1, Math.min(this.spec.slots, Math.floor(slots)))
    if (b === this.budget) return
    this.budget = b
    const cs = this.spec.cellSize
    this.setRadius(Math.min(this.spec.radius, Math.max(cs, Math.sqrt((b * cs * cs) / Math.PI) - cs * Math.SQRT2)))
    this.lastCx = Number.NaN
  }

  update(camX: number, camZ: number, maxGen: number): void {
    const cs = this.spec.cellSize
    const cx = Math.floor(camX / cs)
    const cz = Math.floor(camZ / cs)
    const jumped = !(Math.hypot(camX - this.lastX, camZ - this.lastZ) < this.radius * 0.5)
    this.lastX = camX
    this.lastZ = camZ
    if (cx !== this.lastCx || cz !== this.lastCz) {
      this.lastCx = cx
      this.lastCz = cz
      this.retarget(camX, camZ)
    }
    let n = jumped ? Infinity : maxGen
    let changed = false
    while (n-- > 0 && this.pending.length > 0) {
      const key = this.pending.shift()!
      if (this.cellOf.has(key)) continue
      const slot = this.free.pop()
      if (slot === undefined) break
      this.cellOf.set(key, slot)
      this.fill(key, slot)
      changed = true
    }
    if (changed) this.refit()
  }

  private refit(): void {
    const cs = this.spec.cellSize
    const h = cs / 2
    this.bounds.reset()
    for (const [key, slot] of this.cellOf) {
      this.bounds.add((keyX(key) + 0.5) * cs, this.slotY[slot * 2]!, this.slotY[slot * 2 + 1]!, (keyZ(key) + 0.5) * cs, h + BLADE_REACH)
    }
    this.bounds.commit()
  }

  private retarget(camX: number, camZ: number): void {
    const cs = this.spec.cellSize
    const r = this.radius
    const want: { key: number; d: number }[] = []
    const x0 = Math.floor((camX - r) / cs)
    const x1 = Math.floor((camX + r) / cs)
    const z0 = Math.floor((camZ - r) / cs)
    const z1 = Math.floor((camZ + r) / cs)
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const nx = Math.max(x * cs, Math.min(camX, (x + 1) * cs))
        const nz = Math.max(z * cs, Math.min(camZ, (z + 1) * cs))
        const d = Math.hypot(nx - camX, nz - camZ)
        if (d <= r) want.push({ key: cellKey(x, z), d })
      }
    }
    want.sort((a, b) => a.d - b.d)
    const keep = new Set<number>()
    for (let i = 0; i < want.length && i < this.budget; i++) keep.add(want[i]!.key)
    for (const [key, slot] of this.cellOf) {
      if (keep.has(key)) continue
      this.cellOf.delete(key)
      this.free.push(slot)
      this.buf.clear(slot * this.perCell, this.perCell)
      this.buf.uploadRange(slot * this.perCell, this.perCell)
    }
    this.refit()
    this.pending = []
    for (const w of want) if (keep.has(w.key) && !this.cellOf.has(w.key)) this.pending.push(w.key)
  }

  private fill(key: number, slot: number): void {
    const { cellSize: cs, sub, perSub, tuft } = this.spec
    const cx = keyX(key)
    const cz = keyZ(key)
    const ox = cx * cs
    const oz = cz * cs
    const step = cs / sub
    const n1 = sub + 1
    let y0 = Infinity
    let y1 = -Infinity
    for (let i = 0; i <= sub; i++) {
      for (let j = 0; j <= sub; j++) {
        const y = this.ground.height(ox + i * step, oz + j * step)
        this.heights[i * n1 + j] = y
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
    }
    this.slotY[slot * 2] = y0
    this.slotY[slot * 2 + 1] = y1
    const rng = cellRng(cx, cz, tuft ? 7177 : 3301)
    const start = slot * this.perCell
    let k = 0
    for (let i = 0; i < sub; i++) {
      for (let j = 0; j < sub; j++) {
        const h00 = this.heights[i * n1 + j]!
        const h10 = this.heights[(i + 1) * n1 + j]!
        const h01 = this.heights[i * n1 + j + 1]!
        const h11 = this.heights[(i + 1) * n1 + j + 1]!
        const gx = (h10 - h00 + h11 - h01) / (2 * step)
        const gz = (h01 - h00 + h11 - h10) / (2 * step)
        const up = 1 / Math.sqrt(1 + gx * gx + gz * gz)
        const sx = ox + (i + 0.5) * step
        const sz = oz + (j + 0.5) * step
        if (this.ground.outside(sx, sz)) continue
        const d = grassDensity(sx, sz, (h00 + h11) * 0.5, up)
        if (d <= 0.02) continue
        const count = Math.min(perSub, Math.floor(d * perSub + rng()))
        const warm = fbm(sx / 45, sz / 45, 51)
        const cool = fbm(sx / 33 + 40, sz / 33, 52)
        const tall = 0.65 + 0.7 * fbm(sx / 25 - 9, sz / 25 + 3, 53)
        for (let c = 0; c < count; c++) {
          const u = rng()
          const v = rng()
          const y = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v - 0.04
          const tw = smoothstep(0.45, 0.75, warm) * 0.8
          const tc = smoothstep(0.5, 0.8, cool) * 0.7
          const j1 = 0.92 + rng() * 0.16
          const r = (1 + (WARM[0] - 1) * tw + (COOL[0] - 1) * tc) * j1
          const g = (1 + (WARM[1] - 1) * tw + (COOL[1] - 1) * tc) * j1
          const b = (1 + (WARM[2] - 1) * tw + (COOL[2] - 1) * tc) * j1
          const height = tuft ? (0.8 + rng() * 0.5) * tall * (0.7 + 0.4 * d) : (0.4 + rng() * 0.7) * tall * (0.7 + 0.4 * d)
          const width = tuft ? 2 + rng() * 1.2 : 0.07 + rng() * 0.05
          this.buf.write(start + k, ox + (i + u) * step, y, oz + (j + v) * step, rng() * Math.PI * 2,
            width, height, rng() * 6.283, r, g, b)
          k++
        }
      }
    }
    this.buf.clear(start + k, this.perCell - k)
    this.buf.uploadRange(start, this.perCell)
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.geometry.dispose()
  }
}

const OFF = 4096

function cellKey(x: number, z: number): number {
  return (x + OFF) * 8192 + (z + OFF)
}
function keyX(k: number): number {
  return Math.floor(k / 8192) - OFF
}
function keyZ(k: number): number {
  return (k % 8192) - OFF
}

export function grassSlotsFor(blades: number, perCell: number): number {
  return Math.max(4, Math.floor(blades / perCell))
}

export function radiusForSlots(slots: number, cellSize: number): number {
  return Math.max(cellSize, Math.sqrt((slots * cellSize * cellSize) / Math.PI) - cellSize * Math.SQRT2)
}
