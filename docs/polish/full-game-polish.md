# Full game polish — 9 October 2026

The pass covers the existing Ironwood Island and Platform 23 game rather than replacing their art or deployment concept. Real browser fixtures exercise ordinary inputs, local multiplayer transport, host simulation, actual GLBs, audio nodes and UI.

## Changes

- Floor weapon cards now follow the exact native GLB hit by the crosshair. They display the specific weapon name, damage/pellets and magazine information above that model. E sends only the displayed instance ID and eye/hit point. Missing/removed models, looking away, blocked shots and neighboring loot cannot silently collect something else. Full inventories show the drop instruction; five freely arranged slots remain intact.
- Host validation uses generated bounds from each native floor GLB, interaction range and cover/terrain checks. Client floor rotation and bobbing now follow the match clock. Requests carry their round and capture time; rotating model bounds are checked at the captured pose, rather than a later rotation. A visible gun above low cover is checked from the eye ray without a conflicting second torso ray. E consumes a request once; holding it cannot repeatedly collect neighboring guns.
- Moving-player pickup validation retains two seconds of bounded authoritative eye history, so normal snapshot smoothing does not falsely reject a displayed gun. Expired/future/wrong-round requests reject. Current range and cover remain enforced; compensation checks both the captured and current eye rays. Pose history stays out of network snapshots.
- E and X presses have persistent input revisions, so taps between network samples still board a pod, pick the displayed gun, or drop the held gun once. Previous-round drop/pickup revisions are consumed during deployment. The touch interaction button follows the same targeting path and remains available during gameplay.
- The camera can look down far enough to target nearby floor weapons and aim higher. Third-person weapon mounts follow that range, with additional clearance at high aim angles so receivers avoid the helmet.
- Crouch lowers the actual Soldier to the camera's posture height and solves native legs against planted feet without stretching bones. Existing smooth crouch/slide transitions remain; Ctrl toggles crouch or initiates a Shift-run slide, and Shift only runs.
- Hitscan, sniper collision and the scope range query share posture-aware character bounds. Bullets over a crouch/slide miss, visible helmets can receive headshots, and crouched shots originate at the lowered eye/muzzle. Longbow impacts and eliminations retain their specific weapon identity.
- Removed floor weapons, remote weapon mounts and thumbnail clones release their skeleton textures while keeping shared geometry/materials. Fully concealed pod occupants skip animation/IK/render work. The unrelated Fortnut launch button stays in the lobby and is hidden during combat/cinematics.

Weapon damage, names, sampled sounds, existing first-person calibration and the two maps' rules remain intact. Platform 23 is gun-only; Ironwood keeps construction and utilities. Upright chests retain the 0.7-second continuous hold with no displayed timer. The supplied deployment clip plays once through the reveal, impact, walkout and salute.

## Verified

`npm run check`: **422 tests passed, no failures**, including native model grip/finger contacts, bone-length preservation, extreme aim, planted crouch feet, hidden-pod work, texture disposal, exact pickup validation, moving-guest history/captured-rotation validation, brief input taps, combat posture, map geometry/collision, movement, audio, deployment and inventory. Syntax and production build passed. Every public asset matches the built copy, except environment-generated `config.js` as intended.

| Browser check | Result |
| --- | --- |
| Exact pickup | 16 successful weapon/map combinations; no-label E collects nothing; only the displayed instance is collected; touch interaction verified on both maps |
| Gameplay | 22 checks: five slots, instant move/swap, cancellation, network acknowledgements, chest holds, reload/audio, Ctrl/Shift/slide and real connected walls/ramps |
| Weapon variants | 9 checks: all four additions, model previews, names, ammo, individual one-shot voices, Breacher reload, quick X drop and inventory rearrangement |
| Lobby | 2, 4 and 8 connected operators; desktop, compact and phone framing; local-only character preview; removed players cleaned up |
| Outfits | All six presets distinct, character preview updated, reload persistence, teammate outfit synchronization |
| Aim HUD | Camera-following compass through north, stable marker DOM, live scope range against moving cover, sky clears range |
| Platform 23 | 24 checks: native geometry, shared map/pad selection, sealed boarding/launch, music/reveal/impact, walkout/salute, supported walking, gun-only enforcement, remote slide, upright chest, exact pickup and local/remote gun audio |
| Ironwood deployment | 14 checks: exterior boarding and teammate wait, floor launch before black, cue-driven music/logo, sealed descent, bass-drop impact, visible walkout/salute, first-person handoff and working building/gameplay |
| First-person visual run | 76 renders across eight weapons, hip/ADS/reload, wide/compact framing and utilities; no page errors |
| Third-person visual run | 96 renders across eight weapons, idle/crouch/knee-slide/reload/up/down, front and side; no page errors |

Selected real renders and complete result JSONs are in [screenshots/full-polish](../../screenshots/full-polish). Fixtures place items/players through a test harness; inputs and guest-to-host authority still use the normal app path. No production database was changed.

The independent review reproduced a 0.979 m difference between the rendered eye and authority during a 550 ms snapshot replay. The resulting native AR triangle is retained as a regression fixture; it now collects correctly. The revised validation passed the second independent review.

## Performance evidence and limits

Platform 23 submitted 32,338 triangles/46 calls in the whole-map profiling view, 10,629/41 on the deck, and 6,755/39 in the room fixture. All profiled views retained a valid WebGL context, and the map run reported no WebGL errors. Skeleton cleanup and hidden-pod skips have regression tests; bounded effects, spatial culling and adaptive quality remain active.

This cloud environment uses Chromium's **SwiftShader software GPU**, not hardware acceleration. With 12 samples per view, frame medians/p95 were 50/66.7 ms (whole map), 99.9/100 ms (deck) and 83.3/100 ms (room fixture). These results prove rendering completion, not smooth hardware gameplay; software rendering still stalls, including a missed background camera-handoff capture noted in the map results. Hardware FPS and real-device play still need measurement before any zero-lag claim.

Multiplayer checks use separate connected pages over local BroadcastChannel, including an eight-player lobby. Production Supabase WAN latency, discovery, voice and credentials were not available for end-to-end verification. Existing simulation/network tests and input cadence checks pass; local party checks are not an internet latency benchmark.

## Repeating the checks

Start the built app and set `GAME_TEST_URL` to its URL. Use `GAME_ARTIFACTS` for each output directory. Useful commands:

```sh
npm run check
npm run test:pickup-browser
npm run test:browser
npm run test:weapon-variants-browser
npm run test:lobby-browser
npm run test:outfit-browser
npm run test:aim-hud-browser
npm run test:platform23-browser
npm run test:deployment-browser
node scripts/grip-visual-check.mjs
GAME_POSES=idle,crouch,slide,reload,up,down node scripts/remote-grip-visual-check.mjs
```

Browser checks use an installed Chromium or Playwright Chromium. Video recording also requires Playwright's FFmpeg. For this workspace, the installed system FFmpeg was linked into `/workspace/fortmulti-artifacts/playwright/ffmpeg-1011/ffmpeg-linux` and the deployment check used `PLAYWRIGHT_BROWSERS_PATH=/workspace/fortmulti-artifacts/playwright`.

Exact pickup and weapon-variant checks are included in GitHub Actions alongside the existing deployment/audio/gameplay/map checks. Regenerate native pickup bounds with `node scripts/pickup-bounds.mjs` after changing weapon models or their floor scale.
