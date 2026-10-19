import type { Cine, Gp } from '../context'
import { CREDITS, UI } from '../text/fr'
import { h } from './dom'

const VERSES: readonly (readonly string[])[] = [
  ['Pluie, ', 'pluie, ', 'va-', 't’en'],
  ['Re-', 'viens ', 'un autre ', 'jour'],
  ['Pluie, ', 'pluie, ', 'sur la ', 'mer'],
  ['Le pla-', 'fond fait ', 'des ', 'ronds'],
]
const BEAT = 0.72
const HIT_WINDOW = 0.2

interface Waiter { t: number; resolve: () => void }

export function createCine(gp: Gp, root: HTMLElement): Cine {
  const ctx = gp.ctx
  const fadeEl = h('div', 'gp-fade', undefined, root)
  const card = h('div', 'gp-card-act', undefined, root)
  const cardT = h('div', 't', '', card)
  const cardS = h('div', 's', '', card)
  const waiters: Waiter[] = []
  let busy = 0
  let tick: ((dt: number) => void) | null = null

  const wait = (seconds: number) => new Promise<void>((resolve) => waiters.push({ t: seconds, resolve }))
  const advancePressed = () => ctx.input.pressed('interact') || ctx.input.pressed('up')

  const api: Cine = {
    wait,
    active: () => busy > 0,
    async fade(to, seconds) {
      fadeEl.style.transitionDuration = `${seconds}s`
      if (to) {
        fadeEl.style.background = to === 'white' ? '#f4f1e6' : '#06182a'
        fadeEl.style.opacity = '1'
      } else fadeEl.style.opacity = '0'
      await wait(seconds)
    },
    async card(title, sub, seconds = 3.2) {
      cardT.textContent = title
      cardS.textContent = sub ?? ''
      cardS.classList.toggle('long', (sub ?? '').length > 28)
      card.classList.add('show')
      await wait(seconds)
      card.classList.remove('show')
      await wait(1.2)
    },
    async narrate(lines) {
      busy++
      const input = ctx.input
      const wrap = h('div', 'gp-narrate', undefined, root)
      const p = h('div', 'p', '', wrap)
      h('div', 'hint', `${input.keyLabel('interact')} · ${UI.continuer}    ${input.keyLabel('pause')} · ${UI.passer}`, wrap)
      let clicked = false
      let skip = false
      wrap.addEventListener('click', () => {
        clicked = true
      })
      for (const line of lines) {
        if (skip) break
        p.textContent = line
        p.classList.add('show')
        const auto = Math.min(4, Math.max(2, 0.9 + line.length * 0.024))
        let t = 0
        await new Promise<void>((resolve) => {
          tick = (dt) => {
            t += dt
            const go = advancePressed() || clicked
            if (input.pressed('pause') || Math.hypot(input.move.x, input.move.y) > 0.3) skip = true
            input.consume('interact', 'up', 'pause')
            clicked = false
            if ((go && t > 0.35) || t > auto || skip) {
              tick = null
              resolve()
            }
          }
        })
        p.classList.remove('show')
        await wait(skip ? 0 : 0.3)
      }
      tick = () => input.consume('interact', 'up', 'pause')
      wrap.style.opacity = '0'
      await wait(0.6)
      tick = null
      wrap.remove()
      busy--
    },
    async credits() {
      busy++
      const wrap = h('div', 'gp-credits', undefined, root)
      for (const [a, b] of CREDITS) {
        const c = h('div', 'c', undefined, wrap)
        h('div', 'a', a, c)
        h('div', 'b', b, c)
        await wait(0.05)
        c.classList.add('show')
        await wait(4.2)
        c.classList.remove('show')
        await wait(1.7)
        c.remove()
      }
      const end = h('div', 'c', undefined, wrap)
      h('div', 'a', UI.fin, end)
      await wait(0.05)
      end.classList.add('show')
      await wait(3.5)
      end.classList.remove('show')
      await wait(1.6)
      wrap.remove()
      busy--
    },
    async clapping() {
      busy++
      const wrap = h('div', 'gp-clap', undefined, root)
      h('div', 'help', UI.clap.aide(ctx.input.keyLabel('interact')), wrap)
      const verse = h('div', 'verse', undefined, wrap)
      const ring = h('div', 'ring', undefined, wrap)
      h('div', 'target', undefined, ring)
      const closing = h('div', 'closing', undefined, ring)
      const flash = h('div', 'flash', undefined, ring)
      const score = h('div', 'score', '', wrap)
      const total = VERSES.length * 4
      let hits = 0
      const lead = 1.6
      let t = 0
      let lastVerse = -1
      let spans: HTMLSpanElement[] = []
      const judged = new Set<number>()
      gp.cue('drift')
      await new Promise<void>((resolve) => {
        tick = (dt) => {
          t += dt
          const bt = t - lead
          const beat = Math.round(bt / BEAT)
          const v = Math.max(0, Math.min(VERSES.length - 1, Math.floor(Math.max(0, bt + BEAT * 0.5) / (BEAT * 4))))
          if (v !== lastVerse) {
            lastVerse = v
            verse.textContent = ''
            spans = VERSES[v]!.map((w) => h('span', '', w, verse))
          }
          const within = ((beat % 4) + 4) % 4
          spans.forEach((s, i) => s.classList.toggle('on', bt >= -0.1 && i <= within && Math.floor((bt + 0.1) / (BEAT * 4)) === v))
          const nextBeatT = Math.ceil(bt / BEAT) * BEAT
          const frac = Math.max(0, Math.min(1, (nextBeatT - bt) / BEAT))
          const size = 70 + 80 * frac
          closing.style.width = closing.style.height = `${size}px`
          closing.style.opacity = bt < -BEAT || beat >= total ? '0' : '1'
          if (advancePressed() && beat >= 0 && beat < total && !judged.has(beat)) {
            if (Math.abs(bt - beat * BEAT) <= HIT_WINDOW) {
              hits++
              judged.add(beat)
              flash.classList.add('on')
              gp.sfx('clap')
              setTimeout(() => flash.classList.remove('on'), 60)
            }
          }
          score.textContent = UI.clap.score(hits, total)
          if (bt > total * BEAT + 0.6) {
            tick = null
            resolve()
          }
        }
      })
      await wait(0.6)
      wrap.remove()
      busy--
      return hits
    },
    update(dt) {
      tick?.(dt)
      for (let i = waiters.length - 1; i >= 0; i--) {
        const w = waiters[i]!
        w.t -= dt
        if (w.t <= 0) {
          waiters.splice(i, 1)
          w.resolve()
        }
      }
    },
  }
  return api
}
