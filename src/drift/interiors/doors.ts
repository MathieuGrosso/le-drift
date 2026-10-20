import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { GeoBuilder, UNIT } from '../builder'
import { PAL } from '../palette'
import { partById } from './layout'
import { HATCH_FRAME_DEPTH, wallFrame } from './shell'
import type { DoorDef } from './types'

export interface DoorRuntime {
  def: DoorDef
  open: boolean
  t: number
  duration: number
  leaf: THREE.Group
  wheel: THREE.Group
  baseRot: number
  openAngle: number
  hinge: THREE.Vector3
  axisU: 'x' | 'z'
  blocker: RAPIER.Collider | null
  openLeaf: RAPIER.Collider | null
  waiters: (() => void)[]
}

const leafCache = new Map<string, THREE.BufferGeometry>()
const wheelGeo = (() => {
  const b = new GeoBuilder()
  b.jitter = 0
  b.add(new THREE.TorusGeometry(0.17, 0.025, 6, 18), new THREE.Matrix4(), PAL.laiton)
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i / 3) * Math.PI), new THREE.Vector3(0.02, 0.34, 0.02))
    b.add(UNIT.box, m, PAL.laiton)
  }
  b.add(UNIT.cyl, new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.05, 0.12, 0.05)), PAL.metalSombre)
  return b.build()
})()

const disc = new THREE.CylinderGeometry(1, 1, 1, 40)
// The leaf hangs on the room-side face of the frame, so it swings clear of the brass plate.
const LEAF_SEAT = HATCH_FRAME_DEPTH / 2 + 0.05

function leafGeometry(kind: 'wall' | 'floor', w: number, h: number): THREE.BufferGeometry {
  const key = `${kind}:${w}:${h}`
  const hit = leafCache.get(key)
  if (hit) return hit
  const b = new GeoBuilder()
  b.jitter = 0
  if (kind === 'wall') {
    b.add(disc, new THREE.Matrix4().compose(new THREE.Vector3(w / 2, h / 2, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(w / 2 + 0.04, 0.07, h / 2 + 0.04)), PAL.teal)
    b.add(disc, new THREE.Matrix4().compose(new THREE.Vector3(w / 2, h / 2, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(w / 2 - 0.04, 0.09, h / 2 - 0.04)), PAL.metal)
    for (const y of [0.2, h - 0.2]) b.box(0.05, y, 0, 0.1, 0.14, 0.12, PAL.laiton)
    b.sphere(w / 2, h * 0.72, 0, 0.09, 0.09, 0.05, PAL.laiton)
  } else {
    b.add(UNIT.cyl, new THREE.Matrix4().compose(new THREE.Vector3(-w / 2, 0, 0), new THREE.Quaternion(), new THREE.Vector3(w / 2 + 0.02, 0.08, h / 2 + 0.02)), PAL.teal)
    b.add(UNIT.cyl, new THREE.Matrix4().compose(new THREE.Vector3(-w / 2, 0, 0), new THREE.Quaternion(), new THREE.Vector3(w / 2 - 0.06, 0.1, h / 2 - 0.06)), PAL.metal)
  }
  const g = b.build()
  leafCache.set(key, g)
  return g
}

export function createDoor(def: DoorDef, material: THREE.Material, parent: THREE.Object3D, open: boolean): DoorRuntime {
  const p = partById(def.part)
  const leaf = new THREE.Group()
  const wheel = new THREE.Group()
  const leafMesh = new THREE.Mesh(leafGeometry(def.kind, def.width, def.height), material)
  leaf.add(leafMesh)
  leaf.add(wheel)
  let baseRot = 0
  let openAngle = 0
  let axisU: 'x' | 'z' = 'x'
  const hinge = new THREE.Vector3()
  if (def.kind === 'wall' && def.side) {
    const f = wallFrame(p, def.side)
    axisU = f.axisU
    baseRot = f.axisU === 'x' ? 0 : -Math.PI / 2
    const u = def.at - def.width / 2
    hinge.copy(f.axisU === 'x' ? new THREE.Vector3(u, def.y, f.plane) : new THREE.Vector3(f.plane, def.y, u)).addScaledVector(f.inward, LEAF_SEAT)
    const angle = (100 * Math.PI) / 180
    const free = (a: number) => new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), baseRot + a)
    openAngle = free(angle).dot(f.inward) > 0 ? angle : -angle
    wheel.position.set(def.width / 2, def.height / 2, 0)
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(wheelGeo, material)
      m.position.z = s * 0.09
      wheel.add(m)
    }
  } else {
    hinge.set(def.plane, def.y, def.at)
    openAngle = (-88 * Math.PI) / 180
    wheel.position.set(-def.width / 2, 0.1, 0)
    const m = new THREE.Mesh(wheelGeo, material)
    m.rotation.x = -Math.PI / 2
    wheel.add(m)
  }
  leaf.position.copy(hinge)
  parent.add(leaf)
  const d: DoorRuntime = {
    def, open, t: open ? 1 : 0, duration: 1.5, leaf, wheel, baseRot, openAngle, hinge, axisU,
    blocker: null, openLeaf: null, waiters: [],
  }
  poseLeaf(d)
  return d
}

export function poseLeaf(d: DoorRuntime): void {
  const swing = THREE.MathUtils.smoothstep(d.t, 0.45, 1)
  const spin = Math.min(1, d.t / 0.45)
  if (d.def.kind === 'wall') {
    d.leaf.rotation.set(0, d.baseRot + d.openAngle * swing, 0)
    d.wheel.rotation.z = spin * Math.PI * 2
  } else {
    d.leaf.rotation.set(0, 0, d.openAngle * swing)
    d.wheel.rotation.y = spin * Math.PI * 2
  }
}

export function blockerShape(d: DoorRuntime): { x: number; y: number; z: number; hx: number; hy: number; hz: number; q?: THREE.Quaternion } {
  const def = d.def
  if (def.kind === 'floor') {
    return { x: d.hinge.x - def.width / 2, y: d.hinge.y, z: d.hinge.z, hx: def.width / 2, hy: 0.06, hz: def.height / 2 }
  }
  const c = d.hinge.clone()
  if (d.axisU === 'x') c.x += def.width / 2
  else c.z += def.width / 2
  c.y += def.height / 2
  return d.axisU === 'x'
    ? { x: c.x, y: c.y, z: c.z, hx: def.width / 2, hy: def.height / 2, hz: 0.06 }
    : { x: c.x, y: c.y, z: c.z, hx: 0.06, hy: def.height / 2, hz: def.width / 2 }
}

export function openLeafShape(d: DoorRuntime): { x: number; y: number; z: number; hx: number; hy: number; hz: number; q: THREE.Quaternion } | null {
  if (d.def.kind !== 'wall') return null
  const rot = d.baseRot + d.openAngle
  const dir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
  const c = d.hinge.clone().addScaledVector(dir, d.def.width / 2)
  c.y += d.def.height / 2
  return { x: c.x, y: c.y, z: c.z, hx: d.def.width / 2, hy: d.def.height / 2, hz: 0.05, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot) }
}

export function doorwayContains(d: DoorRuntime, p: THREE.Vector3, margin = 0.45): boolean {
  const s = blockerShape(d)
  return (
    Math.abs(p.x - s.x) < s.hx + margin &&
    p.y > s.y - s.hy - (d.def.kind === 'floor' ? 2.0 : 1.0) && p.y < s.y + s.hy + 0.5 &&
    Math.abs(p.z - s.z) < s.hz + margin
  )
}
