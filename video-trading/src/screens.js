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

// Cuenta espejo: hace lo contrario que el trader y sube sin parar.
function drawGain(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#04140e';
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
  rg.addColorStop(0, 'rgba(20, 170, 115, 0.45)');
  rg.addColorStop(1, 'rgba(0, 40, 24, 0.2)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'MiBroker Pro  ·  Cuenta espejo', '#b3ffd9');

  ctx.fillStyle = GREEN;
  roundRect(ctx, W - 384, 78, 350, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#04140e';
  ctx.font = `900 28px ${FONT}`;
  ctx.fillText('HACE LO CONTRARIO', W - 362, 114);

  const dk = easeOutCubic(clamp(k / 1.15));
  const bal = 1000 + 8000 * dk;
  ctx.fillStyle = '#b3ffd9';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText('SALDO', 60, 150);
  ctx.fillStyle = GREEN;
  ctx.font = `900 140px ${FONT}`;
  ctx.fillText('$' + bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 52, 290);

  // Línea que se dispara
  const n = 60;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const rnd = mulberry32(7);
  const shown = Math.floor(n * clamp(k / 1.15));
  for (let i = 0; i <= shown; i++) {
    const x = 60 + (i / n) * (W - 120);
    const y = 590 - Math.pow(i / n, 1.6) * 230 + (rnd() - 0.5) * 22;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(34, 211, 154, 0.18)';
  ctx.lineTo(60 + (shown / n) * (W - 120), H);
  ctx.lineTo(60, H);
  ctx.fill();

  // Sello +800%
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
    roundRect(ctx, -250, -78, 500, 156, 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20, 190, 130, 0.94)';
    roundRect(ctx, -238, -66, 476, 132, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 100px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('+800%', 0, 36);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

// Moneda de perrito dibujada a mano (sin emojis: Chromium sin ventana no los trae).
function dogCoin(ctx, x, y, r) {
  ctx.fillStyle = '#f4b73b';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b97d10';
  ctx.lineWidth = r * 0.1;
  ctx.stroke();
  ctx.fillStyle = '#8a5a2b';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.55, y - r * 0.15);
    ctx.lineTo(x + s * r * 0.62, y - r * 0.72);
    ctx.lineTo(x + s * r * 0.18, y - r * 0.42);
    ctx.fill();
  }
  ctx.fillStyle = '#d99a52';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.05, r * 0.5, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141016';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.2, y - r * 0.08, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.2, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stamp(ctx, W, H, k, text, fill, width) {
  const sk = clamp(k / 0.22);
  if (sk <= 0) return;
  const s = 1.8 - 0.8 * easeOutBack(sk);
  ctx.save();
  ctx.translate(W / 2, H * 0.62);
  ctx.rotate(-0.16);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(sk * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 12;
  roundRect(ctx, -width / 2, -78, width, 156, 18);
  ctx.stroke();
  ctx.fillStyle = fill;
  roundRect(ctx, -width / 2 + 12, -66, width - 24, 132, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 92px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 34);
  ctx.restore();
  ctx.textAlign = 'left';
}

// Memecoin: "meme" se dispara (+3000%); "rug" parte de arriba y se desploma (rug pull).
function drawMeme(ctx, k, rug) {
  const { width: W, height: H } = ctx.canvas;
  const up = rug ? 1 : easeOutCubic(clamp(k / 1.2));
  const down = rug ? easeOutCubic(clamp((k - 0.35) / 0.5)) : 0;
  ctx.fillStyle = rug && down > 0.5 ? '#16060a' : '#0b1410';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'MiBroker Pro  ·  PERRO/USD', '#c9d3e6');
  dogCoin(ctx, 92, 140, 58);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText('PerroCohete', 170, 132);
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('$PERRO  ·  comunidad muy fuerte', 172, 170);

  const pct = up * 3000 * (1 - down) - 99 * down;
  const col = pct >= 0 ? GREEN : RED;
  ctx.fillStyle = col;
  ctx.font = `900 78px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText((pct >= 0 ? '+' : '') + Math.round(pct).toLocaleString('en-US') + '%', W - 40, 160);
  ctx.textAlign = 'left';

  // Línea: sube exponencial y, en el rug pull, cae a plomo al final
  const n = 70;
  const x0 = 50, x1 = W - 50, yb = H - 50, yt = 230;
  const pts = [];
  const rnd = mulberry32(11);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    let y = yb - (yb - yt) * f ** 3 + (rnd() - 0.5) * 14;
    pts.push([x0 + (x1 - x0) * f, y]);
  }
  const shown = Math.floor(n * up);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= shown; i++) i ? ctx.lineTo(...pts[i]) : ctx.moveTo(...pts[i]);
  ctx.stroke();
  if (down > 0) {
    const [lx, ly] = pts[n];
    ctx.strokeStyle = RED;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 10, ly + (yb - ly) * down);
    ctx.stroke();
  }
  if (rug) stamp(ctx, W, H, k - 0.95, 'RUG PULL', 'rgba(255, 40, 60, 0.92)', 640);
}

// Grupo de "señales VIP": todos los mensajes dicen COMPRA.
function drawSignals(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#0e1621';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'Telegram  ·  SEÑALES VIP', '#ffd66b');
  const g = ctx.createLinearGradient(0, 70, W, 70);
  g.addColorStop(0, '#b8862b');
  g.addColorStop(0.5, '#ffe18a');
  g.addColorStop(1, '#b8862b');
  ctx.fillStyle = g;
  roundRect(ctx, 24, 70, W - 48, 74, 14);
  ctx.fill();
  ctx.fillStyle = '#2a1a00';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillText('PLAN PLATINO  ·  $499 / mes', 52, 122);

  const msgs = ['COMPRA BTC YA', 'COMPRA SOL YA', '¿Bajó? COMPRA MÁS', 'COMPRA TODO'];
  msgs.forEach((m, i) => {
    const a = clamp((k - 0.15 - i * 0.28) / 0.15);
    if (a <= 0) return;
    const y = 180 + i * 108;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#182533';
    roundRect(ctx, 40, y, 700, 88, 18);
    ctx.fill();
    ctx.fillStyle = '#ffd66b';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('Admin VIP', 64, y + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 34px ${FONT}`;
    ctx.fillText(m, 64, y + 70);
    ctx.globalAlpha = 1;
  });
  ctx.fillStyle = '#7f91a4';
  ctx.font = `700 24px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('aciertos: 50%', W - 40, H - 30);
  ctx.textAlign = 'left';
}

// Checklist de la estrategia: las palomitas aparecen una por una.
function drawChecks(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'MiBroker Pro  ·  Mi estrategia', '#c9d3e6');
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText('CHECKLIST DE ENTRADA', 40, 112);
  const items = ['Tendencia alcista', 'Rompió resistencia', 'Volumen alto', 'RSI en zona', 'Me siento con suerte'];
  items.forEach((m, i) => {
    const y = 150 + i * 78;
    const a = clamp((k - 0.1 - i * 0.18) / 0.12);
    ctx.fillStyle = '#182030';
    roundRect(ctx, 40, y, W - 80, 64, 12);
    ctx.fill();
    ctx.fillStyle = '#e8edf6';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(m, 110, y + 44);
    ctx.strokeStyle = '#2b3446';
    ctx.lineWidth = 4;
    roundRect(ctx, 56, y + 14, 36, 36, 8);
    ctx.stroke();
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(62, y + 32);
      ctx.lineTo(72, y + 44);
      ctx.lineTo(70 + 26 * (0.5 + 0.5 * a), y + 18 + 8 * (1 - a));
      ctx.stroke();
      ctx.restore();
    }
  });
  if (k > 1.1) {
    ctx.fillStyle = GREEN;
    ctx.font = `900 38px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('5/5  ENTRADA VÁLIDA', W - 40, H - 28);
    ctx.textAlign = 'left';
  }
}

