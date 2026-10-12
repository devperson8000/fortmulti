import {
  DEPLOYMENT_SHIP,
  SHIP_PODS,
  podBoardingPose,
  podBoardingAvatarOpacity,
} from "./deployment-ship.js";
import { DEPLOYMENT_CUES } from "./deployment-cues.js";
import { podExitPosition } from "./deployment-cinematic.js";
export const HCS_VICTORY_DURATION = 11.2;
// Onsets measured from the supplied, unchanged deployment-intro.mp3 bass band.
export const HCS_VICTORY_MUSIC = Object.freeze({
  start: 0.85,
  offset: DEPLOYMENT_CUES.impact - (5.3 - 0.85),
  end: 30,
  fade: 0.5,
  beats: [25.285, 26.415, 26.789, 27.956, 29.124, 29.578],
});
export const HCS_VICTORY_TOUCHDOWN = 5.3 + 27.956 - DEPLOYMENT_CUES.impact;
const OPEN_END = HCS_VICTORY_TOUCHDOWN + 0.615,
  SALUTE_AT = OPEN_END + 1.0;
const clamp = (t) => Math.max(0, Math.min(1, Number(t) || 0)),
  ease = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  },
  mix = (a, b, t) => a + (b - a) * t;
const origin = DEPLOYMENT_SHIP.origin,
  pod = SHIP_PODS[0],
  base = [origin[0] + pod.x, origin[1], origin[2] + pod.z];
export function hcsVictoryCinematic(seconds = 0) {
  const t = Math.max(0, Number(seconds) || 0),
    position = base.slice(),
    start = [pod.x, 0, pod.z + 4.4];
  let stage = "fade_out",
    fade = ease(t / 0.45),
    doorOpen = 1,
    hatchOpen = 0,
    boost = 0,
    actor = base.map((v, i) => v + (i === 2 ? 4.4 : 0)),
    actorVisible = 1,
    yaw = 0,
    salute = 0,
    moveSpeed = 0,
    animationState = "idle";
  if (t >= 0.45) {
    stage = "black";
    fade = 1;
  }
  if (t >= 0.85) {
    stage = "reveal";
    fade = 1 - ease((t - 0.85) / 0.8);
  }
  if (t >= 2.4) {
    stage = "boarding";
    const q = clamp((t - 2.4) / 2.4),
      pose = podBoardingPose(pod, start, q);
    actor = pose.position.map((v, i) => v + origin[i]);
    yaw = pose.yaw;
    doorOpen = pose.doorOpen;
    actorVisible = podBoardingAvatarOpacity(pose);
    moveSpeed = pose.moveSpeed;
    animationState = pose.animationState;
  }
  if (t >= 4.8) {
    stage = "sealed";
    doorOpen = 0;
    actorVisible = 0;
    moveSpeed = 0;
    hatchOpen = ease((t - 4.8) / 0.5);
  }
  if (t >= 5.3) {
    stage = "launch";
    const q = clamp((t - 5.3) / 0.9);
    position[1] += 36 * q * q;
    boost = Math.sin(Math.PI * clamp(q * 2)) * 0.6 + 0.4;
  }
  if (t >= 6.2) {
    stage = "apex";
    position[1] = base[1] + 36;
    boost = 0;
  }
  if (t >= 6.45) {
    stage = "return";
    position[1] =
      base[1] + 36 * (1 - ease((t - 6.45) / (HCS_VICTORY_TOUCHDOWN - 6.45)));
    boost = 0.4 * clamp((t - HCS_VICTORY_TOUCHDOWN + 0.4) / 0.4);
  }
  if (t >= HCS_VICTORY_TOUCHDOWN) {
    stage = "opening";
    position[1] = base[1];
    boost = 0;
    doorOpen = ease((t - HCS_VICTORY_TOUCHDOWN) / 0.615);
    hatchOpen = 1 - ease((t - HCS_VICTORY_TOUCHDOWN) / 0.4);
  }
  if (t >= OPEN_END) {
    stage = "exit";
    const q = clamp(t - OPEN_END);
    actor = podExitPosition(
      { x: base[0], y: base[1], z: base[2] },
      0,
      1,
      q,
      () => base[1],
    );
    yaw = Math.PI;
    actorVisible = ease(q / 0.15);
    moveSpeed = 6 * q * (1 - q) * 2.35;
    animationState = "pod-exit";
  }
  if (t >= SALUTE_AT) {
    stage = "salute";
    salute = ease((t - SALUTE_AT) / 0.35);
    moveSpeed = 0;
    animationState = "idle";
  }
  const musicTime = HCS_VICTORY_MUSIC.offset + t - HCS_VICTORY_MUSIC.start;
  let beat = 0;
  for (const hit of HCS_VICTORY_MUSIC.beats) {
    const age = musicTime - hit;
    if (age >= 0 && age < 0.3) beat = Math.max(beat, Math.exp(-age * 18));
  }
  const launchKick = t >= 5.3 ? Math.exp(-(t - 5.3) * 12) : 0,
    landingKick =
      t >= HCS_VICTORY_TOUCHDOWN
        ? Math.exp(-(t - HCS_VICTORY_TOUCHDOWN) * 12)
        : 0;
  const zoom = ease((t - 1.4) / 2.4),
    front = ease(
      (t - HCS_VICTORY_TOUCHDOWN) / (SALUTE_AT - HCS_VICTORY_TOUCHDOWN),
    ),
    launchLook =
      ease((t - 5.3) / 0.3) *
      (1 - ease((t - HCS_VICTORY_TOUCHDOWN + 0.3) / 0.3));
  const backEye = [
      base[0] - 3.2 + zoom * 0.6,
      base[1] + 2.3,
      base[2] + 8 - zoom * 1.3,
    ],
    frontEye = [actor[0] + 0.8, base[1] + 1.45, base[2] + 6.7],
    eye = backEye.map((v, i) => mix(v, frontEye[i], front)),
    target = [
      mix(base[0], actor[0] - 0.8, front),
      mix(base[1] + 1.8, actor[1] + 1.03, front) +
        launchLook * (position[1] - base[1]),
      mix(base[2] + 0.2, actor[2], front),
    ];
  // Track the booster upward through the open hatch so the capsule stays
  // readable in frame instead of becoming a distant dot above the ceiling.
  eye[0] = mix(eye[0], base[0] - 2.4, launchLook);
  eye[2] = mix(eye[2], base[2] + 5.2, launchLook);
  eye[1] += launchLook * (position[1] - base[1]) * 0.7;
  eye[1] -= 0.07 * launchKick + 0.1 * landingKick;
  return {
    time: Math.min(t, HCS_VICTORY_DURATION),
    scene: t < 0.45 ? "match" : "bay",
    stage,
    fade,
    doorOpen,
    hatchOpen,
    boost,
    beat,
    pod: position,
    actor,
    actorVisible,
    yaw,
    salute,
    moveSpeed,
    animationState,
    eye,
    target,
    fov:
      mix(62, 54, zoom) * (Math.PI / 180) + 0.025 * (launchKick + landingKick),
    showResults: t >= HCS_VICTORY_DURATION,
  };
}
