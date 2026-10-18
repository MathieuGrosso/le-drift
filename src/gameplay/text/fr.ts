import type { RegionId, RoomId } from '../../core/types'
import type { Line } from '../context'

export const SPEAKERS: Record<string, string> = {
  'grand-pere': 'Grand-père',
  cuistot: 'Le Cuistot',
  'mme-rouille': 'Mme Rouille',
  mila: 'Mila',
  tao: 'Tao',
  pepin: 'Pépin',
  enfants: 'Les enfants',
  drift: 'Le Drift',
}

export const NPC_IDS = ['grand-pere', 'cuistot', 'mme-rouille', 'mila', 'tao', 'pepin'] as const

export const REGION_NAMES: Record<RegionId, string> = {
  prairie: "La Prairie de l'Écluse",
  laminaires: 'La Forêt de Laminaires',
  pilier: 'Le Pilier et les Arches',
  cheminee: 'La Cheminée',
  coques: 'Le Cimetière des Coques',
  blanc: 'Le Blanc',
  bleu: 'Le Bleu',
}

export const ROOM_NAMES: Record<RoomId, string> = {
  sas: 'Le Sas',
  'coursive-sud': 'La Coursive',
  refectoire: 'Le Réfectoire',
  rebord: 'Le Rebord',
  cuisine: 'La Cuisine',
  marche: 'Le Marché',
  'passerelle-1': 'La Passerelle',
  'passerelle-2': 'La Passerelle',
  'passerelle-3': 'La Passerelle',
  'salle-des-cartes': 'La Salle des Cartes',
  cabine: 'Ta cabine',
  'cabines-voisins': 'Les Cabines',
  'echelle-toit': 'La Trappe',
}

export const SONDE_NAMES: Record<string, string> = {
  'sonde-promontoire': 'Sonde du Promontoire',
  'sonde-pilier': 'Sonde du Pilier',
  'sonde-laminaires': 'Sonde des Laminaires',
  'sonde-cheminee': 'Sonde de la Cheminée',
  'sonde-coques': 'Sonde des Coques',
  'sonde-blanc': 'Sonde du Seuil Blanc',
}

export const SHALLOW_NAMES: Record<string, { nom: string; regle: string }> = {
  'hf-01': { nom: 'Haut-fond des Bulles', regle: 'Les bulles portent ce qui est léger.' },
  'hf-02': { nom: 'Haut-fond de la Lentille', regle: 'Ce qui est propre laisse passer la lumière.' },
  'hf-03': { nom: 'Haut-fond du Flotteur', regle: 'Le courant porte ce qui flotte.' },
  'hf-04': { nom: 'Haut-fond des Laminaires', regle: 'Les laminaires se balancent avec le courant.' },
  'hf-05': { nom: 'Haut-fond des Miroirs', regle: 'Les coquilles-miroirs renvoient la lumière.' },
  'hf-06': { nom: 'Haut-fond de la Chaleur', regle: "L'eau chaude monte, et la voile avec." },
  'hf-07': { nom: 'Haut-fond de la Cloche', regle: 'Une bulle prisonnière soulève le lourd.' },
  'hf-08': { nom: 'Haut-fond des Bancs', regle: 'Les poissons suivent la nourriture.' },
  'hf-09': { nom: 'Le Blanc · La Course au Revêtement', regle: 'Ici, le revêtement repousse en quelques secondes.' },
  'hf-10': { nom: 'Le Blanc · Le Rayon', regle: 'Une lentille propre, un miroir bien tourné.' },
  'hf-11': { nom: 'Le Blanc · La Colonne', regle: 'Les bulles soulèvent même ce qui est lourd.' },
  'hf-12': { nom: 'Le Seuil', regle: '' },
}

export interface ItemText { nom: string; desc: string }

