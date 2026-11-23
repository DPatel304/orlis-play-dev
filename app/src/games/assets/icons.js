/* Painted icons: the small pictures the HUD, the hint words and the shell's screens use in place of emoji (U4). Drawn in code in the house
   style (decisions 0040, 0041): palette colours by name, a flat fill, one shade tone, a thin ink edge. Each is [name, tags, aspect, draw]; draw is
   (c, s, o) with c moved to the middle of the icon and s its height. They join the library in index.js (after the emoji pieces, so an icon
   with the same id as an old emoji piece replaces it) and every one is square, so a row of them lines up.
   Icons are for sizes from about 24 px up; keep each to a few shapes so it still reads small. */
import { color as pal } from './palette.js';
const INK = pal('shade.ink'), SHADOW = pal('shade.shadow'), SNOW = pal('earth.snow');

const wash = (c, col, a) => { const g = c.globalAlpha; c.fillStyle = col; c.globalAlpha = g * a; c.fill(); c.globalAlpha = g; };
const line = (c, s, w = 0.05) => { c.lineWidth = s * w; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
/* one painted part: fill, a shade wash on its lower right, the ink edge. path() must start its own path. */
const part = (c, s, col, path, { shade = true, w = 0.05 } = {}) => {
  path(); c.fillStyle = col; c.fill();
  if (shade){ c.save(); path(); c.clip(); c.beginPath(); c.arc(s * 0.3, s * 0.34, s * 0.46, 0, 7); wash(c, SHADOW, 0.2); c.restore(); }
  path(); line(c, s, w);
};
const ell = (c, x, y, rx, ry, rot = 0) => () => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); };
const circ = (c, x, y, r) => ell(c, x, y, r, r);
const poly = (c, pts) => () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
const rrect = (c, x, y, w, h, r) => () => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const eye = (c, x, y, r) => { c.fillStyle = INK; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = SNOW; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.32, r * 0.36, 0, 7); c.fill(); };
const smile = (c, s, x, y, w) => { c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + w * 0.9, x + w, y); line(c, s, 0.035); };
const dot = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
const star5 = (c, r, inner = 0.45) => () => { c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * inner : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); };
const sparkle4 = (c, x, y, r) => () => { c.beginPath(); for (let k = 0; k < 8; k++){ const a = -Math.PI / 2 + k * Math.PI / 4, q = k % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); };

export const ICONS = {};
const def = (id, name, tags, draw) => { ICONS[id] = [name, tags, 1, draw]; };

