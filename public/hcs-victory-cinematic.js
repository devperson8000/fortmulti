import {
  DEPLOYMENT_SHIP,
  SHIP_PODS,
  podBoardingPose,
  podBoardingAvatarOpacity,
} from "./deployment-ship.js";
import { podExitPosition } from "./deployment-cinematic.js";
import { DEPLOYMENT_CUES } from "./deployment-cues.js";
export const HCS_VICTORY_LANDING = 2.5;
// Preserve the rescue, dock and walkout pace; align the music excerpt to the salute.
export const HCS_VICTORY_DOCK = 10.95;
export const HCS_VICTORY_SALUTE = Object.freeze({
  // Plant the feet after walkout, raise on "Big", hit the forehead on "stepper".
  start: HCS_VICTORY_DOCK + 0.65 + 1.3 + 0.2,
  raise: DEPLOYMENT_CUES.stepperStart - DEPLOYMENT_CUES.bigStart,
});
export const HCS_VICTORY_MUSIC = Object.freeze({
  start: 6.5,
  offset:
    DEPLOYMENT_CUES.bigStart -
    HCS_VICTORY_SALUTE.start +
    6.5,
  end: 30,
  fade: 0.5,
  beats: [25.285, 26.415, 26.789, 27.956, 29.124, 29.578],
});
export const HCS_VICTORY_DURATION = HCS_VICTORY_DOCK + 3.1;
const clamp = (t) => Math.max(0, Math.min(1, Number(t) || 0)),
  ease = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  },
  mix = (a, b, t) => a + (b - a) * t;
const ship = SHIP_PODS[0],
  shipBase = [
    DEPLOYMENT_SHIP.origin[0] + ship.x,
    DEPLOYMENT_SHIP.origin[1],
    DEPLOYMENT_SHIP.origin[2] + ship.z,
  ];