export const ITEMS: Record<string, ItemText> = {
  frottoir: { nom: 'Le frottoir', desc: 'Une brosse de laiton au bout d’un long manche. Elle a lavé onze mille vitres, plusieurs fois.' },
  lest: { nom: 'Le lest', desc: 'Ta ceinture de laiton. Sans elle, tu remontes.' },
  voile: { nom: 'La voile', desc: 'La vieille voile de Grand-père. Ouvre-la en tombant ; le courant fait le reste.' },
  'sifflet-raie': { nom: 'Le sifflet', desc: 'Siffle, et la raie vient.' },
  stylo: { nom: 'Le stylo', desc: 'Le stylo de Grand-père. Il a creusé un sillon dans le papier.' },
  lanterne: { nom: 'La lanterne', desc: 'Elle éclaire. Les méduses adorent ça.' },
  nacre: { nom: 'Nacre', desc: 'Un éclat pris au sommet d’un haut-fond. Grand-père en échange quatre contre du souffle.' },
  poisson: { nom: 'Poisson', desc: 'Du poisson. Encore.' },
  'algue-rouge': { nom: 'Algue rouge', desc: 'Croquante. Pousse sur les rochers de la Prairie.' },
  'algue-doree': { nom: 'Algue dorée', desc: 'Un bout de laminaire. Sucrée, presque.' },
  oursin: { nom: 'Oursin', desc: 'Piquant dehors, doux dedans.' },
  moule: { nom: 'Moule', desc: 'Accrochée à tout ce qui ne bouge pas.' },
  crevette: { nom: 'Crevette', desc: 'Elle se débat encore un peu.' },
  'sel-de-cheminee': { nom: 'Sel de cheminée', desc: 'Tiède au toucher. Vient des fumeurs noirs.' },
  plancton: { nom: 'Plancton', desc: 'Une poignée qui brille un peu.' },
  'mie-du-cuistot': { nom: 'Mie du Cuistot', desc: 'Ce que le Cuistot appelle du pain.' },
  'soupe-chaude': { nom: 'Soupe chaude', desc: 'Le souffle revient moitié plus vite. 3 min.' },
  'galette-de-plancton': { nom: 'Galette de plancton', desc: 'Remplit le souffle d’un coup.' },
  brochette: { nom: 'Brochette', desc: 'Le sprint coûte un tiers de souffle en moins. 3 min.' },
  'pain-du-cuistot': { nom: 'Pain du Cuistot', desc: 'Remplit le souffle et l’allonge un peu. 3 min.' },
  rate: { nom: 'Plat raté', desc: 'Ça se mange. À peine.' },
}

export const PROMPTS = {
  parler: 'Parler',
  frotter: 'Frotter',
  sonde: 'Activer la sonde',
  entrerSas: 'Entrer dans le sas',
  sortir: 'Sortir',
  ouvrir: 'Ouvrir',
  fermer: 'Fermer',
  asseoir: "S'asseoir",
  monter: 'Monter',
  carte: 'Se pencher sur la carte',
  dormir: 'Dormir',
  etal: "Regarder l'étal",
  ramasser: 'Ramasser',
  prendre: 'Prendre',
  lacher: 'Lâcher',
  miroir: 'Tourner le miroir',
  repere: 'Poser un repère',
  cuisiner: 'Cuisiner',
  tableau: 'Lire le tableau',
  nourrir: 'Nourrir la raie',
  chevaucher: 'Monter sur la raie',
  nacre: 'Prendre la nacre',
} as const

