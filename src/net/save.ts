import { resetToNewGame } from '../core/save'
import { NET } from '../core/tuning'
import type { GameContext, GameState } from '../core/types'
import { LIMITS, type ClientMessages, type PlayerSave, type ServerMessages } from '../shared/protocol'

export function toPlayerSave(s: GameState): PlayerSave {
  const local = s.hero.localPosition
  return {
    version: 2, act: s.act, quests: s.quests, flags: s.flags, chart: s.chart, inventory: s.inventory,
    shallows: s.shallows, trouvailles: s.trouvailles,
    hero: { localPosition: local ? { x: local.x, y: local.y, z: local.z } : null, yaw: s.hero.yaw, district: s.hero.district, room: s.hero.room },
  }
}

/** Where the hero goes once the title screen is gone: the server's spot, or the cabin for a new player. */
export type Placement = PlayerSave['hero'] | 'cabine'

/** The server copy wins on join: it is the same player, possibly last seen on another device. */
export function applyPlayerSave(ctx: GameContext, save: PlayerSave): void {
  const s = ctx.state
  Object.assign(s, {
    quests: save.quests, flags: save.flags, chart: save.chart, inventory: save.inventory,
    shallows: save.shallows, trouvailles: save.trouvailles,
  })
  if (save.act !== s.act) ctx.services.gameplay?.setAct(save.act)
}

/**
 * Returning player: the server copy. One the server has never seen starts a new game, whatever this tab
 * played solo. Returns where to put the hero, for the caller to apply once the title screen (which restores
 * its own copy of the hero) is gone.
 */
export function adoptWelcome(ctx: GameContext, w: ServerMessages['welcome'], remote: RemoteSave | null, storyStarted: boolean): Placement | null {
  // Kept after a drop to solo: this tab now carries that player's progress, not the solo one.
  ctx.save.useSlot(`online:${w.you}`)
  // A new player's slot is only sent once the story has seeded its first quest, or a reload would skip the intro.
  remote?.hold(!w.save && !storyStarted)
  if (w.save) {
    applyPlayerSave(ctx, w.save)
    return w.save.hero.localPosition ? w.save.hero : null
  }
  const act = ctx.state.act
  resetToNewGame(ctx.state)
  // Before the story starts the intro plays as in a new solo game; after, setAct reseeds the first quest.
  if (storyStarted) ctx.services.gameplay?.setAct(1)
  else if (act !== 1) ctx.bus.emit('act:changed', { act: 1 })
  ctx.save.write()
  remote?.flush()
  return 'cabine'
}

/**
 * Same placement as a new solo game's `enterRoom('cabine')` or the saved spot; outside, the hero is left where they swim.
 * District and room come from the position, never from the save: older saves paired a spot with another district.
 */
export function place(ctx: GameContext, where: Placement): void {
  const drift = ctx.services.drift
  const hero = ctx.services.hero
  if (!drift || !hero || ctx.state.mode !== 'inside') return
  if (where !== 'cabine' && where.localPosition) {
    const local = { ...where.localPosition }
    const room = drift.roomAt(drift.toWorld(local)) ?? where.room
    Object.assign(ctx.state.hero, { room, district: drift.districtAt(local), medium: 'air', localPosition: local })
    hero.teleportLocal(local, where.yaw - drift.pose().heading)
    return
  }
  const spawn = drift.roomSpawn('cabine')
  const local = drift.toLocal(spawn.position)
  Object.assign(ctx.state.hero, { room: 'cabine', district: drift.districtAt(local), medium: 'air', wetness: 0, localPosition: local })
  hero.teleport(spawn.position, spawn.yaw)
}

/** Mirrors each local save to the server, debounced; localStorage keeps its own copy. */
export class RemoteSave {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly encoder = new TextEncoder()
  private held = false

  constructor(private readonly state: GameState, private readonly send: (m: ClientMessages['save']) => void) {}

  hold(held: boolean): void {
    this.held = held
    if (held) this.cancel()
  }

  schedule(): void {
    if (this.timer || this.held) return
    this.timer = setTimeout(() => this.flush(), NET.saveDebounceMs)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.held) return
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
