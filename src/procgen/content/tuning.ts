import type { ArrondissementId, ContentKind, WingId } from '../types'

export const PACING = {
  walkSpeed: 2,
  petit: [25, 40] as const,
  moyenEvery: 120,
  grandEvery: 600,
  startOffset: 12,
  loopShare: 0.35,
  sideStep: 2.2,
} as const

export const PETITS: Readonly<Record<'vignette' | 'banc' | 'rechaud' | 'panneau' | 'chat' | 'vista' | 'trouvaille' | 'pnj', number>> = {
  trouvaille: 3, pnj: 3, vignette: 2, vista: 2, banc: 1.5, rechaud: 1, panneau: 1, chat: 1,
}
export const MOYENS: Readonly<Record<'demande' | 'raccourci' | 'hamac' | 'coque', number>> = { demande: 3, raccourci: 2, hamac: 1, coque: 2 }

export const COUNTS = {
  trouvailles: [5, 7] as const,
  pnjMin: 4,
  demandesMax: 2,
  coques: 1,
} as const

export const SIGHT = { range: 120, cone: Math.cos((32 * Math.PI) / 180), vistaRadius: 3.5, entryMargin: 0, pollEvery: 0.25 } as const

export const RESERVE = { margin: 0.8, trouvaille: 0.6, point: 0.9 } as const

export const MICRO_DEFIS = ['sur-une-lampe', 'dans-un-tuyau', 'derriere-une-trappe', 'au-bout-d-une-poutre', 'sous-une-passerelle', 'en-haut-d-un-filet', 'dans-un-nid-de-chat'] as const
export type MicroDefi = (typeof MICRO_DEFIS)[number]
export const DEFI_LIFT: Readonly<Record<MicroDefi, number>> = {
  'sur-une-lampe': 3.4, 'dans-un-tuyau': 1.2, 'derriere-une-trappe': 0, 'au-bout-d-une-poutre': 4.2,
  'sous-une-passerelle': -1.6, 'en-haut-d-un-filet': 3.8, 'dans-un-nid-de-chat': 2.2,
}

export const PHARES: Readonly<Record<WingId, readonly [ArrondissementId, ArrondissementId, ArrondissementId]>> = {
  babord: ['vigies-babord', 'sechoirs', 'quais-babord'],
  tribord: ['vigies-tribord', 'bibliotheque', 'belvedere'],
}
export const THIRDS_Z = [40, 280] as const

export const KIND_GLOW: Readonly<Partial<Record<ContentKind, number>>> = {
  trouvaille: 0xffd27a, phare: 0xffe2a8, coque: 0x9fd6d0,
}
