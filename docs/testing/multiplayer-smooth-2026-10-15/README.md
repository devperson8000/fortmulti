# Multiplayer movement and match loading — 15 October 2026

This change addresses two-player rubber-banding, unnecessary rendering/UI work, and the eight-second startup signal timeout. Weapon poses, map geometry, collision rules, deployment music and HCS victory timing are preserved.

## Fixes

- Grounded velocity was inferred from a prediction clock capped at 0.12 seconds. A late snapshot could turn a normal walk into a much faster predicted lunge. Velocity now uses the authoritative interval between snapshots, with a separate receive interval as fallback. Prediction remains bounded during a network stall; genuine large position changes still reset it.
- Losing browser focus now sends neutral input immediately. Hidden pages and menu states continue sending neutral input rather than leaving movement/fire held on the referee.
- Normal match snapshots no longer refresh the entire hidden lobby. The landing map redraws when its contents change and only while the picker is visible. Stable HUD text/styles avoid repeated writes, and non-building items no longer alternate their ammo label with a build-cost label every frame.
- Selecting Platform 23 begins background preparation in the lobby. Ready Up shares the same operation without starting a second download. Preloading cannot activate an incomplete map or supersede a later selection. Rematches reuse loaded resources and shader preparation. Normal fetches respect HTTP cache policy; corrupt/transient retries request fresh data.
- Chest/landing clearance queries use the existing spatial index instead of scanning all 18,693 collision shapes for every candidate. All 24 chest positions and the collision-shape count match the previous revision exactly.
- The old eight-second profile-request timeout was reproduced with an 8.25-second response delay. Profile registration now allows 20 seconds and transient registration failures reconnect. Startup has a bounded 45-second window and a readable timeout message.
- Retried match creation carries one stable request ID. An authenticated retry with the same owner, roster, map and mode reuses the existing match if the first response was lost. Changed settings/start IDs retain the existing-match rejection. Database and authentication failures keep their specific messages.

## Executed verification

`npm run check`: **550 tests passed, zero failures or skips; syntax and static build passed.** This includes real WebSocket referee matches with two and eight clients on each map/mode combination, HCS delay/reconnect rules, map collision checks, and the new motion/cache/preload regressions.

`node scripts/multiplayer-matrix-check.mjs`: **8 checks passed, no browser runtime errors.** Two actual game pages use real rendering and referee WebSockets. Snapshot delivery is held for 60–220 ms in ordered batches. All four map/mode combinations exercise sprinting, stream replacement/reconnect, release of held keys, blur while holding movement and fire, inventory drag, lobby return and rematch. The four movement traces contain 402 rendered samples and no unexpected jumps under the test's displacement limit (`14 × frame duration + 0.5 metres`). This is a bounded regression check, not proof against every possible network failure. [Results](results.json).

`node scripts/hcs-party-start-check.mjs`: the 8.25-second host profile delay, delayed guest registration, intentionally discarded successful creation response, same-match retry, common snapshots, duplicate-start rejection and session/database diagnostics all passed. [Output](startup-check.txt).

`node scripts/map-loading-browser-check.mjs`: **7 checks passed, no browser runtime errors.** Includes a failed lobby preload, bounded explicit retry, corrupt manifest, HTTP failures for geometry and texture, successful two-player recovery, rematch without new asset requests or shader compilation, and Retry Map reconnecting to the current match. [Results](map-loading-results.json).

`node scripts/map-loading-cancellation-check.mjs`: **7 checks passed, no browser runtime errors.** Leaving/rejoining during loading, stale completions, late match-service responses, current-roster deployment and replacement snapshot loads remain safe. [Results](cancellation-results.json).

## Local preparation measurements

Three fresh Node processes per revision imported collision data, built the spatial index and prepared the layout. Baseline is commit `9ca380f`.

| Revision | Runs | Median |
| --- | --- | --- |
| Before | 883 / 840 / 846 ms | 846 ms |
| After | 461 / 432 / 400 ms | 432 ms |

This local preparation stage was about 49% faster. Each result has the same 18,693 collision shapes and identical 24 chest positions. [Measurements and chest positions](map-preparation.json). These timings exclude downloads and shader compilation.

In the software-rendered two-browser matrix, Ready Up to both clients entering the ship took 11.7 seconds for the first Platform 23 game and 3.9 seconds for its rematch. Ironwood games took 2.3 and 2.9 seconds. These include browser automation and rendering overhead; they are not production or M3 load-time guarantees. Facility render counters in the raw matrix report describe the last facility pass, including when the active map is Ironwood; they are not an Ironwood geometry benchmark.

## Actual game screenshots

Captured in Chromium at 960×540, low graphics. The resume notice reflects headless pointer-lock state.

- [Both players in the deployment ship](both-players-in-ship.png)
- [Platform 23 — leader gameplay view](platform23-leader.png)
- [Platform 23 — teammate gameplay view](platform23-teammate.png)
- [Platform 23 Town Royale after jitter/reconnect and inventory swap](facility-town.png)
- [Platform 23 Build mode with gun-only map rules](facility-build.png)
- [Ironwood Town Royale](island-town.png)
- [Ironwood Build](island-build.png)

## Limits and deployment

Authentication, database roster authorization and Supabase party discovery/broadcast are local test fixtures. The referee sockets, simulation, rendering, map assets and browser controls are real. Combat positions are assigned by test-only server hooks after verifying the ship stage. The local machine uses software WebGL, so frame rate here does not measure the user's Apple M3. The production Northflank endpoint could not be reached from this workspace: the network proxy returned HTTP 403 to the CONNECT request. No production multiplayer session was tested.

Run the development site on port 4173, then the four scripts above and `npm run check`. Set `GAME_ARTIFACTS` for browser output. Both Vercel and Northflank must deploy the updated revision for safe startup retries to work together. No SQL migration or new environment variable is required. After deployment, reload both browsers and create a fresh party.
