import http from "node:http";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Championship } from "./hcs-state.mjs";
import { Referee } from "./hcs-referee.mjs";
import { Match } from "../public/simulation.js";
import { officialWorld } from "./hcs-world.mjs";
import { HCS, postponeAt } from "../public/hcs-rules.js";
export async function createHCSServer({
  authenticate,
  load,
  save,
  authorizeParty = async () => null,
  origins = [],
  now = Date.now,
  heartbeatMs = 15000,
} = {}) {
  const championship = new Championship(await load(), now()),
    clients = new Map(),
    matches = new Map(),
    startingRooms = new Set();
  let referee = null,
    finalId = null,
    finalFinishedAt = null,
    finalAbandoned = false,
    creating = false,
    dirty = false,
    saving = false,
    savePromise = null,
    lastSave = 0;
  // A process restart cannot reconstruct a partially played authoritative final.
  if (championship.state.phase === "live") {
    championship.state.phase = "locked";
    championship.state.at = postponeAt(championship.state.at);
    championship.state.checked = [];
    championship.state.postponed = true;
    dirty = true;
  }
  const send = (ws, data) => {
    if (ws.readyState === 1) {
      if (ws.bufferedAmount > 262144) {
        ws.close(1013, "Connection is too slow");
        return;
      }
      ws.send(JSON.stringify(data));
    }
  };
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.writeHead(204).end();
      return;
    }
    try {
      if (req.url === "/state" && req.method === "GET") {
        res.end(JSON.stringify(championship.public(now())));
        return;
      }
      if (
        !["/profile", "/checkin", "/party-start"].includes(req.url) ||
        req.method !== "POST"
      ) {
        res.writeHead(404).end("{}");
        return;
      }
      const user = await authenticate(
        req.headers.authorization?.replace(/^Bearer /, ""),
      );
      if (!user) {
        res.writeHead(401).end("{}");
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 2048) {
          res.writeHead(413).end("{}");
          return;
        }
      }
      const data = JSON.parse(body || "{}");
      if (req.url === "/party-start") {
        const roster = await authorizeParty(user.id, data.room);
        if (
          !roster ||
          roster.length < 2 ||
          roster.length > 8 ||
          !["build", "town"].includes(data.mode) ||
          !["island", "facility"].includes(data.map)
        ) {
          res.writeHead(403).end("{}");
          return;
        }
        if (
          startingRooms.has(data.room) ||
          matches.has(data.room) ||
          matches.size >= 8 ||
          roster.some(
            (id) =>
              !championship.state.players[id] ||
              ![...clients.values()].some((c) => c.id === id && !c.watching),
          ) ||
          roster.some(
            (id) =>
              [...matches.values()].some((m) =>
                m.referee.match.ids.includes(id),
              ) ||
              (championship.state.phase === "live" &&
                championship.state.finalists?.includes(id)),
          )
        ) {
          res.writeHead(409).end("{}");
          return;
        }
        startingRooms.add(data.room);
        try {
          const world = await officialWorld(data.map),
            id = randomUUID(),
            ref = new Referee(new Match(world, roster, data.mode), false);
          if (
            championship.state.phase === "live" &&
            roster.some((id) => championship.state.finalists?.includes(id))
          ) {
            res.writeHead(409).end("{}");
            return;
          }
          for (const c of clients.values())
            if (roster.includes(c.id)) c.exited = false;
          matches.set(data.room, {
            id,
            referee: ref,
            mapId: data.map,
            epoch: now(),
            frame: 0,
            kills: Object.fromEntries(roster.map((id) => [id, 0])),
            seen: 0,
            finishedAt: null,
          });
          res.end(JSON.stringify({ id }));
        } finally {
          startingRooms.delete(data.room);
        }
        return;
      }
      if (
        req.url === "/checkin" &&
        ![...clients.values()].some((c) => c.id === user.id && !c.watching)
      ) {
        res.writeHead(409).end("{}");
        return;
      }
      if (req.url === "/profile")
        championship.register(user.id, data.name, data.color);
      else {
        championship.checkin(user.id, now());
        for (const c of clients.values())
          if (c.id === user.id && !c.watching) c.exited = false;
      }
      dirty = true;
      res.end(JSON.stringify(championship.public(now())));
    } catch {
      res.writeHead(400).end(
        JSON.stringify({
          error:
            "Request could not be accepted. Check your callsign and tournament status.",
        }),
      );
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 8192,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/stream" || !origins.includes(req.headers.origin)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();
  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    let identity = null,
      busy = false,
      count = 0,
      bucket = now();
    const timeout = setTimeout(
      () => ws.close(1008, "Authentication required"),
      10000,
    );
    ws.on("message", async (raw) => {
      if (now() - bucket >= 1000) {
        bucket = now();
        count = 0;
      }
      if (++count > 65) {
        ws.close(1008, "Too many messages");
        return;
      }
      try {
        const data = JSON.parse(raw.toString());
        if (!identity) {
          if (busy || data.type !== "auth") return;
          busy = true;
          const user = await authenticate(data.token);
          if (!user || ws.readyState !== 1) {
            ws.close(1008, "Authentication failed");
            return;
          }
          identity = user.id;
          clearTimeout(timeout);
          clients.set(ws, { id: identity, watching: false, exited: false });
          referee?.reconnect(identity, now());
          for (const m of matches.values())
            m.referee.reconnect(identity, now());
          send(ws, { type: "authenticated", id: identity });
          return;
        }
        const client = clients.get(ws);
        if (data.type === "watch") {
          client.exited = false;
          client.watching = true;
          send(ws, { type: "watching", delay: HCS.delay });
        }
        if (data.type === "leave") {
          client.exited = true;
          client.watching = false;
          referee?.disconnect(identity, now());
          for (const m of matches.values())
            m.referee.disconnect(identity, now());
        }
        if (data.type === "leave-watch") client.watching = false;
        if (data.type === "input" && !client.watching && !client.exited) {
          referee?.input(identity, data.input);
          for (const m of matches.values())
            m.referee.input(identity, data.input);
        }
        if (
          data.type === "inventory" &&
          !client.watching &&
          !client.exited &&
          referee?.match.ids.includes(identity)
        )
          referee.match.moveInventory(identity, data.operation);
        if (data.type === "inventory" && !client.watching && !client.exited)
          for (const m of matches.values())
            if (m.referee.match.ids.includes(identity))
              m.referee.match.moveInventory(identity, data.operation);
      } catch {
        ws.close(1008, "Invalid message");
      }
    });
    ws.on("close", () => {
      clearTimeout(timeout);
      clients.delete(ws);
      if (
        identity &&
        ![...clients.values()].some((c) => c.id === identity && !c.watching)
      ) {
        referee?.disconnect(identity, now());
        for (const m of matches.values()) m.referee.disconnect(identity, now());
      }
    });
  });
  const timer = setInterval(async () => {
    try {
      const time = now(),
        before = JSON.stringify([
          championship.state.phase,
          championship.state.at,
        ]),
        ids = championship.advance(
          time,
          new Set(
            [...clients.values()]
              .filter((c) => !c.watching && !c.exited)
              .map((c) => c.id),
          ),
        );
      if (
        before !==
        JSON.stringify([championship.state.phase, championship.state.at])
      )
        dirty = true;
      if (ids && !creating) {
        creating = true;
        try {
          for (const [room, m] of matches) {
            if (!m.referee.match.ids.some((id) => ids.includes(id))) continue;
            for (const [ws, c] of clients)
              if (m.referee.match.ids.includes(c.id))
                send(ws, { type: "match-cancelled", matchId: m.id });
            matches.delete(room);
          }
          referee = await Referee.create(ids);
          finalId = `hcs-${championship.state.edition}-${randomUUID()}`;
          finalFinishedAt = null;
          finalAbandoned = false;
          for (const id of ids)
            if (![...clients.values()].some((c) => c.id === id && !c.watching))
              referee.disconnect(id, time);
        } catch {
          championship.state.phase = "locked";
          championship.state.at = postponeAt(championship.state.at);
          championship.state.checked = [];
          championship.state.postponed = true;
        } finally {
          creating = false;
          dirty = true;
        }
      }
      for (const [room, m] of matches) {
        const state = m.referee.tick(1 / 30, time);
        if (state.phase === "abandoned") {
          for (const [ws, c] of clients)
            if (m.referee.match.ids.includes(c.id))
              send(ws, { type: "match-cancelled", matchId: m.id });
          matches.delete(room);
          continue;
        }
        for (const e of state.events) {
          if (
            e.id > m.seen &&
            e.type === "elimination" &&
            e.by &&
            e.by !== e.hit &&
            e.by in m.kills
          )
            m.kills[e.by]++;
          m.seen = Math.max(m.seen, e.id);
        }
        if (state.phase === "done" && !m.finishedAt) {
          m.finishedAt = time;
          const winner = state.players[state.winner]?.id;
          championship.recordVerifiedMatch(
            m.id,
            state.players.map((p) => ({
              id: p.id,
              name: championship.state.players[p.id].name,
              kills: m.kills[p.id],
              winner: p.id === winner,
            })),
            time,
          );
          dirty = true;
        }
        for (const [ws, c] of clients)
          if (!c.watching && !c.exited && m.referee.match.ids.includes(c.id))
            send(ws, {
              type: "snapshot",
              tournament: false,
              state,
              mapId: m.mapId,
              matchId: m.id,
              epoch: m.epoch,
              frame: ++m.frame,
              profiles: m.referee.match.ids.map(
                (id) => championship.state.players[id],
              ),
            });
        if (m.finishedAt && time - m.finishedAt > 10000) matches.delete(room);
      }
      if (referee) {
        const state = referee.tick(1 / 30, time);
        if (state.phase === "done" && championship.state.phase === "live") {
          championship.finish(state.players[state.winner].id, time);
          finalFinishedAt = time;
          dirty = true;
        }
        if (state.phase === "abandoned" && finalFinishedAt === null) {
          finalFinishedAt = time;
          finalAbandoned = true;
        }
        if (
          finalAbandoned &&
          time >= finalFinishedAt + HCS.delay &&
          championship.state.phase === "live"
        ) {
          championship.postpone();
          dirty = true;
        }
        const delayed = referee.feed.at(time);
        for (const [ws, c] of clients) {
          const view = c.exited
            ? null
            : c.watching
              ? delayed
              : referee.match.ids.includes(c.id) &&
                  ![...matches.values()].some((m) =>
                    m.referee.match.ids.includes(c.id),
                  )
                ? state
                : null;
          if (view)
            send(ws, {
              type: "snapshot",
              state: view,
              mapId: "facility",
              matchId: finalId,
              profiles: referee.match.ids.map((id) => ({
                id,
                name: championship.state.players[id]?.name || "Player",
                color: championship.state.players[id]?.color || "408faf",
              })),
              spectator: c.watching,
            });
        }
      }
      if (
        referee &&
        finalFinishedAt !== null &&
        time >= finalFinishedAt + HCS.delay + (finalAbandoned ? 0 : 60000)
      ) {
        for (const [ws, c] of clients)
          if (c.watching || referee.match.ids.includes(c.id))
            send(ws, { type: "broadcast-ended", matchId: finalId });
        referee = null;
        finalFinishedAt = null;
      }
      if (dirty && !saving && time - lastSave >= 1000) {
        saving = true;
        const copy = structuredClone(championship.state);
        dirty = false;
        try {
          savePromise = Promise.resolve().then(() => save(copy));
          await savePromise;
          lastSave = time;
        } catch {
          dirty = true;
        } finally {
          saving = false;
          savePromise = null;
        }
      }
    } catch (error) {
      console.error("HCS referee tick failed:", error.message);
    }
  }, 1000 / 30);
  timer.unref();
  return {
    server,
    championship,
    get referee() {
      return referee;
    },
    async close() {
      clearInterval(timer);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
      if (savePromise) await savePromise.catch(() => {});
      if (dirty) await save(structuredClone(championship.state));
    },
  };
}
async function main() {
  const {
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: key,
    SUPABASE_SERVICE_ROLE_KEY: service,
    HCS_ORIGINS: originList,
  } = process.env;
  if (!url || !key || !service || !originList)
    throw new Error("Configure Supabase server credentials and HCS_ORIGINS.");
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    "Content-Type": "application/json",
  };
  const request = async (path, options = {}) => {
    const response = await fetch(url + path, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("HCS persistence unavailable");
    return response.status === 204 ? null : response.json();
  };
  const owner = randomUUID(),
    claim = () =>
      request("/rest/v1/rpc/hcs_claim_lease", {
        method: "POST",
        body: JSON.stringify({ p_owner: owner }),
      });
  if (!(await claim())) throw new Error("Another referee already owns HCS.");
  const instance = await createHCSServer({
    origins: originList.split(",").map((s) => s.trim()),
    authenticate: async (token) => {
      if (!token) return null;
      try {
        const response = await fetch(url + "/auth/v1/user", {
          headers: { apikey: key, Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    },
    authorizeParty: async (id, room) => {
      if (!/^[0-9a-f-]{36}$/i.test(room || "")) return null;
      const rooms = await request(
        `/rest/v1/duel_rooms?id=eq.${room}&host=eq.${id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`,
      );
      if (!rooms.length) return null;
      const members = await request(
        `/rest/v1/duel_room_members?room_id=eq.${room}&last_seen=gt.${encodeURIComponent(new Date(Date.now() - 60000).toISOString())}&select=user_id`,
      );
      return members.map((p) => p.user_id);
    },
    load: async () => {
      const rows = await request(
        "/rest/v1/horizon_hcs_state?id=eq.1&select=state",
      );
      return rows[0]?.state || null;
    },
    save: (state) =>
      request("/rest/v1/rpc/hcs_save_state", {
        method: "POST",
        body: JSON.stringify({ p_owner: owner, p_state: state }),
      }),
  });
  const leaseTimer = setInterval(async () => {
    try {
      if (!(await claim())) throw new Error("Lease lost");
    } catch {
      clearInterval(leaseTimer);
      console.error("HCS referee lease renewal failed; closing safely.");
      await instance.close().catch(() => {});
      process.exitCode = 1;
    }
  }, 10000);
  leaseTimer.unref();
  instance.server.listen(Number(process.env.PORT || 4201), "0.0.0.0");
  console.log("HCS referee listening");
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      clearInterval(leaseTimer);
      return instance.close().then(() => process.exit());
    });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
