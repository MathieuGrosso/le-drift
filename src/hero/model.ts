import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { HeroMaterials } from './shading'

export const BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
] as const
export type BoneName = (typeof BONES)[number]

const PARENT: Record<BoneName, BoneName | null> = {
  root: null, hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  upperArmL: 'chest', foreArmL: 'upperArmL', handL: 'foreArmL',
  upperArmR: 'chest', foreArmR: 'upperArmR', handR: 'foreArmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL',
  thighR: 'hips', shinR: 'thighR', footR: 'shinR',
}

// Bind pose, local offsets. The model faces -z; its right hand is on +x.
const OFFSET: Record<BoneName, [number, number, number]> = {
  root: [0, 0, 0], hips: [0, 0.92, 0], spine: [0, 0.11, 0], chest: [0, 0.17, 0], neck: [0, 0.2, 0], head: [0, 0.07, 0],
  upperArmL: [-0.185, 0.15, 0], foreArmL: [0, -0.27, 0], handL: [0, -0.24, 0],
  upperArmR: [0.185, 0.15, 0], foreArmR: [0, -0.27, 0], handR: [0, -0.24, 0],
  thighL: [-0.095, -0.05, 0], shinL: [0, -0.42, 0], footL: [0, -0.39, 0],
  thighR: [0.095, -0.05, 0], shinR: [0, -0.42, 0], footR: [0, -0.39, 0],
}

export const PALETTE = {
  echarpe: 0xe8674a, tunique: 0x2f4e7a, peau: 0xc98e6b, lest: 0xc9a54b,
  combi: 0x23384f, bottes: 0x6b4a3a, cheveux: 0x2a1f2b, lunettes: 0x9fd6d0, laiton: 0xd9b48f,
  bois: 0xb07a4f, poils: 0xf2d9a0, voile: 0xefe3c4, voileBord: 0xd8644e,
} as const

export interface HeroModel {
  root: THREE.Group
  pivot: THREE.Group
  mesh: THREE.SkinnedMesh
  bones: Record<BoneName, THREE.Bone>
  rest: Record<BoneName, THREE.Vector3>
  scrubber: THREE.Mesh
  voile: THREE.Mesh
  poulie: THREE.Mesh
  hold: THREE.Object3D
  clip: THREE.Object3D
  scarfAnchor: THREE.Object3D
  hairAnchor: THREE.Object3D
  pivotHeight: number
}

const tmpColor = new THREE.Color()

function paint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  ng.deleteAttribute('uv')
  tmpColor.setHex(hex)
  const n = ng.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpColor.r
    c[i * 3 + 1] = tmpColor.g
    c[i * 3 + 2] = tmpColor.b
  }
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return ng
}

function skin(g: THREE.BufferGeometry, bone: number, bone2 = bone, split?: (y: number) => number): THREE.BufferGeometry {
  const pos = g.getAttribute('position')
  const n = pos.count
  const idx = new Uint16Array(n * 4)
  const w = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const t = split ? split(pos.getY(i)) : 0
    idx[i * 4] = bone
    idx[i * 4 + 1] = bone2
    w[i * 4] = 1 - t
    w[i * 4 + 1] = t
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4))
  return g
}

