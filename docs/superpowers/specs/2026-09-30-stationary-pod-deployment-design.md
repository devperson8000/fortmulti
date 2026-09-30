# Stationary ship and pod deployment

## Intent

Replace the moving transport and glider opening with a stationary staging ship, individually reserved deployment pods, per-player landing selection, and a short synchronized pod descent. Preserve the current island, combat rules, lobby, private Supabase party, and leader-run authoritative match simulation.

## Existing architecture

The party leader runs `Match` at 30 Hz and accepts sanitized guest inputs through the existing private Realtime room. Clients render snapshots with interpolation. Rendering and combat are custom WebGL and host simulated; the lobby Soldier uses Three.js and the provided Soldier GLB.

## Match flow

1. `waiting` remains the lobby-ready gate.
2. `deployment` begins on the stationary ship. Players move unarmed, choose their own valid map position, then reserve a nearby free pod with E.
3. The host automatically starts the shared seal and launch sequence once every connected living participant has a destination and a reserved pod. Leaving/disconnecting releases an unlaunched pod and removes that participant from readiness.
4. The host advances a timestamped stage clock. The launch lasts about three seconds; a full-screen transition hides authoritative repositioning to each destination. Landing points are clamped to valid island bounds and moved to nearby safe ground.
5. The pod opening and exit animation finishes before movement, weapon selection, building, and combat are enabled in `playing`.

Per-player pod state and destination are included in authoritative snapshots. Repeated interactions are idempotent; stale inputs cannot change a committed pod/destination. Reconnected party clients recover current stage, timer, and destination from the latest snapshot.

## Ship and collisions

The ship is fixed at a high staging altitude and does not traverse the island. A walkable interior is shared by all players. World-space wall and equipment collision boxes stop ship movement; pod shells reserve a collision envelope while their entry mouth remains accessible. Grounding and combat collisions continue to use the existing island geometry once deployed.

## Presentation

Landing map selection uses the existing island POIs and world coordinates. A restrained visual fade covers teleportation; camera shake, FOV, pod lamps, sounds, and ship ambience are time-driven by the same authoritative stage values. Local camera control and movement are gated independently: look remains usable in the ship and returns to normal after exit; movement and weapons are locked while a player is inside a pod.

The original first-person view and custom weapon/combat implementation remain. The uploaded Soldier model and its Idle/Walk/Run clips are reused for third-person players, with cross-fades and procedural crouch/jump/land/weapon posing for states that the asset does not contain.

## Reliability

- Host validation owns destinations, pod reservation, stage advancement, teleport timing, and the point at which match combat starts.
- Unique action IDs and player/stage checks make duplicate and late interactions harmless.
- The sequence clock is snapshot data, not independent per-client timers.
- Only connected living participants gate readiness. Disconnecting a player releases reservations and does not stop the remaining party.
- Safe landing placement checks terrain/building occupancy and deterministic nearby offsets.

## Acceptance

- Two players can choose different destinations, enter different pods, and automatically deploy together.
- A player without a destination cannot enter a pod; two players cannot reserve one pod.
- Ship wall, furniture, and pod geometry block movement.
- No weapon actions succeed before the host enters `playing`.
- The host repositions players only after the launch transition is fully black.
- Snapshot flow recovers the exact current stage, destination, and pod for late/reconnected clients.
- Existing combat, structures, storm/pickups, lobby, and multiplayer snapshot tests continue to pass.
- Aircraft/glider deployment modules, controls, UI, and tests are removed.
