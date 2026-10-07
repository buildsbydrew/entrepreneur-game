export default class MarketScene extends Phaser.Scene {
  constructor() {
    super('MarketScene');
  }

  create() {
    // Placeholder player: an orange square (real art comes later)
    this.player = this.add.rectangle(400, 225, 32, 32, 0xf39c12);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Keyboard input: arrow keys plus WASD
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    this.speed = 180;

    this.add.text(16, 16, 'WASD or arrow keys to move', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff'
    });
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