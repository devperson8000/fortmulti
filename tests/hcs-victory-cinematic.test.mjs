import test from "node:test";
import assert from "node:assert/strict";
const api = await import("../public/hcs-victory-cinematic.js").catch(
  () => ({}),
);
import { FinalMatch, Referee } from "../public/hcs-referee-core.js";
import { DEPLOYMENT_CUES } from "../public/deployment-cues.js";
test("victory music reaches the supplied beat drop at boost and continues into the salute without looping", () => {
  const music = api.HCS_VICTORY_MUSIC;
  assert.ok(music);
  assert.ok(
    Math.abs(music.offset + 5.3 - music.start - DEPLOYMENT_CUES.impact) < 0.001,
  );
  const atEnd = music.start + music.end - music.offset;
  assert.ok(atEnd > 9.62 && atEnd < api.HCS_VICTORY_DURATION);
});
test("the referee stamps victory time into the delayed snapshots, rather than revealing a live timeline to viewers", () => {
  const match = new FinalMatch({ height: () => 0, obstacles: [] }, [
    "a",
    "b",
    "c",
  ]);
  const referee = new Referee(match, false);
  match.phase = "playing";
  match.players.slice(1).forEach((p) => (p.hp = 0));
  match.checkRoundEnd();
  const first = referee.tick(1 / 30, 1000);
  assert.equal(first.victoryElapsed, 0);
  const later = referee.tick(1 / 30, 6000);
  assert.equal(later.victoryElapsed, 5);
  referee.feed.push(6000, later);
  assert.equal(referee.feed.at(25999), null);
  assert.equal(referee.feed.at(26000).victoryElapsed, 5);
});
test("champion cinematic hides every weapon and seals the operator inside before boost", () => {
  assert.equal(typeof api.hcsVictoryCinematic, "function");
  const start = api.hcsVictoryCinematic(0);
  assert.equal(start.stage, "fade_out");
  const enter = api.hcsVictoryCinematic(3);
  assert.equal(enter.stage, "boarding");
  assert.ok(enter.actorVisible > 0);
  const flight = api.hcsVictoryCinematic(5.8);
  assert.equal(flight.stage, "launch");
  assert.equal(flight.actorVisible, 0);
  assert.equal(flight.doorOpen, 0);
  assert.ok(flight.pod[1] > 240);
  assert.ok(flight.boost > 0);
});
test("pod returns through the hatch and opens before the champion walks out and salutes", () => {
  assert.equal(typeof api.hcsVictoryCinematic, "function");
  const returning = api.hcsVictoryCinematic(6.95);
  assert.equal(returning.stage, "return");
  assert.equal(returning.actorVisible, 0);
  const opened = api.hcsVictoryCinematic(8.3);
  assert.equal(opened.stage, "opening");
  assert.ok(opened.doorOpen > 0);
  const exit = api.hcsVictoryCinematic(9.1);
  assert.equal(exit.stage, "exit");
  assert.ok(exit.actorVisible > 0);
  const end = api.hcsVictoryCinematic(18);
  assert.equal(end.stage, "salute");
  assert.ok(end.salute > 0.9);
  assert.equal(end.showResults, true);
});
test("victory trajectory stays finite, uses fixed time and clamps scenery after completion", () => {
  assert.equal(typeof api.hcsVictoryCinematic, "function");
  let last = api.hcsVictoryCinematic(0);
  for (let t = 0.016; t < 25; t += 0.016) {
    const next = api.hcsVictoryCinematic(t);
    assert.ok(
      [
        ...next.pod,
        ...next.actor,
        ...next.eye,
        ...next.target,
        next.fade,
      ].every(Number.isFinite),
    );
    assert.ok(Math.hypot(...next.pod.map((v, i) => v - last.pod[i])) < 2);
    last = next;
  }
  const end = api.hcsVictoryCinematic(100);
  assert.equal(end.pod[1], 240);
  assert.equal(end.fade, 0);
  assert.deepEqual(api.hcsVictoryCinematic(6), api.hcsVictoryCinematic(6));
});

test("flight framing looks through the open roof instead of into a ceiling panel", () => {
  for (let t = 5.5; t < 7.7; t += 0.05) {
    const f = api.hcsVictoryCinematic(t);
    if (f.target[1] < 248.5 || f.eye[1] > 248.2) continue;
    const u = (248.2 - f.eye[1]) / (f.target[1] - f.eye[1]);
    const x = f.eye[0] + (f.target[0] - f.eye[0]) * u - f.pod[0],
      z = f.eye[2] + (f.target[2] - f.eye[2]) * u - f.pod[2];
    assert.ok(
      Math.abs(x) < 3 && Math.abs(z) < 6,
      "flight camera intersects the closed roof",
    );
    assert.equal(f.hatchOpen, 1);
  }
});

test("launch and touchdown pulses land on measured song onsets", () => {
  const launch = api.hcsVictoryCinematic(5.3),
    landing = api.hcsVictoryCinematic(api.HCS_VICTORY_TOUCHDOWN);
  assert.ok(launch.beat > 0.99);
  assert.ok(landing.beat > 0.99);
  assert.equal(launch.stage, "launch");
  assert.equal(landing.stage, "opening");
  assert.ok(
    api.HCS_VICTORY_MUSIC.beats.includes(
      api.HCS_VICTORY_MUSIC.offset +
        api.HCS_VICTORY_TOUCHDOWN -
        api.HCS_VICTORY_MUSIC.start,
    ),
  );
});
