import type { System } from '../core/types'

export function createRenderSystem(): System {
  return {
    id: 'render',
    init() {},
    update() {},
    dispose() {},
  }
}
