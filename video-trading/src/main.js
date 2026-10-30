import * as THREE from 'three';
import { buildRoom } from './room.js';
import { buildTrader, buildClaude } from './characters.js';
import { drawLaptop, drawWallChart } from './screens.js';
import { cameraFor } from './shots.js';
import { Overlay } from './overlay.js';
import { clamp, wobble } from './util.js';

let S = null;

window.setupScene = async (timeline) => {
  await Promise.all([
    document.fonts.load('900 64px Inter'),
    document.fonts.load('800 64px Inter'),
    document.fonts.load('italic 600 24px Inter'),
    document.fonts.load('800 64px "JetBrains Mono"'),
  ]);
  const { width: W, height: H } = timeline;
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0d14');
  scene.fog = new THREE.Fog('#0b0d14', 9, 18);
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 60);

  const room = buildRoom(scene, timeline.clock || '3:47');
  const trader = buildTrader();
  trader.root.position.set(0.6, 0, -1.2);
  scene.add(trader.root);
  const claude = buildClaude();
  claude.root.position.set(-0.7, 1.5, 0.05);
  scene.add(claude.root);

  // Luces
  scene.add(new THREE.HemisphereLight('#6f84d6', '#2a1c14', 0.75));
  const key = new THREE.SpotLight('#ffb36b', 20, 0, 0.9, 0.6, 2);
  key.position.copy(room.lampPos);
  key.target.position.set(-0.6, 1.6, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0008;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#ffe2c8', 0.75);
  fill.position.set(2, 4, 8);
  scene.add(fill);
  const moon = new THREE.DirectionalLight('#8aa0ff', 0.6);
  moon.position.set(-6, 5, 2);
  scene.add(moon);
  const screenLight = new THREE.PointLight('#9cc4ff', 2.2, 0, 2);
  screenLight.position.set(0.6, 2.05, -0.5);
  scene.add(screenLight);
  const monitorGlow = new THREE.PointLight('#ff3048', 9, 0, 2);
  monitorGlow.position.set(0.6, 3.5, -2.3);
  scene.add(monitorGlow);
  const claudeFill = new THREE.PointLight('#ffc89a', 4, 0, 2);
  claudeFill.position.set(-0.4, 2.9, 1.7);
  scene.add(claudeFill);

  S = {
    timeline, renderer, scene, camera, room, trader, claude,
    lights: { screenLight, monitorGlow },
    overlay: new Overlay(document.getElementById('stage')),
    crashAt: firstScreenAt(timeline, 'crash'),
    doorAt: timeline.segments.find((s) => s.door === 'open')?.start ?? Infinity,
    raycaster: new THREE.Raycaster(),
  };
  return true;
};

const SCREEN_LIGHT = { crash: '#ff4050', rug: '#ff4050', course: '#ff9ad5', gain: '#5cffb5', meme: '#5cffb5', signals: '#ffd66b', checks: '#5cffb5' };
const DOOR_DARK = new THREE.Color('#05060a');
const DOOR_WARM = new THREE.Color('#ffcf8a');

function firstScreenAt(tl, mode) {
  for (const s of tl.segments) {
    if (s.screen === mode) return s.start;
    for (const c of s.cuts || []) if (c.screen === mode) return c.at;
  }
  return Infinity;
}

function segmentAt(tl, t) {
  for (const s of tl.segments) if (t >= s.start && t < s.end) return s;
  return tl.segments[tl.segments.length - 1];
}

function shotAt(seg, t) {
  let cur = { shot: seg.shot, screen: seg.screen, from: seg.start, to: seg.end };
  const cuts = seg.cuts || [];
  cuts.forEach((c, i) => {
    if (t >= c.at) cur = { shot: c.shot, screen: c.screen, from: c.at, to: cuts[i + 1]?.at ?? seg.end };
  });
  return cur;
}

function lastFace(tl, who, t) {
  let f = 'neutral';
  for (const s of tl.segments) {
    if (s.start > t) break;
    if (s.who === who && s.face) f = s.face;
  }
  return f;
}

function mouthOpen(seg, t, fps) {
  if (seg.silent || !seg.env || t < seg.voiceStart || t > seg.voiceEnd) return 0;
  const i = Math.floor((t - seg.voiceStart) * fps);
  return clamp(seg.env[i] ?? 0);
}

function currentWord(seg, t) {
  if (seg.silent || !seg.words?.length) return null;
  let w = null;
  for (const x of seg.words) if (t >= x.start) w = x;
  return w;
}

// ¿Hay algo entre la cámara y el punto? (para no dibujar emotes encima de otro personaje)
function visibleFrom(camera, point) {
  const dir = point.clone().sub(camera.position);
  const dist = dir.length();
  S.raycaster.set(camera.position, dir.normalize());
  S.raycaster.far = dist - 0.3;
  return S.raycaster.intersectObjects(S.scene.children, true).length === 0;
}

const project = (v, camera, W, H) => {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z };
};

