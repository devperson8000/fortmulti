import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { WebSocket } from "ws";
import { createHCSServer } from "../server/hcs-server.mjs";
const out = process.env.GAME_ARTIFACTS || "/workspace/fortmulti-artifacts/hcs";
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
service.championship.state.at = clock + 5000;
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
  errors = [];
async function open(id) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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
  page.on("pageerror", (e) => errors.push(e.message));
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
  for (const id of ids.slice(1)) {
    const ws = new WebSocket(backend.replace("http", "ws") + "/stream", {
      origin: site,
    });
    await new Promise((r) => ws.once("open", r));
    const ready = new Promise((r) =>
      ws.on("message", (m) => {
        if (JSON.parse(m).type === "authenticated") r();
      }),
    );
    ws.send(JSON.stringify({ type: "auth", token: id }));
    await ready;
    sockets.push(ws);
    const response = await fetch(backend + "/checkin", {
      method: "POST",
      headers: { Authorization: "Bearer " + id },
      body: "{}",
    });
    assert.equal(response.status, 200);
  }
  const viewer = await open("spectator");
  await player.screenshot({ path: out + "/hcs-qualified.png" });
  offset += 5000;
  await player.waitForFunction(
    () => window.HorizonHCS.active,
    {},
    { timeout: 45000 },
  );
  await player.waitForFunction(() => window.Game.mapId() === "facility");
  await player.waitForFunction(
    () =>
      window.Game.pose().air === "landed" &&
      window.Game.deploymentView().stage === "match_active",
    {},
    { timeout: 65000 },
  );
  assert.equal(service.referee.match.players.length, 5);
  await player.screenshot({ path: out + "/hcs-five-player-deployment.png" });
  await viewer.waitForFunction(
    () => !document.getElementById("hcs-watch").hidden,
    {},
    { timeout: 20000 },
  );
  await viewer.locator("#hcs-watch").click();
  await viewer.waitForFunction(
    () => window.HorizonHCS.active,
    {},
    { timeout: 45000 },
  );
  assert.equal(await viewer.locator("#hcs-view-player option").count(), 5);
  await viewer.locator("#hcs-view-player").selectOption("charlie");
  await viewer.waitForFunction(
    () =>
      window.Game.pose().air === "landed" &&
      window.Game.deploymentView().stage === "match_active",
    {},
    { timeout: 65000 },
  );
  assert.match(
    await viewer.locator("#hcs-watch-stats").textContent(),
    /HP.*KILLS.*LEFT/,
  );
  await viewer.screenshot({ path: out + "/hcs-delayed-broadcast.png" });
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