// Posición que iba +$500 y "corrió"… hasta el stop (-$800).
function drawStop(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  const d = easeOutCubic(clamp((k - 0.1) / 0.7));
  ctx.fillStyle = d > 0.5 ? '#16060a' : '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'MiBroker Pro  ·  Posición BTC', '#c9d3e6');
  const pnl = 500 - 1300 * d;
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText('GANANCIA / PÉRDIDA', 50, 110);
  ctx.fillStyle = pnl >= 0 ? GREEN : RED;
  ctx.font = `900 120px ${FONT}`;
  ctx.fillText((pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 44, 230);

  // Línea del stop
  const x0 = 50, x1 = W - 50, yStop = H - 90, yTop = 290;
  ctx.strokeStyle = 'rgba(255, 61, 79, 0.8)';
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0, yStop);
  ctx.lineTo(x1, yStop);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = RED;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('STOP', x1 - 70, yStop - 12);

  // Sube hasta +$500 (mitad izquierda) y luego "corre" hasta el stop
  const rnd = mulberry32(5);
  const n = 60, mid = 30;
  const shown = mid + Math.floor((n - mid) * d);
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  let px, py;
  for (let i = 0; i <= shown; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = i <= mid ? 420 - (420 - yTop) * (i / mid) ** 1.4 + (rnd() - 0.5) * 16 : yTop + (yStop - yTop) * ((i - mid) / (n - mid)) ** 1.8;
    if (i) {
      ctx.strokeStyle = i <= mid ? GREEN : RED;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    px = x;
    py = y;
  }
  stamp(ctx, W, H, k - 0.85, 'STOP LOSS', 'rgba(255, 40, 60, 0.92)', 640);
}

// Correo del broker: gracias a clientes como tú… compramos un yate.
function drawMail(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#f4f6fa';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'Correo  ·  Bandeja de entrada', '#c9d3e6');
  ctx.fillStyle = '#5b6578';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('De: MiBroker Pro', 44, 100);
  ctx.fillStyle = '#121725';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillText('¡Gracias por tu confianza!', 44, 152);
  const a = clamp((k - 0.15) / 0.2);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#262f42';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText('Gracias a clientes como tú,', 44, 222);
  ctx.fillText('este año compramos un yate.', 44, 268);
  ctx.globalAlpha = 1;

  // Foto del yate (entra navegando)
  const fx = 44, fy = 300, fw = W - 88, fh = H - 320;
  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, 16);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, fy, 0, fy + fh);
  sky.addColorStop(0, '#7cc4ff');
  sky.addColorStop(1, '#cfeaff');
  ctx.fillStyle = sky;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.fillStyle = '#ffd66b';
  ctx.beginPath();
  ctx.arc(fx + fw - 90, fy + 70, 40, 0, Math.PI * 2);
  ctx.fill();
  const sea = fy + fh * 0.62;
  ctx.fillStyle = '#1f6fb8';
  ctx.fillRect(fx, sea, fw, fh);
  const yk = easeOutCubic(clamp((k - 0.3) / 0.6));
  const bx = fx + fw + 240 - (fw / 2 + 240) * yk;
  const by = sea - 10 + Math.sin(k * 4) * 5;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0d2747';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(bx - 200, by - 40);
  ctx.lineTo(bx + 210, by - 40);
  ctx.lineTo(bx + 160, by + 30);
  ctx.lineTo(bx - 160, by + 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0303f';
  ctx.fillRect(bx - 178, by - 14, 360, 12);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, bx - 110, by - 110, 220, 70, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0d2747';
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, bx - 92 + i * 48, by - 94, 34, 26, 6);
    ctx.fill();
  }
  ctx.fillRect(bx - 4, by - 170, 8, 60);
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(bx + 4, by - 170);
  ctx.lineTo(bx + 54, by - 155);
  ctx.lineTo(bx + 4, by - 140);
  ctx.fill();
  ctx.restore();
}