/* ---------- animals (a friendly face each) ---------- */
def('giraffe', 'Giraffe', 'animal tall', (c, s) => {
  for (const sx of [-1, 1]){ part(c, s, pal('touch.sunflower'), ell(c, sx * s * 0.27, -s * 0.08, s * 0.1, s * 0.06, sx * 0.5)); c.beginPath(); c.moveTo(sx * s * 0.1, -s * 0.34); c.lineTo(sx * s * 0.12, -s * 0.46); line(c, s, 0.05); dot(c, sx * s * 0.12, -s * 0.47, s * 0.05, pal('fur.brown')); }
  part(c, s, pal('touch.sunflower'), ell(c, 0, s * 0.02, s * 0.25, s * 0.36));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.2, s * 0.19, s * 0.14), { shade: false });
  for (const [x, y, r] of [[-0.13, -0.2, 0.05], [0.12, -0.26, 0.04], [0.16, -0.08, 0.035]]) dot(c, x * s, y * s, r * s, pal('fur.brown'));
  dot(c, -s * 0.06, s * 0.2, s * 0.02, INK); dot(c, s * 0.06, s * 0.2, s * 0.02, INK); eye(c, -s * 0.11, -s * 0.03, s * 0.04); eye(c, s * 0.11, -s * 0.03, s * 0.04);
});
def('bunny', 'Bunny', 'animal hop', (c, s) => {
  for (const sx of [-1, 1]){ part(c, s, SNOW, ell(c, sx * s * 0.13, -s * 0.27, s * 0.1, s * 0.25, sx * 0.12)); c.save(); ell(c, sx * s * 0.13, -s * 0.26, s * 0.045, s * 0.17, sx * 0.12)(); wash(c, pal('earth.brick', 'light'), 0.9); c.restore(); }
  part(c, s, SNOW, ell(c, 0, s * 0.14, s * 0.32, s * 0.28));
  eye(c, -s * 0.12, s * 0.1, s * 0.04); eye(c, s * 0.12, s * 0.1, s * 0.04);
  c.beginPath(); c.arc(0, s * 0.18, s * 0.035, 0, 7); c.fillStyle = pal('earth.brick'); c.fill(); smile(c, s, 0, s * 0.22, s * 0.07);
  c.save(); ell(c, -s * 0.2, s * 0.2, s * 0.05, s * 0.03)(); wash(c, pal('touch.bubblegum'), 0.5); ell(c, s * 0.2, s * 0.2, s * 0.05, s * 0.03)(); wash(c, pal('touch.bubblegum'), 0.5); c.restore();
});
def('bird', 'Bird', 'animal fly', (c, s) => {
  part(c, s, pal('touch.skyBlue'), poly(c, [[-s * 0.06, -s * 0.34], [s * 0.02, -s * 0.46], [s * 0.04, -s * 0.3]]));
  part(c, s, pal('touch.skyBlue'), circ(c, 0, s * 0.06, s * 0.36));
  part(c, s, pal('touch.skyBlue', 'light'), ell(c, 0, s * 0.2, s * 0.22, s * 0.16), { shade: false });
  part(c, s, pal('touch.tangerine'), poly(c, [[-s * 0.07, s * 0.04], [s * 0.07, s * 0.04], [0, s * 0.16]]));
  eye(c, -s * 0.15, -s * 0.06, s * 0.045); eye(c, s * 0.15, -s * 0.06, s * 0.045);
});
def('frog', 'Frog', 'animal pond', (c, s) => {
  part(c, s, pal('meadow.fresh'), ell(c, 0, s * 0.14, s * 0.42, s * 0.3));
  for (const sx of [-1, 1]){ part(c, s, pal('meadow.fresh'), circ(c, sx * s * 0.22, -s * 0.14, s * 0.15)); dot(c, sx * s * 0.22, -s * 0.14, s * 0.1, SNOW); eye(c, sx * s * 0.22, -s * 0.13, s * 0.06); }
  smile(c, s, 0, s * 0.16, s * 0.24);
  dot(c, -s * 0.05, s * 0.04, s * 0.015, INK); dot(c, s * 0.05, s * 0.04, s * 0.015, INK);
});
def('elephant', 'Elephant', 'animal big', (c, s) => {
  const grey = pal('shade.light');
  for (const sx of [-1, 1]) part(c, s, grey, circ(c, sx * s * 0.3, -s * 0.04, s * 0.2));
  part(c, s, grey, rrect(c, -s * 0.07, s * 0.1, s * 0.14, s * 0.38, s * 0.07));
  part(c, s, grey, circ(c, 0, -s * 0.02, s * 0.28));
  eye(c, -s * 0.1, -s * 0.06, s * 0.04); eye(c, s * 0.1, -s * 0.06, s * 0.04);
});
def('penguin', 'Penguin', 'animal snow', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('touch.tangerine'), ell(c, sx * s * 0.14, s * 0.46, s * 0.1, s * 0.04));
  part(c, s, pal('fur.charcoal'), ell(c, 0, 0, s * 0.3, s * 0.44));
  part(c, s, SNOW, ell(c, 0, s * 0.1, s * 0.2, s * 0.3), { shade: false });
  part(c, s, pal('touch.tangerine'), poly(c, [[-s * 0.07, -s * 0.12], [s * 0.07, -s * 0.12], [0, -s * 0.02]]));
  eye(c, -s * 0.1, -s * 0.2, s * 0.04); eye(c, s * 0.1, -s * 0.2, s * 0.04);
});
def('dinosaur', 'Dinosaur', 'animal big', (c, s) => {
  for (const [x, y, r] of [[-0.2, -0.3, 0.1], [0, -0.38, 0.12], [0.2, -0.3, 0.1]]) part(c, s, pal('touch.tangerine'), poly(c, [[(x - r) * s, y * s + r * s * 0.9], [x * s, (y - r) * s], [(x + r) * s, y * s + r * s * 0.9]]));
  part(c, s, pal('touch.mint'), ell(c, 0, s * 0.06, s * 0.36, s * 0.32));
  part(c, s, pal('touch.mint', 'light'), ell(c, 0, s * 0.22, s * 0.24, s * 0.14), { shade: false });
  dot(c, -s * 0.07, s * 0.2, s * 0.02, INK); dot(c, s * 0.07, s * 0.2, s * 0.02, INK);
  eye(c, -s * 0.15, -s * 0.06, s * 0.05); eye(c, s * 0.15, -s * 0.06, s * 0.05);
});
def('lizard', 'Lizard', 'animal', (c, s) => {
  const g = pal('meadow.grass');
  c.beginPath(); c.moveTo(-s * 0.4, s * 0.3); c.quadraticCurveTo(-s * 0.5, s * 0.1, -s * 0.2, s * 0.08); c.lineWidth = s * 0.13; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
  c.lineWidth = s * 0.08; c.strokeStyle = g; c.stroke();
  for (const [x, y] of [[0.12, -0.2], [0.12, 0.24], [-0.14, -0.2], [-0.14, 0.24]]) part(c, s, g, ell(c, x * s, y * s, s * 0.09, s * 0.05, 0.5));
  part(c, s, g, ell(c, 0, s * 0.02, s * 0.3, s * 0.16));
  part(c, s, g, ell(c, s * 0.3, s * 0.02, s * 0.15, s * 0.12));
  eye(c, s * 0.34, -s * 0.03, s * 0.035);
});
def('owl', 'Owl', 'animal night', (c, s) => {
  part(c, s, pal('earth.bark'), ell(c, 0, s * 0.04, s * 0.34, s * 0.4));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.18, s * 0.2, s * 0.22), { shade: false });
  for (const sx of [-1, 1]){ part(c, s, SNOW, circ(c, sx * s * 0.14, -s * 0.1, s * 0.13), { shade: false }); eye(c, sx * s * 0.14, -s * 0.1, s * 0.06); }
  part(c, s, pal('touch.tangerine'), poly(c, [[-s * 0.05, -s * 0.02], [s * 0.05, -s * 0.02], [0, s * 0.08]]));
});
def('bee', 'Bee', 'animal fly', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('sea.sunlit', 'light'), ell(c, sx * s * 0.16, -s * 0.28, s * 0.1, s * 0.17, sx * 0.4), { shade: false });
  part(c, s, pal('touch.sunflower'), ell(c, 0, s * 0.06, s * 0.36, s * 0.3));
  c.save(); ell(c, 0, s * 0.06, s * 0.36, s * 0.3)(); c.clip(); c.fillStyle = INK; c.fillRect(-s * 0.16, -s * 0.3, s * 0.1, s * 0.7); c.fillRect(s * 0.08, -s * 0.3, s * 0.1, s * 0.7); c.restore();
  ell(c, 0, s * 0.06, s * 0.36, s * 0.3)(); line(c, s);
  eye(c, -s * 0.22, s * 0.0, s * 0.04);
});
def('fish', 'Fish', 'animal sea', (c, s) => {
  part(c, s, pal('touch.tangerine'), poly(c, [[s * 0.18, 0], [s * 0.46, -s * 0.2], [s * 0.46, s * 0.2]]));
  part(c, s, pal('touch.tangerine'), ell(c, -s * 0.04, 0, s * 0.34, s * 0.24));
  part(c, s, pal('touch.sunflower'), ell(c, s * 0.02, s * 0.02, s * 0.08, s * 0.17), { shade: false });
  eye(c, -s * 0.2, -s * 0.05, s * 0.045);
});
def('cat', 'Cat', 'animal pet', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('touch.tangerine'), poly(c, [[sx * s * 0.34, -s * 0.02], [sx * s * 0.28, -s * 0.4], [sx * s * 0.06, -s * 0.2]]));
  part(c, s, pal('touch.tangerine'), ell(c, 0, s * 0.1, s * 0.38, s * 0.32));
  eye(c, -s * 0.15, s * 0.04, s * 0.045); eye(c, s * 0.15, s * 0.04, s * 0.045);
  dot(c, 0, s * 0.14, s * 0.03, pal('earth.brick')); smile(c, s, 0, s * 0.18, s * 0.07);
  c.lineWidth = s * 0.02; c.strokeStyle = INK; for (const sx of [-1, 1]) for (const dy of [0, 0.05]){ c.beginPath(); c.moveTo(sx * s * 0.17, s * (0.18 + dy)); c.lineTo(sx * s * 0.4, s * (0.16 + dy * 1.6)); c.stroke(); }
});
def('dog', 'Dog', 'animal pet', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('fur.brown'), ell(c, sx * s * 0.3, s * 0.0, s * 0.11, s * 0.24, sx * 0.25));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.06, s * 0.3, s * 0.32));
  part(c, s, SNOW, ell(c, 0, s * 0.2, s * 0.17, s * 0.13), { shade: false });
  dot(c, 0, s * 0.15, s * 0.045, INK); smile(c, s, 0, s * 0.23, s * 0.06);
  eye(c, -s * 0.13, -s * 0.04, s * 0.04); eye(c, s * 0.13, -s * 0.04, s * 0.04);
});

