// Plays the sound effects, the background music and the market sounds, using the browser's
// built-in audio. Everything is made in code. Browsers only allow sound after the player has
// clicked or pressed a key, so the audio wakes up on the first of those.
import { SFX } from './sounds.js';
import { buildPhrase, midiToHz, STEPS_PER_BAR, TEMPO } from './music.js';

const STORAGE_KEY = 'marketgame.sound.v2';
const MASTER_LEVEL = 0.8;
const MUSIC_LEVEL = 0.26;
const SFX_LEVEL = 0.9;
const AMBIENCE_LEVEL = 0.7;
const DUCKED = 0.35; // how quiet the music and market sounds get while the game is paused
const VOICE_GAIN = 0.9;

// What the player has switched on. "sound" is the master switch.
const DEFAULTS = { sound: true, music: true, ambience: true };

let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let ambienceBus = null;
let noiseBuffer = null;

let settings = readSettings();
let wantMusic = false;
let wantAmbience = false;
let ducked = false;

let musicTimer = null;
let phrase = null;
let barIndex = 0;
let nextBarTime = 0;
let ambience = null;

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULTS, ...saved };
  } catch (error) {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Private browsing can block storage. The choice just won't be remembered.
  }
}

const levelOf = {
  master: () => (settings.sound ? MASTER_LEVEL : 0),
  music: () => (settings.music ? MUSIC_LEVEL * (ducked ? DUCKED : 1) : 0),
  ambience: () => (settings.ambience ? AMBIENCE_LEVEL * (ducked ? DUCKED : 1) : 0)
};

function ensureContext() {
  if (ctx) return ctx;

  const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioContextClass) return null;

  ctx = new AudioContextClass();

  const limiter = ctx.createDynamicsCompressor(); // keeps loud moments from clipping
  master = ctx.createGain();
  master.gain.value = levelOf.master();
  musicBus = ctx.createGain();
  musicBus.gain.value = levelOf.music();
  sfxBus = ctx.createGain();
  sfxBus.gain.value = SFX_LEVEL;
  ambienceBus = ctx.createGain();
  ambienceBus.gain.value = levelOf.ambience();

  [musicBus, sfxBus, ambienceBus].forEach(bus => bus.connect(master));
  master.connect(limiter);
  limiter.connect(ctx.destination);
  return ctx;
}

// Moves the volume controls to match the settings
function applyLevels() {
  if (!ctx) return;
  const now = ctx.currentTime;
  master.gain.setTargetAtTime(levelOf.master(), now, 0.05);
  musicBus.gain.setTargetAtTime(levelOf.music(), now, 0.1);
  ambienceBus.gain.setTargetAtTime(levelOf.ambience(), now, 0.1);
}

