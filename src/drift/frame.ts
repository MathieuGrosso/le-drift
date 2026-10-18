import * as THREE from 'three'
import type { Vec3 } from '../core/types'

export interface DriftPose {
  position: Vec3
  heading: number
  velocity: Vec3
}

export function toWorld(pose: DriftPose, p: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const c = Math.cos(pose.heading)
  const s = Math.sin(pose.heading)
  const x = p.x * c - p.z * s + pose.position.x
  const z = p.x * s + p.z * c + pose.position.z
  out.x = x
  out.y = p.y + pose.position.y
  out.z = z
  return out
}

export function toLocal(pose: DriftPose, p: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const c = Math.cos(pose.heading)
  const s = Math.sin(pose.heading)
  const dx = p.x - pose.position.x
  const dz = p.z - pose.position.z
  out.x = dx * c + dz * s
  out.y = p.y - pose.position.y
  out.z = -dx * s + dz * c
  return out
}

export function dirToWorld(pose: DriftPose, d: Vec3): Vec3 {
  const c = Math.cos(pose.heading)
  const s = Math.sin(pose.heading)
  return { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c }
}

// Local yaw is a compass bearing in the Drift frame; three's rotation.y is its negation.
export function yawToWorld(pose: DriftPose, localYaw: number): number {
  return localYaw + pose.heading
}

export function headingQuat(heading: number, out = new THREE.Quaternion()): THREE.Quaternion {
  return out.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading)
}
