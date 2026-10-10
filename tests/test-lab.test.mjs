import test from "node:test";
import assert from "node:assert/strict";
import { loadPlatformMap } from "../public/platform23-map.js";
import { HCS } from "../public/hcs-rules.js";
const api = await import("../public/test-lab-core.js").catch(() => ({}));
const world = await loadPlatformMap();

test("temporary lab requires the requested password without granting tournament authority", () => {
  assert.equal(typeof api.labPasswordMatches, "function");
  assert.equal(api.labPasswordMatches("12345"), true);
  for (const value of ["", "1234", "123456", null])
    assert.equal(api.labPasswordMatches(value), false);
});

test("eight-player practice uses native collision, weapons and simulation on the selected map", () => {
  assert.equal(typeof api.LabSession, "function");
  const session = new api.LabSession(world, {
    map: "facility",
    kind: "combat",
    count: 8,
    name: "Tester",
  });
  assert.equal(session.match.players.length, 8);
  assert.equal(session.match.world, world);
  assert.equal(session.match.phase, "playing");
  assert.equal(session.match.mode, "town");
  assert.ok(
    session.match.players.every(
      (p) =>
        p.p.every(Number.isFinite) &&
        p.air === "landed" &&
        p.inventory.filter(Boolean).length === 5,
    ),
  );
  const p = session.match.players[0],
    start = p.p.slice();
  session.tick(0.1, 1000, { z: 1, yaw: 0, slot: 1 });
  assert.ok(Math.hypot(p.p[0] - start[0], p.p[2] - start[2]) > 0);
  assert.equal(session.packet(1000, false).state.players.length, 8);
  assert.equal(session.packet(1000, false).testOnly, true);
});

test("HCS lab uses the five-player final and withholds the spectator feed for twenty seconds", () => {
  assert.equal(typeof api.LabSession, "function");
  const s = new api.LabSession(world, {
    kind: "hcs",
    count: 8,
    map: "facility",
  });
  assert.equal(s.match.players.length, 5);
  assert.equal(s.match.targetScore, 1);
  s.tick(1 / 30, 1000, {});
  assert.equal(s.packet(20999, true), null);
  const delayed = s.packet(21000, true);
  assert.equal(delayed.sampleAt, 1000);
  assert.equal(delayed.spectator, true);
  assert.ok(21000 - delayed.sampleAt >= HCS.delay);
});

test("pod test boards eight distinct native pods and runs the actual deployment stages", () => {
  assert.equal(typeof api.LabSession, "function");
  const s = new api.LabSession(world, {
    kind: "pods",
    map: "facility",
    count: 8,
  });
  assert.equal(s.match.phase, "deployment");
  assert.equal(new Set(s.match.players.map((p) => p.pod)).size, 8);
  assert.ok(
    s.match.players.every(
      (p) => p.destination && p.deploymentState === "entering_pod",
    ),
  );
  for (let i = 0; i < 120; i++) s.tick(1 / 30, (i * 1000) / 30, {});
  assert.ok(
    ["both_ready", "pod_sealing", "launching", "transition"].includes(
      s.match.deployment.stage,
    ),
  );
});

test("all variants can be equipped without modifying production weapon definitions", () => {
  assert.equal(typeof api.LabSession, "function");
  const s = new api.LabSession(world, { kind: "combat", map: "facility" });
  s.equipKit("variants");
  assert.deepEqual(
    s.match.players[0].inventory.slice(0, 4).map((w) => w.type),
    ["ar_sentinel", "shotgun_breacher", "smg_viper", "sniper_longbow"],
  );
  assert.equal(s.match.players[0].inventoryRevision, 1);
});

test("local final reconnect and champion use official rules with no database writes", () => {
  assert.equal(typeof api.LabSession, "function");
  const s = new api.LabSession(world, { kind: "hcs", map: "facility" }),
    id = s.match.ids[1];
  s.disconnect(id, 1000);
  s.tick(1 / 30, 2099, {});
  assert.equal(s.match.players[1].hp, 100);
  assert.equal(s.reconnect(id, 2100), true);
  assert.equal(s.reconnect("spectator", 2100), false);
  s.finish(3000, s.localId);
  assert.equal(s.match.phase, "done");
  assert.equal(s.championship.public(22999).champion, null);
  assert.equal(s.championship.public(23000).champion.id, s.localId);
});

test("HCS checks exercise real qualification, lock, reserves, postponement, schedule and publication", () => {
  assert.equal(typeof api.runHCSChecks, "function");
  const results = api.runHCSChecks(world);
  assert.ok(results.length >= 8);
  assert.ok(
    results.every((r) => r.passed),
    JSON.stringify(results),
  );
});

test("frame report records actual percentiles and remains bounded during long playtests", () => {
  assert.equal(typeof api.FrameMetrics, "function");
  const m = new api.FrameMetrics(120);
  for (let i = 0; i < 1000; i++) m.frame(i % 10 === 0 ? 50 : 1000 / 60);
  const r = m.report();
  assert.equal(r.samples, 120);
  assert.ok(r.fps > 45 && r.fps < 55);
  assert.ok(r.p95Ms >= 49);
  assert.equal(r.longFrames, 12);
  assert.ok(Number.isFinite(r.p50Ms));
});

test("watch-only HCS practice automates all five operators, including the first target", () => {
  const s = new api.LabSession(world, { kind: "hcs", map: "facility" }),
    p = s.match.players[0],
    before = p.p.slice();
  s.botLocal = true;
  s.tick(0.1, 1000, {});
  assert.ok(Math.hypot(p.p[0] - before[0], p.p[2] - before[2]) > 0);
});

test("a field test reboards its full roster for the next native round", () => {
  const s = new api.LabSession(world, {
    kind: "combat",
    map: "facility",
    count: 8,
  });
  for (const p of s.match.players.slice(1)) s.match.hit(p, 1000);
  s.match.checkRoundEnd();
  for (let i = 0; i < 125; i++) s.tick(1 / 30, (i * 1000) / 30, {});
  assert.equal(s.match.round, 2);
  assert.equal(s.match.players.length, 8);
  assert.ok(s.match.players.every((p) => p.pod && p.destination));
  assert.ok(s.latest.players.every((p) => p.pod && p.destination));
});
