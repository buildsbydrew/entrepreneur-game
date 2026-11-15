// The rules of a life: growing up, wellbeing, skills, personality, remembering moments, and what happens
// while time jumps forward. No drawing happens here, so it can be tested on its own.
import { state, personRecord } from './state.js';
import { ageOf, nextMorning } from './clock.js';

// ---------- Growing up ----------

export const STAGE_ORDER = ['baby', 'child', 'teen', 'adult', 'elder'];

export function stageForAge(age) {
  if (age < 3) return 'baby';
  if (age < 13) return 'child';
  if (age < 20) return 'teen';
  if (age < 60) return 'adult';
  return 'elder';
}

export function playerAge(world) {
  return ageOf(state.life.birth, state.clock, world);
}

export function playerStage(world) {
  return stageForAge(playerAge(world));
}

// Someone else's age and stage, from their birth date in people.json
export function personAge(person, clock, world) {
  return ageOf(person.born, clock, world);
}

// How long a played day lasts and how far time jumps after it, for the player's stage of life
export function chapterOf(world) {
  return world.chapters[playerStage(world)];
}

// ---------- Wellbeing ----------

export const NEEDS = ['energy', 'health', 'happiness'];
const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function changeNeed(name, amount) {
  state.needs[name] = clamp(state.needs[name] + amount);
  return state.needs[name];
}

export function addSkill(id, amount) {
  state.skills[id] = Math.max(0, (state.skills[id] ?? 0) + amount);
}

export function addTrait(id, amount) {
  state.traits[id] = (state.traits[id] ?? 0) + amount;
}

// The player's strongest personality traits, strongest first
export function topTraits(count = 2) {
  return Object.entries(state.traits)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([id]) => id);
}

// ---------- Remembering ----------

export function remember(text, world) {
  state.journal.push({ year: state.clock.year, day: state.clock.day, age: playerAge(world), text });
}

// ---------- Time jumps ----------

// What the player can choose to focus on, for their stage of life
export function focusChoices(focusData, world) {
  const stage = playerStage(world);
  return focusData.focuses.filter(f => f.stages.includes(stage));
}

// Applies the "effects" object used by focuses and life events.
// { needs: { health: -10 }, money: 5, skills: { study: 2 }, traits: { kind: 1 }, bondTag: { family: 2 } }
export function applyLifeEffects(effects, peopleData) {
  if (!effects) return;
  Object.entries(effects.needs ?? {}).forEach(([k, v]) => changeNeed(k, v));
  if (effects.money) state.money = Math.max(0, state.money + effects.money);
  Object.entries(effects.skills ?? {}).forEach(([k, v]) => addSkill(k, v));
  Object.entries(effects.traits ?? {}).forEach(([k, v]) => addTrait(k, v));
  Object.entries(effects.bondTag ?? {}).forEach(([tag, v]) => {
    peopleData.people.filter(p => (p.tags ?? []).includes(tag) && state.people[p.id]?.met).forEach(p => { personRecord(p.id).bond += v; });
  });
}

// Does a life event apply to the player right now?
function eventFits(event, age, stage) {
  if (event.stages && !event.stages.includes(stage)) return false;
  if (event.minAge !== undefined && age < event.minAge) return false;
  if (event.maxAge !== undefined && age > event.maxAge) return false;
  if (event.once && state.flags[`event:${event.id}`]) return false;
  return true;
}

// The chance of an event during a jump: its base chance, made more or less likely by what the
// player focused on, by their health, and by how long the jump is
export function eventChance(event, focusId, days) {
  let chance = event.chance;
  if (event.focus?.[focusId]) chance *= event.focus[focusId];
  if (event.worseWhenUnwell) chance *= 1 + (100 - state.needs.health) / 50;
  return Math.min(0.95, chance * (days / 100));
}

// The chance that a life ends during a jump. Very small when young and healthy, growing with age
// and poor health. It is never zero: life is uncertain.
export function deathChance(age, health, days) {
  const base = age >= 5 ? 0.0002 : 0;                    // accidents can happen to anyone, but never to a small child
  const ageRisk = age > 55 ? Math.pow((age - 55) / 30, 3) * 0.25 : 0;
  const healthRisk = health < 40 ? (40 - health) / 40 * 0.15 : 0;
  return Math.min(0.9, (base + ageRisk + healthRisk) * (days / 100));
}

// Moves time forward after a played day, living out the stretch in between according to the chosen
// focus. random: a function returning 0..1 (so tests can be repeated). Returns what happened, for the
// "time passes" screen: { days, lines, ageBefore, ageAfter, stageBefore, stageAfter, died }.
export function jumpTime({ world, focusData, eventsData, peopleData, focusId, random = Math.random, days: forcedDays }) {
  const ageBefore = playerAge(world);
  const stageBefore = stageForAge(ageBefore);
  const days = forcedDays ?? world.chapters[stageBefore].jumpDays;
  const lines = [];

  // The focus shapes the stretch
  const focus = focusData.focuses.find(f => f.id === focusId);
  if (focus) {
    applyLifeEffects(focus.effects, peopleData);
    if (focus.summary) lines.push(focus.summary);
    state.focus = focusId;
  }

  // Life events: illness, accidents, lucky breaks
  for (const event of eventsData.events) {
    if (event.kind === 'death' || !eventFits(event, ageBefore, stageBefore)) continue;
    if (random() < eventChance(event, focusId, days)) {
      applyLifeEffects(event.effects, peopleData);
      lines.push(event.text);
      state.flags[`event:${event.id}`] = true;
      if (event.remember) remember(event.text, world);
    }
  }

  // Bodies recover over time, unless something is wrong
  changeNeed('health', Math.min(20, days / 8));
  state.needs.energy = 100;

  // Time moves on
  nextMorning(state.clock, world, days);
  const ageAfter = playerAge(world);
  const stageAfter = stageForAge(ageAfter);
  if (stageAfter !== stageBefore) {
    lines.push(world.stageNames?.[stageAfter] ?? `You are growing up.`);
    remember(`Turned ${ageAfter}.`, world);
  } else if (ageAfter > ageBefore) {
    lines.push(`You turned ${ageAfter}.`);
  }

  // Sometimes, a life ends
  let died = null;
  if (random() < deathChance(ageAfter, state.needs.health, days)) {
    const causes = eventsData.events.filter(e => e.kind === 'death' && eventFits(e, ageAfter, stageAfter));
    const cause = causes.length ? causes[Math.floor(random() * causes.length)] : { text: 'Your life came to a quiet end.' };
    died = { cause: cause.text, age: ageAfter };
    state.dead = died;
    remember(cause.text, world);
  }

  return { days, lines, ageBefore, ageAfter, stageBefore, stageAfter, died };
}

// Energy drains through a played day, and low energy slows you down
export function drainEnergy(minutesPassed, world) {
  const dayMinutes = (world.day.sleepHour - world.day.wakeHour) * 60;
  changeNeed('energy', -(minutesPassed / dayMinutes) * 75);
}
