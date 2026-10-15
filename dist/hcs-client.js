import { HCS, nextEdition } from "./hcs-rules.js";
import { neutralInput } from "./network-tuning.js";
import { rememberIdentity } from "./nickname.js";
import { createHCSCelebration, hcsHeroState } from "./hcs-presentation.js";
const $ = (id) => document.getElementById(id);
export function createHCS({
  config,
  session,
  profile,
  leaveParty,
  returnLobby,
  applyOfficial,
  onMapError = () => {},
}) {
  let state = { ...nextEdition(), phase: "qualifying", ranks: [] },
    socket = null,
    identity = null,
    active = false,
    official = false,
    watching = false,
    frame = null,
    viewed = null,
    loading = false,
    seen = 0,
    retry = 0,
    closed = false,
    declined = null,
    rosterKey = "",
    transition = 0,
    disconnected = false,
    checkingIn = false,
    streamReady = false,
    connectionError = null,
    pendingPoll = null,
    stateRevision = 0,
    ranksKey = "",
    reconnectAt = 0,
    reconnectTimer = null,
    lastSnapshotAt = 0,
    mapFailure = null;
  const base = String(config.hcsUrl || "").replace(/\/$/, "");
  const celebration = createHCSCelebration({
    id: "hcs-official-finale",
    onExit: () => stop(),
  });
  let finaleKey = "";
  const valid =
    /^https:\/\/[^/]+$/.test(base) ||
    (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) &&
      ["localhost", "127.0.0.1"].includes(location.hostname));
  const serviceError = (status, code) => {
    const messages = {
      AUTH_REQUIRED:
        "HCS session expired or was rejected. Reload both players’ pages. If it persists, check that Vercel and Northflank use the same Supabase project.",
      PARTY_FORBIDDEN:
        "HCS could not verify this party. Leave and create a new party. If it persists, check the server’s Supabase project and multiplayer schema.",
      PARTY_CONNECTING:
        "A party member is still connecting to HCS. Both players should keep their game pages open, then ready up again.",
      PARTY_IN_MATCH:
        "This party or one of its players is already in a match. Return to the lobby or wait for the previous match to close.",
      PARTY_DATABASE_UNAVAILABLE:
        "HCS could not read the party database. Check Northflank’s Supabase credentials and apply the latest supabase.sql to that project.",
      MATCH_CHANGED:
        "The party has moved to another match. Refresh the lobby before trying again.",
      MATCH_CAPACITY: "All match servers are busy. Please try again shortly.",
      MATCH_WORLD_UNAVAILABLE:
        "The server could not prepare the map. Please try again shortly.",
    };
    const fallback = {
      401: messages.AUTH_REQUIRED,
      403: messages.PARTY_FORBIDDEN,
      409: "A party member is still connecting to HCS or is already in a match. Return both players to the lobby and try again.",
      404: "HCS endpoint was not found. Vercel’s HCS_SERVER_URL must be the Northflank HTTPS address, not the game’s website address.",
      400: "HCS rejected the request. Check your callsign and the server’s multiplayer database schema.",
    };
    return Object.assign(
      new Error(
        messages[code] ||
          fallback[status] ||
          "HCS service is unavailable. Please try again.",
      ),
      { status, code, source: "hcs" },
    );
  };
  const api = async (path, data, { timeoutMs = 8000 } = {}) => {
    const auth = session();
    rememberIdentity(auth);
    const response = await fetch(base + path, {
      method: data ? "POST" : "GET",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(auth?.access_token
          ? { Authorization: `Bearer ${auth.access_token}` }
          : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((cause) => {
      if (cause.name === "TimeoutError" || cause.name === "AbortError")
        throw Object.assign(
          new Error(
            "Online service took too long to respond. Please retry Ready Up.",
          ),
          { code: "REQUEST_TIMEOUT", source: "hcs", cause },
        );
      throw cause;
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw serviceError(response.status, body.code);
    }
    return response.json();
  };
  const dateFormat = new Intl.DateTimeFormat("en-AU", {
    timeZone: HCS.zone,
    dateStyle: "full",
    timeStyle: "short",
  });
  const setText = (id, text) => {
    const node = $(id);
    if (node && node.textContent !== text) node.textContent = text;
  };
  const competing = () => Boolean(frame && frame.tournament !== false &&
    !frame.spectator && frame.state.players.some(p => p.id === identity));
  function updateConnectionUI() {
    const node = $("match-connection");
    if (!node) return;
    const delayed = lastSnapshotAt > 0 && Date.now() - lastSnapshotAt > 2500;
    const visible =
      !closed && (active || official) && (disconnected || delayed);
    if (node.hidden !== !visible) node.hidden = !visible;
    if (visible) {
      const kind = disconnected ? "reconnecting" : "delayed";
      if (node.dataset.state !== kind) node.dataset.state = kind;
      setText(
        "match-connection",
        disconnected
          ? "RECONNECTING · Your match is still running. Keep this page open."
          : "CONNECTION DELAYED · Waiting for a fresh match update…",
      );
    }
  }
  const countdown = () => {
    const seconds = Math.max(0, Math.ceil((state.at - Date.now()) / 1000)),
      days = Math.floor(seconds / 86400),
      hours = Math.floor((seconds % 86400) / 3600),
      minutes = Math.floor((seconds % 3600) / 60),
      s = seconds % 60;
    const text = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    setText("hcs-countdown", text);
    setText("hcs-promo-time", text);
    setText("hcs-date", dateFormat.format(state.at));
    $("hcs-promo").hidden =
      state.at - Date.now() > HCS.promo || state.at < Date.now() - HCS.grace;
  };
  function draw() {
    countdown();
    const phase = $("hcs-phase");
    if (phase) {
      phase.textContent =
        {
          qualifying: "QUALIFICATION OPEN",
          locked: "QUALIFIERS LOCKED",
          checkin: "CHECK-IN OPEN",
          live: "CHAMPIONSHIP LIVE",
          complete: "FINAL COMPLETE",
        }[state.phase] || "CHAMPIONSHIP";
      phase.dataset.phase = state.phase;
    }
    const ranks = $("hcs-ranks");
    const nextRanksKey = JSON.stringify([identity, state.ranks]);
    if (nextRanksKey !== ranksKey) {
      ranksKey = nextRanksKey;
      ranks.replaceChildren();
      for (const [i, p] of state.ranks.entries()) {
        const row = document.createElement("tr");
        row.className =
          (i < 5 ? "qualifier" : i < 9 ? "reserve" : "") +
          (p.id === identity ? " hcs-you" : "");
        row.setAttribute(
          "aria-label",
          `${p.name}, rank ${i + 1}${p.id === identity ? ", your position" : ""}`,
        );
        for (const text of [
          String(i + 1).padStart(2, "0"),
          p.name,
          p.points ?? p.wins * 100 + p.kills * 10,
          p.wins,
          p.kills,
          p.games,
        ]) {
          const cell = document.createElement("td");
          cell.textContent = String(text);
          row.append(cell);
        }
        ranks.append(row);
      }
    }
    $("hcs-empty").hidden = !!state.ranks.length;
    const rank = state.ranks.findIndex((p) => p.id === identity),
      qualified = rank >= 0 && rank < 9,
      open =
        Date.now() >= state.at - HCS.checkin &&
        Date.now() <= state.at + HCS.grace &&
        ["checkin", "locked"].includes(state.phase);
    $("hcs-personal").textContent =
      rank < 0
        ? "Complete 10 qualifying online games to enter the standings."
        : rank < 5
          ? `RANK ${rank + 1} · ${state.phase === "qualifying" ? "QUALIFYING POSITION" : "INVITED TO HCS"}`
          : rank < 9
            ? `RANK ${rank + 1} · RESERVE — you may be called in.`
            : `RANK ${rank + 1} · Keep climbing.`;
    $("hcs-invite-notice").textContent =
      qualified && state.phase !== "qualifying"
        ? rank < 5
          ? "YOU QUALIFIED · VIEW YOUR INVITATION"
          : "RESERVE INVITATION · STAY READY"
        : "";
    $("hcs-checkin").disabled =
      !qualified || !open || !identity || state.checked?.includes(identity);
    $("hcs-checkin").disabled ||= checkingIn || !streamReady;
    $("hcs-checkin").textContent = checkingIn
      ? "CHECKING IN…"
      : state.checked?.includes(identity)
        ? "CHECKED IN"
        : "CHECK IN";
    $("hcs-watch").hidden = state.phase !== "live" || competing();
    $("hcs-watch").disabled = !streamReady;
    $("hcs-watch").textContent =
      watching && !active ? "CANCEL WATCH" : "WATCH HCS";
    $("hcs-champion").textContent = state.champion
      ? `REIGNING CHAMPION · ${state.champion.name}`
      : "";
    const retryMap = $("hcs-retry-map");
    if (retryMap) {
      retryMap.hidden = !mapFailure;
      retryMap.disabled = loading || !streamReady;
      retryMap.textContent = loading ? "LOADING MAP…" : "RETRY MAP";
    }
    if (mapFailure) setText("hcs-service", loading
      ? "Retrying map… Your match will resume when loading finishes."
      : mapFailure.message);
    updateConnectionUI();
  }
  function poll() {
    if (!valid || closed) return Promise.resolve();
    if (pendingPoll) return pendingPoll;
    const revision = stateRevision;
    pendingPoll = (async () => {
      try {
        const next = await api("/state");
        if (closed || revision !== stateRevision) return;
        state = next;
        setText(
          "hcs-service",
          mapFailure?.message || connectionError?.message ||
            (!streamReady
              ? "Standings connected · connecting your player to HCS…"
              : watching && !active
                ? "Connecting to broadcast · waiting for the 20-second delayed feed."
                : "Official standings · 20-second broadcast delay"),
        );
        draw();
      } catch {
        if (!closed && revision === stateRevision)
          setText(
            "hcs-service",
            mapFailure?.message || "Standings could not refresh. Retrying automatically…",
          );
      }
    })().finally(() => {
      pendingPoll = null;
    });
    return pendingPoll;
  }
  function syncRoster() {
    const profiles = frame?.profiles || [],
      nextRoster = JSON.stringify(profiles.map(p => [p.id, p.name]));
    if (nextRoster !== rosterKey) {
      rosterKey = nextRoster;
      $("hcs-view-player").replaceChildren(...profiles.map(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.name;
        return option;
      }));
    }
    if ($("hcs-view-player").value !== viewed)
      $("hcs-view-player").value = viewed;
    $("hcs-view-player").hidden = !watching;
  }
  async function prepareFinal(connection, retryMap = false) {
    if (active || loading || !frame || frame.tournament === false ||
        (mapFailure?.matchId === frame.matchId && !retryMap)) return;
    const data = frame, version = transition;
    loading = true;
    draw();
    try {
      await leaveParty();
      if (version !== transition || socket !== connection || closed) return;
      const selected = await window.Game.setMap(data.mapId);
      if (version !== transition || socket !== connection || closed ||
          frame?.matchId !== data.matchId) return;
      if (selected === false) throw new Error("Map selection was superseded");
      active = true;
      mapFailure = null;
      window.Duel.lobby = false;
      document.body.classList.remove("in-lobby", "menu", "hcs-open",
        "profile-open", "character-preview-open");
      $("lobby").hidden = true;
      document.body.classList.add("hcs-match");
      $("hcs-broadcast").hidden = false;
      // Use the newest frame received while assets were loading.
      viewed = frame.spectator ? frame.state.players[0]?.id : identity;
      syncRoster();
      window.Game.look(frame.state.players.find(p => p.id === viewed)?.yaw || 0);
      setText("hcs-broadcast-label", frame.spectator
        ? "20 SECOND DELAY" : "CHAMPIONSHIP FINAL");
    } catch (error) {
      if (version !== transition || socket !== connection || closed ||
          frame?.matchId !== data.matchId || frame?.tournament === false) return;
      mapFailure = {matchId: data.matchId,
        message: "HCS map could not load. Press Retry Map to rejoin. The match may continue while you reconnect."};
      onMapError(mapFailure.message);
    } finally {
      loading = false;
      if (!closed && version === transition) draw();
    }
  }
  function connect() {
    if (
      !valid ||
      closed ||
      Date.now() < reconnectAt ||
      (socket && socket.readyState < 2)
    )
      return;
    const auth = session();
    if (!auth?.access_token) return;
    rememberIdentity(auth);
    streamReady = false;
    connectionError = null;
    socket = new WebSocket(base.replace(/^http/, "ws") + "/stream");
    const connection = socket;
    socket.onopen = () => {
      if (socket !== connection || closed) return;
      connection.send(
        JSON.stringify({ type: "auth", token: auth.access_token }),
      );
    };
    socket.onmessage = async (event) => {
      if (socket !== connection || closed) return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === "broadcast-ended" && frame?.matchId === data.matchId) {
        stop();
        poll();
        return;
      }
      if (data.type === "match-cancelled" && frame?.matchId === data.matchId) {
        declined = data.matchId;
        official = false;
        frame = null;
        if (data.partyClosed) await leaveParty();
        else returnLobby();
        return;
      }
      if (data.type === "authenticated") {
        identity = data.id;
        reconnectAt = 0;
        retry = 0;
        try {
          await api(
            "/profile",
            {
              name: profile().name,
              color: profile().color,
            },
            { timeoutMs: 20000 },
          );
        } catch (error) {
          if (socket !== connection || closed) return;
          connectionError = error;
          $("hcs-service").textContent = error.message;
          draw();
          if (
            error.code === "REQUEST_TIMEOUT" ||
            error instanceof TypeError ||
            error.status >= 500
          )
            connection.close(1013, "Retrying profile registration");
          return;
        }
        if (socket !== connection || closed) return;
        streamReady = true;
        connectionError = null;
        if (watching) send({ type: "watch" });
        poll();
        draw();
      }
      if (data.type === "snapshot") {
        if (data.matchId === declined) return;
        if (data.tournament === false) {
          if (mapFailure) {
            mapFailure = null;
            if ($("hcs-retry-map")) $("hcs-retry-map").hidden = true;
            setText("hcs-service", "Official standings · 20-second broadcast delay");
          }
          official = true;
          disconnected = false;
          lastSnapshotAt = Date.now();
          updateConnectionUI();
          frame = data;
          applyOfficial({
            id: data.matchId,
            epoch: data.epoch,
            frame: data.frame,
            mapId: data.mapId,
            state: data.state,
            profiles: data.profiles,
          });
          return;
        }
        if (!watching && data.spectator) return;
        disconnected = false;
        lastSnapshotAt = Date.now();
        frame = data;
        await prepareFinal(connection);
        if (active) syncRoster();
        updateConnectionUI();
      }
    };
    socket.onclose = (event) => {
      if (socket !== connection || closed) return;
      streamReady = false;
      if (event?.code === 1008 && event.reason === "Authentication failed") {
        connectionError = serviceError(401, "AUTH_REQUIRED");
        $("hcs-service").textContent = connectionError.message;
      }
      draw();
      disconnected = true;
      updateConnectionUI();
      socket = null;
      if (active)
        $("hcs-broadcast-label").textContent = watching
          ? "RECONNECTING · 20s DELAY"
          : "RECONNECTING · 60s TO RETURN";
      if (active && !watching)
        $("hcs-service").textContent =
          "Reconnecting · your character remains vulnerable for 60 seconds.";
      if (!closed) {
        const delay = Math.min(15000, 1000 * 2 ** Math.min(retry++, 4));
        reconnectAt = Date.now() + delay;
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, delay);
      }
    };
    socket.onerror = () => {};
  }
  function send(data) {
    if (socket?.readyState === 1 && socket.bufferedAmount < 65536)
      socket.send(JSON.stringify(data));
  }
  const stopHeldInput = () => {
    if (!closed && (active || official) && !watching && window.Game)
      send({ type: "input", input: neutralInput(window.Game.input()) });
  };
  const visibilityInput = () => {
    if (document.hidden) stopHeldInput();
  };
  window.addEventListener("blur", stopHeldInput);
  document.addEventListener("visibilitychange", visibilityInput);
  const timer = setInterval(() => {
      countdown();
      updateConnectionUI();
      connect();
    }, 1000),
    poller = setInterval(poll, 10000),
    inputTimer = setInterval(() => {
      if ((active || official) && !watching && window.Game)
        send({
          type: "input",
          input:
            document.hidden || document.body.classList.contains("menu")
              ? neutralInput(window.Game.input())
              : window.Game.input(),
        });
    }, 33);
  $("hcs-checkin").onclick = async () => {
    if (checkingIn) return;
    checkingIn = true;
    draw();
    try {
      const next = await api("/checkin", {});
      if (closed) return;
      stateRevision++;
      state = next;
      draw();
    } catch (e) {
      if (!closed) $("hcs-service").textContent = e.message;
    } finally {
      checkingIn = false;
      if (!closed) draw();
    }
  };
  if ($("hcs-retry-map")) $("hcs-retry-map").onclick = async () => {
    if (!mapFailure || loading || !streamReady) return;
    await prepareFinal(socket, true);
  };
  $("hcs-watch").onclick = () => {
    if (competing()) return;
    if (watching && !active) {
      stop();
      draw();
      return;
    }
    watching = true;
    declined = null;
    send({ type: "watch" });
    $("hcs-service").textContent =
      "Connecting to broadcast · waiting for the delayed feed.";
    draw();
  };
  $("hcs-view-player").onchange = () => {
    viewed = $("hcs-view-player").value;
    window.Game.clear();
  };
  const stop = () => {
    const forfeit = official;
    transition++;
    celebration.reset();
    finaleKey = "";
    window.Duel.spectating = null;
    declined = frame?.matchId;
    active = false;
    official = false;
    watching = false;
    frame = null;
    mapFailure = null;
    if ($("hcs-retry-map")) $("hcs-retry-map").hidden = true;
    lastSnapshotAt = 0;
    updateConnectionUI();
    seen = 0;
    send({ type: "leave", forfeit, matchId: declined });
    $("hcs-broadcast").hidden = true;
    document.body.classList.remove("hcs-match");
    returnLobby();
  };
  $("hcs-return").onclick = stop;
  $("hcs-service").textContent = valid
    ? "Connecting to HCS…"
    : "HCS service is not connected yet. Standings will appear when it goes online.";
  draw();
  poll();
  connect();
  return {
    get championship() {
      return active && !official;
    },
    get active() {
      return active || official;
    },
    get official() {
      return official;
    },
    async updateProfile() {
      if (!valid || !identity || socket?.readyState !== 1) return;
      const connection = socket;
      try {
        await api("/profile", {
          name: profile().name,
          color: profile().color,
        });
        if (socket !== connection || closed) return;
        streamReady = true;
        connectionError = null;
        poll();
      } catch (error) {
        if (socket !== connection || closed) return;
        streamReady = false;
        connectionError = error;
        $("hcs-service").textContent = error.message;
      }
      draw();
    },
    async endParty(room) {
      if (!official || !frame?.matchId) return;
      const matchId = frame.matchId;
      await api("/party-end", { room, matchId });
      if (frame?.matchId === matchId) stop();
    },
    async startParty(room, map, mode) {
      if (!valid) return false;
      declined = null;
      const deadline = Date.now() + 45000,
        requestId = crypto.randomUUID();
      // A public /state response does not prove the player stream or profile is ready.
      while (!streamReady || socket?.readyState !== 1) {
        if (closed) throw new Error("HCS connection was closed.");
        if (connectionError) throw connectionError;
        if (Date.now() >= deadline)
          throw new Error(
            "Your HCS player connection could not open. Check Northflank’s HCS_ORIGINS includes this website, redeploy the service, and reload both players’ pages.",
          );
        connect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (;;) {
        try {
          await api(
            "/party-start",
            { room, map, mode, requestId },
            {
              timeoutMs: Math.max(1000, Math.min(30000, deadline - Date.now())),
            },
          );
          return true;
        } catch (error) {
          // A stable request ID also makes a lost creation response safe to retry: the server reuses that match.
          if (
            closed ||
            !(
              error.code === "PARTY_CONNECTING" ||
              error.code === "REQUEST_TIMEOUT" ||
              error instanceof TypeError
            ) ||
            Date.now() >= deadline
          )
            throw error;
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    },
    render(dt) {
      if (official) return false;
      if (!active || !frame) return false;
      const s = frame.state;
      const final = celebration.update(s, frame.profiles, identity, {
        spectator: watching,
      });
      if (final) {
        viewed = final.id;
        if (finaleKey !== final.key) {
          finaleKey = final.key;
          window.Game.clear();
          document.exitPointerLock?.();
        }
      }
      let p = s.players.find((p) => p.id === viewed);
      if ((!p || p.hp <= 0) && s.phase === "playing") {
        const living = s.players.find((p) => p.hp > 0);
        if (living) {
          p = living;
          viewed = living.id;
          $("hcs-view-player").value = viewed;
          window.Game.clear();
        }
      }
      if (!p) return true;
      const colors = Object.fromEntries(
        frame.profiles.map((p) => [p.id, p.color]),
      );
      if (watching || viewed !== identity)
        window.Game.look(p.yaw, p.pitch || 0);
      window.Game.apply(
        final ? hcsHeroState(s, final.cinematic) : s,
        viewed,
        colors,
        dt,
      );
      window.Duel.spectating =
        final || watching || viewed !== identity ? viewed : null;
      if (!disconnected)
        setText("hcs-broadcast-label", watching
          ? "20 SECOND DELAY"
          : viewed !== identity
            ? "ELIMINATED · SPECTATING"
            : "CHAMPIONSHIP FINAL");
      for (const event of s.events || []) {
        if (event.id > seen) window.Game.effect(event, viewed, s);
        seen = Math.max(seen, event.id);
      }
      const chip = $("net-ping"),
        chipText = watching ? "HCS · 20s DELAY" : "HCS · OFFICIAL FINAL";
      if (chip && chip.textContent !== chipText) chip.textContent = chipText;
      const alive = s.players.filter((p) => p.hp > 0).length;
      setText(
        "hcs-watch-stats",
        `${Math.ceil(p.hp)} HP · ${s.tournamentKills?.[p.id] || 0} KILLS · ${alive} LEFT${s.phase === "done" ? " · FINAL COMPLETE" : ""}`,
      );
      return true;
    },
    moveInventory(operation) {
      if ((!active && !official) || watching) return false;
      send({ type: "inventory", operation });
      return true;
    },
    stop,
    close() {
      celebration.reset();
      closed = true;
      updateConnectionUI();
      clearTimeout(reconnectTimer);
      clearInterval(timer);
      clearInterval(poller);
      clearInterval(inputTimer);
      window.removeEventListener("blur", stopHeldInput);
      document.removeEventListener("visibilitychange", visibilityInput);
      transition++;
      socket?.close();
    },
  };
}
