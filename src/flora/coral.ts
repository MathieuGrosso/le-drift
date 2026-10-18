import * as THREE from 'three'
import { CEILING_Y } from '../core/layout'
import { CORAL_TYPES, coralGeometry, type CoralType } from './geometry'
import { blancFactor, coralDensity, ventFactor, type Ground } from './ground'
import { InstanceBuffers, makeMesh, RECORD } from './instances'
import { cellRng } from './noise'
import { FLORA_COLORS } from './palette'

const CELL = 64

interface CoralCell {
  types: Uint8Array
  data: Float32Array
}

interface TypeLayer {
  geo: THREE.InstancedBufferGeometry
  buf: InstanceBuffers
  mesh: THREE.Mesh
  count: number
}

const REEF_COLORS = [FLORA_COLORS.corail1, FLORA_COLORS.corail2, FLORA_COLORS.corail3, 0xf4a3a8, 0xf2cf8a]
const BLANC_COLORS = [FLORA_COLORS.blanc, FLORA_COLORS.blancOmbre, FLORA_COLORS.blanc, 0xf6e3dc, 0xe6ecf6]

export class CoralField {
  readonly group = new THREE.Group()
  private readonly cells = new Map<number, CoralCell>()
  private readonly layers: TypeLayer[] = []
  private lastX = Number.NaN
  private lastZ = Number.NaN
  private fadeRefs: { value: THREE.Vector4 }[]

  constructor(
    private readonly ground: Ground,
    materials: Record<CoralType, { material: THREE.Material; fade: { value: THREE.Vector4 } }>,
    private radius: number,
    private perCell: number,
  ) {
    const rng = cellRng(5, 8, 1234)
    this.fadeRefs = []
    for (const t of CORAL_TYPES) {
      const geo = coralGeometry(t, rng)
      const buf = new InstanceBuffers(4096, geo)
      const mesh = makeMesh(geo, materials[t].material, `flora-coral-${t}`)
      this.group.add(mesh)
      this.layers.push({ geo, buf, mesh, count: 0 })
      this.fadeRefs.push(materials[t].fade)
    }
    this.applyFade()
  }

  configure(radius: number, perCell: number): void {
    if (perCell !== this.perCell) this.cells.clear()
    this.radius = radius
    this.perCell = perCell
    this.applyFade()
    this.lastX = Number.NaN
  }

  private applyFade(): void {
    for (const f of this.fadeRefs) f.value.set(-2, -1, this.radius * 0.75, this.radius)
  }

