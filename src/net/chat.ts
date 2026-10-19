import { LIMITS, sanitizeText } from '../shared/protocol'
import { el, hexColor } from './style'
import { TEXT } from './text'

const LOG_LINES = 6
const LINE_FADE_MS = 12_000

/** French chat box: Entrée opens it, Entrée sends, Échap closes. Keys typed here never reach the game. */
export class ChatBox {
  private readonly root: HTMLDivElement
  private readonly log: HTMLDivElement
  private readonly input: HTMLInputElement
  private readonly hint: HTMLDivElement
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Enter' || this.isOpen() || !this.enabled() || e.target instanceof HTMLInputElement) return
    e.preventDefault()
    this.open()
  }

  constructor(parent: HTMLElement, private readonly send: (text: string) => void, private readonly enabled: () => boolean) {
    this.root = el('div', 'net-chat')
    this.log = el('div', 'net-chat-log')
    this.input = el('input')
    this.input.maxLength = LIMITS.chatMax
    this.input.placeholder = TEXT.chatPlaceholder
    this.hint = el('div', 'net-hint', TEXT.chatHint)
    this.root.append(this.log, this.input, this.hint)
    parent.appendChild(this.root)
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.code === 'Enter') {
        const text = sanitizeText(this.input.value, LIMITS.chatMax)
        if (text) this.send(text)
        this.close()
      } else if (e.code === 'Escape') this.close()
    })
    this.input.addEventListener('keyup', (e) => e.stopPropagation())
    this.input.addEventListener('blur', () => this.close())
    window.addEventListener('keydown', this.onKey)
  }

  isOpen(): boolean {
    return this.root.classList.contains('open')
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none'
  }

  line(name: string | null, text: string, color = 0): void {
    const row = el('div', 'net-chat-line')
    if (name !== null) {
      const who = el('b', '', name)
      who.style.color = hexColor(color)
      row.appendChild(who)
    }
    row.appendChild(document.createTextNode(text))
    this.log.appendChild(row)
    while (this.log.childElementCount > LOG_LINES) this.log.firstElementChild?.remove()
    setTimeout(() => row.classList.add('old'), LINE_FADE_MS)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.root.remove()
  }

  private open(): void {
    this.root.classList.add('open')
    this.input.value = ''
    this.input.focus()
  }

  private close(): void {
    this.root.classList.remove('open')
    this.input.blur()
  }
}
