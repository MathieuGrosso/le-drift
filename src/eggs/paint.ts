import * as THREE from 'three'

export const INK = '#4a3b2c'
export const PAPER = '#efe3c4'
export const ACCENT = '#e8674a'
export const SERIF = "'Fraunces', 'Iowan Old Style', Georgia, serif"
export const HAND = "'Caveat', 'Bradley Hand', 'Segoe Print', cursive"

export interface Canvas2D {
  canvas: HTMLCanvasElement
  g: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  w: number
  h: number
}

export function canvas2d(w: number, h: number): Canvas2D {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { canvas, g, texture, w, h }
}

export function paper(c: Canvas2D, color = PAPER, border = INK): void {
  const { g, w, h } = c
  g.clearRect(0, 0, w, h)
  g.fillStyle = color
  g.fillRect(0, 0, w, h)
  g.globalAlpha = 0.06
  for (let i = 0; i < 260; i++) {
    g.fillStyle = i % 2 ? '#000' : '#fff'
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1 + Math.random() * 2)
  }
  g.globalAlpha = 1
  g.strokeStyle = border
  g.lineWidth = Math.max(4, w * 0.012)
  g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2)
}

export function title(c: Canvas2D, text: string, y: number, size: number, color = INK): void {
  const { g, w } = c
  g.fillStyle = color
  g.font = `600 ${size}px ${SERIF}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  fitText(g, text, w * 0.86, size, `600 {s}px ${SERIF}`)
  g.fillText(text, w / 2, y)
}

export function lines(c: Canvas2D, list: readonly string[], y0: number, size: number, step: number, color = INK, font = HAND): void {
  const { g, w } = c
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  list.forEach((t, i) => {
    fitText(g, t, w * 0.86, size, `500 {s}px ${font}`)
    g.fillText(t, w / 2, y0 + i * step)
  })
}

function fitText(g: CanvasRenderingContext2D, text: string, max: number, size: number, pattern: string): void {
  let s = size
  g.font = pattern.replace('{s}', String(s))
  while (s > 10 && g.measureText(text).width > max) {
    s -= 2
    g.font = pattern.replace('{s}', String(s))
  }
}

export function stamp(c: Canvas2D, text: string): void {
  const { g, w, h } = c
  g.save()
  g.translate(w / 2, h * 0.58)
  g.rotate(-0.25)
  g.strokeStyle = ACCENT
  g.fillStyle = ACCENT
  g.lineWidth = 8
  g.font = `800 ${Math.round(w * 0.13)}px ${SERIF}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const tw = g.measureText(text).width
  g.globalAlpha = 0.85
  g.strokeRect(-tw / 2 - 18, -w * 0.09, tw + 36, w * 0.18)
  g.fillText(text, 0, 4)
  g.restore()
}

export function goat(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.fillStyle = color
  g.strokeStyle = color
  g.beginPath()
  g.ellipse(0, 0, 26, 15, 0, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.ellipse(28, -16, 10, 8, -0.5, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 5
  g.lineCap = 'round'
  for (const lx of [-16, -6, 8, 18]) {
    g.beginPath()
    g.moveTo(lx, 10)
    g.lineTo(lx, 30)
    g.stroke()
  }
  g.lineWidth = 4
  g.beginPath()
  g.moveTo(26, -22)
  g.quadraticCurveTo(20, -42, 8, -38)
  g.stroke()
  g.beginPath()
  g.moveTo(34, -10)
  g.lineTo(36, 2)
  g.stroke()
  g.restore()
}

export function frog(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.fillStyle = '#7fb069'
  g.beginPath()
  g.ellipse(0, 6, 22, 16, 0, 0, Math.PI * 2)
  g.fill()
  for (const ex of [-10, 10]) {
    g.fillStyle = '#7fb069'
    g.beginPath()
    g.arc(ex, -8, 8, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(ex, -8, 5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = INK
    g.beginPath()
    g.arc(ex + 2, -6, 2.4, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#e89a9a'
  g.globalAlpha = 0.6
  g.beginPath()
  g.arc(-13, 8, 4, 0, Math.PI * 2)
  g.arc(13, 8, 4, 0, Math.PI * 2)
  g.fill()
  g.restore()
}
