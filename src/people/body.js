// A person's body, built from simple shapes, in the shape of their stage of life:
// a baby is small with a big head, a child is a bit taller, a teen is nearly grown,
// an adult is full height, and an elder is slightly shorter with grey hair and a gentle stoop.
// The front of the body faces +z. Arms and legs swing from the shoulders and hips.
import * as THREE from 'three';
import { mesh, rbox, cyl, ball, at } from '../render/shapes.js';

// Sizes in metres for each stage of life
export const STAGES = {
  baby:  { leg: 0.2,  torso: 0.26, width: 0.3,  head: 0.2,  arm: 0.2,  stride: 0.5, speed: 1.3, radius: 0.22 },
  child: { leg: 0.42, torso: 0.38, width: 0.38, head: 0.23, arm: 0.34, stride: 0.65, speed: 3.6, radius: 0.27 },
  teen:  { leg: 0.66, torso: 0.54, width: 0.5,  head: 0.26, arm: 0.48, stride: 0.75, speed: 4.2, radius: 0.31 },
  adult: { leg: 0.74, torso: 0.62, width: 0.58, head: 0.27, arm: 0.52, stride: 0.75, speed: 4.0, radius: 0.33 },
  elder: { leg: 0.7,  torso: 0.58, width: 0.56, head: 0.27, arm: 0.5,  stride: 0.5,  speed: 2.8, radius: 0.33, stoop: 0.16 }
};

// look: { body: 'boy' | 'girl', skin, shirt, bottom, hair: 'short' | 'bun' | 'wrap' | 'cap' | 'curls',
//         hairColor, accent }
export function buildBody(look, stage) {
  const s = STAGES[stage];
  const root = new THREE.Group();
  const legs = [];
  const arms = [];
  const feminine = look.body === 'girl';
  const hairColor = stage === 'elder' ? '#d8d4cc' : look.hairColor ?? '#1a1a1a';
  const footH = 0.08 * Math.max(0.6, s.leg / 0.74);

  // Legs: they swing from the hips
  const hipY = s.leg + footH;
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * s.width * 0.22, hipY, 0);
    const legColor = feminine && stage !== 'baby' ? look.skin : look.bottom;
    hip.add(at(rbox(s.width * 0.34, s.leg, s.width * 0.38, legColor, 0.05), 0, -s.leg / 2, 0));
    hip.add(at(rbox(s.width * 0.38, footH, s.width * 0.55, '#3b2a20', 0.03), 0, -s.leg - footH / 2 + 0.01, s.width * 0.08));
    root.add(hip);
    legs.push(hip);
  }

  // The body and head sit on an upper group, which can lean forward for elders
  const upper = new THREE.Group();
  upper.position.y = hipY;
  root.add(upper);
  upper.add(at(rbox(s.width, s.torso, s.width * 0.6, look.shirt, Math.min(0.12, s.width * 0.2)), 0, s.torso / 2, 0));
  if (feminine && stage !== 'baby') {
    // a wrap skirt over the hips
    upper.add(at(cyl(s.width * 0.48, s.width * 0.7, s.leg * 0.65, look.bottom, 10), 0, -s.leg * 0.25, 0));
  }
  if (stage === 'baby') {
    // a nappy
    upper.add(at(rbox(s.width * 1.02, 0.12, s.width * 0.62, '#fff4dc', 0.05), 0, 0.02, 0));
  }

  // Arms: they swing from the shoulders
  const shoulderY = s.torso - 0.05;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (s.width / 2 + s.width * 0.14), shoulderY, 0);
    shoulder.add(at(rbox(s.width * 0.26, s.arm, s.width * 0.3, look.shirt, 0.05), 0, -s.arm / 2 + 0.03, 0));
    shoulder.add(at(ball(s.width * 0.16, look.skin, 8, 6), 0, -s.arm, 0));
    upper.add(shoulder);
    arms.push(shoulder);
  }

  // Neck and head
  upper.add(at(cyl(s.head * 0.3, s.head * 0.32, 0.1, look.skin, 6), 0, s.torso + 0.03, 0));
  const head = new THREE.Group();
  head.position.y = s.torso + s.head * 0.95;
  upper.add(head);
  head.add(ball(s.head, look.skin, 14, 10));
  for (const side of [-1, 1]) head.add(at(ball(s.head * 0.14, '#1a1a1a', 6, 4), side * s.head * 0.36, s.head * 0.1, s.head * 0.9));
  head.add(at(ball(s.head * 0.17, look.skin, 6, 4), 0, -s.head * 0.15, s.head * 0.96)); // nose
  addHair(head, look, stage, hairColor, s.head);

  if (s.stoop) upper.rotation.x = s.stoop;

  // Rough height, for placing things above someone's head
  const height = hipY + s.torso + s.head * 2;
  return { root, upper, legs, arms, head, height, stage };
}

function addHair(head, look, stage, color, r) {
  if (stage === 'baby') {
    head.add(at(mesh(new THREE.SphereGeometry(r * 1.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), color), 0, r * 0.05, 0));
    return;
  }
  const style = look.hair ?? 'short';
  if (style === 'cap') {
    head.add(at(mesh(new THREE.SphereGeometry(r * 1.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), look.accent ?? '#f39c12'), 0, r * 0.12, 0));
    head.add(at(rbox(r * 1.3, r * 0.15, r * 0.95, look.accent ?? '#f39c12', 0.02), 0, r * 0.2, r * 0.95));
  } else if (style === 'wrap') {
    const wrap = ball(r * 1.12, look.accent ?? '#d6336c', 12, 8);
    wrap.scale.set(1, 0.85, 1);
    head.add(at(wrap, 0, r * 0.42, -r * 0.1));
    head.add(at(ball(r * 0.46, look.accent ?? '#d6336c', 8, 6), 0, r * 1.36, -r * 0.3));
  } else if (style === 'bun') {
    head.add(at(mesh(new THREE.SphereGeometry(r * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), color), 0, r * 0.07, -r * 0.03));
    head.add(at(ball(r * 0.44, color, 8, 6), 0, r * 0.95, -r * 0.65));
  } else if (style === 'curls') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      head.add(at(ball(r * 0.36, color, 6, 5), Math.cos(a) * r * 0.72, r * 0.62 + Math.sin(i * 1.7) * r * 0.08, Math.sin(a) * r * 0.72 - r * 0.15));
    }
    head.add(at(ball(r * 0.5, color, 8, 6), 0, r * 0.85, -r * 0.1));
  } else {
    head.add(at(mesh(new THREE.SphereGeometry(r * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), color), 0, r * 0.1, -r * 0.03));
  }
}

// Swings arms and legs while walking, and breathes while standing.
// t: a running clock for this person. pace: 0 standing, 1 full walking speed.
export function poseBody(body, phase, pace, breath) {
  const s = STAGES[body.stage];
  const swing = Math.sin(phase) * s.stride * pace;
  body.legs[0].rotation.x = swing;
  body.legs[1].rotation.x = -swing;
  body.arms[0].rotation.x = -swing * 0.85;
  body.arms[1].rotation.x = swing * 0.85;

  // A little bounce with each step; babies waddle from side to side instead
  const bounce = Math.abs(Math.cos(phase)) * 0.05 * pace;
  body.root.position.y = bounce;
  body.root.rotation.z = body.stage === 'baby' ? Math.sin(phase) * 0.12 * pace : 0;
  body.upper.scale.y = 1 + Math.sin(breath * 2.2) * 0.012 * (1 - pace);
}

// Frees the shapes' memory when a body is replaced (for example when someone grows up)
export function disposeBody(body) {
  body.root.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
}
