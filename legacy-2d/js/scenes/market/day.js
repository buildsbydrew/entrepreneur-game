// The market's part of the day: what closing time means here, Maame Gyasiwaa's evening visit,
// her morning conversations, and leaving for home. The rest of the day (the Takings report,
// the evening, sleeping) is shared by every place, in world/day.js.
// These methods are added to the scene, so `this` is the scene.
import { state, unlockEntry, markBeatSeen, recordLostCustomer } from '../../state.js';
import { buildContext, renderLines, findDueBeat } from '../../mentor.js';

export const dayMethods = {
  // 6 PM in the market: everyone still at the stall goes home, and the stall shuts
  onTradingEnds() {
    this.customers.forEach(customer => customer.destroy());
    this.customers = [];
    this.slots.forEach(slot => {
      slot.customer = null;
    });
    this.setStallOpen(false);
  },

  // After the report, the market winds down for the night
  onEveningStarts() {
    this.showBanner('The market is closed for the day. Head home when you are ready.');
  },

  // If she has something to say, she walks over from her stall while the camera follows her,
  // talks, and then walks back. `then` carries on with the evening.
  eveningVisit(beat, then) {
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
        then();
        if (banner) this.showBanner(banner);
      });
    });
  },

  // Conversations that come at the start of a day, such as the mentor introducing a new level.
  // They happen the first time the player reaches the market that day.
  startDayBeat() {
    const beat = findDueBeat(this.mentorData.beats, 'dayStart', state, buildContext(state, this.setting));
    if (!beat) return;

    this.time.delayedCall(700, () => {
      this.playDialogue(renderLines(beat.lines), () => markBeatSeen(beat.id));
    });
  },

  // Walking home in the middle of the day shuts the stall. Anyone waiting is a customer lost.
  // Returns a note to show when the player arrives.
  beforeLeaving() {
    if (!this.stallOpen) return null;

    this.waitingCustomers().forEach(customer => recordLostCustomer(customer.item, false));
    return 'You shut your stall to come home. No customers come while you are away.';
  },
};