export function buildHero(mats: HeroMaterials): HeroModel {
  const bones = {} as Record<BoneName, THREE.Bone>
  const rest = {} as Record<BoneName, THREE.Vector3>
  const world = {} as Record<BoneName, THREE.Vector3>
  BONES.forEach((name) => {
    const b = new THREE.Bone()
    b.name = name
    const o = OFFSET[name]
    b.position.set(o[0], o[1], o[2])
    rest[name] = b.position.clone()
    const p = PARENT[name]
    if (p) bones[p].add(b)
    world[name] = new THREE.Vector3(o[0], o[1], o[2]).add(p ? world[p] : new THREE.Vector3())
    bones[name] = b
  })
  const bi = (n: BoneName) => BONES.indexOf(n)
  const parts: THREE.BufferGeometry[] = []
  const add = (
    g: THREE.BufferGeometry, color: number, bone: BoneName, at: [number, number, number],
    opts?: { rot?: [number, number, number]; scale?: [number, number, number]; to?: BoneName; split?: (y: number) => number },
  ) => {
    if (opts?.scale) g.scale(...opts.scale)
    if (opts?.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...opts.rot)))
    const w = world[bone]
    g.translate(w.x + at[0], w.y + at[1], w.z + at[2])
    parts.push(skin(paint(g, color), bi(bone), opts?.to ? bi(opts.to) : bi(bone), opts?.split))
  }
  const cap = (r: number, len: number, seg = 8) => new THREE.CapsuleGeometry(r, len, 3, seg)
  const limbSplit = (bone: BoneName, len: number) => {
    const top = world[bone].y
    return (y: number) => THREE.MathUtils.clamp((top - y - len * 0.75) / (len * 0.4), 0, 0.5)
  }

  add(cap(0.13, 0.12, 10), PALETTE.combi, 'hips', [0, 0.02, 0], { scale: [1.15, 1, 0.85] })
  add(cap(0.155, 0.16, 10), PALETTE.tunique, 'chest', [0, 0.02, 0], { scale: [1.1, 1, 0.78], to: 'spine', split: (y) => THREE.MathUtils.clamp((world.chest.y - y) / 0.25, 0, 0.5) })
  add(new THREE.CylinderGeometry(0.175, 0.205, 0.3, 12, 1, true), PALETTE.tunique, 'spine', [0, -0.07, 0], { scale: [1, 1, 0.82], to: 'hips', split: (y) => THREE.MathUtils.clamp((world.spine.y - y) / 0.3, 0, 0.6) })
  add(new THREE.TorusGeometry(0.15, 0.035, 6, 16), PALETTE.lest, 'hips', [0, 0.07, 0], { rot: [Math.PI / 2, 0, 0], scale: [1.08, 0.86, 1] })
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6
    add(new THREE.BoxGeometry(0.06, 0.07, 0.04), PALETTE.laiton, 'hips', [Math.sin(a) * 0.17, 0.07, -Math.cos(a) * 0.14])
  }
  add(cap(0.05, 0.06), PALETTE.peau, 'neck', [0, 0.03, 0])
  add(new THREE.SphereGeometry(0.135, 16, 12), PALETTE.peau, 'head', [0, 0.11, -0.005], { scale: [0.95, 1.05, 1] })
  add(new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), PALETTE.cheveux, 'head', [0, 0.13, 0.012], { rot: [0.35, 0, 0], scale: [0.98, 1.0, 1.04] })
  add(new THREE.SphereGeometry(0.06, 10, 8), PALETTE.cheveux, 'head', [0, 0.25, 0.08])
  add(new THREE.BoxGeometry(0.024, 0.018, 0.02), PALETTE.cheveux, 'head', [-0.05, 0.135, -0.122])
  add(new THREE.BoxGeometry(0.024, 0.018, 0.02), PALETTE.cheveux, 'head', [0.05, 0.135, -0.122])
  add(new THREE.SphereGeometry(0.018, 6, 6), PALETTE.peau, 'head', [0, 0.095, -0.135])
  add(new THREE.TorusGeometry(0.143, 0.012, 4, 20), PALETTE.combi, 'head', [0, 0.18, 0], { rot: [Math.PI / 2 + 0.25, 0, 0] })
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 10), PALETTE.laiton, 'head', [sx * 0.048, 0.2, -0.118], { rot: [Math.PI / 2 - 0.35, 0, 0] })
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.032, 10), PALETTE.lunettes, 'head', [sx * 0.048, 0.205, -0.128], { rot: [Math.PI / 2 - 0.35, 0, 0] })
  }
  for (const s of ['L', 'R'] as const) {
    const sx = s === 'L' ? -1 : 1
    const ua = `upperArm${s}` as BoneName
    const fa = `foreArm${s}` as BoneName
    const ha = `hand${s}` as BoneName
    add(new THREE.SphereGeometry(0.068, 10, 8), PALETTE.tunique, ua, [0, -0.01, 0])
    add(cap(0.052, 0.18), PALETTE.peau, ua, [0, -0.135, 0], { to: fa, split: limbSplit(ua, 0.27) })
    add(cap(0.046, 0.17), PALETTE.combi, fa, [0, -0.115, 0], { to: ha, split: limbSplit(fa, 0.24) })
    add(new THREE.BoxGeometry(0.075, 0.1, 0.04), PALETTE.peau, ha, [0, -0.05, 0], { rot: [0, 0, sx * 0.05] })
    add(cap(0.015, 0.04, 4), PALETTE.peau, ha, [-sx * 0.04, -0.04, -0.02], { rot: [0.4, 0, -sx * 0.5] })
    const th = `thigh${s}` as BoneName
    const sh = `shin${s}` as BoneName
    const ft = `foot${s}` as BoneName
    add(cap(0.075, 0.3), PALETTE.combi, th, [0, -0.2, 0], { to: sh, split: limbSplit(th, 0.42) })
    add(cap(0.062, 0.26), PALETTE.bottes, sh, [0, -0.2, 0.005], { to: ft, split: limbSplit(sh, 0.4) })
    add(new THREE.CylinderGeometry(0.072, 0.066, 0.05, 10), PALETTE.laiton, sh, [0, -0.04, 0])
    add(new THREE.BoxGeometry(0.1, 0.07, 0.22), PALETTE.bottes, ft, [0, -0.025, -0.05])
  }
  add(new THREE.BoxGeometry(0.17, 0.2, 0.02), PALETTE.tunique, 'thighL', [0.04, -0.06, -0.12], { rot: [0.12, 0, 0], to: 'hips', split: () => 0.5 })
  add(new THREE.BoxGeometry(0.17, 0.2, 0.02), PALETTE.tunique, 'thighR', [-0.04, -0.06, -0.12], { rot: [0.12, 0, 0], to: 'hips', split: () => 0.5 })
  add(new THREE.BoxGeometry(0.34, 0.18, 0.02), PALETTE.tunique, 'hips', [0, -0.12, 0.12], { rot: [-0.15, 0, 0] })
  add(new THREE.TorusGeometry(0.085, 0.04, 8, 16), PALETTE.echarpe, 'neck', [0, 0.0, 0.005], { rot: [Math.PI / 2 + 0.15, 0, 0], scale: [1.12, 1, 1] })

  const geo = mergeGeometries(parts, false)
  if (!geo) throw new Error('hero geometry merge failed')
  geo.computeBoundingSphere()
  const mesh = new THREE.SkinnedMesh(geo, mats.body)
  mesh.name = 'hero-body'
  mesh.castShadow = true
  mesh.frustumCulled = false
  mesh.add(bones.root)
  mesh.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(BONES.map((n) => bones[n])))

  const pivotHeight = 0.85
  const root = new THREE.Group()
  root.name = 'hero'
  const pivot = new THREE.Group()
  pivot.position.y = pivotHeight
  root.add(pivot)
  mesh.position.y = -pivotHeight
  pivot.add(mesh)

  const scrubber = buildScrubber(mats)
  const voile = buildVoile(mats)
  bones.chest.add(voile)
  voile.visible = false

  const poulie = buildPoulie(mats)
  const hold = new THREE.Object3D()
  hold.name = 'hero-hold'
  hold.position.set(0, 0.02, -0.34)
  bones.chest.add(hold)
  const clip = new THREE.Object3D()
  clip.position.set(0, 0.07, 0.17)
  bones.hips.add(clip)

  const scarfAnchor = new THREE.Object3D()
  scarfAnchor.position.set(0, 0.0, 0.09)
  bones.neck.add(scarfAnchor)
  const hairAnchor = new THREE.Object3D()
  hairAnchor.position.set(0, 0.25, 0.08)
  bones.head.add(hairAnchor)

  return { root, pivot, mesh, bones, rest, scrubber, voile, poulie, hold, clip, scarfAnchor, hairAnchor, pivotHeight }
}

