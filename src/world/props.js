// Everything that stands in a place, built from simple shapes: houses you can walk into, furniture,
// trees, fences, streets, a corner shop, lamps. Places list their props as data (src/data/places.json),
// and each entry here knows how to build one.
//
// Every builder gets (p, ctx): p is the prop's data ({ type, x, z, rot, ... }) and ctx is the place being
// built: ctx.add(object), ctx.solid(x, z, w, d), ctx.lamp(...), ctx.house(...), ctx.interact(...).
import * as THREE from 'three';
import { mesh, rbox, box, cyl, ball, at, flat, mat, textTexture } from '../render/shapes.js';

// Rotations are in quarter turns (0, 90, 180, 270). A solid box turned a quarter swaps width and depth.
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

// A light that comes on after dark: a glowing shape and a point light
function addLamp(ctx, g, x, y, z, { color = '#ffe2a0', glow = '#ffb347', range = 9, size = 0.22 } = {}) {
  const glass = mesh(new THREE.BoxGeometry(size, size * 1.2, size), new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0 }));
  glass.castShadow = false;
  g.add(at(glass, x, y, z));
  const light = new THREE.PointLight(glow, 0, range, 1.6);
  light.position.set(x, y - 0.15, z);
  g.add(light);
  ctx.lamp({ glass, light });
}

