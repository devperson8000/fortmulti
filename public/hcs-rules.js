export const HCS = {
  zone: "Australia/Sydney",
  delay: 20000,
  grace: 300000,
  checkin: 900000,
  freeze: 172800000,
  promo: 604800000,
  reconnect: 60000,
};
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HCS.zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function sydneyEvening(year, month, day) {
  const date = new Date(Date.UTC(year, month, day, 19));
  let utc = date.getTime();
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      formatter.formatToParts(utc).map((x) => [x.type, x.value]),
    );
    const observed = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    utc += date.getTime() - observed;
  }
  return utc;
}
export function editionAt(index) {
  return sydneyEvening(2026, 10, 1 + 21 * index);
}
export function postponeAt(at) {
  const p = Object.fromEntries(
    formatter.formatToParts(at).map((x) => [x.type, x.value]),
  );
  return sydneyEvening(+p.year, +p.month - 1, +p.day + 7);
}
export function nextEdition(now = Date.now()) {
  let index = Math.max(0, Math.floor((now - editionAt(0)) / 1814400000));
  while (editionAt(index) <= now) index++;
  return { index, at: editionAt(index) };
}
export function leaderboard(players) {
  return players
    .filter((p) => p.games >= 10)
    .map((p) => ({ ...p, points: p.wins * 100 + p.kills * 10 }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.kills - a.kills ||
        b.wins / b.games - a.wins / a.games ||
        String(a.id).localeCompare(String(b.id)),
    );
}
export function selectFinalists(ranks, present) {
  return ranks
    .slice(0, 9)
    .filter((p) => present.has(p.id))
    .slice(0, 5)
    .map((p) => p.id);
}
export function nickname(value) {
  const name = String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 20 || /[\p{C}<>]/u.test(name))
    throw new Error("Use a callsign of 2–20 characters.");
  return name;
}
