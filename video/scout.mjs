// Finds dramatic lives to film. Plays many lives quickly, without drawing them, from different seeds and
// personalities, scores each one for drama, and prints the best.
//
//   node scout.mjs --seeds 1-12 --personalities troublemaker,kind,ambitious,dreamer --until the-baby
//   node scout.mjs --seeds 1-30 --personalities troublemaker --body girl --until scholarship
//
// --until stops each life after that big day's closing line (much faster than a whole life).
// Results are saved in episodes/_scout/results.json; the best life's command line is printed at the end.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const [s0, s1] = String(args.seeds ?? '1-8').split('-').map(Number);
const seeds = Array.from({ length: (s1 ?? s0) - s0 + 1 }, (_, i) => s0 + i);
const personalities = String(args.personalities ?? 'troublemaker,kind,ambitious,dreamer').split(',');
const NAMES = { boy: 'Remy', girl: 'Lena' };
const outDir = path.join(here, 'episodes', '_scout');
fs.mkdirSync(outDir, { recursive: true });

// What makes a life gripping, read from its log
export function dramaScore(log) {
  const parts = {};
  const add = (k, v) => { parts[k] = (parts[k] ?? 0) + v; };
  const choices = log.filter(e => e.type === 'choice' && e.kind !== 'focus');
  // Big decisions, and choices that stir things up (cheek, boldness, secrets kept)
  for (const c of choices) {
    add('big decisions', Math.min(6, c.weight ?? 0) * 0.6);
    if (/pure cheek|the bold move/.test(c.reason)) add('nerve', 1.2);
    if (/^\(/.test(c.text) && /(bin|hide|keep it|say nothing|yourself)/i.test(c.text)) add('secrets', 2.5);
  }
  // People's feelings swinging: someone pleased, someone hurt
  for (const f of log.filter(e => e.type === 'feeling')) {
    if (/didn't like/.test(f.text)) add('hurt feelings', 2);
    else if (/liked that/.test(f.text)) add('warmth', 0.3);
    if (/^-\d+ livs/.test(f.text)) add('money trouble', 0.6);
  }
  // What happened in the time jumps: illness, accidents, fallings-out, windfalls, losses
  for (const j of log.filter(e => e.type === 'jump')) {
    for (const line of j.lines ?? []) {
      if (/ill|fever|hurt|accident|broke your/i.test(line)) add('hardship', 1.5);
      if (/falling-out|talked you out of|scam/i.test(line)) add('betrayal', 2.5);
      if (/prize|paid back|found \d+/i.test(line)) add('luck', 0.8);
    }
  }
  // The man in the green coat, and anything angry or shouted
  if (log.some(e => e.type === 'talk' && e.id === 'corin')) add('the stranger', 3);
  add('raised voices', log.filter(e => e.type === 'line' && /!/.test(e.text) && /\b(no|get away|stop|how dare|never)\b/i.test(e.text)).length * 1.5);
  if (log.some(e => e.type === 'story')) add('a death', 4);
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total: Math.round(total * 10) / 10, parts };
}

const results = [];
for (const personality of personalities) {
  for (const seed of seeds) {
    const body = args.body ?? (seed % 2 ? 'boy' : 'girl');
    const id = `_scout/${personality}-${seed}`;
    const list = ['probe.mjs', '--id', id, '--seed', String(seed), '--personality', personality, '--name', NAMES[body], '--body', body, '--skin', String(args.skin ?? 5)];
    if (args.until) list.push('--stopAfter', args.until);
    if (results.length) list.push('--reuseBuild'); // one snapshot of the game for every life
    const r = spawnSync(process.execPath, list, { cwd: here, encoding: 'utf8' });
    const logFile = path.join(here, 'episodes', id, 'log-probe.json');
    if (r.status !== 0 || !fs.existsSync(logFile)) { console.log(`${personality} ${seed}: failed`); continue; }
    const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    const score = dramaScore(log);
    const beats = log.filter(e => e.type === 'choice' && e.kind !== 'focus' && (e.weight ?? 0) >= 2).map(e => e.text).slice(0, 6);
    results.push({ personality, seed, body, score: score.total, parts: score.parts, beats });
    console.log(`${personality.padEnd(13)} seed ${String(seed).padStart(3)}  drama ${String(score.total).padStart(5)}  ${beats.slice(0, 3).join(' | ').slice(0, 110)}`);
  }
}
results.sort((a, b) => b.score - a.score);
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 1));
console.log('\nMost dramatic:');
for (const r of results.slice(0, 5)) console.log(`  ${r.score}  ${r.personality} seed ${r.seed} (${r.body}): ${Object.entries(r.parts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
const best = results[0];
if (best) console.log(`\nTo film it:\n  node make.mjs --id <episode> --name ${NAMES[best.body]} --body ${best.body} --skin ${args.skin ?? 5} --personality ${best.personality} --seed ${best.seed}${args.until ? ` --until ${args.until}` : ''}`);
