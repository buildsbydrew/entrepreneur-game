// The player: creating them, the camera, and moving with the keyboard or the joystick.
// These methods are added to the scene, so `this` is the scene.
import PersonSprite from '../../entities/PersonSprite.js';
import { touch } from '../../ui/touch.js';
import { play } from '../../audio/sound.js';
import { WORLD_W, WORLD_H, ACCEL, DRAG } from '../constants.js';

export const controlsMethods = {
  createPlayer() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // The invisible block is what moves and collides. The drawing follows it.
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 36, 32, 0xf39c12).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Speed builds up and fades out instead of switching on and off
    this.player.body.setDrag(DRAG, DRAG);
    this.player.body.setMaxSpeed(this.speed);

    this.playerSprite = new PersonSprite(this, 'player', this.player.x, this.player.y + 16);
    this.syncPlayerSprite();
    this.crowd.add({ image: this.playerSprite.image }); // so everyone else steers round the player

    this.solids.forEach(solid => this.physics.add.collider(this.player, solid));
    this.physics.add.collider(this.player, this.movers);
  },

  // Puts the drawing so its feet sit at the bottom of the invisible block
  syncPlayerSprite() {
    const feetY = this.player.y + 16;
    this.playerSprite.place(this.player.x, feetY);
  },

  setupCamera() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  },

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.keyE = this.input.keyboard.addKey('E');
    this.keyEnter = this.input.keyboard.addKey('ENTER');
    this.keySpace = this.input.keyboard.addKey('SPACE');

    // Tapping the Takings report carries on, for phones and tablets
    this.input.on('pointerdown', () => {
      if (this.dayOver && !this.cutscene && !this.modalOpen && this.report && this.report.visible) {
        this.reportTapped = true;
      }
    });
  },

  handleMovement() {
    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;

    // Pushing a direction speeds the player up. Letting go lets drag slow them down.
    // The joystick takes over while it is held, and how far it is pushed sets how fast to go
    if (Math.hypot(touch.x, touch.y) > 0.2) {
      x = touch.x;
      y = touch.y;
    }

    const push = new Phaser.Math.Vector2(x, y);
    const strength = Math.min(1, push.length());
    push.normalize().scale(ACCEL);
    this.player.body.setAcceleration(push.x, push.y);
    this.player.body.setMaxSpeed(strength > 0 ? Math.max(70, this.speed * strength) : this.speed);
  },

  // Turns to face the way the player is heading and walks at the matching pace
  animatePlayer(delta) {
    const body = this.player.body;
    const moving = Math.min(1, body.speed / this.speed);

    let facing = null; // standing still keeps the last direction
    if (body.speed > 25) {
      const { x, y } = body.velocity;
      if (Math.abs(x) >= Math.abs(y)) facing = x > 0 ? 'right' : 'left';
      else facing = y > 0 ? 'down' : 'up';
    }

    this.playerSprite.animate(delta, moving, facing);

    // A soft footstep each time a foot lands
    const pose = this.playerSprite.pose;
    if (pose !== this.lastPose) {
      if (pose === 'walk0' || pose === 'walk2') play('step');
      this.lastPose = pose;
    }
  },
};
