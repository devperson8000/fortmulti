import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.GAME_ARTIFACTS || "/workspace/fortmulti-artifacts/test-lab";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
  ],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  errors = [];
async function open(url = "http://127.0.0.1:4173/?local=1") {
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() =>
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Mac Test Ranger" }),
    ),
  );
  await p.goto(url);
  await p.waitForFunction(() => window.Duel);
  return p;
}
async function unlock(p) {
  await p.locator("#lab-password").fill("12345");
  await p.locator("#lab-unlock").click();
  if (new URL(p.url()).searchParams.has("horizon-test-view"))
    await p.waitForFunction(() => window.HorizonTestLab.active);
  else await p.locator("#lab-tools").waitFor({ state: "visible" });
}
try {
  const p = await open();
  assert.equal(
    await p.locator("#test-lab-open").count(),
    1,
    "temporary lobby button must exist",
  );
  await p.locator("#test-lab-open").click();
  await p.locator("#lab-password").fill("wrong");
  await p.locator("#lab-unlock").click();
  assert.equal(await p.locator("#lab-tools").isVisible(), false);
  assert.match(await p.locator("#lab-lock-error").textContent(), /incorrect/i);
  await unlock(p);
  await p.locator("#lab-rules").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#lab-check-results .passed").length >= 10,
  );
  await p.screenshot({ path: out + "/test-panel-desktop.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: out + "/test-panel-phone.png" });
  const b = await p.locator("#test-lab-dialog").boundingBox();
  assert.ok(b.x >= 0 && b.x + b.width <= 391);
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.locator("#lab-map").selectOption("facility");
  await p.locator("#lab-combat").click();
  await p.waitForFunction(
    () =>
      window.HorizonTestLab.status().players === 8 &&
      !window.HorizonTestLab.waiting,
  );
  await p.waitForFunction(() => window.Game.pose().air === "landed");
  assert.equal(await p.evaluate(() => window.Duel.lobby), false);
  await p.waitForFunction(
    () => window.HorizonTestLab.report().frames.samples >= 10,
  );
  await p.screenshot({ path: out + "/eight-player-test.png" });
  if (!(await p.locator("#test-lab-dialog").isVisible())) {
    await p.keyboard.press("p");

    if (!(await p.locator("#test-lab-dialog").isVisible()))
      await p.locator("#lab-controls").click();
    await p.locator("#test-lab-dialog").waitFor({ state: "visible" });
  }
  await p.locator("#lab-kit").selectOption("variants");
  await p.locator("#lab-equip").click();
  await p.waitForFunction(
    () => window.Game.inventoryState().inventory[0]?.type === "ar_sentinel",
  );
  await p.locator("#lab-arsenal").click();
  assert.ok(
    await p.evaluate(() => window.HorizonTestLab.status().pickups >= 8),
  );
  await p.locator("#lab-stop").click();
  await p.waitForFunction(
    () => window.Duel.lobby && !window.HorizonTestLab.active,
  );
  await p.locator("#test-lab-open").click();
  await p.locator("#lab-hcs-play").click();
  await p.waitForFunction(
    () =>
      window.HorizonTestLab.status().players === 5 &&
      !window.HorizonTestLab.waiting,
  );
  assert.equal(await p.evaluate(() => window.Duel.spectating), null);
  await p.screenshot({ path: out + "/hcs-player-test.png" });
  await p.keyboard.press("p");

  if (!(await p.locator("#test-lab-dialog").isVisible()))
    await p.locator("#lab-controls").click();
  await p.locator("#test-lab-dialog").waitFor({ state: "visible" });
  const [viewer] = await Promise.all([
    context.waitForEvent("page"),
    p.locator("#lab-viewer-panel").click(),
  ]);
  viewer.on("pageerror", (e) => errors.push(e.message));
  await viewer.waitForFunction(() => window.HorizonTestLab);
  assert.equal(await viewer.locator("#lab-tools").isVisible(), false);
  await unlock(viewer);
  await viewer.waitForFunction(() => window.HorizonTestLab.active);
  assert.equal(
    await viewer.evaluate(() => window.HorizonTestLab.waiting),
    true,
  );
  await viewer.waitForFunction(
    () => !window.HorizonTestLab.waiting,
    {},
    { timeout: 90000 },
  );
  await viewer.waitForFunction(() => !!window.Duel.spectating);
  const delay = await viewer.evaluate(
    () => window.HorizonTestLab.status().delayMs,
  );
  assert.ok(delay >= 20000);
  assert.equal(await viewer.locator("#lab-target option").count(), 5);
  await viewer.locator("#lab-target").selectOption("lab-bot-2");
  await viewer.waitForFunction(() => window.Duel.spectating === "lab-bot-2");
  await viewer.screenshot({ path: out + "/hcs-delayed-spectator-test.png" });
  if (!(await p.locator("#test-lab-dialog").isVisible())) {
    await p.keyboard.press("p");

    if (!(await p.locator("#test-lab-dialog").isVisible()))
      await p.locator("#lab-controls").click();
    await p.locator("#test-lab-dialog").waitFor({ state: "visible" });
  }
  await p.locator("#lab-finish").click();
  await p.waitForFunction(
    () => window.HorizonTestLab.status().phase === "done",
  );
  assert.equal(
    await p.evaluate(() => window.HorizonTestLab.status().champion),
    null,
  );
  await viewer.waitForFunction(
    () => window.HorizonTestLab.status().champion?.id === "lab-player",
    {},
    { timeout: 90000 },
  );
  await viewer.screenshot({ path: out + "/hcs-delayed-champion-test.png" });
  const [download] = await Promise.all([
    viewer.waitForEvent("download"),
    viewer.locator("#lab-download").click(),
  ]);
  await download.saveAs(out + "/cloud-test-report.json");
  await p.locator("#lab-stop").click();
  await p.waitForFunction(
    () => window.Duel.lobby && !window.HorizonTestLab.active,
  );
  await viewer.waitForFunction(
    () => window.Duel.lobby && !window.HorizonTestLab.active,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/browser-results.json",
    JSON.stringify(
      {
        checks: [
          "password gate",
          "real HCS rule checks",
          "responsive panel",
          "eight native players",
          "variant equipment",
          "floor arsenal",
          "five-player final",
          "separate spectator window",
          "20-second delay",
          "third-person view switching",
          "delayed champion",
          "downloadable report",
          "clean lobby return",
        ],
        delayMs: delay,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Test lab browser checks passed");
} finally {
  await browser.close();
}
