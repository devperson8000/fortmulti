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

## Larger alternative: Medieval Fantasy Book by Pixel

[Original asset](https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a), **Medieval Fantasy Book**, © [Pixel](https://sketchfab.com/stefan.lengyel1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Author, original source and licence are preserved in the downloaded GLB's embedded metadata; see [licence evidence](medieval-landscape-license-metadata.json). The complete asset is available from [this controller demo's source mirror](https://github.com/wass08/r3f-3rd-person-controller-final/blob/main/public/models/medieval_fantasy_book.glb).

- Complete authored scene: **54,783 triangles**, 10 meshes, **3 materials**, two embedded texture images and a **3,876,804-byte** GLB.
- Actual transformed source bounds: **103.07 × 72.32 source units** horizontally. These source units do not establish the final game's metre scale.
- Proposed preview scale: **0.78**, producing **80.39 × 56.41 game units** horizontally. Its overall footprint is about **4.4 times** the dungeon's. This includes the book border and buildings, rather than representing unobstructed playable floor area. Final scale needs checking against the Horizon character and gate clearances during integration.
- Castle courtyard, surrounding paths, houses, windmill, fields, bridge, trees and scattered props. It offers a larger outdoor layout with stylised textured detail and approximately **24% fewer triangles** than the dungeon.
- It is a **storybook diorama**, not a ready-made FPS map. Integration would require adapting the book base/perimeter, checking traversable paths and interiors, making colliders and landing zones, removing decorative figures if necessary, and testing building and multiplayer gameplay.

[Actual whole-source preview](larger-medieval-landscape-overview.png) · [Actual ground-level source view](larger-medieval-landscape-ground-view.png)

These are renders of the downloaded geometry, not generated concept art. The original base and decorative characters remain visible. Static geometry was baked into three material batches for the standalone preview; no source animation is played. This baking is not yet implemented in the game.

The High source-material preview loaded without JavaScript errors. Both sampled ground-level views rendered with **3 draw calls**, **54,783 triangles** and **no WebGL errors**. Software-render/readback medians were **355.8–410.9 ms** on Chromium SwiftShader; the reflective source material is substantially more expensive than its geometry count alone suggests. This is not hardware FPS or a full-game benchmark. See [recorded results](medieval-landscape-high-render-check.json). A lightweight material check is recorded separately below.

The Low preview keeps the source colour textures with Lambert shading and renders the same geometry in three batches without JavaScript/WebGL errors. The measured software-render/readback medians were **215.0–253.2 ms**, approximately 39% lower than the respective High views. These measurements still do not establish acceptable real-game FPS; spatial visibility chunks, the decorative perimeter, collisions and real-GPU gameplay would need validation before replacement. [Low ground-level preview](larger-medieval-landscape-low-ground-view.png) · [Low recorded results](medieval-landscape-low-render-check.json).

The pirate fort and castle-on-hills candidates were also inspected. The former has very little playable land; the latter has simpler untextured buildings. Neither is recommended as a larger replacement of comparable detail.

## Larger military/industrial alternative: Platform 23

[Complete source map](https://github.com/UnvanquishedAssets/map-plat23_src.dpkdir), **Platform 23**, © Jack “EmperorJack” Purvis / Unvanquished. It is a futuristic ship-support platform made for FPS matches, with detailed industrial structures, cargo cover, raised decks, side rooms and connecting passages. It is a science-fiction military/industrial setting rather than a modern forest army camp.

The map is **CC BY-SA 3.0**, permitting redistribution and adaptation, including commercial use, with attribution and adaptations distributed under the same licence. See [upstream map attribution and licence](platform23-upstream-license.txt). The PK02 industrial textures are by Philip “Blazeeer” Klevestav, adapted for Unvanquished, under **CC BY 3.0**; see [texture credits](platform23-texture-license.txt) and [texture source](https://github.com/UnvanquishedAssets/tex-pk02_src.dpkdir). Candidate geometry and previews adapted from Platform 23 are offered under CC BY-SA 3.0, with the texture attribution retained.

[Actual converted landing-deck preview](platform23-landing-deck.png) · [Whole converted layout](platform23-whole-layout.png) · [Converted corridor view](platform23-corridor.png)

For comparison, [the author's original Unvanquished screenshot](https://raw.githubusercontent.com/UnvanquishedAssets/map-plat23_src.dpkdir/master/meta/plat23/plat23.webp) shows its original engine's lighting and effects. The screenshots in this repository are independently rendered converted source geometry; they are not generated concept art, an integrated Fortmulti map, or a reproduction of the original engine's baked lighting.

### Measured source conversion

- Source `.map`: **2,123,712 bytes**, **3,546 convex brushes** and **189 quadratic patches**. No external model entities were found.
- Research conversion reconstructed every convex brush successfully (**zero invalid brushes**), omitting nonvisual common/sky faces. Quadratic patches use four subdivisions per patch segment.
- Converted preview: **25,489 triangles**, approximately 65% fewer than the dungeon and 99% fewer than the Reactor Facility. This is a count of this specific conversion, not a published triangle count for the original compiled map. Refining curved surfaces or doing a proper BSP compile may change it.
- At **32 source units per game metre**, actual rendered geometry spans **187 × 113.5 metres** horizontally, including surrounding rock/support structures. Combat paths and rooms occupy less than this bounding rectangle. Final scale and navigation still need validation against the game's player capsule.
- **46 source-material batches** and **37 diffuse/editor texture images**. The self-contained preliminary GLB is **21,132,032 bytes**, largely uncompressed PNG texture payloads. Production conversion should retain appropriate diffuse/normal maps, reduce texture download size and partition visibility; low triangle count alone does not settle rendering cost.

[Geometry reconstruction results](platform23-geometry-check.json) · [Renderer results](platform23-render-check.json)

### Preliminary renderer checks

The conversion loaded and rendered in the game's bundled Three.js WebGL renderer with no JavaScript errors and no WebGL errors in either sampled view. Lightweight Lambert shading retains source diffuse colour detail. The two sampled views submitted **45–46 draws** and **25,477–25,489 triangles**. Forced render/readback medians were **92.7–123.5 ms** on Chromium SwiftShader. These software-graphics measurements include synchronous pixel readback; they are not hardware FPS or full-game frame-rate results.

The conversion does not reproduce the map compiler's baked illumination, visibility data, animated forcefields, terrain blending or special shader stages. Emissive lights and transparent editor textures are simple approximations for research. The native map's gameplay entities, collision brushes and spawn metadata have not been integrated. The next implementation would need production geometry/material conversion, clear landing pads, collision and traversal validation, building checks and full-game real-GPU profiling before claiming acceptable gameplay performance.

The 340 × 320-metre FALLTIDE/Orbital Complex candidate was inspected and rejected for this request: its actual instanced geometry was approximately 310,000 triangles, and it retained the extensive enclosed-facility complexity the user wanted to avoid. Prop-only military kits and candidates without clear reuse rights were not treated as complete ready-to-integrate maps.
