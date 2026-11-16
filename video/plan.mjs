// Turns a recorded life (episodes/<id>/log.json + footage) into an edit: which stretches of footage to
// keep (dull walking and waiting are cut), chapter cards per age, captions that tell the story, the
// AI's reasons for its choices, the end card, and the music and sound effects.
//
//   node plan.mjs --id ep01 --windows   (before recording) which stretches of the life to record
//   node plan.mjs --id ep01             (after recording) the edit itself
//
// Everything is timed in "sim" seconds (time since the life started, on film mode's own clock), so the
// same plan works from the quick test run's log and from the recording's.
// Writes episodes/<id>/script.draft.json (the words: chapter titles and captions, ready to polish).
// If episodes/<id>/script.json exists, its words are used instead, so a polished script survives
// re-planning. Then writes public/episode/<id>/plan.json and soundtrack.wav for Remotion.
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
const logFile = fs.existsSync(path.join(epDir, 'log.json')) && !args.windows ? 'log.json' : 'log-probe.json';
const log = JSON.parse(fs.readFileSync(path.join(epDir, logFile), 'utf8'));
log.forEach(e => { e.t = e.sim; });
// Fill in the money's name wherever the game left it as {currency}
const fillMoney = v => typeof v === 'string' ? v.replace(/{currency}/g, 'livs') : Array.isArray(v) ? v.map(fillMoney) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillMoney(x)])) : v;
log.forEach((e, i) => { log[i] = fillMoney(e); });
const FPS = 30;
const end = log[log.length - 1].sim + 2;
// Where a moment of the life is in the recorded footage (only the planned stretches were recorded)
const meta = args.windows ? null : JSON.parse(fs.readFileSync(path.join(epDir, 'meta-16x9.json'), 'utf8'));
const toFootage = sim => {
  if (!meta?.windows?.length) return sim;
  const w = [...meta.windows].reverse().find(x => x.sim <= sim + 0.02) ?? meta.windows[0];
  return w.footage + (sim - w.sim);
};
const film = log.find(e => e.type === 'film');
const name = film.name;
const story = log.find(e => e.type === 'story');

// ---------- A little randomness that's the same every time ----------
let seed = 12345;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = list => list[Math.floor(rand() * list.length)];
const strip = s => String(s ?? '').replace(/\s*\(.*?\)\s*$/, '').replace(/\{currency\}/g, 'livs');

// ---------- Splitting the life into scenes ----------
const firstScene = log.find(e => e.type === 'prologue-scene');
const firstMemory = log.find(e => e.type === 'card' && e.title === 'Your first memory');
const dayCards = log.filter(e => e.type === 'card' && e.t >= (firstMemory?.t ?? 0));
const storyAt = story?.t ?? end;

// A played day: from its card to the next card (or the life story)
const days = dayCards.map((card, i) => {
  const until = dayCards[i + 1]?.t ?? storyAt;
  const events = log.filter(e => e.t >= card.t && e.t < until);
  const talks = events.filter(e => e.type === 'talk');
  const age = events.find(e => e.type === 'age')?.now ?? events.find(e => e.age !== undefined && e.type !== 'card')?.age ?? card.age;
  const asleep = events.find(e => e.type === 'sleep')?.t ?? until;
  const memories = events.filter(e => e.type === 'memory' && e.t < asleep && !/^Turned \d+/.test(e.text));
  const interesting = talks.some(t => t.isNew) || memories.length > 0;
  const stage = events.find(e => e.type === 'day')?.stage ?? 'child';
  return { card, until, events, talks, age, memories, interesting, stage };
});

