import { DECKS, DISTRICTS, PLACES } from '../../core/layout'
import { mulberry32 } from '../../core/rng'
import { ARCHETYPES } from '../archetypes'
import type { ArchetypeId, ArrondissementId, DistrictPlan, Rng } from '../types'

type Genre = 'm' | 'f'
interface Mot { mot: string; g: Genre }

const m = (mot: string): Mot => ({ mot, g: 'm' })
const f = (mot: string): Mot => ({ mot, g: 'f' })

const LIEUX: readonly Mot[] = [
  f('Rue'), m('Passage'), f('Venelle'), f('Coursive'), f('Allée'), m('Palier'), f('Cour'), f('Impasse'),
  m('Pont'), f('Traverse'), m('Couloir'), f('Galerie'), m('Recoin'), f('Placette'), m('Escalier'), f('Passerelle'),
]

const ADJ: readonly (readonly [string, string])[] = [
  ['Tordu', 'Tordue'], ['Haut', 'Haute'], ['Bas', 'Basse'], ['Étroit', 'Étroite'], ['Penché', 'Penchée'],
  ['Doré', 'Dorée'], ['Oublié', 'Oubliée'], ['Tranquille', 'Tranquille'], ['Vert', 'Verte'], ['Bleu', 'Bleue'],
  ['Long', 'Longue'], ['Chaud', 'Chaude'], ['Endormi', 'Endormie'], ['Rond', 'Ronde'],
]

interface Vocab { de: readonly string[]; surnoms: readonly string[]; objets: readonly Mot[] }

