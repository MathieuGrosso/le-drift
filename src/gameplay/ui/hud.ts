import * as THREE from 'three'
import { SOUFFLE } from '../../core/tuning'
import type { Vec3 } from '../../core/types'
import type { Gp, Hud } from '../context'
import { UI } from '../text/fr'
import { h, keyHint, svg } from './dom'

const WHEEL_R = [22, 28.5, 35] as const
const WP_EDGE = 0.86

export function createHud(gp: Gp, root: HTMLElement): Hud {
  const ctx = gp.ctx
  const hud = h('div', 'gp-hud', undefined, root)

  const wheel = svg('svg', { class: 'gp-wheel', viewBox: '-40 -40 80 80' })
  hud.appendChild(wheel)
  const rings: { bg: SVGCircleElement; fg: SVGCircleElement }[] = WHEEL_R.map((r) => {
    const bg = svg('circle', { r, fill: 'none', stroke: 'rgba(14,59,82,.45)', 'stroke-width': 5.5, transform: 'rotate(-90)' }, wheel)
    const fg = svg('circle', { r, fill: 'none', stroke: '#9ee6c9', 'stroke-width': 5.5, 'stroke-linecap': 'round', transform: 'rotate(-90)' }, wheel)
    return { bg, fg }
  })
  let wheelHideTimer = 0

  const prompt = h('div', 'gp-prompt', undefined, hud)
  const ring = svg('svg', { viewBox: '-20 -20 40 40' })
  const ringCircle = svg('circle', { r: 17, fill: 'none', stroke: '#9ee6c9', 'stroke-width': 3, transform: 'rotate(-90)', 'stroke-dasharray': '0 200' }, ring)
  const promptHold = h('span', 'gp-hold', UI.maintenir, prompt)
  const keyWrap = h('span', 'gp-keywrap', undefined, prompt)
  const promptKey = h('span', 'gp-key', 'E', keyWrap)
  keyWrap.appendChild(ring)
  const promptLabel = h('span', '', '', prompt)

  const toastEl = h('div', 'gp-toast', undefined, hud)
  const toastK = h('div', 'k', '', toastEl)
  const toastT = h('div', 't', '', toastEl)
  const toastQueue: string[] = []
  let toastTimer = 0

  const tipEl = h('div', 'gp-tip', '', hud)

  const wp = h('div', 'gp-waypoint', undefined, hud)
  h('div', 'mark', undefined, wp)
  const wpLabel = h('div', 'l', '', wp)
  let wpTarget: { at: Vec3; label: string } | null = null
  const wpV = new THREE.Vector3()
  const placeWaypoint = () => {
    if (!wpTarget) return
    const cam = ctx.camera
    wpV.set(wpTarget.at.x, wpTarget.at.y, wpTarget.at.z).project(cam)
    const behind = wpV.z > 1
    let nx = behind ? -wpV.x : wpV.x
    let ny = behind ? -wpV.y : wpV.y
    const edge = Math.max(Math.abs(nx) / WP_EDGE, Math.abs(ny) / WP_EDGE)
    if (behind || edge > 1) {
      const k = 1 / Math.max(edge, 1e-3)
      nx *= k
      ny *= k
    }
    const p = gp.heroPos()
    const d = Math.hypot(wpTarget.at.x - p.x, wpTarget.at.y - p.y, wpTarget.at.z - p.z)
    wpLabel.textContent = `${wpTarget.label} · ${Math.round(d)} m`
    wp.style.left = `${(nx * 0.5 + 0.5) * 100}%`
    wp.style.top = `${(-ny * 0.5 + 0.5) * 100}%`
  }
  let tipTimer = 0

  const place = h('div', 'gp-place', undefined, hud)
  const placeT = h('div', 't', '', place)
  h('div', 'rule', undefined, place)
  const placeS = h('div', 's', '', place)
  let placeTimer = 0
  let placeHeld = false
  let heldPlace: [string, string | undefined] | null = null

  const nacres = h('div', 'gp-nacres', undefined, hud)
  const nacreDots = [0, 1, 2, 3].map(() => h('div', 'gp-nacre', undefined, nacres))
  let nacreTimer = 0

  const buffsEl = h('div', 'gp-buffs', undefined, hud)

  const br = h('div', 'gp-br', undefined, hud)
  const info = h('div', 'info', undefined, br)
  const timeRow = h('div', 'row', undefined, info)
  const glyph = svg('svg', { width: 18, height: 18, viewBox: '-10 -10 20 20' }, timeRow)
  const glyphSun = svg('circle', { r: 5, fill: '#ffd9a0' }, glyph)
  const glyphMoon = svg('path', { d: 'M3,-6 A6,6 0 1,0 3,6 A4.5,4.5 0 1,1 3,-6', fill: '#9fb8e8' }, glyph)
  const timeText = h('span', '', '', timeRow)
  const visText = h('div', 'row', '', info)
  const curRow = h('div', 'row', undefined, info)
  const curSvg = svg('svg', { width: 18, height: 18, viewBox: '-10 -10 20 20' }, curRow)
  const curArrow = svg('path', { d: 'M0,-8 L5,4 L0,1 L-5,4 Z', fill: '#cfefe3' }, curSvg)
  const curText = h('span', '', '', curRow)
  const mini = h('div', 'gp-mini', undefined, br)
  const miniCanvas = h('canvas', '', undefined, mini)
  miniCanvas.width = miniCanvas.height = 300
  const miniCtx = miniCanvas.getContext('2d')
  let miniTimer = 0

  const giteRow = h('div', 'row', undefined, info)
  const giteSvg = svg('svg', { width: 18, height: 18, viewBox: '-10 -10 20 20' }, giteRow)
  const giteBar = svg('path', { d: 'M-8,0 L8,0 M0,0 L0,-5', stroke: '#cfefe3', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, giteSvg)
  const giteText = h('span', '', '', giteRow)
  giteRow.style.display = 'none'
  const counterEl = h('div', 'gp-counter', '', hud)
  const counters = new Map<string, string | null>()

  const v = new THREE.Vector3()

  const showToast = (text: string) => {
    const [k, t] = text.includes(' : ') ? text.split(' : ', 2) as [string, string] : ['', text]
    toastK.textContent = k
    toastT.textContent = t
    toastEl.classList.add('show')
    toastTimer = 4
  }

  const drawMini = () => {
    if (!miniCtx) return
    const st = ctx.state
    const src = gp.chart.plan
    const hl = gp.heroLocal()
    const px = (hl.x + 130) * 4
    const pz = (hl.z + 80) * 4
    const half = 110
    miniCtx.clearRect(0, 0, 300, 300)
    miniCtx.drawImage(src, px - half, pz - half, half * 2, half * 2, 0, 0, 300, 300)
    miniCtx.save()
    miniCtx.translate(150, 150)
    miniCtx.rotate(st.hero.yaw - st.drift.heading)
    miniCtx.fillStyle = '#e8674a'
    miniCtx.strokeStyle = '#fff8ee'
    miniCtx.lineWidth = 3
    miniCtx.beginPath()
    miniCtx.moveTo(0, -16)
    miniCtx.lineTo(11, 12)
    miniCtx.lineTo(0, 6)
    miniCtx.lineTo(-11, 12)
    miniCtx.closePath()
    miniCtx.stroke()
    miniCtx.fill()
    miniCtx.restore()
  }

  const api: Hud = {
    update(dt) {
      const st = ctx.state
      const hero = st.hero
      const max = Math.max(hero.breathMax, 0.01)
      const notFull = hero.breath < max - 0.001 || hero.exhausted
      if (notFull) wheelHideTimer = 1
      else wheelHideTimer -= dt
      const showWheel = wheelHideTimer > 0 && !gp.dialogue.active()
      const head = gp.headPos()
      v.set(head.x, head.y, head.z).project(ctx.camera)
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      wheel.classList.toggle('show', showWheel && onScreen)
      wheel.classList.toggle('exhausted', hero.exhausted)
      if (onScreen) {
        const sx = (v.x * 0.5 + 0.5) * window.innerWidth + 58
        const sy = (-v.y * 0.5 + 0.5) * window.innerHeight - 6
        wheel.style.left = `${sx}px`
        wheel.style.top = `${sy}px`
      }
      const low = hero.breath / max < SOUFFLE.lowThreshold
      const color = hero.exhausted ? '#e8674a' : low ? '#f2c14e' : '#9ee6c9'
      for (let i = 0; i < rings.length; i++) {
        const r = WHEEL_R[i]!
        const c = 2 * Math.PI * r
        const cap = Math.max(0, Math.min(1, max - i))
        const fill = Math.max(0, Math.min(cap, hero.breath - i))
        const { bg, fg } = rings[i]!
        bg.setAttribute('stroke-dasharray', `${cap * c} ${c}`)
        fg.setAttribute('stroke-dasharray', `${fill * c} ${c}`)
        fg.setAttribute('stroke', color)
        bg.style.display = cap > 0 ? '' : 'none'
        fg.style.display = cap > 0 ? '' : 'none'
      }

      if (toastTimer > 0) {
        toastTimer -= dt
        if (toastTimer <= 0) toastEl.classList.remove('show')
      } else if (toastQueue.length > 0 && !toastEl.classList.contains('show')) {
        showToast(toastQueue.shift()!)
      }
      placeWaypoint()
      if (tipTimer > 0) {
        const talking = gp.dialogue.active()
        tipEl.classList.toggle('show', !talking)
        if (!talking) tipTimer -= dt
        if (tipTimer <= 0) tipEl.classList.remove('show')
      }
      if (placeTimer > 0) {
        placeTimer -= dt
        if (placeTimer <= 0) place.classList.remove('show')
      }
      if (nacreTimer > 0) {
        nacreTimer -= dt
        if (nacreTimer <= 0) nacres.classList.remove('show')
      }

      const hours = st.time.hours
      const night = hours < 5 || hours >= 19.5
      glyphSun.style.display = night ? 'none' : ''
      glyphMoon.style.display = night ? '' : 'none'
      const hh = Math.floor(hours)
      const mm = Math.floor((hours - hh) * 60)
      timeText.textContent = `${hh}h${mm < 10 ? '0' : ''}${mm}`
      visText.textContent = UI.vis(st.env.visibility)
      const cur = st.env.current
      const speed = Math.hypot(cur.x, cur.z)
      curArrow.setAttribute('transform', `rotate(${(Math.atan2(cur.x, -cur.z) * 180) / Math.PI})`)
      curText.textContent = speed < 0.05 ? UI.from.calme : `${speed.toFixed(1)} m/s`
      br.style.display = st.settings.minimap ? '' : 'none'
      br.style.opacity = gp.dialogue.active() ? '0' : '1'
      const g = gp.weather.gite()
      const deg = (Math.hypot(g.roll, g.pitch) * 180) / Math.PI
      giteRow.style.display = deg > 1 ? '' : 'none'
      if (deg > 1) {
        giteText.textContent = UI.gite(deg)
        giteBar.setAttribute('transform', `rotate(${(g.roll * 180) / Math.PI * 4})`)
      }
      const live = [...counters.values()].find((t) => t !== null) ?? null
      counterEl.textContent = live ?? ''
      counterEl.classList.toggle('show', !!live)
      const hasChart = gp.progress().domes.length > 0
      mini.style.display = hasChart ? '' : 'none'
      if (hasChart) {
        miniTimer -= dt
        if (miniTimer <= 0) {
          miniTimer = 0.12
          drawMini()
        }
      }

      const buffs = gp.endurance.buffs()
      if (buffsEl.childElementCount !== buffs.length || buffs.length > 0) {
        buffsEl.textContent = ''
        for (const b of buffs) {
          const label = UI.buffs[b.id as keyof typeof UI.buffs] ?? b.id
          const m = Math.ceil(b.left / 60)
          h('div', 'gp-buff', `${label} · ${m} min`, buffsEl)
        }
      }
    },
    prompt(c) {
      if (!c) {
        prompt.classList.remove('show')
        return
      }
      promptKey.textContent = c.key
      promptLabel.textContent = c.label
      promptHold.hidden = !c.hold
      prompt.classList.toggle('hold', !!c.hold)
      prompt.classList.add('show')
    },
    progress(p) {
      ringCircle.setAttribute('stroke-dasharray', p === null ? '0 200' : `${p * 2 * Math.PI * 17} 200`)
    },
    toast(text) {
      if (toastTimer > 0) toastQueue.push(text)
      else showToast(text)
    },
    waypoint(target) {
      wpTarget = target
      wp.classList.toggle('show', target !== null)
      placeWaypoint()
    },
    tip(text, seconds = 6) {
      keyHint(tipEl, text)
      tipEl.classList.toggle('show', !gp.dialogue.active())
      tipTimer = seconds
    },
    placeName(title, sub) {
      if (placeHeld) {
        heldPlace = [title, sub]
        return
      }
      placeT.textContent = title
      placeS.textContent = sub ?? ''
      place.classList.add('show')
      placeTimer = 2.6
    },
    holdPlace(on) {
      placeHeld = on
      if (on) {
        place.classList.remove('show')
        placeTimer = 0
      } else if (heldPlace) {
        const [title, sub] = heldPlace
        heldPlace = null
        api.placeName(title, sub)
      }
    },
    showHud(vis) {
      hud.classList.toggle('gp-hidden', !vis)
    },
    counter(owner, text) {
      counters.set(owner, text)
    },
    card(title, sub, seconds = 3) {
      placeT.textContent = title
      placeS.textContent = sub
      place.classList.add('show')
      placeTimer = seconds
    },
    flashNacre() {
      const n = gp.inv.count('nacre') % 4
      const full = gp.inv.count('nacre') > 0 && n === 0
      nacreDots.forEach((d, i) => d.classList.toggle('on', full || i < n))
      nacres.classList.add('show')
      nacreTimer = 4
    },
  }
  return api
}
