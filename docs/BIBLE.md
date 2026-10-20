# Le Drift — Bible (v2, « toujours dans le sous-marin »)

Single source of truth for every builder. You work in parallel with other builders and only see
this file plus the code. If the code and this file disagree, this file wins; if this file is
silent, choose the option that keeps the other folders working without you. §12 lists what the v1
code must change to match.

Pitch, in the owner's words: **« Zelda Breath of the Wild, mais sous l'eau »**, then the pivot:
**« je veux être toujours dans le sous-marin ; marcher sous l'eau c'est bizarre »**.

So: a BotW-like open world that lives **entirely inside the Drift**, 400 hulls linked into one huge
walkable city-ship. You walk everywhere inside (gravity, stairs, ladders, doors, nets, pipes). The sea
is a living backdrop seen through portholes, big windows and glass domes. The **only** time Ilo is
outside is a short, tethered **window-cleaning sortie**: out by a lock, swim along the hull, scrub,
come back in. **Nobody ever walks on the seabed.** BotW scale and freedom, Ghibli warmth: lamps,
lived-in clutter, people with routines. Soft, luminous, warm inside / cool outside. Never murk, never
orange mush.

Stack: Vite + TypeScript strict + three.js + `@dimforge/rapier3d-compat`. Scripts: `dev`, `build`,
`preview`, `typecheck`. No other runtime dependency. Assets are generated in code; a download is
allowed only if CC0, recorded in `assets/CREDITS.md` (source URL + license).

Player-facing text: **French only**. Code, identifiers, comments: English. Comments rare (traps only).

---

## 0. What BotW does, and what we keep

Sources: GDC 2017 "Breaking Conventions with The Legend of Zelda: Breath of the Wild" (multiplicative
gameplay, chemistry engine), the CEDEC/GDC 2017 level-design talk (triangle rule, "gravity", density
map), the art direction (Ghibli, impressionist painting), and the shipped game.

| BotW principle | What it means | Our rule, inside the Drift |
|---|---|---|
| Multiplicative gameplay | A few rules that combine | 10 ship-chemistry rules (§0.1); every puzzle solvable more than one way |
| Climb anything | Every surface is a route, gated by stamina only | Ladders, pipes, cargo nets, hull ribs, shelves, rope bundles, stacked crates: all climbable, cost = **endurance**. Only glass and wet condensation are not |
| Great Plateau | Closed tutorial, exit needs the paraglider | Act 1 is locked in **Le Quartier de l'Écluse**; you leave by the **zip line across La Nef** with grandfather's **poulie** |
| Towers | Visible from everywhere, a climb, reveal the map, a vista | **Dômes de veille** (7): glass domes on the tallest hulls; activation draws that district on grandfather's **plan du Drift** |
| Triangle rule | Occluders hide what is behind; landmarks always peek over | Hull bellies, hanging laundry, crate stacks and gangway bends hide; the Mât, the dôme lanterns and the Grande Vitre's glow always peek (§2.5) |
| Gravity (pull) | Strong silhouettes pull the player | Lit dôme lanterns, the green glow of Les Serres, the Mât's lamp rings, sea light at the end of a corridor |
| Density map | Something every ~30 s | One point of interest every 25-40 m of walking (trouvaille, NPC scene, window, shortcut, puzzle hull) |
| Shrines | Short puzzle rooms, one rule each | **Coques scellées** (12): sealed or flooded hulls with pumps, valves, ballast, pressure, bubbles, levers |
| Korok seeds | Tiny surprises everywhere | **Trouvailles** (60): things fallen from the ceiling that ended up in the ship |
| Cooking | Free combination, deterministic buffs | **Le Cuistot** (galley) and the **réchauds** in each district |
| Weather | Rain, cold, lightning change play | **Currents tilt the ship** (real gravity tilt), condensation makes walls slippery, the light outside changes with the forecast |
| Vistas | Crest a ridge, see the world | Huge interior atriums (**La Nef**, the market, the greenhouse) where you see dozens of hulls and gangways at once, plus the **Grande Vitre** over the open sea |
| Minimal HUD | Things appear when they matter | Endurance wheel beside Ilo, nothing else by default |
| No blocking fail state | Reload a few seconds back | No death. A fall into an atrium lands in nets; exhaustion only |
| Villages | Dense hand-made places with daily life | The whole Drift is the village: 40 000 people, hourly routines |

### 0.1 Ship chemistry (the "elements" of the Drift)

All systems honour these; puzzles are built only from them.

1. **L'eau** floods and drains. A flooded cell is swum (medium `water`); draining it lowers a flat water
   plane over 3-6 s. Floating props rise with it, heavy ones stay.
2. **La pression**: a pump or a valve moves water between two connected tanks/cells; a closed hatch holds
   pressure; opening one under pressure blasts (pushes light objects and Ilo 3 m).
3. **Le lest**: ballast tanks. Filling one tilts its hull (and the gangways around it) up to 8°; emptying
   one raises a platform, a lift, a whole hull section.
4. **La gîte**: gravity is tilted by the current (weather, up to 4°) and by local ballast (shrines, up to
   8°). Balls, barrels and bottles roll downhill; hanging lamps and pendulums show the true vertical.
5. **Les bulles**: an air line makes a bubble column in flooded cells: lifts Ilo and light objects; a
   trapped bubble (diving bell) lifts heavy ones; breathing a bubble refills endurance under water.
6. **La vapeur et la chaleur**: boilers, the galley, the engines. A steam vent is an updraft for a
   **toile** (cloth sail on the zip lines, §1); heat dries condensation; a cold pipe gathers it.
7. **La lumière**: lamps and windows. Light makes the kelp grow (Les Serres), attracts plankton and
   jellyfish against the glass, opens light-sensitive valves (old photocell locks).
8. **Le revêtement** (the coat): anything still in the sea grows fur, on the **outside** face only. A
   coated window passes no light into the room behind it. Only a sortie scrubs it.
9. **La corde**: ropes, pulleys, counterweights, zip lines. A rope under tension can be climbed, cut by
   a lever, or used as a counterweight with a sack of fish.
10. **La faim**: fish follow food (outside: dropping crumbs through a feeding hatch gathers a school in
   front of a window); cats and children inside follow the Cuistot's pots.

---

## 1. Transposition table BotW → Le Drift

| BotW | Le Drift | Notes |
|---|---|---|
| Link | **Ilo**, laveur de vitres du Drift | 16 y.o., coral scarf trailing (physics), scrubber on the back |
| Stamina wheel | **L'endurance** | Wheel beside Ilo: climbing, sprinting, swimming hard, hanging from a zip line. Same wheel outside |
| Hearts | none | No combat, no death; a hard fall = roll + endurance loss |
| Climbing | **Grimper partout**: ladders, pipes, cargo nets, hull ribs (`membrures`), shelves, crates, rope bundles, kelp stalks in Les Serres | Condensation (cold, north) makes metal slippery like BotW rain |
| Paraglider | **La poulie** (grandfather's old pulley hook) on **tyroliennes** (zip lines), plus **tubes pneumatiques** and **toboggans** between decks | Act 1 exit; a `toile` upgrade later lets you glide off the end of a line into a steam updraft |
| Horse | **Le wagonnet de cale**: a hand-pumped trolley on the keel rail | Fast along the bottom deck; optional |
| Towers | **Dômes de veille** (7) | Climb puzzle inside the hull; at the top, clean the dome's inner glass and align grandfather's **lunette**: the district is drawn on the plan, a vista plays |
| Shrines | **Coques scellées** (12 + Le Dôme de Proue) | Sealed or flooded hulls; reward a **nacre** |
| Spirit orbs | **Nacres** | 4 nacres → +0.2 endurance wheel (Grand-père turns them into a brass ring on your belt) |
| Korok seeds | **Trouvailles** (60) | Fallen through the ceiling, washed onto the roofs, pulled in by the vents: in pipes, on lamps, in a fish tank, behind a hatch. The kids name them wrong |
| Hestu | **Les enfants du rebord** (Mila, Tao, Pépin) | 5 trouvailles shown → +1 bag slot; their « musée du rebord » |
| Cooking pot | **Le Cuistot** (galley) and the **réchauds** (one per district) | Deterministic recipes, buffs |
| Weather | **Courants**: the ship heels (§0.1.4), the light outside, visibility, plankton bloom, jellyfish on the glass, condensation | Posted on the forecast board in each lock |
| Blood moon | **Nuit de plancton** | Every 5th night the sea glows green-gold through every window; residents gather at the glass |
| Map | **La carte du grand-père**, two sides: **la mer** (route, the white) and **le plan du Drift** (districts, revealed by dômes) | M opens it; the chart table in his room is the same canvas |
| Fast travel | **Les tubes pneumatiques** between unlocked stations + « Retour à la cabine » (always) | The anti-soft-lock exit |
| Sheikah Slate | **Le stylo du grand-père** (act 3) | Draws your own line in the white |
| Inn bed | **Ta couchette** (cabin bunk) and the hammocks of each district | Sleep = save + pass time |
| Hyrule Castle | **La Proue** and its **Dôme de Proue**, high and forward | Visible from every vista through the Nef's high windows; grandfather's room is under it |
| Death Mountain | **Le Puits des Machines** | The deep, hot, loud engine well under La Nef; orange glow from below (lamp colour, never haze) |
| Ganon | none; the mystery is **La Chose** | The bird diving through the ceiling twice a day, seen only through glass |
| Rain | **La pluie**: rings on the ceiling with no fish under them | Finale and post-game only |
| Going outside | **La sortie** | Lock → longe (tethered) → swim along the hull → scrub → back. Never the seabed |

---

## 2. The world: the Drift

### 2.1 Frames and units

- 1 unit = 1 m. Three.js axes. **All gameplay lives in the Drift-local frame `L`**: origin at the
  Drift's centre, **−z = la proue** (forward), **+z = la poupe** (aft), **+x = tribord**, **−x = bâbord**,
  +y up. `DriftService.toWorld/toLocal` convert (translation + heading only, never the visual sway).
- The world frame `W` (+x east, −z north) exists only for the sea backdrop, the route and the chart.
- Footprint in `L`: **x ∈ [−130, 130]** (260 m), **z ∈ [−80, 80]** (160 m), **y ∈ [−24, +30]**.
- The Drift's world altitude `DRIFT_Y` is 55 in acts 1-2 and **rises to 80 in act 3** (ballast emptied
  to clear the shallows): the Dôme de Proue's top then sits ~10 m under the ceiling (`CEILING_Y` = 120),
  close enough to see its texture.
