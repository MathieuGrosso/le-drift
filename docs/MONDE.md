# Le Drift — Le Monde (procedural districts)

Owner's ask: « lance des experts graphisme pour vraiment améliorer le monde, l'agrandir, avoir des
moteurs procéduraux ; le but c'est pas d'avoir fait le tour en 2 minutes, fais-le en longueur ».

Today the walkable Drift is the hand-made core (the Écluse quarter, La Nef, the market, the Serres,
the Ateliers, the Coques Scellées, La Proue, the Hauts tube, the dômes): about 260 × 160 m that you
cross in minutes. This file is the plan to make the Drift feel like 400 hulls: hours of exploration,
something to see every 30 s, a wonder every 5 min, Ghibli warmth, never the same street twice.

`BIBLE.md` stays the rulebook (chemistry, decks, colliders, palette, budgets, French text). This file
adds the procedural world and wins on everything it states about `src/procgen/`. Changes to the
bible it implies are listed in §8.

---

## 1. Scale target

### 1.1 Shape of the ship

The hand-made core becomes **Le Cœur** (the 9 bible districts, unchanged). Around it the generator
adds **27 arrondissements** in two wings and two stern arms, for **36 districts** in total. The arms
wrap an open-water courtyard behind the Grande Vitre, **La Baie du Sillage**: the refectory's window
keeps its open sea, now framed by two arms of lit hulls (a harbour at night, the wake in the middle).

Drift-local frame `L` as in the bible: −z = prow, +x = tribord, +y up, 1 unit = 1 m. Upper layer
(`haut`) shown; the keel layer (`bas`) is listed under it. Authored in `src/procgen/ship.ts`.

```
  z      C (−430..−330)   B (−330..−230)  A (−230..−130)     core / baie      A (130..230)    B (230..330)    C (330..430)
 −200 R0 ·              │ vigies-babord ─────────────── │                  │ vigies-tribord ──────────────── │ ·
  −80 R1 lavoirs        │ corderie ──────────────────── │   LE CŒUR        │ laminaires ──────────────────── │ berceaux
   40 R2 séchoirs ───────────────── │ bazar           │   (z −80..80)    │ potagers       │ bibliothèque   │ théâtre
  160 R3 forges ─────────────────── │ fourneaux       │                  │ hamacs         │ viviers ─────────────────
  280 R4 le noyé ────────────────── │ dortoirs        │   LA BAIE DU     │ quai-des-lampes│ serres-sauvages ─────────
  400 R5 ·              │ épaves         │ quais           │   SILLAGE        │ belvédère      │ fumoir         │ ·
  520                                                    (open water)
  keel layer (y −24..−6):  citernes = bâbord A+B, R1-R2 · chapelle = bâbord A+B, R3-R4
                           cathédrale = tribord A+B, R1-R2 · ballasts = tribord A+B, R3-R4
```

| Band | x (bâbord / tribord) | Role |
|---|---|---|
| Column A (inner) | ∓130 … ∓230 | **La Grand-Rue** (deck principal, y 0) runs bow → stern through every A district; faces the core or the baie |
| Column B (middle) | ∓230 … ∓330 | **Le Rail de Quille** (deck cale, y −22) runs under it: the wagonnet line with stations |
| Column C (outer) | ∓330 … ∓430 | The outer skin: big windows on the open sea; **Les Hauts** glass tube (toits, y 16-24) runs along its roofs |
| Layer `haut` | y −6 … 30 | Upper arrondissements (decks bas → dômes) |
| Layer `bas` | y −24 … −6 | Keel arrondissements stacked under some upper ones (cisterns, chapel, engine cathedral) |

Footprint: x ∈ [−430, 430], z ∈ [−200, 520], y ∈ [−24, 30] (the deck range of the bible, unchanged:
the seabed clearance rules of §2.7-2.8 hold). The baie is x ∈ [−130, 130], z ∈ [80, 520]: no hull,
no floor, only water, the wake and **La Passerelle de la Baie** (§1.3).

### 1.2 Travel times (the "en longueur" contract)

Average effective speed indoors, mixing walk, run, stairs and climbs: **2 m/s**. Path tortuosity
(path length / straight line) inside a district: **1.6-2.0** (enforced by layout, §3.2).

| Trip | Straight | Path | On foot | Fastest once unlocked |
|---|---|---|---|---|
| Cross one arrondissement | 100-120 m | 180-240 m | **2-4 min** (exploring all decks: 15-25 min) | zip line or toboggan: 30 s |
| One wing, bow → stern (Grand-Rue) | 720 m | ~1.1 km | **9-10 min** | wagonnet on the keel rail: 2 min |
| Bâbord stern arm → tribord stern arm (around the baie, through the core) | ~1.4 km | ~2.4 km | **20-25 min** | Passerelle de la Baie: 4 min; tube: 3 s ride |
| Prow (Salle des Cartes) → a stern arm tip | ~650 m | ~1.2 km | **10-12 min** | tube + zip: 3 min |

