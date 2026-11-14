// The market: where the stall is, and the first place in the game.
// What it does is split into small files under world/ (shared by every place) and market/.
import WorldScene from './WorldScene.js';
import { initState, importState } from '../state.js';
import { buildGraph } from '../entities/routes.js';
import { touch, isTouchDevice } from '../ui/touch.js';
import { startMusic, startAmbience } from '../audio/sound.js';
import { WORLD_W, WORLD_H, DEPTH } from './constants.js';
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

  create() {
    this.setting = this.cache.json.get('setting');
    this.mentorData = this.cache.json.get('mentors');
    this.notebookData = this.cache.json.get('notebook');
    this.levelsData = this.cache.json.get('levels');
    this.ambientData = this.cache.json.get('ambient');
    this.graph = buildGraph(this.ambientData.graph.nodes, this.ambientData.graph.edges);
    // A saved game picks up where it left off. Otherwise this is a new game.
    const saved = this.registry.get('loadedState');
    this.registry.set('loadedState', null);
    if (saved) importState(saved);
    else initState(this.setting);
    this.isNewGame = !saved;

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
    this.startDayBeat(); // a saved game may be waiting on a conversation it hadn't had yet
    startMusic();
    startAmbience();
    if (this.isNewGame) this.saveProgress();
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
