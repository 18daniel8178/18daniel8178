import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, roundRect } from './util.js';

const FONT = 'Inter, sans-serif';
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });

function box(w, h, d, material, r = 0.03) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, ctx, canvas: c };
}

function plane(w, h, material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.receiveShadow = true;
  return m;
}

export function buildRoom(scene, clockText) {
  const out = {};

  // Piso de duela
  const floorTex = canvasTex(1024, 1024, (ctx, W, H) => {
    const rnd = mulberry32(3);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 300;
      while (x < W) {
        const len = 260 + rnd() * 260;
        const v = 70 + rnd() * 30;
        ctx.fillStyle = `hsl(24, 32%, ${v * 0.42}%)`;
        ctx.fillRect(x, (r * H) / rows, len, H / rows);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, (r * H) / rows, 4, H / rows);
        x += len;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, (r * H) / rows, W, 4);
    }
  }).tex;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);
  const floor = plane(14, 14, mat('#ffffff', { map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 2;
  scene.add(floor);

  // Paredes
  const wallMat = mat('#232a3b', { roughness: 0.95 });
  const back = plane(14, 7, wallMat);
  back.position.set(0, 3.5, -3);
  scene.add(back);
  const left = plane(14, 7, wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-5, 3.5, 2);
  scene.add(left);
  const right = plane(14, 7, wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(5, 3.5, 2);
  scene.add(right);
  const front = plane(14, 7, mat('#141823'));
  front.rotation.y = Math.PI;
  front.position.set(0, 3.5, 9);
  scene.add(front);
  // zoclo
  const base = box(14, 0.16, 0.05, mat('#171c28'), 0);
  base.position.set(0, 0.08, -2.97);
  scene.add(base);

  // Escritorio
  const deskMat = mat('#1e1f26', { roughness: 0.5 });
  const top = box(4.8, 0.12, 1.3, deskMat, 0.03);
  top.position.set(0.1, 1.44, 0);
  scene.add(top);
  for (const [x, z] of [[-2.2, -0.55], [2.4, -0.55], [-2.2, 0.55], [2.4, 0.55]]) {
    const leg = box(0.1, 1.38, 0.1, deskMat, 0);
    leg.position.set(x, 0.69, z);
    scene.add(leg);
  }

  // Hojas bajo Claude
  const paper = box(0.9, 0.012, 0.65, mat('#7fb3b0', { roughness: 0.9 }), 0);
  paper.position.set(-0.7, 1.506, 0.05);
  paper.rotation.y = 0.15;
  scene.add(paper);
  const paper2 = box(0.8, 0.012, 0.6, mat('#e9e4d8'), 0);
  paper2.position.set(-1.5, 1.508, 0.25);
  paper2.rotation.y = -0.3;
  scene.add(paper2);

  // Laptop: el teclado mira al trader, la tapa le da la espalda a cámara
  const laptop = new THREE.Group();
  laptop.position.set(0.6, 1.5, -0.2);
  const shell = mat('#2b2e36', { roughness: 0.35, metalness: 0.4 });
  const lbase = box(1.3, 0.05, 0.86, shell, 0.02);
  lbase.position.set(0, 0.025, 0);
  laptop.add(lbase);
  const kb = canvasTex(512, 320, (ctx, W, H) => {
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#30333b';
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 13; c++) roundRect(ctx, 14 + c * 37.5, 14 + r * 40, 32, 33, 5), ctx.fill();
    roundRect(ctx, 180, 230, 150, 70, 8);
    ctx.fill();
  }).tex;
  const keys = plane(1.2, 0.78, mat('#ffffff', { map: kb, roughness: 0.6 }));
  keys.rotation.x = -Math.PI / 2;
  keys.rotation.z = Math.PI;
  keys.position.set(0, 0.052, 0);
  laptop.add(keys);
  const lid = new THREE.Group();
  lid.position.set(0, 0.05, 0.42);
  lid.rotation.x = 0.26;
  const lidMesh = box(1.3, 0.82, 0.04, shell, 0.02);
  lidMesh.position.y = 0.41;
  lid.add(lidMesh);
  const screenCanvas = canvasTex(1024, 640, () => {});
  out.laptopCtx = screenCanvas.ctx;
  out.laptopTex = screenCanvas.tex;
  const screen = plane(1.22, 0.74, new THREE.MeshBasicMaterial({ map: screenCanvas.tex }));
  screen.rotation.y = Math.PI;
  screen.position.set(0, 0.41, -0.022);
  lid.add(screen);
  // Stickers en la tapa (lo que ve la cámara)
  const sticker = canvasTex(512, 320, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f7931a';
    ctx.beginPath();
    ctx.arc(150, 150, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 110px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('₿', 150, 188);
    ctx.save();
    ctx.translate(350, 170);
    ctx.rotate(0.12);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -110, -48, 220, 96, 16);
    ctx.fill();
    ctx.fillStyle = '#ff3d4f';
    ctx.font = `900 54px ${FONT}`;
    ctx.fillText('HODL', 0, 20);
    ctx.restore();
  }).tex;
  const stick = plane(1.0, 0.62, mat('#ffffff', { map: sticker, transparent: true, roughness: 0.5 }));
  stick.position.set(0, 0.42, 0.024);
  lid.add(stick);
  laptop.add(lid);
  scene.add(laptop);
  out.laptopScreenWorld = () => screen.getWorldPosition(new THREE.Vector3());
  out.laptop = laptop;

  // Reloj despertador digital
  const clock = new THREE.Group();
  clock.position.set(1.12, 1.5, 0.56);
  clock.rotation.y = -0.2;
  const cbody = box(0.6, 0.3, 0.22, mat('#15161b', { roughness: 0.4 }), 0.05);
  cbody.position.y = 0.15;
  clock.add(cbody);
  const clockFace = canvasTex(256, 112, (ctx, W, H) => {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff3a3a';
    ctx.shadowColor = '#ff3a3a';
    ctx.shadowBlur = 14;
    ctx.font = `800 84px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(clockText, W / 2, 86);
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText('AM', W - 22, 30);
  }).tex;
  const cf = plane(0.5, 0.22, new THREE.MeshBasicMaterial({ map: clockFace }));
  cf.position.set(0, 0.15, 0.112);
  clock.add(cf);
  scene.add(clock);

  // Taza HODL
  const mugTex = canvasTex(512, 256, (ctx, W, H) => {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d93a3a';
    ctx.font = `900 92px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HODL', W * 0.25, 160);
  }).tex;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 24), mat('#ffffff', { map: mugTex, roughness: 0.4 }));
  mug.position.set(1.85, 1.65, 0.15);
  mug.rotation.y = -0.6;
  mug.castShadow = true;
  scene.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 16), mat('#f4f1ea'));
  handle.position.set(1.99, 1.66, 0.15);
  handle.rotation.y = 0.2;
  scene.add(handle);
  out.mug = [mug, handle];

  // Lata de bebida energética
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 20), mat('#2fd1c5', { roughness: 0.3, metalness: 0.6 }));
  can.position.set(-1.55, 1.66, 0.3);
  can.castShadow = true;
  scene.add(can);

  // Lámpara de escritorio (luz cálida)
  const lamp = new THREE.Group();
  lamp.position.set(2.1, 1.5, -0.35);
  const lmat = mat('#c4472f', { roughness: 0.45 });
  const lb = box(0.4, 0.06, 0.4, lmat, 0.02);
  lb.position.y = 0.03;
  lamp.add(lb);
  const arm = box(0.06, 1.0, 0.06, lmat, 0.01);
  arm.position.set(0, 0.5, 0);
  arm.rotation.z = 0.25;
  lamp.add(arm);
  const shade = box(0.46, 0.26, 0.34, lmat, 0.04);
  shade.position.set(-0.2, 1.02, 0.05);
  shade.rotation.z = 0.5;
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
  bulb.position.set(-0.3, 0.88, 0.05);
  lamp.add(bulb);
  scene.add(lamp);
  out.lampPos = new THREE.Vector3(1.75, 2.3, -0.25);

  // Silla gamer detrás del trader
  const chair = new THREE.Group();
  chair.position.set(0.6, 0, -1.85);
  const cblack = mat('#16171c', { roughness: 0.6 });
  const cred = mat('#b3202f', { roughness: 0.6 });
  const backrest = box(1.35, 1.9, 0.26, cblack, 0.12);
  backrest.position.y = 2.25;
  chair.add(backrest);
  for (const s of [-1, 1]) {
    const stripe = box(0.16, 1.7, 0.27, cred, 0.05);
    stripe.position.set(0.45 * s, 2.25, 0.01);
    chair.add(stripe);
  }
  const seat = box(1.3, 0.2, 1.1, cblack, 0.08);
  seat.position.set(0, 1.05, 0.55);
  chair.add(seat);
  scene.add(chair);
  out.chair = chair;

  // Monitores en la pared
  out.wallScreens = [];
  const monMat = mat('#0f1015', { roughness: 0.4 });
  [[-0.85, 3.55, 0.1], [0.6, 3.75, 0], [2.05, 3.55, -0.1]].forEach(([x, y, ry], i) => {
    const g = new THREE.Group();
    g.position.set(x, y, -2.86);
    g.rotation.y = ry;
    const frame = box(1.42, 0.9, 0.08, monMat, 0.03);
    g.add(frame);
    const c = canvasTex(512, 320, () => {});
    const s = plane(1.32, 0.8, new THREE.MeshBasicMaterial({ map: c.tex }));
    s.position.z = 0.045;
    g.add(s);
    scene.add(g);
    out.wallScreens.push({ ctx: c.ctx, tex: c.tex, seed: 11 + i * 7 });
  });

  // Póster "TO THE MOON"
  const posterTex = canvasTex(512, 720, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16123a');
    g.addColorStop(1, '#4a1f5c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry32(9);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) ctx.fillRect(rnd() * W, rnd() * H * 0.7, 3, 3);
    ctx.fillStyle = '#f5e6b8';
    ctx.beginPath();
    ctx.arc(380, 150, 80, 0, Math.PI * 2);
    ctx.fill();
    // cohete
    ctx.save();
    ctx.translate(200, 400);
    ctx.rotate(0.5);
    ctx.fillStyle = '#eeeeee';
    roundRect(ctx, -40, -120, 80, 200, 40);
    ctx.fill();
    ctx.fillStyle = '#e8453c';
    ctx.beginPath();
    ctx.moveTo(-40, 40);
    ctx.lineTo(-80, 110);
    ctx.lineTo(-40, 80);
    ctx.moveTo(40, 40);
    ctx.lineTo(80, 110);
    ctx.lineTo(40, 80);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-28, 84);
    ctx.lineTo(0, 170);
    ctx.lineTo(28, 84);
    ctx.fill();
    ctx.fillStyle = '#5ab0ff';
    ctx.beginPath();
    ctx.arc(0, -50, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.font = `900 84px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('TO THE', W / 2, 600);
    ctx.fillText('MOON', W / 2, 690);
  }).tex;
  const poster = plane(1.1, 1.55, mat('#ffffff', { map: posterTex, roughness: 0.7 }));
  poster.position.set(3.3, 3.35, -2.98);
  scene.add(poster);

  // Ventana con luna y ciudad
  const winTex = canvasTex(512, 640, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1636');
    g.addColorStop(1, '#2a2f5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f3efd6';
    ctx.beginPath();
    ctx.arc(150, 140, 60, 0, Math.PI * 2);
    ctx.fill();
    const rnd = mulberry32(5);
    for (let i = 0; i < 9; i++) {
      const bw = 40 + rnd() * 50, bh = 140 + rnd() * 260, bx = i * 60 - 10;
      ctx.fillStyle = '#121633';
      ctx.fillRect(bx, H - bh, bw, bh);
      for (let k = 0; k < 18; k++) {
        if (rnd() > 0.55) {
          ctx.fillStyle = rnd() > 0.5 ? '#ffd27a' : '#9fc4ff';
          ctx.fillRect(bx + 6 + (k % 3) * 12, H - bh + 14 + Math.floor(k / 3) * 22, 7, 10);
        }
      }
    }
    ctx.strokeStyle = '#1a1f2d';
    ctx.lineWidth = 18;
    ctx.strokeRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
  }).tex;
  const win = plane(1.5, 1.9, new THREE.MeshBasicMaterial({ map: winTex }));
  win.position.set(-4.2, 3.2, -2.98);
  scene.add(win);

  // Puerta entreabierta: alguien está dormido (por eso susurran)
  const door = new THREE.Group();
  door.position.set(-1.85, 0, -2.97);
  const frameMat = mat('#2f3546');
  const dark = plane(1.15, 2.5, new THREE.MeshBasicMaterial({ color: '#05060a' }));
  dark.position.set(0, 1.25, 0.005);
  door.add(dark);
  const leaf = new THREE.Group();
  leaf.position.set(-0.58, 0, 0.02);
  leaf.rotation.y = 0.55;
  const leafMesh = box(1.1, 2.48, 0.06, mat('#3a3f52'), 0.01);
  leafMesh.position.set(0.55, 1.24, 0);
  leaf.add(leafMesh);
  door.add(leaf);
  for (const [w, h, x, y] of [[0.1, 2.6, -0.62, 1.3], [0.1, 2.6, 0.62, 1.3], [1.34, 0.1, 0, 2.58]]) {
    const f = box(w, h, 0.08, frameMat, 0);
    f.position.set(x, y, 0.03);
    door.add(f);
  }
  scene.add(door);
  out.doorAnchor = new THREE.Vector3(-1.6, 2.5, -2.8);
  // Para el final: la puerta se abre y sale luz del cuarto de al lado.
  out.doorLeaf = leaf;
  out.doorGap = dark.material;
  out.doorLight = new THREE.PointLight('#ffc27a', 0, 7, 1.6);
  out.doorLight.position.set(-1.85, 1.6, -2.5);
  scene.add(out.doorLight);

  return out;
}
