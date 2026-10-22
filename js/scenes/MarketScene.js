import {
  state, initState, startNextDay, buy, sell, recordAsked, recordLostCustomer, unlockEntry, markBeatSeen, completeLevel,
  priceOf, setPrice, recordPricedOut, profitToday, advanceLevel,
  endOfDayAging, expiringTonight, stockValue
} from '../state.js';
import Customer from '../entities/Customer.js';
import PersonSprite from '../entities/PersonSprite.js';
import Walker from '../entities/Walker.js';
import { buildGraph, findPath, pathLength, pointOf } from '../entities/routes.js';
import { popShopBubble } from '../entities/shopBubble.js';
import { touch, showTouchControls, hideTouchControls, isTouchDevice } from '../ui/touch.js';
import { play, startMusic, startAmbience, stopAmbience } from '../audio/sound.js';
import Crowd from '../entities/crowd.js';
import Mover from '../entities/Mover.js';
import { CUSTOMER_KEYS } from '../art/textures.js';
import { profile } from '../profile.js';
import { showPauseButton, hidePauseButton, showDialogue, showNotebook, showLevelComplete, showPriceBoard } from '../ui/screens.js';
import { buildContext, renderLines, findDueBeat } from '../mentor.js';
import { checkMission, updateMissions, levelProgress, describeMission } from '../missions.js';

