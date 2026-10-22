import PersonSprite from './PersonSprite.js';
import Mover from './Mover.js';
import { play } from '../audio/sound.js';

const WALK_SPEED = 90;
const LEAVE_SPEED = 130;
const PERSON_H = 108;
const BUBBLE_W = 52;
const BUBBLE_H = 60;
const ICON_SIZE = 38;
const BAR_WIDTH = 50;
const UI_DEPTH = 2000;   // bubbles and bars always draw above the people
const LANE_OFFSET = 50;        // the street customers arrive along is this far below their spot at the stall
const LEAVE_LANE_OFFSET = 85;  // and the one they leave along is further down, so the two never meet head-on

// One shopper. They walk along the street, step up to a spot at the stall, wait, then step back
// down and walk off the edge of the market, to the left or the right.
// Walking along the street and stepping in from below means they never walk through
// anyone who is already waiting, and arriving and leaving on separate lanes means
// people coming and going don't get in each other's way.
export default class Customer {
  constructor(scene, item, slot, startX, patienceMs, textureKey) {
    this.scene = scene;
    this.item = item;
    // The most this customer will pay: anywhere from the standard price up to double it.
    // So nobody walks away at the standard price, and a small rise only loses a few people.
    this.maxPrice = item.sellPrice * (1 + Math.random());
    this.slot = slot;
    this.textureKey = textureKey;
    this.patienceMax = patienceMs;
    this.patience = patienceMs;
    this.state = 'walking'; // walking, waiting, leaving
    this.leaveTime = 0;
    this.gone = false;

    // They walk off the edge of the market, to the left or to the right
    this.exitX = Math.random() < 0.5 ? -80 : scene.physics.world.bounds.width + 80;

    // The person's feet stand a little below the spot at the stall
    const slotFeet = slot.y + 20;
    this.laneY = slotFeet + LANE_OFFSET;
    this.leaveLaneY = slotFeet + LEAVE_LANE_OFFSET;
    this.path = [{ x: slot.x, y: this.laneY }, { x: slot.x, y: slotFeet }];

    this.person = new PersonSprite(scene, textureKey, startX, this.laneY);
    this.body = this.person.image;

    // An invisible block at their feet, so the player can't walk through them
    this.block = scene.add.rectangle(startX, this.laneY - 10, 46, 20, 0x000000).setVisible(false);
    scene.movers.add(this.block);
    this.block.body.setImmovable(true);

    // They also keep out of other people's way
    this.mover = new Mover(scene.crowd, this);
    this.mover.preferSouth = true;
    scene.crowd.add(this);

    // Thought bubble showing what they want
    this.bubble = scene.add.image(0, 0, 'bubble')
      .setOrigin(0.5, 1)
      .setDisplaySize(BUBBLE_W, BUBBLE_H)
      .setDepth(UI_DEPTH);
    this.icon = scene.add.image(0, 0, `icon-${item.id}`)
      .setDisplaySize(ICON_SIZE, ICON_SIZE)
      .setDepth(UI_DEPTH + 1);

    // Patience bar
    this.barBack = scene.add.rectangle(0, 0, BAR_WIDTH, 6, 0x3b2a20, 0.7).setDepth(UI_DEPTH);
    this.barFill = scene.add.rectangle(0, 0, BAR_WIDTH, 6, 0x2ecc71).setOrigin(0, 0.5).setDepth(UI_DEPTH + 1);

    // Short message shown when they leave
    this.speech = scene.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#1b1b1b',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 1).setDepth(UI_DEPTH + 2).setVisible(false);

    this.syncUi();
  }

  // Where their feet are, which is what other people keep clear of
  get image() {
    return this.body;
  }

  update(delta) {
    if (this.gone) return;

    if (this.state === 'walking') this.walkToSlot(delta);
    else if (this.state === 'waiting') this.wait(delta);
    else if (this.state === 'leaving') this.walkAway(delta);

    if (!this.gone) {
      this.block.setPosition(this.body.x, this.body.y - 10);
      this.syncUi();
    }
  }

  // Moves along the path, easing off at each corner. Returns false if someone made them wait.
  followPath(delta, speed) {
    const move = this.mover.step(this.body, this.path[0], speed, delta);

    if (move.waiting) {
      this.person.animate(delta, 0, null);
      return false;
    }

    this.person.place(move.x, move.y);
    this.person.animate(delta, move.arrived ? 0.6 : (move.pace * speed) / WALK_SPEED, move.facing);
    if (move.arrived) this.path.shift();
    return true;
  }

  walkToSlot(delta) {
    this.followPath(delta, WALK_SPEED);

    if (this.path.length === 0) {
      this.state = 'waiting';
      this.scene.events.emit('customer-arrived', this);
      this.person.animate(delta, 0, 'up');
    }
  }

  wait(delta) {
    this.person.animate(delta, 0, 'up');
    this.patience -= delta;

    if (this.patience <= 0) {
      this.leave('angry');
      this.scene.events.emit('customer-lost', this);
    }
  }

  // Starts slowly and picks up pace
  walkAway(delta) {
    this.leaveTime += delta;
    this.followPath(delta, Math.min(LEAVE_SPEED, 40 + this.leaveTime * 0.2));

    if (this.path.length === 0) this.destroy();
  }

  // mood is 'happy', 'angry', 'pricey' or 'neutral' (leaves quietly)
  leave(mood) {
    if (this.state === 'leaving') return;

    this.state = 'leaving';
    this.slot.customer = null;

    // Back down to the lower lane, then off along it. On the way they step to their own right,
    // so two people leaving in opposite directions pass each other.
    this.path = [{ x: this.body.x, y: this.leaveLaneY }, { x: this.exitX, y: this.leaveLaneY }];
    this.mover.reset();
    this.mover.preferSouth = false;

    [this.bubble, this.icon, this.barBack, this.barFill].forEach(part => part.setVisible(false));

    if (mood === 'happy') this.say('Thanks!', '#8ee59a');
    else if (mood === 'angry') {
      this.say('Too slow!', '#ff8a80');
      play('sad');
    } else if (mood === 'pricey') {
      this.say('Too pricey!', '#ffd180');
      play('nope');
    }
  }

  say(message, color) {
    this.speech.setText(message).setBackgroundColor(color).setVisible(true);
  }

  // Keeps the bubble, icon and bar floating above the person's head
  syncUi() {
    const x = this.body.x;
    const bubbleBottom = this.body.y - PERSON_H - 2;
    const bubbleTop = bubbleBottom - BUBBLE_H;

    this.bubble.setPosition(x, bubbleBottom);
    this.icon.setPosition(x, bubbleTop + 23);
    this.speech.setPosition(x, bubbleBottom - 6);

    this.barBack.setPosition(x, bubbleTop - 10);
    this.barFill.setPosition(x - BAR_WIDTH / 2, bubbleTop - 10);

    const ratio = Math.max(0, this.patience / this.patienceMax);
    this.barFill.scaleX = ratio;

    if (ratio > 0.5) this.barFill.setFillStyle(0x2ecc71);
    else if (ratio > 0.25) this.barFill.setFillStyle(0xf39c12);
    else this.barFill.setFillStyle(0xe74c3c);
  }

  destroy() {
    this.scene.crowd.remove(this);
    this.person.destroy();
    this.block.destroy();
    [this.bubble, this.icon, this.barBack, this.barFill, this.speech].forEach(part => part.destroy());
    this.gone = true;
  }
}
