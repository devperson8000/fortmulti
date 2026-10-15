import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const until = async (fn) => {
  const end = Date.now() + 10000;
  while (!fn()) {
    assert.ok(Date.now() < end, "competitor snapshot timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};
for (const count of [2, 8])
  for (const map of ["facility", "island"])
    for (const mode of ["build", "town"])
      test(`${count} normal competitors share authoritative frames on ${map} in ${mode}`, async () => {
        const ids = Array.from({ length: count }, (_, i) => "operator" + i),
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
              requestId: `start-${count}-${map}-${mode}`,
              room: map,
              map,
              mode,
            }),
          });
          assert.equal(response.status, 200);
          const created = await response.json();
          const retry = await fetch(base + "/party-start", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + ids[0],
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requestId: `start-${count}-${map}-${mode}`,
              room: map,
              map,
              mode,
            }),
          });
          assert.equal(
            retry.status,
            200,
            "retrying the same creation after a lost response must reuse the match",
          );
          assert.equal((await retry.json()).id, created.id);
          for (const change of [
            { mode: mode === "town" ? "build" : "town" },
            { map: map === "facility" ? "island" : "facility" },
            { requestId: "a-different-start" },
          ]) {
            const conflict = await fetch(base + "/party-start", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + ids[0],
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                requestId: `start-${count}-${map}-${mode}`,
                room: map,
                map,
                mode,
                ...change,
              }),
            });
            assert.equal(
              conflict.status,
              409,
              "changed match settings or a new start must not adopt an existing match",
            );
            assert.equal((await conflict.json()).code, "PARTY_IN_MATCH");
          }
          const snapshots = (c) =>
            c.messages.filter(
              (m) =>
                m.type === "snapshot" &&
                m.mapId === map &&
                m.tournament === false,
            );
          await until(() => clients.every((c) => snapshots(c).length >= 10));
          const common = snapshots(clients[0])
            .map((m) => m.frame)
            .filter((frame) =>
              clients.every((c) => snapshots(c).some((m) => m.frame === frame)),
            );
          assert.ok(
            common.length >= 8,
            "all recipients must share the same simulation-frame identifiers",
          );
          for (const c of clients) {
            const state = snapshots(c).at(-1).state;
            assert.equal(state.players.length, count);
            assert.equal(state.mode, mode);
            assert.ok(state.players.every((p) => p.hp === 100));
            assert.equal(c.ws.readyState, WebSocket.OPEN);
          }
        } finally {
          for (const c of clients) c.ws.terminate();
          await server.close();
        }
      });
