import * as THREE from 'three'
import { hashString, mulberry32 } from '../../core/rng'
import { GeoBuilder, UNIT } from '../../drift/builder'
import { bakeGlow, glowMaterial, instanceGlow, LampGrid, lightAt, type BakeLamp } from '../../drift/city/glow'
import type { Mats } from '../../drift/materials'
import { SURF } from '../../drift/surface'
import { ARCHETYPES } from '../archetypes'
import type { BuiltPart, DressFn, DistrictShell, LampSpec } from '../types'
import { buildLamps } from './lamps'
import { collidersOf, isSolid, planDressing, type Bulb, type Pipe, type DressPlan, type PropKind, type PropPlacement } from './plan'
import { buildProp } from './props'
import { DRESS } from './tuning'
import { buildVfx, type VfxUniforms } from './vfx'

const glowCache = new WeakMap<Mats, THREE.Material>()
const glow = (mats: Mats) => {
  let m = glowCache.get(mats)
  if (!m) glowCache.set(mats, (m = glowMaterial(mats, { rim: 0.3 })))
  return m
}

let shared: { bulb: THREE.MeshBasicMaterial; pool: THREE.MeshBasicMaterial; porthole: THREE.MeshBasicMaterial; disc: THREE.BufferGeometry; flat: THREE.BufferGeometry } | null = null

