import { clamp, easeOutCubic, easeOutBack, mulberry32, roundRect } from './util.js';

const RED = '#ff3d4f';
const GREEN = '#22d39a';
const FONT = 'Inter, sans-serif';

// Serie de precios bajista, determinista por semilla.
function series(seed, n) {
  const rnd = mulberry32(seed);
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    const o = p;
    p = p + (rnd() - 0.62) * 6;
    const c = p;
    out.push({ o, c, h: Math.max(o, c) + rnd() * 3, l: Math.min(o, c) - rnd() * 3 });
  }
  return out;
}

function candles(ctx, x, y, w, h, data, live) {
  const max = Math.max(...data.map((d) => d.h));
  const min = Math.min(...data.map((d) => d.l));
  const sy = (v) => y + h - ((v - min) / (max - min)) * h;
  const cw = w / data.length;
  data.forEach((d, i) => {
    let c = d.c;
    if (i === data.length - 1) c = d.o + (d.c - d.o) * live;
    const col = c >= d.o ? GREEN : RED;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(2, cw * 0.12);
    const cx = x + i * cw + cw / 2;
    ctx.beginPath();
    ctx.moveTo(cx, sy(d.h));
    ctx.lineTo(cx, sy(d.l));
    ctx.stroke();
    const top = sy(Math.max(d.o, c)), bot = sy(Math.min(d.o, c));
    ctx.fillRect(cx - cw * 0.32, top, cw * 0.64, Math.max(3, bot - top));
  });
}

