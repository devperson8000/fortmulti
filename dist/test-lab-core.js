import { Match } from "./simulation.js";
import { FinalMatch, Referee } from "./hcs-referee-core.js";
import { Championship, DelayedFeed } from "./hcs-championship.js";
import { HCS, nextEdition, nickname } from "./hcs-rules.js";
import { safeLandingPoint } from "./deployment-sequence.js";
import { SHIP_PODS, shipWorld } from "./deployment-ship.js";
import { createWeaponItem } from "./weapon-inventory.js";
import { WEAPON_TYPES } from "./weapon-system.js";

// A temporary UI gate for isolated practice, never an administrative credential.
export const labPasswordMatches = (value) => value === "12345";
const tones = [
  "408faf",
  "d6ad72",
  "638b66",
  "ba7470",
  "8d80b5",
  "8cb7b9",
  "a9a677",
  "869ab2",
];
export const LAB_KITS = {
  standard: ["ar", "shotgun", "smg", "sniper", "ar_sentinel"],
  variants: [
    "ar_sentinel",
    "shotgun_breacher",
    "smg_viper",
    "sniper_longbow",
    "ar",
  ],
};

export class LabSession {
  constructor(
    world,
    {
      kind = "combat",
      map = "facility",
      mode = "town",
      count = 8,
      name = "Test Ranger",
      pods = false,
    } = {},
  ) {
    if (
      !["combat", "pods", "hcs"].includes(kind) ||
      !["facility", "island"].includes(map)
    )
      throw Error("Choose a supported test.");
    this.kind = kind;
    this.map = map;
    this.hcs = kind === "hcs";
    this.localId = "lab-player";
    this.count = this.hcs
      ? 5
      : Math.max(2, Math.min(8, Math.floor(count) || 8));
    this.fire = false;
    this.profiles = Array.from({ length: this.count }, (_, i) => ({
      id: i ? "lab-bot-" + i : this.localId,
      name: i ? "TEST OPERATOR " + (i + 1) : nickname(name),
      color: tones[i],
    }));
    const ids = this.profiles.map((p) => p.id);
    this.match = this.hcs
      ? new FinalMatch(world, ids)
      : new Match(
          world,
          ids,
          map === "facility" ? "town" : mode === "build" ? "build" : "town",
        );
    this.referee = this.hcs ? new Referee(this.match, false) : null;
    this.feed = this.referee?.feed || new DelayedFeed();
    this.lastAt = 0;
    this.kit = "standard";
    if (this.hcs) {
      this.championship = new Championship();
      for (const p of this.profiles)
        this.championship.register(p.id, p.name, p.color);
      Object.assign(this.championship.state, { phase: "live", finalists: ids });
    }
    if (kind === "pods" || pods) {
      if (this.referee) this.referee.board();
      else {
        this.match.beginDeployment();
        this.board();
      }
    } else this.land();
    this.equipKit("standard", false);
    this.latest = this.match.snapshot();
  }
  board() {
    const reserved = [];
    for (const [i, p] of this.match.players.entries()) {
      const point = this.match.world.pois?.[
        i % this.match.world.pois.length
      ] || { x: -35 + i * 6, z: 19 };
      const safe = safeLandingPoint(point, this.match.world, reserved);
      if (!safe || !this.match.chooseLanding(p.id, safe))
        throw Error("No safe test landing zone.");
      reserved.push(safe);
      const pod = SHIP_PODS[i];
      p.shipLocal = [pod.x, 0, pod.z + pod.entryOffset];
      p.p = shipWorld(p.shipLocal);
      if (!this.match.enterPod(p.id)) throw Error("Test pod could not board.");
    }
  }
  land() {
    this.match.phase = "playing";
    this.match.deployment.stage = "match_active";
    const reserved = [];
    for (const [i, p] of this.match.players.entries()) {
      const point = {
        x: (this.map === "facility" ? -35 : 0) + (i % 4) * 4,
        z: (this.map === "facility" ? 19 : 0) + Math.floor(i / 4) * 5,
      };
      const safe = safeLandingPoint(point, this.match.world, reserved);
      if (!safe) throw Error("No safe test spawn.");
      reserved.push(safe);
      Object.assign(p, {
        p: [safe.x, safe.y, safe.z],
        yaw: Math.PI,
        air: "landed",
        deploymentState: "match_active",
        dropState: "landed",
        shipLocal: null,
        pod: null,
        grounded: true,
        slot: 1,
        weapon: "ar",
        equip: 0,
      });
      if (this.match.world.rules?.building !== false)
        p.materials = { wood: 1000, stone: 1000 };
    }
  }
  equipKit(kit, revision = true) {
    if (!LAB_KITS[kit]) throw Error("Unknown test kit.");
    this.kit = kit;
    for (const p of this.match.players) {
      p.inventory = LAB_KITS[kit].map((type, i) =>
        createWeaponItem(`${p.id}:${kit}:${i}`, type),
      );
      if (revision) p.inventoryRevision++;
      p.reload = 0;
      p.equip = 0;
      p.slot = this.match.phase === "deployment" ? 0 : 1;
      p.weapon = p.slot ? p.inventory[0].type : null;
    }
  }
  botInput(p, index) {
    const t = this.match.elapsed + index * 1.13,
      target =
        this.match.players.filter(
          (other) =>
            other.id !== p.id && other.id !== this.localId && other.hp > 0,
        )[index % Math.max(1, this.count - 2)] || this.match.players[0];
    const dx = target.p[0] - p.p[0],
      dz = target.p[2] - p.p[2],
      cycle = t % 10;
    return {
      x: Math.sin(t * 0.6) > 0.1 ? 0.75 : -0.75,
      z: Math.cos(t * 0.47) > 0.1 ? 0.5 : -0.5,
      yaw: Math.atan2(-dx, -dz),
      pitch: this.fire
        ? Math.atan2(target.p[1] - p.p[1], Math.hypot(dx, dz))
        : 0.55,
      slot: 1 + (Math.floor(t / 8) % 5),
      fire: this.match.phase === "playing" && (this.fire || cycle < 1.2),
      sprint: cycle < 3,
      crouch: (cycle > 2 && cycle < 2.15) || (cycle > 4 && cycle < 4.15),
      reload: p.ammo === 0,
    };
  }
  tick(dt, now, input = {}, audioElapsed = null) {
    const round = this.match.round;
    this.match.input(
      this.localId,
      this.botLocal ? this.botInput(this.match.players[0], 0) : input,
    );
    for (const [i, p] of this.match.players.entries())
      if (p.id !== this.localId) {
        const value = this.botInput(p, i);
        if (this.referee) this.referee.input(p.id, value);
        else this.match.input(p.id, value);
      }
    if (this.referee) {
      let remaining = Math.min(0.25, Math.max(0, dt));
      while (remaining > 1e-8) {
        const step = Math.min(0.05, remaining);
        this.latest = this.referee.tick(step, now);
        remaining -= step;
      }
    } else {
      this.match.tickElapsed(dt, { deploymentElapsed: audioElapsed });
      this.latest = this.match.snapshot();
    }
    if (this.match.round !== round) {
      if (this.referee) this.referee.board();
      else this.board();
      this.equipKit(this.kit, false);
      this.latest = {
        ...this.match.snapshot(),
        ...(this.referee ? { tournamentKills: { ...this.referee.kills } } : {}),
      };
    }
    // Store one frame per simulation update; catch-up substeps must not evict the
    // 20-second broadcast history earlier on machines with uneven frame times.
    this.feed.push(now, this.latest);
    this.lastAt = now;
    if (
      this.hcs &&
      this.match.phase === "done" &&
      this.championship.state.phase === "live"
    )
      this.championship.finish(this.match.ids[this.match.winner], now);
    return this.latest;
  }
  packet(now, spectator = false) {
    let state = this.latest,
      sampleAt = this.lastAt;
    if (spectator) {
      const entry = this.feed.frames.findLast((f) => f.at <= now - HCS.delay);
      sampleAt = entry?.at;
      state = this.feed.at(now);
      if (!state) return null;
    }
    return {
      testOnly: true,
      kind: this.kind,
      map: this.map,
      spectator,
      sampleAt,
      profiles: this.profiles,
      state,
      champion: this.championship?.public(now).champion || null,
    };
  }
  disconnect(id, now) {
    if (this.referee) this.referee.disconnect(id, now);
  }
  reconnect(id, now) {
    return this.referee?.reconnect(id, now) || false;
  }
  finish(now, id = this.localId) {
    if (
      this.match.phase !== "playing" ||
      !this.match.players.some((p) => p.id === id && p.hp > 0)
    )
      return false;
    for (const p of this.match.players)
      if (p.id !== id) this.match.disconnect(p.id);
    this.match.checkRoundEnd();
    this.tick(1 / 30, now, {});
    return true;
  }
  spawnArsenal() {
    const p = this.match.players[0];
    if (p.air !== "landed") return false;
    for (const [i, type] of WEAPON_TYPES.entries()) {
      const x = p.p[0] + ((i % 4) - 1.5) * 1.5,
        z = p.p[2] - 4 - Math.floor(i / 4) * 2,
        y = this.match.world.height(x, z);
      if (!Number.isFinite(y)) continue;
      const id = `lab-arsenal:${i}`;
      this.match.pickups = this.match.pickups.filter((item) => item.id !== id);
      this.match.pickups.push({
        id,
        type,
        x,
        y,
        z,
        ammo: createWeaponItem(id, type).ammo,
      });
    }
    return true;
  }
}

