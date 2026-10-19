# Feel — revue gameplay, round 3 (relecteur)

Build de `d11e877` (`npm run build`, copie figée de `dist/` servie par `vite preview` :4211), Chrome 155 GPU
réel (profil debug, port 9222, un onglet CDP à moi, refermé à chaque scénario), `?debug&nosave`.
Entrées réelles : touches CDP tenues/relâchées, déplacements souris CDP (`movementX` calculé par Chrome).
Chrome refuse le pointer lock à un onglet CDP : `input.pointerLocked` est forcé à `true` après le clic de
départ. Mesures par frame (rAF) : `cd` = distance caméra-tête, `clip` = frames où une sphère de 0,12 m
à la caméra touche un collider solide, saut de `cd` = plus grand écart de `cd` d'une frame à l'autre.
Captures : `shots/review3/` (non versionnées). ~10 min de jeu cumulé, 9 scénarios.

## Notes

| Axe | Note | En une phrase |
|---|---|---|
| Caméra | **6,5/10** | Ne traverse plus rien (0 frame de clip sur toute la session), mais elle *saute* vers Ilo (2 m en une frame) dans les coursives et sur les échelles, et tourne trop en diagonale. |
| Saut | **8/10** | Espace marche partout, arc net, buffer OK, contrôle en l'air OK, hisse sur les caisses. Reste : franchir un banc au lieu d'y atterrir. |
| Déplacement | **7/10** | Réactif, pas de glisse dans les escaliers, endurance qui se vide. Le sprint est à peine plus rapide que la course. |
| Escalade | **6,5/10** | Échelles fiables dans les deux sens et saut depuis l'échelle, mais caméra collée à Ilo (Ilo invisible) dès qu'on regarde en haut, et invite « Monter » affichée alors qu'on est déjà dessus. |
| Nage | **6,5/10** | Longe et montée/descente lisibles ; 6,4 s de cinématique pour sortir, on sort dos à la coque, et Ilo dérive encore 0,4 m après avoir lâché les touches. |
| Interactions | **5,5/10** | Les invites se battent entre elles (Dormir partout dans la cabine, le tableau qui vole l'écluse), et la porte de cabine ne s'ouvre que si on la vise pile. |

## Les 4 bugs de l'orchestrateur, revérifiés

| # | État | Mesure |
|---|---|---|
| 1 Caméra de cabine | **Corrigé, avec réserve** | Au départ : `cd` 2,7 m, épaule 0,49, FOV 65,6, Ilo dans le tiers gauche, porte visible. Orbite 1600 px : 0 clip, saut de `cd` max 0,02. Réserve : en marchant vers la caméra (S 2 s) `cd` tombe à 0,33 puis la caméra se pose à 0,05 m de la tête ; Ilo est tramé puis absent (`cab-wall.jpg`), on passe de fait en vue subjective. |
| 2 Espace ne saute pas | **Corrigé** | Tenu 300 ms : apex +1,13 m. Tap 50 ms : +0,57 m. Buffer (Espace tapé 560 ms après le premier saut, avant l'atterrissage) : 2 sauts, `jump>fall>land>idle`. |
| 3 E pendant la narration | **Corrigé** | 20 E à 290 ms : narration finie à 4,0 s, aucun menu ouvert. Espace avance aussi (contrôle à 3,6 s). |
| 4 Intro longue | **Corrigé** | Sans rien toucher : contrôle à 10,2 s. Échap : 1,5 s. W dès le clic : contrôle à 1,2 s. Les cartons restent sombres (cabine à 6 h, `intro-auto-1.jpg`) mais courts. |

## Défauts, du plus gênant au moins gênant

### I1 — La porte de la cabine se rate facilement (interactions)
Repro : démarrer, Échap, tenir W 1,8 s depuis le spawn sans toucher la souris. Ilo s'arrête à
(-10,3 ; 63,73), collé au mur juste à droite de l'écoutille fermée (`t1-coursive.jpg`). Aucune invite,
E ne fait rien, W tenu 2,5 s de plus : 0 m parcouru, Ilo piétine contre le mur. Avec W 0,8 s on obtient
« Ouvrir » : la fenêtre utile est de quelques dizaines de centimètres. La détection de porte est un seul
rayon tiré de la tête vers l'avant (`rayDoor`, `src/gameplay/indoor.ts`) : 30 cm à côté, il touche le mur.
Attendu : une invite par proximité + cône (~1,5 m, ±45°), et l'aide de chambranle qui ramène vers
l'ouverture même quand la porte est fermée.

### I2 — « Dormir » est proposé partout dans la cabine (interactions)
Repro : balayer 17 caps depuis le spawn (pas de 0,2 rad), W 2 s chacun. « Dormir » apparaît dans
**17/17** trajets, y compris devant la porte où il alterne avec « Ouvrir ». Le lit est un repli de pièce
(`roomFallbacks`), pas un objet à portée. Le joueur qui tape E à la porte peut ouvrir le menu de sommeil,
ce que l'orchestrateur avait justement signalé au bug 3. Attendu : « Dormir » seulement à moins de ~1,5 m
de la couchette.

### C1 — La caméra saute vers Ilo dans les coursives (caméra)
Repro : `goto('coursive')`, tenir W, balayer la souris ±500/1000 px pendant 9 s.
`cd` : 2,71 → **0,45 m en une frame** (saut de 2,27 m), puis remonte en ~1 s
(0,52 0,82 1,17 1,63 2,01 2,42 2,70). Trois fois en 9 s, à chaque coup de souris vers la paroi.
0 frame de clip : la caméra évite bien le mur, mais en se téléportant. À 0,45 m Ilo disparaît (tramage),
le joueur perd son repère une demi-seconde. Attendu : sphere-cast anticipé (lancer le test sur la
position *visée* de la frame suivante) et rentrée en 0,1–0,15 s au lieu d'une frame.

### C2 — Échelles : caméra collée, Ilo invisible (caméra / escalade)
Repro : téléport à (4 ; 0 ; 0) face au mât, W 2,5 s (Ilo monte `mat-0-8`), puis souris 1500 px en lacet
et −600 px en tangage (regarder en haut). `cd` tombe à **0,27 m**, saut de `cd` 1,59 → 0,43 en une frame,
Ilo n'est plus à l'écran (`t2-ladder-look.jpg`). En montant simplement : 2,52 → 0,71 en une frame.
Sur une échelle collée à un fût, la caméra devrait s'écarter latéralement (épaule) et reculer vers le
vide, pas avancer dans la tête.

### C3 — La caméra tourne en spirale en diagonale (caméra)
Repro : coursive, souris 450 px à droite, puis W+D 2,5 s sans souris. Lacet caméra 8,78 → 12,37 rad :
**3,6 rad (≈205°) en 2,5 s**. Ilo court en rond. Le recentrage derrière Ilo ne devrait pas s'appliquer
(ou très faiblement) quand l'entrée a une composante latérale ; BotW laisse la caméra fixe en strafe.

### C4 — Saut en descente d'escalier : coupure caméra (caméra)
Repro : Nef, téléport (-28 ; 8 ; -4), W + Maj, Espace après 0,8 s dans l'escalier. Ilo passe par-dessus
la rampe et chute de 9,5 m (`fall`, réception `roll`). À l'atterrissage `cd` 4,12 → 2,38 en une frame.
La chute elle-même est voulue (on peut sauter de la rampe), la coupure non.

### M1 — Le sprint ne se sent pas (déplacement)
Course 5,7 m/s, sprint 6,5 m/s : **+14 %**. L'endurance se vide (0,38 après 6 s de sprint au
réfectoire), donc on paie pour presque rien. Viser +40–50 % (8–8,5 m/s) avec un FOV qui s'ouvre.

### J1 — On dépasse le banc au lieu d'atterrir dessus (saut)
Repro : Nef, banc (12,2 ; -6 ; 5,05), 2,5 m devant, W + Espace à 350 ms, W tenu. Apex 1,29 m mais Ilo
retombe derrière le banc (y −5,97). Depuis l'autre côté : apex 1,42 m, Ilo passe le banc et tombe
**6,8 m** dans la trémie du puits (y −12,76, `roll`). Un garde-corps manque à cet endroit, ou le banc
est trop près du bord.

### S1 — Sortie : longue, et on sort dos à la coque (nage)
« Sortir par l'écluse » → contrôle dehors : **6,4 s** (dont 4 s de cinématique). Ensuite W 4 s :
Ilo s'éloigne de la coque vers le large (`s2-swim.jpg`) au lieu de longer les vitres ; il faut faire
demi-tour pour commencer à frotter. Lâcher toutes les touches après une descente : Ilo dérive encore
de −0,42 m en 2 s. Retour « Rentrer » (E tenu) → intérieur : 7,6 s.
Le reste est bon : montée +2,6 m en 1,6 s, descente −2,1 m, orbite 0 clip, longe qui freine en fin
de course, souffle 1 → 0,64 en 3 s de sprint.

### I3 — Le tableau de l'écluse vole l'invite de sortie (interactions)
Repro : `goto('sas')`, W 1,5 s. Invite « Lire le tableau » ; E ouvre un dialogue qui demande **8 appuis**
sur E avant de rendre la main, puis seulement « Sortir par l'écluse ». La météo du sas est une bonne idée
mais le joueur qui veut sortir la subit. Proposer les deux invites (E / une autre touche) ou mettre le
tableau sur le côté.

### I4 — En rentrant, « Sortir par l'écluse » est déjà affiché
Retour de sortie : Ilo réapparaît face à l'écoutille avec l'invite « Sortir » (`s2-back.jpg`). Un E un
peu long (on vient de tenir E pour « Rentrer ») peut relancer une sortie. Faire réapparaître Ilo dos à
l'écoutille ou ignorer E 0,5 s.

### L1 — Échelles, petits défauts (escalade)
- Invite « Monter » affichée alors qu'Ilo est déjà sur l'échelle (`t2-ladder-look.jpg`).
- Arrivé en haut de `mat-0-8`, regarder vers `mat-8-16` puis W 4 s : Ilo ne s'y accroche pas (y reste
  8,02). Il faut viser plus précisément le pied de l'échelle suivante.
