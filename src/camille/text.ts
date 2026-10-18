import type { DrawingId, ReplyId } from './draw'

export type Line = readonly [speaker: string | null, text: string]

export const C = 'Camille'
export const I = 'Ilo'

export const PROMPTS = {
  parler: 'Parler à Camille',
  repondre: 'Dessiner une réponse',
  asseoir: 'S’asseoir à côté',
  ramasser: 'Ramasser le bocal',
  regarder: 'Regarder',
  choisir: 'Que dessiner ?',
}

export const RENCONTRE: readonly Line[] = [
  [C, 'Tu gouttes.'],
  [C, 'Non, c’est bien. Ça veut dire que tu viens de dehors.'],
  [C, 'Moi c’est Camille. Je fais pousser le varech, aux Serres. Enfin, il pousse tout seul. Moi je lui parle.'],
  [null, 'Elle te regarde à travers sa mèche, les paupières à moitié baissées, comme si tu étais une plante qui pousse de travers.'],
  [C, 'Toi, tu es celui qui frotte. Je te vois passer derrière la grande vitre, le matin. Tu fais des ronds.'],
  [I, 'Des ronds ?'],
  [C, 'Avec ta brosse. C’est très joli, des ronds. Bon. Je vais t’appeler Frottoir.'],
  [null, 'Elle repart en aspirant bruyamment son café de varech glacé, avant que tu trouves quoi répondre.'],
]

export const PLAFOND_SOIR: readonly Line[] = [
  [C, 'Chut. Regarde en haut.'],
  [C, 'Tous les soirs je monte ici voir s’il bouge. Le plafond.'],
  [I, 'Et il bouge ?'],
  [C, 'Un peu. Comme quelqu’un qui dort.'],
  [C, 'Ton grand-père dit qu’au-dessus, il n’y a rien. Mais on ne fait pas un plafond pour rien, si ?'],
  [null, 'Vous regardez en haut. Longtemps. Ça ne vous dérange ni l’un ni l’autre.'],
]

export const ASSIS: readonly Line[] = [
  [null, 'Tu t’assieds. Pas trop près. Elle se pousse quand même d’un demi-coussin, vers toi.'],
  [C, 'Là. Tu vois le rond ? Non, l’autre. Non, il est parti.'],
  [C, 'C’est pas grave. Il en reviendra un.'],
]

