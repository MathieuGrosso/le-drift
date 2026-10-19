# Feel — round 2 (programmeur gameplay)

Build `npm run build`, `vite preview` :4210, Chrome 155 GPU réel (port 9222, onglet dédié), `?debug&nosave`.
Entrées réelles CDP (`Input.dispatchKeyEvent` tenu, `Input.dispatchMouseEvent`), `mousemove` réels pour le look
(pointer lock refusé aux onglets CDP). Mesures par frame en coordonnées **locales du Drift** (le Drift avance :
les « glissades » de M5 au round 1 étaient le navire qui bouge). `clip` = sphère 0,12 m à la caméra qui touche un
collider solide. `distJerk` = plus grand saut de vitesse de la distance caméra-tête en une frame.

## Checklist traversées (entrée et sortie, avec vraies touches)

| Traversée | Résultat | Mesure |
|---|---|---|
| Saut (Espace tenu / tapé) | OK | apex +1,15 m tenu, +0,58 m tapé ; coyote 0,12 s, buffer 0,12 s ; `jump→fall→land` |
| Saut sur caisses / mantle | OK (corrigé) | pile de caisses de la Nef : était bloqué en `climb` sous un surplomb ; mantle sur le dessus en ~1 s |
| Escalier, descente / montée | OK (corrigé) | descente 8 m en 3,6 s : 200 frames `run`, 0 `fall` (262/398 en `fall` au round 1) |
| Échelle, monter par le pied | OK | mât 0-8 : 0 clip, distance min 1,9 m ; puits de l'Écluse 16 m, sortie en haut |
| Échelle, sortie en haut | OK (corrigé) | recherche d'un point d'appui (par-dessus, derrière, sur les côtés) ; plus de collage au fût (L1) |
| Échelle, descendre (S) / lâcher (Ctrl) | OK | retour au sol, `fall→land` |
| Échelle, sauter (Espace) à mi-hauteur / sous plafond | OK (corrigé) | mi-hauteur : retombe à 3 m ; en haut : Espace = sortie ; détection « figé en l'air » (J1) |
| Tube pneumatique Nef ↔ 5 stations | OK (corrigé) | la caméra restait côté Nef, face à Ilo, W poussait dans la cabine : arrivée caméra derrière, Ilo avancé de 1,3 m hors de la cabine, distance caméra ≥ 1,4 m |
| Tube retour (Marché → Nef) | OK | E face à la cabine |
| Tyrolienne Nef ouest | OK | 31 m, `zip` 191 frames, arrivée au sol ; distance caméra min 1,1 m au départ |
| Toboggan Nef | OK | entrée en marchant dedans, 14 m de descente, sortie en course |
| Porte de cabine | OK | invite Ouvrir/Fermer, passage sans accroc |
| Écluse sortie / entrée | OK | tableau → Sortir → nage → « Rentrer » (E maintenu) → rembobinage 4 m/s → sas → air |
| Nage (W seul) | OK (corrigé) | flottabilité neutre : dy 0 sur 4 s (−0,45 m/s au round 1) ; Espace +1,6 m/s, Ctrl −1,2 m/s |
| S'asseoir / se lever | OK | banc du Réfectoire, W pour se lever |
| Porter / poser | OK (API seulement) | saut porté 0,46 m ; aucun système ne déclenche `carry()` en jeu |
| Échelle du mât 8-16 (caméra) | Partiel | 12 frames de clip sur 500 au passage du plancher annulaire, la caméra suit Ilo par le trou |

## Les 4 bugs de l'orchestrateur

1. **Caméra de cabine** : 2,7–3,0 m, 0 clip en idle, en lacet ±600 px, en tangage et en marche. FOV intérieur 64
   (+5 dans les pièces étroites), tangage max intérieur 52° (vue zénithale supprimée), Ilo s'estompe sous 0,8 m.
