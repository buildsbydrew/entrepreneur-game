import PersonSprite from './PersonSprite.js';
import { stepToward } from './movement.js';
import { findPath, pointOf } from './routes.js';
import { popShopBubble } from './shopBubble.js';

const PAUSE_MIN_MS = 500;
const PAUSE_MAX_MS = 2500;
const SHOP_CHANCE = 0.35; // how often a stroller stops at a shop when they reach a waypoint
const SHOP_MIN_MS = 3000;
const SHOP_MAX_MS = 4500;

const between = (min, max) => min + Math.random() * (max - min);

// Someone going about their day. They are one of two kinds:
//  - a stroller follows a loop of waypoints and sometimes stops at a shop on the way
//  - a trader waits by their stall and now and then goes shopping, then comes back
// Either way they are solid, like everyone else.
//
// options: { graph, node, ring, direction, speed, pickShop, onShop, errandMs }
//   node: the waypoint they start at (and, for traders, their home)
//   ring: the loop of waypoint names for strollers, or null for traders
//   pickShop(walker): returns a shop to visit, or null
//   errandMs: [min, max] time between trips, for traders
//   canLeave(): lets a trader hold off on a trip, for example when another trader is already away
export default class Walker {
  constructor(scene, key, options) {
    this.scene = scene;
    this.graph = options.graph;
    this.at = options.node;
    this.ring = options.ring ?? null;
    this.direction = options.direction ?? 1; // 1 follows the loop forwards, -1 backwards
    this.speed = options.speed;
    this.pickShop = options.pickShop;
    this.onShop = options.onShop;
    this.errandEvery = options.errandMs ?? null;
    this.canLeave = options.canLeave;
    this.errandIn = this.errandEvery ? between(...this.errandEvery) : Infinity;

    this.ownShop = null;   // a trader's own stall, which they don't shop at
    this.onErrand = false; // true while away on a shopping trip
    this.steps = [];       // what to do next
    this.current = null;   // what they are doing right now

    const start = pointOf(this.graph, this.at);
    this.person = new PersonSprite(scene, key, start.x, start.y);

    // An invisible block at their feet, so the player can't walk through them
    this.block = scene.add.rectangle(start.x, start.y - 10, 34, 20, 0x000000).setVisible(false);
    scene.movers.add(this.block);
    this.block.body.setImmovable(true);
  }

  // Plans a trip: walk to the shop, stand and shop for a while, then walk back to where they started
  startErrand() {
    const shop = this.pickShop(this);
    if (!shop) return false;

    const out = findPath(this.graph, this.at, shop.node);
    if (!out) return false;

    shop.busy = true; // only one person shops at a time
    this.onErrand = true;
    this.steps = [
      ...out.slice(1).map(node => ({ type: 'go', node })),
      { type: 'shop', shop, ms: between(SHOP_MIN_MS, SHOP_MAX_MS) },
      ...[...out].reverse().slice(1).map(node => ({ type: 'go', node })),
      { type: 'done' }
    ];
    return true;
  }

  nextStep() {
    if (this.steps.length > 0) return this.steps.shift();

    // Traders stay by their stall, and now and then go shopping
    if (!this.ring) {
      this.errandIn -= 1000;
      if (this.errandIn <= 0 && (!this.canLeave || this.canLeave())) {
        this.errandIn = between(...this.errandEvery);
        if (this.startErrand()) return this.steps.shift();
      }
      return { type: 'wait', ms: 1000 };
    }

    // Strollers follow the loop, and sometimes stop at a shop on the way
    if (Math.random() < SHOP_CHANCE && this.startErrand()) return this.steps.shift();

    const position = this.ring.indexOf(this.at);
    const next = this.ring[(position + this.direction + this.ring.length) % this.ring.length];
    this.steps.push({ type: 'wait', ms: between(PAUSE_MIN_MS, PAUSE_MAX_MS) });
    return { type: 'go', node: next };
  }

  update(delta) {
    if (!this.current) this.current = this.nextStep();
    const step = this.current;
    const image = this.person.image;

    if (step.type === 'wait') {
      step.ms -= delta;
      this.person.animate(delta, 0, 'down');
      if (step.ms <= 0) this.current = null;
      return;
    }

    if (step.type === 'done') {
      this.onErrand = false;
      this.current = null;
      return;
    }

    // Standing at the shop with a thought bubble, looking at the goods
    if (step.type === 'shop') {
      if (!step.started) {
        step.started = true;
        const icons = step.shop.icons;
        popShopBubble(this.scene, image.x, image.y, `icon-${icons[Math.floor(Math.random() * icons.length)]}`, 1800);
        if (this.onShop) this.onShop(step.shop, this);
      }

      step.ms -= delta;
      this.person.animate(delta, 0, 'up');
      if (step.ms <= 0) {
        step.shop.busy = false;
        this.current = null;
      }
      return;
    }

    // Walking to the next waypoint
    const move = stepToward(image, pointOf(this.graph, step.node), this.speed, delta);
    this.person.place(move.x, move.y);
    this.block.setPosition(move.x, move.y - 10);

    if (move.arrived) {
      this.at = step.node;
      this.current = null;
      this.person.animate(delta, 0, 'down');
    } else {
      this.person.animate(delta, move.pace, move.facing);
    }
  }
}
