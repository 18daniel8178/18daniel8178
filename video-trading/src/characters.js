import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Face, TRADER_FACES, CLAUDE_FACES } from './face.js';
import { clamp, lerp, wobble, easeOutCubic } from './util.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts });

function box(w, h, d, material, r = 0.04) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function facePlane(face, w, h) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: face.texture, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  return m;
}

// Parpadeo determinista: cerrado brevemente cada `every` segundos.
function blinkAt(t, every, offset) {
  const p = ((t + offset) % every) / every;
  const d = 0.13 / every;
  if (p > d) return 0;
  return Math.sin((p / d) * Math.PI);
}

export function buildTrader() {
  const root = new THREE.Group();
  const skin = mat('#e8b48d');
  const hair = mat('#2b1d16', { roughness: 0.55 });
  const robe = mat('#6e1a2b', { roughness: 0.5 });
  const lapel = mat('#1d1418', { roughness: 0.35 });
  const gold = mat('#e8b52f', { roughness: 0.25, metalness: 0.85 });
  const shades = mat('#0d0d10', { roughness: 0.1, metalness: 0.4 });

  const torso = new THREE.Group();
  root.add(torso);
  const body = box(1.15, 1.05, 0.72, robe, 0.1);
  body.position.y = 1.62;
  torso.add(body);
  const tank = box(0.38, 0.46, 0.02, mat('#f4f1ea'), 0);
  tank.position.set(0, 1.88, 0.362);
  torso.add(tank);
  for (const s of [-1, 1]) {
    const l = box(0.17, 0.95, 0.05, lapel, 0.02);
    l.position.set(0.16 * s, 1.68, 0.37);
    l.rotation.z = 0.33 * s;
    torso.add(l);
  }
  // Cadena de oro con dije de ₿
  const chain = new THREE.Group();
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const x = lerp(-0.17, 0.17, k);
    const y = 2.12 - (1 - Math.pow(2 * k - 1, 2)) * 0.28;
    const link = box(0.045, 0.045, 0.03, gold, 0);
    link.position.set(x, y, 0.385);
    chain.add(link);
  }
  const pendant = box(0.13, 0.15, 0.03, gold, 0.02);
  pendant.position.set(0, 1.76, 0.39);
  chain.add(pendant);
  torso.add(chain);

  // Brazos: pivote en el hombro, manos sobre el teclado
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.66 * s, 2.0, 0.05);
    const upper = box(0.28, 0.8, 0.28, robe, 0.08);
    upper.position.y = -0.36;
    pivot.add(upper);
    const hand = box(0.24, 0.16, 0.26, skin, 0.05);
    hand.position.set(0, -0.82, 0.02);
    pivot.add(hand);
    pivot.rotation.x = -1.05;
    pivot.rotation.z = 0.12 * s;
    torso.add(pivot);
    arms.push(pivot);
  }

  const head = new THREE.Group();
  head.position.y = 2.16;
  root.add(head);
  const neck = box(0.32, 0.14, 0.3, skin, 0.02);
  neck.position.y = 0.02;
  head.add(neck);
  const skull = box(1.0, 0.95, 0.9, skin, 0.07);
  skull.position.y = 0.5;
  head.add(skull);
  for (const s of [-1, 1]) {
    const ear = box(0.08, 0.2, 0.15, skin, 0.03);
    ear.position.set(0.53 * s, 0.48, 0);
    head.add(ear);
  }
  const face = new Face('trader');
  const fp = facePlane(face, 0.98, 0.93);
  fp.position.set(0, 0.5, 0.452);
  head.add(fp);

  // Pelo engominado
  const top = box(1.06, 0.24, 0.96, hair, 0.06);
  top.position.set(0, 1.02, -0.01);
  head.add(top);
  const pomp = box(0.96, 0.22, 0.34, hair, 0.08);
  pomp.position.set(0, 1.1, 0.3);
  pomp.rotation.x = -0.28;
  head.add(pomp);
  const back = box(1.06, 0.62, 0.16, hair, 0.05);
  back.position.set(0, 0.74, -0.42);
  head.add(back);
  for (const s of [-1, 1]) {
    const side = box(0.08, 0.32, 0.78, hair, 0.03);
    side.position.set(0.52 * s, 0.84, -0.05);
    head.add(side);
  }
  // Lentes de sol en la frente (son las 3:47 a.m.)
  const glasses = new THREE.Group();
  const bar = box(0.92, 0.05, 0.04, shades, 0);
  bar.position.set(0, 0.93, 0.49);
  glasses.add(bar);
  for (const s of [-1, 1]) {
    const lens = box(0.38, 0.18, 0.04, shades, 0.04);
    lens.position.set(0.22 * s, 0.87, 0.5);
    glasses.add(lens);
  }
  glasses.rotation.x = -0.12;
  head.add(glasses);

  let lastShock = -10;

  function update(s) {
    const { t } = s;
    const base = TRADER_FACES[s.face] || TRADER_FACES.neutral;
    const frozen = s.face === 'frozen';
    // Tic en el ojo: dos espasmos rápidos cada ~0.7 s
    const tw = frozen ? Math.max(0, Math.sin(t * 9)) ** 8 * 0.55 : 0;
    face.draw({
      ...base,
      t,
      open: s.open,
      blink: frozen ? 0 : blinkAt(t, 3.3, 0.8),
      twitch: tw,
      tremble: frozen ? 1 : 0,
      lookX: s.lookX ?? 0,
      lookY: s.lookY ?? 0,
      mouthDY: 0,
      sweat: frozen ? 1 : s.face === 'worried' ? 0.8 : 0,
      sweatY: frozen ? ((t * 40) % 50) : ((t * 25) % 40),
    });

    // Postura
    const breath = Math.sin(t * 2.1) * 0.012;
    torso.scale.y = 1 + breath;
    const shockK = s.shockAge != null ? clamp(s.shockAge / 0.35) : 1;
    const jolt = s.shockAge != null ? Math.sin(Math.PI * shockK) * (1 - shockK * 0.3) : 0;
    head.position.z = -0.12 * jolt;
    head.position.y = 2.16 + 0.06 * jolt + breath * 2;
    const talkBob = s.open * 0.05;
    head.rotation.x = -0.05 * jolt + Math.sin(t * 8.5) * talkBob - 0.03;
    head.rotation.y = (s.headYaw ?? -0.12) + wobble(t * 0.4, 3) * 0.04;
    head.rotation.z = wobble(t * 0.5, 9) * 0.025 + (frozen ? Math.sin(t * 70) * 0.004 : 0);

    // Teclea cuando escucha; quieto cuando entra en shock
    arms.forEach((a, i) => {
      const typing = s.typing ? Math.max(0, Math.sin(t * 16 + i * Math.PI)) * 0.06 : 0;
      a.rotation.x = -1.05 + typing + (s.shockAge != null ? -0.25 * jolt : 0);
    });
  }

  return { root, head, update, anchor: new THREE.Vector3(0, 3.45, 0) };
}

