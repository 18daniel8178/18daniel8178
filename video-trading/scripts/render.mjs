// Renderiza un episodio a MP4 vertical (1080x1920, 30 fps) con voces y efectos.
//   node scripts/render.mjs episodes/ep01-bitcoin.json
//   node scripts/render.mjs episodes/ep01-bitcoin.json --stills 1.2,4.5   (solo capturas PNG)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildTimeline } from './build-timeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const epPath = args.find((a) => a.endsWith('.json')) || path.join(ROOT, 'episodes/ep01-bitcoin.json');
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

// Playwright: usa el instalado globalmente si no está en el proyecto.
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Falta Playwright: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

await build({
  entryPoints: [path.join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(ROOT, 'build/app.js'),
  logLevel: 'warning',
});

const tl = buildTimeline(epPath);
const outDir = path.join(ROOT, 'out');
fs.mkdirSync(outDir, { recursive: true });
console.log(`${tl.id}: ${tl.duration.toFixed(2)} s · voces reales ${tl.voices}/${tl.segments.filter((s) => !s.silent).length}`);

const browser = await playwright.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: tl.width, height: tl.height } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto('file://' + path.join(ROOT, 'page/index.html'));
await page.evaluate((t) => window.setupScene(t), tl);
const clip = { x: 0, y: 0, width: tl.width, height: tl.height };

const stills = opt('--stills');
if (stills) {
  const dir = path.join(outDir, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',').map(Number)) {
    await page.evaluate((t) => window.renderAt(t), s);
    const f = path.join(dir, `${tl.id}_${s.toFixed(2)}.png`);
    await page.screenshot({ path: f, clip });
    console.log(f);
  }
  await browser.close();
  process.exit(0);
}

const silent = path.join(outDir, `${tl.id}.video.mp4`);
const ff = spawn('ffmpeg', [
  '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', silent,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.ceil(tl.duration * tl.fps);
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.renderAt(t), f / tl.fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 93, clip });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`\rframes listos en ${((Date.now() - t0) / 1000).toFixed(0)} s          `);

// Mezcla de audio: voces en su tiempo + efectos, normalizado para TikTok.
// La alarma es mucho más fuerte que los demás efectos y tapaba el susurro de encima.
const SFX_GAIN = { alarm: 0.5 };
const inputs = [];
const filters = [];
const add = (file, at, vol) => {
  const i = inputs.length / 2 + 1;
  inputs.push('-i', file);
  filters.push(`[${i}:a]aresample=44100,aformat=channel_layouts=mono,volume=${vol},adelay=${Math.round(at * 1000)}:all=1[a${i}]`);
  return `[a${i}]`;
};
const labels = [];
for (const s of tl.segments) {
  if (s.audio) labels.push(add(path.join(ROOT, s.audio), s.voiceStart, 1.0));
  if (s.sfx) {
    const fx = path.join(ROOT, 'assets/sfx', `${s.sfx}.wav`);
    if (fs.existsSync(fx)) labels.push(add(fx, s.start + 0.02, (s.audio || tl.voices ? 0.35 : 0.6) * (SFX_GAIN[s.sfx] ?? 1)));
  }
}
const final = path.join(outDir, `${tl.id}.mp4`);
const dur = tl.duration.toFixed(3);
const base = ['-f', 'lavfi', '-t', dur, '-i', 'anullsrc=r=44100:cl=mono'];
let filter = '[0:a]anull[base]';
if (labels.length) {
  filter = [
    ...filters,
    `[0:a]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first,` +
      `loudnorm=I=-14:TP=-1.5:LRA=11[aout]`,
  ].join(';');
} else {
  filter = '[0:a]anull[aout]';
}
const audioOut = path.join(outDir, `${tl.id}.audio.m4a`);
execFileSync('ffmpeg', ['-v', 'error', '-y', ...base, ...inputs, '-filter_complex', filter, '-map', '[aout]', '-t', dur, '-c:a', 'aac', '-b:a', '192k', audioOut]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', audioOut, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', final]);
fs.rmSync(silent);
fs.rmSync(audioOut);
console.log('Listo:', final);
