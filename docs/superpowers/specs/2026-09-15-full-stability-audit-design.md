# Full Stability Audit Design

## Goal
Make the current multiplayer browser game reliably playable for 3–8 players by removing the confirmed causes of lag, rubber-banding, stale input, database/query overhead, deployment drift, and confusing failure states without replacing the existing architecture unnecessarily.

## Scope
This repair covers the browser client, host-authoritative simulation, Supabase Realtime transport, anonymous authentication/session lifecycle, Supabase RPC/RLS/schema performance, Vercel build verification, and UX around connectivity/configuration. It does not add unrelated features or copy proprietary game assets/code.

## Current architecture
The browser client is a static WebGL app served from `dist/`, generated from `public/`. `app.js` coordinates lobby, party state, match lifecycle and UI. `simulation.js` is host-authoritative. `network.js` provides Supabase Auth, RPC, Realtime and WebRTC voice. `multiplayer-runtime.js` currently monkey-patches transport cadence and client interpolation. Supabase stores rooms, membership, presence and invites and authorizes private Realtime room broadcasts with RLS.

## Confirmed problems
1. The original transport sent guest input and full host snapshots too frequently for multi-player Realtime use, producing congestion and large latency spikes.
2. The current stability patch keeps stale host input alive for too long, which can turn packet loss/disconnects into continued movement and delayed stopping.
3. Full snapshots repeatedly resend unchanged structures/pickups/events, so payload size grows sharply during building-heavy rounds.
4. The renderer rebuilds large procedural character/glider geometry every frame, making CPU/GPU frame time scale poorly with player count.
5. The production Supabase project has three foreign keys without covering indexes and four RLS policies that repeatedly evaluate `auth.uid()` per row.
6. The live Supabase project has no recorded migration history, increasing schema-drift risk.
7. Production build status does not currently prove syntax/tests pass because Vercel runs only `npm run build`.
8. A locally saved Supabase config can override a correct deployment config and leave users connected to stale/wrong infrastructure.
9. The connected Vercel app is not authorized for the team that owns `fortmulti`, so project env/runtime logs cannot currently be inspected through that plugin. GitHub's Vercel check is green, but that is weaker evidence than project-level inspection.

## Repair design
### Multiplayer transport
Keep the host-authoritative model. Continue event-driven input forwarding, but cap stale-input grace below one second and keep heartbeat cadence safely below that timeout. Keep 3-player snapshot cadence responsive while preventing larger parties from saturating Realtime. Add a lightweight snapshot codec that sends full structures/pickups periodically and immediately when they change, while sending compact snapshots in between. Receivers hydrate compact snapshots from their last full baseline. New/reconnected clients must receive a full baseline within a bounded interval.

### Client smoothing and controls
Retain local visual prediction/interpolation so movement and gliding are not tied to snapshot frequency. Clamp extrapolation and reset tracks across bus/landing/large correction boundaries. Preserve local slot/build selection until authoritative state catches up. Do not let stale snapshots overwrite immediate local input intent.

### Rendering performance
Add adaptive rendering controls before the main engine starts: cap render scale on high-DPR devices and cap frame scheduling when sustained frame cost is high. Prefer resolution/frame-budget reduction over lowering model topology. Keep quality changes automatic and conservative.

### Supabase
Add indexes on `duel_room_members(user_id)`, `duel_rooms(host)`, and `duel_rooms(guest)`. Rewrite affected RLS predicates to use `(select auth.uid())`. Preserve anonymous authenticated users intentionally because the game depends on anonymous sign-in. Keep RPC execute grants restricted to `authenticated`; do not grant RPCs to unauthenticated `anon`/`public`. Record the production schema change as a migration and update `supabase.sql` to match.

### Configuration and deployment
When Vercel injects a valid Supabase URL/key, production config wins over any stale browser-saved override. Local/manual config remains available when deployment config is absent. Change Vercel's build command to `npm run check`, which runs syntax checks, tests and then generates `dist/`. Add tests that assert the production build contains the runtime modules and expected config behavior.

## Error handling and UX
Connection/reconnect messages must distinguish configuration/auth failures from transient network loss. Reconnect loops must not run indefinitely after a terminal authorization/config failure. Stale peers must be removed predictably. Online setup should not ask for manual credentials when a valid deployment config exists.

## Testing
Use Node's existing `node:test` suite. Add regression tests for cadence/stale-input bounds, snapshot compaction/hydration, config precedence, renderer quality policy, Supabase SQL invariants, and build/deployment configuration. For each bug: add a failing test first, verify the failure, implement the minimal fix, then verify green. Finish with the full `npm run check`, Supabase verification SQL and both Supabase advisor sets.

## Deployment verification
The isolated repair branch must receive a green Vercel check after `buildCommand` becomes `npm run check`. Only then should it be merged to `main`. After merge, verify the production commit's Vercel check. Full Vercel env/runtime-log inspection remains blocked until the connected Vercel app is authorized for team `team_QsK2qtPZsiF9rEbD34vCfJYa`.
