// How the autopilot lives a big day (src/data/storydays.json): it works through the day's goals, makes
// sure it's in the right place when something is due to happen there, waits near the right person,
// and doesn't go to bed while the day still has something to show.
import storyData from '../data/storydays.json';
import placesData from '../data/places.json';
import conversationsData from '../data/conversations.json';
import { state } from '../core/state.js';
import { todaysBigDay, conditionMet } from '../story/storyDays.js';

const conversations = conversationsData.conversations;

// Every flag a conversation can set, anywhere in it
function flagsSetBy(convo) {
  const flags = new Set();
  const add = effects => [].concat(effects?.setFlag ?? []).forEach(f => flags.add(f));
  for (const node of Object.values(convo?.nodes ?? {})) {
    add(node.effects);
    (node.choices ?? []).forEach(c => add(c.effects));
  }
  return flags;
}

// Does a moment, when it plays, set this flag (directly, or through the conversation it starts)?
function momentSets(moment, flag) {
  return (moment.do ?? []).some(a =>
    [].concat(a.setFlag ?? []).includes(flag) ||
    (a.talk && flagsSetBy(conversations.find(c => c.id === a.talk)).has(flag)));
}

// The person a moment will talk with, if any (so the AI waits beside them)
const momentPerson = moment => (moment.do ?? []).find(a => a.talk && a.with)?.with ?? null;

export const bigDayToday = () => todaysBigDay(storyData);

// The moments still to come today whose conditions (other than time and place) hold
export function pendingMoments(day) {
  const done = state.flags[`moments:${day.id}`] ?? [];
  return (day.moments ?? []).filter(m => !done.includes(m.id) && conditionMet(m.if, { place: m.place, hour: 99 }));
}

// When the AI may go to bed tonight
export function bedHour(day) {
  return Math.max(18, day?.bedFrom ?? 0);
}

// The route from one place to another, as the next place to walk to (or null if already there)
export function nextPlaceToward(from, to) {
  if (from === to) return null;
  const seen = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    for (const exit of placesData[at]?.exits ?? []) {
      if (seen.has(exit.to)) continue;
      seen.set(exit.to, at);
      if (exit.to === to) {
        let step = to;
        while (seen.get(step) !== from) step = seen.get(step);
        return step;
      }
      queue.push(exit.to);
    }
  }
  return null;
}

// What the day asks for next, or null when it asks nothing right now.
//   { kind: 'talk', id }                       go and talk to someone
//   { kind: 'go', place }                      go somewhere
//   { kind: 'wait', place, until, near }       be in a place (beside someone) until an hour
// isPresentAt(id) → place id where that person is now (or null).
export function bigDayNeed(day, { here, hour, isPresentAt, canTalk, achieved = new Set() }) {
  const pending = pendingMoments(day);
  const goalDone = goal => achieved.has(goal.id) || state.flags[`goal:${day.id}:${goal.id}`] || conditionMet(goal.done, { place: here, hour });

  // Something about to happen right here: stay for it
  const soonHere = pending
    .filter(m => (m.place === undefined || m.place === here) && (m.hour ?? 0) - hour < 4)
    .sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0))[0];
  const waitFor = m => ({ kind: 'wait', place: m.place ?? here, until: m.hour ?? hour, near: momentPerson(m), moment: m.id });

  for (const goal of day.goals ?? []) {
    if (goalDone(goal)) continue;
    const done = goal.done ?? {};
    // "Be home before dark": only once it's nearly time
    if (done.hourAtLeast !== undefined && hour < done.hourAtLeast - 1.2) continue;
    // Don't walk away from something about to happen here
    if (soonHere && done.place && done.place !== here && !(done.flag && !state.flags[done.flag])) return waitFor(soonHere);
    if (done.talkedTo) {
      const at = isPresentAt(done.talkedTo);
      if (at && canTalk(done.talkedTo)) return { kind: 'talk', id: done.talkedTo, place: at };
      continue;
    }
    if (done.flag && !state.flags[done.flag]) {
      // A moment that will set it: be there for it
      const moment = pending.find(m => momentSets(m, done.flag));
      if (moment) return moment.place && moment.place !== here ? { kind: 'go', place: moment.place } : waitFor(moment);
      // A conversation that can set it: talk to that person
      const convo = conversations.find(c => flagsSetBy(c).has(done.flag) && c.with);
      const at = convo && isPresentAt(convo.with);
      if (at && canTalk(convo.with)) return { kind: 'talk', id: convo.with, place: at };
      continue;
    }
    if (done.place && done.place !== here) return { kind: 'go', place: done.place };
    if (done.place && done.hourAtLeast !== undefined) return { kind: 'wait', place: here, until: done.hourAtLeast };
  }
  if (soonHere) return waitFor(soonHere);
  return null;
}

// The next thing due somewhere else in the next few hours, so the AI is there in time (or null).
// If something is also due here (like the man in the green coat, who can turn up in either place), stay.
export function nextMomentElsewhere(day, here, hour) {
  const pending = pendingMoments(day);
  const soon = pending.filter(m => (m.hour ?? 0) - hour < 3).sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0));
  if (soon.some(m => m.place === undefined || m.place === here)) return null;
  return soon.find(m => m.place && m.place !== here) ?? null;
}

// The hour of the next thing due here, so waiting stops in time for it (or null)
export function nextMomentHere(day, here, hour) {
  return pendingMoments(day).filter(m => (m.place === undefined || m.place === here) && (m.hour ?? 0) > hour)
    .map(m => m.hour).sort((a, b) => a - b)[0] ?? null;
}

// Marks the goals done right now, so the AI remembers it already did them after it leaves
export function noteGoals(day, achieved, context) {
  for (const goal of day.goals ?? []) if (!achieved.has(goal.id) && conditionMet(goal.done, context)) achieved.add(goal.id);
}
