import {
  state, initState, startNextDay, buy, sell, recordLostCustomer,
  endOfDayAging, expiringTonight, stockValue
} from '../state.js';
import Customer from '../entities/Customer.js';
import PersonSprite from '../entities/PersonSprite.js';
import { CUSTOMER_KEYS } from '../art/textures.js';
import { profile } from '../profile.js';
import { showPauseButton, hidePauseButton } from '../ui/screens.js';

const WORLD_W = 2400;
const WORLD_H = 1400;
const INTERACT_RANGE = 110;
const REPORT_W = 480;
const REPORT_H = 470;
const PERSON_W = 72;
const PERSON_H = 108;
const STALL_SCALE = 1.1;
const ACCEL = 1500; // how quickly the player picks up speed
const DRAG = 1300;  // how quickly the player slows down when you let go

// Things in the world sort by their position on the ground (their y value),
// so anything lower on screen draws in front. Interface layers sit above all of it.
const DEPTH = {
  ground: -1000,
  mat: -500,
  marks: -400,
  prompt: 3000,
  floatText: 3500,
  hud: 5000,
  report: 6000
};

export default class MarketScene extends Phaser.Scene {
  constructor() {
    super('MarketScene');
  }

  create() {
    this.setting = this.cache.json.get('setting');
    initState(this.setting);

    this.interactables = []; // things the player can press E on
    this.solids = [];        // things the player can't walk through
    this.speed = 180;

    this.dayOver = false;
    this.outOfBusiness = false;
    this.report = null;
    this.lastClock = '';
    this.dayTimeLeft = this.setting.day.lengthMs;

    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'dirt').setOrigin(0).setDepth(DEPTH.ground);

