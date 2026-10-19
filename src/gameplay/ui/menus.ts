import type { ButtonAction } from '../../core/types'
import { cookDish, eatDish } from '../cooking'
import type { Gp, Menus } from '../context'
import { categoryOf, DISHES, INGREDIENTS, isKeyItem, itemName, type ItemCategory } from '../inventory'
import { ITEMS, MARKET_GOSSIP, STALLS, UI, trouvailleText } from '../text/fr'
import { button, h } from './dom'

interface Trade { give: Record<string, number>; get: Record<string, number> }
const TRADES: readonly Trade[] = [
  { give: { poisson: 2 }, get: { 'sel-de-machine': 1 } },
  { give: { moule: 2 }, get: { crevette: 2 } },
  { give: { 'algue-rouge': 3 }, get: { 'mie-du-cuistot': 1 } },
  { give: { oursin: 1 }, get: { plancton: 2 } },
  { give: { crevette: 2 }, get: { poisson: 1 } },
  { give: { 'algue-rouge': 2 }, get: { 'algue-doree': 1 } },
  { give: { poisson: 1, moule: 1 }, get: { oursin: 1 } },
  { give: { 'sel-de-machine': 1 }, get: { moule: 2 } },
]

const stallIndex = (id: string) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % STALLS.length
}

