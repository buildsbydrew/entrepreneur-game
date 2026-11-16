// People speak Urlivani, a made-up language, made in code. The English words show in the dialogue box;
// what you hear is each person's own voice saying it in Urlivani, with the feeling of the line.
//
// How it works:
// - Every English word is turned into an Urlivani word: the same English word always becomes the same
//   Urlivani word, so a line sounds like real speech, not random noise.
// - Each syllable is a voiced sound shaped into a vowel (by two filters, the way a mouth shapes a voice),
//   with a soft consonant before it.
// - Everyone has a voice: how high, how fast, how breathy, how shaky. It comes from their body and their age,
//   so voices change as people grow up and grow old.
// - The feeling comes from the line: questions rise at the end, exclamations are louder and higher, "..."
//   trails off, and laughs ("ha ha") sound like laughing. A line can also be marked happy, sad, angry or scared.
import { voiceOutput } from './sound.js';
import { cosmetic } from '../core/dice.js';

// ---------- The sound of Urlivani ----------

// Vowels, as the two main resonances of an adult mouth (in hertz)
const VOWELS = { a: [780, 1220], e: [480, 1850], i: [310, 2250], o: [500, 880], u: [360, 780] };
const VOWEL_KEYS = Object.keys(VOWELS);

// Soft consonants: a short burst of breath (hiss), or a hum (voiced), shaped by a filter
const CONSONANTS = {
  l: { kind: 'hum', freq: 420, dur: 0.035 },
  v: { kind: 'hum', freq: 300, dur: 0.04, hiss: 0.25 },
  r: { kind: 'hum', freq: 520, dur: 0.03, flutter: true },
  n: { kind: 'hum', freq: 260, dur: 0.04 },
  m: { kind: 'hum', freq: 220, dur: 0.045 },
  s: { kind: 'hiss', freq: 5200, dur: 0.06 },
  z: { kind: 'hiss', freq: 4200, dur: 0.05, hum: 0.4 },
  t: { kind: 'hiss', freq: 3200, dur: 0.018 },
  k: { kind: 'hiss', freq: 1900, dur: 0.025 },
  d: { kind: 'hiss', freq: 2600, dur: 0.02, hum: 0.5 },
  h: { kind: 'hiss', freq: 1400, dur: 0.05 }
};
// Urlivani favours flowing sounds (l, v, r, n, m), like the name Urlivani itself
const CONSONANT_POOL = ['l', 'l', 'v', 'v', 'r', 'n', 'n', 'm', 's', 'z', 't', 'k', 'd', ''];

// A small number from a word, the same every time
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Turns an English word into Urlivani syllables: [{ c: 'l', v: 'a', nasal: false }, ...]
export function urlivaniWord(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return [];
  let h = hash(w);
  const next = n => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return h % n; };
  const count = Math.min(4, Math.max(1, Math.round(w.length / 2.6)));
  const syllables = [];
  for (let i = 0; i < count; i++) {
    syllables.push({
      c: CONSONANT_POOL[next(CONSONANT_POOL.length)],
      v: VOWEL_KEYS[next(VOWEL_KEYS.length)],
      nasal: next(5) === 0 // sometimes the syllable ends in a soft "n"
    });
  }
  return syllables;
}

