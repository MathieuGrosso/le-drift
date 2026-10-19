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
  upperArmL: [-0.172, 0.15, 0], foreArmL: [0, -0.27, 0], handL: [0, -0.24, 0],
  upperArmR: [0.172, 0.15, 0], foreArmR: [0, -0.27, 0], handR: [0, -0.24, 0],
  thighL: [-0.095, -0.05, 0], shinL: [0, -0.42, 0], footL: [0, -0.39, 0],
  thighR: [0.095, -0.05, 0], shinR: [0, -0.42, 0], footR: [0, -0.39, 0],
}

export const PALETTE = {
  echarpe: 0xe8674a, tunique: 0x34507a, doublure: 0x7189ad, bandeau: 0x5b3a52, enroule: 0x968670, tuniqueOmbre: 0x22385a, peau: 0xc98e6b, joues: 0xd47f68, levres: 0x9a5c50,
  yeux: 0x2a2238, reflet: 0xfff6e6, lest: 0xc9a54b, combi: 0x2a3a52, bottes: 0x6b4a3a, pantalon: 0x4e4a40, ceinture: 0x5e3e2c, revers: 0x8a6248, semelle: 0x3e2e36,
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

const TUNIC = { radius: 0.172, length: 0.34, top: -0.02, slit: 0.17, legFollow: 0.75, legFollowSpan: 0.24, legBlend: 0.07 } as const
const WRAPS = { forearm: 5, calf: 6 } as const
const HAIR = { knotEl: 0.95, knotR: 0.04, capPhi: 0.6, capTilt: 0.75, bandFrontEl: 0.36, bandBackEl: 0.12, bandWidth: 0.017, bandTail: 0.11, goggleEl: 0.62, strands: 7, tail: 0.1 } as const
const COLLAR = { width: 0.013, lift: 0.004, flat: 0.35, samples: 28 } as const

function skirt(r: number, h: number, start: number, len: number, count: number, amp: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r * 1.03, h, 40, 12, true, start, len)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const t = (h / 2 - pos.getY(i)) / h
    pos.setY(i, pos.getY(i) + Math.sin(Math.atan2(pos.getX(i), pos.getZ(i)) * 3 + seed * 5) * 0.006 * t * t)
  }
  folds(g, count, amp, seed)
  const shade = g.getAttribute('aShade')
  const trim = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const t = (h / 2 - pos.getY(i)) / h
    if (t > 0.95) shade.setX(i, shade.getX(i) * 0.8)
    else if (t > 0.88) trim[i] = 0.3
  }
  g.setAttribute('aTrim', new THREE.BufferAttribute(trim, 1))
  return g
}

// Squashes a tube radially around `centre` so it lies on that surface, thinning it by `taper` towards its end.
function taperTube(g: THREE.TubeGeometry, centre: THREE.Vector3, flat: number, taper = 0): THREE.BufferGeometry {
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  const c = new THREE.Vector3()
  const d = new THREE.Vector3()
  const out = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const t = uv.getX(i)
    g.parameters.path.getPointAt(t, c)
    d.set(pos.getX(i) - c.x, pos.getY(i) - c.y, pos.getZ(i) - c.z)
    out.subVectors(c, centre).normalize()
    d.addScaledVector(out, -d.dot(out) * (1 - flat)).multiplyScalar(1 - taper * t)
    pos.setXYZ(i, c.x + d.x, c.y + d.y, c.z + d.z)
  }
  g.deleteAttribute('normal')
  g.computeVertexNormals()
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

// Strands converge on the knot: stripes are angles around the head-centre-to-knot axis.
function combed(base: number, hi: number, centre: THREE.Vector3, axis: THREE.Vector3): Tint {
  const a = new THREE.Color(base)
  const b = new THREE.Color(hi)
  const u = new THREE.Vector3(1, 0, 0).addScaledVector(axis, -axis.x).normalize()
  const v = new THREE.Vector3().crossVectors(axis, u)
  const p = new THREE.Vector3()
  return (x, y, z, c) => {
    p.set(x, y, z).sub(centre)
    const phi = Math.atan2(p.dot(v), p.dot(u))
    const s = 0.5 + 0.5 * Math.sin(phi * 16 + Math.sin(phi * 5) * 1.3)
    const lit = THREE.MathUtils.smoothstep(p.normalize().dot(axis), -0.2, 0.75)
    c.copy(a).lerp(b, s * s * 0.5 * lit + lit * 0.15)
  }
}

