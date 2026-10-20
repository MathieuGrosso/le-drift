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
  if (bone.startsWith('lowerarm')) return !c.setHex(PALETTE.enroule).multiplyScalar(Math.floor(p.y * 55) % 2 ? 0.86 : 1)
  if (bone.startsWith('upperarm')) return !c.setHex(PALETTE.combi)
  if (bone.startsWith('foot') || bone.startsWith('ball') || (bone.startsWith('calf') && p.y < 0.16)) return !c.setHex(PALETTE.bottes)
  if (bone.startsWith('calf')) return !c.setHex(PALETTE.enroule).multiplyScalar(Math.floor(p.y * 50) % 2 ? 0.86 : 1)
  if (bone.startsWith('thigh') && p.y < 0.6) return !c.setHex(Math.abs(p.x) > 0.1 && p.y > 0.5 ? PALETTE.combi : PALETTE.pantalon)
  if (Math.abs(p.y - 0.98) < 0.025) return !c.setHex(PALETTE.ceinture)
  const front = p.z < 0
  if (front && p.y > 1.12 && p.y < 1.42 && Math.abs(Math.abs(p.x + (p.y - 1.12) * 0.25) - (p.y - 1.12) * 0.4) < 0.018) return !c.setHex(PALETTE.doublure)
  return !c.setHex(front ? PALETTE.tunique : PALETTE.tuniqueOmbre)
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
  rig.group.position.y = -pivotHeight
  pivot.add(rig.group)
  const bones = rig.sockets
  const mesh = rig.meshes.find((m) => m.name.startsWith('SuperHero')) ?? rig.meshes[0]!
  mesh.name = 'hero-body'

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

  const eyes = rig.bakeRigid('Eyes', bones.head, mats.body)
  if (!eyes) throw new Error('hero body has no Eyes mesh')

  const crown = new THREE.Vector3(0, HEADGEAR.crownY, HEADGEAR.crownZ)
  const gear: THREE.BufferGeometry[] = []
  const band = new THREE.TorusGeometry(1, HEADGEAR.band, 6, 32)
  band.rotateX(Math.PI / 2 - HEADGEAR.tilt)
  band.scale(HEADGEAR.rx, 1, HEADGEAR.rz)
  band.translate(0, HEADGEAR.bandY, HEADGEAR.bandZ)
  gear.push(paint(band, PALETTE.bandeau))
  for (const sx of [-1, 1]) {
    const lens = new THREE.CylinderGeometry(0.026, 0.028, 0.02, 14)
    lens.rotateX(Math.PI / 2 + 0.5)
    lens.translate(sx * 0.034, HEADGEAR.bandY + 0.035, HEADGEAR.bandZ - HEADGEAR.rz + 0.012)
    gear.push(paint(lens, PALETTE.laiton))
    const glass = new THREE.CircleGeometry(0.02, 12)
    glass.rotateX(-0.5)
    glass.translate(sx * 0.034, HEADGEAR.bandY + 0.04, HEADGEAR.bandZ - HEADGEAR.rz - 0.0)
    gear.push(paint(glass, PALETTE.lunettes))
  }
  const knot = new THREE.SphereGeometry(HEADGEAR.knot, 12, 8)
  knot.translate(crown.x, crown.y, crown.z)
  gear.push(paint(knot, PALETTE.cheveux))
  const headgear = new THREE.Mesh(rigid(gear), mats.body)
  headgear.name = 'hero-headgear'
  headgear.castShadow = true
  bones.head.add(headgear)

  const tuftParts: THREE.BufferGeometry[] = []
  for (const [dx, len, r] of [[-0.012, HEADGEAR.tail * 0.8, 0.018], [0.012, HEADGEAR.tail * 0.75, 0.016], [0, HEADGEAR.tail, 0.022]] as const) {
    const c = new THREE.ConeGeometry(r, len, 7, 3)
    c.scale(1, 1, 0.7)
    c.rotateX(Math.PI)
    c.translate(dx, -len / 2, 0)
    tuftParts.push(paint(c, PALETTE.cheveux))
  }
  const tuft = new THREE.Mesh(rigid(tuftParts), mats.body)
  tuft.name = 'hero-tuft'
  tuft.position.copy(crown).add(new THREE.Vector3(0, 0, HEADGEAR.knot))
  tuft.castShadow = true
  bones.head.add(tuft)

  const scarfAnchor = new THREE.Object3D()
  scarfAnchor.position.set(0, 0.0, 0.09)
  bones.neck.add(scarfAnchor)
  const hairAnchor = new THREE.Object3D()
  hairAnchor.position.copy(crown)
  bones.head.add(hairAnchor)

  return { root, pivot, rig, mesh, meshes: rig.meshes, pose, bones, rest, scrubber, voile, poulie, eyes, tuft, hold, clip, scarfAnchor, hairAnchor, pivotHeight }
}

// Head socket frame: origin at the Head joint, +y up, -z towards the face.
const HEADGEAR = { crownY: 0.17, crownZ: 0.07, knot: 0.035, tail: 0.1, band: 0.011, rx: 0.098, rz: 0.112, bandY: 0.115, bandZ: 0.005, tilt: 0.25 } as const

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
