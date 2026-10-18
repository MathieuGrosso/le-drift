import * as THREE from 'three'

type Stroke = readonly number[]
export interface Drawing { strokes: Stroke[]; text?: string; textY?: number; mirror?: boolean }

const TAU = Math.PI * 2

function circle(cx: number, cy: number, rx: number, ry = rx, a0 = 0, a1 = TAU, n = 20): Stroke {
  const out: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)
  }
  return out
}

function stickman(x: number, y: number, s: number, extra: Stroke[] = []): Stroke[] {
  return [
    circle(x, y - 0.17 * s, 0.05 * s),
    [x, y - 0.12 * s, x, y + 0.02 * s],
    [x - 0.07 * s, y + 0.12 * s, x, y + 0.02 * s, x + 0.07 * s, y + 0.12 * s],
    [x - 0.08 * s, y - 0.06 * s, x, y - 0.08 * s, x + 0.08 * s, y - 0.06 * s],
    ...extra,
  ]
}

const fish = (cx: number, cy: number, s: number): Stroke[] => [
  circle(cx, cy, 0.14 * s, 0.07 * s),
  [cx + 0.13 * s, cy, cx + 0.23 * s, cy - 0.07 * s, cx + 0.23 * s, cy + 0.07 * s, cx + 0.13 * s, cy],
  circle(cx - 0.07 * s, cy - 0.015 * s, 0.012 * s, 0.012 * s, 0, TAU, 6),
]

const heart = (cx: number, cy: number, s: number): Stroke => {
  const out: number[] = []
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * TAU
    out.push(cx + 0.016 * s * 16 * Math.sin(t) ** 3, cy - 0.016 * s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)))
  }
  return out
}

const brush = (x: number, y: number, len: number): Stroke[] => [
  [x, y, x + len * 0.7, y - len * 0.7],
  circle(x + len * 0.78, y - len * 0.78, len * 0.12),
]

export const DRAWINGS = {
  bonjour: { strokes: [], text: 'BONJOUR', mirror: true },
  'de-rien': { strokes: [], text: 'DE RIEN' },
  frottoir: { strokes: [...stickman(0.32, 0.6, 1.2), ...brush(0.38, 0.6, 0.45)] },
  chose: {
    strokes: [
      circle(0.4, 0.45, 0.07, 0.1),
      [0.34, 0.42, 0.12, 0.3, 0.06, 0.42, 0.2, 0.44],
      [0.46, 0.42, 0.68, 0.3, 0.74, 0.42, 0.6, 0.44],
      ...fish(0.4, 0.66, 0.5),
      [0.8, 0.3, 0.84, 0.22, 0.9, 0.24, 0.9, 0.33, 0.84, 0.4, 0.84, 0.5], circle(0.84, 0.6, 0.012),
    ],
  },
  nord: {
    strokes: [[0.25, 0.85, 0.28, 0.65, 0.34, 0.5, 0.44, 0.38, 0.56, 0.3], [0.4, 0.85, 0.44, 0.66, 0.52, 0.52, 0.64, 0.42], [0.62, 0.22, 0.8, 0.22, 0.74, 0.16], [0.8, 0.22, 0.74, 0.28]],
    text: 'NORD →', textY: 0.12,
  },
  'ce-soir': {
    strokes: [circle(0.5, 0.62, 0.3, 0.3, Math.PI, TAU, 16), [0.18, 0.62, 0.82, 0.62], ...stickman(0.42, 0.5, 0.6), ...stickman(0.58, 0.5, 0.6)],
    text: 'CE SOIR ?', textY: 0.9,
  },
  blanc: { strokes: [[0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75, 0.2, 0.25], [0.05, 0.5, 0.45, 0.5]], text: 'LA PREMIÈRE ?', textY: 0.9 },
  morpion: { strokes: [[0.38, 0.2, 0.38, 0.8], [0.62, 0.2, 0.62, 0.8], [0.2, 0.4, 0.8, 0.4], [0.2, 0.6, 0.8, 0.6], circle(0.5, 0.5, 0.07)] },
  gerard: { strokes: fish(0.45, 0.45, 1.6), text: 'GÉRARD', textY: 0.82 },
  meteo: { strokes: [[0.2, 0.2, 0.8, 0.2, 0.8, 0.62, 0.2, 0.62, 0.2, 0.2]], text: 'VISIBILITÉ : TOI', textY: 0.8 },
  plafond: { strokes: [[0.1, 0.25, 0.9, 0.25], circle(0.35, 0.25, 0.08, 0.03), circle(0.35, 0.25, 0.16, 0.06), circle(0.65, 0.25, 0.06, 0.02), ...stickman(0.5, 0.75, 0.8)], text: '?', textY: 0.55 },
} satisfies Record<string, Drawing>

