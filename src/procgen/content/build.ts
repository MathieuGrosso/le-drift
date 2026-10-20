import * as THREE from 'three'
import { mulberry32 } from '../../core/rng'
import { GeoBuilder } from '../../drift/builder'
import { bakeGlow, glowMaterial, type BakeLamp } from '../../drift/city/glow'
import type { Anchor, Mats } from '../../drift/procgen-hook'
import { ARCHETYPES } from '../archetypes'
import type { BuildContentFn, ContentPoint, DistrictPlan, LandmarkPlacement, Rng, Spot } from '../types'
import { Kb, buildFar, buildKit, type KitLamp, type KitPalette } from './kits'
import { MICRO_DEFIS, type MicroDefi } from './tuning'
import { placeDefi, type DefiMat, type DefiPlaced } from './defis'
import { districtContent } from './catalogue'
import { COQUE_KIT, kitDef, kitScale, vaultY } from './landmarks'
import { BEACON, KIND_GLOW } from './tuning'

const SHIFT = { hue: 8 / 360, value: 0.06 } as const
const SIGN = { w: 2.4, h: 0.6, px: 512, row: 96, font: '600 52px Georgia, serif', ink: '#3e3a5a', paper: '#f1e4c8' } as const
const TROUVAILLE = { bob: 0.12, speed: 1.6, spin: 0.9, size: 0.22, poll: 0.5, lift: 0.2 } as const
const NET_MESH = 0.35
const LAMP_POWER = 0.6
const CORDE = 0xc9a66b
const SOMBRE = 0x4a3c48
const VITRE = 0x9fd6d0

interface SharedMats { glow: THREE.Material; lit: THREE.Material }
const shared = new WeakMap<Mats, SharedMats>()
function materials(mats: Mats): SharedMats {
  let m = shared.get(mats)
  if (!m) {
    m = { glow: glowMaterial(mats), lit: mats.water(new THREE.MeshBasicMaterial({ vertexColors: true })) }
    shared.set(mats, m)
  }
  return m
}

function shift(hex: number, h: number, v: number): number {
  const c = new THREE.Color(hex)
  c.offsetHSL(h, 0, 0)
  return c.multiplyScalar(1 + v).getHex()
}

export function districtPalette(plan: DistrictPlan): KitPalette {
  const a = ARCHETYPES[plan.archetype]
  const rng = mulberry32(plan.seed ^ 0x70616c)
  const h = (rng() * 2 - 1) * SHIFT.hue
  const v = (rng() * 2 - 1) * SHIFT.value
  const s = (x: number) => shift(x, h, v)
  return {
    mur: s(a.palette.mur), bois: s(a.palette.bois), metal: s(a.palette.metal), tissu: a.palette.tissu.map(s),
    accent: s(a.palette.accent), lampe: a.light.lampe, glow: VITRE,
  }
}

function frameOf(at: Spot, scale = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(at.x, at.y, at.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), at.yaw), new THREE.Vector3(scale, scale, scale))
}

// A warm lantern hung from the vault over every landmark: the tallest lit thing of its district, even over a low kit.
function beacon(k: Kb, plan: DistrictPlan, l: LandmarkPlacement, p: KitPalette, far: boolean): void {
  const def = kitDef(l.kit)
  const top = l.at.y + def.h * kitScale(def, plan, l.at.y)
  const vault = vaultY(plan)
  const y = Math.min(vault - BEACON.under, Math.max(top + BEACON.gap, l.at.y + BEACON.minLift))
  const { x, z } = l.at
  k.beam([x, vault, z], [x, y + BEACON.body, z], 0.08, p.metal)
  k.ball(x, y, z, BEACON.body, BEACON.color, true)
  k.cone(x, y + BEACON.body * 0.8, z, BEACON.body * 1.3, BEACON.body * 0.9, p.metal)
  if (far) return
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    k.beam([x + Math.cos(a) * BEACON.body, y - BEACON.body, z + Math.sin(a) * BEACON.body], [x + Math.cos(a) * BEACON.body, y + BEACON.body, z + Math.sin(a) * BEACON.body], 0.07, p.metal)
  }
  for (let i = 0; i < BEACON.satellites; i++) {
    const a = (i / BEACON.satellites) * Math.PI * 2 + l.at.yaw
    const sx = x + Math.cos(a) * BEACON.satSpread
    const sz = z + Math.sin(a) * BEACON.satSpread
    const sy = y - BEACON.satDrop * (1 + (i % 2))
    k.beam([x, y + BEACON.body, z], [sx, sy + BEACON.satR, sz], 0.04, p.metal)
    k.ball(sx, sy, sz, BEACON.satR, BEACON.color, true)
  }
  k.lamps.push({ x, y, z, color: BEACON.color, radius: BEACON.radius, power: BEACON.power })
}

