import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.GAME_ARTIFACTS ||
  "/workspace/fortmulti-artifacts/hcs-pickup-2026-10-12";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    window.__musicStarts = [];
    window.__musicStops = [];
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...args) {
      if (this.buffer?.duration === 30) window.__musicStops.push(args);
      return stop.apply(this, args);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.duration === 30) window.__musicStarts.push(args);
      return start.apply(this, args);
    };
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Champion Review" }),
    );
    localStorage.setItem(
      "duel-profile",
      JSON.stringify({ name: "Champion Review", color: "408faf" }),
    );
  });
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.HorizonTestLab);
  await page.evaluate(async () => {
    await window.Game.setMap("facility");
    window.Game.clear({ resetInventory: true });
    window.Duel.lobby = false;
    document.getElementById("lobby").hidden = true;
    document.body.classList.remove("in-lobby", "menu");
    const { createHCSCelebration, hcsHeroState } =
      await import("/hcs-presentation.js");
    window.__celebration = createHCSCelebration({
      id: "hcs-review-finale",
      clock: () => 0,
      onExit: () => {
        window.__celebration.reset();
        window.Duel.render = () => {};
        window.Duel.lobby = true;
      },
    });
    const { FinalMatch, Referee } = await import("/hcs-referee-core.js");
    const m = new FinalMatch(window.Game.world, ["review", "b", "c", "d", "e"]),
      r = new Referee(m, false);
    m.phase = "playing";
    m.players[0].air = "landed";
    m.players[0].p = [-35, 1.5, 17];
    m.players.slice(1).forEach((p) => (p.hp = 0));
    m.checkRoundEnd();
    window.__state = r.tick(1 / 30, 1000);
    window.__state.victoryElapsed = 0;
    window.Duel.render = (dt) => {
      const result = window.__celebration.update(
        window.__state,
        [{ id: "review", name: "Champion Review" }],
        "review",
        { testOnly: true },
      );
      window.Game.apply(
        hcsHeroState(window.__state, result?.cinematic),
        "review",
        { review: "408faf" },
        dt,
      );
      window.Duel.spectating = "review";
    };
    window.__renderFixture = window.Duel.render;
  });
  for (const [stage, filename, at] of [
    ["pickup", "01-rescue-arrival", 0.3],
    ["landed", "02-pod-landed", 2.65],
    ["boarding", "03-walk-in", 4.3],
    ["launch", "04-boost", 6.8],
    ["launch", "05-black-transit", 7.7],
    ["docking", "06-ship-docking", 10.5],
    ["opening", "07-doors-open", 11.25],
    ["exit", "08-walk-out", 12.1],
    ["salute", "09-salute", 13.5],
  ]) {
    await page.evaluate((at) => (window.__state.victoryElapsed = at), at);
    await page.waitForFunction(
      (stage) => window.Game.victoryView()?.stage === stage,
      stage,
      { timeout: 30000 },
    );
    const v = await page.evaluate(() => ({
      frame: window.Game.victoryView(),
      pose: window.Game.pose(),
      view: document.body.dataset.camera,
    }));
    assert.equal(v.pose.weapon, null);
    assert.equal(v.pose.slot, 0);
    if (["launch", "docking"].includes(stage))
      assert.equal(v.frame.actorVisible, 0);
    await page.screenshot({ path: out + "/" + filename + ".png" });
    checks.push({
      stage,
      time: v.frame.time,
      actorVisible: v.frame.actorVisible,
      weapon: v.pose.weapon,
    });
  }
  await page.evaluate(() => (window.__state.victoryElapsed = 18));
  await page.locator("#hcs-review-finale").waitFor({ state: "visible" });
  await page.screenshot({ path: out + "/10-champion.png" });
  assert.equal(
    await page.locator("#hcs-review-finale [data-finale=title]").textContent(),
    "HCS VICTORY",
  );
  await page.locator("#hcs-review-finale [data-finale=exit]").click();
  await page.waitForFunction(() => window.Duel.lobby);
  assert.equal(await page.evaluate(() => window.Game.victoryView()), null);
  // A late winning snapshot may already have started the excerpt when
  // the controller clears input. That clear must not cancel or restart it.
  await page.evaluate(async () => {
    await window.Game.startAudio();
    window.Duel.lobby = false;
    window.__state.victoryElapsed = 8.8;
    window.Duel.render = window.__renderFixture;
  });
  await page.waitForFunction(
    () =>
      window.__musicStarts.length === 1 &&
      window.Game.victoryView()?.time >= 8.8,
  );
  const before = await page.evaluate(() => {
    const t = window.Game.victoryView().time;
    window.Game.clear();
    return t;
  });
  await page.waitForFunction(
    (before) => window.Game.victoryView()?.time > before + 0.1,
    before,
  );
  assert.equal(
    await page.evaluate(() => window.__musicStarts.length),
    1,
    "input cleanup restarted the winning excerpt",
  );
  await page.evaluate(() => {
    window.Duel.render = () => {};
    window.__celebration.reset();
    window.Game.clear({ resetInventory: true });
    window.Duel.lobby = true;
  });
  assert.equal(
    await page.evaluate(() => window.__musicStops.length),
    2,
    "lobby exit must cancel the scheduled song tail",
  );
  checks.push({
    audio:
      "late result seeks into the verse; clearing inputs preserves one playing voice; lobby exit cancels it",
  });
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log("HCS victory launch, return, salute and cleanup passed");
} catch (e) {
  await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  await writeFile(
    out + "/failure.json",
    JSON.stringify(
      {
        error: e.stack,
        view: await page
          .evaluate(() => window.Game?.victoryView())
          .catch(() => null),
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
