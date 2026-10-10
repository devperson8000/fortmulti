import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out =
  process.env.GAME_ARTIFACTS || "/workspace/fortmulti-artifacts/compact-hud";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
// This is a layout regression test of the real HTML and CSS; no GPU is needed.
await page.route("**/*.js", (r) => r.abort());
const results = [];
try {
  await page.goto("http://127.0.0.1:4173/");
  for (const size of [
    { width: 854, height: 480 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(size);
    for (const { gunfight, hcs } of [
      { gunfight: false, hcs: false },
      { gunfight: true, hcs: false },
      { gunfight: true, hcs: true },
    ]) {
      await page.evaluate(
        ({ gunfight, hcs }) => {
          document.body.className =
            (gunfight ? "gunfight-map " : "") + (hcs ? "hcs-match" : "");
          document.getElementById("hcs-broadcast").hidden = !hcs;
          document.getElementById("hcs-broadcast-label").textContent =
            "20 SECOND DELAY";
          document.getElementById("hcs-watch-stats").textContent =
            "100 HP · 4 KILLS · 5 LEFT";
          document.getElementById("lobby").hidden = true;
          document.getElementById("overlay").style.display = "none";
          document.getElementById("nickname-gate")?.remove();
          document.getElementById("weaponlabel").textContent =
            "BREACHER AUTO SHOTGUN";
          document.getElementById("ammotext").textContent = "19";
          document.getElementById("ammocap").textContent = "/30";
          for (const button of document.querySelectorAll(
            ".weapon-slots button",
          ))
            button.querySelector("small").textContent = "SENTINEL";
        },
        { gunfight, hcs },
      );
      const bounds = await page.evaluate(() => {
        const rect = (id) => {
          const r = document.querySelector(id).getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        return {
          map: rect("#mapbox"),
          ammo: rect(".ammo"),
          inventory: rect("#inventory"),
          health: rect("#health"),
          broadcast: rect("#hcs-broadcast"),
          chat: rect("#chatbox"),
          footer:
            getComputedStyle(document.querySelector("footer")).display ===
            "none"
              ? null
              : rect("footer"),
          slot: rect(".weapon-slots button"),
          slotLabel:
            getComputedStyle(
              document.querySelector(".weapon-slots button small"),
            ).display === "none"
              ? null
              : rect(".weapon-slots button small"),
        };
      });
      results.push({ size, gunfight, hcs, ...bounds });
      await page.screenshot({
        path: `${out}/hud-${size.width}-${size.height}-${hcs ? "hcs" : gunfight ? "guns" : "build"}.png`,
      });
      const overlap = (a, b) =>
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom;
      if (bounds.slotLabel)
        assert.ok(
          bounds.slotLabel.bottom <= bounds.slot.bottom - 2,
          "weapon slot label must not be clipped",
        );
      if (bounds.footer)
        assert.equal(
          overlap(bounds.footer, bounds.chat),
          false,
          "control instructions must not be hidden behind chat",
        );
      assert.equal(
        overlap(bounds.map, bounds.ammo),
        false,
        `minimap/ammo overlap at ${size.width}x${size.height}`,
      );
      assert.equal(
        overlap(bounds.inventory, bounds.health),
        false,
        `inventory/health overlap at ${size.width}x${size.height}`,
      );
      if (hcs)
        for (const name of ["inventory", "health", "ammo"])
          assert.equal(
            overlap(bounds.broadcast, bounds[name]),
            false,
            `HCS controls/${name} overlap at ${size.width}x${size.height}`,
          );
      assert.ok(
        bounds.map.right <= size.width && bounds.inventory.right <= size.width,
        "HUD stays within viewport",
      );
    }
  }
  console.log("Compact and desktop HUD bounds verified");
} finally {
  await writeFile(`${out}/layout.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
