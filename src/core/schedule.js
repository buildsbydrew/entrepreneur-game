// Where people are through the day. Each person has a schedule in people.json: from each hour onward,
// which place they're in (or away), where they stand, and where they sometimes stroll.
// No drawing happens here, so it can be tested on its own.
import { ageOf } from './clock.js';

// The part of the schedule that applies at this time of day
export function scheduleNow(person, minutes) {
  const hour = minutes / 60;
  let current = person.schedule[0];
  for (const entry of person.schedule) {
    if (hour >= entry.from) current = entry;
  }
  return current;
}

// Is this person in this place right now? People only appear once they're old enough to be out and about.
export function isPresent(person, placeId, clock, world) {
  if (person.appearsFromAge !== undefined && ageOf(person.born, clock, world) < person.appearsFromAge) return false;
  return scheduleNow(person, clock.minutes).place === placeId;
}
