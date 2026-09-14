# Full-Stack Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the confirmed reliability, performance, database, and UX failures affecting multiplayer play and deployment.

**Architecture:** Preserve the existing host-authoritative browser architecture. Fix ownership problems in their native layer: transport/session races in `network.js`, network/state smoothing in `multiplayer-runtime.js`, authoritative state in `simulation.js`, rendering pressure in `engine.js`, and data access in Supabase.

**Tech Stack:** Vanilla JavaScript ES modules, WebGL, Supabase Auth/Realtime/Postgres, Node.js tests, Vercel static deployment.

**Spec:** `docs/superpowers/specs/2026-09-15-full-stack-stability-design.md`

## Global Constraints
- Preserve anonymous sign-in as an intentional authenticated-user flow.
- Never expose Supabase secret/service-role keys in browser output.
- Preserve 2–8 player parties.
- Do not add unrelated features.
- Do not perform real-world weapon-use/realism work.

---

### Task 1: Supabase query and RLS performance
**Files:** Modify `supabase.sql`; create migration record in live Supabase.
**Produces:** Covering FK indexes and statement-level auth UID evaluation.
- [ ] Capture failing advisor/index evidence.
- [ ] Add indexes for `duel_room_members(user_id)`, `duel_rooms(host)`, and `duel_rooms(guest)`.
- [ ] Rewrite affected public/realtime RLS predicates from `auth.uid()` to `(select auth.uid())`.
- [ ] Apply one named migration to the live `fort` project.
- [ ] Re-run security/performance advisors and direct SQL verification.

### Task 2: Connection lifecycle and reconnect races
**Files:** Modify `public/network.js`; modify `tests/network.test.mjs`.
**Produces:** Stale sockets cannot disconnect a replacement socket; reconnect timers are singular; local party leader state converges correctly.
- [ ] Write regression tests for stale socket close and local leader discovery.
- [ ] Verify tests fail against current behavior.
- [ ] Guard socket callbacks with socket identity/generation.
- [ ] Clear prior reconnect timer before each connect attempt and after successful join.
- [ ] Preserve leader identity in local same-browser room handshake.
- [ ] Verify network tests pass.

### Task 3: Snapshot ordering and local state persistence
**Files:** Modify `public/multiplayer-runtime.js`; modify `tests/multiplayer-runtime.test.mjs`.
**Produces:** Old/duplicate snapshots cannot rewind render state; generic local slot/build selection persists until authoritative confirmation.
- [ ] Add tests for stale snapshot rejection and selection persistence.
- [ ] Verify RED.
- [ ] Add monotonic snapshot sequence handling when sequence metadata is present, with identity fallback for legacy snapshots.
- [ ] Keep local desired selection until server catches up.
- [ ] Verify GREEN.

### Task 4: Host snapshot sequencing and timer behavior
**Files:** Modify `public/app.js`; modify simulation/runtime tests where practical.
**Produces:** Snapshots carry monotonic sequence metadata and high-frequency app timers do not duplicate work already throttled at transport level.
- [ ] Add a snapshot sequence counter reset with match state.
- [ ] Include sequence in each host snapshot message.
- [ ] Reduce redundant hello/ping generation at the app loop while preserving liveness.
- [ ] Verify state transitions still force immediate transport sends.

### Task 5: Renderer performance safeguards
**Files:** Modify `public/engine.js` and, if needed, add a focused test/helper module.
**Produces:** Excessive device-pixel-ratio and sustained slow-frame rendering cannot overload the client indefinitely.
- [ ] Identify all canvas resize paths and dynamic geometry upload points.
- [ ] Introduce a single render-scale helper with quality tiers.
- [ ] Cap DPR/resolution more aggressively when sustained frame time is high, recover gradually when stable.
- [ ] Keep nearby/local character detail intact; reduce only resolution/remote-detail work that is not gameplay state.
- [ ] Verify syntax and lobby/game resize behavior.

### Task 6: Build/config/deployment integrity
**Files:** Modify `build.mjs`, `package.json`, and tests if needed.
**Produces:** Production build always includes stability modules/config validation and catches generated-output drift.
- [ ] Add build-time assertions for required runtime files.
- [ ] Ensure public secret-key rejection remains enforced.
- [ ] Bump patch version.
- [ ] Run/observe full build verification available through CI/Vercel.

### Task 7: Final verification and integration
**Files:** No new behavior unless verification reveals a regression.
- [ ] Re-read final diff against spec.
- [ ] Run full available test/syntax/build checks.
- [ ] Re-run Supabase advisors and SQL checks.
- [ ] Verify GitHub/Vercel commit/deployment status.
- [ ] Fast-forward `main` only if verification evidence is clean; otherwise leave the repair branch isolated and report blockers.