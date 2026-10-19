import { SEED } from '../core/layout'
import { hashString } from '../core/rng'
import type { DeckId, DistrictId, Vec3 } from '../core/types'
import { ARCHETYPES } from './archetypes'
import type { ArchetypeId, Box, Column, DistrictPlan, Layer, LandmarkKitId, PortPlan, Rect, ShipPlan, SpineLink, Unlock, WingId } from './types'

export const MONDE_VERSION = 1

const COLUMN_X: Readonly<Record<Column, readonly [number, number]>> = { A: [130, 230], B: [230, 330], C: [330, 430] }
const ROW_Z: readonly (readonly [number, number])[] = [[-200, -80], [-80, 40], [40, 160], [160, 280], [280, 400], [400, 520]]
const LAYER: Readonly<Record<Layer, { y0: number; y1: number; decks: readonly DeckId[]; portY: number }>> = {
  haut: { y0: -6, y1: 30, decks: ['bas', 'principal', 'haut', 'toits', 'domes'], portY: 0 },
  bas: { y0: -24, y1: -6, decks: ['cale', 'machines'], portY: -14 },
}
const BAIE: Rect = { x0: -130, x1: 130, z0: 80, z1: 520 }
const CORE_EDGE = 130
const OPEN: Unlock = { act: 2 }

interface Row {
  id: string
  nom: string
  archetype: ArchetypeId
  wing: WingId
  layer: Layer
  columns: readonly Column[]
  rows: readonly [number, number]
  quartier: DistrictId
  landmarks: readonly LandmarkKitId[]
}

const r = (id: string, nom: string, archetype: ArchetypeId, wing: WingId, layer: Layer, columns: readonly Column[], rows: readonly [number, number], quartier: DistrictId, landmarks: readonly LandmarkKitId[]): Row =>
  ({ id, nom, archetype, wing, layer, columns, rows, quartier, landmarks })

// The authored macro map; the engines generate everything inside each box (docs/MONDE.md §1, §3.1).
const TABLE: readonly Row[] = [
  r('vigies-babord', 'Les Vigies de Bâbord', 'observatoires', 'babord', 'haut', ['A', 'B'], [0, 0], 'ateliers', ['grande-lunette']),
  r('corderie', 'La Longue Corderie', 'corderie', 'babord', 'haut', ['A', 'B'], [1, 1], 'ateliers', ['corderie-cent-metres', 'rouet-geant']),
  r('lavoirs', 'Les Lavoirs de la Brume', 'lavoirs', 'babord', 'haut', ['C'], [1, 1], 'ateliers', ['cascade-des-lavoirs', 'foret-de-draps']),
  r('bazar', 'Le Bazar des Repêchés', 'bazar', 'babord', 'haut', ['A'], [2, 2], 'marche', ['arbre-aux-lanternes']),
  r('sechoirs', 'Les Séchoirs d’Argent', 'sechoirs', 'babord', 'haut', ['B', 'C'], [2, 2], 'marche', ['rideau-d-argent', 'tour-aux-chats']),
  r('fourneaux', 'Les Fourneaux du Flanc', 'fourneaux', 'babord', 'haut', ['A'], [3, 3], 'marche', ['table-cent-couverts']),
  r('forges', 'Les Forges de Coque', 'forges', 'babord', 'haut', ['B', 'C'], [3, 3], 'marche', ['marteau-pilon', 'fontaine-d-etincelles']),
  r('dortoirs-babord', 'Les Coques-Dortoirs', 'dortoirs', 'babord', 'haut', ['A'], [4, 4], 'ecluse', ['mur-mille-hublots']),
  r('noye', 'Le Vieux Quartier Noyé', 'noye', 'babord', 'haut', ['B', 'C'], [4, 4], 'ecluse', ['clocher-englouti', 'rue-sous-l-eau']),
  r('quais-babord', 'Les Quais du Sillage', 'quais', 'babord', 'haut', ['A'], [5, 5], 'ecluse', ['grues-a-filets']),
  r('epaves', 'Le Marché aux Épaves', 'bazar', 'babord', 'haut', ['B'], [5, 5], 'ecluse', ['coque-retournee']),
  r('citernes', 'Les Citernes de Lest', 'citernes', 'babord', 'bas', ['A', 'B'], [1, 2], 'machines', ['citerne-cathedrale']),
  r('chapelle', 'La Chapelle de Quille', 'chapelle', 'babord', 'bas', ['A', 'B'], [3, 4], 'machines', ['vitrail-de-quille', 'orgue-a-vapeur']),

  r('vigies-tribord', 'L’Œil du Plafond', 'observatoires', 'tribord', 'haut', ['A', 'B'], [0, 0], 'scellees', ['oeil-du-plafond']),
  r('laminaires', 'La Forêt sous Verre', 'laminaires', 'tribord', 'haut', ['A', 'B'], [1, 1], 'scellees', ['laminaire-mere']),
  r('berceaux', 'Les Coques-Berceaux', 'nurserie', 'tribord', 'haut', ['C'], [1, 1], 'scellees', ['mobile-des-berceaux', 'toboggan-spirale']),
  r('potagers', 'Les Potagers à Lampes', 'potagers', 'tribord', 'haut', ['A'], [2, 2], 'serres', ['roue-a-eau', 'jardins-suspendus']),
  r('bibliotheque', 'La Coque-Bibliothèque', 'bibliotheque', 'tribord', 'haut', ['B'], [2, 2], 'serres', ['escalier-des-journaux']),
  r('theatre', 'Le Théâtre d’Ombres', 'theatre', 'tribord', 'haut', ['C'], [2, 2], 'serres', ['grand-ecran']),
  r('hamacs', 'Les Hamacs du Soir', 'dortoirs', 'tribord', 'haut', ['A'], [3, 3], 'serres', ['voute-aux-hamacs']),
  r('viviers', 'Les Viviers', 'viviers', 'tribord', 'haut', ['B', 'C'], [3, 3], 'serres', ['vivier-rond']),
  r('quai-des-lampes', 'Le Quai des Lampes', 'quais', 'tribord', 'haut', ['A'], [4, 4], 'ecluse', ['phare-de-la-baie']),
  r('serres-sauvages', 'Les Serres Sauvages', 'laminaires', 'tribord', 'haut', ['B', 'C'], [4, 4], 'ecluse', ['serre-effondree']),
  r('belvedere', 'Le Belvédère de Poupe', 'observatoires', 'tribord', 'haut', ['A'], [5, 5], 'ecluse', ['lanterne-de-poupe']),
  r('fumoir', 'Le Fumoir de Poupe', 'fourneaux', 'tribord', 'haut', ['B'], [5, 5], 'ecluse', ['cheminee-tressee']),
  r('cathedrale', 'La Cathédrale des Machines', 'cathedrale', 'tribord', 'bas', ['A', 'B'], [1, 2], 'machines', ['grand-volant', 'orgues-de-pression']),
  r('ballasts', 'Les Ballasts de Tribord', 'citernes', 'tribord', 'bas', ['A', 'B'], [3, 4], 'machines', ['vanne-maitresse']),
]

