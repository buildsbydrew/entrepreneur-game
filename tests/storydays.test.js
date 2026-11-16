// Checks for big days: time jumps stop at them, goals tick off, moments happen once, things you carry.
import { describe, it, expect, beforeEach } from 'vitest';
import world from '../src/data/world.json';
import storyData from '../src/data/storydays.json';
import conversations from '../src/data/conversations.json';
import { state, newLife, giveItem } from '../src/core/state.js';
import { createClock } from '../src/core/clock.js';
import { nextBigDay, jumpLength, beginBigDay, todaysBigDay, endBigDay, goalStatus, dueMoments, daysUntilAge, markTalksAtStart } from '../src/story/storyDays.js';
import { pickConversation, applyEffects, fillText } from '../src/story/conversation.js';
import { scheduleNow, setTodaySchedules } from '../src/core/schedule.js';

// A five-year-old on the morning the game starts, like after the prologue
function startAtFive() {
  newLife(world, { name: 'Ari', look: { body: 'girl', skin: '#8d5a3b' } });
  state.life.birth = { year: 1, day: 70 };
  state.clock = createClock(world, { year: 6, day: 72 });
}

describe('big days', () => {
  beforeEach(startAtFive);

  it('works out how far away an age is', () => {
    expect(daysUntilAge(state.life.birth, state.clock, 5, 2, world)).toBe(0);
    expect(daysUntilAge(state.life.birth, state.clock, 6, 0, world)).toBe(118);
  });

  it('finds the first day out as due today, then the first school day', () => {
    const next = nextBigDay(storyData, world);
    expect(next.day.id).toBe('first-day-out');
    expect(next.days).toBe(0);
    beginBigDay(next.day);
    expect(nextBigDay(storyData, world).day.id).toBe('first-school-day');
  });

  it('stops a time jump at the next big day', () => {
    beginBigDay(storyData.days[0]);
    const jump = jumpLength(150, storyData, world);
    expect(jump.bigDay.id).toBe('first-school-day');
    expect(jump.days).toBe(daysUntilAge(state.life.birth, state.clock, 5, 40, world));
    expect(jump.days).toBeLessThanOrEqual(150);
  });

  it('ticks off goals and keeps them ticked', () => {
    const day = storyData.days[0];
    beginBigDay(day);
    markTalksAtStart(['mum']);
    expect(goalStatus(day, { place: 'home', hour: 7 }).every(g => !g.done)).toBe(true);
    expect(goalStatus(day, { place: 'lane', hour: 9 }).find(g => g.id === 'out').done).toBe(true);
    expect(goalStatus(day, { place: 'home', hour: 9 }).find(g => g.id === 'out').done).toBe(true);
    state.people.mum = { bond: 0, met: true, talks: 1 };
    expect(goalStatus(day, { place: 'home', hour: 9 }).find(g => g.id === 'morning').done).toBe(true);
  });

  it('plays each moment once, at the right time and place', () => {
    const day = storyData.days[0];
    beginBigDay(day);
    expect(dueMoments(day, { place: 'lane', hour: 12 })).toHaveLength(0);
    expect(dueMoments(day, { place: 'lane', hour: 17.5 }).map(m => m.id)).toEqual(['coat-appears']);
    expect(dueMoments(day, { place: 'lane', hour: 17.6 })).toHaveLength(0);
    expect(todaysBigDay(storyData).id).toBe('first-day-out');
    expect(endBigDay(storyData).line).toMatch(/Corin/);
    expect(todaysBigDay(storyData)).toBe(null);
  });
});

describe('things you carry, in conversations', () => {
  beforeEach(startAtFive);

  it('Mr Ambrose only reads the note on the day you bring it', () => {
    const ambrose = { id: 'ambrose', conversations: ['ambrose-tab'] };
    expect(pickConversation(ambrose, conversations.conversations)).toBe(null);
    beginBigDay(storyData.days.find(d => d.id === 'the-tab'));
    expect(pickConversation(ambrose, conversations.conversations)).toBe(null); // no note yet
    giveItem('mums-note');
    expect(pickConversation(ambrose, conversations.conversations).id).toBe('ambrose-tab');
    applyEffects({ take: 'mums-note' });
    expect(state.items).not.toContain('mums-note');
  });
});

describe('the night the baby came', () => {
  beforeEach(startAtFive);

  it('Gran only gives the news after the knock at the door, and you choose the name', () => {
    const gran = { id: 'gran', conversations: ['gran-waiting', 'gran-baby-born-girl', 'gran-baby-born-boy'] };
    beginBigDay(storyData.days.find(d => d.id === 'the-baby'));
    state.flags['sibling-girl'] = true;
    expect(pickConversation(gran, conversations.conversations).id).toBe('gran-waiting');
    state.flags['talked:gran-waiting'] = true;
    expect(pickConversation(gran, conversations.conversations)).toBe(null); // not before Corin has been
    state.flags['corin-came'] = true;
    const news = pickConversation(gran, conversations.conversations);
    expect(news.id).toBe('gran-baby-born-girl');
    applyEffects(news.nodes.a.choices[1].effects);
    expect(state.life.sibling.name).toBe('Tali');
    expect(fillText('Hello, {sibling}!')).toBe('Hello, Tali!');
  });

  it('people can be somewhere else on a big day', () => {
    const day = storyData.days.find(d => d.id === 'first-school-day');
    const nico = { id: 'nico', schedule: [{ from: 0, place: 'lane' }] };
    setTodaySchedules(day.schedules);
    expect(scheduleNow(nico, 9 * 60).place).toBe('school');
    setTodaySchedules(null);
    expect(scheduleNow(nico, 9 * 60).place).toBe('lane');
  });
});
