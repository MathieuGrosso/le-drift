import {
  BLANC_SLOPE, CAMPS, CEILING_Y, DRIFT_ROUTE, HAUTS_FONDS, LANDMARKS, LANES, REGIONS, SEUIL, SONDES, WORLD_HALF,
} from '../../core/layout'
import type { RegionId } from '../../core/types'
import type { Chart, Gp } from '../context'
import { REGION_NAMES, SONDE_NAMES, UI } from '../text/fr'
import { button, h } from './dom'

const SIZE = 1024
const GRID = 256
const CELL = SIZE / GRID
const STEP_M = (WORLD_HALF * 2) / GRID
const REVEAL_R = 250
const INK = '#4a3b2c'
const INK_SOFT = 'rgba(74,59,44,0.55)'
const SEA_INK = '#2f6b78'
const HERO_INK = '#d0563c'
const SERIF = "'Fraunces', 'Iowan Old Style', Palatino, Georgia, serif"
const HAND = "'Caveat', 'Bradley Hand', 'Segoe Print', 'Snell Roundhand', cursive"

export const toChart = (x: number, z: number) => ({ x: (x + WORLD_HALF) / 2, y: (z + WORLD_HALF) / 2 })

function gauss(dx: number, dz: number, r: number) {
  return Math.exp(-(dx * dx + dz * dz) / (2 * r * r))
}

