// Where people are through the day. Each person has a schedule in people.json: from each hour onward,
// which place they're in (or away), where they stand, and where they sometimes stroll.
// No drawing happens here, so it can be tested on its own.
import { ageOf } from './clock.js';

// On a big day, some people are somewhere else than usual (at school, at the hospital...):
// { personId: schedule } for today only. Set when a big day begins, cleared when it ends.
let todaySchedules = {};
export function setTodaySchedules(schedules) {
  todaySchedules = schedules ?? {};
}

// The schedule someone is following today
export function scheduleOf(person) {
  return todaySchedules[person.id] ?? person.schedule;
}

// The part of the schedule that applies at this time of day
export function scheduleNow(person, minutes) {
  const hour = minutes / 60;
  const schedule = scheduleOf(person);
  let current = schedule[0];
  for (const entry of schedule) {
    if (hour >= entry.from) current = entry;
  }
  return current;
}

// Has this person been born by this date? (Your little brother or sister arrives when you're 7.)
export function bornYet(person, clock) {
  const b = person.born;
  return !b || clock.year > b.year || (clock.year === b.year && clock.day >= b.day);
}

// Is this person in this place right now? People only appear once they're old enough to be out and about.
export function isPresent(person, placeId, clock, world) {
  if (!bornYet(person, clock)) return false;
  if (person.appearsFromAge !== undefined && ageOf(person.born, clock, world) < person.appearsFromAge) return false;
  return scheduleNow(person, clock.minutes).place === placeId;
}