- `SEED = 0x0D21F7`. Procedural parts of the ship are deterministic from it; hand-authored cells
  (§2.4) override the generator inside their bounds.

### 2.2 Decks (`DeckId`)

| Id | Nom | Local y (floor) | Character |
|---|---|---|---|
| `cale` | La Cale | −22 | Keel rail, ballast tanks, bilge water, the wagonnet, dark, pipes everywhere |
| `machines` | Le Pont des Machines | −14 | Engines, pumps, boilers, hot, loud, orange lamp light |
| `bas` | Le Pont Bas | −6 | Stores, workshops, the galley's cellar, greenhouse roots |
| `principal` | Le Pont Principal | 0 | Streets of the city: markets, refectory, the lock quarter (v1 rooms live here, floorY 0) |
| `haut` | Le Pont Haut | 8 | Homes, cabins, schools, balconies over the atriums |
| `toits` | Les Toits | 16 | Enclosed glass tubes over the roofs, hammocks, laundry, vista spots |
| `domes` | Les Dômes | 22-30 | The dômes de veille, grandfather's room, the prow |

Between decks: stairs (main streets), ladders (everywhere), toboggans (down only), tubes pneumatiques
(stations), lifts with counterweights (atriums), and climbable surfaces. Every deck is reachable from
every district without a key item except the act 1 gate (§3).

### 2.3 Districts (`DistrictId`), 400 hulls

Hulls are grouped in streets (`rues`) along z with gangway tubes between them, never in a random blob
(§5.6). Counts sum to 400.

| Id | Nom | Local bounds (x, z) | Hulls | Decks | Character | Dôme |
|---|---|---|---|---|---|---|
| `ecluse` | Le Quartier de l'Écluse | x −50..50, z 40..80 | 34 | cale→toits | Start. The lock, your cabin, the refectory and **La Grande Vitre** (aft), the kitchen, the sill, a small market. Act 1 is confined here | `dome-ecluse` (tutorial) |
| `marche` | Le Grand Marché | x −130..−50, z −10..80 | 70 | bas→toits | Barrel hulls opened into one long covered market street, three tiers of stalls, bunting, the clock | `dome-marche` |
| `serres` | Les Serres | x 50..130, z −10..80 | 48 | bas→toits | Kelp greenhouses under glass roofs, warm green light, water channels, the gardeners | `dome-serres` |
| `nef` | La Grande Nef | x −50..50, z −40..40 | 40 | cale→toits (open) | The central atrium, 50 m tall, every deck open onto it, gangways crossing at all heights, the Mât in the middle, zip lines. The hub | `dome-nef` (top of the Mât) |
| `machines` | Le Puits des Machines | x −40..40, z −60..40, under the Nef | 44 | cale, machines | Keel hulls, engines, ballast, the wagonnet rail, steam updrafts, the engineers | `dome-machines` (inverted: an observation bubble **under** the keel, looking down at the sea floor) |
| `ateliers` | Les Ateliers | x −130..−30, z −80..−10 | 56 | bas→haut | Rope works, net makers, the foundry, the school, the old library of logbooks | `dome-ateliers` |
| `scellees` | Les Coques Scellées | x 30..130, z −80..−10 | 52 | cale→haut | Old hulls closed after floods, half-dark, flooded cells; shrine-dense; a few squatters | `dome-scellees` |
| `hauts` | Les Hauts | over everything, y 16-24 | 30 | toits | Small tower hulls and glass tubes linking the dômes; through the glass you see the whole Drift's roofs and the ceiling | (the tubes are the vista) |
| `proue` | La Proue | x −30..30, z −80..−50 | 26 | haut→domes | The forward-looking tower: grandfather's **Salle des Cartes**, his window, and on top the **Dôme de Proue** | `dome-proue` (act 3, finale) |

Seven dômes de veille in total for the plan (`dome-ecluse`, `-marche`, `-serres`, `-nef`, `-machines`,
`-ateliers`, `-scellees`); `dome-proue` is the finale, not a map tower.

### 2.4 Cells and portals

The interior is a graph of **cells** (`CellId`, string): a room, a corridor, a hull interior or a part of
an atrium. Cells connect through **portals** (door, hatch, open passage, window). A cell belongs to one
district and one or more decks.

- **Hand-authored cells** (story places): `sas`, `coursive-sud`, `cabine`, `cabines-voisins`,
  `refectoire`, `rebord`, `cuisine`, `marche-ecluse`, `passerelle-1..3`, `echelle-toit` (the v1 quarter,
  kept), plus `salle-des-cartes` and `dome-proue` (moved to La Proue, §12), the seven dômes, the twelve
  coques scellées, `nef-*` (the atrium levels), `cuistot-cellier`, `serre-cathedrale`, `marche-horloge`,
  `puits`, `bibliotheque`, `ecole`.
- **Generated cells**: every other hull interior is assembled from a **kit** chosen by district (cabin
  row, workshop, store room, stall row, greenhouse bay, pump room, flooded room) with seeded clutter.
  Same materials, same props, same rules, so a generated hull is as walkable as a hand-authored one.
- Each cell owns: bounds, floor colliders, its lamps, its windows/portholes, its NPC anchors and its
  portals. Portal = quad + the two cell ids (+ door id when it closes).

### 2.5 Landmarks seen from inside (triangle rule)

Inside, sight lines are short; landmarks are what you glimpse **through openings**: atrium voids,
corridor ends, gangway tubes, high windows. Every district has at least three openings that frame one
of these:

| Landmark | Where | Why it pulls |
|---|---|---|
| **Le Mât** | Centre of La Nef, cale → toits, 50 m | A brass column of pipes with lamp rings every deck; the dôme on top lights up when activated |
| **Les lanternes des dômes** | Top of each dôme hull | Dim blue before activation, warm gold after; seen through the Hauts tubes and the high windows |
| **La Grande Vitre** | Aft wall of the refectory | The brightest cool light in the ship; seen down the coursive and from the Nef's south gangways |
| **La lueur des Serres** | Starboard | Green-gold light spilling through the gangways toward the Nef |
| **Le Dôme de Proue** | Forward, highest point | Seen through every forward-facing high window; unreachable until act 3 (the stair is flooded) |
| **Le Puits** | Under the Nef | Warm orange glow and steam rising through the Nef's floor gratings |

