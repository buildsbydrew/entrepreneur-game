import { state, initState, buy, sell, recordLostCustomer } from '../state.js';
import Customer from '../entities/Customer.js';

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
    this.createCustomerArea();
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
      label: () => this.stallLabel(),
      use: () => this.useStall()
    });
  }

  // Spots in front of the stall where customers wait, plus the spawn timer
  createCustomerArea() {
    this.customers = [];
    this.spawnTimer = 0;

    const slotY = this.stall.y + 110;
    this.slots = [-80, 0, 80].map(offset => ({
      x: this.stall.x + offset,
      y: slotY,
      customer: null
    }));

    // Faint marks on the ground so players can see where customers stand
    this.slots.forEach(slot => {
      this.add.ellipse(slot.x, slot.y + 14, 50, 16, 0x000000, 0.15);
    });

    // Customers announce when they give up waiting
    this.events.on('customer-lost', this.onCustomerLost, this);
  }

  createSupplier() {
    const startX = 700;
    const y = 480;
    const spacing = 160;

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

    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 32, 32, 0xf39c12).setDepth(5);
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
    this.statsText = this.add.text(16, 128, '', boxStyle).setScrollFactor(0).setDepth(100);
    this.updateHud();
  }

  // ---------- Each frame ----------

  update(time, delta) {
    this.handleMovement();
    this.handleInteraction();
    this.handleCustomers(delta);
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

  handleCustomers(delta) {
    // New customers only show up while the stall is open
    if (this.stallOpen) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnCustomer();
        this.resetSpawnTimer();
      }
    }

    this.customers.forEach(customer => customer.update(delta));
    this.customers = this.customers.filter(customer => !customer.gone);
  }

  // ---------- Customers ----------

  spawnCustomer() {
    const slot = this.slots.find(s => !s.customer);
    if (!slot) return; // every spot is taken, so this shopper walks on by

    const item = this.pickWantedItem();
    const customer = new Customer(
      this,
      item,
      slot,
      this.stall.x + 700,
      this.setting.customers.patienceMs
    );

    slot.customer = customer;
    this.customers.push(customer);
  }

  resetSpawnTimer() {
    const { spawnMinMs, spawnMaxMs } = this.setting.customers;
    this.spawnTimer = Phaser.Math.Between(spawnMinMs, spawnMaxMs);
  }

  // Picks an item at random, but popular items come up more often
  pickWantedItem() {
    const items = this.setting.items;
    const total = items.reduce((sum, item) => sum + item.demand, 0);
    let roll = Math.random() * total;

    for (const item of items) {
      roll -= item.demand;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  waitingCustomers() {
    return this.customers.filter(customer => customer.state === 'waiting');
  }

  onCustomerLost(customer) {
    recordLostCustomer();
    this.floatText('Customer left', '#ff6b6b', customer.body.x, customer.body.y - 70);
    this.updateHud();
  }

  // ---------- The stall ----------

  // One key does three jobs depending on what's happening at the stall
  stallLabel() {
    if (!this.stallOpen) return 'Open stall';
    return this.waitingCustomers().length > 0 ? 'Serve customer' : 'Close stall';
  }

  useStall() {
    if (!this.stallOpen) {
      this.setStallOpen(true);
    } else if (this.waitingCustomers().length > 0) {
      this.serveCustomer();
    } else {
      this.setStallOpen(false);
    }
  }

  setStallOpen(isOpen) {
    this.stallOpen = isOpen;

    if (isOpen) {
      this.stall.setFillStyle(0xe67e22);
      this.stallSign.setText('OPEN');
      this.stallSign.setBackgroundColor('#27ae60');
      this.spawnTimer = 1500; // first customer arrives soon after opening
    } else {
      this.stall.setFillStyle(0x8d5524);
      this.stallSign.setText('CLOSED');
      this.stallSign.setBackgroundColor('#c0392b');

      // Anyone still walking up turns around
      this.customers
        .filter(customer => customer.state === 'walking')
        .forEach(customer => customer.leave('neutral'));
    }
  }

  // Serves the customer who has waited longest, among those we have stock for
  serveCustomer() {
    const symbol = this.setting.currencySymbol;

    const customer = this.waitingCustomers()
      .filter(c => state.stock[c.item.id] > 0)
      .sort((a, b) => a.patience - b.patience)[0];

    if (!customer) {
      this.floatText('Out of stock', '#ff6b6b');
      this.cameras.main.shake(120, 0.004);
      return;
    }

    sell(customer.item);
    customer.leave('happy');
    this.floatText(`+${symbol}${customer.item.sellPrice}`, '#7CFC98');
    this.updateHud();
  }

  // ---------- Supplier ----------

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

  // ---------- Feedback ----------

  // Small message that rises and fades out. Defaults to above the player.
  floatText(message, color, x = this.player.x, y = this.player.y - 70) {
    const text = this.add.text(x, y, message, {
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

    this.statsText.setText(`Served: ${state.stats.served}   Lost: ${state.stats.lost}`);
  }
}