// The film camera: it shoots the life like a film or TV show, not like a game.
//
// Shots, picked from what's happening:
// - Arriving somewhere: an establishing shot, high above the place, craning down into the scene.
// - Walking: a tracking shot from the side, near eye level, with room ahead of them.
//   A small child walking alone is seen from a little higher (small in a big world).
// - Standing about: a three-quarter medium shot, so we see their face.
// - Time passing: a wide, high shot of the whole place while the sun moves.
// - Conversations: a two-shot to start, then over-the-shoulder shots that cut to whoever is speaking,
//   always from the same side of the line between them (the 180-degree rule), close-ups with a slow
//   push-in for lines with feeling, and a quick reaction shot of the listener after a big line.
// - The man in the green coat: seen from below, the frame slightly tilted, with a little handheld sway.
// Inside a house the camera stays inside the walls. Works for 16:9 and 9:16.
import * as THREE from 'three';

const SIZE = { baby: 0.72, child: 0.86, teen: 0.95, adult: 1, elder: 1 };
const UNSETTLING = new Set(['corin']); // people whose shots are low, tilted and a little shaky
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ray = new THREE.Raycaster();

export function createFilmCamera(game) {
  const cam = game.camera;
  // The camera's own dice: camera changes must never change how the life plays out
  let dice = 7;
  const roll = () => { dice = (dice * 16807) % 2147483647; return dice / 2147483647; };
  const cur = { pos: v3(), look: v3(), fov: 35, roll: 0, ready: false };
  let t = 0;
  let shot = null;        // { type, start, ... } the shot being filmed
  let lastPlace = null;
  let talkSide = 0;       // which side of the conversation line the camera stays on (+1 or -1)
  let talkWith = null;
  let lastLine = null;    // { isYou, at, felt }
  let focus = 10;
  let closeness = 0;
  const portrait = () => Math.max(1, Math.sqrt(0.9 / cam.aspect));

  const headOf = p => v3(p.pos.x, (p.lift ?? 0) + p.headHeight() - 0.12, p.pos.z);
  const FELT = { happy: 1, sad: 1, worried: 1, scared: 1, angry: 1, surprised: 1 };

  function newShot(type, extra = {}) {
    shot = { type, start: t, snap: true, ...extra };
    game.film?.add('shot', { shot: type, on: extra.a?.name ?? null });
  }

  // Keeps the camera inside the room when the subject is indoors, above the ground, and out of people
  function contain(pos, subject) {
    const house = game.place?.insideHouse(subject.x, subject.z);
    if (house) {
      pos.x = THREE.MathUtils.clamp(pos.x, house.minX + 0.35, house.maxX - 0.35);
      pos.z = THREE.MathUtils.clamp(pos.z, house.minZ + 0.35, house.maxZ - 0.35);
    }
    pos.y = Math.max(0.35, pos.y);
    // Never inside anyone: rise above their head instead
    for (const p of [...game.people, game.player]) {
      if (!p) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < p.radius + 0.3 && pos.y < p.headHeight() + 0.35) pos.y = p.headHeight() + 0.45;
    }
    return pos;
  }

  // ---------- Shots ----------

  function medium() {
    const pl = game.player;
    const s = SIZE[pl.stage] ?? 1;
    const f = pl.facing + (shot?.angle ?? 0.6);
    const dist = 4.6 * s * portrait();
    const head = headOf(pl);
    return {
      pos: contain(v3(pl.pos.x + Math.sin(f) * dist, head.y + 0.9 * s, pl.pos.z + Math.cos(f) * dist), pl.pos),
      look: v3(pl.pos.x, head.y - 0.25 * s, pl.pos.z), fov: 35, roll: 0, rate: 1.5
    };
  }

  function establishing(dur) {
    const b = game.place.bounds;
    const p = game.player.pos;
    const k = Math.min(1, (t - shot.start) / dur);
    const e = k * k * (3 - 2 * k);
    const centre = v3((b.minX + b.maxX) / 4 + p.x / 2, 0, (b.minZ + b.maxZ) / 4 + p.z / 2);
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const high = v3(centre.x - span * 0.2, span * 0.42, centre.z + span * 0.45);
    const low = medium();
    return {
      pos: high.clone().lerp(low.pos, e),
      look: centre.clone().setY(0.5).lerp(low.look, e),
      fov: 40 - 5 * e, roll: 0, rate: 0
    };
  }

  function tracking() {
    const pl = game.player;
    const s = SIZE[pl.stage] ?? 1;
    const dir = v3(Math.sin(pl.facing), 0, Math.cos(pl.facing));
    const side = v3(dir.z, 0, -dir.x).multiplyScalar(shot.side ?? 1);
    const alone = pl.stage === 'child' && !game.people.some(p => Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) < 5);
    const dist = 5.2 * s * portrait();
    const head = headOf(pl);
    const pos = v3(pl.pos.x, head.y + (alone ? 2.6 : 0.6) * s, pl.pos.z)
      .addScaledVector(side, dist).addScaledVector(dir, -1.2 * s);
    const look = v3(pl.pos.x, head.y - 0.3 * s, pl.pos.z).addScaledVector(dir, 1.3 * s); // room ahead
    return { pos: contain(pos, pl.pos), look, fov: 38, roll: 0, rate: 3 };
  }

  function wide() {
    const b = game.place.bounds;
    const pl = game.player.pos;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const centre = v3(pl.x * 0.6 + (b.minX + b.maxX) * 0.2, 0.6, pl.z * 0.6 + (b.minZ + b.maxZ) * 0.2);
    return { pos: v3(centre.x + span * 0.15, span * 0.42, centre.z + span * 0.55), look: centre, fov: 40, roll: 0, rate: 0.6 };
  }

  // Two people talking: a = the one the shot is on, b = the other
  function conversation(type, a, b) {
    const ha = headOf(a);
    const hb = headOf(b);
    if (type === 'ots' && hb.y - ha.y > 0.3) type = 'close';
    const axis = v3(a.pos.x - b.pos.x, 0, a.pos.z - b.pos.z);
    const apart = Math.max(0.6, axis.length());
    axis.normalize();
    // The side of the line the camera keeps to (flipped with the axis, so it never crosses the line)
    const side = v3(-axis.z, 0, axis.x).multiplyScalar(talkSide * (a === game.player ? 1 : -1));
    const s = SIZE[a.stage] ?? 1;
    let pos;
    let look;
    let fov = 32;
    if (type === 'two') {
      const mid = ha.clone().add(hb).multiplyScalar(0.5);
      pos = mid.clone().addScaledVector(side, (2.3 + apart * 0.9) * portrait()).setY(mid.y + 0.9);
      look = mid.clone().setY(mid.y - 0.25);
      fov = 36;
    } else if (type === 'ots') {
      // Over the shoulder of the listener (b), onto the speaker (a)
      // a tall listener and a small speaker: step further back and drop toward the speaker's eye level
      const drop = Math.max(0, hb.y - ha.y);
      pos = hb.clone().addScaledVector(axis, -(0.95 + drop * 1.6)).addScaledVector(side, (0.5 + drop * 0.4) * portrait()).setY(Math.min(hb.y + 0.2, ha.y + 0.35));
      look = ha.clone().addScaledVector(side, -0.15).setY(ha.y - 0.28);
    } else {
      // Close-up on a's face, from b's side of the line, slowly pushing in
      const push = Math.min(1, (t - shot.start) / 5) * 0.25;
      // between the two of them and off to the side, so the listener never blocks the view
      const along = Math.max(1.25 * s * portrait() - push, Math.min((1.9 - push) * s * portrait(), apart - 0.45));
      pos = ha.clone().addScaledVector(axis, -along).addScaledVector(side, 0.55 + Math.max(0, 1.2 - along) * 0.6).setY(ha.y + 0.08);
      look = ha.clone().setY(ha.y - 0.3 * s);
      fov = 30;
    }
    let roll = 0;
    if (UNSETTLING.has(a.id) && type !== 'two') {
      // From below, and slightly tilted
      pos.y = Math.max(0.5, ha.y - 0.9);
      roll = 0.07;
    }
    return { pos: contain(pos, game.player.pos), look, fov, roll, rate: 0 };
  }

  // ---------- Choosing shots ----------

  function pick() {
    const pl = game.player;
    const partner = game.mode === 'talk' ? game.filmTalkPartner : null;
    if (partner) {
      if (talkWith !== partner) beginTalk(partner);
      return;
    }
    talkWith = null;
    lastLine = null;
    if (shot?.type === 'establishing' && t - shot.start < 3.2) return;
    if (game.film?.pilot?.task?.lapse) { if (shot?.type !== 'wide') newShot('wide'); return; }
    // Walking or standing, but only after a moment, so a short stop or step doesn't cause a cut
    const held = t - (shot?.start ?? 0);
    if (pl.pace > 0.4) {
      if (shot?.type !== 'tracking' && (held > 1.2 || shot?.type === 'wide')) newShot('tracking', { side: roll() < 0.5 ? 1 : -1 });
      return;
    }
    if (shot?.type !== 'medium' && pl.pace < 0.1 && held > 1.2) newShot('medium', { angle: roll() < 0.5 ? 0.55 : -0.55, snap: shot?.type !== 'tracking' });
  }

  // A conversation begins: an establishing two-shot, from the side of the line the camera will keep to
  function beginTalk(partner) {
    const pl = game.player;
    talkWith = partner;
    // Keep to the side of the line that faces the camera's usual south, so both faces show
    const axis = v3(pl.pos.x - partner.pos.x, 0, pl.pos.z - partner.pos.z).normalize();
    talkSide = -axis.x >= 0 ? 1 : -1;
    lastLine = null;
    const acrossWall = game.place.insideHouse(pl.pos.x, pl.pos.z) !== game.place.insideHouse(partner.pos.x, partner.pos.z);
    if (acrossWall) newShot('ots', { a: partner, b: pl, door: true });
    else newShot('two', { a: partner, b: pl });
  }

  // A line is said: cut to whoever is speaking (after a line with feeling, first a beat on the listener)
  function onLine(speaker, isYou) {
    const partner = game.filmTalkPartner;
    if (game.mode !== 'talk' || !partner) return;
    if (talkWith !== partner) beginTalk(partner);
    // Whoever is actually speaking (a third person can join in, like Gran when Corin is at the door)
    const a = isYou ? game.player : game.people.find(p => p.name === speaker) ?? partner;
    const b = a === game.player ? partner : game.player;
    const felt = Boolean(FELT[a.mood]) || UNSETTLING.has(a.id);
    let type;
    if (!lastLine) type = shot?.door ? 'ots' : 'two';
    else if (felt) type = 'close';
    else type = lastLine.isYou !== isYou ? 'ots' : (roll() < 0.35 ? 'close' : 'ots');
    if (lastLine?.felt && lastLine.isYou !== isYou) {
      newShot('close', { a: b, b: a, reactionUntil: t + 0.9, then: { type, a, b } });
    } else if (type !== 'two' || shot?.type !== 'two') newShot(type, { a, b });
    lastLine = { isYou, at: t, felt };
  }

  // ---------- Each frame ----------

  function update(dt) {
    const pl = game.player;
    if (!pl || !game.place) return;
    t += dt;
    if (game.place.id !== lastPlace) {
      lastPlace = game.place.id;
      newShot('establishing');
    }
    pick();
    if (shot.reactionUntil && t > shot.reactionUntil && shot.then) newShot(shot.then.type, { a: shot.then.a, b: shot.then.b });

    let want;
    const partner = game.filmTalkPartner;
    if (shot.type === 'establishing') want = establishing(3.2);
    else if (shot.type === 'tracking') want = tracking();
    else if (shot.type === 'wide') want = wide();
    else if (shot.type === 'medium' || !partner) want = medium();
    else want = conversation(shot.type, shot.a ?? partner, shot.b ?? pl);

    // If someone else stands between the camera and what it's looking at, rise above them
    const subjectId = (shot.a ?? pl).id;
    const others = game.people.filter(p => p.id !== subjectId).map(p => p.group);
    if (pl.id !== subjectId) others.push(pl.group);
    if (others.length) {
      const dir = want.look.clone().sub(want.pos);
      const far = dir.length();
      ray.set(want.pos, dir.normalize());
      ray.far = Math.max(0.1, far - 0.35);
      const blockedFrom = from => {
        const d2 = want.look.clone().sub(from);
        ray.set(from, d2.clone().normalize());
        ray.far = Math.max(0.1, d2.length() - 0.35);
        return ray.intersectObjects(others, true).length > 0;
      };
      if (blockedFrom(want.pos)) {
        const start = want.pos.clone();
        let fixed = false;
        for (const k of [0.75, 0.55, 0.4]) {
          const closer = want.look.clone().lerp(start, k);
          closer.y = Math.max(closer.y, want.look.y);
          if (!blockedFrom(closer)) { want.pos.copy(closer); fixed = true; break; }
        }
        for (let tries = 0; !fixed && tries < 2; tries++) {
          want.pos.y += 0.4;
          fixed = !blockedFrom(want.pos);
        }
      }
    }

    // Tense moments get a little handheld sway
    const tense = game.people.some(p => UNSETTLING.has(p.id) && Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) < 9);
    if (tense) {
      want.pos.x += Math.sin(t * 1.7) * 0.03 + Math.sin(t * 3.1) * 0.015;
      want.pos.y += Math.sin(t * 2.3) * 0.02;
      want.roll += Math.sin(t * 0.9) * 0.012;
    }

    if (!cur.ready || shot.snap) {
      cur.pos.copy(want.pos);
      cur.look.copy(want.look);
      cur.fov = want.fov;
      cur.roll = want.roll;
      cur.ready = true;
      shot.snap = false;
    } else {
      const k = want.rate ? Math.min(1, dt * want.rate) : 1;
      cur.pos.lerp(want.pos, k);
      cur.look.lerp(want.look, k);
      cur.fov += (want.fov - cur.fov) * Math.min(1, dt * 2);
      cur.roll += (want.roll - cur.roll) * Math.min(1, dt * 2);
    }
    cam.position.copy(cur.pos);
    if (Math.abs(cam.fov - cur.fov) > 0.01) { cam.fov = cur.fov; cam.updateProjectionMatrix(); }
    cam.up.set(0, 1, 0);
    cam.lookAt(cur.look);
    if (cur.roll) cam.rotateZ(cur.roll);
    game.camTarget.set(cur.look.x, 0, cur.look.z);
    focus = cam.position.distanceTo(cur.look);
    closeness = shot.type === 'close' || shot.type === 'ots' ? 1 : shot.type === 'two' || shot.type === 'medium' ? 0.5 : 0;
  }

  // A fresh day or place: start again with an establishing shot
  function cut() { cur.ready = false; lastPlace = null; }

  // The prologue has its own camera; on a tall screen, step it back so nobody is cut off
  function adjustPrologue() {
    if (cam.fov !== 35) { cam.fov = 35; cam.updateProjectionMatrix(); }
    const f = portrait();
    if (f <= 1 || !game.cine) return;
    const c = game.cine;
    const pos = cam.position;
    pos.set(c.x + (pos.x - c.x) * f, pos.y * f, c.z + (pos.z - c.z) * f);
    cam.lookAt(c.x, 0.5, c.z);
  }

  return { update, cut, adjustPrologue, onLine, focus: () => focus, closeness: () => closeness, shot: () => shot?.type };
}
