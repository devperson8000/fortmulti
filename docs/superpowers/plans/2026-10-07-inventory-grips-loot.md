# Inventory, Grips and Loot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver five freely arranged weapon slots, immediate Tab drag/swap UI, 3.5-second chest holds, matching animated ground weapons, visually verified grips, improved first-person visibility and measured performance corrections.

**Architecture:** A shared instance-based inventory module supplies simulation and predicted client presentation. Inventory operations are host-validated and acknowledged independently of selection; renderers share immutable weapon asset templates. Input/UI and timed chest interaction stay separate from combat authority.

**Tech Stack:** Node.js >=20, ES modules, Node test runner, existing Three.js 0.186.0/WebGL, existing Supabase/BroadcastChannel transport, Chromium browser automation outside production code.

**Spec:** `docs/superpowers/specs/2026-10-07-inventory-grips-loot-design.md`

## Global Constraints

- Exactly five weapon slots; arbitrary weapon types and duplicate instances with independent ammo.
- 1–5 weapons, 0 pickaxe, Z wall, V ramp, Q last weapon/blueprint, 7/8/9 consumables, B material and G rotate.
- Chest opening requires 3.5 seconds of continuous host-validated E hold; pickups and ship pods retain press-E behavior.
- Inventory moves update locally by the next browser frame without waiting for the network.
- Real Soldier bones/skin weights and the same bundled weapon GLBs remain in use.
- Preserve TLS verification, combat rules and host authority. Do not claim universal zero lag.
- Work in the current isolated checkout. Do not create a worktree. No Supabase migrations or deployment changes.
- User authorizes pushing completed, verified changes to GitHub `main`; preserve remote changes and never force-push.

## Review Focus

- Two identical weapon types must keep distinct ammunition and reload identity when swapped (Tasks 1/2).
- Out-of-order/duplicate actions and stale snapshots must not undo moves or create weapons (Task 2).
- Pointer loss, Tab key repeat and inventory clicks must not leave controls firing or a ghost drag (Task 3).
- Holding E through chest completion must not pick up the spawned weapon automatically (Task 4).
- A passing palm test must not conceal finger penetration, viewport clipping or a ground asset mismatch (Tasks 5/6).

## Task 1: Instance-based inventory and combat resolution

**Files:** Create `public/weapon-inventory.js`, `tests/weapon-inventory.test.mjs`; modify `public/weapon-system.js`, `public/items.js`, `public/simulation.js`, combat/gameplay tests that encode fixed slots.

**Interfaces:**
- `createInventory() -> Array<WeaponItem|null>` with length 5.
- `WeaponItem = {id:string,type:string,ammo:number,reserve:number|null}`; IDs identify instances.
- `inventoryWeapon(inventory,slot) -> WeaponItem|null`, one-based slots 1–5.
- `applyInventoryMove(inventory,{from,to,sourceId,targetId}) -> {accepted:boolean,inventory:Array}`; immutable atomic swap/move, checked expected identities.
- `createWeaponItem(id,type,ammo) -> WeaponItem`; validate profile and clamp ammo.
- Simulation owns `inventory`, `inventoryRevision`, `slot` and active instance identity. Weapon profiles resolve from inventory items, never number-key position.

- [ ] Write inventory tests asserting length 5, arbitrary placement, duplicate type independence, swap, empty move, invalid slots/identities and unchanged inputs.
- [ ] Run `node --test tests/weapon-inventory.test.mjs`; confirm failure before implementation.
- [ ] Implement the module and migrate simulation pickup/drop, fire, reload, switch, reset and public state to instance resolution. Utility selectors use 0 and 6/7/8/9/10 internally, with 6=wall and 10=ramp; public bindings remain the specified keys.
- [ ] Add simulation tests placing every profile in slot 5, firing/reloading it, moving its instance during reload, filling five slots with duplicate types, dropping and resetting. Update old fixed-slot tests to exercise the new contract instead of removing their assertions.
- [ ] Run inventory, weapons, projectile, simulation and gameplay-loop tests; all intended cases pass.
- [ ] Commit the coherent inventory/combat change.

## Task 2: Authoritative operations and immediate client reconciliation

