import { DISTRICTS } from '../../core/layout'
import { ARCHETYPES } from '../archetypes'
import type { DistrictPlan } from '../types'
import { ARRIVEE } from './tuning'

const CSS = `
.pg-arrivee { position: absolute; left: 0; right: 0; top: ${ARRIVEE.top}; text-align: center; pointer-events: none; opacity: 0; transform: translateY(-6px); transition: opacity ${ARRIVEE.fade}s ease, transform ${ARRIVEE.fade}s ease; color: #fff8ee; font-family: Georgia, 'Times New Roman', serif; }
.pg-arrivee.show { opacity: 1; transform: none; }
.pg-arrivee .k { font-size: clamp(12px, 1.3vw, 16px); letter-spacing: .32em; text-transform: uppercase; opacity: .85; }
.pg-arrivee .t { font-size: clamp(30px, 4vw, 54px); font-weight: 500; letter-spacing: .03em; margin: 4px 0; text-shadow: 0 3px 22px rgba(62,58,90,.7); }
.pg-arrivee .s { font-size: clamp(13px, 1.4vw, 18px); font-style: italic; opacity: .9; text-shadow: 0 2px 12px rgba(62,58,90,.7); }
.pg-arrivee .r { width: 180px; height: 1px; margin: 8px auto; background: linear-gradient(90deg, transparent, rgba(255,210,150,.9), transparent); }
`

export interface Arrivee {
  enter(plan: DistrictPlan): void
  update(dt: number): void
}

// The place card of an arrondissement, each time Ilo walks into a different one.
export function createArrivee(root: HTMLElement): Arrivee {
  if (typeof document === 'undefined') return { enter() {}, update() {} }
  const style = document.createElement('style')
  style.textContent = CSS
  const el = document.createElement('div')
  el.className = 'pg-arrivee'
  const k = document.createElement('div')
  k.className = 'k'
  const t = document.createElement('div')
  t.className = 't'
  const r = document.createElement('div')
  r.className = 'r'
  const s = document.createElement('div')
  s.className = 's'
  el.append(k, t, r, s)
  root.append(style, el)
  let left = 0
  let last: string | null = null
  let since = Infinity
  return {
    enter(plan) {
      if (plan.id === last && since < ARRIVEE.repeatAfter) return
      last = plan.id
      since = 0
      const quartier = DISTRICTS.find((d) => d.id === plan.quartier)?.nom ?? ''
      const arch = ARCHETYPES[plan.archetype].nom
      k.textContent = 'Arrondissement'
      t.textContent = plan.nom
      s.textContent = arch === plan.nom ? quartier : `${arch} · ${quartier}`
      el.classList.add('show')
      left = ARRIVEE.hold
    },
    update(dt) {
      since += dt
      if (left > 0 && (left -= dt) <= 0) el.classList.remove('show')
    },
  }
}