export const UI = {
  nouvelleTache: 'Nouvelle tâche',
  tacheFinie: 'Tâche accomplie',
  obtenu: 'Obtenu',
  sacPlein: 'Ton sac est plein.',
  vis: (v: number) => (v >= 999 ? 'Vis. beaucoup' : `Vis. ${v} m`),
  pause: {
    titre: 'Pause',
    reprendre: 'Reprendre',
    ecluse: "Revenir à l'écluse",
    reglages: 'Réglages',
    commandes: 'Commandes',
    retour: 'Retour',
    objectif: 'En ce moment',
    aucun: 'Rien de pressé. La mer est grande.',
  },
  reglages: {
    inverser: 'Inverser la caméra verticale',
    sensibilite: 'Sensibilité de la caméra',
    volume: 'Volume',
    minicarte: 'Mini-carte',
  },
  commandes: [
    ['Se déplacer', 'move'],
    ['Caméra', 'Souris'],
    ['Monter · coup de palme · s’agripper · voile', 'up'],
    ['Descendre · lâcher', 'down'],
    ['Sprint', 'sprint'],
    ['Interagir · parler', 'interact'],
    ['Frotter', 'scrub'],
    ['Siffler la raie', 'whistle'],
    ['Carte', 'map'],
    ['Inventaire', 'inventory'],
    ['Recentrer la caméra', 'recenter'],
    ['Pause', 'pause'],
  ] as const,
  inventaire: {
    titre: 'Sac',
    onglets: { outils: 'Outils', ingredients: 'Ingrédients', plats: 'Plats', trouvailles: 'Trouvailles' },
    vide: 'Rien ici pour l’instant.',
    manger: 'Manger',
    nourrir: 'Lâcher pour les poissons',
    places: (n: number, max: number) => `${n} / ${max} places`,
    nacres: (n: number) => `${n} nacre${n > 1 ? 's' : ''}`,
  },
  cuisine: {
    titre: 'La marmite',
    tutoriel: 'Deux poissons et un peu de mie. Clique sur un ingrédient pour le mettre dans la marmite.',
    aide: 'Jusqu’à cinq ingrédients. Le même mélange donne toujours le même plat.',
    cuisiner: 'Cuisiner',
    vider: 'Vider',
    fermer: 'Fermer',
    rien: 'Tu n’as rien à cuisiner.',
    resultat: (nom: string) => `Tu as cuisiné : ${nom}`,
  },
  marche: {
    titre: 'Le Marché',
    sous: 'On échange ici. Personne n’a jamais vu une pièce.',
    echanger: 'Échanger',
    montrer: 'Montrer une trouvaille',
    pasAssez: 'Pas assez.',
    fermer: 'Fermer',
  },
  sommeil: {
    titre: 'Dormir',
    aube: "Dormir jusqu'à l'aube",
    midi: "Dormir jusqu'à midi",
    soir: "Dormir jusqu'au soir",
    annuler: 'Annuler',
  },
  tableau: {
    titre: 'Prévisions',
    sous: 'Affiché par Mme Rouille, gardienne de l’écluse',
    fermer: 'Fermer',
  },
  carte: {
    titre: 'La carte du Grand-père',
    ecluse: "Revenir à l'écluse",
    fermer: 'Fermer',
    voyager: (nom: string) => `Aller à la ${nom}`,
    legende: 'Clique sur une sonde réveillée pour y retourner.',
    blanc: 'le blanc',
    vous: 'toi',
    drift: 'le Drift',
    sillon: 'le sillon',
    ici: 'Tu es ici',
  },
  scrubDone: 'Propre.',
  qualite: 'Qualité réduite',
  bleuRetour: 'Le Bleu te repousse doucement.',
  reperesManquants: (n: number) => `Le blanc est encore trop blanc. Pose d’abord tes repères (${n}/3).`,
  nacreQuatre: 'Quatre nacres. Grand-père saura quoi en faire.',
  souffleAllonge: 'Ton souffle s’allonge.',
  sondeSous: 'La carte se dessine',
  hautFond: 'Haut-fond',
  repereLabel: (n: number) => `Repère ${n}/3`,
  clap: {
    titre: 'Le jeu de mains',
    aide: (key: string) => `Frappe dans tes mains avec [${key}] quand le cercle touche l’anneau.`,
    score: (n: number, max: number) => `${n} / ${max}`,
  },
  fin: 'Fin',
  continuer: 'continuer',
  forecast: {
    vis: (v: number) => (v >= 999 ? 'Visibilité : beaucoup' : `Visibilité ${v} m`),
    courant: (from: string) => `Courant ${from}`,
    meduses: 'Risque de méduses',
    pasMeduses: 'Pas de méduses',
    plancton: 'Bloom de plancton',
    pluie: 'Pluie (?)',
  },
  from: { nord: 'du nord', sud: 'du sud', est: 'de l’est', ouest: 'de l’ouest', calme: 'calme' },
  buffs: { regen: 'Soupe chaude', sprint: 'Brochette', bonus: 'Pain du Cuistot' },
  rangement: 'Dans le sac',
} as const

export const ACT_CARDS: Record<1 | 2 | 3, { titre: string; sous: string }> = {
  1: { titre: 'Acte I', sous: 'La Vitre' },
  2: { titre: 'Acte II', sous: 'Le Nord' },
  3: { titre: 'Acte III', sous: 'Le Blanc' },
}

export interface QuestText { titre: string; steps: Record<string, string> }

