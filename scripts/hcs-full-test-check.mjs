import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.GAME_ARTIFACTS || "/workspace/fortmulti-artifacts/hcs-full-test";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  }),
  errors = [],
  checks = [];
async function setup(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "duel-profile",
      JSON.stringify({ name: "HCS Test Ranger", color: "408faf" }),
    );
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "HCS Test Ranger" }),
    );
  });
}
async function controls(p) {
  await p.keyboard.press("p");
  await p.locator("#test-lab-dialog").waitFor({ state: "visible" });
}
try {
  const p = await context.newPage();
  await setup(p);
  await p.goto("http://127.0.0.1:4173/?local=1");
  await p.waitForFunction(() => window.HorizonTestLab);
  await p.locator("#test-lab-open").click();
  await p.locator("#lab-password").fill("12345");
  await p.locator("#lab-unlock").click();
  await p.locator("#lab-full-viewer").uncheck();
  await p.locator("#lab-hcs-full").click();
  await p.waitForFunction(
    () =>
      window.HorizonTestLab.status().full && window.Game.pose().air === "ship",
  );
  assert.equal(await p.evaluate(() => window.Game.pose().pod), null);
  await p.locator("#lab-ship-briefing").waitFor({ state: "visible" });
  await p.screenshot({ path: out + "/01-hcs-ship.png" });
  await controls(p);
  await p.locator("#lab-bot-fire").uncheck();
  await p.locator("#lab-resume").click();
  const viewers = [];
  for (let i = 0; i < 2; i++) {
    // Release pointer lock using the real P menu before opening the popup.
    await controls(p);
    const popup = p.waitForEvent("popup");
    await p.locator("#lab-viewer-panel").click();
    const v = await popup;
    await setup(v);
    await v.waitForFunction(() => window.HorizonTestLab);
    await v.locator("#lab-password").fill("12345");
    await v.locator("#lab-unlock").click();
    await v.waitForFunction(() => window.HorizonTestLab.active);
    viewers.push(v);
    await p.locator("#lab-resume").click();
  }
  await p.waitForFunction(
    () => window.HorizonTestLab.status().spectators === 2,
  );
  await p.keyboard.press("e");
  await p.waitForFunction(() => !!window.Game.pose().pod);
  checks.push(
    "human presses E to board; four native bots board; two password-gated audience windows join",
  );
  await p.waitForFunction(
    () => window.Game.deploymentView().logo > 0.65,
    {},
    { timeout: 120000 },
  );
  assert.ok(
    (await p.locator("#deployment-cinematic img").getAttribute("src")) ===
      "hcs-logo.png",
  );
  assert.ok(
    await p
      .locator("#deployment-cinematic img")
      .evaluate((e) => e.complete && e.naturalWidth > 1000),
  );
  await p.screenshot({ path: out + "/02-hcs-emblem.png" });
  await p.waitForFunction(
    () =>
      window.Game.deploymentView().stage === "saluting" &&
      window.Game.pose().saluteProgress > 0.65,
    {},
    { timeout: 120000 },
  );
  await p.screenshot({ path: out + "/03-hcs-salute.png" });
  await p.waitForFunction(
    () => window.HorizonTestLab.status().phase === "playing",
    {},
    { timeout: 30000 },
  );
  assert.equal(await p.evaluate(() => window.Duel.spectating), null);
  await p.screenshot({ path: out + "/04-hcs-combat.png" });

  checks.push(
    "uploaded HCS mark uses original cue; held salute; actual five-player first-person combat",
  );
  for (const v of viewers) {
    await v.waitForFunction(
      () => !window.HorizonTestLab.waiting,
      {},
      { timeout: 90000 },
    );
    assert.ok(
      await v.evaluate(() => window.HorizonTestLab.status().delayMs >= 20000),
    );
  }
  // Exercise a native scripted local win without spoofing the delayed result.
  await controls(p);
  await p.locator("#lab-bot-fire").uncheck();
  await p.locator("#lab-finish").click();
  await p.locator("#lab-resume").click();
  await p.locator("#hcs-finale").waitFor({ state: "visible" });
  assert.equal(
    await p.locator("#hcs-finale [data-finale=title]").textContent(),
    "HCS VICTORY",
  );
  assert.equal(
    await p.locator("#hcs-finale [data-finale=name]").textContent(),
    "HCS Test Ranger",
  );
  assert.equal(await viewers[0].locator("#hcs-finale").isVisible(), false);
  await p.screenshot({ path: out + "/05-hcs-victory.png" });
  for (const v of viewers) {
    await v.waitForFunction(
      () => window.HorizonTestLab.status().phase === "done",
      {},
      { timeout: 90000 },
    );
    assert.equal(
      await v.locator("#hcs-finale [data-finale=title]").textContent(),
      "CHAMPION CROWNED",
    );
    assert.ok(
      await v.evaluate(() => window.HorizonTestLab.status().delayMs >= 20000),
    );
  }
  await viewers[0].screenshot({ path: out + "/06-delayed-champion.png" });
  checks.push(
    "winner gets HCS VICTORY; two audiences receive the result only after the real 20-second delay",
  );
  await p.locator("#hcs-finale [data-finale=controls]").click();
  const download = p.waitForEvent("download");
  await p.locator("#lab-download-panel").click();
  await (await download).saveAs(out + "/machine-report.json");
  await p.locator("#lab-stop").click();
  await p.waitForFunction(() => window.Duel.lobby);
  for (const v of viewers)
    await v.waitForFunction(
      () => window.Duel.lobby && !window.HorizonTestLab.active,
    );
  // Standard pod tests must retain their existing Horizon mark.
  await p.locator("#test-lab-open").click();
  await p.locator("#lab-pods").click();
  await p.waitForFunction(
    () => window.HorizonTestLab.active && window.Game.pose().pod,
  );
  await p.waitForFunction(
    () =>
      document
        .querySelector("#deployment-cinematic img")
        .getAttribute("src") === "horizon-logo-transparent.webp",
  );
  checks.push(
    "exit restores host and both viewers; ordinary deployment retains Horizon branding",
  );
  await controls(p);
  await p.locator("#lab-stop").click();
  await p.locator("#test-lab-open").click();
  await p.locator("#lab-full-viewer").check();
  const automaticPopup = p.waitForEvent("popup");
  await p.locator("#lab-hcs-full").click();
  const audience = await automaticPopup;
  await setup(audience);
  await audience.waitForFunction(() => window.HorizonTestLab);
  await audience.locator("#lab-password").fill("12345");
  await audience.locator("#lab-unlock").click();
  await audience.waitForFunction(() => window.HorizonTestLab.active);
  await p.waitForFunction(
    () => window.HorizonTestLab.status().spectators === 1,
  );
  await p.bringToFront();
  await p.waitForFunction(
    () => window.Game.pose().air === "ship" && window.Game.pose().pod === null,
  );
  assert.ok(
    (await p.evaluate(() => window.HorizonTestLab.report().ruleChecks)).every(
      (r) => r.passed,
    ),
  );
  checks.push(
    "full test automatically opens its password-gated audience and runs the HCS rule checks",
  );

  assert.deepEqual(errors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log("Full HCS browser checks passed");
} catch (e) {
  for (const page of context.pages()) {
    if (page.url().includes("4173")) {
      await page
        .screenshot({
          path:
            out +
            "/failure-" +
            (new URL(page.url()).searchParams.has("horizon-test-view")
              ? "viewer"
              : "host") +
            ".png",
        })
        .catch(() => {});
      await writeFile(
        out + "/failure-state.json",
        JSON.stringify(
          await page
            .evaluate(() => ({
              status: window.HorizonTestLab?.status(),
              pose: window.Game?.pose(),
            }))
            .catch(() => ({})),
          null,
          2,
        ),
      );
    }
  }
  await writeFile(out + "/failure.txt", String(e.stack));
  throw e;
} finally {
  await browser.close();
}
