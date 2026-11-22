// Pantallas de los episodios 20-22: el bot de Claude y el calendario del mes.
import { clamp, easeOutBack, mulberry32, roundRect } from './util.js';
import { RED, GREEN, FONT, header } from './screen-kit.js';

const CLAUDE_ORANGE = '#ffb27a';

function centered(ctx, text, x, y) {
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

// TraderBot: "WINRATE 72 %" en verde; con `loss` el número pasa a rojo y aparece "DE PÉRDIDAS".
export function drawBot(ctx, k, loss) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = loss ? '#16060a' : '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'TraderBot  ·  hecho por Claude', CLAUDE_ORANGE);
  ctx.fillStyle = GREEN;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText('● ACTIVO', 40, 100);
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `800 44px ${FONT}`;
  centered(ctx, 'WINRATE', W / 2, 170);
  const pop = loss ? 1 : easeOutBack(clamp((k - 0.1) / 0.5));
  ctx.save();
  ctx.translate(W / 2, 330);
  ctx.scale(pop, pop);
  ctx.fillStyle = loss ? RED : GREEN;
  ctx.font = `900 190px ${FONT}`;
  centered(ctx, '72 %', 0, 0);
  ctx.restore();
  if (loss) drawLossLabel(ctx, W, k);
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `700 26px ${FONT}`;
  centered(ctx, 'Operaciones: 25  ·  Perdidas: 18', W / 2, H - 30);
}

function drawLossLabel(ctx, W, k) {
  const pop = easeOutBack(clamp((k - 0.05) / 0.45));
  ctx.save();
  ctx.translate(W / 2, 470);
  ctx.scale(pop, pop);
  ctx.fillStyle = RED;
  ctx.font = `900 96px ${FONT}`;
  centered(ctx, 'DE PÉRDIDAS', 0, 0);
  ctx.restore();
}

// Noviembre: del 1 al 21 todo en rojo; hoy (22) en verde con $0.00, el único día sin operar.
const TODAY = 22;
const FIRST_COL = 6; // el 1 de noviembre de 2026 cae domingo (semana de lunes a domingo)
const CELL_W = 134, CELL_H = 74, GRID_X = 43, GRID_Y = 104;

function dayLoss(day) {
  return 40 + Math.floor(mulberry32(day * 7)() * 360);
}

function drawDay(ctx, day, k) {
  const i = FIRST_COL + day - 1;
  const x = GRID_X + (i % 7) * CELL_W, y = GRID_Y + Math.floor(i / 7) * CELL_H;
  const today = day === TODAY;
  const glow = today ? 0.55 + 0.45 * Math.sin(k * 6) : 0;
  ctx.fillStyle = today ? `rgba(34, 211, 154, ${0.25 + 0.2 * glow})` : 'rgba(255, 61, 79, 0.16)';
  roundRect(ctx, x + 4, y + 4, CELL_W - 8, CELL_H - 8, 10);
  ctx.fill();
  if (today) {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(String(day), x + 14, y + 26);
  ctx.fillStyle = today ? GREEN : RED;
  ctx.font = `900 26px ${FONT}`;
  centered(ctx, today ? '$0.00' : `-$${dayLoss(day)}`, x + CELL_W / 2, y + 56);
}

export function drawCalendar(ctx, k) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  header(ctx, W, 'TradingView  ·  Noviembre', '#c9d3e6');
  ctx.fillStyle = '#6f7a90';
  ctx.font = `800 20px ${FONT}`;
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d, c) => centered(ctx, d, GRID_X + c * CELL_W + CELL_W / 2, 94));
  for (let day = 1; day < TODAY; day++) {
    if (k >= 0.05 + day * 0.025) drawDay(ctx, day, k);
  }
  if (k < 0.9) return;
  drawDay(ctx, TODAY, k);
  ctx.fillStyle = GREEN;
  ctx.font = `900 40px ${FONT}`;
  centered(ctx, 'Hoy: $0.00  ·  Mejor día del mes', W / 2, H - 28);
}
