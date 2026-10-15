import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createHCSServer } from "../server/hcs-server.mjs";

const site = "http://127.0.0.1:4173";
const service = await createHCSServer({
  authenticate: async (token) => (token === "expired" ? null : { id: token }),
  authorizeParty: async () => ["host", "guest"],
  load: async () => null,
  save: async () => {},
  origins: [site],
});
await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${service.server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  starts = [],
  startKeys = [];
const ids = [
  "hcs-countdown",
  "hcs-promo-time",
  "hcs-date",
  "hcs-promo",
  "hcs-empty",
  "hcs-personal",
  "hcs-invite-notice",
  "hcs-checkin",
  "hcs-watch",
  "hcs-champion",
  "hcs-service",
  "hcs-broadcast",
  "hcs-broadcast-label",
  "hcs-watch-stats",
  "hcs-return",
  "lobby",
  "net-ping",
];
async function open(id, holdProfile = false) {
  const page = await browser.newPage();
  await page
    .context()
    .grantPermissions(["local-network-access"], { origin: site });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.route("**/hcs-party-lab", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<body>${ids.map((id) => `<div id="${id}"></div>`).join("")}<table><tbody id="hcs-ranks"></tbody></table><select id="hcs-view-player"></select></body>`,
    }),
  );
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let profileEntered = false;
  await page.route(base + "/profile", async (route) => {
    profileEntered = true;
    if (holdProfile) await held;
    await route.continue();
  });
  page.on("request", (request) => {
    if (request.url() === base + "/party-start") {
      starts.push(id);
      const body = request.postDataJSON();
      if (body.room === "room") startKeys.push(body.requestId);
    }
  });
  await page.goto(site + "/hcs-party-lab");
  await page.evaluate(
    async ({ base, id }) => {
      window.Game = {
        input: () => ({}),
        clear() {},
        apply() {},
        effect() {},
        look() {},
      };
      window.Duel = { lobby: true };
      const { createHCS } = await import("/hcs-client.js");
      window.received = [];
      window.client = createHCS({
        config: { hcsUrl: base },
        session: () => ({ access_token: id }),
        profile: () => ({
          name:
            window.profileName ??
            (id === "invalid-profile" ? "" : "Operator " + id),
        }),
        leaveParty: async () => {},
        returnLobby() {},
        applyOfficial: (data) => window.received.push(data),
      });
    },
    { base, id },
  );
  return { page, release, entered: () => profileEntered };
}
const until = async (fn) => {
  const end = Date.now() + 10000;
  while (!fn()) {
    assert.ok(Date.now() < end, "connection timeout");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
try {
  const host = await open("host", true);
  let lostResponse = false;
  await host.page.route(base + "/party-start", async (route) => {
    const response = await route.fetch();
    if (!lostResponse && response.status() === 200) {
      lostResponse = true;
      await route.abort("failed");
      return;
    }
    await route.fulfill({ response });
  });
  await until(host.entered);
  await host.page.evaluate(() => {
    window.startResult = null;
    window.client.startParty("room", "facility", "town").then(
      (value) => (window.startResult = { value }),
      (error) => (window.startResult = { error: error.message }),
    );
  });
  await host.page.waitForTimeout(8250);
  assert.equal(
    await host.page.evaluate(() => window.startResult),
    null,
    "a cold profile registration must not hit the old eight-second signal deadline",
  );
  assert.equal(
    starts.length,
    0,
    "match POST must wait for the host profile registration",
  );
  host.release();
  await until(() => starts.length > 0);
  const guest = await open("guest", true);
  await until(guest.entered);
  await host.page.waitForTimeout(400);
  assert.equal(
    await host.page.evaluate(() => window.startResult),
    null,
    "connecting guest is retried, not rejected immediately",
  );
  guest.release();
  await host.page.waitForFunction(() => window.startResult !== null);
  assert.deepEqual(await host.page.evaluate(() => window.startResult), {
    value: true,
  });
  for (const client of [host, guest])
    await client.page.waitForFunction(() => window.received.length >= 3);
  const snapshots = await Promise.all(
    [host, guest].map((client) =>
      client.page.evaluate(() => window.received.at(-1)),
    ),
  );
  assert.equal(snapshots[0].id, snapshots[1].id);
  assert.ok(
    snapshots.every(
      (snapshot) =>
        snapshot.state.players.length === 2 && snapshot.mapId === "facility",
    ),
  );
  assert.equal(lostResponse, true);
  assert.ok(startKeys.length >= 2);
  assert.equal(
    new Set(startKeys).size,
    1,
    "the lost creation response must retry using the same idempotency key",
  );
  await host.page.unroute(base + "/party-start");
  const existing = await host.page.evaluate(async () => {
    try {
      await window.client.startParty("room", "facility", "town");
    } catch (error) {
      return error.message;
    }
  });
  assert.match(existing, /already.*match/i);
  let unavailableCalls = 0;
  await host.page.route(base + "/party-start", (route) => {
    unavailableCalls++;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": site },
      body: JSON.stringify({ code: "PARTY_DATABASE_UNAVAILABLE" }),
    });
  });
  const databaseError = await host.page.evaluate(async () => {
    try {
      await window.client.startParty("new-room", "facility", "town");
    } catch (error) {
      return error.message;
    }
  });
  assert.match(databaseError, /party database/);
  assert.equal(
    unavailableCalls,
    1,
    "database failures must not be retried as connecting-player races",
  );
  await host.page.unroute(base + "/party-start");
  const expired = await open("expired");
  const rejected = await expired.page.evaluate(async () => {
    try {
      await window.client.startParty("expired-room", "facility", "town");
    } catch (error) {
      return error.message;
    }
  });
  assert.match(rejected, /session.*(expired|rejected)/i);
  const invalidProfile = await open("invalid-profile");
  const badProfile = await invalidProfile.page.evaluate(async () => {
    try {
      await window.client.startParty(
        "invalid-profile-room",
        "facility",
        "town",
      );
    } catch (error) {
      return error.message;
    }
  });
  assert.match(badProfile, /callsign/);
  await invalidProfile.page.evaluate(async () => {
    window.profileName = "Corrected callsign";
    await window.client.updateProfile();
  });
  await invalidProfile.page.waitForFunction(
    () =>
      document
        .getElementById("hcs-service")
        .textContent.includes("Official standings"),
    {},
    { timeout: 3000 },
  );
  assert.deepEqual(errors, []);
  console.log(
    "Real two-player Platform 23 startup: 8.25s host profile, delayed guest profile, lost creation-response retry reuses the match, common snapshots, existing-match rejection and expired-session diagnostics passed.",
  );
} finally {
  await browser.close();
  await service.close();
}