function fallbackHeight(x: number, z: number): number {
  let y = 14 + 6 * Math.sin(x / 97 + 1.3) * Math.cos(z / 131) + 4 * Math.sin((x + z) / 53) + 3 * Math.cos(x / 41 - z / 67)
  y += 80 * gauss(x, z, 45) + 30 * gauss(x + 260, z - 760, 70)
  y += 25 * gauss(x - 820, z - 380, 120) + 18 * gauss(x - 560, z + 520, 140)
  for (const hf of HAUTS_FONDS) y = Math.max(y, (CEILING_Y - hf.topBelowCeiling) * gauss(x - hf.x, z - hf.z, 26))
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

function canvas2d(w = SIZE, hgt = SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = hgt
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas 2d indisponible')
  return [c, g]
}

export function createChart(gp: Gp, root: HTMLElement): Chart {
  const ctx = gp.ctx
  const [out, g] = canvas2d()
  const [paper, pg] = canvas2d()
  const [ink, ig] = canvas2d()
  const [mask, mg] = canvas2d()
  const [tmp, tg] = canvas2d()
  const rng = ctx.rng('carte')
  const anim = new Map<string, number>()
  let lineProgress = -1
  let openEl: HTMLElement | null = null
  let overlay: CanvasRenderingContext2D | null = null
  let dirty = true

  const heightAt = (x: number, z: number) => ctx.services.world?.heightAt(x, z) ?? fallbackHeight(x, z)

  const drawPaper = () => {
    pg.fillStyle = '#efe3c4'
    pg.fillRect(0, 0, SIZE, SIZE)
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
    pg.globalAlpha = 0.9
    for (let y = 0; y < SIZE; y += 256) for (let x = 0; x < SIZE; x += 256) pg.drawImage(grain, x, y)
    pg.globalAlpha = 1
    for (let i = 0; i < 9; i++) {
      const x = rng() * SIZE
      const y = rng() * SIZE
      const r = 30 + rng() * 120
      const st = pg.createRadialGradient(x, y, r * 0.2, x, y, r)
      st.addColorStop(0, 'rgba(176,140,90,0.10)')
      st.addColorStop(0.8, 'rgba(176,140,90,0.05)')
      st.addColorStop(1, 'rgba(176,140,90,0)')
      pg.fillStyle = st
      pg.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const v = pg.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75)
    v.addColorStop(0, 'rgba(120,90,50,0)')
    v.addColorStop(1, 'rgba(120,90,50,0.28)')
    pg.fillStyle = v
    pg.fillRect(0, 0, SIZE, SIZE)
    pg.strokeStyle = 'rgba(120,90,50,0.12)'
    pg.lineWidth = 2
    for (const f of [SIZE / 3, (SIZE * 2) / 3]) {
      pg.beginPath()
      pg.moveTo(f, 0)
      pg.lineTo(f, SIZE)
      pg.moveTo(0, f)
      pg.lineTo(SIZE, f)
      pg.stroke()
    }
  }

  const drawInk = () => {
    const n = GRID + 1
    const hs = new Float32Array(n * n)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) hs[j * n + i] = heightAt(-WORLD_HALF + i * STEP_M, -WORLD_HALF + j * STEP_M)
    }
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
    ig.imageSmoothingEnabled = true
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
      for (let k = 1; k < lane.points.length; k++) {
        const a = toChart(lane.points[k - 1]!.x, lane.points[k - 1]!.z)
        const b = toChart(lane.points[k]!.x, lane.points[k]!.z)
        const ang = Math.atan2(b.y - a.y, b.x - a.x)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        ig.save()
        ig.setLineDash([])
        ig.translate(mx, my)
        ig.rotate(ang)
        ig.beginPath()
        ig.moveTo(-8, -6)
        ig.lineTo(4, 0)
        ig.lineTo(-8, 6)
        ig.stroke()
        ig.restore()
      }
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
    ig.fillStyle = INK_SOFT
    ig.font = `16px ${SERIF}`
    for (const c of CAMPS) {
      const p = toChart(c.x, c.z)
      ig.beginPath()
      ig.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ig.fill()
    }
    for (const hf of HAUTS_FONDS) {
      const p = toChart(hf.x, hf.z)
      ig.strokeStyle = INK
      ig.lineWidth = 1.2
      ig.beginPath()
      ig.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ig.stroke()
      ig.font = `11px ${SERIF}`
      ig.fillStyle = INK_SOFT
      ig.fillText(String(Math.round(CEILING_Y - hf.topBelowCeiling)), p.x + 9, p.y + 4)
    }
    ig.textAlign = 'center'
    for (const [id, c] of Object.entries(REGIONS) as [Exclude<RegionId, 'bleu'>, { x: number; z: number }][]) {
      if (id === 'blanc') continue
      const p = toChart(c.x, c.z)
      ig.font = `italic 22px ${SERIF}`
      ig.fillStyle = 'rgba(74,59,44,0.8)'
      ig.fillText(REGION_NAMES[id], p.x, p.y - 28)
    }
    ig.textAlign = 'start'
  }

  const drawMask = () => {
    mg.clearRect(0, 0, SIZE, SIZE)
    for (const s of SONDES) {
      const active = ctx.state.chart.sondes.includes(s.id)
      const t = anim.get(s.id)
      if (!active && t === undefined) continue
      const p = t === undefined ? 1 : Math.min(1, t)
      const center = s.region === 'bleu' ? toChart(s.x, s.z) : toChart(REGIONS[s.region].x, REGIONS[s.region].z)
      const ease = 1 - Math.pow(1 - p, 3)
      const r = REVEAL_R * ease
      if (r <= 1) continue
      const blob = ctx.rng(`blob-${s.id}`)
      for (let k = 0; k < 14; k++) {
        const ang = blob() * Math.PI * 2
        const off = r * 0.35 * blob()
        const rr = r * (0.55 + 0.35 * blob())
        const x = center.x + Math.cos(ang) * off
        const y = center.y + Math.sin(ang) * off
        const grad = mg.createRadialGradient(x, y, rr * 0.55, x, y, rr)
        grad.addColorStop(0, 'rgba(0,0,0,1)')
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        mg.fillStyle = grad
        mg.fillRect(x - rr, y - rr, rr * 2, rr * 2)
      }
    }
    const edge = toChart(0, BLANC_SLOPE.zStart).y
    const blank = mg.createLinearGradient(0, edge - 22, 0, edge + 6)
    blank.addColorStop(0, 'rgba(0,0,0,1)')
    blank.addColorStop(1, 'rgba(0,0,0,0)')
    mg.globalCompositeOperation = 'destination-out'
    mg.fillStyle = blank
    mg.fillRect(0, 0, SIZE, edge + 6)
    mg.globalCompositeOperation = 'source-over'
  }

  const drawRoute = () => {
    const pts = DRIFT_ROUTE.map((w) => toChart(w.x, w.z))
    const usual = pts.slice(0, 4)
    const groove = new Path2D()
    usual.forEach((p, k) => (k === 0 ? groove.moveTo(p.x, p.y) : groove.lineTo(p.x, p.y)))
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
    g.strokeStyle = 'rgba(40,30,20,0.5)'
    g.lineWidth = 1
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

  const reperePoints = (progress: number) => {
    const st = ctx.state
    const start = DRIFT_ROUTE[DRIFT_ROUTE.length - 1]!
    const pts = [toChart(start.x, start.z)]
    for (const id of st.chart.reperes) {
      const hf = HAUTS_FONDS.find((s) => s.id === id)
      if (hf) pts.push(toChart(hf.x, hf.z))
    }
    if (st.flags['ending'] || st.flags['postgame']) pts.push(toChart(SEUIL.x, SEUIL.z))
    if (progress >= 0 && progress < 1 && pts.length > 1) {
      const segs = pts.length - 1
      const t = progress * segs
      const k = Math.floor(t)
      const a = pts[k]!
      const b = pts[Math.min(k + 1, segs)]!
      const f = t - k
      return [...pts.slice(0, k + 1), { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }]
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
    const pts = reperePoints(lineProgress)
    if (pts.length < 2) return
    g.strokeStyle = HERO_INK
    g.lineWidth = 3
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    pts.forEach((p, k) => (k === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x + Math.sin(k * 7.1) * 1.5, p.y)))
    g.stroke()
    g.fillStyle = HERO_INK
    g.font = `15px ${HAND}`
    for (const id of ctx.state.chart.reperes) {
      const hf = HAUTS_FONDS.find((s) => s.id === id)
      if (!hf) continue
      const p = toChart(hf.x, hf.z)
      g.beginPath()
      g.arc(p.x, p.y, 4, 0, Math.PI * 2)
      g.fill()
      g.fillText(String(Math.round(CEILING_Y - hf.topBelowCeiling)), p.x + 8, p.y - 6)
    }
  }

  const drawCartouche = () => {
    g.save()
    g.translate(70, SIZE - 120)
    g.strokeStyle = INK
    g.fillStyle = INK
    g.lineWidth = 1.4
    g.beginPath()
    g.moveTo(0, -46)
    g.lineTo(8, 0)
    g.lineTo(0, 46)
    g.lineTo(-8, 0)
    g.closePath()
    g.stroke()
    g.beginPath()
    g.moveTo(0, -46)
    g.lineTo(8, 0)
    g.lineTo(-8, 0)
    g.closePath()
    g.fill()
    g.beginPath()
    g.moveTo(-34, 0)
    g.lineTo(34, 0)
    g.stroke()
    g.font = `bold 16px ${SERIF}`
    g.textAlign = 'center'
    g.fillText('N', 0, -54)
    g.restore()
    g.font = `italic 30px ${SERIF}`
    g.fillStyle = 'rgba(74,59,44,0.9)'
    g.textAlign = 'right'
    g.fillText(UI.carte.titre, SIZE - 40, SIZE - 40)
    g.textAlign = 'start'
  }

  const drawSondes = () => {
    for (const s of SONDES) {
      if (!ctx.state.chart.sondes.includes(s.id)) continue
      const p = toChart(s.x, s.z)
      g.fillStyle = '#e8674a'
      g.strokeStyle = INK
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(p.x, p.y - 13)
      g.lineTo(p.x + 7, p.y + 6)
      g.lineTo(p.x - 7, p.y + 6)
      g.closePath()
      g.fill()
      g.stroke()
    }
  }

  const compose = () => {
    drawMask()
    g.globalCompositeOperation = 'source-over'
    g.drawImage(paper, 0, 0)
    tg.clearRect(0, 0, SIZE, SIZE)
    tg.globalCompositeOperation = 'source-over'
    tg.drawImage(ink, 0, 0)
    tg.globalCompositeOperation = 'destination-in'
    tg.drawImage(mask, 0, 0)
    tg.globalCompositeOperation = 'source-over'
    g.drawImage(tmp, 0, 0)
    drawRoute()
    drawBlanc()
    drawSondes()
    drawCartouche()
    for (const pin of ctx.state.chart.pins) {
      const p = toChart(pin.x, pin.z)
      g.fillStyle = HERO_INK
      g.beginPath()
      g.arc(p.x, p.y, 5, 0, Math.PI * 2)
      g.fill()
    }
  }

  const drawOverlay = () => {
    if (!overlay) return
    const o = overlay
    const st = ctx.state
    o.clearRect(0, 0, SIZE, SIZE)
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
    const hp = toChart(st.hero.position.x, st.hero.position.z)
    const pulse = 1 + 0.25 * Math.sin(ctx.clock.elapsed * 4 + performance.now() / 300)
    o.save()
    o.translate(hp.x, hp.y)
    o.rotate(st.hero.yaw)
    o.scale(pulse, pulse)
    o.fillStyle = HERO_INK
    o.strokeStyle = '#fff8ee'
    o.lineWidth = 2
    o.beginPath()
    o.moveTo(0, -11)
    o.lineTo(8, 8)
    o.lineTo(0, 4)
    o.lineTo(-8, 8)
    o.closePath()
    o.stroke()
    o.fill()
    o.restore()
  }

  const travelTo = async (sondeId: string) => {
    const top = gp.sondes.topOf(sondeId)
    if (!top) return
    api.close()
    gp.lock.count++
    await gp.cine.fade('black', 0.6)
    const hero = ctx.services.hero
    const p = { x: top.x + 3, y: top.y + 1.5, z: top.z + 3 }
    if (hero) hero.teleport(p)
    else ctx.state.hero.position = p
    await gp.cine.wait(0.4)
    await gp.cine.fade(null, 0.8)
    gp.lock.count--
  }

  drawPaper()
  try {
    drawInk()
  } catch (err) {
    console.error('[gameplay] carte', err)
  }
  compose()

  const api: Chart = {
    canvas: out,
    async reveal(sondeId) {
      anim.set(sondeId, 0)
      const peek = h('div', 'gp-chart peek', undefined, root)
      const sheet = h('div', 'sheet', undefined, peek)
      sheet.appendChild(out)
      while ((anim.get(sondeId) ?? 1) < 1) await gp.cine.wait(0.05)
      anim.delete(sondeId)
      dirty = true
      await gp.cine.wait(1.6)
      peek.style.transition = 'opacity .8s'
      peek.style.opacity = '0'
      await gp.cine.wait(0.8)
      peek.remove()
    },
    async drawLine() {
      lineProgress = 0
      const peek = h('div', 'gp-chart peek', undefined, root)
      const sheet = h('div', 'sheet', undefined, peek)
      sheet.appendChild(out)
      while (lineProgress >= 0 && lineProgress < 1) await gp.cine.wait(0.05)
      lineProgress = -1
      dirty = true
      await gp.cine.wait(2.4)
      peek.style.transition = 'opacity 1.2s'
      peek.style.opacity = '0'
      await gp.cine.wait(1.2)
      peek.remove()
    },
    redraw() {
      dirty = true
    },
    isOpen: () => openEl !== null,
    open() {
      if (openEl) return
      dirty = true
      const wrap = h('div', 'gp-chart gp-interactive', undefined, root)
      openEl = wrap
      h('div', 'title', UI.carte.titre, wrap)
      const sheet = h('div', 'sheet', undefined, wrap)
      sheet.appendChild(out)
      const [ov, og] = canvas2d()
      overlay = og
      sheet.appendChild(ov)
      ov.style.cursor = 'pointer'
      ov.addEventListener('click', (e) => {
        const r = ov.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width) * SIZE
        const y = ((e.clientY - r.top) / r.height) * SIZE
        for (const s of SONDES) {
          if (!ctx.state.chart.sondes.includes(s.id)) continue
          const p = toChart(s.x, s.z)
          if (Math.hypot(p.x - x, p.y - y) < 22) {
            void travelTo(s.id)
            return
          }
        }
      })
      ov.addEventListener('mousemove', (e) => {
        const r = ov.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width) * SIZE
        const y = ((e.clientY - r.top) / r.height) * SIZE
        const hit = SONDES.find((s) => ctx.state.chart.sondes.includes(s.id) && Math.hypot(toChart(s.x, s.z).x - x, toChart(s.x, s.z).y - y) < 22)
        ov.title = hit ? UI.carte.voyager(SONDE_NAMES[hit.id] ?? hit.id) : ''
      })
      h('div', 'legend', UI.carte.legende, wrap)
      const side = h('div', 'side', undefined, wrap)
      button(UI.carte.ecluse, () => {
        api.close()
        void gp.indoor.returnToLock()
      }, side)
      button(`${UI.carte.fermer} (${ctx.input.keyLabel('map')})`, () => api.close(), side, 'gp-btn primary')
      ctx.bus.emit('ui:menu', { open: 'carte' })
      ctx.bus.emit('game:paused', { paused: true })
      if (document.pointerLockElement) document.exitPointerLock()
    },
    close() {
      if (!openEl) return
      openEl.remove()
      openEl = null
      overlay = null
      ctx.bus.emit('ui:menu', { open: null })
      ctx.bus.emit('game:paused', { paused: false })
    },
    update(dt) {
      let animating = false
      for (const [id, t] of anim) {
        if (t < 1) {
          anim.set(id, Math.min(1, t + dt / 3.2))
          animating = true
        }
      }
      if (lineProgress >= 0 && lineProgress < 1) {
        lineProgress = Math.min(1, lineProgress + dt / 3.5)
        animating = true
      }
      if (animating || dirty) {
        dirty = false
        compose()
      }
      if (openEl) drawOverlay()
    },
  }

  ctx.bus.on('sonde:activated', () => {
    dirty = true
  })
  return api
}
