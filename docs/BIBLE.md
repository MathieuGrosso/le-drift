# Le Drift — Bible

Single source of truth for every builder. You work in parallel with other builders and only see
this file plus the code. If the code and this file disagree, this file wins; if this file is
silent, choose the option that keeps the other folders working without you.

Pitch, in the owner's words: **"Zelda Breath of the Wild, mais sous l'eau."**
We reverse-engineer BotW's systems and art direction and transpose them under the sea.
Soft, luminous, painterly, Ghibli-warm. **Never dark murky water.**

Stack: Vite + TypeScript strict + three.js + `@dimforge/rapier3d-compat`. Scripts: `dev`, `build`,
`preview`, `typecheck`. No other runtime dependency. Assets are generated in code; a download is
allowed only if CC0, recorded in `assets/CREDITS.md` (source URL + license).

Player-facing text: **French only**. Code, identifiers, comments: English. Comments rare (traps only).

---

## 0. What BotW does, and what we keep

Sources: GDC 2017 "Breaking Conventions with The Legend of Zelda: Breath of the Wild"
(Fujibayashi, Dohta, Takizawa: multiplicative gameplay, chemistry engine), CEDEC/GDC 2017 level
design talk (Hirano, Yonezu: triangle rule, "gravity", density map), the art direction (Ghibli and
impressionist painting references), and the shipped game.

| BotW principle | What it means | Our rule |
|---|---|---|
| Multiplicative gameplay | A few rules that combine, not many scripted solutions | 10 chemistry rules (§0.1), every puzzle solvable more than one way |
| Chemistry engine | Elements change states of materials; materials react | Current, heat, light, bubbles, coat, sand (§0.1) |
| Climb anything | Every surface is a route, gated by stamina only | Rock, hulls, kelp stalks, coral: all climbable, cost = souffle |
| Great Plateau | Closed tutorial teaching every core verb, exit needs the paraglider | Act 1 on and around the Drift; you leave with the **voile** |
| Towers | Visible from everywhere, a climbing puzzle, reveal the map, give a vista | **Sondes** on ridges, draw grandfather's chart |
| Triangle rule | Triangular landforms hide what lies behind; small ones create curiosity at walking scale, big ones are landmarks; you crest one and something new appears | Ridges, dunes and kelp walls as occluders; landmarks always peek over |
| Gravity | Strong silhouettes pull the player: towers, shrine glow, stables | Sonde light columns, haut-fond glow, the Drift's lit windows, the vent plume |
| Density map | Something to notice every ~30 s of travel | One point of interest every 80-120 m (trouvaille, fish, wreck, haut-fond, NPC) |
| Shrines | Short, contained puzzle rooms, one rule each, reward → stamina/heart | **Hauts-fonds**: shallow seamounts with a puzzle, reward a **Nacre** |
| Korok seeds | Hundreds of tiny surprises on every rock | **Trouvailles**: lost things from the surface |
| Cooking | Free combination of 1-5 ingredients, deterministic result, buffs | **Le Cuistot** on the Drift, plus a marmite at the camps |
| Weather | Rain makes climbing slippery, lightning targets metal, cold/heat | Currents, plankton bloom, jellyfish swarms, the final rain from below |
| Day/night | Time changes light, creatures, music | Surface light cycle, bioluminescent nights |
| Minimal HUD | Everything appears only when it matters; stamina wheel beside Link | Souffle wheel beside the hero, nothing else by default |
| Music | Sparse piano phrases, lots of silence, context stingers | Generative WebAudio, mostly silence, stingers at discoveries |
| No fail states that block | You die, you reload a few seconds back | No death at all; exhaustion and gentle returns only |
| Villages (Kakariko, Hateno) | Dense, hand-made, safe places where the story and the daily life happen | **The walkable Drift** (§2.7): real 3D interiors, entered through the sas without a loading screen |

### 0.1 Chemistry rules (the "elements" of the sea)

All systems honour these; puzzles are built only from them.

1. **Le Revêtement** (coat): anything static grows algae fur (`coat` 0→1) over time. Faster in the north (×2 in Le Blanc), faster in light.
2. Coat **blocks light**: a coated window is opaque, a coated lens or mirror shell does not pass a beam.
3. **Frotter** (F) removes coat. Scrubbing a lens/window/mirror restores it.
4. **Courant** pushes the hero, light objects, fish, bubbles, sand clouds, kelp and grass. Lanes are fast; the global current is gentle.
5. **Chaleur** (vents, the plume): makes rising water = updraft; the hero with open voile rises in it (BotW campfire updraft).
6. **Bulles**: a bubble column lifts the hero and light objects; a trapped bubble (bell) lifts heavy objects; breathing a bubble refills souffle.
7. **Lumière**: sun shafts and bioluminescence. Light attracts jellyfish and plankton; mirror shells redirect a shaft; a lit anemone gate opens.
8. **Sable**: kicking or landing hard stirs sand → local visibility drop for 4 s; fish hide in it.
9. **Lest** (weights): the hero sinks. Heavy objects sink, light ones (shells, trouvailles, floats) drift up toward the ceiling.
10. **Faim**: fish follow food; dropping food (inventory) leads a school; a school can push a light object or reveal a trouvaille.

---

## 1. Transposition table BotW → Le Drift

