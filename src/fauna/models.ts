import * as THREE from 'three'
import { PALETTE, merge, paint, paintGradientY } from './shared'

function ellipsoid(sx: number, sy: number, sz: number, w = 10, h = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, w, h).scale(sx, sy, sz)
}

function finTriangle(a: [number, number, number], b: [number, number, number], c: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const v = [...a, ...b, ...c, ...a, ...c, ...b]
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

/** Fish, ~0.4 m, nose at +z. Vertex colours are a neutral ramp so instance colour tints the species. */
export function fishGeometry(): THREE.BufferGeometry {
  const body = paintGradientY(ellipsoid(0.065, 0.1, 0.2, 8, 6), 0xb8c4c8, 0xffffff, -0.08, 0.08)
  const tail = paint(finTriangle([0, 0, -0.16], [0, 0.1, -0.3], [0, -0.1, -0.3]), 0xd8e0e2)
  const dorsal = paint(finTriangle([0, 0.08, 0.04], [0, 0.15, -0.06], [0, 0.07, -0.1]), 0xc8d2d6)
  const eyeL = paint(ellipsoid(0.018, 0.018, 0.018, 5, 4).translate(0.05, 0.025, 0.12), 0x101820)
  const eyeR = paint(ellipsoid(0.018, 0.018, 0.018, 5, 4).translate(-0.05, 0.025, 0.12), 0x101820)
  return merge([body, tail, dorsal, eyeL, eyeR])
}

export function jellyBellGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 0.55
    pts.push(new THREE.Vector2(Math.sin(a) * 0.5 + 0.0001, Math.cos(a) * 0.42))
  }
  pts.push(new THREE.Vector2(0.44, 0.02))
  const bell = paintGradientY(new THREE.LatheGeometry(pts, 14), 0xf2ecff, PALETTE.bio2, 0.0, 0.4)
  const core = paint(ellipsoid(0.18, 0.12, 0.18, 8, 6).translate(0, 0.16, 0), PALETTE.corail1)
  return merge([bell, core])
}

export function jellyTentacleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const p = new THREE.PlaneGeometry(0.035, 1.8, 1, 10).translate(0, -0.9, 0)
    p.rotateY(a + Math.PI / 2).translate(Math.cos(a) * 0.38, 0.02, Math.sin(a) * 0.38)
    parts.push(paintGradientY(p, 0xe6dcff, PALETTE.bio1, -1.8, 0))
  }
  for (let i = 0; i < 4; i++) {
    const p = new THREE.PlaneGeometry(0.12, 1.1, 1, 8).translate(0, -0.55, 0)
    p.rotateY((i / 4) * Math.PI).translate(0, 0.05, 0)
    parts.push(paint(p, PALETTE.corail1))
  }
  return merge(parts)
}

