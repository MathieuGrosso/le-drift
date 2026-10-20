import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { CHUNK_SIZE, CHUNKS_PER_SIDE, chunkOrigin } from '../core/layout'
import type { GameContext, QualityLevel, Vec3 } from '../core/types'
import { RockLayer, rocksForChunk, type RockInstance } from './rocks'
import { surfaceColor } from './surface'
import { heightAt } from './terrain'

// Nobody walks the seabed: it is a backdrop seen through glass, out of reach of the longe.
export const SEABED_COLLIDERS = false

const FAR_EXTENT = 1280
const FAR_TILES = 4
const FAR_SKIRT = 14
// Cell stride of a far tile by its distance to the eye; a stride cell must never straddle two chunks.
const FAR_STRIDES: readonly [number, number][] = [[260, 1], [640, 2], [Infinity, 4]]
const SKIRT = 2.5
const N_CHUNKS = CHUNKS_PER_SIDE * CHUNKS_PER_SIDE
const ROCK_COLLIDER_MIN = 1.1

type Lod = 0 | 1 | 2

interface Built {
  mesh: THREE.Mesh
  body: RAPIER.RigidBody
  colliders: RAPIER.Collider[]
}

interface FarTile {
  mesh: THREE.Mesh
  index: THREE.BufferAttribute
  x0: number
  z0: number
  cells: number
  stride: number
}

function resolution(level: QualityLevel): { seg: number; farStep: number } {
  return level === 'low' ? { seg: 32, farStep: 16 } : { seg: 64, farStep: 8 }
}

const key = (cx: number, cz: number) => cz * CHUNKS_PER_SIDE + cx

function farEdgeVertex(edge: number, k: number, cells: number): number {
  const tw = cells + 1
  if (edge === 0) return k
  if (edge === 1) return cells * tw + k
  if (edge === 2) return k * tw
  return k * tw + cells
}

export class TerrainStreamer {
  readonly group = new THREE.Group()
  private readonly built = new Map<number, Built>()
  private readonly reported = new Int8Array(N_CHUNKS).fill(2)
  private readonly target = new Int8Array(N_CHUNKS).fill(2)
  private readonly rockCache = new Map<number, RockInstance[]>()
  private readonly rocks: RockLayer
  private far: FarTile[] = []
  private seg: number
  private farStep: number
  private center = { x: Number.NaN, z: Number.NaN }
  private farDirty = true
  private rocksDirty = true
  private readonly tmpColor = new THREE.Color()

  constructor(private readonly ctx: GameContext, private readonly material: THREE.Material) {
    this.group.name = 'world-terrain'
    const r = resolution(ctx.quality.level)
    this.seg = r.seg
    this.farStep = r.farStep
    this.rocks = new RockLayer(ctx, this.group)
    this.buildFar()
  }

  isLoaded(cx: number, cz: number): boolean {
    if (cx < 0 || cz < 0 || cx >= CHUNKS_PER_SIDE || cz >= CHUNKS_PER_SIDE) return false
    return this.built.has(key(cx, cz))
  }

  rebuildForQuality(): void {
    const r = resolution(this.ctx.quality.level)
    for (const k of [...this.built.keys()]) this.unbuild(k)
    this.seg = r.seg
    if (r.farStep !== this.farStep) {
      this.farStep = r.farStep
      this.disposeFar()
      this.buildFar()
    }
    this.center = { x: Number.NaN, z: Number.NaN }
    this.farDirty = true
  }