// ---------- Choosing what to keep ----------
// Each kept stretch: { from, to } in footage seconds, plus what it is
function keepRanges(day, { quiet }) {
  const ranges = [];
  const add = (from, to, what) => { if (to > from) ranges.push({ from: Math.max(day.card.t, from), to: Math.min(day.until, to), what }); };
  const ev = day.events;
  const sleep = ev.find(e => e.type === 'sleep');
  const focus = ev.find(e => e.type === 'choice' && e.kind === 'focus');
  const jump = ev.find(e => e.type === 'jump');
  if (!quiet) {
    add(day.card.t + 0.4, day.card.t + 4.5, 'morning');
    for (const talk of day.talks) {
      const done = ev.find(e => e.type === 'talk-end' && e.t >= talk.t);
      add(talk.t - 1.6, (done?.t ?? talk.t + 5) + 1.4, 'talk');
    }
    for (const use of ev.filter(e => e.type === 'use')) add(use.t - 1.5, use.t + 3.2, 'use');
    for (const lapse of ev.filter(e => e.type === 'timelapse')) add(lapse.t, lapse.t + 2.4, 'timelapse');
    for (const place of ev.filter(e => e.type === 'place')) add(place.t - 0.2, place.t + 1.2, 'arrive');
    if (sleep) add(sleep.t - 1.2, sleep.t + 0.5, 'bed');
  }
  if (focus) add(focus.t + (quiet ? 0.8 : 0.2), focus.t + 3.4, 'focus');
  if (jump) {
    const next = ev.find(e => e.t > jump.t && e.type === 'card')?.t ?? day.until;
    const full = Math.min(next, jump.t + 1.4 + jump.lines.length * 0.45 + jump.lines.join(' ').length * 0.038);
    add(jump.t + 0.1, quiet ? Math.min(full, jump.t + 4.6) : full, 'jump');
  }
  // Merge stretches that are close together, so short gaps aren't choppy
  ranges.sort((a, b) => a.from - b.from);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.from - last.to < 1.8) { last.to = Math.max(last.to, r.to); last.what += `+${r.what}`; }
    else merged.push({ ...r });
  }
  return merged;
}

// ---------- The script: chapter titles and captions ----------
const scriptPath = path.join(epDir, 'script.json');
const saved = fs.existsSync(scriptPath) ? JSON.parse(fs.readFileSync(scriptPath, 'utf8')) : null;
const draft = { title: `I let AI live a whole life in my game`, chapters: {}, captions: {} };

// A caption is tied to a log event (its index), so polished words stay in place after re-planning
const captionFor = (key, text) => {
  draft.captions[key] = text;
  return saved?.captions?.[key] ?? text;
};
const chapterTitle = (key, text) => {
  draft.chapters[key] = text;
  return saved?.chapters?.[key] ?? text;
};

const shorten = text => {
  const t = text.replace(/\.$/, '').replace(/^You /, '').replace(/^Your /, 'your ');
  const words = t.split(' ');
  return words.length > 8 ? `${words.slice(0, 8).join(' ')}...` : t;
};

const TALK_NEW = ['First, {who}.', 'Next stop: {who}.', 'Off to see {who}.', '{who} has something to say.', 'Time for {who}.'];
const TALK_AGAIN = ['{who} again. Same as ever.', 'A quick chat with {who}.', 'Checking in on {who}.'];
const LAPSE = ['Nothing happening. Fast-forward.', 'A quiet afternoon. Skip.', 'The hours roll by.', 'Waiting for the day to happen.'];
const BED = ['Bedtime.', 'Lights out.', 'And that was the day.'];
const FOCUS = ['Now the years skip ahead. The AI decides what matters most.', 'Time to jump ahead. What will it focus on?', 'Another leap in time.'];
const MONEY_UP = ['+{n} livs. Rich!', '+{n} livs. Saving it, probably.', 'Payday: {n} livs.'];
const MONEY_DOWN = ['{n} livs, gone. Worth it.', 'Spent {n} livs. No regrets.'];

// ---------- Building the edit ----------
const items = [];      // what plays, in order: title, clip, card, end
const captions = [];   // { at, dur, text } on screen, in output seconds
const chips = [];      // { at, dur, label, text } the AI's reasons
const chapters = [];   // { at, title } for the YouTube description
const sfx = [];        // { at, kind, pitch } sound effects, in output seconds
let cursor = 0;

const addCaption = (at, text, dur) => {
  if (!text) return;
  const d = dur ?? Math.min(4.5, Math.max(2.4, 1.2 + text.length * 0.055));
  // Never on top of the last one
  const last = captions[captions.length - 1];
  const start = last ? Math.max(at, last.at + last.dur + 0.15) : at;
  captions.push({ at: +start.toFixed(3), dur: +d.toFixed(3), text });
};