type Influence = readonly [bone: number, weight: number]
type Weigh = (x: number, y: number, z: number) => readonly Influence[]

function skin(g: THREE.BufferGeometry, weigh: Weigh): THREE.BufferGeometry {
  const pos = g.getAttribute('position')
  const n = pos.count
  const idx = new Uint16Array(n * 4)
  const w = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    weigh(pos.getX(i), pos.getY(i), pos.getZ(i)).slice(0, 4).forEach(([b, k], j) => {
      idx[i * 4 + j] = b
      w[i * 4 + j] = k
    })
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
    opts?: { rot?: [number, number, number]; scale?: [number, number, number]; to?: BoneName; split?: (y: number) => number; skin?: boolean; weigh?: Weigh },
  ) => {
    if (opts?.scale) g.scale(...opts.scale)
    if (opts?.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...opts.rot)))
    const w = world[bone]
    g.translate(w.x + at[0], w.y + at[1], w.z + at[2])
    const b0 = bi(bone)
    const b1 = opts?.to ? bi(opts.to) : b0
    const split = opts?.split
    const weigh: Weigh = opts?.weigh ?? ((_x, y) => {
      const t = split ? split(y) : 0
      return [[b0, 1 - t], [b1, t]]
    })
    parts.push(skin(paint(g, color, opts?.skin ?? (typeof color === 'number' && SKIN.has(color))), weigh))
  }
  const cap = (r: number, len: number, seg = 8) => new THREE.CapsuleGeometry(r, len, 3, seg)
  const limbSplit = (bone: BoneName, len: number) => {
    const top = world[bone].y
    return (y: number) => THREE.MathUtils.clamp((top - y - len * 0.75) / (len * 0.4), 0, 0.5)
  }

  const HEAD_C: [number, number, number] = [0, 0.115, -0.005]
  const HEAD_R: [number, number, number] = [0.142, 0.166, 0.153]
  const faceZ = (x: number, y: number) => {
    const u = 1 - (x / HEAD_R[0]) ** 2 - (y / HEAD_R[1]) ** 2
    return HEAD_C[2] - HEAD_R[2] * Math.sqrt(Math.max(0, u))
  }
  const onFace = (x: number, y: number, out: number): [number, number, number] => [x, HEAD_C[1] + y, faceZ(x, y) - out]
  const faceYaw = (x: number) => -Math.asin(THREE.MathUtils.clamp(x / HEAD_R[0], -1, 1)) * 0.9

  add(taper(cap(0.13, 0.12, 12), 0.92, 1.0), PALETTE.pantalon, 'hips', [0, 0.02, 0], { scale: [1.1, 1, 0.85] })
  const chestGeo = lathe([[0.14, -0.13], [0.145, -0.04], [0.148, 0.05], [0.134, 0.11], [0.112, 0.152], [0.088, 0.178], [0.055, 0.195], [0.001, 0.2]], 20)
  const chestSplit = (y: number) => THREE.MathUtils.clamp((world.chest.y - y) / 0.2, 0, 0.5)
  add(chestGeo, PALETTE.tunique, 'chest', [0, 0, 0], { scale: [1.14, 1, 0.82], to: 'spine', split: chestSplit })
  const [bSpine, bHips, bThighL, bThighR] = [bi('spine'), bi('hips'), bi('thighL'), bi('thighR')]
  const tunicWeigh: Weigh = (x, y) => {
    if (y > world.hips.y) {
      const u = THREE.MathUtils.clamp((world.spine.y - y) / (world.spine.y - world.hips.y), 0, 1)
      return [[bSpine, 1 - u], [bHips, u]]
    }
    const t = THREE.MathUtils.clamp((world.hips.y - y) / TUNIC.legFollowSpan, 0, 1) * TUNIC.legFollow
    const s = THREE.MathUtils.smoothstep(x, -TUNIC.legBlend, TUNIC.legBlend)
    return [[bHips, 1 - t], [bThighL, t * (1 - s)], [bThighR, t * s]]
  }
  const half = Math.PI * (1 - TUNIC.slit) / 2
  const cloth: THREE.Mesh[] = [new THREE.Mesh(chestGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))]
  for (const start of [Math.PI - half, -half]) {
    const g = skirt(TUNIC.radius, TUNIC.length, start, half * 2, 5, 0.02, start)
    add(g, PALETTE.tunique, 'spine', [0, TUNIC.top - TUNIC.length / 2, 0], { scale: [1.08, 1, 0.86], weigh: tunicWeigh })
    cloth.push(new THREE.Mesh(g, cloth[0]!.material))
  }
  const ray = new THREE.Raycaster()
  const onCloth = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, -1), new THREE.Vector3(0, 0, 1))
    const hit = ray.intersectObjects(cloth, false)[0]
    return new THREE.Vector3(x, y, (hit ? hit.point.z : -0.15) - COLLAR.lift)
  }
  const collarWeigh: Weigh = (x, y, z) => {
    if (y < world.spine.y) return tunicWeigh(x, y, z)
    const t = chestSplit(y)
    return [[bi('chest'), 1 - t], [bSpine, t]]
  }
  // Left panel over right, Ashitaka-style: the over edge runs from the left of the throat to the right hip.
  for (const edge of [
    [[-0.07, world.neck.y - 0.03], [-0.01, world.chest.y + 0.02], [0.08, world.chest.y - 0.1], [0.11, world.hips.y + 0.02]],
    [[0.07, world.neck.y - 0.03], [0.0, world.chest.y + 0.0]],
  ] as [number, number][][]) {
    const curve = new THREE.CatmullRomCurve3(edge.map(([x, y]) => new THREE.Vector3(x, y, 0)))
    const path = new THREE.CatmullRomCurve3(curve.getSpacedPoints(COLLAR.samples).map((p) => onCloth(p.x, p.y)))
    const g = new THREE.TubeGeometry(path, COLLAR.samples, COLLAR.width, 6, false)
    const gp = g.getAttribute('position')
    const uv = g.getAttribute('uv')
    const c = new THREE.Vector3()
    for (let i = 0; i < gp.count; i++) {
      path.getPointAt(Math.min(1, uv.getX(i)), c)
      gp.setZ(i, c.z + (gp.getZ(i) - c.z) * COLLAR.flat)
    }
    g.deleteAttribute('normal')
    g.computeVertexNormals()
    add(g, PALETTE.doublure, 'root', [0, 0, 0], { weigh: collarWeigh })
  }
  add(lathe([[0.17, -0.03], [0.176, -0.015], [0.177, 0.015], [0.172, 0.03]], 24), PALETTE.ceinture, 'hips', [0, 0.05, 0], { scale: [1.12, 1, 0.92] })
  add(new RoundedBoxGeometry(0.04, 0.05, 0.014, 2, 0.004), PALETTE.ceinture, 'hips', [0.09, 0.03, -0.158], { rot: [0.1, -0.5, 0] })
  for (const [i, a] of [1.3, -1.3].entries()) {
    const pouch = new RoundedBoxGeometry(0.05, 0.06, 0.03, 2, 0.01)
    add(pouch, i % 2 ? 0x9a7650 : 0xa8845a, 'hips', [Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.15], { rot: [0.08, a, 0] })
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
      x *= 1 - (0.06 + 0.1 * front) * y * y - 0.11 * jaw * front
      z *= 1 - 0.05 * y * y
      y -= 0.13 * front * lo
      z -= 0.05 * front * lo
      if (y < -0.15) {
        const lim = 0.97 + 0.5 * (y + 0.15)
        const ax = Math.abs(x)
        if (ax > lim) x = Math.sign(x) * (lim + (ax - lim) * 0.25)
      }
      if (y < -0.55 && front < 0.55) y = -0.55 + (y + 0.55) * (0.35 + 0.65 * front / 0.55)
      const chin = Math.exp(-(x * x) / 0.05 - ((y + 0.9) ** 2) / 0.025) * front
      z -= 0.05 * chin
      y -= 0.02 * chin
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
    c.lerp(joues, Math.exp(-(bx * bx) / 0.035 - (by * by) / 0.018) * front * 0.3)
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
    add(cap(0.0085, 0.04, 4), PALETTE.cheveux, 'head', onFace(sx * 0.056, 0.044, 0.003), { rot: [0, faceYaw(sx * 0.056), Math.PI / 2 + sx * 0.03], scale: [1, 1, 0.65] })
  }
  add(new THREE.SphereGeometry(0.012, 10, 8), NOSE, 'head', onFace(0, -0.016, 0.004), { scale: [1.1, 0.8, 0.95] })
  add(new THREE.TorusGeometry(0.032, 0.0028, 4, 10, Math.PI * 0.2), PALETTE.levres, 'head', [0, HEAD_C[1] - 0.034, faceZ(0, -0.064) - 0.0025], { rot: [0.25, 0, -Math.PI / 2 - Math.PI * 0.1] })

  const HC = new THREE.Vector3(0, HEAD_C[1] + 0.012, 0.012)
  const HR = new THREE.Vector3(0.152, 0.168, 0.162)
  const onSkull = (az: number, el: number) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const knotDir = onSkull(0, HAIR.knotEl)
  const knotAt = knotDir.clone().multiply(HR).add(HC)
  const hair = combed(PALETTE.cheveux, PALETTE.cheveuxReflet, world.head.clone().add(HC), knotDir)
  add(new THREE.SphereGeometry(0.156, 24, 14, 0, Math.PI * 2, 0, Math.PI * HAIR.capPhi), hair, 'head', [0, HC.y, HC.z], { rot: [HAIR.capTilt, 0, 0], scale: [0.99, 1.0, 1.04] })
  add(new THREE.SphereGeometry(0.148, 16, 10), hair, 'head', [0, HEAD_C[1] - 0.01, 0.035], { scale: [0.97, 1.0, 0.9] })
  const clump = (azDeg: number, elDeg: number, len: number, r: number, twist = 0, flat = 0.42) => {
    const az = THREE.MathUtils.degToRad(azDeg)
    const el = THREE.MathUtils.degToRad(elDeg)
    const n = onSkull(az, el)
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
  clump(166, 46, 0.075, 0.02, 0.35)
  clump(-160, 44, 0.065, 0.018, -0.3)
  clump(122, 22, 0.1, 0.026, 0.15)
  clump(-122, 22, 0.1, 0.026, -0.15)
  clump(0, 6, 0.045, 0.05)
  clump(40, 6, 0.045, 0.044, 0.2)
  clump(-40, 6, 0.045, 0.044, -0.2)
  clump(84, 14, 0.05, 0.04, -0.1)
  clump(-84, 14, 0.05, 0.04, 0.1)

  for (let k = 0; k < HAIR.strands; k++) {
    const az = Math.PI + (k / (HAIR.strands - 1) - 0.5) * 2.2
    const from = onSkull(az, HAIR.bandFrontEl + 0.12)
    const pts = [0, 0.35, 0.7, 1].map((t) => from.clone().lerp(knotDir, t).normalize().multiply(HR).multiplyScalar(1.03 - 0.02 * t).add(HC))
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.014, 5, false)
    add(taperTube(g, HC, 0.45, 0.6), hair, 'head', [0, 0, 0])
  }
  const bun = new THREE.SphereGeometry(HAIR.knotR, 14, 10)
  bun.scale(1, 0.8, 1)
  bun.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), knotDir))
  const bunAt = knotAt.clone().addScaledVector(knotDir, HAIR.knotR * 0.5)
  add(bun, hair, 'head', [bunAt.x, bunAt.y, bunAt.z])
  const tie = new THREE.TorusGeometry(HAIR.knotR * 0.72, 0.008, 5, 16)
  tie.rotateX(Math.PI / 2)
  tie.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), knotDir))
  const tieAt = knotAt.clone().addScaledVector(knotDir, HAIR.knotR * 1.1)
  add(tie, PALETTE.bandeau, 'head', [tieAt.x, tieAt.y, tieAt.z])

  const bandPts: THREE.Vector3[] = []
  for (let i = 0; i < 32; i++) {
    const az = (i / 32) * Math.PI * 2
    const toFront = (1 - Math.cos(az)) / 2
    const el = THREE.MathUtils.lerp(HAIR.bandBackEl, HAIR.bandFrontEl, toFront)
    const sink = THREE.MathUtils.lerp(1.06, 1.025, toFront)
    bandPts.push(onSkull(az, el).multiply(HR).multiplyScalar(sink).add(HC))
  }
  const bandCurve = new THREE.CatmullRomCurve3(bandPts, true)
  const headband = taperTube(new THREE.TubeGeometry(bandCurve, 64, HAIR.bandWidth, 6, true), HC, 0.3)
  add(headband, PALETTE.bandeau, 'head', [0, 0, 0])
  const tailAt = bandCurve.getPointAt(0)
  for (const sx of [-1, 1]) {
    const tail = new RoundedBoxGeometry(0.024, HAIR.bandTail, 0.006, 2, 0.003)
    tail.translate(0, -HAIR.bandTail / 2, 0)
    add(tail, PALETTE.bandeau, 'head', [tailAt.x + sx * 0.012, tailAt.y, tailAt.z + 0.008], { rot: [0.25, 0, sx * 0.22] })
  }

  for (const sx of [-1, 1]) {
    const az = Math.PI + sx * 0.5
    const n = onSkull(az, HAIR.goggleEl)
    const at = n.clone().multiply(HR).multiplyScalar(1.08).add(HC)
    const lensUp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().add(new THREE.Vector3(0, 0, -0.5)).normalize())
    const frame = new THREE.CylinderGeometry(0.034, 0.037, 0.026, 14)
    frame.applyQuaternion(lensUp)
    add(frame, PALETTE.laiton, 'head', [at.x, at.y, at.z])
    const glass = new THREE.CylinderGeometry(0.026, 0.026, 0.028, 14)
    glass.translate(0, 0.002, 0)
    glass.applyQuaternion(lensUp)
    add(glass, PALETTE.lunettes, 'head', [at.x, at.y, at.z])
  }
  const bridge = onSkull(Math.PI, HAIR.goggleEl).multiply(HR).multiplyScalar(1.1).add(HC)
  add(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 6), PALETTE.laiton, 'head', [bridge.x, bridge.y, bridge.z], { rot: [0, 0, Math.PI / 2] })

  for (const s of ['L', 'R'] as const) {
    const sx = s === 'L' ? -1 : 1
    const ua = `upperArm${s}` as BoneName
    const fa = `foreArm${s}` as BoneName
    const ha = `hand${s}` as BoneName
    add(folds(lathe([[0.001, -0.3], [0.036, -0.295], [0.04, -0.26], [0.043, -0.18], [0.046, -0.08], [0.047, -0.03], [0.042, 0.0], [0.03, 0.025], [0.001, 0.035]], 16), 4, 0.025, sx), PALETTE.tunique, ua, [sx * 0.002, 0, 0], { to: fa, split: limbSplit(ua, 0.27), rot: [0, 0, sx * 0.03] })
    add(lathe([[0.001, -0.25], [0.025, -0.246], [0.027, -0.225], [0.031, -0.18], [0.037, -0.12], [0.04, -0.06], [0.039, -0.02], [0.034, 0.0], [0.001, 0.025]], 16), PALETTE.cuir, fa, [0, 0, 0.002], { to: ha, split: limbSplit(fa, 0.24), scale: [0.95, 1, 1.05] })
    for (let k = 0; k < WRAPS.forearm; k++) {
      const y = -0.21 + k * 0.03
      const r = 0.033 + 0.0024 * k
      add(wrapRing(r, 0.0085, 0.5, 16, 5, k), PALETTE.enroule, fa, [0, y, 0.002], { rot: [Math.PI / 2 + 0.22 * (k % 2 ? 1 : -1), 0, 0], scale: [0.95, 1, 1.05] })
    }
    const mitten = lathe([[0.019, 0.004], [0.024, -0.012], [0.029, -0.034], [0.031, -0.056], [0.029, -0.072], [0.022, -0.086], [0.012, -0.095], [0.001, -0.098]], 14)
    const mp = mitten.getAttribute('position')
    for (let i = 0; i < mp.count; i++) {
      const t = THREE.MathUtils.clamp(-mp.getY(i) / 0.098, 0, 1)
      mp.setX(i, mp.getX(i) * (0.74 - 0.08 * t) - sx * t * t * 0.016)
      mp.setZ(i, mp.getZ(i) * (0.95 + 0.12 * Math.sin(t * Math.PI)))
    }
    mitten.computeVertexNormals()
    add(mitten, PALETTE.peau, ha, [sx * 0.002, -0.004, 0], { rot: [0.06, 0, 0], scale: [1.12, 1.1, 1.12] })
    const thumb = new THREE.Vector3(-sx * 0.3, -0.62, -0.72).normalize()
    const tg = cap(0.0135, 0.028, 8)
    tg.translate(0, 0.013, 0)
    tg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), thumb))
    add(tg, PALETTE.peau, ha, [-sx * 0.004, -0.024, -0.016])
    const th = `thigh${s}` as BoneName
    const sh = `shin${s}` as BoneName
    const ft = `foot${s}` as BoneName
    add(folds(lathe([[0.001, -0.45], [0.05, -0.44], [0.055, -0.4], [0.06, -0.3], [0.066, -0.17], [0.073, -0.06], [0.072, 0.03], [0.001, 0.07]], 14), 5, 0.03, sx), PALETTE.pantalon, th, [0, 0, 0], { to: sh, split: limbSplit(th, 0.42) })
    add(lathe([[0.001, -0.4], [0.047, -0.395], [0.05, -0.36], [0.05, -0.3], [0.055, -0.22], [0.058, -0.12], [0.054, -0.04], [0.052, 0.02], [0.001, 0.04]], 14), PALETTE.enroule, sh, [0, 0, 0.003], { to: ft, split: limbSplit(sh, 0.4) })
    for (let k = 0; k < WRAPS.calf; k++) {
      const y = -0.33 + k * 0.05
      const r = 0.05 + 0.006 * Math.sin((k / (WRAPS.calf - 1)) * Math.PI)
      add(wrapRing(r, 0.0065, 0.55, 18, 5, k + sx), PALETTE.revers, sh, [0, y, 0.003], { rot: [Math.PI / 2 + 0.2 * (k % 2 ? 1 : -1), 0, 0] })
    }
    add(lathe([[0.001, -0.4], [0.05, -0.395], [0.054, -0.37], [0.056, -0.345], [0.052, -0.34], [0.001, -0.335]], 14), PALETTE.bottes, sh, [0, 0, 0.004], { to: ft, split: limbSplit(sh, 0.4) })
    add(new THREE.SphereGeometry(1, 14, 10), PALETTE.bottes, ft, [0, -0.012, -0.075], { scale: [0.063, 0.052, 0.11] })
    add(new THREE.SphereGeometry(1, 12, 8), PALETTE.bottes, ft, [0, -0.005, 0.0], { scale: [0.055, 0.06, 0.06] })
    add(new RoundedBoxGeometry(0.12, 0.028, 0.255, 2, 0.012), PALETTE.semelle, ft, [0, -0.05, -0.06])
  }
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
    eye.scale(0.8, 1.14, 0.42)
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
  for (const [dx, len, r] of [[-0.012, HAIR.tail * 0.8, 0.018], [0.012, HAIR.tail * 0.75, 0.016], [0, HAIR.tail, 0.022]] as const) {
    const c = new THREE.ConeGeometry(r, len, 7, 3)
    c.scale(1, 1, 0.7)
    c.rotateX(Math.PI)
    c.translate(dx, -len / 2, 0)
    const p = c.getAttribute('position')
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + (p.getY(i) / len) ** 2 * len * 0.25)
    c.computeVertexNormals()
    tuftParts.push(paint(c, band(PALETTE.cheveux, PALETTE.cheveuxReflet, -0.03, -0.0)))
  }
  const tuft = new THREE.Mesh(rigid(tuftParts), mats.body)
  tuft.name = 'hero-tuft'
  tuft.position.copy(knotAt).addScaledVector(knotDir, HAIR.knotR * 1.2)
  tuft.castShadow = true
  bones.head.add(tuft)

  const scarfAnchor = new THREE.Object3D()
  scarfAnchor.position.set(0, 0.0, 0.09)
  bones.neck.add(scarfAnchor)
  const hairAnchor = new THREE.Object3D()
  hairAnchor.position.copy(knotAt)
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
