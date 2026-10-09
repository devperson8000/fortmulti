import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const until = async (fn) => {
  const deadline = Date.now() + 5000;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for referee");
    await new Promise((r) => setTimeout(r, 10));
  }
};
test("five authenticated players and eight isolated spectators receive the correct delayed final", async () => {
  let clock = Date.UTC(2026, 10, 1, 8) - 1000;
  const instance = await createHCSServer({
    authenticate: async (token) => (token ? { id: token } : null),
    load: async () => null,
    save: async () => {},
    origins: ["http://localhost"],
    now: () => clock,
  });
  instance.championship.state.phase = "checkin";
  instance.championship.state.at = clock + 1000;
  const ids = ["a", "b", "c", "d", "e"];
  instance.championship.state.ranks = ids.map((id, i) => ({
    id,
    name: id.toUpperCase(),
    games: 10,
    wins: 5 - i,
    kills: 0,
  }));
  for (const p of instance.championship.state.ranks)
    instance.championship.state.players[p.id] = p;
  instance.championship.state.checked = ids;
  await new Promise((r) => instance.server.listen(0, "127.0.0.1", r));
  const url = `ws://127.0.0.1:${instance.server.address().port}/stream`,
    sockets = [];
  async function connect(id, watch = false) {
    const ws = new WebSocket(url, { origin: "http://localhost" }),
      messages = [];
    ws.on("message", (data) => messages.push(JSON.parse(data)));
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ type: "auth", token: id }));
    await until(() => messages.some((m) => m.type === "authenticated"));
    if (watch) ws.send(JSON.stringify({ type: "watch" }));
    sockets.push(ws);
    return { ws, messages };
  }
  try {
    const players = [];
    for (const id of ids) players.push(await connect(id));
    const viewers = [];
    for (let i = 0; i < 8; i++) viewers.push(await connect("viewer" + i, true));
    await until(() =>
      viewers.every((v) => v.messages.some((m) => m.type === "watching")),
    );
    clock += 1000;
    await until(
      () =>
        instance.referee &&
        players.every((p) => p.messages.some((m) => m.type === "snapshot")),
    );
    assert.equal(instance.referee.match.players.length, 5);
    assert.ok(
      viewers.every((v) => !v.messages.some((m) => m.type === "snapshot")),
    );
    const yaw = instance.referee.match.players[0].input.yaw;
    viewers[0].ws.send(
      JSON.stringify({ type: "input", input: { yaw: 2, fire: true } }),
    );
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(instance.referee.match.players[0].input.yaw, yaw);
    clock += 20000;
    await until(() =>
      viewers.every((v) => v.messages.some((m) => m.type === "snapshot")),
    );
    assert.ok(
      viewers.every((v) =>
        v.messages
          .filter((m) => m.type === "snapshot")
          .every((m) => m.spectator),
      ),
    );
    instance.referee.match.phase = "playing";
    for (const p of instance.referee.match.players.slice(1)) p.hp = 0;
    instance.referee.match.checkRoundEnd();
    await until(() => instance.championship.state.phase === "complete");
    assert.equal(instance.championship.public(clock).champion, null);
    assert.equal(instance.championship.public(clock).phase, "live");
    assert.ok(
      viewers.every((v) =>
        v.messages
          .filter((m) => m.type === "snapshot")
          .every((m) => m.state.phase !== "done"),
      ),
    );
    clock += 20000;
    await until(() =>
      viewers.every((v) =>
        v.messages.some(
          (m) => m.type === "snapshot" && m.state.phase === "done",
        ),
      ),
    );
    assert.equal(instance.championship.public(clock).champion.id, "a");
    assert.equal(
      new Set(
        players[0].messages
          .filter((m) => m.type === "snapshot")
          .map((m) => m.matchId),
      ).size,
      1,
      "a final ID cannot change when the next qualifying season opens",
    );
    clock += 60001;
    await until(() => instance.referee === null);
    assert.ok(viewers[0].messages.some((m) => m.type === "broadcast-ended"));
    assert.equal(
      instance.championship.state.players.a.games,
      0,
      "final does not count as a qualifying game",
    );
  } finally {
    for (const socket of sockets) socket.terminate();
    await instance.close();
  }
});

