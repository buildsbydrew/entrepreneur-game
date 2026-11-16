// Packs a snapshot of the game (vite build) into video/.game-build and serves it on a local port,
// so a recording plays a frozen copy of the game.
import { execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

export async function serveGameSnapshot({ build = true } = {}) {
  const out = path.join(here, '.game-build');
  if (build || !fs.existsSync(out)) {
    console.log('Packing a snapshot of the game...');
    execSync(`npx vite build --outDir "${out}" --emptyOutDir --logLevel warn`, { cwd: gameRoot, stdio: 'inherit' });
  }
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(out, clean === '/' ? 'index.html' : clean);
    if (!file.startsWith(out) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(out, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  return { url, close: () => server.close() };
}