**Files:** Create `public/inventory-prediction.js`, `tests/inventory-prediction.test.mjs`; modify `public/simulation.js`, `public/app.js`, `public/multiplayer-runtime.js`, `public/engine.js`, network/runtime tests.

**Interfaces:**
- `InventoryOperation = {id:string,from:number,to:number,sourceId:string,targetId:string|null,revision:number}`.
- `Match.moveInventory(playerId,operation) -> {id,accepted,revision,inventory,slot}` validates player/phase and deduplicates IDs with bounded memory.
- `createInventoryPrediction() -> state`; `predictInventoryMove(state,operation) -> boolean`; `reconcileInventory(state,{inventory,revision,acknowledgements}) -> state`; `clearInventoryPrediction(state)`.
- Targeted `inventory-move`/`inventory-ack` messages use the existing authenticated sender and match ID/epoch; guests cannot name another player's inventory. Snapshots carry authoritative revision and current inventory.
- `Game.moveInventory(from,to)`, `Game.inventoryState()` and `Game.clearInventoryPrediction()` expose the predicted local state to the UI.

- [ ] Write tests for rapid ordered swaps, duplicate delivery, acknowledgement loss/retry, stale snapshots, rejected operations, conflicting expected identities, invalid senders and queue bounds.
- [ ] Run prediction/network tests and confirm the new tests fail.
- [ ] Implement bounded prediction and acknowledgements; replay valid queued actions after authoritative updates. Replace fixed `ITEM_BY_SLOT` selection prediction. Preserve equipped instance, firing/reload rules and remote weapon IDs.
- [ ] Test round reset, death/disconnect cleanup and 2/8-player snapshot serialization with operation reordering. Confirm host and guest converge and stale state cannot resurrect dropped items.
- [ ] Run inventory/prediction/network/runtime tests; commit.

## Task 3: Tab menu, drag interactions and updated controls

**Files:** Create `public/inventory-menu.js`, `public/inventory-menu.css`, `tests/inventory-menu.test.mjs`; modify `public/index.html`, `public/engine.js`, `public/app.js`, `public/game.css`, `README.md`.

**Interfaces:**
- `createInventoryMenu({root,getState,onMove,onSelect,onOpen,onClose,getThumbnail}) -> {open,close,toggle,update,destroy}`.
- `getState() -> {inventory,slot,utilities,materials,alive,phase}` consumes Task 2 prediction.
- `onMove(from,to)` calls `Game.moveInventory`; `getThumbnail(type)` consumes Task 5 cached real-model images.
- Menu open state suppresses combat/movement/interact input without pausing the authoritative match.

- [ ] Write tests for Tab repeat suppression, occupied swaps, empty moves, selection-versus-drag threshold, outside release, empty source, pointer cancellation/loss, Escape priority, focus loss and keyboard rearrangement.
- [ ] Run menu tests and confirm failure.
- [ ] Implement five cards with names/ammo/rarity and clear target feedback, a pointer-following drag ghost, separate utilities/materials, accessible focus and responsive layout. Commit predicted state synchronously; no debounce or animation gate.
- [ ] Update HUD selection and 1–5/0/Z/V/Q/7–9 controls; clear held inputs and release pointer lock on open. Close with click-to-resume. Update help text and README consistently.
- [ ] Run menu and prediction tests. Browser verification in Task 6 must test real pointer and keyboard events; commit.

## Task 4: Continuous chest holds

**Files:** Modify `public/simulation.js`, `public/engine.js`, `public/app.js`, `tests/gameplay-loop.test.mjs`; create `tests/chest-hold.test.mjs`.

**Interfaces:**
- `Match.advanceChestInteraction(player,input,dt)` owns `player.chestHold = {id,elapsed,duration:3.5}|null`.
- `Match.interact(player,input)` handles press-E pickups and starts eligible chest targeting without immediate opening; ship pod logic stays unchanged.
- Snapshots expose hold progress; UI displays the current target and bounded interpolated progress.

- [ ] Write tests for 3.49 seconds closed, 3.5 seconds open once, release/range/line-of-sight/target/death/stale-input cancellation, concurrent opening and no auto-pickup while E remains held.
- [ ] Run chest tests; confirm failure.
- [ ] Implement host-time accumulation with per-tick validation and exactly-once loot creation. Opening menus clears E through Task 3 input suppression. Keep loot limits and reset progress on round transition.
- [ ] Implement prompt/progress display, retaining press-E for ground pickups/pods; run chest/deployment/gameplay tests and commit.

