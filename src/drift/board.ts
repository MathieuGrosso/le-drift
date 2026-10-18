import * as THREE from 'three'
import type { EnvState } from '../core/types'
import { BOARD, DIRECTIONS } from './text'

export function currentLabel(env: EnvState): string {
  const c = env.current
  const speed = Math.hypot(c.x, c.z)
  if (speed < 0.02) return BOARD.courantNul
  const from = Math.atan2(-c.x, c.z)
  const idx = ((Math.round(from / (Math.PI / 4)) % 8) + 8) % 8
  return BOARD.courant(DIRECTIONS[idx]!)
}

export function forecastLines(env: EnvState): string[] {
  const lines = [BOARD.visibilite(env.visibility), currentLabel(env), BOARD.meduses(env.jellyfish)]
  if (env.bloom > 0.3) lines.push(BOARD.plancton)
  if (env.rain > 0) lines.push(BOARD.pluie)
  return lines
}

export class ForecastBoard {
  readonly canvas = document.createElement('canvas')
  readonly texture: THREE.CanvasTexture
  private last = ''

  constructor() {
    this.canvas.width = 512
    this.canvas.height = 296
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
  }

  draw(env: EnvState, day: number): void {
    const lines = forecastLines(env)
    const key = `${day}|${lines.join('|')}`
    if (key === this.last) return
    this.last = key
    const g = this.canvas.getContext('2d')
    if (!g) return
    const w = this.canvas.width
    const h = this.canvas.height
    g.fillStyle = '#24453f'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`
      g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 120, 6 + Math.random() * 14)
    }
    g.fillStyle = '#f6f2e8'
    g.textBaseline = 'top'
    g.font = 'bold 40px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    g.fillText(BOARD.titre, 28, 20)
    g.font = '26px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    g.fillStyle = '#ffc98a'
    g.fillText(BOARD.jour(day), w - 28 - g.measureText(BOARD.jour(day)).width, 30)
    g.strokeStyle = 'rgba(246,242,232,0.6)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(28, 74)
    g.lineTo(w - 28, 78)
    g.stroke()
    g.fillStyle = '#f6f2e8'
    g.font = '32px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    lines.forEach((l, i) => g.fillText(`· ${l}`, 30, 96 + i * 44))
    g.font = 'italic 20px ui-rounded, system-ui, sans-serif'
    g.fillStyle = 'rgba(246,242,232,0.7)'
    g.fillText(BOARD.signature, w - 28 - g.measureText(BOARD.signature).width, h - 34)
    this.texture.needsUpdate = true
  }
}