| BotW | Le Drift | Notes |
|---|---|---|
| Link | **Ilo**, laveur de vitres du Drift | 16 y.o., coral scarf trailing like Link's tunic, scrubber on the back |
| Stamina wheel | **Souffle** | Wheel next to the hero, segments, turns orange when exhausted |
| Hearts | none | No combat, no death; jellyfish sting = stun + souffle loss |
| Gravity / falling | **Le lest** (weight belt): the hero sinks at 1.4 m/s | Makes verticality matter like BotW |
| Jump | **Coup de palme** (kick up, Espace) | Costs souffle |
| Climbing | Climb rock, hulls, kelp stalks, coral | Strong current = slippery (BotW rain) |
| Paraglider | **La voile** (grandfather's old sail), opens with Espace while sinking | Slow sink, fast forward; rides currents and vent updrafts |
| Horse | **La raie manta** (act 2) | Called with a whistle, rides current lanes |
| Towers | **Sondes** (6) on ridges | Climbing puzzle; activation draws the region on grandfather's chart |
| Hyrule Castle | **Le Drift**, the moving city of 400 hulls | Visible from the whole map, lit windows |
| Death Mountain | **La Cheminée**, a hydrothermal vent whose plume reaches the ceiling | Warm glow, updrafts |
| Shrines | **Hauts-fonds** (12): white zones on the chart, floor rises toward the ceiling | Puzzle with currents/bubbles/light/coat |
| Spirit orbs | **Nacres** | 4 nacres → +0.2 souffle wheel (from grandfather) |
| Korok seeds | **Trouvailles** (60): lost things from the surface | The kids name them wrong; 5 → +1 bag slot |
| Hestu | **Les enfants du rebord** (Mila, Tao, Pépin) | Keep a "musée du rebord" on the window sill |
| Cooking pot | **Le Cuistot** (galley) and **marmites** at camps | Combination rules, buffs |
| Sky / sun | **Le plafond** (surface seen from below) + sun cycle | Snell's window, shafts, ripples |
| Weather | Courant, visibilité, bloom de plancton, essaim de méduses | Posted on the forecast board by the lock |
| Thunderstorm | **Essaim de méduses** | Attracted by light (lantern) |
| Blood moon | **Nuit de plancton** | Every 5th night, the whole sea glows, music changes |
| Map | **La carte du grand-père** | Hand-drawn; unrevealed regions are blank paper |
| Fast travel | **Revenir à l'écluse** (always) + to any activated sonde | The anti-soft-lock exit |
| Shiekah Slate | **Le stylo du grand-père** (act 3) | Draws your own measures on the white |
| Calamity Ganon | none; the mystery is **La Chose** | The bird that dives through the ceiling twice a day |
| Rain | **La pluie**, seen from below as rings on the ceiling | Only in the finale and post-game |
| Villages, houses, inn bed | **L'intérieur du Drift**: sas, coursives, réfectoire, cuisine, salle des cartes, cabine | Walkable 3D, every porthole looks at the real sea; the bed passes time (§2.7) |

---

## 2. The world

### 2.1 Units and coordinates

- 1 unit = 1 m. Three.js axes: **+x = east, −z = north, +y = up**.
- World square: `x, z ∈ [−1024, 1024]` (2048 m × 2048 m).
- **Ceiling (`CEILING_Y`) = 120.** The hero cannot go above `y = 118` (soft push down, except the ending).
- Floor: general 0-30, ridges up to 60-100, Le Blanc rises from 30 at `z = −650` to ~112 at `z = −1000`.
- Chunks: **128 m** (16 × 16 = 256 chunks). Chunk `(cx, cz)` covers `x ∈ [cx·128 − 1024, +128)`. Streaming radius by quality (§4.10).
- `SEED = 0x0D21F7` (world gen is deterministic from it).

All coordinates below live in `src/core/layout.ts` (owned by core, values copied from this table).
Everybody reads layout from there; nobody hardcodes their own copy.

### 2.2 Regions

| Id | Nom | Centre (x, z) | Character |
|---|---|---|---|
| `prairie` | La Prairie de l'Écluse | (0, 600) | Rolling sea-grass plains, gentle dunes (small triangles), the Drift's route. Start. |
| `laminaires` | La Forêt de Laminaires | (−620, 0) | Golden kelp 30-70 m tall, cathedral light, climbable stalks |
| `pilier` | Le Pilier et les Arches | (0, 0) | Central rock spire to y=95, natural arches, the trench Le Sillon |
| `cheminee` | La Cheminée | (820, 380) | Vent field, black smokers, warm orange glow, the plume to the ceiling |
| `coques` | Le Cimetière des Coques | (560, −520) | Wrecked hulls of older Drifts, coated, ruins (BotW ruins) |
| `blanc` | Le Blanc (les hauts-fonds) | (0, −850) | Pale ridged sand rising to the ceiling, white coral, bright and luminous |
| `bleu` | Le Bleu | south and west edges | Drop-off into the abyss beyond |x| or |z| > 980 (S, W). Gentle current returns the hero |

Boundaries: south and west = Le Bleu drop-off; east = vent cliffs beyond x = 980; north = Le Blanc
meeting the ceiling. No invisible walls: the terrain or a current does the job.

### 2.3 Landmarks (triangle rule)

Visible from nearly everywhere (never fully hazed, see `uHazeMax`):

| Landmark | Position | Size | Why it pulls |
|---|---|---|---|
| **Le Drift** | moving (§2.5) | ~260 × 160 m, 400 hulls, y 40-75 | Warm lit windows, the home |
| **Le panache de la Cheminée** | (820, 380) | Plume Ø 30 → 120 m, floor to ceiling | Glowing base, Death Mountain |
| **Le Pilier** | (0, 0) | Spire to y=95 | Center, first big climb, sonde on top |
| **La Canopée** | (−620, 0) | Kelp walls to y=90 | Golden forest edge |
| **La lueur du Blanc** | north horizon | — | Ceiling brighter where the floor is shallow |
| Sonde light columns | each sonde | bubble + light column to ceiling | Visible once nearby or activated |

Mid-scale triangles: dunes 6-15 m high every 60-120 m in the prairie, ridges 20-40 m between regions,
so that cresting one reveals the next point of interest. The player should almost never see the full
route to a goal from the start.

### 2.4 Points of interest (layout data)

Sondes (activation reveals that region of the chart):

| Id | Nom | (x, z) | Top y | Puzzle |
|---|---|---|---|---|
| `sonde-promontoire` | Sonde du Promontoire | (−40, 660) | 60 | Tutorial climb (act 1) |
| `sonde-pilier` | Sonde du Pilier | (0, 0) | 100 | Long climb, rest ledges, souffle management |
| `sonde-laminaires` | Sonde des Laminaires | (−640, 60) | 85 | Climb kelp stalks, current shakes them |
| `sonde-cheminee` | Sonde de la Cheminée | (760, 300) | 90 | Ride the vent updraft with the voile |
| `sonde-coques` | Sonde des Coques | (560, −520) | 80 | Stacked wrecks; scrub a coated hatch |
| `sonde-blanc` | Sonde du Seuil Blanc | (−100, −700) | 95 | Reveals only the edge; the Blanc stays white |

Hauts-fonds (shrines, `hf-01`…`hf-12`), each a seamount whose top is 8-15 m below the ceiling:

| Id | (x, z) | Rule taught |
|---|---|---|
| hf-01 | (−320, 520) | Bubble column lift |
| hf-02 | (260, 700) | Scrub a lens, light opens a gate |
| hf-03 | (−520, −240) | Current lane carries a float |
| hf-04 | (−760, 360) | Kelp sway as a timing platform |
| hf-05 | (180, −160) | Mirror shells redirect a shaft |
| hf-06 | (620, 620) | Heat updraft + voile |
| hf-07 | (880, −140) | Trapped bubble bell lifts a weight |
| hf-08 | (380, −360) | Fish follow food, push a float |
| hf-09 | (−380, −780) | Le Blanc: coat regrows in seconds, race it |
| hf-10 | (300, −820) | Le Blanc: light + lens + current |
| hf-11 | (−160, −900) | Le Blanc: bubbles + weights |
| hf-12 | (120, −960) | **Le Seuil**: the finale ridge (no puzzle, the ending) |

Other: lock (`ecluse`) on the Drift's southern hull, camps with marmites at (−300, 420), (−560, −160),
(640, 220), (420, −320), (−80, −560). Current lanes (polyline + width + speed m/s):

- `lane-sud`: (−900, 800) → (−300, 700) → (300, 640) → (900, 520), width 30, 8 m/s (eastward)
- `lane-ouest`: (−880, −600) → (−700, −100) → (−640, 500), width 25, 10 m/s (southward)
- `lane-nord`: (500, 300) → (420, −100) → (200, −500) → (−100, −720), width 30, 9 m/s (northward)
- `lane-cheminee`: vertical updraft at the vent, radius 40, 7 m/s up

### 2.5 The Drift moves

The Drift follows `DRIFT_ROUTE` at **0.5 m/s** (a slow walk), heading = route tangent.

| Waypoint | (x, z) | Gate |
|---|---|---|
| `start` | (80, 520) | Act 1 start |
| `halte-prairie` | (300, 450) | Act 1 holds here (fishing) until act 2 |
| `virage-nord` | (450, 250) | Act 2 turn north |
| `halte-coques` | (300, −450) | Waits here until ≥ 3 sondes activated |
| `bord-du-blanc` | (100, −640) | Act 3: too shallow to go on. Final stop |

`state.drift.progress` is meters along the route, advanced by game time, **clamped to the current
gate**. The Drift never leaves the hero behind in an unrecoverable way: "Revenir à l'écluse" always
works. Anything standing on a hull moves with it (hero controller adds `drift.velocity` when grounded
on a collider tagged `hull`).

### 2.6 The ending

Act 3 ends at `hf-12` Le Seuil (120, −960, top y ≈ 112): the floor nearly touches the ceiling.
Rain rings cover the ceiling. The hero takes off the lest, rises, places a hand flat on the ceiling
(mirror of grandfather's hand on his window). Rings spread from the hand; fade to white; the chart
appears with the first line in the white drawn in the hero's hand. Credits. Then post-game free roam,
with occasional rain.

### 2.7 Inside the Drift (walkable interiors)

Owner's requirement: **« je veux pouvoir marcher dans le sous-marin en 3D »**. The Drift is not a
backdrop with lit windows: a quarter of it is a real place you walk through, where the story's day
loop happens (BotW's Kakariko). Warm lamp light, Ghibli cosiness, lived-in clutter, the hull creaking.

**Seamless, one world.** Interiors are not a separate scene or level. They are built inside the hulls,
at the hulls' positions, and move with the Drift. There is no loading screen, ever. Consequences:

- Every porthole and the big window look out at the real sea: fish, sun shafts, the whale, La Chose,
  rain rings on the ceiling in act 3. Nothing is faked with a picture.
- A window is **one object with two faces**: same `windowId`, same `state.windows` coat. The coat the
  player left (or scrubbed) outside is visible from inside as a fuzzy green silhouette on the glass,
  dimming the light that comes through. Coat never grows on the inner face.
- From outside, through a scrubbed window, you see the real interior (the same meshes, at LOD).

**Walkable quarter.** Of the 400 hulls, **12 are walkable** (around the lock, the southern hulls); the
other 388 keep the cheap "interior seen through glass" (lit card + silhouettes). The walkable set:

| Id (`RoomId`) | Nom (FR, shown on entering) | Hull | What happens there |
|---|---|---|---|
| `sas` | Le Sas | lock hull | Airlock (below), the forecast board, Mme Rouille's stool, hooks for the scrubber |
| `coursive-sud` | La Coursive | lock hull → refectory | Main corridor: pipes, lanterns, laundry, kids running |
| `refectoire` | Le Réfectoire | the big hull | The whole Drift eats breakfast on long benches **facing the big window** (the most popular thing down here). ~40 seated NPCs at 07:30 |
| `rebord` | Le Rebord | inside the big window | The deep window sill where Mila, Tao and Pépin play the clapping game; their « musée du rebord » of trouvailles on shelves |
| `cuisine` | La Cuisine | next to the refectory | The Cuistot, pots swinging with the sway, the "bread"; the cooking marmite of the Drift |
| `marche` | Le Marché | a wide barrel hull | Stalls, trades (ingredients, trouvailles shown to collectors), gossip |
| `passerelle-1..3` | La Passerelle | between hulls | Enclosed gangway tubes with portholes on both sides, they flex and creak |
| `salle-des-cartes` | La Salle des Cartes | grandfather's hull | Grandfather, his window, **the chart on the table** you can lean over and open |
| `cabine` | Ta cabine | small hull | Bunk (sleep / save / pass time), your things, a porthole, the six-year-old's drawings of La Chose |
| `cabines-voisins` | Les Cabines | two hulls | Residents' cabins for the « petites demandes » |
| `echelle-toit` | La Trappe | top of the lock hull | A ladder to a small vertical sas: second way out, onto the roof of the Drift |

Doors are open passages or hand-operated doors (round hatches with a wheel). No locked door ever
traps the hero; story-gated doors only stay closed from the outside of a room.

**The sas (airlock) sequence**, in-engine, 6 s, input locked but camera free:

1. In: the hero swims into the chamber, the outer hatch closes (clang, bubbles).
2. Pumps; the water level drops (a flat animated water plane, foam line on the walls). Light switches
   from cold blue to warm amber, one bulb at a time.
3. The hero sinks with the water and **lands on his feet** (`land-dry`), shakes off water, the scarf
   goes from floating to hanging. Medium becomes air.
4. The inner hatch opens. The hero is **dripping**: drops fall from scarf and hair, and he leaves
   **wet footprints that dry** (wetness 1 → 0 over 2 real minutes; footprints fade with it).
5. Out is the same in reverse: chamber floods, scarf lifts, the hero floats, outer hatch opens.

First pass plays at full length; later passes can be sped up ×3 by holding E. The roof hatch uses the
same sequence vertically (climb the ladder in, swim up out).

**The Drift moves**, so interiors sway and creak: a slow roll ±0.5° (period 9-14 s) and pitch ±0.3°,
hanging lamps and pots swing as pendulums, cups slide a little, a creak every 8-20 s, the hull groans
when the Drift turns. Sway is **visual only** (applied to the interior's render group and the camera);
colliders follow only the Drift's translation and heading, so walking never jitters.

**Day loop** (indoors is where the story's rhythm lives; NPCs follow an hourly schedule):

| Hour | Where people are |
|---|---|
| 06:00 | Ilo wakes in `cabine`; Mme Rouille posts the forecast in `sas` |
| 06:15-07:30 | The tournée outside; residents wake, corridors fill |
| 07:30-08:30 | Breakfast in `refectoire`, everyone facing the big window; Ilo served last, still dripping |
| 08:30-12:00 | Kids on `rebord`; market open; Cuistot in `cuisine` |
| 12:00-17:00 | Market, errands, grandfather in `salle-des-cartes` |
| 17:30 | Second La Chose dive: residents gather at portholes |
| 19:00-21:00 | Supper in `refectoire`, lamps low, songs |
| 21:00 | Quarter asleep; snoring behind doors; grandfather awake over the chart |

---

## 3. Story and quests

Characters: **Ilo** (hero, unnamed in dialogue: people say "toi" / "petit·e"), **Grand-père**
(keeps the chart), **le Cuistot**, **Mme Rouille** (gardienne de l'écluse, forecast board),
**les enfants du rebord** (Mila, Tao, Pépin), **La Chose** (the bird; nobody has the word "oiseau").

### Act 1 — La Vitre (the Great Plateau)

Game day 1, starts 06:00. Teaches every core verb in a bounded space around the Drift.

1. `a1-reveil` Wake in the bunk in `cabine` (indoor walk, doors, ladder). Walk the coursive to `sas`. Forecast board: « Visibilité 30 m. Courant du sud. Risque de méduses. » First airlock out.
2. `a1-corde` Lock → rope guide line → hull. Teaches walk, kick, sink, climb (hull), souffle.
3. `a1-grande-vitre` Scrub the big window (scrub minigame). Behind it, the whole Drift eats breakfast facing you. A turtle swims by: « Une tortue ! Une première ! »
4. `a1-chose` 07:00 scripted: La Chose falls through the ceiling near the Drift, grabs a fish, goes back up. First sighting from outside.
5. `a1-petit-dejeuner` First airlock **in**. Wet footprints along the coursive to `refectoire`, then `cuisine`: breakfast with the Cuistot (cooking tutorial: « poisson, poisson, et quelque chose que le Cuistot appelle du pain »). You get yours last, still dripping (« Tu gouttes partout. »). Sit on the bench facing the window you just cleaned: the coat you missed is visible from inside.
6. `a1-rebord` The kids' clapping game on the sill, inside, in front of the big window (rhythm minigame): « Pluie, pluie, va-t'en… » « C'est quoi, une pluie ? » « Un poisson. »
7. `a1-grand-pere` Back out: scrub grandfather's window last, from outside, while he watches. Then in, through the passerelle, to `salle-des-cartes`: lean over the table, the chart opens. The groove of the route, the white. « Cette année, la nourriture est partie au nord. Vers le blanc. »
8. `a1-sonde` Reactivate the Sonde du Promontoire (tutorial tower). Vista. Chart draws the Prairie.
9. `a1-voile` Grandfather gives his old **voile**. Leaving the Prairie's ridge requires it (the Great Plateau exit). → act 2.

### Act 2 — Le Nord (open world)

The Drift turns north. The world opens. Visibility forecasts climb: 60 m, 90 m, « beaucoup ».
Coat regrows faster: windows need a round each time you come back.

- `a2-sondes` Activate **any 3** of the 5 remaining sondes (any order). Each one: chart region + vista. Going home to `salle-des-cartes` after each one triggers grandfather's remark at the table (optional; the chart updates anyway).
- Coming home is the rhythm of act 2: sleep in `cabine`, breakfast in `refectoire`, residents' lines change as the Drift goes north (the light through the portholes changes too).
- `a2-raie` Feed a manta caught in a current eddy → it follows your whistle (ride unlock). Optional but signposted.
- `a2-chose` Each La Chose dive happens closer to the hero (scripted dive positions approach the Drift's front).
- `a2-halte` At `halte-coques` the Drift waits until 3 sondes are done, then proceeds to `bord-du-blanc`.
- Exit condition: Drift at `bord-du-blanc` → act 3 starts the next morning (third morning near the Blanc).

### Act 3 — Le Blanc

1. `a3-matin` Third morning, **inside**, breakfast in `refectoire`. Through the big window, La Chose comes close: arms too wide, layered like a book, an eye turned toward you, holding the fish like grandfather holds a pen. The whole room stands up. It goes up, leaving rings.
2. `a3-pluie` In `salle-des-cartes`: hundreds of rings with no fish under them seen through his window; a soft sound through the glass (and the hull). Grandfather, hand flat on his window, mouths « pluie ». He looks at you, at the pen on the chart table, at the white. He gives you **le stylo**. You leave through the sas.
3. `a3-mesures` Enter Le Blanc (chart blank). Place your **repères** (pen) at 3 of hf-09/10/11 or their summits (puzzle optional: the summit is reachable by climbing). Each draws your line on the chart.
4. `a3-seuil` Reach hf-12 Le Seuil. Ending (§2.6).

### No soft-locks (hard rules)

- Every required objective is reachable with base souffle (1.0 wheel) and base items; nacres only make things easier.
- The voile is given before the Prairie exit; the manta is never required.
- « Revenir à l'écluse » is always in the pause menu and on the chart.
- Quest state is derived from flags and is idempotent: re-entering a step never removes a key item.
- Key items (voile, stylo, frottoir, lest) cannot be dropped, eaten or sold.
- Out of souffle never kills: you let go, sink, and recover on the floor.
- Le Bleu: a current carries you back to the last safe position (fade 1 s).
- `setAct(n)` must produce a consistent state (grant all prerequisites of earlier acts).
- Indoors: no door can lock the hero inside a room; the sas always works both ways. If the hero is
  stuck (controller blocked > 3 s) or below an interior floor, snap him to the room's spawn point.
- « Revenir à l'écluse » from indoors puts the hero inside `sas`, dry, in air.

### Side activities

- **La tournée** : daily window round (20 windows near the lock), coat regrows; reward: ingredients, and gossip lines from residents.
- **Hauts-fonds** : 11 puzzles + Le Seuil. Nacres → souffle (+0.2 per 4 nacres, max 3.0 wheels in total with later upgrades if added).
- **Trouvailles** : 60 lost surface objects, each with a micro-challenge (under a stone, in a closed clam, on a kelp tip, in a coated porthole, carried by a school of fish). Kids rename them: « Un parapluie. Mila dit que c'est un poisson qui a mal tourné. »
- **Cuisine** : free combinations; deterministic.
- **Courses de raie** : ride lanes against the clock (act 2+).
- **Recensement** : count fish species for grandfather's chart margins (bestiary).
- **Petites demandes** : 8 Drift residents' errands (deliver, find, scrub a special window).
- **Le jeu de mains** : the clapping game, harder verses unlocked by trouvailles.
- **Le marché** : trade ingredients; show trouvailles to collectors for gossip and a recipe hint.
- **Dormir** : the bunk in `cabine` saves and passes time (BotW campfire): « Dormir jusqu'à l'aube », « jusqu'à midi », « jusqu'au soir ».

### Items (`ItemId`)

Tools (key): `frottoir`, `lest`, `voile`, `sifflet-raie`, `stylo`, `lanterne`.
Ingredients: `poisson`, `algue-rouge`, `algue-doree`, `oursin`, `moule`, `crevette`, `sel-de-cheminee`, `plancton`, `mie-du-cuistot`.
Dishes: `soupe-chaude` (vent heat, +regen 50 % 3 min), `galette-de-plancton` (refill souffle), `brochette` (sprint −30 % cost 3 min), `pain-du-cuistot` (refill + temporary +0.2 wheel), `rate` (« Plat raté »: tiny refill).
Other: `nacre`, `trouvaille:<id>` (60 ids `tr-01`…`tr-60`).

Cooking rule: bag of 1-5 ingredients → dish by priority table in `gameplay/cooking.ts`; any unknown combo → `rate`. Deterministic.

---

## 4. Architecture

### 4.1 Folders and ownership

Exactly one owner per folder. **Never edit another folder.** Cross-folder access is only:
(a) `import type` from `src/core/types.ts`, (b) runtime calls through `ctx.services.*`,
(c) data from `src/core/layout.ts` and `src/core/tuning.ts`, (d) events on `ctx.bus`.
No runtime import from another non-core folder.

```
index.html                 core
package.json, vite/ts cfg  core (no new dependencies without the owner's agreement)
src/main.ts                core
src/core/                  engine, loop, input, physics, event bus, state, save, quality, debug, layout, tuning, types
src/render/                renderer setup, cel materials, post, haze, god rays, caustics, ceiling, sun cycle
src/world/                 terrain heightfield chunks, rocks, ridges, arches, shallows, colliders, current field
src/flora/                 kelp, sea grass, coral, anemones (instanced, sway, LOD)
src/hero/                  model, skeleton, animations, scarf, controller, camera; indoor locomotion
                           (walk/run with gravity, stairs, ladders, sit, lean), indoor camera, wetness,
                           drips and wet footprints
src/drift/                 hulls, windows + coat (both faces), far interiors seen through glass, NPCs,
                           lock, rope; walkable interiors (src/drift/interiors/): geometry, props,
                           lamps, colliders, doors and hatches (mesh + collider + open/close anim),
                           airlock machinery (water plane, pumps, lights), sway/creak, NPC placement
                           and hourly schedules, room graph
src/fauna/                 fish schools, jellyfish, whale, manta, turtle, La Chose
src/gameplay/              souffle, climbing costs, glide rules, sondes, hauts-fonds, trouvailles, cooking,
                           inventory, quests, dialogue, weather, chart UI, HUD, menus; indoor interactions
                           (doors, seats, bed + sleep, chart table, market, sas prompts, room-name toast)
src/audio/                 adaptive music, ambience, sfx
assets/                    CREDITS.md (anyone appends, one line per asset)
docs/                      BIBLE.md
```

Each folder exposes `src/<folder>/index.ts` exporting a factory `create<Folder>System(): System`.

Interiors split (one owner per concern, never two):

| Concern | Owner | Contract |
|---|---|---|
| Rooms, props, lamps, colliders, doors/hatches/ladders as objects, airlock machinery, sway, NPC bodies + schedules | `drift` | `DriftService` interior methods (§4.7), colliders tagged `interior`/`stair`/`ladder`/`door`/`seat` |
| How the hero moves and is filmed indoors, footprints, drips | `hero` | Reads `drift.mediumAt`, `roomAt`, ladder/seat anchors; `HeroService.sit/stand/lean` |
| When something is interactable and what it does (prompt, open, sit, sleep, chart, market, airlock trigger, quests) | `gameplay` | Emits `interact`, calls `drift.openDoor`, `drift.cycleAirlock`, `hero.sit`, `sleepUntil` |
| Indoor shading (lamp term, no caustics, god-ray pass off) | `render` | `cel({ indoor: true })`, `uIndoor` uniform |
| Muffled outside, creaks, footsteps on wood/metal | `audio` | Reads `state.hero.medium`, listens to `airlock:*`, `hero:step` |

### 4.2 Core types (`src/core/types.ts`)

```ts
import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'

export type Vec3 = { x: number; y: number; z: number }
export type Act = 1 | 2 | 3
export type SystemId = 'render' | 'world' | 'flora' | 'drift' | 'fauna' | 'hero' | 'gameplay' | 'audio'
export type RegionId = 'prairie' | 'laminaires' | 'pilier' | 'cheminee' | 'coques' | 'blanc' | 'bleu'
export type DayPhase = 'aube' | 'jour' | 'crepuscule' | 'nuit'
export type QualityLevel = 'low' | 'medium' | 'high'
export type HeroMode =
  | 'idle' | 'walk' | 'swim' | 'sink' | 'climb' | 'glide' | 'scrub' | 'ride' | 'exhausted' | 'cutscene'
  | 'fall' | 'ladder' | 'sit' | 'lean' | 'sleep' | 'airlock'
export type Medium = 'water' | 'air'
export type RoomId =
  | 'sas' | 'coursive-sud' | 'refectoire' | 'rebord' | 'cuisine' | 'marche'
  | 'passerelle-1' | 'passerelle-2' | 'passerelle-3' | 'salle-des-cartes' | 'cabine'
  | 'cabines-voisins' | 'echelle-toit'

export interface System {
  readonly id: SystemId
  init(ctx: GameContext): void | Promise<void>
  update(dt: number, ctx: GameContext): void
  lateUpdate?(dt: number, ctx: GameContext): void
  dispose(): void
}

export interface GameContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  canvas: HTMLCanvasElement
  uiRoot: HTMLElement
  physics: PhysicsWorld
  input: Input
  bus: EventBus
  state: GameState
  save: SaveStore
  quality: QualitySettings
  services: Services
  clock: { elapsed: number; frame: number; paused: boolean }
  rng(key: string): () => number
}

export interface Services {
  render?: RenderService
  world?: WorldService
  flora?: FloraService
  drift?: DriftService
  fauna?: FaunaService
  hero?: HeroService
  gameplay?: GameplayService
  audio?: AudioService
  debug: DebugRegistry
}
```

**Every consumer must tolerate a missing service** (`ctx.services.world?.heightAt(x, z) ?? 0`):
folders are built in parallel and may be stubs.

### 4.3 Physics (`ctx.physics`)

```ts
export type ColliderKind =
  | 'terrain' | 'rock' | 'hull' | 'window' | 'kelp' | 'coral' | 'sonde' | 'shrine' | 'prop' | 'trigger' | 'fauna'
  | 'interior' | 'stair' | 'ladder' | 'door' | 'seat'
export interface ColliderTag { kind: ColliderKind; climbable: boolean; ownerId?: string }
export interface RayHit { point: Vec3; normal: Vec3; distance: number; tag?: ColliderTag; handle: number }

export interface PhysicsWorld {
  rapier: typeof RAPIER
  world: RAPIER.World
  tag(collider: RAPIER.Collider, tag: ColliderTag): void
  untag(collider: RAPIER.Collider): void
  tagOf(handle: number): ColliderTag | undefined
  raycast(origin: Vec3, dir: Vec3, maxDist: number, opts?: { excludeKinds?: ColliderKind[] }): RayHit | null
  groups: { TERRAIN: number; HERO: number; FAUNA: number; TRIGGER: number }
}
```

Fixed step 1/60 s with accumulator (max 4 substeps). Water is not simulated by Rapier: gravity is
zero in the Rapier world; each controller applies its own buoyancy/drag. The hero uses Rapier's
`KinematicCharacterController`. Rapier colliders have no user data: tags live in core's map, so
**call `untag` when removing a collider** or the map leaks and handles get reused with a stale tag.

Interiors: each walkable hull is **one kinematic rigid body** (drift moves it with
`setNextKinematicTranslation/Rotation` from the Drift pose, never with the visual sway) carrying cuboid
and convex colliders (floors, walls, steps, furniture), ≤ 60 per hull. Indoors the hero applies his own
gravity (−9.81 m/s²) and adds the hull's velocity when grounded on `interior`/`stair` (same rule as
`hull`). Trap: a trimesh floor lets the KCC snag on internal edges; use cuboids for floors and steps.
Open doors remove their collider (and `untag` it), closed doors restore it.

### 4.4 Input (`ctx.input`)

```ts
export type ButtonAction =
  | 'up' | 'down' | 'sprint' | 'interact' | 'scrub' | 'map' | 'inventory' | 'pause' | 'whistle' | 'recenter'
export interface Input {
  move: { x: number; y: number }         // -1..1, y = forward
  look: { x: number; y: number }         // radians this frame, already scaled by sensitivity
  down(a: ButtonAction): boolean
  pressed(a: ButtonAction): boolean      // went down this frame
  released(a: ButtonAction): boolean
  device: 'kbm' | 'gamepad'
  pointerLocked: boolean
  keyLabel(a: ButtonAction): string      // "Z" on AZERTY, "W" on QWERTY
}
```

Keyboard bindings use `KeyboardEvent.code` (physical position), never `.key`: `KeyW` is Z on AZERTY,
so ZQSD and WASD both work with one binding. Labels come from `navigator.keyboard.getLayoutMap()`
when available.

### 4.5 Events (`ctx.bus`)

```ts
export interface GameEvents {
  'game:ready': {}
  'game:paused': { paused: boolean }
  'time:hour': { hour: number; day: number }
  'time:phase': { phase: DayPhase }
  'act:changed': { act: Act }
  'quest:step': { questId: string; step: string }
  'quest:completed': { questId: string }
  'hero:mode': { from: HeroMode; to: HeroMode }
  'hero:landed': { speed: number; kind: ColliderKind }
  'hero:kick': {}
  'hero:breathEmpty': {}
  'hero:breathFull': {}
  'hero:stung': { by: 'meduse' }
  'interact:hint': { id: string; label: string } | null
  'interact': {
    targetId: string
    kind: 'npc' | 'sonde' | 'window' | 'item' | 'marmite' | 'shrine' | 'manta'
      | 'door' | 'seat' | 'bed' | 'chart-table' | 'ladder' | 'stall' | 'airlock'
  }
  'hero:medium': { medium: Medium }
  'hero:step': { surface: 'sable' | 'bois' | 'metal' | 'tapis'; wet: boolean }
  'room:entered': { roomId: RoomId }
  'room:left': { roomId: RoomId }
  'airlock:cycle': { lockId: 'sas' | 'echelle-toit'; dir: 'in' | 'out'; phase: 'close' | 'pump' | 'open' | 'done' }
  'door:changed': { doorId: string; open: boolean }
  'sleep:done': { fromHour: number; toHour: number; day: number }
  'scrub:progress': { windowId: string; coat: number }
  'scrub:done': { windowId: string }
  'sonde:activated': { sondeId: string; region: RegionId }
  'shallow:entered': { id: string }
  'shallow:completed': { id: string }
  'collectible:found': { id: string }
  'item:gained': { itemId: string; count: number }
  'cook:done': { dishId: string }
  'dialogue:start': { npcId: string; nodeId: string }
  'dialogue:end': { npcId: string }
  'weather:changed': { env: EnvState }
  'chose:dive': { position: Vec3; phase: 'descend' | 'grab' | 'ascend' }
  'whale:pass': { position: Vec3 }
  'ceiling:ripple': { x: number; z: number; strength: number }
  'world:chunkLoaded': { cx: number; cz: number; lod: 0 | 1 | 2 }
  'world:chunkUnloaded': { cx: number; cz: number }
  'ui:menu': { open: 'carte' | 'inventaire' | 'pause' | null }
  'audio:cue': { cue: MusicCue }
  'save:written': {}
  'debug:pose': { name: string }
}
export interface EventBus {
  on<K extends keyof GameEvents>(k: K, fn: (p: GameEvents[K]) => void): () => void
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void
}
```

### 4.6 State (`ctx.state`, saved)

```ts
export interface EnvState {
  current: Vec3             // global current m/s
  visibility: number        // diegetic meters shown on the board: 30, 60, 90, 999 ("beaucoup")
  bloom: number             // plankton 0..1
  jellyfish: number         // swarm chance/intensity 0..1
  rain: number              // 0..1, finale and post-game only
}
export interface GameState {
  version: 1
  act: Act
  quests: Record<string, string>          // questId -> current step id or 'done'
  flags: Record<string, boolean>
  time: { hours: number; day: number; scale: number }   // scale = game hours per real second (default 1/60)
  env: EnvState
  hero: {
    position: Vec3; velocity: Vec3; yaw: number; mode: HeroMode
    breath: number; breathMax: number; exhausted: boolean
    lestOn: boolean; lastSafe: Vec3
    medium: Medium; room: RoomId | null; wetness: number      // wetness 1 = just out of water, 0 = dry
    localPosition: Vec3 | null                                // hull-local while indoors (survives the Drift moving)
  }
  drift: {
    progress: number; position: Vec3; heading: number; velocity: Vec3; gate: string
    doors: Record<string, boolean>                            // doorId -> open
  }
  chart: { sondes: string[]; reperes: string[]; pins: { x: number; z: number; icon: string }[] }
  inventory: { items: Record<string, number>; slots: number }
  shallows: string[]
  trouvailles: string[]
  windows: Record<string, number>         // windowId -> game-hours timestamp of last scrub
  settings: { quality: QualityLevel; invertY: boolean; sensitivity: number; volume: number; minimap: boolean }
  debug: { cameraLocked: boolean }
}
```

Writers: `time`, `debug`, `settings.quality` → core. `env`, `act`, `quests`, `flags`, `chart`,
`inventory`, `shallows`, `trouvailles`, `hero.breath*`/`exhausted` → gameplay. `hero` (rest) → hero.
`drift` → drift. `windows` → drift. Everybody may read everything.
Indoors the save stores `hero.localPosition` + `hero.room`; on load the hero is placed from them, not from
the world `position` (the Drift moved since). Save written on `sleep:done` too.

Save: `localStorage` key `le-drift:save:v1`, every read/write in try/catch (private windows throw).
Autosave every 60 s real time and on `sonde:activated`, `shallow:completed`, `act:changed`,
`quest:step`. Migration by `version`.

### 4.7 Services

```ts
export interface CelMaterialParams {
  color: number; shadowColor?: number; rim?: number; emissive?: number
  map?: THREE.Texture; vertexColors?: boolean; caustics?: boolean; transparent?: boolean
  side?: THREE.Side; onShader?: (shader: THREE.WebGLProgramParametersWithUniforms) => void
  indoor?: boolean   // no caustics, no red absorption, adds the uLamps term (§5.2)
}
export interface RenderService {
  cel(params: CelMaterialParams): THREE.Material   // every visible object uses this or patchWater
  patchWater(material: THREE.Material): void       // inject haze + caustics into a custom material
  readonly uniforms: {                              // shared, update by reference
    uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color }
    uCurrent: { value: THREE.Vector3 }; uHeroPos: { value: THREE.Vector3 }
    uHazeDist: { value: number }; uHazeMax: { value: number }
    uIndoor: { value: number }                      // 0..1, eased by render from state.hero.medium
    uLamps: { value: THREE.Vector4[] }              // 8 nearest lamps: xyz world, w radius (drift fills)
    uLampColors: { value: THREE.Color[] }
  }
  addRipple(x: number, z: number, strength: number): void
  draw(ctx: GameContext): void                      // called by core once per frame
  sunPhase(): DayPhase
  stats(): { drawCalls: number; triangles: number; ms: number }
}
export interface WorldService {
  heightAt(x: number, z: number): number            // pure, works for unloaded chunks
  normalAt(x: number, z: number): Vec3
  regionAt(x: number, z: number): RegionId
  currentAt(p: Vec3): Vec3                          // global env.current + lanes + vent updraft
  isLoaded(cx: number, cz: number): boolean
  safeSpawnNear(p: Vec3): Vec3
}
export interface FloraService {
  climbableKelpNear(p: Vec3, r: number): { base: Vec3; height: number }[]
  flatten(p: Vec3, r: number): void                 // hero/creatures bend grass
}
export interface DriftService {
  pose(): { position: Vec3; heading: number; velocity: Vec3 }
  lockPosition(): Vec3                              // respawn point for "Revenir à l'écluse"
  nearestWindow(p: Vec3, maxDist: number): { id: string; coat: number; position: Vec3; normal: Vec3 } | null
  scrub(windowId: string, amount: number): number   // returns remaining coat
  npcPosition(npcId: string): Vec3 | null
  playScene(id: 'petit-dejeuner' | 'rebord' | 'grand-pere-pluie' | 'chose-vitre'): Promise<void>
  // interiors
  mediumAt(p: Vec3): Medium                         // 'air' inside a sealed walkable room
  roomAt(p: Vec3): RoomId | null
  toLocal(p: Vec3): Vec3                            // world <-> Drift-local (translation + heading, no sway)
  toWorld(p: Vec3): Vec3
  roomSpawn(room: RoomId): { position: Vec3; yaw: number }
  ladders(room: RoomId): { id: string; bottom: Vec3; top: Vec3; normal: Vec3 }[]
  seat(id: string): { position: Vec3; yaw: number } | null
  openDoor(doorId: string, open: boolean): void
  cycleAirlock(lockId: 'sas' | 'echelle-toit', dir: 'in' | 'out'): Promise<void>   // emits airlock:cycle
  roomCeilingAt(p: Vec3): number | null             // for the indoor camera
}
export interface FaunaService {
  choseDive(target: Vec3, close: boolean): Promise<void>
  spawnScripted(id: 'tortue-premiere' | 'raie-coincee' | 'baleine'): void
  manta(): { position: Vec3; mount(): void; dismount(): void } | null
  jellyfishNear(p: Vec3, r: number): number
  attractSchool(p: Vec3): void                      // food dropped
}
export interface HeroService {
  teleport(p: Vec3, yaw?: number): void
  setMode(m: HeroMode): void
  setCameraPose(pose: CameraPose | null): void      // null = return to gameplay camera
  headPosition(): Vec3
  sit(seatId: string): void                         // walks to the seat anchor, then 'sit'
  lean(target: Vec3): void                          // chart table, sill
  stand(): void
}
export interface GameplayService {
  breath: {
    spend(cost: number): boolean                    // one-shot (kick, climb-jump)
    drain(ratePerSec: number, dt: number): boolean  // continuous; false when exhausted
    canAct(): boolean
  }
  setAct(act: Act): void
  giveItem(id: string, n?: number): void
  hasItem(id: string): boolean
  setWeather(env: Partial<EnvState>): void
  sleepUntil(hour: number): Promise<void>           // fade, advance time, save, emits sleep:done
  chartCanvas(): HTMLCanvasElement | null           // the same chart the M menu draws; drift maps it on the table
}
export interface AudioService { cue(c: MusicCue): void; sfx(id: string, at?: Vec3): void; unlock(): Promise<void> }
export type MusicCue = 'explore' | 'drift' | 'sonde' | 'shallow' | 'danger' | 'night' | 'wonder' | 'rain' | 'silence'

export interface CameraPose { position: Vec3; target: Vec3; fov?: number }
export interface DebugRegistry {
  registerPose(name: string, pose: { camera: CameraPose; hero?: { position: Vec3; yaw: number }; hour?: number }): void
}
```

If the hero runs without gameplay, `breath` is infinite. If gameplay runs without the hero, it reads
`state.hero` only.

### 4.8 Loop and registration (`src/main.ts`, core)

```ts
const systems: System[] = [
  createRenderSystem(), createWorldSystem(), createFloraSystem(), createDriftSystem(),
  createFaunaSystem(), createHeroSystem(), createGameplaySystem(), createAudioSystem(),
]
for (const s of systems) await s.init(ctx)   // in this order: render first (materials), world before flora
```

Per frame: `input.poll` → advance `state.time` → `system.update(dt)` in order → physics fixed steps
→ `system.lateUpdate(dt)` (camera here) → `services.render?.draw(ctx) ?? renderer.render(scene, camera)`.
`dt` clamped to 0.1 s. Paused: only render and gameplay (menus) update. Systems create materials
during `init`, never at import time (render may not be ready).

### 4.9 Performance budgets

Targets: **60 fps on a MacBook (M1/M2) at `high`**, **30 fps on a mid laptop at `low`**.

| | high | medium | low |
|---|---|---|---|
| Draw calls (total) | ≤ 250 | ≤ 180 | ≤ 120 |
| Triangles | ≤ 1.5 M | ≤ 900 k | ≤ 500 k |
| Pixel ratio cap | 2 | 1.5 | 1 |
| Chunk radius (full / LOD) | 3 / 6 | 2 / 5 | 2 / 4 |
| Grass blades near hero | 120 k | 60 k | 25 k |
| Fish | 2500 | 1200 | 500 |
| Sun shadow map | 2048, 120 m around hero | 1024 | none (blob) |
| God rays | world shafts + radial pass | world shafts | world shafts (fewer) |
| Outline / painterly pass | yes | outline only | none |

Per-folder draw-call budget at high: render post 8, world 50, flora 40, drift 60, fauna 30, hero 10,
gameplay (in-world markers) 15, spare 37. Instancing is mandatory for grass, kelp, coral, hulls,
windows, fish, jellyfish. No per-frame allocations in hot loops. Auto-quality: if the average frame
is > 24 ms over 5 s, drop one level once and toast « Qualité réduite ».

Interiors (same totals as above, redistributed while `state.hero.medium === 'air'`):

| Indoors | high | medium | low |
|---|---|---|---|
| Rooms drawn in full | current + graph neighbours | current + neighbours | current + neighbours |
| Interior draw calls (drift) | ≤ 70 | ≤ 50 | ≤ 35 |
| Interior triangles | ≤ 250 k | ≤ 150 k | ≤ 80 k |
| Lamps in `uLamps` | 8 | 6 | 4 |
| Lamp shadows | none (baked AO in vertex colours) | none | none |
| Outside chunk radius (full / LOD) | 2 / 4 | 1 / 3 | 1 / 2 |
| Grass blades | 30 k | 15 k | 6 k |
| Seated/walking NPCs animated | 40 / 12 | 25 / 8 | 12 / 4 (rest frozen poses) |
| Footprint decals | 64 (1 instanced draw) | 48 | 24 |

Rooms not adjacent to the current room are `visible = false`. From outside, walkable interiors are
drawn only within 40 m of the camera and at LOD (no small props); beyond, the far-interior cards. All
props instanced or merged per room (one merged static mesh per room + instanced repeats: bowls, bench
legs, rivets). God-ray radial pass and sun shadows off indoors (light through portholes is a cheap
additive cone per porthole, ≤ 1 draw per room).

```ts
export interface QualitySettings {
  level: QualityLevel
  pixelRatio: number; chunkRadius: number; lodRadius: number; grassDensity: number; fishCount: number
  shadows: boolean; shadowMapSize: number; godRayPass: boolean; outline: boolean; painterly: boolean
  onChange(fn: (q: QualitySettings) => void): () => void
}
```

### 4.10 Per-folder definition of done

- **core**: boots a blank scene with a test cube when no other folder exists; `npm run typecheck` and `build` pass; `window.__game` works; FPS/draw-call overlay with `?debug`.
- **render**: cel material + haze + caustics + shafts + ceiling with Snell's window; sun cycle; vista pose looks like §5.4.
- **world**: 256 chunks streamed; heightfield colliders tagged; regions and landmarks in place; `heightAt` pure.
- **flora**: kelp forests and grass fields swaying with `uCurrent` and gust waves; grass bends around the hero.
- **hero**: Ilo modeled and animated, controller per §6/§3 tuning, BotW camera; indoor mode (walk/run,
  stairs, ladders, sit, lean) with the close indoor camera, drips and drying footprints.
- **drift**: 400 hulls moving on the route, scrubbable windows with coat (visible from both faces), NPCs,
  lock and rope; the 12 walkable rooms of §2.7 with colliders, doors, airlock sequence, sway and creak,
  NPC schedules; you can walk from `cabine` to `refectoire` and out through `sas` with no loading screen.
- **fauna**: schools, jellyfish, whale, manta, turtle, La Chose dives twice a day.
- **gameplay**: the whole quest line playable start to end, HUD, chart, inventory, cooking, weather; indoor
  interactions (doors, seats, bed/sleep, chart table, market, sas prompts, room-name toast).
- **audio**: music cues, ambience, sfx, unlocks on first user gesture; indoor mix (muffled sea, creaks).
- **render**: also `indoor` cel variant with the lamp term, `uIndoor` easing, porthole light cones.

---

## 5. Art bible

### 5.1 Palette

| Token | Hex | Use |
|---|---|---|
| `abysse` | `#0E3B52` | Deepest haze, looking down |
| `profond` | `#1B5E73` | Lower haze |
| `milieu` | `#3A8C98` | Mid haze (horizontal view) |
| `clair` | `#7CC6BF` | Upper haze, shallows |
| `plafond` | `#CFEFE3` | Ceiling glow, Snell's window |
| `soleil-aube` | `#FFC98A` | Dawn sun, rim light |
| `soleil-jour` | `#FFF1C9` | Noon sun |
| `soleil-soir` | `#FF9A6B` | Dusk sun |
| `nuit` | `#12305A` | Night haze |
| `bio-1` / `bio-2` | `#6FF0E0` / `#B6A8FF` | Bioluminescence |
| `sable` / `sable-ombre` | `#E9DDB8` / `#B8A77E` | Floor |
| `roche` / `roche-ombre` | `#7D8A96` / `#45507A` | Rock lit / shadow (shadows go cool violet, never grey) |
| `laminaire` / `laminaire-ombre` | `#C79A3B` / `#7A6A2A` | Golden kelp |
| `herbe` / `herbe-ombre` | `#8FBF6A` / `#4F8A5A` | Sea grass |
| `corail-1/2/3` | `#F08A7E` / `#F7B267` / `#B784C9` | Coral accents |
| `coque-rouille` / `coque-laiton` / `coque-teal` | `#C46A4A` / `#D9B48F` / `#4F6D7A` | Drift hulls |
| `vitre-lumiere` | `#FFD9A0` | Lit windows |
| `revetement` | `#6F8F4E` | Coat on windows |
| `echarpe` | `#E8674A` | Hero scarf (complementary to the water) |
| `tunique` / `peau` / `lest` | `#2F4E7A` / `#C98E6B` / `#C9A54B` | Hero |
| `cheminee-coeur` / `cheminee-fumee` | `#FF8A4C` / `#5A4B5E` | Vent |
| `blanc` / `blanc-ombre` | `#F4F1E6` / `#DCEFF0` | Le Blanc |
| UI `texte` / `accent` / `souffle` / `souffle-bas` | `#F6F2E8` / `#E8674A` / `#9EE6C9` / `#F2C14E` | HUD |
| `lampe` / `lampe-chaude` | `#FFC27A` / `#FF9E5E` | Interior lamps, lamp pools |
| `bois` / `bois-ombre` | `#B07A4F` / `#5E4A5C` | Benches, tables, floors (shadow goes plum, never grey) |
| `tissu-1/2/3` | `#D8644E` / `#E3B95F` / `#6E8FB0` | Cushions, laundry, curtains, bunting |
| `toile-carte` | `#EFE3C4` | The chart paper on the table |
| `interieur-ombre` | `#3E3A5A` | Interior cel shadow band |

### 5.2 Lighting and shading

- **Cel ramp**: 3 bands with soft steps (`smoothstep` width 0.08) on `N·L`, where L = `uSunDir`.
  Shadow band = albedo × `shadowColor` (default cool violet `#45507A` mixed 55 %), never black/grey.
- **Ambient**: hemisphere `plafond` (top) → `profond` (bottom), intensity 0.55; bounce from sand 0.15.
- **Rim light** (BotW signature): `pow(1 − N·V, 3) × sunColor × 0.6`, stronger on the side facing the sun.
- **Caustics**: animated cellular pattern projected along `uSunDir` on surfaces with `N.y > 0.3`,
  strength `0.35 × (1 − depth/120)`, drifting with `uCurrent`. Off at night.
- **God rays**: instanced additive quads from the ceiling, tilted by `uSunDir`, soft gradient, faded by
  distance, sway slowly; high quality adds a screen-space radial pass from the sun's projected point.
- **Outline**: thin depth/normal edge pass, tinted `profond` at 40 %, fades with distance (high/medium).
- **Painterly** (high): light Kuwahara (radius 2) on the far field only, plus a subtle paper grain.
- **Bloom**: soft, threshold high; lit windows, vent core, bioluminescence, Snell's window.
- **Sun cycle**: azimuth east→west across the day, elevation peak 70°, **clamped to ≥ 25°** for
  underwater light (refraction). Dawn 05-07, jour 07-17, crépuscule 17-19:30, nuit 19:30-05.
  Night: sun replaced by a cool moon `#9FB8E8` at 25 %, bioluminescence on.
- **Indoors**: lamps dominate (warm pools, `lampe`, soft falloff, cel-stepped like the sun), cool sea
  light enters only through portholes and the big window (blue-green cones, sun shafts when the sun is
  high), so every room reads warm-inside / cool-outside. Haze still applies (it is what makes the sea seen
  through glass look deep), but at room distances it is invisible on interior surfaces. Dust motes in
  lamp light, steam in the kitchen, a slight bloom on lamps. Clutter everywhere: nets, jars, laundry,
  drawings, patched cushions, cups. Nothing new, everything repaired.

### 5.3 Haze (atmospheric perspective)

In every material (via `cel`/`patchWater`):

```glsl
float d = length(vWorldPos - cameraPosition);
float hz = 1.0 - exp(-pow(d / uHazeDist, 1.35));
hz = min(hz, uHazeMax);                       // 0.93: far silhouettes never vanish (triangle rule)
vec3 v = normalize(vWorldPos - cameraPosition);
float up = clamp(v.y * 0.5 + 0.5, 0.0, 1.0);
float depth01 = clamp(vWorldPos.y / 120.0, 0.0, 1.0);
vec3 hazeCol = mix(uAbysse, uMilieu, smoothstep(0.0, 0.55, up));
hazeCol = mix(hazeCol, uClair, smoothstep(0.45, 1.0, 0.6 * up + 0.4 * depth01));
hazeCol += uSunColor * pow(max(dot(v, uSunDir), 0.0), 6.0) * 0.35;
color.rgb *= mix(vec3(1.0), vec3(0.88, 0.97, 1.0), hz);   // mild red absorption, NOT murk
color.rgb = mix(color.rgb, hazeCol, hz);
```

`uHazeDist` from diegetic visibility: 30 m → 170, 60 m → 280, 90 m → 400, « beaucoup » → 620.
Plankton bloom multiplies it by 0.6 and adds green-gold. Layering: near = full colour, mid = slightly
desaturated toward `milieu`, far = flat silhouettes in `clair`. That staircase is the money shot.

### 5.4 The reference vista (pose `vista`)

The first thing the player sees after the Sonde du Promontoire, and the title screen.

- Time **06:30**, day 1, act 1, visibility forecast « beaucoup » for this shot (`uHazeDist` 620).
- Hero at **(−260, heightAt, 760)**, on the Crête de l'Aube (ridge top y ≈ 38), facing yaw toward NE (~45°).
- Camera: 5 m behind and 1.2 m above the hero, slightly to the right, looking NE, FOV 55, slight downward tilt
  to the valley. Hero ≈ 1/8 of frame height, lower-left third, scarf trailing to the left in the current.
- Foreground: grass on the ridge swaying, a few coral tufts, caustics on sand.
- Midground: grass valley with gust waves, kelp clumps, a school of fish crossing.
- Background, left to right: **Le Pilier** (bearing ~20°, 800 m), **Le Drift** (bearing ~55°, ~420 m,
  warm lit windows, right-centre), **le panache** (bearing ~70°, ~1150 m, right edge, glowing base, to the ceiling).
- North horizon: the pale glow of Le Blanc.
- Sun from the east, low: warm shafts slant from upper right; warm rim on the hero's right edge.
- Ceiling visible at the top of the frame with Snell's window.

Other poses: `drift-vitre` (outside the big window at breakfast), `laminaires` (inside the forest at
noon), `cheminee` (at the vent base looking up the plume), `blanc` (Le Blanc at noon, ceiling close),
`plafond` (looking straight up at the ceiling), `heros` (close-up of Ilo, idle).

### 5.5 The hero: Ilo

- Young (~16), 1.65 m, stylised proportions (head 1/6 of height), dark hair in a knot, diving goggles on
  the forehead, sleeveless indigo tunic over a wetsuit, brass weight belt (the lest), soft boots.
- **Scarf**: coral, 1.6 m, verlet chain of 12 points, driven by velocity + `currentAt`; trails like Link's tunic.
- **Scrubber** on the back: long handle, round brass head with bristles; in hand when scrubbing.
- Built in code from primitives on a skinned skeleton (no downloaded model needed).
- Animations (procedural or keyframed in code), blended with a state machine:
  `idle` (breathing, scarf float), `walk`, `run`, `swim`, `swim-sprint`, `kick`, `sink`, `land`,
  `climb` (hand over hand), `climb-idle`, `climb-jump`, `glide` (arms up holding the voile),
  `scrub` (circular arm), `ride`, `exhausted` (slumped, slow), `talk`, `hand-on-ceiling` (ending).
  Indoors: `walk-dry`, `run-dry` (heavier gait, gravity), `stairs-up`/`stairs-down` (foot IK on steps),
  `ladder` / `ladder-top`, `fall`, `land-dry`, `shake-off` (after the sas), `sit-down` / `sit` / `eat` /
  `stand-up`, `lean` (chart table, sill), `open-hatch` (spin the wheel), `lie-down` / `sleep` / `wake`.
- Scarf in air: same verlet chain with gravity and no buoyancy, so it hangs and swings; heavy and dark
  while `wetness > 0.5`, lifts back to its water behaviour through the sas. Drips: small particles from
  scarf and hair, rate ∝ wetness. Footprints: decals at each `hero:step` while wetness > 0.1.

### 5.6 Other models

- Drift hulls: rounded keel boats and barrel hulls, rusted plating, brass portholes, ropes between hulls,
  lanterns. Windows glow warm; you see people eating behind the big window.
- La Chose (a bird, never named): wings far too wide seen from below, layered feathers "like a book",
  one eye, comes through the ceiling with a burst of rings and bubbles.
- Kelp: golden ribbons with float bladders; grass: thick soft blades with lighter tips.

---

## 6. Controls

| Action | Clavier + souris | Manette |
|---|---|---|
| Se déplacer | ZQSD / WASD (same physical keys) | Stick gauche |
| Caméra | Souris (pointer lock on click) | Stick droit |
| Monter / sauter / s'agripper / ouvrir la voile | Espace | A (bas) |
| Descendre / lâcher | Ctrl | B (droite) |
| Sprint | Maj | LT |
| Interagir / parler | E | X (gauche) |
| Frotter | F | Y (haut) |
| Siffler la raie | R | Croix bas |
| Carte | M | Select |
| Inventaire | Tab | RB |
| Recentrer la caméra | clic milieu | R3 |
| Pause | Échap | Start |

Movement and tuning (`src/core/tuning.ts`, owned by core, numbers from here):

| | Value |
|---|---|
| Walk / run on the floor | 2.2 / 4.5 m/s |
| Swim / sprint swim | 3.0 / 6.0 m/s |
| Sink (lest on) terminal | 1.4 m/s |
| Kick impulse (Espace in water) | +4.5 m/s up, cost 0.06 |
| Descend (Ctrl) | 3.0 m/s |
| Climb speed | 1.4 m/s, cost 0.08/s moving, 0.02/s hanging |
| Climb jump | 2.5 m, cost 0.18 |
| Voile | 7 m/s forward, sink 0.5 m/s, cost 0.04/s; rides updrafts and lanes |
| Sprint | cost 0.12/s swim, 0.10/s floor |
| Souffle regen | 0.35/s after 0.8 s without spending; inside a bubble column 1.0/s |
| Exhausted | regen to full before acting again; speeds ×0.5; letting go of walls |
| Strong current | climbing cost ×1.5 and slow slip down (BotW rain) |
| Base souffle | 1.0 wheel; +0.2 per 4 nacres |

Auto-grab: moving into a climbable surface while not grounded grabs it; Espace also grabs.
Espace while sinking with the voile owned opens it; Espace again or Ctrl closes it.

Indoors (`medium === 'air'`, souffle wheel hidden and full; no kick, sink, swim or voile):

| | Value |
|---|---|
| Walk / run | 1.6 / 3.8 m/s (Maj = run, no souffle cost) |
| Gravity | −9.81 m/s², small hop on Espace (0.45 m) |
| Step height (KCC autostep) | 0.35 m; max slope 40° |
| Ladder | 1.2 m/s, Espace at top = climb over, Ctrl = let go |
| Doors | E opens/closes a hatch (0.8 s wheel spin); plain passages are open |
| Sit / lean / sleep | E on a seat, chart table or bunk; Ctrl or any move stands up |
| Wetness dry-out | 1 → 0 in 120 real s |

Camera indoors (the tight-space BotW camera): pivot 1.55 m, default distance **3.0 m** (min 0.6, when
nearer than that switch to an over-the-shoulder offset 0.35 m right), FOV 60, pitch −50°…+60°.
Collision by **sphere cast** (radius 0.25): pull-in instantly, ease back out at 1.5 m/s. Camera height
clamped to `roomCeilingAt − 0.2`. Any mesh flagged `fadeable` (pillars, hanging laundry, NPCs, lamps)
between camera and hero dithers to 25 % opacity (screen-door dither, no sorting). Passing through the sas
lerps all camera parameters over 1 s. Seated/leaning/sleep use `setCameraPose` framings (chart table:
over the shoulder, looking down at the paper). Recentre puts the camera behind the hero, clamped by walls.

Camera (BotW, outside): orbit around a pivot 1.5 m above the hero; distance 6 m (4 when close to walls, 9 when
gliding or riding); pitch −70°…+80°; FOV 55 (62 when sprinting/gliding); collision by raycast with
1.5 m/s ease-out; no auto-recenter while the player moves the camera within 2 s; `recenter` puts it
behind the hero. Free look when climbing.

---

## 7. HUD and UI (French)

BotW minimal: by default the screen shows **nothing** but the world.

- **Roue de souffle** next to the hero's head (screen-projected), only while not full (fades 1 s after full).
  Segments per wheel, `souffle` colour, `souffle-bas` under 25 %, `accent` and pulsing when exhausted.
- **Bas droite** (toggle in settings, default on): small round mini-chart, time-of-day glyph,
  « Vis. 30 m », current arrow.
- **Invite** bottom centre when something is interactable: « [E] Parler », « [F] Frotter », « [E] Activer la sonde ».
  Indoors: « [E] Entrer dans le sas », « [E] Sortir », « [E] Ouvrir », « [E] Fermer », « [E] S'asseoir »,
  « [E] Monter », « [E] Se pencher sur la carte », « [E] Dormir », « [E] Regarder l'étal ».
- **Nom du lieu** on entering a room for the first time each day, BotW-style, centred, fades after 2 s:
  « Le Réfectoire », « La Cuisine », « Le Rebord », « La Salle des Cartes », « Ta cabine », « Le Marché ».
- **Dormir** menu: « Dormir jusqu'à l'aube », « Dormir jusqu'à midi », « Dormir jusqu'au soir », « Annuler ».
- **Toast** top-left on quest step, fades after 4 s: « Nouvelle tâche : Frotter la grande vitre ».
- **Carte (M)**: grandfather's chart on paper, hand-drawn contour lines, the worn groove of the route,
  white where unmeasured; sondes animate line drawing; the Drift icon moves; « Revenir à l'écluse ».
- **Inventaire (Tab)**: tabs « Outils », « Ingrédients », « Plats », « Trouvailles ».
- **Dialogue**: bottom box, name above, text types in, « E » to continue.
- **Tableau des prévisions** (lock): « Visibilité 30 m · Courant du sud · Risque de méduses ».
- Pause: « Reprendre », « Revenir à l'écluse », « Réglages », « Commandes ».
- Font: system stack `ui-rounded, "SF Pro Rounded", system-ui, sans-serif` (no web font download).

All UI and quest strings live in `src/gameplay/text/fr.ts`; ambient NPC chatter lives in `src/drift/text.ts`.
No English in the UI.

---

## 8. Day, weather, wonders

- Time: 1 game hour = 60 real seconds (day = 24 min). Start: day 1, 06:00, in the bunk in `cabine` (medium air, dry).
- **La Chose** dives at **07:00 and 17:30** each day (act 1: day 1 07:00 is scripted near the Drift).
  Rings on the ceiling (`ceiling:ripple`), a fish taken, music cue `wonder`.
- Forecast changes every morning at 06:00 (gameplay): visibility by act (act 1: 30; act 2: 60 → 90 →
  « beaucoup » as the Drift goes north; act 3: « beaucoup »), current direction, jellyfish risk, bloom.
- Jellyfish swarms: 20 % of days in act 2, mostly at night, attracted by the lantern.
- Nuit de plancton every 5th night.
- Whale passes every ~2 game days in the south and centre; song heard far away.
- Rain: act 3 from `a3-pluie`, then post-game 15 % of days.

## 9. Music and sound

Generative WebAudio, no samples needed. Mostly silence; short piano-like FM phrases (pentatonic,
D major / B minor), soft pads under water, whale song. `AudioContext` can only start after a user
gesture: unlock on the first click/key.

| Cue | When |
|---|---|
| `explore` | Sparse phrases every 20-60 s, silence in between |
| `drift` | Near the Drift: warm tune, muffled clapping game melody |
| `sonde` | Stinger on activation, then vista swell |
| `shallow` | Inside a haut-fond: minimal, rhythmic, curious |
| `danger` | Jellyfish nearby |
| `night` / plankton | Celesta and glass |
| `wonder` | La Chose |
| `rain` | Finale: the clapping game melody, slow, full |

SFX: bubbles, kick, scrub (squeak on glass), lock, rope creak, hull groan, fish flutter, vent rumble,
ceiling rings (soft drip), rain on the surface heard from below, footsteps on sand.
Indoors: the sea becomes a low-passed rumble through the hull, creaks every 8-20 s and a groan on turns,
pumps and hatch clang in the sas, drips, wet then dry footsteps on wood/metal (`hero:step`), crockery and
murmur in the refectory, the clapping game on the sill heard clearly (the `drift` cue, unmuffled).

## 10. Debug hooks (core, `window.__game`)

```ts
interface DebugApi {
  state: GameState
  ready: Promise<void>
  teleport(x: number, y: number, z: number): void
  setAct(n: Act): void                      // consistent state, see §3
  setTime(h: number): void
  giveItem(id: string, n?: number): void
  setWeather(env: Partial<EnvState>): void
  setQuality(q: QualityLevel): void
  pause(p: boolean): void
  step(frames: number): Promise<void>       // advance N frames while paused
  screenshotPose(name: string): Promise<string>   // PNG data URL
  poses(): string[]
  stats(): { fps: number; drawCalls: number; triangles: number }
  enterRoom(room: RoomId): void             // dry, in air, at roomSpawn(room)
}
```

`screenshotPose` sets hour, hero and camera from the registry (`state.debug.cameraLocked = true`, the
hero's camera must respect it), waits 2 frames for streaming/shaders, renders and reads the canvas in the
same tick as the render (the default drawing buffer is cleared after compositing). Poses predefined in
core: `vista`, `drift-vitre`, `laminaires`, `cheminee`, `blanc`, `plafond`, `heros`; other folders may
`registerPose` more (drift registers `sas`, `refectoire`, `rebord`, `salle-des-cartes`, `cabine`,
`marche`, and `refectoire-vitre`: from a bench toward the big window, sea and fish visible). URL params:
`?debug` (overlay), `?pose=vista`, `?act=2`, `?t=17.5`, `?q=low`, `?nosave`, `?room=refectoire`.

## 11. Working rules for builders

- Only your folder. `npm run typecheck` must pass before you commit.
- Commits: Conventional Commits with the folder as scope (`feat(flora): …`), no AI attribution trailer.
  Stage only your own paths. If `.git/index.lock` exists, wait a few seconds and retry.
- Never leave a dev server, vite or a browser running when you finish.
- Downloaded assets: CC0 only, one line in `assets/CREDITS.md`.
- When this bible needs a change, say so in your final report; do not silently diverge.
