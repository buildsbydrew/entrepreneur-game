import { WALK_FRAMES } from '../art/people.js';

const PERSON_W = 72;
const PERSON_H = 108;
const FRAME_MS = 115; // how long each walking frame shows at full speed

// Wraps a person's drawing and brings it to life: it steps while moving,
// leans into the direction of travel, and breathes gently when standing still.
export default class PersonSprite {
  constructor(scene, key, x, feetY) {
    this.key = key;
    this.shown = '';
    this.step = 0;
    this.clock = Math.random() * 3000; // so people don't breathe in sync

    this.image = scene.add.image(x, feetY, `${key}-idle`)
      .setOrigin(0.5, 1) // pivots around the feet
      .setDisplaySize(PERSON_W, PERSON_H);
    this.baseScaleX = this.image.scaleX;
    this.baseScaleY = this.image.scaleY;
    this.place(x, feetY);
  }

  // Lower on screen draws in front, so depth follows the feet
  place(x, feetY) {
    this.image.setPosition(x, feetY).setDepth(feetY);
  }

  // moving: 0 to 1, how fast they are going. dirX: -1, 0 or 1.
  animate(delta, moving, dirX) {
    this.clock += delta;

    let texture = `${this.key}-idle`;
    let tilt = 0;
    let breathe = 0;

    if (moving > 0.05) {
      this.step += delta * moving; // slower movement means slower steps
      const frame = Math.floor(this.step / FRAME_MS) % WALK_FRAMES;
      texture = `${this.key}-walk${frame}`;
      tilt = dirX * 3 * Math.min(1, moving);
    } else {
      this.step = 0;
      breathe = Math.sin(this.clock / 420) * 0.012;
    }

    if (texture !== this.shown) {
      this.image.setTexture(texture);
      this.shown = texture;
    }

    this.image.scaleX = this.baseScaleX;
    this.image.scaleY = this.baseScaleY * (1 + breathe);
    this.image.angle += (tilt - this.image.angle) * 0.2; // eases into the lean
  }

  destroy() {
    this.image.destroy();
  }
}