// "de" complements read after a place noun: « La Venelle des Cordières ».
const VOCAB: Readonly<Record<ArchetypeId, Vocab>> = {
  observatoires: {
    de: ['des Guetteuses', 'de la Lunette', 'des Reflets', 'du Compas', 'des Longues-Vues', 'de l’Horizon'],
    surnoms: ['Sextant', 'Lorgnon', 'Boussole', 'Prisme'],
    objets: [m('Compas fêlé'), f('Lentille de cuivre'), f('Carte des reflets'), m('Sablier d’eau'), m('Rapporteur d’os'), f('Loupe de poche'), m('Carnet de quart')],
  },
  corderie: {
    de: ['des Cordières', 'du Grelin', 'des Bobines', 'du Goudron', 'des Fileurs', 'du Chanvre'],
    surnoms: ['Pelote', 'Chanvre', 'Nœud-Coulant', 'Bobine'],
    objets: [f('Bobine de fil d’or'), m('Nœud impossible'), m('Épissoir d’ivoire'), f('Corde chantante'), m('Pot de goudron tiède'), f('Navette de tisserand')],
  },
  lavoirs: {
    de: ['des Lavandières', 'de la Brume', 'des Draps', 'du Savon', 'des Bassins', 'de la Vapeur'],
    surnoms: ['Bulle', 'Lessive', 'Mousseline', 'Battoir'],
    objets: [m('Savon parfumé'), f('Pince à linge d’argent'), m('Mouchoir brodé'), m('Battoir sculpté'), f('Chaussette orpheline'), m('Bouton de nacre')],
  },
  sechoirs: {
    de: ['des Claies', 'du Sel', 'des Chats', 'des Saleuses', 'de l’Argent', 'des Harengs'],
    surnoms: ['Sardine', 'Gros-Sel', 'Moustache', 'Écaille'],
    objets: [m('Grelot de chat'), f('Écaille irisée'), m('Cristal de sel'), f('Arête porte-bonheur'), m('Collier de bouchons'), f('Plume de mouette')],
  },
  bazar: {
    de: ['des Repêchés', 'des Fanions', 'des Horloges', 'des Bocaux', 'des Parapluies', 'du Troc'],
    surnoms: ['Bric-à-Brac', 'Grelot', 'Rouillé', 'Babiole'],
    objets: [f('Montre arrêtée'), m('Parapluie à l’envers'), m('Bocal de billes'), f('Clé sans serrure'), f('Boîte à musique'), m('Dé à coudre doré'), f('Lanterne verte')],
  },
  fourneaux: {
    de: ['des Marmites', 'des Cuisinières', 'du Bouillon', 'des Louches', 'du Fumet', 'des Crêpes'],
    surnoms: ['Louche', 'Pot-au-Feu', 'Croûton', 'Cannelle'],
    objets: [f('Louche de cuivre'), m('Pot d’épices rares'), m('Livre de recettes taché'), f('Cuillère en bois gravée'), m('Moule à gâteau poisson'), m('Sel de lune')],
  },
  forges: {
    de: ['des Riveteurs', 'des Étincelles', 'de l’Enclume', 'des Soufflets', 'de la Coulée', 'des Tôles'],
    surnoms: ['Rivet', 'Étincelle', 'Marteau', 'Tenaille'],
    objets: [m('Rivet d’or'), m('Masque de soudeur peint'), f('Tenaille minuscule'), m('Fer à cheval de mer'), f('Médaille de coque'), m('Clou tordu porte-bonheur')],
  },
  dortoirs: {
    de: ['des Rêveurs', 'des Couchettes', 'de la Veilleuse', 'des Berceuses', 'des Rideaux', 'du Sommeil'],
    surnoms: ['Bâillement', 'Plume', 'Pantoufle', 'Marmotte'],
    objets: [m('Doudou perdu'), f('Veilleuse en coquillage'), m('Dessin plié'), f('Pantoufle brodée'), m('Carnet de rêves'), f('Berceuse écrite')],
  },
  noye: {
    de: ['des Noyés', 'de la Cloche', 'des Radeaux', 'de l’Écho', 'des Algues', 'du Vieux Port'],
    surnoms: ['Goutte', 'Radeau', 'Vase', 'Coquille'],
    objets: [f('Cloche miniature'), f('Bouteille à message'), m('Miroir rouillé'), f('Clé de l’ancien quartier'), m('Portrait délavé'), f('Perle grise')],
  },
  quais: {
    de: ['des Filets', 'des Grues', 'des Pêcheurs', 'des Bouées', 'du Puits de Lune', 'des Mousses'],
    surnoms: ['Bouée', 'Hameçon', 'Mouette', 'Ancre'],
    objets: [m('Hameçon d’argent'), m('Flotteur peint'), f('Boussole de pêcheur'), m('Coquillage géant'), f('Bouée de poche'), m('Filet de soie')],
  },
  citernes: {
    de: ['des Vannes', 'du Lest', 'des Cuves', 'des Manomètres', 'de l’Écho', 'des Plongeurs'],
    surnoms: ['Clapet', 'Écrou', 'Siphon', 'Manomètre'],
    objets: [m('Manomètre de poche'), f('Clé à vanne dorée'), m('Joint en cuir'), f('Bille de plomb'), m('Rivet chanté'), f('Lampe de plongeur')],
  },
  chapelle: {
    de: ['des Cierges', 'des Ex-Votos', 'du Silence', 'de l’Orgue', 'des Prières', 'du Vitrail'],
    surnoms: ['Cierge', 'Bémol', 'Chuchote', 'Vitrail'],
    objets: [m('Ex-voto en poisson'), m('Bout de cierge parfumé'), f('Partition d’orgue'), m('Éclat de vitrail'), m('Chapelet de bouchons'), f('Cloche de verre')],
  },
  laminaires: {
    de: ['des Frondes', 'des Rigoles', 'de la Sève', 'des Jardinières', 'des Pas Japonais', 'de la Rosée'],
    surnoms: ['Fronde', 'Rosée', 'Sève', 'Pousse'],
    objets: [f('Graine de laminaire'), m('Arrosoir minuscule'), f('Fronde dorée'), m('Bulbe lumineux'), f('Feuille pressée'), m('Escargot de verre')],
  },
  nurserie: {
    de: ['des Berceaux', 'des Comptines', 'des Galopins', 'de la Craie', 'des Toupies', 'des Mobiles'],
    surnoms: ['Toupie', 'Biberon', 'Craie', 'Grelot'],
    objets: [f('Toupie peinte'), f('Bille d’agate'), m('Poisson de chiffon'), f('Craie bleue'), m('Mobile en coquilles'), m('Hochet de nacre')],
  },
  potagers: {
    de: ['des Lampes', 'des Radis', 'de la Roue', 'des Semis', 'des Arrosoirs', 'des Courges'],
    surnoms: ['Radis', 'Bêche', 'Courgette', 'Semence'],
    objets: [m('Sachet de graines'), m('Radis géant'), f('Ampoule de pousse'), m('Sécateur ancien'), f('Courge sculptée'), m('Pot de miel de lampe')],
  },
  bibliotheque: {
    de: ['des Journaux', 'des Copistes', 'de l’Encre', 'des Reliures', 'des Échelles', 'du Marque-Page'],
    surnoms: ['Virgule', 'Encrier', 'Marque-Page', 'Grimoire'],
    objets: [m('Journal de bord perdu'), m('Encrier de nacre'), f('Plume de mouette taillée'), m('Marque-page brodé'), f('Page arrachée'), f('Loupe d’archiviste')],
  },
  theatre: {
    de: ['des Ombres', 'des Marionnettes', 'du Rideau', 'des Coulisses', 'de la Rampe', 'des Bravos'],
    surnoms: ['Guignol', 'Coulisse', 'Bravo', 'Silhouette'],
    objets: [f('Marionnette sans fil'), m('Billet du premier soir'), m('Masque de papier'), f('Silhouette découpée'), m('Bouton de velours'), m('Programme dédicacé')],
  },
  viviers: {
    de: ['des Bacs', 'des Bulles', 'des Soigneuses', 'des Épuisettes', 'des Anguilles', 'du Nourrissage'],
    surnoms: ['Bulle', 'Nageoire', 'Épuisette', 'Guppy'],
    objets: [f('Épuisette d’enfant'), m('Œuf de raie'), f('Écaille de carpe dorée'), m('Collier de bulles'), m('Seau à nourriture'), f('Étoile de mer sèche')],
  },
  cathedrale: {
    de: ['des Pistons', 'du Volant', 'des Graisseurs', 'de la Pression', 'des Chauffeurs', 'de la Vapeur'],
    surnoms: ['Piston', 'Burette', 'Bielle', 'Soupape'],
    objets: [f('Burette d’huile'), m('Sifflet à vapeur'), m('Engrenage poli'), f('Clé de douze'), m('Manomètre chantant'), f('Soupape de laiton')],
  },
}