export function districtSeed(id: string, variant = 0): number {
  return (SEED ^ hashString(`${MONDE_VERSION}:${id}:${variant}`)) >>> 0
}

function boundsOf(row: Row): Box {
  const xs = row.columns.flatMap((c) => COLUMN_X[c])
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const [x0, x1] = row.wing === 'tribord' ? [lo, hi] : [-hi, -lo]
  const l = LAYER[row.layer]
  return { x0, x1, y0: l.y0, y1: l.y1, z0: ROW_Z[row.rows[0]]![0], z1: ROW_Z[row.rows[1]]![1] }
}

function overlap(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const lo = Math.max(a0, b0)
  const hi = Math.min(a1, b1)
  return hi - lo > 1 ? [lo, hi] : null
}

// Seeded so the port is not always dead centre, but the same for both sides.
function along(lo: number, hi: number, key: string): number {
  const t = 0.3 + 0.4 * (hashString(`${MONDE_VERSION}:port:${key}`) / 0xffffffff)
  return lo + (hi - lo) * t
}

function port(a: string, b: string, kind: PortPlan['kind'], at: Vec3, facing: { x: number; z: number }, core: boolean, unlock?: Unlock): PortPlan {
  return { id: [a, b].sort().join('~'), to: b, core, kind, at, facing, width: kind === 'escalier' ? 2.4 : 3, ...(unlock ? { unlock } : {}) }
}

function portsBetween(a: Row, ab: Box, b: Row, bb: Box): PortPlan | null {
  const key = [a.id, b.id].sort().join('~')
  if (a.layer !== b.layer) {
    const ox = overlap(ab.x0, ab.x1, bb.x0, bb.x1)
    const oz = overlap(ab.z0, ab.z1, bb.z0, bb.z1)
    if (!ox || !oz) return null
    return port(a.id, b.id, 'escalier', { x: along(ox[0], ox[1], `${key}:x`), y: LAYER.haut.y0, z: along(oz[0], oz[1], `${key}:z`) }, { x: 0, z: 0 }, false)
  }
  const y = LAYER[a.layer].portY
  const oz = overlap(ab.z0, ab.z1, bb.z0, bb.z1)
  if (oz && (Math.abs(ab.x1 - bb.x0) < 1 || Math.abs(ab.x0 - bb.x1) < 1)) {
    const x = Math.abs(ab.x1 - bb.x0) < 1 ? ab.x1 : ab.x0
    return port(a.id, b.id, 'passerelle', { x, y, z: along(oz[0], oz[1], key) }, { x: Math.sign(x - (ab.x0 + ab.x1) / 2), z: 0 }, false)
  }
  const ox = overlap(ab.x0, ab.x1, bb.x0, bb.x1)
  if (ox && (Math.abs(ab.z1 - bb.z0) < 1 || Math.abs(ab.z0 - bb.z1) < 1)) {
    const z = Math.abs(ab.z1 - bb.z0) < 1 ? ab.z1 : ab.z0
    return port(a.id, b.id, 'passerelle', { x: along(ox[0], ox[1], key), y, z }, { x: 0, z: Math.sign(z - (ab.z0 + ab.z1) / 2) }, false)
  }
  return null
}

