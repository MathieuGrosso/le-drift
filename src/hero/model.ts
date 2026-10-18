import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
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
  root: [0, 0, 0], hips: [0, 0.92, 0], spine: [0, 0.11, 0], chest: [0, 0.17, 0], neck: [0, 0.2, 0], head: [0, 0.098, 0],
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
const trimColor = new THREE.Color(0xc9a54b)
type Tint = number | ((x: number, y: number, z: number, c: THREE.Color) => void)
const NOSE = 0xc8846a
const SKIN = new Set<number>([PALETTE.peau, PALETTE.joues, NOSE])

// aMat = (skin wrap, knit flag, knit u across ribs, knit v along rows), read by shading.ts.
function paint(g: THREE.BufferGeometry, hex: Tint, skinFlag = typeof hex === 'number' && SKIN.has(hex)): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  ng.deleteAttribute('uv')
  const pos = ng.getAttribute('position')
  const shade = ng.getAttribute('aShade')
  const trim = ng.getAttribute('aTrim')
  if (typeof hex === 'number') tmpColor.setHex(hex)
  const n = pos.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    if (typeof hex !== 'number') hex(pos.getX(i), pos.getY(i), pos.getZ(i), tmpColor)
    const k = shade ? shade.getX(i) : 1
    const t = trim ? trim.getX(i) : 0
    c[i * 3] = (tmpColor.r + (trimColor.r - tmpColor.r) * t) * k
    c[i * 3 + 1] = (tmpColor.g + (trimColor.g - tmpColor.g) * t) * k
    c[i * 3 + 2] = (tmpColor.b + (trimColor.b - tmpColor.b) * t) * k
  }
  if (shade) ng.deleteAttribute('aShade')
  if (trim) ng.deleteAttribute('aTrim')
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3))
  if (!ng.getAttribute('aMat')) {
    const m = new Float32Array(n * 4)
    if (skinFlag) for (let i = 0; i < n; i++) m[i * 4] = 1
    ng.setAttribute('aMat', new THREE.BufferAttribute(m, 4))
  }
  return ng
}

function knitUV(g: THREE.BufferGeometry, ribs: number, rows: number, swap = false): THREE.BufferGeometry {
  const uv = g.getAttribute('uv')
  const m = new Float32Array(uv.count * 4)
  for (let i = 0; i < uv.count; i++) {
    m[i * 4 + 1] = 1
    m[i * 4 + 2] = (swap ? uv.getX(i) : uv.getY(i)) * ribs
    m[i * 4 + 3] = (swap ? uv.getY(i) : uv.getX(i)) * rows
  }
  g.setAttribute('aMat', new THREE.BufferAttribute(m, 4))
  return g
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

function lathe(profile: [number, number][], seg = 16): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)).sort((a, b) => a.y - b.y)
  const g = new THREE.LatheGeometry(pts, seg)
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  const m = mergeVertices(g, 1e-5)
  m.computeVertexNormals()
  return m
}

function skirt(rTop: number, rBot: number, h: number, start: number, len: number, count: number, amp: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 48, 12, true, start, len)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const t = (h / 2 - pos.getY(i)) / h
    const a = Math.atan2(pos.getX(i), pos.getZ(i))
    const k = 1 + 0.2 * t * t * t
    pos.setX(i, pos.getX(i) * k)
    pos.setZ(i, pos.getZ(i) * k)
    pos.setY(i, pos.getY(i) + Math.sin(a * 3 + seed * 5) * 0.016 * t * t + Math.sin(a * count + seed) * 0.008 * t * t * t)
  }
  folds(g, count, amp, seed)
  const shade = g.getAttribute('aShade')
  const trim = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const t = (h / 2 - pos.getY(i)) / h
    if (t > 0.93) shade.setX(i, shade.getX(i) * 0.78)
    else if (t > 0.8) trim[i] = 0.55
  }
  g.setAttribute('aTrim', new THREE.BufferAttribute(trim, 1))
  return g
}

