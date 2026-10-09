import test from "node:test";
import assert from "node:assert/strict";
const api = await import("../server/hcs-world.mjs").catch(() => ({}));
test("official qualifying worlds retain both map rules and native collision", async () => {
  assert.equal(typeof api.officialWorld, "function");
  const island = await api.officialWorld("island"),
    platform = await api.officialWorld("facility");
  assert.equal(Number.isFinite(island.height(0, 0)), true);
  assert.ok(island.resources.length > 0);
  assert.ok(island.chests.length > 20);
  assert.equal(platform.rules.building, false);
  assert.equal(platform.nativeSupportOnly, true);
  assert.ok(platform.obstacles.length > 100);
});

test("qualifying referees do not allocate a spectator delay buffer", async () => {
  const { Referee } = await import("../server/hcs-referee.mjs");
  const { Match } = await import("../public/simulation.js");
  const world = await api.officialWorld("island"),
    r = new Referee(new Match(world, ["a", "b"], "build"), false);
  r.tick(0.033, 1000);
  assert.equal(r.feed.frames.length, 0);
});
