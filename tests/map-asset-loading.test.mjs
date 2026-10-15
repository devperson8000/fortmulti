import test from "node:test";
import assert from "node:assert/strict";
import { retryMapAsset, fetchMapAsset } from "../public/map-asset-loading.js";
test("transient map asset failures retry with a bound and then recover", async () => {
  let calls = 0;
  assert.equal(
    await retryMapAsset(
      async () => {
        if (++calls < 3) throw Error("offline");
        return "map";
      },
      { delayMs: 0 },
    ),
    "map",
  );
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(
    retryMapAsset(
      () => {
        calls++;
        throw Error("offline");
      },
      { delayMs: 0 },
    ),
    /offline/,
  );
  assert.equal(calls, 3);
});
test("map fetch retries transient HTTP and corrupt downloads without caching failures", async () => {
  let calls = 0;
  const value = await fetchMapAsset("/map", (r) => r.json(), {
    delayMs: 0,
    fetchImpl: async () =>
      ++calls === 1
        ? new Response("", { status: 503 })
        : calls === 2
          ? new Response("{")
          : new Response('{"ok":true}'),
  });
  assert.deepEqual(value, { ok: true });
  assert.equal(calls, 3);
});
test("missing map assets fail once with the resource and status", async () => {
  let calls = 0;
  await assert.rejects(
    fetchMapAsset("/missing-map", (r) => r.text(), {
      delayMs: 0,
      fetchImpl: async () => {
        calls++;
        return new Response("", { status: 404 });
      },
    }),
    /missing-map.*404/,
  );
  assert.equal(calls, 1);
});
test("network rejection and timeout are retryable but a successful decode runs once", async () => {
  let calls = 0,
    decodes = 0;
  assert.equal(
    await fetchMapAsset(
      "/map",
      (r) => {
        decodes++;
        return r.text();
      },
      {
        delayMs: 0,
        fetchImpl: async () => {
          if (++calls === 1) throw new TypeError("fetch failed");
          if (calls === 2) throw new DOMException("timeout", "TimeoutError");
          return new Response("ok");
        },
      },
    ),
    "ok",
  );
  assert.equal(calls, 3);
  assert.equal(decodes, 1);
});

test("stalled texture downloads retry and dispose abandoned late textures", async () => {
  const { loadMapTexture } = await import("../public/map-asset-loading.js");
  let calls = 0,
    release,
    disposed = 0;
  const texture = { dispose: () => disposed++ },
    loader = {
      loadAsync: () =>
        ++calls === 1
          ? new Promise((r) => (release = r))
          : Promise.resolve(texture),
    };
  assert.equal(
    await loadMapTexture(loader, "/texture", { timeoutMs: 5, delayMs: 0 }),
    texture,
  );
  assert.equal(calls, 2);
  release(texture);
  await Promise.resolve();
  assert.equal(disposed, 1);
});
test("a completely stalled texture fails after bounded attempts", async () => {
  const { loadMapTexture } = await import("../public/map-asset-loading.js");
  let calls = 0;
  await assert.rejects(
    loadMapTexture(
      {
        loadAsync: () => {
          calls++;
          return new Promise(() => {});
        },
      },
      "/missing-texture",
      { timeoutMs: 5, delayMs: 0 },
    ),
    /missing-texture.*timed out/,
  );
  assert.equal(calls, 3);
});

test("a stalled collision module is bounded even though imports cannot be aborted", async () => {
  let calls = 0;
  await assert.rejects(
    retryMapAsset(
      () => {
        calls++;
        return new Promise(() => {});
      },
      { timeoutMs: 5, delayMs: 0 },
    ),
    /timed out/,
  );
  assert.equal(calls, 3);
});

test("texture loading honors its configured deadline without a competing earlier timeout", async (t) => {
  const { loadMapTexture } = await import("../public/map-asset-loading.js");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve;
  const texture = {
    dispose() {
      throw Error("successful texture must not be disposed");
    },
  };
  const pending = loadMapTexture(
    { loadAsync: () => new Promise((r) => (resolve = r)) },
    "/slow-texture",
    { timeoutMs: 20000, attempts: 1 },
  );
  await Promise.resolve();
  t.mock.timers.tick(16000);
  resolve(texture);
  assert.equal(await pending, texture);
});

test('successful map downloads use HTTP cache, while retrying a corrupt cached asset forces refresh',async()=>{
 const policies=[];
 const data=await fetchMapAsset('/map',r=>r.json(),{delayMs:0,fetchImpl:async(url,options)=>{policies.push(options.cache);return new Response(policies.length===1?'broken':'{"ok":true}');}});
 assert.deepEqual(data,{ok:true});assert.deepEqual(policies,['default','reload']);
});
