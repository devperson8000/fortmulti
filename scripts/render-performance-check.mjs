import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { officialWorld } from "../server/hcs-world.mjs";
import { Match } from "../public/simulation.js";
const out =
  process.env.GAME_ARTIFACTS ||
  "/workspace/fortmulti-artifacts/render-performance";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
  errors = [],
  results = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.addInitScript(() => {
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Performance check" }),
    );
    localStorage.setItem("sunny.graphicsQuality", "medium");
  });
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.Game && window.Duel);
  await page.evaluate(async () => {
    const { MatchCharacterRenderer } =
      await import("/match-character-renderer.js");
    window.__cost = {};
    for (const name of ["update", "render", "renderFirstPersonWeapon"]) {
      const original = MatchCharacterRenderer.prototype[name];
      MatchCharacterRenderer.prototype[name] = function (...args) {
        const start = performance.now();
        const result = original.apply(this, args);
        const value = (window.__cost[name] ??= { total: 0, calls: 0 });
        value.total += performance.now() - start;
        value.calls++;
        return result;
      };
    }
    window.__frames = [];
    let last = performance.now();
    function sample(now) {
      window.__frames.push(now - last);
      last = now;
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  for (const map of (process.env.REVIEW_MAPS || "facility,island").split(",")) {
    const world = await officialWorld(map),
      match = new Match(
        world,
        Array.from({ length: 8 }, (_, i) => "actor" + i),
        map === "facility" ? "town" : "build",
      );
    match.phase = "playing";
    for (const [i, p] of match.players.entries()) {
      const x = map === "facility" ? -35 : 0,
        z = map === "facility" ? 19 : 0;
      const px = x + (i ? ((i % 3) - 1) * 3 : 0),
        pz = z + (i ? 5 + i * 2 : 0);
      Object.assign(p, {
        p: [px, world.height(px, pz), pz],
        air: "landed",
        deploymentState: "match_active",
        slot: 1,
        weapon: "ar",
        equip: 0,
      });
      p.inventory = [
        { id: p.id + ":ar", type: "ar", ammo: 30 },
        null,
        null,
        null,
        null,
      ];
    }
    await page.evaluate(
      async ({ map, snapshot }) => {
        clearInterval(window.__apply);
        await window.Game.setMap(map);
        window.Duel.lobby = false;
        document.getElementById("lobby").hidden = true;
        document.body.classList.remove("menu", "in-lobby");
        window.Game.look(0, -0.03);
        window.__apply = setInterval(
          () => window.Game.apply(snapshot, "actor0", {}, 0.033),
          33,
        );
      },
      { map, snapshot: match.snapshot() },
    );
    await page.waitForTimeout(2500);
    const session = await page.context().newCDPSession(page);
    await session.send("Profiler.enable");
    await session.send("Profiler.start");
    await page.evaluate(() => {
      window.__frames = [];
      window.__cost = {};
    });
    await page.waitForTimeout(6000);
    const { profile } = await session.send("Profiler.stop");
    await session.detach();
    const counts = new Map();
    for (const id of profile.samples || [])
      counts.set(id, (counts.get(id) || 0) + 1);
    const hot = profile.nodes
      .map((node) => ({
        name: node.callFrame.functionName,
        url: node.callFrame.url,
        samples: counts.get(node.id) || 0,
      }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 15);
    const result = await page.evaluate(() => {
      const frames = window.__frames.slice(1).sort((a, b) => a - b),
        canvas = document.getElementById("game"),
        gl = canvas.getContext("webgl2");
      return {
        samples: frames.length,
        p50ms: frames[Math.floor(frames.length * 0.5)],
        p95ms: frames[Math.floor(frames.length * 0.95)],
        cost: window.__cost,
        contextLost: gl.isContextLost(),
        status: window.Game.mapStatus(),
        pixels: [canvas.width, canvas.height],
      };
    });
    assert.ok(result.samples > 5);
    assert.equal(result.contextLost, false);
    results.push({
      map,
      players: 8,
      renderedBrowsers: 1,
      quality: "medium",
      ...result,
      hot,
    });
    await page.screenshot({ path: `${out}/${map}-medium.png` });
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      results.map(({ map, p50ms, p95ms, cost }) => ({
        map,
        p50ms,
        p95ms,
        cost,
      })),
      null,
      2,
    ),
  );
} finally {
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ errors, results }, null, 2),
  );
  await browser.close();
}
