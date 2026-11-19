/* Game covers, like a games console's: one big picture of the game, and its
   name on it in a bold title.

   The built-in games each have their own cover art - a poster moment drawn
   from the game's own pieces (its balloons, its bear, its whale). Any other
   game gets a picture of itself instead, zoomed in below the words a game
   shows while it plays. The title goes on top in one of five styles: all
   cream with a dark outline (one family), each with its own tilt, layout
   and a touch of the game's colour. */
import { poster } from './posters.js';
import { Scene } from '../games/pop-party-scene.js';
import { bearHead } from '../games/sleepy-bear.js';
import { whale, background, hotAir } from '../games/sky-painter.js';
import { leaf, AUTUMN } from '../games/leaf-pile.js';
import { block } from '../games/stack-it-high.js';

const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;
/* a seeded random sequence (for scatters that shouldn't line up) */
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const TAU = Math.PI * 2;

/* ---------- the art: W x H (16:10), no words ---------- */
const ART = {
  'pop-party': (c, W, H) => {
    poster({ id: 'pop-party' })(c, W, H, 1.2);
    /* a balloon popping, front and centre */
    const x = W * 0.6, y = H * 0.42, cols = ['#ff6b9d', '#ffd24a', '#4aa8ff', '#53e59a', '#b06bff'];
    for (let i = 0; i < 46; i++){
      const a = hash(i, 3) * TAU, d = H * (0.08 + hash(i, 5) * 0.26);
      c.save(); c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8); c.rotate(a * 2);
      c.fillStyle = cols[i % cols.length]; c.fillRect(-H * 0.012, -H * 0.006, H * 0.024, H * 0.012); c.restore();
    }
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = H * 0.008; c.lineCap = 'round';
    for (let i = 0; i < 10; i++){ const a = i / 10 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * H * 0.05, y + Math.sin(a) * H * 0.05); c.lineTo(x + Math.cos(a) * H * 0.1, y + Math.sin(a) * H * 0.1); c.stroke(); }
  },
  'last-known-position': (c, W, H) => poster({ id: 'last-known-position' })(c, W, H, 2),
  'sky-painter': (c, W, H) => {
    background(c, W, H, 'whale');
    /* broad strokes of paint, still wet */
    const strokes = [['#ff7aa8', 0.08, 0.7, 0.3, 0.42], ['#ffd25a', 0.05, 0.4, 0.28, 0.2], ['#79b3aa', 0.12, 0.88, 0.42, 0.72], ['#a98bff', 0.2, 0.18, 0.46, 0.08]];
    c.lineCap = 'round';
    for (const [col, x0, y0, x1, y1] of strokes){
      c.strokeStyle = col; c.globalAlpha = 0.85; c.lineWidth = H * 0.07;
      c.beginPath(); c.moveTo(W * x0, H * y0); c.quadraticCurveTo(W * (x0 + x1) / 2, H * (Math.min(y0, y1) - 0.12), W * x1, H * y1); c.stroke();
    }
    c.globalAlpha = 1;
    hotAir(c, W * 0.14, H * 0.3, H / 1500, false);
    whale(c, W * 0.6, H * 0.5, H / 560, false, 0.6);
  },
  'leaf-pile': (c, W, H) => {
    const s = new Scene(AUTUMN); s.step(1 / 60, { t: 2, p: 0.4, storm: false, wind: 0.01, joy: 0.6, look: 0.5, rainbow: false });
    s.drawBack(c, W, H); s.drawFront(c, W, H);
    const cols = ['#d9853b', '#ecb35a', '#a9522f', '#c9682e', '#e2a03f'];
    /* the pile, and a jump into it: leaves everywhere */
    const r = seeded(11);
    for (let i = 0; i < 170; i++){ const a = r() * Math.PI, d = Math.sqrt(r()); leaf(c, W * (0.62 + Math.cos(a) * d * 0.3), H * (0.98 - Math.sin(a) * d * 0.2), H / 280, r() * TAU, cols[i % cols.length]); }
    /* (a burst going up from the pile) */
    for (let i = 0; i < 80; i++){ const a = -Math.PI * (0.15 + r() * 0.7), d = 0.1 + Math.pow(r(), 0.7) * 0.55; leaf(c, W * 0.62 + Math.cos(a) * d * W * 0.5, H * 0.84 + Math.sin(a) * d * H * 1.15, H / (200 + r() * 260), r() * TAU, cols[(i + 2) % cols.length]); }
  },
  'sleepy-bear': (c, W, H) => {
    const s = new Scene(); s.step(1 / 60, { t: 3, p: 0.3, storm: false, wind: 0, joy: 0.5, look: 0.5, rainbow: false });
    s.drawBack(c, W, H);
    /* the bear's hill, close up, and the bear wide awake */
    c.fillStyle = '#7fae63'; c.beginPath(); c.ellipse(W * 0.6, H * 0.98, W * 0.5, H * 0.7, 0, Math.PI, TAU); c.fill();
    c.fillStyle = '#3a2f2a'; c.beginPath(); c.ellipse(W * 0.6, H * 0.72, W * 0.2, H * 0.27, 0, Math.PI, TAU); c.fill();
    bearHead(c, W * 0.6, H * 0.5, H / 560, { eye: 1, wake: 1, grumble: 0 }, 1);
    s.drawFront(c, W, H);
    c.fillStyle = '#5b6fb0';
    for (const [x, y, k] of [[0.18, 0.3, 1], [0.3, 0.18, 0.8], [0.4, 0.38, 0.9], [0.26, 0.52, 0.7]]){
      const r = H * 0.022 * k; c.beginPath(); c.ellipse(W * x, H * y, r * 1.2, r, -0.4, 0, TAU); c.fill();
      c.fillRect(W * x + r, H * y - r * 4, r * 0.35, r * 4);
    }
  },
  /* the new games' covers: drawn from shapes and emoji, no other game's code */
  'animal-gym': (c, W, H) => {
    const s = new Scene(); s.step(1 / 60, { t: 3, p: 0.35, storm: false, wind: 0, joy: 1, look: 0.5, rainbow: true });
    s.drawBack(c, W, H); s.drawFront(c, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const font = (k) => `${Math.round(H * k)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    c.font = font(0.5); c.fillText('\u{1F992}', W * 0.58, H * 0.46);
    c.font = font(0.22); c.fillText('\u{1F430}', W * 0.8, H * 0.7); c.fillText('\u{1F438}', W * 0.36, H * 0.74);
    c.font = font(0.18); c.fillText('\u{1F418}', W * 0.2, H * 0.5); c.fillText('\u{1F427}', W * 0.9, H * 0.46);
    c.fillStyle = '#fff6c8';
    for (const [x, y, r] of [[0.7, 0.14, 0.03], [0.4, 0.2, 0.02], [0.86, 0.3, 0.02]]){
      c.beginPath(); for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, q = k % 2 ? r * 0.35 : r; c.lineTo(W * x + Math.cos(a) * q * H, H * y + Math.sin(a) * q * H); } c.closePath(); c.fill();
    }
  },
  'keep-it-up': (c, W, H) => {
    const s = new Scene(); s.step(1 / 60, { t: 2, p: 0.3, storm: false, wind: 0, joy: 1, look: 0.5, rainbow: false });
    s.drawBack(c, W, H); s.drawFront(c, W, H);
    /* a beach ball, high in the sky, with a soft shadow on the grass */
    const x = W * 0.62, y = H * 0.4, r = H * 0.27, cols = ['#ff5d6c', '#ffb84d', '#ffe36e', '#4cc9a0', '#4da3ff', '#a98bff'];
    c.fillStyle = 'rgba(58,51,96,.2)'; c.beginPath(); c.ellipse(x, H * 0.93, r * 0.85, r * 0.16, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, y); c.rotate(0.35);
    cols.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * TAU / 6, (i + 1) * TAU / 6); c.closePath(); c.fill(); });
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r * 0.17, 0, TAU); c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, TAU); c.fill();
    /* motion lines under it, and two little sparkles */
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = H * 0.008; c.lineCap = 'round';
    for (const dx of [-0.5, 0, 0.5]){ c.beginPath(); c.moveTo(x + dx * r, y + r * 1.15); c.lineTo(x + dx * r, y + r * 1.45); c.stroke(); }
    c.fillStyle = '#fff6c8';
    for (const [px, py, pr] of [[0.3, 0.2, 0.03], [0.88, 0.22, 0.022]]){
      c.beginPath(); for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, q = k % 2 ? pr * 0.35 : pr; c.lineTo(W * px + Math.cos(a) * q * H, H * py + Math.sin(a) * q * H); } c.closePath(); c.fill();
    }
  },
  'ptero-flight': (c, W, H) => {
    /* a sunset sky, far mountains, a smoking volcano and a pterodactyl gliding over the trees */
    const g = c.createLinearGradient(0, 0, 0, H * 0.62); g.addColorStop(0, '#6a4f9b'); g.addColorStop(1, '#ffb56b'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(W * 0.22, H * 0.46, H * 0.02, W * 0.22, H * 0.46, H * 0.5); sun.addColorStop(0, 'rgba(255,240,200,.95)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = sun; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(110,90,140,.75)'; c.beginPath(); c.moveTo(0, H * 0.62);
    for (let i = 0; i <= 12; i++) c.lineTo(i * W / 12, H * (0.46 + hash(i, 7) * 0.1)); c.lineTo(W, H * 0.62); c.closePath(); c.fill();
    const gg = c.createLinearGradient(0, H * 0.6, 0, H); gg.addColorStop(0, '#a9c98c'); gg.addColorStop(1, '#4f9a5c'); c.fillStyle = gg; c.fillRect(0, H * 0.6, W, H * 0.4);
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    const font = (k) => `${Math.round(H * k)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    c.font = font(0.3); c.fillText('\u{1F30B}', W * 0.78, H * 0.78);
    c.font = font(0.2); c.fillText('\u{1F334}', W * 0.12, H * 0.9); c.fillText('\u{1F332}', W * 0.3, H * 0.86); c.fillText('\u{1F995}', W * 0.5, H * 0.88);
    /* the pterodactyl, big, from behind, over it all */
    c.save(); c.translate(W * 0.5, H * 0.42); c.rotate(-0.12);
    const span = W * 0.3;
    for (const side of [-1, 1]){
      c.fillStyle = '#e9915b'; c.beginPath(); c.moveTo(side * span * 0.06, 0);
      c.quadraticCurveTo(side * span * 0.6, -H * 0.2, side * span * 1.05, -H * 0.06);
      c.quadraticCurveTo(side * span * 0.8, H * 0.02, side * span * 0.7, H * 0.09);
      c.quadraticCurveTo(side * span * 0.4, H * 0.02, side * span * 0.25, H * 0.1);
      c.quadraticCurveTo(side * span * 0.12, H * 0.06, side * span * 0.06, H * 0.1); c.closePath(); c.fill();
      c.strokeStyle = '#2d6a78'; c.lineWidth = H * 0.012; c.lineCap = 'round';
      c.beginPath(); c.moveTo(side * span * 0.06, 0); c.quadraticCurveTo(side * span * 0.6, -H * 0.2, side * span * 1.05, -H * 0.06); c.stroke();
    }
    c.fillStyle = '#2d6a78'; c.beginPath(); c.ellipse(0, H * 0.04, span * 0.13, H * 0.1, 0, 0, TAU); c.fill();
    c.fillStyle = '#7cc6c0'; c.beginPath(); c.ellipse(0, H * 0.07, span * 0.07, H * 0.06, 0, 0, TAU); c.fill();
    c.fillStyle = '#2d6a78'; c.beginPath(); c.ellipse(0, -H * 0.09, span * 0.07, H * 0.06, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-span * 0.03, -H * 0.12); c.lineTo(0, -H * 0.22); c.lineTo(span * 0.05, -H * 0.11); c.closePath(); c.fill();
    c.restore();
  },
  'stack-it-high': (c, W, H) => {
    const s = new Scene(); s.step(1 / 60, { t: 2, p: 0.5, storm: false, wind: 0, joy: 1, look: 0.5, rainbow: true });
    s.drawBack(c, W, H); s.drawFront(c, W, H);
    /* a tower nearly too tall, the top one wobbling */
    const cols = ['#ff7aa8', '#ffd25a', '#79b3aa', '#a98bff', '#f2a65a', '#4aa8ff', '#53e59a', '#ff7aa8'], marks = ['star', 'heart', 'dot'];
    const bs = H * 0.16, x0 = W * 0.74;
    for (let i = 0; i < 5; i++) block(c, x0 + Math.sin(i * 1.3) * bs * 0.12, H * 0.98 - bs * 0.55 - i * bs * 0.96, bs, (hash(i, 3) - 0.5) * 0.12, cols[i], marks[i % 3]);
    block(c, x0 + bs * 0.35, H * 0.98 - bs * 0.55 - 5 * bs * 0.96 - bs * 0.12, bs, 0.35, cols[6], 'star');
    /* and the next one coming, held up high */
    block(c, W * 0.5, H * 0.56, bs * 0.9, -0.2, cols[5], 'heart');
    c.fillStyle = '#fff6c8';
    for (const [x, y, r] of [[0.75, 0.12, 0.03], [0.46, 0.2, 0.02], [0.8, 0.32, 0.018]]){
      c.beginPath(); for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, q = k % 2 ? r * 0.35 : r; c.lineTo(W * x + Math.cos(a) * q * H, H * y + Math.sin(a) * q * H); } c.closePath(); c.fill();
    }
  }
};
export const hasArt = (id) => !!ART[id];

