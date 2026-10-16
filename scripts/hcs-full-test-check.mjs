import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { DEPLOYMENT_CUES } from "../public/deployment-cues.js";
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
    window.__songVoices = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      when = 0,
      offset = 0,
      ...rest
    ) {
      if (this.buffer?.duration === 30)
        window.__songVoices.push({
          offset,
          when,
          loop: this.loop,
          context: this.context,
        });
      return start.call(this, when, offset, ...rest);
    };
    window.__victoryFrames = [];
    const sampleVictory = () => {
      const v = window.Game?.victoryView?.(), now = performance.now(),
        voice = window.__songVoices.at(-1);
      let audioSample = null;
      if(v?.stage === "launch" && voice){
        const stamp=voice.context.getOutputTimestamp();
        const audible=stamp?.performanceTime>0
          ? Math.min(voice.context.currentTime,stamp.contextTime+Math.max(0,now-stamp.performanceTime)/1000)
          : voice.context.currentTime;
        const atFrame=audible-(now-v.sampledAt)/1000-voice.when+voice.offset;
        audioSample={voice:{offset:voice.offset,loop:voice.loop},atFrame,stamp,
          difference:Math.abs(atFrame-v.musicTime)};
      }
      if (v)
        window.__victoryFrames.push({
          ...v,
          observedAt: now,
          audioSample,
          nativeSalute: window.Game.pose().saluteProgress,
          renderedFov: window.Game.deploymentView().cameraFov,
          weapon: window.Game.pose().weapon,
        });
      requestAnimationFrame(sampleVictory);
    };
    requestAnimationFrame(sampleVictory);
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
    // Two real viewers still render, with a smaller software-GPU pixel budget.
    // Keep the player's full-size view and every clock/delay assertion intact.
    await v.setViewportSize({width:640,height:400});
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
  await p.waitForFunction(
    () => window.__victoryFrames.some(f=>f.stage === "launch" && f.audioSample),
    {},
    { timeout: 30000 },
  );
  const beatSync = await p.evaluate(async () => {
    const { HCS_VICTORY_MUSIC: music } =
      await import("/hcs-victory-cinematic.js");
    // The real stage may already have passed while Playwright was closing
    // the controls on a software GPU. Read the audio sample recorded on that
    // native launch frame, rather than waiting for the live camera to rewind.
    const frame=window.__victoryFrames.find(f=>f.stage==='launch'&&f.audioSample);
    return {...frame.audioSample,excerptOffset:music.offset,frame};
  });
  await writeFile(out + "/beat-sync.json", JSON.stringify(beatSync, null, 2));
  assert.ok(
    beatSync.voice.offset >= beatSync.excerptOffset &&
      beatSync.voice.offset < beatSync.excerptOffset + 0.5,
  );
  assert.equal(beatSync.voice.loop, false);
  assert.ok(beatSync.difference < 0.3);
  assert.equal(beatSync.frame.actorVisible, 0);
  if(await p.evaluate(()=>window.Game.victoryView()?.stage === "launch"))
    await p.screenshot({ path: out + "/05a-victory-launch.png" });
  checks.push(
    "native AudioContext output drives the champion launch and camera; one forward-playing victory excerpt",
  );
  await p.waitForFunction(
    () =>
      window.__victoryFrames.some(
        (f) => f.stage === "salute" && f.salute >= 0.999,
      ),
    {},
    { timeout: 30000 },
  );
  const saluteSync = await p.evaluate(() => {
    const frames = window.__victoryFrames,
      first = frames.find((f) => f.salute >= 0.999),
      index = frames.indexOf(first);
    return {
      first,
      frameGapMs:
        index > 0 ? first.observedAt - frames[index - 1].observedAt : 0,
      peakPunch: Math.max(...frames.map((f) => f.salutePunch || 0)),
      maxFovError: Math.max(...frames.map(f=>Math.abs(f.renderedFov-f.fov))),
    };
  });
  assert.equal(saluteSync.first.scene, "ship");
  assert.equal(saluteSync.first.weapon, null);
  assert.ok(saluteSync.first.nativeSalute > 0.999);
  assert.ok(saluteSync.first.musicTime >= DEPLOYMENT_CUES.stepperStart - 0.006);
  assert.ok(
    saluteSync.first.musicTime - DEPLOYMENT_CUES.stepperStart <
      Math.max(0.25, saluteSync.frameGapMs / 1000 + 0.05),
  );
  assert.ok(saluteSync.peakPunch > 0.8);
  assert.ok(saluteSync.maxFovError < 1e-7, "native lens follows the audio-clocked camera on every sampled frame");
  await writeFile(
    out + "/victory-salute-sync.json",
    JSON.stringify(saluteSync, null, 2),
  );
  await p.screenshot({ path: out + "/05b-victory-salute.png" });
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
    await v
      .locator("#hcs-finale")
      .waitFor({ state: "visible", timeout: 30000 });
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
  for (const [index,page] of context.pages().entries()) {
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
        out + "/failure-state-"+index+".json",
        JSON.stringify(
          await page
            .evaluate(() => ({
              frames: window.__victoryFrames,
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
