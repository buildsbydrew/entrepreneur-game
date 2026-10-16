import { WALK_FRAMES } from '../art/people.js';

const PERSON_W = 72;
const PERSON_H = 108;
const FRAME_MS = 100; // how long each walking frame shows at full speed

// Wraps a person's drawing and brings it to life. It turns to face the way they
// are heading, steps while they move, and breathes gently when they stand still.
export default class PersonSprite {
  constructor(scene, key, x, feetY, facing = 'down') {
    this.scene = scene;
    this.key = key;
    this.facing = facing; // 'down', 'up', 'left' or 'right'
    this.shown = '';
    this.step = 0;
    this.clock = Math.random() * 3000; // so people don't breathe in sync

    this.image = scene.add.image(x, feetY, `${key}-${facing}-idle`)
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

  // moving: 0 to 1, how fast they are going.
  // facing: 'down', 'up', 'left' or 'right'. Pass null to keep facing the same way.
  animate(delta, moving, facing) {
    this.clock += delta;
    if (facing) this.facing = facing;

    const sideways = this.facing === 'left' || this.facing === 'right';
    const view = sideways ? 'side' : this.facing;

    let pose = 'idle';
    let breathe = 0;

    if (moving > 0.05) {
      this.step += delta * moving; // slower movement means slower steps
      pose = `walk${Math.floor(this.step / FRAME_MS) % WALK_FRAMES}`;
    } else {
      this.step = 0;
      breathe = Math.sin(this.clock / 420) * 0.012;
    }

    this.pose = pose; // the game listens for footsteps
    let texture = `${this.key}-${view}-${pose}`;
    if (!this.scene.textures.exists(texture)) texture = `${this.key}-down-idle`;

    if (texture !== this.shown) {
      this.image.setTexture(texture);
      this.shown = texture;
    }

    // The side view is drawn facing right, so flip it to face left
    this.image.setFlipX(this.facing === 'left');
    this.image.scaleX = this.baseScaleX;
    this.image.scaleY = this.baseScaleY * (1 + breathe);
  }

  destroy() {
    this.image.destroy();
  }
}
