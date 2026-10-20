# QA — passe testeur (build `b99f8f6`)

Build propre du dernier commit dans un worktree (`/tmp/drift-qa`), `vite preview` :4299, Chrome headless
sur GPU réel (ANGLE Metal, Apple M5 Pro), 1280×720. Entrées réelles CDP (`Input.dispatchKeyEvent` avec
`code`, `Input.dispatchMouseEvent`), partie neuve `?nosave` sauf mention. `lp` = `state.hero.localPosition`.
`goto()` de debug utilisé seulement pour rejoindre un lieu ; tout ce qui est rapporté est joué au clavier/souris.
Sévérités : **blocker** (bloque la partie ou un menu), **major** (visible, casse un système), **minor**.

| id | sév. | dossier | titre |
|---|---|---|---|
| QA-01 | blocker | `index.html`, `src/net` | Le calque réseau plein écran avale tous les clics des menus — CORRIGÉ (commit bf5b7d4) |
| QA-02 | blocker | `src/gameplay/ui` | Menu Dormir (et tous les menus) sans chemin clavier : dormir impossible |
| QA-03 | major | `src/hero`, `src/drift/city` | Échelle du sas : bloqué à 1,35 m du sommet, caméra dans le plafond — CORRIGÉ (commit 4506c84) |
| QA-04 | major | `src/drift` (nav) | 43 sites injoignables depuis la cabine, dont la table des cartes et les 12 coques scellées |
| QA-05 | major | `src/render`, `src/drift` | Réfectoire au petit-déj : 9 ips, 1,93 M triangles |
| QA-06 | major | (global) | Tas JS à 1,2 Go trois minutes après un rechargement (0,43 Go au premier chargement) |
| QA-07 | major | `src/gameplay/quests.ts` | La tâche « Lire le tableau des prévisions » se saute en passant l'écluse |
| QA-08 | major | `src/gameplay`, `src/camille` | Sortie : on part face au large, aucun repère vers la grande vitre |
| QA-09 | major | `src/net`, `src/gameplay/ui` | Le panneau « Seul à bord » cache le compteur « Tournée · 0/2 vitres » |
| QA-10 | major | `src/hero` (caméra) | Caméra enfoncée dans la coque après quelques pas sur la passerelle de la Nef |
| QA-11 | major | `src/gameplay/indoor.ts` | « Rentrer » demande un appui long que l'invite n'annonce pas |
| QA-12 | major | `src/gameplay/ui` | « Partie sauvegardée. » affiché avec `?nosave`, rien n'est écrit |
| QA-13 | major | `src/hero` | Écharpe : planche rigide à l'horizontale en nage |
| QA-14 | minor | `src/drift/interiors` | La porte-hublot de la cabine déborde de son encadrement |
| QA-15 | minor | `src/drift/interiors` | Porte extérieure du sas : coins du cadre ouverts sur la mer |
| QA-16 | minor | `src/drift/interiors` | Bassin du sas rendu comme une boîte cyan opaque, caméra dedans |
| QA-17 | minor | `src/gameplay` (carte) | « pas encore relevé » chevauche les icônes de dôme sur la carte |
| QA-18 | minor | `src/camille`, `src/drift/chatter.ts` | Bulles de PNJ superposées, lues à travers une porte fermée |
| QA-19 | minor | `src/drift/chatter.ts` | Bulle hors champ coupée au bord gauche, réplique hors contexte (« au petit-déj » à 18 h) |
| QA-20 | minor | `src/gameplay/indoor.ts` | Invite « Sortir par l'écluse » affichée en haut de l'échelle, 6 m au-dessus de la porte |
| QA-21 | minor | `src/gameplay/text` | Astuce « [E] près de la porte ronde » en crochets bruts, chevauche le sous-titre |
| QA-22 | minor | `src/fauna/curious.ts` | Les poissons curieux traversent Ilo et masquent le héros |
| QA-23 | minor | `src/drift/city` | Câble de tyrolienne qui traverse la passerelle de la Nef |
| QA-24 | minor | `src/drift/city` | Panneaux d'affichage vierges (gris ou beige) dans la Nef |
| QA-25 | minor | `src/render`, `src/drift/interiors` | Cabine au réveil presque noire, moiré sur les cercles au sol |
| QA-26 | minor | `src/net` | Avertissement Colyseus « Network offline » en solo |
| QA-27 | minor | `vite.config.ts` | Un seul bundle de 4,1 Mo (avertissement de taille de chunk) — CORRIGÉ (commit bf5b7d4) |

---

