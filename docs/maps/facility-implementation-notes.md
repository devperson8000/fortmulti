# Reactor Facility integration

The party leader can choose Ironwood Island or Reactor Facility. Both peers load the selected world before their match snapshots activate. The detailed facility uses the original pinned Godot TPS geometry and materials, with eight exterior landing outposts, cut entry gates, supported walkways and an inner gallery connecting them. Native stairs lead to the original lower floors.

Each outpost is selectable in deployment. Pods land on a reserved supported platform instead of the reactor roof. The existing boarding, music cues, impact, walkout, salute and controls are preserved. The facility has 24 chests and 24 harvestable supplies; loot is placed on nearby supported surfaces with a clear collection path.

## Actual in-game screenshots

- [Deployment outpost selection](facility-deployment-picker.png)
- [Exterior entry](facility-exterior-entry.png)
- [Interior floor](facility-interior-floor.png)

These are actual browser screenshots at Low graphics, not generated concept art. Asset credits and importer instructions are in [SOURCE.md](../../public/maps/reactor/SOURCE.md).

## Rendering and validation

The source retains about 2.24 million full-detail triangles. Offline spatial chunks and simplified distance indices are combined into persistent material buffers; sampled views use 34–35 facility material draws. Stationary views do not rebuild or upload indices. Low and Medium use lighter textured shading; High uses physical materials and reflections. Shader, texture and vertex resources initialize during map loading to avoid first-visibility uploads.

The full syntax/test/build check passes 325 tests. The existing gameplay browser check passes 22 checks, the original-map deployment browser check passes 14, and five facility browser checks pass against the built static app. Native floor, gate routes, supplies, building, loot support and collection are tested; loot covers all 24 chests across eight rounds.

### Performance limitation

The cloud machine exposes Chromium SwiftShader software graphics, not a physical GPU. One foreground client at Low graphics (832×468 internal resolution, 12 steady frame samples per view) measured these frame times:

| View | Median | 95th percentile |
| --- | ---: | ---: |
| Exterior entry | 266.7 ms | 283.3 ms |
| Interior floor | 750.0 ms | 799.9 ms |
| Lower service view | 1033.3 ms | 1066.6 ms |

Functional rendering success does not establish smooth gameplay. The facility cinematic shows the correct visible logo/drop cues and salute, but its strict final camera-handoff sampling check did not pass consistently on this software renderer. That check remains in place. Real-GPU frame rate and smoothness remain unverified; this implementation does not claim lag-free performance.

Run `npm run test:facility-browser` for map/network/render checks and recorded frame times. Run `GAME_TEST_MAP=facility GAME_TEST_GRAPHICS=low npm run test:deployment-browser` for the strict native-map cinematic check. Use `GAME_TEST_URL`, `CHROMIUM_EXECUTABLE`, `GAME_ARTIFACTS` and (for profiling) `FACILITY_FRAME_SAMPLES` as needed.
