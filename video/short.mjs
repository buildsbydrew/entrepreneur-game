// The 60-second vertical Short of the same life.
//
//   node short.mjs --id ep01 --windows   picks the best moments from log.json and writes
//                                          episodes/<id>/short-windows.json (when to record)
//   node record.mjs --id ep01 --aspect 9:16 --windows episodes/ep01/short-windows.json (same seed!)
//   node short.mjs --id ep01             builds public/episode/<id>/short-plan.json and its soundtrack
//
// Because film mode runs on its own clock with a seed, the vertical recording plays out exactly the
// same life, so only the chosen moments need recording.
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
const log = JSON.parse(fs.readFileSync(path.join(epDir, args.windows ? 'log-probe.json' : 'log.json'), 'utf8'));
const film = log.find(e => e.type === 'film');
const strip = s => String(s ?? '').replace(/\s*\(.*?\)\s*$/, '');

// ---------- The moments ----------
function pickMoments() {
  const moments = [];
  const firstMemory = log.find(e => e.type === 'card' && e.title === 'Your first memory');
  const played = e => e.sim > (firstMemory?.sim ?? 0);
  const story = log.find(e => e.type === 'story');

  const prologueChoice = log.find(e => e.type === 'choice' && e.kind === 'prologue');
  if (prologueChoice) moments.push({ a: prologueChoice.sim - 0.5, b: prologueChoice.sim + 3.6, caption: 'Day one. Already making choices.', choice: prologueChoice });

  // The first conversations of the played life, with their choices
  const talkChoices = log.filter(e => e.type === 'choice' && e.kind === 'talk' && played(e));
  const seen = new Set();
  const picked = [];
  for (const c of talkChoices) {
    if (seen.has(c.with) || picked.length >= 3) continue;
    seen.add(c.with);
    picked.push(c);
  }
  picked.forEach((c, i) => {
    const lineBefore = [...log].reverse().find(e => e.type === 'line' && e.sim < c.sim && e.sim > c.sim - 8);
    const a = i === 0 && lineBefore ? lineBefore.sim - 0.2 : c.sim - 2.0;
    moments.push({ a, b: c.sim + 3.3, caption: i === 0 ? `Age ${c.age}. First day out alone.` : null, choice: c });
  });

  // A few time jumps across the life
  const jumps = log.filter(e => e.type === 'jump' && played(e));
  const spread = [0.15, 0.4, 0.65, 0.9].map(f => jumps[Math.floor(f * (jumps.length - 1))]).filter(Boolean);
  [...new Set(spread)].forEach(j => moments.push({ a: j.sim + 0.3, b: j.sim + 2.9, caption: `Age ${j.age}`, big: true }));

  if (story) moments.push({ a: story.sim - 0.4, b: story.sim + 7.5, caption: null, story: true });
  moments.sort((x, y) => x.a - y.a);
  // No overlaps
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
// Check the vertical recording played the same life
const sameLife = (type) => JSON.stringify(log.filter(e => e.type === type).map(e => e.text)) === JSON.stringify(vlog.filter(e => e.type === type).map(e => e.text));
if (!sameLife('choice') || !sameLife('line')) console.warn('Warning: the vertical recording made different choices from the landscape one.');

const toFootage = sim => {
  const w = [...meta.windows].reverse().find(x => x.sim <= sim + 0.05) ?? meta.windows[0];
  return w.footage + (sim - w.sim);
};

const FPS = 30;
const items = [];
const captions = [];
const chips = [];
const sfx = [];
let cursor = 0;
const TITLE = 2.6;
items.push({ kind: 'title', at: 0, dur: TITLE, name: film.name, profile: film.profile });
sfx.push({ at: 0, kind: 'chime' });
cursor = TITLE;
captions.push({ at: 0.2, dur: TITLE - 0.3, text: `An AI lives a whole life in my game.`, big: true });

for (const m of moments) {
  const from = toFootage(m.a);
  const dur = m.b - m.a;
  items.push({ kind: 'clip', at: +cursor.toFixed(3), dur: +dur.toFixed(3), from: +from.toFixed(3), big: m.big });
  if (m.caption) captions.push({ at: cursor + 0.1, dur: Math.min(dur - 0.2, 2.8), text: m.caption, big: m.big });
  if (m.choice) {
    const at = cursor + (m.choice.sim - m.a) + 0.4;
    chips.push({ at: +at.toFixed(3), dur: Math.max(1.2, Math.min(2.6, m.b - m.choice.sim - 0.6)), pick: strip(m.choice.text), why: m.choice.reason.replace(/^\w+: /, '') });
    sfx.push({ at: at + 2.1, kind: 'choose' });
  }
  for (const e of log) {
    if (e.sim < m.a || e.sim >= m.b) continue;
    const o = cursor + (e.sim - m.a);
    if (e.type === 'line') sfx.push({ at: o, kind: 'voice', pitch: e.isYou ? 1.35 : 1 });
    if (e.type === 'jump') sfx.push({ at: o, kind: 'page' });
    if (e.type === 'feeling') sfx.push({ at: o, kind: /livs/.test(e.text) ? 'coin' : 'warm' });
  }
  if (m.story) captions.push({ at: cursor + 0.3, dur: 3, text: `${film.name}'s whole life, in one screen.` });
  cursor += dur;
}
const END = 3.2;
items.push({ kind: 'outro', at: +cursor.toFixed(3), dur: END, name: film.name });
sfx.push({ at: cursor, kind: 'whoosh' });
cursor += END;

const pubDir = path.join(here, 'public', 'episode', id);
fs.mkdirSync(pubDir, { recursive: true });
const src = path.join(epDir, 'footage-9x16.mp4');
const dst = path.join(pubDir, 'footage-9x16.mp4');
try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); }
const plan = { id, fps: FPS, width: 1080, height: 1920, duration: cursor, frames: Math.ceil(cursor * FPS), footage: `episode/${id}/footage-9x16.mp4`, soundtrack: `episode/${id}/short-soundtrack.wav`, name: film.name, items, captions, chips };
fs.writeFileSync(path.join(pubDir, 'short-plan.json'), JSON.stringify(plan, null, 1));
makeSoundtrack(path.join(pubDir, 'short-soundtrack.wav'), cursor, sfx, { cards: [] });
console.log(`Short planned: ${cursor.toFixed(1)}s, ${moments.length} moments.`);
