# Horizon Championship Series

HCS appears beside Character in the lobby. All players choose a nickname on their first visit; the hidden anonymous account is remembered on that browser. A nickname alone cannot recover an account on another device or after clearing browser storage.

The first edition is **Sunday 1 November 2026, 7pm Australia/Sydney**, then every third Sunday at the same Sydney wall time, including daylight-saving changes. The lobby countdown is continuous; a home promotion appears seven days before. Both online modes award 100 points per match win and 10 per elimination after ten completed qualifying games. The ranking tie breaks are wins, kills, win rate, then stable account ID. Local practice and HCS finals never award qualification points.

Standings freeze 48 hours before. The top five receive invitations, and ranks six through nine are reserves. Check-in opens at 6:45pm. Five connected, checked-in qualifiers start at 7pm. At 7:05pm, absent places are filled by connected, checked-in reserves in ranking order. Three or four entrants can play; fewer than three postpone that edition one week and retain the locked ranking. The normal three-week anchor remains unchanged. If fewer than three players have qualified at all, qualification reopens for the postponed week; existing qualifiers retain their places and additional entrants can fill the ranking.

The final is one gun-only Town Royale round on Platform 23, with five distinct pod landings and a map-sized shrinking storm. The last survivor becomes champion. Reconnects have 60 seconds; disconnected bodies stay vulnerable. Spectators watch in third person using a separate authenticated stream, never occupy contestant slots, cannot send controls, and can switch players. Competitors retain first-person gameplay. When the viewed competitor is eliminated, the camera, player selector and stats move together to a living competitor. Reconnect notices appear directly in the broadcast controls; stale sockets and cancelled map loads cannot reopen a departed final. Failed final maps show Retry Map in the HCS tab. Retry uses the newest received state while the server match continues; switching matches discards stale load failures as well as stale completions. Snapshots and public results are delayed 20 seconds. Previous champions remain in the service history.

The winner’s return salute starts on “Big” and reaches the full-hand pose on “stepper”, with an audio-clocked camera push, tighter framing and a brief settling recoil. [Timing checks and native screenshots](testing/hcs-stepper-2026-10-17/README.md).

## Activate online

The static Vercel site cannot run the continuous referee. Deploy `server/Dockerfile` from the repository root to a host supporting persistent Node processes, HTTPS and WebSockets (one replica). The service starts with `node server/hcs-server.mjs`, normally port 4201. Apply `supabase/migrations/20261009120000_hcs_state.sql` to the existing Supabase project first, and keep anonymous sign-in enabled.

Set these **only on the referee** using the host's secret settings:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (never in the static site or browser)
- `HCS_ORIGINS`: comma-separated exact allowed site origins, with no trailing slash.
- `PORT` if required by the host.

Northflank can also run this Dockerfile as a Combined Service: repository-root build context `/`, Dockerfile `/server/Dockerfile`, one replica, and public HTTP port 4201. Use `/state` for the health check. The browser uses the generated HTTPS endpoint. Runtime variables belong on the service, not in Docker build arguments. Website origins tolerate surrounding whitespace and trailing slashes; other websites remain blocked.

Set **`HCS_SERVER_URL=https://your-referee-host` on the static site's build environment**, alongside its existing public Supabase configuration, and rebuild. The service authenticates anonymous Supabase accounts, verifies party membership and room ownership, and computes qualifying results with the existing simulation. It accepts no browser-submitted scores. Verified online games use the referee; unconfigured ordinary games continue unchanged and are not ranked. If a configured referee cannot start a qualifying game, the game does not silently award practice results.

A service-only database lease prevents concurrent referee instances from producing conflicting results. It renews every ten seconds; loss shuts down the process. If a process restarts during a final, that edition is postponed one week rather than inventing a winner. Qualifying matches in progress on a service restart are abandoned and do not award partial results.

No production HCS credentials were available in the implementation environment. The migration and live deployment must be applied/configured before official standings can accumulate; the lobby honestly shows an offline state until then.

## Moving the website to horizon-fps.vercel.app

The game address and referee address are different settings:

- Northflank runtime `HCS_ORIGINS`: `https://horizon-fps.vercel.app`. Redeploy the running service after saving this value. To keep both game addresses working, use `https://horizon-fps.vercel.app,https://fortmulti.vercel.app`.
- Vercel build `HCS_SERVER_URL`: `https://p01--horizon-hcs--yf5q7tyyggsr.code.run`. Keep this pointing at the referee, even when the website address changes. Set it for Production, then redeploy the website.
- The website's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` must refer to the same Supabase project as Northflank's three Supabase variables. Never copy the service-role key to Vercel's frontend configuration.
- The Supabase project needs the current repository-root `supabase.sql` **and** `supabase/migrations/20261009120000_hcs_state.sql`. The HCS migration alone does not install the party membership schema.

