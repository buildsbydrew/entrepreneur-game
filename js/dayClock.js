// The time of day, shared by every place, so the clock keeps running when the player walks
// from home to the market and back. No drawing happens here, so it can be tested on its own.
//
// Time is kept in minutes after midnight: 6:00 AM is 360, 6:00 PM is 1080.
// The clock runs at the same speed everywhere. That speed comes from the stall day in the
// setting file: 7:00 AM to 6:00 PM takes exactly `lengthMs` of real time (two minutes today).

export const clock = {
  minutes: 6 * 60,       // the time right now
  tradingClosed: false,  // today's trading has ended and the Takings report has been made
  outOfBusiness: false   // the report said the player can't carry on, so tomorrow starts over
};

const times = { wake: 6 * 60, open: 7 * 60, close: 18 * 60, bed: 22 * 60 };
let minutesPerMs = (11 * 60) / 120000;

// Reads the day's hours from the setting file. Safe to call more than once.
export function setupClock(day) {
  times.wake = (day.wakeHour ?? 6) * 60;
  times.open = day.startHour * 60;
  times.close = day.endHour * 60;
  times.bed = (day.bedHour ?? 22) * 60;
  minutesPerMs = (times.close - times.open) / day.lengthMs;
}

// The key times of the day, in minutes
export function dayTimes() {
  return { ...times };
}

// A new morning: back to waking time, with a fresh trading day ahead
export function startMorning() {
  clock.minutes = times.wake;
  clock.tradingClosed = false;
  clock.outOfBusiness = false;
}

// Moves the clock on by this much real time
export function tick(deltaMs) {
  clock.minutes += deltaMs * minutesPerMs;
}

// 'morning' before the market opens, 'trading' while it is open,
// 'evening' after closing, and 'night' from bedtime
export function phase(minutes = clock.minutes) {
  if (minutes < times.open) return 'morning';
  if (minutes < times.close && !clock.tradingClosed) return 'trading';
  if (minutes < times.bed) return 'evening';
  return 'night';
}

// Can the stall be open right now?
export function canTrade() {
  return phase() === 'trading';
}

// Has closing time come, but the day hasn't been closed yet?
export function closingDue() {
  return !clock.tradingClosed && clock.minutes >= times.close;
}

// Is it time to sleep, whether the player wants to or not?
export function bedtimeDue() {
  return clock.minutes >= times.bed;
}

// The last stretch of trading, when the clock turns red
export function almostClosing() {
  return phase() === 'trading' && clock.minutes >= times.close - (times.close - times.open) * 0.15;
}

// Turns minutes into a clock reading like "2:35 PM"
export function formatTime(minutes = clock.minutes) {
  const total = Math.floor(minutes);
  const hours24 = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

// The colour laid over the world at this time of day, and how strongly.
// A cool dawn that clears by opening time, a warm glow from mid-afternoon,
// and a deep blue night by bedtime.
const DAWN = [143, 168, 216];
const DUSK = [255, 122, 47];
const NIGHT = [27, 42, 90];

const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * t));
const toHex = ([r, g, b]) => (r << 16) | (g << 8) | b;
const clamp01 = value => Math.min(1, Math.max(0, value));

export function skyTint(minutes = clock.minutes) {
  const { open, close, bed, wake } = times;

  if (minutes < open) {
    const t = clamp01((minutes - wake) / (open - wake));
    return { color: toHex(DAWN), alpha: 0.18 * (1 - t) };
  }

  if (minutes < close) {
    // The same glow the market always had: it starts 60% of the way through the day
    const progress = (minutes - open) / (close - open);
    return { color: toHex(DUSK), alpha: 0.22 * clamp01((progress - 0.6) / 0.4) };
  }

  const t = clamp01((minutes - close) / (bed - close));
  return { color: toHex(mix(DUSK, NIGHT, t)), alpha: 0.22 + (0.45 - 0.22) * t };
}