Small triangles at walking scale: crate stacks, hanging laundry, a bend in a gangway, the belly of a hull
crossing a street overhead. You turn a corner and something new is framed. The player should almost
never see the whole route to a goal from where they stand.

### 2.6 Vista spots

Each is a registered debug pose too (§10).

| Pose / place | What you see |
|---|---|
| `grande-vitre` (refectory bench, 07:30) | Long tables, backs of the crowd, the 24 × 9 m window on the open sea behind the Drift: shafts, the wake, fish, the whale some days, the ceiling through the glass canopy at the top |
| `nef-haut` (top gangway of La Nef) | Dozens of hulls stacked around the atrium, gangways at every height, the Mât's lamp rings, laundry, warm light haze, zip lines falling away |
| `marche-horloge` (market clock gallery) | Three tiers of stalls under bunting, a river of people, round portholes of sea light along the roof |
| `serre-cathedrale` | Kelp rising under a glass roof, outside kelp and fish beyond it, green-gold light |
| `tube-haut` (glass tube over the roofs) | The whole Drift's roofs and domes stretching away, the ceiling above with Snell's window |
| `puits` (looking down the engine well) | 30 m drop, pistons, steam, orange lamps, ladders and nets |
| `dome-machines` (bubble under the keel) | The sea floor passing far below, the Drift's keels lined up overhead |
| `dome-proue` (act 3) | The white rising ahead, the ceiling close, rain rings |

### 2.7 The sea outside (backdrop)

The sea is real but **not walkable**. It is what the Drift passes, seen through glass:

- The **route** (`DRIFT_ROUTE`, world frame) and the seabed **regions** (Prairie, Laminaires, Pilier,
  Cheminée, Cimetière des Coques, Le Blanc) stay: they are the scenery that changes outside the windows
  over the acts, and the content of the chart's sea side.
