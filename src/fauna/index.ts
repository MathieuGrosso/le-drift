import type { System } from '../core/types'

export function createFaunaSystem(): System {
  return {
    id: 'fauna',
    init() {},
    update() {},
    dispose() {},
  }
}
