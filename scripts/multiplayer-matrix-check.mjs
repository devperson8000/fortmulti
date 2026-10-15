import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createHCSServer } from "../server/hcs-server.mjs";
import { Match } from "../public/simulation.js";
import { safeLandingPoint } from "../public/deployment-sequence.js";
const site = process.env.GAME_TEST_URL || "http://127.0.0.1:4173";
const out =
  process.env.GAME_ARTIFACTS ||
  "/workspace/fortmulti-artifacts/multiplayer-smooth-2026-10-15";
await mkdir(out, { recursive: true });
const started = [],
  nativeBegin = Match.prototype.beginDeployment;
Match.prototype.beginDeployment = function (...args) {
  started.push(this);
  return nativeBegin.apply(this, args);
};
const service = await createHCSServer({
  authenticate: async (id) => (id ? { id } : null),
  authorizeParty: async (id) => (id === "host" ? ["host", "guest"] : null),
  load: async () => null,
  save: async () => {},
  origins: [site],
});
await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
const backend = `http://127.0.0.1:${service.server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
  }),
  errors = [],
  checks = [],
  measurements = [];
await context.grantPermissions(["local-network-access"], { origin: site });
await context.route("https://multiplayer-test.supabase.co/**", (r) =>
  r.fulfill({ json: [] }),
);
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
async function open(id) {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ id, backend }) => {
      const NativeSocket = window.WebSocket;
      window.WebSocket = class extends NativeSocket {
        set onmessage(handler) {
          super.onmessage = (event) => {
            let snapshot = false;
            try {
              snapshot = JSON.parse(event.data).type === "snapshot";
            } catch {}
            if (!snapshot) {
              handler(event);
              return;
            }
            // Preserve TCP order while delivering snapshots in jittered batches.
            const delay =
              (this.__packetCount = (this.__packetCount || 0) + 1) % 8 === 0
                ? 220
                : 60;
            this.__due = Math.max(this.__due || 0, performance.now() + delay);
            setTimeout(
              () => handler(event),
              Math.max(0, this.__due - performance.now()),
            );
          };
        }
        constructor(...args) {
          super(...args);
          if (String(args[0]).endsWith("/stream")) window.hcsSocket = this;
        }
      };
      localStorage.setItem(
        "horizon-callsign",
        JSON.stringify({ name: "Operator " + id }),
      );
      localStorage.setItem(
        "duel-profile",
        JSON.stringify({ name: "Operator " + id, color: "408faf" }),
      );
      localStorage.setItem("sunny.graphicsQuality", "low");
      localStorage.setItem(
        "duel-config",
        JSON.stringify({
          url: "https://multiplayer-test.supabase.co",
          key: "fixture-public",
          hcsUrl: backend,
        }),
      );
      sessionStorage.setItem(
        "sunny-auth-v3",
        JSON.stringify({
          user: { id },
          access_token: id,
          refresh_token: "fixture-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    },
    { id, backend },
  );
  await page.goto(site);
  await page.waitForFunction(() => !!window.Game && !!window.HorizonHCS);
  await page.evaluate(async (id) => {
    const { Connection } = await import("/network.js"),
      nativeOpen = Connection.prototype.open,
      nativeSend = Connection.prototype.send,
      nativeRelease = Connection.prototype.release;
    Connection.prototype.open = async function (config, code, create) {
      await nativeOpen.call(this, config, code, create, true);
      this.id = id;
      this.host = create ? id : null;
      this.room = "fixture-room";
      this.session = JSON.parse(sessionStorage.getItem("sunny-auth-v3"));
      this.local = false;
      this.fixture = true;
      window.connection = this;
    };
    Connection.prototype.send = function (type, data = {}, to = null) {
      if (this.fixture && this.connected)
        this.channel.postMessage({
          type,
          data,
          from: this.id,
          ...(to ? { to } : {}),
        });
      else nativeSend.call(this, type, data, to);
    };
    Connection.prototype.release = function () {
      return this.fixture ? Promise.resolve() : nativeRelease.call(this);
    };
  }, id);
  return page;
}
let host, guest;
const until = async (fn) => {
  const end = Date.now() + 10000;
  while (!fn()) {
    assert.ok(Date.now() < end, "server gameplay timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};
async function ready() {
  const began = performance.now();
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () => window.HorizonHCS.official && !window.Duel.lobby,
        {},
        { timeout: 45000 },
      ),
    ),
  );
  return Math.round(performance.now() - began);
}
async function lobby(from = host) {
  await from.evaluate(() => window.Duel.menu());
  await from.locator("#back-lobby").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () => window.Duel.lobby && !window.HorizonHCS.active,
        {},
        { timeout: 4000 },
      ),
    ),
  );
  await host.waitForTimeout(250);
  assert.equal(await host.evaluate(() => window.Duel.lobby), true);
}
try {
  host = await open("host");
  guest = await open("guest");
  await host.locator("#create").click();
  await host.waitForFunction(() => window.connection?.connected);
  await guest.locator(".test-tools summary").first().click();
  await guest
    .locator("#code")
    .fill(await host.evaluate(() => window.connection.code));
  await guest.locator("#join").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(() =>
        document.getElementById("party-count").textContent.startsWith("2"),
      ),
    ),
  );
  await host.route(backend + "/party-start", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": site },
      body: JSON.stringify({ code: "AUTH_REQUIRED" }),
    }),
  );
  await host.locator("#ready").click();
  await guest.locator("#ready").click();
  await host.waitForFunction(
    () => document.getElementById("connection").dataset.tone === "error",
    {},
    { timeout: 45000 },
  );
  assert.match(
    await host.locator("#connection").textContent(),
    /HCS session expired or was rejected/,
    "safe HCS diagnostics must survive the lobby error filter",
  );
  checks.push("Rejected-session reason reaches the actual lobby");
  await host.unroute(backend + "/party-start");
  await guest.locator("#ready").click(); // Cancel its old ready state after the rejected host start.
  await host.locator("#mode").selectOption("town");
  const staleReady = await host.evaluate(() => {
    window.connection.onmessage({
      type: "hello",
      from: "guest",
      data: {
        name: "Operator guest",
        color: "408faf",
        ready: true,
        mapId: "island",
        mode: "build",
      },
    });
    return document
      .querySelector(".party-card:not(.host):not(.self)")
      .classList.contains("ready");
  });
  assert.equal(
    staleReady,
    false,
    "old-mode ready messages must not mark a teammate ready",
  );
  checks.push("Old-mode ready messages are rejected");
  for (const map of ["facility", "island"])
    for (const mode of ["town", "build"]) {
      await host.locator("#map-choice").selectOption(map);
      await host.locator("#mode").selectOption(mode);
      await guest.waitForFunction(
        ({ map, mode }) =>
          document.getElementById("map-choice").value === map &&
          document.getElementById("mode").value === mode,
        { map, mode },
      );
      const prepareMs = await ready();
      const match = started.at(-1);
      assert.equal(match.mode, mode);
      assert.equal(await guest.evaluate(() => window.Game.mapId()), map);
      assert.equal(
        await guest.evaluate(() =>
          document.querySelector("#game").getContext("webgl2").isContextLost(),
        ),
        false,
      );
      assert.equal(match.world.rules?.building === false, map === "facility");
      match.phase = "playing";
      const landings = [];
      for (const [i, p] of match.players.entries()) {
        const poi = match.world.pois[i % match.world.pois.length],
          landing = safeLandingPoint(
            { x: poi.x, z: poi.z },
            match.world,
            landings,
          );
        assert.ok(landing);
        landings.push(landing);
        p.p = [landing.x, landing.y, landing.z];
        p.air = "landed";
        p.deploymentState = "match_active";
        p.hp = 100;
        p.yaw = 0;
        p.slot = 1;
        p.inventory = [
          { id: p.id + ":rifle", type: "ar", ammo: 30 },
          null,
          null,
          null,
          null,
        ];
      }
      await guest.waitForFunction(() => window.Game.pose()?.air === "landed");
      await guest.keyboard.press("1");
      await until(
        () => match.players.find((p) => p.id === "guest").weapon === "ar",
      );
      await guest.evaluate(() => {
        window.__motionTrace = [];
        window.__traceMotion = true;
        const sample = () => {
          if (!window.__traceMotion) return;
          const p = window.Game.pose();
          window.__motionTrace.push({
            at: performance.now(),
            p: p.p.slice(),
            id: p.id,
            hp: p.hp,
          });
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await guest.keyboard.down("w");
      await guest.keyboard.down("ShiftLeft");
      await until(() => match.players.find((p) => p.id === "guest").sprinting);
      await guest.waitForTimeout(2000);
      await guest.evaluate(() => {
        window.previousHcsSocket = window.hcsSocket;
        window.hcsSocket.close();
      });
      await guest.waitForFunction(
        () =>
          window.hcsSocket !== window.previousHcsSocket &&
          window.hcsSocket.readyState === 1,
      );
      await until(() => match.players.find((p) => p.id === "guest").sprinting);
      assert.equal(
        match.players.find((p) => p.id === "guest").hp,
        100,
        "reconnecting must not eliminate or replace the competitor",
      );
      await guest.waitForTimeout(1500);
      await guest.keyboard.up("w");
      await guest.keyboard.up("ShiftLeft");
      await until(() => !match.players.find((p) => p.id === "guest").sprinting);
      await guest.waitForTimeout(400);
      const measurement = await guest.evaluate(
        async ({ map, mode }) => {
          window.__traceMotion = false;
          const trace = window.__motionTrace || [],
            motionJumps = trace
              .slice(1)
              .filter(
                (p, i) =>
                  p.id === trace[i].id &&
                  p.hp > 0 &&
                  Math.hypot(...p.p.map((x, k) => x - trace[i].p[k])) >
                    (14 * (p.at - trace[i].at)) / 1000 + 0.5,
              );
          let lobbyMutations = 0,
            hudMutations = 0;
          const lobby = new MutationObserver(
              (m) => (lobbyMutations += m.length),
            ),
            hud = new MutationObserver((m) => (hudMutations += m.length));
          lobby.observe(document.getElementById("lobby"), {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          hud.observe(document.getElementById("inventory"), {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          await new Promise((r) => setTimeout(r, 700));
          lobby.disconnect();
          hud.disconnect();
          return {
            map,
            mode,
            motionSamples: trace.length,
            motionJumps: motionJumps.length,
            lobbyMutations,
            hudMutations,
            canvas: window.Game.mapStatus(),
          };
        },
        { map, mode },
      );
      assert.equal(
        measurement.motionJumps,
        0,
        "jittered authoritative snapshots must not cause uncommanded position jumps",
      );
      assert.ok(
        measurement.lobbyMutations < 30,
        "hidden lobby must not rebuild on every snapshot",
      );
      measurements.push({ ...measurement, prepareMs });
      // Losing browser focus must cancel held movement/fire immediately, not
      // let the referee keep the last input until its stale-input deadline.
      await guest.keyboard.down("w");
      await guest.mouse.move(480, 270);
      await guest.mouse.down();
      await until(() => {
        const p = match.players.find((p) => p.id === "guest");
        return p.input.z === 1 && p.input.fire;
      });
      const blurredAt = performance.now();
      await guest.evaluate(() => window.dispatchEvent(new Event("blur")));
      await until(() => {
        const p = match.players.find((p) => p.id === "guest");
        return p.input.z === 0 && !p.input.fire;
      });
      assert.ok(
        performance.now() - blurredAt < 1000,
        "blur must clear held input before the stale-input deadline",
      );
      await guest.mouse.up();
      await guest.keyboard.up("w");
      await guest.keyboard.press("Tab");
      await guest.locator("#inventory-menu").waitFor({ state: "visible" });
      const a = await guest
          .locator('[data-inventory-cards] [data-inventory-slot="1"]')
          .boundingBox(),
        b = await guest
          .locator('[data-inventory-cards] [data-inventory-slot="3"]')
          .boundingBox();
      await guest.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await guest.mouse.down();
      await guest.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {
        steps: 4,
      });
      await guest.mouse.up();
      await until(
        () =>
          match.players.find((p) => p.id === "guest").inventory[2]?.id ===
          "guest:rifle",
      );
      await guest.keyboard.press("Escape");
      await guest.screenshot({ path: out + `/${map}-${mode}.png` });
      await lobby(mode === "town" ? host : guest);
      assert.ok(match.players.every((p) => p.hp > 0));
      assert.equal(
        service.championship.state.players.host.games,
        0,
        "early lobby returns must not award qualification stats",
      );
      checks.push(
        `${map}/${mode}: actual map, server gameplay, 60–220ms snapshot jitter, stream reconnect, sprint release, blur cancels movement/fire, inventory drag, ${mode === "town" ? "leader" : "guest"} lobby return and rematch`,
      );
    }
  await ready();
  await guest.evaluate(() => window.Duel.menu());
  await guest.locator("#forfeit").click();
  await guest.waitForFunction(
    () =>
      window.Duel.lobby &&
      !window.HorizonHCS.active &&
      !window.connection.connected,
  );
  checks.push("Forfeit closes both the party and HCS match client");
  await lobby(host);
  await guest
    .locator("#code")
    .fill(await host.evaluate(() => window.connection.code));
  await guest.locator("#join").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(() =>
        document.getElementById("party-count").textContent.startsWith("2"),
      ),
    ),
  );
  await ready();
  await host.evaluate(() => window.Duel.menu());
  await host.locator("#forfeit").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(
        () =>
          window.Duel.lobby &&
          !window.HorizonHCS.active &&
          !window.connection.connected,
      ),
    ),
  );
  checks.push(
    "Leader leaving closes the party on both clients; former players can rejoin and start again",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        checks,
        errors,
        measurements,
        limits: [
          "Real two-browser rendering and referee WebSockets; snapshot delivery delayed by 60–220ms in ordered batches.",
          "Ready-to-ship timings include browser automation and local rendering; they are not production load-time guarantees.",
          "Supabase presence and party transport are local fixtures; production credentials and internet latency are not tested.",
          "Gameplay positions are set by the test after verifying the ship stage; native pod entry has a separate regression test.",
          "Software rendering is not a Mac M3 performance benchmark.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2),
  );
} finally {
  await browser.close();
  await service.close();
  Match.prototype.beginDeployment = nativeBegin;
}
