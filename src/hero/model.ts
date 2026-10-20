import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CharacterRig, paintRig, type Look } from './character'
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
  rig: CharacterRig
  mesh: THREE.SkinnedMesh
  meshes: THREE.SkinnedMesh[]
  pose: Record<BoneName, THREE.Bone>
  bones: Record<BoneName, THREE.Bone>
  rest: Record<BoneName, THREE.Vector3>
  scrubber: THREE.Mesh
  voile: THREE.Mesh
  poulie: THREE.Mesh
  eyes: THREE.Mesh
  tuft: THREE.Mesh
  hood: THREE.Mesh
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

const ILO_LOOK: Look = (v, c) => {
  const { bone, p, mesh } = v
  if (mesh.startsWith('Hair') || mesh === 'Eyebrows') return !c.setHex(PALETTE.cheveux)
  if (mesh === 'Eyes') return !c.setHex(PALETTE.yeux)
  if (bone === 'Head' || bone === 'neck_01' || /^(hand|index|middle|ring|pinky|thumb)_/.test(bone)) return !!c.setHex(PALETTE.peau)
  if (bone.startsWith('lowerarm')) return !c.setHex(PALETTE.enroule).multiplyScalar(Math.floor(p.y * 50) % 2 ? 0.86 : 1)
  if (bone.startsWith('upperarm')) return !c.setHex(PALETTE.tunique)
  if (bone.startsWith('foot') || bone.startsWith('ball') || (bone.startsWith('calf') && p.y < 0.175)) return !c.setHex(PALETTE.bottes)
  if (bone.startsWith('calf')) return !c.setHex(PALETTE.enroule).multiplyScalar(Math.floor(p.y * 46) % 2 ? 0.86 : 1)
  if (bone.startsWith('thigh') && p.y < 0.658) return !c.setHex(Math.abs(p.x) > 0.122 && p.y > 0.548 ? PALETTE.combi : PALETTE.pantalon)
  if (Math.abs(p.y - TUNIC.belt) < 0.027) return !c.setHex(PALETTE.ceinture)
  return !c.setHex(p.z < 0 ? PALETTE.tunique : PALETTE.tuniqueOmbre)
}

export function buildHero(mats: HeroMaterials): HeroModel {
  const pose = {} as Record<BoneName, THREE.Bone>
  const rest = {} as Record<BoneName, THREE.Vector3>
  BONES.forEach((name) => {
    const b = new THREE.Bone()
    b.name = name
    const o = OFFSET[name]
    b.position.set(o[0], o[1], o[2])
    rest[name] = b.position.clone()
    const p = PARENT[name]
    if (p) pose[p].add(b)
    pose[name] = b
  })

  const pivotHeight = 0.85
  const root = new THREE.Group()
  root.name = 'hero'
  const pivot = new THREE.Group()
  pivot.position.y = pivotHeight
  root.add(pivot)

  const rig = new CharacterRig({ body: 'ilo', pose, rest })
  paintRig(rig, ILO_LOOK)
  for (const m of rig.meshes) {
    m.material = mats.body
    m.castShadow = true
  }
  const mesh = rig.meshes.find((m) => m.name.startsWith('SuperHero')) ?? rig.meshes[0]!
  rig.addSkinned(buildSkirt(rig, mesh.name), mats.cloth).castShadow = true
  mesh.name = 'hero-body'
  rig.group.position.y = -pivotHeight
  pivot.add(rig.group)
  const bones = rig.sockets

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

  const hood = buildHood(mats, bones.chest, bones.neck)
  bones.chest.add(hood)

  for (const m of ['Eyes', 'Eyebrows', 'Hair_SimpleParted']) rig.removeMesh(m)
  rig.dropBone('hero-body', 'Head')
  const head = new THREE.Mesh(buildHead(), mats.body)
  head.name = 'hero-head'
  head.castShadow = true
  bones.head.add(head)
  const eyes = new THREE.Mesh(buildEyes(), mats.body)
  eyes.name = 'hero-eyes'
  eyes.position.copy(EYES_AT)
  bones.head.add(eyes)
  const crown = new THREE.Vector3(0, HEAD.y + HEAD.r * 0.95, HEAD.z + HEAD.r * 0.4)

  const tuftParts: THREE.BufferGeometry[] = []
  for (const [dx, len, r] of [[-0.012, HEAD.tail * 0.8, 0.018], [0.012, HEAD.tail * 0.75, 0.016], [0, HEAD.tail, 0.022]] as const) {
    const c = new THREE.ConeGeometry(r, len, 7, 3)
    c.scale(1, 1, 0.7)
    c.rotateX(Math.PI)
    c.translate(dx, -len / 2, 0)
    tuftParts.push(paint(c, PALETTE.cheveux))
  }
  const tuft = new THREE.Mesh(rigid(tuftParts), mats.body)
  tuft.name = 'hero-tuft'
  tuft.position.copy(crown).add(new THREE.Vector3(0, 0, HEAD.knot))
  tuft.castShadow = true
  bones.head.add(tuft)

  const scarfAnchor = new THREE.Object3D()
  scarfAnchor.position.set(0, 0.0, 0.09)
  bones.neck.add(scarfAnchor)
  const hairAnchor = new THREE.Object3D()
  hairAnchor.position.copy(crown)
  bones.head.add(hairAnchor)

  return { root, pivot, rig, mesh, meshes: rig.meshes, pose, bones, rest, scrubber, voile, poulie, eyes, tuft, hood, hold, clip, scarfAnchor, hairAnchor, pivotHeight }
}