/* ---------- nature ---------- */
def('fallenleaf', 'Falling leaf', 'nature autumn', (c, s) => {
  const leaf = (x, y, rot, col, k) => { c.save(); c.translate(x * s, y * s); c.rotate(rot);
    part(c, s, col, () => { c.beginPath(); c.moveTo(0, -s * 0.3 * k); c.quadraticCurveTo(s * 0.26 * k, -s * 0.05 * k, 0, s * 0.3 * k); c.quadraticCurveTo(-s * 0.26 * k, -s * 0.05 * k, 0, -s * 0.3 * k); c.closePath(); });
    c.beginPath(); c.moveTo(0, -s * 0.2 * k); c.lineTo(0, s * 0.4 * k); c.lineWidth = s * 0.035; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.restore(); };
  leaf(-0.12, 0.04, -0.5, pal('autumn.rust'), 1); leaf(0.14, -0.02, 0.6, pal('autumn.amber'), 1.05);
});
def('leaf', 'Leaf', 'nature garden', (c, s) => {
  c.save(); c.rotate(0.5);
  part(c, s, pal('meadow.fresh'), () => { c.beginPath(); c.moveTo(0, -s * 0.42); c.quadraticCurveTo(s * 0.32, -s * 0.08, 0, s * 0.36); c.quadraticCurveTo(-s * 0.32, -s * 0.08, 0, -s * 0.42); c.closePath(); });
  c.beginPath(); c.moveTo(0, -s * 0.24); c.lineTo(0, s * 0.46); line(c, s, 0.04); c.restore();
});
def('flower', 'Flower', 'nature garden', (c, s) => {
  for (let i = 0; i < 5; i++){ const a = i * Math.PI * 2 / 5 - Math.PI / 2; part(c, s, pal('touch.bubblegum'), circ(c, Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22, s * 0.16)); }
  part(c, s, pal('touch.sunflower'), circ(c, 0, 0, s * 0.14));
});
def('palm', 'Palm tree', 'nature beach', (c, s) => {
  part(c, s, pal('earth.bark'), () => { c.beginPath(); c.moveTo(-s * 0.06, s * 0.46); c.quadraticCurveTo(s * 0.04, s * 0.1, -s * 0.02, -s * 0.12); c.lineTo(s * 0.08, -s * 0.12); c.quadraticCurveTo(s * 0.14, s * 0.1, s * 0.1, s * 0.46); c.closePath(); });
  for (const a of [-2.7, -2.1, -1.6, -1.0, -0.4]) part(c, s, pal('meadow.fresh'), () => { c.save(); c.translate(s * 0.03, -s * 0.14); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.18, -s * 0.12, s * 0.38, s * 0.02); c.quadraticCurveTo(s * 0.18, s * 0.0, 0, 0); c.restore(); });
});
def('pinetree', 'Pine tree', 'nature tree', (c, s) => {
  part(c, s, pal('earth.bark'), rrect(c, -s * 0.05, s * 0.28, s * 0.1, s * 0.18, s * 0.02));
  for (const [y, w] of [[0.1, 0.34], [-0.08, 0.28], [-0.24, 0.2]]) part(c, s, pal('meadow.deep'), poly(c, [[0, (y - 0.2) * s], [w * s, (y + 0.2) * s], [-w * s, (y + 0.2) * s]]));
});
def('roundtree', 'Round tree', 'nature tree', (c, s) => {
  part(c, s, pal('earth.bark'), rrect(c, -s * 0.06, s * 0.1, s * 0.12, s * 0.36, s * 0.02));
  part(c, s, pal('meadow.fresh'), circ(c, 0, -s * 0.12, s * 0.32));
});
def('fern', 'Fern', 'nature forest', (c, s) => {
  c.beginPath(); c.moveTo(0, s * 0.46); c.quadraticCurveTo(s * 0.04, 0, 0, -s * 0.44); c.lineWidth = s * 0.05; c.strokeStyle = pal('meadow.deep'); c.lineCap = 'round'; c.stroke();
  for (let i = 0; i < 5; i++){ const y = s * (0.34 - i * 0.16), w = s * (0.3 - i * 0.04); for (const sx of [-1, 1]) part(c, s, pal('meadow.fresh'), ell(c, sx * w * 0.55, y - s * 0.04, w * 0.5, s * 0.055, sx * -0.5), { w: 0.035 }); }
});
def('volcano', 'Volcano', 'nature', (c, s) => {
  part(c, s, pal('touch.cherry'), poly(c, [[-s * 0.14, -s * 0.12], [-s * 0.07, -s * 0.34], [0, -s * 0.2], [s * 0.07, -s * 0.36], [s * 0.14, -s * 0.12]]));
  part(c, s, pal('earth.bark'), poly(c, [[-s * 0.46, s * 0.42], [-s * 0.16, -s * 0.14], [s * 0.16, -s * 0.14], [s * 0.46, s * 0.42]]));
  c.save(); c.globalAlpha *= 0.9; part(c, s, pal('touch.tangerine'), poly(c, [[-s * 0.16, -s * 0.14], [s * 0.16, -s * 0.14], [s * 0.1, -s * 0.04], [-s * 0.1, -s * 0.04]]), { shade: false }); c.restore();
});
def('egg', 'Nest of eggs', 'nature', (c, s) => {
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.22, s * 0.44, s * 0.18));
  for (const [x, y, k] of [[-0.18, 0.05, 1], [0.0, -0.02, 1.1], [0.18, 0.05, 1]]) part(c, s, SNOW, ell(c, x * s, y * s, s * 0.12 * k, s * 0.16 * k), { shade: true });
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.3, s * 0.4, s * 0.1), { shade: false });
});
def('waterfall', 'Waterfall', 'nature', (c, s) => {
  part(c, s, pal('space.rock'), rrect(c, -s * 0.46, -s * 0.38, s * 0.92, s * 0.76, s * 0.1));
  part(c, s, pal('sky.high'), rrect(c, -s * 0.12, -s * 0.38, s * 0.24, s * 0.62, s * 0.08), { shade: false });
  part(c, s, SNOW, ell(c, 0, s * 0.28, s * 0.22, s * 0.08), { shade: false });
});
def('snowflake', 'Snowflake', 'nature snow', (c, s) => {
  c.lineCap = 'round'; for (const w of [[INK, 0.12], [pal('sea.sunlit'), 0.07]]){ c.strokeStyle = w[0]; c.lineWidth = s * w[1];
    for (let i = 0; i < 3; i++){ const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4); c.lineTo(-Math.cos(a) * s * 0.4, -Math.sin(a) * s * 0.4); c.stroke(); } }
});
def('moon', 'Moon', 'nature night', (c, s) => {
  part(c, s, pal('touch.sunflower', 'light'), () => { c.beginPath(); c.arc(0, 0, s * 0.4, 0.9, Math.PI * 2 - 0.9, true); c.arc(s * 0.2, 0, s * 0.31, Math.PI * 2 - 1.2, 1.2); c.closePath(); });
});
def('sunrise', 'Sunset', 'sky', (c, s) => {
  part(c, s, pal('touch.sunflower'), () => { c.beginPath(); c.arc(0, s * 0.16, s * 0.3, Math.PI, 0); c.closePath(); });
  c.beginPath(); c.moveTo(-s * 0.44, s * 0.16); c.lineTo(s * 0.44, s * 0.16); line(c, s, 0.06);
  c.strokeStyle = INK; c.lineWidth = s * 0.05; c.lineCap = 'round'; for (const a of [-2.4, -1.57, -0.74]){ c.beginPath(); c.moveTo(Math.cos(a) * s * 0.38, s * 0.16 + Math.sin(a) * s * 0.38); c.lineTo(Math.cos(a) * s * 0.5, s * 0.16 + Math.sin(a) * s * 0.5); c.stroke(); }
});
def('raindrop', 'Raindrop', 'sky', (c, s) => {
  part(c, s, pal('touch.skyBlue'), () => { c.beginPath(); c.moveTo(0, -s * 0.44); c.quadraticCurveTo(s * 0.34, s * 0.06, s * 0.26, s * 0.2); c.arc(0, s * 0.2, s * 0.26, 0, Math.PI); c.quadraticCurveTo(-s * 0.34, s * 0.06, 0, -s * 0.44); c.closePath(); });
});
def('wind', 'Wind', 'sky', (c, s) => {
  c.lineCap = 'round'; for (const [w, col] of [[0.1, INK], [0.05, pal('sky.high')]]){ c.lineWidth = s * w; c.strokeStyle = col;
    c.beginPath(); c.moveTo(-s * 0.4, -s * 0.16); c.lineTo(s * 0.14, -s * 0.16); c.arc(s * 0.14, -s * 0.26, s * 0.1, Math.PI / 2, -Math.PI / 2 - 0.4, true); c.stroke();
    c.beginPath(); c.moveTo(-s * 0.4, s * 0.06); c.lineTo(s * 0.3, s * 0.06); c.arc(s * 0.3, -s * 0.04, s * 0.1, Math.PI / 2, -Math.PI / 2, true); c.stroke();
    c.beginPath(); c.moveTo(-s * 0.3, s * 0.28); c.lineTo(s * 0.1, s * 0.28); c.arc(s * 0.1, s * 0.38, s * 0.1, -Math.PI / 2, Math.PI / 2 + 0.4); c.stroke(); }
});
def('wave', 'Wave', 'nature sea', (c, s) => {
  part(c, s, pal('sea.far'), () => { c.beginPath(); c.moveTo(-s * 0.46, s * 0.3); c.quadraticCurveTo(-s * 0.4, -s * 0.3, s * 0.1, -s * 0.28); c.quadraticCurveTo(s * 0.4, -s * 0.26, s * 0.3, -s * 0.06); c.quadraticCurveTo(s * 0.1, -s * 0.06, s * 0.1, s * 0.04); c.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.46, s * 0.3); c.closePath(); });
  part(c, s, SNOW, ell(c, s * 0.04, -s * 0.2, s * 0.12, s * 0.05, 0.3), { shade: false });
});
def('rainbow', 'Rainbow', 'sky', (c, s) => {
  c.lineCap = 'butt'; ['touch.cherry', 'touch.sunflower', 'touch.mint', 'touch.skyBlue'].forEach((n, i) => { c.strokeStyle = pal(n); c.lineWidth = s * 0.1; c.beginPath(); c.arc(0, s * 0.26, s * (0.38 - i * 0.09), Math.PI, 0); c.stroke(); });
  c.strokeStyle = INK; c.lineWidth = s * 0.03; c.beginPath(); c.arc(0, s * 0.26, s * 0.43, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(0, s * 0.26, s * 0.07, Math.PI, 0); c.stroke();
});
def('cloudy', 'Cloud', 'sky', (c, s) => {
  const puffs = [[-0.22, 0.08, 0.2], [0.02, -0.08, 0.26], [0.25, 0.06, 0.2]];
  c.fillStyle = INK; for (const [x, y, r] of puffs){ c.beginPath(); c.arc(x * s, y * s, (r + 0.03) * s, 0, 7); c.fill(); } c.fillRect(-0.22 * s, 0.06 * s, 0.47 * s, 0.25 * s);
  c.fillStyle = SNOW; for (const [x, y, r] of puffs){ c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); } c.fillRect(-0.22 * s, 0.08 * s, 0.47 * s, 0.2 * s);
});