The core stays the hub: every long trip crosses it or the baie, so the familiar places keep being seen.

### 1.3 Verticality and shortcuts unlocked over time

- **Always open** (once the wings open in act 2): the Grand-Rue, stairs, ladders, nets, pipes.
- **Opened from the far side** (BotW): one-way doors, ladders to kick down, ropes to drop, a lift
  counterweight to release. Every arrondissement has at least one, so a first crossing is long and the
  way back is short. Layout marks them `Unlock.fromSide`.
- **Opened by a phare de veille** (§3.4): the district's tube station and its wagonnet stop.
- **Story / items**: the toile opens the steam-updraft routes; act 2's ballast empties and opens the
  flooded lower links; **La Passerelle de la Baie** (a glazed tube 260 m long across the baie at y 16,
  lamps every 8 m, the far frame of the Grande Vitre view) opens when 3 phares are lit.
- Fast travel remains the bible's: tube stations once unlocked, « Retour à la cabine » always.

---

## 2. Archetypes

Each arrondissement has one archetype (identity) and a plan shape (§3.2). Data lives in
`src/procgen/archetypes.ts` (identity) and `src/procgen/ship.ts` (the 27 instances; 8 archetypes
appear twice and `observatoires` three times). Two instances of
one archetype never share a landmark, a palette shift or a plan shape variant.

Palette tokens are the bible's (§5.1); hexes below are the archetype accent and light. Lamp light is
always warm; the cool light is always the sea through glass. No archetype is murky.