2. **Espace** : apex +1,15 m. Hauteur variable seulement sur un tap (< 0,16 s), le saut tenu 300 ms donne la hauteur pleine.
3. **E pendant la narration** : 12 E à 250 ms → plus de menu « Dormir » (1 s de grâce après l'intro, la touche est avalée).
4. **Intro** : bouger (ZQSD / stick) passe l'intro : contrôle à **1,3 s** après le clic de démarrage. Lignes auto 2,2–4,5 s.
   Les cartons d'acte ne bloquent plus E / M / Échap (I2) : tube et pause marchent pendant « ACTE II ».

## Autres corrections

- **C1/C2 souris** : tout clic hors d'un contrôle d'UI reverrouille la souris (listener sur `window`, calque des bulles
  transparent aux clics). Sans verrouillage, glisser clic gauche ou droit oriente la caméra (+0,5 rad mesuré).
- **C3 caméra** : la caméra glisse vers l'avant à 9 m/s quand un obstacle n'occulte que la vue et ne saute que si elle
  entrerait dans la géométrie, puis tient 0,35 s avant de ressortir (fin du pompage sous les poutres).
- **M1/M2 sprint** : 6,0 m/s contre 3,8 m/s en course (+58 %) ; pousser un mur ne vide plus l'endurance.
- **M4 demi-tour** : plus de bascule de lacet en une frame après un dérapage.
- **Invites** : « Parler » ne s'affiche que face au PNJ (ou à moins de 1,3 m) ; il volait l'invite de la tyrolienne.
- `?debug` expose `__heroCtrl` et `__heroCam`.

## Reste à faire

- Caméra au passage d'un plancher par une échelle (mât 8-16).
- C5 : caméra à 0,5–0,6 m quand Ilo pousse dans un coin ; pas de décalage latéral automatique.
- I3 : dans le sas, « Lire le tableau » prend E avant « Sortir » tant que la quête l'exige (voulu, mais double invite).
- I5 : « Dormir » reste la première invite au réveil.

---

# Feel — revue gameplay, round 1

Build `npm run build` du commit `8022d96`, `vite preview` sur :4211, Chrome 155 GPU réel (profil debug, port 9222), viewport 1512×804 @2x.
Partie neuve (`?nosave&debug`), 23 sessions scriptées pendant environ 12 min de jeu.
Entrées réelles via CDP : `Input.dispatchKeyEvent` (keyDown/keyUp tenus), `Input.dispatchMouseEvent` (mouseMoved, `movementX` réel).
Mesures par frame (rAF) : position et mode d'Ilo, distance caméra-tête, FOV, endurance, et **clip** = une sphère de 0,12 m (demi-largeur du near plane) au centre de la caméra qui intersecte un collider solide (hors trigger, fauna, kelp, net, seat).
`distJerk` = plus grande variation de la vitesse de la distance caméra en une frame (un saut brutal de la caméra).
Captures : `shots/feel/*.jpg` (non versionnées).

Limite du banc : Chrome refuse le pointer lock à un onglet ouvert par CDP (« root document not valid »). Le look souris est donc mesuré avec de vrais `mousemove`, après avoir forcé `ctx.input.pointerLocked = true`. Le chemin clic → verrouillage, lui, est cassé pour de vrai (voir C1).

## Notes

| Axe | Note | En une ligne |
|---|---|---|
| Caméra | **5/10** | Bonne dans les coursives et la Nef, mais elle traverse le mât sur l'échelle, saute de 0,7 à 4 m en une frame près des plafonds, et un clic ne rend jamais la souris. |
| Saut | **7/10** | Le saut est corrigé : 1,14 m tenu, 0,62 m tapé, coyote time, on monte sur les tables. On reste figé en l'air en sautant d'une échelle près d'un plafond. |
| Déplacement | **6/10** | Réactif (0 à 4 m/s en 0,3 s, arrêt en 0,2 s), monte bien les escaliers. Le sprint n'ajoute que 10 %, la descente d'escalier joue l'animation de chute, et pousser un mur en sprint vide l'endurance. |
| Escalade | **4/10** | L'échelle s'attrape en marchant et monte à 1,6 m/s, mais l'échelle du mât n'a pas de sortie : on se colle au mât en clignotant entre `fall` et `climb`. |
| Nage | **5/10** | Vitesse correcte et corde lisible, mais Ilo coule en avançant, sort de l'écluse dos à la coque, et le fond marin est au centre de l'image. |
| Interactions | **4/10** | Le E du dialogue de Mme Rouille déclenche l'écluse. Les premières pressions sont mangées pendant le carton d'acte, et deux invites se disputent la même touche. |

## Les 4 bugs signalés par l'orchestrateur

1. **Caméra dans la cabine au démarrage : corrigé.** Distance 2,71 m, Ilo bas-centre, rien ne clippe (`10-cabin-idle`). Ça régresse dès qu'on tourne : après 600 px de yaw, la caméra tombe à **0,74–0,9 m** (14 frames sous 0,8 m), et la tête d'Ilo occupe le centre sans s'estomper (`13-cabin-look`). En tangage à fond (+300 px), la vue devient zénithale au-dessus d'Ilo (`14-cabin-pitch`).
2. **Espace ne saute pas : corrigé.** Espace tenu 300 ms → apex **+1,143 m**. Tapé 50 ms → **+0,615 m** (hauteur variable). Suite `jump → fall → land`.
3. **E traverse la narration : corrigé pour l'intro, pas ailleurs.** Six E à 250 ms pendant l'intro : chaque carton exige environ 1,4 s, le reste est avalé, et « Dormir » ne s'ouvre pas. Le même défaut existe dans le dialogue du tableau (I3).
4. **Intro longue : corrigé.** Trois cartons, avancés au clic, à Espace ou à E. Contrôle obtenu à 5,2 s en enchaînant les pressions, et tout de suite avec Échap. Sans rien toucher, le premier carton reste environ 6 s.

## Caméra

**C1 — Le clic ne reprend jamais la souris (bloquant).** `.drift-bulles` (`src/drift/chatter.ts`) est un calque `position: fixed; inset: 0` dont le `pointer-events: none` est écrasé par `#ui > * { pointer-events: auto }` (une règle d'id bat une règle de classe). `elementsFromPoint(640,400)` renvoie `DIV.drift-bulles pe=auto` au-dessus du `CANVAS`, et un clic CDP au centre déclenche **0** `click` sur le canvas. Après Échap, un alt-tab ou une perte de focus, cliquer dans le jeu ne reverrouille pas la souris, et sans verrouillage `onMouseMove` ignore tout : la caméra est morte. C'est très probablement le « caméra vraiment buggy » du propriétaire. Repro : lancer une partie, Échap, Reprendre ou cliquer dans la scène, bouger la souris.
**C2 — Aucun look sans pointer lock.** `input.ts` n'accepte la souris que verrouillée. Il n'y a pas de repli clic-droit-glisser, alors qu'un navigateur peut refuser le verrouillage (iframe, onglet d'arrière-plan, Safari, ou deux Échap rapprochés).
**C3 — Sauts de distance en une frame.** Orbite de 1000 px en haut de l'escalier de la Nef : `distJerk` **2,22 m**, distance entre 1,35 et 5,3 m. Tangage dans la cabine : 0,69 m. Échelle du mât : **4,16 m**. Le cast se raccourcit instantanément (`allowed < dist` → `dist = allowed`) puis ressort à `easeOut`, ce qui donne un pompage visible près des poutres et des plafonds.
**C4 — La caméra traverse le mât sur l'échelle.** Échelle `mat-0-8` (local 2.9,0,0), montée de 3 s : 8 frames en clip, et l'écran entier montre les barreaux sans Ilo (`36-ladder-mid`). Le style `ladder` ajoute +0,6 m de distance et recentre le yaw sur le mur, ce qui pousse la caméra dans le fût.
**C5 — Caméra collée dans les coins.** Dans le sas, contre un mur en sprint : 276/276 frames à **0,58 m**, Ilo réduit à une silhouette tramée en bord d'écran (`75-swim-sprint`). Il n'y a pas d'offset latéral pour se dégager, et pas de recentrage quand on est bloqué.
**OK :** coursive en W pendant 3 s, distance 2,9–3,7 m, 0 clip, jerk 0,2. Nef 4,6–5 m, FOV 62. Sas 2,7–3,05 m. Zip : la caméra suit derrière, FOV 66–69, lisible (`52-zip-ride`). Aucun basculement constaté, pitch borné.
**Réglages :** sensibilité et inversion existent (Pause → Réglages).

## Saut

**J1 — Figé en l'air après un saut d'échelle sous un plafond.** Monter `mat-0-8` jusqu'à environ 6,8 m (local), puis Espace : mode `fall` pendant 1,2 s et plus, y constant à 61,829, caméra en clip 123/123 frames à 0,72 m (`37-ladder-jumpoff`). Le même saut à 3,6 m retombe normalement.
**J2 — Ilo se colle à la Grande Vitre.** Courir vers la vitre du Réfectoire en tapant Espace toutes les 0,4 s : Ilo finit à +1,85 m, plaqué contre le verre en pose de saut pendant 173 frames (`62-refectoire-jump`). Il escalade la vitre de l'intérieur.
**OK :** coyote et buffer présents, monter sur banc et table au saut fonctionne (+1,0 à +1,6 m atteints), réception `land`.

## Déplacement

**M1 — Le sprint n'apporte presque rien.** Course 3,98 m/s, Maj+W 4,3 m/s (+10 %) pour 31 % d'endurance en 3 s. BotW est à environ +60 %.
**M2 — Le sprint contre un mur vide l'endurance.** Maj+W bloqué dans un coin du sas : déplacement 1,55 m en 3 s, mode `idle` 274/276, endurance 1,0 → 0,70.
**M3 — La descente d'escalier joue la chute.** Escalier de la Nef (local -28, de 8 à 0) en W pendant 4 s : 262 frames en `fall` sur 398. Ilo « tombe » de marche en marche au lieu de descendre.
**M4 — Le demi-tour est instantané.** W puis S : le yaw passe de 1,26 à -1,88 en une frame, vitesse à 0, puis réaccélère. C'est lisible mais sec : il n'y a pas de pivot ni de dérapage.
**M5 — Glissade à l'arrêt.** W tapé 120 ms : 0,22 m pendant l'appui, puis 0,41 m après le relâchement.
**OK :** montée de l'escalier à 1,9 m/s vertical sans accroc, coursive et portes franchies sans blocage, accélération en 0,3 s.

## Escalade

**L1 — L'échelle du mât n'a pas de sortie.** W tenu 7 s depuis le pied de `mat-0-8` : Ilo arrive à local (2,35 ; 8,1) puis alterne `fall` et `climb` contre le fût (77/66 frames). L'endurance descend (0,91) et il ne se hisse jamais sur la plateforme (`41-ladder-exit`). Il manque une sortie en haut de l'échelle et un mantle vers la plateforme.
**L2 —** Descendre l'échelle avec S fonctionne (de 3,65 à 0,01 en 3 s). Sauter à 3,6 m fonctionne. Voir J1 pour le cas haut.
**L3 —** L'échelle part en `ladder` dès qu'on marche dedans, sans invite : c'est bien, mais aucune indication avant le contact.

## Nage (sortie à la longe)

**S1 — Ilo coule en avançant.** W seul pendant 5 s : y passe de 55,8 à 53,5, puis de 53,3 à 51,7 en 4 s, soit environ 0,45 m/s vers le fond. Le joueur doit corriger en permanence avec Espace, et le fond marin, qu'on ne doit jamais rejoindre, finit au centre de l'image.
**S2 — Sortie dos à la coque.** Au spawn, la caméra regarde le large, les kelps et les poissons (`83-sortie-spawn`). La coque, la vitre à nettoyer et la corde-guide sont hors champ.
**S3 — « Rentrer » partout, et sans effet.** L'invite « E Rentrer » reste affichée à 30 m du sas. Un E à 28 m ne fait rien (position inchangée après 6 s).
**S4 — E en sortie de sas te fait rentrer.** À l'apparition, « Entrer dans le sas » est l'invite active : un E de trop, ou celui du joueur qui enchaîne, annule la sortie. Ça s'est produit à la 2e pression.
**S5 — F loin d'une vitre ne dit rien.** F tenu 2,5 s en pleine eau : aucune invite, aucun retour.
**OK :** 2,9 m/s en nage et 3,7 m/s en sprint (endurance de 1,0 à 0,64 en 3 s, régénère), montée et descente nettes, caméra à 6–7 m sans clip, corde bien lisible (`86-swim-w2`). La longe borne la sortie à environ 28 m.

## Interactions et UI

**I1 — Le E du dialogue lance l'écluse.** Au tableau du sas, avec E toutes les 1,45 s : la 6e pression ferme le dialogue de Mme Rouille, la 7e déclenche l'écluse (`cutscene` → `water`) alors que le joueur ne visait pas la porte. Le dialogue doit avaler la pression qui le ferme.
**I2 — Pressions mangées pendant le carton d'acte.** Pendant les 4,5 s du carton « ACTE I · La Vitre » après l'intro, aucune invite ne s'affiche, et M, Échap et E sont perdus sans tampon. À 9 s, les mêmes touches ouvrent la pause et la carte. Même symptôme au tableau : le premier E après l'arrivée est ignoré.
**I3 — Deux invites pour E.** Dans le sas, le conseil « [E] près de la porte ronde pour passer l'écluse. » s'affiche (crochets bruts) au-dessus de « E Lire le tableau », mais E lit le tableau (`24-sas`).
**I4 — Le carton d'acte et le nom de lieu couvrent Ilo** (`10-cabin-idle`, `30-nef`). « Qualité réduite » chevauche « Nouvelle tâche » en haut à gauche (`31-stairs-bottom`).
**I5 — « Dormir » est la première invite du jeu.** Elle s'affiche dès le spawn dans la cabine, depuis n'importe quel point de la pièce.

## Hors gameplay, vu en passant

- Un banc de poissons nage **dans** le sas, sous le plafond (`24-sas`).
- Une longue ligne droite (câble ou longe ?) traverse le Réfectoire en diagonale devant la Grande Vitre (`62`, `64`).
- Performances : 80–100 fps en intérieur, 42–56 fps à l'arrivée dans la Nef, et « Qualité réduite » s'affiche environ 2 s après le démarrage.

## Ordre de correction proposé

1. C1 (calque qui mange les clics) et C2 (repli sans lock) : sans eux, la caméra n'existe pas pour le joueur.
2. I1 et S4 (E qui traverse), I2 (pressions perdues pendant les cartons).
3. L1 et J1 (sortie d'échelle, figé en l'air), C4 (caméra sur l'échelle).
4. S1 (flottabilité neutre quand on n'appuie sur rien) et S2 (spawn face à la coque).
5. C3 (lisser le rapprochement de la caméra), M1 à M3.
