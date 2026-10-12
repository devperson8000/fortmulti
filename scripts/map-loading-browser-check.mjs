import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { chromium } from "playwright";
const url = process.env.GAME_TEST_URL || "http://127.0.0.1:4173",
  out =
    process.env.GAME_ARTIFACTS ||
    "/workspace/fortmulti-artifacts/map-loading-2026-10-13";
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
    "--disable-backgrounding-occluded-windows",
  ],
});
const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
  }),
  errors = [],
  checks = [],
  requests = [];
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
  p.on("request", (r) => {
    if (r.url().includes("/maps/platform23/"))
      requests.push({ player: name, url: r.url(), at: Date.now() });
  });
  await p.addInitScript((name) => {
    localStorage.setItem("horizon-callsign", JSON.stringify({ name }));
    localStorage.setItem(
      "duel-profile",
      JSON.stringify({ name, color: "408faf" }),
    );
    localStorage.setItem("sunny.graphicsQuality", "low");
  }, name);
  await p.goto(url + "/?local=1");
  await p.waitForFunction(() => !!window.Game);
  await p.evaluate(async () => {
    const { Connection } = await import("/network.js"),
      { Match } = await import("/simulation.js"),
      { WebGLRenderer } = await import("three");
    window.__mapCompiles = 0;
    const compile = WebGLRenderer.prototype.compileAsync;
    WebGLRenderer.prototype.compileAsync = function (...a) {
      window.__mapCompiles++;
      return compile.apply(this, a);
    };
    const open = Connection.prototype.open;
    Connection.prototype.open = async function (...a) {
      await open.apply(this, a);
      window.__connection = this;
    };
    const begin = Match.prototype.beginDeployment;
    Match.prototype.beginDeployment = function (...a) {
      window.__match = this;
      return begin.apply(this, a);
    };
  });
  return p;
}
let host,
  guest,
  blocked = true,
  collisionRequests = 0,
  manifestRequests = 0,
  geometryRequests = 0,
  textureRequests = 0;
