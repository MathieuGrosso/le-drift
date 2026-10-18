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

export function menuTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(384, 512)
  g.fillStyle = '#2f3a36'
  g.fillRect(0, 0, 384, 512)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(230,236,228,${Math.random() * 0.05})`
    g.fillRect(Math.random() * 384, Math.random() * 512, 2 + Math.random() * 30, 1 + Math.random() * 4)
  }
  g.strokeStyle = '#8a6448'
  g.lineWidth = 22
  g.strokeRect(11, 11, 362, 490)
  g.fillStyle = 'rgba(240,236,224,0.92)'
  g.textAlign = 'center'
  g.font = 'bold 40px "Comic Sans MS", "Chalkboard SE", ui-rounded, sans-serif'
  g.fillText('AU MENU', 192, 82)
  g.strokeStyle = 'rgba(240,236,224,0.7)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(96, 100)
  g.quadraticCurveTo(192, 110, 288, 98)
  g.stroke()
  g.font = '34px "Comic Sans MS", "Chalkboard SE", ui-rounded, sans-serif'
  const lines = ['Poisson.', 'Poisson.', 'Pain (?)']
  lines.forEach((t, i) => g.fillText(t, 192, 170 + i * 62))
  g.fillStyle = 'rgba(232,180,120,0.85)'
  g.font = 'italic 22px "Comic Sans MS", ui-rounded, sans-serif'
  g.fillText('— le cuistot', 230, 360)
  g.strokeStyle = 'rgba(159,214,208,0.85)'
  g.lineWidth = 4
  g.beginPath()
  g.ellipse(150, 430, 46, 20, 0, 0, Math.PI * 2)
  g.moveTo(196, 430)
  g.lineTo(226, 410)
  g.lineTo(226, 450)
  g.closePath()
  g.stroke()
  g.fillStyle = 'rgba(159,214,208,0.85)'
  g.beginPath()
  g.arc(126, 424, 4, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(240,236,224,0.6)'
  g.lineWidth = 3
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < 4; j++) {
      g.beginPath()
      g.moveTo(262 + k * 32 + j * 6, 410)
      g.lineTo(262 + k * 32 + j * 6, 448)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(258 + k * 32, 440)
    g.lineTo(286 + k * 32, 416)
    g.stroke()
  }
  return tex(c, false)
}
