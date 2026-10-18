import * as THREE from 'three'
import type { GameContext } from '../core/types'
import { CHATTER } from './text'

interface Bubble { el: HTMLDivElement; npc: string; world: THREE.Vector3; until: number }

const STYLE = `
.drift-bulles { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.drift-bulle {
  position: absolute; transform: translate(-50%, -100%); max-width: 240px; padding: 7px 12px;
  border-radius: 14px; background: rgba(246, 242, 232, 0.92); color: #3e3a5a;
  font: 15px/1.3 ui-rounded, "SF Pro Rounded", system-ui, sans-serif; text-align: center;
  box-shadow: 0 4px 14px rgba(14, 59, 82, 0.25); opacity: 0; transition: opacity 0.35s ease;
  pointer-events: none; white-space: normal;
}
.drift-bulle.on { opacity: 1; }
.drift-bulle::after {
  content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -7px;
  border: 7px solid transparent; border-bottom: 0; border-top-color: rgba(246, 242, 232, 0.92);
}`

export class Chatter {
  private readonly root = document.createElement('div')
  private readonly bubbles: Bubble[] = []
  private readonly cooldown = new Map<string, number>()
  private nextAt = 3
  private time = 0
  private talking = false
  private readonly offs: (() => void)[] = []
  private readonly v = new THREE.Vector3()

  constructor(private readonly ctx: GameContext) {
    this.root.className = 'drift-bulles'
    const style = document.createElement('style')
    style.textContent = STYLE
    this.root.appendChild(style)
    ctx.uiRoot.appendChild(this.root)
    this.offs.push(ctx.bus.on('dialogue:start', () => {
      this.talking = true
      this.clear()
    }))
    this.offs.push(ctx.bus.on('dialogue:end', () => {
      this.talking = false
    }))
  }

  private clear(): void {
    for (const b of this.bubbles.splice(0)) b.el.remove()
  }

  pool(npcId: string, key: string, dirtyWindow: boolean): readonly string[] {
    const s = this.ctx.state
    if (npcId === 'grand-pere') return s.act >= 2 && Math.random() < 0.5 ? CHATTER['grand-pere-nord']! : CHATTER['grand-pere']!
    if (CHATTER[npcId]) return CHATTER[npcId]!
    if (key === 'enfant') return CHATTER.enfant!
    if (key.startsWith('ville-')) return s.act >= 2 && Math.random() < 0.25 ? CHATTER.nord! : CHATTER[key] ?? CHATTER.coursive!
    if (s.act >= 3 && Math.random() < 0.35) return CHATTER.blanc!
    if (s.act >= 2 && Math.random() < 0.3) return CHATTER.nord!
    if (key.startsWith('banc')) return dirtyWindow && Math.random() < 0.6 ? CHATTER['repas-vitre-sale']! : CHATTER.repas!
    if (key.startsWith('hublot')) return CHATTER.hublot!
    if (key.includes('marche') || key.startsWith('etal')) return CHATTER.marche!
    if (key.startsWith('voisin')) return CHATTER.voisins!
    return CHATTER.coursive!
  }

  update(dt: number, indoor: boolean, near: { id: string; world: THREE.Vector3; key: string; height: number }[], dirtyWindow: boolean): void {
    this.time += dt
    const cam = this.ctx.camera
    const w = window.innerWidth
    const h = window.innerHeight
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!
      const n = near.find((q) => q.id === b.npc)
      if (n) b.world.copy(n.world).y += n.height
      this.v.copy(b.world).project(cam)
      const behind = this.v.z > 1
      b.el.style.left = `${((this.v.x + 1) / 2) * w}px`
      b.el.style.top = `${((1 - this.v.y) / 2) * h}px`
      b.el.style.visibility = behind ? 'hidden' : 'visible'
      if (this.time > b.until || !indoor) {
        b.el.classList.remove('on')
        if (this.time > b.until + 0.5 || !indoor) {
          b.el.remove()
          this.bubbles.splice(i, 1)
        }
      }
    }
    if (!indoor || this.talking || this.time < this.nextAt || this.bubbles.length >= 2 || near.length === 0) return
    const cands = near.filter((n) => (this.cooldown.get(n.id) ?? -1e9) < this.time && !this.bubbles.some((b) => b.npc === n.id))
    if (cands.length === 0) return
    const n = cands[Math.floor(Math.random() * cands.length)]!
    const lines = this.pool(n.id, n.key, dirtyWindow)
    const text = lines[Math.floor(Math.random() * lines.length)]!
    const el = document.createElement('div')
    el.className = 'drift-bulle'
    el.textContent = text
    this.root.appendChild(el)
    requestAnimationFrame(() => el.classList.add('on'))
    this.bubbles.push({ el, npc: n.id, world: n.world.clone().setY(n.world.y + n.height), until: this.time + 4.5 })
    this.cooldown.set(n.id, this.time + 25)
    this.nextAt = this.time + 5 + Math.random() * 4
  }

  dispose(): void {
    for (const off of this.offs) off()
    this.clear()
    this.root.remove()
  }
}