- Ce qui marche : montée 8 m en ~6 s en gardant W, sortie en haut posée sur le palier, saut depuis
  l'échelle jusqu'au sol (`jump>fall>land`), hisse sur les piles de caisses (apex 2,5 m puis `climb>idle`
  sur le dessus).

### U1 — Cartons de titre superposés (lisibilité)
Au réveil, « Le Quartier de l'Écluse » et « Acte I — La Vitre » s'affichent l'un sur l'autre au centre
(`cab-0.jpg`), et le bandeau « Nouvelle tâche » se chevauche lui-même en haut à gauche. Même chose en
haut de l'escalier de la Nef (« Ondine t'attend aux Serres » sur une autre ligne, `t2-stairs.jpg`).
Les mettre en file, pas en même temps.

### U2 — Le frottoir traverse le décor en travers
Au rebord, la perche du frottoir dépasse à l'horizontale à travers le corps d'Ilo (`rebord.jpg`).

## Ce qui est bon (à ne pas casser)

- 0 frame de clip caméra sur toute la session (cabine, coursive, escaliers, échelles, tyroliennes,
  toboggan, tube, sortie).
- Saut : 1,13 m tenu, 0,57 m tapé, buffer, réception, contrôle en l'air (inverser en plein saut ramène
  Ilo à 0,46 m de son point de départ).
