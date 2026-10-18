import { CEILING_Y } from '../core/layout'
import type { Vec3 } from '../core/types'
import type { Ending, Gp } from './context'
import { DIALOGUES } from './text/fr'

const RISE_SECONDS = 6

export function createEnding(gp: Gp): Ending {
  const ctx = gp.ctx
  let playing = false
  let rise: { from: Vec3; to: Vec3; t: number } | null = null
  let rippleTimer = 0
  let handPulse = 0
  let shot: 'below' | 'hand' | null = null

  const teleport = (p: Vec3) => {
    if (ctx.services.hero) ctx.services.hero.teleport(p)
    else ctx.state.hero.position = { ...p }
  }

  const api: Ending = {
    playing: () => playing,
    async play() {
      if (playing || ctx.state.flags['postgame']) return
      playing = true
      const st = ctx.state
      st.flags['ending'] = true
      gp.lock.count++
      gp.menus.close()
      gp.hud.showHud(false)
      gp.heroMode('cutscene')
      gp.cue('rain')
      gp.weather.set({ rain: 1 })
      shot = 'below'
      try {
        await gp.dialogue.play(DIALOGUES.fin.slice(0, 2))
        st.hero.lestOn = false
        gp.sfx('lest', st.hero.position)
        await gp.dialogue.play(DIALOGUES.fin.slice(2, 4))
        const from = { ...st.hero.position }
        rise = { from, to: { x: from.x, y: CEILING_Y - 1.1, z: from.z }, t: 0 }
        while (rise && rise.t < 1) await gp.cine.wait(0.05)
        shot = 'hand'
        await gp.dialogue.play(DIALOGUES.fin.slice(4))
        handPulse = 3
        await gp.cine.wait(3)
        await gp.cine.fade('white', 3)
        shot = null
        await gp.chart.drawLine()
        await gp.cine.credits()
        st.flags['postgame'] = true
        st.quests['a3-seuil'] = 'done'
        ctx.bus.emit('quest:step', { questId: 'a3-seuil', step: 'done' })
        ctx.bus.emit('quest:completed', { questId: 'a3-seuil' })
        st.hero.lestOn = true
        const p = st.hero.position
        teleport({ x: p.x, y: CEILING_Y - 6, z: p.z })
        gp.camera.set(null)
        gp.heroMode('idle')
        await gp.cine.fade(null, 2.5)
      } finally {
        st.flags['ending'] = false
        rise = null
        shot = null
        gp.camera.set(null)
        gp.hud.showHud(true)
        gp.lock.count--
        playing = false
        gp.cue('explore')
      }
    },
    update(dt) {
      if (!playing) return
      const p = ctx.state.hero.position
      rippleTimer -= dt
      if (rippleTimer <= 0) {
        rippleTimer = 0.07
        const a = Math.random() * Math.PI * 2
        const r = 4 + Math.random() * 70
        const x = p.x + Math.cos(a) * r
        const z = p.z + Math.sin(a) * r
        ctx.services.render?.addRipple(x, z, 0.5 + Math.random() * 0.5)
        ctx.bus.emit('ceiling:ripple', { x, z, strength: 0.6 })
      }
      if (handPulse > 0) {
        const before = Math.floor(handPulse * 3)
        handPulse -= dt
        if (Math.floor(handPulse * 3) !== before) {
          ctx.services.render?.addRipple(p.x, p.z, 1.6)
          ctx.bus.emit('ceiling:ripple', { x: p.x, z: p.z, strength: 1.6 })
        }
      }
      if (rise) {
        rise.t = Math.min(1, rise.t + dt / RISE_SECONDS)
        const e = rise.t * rise.t * (3 - 2 * rise.t)
        teleport({ x: rise.from.x, y: rise.from.y + (rise.to.y - rise.from.y) * e, z: rise.from.z })
      }
      if (shot === 'below') {
        gp.camera.set({ position: { x: p.x + 5, y: p.y - 2.5, z: p.z + 5 }, target: { x: p.x, y: p.y + 7, z: p.z }, fov: 58 })
      } else if (shot === 'hand') {
        gp.camera.set({ position: { x: p.x + 2.2, y: p.y - 1.4, z: p.z + 2.6 }, target: { x: p.x, y: CEILING_Y, z: p.z }, fov: 62 })
      }
    },
  }
  return api
}
