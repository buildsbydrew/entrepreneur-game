// One person in the world: their body, where they stand, which way they face, and how they walk.
// The player is a Person too. Other people can be sent walking along a list of points.
import * as THREE from 'three';
import { buildBody, poseBody, disposeBody, STAGES } from './body.js';
import { moveWithCollision, addPerson, removePerson } from '../world/collision.js';

export default class Person {
  constructor(scene, space, { id = null, name = '', look, stage = 'adult', x = 0, z = 0, facing = 0 }) {
    this.scene = scene;
    this.space = space;
    this.id = id;
    this.name = name;
    this.look = look;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pos = { x, z };
    this.facing = facing;       // angle around the vertical axis; 0 faces south (toward the camera)
    this.phase = Math.random() * 6;
    this.breath = Math.random() * 6;
    this.pace = 0;              // 0 standing still, 1 walking at full speed
    this.route = [];            // points to walk through: [{ x, z }]
    this.wait = 0;              // seconds stood still because someone is in the way
    this.setStage(stage);
    addPerson(space, this);
    this.place();
  }

  // Rebuilds the body for a new stage of life
  setStage(stage) {
    if (this.body) {
      this.group.remove(this.body.root);
      disposeBody(this.body);
    }
    this.stage = stage;
    this.body = buildBody(this.look, stage);
    this.group.add(this.body.root);
    this.radius = STAGES[stage].radius;
    this.speed = STAGES[stage].speed;
  }

  place() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.facing;
  }

  // Turns smoothly toward an angle, the short way round
  turnToward(angle, dt) {
    let diff = angle - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * Math.min(1, dt * 12);
  }

  faceToward(x, z, dt = 1) {
    this.turnToward(Math.atan2(x - this.pos.x, z - this.pos.z), dt);
  }

  // Moves by a velocity (metres per second) for this frame, sliding along walls
  moveBy(vx, vz, dt) {
    const before = { x: this.pos.x, z: this.pos.z };
    moveWithCollision(this.space, this, vx * dt, vz * dt);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / Math.max(dt, 1e-6);
    if (moved > 0.2) this.turnToward(Math.atan2(vx, vz), dt);
    this.pace += (Math.min(1, moved / this.speed) - this.pace) * Math.min(1, dt * 10);
    return moved;
  }

  walkTo(points) {
    this.route = points.map(p => ({ x: p.x, z: p.z }));
  }

  // Follows the route. If someone is in the way they wait a moment, then step to their own right,
  // and after a few seconds they give up on that point rather than ever walking through anyone.
  followRoute(dt) {
    if (!this.route.length) return false;
    const target = this.route[0];
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      this.route.shift();
      this.wait = 0;
      return true;
    }
    const speed = this.speed * 0.55; // people stroll; the player is the one in a hurry
    const step = Math.min(dist, speed * dt);
    const moved = this.moveBy((dx / dist) * (step / dt), (dz / dist) * (step / dt), dt);
    if (moved < speed * 0.3) {
      this.wait += dt;
      if (this.wait > 0.4) {
        // their own right, relative to where they are heading
        this.moveBy((-dz / dist) * speed * 0.6, (dx / dist) * speed * 0.6, dt);
      }
      if (this.wait > 3) {
        this.route.shift();
        this.wait = 0;
      }
    } else {
      this.wait = 0;
    }
    return true;
  }

  // Each frame: animate the body
  update(dt) {
    if (this.pace > 0.05) this.phase += dt * (5 + this.pace * 5) * (this.stage === 'baby' ? 0.8 : 1);
    this.breath += dt;
    if (this.pace < 0.02) this.pace = 0;
    poseBody(this.body, this.phase, this.pace, this.breath);
    this.place();
  }

  // Slows to a stop when nothing is moving them
  rest(dt) {
    this.pace += (0 - this.pace) * Math.min(1, dt * 8);
  }

  headHeight() {
    return this.body.height;
  }

  destroy() {
    removePerson(this.space, this);
    this.scene.remove(this.group);
    disposeBody(this.body);
  }
}
