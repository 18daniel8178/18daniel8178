import * as THREE from 'three';
import { easeInOutSine, easeOutCubic, clamp } from './util.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Cada toma: posición/mira/fov al inicio y al final (empuje lento de cámara).
// `snap`: los primeros segundos hacen un zoom rápido (para los gritos).
export const SHOTS = {
  trader_cu: {
    from: { pos: v(0.8, 3.0, 3.5), look: v(0.6, 2.36, -1.2), fov: 34 },
    to: { pos: v(0.74, 2.95, 3.05), look: v(0.6, 2.38, -1.2), fov: 34 },
  },
  trader_ecu: {
    from: { pos: v(0.74, 2.95, 3.3), look: v(0.6, 2.6, -1.2), fov: 34 },
    to: { pos: v(0.66, 2.92, 3.0), look: v(0.6, 2.64, -1.2), fov: 19 },
    snap: 0.22,
  },
  claude_cu: {
    from: { pos: v(-0.47, 2.48, 3.7), look: v(-0.7, 2.12, 0.05), fov: 34 },
    to: { pos: v(-0.53, 2.44, 3.35), look: v(-0.7, 2.14, 0.05), fov: 34 },
  },
  claude_low: {
    from: { pos: v(-0.25, 1.7, 3.1), look: v(-0.7, 2.3, 0.05), fov: 40 },
    to: { pos: v(-0.35, 1.72, 2.7), look: v(-0.7, 2.32, 0.05), fov: 40 },
  },
  screen: {
    from: { pos: v(0.6, 2.58, -2.05), look: v(0.6, 1.95, 0.3), fov: 54 },
    to: { pos: v(0.6, 2.5, -1.75), look: v(0.6, 1.95, 0.3), fov: 52 },
  },
  // Centrado entre Claude (x≈-0.7) y el reloj (x≈1.12) para que los dos queden enteros.
  wide: {
    from: { pos: v(0.2, 3.75, 6.4), look: v(0.14, 2.32, -0.5), fov: 46 },
    to: { pos: v(0.14, 3.7, 6.2), look: v(0.14, 2.32, -0.5), fov: 46 },
  },
};

export function cameraFor(name, k, age) {
  const s = SHOTS[name] || SHOTS.wide;
  let e;
  if (s.snap) {
    // Zoom de golpe y luego casi quieto
    e = age < s.snap ? easeOutCubic(age / s.snap) * 0.9 : 0.9 + 0.1 * easeInOutSine(k);
  } else {
    e = easeInOutSine(clamp(k));
  }
  return {
    pos: s.from.pos.clone().lerp(s.to.pos, e),
    look: s.from.look.clone().lerp(s.to.look, e),
    fov: s.from.fov + (s.to.fov - s.from.fov) * e,
  };
}
