export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));

export const easeOutCubic = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInOutSine = (k) => -(Math.cos(Math.PI * clamp(k)) - 1) / 2;
export const easeOutBack = (k) => {
  const c1 = 1.70158, c3 = c1 + 1, x = clamp(k) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
};

// Resorte amortiguado: 0 -> 1 con rebote. Útil para "pop" y saltos.
export const spring = (k, freq = 3.2, damp = 5) => {
  if (k <= 0) return 0;
  return 1 - Math.exp(-damp * k) * Math.cos(freq * Math.PI * 2 * k * 0.5);
};

// Ruido suave determinista (suma de senos) para cámara en mano e idles.
export const wobble = (t, seed = 0) =>
  Math.sin(t * 1.3 + seed) * 0.5 + Math.sin(t * 2.1 + seed * 1.7) * 0.3 + Math.sin(t * 3.7 + seed * 2.3) * 0.2;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
