import type { Ending, Gp } from './context'
import { DIALOGUES } from './text/fr'

// The last measurement: at the Dôme de Proue's lunette, in the rain, the first line drawn in the white.
export function createEnding(gp: Gp): Ending {
  const ctx = gp.ctx
  let playing = false
  let rippleTimer = 0
  let t = 0

  let cc = { x: 0, y: 16, z: -70 }

  const api: Ending = {
    playing: () => playing,
    async play() {
      if (playing) return
      playing = true
      const st = ctx.state
      st.flags['ending'] = true
      gp.lock.count++
      gp.menus.close()
      gp.hud.showHud(false)
      gp.heroMode('cutscene')
      gp.cue('rain')
      gp.weather.set({ rain: 1 })
      t = 0
      cc = gp.sites.where('lunette-vigie') ?? gp.sites.where('lunette-dome-proue') ?? gp.heroLocal()
      try {
        await gp.dialogue.play(DIALOGUES.fin.slice(0, 3))
        gp.sfx('stylo')
        await gp.dialogue.play(DIALOGUES.fin.slice(3, 5))
        await gp.cine.wait(1.5)
        await gp.dialogue.play(DIALOGUES.fin.slice(5), 'grand-pere')
        await gp.cine.wait(2)
        await gp.chart.drawLine()
        await gp.cine.fade('white', 3)
        gp.camera.set(null)
        await gp.cine.credits()
        st.flags['postgame'] = true
        st.quests['a3-ligne'] = 'done'
        ctx.bus.emit('quest:step', { questId: 'a3-ligne', step: 'done' })
        ctx.bus.emit('quest:completed', { questId: 'a3-ligne' })
        gp.heroMode('idle')
        await gp.cine.fade(null, 2.5)
        await gp.dialogue.play(DIALOGUES.postGame)
      } finally {
        st.flags['ending'] = false
        gp.camera.set(null)
        gp.hud.showHud(true)
        gp.lock.count--
        playing = false
        gp.cue('explore')
        ctx.save.write()
      }
    },
    update(dt) {
      if (!playing) return
      t += dt
      const p = ctx.state.drift.position
      rippleTimer -= dt
      if (rippleTimer <= 0) {
        rippleTimer = 0.06
        const a = Math.random() * Math.PI * 2
        const r = 4 + Math.random() * 120
        const x = p.x + Math.cos(a) * r
        const z = p.z + Math.sin(a) * r
        ctx.services.render?.addRipple(x, z, 0.5 + Math.random() * 0.5)
        ctx.bus.emit('ceiling:ripple', { x, z, strength: 0.6 })
        if (Math.random() < 0.3) gp.sfx('rain-drop')
      }
      const k = Math.min(1, t / 14)
      const mid = cc.x * 0.15
      const eye = gp.toWorld({ x: mid + 0.5 - k * 0.4, y: cc.y + 1.4 + k * 0.3, z: cc.z + 3.6 - k * 1.6 })
      const look = gp.toWorld({ x: mid, y: cc.y + 1.2 + k * 11, z: cc.z - 32 })
      gp.camera.set({ position: eye, target: look, fov: 60 + k * 6 })
    },
  }
  return api
}
