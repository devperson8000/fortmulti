import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const until = async (fn) => {
  const end = Date.now() + 3000;
  while (!fn()) {
    assert.ok(Date.now() < end, "match lifecycle timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
};
async function fixture(run, options = {}) {
  const ids = ["host", "guest", "third", "fourth", "finalist"],
    clients = [];
  const service = await createHCSServer({
    authenticate: async (id) => ({ id }),
    authorizeParty: async (id, room) =>
      id === "host"
        ? ["host", "guest", "third"]
        : id === "guest" && room === "other"
          ? ["guest", "fourth"]
          : null,
    load: async () => null,
    save: async () => {},
    origins: ["http://localhost"],
    ...options,
  });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${service.server.address().port}`;
  const request = async (path, body, id = "host") =>
    fetch(base + path, {
      method: "POST",
      headers: { Authorization: "Bearer " + id },
      body: JSON.stringify(body),
    });
  try {
    for (const id of ids) {
      service.championship.register(id, "Operator " + id);
      const ws = new WebSocket(base.replace("http", "ws") + "/stream", {
          origin: "http://localhost",
        }),
        messages = [];
      ws.on("message", (data) => messages.push(JSON.parse(data)));
      await new Promise((r) => ws.once("open", r));
      ws.send(JSON.stringify({ type: "auth", token: id }));
      await until(() => messages.some((m) => m.type === "authenticated"));
      clients.push({ id, ws, messages });
    }
    await run({ service, clients, request });
  } finally {
    for (const c of clients) c.ws.terminate();
    await service.close();
  }
}
test("only the party leader can cancel a normal match; rematches and stale end requests are safe", async () =>
  fixture(async ({ service, clients, request }) => {
    const started = await request("/party-start", {
      room: "room",
      map: "facility",
      mode: "town",
    });
    assert.equal(started.status, 200);
    const first = await started.json();
    const forbidden = await request(
      "/party-end",
      { room: "room", matchId: first.id },
      "guest",
    );
    assert.equal(forbidden.status, 403);
    const ended = await request("/party-end", {
      room: "room",
      matchId: first.id,
    });
    assert.equal(ended.status, 200);
    await until(() =>
      clients
        .slice(0, 3)
        .every((c) =>
          c.messages.some(
            (m) => m.type === "match-cancelled" && m.matchId === first.id,
          ),
        ),
    );
    assert.equal(
      service.championship.state.players.host.games,
      0,
      "cancelled matches do not award scores",
    );
    const rematch = await request("/party-start", {
      room: "room",
      map: "island",
      mode: "build",
    });
    assert.equal(rematch.status, 200);
    const second = await rematch.json();
    assert.notEqual(second.id, first.id);
    const stale = await request("/party-end", {
      room: "room",
      matchId: first.id,
    });
    assert.equal(stale.status, 409);
    await until(() =>
      clients[0].messages.some(
        (m) => m.type === "snapshot" && m.matchId === second.id,
      ),
    );
    assert.equal(
      (await request("/party-end", { room: "room", matchId: second.id }))
        .status,
      200,
    );
  }));
test("an explicit normal-match forfeit permits another party without reviving the old player", async () =>
  fixture(async ({ service, clients, request }) => {
    const first = await (
      await request("/party-start", {
        room: "room",
        map: "island",
        mode: "town",
      })
    ).json();
    const guest = clients[1];
    guest.ws.send(JSON.stringify({ type: "leave", forfeit: true }));
    await new Promise((r) => setTimeout(r, 50));
    const started = await request(
      "/party-start",
      { room: "other", map: "facility", mode: "build" },
      "guest",
    );
    assert.equal(started.status, 200);
    const second = await started.json();
    await until(() => guest.messages.some((m) => m.matchId === second.id));
    const before = guest.messages.length;
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(
      guest.messages
        .slice(before)
        .every((m) => m.type !== "snapshot" || m.matchId !== first.id),
      "former match must not overwrite a new match",
    );
    assert.equal(service.championship.state.players.guest.games, 0);
  }));

test("the leader explicitly leaving closes the normal match for everyone without scores", async () =>
  fixture(async ({ service, clients, request }) => {
    const first = await (
      await request("/party-start", {
        room: "room",
        map: "facility",
        mode: "build",
      })
    ).json();
    clients[0].ws.send(JSON.stringify({ type: "leave", forfeit: true }));
    await until(() =>
      clients[1].messages.some(
        (m) =>
          m.type === "match-cancelled" &&
          m.matchId === first.id &&
          m.partyClosed === true,
      ),
    );
    const next = await request(
      "/party-start",
      { room: "other", map: "island", mode: "town" },
      "guest",
    );
    assert.equal(next.status, 200);
    assert.equal(service.championship.state.players.guest.games, 0);
  }));

test("a forfeited former player entering HCS does not cancel the remaining normal party", async () => {
  let clock = Date.UTC(2026, 10, 1, 8) - 1000;
  await fixture(
    async ({ service, clients, request }) => {
      const first = await (
        await request("/party-start", {
          room: "room",
          map: "island",
          mode: "town",
        })
      ).json();
      clients[1].ws.send(JSON.stringify({ type: "leave", forfeit: true }));
      await new Promise((r) => setTimeout(r, 50));
      const finalists = ["guest", "fourth", "finalist"];
      service.championship.state.at = clock + 1000;
      service.championship.state.phase = "checkin";
      service.championship.state.ranks = finalists.map((id) => ({
        ...service.championship.state.players[id],
        games: 10,
      }));
      service.championship.state.checked = finalists;
      assert.equal((await request("/checkin", {}, "guest")).status, 200);
      clock += 301001;
      await until(
        () =>
          service.referee &&
          clients[1].messages.some(
            (m) => m.type === "snapshot" && m.tournament !== false,
          ),
      );
      assert.ok(
        !clients[0].messages.some(
          (m) => m.type === "match-cancelled" && m.matchId === first.id,
        ),
        "a departed finalist must not cancel unrelated remaining players",
      );
      const before = clients[0].messages.length;
      await until(() =>
        clients[0].messages
          .slice(before)
          .some((m) => m.type === "snapshot" && m.matchId === first.id),
      );
    },
    { now: () => clock },
  );
});

test("a delayed leave from a forfeited match cannot close the player’s newer game", async () =>
  fixture(async ({ clients, request }) => {
    const first = await (
      await request("/party-start", {
        room: "room",
        map: "island",
        mode: "town",
      })
    ).json();
    const guest = clients[1];
    guest.ws.send(
      JSON.stringify({ type: "leave", forfeit: true, matchId: first.id }),
    );
    await new Promise((r) => setTimeout(r, 50));
    const second = await (
      await request(
        "/party-start",
        { room: "other", map: "facility", mode: "build" },
        "guest",
      )
    ).json();
    await until(() =>
      guest.messages.some(
        (m) => m.type === "snapshot" && m.matchId === second.id,
      ),
    );
    const before = guest.messages.length;
    guest.ws.send(
      JSON.stringify({ type: "leave", forfeit: true, matchId: first.id }),
    );
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(
      !guest.messages
        .slice(before)
        .some((m) => m.type === "match-cancelled" && m.matchId === second.id),
      "a stale leave must not cancel the new party",
    );
    assert.ok(
      guest.messages
        .slice(before)
        .some((m) => m.type === "snapshot" && m.matchId === second.id),
      "new match snapshots continue",
    );
  }));