function drawAnchor(k: Kb, a: Anchor, p: KitPalette): void {
  switch (a.kind) {
    case 'ladder': {
      const sx = -a.normal.z * 0.25
      const sz = a.normal.x * 0.25
      for (const s of [-1, 1]) k.beam([a.bottom.x + sx * s, a.bottom.y, a.bottom.z + sz * s], [a.top.x + sx * s, a.top.y + 0.9, a.top.z + sz * s], 0.07, p.metal)
      for (let y = a.bottom.y + 0.3; y < a.top.y; y += 0.35) k.beam([a.bottom.x - sx, y, a.bottom.z - sz], [a.bottom.x + sx, y, a.bottom.z + sz], 0.05, p.bois)
      return
    }
    case 'zip':
      k.beam([a.from.x, a.from.y + 1.6, a.from.z], [a.to.x, a.to.y + 1.6, a.to.z], 0.05, SOMBRE)
      k.box(a.to.x, a.to.y + 0.9, a.to.z, 0.2, 1.8, 0.2, p.bois)
      return
    case 'slide':
      for (let i = 1; i < a.path.length; i++) {
        const u = a.path[i - 1]!
        const w = a.path[i]!
        k.beam([u.x, u.y - 0.2, u.z], [w.x, w.y - 0.2, w.z], 1.1, p.accent)
      }
      return
    default:
  }
}

type PointKit = (k: Kb, p: KitPalette, rng: Rng) => void
const POINT_KITS: Partial<Record<ContentPoint['kind'], PointKit>> = {
  banc: (k, p) => {
    k.box(0, 0.42, 0, 1.6, 0.08, 0.45, p.bois)
    k.box(0, 0.8, -0.2, 1.6, 0.4, 0.06, p.bois)
    for (const x of [-0.7, 0.7]) k.box(x, 0.2, 0, 0.08, 0.4, 0.4, p.bois)
  },
  rechaud: (k, p) => {
    k.cyl(0, 0.35, 0, 0.45, 0.7, SOMBRE)
    k.cyl(0, 0.72, 0, 0.32, 0.06, 0xff8a3a, 'y', true)
    k.cyl(0, 0.95, 0, 0.36, 0.42, p.metal)
    k.lamp(0, 0.9, 0.5, 0xff9e5e, 0.08, 4)
  },
  chat: (k, _p, rng) => {
    const c = rng() < 0.5 ? 0x3a3030 : 0xd89a5a
    k.ball(0, 0.22, 0, 0.26, c, false, 0.2)
    k.ball(0.22, 0.42, 0, 0.14, c)
    k.cone(0.26, 0.52, 0.06, 0.05, 0.1, c)
    k.cone(0.26, 0.52, -0.06, 0.05, 0.1, c)
    k.beam([-0.22, 0.2, 0], [-0.4, 0.5, 0.15], 0.05, c)
  },
  hamac: (k, p, rng) => {
    for (const x of [-1.6, 1.6]) k.box(x, 1.1, 0, 0.12, 2.2, 0.12, p.bois)
    k.box(0, 0.85, 0, 2.8, 0.1, 0.9, p.tissu[Math.floor(rng() * p.tissu.length)] ?? p.accent)
  },
  raccourci: (k, p) => {
    k.ring(0, 0.15, 0, 0.35, 0.08, CORDE, 'y', 8)
    k.beam([0, 0.2, 0], [0, 2.6, 0], 0.06, CORDE)
    k.box(0, 2.7, 0, 0.6, 0.12, 0.6, p.metal)
  },
  vista: (k, p) => {
    for (const a of [0, 2.1, 4.2]) k.beam([0, 1.2, 0], [Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35], 0.04, p.bois)
    k.beam([0, 1.25, -0.1], [0, 1.35, 0.5], 0.09, p.metal)
  },
  demande: (k, p) => {
    k.box(0, 1.1, 0, 0.08, 2.2, 0.08, p.bois)
    k.beam([0, 2.1, 0], [0.4, 2.1, 0], 0.05, p.bois)
    k.lamp(0.4, 1.85, 0, p.lampe, 0.12, 5)
    k.box(-0.5, 0.25, 0.2, 0.5, 0.5, 0.5, p.bois, 0.3)
  },
  panneau: (k, p) => {
    k.box(0, 1.1, -0.04, 0.1, 2.2, 0.08, p.bois)
  },
  coque: (k, p, rng) => buildKit(COQUE_KIT, k, p, rng),
}

