import type { ArchetypeId, SlotKind } from '../types'
import { DEFAULT_MOODS, type MoodId } from './moods'
import type { ClothLineKind, EmitterKind, LampKind, PropKind } from './plan'

export type ClusterId =
  | 'pile' | 'etagere' | 'etal' | 'table' | 'atelier' | 'couchage' | 'hamac' | 'suspendu' | 'linge'
  | 'plantes' | 'rebord' | 'seuil' | 'vignette' | 'rambarde' | 'vide'

export type Weighted<T> = readonly (readonly [T, number])[]

export interface Recipe {
  density: number
  square?: PropKind
  scraps: 'papier' | 'linge' | 'ecailles' | 'limaille' | 'feuilles' | 'sciure'
  moods: Weighted<MoodId>
  slots: Readonly<Partial<Record<SlotKind, Weighted<ClusterId>>>>
  goods: readonly PropKind[]
  work: readonly PropKind[]
  plants: readonly PropKind[]
  lamps: readonly LampKind[]
  lines: Weighted<ClothLineKind>
  linesPerVoid: readonly [min: number, max: number]
  emitters: Readonly<Partial<Record<'vide' | 'atelier' | 'eau' | 'plafond', EmitterKind>>>
  cats: number
  curtains: boolean
  skinLit: number
}

const BASE_SLOTS: Recipe['slots'] = {
  mur: [['etagere', 3], ['pile', 3], ['table', 1], ['vide', 1]],
  sol: [['table', 3], ['pile', 2], ['plantes', 1], ['vignette', 1], ['vide', 2]],
  plafond: [['suspendu', 3], ['linge', 2], ['vide', 1]],
  coin: [['pile', 4], ['plantes', 2], ['vignette', 1]],
  rambarde: [['rambarde', 3], ['plantes', 1], ['vide', 1]],
  seuil: [['seuil', 3], ['vide', 1]],
  fenetre: [['rebord', 4], ['plantes', 1]],
  etal: [['etal', 1]],
  couchage: [['couchage', 4], ['hamac', 1]],
  atelier: [['atelier', 1]],
}

function recipe(r: Partial<Recipe> & Pick<Recipe, 'goods' | 'work'>): Recipe {
  return {
    density: 1,
    scraps: 'papier',
    moods: DEFAULT_MOODS,
    plants: ['fougere', 'herbes'],
    lamps: ['suspension', 'applique'],
    lines: [['linge', 2], ['fanions', 1], ['ampoules', 1]],
    linesPerVoid: [2, 4],
    emitters: { vide: 'poussiere' },
    cats: 0.15,
    curtains: false,
    skinLit: 0.5,
    ...r,
    slots: { ...BASE_SLOTS, ...r.slots },
  }
}

