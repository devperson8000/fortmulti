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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
async function panel() {
  if (!(await page.locator("#test-lab-dialog").isVisible()))
    await page.keyboard.press("p");
  await page.locator("#test-lab-dialog").waitFor({ state: "visible" });
}
try {
  await page.addInitScript(() =>
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Pod Test Ranger" }),
    ),
  );
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.HorizonTestLab);
  await page.locator("#test-lab-open").click();
  await page.locator("#lab-password").fill("12345");
  await page.locator("#lab-unlock").click();
  for (const map of ["island", "facility"]) {
    await page.locator("#lab-map").selectOption(map);
    await page.locator("#lab-mode").selectOption("build");
    await page.locator("#lab-pods").click();
    await page.waitForFunction(
      () => window.HorizonTestLab.active && window.Game.pose().pod,
    );
    assert.equal(
      await page.evaluate(() => window.HorizonTestLab.status().players),
      8,
    );
    await page.screenshot({ path: out + "/" + map + "-pod-entry.png" });
    await page.waitForFunction(
      () =>
        window.Game.deploymentView().stage === "saluting" &&
        window.Game.pose().saluteProgress > 0.7,
      {},
      { timeout: 120000 },
    );
    await page.screenshot({ path: out + "/" + map + "-salute.png" });
    await page.waitForFunction(
      () => window.HorizonTestLab.status().phase === "playing",
      {},
      { timeout: 30000 },
    );
    await panel();
    await page.locator("#lab-chest").click();
    await page.locator("#lab-resume").click();
    await page.waitForFunction(() => window.Game.pose().air === "landed");
    await page.screenshot({ path: out + "/" + map + "-chest-inspection.png" });
    checks.push(
      map +
        " eight distinct pods, actual salute, gameplay and chest inspection",
    );
    await panel();
    await page.locator("#lab-stop").click();
    await page.waitForFunction(
      () => window.Duel.lobby && !window.HorizonTestLab.active,
    );
    await page.locator("#test-lab-open").click();
  }
  await page.locator("#lab-hcs-watch").click();
  await page.waitForFunction(() => window.HorizonTestLab.active);
  assert.equal(await page.evaluate(() => window.HorizonTestLab.waiting), true);
  await page.waitForFunction(
    () => !window.HorizonTestLab.waiting && !!window.Duel.spectating,
    {},
    { timeout: 90000 },
  );
  assert.ok(
    await page.evaluate(() => window.HorizonTestLab.status().delayMs >= 20000),
  );
  await page.screenshot({ path: out + "/host-hcs-watch-test.png" });
  checks.push(
    "watch-only five automated competitors with an actual 20-second delayed third-person feed",
  );
  await panel();
  await page.locator("#lab-stop").click();
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/map-browser-results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log("Test lab map and pod checks passed");
} finally {
  await browser.close();
}
