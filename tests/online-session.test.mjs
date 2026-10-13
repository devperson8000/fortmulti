import test from "node:test";
import assert from "node:assert/strict";
import { SocialDirectory } from "../public/network.js";
import "../public/connection-stability.js";
const config = {
  url: "https://session-test.supabase.co",
  key: "fixture-public",
};
async function fixture(saved, fetcher, run) {
  const originalFetch = globalThis.fetch,
    storage = globalThis.sessionStorage;
  const data = new Map([["sunny-auth-v3", JSON.stringify(saved)]]);
  globalThis.sessionStorage = {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  globalThis.fetch = fetcher;
  try {
    await run(data);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.sessionStorage = storage;
  }
}
test("a temporary refresh outage preserves identity instead of creating a new anonymous account", async () => {
  const saved = {
    user: { id: "existing" },
    access_token: "expired",
    refresh_token: "retain-me",
    expires_at: 1,
  };
  let signups = 0;
  await fixture(
    saved,
    async (url) => {
      if (url.includes("/signup")) {
        signups++;
        return Response.json({
          user: { id: "replacement" },
          access_token: "new",
          refresh_token: "new",
          expires_at: 9999999999,
        });
      }
      return Response.json({ message: "Temporary outage" }, { status: 503 });
    },
    async (data) => {
      const social = new SocialDirectory();
      try {
        await assert.rejects(social.open(config), /Temporary outage/);
        assert.equal(signups, 0);
        assert.equal(
          JSON.parse(data.get("sunny-auth-v3")).refresh_token,
          "retain-me",
        );
      } finally {
        social.close();
      }
    },
  );
});
test("database errors retain safe status and code for lobby diagnosis", async () =>
  fixture(
    null,
    async () =>
      Response.json(
        { code: "PGRST202", message: "function missing" },
        { status: 404 },
      ),
    async () => {
      const social = new SocialDirectory();
      social.configure(config);
      social.session = { access_token: "token" };
      await assert.rejects(
        social.api("/rest/v1/rpc/duel_room", {}),
        (error) =>
          error.status === 404 &&
          error.code === "PGRST202" &&
          error.source === "supabase",
      );
    },
  ));
test("a permanently revoked refresh token can create a fresh anonymous session", async () => {
  let signups = 0;
  await fixture(
    {
      user: { id: "old" },
      access_token: "old",
      refresh_token: "revoked",
      expires_at: 1,
    },
    async (url) => {
      if (url.includes("/signup")) {
        signups++;
        return Response.json({
          user: { id: "fresh" },
          access_token: "fresh",
          refresh_token: "fresh",
          expires_at: 9999999999,
        });
      }
      return Response.json(
        {
          code: "refresh_token_not_found",
          message: "Invalid Refresh Token: Refresh Token Not Found",
        },
        { status: 400 },
      );
    },
    async () => {
      const social = new SocialDirectory();
      try {
        await social.open(config);
        assert.equal(social.id, "fresh");
        assert.equal(signups, 1);
      } finally {
        social.close();
      }
    },
  );
});
