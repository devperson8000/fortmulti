# Backend efficiency and UX — 15 October 2026

This pass reduces unnecessary server, database and interface work while preserving game rules, maps, weapon models, grips, audio and cinematic timing. It also fixes confirmed check-in and connection-feedback problems.

## Reproduced issues and fixes

| Reproduction | Previous behavior | New behavior |
| --- | --- | --- |
| Persistence endpoint fails immediately | Six save attempts in roughly 0.2 seconds | Retry after 1, 2, 4… seconds, capped at 30 seconds; latest state retained |
| Two identical presence updates overlap | Two writes | One shared write; successful unchanged state refreshed no more often than every 15 seconds |
| Two-player combat runs for several seconds | Eight extra lobby player/invite reads in the reproduced interval | Zero lobby-list reads during each tested match |
| Score, alive count and round labels stay unchanged | 70 DOM mutations in one 0.7-second sample | Zero mutations in all four new idle checks |
| Five-player referee advances 600 ticks | 600 cloned replay frames | 200 cloned replay frames; physics remains 30 Hz |
| Standings refresh starts during another refresh | Two overlapping GET requests | One pending request shared by callers |
| Old standings response arrives after confirmed check-in | Could undo the displayed check-in | Confirmed state is retained |

The replay buffer is also bounded by elapsed time, retaining the full 20-second delay plus a one-second margin without requiring a viewer to consume it. Phase changes enter the buffer immediately, including the winning frame. Competitors still receive 30 Hz updates and spectators still receive 10 Hz; no spectator sees a winner early.

Briefly congested sockets skip obsolete snapshots above 64 KiB of queued output. Reliable control messages still pass, recovered sockets receive current state, and the existing 256 KiB disconnect threshold remains. This does not queue an ever-growing backlog of old gameplay.

Normal games and HCS now show a compact reconnect/delayed-update notice above the crosshair. Fresh gameplay from the current socket clears it. The one-second UI timer respects reconnect backoff instead of bypassing it. Unchanged standings retain their rows, the date formatter is reused, and stable HUD values avoid repeated writes. HCS competitors/viewers are marked busy rather than advertised as available for invitations. Opening the social panel requests fresh lobby data.

## Verification

- `npm run check`: **558 tests passed, no failed or skipped tests; syntax and static build passed.** Includes real two/eight-client WebSocket matches on both maps and modes, five HCS competitors/eight spectators, verified scoring, reconnect grace, exact spectator-delay boundaries, persistence backoff, replay retention, presence coalescing and socket congestion behavior.
- `node scripts/multiplayer-matrix-check.mjs`: **8 checks passed, no browser runtime errors.** Actual two-browser rendering and referee streams across both maps/modes with 60–220 ms snapshot jitter, forced stream replacement, movement, key release, blur during movement/fire, inventory dragging, rematches and party departure. Each idle score sample has zero redundant mutations and each active match has zero lobby-list reads. No unexpected movement jumps occurred. Reconnect feedback fits above the aiming area and clears after recovery. [Results](multiplayer-results.json).
- `npm run test:hcs-ux`: **6 checks passed, no browser runtime errors.** Controlled browser responses reproduce overlapping polls, the check-in race, unchanged standings, reconnect backoff, normal-match reconnect feedback and late HTTP completion after closing. This command is now registered in GitHub Actions. [Results](hcs-ux-results.json).
- `node scripts/hcs-live-browser-check.mjs`: **6 checks passed, no browser runtime errors.** Actual five-player automatic deployment, authenticated check-in, a separate delayed third-person viewer, five selectable competitors, stats, small-screen controls and return to lobby. [Results](hcs-live-results.json).
- `node scripts/hcs-client-browser-check.mjs`: selector stability, elimination switching, reconnect, cancelled loading, input transport and champion presentation passed. [Output](client-check.txt).
- `node scripts/hcs-party-start-check.mjs`: the slow profile, lost creation-response retry, same-match recovery and safe error messages still pass. [Output](startup-check.txt).

## Local referee measurement

The same five-player, 600-tick simulation benchmark ran before and after the change. These are individual local runs; they do not establish production latency or Mac M3 frame rate.

| Metric | Before (`7b4e97f`) | After |
| --- | ---: | ---: |
| Retained replay frames after 600 ticks | 600 | 200 |
| Median tick | 1.005 ms | 0.822 ms |
| 95th percentile tick | 7.576 ms | 6.302 ms |
| Longest tick | 24.169 ms | 24.429 ms |

The replay clone count falls by two thirds in this interval. The longest sampled tick was effectively unchanged, so this is not a claim of zero stutter. [Before measurement](referee-before.json) · [After measurement](referee-after.json).

## Native screenshots

The game captures use software-rendered Chromium at low settings. Production graphics settings, mesh detail and resolution policies were not reduced by this change.

- [Reconnect feedback during a real multiplayer socket interruption](reconnecting.png)
- [Platform 23 Town Royale](facility-town.png)
- [Platform 23 Build mode, retaining its gun-only rules](facility-build.png)
- [Ironwood Town Royale](island-town.png)
- [Ironwood Build](island-build.png)
- [Five-player HCS deployment](hcs-five-player-deployment.png)
- [Delayed third-person broadcast](hcs-delayed-broadcast.png)
- [Broadcast controls at a 390-pixel viewport](hcs-mobile-broadcast.png)

## Scope and reproduction

Run the development site on port 4173, then the commands above. `GAME_ARTIFACTS` selects browser output. The new HCS UX script also accepts `GAME_TEST_URL` and `CHROMIUM_EXECUTABLE`, and falls back to Playwright's installed browser when no system Chromium exists.

Database/authentication and Supabase party discovery are fixtures in these checks. Referee WebSockets, simulation, game assets, rendering and browser controls are real in the native checks. Normal-match combat positions are set through test-only server hooks after verifying ship startup. Raw matrix facility render counters describe the last facility pass, including when Ironwood is active; they are not an Ironwood geometry benchmark.

No production session or internet-latency measurement was possible in this workspace. Network conditions and server region still affect responsiveness. Deploy the same current revision to **both Vercel and Northflank**, then reload clients and start a fresh party. No SQL migration, new dependency or new environment variable is required.
