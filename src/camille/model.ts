import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const LOOK = {
  peau: 0xf0c6a8, taches: 0xc98e6b, joues: 0xeaa08e, yeux: 0x2a1f2b, levres: 0xb8695e, sourcils: 0x5a3626,
  cheveux: 0x6b4430, reflets: 0x9a6a45,
  manteau: 0x9a9893, manteauOmbre: 0x7c7a76, boutons: 0x2e2a28, pantalon: 0xb8a88f, mocassins: 0x1e1b1a,
  cuir: 0x1f1d1f, pull: 0xeee3cc, jean: 0x9fb8d2, or: 0xe2bd62, turquoise: 0x3fc1b8, nacre: 0xf2eee6, argent: 0xd8dde2,
  sacA: 0xefe3c4, sacB: 0x3f5f8a,
  gobelet: 0xe6f2f2, cafe: 0x8a5a3a, pailleA: 0x3f6fb5, pailleB: 0xf4f1e6,
  laiton: 0xd9b48f, bois: 0xb07a4f, lame: 0xcfd8d8, bocal: 0xbfe8dc, lucioles: 0x9ef0c8, feuille: 0x6fae5a,
} as const

export type Outfit = 'jour' | 'soir'

export type Joint =
  | 'hips' | 'chest' | 'head' | 'lockL' | 'lockR'
  | 'armL' | 'foreL' | 'armR' | 'foreR' | 'legL' | 'shinL' | 'legR' | 'shinR'

export interface CamilleModel {
  root: THREE.Group
  joints: Record<Joint, THREE.Object3D>
  glow: THREE.Sprite
  hipsY: number
  setOutfit(o: Outfit): void
  hold(item: 'gobelet' | 'feuille' | null): void
}

const tmp = new THREE.Color()

function paint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  ng.deleteAttribute('uv')
  tmp.setHex(hex)
  const n = ng.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmp.r
    c[i * 3 + 1] = tmp.g
    c[i * 3 + 2] = tmp.b
  }
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return ng
}

type Piece = [geo: THREE.BufferGeometry, color: number, at: [number, number, number], rot?: [number, number, number], scale?: [number, number, number]]

function part(pieces: Piece[], mat: THREE.Material): THREE.Mesh {
  const geos = pieces.map(([g, color, at, rot, scale]) => {
    if (scale) g.scale(...scale)
    if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)))
    g.translate(...at)
    return paint(g, color)
  })
  const merged = mergeGeometries(geos, false)
  if (!merged) throw new Error('camille geometry merge failed')
  merged.computeBoundingSphere()
  const m = new THREE.Mesh(merged, mat)
  m.castShadow = true
  return m
}

