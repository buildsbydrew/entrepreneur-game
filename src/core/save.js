// Saving and loading, in the browser's own storage (and later the phone app's).
// The game saves often: every few seconds, when you move between places, when a new day starts,
// and the moment the game is hidden or closed (phones close apps without warning).
// A save from another version, or a damaged one, is ignored instead of crashing anything.
import { exportState } from './state.js';

const STORAGE_KEY = 'lifegame.save';
export const VERSION = 2; // 2: wellbeing, skills, personality and the life journal were added

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNumber = Number.isFinite;

// Is this save complete enough to play from?
export function isValid(data) {
  if (!isObject(data) || data.version !== VERSION || !isObject(data.state)) return false;
  const s = data.state;
  if (!isObject(s.life) || typeof s.life.name !== 'string' || !isObject(s.life.look) || !isObject(s.life.birth)) return false;
  if (!isObject(s.clock) || ![s.clock.year, s.clock.day, s.clock.minutes].every(isNumber)) return false;
  if (!isNumber(s.money) || typeof s.place !== 'string') return false;
  if (s.player !== null && !(isObject(s.player) && isNumber(s.player.x) && isNumber(s.player.z))) return false;
  if (!isObject(s.needs) || !['energy', 'health', 'happiness'].every(k => isNumber(s.needs[k]))) return false;
  if (!isObject(s.skills) || !isObject(s.traits) || !Array.isArray(s.journal)) return false;
  return isObject(s.people) && isObject(s.flags);
}

// storage can be swapped out in tests
export function saveGame(storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, savedAt: Date.now(), state: exportState() }));
    return true;
  } catch (error) {
    return false; // private browsing can block storage
  }
}

export function loadGame(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    return isValid(data) ? data : null;
  } catch (error) {
    return null;
  }
}

export function deleteSave(storage = globalThis.localStorage) {
  try { storage.removeItem(STORAGE_KEY); } catch (error) { /* nothing to do */ }
}
