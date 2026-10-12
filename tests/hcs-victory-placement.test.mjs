import test from "node:test";
import assert from "node:assert/strict";
import { victoryPickupPlacement } from "../public/hcs-victory-placement.js";
import { platformLayout, loadPlatformMap } from "../public/platform23-map.js";
test("rescue pod uses a reachable point in front of the winner on clear ground", () => {
  const winner = { p: [10, 0, 20], yaw: 0.6 },
    before = structuredClone(winner),
    context = victoryPickupPlacement(winner, {
      height: () => 0,
      obstacles: [],
    });
  assert.equal(context.relocated, false);
  assert.ok(
    Math.abs(
      Math.hypot(context.landing[0] - 10, context.landing[2] - 20) - 4.4,
    ) < 0.001,
  );
  assert.deepEqual(winner, before);
});
test("an indoor finish selects an existing clear landing site instead of descending through its roof", () => {
  const context = victoryPickupPlacement(
    { p: [0, 0, 0], yaw: 0 },
    {
      height: () => 0,
      obstacles: [{ min: [-20, 3, -20], max: [20, 4, 20] }],
      landingPoints: [{ x: 60, z: 0 }],
    },
  );
  assert.equal(context.relocated, true);
  assert.equal(context.landing[0], 60);
  assert.equal(context.landing[2], 0);
  assert.ok(
    Math.abs(Math.hypot(context.winner[0] - 60, context.winner[2]) - 4.4) <
      0.001,
  );
});
test("Platform 23 supported finish positions resolve to a safe supported outdoor pickup", async () => {
  await loadPlatformMap();
  const world = platformLayout();
  let samples = 0;
  for (let x = -72; x <= 72; x += 12)
    for (let z = -36; z <= 36; z += 12) {
      const y = world.height(x, z);
      if (y < -1) continue;
      const f = victoryPickupPlacement({ p: [x, y, z], yaw: 0.2 }, world);
      assert.ok(
        world.isLandingClear(f.landing[0], f.landing[2], f.landing[1], 1.22),
        `${x},${z} has no safe rescue`,
      );
      samples++;
    }
  assert.ok(samples > 30);
});
