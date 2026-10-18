import { boot } from './core/engine'
import type { System } from './core/types'
import { createRenderSystem } from './render'
import { createWorldSystem } from './world'
import { createFloraSystem } from './flora'
import { createDriftSystem } from './drift'
import { createFaunaSystem } from './fauna'
import { createHeroSystem } from './hero'
import { createGameplaySystem } from './gameplay'
import { createAudioSystem } from './audio'

const systems: System[] = [
  createRenderSystem(), createWorldSystem(), createFloraSystem(), createDriftSystem(),
  createFaunaSystem(), createHeroSystem(), createGameplaySystem(), createAudioSystem(),
]

void boot({ systems })