const CORE_GATES: readonly { quartier: DistrictId; z: number }[] = [
  { quartier: 'ateliers', z: -45 },
  { quartier: 'marche', z: 60 },
  { quartier: 'scellees', z: -45 },
  { quartier: 'serres', z: 60 },
]

function corePort(row: Row, b: Box): PortPlan | null {
  if (row.layer !== 'haut') return null
  const edge = row.wing === 'tribord' ? b.x0 : b.x1
  if (Math.abs(Math.abs(edge) - CORE_EDGE) > 1) return null
  const gate = CORE_GATES.find((g) => g.z > b.z0 && g.z < b.z1 && (row.wing === 'tribord') === (g.quartier === 'scellees' || g.quartier === 'serres'))
  if (!gate) return null
  return port(row.id, gate.quartier, 'passerelle', { x: edge, y: LAYER.haut.portY, z: gate.z }, { x: row.wing === 'tribord' ? -1 : 1, z: 0 }, true, OPEN)
}

function spines(): SpineLink[] {
  const out: SpineLink[] = []
  for (const wing of ['babord', 'tribord'] as const) {
    const s = wing === 'tribord' ? 1 : -1
    const ids = (pred: (row: Row) => boolean) => TABLE.filter((row) => row.wing === wing && pred(row)).map((row) => row.id)
    out.push({
      id: `grand-rue-${wing}`, nom: wing === 'tribord' ? 'La Grand-Rue de Tribord' : 'La Grand-Rue de Bâbord', kind: 'passerelle',
      path: ROW_Z.map(([z0, z1]) => ({ x: s * 180, y: LAYER.haut.portY, z: (z0 + z1) / 2 })),
      districts: ids((row) => row.layer === 'haut' && row.columns.includes('A')), unlock: OPEN,
    })
    out.push({
      id: `rail-de-quille-${wing}`, nom: 'Le Rail de Quille', kind: 'rail',
      path: [{ x: s * 280, y: -22, z: -140 }, { x: s * 280, y: -22, z: 460 }],
      districts: ids((row) => row.columns.includes('B')), unlock: { act: 2, flag: `wagonnet-${wing}` },
    })
    out.push({
      id: `tube-des-hauts-${wing}`, nom: 'Le Tube des Hauts', kind: 'tube',
      path: [{ x: s * 92, y: 24, z: 44 }, { x: s * 130, y: 22, z: 20 }, { x: s * 380, y: 22, z: -20 }, { x: s * 380, y: 22, z: 340 }],
      districts: ['hauts', ...ids((row) => row.layer === 'haut' && row.columns.includes('C'))], unlock: OPEN,
    })
  }
  out.push({
    id: 'passerelle-de-la-baie', nom: 'La Passerelle de la Baie', kind: 'tube',
    path: [{ x: -BAIE.x1, y: 16, z: 400 }, { x: BAIE.x1, y: 16, z: 400 }],
    districts: ['dortoirs-babord', 'quai-des-lampes'], unlock: { flag: 'baie-ouverte' },
  })
  return out
}

export function planShip(): ShipPlan {
  const boxes = TABLE.map(boundsOf)
  const ports = TABLE.map((): PortPlan[] => [])
  for (let i = 0; i < TABLE.length; i++) {
    const core = corePort(TABLE[i]!, boxes[i]!)
    if (core) ports[i]!.push(core)
    for (let j = i + 1; j < TABLE.length; j++) {
      const p = portsBetween(TABLE[i]!, boxes[i]!, TABLE[j]!, boxes[j]!)
      if (!p) continue
      ports[i]!.push(p)
      ports[j]!.push({ ...p, to: TABLE[i]!.id, facing: { x: -p.facing.x, z: -p.facing.z } })
    }
  }
  const districts: DistrictPlan[] = TABLE.map((row, i) => ({
    id: row.id, nom: row.nom, archetype: row.archetype, shape: ARCHETYPES[row.archetype].shape,
    quartier: row.quartier, wing: row.wing, layer: row.layer, columns: row.columns,
    bounds: boxes[i]!, decks: LAYER[row.layer].decks, seed: districtSeed(row.id), variant: 0,
    landmarks: row.landmarks, ports: ports[i]!, unlock: OPEN,
  }))
  return { seed: SEED, version: MONDE_VERSION, bounds: { x0: -430, x1: 430, y0: -24, y1: 30, z0: -200, z1: 520 }, baie: BAIE, districts, spines: spines() }
}
