import test from "node:test";
import assert from "node:assert/strict";
const rules = await import("../public/hcs-rules.js").catch(() => ({}));
test("HCS is anchored November 1 at Sydney 7pm and repeats on calendar Sundays", () => {
  assert.equal(typeof rules.editionAt, "function");
  assert.equal(
    new Date(rules.editionAt(0)).toISOString(),
    "2026-11-01T08:00:00.000Z",
  );
  assert.equal(
    new Date(rules.editionAt(8)).toISOString(),
    "2027-04-18T09:00:00.000Z",
  );
});
test("rankings exclude fewer than ten games and deterministically resolve ties", () => {
  assert.equal(typeof rules.leaderboard, "function");
  const rows = rules.leaderboard([
    { id: "b", games: 10, wins: 2, kills: 10 },
    { id: "a", games: 10, wins: 2, kills: 10 },
    { id: "x", games: 9, wins: 9, kills: 100 },
  ]);
  assert.deepEqual(
    rows.map((x) => x.id),
    ["a", "b"],
  );
  assert.equal(rows[0].points, 300);
});
test("at grace deadline checked-in reserves fill vacancies in rank order", () => {
  assert.equal(typeof rules.selectFinalists, "function");
  const ranks = Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1) }));
  assert.deepEqual(
    rules.selectFinalists(ranks, new Set(["1", "3", "5", "6", "8", "9"])),
    ["1", "3", "5", "6", "8"],
  );
});

test("each edition stays on Sunday 19:00 Sydney across multiple daylight-saving changes", () => {
  for (let i = 0; i < 30; i++) {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(rules.editionAt(i));
    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    assert.equal(values.weekday, "Sunday");
    assert.equal(values.hour, "19");
    assert.equal(values.minute, "00");
  }
});

test("postponements remain Sunday 19:00 Sydney across DST boundaries", () => {
  assert.equal(typeof rules.postponeAt, "function");
  for (const index of [7, 33]) {
    const at = rules.postponeAt(rules.editionAt(index));
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Sydney",
        weekday: "long",
        hour: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(at)
        .map((p) => [p.type, p.value]),
    );
    assert.equal(parts.weekday, "Sunday");
    assert.equal(parts.hour, "19");
  }
});
