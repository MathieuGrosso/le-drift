import { BLANC_SLOPE, DISTRICTS, DISTRICT_BY_ID, DRIFT_ROUTE, GRANDE_VITRE, LANDMARKS, LANES, NEF_VOID, QUARTER_ROOMS, REGIONS, WORLD_HALF } from '../../core/layout'
import type { DistrictId, RegionId } from '../../core/types'
import type { Chart, Gp } from '../context'
import { DOME_DISTRICT, MAP_DOMES, PLAN_FALLBACK, SCELLEES } from '../world/sites'
import { DISTRICT_NAMES, DOME_NAMES, SCELLEE_TEXT, STATION_NAMES, UI } from '../text/fr'
import { button, h } from './dom'

const SIZE = 1024
const GRID = 256
const CELL = SIZE / GRID
const STEP_M = (WORLD_HALF * 2) / GRID
const PW = 1040
const PH = 640
const PPM = 4
const INK = '#4a3b2c'
const INK_SOFT = 'rgba(74,59,44,0.55)'
const SEA_INK = '#2f6b78'
const HERO_INK = '#d0563c'
const SERIF = "'Fraunces', 'Iowan Old Style', Palatino, Georgia, serif"
const HAND = "'Caveat', 'Bradley Hand', 'Segoe Print', 'Snell Roundhand', cursive"

const REGION_LABELS: Record<Exclude<RegionId, 'bleu' | 'blanc'>, string> = {
  prairie: "La Prairie de l'Écluse",
  laminaires: 'La Forêt de Laminaires',
  pilier: 'Le Pilier et les Arches',
  cheminee: 'La Cheminée',
  coques: 'Le Cimetière des Coques',
}

export const toChart = (x: number, z: number) => ({ x: (x + WORLD_HALF) / 2, y: (z + WORLD_HALF) / 2 })
const toPlan = (x: number, z: number) => ({ x: (x + 130) * PPM, y: (z + 80) * PPM })

type District = (typeof DISTRICTS)[number]
interface Box { x0: number; y0: number; x1: number; y1: number }
const PLAN_ORDER: readonly DistrictId[] = ['machines', 'marche', 'serres', 'ateliers', 'scellees', 'nef', 'proue', 'ecluse']
// An unsurveyed district mostly under later ones (the machine well under the Nef) gets no frame of its own.
const HIDDEN_SHARE = 0.6
const LABEL_STEP = 6

const planBox = (d: District): Box => {
  const a = toPlan(d.x0, d.z0)
  const b = toPlan(d.x1, d.z1)
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
const hits = (a: Box, b: Box) => overlap(a, b) > 0
const drawnAfter = (id: DistrictId) => PLAN_ORDER.slice(PLAN_ORDER.indexOf(id) + 1).map((k) => planBox(DISTRICT_BY_ID[k]))

function gauss(dx: number, dz: number, r: number) {
  return Math.exp(-(dx * dx + dz * dz) / (2 * r * r))
}

function fallbackHeight(x: number, z: number): number {
  let y = 14 + 6 * Math.sin(x / 97 + 1.3) * Math.cos(z / 131) + 4 * Math.sin((x + z) / 53) + 3 * Math.cos(x / 41 - z / 67)
  y += 80 * gauss(x, z, 45) + 30 * gauss(x + 260, z - 760, 70)
  y += 25 * gauss(x - 820, z - 380, 120) + 18 * gauss(x - 560, z + 520, 140)
  if (z < BLANC_SLOPE.zStart) {
    const t = Math.min(1, (BLANC_SLOPE.zStart - z) / (BLANC_SLOPE.zStart - BLANC_SLOPE.zEnd))
    y = Math.max(y, BLANC_SLOPE.yStart + (BLANC_SLOPE.yEnd - BLANC_SLOPE.yStart) * t + 3 * Math.sin(x / 23))
  }
  return y
}

const SEGMENTS: readonly (readonly (readonly [number, number])[])[] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[3, 2]], [[0, 2]], [[0, 1], [3, 2]], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
]

function canvas2d(w: number, hgt: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = hgt
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas 2d indisponible')
  return [c, g]
}