export const TALK: Record<'refectoire' | 'serres' | 'proue' | 'ailleurs', Record<1 | 2 | 3, readonly string[]>> = {
  refectoire: {
    1: [
      'Je mange debout. D’ici je vois par-dessus les têtes. Toi tu es toujours servi le dernier. On fait une bonne équipe.',
      'C’est un café de varech glacé. Non, tu ne goûtes pas. Bon. Une gorgée. … Voilà. Tu fais la même tête que tout le monde.',
      'Le Cuistot dit que son pain est du pain. Moi je dis que c’est du varech qui a reçu une bonne éducation.',
      'Tu as encore une goutte au bout du nez. Non, l’autre côté. Voilà. Bravo.',
    ],
    2: [
      'Il y a moins de moules. Le Cuistot fait semblant que c’est exprès. C’est mignon.',
      'Tout le monde regarde la vitre en mangeant. Toi tu la regardes comme si tu cherchais une trace.',
    ],
    3: [
      'Ce matin, le plafond a l’air plus près. Ou alors c’est moi qui suis plus grande.',
      'Mange. Les grands moments, ça se rate le ventre vide.',
    ],
  },
  serres: {
    1: ['Chut, elles dorment. Non, je plaisante. Le varech ne dort jamais. Il fait juste semblant quand Nour passe.'],
    2: [
      'Les algues penchent toutes vers le nord. Comme quand on attend quelqu’un à la porte.',
      'Nour dit que je parle trop aux plantes. Je lui ai dit que je parlais exactement assez. Les plantes n’ont pas protesté.',
      'Tu sens ? C’est l’odeur du vert. Personne ne me croit, mais le vert a une odeur.',
      'Mon sécateur s’appelle Monsieur Clac. Il habite dans ma poche de manteau. Il ne coupe que ce qu’on lui demande.',
    ],
    3: [
      'Les feuilles sont devenues toutes pâles, du côté du blanc. Elles ont peur, ou elles se maquillent.',
      'Si un jour il pleut sur les Serres, je laisse tout ouvert. Pour voir ce que ça leur fait.',
    ],
  },
  proue: {
    1: ['Tu n’es pas censé être ici. Moi non plus. Assieds-toi, on ne dira rien.'],
    2: [
      'J’ai compté quarante-trois ronds ce soir. Enfin quarante-deux. Un, c’était moi qui clignais.',
      'Si un jour on passe au travers, tu crois qu’il y a quelqu’un qui frotte de l’autre côté ?',
      'Ton grand-père m’a vue ici. Il m’a fait un clin d’œil. Ou alors il avait une poussière. Je préfère le clin d’œil.',
    ],
    3: [
      'Le plafond a des bosses, ce soir. Des bosses qui viennent du dessus. Je ne savais pas qu’il y avait un dessus au dessus.',
      'Tu vas mesurer le blanc, c’est ça ? Tu me diras combien il fait. En bocaux, si possible.',
    ],
  },
  ailleurs: {
    1: ['Oh. Frottoir. Je passais. Je passe beaucoup, en fait.'],
    2: ['Je cherche Nour. Ou un arrosoir. Le premier des deux qui répondra.'],
    3: ['Tout le Drift est debout. On dirait le matin du premier jour.'],
  },
}

export const APRES_PLUIE = [
  'Ça s’appelle la pluie. Comme dans le jeu de mains. C’était pas un poisson, finalement.',
  'Cours ! Ton grand-père t’attend. Je garde la vitre.',
]
export const APRES_LIGNE = [
  'Tu as tiré une ligne dans le blanc. Moi j’ai dessiné un poisson sur ta vitre. On est quittes.',
  'Il pleut un peu, ce matin. Je laisse les Serres ouvertes. Les algues ont l’air d’aimer ça.',
  'Demain, tu frottes la grande vitre ? Je serai derrière. Je ferai des ronds, pour changer.',
]

export const FINALE = {
  cote: 'Frottoir. Viens. Viens voir.',
  ronds: 'Des ronds… sans poisson dessous.',
  main: 'C’est ça, une pluie ?',
}

export const DOME = 'Elle est à la vigie, juste en dessous. Elle te regarde frotter le dôme et lève le pouce. Puis les deux.'

export interface Exchange {
  id: string
  drawing: DrawingId
  intro: string
  replies: readonly { label: string; draw: ReplyId; reaction: string; mood: 'laugh' | 'shy' | 'wave' | 'hand-on-glass' }[]
  minAct?: 1 | 2 | 3
  flag?: string
}

