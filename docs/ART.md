# Le Drift — Art direction (v1)

Owner's brief: « je veux vraiment un truc beau ». Beauty now outranks features. This file is the
visual target; `BIBLE.md` §5 stays the rulebook (palette tokens, haze model, budgets) and this file
refines it. If they disagree on a number, the bible wins until it is updated.

References: BotW (painterly cel, soft gradients, atmospheric perspective, rim light, restrained
palette, readable silhouettes), Ghibli interiors (Spirited Away's bathhouse, Howl's castle, Laputa,
Ponyo: lamps, wood and brass, steam, clutter that tells a story, light pouring through windows),
Wind Waker for water and VFX shapes.

Postcards are debug poses (`src/core/poses.ts`): `art-cabine`, `art-atrium`, `art-refectoire`,
`art-cuisine`, `art-marche`, `art-cartes`, `art-serre`, `art-sortie`, `art-ilo`. Before shots:
`shots/art-before-*.png` (1280×720, `medium`, SwiftShader). Capture: hide the DOM overlay, call
`__game.screenshotPose(name)`, wait 5 s for eye adaptation and streaming, call it again, screenshot.

---

## 0. Diagnosis of the current build

What already works and must be kept: the arched hull ribs, the bunting, the Grande Vitre as a stage,
the glass roofs of the market and the Serres, the Mât with lamp rings, warm lamp shades, the posters
in the cabin, the shelf of jars in the kitchen, the market's three tiers with stairs, the chart table.
The composition of the refectory and the market is already right.

What reads as « prototype » in every postcard, in order of damage:

1. **Flat value structure.** Every interior is mid-value beige/peach from floor to ceiling. No dark
   foreground, no lit midground, no bright background. Lamps make no visible pool; nothing is in
   shadow. The eye has nowhere to go.
2. **Vertical two-tone wash on walls.** Walls go mint at the top and orange at the bottom (cabin, chart
   room, kitchen). It is the glass-light/canopy term plus the warm floor bounce, both too strong and
   too smooth: it reads as fog, not light. This is what is left of bug #1.
3. **Untextured materials.** Walls, stall boxes, the chart room's chair, the bunk, crates, hull shells
   are flat colour with no bevel, trim, plank, rivet or paint wear. Planks are the only texture and
   they are oversaturated orange.
4. **Glass that does not glow.** The Grande Vitre and the portholes are dull green panes darker than the
   wall around them. The brightest thing in the refectory must be the window; today it is the wall.
5. **Ilo is a mannequin.** Box limbs, no hands, a face that disappears in three-quarter view (cabin
   shot), and the **scarf stands up like a stick** in nearly every postcard (atrium,
   kitchen, market, chart room: a rigid red strip pointing at the ceiling).
6. **Outside is a toy box.** The sortie shot: fish 10× too big and identical, hull shells like bath toys,
   seabed close under the keels, and **713 draw calls / 4.2 M triangles** (budget 250 / 1.5 M).
7. **NPCs are capsules.** Readable colour, but no silhouette variety, no hands, no faces at 5 m.
8. **Saturation spikes.** Orange planks, red/yellow rugs and the kitchen's blue tile grid compete with
   the characters. Few strong colours per scene; today every surface is strong.

Perf at capture (`medium`): cabin 141 draws / 1.1 M tri; atrium 184 / 1.85 M; refectory 104 / 1.2 M;
kitchen 160 / 1.4 M; market 121 / 1.5 M; chart room 123 / 1.3 M; Serres 125 / 1.5 M;
sortie 713 / 4.2 M; Ilo 122 / 0.85 M. A 4×4 m cabin should not cost 1.1 M triangles: whole
districts are drawn behind closed walls (portal culling is not cutting).

---

## 1. Global rules

