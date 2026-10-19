import { layoutSync } from '../layout'
import { planShip } from '../ship'
import type { ArrondissementId, ChartEntry, ContentPoint, ContentSet } from '../types'
import { populate } from './populate'

// Ship-wide content without building anything (~0.2 s for 27 districts): for gameplay's chart and
// quest log, and for the server to know every trouvaille and quest anchor. Same seed, same answer.
const cache = new Map<ArrondissementId, ContentSet>()

export function districtContent(id: ArrondissementId): ContentSet | null {
  const hit = cache.get(id)
  if (hit) return hit
  const plan = planShip().districts.find((d) => d.id === id)
  if (!plan) return null
  const shell = layoutSync(plan)
  const set = populate(shell.plan, shell)
  cache.set(id, set)
  return set
}

export function shipContent(): ContentSet[] {
  return planShip().districts.map((d) => districtContent(d.id)!)
}

export function shipChart(): ChartEntry[] {
  return shipContent().flatMap((c) => c.chart)
}

export function shipPoints(kind: ContentPoint['kind']): ContentPoint[] {
  return shipContent().flatMap((c) => c.points.filter((p) => p.kind === kind))
}
