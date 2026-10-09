import { loadPlatformMap } from "../public/platform23-map.js";
import {
  militaryLayout,
  islandHeight,
  ISLAND_POIS,
  islandRoadRibbon,
  forestTreePlacements,
  MAP_SOURCE,
} from "../public/island-map.js";
let cached;
export async function officialWorld(map) {
  if (map === "facility") return loadPlatformMap();
  if (map !== "island") throw new Error("Unknown map");
  if (cached) return cached;
  const layout = militaryLayout(),
    obstacles = layout.parts
      .filter((p) => p.solid)
      .map((p) => ({
        surface: "stone",
        min: p.position.map((v, k) => v - p.size[k] / 2),
        max: p.position.map((v, k) => v + p.size[k] / 2),
      })),
    chests = layout.chests.slice(),
    resources = [],
    clusters = [],
    roads = layout.roads.map(islandRoadRibbon),
    nearRoad = (x, z) =>
      roads.some((points) =>
        points.some((p) => Math.hypot(p.center[0] - x, p.center[2] - z) < 11),
      );
  let seed = 428;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 560; i++) {
    const x = (rnd() - 0.5) * 560,
      z = (rnd() - 0.5) * 560,
      y = islandHeight(x, z),
      s = 9 + rnd() * 5;
    if (
      y < 2 ||
      Math.hypot(x * 0.96, z) > 276 ||
      ISLAND_POIS.some(
        (p) => Math.abs(x - p.x) < 53 && Math.abs(z - p.z) < 53,
      ) ||
      nearRoad(x, z) ||
      clusters.some((p) => Math.hypot(p.x - x, p.z - z) < 13) ||
      Math.abs(islandHeight(x + 5, z) - islandHeight(x - 5, z)) > 3 ||
      Math.abs(islandHeight(x, z + 5) - islandHeight(x, z - 5)) > 3
    )
      continue;
    const angle = rnd() * Math.PI * 2;
    clusters.push({ x, z });
    for (const [index, tree] of forestTreePlacements(x, z, s, angle).entries())
      resources.push({
        id: `tree:${i}:${index}`,
        kind: "wood",
        x: tree.x,
        y: tree.y,
        z: tree.z,
        hp: 100,
      });
    if (i % 23 === 0) {
      const cx = x + s * 0.7;
      chests.push({
        id: `chest:forest:${i}`,
        x: cx,
        y: islandHeight(cx, z),
        z,
      });
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = (rnd() - 0.5) * 550,
      z = (rnd() - 0.5) * 550,
      y = islandHeight(x, z);
    if (
      y < 1 ||
      Math.hypot(x, z) > 275 ||
      ISLAND_POIS.some(
        (p) => Math.abs(x - p.x) < 52 && Math.abs(z - p.z) < 52,
      ) ||
      nearRoad(x, z)
    )
      continue;
    rnd();
    resources.push({ id: `rock:${i}`, kind: "stone", x, y, z, hp: 100 });
  }
  return (cached = {
    height: islandHeight,
    obstacles,
    resources,
    chests,
    map: MAP_SOURCE,
    pois: ISLAND_POIS,
    minLandingHeight: 0,
  });
}
