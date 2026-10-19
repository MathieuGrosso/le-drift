# Feel — revue gameplay, round 2 (relecteur)

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

## Notes

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

## Les 4 bugs de l'orchestrateur, revérifiés

| # | État | Mesure |
|---|---|---|
| 1 Caméra de cabine | **Partiel** | Départ : 2,7 m, tangage 0,28, FOV 64,6, `side` 0,09 : Ilo reste centré et cache la porte ronde (`cab-0.jpg`). En reculant 2 s vers la caméra (S), la caméra arrive à **0,23 m** de la tête, `side` 0,5, FOV 68,8 : l'image n'est plus qu'Ilo tramé en gros plan dans un coin sombre (`cab-wall.jpg`). Le fondu sous 0,8 m existe (tramage visible) mais ne suffit pas à rendre la vue lisible. |
| 2 Espace ne saute pas | **Corrigé** | Cabine : +1,12 m (Espace tenu 300 ms), +0,56 m (tap 50 ms), séquence `jump>fall>land>idle`. |
| 3 E pendant la narration | **Partiel** | 20 E à 290 ms d'intervalle depuis le clic : narration terminée à 4,0 s, puis **menu « Dormir » ouvert à 5,2 s**. La seconde de grâce ne couvre pas un joueur qui martèle. Avec Espace martelé, le premier appui après la narration fait sauter Ilo (inoffensif). |
| 4 Intro longue et sombre | **Corrigé** (sauf la lumière) | Voir plus haut. La cabine reste très sombre à l'arrivée (`intro-auto-end.jpg`) et le carton « ACTE I · La Vitre » s'affiche sur Ilo pendant les premières secondes de jeu (`cab-0.jpg`). |

## Défauts, avec repro

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

## Ordre de correction proposé

1. C1/C2 : vraie épaule (0,4–0,5 m) dans les pièces de moins de 4 m, et relever la caméra au lieu de l'avancer sous 1 m.
2. L1 + J2 : sortie d'échelle sur le palier, mantle direct sous 1,2 m.
3. Bug 3 : avaler E jusqu'à ce que la touche soit relâchée *et* 1 s écoulée ; ne pas proposer « Dormir » en premier au réveil.
4. C3/C4 : plancher de distance en couloir et sur échelle quand rien ne touche la caméra.
5. S1–S3, M1–M3, I3–I5.

## Ce qui n'a pas été testé

Filets, tuyaux, nervures de coque (aucune ancre de ces types dans `anchorsNear`), saut depuis une tyrolienne,
manette (stick droit). Pointer lock réel : refusé à l'onglet CDP, donc non vérifié.
