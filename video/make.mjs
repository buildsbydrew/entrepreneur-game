// Makes a whole episode, start to finish:
//
//   node make.mjs --id ep02 --name Remy --body boy --skin 5 --personality troublemaker --seed 42
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

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const id = args.id ?? 'ep01';
const STEPS = ['test', 'plan', 'record', 'edit', 'render'];
const from = Math.max(0, STEPS.indexOf(args.from ?? 'test'));
const life = ['--name', args.name ?? 'Ada', '--body', args.body ?? 'girl', '--skin', String(args.skin ?? 3), '--personality', args.personality ?? 'kind', '--seed', String(args.seed ?? 7)];
const node = (...list) => {
  console.log(`\n> node ${list.join(' ')}`);
  const r = spawnSync(process.execPath, list, { cwd: here, stdio: 'inherit' });
  if (r.status !== 0) { console.error(`Stopped: that step failed. Fix it, then run again with --from ${STEPS[step]}`); process.exit(1); }
};

let step = 0;
for (step = from; step < STEPS.length; step++) {
  const name = STEPS[step];
  if (name === 'test') node('probe.mjs', '--id', id, ...life);
  if (name === 'plan') { node('plan.mjs', '--id', id, '--windows'); node('short.mjs', '--id', id, '--windows'); }
  if (name === 'record') {
    // The same life settings as the test run, so the same life plays out
    const saved = JSON.parse(fs.readFileSync(path.join(here, 'episodes', id, 'life.json'), 'utf8'));
    const same = Object.entries(saved).filter(([k]) => k !== 'quality').flatMap(([k, v]) => [`--${k}`, v]);
    node('record.mjs', '--id', id, ...same, '--reuseBuild', '--windows', `episodes/${id}/episode-windows.json`);
    node('record.mjs', '--id', id, ...same, '--reuseBuild', '--aspect', '9:16', '--windows', `episodes/${id}/short-windows.json`);
  }
  if (name === 'edit') { node('plan.mjs', '--id', id); node('short.mjs', '--id', id); }
  if (name === 'render') { node('render.mjs', '--id', id, '--what', 'episode'); node('render.mjs', '--id', id, '--what', 'short'); }
}
console.log(`\nAll done. Videos: video/out/${id}-episode.mp4 and video/out/${id}-short.mp4`);
