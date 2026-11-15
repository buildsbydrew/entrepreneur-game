// The shape of a day, wherever the player happens to be: trading ends at 6 PM with the Takings
// report, the evening follows, and sleeping (in bed, or wherever they are at 10 PM) brings the
// next morning at home.
// These methods are added to the scene, so `this` is the scene.
import { state, initState, startNextDay, endOfDayAging, profitToday, stockValue } from '../../state.js';
import { clock, startMorning, dayTimes, formatTime } from '../../dayClock.js';
import { isTouchDevice } from '../../ui/touch.js';
import { play } from '../../audio/sound.js';
import { profile } from '../../profile.js';
import { buildContext, findDueBeat } from '../../mentor.js';
import { REPORT_W, REPORT_H, DEPTH } from '../constants.js';

export const dayMethods = {
  // 6 PM: trading is over for the day, wherever the player is.
  // The stall's goals are judged, and the Takings report appears.
  closeTradingDay() {
    clock.tradingClosed = true;
    this.dayOver = true;
    play('bell');
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.prompt.setVisible(false);

    // Anything a place has to do at closing, such as the market sending its customers home
    if (this.onTradingEnds) this.onTradingEnds();

    // Overnight, stock gets older and some of it goes bad
    endOfDayAging(this.setting);

    // Out of business means no stock and not enough cash for even the cheapest item
    const cheapest = Math.min(...this.setting.items.map(item => item.buyPrice));
    const hasStock = Object.values(state.stock).some(count => count > 0);
    this.outOfBusiness = state.cash < cheapest && !hasStock;
    clock.outOfBusiness = this.outOfBusiness;

    // Work out what happened at the stall, and whether the mentor has something to say.
    // She can only come over in the market, so anywhere else her visit waits for another day.
    this.beatContext = buildContext(state, this.setting);
    this.pendingBeat = this.outOfBusiness || !this.eveningVisit
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
    let hint = `${continueWord} to carry on`;

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

  // Pressing Enter on the Takings report. In the market, Maame Gyasiwaa may come over first.
  // Then the level-complete screen, if a level was just finished, and then the evening.
  continueFromReport() {
    const beat = this.pendingBeat;
    this.pendingBeat = null;

    const carryOn = () => {
      if (this.outOfBusiness) {
        this.goToSleep(false); // a fresh start tomorrow morning
        return;
      }
      this.maybeShowLevelComplete(() => this.startEvening());
    };

    if (beat && this.eveningVisit) this.eveningVisit(beat, carryOn);
    else carryOn();
  },

  // The report goes away and the player is free until bedtime
  startEvening() {
    if (this.report) this.report.destroy();
    this.report = null;
    this.dayOver = false;
    this.updateHud();
    this.drawMissionPanel();
    this.updateClock();
    if (this.onEveningStarts) this.onEveningStarts();
  },

  // Off to bed. If it's 10 PM and the player is still up, it happens wherever they are,
  // and they still wake up at home.
  goToSleep(tooLate) {
    if (this.sleeping) return;
    this.sleeping = true;
    this.travelling = true; // nothing else moves while the screen fades
    this.player.body.setVelocity(0, 0);
    this.player.body.setAcceleration(0, 0);
    this.prompt.setVisible(false);

    if (tooLate) this.showBanner(`It's ${formatTime(dayTimes().bed)}. Time for bed.`);

    this.cameras.main.fadeOut(tooLate ? 1400 : 700, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomeScene', { entry: 'wake' });
    });
  },

  // A new morning at home. After a business failure, the game starts over instead.
  wakeUp() {
    const startingOver = clock.outOfBusiness;
    if (startingOver) {
      initState(this.setting);
      this.levelUpPending = false;
    } else {
      startNextDay();
    }
    startMorning();

    play('morning');
    this.updateHud();
    this.refreshMissions();
    this.updateDusk();
    this.updateClock();
    this.saveProgress();
    this.showBanner(startingOver ? 'A fresh start. The market opens at 7:00 AM.' : `Day ${state.day}. The market opens at 7:00 AM.`);
  },
};
