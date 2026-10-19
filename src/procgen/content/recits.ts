import type { ArchetypeId, Rng } from '../types'

const VIGNETTES: readonly string[] = [
  '{a} et {b} se racontent la dernière tempête',
  '{a} apprend un nœud de marin à {b}',
  '{a} et {b} partagent un thé trop chaud',
  '{a} cherche ses lunettes, que {b} porte sur le front',
  '{a} et {b} se disputent la dernière crêpe',
  '{a} répare une lampe pendant que {b} tient l’échelle',
  '{a} fait la lecture à {b}, qui s’endort',
  '{a} et {b} jouent aux dés sur une caisse',
  '{a} gronde un chat, {b} prend sa défense',
  '{a} montre à {b} un poisson qui passe derrière le hublot',
]

function inPhrase(nom: string): string {
  return nom.replace(/^(Le|La) /, (m) => m.toLowerCase())
}

// Fills {x} with French contractions: « à {x} » → au / à la, « de {x} » → du / de la, lower article mid-sentence.
export function fill(tpl: string, vars: Readonly<Record<string, string>>): string {
  return tpl.replace(/(à |de )?\{(\w+)\}/g, (_, pre: string | undefined, key: string, at: number) => {
    const nom = vars[key] ?? key
    const low = inPhrase(nom)
    if (pre === 'à ') return low.startsWith('le ') ? `au ${low.slice(3)}` : `à ${low}`
    if (pre === 'de ') return low.startsWith('le ') ? `du ${low.slice(3)}` : `de ${low}`
    return at === 0 ? nom : low
  })
}

export function vignette(rng: Rng, a: string, b: string): string {
  return fill(VIGNETTES[Math.floor(rng() * VIGNETTES.length)]!, { a, b })
}

interface Quete { titre: string; texte: string; objet: string }

