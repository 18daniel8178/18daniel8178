import * as THREE from 'three';
import { clamp, lerp, roundRect } from './util.js';

// Expresiones base. "open" (boca) lo pone el audio en cada frame.
export const TRADER_FACES = {
  neutral:    { lid: 0,    eye: 1,    pupil: 1,    browY: 0,   browTilt: 0,    mouth: 'line' },
  worried:    { lid: 0,    eye: 1.05, pupil: 0.85, browY: -6,  browTilt: -0.35, mouth: 'frown' },
  suspicious: { lid: 0.42, eye: 1,    pupil: 0.9,  browY: 10,  browTilt: 0.18, mouth: 'smirk' },
  shocked:    { lid: 0,    eye: 1.25, pupil: 0.45, browY: -26, browTilt: -0.1, mouth: 'O' },
  frozen:     { lid: 0,    eye: 1.2,  pupil: 0.38, browY: -18, browTilt: -0.2, mouth: 'wobble' },
};

export const CLAUDE_FACES = {
  neutral: { eyes: 'dot',   mouth: 'line',  blush: 0 },
  proud:   { eyes: 'happy', mouth: 'smile', blush: 0.6 },
  happy:   { eyes: 'dot',   mouth: 'smile', blush: 0.4 },
  helpful: { eyes: 'dot',   mouth: 'soft',  blush: 0.2 },
};

export class Face {
  constructor(kind, w = 512, h = 512) {
    this.kind = kind;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  draw(p) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.kind === 'trader') drawTrader(ctx, p);
    else drawClaude(ctx, p);
    this.texture.needsUpdate = true;
  }
}

const INK = '#141016';

function drawMouth(ctx, cx, cy, type, open, scale = 1) {
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Hablando: la forma base se abre según el volumen.
  if (open > 0.06 && type !== 'O' && type !== 'wobble') {
    const w = (54 + 34 * open) * scale;
    const h = (14 + 62 * open) * scale;
    ctx.beginPath();
    if (type === 'smile' || type === 'soft') {
      // Forma de "D" acostada: sonrisa abierta.
      ctx.moveTo(cx - w / 2, cy - h * 0.25);
      ctx.quadraticCurveTo(cx, cy - h * 0.45, cx + w / 2, cy - h * 0.25);
      ctx.quadraticCurveTo(cx + w * 0.45, cy + h * 0.85, cx, cy + h * 0.8);
      ctx.quadraticCurveTo(cx - w * 0.45, cy + h * 0.85, cx - w / 2, cy - h * 0.25);
    } else {
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    // lengua
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#b8434f';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.45, w * 0.32, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  switch (type) {
    case 'line':
      roundRect(ctx, cx - 40 * scale, cy - 6 * scale, 80 * scale, 12 * scale, 6 * scale);
      ctx.fill();
      break;
    case 'smirk':
      ctx.lineWidth = 12 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 40 * scale, cy + 4 * scale);
      ctx.quadraticCurveTo(cx + 10 * scale, cy + 6 * scale, cx + 42 * scale, cy - 10 * scale);
      ctx.stroke();
      break;
    case 'frown':
      ctx.lineWidth = 12 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 36 * scale, cy + 12 * scale);
      ctx.quadraticCurveTo(cx, cy - 16 * scale, cx + 36 * scale, cy + 12 * scale);
      ctx.stroke();
      break;
    case 'smile':
      ctx.lineWidth = 13 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 52 * scale, cy - 10 * scale);
      ctx.quadraticCurveTo(cx, cy + 40 * scale, cx + 52 * scale, cy - 10 * scale);
      ctx.stroke();
      break;
    case 'soft':
      ctx.lineWidth = 12 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 34 * scale, cy - 4 * scale);
      ctx.quadraticCurveTo(cx, cy + 18 * scale, cx + 34 * scale, cy - 4 * scale);
      ctx.stroke();
      break;
    case 'O': {
      const k = 1 + open * 0.25;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6 * scale, 26 * scale * k, 38 * scale * k, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wobble': {
      ctx.lineWidth = 10 * scale;
      ctx.beginPath();
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const x = cx - 44 * scale + (88 * scale * i) / n;
        const y = cy + (i % 2 ? -7 : 7) * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
  }
}

