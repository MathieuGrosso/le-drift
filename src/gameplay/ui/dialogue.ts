import type { Dialogue, Gp, Line } from '../context'
import { SPEAKERS } from '../text/fr'
import { h } from './dom'

const CHARS_PER_SEC = 48

interface Job { lines: readonly Line[]; npcId: string | undefined; resolve: () => void }

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
    text.textContent = ''
    next.classList.remove('show')
  }

  const begin = () => {
    job = queue.shift() ?? null
    if (!job) return
    index = 0
    wrap.classList.add('show')
    const mode = ctx.state.hero.mode
    if (mode !== 'sit' && mode !== 'lean' && mode !== 'cutscene') {
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

  return {
    play(lines, npcId) {
      return new Promise<void>((resolve) => {
        if (lines.length === 0) {
          resolve()
          return
        }
        queue.push({ lines, npcId, resolve })
        if (!job) begin()
      })
    },
    active: () => job !== null,
    update(dt) {
      if (!job) return
      if (shown < full.length) {
        shown = Math.min(full.length, shown + dt * CHARS_PER_SEC)
        text.textContent = full.slice(0, Math.floor(shown))
        if (shown >= full.length) next.classList.add('show')
      }
      cooldown -= dt
      const input = ctx.input
      const advance = clicked || input.pressed('interact') || input.pressed('up')
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
