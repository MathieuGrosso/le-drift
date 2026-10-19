import * as THREE from 'three'
import { NET } from '../core/tuning'
import { el, hexColor } from './style'

interface Label { tag: HTMLDivElement | null; bubble: HTMLDivElement | null; bubbleUntil: number; world: THREE.Vector3; seen: boolean }

const TAG_LIFT = 0.35
const BUBBLE_LIFT = 0.75
const OFFSCREEN = 1.2

/** Name tags and speech bubbles projected over avatars and NPCs; plain text only, never HTML. */
export class Overlay {
  private readonly root: HTMLDivElement
  private readonly labels = new Map<string, Label>()
  private readonly v = new THREE.Vector3()

  constructor(parent: HTMLElement, private readonly camera: THREE.Camera) {
    this.root = el('div', 'net-tags')
    parent.appendChild(this.root)
  }

  /** Call every frame for each live anchor (a head position); an unmarked tag goes at `flush`, a bubble lives out its time. */
  mark(key: string, world: THREE.Vector3, name: string | null, color = 0): void {
    const l = this.label(key)
    l.world.copy(world)
    l.seen = true
    if (name === null) return
    if (!l.tag) {
      l.tag = el('div', 'net-tag')
      l.tag.append(el('i'), document.createTextNode(''))
      this.root.appendChild(l.tag)
    }
    const dot = l.tag.firstChild as HTMLElement
    const text = l.tag.lastChild as Text
    if (text.data !== name) text.data = name
    dot.style.background = hexColor(color)
  }

  say(key: string, world: THREE.Vector3, text: string, now: number): void {
    const l = this.label(key)
    l.world.copy(world)
    if (!l.bubble) {
      l.bubble = el('div', 'drift-bulle')
      this.root.appendChild(l.bubble)
    }
    l.bubble.textContent = text
    l.bubbleUntil = now + NET.chatBubbleSeconds
    const b = l.bubble
    requestAnimationFrame(() => b.classList.add('on'))
  }

  flush(now: number, eye: THREE.Vector3): void {
    for (const [key, l] of this.labels) {
      if (!l.seen) {
        l.tag?.remove()
        l.tag = null
      }
      l.seen = false
      if (l.bubble && now > l.bubbleUntil) {
        l.bubble.remove()
        l.bubble = null
      }
      if (!l.tag && !l.bubble) {
        this.labels.delete(key)
        continue
      }
      if (l.tag) {
        this.place(l.tag, l.world, TAG_LIFT)
        l.tag.style.opacity = eye.distanceTo(l.world) > NET.nameTagMaxDistance ? '0' : '1'
      }
      if (l.bubble) this.place(l.bubble, l.world, BUBBLE_LIFT)
    }
  }

  clear(): void {
    this.root.replaceChildren()
    this.labels.clear()
  }

  dispose(): void {
    this.clear()
    this.root.remove()
  }

  private place(e: HTMLElement, world: THREE.Vector3, lift: number): void {
    this.v.copy(world).setY(world.y + lift).project(this.camera)
    const hidden = this.v.z > 1 || Math.abs(this.v.x) > OFFSCREEN || Math.abs(this.v.y) > OFFSCREEN
    e.style.left = `${((this.v.x + 1) / 2) * window.innerWidth}px`
    e.style.top = `${((1 - this.v.y) / 2) * window.innerHeight}px`
    e.style.visibility = hidden ? 'hidden' : 'visible'
  }

  private label(key: string): Label {
    let l = this.labels.get(key)
    if (!l) {
      l = { tag: null, bubble: null, bubbleUntil: 0, world: new THREE.Vector3(), seen: true }
      this.labels.set(key, l)
    }
    return l
  }
}