function drawTrader(ctx, p) {
  const skin = '#e8b48d';
  const lid = clamp(p.lid + p.blink);
  const eyes = [
    { x: 168, side: -1 },
    { x: 344, side: 1 },
  ];
  const eyeY = 236;

  // Ojeras de desvelado (3:47 a.m.)
  ctx.strokeStyle = 'rgba(132, 86, 120, 0.55)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const e of eyes) {
    ctx.beginPath();
    ctx.arc(e.x, eyeY + 50, 50, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }

  for (const e of eyes) {
    const twitch = e.side > 0 ? p.twitch : 0;
    const ew = 116 * (0.9 + 0.1 * p.eye);
    const eh = 128 * p.eye;
    const x = e.x - ew / 2, y = eyeY - eh / 2;
    ctx.fillStyle = '#fbfaf7';
    roundRect(ctx, x, y, ew, eh, 26);
    ctx.fill();

    const pw = 44 * p.pupil, ph = 74 * p.pupil;
    const px = e.x + p.lookX * 18 + p.tremble * Math.sin(p.t * 90 + e.side) * 3;
    const py = eyeY + p.lookY * 14 + 6;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(px - pw * 0.18, py - ph * 0.22, pw * 0.14, ph * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Párpado superior (sospecha, parpadeo, tic)
    const l = clamp(lid + twitch);
    if (l > 0.001) {
      ctx.fillStyle = skin;
      ctx.fillRect(x - 4, y - 6, ew + 8, (eh + 10) * l + 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 2, y - 6 + (eh + 10) * l, ew + 4, 5);
    }
  }

  // Cejas
  ctx.fillStyle = '#2a1b14';
  for (const e of eyes) {
    ctx.save();
    ctx.translate(e.x, 140 + p.browY - (p.eye - 1) * 60);
    ctx.rotate(p.browTilt * -e.side);
    roundRect(ctx, -58, -12, 116, 24, 12);
    ctx.fill();
    ctx.restore();
  }

  // Bigotito de "trader exitoso"
  ctx.fillStyle = '#2a1b14';
  ctx.beginPath();
  ctx.moveTo(206, 372);
  ctx.quadraticCurveTo(256, 352, 306, 372);
  ctx.quadraticCurveTo(256, 364, 206, 372);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#2a1b14';
  ctx.stroke();

  drawMouth(ctx, 256, 412 + p.mouthDY, p.mouth, p.open, 1);

  // Gota de sudor
  if (p.sweat > 0.01) {
    ctx.save();
    ctx.globalAlpha = p.sweat;
    ctx.translate(448, 150 + p.sweatY);
    ctx.fillStyle = '#8fd3ff';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(22, 4, 0, 20);
    ctx.quadraticCurveTo(-22, 4, 0, -30);
    ctx.fill();
    ctx.restore();
  }
}

function drawClaude(ctx, p) {
  const eyes = [190, 322];
  const eyeY = 158;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';

  for (const ex of eyes) {
    const x = ex + p.lookX * 10;
    if (p.eyes === 'happy') {
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(x, eyeY + 16, 26, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      const h = lerp(80, 8, clamp(p.blink));
      roundRect(ctx, x - 25, eyeY - h / 2, 50, h, 14);
      ctx.fill();
    }
  }

  // Lentes redondos de "asesor financiero"
  ctx.strokeStyle = '#2b2622';
  ctx.lineWidth = 8;
  for (const ex of eyes) {
    ctx.beginPath();
    ctx.arc(ex, eyeY, 62, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(eyes[0] + 58, eyeY - 16);
  ctx.quadraticCurveTo(256, eyeY - 34, eyes[1] - 58, eyeY - 16);
  ctx.stroke();
  // brillo en lentes
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  for (const ex of eyes) {
    ctx.beginPath();
    ctx.arc(ex, eyeY, 50, Math.PI * 1.15, Math.PI * 1.4);
    ctx.stroke();
  }

  if (p.blush > 0) {
    ctx.fillStyle = `rgba(255, 120, 120, ${0.35 * p.blush})`;
    for (const ex of eyes) {
      ctx.beginPath();
      ctx.ellipse(ex + (ex < 256 ? -40 : 40), eyeY + 82, 30, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMouth(ctx, 256, 280, p.mouth, p.open, 0.95);
}
