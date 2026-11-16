// The film camera: wider while walking, closer and a little lower during a conversation, framing
// both people, with a slow drift so it never feels locked off. Works for 16:9 and 9:16.
import * as THREE from 'three';

const SIZE = { baby: 0.72, child: 0.86, teen: 0.95, adult: 1, elder: 1 };

export function createFilmCamera(game) {
  const cur = { x: 0, z: 0, dist: 13, tilt: 1, yaw: 0, ready: false };
  let t = 0;
  let talkYaw = null;
  let talkTilt = 0.8;
  let talkCheck = 0;

  // How many times someone else stands between the camera and one of the two people talking
  function blocked(yaw, mx, mz, dist, tilt, subjects) {
    const cam = { x: mx + Math.sin(yaw) * dist, y: dist * tilt, z: mz + Math.cos(yaw) * dist };
    let hits = 0;
    for (const s of subjects) {
      const head = { x: s.pos.x, y: s.headHeight() * 0.8, z: s.pos.z };
      for (const o of game.people) {
        if (subjects.includes(o)) continue;
        const p = { x: o.pos.x, y: o.headHeight() * 0.6, z: o.pos.z };
        const d = { x: head.x - cam.x, y: head.y - cam.y, z: head.z - cam.z };
        const len2 = d.x * d.x + d.y * d.y + d.z * d.z;
        const k = Math.max(0, Math.min(1, ((p.x - cam.x) * d.x + (p.y - cam.y) * d.y + (p.z - cam.z) * d.z) / len2));
        const near = Math.hypot(cam.x + d.x * k - p.x, cam.z + d.z * k - p.z);
        const heightOk = cam.y + d.y * k < o.headHeight() + 0.25;
        if (k > 0.05 && k < 0.98 && near < o.radius + 0.35 && heightOk) hits++;
      }
    }
    return hits;
  }

  // Tall screens see less from side to side, so step back
  const portrait = () => Math.max(1, Math.sqrt(0.9 / game.camera.aspect));

  function update(dt) {
    const player = game.player;
    if (!player || !game.place) return;
    t += dt;
    const p = player.pos;
    const size = SIZE[player.stage] ?? 1;
    const indoors = game.place.insideHouse(p.x, p.z) ? 0.92 : 1;
    const partner = game.mode === 'talk' ? game.filmTalkPartner : null;

    let want;
    if (partner) {
      // Both people in frame, nudged up so the dialogue box doesn't cover them
      const mx = (p.x + partner.pos.x) / 2;
      const mz = (p.z + partner.pos.z) / 2;
      const apart = Math.hypot(partner.pos.x - p.x, partner.pos.z - p.z);
      // Look from the side the two of them aren't lined up along, but never far from the south (walls)
      const along = Math.atan2(partner.pos.x - p.x, partner.pos.z - p.z);
      let yaw = Math.atan2(Math.sin(along + Math.PI / 2), Math.cos(along + Math.PI / 2));
      if (Math.abs(yaw) > Math.PI / 2) yaw = Math.atan2(Math.sin(yaw + Math.PI), Math.cos(yaw + Math.PI));
      yaw = THREE.MathUtils.clamp(yaw, -0.45, 0.45);
      const dist = (6.2 + apart * 0.8) * size;
      const tilt = 0.8;
      // Pick an angle where nobody else is in the way, as close as possible to the natural one
      talkCheck -= dt;
      // (or from higher up, looking over their heads)
      if (talkYaw === null || (talkCheck <= 0 && blocked(talkYaw, mx, mz + 1.1 * size, dist, talkTilt, [player, partner]))) {
        let best = [yaw, tilt];
        let bestScore = Infinity;
        for (const h of [tilt, 1.15, 1.6, 2.4]) {
          for (let a = -1.05; a <= 1.0501; a += 0.15) {
            const score = blocked(a, mx, mz + 1.1 * size, dist, h, [player, partner]) * 10 + Math.abs(a - yaw) + (h - tilt) * 0.8;
            if (score < bestScore) { bestScore = score; best = [a, h]; }
          }
        }
        [talkYaw, talkTilt] = best;
      }
      if (talkCheck <= 0) talkCheck = 0.5;
      want = { x: mx, z: mz + 1.1 * size, dist: dist / Math.sqrt(1 + (talkTilt - tilt) * 0.5), tilt: talkTilt, yaw: talkYaw };
    } else if (player.pace > 0.4) {
      talkYaw = null;
      // Walking: wider, with a little room ahead
      const lead = 1.4;
      want = { x: p.x + Math.sin(player.facing) * lead, z: p.z + Math.cos(player.facing) * lead * 0.6, dist: 14.5 * size, tilt: 1, yaw: 0 };
    } else {
      talkYaw = null;
      want = { x: p.x, z: p.z + 0.4, dist: 11 * size, tilt: 0.92, yaw: 0 };
    }
    want.dist *= indoors * portrait() * game.zoom;

    if (!cur.ready) { Object.assign(cur, want); cur.ready = true; }
    const k = Math.min(1, dt * (partner ? 1.6 : 1.1));
    cur.x += (want.x - cur.x) * Math.min(1, dt * 3);
    cur.z += (want.z - cur.z) * Math.min(1, dt * 3);
    cur.dist += (want.dist - cur.dist) * k;
    cur.tilt += (want.tilt - cur.tilt) * k;
    cur.yaw += (want.yaw - cur.yaw) * k;

    const sway = Math.sin(t * 0.21) * 0.35;
    const yaw = cur.yaw + Math.sin(t * 0.13) * 0.03;
    const back = cur.dist;
    const up = cur.dist * cur.tilt;
    game.camera.position.set(cur.x + Math.sin(yaw) * back + sway, up, cur.z + Math.cos(yaw) * back);
    game.camera.lookAt(cur.x, 0.7 * size, cur.z);
    game.camTarget.set(cur.x, 0, cur.z);
  }

  // A fresh place or a new day: jump straight to the new framing
  function cut() { cur.ready = false; }

  // The prologue has its own camera; on a tall screen, step it back so nobody is cut off
  function adjustPrologue() {
    const f = portrait();
    if (f <= 1 || !game.cine) return;
    const c = game.cine;
    const pos = game.camera.position;
    pos.set(c.x + (pos.x - c.x) * f, pos.y * f, c.z + (pos.z - c.z) * f);
    game.camera.lookAt(c.x, 0.5, c.z);
  }

  return { update, cut, adjustPrologue };
}