export const RECIPES: Readonly<Record<ArchetypeId, Recipe>> = {
  observatoires: recipe({
    goods: ['livres', 'lunette', 'tabouret', 'horloge'], work: ['lunette', 'table', 'livres'],
    lamps: ['verte', 'suspension'], lines: [['ampoules', 2], ['fanions', 1]], linesPerVoid: [1, 2],
    slots: { fenetre: [['rebord', 3], ['atelier', 2]] }, skinLit: 0.4,
  }),
  corderie: recipe({
    scraps: 'sciure',
    goods: ['bobine', 'rouleau', 'tonneau', 'caisse'], work: ['bobine', 'rouleau', 'tonneau'],
    lamps: ['lanterne', 'suspension'], lines: [['filet', 2], ['linge', 1], ['ampoules', 1]], density: 1.1,
    slots: { sol: [['atelier', 3], ['pile', 2], ['vide', 1]] },
  }),
  lavoirs: recipe({
    scraps: 'linge',
    goods: ['panier', 'seau', 'sac'], work: ['bassin', 'panier', 'seau'],
    lines: [['linge', 6], ['fanions', 1]], linesPerVoid: [4, 7], curtains: true,
    emitters: { vide: 'vapeur', atelier: 'vapeur', plafond: 'gouttes' },
    slots: { sol: [['atelier', 3], ['linge', 2], ['pile', 1]], plafond: [['linge', 4], ['suspendu', 1]] },
  }),
  sechoirs: recipe({
    scraps: 'ecailles',
    goods: ['tonneau', 'panier', 'caisse', 'chat'], work: ['claie', 'tonneau', 'panier'],
    lines: [['poissons', 5], ['filet', 2]], linesPerVoid: [3, 6], cats: 0.7,
    slots: { mur: [['atelier', 3], ['pile', 2]], sol: [['atelier', 2], ['pile', 2], ['vignette', 1]] },
  }),
  bazar: recipe({
    moods: [['encombre', 4], ['fete', 2], ['habite', 1], ['range', 1]],
    goods: ['bocaux', 'horloge', 'livres', 'caisse', 'panier', 'bouee'], work: ['comptoir', 'bocaux', 'horloge'],
    lamps: ['lanterne', 'globe', 'suspension'], lines: [['fanions', 4], ['ampoules', 3], ['linge', 1]], linesPerVoid: [4, 7],
    slots: { mur: [['etal', 3], ['etagere', 2], ['pile', 1]], sol: [['etal', 2], ['pile', 2], ['vignette', 1]] }, density: 1.2,
  }),
  fourneaux: recipe({
    goods: ['tonneau', 'sac', 'panier', 'bocaux'], work: ['fourneau', 'table', 'seau'],
    lamps: ['lanterne', 'suspension'], lines: [['poissons', 2], ['ampoules', 2], ['linge', 1]],
    emitters: { vide: 'vapeur', atelier: 'vapeur' },
    slots: { mur: [['atelier', 3], ['etagere', 2]], sol: [['table', 4], ['pile', 1]] }, density: 1.1,
  }),
  forges: recipe({
    scraps: 'limaille',
    moods: [['labeur', 4], ['encombre', 2], ['abandonne', 1]],
    goods: ['toles', 'seau', 'caisse', 'tonneau'], work: ['enclume', 'seau', 'toles'],
    lamps: ['lanterne', 'applique'], lines: [['ampoules', 1], ['filet', 1]], linesPerVoid: [1, 2],
    emitters: { vide: 'braises', atelier: 'etincelles' }, cats: 0.05,
    slots: { sol: [['atelier', 3], ['pile', 2]] },
  }),
  dortoirs: recipe({
    square: 'table',
    moods: [['habite', 4], ['range', 2], ['fete', 1], ['abandonne', 1]],
    goods: ['livres', 'jouets', 'panier', 'tabouret'], work: ['couchette', 'livres'],
    lamps: ['applique', 'globe'], lines: [['linge', 3], ['ampoules', 2]], curtains: true, skinLit: 0.85,
    slots: { mur: [['couchage', 4], ['etagere', 1]], sol: [['couchage', 2], ['hamac', 2], ['vignette', 1]] },
  }),
  noye: recipe({
    moods: [['abandonne', 4], ['encombre', 2], ['habite', 1]],
    goods: ['caisse', 'tonneau', 'horloge', 'bouee'], work: ['caisse', 'tonneau'],
    lamps: ['lanterne'], lines: [['filet', 2], ['linge', 1]], density: 0.7, skinLit: 0.2,
    emitters: { eau: 'bulles', plafond: 'gouttes', vide: 'poussiere' },
  }),
  quais: recipe({
    goods: ['caisse', 'tonneau', 'bouee', 'rouleau', 'panier'], work: ['rouleau', 'bouee', 'caisse'],
    lamps: ['lanterne', 'lampadaire'], lines: [['filet', 3], ['poissons', 1], ['ampoules', 2]],
    emitters: { eau: 'bulles', vide: 'poussiere' }, cats: 0.35,
  }),
  citernes: recipe({
    scraps: 'limaille',
    moods: [['abandonne', 3], ['labeur', 3], ['range', 1]],
    goods: ['vanne', 'manometre', 'seau'], work: ['vanne', 'manometre', 'tuyaux'],
    lamps: ['applique', 'lanterne'], lines: [['ampoules', 1]], linesPerVoid: [0, 1], density: 0.65, skinLit: 0.15,
    emitters: { plafond: 'gouttes', eau: 'bulles' }, cats: 0,
    slots: { mur: [['atelier', 3], ['vide', 2]] },
  }),
  chapelle: recipe({
    moods: [['range', 3], ['habite', 2], ['abandonne', 1]],
    goods: ['cierges', 'banc', 'livres'], work: ['cierges', 'banc'],
    lamps: ['suspension', 'lanterne'], lines: [['ampoules', 1]], linesPerVoid: [0, 2], density: 0.8, cats: 0.05,
    slots: { sol: [['atelier', 4], ['vide', 1]], mur: [['atelier', 2], ['plantes', 1], ['vide', 1]] },
    emitters: { vide: 'poussiere' },
  }),
  laminaires: recipe({
    scraps: 'feuilles',
    goods: ['arrosoir', 'seau', 'jardiniere'], work: ['jardiniere', 'arrosoir'],
    plants: ['laminaire', 'fougere', 'lierre'], lamps: ['lampadaire', 'globe'], lines: [['ampoules', 2]], linesPerVoid: [1, 2],
    emitters: { vide: 'poussiere', eau: 'bulles', plafond: 'gouttes' },
    slots: { sol: [['plantes', 4], ['atelier', 1]], mur: [['plantes', 3], ['etagere', 1]] }, density: 1.2,
  }),
  nurserie: recipe({
    square: 'bassin',
    moods: [['habite', 4], ['fete', 2], ['range', 1]],
    goods: ['jouets', 'panier', 'livres', 'berceau'], work: ['berceau', 'jouets'],
    lamps: ['globe', 'suspension'], lines: [['fanions', 3], ['linge', 2]], curtains: true, skinLit: 0.75,
    slots: { sol: [['couchage', 2], ['vignette', 2], ['table', 1]] },
  }),
  potagers: recipe({
    scraps: 'feuilles',
    goods: ['sac', 'arrosoir', 'panier', 'seau'], work: ['jardiniere', 'arrosoir', 'sac'],
    plants: ['herbes', 'fougere', 'lierre'], lamps: ['lampadaire', 'suspension'], lines: [['ampoules', 3], ['linge', 1]],
    slots: { sol: [['atelier', 4], ['plantes', 2]], mur: [['atelier', 2], ['plantes', 2]] }, density: 1.15,
  }),
  bibliotheque: recipe({
    square: 'table',
    moods: [['range', 4], ['habite', 2], ['encombre', 1], ['abandonne', 1]],
    goods: ['livres', 'horloge', 'tabouret'], work: ['etagere', 'table', 'livres'],
    lamps: ['verte', 'suspension'], lines: [['ampoules', 1]], linesPerVoid: [0, 2], curtains: true,
    slots: { mur: [['etagere', 6], ['vide', 1]], sol: [['table', 3], ['vignette', 1]] }, density: 1.15,
  }),
  theatre: recipe({
    moods: [['fete', 3], ['encombre', 2], ['habite', 1]],
    goods: ['banc', 'marionnette', 'caisse'], work: ['marionnette', 'caisse'],
    lamps: ['globe', 'applique'], lines: [['fanions', 3], ['ampoules', 2]], curtains: true,
    slots: { sol: [['atelier', 2], ['table', 1], ['vide', 1]] },
  }),
  viviers: recipe({
    scraps: 'ecailles',
    goods: ['seau', 'epuisette', 'tonneau'], work: ['bassin', 'epuisette', 'seau'],
    lamps: ['globe', 'lanterne'], lines: [['filet', 2], ['ampoules', 1]],
    emitters: { eau: 'bulles', plafond: 'gouttes', vide: 'poussiere' }, cats: 0.4,
  }),
  cathedrale: recipe({
    scraps: 'limaille',
    moods: [['labeur', 3], ['abandonne', 2], ['range', 1]],
    goods: ['engrenage', 'tuyaux', 'manometre', 'seau'], work: ['engrenage', 'vanne', 'manometre'],
    lamps: ['lanterne', 'applique'], lines: [['ampoules', 1]], linesPerVoid: [0, 1], skinLit: 0.3, cats: 0,
    emitters: { vide: 'vapeur', atelier: 'vapeur' },
    slots: { mur: [['atelier', 3], ['pile', 1]], sol: [['atelier', 2], ['vide', 1]] },
  }),
}
