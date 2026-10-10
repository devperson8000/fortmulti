import { HCS, nextEdition } from "./hcs-rules.js";
import { rememberIdentity } from "./nickname.js";
const $ = (id) => document.getElementById(id);
export function createHCS({
  config,
  session,
  profile,
  leaveParty,
  returnLobby,
  applyOfficial,
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
    checkingIn = false;
  const base = String(config.hcsUrl || "").replace(/\/$/, "");
  const valid =
    /^https:\/\/[^/]+$/.test(base) ||
    (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) &&
      ["localhost", "127.0.0.1"].includes(location.hostname));
  const api = async (path, data) => {
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
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new Error("HCS service is unavailable. Please try again.");
    return response.json();
  };
  const countdown = () => {
    const seconds = Math.max(0, Math.ceil((state.at - Date.now()) / 1000)),
      days = Math.floor(seconds / 86400),
      hours = Math.floor((seconds % 86400) / 3600),
      minutes = Math.floor((seconds % 3600) / 60),
      s = seconds % 60;
    const text = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    $("hcs-countdown").textContent = text;
    $("hcs-promo-time").textContent = text;
    $("hcs-date").textContent = new Intl.DateTimeFormat("en-AU", {
      timeZone: HCS.zone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(state.at);
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
    $("hcs-checkin").disabled ||= checkingIn || !identity;
    $("hcs-checkin").textContent = checkingIn
      ? "CHECKING IN…"
      : state.checked?.includes(identity)
        ? "CHECKED IN"
        : "CHECK IN";
    $("hcs-watch").hidden = state.phase !== "live";
    $("hcs-watch").disabled = !identity;
    $("hcs-watch").textContent =
      watching && !active ? "CANCEL WATCH" : "WATCH HCS";
    $("hcs-champion").textContent = state.champion
      ? `REIGNING CHAMPION · ${state.champion.name}`
      : "";
  }
  async function poll() {
    if (!valid) return;
    try {
      state = await api("/state");
      $("hcs-service").textContent =
        watching && !active
          ? "Connecting to broadcast · waiting for the 20-second delayed feed."
          : "Official standings · 20-second broadcast delay";
      draw();
    } catch {
      $("hcs-service").textContent =
        "HCS is temporarily offline. Your ordinary games remain available.";
    }
  }
  function connect() {
    if (!valid || closed || (socket && socket.readyState < 2)) return;
    const auth = session();
    if (!auth?.access_token) return;
    rememberIdentity(auth);
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
        official = false;
        frame = null;
        returnLobby();
        return;
      }
      if (data.type === "authenticated") {
        disconnected = false;
        identity = data.id;
        retry = 0;
        await api("/profile", {
          name: profile().name,
          color: profile().color,
        }).catch(() => {});
        if (socket !== connection || closed) return;
        if (watching) send({ type: "watch" });
        draw();
      }
      if (data.type === "snapshot") {
        if (data.matchId === declined) return;
        if (data.tournament === false) {
          official = true;
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
        frame = data;
        if (!active && !loading) {
          loading = true;
          const version = transition;
          try {
            await leaveParty();
            if (version !== transition || socket !== connection || closed)
              return;
            await window.Game.setMap(data.mapId);
            if (version !== transition || socket !== connection || closed)
              return;
            active = true;
            window.Duel.lobby = false;
            document.body.classList.remove(
              "in-lobby",
              "menu",
              "hcs-open",
              "profile-open",
              "character-preview-open",
            );
            $("lobby").hidden = true;
            document.body.classList.add("hcs-match");
            $("hcs-broadcast").hidden = false;
            viewed = data.spectator ? data.state.players[0].id : identity;
            window.Game.look(
              data.state.players.find((p) => p.id === viewed)?.yaw || 0,
            );
            $("hcs-broadcast-label").textContent = data.spectator
              ? "20 SECOND DELAY"
              : "CHAMPIONSHIP FINAL";
          } finally {
            loading = false;
          }
        }
        if (active) {
          const nextRoster = JSON.stringify(
            data.profiles.map((p) => [p.id, p.name]),
          );
          if (nextRoster !== rosterKey) {
            rosterKey = nextRoster;
            const previous = $("hcs-view-player").value;
            $("hcs-view-player").replaceChildren(
              ...data.profiles.map((p) => {
                const option = document.createElement("option");
                option.value = p.id;
                option.textContent = p.name;
                return option;
              }),
            );
            $("hcs-view-player").value = data.profiles.some(
              (p) => p.id === previous,
            )
              ? previous
              : viewed;
          }
          $("hcs-view-player").hidden = !watching;
        }
      }
    };
    socket.onclose = () => {
      if (socket !== connection || closed) return;
      disconnected = true;
      socket = null;
      if (active)
        $("hcs-broadcast-label").textContent = watching
          ? "RECONNECTING · 20s DELAY"
          : "RECONNECTING · 60s TO RETURN";
      if (active && !watching)
        $("hcs-service").textContent =
          "Reconnecting · your character remains vulnerable for 60 seconds.";
      if (!closed)
        setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(retry++, 4)));
    };
    socket.onerror = () => {};
  }
  function send(data) {
    if (socket?.readyState === 1 && socket.bufferedAmount < 65536)
      socket.send(JSON.stringify(data));
  }
  const timer = setInterval(() => {
      countdown();
      connect();
    }, 1000),
    poller = setInterval(poll, 10000),
    inputTimer = setInterval(() => {
      if (
        (active || official) &&
        !watching &&
        window.Game &&
        !document.body.classList.contains("menu")
      )
        send({ type: "input", input: window.Game.input() });
    }, 33);
  $("hcs-checkin").onclick = async () => {
    if (checkingIn) return;
    checkingIn = true;
    draw();
    try {
      state = await api("/checkin", {});
      draw();
    } catch (e) {
      $("hcs-service").textContent = e.message;
    } finally {
      checkingIn = false;
      draw();
    }
  };
  $("hcs-watch").onclick = () => {
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
    transition++;
    window.Duel.spectating = null;
    declined = frame?.matchId;
    active = false;
    official = false;
    watching = false;
    frame = null;
    seen = 0;
    send({ type: "leave" });
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
    get active() {
      return active || official;
    },
    get official() {
      return official;
    },
    async updateProfile() {
      if (valid && identity)
        await api("/profile", {
          name: profile().name,
          color: profile().color,
        }).catch(() => {});
    },
    async startParty(room, map, mode) {
      if (!valid) return false;
      declined = null;
      await api("/party-start", { room, map, mode });
      return true;
    },
    render(dt) {
      if (official) return false;
      if (!active || !frame) return false;
      const s = frame.state;
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
      window.Game.apply(s, viewed, colors, dt);
      window.Duel.spectating = watching || viewed !== identity ? viewed : null;
      if (!disconnected)
        $("hcs-broadcast-label").textContent = watching
          ? "20 SECOND DELAY"
          : viewed !== identity
            ? "ELIMINATED · SPECTATING"
            : "CHAMPIONSHIP FINAL";
      for (const event of s.events || []) {
        if (event.id > seen) window.Game.effect(event, viewed, s);
        seen = Math.max(seen, event.id);
      }
      const chip = $("net-ping"),
        chipText = watching ? "HCS · 20s DELAY" : "HCS · OFFICIAL FINAL";
      if (chip && chip.textContent !== chipText) chip.textContent = chipText;
      const alive = s.players.filter((p) => p.hp > 0).length;
      $("hcs-watch-stats").textContent =
        `${Math.ceil(p.hp)} HP · ${s.tournamentKills?.[p.id] || 0} KILLS · ${alive} LEFT${s.phase === "done" ? " · FINAL COMPLETE" : ""}`;
      return true;
    },
    moveInventory(operation) {
      if ((!active && !official) || watching) return false;
      send({ type: "inventory", operation });
      return true;
    },
    stop,
    close() {
      closed = true;
      clearInterval(timer);
      clearInterval(poller);
      clearInterval(inputTimer);
      transition++;
      socket?.close();
    },
  };
}