/* ---------- the titles: five styles, one family ---------- */
const INK = '#16161d';
const FONT = '"Segoe UI Black", "Arial Black", "Segoe UI", Inter, system-ui, sans-serif';
const lines = (name, max) => {
  const words = name.toUpperCase().split(/\s+/);
  if (name.length <= max || words.length < 2) return [words.join(' ')];
  let best = null;
  for (let k = 1; k < words.length; k++){ const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '); const m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, ls: [a, b] }; }
  return best.ls;
};
const cream = (c, y, size) => { const g = c.createLinearGradient(0, y - size * 0.8, 0, y); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#fff1c2'); return g; };
/* the words, outlined, with a solid shadow of `drop` below them */
function word(c, t, x, y, size, drop, dx = 0, dy = size * 0.07){
  c.lineJoin = 'round';
  if (drop){ c.lineWidth = size * 0.16; c.strokeStyle = INK; c.strokeText(t, x + dx, y + dy); c.fillStyle = drop; c.fillText(t, x + dx, y + dy); }
  c.lineWidth = size * 0.11; c.strokeStyle = INK; c.strokeText(t, x, y);
  c.fillStyle = cream(c, y, size); c.fillText(t, x, y);
}
/* fit: the size that keeps the longest line inside `width` */
function fit(c, ls, size, width, style = ''){
  c.font = `${style} 900 ${size}px ${FONT}`;
  const w = Math.max(...ls.map(l => c.measureText(l).width));
  return w > width ? size * width / w : size;
}
const shade = (c, W, H, from = 0.45) => { const g = c.createLinearGradient(0, H * from, 0, H); g.addColorStop(0, 'rgba(12,10,30,0)'); g.addColorStop(1, 'rgba(12,10,30,.6)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };

export const TITLES = {
  /* 1: tilted, italic, bottom left, a solid drop in the game's colour */
  tilt(c, W, H, name, col){
    shade(c, W, H);
    const ls = lines(name, 12), size = fit(c, ls, H * 0.19, W * 0.82, 'italic');
    c.save(); c.translate(W * 0.05, H * 0.9 - (ls.length - 1) * size * 0.88); c.rotate(-0.05);
    c.font = `italic 900 ${size}px ${FONT}`; c.textBaseline = 'alphabetic';
    ls.forEach((l, i) => word(c, l, 0, i * size * 0.88, size, col));
    c.restore();
  },
  /* 2: stacked, straight, the last word biggest, a block shadow */
  stack(c, W, H, name, col){
    shade(c, W, H, 0.35);
    const ws = name.toUpperCase().split(/\s+/), last = ws.pop(), first = ws.join(' ');
    const big = fit(c, [last], H * 0.26, W * 0.8), small = first ? fit(c, [first], big * 0.55, W * 0.8) : 0;
    c.save(); c.textBaseline = 'alphabetic';
    if (first){ c.font = `900 ${small}px ${FONT}`; word(c, first, W * 0.06, H * 0.92 - big * 0.92, small, col, small * 0.06, small * 0.06); }
    c.font = `900 ${big}px ${FONT}`; word(c, last, W * 0.06, H * 0.92, big, col, big * 0.06, big * 0.06);
    c.restore();
  },
  /* 3: on a slanted ribbon in the game's colour, bottom right */
  ribbon(c, W, H, name, col){
    const ls = lines(name, 14), size = fit(c, ls, H * 0.13, W * 0.7);
    const bh = ls.length * size * 1.02 + size * 0.5, bw = W * 0.82;
    c.save(); c.translate(W * 0.97, H * 0.94); c.rotate(-0.06);
    c.fillStyle = INK; c.beginPath(); c.roundRect(-bw - size * 0.05, -bh + size * 0.1, bw, bh, size * 0.25); c.fill();
    c.fillStyle = col; c.beginPath(); c.roundRect(-bw, -bh, bw, bh, size * 0.25); c.fill();
    c.font = `900 ${size}px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'alphabetic';
    ls.forEach((l, i) => word(c, l, -size * 0.35, -bh + size * 1.05 + i * size * 1.02, size, null));
    c.restore();
  },
  /* 4: centred along the bottom, a deep stepped 3D drop */
  deep(c, W, H, name, col){
    shade(c, W, H);
    const ls = lines(name, 14), size = fit(c, ls, H * 0.17, W * 0.86);
    c.save(); c.font = `900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    ls.forEach((l, i) => {
      const y = H * 0.9 - (ls.length - 1 - i) * size * 0.95;
      c.lineJoin = 'round';
      for (let k = 5; k >= 1; k--){ c.lineWidth = size * 0.12; c.strokeStyle = INK; c.strokeText(l, W / 2, y + k * size * 0.025); c.fillStyle = col; c.fillText(l, W / 2, y + k * size * 0.025); }
      word(c, l, W / 2, y, size, null);
    });
    c.restore();
  },
  /* 5: top left, tipped the other way, with a sparkle */
  pop(c, W, H, name, col){
    const g = c.createLinearGradient(0, 0, 0, H * 0.5); g.addColorStop(0, 'rgba(12,10,30,.5)'); g.addColorStop(1, 'rgba(12,10,30,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    /* (kept short of the top right, where the Get pill goes) */
    const ls = lines(name, 11), size = fit(c, ls, H * 0.17, W * 0.52, 'italic');
    c.save(); c.translate(W * 0.06, H * 0.08 + size * 0.85); c.rotate(0.04);
    c.font = `italic 900 ${size}px ${FONT}`; c.textBaseline = 'alphabetic';
    ls.forEach((l, i) => word(c, l, 0, i * size * 0.9, size, col));
    const w = Math.max(...ls.map(l => c.measureText(l).width));
    const sx = w + size * 0.35, sy = -size * 0.6, r = size * 0.3;
    c.fillStyle = '#fff1c2'; c.strokeStyle = INK; c.lineWidth = size * 0.06;
    c.beginPath(); for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, q = k % 2 ? r * 0.38 : r; c.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } c.closePath(); c.stroke(); c.fill();
    c.restore();
  }
};
const ORDER = ['tilt', 'stack', 'ribbon', 'deep', 'pop'];
/* each built-in game's style; any other by its id (always the same one) */
const STYLE = { 'animal-gym': 'ribbon', 'keep-it-up': 'pop', 'ptero-flight': 'deep', 'pop-party': 'tilt', 'sky-painter': 'deep', 'leaf-pile': 'stack', 'sleepy-bear': 'ribbon', 'stack-it-high': 'pop', 'last-known-position': 'tilt', 'cubions-long-way-home': 'deep' };
export const styleOf = (id) => STYLE[id] || ORDER[[...String(id)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % ORDER.length];
/* the title's colour: the game's own, a little deeper */
const COLS = { 'animal-gym': '#1f9d63', 'keep-it-up': '#2f86e0', 'ptero-flight': '#d4743a', 'pop-party': '#ff4f93', 'sky-painter': '#3f7fd8', 'leaf-pile': '#e2702a', 'sleepy-bear': '#8a5a3b', 'stack-it-high': '#18a596', 'last-known-position': '#2fa36b', 'cubions-long-way-home': '#6a5be0' };

/* ---------- a cover ---------- */
/* { art, cover }: canvases, w x h. `still` (a canvas of the game playing)
   is used when there's no art of its own - zoomed in below its words. */
/* Games whose art reads better drawn at the banner's own wide shape than cut
   from the cover (Sky Painter's whale is huge when cropped): banner(g) gives
   a draw(c, w, h) that paints the whole scene across the banner, or null. */
const WIDE = new Set(['sky-painter']);
let wideMade = null;
export function banner(g){
  if (!WIDE.has(g.id) || !ART[g.id] || typeof document === 'undefined') return null;
  return (c, w, h) => {
    if (!wideMade || wideMade.id !== g.id || wideMade.w !== w || wideMade.h !== h){
      const k = document.createElement('canvas'); k.width = w; k.height = h;
      const kc = k.getContext && k.getContext('2d'); if (!kc) return;
      try { ART[g.id](kc, w, h); } catch (e){ return; }
      wideMade = { id: g.id, w, h, k };
    }
    c.drawImage(wideMade.k, 0, 0, w, h);
  };
}

/* The Discover tile on Play: the Create banner's purple and teal, a big
   sparkle, and DISCOVER in the cover lettering - one picture, made once. */
let discoverUrl = null;
export function discoverCoverUrl(){
  if (discoverUrl || typeof document === 'undefined') return discoverUrl;
  const W = 960, H = 540, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext && cv.getContext('2d'); if (!c) return null;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5b3fd6'); g.addColorStop(1, '#06b6d4'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.14)';
  for (const [x, y, r] of [[0.15, 0.2, 0.2], [0.85, 0.75, 0.26], [0.6, 0.1, 0.1]]){ c.beginPath(); c.arc(W * x, H * y, H * r, 0, TAU); c.fill(); }
  const star = (x, y, r, a) => { c.save(); c.globalAlpha = a; c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 8; k++){ const an = k * Math.PI / 4 - Math.PI / 2, q = k % 2 ? r * 0.34 : r; c.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q); } c.closePath(); c.fill(); c.restore(); };
  star(W * 0.66, H * 0.4, H * 0.34, 0.95); star(W * 0.88, H * 0.16, H * 0.09, 0.9); star(W * 0.42, H * 0.22, H * 0.06, 0.8);
  try { TITLES.deep(c, W, H, 'DISCOVER', '#4a2fb0'); } catch (e){}
  try { discoverUrl = cv.toDataURL('image/jpeg', 0.85); } catch (e){ discoverUrl = null; }
  return discoverUrl;
}

/* The See all tile on Play's My games row: a grid of soft tiles (one lit) on
   the app's purple and blue, with SEE ALL in the cover lettering - one
   picture, made once. */
let seeAllUrl = null;
export function seeAllCoverUrl(){
  if (seeAllUrl || typeof document === 'undefined') return seeAllUrl;
  const W = 960, H = 540, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext && cv.getContext('2d'); if (!c) return null;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6d5efc'); g.addColorStop(1, '#38bdf8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const cw = 150, gap = 26, x0 = W * 0.5 - (3 * cw + 2 * gap) / 2, y0 = 70;
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++){
    c.save(); c.globalAlpha = r === 0 && k === 1 ? 0.95 : 0.34; c.fillStyle = '#fff';
    c.beginPath(); c.roundRect(x0 + k * (cw + gap), y0 + r * (cw * 0.78 + gap), cw, cw * 0.78, 26); c.fill(); c.restore();
  }
  try { TITLES.tilt(c, W, H, 'SEE ALL', '#4a2fb0'); } catch (e){}
  try { seeAllUrl = cv.toDataURL('image/jpeg', 0.9); } catch (e){ seeAllUrl = null; }
  return seeAllUrl;
}

/* A stand-in card for a game that isn't made yet (Create's builder): the
   chosen look's colours, a big symbol for what you do, and the title in one of
   the cover styles - so it reads like the real thing will. */
export function previewCover(canvas, { name = 'Your game', cols = ['#8b7cff', '#4cc3e8'], glyph = '' } = {}){
  const c = canvas.getContext && canvas.getContext('2d'); if (!c) return;
  const W = canvas.width, H = canvas.height;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.16)';
  for (const [x, y, r] of [[0.15, 0.25, 0.22], [0.82, 0.18, 0.16], [0.7, 0.78, 0.28], [0.3, 0.9, 0.12]]){ c.beginPath(); c.arc(W * x, H * y, H * r, 0, TAU); c.fill(); }
  if (glyph){ c.save(); c.font = `${H * 0.42}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.95; c.fillText(glyph, W * 0.68, H * 0.42); c.restore(); }
  TITLES.tilt(c, W, H, String(name || 'Your game').slice(0, 40), cols[1]);
}

/* The art for a game that has no cover of its own (a creator's first versions): its look's two colours, soft
   circles, and a big sparkle - the title then goes on in one of the cover styles, like every other cover. */
export function generatedArt(cols = ['#8b7cff', '#4cc3e8'], w = 960, h = 600){
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext && cv.getContext('2d'); if (!c) return null;
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1] || cols[0]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.16)';
  for (const [x, y, r] of [[0.15, 0.25, 0.22], [0.82, 0.18, 0.16], [0.7, 0.78, 0.28], [0.3, 0.9, 0.12]]){ c.beginPath(); c.arc(w * x, h * y, h * r, 0, TAU); c.fill(); }
  /* the sparkle */
  c.save(); c.translate(w * 0.7, h * 0.36); c.fillStyle = 'rgba(255,255,255,.55)';
  const R = h * 0.3, r = R * 0.22; c.beginPath();
  for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? r : R; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
  c.closePath(); c.fill(); c.restore();
  return cv;
}

/* A game on its way: the card it'll be (its colours, its name), under hazard
   stripes with a construction sign, a pill saying how it's going and a bar
   along the bottom. For Play's Under construction row - nothing to pick. */
const buildingMade = new Map();
export function buildingCoverUrl({ name = 'Your game', cols = ['#8b7cff', '#4cc3e8'], label = 'Building…', pct = 50 } = {}){
  if (typeof document === 'undefined') return null;
  const key = JSON.stringify([name, cols, label, pct]);
  if (buildingMade.has(key)) return buildingMade.get(key);
  const W = 960, H = 540, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext && cv.getContext('2d'); if (!c) return null;
  try { previewCover(cv, { name, cols, glyph: '\u{1F6A7}' }); } catch (e){ return null; }
  c.save(); c.globalAlpha = 0.11; c.fillStyle = '#000';
  for (let x = -H; x < W + H; x += 84){ c.beginPath(); c.moveTo(x, H); c.lineTo(x + 42, H); c.lineTo(x + 42 + H, 0); c.lineTo(x + H, 0); c.closePath(); c.fill(); }
  c.restore();
  /* the pill, top left (Get is top right on the others) */
  c.font = `800 ${H * 0.09}px ${FONT}`;
  const pw = c.measureText(label).width + H * 0.15, ph = H * 0.15;
  c.fillStyle = 'rgba(255,255,255,.94)'; c.beginPath(); c.roundRect(H * 0.05, H * 0.05, pw, ph, ph / 2); c.fill();
  c.fillStyle = INK; c.textBaseline = 'middle'; c.fillText(label, H * 0.05 + H * 0.075, H * 0.05 + ph / 2 + 1);
  /* the bar */
  if (pct > 0){
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, H - H * 0.035, W, H * 0.035);
    c.fillStyle = '#fff'; c.fillRect(0, H - H * 0.035, W * Math.min(1, pct / 100), H * 0.035);
  }
  let url = null; try { url = cv.toDataURL('image/jpeg', 0.9); } catch (e){}
  buildingMade.set(key, url);
  return url;
}

/* A creator's cover (an SVG picture, no words) as an image to draw. Loaded
   as a picture, so nothing in it can run; checked first all the same. */
const UNSAFE_COVER = /<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href|<\s*image|<\s*style|<\s*text|<\s*tspan|<\s*use\b|url\(\s*['"]?(?!#)/i;
export const coverSvgOk = (svg) => typeof svg === 'string' && svg.length > 20 && svg.length <= 12000 && /^\s*<svg[\s>]/i.test(svg) && !UNSAFE_COVER.test(svg);
export function svgImage(svg){
  return new Promise((ok) => {
    if (typeof Image === 'undefined' || !coverSvgOk(svg)) return ok(null);
    const im = new Image();
    im.onload = () => ok(im); im.onerror = () => ok(null);
    const s = /xmlns\s*=/.test(svg) ? svg : svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
}
export function makeCover(g, { still = null, art: own = null, accent = '#6d5efc', w = 960, h = 600 } = {}){
  if (typeof document === 'undefined') return null;
  const art = document.createElement('canvas'); art.width = w; art.height = h;
  const c = art.getContext && art.getContext('2d'); if (!c) return null;
  if (ART[g.id]){ try { ART[g.id](c, w, h); } catch (e){ return null; } }
  else if (own){ try { c.drawImage(own, 0, 0, w, h); } catch (e){ return null; } }
  else if (still){
    const sy = still.height * 0.26, sh = still.height - sy, sw = Math.min(still.width, sh * w / h), sx = (still.width - sw) / 2;
    c.drawImage(still, sx, sy, sw, sh * sw / (sh * w / h), 0, 0, w, h);
  } else return null;
  const cover = document.createElement('canvas'); cover.width = w; cover.height = h;
  const cc = cover.getContext('2d');
  cc.drawImage(art, 0, 0);
  try { TITLES[styleOf(g.id)](cc, w, h, g.name || '', COLS[g.id] || accent); } catch (e){}
  return { art, cover };
}
