# Horizon gameplay rework implementation plan

Goal: Implement the attached full gameplay loop on main, retaining host authority and bounded rendering.
Architecture: Pure grid/items/world/physics helpers feed Match and presentation. Static entities use deterministic IDs; snapshots carry dynamic deltas.
Spec: ../specs/2026-09-30-horizon-rework.md
Execution: Inline, as requested; no incremental approvals.

## Constraints
Preserve Supabase Realtime and RLS; no continuous Postgres gameplay writes. Preserve quality controls, snapshot interpolation and bounded events. Use actual Soldier mesh and licensed guns.

## Review focus
- Competing interactions cannot duplicate loot.
- Held controls cannot repeatedly consume/open/throw.
- Reconciliation cannot grant unowned weapons.
- Elevated ramps must connect at all four rotations and on uneven terrain.
- Camera and all cached weapon visibility must reset on switches/deployment.

## Tasks
- [ ] Shared grid: public/build-grid.js; placement, endpoints, support, bounds and precise ramp rays; tests/build-grid.test.mjs.
- [ ] Gameplay: public/items.js, resource-system.js, loot-system.js, shockwave.js; integrate Match initialization, interaction, harvesting, use timers, grenades, landing physics and snapshot deltas; tests/gameplay-loop.test.mjs.
- [ ] World: public/world-layout.js; continuous roads, modular interiors, stairs, distributed landmarks and deterministic chest/resource data; world tests.
- [ ] Presentation: actual arm mesh extraction and IK in public/soldier-arms.js; shared first-person scene, utility models and third-person actions; remove procedural arm path.
- [ ] Engine/network integration: controls 0–9, HUD, prompts, snapshot fields, loot/resource rendering, bounded shockwave feedback; preserve buffers and quality culling.
- [ ] Deployment polish and camera constraints; complete npm run check, browser verification, independent review, commit and push main.

## Continuation verification
Fresh Node/build verification is recorded in the commit. Review found and fixed inherited Soldier attachment scaling and camera/build collision geometry mismatches. Browser verification remains blocked: the cloud browser rejects localhost with ERR_BLOCKED_BY_CLIENT, and the Chromium download returned a truncated archive. Live hand poses and the complete visual multiplayer flow still require browser verification.

Independent review identified nonzero-terrain foundation rejection. Initial pieces now use the grid level beneath terrain, with one-level embedded support; elevated ramp chains retain their exact endpoints. Nonzero/negative terrain regression tests cover both walls and ramps. The reported cinematic utility overlay was checked against the surrounding firstPersonVisible guard and was not reproducible from that code path.