// Head socket frame, metres: origin at the Head joint, +y up, -z towards the face. Drawn like the crowd's round heads.
const HEAD = { r: 0.13, y: 0.085, z: -0.012, knot: 0.036, tail: 0.11, band: 0.42, lens: 0.026, lensX: 0.044 } as const
const EYES_AT = new THREE.Vector3(0, HEAD.y - HEAD.r * 0.03, HEAD.z - HEAD.r * 0.9)

function blob(parts: THREE.BufferGeometry[], hex: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0): void {
  const g = new THREE.SphereGeometry(1, 14, 10)
  g.scale(sx, sy, sz)
  g.rotateZ(rz)
  g.translate(x, y, z)
  parts.push(paint(g, hex))
}

function buildHead(): THREE.BufferGeometry {
  const { r } = HEAD
  const parts: THREE.BufferGeometry[] = []
  const skull = new THREE.SphereGeometry(1, 28, 20)
  skull.scale(r, r * 0.98, r * 0.97)
  parts.push(paint(skull, PALETTE.peau))
  const fz = -r * 0.9
  for (const s of [-1, 1]) {
    blob(parts, PALETTE.peau, s * r * 0.98, -r * 0.06, 0, r * 0.15, r * 0.24, r * 0.14)
    blob(parts, PALETTE.joues, s * r * 0.55, -r * 0.3, fz + r * 0.13, r * 0.16, r * 0.09, r * 0.05)
    blob(parts, PALETTE.cheveux, s * r * 0.36, r * 0.27, fz + r * 0.04, r * 0.2, r * 0.045, r * 0.07, s * 0.16)
    blob(parts, PALETTE.cheveux, s * r * 0.9, -r * 0.02, -r * 0.3, r * 0.09, r * 0.3, r * 0.11, s * 0.1)
  }
  blob(parts, NOSE, 0, -r * 0.16, fz - r * 0.06, r * 0.1, r * 0.09, r * 0.11)
  blob(parts, PALETTE.levres, 0, -r * 0.48, -r * 0.86, r * 0.14, r * 0.028, r * 0.05)
  const cap = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.56)
  cap.scale(r * 1.07, r * 1.07, r * 1.07)
  cap.rotateX(0.62)
  parts.push(paint(cap, PALETTE.cheveux))
  blob(parts, PALETTE.cheveux, 0, -r * 0.05, r * 0.38, r * 0.96, r * 0.8, r * 0.62)
  const band = new THREE.TorusGeometry(r * 1.0, r * 0.07, 6, 36)
  band.rotateX(Math.PI / 2 + 0.15)
  band.translate(0, r * HEAD.band, 0)
  parts.push(paint(band, PALETTE.bandeau))
  for (const s of [-1, 1]) {
    const lens = new THREE.CylinderGeometry(HEAD.lens, HEAD.lens * 1.08, 0.018, 14)
    lens.rotateX(Math.PI / 2 + 0.55)
    lens.translate(s * HEAD.lensX, r * 0.66, -r * 0.84)
    parts.push(paint(lens, PALETTE.laiton))
    const glass = new THREE.CircleGeometry(HEAD.lens * 0.78, 14)
    glass.rotateX(-0.55)
    glass.translate(s * HEAD.lensX, r * 0.66 + 0.006, -r * 0.84 - 0.01)
    parts.push(paint(glass, PALETTE.lunettes))
  }
  blob(parts, PALETTE.cheveux, 0, r * 0.95, r * 0.4, HEAD.knot, HEAD.knot, HEAD.knot)
  const g = rigid(parts)
  g.translate(0, HEAD.y, HEAD.z)
  return g
}

// Centred on EYES_AT so the blink can squash it in place.
function buildEyes(): THREE.BufferGeometry {
  const { r } = HEAD
  const parts: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    blob(parts, PALETTE.yeux, s * r * 0.34, 0, 0, r * 0.14, r * 0.21, r * 0.09)
    blob(parts, PALETTE.reflet, s * r * 0.34 + r * 0.05, r * 0.07, -r * 0.085, r * 0.045, r * 0.045, r * 0.03)
  }
  return rigid(parts)
}