- Seabed is 30-60 m below the keel (rendered as low-poly terrain at LOD, no colliders except around the
  sortie hull, §2.8). Kelp, fish schools, the whale, the turtle, jellyfish, La Chose, the light shafts,
  the ceiling (Snell's window, rain rings) are all visible through glass.
- The backdrop exists only where a window can see it: it is drawn when at least one glass portal is in
  the visible set (§4.9).

### 2.8 The sortie (the only time outside)

- Leave by any **unlocked lock** (`sas` first; each district has one, opened by its dôme). The lock
  sequence runs (6 s, in-engine, §2.10).
- Ilo is **tethered**: the **longe** (rope + air hose) is clipped to a ring at the lock. Length 35 m.
  Rings every ~25 m along the hull: E at a ring re-clips (the rope now runs from there), so a long tour
  is ring-to-ring. The longe also brings air: no drowning; endurance is spent only by sprint-swimming
  and scrubbing hard.
- **Swim only**: 3D swimming along the hull plating, grab rails and ribs (climb = hand over hand on
  the hull). No walking outside, no sinking to the floor: the lest is gone. When the longe is taut Ilo is
  held at its length; a hard pull reels him 3 m back.
- Below the keel the light falls off and a gentle downward current is cancelled by the tether: the
  seabed stays out of reach by construction (rope length < keel-to-floor distance at every route point).
- Goal: scrub a **round** (`tournée`) of windows chosen at the lock's forecast board (5-20 windows).
  Windows show their coat (§0.1.8); scrubbing is the F minigame. People inside react at their window.
- **Back**: any lock you have unlocked, or « Rentrer » (hold E): the longe reels Ilo back to his clip.
- Act 1 has three sorties (big window, grandfather's window, tutorial) and act 3 the last one (§3).

### 2.9 The Drift moves

The Drift follows `DRIFT_ROUTE` at **0.5 m/s**, heading = route tangent, gated by story (§3).

| Waypoint | (x, z) world | Gate |
|---|---|---|
| `start` | (80, 520) | Act 1 start (Prairie outside) |
| `halte-prairie` | (300, 450) | Holds here (fishing) until act 2 |
| `virage-nord` | (450, 250) | Act 2: turns north |
| `halte-coques` | (300, −450) | Waits until ≥ 3 dômes activated |
| `bord-du-blanc` | (100, −640) | Act 3: the floor rises, too shallow to go on. Final stop |

Inside, the motion is felt not seen: sway ±0.5° roll / ±0.3° pitch (**visual only**: render group and
camera), creaks every 8-20 s, a groan on turns, lamps and pots swinging. Gameplay gravity tilt (gîte,
§0.1.4) is separate and comes from weather and ballast: implemented as a **rotated gravity vector** for
the hero and props, never by rotating colliders (the KCC jitters on moving slopes).

### 2.10 The lock (sas) sequence

In-engine, 6 s, input locked, camera free. In: the outer hatch closes, pumps drain, the light goes from
cold blue to amber one bulb at a time, Ilo lands on his feet (`land-dry`), shakes off, the scarf goes
from floating to hanging, the inner hatch opens; he drips and leaves wet footprints that dry (wetness
1 → 0 over 120 real s). Out: the reverse, then the longe is clipped. First pass full length, later ×3
by holding E.

---

## 3. Story and quests

The day loop of the story, inside: wake in the cabin, read the forecast in the lock, a sortie to clean
windows, breakfast in front of the big window (served last, still dripping), the kids on the sill,
grandfather's window last, La Chose twice a day through whatever glass you are near.

Characters: **Ilo** (unnamed in dialogue: « toi », « petit »), **Grand-père** (keeps the chart),
**le Cuistot**, **Mme Rouille** (gardienne de l'écluse, forecast board), **les enfants du rebord**
(Mila, Tao, Pépin), **Bastien** (engineer, Le Puits), **Nour** (gardener, Les Serres), **La Chose**
(the bird; nobody has the word « oiseau »).

### Act 1 — La Vitre (Le Quartier de l'Écluse = the Great Plateau)

Day 1, 06:00. Bounded: the quarter's gangways to the rest of the Drift are closed (the Nef gangway is
under repair, the market door is shut for the morning); its dôme and the zip line are the exit.

1. `a1-reveil` Wake in `cabine` (walk, doors, a ladder). Coursive to `sas`. Board: « Visibilité 30 m.
   Courant du sud. Risque de méduses. » Mme Rouille: « Tu commences toujours par la grande. »
2. `a1-sortie` First sortie: the longe, the ring, swim along the hull (teaches swim, climb on the hull,
   re-clip, endurance). « Quatre minutes de trajet : une écluse, une corde, et de temps en temps une baleine. »
3. `a1-grande-vitre` Scrub the big window from outside. Behind it, the whole Drift eats breakfast facing
   you. A turtle swims by: « Une tortue ! Une première ! »
4. `a1-chose` 07:00, during the sortie: La Chose falls through the ceiling near the stern, takes a fish,
   goes back up. The only time you see it from outside, far.
5. `a1-petit-dejeuner` In through the sas, dripping footprints to `refectoire`, `cuisine`: the Cuistot
   (cooking tutorial): « Du poisson, du poisson, et quelque chose que le Cuistot appelle du pain. » You
   get yours last. « Tu gouttes partout. » Sit facing the window you cleaned: the coat you missed shows.
6. `a1-rebord` The clapping game on the sill (rhythm minigame): « Pluie, pluie, va-t'en… » « C'est quoi,
   une pluie ? » « Un poisson. »
7. `a1-dome` Climb the tutorial dôme (`dome-ecluse`: ladders, a cargo net, pipes, shelves; endurance
   management). At the top, wipe the inner glass, align the lunette: the quarter appears on the plan, and
   through the dome you see the Nef's high windows and, far forward, the Dôme de Proue. Vista.
8. `a1-grand-pere` Grandfather's window last: a long sortie forward along the flank, ring to ring, to
   the prow; the Drift seen from outside at scale, the only time (§5.6 must make that shot sing). He
   watches you scrub, taps the glass, points up: « Monte. »
9. `a1-poulie` Mme Rouille: « Il m'a dit de te donner ça. » **La poulie.** The zip line from the dôme's
   gallery across La Nef is the only way out of the quarter (Great Plateau exit). Land on the Nef's north
   gangway, find your way up to La Proue, `salle-des-cartes`: lean over the chart. The groove the pen
   has worn, every current, every depth, and the white. « Cette année, la nourriture est partie au nord.
   Vers le blanc. » → act 2.

### Act 2 — Le Nord (open world, the whole Drift)

The Drift turns north. All districts open. Visibility climbs: 60 m, 90 m, « beaucoup ». The coat grows
back faster; the light through every window changes (cooler, brighter, then a whiter blue).

- `a2-domes` Activate **any 3** of the 6 remaining dômes (any order). Each: a district on the plan, its
  lock unlocked for sorties, its tube station unlocked, a vista. After each, grandfather at the chart
  table has a line (optional; the plan updates anyway).
- `a2-tournees` The daily rhythm: forecast, a sortie (now from any lock), breakfast, errands. Residents'
  lines change as the Drift goes north; the market gets thinner (« Plus de moules depuis mardi »); Nour
  says the kelp grows toward the north windows.
- `a2-chose` Each La Chose dive happens closer, always seen through glass from wherever Ilo is: the
  serres roof, a Nef high window, the tube over the roofs. The kids start a drawing on the sill.
- `a2-lest` At `halte-coques`, once 3 dômes are done, Bastien empties the ballast: the whole Drift
  **rises** (DRIFT_Y 55 → 80 over the next leg). Through every window the ceiling comes closer.
- Exit: the Drift reaches `bord-du-blanc` → act 3 starts the next morning (the third morning by the white).

### Act 3 — Le Blanc

1. `a3-matin` Third morning, breakfast at the Grande Vitre. La Chose comes close: arms too wide, made of
   something layered like a book, an eye turned toward you, holding the fish like grandfather holds a
   pen. The whole refectory stands up. It goes up through the ceiling, leaving rings.
2. `a3-pluie` Then hundreds of rings with no fish under them, over the big window's glass canopy; a soft
   sound through the glass and the hull. The `rain` cue. The Dôme de Proue stair is no longer flooded
   (Bastien's ballast drained it). Run to La Proue (the whole Drift is at the windows; the tubes are
   jammed with people; climb, zip, slide).
3. `a3-grand-pere` In `salle-des-cartes`: grandfather, hand flat on his window, mouths the word from the
   clapping game. Ahead, the floor rises, pale and ridged: the white on the chart. He looks at you, at
   the pen, at the white. He gives you **le stylo**.
4. `a3-dome-proue` Climb into the Dôme de Proue (the last climb). Its glass is furred: the last
   **sortie**, through the dome's top hatch, tethered, in the rain rings: scrub the dome from outside.
   Grandfather's hand is flat on the glass from inside; you put yours on the other side.
5. `a3-ligne` Back in, at the lunette: measure the white. The chart opens; you draw the first line in
   the white. Fade to paper. Credits. Post-game: free roam, rain some mornings, the Drift waiting at the
   edge of the white.

### No soft-locks (hard rules)

- Every required objective is reachable with base endurance (1.0 wheel) and base items.
- The poulie is given before the act 1 exit; the wagonnet and the toile are never required.
- « Retour à la cabine » is always in the pause menu; tube stations once unlocked always work.
- Quest state is derived from flags and is idempotent; key items (frottoir, poulie, longe, stylo,
  lanterne) cannot be dropped, eaten or sold.
- No door can lock Ilo inside a cell; a lock always works both ways. Stuck (controller blocked > 3 s) or
  below a floor → snap to the cell's spawn. A fall into an atrium lands on nets or in the Puits basin.
- Out of endurance never kills: you let go, fall (≤ 6 m to a net or floor), recover.
- Sortie: the longe makes « Rentrer » always possible.
- `setAct(n)` produces a consistent state (grants earlier acts' items, flags, dômes needed, DRIFT_Y).

### Side content

- **Les tournées**: daily window rounds from each lock; coat regrows (faster north); rewards:
  ingredients, gossip, and people waving from the inside.
- **Coques scellées** (12): one rule each (§3.1). Nacres → endurance.
- **Trouvailles** (60): fallen from the ceiling, found around the ship. Each with a micro-challenge
  (inside a pipe, on a lamp you reach by zip line, in a fish tank, behind a pressurised hatch, in a
  flooded cell, a few on the hull outside during sorties). Kids rename them: « Un parapluie. Mila dit que
  c'est un poisson qui a mal tourné. »
- **Cuisine**: free combinations at the galley and réchauds.
- **Petites demandes** (12 residents): deliver, find, fix a valve, scrub a special window.
- **Le carnet de hublot**: fish species seen through glass, for grandfather's margins (bestiary).
- **Courses**: tube and zip-line time trials posted on district boards.
- **Les Serres**: help Nour move lamps and channels to grow kelp (light + water rules).
- **Le jeu de mains**: harder verses unlocked by trouvailles.
- **Le marché**: trade ingredients; show trouvailles to collectors for gossip and recipe hints.
- **Dormir**: your bunk or any district hammock: « Dormir jusqu'à l'aube / midi / au soir ».

### 3.1 Coques scellées

| Id | District | Rule |
|---|---|---|
| `cs-01` | ecluse | Drain a cell with a hand pump to reach a hatch |
| `cs-02` | marche | Counterweight lift: fill a sack with fish |
| `cs-03` | serres | Light: move lamps so the photocell valve opens |
| `cs-04` | serres | Water channels: route flow to float a raft |
| `cs-05` | nef | Ballast tilts a gangway; roll a barrel down to a pressure plate |
| `cs-06` | machines | Steam updraft + toile across a gap |
| `cs-07` | machines | Pressure: close hatches in order, blast a stuck door open |
| `cs-08` | ateliers | Rope and pulleys: lift a cage with three counterweights |
| `cs-09` | ateliers | Bubble column in a flooded well |
| `cs-10` | scellees | Diving bell: trapped bubble lifts a heavy grate |
| `cs-11` | scellees | Flood and drain two linked cells to float a crate to a ledge |
| `cs-12` | scellees | The ship's heel (weather) + ballast: everything rolls |

### Items (`ItemId`)

Key: `frottoir`, `longe`, `poulie`, `toile`, `stylo`, `lanterne`.
Ingredients: `poisson`, `algue-rouge`, `algue-doree`, `oursin`, `moule`, `crevette`, `sel-de-machine`,
`plancton`, `mie-du-cuistot`.
Dishes: `soupe-chaude` (+regen 50 % 3 min), `galette-de-plancton` (refill), `brochette` (sprint −30 %
cost 3 min), `pain-du-cuistot` (refill + temporary +0.2 wheel), `rate` (« Plat raté »: tiny refill).
Other: `nacre`, `trouvaille:<id>` (`tr-01`…`tr-60`).
Cooking: 1-5 ingredients → dish by priority table in `gameplay/cooking.ts`; unknown → `rate`.

---

## 4. Architecture

### 4.1 Folders and ownership

Exactly one owner per folder. **Never edit another folder.** Cross-folder access only through:
(a) `import type` from `src/core/types.ts`, (b) runtime calls through `ctx.services.*`, (c) data from
`src/core/layout.ts` and `src/core/tuning.ts`, (d) events on `ctx.bus`.

```
index.html, package.json, cfg  core
src/main.ts, src/core/         engine, loop, input, physics (incl. gravity vector), bus, state, save,
                               quality, debug, layout (districts, decks, route, dôme/shrine ids), tuning, types
src/drift/                     THE WHOLE SHIP INTERIOR WORLD: district/cell/portal graph, hand-authored and
                               generated cells (kits), hull shells (both faces), windows + coat state,
                               doors/hatches/locks, ladders/nets/pipes/zip lines/tubes/toboggans as objects
                               with anchors, lamps, props, colliders, sway/creak, ballast and water planes
                               of cells, NPC bodies + hourly schedules + crowds, portal culling and
                               district streaming, the far-hull LOD seen in atriums
src/hero/                      Ilo: model, skeleton, animations, scarf (verlet, physics), indoor locomotion
                               (walk/run/jump, gravity vector, stairs, climb anything, ladders, zip, tube,
                               slide, sit, lean, sleep), tethered swim and the longe rope sim, cameras,
                               wetness, drips, footprints
src/world/                     THE SEA BACKDROP seen through glass (seabed terrain at LOD along the route,
                               regions, rocks, the far landmarks, the current field) + THE SORTIE SPACE
                               outside the hull (exterior collision proxies of hull shells near open locks,
                               tether rings, swim volume limits)
src/flora/                     Kelp and grass outside (backdrop, instanced, sway) + Les Serres inside
                               (greenhouse kelp beds, potted plants, growth driven by light/water state)
src/render/                    Renderer, cel materials (indoor variant with the lamp term), interior lighting,
                               glass (windows, domes, tubes: refraction tint, coat, condensation), sea haze
                               (water only) and air haze (atriums), shafts through glass, ceiling, sun cycle,
                               post, grading
src/fauna/                     Fish, jellyfish, whale, turtle, La Chose (all outside, framed by windows);
                               indoor cats are drift props
src/gameplay/                  Endurance, climb costs, dômes, coques scellées puzzles' rules, trouvailles,
                               cooking, inventory, quests, dialogue, weather/forecast, sorties (rounds,
                               scrub), chart (sea + plan), HUD, menus, indoor interactions
src/audio/                     Music cues, ambience (hull, crowds, engines, muffled sea), sfx
docs/BIBLE.md                  this file
```

Each folder exposes `src/<folder>/index.ts` exporting `create<Folder>System(): System`.

Shared concerns (one owner each, never two):

| Concern | Owner | Contract |
|---|---|---|
| Cells, props, colliders, climbable/ladder/zip/tube anchors, doors, locks, water planes, NPCs | `drift` | `DriftService` (§4.7), collider tags (§4.3) |
| How Ilo moves and is filmed, the longe rope, footprints | `hero` | reads `drift.*` anchors, `world.sortieBounds`, `physics.gravity` |
| When something is interactable and what it does | `gameplay` | emits `interact`, calls `drift.openDoor/cycleLock/setValve`, `hero.*` |
| Shading, glass, haze, lamps uniform | `render` | `cel({ indoor })`, `glass(...)`, `uIndoor`, `uLamps` |
| What the sea looks like through a window | `world` + `flora` + `fauna` | only drawn when `render.seaVisible()` |
| Sound | `audio` | reads `state.hero.medium`, `state.hero.cell`, listens to events |

### 4.2 Core types (`src/core/types.ts`)

Kept from v1 (`System`, `GameContext`, `Services`, `Vec3`, `Act`, `QualityLevel`, `DayPhase`) with:

```ts
export type SystemId = 'render' | 'world' | 'flora' | 'drift' | 'fauna' | 'hero' | 'gameplay' | 'audio'
export type DistrictId = 'ecluse' | 'marche' | 'serres' | 'nef' | 'machines' | 'ateliers' | 'scellees' | 'hauts' | 'proue'
export type DeckId = 'cale' | 'machines' | 'bas' | 'principal' | 'haut' | 'toits' | 'domes'
export type CellId = string                     // v1 RoomId values stay valid CellIds
export type DomeId = 'dome-ecluse' | 'dome-marche' | 'dome-serres' | 'dome-nef' | 'dome-machines' | 'dome-ateliers' | 'dome-scellees'
export type LockId = `sas-${DistrictId}` | 'dome-proue'   // 'sas-ecluse' is v1's 'sas'
export type RegionId = 'prairie' | 'laminaires' | 'pilier' | 'cheminee' | 'coques' | 'blanc' | 'bleu'  // backdrop only
export type HeroMode =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'climb' | 'ladder' | 'zip' | 'tube' | 'slide'
  | 'sit' | 'lean' | 'sleep' | 'scrub' | 'exhausted' | 'lock' | 'swim' | 'cutscene'
export type Medium = 'water' | 'air'
```

`swim` exists in two places only: a sortie, and a flooded cell inside a coque scellée.
**Every consumer must tolerate a missing service** (`ctx.services.drift?.cellAt(p) ?? null`).

### 4.3 Physics

```ts
export type ColliderKind =
  | 'floor' | 'wall' | 'stair' | 'ladder' | 'net' | 'pipe' | 'rib' | 'shelf' | 'door' | 'seat' | 'glass'
  | 'prop' | 'hull-outside' | 'trigger' | 'fauna'
export interface ColliderTag { kind: ColliderKind; climbable: boolean; ownerId?: string; cell?: CellId }
export interface PhysicsWorld {
  /* v1 members unchanged: rapier, world, tag, untag, tagOf, raycast, groups */
  gravity: { x: number; y: number; z: number }  // in L; tilted by gîte, written by gameplay via core
}
```

- Fixed step 1/60 with accumulator (max 4). Rapier world gravity stays zero; controllers apply
  `physics.gravity` themselves (hero, rolling props) so tilt is one vector, not rotated colliders.
- Each **district** is one kinematic rigid body moved from the Drift pose
  (`setNextKinematicTranslation/Rotation`, never the visual sway); colliders are cuboids/convex
  (trimesh floors snag the KCC on internal edges). Only loaded districts have colliders (§4.9).
- `climbable` is true for everything except `glass`, `door` and wet surfaces (gameplay marks
  condensation zones; the hero reads `climbable && !wet`).
- Always `untag` a removed collider (handles are reused). Open door = collider removed + untagged.

### 4.4 Input

v1 `Input` unchanged (physical `KeyboardEvent.code`, labels from `getLayoutMap`). Actions:
`up` (jump / grab / climb over), `down` (let go / crouch / descend), `sprint`, `interact`, `scrub`,
`map`, `inventory`, `pause`, `recenter`, `whistle` (renamed meaning: call the wagonnet).

### 4.5 Events

v1 events kept unless listed. Added / renamed:

```ts
'cell:entered': { cellId: CellId; district: DistrictId; deck: DeckId }   // replaces room:entered
'cell:left': { cellId: CellId }
'district:entered': { district: DistrictId }       // drives the place-name toast and streaming
'dome:activated': { domeId: DomeId; district: DistrictId }               // replaces sonde:activated
'scellee:entered' | 'scellee:completed': { id: string }                  // replace shallow:*
'lock:cycle': { lockId: LockId; dir: 'in' | 'out'; phase: 'close' | 'pump' | 'open' | 'done' }
'sortie:start': { lockId: LockId; round: string[] }
'sortie:end': { scrubbed: number }
'tether:clip': { ringId: string } ; 'tether:taut': {}
'zip:start' | 'zip:end': { lineId: string } ; 'tube:travel': { from: string; to: string }
'valve:changed': { id: string; open: boolean } ; 'water:level': { cellId: CellId; level: number }
'gite:changed': { roll: number; pitch: number }    // radians, gameplay tilt (not sway)
'drift:altitude': { y: number }
```

`interact.kind` adds `'zip' | 'tube' | 'valve' | 'pump' | 'lever' | 'ring' | 'lunette' | 'hammock'`.

### 4.6 State (saved)

v1 `GameState` with:

```ts
hero: {
  local: Vec3; velocity: Vec3; yaw: number; mode: HeroMode     // local frame is the truth; world is derived
  endurance: number; enduranceMax: number; exhausted: boolean
  medium: Medium; cell: CellId | null; district: DistrictId; wetness: number
  sortie: { lockId: LockId; ring: string; round: string[] } | null
  lastSafe: { cell: CellId; local: Vec3 }
}
drift: { progress: number; position: Vec3; heading: number; velocity: Vec3; gate: string; altitude: number
         doors: Record<string, boolean>; valves: Record<string, boolean>; water: Record<CellId, number> }
chart: { domes: DomeId[]; reperes: string[]; pins: { x: number; z: number; icon: string }[] }
scellees: string[]; trouvailles: string[]; tubes: string[]           // unlocked tube stations
windows: Record<string, number>   // sparse: windowId -> game-hour of last scrub; absent = seeded old value
env: { current: Vec3; visibility: number; bloom: number; jellyfish: number; rain: number; gite: { roll: number; pitch: number } }
```

Writers: `time`, `debug`, `settings.quality` → core. `env`, `act`, `quests`, `flags`, `chart`, `inventory`,
`scellees`, `trouvailles`, `tubes`, `hero.endurance*`/`exhausted`/`sortie` → gameplay. `hero` rest → hero.
`drift`, `windows` → drift. Everybody reads everything.
Save: `localStorage` key **`le-drift:save:v2`** (v1 saves are discarded with a toast, not migrated), every
access in try/catch. Autosave every 60 s real and on `sleep:done`, `dome:activated`, `scellee:completed`,
`act:changed`, `quest:step`, `sortie:end`. Load places Ilo from `hero.local` + `hero.cell`.

### 4.7 Services

```ts
export interface DriftService {
  pose(): { position: Vec3; heading: number; velocity: Vec3; altitude: number }
  toLocal(p: Vec3): Vec3; toWorld(p: Vec3): Vec3
  cellAt(local: Vec3): CellId | null
  districtAt(local: Vec3): DistrictId
  mediumAt(local: Vec3): Medium               // 'water' outside or under a cell's water plane
  cellSpawn(cell: CellId): { local: Vec3; yaw: number }
  ceilingAt(local: Vec3): number | null       // for the camera
  anchorsNear(local: Vec3, r: number): Anchor[]   // ladders, zip ends, tube stations, seats, rings, lunettes
  nearestWindow(p: Vec3, maxDist: number, face: 'in' | 'out'): { id: string; coat: number; local: Vec3; normal: Vec3 } | null
  scrub(windowId: string, amount: number): number
  openDoor(id: string, open: boolean): void
  setValve(id: string, open: boolean): void
  cycleLock(id: LockId, dir: 'in' | 'out'): Promise<void>
  npcPosition(npcId: string): Vec3 | null
  playScene(id: 'petit-dejeuner' | 'rebord' | 'grand-pere-pluie' | 'chose-vitre' | 'refectoire-debout'): Promise<void>
  visibleCells(): readonly CellId[]           // portal result, read by render/audio
  glassPortalsVisible(): number               // > 0 means the sea backdrop must draw
}
export type Anchor =
  | { kind: 'ladder'; id: string; bottom: Vec3; top: Vec3; normal: Vec3 }
  | { kind: 'zip'; id: string; from: Vec3; to: Vec3 }
  | { kind: 'tube'; id: string; at: Vec3; station: string }
  | { kind: 'slide'; id: string; path: Vec3[] }
  | { kind: 'seat' | 'bed' | 'hammock' | 'lunette' | 'chart-table'; id: string; at: Vec3; yaw: number }
  | { kind: 'ring'; id: string; at: Vec3 }    // outside, sortie
export interface WorldService {                // backdrop + sortie
  heightAt(x: number, z: number): number       // world frame, pure (backdrop)
  regionAt(x: number, z: number): RegionId
  currentAt(p: Vec3): Vec3
  sortieBounds(lockId: LockId): { ringsLocal: Vec3[]; tetherMax: number }
}
export interface FloraService { greenhouseGrowth(cell: CellId): number; flatten(p: Vec3, r: number): void }
export interface RenderService {
  /* v1: cel, patchWater, uniforms, addRipple, draw, sunPhase, stats */
  glass(params: { coat?: boolean; tint?: number; condensation?: boolean; dome?: boolean }): THREE.Material
  readonly uniforms: { /* v1 + */ uGravity: { value: THREE.Vector3 }; uAirHaze: { value: number } }
}
export interface HeroService {
  teleportLocal(p: Vec3, yaw?: number): void; setMode(m: HeroMode): void
  setCameraPose(p: CameraPose | null): void; headPosition(): Vec3
  sit(id: string): void; lean(target: Vec3): void; stand(): void
}
export interface GameplayService {
  endurance: { spend(c: number): boolean; drain(rate: number, dt: number): boolean; canAct(): boolean }
  setAct(a: Act): void; giveItem(id: string, n?: number): void; hasItem(id: string): boolean
  setWeather(env: Partial<EnvState>): void; sleepUntil(hour: number): Promise<void>
  chartCanvas(side: 'mer' | 'plan'): HTMLCanvasElement | null
}
```

`FaunaService` and `AudioService` unchanged from v1.

### 4.8 Loop

Same as v1: render, world, flora, drift, fauna, hero, gameplay, audio; init in that order; per frame
input → time → `update` → physics → `lateUpdate` (camera) → `render.draw`. `dt` clamped to 0.1 s.

### 4.9 Performance: portals, districts, budgets

Targets: **60 fps on an M1/M2 MacBook at `high`**, **30 fps on a mid laptop at `low`**.

**Portal culling** (drift owns, every frame):
1. Find the camera's cell. Visible set = that cell + a portal walk: for each portal of a visible cell,
   clip the portal quad to the current screen rectangle; non-empty → its cell is visible with the
   narrowed rectangle. Max depth 6 (high) / 4 / 3. Closed doors stop the walk.
2. **Atrium cells** (Nef, market, serres, the Hauts tubes) are big: their far walls are **hull LOD
   shells** (instanced exteriors of the hulls ringing them, lit window cards), not their interiors.
3. Glass portals (windows, domes, tubes) do not continue into cells; they mark the sea backdrop
   visible. If none is visible, world/flora/fauna skip drawing entirely.

**District streaming**: the current district and its neighbours are **loaded** (meshes + colliders + NPC
agents); others exist only as the LOD shells used in atriums and the outside view. Load/unload is spread
over frames (≤ 2 ms per frame), triggered on `district:entered` with a 20 m hysteresis.

| | high | medium | low |
|---|---|---|---|
| Draw calls total | ≤ 250 | ≤ 180 | ≤ 120 |
| Triangles | ≤ 1.5 M | ≤ 900 k | ≤ 500 k |
| Pixel ratio cap | 2 | 1.5 | 1 |
| Portal depth | 6 | 4 | 3 |
| Loaded districts | current + all neighbours | current + 2 | current + 1 |
| Drift interior draws | ≤ 140 | ≤ 100 | ≤ 70 |
| Lamps in `uLamps` | 8 | 6 | 4 |
| Animated NPCs (full / crowd impostors) | 60 / 600 | 35 / 300 | 15 / 120 |
| Sea backdrop draws (only if glass visible) | ≤ 40 | ≤ 28 | ≤ 18 |
| Fish | 1500 | 800 | 300 |
| Sun shadow map | outside/sortie only, 2048 | 1024 | none |
| Outline / painterly | yes | outline | none |

Rules: props instanced or merged per cell (one merged static mesh per cell + instanced repeats). No
per-frame allocations in hot loops. Window instances: one `InstancedMesh` per district for outside
faces, coat in an instance attribute. Auto-quality: average frame > 24 ms over 5 s → drop one level
once, toast « Qualité réduite ».

### 4.10 Definition of done per folder

- **core**: types/layout/tuning per this bible; gravity vector; `?cell=` / `?district=` debug params; save v2.
- **drift**: the 9 districts with 400 hulls laid out in streets; portal culling; district streaming; the
  hand-authored cells; generated kits walkable; locks; zip lines, tubes, toboggans, ladders, nets as
  anchors; NPC routines; you can walk from `cabine` to the Nef, the market and La Proue without a loading
  screen.
- **hero**: walk/run/jump/climb-anything/ladder/zip/tube/slide/sit/lean/sleep under `physics.gravity`;
  tethered swim with a simulated longe; scarf verlet that hangs and swings in air, floats in water.
- **world**: backdrop terrain along the route seen correctly through every glass; sortie bounds and rings.
- **flora**: outside kelp/grass through glass; Les Serres beds.
- **render**: indoor shading without sea haze, glass materials, air haze in atriums, sea through glass,
  the two bugs of §5.3 gone (checked with the `refectoire` and `sortie-loin` poses).
- **fauna**: fish, whale, turtle, jellyfish, La Chose framed by the windows at the right hours.
- **gameplay**: the quest line end to end, sorties, dômes, coques scellées, chart (both sides), HUD.
- **audio**: indoor mix by district (market murmur, engine rumble, greenhouse drip), muffled sea, rain.

---

## 5. Art bible

### 5.1 Palette

v1 palette kept (sea: `abysse` `#0E3B52`, `profond` `#1B5E73`, `milieu` `#3A8C98`, `clair` `#7CC6BF`,
`plafond` `#CFEFE3`; sun `soleil-aube/jour/soir`; `nuit`; `bio-1/2`; seabed and kelp tokens; hulls
`coque-rouille` `#C46A4A`, `coque-laiton` `#D9B48F`, `coque-teal` `#4F6D7A`; `vitre-lumiere` `#FFD9A0`;
`revetement` `#6F8F4E`; hero `echarpe` `#E8674A`, `tunique` `#2F4E7A`, `peau` `#C98E6B`; HUD tokens;
interior `lampe` `#FFC27A`, `lampe-chaude` `#FF9E5E`, `bois` `#B07A4F`, `bois-ombre` `#5E4A5C`,
`tissu-1/2/3`, `toile-carte` `#EFE3C4`, `interieur-ombre` `#3E3A5A`). Added:

| Token | Hex | Use |
|---|---|---|
| `creme` / `platre` | `#F1E4C8` / `#E6D8BE` | Interior walls: must read cream on screen, never orange |
| `air-brume` | `#E9DCC2` | Air haze in atriums (warm off-white) |
| `vitre-mer` | `#9FD6D0` | Glass tint seen from inside |
| `serre` | `#B9D98A` | Greenhouse light |
| `machine` / `machine-ombre` | `#E08A4E` / `#4A3A4E` | Engine lamps (light colour, not a fog) |
| District accents | marche `#D8644E`, serres `#8FBF6A`, nef `#D9B48F`, machines `#C46A4A`, ateliers `#6E8FB0`, scellees `#4F6D7A`, proue `#EFE3C4` | Bunting, doors, signage; helps orientation |

### 5.2 Lighting indoors

- **Cel ramp** as v1 (3 soft bands, shadows go plum/violet, never grey). Indoors the key light is the
  **nearest lamps** (`uLamps`, cel-stepped falloff); the sun term is replaced by **sea light through
  glass**: each window/porthole adds a cool `vitre-mer` cone (additive, one draw per cell) and, when the
  sun is high, a moving shaft with caustics on the floor patch it hits.
- Hemisphere ambient indoors: top `creme` × 0.35, bottom `bois-ombre` × 0.25. Every room reads
  **warm inside / cool at the glass**.
- Baked AO in vertex colours (corners, under tables). No lamp shadow maps.
- Dust motes in lamp light, steam in the kitchen and the Puits, slight bloom on lamps.
- Clutter everywhere: nets, jars, laundry, drawings, patched cushions, cups. Nothing new, all repaired.

### 5.3 Haze: two kinds, and the two known bugs

**Sea haze is water between the eye and the thing. Air haze is dust in a big room.** Never mix them.

- **Interior surfaces get zero sea haze.** `cel({ indoor: true })` must skip `rd_applyHaze` (v1 applies it:
  bug #1, together with the warm highlight grading, it turns interiors into orange mush).
- **Sea seen through glass** gets sea haze over the **water distance only**: `max(0, d − dGlass)` where
  `dGlass` is the camera-to-glass distance (render writes it per glass portal; approximate with
  `uIndoorAirDist` = distance to the nearest visible glass when indoors).
- **Air haze** (`uAirHaze`, 0 in small rooms, up to 1 in atriums, set by drift per cell):
  `hz = (1 − exp(−d / 140)) × 0.45 × uAirHaze`, colour `air-brume` tinted 20 % by the nearest lamp
  colour. That is the Nef's depth staircase: near full colour, far hulls soft cream.
- **Grading indoors**: highlight warm tone ≤ 0.08 (v1 uses up to 0.38 with `uWarm`); the vignette mixes
  toward `interieur-ombre`, never `profond`. Acceptance: in pose `refectoire`, a `creme` wall in lamp
  light measures within ΔE 10 of `#F1E4C8` on screen, and the Grande Vitre reads blue-green.
- **Bug #2: the Drift seen from far looks like a pile of rocks.** Causes: random hull positions/sizes/
  yaw, one rusty colour, haze flattening them into one blob. Rules for every outside view (sortie,
  dômes, glass tubes): §5.6.

Sea haze formula and visibility mapping unchanged from v1 (`uHazeDist` 30 m → 170, 60 m → 280,
90 m → 400, « beaucoup » → 620; `uHazeMax` 0.93).

### 5.4 Glass

One `render.glass()` family: windows, portholes, the Grande Vitre, domes, tubes. Slight `vitre-mer`
tint, fresnel edge highlight, brass frame from drift. Coat (outside face) as a furry green mask that
dims what is behind it; condensation (inside face, cold north) as a soft fog mask that a hand wipe
(E) clears for 2 game hours. Rain rings and the ceiling are seen through the top glass of domes, tubes
and the Grande Vitre's canopy.

### 5.5 Reference shots

- **`refectoire` (title screen)**: 07:30, day 1, from the back of the refectory at eye height: long
  tables, the crowd's backs, lamps, steam from bowls; the Grande Vitre fills the far wall: sea light,
  shafts, a turtle crossing; the kids silhouetted on the sill. Warm foreground, cool window.
- **`nef-haut`**: noon, top gangway, looking down and across the Nef: the Mât's lamp rings, 30+ hulls,
  gangways at every height, a zip line in the foreground, air haze making three depth layers.
- **`sortie-loin`**: outside at the end of the longe, 30 m off the flank: the Drift as a readable city
  (§5.6), lit window rows, the dômes glowing, Ilo small, scarf floating.
- Others: `grande-vitre`, `marche-horloge`, `serre-cathedrale`, `tube-haut`, `puits`, `dome-machines`,
  `dome-proue`, `cabine`, `salle-des-cartes`, `heros`.

### 5.6 The Drift's silhouette (from outside and through glass)

- **Streets, not a heap**: hulls aligned along z in rows per district (yaw jitter ≤ 3°), sizes from a
  few standard classes per kit (keel 18/24/32 m, barrel 10/14 m), stacked in clear tiers per deck.
- **Lines that read**: gangway tubes between hulls in straight runs, cables, the keel rail, rows of
  identical lit windows (rhythm), masts and periscopes, the dômes on top glowing.
- **Colour by district** (§5.1 accents on the paint), rust only as wear on keels and seams.
- Rim light and cel outline on the outside hull shells; outside haze capped so the far end of the
  Drift (260 m) stays a flat but readable silhouette.
- Each hull: rounded keel or barrel, brass portholes, rivet lines, a lamp at each lock, ropes and
  ladders on the outside, coat fur on the windows that nobody has cleaned.

### 5.7 Ilo and the others

- Ilo (~16, 1.65 m, head 1/6), dark hair in a knot, goggles on the forehead, sleeveless indigo tunic over
  a wetsuit, soft boots, the frottoir on his back, the poulie on his belt once owned.
- **Scarf**: coral, 1.6 m, verlet chain of 12 points with collision against the body capsules. In air:
  gravity, swings with every turn, stop and stair step, trails behind in a zip line and a tube; heavy and
  dark while `wetness > 0.5`. In water: buoyant, follows `currentAt` and velocity. **Never a rigid stick.**
- Animations: `idle`, `walk`, `run`, `jump`, `fall`, `land`, `roll`, `stairs-up/down`, `climb` (hand over
  hand), `climb-idle`, `climb-jump`, `ladder`, `ladder-top`, `zip` (one hand on the poulie, legs swinging),
  `tube-in/out`, `slide`, `sit-down`/`sit`/`eat`/`stand-up`, `lean`, `lie-down`/`sleep`/`wake`,
  `open-hatch`, `turn-valve`, `pump`, `shake-off`, `swim`, `swim-sprint`, `scrub`, `clip-ring`,
  `exhausted`, `talk`, `hand-on-glass` (finale).
- La Chose: wings far too wide, layered "like a book", one eye; always behind glass.
- NPCs: chunky, warm clothes, varied silhouettes by role (cooks, engineers in overalls, gardeners with
  hats, kids); crowds as impostors beyond 25 m.

---

## 6. Controls and tuning

| Action | Clavier + souris | Manette |
|---|---|---|
| Se déplacer | ZQSD / WASD (same physical keys) | Stick gauche |
| Caméra | Souris (pointer lock on click) | Stick droit |
| Sauter / s'agripper / monter | Espace | A |
| Lâcher / s'accroupir / descendre | C | B |
| Courir | Maj | LT |
| Interagir / parler / tyrolienne / tube | E | X |
| Frotter | F | Y |
| Appeler le wagonnet | R | Croix bas |
| Carte | M | Select |
| Inventaire | Tab | RB |
| Recentrer la caméra | clic milieu | R3 |
| Pause | Échap | Start |

| Indoors | Value |
|---|---|
| Walk / run / sprint | 1.6 / 3.8 / 5.5 m/s (sprint 0.10/s) |
| Gravity | `physics.gravity`, 9.81 m/s², tilted by gîte |
| Jump | 0.9 m |
| Step (autostep) / max slope | 0.35 m / 40° |
| Climb | 1.2 m/s, 0.08/s moving, 0.02/s hanging; climb jump 1.8 m for 0.18 |
| Ladder | 1.6 m/s, free (no endurance) |
| Zip line | 9 m/s down the slope, 0.03/s hanging; C lets go |
| Toile (from a zip end or a ledge) | 5 m/s forward, fall 1.2 m/s, 0.04/s; rises in steam |
| Tube pneumatique | 3 s ride, any unlocked station |
| Fall | ≤ 4 m: land; 4-8 m: roll, −0.2; > 8 m: no gap may allow it without a net below |
| Endurance regen | 0.35/s after 0.8 s idle; base 1.0 wheel, +0.2 per 4 nacres |
| Wetness dry-out | 1 → 0 in 120 real s |

| Sortie (outside) | Value |
|---|---|
| Swim / sprint | 3.0 / 5.0 m/s (sprint 0.12/s) |
| Up / down | Espace / C, 2.0 m/s |
| Hull climb | 1.4 m/s, 0.06/s |
| Longe | 35 m, re-clip at rings; taut = held; « Rentrer » (hold E 1 s) reels at 4 m/s |
| Scrub | F held, 0.05/s endurance |

**Camera indoors** (tight-space BotW camera): pivot 1.55 m, distance 3.0 m (min 0.6, then over the
shoulder 0.35 m right), FOV 60, pitch −50°…+60°, sphere cast r 0.25 (pull in instantly, ease out
1.5 m/s), height clamped to `ceilingAt − 0.2`; `fadeable` meshes between camera and Ilo dither to 25 %.
**In atriums** the camera widens to 5 m and FOV 62 so the vista breathes; on a zip line 6 m behind.
**Sortie**: 6 m orbit, FOV 55, collision against the hull proxies.

---

## 7. HUD and UI (French)

By default the screen shows nothing but the world.

- **Roue d'endurance** next to Ilo's head, only while not full.
- **Bas droite** (toggle, default on): small round plan of the current district, time glyph, « Vis. 30 m »,
  a tiny level showing the gîte when > 1°.
- **Invites**: « [E] Ouvrir », « [E] Fermer », « [E] S'asseoir », « [E] Monter », « [E] Prendre la
  tyrolienne », « [E] Tube : Le Grand Marché », « [E] Tourner la vanne », « [E] Pomper », « [E] Accrocher
  la longe », « [E] Sortir par l'écluse », « [E] Rentrer », « [F] Frotter », « [E] Regarder dans la
  lunette », « [E] Se pencher sur la carte », « [E] Dormir ».
- **Nom du lieu** (BotW, centred, 2 s) on entering a district, and on first entering a named cell each day:
  « Le Quartier de l'Écluse », « La Grande Nef », « Le Grand Marché », « Les Serres », « Le Puits des
  Machines », « Les Ateliers », « Les Coques Scellées », « Les Hauts », « La Proue », « Le Réfectoire »,
  « Ta cabine », « La Salle des Cartes ».
- **Toast** on quest step: « Nouvelle tâche : Frotter la grande vitre ».
- **Carte (M)**: two tabs, « La mer » (route, groove, the white, the Drift icon moving) and « Le Drift »
  (plan by deck, blank until a dôme draws it; tube stations; « Retour à la cabine »).
- **Inventaire (Tab)**: « Outils », « Ingrédients », « Plats », « Trouvailles ».
- **Tableau des prévisions** (each lock): « Visibilité 30 m · Courant du sud · Risque de méduses », plus
  « Tournée du jour : 12 vitres ».
- Pause: « Reprendre », « Retour à la cabine », « Réglages », « Commandes ».
- Font: `ui-rounded, "SF Pro Rounded", system-ui, sans-serif`.

All UI and quest strings live in `src/gameplay/text/fr.ts`; ambient chatter in `src/drift/text.ts`.

---

## 8. Day, weather, wonders

- 1 game hour = 60 real s. Start: day 1, 06:00, in the bunk.
- **NPC day** (40 000 people; a district shows its slice):

| Hour | Life |
|---|---|
| 06:00 | Ilo wakes; forecasts posted in every lock |
| 06:15-07:30 | Sorties; corridors fill; the market sets up |
| 07:30-08:30 | Breakfast, the whole Drift facing windows; the refectory full at the Grande Vitre |
| 08:30-12:00 | Kids on the sill; school in the Ateliers; market open; gardeners in the Serres |
| 12:00-17:00 | Work: engines, rope works, errands; grandfather at the chart |
| 17:30 | Second La Chose dive: people gather at the nearest glass |
| 19:00-21:00 | Supper, songs, lamps low |
| 21:00 | Asleep; snoring behind doors; the Puits never sleeps; grandfather awake over the chart |

- **La Chose** dives at 07:00 and 17:30; the dive point is chosen so it is visible from the glass nearest
  Ilo (fauna asks `drift.glassPortalsVisible` / nearest window). Ceiling rings, a fish taken, `wonder` cue.
- **Forecast** at 06:00: visibility by act (30; 60 → 90 → « beaucoup »; « beaucoup »), current
  direction and strength (→ gîte 0-4°), jellyfish (they press on lit glass at night), plankton bloom,
  condensation (north, cold mornings: metal surfaces wet until 10:00).
- Nuit de plancton every 5th night. Whale every ~2 days along the flank or behind the Grande Vitre.
- Rain: act 3 from `a3-pluie`, then post-game 15 % of mornings.

## 9. Music and sound

Generative WebAudio, mostly silence, pentatonic FM phrases (D major / B minor), unlock on first gesture.

| Cue | When |
|---|---|
| `explore` | Sparse phrases while walking, silence between |
| `drift` | Home quarter: warm tune, the clapping game melody |
| `dome` | Stinger at activation, vista swell |
| `scellee` | Inside a coque scellée: minimal, rhythmic |
| `sortie` | Outside: soft pads, bubbles, rope creak |
| `night` / plankton | Celesta and glass |
| `wonder` | La Chose |
| `rain` | Finale: the clapping game, slow and full |

Ambience by district: market murmur and crockery, greenhouse drips and pumps, engine thump and steam
(Puits), rope creak and hammering (Ateliers), echo and drips (Scellées), wind-like hum in the tubes.
The sea is a low-passed rumble through the hull, louder near glass. Footsteps on wood/metal/carpet/
grating, wet then dry. Creaks every 8-20 s, a groan on turns, a long groan when the gîte changes.

## 10. Debug hooks (`window.__game`)

v1 `DebugApi` plus `enterCell(cell)`, `enterDistrict(d)`, `setGite(roll, pitch)`, `setAltitude(y)`,
`startSortie(lockId)`. URL params: `?debug`, `?pose=`, `?act=`, `?t=`, `?q=`, `?nosave`, `?cell=`,
`?district=`. Poses: `refectoire`, `grande-vitre`, `nef-haut`, `marche-horloge`, `serre-cathedrale`,
`tube-haut`, `puits`, `dome-machines`, `dome-proue`, `sortie-loin`, `cabine`, `salle-des-cartes`, `sas`,
`heros`. `screenshotPose` as v1 (cameraLocked, wait 2 frames, read in the render tick).

## 11. Working rules for builders

- Only your folder. `npm run typecheck` must pass before you commit.
- Conventional Commits with the folder as scope (`feat(drift): …`), no AI attribution trailer. Stage only
  your own paths. If `.git/index.lock` exists, wait a few seconds and retry.
- Never leave a dev server, vite or a browser running when you finish (RAM is limited).
- Downloaded assets: CC0 only, one line in `assets/CREDITS.md`.
- When this bible needs a change, say so in your final report; do not silently diverge.

## 12. Migration from v1 code

| v1 | v2 | Owner |
|---|---|---|
| Open seabed play: terrain colliders, sondes, hauts-fonds, camps, voile, manta ride, lanes as traversal | Backdrop only; delete colliders except sortie proxies; sondes → dômes, hauts-fonds → coques scellées, voile → poulie/toile, manta → backdrop fauna | world, gameplay, hero, fauna |
| `lest`, `sink`, `glide`, `ride` hero modes, walking on sand | Removed; outside is tethered swim only | hero |
| 12 walkable rooms + 388 cards | 9 districts, cells + portals, all hulls walkable (kits), cards only as LOD shells | drift |
| `salle-des-cartes` at x 36-44 in the quarter, `passerelle-2` to it | Moves to La Proue (high, forward window); the v1 spot becomes `cellier-du-cuistot` | drift |
| `RoomId`, `room:*`, `roomAt`, `roomSpawn` | `CellId`, `cell:*`, `cellAt`, `cellSpawn` | core, then all |
| `breath*`, « Souffle » | `endurance*`, « Endurance » | core, gameplay, hero |
| Indoor cel applies sea haze; warm grading at full strength indoors | §5.3 | render |
| Random hull placement (`generateHulls`) | Street layout per district (§5.6) | drift |
| Save `le-drift:save:v1` | `le-drift:save:v2`, v1 discarded | core |
| Hull sway visual only | Kept; plus gameplay gîte through `physics.gravity` | core, hero, drift |
