import type { Gp } from './context'

type Bag = Readonly<Record<string, number>>

interface Recipe { dish: string; test(b: Bag, size: number): boolean }

const n = (b: Bag, id: string) => b[id] ?? 0
const algae = (b: Bag) => n(b, 'algue-rouge') + n(b, 'algue-doree')
const shell = (b: Bag) => n(b, 'moule') + n(b, 'crevette') + n(b, 'oursin')

// Order is the priority: the first match wins, anything else is a « Plat raté ».
const RECIPES: readonly Recipe[] = [
  { dish: 'pain-du-cuistot', test: (b) => n(b, 'mie-du-cuistot') >= 1 && n(b, 'poisson') >= 1 },
  { dish: 'soupe-chaude', test: (b) => n(b, 'sel-de-cheminee') >= 1 && (n(b, 'poisson') >= 1 || shell(b) >= 1) },
  { dish: 'galette-de-plancton', test: (b, size) => n(b, 'plancton') >= 2 || (n(b, 'plancton') >= 1 && algae(b) >= 1 && size <= 3) },
  { dish: 'brochette', test: (b) => shell(b) >= 1 && algae(b) >= 1 },
  { dish: 'brochette', test: (b, size) => n(b, 'poisson') >= 2 && size === n(b, 'poisson') },
]

export function cookDish(ingredients: readonly string[]): string {
  if (ingredients.length === 0 || ingredients.length > 5) return 'rate'
  const bag: Record<string, number> = {}
  for (const id of ingredients) bag[id] = (bag[id] ?? 0) + 1
  for (const r of RECIPES) if (r.test(bag, ingredients.length)) return r.dish
  return 'rate'
}

export function eatDish(gp: Gp, dish: string): boolean {
  if (!gp.inv.take(dish)) return false
  const b = gp.breath
  switch (dish) {
    case 'soupe-chaude':
      b.addBuff('regen', 180)
      b.refill(0.3)
      break
    case 'galette-de-plancton':
      b.refill()
      break
    case 'brochette':
      b.addBuff('sprint', 180)
      b.refill(0.2)
      break
    case 'pain-du-cuistot':
      b.addBuff('bonus', 180)
      b.refill()
      break
    default:
      b.refill(0.1)
  }
  gp.sfx('manger')
  return true
}
