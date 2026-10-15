import test from "node:test";
import assert from "node:assert/strict";
import { createHCSServer } from "../server/hcs-server.mjs";
import { Referee } from "../server/hcs-referee.mjs";
import { SocialDirectory } from "../public/network.js";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check) {
  const end = Date.now() + 3000;
  while (!check()) {
    assert.ok(Date.now() < end, "timed out waiting for backend");
    await wait(10);
  }
}

test("database failure backs off independently of 30 Hz physics and eventually saves the latest profile", async () => {
  let clock = 10000,
    writes = 0,
    unavailable = true;
  const persisted = [];
  const service = await createHCSServer({
    authenticate: async () => ({ id: "operator" }),
    load: async () => null,
    now: () => clock,
    save: async (state) => {
      writes++;
      if (unavailable) throw Error("temporary outage");
      persisted.push(state.players.operator.name);
    },
  });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  const profile = (name) =>
    fetch(`http://127.0.0.1:${service.server.address().port}/profile`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  try {
    await profile("Alpha");
    await until(() => writes > 0);
    await wait(180);
    assert.equal(
      writes,
      1,
      "an unavailable database must not be retried every simulation tick",
    );
    clock += 1000;
    await until(() => writes === 2);
    await profile("Bravo");
    clock += 1000;
    await wait(100);
    assert.equal(writes, 2, "a second failure must increase the retry delay");
    unavailable = false;
    clock += 1000;
    await until(() => persisted.length === 1);
    assert.equal(persisted[0], "Bravo");
  } finally {
    unavailable = false;
    await service.close();
  }
});

test("HCS retains broadcast-rate replay frames while physics still runs at 30 Hz", async () => {
  const ref = await Referee.create(["a", "b", "c"]);
  for (let i = 0; i < 600; i++) ref.tick(1 / 30, (i * 1000) / 30);
  assert.ok(
    ref.feed.frames.length <= 205,
    `expected about 200 broadcast frames, got ${ref.feed.frames.length}`,
  );
  assert.ok(
    ref.feed.frames.length >= 195,
    "the feed must retain a continuous broadcast",
  );
  assert.ok(
    ref.match.deployment.elapsed > 17,
    "twenty seconds of simulation must include boarding and over seventeen seconds of deployment",
  );
  const stored = ref.feed.frames[0];
  assert.equal(ref.feed.at(stored.at + 19999), null);
  assert.deepEqual(ref.feed.at(stored.at + 20000), stored.data);
});

test("phase changes reach the delayed feed immediately without leaking the winner early", async () => {
  const ref = await Referee.create(["a", "b", "c"]);
  ref.tick(1 / 30, 1000);
  ref.match.phase = "done";
  ref.match.winner = 0;
  const state = ref.tick(1 / 30, 1033);
  assert.equal(state.phase, "done");
  assert.equal(ref.feed.at(21032).phase, "deployment");
  assert.equal(ref.feed.at(21033).phase, "done");
});

test("unchanged online presence shares pending writes and keeps a safe heartbeat while changes publish immediately", async (t) => {
  let clock = 1000;
  t.mock.method(Date, "now", () => clock);
  const directory = new SocialDirectory();
  let writes = 0,
    release;
  directory.api = async () => {
    writes++;
    if (writes === 1) await new Promise((r) => (release = r));
    return { ok: true };
  };
  const args = ["Operator", "408faf", "online", null],
    first = directory.presence(...args),
    second = directory.presence(...args);
  await Promise.resolve();
  assert.equal(writes, 1, "identical in-flight presence must share its write");
  release();
  await Promise.all([first, second]);
  clock += 14000;
  await directory.presence(...args);
  assert.equal(writes, 1);
  clock += 1000;
  await directory.presence(...args);
  assert.equal(
    writes,
    2,
    "heartbeat must refresh before the 45-second presence expiry",
  );
  await directory.presence("Operator", "408faf", "match", null);
  assert.equal(writes, 3, "activity changes must publish immediately");
  directory.api = async () => {
    writes++;
    throw Error("offline");
  };
  clock += 15000;
  await assert.rejects(directory.presence(...args), /offline/);
  directory.api = async () => {
    writes++;
    return { ok: true };
  };
  await directory.presence(...args);
  assert.equal(writes, 5, "a failed presence write must remain retriable");
});

test("the delayed broadcast remains bounded by time even when no spectator consumes it", async () => {
  const { DelayedFeed } = await import("../public/hcs-championship.js");
  const feed = new DelayedFeed();
  for (let at = 0; at <= 60000; at += 100) feed.push(at, { at });
  assert.ok(
    feed.frames.length <= 215,
    `only the delay window and a small margin should remain, got ${feed.frames.length}`,
  );
  assert.equal(
    feed.at(60000).at,
    40000,
    "bounded storage must still serve the complete twenty-second delay",
  );
});
