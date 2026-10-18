import * as THREE from 'three'
import type { CelMaterialParams, ColliderKind, GameContext, Vec3 } from '../../core/types'
import type RAPIER from '@dimforge/rapier3d-compat'

export function celMat(ctx: GameContext, p: CelMaterialParams): THREE.Material {
  const r = ctx.services.render
  if (r) return r.cel(p)
  return new THREE.MeshLambertMaterial({
    color: p.color,
    emissive: new THREE.Color(p.emissive ?? 0x000000),
    transparent: !!p.transparent,
    side: p.side ?? THREE.FrontSide,
    vertexColors: !!p.vertexColors,
  })
}

export function glowMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  })
}

export interface StaticBody {
  body: RAPIER.RigidBody
  colliders: RAPIER.Collider[]
}

export function fixedBody(ctx: GameContext, at: Vec3): RAPIER.RigidBody {
  const R = ctx.physics.rapier
  return ctx.physics.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z))
}

export function terrainGroups(ctx: GameContext): number {
  return ((ctx.physics.groups.TERRAIN & 0xffff) << 16) | 0xffff
}

export function addCollider(
  ctx: GameContext,
  body: RAPIER.RigidBody,
  desc: RAPIER.ColliderDesc,
  kind: ColliderKind,
  climbable: boolean,
  ownerId: string,
): RAPIER.Collider {
  desc.setCollisionGroups(terrainGroups(ctx))
  const c = ctx.physics.world.createCollider(desc, body)
  ctx.physics.tag(c, { kind, climbable, ownerId })
  return c
}

export function removeBody(ctx: GameContext, b: StaticBody): void {
  for (const c of b.colliders) ctx.physics.untag(c)
  ctx.physics.world.removeRigidBody(b.body)
}

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s = new THREE.Vector3()
const p = new THREE.Vector3()
const e = new THREE.Euler()

export function setInstance(
  mesh: THREE.InstancedMesh,
  i: number,
  pos: Vec3,
  scale: { x: number; y: number; z: number } | number,
  rot?: { x?: number; y?: number; z?: number },
): void {
  p.set(pos.x, pos.y, pos.z)
  if (typeof scale === 'number') s.set(scale, scale, scale)
  else s.set(scale.x, scale.y, scale.z)
  e.set(rot?.x ?? 0, rot?.y ?? 0, rot?.z ?? 0)
  q.setFromEuler(e)
  m4.compose(p, q, s)
  mesh.setMatrixAt(i, m4)
}

export function disposeMesh(o: THREE.Object3D): void {
  o.removeFromParent()
  o.traverse((c) => {
    const m = c as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}
