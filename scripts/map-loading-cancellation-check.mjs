import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { chromium } from "playwright";
const url = process.env.GAME_TEST_URL || "http://127.0.0.1:4173",
  out =
    process.env.GAME_ARTIFACTS ||
    "/workspace/fortmulti-artifacts/loading-polish-2026-10-13";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  }),
  context = await browser.newContext({ viewport: { width: 960, height: 540 } }),
  errors = [],
  checks = [];
await context.route(
  "https://cdn.jsdelivr.net/npm/three@0.186.0/**",
  async (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: await readFile(
        "node_modules/three/" + r.request().url().split("three@0.186.0/")[1],
      ),
    }),
);
async function open(name) {
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript((name) => {
    localStorage.setItem("horizon-callsign", JSON.stringify({ name }));
    localStorage.setItem(
      "duel-profile",
      JSON.stringify({ name, color: "408faf" }),
    );
    localStorage.setItem("sunny.graphicsQuality", "low");
  }, name);
  await p.goto(url + "/?local=1");
  await p.waitForFunction(() => !!window.Game && !!window.HorizonHCS);
  await p.evaluate(async () => {
    const { Connection } = await import("/network.js"),
      { Match } = await import("/simulation.js"),
      open = Connection.prototype.open,
      begin = Match.prototype.beginDeployment;
    Connection.prototype.open = async function (...a) {
      await open.apply(this, a);
      window.__connection = this;
    };
    window.__begins = 0;
    Match.prototype.beginDeployment = function (...a) {
      window.__match = this;
      window.__begins++;
      return begin.apply(this, a);
    };
  });
  return p;
}
let host, guest;
async function join() {
  const code = await host.evaluate(() => window.__connection.code);
  await guest.locator("#code").fill(code);
  await guest.locator("#join").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(() =>
        document.getElementById("party-count").textContent.startsWith("2"),
      ),
    ),
  );
  await guest.waitForFunction(() => !!window.__connection?.host);
}
async function lobby() {
  await host.evaluate(() => window.Duel.menu());
  await host.locator("#back-lobby").click();
  await Promise.all(
    [host, guest].map((p) => p.waitForFunction(() => window.Duel.lobby)),
  );
}
try {
  host = await open("Leader");
  guest = await open("Wingman");
  await host.locator("#create").click();
  await host.waitForFunction(() => window.__connection?.connected);
  await guest.locator(".test-tools summary").first().click();
  await join();
  await guest.evaluate(() => {
    window.__nativeSetMap = window.Game.setMap;
    window.__loadJobs = [];
    window.Game.setMap = (id) =>
      new Promise((resolve, reject) =>
        window.__loadJobs.push({
          resolve: () => window.__nativeSetMap(id).then(resolve, reject),
          reject,
        }),
      );
  });
  await guest.locator("#ready").click();
  await guest.waitForFunction(() => window.__loadJobs.length === 1);
  await guest.locator("#leave").click();
  await guest.waitForFunction(() => !window.__connection.connected);
  await join();
  assert.equal(
    await guest.locator("#ready").isEnabled(),
    true,
    "leaving an unfinished map load must not lock the new party",
  );
  checks.push("Leaving while loading releases the new party’s Ready button");
  await guest.locator("#ready").click();
  await guest.waitForFunction(() => window.__loadJobs.length === 2);
  await guest.evaluate(() => window.__loadJobs[0].resolve());
  await guest.waitForTimeout(100);
  assert.equal(
    await guest.locator("#ready").isDisabled(),
    true,
    "the old load must not clear the new load’s busy state",
  );
  assert.equal(await guest.locator("#hero-state").textContent(), "NOT READY");
  checks.push(
    "A stale completion cannot ready the player or clear a newer loading operation",
  );
  assert.equal(await guest.locator("#ready").getAttribute("aria-busy"), "true");
  assert.equal(await guest.locator("#map-choice").isDisabled(), true);
  assert.equal(await guest.locator("#mode").isDisabled(), true);
  assert.equal(await guest.locator("#name").isDisabled(), true);
  await guest.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await guest.evaluate(
      () =>
        getComputedStyle(document.getElementById("ready"), "::after")
          .animationName,
    ),
    "none",
  );
  await guest.emulateMedia({ reducedMotion: "no-preference" });
  checks.push(
    "Loading feedback is accessible, respects reduced motion and locks map/profile controls",
  );
  await guest.screenshot({ path: out + "/01-preparing-new-party.png" });
  await guest.evaluate(() => window.__loadJobs[1].resolve());
  await guest.waitForFunction(
    () => document.getElementById("hero-state").textContent === "READY",
  );
  await guest.evaluate(() => (window.Game.setMap = window.__nativeSetMap));
  await host.locator("#ready").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () => !window.Duel.lobby && window.Game.pose().air === "ship",
      ),
    ),
  );
  checks.push(
    "The replacement load completes and the current two-player party deploys",
  );
  await lobby();
  await host.evaluate(() => {
    window.__startParty = window.HorizonHCS.startParty;
    window.__connection.local = false;
    window.HorizonHCS.startParty = () =>
      new Promise((resolve) => (window.__releaseStart = resolve));
  });
  await guest.locator("#ready").click();
  await host.locator("#ready").click();
  await host.waitForFunction(() => typeof window.__releaseStart === "function");
  // Restore the local transport setting after exercising the online-start branch.
  await host.evaluate(() => (window.__connection.local = true));
  await host.locator("#leave").click();
  await guest.waitForFunction(() => !window.__connection.connected);
  await host.locator("#create").click();
  await host.waitForFunction(() => window.__connection.connected);
  await join();
  const ids = await Promise.all(
    [host, guest].map((p) => p.evaluate(() => window.__connection.id)),
  );
  await host.evaluate(() => window.__releaseStart(false));
  await host.waitForTimeout(100);
  assert.equal(
    await host.evaluate(() => window.__begins),
    1,
    "a late service response must not create a match for an old roster",
  );
  assert.equal(await host.locator("#ready").isEnabled(), true);
  assert.equal(await host.evaluate(() => window.Duel.lobby), true);
  checks.push(
    "A stale match-service response cannot create a match in the replacement party",
  );
  await host.evaluate(
    () => (window.HorizonHCS.startParty = window.__startParty),
  );
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () => !window.Duel.lobby && window.Game.pose().air === "ship",
      ),
    ),
  );
  assert.deepEqual(
    (await host.evaluate(() => window.__match.ids)).sort(),
    ids.sort(),
  );
  assert.equal(await host.evaluate(() => window.__begins), 2);
  await host.screenshot({ path: out + "/02-current-roster-deploys.png" });
  checks.push("Only the new roster enters deployment after reconnecting");
  await lobby();
  await guest.evaluate(() => {
    window.__nativeMapId = window.Game.mapId;
    window.__snapshotJobs = [];
    window.__allowReadyMap = true;
    window.Game.mapId = () => "facility";
    window.Game.setMap = (id) => {
      if (window.__allowReadyMap) {
        window.__allowReadyMap = false;
        return window.__nativeSetMap(id);
      }
      return new Promise((resolve, reject) =>
        window.__snapshotJobs.push({
          resolve: () => window.__nativeSetMap(id).then(resolve, reject),
        }),
      );
    };
  });
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await guest.waitForFunction(() => window.__snapshotJobs.length === 1);
  await guest.locator("#leave").click();
  await host.waitForFunction(() => window.Duel.lobby);
  await join();
  await guest.evaluate(() => (window.__allowReadyMap = true));
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await guest.waitForFunction(() => window.__snapshotJobs.length === 2);
  await guest.evaluate(() => window.__snapshotJobs[0].resolve());
  await guest.waitForTimeout(100);
  assert.equal(await guest.locator("#ready").getAttribute("aria-busy"), "true");
  assert.equal(await guest.locator("#ready").isDisabled(), true);
  assert.equal(await guest.evaluate(() => window.Duel.lobby), true);
  await guest.evaluate(() => {
    window.Game.setMap = window.__nativeSetMap;
    window.Game.mapId = window.__nativeMapId;
    return window.__snapshotJobs[1].resolve();
  });
  await guest.waitForFunction(
    () => !window.Duel.lobby && window.Game.pose().air === "ship",
  );
  assert.deepEqual(
    (await host.evaluate(() => window.__match.ids)).sort(),
    (
      await Promise.all(
        [host, guest].map((p) => p.evaluate(() => window.__connection.id)),
      )
    ).sort(),
  );
  checks.push(
    "An abandoned snapshot load cannot clear a new snapshot load or apply the old match",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        checks,
        errors,
        limits: [
          "Local party transport and deferred boundary responses exercise cancellation; remote hosting and native Mac performance are not tested.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await writeFile(
    out + "/failure.json",
    JSON.stringify(
      {
        error: String(error),
        checks,
        errors,
        pages: await Promise.all(
          [host, guest].filter(Boolean).map((p) =>
            p.evaluate(() => ({
              ready: document.getElementById("ready").textContent,
              disabled: document.getElementById("ready").disabled,
              status: document.getElementById("connection").textContent,
              begins: window.__begins,
              lobby: window.Duel.lobby,
            })),
          ),
        ),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
