import * as THREE from 'three'
import { DRIFT_ROUTE, WORLD_HALF } from '../core/layout'
import type { GameContext } from '../core/types'

export class ChartTable {
  readonly texture: THREE.CanvasTexture
  private readonly own = document.createElement('canvas')
  private timer = 0
  private source: HTMLCanvasElement | null = null

  constructor() {
    this.own.width = 512
    this.own.height = 352
    this.drawFallback()
    this.texture = new THREE.CanvasTexture(this.own)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
  }

  private drawFallback(): void {
    const g = this.own.getContext('2d')
    if (!g) return
    const w = this.own.width
    const h = this.own.height
    g.fillStyle = '#efe3c4'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(120,90,60,${Math.random() * 0.05})`
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    const map = (x: number, z: number) => [((x + WORLD_HALF) / (WORLD_HALF * 2)) * w, ((z + WORLD_HALF) / (WORLD_HALF * 2)) * h] as const
    g.strokeStyle = 'rgba(94,74,92,0.35)'
    g.lineWidth = 1
    for (let r = 1; r < 9; r++) {
      g.beginPath()
      g.ellipse(w * 0.5, h * 0.62, r * 26, r * 15, 0.2, 0, Math.PI * 2)
      g.stroke()
    }
    const grad = g.createLinearGradient(0, 0, 0, h * 0.3)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h * 0.3)
    g.strokeStyle = '#7a5a3a'
    g.lineWidth = 5
    g.lineCap = 'round'
    g.beginPath()
    DRIFT_ROUTE.forEach((p, i) => {
      const [x, y] = map(p.x, p.z)
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    })
    g.stroke()
    g.strokeStyle = 'rgba(122,90,58,0.45)'
    g.lineWidth = 9
    g.beginPath()
    g.ellipse(w * 0.52, h * 0.66, w * 0.3, h * 0.22, 0, 0, Math.PI * 2)
    g.stroke()
  }

  update(dt: number, ctx: GameContext, visible: boolean): void {
    this.timer -= dt
    if (!visible || this.timer > 0) return
    this.timer = 1
    let c: HTMLCanvasElement | null = null
    try {
      c = ctx.services.gameplay?.chartCanvas() ?? null
    } catch {
      c = null
    }
    if (c && c.width > 0 && c.height > 0) {
      if (this.source !== c) {
        this.source = c
        this.texture.dispose()
        this.texture.image = c
      }
      this.texture.needsUpdate = true
    } else if (this.source) {
      this.source = null
      this.texture.dispose()
      this.texture.image = this.own
      this.texture.needsUpdate = true
    }
  }
}
