import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import { Referee } from "../server/hcs-referee.mjs";
const ref = await Referee.create(["a", "b", "c", "d", "e"]);
ref.match.phase = "playing";
for (const p of ref.match.players) {
  p.p = [p.destination.x, p.destination.y, p.destination.z];
  p.air = "landed";
  p.deploymentState = "match_active";
  p.slot = 1;
  p.weapon = "ar";
  p.equip = 0;
}
const samples = [];
for (let i = 0; i < 600; i++) {
  for (const [index, p] of ref.match.players.entries())
    ref.input(p.id, {
      x: Math.sin(i / 20),
      z: Math.cos(i / 20),
      yaw: index,
      pitch: 0,
      slot: 1,
      fire: true,
      reload: i % 50 === 0,
      sprint: true,
    });
  const start = performance.now();
  ref.tick(1 / 30, (i * 1000) / 30);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const result = {
  players: 5,
  simulationHz: 30,
  ticks: 600,
  p50Ms: samples[300],
  p95Ms: samples[570],
  maxMs: samples.at(-1),
  bufferFrames: ref.feed.frames.length,
  note: "Local referee simulation only; client GPU and internet latency are separate.",
};
await mkdir("/workspace/fortmulti-artifacts/hcs", { recursive: true });
await writeFile(
  "/workspace/fortmulti-artifacts/hcs/performance.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
