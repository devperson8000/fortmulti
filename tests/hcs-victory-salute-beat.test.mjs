import test from "node:test";
import assert from "node:assert/strict";
import {
  hcsVictoryCinematic,
  HCS_VICTORY_MUSIC,
  HCS_VICTORY_DOCK,
  HCS_VICTORY_DURATION,
} from "../public/hcs-victory-cinematic.js";
import {
  DEPLOYMENT_CUES,
  MUSIC_START,
  DEPLOYMENT_MUSIC_END,
  deploymentCinematic,
  cinematicPodPosition,
} from "../public/deployment-cinematic.js";
const atMusic = (s) =>
  hcsVictoryCinematic(HCS_VICTORY_MUSIC.start + s - HCS_VICTORY_MUSIC.offset);

test("the original start-game pod still lands on its bass cue and keeps its original release timing", () => {
  const hit = deploymentCinematic(MUSIC_START + DEPLOYMENT_CUES.impact);
  assert.equal(hit.impact, 1);
  assert.equal(hit.hatchOpen, 0);
  assert.equal(hit.saluteFraming, 0);
  assert.ok(
    cinematicPodPosition(
      { x: 0, y: 0, z: 0 },
      MUSIC_START + DEPLOYMENT_CUES.impact - 0.5,
    )[1] > 0,
  );
  assert.equal(DEPLOYMENT_MUSIC_END, 29.835);
});
test("the HCS winner is planted on the spaceship and fully saluting on Big stepper", () => {
  const full = atMusic(DEPLOYMENT_CUES.bigStart),
    stepper = atMusic(DEPLOYMENT_CUES.stepperStart);
  assert.equal(full.scene, "ship");
  assert.equal(full.stage, "salute");
  assert.ok(full.salute > 0.999);
  assert.equal(full.moveSpeed, 0);
  assert.equal(full.animationState, "idle");
  assert.ok(full.actorVisible > 0.999);
  assert.ok(full.actor[1] >= 240);
  assert.ok(stepper.salute > 0.999);
  assert.equal(stepper.showResults, false);
  assert.deepEqual(stepper.actor, full.actor);
});
test("HCS keeps the existing pod return pace and raises the whole hand in 200 ms", () => {
  assert.equal(HCS_VICTORY_MUSIC.start, 6.5);
  assert.ok(Math.abs(HCS_VICTORY_DOCK - 10.95) < 1e-8);
  assert.ok(Math.abs(HCS_VICTORY_DURATION - 14.05) < 1e-8);
  assert.equal(hcsVictoryCinematic(HCS_VICTORY_DOCK).stage, "opening");
  assert.ok(atMusic(DEPLOYMENT_CUES.bigStart - 0.18).salute < 0.2);
  assert.ok(atMusic(DEPLOYMENT_CUES.bigStart - 0.08).salute > 0.5);
  assert.ok(hcsVictoryCinematic(HCS_VICTORY_DURATION).salute > 0.999);
});
test("the HCS hero camera punches on the bass hit and holds through the stepper lyric", () => {
  const before = atMusic(DEPLOYMENT_CUES.impact - 0.001),
    hit = atMusic(DEPLOYMENT_CUES.impact + 0.05),
    word = atMusic(DEPLOYMENT_CUES.stepperStart),
    end = atMusic(DEPLOYMENT_CUES.stepperStart + 0.4);
  assert.equal(before.salutePunch, 0);
  assert.ok(hit.salutePunch > 0.99);
  assert.ok(word.salutePunch > 0.99);
  assert.equal(end.salutePunch, 0);
  assert.ok(Math.hypot(...hit.eye.map((v, i) => v - before.eye[i])) > 0.15);
  assert.ok(Math.hypot(...hit.eye.map((v, i) => v - before.eye[i])) < 0.7);
  assert.ok(hit.fov > before.fov);
});