// Currículum que Claude "actualizó".
function drawCV(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#d9dde5';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'Documento  ·  curriculum_final_v3.pdf', '#c9d3e6');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(70, 72, W - 140, H - 72);
  ctx.fillStyle = '#121725';
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText('CURRÍCULUM', 110, 136);
  const rows = [
    ['Experiencia', 'Trader independiente (3 semanas)'],
    ['Educación', 'Curso "Trader Millonario" ($499)'],
    ['Referencias', 'Claude'],
  ];
  rows.forEach(([h, v], i) => {
    const a = clamp((k - 0.15 - i * 0.3) / 0.15);
    if (a <= 0) return;
    const y = 210 + i * 120;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#c0392b';
    ctx.font = `900 28px ${FONT}`;
    ctx.fillText(h.toUpperCase(), 110, y);
    ctx.fillStyle = '#262f42';
    ctx.font = `800 36px ${FONT}`;
    ctx.fillText(v, 110, y + 48);
    ctx.globalAlpha = 1;
  });
}

function chatHeader(ctx, W) {
  ctx.fillStyle = '#212121';
  ctx.fillRect(0, 0, W, ctx.canvas.height);
  header(ctx, W, 'Chat  ·  Asistente', '#d6d6d6');
}

function rocket(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.scale(s, s);
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(-6, 14);
  ctx.lineTo(0, 30);
  ctx.lineTo(6, 14);
  ctx.fill();
  ctx.fillStyle = '#e8edf6';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0303f';
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(-16, 16);
  ctx.lineTo(-7, 14);
  ctx.moveTo(9, 6);
  ctx.lineTo(16, 16);
  ctx.lineTo(7, 14);
  ctx.fill();
  ctx.fillStyle = '#4aa8ff';
  ctx.beginPath();
  ctx.arc(0, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// "¡Excelente pregunta! Aquí tienes doce factores…": lista que no se acaba.
function drawList(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  chatHeader(ctx, W);
  const items = ['Tendencia del mercado', 'Sentimiento en redes', 'Fase de la luna', 'Opinión de tu cuñado',
    'Volumen', 'Noticias', 'Tu horóscopo', 'Halving', 'Ballenas', 'Macroeconomía', 'Clima en El Salvador', 'Tu intuición'];
  const scroll = Math.max(0, k - 0.5) * 260;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 60, W, H - 60);
  ctx.clip();
  ctx.fillStyle = '#ececec';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillText('¡Excelente pregunta! Aquí tienes', 40, 120 - scroll);
  ctx.fillText('12 factores a considerar:', 40, 168 - scroll);
  items.forEach((m, i) => {
    const y = 236 + i * 62 - scroll;
    if (clamp((k - i * 0.07) / 0.1) <= 0) return;
    ctx.fillStyle = ['#3ff5d2', '#ffd66b', '#ff8ad8', '#8ab4ff'][i % 4];
    roundRect(ctx, 44, y - 30, 34, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ececec';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(`${i + 1}. ${m}`, 96, y);
  });
  ctx.restore();
}

// "¡Pero aquí tienes cinco monedas que van a explotar!"
function drawCoins(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  chatHeader(ctx, W);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('Como modelo de lenguaje, no puedo darte asesoría financiera.', 40, 108);
  ctx.fillStyle = '#ececec';
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText('¡Pero aquí tienes 5 monedas', 40, 170);
  ctx.fillText('que van a explotar!', 40, 218);
  ['MoonToken', 'GatoCoin', 'LamboX', 'SafeRug', 'PerroCohete'].forEach((m, i) => {
    const a = clamp((k - 0.15 - i * 0.15) / 0.12);
    if (a <= 0) return;
    const y = 290 + i * 66;
    ctx.globalAlpha = a;
    rocket(ctx, 74, y - 12, 1.1);
    ctx.fillStyle = '#ececec';
    ctx.font = `800 36px ${FONT}`;
    ctx.fillText(`${i + 1}. ${m}`, 112, y);
    ctx.fillStyle = GREEN;
    ctx.textAlign = 'right';
    ctx.fillText('x100', W - 50, y);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  });
}

export function drawLaptop(ctx, mode, k, t) {
  if (mode === 'list') return drawList(ctx, k);
  if (mode === 'coins') return drawCoins(ctx, k);
  if (mode === 'checks') return drawChecks(ctx, k);
  if (mode === 'stop') return drawStop(ctx, k);
  if (mode === 'mail') return drawMail(ctx, k);
  if (mode === 'cv') return drawCV(ctx, k);
  if (mode === 'course') drawCourse(ctx, k);
  else if (mode === 'crash') drawCrash(ctx, k);
  else if (mode === 'gain') drawGain(ctx, k);
  else if (mode === 'meme' || mode === 'rug') drawMeme(ctx, k, mode === 'rug');
  else if (mode === 'signals') drawSignals(ctx, k);
  else drawChart(ctx, t);
}
