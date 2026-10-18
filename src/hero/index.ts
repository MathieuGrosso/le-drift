import type { System } from '../core/types'

export function createHeroSystem(): System {
  return {
    id: 'hero',
    init() {},
    update() {},
    dispose() {},
  }
}