// Armature units (glTF, +z forward). The skirt hangs from the belt to mid-thigh and follows the thighs below it.
const TUNIC = { belt: 1.075, hem: 0.6, hemBand: 0.035, rows: 8, segs: 28, ease: 0.014, flare: 0.075, thighs: 0.7 } as const
const SKIRT_BONES = new Set(['pelvis', 'spine_01', 'thigh_l', 'thigh_r'])

function buildSkirt(rig: CharacterRig, bodyMesh: string): THREE.BufferGeometry {
  const pts = rig.restPoints(bodyMesh).filter((v) => SKIRT_BONES.has(v.bone)).map((v) => v.p)
  const strips: [t0: number, t1: number, rows: number, color: 'cloth' | 'hem'][] = [
    [0, 1 - TUNIC.hemBand / (TUNIC.belt - TUNIC.hem), TUNIC.rows, 'cloth'],
    [1 - TUNIC.hemBand / (TUNIC.belt - TUNIC.hem), 1, 1, 'hem'],
  ]
  const pelvis = rig.boneIndex('pelvis')
  const thighL = rig.boneIndex('thigh_l')
  const thighR = rig.boneIndex('thigh_r')
  const pos: number[] = []
  const col: number[] = []
  const skinI: number[] = []
  const skinW: number[] = []
  const idx: number[] = []
  const front = new THREE.Color(PALETTE.tunique)
  const back = new THREE.Color(PALETTE.tuniqueOmbre)
  const hem = new THREE.Color(PALETTE.doublure)
  const c = new THREE.Color()
  let rx = 0
  let z0 = Infinity
  let z1 = -Infinity
  const ring = (t: number) => {
    const y = TUNIC.belt + (TUNIC.hem - TUNIC.belt) * t
    for (const p of pts) {
      if (Math.abs(p.y - y) > 0.03) continue
      rx = Math.max(rx, Math.abs(p.x) + TUNIC.ease)
      z0 = Math.min(z0, p.z - TUNIC.ease)
      z1 = Math.max(z1, p.z + TUNIC.ease)
    }
    const flare = TUNIC.flare * t * t
    return { y, rx: rx + flare, rz: (z1 - z0) / 2 + flare * 0.7, cz: (z0 + z1) / 2 }
  }
  for (const [t0, t1, rows, kind] of strips) {
    const base = pos.length / 3
    for (let r = 0; r <= rows; r++) {
      const t = t0 + ((t1 - t0) * r) / rows
      const { y, rx: ex, rz: ez, cz } = ring(t)
      const w = TUNIC.thighs * THREE.MathUtils.smoothstep(t, 0.15, 1)
      for (let k = 0; k <= TUNIC.segs; k++) {
        const a = (k / TUNIC.segs) * Math.PI * 2
        const sx = Math.sin(a)
        const cz2 = Math.cos(a)
        pos.push(ex * sx, y, cz + ez * cz2)
        if (kind === 'hem') c.copy(hem)
        else c.copy(back).lerp(front, THREE.MathUtils.smoothstep(cz2, -0.25, 0.25))
        col.push(c.r, c.g, c.b)
        skinI.push(pelvis, thighL, thighR, pelvis)
        skinW.push(1 - w, w * (0.5 + 0.5 * sx), w * (0.5 - 0.5 * sx), 0)
      }
    }
    const stride = TUNIC.segs + 1
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < TUNIC.segs; k++) {
        const a = base + r * stride + k
        const b = a + stride
        idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aMat', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 4), 4))
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinI, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Chest socket frame, metres, -z towards the face: a hood folded down behind the neck, over a soft collar.
const HOOD = { collar: 0.078, collarTube: 0.03, lump: [0.12, 0.085, 0.055], lumpY: -0.01, lumpZ: 0.085, lumpTilt: -0.5 } as const

function buildHood(mats: HeroMaterials, chest: THREE.Object3D, neck: THREE.Object3D): THREE.Mesh {
  chest.updateWorldMatrix(true, true)
  const at = chest.worldToLocal(neck.getWorldPosition(new THREE.Vector3()))
  const collar = new THREE.TorusGeometry(HOOD.collar, HOOD.collarTube, 8, 24)
  collar.rotateX(Math.PI / 2 - 0.25)
  collar.scale(1, 1, 1.12)
  collar.translate(at.x, at.y - 0.015, at.z + 0.008)
  const lump = new THREE.SphereGeometry(1, 16, 10)
  lump.scale(HOOD.lump[0], HOOD.lump[1], HOOD.lump[2])
  lump.rotateX(HOOD.lumpTilt)
  lump.translate(at.x, at.y + HOOD.lumpY, at.z + HOOD.lumpZ)
  const m = new THREE.Mesh(rigid([paint(collar, PALETTE.tunique), paint(lump, PALETTE.tuniqueOmbre)]), mats.body)
  m.name = 'hero-hood'
  m.castShadow = true
  return m
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
