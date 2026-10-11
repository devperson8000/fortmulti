import test from "node:test";
import assert from "node:assert/strict";
const api = await import("../public/hcs-presentation.js").catch(() => ({}));
const profiles = [
  { id: "a", name: "Ranger" },
  { id: "b", name: "Viper" },
];
const state = {
  phase: "done",
  winner: 0,
  round: 1,
  elapsed: 88,
  players: [
    { id: "a", hp: 72, shield: 0, p: [1, 0, 2], weapon: "ar" },
    { id: "b", hp: 0, p: [2, 0, 2] },
  ],
  tournamentKills: { a: 4 },
};
test("HCS celebration resolves the actual survivor and distinguishes player victory from broadcast", () => {
  assert.equal(typeof api.hcsResult, "function");
  const own = api.hcsResult(state, profiles, "a");
  assert.equal(own.won, true);
  assert.equal(own.name, "Ranger");
  assert.equal(own.kills, 4);
  assert.equal(api.hcsResult(state, profiles, "b").won, false);
  assert.equal(api.hcsResult(state, profiles, "a", true).won, false);
  for (const phase of ["playing", "roundover", "abandoned"])
    assert.equal(api.hcsResult({ ...state, phase }, profiles, "a"), null);
  assert.equal(api.hcsResult({ ...state, winner: -1 }, profiles, "a"), null);
});
test("celebration hero pose preserves the real match and cannot raise a dead player", () => {
  assert.equal(typeof api.hcsHeroState, "function");
  const original = structuredClone(state),
    hero = api.hcsHeroState(state);
  assert.ok(hero.players[0].saluteProgress > 0.8);
  assert.equal(hero.players[0].weapon, null);
  assert.equal(hero.players[1].hp, 0);
  assert.deepEqual(state, original);
  assert.equal(
    api.hcsHeroState({ ...state, phase: "playing" }).players[0].saluteProgress,
    undefined,
  );
});
