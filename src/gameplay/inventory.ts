import type { Gp, Inventory } from './context'
import { ITEMS, UI, trouvailleText } from './text/fr'

export const KEY_ITEMS = ['frottoir', 'lest', 'voile', 'sifflet-raie', 'stylo', 'lanterne'] as const
export const INGREDIENTS = [
  'poisson', 'algue-rouge', 'algue-doree', 'oursin', 'moule', 'crevette', 'sel-de-cheminee', 'plancton', 'mie-du-cuistot',
] as const
export const DISHES = ['soupe-chaude', 'galette-de-plancton', 'brochette', 'pain-du-cuistot', 'rate'] as const

export type ItemCategory = 'outils' | 'ingredients' | 'plats' | 'trouvailles'

export function categoryOf(id: string): ItemCategory {
  if (id.startsWith('trouvaille:')) return 'trouvailles'
  if ((INGREDIENTS as readonly string[]).includes(id)) return 'ingredients'
  if ((DISHES as readonly string[]).includes(id)) return 'plats'
  return 'outils'
}

export function isKeyItem(id: string): boolean {
  return (KEY_ITEMS as readonly string[]).includes(id)
}

export function itemName(id: string): string {
  if (id.startsWith('trouvaille:')) {
    const n = Number(id.slice('trouvaille:tr-'.length)) - 1
    return trouvailleText(Math.max(0, n)).nom
  }
  return ITEMS[id]?.nom ?? id
}

const UPGRADE_PREFIX = 'souffle+'

export function createInventory(gp: Gp): Inventory {
  const items = () => gp.ctx.state.inventory.items

  const bagIds = () =>
    Object.entries(items()).filter(([id, n]) => n > 0 && (categoryOf(id) === 'ingredients' || categoryOf(id) === 'plats')).map(([id]) => id)

  const api: Inventory = {
    canHold(id) {
      const cat = categoryOf(id)
      if (cat !== 'ingredients' && cat !== 'plats') return true
      if ((items()[id] ?? 0) > 0) return true
      return bagIds().length < gp.ctx.state.inventory.slots
    },
    give(id, n = 1, quiet = false) {
      if (n <= 0) return false
      if (!api.canHold(id)) {
        gp.toast(UI.sacPlein)
        return false
      }
      if (isKeyItem(id) && (items()[id] ?? 0) > 0) return true
      items()[id] = (items()[id] ?? 0) + n
      gp.ctx.bus.emit('item:gained', { itemId: id, count: n })
      if (!quiet) gp.toast(`${UI.obtenu} : ${itemName(id)}${n > 1 ? ` ×${n}` : ''}`)
      return true
    },
    take(id, n = 1) {
      if (isKeyItem(id)) return false
      const have = items()[id] ?? 0
      if (have < n) return false
      if (have === n) delete items()[id]
      else items()[id] = have - n
      return true
    },
    has: (id) => (items()[id] ?? 0) > 0,
    count: (id) => items()[id] ?? 0,
    nacreUpgrades() {
      const flags = gp.ctx.state.flags
      return Object.keys(flags).filter((k) => k.startsWith(UPGRADE_PREFIX) && flags[k]).length
    },
    addNacreUpgrade() {
      const k = api.nacreUpgrades()
      gp.ctx.state.flags[`${UPGRADE_PREFIX}${k + 1}`] = true
    },
  }
  return api
}
