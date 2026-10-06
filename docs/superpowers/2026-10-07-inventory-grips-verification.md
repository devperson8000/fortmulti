# Inventory, grips and loot verification

The implementation provides five freely arranged firearm slots, immediate local drag swaps/moves with host validation, separate utility controls, continuous 3.5-second chest holds, and shared held/ground weapon GLBs. Weapon instances retain independent ammunition and identity through rearrangement, including an active reload.

## Final checks

- `npm run check`: syntax checks, **200/200 tests passing**, and static build completed; generated `dist` agrees with current sources.
- `npm run test:browser`: **14/14 checks passing**, using two actual app tabs and the normal Connection/BroadcastChannel/host Match path. No browser runtime errors. Maximum immediate local move callback: **8.5 ms** in the final run, with visual capture running concurrently.
- Browser coverage includes occupied swaps, empty moves, preserved equipped identity/ammunition, explicit acknowledgements, duplicate and rapid queued moves, keyboard moves, Tab repeat suppression, outside release, pointer cancellation, focus loss, Q instance identity, queued moves surviving the match menu, Escape priority, utility keys, input suppression, and chest release/completion/exactly-once opening.
- `node scripts/grip-visual-check.mjs`: **40 captures**, no runtime errors. Actual Soldier and weapon GLBs rendered in hip/ADS, three reload stages, 16:9, 4:3 and 21:9; four utility views also captured. Contact sheets and individual views inspected. Inventory populated/dragging/compact, actual gameplay and ground loot screenshots inspected.
- Native skin vertices, bone attachment translations and weapon proportions are preserved. Tests verify measured trigger-fingertip contact, palm contact across 600 animation frames per firearm, native arm reach, centred sights, and world tracer alignment with the rendered muzzle. Utility framing resets to 62° independently of previous ADS.
- Independent whole-change review completed; acknowledgement envelope collision, Q identity, pending operation preservation, keyboard access, utility focus indexing, cropped sleeve framing and inherited utility FOV were corrected. Generic utility finger curls remain the existing approximation; firearm fingers have per-model calibration.
- `git diff --check`: clean.

## Performance measurements and limits

A controlled sequential baseline/current workload used Chromium SwiftShader software WebGL, 1280×720, the same seeded two-player match, movement and camera direction, 100 frames per version. No other browser check was running during this comparison.

| Frame time | Original main | Updated |
|---|---:|---:|
| Median | 166.6 ms | 150.0 ms |
| 95th percentile | 183.4 ms | 183.3 ms |
| 99th percentile | 216.7 ms | 200.0 ms |

Median frame time improved about 10%; tail latency remains substantial under software rendering. Static terrain is partitioned once and culled using full triangle bounds; pickup resources and thumbnails are cached, inventory acknowledgements in snapshots are bounded, and obsolete snapshots cannot select a different weapon after rearrangement. Detailed hand posing carries a small CPU cost: a separate 1,500-pose Node sample measured about 0.179 ms/pose originally and 0.223 ms/pose updated. This environment does not establish hardware-GPU frame rates or zero lag across devices/networks.

Local two-client transport was verified. Live cross-network Supabase sessions and Vercel deployment were not exercised; the static build reports that online configuration requires its Supabase URL/public key. No production database changes were made.

## Reproduction

Install with `npm ci`, run `npm run dev`, then set `GAME_TEST_URL` to the server URL when running either browser script. Set `CHROMIUM_EXECUTABLE` for an installed Chromium binary and `GAME_ARTIFACTS` for the evidence directory. This run saved JSON results, individual PNGs and contact sheets under `/workspace/fortmulti-artifacts`.

Three.js is served locally from the pinned, npm-verified dependency and copied into the static build. Hip framing uses a 68° first-person FOV and a closer/lower anchor; aiming interpolates to 50° while preserving sight centring and muzzle/world projection. Utilities retain their own 62° framing.
