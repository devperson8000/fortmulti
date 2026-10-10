import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.GAME_ARTIFACTS || "/workspace/fortmulti-artifacts/lobby-updates";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
  ],
});
const context = await browser.newContext(),
  errors = [],
  result = {};
async function open() {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Update check" }),
    );
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      callback.name === "frame" ? 0 : raf(callback);
  });
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.Game && window.Duel);
  await page.evaluate(async () => {
    const { Connection, SocialDirectory } = await import("/network.js");
    const invites = SocialDirectory.prototype.invites;
    SocialDirectory.prototype.invites = async function (...args) {
      window.__social = this;
      return invites.apply(this, args);
    };
    const original = Connection.prototype.open;
    Connection.prototype.open = async function (...args) {
      await original.apply(this, args);
      window.__conn = this;
    };
    const { Match } = await import("/simulation.js");
    const begin = Match.prototype.beginDeployment;
    Match.prototype.beginDeployment = function (...args) {
      const value = begin.apply(this, args);
      window.__match = this;
      return value;
    };
  });
  return page;
}
try {
  const host = await open(),
    guest = await open();
  await host.locator("#create").click();
  await host.waitForFunction(() => window.__conn?.connected);
  const code = await host.evaluate(() => window.__conn.code);
  await guest.locator(".test-tools summary").first().click();
  await guest.locator("#code").fill(code);
  await guest.locator("#join").click();
  await host.waitForFunction(() => window.Duel.party.length === 2);
  await guest.waitForFunction(() => window.__social);
  // Feed a time-bounded invite through the native directory's ordinary poll.
  await guest.evaluate(() =>
    window.__social.localInvites.push({
      id: "expiry-fixture",
      from_user: "fixture",
      from_name: "Reserve Ranger",
      from_color: "408faf",
      room_code: "EXPIRE1234",
      expires_at: new Date(Date.now() + 90000).toISOString(),
    }),
  );
  await guest.waitForFunction(
    () => !document.getElementById("invite-tray").hidden,
  );
  assert.equal(await guest.locator("#invite-list .accept").isDisabled(), false);
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await host.waitForFunction(() => window.__match?.phase === "deployment");
  await host.evaluate(() => {
    const m = window.__match;
    m.phase = "playing";
    for (const [i, p] of m.players.entries()) {
      p.p = [i * 30, m.world.height(i * 30, 62), 62];
      p.air = "landed";
      p.deploymentState = "match_active";
    }
  });
  await guest.waitForFunction(() => !window.Duel.lobby);
  await guest.waitForFunction(
    () => document.querySelector("#invite-list .accept")?.disabled,
  );
  await guest.waitForTimeout(4000);
  await guest.evaluate(() => {
    window.__oldCard = document.querySelector("#party-grid .party-card");
    window.__mutations = { party: 0, online: 0, invites: 0 };
    for (const [id, name] of [
      ["party-grid", "party"],
      ["online-list", "online"],
      ["invite-list", "invites"],
    ])
      new MutationObserver(
        (records) =>
          (window.__mutations[name] += records.filter(
            (r) => r.type === "childList",
          ).length),
      ).observe(document.getElementById(id), {
        childList: true,
        subtree: true,
      });
    const { __conn: c } = window;
    window.__snapshots = 0;
    const on = c.onmessage;
    c.onmessage = function (m) {
      if (m.type === "snapshot") window.__snapshots++;
      return on.call(this, m);
    };
  });
  await guest.waitForTimeout(2100);
  result.stable = await guest.evaluate(() => ({
    mutations: window.__mutations,
    snapshots: window.__snapshots,
    sameCard:
      window.__oldCard === document.querySelector("#party-grid .party-card"),
  }));
  await writeFile(
    out + "/results.json",
    JSON.stringify({ ...result, errors }, null, 2),
  );
  assert.ok(
    result.stable.snapshots >= 15,
    "real match snapshots must continue",
  );
  assert.equal(
    result.stable.mutations.party,
    0,
    "unchanged snapshots must not rebuild party cards",
  );
  assert.equal(
    result.stable.mutations.online,
    0,
    "unchanged snapshots must not rebuild the online list",
  );
  assert.equal(
    result.stable.mutations.invites,
    0,
    "unchanged snapshots must not rebuild invites",
  );
  assert.equal(result.stable.sameCard, true);
  // Readiness and profile changes still update, and no cached list remains stale.
  await host.evaluate(() => window.Duel.menu());
  await host.locator("#back-lobby").click();
  await guest.waitForFunction(() => window.Duel.lobby);
  assert.equal(await guest.locator("#invite-list .accept").isDisabled(), false);
  await guest.evaluate(
    () =>
      (window.__social.localInvites[0].expires_at = new Date(
        Date.now() - 1,
      ).toISOString()),
  );
  await guest.waitForFunction(
    () => document.getElementById("invite-tray").hidden,
  );
  result.inviteStateAndExpiry = true;
  await host.locator("#profile-toggle").click();
  await host.locator("#name").fill("Changed Ranger");
  await host.locator("#name").blur();
  await guest.waitForFunction(() =>
    document
      .getElementById("party-grid")
      .textContent.includes("Changed Ranger"),
  );
  await host.locator("#lobby-play-toggle").click();
  await host.locator("#ready").click();
  await guest.waitForFunction(() =>
    document.getElementById("party-summary").textContent.includes("1/2 ready"),
  );
  result.changedProfileAndReady = true;
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(
    "Stable match snapshots retain DOM; changed profile and readiness update correctly",
    result.stable,
  );
} finally {
  await browser.close();
}