function rigid(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)
  if (!g) throw new Error('hero prop merge failed')
  return g
}

function buildScrubber(mats: HeroMaterials): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = []
  const handle = new THREE.CylinderGeometry(0.016, 0.018, 0.85, 8)
  handle.translate(0, 0.0, 0)
  parts.push(paint(handle, PALETTE.bois))
  const head = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16)
  head.rotateX(Math.PI / 2)
  head.translate(0, 0.46, 0.02)
  parts.push(paint(head, PALETTE.laiton))
  const bristles = new THREE.CylinderGeometry(0.1, 0.085, 0.05, 16)
  bristles.rotateX(Math.PI / 2)
  bristles.translate(0, 0.46, -0.025)
  parts.push(paint(bristles, PALETTE.poils))
  const grip = new THREE.CylinderGeometry(0.024, 0.024, 0.14, 8)
  grip.translate(0, -0.36, 0)
  parts.push(paint(grip, PALETTE.echarpe))
  const m = new THREE.Mesh(rigid(parts), mats.body)
  m.name = 'hero-scrubber'
  m.castShadow = true
  return m
}

function buildVoile(mats: HeroMaterials): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = []
  const theta = Math.PI * 0.4
  const sx0 = 1.2
  const sy0 = 0.75
  const sz0 = 0.85
  const sail = new THREE.SphereGeometry(1.0, 20, 7, 0, Math.PI * 2, 0, theta)
  sail.scale(sx0, sy0, sz0)
  sail.translate(0, 0.45, 0)
  parts.push(paint(sail, PALETTE.voile))
  const rimY = 0.45 + sy0 * Math.cos(theta)
  const hem = new THREE.TorusGeometry(Math.sin(theta), 0.03, 4, 24)
  hem.rotateX(Math.PI / 2)
  hem.scale(sx0, 1, sz0)
  hem.translate(0, rimY, 0)
  parts.push(paint(hem, PALETTE.voileBord))
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * 0.22, 0.42, 0)
    const b = new THREE.Vector3(sx * sx0 * Math.sin(theta) * 0.95, rimY, 0)
    const d = b.clone().sub(a)
    const line = new THREE.CylinderGeometry(0.006, 0.006, d.length(), 4)
    line.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
    line.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0)
    parts.push(paint(line, PALETTE.laiton))
  }
  const m = new THREE.Mesh(rigid(parts), mats.cloth)
  m.name = 'hero-voile'
  m.castShadow = true
  m.position.set(0, 0.25, 0)
  return m
}

function buildPoulie(mats: HeroMaterials): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = []
  const wheel = new THREE.TorusGeometry(0.045, 0.014, 6, 16)
  parts.push(paint(wheel, PALETTE.laiton))
  const hub = new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8)
  hub.rotateX(Math.PI / 2)
  parts.push(paint(hub, PALETTE.bottes))
  for (const sz of [-1, 1]) {
    const cheek = new THREE.BoxGeometry(0.11, 0.12, 0.008)
    cheek.translate(0, -0.03, sz * 0.022)
    parts.push(paint(cheek, PALETTE.laiton))
  }
  const handle = new THREE.TorusGeometry(0.05, 0.012, 5, 12, Math.PI)
  handle.rotateZ(Math.PI)
  handle.translate(0, -0.1, 0)
  parts.push(paint(handle, PALETTE.bois))
  const m = new THREE.Mesh(rigid(parts), mats.body)
  m.name = 'hero-poulie'
  m.castShadow = true
  return m
}
