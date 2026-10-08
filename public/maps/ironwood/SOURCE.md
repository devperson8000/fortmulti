# Ironwood Island source and licenses

Ironwood is a HORIZON adaptation of downloaded **Terrain3D demo terrain**, with downloaded **Kenney tree models** and HORIZON military compounds. It is not an unchanged, ready-made military map.

Terrain source: https://github.com/TokisanGames/Terrain3D
Pinned revision: `854a4575ef0f6db8f3e2c051d352181da75236a2`
Downloaded resource: `project/demo/data/terrain3d_00_00.res`
SHA-256: `bf6881fdff855d0cdf084ceee601f897411c5b1c958a59603f957b931678eaf6`
License: MIT. Copyright (c) 2023–2026 Cory Petkovsek, Roope Palmroos, and Contributors. Full notice: [Terrain3D-LICENSE.txt](Terrain3D-LICENSE.txt).
Changes: extracted its 1024² float height image, reduced elevation and sampled to a 161² field, added a shoreline and smooth compound clearings, quantized to centimeters. Terrain rendering and game physics share the final triangle field.

Tree source: https://github.com/KenneyNL/Starter-Kit-City-Builder
Pinned revision: `4535092b740b378b700efd9df9e27a631815b84a`
Downloaded files: `models/grass-trees-tall.glb` and `models/Textures/colormap.png`.
Author: Kenney. Asset license: CC0 1.0 Universal, as stated in that repository's README and [Kenney-ASSET-LICENSE.md](Kenney-ASSET-LICENSE.md). https://creativecommons.org/publicdomain/zero/1.0/
Changes: removed the ground tile; converted triangles and palette colors into the game's static resource buffer. Original model and palette remain alongside the baked data. The five native trees are split into centered meshes, scaled, rotated and placed on the terrain. Every trunk has an individual harvest target and destruction range. No extra runtime model or texture fetch is required for the map.

No audio, scripts, or other assets from these projects were incorporated. HORIZON outposts, road layout, minimap, loot placement and deployment integration were added here.
