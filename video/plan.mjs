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
// The whole life comes from the test run's log. A recording plays exactly the same life but stops at
// the last moment it needs, so its log only has to match the test run's as far as it goes.
const log = JSON.parse(fs.readFileSync(path.join(epDir, 'log-probe.json'), 'utf8'));
if (!args.windows && fs.existsSync(path.join(epDir, 'log.json'))) {
  const recorded = JSON.parse(fs.readFileSync(path.join(epDir, 'log.json'), 'utf8'));
  const key = e => `${e.type}|${Math.round(e.sim * 100)}|${e.text ?? ''}`;
  const differs = recorded.findIndex((e, i) => !log[i] || key(e) !== key(log[i]));
  if (differs >= 0) console.warn(`Warning: the recording drifted from the test run at ${recorded[differs].sim}s (${recorded[differs].type}). Re-record before rendering.`);
}
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
  if (quiet) add(day.card.t + 0.4, day.card.t + 2.6, 'morning');
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


// ---------- The few big decisions that get a card ----------
const MAX_DECISIONS = Number(args.decisions ?? 4);
const decisions = log.map((e, i) => ({ e, i })).filter(({ e }) => e.type === 'choice' && e.kind !== 'focus' && (e.weight ?? 0) >= 2 && e.options.length > 1)
  .sort((a, b) => b.e.weight - a.e.weight).slice(0, MAX_DECISIONS)
  .map(({ e, i }) => {
    // The picked answer and the most different other one, in the order the game offered them.
    // A polished question can be written in script.json under "decision-e<number>" (e.g. "Keep the money, or give it back?").
    const other = e.options.findIndex((o, k) => k !== e.picked);
    const pair = [e.picked, other].sort((a, b) => a - b).map(k => strip(e.options[k]));
    const written = saved?.captions?.[`decision-e${i}`];
    draft.captions[`decision-e${i}`] = `${pair[0]} Or ${pair[1]}`;
    return { t: e.t, question: written ?? null, options: written ? null : pair };
  }).sort((a, b) => a.t - b.t);

// ---------- Building the edit ----------
const items = [];      // what plays, in order: title, clip, card, end
const captions = [];   // { at, dur, text } on screen, in output seconds
const lines = [];      // { at, dur } when someone is speaking (the music steps back for voices)
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

