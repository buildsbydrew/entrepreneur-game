// Everyday moves, on top of the walk in body.js: running, jumping, sitting, lying in bed, kneeling,
// waving, talking with your hands, eating, cooking, reading, sewing, sweeping, playing with a ball,
// leaning on a counter, checking a phone, and the small things people do while they wait (looking
// around, stretching, scratching their head). All made from the same few joints: hips, shoulders,
// the upper body and the head. Some moves hold a small thing (a book, a broom, a phone, a ball).
import * as THREE from 'three';
import { STAGES } from './body.js';
import { rbox, cyl, ball, at } from '../render/shapes.js';

// The moves someone can be doing. "seat" moves need somewhere to sit or lie.
export const ACTIVITIES = {
  sit: { seat: true },
  eat: { seat: true },
  sew: { seat: true },
  read: { seat: 'optional', holds: 'book' },
  lie: { seat: true },
  kneel: {},
  cook: {},
  sweep: { holds: 'broom' },
  play: { holds: 'ball' },
  lean: {},
  phone: { holds: 'phone' },
  wave: {}
};

// Small things held in the hands, made once per body when first needed
function held(body, kind) {
  body.held = body.held ?? {};
  if (body.held[kind]) return body.held[kind];
  const s = STAGES[body.stage];
  let obj;
  if (kind === 'book') {
    obj = new THREE.Group();
    obj.add(at(rbox(0.22, 0.03, 0.16, '#d6336c', 0.01), -0.06, 0, 0));
    obj.add(at(rbox(0.22, 0.03, 0.16, '#fff4dc', 0.01), 0.06, 0.005, 0));
    obj.rotation.x = -0.9;
    obj.position.set(0, s.torso * 0.6, s.width * 0.55);
    body.upper.add(obj);
  } else if (kind === 'broom') {
    obj = new THREE.Group();
    obj.add(at(cyl(0.02, 0.02, 1.2, '#b27436', 5), 0, -0.3, 0));
    obj.add(at(rbox(0.28, 0.14, 0.08, '#c9a35c', 0.02), 0, -0.92, 0));
    obj.position.set(0, -s.arm, 0.04);
    body.arms[1].add(obj);
  } else if (kind === 'phone') {
    obj = rbox(0.07, 0.13, 0.015, '#1f2933', 0.01);
    obj.position.set(0, -s.arm - 0.02, 0.06);
    body.arms[1].add(obj);
  } else if (kind === 'ball') {
    obj = ball(0.11, '#d6336c', 10, 8);
    body.root.add(obj);
  }
  obj.visible = false;
  body.held[kind] = obj;
  return obj;
}

function showHeld(body, kind) {
  for (const [k, obj] of Object.entries(body.held ?? {})) obj.visible = k === kind;
  if (kind) held(body, kind).visible = true;
}

