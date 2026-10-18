import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ColliderTag, GameContext, Vec3 } from '../core/types'

const UP = new THREE.Vector3(0, 1, 0)

export type ShapeSpec =
  | { shape: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw?: number }
  | { shape: 'cyl'; x: number; y: number; z: number; r: number; hh: number }
  | { shape: 'capsule'; x: number; y: number; z: number; r: number; hh: number }

// Everything flora grows inside (or on) the Drift lives in its local frame and follows its pose.
export class ShipFrame {
  readonly group = new THREE.Group()
  private body: RAPIER.RigidBody | null = null
  private readonly colliders: RAPIER.Collider[] = []
  private readonly q = new THREE.Quaternion()
  private readonly last = { x: Number.NaN, y: 0, z: 0 }
  private readonly tmp: Vec3 = { x: 0, y: 0, z: 0 }
  heading = 0

  constructor(private readonly ctx: GameContext) {
    this.group.name = 'flora-bord'
    this.group.matrixAutoUpdate = false
    ctx.scene.add(this.group)
  }

  sync(): boolean {
    const drift = this.ctx.services.drift
    if (!drift) return false
    const pose = drift.pose()
    this.heading = pose.heading
    this.group.position.set(pose.position.x, pose.position.y, pose.position.z)
    this.group.rotation.set(0, -pose.heading, 0)
    this.group.updateMatrix()
    this.group.updateMatrixWorld(true)
    if (this.body) {
      this.q.setFromAxisAngle(UP, -pose.heading)
      const jumped = !Number.isFinite(this.last.x) || Math.hypot(pose.position.x - this.last.x, pose.position.y - this.last.y, pose.position.z - this.last.z) > 2
      if (jumped) {
        this.body.setTranslation(pose.position, true)
        this.body.setRotation(this.q, true)
      } else {
        this.body.setNextKinematicTranslation(pose.position)
        this.body.setNextKinematicRotation(this.q)
      }
    }
    this.last.x = pose.position.x
    this.last.y = pose.position.y
    this.last.z = pose.position.z
    return true
  }

  toLocal(p: Vec3, out: Vec3 = this.tmp): Vec3 {
    const drift = this.ctx.services.drift
    if (!drift) {
      out.x = p.x
      out.y = p.y
      out.z = p.z
      return out
    }
    const l = drift.toLocal(p)
    out.x = l.x
    out.y = l.y
    out.z = l.z
    return out
  }

  toWorld(p: Vec3): Vec3 {
    return this.ctx.services.drift?.toWorld(p) ?? { ...p }
  }

  addCollider(spec: ShapeSpec, tag: ColliderTag): RAPIER.Collider {
    const { rapier, world, groups } = this.ctx.physics
    if (!this.body) {
      const pose = this.ctx.services.drift?.pose()
      const p = pose?.position ?? { x: 0, y: 0, z: 0 }
      this.q.setFromAxisAngle(UP, -(pose?.heading ?? 0))
      this.body = world.createRigidBody(
        rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z).setRotation({ x: this.q.x, y: this.q.y, z: this.q.z, w: this.q.w }),
      )
    }
    let desc: RAPIER.ColliderDesc
    if (spec.shape === 'box') {
      desc = rapier.ColliderDesc.cuboid(spec.hx, spec.hy, spec.hz)
      if (spec.yaw) {
        const q = new THREE.Quaternion().setFromAxisAngle(UP, spec.yaw)
        desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      }
    } else if (spec.shape === 'cyl') desc = rapier.ColliderDesc.cylinder(spec.hh, spec.r)
    else desc = rapier.ColliderDesc.capsule(spec.hh, spec.r)
    desc.setTranslation(spec.x, spec.y, spec.z).setCollisionGroups(((groups.TERRAIN & 0xffff) << 16) | 0xffff)
    const c = world.createCollider(desc, this.body)
    this.ctx.physics.tag(c, tag)
    this.colliders.push(c)
    return c
  }

  dispose(): void {
    const { world } = this.ctx.physics
    for (const c of this.colliders.splice(0)) this.ctx.physics.untag(c)
    if (this.body) world.removeRigidBody(this.body)
    this.body = null
    this.group.removeFromParent()
  }
}