  update(p: Vec3, indoor: boolean, budgetMs: number): void {
    const q = this.ctx.quality
    const r0 = indoor || q.level !== 'high' ? 1 : 2
    const r1 = Math.max(r0 + 1, q.lodRadius - (indoor ? 2 : 0))
    const jump = Math.hypot(p.x - this.center.x, p.z - this.center.z)
    const teleported = !(jump < 160)
    if (teleported || jump > 8) {
      this.center = { x: p.x, z: p.z }
      this.computeTargets(p, r0, r1)
    }

    const queue: { k: number; d: number }[] = []
    for (let k = 0; k < N_CHUNKS; k++) {
      const want = this.target[k]!
      const has = this.built.has(k)
      if (want === 0 && !has) {
        const cx = k % CHUNKS_PER_SIDE
        const cz = (k / CHUNKS_PER_SIDE) | 0
        const o = chunkOrigin(cx, cz)
        queue.push({ k, d: Math.hypot(o.x + CHUNK_SIZE / 2 - p.x, o.z + CHUNK_SIZE / 2 - p.z) })
      } else if (want !== 0 && has) {
        this.unbuild(k)
      }
    }
    queue.sort((a, b) => a.d - b.d)
    const t0 = performance.now()
    for (let i = 0; i < queue.length; i++) {
      if (!teleported && i > 0 && performance.now() - t0 > budgetMs) break
      this.build(queue[i]!.k)
    }

    for (let k = 0; k < N_CHUNKS; k++) {
      const actual: Lod = this.built.has(k) ? 0 : this.target[k] === 2 ? 2 : 1
      const prev = this.reported[k] as Lod
      if (actual === prev) continue
      this.reported[k] = actual
      this.rocksDirty = true
      const cx = k % CHUNKS_PER_SIDE
      const cz = (k / CHUNKS_PER_SIDE) | 0
      if (actual === 2) this.ctx.bus.emit('world:chunkUnloaded', { cx, cz })
      else this.ctx.bus.emit('world:chunkLoaded', { cx, cz, lod: actual })
    }

    this.updateFarStrides()
    if (this.farDirty) this.updateFarHoles()
    if (this.rocksDirty) this.updateRocks()
  }

