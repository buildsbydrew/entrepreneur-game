// The episode's sound, made entirely in code (no samples, no licences to worry about): a gentle
// piano-and-pad tune that loops through a few warm chord patterns, plus the game's little sounds
// (voices as people talk, a click when the AI chooses, coins, a whoosh between scenes).
import fs from 'node:fs';

const RATE = 44100;

// A seeded random, so the music is the same every time
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function writeWav(file, data) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32000), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

// Adds one tone into the mix. shape: harmonics' strengths. decay: seconds to fade to about a third.
function tone(out, at, freq, dur, { gain = 0.1, attack = 0.006, decay = 1.2, shape = [1, 0.35, 0.12], vibrato = 0 } = {}) {
  const start = Math.floor(at * RATE);
  const len = Math.floor((dur + decay * 2) * RATE);
  for (let i = 0; i < len; i++) {
    const k = start + i;
    if (k < 0 || k >= out.length) continue;
    const t = i / RATE;
    let env = t < attack ? t / attack : Math.exp(-(t - attack) / decay);
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / (decay * 2));
    const f = freq * (1 + vibrato * Math.sin(t * 2 * Math.PI * 5));
    let s = 0;
    for (let h = 0; h < shape.length; h++) s += shape[h] * Math.sin(2 * Math.PI * f * (h + 1) * t);
    out[k] += s * env * gain;
  }
}

function noise(out, at, dur, { gain = 0.1, smooth = 0.9, rise = 0.3 } = {}) {
  const r = rng(Math.floor(at * 1000));
  const start = Math.floor(at * RATE);
  const len = Math.floor(dur * RATE);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const k = start + i;
    if (k < 0 || k >= out.length) continue;
    const p = i / len;
    const env = p < rise ? p / rise : 1 - (p - rise) / (1 - rise);
    lp = lp * smooth + (r() * 2 - 1) * (1 - smooth);
    out[k] += lp * env * gain * 3;
  }
}

// ---------- The music ----------
// Four patterns of four chords (as MIDI notes), all in F major, picked in turn
const PATTERNS = [
  [[53, 57, 60, 65], [48, 55, 60, 64], [50, 57, 62, 65], [46, 53, 58, 62]],   // F  C  Dm Bb
  [[46, 53, 58, 62], [48, 55, 60, 64], [53, 57, 60, 65], [53, 57, 60, 65]],   // Bb C  F  F
  [[50, 57, 62, 65], [46, 53, 58, 62], [53, 57, 60, 65], [48, 55, 60, 64]],   // Dm Bb F  C
  [[53, 57, 60, 65], [45, 52, 57, 60], [46, 53, 58, 62], [48, 55, 60, 64]]    // F  Am Bb C
];

function music(out, duration, cards) {
  const r = rng(7);
  const bpm = 76;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const endCard = cards.find(c => c.kind === 'end');
  const stopAt = duration - 0.5;
  let pattern = 0;
  let t = 0.4;
  while (t < stopAt - bar) {
    const chords = PATTERNS[pattern % PATTERNS.length];
    for (const chord of chords) {
      if (t >= stopAt - bar) break;
      const quiet = endCard && t >= endCard.at ? 0.8 : 1;
      // Pad: the whole chord, soft and slow
      for (const n of chord.slice(1)) tone(out, t, midi(n), bar * 0.95, { gain: 0.012 * quiet, attack: 0.6, decay: 0.9, shape: [1, 0.2], vibrato: 0.002 });
      // Bass on the first and third beat
      tone(out, t, midi(chord[0] - 12), beat * 1.6, { gain: 0.05 * quiet, decay: 0.7, shape: [1, 0.15] });
      tone(out, t + beat * 2, midi(chord[0] - 12), beat * 1.6, { gain: 0.035 * quiet, decay: 0.6, shape: [1, 0.15] });
      // Piano: a lazy arpeggio, with a few notes left out so it breathes
      const up = [chord[1], chord[2], chord[3], chord[2] + 12 > 84 ? chord[2] : chord[3] + (chord[3] % 12 === 5 ? 7 : 5)];
      for (let i = 0; i < 8; i++) {
        if (r() < 0.22 && i % 2 === 1) continue;
        const n = up[(i + (pattern % 2)) % up.length] + (i >= 4 && r() < 0.3 ? 12 : 0);
        tone(out, t + i * beat / 2 + (r() - 0.5) * 0.012, midi(n), beat * 0.5, { gain: (i % 2 ? 0.026 : 0.036) * quiet, decay: 0.9, shape: [1, 0.4, 0.15, 0.05] });
      }
      t += bar;
    }
    pattern++;
  }
  // A last chord to finish on
  for (const n of [41, 53, 57, 60, 65]) tone(out, t, midi(n), 2.5, { gain: 0.03, decay: 1.4, shape: [1, 0.3, 0.1] });
  // Fade out the very end
  const fade = Math.floor(2 * RATE);
  for (let i = 0; i < fade; i++) {
    const k = out.length - fade + i;
    if (k >= 0) out[k] *= 1 - i / fade;
  }
}

