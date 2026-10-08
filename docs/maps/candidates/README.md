# Compact replacement map candidates

## Recommended complete layout: Dungeon by Warkarma

[Original asset](https://sketchfab.com/3d-models/dungeon-low-poly-game-level-challenge-0fd0d477d7424e5d8915ce0c06a2920d), **Dungeon - Low Poly Game Level Challenge**, © Warkarma, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The licence was checked in the original Sketchfab export's embedded asset metadata, preserved in [dungeon-license-metadata.json](dungeon-license-metadata.json). That original export is available in [this source mirror](https://github.com/DefinitelyMaybe/threlte-three-multiple-elements/blob/main/static/dungeon.glb). The measured WebP version comes from the [Three.js example asset](https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/dungeon_warkarma.glb).

- Full model: **72,137 triangles**, approximately **28.1 × 36.8 metres** horizontally.
- Source download: **7,990,584 bytes**, with 25 embedded texture images and 25 materials.
- 798 original meshes can be baked into **25 persistent material batches**, without removing geometry.
- Open stone rooms, arches, stairs, connecting passages, banners, crates and barrels. This has a medieval fortress style, rather than the previous industrial facility style.
- Approximately **97% fewer full-detail triangles** than the Reactor Facility.

[Whole-layout preview](compact-dungeon-overview.png) · [Corridor preview](compact-dungeon-corridor.png)

The previews are actual rendered source geometry, using the same bundled Three.js WebGL renderer version, colour space, tone mapping and character lighting parameters as Fortmulti. They show a standalone candidate scene, not an integrated game map. The previews use only hemisphere/directional lighting and environment reflections; no expensive screen-space reflection or denoising effects are needed.

## Renderer verification

The downloaded GLB loaded and rendered without JavaScript errors or WebGL errors. The Low shader variant retains source colours and supported texture maps, using the game's lightweight Lambert shading. Two floor-based views submitted 21–23 material draws and 70,559–71,919 triangles. Source floor points were sampled with downward raycasts; these are camera fixtures, not full navigation validation.

The measured Low render/readback medians were 117.6–136.1 ms on Chromium SwiftShader. This is software graphics, and the measurement includes forced GPU readback. It is not a real-GPU frame-rate measurement or directly comparable to full-game frame intervals. The model passes a preliminary renderer compatibility check, but no claim of lag-free gameplay is made. Integration would still require supported landing pads, gate clearance, collider extraction, player movement/building checks, multiplayer deployment verification and profiling in the actual game.

## Alternative asset: Space Ship Hallway by yeeyeeman

[Original asset](https://sketchfab.com/3d-models/space-ship-hallway-e97dce00ae5549a8a3795e06bc2cfc96), © yeeyeeman, **CC BY 4.0**, verified in its embedded asset metadata. [Download source](https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/space_ship_hallway.glb).

This has 53,400 triangles, 8 materials, no external textures, a 2,896,272-byte download and an approximately 8.5 × 29.2-metre footprint. It also rendered without JavaScript or WebGL errors. Its industrial sci-fi appearance suits Horizon, but it is one hallway asset, rather than a complete arena with several combat routes. Creating a layout from it would require additional design and a fresh total-scene geometry budget.

Only candidate previews and findings are recorded here. The replacement game map has not been integrated.
