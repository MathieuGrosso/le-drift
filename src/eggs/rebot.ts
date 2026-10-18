import * as THREE from 'three'
import type { Vec3 } from '../core/types'
import { glow, halo, mesh, type MatFn } from './mats'
import { canvas2d, type Canvas2D } from './paint'

type Face = 'yeux' | 'joie' | 'dort' | '404' | 'cligne'
type Pose = 'debout' | 'assis' | 'dort'

const WHITE = 0xf4f6fb
const BLUE = 0x7fb8f0
const MIDNIGHT = 0x1d2a5c
const VIOLET = 0x7b5cf0
const DANCE_S = 3.6
const SIT_AFTER_S = 25

export class Rebot {
  readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly mug: THREE.Object3D
  private readonly hat: THREE.Object3D
  private readonly bulb: THREE.Mesh
  private readonly face: Canvas2D
  private faceNow: Face | null = null
  private time = 0
  private dance = 0
  private hop = 0
  private away = SIT_AFTER_S
  private blinkIn = 3
  private glitch = 0
  private yaw = -Math.PI / 2
  wearsHat = false

  constructor(mat: MatFn, at: Vec3) {
    const white = mat({ color: WHITE, rim: 0.4, indoor: true })
    const blue = mat({ color: BLUE, indoor: true })
    const dark = mat({ color: MIDNIGHT, indoor: true })
    this.root.name = 'eggs-rebot'
    this.root.position.set(at.x, at.y, at.z)
    this.root.add(this.body)

    for (const s of [-1, 1]) this.body.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 10), dark, s * 0.09, 0.11, 0))
    const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.16, 6, 14), white, 0, 0.42, 0)
    torso.scale.set(1, 1, 0.85)
    this.body.add(torso)
    const belly = mesh(new THREE.CircleGeometry(0.075, 20), blue, 0, 0.42, 0.148)
    this.body.add(belly)

    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(s * 0.19, 0.52, 0)
      arm.add(mesh(new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), white, 0, -0.1, 0))
      arm.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), blue, 0, -0.21, 0))
      this.body.add(arm)
    }

    this.head.position.set(0, 0.78, 0)
    const skull = mesh(new THREE.SphereGeometry(0.2, 20, 16), white)
    skull.scale.set(1.15, 0.92, 1)
    this.head.add(skull)
    this.face = canvas2d(128, 96)
    const screen = mesh(new THREE.PlaneGeometry(0.3, 0.22), mat({ color: 0xffffff, map: this.face.texture, indoor: true }), 0, 0, 0.19)
    this.head.add(screen)
    this.head.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), dark, 0, 0.22, 0))
    this.bulb = mesh(new THREE.SphereGeometry(0.03, 10, 8), glow(VIOLET), 0, 0.29, 0)
    this.head.add(this.bulb)
    const h = halo(VIOLET, 0.22)
    h.position.set(0, 0.29, 0)
    this.head.add(h)
    for (const s of [-1, 1]) this.head.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), blue, s * 0.225, 0, 0))
    this.body.add(this.head)

    const mugGroup = new THREE.Group()
    mugGroup.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 12), mat({ color: 0xe8674a, indoor: true })))
    mugGroup.add(mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 12), mat({ color: 0xe8674a, indoor: true }), 0.045, 0, 0))
    mugGroup.position.set(0, -0.24, 0.04)
    this.armR.add(mugGroup)
    this.mug = mugGroup

    const hatGroup = new THREE.Group()
    hatGroup.add(mesh(new THREE.ConeGeometry(0.15, 0.24, 14), mat({ color: 0xd8423a, indoor: true }), 0, 0.12, 0))
    hatGroup.add(mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 18).rotateX(Math.PI / 2), mat({ color: 0xffffff, indoor: true })))
    hatGroup.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), mat({ color: 0xffffff, indoor: true }), 0.02, 0.25, 0))
    hatGroup.position.set(0, 0.15, 0)
    hatGroup.rotation.z = 0.25
    this.head.add(hatGroup)
    this.hat = hatGroup

    this.root.rotation.y = this.yaw
    this.drawFace('yeux')
  }

  danse(): void {
    this.dance = DANCE_S
  }

  sautille(): void {
    this.hop = 0.6
  }

  get pose(): Pose {
    return this.poseNow
  }

  private poseNow: Pose = 'debout'

  update(dt: number, heroLocal: Vec3 | null, hours: number, december: boolean): void {
    this.time += dt
    const night = hours >= 22 || hours < 6
    const dx = heroLocal ? heroLocal.x - this.root.position.x : 99
    const dz = heroLocal ? heroLocal.z - this.root.position.z : 99
    const near = Math.hypot(dx, dz) < 7
    this.away = near ? 0 : this.away + dt
    this.poseNow = night && this.dance <= 0 ? 'dort' : this.away > SIT_AFTER_S && this.dance <= 0 ? 'assis' : 'debout'

    if (near && this.poseNow !== 'dort') {
      const want = Math.atan2(dx, dz)
      let d = want - this.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += d * Math.min(1, dt * 3)
    }
    this.root.rotation.y = this.yaw
    this.mug.visible = hours >= 6 && hours < 11 && this.dance <= 0
    this.hat.visible = december || this.wearsHat

    const t = this.time
    let y = 0
    let tilt = 0
    let lean = 0
    let armL = 0.15
    let armR = this.mug.visible ? -1.1 : 0.15
    let headTilt = 0
    if (this.dance > 0) {
      this.dance -= dt
      const k = t * 7
      y = Math.abs(Math.sin(k)) * 0.08
      tilt = Math.sin(k) * 0.22
      armL = -2.4 + Math.sin(k) * 0.6
      armR = -2.4 - Math.sin(k) * 0.6
      headTilt = Math.sin(k * 0.5) * 0.25
    } else if (this.poseNow === 'assis') {
      y = -0.17
      lean = 0.12
      armL = armR = 0.5
    } else if (this.poseNow === 'dort') {
      y = -0.17
      lean = 0.3
      headTilt = 0.35
      armL = armR = 0.6
    } else {
      y = Math.sin(t * 2) * 0.01
      headTilt = Math.sin(t * 0.7) * 0.06
    }
    if (this.hop > 0) {
      this.hop -= dt
      y += Math.sin((1 - this.hop / 0.6) * Math.PI) * 0.18
    }
    this.body.position.y = y
    this.body.rotation.z = tilt
    this.body.rotation.x = lean
    this.head.rotation.z = headTilt
    this.armL.rotation.x = armL
    this.armR.rotation.x = armR
    this.armL.rotation.z = this.dance > 0 ? -0.4 : -0.1
    this.armR.rotation.z = this.dance > 0 ? 0.4 : 0.1

    const pulse = this.poseNow === 'dort' ? 0.25 + 0.15 * Math.sin(t * 1.2) : 0.8 + 0.2 * Math.sin(t * 3)
    ;(this.bulb.material as THREE.MeshBasicMaterial).color.setHex(VIOLET).multiplyScalar(pulse)

    this.blinkIn -= dt
    if (this.glitch > 0) this.glitch -= dt
    else if (Math.random() < dt / 240) this.glitch = 1.6
    let face: Face = 'yeux'
    if (this.poseNow === 'dort') face = 'dort'
    else if (this.dance > 0 || this.hop > 0) face = 'joie'
    else if (this.glitch > 0) face = '404'
    else if (this.blinkIn < 0) {
      face = 'cligne'
      if (this.blinkIn < -0.14) this.blinkIn = 2 + Math.random() * 4
    }
    this.drawFace(face)
  }

  private drawFace(face: Face): void {
    if (face === this.faceNow) return
    this.faceNow = face
    const { g, w, h, texture } = this.face
    g.fillStyle = '#1d2a5c'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
    g.strokeStyle = '#ffffff'
    g.lineWidth = 7
    g.lineCap = 'round'
    const ey = h * 0.48
    const ex = [w * 0.32, w * 0.68]
    if (face === 'yeux') {
      for (const x of ex) {
        g.beginPath()
        g.ellipse(x, ey, 9, 14, 0, 0, Math.PI * 2)
        g.fill()
      }
    } else if (face === 'joie') {
      for (const x of ex) {
        g.beginPath()
        g.arc(x, ey + 6, 11, Math.PI * 1.1, Math.PI * 1.9)
        g.stroke()
      }
    } else if (face === 'dort' || face === 'cligne') {
      for (const x of ex) {
        g.beginPath()
        g.moveTo(x - 11, ey)
        g.lineTo(x + 11, ey)
        g.stroke()
      }
      if (face === 'dort') {
        g.font = '700 18px ui-rounded, system-ui, sans-serif'
        g.fillText('z', w * 0.8, h * 0.22)
      }
    } else {
      g.font = '800 34px ui-monospace, monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#7fb8f0'
      g.fillText('404', w / 2, h / 2)
    }
    texture.needsUpdate = true
  }
}
