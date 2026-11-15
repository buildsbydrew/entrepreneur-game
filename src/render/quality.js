// Picture quality: Low for cheap phones, Medium, and High for good computers.
// The game picks one to start with, and the player can change it in the pause menu.

export const QUALITY = {
  low: { label: 'Low', pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false },
  medium: { label: 'Medium', pixelRatio: 1.5, shadows: true, shadowSize: 1024, antialias: true },
  high: { label: 'High', pixelRatio: 2, shadows: true, shadowSize: 2048, antialias: true }
};

const KEY = 'lifegame.quality';

// A first guess: phones and small-memory devices start lower
export function guessQuality() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const memory = navigator.deviceMemory ?? 8;
  if (memory <= 2) return 'low';
  if (touch || memory <= 4) return 'medium';
  return 'high';
}

export function loadQuality() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && QUALITY[saved]) return saved;
  } catch (error) { /* storage blocked */ }
  return guessQuality();
}

export function saveQuality(level) {
  try { localStorage.setItem(KEY, level); } catch (error) { /* storage blocked */ }
}
