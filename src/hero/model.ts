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
  echarpe: 0xe8674a, tunique: 0x34507a, tuniqueOmbre: 0x22385a, peau: 0xc98e6b, joues: 0xd47f68, levres: 0x8a4a4a,
  yeux: 0x2a2238, reflet: 0xfff6e6, lest: 0xc9a54b, combi: 0x2a3a52, bottes: 0x6b4a3a, revers: 0x8a6248, semelle: 0x3e2e36,
  cheveux: 0x2a2238, cheveuxReflet: 0x5e4a78, lunettes: 0x9fd6d0, laiton: 0xd9b48f, cuir: 0x8a5a3a,
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
  eyes: THREE.Mesh
  tuft: THREE.Mesh
  hold: THREE.Object3D
  clip: THREE.Object3D
  scarfAnchor: THREE.Object3D
  hairAnchor: THREE.Object3D
  pivotHeight: number
}

const tmpColor = new THREE.Color()
type Tint = number | ((x: number, y: number, z: number, c: THREE.Color) => void)

function paint(g: THREE.BufferGeometry, hex: Tint): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  ng.deleteAttribute('uv')
  const pos = ng.getAttribute('position')
  const shade = ng.getAttribute('aShade')
  if (typeof hex === 'number') tmpColor.setHex(hex)
  const n = pos.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    if (typeof hex !== 'number') hex(pos.getX(i), pos.getY(i), pos.getZ(i), tmpColor)
    const k = shade ? shade.getX(i) : 1
    c[i * 3] = tmpColor.r * k
    c[i * 3 + 1] = tmpColor.g * k
    c[i * 3 + 2] = tmpColor.b * k
  }
  if (shade) ng.deleteAttribute('aShade')
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return ng
}

