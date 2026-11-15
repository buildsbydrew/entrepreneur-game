// The market: where the stall is. The player walks here from home each morning.
// What it does is split into small files under world/ (shared by every place) and market/.
import WorldScene from './WorldScene.js';
import { buildGraph } from '../entities/routes.js';
import { touch, isTouchDevice } from '../ui/touch.js';
import { startMusic, startAmbience } from '../audio/sound.js';
import { WORLD_W, WORLD_H, DEPTH } from './constants.js';
import { VIEW_MARGIN } from './world/travel.js';
import { stallMethods } from './market/stall.js';
import { customersMethods } from './market/customers.js';
import { supplierMethods } from './market/supplier.js';
import { mentorMethods } from './market/mentor.js';
import { ambientMethods } from './market/ambient.js';
import { pricesMethods } from './market/prices.js';
import { dayMethods } from './market/day.js';

export default class MarketScene extends WorldScene {
  constructor() {
    super('MarketScene');
  }

  // data.entry says where the player arrives, such as 'fromHome'
  create(data = {}) {
    this.loadData();
    this.prepareGame(data);
    this.place = this.placesData.market;
    this.worldW = WORLD_W;
    this.worldH = WORLD_H;
    this.graph = buildGraph(this.ambientData.graph.nodes, this.ambientData.graph.edges);

    this.interactables = []; // things the player can press E on
    this.solids = [];        // things the player can't walk through
    this.speed = 180;

    this.dayOver = false;
    this.outOfBusiness = false;
    this.sleeping = false;
    this.modalOpen = false;   // true while a conversation or the Notebook is showing
    this.cutscene = false;    // true while the mentor walks over to talk
    this.useLabel = isTouchDevice() ? 'Use' : 'E';
    this.reportTapped = false; // the player tapped the Takings report
    this.levelUpPending = false; // every mission of the level is done
    this.bannerCount = 0;     // messages currently showing across the top
    this.pendingBeat = null;  // a conversation waiting for the end of the day
    this.report = null;
    this.lastClock = '';

    // The ground carries on a little past the edges, for the bit of the way home the view can see
    this.add.tileSprite(-VIEW_MARGIN, -VIEW_MARGIN, WORLD_W + VIEW_MARGIN * 2, WORLD_H + VIEW_MARGIN * 2, 'dirt').setOrigin(0).setDepth(DEPTH.ground);

    this.createStall();
    this.createCustomerArea();
    this.createSupplier();
    this.createProps();
    this.createMentor();
    this.createPriceBoard();
    this.createVendors();
    this.createWalkers();
    this.createShops();
    this.createPathHome();
    this.createPlayer(this.entrySpot(this.place, data.entry));
    this.setupCamera();
    this.setupControls();
    this.createPrompt();
    this.createHud();
    this.createMissionPanel();
    this.createDusk();
    this.setupPause();
    this.startWelcome();
    this.startDayBeat(); // her morning conversation, the first time the player arrives today
    startMusic();
    startAmbience();
    if (data.note) this.showBanner(data.note);
  }

  // A worn path from the west edge, a signpost and arrows, so the way home is easy to find
  createPathHome() {
    const exit = this.place.exits[0];
    const middle = (exit.min + exit.max) / 2;
    const path = this.add.graphics().setDepth(DEPTH.ground + 1);
    path.fillStyle(0xe6cfa4, 1).fillRoundedRect(-VIEW_MARGIN - 60, middle - 70, VIEW_MARGIN + 350, 140, 60);
    path.lineStyle(3, 0xc49a64, 1).strokeRoundedRect(-VIEW_MARGIN - 60, middle - 70, VIEW_MARGIN + 350, 140, 60);

    this.createExits(this.place.exits);
    this.makeSignpost(190, middle - 84, exit.label, true);
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

    // While the report is showing, or the screen is fading to another place,
    // the player stands still
    if (this.dayOver || this.travelling) {
      this.playerSprite.animate(delta, 0, null);
      touch.use = false;
      if (this.dayOver) this.handleReportInput();
      return;
    }

    this.handleMovement();
    this.animatePlayer(delta);
    this.handleInteraction();
    this.handleCustomers(delta);
    this.checkExits();
    this.handleClock(delta);
  }
}

Object.assign(
  MarketScene.prototype,
  stallMethods,
  customersMethods,
  supplierMethods,
  mentorMethods,
  ambientMethods,
  pricesMethods,
  dayMethods
);
