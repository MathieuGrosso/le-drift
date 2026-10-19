import * as THREE from 'three'
import { GeoBuilder, UNIT } from '../../drift/builder'
import { SURF } from '../../drift/surface'
import type { DressPalette, PropKind } from './plan'
import { DRESS } from './tuning'

// Every prop: metres, base on y = 0, centred on x/z, front toward +z.
type Make = (b: GeoBuilder, p: DressPalette) => void

const k = (hex: number, f: number) => new THREE.Color(hex).multiplyScalar(f)
const IRON = 0x52576a
const STEEL = 0x8a8f99
const BRASS = 0xd9b48f
const CREAM = 0xf1e4c8
const GLASS = 0x9fd6d0
const FISH = 0x9fb8c8
const UNIT_BOX = UNIT.box
const LIERRE = DRESS.ivyLength
const LAMINAIRE = DRESS.kelpHeight

const BLOB = new THREE.IcosahedronGeometry(1, 1)
const LEAF = new THREE.IcosahedronGeometry(1, 0)
const _bm = new THREE.Matrix4()
const _bq = new THREE.Quaternion()
const _bp = new THREE.Vector3()
const _bs = new THREE.Vector3()

function blob(b: GeoBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, c: THREE.ColorRepresentation, g = BLOB): void {
  b.add(g, _bm.compose(_bp.set(x, y, z), _bq.identity(), _bs.set(rx, ry, rz)), c)
}

// Prop LOD: facets by radius, a 5 cm jar never needs the 12 sides of a barrel.
const CYLS = [5, 7, 9, 12].map((n) => new THREE.CylinderGeometry(1, 1, 1, n))
const AXIS = { x: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), y: new THREE.Quaternion(), z: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) } as const

export function cyl(b: GeoBuilder, x: number, y: number, z: number, r: number, h: number, c: THREE.ColorRepresentation, axis: keyof typeof AXIS = 'y'): void {
  const g = CYLS[r < 0.08 ? 0 : r < 0.2 ? 1 : r < 0.4 ? 2 : 3]!
  b.add(g, _bm.compose(_bp.set(x, y, z), AXIS[axis], _bs.set(r, h, r)), c)
}

const BUOY = new THREE.TorusGeometry(0.32, 0.12, 5, 3, Math.PI / 2)

const leaf = (b: GeoBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, c: THREE.ColorRepresentation) => blob(b, x, y, z, rx, ry, rz, c, LEAF)

function legs(b: GeoBuilder, w: number, d: number, h: number, r: number, c: THREE.ColorRepresentation): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - r), h / 2, sz * (d / 2 - r), r * 2, h, r * 2, c)
}

function hoopBarrel(b: GeoBuilder, r: number, h: number, wood: number, hoop: number): void {
  b.with(SURF.planksZ, () => cyl(b, 0, h / 2, 0, r, h, wood))
  b.with(SURF.steel, () => {
    for (const y of [0.15, 0.5, 0.85]) cyl(b, 0, h * y, 0, r * 1.04, 0.05, hoop)
  })
}