// ---------- Sound effects ----------
function effect(out, { at, kind, pitch = 1 }) {
  switch (kind) {
    case 'voice': {
      const r = rng(Math.floor(at * 997));
      for (let i = 0; i < 3; i++) tone(out, at + i * 0.09, 300 * pitch * (0.9 + r() * 0.25), 0.04, { gain: 0.03, attack: 0.004, decay: 0.03, shape: [1, 0.5, 0.25] });
      break;
    }
    case 'choose': tone(out, at, 1250, 0.02, { gain: 0.05, decay: 0.04, shape: [1, 0.3] }); tone(out, at + 0.05, 1660, 0.02, { gain: 0.04, decay: 0.05 }); break;
    case 'coin': tone(out, at, 988, 0.08, { gain: 0.05, decay: 0.12 }); tone(out, at + 0.09, 1319, 0.2, { gain: 0.05, decay: 0.3 }); break;
    case 'spend': tone(out, at, 784, 0.08, { gain: 0.04, decay: 0.1 }); tone(out, at + 0.1, 587, 0.15, { gain: 0.04, decay: 0.2 }); break;
    case 'warm': tone(out, at, 659, 0.1, { gain: 0.04, decay: 0.2 }); tone(out, at + 0.12, 880, 0.25, { gain: 0.04, decay: 0.35 }); break;
    case 'cold': tone(out, at, 440, 0.1, { gain: 0.035, decay: 0.2 }); tone(out, at + 0.12, 370, 0.25, { gain: 0.035, decay: 0.3 }); break;
    case 'page': noise(out, at, 0.28, { gain: 0.03, smooth: 0.6, rise: 0.2 }); break;
    case 'whoosh': noise(out, at - 0.15, 0.55, { gain: 0.035, smooth: 0.92, rise: 0.6 }); break;
    case 'chime': [72, 76, 79, 84].forEach((n, i) => tone(out, at + i * 0.13, midi(n), 0.3, { gain: 0.04, decay: 0.8, shape: [1, 0.2, 0.3] })); break;
    default: break;
  }
}

// The music steps back while people talk (room for their voices) and almost drops out on the big
// decision cards, so those moments land in near silence
function musicLevel(duration, cards, lines) {
  const STEP = 0.05;
  const level = new Float32Array(Math.ceil(duration / STEP) + 2).fill(1);
  const lower = (at, dur, to) => {
    for (let k = Math.floor(at / STEP); k <= Math.ceil((at + dur) / STEP) && k < level.length; k++) if (k >= 0) level[k] = Math.min(level[k], to);
  };
  for (const l of lines) lower(l.at, l.dur, 0.5);
  for (const c of cards) if (c.kind === 'decision' || c.kind === 'quote') lower(c.at - 0.3, (c.dur ?? 2) + 0.3, 0.15);
  // Smooth it so the changes are gentle (about a third of a second)
  for (let pass = 0; pass < 2; pass++) for (let k = 1; k < level.length; k++) level[k] = level[k - 1] + (level[k] - level[k - 1]) * 0.3;
  return t => level[Math.min(level.length - 1, Math.floor(t / STEP))];
}

export function makeSoundtrack(file, duration, sfx, { cards = [], lines = [] } = {}) {
  const out = new Float32Array(Math.ceil((duration + 0.2) * RATE));
  music(out, duration, cards);
  const level = musicLevel(duration, cards, lines);
  for (let i = 0; i < out.length; i++) out[i] *= level(i / RATE);
  for (const e of sfx) effect(out, e);
  // Gentle limiter so nothing clips
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0.9 ? 0.9 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * gain * 1.2) / 1.2;
  writeWav(file, out);
  return { peak, seconds: out.length / RATE };
}
