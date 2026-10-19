import { NOMS } from '../../../src/drift/text'
import type { NpcSheet } from './brain'

export type Moment =
  | { kind: 'tick' }
  | { kind: 'talk'; name: string; text: string | null; memory: string | null }

export interface Situation {
  hours: number
  present: readonly string[]
  recent: readonly string[]
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

/** The volatile user turn; everything stable stays in the cached system blocks. */
export function situation(sheet: NpcSheet, s: Situation): string {
  const parts = [
    `Tu es ${sheet.name}, dans ${DISTRICT_NAMES[sheet.district]}. Il est ${clock(s.hours)}.`,
    s.present.length ? `Autour de toi : ${s.present.join(', ')}.` : 'Personne autour de toi.',
  ]
  if (s.recent.length) parts.push(`Ce qui s'est passé tout à l'heure :\n${s.recent.map((e) => `- ${e}`).join('\n')}`)
  if (s.moment.kind === 'tick') {
    parts.push('Personne ne te parle. Que fais-tu maintenant ?')
  } else {
    const { name, text, memory } = s.moment
    parts.push(memory ? `Ce que tu sais de ${name} : ${memory}` : `Tu ne connais pas encore bien ${name}.`)
    parts.push(text ? `${name} te dit : « ${text} »` : `${name} vient te parler.`)
  }
  return parts.join('\n\n')
}
