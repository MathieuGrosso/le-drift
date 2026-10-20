# Performance — moteur

Machine : Apple M5 Pro, Chrome 155 headless sur GPU réel (ANGLE Metal), viewport 1512×900 CSS, DPR 2,
qualité `high`, `?nosave`. « Débridé » = `--disable-gpu-vsync --disable-frame-rate-limit` (montre la marge
réelle) ; « vsync » = Chrome normal, plafonné à 60. Scripts de mesure : rAF compté sur 3 s.

## Images par seconde

| Lieu (7 h 30) | Avant, débridé, ×2 fixe | Après, débridé, ×2 fixe | Après, vsync, résolution dynamique |
|---|---|---|---|
| Cabine | 47 ips (2,79 M tri, 281 appels) | 57 ips | **60 ips** à ×1,375 |
| Réfectoire au petit-déj | 47 ips (2,14 M tri, 238 appels) | 56 ips | **60 ips** à ×1,375 |
| Grande Nef | 34 ips (2,95 M tri, 263 appels) | 42 ips | **58–60 ips** à ×1,25 |

Pendant les 10 min vsync : 56–60 ips, ratio entre ×1,375 et ×1,875 selon la charge.

- Avant, en vsync, l'auto-qualité basculait toujours `high` → `medium` dans les 5 premières secondes
  (compilations de shaders et envoi des géométries comptés comme des images lentes).
- Le jeu est limité par le remplissage : à ×1,5 la Nef passe de 34 à 55 ips ; avec un matériau trivial
  forcé sur toute la scène, de 43 à 79 ips. Le shader cel intérieur coûte environ la moitié de l'image.

## Mémoire (tas JS, après `gc()`)

| Scénario | Avant | Après |
|---|---|---|
| 1er chargement | 260–266 Mo | 266 Mo |
| 3 rechargements | 263 Mo | 265 Mo |
| 4 navigations successives (lieux différents) | 266 → 509 → 734 → 960 Mo | 266 → 282 → 267 → 265 Mo |
| 10 min de jeu, vsync (5 min réfectoire, 5 min Nef) | — | 266 → 284 Mo, brut 268–306 Mo, puis rechargement 274 Mo |

Cause : le cache précédent/suivant de Chrome gelait le monde entier (~240 Mo) à chaque départ de page ;
le teardown sautait `persisted`. La page s'en exclut désormais et se recharge si elle est restaurée.

## Chargement

`ready` à 2,6–3,6 s en local. `init` par système : hero 979 ms, drift 681 ms, world 243 ms,
gameplay 88 ms, render 82 ms. Le chunk recast (772 Ko) n'est plus préchargé par l'entrée (l'aide de
préchargement de Vite y avait atterri).

## Ce qui a été fait

- `src/core/resolution.ts` : résolution dynamique (ratio de pixels suivant le 90e centile du temps d'image
  sur 1 s, cible 60 ips, pas de 0,125, plancher 0,75, remontée par essais avec attente doublée en cas d'échec).
  Les requêtes de minuterie GPU ont été essayées puis écartées : sur ANGLE Metal elles incluent l'attente vsync.
- Compteur `?debug` : images comptées sur 1 s et 90e centile du temps d'image (`src/core/framewindow.ts`).
  L'ancienne moyenne lissée de 1/dt affichait 150–250 ips débridé pour ~58 ips réels (le tableau ci-dessus,
  compté au rAF, n'en dépend pas). « rendu » = temps CPU de soumission du rendu.
- Auto-qualité : 4 s d'échauffement et images > 250 ms ignorées.
- Shader cel intérieur : lampes hors de portée et coup de brosse mural sautés là où ils valaient zéro.
- `src/render` précompile tous les matériaux cachés (sortie, faune) à l'image 3 puis à la fermeture de
  l'écluse, sans et avec le brouillard linéaire de `world/seavolume` (sa bascule dehors changeait le programme
  de tout matériau brouillé), dans la cible de rendu de la scène. Première sortie : 70 programmes et une image
  de 470 ms avant, 9 programmes et 95 ms après. N8AO ne redessine plus la scène deux fois pour la transparence.

## Coûts restants (pistes)

- Shader cel intérieur : boucle de 8 lampes et 6 vitres par pixel ; scintillement (`sin`) calculable
  côté CPU.
- Dans la Nef, `fauna` (4 074 poissons instanciés, 509 k tri) et le terrain de `world` (320 k tri) sont
  dessinés parce que la verrière rend la mer visible : à cull par distance (dossiers `src/fauna`, `src/world`).
- Les districts de `drift-ville` sont un maillage fusionné chacun (Nef 229 k tri, marché 259 k) :
  pas de cull par fragment de district.
- 4 à 6 à-coups de 400–580 ms dans les 8 s après `ready` (premier envoi des géométries).
- `hero.init` prend ~1 s.
