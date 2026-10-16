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
test("the HCS winner raises on Big and lands the full salute on stepper", () => {
  const big = atMusic(DEPLOYMENT_CUES.bigStart),
    middle = atMusic((DEPLOYMENT_CUES.bigStart + DEPLOYMENT_CUES.stepperStart) / 2),
    stepper = atMusic(DEPLOYMENT_CUES.stepperStart);
  assert.equal(big.scene, "ship");
  assert.ok(big.salute < 0.01, "the hand starts rising on Big, rather than already being held");
  assert.ok(middle.salute > 0.3 && middle.salute < 0.7);
  assert.ok(stepper.salute > 0.999, "the hand reaches the forehead on stepper");
  assert.equal(stepper.moveSpeed, 0);
  assert.equal(stepper.animationState, "idle");
  assert.ok(stepper.actorVisible > 0.999);
  assert.ok(stepper.actor[1] >= 240);
  assert.equal(stepper.showResults, false);
  assert.deepEqual(stepper.actor, big.actor);
  assert.ok(atMusic(DEPLOYMENT_CUES.stepperStart + 0.4).salute > 0.999);
});
test("HCS preserves the existing excerpt, dock, walkout and championship deadlines", () => {
  assert.equal(HCS_VICTORY_MUSIC.start, 6.5);
  assert.ok(Math.abs(HCS_VICTORY_MUSIC.offset - 18.98) < 1e-8);
  assert.ok(Math.abs(HCS_VICTORY_DOCK - 10.95) < 1e-8);
  assert.ok(Math.abs(HCS_VICTORY_DURATION - 14.05) < 1e-8);
  assert.equal(hcsVictoryCinematic(HCS_VICTORY_DOCK).stage, "opening");
  assert.ok(hcsVictoryCinematic(HCS_VICTORY_DURATION).salute > 0.999);
});
test("the hero camera tightens on the same stepper cue and then settles", () => {
  const before = atMusic(DEPLOYMENT_CUES.bigStart - 0.001),
    word = atMusic(DEPLOYMENT_CUES.stepperStart),
    end = atMusic(DEPLOYMENT_CUES.stepperStart + 0.7),
    distance = f => Math.hypot(...f.eye.map((v, i) => v - f.target[i]));
  assert.equal(before.salutePunch, 0, "the camera must not peak before the lyric");
  assert.ok(word.salutePunch > 0.99);
  assert.equal(end.salutePunch, 0);
  assert.ok(word.fov < before.fov - 3 * Math.PI / 180, "the beat tightens the lens instead of widening it");
  assert.ok(distance(word) < distance(before) - 0.15, "a short dolly moves toward the champion");
  assert.ok(Math.abs(end.fov - before.fov) < 0.001);
});
test("salute camera recoil stays small, continuous and deterministic when frames arrive late", () => {
  const word = atMusic(DEPLOYMENT_CUES.stepperStart),
    after = atMusic(DEPLOYMENT_CUES.stepperStart + 0.045);
  assert.ok(Math.hypot(...after.eye.map((v, i) => v - word.eye[i])) > 0.005);
  let previous = atMusic(DEPLOYMENT_CUES.bigStart - 0.05);
  for(let t=DEPLOYMENT_CUES.bigStart - 0.05; t<DEPLOYMENT_CUES.stepperStart + 0.8; t+=1/120){
    const next=atMusic(t);
    assert.ok(Math.hypot(...next.eye.map((v,i)=>v-previous.eye[i])) < 0.06);
    assert.ok(Math.abs(next.fov-previous.fov) < Math.PI/180);
    previous=next;
  }
  atMusic(29);
  assert.deepEqual(atMusic(DEPLOYMENT_CUES.stepperStart + 0.045),after);
});