// Poses a body for what it's doing. Runs after poseBody (the walk), and overrides what it needs to.
//   act: { name, t } the activity and how long it's been going; null when walking or standing
//   move: { running, jumpT (0..1 or -1), talking (0..1), fidget: { name, t } }
export function poseAction(body, act, move, time) {
  const s = STAGES[body.stage];
  const [legL, legR] = body.legs;
  const [armL, armR] = body.arms;
  body.upper.rotation.z = 0;
  body.root.rotation.x = 0;
  body.head.rotation.set(0, 0, 0);
  armL.rotation.z = 0;
  armR.rotation.z = 0;
  body.upper.rotation.x = s.stoop ?? 0;

  // Running: longer strides, arms pumping, leaning into it (the walk swing is just made bigger)
  if (move.running && !act) {
    legL.rotation.x *= 1.5;
    legR.rotation.x *= 1.5;
    armL.rotation.x *= 1.9;
    armR.rotation.x *= 1.9;
    armL.rotation.z = -0.2;
    armR.rotation.z = 0.2;
    body.upper.rotation.x += 0.18;
  }

  // Jumping: a crouch, a lift with the arms up, and a soft landing
  if (move.jumpT >= 0 && !act) {
    const j = move.jumpT;
    const crouch = j < 0.2 ? j / 0.2 : j > 0.85 ? (1 - j) / 0.15 : 0;
    const air = j >= 0.2 && j <= 0.85 ? Math.sin(((j - 0.2) / 0.65) * Math.PI) : 0;
    body.root.position.y = air * s.leg * 0.55 - crouch * s.leg * 0.18;
    legL.rotation.x = legR.rotation.x = -crouch * 0.6 + air * 0.35;
    armL.rotation.x = armR.rotation.x = -air * 2.6 - crouch * 0.4;
    body.upper.rotation.x += crouch * 0.3;
  }

  let holds = null;
  if (act) {
    const t = act.t;
    const name = act.name;
    const seatH = act.height ?? 0.45;
    const hipY = s.leg + 0.08 * Math.max(0.6, s.leg / 0.74);
    if (ACTIVITIES[name]?.seat === true || (name === 'read' && act.height)) {
      if (name === 'lie') {
        // On the back, head on the pillow
        body.root.rotation.x = -Math.PI / 2;
        body.root.position.y = seatH + s.width * 0.3;
        legL.rotation.x = legR.rotation.x = 0;
        armL.rotation.x = armR.rotation.x = 0;
        armL.rotation.z = -0.15;
        armR.rotation.z = 0.15;
      } else {
        // Sitting: hips bent, legs forward, sat at the seat's height
        body.root.position.y = seatH - hipY + 0.04;
        legL.rotation.x = legR.rotation.x = -Math.PI / 2;
        armL.rotation.x = armR.rotation.x = -0.35;
      }
    }
    if (name === 'eat') {
      // A spoonful now and then
      const bite = Math.max(0, Math.sin(t * 1.6)) ** 3;
      armR.rotation.x = -0.9 - bite * 1.3;
      armR.rotation.z = bite * 0.35;
      armL.rotation.x = -0.9;
    } else if (name === 'sew') {
      armL.rotation.x = armR.rotation.x = -1.0;
      armL.rotation.z = 0.25;
      armR.rotation.z = -0.25 + Math.sin(t * 5) * 0.12;
      body.head.rotation.x = 0.35;
    } else if (name === 'read') {
      armL.rotation.x = armR.rotation.x = -1.15;
      armL.rotation.z = 0.35;
      armR.rotation.z = -0.35;
      body.head.rotation.x = 0.3;
      holds = 'book';
    } else if (name === 'kneel') {
      // Down on the knees at the flower bed, reaching in
      body.root.position.y = -s.leg * 0.5;
      legL.rotation.x = legR.rotation.x = 1.4;
      body.upper.rotation.x += 0.45;
      armL.rotation.x = -1.2 + Math.sin(t * 2.2) * 0.25;
      armR.rotation.x = -1.2 + Math.sin(t * 2.2 + 2) * 0.25;
      body.head.rotation.x = 0.3;
    } else if (name === 'cook') {
      // Stirring the pot
      armL.rotation.x = -1.1;
      armR.rotation.x = -1.2 + Math.sin(t * 4) * 0.15;
      armR.rotation.z = Math.cos(t * 4) * 0.2;
      body.head.rotation.x = 0.25;
    } else if (name === 'sweep') {
      armL.rotation.x = armR.rotation.x = -0.6;
      armR.rotation.z = Math.sin(t * 3) * 0.45;
      armL.rotation.z = Math.sin(t * 3) * 0.35;
      body.upper.rotation.z = Math.sin(t * 3) * 0.06;
      body.upper.rotation.x += 0.12;
      holds = 'broom';
    } else if (name === 'play') {
      // Kicking a ball about: a kick every couple of seconds, the ball rolling out and back
      const k = (t % 2.2) / 2.2;
      const kick = k < 0.25 ? Math.sin((k / 0.25) * Math.PI) : 0;
      legR.rotation.x = -kick * 1.1;
      armL.rotation.x = kick * 0.6;
      armR.rotation.x = -kick * 0.4;
      const b = held(body, 'ball');
      const roll = k < 0.25 ? 0 : Math.sin(((k - 0.25) / 0.75) * Math.PI);
      b.position.set(0.1, 0.11, s.width * 0.6 + roll * 1.2);
      holds = 'ball';
    } else if (name === 'lean') {
      // Leaning on the counter
      body.upper.rotation.x += 0.28;
      armL.rotation.x = armR.rotation.x = -1.25;
      armL.rotation.z = 0.2;
      armR.rotation.z = -0.2;
    } else if (name === 'phone') {
      armR.rotation.x = -1.6;
      armR.rotation.z = -0.35;
      armL.rotation.x = -0.2;
      body.head.rotation.x = 0.4;
      holds = 'phone';
    } else if (name === 'wave') {
      armR.rotation.z = 2.5 + Math.sin(t * 9) * 0.35;
      armR.rotation.x = 0;
    }
  }

  // Talking with your hands, and a nod now and then
  if (move.talking > 0 && (!act || ACTIVITIES[act.name]?.seat)) {
    const g = move.talking;
    armR.rotation.x += (-0.5 + Math.sin(time * 3.1) * 0.35) * g;
    armL.rotation.x += (-0.25 + Math.sin(time * 2.3 + 1) * 0.2) * g;
    armR.rotation.z += Math.sin(time * 2.7) * 0.15 * g;
    body.head.rotation.x += Math.sin(time * 4.2) * 0.06 * g;
    body.head.rotation.y += Math.sin(time * 1.3) * 0.08 * g;
  }

  // The small things people do while they wait
  const f = move.fidget;
  if (f && !act && move.talking <= 0) {
    const k = Math.min(1, f.t / 0.4) * Math.min(1, Math.max(0, (f.length - f.t) / 0.4));
    if (f.name === 'look') body.head.rotation.y = Math.sin(f.t * 1.6) * 0.7 * k;
    if (f.name === 'stretch') { armL.rotation.z = -2.7 * k; armR.rotation.z = 2.7 * k; body.upper.rotation.x -= 0.1 * k; }
    if (f.name === 'scratch') { armR.rotation.z = 2.3 * k; armR.rotation.x = -0.6 * k + Math.sin(f.t * 14) * 0.08 * k; body.head.rotation.z = 0.12 * k; }
    if (f.name === 'phone') { armR.rotation.x = -1.6 * k; armR.rotation.z = -0.35 * k; body.head.rotation.x = 0.4 * k; holds = k > 0.3 ? 'phone' : null; }
  }
  showHeld(body, holds);
}
