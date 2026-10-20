import type { Dialogue, Gp, Line } from '../context'
import { SPEAKERS } from '../text/fr'
import { h } from './dom'

const CHARS_PER_SEC = 48
const ASIDE_HOLD_S = 2.5
const ASIDE_READ_CHARS_PER_SEC = 16

interface Job { lines: readonly Line[]; npcId: string | undefined; aside: boolean; resolve: () => void }

export function createDialogue(gp: Gp, root: HTMLElement): Dialogue {
  const ctx = gp.ctx
  const wrap = h('div', 'gp-dialogue gp-interactive', undefined, root)
  const box = h('div', 'box', undefined, wrap)
  const name = h('div', 'name', '', box)
  const text = h('div', 'text', '', box)
  const next = h('div', 'next', undefined, box)

  const queue: Job[] = []
  let job: Job | null = null
  let index = 0
  let shown = 0
  let full = ''
  let clicked = false
  let cooldown = 0
  let hold = 0
  let prevMode: string | null = null

  wrap.addEventListener('click', () => {
    clicked = true
  })

  const showLine = () => {
    const line = job!.lines[index]!
    const [who, t] = line
    wrap.classList.toggle('narration', who === null)
    name.textContent = who ? SPEAKERS[who] ?? who : ''
    full = t
    shown = 0
    hold = ASIDE_HOLD_S + t.length / ASIDE_READ_CHARS_PER_SEC
    text.textContent = ''
    next.classList.remove('show')
  }

  const begin = () => {
    job = queue.shift() ?? null
    if (!job) return
    index = 0
    wrap.classList.add('show')
    wrap.classList.toggle('aside', job.aside)
    const mode = ctx.state.hero.mode
    if (job.aside) prevMode = null
    else if (mode !== 'sit' && mode !== 'lean' && mode !== 'cutscene') {
      prevMode = mode
      gp.heroMode('cutscene')
    } else prevMode = null
    if (job.npcId) ctx.bus.emit('dialogue:start', { npcId: job.npcId, nodeId: job.lines[0]?.[1].slice(0, 24) ?? '' })
    showLine()
    cooldown = 0.2
  }

  const finish = () => {
    const j = job!
    job = null
    wrap.classList.remove('show')
    if (prevMode !== null) gp.heroMode('idle')
    if (j.npcId) ctx.bus.emit('dialogue:end', { npcId: j.npcId })
    j.resolve()
    if (queue.length > 0) begin()
  }

  const enqueue = (lines: readonly Line[], npcId: string | undefined, aside: boolean) =>
    new Promise<void>((resolve) => {
      if (lines.length === 0) {
        resolve()
        return
      }
      queue.push({ lines, npcId, aside, resolve })
      if (!job) begin()
      else if (job.aside && !aside) finish()
    })

  return {
    play: (lines, npcId) => enqueue(lines, npcId, false),
    aside: (lines) => enqueue(lines, undefined, true),
    active: () => job !== null && !job.aside,
    update(dt) {
      if (!job) return
      if (shown < full.length) {
        shown = Math.min(full.length, shown + dt * CHARS_PER_SEC)
        text.textContent = full.slice(0, Math.floor(shown))
        if (shown >= full.length) next.classList.add('show')
      }
      cooldown -= dt
      const input = ctx.input
      if (job.aside && shown >= full.length) hold -= dt
      const advance = clicked || (job.aside ? hold <= 0 : input.pressed('interact') || input.pressed('up'))
      clicked = false
      if (!advance || cooldown > 0) return
      cooldown = 0.12
      if (shown < full.length) {
        shown = full.length
        text.textContent = full
        next.classList.add('show')
        return
      }
      index++
      if (index >= job.lines.length) finish()
      else showLine()
    },
  }
}
