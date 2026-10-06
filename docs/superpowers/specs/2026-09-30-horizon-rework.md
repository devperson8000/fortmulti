Work directly on the latest `main` branch of `devperson8000/fortmulti` and perform a major end-to-end gameplay rework of Horizon. Inspect the existing implementation before editing anything, especially `public/engine.js`, `public/simulation.js`, `public/weapon-system.js`, `public/view-model.js`, `public/match-character-renderer.js`, `public/deployment-sequence.js`, `public/deployment-ship.js`, `public/multiplayer-runtime.js`, `public/network-tuning.js`, the existing tests, and the connected Supabase `fort` project.

Do not replace the existing multiplayer architecture with a completely different system. Preserve the host-authoritative simulation, Supabase Realtime networking, interpolation/prediction work, graphics-quality system, bounded effects, collision buckets, and other existing performance optimisations. Extend those systems cleanly. High-frequency gameplay state such as harvesting, grenades, builds, loot, chest state, projectiles, and player inventory should remain authoritative match state/snapshots rather than being written continuously to Postgres. Only change Supabase schema/RPCs if genuinely necessary, and do not weaken existing RLS/auth security.

This is not a small patch. Treat it as a coherent gameplay-system redesign rather than bolting more special cases onto `engine.js`.

## 1. Rebuild the building system around one real grid

The game already approximately snaps builds to 5-unit coordinates and 3.6-unit vertical levels, but I want a proper invisible construction grid that is the single source of truth for rendering, collision, validation, networking, previews, and placement.

Create shared grid constants/functions rather than having client preview and authoritative simulation calculate placement separately.

Walls should attach exactly to grid-cell edges. Ramps/stairs should span exactly one grid cell horizontally and one build level vertically: the bottom edge of a ramp must land exactly on one grid line and its top edge must arrive exactly at the opposite grid line/build level.

Most importantly, ramps must chain correctly. If I place one ramp and stand on or near its top, I must be able to place another ramp whose bottom begins exactly where the first ramp ends, allowing continuous stair-on-stair construction upward. Walls and ramps at elevated levels must also line up cleanly.

Build previews, final meshes, collision, walking surfaces, bullet collision and authoritative validation must all use the same transform. Eliminate tiny gaps, overlaps, mismatched preview/final positions and floating ramps.

Use a support/adjacency system so legitimate connected elevated construction works while obviously unsupported floating pieces are rejected.

Keep rotation locked to sensible 90-degree grid directions.

## 2. Add two real building materials

Players must start every match with **0 wood and 0 stone**.

There are two materials:

**Wood:** normal construction material with lower structure HP.

**Stone:** stronger construction material with noticeably higher structure HP and a visually distinct stone appearance.

Walls and ramps must support both materials. Put all balance values into centralized constants rather than scattering numbers through the code.

Choose sensible harvesting amounts and construction costs. A good baseline is around 10 material per wall/ramp, but tune harvesting so players can gather and build at a fun pace.

The HUD must clearly show separate wood and stone amounts and which material is currently selected.

## 3. Replace the starting weapon loadout with a pickaxe/harvesting loop

Currently `simulation.js` starts players with a fully populated weapon loadout and building material. Remove that.

At the start of the playable match the player should have:

- their normal health;
- no shield unless obtained through gameplay;
- 0 wood;
- 0 stone;
- no firearm;
- no consumables;
- the pickaxe as their default held item.

Create an actual first-person pickaxe view and appropriate third-person character animation/pose.

Trees become harvestable resource nodes. Hitting a tree with the pickaxe gives wood on each successful hit. Trees have finite HP and disappear/break when fully harvested.

Rocks become harvestable resource nodes. Hitting a rock gives stone on each successful hit. Rocks also have finite HP and break when depleted.

Harvesting must be authoritative. The host decides that a valid pickaxe hit occurred, how much resource was granted and whether the resource object was destroyed. Remote players must see the harvesting animation and resource destruction.

Give hits clear but lightweight feedback—small impact effects, sound, movement or hit reaction—without creating expensive unbounded particles.

## 4. Replace automatic pickups with a real inventory and `E` interaction

The existing game automatically collects pickups simply by walking close to them. Replace that system.

