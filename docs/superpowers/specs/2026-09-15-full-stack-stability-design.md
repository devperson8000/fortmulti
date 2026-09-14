# Full-Stack Stability Repair Design

## Goal
Make Sunny Skirmish reliable and responsive for 2–8 players by removing client state races, reducing multiplayer traffic, hardening reconnect/session handling, optimizing rendering overhead, and bringing the live Supabase schema in sync with the repository.

## Scope
- Browser multiplayer transport, reconnects, presence, party lifecycle, and state synchronization.
- Host-authoritative simulation timing, stale-input tolerance, and snapshot delivery.
- Generic inventory/build-slot selection state so local input cannot be overwritten by stale snapshots.
- Airborne movement/render smoothing and general movement interpolation.
- Renderer performance/quality controls that reduce CPU/GPU pressure without replacing detailed models with visibly low-poly placeholders.
- Supabase Auth/RLS/RPC performance and schema migration history.
- Static build integrity and Vercel deployment verification where connector access permits it.
- Lobby/social/error-state UX polish where failures currently become silent or confusing.

## Non-goals
- No real-world weapon-use guidance or weapon realism work.
- No unrelated feature additions.
- No multiplayer architecture rewrite unless verification proves the current approach cannot meet the target.

## Architecture
Keep the existing host-authoritative simulation and Supabase private Realtime room design. Treat `public/network.js` as transport/session ownership, `public/multiplayer-runtime.js` as compatibility/stability shims, `public/simulation.js` as authoritative game state, and `public/engine.js` as rendering/input. Fix root causes at the owning layer rather than adding more UI workarounds.

For Supabase, preserve anonymous sign-in as an intentional authenticated-user flow, keep RPC functions explicitly executable only by `authenticated`, add missing FK indexes, and rewrite affected RLS predicates to evaluate `auth.uid()` once per statement using `(select auth.uid())`.

## Reliability requirements
- A stale/closing WebSocket must not mark a newer active connection disconnected or schedule duplicate reconnects.
- Session renewal must not silently leave Realtime authenticated with an expired token.
- Party/member timers must be cleaned up on close and must not multiply after reconnects.
- Important input transitions must be delivered immediately; steady input may be rate limited.
- Snapshot rendering must not repeatedly overwrite newer local generic slot/build selection.
- Short packet gaps must not zero movement immediately.
- Out-of-order or duplicate snapshots must not move rendered state backward.
- Same-browser testing must preserve the same party-leader semantics as online rooms.

## Performance requirements
- 3+ players must not recreate unnecessary network traffic at the previous 30 Hz input / 15 Hz snapshot flood.
- Supabase membership/RLS lookups must have covering indexes for their foreign-key access paths.
- Rendering must cap excessive canvas resolution and support adaptive quality under sustained slow frames while retaining detailed nearby/local models.

## UX requirements
- Reconnect, setup, party expiration, and service failures must produce actionable status text rather than silent stalls.
- Buttons that cannot currently act must remain disabled with the state reflected consistently.
- Leaving/switching parties must not leave stale presence, voice, or match UI state behind.

## Verification
- Regression tests are written before each code fix and observed failing for the intended reason.
- Run the full repository `npm run check` when an executable checkout is available; otherwise use syntax/test evidence available from CI/deployment and do not claim local execution.
- Re-run Supabase security and performance advisors after schema changes.
- Verify final GitHub commit status and Vercel deployment status. Direct Vercel project/runtime inspection is conditional on the connector being authorized for the `projectsarecoolbro` team.