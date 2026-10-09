import test from "node:test";
import assert from "node:assert/strict";
const api = await import("../server/hcs-referee.mjs").catch(() => ({}));
test("five-player referee rejects spectator controls and retains disconnected bodies for sixty seconds", async () => {
  assert.equal(typeof api.Referee, "function");
  const r = await api.Referee.create(["a", "b", "c", "d", "e"]);
  assert.equal(r.input("viewer", { fire: true }), false);
  assert.equal(r.match.players.length, 5);
  r.disconnect("a", 1000);
  r.tick(0.033, 60999);
  assert.equal(r.match.players[0].hp, 100);
  r.tick(0.033, 61000);
  assert.equal(r.match.players[0].hp, 0);
});
test("referee reconnect restores input authority without reviving eliminated competitors", async () => {
  assert.equal(typeof api.Referee, "function");
  const r = await api.Referee.create(["a", "b", "c", "d", "e"]);
  r.disconnect("a", 1000);
  assert.equal(r.reconnect("a", 2000), true);
  assert.equal(r.input("a", { yaw: 1 }), true);
  assert.equal(r.reconnect("viewer", 2000), false);
});
test("delayed broadcast includes the actual camera pitch and verified elimination count", async () => {
  const r = await api.Referee.create(["a", "b", "c", "d", "e"]);
  r.match.players[0].pitch = 0.4;
  r.match.event({ type: "elimination", by: "a", hit: "b" });
  const snapshot = r.tick(0.033, 1000);
  assert.equal(snapshot.players[0].pitch, 0.4);
  assert.equal(snapshot.tournamentKills.a, 1);
  r.tick(0.033, 1001);
  assert.equal(r.feed.at(21001).tournamentKills.a, 1);
});
test("a final with no survivors reboards a replay instead of crowning nobody or getting stuck", async () => {
  const r = await api.Referee.create(["a", "b", "c", "d", "e"]);
  r.match.phase = "playing";
  for (const p of r.match.players) p.hp = 0;
  r.match.checkRoundEnd();
  for (let i = 0; i < 130; i++) r.tick(0.033, i * 33);
  assert.equal(r.match.round, 2);
  assert.ok(r.match.players.every((p) => p.pod && p.destination));
  assert.notEqual(r.match.phase, "done");
});

test("repeated leave or socket-close events do not extend the sixty-second deadline", async () => {
  const r = await api.Referee.create(["a", "b", "c", "d", "e"]);
  r.disconnect("a", 1000);
  r.disconnect("a", 50000);
  r.tick(0.033, 61000);
  assert.equal(r.match.players[0].hp, 0);
});

test("simultaneous timeout of every competitor cannot crown a dead contestant", async () => {
  const r = await api.Referee.create(["a", "b", "c"]);
  r.match.phase = "playing";
  for (const id of r.match.ids) r.disconnect(id, 0);
  r.tick(1 / 30, 60000);
  assert.equal(
    r.match.players.every((p) => p.hp === 0),
    true,
  );
  assert.equal(r.match.phase, "abandoned");
  assert.equal(r.match.winner, -1);
});

test("reconnects exactly at expiry cannot bypass atomic timeout adjudication", async () => {
  const r = await api.Referee.create(["a", "b", "c"]);
  r.match.phase = "playing";
  for (const id of r.match.ids) r.disconnect(id, 0);
  assert.equal(r.reconnect("a", 60000), false);
  assert.equal(r.reconnect("b", 60000), false);
  r.tick(1 / 30, 60000);
  assert.equal(r.match.phase, "abandoned");
  assert.equal(r.match.winner, -1);
});
