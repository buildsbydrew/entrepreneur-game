export default class MarketScene extends Phaser.Scene {
  constructor() {
    super('MarketScene');
  }

  create() {
    const WORLD_W = 2400;
    const WORLD_H = 1400;

    // Ground grid (real ground art comes later)
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x3a7d44, 1, 0x347239, 1);

    // The stall: a brown block. The "true" makes it static, so it never moves
    this.stall = this.add.rectangle(WORLD_W / 2 + 250, WORLD_H / 2 - 120, 180, 110, 0x8d5524);
    this.physics.add.existing(this.stall, true);
    this.stallOpen = false;

    // Sign above the stall
    this.stallSign = this.add.text(this.stall.x, this.stall.y - 80, 'CLOSED', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#c0392b',
      padding: { x: 10, y: 4 }
    }).setOrigin(0.5);

    // Placeholder player: an orange square
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 32, 32, 0xf39c12);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Stops the player walking through the stall
    this.physics.add.collider(this.player, this.stall);

    // World and camera limits
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Controls: arrow keys, WASD, and E to interact
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.keyE = this.input.keyboard.addKey('E');

    this.speed = 180;

    // The "Press E" prompt, hidden until the player is close to the stall
    this.prompt = this.add.text(0, 0, 'Press E', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setVisible(false);

    // Text pinned to the screen
    this.add.text(16, 16, 'WASD or arrow keys to move', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff'
    }).setScrollFactor(0);
  }

  update() {
    this.handleMovement();
    this.handleStallInteraction();
  }

  handleMovement() {
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

  handleStallInteraction() {
    const distance = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.stall.x, this.stall.y
    );
    const nearStall = distance < 160;

    // Show the prompt above the player only when close enough
    this.prompt.setVisible(nearStall);
    this.prompt.setPosition(this.player.x, this.player.y - 40);

    // JustDown is true once per key press, not every frame while held
    if (nearStall && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.toggleStall();
    }
  }

  toggleStall() {
    this.stallOpen = !this.stallOpen;

    if (this.stallOpen) {
      this.stall.setFillStyle(0xe67e22);
      this.stallSign.setText('OPEN');
      this.stallSign.setBackgroundColor('#27ae60');
    } else {
      this.stall.setFillStyle(0x8d5524);
      this.stallSign.setText('CLOSED');
      this.stallSign.setBackgroundColor('#c0392b');
    }
  }
}