- **Value first.** Every postcard is designed in three values before colour: dark foreground frame
  (`bois-ombre` `#5E4A5C` / `interieur-ombre` `#3E3A5A`), lit midground (cream and wood under lamps),
  bright background (window, glass roof or lamp-lit far wall). Check by desaturating the screenshot.
- **Warm inside, cool at the glass.** Lamps `#FFC27A`/`#FF9E5E` own the room; `vitre-mer` `#9FD6D0`
  only lives within ~3 m of glass, as a cone, never as a wall gradient.
- **Light has a source and a falloff.** Each lamp: a visible pool on the floor/table under it, a soft
  hot spot on the nearest wall, then plum shadow beyond 3-4 m. Ambient ≤ 35 % of a lit surface.
- **Shadows are plum, never grey or black.** Darkest value on screen ≈ `#2E2A44`; never `#000`.
- **Few strong colours.** Per scene: one dominant (wood/cream), one accent (district colour), one
  complement (sea teal at the glass). Rugs, stalls and clothes at 60-70 % of their current saturation.
- **Air haze only in big rooms** (`uAirHaze` 0 in rooms < 12 m, 0.4-1 in halls). Sea haze only beyond
  glass. No mint or orange tint on near walls.
- **Every surface has a shape break:** a bevel, a trim, a plank seam, rivets, a stripe of wear. No box
  face larger than 1 m² without one.
- **Silhouettes:** characters get a 1-2 px warm rim from the nearest lamp and a cool rim on the glass
  side. Outline on characters and props (`high`), not on walls.
- **Exposure:** lamp cores and the Grande Vitre centre may clip, nothing else. Cream walls in lamp light
  measure within ΔE 10 of `#F1E4C8` (bible §5.3).

---

## 2. Postcards

Each entry: today → target. Hex are screen-space targets after grading.

### 2.1 `art-cabine` — Ta cabine, à l'aube (05:54)

Today: walls washed mint-to-orange, the porthole a dark green disc, a stray dark band across the
arch, the bunk and shelf as flat boxes, Ilo's face blank, scarf vertical.

- **Mood:** the last minute of sleep. Cosy, small, almost dark; one cold blue eye of sea.
- **Palette:** shadow `#2E2A44`, wall in shadow `#6A5468`, wall in lamp `#E9CFA4`, lamp `#FFC27A`,
  bunk blanket `#C9644E` (desaturated coral), porthole sea `#5FA9B0` → `#9FD6D0` at its centre.
- **Key:** the small bedside lamp (`lampe-chaude`, radius 2.5 m) on the bunk, warm pool on blanket and
  posters. **Fill:** porthole cone, cool, 0.6 m wide shaft of dawn light with dust motes onto the rug.
  **Rim:** cool rim on Ilo from the porthole. Ceiling lamp off at dawn (it is on at night).
- **Fog:** none (`uAirHaze` 0). Vignette toward `interieur-ombre`, 0.25.
- **Materials:** painted plank walls (`platre` over wood, wainscot to 0.9 m in `bois`), riveted arch
  ribs in `bois-ombre`, brass porthole ring with 8 bolts, quilt fabric with patch squares.
- **Set dressing:** posters pinned with tape corners and curled edges; the scrubber hung on a hook;
  wet boots by the door; a jar of sea glass on the shelf; a fish-shaped mobile; a rope coil; the
  « trouvailles » shelf lit by the lamp; a calendar with days crossed; a cup on the stool.
- **Camera:** 64°, from the door corner at 1.75 m, bunk and porthole on the right third, Ilo standing at
  the porthole in silhouette against it.

### 2.2 `art-atrium` — La Grande Nef (10:00)

Today: the best shot in the game structurally, but everything is the same beige value; hulls read as
pills with dots; the back wall is a flat card; the glass roof is uniformly bright; the walkway planks
are bright orange and fill half the frame.

