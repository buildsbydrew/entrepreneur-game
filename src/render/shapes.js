// Building blocks for the 3D world: flat-shaded, slightly rough materials for the chunky
// "toy diorama" look, and short helpers for rounded boxes, cylinders and balls.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Materials are shared: one per colour, so a whole town costs little to draw
const materials = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
  }
  return materials.get(key);
}

export function mesh(geometry, color, extra) {
  const m = new THREE.Mesh(geometry, typeof color === 'string' ? mat(color, extra) : color);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const rbox = (w, h, d, color, r = 0.06) =>
  mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), color);
export const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
export const cyl = (rTop, rBottom, h, color, segments = 10) => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color);
export const ball = (r, color, w = 12, h = 9) => mesh(new THREE.SphereGeometry(r, w, h), color);

// Puts something at a position and returns it, so shapes can be built in one line
export function at(object, x, y, z) {
  object.position.set(x, y, z);
  return object;
}

// A flat shape lying on the ground (paths, rugs, patches of earth)
export function flat(geometry, color, y = 0.01) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// Text painted on a canvas, for signs. bg: null draws outlined text with no board.
export function textTexture(text, { w = 512, h = 128, bg = '#8d5524', fg = '#fff4dc', size = 64 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.strokeStyle = '#3b2a20';
    g.lineWidth = 10;
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 28);
    g.fill();
    g.stroke();
  }
  g.font = `bold ${size}px "Baloo 2", "Trebuchet MS", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (!bg) {
    g.strokeStyle = '#3b2a20';
    g.lineWidth = 12;
    g.strokeText(text, w / 2, h / 2 + 4);
  }
  g.fillStyle = fg;
  g.fillText(text, w / 2, h / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A small random number maker that gives the same numbers every time for the same seed,
// so a place always looks the same
export function seededRandom(seed = 7) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
