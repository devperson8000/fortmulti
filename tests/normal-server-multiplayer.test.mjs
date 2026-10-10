import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const until = async (fn) => {
  const end = Date.now() + 10000;
  while (!fn()) {
    assert.ok(Date.now() < end, "eight-player snapshot timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};
for (const map of ["facility", "island"])
  test(`eight normal competitors share authoritative frames on ${map}`, async () => {
    const ids = Array.from({ length: 8 }, (_, i) => "operator" + i),
      clients = [];
    const server = await createHCSServer({
      authenticate: async (id) => ({ id }),
      authorizeParty: async (id) => (id === ids[0] ? ids : null),
      load: async () => null,
      save: async () => {},
      origins: ["http://localhost"],
    });
    await new Promise((r) => server.server.listen(0, "127.0.0.1", r));
    const base = "http://127.0.0.1:" + server.server.address().port;
    try {
      for (const id of ids) {
        server.championship.register(id, "Operator " + id);
        const ws = new WebSocket(base.replace("http", "ws") + "/stream", {
            origin: "http://localhost",
          }),
          messages = [];
        ws.on("message", (raw) => messages.push(JSON.parse(raw)));
        await new Promise((r) => ws.once("open", r));
        ws.send(JSON.stringify({ type: "auth", token: id }));
        clients.push({ ws, messages });
        await until(() => messages.some((m) => m.type === "authenticated"));
      }
      const response = await fetch(base + "/party-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + ids[0],
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: map,
          map,
          mode: map === "facility" ? "town" : "build",
        }),
      });
      assert.equal(response.status, 200);
      const snapshots = (c) =>
        c.messages.filter(
          (m) =>
            m.type === "snapshot" && m.mapId === map && m.tournament === false,
        );
      await until(() => clients.every((c) => snapshots(c).length >= 10));
      const common = snapshots(clients[0])
        .map((m) => m.frame)
        .filter((frame) =>
          clients.every((c) => snapshots(c).some((m) => m.frame === frame)),
        );
      assert.ok(
        common.length >= 8,
        "all eight recipients must share the same simulation-frame identifiers",
      );
      for (const c of clients) {
        const state = snapshots(c).at(-1).state;
        assert.equal(state.players.length, 8);
        assert.ok(state.players.every((p) => p.hp === 100));
        assert.equal(c.ws.readyState, WebSocket.OPEN);
      }
    } finally {
      for (const c of clients) c.ws.terminate();
      await server.close();
    }
  });
