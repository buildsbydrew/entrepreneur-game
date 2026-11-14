// The end of the day: the Takings report, and the start of the next morning.
// These methods are added to the scene, so `this` is the scene.
import { state, initState, startNextDay, unlockEntry, markBeatSeen, profitToday, endOfDayAging, stockValue } from '../../state.js';
import { isTouchDevice } from '../../ui/touch.js';
import { play } from '../../audio/sound.js';
import { profile } from '../../profile.js';
import { buildContext, renderLines, findDueBeat } from '../../mentor.js';
import { WORLD_W, WORLD_H, REPORT_W, REPORT_H, DEPTH } from '../constants.js';

export const dayMethods = {
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
  },

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
  },

  // Keeps the report centered and sized to fit, even on small screens
  layoutReport() {
    if (!this.report) return;

    const w = this.scale.width;
    const h = this.scale.height;
    const fit = Math.min(1, w / (REPORT_W + 40), h / (REPORT_H + 40));

    this.report.setPosition(w / 2, h / 2).setScale(fit);
  },

  handleReportInput() {
    if (this.cutscene) return; // the mentor is on her way
    const pressedEnter = Phaser.Input.Keyboard.JustDown(this.keyEnter);
    const pressedSpace = Phaser.Input.Keyboard.JustDown(this.keySpace);

    const tapped = this.reportTapped;
    this.reportTapped = false;

    if (pressedEnter || pressedSpace || tapped) {
      this.continueFromReport();
    }
  },

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
    this.saveProgress();
  },

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
  },

  // Conversations that come at the start of a day, such as the mentor introducing a new level
  startDayBeat() {
    const beat = findDueBeat(this.mentorData.beats, 'dayStart', state, buildContext(state, this.setting));
    if (!beat) return;

    this.time.delayedCall(700, () => {
      this.playDialogue(renderLines(beat.lines), () => markBeatSeen(beat.id));
    });
  },
};
