# Multiplayer regression checks — 13 October 2026

Fixed failures reproduced with the real game client and local referee:

- The lobby hid the specific HCS rejection behind “Online services are unavailable.” Safe HCS errors now reach the lobby; database HTTP failures retain a useful status without exposing response bodies.
- A party socket closing before the join acknowledgement kept its connection promise pending, obstructing retries. It now rejects promptly, and completed connection deadlines are cleared.
- Old-mode readiness messages could mark a teammate ready. Both map and mode must match the leader's selection.
- Returning from a normal online match only left one client's stream. An authenticated, leader-owned `/party-end` request now closes that exact match, returns all clients to their existing party and permits immediate rematches. Stale end requests cannot cancel a newer match. Cancelled matches award no qualification stats.
- Leaving a party retained the local official-match flag. It now leaves both transports. A normal-game guest's explicit forfeit eliminates their former body and excludes obsolete snapshots; the party leader leaving closes that normal match and party for everyone. Actual connection failures retain the 60-second reconnect grace. HCS finals keep their existing exit and reconnect rules.
- Delayed leave messages could cancel a newer game; departures now carry their match ID, and stale departures cannot change the new match. Former normal-match membership could interfere with a forfeited player's next game or HCS final. Conflict checks, normal snapshots and final routing now distinguish active competitors from forfeited players.
- A temporary authentication refresh outage discarded the saved identity and signed up another anonymous account. Temporary failures now preserve that identity; genuinely revoked refresh tokens can still create a fresh session.

## Executed checks

`npm run check`: **538 tests passed, no failed or skipped tests; syntax and static build passed.**

`tests/normal-server-multiplayer.test.mjs` connects **two and eight actual WebSocket clients for each combination**:

| Map | Mode | Clients |
| --- | --- | --- |
| Platform 23 | Town Royale | 2 and 8 |
| Platform 23 | Build | 2 and 8 |
| Ironwood Island | Town Royale | 2 and 8 |
| Ironwood Island | Build | 2 and 8 |

Every recipient shares authoritative frame identifiers and receives the expected roster and mode. Platform 23 retains its gun-only map rules in either mode. Existing HCS tests exercise five competitors, eight spectators, the 20-second delay, reconnect grace and verified scores.

`node scripts/multiplayer-matrix-check.mjs`: **8 checks passed, no browser runtime errors.** Two real game pages use actual map assets, rendering and referee WebSockets. All four combinations exercise ready-up, movement, a forced stream disconnect and reconnect, sprint release, inventory dragging, leader/guest lobby return and repeated game starts. Additional checks cover the visible rejection message, stale readiness, guest forfeit and party closure when the leader leaves. [Full browser results](results.json).

`node scripts/hcs-live-browser-check.mjs` also passed: five-player native pod deployment, first-person competition, the separate delayed third-person viewer, five selectable competitors, responsive broadcast controls and returning to the lobby. [Live browser results](live-browser-results.json). These are local live WebSocket checks, not production endpoint validation.

Existing browser regressions also passed: six map-loading/retry checks, seven cancellation/reconnect checks, HCS player selection/input/celebration checks, and delayed-profile match startup checks.

## Screenshots

These are native game captures from the two-player browser matrix at low graphics settings and 960×540. The pause notice reflects headless pointer-lock state; maps, weapons, HUD and snapshots are actual game rendering.

- [Platform 23 — Town Royale](facility-town.png)
- [Platform 23 — Build mode with gun-only map rules](facility-build.png)
- [Ironwood Island — Town Royale](island-town.png)
- [Ironwood Island — Build](island-build.png)
- [Five-player HCS deployment](hcs-five-player-deployment.png)
- [Delayed HCS spectator view](hcs-delayed-broadcast.png)

## Scope and reproduction

Start `npm run dev` on port 4173. Run `npm run check`, `node scripts/multiplayer-matrix-check.mjs`, `node scripts/map-loading-browser-check.mjs`, `node scripts/map-loading-cancellation-check.mjs`, `node scripts/hcs-client-browser-check.mjs` and `node scripts/hcs-party-start-check.mjs`.

Referee authentication, database roster authorization and Supabase party discovery/broadcast are test fixtures. Referee WebSockets, game rendering, map assets, controls and inventory acknowledgements are real. The browser matrix starts in the actual ship stage, then sets combat positions through test-only server hooks to exercise gameplay promptly. It does not replace production authentication or expose a test endpoint.

External Vercel/Northflank access and production credentials remain unavailable in this workspace. These checks do not prove the deployed Supabase schema, keys or origins are correct. Chromium uses software rendering here, so this is not a Mac M3 or internet-latency benchmark.

Both Vercel and Northflank must deploy the same current revision. The new `/party-end` endpoint needs the updated referee; there is no additional SQL migration for these changes. If ready-up still fails, the exact HCS rejection now appears in the lobby. Configuration instructions are in [HCS deployment notes](../../HCS.md).
