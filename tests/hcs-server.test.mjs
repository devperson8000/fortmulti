import test from "node:test";
import assert from "node:assert/strict";
const api = await import("../server/hcs-server.mjs").catch(() => ({}));
test("public HCS endpoint exposes schedule but refuses unauthenticated check-in and forged match results", async () => {
  assert.equal(typeof api.createHCSServer, "function");
  const instance = await api.createHCSServer({
    authenticate: async () => null,
    load: async () => null,
    save: async () => {},
    origins: ["http://localhost"],
  });
  await new Promise((r) => instance.server.listen(0, "127.0.0.1", r));
  try {
    const url = `http://127.0.0.1:${instance.server.address().port}`;
    assert.equal((await fetch(url + "/state")).status, 200);
    assert.equal(
      (await fetch(url + "/checkin", { method: "POST" })).status,
      401,
    );
    assert.equal(
      (await fetch(url + "/result", { method: "POST" })).status,
      404,
    );
  } finally {
    await instance.close();
  }
});
test("qualifying match creation requires verified room ownership and connected roster", async () => {
  assert.equal(typeof api.createHCSServer, "function");
  const instance = await api.createHCSServer({
    authenticate: async () => ({ id: "a" }),
    authorizeParty: async () => null,
    load: async () => null,
    save: async () => {},
    origins: [],
  });
  await new Promise((r) => instance.server.listen(0, "127.0.0.1", r));
  try {
    const response = await fetch(
      `http://127.0.0.1:${instance.server.address().port}/party-start`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room: "forged", map: "facility", mode: "town" }),
      },
    );
    assert.equal(response.status, 403);
  } finally {
    await instance.close();
  }
});
test("check-in requires an authenticated competitor connection", async () => {
  const instance = await api.createHCSServer({
    authenticate: async () => ({ id: "a" }),
    load: async () => null,
    save: async () => {},
    origins: [],
  });
  await new Promise((r) => instance.server.listen(0, "127.0.0.1", r));
  try {
    instance.championship.state.phase = "checkin";
    instance.championship.state.at = Date.now() + 1000;
    instance.championship.state.ranks = [{ id: "a" }];
    const response = await fetch(
      `http://127.0.0.1:${instance.server.address().port}/checkin`,
      {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: "{}",
      },
    );
    assert.equal(response.status, 409);
  } finally {
    await instance.close();
  }
});

test("shutdown waits for the in-flight save before flushing newer state", async () => {
  let release,
    entered = false,
    closingDone = false;
  const writes = [];
  const instance = await api.createHCSServer({
    authenticate: async () => ({ id: "a" }),
    load: async () => null,
    origins: [],
    save: async (state) => {
      if (!entered) {
        entered = true;
        await new Promise((r) => (release = r));
      }
      writes.push(state.players.a?.name);
    },
  });
  await new Promise((r) => instance.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${instance.server.address().port}`;
  await fetch(base + "/profile", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ name: "Alpha" }),
  });
  while (!entered) await new Promise((r) => setTimeout(r, 10));
  await fetch(base + "/profile", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ name: "Bravo" }),
  });
  const closing = instance.close().then(() => (closingDone = true));
  await new Promise((r) => setTimeout(r, 30));
  const waited = !closingDone;
  release();
  await closing;
  assert.equal(waited, true);
  assert.equal(writes.at(-1), "Bravo");
});