export const QUESTS: Record<string, QuestText> = {
  'a1-reveil': {
    titre: 'Le réveil',
    steps: { sas: 'Aller au sas', tableau: 'Lire le tableau des prévisions', sortir: 'Sortir par le sas' },
  },
  'a1-corde': { titre: 'La corde', steps: { coque: 'Suivre la corde jusqu’à la grande vitre' } },
  'a1-grande-vitre': { titre: 'La grande vitre', steps: { frotter: 'Frotter la grande vitre' } },
  'a1-chose': { titre: 'La Chose', steps: { regarder: 'Lever les yeux' } },
  'a1-petit-dejeuner': {
    titre: 'Le petit-déjeuner',
    steps: { rentrer: 'Rentrer par le sas', cuisine: 'Rejoindre le Cuistot à la cuisine', cuisiner: 'Cuisiner ton petit-déjeuner' },
  },
  'a1-rebord': { titre: 'Le rebord', steps: { rebord: 'Rejoindre les enfants sur le rebord', jeu: 'Jouer au jeu de mains' } },
  'a1-grand-pere': {
    titre: 'La vitre de Grand-père',
    steps: { vitre: 'Frotter la vitre de Grand-père, en dernier', carte: 'Rejoindre Grand-père dans la salle des cartes' },
  },
  'a1-sonde': { titre: 'La vieille sonde', steps: { sonde: 'Réveiller la Sonde du Promontoire' } },
  'a1-voile': { titre: 'La voile', steps: { retour: 'Montrer la carte à Grand-père' } },
  'a2-sondes': {
    titre: 'Le Nord',
    steps: { sondes: 'Réveiller trois sondes', rentrer: 'Rentrer au Drift et dormir' },
  },
  'a2-raie': { titre: 'La raie coincée', steps: { raie: 'Nourrir la raie coincée dans le courant (facultatif)' } },
  'a3-matin': { titre: 'Le troisième matin', steps: { refectoire: 'Prendre le petit-déjeuner au réfectoire' } },
  'a3-pluie': { titre: 'Le mot', steps: { salle: 'Rejoindre Grand-père' } },
  'a3-mesures': { titre: 'Les mesures', steps: { reperes: 'Poser trois repères dans le Blanc' } },
  'a3-seuil': { titre: 'Le Seuil', steps: { seuil: 'Atteindre le Seuil' } },
}

export const INTRO: readonly string[] = [
  'À peu près deux fois par jour, quelque chose tombe à travers le plafond, attrape un poisson, et remonte.',
  'Personne ne sait où ça va.',
  'Tu essaies de le savoir depuis que tu as six ans.',
  'Tu vis dans le Drift : quarante mille personnes dans quatre cents coques, qui vont toutes quelque part, à peu près à la vitesse d’un pas.',
  'Tout ce qui reste immobile dans la mer se couvre d’un pelage. Le Drift a onze mille vitres.',
  'Toi, tu les laves. De l’extérieur.',
]

export const TIPS = {
  sas: (e: string) => `[${e}] près de la porte ronde pour entrer dans le sas.`,
  nage: (up: string, down: string) => `[${up}] coup de palme · [${down}] descendre · le lest te fait couler doucement.`,
  grimper: 'Nage contre la coque pour t’y agripper. Grimper coûte du souffle.',
  frotter: (f: string) => `Maintiens [${f}] face à la vitre pour frotter.`,
  carte: (m: string) => `[${m}] ouvre la carte du Grand-père.`,
  voile: (up: string) => `En tombant, [${up}] ouvre la voile.`,
  sac: (tab: string) => `[${tab}] ouvre ton sac. Les plats se mangent depuis là.`,
  porter: (e: string) => `[${e}] pour lâcher.`,
}

