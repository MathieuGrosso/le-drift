import type { BuildLayoutFn, DistrictShell, LayoutFn, MassingFn } from '../types'

// Owned by builder (a) (docs/MONDE.md §3.2). Scaffold signatures only.
export const massing: MassingFn = (plan) => ({ district: plan.id, hulls: [] })

export const layout: LayoutFn = function* (plan) {
  const shell: DistrictShell = {
    plan, hulls: [], cells: [], floors: [], colliders: [], links: [], windows: [], voids: [], waters: [],
    slots: [], lamps: [], walk: { nodes: [], edges: [] }, ports: [], anchors: [],
  }
  return shell
}

export const buildLayout: BuildLayoutFn = function* (shell) {
  throw new Error(`[procgen] buildLayout(${shell.plan.id}) is not built yet`)
}
