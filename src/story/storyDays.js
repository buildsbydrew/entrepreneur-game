// Big days: the days of a life that are always played (the first day out alone, the night the baby is
// born...). Each is written as data in src/data/storydays.json. This file holds the rules, with no drawing,
// so it can be tested on its own:
// - when a big day is due, time jumps stop at it, so it's never skipped;
// - a big day has goals (shown on screen), moments (things that happen at a time or place), and an ending
//   (a line that closes the day, often a cliffhanger, plus what's remembered).
//
// A big day:
//   { "id": "first-day-out", "age": 5, "extraDays": 2, "hour": 7, "wake": "bed", "place": "home",
//     "when": { conditions },                      (optional: only if these are true)
//     "goals": [ { "id", "text", "done": { condition } } ],
//     "moments": [ { "id", "hour", "place", "if": { condition }, "do": [ actions ] } ],
//     "end": { "line": "That night...", "effects": { ... } } }
//
// Conditions (all must be true): flag, notFlag, place, talkedTo (a person id), bondAtLeast { id: n },
// hourAtLeast. Actions are carried out by the game: { "toast": text }, { "say": [person, text] },
// { "talk": conversation id }, { "appear": person, "x", "z", "facing", "walkTo": [...] }, { "leave": person },
// { "setFlag": name }, { "remember": text }, { "give": item id }, { "take": item id }, { "camera": "close" }.
import { state } from '../core/state.js';
import { ageOf, daysPerYear } from '../core/clock.js';

// How many days from the date `clock` until the date someone born on `birth` reaches `age` years
// plus `extraDays` (can be negative if it's already passed)
export function daysUntilAge(birth, clock, age, extraDays, world) {
  const year = daysPerYear(world);
  const target = (birth.year + age) * year + birth.day + (extraDays ?? 0);
  const now = clock.year * year + clock.day;
  return target - now;
}

// Has this big day already been played?
export function played(day) {
  return Boolean(state.flags[`day:${day.id}`]);
}

// Do a big day's conditions fit this life?
export function fits(day) {
  if (day.draft) return false; // written down, but not ready to play yet
  return conditionMet(day.when);
}

// The next big day still to come, and how many days away it is: { day, days } or null
export function nextBigDay(data, world) {
  let best = null;
  for (const day of data.days) {
    if (played(day) || !fits(day)) continue;
    const days = daysUntilAge(state.life.birth, state.clock, day.age, day.extraDays, world);
    if (best === null || days < best.days) best = { day, days };
  }
  return best;
}

// How far a time jump should go: normally the chapter's jump, but never past the next big day
export function jumpLength(normalDays, data, world) {
  const next = nextBigDay(data, world);
  if (!next) return { days: normalDays, bigDay: null };
  if (next.days <= normalDays) return { days: Math.max(1, next.days), bigDay: next.day };
  return { days: normalDays, bigDay: null };
}

// The big day being played today, if any
export function todaysBigDay(data) {
  const id = state.flags.today;
  return id ? data.days.find(d => d.id === id) ?? null : null;
}

// Starts a big day: remembered as today's, and as played
export function beginBigDay(day) {
  state.flags.today = day.id;
  state.flags[`day:${day.id}`] = true;
}

// Ends today's big day (when the player sleeps). Returns its closing line, if it has one.
export function endBigDay(data) {
  const day = todaysBigDay(data);
  delete state.flags.today;
  if (!day) return null;
  delete state.flags[`moments:${day.id}`];
  return day.end ?? null;
}

// ---------- Conditions ----------

// context: { place, hour } where the player is and the time, for conditions that need them
export function conditionMet(cond, context = {}) {
  if (!cond) return true;
  if (cond.flag && !state.flags[cond.flag]) return false;
  if (cond.notFlag && state.flags[cond.notFlag]) return false;
  if (cond.place && context.place !== cond.place) return false;
  if (cond.talkedTo && !(state.people[cond.talkedTo]?.talks > (state.flags[`talksAtStart:${cond.talkedTo}`] ?? 0))) return false;
  if (cond.hourAtLeast !== undefined && (context.hour ?? 0) < cond.hourAtLeast) return false;
  if (cond.bondAtLeast) {
    for (const [id, n] of Object.entries(cond.bondAtLeast)) {
      if ((state.people[id]?.bond ?? 0) < n) return false;
    }
  }
  return true;
}

// Notes how many times the player had talked to everyone when the day began, so "talkedTo" means "today"
export function markTalksAtStart(peopleIds) {
  peopleIds.forEach(id => { state.flags[`talksAtStart:${id}`] = state.people[id]?.talks ?? 0; });
}

// ---------- Goals ----------

// Today's goals, each with whether it's done: [{ id, text, done }]
export function goalStatus(day, context) {
  return (day?.goals ?? []).map(goal => {
    const key = `goal:${day.id}:${goal.id}`;
    if (!state.flags[key] && conditionMet(goal.done, context)) state.flags[key] = true;
    return { id: goal.id, text: goal.text, done: Boolean(state.flags[key]) };
  });
}

// ---------- Moments ----------

// The moments that should happen now and haven't yet. Each happens once per big day.
export function dueMoments(day, context) {
  if (!day) return [];
  const key = `moments:${day.id}`;
  const done = state.flags[key] ?? [];
  const due = (day.moments ?? []).filter(m =>
    !done.includes(m.id) &&
    (m.hour === undefined || context.hour >= m.hour) &&
    (m.place === undefined || context.place === m.place) &&
    conditionMet(m.if, context)
  );
  if (due.length) state.flags[key] = [...done, ...due.map(m => m.id)];
  return due;
}

// The age a big day happens at, for the "time passes" screen
export function bigDayAge(day) {
  return day.age;
}

export { ageOf };
