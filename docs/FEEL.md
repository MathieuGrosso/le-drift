# Feel — round 3 (programmeur gameplay)

Build de ce commit servi par `vite preview` sur :4210 (copie figée de `dist/`), Chrome 155 GPU réel
(profil debug, port 9222, une fenêtre CDP par session, refermée à la fin), `?debug&nosave`.
Entrées réelles : touches CDP tenues/relâchées et déplacements de souris (`movementX` produit par Chrome).
Chrome refuse le pointer lock à un onglet CDP : `input.pointerLocked` est forcé à `true`, le clic de
départ et Échap restent de vrais événements. Mesures par frame (rAF), coordonnées locales du Drift :
`cd` = distance caméra-tête, `clip` = frames où une sphère de 0,12 m à la caméra touche un collider
solide, `jerk` = plus grand changement de vitesse de `cd` en une frame. Captures : `shots/feel4/` (non versionnées).

## Les 4 bugs de l'orchestrateur

| # | État | Mesure |
|---|---|---|
| 1 Caméra de cabine | **Corrigé** | Épaule de 0,54 m à l'intérieur (0,6 m dans les pièces étroites), visée décalée du même côté : Ilo au tiers gauche, la porte ronde visible (`cab-0.jpg`). Dos au mur (S 2 s) : la caméra monte au lieu d'avancer (assistance de tangage), `cd` mini 0,24 m avec Ilo tramé, 0 frame de clip. Orbite souris 900 px + tangage : 0 clip, jerk 0,05. |
| 2 Espace ne saute pas | **Corrigé** | Cabine : +1,23 m (tenu 300 ms), +0,76 m (tap 50 ms), `jump>fall>land>idle`. |
| 3 E pendant la narration | **Corrigé** | 26 E à 290 ms depuis le clic : contrôle à 3,4 s, aucun menu ouvert. E tenu prolonge la grâce, et « Dormir » n'est pas proposé tant qu'Ilo n'a pas bougé (40 s max). |
| 4 Intro longue | **Corrigé** | Sans rien toucher : contrôle à 10,1 s (12,2 s avant). Échap : 0,98 s. W : 1,0 s. Clics : 4,0 s. |

## Checklist des traversées (entrée réelle, aller et retour)

