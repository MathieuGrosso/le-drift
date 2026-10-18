import * as THREE from 'three'
import type { Vec3 } from '../core/types'
import { DRAWINGS, REPLIES, type Drawing } from './draw'
import { LOOK } from './model'

type MatFn = (color: number) => THREE.Material

function glowSprite(color: number, size: number): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }))
  s.scale.setScalar(size)
  return s
}

export function jar(mat: MatFn, at: Vec3): { root: THREE.Group; glow: THREE.Sprite } {
  const root = new THREE.Group()
  root.position.set(at.x, at.y, at.z)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 14), mat(LOOK.bocal))
  body.position.y = 0.1
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 14), mat(LOOK.laiton))
  lid.position.y = 0.22
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: LOOK.lucioles, toneMapped: false }))
  core.position.y = 0.1
  const glow = glowSprite(LOOK.lucioles, 0.9)
  glow.position.y = 0.12
  root.add(body, lid, core, glow)
  return { root, glow }
}

export class Pousse {
  readonly root = new THREE.Group()
  private readonly stem = new THREE.Group()
  private readonly segs: THREE.Group[] = []
  private grow = 0
  private target = 0
  private t = 0

  constructor(mat: MatFn, at: Vec3) {
    this.root.position.set(at.x, at.y, at.z)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.4, 14), mat(0xb5532e))
    pot.position.y = 0.2
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 14), mat(0x4a3428))
    soil.position.y = 0.39
    this.root.add(pot, soil, this.stem)
    this.stem.position.y = 0.4
    const leaf = mat(LOOK.feuille)
    const blade = mat(0x9fcf6a)
    for (let i = 0; i < 12; i++) {
      const seg = new THREE.Group()
      seg.position.y = i * 0.5
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), leaf)
      stalk.position.y = 0.25
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), blade)
      l.scale.set(1.8, 0.25, 0.7)
      l.position.set((i % 2 ? 1 : -1) * 0.14, 0.35, 0)
      l.rotation.z = (i % 2 ? -1 : 1) * 0.5
      seg.add(stalk, l)
      this.stem.add(seg)
      this.segs.push(seg)
    }
    this.apply()
  }

  set(grown: boolean, instant = false): void {
    this.target = grown ? 1 : 0
    if (instant) this.grow = this.target
    this.apply()
  }

  update(dt: number): void {
    this.t += dt
    if (this.grow !== this.target) {
      this.grow = Math.min(this.target, this.grow + dt / 6)
      this.apply()
    }
    this.stem.rotation.z = Math.sin(this.t * 0.7) * (0.04 + 0.03 * this.grow)
    this.stem.rotation.x = 0.35 * (1 - this.grow) + Math.sin(this.t * 0.5) * 0.03
  }

  private apply(): void {
    const n = 1 + this.grow * (this.segs.length - 1)
    this.segs.forEach((g, i) => {
      g.visible = i < n
      g.scale.setScalar(THREE.MathUtils.clamp(n - i, 0.2, 1))
    })
  }
}

function paperTexture(d: Drawing, tint: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = tint
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = '#4a3a32'
  g.lineWidth = 2.5
  g.lineCap = 'round'
  for (const s of d.strokes) {
    g.beginPath()
    g.moveTo(s[0]! * 128, s[1]! * 128)
    for (let i = 2; i < s.length; i += 2) g.lineTo(s[i]! * 128, s[i + 1]! * 128)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function gift(mat: MatFn, id: 'feuille' | 'dessin' | 'ligne' | 'bocal', at: Vec3): THREE.Object3D {
  if (id === 'bocal') return jar(mat, at).root
  const g = new THREE.Group()
  g.position.set(at.x, at.y, at.z)
  g.rotation.y = -Math.PI / 2
  if (id === 'feuille') {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(LOOK.feuille))
    l.scale.set(0.8, 1.6, 0.08)
    l.rotation.z = 0.3
    g.add(l)
  } else {
    const d = id === 'dessin' ? DRAWINGS.chose : { strokes: [...REPLIES.deux.strokes, ...REPLIES['deux-lignes'].strokes] }
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: paperTexture(d, '#f3e6c8'), side: THREE.DoubleSide }))
    p.rotation.z = id === 'dessin' ? -0.06 : 0.05
    g.add(p)
  }
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), mat(0xd8644e))
  pin.position.set(0, 0.15, 0.01)
  g.add(pin)
  return g
}