const cap = (r: number, len: number, seg = 8) => new THREE.CapsuleGeometry(r, len, 3, seg)
const ball = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h)
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z)
const ring = (r: number, t: number, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 4, 14, arc)

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// Faces -z like Ilo; the root sits on the floor. Each joint carries a shared mesh plus one per outfit.
export function buildCamille(mat: THREE.Material): CamilleModel {
  const root = new THREE.Group()
  root.name = 'camille'
  const j = (name: Joint, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D()
    o.name = `camille-${name}`
    o.position.set(x, y, z)
    parent.add(o)
    return o
  }
  const hipsY = 0.86
  const hips = j('hips', root, 0, hipsY, 0)
  const chest = j('chest', hips, 0, 0.16, 0)
  const head = j('head', chest, 0, 0.33, 0)
  const lockL = j('lockL', head, -0.1, 0.17, -0.06)
  const lockR = j('lockR', head, 0.1, 0.17, -0.06)
  const armL = j('armL', chest, -0.17, 0.24, 0)
  const foreL = j('foreL', armL, 0, -0.25, 0)
  const armR = j('armR', chest, 0.17, 0.24, 0)
  const foreR = j('foreR', armR, 0, -0.25, 0)
  const legL = j('legL', hips, -0.085, -0.04, 0)
  const shinL = j('shinL', legL, 0, -0.4, 0)
  const legR = j('legR', hips, 0.085, -0.04, 0)
  const shinR = j('shinR', legR, 0, -0.4, 0)

  const outfits: Record<Outfit, THREE.Object3D[]> = { jour: [], soir: [] }
  const add = (joint: THREE.Object3D, pieces: Piece[], o?: Outfit) => {
    const m = part(pieces, mat)
    joint.add(m)
    if (o) outfits[o].push(m)
    return m
  }

  // Head: long bob parted in the middle, freckles, half-lidded eyes, a dry little smile.
  const faceOpen = 1.0
  add(head, [
    [ball(0.13, 16, 12), LOOK.peau, [0, 0.11, 0], undefined, [0.94, 1.05, 1]],
    [new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI, 0, Math.PI * 0.55), LOOK.cheveux, [0, 0.135, 0.008], [0.3, 0, 0.06]],
    [new THREE.SphereGeometry(0.142, 14, 10, Math.PI, Math.PI, 0, Math.PI * 0.55), LOOK.cheveux, [0, 0.135, 0.008], [0.3, 0, -0.06]],
    [new THREE.CylinderGeometry(0.148, 0.172, 0.27, 18, 1, true, Math.PI + faceOpen, Math.PI * 2 - faceOpen * 2), LOOK.cheveux, [0, 0.04, 0.012]],
    [new THREE.CylinderGeometry(0.152, 0.176, 0.12, 18, 1, true, Math.PI + faceOpen + 0.3, Math.PI * 2 - faceOpen * 2 - 0.6), LOOK.reflets, [0, 0.12, 0.014]],
    [box(0.03, 0.06, 0.012), LOOK.reflets, [-0.06, 0.22, -0.115], [0.4, 0, 0.5]],
    [box(0.03, 0.06, 0.012), LOOK.reflets, [0.06, 0.22, -0.115], [0.4, 0, -0.5]],
    [ball(0.03, 8, 6), LOOK.peau, [-0.128, 0.1, 0.0], undefined, [0.5, 1, 0.8]],
    [ball(0.02, 6, 6), LOOK.yeux, [-0.045, 0.12, -0.121], undefined, [1.1, 0.75, 0.6]],
    [ball(0.02, 6, 6), LOOK.yeux, [0.045, 0.12, -0.121], undefined, [1.1, 0.75, 0.6]],
    [box(0.05, 0.016, 0.012), LOOK.peau, [-0.045, 0.131, -0.126], [0, 0, 0.05]],
    [box(0.05, 0.016, 0.012), LOOK.peau, [0.045, 0.131, -0.126], [0, 0, -0.05]],
    [box(0.045, 0.009, 0.01), LOOK.sourcils, [-0.045, 0.158, -0.124], [0, 0, -0.08]],
    [box(0.045, 0.009, 0.01), LOOK.sourcils, [0.045, 0.165, -0.124], [0, 0, 0.18]],
    [ball(0.016, 6, 6), LOOK.peau, [0, 0.095, -0.132]],
    [ring(0.017, 0.004, Math.PI * 0.8), LOOK.levres, [0.008, 0.068, -0.124], [0, 0, Math.PI * 1.15]],
    [ball(0.018, 6, 6), LOOK.joues, [-0.075, 0.085, -0.106], undefined, [1.2, 0.6, 0.4]],
    [ball(0.018, 6, 6), LOOK.joues, [0.075, 0.085, -0.106], undefined, [1.2, 0.6, 0.4]],
    ...([[-0.06, 0.098], [-0.08, 0.09], [-0.067, 0.083], [-0.018, 0.104], [0.018, 0.104], [0.06, 0.098], [0.08, 0.09], [0.068, 0.082]] as const)
      .map(([x, y]): Piece => [ball(0.0045, 4, 4), LOOK.taches, [x, y, -0.123 + Math.abs(x) * 0.25]]),
  ])
  add(lockL, [
    [box(0.025, 0.1, 0.02), LOOK.cheveux, [-0.02, -0.03, 0.03], [0.3, 0, 0.3]],
    [ring(0.025, 0.007, Math.PI), LOOK.cheveux, [-0.035, -0.08, 0.06], [0, Math.PI / 2, 0]],
  ])
  add(lockR, [
    [box(0.026, 0.19, 0.018), LOOK.cheveux, [0.005, -0.1, -0.005], [0.05, 0, 0.08]],
    [box(0.014, 0.17, 0.016), LOOK.reflets, [0.012, -0.11, -0.012], [0.05, 0, 0.1]],
  ])

  // Day: long heathered-grey hooded coat, toggles, wide taupe trousers.
  add(chest, [
    [cap(0.15, 0.16, 10), LOOK.manteau, [0, 0.12, 0], undefined, [1.08, 1, 0.82]],
    [ring(0.11, 0.05), LOOK.manteauOmbre, [0, 0.29, 0.05], [Math.PI / 2 + 0.5, 0, 0], [1.1, 1, 0.8]],
    [ball(0.1, 10, 8), LOOK.manteau, [0, 0.27, 0.12], undefined, [1.2, 0.9, 0.7]],
    [box(0.012, 0.32, 0.01), LOOK.manteauOmbre, [0.02, 0.1, -0.125]],
    ...[0.2, 0.08, -0.04].map((y): Piece => [ball(0.017, 6, 6), LOOK.boutons, [0.05, y, -0.128], undefined, [1, 1, 0.6]]),
    [box(0.025, 0.36, 0.015), LOOK.bois, [0, 0.12, -0.13], [0, 0, 0.75]],
    [cap(0.045, 0.05), LOOK.peau, [0, 0.31, 0]],
  ], 'jour')
  add(hips, [
    [new THREE.CylinderGeometry(0.19, 0.27, 0.66, 14, 1, true), LOOK.manteau, [0, -0.26, 0], undefined, [1, 1, 0.84]],
    [box(0.012, 0.64, 0.01), LOOK.manteauOmbre, [0.02, -0.26, -0.21], [-0.12, 0, 0]],
    ...[0.04, -0.12].map((y): Piece => [ball(0.017, 6, 6), LOOK.boutons, [0.05, y, -0.19 + y * 0.12], undefined, [1, 1, 0.6]]),
    [box(0.12, 0.14, 0.025), LOOK.manteauOmbre, [-0.15, -0.14, -0.17], [0.15, 0.4, 0]],
    [box(0.12, 0.14, 0.025), LOOK.manteauOmbre, [0.15, -0.14, -0.17], [0.15, -0.4, 0]],
    [cap(0.012, 0.11, 4), LOOK.bois, [0.17, -0.05, -0.18], [0, 0, 0.3]],
    [ring(0.05, 0.008, Math.PI * 0.9), LOOK.lame, [0.2, 0.03, -0.18], [0, 0, 1.1]],
    [cap(0.12, 0.06, 10), LOOK.pantalon, [0, 0.02, 0], undefined, [1.1, 1, 0.85]],
  ], 'jour')

  // Evening: black leather jacket over a cream knit, light jeans, gold necklaces, striped tote.
  add(chest, [
    [cap(0.142, 0.16, 10), LOOK.pull, [0, 0.12, 0], undefined, [1.05, 1, 0.8]],
    [ring(0.06, 0.022), LOOK.pull, [0, 0.29, 0], [Math.PI / 2, 0, 0]],
    [box(0.1, 0.34, 0.03), LOOK.cuir, [-0.1, 0.1, -0.1], [0, 0.35, 0]],
    [box(0.1, 0.34, 0.03), LOOK.cuir, [0.1, 0.1, -0.1], [0, -0.35, 0]],
    [box(0.32, 0.36, 0.05), LOOK.cuir, [0, 0.1, 0.09]],
    [box(0.07, 0.12, 0.02), LOOK.cuir, [-0.08, 0.25, -0.11], [0.3, 0.4, 0.5]],
    [box(0.07, 0.12, 0.02), LOOK.cuir, [0.08, 0.25, -0.11], [0.3, -0.4, -0.5]],
    [ring(0.065, 0.003, Math.PI), LOOK.or, [0, 0.27, -0.06], [-0.9, 0, Math.PI]],
    [ring(0.08, 0.003, Math.PI), LOOK.or, [0, 0.25, -0.07], [-1.0, 0, Math.PI]],
    [ring(0.095, 0.003, Math.PI), LOOK.or, [0, 0.23, -0.075], [-1.1, 0, Math.PI]],
    [ball(0.011, 6, 6), LOOK.turquoise, [0, 0.215, -0.118]],
    [ball(0.012, 6, 6), LOOK.cuir, [0, 0.19, -0.128], undefined, [0.8, 1.4, 0.8]],
    [new THREE.CylinderGeometry(0.016, 0.016, 0.005, 10), LOOK.nacre, [0, 0.165, -0.135], [Math.PI / 2, 0, 0]],
    [box(0.02, 0.4, 0.012), LOOK.sacB, [-0.06, 0.12, -0.02], [0.2, 0, -0.45]],
    [cap(0.045, 0.05), LOOK.peau, [0, 0.31, 0]],
  ], 'soir')
  const stripes: Piece[] = []
  for (let i = 0; i < 6; i++) stripes.push([box(0.24, 0.045, 0.07), i % 2 ? LOOK.sacB : LOOK.sacA, [-0.25, 0.02 - i * 0.045, 0.02], [0, 0, 0.1]])
  add(hips, [
    [cap(0.12, 0.08, 10), LOOK.jean, [0, 0.0, 0], undefined, [1.1, 1, 0.85]],
    [box(0.3, 0.06, 0.24), LOOK.cuir, [0, 0.11, 0]],
    ...stripes,
  ], 'soir')

  for (const [arm, fore, sx] of [[armL, foreL, -1], [armR, foreR, 1]] as const) {
    add(arm, [[ball(0.064, 10, 8), LOOK.manteau, [0, -0.01, 0], undefined, [1.1, 1, 1]], [cap(0.054, 0.16), LOOK.manteau, [0, -0.12, 0]]], 'jour')
    add(fore, [[cap(0.052, 0.13), LOOK.manteau, [0, -0.08, 0]], [ring(0.05, 0.016), LOOK.manteauOmbre, [0, -0.17, 0], [Math.PI / 2, 0, 0]]], 'jour')
    add(arm, [[ball(0.064, 10, 8), LOOK.cuir, [0, -0.01, 0], undefined, [1.1, 1, 1]], [cap(0.05, 0.16), LOOK.cuir, [0, -0.12, 0]]], 'soir')
    add(fore, [
      [cap(0.047, 0.13), LOOK.cuir, [0, -0.08, 0]],
      [ring(0.044, 0.014), LOOK.pull, [0, -0.17, 0], [Math.PI / 2, 0, 0]],
      [ring(0.012, 0.003), LOOK.argent, [-sx * 0.012, -0.29, -0.012], [0, Math.PI / 2, 0]],
      [ring(0.012, 0.003), LOOK.argent, [sx * 0.015, -0.295, -0.012], [0, Math.PI / 2, 0]],
    ], 'soir')
    add(fore, [[cap(0.036, 0.04), LOOK.peau, [0, -0.19, 0]], [box(0.065, 0.085, 0.032), LOOK.peau, [0, -0.25, 0], [0, 0, sx * 0.05]]])
  }
  for (const [leg, shin] of [[legL, shinL], [legR, shinR]] as const) {
    add(leg, [[cap(0.075, 0.28), LOOK.pantalon, [0, -0.19, 0]]], 'jour')
    add(shin, [[new THREE.CylinderGeometry(0.075, 0.1, 0.34, 10), LOOK.pantalon, [0, -0.17, 0]]], 'jour')
    add(leg, [[cap(0.064, 0.28), LOOK.jean, [0, -0.19, 0]]], 'soir')
    add(shin, [[cap(0.058, 0.24), LOOK.jean, [0, -0.17, 0]]], 'soir')
    add(shin, [[box(0.09, 0.05, 0.2), LOOK.mocassins, [0, -0.38, -0.045]], [box(0.085, 0.02, 0.06), LOOK.mocassins, [0, -0.355, -0.1]]])
  }

  const jar = new THREE.Object3D()
  jar.position.set(-0.24, -0.06, -0.02)
  hips.add(jar)
  outfits.jour.push(jar)
  jar.add(part([
    [new THREE.CylinderGeometry(0.05, 0.05, 0.11, 12), LOOK.bocal, [0, 0, 0]],
    [new THREE.CylinderGeometry(0.053, 0.053, 0.025, 12), LOOK.laiton, [0, 0.065, 0]],
    [ball(0.028, 8, 6), LOOK.lucioles, [0, -0.01, 0]],
  ], mat))
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: LOOK.lucioles, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }))
  glow.scale.setScalar(0.45)
  jar.add(glow)

  const gobelet = add(foreR, [
    [new THREE.CylinderGeometry(0.04, 0.032, 0.13, 12), LOOK.gobelet, [0, 0, 0]],
    [new THREE.CylinderGeometry(0.036, 0.03, 0.08, 12), LOOK.cafe, [0, -0.02, 0]],
    ...[0, 1, 2, 3, 4].map((i): Piece => [new THREE.CylinderGeometry(0.005, 0.005, 0.035, 5), i % 2 ? LOOK.pailleB : LOOK.pailleA, [0.012 + i * 0.002, 0.08 + i * 0.033, 0]]),
  ])
  gobelet.position.set(0, -0.27, -0.05)
  const feuille = add(foreL, [[ball(0.05, 8, 6), LOOK.feuille, [0, 0, 0], undefined, [0.7, 1.4, 0.15]]])
  feuille.position.set(0, -0.3, -0.05)
  feuille.rotation.x = -1.1

  const setOutfit = (o: Outfit) => {
    for (const m of outfits.jour) m.visible = o === 'jour'
    for (const m of outfits.soir) m.visible = o === 'soir'
  }
  const hold = (item: 'gobelet' | 'feuille' | null) => {
    gobelet.visible = item === 'gobelet'
    feuille.visible = item === 'feuille'
  }
  setOutfit('jour')
  hold(null)
  const joints = { hips, chest, head, lockL, lockR, armL, foreL, armR, foreR, legL, shinL, legR, shinR }
  return { root, joints, glow, hipsY, setOutfit, hold }
}
