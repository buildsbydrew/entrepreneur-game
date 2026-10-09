const BODY_COLORS = [0x8e44ad, 0x2980b9, 0xc0392b, 0x16a085, 0xd35400, 0x2c3e50];
const WALK_SPEED = 90;
const LEAVE_SPEED = 130;
const BAR_WIDTH = 50;

// One shopper: walks to a spot at the stall, waits, then leaves happy or not.
export default class Customer {
  constructor(scene, item, slot, startX, patienceMs) {
    this.scene = scene;
    this.item = item;
    this.slot = slot;
    this.patienceMax = patienceMs;
    this.patience = patienceMs;
    this.state = 'walking'; // walking, waiting, leaving
    this.exitX = startX;
    this.gone = false;

    const color = Phaser.Utils.Array.GetRandom(BODY_COLORS);
    this.body = scene.add.circle(startX, slot.y, 16, color).setDepth(10);

    // Thought bubble showing what they want
    this.bubble = scene.add.text(0, 0, item.name, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#1b1b1b',
      backgroundColor: item.color,
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(11);

    // Patience bar
    this.barBack = scene.add.rectangle(0, 0, BAR_WIDTH, 6, 0x000000, 0.5).setDepth(11);
    this.barFill = scene.add.rectangle(0, 0, BAR_WIDTH, 6, 0x2ecc71).setOrigin(0, 0.5).setDepth(12);

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
    this.barBack.setVisible(false);
    this.barFill.setVisible(false);

    if (mood === 'happy') {
      this.bubble.setText('Thanks!');
      this.bubble.setBackgroundColor('#8ee59a');
    } else if (mood === 'angry') {
      this.bubble.setText('Too slow!');
      this.bubble.setBackgroundColor('#ff8a80');
    } else {
      this.bubble.setVisible(false);
    }
  }

  syncUi() {
    this.bubble.setPosition(this.body.x, this.body.y - 48);
    this.barBack.setPosition(this.body.x, this.body.y - 28);
    this.barFill.setPosition(this.body.x - BAR_WIDTH / 2, this.body.y - 28);

    const ratio = Math.max(0, this.patience / this.patienceMax);
    this.barFill.scaleX = ratio;

    if (ratio > 0.5) this.barFill.setFillStyle(0x2ecc71);
    else if (ratio > 0.25) this.barFill.setFillStyle(0xf39c12);
    else this.barFill.setFillStyle(0xe74c3c);
  }

  destroy() {
    this.body.destroy();
    this.bubble.destroy();
    this.barBack.destroy();
    this.barFill.destroy();
    this.gone = true;
  }
}