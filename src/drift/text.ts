export const DIRECTIONS = ['du nord', 'du nord-est', "de l'est", 'du sud-est', 'du sud', 'du sud-ouest', "de l'ouest", 'du nord-ouest'] as const

export const BOARD = {
  titre: 'Prévisions',
  jour: (d: number) => `Jour ${d}`,
  visibilite: (v: number) => (v >= 999 ? 'Visibilité : beaucoup' : `Visibilité ${v} m`),
  courant: (dir: string) => `Courant ${dir}`,
  courantNul: 'Pas de courant',
  meduses: (j: number) => (j < 0.15 ? 'Pas de méduses' : j < 0.55 ? 'Risque de méduses' : 'Méduses en nombre'),
  plancton: 'Plancton en fleur',
  pluie: 'Des ronds au plafond ?',
  signature: 'Mme Rouille',
}

export const CHATTER: Record<string, readonly string[]> = {
  'grand-pere': [
    'Mon stylo a creusé un sillon. Toujours le même tour.',
    'Le blanc, sur la carte… personne ne l’a jamais mesuré.',
    'Tu as oublié un coin de ma vitre, toi.',
    'Un jour, c’est toi qui tiendras la carte.',
    'Le courant tourne. Je le sens dans les genoux.',
  ],
  'grand-pere-nord': [
    'Plus on monte, plus le plafond a du grain. Regarde.',
    'La lumière a changé. Je n’avais jamais vu ça.',
    'La nourriture est partie au nord. On la suit.',
  ],
  cuistot: [
    'Poisson, poisson, et… du pain. Appelons ça du pain.',
    'Tu gouttes dans ma cuisine.',
    'Le dernier servi, comme toujours. C’est le métier.',
    'Goûte-moi ça. Non, ne demande pas ce que c’est.',
    'Il manque du sel de cheminée. Il manque toujours du sel de cheminée.',
  ],
  'mme-rouille': [
    'Visibilité trente mètres. Comme hier. Comme demain.',
    'Courant du sud, petit. Tiens bien la corde.',
    'Méduses possibles. Prends ton temps dans le sas.',
    'Onze mille vitres. Et une seule personne pour les faire.',
    'Le sas grince. Il a le droit, il est plus vieux que moi.',
  ],
  mila: ['Pluie, pluie, va-t’en…', 'C’est un poisson qui a mal tourné, ça.', 'On a un nouveau truc pour le musée !'],
  tao: ['C’est quoi, une pluie ?', 'Reviens un autre jour…', 'Je parie que la Chose a des dents.'],
  pepin: ['Un poisson. Une pluie, c’est un poisson.', 'Encore ! On recommence !', 'Tu nous montres ce que tu as trouvé ?'],
  repas: [
    'Rien à la vitre ce matin. Juste de l’eau.',
    'Passe-moi le poisson. Non, l’autre poisson.',
    'Tu as vu la tortue ? Une première !',
    'Il est bon, ce pain. Enfin, ce truc.',
    'Chut, regarde : un banc qui passe.',
    'Le petit a encore frotté la grande vitre. On voit loin.',
  ],
  'repas-vitre-sale': [
    'On ne voit plus rien, la vitre est toute poilue.',
    'Quelqu’un pourrait frotter la vitre ? On rate l’émission.',
  ],
  marche: [
    'Trois moules pour une algue dorée, c’est donné.',
    'Elle vient d’en haut, cette chose-là. Paraît-il.',
    'Qui veut un objet tombé du plafond ?',
    'Des oursins frais ! Frais de ce matin !',
    'Ça, c’est un parapluie. Je ne sais pas à quoi ça sert, mais c’est un parapluie.',
  ],
  coursive: [
    'Pardon, je passe.',
    'Ça craque fort aujourd’hui. Le Drift tourne.',
    'Onze mille vitres… courage.',
    'Bonjour, petit. Tu sens l’eau de mer.',
  ],
  hublot: ['Elle va descendre. Regarde bien.', 'Là ! Non… un poisson.', 'Tu crois qu’elle sait qu’on la regarde ?'],
  voisins: ['Zzz…', 'Chut, il y en a qui dorment.', 'Tu peux m’aider ? Ma vitre est toute verte.'],
  nord: ['Il fait plus clair, tu trouves pas ? Le plafond se rapproche.', 'La vitre repousse plus vite, ici.'],
  blanc: ['Tu as vu les ronds au plafond ?', 'Grand-père n’a pas dormi de la nuit.'],
}
