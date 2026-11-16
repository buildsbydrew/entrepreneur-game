// The vertical Short (under 60 seconds) of the same life. It ends on the moment before a big decision,
// as a cliffhanger for the full episode.
//
//   node short.mjs --id ep01 --windows   picks the moments from log-probe.json and writes
//                                          episodes/<id>/short-windows.json (when to record)
//   node record.mjs --id ep01 --aspect 9:16 --windows episodes/ep01/short-windows.json (same seed!)
//   node short.mjs --id ep01             builds public/episode/<id>/short-plan.json and its soundtrack
//
// Film mode runs on its own clock with a seed, so the vertical recording plays out exactly the same
// life, and only the chosen moments need recording.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSoundtrack } from './audio.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const id = args.id ?? 'ep01';
const epDir = path.join(here, 'episodes', id);
const whole = JSON.parse(fs.readFileSync(path.join(epDir, 'log-probe.json'), 'utf8')); // the whole life, from the test run
// Only this episode's stretch of the life (see plan.mjs --from / --until)
const closingOf = dayId => whole.find(e => e.type === 'closing' && e.bigDay === dayId);
const startSim = args.from ? (closingOf(args.from)?.sim ?? 0) + 4 : 0;
const endSim = args.until ? (closingOf(args.until)?.sim ?? Infinity) + 6 : Infinity;
const log = whole.filter(e => e.type === 'film' || (e.sim >= startSim && e.sim < endSim));
const film = log.find(e => e.type === 'film');
const name = film.name;
const strip = s => String(s ?? '').replace(/\s*\(.*?\)\s*$/, '');

// ---------- The moments ----------
function pickMoments() {
  const moments = [];
  const firstMemory = log.find(e => e.type === 'card' && e.title === 'Your first memory');
  const played = e => e.sim > (firstMemory?.sim ?? 0);

  // The prologue: the first caption, over the birth scene
  const firstCaption = log.find(e => e.type === 'caption');
  if (firstCaption) moments.push({ a: firstCaption.sim, b: firstCaption.sim + 4.2 });

  // The first played conversations, answers and all (two people, up to about 9 seconds each)
  const talks = log.filter(e => e.type === 'talk' && e.isNew && played(e)).slice(0, 2);
  for (const talk of talks) {
    const done = log.find(e => e.type === 'talk-end' && e.sim > talk.sim);
    moments.push({ a: talk.sim - 0.3, b: Math.min(done?.sim ?? talk.sim + 8, talk.sim + 9), caption: moments.length === 1 ? `Age ${talk.age}. First day out alone.` : null });
  }

  // Glimpses of later mornings, with how old she is now
  const mornings = log.filter(e => e.type === 'day' && played(e));
  const picks = [0.3, 0.6, 0.9].map(f => mornings[Math.floor(f * (mornings.length - 1))]).filter(Boolean);
  [...new Set(picks)].forEach(d => moments.push({ a: d.sim, b: d.sim + 2.2, age: d.age }));

  // The cliffhanger: the biggest decision after the first conversations, up to the moment before the answer
  const shown = new Set(talks.map(t => t.sim));
  const decisions = log.filter(e => e.type === 'choice' && e.kind === 'talk' && (e.weight ?? 0) >= 2 && played(e))
    .filter(e => ![...shown].some(s => e.sim > s && e.sim < s + 9));
  const big = [...decisions].sort((x, y) => y.weight - x.weight)[0] ?? log.find(e => e.type === 'choice' && e.kind === 'talk' && played(e));
  if (big) {
    const lead = [...log].reverse().find(e => e.type === 'line' && !e.isYou && e.sim < big.sim);
    moments.push({ a: (lead?.sim ?? big.sim - 4) - 0.3, b: big.sim + 0.4, decision: big });
  }
  moments.sort((x, y) => x.a - y.a);
  for (let i = 1; i < moments.length; i++) if (moments[i].a < moments[i - 1].b) moments[i].a = moments[i - 1].b;
  return moments.filter(m => m.b - m.a > 0.8);
}

