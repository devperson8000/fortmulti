import { canStandAt, moveHorizontal } from "./movement-collision.js";
const cached = new WeakMap();
// Static practice-only routes. Edges are checked with the game's own body
// collision and supported floor heights, then cached for the whole test.
export function createLabNavigation(world, grid) {
  if (cached.has(world)) return cached.get(world);
  const cellSize = grid.cellSize,
    near = (x, z) => {
      const boxes = new Set();
      for (
        let a = Math.floor((x - 3) / cellSize);
        a <= Math.floor((x + 3) / cellSize);
        a++
      )
        for (
          let b = Math.floor((z - 3) / cellSize);
          b <= Math.floor((z + 3) / cellSize);
          b++
        )
          for (const box of grid.cells.get(a * 65536 + b) || []) boxes.add(box);
      return [...boxes];
    },
    nodes = [],
    lookup = new Map(),
    key = (x, z) => x + "," + z;
  for (let x = -84; x <= 84; x += 2)
    for (let z = -48; z <= 48; z += 2) {
      const y = world.height(x, z),
        boxes = near(x, z);
      if (
        !Number.isFinite(y) ||
        y < -1 ||
        y > 4.1 ||
        !canStandAt([x, y, z], boxes)
      )
        continue;
      nodes.push({ p: [x, y, z], links: null });
      lookup.set(key(x, z), nodes.length - 1);
    }
  const nearest = (p) => {
      let best = -1,
        d = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const q = nodes[i].p,
          n = Math.hypot(q[0] - p[0], q[2] - p[2]) + Math.abs(q[1] - p[1]) * 4;
        if (n < d) {
          d = n;
          best = i;
        }
      }
      return best;
    },
    edge = (a, b) => {
      const steps = 8,
        dx = (b[0] - a[0]) / steps,
        dz = (b[2] - a[2]) / steps,
        p = a.slice(),
        boxes = near((a[0] + b[0]) / 2, (a[2] + b[2]) / 2);
      for (let i = 0; i < steps; i++) {
        const x = p[0],
          z = p[2];
        moveHorizontal(p, dx, dz, boxes);
        if (Math.abs(p[0] - x - dx) > 0.01 || Math.abs(p[2] - z - dz) > 0.01)
          return false;
        const y = world.supportHeight
          ? world.supportHeight(p[0], p[2], p[1], 0.55)
          : world.height(p[0], p[2]);
        if (!Number.isFinite(y) || Math.abs(y - p[1]) > 0.55) return false;
        p[1] = y;
      }
      return Math.abs(p[1] - b[1]) < 0.2;
    },
    links = (i) => {
      const node = nodes[i];
      if (node.links) return node.links;
      node.links = [];
      for (const [dx, dz] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ]) {
        const j = lookup.get(key(node.p[0] + dx, node.p[2] + dz));
        if (j !== undefined && edge(node.p, nodes[j].p)) node.links.push(j);
      }
      return node.links;
    },
    nav = {
      route(from, to) {
        const start = nearest(from),
          goal = nearest(to);
        if (start < 0 || goal < 0) return [];
        const parents = new Int32Array(nodes.length).fill(-1),
          queue = [start];
        parents[start] = start;
        for (let i = 0; i < queue.length && parents[goal] === -1; i++)
          for (const n of links(queue[i]))
            if (parents[n] === -1) {
              parents[n] = queue[i];
              queue.push(n);
            }
        let end = goal;
        if (parents[end] === -1) {
          end = queue.reduce(
            (best, n) =>
              Math.hypot(nodes[n].p[0] - to[0], nodes[n].p[2] - to[2]) <
              Math.hypot(nodes[best].p[0] - to[0], nodes[best].p[2] - to[2])
                ? n
                : best,
            start,
          );
        }
        const path = [];
        for (let n = end; n !== start; n = parents[n]) path.push(nodes[n].p);
        path.push(nodes[start].p);
        return path.reverse().map((p) => p.slice());
      },
    };
  cached.set(world, nav);
  return nav;
}
