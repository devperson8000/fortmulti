import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
try {
  await page.route("**/hcs-client-lab", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<body>${["hcs-countdown", "hcs-promo-time", "hcs-date", "hcs-promo", "hcs-empty", "hcs-personal", "hcs-invite-notice", "hcs-checkin", "hcs-watch", "hcs-champion", "hcs-service", "hcs-broadcast", "hcs-broadcast-label", "hcs-watch-stats", "hcs-return", "lobby", "net-ping"].map((id) => '<div id="' + id + '"></div>').join("")}<table><tbody id="hcs-ranks"></tbody></table><select id="hcs-view-player"></select></body>`,
    }),
  );
  await page.goto("http://127.0.0.1:4173/hcs-client-lab");
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
      apply() {},
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
          { id: "a", hp: 100, yaw: 0 },
          { id: "b", hp: 100, yaw: 1 },
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
  console.log(
    "HCS selector, elimination, reconnect, cancelled load and input stability passed",
  );
} finally {
  await browser.close();
}
