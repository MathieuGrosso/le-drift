import * as THREE from 'three'
import type { BuildContentFn, PopulateFn } from '../types'

// Owned by builder (c) (docs/MONDE.md §3.4). Scaffold signatures only.
export const populate: PopulateFn = (plan) => ({ district: plan.id, landmarks: [], points: [], chart: [], events: [], reserved: [] })

export const buildContent: BuildContentFn = function* (content) {
  const group = new THREE.Group()
  group.name = `contenu:${content.district}`
  return { group, stats: { draws: 0, triangles: 0, geometries: 0, buildMs: 0 }, dispose: () => group.removeFromParent() }
}
