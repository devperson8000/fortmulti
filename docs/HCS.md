# Horizon Championship Series

HCS appears beside Character in the lobby. All players choose a nickname on their first visit; the hidden anonymous account is remembered on that browser. A nickname alone cannot recover an account on another device or after clearing browser storage.

The first edition is **Sunday 1 November 2026, 7pm Australia/Sydney**, then every third Sunday at the same Sydney wall time, including daylight-saving changes. The lobby countdown is continuous; a home promotion appears seven days before. Both online modes award 100 points per match win and 10 per elimination after ten completed qualifying games. The ranking tie breaks are wins, kills, win rate, then stable account ID. Local practice and HCS finals never award qualification points.

Standings freeze 48 hours before. The top five receive invitations, and ranks six through nine are reserves. Check-in opens at 6:45pm. Five connected, checked-in qualifiers start at 7pm. At 7:05pm, absent places are filled by connected, checked-in reserves in ranking order. Three or four entrants can play; fewer than three postpone that edition one week and retain the locked ranking. The normal three-week anchor remains unchanged. If fewer than three players have qualified at all, qualification reopens for the postponed week; existing qualifiers retain their places and additional entrants can fill the ranking.

The final is one gun-only Town Royale round on Platform 23, with five distinct pod landings and a map-sized shrinking storm. The last survivor becomes champion. Reconnects have 60 seconds; disconnected bodies stay vulnerable. Spectators watch in third person using a separate authenticated stream, never occupy contestant slots, cannot send controls, and can switch players. Competitors retain first-person gameplay. When the viewed competitor is eliminated, the camera, player selector and stats move together to a living competitor. Reconnect notices appear directly in the broadcast controls; stale sockets and cancelled map loads cannot reopen a departed final. Snapshots and public results are delayed 20 seconds. Previous champions remain in the service history.

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
