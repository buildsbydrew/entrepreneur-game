// Maame Gyasiwaa: her stall, her walks, her errands, and what she says.
// These methods are added to the scene, so `this` is the scene.
import { state, markBeatSeen } from '../../state.js';
import PersonSprite from '../../entities/PersonSprite.js';
import { findPath, pointOf } from '../../entities/routes.js';
import Mover from '../../entities/Mover.js';
import { renderLines } from '../../mentor.js';
import { MENTOR_SPEED, MENTOR_ERRAND_SPEED } from '../constants.js';

export const mentorMethods = {
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
  },

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
  },

  walkMentorTo(target, faceOnArrival, onArrive) {
    this.walkMentorAlong([{ x: target.x, y: target.y }], faceOnArrival, onArrive);
  },

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
  },

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
  },

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
  },

  // She is at her stall, and not busy
  mentorIsHome() {
    return !this.mentorErrand && !this.mentorTask && !this.cutscene;
  },

  // Her first words, shortly after the game begins
  startWelcome() {
    const beat = this.mentorData.beats.find(b => b.id === 'welcome');
    if (!beat || state.beatsSeen.includes(beat.id)) return;

    this.time.delayedCall(700, () => {
      this.playDialogue(renderLines(beat.lines), () => markBeatSeen(beat.id));
    });
  },

  // Pressing E beside her repeats the gist of what she last told you
  talkToMentor() {
    if (this.mentorTask || this.cutscene) return; // she is busy walking

    const chat = this.mentorData.mentor.chat;
    let lines = chat.beforeEvidence;
    if (state.beatsSeen.includes('pricing-evidence')) lines = chat.afterPricing;
    else if (state.level >= 2) lines = chat.duringPricing;
    else if (state.beatsSeen.includes('first-evidence')) lines = chat.afterEvidence;
    this.playDialogue(lines);
  },
};