/* ---------- food ---------- */
def('apple', 'Apple', 'food fruit', (c, s) => {
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.moveTo(0, -s * 0.2); c.bezierCurveTo(s * 0.18, -s * 0.36, s * 0.46, -s * 0.16, s * 0.34, s * 0.14); c.bezierCurveTo(s * 0.28, s * 0.4, s * 0.08, s * 0.46, 0, s * 0.38); c.bezierCurveTo(-s * 0.08, s * 0.46, -s * 0.28, s * 0.4, -s * 0.34, s * 0.14); c.bezierCurveTo(-s * 0.46, -s * 0.16, -s * 0.18, -s * 0.36, 0, -s * 0.2); c.closePath(); });
  c.beginPath(); c.moveTo(0, -s * 0.18); c.quadraticCurveTo(s * 0.02, -s * 0.32, s * 0.08, -s * 0.38); line(c, s, 0.05);
  part(c, s, pal('meadow.fresh'), ell(c, s * 0.16, -s * 0.3, s * 0.12, s * 0.06, -0.4));
});
def('pear', 'Pear', 'food fruit', (c, s) => {
  part(c, s, pal('meadow.lawn'), () => { c.beginPath(); c.moveTo(0, -s * 0.3); c.bezierCurveTo(s * 0.14, -s * 0.3, s * 0.16, -s * 0.08, s * 0.24, s * 0.08); c.bezierCurveTo(s * 0.4, s * 0.34, s * 0.12, s * 0.48, 0, s * 0.46); c.bezierCurveTo(-s * 0.12, s * 0.48, -s * 0.4, s * 0.34, -s * 0.24, s * 0.08); c.bezierCurveTo(-s * 0.16, -s * 0.08, -s * 0.14, -s * 0.3, 0, -s * 0.3); c.closePath(); });
  c.beginPath(); c.moveTo(0, -s * 0.28); c.quadraticCurveTo(s * 0.02, -s * 0.38, s * 0.06, -s * 0.44); line(c, s, 0.05);
  part(c, s, pal('meadow.fresh'), ell(c, s * 0.14, -s * 0.36, s * 0.1, s * 0.05, -0.4));
});
def('strawberry', 'Strawberry', 'food fruit', (c, s) => {
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.moveTo(-s * 0.36, -s * 0.18); c.quadraticCurveTo(0, -s * 0.34, s * 0.36, -s * 0.18); c.quadraticCurveTo(s * 0.34, s * 0.18, 0, s * 0.46); c.quadraticCurveTo(-s * 0.34, s * 0.18, -s * 0.36, -s * 0.18); c.closePath(); });
  for (const [x, y] of [[-0.14, -0.04], [0.14, -0.04], [0, 0.1], [-0.08, 0.24], [0.08, 0.24], [0, -0.1]]) dot(c, x * s, y * s, s * 0.025, pal('touch.sunflower'));
  part(c, s, pal('meadow.fresh'), poly(c, [[-s * 0.24, -s * 0.24], [-s * 0.08, -s * 0.34], [0, -s * 0.44], [s * 0.08, -s * 0.34], [s * 0.24, -s * 0.24], [0, -s * 0.18]]), { shade: false });
});
def('cupcake', 'Cupcake', 'food treat', (c, s) => {
  part(c, s, pal('touch.grape', 'light'), poly(c, [[-s * 0.28, 0], [s * 0.28, 0], [s * 0.2, s * 0.4], [-s * 0.2, s * 0.4]]));
  part(c, s, pal('touch.bubblegum'), () => { c.beginPath(); c.arc(0, -s * 0.04, s * 0.32, Math.PI, 0); c.lineTo(s * 0.3, 0); c.lineTo(-s * 0.3, 0); c.closePath(); });
  dot(c, 0, -s * 0.38, s * 0.06, pal('touch.cherry')); c.beginPath(); c.arc(0, -s * 0.38, s * 0.06, 0, 7); line(c, s, 0.03);
});
def('lollipop', 'Lollipop', 'food treat', (c, s) => {
  c.beginPath(); c.moveTo(s * 0.12, s * 0.1); c.lineTo(-s * 0.16, s * 0.46); c.lineWidth = s * 0.09; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = s * 0.05; c.strokeStyle = SNOW; c.stroke();
  part(c, s, pal('touch.bubblegum'), circ(c, s * 0.1, -s * 0.12, s * 0.32));
  c.beginPath(); c.arc(s * 0.1, -s * 0.12, s * 0.2, 0, 4.4); c.lineWidth = s * 0.05; c.strokeStyle = SNOW; c.stroke(); c.beginPath(); c.arc(s * 0.1, -s * 0.12, s * 0.09, 0, 4.4); c.stroke();
});
def('basket', 'Basket', 'thing garden', (c, s) => {
  c.beginPath(); c.arc(0, -s * 0.02, s * 0.3, Math.PI, 0); c.lineWidth = s * 0.05; c.strokeStyle = INK; c.stroke();
  part(c, s, pal('earth.sand'), poly(c, [[-s * 0.42, -s * 0.04], [s * 0.42, -s * 0.04], [s * 0.3, s * 0.38], [-s * 0.3, s * 0.38]]));
  c.strokeStyle = pal('earth.sand', 'shade'); c.lineWidth = s * 0.03; for (const x of [-0.16, 0, 0.16]){ c.beginPath(); c.moveTo(x * s, -s * 0.02); c.lineTo(x * 0.8 * s, s * 0.36); c.stroke(); }
});