export const EXCHANGES: readonly Exchange[] = [
  {
    id: 'bonjour', drawing: 'bonjour',
    intro: 'Camille souffle sur la vitre et écrit dans la buée : BONJOUR. À l’envers. Enfin, à l’endroit pour elle.',
    replies: [
      { label: 'Écrire BONJOUR à l’envers, toi aussi', draw: 'bonjour-envers', mood: 'laugh', reaction: 'Elle rit si fort que la buée s’efface toute seule.' },
      { label: 'Dessiner un poisson', draw: 'poisson', mood: 'wave', reaction: 'Elle dessine un deuxième poisson à côté du tien. Il a l’air de se plaire.' },
      { label: 'Faire des ronds', draw: 'ronds', mood: 'shy', reaction: 'Elle hoche la tête, très sérieuse. Des ronds. Elle avait raison.' },
    ],
  },
  {
    id: 'frottoir', drawing: 'frottoir',
    intro: 'Un petit bonhomme avec une brosse trois fois plus grande que lui. C’est toi. La ressemblance est terrible.',
    replies: [
      { label: 'La dessiner, avec son sécateur', draw: 'camille', mood: 'shy', reaction: 'Elle hausse un sourcil. Puis elle te dessine une mèche rebelle, à toi aussi. Pour être quittes.' },
      { label: 'Agrandir encore la brosse', draw: 'grande-brosse', mood: 'laugh', reaction: 'Elle fait non, non, là c’est exagéré. Puis elle l’agrandit encore.' },
      { label: 'Écrire MERCI', draw: 'merci', mood: 'wave', reaction: 'Elle écrit DE RIEN. Dans le bon sens, cette fois. Elle a dû s’entraîner.' },
    ],
  },
  {
    id: 'chose', drawing: 'chose', flag: 'chose-vue',
    intro: 'Elle dessine la chose qui tombe du plafond. Des bras trop grands, un poisson dedans. Puis un point d’interrogation énorme.',
    replies: [
      { label: 'Ajouter un deuxième point d’interrogation', draw: 'question', mood: 'shy', reaction: 'Deux points d’interrogation côte à côte. C’est la conversation la plus honnête du Drift.' },
      { label: 'Écrire UN POISSON, comme au jeu de mains', draw: 'un-poisson', mood: 'laugh', reaction: 'Elle tape dans ses mains derrière la vitre. Pluie, pluie, va-t’en. Tu l’entends presque.' },
      { label: 'Dessiner le plafond et ses ronds', draw: 'ronds2', mood: 'hand-on-glass', reaction: 'Elle trace une flèche du poisson vers tes ronds. Puis elle reste là, à regarder en haut.' },
    ],
  },
  {
    id: 'nord', drawing: 'nord', minAct: 2,
    intro: 'Une algue qui penche, une flèche, et NORD. Les Serres ont choisi leur camp.',
    replies: [
      { label: 'Dessiner une flèche vers le nord, toi aussi', draw: 'fleche', mood: 'wave', reaction: 'Elle tape deux fois sur la vitre. D’accord. On penche ensemble.' },
      { label: 'Dessiner Grand-père et sa carte', draw: 'carte', mood: 'hand-on-glass', reaction: 'Elle prolonge la ligne de la carte jusqu’au bord de la vitre. Elle a l’air très sûre d’elle.' },
      { label: 'Dessiner une algue avec des yeux', draw: 'algue-yeux', mood: 'laugh', reaction: 'L’algue avec des yeux lui plaît beaucoup trop. Elle lui ajoute un chapeau.' },
    ],
  },
  {
    id: 'ce-soir', drawing: 'ce-soir', minAct: 2, flag: 'rdv-proue',
    intro: 'Le dôme de la Proue, deux bonshommes dessous, le nez en l’air. Et : CE SOIR ?',
    replies: [
      { label: 'Écrire OUI', draw: 'oui', mood: 'shy', reaction: 'Elle dessine un tout petit cœur. Puis elle l’efface très vite avec sa manche, comme si de rien n’était.' },
      { label: 'Dessiner deux bonshommes qui regardent en haut', draw: 'deux', mood: 'shy', reaction: 'Elle ajoute des ronds au-dessus de leurs têtes. Puis, tout petit, un cœur, qu’elle efface aussitôt avec sa manche.' },
      { label: 'Dessiner un bol (le dîner d’abord)', draw: 'bol', mood: 'laugh', reaction: 'Elle lève les yeux au plafond. Puis elle dessine un deuxième bol. D’accord : le dîner, puis le dôme.' },
    ],
  },
  {
    id: 'blanc', drawing: 'blanc', minAct: 3,
    intro: 'Un grand rectangle vide, une seule ligne qui y entre. Et : LA PREMIÈRE ?',
    replies: [
      { label: 'Écrire AVEC TOI', draw: 'avec-toi', mood: 'hand-on-glass', reaction: 'Elle pose la main à plat sur la vitre. Tu poses la tienne de l’autre côté. Le verre est froid, puis un peu moins.' },
      { label: 'Dessiner deux lignes côte à côte', draw: 'deux-lignes', mood: 'shy', reaction: 'Deux lignes dans le blanc. Elle les relie d’un petit trait. Un pont, ou une main.' },
      { label: 'Dessiner un point d’interrogation', draw: 'question', mood: 'hand-on-glass', reaction: 'Elle efface ton point d’interrogation et le remplace par un point. Juste un point. C’est oui.' },
    ],
  },
]

