import type { EmoteId } from '../shared/protocol'

export const EMOTE_LABEL: Record<EmoteId, string> = {
  salut: 'Salut', oui: 'Oui', non: 'Non', rire: 'Rire', applaudir: 'Bravo', montrer: 'Regarde',
  assis: "S'asseoir", dort: 'Dormir', pluie: 'Pluie',
}

export const EMOTE_BUBBLE: Record<EmoteId, string> = {
  salut: 'Salut !', oui: 'Oui !', non: 'Non.', rire: 'Ha ha !', applaudir: 'Bravo !', montrer: 'Regarde !',
  assis: '(s’assoit)', dort: 'Zzz…', pluie: 'Pluie, pluie, va-t’en !',
}

export const TEXT = {
  chatPlaceholder: 'Écrire…',
  chatHint: 'Entrée pour parler',
  aboard: 'À bord',
  rejoin: 'Rejoindre le Drift',
  takenOver: 'Tu as rejoint le Drift depuis un autre onglet. Rejoins-le ici pour reprendre la main.',
  solo: 'Seul à bord',
  connecting: 'Connexion…',
  reconnecting: 'Reconnexion…',
  welcomeTitle: 'Comment tu t’appelles ?',
  welcomeColour: 'Ta couleur',
  welcomeGo: 'Monter à bord',
  welcomeSolo: 'Jouer seul',
  refused: {
    protocol: 'Ton jeu n’est plus à jour : recharge la page.',
    identity: 'Ce nom de bord est déjà pris ailleurs.',
    rate: 'Doucement, laisse parler les autres.',
    invalid: 'Message refusé.',
  },
} as const
