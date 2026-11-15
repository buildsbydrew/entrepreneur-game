// Everything about the life being played: who you are, the date, your money and wellbeing, what you're
// good at, your personality, where you are, what the people around you think of you, and the moments
// worth remembering. No drawing happens here.
import { createClock } from './clock.js';

export const state = {
  life: null,     // { name, look: { body, skin }, birth: { year, day } }
  clock: null,    // { year, day, minutes }
  money: 0,
  needs: null,    // { energy, health, happiness }, each 0 to 100
  skills: {},     // skill id -> level (grows by doing): study, social, fitness, craft, money
  traits: {},     // personality, shaped by choices: curious, bold, kind, cheeky, calm
  place: 'home',  // the id of the place the player is in
  player: null,   // { x, z } where the player stands
  people: {},     // person id -> { bond, met, talks } how they feel about you
  flags: {},      // things that have happened: flag name -> true or a value
  journal: [],    // moments worth remembering: { year, day, age, text }
  items: [],      // things you carry: ids from src/data/items.json
  focus: null,    // what the player chose to focus on during the last stretch of time
  dead: null      // { cause, age } once the life has ended
};

// A brand new life, starting at birth
export function newLife(world, { name, look }) {
  state.clock = createClock(world, { year: 1, day: 1 });
  state.life = { name, look, birth: { year: 1, day: 1 } };
  state.money = 0;
  state.needs = { energy: 100, health: 100, happiness: 80 };
  state.skills = {};
  state.traits = {};
  state.place = 'home';
  state.player = null;
  state.people = {};
  state.flags = {};
  state.journal = [];
  state.items = [];
  state.focus = null;
  state.dead = null;
}

// Things you carry
export function giveItem(id) {
  if (!state.items.includes(id)) state.items.push(id);
}
export function takeItem(id) {
  state.items = state.items.filter(item => item !== id);
}

// How someone feels about the player, created the first time they meet
export function personRecord(id) {
  if (!state.people[id]) state.people[id] = { bond: 0, met: false, talks: 0 };
  return state.people[id];
}

export const SAVED_KEYS = ['life', 'clock', 'money', 'needs', 'skills', 'traits', 'place', 'player', 'people', 'flags', 'journal', 'items', 'focus', 'dead'];

export function exportState() {
  return JSON.parse(JSON.stringify(Object.fromEntries(SAVED_KEYS.map(key => [key, state[key]]))));
}

export function importState(data) {
  const copy = JSON.parse(JSON.stringify(data));
  SAVED_KEYS.forEach(key => { state[key] = copy[key]; });
  state.items = state.items ?? []; // saves from before you could carry things
}
