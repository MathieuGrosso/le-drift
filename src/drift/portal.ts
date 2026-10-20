import * as THREE from 'three'
import type { RoomId, Vec3 } from '../core/types'
import { toLocal, toWorld, type DriftPose } from './frame'
import { PARTS, partTop } from './interiors/layout'

export interface PortalSphere { p: Vec3; r: number }
interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

const MARGIN_NDC = 0.04
const MIN_PORTAL_DEPTH = 0.15
const OFF_AXIS = 1.3
const FULL_SCREEN_SHARE = 0.55
const MAX_PORTALS = 8

const ROOM_BOX = new Map<RoomId, Box>()
for (const p of PARTS) {
  const b = ROOM_BOX.get(p.room)
  const top = partTop(p)
  if (!b) ROOM_BOX.set(p.room, { x0: p.x0, x1: p.x1, y0: p.floorY, y1: top, z0: p.z0, z1: p.z1 })
  else {
    b.x0 = Math.min(b.x0, p.x0); b.x1 = Math.max(b.x1, p.x1)
    b.z0 = Math.min(b.z0, p.z0); b.z1 = Math.max(b.z1, p.z1)
    b.y0 = Math.min(b.y0, p.floorY); b.y1 = Math.max(b.y1, top)
  }
}

const _ndc = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _w = new THREE.Vector3()
const _sphere = new THREE.Sphere()
const _clip = new THREE.Matrix4()
const _vp = new THREE.Matrix4()
const _local: Vec3 = { x: 0, y: 0, z: 0 }
const _at: Vec3 = { x: 0, y: 0, z: 0 }

// From a closed room the outside is only seen through its glass: everything outside the room
// that the glass rectangle does not frame is skipped for the main camera's passes.
export class PortalCull {
  private readonly frusta = Array.from({ length: MAX_PORTALS }, () => new THREE.Frustum())
  private readonly view = new THREE.Frustum()
  private count = 0
  private readonly hidden: THREE.Object3D[] = []
  private room: Box | null = null
  private portals: readonly PortalSphere[] = []

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.Camera, private readonly keep: THREE.Object3D, private readonly pose: DriftPose) {
    scene.onBeforeRender = (_r, _s, cam) => {
      if (cam === this.camera && this.room && this.frame()) this.cull()
    }
    scene.onAfterRender = () => this.restore()
  }

  // `null` portals means the outside is seen whole (or not at all, which other culling handles).
  set(room: RoomId | null, portals: readonly PortalSphere[] | null): void {
    this.room = room && portals && portals.length > 0 ? ROOM_BOX.get(room) ?? null : null
    this.portals = portals ?? []
  }

  private frame(): boolean {
    const cam = this.camera as THREE.PerspectiveCamera
    if (!cam.isPerspectiveCamera) return false
    _vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    this.view.setFromProjectionMatrix(_vp)
    const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    let area = 0
    this.count = 0
    for (const g of this.portals) {
      toWorld(this.pose, g.p, _at)
      _w.set(_at.x, _at.y, _at.z)
      if (!this.view.intersectsSphere(_sphere.set(_w, g.r))) continue
      const depth = -_cam.copy(_w).applyMatrix4(cam.matrixWorldInverse).z
      if (depth < g.r + MIN_PORTAL_DEPTH) return false
      _ndc.copy(_w).project(cam)
      const ry = (g.r / ((depth - g.r) * tanY)) * OFF_AXIS + MARGIN_NDC
      const rx = ry / cam.aspect + MARGIN_NDC
      const x0 = Math.max(-1, _ndc.x - rx)
      const x1 = Math.min(1, _ndc.x + rx)
      const y0 = Math.max(-1, _ndc.y - ry)
      const y1 = Math.min(1, _ndc.y + ry)
      if (x0 >= x1 || y0 >= y1) continue
      area += ((x1 - x0) * (y1 - y0)) / 4
      if (area > FULL_SCREEN_SHARE || this.count === this.frusta.length) return false
      const sx = 2 / (x1 - x0)
      const sy = 2 / (y1 - y0)
      _clip.set(sx, 0, 0, -sx * (x0 + x1) / 2, 0, sy, 0, -sy * (y0 + y1) / 2, 0, 0, 1, 0, 0, 0, 0, 1)
      this.frusta[this.count++]!.setFromProjectionMatrix(_clip.multiply(_vp))
    }
    return true
  }

  private framed(s: THREE.Sphere): boolean {
    for (let i = 0; i < this.count; i++) if (this.frusta[i]!.intersectsSphere(s)) return true
    return false
  }

  private cull(): void {
    const visit = (o: THREE.Object3D): void => {
      if (!o.visible || o === this.keep) return
      const m = o as THREE.Mesh
      if ((m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) && o.frustumCulled && !(o as THREE.SkinnedMesh).isSkinnedMesh) {
        const geo = m.geometry
        if (!geo.boundingSphere) geo.computeBoundingSphere()
        const inst = o as THREE.InstancedMesh
        const bound = inst.isInstancedMesh ? (inst.boundingSphere ?? (inst.computeBoundingSphere(), inst.boundingSphere!)) : geo.boundingSphere!
        _sphere.copy(bound).applyMatrix4(o.matrixWorld)
        if (o.children.length === 0 && !this.framed(_sphere) && !this.inRoom(_sphere)) {
          o.visible = false
          this.hidden.push(o)
          return
        }
      }
      const ch = o.children
      for (let i = 0; i < ch.length; i++) visit(ch[i]!)
    }
    visit(this.scene)
  }

  private inRoom(s: THREE.Sphere): boolean {
    const b = this.room!
    _at.x = s.center.x
    _at.y = s.center.y
    _at.z = s.center.z
    toLocal(this.pose, _at, _local)
    const r = s.radius
    return _local.x + r >= b.x0 && _local.x - r <= b.x1 && _local.y + r >= b.y0 && _local.y - r <= b.y1 && _local.z + r >= b.z0 && _local.z - r <= b.z1
  }

  private restore(): void {
    for (const o of this.hidden) o.visible = true
    this.hidden.length = 0
  }

  dispose(): void {
    this.restore()
    this.scene.onBeforeRender = () => undefined
    this.scene.onAfterRender = () => undefined
  }
}
