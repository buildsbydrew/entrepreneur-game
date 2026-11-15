// Home: where the player wakes up each morning and sleeps each night.
// The market is a walk away, off the east edge. The layout lives in data/places.json,
// and the room's own methods are in home/room.js.
import WorldScene from './WorldScene.js';
import Crowd from '../entities/crowd.js';
import { state } from '../state.js';
import { touch, isTouchDevice } from '../ui/touch.js';
import { startMusic, startAmbience } from '../audio/sound.js';
import { DEPTH } from './constants.js';
import { VIEW_MARGIN } from './world/travel.js';
import { roomMethods } from './home/room.js';

export default class HomeScene extends WorldScene {
  constructor() {
    super('HomeScene');
  }

  // data.entry says how the player got here: 'wake' (a new morning), 'fromMarket',
  // or nothing when the game has just been started or continued from the title screen
  create(data = {}) {
    this.loadData();
    const started = this.prepareGame(data);
    this.place = this.placesData.home;
    this.worldW = this.place.width;
    this.worldH = this.place.height;

    this.interactables = [];
    this.solids = [];
    this.speed = 180;

    this.dayOver = false;
    this.outOfBusiness = false;
    this.sleeping = false;
    this.modalOpen = false;
    this.cutscene = false;
    this.useLabel = isTouchDevice() ? 'Use' : 'E';
    this.reportTapped = false;
    this.levelUpPending = false;
    this.bannerCount = 0;
    this.pendingBeat = null;
    this.report = null;
    this.lastClock = '';

    // Nobody else lives here yet, but the player still needs these to move around
    this.crowd = new Crowd(this.solids);
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });

    this.add.tileSprite(-VIEW_MARGIN, -VIEW_MARGIN, this.worldW + VIEW_MARGIN * 2, this.worldH + VIEW_MARGIN * 2, 'dirt').setOrigin(0).setDepth(DEPTH.ground);
    this.createRoom();
    this.createFurniture();
    this.createBed();
    this.createYard();
    this.createPlayer(this.entrySpot(this.place, data.entry ?? 'wake'));
    this.setupCamera();
    this.setupControls();
    this.createPrompt();
    this.createHud();
    this.createMissionPanel();
    this.createDusk();
    this.setupPause();
    startMusic();
    startAmbience();

    if (data.entry === 'wake') {
      this.wakeUp();
    } else if (started) {
      if (started === 'new') this.saveProgress();
      this.showBanner(started === 'new'
        ? 'Good morning! The market is east of here. Walk out the door and follow the path.'
        : `Day ${state.day}. The market opens at 7:00 AM.`);
    }
    if (data.note) this.showBanner(data.note);
  }

  // After the Takings report, when trading ended while the player was at home
  onEveningStarts() {
    this.showBanner('Trading is over for today. Your bed is ready when you are.');
  }

  // ---------- Each frame ----------
  update(time, delta) {
    this.layoutHud();
    this.layoutReport();
    this.syncPlayerSprite();

    if (this.modalOpen) {
      this.playerSprite.animate(delta, 0, null);
      return;
    }

    if (this.dayOver || this.travelling) {
      this.playerSprite.animate(delta, 0, null);
      touch.use = false;
      if (this.dayOver) this.handleReportInput();
      return;
    }

    this.handleMovement();
    this.animatePlayer(delta);
    this.handleInteraction();
    this.checkExits();
    this.handleClock(delta);
  }
}

Object.assign(HomeScene.prototype, roomMethods);