  private computeTargets(p: Vec3, r0: number, r1: number): void {
    const hx = p.x / CHUNK_SIZE
    const hz = p.z / CHUNK_SIZE
    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const o = chunkOrigin(cx, cz)
        const d = Math.hypot(o.x / CHUNK_SIZE + 0.5 - hx, o.z / CHUNK_SIZE + 0.5 - hz)
        const k = key(cx, cz)
        const prev = this.target[k]!
        const keep0 = prev === 0 && d <= r0 + 0.9
        const keep1 = prev <= 1 && d <= r1 + 0.9
        this.target[k] = d <= r0 + 0.35 || keep0 ? 0 : d <= r1 + 0.35 || keep1 ? 1 : 2
      }
    }
  }

  private edgeHeight(x: number, z: number, onX: boolean): number {
    const s = this.farStep
    const t = onX ? z : x
    const t0 = Math.floor(t / s) * s
    const f = (t - t0) / s
    if (f < 1e-6) return onX ? heightAt(x, t0) : heightAt(t0, z)
    const a = onX ? heightAt(x, t0) : heightAt(t0, z)
    const b = onX ? heightAt(x, t0 + s) : heightAt(t0 + s, z)
    return a + (b - a) * f
  }

  private build(k: number): void {
    const cx = k % CHUNKS_PER_SIDE
    const cz = (k / CHUNKS_PER_SIDE) | 0
    const o = chunkOrigin(cx, cz)
    const seg = this.seg
    const step = CHUNK_SIZE / seg
    const gw = seg + 3
    const grid = new Float32Array(gw * gw)
    for (let j = 0; j < gw; j++) {
      for (let i = 0; i < gw; i++) grid[j * gw + i] = heightAt(o.x + (i - 1) * step, o.z + (j - 1) * step)
    }
    const vw = seg + 1
    const nMain = vw * vw
    const nSkirt = 4 * vw
    const pos = new Float32Array((nMain + nSkirt) * 3)
    const nor = new Float32Array((nMain + nSkirt) * 3)
    const col = new Float32Array((nMain + nSkirt) * 3)
    const heights = new Float32Array(nMain)
    for (let j = 0; j < vw; j++) {
      for (let i = 0; i < vw; i++) {
        const g = (j + 1) * gw + (i + 1)
        const wx = o.x + i * step
        const wz = o.z + j * step
        let h = grid[g]!
        heights[j + i * vw] = h
        if (i === 0 || i === seg) h = this.edgeHeight(wx, wz, true)
        else if (j === 0 || j === seg) h = this.edgeHeight(wx, wz, false)
        const nx = grid[g - 1]! - grid[g + 1]!
        const nz = grid[g - gw]! - grid[g + gw]!
        const ny = 2 * step
        const l = Math.hypot(nx, ny, nz)
        const v = j * vw + i
        pos[v * 3] = i * step
        pos[v * 3 + 1] = h
        pos[v * 3 + 2] = j * step
        nor[v * 3] = nx / l
        nor[v * 3 + 1] = ny / l
        nor[v * 3 + 2] = nz / l
        const c = surfaceColor(wx, wz, h, ny / l, this.tmpColor)
        col[v * 3] = c.r
        col[v * 3 + 1] = c.g
        col[v * 3 + 2] = c.b
      }
    }
    const edges: number[][] = [[], [], [], []]
    for (let t = 0; t < vw; t++) {
      edges[0]!.push(t)
      edges[1]!.push(seg * vw + t)
      edges[2]!.push(t * vw)
      edges[3]!.push(t * vw + seg)
    }
    const index: number[] = []
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * vw + i
        const b = a + 1
        const c = a + vw
        const d = c + 1
        index.push(a, c, b, b, c, d)
      }
    }
    let sv = nMain
    edges.forEach((edge, e) => {
      const base = sv
      for (const v of edge) {
        pos[sv * 3] = pos[v * 3]!
        pos[sv * 3 + 1] = pos[v * 3 + 1]! - SKIRT
        pos[sv * 3 + 2] = pos[v * 3 + 2]!
        for (let c = 0; c < 3; c++) {
          nor[sv * 3 + c] = nor[v * 3 + c]!
          col[sv * 3 + c] = col[v * 3 + c]! * 0.85
        }
        sv++
      }
      const flip = e === 0 || e === 3
      for (let t = 0; t < vw - 1; t++) {
        const a = edge[t]!
        const b = edge[t + 1]!
        const c = base + t
        const d = base + t + 1
        if (flip) index.push(a, b, c, b, d, c)
        else index.push(a, c, b, b, c, d)
      }
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setIndex(index)
    geo.computeBoundingSphere()
    const mesh = new THREE.Mesh(geo, this.material)
    mesh.name = `world-chunk-${cx}-${cz}`
    mesh.position.set(o.x, 0, o.z)
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    this.group.add(mesh)

    const { physics } = this.ctx
    const R = physics.rapier
    const groups = ((physics.groups.TERRAIN & 0xffff) << 16) | 0xffff
    const body = physics.world.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(o.x + CHUNK_SIZE / 2, 0, o.z + CHUNK_SIZE / 2),
    )
    const colliders: RAPIER.Collider[] = []
    if (SEABED_COLLIDERS) {
      const hf = physics.world.createCollider(
        R.ColliderDesc.heightfield(seg, seg, heights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE })
          .setCollisionGroups(groups)
          .setFriction(0.9),
        body,
      )
      physics.tag(hf, { kind: 'terrain', climbable: true, ownerId: `chunk-${cx}-${cz}` })
      colliders.push(hf)

      for (const r of this.rocksOf(cx, cz)) {
        if (Math.max(r.sx, r.sy, r.sz) < ROCK_COLLIDER_MIN) continue
        const desc = R.ColliderDesc.convexHull(this.rocks.scaledHull(r.variant, r.sx, r.sy, r.sz))
        if (!desc) continue
        desc
          .setTranslation(r.x - (o.x + CHUNK_SIZE / 2), r.y, r.z - (o.z + CHUNK_SIZE / 2))
          .setRotation({ x: r.quat.x, y: r.quat.y, z: r.quat.z, w: r.quat.w })
          .setCollisionGroups(groups)
        const c = physics.world.createCollider(desc, body)
        physics.tag(c, { kind: 'rock', climbable: true, ownerId: `rock-${cx}-${cz}` })
        colliders.push(c)
      }
    }

    this.built.set(k, { mesh, body, colliders })
    this.farDirty = true
  }

  private unbuild(k: number): void {
    const b = this.built.get(k)
    if (!b) return
    for (const c of b.colliders) this.ctx.physics.untag(c)
    this.ctx.physics.world.removeRigidBody(b.body)
    b.mesh.removeFromParent()
    b.mesh.geometry.dispose()
    this.built.delete(k)
    this.farDirty = true
  }

  private rocksOf(cx: number, cz: number): RockInstance[] {
    const k = key(cx, cz)
    let list = this.rockCache.get(k)
    if (!list) {
      list = rocksForChunk(this.ctx.rng(`world:rocks:${cx}:${cz}`), cx, cz)
      this.rockCache.set(k, list)
    }
    return list
  }

  private updateRocks(): void {
    this.rocksDirty = false
    const list: RockInstance[] = []
    for (let k = 0; k < N_CHUNKS; k++) {
      if (this.reported[k] === 2) continue
      for (const r of this.rocksOf(k % CHUNKS_PER_SIDE, (k / CHUNKS_PER_SIDE) | 0)) list.push(r)
    }
    this.rocks.rebuild(list)
  }

  private buildFar(): void {
    const step = this.farStep
    const cellsPerSide = (FAR_EXTENT * 2) / step
    const vps = cellsPerSide + 1
    const gw = vps + 2
    const grid = new Float32Array(gw * gw)
    for (let j = 0; j < gw; j++) {
      for (let i = 0; i < gw; i++) grid[j * gw + i] = heightAt(-FAR_EXTENT + (i - 1) * step, -FAR_EXTENT + (j - 1) * step)
    }
    const cells = cellsPerSide / FAR_TILES
    const tw = cells + 1
    for (let tz = 0; tz < FAR_TILES; tz++) {
      for (let tx = 0; tx < FAR_TILES; tx++) {
        const count = tw * tw + 4 * tw
        const pos = new Float32Array(count * 3)
        const nor = new Float32Array(count * 3)
        const col = new Float32Array(count * 3)
        for (let j = 0; j < tw; j++) {
          for (let i = 0; i < tw; i++) {
            const gi = tx * cells + i + 1
            const gj = tz * cells + j + 1
            const g = gj * gw + gi
            const h = grid[g]!
            const wx = -FAR_EXTENT + (gi - 1) * step
            const wz = -FAR_EXTENT + (gj - 1) * step
            const nx = grid[g - 1]! - grid[g + 1]!
            const nz = grid[g - gw]! - grid[g + gw]!
            const ny = 2 * step
            const l = Math.hypot(nx, ny, nz)
            const v = (j * tw + i) * 3
            pos[v] = wx
            pos[v + 1] = h
            pos[v + 2] = wz
            nor[v] = nx / l
            nor[v + 1] = ny / l
            nor[v + 2] = nz / l
            const c = surfaceColor(wx, wz, h, ny / l, this.tmpColor)
            col[v] = c.r
            col[v + 1] = c.g
            col[v + 2] = c.b
          }
        }
        for (let e = 0; e < 4; e++) {
          for (let k = 0; k < tw; k++) {
            const src = farEdgeVertex(e, k, cells) * 3
            const dst = (tw * tw + e * tw + k) * 3
            for (let c = 0; c < 3; c++) {
              pos[dst + c] = pos[src + c]!
              nor[dst + c] = nor[src + c]!
              col[dst + c] = col[src + c]!
            }
            pos[dst + 1] = pos[src + 1]! - FAR_SKIRT
          }
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
        const index = new THREE.BufferAttribute(new Uint32Array(cells * cells * 6 + 4 * cells * 12), 1)
        index.setUsage(THREE.DynamicDrawUsage)
        geo.setIndex(index)
        geo.computeBoundingSphere()
        const mesh = new THREE.Mesh(geo, this.material)
        mesh.name = `world-far-${tx}-${tz}`
        mesh.receiveShadow = true
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        this.group.add(mesh)
        this.far.push({ mesh, index, x0: -FAR_EXTENT + tx * cells * step, z0: -FAR_EXTENT + tz * cells * step, cells, stride: 1 })
      }
    }
    this.farDirty = true
  }

  private updateFarStrides(): void {
    const eye = this.ctx.camera.position
    const span = this.farStep
    for (const t of this.far) {
      const size = t.cells * span
      const dx = Math.max(t.x0 - eye.x, 0, eye.x - (t.x0 + size))
      const dz = Math.max(t.z0 - eye.z, 0, eye.z - (t.z0 + size))
      const d = Math.hypot(dx, dz)
      const stride = FAR_STRIDES.find(([max]) => d < max)![1]
      if (stride === t.stride) continue
      t.stride = stride
      this.farDirty = true
    }
  }

  private updateFarHoles(): void {
    this.farDirty = false
    const step = this.farStep
    for (const t of this.far) {
      const arr = t.index.array as Uint32Array
      const tw = t.cells + 1
      const s = t.stride
      const coarse = t.cells / s
      const hole = (ci: number, cj: number): boolean => {
        const cx = Math.floor((t.x0 + (ci + 0.5) * s * step + 1024) / CHUNK_SIZE)
        const cz = Math.floor((t.z0 + (cj + 0.5) * s * step + 1024) / CHUNK_SIZE)
        return cx >= 0 && cz >= 0 && cx < CHUNKS_PER_SIDE && cz < CHUNKS_PER_SIDE && this.built.has(key(cx, cz))
      }
      let n = 0
      for (let cj = 0; cj < coarse; cj++) {
        for (let ci = 0; ci < coarse; ci++) {
          if (hole(ci, cj)) continue
          const a = cj * s * tw + ci * s
          const b = a + s
          const c = a + s * tw
          const d = c + s
          arr[n++] = a; arr[n++] = c; arr[n++] = b
          arr[n++] = b; arr[n++] = c; arr[n++] = d
        }
      }
      for (let e = 0; e < 4; e++) {
        for (let k = 0; k < coarse; k++) {
          const ci = e < 2 ? k : e === 2 ? 0 : coarse - 1
          const cj = e < 2 ? (e === 0 ? 0 : coarse - 1) : k
          if (hole(ci, cj)) continue
          const a = farEdgeVertex(e, k * s, t.cells)
          const b = farEdgeVertex(e, k * s + s, t.cells)
          const la = tw * tw + e * tw + k * s
          const lb = la + s
          arr[n++] = a; arr[n++] = la; arr[n++] = b
          arr[n++] = b; arr[n++] = la; arr[n++] = lb
          arr[n++] = a; arr[n++] = b; arr[n++] = la
          arr[n++] = b; arr[n++] = lb; arr[n++] = la
        }
      }
      t.index.needsUpdate = true
      t.index.clearUpdateRanges()
      t.index.addUpdateRange(0, Math.max(n, 1))
      t.mesh.geometry.setDrawRange(0, n)
    }
  }

  private disposeFar(): void {
    for (const t of this.far) {
      t.mesh.removeFromParent()
      t.mesh.geometry.dispose()
    }
    this.far = []
  }

  dispose(): void {
    for (const k of [...this.built.keys()]) this.unbuild(k)
    this.disposeFar()
    this.rocks.dispose()
    this.group.removeFromParent()
  }
}