export const DIALOGUES = {
  tableauA1: [
    ['mme-rouille', 'Debout avant la vitre. C’est bien. Le tableau est à jour.'],
    [null, 'Visibilité 30 m. Courant du sud. Risque de méduses.'],
    ['mme-rouille', 'Tu commences par la grande, comme toujours ? Ils vont tous déjeuner devant.'],
    ['mme-rouille', 'La corde part du sas. Ne la lâche pas avant la coque. Et regarde en l’air, de temps en temps.'],
  ],
  rouille: [
    [['mme-rouille', 'Le tableau ne ment jamais. Il se trompe, parfois. Mais il ne ment pas.']],
    [['mme-rouille', 'Onze mille vitres. Quand tu finis la dernière, la première a repoussé. C’est un bon métier : il ne s’arrête jamais.']],
    [['mme-rouille', 'Ton trajet, c’est quatre minutes. Une écluse, une corde, et de temps en temps une baleine.']],
    [['mme-rouille', 'Plus on monte au nord, plus je dois changer les chiffres. Je n’ai plus de craie pour « beaucoup ».']],
  ],
  grandeVitre: [
    [null, 'Derrière la vitre, tout le Drift prend son petit-déjeuner. Face à toi.'],
    [null, 'Ici, la chose la plus regardée, c’est une fenêtre. Il n’y a rien dessus, la plupart du temps. Parfois un poisson.'],
    ['enfants', 'Une tortue ! Une première !'],
  ],
  chose: [
    [null, 'Quelque chose est tombé à travers le plafond. Ça a pris un poisson. Ça est remonté.'],
    [null, 'Des ronds, là-haut. Puis plus rien.'],
    [null, 'Personne ne sait où ça va.'],
  ],
  cuistotTuto: [
    ['cuistot', 'Ah. Le laveur. Tu gouttes partout.'],
    ['cuistot', 'Il reste du poisson, du poisson, et quelque chose que j’appelle du pain.'],
    ['cuistot', 'Mets-les dans la marmite. Deux poissons, un peu de mie. Tu verras bien.'],
  ],
  cuistotApres: [
    ['cuistot', 'Pas mal. Tu manges en dernier, comme d’habitude.'],
    ['cuistot', 'Va t’asseoir face à ta vitre. Ils te l’ont gardée, la place.'],
    [null, 'Depuis le banc, on voit le coin que tu as oublié. Une petite tache verte, en haut à gauche.'],
    [null, 'Sur le rebord, les enfants ont commencé leur jeu.'],
  ],
  cuistot: {
    1: [['cuistot', 'Qu’est-ce que tu m’apportes ? Tout finit dans la marmite, de toute façon.']],
    2: [['cuistot', 'Plus on monte au nord, plus le poisson est gras. Je ne me plains pas. Je cuisine.']],
    3: [['cuistot', 'Il paraît que ça tombe d’en haut, maintenant. Pas des poissons. De l’eau. Dans l’eau. Je ne comprends pas non plus.']],
  } as Record<1 | 2 | 3, readonly Line[]>,
  rebordAvant: [
    ['mila', 'Tu joues ? On en est au couplet de la pluie.'],
    ['tao', 'Personne ne sait ce que veulent dire les mots.'],
    ['pepin', 'Moi, je sais.'],
    ['mila', 'Non.'],
  ],
  rebordApres: [
    ['tao', 'C’est quoi, une pluie ?'],
    ['pepin', 'Un poisson.'],
    ['mila', 'Tout le monde dit que c’est un poisson.'],
    [null, 'Personne n’a jamais vu de pluie. La plupart des gens pensent que c’est un poisson.'],
    [null, 'Il reste une vitre. Tu fais celle de Grand-père en dernier.'],
  ],
  enfants: [
    [['mila', 'Montre-nous ce que tu as trouvé ! Le musée du rebord a faim.']],
    [['tao', 'J’ai compté les poissons de la vitre ce matin. Sept. Et un qui est passé deux fois.']],
    [['pepin', 'Quand je serai grand, je laverai le plafond.']],
    [['mila', 'Pluie, pluie, va-t’en… Tu crois qu’elle part où, la pluie ?']],
  ],
  musee: (n: number): readonly Line[] =>
    n === 0
      ? [['mila', 'Le musée est vide. Rapporte-nous des choses du plafond !']]
      : [['mila', `${n} trouvaille${n > 1 ? 's' : ''} au musée du rebord. Tao les a toutes mal rangées.`], ['tao', 'Je les ai rangées par goût.']],
  vitreGrandPere: [[null, 'Grand-père te regarde à travers la vitre. Il lève sa tasse, très lentement.']] as readonly Line[],
  carte: [
    ['grand-pere', 'Tu as fait la mienne en dernier. Comme toujours.'],
    ['grand-pere', 'Penche-toi. Voilà toute la mer. Chaque courant, chaque crête, chaque profondeur.'],
    ['grand-pere', 'Mesurés par le Drift depuis plus longtemps que personne ne s’en souvient.'],
    ['grand-pere', 'Sauf les parties blanches. Là, le fond monte vers le plafond. Trop peu profond pour une ville. Personne ne les a mesurées.'],
    ['grand-pere', 'Et ce sillon, c’est mon stylo. Chaque année le même tour. Les mêmes haltes.'],
    ['grand-pere', 'Cette année, la nourriture est partie au nord. Après le haut de la boucle. Vers le blanc.'],
    ['grand-pere', 'Ma carte s’efface, à force. Va réveiller la vieille sonde du Promontoire. Elle redessinera la Prairie.'],
  ],
  voile: [
    ['grand-pere', 'La Prairie est revenue sur le papier. Bien.'],
    ['grand-pere', 'Pour aller plus loin, il te faudra ceci. Ma vieille voile.'],
    ['grand-pere', 'Ouvre-la en tombant. Le courant fera le reste. La chaleur aussi, près de la Cheminée.'],
    ['grand-pere', 'Le Drift tourne au nord. Va devant. Réveille les sondes, et reviens me montrer.'],
  ],
  grandPere: {
    1: [['grand-pere', 'Le blanc, sur la carte, ce n’est pas du vide. C’est juste ce qu’on ne sait pas encore.']],
    2: [['grand-pere', 'Chaque sonde réveillée, c’est un morceau de mer qui revient sur le papier. Continue.']],
    3: [['grand-pere', 'Va. Le stylo sait ce qu’il fait. Toi aussi.']],
  } as Record<1 | 2 | 3, readonly Line[]>,
  sondesRestantes: (n: number): readonly Line[] => [
    ['grand-pere', n > 0 ? `Encore ${n} sonde${n > 1 ? 's' : ''}, et le Drift pourra passer les Coques.` : 'Le passage est ouvert.'],
  ],
  troisSondes: [
    ['grand-pere', 'Trois. Le passage est ouvert.'],
    ['grand-pere', 'Va dormir. Le Drift avancera cette nuit.'],
  ],
  nacres: [
    ['grand-pere', 'Des nacres. Quatre. Donne.'],
    ['grand-pere', 'Respire, maintenant. Lentement. Tu sens ?'],
  ],
  raieVue: [[null, 'Une raie s’est coincée dans un tourbillon. Elle a l’air d’avoir faim.']] as readonly Line[],
  raieNourrie: [
    [null, 'La raie mange dans ta main. Puis elle tourne autour de toi, une fois, deux fois.'],
    [null, 'Elle viendra quand tu siffleras.'],
  ],
  raiePasDePoisson: [[null, 'Elle a faim. Il te faudrait un poisson.']] as readonly Line[],
  matinsNord: [
    [[null, 'Le Drift a avancé pendant la nuit. Le revêtement repousse plus vite, au nord.'], [null, 'Sur le tableau : visibilité 60 m.']],
    [[null, 'La lumière change. Plus blanche. Plus proche.'], [null, 'Sur le tableau : visibilité 90 m.']],
    [[null, 'Le plafond est assez près pour avoir une texture.'], [null, 'Sur le tableau, Mme Rouille a écrit : « beaucoup ».']],
  ] as readonly (readonly Line[])[],
  matin3: [
    [null, 'Le troisième matin, tout le réfectoire se lève d’un coup.'],
    [null, 'La Chose descend juste devant la grande vitre. Des bras beaucoup trop larges. Faits de quelque chose en couches, comme un livre.'],
    [null, 'Un œil tourné vers toi.'],
    [null, 'Elle tient le poisson comme Grand-père tient son stylo.'],
    [null, 'Elle remonte à travers le plafond, et laisse des ronds.'],
  ],
  pluie: [
    [null, 'Par la vitre de Grand-père : des centaines de ronds au plafond. Et pas de poisson dessous.'],
    [null, 'Un son doux, à travers le verre. À travers la coque.'],
    [null, 'Grand-père pose la main à plat sur sa vitre. Ses lèvres font un mot du jeu de mains.'],
    ['grand-pere', '… pluie.'],
    [null, 'Il te regarde. Puis le stylo. Puis le blanc.'],
    ['grand-pere', 'Devant, le fond monte, pâle et ridé. Le blanc de la carte.'],
    ['grand-pere', 'Prends-le. C’est ton tour.'],
  ],
  repere: [[null, 'Tu poses un repère. Sur la carte, une ligne apparaît dans le blanc. De ta main.']] as readonly Line[],
  reperesFini: [[null, 'Trois repères. Le blanc a une forme, maintenant. Elle monte vers le Seuil.']] as readonly Line[],
  fin: [
    [null, 'Ici, le fond touche presque le plafond.'],
    [null, 'Des ronds partout. Des milliers. Sans poisson dessous.'],
    [null, 'Tu détaches le lest.'],
    [null, 'Tu montes.'],
    [null, 'Tu poses la main à plat sur le plafond. Comme Grand-père sur sa vitre.'],
  ],
} as const