| Traversée | Résultat | Mesure |
|---|---|---|
| Tube Nef → Marché / retour | PASS / PASS | départ 1,59 s après E, arrivée face à la sortie, 0 clip ; retour (S jusqu'à l'invite puis E) 1,59 s |
| Tube Nef → Serres / retour | PASS / PASS | idem ; arrivée dans la foule : `cd` 0,9 m les premières secondes |
| Tube Nef → Ateliers / retour | PASS / PASS | idem |
| Tube Nef → Coques scellées / retour | PASS / PASS | le quartier ne changeait pas à l'arrivée (hystérésis 20 m) : plus d'invite de retour. Corrigé : une cellule de la ville fait foi |
| Tube Nef → Proue / retour | PASS / PASS | idem |
| Tyrolienne Nef ouest | PASS | départ immédiat (0 frame d'idle), 5,2 s, arrivée au sol `zip>jump>run`, jerk 0,8 (au lieu de 1,22), 0 clip |
| Tyrolienne du Marché | PASS | départ inaccessible avant (aucun plancher sous la barre). Palier ajouté à y 13. 6,1 s, 0 clip |
| Tyrolienne de l'Écluse | PASS | 9,3 s, 0 clip |
| Lâcher la tyrolienne (Ctrl / Espace) | PASS | `fall>land` / `jump>fall>land` ; avant, Ilo se rattrapait aussitôt au câble (`fall>zip`) |
| Toboggan de la Nef | PASS (glisse) | `run>slide>fall>run`, arrivée en bas. 2 frames de clip au point de téléportation du test, pas pendant la glisse |
| Toboggan du Marché | PASS | `run>slide>fall>run`, 0 clip |
| Échelle mât 0-8 : monter / descendre par le haut / sauter | PASS / PASS / PASS | Ilo est posé sur le palier et ne grimpe plus le fût en gardant W (L1) ; prise par le haut 0,08 s ; 0 clip (18 avant) |
| Échelle mât 8-16 | PASS / PASS / PASS | descendre par le haut bouclait `ladder>idle` sur l'échelle voisine : délai de reprise |
| Échelle nef-mur-nord | PASS / PASS / PASS | |
| Échelle puits-nord | PASS / PASS / PASS | |
| Échelles de l'horloge (chaîne 0→1→2) | PASS | on enchaîne sur l'échelle suivante en gardant W |
| Échelle du sas vers le toit | PASS (s'arrête sous la trappe) | montait dans l'eau et ressortait en nage à l'intérieur ; l'échelle s'arrête maintenant sous l'eau et aucune sortie n'est proposée dans l'eau |
| Échelle de la coque scellée cs-01 | N/A | coque inondée au-dessus de 1 m (énigme) ; avant, la sortie de cellule renvoyait Ilo en boucle, la récupération est maintenant annulée par toute téléportation |
| Saut depuis une échelle | PASS (7/7) | `jump>fall>walk` |
| Porte de cabine, centré / 0,6 m / 0,9 m hors axe | PASS / PASS / PASS | Ilo glisse le long du chambranle (M3) ; avant : bloqué net à 0,6 et 0,9 m |
| Écluse : sortir | PASS | 6,4 s de « Sortir » à la nage |
| Nage immobile 2 s | PASS | dy +0,007 m (−0,41 avant, S1) |
| Longe | PASS | 3,0 m/s jusqu'à 27 m, puis 2,1 → 0,9 → 0,6 → 0,4 m/s : la corde se tend sur le dernier quart (S2) |
| Monter / descendre en nage | PASS | Espace +1,4 m/s, Ctrl −0,8 m en 1 s |
| Rentrer (E maintenu) puis sas | PASS | 9,0 s jusqu'à l'intérieur, cycle d'écluse compris (11,1 s avant, S3) |
| S'asseoir / se lever (4 bancs) | PASS | invite « S'asseoir » à 1 m (I5, aucune avant) ; Ilo s'assoit du côté où il est, en 0,25 s, sans monter sur le banc ; se lever au stick |
| Banc : sauter dessus | PASS (2/3) | apex 1,4–1,5 m, atterrit sur le banc ; en gardant W tout le saut on peut encore le dépasser |
| Caisses (pile de 2, pile de 3) | PASS | grimpe puis se hisse sur la pile ; Espace contre la pile ne boucle plus `climb>fall>climb` |
| Pas court (tap W) | PASS | 60 ms → 0,14 m, 100 ms → 0,17 m, 200 ms → 0,65 m |
| Coursive (W + souris ±300 px, 4 s) | PASS | `cd` mini 2,33 m (0,81 avant, C3), jerk 0,18, 0 clip |
| Porter / poser | N/A | l'API (`carry`/`drop`) existe, aucun objet du monde n'est encore portable |

## Ce qui a changé

- **Caméra** (`src/hero/camera.ts`) : épaule par défaut à l'intérieur, réduite dans les coursives et
  qui ne saute plus de côté ; assistance de tangage calculée sur la collision sans assistance ;
  plancher doux de 1,6 m (les moustaches ne rentrent plus la caméra sans contact réel) ; coupure propre
  après téléportation (tube, échelle, chargement) ; dernier filet : sortir la caméra d'un sol par un
  décalage vertical, sinon recherche binaire vers la tête.
- **Contrôleur** (`src/hero/controller.ts`) : contrôle en l'air plus fort et freinage ; rebords testés
  avec la capsule ; aide de chambranle ; hystérésis marche/arrêt et piétinement contre un mur ;
  accroche tyrolienne/toboggan fondue sur 0,3 s ; délai avant de reprendre un câble ; sorties
  d'échelle sans eau et sans escalade automatique tant que le stick n'est pas relâché ; fin de
  mantle, sortie d'échelle, réveil et assise calculés dans le repère du Drift (le Drift avance, les
  points monde devenaient faux) ; nage à profondeur constante ; tension de la longe ; retour plus vite.
- **Hors de mes dossiers, minimal** : quartier changé dès qu'on entre dans une cellule
  (`src/drift/index.ts`), palier de la tyrolienne du Marché (`src/drift/city/world.ts`), invite
  « S'asseoir » depuis les ancres de bancs (`src/gameplay/world/uses.ts`), intro plus courte
  (`src/gameplay/ui/cine.ts`), E avalé et lit masqué au réveil (`src/gameplay/index.ts`).

## Reste à faire

- Arrivée de tube aux Serres dans la foule : caméra serrée (0,9 m) les premières secondes.
- Sauter sur un banc en gardant W : encore facile de le dépasser.
- Coque scellée cs-01 : la zone inondée n'est pas une cellule, nager dedans renvoie au dernier point sûr.
- Pointer lock réel et manette non vérifiés (refusés à CDP / pas de manette).

---

## Round 2 — revue du relecteur (avant ces corrections)

Build `npm run build` du commit `acf07aa`, copie figée de `dist/` servie par `vite preview` sur :4211,
Chrome 155 GPU réel (profil debug, port 9222, onglet dédié par session, refermé à la fin), viewport 1512×804 @2x,
`?debug&nosave`. Environ 11 min de jeu réparties en 14 sessions.

Entrées : vraies touches CDP (`Input.dispatchKeyEvent` tenues/relâchées) et **vrais déplacements de souris**
(`Input.dispatchMouseEvent mouseMoved`, `movementX` produit par Chrome, environ 0,0028 rad/px soit 2,25 rad pour 800 px).
Chrome refuse toujours le pointer lock à un onglet CDP, donc `input.pointerLocked` est forcé à `true` ; le clic
de démarrage et Échap restent de vrais événements.
Mesures par frame (rAF), en coordonnées locales du Drift : mode d'Ilo, distance caméra-tête, FOV,
`clip` = sphère de 0,12 m à la caméra qui touche un collider solide, `distJerk` = plus grand changement de vitesse
de la distance caméra en une frame. Captures : `shots/feel3/*.jpg` (non versionnées).

### Notes

| Axe | Note | En une ligne |
|---|---|---|
| Caméra | **6/10** | 0 frame de clip sur toute la session et aucun saut brutal, mais pas de vraie vue par-dessus l'épaule, Ilo occupe encore le centre de la cabine, et la caméra s'écrase à 0,2–0,8 m dans les coins, les coursives et sur l'échelle. |
| Saut | **7/10** | Le saut marche partout : 1,12 m tenu, 0,56 m tapé, buffer vérifié, saut en descente d'escalier. Atterrir *sur* un banc reste difficile, et un saut contre une caisse basse devient un agrippement. |
| Déplacement | **7/10** | Course 3,9 m/s, sprint 6,4 m/s, escaliers sans chute. Un tap de 100 ms fait glisser Ilo de 0,74 m, l'animation clignote walk/idle contre un obstacle, et une porte prise 0,9 m hors de l'axe bloque net. |
| Escalade | **5/10** | Échelle attrapée en marchant et montée propre, mais la sortie en haut du mât 0-8 ne pose pas Ilo sur le palier : il continue en escalade libre sur le fût. Caisse basse = agrippement figé. |
| Nage | **6/10** | Vitesse lisible (2,8 m/s, 4,4 m/s en sprint), corde visible, cadrage large. Ilo coule à l'arrêt (−0,2 m/s), la corde ne se fait pas sentir sur 23 m, et il faut tenir E 11 s pour rentrer. |
| Interactions | **5/10** | Le menu « Dormir » s'ouvre encore en martelant E à la fin de l'intro. La première sortie coûte 8 pressions de dialogue et 6,4 s de cinématique. Invites et textes se superposent au centre de l'écran. |

Intro (bug 4) : **corrigée pour l'essentiel**. Sans rien toucher, contrôle à 12,2 s (3 lignes). Échap : contrôle à 1,5 s.
Bouger (W) : contrôle à moins de 1,2 s. Espace et E font avancer (3 lignes en 3,6 s à l'Espace).

### Les 4 bugs, revérifiés (round 2)

| # | État | Mesure |
|---|---|---|
| 1 Caméra de cabine | **Partiel** | Départ : 2,7 m, tangage 0,28, FOV 64,6, `side` 0,09 : Ilo reste centré et cache la porte ronde (`cab-0.jpg`). En reculant 2 s vers la caméra (S), la caméra arrive à **0,23 m** de la tête, `side` 0,5, FOV 68,8 : l'image n'est plus qu'Ilo tramé en gros plan dans un coin sombre (`cab-wall.jpg`). Le fondu sous 0,8 m existe (tramage visible) mais ne suffit pas à rendre la vue lisible. |
| 2 Espace ne saute pas | **Corrigé** | Cabine : +1,12 m (Espace tenu 300 ms), +0,56 m (tap 50 ms), séquence `jump>fall>land>idle`. |
| 3 E pendant la narration | **Partiel** | 20 E à 290 ms d'intervalle depuis le clic : narration terminée à 4,0 s, puis **menu « Dormir » ouvert à 5,2 s**. La seconde de grâce ne couvre pas un joueur qui martèle. Avec Espace martelé, le premier appui après la narration fait sauter Ilo (inoffensif). |
| 4 Intro longue et sombre | **Corrigé** (sauf la lumière) | Voir plus haut. La cabine reste très sombre à l'arrivée (`intro-auto-end.jpg`) et le carton « ACTE I · La Vitre » s'affiche sur Ilo pendant les premières secondes de jeu (`cab-0.jpg`). |

### Défauts, avec repro

### Caméra

- **C1 Pas d'épaule.** `__heroCam.side` vaut 0 à 0,1 en marche normale, partout (cabine, coursive, Nef). L'épaule
  n'apparaît (0,3–0,5) que quand la caméra est déjà écrasée. Repro : partie neuve, Échap, ne pas bouger, `cab-0.jpg`.
  Attendu : Ilo décalé d'un tiers d'écran dans les petites pièces, la porte visible.
- **C2 Coin de cabine.** Partie neuve, Échap, maintenir S 2 s : distance 2,88 → 0,40 m, finit à 0,23 m. Aucun clip
  (la sphère tient), mais aucune vue utile. Attendu : relever la caméra (tangage) au lieu de l'avancer sous 1 m.
- **C3 Coursive.** `goto('coursive')`, W tenu 4 s avec la souris en zigzag ±300 px : la distance tombe de 1,96 à
  **0,81 m en 8 frames**, puis remet 2 s à revenir à 2,9 m. Aucun clip. Le rentrage est trop profond pour un couloir
  de cette largeur ; il faudrait un plancher autour de 1,3 m tant qu'aucune géométrie ne touche la caméra.
- **C4 Échelle, regard vers le haut.** Mât 0-8, monter 2,5 s puis souris +1500 px en lacet et ±300 px en tangage :
  distance min **0,43 m**, tangage −0,81, `side` −0,5. Au saut depuis l'échelle, la caméra repart de 0,43 m
  (`distJerk` 0,64).
- **C5 Départ de tyrolienne.** E sur `tyrolienne-nef-ouest` : 68 frames (≈1,2 s) d'`idle` avant le départ, puis la
  distance passe de 4,9 à 5,95 m en une frame (`distJerk` 1,22). Toboggan : 0,47 m au point d'entrée, `distJerk` 1,04.
- **C6 Arrivée de tube au Marché.** Tube Nef → Marché : arrivée à 1,49 m derrière la tête, la nuque en bas au centre,
  face à la file d'un étal, invite « Parler » immédiate, et W 1 s n'avance que de 0,59 m (bloqué par la foule).
  Le titre « Le Grand Marché » est posé sur les PNJ (`t2-tube.jpg`).
- **Bon** : 0 frame de clip sur environ 6 000 frames mesurées ; aucun retournement ; FOV 62–66 à l'intérieur,
  55 dehors ; recentrage derrière Ilo en marchant ; tangage borné (≈ −0,8 à 0,8 rad) ; réglages « Inverser la caméra
  verticale » et « Sensibilité » présents dans Pause → Réglages.

### Saut

- **J1 Bancs.** Banc `banc-nef-1` (12,2, −5,5, 5,05), Ilo à 2,5 m face au banc, W 350 ms puis Espace : apex 1,29 m
  mais Ilo passe par-dessus et atterrit derrière (dy +0,08). Depuis l'autre côté : le même geste l'envoie par-dessus le
  bord de la Nef, chute de 6,8 m (roulade). On ne peut pas viser le dessus d'un banc : pas assez de freinage en l'air.
- **J2 Caisse basse.** Nef, (−30, −6, −23,5) face au nord, W 1,2 s : Ilo passe en `climb` contre la première caisse
  et y reste (bras levés, `t2-crate.jpg`). Espace dans cet état : apex 0,10 m, 125 frames de `climb` figé.
  Il faut un second Espace pour s'en sortir. Avec un élan de 300 ms, le même mur se franchit bien (mantle, `climb>idle`).
  Attendu : une caisse sous ~1,2 m se monte (mantle direct), elle ne s'agrippe pas.
- **Bon** : buffer vérifié (Espace 60 ms avant l'atterrissage → deuxième saut) ; saut en descente d'escalier
  (`run>jump>fall>run`) ; saut en montée d'escalier.

### Déplacement

- **M1 Glissement court.** Coursive, tap W 100 ms : Ilo parcourt 0,74 m. Un pas de placement devrait faire ~0,3 m.
- **M2 Clignotement walk/idle.** Bas de l'escalier ouest (−28, 8, −4), S tenu 1 s puis Espace : la séquence de modes
  est `run>jump>run>walk>run>walk>idle>walk>idle>walk>idle…` (12 bascules en 2 s) pendant qu'Ilo pousse contre la
  rampe. Visible à l'écran comme un pas qui bégaie.
- **M3 Porte hors de l'axe.** Cabine, porte ouverte : si Ilo arrive à ~0,9 m à droite de l'axe (x ≈ −10,3), W 2,6 s
  ne le fait pas avancer (0 m, mode `idle`), pas de glissement le long du chambranle. Centré, il passe sans accroc.
- **M4 Pousser un mur = idle.** Contre un mur, W donne `idle` sans aucune animation d'appui ; le joueur ne sait pas si
  la touche est prise en compte.
- **Bon** : course 3,93 m/s, sprint 6,38 m/s (+62 %), descente d'escalier 8 m en 3,6 s sans `fall`, montée sans accroc.

### Escalade

- **L1 Sortie du mât 0-8.** Téléporter en (4, 0, 0) face à l'ouest, W 7 s : l'échelle monte à 8,95 m puis Ilo passe en
  `climb` **sur le fût du mât**, au-dessus du palier, au lieu de poser les pieds sur le plancher annulaire
  (`t2-ladder-top.jpg`). W continue l'escalade libre jusqu'à 13,75 m. Le palier est juste derrière lui.
- **L2** = J2 (agrippement sur caisse basse).
- **Bon** : saut depuis l'échelle à mi-hauteur (retour au sol, `jump>fall>land`), montée par simple marche.

### Nage (sortie à l'écluse)

- **S1 Coule à l'arrêt.** Dehors, aucune touche pendant 2 s : dy −0,41 m. Le round précédent annonçait 0.
- **S2 Corde muette.** W tenu 8 s dans le même axe : 23,5 m parcourus à vitesse constante, aucune tension, aucune
  butée ressentie. Si la longe a une longueur, elle ne se sent pas.
- **S3 Retour long.** « Rentrer » (E maintenu) : 11,1 s avant d'être de nouveau dans le sas.
- **Bon** : contrôle à 6,4 s après « Sortir par l'écluse » ; nage 2,8 m/s, sprint 4,4 m/s qui consomme le souffle
  (1,00 → 0,64) ; Espace monte (+2,5 m en 1,5 s), Ctrl descend (−2,1 m) ; cadrage 6 m, FOV 55 ; on ne marche jamais
  sur le fond.

### Interactions

- **I1** = bug 3 (« Dormir » après martèlement de E).
- **I2 « Dormir » reste la première invite** au réveil, 0,8 s après la fin de l'intro, alors que la tâche est
  « Aller à l'écluse ».
- **I3 Première sortie lourde.** `goto('sas')` → « Lire le tableau » → 8 pressions de E (dialogue de Mme Rouille,
  sans indication de touche, seul un triangle) → « Sortir par l'écluse » → 6,4 s de cinématique.
  Total : ~15 s avant de nager.
- **I4 Empilement au centre.** Devant le tableau du sas : titre de zone « L'Écluse », bulle de PNJ, aide
  « [E] près de la porte ronde… » et invite « E S'asseoir » au même moment. L'aide parle de la porte, mais E fait
  asseoir sur le tabouret (`t3-coursive.jpg`). Même chose au Marché (titre + « Parler »).
- **I5 Banc sans invite.** Face à `banc-nef-1` à 2,5 m puis à son contact : aucune invite « S'asseoir ».

### Ordre de correction proposé

1. C1/C2 : vraie épaule (0,4–0,5 m) dans les pièces de moins de 4 m, et relever la caméra au lieu de l'avancer sous 1 m.
2. L1 + J2 : sortie d'échelle sur le palier, mantle direct sous 1,2 m.
3. Bug 3 : avaler E jusqu'à ce que la touche soit relâchée *et* 1 s écoulée ; ne pas proposer « Dormir » en premier au réveil.
4. C3/C4 : plancher de distance en couloir et sur échelle quand rien ne touche la caméra.
5. S1–S3, M1–M3, I3–I5.

### Ce qui n'a pas été testé (round 2)

Filets, tuyaux, nervures de coque (aucune ancre de ces types dans `anchorsNear`), saut depuis une tyrolienne,
manette (stick droit). Pointer lock réel : refusé à l'onglet CDP, donc non vérifié.
