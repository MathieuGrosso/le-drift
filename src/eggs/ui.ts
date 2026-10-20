import * as THREE from 'three'
import { SPEECH_BUBBLE } from '../core/bubbles'
import type { GameContext, Vec3 } from '../core/types'
import type { Line } from './text'

const CSS = `
.eg-root { position: absolute; inset: 0; pointer-events: none !important; font-family: ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif; color: #f6f2e8; }
.eg-prompt { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%) translateY(6px); display: flex; align-items: center; gap: 10px;
  opacity: 0; transition: opacity .2s, transform .2s; font-size: 17px; text-shadow: 0 2px 10px rgba(14,59,82,.7); }
.eg-prompt.show { opacity: 1; transform: translateX(-50%); }
.eg-key { display: inline-grid; place-items: center; min-width: 34px; height: 34px; padding: 0 8px; border-radius: 999px; background: #f6f2e8;
  color: #0e3b52; font-weight: 800; font-size: 15px; box-shadow: 0 2px 0 rgba(14,59,82,.5); text-shadow: none; }
.eg-dialogue { position: absolute; left: 50%; bottom: 6%; width: min(820px, 88vw); transform: translateX(-50%) translateY(14px); opacity: 0;
  transition: opacity .3s, transform .3s; pointer-events: auto; }
.eg-dialogue.show { opacity: 1; transform: translateX(-50%); }
.eg-dialogue .box { position: relative; padding: 24px 32px 26px; border-radius: 22px; min-height: 100px; background: rgba(14,59,82,.78);
  border: 1px solid rgba(207,239,227,.25); box-shadow: 0 10px 40px rgba(6,24,38,.45); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.eg-dialogue .name { position: absolute; top: -16px; left: 26px; padding: 5px 16px; border-radius: 999px; background: #e8674a; color: #fff8ee;
  font-weight: 700; font-size: 15px; letter-spacing: .04em; }
.eg-dialogue .text { font-size: 21px; line-height: 1.55; min-height: 2.6em; }
.eg-dialogue.narration .box { background: none; border: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; text-align: center; }
.eg-dialogue.narration .text { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 23px; text-shadow: 0 2px 18px rgba(6,24,38,.9); }
.eg-dialogue.narration .name { display: none; }
.eg-toast { position: absolute; left: 50%; top: 16%; transform: translateX(-50%) translateY(-8px); opacity: 0; transition: opacity .4s, transform .4s; text-align: center; }
.eg-toast.show { opacity: 1; transform: translateX(-50%); }
.eg-toast .k { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #9ee6c9; font-weight: 700; }
.eg-toast .t { font-family: 'Fraunces', Georgia, serif; font-size: 22px; text-shadow: 0 2px 14px rgba(14,59,82,.6); }
.eg-toast .n { font-family: 'Caveat', cursive; font-size: 20px; opacity: .9; }
.eg-bubble { position: absolute; transform: translate(-50%, -100%); padding: 6px 12px; border-radius: 14px; background: rgba(246,242,232,.92);
  color: #0e3b52; font-size: 14px; max-width: 240px; text-align: center; opacity: 0; transition: opacity .4s; }
.eg-bubble.show { opacity: 1; }
`

const CHARS_PER_SEC = 50

export class EggUi {
  readonly root = document.createElement('div')
  private readonly style = document.createElement('style')
  private readonly prompt = document.createElement('div')
  private readonly promptKey = document.createElement('span')
  private readonly promptLabel = document.createElement('span')
  private readonly dlg = document.createElement('div')
  private readonly dlgName = document.createElement('div')
  private readonly dlgText = document.createElement('div')
  private readonly toastEl = document.createElement('div')
  private readonly bubble = document.createElement('div')
  private lines: readonly Line[] = []
  private index = 0
  private shown = 0
  private full = ''
  private resolve: (() => void) | null = null
  private clicked = false
  private cooldown = 0
  private toastTimer = 0
  private bubbleLeft = 0
  private bubbleAt: (() => Vec3 | null) | null = null
  private readonly v = new THREE.Vector3()