test("both qualifying modes record only referee-computed completed match stats", async () => {
  const { Match } = await import("../public/simulation.js");
  const original = Match.prototype.beginDeployment;
  let captured;
  Match.prototype.beginDeployment = function (...args) {
    captured = this;
    return original.apply(this, args);
  };
  let time = Date.now();
  const instance = await createHCSServer({
    now: () => time,
    authenticate: async (token) => ({ id: token }),
    authorizeParty: async (id) => (id === "host" ? ["host", "guest"] : null),
    load: async () => null,
    save: async () => {},
    origins: ["http://localhost"],
  });
  await new Promise((r) => instance.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${instance.server.address().port}`,
    sockets = [];
  try {
    for (const id of ["host", "guest"]) {
      instance.championship.register(id, "Operator " + id);
      instance.championship.state.players[id].games = 9;
      const ws = new WebSocket(base.replace("http", "ws") + "/stream", {
        origin: "http://localhost",
      });
      await new Promise((r) => ws.once("open", r));
      const ready = new Promise((r) =>
        ws.on("message", (data) => {
          if (JSON.parse(data).type === "authenticated") r();
        }),
      );
      ws.send(JSON.stringify({ type: "auth", token: id }));
      await ready;
      sockets.push(ws);
    }
    for (const mode of ["build", "town"]) {
      const response = await fetch(base + "/party-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer host",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: mode,
          map: mode === "build" ? "island" : "facility",
          mode,
        }),
      });
      assert.equal(response.status, 200);
      assert.equal(captured.targetScore, 5);
      assert.equal(captured.mode, mode);
      captured.scores = [4, 0];
      captured.phase = "playing";
      captured.players[1].hp = 0;
      captured.event({ type: "elimination", by: "host", hit: "guest" });
      captured.checkRoundEnd();
      await until(
        () =>
          instance.championship.state.players.host.games ===
          (mode === "build" ? 10 : 11),
      );
      if (mode === "build") {
        // Completed match results are removed before starting the next mode.
        time += 10001;
        await new Promise((r) => setTimeout(r, 60));
      }
    }
    assert.equal(instance.championship.state.players.host.wins, 2);
    assert.equal(instance.championship.state.players.host.kills, 2);
    assert.equal(instance.championship.state.players.guest.wins, 0);
    assert.equal(instance.championship.public().ranks[0].id, "host");
  } finally {
    Match.prototype.beginDeployment = original;
    for (const ws of sockets) ws.terminate();
    await instance.close();
  }
});

test("unresponsive sockets are removed by the heartbeat instead of retaining check-in presence", async () => {
  const service = await createHCSServer({
    heartbeatMs: 20,
    authenticate: async () => ({ id: "offline" }),
    load: async () => null,
    save: async () => {},
    origins: ["http://localhost"],
  });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  const ws = new WebSocket(
    `ws://127.0.0.1:${service.server.address().port}/stream`,
    { origin: "http://localhost", autoPong: false },
  );
  try {
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ type: "auth", token: "offline" }));
    await until(() => ws.readyState === WebSocket.CLOSED);
  } finally {
    ws.terminate();
    await service.close();
  }
});

test("final check-in preempts qualifying matches and abandoned rooms can restart", async () => {
  let clock = Date.UTC(2026, 10, 1, 8) - 1000;
  const ids = ["a", "b", "c"];
  const service = await createHCSServer({
    now: () => clock,
    authenticate: async (id) => ({ id }),
    authorizeParty: async () => ["a", "b"],
    load: async () => null,
    save: async () => {},
    origins: ["http://localhost"],
  });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${service.server.address().port}`;
  const sockets = [],
    messages = [];
  async function connect(id) {
    const ws = new WebSocket(base.replace("http", "ws") + "/stream", {
      origin: "http://localhost",
    });
    await new Promise((r) => ws.once("open", r));
    const received = [];
    ws.on("message", (d) => received.push(JSON.parse(d)));
    ws.send(JSON.stringify({ type: "auth", token: id }));
    await until(() => received.some((m) => m.type === "authenticated"));
    sockets.push(ws);
    messages.push(received);
    return ws;
  }
  const start = () =>
    fetch(base + "/party-start", {
      method: "POST",
      headers: {
        Authorization: "Bearer a",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: "room", mode: "town", map: "facility" }),
    });
  try {
    for (const id of ids) {
      service.championship.register(id, "Operator " + id);
      await connect(id);
    }
    assert.equal((await start()).status, 200);
    for (const ws of sockets) ws.terminate();
    await new Promise((r) => setTimeout(r, 80));
    clock += 60001;
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(service.championship.state.players.a.games, 0);
    for (const id of ids) await connect(id);
    assert.equal(
      (await start()).status,
      200,
      "abandoned normal room is released",
    );
    service.championship.state.phase = "checkin";
    service.championship.state.at = clock + 1000;
    service.championship.state.ranks = ids.map((id) => ({
      ...service.championship.state.players[id],
      games: 10,
    }));
    service.championship.state.checked = ids;
    clock += 301001;
    await until(
      () =>
        service.referee &&
        messages
          .slice(-3)
          .every((ms) =>
            ms.some((m) => m.type === "snapshot" && m.tournament !== false),
          ),
    );
    assert.ok(messages.at(-3).some((m) => m.type === "match-cancelled"));
    assert.equal(
      (await start()).status,
      409,
      "live finalists cannot start another match",
    );
    assert.equal(
      service.championship.state.players.a.games,
      0,
      "cancelled matches award no stats",
    );
  } finally {
    for (const ws of sockets) ws.terminate();
    await service.close();
  }
});
