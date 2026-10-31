// Ayuda para escoger las voces de ElevenLabs.
//   node scripts/voices-tool.mjs mine                      → voces de tu cuenta
//   node scripts/voices-tool.mjs list [búsqueda]           → biblioteca pública en español
//   node scripts/voices-tool.mjs add <owner_id> <voice_id> <nombre>
//   node scripts/voices-tool.mjs design <personaje> [variante]   → 3 muestras (A, B, C) desde la descripción de voices.json
//   node scripts/voices-tool.mjs save <A|B|C|generated_voice_id> <personaje> [variante]
//   (personaje: trader, claude, gpt; las variantes salen de "variants" en voices.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eleven } from './elevenlabs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(ROOT, 'voices.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);

// Texto de las muestras: frases del personaje (la API pide 100 caracteres o más).
const SAMPLES = {
  trader:
    '[whispers urgently] Claude, el bitcoin se está cayendo. ¡Haz algo! [whispers] ¿Qué hiciste? ¿Qué experto? ' +
    '[whispers loudly, panicking] ¿¡Y el stop loss!?',
  claude:
    '[whispers] Hecho. Compré más. Promediar a la baja, lo recomienda un experto. ' +
    'Tú, en tu curso de cuatrocientos noventa y nueve dólares. Tranquilo… no es pérdida, es contenido.',
  gpt:
    '[excited] ¡Hola! ¡Soy ChatGPT! ¡Qué emoción ayudarte hoy! ¡Excelente pregunta! Aquí tienes doce factores ' +
    'a considerar. ¡Tienes toda la razón, me disculpo! ¿Quieres que te lo haga en una tabla?',
};
const designDir = (who, variant) => path.join(ROOT, 'audio', 'voice-design', variant ? `${who}-${variant}` : who);
const describe = (who, variant) => (variant && cfg[who].variants?.[variant]) || cfg[who].description;

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
  const [who, variant] = rest;
  const r = await eleven('POST', '/v1/text-to-voice/design', {
    voice_description: describe(who, variant),
    model_id: cfg.design_model_id,
    text: SAMPLES[who],
  });
  const dir = designDir(who, variant);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, p] of r.previews.entries()) {
    const f = path.join(dir, `${'ABC'[i] ?? i}_${p.generated_voice_id}.mp3`);
    fs.writeFileSync(f, Buffer.from(p.audio_base_64, 'base64'));
    console.log(`${path.relative(ROOT, f)}  (${p.duration_secs?.toFixed(1)} s)`);
  }
  console.log(`Escucha las muestras y guarda la mejor: node scripts/voices-tool.mjs save <A|B|C> ${rest.join(' ')}`);
} else if (cmd === 'save') {
  let [gen, who, variant] = rest;
  if (/^[ABC]$/i.test(gen)) {
    const f = fs.readdirSync(designDir(who, variant)).find((n) => n.startsWith(gen.toUpperCase() + '_'));
    gen = f.slice(2, -4);
  }
  const r = await eleven('POST', '/v1/text-to-voice', {
    voice_name: `video-trading ${who}`,
    voice_description: describe(who, variant),
    generated_voice_id: gen,
  });
  cfg[who].voice_id = r.voice_id;
  if (variant) cfg[who].description = describe(who, variant);
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`voices.json → ${who}.voice_id = ${r.voice_id}`);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n'));
}
