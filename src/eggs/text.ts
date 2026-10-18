export type Line = readonly [speaker: string | null, text: string]

export const PROMPTS = {
  parler: 'Parler',
  lire: 'Lire',
  ecouter: 'Écouter',
  ramasser: 'Ramasser',
  decrocher: 'Décrocher',
  interroger: 'Interroger',
  aider: 'Aider',
  regarder: 'Regarder',
}

export const SPEAKER = {
  rebot: 'Rébot',
  jus: 'Le Jus du matin',
  greffier: 'Le Greffier des Noms',
  atlas: 'ATLAS',
  scan: 'Le scan perdu',
  chevre: 'La Chèvre d’Or',
  camp: 'Panneau',
  ours: 'Un ours en peluche',
}

export const REBOT = {
  bonjour: [
    'Bip. Je suis Rébot. Je compte les colis du Drift. Tous. Même les vides.',
    'Plan-Explorer m’a encore posé une question. Je ne lui avais rien demandé. C’est comme ça que commence la singularité ?',
    'Le Cuistot dit que je suis un banger. Je ne sais pas ce que c’est, mais je le prends.',
    'La Grande Commande ? Commencée à 4 h, finie à midi. Huit heures. J’en rêve encore. Enfin, quand je dors.',
    'Pression du jour : 2 sur 5. Encore une belle journée de vitres qui s’annonce.',
    'Si tu frottes une vitre et que personne ne la regarde, est-ce qu’elle est propre ? Je pose la question pour un ami.',
  ],
  chevrePerdue: 'Si tu croises la chèvre, dis-lui de revenir. Sans elle, le Marché n’est plus pareil.',
  chevreTrouvee: 'La chèvre est revenue. Tout le monde respire. Moi aussi. Enfin, je ventile.',
  apresDanse: 'Ça s’est très bien passé. Je suis épuisé. Les deux en même temps.',
  sixSept: 'Six… sept ! … Je ne sais pas pourquoi je dis ça. Personne ne sait.',
  cafe: 'Bip. Café. Ne pas parler à Rébot avant 11 h. Sauf toi. Un peu.',
  dort: 'Zzz… colis… colis… franco… Zzz…',
  assis: 'Tu étais parti. Alors je me suis assis. C’est le protocole.',
  bonnet: 'Mon bonnet ! Il était coincé au plafond ? Ça explique le froid.',
  bonnetMerci: 'Rébot porte son bonnet. Il ne l’enlèvera plus.',
}

export const JUS = {
  titre: 'LE JUS DU MATIN',
  sous: 'Encore une belle journée qui s’annonce',
  heure: '9 h 30 — tous les jours',
  questions: [
    'Comment tu te sens ?',
    'Qu’as-tu fait hier ?',
    'Ta priorité du jour ?',
    'Pression sur 5 ?',
    'Comment l’équipe peut t’aider ?',
  ],
  reponses: (pression: number, mouille: boolean): Line[] => [
    [SPEAKER.jus, 'Encore une belle journée qui s’annonce ! Cinq questions, pas une de plus.'],
    [SPEAKER.jus, `Comment tu te sens ? — ${mouille ? 'Mouillé.' : 'Sec. Pour l’instant.'}`],
    [SPEAKER.jus, 'Qu’as-tu fait hier ? — Des vitres. Ta priorité du jour ? — Des vitres.'],
    [SPEAKER.jus, `Pression sur 5 ? — ${pression}/5.${pression >= 4 ? ' Respire. Littéralement.' : ''}`],
    [SPEAKER.jus, 'Comment l’équipe peut t’aider ? — En ne touchant pas aux vitres.'],
    [null, 'Quelqu’un a écrit au crayon, tout en bas : « il est terrifiant, ce jus ».'],
  ],
}

