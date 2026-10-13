import test from "node:test";
import assert from "node:assert/strict";
import { createHCSServer } from "../server/hcs-server.mjs";

async function withServer(options, run) {
  const service = await createHCSServer({
    authenticate: async () => ({ id: "host" }),
    authorizeParty: async () => ["host", "guest"],
    load: async () => null,
    save: async () => {},
    origins: ["https://horizon-fps.vercel.app/"],
    ...options,
  });
  await new Promise((resolve) =>
    service.server.listen(0, "127.0.0.1", resolve),
  );
  try {
    await run(async () =>
      fetch(`http://127.0.0.1:${service.server.address().port}/party-start`, {
        method: "POST",
        headers: {
          Origin: "https://horizon-fps.vercel.app",
          Authorization: "Bearer fixture",
        },
        body: JSON.stringify({ room: "room", map: "facility", mode: "town" }),
      }),
    );
  } finally {
    await service.close();
  }
}

test("new website receives a specific expired-session error instead of generic service failure", async () => {
  await withServer({ authenticate: async () => null }, async (request) => {
    const response = await request();
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://horizon-fps.vercel.app",
    );
    assert.equal((await response.json()).code, "AUTH_REQUIRED");
  });
});
test("a verified party still registering its players is distinguishable from an existing match", async () => {
  await withServer({}, async (request) => {
    const response = await request();
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "PARTY_CONNECTING");
  });
});
test("database authorization failures are reported safely as backend failures", async () => {
  await withServer(
    {
      authorizeParty: async () => {
        throw Error("private database URL and credentials");
      },
    },
    async (request) => {
      const response = await request();
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.code, "PARTY_DATABASE_UNAVAILABLE");
      assert.ok(!JSON.stringify(body).includes("private"));
    },
  );
});
test("room ownership rejection remains forbidden and has a useful code", async () => {
  await withServer({ authorizeParty: async () => null }, async (request) => {
    const response = await request();
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "PARTY_FORBIDDEN");
  });
});