const WORLD_W = 2400;
const WORLD_H = 1400;
const INTERACT_RANGE = 110;
const REPORT_W = 480;
const REPORT_H = 590;
const PERSON_W = 72;
const PERSON_H = 108;
const STALL_SCALE = 1.1;
const ACCEL = 1500; // how quickly the player picks up speed
const DRAG = 1300;  // how quickly the player slows down when you let go
const MENTOR_SPEED = 95; // how fast Maame Gyasiwaa walks when she is on her way to talk to you
const MENTOR_ERRAND_SPEED = 65; // and when she goes shopping

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
    this.mentorData = this.cache.json.get('mentors');
    this.notebookData = this.cache.json.get('notebook');
    this.levelsData = this.cache.json.get('levels');
    this.ambientData = this.cache.json.get('ambient');
    this.graph = buildGraph(this.ambientData.graph.nodes, this.ambientData.graph.edges);
    initState(this.setting);

    this.interactables = []; // things the player can press E on
    this.solids = [];        // things the player can't walk through
    this.speed = 180;

    this.dayOver = false;
    this.outOfBusiness = false;
    this.modalOpen = false;   // true while a conversation or the Notebook is showing
    this.cutscene = false;    // true while the mentor walks over to talk
    this.useLabel = isTouchDevice() ? 'Use' : 'E';
    this.reportTapped = false; // the player tapped the Takings report
    this.levelUpPending = false; // every mission of the level is done
    this.bannerCount = 0;     // messages currently showing across the top
    this.pendingBeat = null;  // a conversation waiting for the end of the day
    this.report = null;
    this.lastClock = '';
    this.dayTimeLeft = this.setting.day.lengthMs;

    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'dirt').setOrigin(0).setDepth(DEPTH.ground);

    this.createStall();
    this.createCustomerArea();
    this.createSupplier();
    this.createProps();
    this.createMentor();
    this.createPriceBoard();
    this.createVendors();
    this.createWalkers();
    this.createShops();
    this.createPlayer();
    this.setupCamera();
    this.setupControls();
    this.createPrompt();
    this.createHud();
    this.createMissionPanel();
    this.createDusk();
    this.setupPause();
    this.startWelcome();
    startMusic();
    startAmbience();
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
    const roofY = this.stallArt.y + 16 * STALL_SCALE;
    this.stallSign = this.makeSign(x, roofY, profile.stallName).setDepth(baseY + 1);
  }

  // A wooden name board that hangs just above a stall's roof
  makeSign(x, roofY, name) {
    const label = this.add.text(0, 0, name, {
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

    return this.add.container(x, roofY - h / 2 - 8, [board, label]);
  }

  // Esc or P, or the on-screen button, freezes the market and opens the pause menu
  setupPause() {
    this.resumedAt = 0;
    const requestPause = () => this.openPause();
    const requestNotebook = () => this.openNotebook();
    this.input.keyboard.on('keyup-N', requestNotebook);

    this.input.keyboard.on('keyup-ESC', requestPause);
    this.input.keyboard.on('keyup-P', requestPause);
    showPauseButton(requestPause, requestNotebook);
    showTouchControls();

    this.hideButton = () => {
      hidePauseButton();
      hideTouchControls();
    };
    this.showButton = () => {
      this.resumedAt = performance.now();
      showPauseButton(requestPause, requestNotebook);
      showTouchControls();
    };
    this.events.on('pause', this.hideButton);
    this.events.on('resume', this.showButton);

    // Tidy up when this scene ends, so a new game starts clean
    this.events.once('shutdown', () => {
      hidePauseButton();
      hideTouchControls();
      stopAmbience();
      this.events.off('pause', this.hideButton);
      this.events.off('resume', this.showButton);
      this.events.off('customer-lost', this.onCustomerLost, this);
      this.events.off('customer-arrived', this.onCustomerArrived, this);
      this.input.keyboard.clearCaptures();
    });
  }

  openPause() {
    // The short wait stops the key that closed the menu from opening it again
    if (this.modalOpen || this.scene.isPaused() || performance.now() - this.resumedAt < 300) return;

    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  // ---------- The mentor and the Notebook ----------

  // Maame Gyasiwaa has her own stall across the market, and stands beside it
  createMentor() {
    const mentor = this.mentorData.mentor;
    const stallX = 1000;
    const stallY = 870;
    const baseY = stallY + 50; // where her stall meets the ground
    const scale = 0.95;

    // An invisible block so the player can't walk through her stall
    const block = this.add.rectangle(stallX, stallY, 180, 100, 0x8d5524).setVisible(false);
    this.physics.add.existing(block, true);
    this.solids.push(block);

    const art = this.add.image(stallX, baseY - 176 * scale, 'mentor-stall')
      .setOrigin(0.5, 0)
      .setDisplaySize(220 * scale, 190 * scale)
      .setDepth(baseY);
    this.makeSign(stallX, art.y + 16 * scale, mentor.name).setDepth(baseY + 1);

    // Where she waits, and where she stands to talk to the player
    this.mentorHome = pointOf(this.graph, this.ambientData.mentor.homeNode);
    this.mentorMeet = { x: 1262, y: 600 };
    this.mentorTask = null;
    this.mentorErrand = false; // true while she is out shopping
    this.mentorErrandIn = Phaser.Math.Between(...this.ambientData.mentor.errandMs);

    this.mentorSprite = new PersonSprite(this, 'mentor', this.mentorHome.x, this.mentorHome.y);
    this.mentorBody = { image: this.mentorSprite.image };
    this.crowd.add(this.mentorBody);
    this.mentorMover = new Mover(this.crowd, this.mentorBody);
    this.mentorBlock = this.add.rectangle(this.mentorHome.x, this.mentorHome.y - 10, 46, 20, 0x000000).setVisible(false);
    this.movers.add(this.mentorBlock);
    this.mentorBlock.body.setImmovable(true);
    this.mentorLabel = this.add.text(this.mentorHome.x, this.mentorHome.y - 112, mentor.name, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#fff4dc',
      stroke: '#3b2a20',
      strokeThickness: 4
    }).setOrigin(0.5, 1).setDepth(this.mentorHome.y + 1);

    // The player can talk to her wherever she happens to be standing
    const body = this.mentorSprite.image;
    this.interactables.push({
      get x() { return body.x; },
      get y() { return body.y - 40; },
      label: () => {
        if (this.mentorErrand) return `${mentor.name} is out shopping`;
        return this.mentorTask ? `${mentor.name} is on her way` : `Talk to ${mentor.name}`;
      },
      use: () => this.talkToMentor()
    });
  }

  // Sends her walking along a list of points. options: speed, dwellMs (stand and shop at the end),
  // onDwellStart. onArrive runs when she is finished.
  walkMentorAlong(points, faceOnArrival, onArrive, options = {}) {
    this.mentorTask = {
      points,
      index: 0,
      faceOnArrival,
      onArrive,
      speed: options.speed ?? MENTOR_SPEED,
      dwellMs: options.dwellMs ?? 0,
      onDwellStart: options.onDwellStart,
      dwelling: false
    };
  }

  walkMentorTo(target, faceOnArrival, onArrive) {
    this.walkMentorAlong([{ x: target.x, y: target.y }], faceOnArrival, onArrive);
  }

  // Walks her along her path, or lets her stand and breathe
  updateMentor(delta) {
    const task = this.mentorTask;
    const sprite = this.mentorSprite;

    if (!task) {
      sprite.animate(delta, 0, null);
      this.updateMentorErrands(delta);
      return;
    }

    // Standing at a shop, looking at the goods
    if (task.dwelling) {
      task.dwellMs -= delta;
      sprite.animate(delta, 0, task.faceOnArrival);
      if (task.dwellMs <= 0) {
        this.mentorTask = null;
        if (task.onArrive) task.onArrive();
      }
      return;
    }

    const step = this.mentorMover.step(sprite.image, task.points[task.index], task.speed, delta);
    if (step.waiting) {
      sprite.animate(delta, 0, null); // someone is in the way, so she waits a moment
      return;
    }

    sprite.place(step.x, step.y);
    this.mentorLabel.setPosition(step.x, step.y - 112).setDepth(step.y + 1);
    this.mentorBlock.setPosition(step.x, step.y - 10);

    if (!step.arrived) {
      sprite.animate(delta, step.pace, step.facing);
      return;
    }

    task.index += 1;
    if (task.index < task.points.length) return; // more points to walk through

    if (task.dwellMs > 0) {
      task.dwelling = true;
      if (task.onDwellStart) task.onDwellStart();
      return;
    }

    this.mentorTask = null;
    sprite.animate(delta, 0, task.faceOnArrival);
    if (task.onArrive) task.onArrive();
  }

  // Every so often, when nothing else is going on, she goes shopping at another stall
  updateMentorErrands(delta) {
    if (this.cutscene || this.dayOver || this.modalOpen) return;

    this.mentorErrandIn -= delta;
    if (this.mentorErrandIn > 0) return;
    this.mentorErrandIn = Phaser.Math.Between(...this.ambientData.mentor.errandMs);

    const home = this.ambientData.mentor.homeNode;
    const shop = this.pickShop({ at: home, ownShop: this.mentorShop });
    const out = shop ? findPath(this.graph, home, shop.node) : null;
    if (!out) return;

    const pointsAlong = names => names.slice(1).map(name => pointOf(this.graph, name));
    shop.busy = true;
    this.mentorErrand = true;
    this.mentorErrandShop = shop;

    this.walkMentorAlong(pointsAlong(out), 'up', () => {
      shop.busy = false;
      this.walkMentorAlong(pointsAlong([...out].reverse()), 'down', () => {
        this.mentorErrand = false;
      }, { speed: MENTOR_ERRAND_SPEED });
    }, {
      speed: MENTOR_ERRAND_SPEED,
      dwellMs: 3500,
      onDwellStart: () => this.shopVisit(shop, this.mentorSprite.image)
    });
  }

  // Puts her back at her stall straight away, for when the day ends and she has something to say
  sendMentorHome() {
    if (this.mentorErrandShop) this.mentorErrandShop.busy = false;
    this.mentorTask = null;
    this.mentorMover.reset();
    this.mentorErrand = false;

    const home = this.mentorHome;
    this.mentorSprite.place(home.x, home.y);
    this.mentorLabel.setPosition(home.x, home.y - 112).setDepth(home.y + 1);
    this.mentorBlock.setPosition(home.x, home.y - 10);
  }

  // She is at her stall, and not busy
  mentorIsHome() {
    return !this.mentorErrand && !this.mentorTask && !this.cutscene;
  }

  // ---------- A lively market ----------

  // Other traders around the market. Each has a stall, and is a person who calls out to passers-by
  // and now and then leaves the stall to go shopping at another one.
  createVendors() {
    const scale = 0.95;

    this.vendors = this.ambientData.vendors.map((vendor, i) => {
      const baseY = vendor.y + 50; // where the stall meets the ground

      // An invisible block so the player can't walk through the stall
      const block = this.add.rectangle(vendor.x, vendor.y, 180, 100, 0x8d5524).setVisible(false);
      this.physics.add.existing(block, true);
      this.solids.push(block);

      const art = this.add.image(vendor.x, baseY - 176 * scale, `vendor-stall-${i}`)
        .setOrigin(0.5, 0)
        .setDisplaySize(220 * scale, 190 * scale)
        .setDepth(baseY);
      this.makeSign(vendor.x, art.y + 16 * scale, vendor.name).setDepth(baseY + 1);

      const walker = new Walker(this, `vendor-${i}`, {
        graph: this.graph,
        node: vendor.homeNode,
        speed: 70,
        pickShop: self => this.pickShop(self),
        onShop: shop => this.shopkeeperThanks(shop),
        errandMs: this.ambientData.vendorErrandMs,
        canLeave: () => !this.vendors.some(vendor => vendor.walker.onErrand)
      });

      return {
        walker,
        calls: vendor.calls,
        shopNode: vendor.shopNode,
        icons: [...new Set(vendor.goods)],
        nextCallIn: Phaser.Math.Between(2000, 9000)
      };
    });
  }

  // People strolling around the market on a loop, now and then stopping to shop
  createWalkers() {
    const { ring, people, speedMin, speedMax } = this.ambientData.walkers;

    this.walkers = people.map((person, i) => new Walker(this, `walker-${i}`, {
      graph: this.graph,
      node: person.start,
      ring,
      direction: person.direction,
      speed: Phaser.Math.Between(speedMin, speedMax),
      pickShop: self => this.pickShop(self),
      onShop: shop => this.shopkeeperThanks(shop)
    }));
  }

  // The places people can shop: the supplier and every stall except the player's.
  // A shop is only open while its owner is home, and one person shops at a time.
  createShops() {
    const { supplier, mentor } = this.ambientData;

    this.shops = [
      { id: 'supplier', node: supplier.node, icons: supplier.icons, busy: false, owner: null, ownerHome: () => true },
      { id: 'mentor', node: mentor.shopNode, icons: mentor.icons, busy: false, owner: 'mentor', ownerHome: () => this.mentorIsHome() },
      ...this.vendors.map((vendor, i) => ({
        id: `vendor-${i}`,
        node: vendor.shopNode,
        icons: vendor.icons,
        busy: false,
        owner: vendor,
        ownerHome: () => !vendor.walker.onErrand
      }))
    ];

    this.mentorShop = this.shops[1];
    this.vendors.forEach((vendor, i) => { vendor.walker.ownShop = this.shops[i + 2]; });
  }

  // Which shop should this person visit? One that is open and free, and not too far away.
  pickShop(person) {
    const options = this.shops
      .filter(shop => !shop.busy && shop.ownerHome() && shop !== person.ownShop)
      .map(shop => ({ shop, length: pathLength(this.graph, findPath(this.graph, person.at, shop.node)) }))
      .filter(option => Number.isFinite(option.length))
      .sort((a, b) => a.length - b.length)
      .slice(0, 2);

    return options.length > 0 ? Phaser.Utils.Array.GetRandom(options).shop : null;
  }

  // Someone started shopping, so the person who owns the stall thanks them
  shopkeeperThanks(shop) {
    const owner = shop.owner === 'mentor' ? this.mentorSprite.image : shop.owner?.walker.person.image;
    if (owner) this.sayAbove(owner.x, owner.y, 'Thank you!');
  }

  // The mentor reaches a shop, and the person who owns it thanks her
  shopVisit(shop, image) {
    const icons = shop.icons;
    popShopBubble(this, image.x, image.y, `icon-${icons[Math.floor(Math.random() * icons.length)]}`, 1800);
    this.shopkeeperThanks(shop);
  }

  // A few words above someone's head that fade after a moment
  sayAbove(x, feetY, message) {
    const text = this.add.text(x, feetY - 118, message, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#3b2a20',
      backgroundColor: '#fff4dc',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 1).setDepth(2100);

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => text.destroy()
    });
  }

  updateAmbient(delta) {
    this.walkers.forEach(walker => walker.update(delta));

    this.vendors.forEach(vendor => {
      vendor.walker.update(delta);

      // Traders call out to passers-by, unless they are away shopping
      vendor.nextCallIn -= delta;
      if (vendor.nextCallIn <= 0) {
        vendor.nextCallIn = Phaser.Math.Between(9000, 16000);
        if (!vendor.walker.onErrand) {
          const image = vendor.walker.person.image;
          this.sayAbove(image.x, image.y, Phaser.Utils.Array.GetRandom(vendor.calls));
        }
      }
    });
  }

  // Taps on the Use button are saved up until the next frame, then used once
  takeUseTap() {
    const tapped = touch.use;
    touch.use = false;
    return tapped;
  }

  // Smaller screens get a smaller interface, so it doesn't cover the market
  layoutHud() {
    const s = this.scale.height < 420 ? 0.6 : this.scale.height < 560 ? 0.72 : 1;
    const place = (item, x, y) => item.setScale(s).setPosition(x, y * s);

    place(this.hintText, 16, 16);
    place(this.cashText, 16, 44);
    place(this.stockText, 16, 86);
    place(this.statsText, 16, 128);
    place(this.missionText, 16, 178);
    place(this.clockText, this.scale.width - 16, 16);
  }

  // A warm glow over the market that grows toward closing time
  createDusk() {
    this.dusk = this.add.rectangle(0, 0, 6000, 6000, 0xff7a2f, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(4000);
  }

  updateDusk() {
    const progress = 1 - this.dayTimeLeft / this.setting.day.lengthMs;
    const amount = Math.min(1, Math.max(0, (progress - 0.6) / 0.4));
    this.dusk.setAlpha(0.22 * amount);
  }

  // ---------- Prices (Level 2) ----------

  // A price board beside the stall. It stays locked until Level 2.
  createPriceBoard() {
    const x = 1625;
    const feetY = 628;

    this.add.image(x, feetY, 'price-board')
      .setOrigin(0.5, 1)
      .setDisplaySize(64, 96)
      .setDepth(feetY);

    // An invisible block at the foot of the post, so the player can't walk through it
    const post = this.add.rectangle(x, feetY - 8, 26, 16, 0x000000).setVisible(false);
    this.physics.add.existing(post, true);
    this.solids.push(post);

    this.interactables.push({
      x,
      y: feetY - 40,
      label: () => (state.level >= 2 ? 'Set your prices' : 'Price board (opens in Level 2)'),
      use: () => this.openPriceBoard()
    });
  }

  openPriceBoard() {
    if (state.level < 2) return;

    play('page');
    this.openModal();
    showPriceBoard({
      items: this.setting.items,
      symbol: this.setting.currencySymbol,
      priceOf,
      history: item => {
        const record = day => ({ sold: day.soldBy[item.id] ?? 0, walked: day.pricedOut[item.id] ?? 0 });
        return { today: record(state.today), yesterday: state.lastDay ? record(state.lastDay) : null };
      },
      onSetPrice: (item, price) => {
        play('tick');
        setPrice(item, price);
        this.refreshMissions();
      },
      onClose: () => {
        this.closeModal();
        this.turnAwayOverpriced();
      }
    });
  }

  // Customers already at the stall look at the new prices. Anyone who finds them too high leaves.
  turnAwayOverpriced() {
    this.waitingCustomers().forEach(customer => {
      if (priceOf(customer.item) > customer.maxPrice) {
        recordPricedOut(customer.item);
        customer.leave('pricey');
      }
    });
    this.updateHud();
  }

  // Conversations that come at the start of a day, such as the mentor introducing a new level
  startDayBeat() {
    const beat = findDueBeat(this.mentorData.beats, 'dayStart', state, buildContext(state, this.setting));
    if (!beat) return;

    this.time.delayedCall(700, () => {
      this.playDialogue(renderLines(beat.lines), () => markBeatSeen(beat.id));
    });
  }

  // Her first words, shortly after the game begins
  startWelcome() {
    const beat = this.mentorData.beats.find(b => b.id === 'welcome');
    if (!beat || state.beatsSeen.includes(beat.id)) return;

    this.time.delayedCall(700, () => {
      this.playDialogue(renderLines(beat.lines), () => markBeatSeen(beat.id));
    });
  }

  // Pressing E beside her repeats the gist of what she last told you
  talkToMentor() {
    if (this.mentorTask || this.cutscene) return; // she is busy walking

    const chat = this.mentorData.mentor.chat;
    let lines = chat.beforeEvidence;
    if (state.beatsSeen.includes('pricing-evidence')) lines = chat.afterPricing;
    else if (state.level >= 2) lines = chat.duringPricing;
    else if (state.beatsSeen.includes('first-evidence')) lines = chat.afterEvidence;
    this.playDialogue(lines);
  }

  // Pressing Enter on the Takings report. If she has something to say, she walks over
  // from her stall while the camera follows her, talks, and then walks back.
  continueFromReport() {
    const beat = this.pendingBeat;
    this.pendingBeat = null;

    // The last step before the next morning is the level-complete screen, if a level was just finished
    const carryOn = () => {
      if (this.outOfBusiness) this.beginNewDay();
      else this.maybeShowLevelComplete(() => this.beginNewDay());
    };

    if (!beat || this.outOfBusiness) {
      carryOn();
      return;
    }

    const ctx = this.beatContext;
    this.cutscene = true;
    this.report.setVisible(false);
    this.sendMentorHome(); // if she was out shopping, she is back at her stall
    this.cameras.main.startFollow(this.mentorSprite.image, true, 0.08, 0.08);

    this.walkMentorTo(this.mentorMeet, 'right', () => {
      this.cutscene = false;

      this.playDialogue(renderLines(beat.lines, ctx), () => {
        markBeatSeen(beat.id);

        // The idea she talked about goes into the Notebook, with what happened at the stall
        let banner = null;
        const entries = [].concat(beat.unlocks ?? [])
          .map(id => this.notebookData.entries.find(e => e.id === id))
          .filter(Boolean);
        entries.forEach(entry => unlockEntry(entry.id, renderLines(entry.evidence, ctx).join(' ')));
        if (entries.length > 0) {
          banner = `Notebook updated: ${entries.map(e => e.term).join(' and ')}. Press N to read it.`;
        }

        this.refreshMissions();
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.walkMentorTo(this.mentorHome, 'down');
        carryOn();
        if (banner) this.showBanner(banner);
      });
    });
  }

  playDialogue(lines, onDone) {
    const mentor = this.mentorData.mentor;

    play('chime');
    this.openModal();
    if (this.report) this.report.setVisible(false);

    showDialogue({
      name: mentor.name,
      title: mentor.title,
      look: mentor.look,
      lines,
      onDone: () => {
        this.closeModal();
        if (onDone) onDone();
      }
    });
  }

  openNotebook() {
    if (this.modalOpen || this.scene.isPaused() || performance.now() - this.resumedAt < 300) return;

    play('page');
    this.openModal();
    showNotebook({
      entries: this.notebookData.entries,
      unlocked: state.notebook.unlocked,
      evidence: state.notebook.evidence,
      onClose: () => this.closeModal()
    });
  }

  // While a conversation or the Notebook is open, the market stands still
  openModal() {
    this.modalOpen = true;
    hideTouchControls();
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.prompt.setVisible(false);
  }

  closeModal() {
    this.modalOpen = false;
    showTouchControls();
    touch.use = false;
    this.resumedAt = performance.now();

    // Throw away key presses made during the conversation so they don't act afterwards
    [this.keyE, this.keyEnter, this.keySpace].forEach(key => Phaser.Input.Keyboard.JustDown(key));
  }

  // A short message across the top of the screen that fades away. Several can show at once.
  showBanner(message) {
    const slot = this.bannerCount;
    this.bannerCount += 1;

    const text = this.add.text(this.scale.width / 2, 24 + slot * 46, message, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#fff4dc',
      backgroundColor: '#3b2a20',
      padding: { x: 14, y: 8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud);

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 3800,
      duration: 700,
      onComplete: () => {
        text.destroy();
        this.bannerCount -= 1;
      }
    });
  }

  // ---------- Levels and missions ----------

  createMissionPanel() {
    this.missionText = this.add.text(16, 178, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 8 },
      lineSpacing: 6,
      wordWrap: { width: 300 }
    }).setScrollFactor(0).setDepth(DEPTH.hud);

    this.refreshMissions();
  }

  currentLevel() {
    const levels = this.levelsData.levels;
    return levels.find(level => level.id === state.level) ?? levels[0];
  }

  // Checks the goals against what has happened, announces any that were just finished,
  // and notes when a whole level is done. Pass true once the day has ended.
  refreshMissions(dayEnded = false) {
    const level = this.currentLevel();

    if (!state.levelsDone.includes(level.id)) {
      updateMissions(level, state, this.setting, { dayEnded })
        .forEach(mission => {
          play('mission');
          this.showBanner(`Mission complete: ${describeMission(mission, this.setting)}`);
        });

      if (levelProgress(level, state).complete) this.levelUpPending = true;
    }

    this.drawMissionPanel();
  }

  drawMissionPanel() {
    const level = this.currentLevel();
    const lines = [`LEVEL ${level.id}: ${level.name.toUpperCase()}`];

    if (state.levelsDone.includes(level.id)) {
      lines.push('\u2713 Level complete!');
      const next = this.levelsData.levels.find(l => l.id === level.id + 1);
      if (next) lines.push(`Next: ${next.name}${next.comingSoon ? ' (coming soon)' : ''}`);
    } else {
      level.missions.forEach(mission => {
        const done = state.missionsDone.includes(mission.id);
        const progress = checkMission(mission, state).progress;
        const note = !done && progress ? ` (${progress})` : '';
        lines.push(`${done ? '\u2713' : '\u25CB'} ${describeMission(mission, this.setting)}${note}`);
      });
    }

    this.missionText.setText(lines.join('\n'));
  }

  // Shows the level-complete screen if the last goal was just finished, then carries on
  maybeShowLevelComplete(then) {
    if (!this.levelUpPending) {
      then();
      return;
    }

    this.levelUpPending = false;
    const level = this.currentLevel();
    completeLevel(level.id);

    const next = this.levelsData.levels.find(l => l.id === level.id + 1);
    advanceLevel(this.levelsData.levels); // the next level opens, if there is one
    play('levelUp');
    this.openModal();
    if (this.report) this.report.setVisible(false);

    showLevelComplete({
      levelId: level.id,
      levelName: level.name,
      missions: level.missions.map(mission => describeMission(mission, this.setting)),
      nextName: next ? (next.comingSoon ? `${next.name} (coming soon)` : next.name) : null,
      onDone: () => {
        this.closeModal();
        this.drawMissionPanel();
        then();
      }
    });
  }

  // A customer reached the stall and is waiting. We record what they came for.
  onCustomerArrived(customer) {
    recordAsked(customer.item);
    play('arrive');

    // From Level 2 on, customers look at the price and walk away if it is too high
    if (state.level >= 2 && priceOf(customer.item) > customer.maxPrice) {
      recordPricedOut(customer.item);
      customer.leave('pricey');
    }
  }

  fitStallArt() {
    this.stallArt.setDisplaySize(220 * STALL_SCALE, 190 * STALL_SCALE);
  }

  // Spots in front of the stall where customers wait, plus the spawn timer
  createCustomerArea() {
    this.customers = [];
    this.spawnTimer = 0;

    // Everyone in the market, so people can keep out of each other's way
    this.crowd = new Crowd(this.solids);

    // Invisible blocks that follow people around, so the player can't walk through them
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });

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
    this.events.on('customer-arrived', this.onCustomerArrived, this);
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

  // Umbrellas to make the market feel lived in. Only the pole is solid, because the canopy is high above.
  createProps() {
    [[720, 830], [1750, 900], [480, 420]].forEach(([x, y]) => {
      this.add.image(x, y, 'umbrella')
        .setOrigin(0.5, 1)
        .setDisplaySize(100, 125)
        .setDepth(y);

      const pole = this.add.rectangle(x, y - 8, 22, 16, 0x000000).setVisible(false);
      this.physics.add.existing(pole, true);
      this.solids.push(pole);
    });
  }

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

    // Tapping the Takings report carries on, for phones and tablets
    this.input.on('pointerdown', () => {
      if (this.dayOver && !this.cutscene && !this.modalOpen && this.report && this.report.visible) {
        this.reportTapped = true;
      }
    });
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

    this.hintText = this.add.text(16, 16, isTouchDevice() ? 'Left stick to move, Use button to interact' : 'WASD or arrows to move, E to interact, N for Notebook, Esc to pause', {
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
    this.layoutHud();
    this.layoutReport();
    this.syncPlayerSprite();
    this.updateMentor(delta);

    // A conversation or the Notebook freezes the market until it closes
    if (this.modalOpen) {
      this.playerSprite.animate(delta, 0, null);
      return;
    }

    this.updateAmbient(delta);

    // While the report is showing, the market is frozen and we only wait for Enter
    if (this.dayOver) {
      this.playerSprite.animate(delta, 0, null);
      touch.use = false;
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

    // A soft footstep each time a foot lands
    const pose = this.playerSprite.pose;
    if (pose !== this.lastPose) {
      if (pose === 'walk0' || pose === 'walk2') play('step');
      this.lastPose = pose;
    }
  }

  handleInteraction() {
    const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE) || this.takeUseTap();
    const target = this.findNearestInteractable();

    if (!target) {
      this.prompt.setVisible(false);
      return;
    }

    this.prompt.setText(`${this.useLabel}: ${target.label()}`);
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
    this.updateDusk();

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
    play('bell');
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

    // Work out what happened at the stall, and whether the mentor has something to say
    this.beatContext = buildContext(state, this.setting);
    this.pendingBeat = this.outOfBusiness
      ? null
      : findDueBeat(this.mentorData.beats, 'dayEnd', state, this.beatContext);

    // Some goals can only be judged once the whole day is over
    this.refreshMissions(true);

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

    const askedLine = `Asked for:  ${this.setting.items.map(item => `${item.name} ${today.asked[item.id] ?? 0}`).join('   ')}`;
    const missedParts = this.setting.items
      .filter(item => (today.missedNoStock[item.id] ?? 0) > 0)
      .map(item => `${item.name} ${today.missedNoStock[item.id]}`);
    const missedLine = missedParts.length > 0 ? `Left with no stock:  ${missedParts.join('   ')}` : null;

    // From Level 2 the report also shows profit and who walked away over the price
    const pricedParts = this.setting.items
      .filter(item => (today.pricedOut[item.id] ?? 0) > 0)
      .map(item => `${item.name} ${today.pricedOut[item.id]}`);
    const pricingLines = state.level >= 2
      ? [`Profit:  ${symbol}${profitToday()}`, ...(pricedParts.length > 0 ? [`Walked away over price:  ${pricedParts.join('   ')}`] : [])]
      : [];

    const lines = [
      `Customers served:  ${today.served}`,
      `Customers lost:  ${today.lost}`,
      `Sales:  ${symbol}${today.revenue}`,
      `Spent on stock:  ${symbol}${today.spent}`,
      spoiledLine,
      `Cash:  ${symbol}${today.startCash}  →  ${symbol}${state.cash}`,
      `Stock left:  ${stockLeft}`,
      `Stock value (at cost):  ${symbol}${stockValue(this.setting)}`,
      askedLine,
      ...(missedLine ? [missedLine] : []),
      ...pricingLines
    ];

    let title = `TAKINGS: DAY ${state.day}`;
    const continueWord = isTouchDevice() ? 'Tap' : 'Press Enter';
    let hint = `${continueWord} to start Day ${state.day + 1}`;

    if (this.outOfBusiness) {
      title = 'OUT OF BUSINESS';
      lines.push('', "You can't afford any more stock.");
      hint = `${continueWord} to start over`;
    } else if (this.pendingBeat) {
      hint = `${continueWord}. ${this.mentorData.mentor.name} wants a word.`;
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
    if (this.cutscene) return; // the mentor is on her way
    const pressedEnter = Phaser.Input.Keyboard.JustDown(this.keyEnter);
    const pressedSpace = Phaser.Input.Keyboard.JustDown(this.keySpace);

    const tapped = this.reportTapped;
    this.reportTapped = false;

    if (pressedEnter || pressedSpace || tapped) {
      this.continueFromReport();
    }
  }

  beginNewDay() {
    if (this.outOfBusiness) {
      initState(this.setting);
      this.levelUpPending = false;
      this.startWelcome();
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

    play('morning');
    this.drawMissionPanel();
    this.updateDusk();
    this.startDayBeat();
    this.updateHud();
    this.updateClock();
  }

  // ---------- Customers ----------

  spawnCustomer() {
    const slot = this.slots.find(s => !s.customer);
    if (!slot) return; // every spot is taken, so this shopper walks on by

    // Nobody appears on top of someone who is still on the street there
    const startX = this.stall.x + 700;
    if (this.crowd.blocker(null, startX, slot.y + 70)) return;

    const item = this.pickWantedItem();
    const customer = new Customer(
      this,
      item,
      slot,
      startX,
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
    recordLostCustomer(customer.item, state.stock[customer.item.id] === 0);
    this.floatText('Customer left', '#ff6b6b', customer.body.x, customer.body.y - 175);
    this.updateHud();
    this.refreshMissions();
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
      play('open');
      this.spawnTimer = 1500; // first customer arrives soon after opening
    } else {
      this.stallArt.setTexture('stall-closed');
      play('close');

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
      play('error');
      this.cameras.main.shake(120, 0.004);
      return;
    }

    sell(customer.item);
    customer.leave('happy');
    this.floatText(`+${symbol}${priceOf(customer.item)}`, '#7CFC98');
    play('coin');
    this.updateHud();
    this.refreshMissions();
  }

  // ---------- Supplier ----------

  buyItem(item) {
    const symbol = this.setting.currencySymbol;

    if (buy(item)) {
      this.floatText(`-${symbol}${item.buyPrice}`, '#ffd166');
      play('buy');
      this.updateHud();
    } else {
      this.floatText('Not enough cash', '#ff6b6b');
      play('error');
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