export const CREDITS: readonly (readonly [string, string])[] = [
  ['Le Drift', 'Un jeu sur un laveur de vitres, et sur la pluie'],
  ['D’après une histoire', 'de quarante mille personnes dans quatre cents coques'],
  ['La pluie', 'n’est pas un poisson'],
  ['Le blanc', 'a maintenant une première ligne, de ta main'],
  ['Merci', 'd’avoir regardé par la fenêtre'],
]

const TROUVAILLE_NAMES: readonly string[] = [
  'Un parapluie', 'Une cuillère', 'Une clé', 'Une bouteille', 'Un gant', 'Une montre', 'Une tasse', 'Un peigne',
  'Une chaussure', 'Un bouton', 'Des lunettes', 'Un sifflet', 'Une bille', 'Un dé', 'Une bougie', 'Un cadenas',
  'Une boussole', 'Un dé à coudre', 'Une poupée', 'Une fourchette', 'Un ressort', 'Une ampoule', 'Une boîte de conserve',
  'Un bracelet', 'Une pièce', 'Un crayon', 'Une brosse à dents', 'Une petite ancre', 'Un cerf-volant déchiré',
  'Une plume, très légère', 'Un ballon dégonflé', 'Une épingle', 'Une clochette', 'Un harmonica', 'Un miroir de poche',
  'Une bobine de fil', 'Une bouée', 'Un bocal', 'Une étoile en plastique', 'Une lettre illisible', 'Un chapeau',
  'Un yo-yo', 'Un moulin à vent', 'Une loupe', 'Une soucoupe', 'Un hameçon doré', 'Un cadre sans photo', 'Une figurine',
  'Une corne de brume', 'Un livre gonflé', 'Une raquette', 'Une louche', 'Une lanterne de papier', 'Un ticket',
  'Une perle de verre', 'Un collier', 'Une girouette', 'Un réveil', 'Une carte postale', 'Une autre plume',
]

