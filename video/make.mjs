// Makes a whole episode, start to finish:
//
//   node make.mjs --id ep02 --name Remy --body boy --skin 5 --personality troublemaker --seed 42
//
// A life told as a serial (one stretch of life per episode):
//   node make.mjs --id remy1 --episode 1 --until the-baby ...         ends on the night the baby came
//   node make.mjs --id remy2 --episode 2 --after the-baby --until ... starts with a "Previously" recap
//
//   1. test   plays the life quickly without drawing it, to learn what happens (a few minutes)
//   2. plan   picks the moments for the episode and the Short
//   3. record records just those moments, in 16:9 and then 9:16 (the slow part: an hour or two)
//   4. edit   builds the edits, captions and music
//   5. render renders both videos into out/
//
// Stopped half way? Add --from record (or plan, edit, render) to carry on from that step.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { keepAwake } from './keepawake.mjs';

keepAwake(); // the laptop mustn't sleep part way through (that stalls the render)

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const id = args.id ?? 'ep01';
const STEPS = ['test', 'plan', 'record', 'edit', 'render'];
const from = Math.max(0, STEPS.indexOf(args.from ?? 'test'));
// The episode's stretch of the life: --after <big day> (start after it) and --until <big day> (end on it).
// (--from is for carrying on from a step, so the episode's start is called --after here.)
const range = [['until', 'until'], ['after', 'from'], ['episode', 'episode']].filter(([k]) => args[k]).flatMap(([k, to]) => [`--${to}`, String(args[k])]);
const life = ['--name', args.name ?? 'Ada', '--body', args.body ?? 'girl', '--skin', String(args.skin ?? 3), '--personality', args.personality ?? 'kind', '--seed', String(args.seed ?? 7)];
const node = (...list) => {
  console.log(`\n> node ${list.join(' ')}`);
  const r = spawnSync(process.execPath, list, { cwd: here, stdio: 'inherit' });
  if (r.status !== 0) { console.error(`Stopped: that step failed. Fix it, then run again with --from ${STEPS[step]}`); process.exit(1); }
};

let step = 0;
for (step = from; step < STEPS.length; step++) {
  const name = STEPS[step];
  if (name === 'test') node('probe.mjs', '--id', id, ...life, ...(args.until ? ['--stopAfter', args.until] : []));
  if (name === 'plan') { node('plan.mjs', '--id', id, '--windows', ...range); node('short.mjs', '--id', id, '--windows', ...range); }
  if (name === 'record') {
    // The same life settings as the test run, so the same life plays out
    const saved = JSON.parse(fs.readFileSync(path.join(here, 'episodes', id, 'life.json'), 'utf8'));
    const same = Object.entries(saved).filter(([k]) => k !== 'quality').flatMap(([k, v]) => [`--${k}`, v]);
    node('record.mjs', '--id', id, ...same, '--reuseBuild', '--windows', `episodes/${id}/episode-windows.json`);
    node('record.mjs', '--id', id, ...same, '--reuseBuild', '--aspect', '9:16', '--windows', `episodes/${id}/short-windows.json`);
  }
  if (name === 'edit') { node('plan.mjs', '--id', id, ...range); node('short.mjs', '--id', id, ...range); }
  if (name === 'render') { node('render.mjs', '--id', id, '--what', 'episode'); node('render.mjs', '--id', id, '--what', 'short'); }
}
console.log(`\nAll done. Videos: video/out/${id}-episode.mp4 and video/out/${id}-short.mp4`);
