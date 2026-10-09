# Platform 23 gunfight verification

Verified 2026-10-09: `npm run check` passes 367 tests and builds the production app. The connected two-player Platform 23 browser harness passes 24 checks with no JavaScript or WebGL errors.

The importer now reads rectangular Bezier patch controls in source column order and preserves outward winding. This fixes distorted curved architecture and its collision. A textured low-detail apron connects the courtyard gaps and corridor approaches. Four visible perimeter panels replace invisible containment. Runtime collision excludes hidden player clips and sky boundaries, retains exact visible convex walls and curved surfaces, and deduplicates spatial collision queries. Native support queries avoid repeating broad-phase box support checks.

Platform 23 starts with an AR. The server and UI disable construction, harvesting, pickaxes and shockwaves; the Island retains those features. Both gamemodes use lower gun damage. Chests sit on flat support, open after a continuous 0.7-second hold without a timer, and animate around their rear hinge. Ctrl toggles crouch; Shift only runs; Ctrl while running starts a slide that continues after releasing Shift. A second Ctrl tap ends it, preserving crouch when a low ceiling prevents standing. Native leg-chain solving keeps the feet above the ground and one knee planted, with smooth entrance/exit blends and the weapon grip preserved.

Geometry tests cover actual rectangular patch interpolation, triangle winding, visible support under every landing/chest, gap support, twenty-metre walking routes in both courtyards, exact convex collision, native head clearance and eight-player pod reservations. Rig tests load the actual Soldier skeleton and firearm meshes to verify ground contacts, constant leg lengths, smooth slide exit, salute and all weapon palm contacts.

[Overview](overview.png), [repaired courtyard](courtyard.png), [corridor](corridor.png), [knee-slide](knee-slide.png) and [upright open chest](open-chest.png) are actual production-engine High-graphics captures with controlled poses and the HUD hidden. [Salute](salute.png) and [gameplay corridor](gameplay-corridor.png) are from the full connected-player Low-graphics run. These are rendered screenshots, not concept art.

## Performance and practical limits

Map geometry is 292 KB compressed, textures total 3.66 MB, and the whole map contains 32,338 triangles. An eight-player movement microbenchmark measured a 1.09 ms median and 2.51 ms 95th percentile across 450 warmed ticks. This excludes rendering, networking and startup; raw results are in [movement-performance.json](movement-performance.json).

The browser profiles one peer at 960×540 Low graphics after pausing guest rendering. Chromium uses ANGLE SwiftShader, a software GPU; twelve frames per view provide the following small sample:

| View | Median interval | 95th percentile | Submitted triangles | Draw calls |
| --- | ---: | ---: | ---: | ---: |
| whole-map | 50.0 ms | 83.3 ms | 32,338 | 46 |
| deck | 99.9 ms | 100.0 ms | 10,629 | 41 |
| room | 83.3 ms | 100.0 ms | 6,755 | 39 |

Software rendering remains slow. These measurements do not establish hardware GPU frame rates or guarantee zero lag. The background cinematic client had a frame gap longer than its 550 ms camera handoff; the foreground client captured the return. The test records that limitation rather than claiming both handoffs rendered. Both clients retain synchronized audio/impact checks, reach gameplay correctly, and render their characters without runtime errors. Full timings, GPU identity and results are in [browser-results.json](browser-results.json).

Converted art and adaptation credits: [ATTRIBUTION.md](../../../public/maps/platform23/ATTRIBUTION.md).
