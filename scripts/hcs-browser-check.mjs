import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const out = process.env.GAME_ARTIFACTS || "/workspace/fortmulti-artifacts/hcs";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(
    process.env.GAME_TEST_URL || "http://127.0.0.1:4173/?local=1",
  );
  await page.locator("#nickname-gate").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => !!window.Duel), false);
  await page.locator("#nickname-input").fill("Field Ranger");
  await page.locator("#nickname-form button").click();
  await page.waitForFunction(() => !!window.Duel && !!window.HorizonHCS);
  assert.equal(await page.locator("#name").inputValue(), "Field Ranger");
  await page.locator("#hcs-toggle").click();
  assert.equal(await page.locator("#hcs-panel").isVisible(), true);
  assert.equal(
    await page.locator("#hcs-toggle").getAttribute("aria-pressed"),
    "true",
  );
  assert.match(
    await page.locator("#hcs-service").textContent(),
    /not connected/,
  );
  assert.equal(await page.locator("#hcs-ranks tr").count(), 0);
  const before = await page.locator("#hcs-countdown").textContent();
  await page.waitForFunction(value => document.querySelector("#hcs-countdown").textContent !== value, before, { timeout: 10000 });
  assert.notEqual(await page.locator("#hcs-countdown").textContent(), before);
  await page.screenshot({ path: out + "/hcs-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: out + "/hcs-phone.png" });
  const panel = await page.locator("#hcs-panel").boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 390);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.locator("#character-preview-toggle").click();
  assert.equal(await page.locator("#hcs-panel").isVisible(), false);
  assert.equal(await page.evaluate(() => window.Duel.characterPreview), true);
  await page.locator("#lobby-play-toggle").click();
  assert.equal(
    await page.evaluate(() => document.body.classList.contains("hcs-open")),
    false,
  );
  await page.reload();
  await page.waitForFunction(() => !!window.Duel);
  assert.equal(await page.locator("#nickname-gate").isVisible(), false);
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/browser-results.json",
    JSON.stringify(
      {
        checks: [
          "first-visit nickname gate",
          "remembered nickname",
          "isolated HCS and character tabs",
          "always ticking Sydney countdown",
          "honest offline standings",
          "desktop and phone layout",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("HCS browser checks passed");
} finally {
  await browser.close();
}