export function buildClaude() {
  const root = new THREE.Group();
  const orange = mat('#d97757', { roughness: 0.7 });
  const navy = mat('#1f2e5a', { roughness: 0.5 });

  const rig = new THREE.Group();
  root.add(rig);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = box(0.17, 0.26, 0.17, orange, 0.03);
    leg.position.set(0.24 * s, 0.13, 0);
    root.add(leg);
    legs.push(leg);
  }
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.24;
  rig.add(bodyGroup);
  const body = box(1.0, 0.92, 0.62, orange, 0.08);
  body.position.y = 0.46;
  bodyGroup.add(body);

  const face = new Face('claude', 512, 384);
  const fp = facePlane(face, 0.98, 0.735);
  fp.position.set(0, 0.54, 0.312);
  bodyGroup.add(fp);

  // Moñito de asesor financiero
  const bow = new THREE.Group();
  for (const s of [-1, 1]) {
    const wing = box(0.15, 0.11, 0.04, navy, 0.02);
    wing.position.set(0.085 * s, 0, 0);
    wing.rotation.z = 0.32 * s;
    bow.add(wing);
  }
  const knot = box(0.07, 0.08, 0.06, navy, 0.02);
  bow.add(knot);
  bow.position.set(0, 0.1, 0.33);
  bodyGroup.add(bow);

  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.5 * s, 0.6, 0);
    const arm = box(0.14, 0.38, 0.14, orange, 0.04);
    arm.position.y = -0.17;
    pivot.add(arm);
    pivot.rotation.z = 0.25 * s;
    bodyGroup.add(pivot);
    arms.push(pivot);
  }

  function update(s) {
    const { t } = s;
    const base = CLAUDE_FACES[s.face] || CLAUDE_FACES.neutral;
    face.draw({ ...base, t, open: s.open, blink: blinkAt(t, 3.9, 2.1), lookX: s.lookX ?? 0 });

    // Saltito de orgullo al empezar su línea
    let hop = 0, squash = 0;
    if (s.hopAge != null && s.hopAge < 0.6) {
      const k = s.hopAge / 0.38;
      if (k < 1) hop = Math.sin(Math.PI * k) * 0.22;
      else squash = Math.sin(Math.PI * clamp((s.hopAge - 0.38) / 0.22)) * 0.12;
    }
    const breath = Math.sin(t * 2.6 + 1) * 0.015;
    bodyGroup.position.y = 0.24 + hop;
    bodyGroup.scale.set(1 + squash * 0.6, 1 - squash + breath, 1 + squash * 0.6);
    rig.rotation.z = Math.sin(t * 5.5) * 0.035 * s.open + wobble(t * 0.5, 4) * 0.01;
    rig.rotation.y = (s.yaw ?? 0.12);
    legs.forEach((l) => (l.position.y = 0.13 + hop * 0.6));

    // Brazos: gesticula al hablar; en "pat" estira el brazo hacia el trader
    arms.forEach((a, i) => {
      const side = i === 0 ? -1 : 1;
      let rz = 0.25 * side + Math.sin(t * 7 + i * 2) * 0.35 * s.open * side;
      let rx = 0;
      if (s.pat != null && side === 1) {
        const k = easeOutCubic(clamp(s.pat / 0.4));
        rz = lerp(rz, 2.0, k) + Math.sin(s.pat * 14) * 0.12 * k;
        rx = lerp(0, -0.5, k);
      }
      a.rotation.z = rz;
      a.rotation.x = rx;
    });
  }

  return { root, update, anchor: new THREE.Vector3(0, 1.45, 0) };
}