  constructor(private readonly ctx: GameContext) {
    this.style.textContent = CSS
    document.head.appendChild(this.style)
    this.root.className = 'eg-root'
    ctx.uiRoot.appendChild(this.root)

    this.prompt.className = 'eg-prompt'
    this.promptKey.className = 'eg-key'
    this.prompt.append(this.promptKey, this.promptLabel)

    this.dlg.className = 'eg-dialogue'
    const box = document.createElement('div')
    box.className = 'box'
    this.dlgName.className = 'name'
    this.dlgText.className = 'text'
    box.append(this.dlgName, this.dlgText)
    this.dlg.appendChild(box)
    this.dlg.addEventListener('click', () => {
      this.clicked = true
    })

    this.toastEl.className = 'eg-toast'
    this.bubble.className = `eg-bubble ${SPEECH_BUBBLE}`
    this.root.append(this.prompt, this.dlg, this.toastEl, this.bubble)
  }

  showPrompt(label: string | null): void {
    if (!label) {
      this.prompt.classList.remove('show')
      return
    }
    this.promptKey.textContent = this.ctx.input.keyLabel('interact')
    this.promptLabel.textContent = label
    this.prompt.classList.add('show')
  }

  talking(): boolean {
    return this.resolve !== null
  }

  say(lines: readonly Line[]): Promise<void> {
    if (this.resolve) this.resolve()
    this.lines = lines
    this.index = 0
    this.cooldown = 0.25
    this.dlg.classList.add('show')
    this.showLine()
    return new Promise((r) => {
      this.resolve = r
    })
  }

  toast(kicker: string, text: string, note?: string): void {
    this.toastEl.replaceChildren()
    const k = document.createElement('div')
    k.className = 'k'
    k.textContent = kicker
    const t = document.createElement('div')
    t.className = 't'
    t.textContent = text
    this.toastEl.append(k, t)
    if (note) {
      const n = document.createElement('div')
      n.className = 'n'
      n.textContent = note
      this.toastEl.appendChild(n)
    }
    this.toastEl.classList.add('show')
    this.toastTimer = note ? 5 : 3.2
  }

  speak(at: () => Vec3 | null, text: string, seconds = 4): void {
    this.bubble.textContent = text
    this.bubbleAt = at
    this.bubbleLeft = seconds
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show')
    }
    this.updateBubble(dt)
    if (!this.resolve) return
    this.cooldown -= dt
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + CHARS_PER_SEC * dt)
      this.dlgText.textContent = this.full.slice(0, Math.floor(this.shown))
    }
    const advance = (this.ctx.input.pressed('interact') || this.clicked) && this.cooldown <= 0
    this.clicked = false
    if (!advance) return
    this.cooldown = 0.15
    if (this.shown < this.full.length) {
      this.shown = this.full.length
      this.dlgText.textContent = this.full
      return
    }
    this.index++
    if (this.index < this.lines.length) {
      this.showLine()
      return
    }
    this.dlg.classList.remove('show')
    const r = this.resolve
    this.resolve = null
    r()
  }

  private showLine(): void {
    const [who, t] = this.lines[this.index]!
    this.dlg.classList.toggle('narration', who === null)
    this.dlgName.textContent = who ?? ''
    this.full = t
    this.shown = 0
    this.dlgText.textContent = ''
  }

  private updateBubble(dt: number): void {
    if (!this.bubbleAt || this.bubbleLeft <= 0) {
      this.bubble.classList.remove('show')
      return
    }
    this.bubbleLeft -= dt
    const p = this.bubbleAt()
    if (!p) {
      this.bubbleLeft = 0
      return
    }
    this.v.set(p.x, p.y, p.z).project(this.ctx.camera)
    if (this.v.z > 1 || Math.abs(this.v.x) > 1.1 || Math.abs(this.v.y) > 1.1) {
      this.bubble.classList.remove('show')
      return
    }
    this.bubble.style.left = `${((this.v.x + 1) / 2) * 100}%`
    this.bubble.style.top = `${((1 - this.v.y) / 2) * 100}%`
    this.bubble.classList.toggle('show', this.bubbleLeft > 0.4)
  }

  dispose(): void {
    this.resolve?.()
    this.resolve = null
    this.root.remove()
    this.style.remove()
  }
}