/** Whale, 16 m, head at +z, body axis on z, belly at -y. */
export function whaleGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const r = Math.max(0.22, 2.2 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.75))
    pts.push(new THREE.Vector2(r, -8 + 16 * t))
  }
  pts.push(new THREE.Vector2(0.0001, 8.05))
  pts.unshift(new THREE.Vector2(0.0001, -8.05))
  const body = new THREE.LatheGeometry(pts, 18).rotateX(Math.PI / 2).scale(1, 0.82, 1)
  const bodyP = paintGradientY(body, 0x4f6d7a, 0xd4e6e0, -1.2, 0.6)

  const fluke = new THREE.Shape()
  fluke.moveTo(0, 0)
  fluke.quadraticCurveTo(1.6, -0.6, 3.4, -2.2)
  fluke.quadraticCurveTo(1.8, -1.2, 0, -1.4)
  fluke.quadraticCurveTo(-1.8, -1.2, -3.4, -2.2)
  fluke.quadraticCurveTo(-1.6, -0.6, 0, 0)
  const flukeG = new THREE.ExtrudeGeometry(fluke, { depth: 0.14, bevelEnabled: false })
    .rotateX(Math.PI / 2).translate(0, 0.07, -7.6)
  const flukeP = paint(flukeG, 0x48626e)

  const finL = paintGradientY(ellipsoid(1.9, 0.12, 0.6).rotateY(0.5).rotateZ(-0.35).translate(2.4, -1.0, 3.4), 0x4f6d7a, 0xd4e6e0, -1.2, -0.8)
  const finR = paintGradientY(ellipsoid(1.9, 0.12, 0.6).rotateY(-0.5).rotateZ(0.35).translate(-2.4, -1.0, 3.4), 0x4f6d7a, 0xd4e6e0, -1.2, -0.8)
  const dorsal = paint(ellipsoid(0.15, 0.45, 0.7).translate(0, 1.55, -3.2), 0x48626e)
  const eyeL = paint(ellipsoid(0.12, 0.1, 0.12, 6, 5).translate(1.55, -0.35, 5.4), 0x14202a)
  const eyeR = paint(ellipsoid(0.12, 0.1, 0.12, 6, 5).translate(-1.55, -0.35, 5.4), 0x14202a)
  const grooves: THREE.BufferGeometry[] = []
  for (let i = -3; i <= 3; i++) {
    grooves.push(paint(new THREE.BoxGeometry(0.05, 0.03, 4.2).translate(i * 0.32, -1.68, 5.0), 0xb9cfcb))
  }
  return merge([bodyP, flukeP, finL, finR, dorsal, eyeL, eyeR, ...grooves])
}

/** Manta, 5.2 m span on x, head at +z, top dark / belly pale. */
export function mantaGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 1.25)
  s.quadraticCurveTo(1.2, 1.0, 2.6, -0.15)
  s.quadraticCurveTo(2.0, -0.35, 0.6, -0.95)
  s.lineTo(-0.6, -0.95)
  s.quadraticCurveTo(-2.0, -0.35, -2.6, -0.15)
  s.quadraticCurveTo(-1.2, 1.0, 0, 1.25)
  const wings = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 10 })
    .rotateX(Math.PI / 2).translate(0, 0.06, 0)
  const wingsP = paintGradientY(subdivideX(wings), 0x24414f, 0xeef3ee, -0.05, 0.05)
  const body = paintGradientY(ellipsoid(0.65, 0.28, 1.1).translate(0, 0.02, 0.1), 0x2b4b5a, 0xeef3ee, -0.1, 0.12)
  const cephL = paint(new THREE.BoxGeometry(0.12, 0.05, 0.6).rotateY(-0.2).translate(0.42, 0, 1.35), 0x24414f)
  const cephR = paint(new THREE.BoxGeometry(0.12, 0.05, 0.6).rotateY(0.2).translate(-0.42, 0, 1.35), 0x24414f)
  const tail = paint(new THREE.CylinderGeometry(0.02, 0.06, 2.4, 5).rotateX(Math.PI / 2).translate(0, 0.02, -2.1), 0x2b4b5a)
  return merge([wingsP, body, cephL, cephR, tail])
}

function subdivideX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  // Extruded caps are big triangles; split them so the flap shader has vertices to bend along x.
  let geo = g.index ? g.toNonIndexed() : g
  for (let pass = 0; pass < 3; pass++) {
    const pos = geo.getAttribute('position')
    const out: number[] = []
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i)
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1)
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2)
      const ab = a.clone().lerp(b, 0.5), bc = b.clone().lerp(c, 0.5), ca = c.clone().lerp(a, 0.5)
      for (const [p, q, r] of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]] as const) {
        out.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z)
      }
    }
    geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  }
  geo.computeVertexNormals()
  return geo
}

