// The clock on screen, and what happens when the time comes: trading ends at 6 PM, and
// by 10 PM the player is too tired to stay up. The time itself lives in js/dayClock.js,
// so it carries on when the player walks from one place to the next.
// These methods are added to the scene, so `this` is the scene.
import { state } from '../../state.js';
import { clock, tick, formatTime, almostClosing, closingDue, bedtimeDue, phase } from '../../dayClock.js';

export const clockMethods = {
  // ---------- The day ----------
  handleClock(delta) {
    tick(delta);
    this.updateDusk();
    this.updateClock();

    if (closingDue()) {
      this.closeTradingDay();
      return;
    }

    if (bedtimeDue()) this.goToSleep(true);
  },

  // Turns the time into a clock reading like "2:35 PM"
  formatClock() {
    return formatTime(clock.minutes);
  },

  updateClock() {
    const text = `Day ${state.day}   ${this.formatClock()}`;
    if (text === this.lastClock) return;

    this.lastClock = text;
    this.clockText.setText(text);

    // Red during the last stretch of trading, and a soft blue once evening comes
    let color = '#ffffff';
    if (almostClosing()) color = '#ff6b6b';
    else if (phase() === 'evening' || phase() === 'night') color = '#cfe0ff';
    this.clockText.setColor(color);
  },
};
