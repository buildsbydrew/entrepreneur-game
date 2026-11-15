// Checks for the parts of the game that don't draw anything: the clock, saving, and conversations.
// Run with: npm test
import { describe, it, expect, beforeEach } from 'vitest';
import world from '../src/data/world.json';
import { createClock, tick, nextMorning, seasonOf, ageOf, formatTime, isBedtime, daysPerYear } from '../src/core/clock.js';
import { state, newLife, personRecord } from '../src/core/state.js';
import { saveGame, loadGame, isValid, VERSION } from '../src/core/save.js';
import { conditionsMet, applyEffects, pickConversation, availableChoices, finishConversation, fillText } from '../src/story/conversation.js';

// A pretend browser storage
function memoryStorage() {
  const data = {};
  return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; } };
}

describe('clock', () => {
  it('a played day lasts the set number of real minutes', () => {
    const clock = createClock(world);
    expect(formatTime(clock.minutes)).toBe('6:00 AM');
    tick(clock, world, world.day.realMinutesPerDay * 60 * 1000);
    expect(Math.round(clock.minutes)).toBe(world.day.sleepHour * 60);
    expect(isBedtime(clock, world)).toBe(true);
  });

  it('moves through seasons and years', () => {
    const clock = createClock(world);
    nextMorning(clock, world, daysPerYear(world));
    expect(clock.year).toBe(2);
    expect(clock.day).toBe(1);
    expect(seasonOf(clock, world).name).toBe(world.calendar.seasons[0]);
    nextMorning(clock, world, world.calendar.daysPerSeason);
    expect(seasonOf(clock, world).name).toBe(world.calendar.seasons[1]);
  });

  it('works out age from a birth date', () => {
    const clock = createClock(world, { year: 10, day: 5 });
    expect(ageOf({ year: 3, day: 5 }, clock, world)).toBe(7);
    expect(ageOf({ year: 3, day: 6 }, clock, world)).toBe(6);
  });

  it('formats times', () => {
    expect(formatTime(0)).toBe('12:00 AM');
    expect(formatTime(12 * 60)).toBe('12:00 PM');
    expect(formatTime(22 * 60 + 5)).toBe('10:05 PM');
  });
});

describe('saving', () => {
  beforeEach(() => newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } }));

  it('saves and loads a life', () => {
    const storage = memoryStorage();
    state.money = 42;
    state.player = { x: 1, z: 2 };
    expect(saveGame(storage)).toBe(true);
    const loaded = loadGame(storage);
    expect(loaded.version).toBe(VERSION);
    expect(loaded.state.money).toBe(42);
    expect(loaded.state.life.name).toBe('Ari');
  });

  it('ignores damaged or old saves', () => {
    const storage = memoryStorage();
    storage.setItem('lifegame.save', '{not json');
    expect(loadGame(storage)).toBe(null);
    storage.setItem('lifegame.save', JSON.stringify({ version: 999, state: {} }));
    expect(loadGame(storage)).toBe(null);
    expect(isValid({ version: VERSION, state: { life: {} } })).toBe(false);
  });
});

describe('conversations', () => {
  const convo = {
    id: 'test', with: 'nico', once: true, start: 'a',
    nodes: {
      a: { lines: [['nico', 'Hi {name}']], choices: [
        { text: 'Hello', effects: { bond: 2 }, next: null },
        { text: 'Share your snack', if: { moneyAtLeast: 100 }, effects: { bond: 5 }, next: null }
      ] }
    }
  };

  beforeEach(() => newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } }));

  it('hides choices whose conditions are not met', () => {
    expect(availableChoices(convo.nodes.a, 'nico').map(c => c.text)).toEqual(['Hello']);
    state.money = 100;
    expect(availableChoices(convo.nodes.a, 'nico')).toHaveLength(2);
  });

  it('choices change how people feel, and money', () => {
    applyEffects({ bond: 2, money: -5 }, 'nico');
    expect(personRecord('nico').bond).toBe(2);
    expect(state.money).toBe(world.startingMoney - 5);
    applyEffects({ money: -9999 });
    expect(state.money).toBe(0); // money never goes below zero
  });

  it('one-off conversations only happen once', () => {
    const person = { id: 'nico', conversations: ['test'] };
    expect(pickConversation(person, [convo])).toBe(convo);
    finishConversation(convo, 'nico');
    expect(pickConversation(person, [convo])).toBe(null);
    expect(personRecord('nico').talks).toBe(1);
  });

  it('checks flags and bonds', () => {
    expect(conditionsMet({ flag: 'x' })).toBe(false);
    state.flags.x = true;
    expect(conditionsMet({ flag: 'x', bondAtLeast: 1 }, 'nico')).toBe(false);
    personRecord('nico').bond = 1;
    expect(conditionsMet({ flag: 'x', bondAtLeast: 1 }, 'nico')).toBe(true);
  });

  it('fills in the player name', () => {
    expect(fillText('Hi {name}')).toBe('Hi Ari');
  });
});
