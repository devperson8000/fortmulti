# Rendering performance and remote grip verification — 2026-10-07

User-requested follow-up: reduce remaining gameplay lag, correct other players' gun/arm/hand poses shown in the supplied screenshot, improve pickaxe grip visibility, and remove footstep audio. Integrated with main's newer sliding and build-placement changes through `b14af48`.

## Changes

Low graphics now scales the actual drawing buffer to 65% per dimension even on a device-pixel-ratio-one display; medium uses 85%, and high retains its full resolution budget. Automatic quality starts at medium and retains its existing hysteresis. Context multisample antialiasing is disabled: this costly context attribute cannot be changed when the user lowers quality during a match. Hidden first-person local bodies skip their mixer and arm posing. HUD/menu dimensions remain independent of the drawing buffer.

Remote guns use the shipped GLB model and first-person grip calibration, mounted independently of the animated hand so the barrel follows player yaw/pitch. The authoritative snapshot now carries sanitized pitch. Weapon placement follows the animated shoulder centre after crouch/slide/spine/landing layers, offset forward, right and below the shoulders. Hands solve against actual grip/receiver contacts; the shorter native remote arms support the receiver near its rear instead of stretching to the far camera-rig fore-end point. Finger posing resets to native rest rotations before calibrated curls, preventing idle/run finger tracks from overriding contact. Native bone attachment translations remain intact. Pickaxe fingers wrap the shaft and its raised first-person placement keeps the gripping hand visible. Walking sounds and their update call are removed.

## Verification

- `npm run check`: syntax checks, **207 tests passed**, zero failed/skipped, and static build succeeded after merging main.
- `npm run test:browser`: **14 checks passed**, zero page errors; real two-tab BroadcastChannel inventory swaps/moves, acknowledgements, cancellation, utility controls and held-E chest opening. Maximum observed synchronous inventory move: **1.3 ms**.
- `node scripts/grip-visual-check.mjs`: **40 first-person/utility captures**, zero runtime errors, including real GLB hip/ADS/reload and aspect-ratio cases. The first-person source covered by these captures is unchanged by the subsequent merge/remote placement fix.
- `node scripts/remote-grip-visual-check.mjs`: **80 remote captures**, zero runtime errors; all four weapons in idle, run, ADS, crouch, reload, up/down aim, slide, jump and fall, from front and side. Inspected individual frames and full front/side sheets.
- Actual Soldier/weapon GLB tests independently verify barrel direction, both palm contacts within 3 mm, trigger fingertip contact, shoulder-relative placement and actual receiver clearance ahead of the head across those ten poses.
- Footstep audio function/call absent from `public` and regenerated `dist`.

## Independent review and correction

One fresh whole-change review found an important placement issue: the first proposed mount still put the receiver through the torso/head despite passing hand-contact tests. Added shoulder-relative body placement and actual trigger/receiver clearance assertions, observed failure, moved the weapon forward/lower/right, then observed the corrected suite pass. Integrating main's sliding exposed a second contact failure in that same placement correction: following the animated shoulder centre fixed it without stretching native bones. All final checks above ran after integration. No findings were deferred.

## Controlled performance comparison

Chromium SwiftShader software WebGL, 1280×720 viewport, device ratio 1, Low graphics, same seeded two-player walking workload, 100 frames per version. Original snapshot: `c17ed34`; final merged implementation: `dd4c2a5`. Versions run separately with no concurrent browser checks. These measurements describe this software renderer, not hardware GPU or cross-network latency.

| Measurement | Original | Final |
|---|---:|---:|
| Median frame time | 150.0 ms | 50.0 ms |
| 95th percentile | 183.4 ms | 66.7 ms |
| 99th percentile | 266.7 ms | 66.8 ms |
| Frames above 50 ms | 99/100 | 17/100 |
| Drawing buffer | 1280×720 | 832×468 |
| Context MSAA | enabled | disabled |

Median frame time decreased 66.7%. An earlier comparison also measured 116.7→50.0 ms; software-renderer timings vary with machine load. Significant software-rendering tail latency remains. No claim of zero lag or live cross-network/Vercel validation is made.

## Reproduction

`npm ci`, `PORT=4174 npm run dev`, then run the check commands above. Browser scripts accept `GAME_TEST_URL`, `CHROMIUM_EXECUTABLE` and `GAME_ARTIFACTS`. Performance script: `PROFILE_PORT=4174 PROFILE_LABEL=current node scripts/lag-benchmark.mjs`; point `PROFILE_PORT` at a separately served baseline to compare the same workload. Benchmark output includes actual canvas dimensions and context antialias status. JSON/PNG evidence for this run is in `/workspace/fortmulti-artifacts`.
