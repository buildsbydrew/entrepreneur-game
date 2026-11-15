// The calendar and the time of day. No drawing happens here, so it can be tested on its own.
//
// Time of day is kept in minutes after midnight (6:00 AM is 360). While a day is played, the clock runs
// from waking to sleeping in `realMinutesPerDay` real minutes (15 by default), the same speed everywhere.
// The year is made of seasons, each a fixed number of days. All of this comes from src/data/world.json.

export function createClock(world, { year = 1, day = 1, minutes } = {}) {
  return { year, day, minutes: minutes ?? world.day.wakeHour * 60 };
}

// How many game minutes pass in one real millisecond. realMinutes is how long a played day lasts
// (each stage of life can have its own; babies' days are shorter).
export function minutesPerMs(world, realMinutes = world.day.realMinutesPerDay) {
  const { wakeHour, sleepHour } = world.day;
  return ((sleepHour - wakeHour) * 60) / (realMinutes * 60 * 1000);
}

export function tick(clock, world, deltaMs, realMinutes) {
  clock.minutes += deltaMs * minutesPerMs(world, realMinutes);
}

export function daysPerYear(world) {
  return world.calendar.daysPerSeason * world.calendar.seasons.length;
}

// The next morning. Moves into the next season and year as needed.
export function nextMorning(clock, world, days = 1) {
  clock.day += days;
  while (clock.day > daysPerYear(world)) {
    clock.day -= daysPerYear(world);
    clock.year += 1;
  }
  clock.minutes = world.day.wakeHour * 60;
}

// Which season it is, and which day of that season
export function seasonOf(clock, world) {
  const index = Math.floor((clock.day - 1) / world.calendar.daysPerSeason);
  return { name: world.calendar.seasons[index], dayOfSeason: ((clock.day - 1) % world.calendar.daysPerSeason) + 1 };
}

// Age in whole years, from a birth date { year, day }
export function ageOf(birth, clock, world) {
  const days = (clock.year - birth.year) * daysPerYear(world) + (clock.day - birth.day);
  return Math.max(0, Math.floor(days / daysPerYear(world)));
}

// 'night', 'morning', 'day' or 'evening'
export function phase(minutes) {
  const h = minutes / 60;
  if (h < 5.5 || h >= 21) return 'night';
  if (h < 10) return 'morning';
  if (h < 17.5) return 'day';
  return 'evening';
}

// Turns minutes into a clock reading like "2:35 PM"
export function formatTime(minutes) {
  const total = Math.floor(minutes);
  const h24 = Math.floor(total / 60) % 24;
  const mins = total % 60;
  return `${((h24 + 11) % 12) + 1}:${String(mins).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

export function isBedtime(clock, world) {
  return clock.minutes >= world.day.sleepHour * 60;
}