window.renderAt = (t) => {
  const { timeline: tl, renderer, scene, camera, room, trader, claude, overlay, lights } = S;
  const { fps, width: W, height: H } = tl;
  const seg = segmentAt(tl, t);
  const shot = shotAt(seg, t);
  const age = t - shot.from;
  const k = (t - shot.from) / Math.max(0.01, shot.to - shot.from);

  // --- Cámara
  const cam = cameraFor(shot.shot, k, age);
  const hand = 0.012;
  cam.pos.x += wobble(t * 0.8, 1) * hand;
  cam.pos.y += wobble(t * 0.7, 2) * hand;
  if (seg.shake) {
    const d = Math.max(0, 1 - (t - seg.start) / 0.55);
    cam.pos.x += Math.sin(t * 61) * 0.04 * d;
    cam.pos.y += Math.cos(t * 53) * 0.04 * d;
  }
  camera.position.copy(cam.pos);
  camera.fov = cam.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(cam.look);
  if (shot.screen === 'crash') camera.rotateZ(Math.sin(age * 1.5) * 0.02 - 0.03);

  // --- Quién habla
  const speaking = seg.silent ? null : seg.who;
  const open = mouthOpen(seg, t, fps);
  const onScreen = shot.shot === 'screen';
  trader.root.visible = !onScreen;
  room.chair.visible = !onScreen;

  const tFace = lastFace(tl, 'trader', t);
  const cFace = lastFace(tl, 'claude', t);
  const frozen = tFace === 'frozen';
  trader.update({
    t,
    face: tFace,
    open: speaking === 'trader' ? open : 0,
    typing: speaking !== 'trader' && !['shocked', 'frozen'].includes(tFace),
    shockAge: seg.who === 'trader' && seg.shake ? t - seg.start : null,
    lookX: frozen ? 0 : speaking === 'claude' ? -0.5 : -0.2,
    lookY: speaking === 'claude' ? 0.15 : 0,
    headYaw: frozen ? 0 : speaking === 'claude' ? -0.28 : -0.12,
  });
  claude.update({
    t,
    face: cFace,
    open: speaking === 'claude' ? open : 0,
    hopAge: seg.who === 'claude' && seg.face === 'proud' ? t - seg.start : null,
    pat: seg.who === 'claude' && seg.gesture === 'pat' && t - seg.start > 0.5 ? t - seg.start - 0.5 : null,
    lookX: speaking === 'trader' || frozen ? 0.4 : 0.1,
    yaw: speaking === 'trader' ? 0.3 : 0.15,
  });

  // --- Pantallas
  let mode = 'chart', mk = 0;
  if (onScreen) {
    mode = shot.screen;
    mk = age;
  } else if (t >= S.crashAt) {
    mode = 'crash';
    mk = 10;
  }
  drawLaptop(room.laptopCtx, mode, mk, t);
  room.laptopTex.needsUpdate = true;
  const alarm = t >= S.crashAt ? 0.5 + 0.5 * Math.sin(t * 12) : 0;
  room.wallScreens.forEach((s) => {
    drawWallChart(s.ctx, s.seed, t, alarm);
    s.tex.needsUpdate = true;
  });
  lights.screenLight.color.set(SCREEN_LIGHT[mode] || '#9cc4ff');
  lights.screenLight.intensity = mode === 'crash' ? 2.6 + 1.6 * Math.sin(t * 18) : 2.2;

  // --- Puerta: se abre (final de temporada) y entra luz cálida
  const de = 1 - (1 - clamp((t - S.doorAt) / 1.3)) ** 3;
  room.doorLeaf.rotation.y = 0.55 + 0.85 * de;
  room.doorGap.color.copy(DOOR_DARK).lerp(DOOR_WARM, de);
  room.doorLight.intensity = 24 * de;
  lights.monitorGlow.intensity = 9 + alarm * 8;

  renderer.render(scene, camera);

  // --- Emotes sobre las cabezas
  const traderAnchor = trader.anchor.clone().add(trader.root.position);
  const claudeAnchor = claude.anchor.clone().add(claude.root.position);
  const showEmote = (id, who, anchor) => {
    const type = seg.emote && seg.who === who && !onScreen ? seg.emote : null;
    const p = project(anchor, camera, W, H);
    const inFrame = p.z < 1 && p.x > 60 && p.x < W - 60 && p.y > 40 && p.y < H;
    const a = type && inFrame ? clamp((t - seg.start - 0.08) / 0.12) * clamp((seg.end - t) / 0.1) : 0;
    const dist = camera.position.distanceTo(anchor);
    overlay.emote(id, type, p.x, Math.max(130, p.y), clamp(4.2 / dist, 0.5, 1.9), a, t);
  };
  showEmote('trader', 'trader', traderAnchor);
  showEmote('claude', 'claude', claudeAnchor);
  {
    const p = project(room.doorAnchor, camera, W, H);
    const show = !onScreen && t < S.doorAt && p.z < 1 && p.x > 0 && p.x < W && p.y > 0 && p.y < H && visibleFrom(camera, room.doorAnchor);
    const dist = camera.position.distanceTo(room.doorAnchor);
    overlay.emote('door', show ? 'zzz' : null, p.x, p.y, clamp(5 / dist, 0.5, 1.4), 0.9, t);
  }

  // --- Subtítulos palabra por palabra
  const w = currentWord(seg, t);
  overlay.setCaption(w ? w.text : null, seg.who, w ? t - w.start : 0, onScreen ? 0.76 : shot.shot === 'wide' ? 0.72 : 0.6);
};
