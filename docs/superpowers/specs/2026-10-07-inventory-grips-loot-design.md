# Flexible weapon inventory, grips, loot and performance

## Goal and approved scope

Improve Horizon's existing game with exactly five freely arranged weapon slots, an immediate and polished Tab inventory, deliberate chest opening, consistent ground/held weapon models, correct Soldier hand grips, and a slightly more visible first-person weapon. The user requires actual interaction tests and visual inspection, including finger positioning. Preserve the existing multiplayer game, deployment, building, consumables, combat rules and public-only Supabase authentication.

This is application development, separate from the completed environment onboarding. Work in the existing isolated checkout unless the user asks for a worktree. No deployment or database changes are needed for this design. GitHub, Vercel and Supabase connector capabilities are unavailable in the current session; local Git and application validation remain available. Do not claim deployment or live online validation without evidence.

## Current behavior and integration points

- `weapon-system.js` resolves weapon types from fixed slots 1–4; building currently uses 5/6 and consumables 7–9.
- `simulation.js` stores firearms by type, opens chests on an E input edge, handles pickups/drops and produces authoritative snapshots.
- `engine.js` owns input, HUD and ground presentation. `app.js` forwards guest inputs and authoritative state. `multiplayer-runtime.js` predicts selection using a fixed type-to-slot table.
- `match-character-renderer.js`, `first-person-calibration.js`, `view-model.js` and `soldier-arms.js` render the actual GLB weapons and Soldier arms. Existing palm-anchor tests are useful but do not establish visually correct finger contact.
- The baseline documented check passed 177 tests during onboarding. Headless Chromium failed certificate validation and did not establish browser rendering readiness. Resolve browser trust without bypassing TLS verification before using external browser assets.

## Inventory state and authoritative operations

Introduce a shared inventory module with five nullable weapon entries, rather than weapon-type-bound positions. Each acquired weapon has a stable instance ID, weapon type and its own ammunition state. Duplicate types are allowed and occupy separate slots; four available weapon types must not limit five-slot capacity. Weapon identity and ammo follow the instance, never the slot number.

Resolve profiles by the item in the selected slot throughout firing, reload, hitscan/projectiles, first-person rendering, remote rendering, effects, HUD, prediction and public snapshots. Remove fixed-slot resolution from gameplay call sites. Keep utility selection explicit and separate from carried firearms. Select the same weapon instance after rearranging it; do not restart equip/reload simply because its inventory position changed. Dropping or otherwise losing the active instance cancels its reload and selects the pickaxe.

Pickups fill the first empty weapon slot. A full inventory refuses another pickup with a clear full-inventory message; X drops the selected weapon to make space. Do not silently overwrite an existing weapon. Round reset clears carried weapons as before. Item IDs and ammo survive pickup/drop and snapshot serialization without duplication.

Represent each move as an authenticated player operation with a unique action ID, source slot, destination slot, expected source/destination item IDs and inventory revision. The host validates bounds, ownership, phase and expectations; it performs an atomic swap or move, updates revision and acknowledges the operation. Repeated delivery cannot repeat a swap. Track processed actions within bounded state and reject stale/conflicting operations with authoritative inventory returned.

For guests, apply valid operations immediately to a local predicted inventory and send them through the existing targeted input/action transport. Maintain a bounded ordered pending queue. On an authoritative acknowledgement, retire processed actions and replay still-valid pending actions over the confirmed state. Older snapshots cannot undo accepted or pending presentation. Rapid operations preserve order and converge without duplicating, losing or resurrecting weapons. Clear prediction on death, disconnect and round reset. The host player's operations use the same validation contract locally.

## Controls and polished Tab menu

- 1–5: select the five weapon slots, with no designated weapon type.
- 0: pickaxe. Z: wall blueprint. V: ramp blueprint. Q: existing last-weapon/blueprint toggle, resolved by instance identity. B: material, G: rotate. 7/8/9: shield/med kit/shockwave. Update HUD, help text and README to agree.
- Tab toggles the inventory and prevents browser focus traversal when controlling the match. Escape closes the inventory before invoking the match menu. Key repeat cannot repeatedly toggle it.
- Opening releases pointer lock and clears held movement/fire/aim/interact inputs. The match continues; the player does not gain invulnerability. Closing offers click-to-resume using the existing pointer-lock flow. Inventory clicks must never fire a weapon or change a landing destination.

The menu presents five large consistent weapon cards, cached thumbnails of the real weapon assets, readable names, rarity accents, ammo and numbered slots. Utilities/materials are displayed separately. Use the existing Horizon visual language with restrained contrast, crisp borders, clear spacing and responsive layout; avoid expensive full-screen blur. Include an explicit close control and concise drag guidance.

Use pointer events and capture for click-and-hold dragging, with a small movement threshold to distinguish selection from dragging. The dragged card follows the pointer on the next render frame. Occupied destinations show a swap affordance; empty destinations show a move affordance. Release commits synchronously to predicted state. Invalid/outside release or pointer cancellation leaves inventory unchanged. Pointer capture loss, closing, round end and window focus loss clean up the gesture. Empty slots cannot initiate a drag. No artificial delay, debounce or animation gate may block operations. Keyboard-accessible selection and move/swap controls accompany pointer dragging.

## Chest hold interaction

The authoritative simulation accumulates 3.5 seconds of continuous held E on the same valid, unopened chest while alive, landed, in range and with line of sight. Releasing E, changing target, leaving range, losing line of sight, death, opening a menu, disconnect/stale input or round transition resets progress. Returning starts at zero. Progress uses simulation delta time, not a client-declared completion timer.