## QA-01 — blocker — le calque réseau avale les clics des menus
- **Dossier** : `index.html:40` (`#ui > * { pointer-events: auto; }`), `src/net/style.ts:2`.
- **Repro** : partie neuve, intro passée, Échap → Pause. Cliquer au centre de « Reprendre » (640, 298).
- **Attendu** : la partie reprend.
- **Obtenu** : rien. `document.elementFromPoint(640, 298)` = `.net-ui`. `.net-ui` est `position: fixed;
  inset: 0; z-index: 30` ; sa règle `pointer-events: none` est battue par `#ui > *` (spécificité d'id).
  Touche aussi la carte (stations de tube), « Retour à la cabine », Réglages, Commandes, Dormir, étals.
- **Capture** : `shots/qa/bug-01-net-ui-swallows-pause-clicks.jpg`

## QA-02 — blocker — dormir est impossible
- **Dossier** : `src/gameplay/ui` (menus).
- **Repro** : cabine, se placer à `lp` (-9.85, 0, 67.31) → invite « Dormir », E. Cliquer « Dormir jusqu'au soir »,
  puis essayer Tab + Entrée, puis E.
- **Attendu** : la nuit passe et la partie est sauvegardée.
- **Obtenu** : le clic part sur `.net-ui` (QA-01) ; aucune touche ne choisit une entrée, l'heure reste à 14,85.
  Le menu n'a pas de navigation clavier/manette. Seul `button.click()` en JS fait dormir (14 h 50 → 18 h 02).
- **Capture** : `shots/qa/bug-12-sleep-menu-unclickable.jpg`

## QA-03 — major — échelle du sas : bloqué avant le sommet
- **Dossier** : `src/hero` (mode `ladder`), échelle `echelle-sas` (bas y 0, haut y 7,4).
- **Repro** : sas, face à l'échelle à `lp` (-4.9, 0, 64.8) → « Monter », W 4 s puis W 3 s de plus.
- **Attendu** : sortie posée au sommet.
- **Obtenu** : `mode: ladder`, y figé à 6,05 ; W ne fait plus rien, seul S redescend. La caméra est dans le
  plafond (écran flou, Ilo invisible).
- **Capture** : `shots/qa/bug-16-ladder-top-stuck-camera-in-wall.jpg`
- **Correction** : le haut de l'échelle est la trappe du toit (eau au-dessus, d'où l'arrêt à 6,05). La pièce
  n'était pas suivie en mode échelle, donc l'invite de la trappe ne venait jamais ; elle s'affiche maintenant et
  E lance l'écluse du toit. Dans le puits, la caméra passe sous Ilo et regarde vers la trappe
  (`shots/moteur/h-ladder-after3-6.jpg`).

## QA-04 — major — sites injoignables à pied
- **Dossier** : `src/drift` (navmesh), audit au démarrage.
- **Repro** : ouvrir le jeu, lire la console.
- **Obtenu** : `navmesh 2096 polys; 43 unreachable` — `table-carte`, `echelle-toit`, les 7 `lunette-dome-*`,
  `scellee-cs-01` à `12`, 19 sites `tr-*` ; `no floor under: tr-01 tr-18 tr-19 tr-35 tr-39`. La chambre des
  cartes du grand-père et tous les sanctuaires ne sont pas reliés à la cabine.
- **Attendu** : 0 site injoignable (ou une traversée qui les relie).

## QA-05 — major — réfectoire à 9 ips
- **Dossier** : `src/render`, `src/drift` (PNJ du réfectoire).
- **Repro** : `goto('refectoire')`, heure 7 h 30 (les convives arrivent).
- **Obtenu** : 9 ips, 162 appels, **1 930 k triangles**, CPU 4,3 ms → limité GPU. Nef : 3 070 k triangles.
  Même machine, cabine : 60 ips.
- **Attendu** : 30 ips minimum dans la scène phare du jeu.
- **Capture** : `shots/qa/bug-09-refectory-9fps.jpg`

## QA-06 — major — croissance mémoire
- **Repro** : partie neuve `?debug`, puis `reload` dans le même onglet, jouer 3 min (cabine, sas).
- **Obtenu** : `performance.memory.usedJSHeapSize` 433 Mo au 1er chargement → **1 201 Mo** après rechargement,
  1 210 Mo 30 s plus tard. Un onglet a aussi été relancé par le navigateur pendant un `goto('refectoire')`
  après ~15 min de jeu (cause non confirmée).
- **Attendu** : tas stable autour du premier chargement.

## QA-07 — major — tâche du tableau des prévisions sautée
- **Dossier** : `src/gameplay/quests.ts` (`a1-reveil`).
- **Repro** : arriver au sas → toast « NOUVELLE TÂCHE · Lire le tableau des prévisions » et invite
  « Sortir par l'écluse » en même temps. Appuyer E.
- **Attendu** : la sortie attend la lecture du tableau (ou la tâche n'est pas proposée).
- **Obtenu** : `a1-reveil: done` sans lecture ; la météo de la journée (visibilité, courant, méduses) n'est
  jamais montrée au joueur.
- **Capture** : `shots/qa/bug-04-forecast-task-skipped-lock-box.jpg`

## QA-08 — major — la sortie part face au large
- **Dossier** : `src/gameplay` (sortie), caméra de nage.
- **Repro** : passer l'écluse, attendre la nage, W 6 s.
- **Attendu** : la coque et la corde devant soi, un repère vers « la grande vitre » (tâche affichée).
- **Obtenu** : caméra dos à la coque, fond marin et laminaires seulement ; W éloigne de 13,5 m du Drift. Il faut
  tourner de 180° pour voir le Drift ; aucun repère de vitre.
- **Capture** : `shots/qa/bug-06-sortie-faces-open-sea-no-waypoint.jpg`

## QA-09 — major — compteur de tournée caché
- **Dossier** : `src/net/style.ts` (`.net-presence` en haut à droite), `src/gameplay/ui` (`.gp-counter`).
- **Repro** : sortie en solo.
- **Obtenu** : `.gp-counter` « Tournée · 0/2 vitres » est sous le panneau « Seul à bord / Rejoindre le Drift ».
  En `?debug`, la barre de stats passe aussi sous ce panneau.
- **Capture** : `shots/qa/bug-05-net-panel-covers-sortie-hud.jpg`

## QA-10 — major — caméra enfoncée dans une coque
- **Dossier** : `src/hero` (caméra).
- **Repro** : `goto('nef')`, W 3,5 s sur la passerelle vers la colonne.
- **Obtenu** : l'écran entier est un flanc de coque à hublots, Ilo collé devant, impossible de voir où l'on va
  (y monte de 63 à 65,3). S 1,5 s ramène une vue normale.
- **Capture** : `shots/qa/bug-10-camera-buried-in-hull-wall.jpg`

## QA-11 — major — « Rentrer » demande un appui long caché
- **Dossier** : `src/gameplay/indoor.ts:200` (`hold: true`).
- **Repro** : en sortie, à 35 m du sas (bout de la longe), voir « E Rentrer », taper E.
- **Attendu** : on rentre, ou l'invite dit « maintenir ».
- **Obtenu** : rien ne se passe (testé 4 fois). Il faut maintenir E ~2 s ; l'anneau de progression n'apparaît
  qu'une fois l'appui commencé. Un joueur croit la commande cassée.
- **Capture** : `shots/qa/bug-21-rentrer-hold-not-signalled.jpg`

## QA-12 — major — fausse sauvegarde en `?nosave`
- **Dossier** : `src/gameplay/ui` (toast) vs `src/core/save.ts`.
- **Repro** : `?nosave`, dormir (QA-02 contourné).
- **Obtenu** : toast « Partie sauvegardée. » ; `localStorage` vide. Sans `?nosave`, la sauvegarde se recharge
  bien (heure, inventaire, position) ; la sauvegarde écrite pendant l'intro contient `hero.mode: "cutscene"`.
- **Capture** : `shots/qa/bug-13-nosave-toast-and-offscreen-bubble.jpg`

## QA-13 — major — écharpe rigide
- **Dossier** : `src/hero` (écharpe).
- **Repro** : sortie, nager puis tourner la caméra.
- **Obtenu** : l'écharpe sort à l'horizontale comme une planche plate orange, sans ondulation ; à terre elle
  pend droite le long du dos en marchant.
- **Capture** : `shots/qa/bug-07-scarf-rigid-plank-fish-clip.jpg`

## QA-14 — minor — porte-hublot de la cabine trop grande
- **Repro** : réveil, marcher 4 m vers la porte.
- **Obtenu** : disque sombre plus large que le chambranle, qui dépasse à gauche et traverse le mur. Même défaut
  sur la porte en bout de coursive (`passerelle-nef`).
- **Capture** : `shots/qa/bug-02-cabin-hatch-overflows-frame.jpg`

## QA-15 — minor — coins ouverts de la porte extérieure du sas
- **Repro** : revenir de sortie par « Rentrer ».
- **Obtenu** : porte octogonale dans un cadre carré, les 4 coins montrent la mer (cyan) depuis l'intérieur.
- **Capture** : `shots/qa/bug-08-outer-hatch-corners-leak-sea.jpg`

## QA-16 — minor — bassin du sas en boîte opaque
- **Repro** : au sas, E « Sortir par l'écluse ».
- **Obtenu** : un parallélépipède cyan à bord blanc remplit l'écran, la caméra est dedans/au ras.
- **Capture** : `shots/qa/bug-04-forecast-task-skipped-lock-box.jpg`

## QA-17 — minor — libellés de la carte sur les icônes
- **Repro** : M (étiqueté « , » en AZERTY) en début de partie.
- **Obtenu** : « pas enco◖relevé » coupé par les icônes de dôme (4 zones), deux « pas encore relevé » empilés
  au centre, cadres pointillés qui se chevauchent.
- **Capture** : `shots/qa/bug-03-map-labels-overlap-icons.jpg`

## QA-18 — minor — bulles superposées à travers une porte
- **Repro** : recharger une sauvegarde dans la cabine (13 h 25), face à la porte fermée.
- **Obtenu** : deux bulles se recouvrent (« Tu sors frotter ? Je te ferai signe… » sur « …aujourd'hui. Le Drift
  tourne. »), dites par des PNJ invisibles de l'autre côté de la porte.
- **Capture** : `shots/qa/bug-15-npc-bubbles-overlap-through-door.jpg`

## QA-19 — minor — bulle coupée et hors contexte
- **Repro** : dormir jusqu'au soir dans la cabine.
- **Obtenu** : bulle « …heure, au petit-déj ! » collée au bord gauche et tronquée, à 18 h 02.
- **Capture** : `shots/qa/bug-13-nosave-toast-and-offscreen-bubble.jpg`

## QA-20 — minor — invite d'écluse en haut de l'échelle
- **Repro** : QA-03, en haut de l'échelle.
- **Obtenu** : « E Sortir par l'écluse » reste affiché à 6 m au-dessus de la porte.
- **Capture** : `shots/qa/bug-16-ladder-top-stuck-camera-in-wall.jpg`

## QA-21 — minor — astuce en crochets bruts
- **Repro** : entrer dans le bassin du sas.
- **Obtenu** : « [E] près de la porte ronde pour passer l'écluse. » en texte brut (pas la pastille de touche,
  pas `keyLabel`), posé juste au-dessus du sous-titre qui s'écrit.
- **Capture** : `shots/qa/bug-20-hint-literal-E-overlaps-subtitle.jpg`

## QA-22 — minor — poissons curieux dans Ilo
- **Repro** : sortie, nager 10 s.
- **Obtenu** : trois gros poissons collent Ilo, le traversent et le masquent à l'écran.
- **Capture** : `shots/qa/bug-07-scarf-rigid-plank-fish-clip.jpg`

## QA-23 — minor — câble de tyrolienne à travers la passerelle
- **Repro** : `goto('nef')`, regarder à gauche.
- **Obtenu** : le câble entre dans la passerelle et sa rambarde. Des poissons sombres flottent aussi dans l'air
  de l'atrium (à confirmer : décor suspendu ou faune hors de l'eau).
