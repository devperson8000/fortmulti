import {
  HCS,
  postponeAt,
  nextEdition,
  leaderboard,
  selectFinalists,
  nickname,
} from "./hcs-rules.js";
export class Championship {
  constructor(state = null, now = Date.now()) {
    const edition = nextEdition(now);
    this.state = state || {
      edition: edition.index,
      at: edition.at,
      phase: "qualifying",
      players: {},
      career: {},
      recorded: [],
      ranks: null,
      checked: [],
      champion: null,
      history: [],
    };
  }
  register(id, name, color) {
    name = nickname(name);
    const p = this.state.players[id] || { id, games: 0, wins: 0, kills: 0 };
    p.name = name;
    p.color = /^[0-9a-f]{6}$/i.test(color || "") ? color : p.color || "408faf";
    this.state.players[id] = p;
    return p;
  }
  recordVerifiedMatch(matchId, results, now = Date.now()) {
    this.freeze(now);
    if (this.state.recorded.includes(matchId)) return false;
    this.state.recorded.push(matchId);
    for (const r of results) {
      const p = this.register(r.id, r.name),
        career = this.state.career[r.id] || { games: 0, wins: 0, kills: 0 };
      for (const target of [p, career]) {
        target.games++;
        target.wins += Number(Boolean(r.winner));
        target.kills += Math.max(0, Math.floor(r.kills || 0));
      }
      this.state.career[r.id] = career;
    }
    return true;
  }
  checkin(id, now = Date.now()) {
    if (
      now < this.state.at - HCS.checkin ||
      now > this.state.at + HCS.grace ||
      !["locked", "checkin"].includes(this.state.phase)
    )
      throw new Error("Check-in is not open.");
    if (!this.state.ranks?.slice(0, 9).some((p) => p.id === id))
      throw new Error("Only qualified players and reserves may check in.");
    if (!this.state.checked.includes(id)) this.state.checked.push(id);
  }
  freeze(now) {
    const s = this.state;
    if (s.phase === "qualifying" && now >= s.at - HCS.freeze) {
      const retained = s.retainedRanks || [],
        ids = new Set(retained.map((p) => p.id));
      s.ranks = [
        ...retained,
        ...leaderboard(Object.values(s.players)).filter((p) => !ids.has(p.id)),
      ].slice(0, 9);
      delete s.retainedRanks;
      s.phase = "locked";
    }
  }
  advance(now = Date.now(), present = null) {
    const s = this.state;
    if (s.phase === "complete" && now >= s.champion.publishedAt) {
      const edition = nextEdition(now);
      s.edition = edition.index;
      s.at = edition.at;
      s.phase = "qualifying";
      s.ranks = null;
      s.checked = [];
      s.players = Object.fromEntries(
        Object.values(s.players).map((p) => [
          p.id,
          { ...p, games: 0, wins: 0, kills: 0 },
        ]),
      );
      s.recorded = [];
      s.postponed = false;
      s.finalists = [];
    }
    this.freeze(now);
    if (s.phase === "locked" && now >= s.at - HCS.checkin) s.phase = "checkin";
    if (s.phase === "checkin" && now >= s.at) {
      const connected = new Set(
          s.checked.filter((id) => !present || present.has(id)),
        ),
        top = s.ranks.slice(0, 5);
      if (
        (top.length === 5 && top.every((p) => connected.has(p.id))) ||
        now >= s.at + HCS.grace
      ) {
        const ids = selectFinalists(s.ranks, connected);
        if (ids.length < 3) {
          this.postpone();
        } else {
          s.phase = "live";
          s.finalists = ids;
          return ids;
        }
      }
    }
    return null;
  }
  postpone() {
    const s = this.state;

    s.at = postponeAt(s.at);
    s.phase = "locked";
    if (s.ranks.length < 3) {
      s.retainedRanks = s.ranks;
      s.ranks = null;
      s.phase = "qualifying";
    }
    s.checked = [];
    s.postponed = true;
  }
  finish(id, now = Date.now()) {
    if (this.state.phase !== "live" || !this.state.finalists.includes(id))
      return false;
    const winner = this.state.players[id];
    this.state.champion = {
      id,
      name: winner.name,
      edition: this.state.edition,
      publishedAt: now + HCS.delay,
    };
    this.state.history.push(this.state.champion);
    this.state.phase = "complete";
    return true;
  }
  public(now = Date.now()) {
    const s = this.state;
    return {
      at: s.at,
      edition: s.edition,
      phase:
        s.phase === "complete" && now < s.champion.publishedAt
          ? "live"
          : s.phase,
      ranks: (s.ranks || leaderboard(Object.values(s.players))).map((p, i) => ({
        ...p,
        rank: i + 1,
      })),
      champion: s.champion && now >= s.champion.publishedAt ? s.champion : null,
      checked: s.checked,
      postponed: !!s.postponed,
    };
  }
}
export class DelayedFeed {
  constructor() {
    this.frames = [];
  }
  push(now, snapshot) {
    this.frames.push({ at: now, data: structuredClone(snapshot) });
    while (this.frames.length > 750) this.frames.shift();
  }
  at(now) {
    const cutoff = now - HCS.delay;
    let frame = null;
    for (const entry of this.frames) {
      if (entry.at > cutoff) break;
      frame = entry;
    }
    while (this.frames.length > 1 && this.frames[1].at <= cutoff)
      this.frames.shift();
    return frame?.data || null;
  }
}
