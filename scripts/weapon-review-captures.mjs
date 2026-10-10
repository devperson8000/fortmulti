import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { officialWorld } from "../server/hcs-world.mjs";
import { Match } from "../public/simulation.js";
import { WEAPON_PROFILES } from "../public/weapon-system.js";
const world = await officialWorld("facility"),
  match = new Match(world, ["review"], "town");
match.phase = "playing";
const actor = match.players[0];
Object.assign(actor, {
  p: [-35, 1.5, 19],
  air: "landed",
  deploymentState: "match_active",
  slot: 1,
  hp: 100,
  shield: 0,
  yaw: 0,
  pitch: 0,
});
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    localStorage.setItem(
      "horizon-callsign",
      JSON.stringify({ name: "Weapon review" }),
    );
    localStorage.setItem("sunny.graphicsQuality", "medium");
  });
  await page.goto("http://127.0.0.1:4173/?local=1");
  await page.waitForFunction(() => window.Game && window.Duel);
  await page.evaluate(async () => {
    await window.Game.setMap("facility");
    window.Duel.lobby = false;
    document.getElementById("lobby").hidden = true;
    document.body.classList.remove("in-lobby", "menu");
    window.Game.look(0, -0.03);
  });
  for (const [type, profile] of Object.entries(WEAPON_PROFILES)) {
    actor.inventory = [
      { id: "review:" + type, type, ammo: profile.magazineCapacity },
      null,
      null,
      null,
      null,
    ];
    actor.weapon = type;
    actor.equip = 0;
    actor.inventoryRevision++;
    const snapshot = match.snapshot();
    await page.evaluate((snapshot) => {
      window.__captureSnapshot = snapshot;
      clearInterval(window.__applyCapture);
      window.__applyCapture = setInterval(
        () =>
          window.Game.apply(
            window.__captureSnapshot,
            "review",
            { review: "557959" },
            0.05,
          ),
        50,
      );
    }, snapshot);
    await page.waitForTimeout(900);
    await page.screenshot({
      path: "docs/reviews/hcs-2026-10-10/weapon-" + type + ".png",
    });
  }
  await writeFile(
    "docs/reviews/hcs-2026-10-10/weapon-capture-results.json",
    JSON.stringify(
      {
        fixture:
          "Single rendered client with controlled native snapshots for all weapon families and variants, correct magazine capacities; supplements multi-client live tests",
        profiles: Object.keys(WEAPON_PROFILES),
        errors,
      },
      null,
      2,
    ),
  );
  console.log("All eight weapon captures completed", errors);
} finally {
  await browser.close();
}