export const RITOURNELLES: readonly Exchange[] = [
  {
    id: 'morpion', drawing: 'morpion',
    intro: 'Une grille. Un rond au milieu. Elle tapote la vitre : à toi.',
    replies: [
      { label: 'Une croix dans un coin', draw: 'coin', mood: 'laugh', reaction: 'Elle gagne. Elle gagne toujours. Elle a l’air désolée, mais pas tant que ça.' },
      { label: 'Une croix sur un bord', draw: 'bord', mood: 'wave', reaction: 'Match nul. Elle exige une revanche. Demain. Même vitre.' },
      { label: 'Des poissons dans toutes les cases', draw: 'poissons', mood: 'laugh', reaction: 'Elle déclare que le poisson a gagné. Personne ne conteste.' },
    ],
  },
  {
    id: 'gerard', drawing: 'gerard',
    intro: 'Un gros poisson, et son nom : GÉRARD. Elle a l’air de beaucoup tenir à Gérard.',
    replies: [
      { label: 'Dessiner un ami à Gérard', draw: 'ami', mood: 'shy', reaction: 'Elle dessine un petit cœur entre les deux poissons. Pour Gérard. Seulement pour Gérard.' },
      { label: 'Écrire SALUT GÉRARD', draw: 'bonjour-gerard', mood: 'laugh', reaction: 'Elle fait répondre Gérard d’une voix grave. Tu ne l’entends pas, mais tu sais que c’est une voix grave.' },
      { label: 'Dessiner un poisson beaucoup plus gros derrière', draw: 'requin', mood: 'laugh', reaction: 'Elle fait semblant d’avoir peur pour Gérard. Très mal. Elle rit.' },
    ],
  },
  {
    id: 'meteo', drawing: 'meteo',
    intro: 'Un tableau, comme celui de Mme Rouille. VISIBILITÉ : TOI.',
    replies: [
      { label: 'Écrire COURANT : TOI', draw: 'meteo-toi', mood: 'shy', reaction: 'Elle ne sait plus où regarder. Elle regarde le varech. Le varech ne l’aide pas.' },
      { label: 'Dessiner un truc rond qui brille', draw: 'soleil', mood: 'hand-on-glass', reaction: 'Elle demande, du bout du doigt : c’est quoi ? Tu ne sais pas. Ça vous plaît quand même.' },
      { label: 'Laisser la case vide', draw: 'vide', mood: 'wave', reaction: 'Elle remplit la case d’un rond. Puis d’un deuxième. Prévision : des ronds.' },
    ],
  },
  {
    id: 'plafond', drawing: 'plafond',
    intro: 'Le plafond, des ronds, un bonhomme dessous. Et un point d’interrogation, comme toujours.',
    replies: [
      { label: 'Écrire UN POISSON', draw: 'un-poisson', mood: 'laugh', reaction: 'Elle tape trois fois dans ses mains. Le jeu de mains, toujours. Elle connaît tous les couplets.' },
      { label: 'Dessiner deux bonshommes dessous', draw: 'deux', mood: 'shy', reaction: 'Elle met un doigt sur le deuxième bonhomme, puis sur toi. Puis elle fait semblant de chercher un pli dans sa manche.' },
      { label: 'Dessiner des ronds, encore', draw: 'ronds', mood: 'wave', reaction: 'Elle répond par un rond. Vous faites des ronds jusqu’à ce que la buée soit pleine.' },
    ],
  },
]

