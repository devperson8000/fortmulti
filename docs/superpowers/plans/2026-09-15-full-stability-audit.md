# Full Stability Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the confirmed causes of multiplayer lag/glitching, database overhead, configuration drift, and false-green deployments while preserving the existing host-authoritative game architecture.

**Architecture:** Keep the existing static WebGL + Supabase design. Tighten the existing multiplayer runtime rather than rewrite networking, add compact snapshot hydration, harden production config precedence, add conservative browser performance controls, optimize Supabase indexes/RLS, and make Vercel run the full verification suite before deployment.

**Tech Stack:** Browser ES modules, WebGL, Node.js 20+, node:test, Supabase Postgres/Auth/Realtime, Vercel static deployment.

**Spec:** `docs/superpowers/specs/2026-09-15-full-stability-audit-design.md`

## Global Constraints
- Preserve 2–8 player private parties and host-authoritative simulation.
- Preserve anonymous Supabase authentication and authenticated-role RLS access.
- Never expose Supabase secret/service-role keys in browser output.
- Do not lower procedural model topology as the primary performance fix.
- Every confirmed bug gets a failing regression test before production-code changes.
- Final deployment must run `npm run check`.

---

### Task 1: Multiplayer stale-input and cadence bounds

**Files:**
- Modify: `tests/multiplayer-runtime.test.mjs`
- Modify: `public/multiplayer-runtime.js`

**Interfaces:**
- Consumes: `cadenceForPlayers`, `shouldForwardInput`, `installSimulationGrace`
- Produces: bounded `heartbeatMs <= 700` for 2–8 players and host stale-input grace below one second.

- [ ] **Step 1: Write failing tests**

Add assertions that every party size has `heartbeatMs <= 700`, that snapshot cadence never falls below 4 Hz (`snapshotMs <= 250`), and export a pure `staleInputGraceSeconds()` helper that returns a value between `0.15` and `0.35` seconds.

```js
test('all party sizes keep input heartbeat inside the host stale-input window',()=>{
 for(let n=2;n<=8;n++)assert.ok(cadenceForPlayers(n).heartbeatMs<=700,n);
});

test('large parties never drop authoritative snapshots below four hertz',()=>{
 for(let n=2;n<=8;n++)assert.ok(cadenceForPlayers(n).snapshotMs<=250,n);
});

test('simulation grace is bounded instead of preserving stale movement for seconds',()=>{
 const grace=staleInputGraceSeconds();assert.ok(grace>=.15&&grace<=.35);
});
```

- [ ] **Step 2: Verify RED**

Run through the branch deployment verification command after Task 5 changes Vercel to `npm run check`. Expected: the new tests fail because 5–8 player cadence and the grace helper do not satisfy the requirements.

- [ ] **Step 3: Implement minimal cadence/grace fix**

Update `cadenceForPlayers()` so 3-player remains responsive, heartbeat stays at or below 700 ms, and snapshots stay at or above 4 Hz. Replace the `-2.15` last-input offset with `-staleInputGraceSeconds()`.

- [ ] **Step 4: Verify GREEN**

Run the full test suite and confirm all cadence/grace tests pass.

---

### Task 2: Compact repeated multiplayer snapshots

**Files:**
- Modify: `tests/multiplayer-runtime.test.mjs`
- Modify: `public/multiplayer-runtime.js`

**Interfaces:**
- Produces: `createSnapshotCodec(fullEveryMs=2000)` with `encode(state, now)` and `decode(state)` methods.

- [ ] **Step 1: Write failing tests**

Test that the first snapshot contains `structures`/`pickups`, an unchanged snapshot can omit them, changing structures forces a full copy immediately, and `decode()` restores omitted collections from the previous baseline.

```js
test('snapshot codec omits unchanged heavy collections and hydrates them on receive',()=>{
 const codec=createSnapshotCodec(2000),base={players:[],structures:[{x:1}],pickups:[{x:2}],events:[]};
 const first=codec.encode(base,0);assert.deepEqual(first.structures,base.structures);
 const compact=codec.encode(structuredClone(base),100);assert.equal(compact.structures,undefined);
 assert.deepEqual(codec.decode(compact).structures,base.structures);
});
```

- [ ] **Step 2: Verify RED**

Expected: FAIL because `createSnapshotCodec` does not exist.

- [ ] **Step 3: Implement codec and transport integration**

Use stable lightweight signatures for structures/pickups. Full snapshots are sent on first use, collection change, or every 2000 ms. Patch receive handling inside `Connection.prototype.open` so incoming snapshot payloads are hydrated before `app.js` receives them. Never compact local host state passed directly to rendering.

- [ ] **Step 4: Verify GREEN**

Confirm codec tests and existing networking tests pass.

---

### Task 3: Production config precedence and adaptive browser budget

