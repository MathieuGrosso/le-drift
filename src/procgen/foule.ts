import { Crowd } from '../drift/city/crowd'
import type { PathSpec } from '../drift/city/kit'
import type { Mats } from '../drift/procgen-hook'
import type { QualityLevel } from '../core/types'
import { mulberry32 } from '../core/rng'
import type { DistrictShell } from './types'

const FOULE = { maxPaths: { high: 40, medium: 26, low: 12 } as const, mainBusy: 1.3, sideBusy: 0.6, minLen: 4 }

// Residents of one arrondissement walking its street graph; recast steers them once the district's navmesh is baked.
export function districtCrowd(shell: DistrictShell, mats: Mats, quality: QualityLevel): Crowd {
  const at = new Map(shell.walk.nodes.map((n) => [n.id, n.at]))
  const rand = mulberry32(shell.plan.seed ^ 0x5f0e)
  const paths: PathSpec[] = []
  for (const e of shell.walk.edges) {
    if (e.kind !== 'sol' || e.length < FOULE.minLen) continue
    const a = at.get(e.a)
    const b = at.get(e.b)
    if (!a || !b || Math.abs(a.y - b.y) > 0.3) continue
    paths.push({ district: shell.plan.quartier, pts: [{ x: a.x, z: a.z }, { x: b.x, z: b.z }], y: a.y, loop: false, busy: e.main ? FOULE.mainBusy : FOULE.sideBusy, work: false })
  }
  for (let i = paths.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[paths[i], paths[j]] = [paths[j]!, paths[i]!]
  }
  return new Crowd(mats, paths.slice(0, FOULE.maxPaths[quality]), [], quality, (shell.plan.seed % 2147483646) + 1)
}