  update(camX: number, camZ: number): void {
    if (Math.hypot(camX - this.lastX, camZ - this.lastZ) < 8) return
    this.lastX = camX
    this.lastZ = camZ
    const r = this.radius
    const rsq = r * r
    for (const l of this.layers) l.count = 0
    const x0 = Math.floor((camX - r) / CELL)
    const x1 = Math.floor((camX + r) / CELL)
    const z0 = Math.floor((camZ - r) / CELL)
    const z1 = Math.floor((camZ + r) / CELL)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.cell(cx, cz)
        const n = cell.types.length
        for (let i = 0; i < n; i++) {
          const o = i * RECORD
          const dx = cell.data[o]! - camX
          const dz = cell.data[o + 2]! - camZ
          if (dx * dx + dz * dz > rsq) continue
          const layer = this.ensure(cell.types[i]!)
          layer.buf.copyFrom(cell.data, i, layer.count++)
        }
      }
    }
    for (const l of this.layers) {
      l.geo.instanceCount = l.count
      l.buf.uploadAll(l.count)
    }
    if (this.cells.size > 900) this.evict(camX, camZ)
  }

  private ensure(type: number): TypeLayer {
    const l = this.layers[type]!
    if (l.count < l.buf.capacity) return l
    const bigger = new InstanceBuffers(l.buf.capacity * 2, l.geo)
    bigger.i0.set(l.buf.i0)
    bigger.i1.set(l.buf.i1)
    bigger.col.set(l.buf.col)
    l.buf = bigger
    return l
  }

  private evict(camX: number, camZ: number): void {
    for (const key of this.cells.keys()) {
      const cx = Math.floor(key / 4096) - 2048
      const cz = (key % 4096) - 2048
      if (Math.hypot((cx + 0.5) * CELL - camX, (cz + 0.5) * CELL - camZ) > this.radius * 3) this.cells.delete(key)
    }
  }

  private cell(cx: number, cz: number): CoralCell {
    const key = (cx + 2048) * 4096 + (cz + 2048)
    let c = this.cells.get(key)
    if (c) return c
    c = this.generate(cx, cz)
    this.cells.set(key, c)
    return c
  }

  private generate(cx: number, cz: number): CoralCell {
    const rng = cellRng(cx, cz, 8086)
    const types: number[] = []
    const data: number[] = []
    const col = new THREE.Color()
    const mx = (cx + 0.5) * CELL
    const mz = (cz + 0.5) * CELL
    const density = coralDensity(mx, mz)
    const n = Math.floor((this.perCell * density) / 4 + rng())
    for (let i = 0; i < n; i++) {
      const clusterX = cx * CELL + rng() * CELL
      const clusterZ = cz * CELL + rng() * CELL
      if (coralDensity(clusterX, clusterZ) < rng() * 0.6) continue
      const blanc = blancFactor(clusterZ)
      const vent = ventFactor(clusterX, clusterZ)
      const k = 3 + Math.floor(rng() * 6)
      for (let j = 0; j < k; j++) {
        const a = rng() * Math.PI * 2
        const rr = Math.sqrt(rng()) * 3.5
        const x = clusterX + Math.cos(a) * rr
        const z = clusterZ + Math.sin(a) * rr
        if (this.ground.outside(x, z) || this.ground.upness(x, z) < 0.45) continue
        const y = this.ground.height(x, z)
        if (y > CEILING_Y - 4) continue
        const type = pickType(rng, blanc, vent)
        let hex: number
        if (type === 'tube' && vent > 0.3) hex = FLORA_COLORS.tubeBlanc
        else if (rng() < blanc * 0.85) hex = BLANC_COLORS[Math.floor(rng() * BLANC_COLORS.length)]!
        else hex = REEF_COLORS[Math.floor(rng() * REEF_COLORS.length)]!
        col.setHex(hex)
        const jit = 0.9 + rng() * 0.2
        const s = scaleFor(type, rng) * (1.35 + blanc * 0.6) * (j === 0 ? 1.4 : 1)
        types.push(CORAL_TYPES.indexOf(type))
        data.push(x, y - 0.05, z, rng() * Math.PI * 2, s, s * (0.8 + rng() * 0.45), rng() * 6.283,
          col.r * jit, col.g * jit, col.b * jit)
      }
    }
    return { types: Uint8Array.from(types), data: Float32Array.from(data) }
  }

  dispose(): void {
    for (const l of this.layers) l.geo.dispose()
    this.group.removeFromParent()
    this.cells.clear()
  }
}

function pickType(rng: () => number, blanc: number, vent: number): CoralType {
  const r = rng()
  if (vent > 0.35) return r < 0.75 ? 'tube' : 'anemone'
  if (blanc > 0.5) return r < 0.35 ? 'branche' : r < 0.65 ? 'dome' : r < 0.85 ? 'eventail' : 'anemone'
  return r < 0.28 ? 'branche' : r < 0.52 ? 'dome' : r < 0.72 ? 'eventail' : r < 0.9 ? 'anemone' : 'tube'
}

function scaleFor(type: CoralType, rng: () => number): number {
  switch (type) {
    case 'branche': return 0.7 + rng() * 1.1
    case 'dome': return 0.6 + rng() * 1.4
    case 'eventail': return 0.8 + rng() * 1.3
    case 'tube': return 0.7 + rng() * 0.7
    case 'anemone': return 0.6 + rng() * 0.7
  }
}
