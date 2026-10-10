import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const ids = ["alpha", "bravo", "charlie", "delta", "echo"],
  sockets = [],
  received = [];
let offset = 0;
const now = () => Date.now() + offset;
const server = await createHCSServer({
  authenticate: async (id) => ({ id }),
  load: async () => null,
  save: async () => {},
  origins: ["http://localhost"],
  now,
});
server.championship.state.at = now() + 1000;
server.championship.state.phase = "checkin";
server.championship.state.ranks = ids.map((id) => ({
  id,
  name: id,
  games: 10,
  wins: 1,
  kills: 0,
}));
for (const p of server.championship.state.ranks)
  server.championship.state.players[p.id] = p;
server.championship.state.checked = ids;
await new Promise((r) => server.server.listen(0, "127.0.0.1", r));
const url = `ws://127.0.0.1:${server.server.address().port}/stream`;
const until = async (fn) => {
  const end = Date.now() + 15000;
  while (!fn()) {
    if (Date.now() > end) throw Error("Combat review timeout");
    await new Promise((r) => setTimeout(r, 30));
  }
};
try {
  for (const id of [...ids, "viewer"]) {
    const ws = new WebSocket(url, { origin: "http://localhost" }),
      messages = [];
    received.push(messages);
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      messages.push(m);
      if (id === "viewer" && m.type === "authenticated")
        ws.send(JSON.stringify({ type: "watch" }));
    });
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ type: "auth", token: id }));
    sockets.push(ws);
    await until(() => messages.some((m) => m.type === "authenticated"));
  }
  offset += 1000;
  await until(() => server.referee);
  // Controlled supported-floor combat fixture: test referee combat and result publication,
  // separately from the natural pod landings in hcs-review-load.mjs.
  const match = server.referee.match;
  match.phase = "playing";
  for (const [i, p] of match.players.entries()) {
    p.p = [-35, 1.5, 19 + i * 1.3];
    p.air = "landed";
    p.deploymentState = "match_active";
    p.hp = 100;
    p.shield = 0;
    p.slot = 1;
    p.equip = 0;
  }
  const shooter = match.players[1];
  const firing = setInterval(() => {
    const target = match.players.find((p) => p.id !== shooter.id && p.hp > 0);
    if (!target) return;
    const dx = target.p[0] - shooter.p[0],
      dz = target.p[2] - shooter.p[2],
      dy = target.p[1] + 1.1 - (shooter.p[1] + 1.72);
    const yaw = Math.atan2(-dx, -dz),
      pitch = Math.atan2(dy, Math.hypot(dx, dz));
    sockets[1].send(
      JSON.stringify({
        type: "input",
        input: {
          slot: 1,
          yaw,
          pitch,
          aimYaw: yaw,
          aimPitch: pitch,
          fire: true,
          aim: true,
        },
      }),
    );
  }, 33);
  try {
    await until(() => match.phase === "done");
  } finally {
    clearInterval(firing);
  }
  assert.equal(match.players[match.winner].id, "bravo");
  await until(() => server.championship.state.phase === "complete");
  assert.equal(server.championship.public(now()).champion, null);
  const eliminated = match.events.filter((e) => e.type === "elimination");
  assert.equal(eliminated.length, 4);
  offset += 20001;
  await until(() =>
    received
      .at(-1)
      .some((m) => m.type === "snapshot" && m.state.phase === "done"),
  );
  assert.equal(server.championship.public(now()).champion.id, "bravo");
  const results = {
    fixture:
      "Controlled supported-floor positions; actual authenticated WebSocket inputs and native combat, no injected scores or elimination events",
    competitors: 5,
    shots: match.events.filter((e) => e.type === "shot").length,
    eliminations: eliminated,
    champion: server.championship.public(now()).champion,
    delayedFinalReceived: true,
  };
  await writeFile(
    "docs/reviews/hcs-2026-10-10/hcs-combat-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log("HCS combat and delayed champion review passed");
} finally {
  for (const ws of sockets) ws.terminate();
  await server.close();
}