// Plays a stretch of footage, with sounds for what happens in it. A big decision inside it gets a
// short decision card just before the answer is said.
function addClip(from, to) {
  if (to - from < 0.3) return;
  const decision = decisions.find(d => d.t > from + 0.2 && d.t < to - 0.2 && !d.used);
  if (decision) {
    decision.used = true;
    addClip(from, decision.t);
    addCard('decision', 2.4, { question: decision.question, options: decision.options });
    addClip(decision.t, to);
    return;
  }
  const at = cursor;
  items.push({ kind: 'clip', at: +at.toFixed(3), dur: +(to - from).toFixed(3), from: +toFootage(from).toFixed(3), sim: +from.toFixed(3) });
  const out = t => at + (t - from);
  for (const e of log) {
    if (e.t < from || e.t >= to) continue;
    const o = out(e.t);
    if (e.type === 'line') { sfx.push({ at: o, kind: 'voice', pitch: e.isYou ? 1.35 : 0.9 + ((e.speaker.length * 7) % 5) * 0.12 }); lines.push({ at: o, dur: Math.min(6.5, 0.9 + e.text.length * 0.05 + e.text.length * 0.016) }); }
    if (e.type === 'feeling') sfx.push({ at: o, kind: /livs/.test(e.text) ? (/^-/.test(e.text) ? 'spend' : 'coin') : /didn't/.test(e.text) ? 'cold' : 'warm' });
    if (e.type === 'card' || e.type === 'place') sfx.push({ at: o, kind: 'whoosh' });
  }
  cursor += to - from;
}

// "A year passed. Ada spent it with family." and anything else that happened, told about her
const FOCUS_WORDS = { family: 'with family', friends: 'with friends', school: 'studying hard', outside: 'playing outside', hustle: 'earning money',
  make: 'making things', rest: 'resting and getting well', work: 'working', explore: 'exploring everything', cuddles: 'close to family', noise: 'being loud' };
const she = film.body === 'boy' ? ['he', 'him', 'his'] : ['she', 'her', 'her'];
const aboutThem = text => text
  .replace(/^You were /, `${name} was `).replace(/^You are /, `${name} is `).replace(/^You /, `${name} `)
  .replace(/\byou were\b/g, `${she[0]} was`).replace(/\bYour\b/g, she[2].replace(/^./, c => c.toUpperCase())).replace(/\byour\b/g, she[2])
  .replace(/\byou\b/g, she[1]);
function jumpCard(day) {
  const jump = day.events.find(e => e.type === 'jump');
  const focus = day.events.find(e => e.type === 'choice' && e.kind === 'focus');
  if (!jump) return null;
  const passed = jump.heading.replace(/\bpasses\b/, 'passed').replace(/\bpass\b/, 'passed');
  const one = /^A /.test(jump.heading);
  const spent = focus && FOCUS_WORDS[focus.focus] ? `${name} spent ${one ? 'it' : 'them'} ${FOCUS_WORDS[focus.focus]}.` : '';
  const known = new Set([jump.lines[0]]);
  const events = jump.lines.filter(l => !known.has(l) && !/^You turned \d+/.test(l) && !/^You('re| are) (a |an )?(teenager|adult)|^The years have caught up|^You're not a baby/.test(l)).map(aboutThem);
  const age = day.events.find(e => e.type === 'age')?.now ?? jump.age;
  return { title: `${passed}.`, text: spent, events: events.slice(0, 2), age: jump.age ?? age };
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

// 1. Title card, then one line of premise
addCard('title', 4, { name, profile: film.profile, about: film.about, world: film.world, game: film.game });
addCard('premise', 3, { text: captionFor('premise', 'An AI lives one life in my game. Every choice is its own.') });

// 2. The prologue: the game's own captions tell it (the family's answers are told as captions too)
chapters.push({ at: cursor, title: chapterTitle('prologue', 'Before the first memory') });
addCard('chapter', 2.6, { title: chapterTitle('prologue', 'Before the first memory'), sub: 'Birth to age 4' });
const prologueEnd = firstMemory?.t ?? end;
const beats = log.filter(e => e.t >= (firstScene?.t ?? 0) && e.t < prologueEnd && ['caption', 'prologue-scene'].includes(e.type));
beats.forEach((b, i) => {
  const next = beats[i + 1]?.t ?? prologueEnd;
  if (b.type === 'prologue-scene') return addClip(b.t + 0.2, Math.min(next, b.t + 1.0));
  return addClip(b.t, Math.min(next, b.t + b.text.length * 0.028 + 2.9));
});

// 3. The played days. Each stage of life (child, teen, adult, elder) gets its days with something new
// in them shown in full (a chapter per age), then one ordinary day so we see the character at that
// age, then the time jumps where something happened, each as a short caption card over a glimpse of
// the next morning.
const STAGE_NAMES = { child: 'childhood', teen: 'the teenage years', adult: 'grown up', elder: 'the grey years' };
const addJump = day => {
  const card = jumpCard(day);
  if (card) addCard('jump', card.events.length ? 3.4 : 2.6, card);
};
const playDay = (day, chapter) => {
  if (chapter) {
    chapters.push({ at: cursor, title: chapter.title });
    addCard('chapter', 2.6, chapter);
  } else {
    addClip(day.card.t, day.card.t + 1.9); // the game's own "Day 12 of Bloom" card
  }
  for (const r of keepRanges(day, { quiet: false })) addClip(r.from, r.to);
  addJump(day);
};
let lastAge = null;
for (const stage of ['child', 'teen', 'adult', 'elder']) {
  const inStage = days.filter(d => d.stage === stage);
  if (!inStage.length) continue;
  for (const day of inStage.filter(d => d.interesting)) {
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
  chapters.push({ at: cursor, title });
  addCard('chapter', showcase.talks.length ? 2.6 : 2.4, { title, sub: '' });
  // The time jumps where something happened, briefly, all in the order they happened
  const others = rest.filter(d => d !== showcase);
  const eventful = others.filter(d => (jumpCard(d)?.events.length ?? 0) > 0);
  const brief = new Set((eventful.length ? eventful : others).slice(0, stage === 'adult' ? 6 : 4));
  for (const d of rest) {
    if (d === showcase && showcase.talks.length) {
      for (const r of keepRanges(d, { quiet: false })) addClip(r.from, r.to);
      addJump(d);
    } else if (brief.has(d) || d === showcase) {
      for (const r of keepRanges(d, { quiet: true })) addClip(r.from, r.to);
      addJump(d);
    }
  }
}

// 4. The end: our end card, with the numbers taken from the log
if (story) {
  chapters.push({ at: cursor, title: 'The end of a life' });
  addCard('quote', 2.6, { text: captionFor('end1', 'And then, one day...') });
  const choices = log.filter(e => e.type === 'choice');
  const people = new Set(log.filter(e => e.type === 'talk').map(e => e.with));
  // Moments for the end card from the whole life: one from each of the first few ages, then how it ended
  const seenMoments = new Set();
  const all = log.filter(e => e.type === 'memory' && e.memoryAge >= 5 && !/^Turned \d+/.test(e.text) && !seenMoments.has(e.text) && seenMoments.add(e.text))
    .map(e => ({ age: e.memoryAge, text: e.text }));
  const early = all.filter((m, i) => all.findIndex(x => x.age === m.age) === i).slice(0, 3);
  const moments = all.length > 5 ? [...early, ...all.slice(-2).filter(m => !early.includes(m))] : all;
  addCard('end', 14, {
    story, moments, question: captionFor('end-question', 'What would YOU have done differently?'),
    stats: { choices: choices.length, conversations: log.filter(e => e.type === 'talk').length, people: people.size, playedDays: days.length, profile: film.profile }
  });
}

// The facts for the YouTube text, straight from the log, so the description never gets a number wrong
const facts = {
  name, personality: film.profile, livedTo: story?.age ?? null, years: story?.years ?? null, cause: story?.cause ?? null,
  rememberedAs: story?.traits ?? [], closest: story?.closest ?? [], leftBehind: story?.money ?? null,
  choices: log.filter(e => e.type === 'choice').length, conversations: log.filter(e => e.type === 'talk').length, playedDays: days.length,
  people: [...new Set(log.filter(e => e.type === 'talk').map(e => e.with))]
};
fs.writeFileSync(path.join(epDir, 'facts.json'), JSON.stringify(facts, null, 1));

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
const plan = { id, fps: FPS, width: 1920, height: 1080, duration, frames: Math.ceil(duration * FPS), footage: `episode/${id}/footage-16x9.mp4`, soundtrack: `episode/${id}/soundtrack.wav`, name, items, captions, chips: [], lines, chapters };
fs.writeFileSync(path.join(pubDir, 'plan.json'), JSON.stringify(plan, null, 1));
makeSoundtrack(path.join(pubDir, 'soundtrack.wav'), duration, sfx, { cards: items.filter(i => i.kind !== 'clip').map(i => ({ at: i.at, kind: i.kind, dur: i.dur })), lines });

if (!chapters.length || chapters[0].at > 0) chapters.unshift({ at: 0, title: `Meet ${name}` });
fs.writeFileSync(path.join(epDir, 'chapters.txt'), chapters.map(c => `${mmss(c.at)} ${c.title}`).join('\n'));
console.log(`Planned ${id}: ${mmss(duration)} long, ${items.filter(i => i.kind === 'clip').length} clips, ${chapters.length} chapters, ${captions.length} captions.`);
console.log(chapters.map(c => `  ${mmss(c.at)} ${c.title}`).join('\n'));