const isDefi = (v: unknown): v is MicroDefi => typeof v === 'string' && (MICRO_DEFIS as readonly string[]).includes(v)

export function defiOf(pt: ContentPoint): DefiPlaced | null {
  const d = pt.data
  if (!d || !isDefi(d.defi)) return null
  const n = (k: string) => Number(d[k] ?? 0)
  return placeDefi(pt.id, d.defi, { x: n('bx'), y: n('by'), z: n('bz'), yaw: n('byaw') }, n('hauteur'))
}

function drawDefi(k: Kb, d: DefiPlaced, p: KitPalette): void {
  const color: Record<DefiMat, number> = { bois: p.bois, metal: p.metal, accent: p.accent, tissu: p.tissu[0] ?? p.accent, corde: CORDE, sombre: SOMBRE }
  if (d.lampLocal) k.lamp(d.lampLocal.x, d.lampLocal.y, d.lampLocal.z, p.lampe, 0.16, 5)
  for (const part of d.parts) {
    const { at, size } = part
    const c = color[part.mat]
    if (part.shape === 'ring') k.ring(at.x, at.y, at.z, size.x / 2, size.y, c, 'z', 12)
    else if (part.shape === 'cyl') k.cyl(at.x, at.y, at.z, size.x / 2, size.y, c)
    else if (part.solid === 'net') {
      const x0 = at.x - size.x / 2
      const y0 = at.y - size.y / 2
      for (let x = x0; x <= x0 + size.x + 1e-3; x += NET_MESH) k.beam([x, y0, at.z], [x, y0 + size.y, at.z], 0.03, c)
      for (let y = y0; y <= y0 + size.y + 1e-3; y += NET_MESH) k.beam([x0, y, at.z], [x0 + size.x, y, at.z], 0.03, c)
    } else k.box(at.x, at.y, at.z, size.x, size.y, size.z, c)
  }
}

