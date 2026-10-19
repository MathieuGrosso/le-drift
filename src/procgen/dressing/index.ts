import * as THREE from 'three'
import type { DressFn } from '../types'

// Owned by builder (b) (docs/MONDE.md §3.3). Scaffold signatures only.
export const dress: DressFn = function* (input) {
  const group = new THREE.Group()
  group.name = `habillage:${input.shell.plan.id}`
  return { group, stats: { draws: 0, triangles: 0, geometries: 0, buildMs: 0 }, dispose: () => group.removeFromParent() }
}
