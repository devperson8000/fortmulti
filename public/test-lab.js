import {
  LabSession,
  FrameMetrics,
  labPasswordMatches,
  runHCSChecks,
} from "./test-lab-core.js";
import { validBuild, placement } from "./simulation.js";
import { safeLandingPoint } from "./deployment-sequence.js";

const $ = (id) => document.getElementById(id);
const manualChecks = [
  "Hands and weapon models",
  "Gunshots and reload sounds",
  "Ctrl crouch / Shift + Ctrl slide",
  "Other operators slide smoothly",
  "Crosshair-only weapon pickup",
  "Chest opens upright in 0.7s",
  "Inventory drag and swap",
  "Map floors and collision",
  "Pod entry, landing and salute",
  "Building on Ironwood only",
];
const roomPattern = /^[a-f0-9]{24}$/;
export function installTestLab({ game, profile, leaveParty, returnLobby }) {
  const dialog = document.createElement("dialog");
  dialog.id = "test-lab-dialog";
  dialog.setAttribute("aria-labelledby", "lab-title");
  dialog.innerHTML = `<div class="lab-title"><div><small>TEMPORARY · LOCAL PRACTICE ONLY</small><h2 id="lab-title">Horizon test lab</h2><p>Test your Mac. Inspect the game. Leave official results untouched.</p></div><button id="lab-close" type="button" aria-label="Close test panel">✕</button></div>
 <form id="lab-lock-form"><label for="lab-password">Test password</label><input id="lab-password" type="password" autocomplete="off" required><button id="lab-unlock" type="submit">UNLOCK TESTS</button><p id="lab-lock-error" role="status"></p></form>
 <div id="lab-tools" hidden><div class="lab-config"><label>Map<select id="lab-map"><option value="facility">Platform 23</option><option value="island">Ironwood Island</option></select></label><label>Ironwood rules<select id="lab-mode"><option value="town">Town royale · chests + storm</option><option value="build">Build skirmish</option></select></label><label>Test graphics<select id="lab-quality"><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Operators<select id="lab-count"><option value="8">8 · maximum lobby</option><option value="5">5</option><option value="2">2</option></select></label></div>
 <div class="lab-grid"><article class="lab-card"><small>RENDERING + GAMEPLAY</small><h3>Full squad field test</h3><p>You and up to seven moving bots use the actual map, collision, weapons and animations. Bots fire into the air until combat is enabled.</p><div class="lab-buttons"><button id="lab-combat" class="lab-primary" type="button">PLAY FIELD TEST</button><button id="lab-pods" type="button">POD DEPLOYMENT</button></div><label class="lab-switch"><input id="lab-bot-fire" type="checkbox">Bots fight each other</label></article>
 <article class="lab-card"><small>FIVE COMPETITORS · ONE SURVIVOR</small><h3>HCS practice final</h3><p>Platform 23 and the real final rules. Play in first person or follow five bots in third person, twenty seconds behind.</p><label class="lab-switch"><input id="lab-hcs-pods" type="checkbox">Include the full pod intro</label><div class="lab-buttons"><button id="lab-hcs-play" class="lab-primary" type="button">PLAY HCS TEST</button><button id="lab-hcs-watch" type="button">WATCH HCS TEST</button></div></article>
 <article class="lab-card"><small>WEAPONS + MAP INSPECTION</small><h3>Check every detail</h3><p>Use 1–5 for guns, Tab to arrange your loadout, E on the exact floor weapon, Shift to run and Ctrl to crouch or knee-slide.</p><label for="lab-kit">Weapon kit</label><select id="lab-kit"><option value="standard">Originals + Sentinel</option><option value="variants">New variants</option></select><div class="lab-buttons"><button id="lab-equip" type="button">EQUIP KIT</button><button id="lab-arsenal" type="button">PLACE ALL GUNS</button><button id="lab-chest" type="button">GO TO A CHEST</button></div><p class="lab-note">Inspection buttons affect only the current practice session.</p></article>
 <article class="lab-card"><small>QUALIFICATION + TOURNAMENT RULES</small><h3>HCS systems check</h3><p>Exercise rankings, nickname validation, check-in, reserve substitutions, postponement, the Sydney schedule, delayed results and reconnect deadlines.</p><button id="lab-rules" class="lab-primary" type="button">RUN HCS RULE CHECKS</button><ul id="lab-check-results" aria-live="polite"></ul><div class="lab-buttons"><button id="lab-disconnect" type="button">DISCONNECT OPERATOR 2</button><button id="lab-reconnect" type="button">RECONNECT OPERATOR 2</button><button id="lab-finish" type="button">END TEST FINAL</button></div></article></div>
 <p class="lab-note"><b>Audience test:</b> in a field test or HCS final, choose “Open viewer” to add a password-gated spectator window on this Mac. Open several to compare FPS. These are real local windows, not remote internet players. For internet load testing, have your friends join a normal private party on their Macs; this lab does not write HCS standings or start the official tournament. The host also runs the bots and referee on this Mac, so this is a heavier CPU test than a server-hosted match.</p>
 <details><summary>Manual inspection checklist</summary><p class="lab-note">Tick only checks you personally verified. They are recorded separately from automatic rule checks.</p><div id="lab-checklist" class="lab-checklist"></div></details>
 <p id="lab-panel-status" role="status"></p><div class="lab-buttons"><button id="lab-resume" type="button" hidden>RESUME TEST</button><button id="lab-viewer-panel" type="button" hidden>OPEN LOCAL VIEWER</button><button id="lab-download-panel" type="button">DOWNLOAD TEST REPORT</button><button id="lab-stop" type="button" hidden>END TEST / RETURN TO LOBBY</button></div>
 <p class="lab-note">Temporary password gate; no administrator access. Reloading locks the panel again.</p></div>`;
  document.body.append(dialog);
  const bar = document.createElement("div");
  bar.id = "lab-bar";
  bar.hidden = true;
  bar.innerHTML =
    '<strong>LOCAL TEST</strong><span id="lab-metrics">Collecting frames…</span><span id="lab-stage"></span><select id="lab-target" aria-label="Follow test operator" hidden></select><button id="lab-controls" type="button">TEST CONTROLS · P</button><button id="lab-viewer" type="button">OPEN VIEWER</button><button id="lab-download" type="button">REPORT</button><button id="lab-exit" type="button">EXIT TEST</button>';
  document.body.append(bar);
  const waiting = document.createElement("section");
  waiting.id = "lab-waiting";
  waiting.hidden = true;
  waiting.innerHTML =
    '<small>LOCAL HCS BROADCAST</small><h2>Waiting for the delayed feed</h2><b id="lab-wait-time">20s</b><p>No live frames are shown. You will follow the operators in third person.</p>';
  document.body.append(waiting);
  for (const text of manualChecks) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.check = text;
    label.append(input, document.createTextNode(text));
    $("lab-checklist").append(label);
  }
  let unlocked = false,
    session = null,
    active = false,
    watching = false,
    loading = false,
    isViewer = false,
    waitingForFeed = false,
    packet = null,
    viewed = "",
    seen = 0,
    channel = null,
    room = "",
    timer = null,
    meterTimer = null,
    lastTick = 0,
    lastFrame = null,
    lastPublish = 0,
    startedAt = 0,
    metrics = new FrameMetrics(),
    simMetrics = new FrameMetrics(),
    ruleChecks = [],
    issues = [],
    lastReport = null,
    version = 0,
    hostSeen = 0,
    receivedFrames = 0;
  const clients = new Map(),
    viewerId = crypto.randomUUID();
  const requestedRoom = new URLSearchParams(location.search).get(
    "horizon-test-view",
  );
  const pendingRoom = roomPattern.test(requestedRoom || "")
    ? requestedRoom
    : null;
  const panelStatus = (text, error = false) => {
    $("lab-panel-status").textContent = text;
    $("lab-panel-status").classList.toggle("error", error);
  };
  const markWaiting = (value) => {
    waitingForFeed = value;
    waiting.hidden = !value;
  };
  const onError = (event) => {
    if (active && issues.length < 20)
      issues.push(
        String(
          event.message ||
            event.reason?.message ||
            event.reason ||
            "Unknown browser error",
        ),
      );
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);
  $("game")?.addEventListener("webglcontextlost", () => {
    if (active && issues.length < 20)
      issues.push("Game graphics context lost.");
  });
  document.addEventListener("visibilitychange", () => {
    lastFrame = null;
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        !active ||
        event.code !== "KeyP" ||
        event.target.matches?.("input,select,textarea")
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        if (dialog.open) close();
        else show();
      }
    },
    { capture: true },
  );
  function show() {
    game?.clear();
    document.exitPointerLock?.();
    if (!dialog.open) dialog.showModal();
    if (!unlocked) $("lab-password").focus();
  }
  function close() {
    dialog.close();
    if (active && !waitingForFeed && !watching) game.capture();
  }
  function fillRoster(profiles) {
    $("lab-target").replaceChildren(
      ...profiles.map((p) => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.name;
        return option;
      }),
    );
    $("lab-target").value = viewed;
  }
  function activate() {
    active = true;
    startedAt = Date.now();
    metrics = new FrameMetrics();
    simMetrics = new FrameMetrics();
    issues = [];
    receivedFrames = 0;
    lastFrame = null;
    seen = 0;
    packet = null;
    window.Duel.lobby = false;
    window.Duel.spectating = null;
    document.body.classList.remove(
      "in-lobby",
      "menu",
      "hcs-open",
      "profile-open",
      "character-preview-open",
    );
    document.body.classList.add("lab-match");
    $("lobby").hidden = true;
    bar.hidden = false;
    dialog.close();
    $("lab-stop").hidden = false;
    $("lab-resume").hidden = false;
    $("lab-viewer-panel").hidden = isViewer;
    $("lab-viewer").disabled = isViewer;
    for (const id of [
      "lab-combat",
      "lab-pods",
      "lab-hcs-play",
      "lab-hcs-watch",
    ])
      $(id).disabled = isViewer;
    meterTimer = setInterval(updateMeter, 1000);
  }
  function attachRoom(id, viewer) {
    room = id;
    channel = new BroadcastChannel("horizon-test-" + id);
    channel.onmessage = (event) => {
      const value = event.data;
      if (!value?.testOnly) return;
      if (!viewer) {
        if (value.type === "hello") clients.set(value.id, Date.now());
        if (value.type === "bye") clients.delete(value.id);
        return;
      }
      if (value.type === "ended") {
        stop();
        panelStatus("The host ended this local test.");
        show();
        return;
      }
      if (value.type === "warming") {
        hostSeen = Date.now();
        $("lab-wait-time").textContent =
          Math.max(1, Math.ceil(value.remaining / 1000)) + "s";
        return;
      }
      if (value.type === "frame" && value.packet?.testOnly) {
        hostSeen = Date.now();
        receivedFrames++;
        packet = value.packet;
        if (!viewed) {
          viewed = packet.profiles[0].id;
          fillRoster(packet.profiles);
        }
        markWaiting(false);
      }
    };
  }
  async function start(kind, spectator = false) {
    if (loading) return;
    if (!game) {
      panelStatus(
        "Enable Chrome graphics acceleration and reload Horizon before testing.",
        true,
      );
      return;
    }
    if (window.HorizonHCS?.active) {
      panelStatus(
        "Return from your online match before starting a local test.",
        true,
      );
      return;
    }
    loading = true;
    let request;
    try {
      stop(false);
      request = version;
      leaveParty();
      const map = kind === "hcs" ? "facility" : $("lab-map").value;
      panelStatus("Loading the test map…");
      await game.startAudio({
        deployment: kind === "pods" || $("lab-hcs-pods").checked,
      });
      await game.setMap(map);
      if (request !== version) return;
      session = new LabSession(game.world, {
        kind,
        map,
        mode: $("lab-mode").value,
        count: Number($("lab-count").value),
        name: profile().name,
        pods: kind === "hcs" && $("lab-hcs-pods").checked,
      });
      session.fire = $("lab-bot-fire").checked;
      session.botLocal = spectator;
      watching = spectator;
      isViewer = false;
      viewed = session.localId;
      room = Array.from(crypto.getRandomValues(new Uint8Array(12)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      attachRoom(room, false);
      activate();
      fillRoster(session.profiles);
      $("lab-target").hidden = !watching;
      markWaiting(watching);
      game.look(Math.PI, -0.03);
      lastTick = performance.now();
      lastPublish = 0;
      timer = setInterval(tick, 33);
      tick();
      panelStatus(
        "Local test is running. Press P for Test controls to inspect weapons, run checks or return to the lobby.",
      );
      if (!watching) game.capture();
    } catch (e) {
      stop();
      panelStatus(e.message, true);
      if (!dialog.open) show();
    } finally {
      loading = false;
    }
  }
  async function joinViewer(id) {
    if (loading) return;
    loading = true;
    let request;
    try {
      if (window.HorizonHCS?.active)
        throw Error(
          "Leave the online match before joining a local test viewer.",
        );
      stop(false);
      request = version;
      leaveParty();
      await game.setMap("facility");
      if (request !== version) return;
      isViewer = true;
      watching = true;
      viewed = "";
      session = null;
      attachRoom(id, true);
      activate();
      $("lab-target").hidden = false;
      markWaiting(true);
      hostSeen = Date.now();
      timer = setInterval(() => {
        channel?.postMessage({ testOnly: true, type: "hello", id: viewerId });
        if (Date.now() - hostSeen > 15000) {
          panelStatus(
            "No local host is responding. Keep the host test open in this Chrome profile.",
            true,
          );
          $("lab-wait-time").textContent = "Host offline";
        }
      }, 2000);
      channel.postMessage({ testOnly: true, type: "hello", id: viewerId });
    } catch (e) {
      stop();
      panelStatus(e.message, true);
      show();
    } finally {
      loading = false;
    }
  }
  function tick() {
    if (!session || !active) return;
    const now = performance.now(),
      wall = Date.now(),
      dt = (now - lastTick) / 1000;
    lastTick = now;
    const started = performance.now();
    session.tick(
      dt,
      wall,
      watching || dialog.open ? {} : game.input(),
      game.audioDeploymentElapsed(session.match.deployment.sequenceId),
    );
    simMetrics.frame(performance.now() - started);
    packet = session.packet(wall, watching);
    markWaiting(!packet);
    if (now - lastPublish >= 100) {
      lastPublish = now;
      const delayed = session.packet(wall, true);
      channel.postMessage(
        delayed
          ? { testOnly: true, type: "frame", packet: delayed }
          : {
              testOnly: true,
              type: "warming",
              remaining: Math.max(0, 20000 - (wall - startedAt)),
            },
      );
    }
  }
  function status() {
    return {
      active,
      viewer: isViewer,
      watching,
      players: packet?.state.players.length || session?.count || 0,
      phase: packet?.state.phase || session?.match.phase || "",
      pickups:
        session?.match.pickups.length || packet?.state.pickups.length || 0,
      delayMs: watching && packet ? Date.now() - packet.sampleAt : null,
      champion: packet?.champion || null,
      spectators: [...clients.values()].filter((at) => Date.now() - at < 10000)
        .length,
    };
  }
  function report() {
    const canvas = $("game"),
      gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl"),
      gpuInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      type: "Horizon local machine test",
      testOnly: true,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      durationSeconds: startedAt ? (Date.now() - startedAt) / 1000 : 0,
      scenario: session?.kind || packet?.kind || "none",
      map: session?.map || packet?.map || null,
      ...status(),
      frames: metrics.report(),
      simulation: simMetrics.report(),
      render: game?.mapStatus(),
      canvas: {
        width: document.querySelector("canvas")?.width,
        height: document.querySelector("canvas")?.height,
      },
      gpu: gl
        ? String(
            gl.getParameter(gpuInfo?.UNMASKED_RENDERER_WEBGL || gl.RENDERER),
          )
        : null,
      graphicsContextLost: gl?.isContextLost() || false,
      browser: navigator.userAgent,
      hardwareThreads: navigator.hardwareConcurrency,
      devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      graphicsQuality: document.body.dataset.quality || null,
      jsHeapUsedBytes: performance.memory?.usedJSHeapSize || null,
      ruleChecks,
      manualChecks: [...$("lab-checklist").querySelectorAll("input")].map(
        (el) => ({ name: el.dataset.check, verified: el.checked }),
      ),
      issues: [...issues],
      limits: [
        "Local bots exercise actual rendering and gameplay; they are not remote humans.",
        "Viewer windows test local rendering and BroadcastChannel transport, not internet latency.",
        "The host runs bots/referee and graphics on this Mac; official games run referee simulation on the server.",
        "Metrics cover the active visible test; background intervals are excluded.",
      ],
    };
  }
  function updateMeter() {
    if (!active) return;
    const s = status(),
      r = metrics.report();
    $("lab-metrics").textContent = r.samples
      ? `${r.fps.toFixed(0)} FPS · p95 ${r.p95Ms.toFixed(1)} ms`
      : "Collecting frames…";
    $("lab-stage").textContent = waitingForFeed
      ? "BUFFERING · 20s DELAY"
      : `${watching ? "20s DELAY · " : ""}${s.players} OPERATORS · ${s.phase.toUpperCase()}${s.spectators ? " · " + s.spectators + " VIEWERS" : ""}${s.champion ? " · CHAMPION " + s.champion.name : ""}`;
    if (waitingForFeed && !isViewer)
      $("lab-wait-time").textContent =
        Math.max(1, Math.ceil((20000 - (Date.now() - startedAt)) / 1000)) + "s";
    for (const [id, at] of clients)
      if (Date.now() - at > 10000) clients.delete(id);
  }
  function stop(restore = true) {
    version++;
    if (active) lastReport = report();
    clearInterval(timer);
    clearInterval(meterTimer);
    timer = meterTimer = null;
    channel?.postMessage({
      testOnly: true,
      type: isViewer ? "bye" : "ended",
      id: viewerId,
    });
    channel?.close();
    channel = null;
    clients.clear();
    active = false;
    session = null;
    packet = null;
    markWaiting(false);
    window.Duel.spectating = null;
    bar.hidden = true;
    $("lab-stop").hidden = true;
    $("lab-resume").hidden = true;
    $("lab-viewer-panel").hidden = true;
    document.body.classList.remove("lab-match");
    lastFrame = null;
    for (const id of [
      "lab-combat",
      "lab-pods",
      "lab-hcs-play",
      "lab-hcs-watch",
    ])
      $(id).disabled = false;
    if (restore) returnLobby();
  }
  function download() {
    const current = report(),
      data = active
        ? current
        : {
            ...(lastReport || current),
            ruleChecks,
            manualChecks: current.manualChecks,
          },
      blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "horizon-machine-test-" +
      new Date().toISOString().slice(0, 19).replaceAll(":", "-") +
      ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const inspection = (action) => {
    if (!session || isViewer) {
      panelStatus("Start a field test or HCS player test first.", true);
      return;
    }
    try {
      action();
      tick();
    } catch (e) {
      panelStatus(e.message, true);
    }
  };
  $("test-lab-open").onclick = show;
  $("lab-close").onclick = close;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  $("lab-lock-form").onsubmit = (event) => {
    event.preventDefault();
    if (!labPasswordMatches($("lab-password").value)) {
      $("lab-lock-error").textContent = "Incorrect test password.";
      return;
    }
    unlocked = true;
    $("lab-password").value = "";
    $("lab-lock-form").hidden = true;
    $("lab-tools").hidden = false;
    $("test-lab-open").querySelector("span").textContent = "UNLOCKED";
    if (pendingRoom) joinViewer(pendingRoom);
  };
  $("lab-quality").value = $("graphics-quality").value;
  $("lab-quality").onchange = () => {
    $("graphics-quality").value = $("lab-quality").value;
    $("graphics-quality").dispatchEvent(new Event("change"));
  };
  $("lab-combat").onclick = () => start("combat");
  $("lab-pods").onclick = () => start("pods");
  $("lab-hcs-play").onclick = () => start("hcs");
  $("lab-hcs-watch").onclick = () => start("hcs", true);
  $("lab-controls").onclick = show;
  $("lab-resume").onclick = close;
  $("lab-stop").onclick = $("lab-exit").onclick = () => {
    stop();
    dialog.close();
  };
  $("lab-download").onclick = $("lab-download-panel").onclick = download;
  $("lab-bot-fire").onchange = () => {
    if (session) session.fire = $("lab-bot-fire").checked;
  };
  $("lab-equip").onclick = () =>
    inspection(() => session.equipKit($("lab-kit").value));
  $("lab-arsenal").onclick = () =>
    inspection(() => {
      if (session.match.phase !== "playing" || !session.spawnArsenal())
        throw Error("Wait until the pod has landed.");
      panelStatus(
        "All eight models placed on the floor. Close this panel, aim at a gun and press E.",
      );
    });
  $("lab-chest").onclick = () =>
    inspection(() => {
      if (session.match.phase !== "playing")
        throw Error("Wait until gameplay starts.");
      const p = session.match.players[0],
        chest = session.match.world.chests?.[0];
      if (!chest) {
        panelStatus("This map has no chest spawn.", true);
        return;
      }
      const point = safeLandingPoint(
        { x: chest.x, z: chest.z + 2 },
        session.match.world,
        [],
      );
      if (!point) return;
      Object.assign(p, {
        p: [point.x, point.y, point.z],
        air: "landed",
        deploymentState: "match_active",
        impulse: [0, 0],
        vy: 0,
      });
      game.look(Math.atan2(-(chest.x - point.x), -(chest.z - point.z)), -0.25);
    });
  $("lab-rules").onclick = () => {
    if (!game?.world) {
      panelStatus(
        "3D graphics must be available to run the match checks.",
        true,
      );
      return;
    }
    ruleChecks = runHCSChecks(game.world);
    $("lab-check-results").replaceChildren(
      ...ruleChecks.map((result) => {
        const row = document.createElement("li");
        row.className = result.passed ? "passed" : "failed";
        row.textContent =
          (result.passed ? "PASS · " : "FAIL · ") +
          result.name +
          (result.error ? " · " + result.error : "");
        return row;
      }),
    );
  };
  $("lab-disconnect").onclick = () =>
    inspection(() => {
      if (session.hcs) session.disconnect(session.match.ids[1], Date.now());
    });
  $("lab-reconnect").onclick = () =>
    inspection(() => {
      if (session.hcs)
        panelStatus(
          session.reconnect(session.match.ids[1], Date.now())
            ? "Operator reconnected within the real 60-second grace."
            : "Reconnect expired; the operator stays eliminated.",
        );
    });
  $("lab-finish").onclick = () =>
    inspection(() => {
      if (session.hcs) session.finish(Date.now());
    });
  $("lab-target").onchange = () => {
    viewed = $("lab-target").value;
    game.clear();
  };
  $("lab-viewer").onclick = $("lab-viewer-panel").onclick = () => {
    if (!active || isViewer) return;
    const url = new URL(location.href);
    url.hash = "";
    url.search = "";
    url.searchParams.set("horizon-test-view", room);
    if (!window.open(url.toString(), "_blank", "popup,width=1000,height=700")) {
      panelStatus(
        "Chrome blocked the viewer window. Allow pop-ups for Horizon, then try again.",
        true,
      );
      show();
    }
  };
  window.addEventListener("beforeunload", () => {
    channel?.postMessage({
      testOnly: true,
      type: isViewer ? "bye" : "ended",
      id: viewerId,
    });
    channel?.close();
  });
  if (pendingRoom) show();
  return {
    get active() {
      return active;
    },
    get waiting() {
      return waitingForFeed;
    },
    status,
    report,
    stop,
    openControls: show,
    render(dt) {
      if (!active) return false;
      const now = performance.now();
      if (lastFrame !== null && !waitingForFeed) metrics.frame(now - lastFrame);
      lastFrame = now;
      if (!packet) return true;
      if (isViewer && game.mapId() !== packet.map) {
        if (!loading) {
          loading = true;
          markWaiting(true);
          game
            .setMap(packet.map)
            .then(() => markWaiting(false))
            .catch((e) => {
              stop();
              panelStatus(e.message, true);
              show();
            })
            .finally(() => (loading = false));
        }
        return true;
      }
      let p = packet.state.players.find((p) => p.id === viewed);
      if (!p || (p.hp <= 0 && packet.state.phase === "playing")) {
        p =
          packet.state.players.find((p) => p.hp > 0) || packet.state.players[0];
        if (p) {
          viewed = p.id;
          $("lab-target").value = viewed;
        }
      }
      if (!p) return true;
      const spectator = watching || viewed !== session?.localId;
      if (spectator) game.look(p.yaw, p.pitch || 0);
      game.apply(
        packet.state,
        viewed,
        Object.fromEntries(packet.profiles.map((p) => [p.id, p.color])),
        dt,
      );
      window.Duel.spectating = spectator ? viewed : null;
      for (const event of packet.state.events || []) {
        if (event.id > seen) game.effect(event, viewed, packet.state);
        seen = Math.max(seen, event.id);
      }
      return true;
    },
    moveInventory(operation) {
      if (!session || watching || isViewer) return false;
      game.ackInventory(
        session.match.moveInventory(session.localId, operation),
      );
      tick();
      return true;
    },
    preview() {
      return placement(
        game.pose(),
        game.input(),
        game.world,
        packet?.state.structures || [],
      );
    },
    valid(structure) {
      return (
        !!packet &&
        validBuild(
          structure,
          packet.state.structures,
          packet.state.players,
          game.world,
        )
      );
    },
  };
}