// A couple of seconds of random noise, used for footsteps and shakers
function getNoise() {
  if (noiseBuffer) return noiseBuffer;

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// Plays one note of a recipe (see sounds.js) through a volume bus
function playNote(note, when, bus) {
  const start = when + note.at;
  const end = start + note.len;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(note.gain, start + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  envelope.connect(bus);

  if (note.noise) {
    const source = ctx.createBufferSource();
    source.buffer = getNoise();
    const filter = ctx.createBiquadFilter();
    filter.type = note.filter;
    filter.frequency.value = note.hz;
    filter.Q.value = note.q;
    source.connect(filter);
    filter.connect(envelope);
    source.start(start, Math.random(), note.len + 0.05);
  } else {
    const oscillator = ctx.createOscillator();
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.hz, start);
    if (note.glide) oscillator.frequency.exponentialRampToValueAtTime(note.glide, end);
    oscillator.connect(envelope);
    oscillator.start(start);
    oscillator.stop(end + 0.05);
  }
}

// ---------- Sound effects ----------

export function play(name) {
  if (!ctx || ctx.state !== 'running' || !settings.sound) return;

  const recipe = SFX[name];
  if (!recipe) return;
  recipe.forEach(note => playNote(note, ctx.currentTime, sfxBus));
}

// ---------- Music ----------

// One note of the music. Each voice is built from the same kinds of note as the effects.
function playMusicEvent(event, when) {
  if (event.voice === 'pluck') {
    const hz = midiToHz(event.midi);
    playNote({ type: 'triangle', hz, at: 0, len: 0.55, gain: event.gain }, when, musicBus);
    playNote({ type: 'sine', hz: hz * 2, at: 0, len: 0.35, gain: event.gain * 0.3 }, when, musicBus);
  } else if (event.voice === 'bass') {
    playNote({ type: 'sine', hz: midiToHz(event.midi), at: 0, len: 0.5, gain: event.gain }, when, musicBus);
  } else if (event.voice === 'shaker') {
    playNote({ noise: true, filter: 'highpass', hz: 6500, q: 1, at: 0, len: 0.05, gain: event.gain }, when, musicBus);
  } else if (event.voice === 'wood') {
    playNote({ type: 'sine', hz: 1250, glide: 900, at: 0, len: 0.05, gain: event.gain }, when, musicBus);
  }
}

// Called a few times a second. It books the next bars of music a little ahead of time.
function scheduleMusic() {
  if (!ctx) return;

  const stepLength = 60 / TEMPO / 4;
  while (nextBarTime < ctx.currentTime + 0.5) {
    phrase.bars[barIndex % phrase.bars.length].forEach(event => {
      playMusicEvent(event, nextBarTime + event.step * stepLength);
    });
    nextBarTime += STEPS_PER_BAR * stepLength;
    barIndex += 1;
    if (barIndex % (phrase.bars.length * 4) === 0) phrase = buildPhrase(); // a fresh variation
  }
}

function beginMusic() {
  if (musicTimer) return;
  phrase = buildPhrase();
  barIndex = 0;
  nextBarTime = ctx.currentTime + 0.2;
  musicTimer = setInterval(scheduleMusic, 120);
}

export function startMusic() {
  wantMusic = true;
  if (ctx && ctx.state === 'running') beginMusic();
}

// ---------- The market sounds ----------
// Distant voices and the odd bird. There is no constant hiss, so it stays gentle.

// The two main pitches of a few vowels, which is what makes a buzz sound like a voice
const VOWELS = [[700, 1100], [500, 900], [530, 1840], [400, 800], [660, 1700]];

// Someone talking in the distance: a few short sounds in a row, from somewhere to the left or right
function murmur() {
  const voice = ctx.createGain();
  if (ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    voice.connect(panner);
    panner.connect(ambienceBus);
  } else {
    voice.connect(ambienceBus);
  }

  const pitch = 95 + Math.random() * 150; // lower voices and higher ones
  const syllables = 2 + Math.floor(Math.random() * 3);
  let time = ctx.currentTime + 0.02;

  for (let i = 0; i < syllables; i++) {
    const [first, second] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const length = 0.1 + Math.random() * 0.12;

    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(pitch * (0.92 + Math.random() * 0.2), time);
    buzz.frequency.linearRampToValueAtTime(pitch * (0.85 + Math.random() * 0.2), time + length);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(VOICE_GAIN, time + 0.03);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + length);
    envelope.connect(voice);

    [first, second].forEach(hz => {
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = hz * (0.95 + Math.random() * 0.1);
      formant.Q.value = 5;
      buzz.connect(formant);
      formant.connect(envelope);
    });

    buzz.start(time);
    buzz.stop(time + length + 0.05);
    time += length + 0.03 + Math.random() * 0.08;
  }
}

// A bird somewhere, with a few quick chirps
function bird() {
  const chirps = 2 + Math.floor(Math.random() * 3);
  const base = 2300 + Math.random() * 800;
  for (let i = 0; i < chirps; i++) {
    playNote({ type: 'sine', hz: base, glide: base * 1.35, at: i * 0.13, len: 0.08, gain: 0.05 }, ctx.currentTime, ambienceBus);
  }
}

function beginAmbience() {
  if (ambience) return;

  ambience = {
    murmurs: setInterval(() => {
      if (settings.ambience && Math.random() < 0.6) murmur();
    }, 1100),
    birds: setInterval(() => {
      if (settings.ambience && Math.random() < 0.6) bird();
    }, 9000)
  };
}

export function startAmbience() {
  wantAmbience = true;
  if (ctx && ctx.state === 'running') beginAmbience();
}

export function stopAmbience() {
  wantAmbience = false;
  if (!ambience) return;

  clearInterval(ambience.murmurs);
  clearInterval(ambience.birds);
  ambience = null;
}

// ---------- Settings ----------

// Quietens the music and market sounds while the game is paused
export function setDuck(on) {
  ducked = on;
  applyLevels();
}

export const getSoundSettings = () => ({ ...settings });
export const isMuted = () => !settings.sound;

// key is 'sound' (everything), 'music' or 'ambience' (the market sounds)
export function setSoundSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = Boolean(value);
  saveSettings();
  applyLevels();
}

// Browsers keep sound switched off until the player clicks or presses a key
function unlock() {
  const context = ensureContext();
  if (!context) return;

  context.resume().then(() => {
    if (wantMusic) beginMusic();
    if (wantAmbience) beginAmbience();
    applyLevels();
  });
}

// Call once when the page loads
export function initAudio() {
  ['pointerdown', 'keydown', 'touchend'].forEach(type => window.addEventListener(type, unlock));

  // The soft click on every button
  document.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('button');
    if (button && !button.hasAttribute('data-silent')) play('ui');
  }, true);

  // Stop the sound when the tab is hidden, and carry on when it comes back
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
}
