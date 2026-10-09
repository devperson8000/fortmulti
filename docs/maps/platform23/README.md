# Platform 23 integration verification

Verified 2026-10-09 with `npm run check`: 358 tests pass and the production build succeeds.

`GAME_TEST_URL=http://127.0.0.1:4186 GAME_TEST_GRAPHICS=low PLATFORM23_FRAME_SAMPLES=12 npm run test:platform23-browser` passes 22 connected-player checks. Coverage includes synchronized map choice, keyboard boarding, sealed waiting/ejection, song/logo/impact timing, walkout/salute/handoff, full-health gameplay with hidden damage overlays, native movement, wall/ramp building and climbing, floor loot collection, and local/remote gunshot audio. Both client handoffs render; no JavaScript or WebGL errors are recorded.

The geometry tests check triangle winding/material references and visible support beneath every landing region, chest and supply crate. Collision tests cover exact angled convex brushes, two-sided curved patches, native head clearance, shots/cameras, building and full eight-player pod reservations/exit paths.

[Overview](overview.png), [courtyard](courtyard.png) and [corridor](corridor.png) show the actual production game renderer at High graphics, with the HUD hidden. [Salute](salute.png) and [gameplay corridor](gameplay-corridor.png) come from the connected-player Low-graphics run. No artist mockups are used.

## Performance measurements

The connected-player harness profiles one rendering peer after pausing the guest renderer. Chromium uses ANGLE SwiftShader, a software GPU, at a 960×540 viewport with Low graphics. Twelve frames per view give the following limited sample:

| View | Median frame interval | 95th percentile | Submitted map triangles | Material draw calls |
| --- | ---: | ---: | ---: | ---: |
| Whole map | 33.4 ms | 50.1 ms | 27,952 | 46 |
| Landing deck | 83.4 ms | 100.1 ms | 9,286 | 41 |
| Native room | 66.7 ms | 83.3 ms | 14,665 | 45 |

These are software-rendering results, not desktop GPU benchmarks or a guarantee of 60 FPS. The earlier two-peer cinematic run also contains background-tab frame gaps; raw timings and GPU identity are preserved in [browser-results.json](browser-results.json). Ground-level rendering remains slower on this software GPU. High-graphics captures also complete without JavaScript errors.

Map geometry is about 302 KB compressed and textures total 3.66 MB. Source material batches and spatial chunks are culled without a second depth pass. Camera/bullet broad-phase rays avoid per-obstacle plane allocations: the same local 40-frame/18,630-collider benchmark improved from about 108 ms to 19 ms after warmup. This microbenchmark does not measure full-game frame rate.

Converted art and source credit: [ATTRIBUTION.md](../../../public/maps/platform23/ATTRIBUTION.md).
