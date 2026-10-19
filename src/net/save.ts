import { NET } from '../core/tuning'
import type { GameContext, GameState } from '../core/types'
import { LIMITS, type ClientMessages, type PlayerSave } from '../shared/protocol'

export function toPlayerSave(s: GameState): PlayerSave {
  const local = s.hero.localPosition
  return {
    version: 2, act: s.act, quests: s.quests, flags: s.flags, chart: s.chart, inventory: s.inventory,
    shallows: s.shallows, trouvailles: s.trouvailles,
    hero: { localPosition: local ? { x: local.x, y: local.y, z: local.z } : null, yaw: s.hero.yaw, district: s.hero.district, room: s.hero.room },
  }
}

/** The server copy wins on join: it is the same player, possibly last seen on another device. */
export function applyPlayerSave(ctx: GameContext, save: PlayerSave): void {
  const s = ctx.state
  Object.assign(s, {
    quests: save.quests, flags: save.flags, chart: save.chart, inventory: save.inventory,
    shallows: save.shallows, trouvailles: save.trouvailles,
  })
  if (save.act !== s.act) ctx.services.gameplay?.setAct(save.act)
  if (save.hero.localPosition && s.mode === 'inside') ctx.services.hero?.teleportLocal(save.hero.localPosition, save.hero.yaw)
}

/** Mirrors each local save to the server, debounced; localStorage keeps its own copy. */
export class RemoteSave {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly encoder = new TextEncoder()

  constructor(private readonly state: GameState, private readonly send: (m: ClientMessages['save']) => void) {}

  schedule(): void {
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), NET.saveDebounceMs)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const save = toPlayerSave(this.state)
    if (this.encoder.encode(JSON.stringify(save)).length > LIMITS.saveBytesMax) {
      console.warn('[net] sauvegarde trop lourde pour le serveur, gardée en local seulement')
      return
    }
    this.send({ save })
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
