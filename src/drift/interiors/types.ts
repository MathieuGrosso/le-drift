import type * as THREE from 'three'
import type { ColliderKind, RoomId, Vec3 } from '../../core/types'
import type { Side } from './layout'

export interface ColliderSpec {
  part: string
  kind: ColliderKind
  climbable: boolean
  ownerId?: string
  hx: number; hy: number; hz: number
  x: number; y: number; z: number
  q?: THREE.Quaternion
}

export interface LampDef {
  part: string
  x: number; y: number; z: number
  cord: number
  color: number
  radius: number
  airlock?: 'sas' | 'echelle-toit'
}

export interface PendulumDef { part: string; x: number; y: number; z: number; cord: number; scale: number }

export interface Spot { x: number; y: number; z: number; yaw: number }
export interface SeatDef extends Spot { id: string; part: string; lying?: boolean }

export interface LadderDef { id: string; rooms: RoomId[]; part: string; bottom: Vec3; top: Vec3; normal: Vec3 }

export interface DoorDef {
  id: string
  part: string
  kind: 'wall' | 'floor'
  side?: Side
  at: number
  width: number
  height: number
  y: number
  plane: number
  inward: number
}

export interface PaneDef {
  id: string
  part: string
  shape: 'round' | 'rect'
  x: number; y: number; z: number
  nx: number; nz: number
  w: number; h: number
}

export interface PartBuild {
  builder: import('../builder').GeoBuilder
  fade: import('../builder').GeoBuilder
  floorKind: 'bois' | 'metal' | 'tapis' | 'none'
}
