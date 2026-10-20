import * as THREE from 'three'
import { SPEECH_BUBBLE, shownBubbles } from '../core/bubbles'
import { hiddenFrom } from '../core/sight'
import type { GameContext, Vec3 } from '../core/types'
import type { Line } from './text'

const CSS = `
.cb-root { position: absolute; inset: 0; pointer-events: none !important; font-family: ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif; color: #f6f2e8; }
.cb-prompt { position: absolute; left: 50%; bottom: 19%; transform: translateX(-50%) translateY(6px); display: flex; align-items: center; gap: 10px;
  opacity: 0; transition: opacity .2s, transform .2s; font-size: 17px; text-shadow: 0 2px 10px rgba(14,59,82,.7); }
.cb-prompt.show { opacity: 1; transform: translateX(-50%); }
.cb-key { display: inline-grid; place-items: center; min-width: 34px; height: 34px; padding: 0 8px; border-radius: 999px; background: #f6f2e8;
  color: #0e3b52; font-weight: 800; font-size: 15px; box-shadow: 0 2px 0 rgba(14,59,82,.5); text-shadow: none; }
.cb-dialogue { position: absolute; left: 50%; bottom: 6%; width: min(820px, 88vw); transform: translateX(-50%) translateY(14px); opacity: 0;
  transition: opacity .3s, transform .3s; pointer-events: auto; }
.cb-dialogue.show { opacity: 1; transform: translateX(-50%); }
.cb-dialogue .box { position: relative; padding: 24px 32px 26px; border-radius: 22px; min-height: 100px; background: rgba(14,59,82,.78);
  border: 1px solid rgba(207,239,227,.25); box-shadow: 0 10px 40px rgba(6,24,38,.45); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.cb-dialogue .name { position: absolute; top: -16px; left: 26px; padding: 5px 16px; border-radius: 999px; background: #e3a33b; color: #3a2410;
  font-weight: 700; font-size: 15px; letter-spacing: .04em; }
.cb-dialogue .name.ilo { background: #e8674a; color: #fff8ee; }
.cb-dialogue .text { font-size: 21px; line-height: 1.55; min-height: 2.6em; }
.cb-dialogue.narration .box { background: none; border: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; text-align: center; }
.cb-dialogue.narration .text { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 23px; text-shadow: 0 2px 18px rgba(6,24,38,.9); }
.cb-dialogue.narration .name { display: none; }
.cb-choice { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; min-width: min(520px, 88vw);
  opacity: 0; transition: opacity .25s; pointer-events: auto; }
.cb-choice.show { opacity: 1; }
.cb-choice .q { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-size: 20px; text-align: center; margin-bottom: 4px; text-shadow: 0 2px 14px rgba(6,24,38,.9); }
.cb-choice .o { padding: 10px 18px; border-radius: 16px; background: rgba(14,59,82,.7); border: 1px solid rgba(158,240,200,.2); font-size: 18px; cursor: pointer; }
.cb-choice .o.sel { background: rgba(158,240,200,.92); color: #0e3b52; border-color: transparent; }
.cb-toast { position: absolute; left: 50%; top: 16%; transform: translateX(-50%) translateY(-8px); opacity: 0; transition: opacity .4s, transform .4s; text-align: center; }
.cb-toast.show { opacity: 1; transform: translateX(-50%); }
.cb-toast .k { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #f2c46a; font-weight: 700; }
.cb-toast .t { font-family: 'Fraunces', Georgia, serif; font-size: 22px; text-shadow: 0 2px 14px rgba(14,59,82,.6); }
.cb-toast .n { font-family: 'Caveat', cursive; font-size: 21px; opacity: .92; max-width: 560px; }
.cb-bubble { position: absolute; left: 0; top: 0; padding: 6px 12px; border-radius: 14px; background: rgba(246,236,208,.94);
  color: #3a2410; font-size: 14px; max-width: 260px; text-align: center; opacity: 0; transition: opacity .4s; }
.cb-bubble.show { opacity: 1; }
`

const CHARS_PER_SEC = 48
const BUBBLE_MARGIN = 12
const BUBBLE_GAP = 6

