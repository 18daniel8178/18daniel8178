// Genera las voces de un episodio con ElevenLabs (con tiempos por carácter
// para los subtítulos). Guarda audio/<episodio>/NN.mp3 y NN.json.
// Si una línea no cambió, no la vuelve a generar (ahorra créditos).
//   node scripts/generate-voices.mjs episodes/ep01-bitcoin.json [--force]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

for (const who of ['trader', 'claude']) {
  if (!cfg[who]?.voice_id) {
    console.error(`Falta voice_id para "${who}" en voices.json. Usa: node scripts/voices-tool.mjs list`);
    process.exit(1);
  }
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
  made++;
  console.log('ok');
}
console.log(`Voces: ${made} nuevas, ${cached} sin cambios → ${path.relative(ROOT, outDir)}/`);
