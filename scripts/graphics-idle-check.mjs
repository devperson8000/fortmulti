import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
try {
  await page.addInitScript(() => {
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Idle check" }),
    );
    window.__draws = 0;
    for (const name of ["drawArrays", "drawElements"]) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        window.__draws++;
        return original.apply(this, args);
      };
    }
  });
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.Game && window.Duel);
  await page.waitForTimeout(5000);
  await page.locator("#hcs-toggle").click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__draws = 0;
  });
  await page.waitForTimeout(1500);
  assert.equal(
    await page.evaluate(() => window.__draws),
    0,
    "opaque HCS tab must stop the hidden lobby renderers",
  );
  await page.locator("#lobby-play-toggle").click();
  await page.waitForTimeout(1000);
  assert.ok(
    (await page.evaluate(() => window.__draws)) > 0,
    "returning to Play restores rendering",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    window.__draws = 0;
  });
  await page.waitForTimeout(1500);
  assert.equal(
    await page.evaluate(() => window.__draws),
    0,
    "background tabs must stop GPU work",
  );
  await page.evaluate(() => {
    delete document.hidden;
  });
  await page.waitForTimeout(1000);
  assert.ok(
    (await page.evaluate(() => window.__draws)) > 0,
    "foreground resumes cleanly",
  );
  assert.equal(
    await page.evaluate(() =>
      document.getElementById("game").getContext("webgl2").isContextLost(),
    ),
    false,
  );
  console.log(
    "HCS panel and background tabs suspend graphics and resume cleanly",
  );
} finally {
  await browser.close();
}