Show a readable hold-E prompt and progress indicator, smoothing displayed progress between confirmed updates without opening early. Completion opens a chest once and emits its loot once, even with simultaneous players. Existing loot-capacity limits remain respected. Ordinary floor pickups stay press-E actions; ship pod interaction stays unchanged. Holding E to open a chest must not automatically collect its newly spawned loot.

## Ground weapon presentation

Use the same bundled East GLB asset and materials as the actual first-person weapon for each type. Remove any procedural stand-in for weapon pickups. Share a cache/asset factory between held and ground renderers where appropriate without coupling their transforms, animation or mutable state.

Ground meshes use a stable item-ID registry. Create meshes on pickup appearance, update their transforms, and remove/release them on disappearance. Reuse geometry/materials safely; do not dispose shared templates when one pickup disappears. Limit distant rendering and avoid reconstructing models on snapshots or every frame.

Animate gentle bobbing around a constant terrain-relative height (approximately 5 cm amplitude over 4 seconds) and slow rotation (approximately one revolution per 30 seconds). Deterministic per-item phase prevents identical synchronized motion. Interaction uses authoritative pickup coordinates, not animated mesh positions. Bounds keep models above ground; animations do not alter combat or physics.

## Grips and first-person visibility

Retain the actual Soldier skeleton, skin weights and bundled firearm models. Calibrate each weapon from its geometry and actual hand bone axes. The shooting palm seats on the grip, fingers curl around its contour, thumb opposes the fingers, and the index finger meets the trigger area without crossing the receiver. The support hand wraps the fore-end, with the shotgun hand following the pump. Check for floating fingers, fingers penetrating the receiver, reversed palms and unnatural wrist twists.

Adjust first-person hip placement/framing modestly so more of the receiver and both hands are visible. Choose final transforms from rendered comparisons rather than an arbitrary numerical offset. Preserve weapon proportions, sight alignment, sniper scope behavior, crosshair aiming and matching muzzle/tracer projection. Verify near-plane clipping and screen obstruction on 16:9, 4:3 and wide views.

Keep hand/weapon transforms coordinated through idle, movement, sprint, ADS, firing, switching and every reload stage. The support hand may leave its anchor only for an intentional reload action and returns smoothly. Finger poses may be weapon-specific. Reuse temporary vectors, quaternions and matrices in the verified hot paths; do not trade correct posing for performance.

## Performance work

Establish a repeatable browser workload and capture frame time percentiles, long frames, allocations, draw calls and network cadence before making performance changes. Include moving through the island, combat/effects, opening the inventory, rapidly rearranging items and a populated pickup scene. Exercise local multi-client behavior and representative 2/8-player snapshots. Separate software-renderer or cloud-host limitations from game regressions.

Fix evidenced causes within the changed paths: repeated skeleton scratch allocations, redundant inventory DOM rebuilding, per-snapshot pickup mesh creation and unnecessary retained resources are candidates to measure, not assumed findings. Cache thumbnails/assets, update only changed UI state and keep animation loops bounded. Preserve adaptive graphics and host-authoritative simulation/network budgets. Do not disable gameplay, collision, effects assertions or rendering to manufacture a benchmark improvement.

Immediate inventory updates mean committed state is visible by the next browser frame under the measured workload, with no network round-trip required. Report measured before/after frame results and the hardware/browser context. No universal zero-lag claim is possible across devices and network conditions.

## Verification and acceptance

Automated tests must cover:

1. Exactly five slots, arbitrary placement and duplicate-type weapons with independent ammo.
2. Atomic occupied swaps, moves into empty slots, invalid/no-op operations, active-instance preservation, full pickups, drops and round reset.
3. Host/guest consistency under rapid moves, delayed and stale snapshots, duplicate actions, conflicts, disconnect and bounded pending state.
4. Every weapon selected from each slot fires/reloads the correct profile and renders the correct held/remote model. Building and consumables work with the updated controls.
5. Chest completion at 3.5 seconds, no early completion, all cancellation conditions, unchanged pod/pickup behavior and exactly-once concurrent opening.
6. Real ground GLB selection, stable resource reuse and bounded animation transforms.
7. Actual Soldier palm anchors, finite bone transforms, ADS and muzzle projection, reload return and model visibility after framing changes.

Browser tests must exercise Tab/Escape, pointer capture, occupied swap, empty move, outside release, repeated operations, numbered selection, ammo display, input suppression, chest hold/cancellation and a two-client authoritative flow. These checks use the game; any test harness remains isolated from production flows and does not replace real input checks.

Capture and inspect screenshots of all four weapons in hip/ADS views, close-ups of both hands, and representative reload stages. Inspect the actual rendered frames using image tools, correct defects found, and repeat affected checks. Also inspect the inventory in populated/empty/dragging states and the ground GLBs. Keep screenshots and useful test/benchmark outputs as reviewable artifacts outside source directories.

Run the full documented `npm run check` after implementation, including new meaningful tests, and inspect Git changes. Update build/syntax coverage for new browser modules where needed. Regenerate `dist` consistently with source for this repository's committed static output. Report passed/failed/skipped outcomes, visual evidence and remaining limitations separately. If browser trust, rendering or online credentials block a required check, state the precise blocker rather than claiming it passed.

## Delivery sequence and review boundary

Implement in coherent stages: inventory model and authoritative synchronization; UI/controls and chest holds; shared ground assets; grips/framing; measured performance corrections and full verification. Interfaces come from this shared spec, so stages do not silently change one another's assumptions.

This document records the design requested by the user, with concrete defaults for controls and edge cases. Review and approval of this written spec precede the implementation plan. The plan must then be reviewed and its execution method selected before product code changes, as required by the brainstorming workflow. Publication to Vercel, GitHub pushes and Supabase schema changes are outside this implementation scope unless explicitly requested later.
