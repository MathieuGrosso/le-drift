import type { System } from '../core/types'

export function createGameplaySystem(): System {
  return {
    id: 'gameplay',
    init() {},
    update() {},
    dispose() {},
  }
}