- **Mood:** the BotW tower view, inside. Scale and depth staircase.
- **Palette:** foreground railing and deck `#4A3A4E`-`#7A5A48` (dark), midground hulls by district
  accent at 70 % (`#D9B48F`, `#D8644E`, `#8FBF6A`, `#4F6D7A`), far layer `air-brume` `#E9DCC2`,
  roof glass `#BFE6E0` with frames `#5E4A5C`, lamp rings `#FFC27A`.
- **Key:** sea light falling from the glass roof in 3-4 slanted shafts (render `shafts.ts`), hitting
  gangways in patches. **Fill:** warm bounce from the Mât's lamp rings and the window rows.
  **Rim:** cool top rim on hull backs from the roof.
- **Fog:** air haze `uAirHaze` 1, colour `#E9DCC2` tinted 20 % lamp, density so the far wall (≈80 m)
  is 55 % haze, the near gangway 0 %. Three clear layers.
- **Materials:** hull plating with horizontal seams and rivet rows, district paint with wear on edges,
  brass ring frames on portholes, glass roof mullions with brass caps, deck planks at `#B07A4F`
  (−25 % saturation), grating on the lower gangways.
- **Set dressing:** laundry lines between hulls, hanging plants, zip line with a pulley in the
  foreground, 2 people on far gangways at every level, a kite or paper fish, crates on balconies,
  lit window rows (rhythm), the Mât's pipes and gauges.
- **Camera:** 64°, from the top gangway; foreground railing + a dark beam frame the left edge, the Mât
  on the right third, the far end of the nave fading into haze in the centre.

### 2.3 `art-refectoire` — Le petit-déjeuner devant la Grande Vitre (07:42)

Today: the window is the darkest, flattest element; the room is uniformly lit; no steam; no
silhouettes of people against the glass; NPCs are capsules.

- **Mood:** Ghibli breakfast hall. The whole room turned to one window, like a cinema.
- **Palette:** room in shadow `#5E4A5C`, tables `#9A6A48`, lamp pools `#FFD9A0`, crowd backs
  `#3E3A5A` silhouettes, window `#7CC6BF` → `#CFEFE3` at the top, shafts `#E8FFF6`.
- **Key:** the window. It is the brightest area (it may clip at the top). Long cool light across the
  front tables, the kids on the sill backlit. **Fill:** pendant lamps over each table, warm pools on
  bowls. **Rim:** strong cool rim on every head and shoulder facing the window (this is the shot).
- **Fog:** `uAirHaze` 0.35, steam over bowls and the serving counter catching the window light.
- **Materials:** scrubbed wood tables with knife marks, enamel bowls (ceramic, cream with blue rim),
  brass window frame with rivets, glass with a thin coat at the edges, painted arch ribs.
- **Set dressing:** steaming pots on the counter, bread baskets, fish on platters, cups, a chalkboard
  menu (« Poisson. Poisson. Pain (?) »), bunting under the arch, plants by the window, kids on the sill,
  a turtle crossing outside, light shafts outside, the forecast board by the door.
- **Camera:** 60°, eye height from the back of the room, horizon at 40 %, window in the upper-middle
  band, 2-3 dark heads in the near foreground.

### 2.4 `art-cuisine` — La cuisine, la vapeur (07:12)

Today: the floor's blue tile grid dominates, the wall is orange-to-white wash, steam is a wisp, the
hanging fish are huge pale blue shapes, the cook is a white capsule.

- **Mood:** Spirited Away boiler room in miniature: hot, crowded, steam lit from behind.
- **Palette:** shadows `#4A3A4E`, stove glow `#FF9E5E`, steam `#F6E7D0` (lit) → `#B7A6B8` (shadow),
  copper pots `#C9824E`, tiles `#C9C2B4` with `#9A8E86` grout, jars `#7CC6BF`, `#D8644E`, `#E8C36A`.
