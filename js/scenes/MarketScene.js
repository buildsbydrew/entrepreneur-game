import { state, initState, buy } from '../state.js';

const WORLD_W = 2400;
const WORLD_H = 1400;
const INTERACT_RANGE = 110;

export default class MarketScene extends Phaser.Scene {
  constructor() {
    super('MarketScene');
  }

  preload() {
    this.load.json('setting', 'data/settings/ghana.json');
  }

  create() {
    this.setting = this.cache.json.get('setting');
    initState(this.setting);

    this.interactables = []; // things the player can press E on
    this.solids = [];        // things the player can't walk through
    this.speed = 180;

    // Ground grid (placeholder, real ground art comes later)
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x3a7d44, 1, 0x347239, 1);

    this.createStall();
    this.createSupplier();
    this.createPlayer();
    this.setupCamera();
    this.setupControls();
    this.createPrompt();
    this.createHud();
  }

  // ---------- Building the world ----------

  createStall() {
    this.stallOpen = false;

    this.stall = this.add.rectangle(WORLD_W / 2 + 250, WORLD_H / 2 - 120, 180, 110, 0x8d5524);
    this.physics.add.existing(this.stall, true);
    this.solids.push(this.stall);

    this.stallSign = this.add.text(this.stall.x, this.stall.y - 80, 'CLOSED', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#c0392b',
      padding: { x: 10, y: 4 }
    }).setOrigin(0.5);

    this.interactables.push({
      x: this.stall.x,
      y: this.stall.y,
      label: () => (this.stallOpen ? 'Close stall' : 'Open stall'),
      use: () => this.toggleStall()
    });
  }

  createSupplier() {
    const startX = 700;
    const y = 480;
    const spacing = 160;

    // Mat on the ground behind the crates
    this.add.rectangle(startX + spacing, y, 560, 160, 0x6b5a45);
    this.add.text(startX + spacing, y - 110, 'SUPPLIER', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.setting.items.forEach((item, i) => {
      const x = startX + i * spacing;
      const color = Phaser.Display.Color.HexStringToColor(item.color).color;

      const crate = this.add.rectangle(x, y, 90, 70, color);
      this.physics.add.existing(crate, true);
      this.solids.push(crate);

      this.add.text(x, y - 42, `${item.name}\n${this.setting.currencySymbol}${item.buyPrice}`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5, 1);

      this.interactables.push({
        x,
        y,
        label: () => `Buy ${item.name} (${this.setting.currencySymbol}${item.buyPrice})`,
        use: () => this.buyItem(item)
      });
    });
  }

  createPlayer() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 32, 32, 0xf39c12);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    this.solids.forEach(solid => this.physics.add.collider(this.player, solid));
  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.keyE = this.input.keyboard.addKey('E');
  }

  createPrompt() {
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setVisible(false).setDepth(50);
  }

  createHud() {
    const boxStyle = {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    };

    this.add.text(16, 16, 'WASD or arrows to move, E to interact', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(100);

    this.cashText = this.add.text(16, 44, '', boxStyle).setScrollFactor(0).setDepth(100);
    this.stockText = this.add.text(16, 86, '', boxStyle).setScrollFactor(0).setDepth(100);
    this.updateHud();
  }

  // ---------- Each frame ----------

  update() {
    this.handleMovement();
    this.handleInteraction();
  }

  handleMovement() {
    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;

    this.player.body.setVelocity(x, y);
    this.player.body.velocity.normalize().scale(this.speed);
  }

  handleInteraction() {
    // Check the key every frame so a press far from anything doesn't get "saved up"
    const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE);
    const target = this.findNearestInteractable();

    if (!target) {
      this.prompt.setVisible(false);
      return;
    }

    this.prompt.setText(`E: ${target.label()}`);
    this.prompt.setPosition(this.player.x, this.player.y - 40);
    this.prompt.setVisible(true);

    if (pressedE) target.use();
  }

  findNearestInteractable() {
    let nearest = null;
    let nearestDistance = INTERACT_RANGE;

    this.interactables.forEach(thing => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, thing.x, thing.y);
      if (d < nearestDistance) {
        nearest = thing;
        nearestDistance = d;
      }
    });

    return nearest;
  }

  // ---------- Actions ----------

  buyItem(item) {
    const symbol = this.setting.currencySymbol;

    if (buy(item)) {
      this.floatText(`-${symbol}${item.buyPrice}`, '#ffd166');
      this.updateHud();
    } else {
      this.floatText('Not enough cash', '#ff6b6b');
      this.cameras.main.shake(120, 0.004);
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

  // Small message that rises above the player and fades out
  floatText(message, color) {
    const text = this.add.text(this.player.x, this.player.y - 70, message, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color
    }).setOrigin(0.5).setDepth(60);

    this.tweens.add({
      targets: text,
      y: text.y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => text.destroy()
    });
  }

  updateHud() {
    const symbol = this.setting.currencySymbol;
    this.cashText.setText(`Cash: ${symbol}${state.cash}`);

    const stock = this.setting.items
      .map(item => `${item.name} ${state.stock[item.id]}`)
      .join('   ');
    this.stockText.setText(`Stock: ${stock}`);
  }
}