export function drawWallChart(ctx, seed, t, alarm = 0) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (H * i) / 6);
    ctx.lineTo(W, (H * i) / 6);
    ctx.stroke();
  }
  const data = series(seed, 26);
  candles(ctx, 16, 60, W - 32, H - 80, data, (t * 0.7) % 1);
  ctx.fillStyle = RED;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(['BTC', 'ETH', 'SOL'][seed % 3] + '  ▼ ' + (6 + (seed % 5) * 1.7).toFixed(2) + '%', 18, 42);
  if (alarm > 0) {
    ctx.fillStyle = `rgba(255, 30, 50, ${0.35 * alarm})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function header(ctx, W, title, color) {
  ctx.fillStyle = '#121725';
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = color;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(title, 24, 36);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(W - 30 - i * 26, 27, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawChart(ctx, t) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'MiBroker Pro  ·  BTC/USD', '#c9d3e6');
  ctx.fillStyle = RED;
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText('$61,204', 32, 130);
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('▼ 8.42%', 330, 128);
  candles(ctx, 30, 170, W - 60, H - 200, series(7, 32), (t * 0.8) % 1);
}

function drawCourse(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2b0f4f');
  g.addColorStop(1, '#7a1d4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'tradermillonario.com', '#f0d7ff');

  ctx.fillStyle = '#ffd23f';
  roundRect(ctx, 32, 76, 360, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#2b0f4f';
  ctx.font = `900 26px ${FONT}`;
  ctx.fillText('OFERTA SOLO HOY', 64, 108);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 74px ${FONT}`;
  ctx.fillText('TRADER', 32, 210);
  ctx.fillText('MILLONARIO', 32, 286);
  ctx.font = `700 34px ${FONT}`;
  ctx.fillStyle = '#ffcfe8';
  ctx.fillText('Aprende a nunca perder en 7 días', 34, 336);

  // Precio
  ctx.font = `700 36px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('$999', 36, 410);
  ctx.strokeStyle = '#ff4d6d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(32, 398);
  ctx.lineTo(124, 398);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 96px ${FONT}`;
  ctx.fillText('$499', 140, 430);

  // Botón que late
  const pulse = 1 + Math.sin(k * 10) * 0.04;
  ctx.save();
  ctx.translate(200, 510);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#22d39a';
  roundRect(ctx, -168, -40, 336, 80, 40);
  ctx.fill();
  ctx.fillStyle = '#062b1e';
  ctx.font = `900 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('COMPRAR CURSO', 0, 12);
  ctx.restore();
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `italic 600 24px ${FONT}`;
  ctx.fillText('"Cambió mi vida" — Mi mamá  ★★★★★', 34, 600);

  // Foto del "experto": el mismo trader, con lentes puestos y pulgar arriba
  const cx = 790, cy = 330;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6e1a2b';
  roundRect(ctx, cx - 150, cy + 90, 300, 200, 40);
  ctx.fill();
  ctx.fillStyle = '#f1c7a1';
  roundRect(ctx, cx - 120, cy - 150, 240, 240, 30);
  ctx.fill();
  ctx.fillStyle = '#2b1d16';
  roundRect(ctx, cx - 128, cy - 176, 256, 70, 24);
  ctx.fill();
  ctx.fillStyle = '#0d0d10';
  roundRect(ctx, cx - 100, cy - 70, 90, 50, 14);
  ctx.fill();
  roundRect(ctx, cx + 10, cy - 70, 90, 50, 14);
  ctx.fill();
  ctx.fillRect(cx - 20, cy - 60, 40, 10);
  ctx.strokeStyle = '#141016';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 50, cy + 30);
  ctx.quadraticCurveTo(cx, cy + 70, cx + 50, cy + 30);
  ctx.stroke();
  // pulgar arriba
  ctx.fillStyle = '#f1c7a1';
  roundRect(ctx, cx + 130, cy + 60, 70, 60, 16);
  ctx.fill();
  roundRect(ctx, cx + 142, cy + 10, 26, 60, 12);
  ctx.fill();
  // rotulador "EXPERTO"
  ctx.save();
  ctx.translate(cx - 40, cy + 230);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#ffd23f';
  roundRect(ctx, -110, -30, 220, 56, 12);
  ctx.fill();
  ctx.fillStyle = '#2b0f4f';
  ctx.font = `900 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('EXPERTO', 0, 12);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawCrash(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  const flash = 0.5 + 0.5 * Math.sin(k * 18);
  ctx.fillStyle = '#16060a';
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
  rg.addColorStop(0, `rgba(160, 10, 30, ${0.45 + 0.25 * flash})`);
  rg.addColorStop(1, 'rgba(40, 0, 8, 0.2)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'MiBroker Pro  ·  Cuenta', '#ffb3bd');

  // Banner MARGIN CALL parpadeando
  if (Math.floor(k * 5) % 2 === 0) {
    ctx.fillStyle = RED;
    roundRect(ctx, W - 330, 78, 296, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 30px ${FONT}`;
    ctx.fillText('MARGIN CALL', W - 300, 116);
  }

  const dk = easeOutCubic(clamp(k / 1.15));
  const bal = 10000 - (10000 - 83.12) * dk;
  ctx.fillStyle = '#ffb3bd';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText('SALDO', 60, 150);
  ctx.fillStyle = RED;
  ctx.font = `900 140px ${FONT}`;
  ctx.fillText('$' + bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 52, 290);

  // Línea que se desploma
  const n = 60;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const rnd = mulberry32(42);
  const shown = Math.floor(n * clamp(k / 1.15));
  let y = 360;
  for (let i = 0; i <= shown; i++) {
    const x = 60 + (i / n) * (W - 120);
    y = 360 + Math.pow(i / n, 1.6) * 230 + (rnd() - 0.5) * 22;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 61, 79, 0.18)';
  ctx.lineTo(60 + (shown / n) * (W - 120), H);
  ctx.lineTo(60, H);
  ctx.fill();

  // Sello LIQUIDADO
  const sk = clamp((k - 1.2) / 0.22);
  if (sk > 0) {
    const s = 1.8 - 0.8 * easeOutBack(sk);
    ctx.save();
    ctx.translate(W / 2, H * 0.62);
    ctx.rotate(-0.16);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(sk * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    roundRect(ctx, -330, -78, 660, 156, 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 40, 60, 0.92)';
    roundRect(ctx, -318, -66, 636, 132, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 100px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('LIQUIDADO', 0, 36);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

export function drawLaptop(ctx, mode, k, t) {
  if (mode === 'course') drawCourse(ctx, k);
  else if (mode === 'crash') drawCrash(ctx, k);
  else drawChart(ctx, t);
}
