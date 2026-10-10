import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../public/simulation.js";
const playing = () => {
  const m = new Match({ height: () => 0, obstacles: [] }, ["a", "b"]);
  m.phase = "playing";
  for (const p of m.players) {
    p.air = "landed";
    p.p = [p.id === "a" ? 0 : 20, 0, 0];
  }
  return m;
};
test("local simulation catches up a slow frame with bounded collision-safe steps", () => {
  const m = playing();
  assert.equal(typeof m.tickElapsed, "function");
  m.input("a", { x: 1 });
  m.tickElapsed(0.2);
  assert.ok(
    Math.abs(m.elapsed - 0.2) < 1e-8,
    "200ms delay must not advance gameplay by just 50ms",
  );
  assert.ok(Math.abs(m.players[0].p[0] - 6.8 * 0.2) < 1e-6);
});
test("long suspension has a bounded catch-up budget and does not teleport players", () => {
  const m = playing();
  assert.equal(typeof m.tickElapsed, "function");
  m.input("a", { x: 1, sprint: true });
  m.tickElapsed(30);
  assert.ok(m.elapsed <= 0.250001);
  assert.ok(m.players[0].p[0] <= 2.551);
});
test("scripted deployment keeps the music clock rather than the combat catch-up cap", () => {
  const m = playing();
  assert.equal(typeof m.tickElapsed, "function");
  m.phase = "deployment";
  m.deployment.stage = "both_ready";
  m.deployment.elapsed = 0;
  m.tickElapsed(5, { deploymentElapsed: 5 });
  assert.equal(m.deployment.elapsed, 5);
});
