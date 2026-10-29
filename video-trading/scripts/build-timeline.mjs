// Convierte un episodio (guion) en una línea de tiempo con tiempos exactos.
// Si existen los audios en audio/<episodio>/NN.mp3 (+ NN.json con la alineación
// de ElevenLabs) usa los tiempos reales; si no, estima tiempos para previsualizar.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const LEAD = 0.12; // aire antes de que hable en cada toma
const TAIL = 0.24; // aire después de hablar antes del corte

const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function estimateWords(text) {
  const words = [];
  let t = 0;
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    const letters = tok.replace(/[^\p{L}]/gu, '').length + tok.replace(/[^\p{N}]/gu, '').length * 4;
    const d = 0.12 + letters * 0.056;
    words.push({ text: tok, start: t, end: t + d });
    t += d + (/,$/.test(tok) ? 0.16 : /[.!?…]$/.test(tok) ? 0.3 : 0.03);
  }
  return { words, duration: words.at(-1).end + 0.05 };
}

function estimateEnvelope(words, duration) {
  const n = Math.ceil(duration * FPS);
  const env = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const w = words.find((x) => t >= x.start && t < x.end);
    if (w) env[i] = 0.25 + 0.55 * Math.abs(Math.sin((Math.PI * (t - w.start)) / 0.17));
  }
  return env;
}

// Tiempos por palabra a partir de la alineación por carácter de ElevenLabs.
function alignWords(text, alignment, duration) {
  const { characters, character_start_times_seconds: st, character_end_times_seconds: en } = alignment;
  const chars = [], idx = [];
  characters.forEach((c, i) => {
    for (const ch of norm(c)) {
      chars.push(ch);
      idx.push(i);
    }
  });
  const hay = chars.join('');
  let cursor = 0;
  const words = text.split(/\s+/).filter(Boolean).map((tok) => {
    const w = norm(tok);
    const pos = w ? hay.indexOf(w, cursor) : -1;
    if (pos < 0) return { text: tok, start: null, end: null };
    cursor = pos + w.length;
    return { text: tok, start: st[idx[pos]], end: en[idx[pos + w.length - 1]] };
  });
  // Rellena palabras no encontradas (p. ej. números leídos en letra) interpolando.
  for (let i = 0; i < words.length; i++) {
    if (words[i].start != null) continue;
    const prev = words.slice(0, i).reverse().find((w) => w.start != null);
    let j = i;
    while (j < words.length && words[j].start == null) j++;
    const a = prev ? prev.end : 0;
    const b = j < words.length ? words[j].start : duration;
    const n = j - i;
    for (let k = 0; k < n; k++) {
      words[i + k].start = a + ((b - a) * k) / n;
      words[i + k].end = a + ((b - a) * (k + 1)) / n;
    }
  }
  return words;
}

function audioDuration(file) {
  return parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString()
  );
}

// Volumen por frame (para mover la boca), normalizado 0..1.
function audioEnvelope(file) {
  const sr = 16000;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 28,
  });
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const hop = sr / FPS;
  const rms = [];
  for (let i = 0; i < pcm.length; i += hop) {
    let s = 0, n = 0;
    for (let j = i; j < Math.min(pcm.length, i + hop); j++, n++) s += pcm[j] * pcm[j];
    rms.push(Math.sqrt(s / Math.max(1, n)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
  return rms.map((v) => Math.min(1, Math.max(0, (v / ref - 0.12) / 0.88)) ** 0.7);
}

export function buildTimeline(episodePath) {
  const ep = JSON.parse(fs.readFileSync(episodePath, 'utf8'));
  const audioDir = path.join(ROOT, 'audio', ep.id);
  let t = 0;
  let usedAudio = 0;
  const segments = ep.lines.map((line, i) => {
    const id = String(i + 1).padStart(2, '0');
    const seg = { ...line, index: i, id };
    delete seg.tag;
    if (line.silent) {
      Object.assign(seg, { start: t, end: t + line.silent, voiceStart: t, voiceEnd: t });
      t = seg.end;
      return seg;
    }
    const mp3 = path.join(audioDir, `${id}.mp3`);
    const align = path.join(audioDir, `${id}.json`);
    let words, duration, env, audio = null;
    if (fs.existsSync(mp3)) {
      duration = audioDuration(mp3);
      env = audioEnvelope(mp3);
      words = fs.existsSync(align)
        ? alignWords(line.text, JSON.parse(fs.readFileSync(align, 'utf8')).alignment, duration)
        : estimateWords(line.text).words;
      audio = path.relative(ROOT, mp3);
      usedAudio++;
    } else {
      ({ words, duration } = estimateWords(line.text));
      env = estimateEnvelope(words, duration);
    }
    const voiceStart = t + LEAD;
    seg.voiceStart = voiceStart;
    seg.voiceEnd = voiceStart + duration;
    seg.start = t;
    seg.end = seg.voiceEnd + (line.tail ?? TAIL);
    seg.words = words.map((w) => ({ text: w.text, start: voiceStart + w.start, end: voiceStart + w.end }));
    seg.env = env.map((v) => Math.round(v * 100) / 100);
    seg.audio = audio;
    seg.cuts = (line.cuts || []).map((c) => ({
      shot: c.shot,
      screen: c.screen,
      at: seg.words[Math.min(c.fromWord, seg.words.length - 1)].start - 0.06,
    }));
    t = seg.end;
    return seg;
  });
  return {
    id: ep.id,
    title: ep.title,
    clock: ep.clock,
    fps: FPS,
    width: 1080,
    height: 1920,
    duration: t,
    voices: usedAudio,
    segments,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ep = process.argv[2] || path.join(ROOT, 'episodes/ep01-bitcoin.json');
  const tl = buildTimeline(ep);
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  const out = path.join(ROOT, 'build', `${tl.id}.timeline.json`);
  fs.writeFileSync(out, JSON.stringify(tl, null, 1));
  console.log(`${out}: ${tl.duration.toFixed(2)} s, ${tl.segments.length} tomas, voces reales: ${tl.voices}`);
}