export const GREFFIER = {
  noms: ['passerelle-2', 'drift-passerelle-deux', 'drift-coque-passerelle-02', 'passerelle-est-officielle'],
  plaque: 'NOM DE CETTE PASSERELLE',
  juge: (nom: string): Line => [SPEAKER.greffier, `Bonjour. Le nom « ${nom} » ne respecte pas les règles de nommage du Drift.`],
  propose: (nom: string): Line => [SPEAKER.greffier, `Nouveau nom : « ${nom} ». Merci de votre compréhension.`],
  boucle: [null, 'La plaque affiche de nouveau son tout premier nom. Le Greffier semble satisfait.'] as Line,
}

export const ATLAS = {
  ecran: ['ATLAS', 'Demande-moi', 'n’importe quoi.'],
  accueil: [SPEAKER.atlas, 'Bonjour. Demandez-moi n’importe quoi, en français ou en anglais.'] as Line,
  questions: [
    ['Pourquoi la vitre est sale ?', 'J’ai interrogé 400 coques. Réponse : le revêtement. Recommandation : frotter. Confiance : 0,97.'],
    ['Combien de moules demain ?', 'Prévision : 42. Sur-commande détectée en cuisine. Je ne juge pas.'],
    ['La Chose existe ?', 'Requête refusée. Même moi, j’ai peur.'],
    ['Résume la journée.', 'Jus du matin, tournée des vitres, rupture de crevettes au Marché. Une belle journée qui s’annonce.'],
    ['Qui est le meilleur laveur de vitres ?', 'Un seul laveur trouvé dans la base. Classement : premier. Félicitations.'],
    ['Pourquoi le ciel est en haut ?', 'Données insuffisantes sur le « ciel ». Voulez-vous dire « plafond » ?'],
  ] as const,
  chevre: ['Où est la chèvre ?', 'Capteur « chèvre » muet depuis le départ du Drift. Dernière position connue : quelque part au-dessus du Réfectoire.'] as const,
  chevreOk: ['Où est la chèvre ?', 'Chèvre localisée. Statut : GOAT.'] as const,
  toi: 'Toi',
}

export const SCAN = {
  bip: [
    [SPEAKER.scan, 'Bip !'],
    [null, 'Un scan perdu sous une couche ouverte. Il cherche son colis depuis des jours.'],
    [SPEAKER.scan, 'Bip… bip ! Un chiffre arrive en double.'],
    [null, 'Tu lui montres le Marché, au bout de la passerelle. Il file en clignotant.'],
  ] as Line[],
  rentre: 'Le scan perdu a retrouvé son colis.',
}

export const CHEVRE = {
  rencontre: [
    [null, 'Une petite chèvre d’or, posée sur un socle, au fond d’un sanctuaire que personne n’a jamais signalé.'],
    [null, 'Personne ne sait qui l’avait retirée. Elle est revenue, comme si de rien n’était.'],
    [SPEAKER.chevre, '…'],
    [null, 'Elle a l’air de penser qu’elle est la meilleure. Elle a peut-être raison.'],
  ] as Line[],
  trouvee: 'La Chèvre d’Or est retrouvée',
  deja: [[null, 'La Chèvre d’Or veille. Le Marché a retrouvé le sourire.']] as Line[],
}

export const CAMP = [
  [SPEAKER.camp, 'ICI, SUR CE TOIT, UNE ÉQUIPE A SURVÉCU VINGT-QUATRE HEURES.'],
  [SPEAKER.camp, 'Elle a écrit « Prêts à survivre ! » au départ, et « On a survécu » au retour.'],
  [null, 'Plus bas, d’une autre main : « Trois jours ici, et en dessous tout est tombé en panne. Personne ne sait pourquoi. »'],
] as Line[]

export const OURS = [
  [null, 'Un ours en peluche, un peu mouillé, assis sur une caisse de jus.'],
  [null, 'Son étiquette dit : « aide aux ours ». Quelqu’un a corrigé au feutre : « AI des ours ».'],
] as Line[]

