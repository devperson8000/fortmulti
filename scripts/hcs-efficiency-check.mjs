import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
const site = process.env.GAME_TEST_URL || "http://127.0.0.1:4173",
  out =
    process.env.GAME_ARTIFACTS ||
    "/workspace/fortmulti-artifacts/backend-ux-2026-10-15";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage(),
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const ids = [
    "hcs-countdown",
    "hcs-promo-time",
    "hcs-date",
    "hcs-promo",
    "hcs-empty",
    "hcs-personal",
    "hcs-invite-notice",
    "hcs-champion",
    "hcs-service",
    "hcs-broadcast",
    "hcs-broadcast-label",
    "hcs-watch-stats",
    "lobby",
    "net-ping",
  ];
  await page.route("**/efficiency-lab", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<body>${ids.map((id) => `<div id="${id}"></div>`).join("")}<div id="match-connection" role="status" hidden></div><button id="hcs-checkin"></button><button id="hcs-watch"></button><button id="hcs-return"></button><table><tbody id="hcs-ranks"></tbody></table><select id="hcs-view-player"></select></body>`,
    }),
  );
  await page.goto(site + "/efficiency-lab");
  await page.evaluate(async () => {
    window.pendingReads = [];
    window.readCount = 0;
    window.checked = false;
    window.fixture = () => ({
      at: Date.now() + 10000,
      phase: "checkin",
      ranks: [
        { id: "operator", name: "Operator", wins: 1, kills: 5, games: 12 },
      ],
      checked: window.checked ? ["operator"] : [],
    });
    window.fetch = async (url) =>
      String(url).endsWith("/state")
        ? new Promise((resolve) => {
            window.readCount++;
            window.pendingReads.push((state) =>
              resolve({ ok: true, json: async () => state }),
            );
          })
        : {
            ok: true,
            json: async () => {
              if (String(url).endsWith("/checkin")) window.checked = true;
              return window.fixture();
            },
          };
    window.WebSocket = class {
      constructor() {
        this.readyState = 1;
        this.bufferedAmount = 0;
        window.socket = this;
        queueMicrotask(() => this.onopen?.());
      }
      send() {}
      close() {
        this.readyState = 3;
      }
    };
    window.Game = {
      input: () => ({}),
      clear() {},
      look() {},
      apply() {},
      effect() {},
    };
    window.Duel = { lobby: true };
    const { createHCS } = await import("/hcs-client.js");
    window.client = createHCS({
      config: { hcsUrl: "http://127.0.0.1:4201" },
      session: () => ({ access_token: "fixture" }),
      profile: () => ({ name: "Operator" }),
      leaveParty: async () => {},
      returnLobby() {},
      applyOfficial() {
        window.Duel.lobby = false;
      },
    });
    await window.socket.onmessage({
      data: JSON.stringify({ type: "authenticated", id: "operator" }),
    });
  });
  assert.equal(
    await page.evaluate(() => window.readCount),
    1,
    "initial and authenticated polling must share one pending standings request",
  );
  await page.evaluate(() => {
    const state = window.fixture();
    window.pendingReads.splice(0).forEach((resolve) => resolve(state));
  });
  await page.waitForFunction(
    () => !document.getElementById("hcs-checkin").disabled,
  );
  checks.push("Concurrent standings refreshes share one request");
  await page.evaluate(() => window.client.updateProfile());
  await page.waitForFunction(() => window.pendingReads.length === 1);
  const stale = await page.evaluate(() => window.fixture());
  await page.locator("#hcs-checkin").click();
  await page.waitForFunction(
    () => document.getElementById("hcs-checkin").textContent === "CHECKED IN",
  );
  await page.evaluate((state) => window.pendingReads.shift()(state), stale);
  await page.waitForTimeout(50);
  assert.equal(
    await page.locator("#hcs-checkin").textContent(),
    "CHECKED IN",
    "late pre-check-in standings must not undo confirmed check-in",
  );
  checks.push("A delayed pre-check-in response cannot undo confirmed check-in");
  await page.evaluate(() => {
    window.rankMutations = 0;
    window.rankObserver = new MutationObserver(
      (m) => (window.rankMutations += m.length),
    );
    window.rankObserver.observe(document.getElementById("hcs-ranks"), {
      childList: true,
    });
  });
  await page.evaluate(() => window.client.updateProfile());
  await page.waitForFunction(() => window.pendingReads.length === 1);
  await page.evaluate(() => window.pendingReads.shift()(window.fixture()));
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(() => {
      window.rankObserver.disconnect();
      return window.rankMutations;
    }),
    0,
    "unchanged standings must preserve their rows and focus",
  );
  checks.push("Unchanged standings preserve existing rows");
  await page.evaluate(async () => {
    window.snapshot = {
      type: "snapshot",
      tournament: false,
      matchId: "normal",
      epoch: 1,
      frame: 1,
      mapId: "facility",
      profiles: [],
      state: { players: [{ id: "operator", hp: 100 }], phase: "playing" },
    };
    await window.socket.onmessage({ data: JSON.stringify(window.snapshot) });
    window.socket.readyState = 3;
    window.socket.onclose();
  });
  await page.waitForFunction(
    () => !document.getElementById("match-connection").hidden,
  );
  assert.match(
    await page.locator("#match-connection").textContent(),
    /reconnect/i,
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.retrySocket = window.socket;
    window.socket.readyState = 3;
    window.socket.onclose();
  });
  await page.waitForTimeout(1100);
  assert.equal(
    await page.evaluate(() => window.socket === window.retrySocket),
    true,
    "the one-second UI timer must respect the two-second retry backoff",
  );
  await page.waitForTimeout(1200);
  checks.push(
    "Reconnect attempts respect exponential backoff instead of retrying every UI tick",
  );
  await page.evaluate(async () => {
    await window.socket.onmessage({
      data: JSON.stringify({ type: "authenticated", id: "operator" }),
    });
    await window.socket.onmessage({
      data: JSON.stringify({ ...window.snapshot, frame: 2 }),
    });
  });
  assert.equal(
    await page.locator("#match-connection").isHidden(),
    true,
    "a fresh current-socket frame must clear reconnect feedback",
  );
  checks.push(
    "Normal multiplayer exposes reconnect feedback and clears it on fresh gameplay",
  );
  await page.evaluate(() => window.client.updateProfile());
  await page.waitForFunction(() => window.pendingReads.length > 0);
  const before = await page.evaluate(() => {
    window.client.close();
    return document.getElementById("hcs-service").textContent;
  });
  await page.evaluate(() =>
    window.pendingReads.splice(0).forEach((resolve) =>
      resolve({
        ...window.fixture(),
        phase: "complete",
        champion: { name: "Stale champion" },
      }),
    ),
  );
  await page.waitForTimeout(50);
  assert.equal(
    await page.locator("#hcs-service").textContent(),
    before,
    "a closed client must ignore late HTTP responses",
  );
  checks.push("Closed clients ignore late standings responses");
  assert.deepEqual(errors, []);
  const report = {
    checks,
    errors,
    limits: [
      "Real browser HCS client with controlled HTTP/socket responses; actual referee sockets and game rendering are checked separately.",
    ],
  };
  await writeFile(
    out + "/hcs-ux-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  await browser.close();
}
