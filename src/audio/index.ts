import type { System } from '../core/types'

export function createAudioSystem(): System {
  return {
    id: 'audio',
    init() {},
    update() {},
    dispose() {},
  }
}