export class CamilleUi {
  readonly root = document.createElement('div')
  private readonly style = document.createElement('style')
  private readonly prompt = document.createElement('div')
  private readonly promptKey = document.createElement('span')
  private readonly promptLabel = document.createElement('span')
  private readonly dlg = document.createElement('div')
  private readonly dlgName = document.createElement('div')
  private readonly dlgText = document.createElement('div')
  private readonly choiceEl = document.createElement('div')
  private readonly toastEl = document.createElement('div')
  private readonly bubble = document.createElement('div')
  private lines: readonly Line[] = []
  private index = 0
  private shown = 0
  private full = ''
  private resolve: (() => void) | null = null
  private choose: ((i: number) => void) | null = null
  private options: HTMLElement[] = []
  private sel = 0
  private navCool = 0
  private clicked = false
  private cooldown = 0
  private toastTimer = 0
  private bubbleLeft = 0
  private bubbleAt: (() => Vec3 | null) | null = null
  private bubbleThroughWalls = false
  private readonly v = new THREE.Vector3()
  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.choose) return
    const n = Number(e.key)
    if (n >= 1 && n <= this.options.length) this.pick(n - 1)
    else if (e.key === 'ArrowUp') this.move(-1)
    else if (e.key === 'ArrowDown') this.move(1)
  }

  constructor(private readonly ctx: GameContext) {
    this.style.textContent = CSS
    document.head.appendChild(this.style)
    this.root.className = 'cb-root'
    ctx.uiRoot.appendChild(this.root)
    this.prompt.className = 'cb-prompt'
    this.promptKey.className = 'cb-key'
    this.prompt.append(this.promptKey, this.promptLabel)
    this.dlg.className = 'cb-dialogue'
    const box = document.createElement('div')
    box.className = 'box'
    this.dlgName.className = 'name'
    this.dlgText.className = 'text'
    box.append(this.dlgName, this.dlgText)
    this.dlg.appendChild(box)
    this.dlg.addEventListener('click', () => {
      this.clicked = true
    })
    this.choiceEl.className = 'cb-choice'
    this.toastEl.className = 'cb-toast'
    this.bubble.className = `cb-bubble ${SPEECH_BUBBLE}`
    this.root.append(this.prompt, this.dlg, this.choiceEl, this.toastEl, this.bubble)
    window.addEventListener('keydown', this.onKey)
  }

  busy(): boolean {
    return this.resolve !== null || this.choose !== null
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

  ask(question: string, labels: readonly string[]): Promise<number> {
    this.choiceEl.replaceChildren()
    const q = document.createElement('div')
    q.className = 'q'
    q.textContent = question
    this.choiceEl.appendChild(q)
    this.options = labels.map((l, i) => {
      const o = document.createElement('div')
      o.className = 'o'
      o.textContent = `${i + 1}. ${l}`
      o.addEventListener('click', () => this.pick(i))
      this.choiceEl.appendChild(o)
      return o
    })
    this.sel = 0
    this.cooldown = 0.3
    this.paintSel()
    this.choiceEl.classList.add('show')
    return new Promise((r) => {
      this.choose = r
    })
  }

  toast(kicker: string, text: string, note?: string): void {
    this.toastEl.replaceChildren()
    for (const [cls, t] of [['k', kicker], ['t', text], ['n', note]] as const) {
      if (!t) continue
      const d = document.createElement('div')
      d.className = cls
      d.textContent = t
      this.toastEl.appendChild(d)
    }
    this.toastEl.classList.add('show')
    this.toastTimer = note ? 5.5 : 3.2
  }

  speak(at: () => Vec3 | null, text: string, seconds = 4.5, throughWalls = false): void {
    this.bubble.textContent = text
    this.bubbleAt = at
    this.bubbleLeft = seconds
    this.bubbleThroughWalls = throughWalls
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show')
    }
    this.updateBubble(dt)
    this.cooldown -= dt
    if (this.choose) {
      this.navCool -= dt
      const y = this.ctx.input.move.y
      if (Math.abs(y) > 0.5 && this.navCool <= 0) {
        this.move(y > 0 ? -1 : 1)
        this.navCool = 0.25
      } else if (Math.abs(y) <= 0.5) this.navCool = 0
      if (this.ctx.input.pressed('interact') && this.cooldown <= 0) this.pick(this.sel)
      return
    }
    if (!this.resolve) return
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

  private move(d: number): void {
    this.sel = (this.sel + d + this.options.length) % this.options.length
    this.paintSel()
  }

  private paintSel(): void {
    this.options.forEach((o, i) => o.classList.toggle('sel', i === this.sel))
  }

  private pick(i: number): void {
    const c = this.choose
    if (!c) return
    this.choose = null
    this.choiceEl.classList.remove('show')
    this.cooldown = 0.3
    c(i)
  }

  private showLine(): void {
    const [who, t] = this.lines[this.index]!
    this.dlg.classList.toggle('narration', who === null)
    this.dlgName.textContent = who ?? ''
    this.dlgName.classList.toggle('ilo', who === 'Ilo')
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
    const cam = this.ctx.camera
    this.v.set(p.x, p.y, p.z).project(cam)
    const offscreen = this.v.z > 1 || Math.abs(this.v.x) > 1.1 || Math.abs(this.v.y) > 1.1
    if (offscreen || (!this.bubbleThroughWalls && hiddenFrom(this.ctx.physics, cam.position, p))) {
      this.bubble.classList.remove('show')
      return
    }
    this.placeBubble(((this.v.x + 1) / 2) * this.root.clientWidth, ((1 - this.v.y) / 2) * this.root.clientHeight)
    this.bubble.classList.toggle('show', this.bubbleLeft > 0.4)
  }

  private placeBubble(anchorX: number, anchorY: number): void {
    const w = this.root.clientWidth
    const h = this.root.clientHeight
    const bw = this.bubble.offsetWidth
    const bh = this.bubble.offsetHeight
    const clampTop = (t: number) => Math.min(h - bh - BUBBLE_MARGIN, Math.max(BUBBLE_MARGIN, t))
    const left = Math.min(w - bw - BUBBLE_MARGIN, Math.max(BUBBLE_MARGIN, anchorX - bw / 2))
    let top = clampTop(anchorY - bh)
    const others = shownBubbles(this.ctx.uiRoot, this.root, this.bubble)
      .filter((r) => r.r > left && r.l < left + bw)
      .sort((a, b) => b.t - a.t)
    for (const r of others) {
      if (top >= r.b + BUBBLE_GAP || top + bh <= r.t - BUBBLE_GAP) continue
      const above = r.t - BUBBLE_GAP - bh
      top = above >= BUBBLE_MARGIN ? above : clampTop(r.b + BUBBLE_GAP)
    }
    this.bubble.style.transform = `translate(${left}px, ${top}px)`
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.resolve?.()
    this.resolve = null
    this.choose?.(0)
    this.choose = null
    this.root.remove()
    this.style.remove()
  }
}