const place = (p, origin, yaw) => [
  origin[0] + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw),
  origin[1] + p[1],
  origin[2] - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw),
];
export function hcsVictoryCinematic(
  seconds = 0,
  { winner = [0, 0, 0], yaw = 0, originalYaw = yaw, landing = null } = {},
) {
  const t = Math.max(0, Number(seconds) || 0),
    ground = landing || place([0, 0, -4.4], winner, yaw),
    musicTime = HCS_VICTORY_MUSIC.offset + t - HCS_VICTORY_MUSIC.start;
  let scene = "match",
    stage = "pickup",
    fade = 0,
    doorOpen = 0,
    hatchOpen = 0,
    boost = 0,
    actor = winner.slice(),
    actorVisible = 1,
    actorYaw =
      originalYaw +
      Math.atan2(Math.sin(yaw - originalYaw), Math.cos(yaw - originalYaw)) *
        ease(t / 0.65),
    salute = 0,
    moveSpeed = 0,
    animationState = "idle";
  let pod = ground.slice();
  pod[1] += 48 * (1 - ease(t / HCS_VICTORY_LANDING));
  boost =
    0.4 *
    ease((t - HCS_VICTORY_LANDING + 0.4) / 0.4) *
    (1 - ease((t - HCS_VICTORY_LANDING) / 0.2));
  if (t >= HCS_VICTORY_LANDING) {
    stage = "landed";
    pod = ground.slice();
    doorOpen = ease((t - 2.8) / 0.6);
  }
  if (t >= 3.4) {
    stage = "boarding";
    const q = clamp((t - 3.4) / 2.4),
      dx = winner[0] - ground[0],
      dz = winner[2] - ground[2],
      local = [
        dx * Math.cos(yaw) - dz * Math.sin(yaw),
        winner[1] - ground[1],
        dx * Math.sin(yaw) + dz * Math.cos(yaw),
      ],
      pose = podBoardingPose(
        { x: 0, z: 0, side: 1, entryOffset: 2.35 },
        local,
        q,
      );
    actor = place(pose.position, ground, yaw);
    actorYaw = yaw + pose.yaw;
    doorOpen = pose.doorOpen;
    actorVisible = podBoardingAvatarOpacity(pose);
    moveSpeed = pose.moveSpeed;
    animationState = pose.animationState;
  }
  if (t >= 5.8) {
    stage = "sealed";
    actorVisible = 0;
    doorOpen = 0;
    moveSpeed = 0;
  }
  if (t >= 6.5) {
    stage = "launch";
    const q = clamp((t - 6.5) / 1.4);
    pod[1] += 65 * q * q;
    boost = 1;
    fade = ease((t - 6.5) / 0.65);
  }
  if (t >= 8.2) {
    scene = "ship";
    stage = "docking";
    const q = clamp((t - 8.2) / (HCS_VICTORY_DOCK - 8.2));
    pod = shipBase.slice();
    pod[1] -= 24 * (1 - ease(q));
    hatchOpen = 1;
    boost = 0.25;
    fade = 1 - ease((t - 8.2) / 0.8);
    actor = shipBase.slice();
    actorYaw = 0;
  }
  if (t >= HCS_VICTORY_DOCK) {
    stage = "opening";
    pod = shipBase.slice();
    boost = 0;
    hatchOpen = 1 - ease((t - HCS_VICTORY_DOCK) / 0.4);
    doorOpen = ease((t - HCS_VICTORY_DOCK) / 0.65);
  }
  const exitAt = HCS_VICTORY_DOCK + 0.65,
    saluteAt = HCS_VICTORY_SALUTE.start;
  if (t >= exitAt) {
    stage = "exit";
    const q = clamp((t - exitAt) / 1.3);
    actor = podExitPosition(
      { x: shipBase[0], y: shipBase[1], z: shipBase[2] },
      0,
      1,
      q,
      () => shipBase[1],
    );
    actorYaw = Math.PI;
    actorVisible = ease(q / 0.12);
    moveSpeed = (6 * q * (1 - q) * 2.35) / 1.3;
    animationState = "pod-exit";
  }
  if (t >= exitAt + 1.3) {
    stage = "salute";
    salute = ease((t - saluteAt) / HCS_VICTORY_SALUTE.raise);
    moveSpeed = 0;
    animationState = "idle";
  }
  let beat = 0;
  if (t >= HCS_VICTORY_MUSIC.start)
    for (const hit of HCS_VICTORY_MUSIC.beats) {
      const age = musicTime - hit;
      if (age >= 0 && age < 0.3) beat = Math.max(beat, Math.exp(-age * 18));
    }
  const salutePunch =
    ease((musicTime - DEPLOYMENT_CUES.bigStart) / HCS_VICTORY_SALUTE.raise) *
    (1 - ease((musicTime - DEPLOYMENT_CUES.stepperStart - 0.16) / 0.42));
  const recoilAge = musicTime - DEPLOYMENT_CUES.stepperStart,
    saluteRecoil = recoilAge >= 0 && recoilAge < 0.32
      ? Math.sin(recoilAge * Math.PI * 2 / 0.16) * Math.exp(-recoilAge * 14) *
        (1 - ease(recoilAge / 0.32))
      : 0;
  const landingAge = t - HCS_VICTORY_LANDING,
    impact = landingAge >= 0 ? Math.exp(-landingAge * 10) : 0,
    dockKick =
      t >= HCS_VICTORY_DOCK ? Math.exp(-(t - HCS_VICTORY_DOCK) * 12) : 0;
  let eye, target;
  if (scene === "match") {
    const zoom = ease(t / 0.8),
      rise = t >= 6.5 ? (pod[1] - ground[1]) * 0.3 : 0;
    eye = place(
      [mix(2.1, 2.8, zoom), 2.25 + rise, mix(5.6, 5.8, zoom)],
      winner,
      yaw,
    );
    const follow = ease((t - 6.5) / 0.2);
    target = [
      ground[0],
      ground[1] +
        1.8 +
        (pod[1] - ground[1]) * Math.max(follow, 0.35 * (1 - ease(t / 2))),
      ground[2],
    ];
    eye[1] -= impact * 0.06;
  } else {
    const front = ease((t - exitAt) / 1.3);
    eye = [
      mix(shipBase[0] + 2.6, actor[0] + 0.85, front),
      shipBase[1] + mix(2.25, 1.55, front) - dockKick * 0.06,
      shipBase[2] + mix(6.4, 4.8, front),
    ];
    target = [
      mix(shipBase[0], actor[0] - 0.6, front),
      mix(shipBase[1] + 1.75, actor[1] + 1.05, front),
      mix(shipBase[2], actor[2], front),
    ];
  }
  if (scene === "ship") {
    // A short dolly and tighter lens meet the hand's hit, followed by a small,
    // deterministic recoil. No random shake or frame-rate-dependent springs.
    for (let i = 0; i < 3; i++) eye[i] -= (eye[i] - target[i]) * salutePunch * 0.09;
    eye[0] += saluteRecoil * 0.012;
    eye[1] += saluteRecoil * 0.035;
  }
  return {
    musicTime,
    salutePunch,
    time: Math.min(t, HCS_VICTORY_DURATION),
    scene,
    stage,
    fade,
    doorOpen,
    hatchOpen,
    boost,
    beat,
    impact,
    landingAge,
    pod,
    podYaw: scene === "match" ? yaw : 0,
    actor,
    actorVisible,
    yaw: actorYaw,
    salute,
    moveSpeed,
    animationState,
    eye,
    target,
    fov:
      ((58 - salutePunch * 4) * Math.PI) / 180 +
      impact * 0.018 +
      dockKick * 0.018,
    showResults: t >= HCS_VICTORY_DURATION,
  };
}
