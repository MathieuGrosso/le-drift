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
  demandesMin: 1,
  demandesMax: 2,
  coques: 1,
} as const

export const SIGHT = { range: 120, cone: Math.cos((32 * Math.PI) / 180), vistaRadius: 3.5, entryMargin: 0, pollEvery: 0.25 } as const

export const EVENTS = { maxClockStep: 0.5 } as const

export const TOUCH = { trouvaille: 1.3, demande: 4, chest: 0.6 } as const

export const RESERVE = { margin: 0.8, trouvaille: 0.6, point: 0.9 } as const

export const MICRO_DEFIS = ['sur-une-lampe', 'dans-un-tuyau', 'derriere-une-trappe', 'au-bout-d-une-poutre', 'sous-une-passerelle', 'en-haut-d-un-filet', 'dans-un-nid-de-chat'] as const
export type MicroDefi = (typeof MICRO_DEFIS)[number]
export const DEFI = {
  offsets: [3.4, 2.6] as const,
  shifts: [0, 7, -7, 14, -14] as const,
  clearance: 0.6,
  defaultHeadroom: 5,
  bareLift: 0.2,
} as const

export const PHARES: Readonly<Record<WingId, readonly [ArrondissementId, ArrondissementId, ArrondissementId]>> = {
  babord: ['vigies-babord', 'sechoirs', 'quais-babord'],
  tribord: ['vigies-tribord', 'bibliotheque', 'belvedere'],
}
export const THIRDS_Z = [40, 280] as const

export const KIND_GLOW: Readonly<Partial<Record<ContentKind, number>>> = {
  trouvaille: 0xffd27a, phare: 0xffe2a8, coque: 0x9fd6d0,
}

export const SITE = {
  eye: 1.6, sightAt: 0.7, sightStep: 1.5, pathStep: 1, pathGap: 1.8, between: 5, maxCandidates: 160,
  near: 24, far: 70, distWeight: 3, voidBonus: 3, sightBonus: 4, lotPenalty: 1.2, jitter: 0.3,
  zipLand: 1.5, zipMinRun: 8, zipMinSlope: 0.06,
} as const

export const BEACON = { minLift: 16, gap: 2.5, under: 2, body: 1.1, color: 0xffb766, satellites: 3, satR: 0.45, satDrop: 2.2, satSpread: 2.4, radius: 20, power: 1.1 } as const

export const ARRIVEE = { top: '14%', fade: 0.9, hold: 4.2, repeatAfter: 90 } as const

export const ACCUEIL = { porche: 5, scene: 9, side: 3.4, largeur: 3.2, hautSign: 3.7, reserve: 2.2 } as const

export const FIGURE = { height: 1.7, reach: 0.75, gap: 0.75, post: 2.7, lamp: 0xffc27a, lampRadius: 6, power: 1 } as const
export const PORCHE = { h: 4, pennants: 5, signZ: 0.26 } as const
