import test from "node:test";
import assert from "node:assert/strict";
import { loadPlatformMap } from "../public/platform23-map.js";
import { createGroundGrid } from "../public/simulation.js";
import { moveHorizontal } from "../public/movement-collision.js";
const api = await import("../public/lab-navigation.js").catch(() => ({}));
test("practice bots can route between supported platform courtyards without crossing walls or voids", async () => {
  assert.equal(typeof api.createLabNavigation, "function");
  const world = await loadPlatformMap(),
    nav = api.createLabNavigation(world, createGroundGrid(world.obstacles, 8));
  const path = nav.route([-35, 1.5, 17], [35, 1.5, 17]);
  assert.ok(path.length > 5);
  assert.ok(Math.hypot(path.at(-1)[0] - 35, path.at(-1)[2] - 17) < 4);
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1],
      to = path[i],
      steps = 16,
      p = from.slice();
    for (let j = 0; j < steps; j++) {
      const before = p.slice();
      moveHorizontal(
        p,
        (to[0] - from[0]) / steps,
        (to[2] - from[2]) / steps,
        world.obstacles,
      );
      assert.ok(Math.hypot(p[0] - before[0], p[2] - before[2]) > 0.01);
      const h = world.supportHeight(p[0], p[2], p[1], 0.55);
      assert.ok(Number.isFinite(h) && Math.abs(h - p[1]) <= 0.55);
      p[1] = h;
    }
  }
});