/** Turtle, ~1.6 m, head at +z. Flippers are the vertices with |x| > 0.45. */
export function turtleGeometry(): THREE.BufferGeometry {
  const shell = paintGradientY(ellipsoid(0.6, 0.3, 0.75, 14, 8).translate(0, 0.05, 0), 0x6a7a3a, 0xc79a3b, -0.05, 0.3)
  const plastron = paint(ellipsoid(0.52, 0.1, 0.66).translate(0, -0.08, 0), 0xe6d29a)
  const scutes: THREE.BufferGeometry[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    scutes.push(paint(ellipsoid(0.16, 0.05, 0.16, 6, 4).translate(Math.sin(a) * 0.3, 0.3, Math.cos(a) * 0.36), 0x8a7a3a))
  }
  scutes.push(paint(ellipsoid(0.18, 0.06, 0.2, 6, 4).translate(0, 0.35, 0), 0x8a7a3a))
  const head = paint(ellipsoid(0.17, 0.15, 0.24).translate(0, 0.04, 0.88), 0x9aa36a)
  const eyeL = paint(ellipsoid(0.03, 0.03, 0.03, 5, 4).translate(0.12, 0.08, 0.98), 0x101418)
  const eyeR = paint(ellipsoid(0.03, 0.03, 0.03, 5, 4).translate(-0.12, 0.08, 0.98), 0x101418)
  const fl = paint(ellipsoid(0.55, 0.04, 0.17, 10, 4).rotateY(0.45).translate(0.85, -0.04, 0.38), 0x9aa36a)
  const fr = paint(ellipsoid(0.55, 0.04, 0.17, 10, 4).rotateY(-0.45).translate(-0.85, -0.04, 0.38), 0x9aa36a)
  const bl = paint(ellipsoid(0.22, 0.04, 0.12, 8, 4).rotateY(-0.7).translate(0.5, -0.06, -0.62), 0x9aa36a)
  const br = paint(ellipsoid(0.22, 0.04, 0.12, 8, 4).rotateY(0.7).translate(-0.5, -0.06, -0.62), 0x9aa36a)
  return merge([shell, plastron, ...scutes, head, eyeL, eyeR, fl, fr, bl, br])
}

export interface BirdModel {
  root: THREE.Group
  body: THREE.Group
  wings: { inner: THREE.Group; outer: THREE.Group; side: 1 | -1 }[]
  tail: THREE.Group
  neck: THREE.Group
  talon: THREE.Group
  heldFish: THREE.Mesh
  materials: THREE.Material[]
}

const PAGE_COLOURS = [PALETTE.blanc, 0xfbf8ee, PALETTE.blancOmbre, 0xece6d4, PALETTE.plafond]

/** Feathers stacked and fanned like the pages of a half-open book, lying along +x. */
function pages(length: number, chord: number, count: number, fan: number, taper: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1)
    const len = length * (1 - taper * t * 0.5)
    const p = new THREE.BoxGeometry(len, 0.035, chord * (1 - taper * t)).translate(len / 2, 0, -chord * 0.35)
    p.rotateY(-fan * t).translate(0, 0.045 * i - 0.02 * count, -0.04 * i)
    p.rotateX(0.025 * i)
    parts.push(paint(p, PAGE_COLOURS[i % PAGE_COLOURS.length]))
  }
  return merge(parts)
}

