# Reactor Facility integration

The party leader can choose Ironwood Island or Reactor Facility. Both peers load the selected world before their match snapshots activate. The detailed facility uses the original pinned Godot TPS geometry and materials, with eight exterior landing outposts, cut entry gates, supported walkways and an inner gallery connecting them. Native stairs lead to the original lower floors.

Each outpost is selectable in deployment. Pods land on a reserved supported platform instead of the reactor roof. The existing boarding, music cues, impact, walkout, salute and controls are preserved. The facility has 24 chests and 24 harvestable supplies; loot is placed on nearby supported surfaces with a clear collection path.

## Actual in-game screenshots

- [Deployment outpost selection](facility-deployment-picker.png)
- [Exterior entry](facility-exterior-entry.png)
- [Interior floor](facility-interior-floor.png)

The images above are actual browser screenshots at Low graphics. The polished Medium views are [exterior](facility-exterior-medium.png) and [interior](facility-interior-medium.png). Asset credits and importer instructions are in [SOURCE.md](../../public/maps/reactor/SOURCE.md).

## Rendering and validation

The source retains about 2.24 million full-detail triangles. Offline spatial chunks and simplified distance indices are combined into persistent material buffers; sampled views use 32–33 facility material draws. Stationary views do not rebuild or upload indices. Low uses light textured shading; Medium adds authored surface normals and specular highlights; High uses physical materials and reflections. Opaque batches and their spatial indices submit nearby surfaces first. Eight-metre visibility bounds within each authored chunk skip offscreen triangles while sharing the same detail level, so chunk boundaries remain consistent. Distance thresholds have hysteresis to avoid repeated uploads during movement. Vertex and index storage is optimized offline without changing any triangle attributes or winding. Shader, texture and vertex resources initialize during map loading to avoid first-visibility uploads.

The full syntax/test/build check passes 335 tests. The existing gameplay browser check passes 22 checks, the original-map deployment browser check passes 14, and five facility browser checks pass against the built static app. Native floor, gate routes, supplies, building, loot support and collection are tested; loot covers all 24 chests across eight rounds.

### Performance limitation

The cloud machine exposes Chromium SwiftShader software graphics, not a physical GPU. One foreground client at Low graphics (832×468 internal resolution, 12 steady frame samples per view) measured these frame times:

| View | Median | 95th percentile |
| --- | ---: | ---: |
| Exterior entry | 250.1 ms | 333.3 ms |
| Interior floor | 583.3 ms | 616.6 ms |
| Lower service view | 666.7 ms | 716.6 ms |

Functional rendering success does not establish smooth gameplay. The shared raw/Three renderer now resets the graphics state before raw attribute updates, preventing cached character vertex arrays from being overwritten. The island deployment regression passes all 14 checks and its captured salute shows an intact character. Real-GPU frame rate and smoothness remain unverified; this implementation does not claim lag-free performance.

Run `npm run test:facility-browser` for map/network/render checks and recorded frame times. Run `GAME_TEST_MAP=facility GAME_TEST_GRAPHICS=low npm run test:deployment-browser` for the strict native-map cinematic check. Use `GAME_TEST_URL`, `CHROMIUM_EXECUTABLE`, `GAME_ARTIFACTS` and (for profiling) `FACILITY_FRAME_SAMPLES` as needed.

## Rendering polish verification

The same three Low graphics camera fixtures now submit 142,688 / 143,854 / 205,485 triangles, compared with 145,853 / 255,386 / 317,102 before polish. That is a 44% reduction in the interior and 35% on the lower level. All 1,656 source chunks were compared with the prior asset at each of the three detail levels: packed vertex attributes, triangles, and winding are unchanged by offline ordering and visibility subdivision. The full automated suite passes 335 tests.

Use `FACILITY_CAPTURE_QUALITY=medium npm run test:facility-browser` to capture Medium views after the Low performance samples, or `GAME_TEST_GRAPHICS=medium` to profile Medium directly.