const QUETES: Readonly<Record<ArchetypeId, readonly Quete[]>> = {
  observatoires: [
    { titre: 'Le reflet perdu', texte: '{p} a vu un reflet étrange dans la grande lentille. Trouve d’où il vient.', objet: 'éclat de lentille' },
    { titre: 'La carte inachevée', texte: '{p} n’a jamais fini sa carte des reflets. Il lui manque trois hublots.', objet: 'croquis de hublot' },
  ],
  corderie: [
    { titre: 'Le grelin trop court', texte: '{p} a besoin de trois bobines de chanvre avant la torsion de dix heures.', objet: 'bobine de chanvre' },
    { titre: 'Le gamin coursier', texte: 'Le coursier de {p} a filé avec le pot de goudron. Rattrape-le.', objet: 'pot de goudron' },
  ],
  lavoirs: [
    { titre: 'Le drap envolé', texte: 'Un drap de {p} s’est envolé dans la vapeur. Il pend quelque part en haut.', objet: 'drap brodé' },
    { titre: 'Le savon de la reine', texte: '{p} jure qu’un savon parfumé traîne au fond d’un bassin.', objet: 'savon parfumé' },
  ],
  sechoirs: [
    { titre: 'Les chats affamés', texte: '{p} demande qu’on nourrisse les chats de la tour avant la rentrée des claies.', objet: 'poisson séché' },
    { titre: 'Le sel qui chante', texte: '{p} cherche un tonneau de sel qui « chante » quand on le roule.', objet: 'cristal de sel' },
  ],
  bazar: [
    { titre: 'L’objet sans nom', texte: '{p} a repêché un objet que personne ne comprend. Montre-le aux anciens.', objet: 'objet repêché' },
    { titre: 'Le troc en chaîne', texte: '{p} échange une horloge contre « quelque chose de bleu ». À toi de trouver.', objet: 'horloge arrêtée' },
  ],
  fourneaux: [
    { titre: 'L’épice oubliée', texte: '{p} a oublié l’épice du bouillon du soir. Elle pousse dans les potagers.', objet: 'sachet d’épices' },
    { titre: 'Le goûteur', texte: '{p} veut un avis honnête sur sa soupe. Goûte-la, puis trouve ce qui manque.', objet: 'louche de soupe' },
  ],
  forges: [
    { titre: 'Le rivet d’or', texte: '{p} a laissé tomber un rivet d’or dans les tôles. Il brille encore.', objet: 'rivet d’or' },
    { titre: 'La coulée de quatorze heures', texte: '{p} a besoin d’un seau d’eau froide avant la coulée.', objet: 'seau d’eau' },
  ],
  dortoirs: [
    { titre: 'Le doudou perdu', texte: 'L’enfant de {p} ne dort pas sans son doudou. Il est quelque part dans les coques.', objet: 'doudou' },
    { titre: 'La veilleuse éteinte', texte: '{p} demande qu’on rallume une veilleuse tout en haut du mur.', objet: 'mèche neuve' },
  ],
  noye: [
    { titre: 'La cloche muette', texte: '{p} dit que la cloche engloutie ne sonne plus. Quelque chose bloque le battant.', objet: 'battant de cloche' },
    { titre: 'La lettre à la mer', texte: '{p} veut qu’on dépose une lettre au bout de la rue sous l’eau.', objet: 'lettre scellée' },
  ],
  quais: [
    { titre: 'Le filet déchiré', texte: '{p} a un filet déchiré avant la remontée. Trouve du fil de soie.', objet: 'fil de soie' },
    { titre: 'Le mousse en retard', texte: 'Le mousse de {p} dort quelque part. Réveille-le avant les filets du soir.', objet: 'sifflet' },
  ],
  citernes: [
    { titre: 'La fuite', texte: '{p} entend une fuite mais ne la trouve pas. Suis le bruit de l’eau.', objet: 'joint en cuir' },
  ],
  chapelle: [
    { titre: 'Le cierge du marin', texte: '{p} veut allumer un cierge pour un marin parti. Il en faut un neuf.', objet: 'cierge' },
  ],
  laminaires: [
    { titre: 'La graine qui flotte', texte: '{p} a perdu une graine de laminaire dans les rigoles.', objet: 'graine de laminaire' },
    { titre: 'L’arrosage du matin', texte: '{p} a mal au dos. Porte trois arrosoirs jusqu’aux bacs du haut.', objet: 'arrosoir' },
  ],
  nurserie: [
    { titre: 'Cache-cache', texte: 'Trois enfants de {p} se sont cachés. Trouve-les tous.', objet: 'ruban' },
    { titre: 'La comptine oubliée', texte: '{p} a oublié la fin de la comptine. Quelqu’un ailleurs la connaît.', objet: 'comptine' },
  ],
  potagers: [
    { titre: 'Le radis géant', texte: '{p} jure qu’un radis géant pousse sous une lampe oubliée.', objet: 'radis géant' },
    { titre: 'La lampe de pousse', texte: '{p} a une lampe grillée tout en haut des jardins suspendus.', objet: 'ampoule de pousse' },
  ],
  bibliotheque: [
    { titre: 'La page manquante', texte: '{p} cherche la page arrachée d’un vieux journal de bord.', objet: 'page arrachée' },
    { titre: 'Le livre en retard', texte: '{p} attend un livre jamais rendu. L’emprunteur habite loin d’ici.', objet: 'livre emprunté' },
  ],
  theatre: [
    { titre: 'La marionnette sans fil', texte: '{p} a besoin d’un fil pour la représentation de vingt heures.', objet: 'fil de marionnette' },
  ],
  viviers: [
    { titre: 'L’anguille évadée', texte: 'Une anguille de {p} s’est échappée par un tuyau.', objet: 'épuisette' },
  ],
  cathedrale: [
    { titre: 'La burette du graisseur', texte: '{p} a perdu sa burette près du grand volant.', objet: 'burette d’huile' },
    { titre: 'Le sifflet du quart', texte: '{p} a besoin du sifflet pour le changement de quart de minuit.', objet: 'sifflet à vapeur' },
  ],
}

export function quete(archetype: ArchetypeId, i: number, pnj: string): { titre: string; texte: string; objet: string } {
  const list = QUETES[archetype]
  const q = list[i % list.length]!
  return { titre: q.titre, texte: fill(q.texte, { p: pnj }), objet: q.objet }
}