    this.createStall();
    this.createCustomerArea();
    this.createSupplier();
    this.createProps();
    this.createPlayer();
    this.setupCamera();
    this.setupControls();
    this.createPrompt();
    this.createHud();
    this.setupPause();
  }

  // ---------- Building the world ----------

  createStall() {
    this.stallOpen = false;

    const x = WORLD_W / 2 + 250;
    const y = WORLD_H / 2 - 120;
    const baseY = y + 55; // where the stall meets the ground

    // An invisible block the player bumps into. The art is drawn on top of it.
    this.stall = this.add.rectangle(x, y, 200, 110, 0x8d5524).setVisible(false);
    this.physics.add.existing(this.stall, true);
    this.solids.push(this.stall);

    this.stallArt = this.add.image(x, baseY - 176 * STALL_SCALE, 'stall-closed')
      .setOrigin(0.5, 0)
      .setDepth(baseY);
    this.fitStallArt();
    this.createStallSign(x, baseY);

    this.interactables.push({
      x: this.stall.x,
      y: this.stall.y,
      label: () => this.stallLabel(),
      use: () => this.useStall()
    });
  }

  // Wooden sign above the awning, carrying the name the player chose
  createStallSign(x, baseY) {
    const label = this.add.text(0, 0, profile.stallName, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fff4dc'
    }).setOrigin(0.5);
    if (label.width > 220) label.setScale(220 / label.width); // long names shrink to fit

    const w = label.displayWidth + 36;
    const h = 36;
    const board = this.add.graphics();
    board.fillStyle(0x8d5524, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    board.lineStyle(3, 0x3b2a20, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    board.lineBetween(-w / 2 + 18, h / 2, -w / 2 + 18, h / 2 + 8);
    board.lineBetween(w / 2 - 18, h / 2, w / 2 - 18, h / 2 + 8);

    // Sits just above the awning's roof
    const y = this.stallArt.y + 16 * STALL_SCALE - h / 2 - 8;
    this.stallSign = this.add.container(x, y, [board, label]).setDepth(baseY + 1);
  }

  // Esc or P, or the on-screen button, freezes the market and opens the pause menu
  setupPause() {
    this.resumedAt = 0;
    const requestPause = () => this.openPause();

    this.input.keyboard.on('keyup-ESC', requestPause);
    this.input.keyboard.on('keyup-P', requestPause);
    showPauseButton(requestPause);

    this.hideButton = () => hidePauseButton();
    this.showButton = () => {
      this.resumedAt = performance.now();
      showPauseButton(requestPause);
    };
    this.events.on('pause', this.hideButton);
    this.events.on('resume', this.showButton);

    // Tidy up when this scene ends, so a new game starts clean
    this.events.once('shutdown', () => {
      hidePauseButton();
      this.events.off('pause', this.hideButton);
      this.events.off('resume', this.showButton);
      this.events.off('customer-lost', this.onCustomerLost, this);
      this.input.keyboard.clearCaptures();
    });
  }

  openPause() {
    // The short wait stops the key that closed the menu from opening it again
    if (this.scene.isPaused() || performance.now() - this.resumedAt < 300) return;

    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  fitStallArt() {
    this.stallArt.setDisplaySize(220 * STALL_SCALE, 190 * STALL_SCALE);
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
      this.add.ellipse(slot.x, slot.y + 20, 56, 16, 0x000000, 0.12).setDepth(DEPTH.marks);
    });

    // Customers announce when they give up waiting
    this.events.on('customer-lost', this.onCustomerLost, this);
  }

  createSupplier() {
    const startX = 700;
    const y = 480;
    const spacing = 160;
    const symbol = this.setting.currencySymbol;

    this.add.rectangle(startX + spacing, y, 560, 160, 0x6b5a45)
      .setStrokeStyle(3, 0x3b2a20)
      .setDepth(DEPTH.mat);

    this.add.text(startX + spacing, y - 92, 'SUPPLIER', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#3b2a20'
    }).setOrigin(0.5).setDepth(DEPTH.mat + 1);

    this.setting.items.forEach((item, i) => {
      const x = startX + i * spacing;

      // Invisible block for bumping into, with the crate and goods drawn on top
      const hitbox = this.add.rectangle(x, y, 90, 70, 0x000000).setVisible(false);
      this.physics.add.existing(hitbox, true);
      this.solids.push(hitbox);

      this.add.image(x, y, 'crate').setDisplaySize(90, 70).setDepth(y + 35);
      this.add.image(x, y - 35, `icon-${item.id}`).setDisplaySize(44, 44).setDepth(y + 36);

      // The goods show what each crate is, so only the price and shelf life need words
      this.add.image(x, y + 10, 'price-tag').setDisplaySize(60, 26).setDepth(y + 37);
      this.add.text(x, y + 10, `${symbol}${item.buyPrice}`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#3b2a20'
      }).setOrigin(0.5).setDepth(y + 38);
      this.add.text(x, y + 44, this.shelfLabel(item), {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff4dc',
        stroke: '#3b2a20',
        strokeThickness: 3
      }).setOrigin(0.5, 0).setDepth(y + 37);

      this.interactables.push({
        x,
        y,
        label: () => `Buy ${item.name} (${symbol}${item.buyPrice})`,
        use: () => this.buyItem(item)
      });
    });
  }

  // How long an item lasts, as shown on its crate
  shelfLabel(item) {
    if (!item.shelfLifeDays) return 'Keeps';
    return item.shelfLifeDays === 1 ? 'Lasts 1 day' : `Lasts ${item.shelfLifeDays} days`;
  }

  // Decoration only, to make the market feel lived in
  createProps() {
    [[900, 820], [1750, 900], [520, 260]].forEach(([x, y]) => {
      this.add.image(x, y, 'umbrella')
        .setOrigin(0.5, 1)
        .setDisplaySize(100, 125)
        .setDepth(y);
    });
  }

  createPlayer() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // The invisible block is what moves and collides. The drawing follows it.
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 32, 32, 0xf39c12).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Speed builds up and fades out instead of switching on and off
    this.player.body.setDrag(DRAG, DRAG);
    this.player.body.setMaxSpeed(this.speed);

    this.playerSprite = new PersonSprite(this, 'player', this.player.x, this.player.y + 16);
    this.syncPlayerSprite();

    this.solids.forEach(solid => this.physics.add.collider(this.player, solid));
  }

  // Puts the drawing so its feet sit at the bottom of the invisible block
  syncPlayerSprite() {
    const feetY = this.player.y + 16;
    this.playerSprite.place(this.player.x, feetY);
  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.keyE = this.input.keyboard.addKey('E');
    this.keyEnter = this.input.keyboard.addKey('ENTER');
    this.keySpace = this.input.keyboard.addKey('SPACE');
  }

  createPrompt() {
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setVisible(false).setDepth(DEPTH.prompt);
  }

  createHud() {
    const boxStyle = {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    };

    this.add.text(16, 16, 'WASD or arrows to move, E to interact, Esc to pause', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#3b2a20'
    }).setScrollFactor(0).setDepth(DEPTH.hud);

    this.cashText = this.add.text(16, 44, '', boxStyle).setScrollFactor(0).setDepth(DEPTH.hud);
    this.stockText = this.add.text(16, 86, '', boxStyle).setScrollFactor(0).setDepth(DEPTH.hud);
    this.statsText = this.add.text(16, 128, '', boxStyle).setScrollFactor(0).setDepth(DEPTH.hud);

    // Day and clock sit in the top-right corner
    this.clockText = this.add.text(0, 16, '', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 12, y: 6 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);

    this.updateHud();
    this.updateClock();
  }

  // ---------- Each frame ----------

  update(time, delta) {
    this.clockText.setPosition(this.scale.width - 16, 16);
    this.layoutReport();
    this.syncPlayerSprite();

    // While the report is showing, the market is frozen and we only wait for Enter
    if (this.dayOver) {
      this.playerSprite.animate(delta, 0, null);
      this.handleReportInput();
      return;
    }

    this.handleMovement();
    this.animatePlayer(delta);
    this.handleInteraction();
    this.handleCustomers(delta);
    this.handleClock(delta);
  }

  handleMovement() {
    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;

    // Pushing a direction speeds the player up. Letting go lets drag slow them down.
    const push = new Phaser.Math.Vector2(x, y).normalize().scale(ACCEL);
    this.player.body.setAcceleration(push.x, push.y);
  }

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
  }

  handleInteraction() {
    const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE);
    const target = this.findNearestInteractable();

    if (!target) {
      this.prompt.setVisible(false);
      return;
    }

    this.prompt.setText(`E: ${target.label()}`);
    this.prompt.setPosition(this.player.x, this.player.y - 112);
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

  // ---------- The day ----------

  handleClock(delta) {
    this.dayTimeLeft -= delta;

    if (this.dayTimeLeft <= 0) {
      this.dayTimeLeft = 0;
      this.updateClock();
      this.endDay();
      return;
    }

    this.updateClock();
  }

  // Turns the time left into a clock reading like "2:35 PM"
  formatClock() {
    const { lengthMs, startHour, endHour } = this.setting.day;
    const progress = 1 - this.dayTimeLeft / lengthMs;
    const totalMinutes = Math.floor((startHour + progress * (endHour - startHour)) * 60);

    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = ((hours24 + 11) % 12) + 1;

    return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }

  updateClock() {
    const text = `Day ${state.day}   ${this.formatClock()}`;
    if (text === this.lastClock) return;

    this.lastClock = text;
    this.clockText.setText(text);

    // Turns red during the last stretch of the day
    const almostClosing = this.dayTimeLeft < this.setting.day.lengthMs * 0.15;
    this.clockText.setColor(almostClosing ? '#ff6b6b' : '#ffffff');
  }

  endDay() {
    this.dayOver = true;
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.prompt.setVisible(false);

    // Everyone still at the stall goes home
    this.customers.forEach(customer => customer.destroy());
    this.customers = [];
    this.slots.forEach(slot => {
      slot.customer = null;
    });
    this.setStallOpen(false);

    // Overnight, stock gets older and some of it goes bad
    endOfDayAging(this.setting);

    // Out of business means no stock and not enough cash for even the cheapest item
    const cheapest = Math.min(...this.setting.items.map(item => item.buyPrice));
    const hasStock = Object.values(state.stock).some(count => count > 0);
    this.outOfBusiness = state.cash < cheapest && !hasStock;

    this.showReport();
  }

  showReport() {
    const symbol = this.setting.currencySymbol;
    const today = state.today;

    const stockLeft = this.setting.items
      .map(item => `${item.name} ${state.stock[item.id]}`)
      .join('   ');

    const spoiledParts = this.setting.items
      .filter(item => today.spoiled[item.id] > 0)
      .map(item => `${item.name} ${today.spoiled[item.id]}`);

    const spoiledLine = spoiledParts.length > 0
      ? `Spoiled:  ${spoiledParts.join('   ')}  (-${symbol}${today.spoiledCost})`
      : 'Spoiled:  nothing';

    const lines = [
      `Customers served:  ${today.served}`,
      `Customers lost:  ${today.lost}`,
      `Sales:  ${symbol}${today.revenue}`,
      `Spent on stock:  ${symbol}${today.spent}`,
      spoiledLine,
      `Cash:  ${symbol}${today.startCash}  →  ${symbol}${state.cash}`,
      `Stock left:  ${stockLeft}`,
      `Stock value (at cost):  ${symbol}${stockValue(this.setting)}`
    ];

    let title = `TAKINGS: DAY ${state.day}`;
    let hint = `Press Enter to start Day ${state.day + 1}`;

    if (this.outOfBusiness) {
      title = 'OUT OF BUSINESS';
      lines.push('', "You can't afford any more stock.");
      hint = 'Press Enter to start over';
    }

    const dim = this.add.rectangle(0, 0, 6000, 6000, 0x000000, 0.65);
    const panel = this.add.rectangle(0, 0, REPORT_W, REPORT_H, 0x1f2a30).setStrokeStyle(3, 0xf39c12);

    const titleText = this.add.text(0, -REPORT_H / 2 + 38, title, {
      fontFamily: 'sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#f39c12'
    }).setOrigin(0.5);

    const bodyText = this.add.text(0, 0, lines.join('\n'), {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      lineSpacing: 10
    }).setOrigin(0.5);

    const hintText = this.add.text(0, REPORT_H / 2 - 34, hint, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#c8d1d6'
    }).setOrigin(0.5);

    const subText = this.add.text(0, -REPORT_H / 2 + 68, profile.stallName, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#c8d1d6'
    }).setOrigin(0.5);

    this.report = this.add.container(0, 0, [dim, panel, titleText, subText, bodyText, hintText])
      .setScrollFactor(0)
      .setDepth(DEPTH.report);

    this.layoutReport();
  }

  // Keeps the report centered and sized to fit, even on small screens
  layoutReport() {
    if (!this.report) return;

    const w = this.scale.width;
    const h = this.scale.height;
    const fit = Math.min(1, w / (REPORT_W + 40), h / (REPORT_H + 40));

    this.report.setPosition(w / 2, h / 2).setScale(fit);
  }

  handleReportInput() {
    const pressedEnter = Phaser.Input.Keyboard.JustDown(this.keyEnter);
    const pressedSpace = Phaser.Input.Keyboard.JustDown(this.keySpace);

    if (pressedEnter || pressedSpace) {
      this.beginNewDay();
    }
  }

  beginNewDay() {
    if (this.outOfBusiness) {
      initState(this.setting);
    } else {
      startNextDay();
    }

    this.report.destroy();
    this.report = null;
    this.outOfBusiness = false;
    this.dayOver = false;
    this.dayTimeLeft = this.setting.day.lengthMs;
    this.lastClock = '';

    // Back to the starting spot for the morning
    this.player.body.reset(WORLD_W / 2, WORLD_H / 2);

    this.updateHud();
    this.updateClock();
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
      this.setting.customers.patienceMs,
      this.pickCustomerLook()
    );

    slot.customer = customer;
    this.customers.push(customer);
  }

  // Picks a look that nobody at the stall is already wearing
  pickCustomerLook() {
    const used = new Set(this.customers.map(customer => customer.textureKey));
    const free = CUSTOMER_KEYS.filter(key => !used.has(key));
    return Phaser.Utils.Array.GetRandom(free.length > 0 ? free : CUSTOMER_KEYS);
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
    this.floatText('Customer left', '#ff6b6b', customer.body.x, customer.body.y - 175);
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
      this.stallArt.setTexture('stall-open');
      this.spawnTimer = 1500; // first customer arrives soon after opening
    } else {
      this.stallArt.setTexture('stall-closed');

      // Anyone still walking up turns around
      this.customers
        .filter(customer => customer.state === 'walking')
        .forEach(customer => customer.leave('neutral'));
    }

    this.fitStallArt();
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

  // Small message that rises and fades out. Defaults to above the player's head.
  floatText(message, color, x = this.player.x, y = this.player.y - 140) {
    const text = this.add.text(x, y, message, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color,
      stroke: '#3b2a20',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(DEPTH.floatText);

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

    // Items that will go bad tonight get a warning next to them
    const stock = this.setting.items
      .map(item => {
        const expiring = expiringTonight(item);
        const warning = expiring > 0 ? ` (${expiring} spoil tonight)` : '';
        return `${item.name} ${state.stock[item.id]}${warning}`;
      })
      .join('   ');
    this.stockText.setText(`Stock: ${stock}`);

    this.statsText.setText(`Served: ${state.today.served}   Lost: ${state.today.lost}`);
  }
}
