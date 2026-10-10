import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const out = "docs/reviews/hcs-2026-10-10";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const maps = (process.env.REVIEW_MAPS || "facility,island").split(",");
const context = await browser.newContext({
    viewport: { width: 854, height: 480 },
  }),
  pages = [],
  errors = [],
  rendererErrors = [],
  results = [];
async function open(index) {
  const page = await context.newPage();
  pages.push(page);
  page.on("pageerror", (e) => errors.push({ client: index, error: e.message }));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /WebGL|GL_INVALID|shader|geometry/i.test(m.text())
    )
      rendererErrors.push({ client: index, error: m.text() });
  });
  await page.addInitScript((index) => {
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Review " + index }),
    );
    localStorage.setItem(
      "duel-profile",
      JSON.stringify({
        name: "Review " + index,
        color: ["557959", "408faf", "937445", "75637d"][index % 4],
      }),
    );
    localStorage.setItem("sunny.graphicsQuality", "low");
    window.__audio = [];
    const originalAudio = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__audio.push({
        duration: this.buffer?.duration,
        rate: this.playbackRate.value,
      });
      return originalAudio.apply(this, args);
    };
    window.__stages = [];
    let previous = "";
    setInterval(() => {
      if (!window.Game || !window.Duel) return;
      const view = window.Game.deploymentView(),
        key = String(view.stage) + ":" + window.Duel.lobby;
      if (key !== previous) {
        window.__stages.push({
          stage: view.stage,
          elapsed: view.sequenceElapsed,
          air: window.Game.pose().air,
          lobby: window.Duel.lobby,
          at: performance.now(),
        });
        previous = key;
      }
    }, 50);
    window.__frames = [];
    let last = performance.now();
    function sample(now) {
      if (
        window.Duel &&
        !window.Duel.lobby &&
        window.Game?.pose().air === "landed"
      )
        window.__frames.push(now - last);
      last = now;
      if (window.__frames.length > 2000) window.__frames.shift();
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, index);
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.Game && window.Duel);
  await page.evaluate(async () => {
    const { Connection } = await import("/network.js");
    const original = Connection.prototype.open;
    Connection.prototype.open = async function (...a) {
      await original.apply(this, a);
      window.__conn = this;
    };
    const { Match } = await import("/simulation.js");
    const begin = Match.prototype.beginDeployment;
    Match.prototype.beginDeployment = function (...a) {
      const r = begin.apply(this, a);
      window.__match = this;
      return r;
    };
  });
  return page;
}
try {
  const host = await open(1);
  await host.locator("#create").click();
  await host.waitForFunction(() => window.__conn?.connected);
  const code = await host.evaluate(() => window.__conn.code);
  for (let i = 2; i <= 8; i++) {
    const page = await open(i);
    await page.locator(".test-tools summary").first().click();
    await page.locator("#code").fill(code);
    await page.locator("#join").click();
  }
  await host.waitForFunction(
    () => window.Duel.party.length === 8,
    {},
    { timeout: 60000 },
  );
  await host.screenshot({ path: out + "/normal-eight-player-lobby.png" });
  for (const map of maps) {
    await host.locator("#map-choice").selectOption(map);
    for (const page of pages)
      await page.waitForFunction(
        (map) => document.getElementById("map-choice").value === map,
        map,
      );
    await host
      .locator("#mode")
      .selectOption(map === "facility" ? "town" : "build");
    for (const page of pages) await page.locator("#ready").click();
    await host.waitForFunction(
      () => window.__match?.phase === "deployment",
      {},
      { timeout: 90000 },
    );
    const board = await host.evaluate(async (map) => {
      const m = window.__match,
        { SHIP_PODS, shipWorld } = await import("/deployment-ship.js");
      const pois =
        map === "facility"
          ? (await import("/platform23-map.js")).PLATFORM_POIS
          : [
              { x: -160, z: -100 },
              { x: 0, z: -180 },
              { x: 160, z: -100 },
              { x: -170, z: 80 },
              { x: 170, z: 80 },
              { x: -80, z: 170 },
              { x: 80, z: 170 },
              { x: 0, z: 0 },
            ];
      return m.players.map((p, i) => {
        const pod = SHIP_PODS[i],
          chosen = m.chooseLanding(p.id, pois[i]);
        p.shipLocal = [pod.x, 0, pod.z + pod.entryOffset];
        p.p = shipWorld(p.shipLocal);
        return {
          id: p.id,
          chosen,
          boarded: m.enterPod(p.id),
          destination: p.destination,
        };
      });
    }, map);
    assert.equal(board.length, 8);
    assert.ok(board.every((p) => p.chosen && p.boarded));
    await host.waitForFunction(
      () =>
        ["pod_opening", "exiting", "saluting", "match_active"].includes(
          window.Game.deploymentView().stage,
        ),
      {},
      { timeout: 150000 },
    );
    await host.screenshot({
      path: out + "/normal-" + map + "-pod-landing.png",
    });
    await host.waitForFunction(
      () => window.Game.deploymentView().stage === "match_active",
      {},
      { timeout: 150000 },
    );
    await host.evaluate(() => {
      window.__frames = [];
    });
    for (const page of pages.slice(1))
      await page.evaluate(() => {
        window.__frames = [];
      });
    // Test-only loadout fixture exercises existing models; this does not alter product loot.
    await host.evaluate(() => {
      for (const p of window.__match.players) {
        p.inventory = ["ar", "shotgun", "smg", "sniper", "ar_sentinel"].map(
          (type, i) => ({
            id: p.id + ":review:" + i,
            type,
            ammo: type === "shotgun" ? 6 : type === "sniper" ? 5 : 30,
          }),
        );
        p.inventoryRevision++;
        p.slot = 1;
      }
    });
    const guest = pages[1];
    await guest.evaluate(() => window.Game.startAudio());
    await guest.waitForFunction(
      () => window.Game.inventoryState().inventory.filter(Boolean).length === 5,
    );
    for (const [key, label] of [
      ["1", "ar"],
      ["2", "shotgun"],
      ["3", "smg"],
      ["4", "sniper"],
      ["5", "sentinel"],
    ]) {
      await guest.keyboard.press(key);
      await guest.waitForTimeout(650);
      await guest.screenshot({
        path: out + "/normal-" + map + "-" + label + ".png",
      });
    }
    await guest.keyboard.press("4");
    await guest.mouse.move(430, 220);
    await guest.mouse.down({ button: "right" });
    await guest.waitForFunction(
      () => document.body.classList.contains("scoped"),
      {},
      { timeout: 30000 },
    );
    await guest.screenshot({
      path: out + "/normal-" + map + "-sniper-scope.png",
    });
    await guest.mouse.up({ button: "right" });
    await guest.keyboard.press("1");
    await guest.keyboard.down("Shift");
    await guest.keyboard.down("w");
    await guest.waitForTimeout(800);
    await guest.keyboard.press("Control");
    await guest.waitForTimeout(350);
    await guest.keyboard.up("w");
    await guest.keyboard.up("Shift");
    await guest.mouse.move(430, 220);
    await guest.mouse.down();
    await guest.waitForTimeout(600);
    await guest.mouse.up();
    await guest.keyboard.press("r");
    await guest.waitForTimeout(2500);
    await guest.screenshot({ path: out + "/normal-" + map + "-combat.png" });
    const state = await host.evaluate(() => ({
      phase: window.__match.phase,
      players: window.__match.players.map((p) => ({
        id: p.id,
        p: p.p,
        air: p.air,
        hp: p.hp,
        slot: p.slot,
        weapon: p.weapon,
        destination: p.destination,
      })),
      events: window.__match.events.slice(-20),
    }));
    const frames = [];
    for (const [index, page] of pages.entries()) {
      const v = await page.evaluate(() => window.__frames.slice());
      v.sort((a, b) => a - b);
      frames.push({
        client: index + 1,
        samples: v.length,
        medianMs: v[Math.floor(v.length * 0.5)] || null,
        p95Ms: v[Math.floor(v.length * 0.95)] || null,
        maxMs: v.at(-1) || null,
      });
    }
    results.push({
      map,
      players: 8,
      renderedClients: 8,
      boarding: board,
      state,
      frames,
      audio: await guest.evaluate(() => window.__audio),
      stages: await host.evaluate(() => window.__stages),
    });
    await writeFile(
      out +
        (process.env.REVIEW_MAPS
          ? "/normal-outdoor-recheck.json"
          : "/normal-max-results.json"),
      JSON.stringify(
        {
          renderer: "Chromium SwiftShader software",
          transport: "local BroadcastChannel (not public internet)",
          results,
          errors,
          rendererErrors,
        },
        null,
        2,
      ),
    );
    if (map !== maps.at(-1)) {
      await host.keyboard.press("Escape");
      await host.locator("#back-lobby").click();
      await host.waitForFunction(() => window.Duel.lobby);
      for (const page of pages)
        await page.waitForFunction(
          () => window.Duel.lobby,
          {},
          { timeout: 60000 },
        );
      await host.evaluate(() => {
        window.__match = null;
      });
    }
  }
  console.log(
    "Eight-player normal review completed",
    JSON.stringify({ errors, rendererErrors }),
  );
} catch (error) {
  const diagnostics = [];
  for (const page of pages) {
    try {
      diagnostics.push(
        await page.evaluate(() => ({
          stages: window.__stages,
          view: window.Game.deploymentView(),
          pose: window.Game.pose(),
          phase: window.__match?.phase,
          events: window.__match?.events.slice(-30),
        })),
      );
    } catch {}
  }
  await writeFile(
    out + "/normal-failure-diagnostics.json",
    JSON.stringify({ error: error.message, diagnostics }, null, 2),
  );
  await pages[0]
    ?.screenshot({ path: out + "/normal-failure.png" })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