const PRENOMS: Readonly<Record<Genre, readonly string[]>> = {
  f: ['Ninon', 'Lise', 'Margot', 'Odile', 'Bérénice', 'Colette', 'Rosalie', 'Agathe', 'Suzon', 'Lucienne', 'Mireille', 'Apolline', 'Félicie', 'Jeanne', 'Clémence', 'Honorine'],
  m: ['Anselme', 'Gaspard', 'Fernand', 'Léon', 'Barnabé', 'Firmin', 'Octave', 'Achille', 'Basile', 'Eugène', 'Lucien', 'Marius', 'Hippolyte', 'Joseph', 'Tobie', 'Ernest'],
}
const TITRES: Readonly<Record<Genre, readonly string[]>> = {
  f: ['Madame', 'Tante', 'la vieille', 'la petite', 'Mère', 'Mademoiselle'],
  m: ['Maître', 'Oncle', 'le vieux', 'le petit', 'Père', 'Monsieur'],
}

function pick<T>(rng: Rng, a: readonly T[]): T {
  return a[Math.floor(rng() * a.length)]!
}

function article(w: Mot): string {
  return /^[AEIOUÉÈÊH]/.test(w.mot) ? `L’${w.mot}` : `${w.g === 'f' ? 'La' : 'Le'} ${w.mot}`
}

export interface Personne { nom: string; genre: Genre }

export interface DistrictNoms {
  lieux: readonly string[]
  pnj: readonly Personne[]
  trouvailles: readonly string[]
}

const POOL = { lieux: 18, pnj: 14, trouvailles: 9 } as const
const MAX_TRIES = 40

