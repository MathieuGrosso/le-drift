import type { ProcgenHost, ProcgenWorld } from '../drift/procgen-hook'
import { planShip } from './ship'

// Owned by builder (a): the streamer (docs/MONDE.md §4.3). Scaffold: plans the ship, builds nothing yet.
export function createProcgen(host: ProcgenHost): ProcgenWorld {
  const plan = planShip()
  console.info(`[procgen] ${plan.districts.length} arrondissements, seed ${plan.seed.toString(16)} v${plan.version}, quality ${host.ctx.quality.level}`)
  return {
    update: () => {},
    cellAt: () => null,
    spawn: () => null,
    anchorsNear: () => [],
    glassVisible: () => 0,
    nav: () => null,
    dispose: () => {},
  }
}
