import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const out = process.env.GAME_ARTIFACTS || "docs/reviews/hcs-2026-10-10";
await mkdir(out, { recursive: true });
let clock = Date.now(),
  offset = 0;
const site = "http://127.0.0.1:4173",
  ids = ["alpha", "bravo", "charlie", "delta", "echo"];
const service = await createHCSServer({
  authenticate: async (token) => (token ? { id: token } : null),
  load: async () => null,
  save: async () => {},
  origins: [site],
  now: () => Date.now() + offset,
});
await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
const backend = `http://127.0.0.1:${service.server.address().port}`;
service.championship.state.at = clock + 600000;
service.championship.state.phase = "checkin";
service.championship.state.ranks = ids.map((id, i) => ({
  id,
  name: "Operator " + id,
  games: 10,
  wins: 10 - i,
  kills: 20 - i,
}));
for (const p of service.championship.state.ranks)
  service.championship.state.players[p.id] = p;
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  }),
  sockets = [],
  errors = [],
  rendererErrors = [],
  traffic = [],
  pages = [];
async function open(id) {
  const context = await browser.newContext({
    viewport: { width: 854, height: 480 },
  });
  await context.route("https://hcs-test.supabase.co/**", (r) =>
    r.fulfill({
      json:
        r.request().url().includes("online") ||
        r.request().url().includes("invites")
          ? []
          : {},
    }),
  );
  await context.addInitScript(
    ({ id, backend }) => {
      localStorage.setItem(
        "horizon-callsign",
        JSON.stringify({ name: "Operator " + id }),
      );
      localStorage.setItem(
        "duel-profile",
        JSON.stringify({ name: "Operator " + id, color: "557959" }),
      );
      localStorage.setItem(
        "duel-config",
        JSON.stringify({
          url: "https://hcs-test.supabase.co",
          key: "test-public",
          hcsUrl: backend,
        }),
      );
      sessionStorage.setItem(
        "sunny-auth-v3",
        JSON.stringify({
          user: { id },
          access_token: id,
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      localStorage.setItem("sunny.graphicsQuality", "low");
    },
    { id, backend },
  );
  const page = await context.newPage();
  pages.push(page);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /WebGL|GL_INVALID|shader|geometry/i.test(m.text())
    )
      rendererErrors.push(m.text());
  });
  await page.addInitScript(() => {
    window.__frames = [];
    let last = performance.now();
    function sample(now) {
      if (
        window.HorizonHCS?.active &&
        window.Game?.pose().air === "landed" &&
        window.Game.deploymentView().stage === "match_active"
      )
        window.__frames.push(now - last);
      last = now;
      if (window.__frames.length > 2000) window.__frames.shift();
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto(site);
  await page.waitForFunction(() => !!window.HorizonHCS);
  await page.locator("#hcs-toggle").click();
  return page;
}
try {
  const player = await open("alpha");
  await player.waitForFunction(
    () => !document.getElementById("hcs-checkin").disabled,
  );
  await player.locator("#hcs-checkin").click();
  await player.waitForFunction(
    () => document.getElementById("hcs-checkin").textContent === "CHECKED IN",
  );
  assert.equal(
    await player.locator("#hcs-checkin").textContent(),
    "CHECKED IN",
  );
  const competitors = [player];
  for (const id of ids.slice(1)) {
    const p = await open(id);
    competitors.push(p);
    await p.waitForFunction(
      () => !document.getElementById("hcs-checkin").disabled,
      {},
      { timeout: 60000 },
    );
    await p.locator("#hcs-checkin").click();
    await p.waitForFunction(
      () => document.getElementById("hcs-checkin").textContent === "CHECKED IN",
    );
  }
  for (let n = 0; n < 12; n++) {
    const ws = new WebSocket(backend.replace("http", "ws") + "/stream", {
      origin: site,
    });
    const row = {
      id: "load-viewer-" + n,
      snapshots: 0,
      bytes: 0,
      minDelayMs: Infinity,
    };
    traffic.push(row);
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      row.bytes += raw.length;
      if (m.type === "authenticated")
        ws.send(JSON.stringify({ type: "watch" }));
      if (m.type === "snapshot") {
        row.snapshots++;
        const f = service.referee?.feed.frames.find(
          (f) =>
            f.data.elapsed === m.state.elapsed &&
            f.data.deployment.elapsed === m.state.deployment.elapsed,
        );
        if (f)
          row.minDelayMs = Math.min(row.minDelayMs, Date.now() + offset - f.at);
      }
    });
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ type: "auth", token: row.id }));
    sockets.push(ws);
  }
  const viewer = await open("spectator");
  await player.screenshot({ path: out + "/hcs-qualified.png" });
  const viewers = [viewer, await open("spectator2"), await open("spectator3")];
  offset = service.championship.state.at - Date.now() + 50;
  await player.waitForFunction(
    () => window.HorizonHCS.active,
    {},
    { timeout: 150000 },
  );
  await player.waitForFunction(() => window.Game.mapId() === "facility");
  await player.waitForFunction(
    () =>
      window.Game.pose().air === "landed" &&
      window.Game.deploymentView().stage === "match_active",
    {},
    { timeout: 150000 },
  );
  assert.equal(service.referee.match.players.length, 5);
  assert.equal(
    await player.evaluate(() => document.body.dataset.camera),
    "firstPerson",
    "HCS competitors keep their first-person view",
  );
  await player.screenshot({ path: out + "/hcs-five-player-deployment.png" });
  await viewer.waitForFunction(
    () => !document.getElementById("hcs-watch").hidden,
    {},
    { timeout: 20000 },
  );
  for (const page of viewers) {
    await page.waitForFunction(
      () => !document.getElementById("hcs-watch").hidden,
    );
    await page.locator("#hcs-watch").click();
  }
  await viewer.waitForFunction(
    () => window.HorizonHCS.active,
    {},
    { timeout: 150000 },
  );
  assert.equal(await viewer.locator("#hcs-view-player option").count(), 5);
  await viewer.locator("#hcs-view-player").selectOption("charlie");
  await viewer.waitForFunction(
    () =>
      window.Game.pose().air === "landed" &&
      window.Game.deploymentView().stage === "match_active",
    {},
    { timeout: 150000 },
  );
  assert.match(
    await viewer.locator("#hcs-watch-stats").textContent(),
    /HP.*KILLS.*LEFT/,
  );
  await viewer.waitForFunction(
    () => document.body.dataset.camera === "spectator",
  );
  await viewer.screenshot({ path: out + "/hcs-delayed-broadcast.png" });
  for (const id of ids) {
    await viewer.locator("#hcs-view-player").selectOption(id);
    await viewer.waitForTimeout(500);
    await viewer.screenshot({ path: out + "/hcs-view-" + id + ".png" });
  }
  const frameStats = [];
  await new Promise((r) => setTimeout(r, 10000));
  for (const [index, page] of pages.entries()) {
    const values = await page.evaluate(() => window.__frames.slice());
    values.sort((a, b) => a - b);
    frameStats.push({
      client: index,
      samples: values.length,
      medianMs: values[Math.floor(values.length * 0.5)] || null,
      p95Ms: values[Math.floor(values.length * 0.95)] || null,
      maxMs: values.at(-1) || null,
    });
  }
  const landing = service.referee.match.players.map((p) => ({
    id: p.id,
    position: p.p,
    air: p.air,
    hp: p.hp,
    weapon: p.weapon,
    destination: p.destination,
  }));
  for (const p of landing) assert.ok(p.position.every(Number.isFinite));
  for (const row of traffic) {
    assert.ok(row.snapshots > 0);
    assert.ok(row.minDelayMs >= 20000);
    if (!Number.isFinite(row.minDelayMs)) row.minDelayMs = null;
  }
  await writeFile(
    out + "/hcs-load-results.json",
    JSON.stringify(
      {
        competitors: 5,
        renderedCompetitors: 5,
        spectators: 15,
        renderedSpectators: 3,
        graphics: "low",
        renderer: "Chromium SwiftShader software",
        frameStats,
        traffic,
        landing,
        errors,
        rendererErrors,
      },
      null,
      2,
    ),
  );
  await viewer.setViewportSize({ width: 390, height: 844 });
  const overlay = await viewer.locator("#hcs-broadcast").boundingBox();
  assert.ok(
    overlay.x >= 0 && overlay.x + overlay.width <= 390,
    "mobile broadcast controls fit the screen",
  );
  await viewer.screenshot({ path: out + "/hcs-mobile-broadcast.png" });
  await viewer.locator("#hcs-return").click();
  await viewer.waitForTimeout(300);
  assert.equal(await viewer.evaluate(() => window.HorizonHCS.active), false);
  assert.equal(await viewer.locator("#lobby").isVisible(), true);
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/live-browser-results.json",
    JSON.stringify(
      {
        checks: [
          "real authenticated check-in UI",
          "five-player automatic native deployment",
          "separate delayed spectator stream",
          "five selectable competitors",
          "health kills remaining overlay",
          "return-to-lobby persists",
        ],
        errors,
        rendererErrors,
      },
      null,
      2,
    ),
  );
  console.log("HCS live browser checks passed");
} finally {
  for (const ws of sockets) ws.terminate();
  await browser.close();
  await service.close();
}