function paperOn(g: CanvasRenderingContext2D, w: number, hgt: number, rng: () => number): void {
  g.fillStyle = '#efe3c4'
  g.fillRect(0, 0, w, hgt)
  const [grain, gg] = canvas2d(256, 256)
  const img = gg.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng()
    img.data[i] = 120
    img.data[i + 1] = 96
    img.data[i + 2] = 60
    img.data[i + 3] = Math.floor(v * v * 26)
  }
  gg.putImageData(img, 0, 0)
  g.globalAlpha = 0.9
  for (let y = 0; y < hgt; y += 256) for (let x = 0; x < w; x += 256) g.drawImage(grain, x, y)
  g.globalAlpha = 1
  for (let i = 0; i < 9; i++) {
    const x = rng() * w
    const y = rng() * hgt
    const r = 30 + rng() * 120
    const s = g.createRadialGradient(x, y, r * 0.2, x, y, r)
    s.addColorStop(0, 'rgba(176,140,90,0.10)')
    s.addColorStop(1, 'rgba(176,140,90,0)')
    g.fillStyle = s
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const v = g.createRadialGradient(w / 2, hgt / 2, Math.min(w, hgt) * 0.35, w / 2, hgt / 2, Math.max(w, hgt) * 0.75)
  v.addColorStop(0, 'rgba(120,90,50,0)')
  v.addColorStop(1, 'rgba(120,90,50,0.28)')
  g.fillStyle = v
  g.fillRect(0, 0, w, hgt)
}