Both players should reload the new game address, leave their previous party and create a fresh party after deployment. Switching website origins creates separate browser storage and may create a different anonymous account; it does not transfer previous qualification statistics automatically.

Opening the referee's `/state` proves only public standings are available. It does not prove anonymous authentication, WebSockets or party authorization work. The HCS tab now distinguishes standings-only connectivity from a registered player connection. Match start waits for the host's profile and briefly retries an explicit connecting-roster rejection. An existing match, invalid session, database failure or unknown network failure is not automatically retried as a new match.

The lobby reports actionable failures without exposing database response bodies or credentials. A database error requires checking the backend Supabase project, service-role credentials and multiplayer schema; an expired/rejected session requires reloading and checking that both deployments use the same project. An existing-match rejection requires returning players to the lobby and letting the old match close. A stream timeout requires checking the deployed origin list and WebSocket access.

## Verification

`npm run check` runs the existing suite plus HCS schedule, selection, authentication, final, reconnect and delayed-stream tests. `npm run test:hcs` runs the HCS browser gate/layout checks. `node scripts/hcs-party-start-check.mjs` exercises real two-player Platform 23 referee startup, delayed profile registration on both clients, shared snapshots, and safe failure messages. It requires the development site on port 4173; local-network permission is granted only to that loopback test origin. `tests/hcs-multiplayer.test.mjs` connects five players and eight spectators to the real WebSocket service. Test identities and accelerated clocks are injected only by test code; there is no production test login or public result-injection endpoint.

Browser screenshots and test reports are written to `/workspace/fortmulti-artifacts/hcs` by default. These are local software-rendered checks, not a guarantee of zero lag on every computer or internet connection.

HCS polish checks cover mobile event-card bounds and broadcast controls, first-person competitors, third-person viewers, player selection after elimination, visible reconnect status, stale WebSocket callbacks and leaving during map loading.

## Normal-match lifecycle

Returning to the party lobby ends the current normal match through a leader-authorized `/party-end` request. Both clients retain their party connection and can ready up again immediately. The request includes the match ID, so a delayed request cannot cancel a newer match. Cancelled games do not award qualifying scores. Leaving a normal party clears the local match transport; a guest explicitly forfeits their old match, while the leader leaving closes that party for everyone. Network interruptions keep the existing 60-second grace, and final broadcasts retain their separate rules. Deploy the updated referee alongside the website; this change adds no SQL migration.

The lobby preserves safe HCS failure messages and sanitized database HTTP status messages instead of replacing them with one generic error. A successful public standings response alone still does not validate authenticated party creation. [Multiplayer regression evidence](testing/multiplayer-2026-10-13/README.md) covers both modes on both maps, two/eight-client server matches, browser reconnects and rematches.

Match startup waits for each player's authenticated stream and profile. Profile registration has a 20-second deadline; the bounded startup window is 45 seconds. A stable, leader-owned request ID permits a lost creation response to be retried without starting another match. Different settings, rosters or start IDs cannot adopt an existing match. Explicit database and authentication errors still stop with their specific diagnostics.

The selected map warms in the lobby without changing the active world. Ready Up shares that work; successful downloads and shader preparation are reused for rematches. Failed attempts remain bounded and can be retried. Motion rendering uses authoritative snapshot time to infer speed, and focus loss sends neutral movement/fire immediately. [15 October loading and movement checks](testing/multiplayer-smooth-2026-10-15/README.md) include delayed snapshots and an intentionally lost match-creation response. Deploy both the website and Northflank referee from this revision; no SQL migration or new environment variable is needed.

## Backend efficiency and connection UX

Persistence failures back off from one second to a maximum of 30 seconds, retaining the newest unsaved state and preserving the shutdown flush. A slow spectator's obsolete snapshots are skipped above 64 KiB of queued data; control messages remain reliable, and the existing 256 KiB disconnect limit bounds stalled connections. Live physics and competitor updates remain 30 Hz. The replay buffer stores the 10 Hz broadcast frames plus immediate phase changes, retaining the full 20-second delay and a small margin even without spectators.

Unchanged online presence shares pending writes and refreshes on a 15-second minimum heartbeat; activity, party and outfit changes publish immediately. Active matches, including HCS, stop polling lobby player/invite lists. The current match shows a compact reconnect or delayed-update notice above the aiming area and clears it when fresh current-socket gameplay arrives. Standings refreshes share pending requests; a late GET cannot undo confirmed check-in or update a closed client. Existing rows remain intact when rankings have not changed. [Backend and UX verification](testing/backend-ux-2026-10-15/README.md) records tests, local measurements and screenshots.
