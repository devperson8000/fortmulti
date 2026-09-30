# Stationary ship and pod deployment implementation plan

**Goal:** Replace the transport/glider intro with an authoritative ship → map selection → pod → concealed descent → landing → playable match sequence, and use the Soldier model/animations in the real multiplayer renderer.

**Architecture:** Keep the existing host-run `Match`, Supabase Realtime protocol, raw WebGL island/combat renderer, collision system, and weapon simulation. Add a pure timestamped deployment state module and ship geometry/collision module. Snapshots carry each player's destination/pod/animation state; clients present the shared clock and hide server repositioning under a fade. Add a Three.js character pass sharing the current WebGL context/depth buffer, with a procedural avatar fallback if the GLB is unavailable.

**Tech stack:** ES modules, browser WebGL, Three.js 0.186.0 GLTFLoader, Node `node:test`, existing `npm run check`.

### Task 1: Deployment timeline and validation tests

1. Add timeline boundary and landing-sanitization tests.
2. Add match behavior tests for missing destinations, pod proximity/uniqueness, auto-readiness, individual destinations, late/duplicate actions, disconnects, and hidden teleport timing.
3. Replace obsolete aircraft tests with ship collision and snapshot recovery tests.
4. Run targeted tests and confirm failures before implementation.

### Task 2: Host simulation state machine

1. Add ship bounds, pod positions, collision boxes, safe-landing search and stage clock.
2. Replace aircraft/glider fields and update loops with ship walking, pod entry, shared seal/launch, black transition, landing, opening and exit.
3. Gate weapon selection, firing, reloading, movement, builds, storm, and round timer to `match_active`/`playing`.
4. Add idempotent landing and pod interaction handling through sanitized input and snapshots.

### Task 3: Match renderer and controls

1. Replace the moving-aircraft interior with a larger fixed ship interior, visible pods, emissive strips and staging details.
2. Add map selection overlay and deployment status, E interaction hints, black fade, launch camera impulse, and audio cues.
3. Ensure ship and pod colliders match visible geometry; keep camera inside the ship and pod.
4. Replace aircraft/glider UI strings and controls.

### Task 4: Character and weapon presentation

1. Bundle the user-provided Soldier GLB and use Idle/Walk/Run cross-fades for local/remote third-person models.
2. Layer supported jump/fall/land/crouch/weapon/reload poses over the available clips; retain the first-person local camera and existing view model/combat.
3. Add legally usable glTF gun assets to the existing first-/third-person weapon rendering with a procedural fallback and preserve simulation stats/reload/fire effects.
4. Keep render cost bounded for the eight-player cap and recover cleanly when assets fail to load.

### Task 5: Integration and verification

1. Update README, HTML, CSS, import map/module syntax checks and package build metadata.
2. Run deployment/combat/network/render tests and `npm run check`.
3. Smoke test lobby → ship → pick destinations → enter pods → synchronized launch/black transition → landed pod exit → combat using two local browser tabs where available.
4. Review repository diff and publish a feature branch/PR without merging.
