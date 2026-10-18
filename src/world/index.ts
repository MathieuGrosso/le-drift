import type { System } from '../core/types'

export function createWorldSystem(): System {
  return {
    id: 'world',
    init() {},
    update() {},
    dispose() {},
  }
}
