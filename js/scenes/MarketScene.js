export default class MarketScene extends Phaser.Scene {
  constructor() {
    super('MarketScene');
  }

  create() {
    // The world is bigger than the screen. The camera shows part of it.
    const WORLD_W = 2400;
    const WORLD_H = 1400;

    // A grid on the ground so you can see movement (real ground art comes later)
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x3a7d44, 1, 0x347239, 1);

    // Placeholder player: an orange square
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 32, 32, 0xf39c12);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Keep the player and camera inside the world
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Keyboard input: arrow keys plus WASD
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    this.speed = 180;

    // setScrollFactor(0) pins text to the screen instead of the world
    this.add.text(16, 16, 'WASD or arrow keys to move', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff'
    }).setScrollFactor(0);
  }

  update() {
    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;

    // Normalizing keeps diagonal movement from being faster
    this.player.body.setVelocity(x, y);
    this.player.body.velocity.normalize().scale(this.speed);
  }
}