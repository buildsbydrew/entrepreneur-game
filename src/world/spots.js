// Spots: places on furniture and around a place where someone can do something. A chair has a seat, a
// bed has a place to lie, a stove a place to cook, a flower bed a place to kneel. Props add them as they're
// built; people (and the player) use them. Each spot knows where to stand up to afterwards.
//
//   { kind: 'sit' | 'lie' | 'cook' | 'kneel' | 'play' | 'lean', x, z, facing, height, stand: { x, z }, table }
import * as THREE from 'three';

// Adds a spot to a prop, from a point in the prop's own space (before it's turned)
//   lx, lz: where, in the prop's space; turn: extra turn of the facing (Math.PI faces the prop's back)
//   stand: where to stand up to, in the prop's space
export function addSpot(ctx, p, kind, lx, lz, { height = 0, turn = 0, stand = null, table = false } = {}) {
  if (!ctx.spot) return;
  const r = -THREE.MathUtils.degToRad(p.rot ?? 0);
  const world = (x, z) => ({ x: p.x + x * Math.cos(r) + z * Math.sin(r), z: p.z - x * Math.sin(r) + z * Math.cos(r) });
  const at = world(lx, lz);
  ctx.spot({ kind, ...at, facing: r + turn, height, stand: stand ? world(stand[0], stand[1]) : null, table });
}

// The nearest free spot of a kind (or kinds) to a point, within reach
export function nearestSpot(spots, kinds, x, z, within = 2.5, who = null) {
  const list = [].concat(kinds);
  let best = null;
  let bestD = within;
  for (const s of spots) {
    if (!list.includes(s.kind) || (s.taken && s.taken !== who)) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}
