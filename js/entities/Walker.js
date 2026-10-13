import PersonSprite from './PersonSprite.js';
import { stepToward } from './movement.js';

const PAUSE_MIN_MS = 500;
const PAUSE_MAX_MS = 2500;

// Someone going about their day: they follow a loop of waypoints around the market,
// stopping for a moment at each one. They are solid, like everyone else.
export default class Walker {
  constructor(scene, key, route, startIndex, direction, speed) {
    this.route = route;
    this.index = startIndex;
    this.direction = direction; // 1 follows the route forwards, -1 backwards
    this.speed = speed;
    this.pause = 0;

    const start = route[startIndex];
    this.person = new PersonSprite(scene, key, start.x, start.y);

    // An invisible block at their feet, so the player can't walk through them
    this.block = scene.add.rectangle(start.x, start.y - 10, 34, 20, 0x000000).setVisible(false);
    scene.movers.add(this.block);
    this.block.body.setImmovable(true);

    this.target = route[this.nextIndex()];
  }

  nextIndex() {
    return (this.index + this.direction + this.route.length) % this.route.length;
  }

  update(delta) {
    if (this.pause > 0) {
      this.pause -= delta;
      this.person.animate(delta, 0, 'down');
      return;
    }

    const step = stepToward(this.person.image, this.target, this.speed, delta);
    this.person.place(step.x, step.y);
    this.block.setPosition(step.x, step.y - 10);

    if (step.arrived) {
      this.index = this.nextIndex();
      this.target = this.route[this.nextIndex()];
      this.pause = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
      this.person.animate(delta, 0, 'down');
    } else {
      this.person.animate(delta, step.pace, step.facing);
    }
  }
}