export function createMenus(gp: Gp, root: HTMLElement): Menus {
  const ctx = gp.ctx
  let current: { el: HTMLElement; onClose?: () => void; closeKeys: ButtonAction[] } | null = null
  let tab: ItemCategory = 'outils'

  const open = (kind: 'pause' | 'inventaire', closeKeys: ButtonAction[], onClose?: () => void) => {
    api.close()
    const el = h('div', 'gp-menu', undefined, root)
    el.addEventListener('click', (e) => {
      if (e.target === el) api.close()
    })
    const panel = h('div', 'gp-panel', undefined, el)
    current = { el, closeKeys, ...(onClose ? { onClose } : {}) }
    ctx.bus.emit('ui:menu', { open: kind })
    ctx.bus.emit('game:paused', { paused: true })
    if (document.pointerLockElement) document.exitPointerLock()
    return panel
  }

  const title = (panel: HTMLElement, t: string, sub?: string) => {
    h('h2', '', t, panel)
    if (sub) h('p', 'sub', sub, panel)
  }

  const pauseMain = () => {
    const panel = open('pause', ['pause'])
    title(panel, UI.pause.titre)
    const obj = gp.quests.objective()
    const o = h('div', 'gp-objective', undefined, panel)
    h('div', 'k', UI.pause.objectif, o)
    h('div', 't', obj ?? UI.pause.aucun, o)
    const stack = h('div', 'gp-stack', undefined, panel)
    button(UI.pause.reprendre, () => api.close(), stack, 'gp-btn primary')
    button(UI.pause.cabine, () => {
      api.close()
      void gp.travel.returnToCabin()
    }, stack)
    button(UI.pause.ondine, () => {
      api.close()
      ctx.bus.emit('ondine:rejoindre', {})
    }, stack)
    h('p', 'gp-note', UI.pause.progres(gp.domes.count(), gp.scellees.count(), ctx.state.trouvailles.length), panel)
    button(UI.pause.reglages, () => settings(), stack)
    button(UI.pause.commandes, () => controls(), stack)
  }

  const settings = () => {
    const panel = open('pause', ['pause'], () => setTimeout(pauseMain, 0))
    title(panel, UI.pause.reglages)
    const s = ctx.state.settings
    const row = (label: string, input: HTMLInputElement) => {
      const r = h('label', 'gp-setting', undefined, panel)
      h('span', '', label, r)
      r.appendChild(input)
    }
    const check = (v: boolean, set: (v: boolean) => void) => {
      const i = h('input')
      i.type = 'checkbox'
      i.checked = v
      i.addEventListener('change', () => set(i.checked))
      return i
    }
    const range = (v: number, min: number, max: number, step: number, set: (v: number) => void) => {
      const i = h('input')
      i.type = 'range'
      i.min = String(min)
      i.max = String(max)
      i.step = String(step)
      i.value = String(v)
      i.addEventListener('input', () => set(Number(i.value)))
      return i
    }
    row(UI.reglages.inverser, check(s.invertY, (v) => (s.invertY = v)))
    row(UI.reglages.sensibilite, range(s.sensitivity, 0.3, 2.5, 0.05, (v) => (s.sensitivity = v)))
    row(UI.reglages.volume, range(s.volume, 0, 1, 0.05, (v) => (s.volume = v)))
    row(UI.reglages.minicarte, check(s.minimap, (v) => (s.minimap = v)))
    const st = h('div', 'gp-row', undefined, panel)
    st.style.marginTop = '20px'
    button(UI.pause.retour, () => api.close(), st, 'gp-btn primary')
  }

  const controls = () => {
    const panel = open('pause', ['pause'], () => setTimeout(pauseMain, 0))
    title(panel, UI.pause.commandes)
    const grid = h('div', 'gp-controls', undefined, panel)
    for (const [label, action] of UI.commandes) {
      h('span', '', label, grid)
      const keys = h('span', '', undefined, grid)
      if (action === 'move') {
        const kb = ctx.input.device === 'gamepad' ? ['Stick gauche'] : ['ZQSD', 'WASD']
        for (const k of kb) h('span', 'gp-key', k, keys).style.marginLeft = '4px'
      } else if (action === 'Souris') h('span', 'gp-key', ctx.input.device === 'gamepad' ? 'Stick droit' : 'Souris', keys)
      else h('span', 'gp-key', ctx.input.keyLabel(action), keys)
    }
    const st = h('div', 'gp-row', undefined, panel)
    st.style.marginTop = '20px'
    button(UI.pause.retour, () => api.close(), st, 'gp-btn primary')
  }

  const inventory = () => {
    const panel = open('inventaire', ['inventory', 'pause'])
    const items = ctx.state.inventory.items
    const bagCount = Object.entries(items).filter(([id, n]) => n > 0 && ['ingredients', 'plats'].includes(categoryOf(id))).length
    title(panel, UI.inventaire.titre, UI.inventaire.places(bagCount, ctx.state.inventory.slots))
    const tabs = h('div', 'gp-tabs', undefined, panel)
    const body = h('div', '', undefined, panel)
    const render = () => {
      tabs.textContent = ''
      for (const [k, label] of Object.entries(UI.inventaire.onglets) as [ItemCategory, string][]) {
        const t = button(label, () => {
          tab = k
          render()
        }, tabs, `gp-tab${tab === k ? ' on' : ''}`)
        t.style.textAlign = 'center'
      }
      body.textContent = ''
      const ids = Object.keys(items).filter((id) => (items[id] ?? 0) > 0 && categoryOf(id) === tab)
      if (ids.length === 0) {
        h('p', 'gp-note', UI.inventaire.vide, body)
        return
      }
      const grid = h('div', 'gp-grid', undefined, body)
      const order = [...INGREDIENTS, ...DISHES] as readonly string[]
      ids.sort((a, b) => order.indexOf(a) - order.indexOf(b) || a.localeCompare(b))
      for (const id of ids) {
        const card = h('div', 'gp-card', undefined, grid)
        const n = h('div', 'n', undefined, card)
        h('span', '', itemName(id), n)
        const count = items[id] ?? 0
        if (!isKeyItem(id)) h('span', 'c', id === 'nacre' ? UI.inventaire.nacres(count) : `×${count}`, n)
        let desc = ITEMS[id]?.desc ?? ''
        if (id.startsWith('trouvaille:')) desc = trouvailleText(Number(id.slice('trouvaille:tr-'.length)) - 1).enfants
        h('div', 'd', desc, card)
        if (tab === 'plats') {
          button(UI.inventaire.manger, () => {
            eatDish(gp, id)
            render()
          }, card)
        }
      }
    }
    render()
  }

  const cook = (opts?: { tutorial?: boolean; title?: string }) =>
    new Promise<string | null>((resolve) => {
      let result: string | null = null
      const panel = open('pause', ['pause'], () => resolve(result))
      title(panel, opts?.title ?? UI.cuisine.titre)
      h('p', 'gp-note', opts?.tutorial ? UI.cuisine.tutoriel : UI.cuisine.aide, panel)
      const pot: string[] = []
      const potEl = h('div', 'gp-pot', undefined, panel)
      const grid = h('div', 'gp-grid', undefined, panel)
      const resEl = h('div', 'gp-result', '', panel)
      const row = h('div', 'gp-row', undefined, panel)
      row.style.marginTop = '18px'
      const cookBtn = button(UI.cuisine.cuisiner, () => {
        if (pot.length === 0) return
        for (const id of pot) gp.inv.take(id)
        const dish = cookDish(pot)
        pot.length = 0
        gp.inv.give(dish, 1, true)
        result = dish
        resEl.textContent = UI.cuisine.resultat(itemName(dish))
        gp.sfx('marmite')
        ctx.bus.emit('cook:done', { dishId: dish })
        render()
      }, row, 'gp-btn primary')
      button(UI.cuisine.vider, () => {
        pot.length = 0
        render()
      }, row)
      button(UI.cuisine.fermer, () => api.close(), row)
      const render = () => {
        potEl.textContent = ''
        for (let i = 0; i < 5; i++) {
          const id = pot[i]
          const slot = h('div', `gp-slot${id ? ' full' : ''}`, id ? itemName(id) : '', potEl)
          if (id) slot.addEventListener('click', () => {
            pot.splice(i, 1)
            render()
          })
        }
        grid.textContent = ''
        let any = false
        for (const id of INGREDIENTS) {
          const left = gp.inv.count(id) - pot.filter((p) => p === id).length
          if (gp.inv.count(id) <= 0) continue
          any = true
          const card = h('div', 'gp-card pick', undefined, grid)
          const n = h('div', 'n', undefined, card)
          h('span', '', itemName(id), n)
          h('span', 'c', `×${left}`, n)
          card.style.opacity = left > 0 ? '1' : '.4'
          card.addEventListener('click', () => {
            if (left <= 0 || pot.length >= 5) return
            pot.push(id)
            render()
          })
        }
        if (!any) h('p', 'gp-note', UI.cuisine.rien, grid)
        cookBtn.disabled = pot.length === 0
      }
      render()
    })

  const sleep = () => {
    const panel = open('pause', ['pause'])
    title(panel, UI.sommeil.titre)
    const stack = h('div', 'gp-stack', undefined, panel)
    const go = (hour: number) => {
      api.close()
      void gp.sleepUntil(hour)
    }
    button(UI.sommeil.aube, () => go(6), stack, 'gp-btn primary')
    button(UI.sommeil.midi, () => go(12), stack)
    button(UI.sommeil.soir, () => go(18), stack)
    button(UI.sommeil.annuler, () => api.close(), stack)
  }

  const board = () => {
    const panel = open('pause', ['pause', 'interact'])
    title(panel, UI.tableau.titre, UI.tableau.sous)
    const b = h('div', 'gp-board', undefined, panel)
    for (const part of gp.weather.forecastText().split(' · ')) h('div', '', part, b)
    for (const line of gp.tours.boardLines()) h('div', '', line, b)
    const row = h('div', 'gp-row', undefined, panel)
    row.style.marginTop = '20px'
    if (ctx.state.hero.room === 'sas' && ctx.state.mode === 'inside') {
      button(UI.tableau.sortir, () => {
        api.close()
        void gp.indoor.airlock('out')
      }, row)
    }
    button(UI.tableau.fermer, () => api.close(), row, 'gp-btn primary')
  }

  const market = (stallId = 'etal') => {
    const panel = open('pause', ['pause'])
    const k = stallIndex(stallId)
    const stall = stallId === 'etal' ? { nom: UI.marche.titre, sous: UI.marche.sous } : STALLS[k]!
    title(panel, stall.nom, stall.sous)
    const offers = stallId === 'etal' ? TRADES.slice(0, 5) : TRADES.filter((_, i) => (i + k) % 2 === 0 || i === k)
    const list = h('div', 'gp-stack', undefined, panel)
    const note = h('p', 'gp-result', '', panel)
    const render = () => {
      list.textContent = ''
      for (const t of offers) {
        const ok = Object.entries(t.give).every(([id, n]) => gp.inv.count(id) >= n)
        const label = `${Object.entries(t.give).map(([id, n]) => `${n} ${itemName(id)}`).join(' + ')}  →  ${Object.entries(t.get).map(([id, n]) => `${n} ${itemName(id)}`).join(' + ')}`
        const b = button(label, () => {
          if (!ok) {
            note.textContent = UI.marche.pasAssez
            return
          }
          for (const [id, n] of Object.entries(t.give)) gp.inv.take(id, n)
          for (const [id, n] of Object.entries(t.get)) gp.inv.give(id, n, true)
          note.textContent = `${UI.obtenu} : ${Object.entries(t.get).map(([id, n]) => `${n} ${itemName(id)}`).join(', ')}`
          gp.sfx('echange')
          render()
        }, list)
        b.disabled = !ok
      }
      const tr = ctx.state.trouvailles
      if (tr.length > 0) {
        button(UI.marche.montrer, () => {
          const i = (ctx.state.time.day + tr.length) % MARKET_GOSSIP.length
          note.textContent = MARKET_GOSSIP[i]!
        }, list)
      }
    }
    render()
    const row = h('div', 'gp-row', undefined, panel)
    row.style.marginTop = '14px'
    button(UI.marche.fermer, () => api.close(), row, 'gp-btn primary')
  }

  const choose = (t: string, options: { label: string; run: () => void }[], sub?: string) => {
    const panel = open('pause', ['pause', 'interact'])
    title(panel, t, sub)
    const stack = h('div', 'gp-stack', undefined, panel)
    options.forEach((o, i) => button(o.label, () => {
      api.close()
      o.run()
    }, stack, i === 0 ? 'gp-btn primary' : 'gp-btn'))
    button(UI.sommeil.annuler, () => api.close(), stack)
  }

  const api: Menus = {
    choose,
    pause: pauseMain,
    inventory,
    sleep,
    board,
    market,
    cook,
    active: () => current !== null,
    close() {
      if (!current) return
      const c = current
      current = null
      c.el.remove()
      ctx.bus.emit('ui:menu', { open: null })
      ctx.bus.emit('game:paused', { paused: false })
      c.onClose?.()
    },
    update() {
      if (!current) return
      for (const k of current.closeKeys) {
        if (ctx.input.pressed(k)) {
          api.close()
          return
        }
      }
    },
  }
  return api
}