- Escaliers : 8 m descendus en 3,6 s, 3,5 m montés, aucune glisse.
- Tyrolienne Nef ouest : 22 m de dénivelé, arrivée au sol en `idle`. Toboggan de la Nef : 14 m, arrivée
  en course. Tube Nef → Marché : arrivée face au marché (le saut de `cd` à l'arrivée est une coupure franche, correct).
- Pas court : W 100 ms → 0,71 m (un peu long pour se placer devant une porte, cf. I1).
- Pause : Reprendre, Retour à la cabine, Rejoindre Ondine, Réglages (inversion, sensibilité 0,3–2,5),
  Commandes. Échap ferme proprement.
- Sensibilité par défaut : 800 px → 2,25 rad, correct.

## Priorités suggérées

1. I1 + I2 : invites par proximité et cône, « Dormir » limité au lit. C'est la première minute du jeu.
2. C1 + C2 : rentrée de caméra en 0,1–0,15 s au lieu d'une frame ; écart latéral sur les échelles.
3. C3 : pas de recentrage en strafe/diagonale.
4. M1 : sprint +40 %.
5. S1 : sortir face à la coque, cinématique d'écluse ≤ 2 s.

## Non vérifié

Pointer lock réel (refusé à CDP), manette, effet de la sensibilité/inversion une fois modifiées,
foule à l'arrivée des Serres, coques scellées.