export const POSTERS = {
  comptage: {
    titre: 'COMPTAGE GUIDÉ',
    lignes: ['1. Scanne.', '2. Compte.', '3. Souffle.', 'Un chiffre en double ?', 'Recompte.'],
  },
  antigaspi: {
    titre: 'ANTI-GASPI',
    lignes: ['Rien ne se jette.', 'Tout se mange.', 'Étiquette jaune : -30 %', 'Le Cuistot compte sur toi.'],
  },
  creneaux: {
    titre: 'PRODUCTION DU JOUR',
    lignes: [
      { h: 6, t: 'Créneau 6 h — pain' },
      { h: 11, t: 'Créneau 11 h — soupe' },
      { h: 17, t: 'Créneau 17 h — galettes' },
    ],
    signature: 'validé par le chef',
  },
  commande: {
    titre: 'LA GRANDE COMMANDE',
    lignes: ['Commencée à 4 h.', 'Finie à midi.', 'Le Drift s’en souvient.'],
  },
  patee: {
    titre: 'AUX ROIS DE LA PÂTÉE',
    lignes: ['800 coques livrées', 'en une seule saison.'],
  },
  avis: {
    titre: 'AVIS',
    lignes: ['Qui a retiré la chèvre ?', 'Elle était là.', 'Elle n’y est plus.', 'Récompense : la gloire.'],
    tampon: 'RETROUVÉE',
  },
  retro: {
    titre: 'RÉTRO DU LUNDI',
    colonnes: ['Aimé', 'Appris', 'Manqué', 'Espéré'],
    notes: [['le pain'], ['frotter en rond'], [], ['la pluie ?']],
  },
  mercuriale: {
    titre: 'MERCURIALE DU JOUR',
    produits: ['Algue dorée', 'Oursin', 'Crevette', 'Moule', 'Mie du Cuistot', 'Sel de cheminée'],
    prix: ['3 coquillages le colis', '2 coquillages le colis', 'franco : 5 colis', '-30 % anti-gaspi', 'sur commande', '1 coquillage la pincée'],
    rupture: 'RUPTURE',
  },
  camp: { titre: 'CAMP DE SURVIE', lignes: ['24 h.', 'On a survécu.'] },
  remise: { titre: 'LA REMISE DU JUS', lignes: ['Pression du jour', '2/5'] },
}

export const PLAFOND = {
  titre: 'Objet du plafond',
  compte: (n: number, total: number) => `${n}/${total}`,
  complet: 'Tous les objets du plafond sont retrouvés',
  objets: {
    scanette: { nom: 'Une scanette', note: 'Pépin dit que c’est un poisson qui fait bip.' },
    gobelet: { nom: 'Un gobelet de jus', note: 'Il sent encore le jus du matin. Tao trouve ça terrifiant.' },
    etiquette: { nom: 'Une étiquette jaune « -30 % »', note: 'Mila l’a collée sur Pépin. Pépin a refusé d’être soldé.' },
    colis: { nom: 'Un colis vide', note: 'Mila l’a compté trois fois. Il est toujours vide.' },
    stylo: { nom: 'Un stylo de salon', note: 'Quelqu’un voulait vraiment faire signer quelqu’un.' },
    casque: { nom: 'Un casque marqué « 2/5 »', note: 'Tao dit que c’est la pression maximale d’un crabe.' },
    disquette: { nom: 'Une disquette', note: 'L’étiquette dit : « encore une belle journée qui s’annonce ».' },
    bonnet: { nom: 'Un bonnet minuscule', note: 'Trop petit pour un enfant. Juste à la taille d’un petit robot.' },
  },
}

export const BRIBES: Record<string, readonly string[]> = {
  cuistot: ['Rien ne se jette. Anti-gaspi, petit.', 'Créneau de onze heures : la soupe. Validé par moi-même.'],
  'mme-rouille': ['Prévision du jour : rupture de crevettes probable.', 'Les meilleurs dorment pendant que ça marche.'],
  'grand-pere': ['De mon temps, la mercuriale tenait sur une ardoise.', 'Un bon compte, c’est un compte qu’on refait.'],
  mila: ['Rébot a dansé ! Tu l’as vu danser ?'],
  tao: ['Pression sur cinq : zéro. Je suis un enfant.'],
  pepin: ['Qui a retiré la chèvre ?'],
}
