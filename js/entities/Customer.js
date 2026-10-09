const WALK_SPEED = 90;
const LEAVE_SPEED = 130;
const PERSON_W = 72;
const PERSON_H = 108;
const BUBBLE_W = 52;
const BUBBLE_H = 60;
const ICON_SIZE = 38;
const BAR_WIDTH = 50;
const UI_DEPTH = 2000; // bubbles and bars always draw above the people

// One shopper: walks to a spot at the stall, waits, then leaves happy or not.
export default class Customer {
  constructor(scene, item, slot, startX, patienceMs, textureKey) {
    this.scene = scene;
    this.item = item;
    this.slot = slot;
    this.textureKey = textureKey;
    this.patienceMax = patienceMs;
    this.patience = patienceMs;
    this.state = 'walking'; // walking, waiting, leaving
    this.exitX = startX;
    this.gone = false;

    // The person's feet stand a little below the spot at the stall
    const feetY = slot.y + 20;
    this.body = scene.add.image(startX, feetY, textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(PERSON_W, PERSON_H)
      .setDepth(feetY);

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

  update(delta) {
    if (this.state === 'walking') this.walkToSlot(delta);
    else if (this.state === 'waiting') this.wait(delta);
    else if (this.state === 'leaving') this.walkAway(delta);

    if (!this.gone) this.syncUi();
  }

  walkToSlot(delta) {
    const dx = this.slot.x - this.body.x;
    const step = (WALK_SPEED * delta) / 1000;

    if (Math.abs(dx) <= step) {
      this.body.x = this.slot.x;
      this.state = 'waiting';
    } else {
      this.body.x += Math.sign(dx) * step;
    }
  }

  wait(delta) {
    this.patience -= delta;

    if (this.patience <= 0) {
      this.leave('angry');
      this.scene.events.emit('customer-lost', this);
    }
  }

  walkAway(delta) {
    const dx = this.exitX - this.body.x;
    const step = (LEAVE_SPEED * delta) / 1000;

    if (Math.abs(dx) <= step) {
      this.destroy();
    } else {
      this.body.x += Math.sign(dx) * step;
    }
  }

  // mood is 'happy', 'angry', or 'neutral' (leaves quietly)
  leave(mood) {
    if (this.state === 'leaving') return;

    this.state = 'leaving';
    this.slot.customer = null;

    [this.bubble, this.icon, this.barBack, this.barFill].forEach(part => part.setVisible(false));

    if (mood === 'happy') this.say('Thanks!', '#8ee59a');
    else if (mood === 'angry') this.say('Too slow!', '#ff8a80');
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
    [this.body, this.bubble, this.icon, this.barBack, this.barFill, this.speech]
      .forEach(part => part.destroy());
    this.gone = true;
  }
}
