# Presentation polish verification — 2026-10-07

Follow-up requested: polish the approved inventory, weapon/grip and performance work, then push main. Base: `d5cdb11`.

## Delivered

- Refined five-slot inventory panel, card spacing, readable ammo bars, in-hand badge, capacity count, clearer empty/hover/drop states and compact/mobile layouts.
- Immediate drag/drop remains synchronous. The preview stays within the viewport and clamps continuously at boundaries. Swap/move/original-slot/outside feedback identifies the actual destination; cancellation clears pointer capture, ghost, highlights, keyboard source and stale hint. Keyboard movement back to its source cancels without sending a redundant move.
- Actual weapon-model thumbnail images in quick slots, brighter thumbnail lighting, and the existing transparent logo in the gameplay HUD. Per-frame HUD updates only read warmed thumbnail cache entries and reuse image elements; they never generate previews.
- Refined cached tool geometry/materials: pickaxe round banded handle and chamfered head, shield cylinder/caps, medkit trim and shockwave accents. Existing grip anchors, calibrated gun poses, native attachments, first-person framing and footstep removal remain intact.

## Verification

- `npm run check`: **209 tests passed**, zero failed/skipped; syntax and static build passed.
- `node scripts/inventory-polish-check.mjs`: actual DOM checks passed for ammo/equipped state, destination feedback, viewport bounds, cancellation, keyboard swaps, 390px mobile layout and reduced-motion preferences; zero page errors.
- `npm run test:browser`: **15 checks passed**, zero page errors, including actual matching model images in quick slots and image-node reuse across frames; inventory swap/move/cancellation, acknowledgements, separate utilities, keyboard input isolation and 3.5-second held-E chest opening passed. Max measured synchronous move: **1.8 ms**.
- Actual Soldier/weapon grip tests passed (22 focused tests plus the full suite), including real palms/trigger fingertips and ten remote poses per gun. Tool changes preserve the measured pickaxe shaft grip.
- `node scripts/grip-visual-check.mjs`: **40 real first-person/utility/ADS/reload/aspect captures**, zero runtime errors. Inspected utility/tool renders and the latest real gameplay, populated inventory, active swap and compact inventory screenshots.
- Three drag unit tests cover threshold semantics, preview bounds, and continuous motion at screen edges. Bounds test failed before the helper existed; continuity test reproduced a jump at x=591 before continuous clamping fixed it. The UI check failed on the missing capacity indicator before the UI update, then passed all interactions.
- One independent read-only code review found no critical or important issues; no findings were deferred.
- All six changed public presentation modules/HTML/CSS exactly match regenerated `dist` outputs.

## Performance check

Sequential software-renderer comparison against archived base `d5cdb11`: Chromium SwiftShader, Low graphics, 1280×720 viewport, same seeded two-player walking workload, 100 frames each, no concurrent browser checks. Both versions use 832×468 drawing buffers without context MSAA.

| Frame time | Before polish | Polished |
|---|---:|---:|
| Median | 50.0 ms | 50.0 ms |
| 95th percentile | 66.7 ms | 66.7 ms |
| 99th percentile | 66.7 ms | 66.8 ms |

Measured median and 95th percentile are unchanged; these results describe the software renderer rather than hardware GPU or live network performance. No new frame-time rendering effects or dependencies were added.

## Evidence and reproduction

JSON/PNG evidence is in `/workspace/fortmulti-artifacts`; `polished-screenshots.zip` contains eight latest presentation screenshots. Run `npm ci`, `PORT=4174 npm run dev`, then the commands above. Browser checks support `GAME_TEST_URL`, `CHROMIUM_EXECUTABLE` and `GAME_ARTIFACTS`. Benchmark: `PROFILE_PORT=4174 PROFILE_LABEL=polished node scripts/lag-benchmark.mjs`; use another port to serve an archived baseline for comparison. Live Supabase cross-network sessions and Vercel deployment were not exercised in this polish pass.