const KID_QUIPS: readonly string[] = [
  'Mila dit que c’est un poisson qui a mal tourné.',
  'Tao pense que ça se mange. Pépin a essayé.',
  'Pépin l’appelle « un poisson du dimanche ».',
  'Mila dit que c’est une coquille pour les gens.',
  'Tao dit que ça vient d’un autre Drift, plus haut.',
  'Pépin dit que c’est une dent de la Chose.',
  'Mila veut le mettre au milieu du musée.',
  'Tao l’a rangé à côté du truc pareil, qui n’est pas pareil.',
  'Pépin dit que ça fait de la pluie. Personne ne le croit.',
  'Mila dit que c’est un poisson. Évidemment.',
  'Tao dit que c’est trop sec pour être d’ici.',
  'Pépin dit que c’est un chapeau pour poisson.',
]

export function trouvailleText(index: number): { nom: string; enfants: string } {
  return {
    nom: TROUVAILLE_NAMES[index % TROUVAILLE_NAMES.length]!,
    enfants: KID_QUIPS[(index * 7) % KID_QUIPS.length]!,
  }
}

export const MARKET_GOSSIP: readonly string[] = [
  'La collectionneuse retourne ta trouvaille dans tous les sens. « Avec du sel de cheminée et du poisson, on fait une soupe qui réchauffe le souffle. »',
  '« Ça ? Ça vient d’en haut. Comme la Chose. » Elle te le rend, l’air de rien. « Le plancton en galette, ça remplit les poumons. »',
  '« Des moules, une algue, une crevette sur un bâton. Ma grand-mère appelait ça une brochette. Ça fait nager loin. »',
  '« Garde-le. Les enfants du rebord en feront un poisson. »',
]

export const TOURNEE_GOSSIP: readonly string[] = [
  'Derrière la vitre, quelqu’un te fait coucou avec une cuillère.',
  'Une voisine colle un dessin contre le verre : un poisson avec des bras trop larges.',
  'Un vieux monsieur tapote la vitre. Il te montre le plafond.',
  'Quelqu’un a écrit « merci » dans la buée, à l’envers.',
]
