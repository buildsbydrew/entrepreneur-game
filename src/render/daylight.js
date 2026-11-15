// The light through the day: the sun rises in the east, crosses the sky and sets in the west,
// the sky changes colour, and lamps glow after dark. Between the key hours below, everything blends.
import * as THREE from 'three';

const KEYS = [
  { h: 4.5, sky: '#141c3c', sun: '#8fa6e0', sunI: 0.35, top: '#2c3e70', bottom: '#1e1828', hemiI: 0.34, lamps: 1 },
  { h: 5.6, sky: '#3a3f6e', sun: '#ff9a6a', sunI: 0.3, top: '#5a6aa0', bottom: '#3a2a30', hemiI: 0.5, lamps: 1 },
  { h: 6.5, sky: '#f4c2a1', sun: '#ffb07a', sunI: 1.6, top: '#c9d4ef', bottom: '#b08a66', hemiI: 0.85, lamps: 0 },
  { h: 9, sky: '#a9dcf2', sun: '#fff1dc', sunI: 2.7, top: '#d8ecff', bottom: '#c49a64', hemiI: 1.0, lamps: 0 },
  { h: 13, sky: '#9ed6f2', sun: '#fffaf0', sunI: 3.0, top: '#d8ecff', bottom: '#c49a64', hemiI: 1.1, lamps: 0 },
  { h: 16, sky: '#b5d8ea', sun: '#ffe2b5', sunI: 2.7, top: '#e4e4ea', bottom: '#c49a64', hemiI: 1.0, lamps: 0 },
  { h: 17.6, sky: '#f7a96f', sun: '#ff9a55', sunI: 2.5, top: '#f8d0a8', bottom: '#b0805a', hemiI: 1.05, lamps: 0.1 },
  { h: 18.6, sky: '#a35f72', sun: '#ff7a48', sunI: 1.1, top: '#b48ab0', bottom: '#5a4050', hemiI: 0.8, lamps: 0.8 },
  { h: 19.6, sky: '#1f2c56', sun: '#8fa6e0', sunI: 0.45, top: '#3a5090', bottom: '#2a2030', hemiI: 0.42, lamps: 1 },
  { h: 24, sky: '#111938', sun: '#8fa6e0', sunI: 0.38, top: '#2c3e70', bottom: '#1e1828', hemiI: 0.34, lamps: 1 }
];

export function createDaylight(scene, quality) {
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const hemi = new THREE.HemisphereLight(0xd8ecff, 0xc49a64, 1);
  scene.add(sun, sun.target, hemi);
  scene.fog = new THREE.Fog(0x9ed6f2, 34, 85);

  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  const sky = new THREE.Color();
  const blend = (a, b, t, out) => out.copy(colorA.set(a)).lerp(colorB.set(b), t);
  const offset = new THREE.Vector3();

  return {
    sun,
    lamps: 0, // 0 in daylight, 1 at night: places use it to light their lamps

    // minutes: time of day. focus: where the player is, so shadows stay sharp around them.
    update(minutes, focus) {
      const h = minutes / 60;
      let i = KEYS.findIndex(k => k.h > h);
      if (i === -1) i = KEYS.length - 1;
      if (i === 0) i = 1;
      const a = KEYS[i - 1];
      const b = KEYS[i];
      const t = THREE.MathUtils.clamp((h - a.h) / (b.h - a.h), 0, 1);

      blend(a.sky, b.sky, t, sky);
      scene.background = sky;
      scene.fog.color.copy(sky);
      blend(a.sun, b.sun, t, sun.color);
      sun.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, t);
      blend(a.top, b.top, t, hemi.color);
      blend(a.bottom, b.bottom, t, hemi.groundColor);
      hemi.intensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, t);
      this.lamps = THREE.MathUtils.lerp(a.lamps, b.lamps, t);

      // East is +x. The sun comes from slightly in front, so faces are lit; after dark the moon takes over.
      const up = h >= 5.8 && h <= 19.0;
      if (up) {
        const arc = THREE.MathUtils.clamp((h - 6) / 12.9, 0, 1) * Math.PI;
        offset.set(Math.cos(arc) * 30, Math.max(4, Math.sin(arc) * 30), 18);
      } else {
        offset.set(-12, 26, 14);
      }
      sun.position.copy(focus).add(offset);
      sun.target.position.copy(focus);
    },

    setShadows(quality) {
      sun.castShadow = quality.shadows;
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  };
}
