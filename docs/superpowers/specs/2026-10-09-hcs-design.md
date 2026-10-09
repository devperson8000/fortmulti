# Approved HCS concept

User approved implementation on 9 October 2026 after the in-chat design and final choices. No additional design approval is required.

HCS runs every third Sunday at19:00 Australia/Sydney, anchored1November2026. DST follows Sydney wall time, not a fixed UTC interval. Qualifying scores reset per21-day season; career totals persist. Normal online matches in both existing gamemodes count; local/testing and HCS finals do not. Score100perwin+10perkill; minimum10completed games. Deterministic tie breaks: wins, kills, win rate, player ID. Rankings lock48h before; top5 invited and ranks6–9 on standby.

Check-in18:45; all5 present start at19:00. Grace expires19:05; fill vacant places from checked-in ranks6–9 inrank order. Start with3–4 when reserves exhausted; fewer3postpones this edition one week to nextSunday19:00, retaining qualified roster. The regular21-day anchor remains unchanged. Connectivity reconnect60seconds; avatar stays vulnerable, timeout counts elimination. One gun-only TownRoyale onPlatform23, last survivor champion until nextfinal. Official results/statistics are computed by an independent server using the existing simulation, not browser claims.

HCS tab immediately rightofCharacter contains always-active countdown, global leaderboard, champion/qualification/check-in status and WatchHCS during final. Home promotional card below logo appears7days before. Watchers receive only snapshots at least20seconds old, can switch players, and never occupy competitor slots or control simulation. Public result/champion publication waits20seconds to avoid leaking the winner ahead of broadcast.

First visit requires a valid nickname only before play. Nickname and hidden identity persist, no email/password. Names do not claim another identity's stats. Previously polished maps, weapons, grips, movement, chests and audio remain unchanged; only opt-in HCS/official-match bridge hooks and a tournament storm override are allowed.

Production uses existing anonymous Supabase identity, service-only persistent HCS state, and a dedicated long-running WebSocket referee. StaticVercel hosting alone cannot run a reliable continuous five-player simulation. No production credentials exist in this execution environment; implement complete service, migration, configuration and local integration tests, and report activation prerequisites honestly. Never publish fabricated ranks/results or expose service-role secrets.

Implementation ruling: an edition with fewer than three eligible qualifiers reopens qualification for its postponed week, retaining existing qualified places, so an initially empty ranking cannot postpone forever without admitting new players.
