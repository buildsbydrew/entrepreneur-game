// One person in the world: their body, where they stand, which way they face, and how they walk.
// The player is a Person too. Other people can be sent walking along a list of points.
import * as THREE from 'three';
import { buildBody, poseBody, poseFace, disposeBody, STAGES } from './body.js';
import { moveWithCollision, addPerson, removePerson } from '../world/collision.js';
import { poseAction, ACTIVITIES } from './actions.js';

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
    this.mood = 'calm';         // how they feel right now, shown on their face
    this.talkingFor = 0;        // seconds of talking left (the mouth moves)
    this.activity = null;       // what they're doing: { name, t, height, spot } (sitting, cooking...)
    this.running = false;       // set each frame while running
    this.jumpT = -1;            // 0..1 through a jump, -1 when not jumping
    this.idleFor = this.idleFor ?? 0;
    this.still = 0;             // seconds stood still, for the little things people do while waiting
    this.fidget = null;         // { name, t, length }
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
    this.group.position.set(this.pos.x, this.lift ?? 0, this.pos.z); // lift: raised off the floor, like a baby in a cot
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

  // ---------- Everyday activities ----------

  // Starts doing something: sit, eat, sew, read, lie, kneel, cook, sweep, play, lean, phone, wave.
  // spot: where to do it ({ x, z, facing, height, stand }) for sitting, lying and so on.
  startActivity(name, spot = null) {
    if (!ACTIVITIES[name]) return;
    if (this.activity) this.stopActivity();
    if (spot) {
      this.pos.x = spot.x;
      this.pos.z = spot.z;
      this.facing = spot.facing ?? this.facing;
    }
    this.route = [];
    this.pace = 0;
    this.activity = { name, t: 0, height: spot?.height, spot };
    if (spot) spot.taken = this;
  }

  // Gets up (from a seat or a bed, back onto the floor beside it)
  stopActivity() {
    const a = this.activity;
    if (!a) return;
    if (a.spot) {
      if (a.spot.taken === this) a.spot.taken = null;
      if (a.spot.stand) { this.pos.x = a.spot.stand.x; this.pos.z = a.spot.stand.z; }
    }
    this.activity = null;
  }

  isSeated() {
    return Boolean(this.activity && (ACTIVITIES[this.activity.name]?.seat === true || this.activity.height));
  }

  jump() {
    if (this.activity || this.jumpT >= 0) return false;
    this.jumpT = 0;
    return true;
  }

  // points: [{ x, z }]. A point marked door: true must be passed through (people never skip a doorway).
  walkTo(points) {
    if (this.activity) this.stopActivity();
    this.route = points.map(p => ({ x: p.x, z: p.z, door: Boolean(p.door) }));
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
        // Still stuck: skip this point, except a doorway, which they step into so they never end up walking round the walls
        const point = this.route.shift();
        if (point.door && !this.space.solids.some(s => point.x > s.minX && point.x < s.maxX && point.z > s.minZ && point.z < s.maxZ)) {
          this.pos.x = point.x;
          this.pos.z = point.z;
        }
        this.wait = 0;
      }
    } else {
      this.wait = 0;
    }
    return true;
  }

  // Each frame: animate the body
  update(dt) {
    if (this.pace > 0.05) this.phase += dt * (5 + this.pace * 5) * (this.stage === 'baby' ? 0.8 : 1) * (this.running ? 1.45 : 1);
    this.breath += dt;
    if (this.pace < 0.02) this.pace = 0;
    poseBody(this.body, this.phase, this.pace, this.breath);
    this.talkingFor = Math.max(0, this.talkingFor - dt);
    const talking = Math.min(1, this.talkingFor * 3);
    poseFace(this.body, this.breath, talking, this.mood);
    // Activities, jumps, running, and the small things people do while they wait
    if (this.activity) this.activity.t += dt;
    if (this.jumpT >= 0) { this.jumpT += dt / 0.75; if (this.jumpT >= 1) this.jumpT = -1; }
    if (this.pace < 0.05 && !this.activity && talking <= 0) this.still += dt; else { this.still = 0; this.fidget = null; }
    if (this.fidget) { this.fidget.t += dt; if (this.fidget.t > this.fidget.length) this.fidget = null; }
    else if (this.still > 7 && Math.sin(this.breath * 0.37 + this.phase) > 0.995) {
      const kinds = this.stage === 'adult' || this.stage === 'teen' ? ['look', 'stretch', 'scratch', 'phone', 'look'] : ['look', 'stretch', 'scratch', 'look'];
      this.fidget = { name: kinds[Math.floor(Math.abs(Math.sin(this.breath * 12.9)) * kinds.length) % kinds.length], t: 0, length: 2.4 };
      this.still = 0;
    }
    poseAction(this.body, this.activity, { running: this.running && this.pace > 0.3, jumpT: this.jumpT, talking, fidget: this.fidget }, this.breath);
    this.place();
  }

  // Says a line: the mouth moves for that long, and the face shows the feeling
  say(seconds, mood = 'calm') {
    this.talkingFor = seconds;
    this.mood = mood;
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