/* ---------- things ---------- */
def('feather', 'Feather', 'thing', (c, s) => {
  c.save(); c.rotate(0.6);
  part(c, s, pal('fur.charcoal'), () => { c.beginPath(); c.moveTo(0, -s * 0.46); c.quadraticCurveTo(s * 0.26, -s * 0.1, 0, s * 0.36); c.quadraticCurveTo(-s * 0.26, -s * 0.1, 0, -s * 0.46); c.closePath(); });
  c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(0, s * 0.5); c.strokeStyle = SNOW; c.lineWidth = s * 0.03; c.stroke(); c.restore();
});
def('dice', 'Dice', 'thing', (c, s) => {
  part(c, s, SNOW, rrect(c, -s * 0.36, -s * 0.36, s * 0.72, s * 0.72, s * 0.14));
  for (const [x, y] of [[-0.18, -0.18], [0.18, -0.18], [0, 0], [-0.18, 0.18], [0.18, 0.18]]) dot(c, x * s, y * s, s * 0.055, INK);
});
def('volleyball', 'Ball', 'thing ball', (c, s) => {
  part(c, s, SNOW, circ(c, 0, 0, s * 0.4));
  c.save(); circ(c, 0, 0, s * 0.4)(); c.clip(); c.strokeStyle = pal('touch.skyBlue'); c.lineWidth = s * 0.07;
  for (const a of [0, 2.1, 4.2]){ c.save(); c.rotate(a); c.beginPath(); c.arc(-s * 0.4, 0, s * 0.5, -0.9, 0.9); c.stroke(); c.restore(); } c.restore();
  circ(c, 0, 0, s * 0.4)(); line(c, s);
});
def('sparkles', 'Sparkles', 'effect', (c, s) => {
  part(c, s, pal('touch.sunflower'), sparkle4(c, -s * 0.06, s * 0.02, s * 0.38), { w: 0.04 });
  part(c, s, pal('touch.sunflower'), sparkle4(c, s * 0.3, -s * 0.3, s * 0.18), { w: 0.04 });
  part(c, s, pal('touch.sunflower'), sparkle4(c, s * 0.26, s * 0.3, s * 0.14), { w: 0.04 });
});
def('glowstar', 'Glowing star', 'nature night', (c, s) => { part(c, s, pal('touch.sunflower'), star5(c, s * 0.46), { w: 0.05 }); });
def('gem', 'Gem', 'thing', (c, s) => {
  part(c, s, pal('touch.lagoon'), poly(c, [[-s * 0.28, -s * 0.26], [s * 0.28, -s * 0.26], [s * 0.44, -s * 0.04], [0, s * 0.42], [-s * 0.44, -s * 0.04]]));
  c.beginPath(); c.moveTo(-s * 0.44, -s * 0.04); c.lineTo(s * 0.44, -s * 0.04); c.moveTo(-s * 0.14, -s * 0.26); c.lineTo(-s * 0.2, -s * 0.04); c.lineTo(0, s * 0.42); c.lineTo(s * 0.2, -s * 0.04); c.lineTo(s * 0.14, -s * 0.26); line(c, s, 0.03);
});
def('crown', 'Crown', 'thing', (c, s) => {
  part(c, s, pal('ui.gold'), poly(c, [[-s * 0.4, s * 0.28], [-s * 0.44, -s * 0.22], [-s * 0.2, -s * 0.02], [0, -s * 0.34], [s * 0.2, -s * 0.02], [s * 0.44, -s * 0.22], [s * 0.4, s * 0.28]]));
  for (const x of [-0.24, 0, 0.24]) dot(c, x * s, s * 0.16, s * 0.04, pal('touch.cherry'));
});
def('gift', 'Present', 'thing party', (c, s) => {
  part(c, s, pal('touch.skyBlue'), rrect(c, -s * 0.38, -s * 0.12, s * 0.76, s * 0.5, s * 0.05));
  part(c, s, pal('touch.skyBlue', 'light'), rrect(c, -s * 0.42, -s * 0.28, s * 0.84, s * 0.2, s * 0.05), { shade: false });
  c.fillStyle = pal('touch.cherry'); c.fillRect(-s * 0.06, -s * 0.28, s * 0.12, s * 0.66);
  part(c, s, pal('touch.cherry'), ell(c, -s * 0.12, -s * 0.34, s * 0.1, s * 0.06, -0.5), { w: 0.035 }); part(c, s, pal('touch.cherry'), ell(c, s * 0.12, -s * 0.34, s * 0.1, s * 0.06, 0.5), { w: 0.035 });
});
def('bell', 'Bell', 'thing music', (c, s) => {
  part(c, s, pal('ui.gold'), () => { c.beginPath(); c.moveTo(-s * 0.4, s * 0.26); c.quadraticCurveTo(-s * 0.3, s * 0.1, -s * 0.28, -s * 0.12); c.quadraticCurveTo(0, -s * 0.5, s * 0.28, -s * 0.12); c.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.4, s * 0.26); c.closePath(); });
  part(c, s, pal('earth.brick'), circ(c, 0, s * 0.34, s * 0.07), { shade: false });
});
def('musicnote', 'Music note', 'music', (c, s) => {
  c.fillStyle = INK; c.fillRect(-s * 0.02, -s * 0.34, s * 0.1, s * 0.6);
  part(c, s, pal('touch.grape'), ell(c, -s * 0.12, s * 0.28, s * 0.17, s * 0.12, -0.4));
  part(c, s, pal('touch.grape'), poly(c, [[s * 0.06, -s * 0.34], [s * 0.34, -s * 0.2], [s * 0.34, -s * 0.06], [s * 0.06, -s * 0.2]]));
});
def('rocket', 'Rocket', 'thing space', (c, s) => {
  c.save(); c.rotate(0.6);
  part(c, s, pal('touch.tangerine'), poly(c, [[-s * 0.1, s * 0.3], [0, s * 0.5], [s * 0.1, s * 0.3]]), { shade: false });
  for (const sx of [-1, 1]) part(c, s, pal('touch.cherry'), poly(c, [[sx * s * 0.12, s * 0.1], [sx * s * 0.3, s * 0.3], [sx * s * 0.12, s * 0.3]]));
  part(c, s, SNOW, () => { c.beginPath(); c.moveTo(0, -s * 0.46); c.quadraticCurveTo(s * 0.22, -s * 0.2, s * 0.14, s * 0.3); c.lineTo(-s * 0.14, s * 0.3); c.quadraticCurveTo(-s * 0.22, -s * 0.2, 0, -s * 0.46); c.closePath(); });
  part(c, s, pal('touch.skyBlue'), circ(c, 0, -s * 0.08, s * 0.08)); c.restore();
});
def('airplane', 'Airplane', 'thing fly', (c, s) => {
  c.save(); c.rotate(-0.4);
  part(c, s, SNOW, poly(c, [[-s * 0.1, 0], [-s * 0.36, s * 0.24], [-s * 0.4, s * 0.12], [-s * 0.2, -s * 0.06]]));
  part(c, s, SNOW, ell(c, 0, 0, s * 0.42, s * 0.1));
  part(c, s, pal('touch.skyBlue'), poly(c, [[-s * 0.1, -s * 0.04], [s * 0.06, -s * 0.3], [s * 0.18, -s * 0.3], [s * 0.12, -s * 0.04]]));
  part(c, s, pal('touch.skyBlue'), poly(c, [[-s * 0.1, s * 0.04], [s * 0.06, s * 0.3], [s * 0.18, s * 0.3], [s * 0.12, s * 0.04]])); c.restore();
});
def('sailboat', 'Sailboat', 'thing sea', (c, s) => {
  part(c, s, SNOW, poly(c, [[0, -s * 0.4], [s * 0.3, s * 0.18], [0, s * 0.18]]));
  part(c, s, pal('touch.cherry'), poly(c, [[-s * 0.05, -s * 0.2], [-s * 0.3, s * 0.18], [-s * 0.05, s * 0.18]]));
  part(c, s, pal('earth.bark'), poly(c, [[-s * 0.42, s * 0.24], [s * 0.42, s * 0.24], [s * 0.28, s * 0.42], [-s * 0.28, s * 0.42]]));
});
def('kite', 'Kite', 'thing fly', (c, s) => {
  c.beginPath(); c.moveTo(0, s * 0.1); c.quadraticCurveTo(-s * 0.2, s * 0.3, -s * 0.06, s * 0.46); line(c, s, 0.03);
  part(c, s, pal('touch.cherry'), poly(c, [[0, -s * 0.44], [s * 0.3, -s * 0.06], [0, s * 0.12], [-s * 0.3, -s * 0.06]]));
  c.beginPath(); c.moveTo(0, -s * 0.44); c.lineTo(0, s * 0.12); c.moveTo(-s * 0.3, -s * 0.06); c.lineTo(s * 0.3, -s * 0.06); line(c, s, 0.03);
});
def('helicopter', 'Helicopter', 'thing fly', (c, s) => {
  c.beginPath(); c.moveTo(-s * 0.42, -s * 0.26); c.lineTo(s * 0.42, -s * 0.26); line(c, s, 0.05);
  part(c, s, pal('touch.tangerine'), rrect(c, -s * 0.22, -s * 0.22, s * 0.04, s * 0.1, s * 0.01), { shade: false });
  part(c, s, pal('touch.tangerine'), poly(c, [[s * 0.18, -s * 0.04], [s * 0.46, -s * 0.14], [s * 0.46, s * 0.0], [s * 0.18, s * 0.08]]));
  part(c, s, pal('touch.tangerine'), ell(c, -s * 0.06, s * 0.06, s * 0.3, s * 0.2));
  part(c, s, pal('sea.sunlit'), ell(c, -s * 0.18, s * 0.02, s * 0.1, s * 0.09), { shade: false });
  c.beginPath(); c.moveTo(-s * 0.3, s * 0.32); c.lineTo(s * 0.18, s * 0.32); line(c, s, 0.05);
});
def('ufo', 'Flying saucer', 'thing space', (c, s) => {
  part(c, s, pal('sea.sunlit'), () => { c.beginPath(); c.arc(0, -s * 0.04, s * 0.18, Math.PI, 0); c.closePath(); });
  part(c, s, pal('shade.light'), ell(c, 0, s * 0.06, s * 0.44, s * 0.14));
  for (const x of [-0.22, 0, 0.22]) dot(c, x * s, s * 0.07, s * 0.03, pal('touch.sunflower'));
});
def('whale', 'Whale', 'animal sea', (c, s) => {
  part(c, s, pal('touch.skyBlue'), () => { c.beginPath(); c.moveTo(-s * 0.44, s * 0.1); c.quadraticCurveTo(-s * 0.44, -s * 0.3, 0, -s * 0.28); c.quadraticCurveTo(s * 0.3, -s * 0.28, s * 0.3, 0); c.quadraticCurveTo(s * 0.4, -s * 0.2, s * 0.46, -s * 0.28); c.quadraticCurveTo(s * 0.48, -s * 0.04, s * 0.34, s * 0.14); c.quadraticCurveTo(0, s * 0.34, -s * 0.44, s * 0.1); c.closePath(); });
  eye(c, -s * 0.26, -s * 0.04, s * 0.035);
});
def('robot', 'Robot', 'thing', (c, s) => {
  c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(0, -s * 0.44); line(c, s, 0.04); dot(c, 0, -s * 0.46, s * 0.05, pal('touch.cherry'));
  part(c, s, pal('shade.light'), rrect(c, -s * 0.36, -s * 0.3, s * 0.72, s * 0.62, s * 0.12));
  for (const sx of [-1, 1]){ part(c, s, SNOW, circ(c, sx * s * 0.15, -s * 0.08, s * 0.1), { shade: false }); dot(c, sx * s * 0.15, -s * 0.08, s * 0.04, INK); }
  part(c, s, pal('touch.sunflower'), rrect(c, -s * 0.18, s * 0.12, s * 0.36, s * 0.1, s * 0.04), { shade: false });
});
def('bumblebee', 'Bee', 'animal fly', ICONS.bee[3]);
def('monkey', 'Monkey', 'animal', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('fur.brown'), circ(c, sx * s * 0.34, -s * 0.02, s * 0.12));
  part(c, s, pal('fur.brown'), circ(c, 0, 0, s * 0.34));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.1, s * 0.22, s * 0.2), { shade: false });
  eye(c, -s * 0.1, -s * 0.04, s * 0.04); eye(c, s * 0.1, -s * 0.04, s * 0.04); smile(c, s, 0, s * 0.16, s * 0.08);
});
def('unicorn', 'Unicorn', 'magic', (c, s) => {
  part(c, s, SNOW, poly(c, [[-s * 0.26, -s * 0.12], [-s * 0.2, -s * 0.34], [-s * 0.06, -s * 0.2]]));
  part(c, s, pal('touch.sunflower'), poly(c, [[-s * 0.06, -s * 0.2], [0, -s * 0.5], [s * 0.06, -s * 0.2]]));
  part(c, s, pal('touch.bubblegum'), ell(c, s * 0.3, s * 0.0, s * 0.1, s * 0.3, -0.2));
  part(c, s, SNOW, ell(c, 0, s * 0.1, s * 0.3, s * 0.3));
  eye(c, -s * 0.12, s * 0.06, s * 0.04); eye(c, s * 0.12, s * 0.06, s * 0.04); smile(c, s, 0, s * 0.22, s * 0.07);
});
def('bear', 'Bear', 'animal forest', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('fur.brown'), circ(c, sx * s * 0.26, -s * 0.24, s * 0.12));
  part(c, s, pal('fur.brown'), circ(c, 0, s * 0.02, s * 0.36));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.14, s * 0.18, s * 0.14), { shade: false });
  dot(c, 0, s * 0.1, s * 0.04, INK); eye(c, -s * 0.14, -s * 0.06, s * 0.04); eye(c, s * 0.14, -s * 0.06, s * 0.04);
});
def('superhero', 'Superhero', 'thing', (c, s) => {
  part(c, s, pal('touch.cherry'), poly(c, [[-s * 0.3, -s * 0.1], [s * 0.3, -s * 0.1], [s * 0.44, s * 0.42], [-s * 0.44, s * 0.42]]));
  part(c, s, pal('earth.peach'), circ(c, 0, -s * 0.18, s * 0.2));
  part(c, s, pal('touch.skyBlue'), rrect(c, -s * 0.2, -s * 0.26, s * 0.4, s * 0.12, s * 0.06), { shade: false });
  part(c, s, pal('ui.gold'), star5(c, s * 0.12), { w: 0.03 });
});
def('pirate', 'Pirate flag', 'thing', (c, s) => {
  c.beginPath(); c.moveTo(-s * 0.36, -s * 0.44); c.lineTo(-s * 0.36, s * 0.46); line(c, s, 0.06);
  part(c, s, pal('fur.charcoal'), poly(c, [[-s * 0.33, -s * 0.38], [s * 0.42, -s * 0.3], [s * 0.34, s * 0.1], [-s * 0.33, s * 0.02]]));
  dot(c, s * 0.04, -s * 0.2, s * 0.08, SNOW); c.fillStyle = SNOW; c.fillRect(-s * 0.02, -s * 0.16, s * 0.12, s * 0.06);
});
def('ninja', 'Ninja', 'thing', (c, s) => {
  part(c, s, pal('fur.charcoal'), circ(c, 0, 0, s * 0.38));
  part(c, s, pal('earth.peach'), rrect(c, -s * 0.3, -s * 0.14, s * 0.6, s * 0.2, s * 0.08), { shade: false });
  eye(c, -s * 0.12, -s * 0.04, s * 0.04); eye(c, s * 0.12, -s * 0.04, s * 0.04);
  part(c, s, pal('touch.cherry'), poly(c, [[s * 0.3, -s * 0.2], [s * 0.5, -s * 0.34], [s * 0.44, -s * 0.12]]));
});
def('astronaut', 'Astronaut', 'thing space', (c, s) => {
  part(c, s, SNOW, circ(c, 0, 0, s * 0.42));
  part(c, s, pal('shade.mid'), rrect(c, -s * 0.28, -s * 0.2, s * 0.56, s * 0.38, s * 0.16));
  c.save(); ell(c, -s * 0.1, -s * 0.08, s * 0.07, s * 0.04, -0.5)(); wash(c, SNOW, 0.7); c.restore();
});
def('pumpkin', 'Pumpkin', 'food', (c, s) => {
  part(c, s, pal('touch.tangerine'), ell(c, 0, s * 0.06, s * 0.42, s * 0.34));
  c.beginPath(); c.ellipse(0, s * 0.06, s * 0.16, s * 0.34, 0, 0, 7); line(c, s, 0.03);
  part(c, s, pal('meadow.deep'), rrect(c, -s * 0.04, -s * 0.38, s * 0.1, s * 0.12, s * 0.03));
});
def('snowball', 'Snowball', 'nature snow', (c, s) => { part(c, s, SNOW, circ(c, 0, 0, s * 0.4)); });
def('popcorn', 'Popcorn', 'food treat', (c, s) => {
  for (const [x, y] of [[-0.18, -0.2], [0.06, -0.28], [0.22, -0.14], [-0.04, -0.12]]) part(c, s, SNOW, circ(c, x * s, y * s, s * 0.14), { w: 0.04 });
  part(c, s, pal('touch.cherry'), poly(c, [[-s * 0.3, -s * 0.06], [s * 0.3, -s * 0.06], [s * 0.22, s * 0.44], [-s * 0.22, s * 0.44]]));
  c.fillStyle = SNOW; for (const x of [-0.12, 0.12]) c.fillRect((x - 0.04) * s, -s * 0.04, s * 0.08, s * 0.46);
});
def('jellybean', 'Jelly bean', 'food treat', (c, s) => {
  part(c, s, pal('touch.mint'), ell(c, -s * 0.1, s * 0.05, s * 0.2, s * 0.13, -0.6)); part(c, s, pal('touch.cherry'), ell(c, s * 0.12, -s * 0.08, s * 0.2, s * 0.13, 0.5)); part(c, s, pal('touch.sunflower'), ell(c, s * 0.1, s * 0.22, s * 0.2, s * 0.13, -0.2));
});
def('bubbles', 'Soap bubbles', 'effect', (c, s) => {
  for (const [x, y, r] of [[-0.12, 0.1, 0.26], [0.24, -0.2, 0.15], [0.2, 0.28, 0.1]]){ circ(c, x * s, y * s, r * s)(); wash(c, pal('sea.sunlit'), 0.35); circ(c, x * s, y * s, r * s)(); line(c, s, 0.03); circ(c, (x - r * 0.4) * s, (y - r * 0.4) * s, r * s * 0.18)(); wash(c, SNOW, 0.9); }
});
def('firework', 'Firework', 'effect party', (c, s) => {
  for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14); c.lineTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34); c.lineWidth = s * 0.1; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = s * 0.05; c.strokeStyle = pal(i % 2 ? 'touch.sunflower' : 'touch.cherry'); c.stroke(); dot(c, Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, s * 0.05, pal('touch.sunflower')); }
});
def('confetti', 'Party popper', 'party', (c, s) => {
  part(c, s, pal('touch.sunflower'), poly(c, [[-s * 0.42, s * 0.42], [-s * 0.1, -s * 0.06], [s * 0.2, s * 0.24]]));
  for (const [x, y, col] of [[0.12, -0.2, 'touch.cherry'], [0.3, -0.06, 'touch.skyBlue'], [0.18, -0.38, 'touch.mint'], [0.38, -0.3, 'touch.grape']]) part(c, s, pal(col), rrect(c, (x - 0.05) * s, (y - 0.05) * s, s * 0.1, s * 0.1, s * 0.02), { shade: false, w: 0.035 });
});
def('lightbulb', 'Light bulb', 'thing', (c, s) => {
  part(c, s, pal('ui.gold'), () => { c.beginPath(); c.arc(0, -s * 0.1, s * 0.3, 2.3, 0.84, false); c.lineTo(s * 0.12, s * 0.22); c.lineTo(-s * 0.12, s * 0.22); c.closePath(); });
  part(c, s, pal('shade.light'), rrect(c, -s * 0.12, s * 0.22, s * 0.24, s * 0.2, s * 0.04));
});
def('paintbrush', 'Paintbrush', 'thing art', (c, s) => {
  c.save(); c.rotate(0.7);
  part(c, s, pal('earth.sand'), rrect(c, -s * 0.05, -s * 0.1, s * 0.1, s * 0.56, s * 0.04));
  part(c, s, pal('shade.light'), rrect(c, -s * 0.07, -s * 0.2, s * 0.14, s * 0.12, s * 0.02), { shade: false });
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.moveTo(-s * 0.07, -s * 0.2); c.quadraticCurveTo(0, -s * 0.52, s * 0.07, -s * 0.2); c.closePath(); }); c.restore();
});
def('palette', 'Paint palette', 'thing art', (c, s) => {
  part(c, s, pal('earth.sand'), () => { c.beginPath(); c.ellipse(0, 0, s * 0.44, s * 0.36, 0, 0, 7); });
  part(c, s, pal('sky.horizon'), circ(c, s * 0.16, s * 0.12, s * 0.07), { shade: false, w: 0.03 });
  for (const [x, y, col] of [[-0.2, -0.1, 'touch.cherry'], [0, -0.2, 'touch.sunflower'], [0.2, -0.1, 'touch.skyBlue'], [-0.24, 0.1, 'touch.mint']]) dot(c, x * s, y * s, s * 0.07, pal(col));
});
def('gamepad', 'Game', 'thing', (c, s) => {
  part(c, s, pal('touch.grape'), rrect(c, -s * 0.46, -s * 0.24, s * 0.92, s * 0.52, s * 0.22));
  c.fillStyle = SNOW; c.fillRect(-s * 0.32, -s * 0.03, s * 0.2, s * 0.06); c.fillRect(-s * 0.25, -s * 0.1, s * 0.06, s * 0.2);
  dot(c, s * 0.18, -s * 0.02, s * 0.05, pal('touch.sunflower')); dot(c, s * 0.3, s * 0.06, s * 0.05, pal('touch.mint'));
});
def('compass', 'Compass', 'thing', (c, s) => {
  part(c, s, SNOW, circ(c, 0, 0, s * 0.4));
  part(c, s, pal('touch.cherry'), poly(c, [[s * 0.16, -s * 0.16], [s * 0.04, s * 0.04], [-s * 0.04, -s * 0.04]]), { w: 0.03 });
  part(c, s, pal('touch.skyBlue'), poly(c, [[-s * 0.16, s * 0.16], [-s * 0.04, -s * 0.04], [s * 0.04, s * 0.04]]), { w: 0.03 });
});
def('clock', 'Clock', 'thing', (c, s) => {
  part(c, s, SNOW, circ(c, 0, 0, s * 0.4));
  c.beginPath(); c.moveTo(0, -s * 0.24); c.lineTo(0, 0); c.lineTo(s * 0.16, s * 0.08); line(c, s, 0.06);
});
def('pencil', 'Pencil', 'thing', (c, s) => {
  c.save(); c.rotate(0.78);
  part(c, s, pal('touch.sunflower'), rrect(c, -s * 0.09, -s * 0.34, s * 0.18, s * 0.56, s * 0.02));
  part(c, s, pal('touch.bubblegum'), rrect(c, -s * 0.09, -s * 0.44, s * 0.18, s * 0.1, s * 0.03), { shade: false });
  part(c, s, pal('earth.peach'), poly(c, [[-s * 0.09, s * 0.22], [s * 0.09, s * 0.22], [0, s * 0.42]]), { shade: false }); c.restore();
});
def('chain', 'Link', 'thing', (c, s) => {
  c.save(); c.rotate(-0.7); for (const x of [-0.14, 0.14]){ c.beginPath(); c.roundRect((x - 0.2) * s, -s * 0.12, s * 0.4, s * 0.24, s * 0.12); c.lineWidth = s * 0.12; c.strokeStyle = INK; c.stroke(); c.lineWidth = s * 0.06; c.strokeStyle = pal('touch.skyBlue'); c.stroke(); } c.restore();
});
def('key', 'Key', 'thing', (c, s) => {
  c.save(); c.rotate(-0.7); part(c, s, pal('ui.gold'), rrect(c, -s * 0.06, -s * 0.12, s * 0.5, s * 0.1, s * 0.03)); part(c, s, pal('ui.gold'), rrect(c, s * 0.26, -s * 0.02, s * 0.08, s * 0.14, s * 0.02), { shade: false });
  part(c, s, pal('ui.gold'), circ(c, -s * 0.18, -s * 0.07, s * 0.17)); circ(c, -s * 0.18, -s * 0.07, s * 0.06)(); wash(c, pal('shade.card'), 1); c.restore();
});
def('wrench', 'Wrench', 'thing', (c, s) => {
  c.save(); c.rotate(0.78);
  part(c, s, pal('shade.light'), rrect(c, -s * 0.06, -s * 0.18, s * 0.12, s * 0.6, s * 0.05));
  part(c, s, pal('shade.light'), () => { c.beginPath(); c.arc(0, -s * 0.26, s * 0.18, 0, 7); }); part(c, s, pal('shade.card'), poly(c, [[-s * 0.07, -s * 0.46], [s * 0.07, -s * 0.46], [s * 0.04, -s * 0.28], [-s * 0.04, -s * 0.28]]), { shade: false, w: 0.03 }); c.restore();
});
def('tv', 'TV', 'thing', (c, s) => {
  part(c, s, pal('shade.mid'), rrect(c, -s * 0.44, -s * 0.34, s * 0.88, s * 0.62, s * 0.08));
  part(c, s, pal('sea.sunlit'), rrect(c, -s * 0.36, -s * 0.26, s * 0.72, s * 0.46, s * 0.04), { shade: false, w: 0.03 });
  part(c, s, pal('shade.mid'), rrect(c, -s * 0.18, s * 0.28, s * 0.36, s * 0.08, s * 0.02), { shade: false });
});
def('warning', 'Careful', 'thing', (c, s) => {
  part(c, s, pal('touch.sunflower'), poly(c, [[0, -s * 0.42], [s * 0.44, s * 0.34], [-s * 0.44, s * 0.34]]));
  c.fillStyle = INK; c.fillRect(-s * 0.035, -s * 0.16, s * 0.07, s * 0.26); dot(c, 0, s * 0.2, s * 0.04, INK);
});
def('sign', 'Sign', 'thing', (c, s) => {
  c.fillStyle = INK; c.fillRect(-s * 0.04, s * 0.1, s * 0.08, s * 0.36);
  part(c, s, pal('touch.sunflower'), poly(c, [[0, -s * 0.44], [s * 0.4, 0], [0, s * 0.22], [-s * 0.4, 0]]));
});
def('crane', 'Crane', 'thing', (c, s) => {
  part(c, s, pal('touch.sunflower'), rrect(c, -s * 0.4, s * 0.1, s * 0.5, s * 0.3, s * 0.04));
  c.beginPath(); c.moveTo(-s * 0.2, s * 0.1); c.lineTo(s * 0.3, -s * 0.4); c.lineTo(s * 0.4, -s * 0.3); c.moveTo(s * 0.4, -s * 0.3); c.lineTo(s * 0.4, 0); line(c, s, 0.07); part(c, s, pal('touch.cherry'), rrect(c, s * 0.3, 0, s * 0.2, s * 0.14, s * 0.02));
});
def('tag', 'Name tag', 'thing', (c, s) => {
  part(c, s, pal('touch.skyBlue'), poly(c, [[-s * 0.4, -s * 0.2], [s * 0.1, -s * 0.2], [s * 0.42, 0], [s * 0.1, s * 0.2], [-s * 0.4, s * 0.2]])); dot(c, -s * 0.26, 0, s * 0.05, SNOW);
});
def('speech', 'Words', 'thing', (c, s) => {
  part(c, s, SNOW, () => { c.beginPath(); c.roundRect(-s * 0.42, -s * 0.34, s * 0.84, s * 0.56, s * 0.2); c.moveTo(-s * 0.16, s * 0.2); c.lineTo(-s * 0.26, s * 0.42); c.lineTo(s * 0.04, s * 0.2); });
  for (const x of [-0.2, 0, 0.2]) dot(c, x * s, -s * 0.06, s * 0.05, INK);
});
def('pointer', 'Aim', 'thing', (c, s) => {
  part(c, s, SNOW, circ(c, 0, 0, s * 0.38)); part(c, s, pal('touch.cherry'), circ(c, 0, 0, s * 0.24)); part(c, s, SNOW, circ(c, 0, 0, s * 0.12), { shade: false }); dot(c, 0, 0, s * 0.05, pal('touch.cherry'));
});
def('acrobat', 'Acrobat', 'thing', (c, s) => {
  part(c, s, pal('touch.skyBlue'), circ(c, 0, -s * 0.28, s * 0.14)); c.beginPath(); c.moveTo(0, -s * 0.14); c.lineTo(0, s * 0.12); c.moveTo(-s * 0.3, -s * 0.34); c.lineTo(0, -s * 0.06); c.lineTo(s * 0.3, -s * 0.34); c.moveTo(0, s * 0.12); c.lineTo(-s * 0.16, s * 0.42); c.moveTo(0, s * 0.12); c.lineTo(s * 0.16, s * 0.42); c.lineWidth = s * 0.14; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = s * 0.08; c.strokeStyle = pal('touch.skyBlue'); c.stroke();
});
def('sleep', 'Sleepy', 'thing', (c, s) => {
  part(c, s, pal('touch.skyBlue'), circ(c, 0, s * 0.1, s * 0.32)); c.beginPath(); c.arc(-s * 0.12, s * 0.08, s * 0.06, 0.2, Math.PI - 0.2); c.arc(s * 0.12, s * 0.08, s * 0.06, 0.2, Math.PI - 0.2); line(c, s, 0.035);
  c.fillStyle = INK; c.font = `800 ${Math.round(s * 0.3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', s * 0.28, -s * 0.26);
});
def('heartfull', 'Heart', 'thing love', (c, s) => {
  part(c, s, pal('touch.bubblegum'), () => { const k = s / 2.2; c.beginPath(); c.moveTo(0, k * 0.9); c.bezierCurveTo(-k * 1.7, -k * 0.2, -k * 0.7, -k * 1.3, 0, -k * 0.5); c.bezierCurveTo(k * 0.7, -k * 1.3, k * 1.7, -k * 0.2, 0, k * 0.9); c.closePath(); });
});
def('butterfly', 'Butterfly', 'animal fly garden', (c, s) => {
  for (const sx of [-1, 1]){ part(c, s, pal('touch.grape'), ell(c, sx * s * 0.2, -s * 0.12, s * 0.2, s * 0.26, sx * 0.5)); part(c, s, pal('touch.bubblegum'), ell(c, sx * s * 0.16, s * 0.18, s * 0.14, s * 0.16, -sx * 0.4)); dot(c, sx * s * 0.22, -s * 0.14, s * 0.05, SNOW); }
  part(c, s, pal('fur.charcoal'), ell(c, 0, s * 0.02, s * 0.05, s * 0.3));
  c.beginPath(); c.moveTo(-s * 0.02, -s * 0.26); c.quadraticCurveTo(-s * 0.1, -s * 0.42, -s * 0.16, -s * 0.4); c.moveTo(s * 0.02, -s * 0.26); c.quadraticCurveTo(s * 0.1, -s * 0.42, s * 0.16, -s * 0.4); line(c, s, 0.03);
});
def('house', 'House', 'place', (c, s) => {
  part(c, s, pal('earth.sand'), rrect(c, -s * 0.34, -s * 0.04, s * 0.68, s * 0.46, s * 0.03));
  part(c, s, pal('earth.brick'), poly(c, [[-s * 0.44, -s * 0.02], [0, -s * 0.42], [s * 0.44, -s * 0.02]]));
  part(c, s, pal('earth.bark'), rrect(c, -s * 0.07, s * 0.2, s * 0.14, s * 0.22, s * 0.02), { shade: false });
  part(c, s, pal('sea.sunlit'), rrect(c, s * 0.14, s * 0.08, s * 0.14, s * 0.12, s * 0.02), { shade: false, w: 0.03 });
});
