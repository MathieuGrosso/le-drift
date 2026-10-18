import type { Gp, Scrub, ScrubTarget } from './context'
import { TOURNEE_GOSSIP } from './text/fr'

const RATE = 0.55
const DONE = 0.02
const REACH = 2.8
const TOURNEE_LOOT = ['poisson', 'algue-rouge', 'moule', 'poisson', 'crevette'] as const

export function createScrub(gp: Gp): Scrub {
  const ctx = gp.ctx
  let scrubbing = false
  let best: ScrubTarget | null = null
  let virtualCoat = 1
  const done = new Set<string>()

  const collect = (): ScrubTarget[] => {
    const out: ScrubTarget[] = []
    const drift = ctx.services.drift
    const head = gp.headPos()
    if (drift && ctx.state.hero.medium === 'water') {
      const w = drift.nearestWindow(head, REACH)
      if (w && w.coat > DONE) {
        const d = Math.hypot(w.position.x - head.x, w.position.y - head.y, w.position.z - head.z)
        out.push({ id: w.id, dist: d, coat: w.coat, scrub: (a) => drift.scrub(w.id, a) })
      }
    } else if (!drift && gp.quests.step('a1-grande-vitre') === 'frotter' && virtualCoat > DONE) {
      out.push({ id: 'grande-vitre', dist: 1, coat: virtualCoat, scrub: (a) => (virtualCoat = Math.max(0, virtualCoat - a)) })
    }
    gp.shallows.scrubTargets(out)
    return out
  }

  const stop = () => {
    if (!scrubbing) return
    scrubbing = false
    gp.heroMode('idle')
  }

  const isWindow = (id: string) => !id.includes(':')

  return {
    active: () => scrubbing,
    best: () => best,
    update(dt) {
      if (gp.busy() || ctx.clock.paused) {
        best = null
        stop()
        return
      }
      const list = collect()
      best = list.reduce<ScrubTarget | null>((b, t) => (!b || t.dist < b.dist ? t : b), null)
      if (!best || !ctx.input.down('scrub') || !gp.inv.has('frottoir')) {
        stop()
        return
      }
      if (!scrubbing) {
        scrubbing = true
        gp.heroMode('scrub')
        gp.sfx('frotter')
      }
      const left = best.scrub(RATE * dt * (isWindow(best.id) ? 1 : 1.8))
      best.coat = left
      if (isWindow(best.id)) ctx.bus.emit('scrub:progress', { windowId: best.id, coat: left })
      if (left <= DONE) {
        const id = best.id
        stop()
        if (!isWindow(id)) return
        const key = `${ctx.state.time.day}:${id}`
        if (done.has(key)) return
        done.add(key)
        ctx.bus.emit('scrub:done', { windowId: id })
        gp.sfx('vitre-propre')
        const rng = ctx.rng(`tournee-${key}`)
        if (rng() < 0.45) gp.inv.give(TOURNEE_LOOT[Math.floor(rng() * TOURNEE_LOOT.length)]!, 1)
        else if (rng() < 0.4) gp.hud.tip(TOURNEE_GOSSIP[Math.floor(rng() * TOURNEE_GOSSIP.length)]!, 4)
      }
    },
  }
}
