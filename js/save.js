// Saving and loading the game in the browser's own storage. No drawing happens here.
// The game saves each morning, and when a new game begins. A save from an older version of the
// game, or one that has been damaged, is ignored instead of crashing anything.
import { exportState } from './state.js';

const STORAGE_KEY = 'marketgame.save';
const VERSION = 1;

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasNumbers = (object, keys) => keys.every(key => Number.isFinite(object[key]));
const hasObjects = (object, keys) => keys.every(key => isObject(object[key]));
const hasArrays = (object, keys) => keys.every(key => Array.isArray(object[key]));

// Is this save complete enough to play from, and does it match the items in the game?
function isValid(data, setting) {
  if (!isObject(data) || data.version !== VERSION) return false;

  const { profile, state } = data;
  if (!isObject(profile) || typeof profile.stallName !== 'string' || !isObject(profile.look)) return false;
  if (!isObject(state)) return false;

  if (!hasNumbers(state, ['day', 'cash', 'level', 'priceChanges'])) return false;
  if (!hasObjects(state, ['stock', 'batches', 'prices', 'notebook', 'today'])) return false;
  if (!hasArrays(state, ['beatsSeen', 'missionsDone', 'levelsDone'])) return false;
  if (!hasArrays(state.notebook, ['unlocked']) || !isObject(state.notebook.evidence)) return false;

  const today = state.today;
  if (!hasObjects(today, ['asked', 'soldBy', 'missedNoStock', 'pricedOut', 'spoiled'])) return false;
  if (!hasNumbers(today, ['revenue', 'spent', 'served', 'lost', 'spoiledCost', 'cogs'])) return false;

  return setting.items.every(item => Number.isFinite(state.stock[item.id]) && Array.isArray(state.batches[item.id]));
}

// Returns true if the game was saved. Private browsing can block storage, and then it returns false.
export function saveGame(profile) {
  try {
    const data = {
      version: VERSION,
      savedAt: Date.now(),
      profile: { stallName: profile.stallName, look: profile.look },
      state: exportState()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

// The saved game, or null if there isn't one that can be played
export function loadGame(setting) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isValid(data, setting) ? data : null;
  } catch (error) {
    return null;
  }
}

// One line to show on the Continue button, such as "Day 3 · Level 2 · GH₵120 · Ama's Corner"
export function describeSave(save, setting) {
  const { day, level, cash } = save.state;
  return `Day ${day} \u00B7 Level ${level} \u00B7 ${setting.currencySymbol}${cash} \u00B7 ${save.profile.stallName}`;
}