function taper(g: THREE.BufferGeometry, top: number, bottom: number, bulge = 0): THREE.BufferGeometry {
  g.computeBoundingBox()
  const bb = g.boundingBox!
  const h = bb.max.y - bb.min.y || 1
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / h
    const k = bottom + (top - bottom) * t + bulge * Math.sin(t * Math.PI)
    pos.setX(i, pos.getX(i) * k)
    pos.setZ(i, pos.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

function folds(g: THREE.BufferGeometry, count: number, amp: number, phase = 0, flat = false): THREE.BufferGeometry {
  g.computeBoundingBox()
  const bb = g.boundingBox!
  const h = bb.max.y - bb.min.y || 1
  const pos = g.getAttribute('position')
  const shade = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const t = flat ? 1 : Math.pow((bb.max.y - pos.getY(i)) / h, 1.4)
    const a = Math.atan2(x, z)
    const w = Math.sin(a * count + phase + Math.sin(a * 3) * 0.6)
    const k = 1 + w * amp * t
    pos.setX(i, x * k)
    pos.setZ(i, z * k)
    shade[i] = 1 - Math.max(0, -w) * 0.22 * t - (1 - t) * 0.04
  }
  g.setAttribute('aShade', new THREE.BufferAttribute(shade, 1))
  g.computeVertexNormals()
  return g
}

function band(base: number, hi: number, y0: number, y1: number): Tint {
  const a = new THREE.Color(base)
  const b = new THREE.Color(hi)
  return (_x, y, _z, c) => {
    const m = Math.max(0, 1 - Math.abs((y - (y0 + y1) / 2) / ((y1 - y0) / 2)))
    c.copy(a).lerp(b, Math.min(1, m * 1.6))
  }
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
    g: THREE.BufferGeometry, color: Tint, bone: BoneName, at: [number, number, number],
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

  const HEAD_C: [number, number, number] = [0, 0.115, -0.005]
  const HEAD_R: [number, number, number] = [0.149, 0.161, 0.155]
  const faceZ = (x: number, y: number) => {
    const u = 1 - (x / HEAD_R[0]) ** 2 - (y / HEAD_R[1]) ** 2
    return HEAD_C[2] - HEAD_R[2] * Math.sqrt(Math.max(0, u))
  }
  const onFace = (x: number, y: number, out: number): [number, number, number] => [x, HEAD_C[1] + y, faceZ(x, y) - out]
  const faceYaw = (x: number) => -Math.asin(THREE.MathUtils.clamp(x / HEAD_R[0], -1, 1)) * 0.9
  const headY = world.head.y + HEAD_C[1]

  add(taper(cap(0.13, 0.12, 12), 0.92, 1.0), PALETTE.combi, 'hips', [0, 0.02, 0], { scale: [1.15, 1, 0.85] })
  add(taper(cap(0.15, 0.15, 12), 1.0, 0.9, 0.04), PALETTE.tunique, 'chest', [0, 0.02, 0], { scale: [1.12, 1, 0.8], to: 'spine', split: (y) => THREE.MathUtils.clamp((world.chest.y - y) / 0.25, 0, 0.5) })
  add(folds(new THREE.CylinderGeometry(0.168, 0.228, 0.34, 28, 4, true), 7, 0.07), PALETTE.tunique, 'spine', [0, -0.1, 0], { scale: [1, 1, 0.84], to: 'hips', split: (y) => THREE.MathUtils.clamp((world.spine.y - y) / 0.3, 0, 0.6) })
  add(folds(new THREE.CylinderGeometry(0.231, 0.233, 0.03, 28, 1, true), 7, 0.07, 0, true), PALETTE.tuniqueOmbre, 'spine', [0, -0.26, 0], { scale: [1, 1, 0.84], to: 'hips', split: () => 0.6 })
  add(new THREE.BoxGeometry(0.065, 0.06, 0.012), PALETTE.cuir, 'chest', [0.06, -0.06, -0.118], { rot: [0.05, -0.35, 0.08] })
  add(new THREE.TorusGeometry(0.15, 0.03, 6, 20), PALETTE.lest, 'hips', [0, 0.07, 0], { rot: [Math.PI / 2, 0, 0], scale: [1.1, 0.88, 1] })
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.045, 8), 0xa8845a, 'hips', [Math.sin(a) * 0.168, 0.055, -Math.cos(a) * 0.138], { rot: [0, -a, 0] })
  }
  add(taper(cap(0.048, 0.07), 0.9, 1.05), PALETTE.peau, 'neck', [0, 0.03, 0])

  add(new THREE.SphereGeometry(1, 24, 18), PALETTE.peau, 'head', HEAD_C, { scale: HEAD_R })
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.03, 8, 6), PALETTE.peau, 'head', [sx * 0.145, HEAD_C[1] - 0.01, 0.0], { scale: [0.5, 1, 0.8] })
    add(new THREE.SphereGeometry(0.024, 10, 6), PALETTE.joues, 'head', onFace(sx * 0.082, -0.042, -0.0035), { scale: [1, 0.62, 0.3], rot: [0, faceYaw(sx * 0.082), 0] })
    add(cap(0.0058, 0.026, 4), PALETTE.cheveux, 'head', onFace(sx * 0.054, 0.045, 0.002), { rot: [0, faceYaw(sx * 0.054), Math.PI / 2 + sx * 0.18] })
  }
  add(new THREE.SphereGeometry(0.015, 8, 6), 0xd08a6c, 'head', onFace(0, -0.03, 0.004), { scale: [1, 0.8, 0.9] })
  add(new THREE.TorusGeometry(0.016, 0.0035, 4, 10, Math.PI * 0.62), PALETTE.levres, 'head', [0, HEAD_C[1] - 0.058, faceZ(0, -0.072) - 0.0015], { rot: [0.2, 0, -Math.PI / 2 - Math.PI * 0.31] })

  const hair = band(PALETTE.cheveux, PALETTE.cheveuxReflet, headY + 0.095, headY + 0.13)
  add(new THREE.SphereGeometry(0.168, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, 'head', [0, HEAD_C[1] + 0.012, 0.012], { rot: [0.55, 0, 0], scale: [0.99, 1.0, 1.04] })
  add(new THREE.SphereGeometry(0.155, 16, 10), PALETTE.cheveux, 'head', [0, HEAD_C[1] - 0.01, 0.035], { scale: [0.97, 1.0, 0.9] })
  const clump = (at: THREE.Vector3, dir: THREE.Vector3, r: number, len: number, flat: number, tint: Tint = PALETTE.cheveux) => {
    const g = new THREE.ConeGeometry(r, len, 7, 2)
    g.scale(1, 1, flat)
    const bend = g.getAttribute('position')
    for (let i = 0; i < bend.count; i++) {
      const t = (len / 2 - bend.getY(i)) / len
      bend.setZ(i, bend.getZ(i) + Math.sin((1 - t) * Math.PI * 0.5) * len * 0.16)
    }
    g.computeVertexNormals()
    g.rotateX(Math.PI)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize())
    g.applyQuaternion(q)
    g.translate(at.x + dir.x * len * 0.5, at.y + dir.y * len * 0.5, at.z + dir.z * len * 0.5)
    add(g, tint, 'head', [0, 0, 0])
  }
  const hy = HEAD_C[1]
  clump(new THREE.Vector3(-0.075, hy + 0.105, -0.115), new THREE.Vector3(-0.35, -1, -0.55), 0.05, 0.088, 0.55, hair)
  clump(new THREE.Vector3(-0.015, hy + 0.115, -0.125), new THREE.Vector3(0.12, -1, -0.5), 0.048, 0.082, 0.5, hair)
  clump(new THREE.Vector3(0.05, hy + 0.11, -0.12), new THREE.Vector3(0.45, -1, -0.5), 0.05, 0.085, 0.55, hair)
  clump(new THREE.Vector3(0.105, hy + 0.08, -0.095), new THREE.Vector3(0.55, -1, -0.25), 0.045, 0.11, 0.6, hair)
  for (const sx of [-1, 1]) {
    clump(new THREE.Vector3(sx * 0.14, hy + 0.06, -0.035), new THREE.Vector3(sx * 0.25, -1, -0.15), 0.048, 0.15, 0.55)
    clump(new THREE.Vector3(sx * 0.11, hy + 0.04, 0.09), new THREE.Vector3(sx * 0.35, -1, 0.5), 0.06, 0.15, 0.6)
  }
  clump(new THREE.Vector3(0, hy + 0.05, 0.13), new THREE.Vector3(0, -1, 0.35), 0.07, 0.15, 0.6)
  add(new THREE.SphereGeometry(0.062, 12, 9), hair, 'head', [0, hy + 0.165, 0.085], { scale: [1, 0.9, 1] })
  add(new THREE.TorusGeometry(0.04, 0.012, 5, 12), PALETTE.echarpe, 'head', [0, hy + 0.13, 0.1], { rot: [1.1, 0, 0] })

  add(new THREE.TorusGeometry(0.17, 0.011, 4, 24), PALETTE.cuir, 'head', [0, hy + 0.075, 0.008], { rot: [Math.PI / 2 + 0.3, 0, 0], scale: [0.99, 1.06, 1] })
  for (const sx of [-1, 1]) {
    const lens = onFace(sx * 0.05, 0.1, 0.03)
    add(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 12), PALETTE.laiton, 'head', lens, { rot: [Math.PI / 2 - 0.55, faceYaw(sx * 0.05) * 0.6, 0] })
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.034, 12), PALETTE.lunettes, 'head', [lens[0], lens[1] + 0.002, lens[2] - 0.004], { rot: [Math.PI / 2 - 0.55, faceYaw(sx * 0.05) * 0.6, 0] })
  }

  for (const s of ['L', 'R'] as const) {
    const sx = s === 'L' ? -1 : 1
    const ua = `upperArm${s}` as BoneName
    const fa = `foreArm${s}` as BoneName
    const ha = `hand${s}` as BoneName
    add(folds(new THREE.SphereGeometry(0.072, 12, 9), 5, 0.06), PALETTE.tunique, ua, [sx * 0.005, -0.015, 0], { scale: [1, 0.95, 1] })
    add(taper(cap(0.05, 0.18, 10), 1.0, 0.82), PALETTE.peau, ua, [0, -0.135, 0], { to: fa, split: limbSplit(ua, 0.27) })
    add(taper(cap(0.048, 0.16, 10), 1.0, 0.8, 0.06), PALETTE.combi, fa, [0, -0.11, 0], { to: ha, split: limbSplit(fa, 0.24) })
    add(new THREE.TorusGeometry(0.041, 0.011, 5, 12), PALETTE.cuir, fa, [0, -0.2, 0], { rot: [Math.PI / 2, 0, 0] })
    add(new THREE.SphereGeometry(0.05, 12, 9), PALETTE.peau, ha, [0, -0.055, -0.004], { scale: [0.88, 1.2, 0.62] })
    add(cap(0.017, 0.035, 6), PALETTE.peau, ha, [-sx * 0.04, -0.035, -0.022], { rot: [0.5, 0, -sx * 0.6] })
    const th = `thigh${s}` as BoneName
    const sh = `shin${s}` as BoneName
    const ft = `foot${s}` as BoneName
    add(taper(cap(0.078, 0.3, 10), 1.0, 0.8), PALETTE.combi, th, [0, -0.2, 0], { to: sh, split: limbSplit(th, 0.42) })
    add(taper(cap(0.064, 0.25, 10), 1.12, 0.88), PALETTE.bottes, sh, [0, -0.2, 0.005], { to: ft, split: limbSplit(sh, 0.4) })
    add(folds(new THREE.CylinderGeometry(0.084, 0.074, 0.075, 14, 2, false), 4, 0.08, sx), PALETTE.revers, sh, [0, -0.06, 0.003])
    add(new THREE.BoxGeometry(0.022, 0.028, 0.012), PALETTE.laiton, sh, [sx * 0.07, -0.07, -0.03], { rot: [0, sx * 0.9, 0] })
    add(cap(0.06, 0.13, 10), PALETTE.bottes, ft, [0, -0.016, -0.055], { rot: [Math.PI / 2, 0, 0], scale: [1.0, 1.0, 0.72] })
    add(new THREE.BoxGeometry(0.112, 0.024, 0.25), PALETTE.semelle, ft, [0, -0.048, -0.055])
  }
  for (const s of ['L', 'R'] as const) {
    const sx = s === 'L' ? -1 : 1
    const panel = folds(new THREE.CylinderGeometry(0.205, 0.245, 0.17, 10, 2, true, Math.PI - sx * 0.42 - 0.55, 1.1), 7, 0.05)
    add(panel, PALETTE.tunique, `thigh${s}` as BoneName, [-sx * 0.095, -0.09, 0], { scale: [1, 1, 0.84], to: 'hips', split: () => 0.45 })
  }
  add(folds(new THREE.CylinderGeometry(0.21, 0.25, 0.16, 16, 2, true, -1.1, 2.2), 7, 0.06), PALETTE.tunique, 'hips', [0, -0.14, 0], { scale: [1, 1, 0.84] })
  add(new THREE.TorusGeometry(0.088, 0.046, 8, 18), PALETTE.echarpe, 'neck', [0, 0.0, 0.005], { rot: [Math.PI / 2 + 0.15, 0, 0], scale: [1.14, 1, 1] })
  add(new THREE.SphereGeometry(0.045, 10, 8), PALETTE.echarpe, 'neck', [0.02, -0.01, 0.1], { scale: [1.1, 0.9, 0.8] })

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

  const eyeY = HEAD_C[1] - 0.005
  const eyeParts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    const x = sx * 0.053
    const z = faceZ(x, -0.005)
    const yaw = faceYaw(x)
    const eye = new THREE.SphereGeometry(0.0225, 12, 10)
    eye.scale(0.78, 1.22, 0.42)
    eye.rotateY(yaw)
    eye.translate(x, 0, z + 0.0035)
    eyeParts.push(paint(eye, PALETTE.yeux))
    const glint = new THREE.SphereGeometry(0.0075, 8, 6)
    glint.scale(1, 1, 0.5)
    glint.translate(x + 0.0055, 0.01, z - 0.0055 + Math.abs(x) * 0.02)
    eyeParts.push(paint(glint, PALETTE.reflet))
    const glint2 = new THREE.SphereGeometry(0.0035, 6, 4)
    glint2.translate(x - 0.005, -0.012, z - 0.004)
    eyeParts.push(paint(glint2, 0x8a7ab0))
  }
  const eyes = new THREE.Mesh(rigid(eyeParts), mats.body)
  eyes.name = 'hero-eyes'
  eyes.position.set(0, eyeY, 0)
  bones.head.add(eyes)

  const tuftParts: THREE.BufferGeometry[] = []
  for (const [dx, len, r] of [[-0.018, 0.13, 0.03], [0.02, 0.1, 0.026], [0, 0.16, 0.034]] as const) {
    const c = new THREE.ConeGeometry(r, len, 7, 3)
    c.scale(1, 1, 0.7)
    c.rotateX(Math.PI)
    c.translate(dx, -len / 2, 0)
    const p = c.getAttribute('position')
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + (p.getY(i) / len) ** 2 * len * 0.35)
    c.computeVertexNormals()
    tuftParts.push(paint(c, band(PALETTE.cheveux, PALETTE.cheveuxReflet, -0.03, -0.0)))
  }
  const tuft = new THREE.Mesh(rigid(tuftParts), mats.body)
  tuft.name = 'hero-tuft'
  tuft.position.set(0, HEAD_C[1] + 0.19, 0.105)
  tuft.castShadow = true
  bones.head.add(tuft)

  const scarfAnchor = new THREE.Object3D()
  scarfAnchor.position.set(0, 0.0, 0.09)
  bones.neck.add(scarfAnchor)
  const hairAnchor = new THREE.Object3D()
  hairAnchor.position.set(0, HEAD_C[1] + 0.17, 0.09)
  bones.head.add(hairAnchor)

  return { root, pivot, mesh, bones, rest, scrubber, voile, poulie, eyes, tuft, hold, clip, scarfAnchor, hairAnchor, pivotHeight }
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