function seeded(seed: number): () => number {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

export function createChart(gp: Gp, root: HTMLElement): Chart {
  const ctx = gp.ctx
  const [out, g] = canvas2d(SIZE, SIZE)
  const [paper, pg] = canvas2d(SIZE, SIZE)
  const [ink, ig] = canvas2d(SIZE, SIZE)
  const [plan, lg] = canvas2d(PW, PH)
  const [planPaper, ppg] = canvas2d(PW, PH)
  const rng = ctx.rng('carte')
  const reveal = new Map<DistrictId, number>()
  let lineProgress = -1
  let openEl: HTMLElement | null = null
  let overlay: CanvasRenderingContext2D | null = null
  let overlayCanvas: HTMLCanvasElement | null = null
  let side: 'mer' | 'plan' = 'plan'
  let dirty = true
  let planDirty = true

  const heightAt = (x: number, z: number) => ctx.services.world?.heightAt(x, z) ?? fallbackHeight(x, z)

  const drawInk = () => {
    const n = GRID + 1
    const hs = new Float32Array(n * n)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = heightAt(-WORLD_HALF + i * STEP_M, -WORLD_HALF + j * STEP_M)
    const [wash, wg] = canvas2d(GRID, GRID)
    const img = wg.createImageData(GRID, GRID)
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const y = hs[j * n + i]!
        const deep = Math.max(0, Math.min(1, (70 - y) / 70))
        const k = (j * GRID + i) * 4
        img.data[k] = 58
        img.data[k + 1] = 140
        img.data[k + 2] = 152
        img.data[k + 3] = Math.floor(deep * deep * 80)
      }
    }
    wg.putImageData(img, 0, 0)
    ig.drawImage(wash, 0, 0, SIZE, SIZE)
    const levels = new Map<number, Path2D>()
    const LEVEL = 6
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = hs[j * n + i]!
        const b = hs[j * n + i + 1]!
        const c = hs[(j + 1) * n + i + 1]!
        const d = hs[(j + 1) * n + i]!
        const lo = Math.min(a, b, c, d)
        const hi = Math.max(a, b, c, d)
        for (let L = Math.ceil(lo / LEVEL) * LEVEL; L < hi; L += LEVEL) {
          const idx = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0)
          const segs = SEGMENTS[idx]!
          if (segs.length === 0) continue
          const edge = (e: number): [number, number] => {
            switch (e) {
              case 0: return [i + (L - a) / (b - a), j]
              case 1: return [i + 1, j + (L - b) / (c - b)]
              case 2: return [i + (L - d) / (c - d), j + 1]
              default: return [i, j + (L - a) / (d - a)]
            }
          }
          let p = levels.get(L)
          if (!p) levels.set(L, (p = new Path2D()))
          for (const [e1, e2] of segs) {
            const [x1, y1] = edge(e1)
            const [x2, y2] = edge(e2)
            p.moveTo(x1 * CELL, y1 * CELL)
            p.lineTo(x2 * CELL, y2 * CELL)
          }
        }
      }
    }
    ig.lineCap = 'round'
    for (const [L, p] of levels) {
      const major = L % 30 === 0
      ig.strokeStyle = major ? 'rgba(74,59,44,0.62)' : 'rgba(74,59,44,0.28)'
      ig.lineWidth = major ? 1.6 : 0.9
      ig.stroke(p)
    }
    ig.setLineDash([10, 8])
    ig.strokeStyle = SEA_INK
    ig.lineWidth = 2
    for (const lane of LANES) {
      ig.beginPath()
      lane.points.forEach((pt, k) => {
        const c = toChart(pt.x, pt.z)
        if (k === 0) ig.moveTo(c.x, c.y)
        else ig.lineTo(c.x, c.y)
      })
      ig.stroke()
    }
    ig.setLineDash([])
    const vent = toChart(LANDMARKS.panache.x, LANDMARKS.panache.z)
    ig.strokeStyle = '#b8603a'
    ig.lineWidth = 1.8
    for (let k = 0; k < 3; k++) {
      ig.beginPath()
      ig.arc(vent.x, vent.y, 6 + k * 7, 0.3 * k, Math.PI * 1.6 + 0.3 * k)
      ig.stroke()
    }
    ig.textAlign = 'center'
    for (const [id, nom] of Object.entries(REGION_LABELS) as [keyof typeof REGION_LABELS, string][]) {
      const c = REGIONS[id]
      const p = toChart(c.x, c.z)
      ig.font = `italic 22px ${SERIF}`
      ig.fillStyle = 'rgba(74,59,44,0.8)'
      ig.fillText(nom, p.x, p.y - 28)
    }
    ig.textAlign = 'start'
    const edge = toChart(0, BLANC_SLOPE.zStart).y
    const fade = ig.createLinearGradient(0, edge - 24, 0, edge + 6)
    fade.addColorStop(0, 'rgba(0,0,0,1)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    ig.globalCompositeOperation = 'destination-out'
    ig.fillStyle = fade
    ig.fillRect(0, 0, SIZE, edge + 6)
    ig.globalCompositeOperation = 'source-over'
  }

  const drawRoute = () => {
    const pts = DRIFT_ROUTE.map((w) => toChart(w.x, w.z))
    const groove = new Path2D()
    pts.slice(0, 4).forEach((p, k) => (k === 0 ? groove.moveTo(p.x, p.y) : groove.lineTo(p.x, p.y)))
    const c1 = toChart(-620, -520)
    const c2 = toChart(-760, 760)
    groove.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, pts[0]!.x, pts[0]!.y)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = 'rgba(255,250,235,0.7)'
    g.lineWidth = 7
    g.save()
    g.translate(1.5, 1.5)
    g.stroke(groove)
    g.restore()
    g.strokeStyle = 'rgba(74,59,44,0.85)'
    g.lineWidth = 4
    g.stroke(groove)
    const a = pts[3]!
    const b = pts[4]!
    g.setLineDash([3, 7])
    g.strokeStyle = 'rgba(74,59,44,0.6)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(a.x, a.y)
    g.lineTo(b.x, b.y)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = INK
    for (const w of DRIFT_ROUTE) {
      if (!w.gate) continue
      const p = toChart(w.x, w.z)
      g.beginPath()
      g.arc(p.x, p.y, 5, 0, Math.PI * 2)
      g.fill()
    }
    g.font = `italic 19px ${HAND}`
    g.fillStyle = INK_SOFT
    g.fillText(UI.carte.sillon, c2.x - 40, (c2.y + c1.y) / 2)
  }

  const linePts = () => {
    const end = DRIFT_ROUTE[DRIFT_ROUTE.length - 1]!
    const r = seeded(4242)
    const pts: { x: number; y: number; d: number }[] = []
    for (let i = 0; i <= 7; i++) {
      const z = end.z - i * 45
      const x = end.x - i * 8 + (r() - 0.5) * 30
      pts.push({ ...toChart(x, z), d: Math.round(36 - i * 3.6) })
    }
    return pts
  }

  const drawBlanc = () => {
    const c = toChart(REGIONS.blanc.x, REGIONS.blanc.z)
    g.font = `italic 30px ${HAND}`
    g.fillStyle = 'rgba(74,59,44,0.32)'
    g.textAlign = 'center'
    g.fillText(UI.carte.blanc, c.x, c.y - 40)
    g.textAlign = 'start'
    const drawn = ctx.state.flags['postgame'] || lineProgress >= 0
    if (!drawn) return
    const pts = linePts()
    const k = lineProgress >= 0 ? lineProgress : 1
    const n = Math.max(1, Math.floor(k * (pts.length - 1) + 1))
    g.strokeStyle = HERO_INK
    g.lineWidth = 3
    g.lineCap = 'round'
    g.beginPath()
    for (let i = 0; i < n; i++) {
      const p = pts[i]!
      if (i === 0) g.moveTo(p.x, p.y)
      else g.lineTo(p.x, p.y)
    }
    const f = k * (pts.length - 1) - (n - 1)
    if (n < pts.length && f > 0) {
      const a = pts[n - 1]!
      const b = pts[n]!
      g.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f)
    }
    g.stroke()
    g.fillStyle = HERO_INK
    g.font = `15px ${HAND}`
    for (let i = 1; i < n; i++) g.fillText(`${pts[i]!.d}`, pts[i]!.x + 8, pts[i]!.y - 4)
  }

  const drawCompass = (cg: CanvasRenderingContext2D, x: number, y: number, s: number, title: string, w: number, hh: number) => {
    cg.save()
    cg.translate(x, y)
    cg.scale(s, s)
    cg.strokeStyle = INK
    cg.fillStyle = INK
    cg.lineWidth = 1.4
    cg.beginPath()
    cg.moveTo(0, -46)
    cg.lineTo(8, 0)
    cg.lineTo(0, 46)
    cg.lineTo(-8, 0)
    cg.closePath()
    cg.stroke()
    cg.beginPath()
    cg.moveTo(0, -46)
    cg.lineTo(8, 0)
    cg.lineTo(-8, 0)
    cg.closePath()
    cg.fill()
    cg.font = `bold 16px ${SERIF}`
    cg.textAlign = 'center'
    cg.fillText('N', 0, -54)
    cg.restore()
    cg.font = `italic 30px ${SERIF}`
    cg.fillStyle = 'rgba(74,59,44,0.9)'
    cg.textAlign = 'right'
    cg.fillText(title, w - 40, hh - 34)
    cg.textAlign = 'start'
  }

  const composeSea = () => {
    g.drawImage(paper, 0, 0)
    g.drawImage(ink, 0, 0)
    drawRoute()
    drawBlanc()
    drawCompass(g, 70, SIZE - 120, 1, UI.carte.titre, SIZE, SIZE)
  }

  const revealed = (d: DistrictId) => {
    const domes = gp.progress().domes
    if (d === 'hauts') return domes.length >= 4
    if (d === 'proue') return ctx.state.act >= 3 || domes.length >= 6
    return domes.some((id) => DOME_DISTRICT[id] === d)
  }

  const planMarks: Box[] = []

  const labelSpot = (own: Box, above: readonly Box[], w: number, hgt: number) => {
    const cx = (own.x0 + own.x1) / 2
    const cy = (own.y0 + own.y1) / 2
    let best: { x: number; y: number } | null = null
    let bestD = Infinity
    for (let y = own.y0 + hgt; y <= own.y1 - hgt; y += LABEL_STEP * PPM) {
      for (let x = own.x0 + w / 2 + 6; x <= own.x1 - w / 2 - 6; x += LABEL_STEP * PPM) {
        const box = { x0: x - w / 2, y0: y - hgt / 2, x1: x + w / 2, y1: y + hgt / 2 }
        if (above.some((o) => hits(o, box)) || planMarks.some((o) => hits(o, box))) continue
        const d = Math.hypot(x - cx, y - cy)
        if (d < bestD) {
          bestD = d
          best = { x, y }
        }
      }
    }
    return best
  }

  const drawUnsurveyed = (d: District) => {
    const own = planBox(d)
    const above = drawnAfter(d.id)
    const area = (own.x1 - own.x0) * (own.y1 - own.y0)
    if (above.reduce((s, o) => s + overlap(own, o), 0) > HIDDEN_SHARE * area) return
    lg.save()
    for (const o of above) {
      if (!hits(own, o)) continue
      lg.beginPath()
      lg.rect(0, 0, PW, PH)
      lg.rect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0)
      lg.clip('evenodd')
    }
    lg.setLineDash([6, 8])
    lg.strokeStyle = 'rgba(74,59,44,0.25)'
    lg.lineWidth = 1.5
    lg.strokeRect(own.x0 + 3, own.y0 + 3, own.x1 - own.x0 - 6, own.y1 - own.y0 - 6)
    lg.restore()
    lg.save()
    lg.font = `italic 15px ${HAND}`
    const w = lg.measureText(UI.carte.vierge).width + 8
    const at = labelSpot(own, above, w, 20)
    if (at) {
      planMarks.push({ x0: at.x - w / 2, y0: at.y - 10, x1: at.x + w / 2, y1: at.y + 10 })
      lg.fillStyle = 'rgba(74,59,44,0.35)'
      lg.textAlign = 'center'
      lg.textBaseline = 'middle'
      lg.fillText(UI.carte.vierge, at.x, at.y)
    }
    lg.restore()
  }

  const drawDistrict = (d: District, k: number) => {
    if (k <= 0) return drawUnsurveyed(d)
    const a = toPlan(d.x0, d.z0)
    const b = toPlan(d.x1, d.z1)
    const accent = `#${d.accent.toString(16).padStart(6, '0')}`
    lg.save()
    lg.globalAlpha = Math.min(1, k)
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const r = Math.hypot(b.x - a.x, b.y - a.y) * 0.6 * Math.min(1, k)
    lg.beginPath()
    lg.arc(cx, cy, r, 0, Math.PI * 2)
    lg.clip()
    lg.fillStyle = `${accent}22`
    lg.fillRect(a.x + 2, a.y + 2, b.x - a.x - 4, b.y - a.y - 4)
    const rr = seeded(d.id.length * 997 + d.x0 * 13 + 7)
    lg.strokeStyle = INK
    lg.lineWidth = 1.1
    for (let x = d.x0 + 6; x <= d.x1 - 6; x += d.id === 'hauts' ? 24 : 12) {
      let z = d.z0 + 2 + rr() * 4
      while (z < d.z1 - 8) {
        const l = d.id === 'hauts' ? 10 : [18, 24, 32, 10, 14][Math.floor(rr() * 5)]!
        if (z + l > d.z1 - 2) break
        const inVoid = d.id === 'nef' && x > NEF_VOID.x0 && x < NEF_VOID.x1 && z + l > NEF_VOID.z0 && z < NEF_VOID.z1
        const inQuarter = d.id === 'ecluse' && x > -48 && x < 52 && z + l > 42
        if (!inVoid && !inQuarter) {
          const p = toPlan(x - 3.3, z)
          lg.fillStyle = rr() < 0.5 ? `${accent}55` : 'rgba(239,227,196,0.9)'
          lg.beginPath()
          lg.roundRect(p.x, p.y, 6.6 * PPM, l * PPM, 10)
          lg.fill()
          lg.stroke()
          lg.beginPath()
          lg.moveTo(p.x + 3.3 * PPM, p.y + 6)
          lg.lineTo(p.x + 3.3 * PPM, p.y + l * PPM - 6)
          lg.strokeStyle = 'rgba(74,59,44,0.35)'
          lg.stroke()
          lg.strokeStyle = INK
        }
        z += l + 2.5 + rr() * 2
      }
    }
    if (d.id === 'nef') {
      const v0 = toPlan(NEF_VOID.x0, NEF_VOID.z0)
      const v1 = toPlan(NEF_VOID.x1, NEF_VOID.z1)
      lg.strokeStyle = INK
      lg.lineWidth = 2
      lg.strokeRect(v0.x, v0.y, v1.x - v0.x, v1.y - v0.y)
      lg.strokeRect(v0.x + 16, v0.y + 16, v1.x - v0.x - 32, v1.y - v0.y - 32)
      const m = toPlan(0, 0)
      lg.beginPath()
      lg.arc(m.x, m.y, 2.2 * PPM, 0, Math.PI * 2)
      lg.fillStyle = '#d9b48f'
      lg.fill()
      lg.stroke()
    }
    if (d.id === 'ecluse') {
      const rooms = Object.values(QUARTER_ROOMS).filter((r) => r.floorY === 0).map((r) => [r.x0, r.x1, r.z0, r.z1] as const)
      lg.fillStyle = 'rgba(239,227,196,0.95)'
      lg.lineWidth = 1.6
      for (const [x0, x1, z0, z1] of rooms) {
        const p = toPlan(x0, z0)
        const q = toPlan(x1, z1)
        lg.fillRect(p.x, p.y, q.x - p.x, q.y - p.y)
        lg.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y)
      }
      const vitre = GRANDE_VITRE
      const z1 = QUARTER_ROOMS.refectoire!.z1
      const gv = toPlan(vitre.at - vitre.w / 2, z1)
      lg.strokeStyle = SEA_INK
      lg.lineWidth = 4
      lg.beginPath()
      lg.moveTo(gv.x, gv.y)
      lg.lineTo(toPlan(vitre.at + vitre.w / 2, z1).x, gv.y)
      lg.stroke()
    }
    lg.restore()
    lg.save()
    lg.globalAlpha = Math.min(1, k)
    lg.font = `italic 19px ${SERIF}`
    lg.fillStyle = INK
    lg.textAlign = 'center'
    lg.fillText(DISTRICT_NAMES[d.id], (a.x + b.x) / 2, d.id === 'hauts' ? a.y + 22 : (a.y + b.y) / 2 + (d.id === 'nef' ? -NEF_VOID.z1 * PPM - 10 : 4))
    lg.restore()
  }

  const icons: { kind: 'tube'; id: string; name: string; x: number; y: number }[] = []

  const composePlan = () => {
    lg.drawImage(planPaper, 0, 0)
    const site = gp.sites.get()
    const spot = (id: string, list: { id: string; at: { x: number; z: number } }[]) => list.find((x) => x.id === id)?.at ?? PLAN_FALLBACK[id] ?? null
    planMarks.length = 0
    const mark = (at: { x: number; z: number } | null, named: boolean) => {
      if (!at) return
      const p = toPlan(at.x, at.z)
      planMarks.push({ x0: p.x - (named ? 60 : 14), y0: p.y - 14, x1: p.x + (named ? 60 : 14), y1: p.y + (named ? 28 : 12) })
    }
    for (const id of MAP_DOMES) mark(spot(id, site.domes), true)
    for (const id of SCELLEES) mark(spot(id, site.scellees), true)
    for (const t of gp.travel.stations()) if (t.open) mark(t.at, false)
    for (const id of PLAN_ORDER) {
      const anim = reveal.get(id)
      drawDistrict(DISTRICT_BY_ID[id], anim !== undefined ? anim : revealed(id) ? 1 : 0)
    }
    lg.font = `italic 14px ${HAND}`
    for (const id of MAP_DOMES) {
      const at = spot(id, site.domes)
      if (!at) continue
      const p = toPlan(at.x, at.z)
      const on = gp.progress().domes.includes(id)
      lg.beginPath()
      lg.arc(p.x, p.y, 10, Math.PI, 0)
      lg.lineTo(p.x + 10, p.y + 6)
      lg.lineTo(p.x - 10, p.y + 6)
      lg.closePath()
      lg.fillStyle = on ? '#e3b95f' : 'rgba(111,168,216,0.85)'
      lg.strokeStyle = INK
      lg.lineWidth = 1.5
      lg.fill()
      lg.stroke()
      if (on || revealed(DOME_DISTRICT[id]!)) {
        lg.fillStyle = INK_SOFT
        lg.textAlign = 'center'
        lg.fillText(DOME_NAMES[id] ?? '', p.x, p.y + 22)
      }
    }
    for (const id of SCELLEES) {
      const at = spot(id, site.scellees)
      if (!at) continue
      const district = ctx.services.drift?.districtAt({ x: at.x, y: 0, z: at.z })
      if (district && !revealed(district)) continue
      const p = toPlan(at.x, at.z)
      const done = gp.scellees.done(id)
      lg.save()
      lg.translate(p.x, p.y)
      lg.rotate(Math.PI / 4)
      lg.fillStyle = done ? '#f2eeff' : 'rgba(216,100,78,0.85)'
      lg.strokeStyle = INK
      lg.fillRect(-7, -7, 14, 14)
      lg.strokeRect(-7, -7, 14, 14)
      lg.restore()
      lg.fillStyle = INK_SOFT
      lg.textAlign = 'center'
      lg.fillText(SCELLEE_TEXT[id]?.nom ?? id, p.x, p.y + 22)
    }
    icons.length = 0
    for (const t of gp.travel.stations()) {
      if (!t.open) continue
      const p = toPlan(t.at.x, t.at.z)
      lg.beginPath()
      lg.arc(p.x, p.y, 9, 0, Math.PI * 2)
      lg.fillStyle = '#2f6b78'
      lg.fill()
      lg.strokeStyle = '#efe3c4'
      lg.lineWidth = 2
      lg.stroke()
      lg.fillStyle = '#efe3c4'
      lg.font = `bold 11px ${SERIF}`
      lg.textAlign = 'center'
      lg.fillText('T', p.x, p.y + 4)
      icons.push({ kind: 'tube', id: t.id, name: t.name, x: p.x, y: p.y })
    }
    lg.textAlign = 'start'
    drawCompass(lg, PW - 70, 110, 0.75, UI.carte.plan, PW - 40, PH)
  }

  const drawOverlay = () => {
    if (!overlay) return
    const o = overlay
    const st = ctx.state
    const w = side === 'mer' ? SIZE : PW
    const hh = side === 'mer' ? SIZE : PH
    o.clearRect(0, 0, w, hh)
    const pulse = 1 + 0.25 * Math.sin(performance.now() / 260)
    if (side === 'mer') {
      const d = toChart(st.drift.position.x, st.drift.position.z)
      o.save()
      o.translate(d.x, d.y)
      o.rotate(st.drift.heading)
      o.fillStyle = '#c46a4a'
      o.strokeStyle = INK
      o.lineWidth = 1.5
      o.beginPath()
      o.ellipse(0, 0, 9, 15, 0, 0, Math.PI * 2)
      o.fill()
      o.stroke()
      o.restore()
      o.font = `italic 16px ${HAND}`
      o.fillStyle = INK
      o.fillText(UI.carte.drift, d.x + 14, d.y + 4)
      return
    }
    const hl = gp.heroLocal()
    const p = toPlan(hl.x, hl.z)
    o.save()
    o.translate(p.x, p.y)
    o.rotate(st.hero.yaw - st.drift.heading)
    o.scale(pulse, pulse)
    o.fillStyle = HERO_INK
    o.strokeStyle = '#fff8ee'
    o.lineWidth = 2
    o.beginPath()
    o.moveTo(0, -12)
    o.lineTo(9, 9)
    o.lineTo(0, 4)
    o.lineTo(-9, 9)
    o.closePath()
    o.stroke()
    o.fill()
    o.restore()
    o.font = `italic 16px ${HAND}`
    o.fillStyle = HERO_INK
    o.fillText(UI.carte.toi, p.x + 14, p.y - 8)
  }

  paperOn(pg, SIZE, SIZE, rng)
  paperOn(ppg, PW, PH, rng)
  try {
    drawInk()
  } catch (err) {
    console.error('[gameplay] carte', err)
  }
  composeSea()

  const peek = async (canvas: HTMLCanvasElement, until: () => boolean, hold: number) => {
    const el = h('div', 'gp-chart peek', undefined, root)
    const sheet = h('div', 'sheet', undefined, el)
    sheet.appendChild(canvas)
    while (!until()) await gp.cine.wait(0.05)
    await gp.cine.wait(hold)
    el.style.transition = 'opacity .9s'
    el.style.opacity = '0'
    await gp.cine.wait(0.9)
    el.remove()
  }

  const build = () => {
    if (!openEl) return
    openEl.textContent = ''
    const wrap = openEl
    h('div', 'title', UI.carte.titre, wrap)
    const tabs = h('div', 'gp-tabs gp-chart-tabs', undefined, wrap)
    for (const [k, label] of [['plan', UI.carte.plan], ['mer', UI.carte.mer]] as const) {
      button(label, () => {
        side = k
        build()
      }, tabs, `gp-tab${side === k ? ' on' : ''}`)
    }
    const sheet = h('div', `sheet ${side}`, undefined, wrap)
    const src = side === 'mer' ? out : plan
    sheet.appendChild(src)
    const [ov, og] = canvas2d(src.width, src.height)
    overlay = og
    overlayCanvas = ov
    sheet.appendChild(ov)
    if (side === 'plan') {
      ov.style.cursor = 'pointer'
      const at = (e: MouseEvent) => {
        const r = ov.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width) * PW
        const y = ((e.clientY - r.top) / r.height) * PH
        return icons.find((i) => Math.hypot(i.x - x, i.y - y) < 16) ?? null
      }
      ov.addEventListener('click', (e) => {
        const hit = at(e)
        if (!hit) return
        api.close()
        void gp.travel.goStation(hit.id)
      })
      ov.addEventListener('mousemove', (e) => {
        const hit = at(e)
        ov.title = hit ? UI.carte.aller(STATION_NAMES[hit.id] ?? hit.name) : ''
      })
    }
    h('div', 'legend', side === 'mer' ? UI.carte.legendeMer : UI.carte.legende, wrap)
    const row = h('div', 'side', undefined, wrap)
    button(UI.carte.cabine, () => {
      api.close()
      void gp.travel.returnToCabin()
    }, row)
    button(`${UI.carte.fermer} (${ctx.input.keyLabel('map')})`, () => api.close(), row, 'gp-btn primary')
  }

  const api: Chart = {
    canvas: out,
    plan,
    async reveal(domeId) {
      const d = DOME_DISTRICT[domeId]
      if (!d) return
      reveal.set(d, 0)
      planDirty = true
      gp.sfx('paper')
      await peek(plan, () => (reveal.get(d) ?? 1) >= 1, 1.6)
      reveal.delete(d)
      planDirty = true
    },
    async drawLine() {
      lineProgress = 0
      gp.sfx('stylo')
      await peek(out, () => lineProgress >= 1, 2.4)
      lineProgress = -1
      dirty = true
    },
    redraw() {
      dirty = true
      planDirty = true
    },
    isOpen: () => openEl !== null,
    open(s) {
      if (openEl) return
      if (s) side = s
      dirty = true
      planDirty = true
      composePlan()
      openEl = h('div', 'gp-chart gp-interactive', undefined, root)
      build()
      gp.sfx('paper')
      ctx.bus.emit('ui:menu', { open: 'carte' })
      ctx.bus.emit('game:paused', { paused: true })
      if (document.pointerLockElement) document.exitPointerLock()
    },
    close() {
      if (!openEl) return
      openEl.remove()
      openEl = null
      overlay = null
      overlayCanvas = null
      ctx.bus.emit('ui:menu', { open: null })
      ctx.bus.emit('game:paused', { paused: false })
    },
    update(dt) {
      let animating = false
      for (const [id, t] of reveal) {
        if (t < 1) {
          reveal.set(id, Math.min(1, t + dt / 3.2))
          animating = true
        }
      }
      if (lineProgress >= 0 && lineProgress < 1) {
        lineProgress = Math.min(1, lineProgress + dt / 4)
        composeSea()
      }
      if (dirty) {
        dirty = false
        composeSea()
      }
      if (animating || planDirty) {
        planDirty = false
        composePlan()
      }
      if (openEl && overlayCanvas) drawOverlay()
    },
  }
  ctx.bus.on('collectible:found', () => {
    planDirty = true
  })
  return api
}
