# Feel — revue gameplay, round 4 (relecteur)

Build de `b99f8f6` (HEAD, exporté hors de l'arbre de travail qui contient une passe art non commitée),
`vite preview` :4211, Chrome 155 GPU réel lancé avec mon propre profil (port 9334, pointer lock **réel**
cette fois : `document.pointerLockElement` vrai après le clic). Entrées CDP réelles (touches tenues,
souris). `cd` = distance caméra-tête par frame, `clip` = frames où une sphère de 0,12 m à la caméra
touche un collider solide, saut de `cd` = plus grand écart d'une frame à l'autre.
Captures : `shots/review4/` (non versionnées). ~8 min de jeu cumulé, 8 scénarios.

**Limite de mesure** : le Mac était sur batterie (7 % → 4 %) ; Chrome a plafonné `requestAnimationFrame`
à 30 Hz (mesuré à 30,5 Hz sur une boucle rAF vide, 148 ips au tout premier frame). Les fps ne sont donc
pas notés, et les sauts de `cd` « en une frame » sont deux fois plus gros qu'à 60 ips. Session écourtée
par la batterie : portes de coques scellées, bancs du réfectoire et hisse sur rebord non refaits.

## Notes

| Axe | Note | En une phrase |
|---|---|---|
| Caméra | **6,5/10** | 0 frame de clip sur toute la session, recentrage en diagonale réglé, mais elle *saute* encore vers Ilo en coursive (−1,58 m en une frame) et colle à 0,2 m sur les échelles. |
| Saut | **8/10** | Tenu 300 ms : apex +1,11 m ; tapé : +0,42 m ; buffer OK (2 sauts) ; saut depuis l'échelle OK. Le saut en descente d'escalier passe toujours la rampe. |
| Déplacement | **7/10** | Escaliers sans glisse (8 m descendus en 3,6 s, 5,6 m montés), coyote sur le rebord OK. Le sprint reste un état `run` sans différence lisible. |
| Escalade | **6,5/10** | Échelle 8 m en ~6 s, sortie posée, hisse sur caisses (`climb`) OK. Caméra collée/Ilo invisible en regardant en haut, et on n'enchaîne pas sur l'échelle suivante. |
| Nage | **7/10** | Sortie rapide, nage lisible (montée +2,6 m / descente −2,2 m en 1,6 s), orbite propre, retour fiable. Dérive −0,37 m quand on lâche les touches. |
| Interactions | **6/10** | E pendant la narration n'ouvre plus rien, invite « Sortir par l'écluse » directe au sas. Mais le carton d'acte se superpose encore au nom du lieu, et on rentre face à l'écoutille avec « Sortir » affiché. |

## Les 4 bugs de l'orchestrateur, revérifiés

| # | État | Mesure |
|---|---|---|
| 1 Caméra de cabine | **Corrigé au départ, pas en jeu** | Spawn : `cd` 2,7 m, épaule 0,49, FOV 65,6, Ilo dans le tiers gauche, écoutille visible (`cab-0.jpg`). Orbite 1600 px : 0 clip, saut max 0,03. Mais S 2 s puis A 1,6 s : `cd` 0,50 m, saut de 0,58 m en une frame, Ilo tramé plein écran contre la paroi (`cab-strafe.jpg`). |
| 2 Espace ne saute pas | **Corrigé** | Tenu 300 ms : apex +1,11 m (`jump>fall>land>idle`). Tap 50 ms : +0,42 m. Buffer (Espace tapé avant l'atterrissage) : 2 sauts. |
| 3 E pendant la narration | **Corrigé** | 20 E à 300 ms : la narration avance ligne à ligne (~1 s par ligne), contrôle à 3,6 s, aucun menu ouvert, pointer lock conservé. |
| 4 Intro longue | **Corrigé** | Sans rien toucher : contrôle à 10,4 s. Échap : 1,2 s, pas de pause. W tenu dès le clic : Ilo bouge à 0,1 s. |

Note : un premier essai a ouvert le menu **Pause** pendant l'intro ; c'était la perte du pointer lock
quand mon onglet précédent s'est fermé (`onLockChange` → `pause`), pas la touche E. Comportement correct,
mais un joueur qui fait Alt-Tab pendant l'intro tombera aussi sur la pause par-dessus la narration.

## Défauts, du plus gênant au moins gênant

### C1 — La caméra saute encore vers Ilo dans la coursive (caméra)
Repro : `__game.goto('coursive')`, tenir W, souris +500 / −1000 / +500 px, trois fois (14 s).
`cd` : 2,50 → **0,92 m en une frame** (−1,58 m), puis remonte en ~1 s (0,95 1,33 2,05 2,59).
Deux plongées sous 1 m en 14 s, 6 frames avec |Δcd| > 0,25 m sur 421. 0 clip. Le round 4 programmeur
mesurait 0,34 max ; à 30 ips la rentrée tient en moins de frames, mais 1,6 m d'un coup reste une
coupure. Attendu : rentrée lissée sur 0,1–0,15 s même à 30 ips (lisser en temps, pas en frames).

### C2 — Échelles : caméra dans la tête (caméra / escalade)
Repro : téléport local (4 ; 0 ; 0), yaw −π/2, W 2,5 s (Ilo monte `mat-0-8`), souris 1500 px en lacet,
puis −600 px en tangage. `cd` **0,21 m**, côté −0,25, Ilo invisible. En montant sans souris :
2,51 → 0,83 en une frame, minimum 0,29 m. Inchangé depuis le round 3. Attendu : épaule côté vide,
et un plancher de distance qui recule la caméra au lieu de l'avancer.

### C3 — Cabine : marcher vers la caméra puis latéralement l'écrase (caméra)
Repro : spawn, W en orbite 2 s, S 2 s vers la paroi du fond, A 1,6 s. `cd` 2,03 → 0,50 m,
saut 0,58 m en une frame, Ilo tramé qui remplit l'écran (`cab-strafe.jpg`). La caméra devrait pivoter
vers l'espace libre (le correctif `bd130a2` le fait en S pur, pas en S puis A).

### J1 — Saut en descente d'escalier : par-dessus la rampe (saut)
Repro : Nef, téléport local (−28 ; 8 ; −4), yaw π, W + Maj, Espace après 0,8 s. Ilo passe la rampe,
chute de 3,8 m et est encore en `fall` 1,5 s plus tard. Un saut réflexe dans un escalier ne devrait
pas sortir de l'escalier : garde-corps plus hauts ou collider invisible au-dessus de la rampe.

### U1 — Carton d'acte superposé au nom du lieu (lisibilité)
Au réveil, « Le Quartier de l'Écluse » est dessiné en travers de « Acte I — La Vitre » au centre
(`cab-0.jpg`). Le round 4 le disait corrigé (`d38396b`) ; sur HEAD il réapparaît. À refaire en file.

### L1 — On n'enchaîne pas d'une échelle à l'autre (escalade)
Repro : monter `mat-0-8` (W 7 s, sommet à y 8,03, posé), tourner 1200 px, W 4 s : Ilo marche 8,7 m sur
le palier et ne s'accroche pas à `mat-8-16`. Il faut viser le pied précisément. Attendu : aimantation
de l'échelle à ~1 m et ±45°.

### S1 — Sortie : dérive et retour face à l'écoutille (nage / interactions)
- Lâcher les touches après l'orbite : Ilo dérive de −0,37 m en 4 s.
- Retour par « Rentrer » (E tenu) : Ilo réapparaît dans le sas avec « Sortir par l'écluse » déjà
  affiché ; un E prolongé relance une sortie. Faire réapparaître Ilo dos à l'écoutille ou ignorer E 0,5 s.
- Bon : invite « Sortir » directe (le tableau ne la vole plus), nage W 11,4 m en 4 s, sprint de nage
  11,3 m en 3 s avec FOV 55 → 59,5, souffle 1 → 0,68, 0 clip dehors.

### M1 — Le sprint ne se voit pas (déplacement)
Maj + W 6 s au réfectoire : l'état reste `run`, 23 m en 6 s, souffle 1 → 0,36. On paie l'endurance sans
gain lisible ni FOV qui s'ouvre à l'intérieur. Viser +40 % et un état/animation `sprint`.

## Ce qui est bon (à ne pas casser)

- **0 frame de clip** caméra sur toute la session : cabine, coursive, escaliers, échelle, caisses,
  tyrolienne, toboggan, tube, sortie.
- Recentrage en diagonale : W+D 2,5 s après un regard à droite, lacet caméra +0,5 rad (il faisait 3,6 rad).
- Escaliers Nef : descente 8 m en 3,6 s, montée 5,6 m en 3,6 s, aucune glisse, `cd` stable (saut ≤ 0,18).
- Caisses : W contre la pile → `climb` puis dessus ; saut en courant → apex 1,74 m, réception propre.
- Saut depuis l'échelle : lâche à 3,6 m, `jump>fall>land>idle`.
- Tyrolienne Nef ouest : 22 m de dénivelé, arrivée `idle`, marche ensuite. Toboggan : 14 m, sortie en
  course. Tube Nef → Marché : 84 m, arrivée `idle` avec invites du marché, W marche aussitôt.
- Coyote : sortie en courant du rebord, pas de chute brutale (`run>walk>idle`, −0,57 m).
- Coursive vers sas : 5 s de marche à travers l'encadrement, `cd` 2,75–3,21, saut max 0,24.

## Priorités suggérées

1. C1 + C2 + C3 : lisser la rentrée de caméra en temps (pas en frames) et ajouter un plancher de
   distance/épaule côté vide. C'est encore le premier ressenti « caméra buggy ».
2. U1 : remettre les cartons en file (régression).
3. J1 : garde-corps des escaliers de la Nef.
4. L1 + S1 (retour au sas) + M1.

## Non vérifié ce round

Manette, réglages sensibilité/inversion modifiés, bancs du réfectoire (s'asseoir, sauter dessus),
hisse sur rebord, portes des coques scellées, `echelle-cs-01`, fps réels (rAF bridé à 30 Hz par Chrome
sur batterie).

---

# Round 5 — programmeur gameplay : traversées testées au clavier réel

Build de `7021a25` + correctif échelle (`32b1c0e`), exporté hors de l'arbre de travail (d'autres agents
avaient des modifs non compilables dans `src/drift`), Chrome GPU réel (port 9341, profil à part), entrées CDP
réelles (touches tenues, E/Espace tapés), téléport local seulement pour se placer. Pointer lock non obtenu
par CDP : la souris passe par le glisser clic droit. Captures : `shots/r5/` (non versionnées).

## Checklist des traversées

| Traversée | Entrée | Sortie | Sens inverse | Verdict | Mesure / remarque |
|---|---|---|---|---|---|
| Tube Nef → Marché / Serres / Ateliers / Scellées / Proue | E à 2 m : invite « Tube : <quartier> » juste | arrivée `idle`, W marche aussitôt | les 5 retours vers la Nef OK | **OK** | 10/10 trajets, arrivée Nef (0 ; −6 ; −19,7) ; Marché : W bute sur un tonneau d'étal à 0,6 m (orientation d'arrivée) |
| Tube : entrer à pied dans la cabine | W vers l'ouverture | — | — | **KO (design)** | on glisse autour du fût (collider de porte 0,9 m devant l'ouverture), seule la touche E fait partir |
| Tyrolienne Nef ouest | E | arrivée au sol (8 ; −6 ; 18), W marche | — | **OK** | saut caméra 3,4 m entre deux relevés à 200 ms à l'arrivée |
| Tyrolienne Marché | E | arrivée (−88 ; 0 ; 4) | — | **OK** | `cd` min 0,71 m pendant le trajet |
| Tyrolienne Écluse | E vole par « Ramasser » | — | — | **KO (invites)** | une trouvaille au départ prend la priorité sur la tyrolienne (gameplay/indoor : priorité des invites) |
| Toboggan Nef | W depuis le haut | sortie en course | — | **OK** | 14 m de descente |
| Toboggan Marché | W à ≤ 0,6 m de l'entrée | descente | — | **OK** | à 1,5 m derrière, W fait `climb` le mur du palier |
| Échelle puits Écluse (16 m) montée | W au pied | sortie posée en haut | — | **OK** | |
| Échelle puits, descente depuis le haut | W vers l'échelle depuis le palier | pied de l'échelle | — | **Corrigé** | avant : bloqué contre le garde-corps à 1,2 m (portée 0,9). Portée 1,3 m et W tenu = descendre jusqu'au relâchement : 16 m descendus W tenu |
| Échelle `mat-0-8` montée | W | palier à 8 m | — | **OK** | caméra `cd` 0,34 m, saut 4,2 m (C2 toujours ouvert) |
| Échelle `echelle-cs-01` | W | — | — | **KO** | accroché mais ne monte pas (y 0,33 fixe) ; probablement la règle « pas de montée tête dans l'eau » de la coque scellée |
| Sauter d'une échelle | Espace | `jump` | — | **OK** | |
| S'asseoir / se lever (banc Nef) | E « S'asseoir » | W relève, `none` | — | **OK** | |
| Écluse (sortie) | E « Sortir par l'écluse » | mode `sortie` en 6,3 s | — | **OK** | `cd` 0,45 m juste après la sortie |
| Rentrer (longe / sas) | E tenu | retour au sas, W marche | — | **OK** | S1 toujours ouvert : « Sortir par l'écluse » s'affiche dès le retour |
| Saut (Espace) | tapé 60 ms | | | **OK** | apex +0,60 m |

## Non fait ce round (reste à faire)

- C1/C3 caméra (rentrée brutale en coursive, écrasement en cabine) et C2 (échelles) : non retouchés.
- Saut caméra à l'arrivée de tyrolienne (3,4 m entre deux relevés).
- Porter/poser, hisse sur rebord, portes des coques scellées, cycle d'écluse par l'échelle du toit : non testés.
- Priorité d'invites (trouvaille contre tyrolienne/échelle) et retour au sas face à l'écoutille : côté `src/gameplay`.
- Les `mat-*` : leur palier haut est côté `+n`, la descente depuis le haut n'a pas pu être testée par mon placement.
