import type { WalkGraph } from '../types'

// Every port reaches every other port and every room, on the walk graph (docs/MONDE.md §3.2 step 11).
export function validateWalk(walk: WalkGraph): string[] {
  const adj = new Map<string, string[]>()
  for (const e of walk.edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), e.b])
    adj.set(e.b, [...(adj.get(e.b) ?? []), e.a])
  }
  const ports = walk.nodes.filter((n) => n.id.startsWith('p:'))
  const start = ports[0] ?? walk.nodes[0]
  if (!start) return ['empty walk graph']
  const seen = new Set([start.id])
  const stack = [start.id]
  while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n))
  const problems: string[] = []
  for (const n of walk.nodes) {
    if (seen.has(n.id)) continue
    if (n.id.startsWith('p:') || n.id.startsWith('h')) problems.push(`unreachable ${n.id}`)
  }
  const streets = walk.nodes.filter((n) => n.id.startsWith('s'))
  const lost = streets.filter((n) => !seen.has(n.id)).length
  if (lost > streets.length * 0.02) problems.push(`${lost}/${streets.length} street cells cut off`)
  return problems
}
