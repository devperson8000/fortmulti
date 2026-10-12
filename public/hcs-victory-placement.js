import { boundsIntersectCollider, rayCollider } from "./collision-shapes.js";
const point = (p, yaw, d) => [
  p[0] - Math.sin(yaw) * d,
  p[1],
  p[2] - Math.cos(yaw) * d,
];
export function victoryPickupPlacement(winner, world) {
  const source = winner.p.slice(),
    originalYaw = Number(winner.yaw) || 0,
    obstacles = world.obstacles || [];
  const floor = (x, z, y) =>
    world.supportHeight
      ? world.supportHeight(x, z, y, 0.55)
      : world.height(x, z);
  const clear = (p) => {
    if (!Number.isFinite(p[1]) || p[1] < -1) return false;
    if (world.isLandingClear && !world.isLandingClear(p[0], p[2], p[1], 1.22))
      return false;
    if (
      obstacles.some(
        (b) =>
          b.type !== "surface" &&
          boundsIntersectCollider(
            {
              min: [p[0] - 1.1, p[1] + 0.08, p[2] - 1.1],
              max: [p[0] + 1.1, p[1] + 3.9, p[2] + 1.1],
            },
            b,
          ),
      )
    )
      return false;
    for (const dx of [-0.8, 0, 0.8])
      for (const dz of [-0.8, 0, 0.8]) {
        if (Math.abs(floor(p[0] + dx, p[2] + dz, p[1]) - p[1]) > 0.3)
          return false;
        if (
          obstacles.some(
            (b) =>
              rayCollider([p[0] + dx, p[1] + 0.15, p[2] + dz], [0, 1, 0], b) <
              70,
          )
        )
          return false;
      }
    return true;
  };
  const path = (a, b) => {
    for (let i = 0; i <= 12; i++) {
      const q = a.map((v, k) => v + ((b[k] - v) * i) / 12),
        h = floor(q[0], q[2], q[1]);
      if (
        Math.abs(h - q[1]) > 0.55 ||
        obstacles.some((box) =>
          boundsIntersectCollider(
            {
              min: [q[0] - 0.4, h + 0.08, q[2] - 0.4],
              max: [q[0] + 0.4, h + 1.75, q[2] + 0.4],
            },
            box,
          ),
        )
      )
        return false;
    }
    return true;
  };
  for (const distance of [4.4, 5.4, 6.4])
    for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI]) {
      const yaw = originalYaw + turn,
        p = point(source, yaw, distance);
      p[1] = floor(p[0], p[2], source[1]);
      if (clear(p) && path(source, p))
        return {
          winner: source,
          yaw,
          originalYaw,
          landing: p,
          relocated: false,
        };
    }
  // An indoor finish needs an outdoor rescue shot: use the nearest existing
  // verified landing pad, rather than descending a capsule through the roof.
  for (const site of [...(world.landingPoints || world.pois || [])].sort(
    (a, b) =>
      Math.hypot(a.x - source[0], a.z - source[2]) -
      Math.hypot(b.x - source[0], b.z - source[2]),
  )) {
    const p = [site.x, world.height(site.x, site.z), site.z];
    if (!clear(p)) continue;
    for (const yaw of [originalYaw, 0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const start = point(p, yaw, -4.4);
      start[1] = floor(start[0], start[2], p[1]);
      if (path(start, p))
        return {
          winner: start,
          yaw,
          originalYaw: yaw,
          landing: p,
          relocated: true,
        };
    }
  }
  // Islands have open terrain beyond named landing zones.
  for (let distance = 8; distance <= 40; distance += 4)
    for (let i = 0; i < 16; i++) {
      const yaw = originalYaw + (i * Math.PI) / 8,
        p = point(source, yaw, distance);
      p[1] = floor(p[0], p[2], source[1]);
      if (!clear(p)) continue;
      const start = point(p, yaw, -4.4);
      start[1] = floor(start[0], start[2], p[1]);
      if (path(start, p))
        return {
          winner: start,
          yaw,
          originalYaw: yaw,
          landing: p,
          relocated: true,
        };
    }
  return {
    winner: source,
    yaw: originalYaw,
    originalYaw,
    landing: point(source, originalYaw, 4.4),
    relocated: false,
  };
}
