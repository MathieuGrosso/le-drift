import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const LOOK = {
  robe: 0xe3a33b, robeOmbre: 0xc4852a, chemise: 0xf3e6c8, pantalon: 0x3c4a3a, bottes: 0x3f8f86,
  cheveux: 0xb5532e, ruban: 0x8fbf6a, peau: 0xe0a882, joues: 0xe88a7a, yeux: 0x2a1f2b,
  laiton: 0xd9b48f, bois: 0xb07a4f, lame: 0xcfd8d8, bocal: 0xbfe8dc, lucioles: 0x9ef0c8, feuille: 0x6fae5a,
} as const

export type Joint =
  | 'hips' | 'chest' | 'head' | 'braidL' | 'braidR'
  | 'armL' | 'foreL' | 'armR' | 'foreR' | 'legL' | 'shinL' | 'legR' | 'shinR'

export interface CamilleModel {
  root: THREE.Group
  joints: Record<Joint, THREE.Object3D>
  glow: THREE.Sprite
  jarLight: THREE.Object3D
  hipsY: number
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

// Faces -z like Ilo; the root sits on the floor.
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
  const braidL = j('braidL', head, -0.1, 0.08, 0.02)
  const braidR = j('braidR', head, 0.1, 0.08, 0.02)
  const armL = j('armL', chest, -0.17, 0.24, 0)
  const foreL = j('foreL', armL, 0, -0.25, 0)
  const armR = j('armR', chest, 0.17, 0.24, 0)
  const foreR = j('foreR', armR, 0, -0.25, 0)
  const legL = j('legL', hips, -0.085, -0.04, 0)
  const shinL = j('shinL', legL, 0, -0.4, 0)
  const legR = j('legR', hips, 0.085, -0.04, 0)
  const shinR = j('shinR', legR, 0, -0.4, 0)

  hips.add(part([
    [new THREE.CylinderGeometry(0.16, 0.27, 0.36, 14, 1, true), LOOK.robe, [0, -0.13, 0], undefined, [1, 1, 0.86]],
    [new THREE.TorusGeometry(0.265, 0.018, 4, 18), LOOK.robeOmbre, [0, -0.31, 0], [Math.PI / 2, 0, 0], [1, 0.86, 1]],
    [box(0.14, 0.12, 0.03), LOOK.robeOmbre, [0.1, -0.1, -0.2], [0.2, 0, 0]],
    [cap(0.012, 0.11, 4), LOOK.bois, [0.12, -0.02, -0.21], [0, 0, 0.3]],
    [new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI * 0.9), LOOK.lame, [0.15, 0.06, -0.21], [0, 0, 1.1]],
    [cap(0.12, 0.06, 10), LOOK.pantalon, [0, 0.02, 0], undefined, [1.1, 1, 0.85]],
  ], mat))

  chest.add(part([
    [cap(0.14, 0.16, 10), LOOK.chemise, [0, 0.12, 0], undefined, [1.05, 1, 0.78]],
    [box(0.2, 0.22, 0.03), LOOK.robe, [0, 0.08, -0.115]],
    [box(0.03, 0.2, 0.02), LOOK.robe, [-0.08, 0.24, -0.1], [0.1, 0, 0]],
    [box(0.03, 0.2, 0.02), LOOK.robe, [0.08, 0.24, -0.1], [0.1, 0, 0]],
    [box(0.025, 0.36, 0.015), LOOK.bois, [0, 0.12, -0.122], [0, 0, 0.75]],
    [cap(0.045, 0.05), LOOK.peau, [0, 0.31, 0]],
  ], mat))

  const jar = new THREE.Object3D()
  jar.position.set(-0.2, -0.04, 0.02)
  hips.add(jar)
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

  head.add(part([
    [ball(0.13, 16, 12), LOOK.peau, [0, 0.11, 0], undefined, [0.95, 1.04, 1]],
    [new THREE.SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), LOOK.cheveux, [0, 0.135, 0.01], [0.28, 0, 0], [1.02, 1, 1.05]],
    [box(0.2, 0.05, 0.05), LOOK.cheveux, [0, 0.2, -0.11], [0.35, 0, 0]],
    [ball(0.035, 8, 6), LOOK.cheveux, [-0.075, 0.185, -0.112]],
    [ball(0.022, 6, 6), LOOK.yeux, [-0.045, 0.12, -0.122], undefined, [1, 1.3, 0.6]],
    [ball(0.022, 6, 6), LOOK.yeux, [0.045, 0.12, -0.122], undefined, [1, 1.3, 0.6]],
    [ball(0.022, 6, 6), LOOK.joues, [-0.075, 0.085, -0.105], undefined, [1.2, 0.7, 0.5]],
    [ball(0.022, 6, 6), LOOK.joues, [0.075, 0.085, -0.105], undefined, [1.2, 0.7, 0.5]],
    [ball(0.015, 6, 6), LOOK.peau, [0, 0.095, -0.132]],
    [ball(0.04, 8, 6), LOOK.feuille, [0.1, 0.22, -0.04], [0, 0.4, 0.7], [1.6, 0.4, 0.8]],
  ], mat))

  for (const [b, sx] of [[braidL, -1], [braidR, 1]] as const) {
    const pieces: Piece[] = []
    for (let i = 0; i < 5; i++) pieces.push([ball(0.036 - i * 0.003, 8, 6), LOOK.cheveux, [sx * 0.012 * i, -0.06 - i * 0.055, -0.02 - i * 0.012]])
    pieces.push([new THREE.TorusGeometry(0.022, 0.009, 4, 10), LOOK.ruban, [sx * 0.06, -0.33, -0.08], [Math.PI / 2, 0, 0]])
    pieces.push([new THREE.ConeGeometry(0.03, 0.07, 6), LOOK.cheveux, [sx * 0.06, -0.38, -0.08], [Math.PI, 0, 0]])
    b.add(part(pieces, mat))
  }

  for (const [arm, fore, sx] of [[armL, foreL, -1], [armR, foreR, 1]] as const) {
    arm.add(part([
      [ball(0.062, 10, 8), LOOK.chemise, [0, -0.01, 0], undefined, [1.1, 1, 1]],
      [cap(0.048, 0.16), LOOK.chemise, [0, -0.12, 0]],
    ], mat))
    fore.add(part([
      [new THREE.TorusGeometry(0.048, 0.016, 4, 10), LOOK.chemise, [0, -0.01, 0], [Math.PI / 2, 0, 0]],
      [cap(0.04, 0.15), LOOK.peau, [0, -0.1, 0]],
      [box(0.07, 0.09, 0.035), LOOK.peau, [0, -0.25, 0], [0, 0, sx * 0.05]],
    ], mat))
  }
  for (const [leg, shin] of [[legL, shinL], [legR, shinR]] as const) {
    leg.add(part([[cap(0.068, 0.28), LOOK.pantalon, [0, -0.19, 0]]], mat))
    shin.add(part([
      [cap(0.064, 0.24), LOOK.bottes, [0, -0.18, 0]],
      [new THREE.CylinderGeometry(0.08, 0.072, 0.06, 10), LOOK.bottes, [0, -0.04, 0]],
      [box(0.1, 0.07, 0.21), LOOK.bottes, [0, -0.39, -0.045]],
    ], mat))
  }

  const joints = { hips, chest, head, braidL, braidR, armL, foreL, armR, foreR, legL, shinL, legR, shinR }
  return { root, joints, glow, jarLight: jar, hipsY }
}
