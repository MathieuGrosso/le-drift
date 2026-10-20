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
    objets: [m('Compas fêlé'), f('Lentille de cuivre'), f('Carte des reflets'), m('Sablier d’eau'), m('Rapporteur d’os'), f('Loupe de poche'), m('Carnet de quart'), m('Télescope de poche'), f('Étoile de mer en laiton')],
  },
  corderie: {
    de: ['des Cordières', 'du Grelin', 'des Bobines', 'du Goudron', 'des Fileurs', 'du Chanvre'],
    surnoms: ['Pelote', 'Chanvre', 'Nœud-Coulant', 'Bobine'],
    objets: [f('Bobine de fil d’or'), m('Nœud impossible'), m('Épissoir d’ivoire'), f('Corde chantante'), m('Pot de goudron tiède'), f('Navette de tisserand'), m('Gant de cordière'), f('Manille rouillée'), m('Tambour de treuil')],
  },
  lavoirs: {
    de: ['des Lavandières', 'de la Brume', 'des Draps', 'du Savon', 'des Bassins', 'de la Vapeur'],
    surnoms: ['Bulle', 'Lessive', 'Mousseline', 'Battoir'],
    objets: [m('Savon parfumé'), f('Pince à linge d’argent'), m('Mouchoir brodé'), m('Battoir sculpté'), f('Chaussette orpheline'), m('Bouton de nacre'), f('Brosse en chiendent'), m('Fer à repasser d’enfant')],
  },
  sechoirs: {
    de: ['des Claies', 'du Sel', 'des Chats', 'des Saleuses', 'de l’Argent', 'des Harengs'],
    surnoms: ['Sardine', 'Gros-Sel', 'Moustache', 'Écaille'],
    objets: [m('Grelot de chat'), f('Écaille irisée'), m('Cristal de sel'), f('Arête porte-bonheur'), m('Collier de bouchons'), f('Plume de mouette'), m('Couteau à écailler'), f('Claie miniature')],
  },
  bazar: {
    de: ['des Repêchés', 'des Fanions', 'des Horloges', 'des Bocaux', 'des Parapluies', 'du Troc'],
    surnoms: ['Bric-à-Brac', 'Grelot', 'Rouillé', 'Babiole'],
    objets: [f('Montre arrêtée'), m('Parapluie à l’envers'), m('Bocal de billes'), f('Clé sans serrure'), f('Boîte à musique'), m('Dé à coudre doré'), f('Lanterne verte'), m('Phonographe muet'), f('Poupée de liège')],
  },
  fourneaux: {
    de: ['des Marmites', 'des Cuisinières', 'du Bouillon', 'des Louches', 'du Fumet', 'des Crêpes'],
    surnoms: ['Louche', 'Pot-au-Feu', 'Croûton', 'Cannelle'],
    objets: [f('Louche de cuivre'), m('Pot d’épices rares'), m('Livre de recettes taché'), f('Cuillère en bois gravée'), m('Moule à gâteau poisson'), m('Sel de lune'), m('Tablier brodé'), f('Marmite cabossée')],
  },
  forges: {
    de: ['des Riveteurs', 'des Étincelles', 'de l’Enclume', 'des Soufflets', 'de la Coulée', 'des Tôles'],
    surnoms: ['Rivet', 'Étincelle', 'Marteau', 'Tenaille'],
    objets: [m('Rivet d’or'), m('Masque de soudeur peint'), f('Tenaille minuscule'), m('Fer à cheval de mer'), f('Médaille de coque'), m('Clou tordu porte-bonheur'), m('Soufflet de poche'), f('Lunette de forgeron')],
  },
  dortoirs: {
    de: ['des Rêveurs', 'des Couchettes', 'de la Veilleuse', 'des Berceuses', 'des Rideaux', 'du Sommeil'],
    surnoms: ['Bâillement', 'Plume', 'Pantoufle', 'Marmotte'],
    objets: [m('Doudou perdu'), f('Veilleuse en coquillage'), m('Dessin plié'), f('Pantoufle brodée'), m('Carnet de rêves'), f('Berceuse écrite'), m('Bonnet de nuit'), f('Couverture rapiécée')],
  },
  noye: {
    de: ['des Noyés', 'de la Cloche', 'des Radeaux', 'de l’Écho', 'des Algues', 'du Vieux Port'],
    surnoms: ['Goutte', 'Radeau', 'Vase', 'Coquille'],
    objets: [f('Cloche miniature'), f('Bouteille à message'), m('Miroir rouillé'), f('Clé de l’ancien quartier'), m('Portrait délavé'), f('Perle grise'), m('Lustre englouti'), f('Ancre d’enfant')],
  },
  quais: {
    de: ['des Filets', 'des Grues', 'des Pêcheurs', 'des Bouées', 'du Puits de Lune', 'des Mousses'],
    surnoms: ['Bouée', 'Hameçon', 'Mouette', 'Ancre'],
    objets: [m('Hameçon d’argent'), m('Flotteur peint'), f('Boussole de pêcheur'), m('Coquillage géant'), f('Bouée de poche'), m('Filet de soie'), f('Casquette de grutière'), m('Nœud de chaise doré')],
  },
  citernes: {
    de: ['des Vannes', 'du Lest', 'des Cuves', 'des Manomètres', 'de l’Écho', 'des Plongeurs'],
    surnoms: ['Clapet', 'Écrou', 'Siphon', 'Manomètre'],
    objets: [m('Manomètre de poche'), f('Clé à vanne dorée'), m('Joint en cuir'), f('Bille de plomb'), m('Rivet chanté'), f('Lampe de plongeur'), m('Robinet de bronze'), f('Jauge fêlée')],
  },
  chapelle: {
    de: ['des Cierges', 'des Ex-Votos', 'du Silence', 'de l’Orgue', 'des Prières', 'du Vitrail'],
    surnoms: ['Cierge', 'Bémol', 'Chuchote', 'Vitrail'],
    objets: [m('Ex-voto en poisson'), m('Bout de cierge parfumé'), f('Partition d’orgue'), m('Éclat de vitrail'), m('Chapelet de bouchons'), f('Cloche de verre'), m('Psautier mouillé'), f('Médaille de quille')],
  },
  laminaires: {
    de: ['des Frondes', 'des Rigoles', 'de la Sève', 'des Jardinières', 'des Pas Japonais', 'de la Rosée'],
    surnoms: ['Fronde', 'Rosée', 'Sève', 'Pousse'],
    objets: [f('Graine de laminaire'), m('Arrosoir minuscule'), f('Fronde dorée'), m('Bulbe lumineux'), f('Feuille pressée'), m('Escargot de verre'), m('Sécateur à frondes'), f('Bouture en flacon')],
  },
  nurserie: {
    de: ['des Berceaux', 'des Comptines', 'des Galopins', 'de la Craie', 'des Toupies', 'des Mobiles'],
    surnoms: ['Toupie', 'Biberon', 'Craie', 'Grelot'],
    objets: [f('Toupie peinte'), f('Bille d’agate'), m('Poisson de chiffon'), f('Craie bleue'), m('Mobile en coquilles'), m('Hochet de nacre'), m('Cerf-volant replié'), f('Dent de lait')],
  },
  potagers: {
    de: ['des Lampes', 'des Radis', 'de la Roue', 'des Semis', 'des Arrosoirs', 'des Courges'],
    surnoms: ['Radis', 'Bêche', 'Courgette', 'Semence'],
    objets: [m('Sachet de graines'), m('Radis géant'), f('Ampoule de pousse'), m('Sécateur ancien'), f('Courge sculptée'), m('Pot de miel de lampe'), f('Binette d’enfant'), m('Épouvantail de poche')],
  },
  bibliotheque: {
    de: ['des Journaux', 'des Copistes', 'de l’Encre', 'des Reliures', 'des Échelles', 'du Marque-Page'],
    surnoms: ['Virgule', 'Encrier', 'Marque-Page', 'Grimoire'],
    objets: [m('Journal de bord perdu'), m('Encrier de nacre'), f('Plume de mouette taillée'), m('Marque-page brodé'), f('Page arrachée'), f('Loupe d’archiviste'), m('Sceau de cire'), f('Reliure dorée')],
  },
  theatre: {
    de: ['des Ombres', 'des Marionnettes', 'du Rideau', 'des Coulisses', 'de la Rampe', 'des Bravos'],
    surnoms: ['Guignol', 'Coulisse', 'Bravo', 'Silhouette'],
    objets: [f('Marionnette sans fil'), m('Billet du premier soir'), m('Masque de papier'), f('Silhouette découpée'), m('Bouton de velours'), m('Programme dédicacé'), f('Lanterne magique'), m('Rideau miniature')],
  },
  viviers: {
    de: ['des Bacs', 'des Bulles', 'des Soigneuses', 'des Épuisettes', 'des Anguilles', 'du Nourrissage'],
    surnoms: ['Bulle', 'Nageoire', 'Épuisette', 'Guppy'],
    objets: [f('Épuisette d’enfant'), m('Œuf de raie'), f('Écaille de carpe dorée'), m('Collier de bulles'), m('Seau à nourriture'), f('Étoile de mer sèche'), m('Bocal à hippocampe'), f('Nasse d’osier')],
  },
  cathedrale: {
    de: ['des Pistons', 'du Volant', 'des Graisseurs', 'de la Pression', 'des Chauffeurs', 'de la Vapeur'],
    surnoms: ['Piston', 'Burette', 'Bielle', 'Soupape'],
    objets: [f('Burette d’huile'), m('Sifflet à vapeur'), m('Engrenage poli'), f('Clé de douze'), m('Manomètre chantant'), f('Soupape de laiton'), m('Piston de montre'), f('Chaudière jouet')],
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

const POOL = { lieux: 18, pnj: 14, trouvailles: 8 } as const
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

// The name after the title is unique per district: never « Madame Pelote » beside « Mère Pelote ».
function makePersonne(rng: Rng, v: Vocab, taken: Set<string>): Personne | null {
  const genre: Genre = rng() < 0.55 ? 'f' : 'm'
  const titre = pick(rng, TITRES[genre])
  const pool = (rng() < 0.5 ? v.surnoms : PRENOMS[genre]).filter((n) => !taken.has(n))
  if (pool.length === 0) return null
  const n = pick(rng, pool)
  taken.add(n)
  const nom = `${titre === 'le vieux' && /^[AEIOUÉH]/.test(n) ? 'le vieil' : titre} ${n}`
  return { nom: nom.charAt(0).toUpperCase() + nom.slice(1), genre }
}

const QUALIF: readonly (readonly [string, number])[] = [
  [' de Grand-Père', 1], [' du Capitaine', 1], [' aux Initiales', 1], [' en Miniature', 1], [' du Grand Hiver', 1],
  [' de Contrebande', 1], [' du Fond de la Cale', 1], [' des Jours de Fête', 1], [' de la Vigie', 1], [' de la Marée Haute', 1],
  [' du Dernier Bal', 1], [' aux Rubans', 1], [' de la Tempête', 1], [' de Tante Mouette', 1], [' du Premier Quart', 1],
  [' de la Première Traversée', 0.2], [' sans Âge', 0.2],
]
const QUALIF_SHARE = 0.55

function weighted<T>(rng: Rng, a: readonly (readonly [T, number])[]): T {
  let r = rng() * a.reduce((s, [, w]) => s + w, 0)
  for (const [t, w] of a) if ((r -= w) <= 0) return t
  return a[a.length - 1]![0]
}

// One noun base and one qualifier per district, so two trouvailles never read as the same object.
function makeObjet(rng: Rng, v: Vocab, taken: Set<string>): string | null {
  const bases = v.objets.filter((o) => !taken.has(o.mot))
  if (bases.length === 0) return null
  const o = pick(rng, bases)
  taken.add(o.mot)
  const free = QUALIF.filter(([q]) => !taken.has(q))
  if (rng() >= QUALIF_SHARE || free.length === 0) return article(o)
  const q = weighted(rng, free)
  taken.add(q)
  return `${article(o)}${q}`
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
  const unique = <T>(make: () => T | null, label: (t: T) => string): T | null => {
    for (let i = 0; i < MAX_TRIES; i++) {
      const t = make()
      if (t !== null && !used.has(label(t))) {
        used.add(label(t))
        return t
      }
    }
    return null
  }
  for (const d of districts) {
    const rng = mulberry32(d.seed ^ 0x6e6f6d73)
    const v = VOCAB[d.archetype]
    const gens = new Set<string>()
    const pnj: Personne[] = []
    for (let i = 0; i < POOL.pnj; i++) {
      const p = unique(() => makePersonne(rng, v, gens), (x) => x.nom)
      if (p) pnj.push(p)
    }
    const chef = () => pick(rng, pnj)
    const lieux: string[] = []
    for (let i = 0; i < POOL.lieux; i++) {
      const l = unique(() => makeLieu(rng, v, chef), (x) => x)
      if (l) lieux.push(l)
    }
    const objets = new Set<string>()
    const trouvailles: string[] = []
    for (let i = 0; i < POOL.trouvailles; i++) {
      const t = unique(() => makeObjet(rng, v, objets), (x) => x)
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
