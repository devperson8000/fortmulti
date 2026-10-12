import { WEAPON_TYPES } from "../public/weapon-system.js";
const weapons = process.env.GAME_WEAPONS?.split(",") || WEAPON_TYPES;
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const artifacts =
  process.env.GAME_ARTIFACTS ||
  "/workspace/fortmulti-artifacts/weapon-states-before";
await mkdir(artifacts, { recursive: true });
const errors = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/grip-lab", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: `<html><body style="margin:0;background:#172b39"><canvas id="view" width="1280" height="720"></canvas><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script></body></html>`,
  }),
);
await page.addInitScript(() =>
  localStorage.setItem("horizon-callsign", JSON.stringify({ name: "Ranger" })),
);
await page.goto(
  (process.env.GAME_TEST_URL || "http://127.0.0.1:4173") + "/grip-lab",
);
await page.evaluate(async () => {
  const [
    { MatchCharacterRenderer },
    { WEAPON_PROFILES },
    {
      createViewModelState,
      stepViewModel,
      createWeaponPartState,
      stepWeaponParts,
    },
    THREE,
  ] = await Promise.all([
    import("/match-character-renderer.js"),
    import("/weapon-system.js"),
    import("/view-model.js"),
    import("three"),
  ]);
  const canvas = document.getElementById("view"),
    gl = canvas.getContext("webgl2");
  const r = new MatchCharacterRenderer(gl, canvas);
  r.restoreRawState = () => {};
  await new Promise((resolve) => {
    const poll = () =>
      r.ready && r.weaponTemplates.size === Object.keys(WEAPON_PROFILES).length
        ? resolve()
        : setTimeout(poll, 30);
    poll();
  });
  window.__rig = r;
  window.__THREE = THREE;
  window.__utility = (id) => {
    r.renderer.setClearColor(0x172b39, 1);
    r.renderer.clear();
    r.renderFirstPersonItem(
      id,
      createViewModelState(),
      { moveSpeed: 0 },
      { width: canvas.width, height: canvas.height },
    );
  };
  window.__pose = (id, mode = "idle", progress = 1) => {
    const profile = WEAPON_PROFILES[id],
      state = createViewModelState(),
      parts = createWeaponPartState();
    for (let n = 0; n < 180; n++)
      stepViewModel(
        state,
        {
          weapon: profile,
          aiming: mode === "ads",
          moving: mode === "walking" ? 0.55 : mode === "running" ? 1 : 0,
          sprinting: mode === "running",
          grounded: true,
        },
        1 / 60,
      );
    const remaining =
      progress === 1 ? 0 : profile.reloadDuration * (1 - progress);
    stepWeaponParts(parts, profile, remaining);
    r.renderer.setClearColor(0x172b39, 1);
    r.renderer.clear();
    r.renderFirstPersonWeapon(id, profile, state, parts, {
      width: canvas.width,
      height: canvas.height,
    });
    return [...r.arms.bones]
      .filter(([n]) => n.includes("hand"))
      .map(([name, b]) => ({
        name,
        position: b.getWorldPosition(new THREE.Vector3()).toArray(),
      }));
  };
});
const captures = [];
for (const id of weapons) {
  for (const [name, mode, progress] of [
    ["idle", "idle", 1],
    ["walking", "walking", 1],
    ["running", "running", 1],
    ["ads", "ads", 1],
  ]) {
    await page.evaluate(
      ({ id, mode, progress }) => {
        for (let n = 0; n < 30; n++) window.__pose(id, mode, progress);
      },
      { id, mode, progress },
    );
    const file = `${id}-${name}.png`;
    await page.screenshot({ path: artifacts + "/" + file });
    captures.push(file);
  }
}
await browser.close();
await writeFile(
  artifacts + "/weapon-state-results.json",
  JSON.stringify({ captures, errors }, null, 2),
);
if (errors.length) throw new Error(errors.join("\n"));
console.log("All 8 weapons captured across idle, walking, running and ADS.");