function signTexture(names: readonly string[]): THREE.CanvasTexture | null {
  if (typeof document === 'undefined' || names.length === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = SIGN.px
  canvas.height = SIGN.row * names.length
  const g = canvas.getContext('2d')
  if (!g) return null
  names.forEach((n, i) => {
    g.fillStyle = SIGN.paper
    g.fillRect(0, i * SIGN.row, SIGN.px, SIGN.row)
    g.strokeStyle = SIGN.ink
    g.lineWidth = 4
    g.strokeRect(6, i * SIGN.row + 6, SIGN.px - 12, SIGN.row - 12)
    g.fillStyle = SIGN.ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 52
    g.font = SIGN.font
    while (g.measureText(n).width > SIGN.px - 40 && size > 22) {
      size -= 2
      g.font = SIGN.font.replace('52px', `${size}px`)
    }
    g.fillText(n, SIGN.px / 2, i * SIGN.row + SIGN.row / 2 + 2)
  })
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function signGeometry(points: readonly ContentPoint[]): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const n = points.length
  points.forEach((pt, i) => {
    const m = frameOf(pt.at)
    const v0 = 1 - (i + 1) / n
    const v1 = 1 - i / n
    const base = pos.length / 3
    for (const [x, y, u, v] of [[-1, 0, 0, v0], [1, 0, 1, v0], [1, 1, 1, v1], [-1, 1, 0, v1]] as const) {
      const p = new THREE.Vector3((x * SIGN.w) / 2, 1.7 + y * SIGN.h, 0.02).applyMatrix4(m)
      pos.push(p.x, p.y, p.z)
      uv.push(u, v)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

function triangles(g: THREE.BufferGeometry, instances = 1): number {
  return ((g.index?.count ?? g.getAttribute('position').count) / 3) * instances
}

export const buildContent: BuildContentFn = function* (content, shell, host) {
  const t0 = performance.now()
  const plan = shell.plan
  const pal = districtPalette(plan)
  const rng = mulberry32(plan.seed ^ 0x6b697473)
  const group = new THREE.Group()
  group.name = `contenu:${content.district}`
  const o = new GeoBuilder()
  const e = new GeoBuilder()
  o.jitter = 0.035
  e.jitter = 0
  const lamps: KitLamp[] = []

  for (const l of content.landmarks) {
    const def = kitDef(l.kit)
    const k = new Kb(o, e, frameOf(l.at, kitScale(def, plan, l.at.y)))
    buildKit(l.kit, k, pal, rng)
    lamps.push(...k.lamps)
    yield
  }
  const world = new Kb(o, e, new THREE.Matrix4())
  for (const l of content.landmarks) beacon(world, plan, l, pal, false)
  for (const a of content.anchors) if (!a.id.includes('/banc-') && !a.id.includes('/hamac-')) drawAnchor(world, a, pal)
  lamps.push(...world.lamps)
  for (const pt of content.points) {
    const defi = pt.kind === 'trouvaille' ? defiOf(pt) : null
    if (defi) {
      const k = new Kb(o, e, frameOf(defi.at))
      drawDefi(k, defi, pal)
      lamps.push(...k.lamps)
    }
    const fn = POINT_KITS[pt.kind]
    if (!fn) continue
    const k = new Kb(o, e, frameOf(pt.at))
    fn(k, pal, rng)
    lamps.push(...k.lamps)
  }
  yield

  const geometries: THREE.BufferGeometry[] = []
  const disposables: { dispose(): void }[] = []
  const { glow, lit } = materials(host.mats)
  const base = new THREE.Color(ARCHETYPES[plan.archetype].light.ambiance[0]).multiplyScalar(0.5)
  const bake: BakeLamp[] = lamps.map((l) => ({ x: l.x, y: l.y, z: l.z, color: new THREE.Color(l.color), radius: l.radius, power: l.power ?? LAMP_POWER }))
  const addMesh = (b: GeoBuilder, mat: THREE.Material, name: string, baked: boolean) => {
    if (b.vertexCount === 0) return
    const geo = b.build()
    if (baked) bakeGlow(geo, () => bake, base, null)
    geometries.push(geo)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = `${name}:${content.district}`
    mesh.matrixAutoUpdate = false
    group.add(mesh)
  }
  addMesh(o, glow, 'reperes', true)
  yield
  addMesh(e, lit, 'reperes-lum', false)

  const signs = content.points.filter((p) => p.kind === 'panneau' && p.nom)
  const tex = signTexture(signs.map((s) => s.nom!))
  if (tex) {
    const sg = signGeometry(signs)
    const sm = new THREE.MeshBasicMaterial({ map: tex })
    geometries.push(sg)
    disposables.push(tex, sm)
    const mesh = new THREE.Mesh(sg, sm)
    mesh.name = `panneaux:${content.district}`
    mesh.matrixAutoUpdate = false
    group.add(mesh)
  }

  const tr = content.points.filter((p) => p.kind === 'trouvaille')
  let trMesh: THREE.InstancedMesh | null = null
  if (tr.length > 0) {
    const tg = new THREE.OctahedronGeometry(TROUVAILLE.size, 0)
    const tm = new THREE.MeshBasicMaterial({ color: KIND_GLOW.trouvaille ?? 0xffd27a })
    geometries.push(tg)
    disposables.push(tm)
    trMesh = new THREE.InstancedMesh(tg, tm, tr.length)
    trMesh.name = `trouvailles:${content.district}`
    trMesh.userData.ids = tr.map((p) => p.id)
    trMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(trMesh)
  }

  const taken = new Set<string>()
  const dummy = new THREE.Object3D()
  let time = 0
  let poll = 0
  const placeTrouvailles = () => {
    if (!trMesh) return
    tr.forEach((p, i) => {
      dummy.position.set(p.at.x, p.at.y + TROUVAILLE.lift + Math.sin(time * TROUVAILLE.speed + i) * TROUVAILLE.bob, p.at.z)
      dummy.rotation.set(0, time * TROUVAILLE.spin + i, 0)
      dummy.scale.setScalar(taken.has(p.id) ? 0 : 1)
      dummy.updateMatrix()
      trMesh!.setMatrixAt(i, dummy.matrix)
    })
    trMesh.instanceMatrix.needsUpdate = true
  }
  const refreshTaken = () => {
    for (const id of host.ctx.state.trouvailles) if (id.startsWith('tr-') || id.startsWith('trouvaille:')) taken.add(id.replace(/^trouvaille:/, ''))
    for (const id of Object.keys(host.ctx.state.inventory.items)) if (id.startsWith('trouvaille:')) taken.add(id.slice('trouvaille:'.length))
  }
  refreshTaken()
  placeTrouvailles()

  const meshes = group.children.length
  return {
    group,
    stats: {
      draws: meshes,
      triangles: geometries.reduce((s, g) => s + triangles(g, g === trMesh?.geometry ? tr.length : 1), 0),
      geometries: geometries.length,
      buildMs: performance.now() - t0,
    },
    update(dt) {
      time += dt
      poll -= dt
      if (poll <= 0) {
        poll = TROUVAILLE.poll
        refreshTaken()
      }
      placeTrouvailles()
    },
    dispose() {
      group.removeFromParent()
      for (const g of geometries) g.dispose()
      for (const d of disposables) d.dispose()
      trMesh?.dispose()
    },
  }
}

interface FarRange { start: number; count: number; saved: Float32Array | null }

// Two draws for every landmark of the ship, drawn with the far silhouette (docs/MONDE.md §4.3).
// Hiding a built district collapses its vertex range instead of splitting the mesh.
export function buildFarLandmarks(plans: readonly DistrictPlan[], mats: Mats): { group: THREE.Group; hide(district: string, hidden: boolean): void; dispose(): void } {
  const group = new THREE.Group()
  group.name = 'reperes-lointains'
  const { glow, lit } = materials(mats)
  const o = new GeoBuilder()
  const e = new GeoBuilder()
  o.jitter = 0
  e.jitter = 0
  const ranges = new Map<string, [FarRange, FarRange]>()
  for (const plan of plans) {
    const pal = districtPalette(plan)
    const s0 = [o.vertexCount, e.vertexCount] as const
    for (const l of districtContent(plan.id)?.landmarks ?? []) {
      const def = kitDef(l.kit)
      buildFar(def, new Kb(o, e, frameOf(l.at, kitScale(def, plan, l.at.y))), pal)
      beacon(new Kb(o, e, new THREE.Matrix4()), plan, l, pal, true)
    }
    ranges.set(plan.id, [
      { start: s0[0], count: o.vertexCount - s0[0], saved: null },
      { start: s0[1], count: e.vertexCount - s0[1], saved: null },
    ])
  }
  const geos = [o.build(), e.build()] as const
  bakeGlow(geos[0], () => [], new THREE.Color(0xffffff).multiplyScalar(0.7), null)
  const meshes = [new THREE.Mesh(geos[0], glow), new THREE.Mesh(geos[1], lit)]
  for (const m of meshes) {
    m.name = 'reperes-lointains'
    m.matrixAutoUpdate = false
    group.add(m)
  }
  return {
    group,
    hide(district, hidden) {
      const r = ranges.get(district)
      if (!r) return
      r.forEach((range, i) => {
        if (range.count === 0 || (range.saved !== null) === hidden) return
        const attr = geos[i]!.getAttribute('position') as THREE.BufferAttribute
        const arr = attr.array as Float32Array
        const a = range.start * 3
        const b = (range.start + range.count) * 3
        if (hidden) {
          range.saved = arr.slice(a, b)
          arr.fill(0, a, b)
        } else {
          arr.set(range.saved!, a)
          range.saved = null
        }
        attr.addUpdateRange(a, b - a)
        attr.needsUpdate = true
      })
    },
    dispose() {
      group.removeFromParent()
      for (const g of geos) g.dispose()
    },
  }
}