| Archetype | Nom | Plan | Palette / light mood | Sounds | Materials · typical props | NPC jobs | Landmarks (seen from afar) |
|---|---|---|---|---|---|---|---|
| `observatoires` | Les Vigies | `grappe` | Cool morning: brass and cream, big glass, `vitre-mer` dominant, lamp `#FFD9A0` | wind-like hum, ticking, page turns | laiton, verre, bois · lunettes, charts pinned, stools, star-less "maps of reflections" | guetteuse, cartographe, apprenti | **La Grande Lunette** (a 20 m brass telescope through a dome), **L'Œil du Plafond** (a dome staring straight up at Snell's window), **La Lanterne de Poupe** (the stern belvédère's lamp over the wake) |
| `corderie` | La Corderie | `nef-longue` | Long warm hall, hemp gold `#C9A66B`, dust motes in shafts | creak of twisting, a call-and-response work song | corde, bois · rope walks, spools, hooks, hanging coils, tar pots | cordière, fileur, enfant-coursier | **La Corderie de cent mètres** (one straight hall, the longest sightline in the ship), **Le Rouet géant** |
| `lavoirs` | Les Lavoirs | `terrasses` | Steam and white linen, soft pastel `#E9DCC2`, haze 0.5 | splashing, wringing, laughter, hiss of steam | carrelage, cuivre, toile · basins, washboards, lines of laundry in every void | lavandière, chauffeur de chaudière | **La Cascade des Lavoirs** (steam falls from boiler pipes down three tiers), **La Forêt de Draps** |
| `sechoirs` | Les Séchoirs | `terrasses` | Silver and salt, cool light on fish, warm racks `#B07A4F` | drips, cats, wooden racks knocking | bois, filet, sel · drying racks, salt barrels, cats on every rail | saleuse, chat (many), trieur | **Le Rideau d'Argent** (thousands of drying fish catching window light), **La Tour aux Chats** |
| `bazar` | Le Bazar des Repêchés | `rue` | Saturated but small: bunting `#D8644E`, lamps of every colour | haggling, music box, bells | laiton, rouille, toile · stalls of salvaged things, jars, clocks, umbrellas nobody understands | brocanteuse, réparateur, conteur | **L'Arbre aux Lanternes** (a tree welded from salvaged lamps), **La Coque Retournée** (a hull upside down, its keel a roof) |
| `fourneaux` | Les Fourneaux | `rue` | Orange-gold kitchen light `#FF9E5E`, steam from pots | sizzling, ladles, the dinner bell | cuivre, brique, bois · stoves, smoke hoods, hanging fish, long tables | cuisinière, fumeur de poisson, plongeur | **La Cheminée Tressée** (braided copper flues rising 30 m), **La Table de Cent Couverts** |
| `forges` | Les Forges de Coque | `atrium` | Dark plum shadows, white-hot accents `#E08A4E`, sparks | hammering in rhythm, hiss of quench | fer, rouille, laiton · anvils, hull plates, rivet buckets, welding masks | forgeronne, riveteur, souffleur | **Le Marteau-Pilon** (a two-storey steam hammer), **La Fontaine d'Étincelles** |
| `dortoirs` | Les Coques-Dortoirs | `grappe` | Night blue `#3E3A5A` with hundreds of small warm windows, lullaby calm | snoring, whispered talk, a music box | tissu, bois · bunks, curtains, hammocks, slippers, drawings | veilleur, mère, enfant | **Le Mur des Mille Hublots** (a wall of lit bunk portholes), **La Voûte aux Hamacs** |
| `noye` | Le Vieux Quartier Noyé | `archipel` | Teal shadows `#4F6D7A`, water caustics on ceilings, a few squatters' lamps | drips, echo, a bell moved by the swell | rouille, pierre, verre · half-sunk furniture, rafts, rope bridges | squatteur, plongeuse, ermite | **Le Clocher Englouti** (a bell tower half under water), **La Rue sous l'Eau** (a street seen through a flooded glass floor) |
| `quais` | Les Quais | `archipel` | Evening gold on water, nets, the baie through huge glass | nets hauled, winches, water lapping | bois, filet, laiton · cranes, moon pools, crates of fish, buoys | pêcheur, grutière, mousse | **Les Grues à Filets** (cranes lowering nets through a moon pool), **Le Phare de la Baie** (the arm's lamp, seen from the Grande Vitre) |
| `citernes` | Les Citernes de Lest | `puits` | Cool and dim, round tanks, one warm lamp per stair | deep sloshing, valves, a long echo | métal, rivets · tanks, valves, gauges, ladders, catwalks | vannier, plongeur de citerne | **La Citerne Cathédrale** (a drained tank you climb inside on a spiral), **La Vanne Maîtresse** |
| `chapelle` | La Chapelle de Quille | `puits` | Candle warm `#FFC27A` against sea-green floor glass, still | silence, a steam organ, drips | pierre, verre, bois · benches, candles, ex-votos of fish, hanging lamps | gardienne, organiste | **Le Vitrail de Quille** (a glass floor ring looking down at the sea floor), **L'Orgue à Vapeur** |
| `laminaires` | La Forêt sous Verre | `atrium` | Green-gold `#B9D98A`, light from above, humid haze 0.4 | dripping, pumps, rustle of fronds | verre, bois, eau · kelp beds, channels, stepping stones, lamps on poles | jardinière, porteur d'eau | **Le Laminaire-Mère** (a 40 m kelp stalk in a glass cylinder), **La Serre Effondrée** (variant) |
| `nurserie` | Les Coques-Berceaux | `grappe` | Pastel cream and coral `#E8674A`, soft round lamps | children, a mobile tinkling, lullabies | tissu, bois · cradles, toys, chalk drawings, nets for climbing | nourrice, maîtresse, enfants | **Le Mobile des Berceaux** (a huge fish mobile in the atrium), **Le Toboggan Spirale** |
| `potagers` | Les Potagers à Lampes | `terrasses` | Lamp-grown greens under warm grow-lamps, terracotta | trickling water, a waterwheel, hoes | terre, bois, cuivre · planters, lamp poles, watering cans, sacks | maraîcher, porteuse d'eau | **La Roue à Eau** (a waterwheel driving the lamp shades), **Les Jardins Suspendus** |
| `bibliotheque` | La Coque-Bibliothèque | `puits` | Deep wood `#5E4A5C`, green reading lamps, dust | page turns, a cough, ladders rolling | bois, papier, laiton · shelves, logbooks, rolling ladders, reading nooks | archiviste, lecteur, copiste | **L'Escalier des Journaux de Bord** (a 30 m spiral of shelves holding every logbook since the Drift began) |
| `theatre` | Le Théâtre d'Ombres | `atrium` | Dark house, one glowing screen, footlights | murmurs, puppet clacks, applause at 20:00 | toile, bois, velours · benches, puppets, painted flats | marionnettiste, souffleur, public | **Le Grand Écran** (a shadow screen with the sea glowing behind it) |
| `viviers` | Les Viviers | `archipel` | Aquarium blue-green glow, warm walkways | bubbling, pumps, fish tapping glass | verre, cuivre · tanks, nets, feeding scoops, tubs | soigneuse, éleveur | **Le Vivier Rond** (a ring tank you walk under, fish overhead) |
| `cathedrale` | La Cathédrale des Machines | `puits` | Machine orange `#E08A4E` from below, brass, steam updrafts | deep thump, hiss, a choir of pistons | laiton, fer, vapeur · pistons, flywheels, gauges, catwalks | mécanicienne, graisseur, chauffeur | **Le Grand Volant** (a 25 m flywheel), **Les Orgues de Pression** |

Hourly events (content owns, one or two per archetype, staggered so a wonder plays somewhere near
every ~5 min): the corderie twists a hawser at 10:00, the forges pour at 14:00, the lavoirs release
steam on the hour, the theatre plays at 20:00, the quais haul nets at 06:30 and 18:00, the chapel
organ at 19:00, the viviers feed at 08:00, the dortoirs light their thousand windows at 21:00.

---

## 3. Procedural engines

Four engines, all **deterministic from `(SEED, MONDE_VERSION, district id)`** and split into pure-data
stages (no three.js, no rapier, safe to run on the server) and build stages (geometry, colliders).

```
planShip()           ship.ts       pure   all 27 plans at boot (< 2 ms)
massing(plan)        layout        pure   hull capsules only, all districts at boot → far silhouette
layout(plan)         layout        pure   job (sliced): cells, floors, links, windows, slots, walk graph
buildLayout(shell)   layout        build  job: structure meshes, glass, colliders on one kinematic body
bakeNav(shell)       layout        build  async: per-district navmesh (worker), off-mesh links
dress(shell)         dressing      build  job: props, lamps, plants, cloth, VFX emitters
populate(plan,shell) content       pure   landmarks, content points, chart entries, events
buildContent(...)    content       build  job: landmark kits, trouvaille meshes, triggers
```

Jobs are `Generator<void, T>`: the streamer resumes them until the frame budget is spent (§4.4).

### 3.1 Ship planner (`ship.ts`, architect, hand-authored)

The macro layout is **authored, not random**: the 27 arrondissements, their archetype, slot,
parent quartier, landmark kits and the long links are a table (BotW's map is designed; the generator
fills the streets). `planShip()` derives from it: bounds, seeds, the **ports** on every shared
boundary (position, deck, kind) so two neighbours agree on their connection without loading each other,
and the spine links (Grand-Rue, Rail de Quille, Hauts tube, Passerelle de la Baie, links to the core).

Two gates join the core on foot, on deck principal (y 0): ateliers x −130 z −30 (corderie) and
scellées x 130 z −30 (laminaires). They open in the end wall of each hall (drift's `HallDef.openings`)
and a glazed passage (`src/procgen/liaisons`) crosses the 6 m gap to the arrondissement's port. The
marché and serres outer walls are hull rows (shrines and homes behind every opening), so the bazar and
the potagers are reached through their wing, not from the core. Gate z sits on a layout cell centre.

Tubes complete the network: four booths in the Nef hub (`tube-nef-quais`, `-forges`, `-viviers`,
`-fumoir`) ride to the far districts, and every arrondissement has a return booth beside its main
entrance (`tube-<district>-nef`). The destination is built before the ride and held until arrival.

### 3.2 Layout engine (`src/procgen/layout`)

Per district, from its plan:

1. **Plan shape** chooses the skeleton:
   - `rue`: one or two streets of hulls along z (yaw jitter ≤ 3°), stalls opening onto the street.
   - `atrium`: hulls ringed around a void 20-35 m tall, gangways at every deck crossing it.
   - `nef-longue`: one long straight hall (the corderie: 100 m) with side hulls.
   - `grappe`: small hulls stacked in a vertical cluster round a stair core, nets between them.
   - `puits`: a vertical shaft down the keel layer, catwalks spiralling, rooms off it.
   - `archipel`: hulls standing in water (the noyé, the quais, the viviers), linked by bridges and rafts.
   - `terrasses`: stepped decks descending toward the outer windows.
2. **Voids first**: place the atrium/shaft/hall void(s) and the main **vista frames** (where the
   district's landmark and a neighbour's landmark are seen). Every district has ≥ 1 void ≥ 20 m tall
   and ≥ 3 openings framing a landmark (bible §2.5 triangle rule).
3. **Hulls** in the bible's size classes only: `quille` 18/24/32 m, `tonneau` 10/14 m, `capsule`
   8-16 m, `ellipsoide` for domes. Rows, not heaps (bible §5.6). Hull count 8-14 per district.
4. **Decks**: hull floors snap to the bible's deck heights (`cale` −22, `machines` −14, `bas` −6,
   `principal` 0, `haut` 8, `toits` 16, `domes` 22+), mezzanines at +4.
5. **Cells**: each hull interior is cut into cells from the archetype's room program (e.g. lavoirs:
   basin hall, boiler room, drying loft, linen store). Generated cells obey bible §2.4 (bounds, floor,
   lamps, windows, NPC anchors, portals).
6. **Walk graph**: doors and gangways between cells; spanning tree + **30 % extra loops** so every
   place has two ways in; main path = the Grand-Rue/port-to-port route; tortuosity 1.6-2.0 by bending
   the main path through voids and across decks.
7. **Vertical links** on the graph: stairs on the main path, ladders/nets/pipes/ribs on alternates,
   one toboggan down and one zip line across the void per district, one lift per `puits`.
8. **Windows** on the outer skin (column C, the baie side, the bow): portholes in rows (rhythm),
   one big baie window per district facing the open sea or the baie. Glass is `render.glass()`.
9. **Colliders**: cuboids only (bible §4.3: trimesh floors snag the KCC); curved hull walls are 4-8
   rotated cuboids. One kinematic body per district moved by the Drift pose like `City`.
10. **Navmesh**: one tiled navmesh per district (`NAV` tuning), baked from its body in a worker after
    build, off-mesh links for ladders/zips/toboggans. Cross-district paths go port to port (a district
    graph), never one ship-wide navmesh.
11. **Validation** (debug and CI): every port reaches every other port and every content point; no fall
    over 8 m without a net; no cell under 2.2 m headroom on a path. A district that fails re-plans with
    the next variant seed (deterministic: `seed + k`, k ≤ 3), and the failure is logged.

Outputs: `DistrictShell` (types.ts) with **dressing slots** (typed wall runs, floor patches, ceiling
spans, corners, rails, sills, stall fronts, beds, workbenches) and the walk graph content uses.

### 3.3 Dressing engine (`src/procgen/dressing`)

Grammar of **clusters on slots**: a recipe per archetype maps slot kinds to weighted clusters
(a cluster = props placed relative to each other: "linge" = a sagging line + 6-10 cloth quads + a
basket; "étal" = counter, awning, 6-12 goods, a stool, a lamp). Rules:

- Density by slot weight and path proximity: dense along the main path and around voids, sparse in
  back rooms (a clean read of the walkable route). No slot on the path's 1.4 m walking width.
- Colour: the archetype palette with a per-district hue/value shift (±8° hue, ±6 % value) so two
  lavoirs never match. Few strong colours per view (ART §0.8): accents only on cloth, doors, signs.
- Materials: drift's `Mats.cel({ indoor: true })` and the glow bake of `city/glow.ts` style (vertex-baked
  lamp light), Kenney CC0 props from `assets/props`, new CC0 imports recorded in `assets/CREDITS.md`.
