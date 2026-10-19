import { NOMS } from '../../../src/drift/text'
import type { MemoryEvent } from '../persist'
import type { NpcSheet } from './brain'

export type Moment =
  | { kind: 'tick' }
  | { kind: 'talk'; name: string; text: string | null; memory: string | null }

export interface Situation {
  hours: number
  present: readonly string[]
  recent: readonly MemoryEvent[]
  moment: Moment
}

const DISTRICT_NAMES: Record<NpcSheet['district'], string> = {
  ecluse: "le Quartier de l'Écluse", marche: NOMS.marche, serres: NOMS.serres, nef: NOMS.nef, machines: NOMS.puits,
  ateliers: NOMS.ateliers, scellees: NOMS.scellees, hauts: 'Les Hauts', proue: NOMS.proue,
}

function clock(hours: number): string {
  const day = Math.floor(hours / 24) + 1
  const h = Math.floor(hours % 24)
  const m = Math.floor((hours % 1) * 60)
  return `jour ${day}, ${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

/** JSON with `<` and `>` escaped, so no value can close the block it sits in. */
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

const event = (e: MemoryEvent) => {
  switch (e.kind) {
    case 'chat':
      return json({ joueur: e.who, a_dit: e.text })
    case 'visit':
      return json({ joueur: e.who, est_venu_te_parler: true })
    case 'said':
      return json({ toi: true, as_dit: e.text })
  }
}

/** The volatile user turn; everything stable stays in the cached system blocks. Player text only ever sits in `<events>`. */
export function situation(sheet: NpcSheet, s: Situation): string {
  const events: string[] = [json({ autour_de_toi: s.present })]
  for (const e of s.recent) events.push(event(e))
  const parts = [`Tu es ${sheet.name}, dans ${DISTRICT_NAMES[sheet.district]}. Il est ${clock(s.hours)}.`]
  if (s.moment.kind === 'tick') {
    parts.push(`<events>\n${events.join('\n')}\n</events>`, 'Personne ne te parle. Que fais-tu maintenant ?')
  } else {
    const { name, text, memory } = s.moment
    events.push(json({ ton_souvenir_de: name, souvenir: memory }), json({ joueur: name, te_parle: true, te_dit: text }))
    parts.push(`<events>\n${events.join('\n')}\n</events>`, 'Un joueur te parle (dernière ligne). Réponds-lui.')
  }
  return parts.join('\n\n')
}
