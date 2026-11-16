// Records one autopiloted life from the game, frame by frame, into a video file plus the life log.
//
//   node record.mjs --id ep01 --name Ada --body girl --skin 3 --personality kind --seed 7
//   node record.mjs --id ep01 --aspect 9:16 --windows episodes/ep01/short-windows.json   (the vertical Short)
//
// It first packs a snapshot of the game (vite build) and plays that, so edits made to the game while
// a recording runs can't disturb it. (--url http://localhost:5173/ plays the dev server instead.)
// It uses your installed Chrome with a fresh, empty profile, so your own saved life is never touched.
// Time in the game only moves when this script asks for the next frame, so the footage is smooth
// even on a slow computer, and the same seed always gives the same life.
// Output: episodes/<id>/footage-16x9.mp4 (or -9x16), log.json, meta.json
import { chromium } from 'playwright-core';
import { serveGameSnapshot } from './snapshot.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const id = args.id ?? 'ep01';
const aspect = args.aspect === '9:16' ? '9:16' : '16:9';
const [W, H] = aspect === '9:16' ? [1080, 1920] : [1920, 1080];
const fps = Number(args.fps ?? 30);
const maxMinutes = Number(args.maxMinutes ?? 240);   // safety stop, in game-time minutes of recording
const snapshot = args.url ? null : await serveGameSnapshot({ build: !args.reuseBuild }); // --reuseBuild: play the same snapshot as the test run
const base = args.url ?? snapshot.url;
const outDir = path.join(here, 'episodes', id);
fs.mkdirSync(outDir, { recursive: true });
const tag = aspect === '9:16' ? '9x16' : '16x9';
const footagePath = path.join(outDir, `footage-${tag}.mp4`);
const partPath = path.join(outDir, `footage-${tag}.part.mp4`);
const logPath = path.join(outDir, aspect === '9:16' ? 'log-9x16.json' : 'log.json');
// Only record these stretches (seconds since the start, from the landscape log): for the Short
const windows = args.windows ? JSON.parse(fs.readFileSync(path.resolve(args.windows), 'utf8')) : null;

const query = new URLSearchParams({ name: args.name ?? 'Ada', body: args.body ?? 'girl', skin: String(args.skin ?? 3), personality: args.personality ?? 'kind', seed: String(args.seed ?? 7), quality: args.quality ?? 'high' });
const url = `${base}?film&step&${query}`;
console.log(`Recording ${id} (${aspect}) from ${url}`);

const ffmpegPath = path.join(here, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
const ffmpeg = spawn(ffmpegPath, [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-bf', '0', // no B-frames: Remotion seeks through the footage more reliably
  '-g', String(fps * 2), '-movflags', '+frag_keyframe+empty_moov',
  partPath
], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = buf => new Promise(resolve => { if (!ffmpeg.stdin.write(buf)) ffmpeg.stdin.once('drain', resolve); else resolve(); });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required']
});
// The page is laid out at 1280x720 and drawn at 1.5x, so the game's text and boxes are big enough to read on a phone
const SCALE = Number(args.uiScale ?? 1.5);
const context = await browser.newContext({ viewport: { width: Math.round(W / SCALE), height: Math.round(H / SCALE) }, deviceScaleFactor: SCALE });
const page = await context.newPage();
page.on('console', msg => { if (msg.type() === 'error') console.log('[game error]', msg.text()); });
page.on('pageerror', err => console.log('[game error]', err.message));
await page.goto(url);
await page.waitForFunction(() => window.film && window.film.step, null, { timeout: 60000 });
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`Graphics: ${gpu}`);
const cdp = await context.newCDPSession(page);

let frames = 0;
let sim = 0;
let logCount = 0;
const log = [];
const started = Date.now();
const saveLog = async () => {
  const fresh = await page.evaluate(n => window.film.log.slice(n), logCount);
  log.push(...fresh);
  logCount += fresh.length;
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
};
const inWindow = s => !windows || windows.some(([a, b]) => s >= a && s < b);
const nextWindow = s => windows?.find(([a]) => a > s)?.[0];
const windowStarts = [];
let inside = false;

for (;;) {
  // Outside the wanted stretches, race ahead without drawing anything
  if (windows && !inWindow(sim)) {
    const target = nextWindow(sim);
    if (target === undefined) break;
    inside = false;
    sim = await page.evaluate(async t => {
      window.film.capture = false;
      for (;;) {
        const r = await window.film.step();
        if (r.sim >= t || r.done) return r.sim;
      }
    }, target);
    continue;
  }
  if (windows && !inside) windowStarts.push({ sim, footage: frames / fps });
  inside = Boolean(windows);
  const r = await page.evaluate(ms => { window.film.capture = true; return window.film.step(ms); }, 1000 / fps);
  sim = r.sim;
  if (r.kept) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
    await write(Buffer.from(shot.data, 'base64'));
    frames++;
    if (frames % 300 === 0) {
      await saveLog();
      const mins = (Date.now() - started) / 60000;
      const last = log[log.length - 1];
      console.log(`${(frames / fps / 60).toFixed(1)} min of footage in ${mins.toFixed(1)} min · age ${last?.age ?? '-'} · ${last?.type ?? ''}`);
    }
  }
  if (r.done || frames / fps / 60 > maxMinutes) break;
}

await saveLog();
ffmpeg.stdin.end();
await new Promise(resolve => ffmpeg.on('close', resolve));
// A normal MP4 (the recording was written in a crash-proof form; this makes it quick to edit)
await new Promise(resolve => spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', partPath, '-c', 'copy', '-movflags', '+faststart', footagePath], { stdio: 'inherit' }).on('close', resolve));
if (fs.existsSync(footagePath) && fs.statSync(footagePath).size > 0) fs.rmSync(partPath);
fs.writeFileSync(path.join(outDir, `meta-${tag}.json`), JSON.stringify({ id, aspect, width: W, height: H, fps, frames, seconds: frames / fps, url, gpu, recordedAt: new Date().toISOString(), windows: windowStarts, options: Object.fromEntries(query) }, null, 1));
await browser.close();
snapshot?.close();
console.log(`Done: ${frames} frames (${(frames / fps / 60).toFixed(1)} min) → ${footagePath}`);