try {
  host = await open("Leader");
  guest = await open("Wingman");
  await host.route("**/maps/platform23/collision-data.js*", (r) => {
    collisionRequests++;
    return blocked
      ? r.fulfill({ status: 503, body: "Temporary outage" })
      : r.continue();
  });
  await guest.route("**/maps/platform23/environment.json", (r) => {
    manifestRequests++;
    return manifestRequests === 1
      ? r.fulfill({ contentType: "application/json", body: "{truncated" })
      : r.continue();
  });
  await guest.route("**/maps/platform23/geometry.bin.gz", (r) => {
    geometryRequests++;
    return geometryRequests === 1
      ? r.fulfill({ status: 503, body: "Temporary outage" })
      : r.continue();
  });
  await guest.route(
    "**/maps/platform23/textures/plat23-computer01a_d.webp",
    (r) => {
      textureRequests++;
      return textureRequests === 1
        ? r.fulfill({ status: 503, body: "Temporary outage" })
        : r.continue();
    },
  );
  await host.locator("#create").click();
  await host.waitForFunction(() => window.__connection?.connected);
  const code = await host.evaluate(() => window.__connection.code);
  await guest.locator(".test-tools summary").first().click();
  await guest.locator("#code").fill(code);
  await guest.locator("#join").click();
  await host.waitForFunction(() =>
    document.getElementById("party-count").textContent.startsWith("2"),
  );
  await guest.waitForFunction(() => !!window.__connection?.host);
  await host.locator("#mode").selectOption("town");
  await host.locator("#map-choice").selectOption("facility");
  await guest.waitForFunction(
    () =>
      document.getElementById("map-choice").value === "facility" &&
      document.getElementById("mode").value === "town",
  );
  const began = Date.now();
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await host.waitForFunction(
    () =>
      document
        .getElementById("connection")
        .textContent.includes("Map could not load"),
    null,
    { timeout: 120000 },
  );
  await guest.waitForFunction(
    () => document.getElementById("hero-state").textContent === "READY",
    null,
    { timeout: 120000 },
  );
  assert.equal(
    collisionRequests,
    3,
    "failed module imports make three distinct requests, then stop",
  );
  await host.waitForTimeout(1000);
  assert.equal(collisionRequests, 3);
  assert.equal(await host.evaluate(() => !!window.__match), false);
  assert.equal(await host.evaluate(() => window.Duel.lobby), true);
  assert.equal(await guest.evaluate(() => window.Duel.lobby), true);
  await host.screenshot({ path: out + "/01-recoverable-map-outage.png" });
  checks.push(
    "A persistent collision-module outage stops after three fresh attempts; deployment waits for both maps",
  );
  // A server failure must not be reported as a map failure. Readiness is retriable.
  blocked = false;
  await host.evaluate(() => {
    window.__connection.local = false;
    window.__startParty = window.HorizonHCS.startParty;
    window.HorizonHCS.startParty = async () => {
      throw Error("Match server is reconnecting. Please ready up again.");
    };
  });
  await host.locator("#ready").click();
  await host.waitForFunction(
    () =>
      document
        .getElementById("connection")
        .textContent.includes("Match server is reconnecting"),
    null,
    { timeout: 120000 },
  );
  assert.equal(await host.evaluate(() => window.Game.mapId()), "facility");
  assert.equal(await host.evaluate(() => !!window.__match), false);
  checks.push(
    "A recovered module loads without refreshing Chrome; multiplayer service errors are identified separately",
  );
  await host.evaluate(() => {
    window.__connection.local = true;
    window.HorizonHCS.startParty = window.__startParty;
  });
  await host.locator("#ready").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () =>
          !window.Duel.lobby &&
          window.Game.mapId() === "facility" &&
          window.Game.pose().air === "ship",
        null,
        { timeout: 120000 },
      ),
    ),
  );
  assert.equal(await host.evaluate(() => window.__match.players.length), 2);
  assert.equal(manifestRequests, 2);
  assert.equal(geometryRequests, 2);
  assert.equal(textureRequests, 2);
  checks.push(
    "Two real party pages enter Platform 23 Town Royale after automatic manifest, geometry and texture recovery",
  );
  await host.screenshot({ path: out + "/02-both-players-in-ship.png" });
  const count = requests.length,
    compiles = await Promise.all(
      [host, guest].map((p) => p.evaluate(() => window.__mapCompiles)),
    );
  await host.evaluate(() => window.Duel.menu());
  await host.locator("#back-lobby").click();
  await Promise.all(
    [host, guest].map((p) => p.waitForFunction(() => window.Duel.lobby)),
  );
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () => !window.Duel.lobby && window.Game.pose().air === "ship",
        null,
        { timeout: 30000 },
      ),
    ),
  );
  assert.equal(
    requests.length,
    count,
    "successful resources are reused across rematches",
  );
  assert.deepEqual(
    await Promise.all(
      [host, guest].map((p) => p.evaluate(() => window.__mapCompiles)),
    ),
    compiles,
    "rematch must not compile shaders again",
  );
  checks.push(
    "Ready-up again starts the next match without downloading or compiling the map again",
  );
  // Move the authoritative pair onto native pads; the rendering and snapshots remain real.
  await host.evaluate(() => {
    const m = window.__match;
    m.phase = "playing";
    m.deployment.stage = "match_active";
    m.players.forEach((p, i) => {
      const pad = m.world.landingPoints[i ? 5 : 3];
      p.p = [pad.x, pad.y, pad.z];
      p.air = "landed";
      p.deploymentState = "match_active";
      p.yaw = 0;
      p.grounded = true;
      p.slot = 1;
    });
  });
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () =>
          window.Game.pose().air === "landed" &&
          window.Game.pose().deploymentState === "match_active",
        null,
        { timeout: 30000 },
      ),
    ),
  );
  await host.screenshot({ path: out + "/03-leader-platform23.png" });
  await guest.screenshot({ path: out + "/04-wingman-platform23.png" });
  checks.push(
    "Both players render the loaded native map and weapons through real party snapshots",
  );
  const gameplayRender = await Promise.all(
    [host, guest].map((p) => p.evaluate(() => window.Game.mapStatus())),
  );
  assert.ok(
    gameplayRender.every(
      (s) => s.render.colorCalls > 0 && s.render.triangles > 0,
    ),
  );
  // Simulate a late participant whose snapshot loader exhausted its retries.
  // The actual map and party transport remain loaded; only that boundary rejects.
  await host.evaluate(() => window.Duel.menu());
  await host.locator("#back-lobby").click();
  await Promise.all(
    [host, guest].map((p) => p.waitForFunction(() => window.Duel.lobby)),
  );
  await guest.evaluate(() => {
    window.__nativeSetMap = window.Game.setMap;
    window.__nativeMapId = window.Game.mapId;
    window.__snapshotMapAttempts = 0;
    window.Game.mapId = () => "island";
    window.Game.setMap = (id) =>
      ++window.__snapshotMapAttempts === 1
        ? window.__nativeSetMap(id)
        : Promise.reject(Error("Injected exhausted snapshot load"));
  });
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await guest.waitForFunction(
    () => document.getElementById("ready").textContent === "RETRY MAP",
  );
  await guest.waitForTimeout(1200);
  assert.equal(
    await guest.evaluate(() => window.__snapshotMapAttempts),
    2,
    "new snapshots must not cause an unbounded failure loop",
  );
  await guest.evaluate(() => {
    window.Game.setMap = window.__nativeSetMap;
    window.Game.mapId = window.__nativeMapId;
  });
  await guest.locator("#ready").click();
  await guest.waitForFunction(
    () => !window.Duel.lobby && window.Game.pose().air === "ship",
  );
  assert.equal(await host.evaluate(() => window.__match.players.length), 2);
  checks.push(
    "An exhausted snapshot load stops retry storms and Retry Map rejoins the latest match without recreating the party",
  );
  assert.deepEqual(errors, []);
  const report = {
    checks,
    errors,
    collisionRequests,
    manifestRequests,
    geometryRequests,
    textureRequests,
    totalAssetRequests: requests.length,
    elapsedSeconds: (Date.now() - began) / 1000,
    render: gameplayRender,
    limits: [
      "Injected local HTTP outages exercise recovery; external Vercel/Northflank access is blocked in this cloud workspace.",
      "Chromium uses software WebGL here; this is not a Mac M3 performance benchmark.",
    ],
  };
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error);
  await writeFile(
    out + "/failure.json",
    JSON.stringify(
      {
        error: String(error),
        errors,
        checks,
        collisionRequests,
        manifestRequests,
        geometryRequests,
        textureRequests,
        pages: await Promise.all(
          [host, guest].filter(Boolean).map((p) =>
            p.evaluate(() => ({
              status: document.getElementById("connection").textContent,
              ready: document.getElementById("ready").textContent,
              map: window.Game.mapId(),
              pose: window.Game.pose(),
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
