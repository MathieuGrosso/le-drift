import * as THREE from 'three'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('2d context unavailable')
  return [c, g]
}

function tex(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

function rnd(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

export function planksTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256)
  const r = rnd(7)
  const rows = 8
  for (let i = 0; i < rows; i++) {
    const y = (i * 256) / rows
    const base = 150 + r() * 40
    g.fillStyle = `rgb(${base + 26},${base - 22},${base - 70})`
    g.fillRect(0, y, 256, 256 / rows)
    for (let k = 0; k < 14; k++) {
      g.fillStyle = `rgba(90,60,70,${0.06 + r() * 0.08})`
      g.fillRect(r() * 256, y + r() * 28, 30 + r() * 80, 1 + r() * 2)
    }
    g.fillStyle = 'rgba(70,50,70,0.55)'
    g.fillRect(0, y, 256, 2)
    const cut = r() * 256
    g.fillRect(cut, y, 2, 256 / rows)
    g.fillStyle = 'rgba(60,40,40,0.5)'
    g.beginPath()
    g.arc(cut + 8, y + 16, 1.6, 0, Math.PI * 2)
    g.fill()
  }
  return tex(c)
}

export function gratingTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128)
  g.fillStyle = '#7c8190'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#5a5f72'
  for (let i = 0; i < 8; i++) {
    g.fillRect(0, i * 16 + 6, 128, 4)
    g.fillRect(i * 16 + 6, 0, 4, 128)
  }
  g.fillStyle = 'rgba(196,106,74,0.25)'
  g.fillRect(10, 70, 40, 30)
  g.fillRect(80, 12, 30, 22)
  return tex(c)
}

export function drawingsTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256)
  const papers = ['#f3ecd6', '#e8f0e6', '#f6e4d8']
  for (let i = 0; i < 3; i++) {
    const x0 = i * 170 + 4
    g.fillStyle = papers[i]!
    g.fillRect(x0, 4, 162, 248)
    g.lineWidth = 5
    g.lineCap = 'round'
    g.strokeStyle = '#2f4e7a'
    const cx = x0 + 81
    const cy = 120 + i * 6
    g.beginPath()
    g.moveTo(x0 + 6, cy - 10 - i * 8)
    g.quadraticCurveTo(cx - 40, cy - 60, cx, cy)
    g.quadraticCurveTo(cx + 40, cy - 60, x0 + 156, cy - 10 - i * 8)
    g.stroke()
    g.fillStyle = '#2f4e7a'
    g.beginPath()
    g.ellipse(cx, cy + 8, 14, 22, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#f6f2e8'
    g.beginPath()
    g.arc(cx + 4, cy - 2, 5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#12305a'
    g.beginPath()
    g.arc(cx + 5, cy - 2, 2.5, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#e8674a'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(cx - 6, cy + 30)
    g.lineTo(cx - 14, cy + 52)
    g.moveTo(cx + 6, cy + 30)
    g.lineTo(cx + 12, cy + 52)
    g.stroke()
    g.fillStyle = '#9fb8c8'
    g.beginPath()
    g.ellipse(cx, cy + 62, 14, 6, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#7cc6bf'
    g.lineWidth = 3
    for (let k = 0; k < 4; k++) {
      g.beginPath()
      g.moveTo(x0 + 10, 26 + k * 6)
      g.bezierCurveTo(x0 + 50, 18 + k * 6, x0 + 110, 34 + k * 6, x0 + 152, 24 + k * 6)
      g.stroke()
    }
    g.fillStyle = '#e8674a'
    g.font = 'bold 20px ui-rounded, system-ui, sans-serif'
    g.fillText(['LA CHOSE', 'ELLE REMONTE', 'OÙ ?'][i]!, x0 + 14, 230)
  }
  return tex(c, false)
}