export function deNom(nom: string): string {
  if (nom.startsWith('Les ')) return `des ${nom.slice(4)}`
  if (nom.startsWith('Le ')) return `du ${nom.slice(3)}`
  if (nom.startsWith('La ')) return `de la ${nom.slice(3)}`
  if (nom.startsWith('L’')) return `de l’${nom.slice(2)}`
  return `de ${nom}`
}

function makeLieu(rng: Rng, v: Vocab, chef: () => Personne): string {
  const l = pick(rng, LIEUX)
  const roll = rng()
  if (roll < 0.55) return `${article(l)} ${pick(rng, v.de)}`
  if (roll < 0.8) return `${article(l)} ${deNom(chef().nom)}`
  const adj = pick(rng, ADJ)
  return `${article(l)} ${l.g === 'f' ? adj[1] : adj[0]}`
}

function makePersonne(rng: Rng, v: Vocab): Personne {
  const genre: Genre = rng() < 0.55 ? 'f' : 'm'
  const titre = pick(rng, TITRES[genre])
  const nom = rng() < 0.5 ? `${titre} ${pick(rng, v.surnoms)}` : `${titre} ${pick(rng, PRENOMS[genre])}`
  return { nom: nom.charAt(0).toUpperCase() + nom.slice(1), genre }
}

const QUALIF = [' de Grand-Père', ' du Capitaine', ' de la Première Traversée', ' aux Initiales', ' en Miniature', ' sans Âge', ' du Grand Hiver', ' de Contrebande'] as const

function makeObjet(rng: Rng, v: Vocab): string {
  const base = article(pick(rng, v.objets))
  return rng() < 0.45 ? base : `${base}${pick(rng, QUALIF)}`
}

function coreNames(): Set<string> {
  const out = new Set<string>()
  for (const d of DISTRICTS) out.add(d.nom)
  for (const p of Object.values(PLACES)) out.add(p.nom)
  for (const d of Object.values(DECKS)) out.add(d.nom)
  return out
}

let cache: { key: string; byDistrict: Map<ArrondissementId, DistrictNoms> } | null = null

// Names are drawn ship-wide in table order so every name is unique and stable whatever loads first.
export function shipNoms(districts: readonly DistrictPlan[]): ReadonlyMap<ArrondissementId, DistrictNoms> {
  const key = districts.map((d) => `${d.id}:${d.seed}`).join('|')
  if (cache?.key === key) return cache.byDistrict
  const used = coreNames()
  for (const d of districts) used.add(d.nom)
  for (const a of Object.values(ARCHETYPES)) used.add(a.nom)
  const byDistrict = new Map<ArrondissementId, DistrictNoms>()
  const unique = <T>(make: () => T, label: (t: T) => string): T | null => {
    for (let i = 0; i < MAX_TRIES; i++) {
      const t = make()
      if (!used.has(label(t))) {
        used.add(label(t))
        return t
      }
    }
    return null
  }
  for (const d of districts) {
    const rng = mulberry32(d.seed ^ 0x6e6f6d73)
    const v = VOCAB[d.archetype]
    const pnj: Personne[] = []
    for (let i = 0; i < POOL.pnj; i++) {
      const p = unique(() => makePersonne(rng, v), (x) => x.nom)
      if (p) pnj.push(p)
    }
    const chef = () => pick(rng, pnj)
    const lieux: string[] = []
    for (let i = 0; i < POOL.lieux; i++) {
      const l = unique(() => makeLieu(rng, v, chef), (x) => x)
      if (l) lieux.push(l)
    }
    const trouvailles: string[] = []
    for (let i = 0; i < POOL.trouvailles; i++) {
      const t = unique(() => makeObjet(rng, v), (x) => x)
      if (t) trouvailles.push(t)
    }
    byDistrict.set(d.id, { lieux, pnj, trouvailles })
  }
  cache = { key, byDistrict }
  return byDistrict
}

export function metierNom(archetype: ArchetypeId, i: number): string {
  const jobs = ARCHETYPES[archetype].jobs
  return jobs[i % jobs.length]!
}
