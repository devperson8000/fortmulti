# First-Person Combat Integration Design

**Project:** Sunny Skirmish / `devperson8000/fortmulti`  
**Target release:** v8 on `test` only  
**Date:** 2026-09-16  
**Status:** Design awaiting final approval

## 1. Objective

Convert the landed combat experience from an offset third-person camera to a polished first-person presentation while preserving the existing lobby, multiplayer rooms, island, transport/drop sequence, gliding, building, storm, inventory, and host-authoritative simulation.

The uploaded `LONGSHOT-v7-training.html` is a design and implementation reference for weapon presentation, procedural motion, atmospheric rendering, quality controls, and optimized effects. The resulting game remains an original, fast battle-royale experience rather than adopting LONGSHOT's slower training loop or copying another game's protected assets and interface.

## 2. Non-goals

- Do not modify the lobby composition, party flow, social drawer, outfit flow, or ready-up behavior.
- Do not migrate the current custom WebGL renderer to Three.js or React Three Fiber in this release.
- Do not run the LONGSHOT renderer beside the existing renderer.
- Do not add the planned military transport plane yet.
- Do not change the current Supabase database schema.
- Do not publish or merge to `main` without a later explicit user instruction.

## 3. Experience State Machine

The camera presentation is derived from authoritative player state:

1. **Lobby:** existing lobby camera and character presentation, unchanged.
2. **Transport:** existing cinematic third-person transport camera.
3. **Freefall / deployment / glide:** existing third-person aerial camera and visible full character.
4. **Landing transition:** on the local player's `land` event, blend from the final third-person aerial view to first-person eye position over 0.45 seconds using a cubic ease. Input remains active, but firing is suppressed until the transition is at least 70% complete to prevent a hidden-camera shot.
5. **Landed combat:** first-person camera at the player eye anchor. The local world avatar is hidden while the foreground arms and selected item are shown. Remote players continue using the existing full-body procedural character.
6. **Building:** still first-person. Replace the gun view model with a blueprint/tool presentation and retain the existing world-space build preview.
7. **Eliminated spectator:** use the existing third-person spectating camera and hide the local first-person view model.

The transition is monotonic per life: aerial states cannot accidentally enter first-person before landing, and landed state cannot return to aerial third-person except through a new round reset.

## 4. Rendering Architecture

### 4.1 World pass

Keep the current world renderer, terrain, structures, remote characters, lighting, and world effects. During landed first-person play, do not submit the local full-body character to the world pass. This prevents the head, hair, or shoulders from clipping through the camera.

### 4.2 Foreground view-model pass

Add a second pass after the world pass:

- Clear only depth before drawing foreground arms and the equipped weapon/tool.
- Use its own projection matrix with a stable 62-degree presentation FOV so world ADS FOV changes do not distort the model.
- Anchor transforms in camera space, then layer idle breathing, mouse sway, movement bob, sprint lowering, equip, reload, and recoil in a deterministic order.
- Keep foreground geometry out of world collision, shadow, and multiplayer snapshot calculations.
- Render the scope body until the sniper scope overlay fully takes over, then hide the view model to avoid optic clipping.

Procedural models remain original but gain denser rounded geometry, material accents, separate magazines, charging/bolt components, sights, stocks, grips, and muzzle hardware. Reusable static buffers are preferred for invariant weapon components; only animated subparts receive per-frame transforms.

### 4.3 Visual quality

Borrow the useful visual principles from LONGSHOT without importing its application shell:

- stronger directional/key light plus soft sky fill and restrained rim light;
- subtle distance fog and atmospheric particles;
- weapon-specific muzzle flashes and pooled impact particles;
- optional soft shadows and higher pixel ratio on High;
- Low, Medium, High, and Auto quality presets.

Auto quality monitors a rolling frame-time window and adjusts pixel ratio, particle limits, distant character detail, and shadow complexity with hysteresis so quality does not oscillate every few frames.

## 5. Camera and Input

- Base landed FOV: 75 degrees.
- Standard ADS target: existing profile values, generally 45-52 degrees.
- Sniper scope target: 15 degrees with the existing scope HUD upgraded for clearer reticle, range feedback, and vignette.
- FOV and camera offsets use exponential damping and remain frame-rate independent.
- Recoil is split into immediate visual weapon motion and a smaller recoverable camera kick.
- Mouse input always defines the authoritative view ray. The foreground muzzle is visual; hit calculation first traces from the view origin, then checks the muzzle-to-aim-point path for nearby cover.
- Sprinting lowers the weapon and blocks ADS. Reload and equip rules remain authoritative in simulation.
- Pointer-lock loss pauses firing/aim input and presents a compact click-to-resume prompt without resetting match state.

## 6. Weapons and Ballistics

### 6.1 Weapon rules

AR, SMG, and shotgun remain host-authoritative hitscan for responsive multiplayer. The sniper becomes a lightweight projectile:

- finite travel time;
- mild gravity drop at long range;
- no wind simulation;
- bounded lifetime and range;
- swept collision each host tick to prevent tunnelling;
- a compact projectile identifier so duplicate network events can be ignored.

All weapons show visual tracers. For hitscan weapons these are cosmetic paths derived from the authoritative result; they do not become client-side damage projectiles.

### 6.2 Procedural animation stack

Apply transforms in this order:

1. stance anchor;
2. movement bob;
3. breathing;
4. mouse sway;
5. sprint/equip pose;
6. reload phase;
7. recoil impulse and recovery.

Each weapon profile specifies animation timings and attachment transforms. Reload phases support magazine release, magazine travel, insertion, action/bolt movement, and return-to-ready. Shotgun cycling and sniper bolt motion receive weapon-specific phases. Weapon switching lowers the outgoing model before raising the incoming model.

Remote characters receive only semantic animation state (`weapon`, `aim`, `reload`, `equip`, `firing`) and reproduce the pose procedurally; bone transforms are never sent over Supabase.

## 7. Authoritative Multiplayer Changes

The host continues to own ammo, cadence, spread, damage, reload completion, building, and elimination.

Add only the minimum snapshot/event data required:

- player presentation: current weapon, aiming, reload remaining, equip remaining, sprinting;
- shot event: weapon, muzzle, authoritative end points, hits, and optional projectile ID;
- sniper projectile state/event: ID, owner, origin, velocity, spawn tick, and terminal impact/despawn event.

Networking rules:

- do not increase continuous input cadence solely for first-person presentation;
- immediate sends remain limited to input transitions such as fire, aim, reload, slot, and build actions;
- remote view-model state is not transmitted;
- projectiles are simulated by the host, while clients interpolate their visuals from the host timestamps;
- cap queued effects and discard expired or duplicate IDs;
- preserve stale-input timeout and connection pause behavior.

## 8. Performance Budget

The implementation must not repeat LONGSHOT's earlier allocation-heavy collision approach. Requirements:

- no object/array allocation in the common per-frame view-model path after initialization;
- pool tracers, casings, muzzle particles, impact particles, and projectile visuals;
- cap simultaneous effects per quality tier;
- reuse geometry buffers and precompute static weapon meshes;
- use squared-distance LOD checks for remote characters;
- avoid DOM writes when HUD values have not changed;
- keep simulation updates fixed/bounded and rendering interpolated;
- clamp long frame deltas without freezing movement.

Target on a typical Chrome laptop: stable 60 FPS on Medium where possible, with Auto reducing presentation quality before changing gameplay behavior.

## 9. HUD and UX

Keep the lobby DOM and CSS unchanged. Match HUD changes are limited to:

- cleaner responsive crosshair with spread and recoil feedback;
- ammo and reload phase feedback;
- compact weapon name/slot treatment;
- clear scope transition and unscoping feedback;
- hit markers and damage numbers that do not obscure the target;
- first-person control hints on the first landing only;
- graphics preset and sensitivity controls persisted locally;
- clear pointer-lock, reconnecting, paused, and spectating states.

The interface may use battle-royale conventions but will retain Sunny Skirmish branding and original artwork/layout.

## 10. File Boundaries

- `public/engine.js`: camera state machine, world/local visibility rules, foreground pass, first-person transforms, visual effects integration.
- `public/weapon-system.js`: weapon and animation profiles, ballistic metadata, pure helpers.
- `public/simulation.js`: host projectile simulation, cover-safe aim convergence, authoritative state.
- `public/multiplayer-runtime.js`: event/snapshot forwarding rules and duplicate filtering if required.
- `public/game.css` and `public/index.html`: match-only HUD and settings additions; lobby selectors remain unchanged.
- `tests/weapons.test.mjs`: profiles, reload phases, spread, projectile helpers.
- `tests/simulation.test.mjs`: projectile collision, damage ownership, cadence, cover safety.
- `tests/render-integration.test.mjs`: camera-mode transitions, local-avatar suppression, view-model/scope/build presentation.
- New focused tests may be added rather than overloading unrelated suites.

## 11. Testing and Release Gates

The build may be published to `test` only after all gates pass:

1. Syntax validation and production Vercel build.
2. Existing test suite remains green.
3. New deterministic tests cover aerial-to-first-person transition, crosshair alignment, muzzle cover, all reload phases, switching, sniper flight/drop, projectile despawn, remote presentation, and round reset.
4. Two-client test covers simultaneous movement, sustained automatic fire, sniper firing, reload, weapon switch, building, elimination, and rematch.
5. Performance soak checks bounded effect counts, stable network sends, and no movement freeze during sustained input.
6. Repository diff confirms lobby files/selectors were not unintentionally changed and no credentials are included.
7. `main` remains unchanged until explicit approval.

## 12. Future Extension

The later military transport update will replace the current transport model and add a first-person interior/jump presentation. The camera state machine defined here leaves a dedicated transport/exit state so that work can be added without rewriting landed combat.