// Plays a stretch of footage and places captions, chips and sounds for what happens in it
function addClip(from, to, { quietCaptions = false } = {}) {
  if (to - from < 0.3) return;
  const at = cursor;
  items.push({ kind: 'clip', at: +at.toFixed(3), dur: +(to - from).toFixed(3), from: +toFootage(from).toFixed(3), sim: +from.toFixed(3) });
  const out = t => at + (t - from);
  log.forEach((e, i) => {
    if (e.t < from || e.t >= to) return;
    const o = out(e.t);
    if (e.type === 'line') sfx.push({ at: o, kind: 'voice', pitch: e.isYou ? 1.35 : 0.9 + ((e.speaker.length * 7) % 5) * 0.12 });
    if (e.type === 'choice') {
      const shown = e.kind === 'focus' ? 2.6 : e.kind === 'prologue' ? 2.8 : 2.2;
      chips.push({ at: +(o + 0.5).toFixed(3), dur: shown, pick: strip(e.text), why: e.reason.replace(/^\w+: /, '') });
      sfx.push({ at: o + shown + 0.4, kind: 'choose' });
    }
    if (quietCaptions) return;
    if (e.type === 'talk') addCaption(o - 1.2, captionFor(`e${i}`, pick(e.isNew ? TALK_NEW : TALK_AGAIN).replace('{who}', e.with)));
    if (e.type === 'timelapse') addCaption(o, captionFor(`e${i}`, pick(LAPSE)));
    if (e.type === 'sleep') addCaption(o - 0.8, captionFor(`e${i}`, pick(BED)));
    if (e.type === 'feeling') {
      const m = e.text.match(/^([+-]?\d+) livs/);
      if (m) {
        const n = Math.abs(Number(m[1]));
        addCaption(o, captionFor(`e${i}`, pick(Number(m[1]) > 0 ? MONEY_UP : MONEY_DOWN).replace('{n}', n)));
        sfx.push({ at: o, kind: Number(m[1]) > 0 ? 'coin' : 'spend' });
      } else sfx.push({ at: o, kind: /didn't/.test(e.text) ? 'cold' : 'warm' });
    }
    if (e.type === 'jump') sfx.push({ at: o, kind: 'page' });
    if (e.type === 'card' || e.type === 'place') sfx.push({ at: o, kind: 'whoosh' });
  });
  cursor += to - from;
}

function addCard(kind, dur, data) {
  // Captions stop before a card, and any still waiting start after it
  for (const c of captions) {
    if (c.at >= cursor) c.at += dur;
    else if (c.at + c.dur > cursor - 0.1) c.dur = Math.max(1.2, cursor - 0.1 - c.at);
  }
  items.push({ kind, at: +cursor.toFixed(3), dur, ...data });
  sfx.push({ at: cursor, kind: kind === 'title' ? 'chime' : 'whoosh' });
  cursor += dur;
}

// 1. Title card
addCard('title', 4.5, { name, profile: film.profile, about: film.about, world: film.world, game: film.game });

// 2. Being born: the title screen and typing the name
const born = log.find(e => e.type === 'born');
const title = log.find(e => e.type === 'title');
addClip((title?.t ?? 0) + 2.2, (born?.t ?? 6) + 0.9, { quietCaptions: true });
addCaption(4.55, captionFor('intro1', `Meet ${name}. An AI is about to live ${film.body === 'boy' ? 'his' : 'her'} whole life.`), 2.1);
addCaption(6.75, captionFor('intro2', `Its personality? ${film.profile}.`), 2.0);

// 3. The prologue: the game's own captions tell it; keep each one long enough to read
chapters.push({ at: cursor, title: chapterTitle('prologue', 'Before the first memory') });
addCard('chapter', 2.6, { title: chapterTitle('prologue', 'Before the first memory'), sub: 'Birth to age 4' });
const prologueEnd = firstMemory?.t ?? end;
const beats = log.filter(e => e.t >= (firstScene?.t ?? 0) && e.t < prologueEnd && ['caption', 'choice', 'prologue-scene'].includes(e.type));
beats.forEach((b, i) => {
  const next = beats[i + 1]?.t ?? prologueEnd;
  if (b.type === 'prologue-scene') return addClip(b.t + 0.2, Math.min(next, b.t + 1.0));
  if (b.type === 'caption') return addClip(b.t, Math.min(next, b.t + b.text.length * 0.028 + 2.9));
  if (b.type === 'choice') return addClip(b.t, Math.min(next, b.t + 2.2 + b.options.length * 0.35 + 1.3));
});

// 4. The played days. Each stage of life (child, teen, adult, elder) gets its days with something new
// in them shown in full (a chapter per age), then one ordinary day so we see the character at that
// age, then the time jumps where something happened, briefly.
const STAGE_NAMES = { child: 'childhood', teen: 'the teenage years', adult: 'grown up', elder: 'the grey years' };
const playDay = (day, chapter) => {
  if (chapter) {
    chapters.push({ at: cursor, title: chapter.title });
    addCard('chapter', 2.6, chapter);
  } else {
    addClip(day.card.t, day.card.t + 1.9, { quietCaptions: true }); // the game's own "Day 12 of Bloom" card
  }
  for (const r of keepRanges(day, { quiet: false })) addClip(r.from, r.to);
};
let lastAge = null;
for (const stage of ['child', 'teen', 'adult', 'elder']) {
  const inStage = days.filter(d => d.stage === stage);
  if (!inStage.length) continue;
  const special = inStage.filter(d => d.interesting);
  for (const day of special) {
    const key = `age-${day.age}`;
    const first = day.memories[0]?.text;
    const chapter = day.age !== lastAge ? { title: `Age ${day.age}: ${chapterTitle(key, first ? shorten(first) : STAGE_NAMES[stage])}`, sub: '' } : null;
    playDay(day, chapter);
    lastAge = day.age;
  }
  const rest = inStage.filter(d => !d.interesting);
  if (!rest.length) continue;
  const from = rest[0].age;
  const to = inStage[inStage.length - 1].age;
  const key = `stage-${stage}`;
  const span = from === to ? `Age ${from}` : `Ages ${from} to ${to}`;
  const title = `${span}: ${chapterTitle(key, STAGE_NAMES[stage])}`;
  // One ordinary day, to see who they've become: the one with the most talking
  const showcase = [...rest].sort((a, b) => b.talks.length - a.talks.length || a.card.t - b.card.t)[0];
  if (showcase.talks.length) {
    playDay(showcase, { title, sub: '' });
  } else {
    chapters.push({ at: cursor, title });
    addCard('chapter', 2.4, { title, sub: '' });
  }
  // What they chose to focus on, counted up
  const focuses = rest.flatMap(d => d.events.filter(e => e.type === 'choice' && e.kind === 'focus').map(e => strip(e.text)));
  const counts = Object.entries(focuses.reduce((m, f) => ({ ...m, [f]: (m[f] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  if (rest.length > 2 && counts.length) {
    const top = counts.slice(0, 2).map(([f, n]) => `${f} ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}`).join(', ');
    addCaption(cursor, captionFor(`${key}-count`, `${rest.length} time jumps. The AI chose ${top}.`), 3.4);
  }
  // The jumps where something happened (more than the usual line or two), briefly
  const others = rest.filter(d => d !== showcase);
  const eventful = others.filter(d => (d.events.find(e => e.type === 'jump')?.lines.length ?? 0) > 2);
  const chosen = (eventful.length ? eventful : others).slice(0, stage === 'adult' ? 7 : 5);
  for (const d of chosen) for (const r of keepRanges(d, { quiet: true })) addClip(r.from, r.to, { quietCaptions: true });
}

// 5. The end: the game's life story, then our end card
if (story) {
  chapters.push({ at: cursor, title: 'The end of a life' });
  const lastJump = [...log].reverse().find(e => e.type === 'choice' && e.kind === 'focus');
  if (lastJump && lastJump.t > (days[days.length - 1]?.card.t ?? 0)) addClip(lastJump.t + 0.5, lastJump.t + 3.4, { quietCaptions: true });
  addCaption(cursor, captionFor('end1', 'And then, one day...'), 2.4);
  addClip(story.t - 0.4, Math.min(end, story.t + 9), { quietCaptions: true });
  const choices = log.filter(e => e.type === 'choice');
  const people = new Set(log.filter(e => e.type === 'talk').map(e => e.with));
  // Moments for the end card from the whole life: the first few, and how it ended, each once
  const seenMoments = new Set();
  const all = log.filter(e => e.type === 'memory' && e.memoryAge >= 5 && !/^Turned \d+/.test(e.text) && !seenMoments.has(e.text) && seenMoments.add(e.text))
    .map(e => ({ age: e.memoryAge, text: e.text }));
  // one from each of the first few ages, then the last two
  const early = all.filter((m, i) => all.findIndex(x => x.age === m.age) === i).slice(0, 3);
  const moments = all.length > 5 ? [...early, ...all.slice(-2).filter(m => !early.includes(m))] : all;
  addCard('end', 14, {
    story,
    moments,
    stats: {
      choices: choices.length,
      conversations: log.filter(e => e.type === 'talk').length,
      people: people.size,
      playedDays: days.length,
      profile: film.profile
    }
  });
}

const duration = cursor;
fs.writeFileSync(path.join(epDir, 'script.draft.json'), JSON.stringify(draft, null, 1));
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

if (args.debug) console.log(items.map(i => `${i.kind} ${i.at.toFixed(1)} ${i.dur.toFixed(1)} ${i.sim ?? ""} ${i.title ?? ""}`).join(String.fromCharCode(10)));
if (args.windows) {
  // The stretches to record, merged, with a little room either side
  const ranges = items.filter(i => i.kind === 'clip').map(i => [i.sim - 0.1, i.sim + i.dur + 0.1]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1.5) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const windows = merged.map(([a, b]) => [+Math.max(0, a).toFixed(3), +b.toFixed(3)]);
  fs.writeFileSync(path.join(epDir, 'episode-windows.json'), JSON.stringify(windows));
  const total = windows.reduce((sum, [a, b]) => sum + b - a, 0);
  console.log(`Episode will be ${mmss(duration)} long. ${windows.length} stretches to record, ${mmss(total)} of footage → episodes/${id}/episode-windows.json`);
  process.exit(0);
}

// ---------- Write the plan for Remotion, and the soundtrack ----------
const pubDir = path.join(here, 'public', 'episode', id);
fs.mkdirSync(pubDir, { recursive: true });
const footageSrc = path.join(epDir, 'footage-16x9.mp4');
const footageDst = path.join(pubDir, 'footage-16x9.mp4');
if (!fs.existsSync(footageDst) || fs.statSync(footageDst).size !== fs.statSync(footageSrc).size) {
  try { fs.rmSync(footageDst, { force: true }); fs.linkSync(footageSrc, footageDst); } catch { fs.copyFileSync(footageSrc, footageDst); }
}
const plan = { id, fps: FPS, width: 1920, height: 1080, duration, frames: Math.ceil(duration * FPS), footage: `episode/${id}/footage-16x9.mp4`, soundtrack: `episode/${id}/soundtrack.wav`, name, items, captions, chips, chapters };
fs.writeFileSync(path.join(pubDir, 'plan.json'), JSON.stringify(plan, null, 1));
makeSoundtrack(path.join(pubDir, 'soundtrack.wav'), duration, sfx, { cards: items.filter(i => i.kind !== 'clip').map(i => ({ at: i.at, kind: i.kind })) });

if (!chapters.length || chapters[0].at > 0) chapters.unshift({ at: 0, title: `Meet ${name}` });
fs.writeFileSync(path.join(epDir, 'chapters.txt'), chapters.map(c => `${mmss(c.at)} ${c.title}`).join('\n'));
console.log(`Planned ${id}: ${mmss(duration)} long, ${items.filter(i => i.kind === 'clip').length} clips, ${chapters.length} chapters, ${captions.length} captions.`);
console.log(chapters.map(c => `  ${mmss(c.at)} ${c.title}`).join('\n'));
