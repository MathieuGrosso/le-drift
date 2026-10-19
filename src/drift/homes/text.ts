import type { HomeRequest } from '../../core/types'
import type { Role } from '../people'

export type TemplateId = 'famille' | 'cabine' | 'atelier' | 'echoppe' | 'salon-the' | 'chambre-enfants' | 'vieux-marin'

export const FAMILLES = [
  'Marin', 'Calfat', 'Ruisseau', 'Lamaneur', 'Hublot', 'Varech', 'Bouline', 'Corail', 'Écume', 'Goémon',
  'Patelle', 'Bigorneau', 'Sardinier', 'Haussière', 'Mousse', 'Brume', 'Coquille', 'Étrave', 'Gréement', 'Cabestan',
] as const

export const PRENOMS = [
  'Aïda', 'Basile', 'Céleste', 'Dorian', 'Elsa', 'Fanch', 'Gaïa', 'Hector', 'Inès', 'Jules', 'Katell', 'Loïc',
  'Maëlle', 'Noé', 'Odile', 'Pablo', 'Rosa', 'Soren', 'Tilda', 'Ugo', 'Yanis', 'Zélie',
] as const

export const MOTS: readonly string[] = [
  'Parti aux Serres.',
  'On revient au prochain banc de sardines.',
  'Partis voir la baleine. Pas de pain aujourd’hui.',
  'Fermé pour sieste.',
  'Au réfectoire. Comme tout le monde.',
  'Si c’est pour la soupe, c’est chez la voisine.',
  'De quart aux machines jusqu’à la marée.',
  'Ne pas frapper : le bébé dort.',
  'Je reviens. Ou alors c’est que je suis parti.',
  'Le chat est dedans. Il garde la maison.',
  'Aux ateliers, le hublot a encore fui.',
  'Partie compter les méduses.',
]

export const NOM_TEMPLATE: Record<TemplateId, (famille: string, prenom: string) => string> = {
  famille: (f) => `Chez les ${f}`,
  cabine: (_, p) => `Cabine de ${p}`,
  atelier: (_, p) => `Atelier de ${p}`,
  echoppe: (f) => `Échoppe ${f}`,
  'salon-the': (_, p) => `Le thé de ${p}`,
  'chambre-enfants': (f) => `Les petits ${f}`,
  'vieux-marin': (_, p) => `Le repaire de ${p}`,
}

export const ROLE_TEMPLATE: Record<TemplateId, Role> = {
  famille: 'cook',
  cabine: 'engineer',
  atelier: 'engineer',
  echoppe: 'vendor',
  'salon-the': 'elder',
  'chambre-enfants': 'kid',
  'vieux-marin': 'elder',
}

export const PAROLES: Record<TemplateId, readonly (readonly string[])[]> = {
  famille: [
    ['Entre, entre ! Essuie tes pieds, tu goûtes toujours.', 'Le hublot, c’est toi qui l’as fait ? On voit enfin les poissons.'],
    ['On est sept là-dedans, plus le chat.', 'Le soir on joue à deviner la profondeur au bruit de la coque.'],
  ],
  cabine: [
    ['C’est petit, mais c’est à moi.', 'La nuit j’entends la Dérive grincer. Ça berce.'],
    ['Tu veux savoir un secret ? Je dors avec la lumière.', 'Les méduses viennent la regarder.'],
  ],
  atelier: [
    ['Attention aux copeaux.', 'Je répare les poulies, les lampes, et parfois les gens qui posent trop de questions.'],
    ['Tout ce qui tombe du plafond, je le garde.', 'Un jour je saurai ce que c’est.'],
  ],
  echoppe: [
    ['Bienvenue ! Tout est à vendre, sauf le chat.', 'Les prix changent avec le courant.'],
    ['Du sel de machine ? Des boutons ? Une histoire ?', 'Les histoires sont gratuites, mais longues.'],
  ],
  'salon-the': [
    ['Assieds-toi. Le thé d’algues, c’est meilleur quand on attend.', 'Tu as les cheveux qui gouttent, comme ton grand-père à ton âge.'],
    ['Avant, on faisait le tour de l’océan en cinq ans.', 'Maintenant en un. On vieillit plus vite, voilà tout.'],
  ],
  'chambre-enfants': [
    ['Chut ! On joue à « Pluie, pluie, va-t’en ».', 'Tu sais ce que c’est, toi, une pluie ?'],
    ['J’ai vu la chose ce matin ! Elle avait des bras comme des pages.', 'Personne me croit.'],
  ],
  'vieux-marin': [
    ['Moi j’ai vu le blanc de la carte, une fois. De loin.', 'Le plafond avait une texture, petit.'],
    ['Quarante ans de vitres. Mes mains sentent encore le savon.', 'Tu fais ça mieux que moi, je crois.'],
  ],
}

export const DEMANDES: readonly HomeRequest[] = [
  { item: 'poisson', ask: 'Tu n’aurais pas un poisson ? Le cuistot n’en a plus pour moi.', thanks: 'Merci ! Tiens, prends ça en échange.', reward: 'pain-du-cuistot' },
  { item: 'algue-doree', ask: 'Une algue dorée, pour la tisane. Les Serres en ont, parfois.', thanks: 'Elle sent le soleil. Enfin, je crois.', reward: 'sel-de-machine' },
  { item: 'moule', ask: 'Rapporte-moi une moule, tu veux ? Pour la soupe de ce soir.', thanks: 'Parfait. Garde ça, c’est pour toi.', reward: 'soupe-chaude' },
  { item: 'crevette', ask: 'Les petits réclament des crevettes. Tu en trouves dehors ?', thanks: 'Ils vont crier de joie. Tiens.', reward: 'galette-de-plancton' },
  { item: 'oursin', ask: 'Un oursin pour ma collection. Avec les piquants, s’il te plaît.', thanks: 'Il est magnifique. Prends ces algues.', reward: 'algue-rouge' },
  { item: 'plancton', ask: 'Un peu de plancton ? Ça éclaire la cabine la nuit.', thanks: 'Regarde comme ça brille ! Merci.', reward: 'moule' },
]

export const PROMPTS_MAISON = {
  parler: (nom: string) => `Parler à ${nom}`,
  lire: 'Lire le mot',
  mot: (texte: string) => `Mot sur la porte : « ${texte} »`,
  demande: (objet: string) => `Demande : apporter ${objet}`,
} as const