## Task 5: Ground GLBs, hand grips and wider first-person presentation

**Files:** Create `public/weapon-assets.js`, `tests/ground-weapons.test.mjs`; modify `public/match-character-renderer.js`, `public/engine.js`, `public/soldier-arms.js`, `public/first-person-calibration.js`, `public/view-model.js`, `tests/first-person-grip.test.mjs`.

**Interfaces:**
- Export `WEAPON_FILES` as the sole bundled GLB path map.
- `createGroundWeapon(template,type) -> THREE.Group` shares template resources, normalizes presentation bounds and does not mutate the source.
- `groundWeaponPose(item,time) -> {rotation,height}` uses an item-stable phase, about 5 cm bob over 4 seconds and 30-second revolution.
- Renderer maintains an item-ID registry and cached `getWeaponThumbnail(type)` images; ground animations never change authoritative pickup positions.

- [ ] Write GLB identity/resource-lifetime and deterministic bounded animation tests; run and confirm failure.
- [ ] Share immutable weapon templates, add/remove ground instances only as pickup IDs change, distance-cull and generate cached real-asset thumbnails. Remove ground firearm stand-ins.
- [ ] Establish browser visual baseline and collect geometry/bone contact measurements for all four weapons. Adjust palms, finger curl/thumb opposition and wrist orientation from measurements and inspected frames. Increase visible hip weapon framing modestly while preserving ADS and muzzle projection.
- [ ] Extend real-rig tests for per-weapon contact/finite transforms, reload transitions, duplicate type selection and 16:9/4:3/wide framing. Inspect hip/ADS/close-hand and reload screenshots and correct visible defects; do not accept palm tests alone.
- [ ] Run ground/grip/renderer/view-model tests and commit.

## Task 6: Browser verification, measured performance, review and main push

**Files:** Add isolated browser/benchmark helpers in `scripts/` if reproducible repo tooling is useful, with explicit dev-only entry points; update `package.json` syntax/check coverage, `build.mjs` module access checks, `README.md`, tracked `dist/`; save artifacts under `/workspace/fortmulti-artifacts/`.

**Interfaces:** Browser helpers load the real application and actual assets; test fixtures may construct authoritative Match state outside production flows. Frame metrics report p50/p95/p99 frame intervals, long frames, workload and browser/renderer context.

- [ ] Resolve Chromium's trusted proxy CA using supported NSS configuration and the environment's existing CA; preserve TLS verification. Install browser automation only with verified artifacts. If access is blocked, report the exact blocker and complete independent checks.
- [ ] Capture a baseline representative gameplay workload before performance edits. Measure island movement, combat, inventory operations, populated pickups and 2/8-player state. Inspect profiles before choosing fixes.
- [ ] Write failing regression checks for measured issues where meaningful; correct demonstrated hot-path allocations/rebuilds/resource retention, preserving graphics and simulation behavior. Repeat the same workload and compare measurements.
- [ ] Exercise actual Tab/Escape, occupied swap, empty move, outside release, rapid moves, selection and ammo, chest hold/cancellation and a two-client flow. Record next-frame UI response and authoritative convergence. Verify utilities/building, deployment and restart/reset.
- [ ] Capture and inspect all Task 5 weapon/hand images plus inventory empty/populated/dragging and ground pickup views. Save evidence; rerun affected checks after corrections.
- [ ] Run `npm run check` and browser checks, inspect exit statuses/counts and `git diff --check`, then regenerate/inspect `dist`. Distinguish software-renderer limitations and unavailable cross-network Supabase validation from passed local checks.
- [ ] Obtain a whole-change independent review and address substantive findings with targeted verification. Use the reviewer workflow only after the execution method is confirmed.
- [ ] Commit final source, tests, docs and consistent `dist`. Fetch `origin main`, inspect divergence, integrate intervening work without dropping changes, rerun affected validation, then push `HEAD:main` without force. Confirm the remote SHA equals the final local commit.
- [ ] Report implemented behavior, test counts, screenshot/benchmark artifacts, remote commit and any remaining limitations. Do not claim deployment to Vercel or live Supabase verification unless performed.
