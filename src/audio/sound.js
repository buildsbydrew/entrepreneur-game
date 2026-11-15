// All of the game's sound, made in code with the browser's Web Audio (no sound files):
// short effects, gentle music that follows the time of day, and outdoor ambience
// (birds by day, crickets at night). There is no background chatter.
// Browsers only allow sound after the player clicks or presses a key, so everything waits for that.
// The settings (effects, music, ambience) live only in the pause menu.

const KEY = 'lifegame.sound';
const settings = { sfx: true, music: true, ambience: true, voices: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) ?? {}); } catch (error) { /* storage blocked */ }

let ctx = null;
let master;
let sfxBus;
let musicBus;
let ambienceBus;
let voiceBus;   // people speaking Urlivani (src/audio/voice.js)
let noise; // a second of white noise, reused for footsteps, whooshes and birds' breath

export function soundSettings() {
  return { ...settings };
}

export function setSound(kind, on) {
  settings[kind] = on;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (error) { /* storage blocked */ }
  applyVolumes();
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(settings.sfx ? 0.9 : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? 0.32 : 0, t, 0.3);
  ambienceBus.gain.setTargetAtTime(settings.ambience ? ambienceLevel : 0, t, 0.5);
  voiceBus.gain.setTargetAtTime(settings.voices ? 0.85 : 0, t, 0.05);
}

// Where voices are played, once sound has woken up (null before the first click or key press)
export function voiceOutput() {
  return ctx ? { ctx, bus: voiceBus, noise } : null;
}

// Wakes the sound up on the first click, tap or key press
export function initAudio() {
  const wake = () => {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      ambienceBus = ctx.createGain();
      voiceBus = ctx.createGain();
      [sfxBus, musicBus, ambienceBus, voiceBus].forEach(bus => { bus.gain.value = 0; bus.connect(master); });
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      applyVolumes();
      startSchedulers();
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(type => addEventListener(type, wake, { passive: true }));
}

// ---------- Small building blocks ----------

function tone({ freq, type = 'sine', start = 0, dur = 0.2, gain = 0.1, attack = 0.005, slideTo = null, bus = sfxBus }) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function hiss({ start = 0, dur = 0.08, gain = 0.05, filter = 'lowpass', freq = 900, q = 0.8, sweepTo = null, bus = sfxBus }) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// ---------- Effects ----------

// surface: 'ground' (soft and dull) or 'floor' (indoors: a little tap)
export function footstep(surface = 'ground', light = false) {
  const g = light ? 0.025 : 0.045;
  if (surface === 'floor') {
    hiss({ dur: 0.05, gain: g, filter: 'bandpass', freq: 1800 + Math.random() * 400, q: 1.5 });
    tone({ freq: 140 + Math.random() * 30, dur: 0.05, gain: g * 0.8 });
  } else {
    hiss({ dur: 0.09, gain: g * 1.2, filter: 'lowpass', freq: 650 + Math.random() * 300 });
  }
}

// A voice "blip" for a character speaking; each person gets their own pitch
export function talkBlip(pitch = 1) {
  tone({ freq: 220 * pitch * (0.92 + Math.random() * 0.16), type: 'triangle', dur: 0.07, gain: 0.03 });
}

const RECIPES = {
  click: () => tone({ freq: 880, dur: 0.06, gain: 0.05 }),
  choose: () => { tone({ freq: 660, dur: 0.08, gain: 0.05 }); tone({ freq: 990, start: 0.06, dur: 0.12, gain: 0.05 }); },
  coin: () => { tone({ freq: 988, dur: 0.12, gain: 0.06 }); tone({ freq: 1319, start: 0.08, dur: 0.3, gain: 0.06 }); },
  spend: () => { tone({ freq: 784, dur: 0.1, gain: 0.05 }); tone({ freq: 587, start: 0.08, dur: 0.18, gain: 0.05 }); },
  warm: () => { tone({ freq: 523, dur: 0.25, gain: 0.04 }); tone({ freq: 659, start: 0.1, dur: 0.3, gain: 0.04 }); },
  cold: () => tone({ freq: 330, dur: 0.3, gain: 0.04, slideTo: 260 }),
  whoosh: () => hiss({ dur: 0.45, gain: 0.07, filter: 'bandpass', freq: 400, sweepTo: 2200, q: 1.2 }),
  door: () => { tone({ freq: 180, type: 'triangle', dur: 0.12, gain: 0.05 }); hiss({ start: 0.02, dur: 0.12, gain: 0.03, freq: 1200 }); },
  morning: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, start: i * 0.14, dur: 0.6, gain: 0.04 })),
  sleep: () => [784, 659, 523, 392].forEach((f, i) => tone({ freq: f, start: i * 0.22, dur: 0.8, gain: 0.035 })),
  page: () => hiss({ dur: 0.18, gain: 0.04, filter: 'highpass', freq: 2500, sweepTo: 5000 }),
  event: () => { tone({ freq: 440, dur: 0.5, gain: 0.04 }); tone({ freq: 554, start: 0.15, dur: 0.6, gain: 0.03 }); },
  grow: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, start: i * 0.1, dur: 0.5, gain: 0.04 })),
  end: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, start: i * 0.5, dur: 1.6, gain: 0.04 })),
  error: () => tone({ freq: 200, type: 'triangle', dur: 0.15, gain: 0.05 })
};