export const REPLIES = {
  'bonjour-envers': { strokes: [], text: 'BONJOUR', mirror: true },
  poisson: { strokes: fish(0.5, 0.5, 1.8) },
  ronds: { strokes: [circle(0.5, 0.5, 0.3), circle(0.5, 0.5, 0.2), circle(0.5, 0.5, 0.1)] },
  camille: { strokes: [...stickman(0.5, 0.6, 1.2, [[0.45, 0.42, 0.4, 0.6], [0.55, 0.42, 0.6, 0.6]]), [0.62, 0.58, 0.75, 0.5], [0.62, 0.62, 0.75, 0.7]] },
  'grande-brosse': { strokes: [...stickman(0.2, 0.75, 0.6), ...brush(0.24, 0.75, 0.8)] },
  merci: { strokes: [], text: 'MERCI' },
  question: { strokes: [[0.42, 0.3, 0.46, 0.2, 0.56, 0.2, 0.6, 0.3, 0.52, 0.42, 0.52, 0.56], circle(0.52, 0.7, 0.015)] },
  'un-poisson': { strokes: [], text: 'UN POISSON' },
  ronds2: { strokes: [[0.1, 0.25, 0.9, 0.25], circle(0.3, 0.25, 0.1, 0.04), circle(0.6, 0.25, 0.14, 0.05), circle(0.8, 0.25, 0.06, 0.02)] },
  fleche: { strokes: [[0.2, 0.5, 0.8, 0.5], [0.66, 0.38, 0.8, 0.5, 0.66, 0.62]], text: 'NORD', textY: 0.8 },
  carte: { strokes: [...stickman(0.3, 0.6, 1), [0.45, 0.62, 0.85, 0.62, 0.85, 0.82, 0.45, 0.82, 0.45, 0.62], [0.5, 0.7, 0.65, 0.74, 0.8, 0.68]] },
  'algue-yeux': { strokes: [[0.5, 0.9, 0.45, 0.7, 0.55, 0.5, 0.48, 0.3], circle(0.44, 0.3, 0.03), circle(0.54, 0.3, 0.03)] },
  oui: { strokes: [], text: 'OUI' },
  deux: { strokes: [...stickman(0.4, 0.6, 1), ...stickman(0.6, 0.6, 1), [0.3, 0.2, 0.7, 0.2]] },
  bol: { strokes: [circle(0.5, 0.5, 0.25, 0.2, 0, Math.PI, 12), [0.25, 0.5, 0.75, 0.5], [0.42, 0.4, 0.45, 0.28], [0.55, 0.4, 0.58, 0.28]] },
  'avec-toi': { strokes: [], text: 'AVEC TOI' },
  'deux-lignes': { strokes: [[0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75, 0.2, 0.25], [0.05, 0.45, 0.45, 0.45], [0.05, 0.55, 0.45, 0.55]] },
  coin: { strokes: [[0.22, 0.22, 0.34, 0.34], [0.34, 0.22, 0.22, 0.34]] },
  bord: { strokes: [[0.44, 0.22, 0.56, 0.34], [0.56, 0.22, 0.44, 0.34]] },
  poissons: { strokes: [...fish(0.3, 0.3, 0.4), ...fish(0.5, 0.5, 0.4), ...fish(0.7, 0.7, 0.4), ...fish(0.7, 0.3, 0.4), ...fish(0.3, 0.7, 0.4)] },
  ami: { strokes: [...fish(0.6, 0.6, 0.9), heart(0.3, 0.3, 0.6)] },
  'bonjour-gerard': { strokes: [], text: 'SALUT GÉRARD' },
  requin: { strokes: fish(0.5, 0.5, 2.6) },
  'meteo-toi': { strokes: [], text: 'COURANT : TOI' },
  soleil: { strokes: [circle(0.5, 0.5, 0.15), [0.5, 0.2, 0.5, 0.28], [0.5, 0.72, 0.5, 0.8], [0.2, 0.5, 0.28, 0.5], [0.72, 0.5, 0.8, 0.5]] },
  vide: { strokes: [[0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75, 0.2, 0.25]] },
} satisfies Record<string, Drawing>

export type DrawingId = keyof typeof DRAWINGS
export type ReplyId = keyof typeof REPLIES

const strokeLength = (s: Stroke) => {
  let l = 0
  for (let i = 2; i < s.length; i += 2) l += Math.hypot(s[i]! - s[i - 2]!, s[i + 1]! - s[i - 1]!)
  return l
}

export type Ink = 'buee' | 'plancton'

