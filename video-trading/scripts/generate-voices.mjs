// Genera las voces de un episodio con ElevenLabs (con tiempos por carácter
// para los subtítulos). Guarda audio/<episodio>/NN.mp3 y NN.json.
// Si una línea no cambió, no la vuelve a generar (ahorra créditos).
// Recorta el silencio del principio y del final (v3 a veces deja 1-2 s mudos
// antes de hablar) y corre los tiempos de los subtítulos lo mismo.
//   node scripts/generate-voices.mjs episodes/ep01-bitcoin.json [--force]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { eleven } from './elevenlabs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const epPath = args.find((a) => a.endsWith('.json')) || path.join(ROOT, 'episodes/ep01-bitcoin.json');
const force = args.includes('--force');

const ep = JSON.parse(fs.readFileSync(epPath, 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'voices.json'), 'utf8'));
const outDir = path.join(ROOT, 'audio', ep.id);
fs.mkdirSync(outDir, { recursive: true });

for (const who of new Set(ep.lines.filter((l) => !l.silent).map((l) => l.who))) {
  if (!cfg[who]?.voice_id) {
    console.error(`Falta voice_id para "${who}" en voices.json. Usa: node scripts/voices-tool.mjs list`);
    process.exit(1);
  }
}

// Inicio y fin de la voz: primer y último tramo de 60 ms seguidos por encima de -45 dBFS
// (más corto que eso suele ser un clic).
function speechBounds(file) {
  const sr = 16000, hop = 160;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 28,
  });
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const loud = [];
  for (let i = 0; i < pcm.length; i += hop) {
    let s = 0;
    for (let j = i; j < Math.min(pcm.length, i + hop); j++) s += pcm[j] * pcm[j];
    loud.push(10 * Math.log10(s / hop + 1e-12) > -45);
  }
  const N = 6;
  const run = (k) => loud.slice(k, k + N).length === N && loud.slice(k, k + N).every(Boolean);
  let a = 0, b = loud.length - 1;
  while (a < loud.length - N && !run(a)) a++;
  while (b > a + N && !run(b - N + 1)) b--;
  return { start: (a * hop) / sr, end: ((b + 1) * hop) / sr, duration: pcm.length / sr };
}

function trimSilence(mp3, metaFile) {
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  if (meta.trim) return;
  const { start, end, duration } = speechBounds(mp3);
  const a = Math.max(0, start - 0.06), b = Math.min(duration, end + 0.2);
  const tmp = mp3.replace(/\.mp3$/, '.tmp.mp3');
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', mp3,
    '-af', `atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.01`,
    '-c:a', 'libmp3lame', '-b:a', '128k', tmp,
  ]);
  fs.renameSync(tmp, mp3);
  for (const al of [meta.alignment, meta.normalized_alignment]) {
    if (!al) continue;
    for (const k of ['character_start_times_seconds', 'character_end_times_seconds'])
      al[k] = al[k].map((t) => Math.round(Math.min(b - a, Math.max(0, t - a)) * 1000) / 1000);
  }
  meta.trim = [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000];
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
}

let made = 0, cached = 0;
for (const [i, line] of ep.lines.entries()) {
  if (line.silent) continue;
  const id = String(i + 1).padStart(2, '0');
  const voice = cfg[line.who];
  const text = cfg.use_tags && line.tag ? `${line.tag} ${line.text}` : line.text;
  const body = {
    text,
    model_id: cfg.model_id,
    voice_settings: voice.settings,
    ...(cfg.language_code ? { language_code: cfg.language_code } : {}),
    ...(line.seed != null ? { seed: line.seed } : {}),
  };
  const hash = crypto.createHash('sha1').update(JSON.stringify([voice.voice_id, body])).digest('hex');
  const mp3 = path.join(outDir, `${id}.mp3`);
  const meta = path.join(outDir, `${id}.json`);
  if (!force && fs.existsSync(mp3) && fs.existsSync(meta) && JSON.parse(fs.readFileSync(meta, 'utf8')).hash === hash) {
    trimSilence(mp3, meta);
    cached++;
    continue;
  }
  process.stdout.write(`${id} ${line.who}: ${text} … `);
  const res = await eleven(
    'POST',
    `/v1/text-to-speech/${voice.voice_id}/with-timestamps?output_format=${cfg.output_format}`,
    body
  );
  fs.writeFileSync(mp3, Buffer.from(res.audio_base64, 'base64'));
  fs.writeFileSync(
    meta,
    JSON.stringify({ hash, text, alignment: res.alignment, normalized_alignment: res.normalized_alignment }, null, 1)
  );
  trimSilence(mp3, meta);
  made++;
  console.log('ok');
}
console.log(`Voces: ${made} nuevas, ${cached} sin cambios → ${path.relative(ROOT, outDir)}/`);