- **Capture** : `shots/qa/bug-17-zip-cable-through-gangway-fish-indoors.jpg`

## QA-24 — minor — panneaux vierges
- **Repro** : écran titre (deux grands panneaux gris en bas à gauche) ; Nef, plateforme des étals (panneau beige
  à côté d'une lanterne).
- **Capture** : `shots/qa/bug-18-title-blank-panels.jpg`, `shots/qa/bug-11-blank-sign-panels.jpg`

## QA-25 — minor — cabine noire au réveil
- **Repro** : partie neuve, fin de l'intro (6 h 30).
- **Obtenu** : cabine quasi noire, affiches seules lisibles ; cercles concentriques au sol avec moiré.
- **Capture** : `shots/qa/bug-19-cabin-too-dark-floor-moire.jpg`

## QA-26 — minor — avertissement réseau en solo
- **Obtenu** : console `@colyseus/sdk: Network offline. Closing 0 connection(s)` ×2 sans avoir rejoint.

## QA-27 — minor — bundle unique de 4,1 Mo
- **Repro** : `vite build`.
- **Obtenu** : `index-*.js` 4 116 kB (1,43 Mo gzip), avertissement de chunk ; tout charge avant l'écran titre.

## Non couvert (temps)
Grattage des vitres en sortie, tubes, toboggans, tyroliennes (poulie de l'acte 3), coques scellées, cuisine,
marché, chambre des cartes, actes 2-3, manette. Vu OK : intro (E/Échap), portes, sas aller-retour, pause figée,
inventaire, sauvegarde/rechargement hors `?nosave`, descente d'échelle.
