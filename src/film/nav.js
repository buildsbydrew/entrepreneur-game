// Finding a way around a place for the autopilot: a grid over the ground, walls and furniture marked
// as blocked, and the shortest way through (A*), then straightened so the walk looks natural.
const CELL = 0.1;

function blockedAt(space, x, z, r) {
  const b = space.bounds;
  if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
  return space.solids.some(s => x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ);
}

export function buildGrid(space, radius) {
  const b = space.bounds;
  const w = Math.floor((b.maxX - b.minX) / CELL);
  const h = Math.floor((b.maxZ - b.minZ) / CELL);
  const free = new Uint8Array(w * h);
  const r = radius + 0.005; // the body itself; cells are small enough to find the way through a doorway
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = b.minX + (i + 0.5) * CELL;
      const z = b.minZ + (j + 0.5) * CELL;
      free[j * w + i] = blockedAt(space, x, z, r) ? 0 : 1;
    }
  }
  return { space, w, h, free, minX: b.minX, minZ: b.minZ, radius: r };
}

const cellOf = (g, x, z) => [
  Math.min(g.w - 1, Math.max(0, Math.floor((x - g.minX) / CELL))),
  Math.min(g.h - 1, Math.max(0, Math.floor((z - g.minZ) / CELL)))
];
const centre = (g, i, j) => ({ x: g.minX + (i + 0.5) * CELL, z: g.minZ + (j + 0.5) * CELL });

// The free cell nearest to a point (the point itself may be inside a bed or a wall)
function nearestFree(g, x, z) {
  const [ci, cj] = cellOf(g, x, z);
  if (g.free[cj * g.w + ci]) return [ci, cj];
  for (let ring = 1; ring < 40; ring++) {
    let best = null;
    let bestD = Infinity;
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= g.w || j >= g.h || !g.free[j * g.w + i]) continue;
        const c = centre(g, i, j);
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }
    if (best) return best;
  }
  return [ci, cj];
}

// Can you walk in a straight line from a to b?
function clear(g, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(d / 0.05);
  for (let k = 1; k <= steps; k++) {
    const x = a.x + (b.x - a.x) * k / steps;
    const z = a.z + (b.z - a.z) * k / steps;
    if (blockedAt(g.space, x, z, g.radius + 0.01)) return false;
  }
  return true;
}

// The way from one point to another, as a short list of points. Empty if there's no way.
// others: people standing about ({ x, z, r }) to walk around.
export function findPath(base, from, to, others = []) {
  const g = { ...base, free: base.free.slice() };
  for (const o of others) {
    const reach = o.r + base.radius;
    const [i0, j0] = cellOf(g, o.x - reach, o.z - reach);
    const [i1, j1] = cellOf(g, o.x + reach, o.z + reach);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = centre(g, i, j);
        if (Math.hypot(c.x - o.x, c.z - o.z) < reach) g.free[j * g.w + i] = 0;
      }
    }
  }
  const [si, sj] = nearestFree(g, from.x, from.z);
  const [ti, tj] = nearestFree(g, to.x, to.z);
  const start = sj * g.w + si;
  const goal = tj * g.w + ti;
  const n = g.w * g.h;
  const cost = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = [start]; // a simple binary heap on estimated total
  const score = new Float32Array(n).fill(Infinity);
  const est = k => Math.hypot((k % g.w) - ti, Math.floor(k / g.w) - tj);
  cost[start] = 0;
  score[start] = est(start);
  const push = k => {
    open.push(k);
    let c = open.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (score[open[p]] <= score[open[c]]) break;
      [open[p], open[c]] = [open[c], open[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = open[0];
    const last = open.pop();
    if (open.length) {
      open[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < open.length && score[open[l]] < score[open[m]]) m = l;
        if (r < open.length && score[open[r]] < score[open[m]]) m = r;
        if (m === c) break;
        [open[m], open[c]] = [open[c], open[m]];
        c = m;
      }
    }
    return top;
  };
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false;
  while (open.length) {
    const k = pop();
    if (closed[k]) continue;
    if (k === goal) { found = true; break; }
    closed[k] = 1;
    const i = k % g.w;
    const j = Math.floor(k / g.w);
    for (const [di, dj, c] of dirs) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue;
      const nk = nj * g.w + ni;
      if (!g.free[nk] || closed[nk]) continue;
      if (di && dj && (!g.free[j * g.w + ni] || !g.free[nj * g.w + i])) continue; // no cutting corners
      const nc = cost[k] + c;
      if (nc < cost[nk]) {
        cost[nk] = nc;
        came[nk] = k;
        score[nk] = nc + est(nk);
        push(nk);
      }
    }
  }
  if (!found) return [];
  const cells = [];
  for (let k = goal; k !== -1; k = came[k]) cells.push(centre(g, k % g.w, Math.floor(k / g.w)));
  cells.reverse();
  // Straighten: skip every point you can see past
  const path = [];
  let anchor = { x: from.x, z: from.z };
  let i = 0;
  while (i < cells.length) {
    let far = i;
    for (let k = cells.length - 1; k > i; k--) {
      if (clear(g, anchor, cells[k])) { far = k; break; }
    }
    path.push(cells[far]);
    anchor = cells[far];
    i = far + 1;
  }
  return path;
}
