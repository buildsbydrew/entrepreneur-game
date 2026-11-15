// Everything about the life being played: who you are, the date, your money, where you are,
// and what the people around you think of you. No drawing happens here.
import { createClock } from './clock.js';

export const state = {
  life: null,     // { name, look: { body, skin }, birth: { year, day } }
  clock: null,    // { year, day, minutes }
  money: 0,
  place: 'home',  // the id of the place the player is in
  player: null,   // { x, z } where the player stands
  people: {},     // person id -> { bond, met, talks } how they feel about you
  flags: {}       // things that have happened: flag name -> true or a value
};

// A brand new life. For now the player starts as a young child; the baby chapter comes with the stories.
export function newLife(world, { name, look }) {
  state.life = { name, look, birth: { year: -6, day: 40 } };
  state.clock = createClock(world, { year: 1, day: 1 });
  state.money = world.startingMoney;
  state.place = 'home';
  state.player = null;
  state.people = {};
  state.flags = {};
}

// How someone feels about the player, created the first time they meet
export function personRecord(id) {
  if (!state.people[id]) state.people[id] = { bond: 0, met: false, talks: 0 };
  return state.people[id];
}

export const SAVED_KEYS = ['life', 'clock', 'money', 'place', 'player', 'people', 'flags'];

export function exportState() {
  return JSON.parse(JSON.stringify(Object.fromEntries(SAVED_KEYS.map(key => [key, state[key]]))));
}

export function importState(data) {
  const copy = JSON.parse(JSON.stringify(data));
  SAVED_KEYS.forEach(key => { state[key] = copy[key]; });
}
