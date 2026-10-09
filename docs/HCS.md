# Horizon Championship Series

HCS appears beside Character in the lobby. All players choose a nickname on their first visit; the hidden anonymous account is remembered on that browser. A nickname alone cannot recover an account on another device or after clearing browser storage.

The first edition is **Sunday 1 November 2026, 7pm Australia/Sydney**, then every third Sunday at the same Sydney wall time, including daylight-saving changes. The lobby countdown is continuous; a home promotion appears seven days before. Both online modes award 100 points per match win and 10 per elimination after ten completed qualifying games. The ranking tie breaks are wins, kills, win rate, then stable account ID. Local practice and HCS finals never award qualification points.

Standings freeze 48 hours before. The top five receive invitations, and ranks six through nine are reserves. Check-in opens at 6:45pm. Five connected, checked-in qualifiers start at 7pm. At 7:05pm, absent places are filled by connected, checked-in reserves in ranking order. Three or four entrants can play; fewer than three postpone that edition one week and retain the locked ranking. The normal three-week anchor remains unchanged. If fewer than three players have qualified at all, qualification reopens for the postponed week; existing qualifiers retain their places and additional entrants can fill the ranking.

The final is one gun-only Town Royale round on Platform 23, with five distinct pod landings and a map-sized shrinking storm. The last survivor becomes champion. Reconnects have 60 seconds; disconnected bodies stay vulnerable. Spectators use a separate authenticated stream, never occupy contestant slots, cannot send controls, and can switch players. Snapshots and public results are delayed 20 seconds. Previous champions remain in the service history.

## Activate online

The static Vercel site cannot run the continuous referee. Deploy `server/Dockerfile` from the repository root to a host supporting persistent Node processes, HTTPS and WebSockets (one replica). The service starts with `node server/hcs-server.mjs`, normally port 4201. Apply `supabase/migrations/20261009120000_hcs_state.sql` to the existing Supabase project first, and keep anonymous sign-in enabled.

Set these **only on the referee** using the host's secret settings:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (never in the static site or browser)
- `HCS_ORIGINS`: comma-separated exact allowed site origins, with no trailing slash.
- `PORT` if required by the host.

Set **`HCS_SERVER_URL=https://your-referee-host` on the static site's build environment**, alongside its existing public Supabase configuration, and rebuild. The service authenticates anonymous Supabase accounts, verifies party membership and room ownership, and computes qualifying results with the existing simulation. It accepts no browser-submitted scores. Verified online games use the referee; unconfigured ordinary games continue unchanged and are not ranked. If a configured referee cannot start a qualifying game, the game does not silently award practice results.

A service-only database lease prevents concurrent referee instances from producing conflicting results. It renews every ten seconds; loss shuts down the process. If a process restarts during a final, that edition is postponed one week rather than inventing a winner. Qualifying matches in progress on a service restart are abandoned and do not award partial results.

No production HCS credentials were available in the implementation environment. The migration and live deployment must be applied/configured before official standings can accumulate; the lobby honestly shows an offline state until then.

## Verification

`npm run check` runs the existing suite plus HCS schedule, selection, authentication, final, reconnect and delayed-stream tests. `npm run test:hcs` runs the HCS browser gate/layout checks. `tests/hcs-multiplayer.test.mjs` connects five players and eight spectators to the real WebSocket service. Test identities and accelerated clocks are injected only by test code; there is no production test login or public result-injection endpoint.

Browser screenshots and test reports are written to `/workspace/fortmulti-artifacts/hcs` by default. These are local software-rendered checks, not a guarantee of zero lag on every computer or internet connection.
