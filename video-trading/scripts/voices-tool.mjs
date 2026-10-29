// Ayuda para escoger las voces de ElevenLabs.
//   node scripts/voices-tool.mjs mine                      → voces de tu cuenta
//   node scripts/voices-tool.mjs list [búsqueda]           → biblioteca pública en español
//   node scripts/voices-tool.mjs add <owner_id> <voice_id> <nombre>
//   node scripts/voices-tool.mjs design trader|claude      → diseña una voz desde la descripción de voices.json
//   node scripts/voices-tool.mjs save <generated_voice_id> trader|claude
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eleven } from './elevenlabs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(ROOT, 'voices.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);

const SAMPLE = 'Claude, el bitcoin se está cayendo. ¡Haz algo! … Tranquilo. No es pérdida, es contenido.';

if (cmd === 'mine') {
  const r = await eleven('GET', '/v2/voices?page_size=100');
  for (const v of r.voices) console.log(`${v.voice_id}  ${v.name}  ${JSON.stringify(v.labels || {})}`);
} else if (cmd === 'list') {
  const q = new URLSearchParams({ page_size: '40', language: 'es' });
  if (rest.length) q.set('search', rest.join(' '));
  const r = await eleven('GET', `/v1/shared-voices?${q}`);
  for (const v of r.voices) {
    console.log(
      `${v.voice_id}  owner=${v.public_owner_id}  ${v.name} · ${v.gender}/${v.age} · acento: ${v.accent} · ${v.use_case}\n` +
        `   ${(v.description || '').slice(0, 140)}\n   muestra: ${v.preview_url}`
    );
  }
} else if (cmd === 'add') {
  const [owner, voiceId, ...name] = rest;
  const r = await eleven('POST', `/v1/voices/add/${owner}/${voiceId}`, { new_name: name.join(' ') || voiceId });
  console.log('Agregada a tu cuenta:', r.voice_id);
} else if (cmd === 'design') {
  const who = rest[0];
  const r = await eleven('POST', '/v1/text-to-voice/design', {
    voice_description: cfg[who].description,
    text: SAMPLE.padEnd(100, ' .'),
  });
  const dir = path.join(ROOT, 'audio', 'voice-design', who);
  fs.mkdirSync(dir, { recursive: true });
  for (const p of r.previews) {
    const f = path.join(dir, `${p.generated_voice_id}.mp3`);
    fs.writeFileSync(f, Buffer.from(p.audio_base_64, 'base64'));
    console.log(`${p.generated_voice_id}  → ${path.relative(ROOT, f)}`);
  }
  console.log(`Escucha las muestras y guarda la mejor: node scripts/voices-tool.mjs save <generated_voice_id> ${who}`);
} else if (cmd === 'save') {
  const [gen, who] = rest;
  const r = await eleven('POST', '/v1/text-to-voice', {
    voice_name: `video-trading ${who}`,
    voice_description: cfg[who].description,
    generated_voice_id: gen,
  });
  cfg[who].voice_id = r.voice_id;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`voices.json → ${who}.voice_id = ${r.voice_id}`);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n'));
}
