import { clamp, easeOutBack } from './util.js';

const GOLD = '#f4c95d';

const SVG = {
  question: (t) => `
    <text x="20" y="70" font-size="78" font-weight="900" fill="${GOLD}" transform="rotate(${-10 + Math.sin(t * 6) * 6} 40 50)">?</text>
    <text x="70" y="58" font-size="64" font-weight="900" fill="${GOLD}" transform="rotate(${12 + Math.sin(t * 6 + 1) * 6} 90 40)">?</text>`,
  sparkle: (t) => {
    const star = (x, y, s) =>
      `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -30 C4 -6 6 -4 30 0 C6 4 4 6 0 30 C-4 6 -6 4 -30 0 C-6 -4 -4 -6 0 -30Z" fill="${GOLD}"/>`;
    const a = 0.75 + Math.sin(t * 9) * 0.25, b = 0.75 + Math.sin(t * 9 + 2) * 0.25;
    return star(40, 70, 1.1 * a) + star(105, 30, 0.75 * b);
  },
  stress: (t) => {
    const sq = (x, ph) =>
      `<path d="M${x} 10 q 14 12 0 24 q -14 12 0 24 q 14 12 0 24" stroke="#e8e2d0" stroke-width="7" fill="none" stroke-linecap="round" transform="translate(0 ${Math.sin(t * 12 + ph) * 3})"/>`;
    return sq(30, 0) + sq(70, 1.5) + sq(110, 3);
  },
  zzz: (t) => {
    let s = '';
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.35 + i / 3) % 1;
      const op = Math.sin(p * Math.PI);
      s += `<text x="${20 + p * 60 + Math.sin(p * 6) * 10}" y="${120 - p * 110}" font-size="${44 + p * 40}" font-weight="900" fill="#b9d0ff" stroke="#0b0d14" stroke-width="5" paint-order="stroke" opacity="${op}">z</text>`;
    }
    return s;
  },
};

export class Overlay {
  constructor(root) {
    this.root = root;
    this.caption = root.querySelector('#caption');
    this.emotes = {};
  }

  emote(id, type, x, y, scale, alpha, t) {
    let el = this.emotes[id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'emote';
      el.innerHTML = '<svg viewBox="0 0 150 130" width="150" height="130" style="overflow:visible;font-family:Inter"></svg>';
      this.root.querySelector('#emotes').appendChild(el);
      this.emotes[id] = el;
    }
    if (!type || alpha <= 0.001) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.opacity = alpha;
    el.style.transform = `translate(${x - 75}px, ${y - 65}px) scale(${scale})`;
    el.firstChild.innerHTML = SVG[type](t);
  }

  setCaption(word, who, age, top = 0.6) {
    const c = this.caption;
    if (!word) {
      c.style.display = 'none';
      return;
    }
    c.style.display = 'block';
    c.textContent = word;
    c.className = who === 'claude' ? 'claude' : 'trader';
    c.style.top = `${top * 100}%`;
    const s = 1 + 0.22 * (1 - easeOutBack(clamp(age / 0.14)));
    c.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
}