- **Key:** the stove fire (below, orange, up-lighting the cook's face and the steam column).
  **Fill:** two pendant lamps over the table. **Rim:** the porthole behind the stove gives a cool edge
  to the steam.
- **Fog:** none globally; local steam volumes (billboard puffs, 6-10, rising and fading, lit by the
  nearest lamp and the stove).
- **Materials:** chipped tiles (small square, low contrast grout), soot on the arch above the stove,
  copper and enamel, cast-iron stove with rivets, flour-dusted table.
- **Set dressing:** pots on a rail (copper, varied sizes), ladles, dried fish strings (scale ×0.4),
  onion and kelp bundles, sacks, a cat, the cook's knife block, a chalk tally of meals, bread rising
  under cloth.
- **Camera:** 62°, from the far corner, stove and steam column on the right third, table leading line.

### 2.5 `art-marche` — Le Grand Marché (10:30)

Today: good architecture; but the floor is a flat cream sheet, stalls are bright solid boxes, awnings
flat colour, crowd too sparse for a market.

- **Mood:** covered bazaar, Howl's town market under a glass vault.
- **Palette:** floor `#B9A48A` worn stone/boards, awnings striped `#D8644E`/`#F1E4C8` at 75 %,
  structure `#4A3A4E`, glass `#9FD6D0`, string lights `#FFC27A`, goods small saturated dots.
- **Key:** daylight from the glass vault in shafts down the central aisle. **Fill:** string lights and
  stall lamps (warm pools under each awning). **Rim:** cool roof light on heads and awnings.
- **Fog:** `uAirHaze` 0.7, far end of the hall 45 % haze.
- **Materials:** canvas awnings with sag and scalloped edges, stall counters in planks with corner
  posts, baskets (woven), crates with stencils, cast-iron columns with brass bands.
- **Set dressing:** baskets of fish on ice, kelp bundles, jars, hanging lanterns, scales, chalk price
  boards, rope bundles, kids running, a crowd density of 25-40 in frame (impostors beyond 25 m),
  the clock gallery at the far end lit as the focal point.
- **Camera:** 60°, aisle centred with vanishing point at the clock, Ilo small at the lower third.

### 2.6 `art-cartes` — La Salle des Cartes de grand-père (15:00)

Today: green-to-orange wall wash, the window dull, the chair a box, rug oversaturated, the chart a
flat white plane without ink.

- **Mood:** a study at the top of the ship: Laputa's old-man rooms. Paper, brass, afternoon light.
- **Palette:** walls `#6A5468` in shadow, `#E6D8BE` in light; chart paper `#EFE3C4` with ink `#3E3A5A`
  and the white zone in `#FAF6EC`; brass `#D9B48F`; window `#7CC6BF`; rug `#9A4E44`/`#C9A15A` at 60 %.
- **Key:** grandfather's window, a cool slab of light falling across the chart table.
  **Fill:** a green-shaded desk lamp on the chart (warm pool). **Rim:** window rim on grandfather's
  white hair and the pen.
- **Fog:** none; dust motes in the window beam.
- **Materials:** chart paper with fold lines, the worn groove of the loop, pins, string, brass
  instruments (dividers, sextant, lens), shelves of logbooks with cloth spines, carved wood chair.
- **Set dressing:** rolled charts in a barrel, logbooks stacked, a hanging globe of the sea, pressed
  kelp specimens, a tea cup with a ring stain, a pen tray, a stool for Ilo, the window with handprints.
- **Camera:** 55-60°, low over the table edge looking at the window, grandfather in profile.

### 2.7 `art-serre` — Une serre de laminaires (11:30)

Today: the kelp are pale flat strips (they read as paper), the boardwalk is bright orange and fills
the right half, the glass vault is the nicest part.

- **Mood:** Nausicaä's lab garden: humid, green-gold, quiet.
- **Palette:** kelp `#6F8F4E` → `#B9D98A` at tips, translucent back-lit; water channels `#3A8C98`;
  boards `#8A6448`; glass `#BFE6E0`; light `#E8F2C0`; gardener hats `#C9A15A`.
- **Key:** sea light through the vault, green-gold, shafts with particles. **Fill:** warm brass lamps
  along the walkway. **Rim:** back-lit kelp edges (transmission term, the signature of this place).
- **Fog:** `uAirHaze` 0.6, tinted 30 % `serre` `#B9D98A`, humid.
- **Materials:** kelp ribbons with ruffled edges and a mid-rib, translucent; wet tanks with glass
  walls; brass pipes with drips; planks with moss in the gaps.
- **Set dressing:** watering cans, labelled tanks, tools on hooks, jars of seedlings, a hose, a
  gardener on a ladder, drip VFX, a fish outside looking in.
- **Camera:** 62°, from the walkway, kelp beds in the foreground left (dark, out of light), the vault
  receding.

### 2.8 `art-sortie` — Dehors, sur la coque (07:12)

Today: a wall of oversized identical fish covers the frame; hulls read as bath toys; the seabed is
right under the hulls; budget ×3.

- **Mood:** the only cold, open, quiet moment; Ilo small against a living city wall.
- **Palette:** water `#1B5E73` → `#7CC6BF` toward the ceiling; hull `#4F6D7A`/`#C46A4A` worn, coat
  `#6F8F4E`; lit windows `#FFD9A0`; Ilo's scarf `#E8674A` is the only warm saturated note.
- **Key:** sun from the ceiling, caustics on the hull plating. **Fill:** the warm lit windows (the city
  is inhabited). **Rim:** strong cool rim on hull edges and Ilo.
- **Fog:** sea haze per bible (visibility 30 m in act 1): hulls beyond 40 m fade to `#3A8C98`;
  the seabed is never visible from the hull (haze or below the frame).
- **Materials:** riveted plating with panel lines, rust only at seams, coat fur on unscrubbed glass,
  brass rings for the longe, ropes with fibre texture.
- **Set dressing:** the longe from the lock ring, grab rails, 2-3 small fish schools of 20-40 at
  realistic size (0.2-0.4 m), one jellyfish, kelp on the hull, a face at a lit window.
- **Camera:** 55°, 6 m off the flank, the hull wall receding diagonally, Ilo on the lower third.

### 2.9 `art-ilo` — Ilo, gros plan (08:00)

Today: front-on, flat, toy proportions, dot eyes, scarf vertical.

- **Mood:** BotW Link portrait: calm, curious, slightly damp.
- **Palette:** skin `#C98E6B` lit / `#8A5A5A` shadow, hair `#2A2238` with `#5E4A78` highlight band,
  tunic `#2F4E7A` / `#1E3252`, scarf `#E8674A` / `#A8443A` in shadow, goggles brass `#D9B48F` with
  `#9FD6D0` lens.
- **Key:** the window behind-left (cool), **fill:** lamp from front-right (warm), **rim:** cool,
  2 px.
- **Camera:** 45°, three-quarter, shoulders up, the Grande Vitre bokeh behind.

---

## 3. Material library (render owns, drift/hero/flora consume)

One function per family in `render/` (`render.mat.wood({ tone, wear })` …), each a cel material with a
shared procedural `CanvasTexture` atlas (hand-painted look: soft brush noise, no photographic grain).
Atlas 1024², 8 tiles, generated once at boot (< 40 ms). AO and wear baked into vertex colours by the
builders, never realtime.

| Family | Base / shadow / highlight | Texture tile | Shading notes |
|---|---|---|---|
| **Wood (planks)** | `#B07A4F` / `#5E4A5C` / `#E0B07E` | 4 boards per tile, dark seam 2 px, 1-2 knots, brush streaks along grain | Saturation −25 % vs today; alternate board tone ±6 %; edge wear lighter on board ends |
| **Wood (painted)** | `platre` `#E6D8BE` / `#6A5468` | paint over planks, chips showing `bois` at edges (5 %) | Used for cabin and room walls above the wainscot |
| **Brass** | `#D9B48F` / `#7A5A48` / `#FFF0D0` | none; verdigris `#7FA89A` in crevices via vertex colour | Toon specular: one hard highlight band, fresnel rim, no env map |
| **Painted steel** | district accent / `#4A3A4E` | panel seams every 1.2 m, rivet dots, 8 % rust streaks under rivets | Hull shells inside and out; rust only on keels and seams |
| **Glass with coat** | tint `#9FD6D0` 15 % | coat mask (green fur `#6F8F4E`, noise edged) + condensation mask + 3 px brass frame | Brighter than the wall behind it from inside: emissive floor of 0.35 × sea colour; fresnel edge `#E8FFF6` |
| **Fabric** | `tissu-1/2/3` at 70 % sat | weave noise 2 px, patches (square, contrasting stitch) | Wrap lighting (soft terminator), slight sheen on silk scarf |
| **Ceramic / enamel** | `#F1E4C8` / `#9A8E86` + rim `#4F6D7A` | chips on rims | One soft specular dot |
| **Kelp** | `#6F8F4E` → `#B9D98A` tips | mid-rib + ruffled alpha edge | Translucency: back light × 0.6 when lamp/sea behind; sway in vertex shader |
| **Tiles** | `#C9C2B4`, grout `#9A8E86` | 8×8 small tiles, 1 px grout, a few chipped | Low contrast; never a coloured grid |
| **Ilo skin** | `#C98E6B` / `#8A5A5A` / `#E8B48E` | none | Subsurface fake: shadow band warmer/redder; blush on cheeks/nose `#D97A6A` 20 % |
| **Ilo hair** | `#2A2238` / `#16121F` / band `#5E4A78` | painted anisotropic band | Hair shapes as 5-7 clumps, not a sphere |
| **Ilo scarf** | `#E8674A` / `#A8443A` | knit ribs along length | Wet: `#A8443A` base, glossy band; dry: matte |

Outline: inverted-hull, `#2E2A44`, 1.2 px at 1080p on characters and props < 2 m; none on walls.

---

## 4. Ranked art tasks by owner

Ranked by visible gain per hour. P0 = blocks « beau », P1 = makes it a postcard, P2 = polish.

### render/ (lighting, post, material library, glass)

1. **P0 Kill the wall wash.** Clamp `rd_glassLight` to a cone of ≤ 3 m from each glass portal with a
   cel-stepped falloff; drop the `canopy` term in rooms with `uAirHaze` 0; lower `skyB` from 0.46 to
   0.32 and raise lamp `band` contrast so lamp pools read. Acceptance: `art-cabine` and `art-cartes`
   walls show a lamp pool and plum shadow, no mint top / orange bottom gradient.
2. **P0 Glass reads brightest from inside.** Grande Vitre and portholes: emissive floor of sea colour,
   fresnel edge, exposure bias so the window is the brightest area in `art-refectoire`.
3. **P0 Value grading.** Indoors: lift contrast (toe at `#2E2A44`), saturation −15 % on mid-values,
   vignette 0.25 to `interieur-ombre`; outdoors keep current. Check every postcard desaturated.
4. **P1 Material library** (§3) as `render.mat.*` with the shared painted atlas; drift and hero
   migrate to it.
5. **P1 Character rim.** Warm rim from the nearest lamp, cool rim from the nearest glass, on hero and
   NPC materials.
6. **P1 Shafts indoors.** One shaft volume per large glass (Grande Vitre, glass roofs, Serres vault,
   grandfather's window) with dust motes; strength by sun height.
7. **P1 Outline pass** on characters/props (inverted hull), `high` only.
8. **P2 Steam/volume billboard shader** shared (kitchen, refectory bowls, Puits), lit by lamps.
9. **P2 Air-haze colour per district** (`serre` tint in Les Serres, `machine` in the Puits).

### drift/ (architecture, set dressing, props, NPC look)

1. **P0 Portal culling actually culls.** 1.1 M triangles in the cabin and 4.2 M / 713 draws at the
   sortie are 3× over budget; nothing else in this list is affordable until this is fixed.
2. **P0 Wall construction:** wainscot (0.9 m `bois`) + painted plaster above + top trim + rib bevels on
   every hand-authored cell; no flat wall face > 1 m² without a break.
3. **P0 Desaturate and texture floors:** planks via the wood family (−25 % saturation, seams), kitchen
   tiles low-contrast, market floor worn boards/stone.
4. **P1 Prop pass:** bevelled boxes (`RoundedBox` 2-3 cm) for every furniture box; chair, bunk, stall,
   crate redone with posts, rails and planks; brass rings with bolts on portholes.
5. **P1 Lamp pass:** every room 1 key lamp + 1-2 practicals at distinct heights; lamp radii tuned so
   pools are visible; ceiling lamp off at dawn in the cabin.
6. **P1 Set dressing lists** of §2 per place (cabin, refectory, kitchen, market, chart room, Serres).
7. **P1 Hull shells:** panel seams, rivet rows, district paint with wear, keel rust; window rows lit in
   rhythm; standard size classes (bible §5.6) — fixes the « pile of rocks » from outside.
8. **P1 NPC look:** 6 silhouettes by role (cook apron/hat, engineer overalls, gardener hat, kid, elder,
   vendor), hands as mittens, two-dot eyes + brow + nose, desaturated clothes; crowd impostors share
   the palette.
9. **P2 Clutter generator** for generated kits (jars, ropes, laundry, drawings) seeded per hull.
10. **P2 Atrium dressing:** laundry lines, hanging plants, far-gangway walkers, a kite.

### hero/ (Ilo's model, face, proportions, scarf, animation appeal)

1. **P0 Scarf hangs and trails.** In the atrium, kitchen, market, chart room and Ilo postcards the scarf rises above the
   shoulder. Check the gravity/flow inputs while posed (`screenshotPose`, title camera) and in the air
   state; the verlet chain must droop at rest and trail when moving.
2. **P0 Face that survives three-quarter view:** eyes as painted ovals with a highlight, brows, a nose
   tip, a mouth line; the face texture currently vanishes off-axis (cabin shot).
3. **P1 Proportions:** head 1/6 → slightly larger hands and feet, tapered limbs (no boxes), shoulders
   rounded, tunic with a hem flare, boots with a fold.
4. **P1 Hair:** knot + 5-7 clumps + loose strands that follow the scarf's wind.
5. **P1 Materials** from §3 (skin warm shadow, hair band, knit scarf, wet state).
6. **P2 Idle appeal:** breathing, weight shift, glance toward the nearest glass, scarf tug.

### world/ + flora/ + fauna/ (sea backdrop, VFX, creatures)

1. **P0 Fish scale and count at the sortie:** schools of 20-40 at 0.2-0.4 m, kept ≥ 4 m from the
   camera; no fish larger than Ilo within 10 m except the whale/turtle.
2. **P0 Seabed out of the sortie frame:** deeper or hazed so the hull wall reads, never the floor.
3. **P1 Kelp (Serres and outside):** ribbon mesh with ruffled alpha edge, mid-rib, translucency and
   tip gradient (§3); today they read as flat paper strips.
4. **P1 Grande Vitre backdrop composition** at 07:30: a turtle crossing the middle third, 2 shafts,
   a school far back, the ceiling's Snell window at the top edge; jellyfish only at night.
5. **P1 Coat on glass** as soft green fur with an edge, not uniform tint.
6. **P2 VFX shape language** (Wind Waker): bubbles as rings, drips as teardrops, rain rings as
   double circles; one palette, no particles brighter than lamps.
7. **P2 La Chose's look:** layered wings like pages, one eye; always behind glass, back-lit.
