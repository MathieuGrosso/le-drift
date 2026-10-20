# Asset credits

CC0 only. One line per asset: path, source URL, license.

## Libraries

- `postprocessing` 6.39.5, https://github.com/pmndrs/postprocessing, Zlib: EffectPass, bloom (mipmap blur), SMAA; loaded in its own `post` chunk.
- `n8ao` 1.10.3, https://github.com/N8python/n8ao, CC0 (LICENSE file; package.json says ISC): screen-space ambient occlusion, half-res with depth-aware upsampling.
- `@recast-navigation/core`, `/generators`, `/three` 0.43.1, https://github.com/isaac-mason/recast-navigation-js, MIT (Recast/Detour: zlib): ship navmesh, crowd avoidance, `?nav` overlay.
- `@gltf-transform/cli` 4.2.1 (build-time only, via npx), https://github.com/donmccurdy/glTF-Transform, MIT: meshopt compression of the props below.
- `@gltf-transform/core`, `/extensions`, `/functions` 4.2.1 and `meshoptimizer` 0.25.0 (build-time only, `npm run characters -- <download-dir>` = `scripts/characters.mjs`), MIT: merge, prune and meshopt-compress the characters below.

## Props

- `assets/props/pottedPlant.glb`, `plantSmall1.glb`, `plantSmall2.glb`, `plantSmall3.glb`: Kenney Furniture Kit 2.0, https://kenney.nl/assets/furniture-kit, CC0. Optimised with `gltf-transform optimize --compress meshopt --texture-size 256`.
- `assets/props/chair.glb`, `chairRounded.glb`, `stoolBar.glb`, `books.glb`, `radio.glb`, `lampRoundTable.glb`: Kenney Furniture Kit 2.0, https://kenney.nl/assets/furniture-kit, CC0. Same optimisation.

## Characters

- `assets/characters/ilo.glb` (Superhero_Male_FullBody + Hair_SimpleParted), `assets/characters/ondine.glb` (Superhero_Female_FullBody + Hair_Long): Quaternius Universal Base Characters [Standard], https://quaternius.com/packs/universalbasecharacters.html, CC0 (License_Standard.txt). Textures dropped, repainted with vertex colours at load.
- `assets/characters/clips.glb`: 26 clips from Quaternius Universal Animation Library 1 and 2 [Standard], https://quaternius.com/packs/universalanimationlibrary.html and https://quaternius.com/packs/universalanimationlibrary2.html, CC0 (License.txt). Mannequin mesh, finger, scale and root-translation tracks dropped.
- The CC0 packs were fetched from the mirror https://github.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender (itch.io download is behind a captcha).
