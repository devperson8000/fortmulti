import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
try {
  await page.route("**/hcs-client-lab", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<body>${["hcs-countdown", "hcs-promo-time", "hcs-date", "hcs-promo", "hcs-empty", "hcs-personal", "hcs-invite-notice", "hcs-checkin", "hcs-retry-map", "hcs-watch", "hcs-champion", "hcs-service", "hcs-broadcast", "hcs-broadcast-label", "hcs-watch-stats", "hcs-return", "lobby", "net-ping"].map((id) => '<div id="' + id + '"></div>').join("")}<table><tbody id="hcs-ranks"></tbody></table><select id="hcs-view-player"></select></body>`,
    }),
  );
  await page.goto((process.env.GAME_TEST_URL || "http://127.0.0.1:4173") + "/hcs-client-lab");
  await page.evaluate(async () => {
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        at: Date.now() + 10000,
        phase: "live",
        ranks: [],
        checked: [],
      }),
    });
    window.WebSocket = class {
      constructor() {
        this.readyState = 1;
        this.bufferedAmount = 0;
        this.sent = [];
        window.__socket = this;
        setTimeout(() => this.onopen?.(), 0);
      }
      send(data) {
        this.sent.push(JSON.parse(data));
      }
      close() {
        this.readyState = 3;
      }
    };
    window.Game = {
      setMap: async () => {},
      clear() {},
      look() {},
      apply(state) { window.__appliedState = state; },
      effect() {},
      input: () => ({}),
    };
    window.Duel = { lobby: true };
    const { createHCS } = await import("/hcs-client.js");
    window.__client = createHCS({
      config: { hcsUrl: "http://127.0.0.1:4201" },
      session: () => ({ access_token: "fixture" }),
      profile: () => ({ name: "Ranger" }),
      leaveParty: async () => {},
      returnLobby() {},
      applyOfficial() {},
      onMapError() { window.__mapErrorShown = true; },
    });
    window.__socket.onmessage({
      data: JSON.stringify({ type: "authenticated", id: "viewer" }),
    });
    document.getElementById("hcs-watch").onclick();
    window.__snapshot = {
      type: "snapshot",
      spectator: true,
      matchId: "final1",
      mapId: "facility",
      state: {
        players: [
          { id: "a", hp: 100, yaw: 0, p:[0,0,0] },
          { id: "b", hp: 100, yaw: 1, p:[2,0,2] },
        ],
        events: [],
        phase: "playing",
      },
      profiles: [
        { id: "a", name: "Alpha", color: "408faf" },
        { id: "b", name: "Bravo", color: "408faf" },
      ],
    };
    await window.__socket.onmessage({
      data: JSON.stringify(window.__snapshot),
    });
  });
  const mutations = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(
      (entries) => (count += entries.length),
    );
    observer.observe(document.getElementById("hcs-view-player"), {
      childList: true,
    });
    document.getElementById("hcs-view-player").value = "b";
    document.getElementById("hcs-view-player").onchange();
    for (let i = 0; i < 30; i++)
      await window.__socket.onmessage({
        data: JSON.stringify(window.__snapshot),
      });
    await Promise.resolve();
    observer.disconnect();
    return { count, value: document.getElementById("hcs-view-player").value };
  });
  assert.equal(
    mutations.count,
    0,
    "unchanged snapshots must not rebuild the open competitor selector",
  );
  assert.equal(mutations.value, "b");
  const eliminated = await page.evaluate(async () => {
    window.__snapshot.state.players[1].hp = 0;
    await window.__socket.onmessage({
      data: JSON.stringify(window.__snapshot),
    });
    window.__client.render(0.033);
    return {
      selected: document.getElementById("hcs-view-player").value,
      watching: window.Duel.spectating,
      stats: document.getElementById("hcs-watch-stats").textContent,
    };
  });
  assert.equal(
    eliminated.selected,
    "a",
    "elimination switches to a living competitor",
  );
  assert.equal(
    eliminated.watching,
    "a",
    "camera and stats follow the same competitor",
  );
  assert.match(eliminated.stats, /100 HP/);
  const final = await page.evaluate(async () => {
    window.__snapshot.state.phase = "done";
    window.__snapshot.state.victoryElapsed = 20;
    window.__snapshot.state.winner = 0;
    window.__snapshot.state.tournamentKills = { a: 4 };
    await window.__socket.onmessage({
      data: JSON.stringify(window.__snapshot),
    });
    window.__client.render(0.033);
    const root = document.getElementById("hcs-official-finale");
    const result = {
      hidden: root.hidden,
      title: root.querySelector("[data-finale=title]").textContent,
      name: root.querySelector("[data-finale=name]").textContent,
      viewed: window.Duel.spectating,
    };
    window.__client.stop();
    result.cleaned =
      root.hidden && !document.body.classList.contains("hcs-celebrating");
    window.__snapshot.state.phase = "playing";
    return result;
  });
  assert.equal(final.hidden, false);
  assert.equal(final.title, "CHAMPION CROWNED");
  assert.equal(final.name, "Alpha");
  assert.equal(final.viewed, "a");
  assert.equal(final.cleaned, true);
  const inputs = await page.evaluate(async () => {
    window.__client.stop();
    await window.__socket.onmessage({
      data: JSON.stringify({ type: "authenticated", id: "a" }),
    });
    await window.__socket.onmessage({
      data: JSON.stringify({
        ...window.__snapshot,
        matchId: "final2",
        spectator: false,
      }),
    });
    window.__socket.sent = [];
    await new Promise((r) => setTimeout(r, 140));
    return window.__socket.sent.filter((m) => m.type === "input").length;
  });
  assert.ok(
    inputs >= 2,
    "input transport must continue independently of render frames",
  );
  const recovery = await page.evaluate(async () => {
    const old = window.__socket;
    old.readyState = 3;
    old.onclose();
    const label = document.getElementById("hcs-broadcast-label").textContent;
    await new Promise((r) => setTimeout(r, 1200));
    await old.onmessage({
      data: JSON.stringify({
        ...window.__snapshot,
        tournament: false,
        matchId: "stale",
      }),
    });
    return {
      label,
      official: window.__client.official,
      replaced: window.__socket !== old,
    };
  });
  assert.match(recovery.label, /RECONNECTING/);
  assert.equal(recovery.replaced, true);
  assert.equal(
    recovery.official,
    false,
    "old socket snapshots cannot replace the current match",
  );
  const cancelled = await page.evaluate(async () => {
    window.__client.stop();
    const socket = window.__socket;
    await socket.onmessage({
      data: JSON.stringify({ type: "authenticated", id: "a" }),
    });
    let release;
    window.Game.setMap = () =>
      new Promise((r) => {
        release = r;
      });
    const loading = socket.onmessage({
      data: JSON.stringify({
        ...window.__snapshot,
        matchId: "cancelled-load",
        spectator: false,
      }),
    });
    await Promise.resolve();
    await Promise.resolve();
    window.__client.stop();
    release?.();
    await loading;
    return window.__client.active;
  });
  assert.equal(
    cancelled,
    false,
    "leaving during map loading cannot reopen the final",
  );
  const failed = await page.evaluate(async () => {
    window.Game.setMap = async () => { throw new Error('Temporary asset failure'); };
    let unhandled = null;
    try { await window.__socket.onmessage({data: JSON.stringify({
      ...window.__snapshot, matchId: 'retry-final', spectator: false,
    })}); } catch (error) { unhandled = error.message; }
    return {unhandled, active: window.__client.active, shown: Boolean(window.__mapErrorShown),
      message: document.getElementById('hcs-service').textContent,
      retry: !document.getElementById('hcs-retry-map').hidden};
  });
  assert.equal(failed.unhandled, null, 'map failure must not reject the socket handler');
  assert.equal(failed.active, false);
  assert.equal(failed.shown, true, 'map error must be presented in the lobby');
  assert.match(failed.message, /retry map/i);
  assert.equal(failed.retry, true);
  await page.evaluate(async () => {
    window.__mapRetries = 0;
    window.Game.setMap = async () => { window.__mapRetries++; };
    window.__snapshot.state.players[0].hp = 78;
    await window.__socket.onmessage({data: JSON.stringify({
      ...window.__snapshot, matchId: 'retry-final', spectator: false,
    })});
  });
  assert.equal(await page.evaluate(() => window.__mapRetries), 0,
    'new snapshots must not hammer the failed map loader');
  await page.locator('#hcs-retry-map').click();
  await page.waitForFunction(() => window.__client.active);
  assert.equal(await page.evaluate(() => window.__mapRetries), 1);
  assert.equal(await page.locator('#hcs-retry-map').isHidden(), true);
  assert.equal(await page.locator('#lobby').isHidden(), true);
  const idleMutations = await page.evaluate(async () => {
    window.__client.render(.016);
    let mutations = 0;
    const observer = new MutationObserver(entries => mutations += entries.length);
    observer.observe(document.getElementById('hcs-broadcast-label'), {childList: true});
    for (let n = 0; n < 60; n++) window.__client.render(.016);
    await Promise.resolve(); observer.disconnect(); return mutations;
  });
  assert.equal(idleMutations, 0, 'unchanged broadcast labels must not be rebuilt each render');
  assert.equal(await page.evaluate(() => window.__appliedState.players[0].hp), 78,
    'retry must use the newest snapshot received during the failed load');
  const selectedView = await page.evaluate(async () => {
    window.__client.stop();
    window.__snapshot.state.players.forEach(p => p.hp = 100);
    for (const matchId of ['view-final-one', 'view-final-two']) {
      document.getElementById('hcs-watch').onclick();
      await window.__socket.onmessage({data: JSON.stringify({
        ...window.__snapshot, matchId, spectator: true,
      })});
      if (matchId === 'view-final-one') {
        document.getElementById('hcs-view-player').value = 'b';
        document.getElementById('hcs-view-player').onchange();
        window.__client.stop();
      }
    }
    window.__client.render(.016);
    return {selected: document.getElementById('hcs-view-player').value, viewed: window.Duel.spectating};
  });
  assert.equal(selectedView.selected, selectedView.viewed,
    'rejoining a broadcast must align the selected operator and actual camera');
  for (const pending of [false, true]) {
    const replacement = await page.evaluate(async pending => {
      window.__client.stop();
      window.Game.setMap = async () => {throw new Error('Asset unavailable');};
      await window.__socket.onmessage({data: JSON.stringify({
        ...window.__snapshot, matchId: 'replaced-final', spectator: false,
      })});
      let retry, rejectLoad;
      if (pending) {
        window.Game.setMap = () => new Promise((resolve, reject) => {rejectLoad = reject;});
        retry = document.getElementById('hcs-retry-map').onclick();
        await Promise.resolve(); await Promise.resolve();
      }
      await window.__socket.onmessage({data: JSON.stringify({
        ...window.__snapshot, matchId: pending ? 'new-ordinary-match' : 'ordinary-match', spectator: false, tournament: false,
      })});
      if (pending) { rejectLoad(new Error('Stale asset failure')); await retry; }
      return {official: window.__client.official,
        retryHidden: document.getElementById('hcs-retry-map').hidden,
        message: document.getElementById('hcs-service').textContent};
    }, pending);
    assert.equal(replacement.official, true);
    assert.equal(replacement.retryHidden, true, 'ordinary match must clear settled and late final map failures');
    assert.doesNotMatch(replacement.message, /could not load|retry map/i);
  }
  console.log('HCS selector, elimination, reconnect, cancelled load, retry recovery, idle HUD and input stability passed');
} finally {
  await browser.close();
}