/** La Chose: white, wings far too wide (~18 m), one eye per side, layered like a book. Head at +z. */
export function buildBird(mk: (opts: { vertexColors: true; double: boolean }) => THREE.Material, fishMat: THREE.Material): BirdModel {
  const bodyMat = mk({ vertexColors: true, double: false })
  const wingMat = mk({ vertexColors: true, double: true })
  const root = new THREE.Group()
  root.name = 'la-chose'
  const body = new THREE.Group()
  root.add(body)

  const torso = paintGradientY(ellipsoid(0.95, 0.8, 1.9, 14, 10), PALETTE.blanc, PALETTE.blancOmbre, -0.6, 0.5)
  const breastPages: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    breastPages.push(paint(ellipsoid(0.8 - i * 0.06, 0.08, 0.5).rotateX(0.5).translate(0, -0.45 - i * 0.05, 1.1 - i * 0.35), PAGE_COLOURS[(i + 2) % 5]))
  }
  const legGeo = (x: number) => [
    paint(new THREE.CylinderGeometry(0.07, 0.09, 1.4, 6).rotateX(0.5).translate(x, -1.1, -0.6), 0x3e3a5a),
    ...[-0.35, 0, 0.35].map((a) => paint(new THREE.ConeGeometry(0.04, 0.45, 5).rotateX(Math.PI / 2 + 0.9).rotateY(a).translate(x, -1.75, -0.2), 0x3e3a5a)),
  ]
  body.add(new THREE.Mesh(merge([torso, ...breastPages, ...legGeo(0.35)]), bodyMat))

  const neck = new THREE.Group()
  neck.position.set(0, 0.35, 1.6)
  body.add(neck)
  const neckG = paint(new THREE.CylinderGeometry(0.32, 0.5, 1.4, 10).rotateX(Math.PI / 2 - 0.6).translate(0, 0.45, 0.5), PALETTE.blanc)
  const head = paintGradientY(ellipsoid(0.5, 0.45, 0.62, 12, 10).translate(0, 0.95, 1.3), PALETTE.blanc, PALETTE.blancOmbre, 0.6, 1.2)
  const beak = paint(new THREE.ConeGeometry(0.2, 1.6, 8).rotateX(Math.PI / 2).translate(0, 0.85, 2.55), 0xe9c77e)
  const eyeL = paint(ellipsoid(0.15, 0.15, 0.15, 10, 8).translate(0.43, 1.05, 1.5), 0x14162a)
  const eyeR = paint(ellipsoid(0.15, 0.15, 0.15, 10, 8).translate(-0.43, 1.05, 1.5), 0x14162a)
  const glintL = paint(ellipsoid(0.045, 0.045, 0.045, 6, 4).translate(0.55, 1.12, 1.56), 0xfff1c9)
  const glintR = paint(ellipsoid(0.045, 0.045, 0.045, 6, 4).translate(-0.55, 1.12, 1.56), 0xfff1c9)
  const crest = pages(0.9, 0.35, 5, 0.5, 0.4).rotateZ(Math.PI / 2).rotateX(-0.9).translate(0, 1.3, 0.9)
  neck.add(new THREE.Mesh(merge([neckG, head, beak, eyeL, eyeR, glintL, glintR, crest]), bodyMat))

  const talon = new THREE.Group()
  talon.position.set(-0.35, -1.55, -0.3)
  body.add(talon)
  const talonG = merge([
    paint(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 6).translate(0, 0.45, -0.15).rotateX(0.4), 0x3e3a5a),
    ...[-0.4, 0, 0.4].map((a) => paint(new THREE.ConeGeometry(0.04, 0.4, 5).rotateX(Math.PI / 2 + 1.1).rotateY(a).translate(0, -0.15, 0.1), 0x3e3a5a)),
  ])
  talon.add(new THREE.Mesh(talonG, bodyMat))
  const heldFish = new THREE.Mesh(fishGeometry().scale(2.2, 2.2, 2.2), fishMat)
  heldFish.rotation.set(0.6, 0.35, 0.3)
  heldFish.position.set(0, -0.2, 0.15)
  heldFish.visible = false
  talon.add(heldFish)

  const tail = new THREE.Group()
  tail.position.set(0, 0.1, -1.7)
  body.add(tail)
  const tailG = pages(2.2, 0.55, 7, 1.0, 0.3).rotateY(Math.PI / 2 + 0.5).translate(0, 0, 0)
  tail.add(new THREE.Mesh(tailG, wingMat))

  const wings: BirdModel['wings'] = []
  for (const side of [1, -1] as const) {
    const inner = new THREE.Group()
    inner.position.set(0.6 * side, 0.35, 0.4)
    const innerG = pages(4.2, 2.4, 8, 0.12, 0.25)
    const outerG = pages(4.8, 1.9, 10, 0.55, 0.55)
    if (side < 0) {
      innerG.scale(-1, 1, 1)
      outerG.scale(-1, 1, 1)
    }
    inner.add(new THREE.Mesh(innerG, wingMat))
    const outer = new THREE.Group()
    outer.position.set(4.0 * side, 0.08, -0.1)
    outer.add(new THREE.Mesh(outerG, wingMat))
    inner.add(outer)
    body.add(inner)
    wings.push({ inner, outer, side })
  }
  return { root, body, wings, tail, neck, talon, heldFish, materials: [bodyMat, wingMat] }
}