export class FrameMetrics {
  constructor(capacity = 1800) {
    this.values = new Float32Array(capacity);
    this.index = 0;
    this.count = 0;
    this.totalFrames = 0;
  }
  frame(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.values[this.index] = ms;
    this.index = (this.index + 1) % this.values.length;
    this.count = Math.min(this.values.length, this.count + 1);
    this.totalFrames++;
  }
  report() {
    const values = Array.from(this.values.subarray(0, this.count)).sort(
        (a, b) => a - b,
      ),
      sum = values.reduce((a, b) => a + b, 0);
    return {
      samples: this.count,
      totalFrames: this.totalFrames,
      fps: sum ? (1000 * this.count) / sum : 0,
      p50Ms: values[Math.floor((values.length - 1) * 0.5)] || 0,
      p95Ms: values[Math.floor((values.length - 1) * 0.95)] || 0,
      longFrames: values.filter((v) => v > 1000 / 30).length,
      maxMs: values.at(-1) || 0,
    };
  }
}

export function runHCSChecks(world) {
  const results = [],
    check = (name, run) => {
      try {
        if (!run()) throw Error("Unexpected result.");
        results.push({ name, passed: true });
      } catch (e) {
        results.push({ name, passed: false, error: e.message });
      }
    };
  const seed = () => {
    const c = new Championship(null, Date.now());
    for (let i = 0; i < 9; i++) {
      const p = c.register("q" + i, "TEST " + (i + 1));
      Object.assign(p, { games: 10, wins: 9 - i, kills: 30 - i });
    }
    return c;
  };
  check("Nickname validation", () => {
    try {
      nickname("<bad>");
      return false;
    } catch {
      return nickname("Test Ranger") === "Test Ranger";
    }
  });
  check("Ten games required · wins and kills rank players", () => {
    const c = seed();
    c.register("new", "New Ranger");
    return c.public().ranks.length === 9 && c.public().ranks[0].id === "q0";
  });
  check("Qualification locks 48 hours before HCS", () => {
    const c = seed();
    c.advance(c.state.at - HCS.freeze);
    c.state.players.q8.wins = 500;
    return c.state.phase === "locked" && c.public().ranks[0].id === "q0";
  });
  check("Check-in opens 15 minutes before HCS", () => {
    const c = seed();
    c.advance(c.state.at - HCS.checkin);
    c.checkin("q0", c.state.at - HCS.checkin);
    return c.state.phase === "checkin" && c.state.checked.includes("q0");
  });
  check("Ranks 6–9 replace absent finalists after five-minute grace", () => {
    const c = seed(),
      at = c.state.at;
    c.advance(at - HCS.checkin);
    for (const id of ["q0", "q1", "q2", "q3", "q5"]) c.checkin(id, at - 1000);
    return (
      c.advance(at, new Set(c.state.checked)) === null &&
      c.advance(at + HCS.grace, new Set(c.state.checked))?.join(",") ===
        "q0,q1,q2,q3,q5"
    );
  });
  check("Fewer than three checked-in players postpones one week", () => {
    const c = seed(),
      at = c.state.at;
    c.advance(at - HCS.checkin);
    c.checkin("q0", at - 1);
    c.advance(at + HCS.grace);
    return c.state.postponed && c.state.at > at + 6 * 86400000;
  });
  check(
    "Champion remains private until the 20-second broadcast catches up",
    () => {
      const c = seed();
      Object.assign(c.state, {
        phase: "live",
        finalists: ["q0", "q1", "q2", "q3", "q4"],
      });
      c.finish("q0", 1000);
      return (
        c.public(20999).champion === null &&
        c.public(21000).champion?.id === "q0"
      );
    },
  );
  check("Sunday at 7pm Sydney · three-week schedule", () => {
    const a = nextEdition(Date.now()),
      b = nextEdition(a.at + 1),
      parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: HCS.zone,
        weekday: "long",
        hour: "numeric",
        hourCycle: "h23",
      }).format(a.at);
    return (
      parts.includes("Sunday") &&
      parts.includes("19") &&
      b.at - a.at >= 20 * 86400000 &&
      b.at - a.at <= 22 * 86400000
    );
  });
  check("Broadcast waits the full 20 seconds", () => {
    const feed = new DelayedFeed();
    feed.push(1000, { test: true });
    return feed.at(20999) === null && feed.at(21000)?.test;
  });
  check("Competitor reconnect keeps the original 60-second deadline", () => {
    const s = new LabSession(world, { kind: "hcs", map: "facility" }),
      id = s.match.ids[1];
    s.disconnect(id, 1000);
    s.disconnect(id, 50000);
    s.tick(1 / 30, 60999, {});
    const alive = s.match.players[1].hp > 0;
    s.tick(1 / 30, 61000, {});
    return alive && s.match.players[1].hp === 0 && !s.reconnect(id, 61001);
  });
  return results;
}
