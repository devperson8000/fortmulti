import { Match } from "./simulation.js";
import {
  loadPlatformMap,
  platformLayout,
  PLATFORM_POIS,
} from "./platform23-map.js";
import { SHIP_PODS, shipWorld } from "./deployment-ship.js";
import { HCS } from "./hcs-rules.js";
import { DelayedFeed } from "./hcs-championship.js";
export class FinalMatch extends Match {
  constructor(world, ids) {
    super(world, ids, "town");
    this.targetScore = 1;
  }
  finishCombatTick(dt) {
    const radius = Math.max(5, 100 - this.elapsed * 0.2);
    for (const p of this.players)
      if (p.hp > 0 && Math.hypot(p.p[0], p.p[2]) > radius) this.hit(p, 7 * dt);
    this.mode = "build";
    try {
      super.finishCombatTick(dt);
    } finally {
      this.mode = "town";
    }
  }
  snapshot() {
    return {
      ...super.snapshot(),
      stormRadius: Math.max(5, 100 - this.elapsed * 0.2),
    };
  }
}
export class Referee {
  static async create(ids) {
    if (ids.length < 3 || ids.length > 5 || new Set(ids).size !== ids.length)
      throw new Error("Final requires three to five distinct players.");
    await loadPlatformMap();
    return new Referee(new FinalMatch(platformLayout(), ids));
  }
  constructor(match, autoBoard = true) {
    this.match = match;
    this.autoBoard = autoBoard;
    this.kills = Object.fromEntries(match.ids.map((id) => [id, 0]));
    this.seen = 0;
    this.absent = new Map();
    this.feed = new DelayedFeed();
    this.match.beginDeployment();
    if (autoBoard) this.board();
  }
  board() {
    const match = this.match;
    for (const [i, p] of match.players.entries()) {
      const poi = PLATFORM_POIS[i],
        pod = SHIP_PODS[i];
      match.chooseLanding(p.id, { x: poi.x, z: poi.z });
      p.shipLocal = [pod.x, 0, pod.z + pod.entryOffset];
      p.p = shipWorld(p.shipLocal);
      if (!match.enterPod(p.id))
        throw new Error("Tournament pod could not board.");
    }
  }
  input(id, input) {
    if (
      this.absent.has(id) ||
      !this.match.ids.includes(id) ||
      this.match.disconnected.has(id)
    )
      return false;
    this.match.input(id, input);
    return true;
  }
  disconnect(id, now = Date.now()) {
    if (
      this.match.ids.includes(id) &&
      !this.absent.has(id) &&
      !this.match.disconnected.has(id)
    ) {
      this.absent.set(id, now);
      this.match.input(id, {});
    }
  }
  reconnect(id, now = Date.now()) {
    if (!this.match.ids.includes(id) || this.match.disconnected.has(id))
      return false;
    const since = this.absent.get(id);
    if (since !== undefined && now - since >= HCS.reconnect) {
      return false;
    }
    this.absent.delete(id);
    return true;
  }
  tick(dt, now = Date.now()) {
    const expired = [...this.absent].filter(
      ([, since]) => now - since >= HCS.reconnect,
    );
    if (expired.length && this.match.phase !== "done") {
      const phase = this.match.phase;
      this.match.phase = "paused";
      for (const [id] of expired) {
        this.match.disconnect(id);
        this.absent.delete(id);
      }
      this.match.phase = phase;
      if (this.match.ids.every((id) => this.match.disconnected.has(id))) {
        this.match.phase = "abandoned";
        this.match.winner = -1;
      } else this.match.checkRoundEnd();
    }
    const round = this.match.round;
    if (this.match.phase !== "abandoned") this.match.tick(dt);
    if (this.autoBoard && round !== this.match.round) this.board();
    const snapshot = this.match.snapshot();
    for (const e of snapshot.events) {
      if (
        e.id > this.seen &&
        e.type === "elimination" &&
        e.by &&
        e.by !== e.hit &&
        e.by in this.kills
      )
        this.kills[e.by]++;
      this.seen = Math.max(this.seen, e.id);
    }
    snapshot.tournamentKills = { ...this.kills };
    if (this.autoBoard) this.feed.push(now, snapshot);
    return snapshot;
  }
}