export const PROPS = {
  // ---------- Ground ----------

  // A path or a patch of ground: { x, z, w, d, color }
  path(p, ctx) {
    ctx.add(at(flat(new THREE.PlaneGeometry(p.w, p.d), p.color ?? '#e6d3ad', 0.015), p.x, 0.015, p.z));
  },

  // A road with a dashed middle line, running east-west (rot 90 for north-south): { x, z, length, width }
  road(p, ctx) {
    const g = group(p, ctx);
    g.add(at(flat(new THREE.PlaneGeometry(p.length, p.width), '#5d5a63', 0.012), 0, 0.012, 0));
    for (let x = -p.length / 2 + 1; x < p.length / 2; x += 3) {
      g.add(at(flat(new THREE.PlaneGeometry(1.4, 0.14), '#f1e3b5', 0.02), x, 0.02, 0));
    }
    for (const side of [-1, 1]) g.add(at(rbox(p.length, 0.12, 0.3, '#b9b2a6', 0.03), 0, 0.06, side * (p.width / 2 + 0.15)));
  },

  // ---------- Buildings ----------

  // A house you can walk into. { x, z, w, d, wall, roof, door: 'south'|'north'|'east'|'west', doorAt, floor }
  // When the player is inside, the roof and the wall facing the camera lift away so you can see in.
  house(p, ctx) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    ctx.add(g);
    const W = p.w;
    const D = p.d;
    const H = p.height ?? 2.7;
    const T = 0.22; // wall thickness
    const wallColor = p.wall ?? '#efe0c2';
    const trim = p.trim ?? '#b98d5c';
    const doorW = 1.1;
    const doorSide = p.door ?? 'south';
    const doorAt = p.doorAt ?? 0; // how far along the wall the door is, from its middle

    // Floor
    g.add(at(flat(new THREE.PlaneGeometry(W, D), p.floor ?? '#cdbb98', 0.02), 0, 0.02, 0));

    // Each wall is built from pieces, leaving a gap where the door is
    const front = new THREE.Group(); // the south wall, which hides when the player is inside
    const walls = { south: front, north: g, east: g, west: g };
    const sides = {
      south: { cx: 0, cz: D / 2, len: W, along: 'x' },
      north: { cx: 0, cz: -D / 2, len: W, along: 'x' },
      east: { cx: W / 2, cz: 0, len: D, along: 'z' },
      west: { cx: -W / 2, cz: 0, len: D, along: 'z' }
    };
    g.add(front);

    Object.entries(sides).forEach(([side, s]) => {
      const pieces = side === doorSide
        ? [[-s.len / 2, doorAt - doorW / 2], [doorAt + doorW / 2, s.len / 2]]
        : [[-s.len / 2, s.len / 2]];
      pieces.forEach(([a, b]) => {
        const len = b - a;
        if (len <= 0.01) return;
        const mid = (a + b) / 2;
        const [w, d] = s.along === 'x' ? [len + (side === 'south' || side === 'north' ? T : 0), T] : [T, len];
        const wx = s.along === 'x' ? s.cx + mid : s.cx;
        const wz = s.along === 'x' ? s.cz : s.cz + mid;
        walls[side].add(at(box(w, H, d, wallColor), wx, H / 2, wz));
        walls[side].add(at(box(w + 0.02, 0.18, d + 0.02, trim), wx, 0.09, wz)); // a skirting band
        ctx.solid(p.x + wx, p.z + wz, w, d);
        if (side === 'south') {
          // a low stub that stays when the front wall lifts away, so the room still has an edge
          g.add(at(box(w, 0.35, d, wallColor), wx, 0.175, wz));
        }
      });
      // Above the door
      if (side === doorSide) {
        const [w, d] = s.along === 'x' ? [doorW, T] : [T, doorW];
        const wx = s.along === 'x' ? s.cx + doorAt : s.cx;
        const wz = s.along === 'x' ? s.cz : s.cz + doorAt;
        walls[side].add(at(box(w, H - 2.1, d, wallColor), wx, 2.1 + (H - 2.1) / 2, wz));
      }
    });

    // Windows: on the side walls and the back, glowing warmly at night
    const windowAt = (x, z, rotY) => {
      const win = new THREE.Group();
      win.position.set(x, 1.5, z);
      win.rotation.y = rotY;
      // Thicker than the wall, so the window shows on both the inside and the outside
      win.add(at(box(0.9, 0.8, T + 0.06, '#8d5524'), 0, 0, 0));
      const glass = mesh(new THREE.BoxGeometry(0.72, 0.62, T + 0.08), new THREE.MeshStandardMaterial({ color: '#8fd0f5', emissive: '#ffcf7a', emissiveIntensity: 0 }));
      glass.castShadow = false;
      win.add(glass);
      g.add(win);
      ctx.lamp({ glass, light: null });
    };
    windowAt(-W / 4, -D / 2, 0);
    windowAt(W / 4, -D / 2, 0);
    if (doorSide !== 'east') windowAt(W / 2, 0, Math.PI / 2);
    if (doorSide !== 'west') windowAt(-W / 2, 0, Math.PI / 2);

    // A gabled roof: two sloping sides meeting at a ridge, overhanging the walls
    const roof = new THREE.Group();
    const pitch = 0.5;
    const half = W / 2 + 0.35;
    const slope = half / Math.cos(pitch);
    for (const side of [-1, 1]) {
      const panel = rbox(slope, 0.14, D + 0.7, p.roof ?? '#c0563a', 0.04);
      panel.position.set(side * half / 2, H + Math.tan(pitch) * half / 2, 0);
      panel.rotation.z = -side * pitch;
      roof.add(panel);
    }
    // The triangle ends of the roof
    const gableShape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * W / 2)]);
    for (const end of [-1, 1]) {
      const gable = mesh(new THREE.ShapeGeometry(gableShape), wallColor);
      gable.material = mat(wallColor, { side: THREE.DoubleSide });
      roof.add(at(gable, 0, H, end * D / 2));
    }
    g.add(roof);

    // A doorstep and a light over the door
    const step = sides[doorSide];
    const stepX = step.along === 'x' ? doorAt : step.cx + Math.sign(step.cx) * 0.35;
    const stepZ = step.along === 'x' ? step.cz + Math.sign(step.cz) * 0.35 : doorAt;
    g.add(at(rbox(step.along === 'x' ? 1.4 : 0.6, 0.1, step.along === 'x' ? 0.6 : 1.4, '#a99a86', 0.03), stepX, 0.05, stepZ));
    addLamp(ctx, g, stepX * 1.0, 2.35, stepZ * 0.94, { range: 7, size: 0.18 });

    if (p.sign) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: textTexture(p.sign), roughness: 0.9 }));
      front.add(at(board, doorAt, 2.45, D / 2 + T / 2 + 0.02));
    }

    // The place lifts the roof and front wall away while the player is inside
    ctx.house({ minX: p.x - W / 2, maxX: p.x + W / 2, minZ: p.z - D / 2, maxZ: p.z + D / 2, roof, front });
  },

  // A small corner shop: a house with a sign and an awning over the door
  shop(p, ctx) {
    PROPS.house({ ...p, sign: p.sign ?? 'Shop' }, ctx);
    const awning = new THREE.Group();
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      awning.add(at(rbox(0.5, 0.06, 1.2, i % 2 ? '#fff4dc' : (p.awning ?? '#1fa7a0'), 0.02), -1.25 + i * 0.5, 0, 0));
    }
    awning.rotation.x = 0.35;
    ctx.add(at(awning, p.x + (p.doorAt ?? 0), 2.2, p.z + p.d / 2 + 0.6));
  },

  // ---------- Furniture ----------

  // A bed: { x, z, rot, cover }
  bed(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(1.2, 0.35, 2.1, '#8d5524', 0.06), 0, 0.22, 0));
    g.add(at(rbox(1.1, 0.16, 1.95, '#fff4dc', 0.06), 0, 0.46, 0));
    g.add(at(rbox(1.12, 0.06, 1.2, p.cover ?? '#1fa7a0', 0.03), 0, 0.56, 0.35));
    g.add(at(rbox(0.7, 0.14, 0.35, '#ffffff', 0.06), 0, 0.6, -0.72));
    g.add(at(rbox(1.24, 0.75, 0.12, '#6e4219', 0.04), 0, 0.5, -1.05));
    ctx.solid(p.x, p.z, ...turned(p, 1.2, 2.1));
  },

  // A small bed with raised sides, for a baby
  cot(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(0.8, 0.12, 1.2, '#fff4dc', 0.04), 0, 0.45, 0));
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.6, 0.6]) g.add(at(cyl(0.03, 0.03, 0.9, '#b27436', 6), sx, 0.45, sz));
    for (let i = -3; i <= 3; i++) {
      g.add(at(cyl(0.015, 0.015, 0.35, '#b27436', 4), i * 0.11, 0.7, -0.6));
      g.add(at(cyl(0.015, 0.015, 0.35, '#b27436', 4), i * 0.11, 0.7, 0.6));
    }
    g.add(at(rbox(0.84, 0.05, 0.05, '#b27436', 0.02), 0, 0.88, -0.6));
    g.add(at(rbox(0.84, 0.05, 0.05, '#b27436', 0.02), 0, 0.88, 0.6));
    ctx.solid(p.x, p.z, ...turned(p, 0.8, 1.2));
  },

  // A table with a few things on it: { x, z, rot, w, d }
  table(p, ctx) {
    const g = group(p, ctx);
    const w = p.w ?? 1.4;
    const d = p.d ?? 0.9;
    g.add(at(rbox(w, 0.08, d, '#b27436', 0.03), 0, 0.76, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(rbox(0.08, 0.72, 0.08, '#6e4219', 0.02), sx * (w / 2 - 0.1), 0.36, sz * (d / 2 - 0.1)));
    g.add(at(cyl(0.16, 0.12, 0.05, '#fff4dc', 12), -w * 0.2, 0.83, 0));
    g.add(at(cyl(0.05, 0.05, 0.12, '#2f5fd0', 8), w * 0.25, 0.86, -0.1));
    ctx.solid(p.x, p.z, ...turned(p, w, d));
  },

  chair(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(0.45, 0.06, 0.45, '#b27436', 0.02), 0, 0.45, 0));
    g.add(at(rbox(0.45, 0.5, 0.06, '#8d5524', 0.02), 0, 0.72, -0.2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(rbox(0.05, 0.44, 0.05, '#6e4219', 0.01), sx * 0.18, 0.22, sz * 0.18));
    ctx.solid(p.x, p.z, 0.45, 0.45);
  },

  // A sofa: { x, z, rot, color }
  sofa(p, ctx) {
    const g = group(p, ctx);
    const c = p.color ?? '#d6336c';
    g.add(at(rbox(1.9, 0.4, 0.85, c, 0.1), 0, 0.3, 0));
    g.add(at(rbox(1.9, 0.55, 0.22, c, 0.1), 0, 0.65, -0.33));
    for (const sx of [-1, 1]) g.add(at(rbox(0.22, 0.5, 0.85, c, 0.08), sx * 0.95, 0.45, 0));
    ctx.solid(p.x, p.z, ...turned(p, 2.0, 0.9));
  },

  // A tall shelf with things on it, against a wall
  shelf(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(1.1, 1.8, 0.4, '#8d5524', 0.04), 0, 0.9, 0));
    [0.5, 1.0, 1.45].forEach((y, i) => {
      g.add(at(rbox(0.25, 0.3, 0.25, ['#d6336c', '#f6c026', '#1fa7a0'][i], 0.03), -0.25, y + 0.15, 0.08));
      g.add(at(rbox(0.3, 0.22, 0.2, ['#2f5fd0', '#3a7d44', '#f39c12'][i], 0.03), 0.22, y + 0.11, 0.08));
    });
    ctx.solid(p.x, p.z, ...turned(p, 1.1, 0.4));
  },

  // A cooking stove with a pot
  stove(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(0.9, 0.85, 0.6, '#e8e4dc', 0.05), 0, 0.43, 0));
    g.add(at(cyl(0.18, 0.16, 0.2, '#6c6f73', 10), -0.18, 0.95, 0));
    g.add(at(cyl(0.1, 0.1, 0.04, '#3b2a20', 10), 0.22, 0.87, 0));
    ctx.solid(p.x, p.z, ...turned(p, 0.9, 0.6));
  },

  // A woven rug, flat on the floor: { x, z, w, d, color }
  rug(p, ctx) {
    ctx.add(at(flat(new THREE.PlaneGeometry(p.w ?? 2.2, p.d ?? 1.4), p.color ?? '#d6336c', 0.03), p.x, 0.03, p.z));
    ctx.add(at(flat(new THREE.PlaneGeometry((p.w ?? 2.2) - 0.3, (p.d ?? 1.4) - 0.3), p.inner ?? '#1fa7a0', 0.035), p.x, 0.035, p.z));
  },

  // A box of toys
  toys(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(0.7, 0.4, 0.45, '#f6c026', 0.05), 0, 0.2, 0));
    g.add(at(ball(0.12, '#d6336c', 8, 6), -0.15, 0.48, 0));
    g.add(at(rbox(0.18, 0.18, 0.18, '#2f5fd0', 0.03), 0.15, 0.48, 0.05));
    ctx.solid(p.x, p.z, ...turned(p, 0.7, 0.45));
  },

  // A potted plant
  plant(p, ctx) {
    const g = group(p, ctx);
    g.add(at(cyl(0.2, 0.15, 0.35, '#b5652b', 8), 0, 0.17, 0));
    [[0, 0.65, 0, 0.28], [0.15, 0.5, 0.1, 0.2], [-0.14, 0.52, -0.06, 0.2]].forEach(([x, y, z, r], i) =>
      g.add(at(mesh(new THREE.IcosahedronGeometry(r, 0), i ? '#3a7d44' : '#4a9a52'), x, y, z)));
    ctx.solid(p.x, p.z, 0.4, 0.4);
  },

  // A lamp standing on the floor inside, lit after dark
  floorLamp(p, ctx) {
    const g = group(p, ctx);
    g.add(at(cyl(0.15, 0.18, 0.05, '#3b2a20', 10), 0, 0.03, 0));
    g.add(at(cyl(0.025, 0.025, 1.4, '#3b2a20', 6), 0, 0.72, 0));
    addLamp(ctx, g, 0, 1.5, 0, { range: 6, size: 0.3 });
    ctx.solid(p.x, p.z, 0.3, 0.3);
  },

  // ---------- Outside ----------

  tree(p, ctx) {
    const g = group(p, ctx);
    const s = p.size ?? 1;
    g.add(at(cyl(0.18 * s, 0.26 * s, 2.2 * s, '#8d5524', 7), 0, 1.1 * s, 0));
    [[0, 3.0, 0, 1.4], [0.9, 2.6, 0.3, 1.0], [-0.9, 2.7, -0.2, 1.05], [0.2, 2.5, 0.9, 0.9], [-0.3, 3.6, -0.3, 0.9]]
      .forEach(([x, y, z, r], i) => g.add(at(mesh(new THREE.IcosahedronGeometry(r * s, 0), i % 2 ? '#3a7d44' : (p.leaf ?? '#4a9a52')), x * s, y * s, z * s)));
    ctx.solid(p.x, p.z, 0.5 * s, 0.5 * s);
  },

  bush(p, ctx) {
    const g = group(p, ctx);
    [[-0.35, 0.3, 0, 0.45], [0.35, 0.3, 0.05, 0.42], [0, 0.45, -0.1, 0.5]].forEach(([x, y, z, r], i) =>
      g.add(at(mesh(new THREE.IcosahedronGeometry(r, 0), i === 2 ? '#4a9a52' : '#3a7d44'), x, y, z)));
    g.add(at(ball(0.07, '#d6336c', 6, 4), 0.2, 0.85, 0.25));
    g.add(at(ball(0.07, '#f6c026', 6, 4), -0.3, 0.7, 0.3));
    ctx.solid(p.x, p.z, 1.2, 0.8);
  },

  // A wooden fence from (x, z) running east for `length` metres (rot 90 runs south)
  fence(p, ctx) {
    const g = group(p, ctx);
    const len = p.length;
    for (let x = 0; x <= len + 0.01; x += 1.2) g.add(at(rbox(0.12, 1.0, 0.12, '#b27436', 0.02), x, 0.5, 0));
    for (const y of [0.35, 0.75]) g.add(at(rbox(len, 0.08, 0.05, '#c99257', 0.02), len / 2, y, 0));
    const [w, d] = turned(p, len, 0.2);
    const vertical = (p.rot ?? 0) % 180 === 90;
    ctx.solid(p.x + (vertical ? 0 : len / 2), p.z + (vertical ? len / 2 : 0), w, d);
  },

  // A street lamp, lit after dark
  streetLamp(p, ctx) {
    const g = group(p, ctx);
    g.add(at(cyl(0.06, 0.09, 3.2, '#3b2a20', 6), 0, 1.6, 0));
    addLamp(ctx, g, 0, 3.3, 0, { range: 12, size: 0.32 });
    ctx.solid(p.x, p.z, 0.3, 0.3);
  },

  bench(p, ctx) {
    const g = group(p, ctx);
    g.add(at(rbox(1.6, 0.08, 0.45, '#b27436', 0.02), 0, 0.45, 0));
    g.add(at(rbox(1.6, 0.4, 0.06, '#b27436', 0.02), 0, 0.72, -0.2));
    for (const sx of [-0.65, 0.65]) g.add(at(rbox(0.08, 0.45, 0.4, '#3b2a20', 0.02), sx, 0.22, 0));
    ctx.solid(p.x, p.z, ...turned(p, 1.6, 0.45));
  },

  // A signpost with words on it, like the name of a street: { x, z, text }
  sign(p, ctx) {
    const g = group(p, ctx);
    g.add(at(cyl(0.07, 0.08, 2.0, '#6e4219', 6), 0, 1.0, 0));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshStandardMaterial({ map: textTexture(p.text, { size: 56 }), roughness: 0.9 }));
    board.rotation.x = -0.2;
    g.add(at(board, 0, 1.75, 0.1));
    ctx.solid(p.x, p.z, 0.3, 0.3);
  },

  // A flower bed: { x, z, w, d }
  flowers(p, ctx) {
    const w = p.w ?? 2;
    const d = p.d ?? 0.8;
    ctx.add(at(flat(new THREE.PlaneGeometry(w, d), '#7a5a3a', 0.02), p.x, 0.02, p.z));
    const colors = ['#d6336c', '#f6c026', '#fff4dc', '#f39c12'];
    let i = 0;
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.35) {
      for (let z = -d / 2 + 0.2; z < d / 2; z += 0.35) {
        ctx.add(at(mesh(new THREE.IcosahedronGeometry(0.09, 0), colors[i++ % colors.length]), p.x + x, 0.15, p.z + z));
      }
    }
  },

  // A parked car, so the street feels lived in: { x, z, rot, color }
  car(p, ctx) {
    const g = group(p, ctx);
    const c = p.color ?? '#2f5fd0';
    g.add(at(rbox(1.8, 0.6, 3.8, c, 0.15), 0, 0.55, 0));
    g.add(at(rbox(1.6, 0.55, 2.0, c, 0.15), 0, 1.1, -0.2));
    g.add(at(rbox(1.62, 0.4, 1.9, '#9fd3ef', 0.1), 0, 1.12, -0.2));
    for (const sx of [-0.85, 0.85]) for (const sz of [-1.2, 1.2]) {
      const wheel = cyl(0.32, 0.32, 0.25, '#2a2a2a', 12);
      wheel.rotation.z = Math.PI / 2;
      g.add(at(wheel, sx, 0.32, sz));
    }
    ctx.solid(p.x, p.z, ...turned(p, 1.9, 3.9));
  }
};