function wrapRing(R: number, r: number, thin: number, seg: number, tub: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(R, r, tub, seg)
  const pos = g.getAttribute('position')
  const nrm = g.getAttribute('normal')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i) * Math.PI * 2
    const v = uv.getY(i) * Math.PI * 2
    const lump = 1 + 0.07 * Math.sin(u * 3 + seed) + 0.04 * Math.sin(u * 7 + seed * 2)
    const rad = R + r * thin * Math.cos(v) * lump
    const zz = r * Math.sin(v) * lump + Math.sin(u * 2 + seed) * r * 0.18
    pos.setXYZ(i, rad * Math.cos(u), rad * Math.sin(u), zz)
    const nr = Math.cos(v) / thin
    const nz = Math.sin(v)
    const l = Math.hypot(nr, nz) || 1
    nrm.setXYZ(i, (nr / l) * Math.cos(u), (nr / l) * Math.sin(u), nz / l)
  }
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
    opts?: { rot?: [number, number, number]; scale?: [number, number, number]; to?: BoneName; split?: (y: number) => number; skin?: boolean },
  ) => {
    if (opts?.scale) g.scale(...opts.scale)
    if (opts?.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...opts.rot)))
    const w = world[bone]
    g.translate(w.x + at[0], w.y + at[1], w.z + at[2])
    parts.push(skin(paint(g, color, opts?.skin ?? (typeof color === 'number' && SKIN.has(color))), bi(bone), opts?.to ? bi(opts.to) : bi(bone), opts?.split))
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
  add(lathe([[0.14, -0.13], [0.147, -0.04], [0.152, 0.05], [0.148, 0.11], [0.132, 0.155], [0.1, 0.18], [0.055, 0.195], [0.001, 0.2]], 20), PALETTE.tunique, 'chest', [0, 0, 0], { scale: [1.13, 1, 0.8], to: 'spine', split: (y) => THREE.MathUtils.clamp((world.chest.y - y) / 0.2, 0, 0.5) })
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(1, 14, 10), PALETTE.tunique, 'chest', [sx * 0.122, 0.128, 0.004], { scale: [0.07, 0.038, 0.078], rot: [0, 0, sx * 0.5] })
  }
  add(skirt(0.168, 0.272, 0.36, 0, Math.PI * 2, 9, 0.085, 0.3), PALETTE.tunique, 'spine', [0, -0.11, 0], { scale: [1, 1, 0.84], to: 'hips', split: (y) => THREE.MathUtils.clamp((world.spine.y - y) / 0.3, 0, 0.6) })
  add(new THREE.BoxGeometry(0.065, 0.06, 0.012), PALETTE.cuir, 'chest', [0.06, -0.06, -0.118], { rot: [0.05, -0.35, 0.08] })
  add(new THREE.SphereGeometry(0.006, 6, 4), PALETTE.laiton, 'chest', [0.06, -0.04, -0.126])
  add(lathe([[0.158, -0.022], [0.163, 0], [0.158, 0.022]], 24), PALETTE.lest, 'hips', [0, 0.07, 0], { scale: [1.12, 1, 0.9] })
  add(new THREE.BoxGeometry(0.04, 0.032, 0.012), PALETTE.laiton, 'hips', [0, 0.07, -0.146])
  for (const [i, a] of [1.2, 1.8, -1.2, -1.8].entries()) {
    const pouch = new RoundedBoxGeometry(0.05, 0.055, 0.03, 2, 0.01)
    add(pouch, i % 2 ? 0x9a7650 : 0xa8845a, 'hips', [Math.sin(a) * 0.175, 0.045, Math.cos(a) * 0.145], { rot: [0.08, a, 0] })
  }
  const shadowSkin = new THREE.Color(0x8a5a5a)
  const peau = new THREE.Color(PALETTE.peau)
  const joues = new THREE.Color(PALETTE.joues)
  const nY = world.neck.y
  add(lathe([[0.044, -0.06], [0.04, 0.0], [0.037, 0.05], [0.038, 0.095], [0.046, 0.12], [0.001, 0.135]], 14), (_x, y, _z, c) => {
    c.copy(peau).lerp(shadowSkin, THREE.MathUtils.smoothstep(y - nY, 0.03, 0.11) * 0.55)
  }, 'neck', [0, 0, 0], { to: 'head', split: (y) => THREE.MathUtils.clamp((y - world.neck.y - 0.05) / 0.05, 0, 1), skin: true })

  const skull = new THREE.SphereGeometry(1, 40, 28)
  skull.deleteAttribute('uv')
  skull.deleteAttribute('normal')
  const sp = skull.getAttribute('position')
  for (let i = 0; i < sp.count; i++) {
    let x = sp.getX(i)
    let y = sp.getY(i)
    let z = sp.getZ(i)
    const front = THREE.MathUtils.clamp((0.25 - z) / 1.1, 0, 1)
    if (y < 0) {
      const lo = THREE.MathUtils.smoothstep(-y, 0.2, 1)
      const jaw = THREE.MathUtils.smoothstep(-y, 0.35, 0.95)
      x *= 1 - (0.08 + 0.16 * front) * y * y - 0.2 * jaw * front
      z *= 1 - 0.05 * y * y
      y -= 0.13 * front * lo
      z -= 0.05 * front * lo
      if (y < -0.15) {
        const lim = 0.97 + 0.62 * (y + 0.15)
        const ax = Math.abs(x)
        if (ax > lim) x = Math.sign(x) * (lim + (ax - lim) * 0.25)
      }
      if (y < -0.55 && front < 0.55) y = -0.55 + (y + 0.55) * (0.35 + 0.65 * front / 0.55)
      const chin = Math.exp(-(x * x) / 0.05 - ((y + 0.9) ** 2) / 0.025) * front
      z -= 0.07 * chin
      y -= 0.03 * chin
    }
    const cx = Math.abs(x) - 0.6
    const cy = y + 0.22
    const ch = 1 + 0.075 * Math.exp(-(cx * cx) / 0.04 - (cy * cy) / 0.03) * front
    const tx = Math.abs(x) - 0.72
    const ty = y - 0.12
    const temple = 1 - 0.035 * Math.exp(-(tx * tx + ty * ty) / 0.03) * front
    sp.setXYZ(i, x * ch * temple, y, z * (1 + (ch - 1) * 0.4))
  }
  const skullW = mergeVertices(skull, 1e-4)
  skullW.computeVertexNormals()
  const hcW = world.head.clone().add(new THREE.Vector3(...HEAD_C))
  add(skullW, (x, y, z, c) => {
    const nx = (x - hcW.x) / HEAD_R[0]
    const ny = (y - hcW.y) / HEAD_R[1]
    const nz = (z - hcW.z) / HEAD_R[2]
    const front = THREE.MathUtils.clamp((0.25 - nz) / 1.1, 0, 1)
    c.copy(peau)
    const bx = Math.abs(nx) - 0.5
    const by = ny + 0.27
    c.lerp(joues, Math.exp(-(bx * bx) / 0.035 - (by * by) / 0.018) * front * 0.8)
    const ao = THREE.MathUtils.smoothstep(-ny, 0.55, 1.05) * (1 - front * 0.7)
    c.lerp(shadowSkin, ao * 0.55)
  }, 'head', HEAD_C, { scale: HEAD_R, skin: true })
  for (const sx of [-1, 1]) {
    const ex = sx * 0.147
    const ey = HEAD_C[1] - 0.006
    add(new THREE.SphereGeometry(1, 12, 8), PALETTE.peau, 'head', [ex, ey, 0.012], { scale: [0.011, 0.034, 0.024], rot: [0.1, sx * 0.3, 0] })
    const rim = new THREE.TorusGeometry(0.023, 0.0068, 6, 16, Math.PI * 1.5)
    rim.rotateY(Math.PI / 2)
    rim.scale(1, 1.25, 0.95)
    add(rim, PALETTE.peau, 'head', [ex + sx * 0.007, ey + 0.002, 0.012], { rot: [0.1, sx * 0.3, 0] })
    add(new THREE.SphereGeometry(1, 8, 6), 0xa86a5a, 'head', [ex + sx * 0.008, ey - 0.002, 0.01], { scale: [0.004, 0.017, 0.011], rot: [0.1, sx * 0.3, 0], skin: true })
    add(cap(0.0062, 0.028, 4), PALETTE.cheveux, 'head', onFace(sx * 0.054, 0.06, 0.002), { rot: [0, faceYaw(sx * 0.054), Math.PI / 2 + sx * 0.2] })
  }
  add(new THREE.SphereGeometry(0.012, 10, 8), NOSE, 'head', onFace(0, -0.016, 0.004), { scale: [1.1, 0.8, 0.95] })
  add(new THREE.TorusGeometry(0.016, 0.0035, 4, 10, Math.PI * 0.62), PALETTE.levres, 'head', [0, HEAD_C[1] - 0.05, faceZ(0, -0.062) - 0.0025], { rot: [0.25, 0, -Math.PI / 2 - Math.PI * 0.31] })

  const hair = band(PALETTE.cheveux, PALETTE.cheveuxReflet, headY + 0.075, headY + 0.15)
  add(new THREE.SphereGeometry(0.162, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, 'head', [0, HEAD_C[1] + 0.012, 0.012], { rot: [0.55, 0, 0], scale: [0.99, 1.0, 1.04] })
  add(new THREE.SphereGeometry(0.155, 16, 10), PALETTE.cheveux, 'head', [0, HEAD_C[1] - 0.01, 0.035], { scale: [0.97, 1.0, 0.9] })
  const HC = new THREE.Vector3(0, HEAD_C[1] + 0.012, 0.012)
  const HR = new THREE.Vector3(0.166, 0.168, 0.172)
  const clump = (azDeg: number, elDeg: number, len: number, r: number, twist = 0, flat = 0.42) => {
    const az = THREE.MathUtils.degToRad(azDeg)
    const el = THREE.MathUtils.degToRad(elDeg)
    const n = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    const at = n.clone().multiply(HR).multiplyScalar(0.96).add(HC)
    const down = new THREE.Vector3(Math.sin(az) * Math.sin(el), -Math.cos(el), Math.cos(az) * Math.sin(el))
    const side = new THREE.Vector3().crossVectors(n, down)
    const dir = down.clone().addScaledVector(n, 0.12).addScaledVector(side, twist).normalize()
    const Z = n.clone().addScaledVector(dir, -n.dot(dir)).normalize()
    const Y = dir.clone().negate()
    const X = new THREE.Vector3().crossVectors(Y, Z)
    const g = lathe([[0.001, -len], [r * 0.45, -len * 0.8], [r * 0.95, -len * 0.45], [r, -len * 0.25], [r * 0.8, 0], [r * 0.35, r * 0.35], [0.001, r * 0.45]], 9)
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, -p.getY(i) / len)
      p.setZ(i, p.getZ(i) * flat - t * t * (len * len / 0.32) + 0.008)
      p.setX(i, p.getX(i) + Math.sin(t * Math.PI) * twist * len * 0.12)
    }
    g.computeVertexNormals()
    g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z))
    g.translate(at.x, at.y, at.z)
    add(g, hair, 'head', [0, 0, 0])
  }
  const hy = HEAD_C[1]
  clump(0, 60, 0.2, 0.085)
  clump(52, 46, 0.19, 0.08, 0.15)
  clump(-52, 46, 0.19, 0.08, -0.15)
  clump(26, 14, 0.14, 0.075, 0.1)
  clump(-26, 14, 0.14, 0.075, -0.1)
  clump(100, 30, 0.15, 0.065, -0.2)
  clump(-100, 30, 0.15, 0.065, 0.2)
  clump(150, 46, 0.082, 0.058, -0.35)
  clump(182, 48, 0.078, 0.062, -0.25)
  clump(212, 44, 0.074, 0.055, -0.15)
  clump(0, -2, 0.09, 0.06)
  clump(32, -4, 0.08, 0.052, 0.2)
  clump(-32, -4, 0.08, 0.052, -0.2)
  clump(124, -2, 0.12, 0.045, -0.25, 0.36)
  clump(-124, -2, 0.12, 0.045, 0.25, 0.36)
  clump(60, -6, 0.14, 0.055, -0.15, 0.4)
  clump(-60, -6, 0.14, 0.055, 0.15, 0.4)
  clump(16, -14, 0.11, 0.05, 0.25, 0.4)
  clump(-16, -14, 0.11, 0.05, -0.25, 0.4)
  clump(108, 10, 0.12, 0.055, 0.1)
  clump(-108, 10, 0.12, 0.055, -0.1)
  add(new THREE.SphereGeometry(0.062, 12, 9), hair, 'head', [0, hy + 0.165, 0.085], { scale: [1, 0.9, 1] })
  add(new THREE.TorusGeometry(0.04, 0.012, 5, 12), PALETTE.echarpe, 'head', [0, hy + 0.13, 0.1], { rot: [1.1, 0, 0] })

  const strapPts: THREE.Vector3[] = []
  for (let i = 0; i < 32; i++) {
    const az = (i / 32) * Math.PI * 2
    const toFront = (1 - Math.cos(az)) / 2
    const el = THREE.MathUtils.lerp(0.32, 0.86, toFront ** 1.4)
    const sink = THREE.MathUtils.lerp(1.015, 1.06, toFront)
    strapPts.push(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiply(HR).multiplyScalar(sink).add(HC))
  }
  const strapCurve = new THREE.CatmullRomCurve3(strapPts, true)
  const strap = new THREE.TubeGeometry(strapCurve, 64, 0.011, 6, true)
  const stp = strap.getAttribute('position')
  const suv = strap.getAttribute('uv')
  for (let i = 0; i < stp.count; i++) {
    const k = Math.round(suv.getX(i) * 64) % 64
    const c = strapCurve.getPointAt(k / 64)
    const d = new THREE.Vector3(stp.getX(i) - c.x, stp.getY(i) - c.y, stp.getZ(i) - c.z)
    const out = c.clone().sub(HC).normalize()
    const radial = d.dot(out)
    d.addScaledVector(out, -radial * 0.6)
    stp.setXYZ(i, c.x + d.x, c.y + d.y, c.z + d.z)
  }
  strap.deleteAttribute('normal')
  strap.computeVertexNormals()
  add(strap, PALETTE.cuir, 'head', [0, 0, 0])
  for (const sx of [-1, 1]) {
    const az = Math.PI + sx * 0.5
    const el = 0.86
    const n = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    const at = n.clone().multiply(HR).multiplyScalar(1.1).add(HC)
    const lensUp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().add(new THREE.Vector3(0, 0, -0.5)).normalize())
    const frame = new THREE.CylinderGeometry(0.036, 0.039, 0.028, 14)
    frame.applyQuaternion(lensUp)
    add(frame, PALETTE.laiton, 'head', [at.x, at.y, at.z])
    const glass = new THREE.CylinderGeometry(0.027, 0.027, 0.03, 14)
    glass.translate(0, 0.002, 0)
    glass.applyQuaternion(lensUp)
    add(glass, PALETTE.lunettes, 'head', [at.x, at.y, at.z])
  }
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), PALETTE.laiton, 'head', [0, HC.y + 0.162, HC.z - 0.125], { rot: [0, 0, Math.PI / 2] })

  for (const s of ['L', 'R'] as const) {
    const sx = s === 'L' ? -1 : 1
    const ua = `upperArm${s}` as BoneName
    const fa = `foreArm${s}` as BoneName
    const ha = `hand${s}` as BoneName
    add(folds(lathe([[0.064, -0.15], [0.043, -0.142], [0.06, -0.138], [0.057, -0.1], [0.055, -0.05], [0.055, -0.01], [0.05, 0.025], [0.036, 0.048], [0.001, 0.058]], 18), 5, 0.11, sx), PALETTE.tunique, ua, [sx * 0.004, 0, 0], { rot: [0, 0, sx * 0.08] })
    add(lathe([[0.001, -0.3], [0.027, -0.294], [0.03, -0.27], [0.032, -0.22], [0.035, -0.16], [0.038, -0.1], [0.038, -0.04], [0.001, 0.0]], 16), PALETTE.peau, ua, [0, 0, 0], { to: fa, split: limbSplit(ua, 0.27), rot: [0, 0, sx * 0.03] })
    add(lathe([[0.001, -0.25], [0.021, -0.246], [0.023, -0.225], [0.028, -0.18], [0.036, -0.12], [0.042, -0.06], [0.04, -0.02], [0.033, 0.0], [0.001, 0.025]], 16), PALETTE.combi, fa, [0, 0, 0.002], { to: ha, split: limbSplit(fa, 0.24), scale: [0.92, 1, 1.05] })
    add(folds(lathe([[0.027, -0.236], [0.031, -0.226], [0.032, -0.2], [0.029, -0.19]], 14), 4, 0.06, sx), PALETTE.cuir, fa, [0, 0, 0.002])
    const mitten = lathe([[0.019, 0.004], [0.024, -0.012], [0.029, -0.034], [0.031, -0.056], [0.029, -0.072], [0.022, -0.086], [0.012, -0.095], [0.001, -0.098]], 14)
    const mp = mitten.getAttribute('position')
    for (let i = 0; i < mp.count; i++) {
      const t = THREE.MathUtils.clamp(-mp.getY(i) / 0.098, 0, 1)
      mp.setX(i, mp.getX(i) * (0.62 - 0.06 * t) - sx * t * t * 0.016)
      mp.setZ(i, mp.getZ(i) * (0.95 + 0.12 * Math.sin(t * Math.PI)))
    }
    mitten.computeVertexNormals()
    add(mitten, PALETTE.peau, ha, [sx * 0.002, -0.004, 0], { rot: [0.06, 0, 0] })
    const thumb = new THREE.Vector3(-sx * 0.3, -0.62, -0.72).normalize()
    const tg = cap(0.0115, 0.026, 8)
    tg.translate(0, 0.013, 0)
    tg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), thumb))
    add(tg, PALETTE.peau, ha, [-sx * 0.004, -0.024, -0.016])
    const th = `thigh${s}` as BoneName
    const sh = `shin${s}` as BoneName
    const ft = `foot${s}` as BoneName
    add(lathe([[0.001, -0.45], [0.046, -0.44], [0.052, -0.4], [0.058, -0.3], [0.068, -0.17], [0.077, -0.06], [0.072, 0.03], [0.001, 0.07]], 14), PALETTE.combi, th, [0, 0, 0], { to: sh, split: limbSplit(th, 0.42) })
    add(lathe([[0.001, -0.11], [0.048, -0.105], [0.051, -0.04], [0.05, 0.02], [0.001, 0.04]], 12), PALETTE.combi, sh, [0, 0, 0])
    add(lathe([[0.001, -0.4], [0.05, -0.395], [0.054, -0.36], [0.056, -0.31], [0.062, -0.22], [0.066, -0.14], [0.067, -0.1], [0.001, -0.09]], 14), PALETTE.bottes, sh, [0, 0, 0.004], { to: ft, split: limbSplit(sh, 0.4) })
    add(folds(lathe([[0.066, -0.13], [0.081, -0.122], [0.085, -0.09], [0.08, -0.06], [0.06, -0.055]], 16), 5, 0.09, sx * 2), PALETTE.revers, sh, [0, 0, 0.003], { rot: [sx * 0.06, 0, sx * 0.05] })
    add(new THREE.TorusGeometry(0.06, 0.007, 4, 16, Math.PI * 1.3), PALETTE.revers, sh, [0, -0.26, 0.004], { rot: [Math.PI / 2 + 0.12, 0, sx * 0.6], scale: [1.04, 1, 1] })
    add(new RoundedBoxGeometry(0.026, 0.03, 0.012, 2, 0.004), PALETTE.laiton, sh, [sx * 0.074, -0.1, -0.03], { rot: [0, sx * 0.9, 0] })
    add(new THREE.SphereGeometry(1, 14, 10), PALETTE.bottes, ft, [0, -0.012, -0.075], { scale: [0.063, 0.052, 0.11] })
    add(new THREE.SphereGeometry(1, 12, 8), PALETTE.bottes, ft, [0, -0.005, 0.0], { scale: [0.055, 0.06, 0.06] })
    add(new RoundedBoxGeometry(0.12, 0.028, 0.255, 2, 0.012), PALETTE.semelle, ft, [0, -0.05, -0.06])
  }
  for (const s of ['L', 'R'] as const) {
    const sx = s === 'L' ? -1 : 1
    const panel = skirt(0.214, 0.272, 0.18, Math.PI - sx * 0.42 - 0.58, 1.16, 7, 0.06, sx)
    add(panel, PALETTE.tunique, `thigh${s}` as BoneName, [-sx * 0.095, -0.1, 0], { scale: [1, 1, 0.84], to: 'hips', split: () => 0.45 })
  }
  add(skirt(0.216, 0.272, 0.17, -1.15, 2.3, 7, 0.07, 0.7), PALETTE.tunique, 'hips', [0, -0.15, 0], { scale: [1, 1, 0.84] })
  const scarfTint = (lo: number): Tint => {
    const a = new THREE.Color(PALETTE.echarpe)
    const sh = new THREE.Color(0xa8443a)
    const y0 = world.neck.y
    return (_x, y, _z, c) => {
      c.copy(a).lerp(sh, THREE.MathUtils.smoothstep(y0 + lo - y, 0, 0.05) * 0.45)
    }
  }
  add(knitUV(wrapRing(0.088, 0.04, 0.62, 30, 14, 0), 16, 50), scarfTint(-0.04), 'neck', [0, -0.03, 0.006], { rot: [Math.PI / 2 + 0.12, 0, 0.06], scale: [1.17, 1, 1] })
  add(knitUV(wrapRing(0.083, 0.033, 0.6, 28, 12, 1.7), 14, 46), scarfTint(-0.01), 'neck', [0.004, 0.014, 0.012], { rot: [Math.PI / 2 - 0.1, 0, -0.08], scale: [1.1, 1, 1] })
  const knot = new THREE.SphereGeometry(0.04, 16, 12)
  const kp = knot.getAttribute('position')
  for (let i = 0; i < kp.count; i++) {
    const x = kp.getX(i)
    const y = kp.getY(i)
    const z = kp.getZ(i)
    const pinch = 1 - 0.28 * Math.exp(-(y * y) / 0.00012) + 0.06 * Math.sin(Math.atan2(x, z) * 3 + y * 60)
    kp.setXYZ(i, x * pinch, y * (1 + 0.12 * Math.sign(y)), z * pinch)
  }
  knot.computeVertexNormals()
  add(knitUV(knot, 10, 9, true), scarfTint(-0.05), 'neck', [-0.068, -0.045, -0.08], { scale: [1.0, 0.95, 0.8], rot: [0.2, 0.7, 0.35] })
  add(knitUV(wrapRing(0.034, 0.014, 0.75, 16, 8, 0.4), 8, 18), scarfTint(-0.05), 'neck', [-0.068, -0.045, -0.082], { rot: [0.3, 0.8, 1.25], scale: [0.9, 1.1, 1] })
  const shoulder = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.065, -0.04, -0.078), new THREE.Vector3(-0.1, -0.004, -0.05), new THREE.Vector3(-0.114, 0.004, 0.012),
    new THREE.Vector3(-0.097, -0.018, 0.07), new THREE.Vector3(-0.07, -0.05, 0.1),
  ])
  const over = new THREE.TubeGeometry(shoulder, 14, 0.027, 12, false)
  const op = over.getAttribute('position')
  const ouv = over.getAttribute('uv')
  const fr = shoulder.computeFrenetFrames(14, false)
  for (let i = 0; i < op.count; i++) {
    const seg = Math.round(ouv.getX(i) * 14)
    const c = shoulder.getPointAt(seg / 14)
    const up = fr.normals[seg]!
    const d = new THREE.Vector3(op.getX(i) - c.x, op.getY(i) - c.y, op.getZ(i) - c.z)
    const along = d.dot(up)
    d.addScaledVector(up, -along * 0.45)
    op.setXYZ(i, c.x + d.x, c.y + d.y, c.z + d.z)
  }
  over.deleteAttribute('normal')
  over.computeVertexNormals()
  add(knitUV(over, 14, 24), scarfTint(-0.02), 'neck', [0, 0, 0])
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

  const eyeY = HEAD_C[1] + 0.016
  const eyeParts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    const x = sx * 0.053
    const z = faceZ(x, 0.016)
    const yaw = faceYaw(x)
    const eye = new THREE.SphereGeometry(0.0245, 14, 10)
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
  const handle = new THREE.CylinderGeometry(0.015, 0.018, 0.85, 8)
  parts.push(paint(handle, PALETTE.bois))
  const head = new THREE.CylinderGeometry(0.1, 0.105, 0.04, 18)
  head.rotateX(Math.PI / 2)
  head.translate(0, 0.46, 0.022)
  parts.push(paint(head, 0x7a5040))
  const rim = new THREE.TorusGeometry(0.104, 0.008, 4, 22)
  rim.translate(0, 0.46, 0.022)
  parts.push(paint(rim, PALETTE.laiton))
  const tufts = new THREE.CylinderGeometry(0.094, 0.08, 0.045, 18, 1, false)
  tufts.rotateX(Math.PI / 2)
  tufts.translate(0, 0.46, -0.02)
  parts.push(paint(tufts, 0xb89464))
  const grip = new THREE.CylinderGeometry(0.023, 0.023, 0.14, 8)
  grip.translate(0, -0.36, 0)
  parts.push(paint(grip, PALETTE.cuir))
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