function radialTexture(draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  if (!g) throw new Error('2d context unavailable')
  draw(g, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function sharedAssets() {
  shared ??= {
    bulb: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    pool: new THREE.MeshBasicMaterial({
      map: radialTexture((g, s) => {
        const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(0.45, 'rgba(255,255,255,0.45)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, s, s)
      }),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2,
    }),
    porthole: new THREE.MeshBasicMaterial({
      map: radialTexture((g, s) => {
        const h = s / 2
        g.fillStyle = '#6a4e3a'
        g.beginPath(); g.arc(h, h, h - 1, 0, Math.PI * 2); g.fill()
        const grad = g.createRadialGradient(h * 0.8, h * 0.8, 2, h, h, h * 0.78)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(1, '#c9c2b4')
        g.fillStyle = grad
        g.beginPath(); g.arc(h, h, h * 0.78, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#b08a64'
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          g.beginPath(); g.arc(h + Math.cos(a) * h * 0.89, h + Math.sin(a) * h * 0.89, 3, 0, Math.PI * 2); g.fill()
        }
      }),
      transparent: true, alphaTest: 0.5,
    }),
    disc: new THREE.CircleGeometry(1, 16),
    flat: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
  }
  return shared
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const _e = new THREE.Euler()
const UP = new THREE.Vector3(0, 1, 0)
const WIRE = new THREE.CylinderGeometry(1, 1, 1, 3, 1, true)

function bakeLamp(l: LampSpec): BakeLamp {
  return { x: l.at.x, y: l.at.y, z: l.at.z, color: new THREE.Color(l.color), radius: l.radius * DRESS.lampBake.radius, power: DRESS.lampBake.power }
}

function propMesh(kind: PropKind, geo: THREE.BufferGeometry, list: readonly PropPlacement[], mat: THREE.Material, grid: LampGrid, base: THREE.Color, sky: (p: PropPlacement) => number): THREE.InstancedMesh {
  const glowA = new Float32Array(list.length * 3)
  const skyA = new Float32Array(list.length)
  const im = new THREE.InstancedMesh(geo, mat, list.length)
  list.forEach((p, i) => {
    im.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q.setFromAxisAngle(UP, p.rot), _s.setScalar(p.s)))
    im.setColorAt(i, _c.setScalar(p.tint))
    const cy = p.y + 0.6 * p.s
    lightAt(p.x, cy, p.z, 0, 1, 0, grid.near(p.x, cy, p.z), base, _c).toArray(glowA, i * 3)
    skyA[i] = sky(p)
  })
  instanceGlow(geo, glowA, skyA)
  im.computeBoundingSphere()
  im.name = `habillage:${kind}`
  return im
}

const trisOf = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3

const thin = (list: readonly PropPlacement[], keep: number) => (keep >= 1 ? [...list] : list.filter((_, i) => ((i * 0.6180339) % 1) < keep))

// Over the triangle budget, decorative kinds lose instances first, then solid ones; colliders follow what is kept.
function thinToBudget(byKind: ReadonlyMap<PropKind, PropPlacement[]>, geos: ReadonlyMap<PropKind, THREE.BufferGeometry>): Map<PropKind, PropPlacement[]> {
  let decor = 0
  let solid = 0
  for (const [k, list] of byKind) {
    const t = trisOf(geos.get(k)!) * list.length
    if (isSolid(k)) solid += t
    else decor += t
  }
  const budget = DRESS.budget.propTriangles
  const keepDecor = decor === 0 ? 1 : Math.min(1, Math.max(DRESS.budget.minKeep, (budget - solid) / decor))
  const keepSolid = solid === 0 ? 1 : Math.min(1, Math.max(DRESS.budget.minKeep, (budget - decor * keepDecor) / solid))
  return new Map([...byKind].map(([k, list]) => [k, thin(list, isSolid(k) ? keepSolid : keepDecor)] as const))
}

function clothGeometry(plan: DressPlan): THREE.BufferGeometry | null {
  if (plan.cloth.length === 0 && plan.wires.length === 0) return null
  const b = new GeoBuilder()
  b.jitter = 0.06
  b.with(SURF.fabric, () => {
    for (const c of plan.cloth) {
      _q.setFromEuler(_e.set(c.pitch, c.rot, 0, 'YXZ'))
      b.add(UNIT.box, _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(c.w, c.h, c.t ?? 0.018)), c.color)
    }
  })
  const dir = new THREE.Vector3()
  for (const w of plan.wires) {
    dir.set(w.b.x - w.a.x, w.b.y - w.a.y, w.b.z - w.a.z)
    const len = dir.length()
    if (len < 1e-3) continue
    _q.setFromUnitVectors(UP, dir.divideScalar(len))
    b.add(WIRE, _m.compose(_p.set((w.a.x + w.b.x) / 2, (w.a.y + w.b.y) / 2, (w.a.z + w.b.z) / 2), _q, _s.set(w.r, len, w.r)), 0x5e4a3a)
  }
  return b.build()
}

function pipeGeometry(b: GeoBuilder, pipes: readonly Pipe[]): void {
  const dir = new THREE.Vector3()
  b.with(SURF.steel, () => {
    for (const p of pipes) {
      dir.set(p.b.x - p.a.x, p.b.y - p.a.y, p.b.z - p.a.z)
      const len = dir.length()
      if (len < 1e-3) continue
      dir.divideScalar(len)
      _q.setFromUnitVectors(UP, dir)
      b.add(UNIT.cylLow, _m.compose(_p.set((p.a.x + p.b.x) / 2, (p.a.y + p.b.y) / 2, (p.a.z + p.b.z) / 2), _q, _s.set(p.r, len, p.r)), p.color)
      if (p.brackets === 0) continue
      const yaw = Math.atan2(dir.x, dir.z)
      for (let i = 0; i <= p.brackets; i++) {
        const t = i / p.brackets
        const x = p.a.x + (p.b.x - p.a.x) * t
        const z = p.a.z + (p.b.z - p.a.z) * t
        b.box(x, p.a.y, z, 0.12, p.r * 2 + 0.06, 0.06, 0x3e3a4a, yaw)
        b.add(UNIT.cylLow, _m.compose(_p.set(x, p.a.y, z), _q, _s.set(p.r * 1.3, 0.06, p.r * 1.3)), p.color === 0xc98a5a ? 0xd9b48f : 0x52576a)
      }
    }
  })
}

function bulbMesh(bulbs: readonly Bulb[], mat: THREE.Material): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, bulbs.length)
  bulbs.forEach((b, i) => {
    im.setMatrixAt(i, _m.compose(_p.set(b.x, b.y, b.z), _q.identity(), _s.setScalar(b.size)))
    im.setColorAt(i, _c.set(b.color).multiplyScalar(1.7))
  })
  im.computeBoundingSphere()
  im.name = 'habillage:ampoules'
  return im
}

function poolMesh(plan: DressPlan, mat: THREE.Material, geo: THREE.BufferGeometry): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, plan.pools.length)
  plan.pools.forEach((p, i) => {
    im.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(p.r, 1, p.r)))
    im.setColorAt(i, _c.set(p.color).multiplyScalar(p.opacity))
  })
  im.computeBoundingSphere()
  im.name = 'habillage:flaques-de-lumiere'
  return im
}

function portholeMesh(plan: DressPlan, mat: THREE.Material, geo: THREE.BufferGeometry): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, plan.portholes.length)
  const look = new THREE.Vector3()
  const obj = new THREE.Object3D()
  plan.portholes.forEach((h, i) => {
    obj.position.set(h.x, h.y, h.z)
    obj.lookAt(look.set(h.x + h.nx, h.y, h.z + h.nz))
    obj.scale.setScalar(DRESS.skin.radius)
    obj.updateMatrix()
    im.setMatrixAt(i, obj.matrix)
    im.setColorAt(i, _c.set(h.color).multiplyScalar(h.lit ? 1.35 : 0.55))
  })
  im.computeBoundingSphere()
  im.name = 'habillage:hublots'
  return im
}

