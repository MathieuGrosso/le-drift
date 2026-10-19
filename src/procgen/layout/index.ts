import type { DistrictPlan, DistrictShell, LayoutFn, MassingFn } from '../types'
import { planGrid } from './grid'
import { hullSpecs, shell, skeleton } from './plan'
import { STREAM } from './tuning'
import { validateWalk } from './validate'

export { buildLayout } from './build'

const variantSeed = (plan: DistrictPlan, v: number) => (plan.seed + v * 0x9e3779b1) >>> 0

export const massing: MassingFn = (plan) => ({ district: plan.id, hulls: hullSpecs(plan, planGrid(plan, plan.variant)) })

export function layoutSync(plan: DistrictPlan): DistrictShell {
  const job = layout(plan)
  for (;;) {
    const r = job.next()
    if (r.done) return r.value
  }
}

export const layout: LayoutFn = function* (plan) {
  for (let v = plan.variant; ; v++) {
    const g = planGrid(plan, v)
    yield
    const sk = skeleton(plan, g, variantSeed(plan, v))
    yield
    const s = shell(plan, sk)
    yield
    const walk = { nodes: s.nodes, edges: s.edges }
    const problems = validateWalk(walk)
    if (problems.length) console.warn(`[procgen] ${plan.id} v${v}: ${problems.slice(0, 4).join('; ')}`)
    if (!problems.length || v >= plan.variant + STREAM.variants) {
      return {
        plan: v === plan.variant ? plan : { ...plan, variant: v },
        hulls: s.hulls, cells: s.cells, floors: s.floors, colliders: s.colliders, links: s.links, windows: s.windows,
        voids: s.voids, waters: s.waters, slots: s.slots, lamps: s.lamps, walk, ports: s.ports, anchors: s.anchors,
      }
    }
  }
}
