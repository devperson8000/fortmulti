import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out =
  process.env.GAME_ARTIFACTS ||
  "/workspace/fortmulti-artifacts/full-hand-salute";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  }),
  page = await browser.newPage({ viewport: { width: 1100, height: 850 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/salute-lab", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0"><canvas id="view" width="1100" height="850"></canvas><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>',
    }),
  );
  await page.goto(
    (process.env.GAME_TEST_URL || "http://127.0.0.1:4173") + "/salute-lab",
  );
  await page.evaluate(async () => {
    const [{ MatchCharacterRenderer }, T] = await Promise.all([
      import("/match-character-renderer.js"),
      import("three"),
    ]);
    const canvas = document.getElementById("view"),
      r = new MatchCharacterRenderer(canvas.getContext("webgl2"), canvas);
    r.restoreRawState = () => {};
    await new Promise((resolve) => {
      const check = () => (r.ready ? resolve() : setTimeout(check, 25));
      check();
    });
    window.__salute = (amount, yaw, close) => {
      const p = {
        id: "salute",
        p: [0, 0, 0],
        hp: 100,
        slot: 0,
        inventory: [null, null, null, null, null],
        air: "landed",
        grounded: true,
        allowPickaxe: false,
        yaw,
        saluteProgress: amount,
      };
      for (let i = 0; i < 45; i++) r.update([p], { dt: 1 / 60 });
      const instance = r.instances.get("salute"),
        hand = instance.bones.get("mixamorigrighthand");
      instance.holder.updateMatrixWorld(true);
      const center = hand
          .getWorldPosition(new T.Vector3())
          .add(
            new T.Vector3(0, 0.1, 0).applyQuaternion(
              hand.getWorldQuaternion(new T.Quaternion()),
            ),
          ),
        front = new T.Vector3(0, 0, -1).applyQuaternion(
          instance.holder.getWorldQuaternion(new T.Quaternion()),
        ),
        right = new T.Vector3(1, 0, 0).applyQuaternion(
          instance.holder.getWorldQuaternion(new T.Quaternion()),
        );
      const eye = close
          ? center
              .clone()
              .addScaledVector(front, 0.7)
              .addScaledVector(right, 0.08)
          : new T.Vector3(0, 1.2, 0)
              .addScaledVector(front, 3.8)
              .addScaledVector(right, 0.4),
        target = close ? center : new T.Vector3(0, 1, 0);
      r.renderer.setClearColor(0x172b39, 1);
      r.renderer.clear();
      r.render({
        eye: eye.toArray(),
        target: target.toArray(),
        aspect: 1100 / 850,
        fov: close ? 0.52 : 0.65,
        width: 1100,
        height: 850,
        cinematic: true,
      });
      return {
        palmForward: new T.Vector3(-1, 0, 0)
          .applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()))
          .dot(front),
      };
    };
  });
  const checks = [];
  for (const [name, amount, yaw, close] of [
    ["whole-hand", 1, Math.PI, false],
    ["palm-close", 1, Math.PI, true],
    ["heading-right", 1, 0.7, true],
    ["heading-left", 1, -1.2, true],
    ["raise-mid", 0.5, Math.PI, false],
  ]) {
    const result = await page.evaluate(
      (a) => window.__salute(...a),
      [amount, yaw, close],
    );
    if (amount === 1) assert.ok(result.palmForward > 0.95);
    await page.screenshot({ path: out + "/" + name + ".png" });
    checks.push({ name, ...result });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(
    "Native full-hand salute front, palm close-ups, headings and transition passed.",
  );
} finally {
  await browser.close();
}