World items should remain physically visible until a player looks at/is close enough to them and presses **E**.

Show a lightweight interaction prompt such as `E · PICK UP STRIKER AR`.

Create a proper inventory model that can contain weapons, healing items and shockwave grenades. The pickaxe should be permanently available and should not consume a normal loot slot.

Inventory changes must be authoritative and synchronized so players cannot duplicate or simultaneously pick up the same item.

Weapon switching, consumable counts and grenade counts must be represented in snapshots without bloating network traffic.

## 5. Add loot chests throughout the island

Remove the current simplistic fixed shield/health/wood pickups as the main loot source.

Add visually recognizable loot chests scattered throughout the island. Place them in sensible searchable locations:

inside houses and apartment buildings, upper floors, garages, warehouses, behind rocks, beside large trees, small camps, ruins, industrial structures and other places that reward exploration.

Do not make them impossibly hidden. Players should encounter chests naturally while moving through points of interest.

Chest placement and chest loot must be deterministic/host-authoritative so every client agrees on whether a chest exists, whether it has been opened and which loot it produced.

Opening a chest should create physical loot items nearby rather than instantly putting everything into the player's inventory. Each dropped item is collected individually with **E**.

Each chest should normally produce **1–2 weapons plus a support/utility roll**.

Shield heals should be fairly common. When a shield-heal pickup is collected it should represent a stack of **3 uses**. Each use takes **3 seconds** to complete and grants **25 shield**, up to the shield cap.

Health heals should be less common. A health heal should come as **one use** and restore the player to full health when the use completes. Give it a sensible visible use duration and centralize that duration in the item configuration.

Using a consumable must have a clear first-person and remote-character use animation. Only consume the item when its use completes. Cancelling/switching away should not silently consume it.

## 6. Rework the existing weapon system around loot

Keep and polish the licensed GLB weapon models already added for the AR, shotgun, SMG and sniper.

These weapons should no longer automatically exist in every player's loadout. A weapon becomes usable only after the player finds and collects it.

Rework weapon slots and state accordingly. Make empty inventory slots actually empty. Preserve the good parts of the existing recoil, reload, ADS, shotgun spread, sniper projectile, muzzle effects and host-authoritative damage logic.

Make picking up, dropping/replacing, switching, shooting and reloading feel immediate while still respecting host authority.

## 7. Use the ACTUAL Soldier character's arms and hands in first person

This is important.

The current first-person system still renders custom/generated arms from `drawFirstPersonArms()` even though the weapons themselves are now licensed GLB assets. Stop using those fake generated arms for normal held-item rendering.

`public/match-character-renderer.js` already loads `/models/Soldier.glb` and resolves bones such as the Mixamo right/left arm, forearm and hand. Build the first-person arm system from the **actual Soldier character mesh/skeleton/materials**.

The first-person hands/arms should therefore visibly be the same Soldier character that other players see in third person—not a similarly coloured procedural replacement.

Use the real Soldier skeleton to pose:

weapon grip;
support hand;
ADS;
recoil;
reload;
pickaxe swings;
grenade throws;
shield/healing use.

The right hand must properly grip the weapon and the left hand must actually meet the foregrip/reload components. Avoid floating hands, wrists intersecting the weapon, detached arms, impossible elbow bends or the weapon clipping through the character.

When feasible, create a dedicated first-person clone/arm-only presentation of the Soldier rig so the rest of the body does not obstruct the camera while still using the real arm mesh, skeleton and materials.

## 8. Add shockwave grenades

Add a new inventory utility item: the **Shockwave Grenade**.

It causes **zero damage**.

It should have real throwable projectile behaviour based on the player's camera yaw and pitch. Looking downward should let the player throw it near their own feet. Looking outward/upward should throw it forward along a believable arc.

When it lands, after the appropriate short trigger behaviour, create a visible shockwave explosion.

Every affected player receives an impulse **away from the explosion centre**.

If the grenade is behind the player, it launches them forward.

If a player is almost directly above the grenade, the horizontal direction becomes small and the player is launched mainly upward.

The closer the player is to the explosion, the stronger the impulse, up to a safe maximum. Make the calculation deterministic and authoritative.

Shockwaves must never damage players.