function trianglesOf(o: THREE.Object3D): number {
  if (!(o instanceof THREE.Mesh)) return 0
  return trisOf(o.geometry as THREE.BufferGeometry) * (o instanceof THREE.InstancedMesh ? o.count : 1)
}

function ambientOf(shell: DistrictShell, k: number): THREE.Color {
  const [top, bottom] = ARCHETYPES[shell.plan.archetype].light.ambiance
  return new THREE.Color(bottom).lerp(new THREE.Color(top), 0.35).multiplyScalar(k)
}

export const dress: DressFn = function* (input, host) {
  const t0 = performance.now()
  const plan = planDressing(input)
  yield
  const { shell } = input
  const group = new THREE.Group()
  group.name = `habillage:${shell.plan.id}`
  const mat = glow(host.mats)
  const grid = new LampGrid([...shell.lamps, ...plan.bakeLamps].map(bakeLamp))
  const base = ambientOf(shell, plan.ambient)
  const glassCells = new Set(shell.cells.filter((c) => c.glass).map((c) => c.id))
  const glassAt = (p: PropPlacement) => (shell.cells.some((c) => glassCells.has(c.id) && c.boxes.some((b) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1 && p.y >= b.y0 && p.y <= b.y1)) ? DRESS.skyGlass : 0)
  const owned: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

  const byKind = new Map<PropKind, PropPlacement[]>()
  for (const p of plan.props) {
    const list = byKind.get(p.kind)
    if (list) list.push(p)
    else byKind.set(p.kind, [p])
  }
  const geos = new Map([...byKind.keys()].map((k) => [k, buildProp(k, plan.palette)] as const))
  const kept: PropPlacement[] = []
  for (const [kind, list] of thinToBudget(byKind, geos)) {
    kept.push(...list)
    if (list.length === 0) {
      geos.get(kind)!.dispose()
      continue
    }
    const im = propMesh(kind, geos.get(kind)!, list, mat, grid, base, glassAt)
    owned.push(im.geometry)
    group.add(im)
    yield
  }

  const merged = (b: GeoBuilder | THREE.BufferGeometry | null, name: string) => {
    const geo = b instanceof GeoBuilder ? (b.vertexCount > 0 ? b.build() : null) : b
    if (!geo) return
    bakeGlow(geo, grid.near, base, null)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = name
    mesh.matrixAutoUpdate = false
    owned.push(geo)
    group.add(mesh)
  }
  merged(clothGeometry(plan), 'habillage:tissus')
  yield
  const fittings = new GeoBuilder()
  pipeGeometry(fittings, plan.pipes)
  const bulbs = [...plan.bulbs, ...buildLamps(fittings, plan.lamps, plan.palette)]
  merged(fittings, 'habillage:luminaires')
  yield

  const assets = sharedAssets()
  if (bulbs.length > 0) {
    const im = bulbMesh(bulbs, assets.bulb)
    owned.push(im.geometry)
    group.add(im)
  }
  if (plan.pools.length > 0) group.add(poolMesh(plan, assets.pool, assets.flat))
  if (plan.portholes.length > 0) group.add(portholeMesh(plan, assets.porthole, assets.disc))
  yield

  const render = host.ctx.services.render
  const u: VfxUniforms = { uTime: render ? render.uniforms.uTime : { value: 0 }, uBurst: { value: 0 }, uScale: { value: 620 } }
  const vrng = mulberry32((shell.plan.seed ^ hashString('vfx')) >>> 0)
  for (const pts of buildVfx(plan.emitters, DRESS.particles[host.ctx.quality.level], vrng, u)) {
    owned.push(pts.geometry)
    materials.push(pts.material as THREE.Material)
    group.add(pts)
  }

  const events = ARCHETYPES[shell.plan.archetype].events.flatMap((e) => e.hours)
  const burstWindow = DRESS.burstMinutes / 60
  let triangles = 0
  group.traverse((o) => { triangles += trianglesOf(o) })
  const part: BuiltPart = {
    group,
    stats: { draws: group.children.length, triangles, geometries: owned.length, buildMs: performance.now() - t0 },
    lamps: [...plan.bakeLamps],
    colliders: collidersOf(kept),
    update(dt, hours) {
      if (!render) u.uTime.value += dt
      const since = events.reduce((m, h) => Math.min(m, (((hours - h) % 24) + 24) % 24), 24)
      u.uBurst.value = since < burstWindow ? 1 - since / burstWindow : 0
    },
    dispose() {
      group.removeFromParent()
      for (const g of owned) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
  return part
}
