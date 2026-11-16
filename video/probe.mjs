// Plays a life in film mode without recording anything, as fast as possible, and prints what happened.
// For checking the autopilot before a long recording:
//   node probe.mjs --seed 7 --personality kind [--until 3000] [--trace 190-260]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { serveGameSnapshot } from './snapshot.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const query = new URLSearchParams({ name: args.name ?? 'Ada', body: args.body ?? 'girl', skin: String(args.skin ?? 3), personality: args.personality ?? 'kind', seed: String(args.seed ?? 7), quality: args.render ? 'high' : 'low' });
const snapshot = args.url ? null : await serveGameSnapshot();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.on('pageerror', err => console.log('[game error]', err.message));
await page.goto(`${args.url ?? snapshot.url}?film&step&${query}`);
await page.waitForFunction(() => window.film && window.film.step);
const [traceFrom, traceTo] = String(args.trace ?? '-1--1').split('-').map(Number);
const until = Number(args.until ?? 100000);
const started = Date.now();
const result = await page.evaluate(async ({ until, traceFrom, traceTo, render, stopAfter }) => {
  const film = window.film;
  const game = window.game;
  film.capture = render;
  const trace = [];
  let sim = 0;
  let i = 0;
  while (!film.done && sim < until && !(stopAfter && film.log.some(e => e.type === 'closing' && e.bigDay === stopAfter))) {
    const r = await film.step();
    sim = r.sim;
    if (sim >= traceFrom && sim <= traceTo && i++ % 10 === 0 && game.player) {
      const t = film.pilot.task;
      trace.push([Math.round(sim * 10) / 10, game.people.map(p => `${p.id}@${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)}${p.leaving ? "L" : ""}${p.route.length ? "R" : ""}`).join(" "), t?.kind, t?.place ?? '', game.mode, game.place?.id, +game.player.pos.x.toFixed(2), +game.player.pos.z.toFixed(2), +game.input.move.x.toFixed(2), +game.input.move.z.toFixed(2), t?.nav?.path?.length ?? '-']);
    }
  }
  return { log: film.log, trace, done: film.done, sim };
}, { until, traceFrom, traceTo, render: Boolean(args.render), stopAfter: args.stopAfter ?? null });
const skip = new Set(['memory', 'feeling', 'line', 'caption', 'timelapse-end', 'place']);
for (const e of result.log) {
  if (skip.has(e.type) && !args.all) continue;
  console.log(`${String(Math.round(e.sim)).padStart(5)}s age ${String(e.age ?? '-').padStart(2)} ${String(e.hour ?? '').padStart(4)}h  ${e.type.padEnd(12)} ${e.text ?? e.to ?? e.with ?? e.title ?? e.heading ?? ''}${e.convo ? ` [${e.convo}${e.moment ? ', moment' : ''}]` : ''}${e.until !== undefined ? ` until ${e.until}${e.near ? ' near ' + e.near : ''}` : ''} ${e.reason ? `(${e.reason})` : ''}${e.lines ? ` | ${e.lines.join(' | ')}` : ''}`);
}
for (const t of result.trace) console.log('trace', JSON.stringify(t));
if (args.id) {
  // Saved for planning the edit, and the settings, so the recording plays the very same life
  const dir = new URL(`./episodes/${args.id}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(new URL('log-probe.json', dir), JSON.stringify(result.log, null, 1));
  fs.writeFileSync(new URL('life.json', dir), JSON.stringify(Object.fromEntries(query), null, 1));
  console.log(`Saved episodes/${args.id}/log-probe.json and life.json`);
}
console.log(`Finished: ${result.done ? 'the life ended' : 'stopped'} at ${Math.round(result.sim)}s of game time, in ${((Date.now() - started) / 1000).toFixed(0)}s`);
await browser.close();
snapshot?.close();
