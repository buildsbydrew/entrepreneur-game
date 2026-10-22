import { stepToward } from './movement.js';

const WAIT_BEFORE_SIDESTEP_MS = 350; // wait this long for someone to move before stepping round them
const GIVE_UP_MS = 2600;             // after this long, stop waiting so nobody is ever stuck for good
const SIDESTEP = 44;                 // how far to step aside, and a little more each time it doesn't work
const CALM_MS = 1500;                // this long without anyone in the way and the extra distance resets

// How far apart two people's feet are. Distances up and down count double, because of the angle of the view.
const gap = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 2);

// Walks one person toward a target without walking through anyone. If someone is in the way
// they wait a moment, then step round them, and if that doesn't work they carry on regardless.
//
// Everyone steps to their own right, like traffic. Two people walking at each other each step
// to their own right, which is opposite sides, so they pass instead of blocking each other.
export default class Mover {
  constructor(crowd, self) {
    this.crowd = crowd;
    this.self = self;
    this.blockedMs = 0;
    this.calmMs = 0;
    this.attempts = 0;
    this.detour = null;
    this.preferSouth = false; // customers arriving at the stall step away from it, not toward it
  }

  reset() {
    this.blockedMs = 0;
    this.calmMs = 0;
    this.attempts = 0;
    this.detour = null;
  }

  // Like stepToward, with an extra `waiting`: true if they stayed put because someone was in the way
  step(image, target, speed, delta) {
    let goal = this.detour ?? target;
    let move = stepToward(image, goal, speed, delta);

    if (this.detour && move.arrived) {
      this.detour = null;
      goal = target;
      move = stepToward(image, goal, speed, delta);
    }

    if (!this.blockedBy(image, move)) {
      this.blockedMs = 0;
      this.calmMs += delta;
      if (this.calmMs > CALM_MS) this.attempts = 0;
      return { ...move, waiting: false };
    }

    this.calmMs = 0;
    this.blockedMs += delta;
    if (this.blockedMs > GIVE_UP_MS) return { ...move, waiting: false };

    if (this.blockedMs > WAIT_BEFORE_SIDESTEP_MS && !this.detour) {
      this.detour = this.findSidestep(image, goal);
      this.attempts += 1;
    }

    return { x: image.x, y: image.y, arrived: false, facing: move.facing, pace: 0, waiting: true };
  }

  // Someone in the way of this step, but only if the step takes us closer to them.
  // Already overlapping and moving apart is fine.
  blockedBy(image, move) {
    const other = this.crowd.blocker(this.self, move.x, move.y);
    if (!other) return null;
    return gap(move, other.image) < gap(image, other.image) ? other : null;
  }

  // A free spot beside us. The right-hand side is tried first, then the left.
  findSidestep(image, goal) {
    const dx = goal.x - image.x;
    const dy = goal.y - image.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = SIDESTEP + 16 * Math.min(this.attempts, 3);

    // On a screen where y points down, a person heading along (dx, dy) has their right hand toward (-dy, dx)
    const sides = [{ x: -dy / length, y: dx / length }, { x: dy / length, y: -dx / length }];
    if (this.preferSouth) sides.sort((a, b) => b.y - a.y);

    for (const side of sides) {
      const x = image.x + side.x * reach;
      const y = image.y + side.y * reach;
      if (this.crowd.isFree(this.self, x, y)) return { x, y };
    }
    return null;
  }
}
