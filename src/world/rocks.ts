import * as THREE from 'three'
import { CAMPS, CHUNK_SIZE, chunkOrigin, SONDES, VISTA, WORLD_HALF } from '../core/layout'
import type { GameContext } from '../core/types'
import { valueNoise } from './noise'
import { PAL, makeMaterial } from './surface'
import { blancWeight, heightAt, normalAt, routeDistance, smoothstep, VENT } from './terrain'
import { driftDeepShader } from './shade'

export type RockVariant = 0 | 1 | 2

export interface RockInstance {
  variant: RockVariant
  x: number; y: number; z: number
  sx: number; sy: number; sz: number
  quat: THREE.Quaternion
  color: THREE.Color
}

const CAPACITY: Record<RockVariant, number> = { 0: 3200, 1: 900, 2: 240 }

function rockGeometry(variant: RockVariant): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, variant === 0 ? 1 : 2)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const salt = 300 + variant * 7
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const k = 1 + 0.28 * valueNoise(v.x * 1.7 + v.y * 0.6, v.z * 1.7 - v.y * 0.9, salt)
      + 0.1 * valueNoise(v.x * 4.1, v.z * 4.1 + v.y * 3.3, salt + 1)
    v.multiplyScalar(k)
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25
    if (variant === 2) {
      const taper = 1 - 0.55 * THREE.MathUtils.clamp((v.y + 0.3) / 1.3, 0, 1)
      v.x *= taper
      v.z *= taper
      v.x += v.y * 0.18
    }
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const col = new THREE.Color()
  const moss = new THREE.Color().copy(PAL.herbe).lerp(PAL.herbeOmbre, 0.4)
  for (let i = 0; i < pos.count; i++) {
    const ny = nrm.getY(i)
    const y = pos.getY(i)
    col.setRGB(1, 1, 1)
    col.lerp(moss, smoothstep(0.55, 0.85, ny) * 0.6 * (variant === 0 ? 0.6 : 1))
    col.multiplyScalar(0.82 + 0.18 * smoothstep(-0.4, 0.6, y))
    colors.set([col.r, col.g, col.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

export function rockColor(x: number, z: number, out: THREE.Color, n: number): THREE.Color {
  out.copy(PAL.roche).lerp(PAL.rocheOmbre, 0.15 + 0.25 * n)
  const vent = 1 - smoothstep(150, 290, Math.hypot(x - VENT.x, z - VENT.z))
  out.lerp(PAL.fumee, vent * 0.75)
  out.lerp(PAL.blanc, blancWeight(z) * 0.85)
  return out
}

function rejected(x: number, z: number, variant: RockVariant): boolean {
  if (Math.abs(x) > WORLD_HALF - 40 || Math.abs(z) > WORLD_HALF - 40) return true
  const dr = routeDistance(x, z)
  if (variant > 0 && dr < 155) return true
  if (Math.hypot(x - VENT.x, z - VENT.z) < 50) return true
  if (Math.hypot(x, z) < 55) return true
  if (Math.hypot(x - VISTA.hero.x, z - VISTA.hero.z) < (variant === 0 ? 6 : 40)) return true
  for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < 28) return true
  for (const s of SONDES) if (Math.hypot(x - s.x, z - s.z) < 18) return true
  return false
}

export function rocksForChunk(rng: () => number, cx: number, cz: number): RockInstance[] {
  const o = chunkOrigin(cx, cz)
  const out: RockInstance[] = []
  const counts: [RockVariant, number][] = [
    [0, 5 + Math.floor(rng() * 7)],
    [1, 1 + Math.floor(rng() * 2.6)],
    [2, rng() < 0.35 ? 1 : 0],
  ]
  const up = new THREE.Vector3(0, 1, 0)
  const nrm = new THREE.Vector3()
  for (const [variant, count] of counts) {
    for (let i = 0; i < count; i++) {
      const x = o.x + rng() * CHUNK_SIZE
      const z = o.z + rng() * CHUNK_SIZE
      const r1 = rng()
      const r2 = rng()
      const r3 = rng()
      if (rejected(x, z, variant)) continue
      const n = normalAt(x, z, 1.5)
      let sx: number, sy: number, sz: number
      if (variant === 0) {
        const s = 0.6 + r1 * 1.4
        sx = s * (0.8 + r2 * 0.5); sy = s * (0.6 + r3 * 0.5); sz = s
      } else if (variant === 1) {
        const s = 3 + r1 * 4.5
        sx = s * (0.9 + r2 * 0.5); sy = s * (0.55 + r3 * 0.45); sz = s
      } else {
        sx = 5 + r1 * 3.5; sy = 14 + r2 * 13; sz = 3 + r3 * 2.5
      }
      nrm.set(n.x, n.y, n.z).lerp(up, variant === 2 ? 0.85 : 0.45).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(up, nrm)
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(up, rng() * Math.PI * 2))
      const y = heightAt(x, z) - sy * (variant === 2 ? 0.15 : 0.25)
      out.push({ variant, x, y, z, sx, sy, sz, quat, color: rockColor(x, z, new THREE.Color(), rng()) })
    }
  }
  return out
}

// One BatchedMesh so each rock is frustum-culled on its own, through a porthole as in the sortie.
export class RockLayer {
  readonly mesh: THREE.BatchedMesh
  readonly hullPoints: Float32Array[]
  private readonly geometryIds: number[] = []
  private readonly m = new THREE.Matrix4()
  private readonly p = new THREE.Vector3()
  private readonly s = new THREE.Vector3()

  constructor(ctx: GameContext, parent: THREE.Object3D) {
    const material = makeMaterial(ctx, { color: 0xffffff, vertexColors: true, onShader: driftDeepShader })
    const geos = ([0, 1, 2] as RockVariant[]).map(rockGeometry)
    this.hullPoints = geos.map((g) => new Float32Array((g.getAttribute('position') as THREE.BufferAttribute).array))
    const vertices = geos.reduce((n, g) => n + g.getAttribute('position').count, 0)
    const capacity = CAPACITY[0] + CAPACITY[1] + CAPACITY[2]
    this.mesh = new THREE.BatchedMesh(capacity, vertices, 0, material)
    for (const g of geos) {
      this.geometryIds.push(this.mesh.addGeometry(g))
      g.dispose()
    }
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.name = 'world-rocks'
    parent.add(this.mesh)
  }

  rebuild(rocks: Iterable<RockInstance>): void {
    const counts = [0, 0, 0]
    let used = 0
    const mesh = this.mesh
    for (const r of rocks) {
      if (counts[r.variant]! >= CAPACITY[r.variant]) continue
      counts[r.variant]!++
      const geometryId = this.geometryIds[r.variant]!
      if (used < mesh.instanceCount) mesh.setGeometryIdAt(used, geometryId).setVisibleAt(used, true)
      else mesh.addInstance(geometryId)
      this.m.compose(this.p.set(r.x, r.y, r.z), r.quat, this.s.set(r.sx, r.sy, r.sz))
      mesh.setMatrixAt(used, this.m)
      mesh.setColorAt(used, r.color)
      used++
    }
    for (let i = used; i < mesh.instanceCount; i++) mesh.setVisibleAt(i, false)
  }

  scaledHull(variant: RockVariant, sx: number, sy: number, sz: number): Float32Array {
    const src = this.hullPoints[variant]!
    const out = new Float32Array(src.length)
    for (let i = 0; i < src.length; i += 3) {
      out[i] = src[i]! * sx
      out[i + 1] = src[i + 1]! * sy
      out[i + 2] = src[i + 2]! * sz
    }
    return out
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.dispose()
    const mat = this.mesh.material
    if (!Array.isArray(mat)) mat.dispose()
  }
}