The throwing character must visibly perform a grenade throw in both first- and third-person rendering. Remote players should be able to see the grenade travel and explode.

Add sensible inventory stack limits and chest loot chances for shockwave grenades.

## 9. Add real fall damage and shockwave fall-damage immunity

If proper fall damage is not already implemented, add it.

Do not use a fragile frame-by-frame height guess. Track enough airborne/vertical state to detect a genuine landing and calculate fall damage from downward landing velocity or equivalent fall severity.

Small normal jumps should cause no damage. Large drops should increasingly damage the player.

A player launched by a shockwave grenade must receive temporary shockwave fall-damage immunity that lasts through the resulting airborne movement and clears safely after landing. Do not make that immunity permanent and do not accidentally make ordinary later falls immune.

## 10. Significantly improve the island

The current procedural island has several named POIs, but many structures are effectively solid exterior boxes and the highway system is built from straight box segments.

Rework the world so it feels like an actual traversable battle-royale island rather than scenery placed on terrain.

### Roads

Replace the obvious chained rectangular road pieces with smooth curved roads.

Use spline/curve sampling or another continuous approach and generate road geometry that follows the terrain. Road edges should meet the grass naturally instead of appearing as square slabs stacked above it.

Add clean intersections, subtle shoulders/verges and road markings that follow the curve.

Road collision/terrain treatment should remain efficient.

### Enterable buildings

Create genuinely enterable buildings.

Houses, shops, warehouses and apartment blocks should have doors/open entrances, interior floors and rooms/corridors where appropriate.

Do not keep using one giant solid AABB for a building that is visually supposed to be entered. Break collision into actual walls/floors/roof pieces so doorways are traversable.

Apartment blocks should have multiple accessible areas/floors, with stairs where appropriate and useful chest/loot locations.

Keep interiors readable and performant. Reuse modular geometry instead of creating thousands of completely unique objects.

### Populate the open island

Add interesting structures outside the existing towns so moving between POIs is not empty.

Examples include small cabins, ruined structures, sheds, military-style checkpoints, camps, towers, abandoned roadside structures, utility buildings, rock formations, bridges/culverts, small compounds and other pieces of cover.

Do not clutter every metre. Create intentional combat spaces, sightline breaks and recognizable landmarks.

Keep the art direction original. Aim for the colourful/readable/high-quality feel of a polished battle royale, but do not copy Fortnite assets, maps or branded designs.

## 11. Completely polish the deployment carrier and pods

Keep the existing deployment state machine concept, but substantially improve its presentation.

The current flow includes landing selection, entering a pod, both-ready, sealing, launching, transition, landing, pod opening and exiting. Preserve deterministic synchronized stages, but make the visuals and camera treatment far better.

The carrier interior should look like a large futuristic/military deployment carrier: reinforced floor panels, structural ribs, pod bays, lighting, equipment, warning markings, mechanical details and believable scale.

Make it war-like/tactical while still fitting Horizon's original visual identity.

Pods should look like proper deployment capsules rather than simple geometry.

Improve:

walking up to the pod;
entering it;
door/seal animation;
interior pod view;
launch preparation;
launch acceleration;
camera shake;
lighting changes;
exterior movement cues;
landing;
door opening;
character exit;
control handoff.

Do not use ugly instant teleports or arbitrary black screens to hide broken transitions. A short intentional cinematic fade can still be used where technically appropriate, but it must feel motivated and seamless. Camera position, player position and authoritative deployment state must agree throughout the sequence.

Players should never briefly see outside the carrier/pod incorrectly, clip through geometry, or regain control at the wrong stage.

## 12. Make movement and combat faster and more agile

Polish the general movement feel.

Keep it responsive, quick and battle-royale-like. Improve acceleration/deceleration, sprint responsiveness, jumping, air control, ramp traversal, stepping through interiors and camera motion.

Do not make the player floaty or uncontrollable.

Ensure running/idle/jump/fall/harvesting/throwing/consumable animations correctly follow authoritative movement state for remote players.

Fix any remaining cases where a stationary remote Soldier remains stuck in the running animation.

## 13. Networking and performance requirements

Do not undo the networking optimisation already present in `multiplayer-runtime.js`, `network-tuning.js`, the render-buffer system or the adaptive quality system.