- Lamps: 1-3 live lamps per cell for `uLamps`, the rest baked into vertex colour. Light mood from the
  archetype (warm lamp key, cool glass fill, air haze per void).
- Plants, cloth, laundry, bunting, nets, cats, steam, motes, drips, sparks: one instanced mesh or one
  points cloud per kind per district; VFX are emitters (data) a single per-district shader animates.
- Budget per built district (high): ≤ 25 draws, ≤ 120 k triangles, ≤ 6 MB GPU.

### 3.4 Content engine (`src/procgen/content`)

- **Landmark kits**: hand-authored functions (`kit(builder, at, rng)`) for each landmark of §2, with
  their anchors (ladders, zips, seats, lunettes) and a far LOD (a few hundred triangles + glow) drawn
  with the silhouette so they peek over everything (triangle rule).
- **Distribution with BotW pacing** along the district's walk graph (arc length on the main path, then
  the loops): a **petit** beat every 25-40 m (trouvaille, window vista, NPC vignette, réchaud, bench,
  sign, cat), a **moyen** beat every ~120 m (coque scellée entrance, side-request NPC, shortcut to open,
  hammock), a **grand** beat every ~5 min of walking (landmark, hourly wonder, vista over a void).
  Poisson spacing, category round-robin weighted by archetype, never two of a kind in a row.
