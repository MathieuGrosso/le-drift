import * as THREE from 'three'
import type { GameContext } from '../core/types'

const POOL = 6
const LIFE = 42

function pageTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 192
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#fbf6e6'
  g.beginPath()
  g.moveTo(48, 4)
  g.bezierCurveTo(92, 40, 90, 150, 50, 188)
  g.lineTo(46, 188)
  g.bezierCurveTo(6, 150, 4, 40, 48, 4)
  g.fill()
  g.save()
  g.clip()
  g.fillStyle = 'rgba(220, 208, 180, 0.55)'
  for (let y = 14; y < 188; y += 7) g.fillRect(0, y, 96, 1)
  g.fillStyle = 'rgba(80, 74, 96, 0.5)'
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let y = 12; y < 182; y += 7) {
    let x = 12 + rnd() * 6
    while (x < 84) {
      const w = 3 + rnd() * 9
      g.fillRect(x, y - 1.5, w, 1.4)
      x += w + 2 + rnd() * 3
    }
  }
  g.restore()
  g.strokeStyle = 'rgba(150, 140, 120, 0.8)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(48, 6)
  g.quadraticCurveTo(46, 100, 48, 190)
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Pages La Chose sheds: a feather written on like a page, falling like a leaf past the glass. */
export class Pages {
  readonly group = new THREE.Group()
  private readonly meshes: THREE.Mesh[] = []
  private readonly age = new Float32Array(POOL).fill(-1)
  private readonly seed = new Float32Array(POOL)
  private readonly origin: THREE.Vector3[] = []
  private readonly mat: THREE.MeshBasicMaterial
  private readonly mats: THREE.MeshBasicMaterial[] = []
  private next = 0

  constructor(ctx: GameContext) {
    const map = pageTexture()
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xf6f1e2, map, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: true,
    })
    const geo = new THREE.PlaneGeometry(0.42, 0.84, 4, 1)
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.pow(pos.getX(i) / 0.21, 2) * 0.05)
    geo.computeVertexNormals()
    for (let i = 0; i < POOL; i++) {
      const m = this.mat.clone()
      ctx.services.render?.patchWater(m)
      this.mats.push(m)
      const mesh = new THREE.Mesh(geo, m)
      mesh.visible = false
      mesh.name = 'fauna-page'
      this.meshes.push(mesh)
      this.origin.push(new THREE.Vector3())
      this.group.add(mesh)
    }
  }

  drop(x: number, y: number, z: number): void {
    const i = this.next
    this.next = (this.next + 1) % POOL
    this.age[i] = 0
    this.seed[i] = Math.random() * 100
    this.origin[i]!.set(x, y, z)
    this.meshes[i]!.visible = true
  }

  update(dt: number, floorY: (x: number, z: number) => number): void {
    for (let i = 0; i < POOL; i++) {
      if (this.age[i]! < 0) continue
      const a = (this.age[i] = this.age[i]! + dt)
      const m = this.meshes[i]!
      const o = this.origin[i]!
      const s = this.seed[i]!
      const swing = Math.sin(a * 1.15 + s)
      const x = o.x + swing * 0.9 + Math.sin(a * 0.21 + s) * 2
      const z = o.z + Math.cos(a * 0.17 + s * 1.3) * 1.6
      const y = o.y - a * 0.32 - Math.abs(swing) * 0.25
      m.position.set(x, y, z)
      m.rotation.set(Math.PI / 2 - 0.4 + Math.cos(a * 1.15 + s) * 0.55, a * 0.3 + s, swing * 0.6)
      const fade = Math.min(1, a * 2) * Math.min(1, (LIFE - a) / 5)
      this.mats[i]!.opacity = fade
      m.scale.setScalar(1.25)
      if (a > LIFE || y < floorY(x, z) + 0.4) {
        this.age[i] = -1
        m.visible = false
      }
    }
  }

  dispose(): void {
    this.group.removeFromParent()
    this.meshes[0]?.geometry.dispose()
    this.mat.map?.dispose()
    this.mat.dispose()
    for (const m of this.mats) m.dispose()
  }
}

function shadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const W = 256, H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return null
  const src = document.createElement('canvas')
  src.width = W
  src.height = H
  const s = src.getContext('2d')
  if (!s) return null
  s.fillStyle = '#fff'
  s.beginPath()
  s.ellipse(W / 2, H * 0.5, 9, 26, 0, 0, Math.PI * 2)
  s.fill()
  s.beginPath()
  s.ellipse(W / 2, H * 0.22, 6, 9, 0, 0, Math.PI * 2)
  s.fill()
  for (const side of [1, -1]) {
    s.beginPath()
    s.moveTo(W / 2, H * 0.4)
    s.quadraticCurveTo(W / 2 + side * 60, H * 0.3, W / 2 + side * 124, H * 0.44)
    for (let k = 0; k < 9; k++) {
      const x = W / 2 + side * (124 - k * 11)
      s.lineTo(x - side * 4, H * 0.56 + (k % 2) * 4)
      s.lineTo(x - side * 9, H * 0.5)
    }
    s.quadraticCurveTo(W / 2 + side * 20, H * 0.6, W / 2, H * 0.58)
    s.fill()
  }
  s.beginPath()
  s.moveTo(W / 2, H * 0.7)
  s.lineTo(W / 2 + 22, H * 0.96)
  s.lineTo(W / 2 - 22, H * 0.96)
  s.fill()
  g.filter = 'blur(4px)'
  g.drawImage(src, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  return tex
}

/** The bird's shadow on the underside of the ceiling: the only warning before a dive. */
export class CeilingShadow {
  readonly mesh: THREE.Mesh
  private readonly mat: THREE.MeshBasicMaterial

  constructor(ctx: GameContext) {
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x1d4a5c, alphaMap: shadowTexture(), transparent: true, opacity: 0, depthWrite: false,
    })
    ctx.services.render?.patchWater(this.mat)
    const geo = new THREE.PlaneGeometry(20, 10).rotateX(Math.PI / 2)
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.mesh.name = 'fauna-ombre-chose'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 4
    this.mesh.visible = false
  }

  /** `height` above the ceiling sets size and softness; `span` is how open the wings are (0..1). */
  set(x: number, ceilY: number, z: number, heading: number, height: number, span: number, strength: number): void {
    if (strength <= 0.01 || height < 0) {
      this.mesh.visible = false
      return
    }
    const grow = 1 + height / 30
    this.mesh.visible = true
    this.mesh.position.set(x, ceilY - 0.35, z)
    this.mesh.rotation.set(0, heading, 0)
    this.mesh.scale.set(grow * (0.3 + 0.7 * span), 1, grow)
    this.mat.opacity = strength * 0.55 / (grow * grow)
  }

  hide(): void {
    this.mesh.visible = false
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mat.alphaMap?.dispose()
    this.mat.dispose()
  }
}