The host remains authoritative for:

player health/shield;
inventory;
ammo;
materials;
resource-node HP;
chest state;
world loot;
building placement/HP;
weapon hits;
grenades;
shockwave impulses;
fall damage;
deployment;
eliminations.

Clients may predict harmless presentation/state where it improves responsiveness, but they must reconcile to authoritative snapshots.

Avoid sending huge static world descriptions every snapshot. Deterministic static world/chest/resource spawn data should be generated from shared seed/config where possible, with snapshots carrying only changing state.

Use IDs for resource nodes, chests, loot entities, grenades and structures.

Use pooling/reuse for frequently spawned visual objects. Avoid creating new GPU buffers every frame when the existing reusable-buffer architecture can be extended.

Use spatial buckets/culling for the expanded number of world colliders, resources, loot entities and interiors rather than scanning every object in the world for every player every tick.

Do not degrade the game for laptop/browser users just to make the map denser.

## 14. UI/HUD polish

Rework the in-match HUD so the new systems are obvious.

Show health and shield clearly.

Show wood and stone separately.

Show the selected build type and selected material while building.

Show inventory slots with weapon/item icons or clear readable representations and stack counts.

Show pickaxe state.

Show contextual `E` prompts for chests and ground loot.

Show a visible timed-use indicator while consuming a shield/health item.

Show grenade stack count.

Keep the HUD compact and game-like rather than filling the screen with debug information.

## 15. Refactor rather than making `engine.js` even larger

`public/engine.js` is already very large. Do not put this entire rework into another several thousand lines inside that one file.

Split major systems into focused modules where practical, for example:

building/grid system;
inventory/items;
harvesting/resource nodes;
loot/chests;
shockwave/fall physics;
world roads/buildings;
first-person Soldier arms.

Keep `simulation.js` as the authoritative gameplay orchestration layer while extracting reusable pure helpers that can be unit tested.

Do not create unnecessary abstractions just for the sake of file count, but make the architecture materially easier to maintain.

## 16. Tests and verification

Expand the existing Node test suite. At minimum cover these acceptance cases:

1. A player begins with zero wood/stone and no firearm.
2. Harvesting a valid tree grants wood and harvesting a rock grants stone.
3. Resource nodes cannot be harvested after destruction.
4. Walls and ramps snap identically in preview and authoritative placement.
5. Ramp bottom/top endpoints line up exactly with the construction grid.
6. Multiple ramps can chain upward without gaps or placement rejection.
7. Invalid unsupported builds are rejected.
8. Wood and stone costs are deducted correctly.
9. Stone structures have greater durability than wood.
10. A chest can only be opened once and produces deterministic loot.
11. Two players cannot both collect the same ground item.
12. Shield stacks contain three uses, require three seconds per use and grant exactly 25 shield.
13. Health healing restores full health and respects its stack/use rules.
14. Weapons cannot be fired until collected.
15. Shockwave grenades cause zero direct damage.
16. Shockwave force points away from the explosion and becomes mostly vertical when directly above it.
17. Shockwave-launched players do not receive fall damage on the resulting landing.
18. Ordinary large falls do cause fall damage.
19. Shockwave fall immunity clears after landing.
20. Deployment stages remain synchronized across players.
21. Existing weapon/projectile/network/first-person tests continue to pass.
22. No unbounded event/pickup/projectile arrays or obvious hot-loop allocations are introduced.

Run the complete existing project verification:

`npm run check`

This runs syntax checking, the full `node --test tests/*.test.mjs` suite and the production build. Fix every regression rather than deleting or weakening tests to get green.

After implementation, inspect the diff for accidental duplicated systems, obsolete old pickup/material logic, stale generated-arm rendering, or old assumptions that every player always owns all four weapons.

Polish the finished result rather than stopping as soon as it technically works. Test the complete loop: lobby → carrier → landing choice → pod entry → deployment → harvesting → chest → pickup → inventory → combat → building upward → consumables → shockwave → fall → elimination.

Do not ask me for incremental design approval. Make sensible implementation decisions yourself, preserve the systems that are already working well, implement the rework completely, run the checks, fix the problems you find, and when the branch is clean push the finished changes to `main`.