export function play(name) {
  RECIPES[name]?.();
}

// ---------- Music: soft and slow, following the time of day ----------

const SCALE = [0, 2, 4, 7, 9]; // a gentle five-note scale
const CHORDS = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]]; // I, vi, IV, V
let mood = { night: false, minutes: 360 };
let beat = 0;
let nextBeatTime = 0;

export function setMusicTime(minutes) {
  mood.minutes = minutes;
  mood.night = minutes < 6 * 60 || minutes >= 19.5 * 60;
}

function note(semitone, root = 60) {
  return 440 * Math.pow(2, (root + semitone - 69) / 12);
}

function scheduleMusic() {
  const beatLen = mood.night ? 0.62 : 0.46;
  while (nextBeatTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(beat / 8) % CHORDS.length;
    const step = beat % 8;
    const t = nextBeatTime - ctx.currentTime;
    const root = mood.night ? 55 : 60;
    if (step === 0) {
      // a soft chord at the start of each bar
      CHORDS[bar].forEach(n => tone({ freq: note(n - 12, root), type: 'triangle', start: Math.max(0, t), dur: beatLen * 7, gain: 0.018, attack: 0.4, bus: musicBus }));
      tone({ freq: note(CHORDS[bar][0] - 24, root), start: Math.max(0, t), dur: beatLen * 3, gain: 0.03, attack: 0.05, bus: musicBus });
    }
    // a light plucked melody, sparser at night
    const playChance = mood.night ? 0.28 : 0.55;
    if (step % 2 === 0 && Math.random() < playChance) {
      const s = SCALE[Math.floor(Math.random() * SCALE.length)] + (Math.random() < 0.3 ? 12 : 0);
      tone({ freq: note(s, root), start: Math.max(0, t), dur: beatLen * 1.6, gain: mood.night ? 0.02 : 0.03, bus: musicBus });
    }
    beat += 1;
    nextBeatTime += beatLen;
  }
}

// ---------- Ambience: birds by day, crickets at night ----------

let ambienceLevel = 0.5;
let nextAmbience = 0;

// Indoors the world outside is muffled
export function setIndoors(inside) {
  ambienceLevel = inside ? 0.18 : 0.5;
  applyVolumes();
}

function scheduleAmbience() {
  if (ctx.currentTime < nextAmbience) return;
  const h = mood.minutes / 60;
  if (h >= 5.5 && h < 19) {
    // a bird: two or three quick rising chirps
    const base = 2200 + Math.random() * 1600;
    const chirps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < chirps; i++) {
      tone({ freq: base, slideTo: base * (1.2 + Math.random() * 0.3), start: i * 0.11, dur: 0.08, gain: 0.025, bus: ambienceBus });
    }
    nextAmbience = ctx.currentTime + 2 + Math.random() * 5;
  } else {
    // crickets: a fast pulse of high notes
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 6; i++) tone({ freq: f, start: i * 0.045, dur: 0.03, gain: 0.012, bus: ambienceBus });
    nextAmbience = ctx.currentTime + 0.6 + Math.random() * 1.4;
  }
}

function startSchedulers() {
  nextBeatTime = ctx.currentTime + 0.2;
  setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    scheduleMusic();
    scheduleAmbience();
  }, 100);
}