// One canvas on the glass. `progress` reveals strokes then text, like a finger moving.
export class GlassDrawing {
  readonly mesh: THREE.Mesh
  private readonly canvas = document.createElement('canvas')
  private readonly g: CanvasRenderingContext2D
  private readonly tex: THREE.CanvasTexture
  private drawing: Drawing | null = null
  private shown = -1

  constructor(private readonly ink: Ink, size: number) {
    this.canvas.width = this.canvas.height = 256
    this.g = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      blending: ink === 'plancton' ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
    this.mesh.renderOrder = 6
    this.mesh.visible = false
  }

  set(d: Drawing | null): void {
    this.drawing = d
    this.shown = -1
    this.mesh.visible = d !== null
    this.paint(0)
  }

  paint(progress: number): void {
    const p = Math.round(Math.min(1, progress) * 60) / 60
    if (p === this.shown) return
    this.shown = p
    const g = this.g
    const W = 256
    g.clearRect(0, 0, W, W)
    const d = this.drawing
    if (!d) return
    if (this.ink === 'buee') {
      const grad = g.createRadialGradient(W / 2, W / 2, 10, W / 2, W / 2, W / 2)
      grad.addColorStop(0, `rgba(232,242,240,${0.85 * Math.min(1, p * 4)})`)
      grad.addColorStop(0.75, `rgba(232,242,240,${0.6 * Math.min(1, p * 4)})`)
      grad.addColorStop(1, 'rgba(226,240,236,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, W, W)
    }
    const total = d.strokes.reduce((a, s) => a + strokeLength(s), 0) + (d.text ? d.text.length * 0.06 : 0)
    const budget = p * total
    const stroke = () => {
      let b = budget
      g.lineCap = 'round'
      g.lineJoin = 'round'
      for (const s of d.strokes) {
        if (b <= 0) break
        g.beginPath()
        g.moveTo(s[0]! * W, s[1]! * W)
        for (let i = 2; i < s.length; i += 2) {
          const seg = Math.hypot(s[i]! - s[i - 2]!, s[i + 1]! - s[i - 1]!)
          if (b <= 0) break
          const t = Math.min(1, b / Math.max(seg, 1e-6))
          g.lineTo((s[i - 2]! + (s[i]! - s[i - 2]!) * t) * W, (s[i - 1]! + (s[i + 1]! - s[i - 1]!) * t) * W)
          b -= seg
        }
        g.stroke()
      }
      return b
    }
    if (this.ink === 'buee') {
      g.globalCompositeOperation = 'destination-out'
      g.strokeStyle = 'rgba(0,0,0,0.9)'
      g.lineWidth = 11
      stroke()
      g.globalCompositeOperation = 'source-over'
      g.strokeStyle = 'rgba(40,70,82,0.5)'
      g.lineWidth = 8
      stroke()
      g.strokeStyle = 'rgba(255,255,255,0.4)'
      g.lineWidth = 2
    } else {
      g.shadowColor = 'rgba(158,240,200,0.9)'
      g.shadowBlur = 12
      g.strokeStyle = 'rgba(170,250,215,0.85)'
      g.lineWidth = 6
    }
    const rest = stroke()
    g.shadowBlur = 0
    if (d.text && rest > 0) {
      const chars = Math.min(d.text.length, Math.floor(rest / 0.06) + 1)
      const txt = d.text.slice(0, chars)
      g.save()
      const y = (d.textY ?? 0.5) * W
      if (d.mirror) {
        g.translate(W, 0)
        g.scale(-1, 1)
      }
      const size = d.text.length > 12 ? 23 : d.text.length > 9 ? 28 : d.text.length > 6 ? 38 : 50
      g.font = `700 ${size}px ui-rounded, 'Nunito', system-ui, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const x0 = W / 2 - g.measureText(d.text).width / 2
      g.textAlign = 'left'
      if (this.ink === 'buee') {
        g.globalCompositeOperation = 'destination-out'
        g.fillStyle = 'rgba(0,0,0,0.9)'
        g.fillText(txt, x0, y)
        g.globalCompositeOperation = 'source-over'
        g.fillStyle = 'rgba(40,70,82,0.5)'
        g.fillText(txt, x0, y)
        g.strokeStyle = 'rgba(255,255,255,0.4)'
        g.lineWidth = 1.5
        g.strokeText(txt, x0, y)
      } else {
        g.shadowColor = 'rgba(158,240,200,0.9)'
        g.shadowBlur = 10
        g.fillStyle = 'rgba(170,250,215,0.9)'
        g.fillText(txt, x0, y)
      }
      g.restore()
    }
    this.tex.needsUpdate = true
  }

  setOpacity(o: number): void {
    ;(this.mesh.material as THREE.MeshBasicMaterial).opacity = o
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.tex.dispose()
  }
}