const moments = pickMoments();
if (args.windows) {
  const windows = moments.map(m => [+m.a.toFixed(3), +m.b.toFixed(3)]);
  fs.writeFileSync(path.join(epDir, 'short-windows.json'), JSON.stringify(windows));
  const total = windows.reduce((s, [a, b]) => s + b - a, 0);
  console.log(`${windows.length} moments, ${total.toFixed(1)}s of footage to record → episodes/${id}/short-windows.json`);
  process.exit(0);
}

// ---------- The plan ----------
const meta = JSON.parse(fs.readFileSync(path.join(epDir, 'meta-9x16.json'), 'utf8'));
const vlog = JSON.parse(fs.readFileSync(path.join(epDir, 'log-9x16.json'), 'utf8'));
const same = type => JSON.stringify(log.filter(e => e.type === type).map(e => e.text).slice(0, vlog.filter(e => e.type === type).length)) === JSON.stringify(vlog.filter(e => e.type === type).map(e => e.text));
if (!same('choice') || !same('line')) console.warn('Warning: the vertical recording made different choices from the landscape one.');
const toFootage = sim => {
  const w = [...meta.windows].reverse().find(x => x.sim <= sim + 0.05) ?? meta.windows[0];
  return w.footage + (sim - w.sim);
};

const FPS = 30;
const items = [];
const captions = [];
const sfx = [];
const lines = [];
let cursor = 0;
const card = (kind, dur, data) => { items.push({ kind, at: +cursor.toFixed(3), dur, ...data }); cursor += dur; };
card('title', 2.2, { name, profile: film.profile });
sfx.push({ at: 0, kind: 'chime' });
card('premise', 2.4, { text: 'An AI lives one life in my game. Every choice is its own.' });

for (const m of moments) {
  const dur = m.b - m.a;
  items.push({ kind: 'clip', at: +cursor.toFixed(3), dur: +dur.toFixed(3), from: +toFootage(m.a).toFixed(3) });
  if (m.caption) captions.push({ at: cursor + 0.1, dur: Math.min(dur - 0.2, 2.8), text: m.caption });
  if (m.age !== undefined) captions.push({ at: cursor + 0.1, dur: dur - 0.2, text: `Age ${m.age}`, big: true });
  for (const e of log) {
    if (e.sim < m.a || e.sim >= m.b) continue;
    const o = cursor + (e.sim - m.a);
    if (e.type === 'line') { sfx.push({ at: o, kind: 'voice', pitch: e.isYou ? 1.35 : 1 }); lines.push({ at: o, dur: Math.min(6, 1 + e.text.length * 0.06) }); }
    if (e.type === 'feeling') sfx.push({ at: o, kind: /livs/.test(e.text) ? 'coin' : 'warm' });
  }
  cursor += dur;
  if (m.decision) {
    const other = m.decision.options.findIndex((o, k) => k !== m.decision.picked);
    const pair = [m.decision.picked, other].sort((a, b) => a - b).map(k => strip(m.decision.options[k]));
    card('decision', 3, { options: pair });
    sfx.push({ at: cursor - 3, kind: 'whoosh' });
  }
}
card('outro', 3, { name });
sfx.push({ at: cursor - 3, kind: 'whoosh' });

const pubDir = path.join(here, 'public', 'episode', id);
fs.mkdirSync(pubDir, { recursive: true });
const src = path.join(epDir, 'footage-9x16.mp4');
const dst = path.join(pubDir, 'footage-9x16.mp4');
try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); }
const plan = { id, fps: FPS, width: 1080, height: 1920, duration: cursor, frames: Math.ceil(cursor * FPS), footage: `episode/${id}/footage-9x16.mp4`, soundtrack: `episode/${id}/short-soundtrack.wav`, name, items, captions, chips: [] };
fs.writeFileSync(path.join(pubDir, 'short-plan.json'), JSON.stringify(plan, null, 1));
makeSoundtrack(path.join(pubDir, 'short-soundtrack.wav'), cursor, sfx, { cards: items.filter(i => i.kind !== 'clip'), lines });
console.log(`Short planned: ${cursor.toFixed(1)}s, ${moments.length} moments, ending on a decision.`);
