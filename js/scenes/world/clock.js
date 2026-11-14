// The clock that runs through the day.
// These methods are added to the scene, so `this` is the scene.
import { state } from '../../state.js';

export const clockMethods = {
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
  },

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
  },

  updateClock() {
    const text = `Day ${state.day}   ${this.formatClock()}`;
    if (text === this.lastClock) return;

    this.lastClock = text;
    this.clockText.setText(text);

    // Turns red during the last stretch of the day
    const almostClosing = this.dayTimeLeft < this.setting.day.lengthMs * 0.15;
    this.clockText.setColor(almostClosing ? '#ff6b6b' : '#ffffff');
  },
};
