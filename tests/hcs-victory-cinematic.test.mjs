import test from "node:test";
import assert from "node:assert/strict";
import * as api from "../public/hcs-victory-cinematic.js";
import { FinalMatch, Referee } from "../public/hcs-referee-core.js";
import { DEPLOYMENT_SHIP } from "../public/deployment-ship.js";
const context = {
  winner: [12, 1.5, -20],
  yaw: 0.7,
  landing: [12 - 4.4 * Math.sin(0.7), 1.5, -20 - 4.4 * Math.cos(0.7)],
};
test("winning starts visibly on the current map, with an arriving closed rescue pod and no black screen", () => {
  const f = api.hcsVictoryCinematic(0, context);
  assert.equal(f.scene, "match");
  assert.equal(f.fade, 0);
  assert.deepEqual(f.actor, context.winner);
  assert.equal(f.stage, "pickup");
  assert.equal(f.doorOpen, 0);
  assert.ok(f.pod[1] > context.landing[1] + 30);
  const landed = api.hcsVictoryCinematic(api.HCS_VICTORY_LANDING, context);
  assert.deepEqual(landed.pod, context.landing);
  assert.ok(landed.impact > 0.9);
});
test("winner boards on the map, seals inside, launches upward, and only then transitions to black with music", () => {
  const board = api.hcsVictoryCinematic(4.3, context);
  assert.equal(board.scene, "match");
  assert.equal(board.stage, "boarding");
  assert.ok(board.actorVisible > 0);
  assert.equal(board.fade, 0);
  const launch = api.hcsVictoryCinematic(
    api.HCS_VICTORY_MUSIC.start + 0.3,
    context,
  );
  assert.equal(launch.stage, "launch");
  assert.equal(launch.scene, "match");
  assert.ok(launch.pod[1] > context.landing[1]);
  assert.equal(launch.actorVisible, 0);
  assert.equal(launch.doorOpen, 0);
  assert.ok(launch.fade > 0);
  const black = api.hcsVictoryCinematic(7.7, context);
  assert.equal(black.fade, 1);
  assert.equal(black.actorVisible, 0);
});
test("pod returns into the existing spaceship floor hatch before the champion exits and salutes", () => {
  const dock = api.hcsVictoryCinematic(api.HCS_VICTORY_DOCK, context);
  assert.equal(dock.scene, "ship");
  assert.equal(dock.stage, "opening");
  assert.equal(dock.pod[1], DEPLOYMENT_SHIP.origin[1]);
  const exit = api.hcsVictoryCinematic(api.HCS_VICTORY_DOCK + 1.3, context);
  assert.equal(exit.stage, "exit");
  assert.ok(exit.actorVisible > 0);
  assert.ok(exit.actor[1] >= 240);
  assert.equal(exit.showResults, false);
  const end = api.hcsVictoryCinematic(api.HCS_VICTORY_DURATION, context);
  assert.equal(end.stage, "salute");
  assert.equal(end.salute, 1);
  assert.equal(end.showResults, true);
  assert.equal(end.fade, 0);
});
test("music uses one forward-playing excerpt and docking and light pulses follow its measured bass drop", () => {
  const m = api.HCS_VICTORY_MUSIC;
  assert.ok(m.start >= 6);
  assert.ok(m.start + m.end - m.offset > api.HCS_VICTORY_DOCK + 2);
  const f = api.hcsVictoryCinematic(api.HCS_VICTORY_DOCK, context);
  assert.ok(f.beat > 0.99);
  assert.ok(
    Math.abs(m.offset + api.HCS_VICTORY_DOCK - m.start - 25.285) < 0.001,
  );
});
test("poses and camera stay finite and continuous within each scene, and keep a stable final salute", () => {
  let last = api.hcsVictoryCinematic(0, context);
  for (let t = 0.016; t < 30; t += 0.016) {
    const next = api.hcsVictoryCinematic(t, context);
    assert.ok(
      [
        ...next.pod,
        ...next.actor,
        ...next.eye,
        ...next.target,
        next.fade,
      ].every(Number.isFinite),
    );
    if (next.scene === last.scene) {
      assert.ok(Math.hypot(...next.pod.map((v, i) => v - last.pod[i])) < 3);
      assert.ok(Math.hypot(...next.eye.map((v, i) => v - last.eye[i])) < 3);
    }
    last = next;
  }
  assert.deepEqual(
    api.hcsVictoryCinematic(100, context).actor,
    api.hcsVictoryCinematic(40, context).actor,
  );
});
test("referee carries victory age through delayed snapshots without exposing the live winning timeline", () => {
  const m = new FinalMatch({ height: () => 0, obstacles: [] }, ["a", "b", "c"]),
    r = new Referee(m, false);
  m.phase = "playing";
  m.players.slice(1).forEach((p) => (p.hp = 0));
  m.checkRoundEnd();
  assert.equal(r.tick(1 / 30, 1000).victoryElapsed, 0);
  const later = r.tick(1 / 30, 6000);
  assert.equal(later.victoryElapsed, 5);
  r.feed.push(6000, later);
  assert.equal(r.feed.at(25999), null);
  assert.equal(r.feed.at(26000).victoryElapsed, 5);
});