export const VITRE = {
  arrive: 'Une lueur verte derrière la vitre. Un bocal de lucioles. Quelqu’un attend.',
  depart: 'Elle te fait un signe, reprend son bocal et s’en va. La buée met longtemps à s’effacer.',
  partie: 'Tu t’es éloigné. Derrière la vitre, la lueur verte hésite, puis s’en va.',
  kicker: 'Vitre',
}

export const QUETE = {
  titre: 'La pousse du plafond',
  debut: [
    [C, 'Frottoir ! Tu tombes bien. Enfin, tu nages bien. Enfin, tu arrives.'],
    [C, 'Regarde cette pousse. Je l’ai trouvée collée au toit de verre, dehors. Une algue qui poussait vers le HAUT. Vers le plafond.'],
    [C, 'Ici, elle boude. Il lui faut une lumière qui ressemble à celle d’en haut.'],
    [C, 'J’avais trois bocaux de lucioles. Je les ai posés quelque part. Trois quelque part différents.'],
    [I, 'Où ?'],
    [C, 'Si je le savais, ce ne serait pas quelque part.'],
    [null, 'Trois bocaux de lucioles, cachés quelque part dans les Serres.'],
  ] as readonly Line[],
  attente: (n: number) => [[C, n === 0 ? 'Trois bocaux. Ils brillent, ça aide. Enfin, normalement.' : `Encore ${3 - n}. Je crois. Je ne compte pas très bien quand je suis contente.`]] as readonly Line[],
  bocaux: [
    { nom: 'Bocal de lucioles', note: 'Posé dans une rigole. Les lucioles ont l’air d’apprécier le courant.' },
    { nom: 'Bocal de lucioles', note: 'Sur la galerie, à côté d’un arrosoir. Camille l’arrose peut-être aussi.' },
    { nom: 'Bocal de lucioles', note: 'Coincé entre deux pots, avec une étiquette : NE PAS OUBLIER ICI.' },
  ],
  compte: (n: number) => `${n} / 3`,
  fin: [
    [C, 'Tu les as trouvés ! Tous les trois ! Même celui que j’avais oublié d’oublier.'],
    [null, 'Elle pose les bocaux autour de la pousse, l’un après l’autre, comme on borde quelqu’un.'],
    [C, 'Allez. Regarde. Là-haut, c’est pareil. En plus grand.'],
    [null, 'La pousse se déplie. Elle monte, elle monte, droit vers le toit de verre, vers le plafond derrière.'],
    [C, '… Elle voulait juste savoir que quelqu’un regardait.'],
    [C, 'Comme nous, un peu.'],
    [null, 'Elle a dit ça très vite. Elle se met à arroser une plante qui n’avait rien demandé.'],
  ] as readonly Line[],
  apres: 'Elle pousse encore. Je lui ai dit que tu passerais la voir. Elle a l’air de t’attendre, tu sais. Elle.',
  toast: 'Quête terminée',
}

export interface GiftText { id: string; nom: string; note: string }
export const CADEAUX: Record<'feuille' | 'dessin' | 'bocal' | 'ligne', GiftText> = {
  feuille: { id: 'feuille', nom: 'Une feuille de varech pressée', note: 'Au dos : « Pour la vitre. Elle était très sale. C. »' },
  dessin: { id: 'dessin', nom: 'Un dessin de la Chose', note: '« Je l’ai vue. Les bras sont trop grands. Toi aussi tu l’as vue ? C. »' },
  bocal: { id: 'bocal', nom: 'Un bocal de lucioles', note: '« Pour ta cabine. Elles éclairent mieux que toi, mais de peu. C. »' },
  ligne: { id: 'ligne', nom: 'Un dessin plié en quatre', note: 'Deux bonshommes, une ligne dans le blanc, et des ronds partout. Pas de mot. Il n’en faut pas.' },
}
export const CADEAU_KICKER = 'Sur ta couchette'
export const CADEAU_ARRIVE = 'Quelqu’un est passé dans ta cabine.'
