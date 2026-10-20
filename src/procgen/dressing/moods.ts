import type { ClusterId, Weighted } from './recipes'

export type MoodId = 'range' | 'encombre' | 'habite' | 'labeur' | 'abandonne' | 'fete'

// A room's story: how full, what it favours, whether it is lit, cats, the archetype's own lines strung across.
export interface Mood {
  fill: number
  bias: Readonly<Partial<Record<ClusterId, number>>>
  cats: number
  lamps: number
  festoons: boolean
  dust: boolean
}

export const MOODS: Readonly<Record<MoodId, Mood>> = {
  range: { fill: 0.8, bias: { etagere: 2.2, pile: 0.4, vide: 1.6, table: 1.2 }, cats: 0.5, lamps: 1, festoons: false, dust: false },
  encombre: { fill: 1.3, bias: { pile: 2.6, etagere: 1.2, vignette: 1.4, vide: 0.3 }, cats: 1.3, lamps: 1, festoons: false, dust: false },
  habite: { fill: 1.1, bias: { vignette: 3, table: 2, plantes: 2.2, couchage: 1.5, hamac: 2.5, rebord: 1.5, pile: 0.6 }, cats: 2, lamps: 1, festoons: true, dust: false },
  labeur: { fill: 1.15, bias: { atelier: 3, pile: 1.6, vignette: 0.4, plantes: 0.5 }, cats: 0.6, lamps: 1, festoons: false, dust: false },
  abandonne: { fill: 0.45, bias: { pile: 1.6, vide: 2.5, plantes: 0.6, table: 0.3 }, cats: 0.7, lamps: 0.25, festoons: false, dust: true },
  fete: { fill: 1.05, bias: { table: 2.5, suspendu: 2, vignette: 1.5, pile: 0.5 }, cats: 1, lamps: 1, festoons: true, dust: false },
}

export const DEFAULT_MOODS: Weighted<MoodId> = [['range', 2], ['encombre', 2], ['habite', 2], ['labeur', 2], ['abandonne', 1], ['fete', 1]]
