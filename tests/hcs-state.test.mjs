import test from "node:test";
import assert from "node:assert/strict";
const api = await import("../server/hcs-state.mjs").catch(() => ({}));
test("freeze preserves qualifiers and substitutes checked-in reserves at deadline", () => {
  assert.equal(typeof api.Championship, "function");
  const c = new api.Championship();
  c.state.players = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [
      String(i),
      { id: String(i), name: `Player ${i}`, games: 10, wins: 9 - i, kills: 0 },
    ]),
  );
  c.advance(c.state.at - 172800000);
  assert.equal(c.state.ranks.length, 9);
  for (const id of ["0", "2", "4", "5", "7"])
    c.checkin(id, c.state.at - 600000);
  const ids = c.advance(c.state.at + 300000);
  assert.deepEqual(ids, ["0", "2", "4", "5", "7"]);
});
test("completed qualifying results are idempotent and browser score submissions are not an API", () => {
  assert.equal(typeof api.Championship, "function");
  const c = new api.Championship();
  c.recordVerifiedMatch("match1", [
    { id: "a", name: "Aaa", kills: 3, winner: true },
  ]);
  c.recordVerifiedMatch("match1", [
    { id: "a", name: "Aaa", kills: 3, winner: true },
  ]);
  assert.equal(c.state.players.a.games, 1);
  assert.equal(c.state.players.a.wins, 1);
});
test("spectators cannot receive snapshots or winner information before twenty seconds", () => {
  assert.equal(typeof api.DelayedFeed, "function");
  const f = new api.DelayedFeed();
  f.push(1000, { winner: "a" });
  assert.equal(f.at(20999), null);
  assert.deepEqual(f.at(21000), { winner: "a" });
});
test("rankings freeze before a late-arriving qualifying result is counted", () => {
  const c = new api.Championship(null, 0);
  c.state.players = {
    a: { id: "a", name: "Aaa", games: 10, wins: 1, kills: 0 },
    b: { id: "b", name: "Bbb", games: 10, wins: 0, kills: 0 },
  };
  c.recordVerifiedMatch(
    "late",
    [{ id: "b", name: "Bbb", kills: 100, winner: true }],
    c.state.at - 172800000 + 1,
  );
  assert.deepEqual(
    c.state.ranks.map((p) => p.id),
    ["a", "b"],
  );
});
test("disconnected checked-in players do not displace connected reserves", () => {
  const c = new api.Championship(null, 0);
  c.state.phase = "checkin";
  c.state.ranks = Array.from({ length: 9 }, (_, i) => ({ id: String(i) }));
  c.state.checked = ["0", "1", "2", "3", "4", "5"];
  assert.deepEqual(
    c.advance(c.state.at + 300000, new Set(["0", "2", "3", "4", "5"])),
    ["0", "2", "3", "4", "5"],
  );
});
test("late finals remain live publicly until the champion broadcast catches up", () => {
  const c = new api.Championship(null, 0);
  c.state.phase = "live";
  c.state.finalists = ["a"];
  c.state.players.a = { id: "a", name: "Aaa", games: 10, wins: 1, kills: 0 };
  const finish = c.state.at + 600000;
  c.finish("a", finish);
  c.advance(finish + 1);
  assert.equal(c.public(finish + 1).phase, "live");
  assert.equal(c.public(finish + 19999).champion, null);
  c.advance(finish + 20000);
  assert.equal(c.public(finish + 20000).champion.name, "Aaa");
});

test("missing qualifiers are held through grace, then a three-player final can start", () => {
  const c = new api.Championship(null, 0);
  c.state.phase = "checkin";
  c.state.ranks = Array.from({ length: 9 }, (_, i) => ({ id: String(i) }));
  c.state.checked = ["1", "3", "6"];
  assert.equal(c.advance(c.state.at), null);
  assert.deepEqual(c.advance(c.state.at + 300000), ["1", "3", "6"]);
});
test("two checked-in entrants postpone one week while retaining the locked ranking", () => {
  const c = new api.Championship(null, 0);
  c.state.phase = "checkin";
  c.state.ranks = Array.from({ length: 9 }, (_, i) => ({ id: String(i) }));
  c.state.checked = ["1", "6"];
  const at = c.state.at;
  c.advance(at + 300000);
  assert.equal(c.state.at, at + 604800000);
  assert.equal(c.state.phase, "locked");
  assert.equal(c.state.ranks.length, 9);
  assert.deepEqual(c.state.checked, []);
});
test("unqualified players and early check-in requests are refused", () => {
  const c = new api.Championship(null, 0);
  assert.throws(() => c.checkin("a", c.state.at - 900001));
  c.state.phase = "checkin";
  c.state.ranks = [{ id: "a" }];
  assert.throws(() => c.checkin("b", c.state.at));
});

test("an underfilled ranking can qualify new entrants after a postponed edition", () => {
  const c = new api.Championship(null, 0);
  c.state.phase = "checkin";
  c.state.ranks = [];
  const at = c.state.at;
  c.advance(at + 300000);
  c.state.players = Object.fromEntries(
    ["a", "b", "c"].map((id) => [
      id,
      { id, name: "Operator " + id, games: 10, wins: 1, kills: 1 },
    ]),
  );
  c.advance(c.state.at - 172800000);
  assert.equal(c.state.ranks.length, 3);
});

test("recording a result cannot start a scheduled final without the connected roster", () => {
  const c = new api.Championship(null, 0);
  c.state.phase = "checkin";
  c.state.ranks = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  c.state.checked = ["a", "b", "c", "d", "e"];
  c.recordVerifiedMatch("x", [{ id: "z", name: "Zulu", kills: 1 }], c.state.at);
  assert.equal(c.state.phase, "checkin");
});

test('HCS retains the existing outfit color when verified stats are recorded',()=>{const c=new api.Championship(null,0);c.register('a','Alpha','557959');c.recordVerifiedMatch('first',[{id:'a',name:'Alpha',kills:1}],0);assert.equal(c.state.players.a.color,'557959');c.register('a','Alpha','<script>');assert.equal(c.state.players.a.color,'557959');});
