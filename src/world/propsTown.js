// Props for the wider town: the school, the hospital, the High Street and Kestrel Park.
// They work exactly like the ones in props.js (same rules, same style), and Place.js looks in both.
import * as THREE from 'three';
import { mesh, rbox, box, cyl, ball, at, flat, textTexture } from '../render/shapes.js';
import { PROPS } from './props.js';
import { addSpot } from './spots.js';

// A solid box turned a quarter swaps width and depth
function turned(p, w, d) {
  return (p.rot ?? 0) % 180 === 90 ? [d, w] : [w, d];
}

function group(p, ctx) {
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  g.rotation.y = -THREE.MathUtils.degToRad(p.rot ?? 0);
  ctx.add(g);
  return g;
}

// A board with words, facing the camera (south)
function board(text, w, h, opts = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textTexture(text, opts), roughness: 0.9 }));
}

export const TOWN_PROPS = {
  // ---------- School ----------

  // A pupil's desk with its chair behind it (the chair is on the north side; pupils face north)
  desk(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(0.9, 0.06, 0.55, '#c99257', 0.02), 0, 0.62, 0));
    for (const sx of [-0.38, 0.38]) g.add(at(rbox(0.05, 0.6, 0.5, '#6c6f73', 0.01), sx, 0.3, 0));
    g.add(at(rbox(0.4, 0.04, 0.3, '#fff4dc', 0.01), -0.12, 0.66, 0.02)); // an open exercise book
    g.add(at(rbox(0.4, 0.05, 0.4, '#2f5fd0', 0.02), 0, 0.4, 0.55));       // the chair seat
    g.add(at(rbox(0.4, 0.4, 0.05, '#2f5fd0', 0.02), 0, 0.62, 0.75));
    ctx.solid(p.x, p.z + 0.25, ...turned(p, 0.9, 1.05));
    addSpot(ctx, p, 'sit', 0, 0.5, { height: 0.42, turn: Math.PI, stand: [0.65, 0.5], table: true });
  },

  // The teacher's desk
  teacherDesk(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(1.6, 0.75, 0.8, '#8d5524', 0.04), 0, 0.38, 0));
    g.add(at(rbox(0.5, 0.08, 0.35, '#fff4dc', 0.02), -0.3, 0.8, 0));
    g.add(at(ball(0.1, '#d94b3d', 8, 6), 0.45, 0.85, 0)); // an apple
    ctx.solid(p.x, p.z, ...turned(p, 1.6, 0.8));
  },

  // A green board on the wall, with today's lesson on it: { x, z, text }
  blackboard(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(3.2, 1.3, 0.08, '#8d5524', 0.03), 0, 1.6, 0));
    const b = board(p.text ?? 'Sunhill Primary', 3.0, 1.1, { bg: '#2f5b45', fg: '#f1f1e6', size: 52, w: 768, h: 280 });
    g.add(at(b, 0, 1.6, 0.05));
  },

  // A climbing frame in the playground
  climbingFrame(p, ctx) {
    const g = group(p, ctx);
    for (const sx of [-1, 1]) for (const sz of [-0.6, 0.6]) g.add(at(cyl(0.05, 0.05, 1.8, '#d94b3d', 6), sx, 0.9, sz));
    for (const y of [0.6, 1.2, 1.8]) {
      for (const sz of [-0.6, 0.6]) g.add(at(rbox(2.0, 0.06, 0.06, '#f6c026', 0.02), 0, y, sz));
      for (const sx of [-0.5, 0, 0.5]) g.add(at(rbox(0.06, 0.06, 1.2, '#1fa7a0', 0.02), sx, y, 0));
    }
    ctx.solid(p.x, p.z, ...turned(p, 2.1, 1.3));
  },

  // A hopscotch grid chalked on the ground
  hopscotch(p, ctx) {
    const g = group(p, ctx);
    const squares = [[0, 0], [0, -0.6], [-0.3, -1.2], [0.3, -1.2], [0, -1.8], [-0.3, -2.4], [0.3, -2.4], [0, -3.0]];
    squares.forEach(([x, z]) => {
      const sq = flat(new THREE.RingGeometry(0.22, 0.27, 4, 1, Math.PI / 4), '#fff4dc', 0.02);
      g.add(at(sq, x, 0.02, z));
    });
  },

  // ---------- Hospital ----------

  hospitalBed(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(1.0, 0.1, 2.0, '#c9cdd2', 0.03), 0, 0.6, 0));
    g.add(at(rbox(0.95, 0.14, 1.9, '#ffffff', 0.05), 0, 0.72, 0));
    g.add(at(rbox(0.96, 0.05, 1.1, '#8fd0f5', 0.02), 0, 0.81, 0.35));
    g.add(at(rbox(0.6, 0.12, 0.3, '#ffffff', 0.05), 0, 0.84, -0.7));
    g.add(at(rbox(1.0, 0.7, 0.06, '#c9cdd2', 0.02), 0, 0.85, -1.0));
    for (const sx of [-0.45, 0.45]) for (const sz of [-0.9, 0.9]) g.add(at(cyl(0.03, 0.03, 0.6, '#9aa0a6', 6), sx, 0.3, sz));
    g.add(at(cyl(0.02, 0.02, 1.6, '#9aa0a6', 6), 0.65, 0.8, -0.8)); // a drip stand
    g.add(at(rbox(0.16, 0.22, 0.06, '#e6f4ff', 0.02), 0.65, 1.5, -0.8));
    ctx.solid(p.x, p.z, ...turned(p, 1.1, 2.1));
  },

  // A row of waiting chairs: { x, z, rot, count }
  chairRow(p, ctx) {
    const g = group(p, ctx);
    const n = p.count ?? 4;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.6;
      g.add(at(rbox(0.5, 0.06, 0.45, p.color ?? '#1fa7a0', 0.02), x, 0.45, 0));
      g.add(at(rbox(0.5, 0.45, 0.06, p.color ?? '#1fa7a0', 0.02), x, 0.7, -0.2));
    }
    g.add(at(rbox(n * 0.6, 0.05, 0.1, '#6c6f73', 0.02), 0, 0.2, 0));
    ctx.solid(p.x, p.z, ...turned(p, n * 0.6, 0.5));
  },

  // A reception desk with a sign above it: { x, z, rot, text }
  reception(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(2.6, 1.05, 0.7, '#e8e4dc', 0.05), 0, 0.53, 0));
    g.add(at(rbox(2.7, 0.06, 0.8, '#1fa7a0', 0.02), 0, 1.08, 0));
    g.add(at(rbox(0.5, 0.35, 0.05, '#2a2a2a', 0.02), 0.6, 1.3, -0.1)); // a screen
    if (p.text) g.add(at(board(p.text, 2.0, 0.45, { bg: '#1fa7a0', size: 52 }), 0, 2.1, -0.3));
    ctx.solid(p.x, p.z, ...turned(p, 2.6, 0.7));
  },

  // An ambulance parked outside: { x, z, rot }
  ambulance(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(2.0, 1.6, 4.4, '#f4f4f0', 0.15), 0, 1.05, 0.2));
    g.add(at(rbox(1.8, 0.8, 1.2, '#f4f4f0', 0.15), 0, 0.75, -2.3));
    g.add(at(rbox(1.62, 0.4, 0.9, '#9fd3ef', 0.1), 0, 1.0, -2.45));
    g.add(at(rbox(2.04, 0.25, 4.0, '#d6336c', 0.03), 0, 1.0, 0.3));
    g.add(at(rbox(0.6, 0.15, 0.25, '#2f5fd0', 0.05), 0, 1.92, -1.2));
    for (const sx of [-0.95, 0.95]) for (const sz of [-1.9, 1.6]) {
      const wheel = cyl(0.36, 0.36, 0.28, '#2a2a2a', 12);
      wheel.rotation.z = Math.PI / 2;
      g.add(at(wheel, sx, 0.36, sz));
    }
    ctx.solid(p.x, p.z, ...turned(p, 2.1, 5.6));
  },

  // ---------- High Street ----------

  // A bus stop with a shelter and a sign: { x, z, rot, text }
  busStop(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(2.4, 0.08, 1.0, '#3b2a20', 0.02), 0, 2.3, 0));
    for (const sx of [-1.1, 1.1]) g.add(at(rbox(0.08, 2.3, 0.08, '#3b2a20', 0.02), sx, 1.15, -0.4));
    g.add(at(rbox(2.2, 1.8, 0.05, '#bfe3f2', 0.02), 0, 1.3, -0.45));
    g.add(at(rbox(1.8, 0.06, 0.35, '#c99257', 0.02), 0, 0.5, -0.25));
    g.add(at(cyl(0.04, 0.04, 2.8, '#6c6f73', 6), 1.6, 1.4, 0.2));
    g.add(at(board(p.text ?? 'BUS', 0.9, 0.5, { bg: '#2f5fd0', size: 60 }), 1.6, 2.6, 0.25));
    ctx.solid(p.x, p.z - 0.3, ...turned(p, 2.4, 0.4));
  },

  // A big supermarket front: a tall shop with a wide sign (DailyVa): { x, z, w, d, sign, color }
  supermarket(p, ctx) {
    PROPS.house({ ...p, height: 4.2, wall: p.wall ?? '#f4f4f0', roof: p.roof ?? '#3a7d44', floor: '#e8e4dc' }, ctx);
    const sign = board(p.sign ?? 'DailyVa', 5.4, 1.1, { bg: p.color ?? '#3a7d44', fg: '#fff4dc', size: 72, w: 768, h: 160 });
    ctx.add(at(sign, p.x + (p.doorAt ?? 0), 3.5, p.z + p.d / 2 + 0.16));
    // Bright strip lights in the windows, so it glares at night
    ctx.add(at(rbox(p.w - 1, 0.25, 0.08, '#fffef0', 0.02), p.x, 2.7, p.z + p.d / 2 + 0.14));
  },

  // A tall town house or office block, seen from outside: { x, z, w, d, height, wall, roof }
  block(p, ctx) {
    const g = group(p, ctx);
    const H = p.height ?? 6;
    g.add(at(box(p.w, H, p.d, p.wall ?? '#d9cfc2'), 0, H / 2, 0));
    g.add(at(box(p.w + 0.3, 0.3, p.d + 0.3, p.roof ?? '#8a8f96'), 0, H + 0.15, 0));
    // Rows of windows on the front
    for (let y = 1.6; y < H - 0.5; y += 1.7) {
      for (let x = -p.w / 2 + 0.9; x < p.w / 2 - 0.5; x += 1.5) {
        const win = mesh(new THREE.BoxGeometry(0.8, 0.9, 0.08), new THREE.MeshStandardMaterial({ color: '#8fd0f5', emissive: '#ffcf7a', emissiveIntensity: 0 }));
        win.castShadow = false;
        g.add(at(win, x, y, p.d / 2 + 0.02));
        ctx.lamp({ glass: win, light: null });
      }
    }
    ctx.solid(p.x, p.z, ...turned(p, p.w, p.d));
  },

  // A café table with two chairs and a little umbrella
  cafeTable(p, ctx) {
    const g = group(p, ctx);
    g.add(at(cyl(0.4, 0.4, 0.05, '#fff4dc', 12), 0, 0.72, 0));
    g.add(at(cyl(0.04, 0.06, 0.7, '#3b2a20', 6), 0, 0.36, 0));
    for (const sx of [-0.65, 0.65]) g.add(at(rbox(0.38, 0.05, 0.38, '#d6336c', 0.02), sx, 0.45, 0));
    g.add(at(cyl(0.025, 0.025, 1.8, '#3b2a20', 6), 0, 1.6, 0));
    g.add(at(mesh(new THREE.ConeGeometry(0.9, 0.4, 8), p.color ?? '#f6c026'), 0, 2.4, 0));
    ctx.solid(p.x, p.z, 0.9, 0.9);
  },

  // ---------- Park ----------

  // A round pond: { x, z, r }
  pond(p, ctx) {
    const r = p.r ?? 3;
    ctx.add(at(flat(new THREE.CircleGeometry(r + 0.35, 24), '#a99a86', 0.015), p.x, 0.015, p.z));
    const water = flat(new THREE.CircleGeometry(r, 24), '#5fa8d3', 0.03);
    water.material = water.material.clone();
    water.material.roughness = 0.2;
    water.material.metalness = 0.1;
    ctx.add(at(water, p.x, 0.03, p.z));
    ctx.solid(p.x, p.z, r * 1.7, r * 1.7);
  },

  // A fountain in the middle of the park
  fountain(p, ctx) {
    const g = group(p, ctx);
    g.add(at(cyl(1.4, 1.5, 0.5, '#c9c2b6', 16), 0, 0.25, 0));
    g.add(at(cyl(1.2, 1.2, 0.08, '#5fa8d3', 16), 0, 0.48, 0));
    g.add(at(cyl(0.18, 0.25, 1.3, '#c9c2b6', 10), 0, 1.1, 0));
    g.add(at(cyl(0.6, 0.4, 0.2, '#c9c2b6', 12), 0, 1.75, 0));
    g.add(at(ball(0.18, '#bfe3f2', 8, 6), 0, 1.95, 0));
    ctx.solid(p.x, p.z, 3, 3);
  },

  // A swing set
  swings(p, ctx) {
    const g = group(p, ctx);
    for (const sx of [-1.6, 1.6]) {
      for (const sz of [-0.5, 0.5]) {
        const leg = cyl(0.05, 0.05, 2.5, '#2f5fd0', 6);
        leg.rotation.x = sz > 0 ? -0.2 : 0.2;
        g.add(at(leg, sx, 1.2, sz));
      }
    }
    const bar = cyl(0.05, 0.05, 3.3, '#2f5fd0', 6);
    bar.rotation.z = Math.PI / 2;
    g.add(at(bar, 0, 2.4, 0));
    for (const sx of [-0.7, 0.7]) {
      for (const rx of [-0.2, 0.2]) g.add(at(cyl(0.01, 0.01, 1.8, '#6c6f73', 4), sx + rx, 1.5, 0));
      g.add(at(rbox(0.5, 0.05, 0.22, '#f6c026', 0.02), sx, 0.6, 0));
    }
    ctx.solid(p.x, p.z, ...turned(p, 3.5, 1.2));
  }
};
