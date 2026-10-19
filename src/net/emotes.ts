import { EMOTES, type EmoteId } from '../shared/protocol'
import { el } from './style'
import { EMOTE_LABEL } from './text'

const WHEEL_KEY = 'KeyG'
const RADIUS = 115

/** Hold G: a ring of emotes, picked by number key (or click when the mouse is free); releasing G closes it. */
export class EmoteWheel {
  private readonly root: HTMLDivElement
  private readonly onDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || !this.enabled()) return
    if (e.code === WHEEL_KEY && !e.repeat) this.open()
    else if (this.isOpen() && /^Digit[1-9]$/.test(e.code)) this.pick(EMOTES[Number(e.code.slice(5)) - 1])
  }
  private readonly onUp = (e: KeyboardEvent) => {
    if (e.code === WHEEL_KEY) this.close()
  }

  constructor(parent: HTMLElement, private readonly send: (emote: EmoteId) => void, private readonly enabled: () => boolean) {
    this.root = el('div', 'net-wheel')
    EMOTES.forEach((id, i) => {
      const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2
      const b = el('button')
      b.append(el('small', '', String(i + 1)), document.createTextNode(EMOTE_LABEL[id]))
      b.style.left = `calc(50% + ${Math.cos(a) * RADIUS}px)`
      b.style.top = `calc(50% + ${Math.sin(a) * RADIUS}px)`
      b.addEventListener('mousedown', (e) => e.stopPropagation())
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        this.pick(id)
      })
      this.root.appendChild(b)
    })
    parent.appendChild(this.root)
    window.addEventListener('keydown', this.onDown)
    window.addEventListener('keyup', this.onUp)
  }

  isOpen(): boolean {
    return this.root.classList.contains('open')
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown)
    window.removeEventListener('keyup', this.onUp)
    this.root.remove()
  }

  private open(): void {
    this.root.classList.add('open')
  }

  private close(): void {
    this.root.classList.remove('open')
  }

  private pick(id: EmoteId | undefined): void {
    if (id) this.send(id)
    this.close()
  }
}
