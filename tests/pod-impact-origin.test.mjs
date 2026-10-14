import test from "node:test";
import assert from "node:assert/strict";
import { podLandingBurst } from "../public/deployment-cinematic.js";
import {
  hcsVictoryCinematic,
  HCS_VICTORY_LANDING,
} from "../public/hcs-victory-cinematic.js";
import { createEffectPool } from "../public/effect-pool.js";

test("HCS rescue crash debris stays at the rendered pod, rather than the world origin", () => {
  for (const yaw of [0, 0.7, Math.PI]) {
    const frame = hcsVictoryCinematic(HCS_VICTORY_LANDING + 0.02, {
      winner: [63, 7, -104],
      yaw,
    });
    const pool = createEffectPool(40);
    for (const effect of podLandingBurst(frame.pod, 40, () => 0.5))
      pool.spawn(effect);
    assert.equal(pool.activeCount, 40);
    pool.forEachActive((effect) => {
      assert.ok(
        Math.hypot(effect.p[0] - frame.pod[0], effect.p[2] - frame.pod[2]) <
          1.4,
        "dust and debris must start around the capsule footprint",
      );
      assert.ok(
        effect.p[1] > frame.pod[1] && effect.p[1] < frame.pod[1] + 0.31,
      );
    });
  }
});
test("array and object landing coordinates produce the same finite crash burst", () => {
  const array = podLandingBurst([63, 7, -104], 80, () => 0.5),
    object = podLandingBurst({ x: 63, y: 7, z: -104 }, 80, () => 0.5);
  assert.deepEqual(array, object);
  assert.ok(array.every((effect) => effect.p.every(Number.isFinite)));
});
test("invalid pod coordinates skip the burst instead of becoming particles at zero", () => {
  for (const point of [
    null,
    undefined,
    [NaN, 2, 3],
    [1, Infinity, 3],
    [1, 2],
    { x: 1, y: 2, z: NaN },
    {},
  ])
    assert.deepEqual(
      podLandingBurst(point, 40, () => 0.5),
      [],
    );
  assert.equal(
    podLandingBurst([0, 0, 0], 40, () => 0.5).length,
    40,
    "the real world origin remains valid",
  );
});