// Splits a line into words and pauses: [{ word, syllables } | { pause: seconds } | { laugh: n }]
export function speechPlan(text) {
  const plan = [];
  const tokens = text.match(/[A-Za-z']+|\.\.\.|[.,!?;:—-]/g) ?? [];
  for (const token of tokens) {
    if (/^(ha)+h?$/i.test(token) || /^(he)+h?$/i.test(token)) plan.push({ laugh: Math.min(5, Math.max(2, token.length / 2)) });
    else if (/[a-z]/i.test(token)) plan.push({ word: token, syllables: urlivaniWord(token) });
    else if (token === '...') plan.push({ pause: 0.4, trail: true });
    else if (token === ',' || token === ';' || token === ':' || token === '—' || token === '-') plan.push({ pause: 0.16 });
    else plan.push({ pause: 0.28, end: token });
  }
  return plan;
}

// ---------- Voices ----------

// A voice from who someone is. body: 'boy' or 'girl'; stage: baby, child, teen, adult, elder;
// seed: anything that makes this person's voice their own (their id or name).
export function voiceFor({ body = 'boy', stage = 'adult', seed = '' }) {
  const female = body === 'girl';
  const table = {
    baby:  { pitch: 420, formant: 1.38, speed: 0.9,  breath: 0.2,  shake: 0.01 },
    child: { pitch: female ? 300 : 280, formant: 1.24, speed: 1.15, breath: 0.12, shake: 0 },
    teen:  { pitch: female ? 235 : 165, formant: female ? 1.14 : 1.06, speed: 1.12, breath: 0.12, shake: 0 },
    adult: { pitch: female ? 205 : 118, formant: female ? 1.1 : 1, speed: 1, breath: 0.1, shake: 0 },
    elder: { pitch: female ? 188 : 108, formant: female ? 1.05 : 0.96, speed: 0.82, breath: 0.32, shake: 0.035 }
  };
  const base = table[stage] ?? table.adult;
  const h = hash(String(seed));
  const vary = (amount, shift) => 1 + ((((h >>> shift) % 1000) / 1000) - 0.5) * 2 * amount;
  return {
    pitch: base.pitch * vary(0.09, 0),
    formant: base.formant * vary(0.04, 10),
    speed: base.speed * vary(0.1, 20),
    breath: base.breath,
    shake: base.shake
  };
}

// How each feeling changes a voice: pitch, loudness, speed, and how much the pitch moves
const FEELINGS = {
  calm:   { pitch: 1,    loud: 1,    speed: 1,    range: 1 },
  happy:  { pitch: 1.1,  loud: 1.1,  speed: 1.08, range: 1.4 },
  sad:    { pitch: 0.9,  loud: 0.75, speed: 0.8,  range: 0.6 },
  angry:  { pitch: 1.04, loud: 1.45, speed: 1.12, range: 0.9, sharp: true },
  scared: { pitch: 1.15, loud: 0.9,  speed: 1.2,  range: 1.2, shaky: true },
  tired:  { pitch: 0.93, loud: 0.8,  speed: 0.85, range: 0.7 }
};

// Guesses the feeling of a line when it isn't marked
export function feelingOf(text) {
  if (/!{1}/.test(text) && /\b(no|stop|how dare|get out|never)\b/i.test(text)) return 'angry';
  if (/\b(ha ?ha|haha|yes!|yay|finally)\b/i.test(text)) return 'happy';
  if (/\b(sorry|miss|gone|cry|alone|tired)\b/i.test(text) || /\.\.\.$/.test(text.trim())) return 'sad';
  return 'calm';
}

// ---------- Speaking ----------

let current = null; // only one person speaks at a time; a new line stops the last one

export function stopSpeaking() {
  if (current) current.stop();
  current = null;
}

// Says a line in Urlivani. Returns how long it takes, in seconds (0 if sound isn't on yet).
// maxSeconds keeps long lines from going on forever.
export function speak(text, voice, { feeling, maxSeconds = 6 } = {}) {
  stopSpeaking();
  const out = voiceOutput();
  if (!out || !text) return 0;
  const { ctx, bus, noise } = out;
  const mood = FEELINGS[feeling ?? feelingOf(text)] ?? FEELINGS.calm;
  const plan = speechPlan(text);
  const nodes = [];
  const start = ctx.currentTime + 0.03;
  let t = start;
  const end = start + maxSeconds;

  // The whole line drifts down in pitch, like real speech; questions turn up at the end
  const totalSyllables = plan.reduce((n, p) => n + (p.syllables?.length ?? 0), 0) || 1;
  const question = /\?\s*$/.test(text);
  const exclaim = /!\s*$/.test(text);
  let index = 0;

  const syllableLength = 0.13 / (voice.speed * mood.speed);

  const playVowel = (at, dur, vowel, pitch, loud, nasal) => {
    const [f1, f2] = VOWELS[vowel];
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, at);
    osc.frequency.linearRampToValueAtTime(pitch * (0.97 + cosmetic() * 0.04), at + dur);
    // A little natural wobble, more for elders and the scared
    if (voice.shake || mood.shaky) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5 + cosmetic() * 1.5;
      depth.gain.value = pitch * (voice.shake + (mood.shaky ? 0.025 : 0));
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
      nodes.push(lfo);
    }
    const env = ctx.createGain();
    const peak = 0.11 * loud;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + (mood.sharp ? 0.008 : 0.02));
    env.gain.setValueAtTime(peak * 0.85, at + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, at + dur + (nasal ? 0.05 : 0.02));
    // Two resonances shape the buzz into a vowel
    [[f1, 7, 1], [f2, 9, 0.6]].forEach(([f, q, g]) => {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f * voice.formant;
      band.Q.value = q;
      const level = ctx.createGain();
      level.gain.value = g;
      osc.connect(band).connect(level).connect(env);
    });
    if (nasal) {
      const hum = ctx.createBiquadFilter();
      hum.type = 'lowpass';
      hum.frequency.value = 400;
      osc.connect(hum).connect(env);
    }
    env.connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.08);
    nodes.push(osc);
  };

  const playBreath = (at, dur, freq, loud) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq;
    band.Q.value = 1.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.05 * loud, at + dur * 0.3);
    env.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(band).connect(env).connect(bus);
    src.start(at, cosmetic() * 0.5);
    src.stop(at + dur + 0.02);
    nodes.push(src);
  };

  for (const part of plan) {
    if (t > end) break;
    if (part.pause) {
      t += part.pause / (voice.speed * mood.speed);
      continue;
    }
    if (part.laugh) {
      // "ha ha ha": breathy bursts, each a little lower
      for (let i = 0; i < part.laugh; i++) {
        const p = voice.pitch * mood.pitch * (1.25 - i * 0.07);
        playBreath(t, 0.05, 1500, 1.2);
        playVowel(t + 0.03, 0.09, 'a', p, 1.1, false);
        t += 0.17;
      }
      continue;
    }
    for (const syl of part.syllables) {
      // Where we are in the line: early syllables a touch higher, the end lower (or up, for a question)
      const progress = index / totalSyllables;
      let contour = 1.06 - 0.12 * progress;
      if (question && progress > 0.75) contour = 1 + (progress - 0.75) * 1.4;
      if (exclaim) contour *= 1.08;
      const stress = index % 3 === 0 ? 1.05 : 0.98; // a little rhythm
      const pitch = voice.pitch * mood.pitch * (1 + (contour - 1) * mood.range) * stress;
      const loud = mood.loud * (exclaim ? 1.2 : 1) * (0.9 + cosmetic() * 0.2);

      const c = CONSONANTS[syl.c];
      if (c) {
        if (c.kind === 'hiss' || c.hiss) playBreath(t, c.dur, c.freq, loud * (c.hiss ?? 1));
        if (c.kind === 'hum' || c.hum) playVowel(t, c.dur, 'u', pitch * 0.98, loud * 0.5 * (c.hum ?? 1), false);
        t += c.dur * 0.8;
      }
      const dur = syllableLength * (0.85 + ((hash(part.word + index) % 100) / 100) * 0.35);
      playVowel(t, dur, syl.v, pitch, loud, syl.nasal);
      if (voice.breath > 0.05) playBreath(t, dur, 2500, loud * voice.breath * 2);
      t += dur;
      index += 1;
    }
    t += 0.045 / voice.speed; // a tiny gap between words
  }

  const duration = Math.min(t, end) - start;
  current = {
    stop() {
      const now = ctx.currentTime;
      nodes.forEach(n => { try { n.stop(now + 0.03); } catch (error) { /* already stopped */ } });
    }
  };
  return duration;
}
