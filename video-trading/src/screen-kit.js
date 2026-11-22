// Piezas compartidas por las pantallas de la laptop (colores, fuente y barra de ventana).
export const RED = '#ff3d4f';
export const GREEN = '#22d39a';
export const FONT = 'Inter, sans-serif';

export function header(ctx, W, title, color) {
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
