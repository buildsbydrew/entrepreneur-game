// Renders the finished videos with Remotion, in chunks (so a crash on this small laptop only loses one
// chunk), then joins them and adds the soundtrack.
//
//   node render.mjs --id ep01 --what episode     → out/ep01-episode.mp4 (16:9)
//   node render.mjs --id ep01 --what short       → out/ep01-short.mp4 (9:16)
//   add --frames 0-299 to render just a test stretch
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const id = args.id ?? 'ep01';
const what = args.what === 'short' ? 'short' : 'episode';
const comp = what === 'short' ? 'Short' : 'Episode';
const plan = JSON.parse(fs.readFileSync(path.join(here, 'public', 'episode', id, what === 'short' ? 'short-plan.json' : 'plan.json'), 'utf8'));
const ffmpeg = path.join(here, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
const outDir = path.join(here, 'out');
const work = path.join(outDir, `${id}-${what}-chunks`);
fs.mkdirSync(work, { recursive: true });

const [first, last] = args.frames ? String(args.frames).split('-').map(Number) : [0, plan.frames - 1];
const CHUNK = Number(args.chunk ?? 1200);
const props = JSON.stringify({ id });
const run = (cmd, list, tries = 1) => {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const r = spawnSync(cmd, list, { cwd: here, stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npx' });
    if (r.status === 0) return;
    // On a small laptop Remotion sometimes loses a video frame under memory pressure; a second go works
    if (attempt < tries) console.log(`That chunk failed; trying again (${attempt + 1} of ${tries})...`);
  }
  throw new Error(`${cmd} failed`);
};

// Remotion's command line on Windows needs the props in a file
const propsFile = path.join(work, 'props.json');
fs.writeFileSync(propsFile, props);

const chunks = [];
for (let a = first; a <= last; a += CHUNK) {
  const b = Math.min(last, a + CHUNK - 1);
  const file = path.join(work, `${String(a).padStart(6, '0')}.mp4`);
  chunks.push(file);
  if (fs.existsSync(file) && !args.fresh) { console.log(`Chunk ${a}-${b} already rendered`); continue; }
  console.log(`Rendering frames ${a}-${b} of ${last}...`);
  run('npx', ['remotion', 'render', 'src/index.ts', comp, `"${file}.tmp.mp4"`, `--props="${propsFile}"`, `--frames=${a}-${b}`, '--muted', '--codec=h264', '--crf=18',
    `--image-format=${what === 'short' ? 'png' : 'jpeg'}`, '--jpeg-quality=95', '--concurrency=1', '--timeout=300000', '--offthreadvideo-cache-size-in-bytes=268435456', '--offthreadvideo-video-threads=1', '--log=info'], 4);
  fs.renameSync(`${file}.tmp.mp4`, file);
}

// Join the chunks, then lay the soundtrack under them
const list = path.join(work, 'list.txt');
fs.writeFileSync(list, chunks.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
const joined = path.join(work, 'joined.mp4');
run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
const out = path.join(outDir, args.frames ? `${id}-${what}-test.mp4` : `${id}-${what}.mp4`);
const offset = (first / plan.fps).toFixed(3);
run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', joined, '-ss', offset, '-i', path.join(here, 'public', plan.soundtrack),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', out]);
if (!args.frames && !args.keep) fs.rmSync(work, { recursive: true, force: true });
console.log(`Finished: ${out}`);