**Files:**
- Create: `public/bootstrap-runtime.js`
- Create: `tests/bootstrap-runtime.test.mjs`
- Modify: `public/config.js`
- Modify: `build.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolveRuntimeConfig(deployed,saved)`, `renderBudget(devicePixelRatio,hardwareConcurrency)`, `bootstrapRuntime(config)`.

- [ ] **Step 1: Write failing tests**

```js
test('valid deployed Supabase config wins over stale browser settings',()=>{
 assert.deepEqual(resolveRuntimeConfig({url:'https://abc.supabase.co',key:'sb_publishable_x'},{url:'https://old.supabase.co',key:'old'}),{url:'https://abc.supabase.co',key:'sb_publishable_x'});
});

test('manual browser config is retained when deployment has no online config',()=>{
 assert.equal(resolveRuntimeConfig({url:'',key:''},{url:'https://abc.supabase.co',key:'k'}).url,'https://abc.supabase.co');
});

test('high DPR laptops receive a conservative pixel budget without low-poly changes',()=>{
 const q=renderBudget(2,8);assert.ok(q.pixelRatio<=1.35&&q.fps>=45);
});
```

- [ ] **Step 2: Verify RED**

Expected: FAIL because `bootstrap-runtime.js` does not exist.

- [ ] **Step 3: Implement minimal bootstrap**

`config.js` sets `window.SUNNY_CONFIG`, imports `bootstrap-runtime.js`, resolves deployment-vs-local config before `app.js` reads storage, and applies a conservative rAF/render-scale policy only when device DPR/concurrency indicates likely pressure. `build.mjs` emits the same bootstrap sequence into `dist/config.js`.

- [ ] **Step 4: Verify GREEN**

Run bootstrap tests and a production build; verify `dist/bootstrap-runtime.js` exists and generated `dist/config.js` references both bootstrap and multiplayer runtime.

---

### Task 4: Supabase performance and schema drift repair

**Files:**
- Modify: `supabase.sql`
- Create: `docs/superpowers/migrations/2026-09-15_supabase_performance.sql`

**Interfaces:**
- Produces indexes `duel_room_members_user_idx`, `duel_rooms_host_idx`, `duel_rooms_guest_idx`; optimized RLS predicates using `(select auth.uid())`.

- [ ] **Step 1: Verify current failure evidence**

Use Supabase performance advisors. Expected before fix: three `unindexed_foreign_keys` findings and four `auth_rls_initplan` findings.

- [ ] **Step 2: Add migration SQL**

```sql
create index if not exists duel_room_members_user_idx on public.duel_room_members(user_id);
create index if not exists duel_rooms_host_idx on public.duel_rooms(host);
create index if not exists duel_rooms_guest_idx on public.duel_rooms(guest) where guest is not null;
```

Recreate `duel_members_read`, `duel_room_member_self_read`, `duel_broadcast_read`, and `duel_broadcast_write` using `(select auth.uid())` in place of direct `auth.uid()` calls.

- [ ] **Step 3: Apply as a named Supabase migration**

Apply migration `fortmulti_performance_20260915` to project `jdcrbzewnaxjiswfswxd`.

- [ ] **Step 4: Verify database GREEN**

Run verification SQL for index existence/policy definitions, then rerun security/performance advisors. The three FK-index findings and four initplan findings must be gone. Anonymous-sign-in warnings remain documented as intentional for this game.

---

### Task 5: Make deployments prove tests pass

**Files:**
- Modify: `vercel.json`
- Modify: `package.json`
- Create: `tests/build-config.test.mjs`

**Interfaces:**
- Vercel build command becomes `npm run check`.

- [ ] **Step 1: Write failing deployment-config test**

```js
test('Vercel runs the full verification suite before publishing dist',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(config.buildCommand,'npm run check');
});
```

- [ ] **Step 2: Verify RED**

Expected: FAIL because current `vercel.json` uses `npm run build`.

- [ ] **Step 3: Update Vercel build command and syntax coverage**

Set `buildCommand` to `npm run check`. Add `public/bootstrap-runtime.js` to `npm run syntax`.

- [ ] **Step 4: Verify GREEN through Vercel Git integration**

Push branch commits and confirm the Vercel commit status is green. A green status now proves syntax, tests and build all completed.

---

### Task 6: Final verification and merge

**Files:** all changed files above.

- [ ] **Step 1: Review branch diff**

Confirm no secret keys, service-role keys, unrelated feature work, or generated junk were added.

- [ ] **Step 2: Run final verification evidence**

Require: Vercel green status on branch after `npm run check`; Supabase verification SQL successful; performance advisors clear of targeted findings; security advisors contain no new high-severity regression.

- [ ] **Step 3: Merge branch**

Fast-forward `main` to the verified branch commit only after Step 2 is satisfied.

- [ ] **Step 4: Verify production commit**

Confirm the new `main` SHA and its Vercel status. Attempt Vercel project/log inspection again; if the connector still returns 403 for team `team_QsK2qtPZsiF9rEbD34vCfJYa`, report that as the only external observability limitation rather than claiming those logs were inspected.