- **Phares de veille**: 6 new map towers, 3 per wing (bâbord: `vigies-babord`, `sechoirs`, `quais-babord`;
  tribord: `vigies-tribord`, `bibliotheque`, `belvedere`). Climbing one reveals its wing third on the plan and
  unlocks its tube stations, exactly like a dôme.
- **Coques scellées générées**: one per arrondissement, built from one chemistry rule (bible §0.1)
  picked by archetype (lavoirs → vapeur, noyé → eau, citernes → lest, corderie → corde, viviers → faim).
- **Trouvailles**: 5-7 per arrondissement (≈150 more), ids `tr-<district>-<n>`, each with a
  micro-challenge (on a lamp reached by zip, inside a pipe, behind a hatch opened from the far side).
- **French names**: every district, landmark, cell of note, NPC and trouvaille from a seeded grammar
  (« La Rue des Cordières », « Le Bassin de Madame Pelote ») with per-archetype vocabularies; a name
  is unique ship-wide (checked against the core's names).
- **Chart entries** for grandfather's plan: district outline per deck, landmarks, stations, phares;
  revealed by phare or by visit.
- **Discovery events**: entering an arrondissement for the first time, seeing a landmark (in frustum,
  < 120 m, unoccluded ray), reaching a vista.

---

## 4. Integration contract

### 4.1 The hook (`src/drift/procgen-hook.ts`, one file, plus 4 lines in `src/drift/index.ts`)

```ts
// src/drift/index.ts
import { mountProcgen, type ProcgenSlot } from './procgen-hook'
let procgen: ProcgenSlot | null = null
procgen = mountProcgen(ctx, root, mats, () => pose, service)   // init, after ctx.services.drift = service
procgen?.update(dt, heroLocal, camLocal)                       // end of update (after city.writeLamps)
procgen?.dispose()                                             // dispose
```

`mountProcgen` lazy-loads `src/procgen` (own chunk, skipped with `?noprocgen`) and **decorates the
drift service**: `cellAt`, `roomAt`, `cellSpawn`, `ceilingAt`, `roomCeilingAt`, `anchorsNear`,
`mediumAt`, `districtAt`, `cameraEnv`, `glassPortalsVisible`, `openDoor` (procgen tube rides) fall through to procgen where the core
answers nothing, and `procgen()` exposes the `ProcgenWorld`. So hero, camera, gameplay, audio and
render need no change to walk, climb, film and light the arrondissements.

`ProcgenHost` (what drift lends): `ctx`, the Drift-local `root`, `mats`, `pose()`, `bakeNav(bodies, links)`,
and the physics collision groups. `ProcgenWorld` (what procgen gives): `update`, `cellAt`, `spawn`,
`anchorsNear`, `glassVisible`, `nav`, `ride`, `chart`, `dispose`. Both are typed in the hook file.
`chart()` returns the entries revealed so far (`toujours` once built, `visite` once walked in); gameplay's
plan canvas only covers the core (x ±130, z ±80) and does not draw them yet.

### 4.2 What procgen registers

| Thing | How |
|---|---|
| Districts | `ProcgenWorld.cellAt(l)` returns `{ id, district, quartier, deck, roof, air, glass }`; `quartier` is the parent bible `DistrictId` (net rooms, audio fallback, place toast) |
| Colliders | one kinematic body per built district, cuboids tagged with the bible's `ColliderTag`, `untag` on dispose |
| Navmesh | per-district `DriftNavmesh` via `host.bakeNav`; `ProcgenWorld.nav(district)`; crowd per district |
| Camera rooms | `roof` (ceiling clamp), `air` (haze), `glass` (sea draws) per cell → decorated `cameraEnv()` |
| Anchors | ladders, zips, tubes, slides, seats, beds, hammocks, lunettes in the bible's `Anchor` union |
| Chart | `ProcgenWorld.chart()` → `ChartEntry[]` (gameplay draws them on « Le Drift ») |
| Spawns | `spawn(cell)` and `spawn('<district>')` (its main entrance); debug `?arr=<district>` teleports there |
| Events | `procgen:entered` `{ id, nom, quartier, archetype }`, `procgen:decouverte` `{ id, nom, kind, district }`, `procgen:phare` `{ id, district }` on the bus (loose-typed until core adds them) |

### 4.3 Streaming by distance

| State | What exists | When |
|---|---|---|
| `plan` | data only | all, at boot |
| `silhouette` | all districts' hull massing as **one** instanced capsule mesh + window-card rows + landmark LODs | built once at boot (≤ 8 draws, ≤ 150 k tris total) |
| `built` | structure, glass, colliders, dressing, content meshes | hero within **60 m** of the district box; disposed beyond **120 m** (hysteresis) |
| `active` | + navmesh, crowd, live lamps, VFX, hourly events | hero's district + districts whose ports are within 40 m and in view |

Max simultaneously built: high 4, medium 3, low 2 (nearest first). Built districts hide their
silhouette instances. Build jobs run at most **2 ms per frame** (high; 1.5 / 1 on medium / low).
Dispose frees geometries, instanced buffers, the rapier body, the navmesh; shared materials stay
cached. The debug overlay (`?procgen`) prints per district: state, build ms, draws, triangles,
`renderer.info.memory.geometries` delta, colliders, nav polys. A build/dispose cycle must return
`geometries` to its previous count (leak check).

### 4.4 Seed sharing (multiplayer)

- Ship seed = core `SEED` (`0x0D21F7`), plus `MONDE_VERSION` in `src/procgen/ship.ts`. District
  seed = `mulberry32(SEED ^ hash("<version>:<district>"))`. No `Math.random` anywhere in procgen.
- Pure stages import no three.js/rapier/DOM, so the server can run `planShip` and `populate` to know
  every arrondissement, trouvaille id and quest anchor. Players join the parent quartier's room
  (`quartier` field); the arrondissement id rides in the hero snapshot's `room` (a cell id).
- Ids are stable by construction (`<district>`, `<district>/<kind>-<n>`); changing generator output
  bumps `MONDE_VERSION` and saves keep only ids that still exist.

---

## 5. Ownership split (3 parallel builders)

| Path | Owner | Contents |
|---|---|---|
| `src/procgen/types.ts`, `ship.ts`, `archetypes.ts` | **architect**, then append-only for all three | Shared types, the authored ship table, archetype identities. Adding fields/entries is free; changing an existing one needs the consumers' agreement, logged in §9 |
| `src/procgen/index.ts`, `src/procgen/layout/**` | **(a) layout** | `createProcgen` (the streamer), massing, layout, colliders, navmesh tiles, ports, validation, `layout/tuning.ts` |
| `src/procgen/dressing/**` | **(b) dressing** | Recipes per archetype, clusters, props, materials, lamps, plants, cloth, VFX emitters, `dressing/tuning.ts` |
| `src/procgen/content/**` | **(c) landmarks + content** | Landmark kits, pacing distribution, phares, generated coques scellées, trouvailles, French name grammar (`content/noms.ts`), chart entries, discovery events, `content/tuning.ts` |
| `src/drift/procgen-hook.ts` + the 4 lines in `src/drift/index.ts` | architect (drift agent informed) | The boundary; changes need the drift agent |

Contracts between builders are the function types in `types.ts`:
`MassingFn`, `LayoutFn` (a) → `DressFn` (b) and `PopulateFn` + `BuildContentFn` (c), all consuming
`DistrictShell`. (b) and (c) never read each other: content reserves its spots by emitting
`ContentSet.reserved` boxes, and the streamer passes them to dressing (`DressInput.keepOut`).
Until (a) lands real shells, (b) and (c) develop against `layout/fixture.ts` (a hand-built shell
for one district, owned by (a), delivered first).

Order of work: (a) fixture shell → (b) and (c) in parallel on it → (a) real layout for 3 archetypes
(`rue`, `atrium`, `puits`) → all three widen to every archetype → (c) pacing pass on the real walk graph.

---

## 6. Definition of done

- From the cabin, act 2: walk out through the market west gate onto the Grand-Rue de Bâbord and keep
  walking for 10 minutes without seeing the same street twice, with something new every ~30 s.
- 27 arrondissements built on demand, each with its landmark seen from ≥ 3 openings, 1 coque scellée,
  5-7 trouvailles, NPCs at work, one hourly event.
- 60 fps on M1/M2 at `high` in any arrondissement; no frame over 33 ms during streaming; memory flat
  after walking a wing and back (geometries count returns to baseline ± 2).
- Same seed → same ship on two machines (checked by hashing `planShip()` + every `populate()` output).

## 7. Measures to take

`renderer.info.render.calls/triangles`, `renderer.info.memory.geometries/textures`,
`performance.memory.usedJSHeapSize` (Chrome), build ms per stage per district, nav bake ms in the
worker, colliders per district. Logged by `?procgen`, recorded in the PR body, not in this file.

## 8. Bible changes this implies (owners to apply)

| Change | Owner |
|---|---|
| §2.1 footprint becomes x ∈ [−430, 430], z ∈ [−200, 520]; `DRIFT_BOUNDS` in `core/layout.ts` grows (drift's `inBounds` uses it) | core |
| §2.3 the 9 districts become the core; the 400 hulls = ~120 core + ~280 in arrondissements; arrondissements are sub-districts with a parent `DistrictId` | core (doc) |
| Ship exterior silhouette and sortie space cover the wings, the arms and the baie (a sortie from the Grande Vitre lands in the baie) | world, render |
| Place-name toast, phares, chart entries, generated coques and trouvailles `tr-<district>-<n>` | gameplay |
| Ambience per archetype from `procgen:entered` | audio |
| When the hero is in an arrondissement, load only its parent quartier's core district | drift |

## 9. Change log of the shared files

- v1: types, ship table (27 arrondissements, 4 core gates, 7 spines), archetypes (19), hook. Architect.
- Integration: core gates down to two (ateliers, scellées, z −30) with matching end-wall openings in
  `drift/city/world.ts`; hook adds `ride`, `chart` and the `openDoor` decoration; drift loads no core
  neighbours while the hero is in an arrondissement; content keeps its track off stair-port landings.

## 10. Integration measurements (2026-10-20)

Production build (`vite preview`), headless Chrome launched by agent-browser on the owner's Mac,
`?debug&procgen&act=2`, quality `high` unless stated. Keys are real CDP key events (`code: KeyW/KeyE`);
teleports only place Ilo and the camera before a walk.

**Reachability, walked with W held**

| Walk | Result |
|---|---|
| Ateliers hall (−110, 0, −30) → passage → corderie, and corderie → ateliers | through, `medium` stays `air`, cell `corderie/passage` in between |
| Corderie → bazar (port z 40), bazar → fourneaux (z 160), corderie → vigies-babord (z −80), bazar → séchoirs (x −230) | through, 5-6 m past each port in 6 s |
| Nef booth `tube-nef-quais`, E | arrives at the quais (−196, 0, 400.7), the far bâbord stern, 700 m from the Nef |
| Quais return booth `tube-quaisbabord-nef`, E | back in the Nef hub (0, −6, −21.6); the quais are released |

The gameplay prompt reads « Tube : quais » (gameplay shows the raw token for non-core stations) and
« Tube : La Grande Nef » on the way back. Captures: `shots/monde-integration-1..4.png`.

**Walkability audit** (`__procgen.audit(id, step)` / `auditBox`, the WALKABILITY method: hero KCC
settings, 1 m grid over the district box padded 3 m, layout links, ladders and zips followed)

| Area | Floor nodes | Linked to the entrance | Ports reached | Points missed | Stuck (40 m patch) |
|---|---|---|---|---|---|
| Corderie | 32 059 | 26 879 (84 %) | 5/5 deck-0 | 6/7 trouvailles, 1 merveille | 5 / 1 510 |
| Bazar | 15 373 | 12 568 (82 %) | 2/3 deck-0 on the grid, 3/3 walked | 5/5 trouvailles, 1 merveille | 7 / 1 518 |
| Fourneaux | 15 118 | 12 433 (82 %) | 3/3 deck-0 | 3/6 trouvailles, 1 quête, 1 vista | 7 / 1 357 |
| Gate ateliers ↔ corderie (0.6 m) | 2 128 | 1 897 | far side reached | | 4 |
| Gate scellées ↔ laminaires (0.6 m) | 2 171 | 2 099 | far side reached | | 10 (a row along a wall at z −27.4) |

The bazar → séchoirs port fails on the 1 m grid (two crates in its mouth) but Ilo walks through it
with W held at z 95.5. The unlinked nodes are roofs, stall tops and lot interiors with no stair, as in the core. Trouvailles
are micro-challenges (in a pipe, at the end of a beam, behind a hatch), so off the floor grid by
design. The missed ports are the `escalier` ports into the keel layer, checked from below. Before the
fix, a stair port's landing pulled content points into the stairwell (`quete-fourneaux-1` at y −5.7
over a 9 m drop, `fourneaux/pnj-4` 21 m above the cale); content's main track now stops before it.

**Streaming over 5 minutes** (scripted traversal: Ilo stepped 2 m every 0.25 s, 8 m/s, from the ateliers
hall along the Grand-Rue de Bâbord to the quais and back, twice; samples every 10 s)

| Measure | Low | High |
|---|---|---|
| Built at once | 2-3 | 3-5 (4 + the keel district under a stair port) |
| Draw calls | 96-398 | 155-480 (480 at the stern: 5 districts) |
| Triangles | 1.1-2.5 M | 2.4-4.3 M |
| fps (this Mac) | 59-60 | 60 |
| Worst frame per 10 s | 19-175 ms | 22-42 ms after the nav dwell (96-197 ms before) |
| JS heap | 478-600 MB, no trend | 575-1 042 MB, GC back to 575-630 each loop, no trend |
| `renderer.info.memory.geometries` | +18-35 per round trip | same |

Build per district: 170-470 ms wall over sliced frames, 24-33 draws, 175-503 k triangles,
460-2 860 colliders. A crowd navmesh bake is 93-182 ms on the main thread, so it waits until Ilo has
stayed 20 s in a district (`STREAM.navDwell`); the crowd follows its street graph until then.

Geometry leak check: a scene trace over Nef → forges → Nef found no procgen geometry left undisposed
(only the dressing's shared pool and porthole assets, kept on purpose). The geometry creep above is not
isolated: the Nef ↔ proue control without any arrondissement grows +3 per cycle, so the core's own
streaming accounts for part of it. Heap readings after `agent-browser open` on the same tab include the
previous page (1.7 GB seen once); fresh tabs read 581 MB without procgen, 677 MB with it at boot.

**Left open**

- Gameplay's plan canvas covers only the core: `ProcgenWorld.chart()` returns the revealed entries
  (3 per visited district) but nothing draws them.
- The Nef booths have no painted sign, and their prompt shows the raw token.
- The bazar and the potagers have no door from the core (marché and serres walls are hull rows).
- The crowd's figures read dark in the arrondissements: they get no `uLamps` there.
- The navmesh bake should move to a worker; it is the last main-thread hitch of the streamer.
