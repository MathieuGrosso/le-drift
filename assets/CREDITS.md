# Asset credits

CC0 only. One line per asset: path, source URL, license.

## Libraries

- `postprocessing` 6.39.5, https://github.com/pmndrs/postprocessing, Zlib: bloom (mipmap blur), SMAA, effect passes.
- `n8ao` 1.10.3, https://github.com/N8python/n8ao, ISC: screen-space ambient occlusion.
- `@recast-navigation/core`, `/generators`, `/three` 0.43.1, https://github.com/isaac-mason/recast-navigation-js, MIT (Recast/Detour: zlib): ship navmesh, crowd avoidance, `?nav` overlay.
- `@gltf-transform/cli` 4.2.1 (build-time only, via npx), https://github.com/donmccurdy/glTF-Transform, MIT: meshopt compression of the props below.

## Props

- `assets/props/pottedPlant.glb`, `plantSmall1.glb`, `plantSmall2.glb`, `plantSmall3.glb`: Kenney Furniture Kit 2.0, https://kenney.nl/assets/furniture-kit, CC0. Optimised with `gltf-transform optimize --compress meshopt --texture-size 256`.
