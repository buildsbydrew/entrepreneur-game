// Checks for the rules of a life: growing up, time jumps, life events, death, schedules and
// personality. Run with: npm test
import { describe, it, expect, beforeEach } from 'vitest';
import world from '../src/data/world.json';
import focusData from '../src/data/focus.json';
import eventsData from '../src/data/events.json';
import peopleData from '../src/data/people.json';
import conversationsData from '../src/data/conversations.json';
import { state, newLife, personRecord } from '../src/core/state.js';
import { stageForAge, playerAge, playerStage, focusChoices, jumpTime, deathChance, eventChance, drainEnergy, changeNeed, topTraits, chapterOf } from '../src/core/life.js';
import { scheduleNow, isPresent } from '../src/core/schedule.js';
import { createClock, daysPerYear } from '../src/core/clock.js';
import { conditionsMet, applyEffects, pickConversation } from '../src/story/conversation.js';

// Random numbers that come out the same every time, so tests can be repeated
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const neverHappens = () => 0.999999;
const jump = (focusId, random = neverHappens) => jumpTime({ world, focusData, eventsData, peopleData, focusId, random });

describe('growing up', () => {
  beforeEach(() => newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } }));

  it('starts at birth as a baby', () => {
    expect(playerAge(world)).toBe(0);
    expect(playerStage(world)).toBe('baby');
    expect(chapterOf(world).realMinutesPerDay).toBe(world.chapters.baby.realMinutesPerDay);
  });

  it('knows the stages of life', () => {
    expect([0, 2, 3, 12, 13, 19, 20, 59, 60, 90].map(stageForAge))
      .toEqual(['baby', 'baby', 'child', 'child', 'teen', 'teen', 'adult', 'adult', 'elder', 'elder']);
  });

  it('a baby can only choose baby things to focus on', () => {
    expect(focusChoices(focusData, world).map(f => f.id)).toEqual(['explore', 'cuddles', 'noise']);
  });

  it('time jumps move the calendar on and can change your stage of life', () => {
    let result;
    for (let i = 0; i < 12 && playerStage(world) === 'baby'; i++) result = jump('explore');
    expect(playerStage(world)).toBe('child');
    expect(result.stageAfter).toBe('child');
    expect(result.lines.some(l => l.includes('not a baby'))).toBe(true);
    expect(state.journal.some(j => j.text.startsWith('Turned'))).toBe(true);
  });

  it('a focus shapes who you become', () => {
    jump('explore');
    jump('explore');
    expect(state.traits.curious).toBe(2);
    expect(topTraits(1)).toEqual(['curious']);
  });

  it('focusing on family brings you closer to the family you know', () => {
    personRecord('mum').met = true;
    jump('cuddles');
    expect(personRecord('mum').bond).toBe(2);
    expect(personRecord('nico').bond).toBe(0); // not family, and not met
  });

  it('the same random numbers give the same life', () => {
    const run = () => {
      newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } });
      const random = seeded(7);
      const lines = [];
      for (let i = 0; i < 20 && !state.dead; i++) lines.push(...jump(i < 9 ? 'explore' : 'friends', random).lines);
      return JSON.stringify({ lines, money: state.money, needs: state.needs });
    };
    expect(run()).toBe(run());
  });
});

describe('life is uncertain', () => {
  it('small children never die from accidents, and the young rarely do', () => {
    expect(deathChance(2, 100, 150)).toBe(0);
    expect(deathChance(8, 100, 150)).toBeLessThan(0.001);
  });

  it('old age and poor health make the end likelier', () => {
    expect(deathChance(80, 100, 200)).toBeGreaterThan(deathChance(60, 100, 200));
    expect(deathChance(30, 10, 80)).toBeGreaterThan(deathChance(30, 100, 80));
  });

  it('focus changes the odds of events', () => {
    const brokenArm = eventsData.events.find(e => e.id === 'broken-arm');
    expect(eventChance(brokenArm, 'outside', 100)).toBeGreaterThan(eventChance(brokenArm, 'school', 100));
  });

  it('a long life eventually ends', () => {
    newLife(world, { name: 'Old', look: { body: 'boy', skin: '#8d5a3b' } });
    state.clock.year = 95; // ninety-something years old
    const random = seeded(3);
    let died = null;
    for (let i = 0; i < 40 && !died; i++) died = jump('rest', random).died;
    expect(died).not.toBe(null);
    expect(state.dead.cause.length).toBeGreaterThan(0);
  });
});

describe('wellbeing', () => {
  beforeEach(() => newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } }));

  it('a whole day wears you out, but never below zero', () => {
    drainEnergy((world.day.sleepHour - world.day.wakeHour) * 60, world);
    expect(state.needs.energy).toBe(25);
    changeNeed('energy', -500);
    expect(state.needs.energy).toBe(0);
  });

  it('sleeping through a jump restores energy', () => {
    state.needs.energy = 10;
    jump('explore');
    expect(state.needs.energy).toBe(100);
  });
});

describe('schedules', () => {
  const mum = peopleData.people.find(p => p.id === 'mum');
  const nico = peopleData.people.find(p => p.id === 'nico');

  it('people are where their schedule says', () => {
    expect(scheduleNow(mum, 7 * 60).place).toBe('home');
    expect(scheduleNow(mum, 12 * 60).place).toBe(null); // at work
    expect(scheduleNow(mum, 18 * 60).place).toBe('home');
  });

  it('children only appear once they are old enough', () => {
    const early = createClock(world, { year: 2, day: 1, minutes: 10 * 60 });
    const later = createClock(world, { year: 8, day: 1, minutes: 10 * 60 });
    expect(isPresent(nico, 'lane', early, world)).toBe(false);
    expect(isPresent(nico, 'lane', later, world)).toBe(true);
  });

  it('everyone has a schedule that starts at midnight', () => {
    peopleData.people.forEach(p => expect(p.schedule[0].from).toBe(0));
  });
});

describe('conversations by age', () => {
  beforeEach(() => newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } }));

  it('babies get baby conversations, children get the others', () => {
    const mum = peopleData.people.find(p => p.id === 'mum');
    expect(pickConversation(mum, conversationsData.conversations).id).toBe('mum-baby-morning');
    state.clock.year += 6; // six years later
    expect(pickConversation(mum, conversationsData.conversations).id).toBe('mum-first');
  });

  it('choices can shape personality and be remembered', () => {
    applyEffects({ traits: { kind: 2 }, remember: 'Helped {name} up' }, null);
    expect(state.traits.kind).toBe(2);
    expect(conditionsMet({ trait: 'kind' })).toBe(true);
    expect(state.journal.at(-1).text).toBe('Helped Ari up');
  });

  it('every conversation a person lists exists', () => {
    const ids = new Set(conversationsData.conversations.map(c => c.id));
    peopleData.people.forEach(p => p.conversations.forEach(id => expect(ids.has(id)).toBe(true)));
  });

  it('a year is the length the calendar says', () => {
    expect(daysPerYear(world)).toBe(120);
  });
});