const MAKERS: Record<PropKind, Make> = {
  caisse(b, p) {
    b.with(SURF.planksX, () => b.box(0, 0.3, 0, 0.6, 0.6, 0.6, p.bois))
    b.box(0, 0.3, 0, 0.62, 0.08, 0.62, p.boisOmbre)
    b.box(0, 0.05, 0, 0.62, 0.06, 0.62, p.boisOmbre)
  },
  tonneau(b, p) { hoopBarrel(b, 0.32, 0.86, p.bois, IRON) },
  sac(b, p) {
    b.with(SURF.fabric, () => {
      blob(b, 0, 0.26, 0, 0.27, 0.27, 0.22, 0xc9b48f)
      blob(b, 0, 0.52, 0, 0.12, 0.08, 0.1, 0xb39a72)
    })
  },
  panier(b, p) {
    b.with(SURF.fabric, () => cyl(b, 0, 0.15, 0, 0.26, 0.3, k(p.bois, 1.15)))
    cyl(b, 0, 0.31, 0, 0.27, 0.03, p.boisOmbre)
    b.box(0, 0.42, 0, 0.5, 0.03, 0.03, p.boisOmbre)
  },
  bocaux(b, p) {
    const tones = [GLASS, p.accent, 0xe3b95f, 0x8fb59a]
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.13
      const h = 0.16 + (i % 2) * 0.06
      cyl(b, x, h / 2, (i % 2) * 0.05, 0.05, h, k(tones[i]!, 0.9))
      cyl(b, x, h + 0.01, (i % 2) * 0.05, 0.052, 0.025, BRASS)
    }
  },
  seau(b) {
    b.with(SURF.steel, () => cyl(b, 0, 0.17, 0, 0.17, 0.34, STEEL))
    cyl(b, 0, 0.33, 0, 0.175, 0.02, IRON)
  },
  etagere(b, p) {
    b.with(SURF.planksX, () => {
      for (const x of [-0.58, 0.58]) b.box(x, 0.95, 0, 0.05, 1.9, 0.36, p.boisOmbre)
      for (const y of [0.1, 0.6, 1.1, 1.6]) b.box(0, y, 0, 1.2, 0.04, 0.36, p.bois)
    })
    for (const s of [0, 2]) {
      for (let i = 0; i < 4; i++) {
        const h = 0.14 + ((i * 7 + s * 3) % 4) * 0.04
        cyl(b, -0.4 + i * 0.26, 0.12 + s * 0.5 + h / 2, 0.02, 0.06, h, i % 3 === 0 ? k(p.accent, 0.85) : i % 3 === 1 ? 0xd9a861 : k(GLASS, 0.85))
      }
    }
    const tones = [p.accent, 0x5e4a5c, 0x6e8fb0, 0xc9a66b]
    let x = -0.52
    for (let i = 0; i < 8; i++) {
      const w = 0.07 + (i % 3) * 0.025
      const h = 0.24 + ((i * 3) % 4) * 0.035
      b.box(x + w / 2, 0.62 + h / 2, 0, w, h, 0.22, k(tones[i % tones.length]!, 0.8), i === 7 ? 0.25 : 0)
      x += w + 0.01
    }
  },
  table(b, p) {
    b.with(SURF.planksX, () => b.box(0, 0.74, 0, 1.4, 0.06, 0.8, p.bois))
    legs(b, 1.3, 0.7, 0.72, 0.04, p.boisOmbre)
    cyl(b, 0.3, 0.83, 0.1, 0.05, 0.12, CREAM)
    cyl(b, -0.35, 0.8, -0.15, 0.12, 0.05, k(p.metal, 0.9))
  },
  tabouret(b, p) {
    cyl(b, 0, 0.46, 0, 0.18, 0.05, p.bois)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      b.box(Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12, 0.04, 0.44, 0.04, p.boisOmbre)
    }
  },
  banc(b, p) {
    b.with(SURF.planksX, () => {
      b.box(0, 0.44, 0, 1.6, 0.06, 0.38, p.bois)
      b.box(0, 0.8, -0.17, 1.6, 0.32, 0.05, p.bois)
    })
    legs(b, 1.5, 0.36, 0.42, 0.04, p.boisOmbre)
  },
  comptoir(b, p) {
    b.with(SURF.planksX, () => b.box(0, 0.48, 0, 1.8, 0.96, 0.7, p.bois))
    b.box(0, 0.98, 0.02, 1.9, 0.05, 0.78, p.boisOmbre)
    b.box(0, 0.06, 0.37, 1.8, 0.1, 0.02, p.boisOmbre)
    for (const x of [-0.85, 0.85]) cyl(b, x, 1.75, -0.3, 0.03, 1.6, p.boisOmbre)
    b.box(0, 2.56, -0.3, 1.8, 0.04, 0.05, p.boisOmbre)
  },
  bobine(b, p) {
    cyl(b, 0, 0.5, 0, 0.5, 0.08, p.boisOmbre, 'z')
    b.with(SURF.fabric, () => cyl(b, 0, 0.5, 0.0, 0.34, 0.5, 0xc9a66b, 'z'))
    cyl(b, 0, 0.5, 0, 0.5, 0.08, p.boisOmbre, 'z')
    b.box(0, 0.5, 0.29, 0.06, 0.06, 0.04, p.boisOmbre)
  },
  rouleau(b) {
    b.with(SURF.fabric, () => {
      for (let i = 0; i < 4; i++) cyl(b, 0, 0.05 + i * 0.07, 0, 0.36 - i * 0.03, 0.07, i % 2 ? 0x8a6e4b : 0xa58660)
    })
  },
  bassin(b, p) {
    b.with(SURF.planksZ, () => cyl(b, 0, 0.28, 0, 0.6, 0.56, p.bois))
    cyl(b, 0, 0.55, 0, 0.55, 0.02, k(GLASS, 0.75))
    cyl(b, 0, 0.5, 0, 0.62, 0.05, IRON)
    b.with(SURF.planksX, () => b.box(0.3, 0.75, 0.0, 0.35, 0.55, 0.04, p.bois))
  },
  claie(b, p) {
    b.with(SURF.planksX, () => {
      for (const x of [-0.9, 0.9]) b.box(x, 0.9, 0, 0.06, 1.8, 0.06, p.boisOmbre)
      for (const y of [0.9, 1.75]) b.box(0, y, 0, 1.9, 0.05, 0.05, p.bois)
    })
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 8; i++) {
        const x = -0.78 + i * 0.22
        const y = (row === 0 ? 1.62 : 0.77) - 0.18
        b.box(x, y, 0, 0.11, 0.3, 0.025, k(FISH, 0.9 + ((i * 5 + row) % 3) * 0.08))
        b.box(x, y - 0.17, 0, 0.13, 0.06, 0.02, k(FISH, 0.75))
      }
    }
  },
  fourneau(b, p) {
    b.with(SURF.brass, () => b.box(0, 0.45, 0, 1.0, 0.9, 0.7, IRON))
    b.box(0, 0.92, 0, 1.05, 0.05, 0.75, k(IRON, 0.7))
    b.box(0, 0.4, 0.36, 0.4, 0.25, 0.02, 0xff9e5e)
    cyl(b, 0.3, 2.0, -0.2, 0.12, 2.1, k(p.metal, 0.9))
    b.with(SURF.brass, () => cyl(b, -0.2, 1.06, 0, 0.2, 0.26, p.metal))
  },
  enclume(b) {
    b.with(SURF.steel, () => {
      b.box(0, 0.35, 0, 0.3, 0.7, 0.3, k(IRON, 0.8))
      b.box(0, 0.78, 0, 0.7, 0.16, 0.24, IRON)
      b.box(0.42, 0.8, 0, 0.18, 0.1, 0.12, IRON)
    })
  },
  toles(b, p) {
    b.with(SURF.steel, () => {
      for (let i = 0; i < 3; i++) b.box(i * 0.05 - 0.05, 0.9, -i * 0.08, 1.4, 1.8, 0.03, k(i === 1 ? 0xc46a4a : p.metal, 0.75 + i * 0.1), 0.12 * (i - 1))
    })
  },
  lunette(b) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      b.box(Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22, 0.035, 1.25, 0.035, k(0x5e4a5c, 1))
    }
    b.with(SURF.brass, () => {
      cyl(b, 0, 1.3, 0.1, 0.08, 1.0, BRASS, 'z')
      cyl(b, 0, 1.3, 0.62, 0.11, 0.08, k(BRASS, 1.1), 'z')
    })
  },
  livres(b, p) {
    const tones = [p.accent, 0x5e4a5c, 0x6e8fb0, 0xc9a66b, 0x8fb59a]
    let x = -0.3
    for (let i = 0; i < 7; i++) {
      const w = 0.06 + (i % 3) * 0.02
      const h = 0.22 + ((i * 3) % 4) * 0.03
      b.box(x + w / 2, h / 2, 0, w, h, 0.18, k(tones[i % tones.length]!, 0.85))
      x += w + 0.005
    }
    b.box(0.05, 0.03, 0.22, 0.24, 0.05, 0.18, k(tones[2]!, 0.8))
  },
  horloge(b, p) {
    b.with(SURF.planksZ, () => b.box(0, 0.95, 0, 0.45, 1.9, 0.3, p.boisOmbre))
    cyl(b, 0, 1.55, 0.16, 0.17, 0.03, CREAM, 'z')
    cyl(b, 0, 0.8, 0.16, 0.06, 0.02, BRASS, 'z')
  },
  couchette(b, p) {
    b.with(SURF.planksX, () => {
      b.box(0, 0.35, 0, 1.95, 0.12, 0.85, p.bois)
      b.box(0, 1.45, 0, 1.95, 0.08, 0.85, p.bois)
      for (const x of [-0.97, 0.97]) b.box(x, 1.0, -0.4, 0.06, 2.0, 0.06, p.boisOmbre)
    })
    b.with(SURF.fabric, () => {
      b.box(0, 0.46, 0.02, 1.85, 0.12, 0.8, CREAM)
      b.box(-0.75, 0.56, 0, 0.3, 0.1, 0.55, 0xf4f1e6)
      b.box(0, 1.55, 0.02, 1.85, 0.1, 0.8, CREAM)
    })
  },
  berceau(b, p) {
    b.with(SURF.planksZ, () => b.box(0, 0.45, 0, 0.9, 0.4, 0.55, p.bois))
    for (const x of [-0.42, 0.42]) cyl(b, x, 0.2, 0, 0.3, 0.05, p.boisOmbre, 'x')
    b.with(SURF.fabric, () => b.box(0, 0.6, 0, 0.82, 0.08, 0.48, 0xf4f1e6))
  },
  cierges(b) {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4
      const r = 0.08 + (i % 3) * 0.08
      const h = 0.12 + ((i * 5) % 4) * 0.07
      cyl(b, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0.025, h, CREAM)
      leaf(b, Math.cos(a) * r, h + 0.03, Math.sin(a) * r, 0.015, 0.03, 0.015, k(0xffc27a, 1.7))
    }
    cyl(b, 0, 0.01, 0, 0.32, 0.02, BRASS)
  },
  vanne(b, p) {
    b.with(SURF.steel, () => cyl(b, 0, 0.6, 0, 0.12, 1.2, k(p.metal, 0.85)))
    cyl(b, 0, 1.2, 0.18, 0.04, 0.3, IRON, 'z')
    b.with(SURF.brass, () => {
      cyl(b, 0, 1.2, 0.34, 0.34, 0.04, 0xc46a4a, 'z')
      b.box(0, 1.2, 0.34, 0.66, 0.05, 0.03, k(0xc46a4a, 0.85))
      b.box(0, 1.2, 0.34, 0.05, 0.66, 0.03, k(0xc46a4a, 0.85))
    })
  },
  manometre(b) {
    cyl(b, 0, 0.75, 0, 0.03, 1.5, IRON)
    b.with(SURF.brass, () => cyl(b, 0, 1.55, 0.03, 0.17, 0.08, BRASS, 'z'))
    cyl(b, 0, 1.55, 0.08, 0.14, 0.01, CREAM, 'z')
    b.box(0.04, 1.58, 0.09, 0.1, 0.012, 0.005, 0xc46a4a)
  },
  tuyaux(b, p) {
    b.with(SURF.steel, () => {
      for (let i = 0; i < 3; i++) cyl(b, 0, 0.25 + i * 0.32, 0.1 * i, 0.09 + i * 0.02, 2.4, k(i === 1 ? 0xc98a5a : p.metal, 0.9), 'x')
    })
    for (const x of [-0.9, 0.9]) b.box(x, 0.5, 0.1, 0.06, 1.0, 0.36, IRON)
  },
  engrenage(b, p) {
    b.with(SURF.steel, () => {
      cyl(b, 0, 0.75, 0, 0.7, 0.14, k(p.metal, 0.8), 'z')
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        b.box(Math.cos(a) * 0.78, 0.75 + Math.sin(a) * 0.78, 0, 0.14, 0.14, 0.14, k(p.metal, 0.7))
      }
    })
    cyl(b, 0, 0.75, 0, 0.12, 0.3, BRASS, 'z')
  },
  jardiniere(b, p) {
    b.with(SURF.planksX, () => b.box(0, 0.25, 0, 1.4, 0.5, 0.5, p.bois))
    b.box(0, 0.5, 0, 1.36, 0.04, 0.46, 0x5e4a3a)
    for (let i = 0; i < 6; i++) {
      const x = -0.55 + i * 0.22
      leaf(b, x, 0.62, (i % 2) * 0.1 - 0.05, 0.13, 0.16 + (i % 3) * 0.04, 0.13, k(0x8fbf6a, 0.75 + (i % 3) * 0.12))
    }
  },
  arrosoir(b) {
    b.with(SURF.steel, () => cyl(b, 0, 0.16, 0, 0.13, 0.32, 0x8fb59a))
    cyl(b, 0.2, 0.27, 0, 0.025, 0.32, 0x7a9a84, 'x')
    b.box(-0.03, 0.4, 0, 0.18, 0.03, 0.03, 0x7a9a84)
  },
  chat(b, p) {
    const fur = p.accent === 0xd8644e ? 0xe3b95f : 0x6a5468
    blob(b, 0, 0.13, 0, 0.13, 0.12, 0.21, fur)
    blob(b, 0, 0.22, 0.2, 0.09, 0.08, 0.08, fur)
    for (const s of [-1, 1]) b.box(s * 0.05, 0.31, 0.2, 0.035, 0.06, 0.02, fur)
    b.box(0.1, 0.06, -0.17, 0.04, 0.04, 0.25, fur, 0.6)
  },
  jouets(b, p) {
    b.with(SURF.planksX, () => b.box(0, 0.1, 0, 0.2, 0.2, 0.2, p.accent))
    b.box(0.25, 0.07, 0.05, 0.14, 0.14, 0.14, 0x6e8fb0)
    blob(b, -0.2, 0.09, 0.15, 0.09, 0.09, 0.09, 0xe3b95f)
    blob(b, 0.05, 0.25, 0, 0.08, 0.05, 0.12, 0x9fb8c8)
  },
  bouee(b) {
    b.with(SURF.fabric, () => {
      for (let i = 0; i < 4; i++) {
        const q = _bq.setFromEuler(new THREE.Euler(Math.PI / 2, 0, (i * Math.PI) / 2))
        b.add(BUOY, _bm.compose(_bp.set(0, 0.12, 0), q, _bs.setScalar(1)), i % 2 ? 0xf4f1e6 : 0xe8674a)
      }
    })
  },
  marionnette(b, p) {
    b.box(0, 1.9, 0, 0.5, 0.03, 0.03, p.boisOmbre)
    b.box(0, 1.2, 0, 0.004, 1.3, 0.004, CREAM)
    b.with(SURF.fabric, () => b.box(0, 0.4, 0, 0.26, 0.4, 0.1, p.accent))
    blob(b, 0, 0.7, 0, 0.1, 0.11, 0.1, 0xe0b08c)
    b.box(0, 0.82, 0, 0.18, 0.06, 0.12, k(p.accent, 0.6))
  },
  epuisette(b, p) {
    b.box(0, 1.0, 0, 0.04, 2.0, 0.04, p.boisOmbre)
    b.with(SURF.fabric, () => blob(b, 0, 2.05, 0.12, 0.22, 0.12, 0.22, k(0xc9a66b, 0.8)))
  },
  fougere(b) {
    cyl(b, 0, 0.17, 0, 0.17, 0.34, 0xc46a4a)
    cyl(b, 0, 0.33, 0, 0.15, 0.02, 0x5e4a3a)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + i * 0.3
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * 0.18, 0.55, Math.sin(a) * 0.18),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9 + (i % 3) * 0.2, -a + Math.PI / 2, 0, 'YXZ')),
        new THREE.Vector3(0.14, 0.62, 0.02),
      )
      b.add(UNIT_BOX, m, k(0x6f9a5a, 0.8 + (i % 4) * 0.1))
    }
  },
  herbes(b) {
    cyl(b, 0, 0.11, 0, 0.12, 0.22, 0xc98a5a)
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1
      leaf(b, Math.cos(a) * 0.06, 0.3 + (i % 3) * 0.04, Math.sin(a) * 0.06, 0.07, 0.1, 0.07, k(0x8fbf6a, 0.75 + (i % 3) * 0.12))
    }
  },
  lierre(b) {
    for (let s = 0; s < 4; s++) {
      const x = (s - 1.5) * 0.08
      const z = ((s * 7) % 3) * 0.04 - 0.04
      const len = 0.9 + ((s * 5) % 4) * 0.2
      b.box(x, LIERRE - len / 2, z, 0.012, len, 0.012, 0x5e6a4a)
      for (let i = 0; i < 7; i++) leaf(b, x + ((i % 2) - 0.5) * 0.05, LIERRE - (i + 0.5) * (len / 7), z, 0.045, 0.03, 0.04, k(0x7aa860, 0.7 + ((i + s) % 3) * 0.15))
    }
  },
  laminaire(b) {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1
      for (let j = 0; j < 6; j++) {
        const t = j / 6
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * 0.08 + Math.sin(t * 5 + a) * 0.1, (t + 1 / 12) * LAMINAIRE, Math.sin(a) * 0.08),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + t * 0.8, Math.sin(t * 6 + a) * 0.12)),
          new THREE.Vector3(0.12 + Math.sin(t * Math.PI) * 0.08, LAMINAIRE / 6 + 0.04, 0.01),
        )
        b.add(UNIT_BOX, m, k(0xc79a3b, 0.7 + t * 0.4))
      }
    }
  },
}

export function buildProp(kind: PropKind, pal: DressPalette): THREE.BufferGeometry {
  const b = new GeoBuilder()
  b.jitter = 0.04
  MAKERS[kind](b, pal)
  return b.build()
}
