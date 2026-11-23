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
  /* a crescent: the full moon with a bite out of its upper right, drawn as two clipped passes so the ink edge follows the crescent only */
  const R = s * 0.4, bx = s * 0.2, by = -s * 0.12, br = s * 0.34;
  c.save(); c.beginPath(); c.rect(-s, -s, 2 * s, 2 * s); c.arc(bx, by, br, 0, 7); c.clip('evenodd');
  c.beginPath(); c.arc(0, 0, R, 0, 7); c.fillStyle = pal('touch.sunflower'); c.fill();
  c.save(); c.clip(); c.beginPath(); c.arc(-R * 0.5, R * 0.55, R * 1.1, 0, 7); wash(c, SHADOW, 0.14); c.restore();
  c.beginPath(); c.arc(0, 0, R, 0, 7); line(c, s, 0.05); c.restore();
  c.save(); c.beginPath(); c.arc(0, 0, R, 0, 7); c.clip(); c.beginPath(); c.arc(bx, by, br, 0, 7); line(c, s, 0.05); c.restore();
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
def('player', 'Player', 'person people', (c, s) => {
  part(c, s, SNOW, () => { c.beginPath(); c.moveTo(-s * 0.36, s * 0.42); c.quadraticCurveTo(-s * 0.36, s * 0.06, 0, s * 0.06); c.quadraticCurveTo(s * 0.36, s * 0.06, s * 0.36, s * 0.42); c.closePath(); });
  part(c, s, SNOW, circ(c, 0, -s * 0.22, s * 0.2));
});

/* ---------- how you play (decisions 0052, 0054): the people and the Orlis PlayPad ----------
   Two flat, one-colour icons translated from the approved SVG drawings in docs/icon-mockups.html (symbols p1 and t3), drawn with Path2D into the
   icon box. The colour is o.tint (a palette colour, default the ink); the "lighter" parts are the same colour at 55% opacity, and the PlayPad's
   screen is a real hole (even-odd), so whatever is behind shows through. */
/* ---------- the rest of the old emoji pieces, painted (decision 0041): animals, food, nature, things ---------- */
const stroke2 = (c, s, col, w, draw) => { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = s * (w + 0.07); draw(); c.stroke(); c.strokeStyle = col; c.lineWidth = s * w; draw(); c.stroke(); };
const rays = (c, s, x, y, r0, r1, n, w = 0.03, a0 = 0) => { c.lineWidth = s * w; c.strokeStyle = INK; c.lineCap = 'round'; for (let i = 0; i < n; i++){ const a = a0 + i * Math.PI * 2 / n; c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke(); } };
const cheeks = (c, s, y, dx) => { c.save(); for (const sx of [-1, 1]){ ell(c, sx * s * dx, y * s, s * 0.05, s * 0.03)(); wash(c, pal('touch.bubblegum'), 0.45); } c.restore(); };
const whisk = (c, s, x, y, len = 0.18) => { c.lineWidth = s * 0.02; c.strokeStyle = INK; c.lineCap = 'round'; for (const sx of [-1, 1]) for (const d of [-0.03, 0.04]){ c.beginPath(); c.moveTo(sx * x * s, y * s + d * s); c.lineTo(sx * (x + len) * s, y * s + d * s * 3); c.stroke(); } };
const pink = pal('touch.bubblegum', 'light');

/* animals */
def('turtle', 'Turtle', 'animal slow', (c, s) => {
  const g = pal('meadow.grass');
  for (const x of [-0.26, 0.16]) part(c, s, g, ell(c, x * s, s * 0.28, s * 0.1, s * 0.09));
  part(c, s, g, ell(c, s * 0.38, s * 0.04, s * 0.14, s * 0.13));
  part(c, s, pal('meadow.deep'), () => { c.beginPath(); c.arc(-s * 0.04, s * 0.24, s * 0.38, Math.PI, 0); c.closePath(); });
  c.beginPath(); c.moveTo(-s * 0.04, -s * 0.14); c.lineTo(-s * 0.04, s * 0.24); c.moveTo(-s * 0.3, s * 0.02); c.lineTo(s * 0.22, s * 0.02); line(c, s, 0.035);
  eye(c, s * 0.42, s * 0.0, s * 0.035);
});
def('duck', 'Duck', 'animal pond', (c, s) => {
  part(c, s, pal('touch.sunflower'), poly(c, [[-s * 0.3, s * 0.0], [-s * 0.48, -s * 0.12], [-s * 0.36, s * 0.14]]));
  part(c, s, pal('touch.sunflower'), ell(c, -s * 0.04, s * 0.2, s * 0.38, s * 0.26));
  part(c, s, pal('touch.sunflower', 'shade'), ell(c, -s * 0.12, s * 0.2, s * 0.16, s * 0.1, 0.3), { shade: false });
  part(c, s, pal('touch.sunflower'), circ(c, s * 0.16, -s * 0.22, s * 0.2));
  part(c, s, pal('touch.tangerine'), ell(c, s * 0.38, -s * 0.18, s * 0.12, s * 0.06, 0.15));
  eye(c, s * 0.2, -s * 0.28, s * 0.04);
});
def('lion', 'Lion', 'animal', (c, s) => {
  part(c, s, pal('earth.clay'), circ(c, 0, 0, s * 0.45));
  for (let i = 0; i < 10; i++){ const a = i * Math.PI / 5; part(c, s, pal('earth.clay'), circ(c, Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, s * 0.09), { shade: false, w: 0.035 }); }
  part(c, s, pal('earth.clay'), circ(c, 0, 0, s * 0.42), { w: 0.0001 });
  for (const sx of [-1, 1]) part(c, s, pal('touch.sunflower'), circ(c, sx * s * 0.2, -s * 0.24, s * 0.08), { shade: false });
  part(c, s, pal('touch.sunflower'), circ(c, 0, s * 0.02, s * 0.3));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.14, s * 0.15, s * 0.11), { shade: false });
  eye(c, -s * 0.12, -s * 0.08, s * 0.04); eye(c, s * 0.12, -s * 0.08, s * 0.04);
  dot(c, 0, s * 0.08, s * 0.035, INK); smile(c, s, 0, s * 0.19, s * 0.06);
});
def('panda', 'Panda', 'animal', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('fur.charcoal'), circ(c, sx * s * 0.28, -s * 0.28, s * 0.13));
  part(c, s, SNOW, circ(c, 0, s * 0.04, s * 0.38));
  for (const sx of [-1, 1]){ part(c, s, pal('fur.charcoal'), ell(c, sx * s * 0.15, -s * 0.02, s * 0.09, s * 0.12, sx * 0.4), { shade: false }); dot(c, sx * s * 0.14, -s * 0.03, s * 0.035, SNOW); dot(c, sx * s * 0.14, -s * 0.03, s * 0.018, INK); }
  part(c, s, pal('fur.charcoal'), ell(c, 0, s * 0.1, s * 0.05, s * 0.035), { shade: false }); smile(c, s, 0, s * 0.15, s * 0.07);
});
def('fox', 'Fox', 'animal forest', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('touch.tangerine'), poly(c, [[sx * s * 0.38, -s * 0.06], [sx * s * 0.3, -s * 0.44], [sx * s * 0.08, -s * 0.2]]));
  part(c, s, pal('touch.tangerine'), ell(c, 0, s * 0.0, s * 0.4, s * 0.3));
  part(c, s, SNOW, poly(c, [[-s * 0.38, s * 0.06], [-s * 0.1, s * 0.14], [0, s * 0.42], [s * 0.1, s * 0.14], [s * 0.38, s * 0.06], [s * 0.3, s * 0.26], [0, s * 0.44], [-s * 0.3, s * 0.26]]), { shade: false });
  dot(c, 0, s * 0.4, s * 0.045, INK);
  eye(c, -s * 0.16, -s * 0.06, s * 0.04); eye(c, s * 0.16, -s * 0.06, s * 0.04);
});
def('pig', 'Pig', 'animal farm', (c, s) => {
  const p = pal('touch.bubblegum', 'light');
  for (const sx of [-1, 1]) part(c, s, pal('touch.bubblegum'), poly(c, [[sx * s * 0.36, -s * 0.12], [sx * s * 0.32, -s * 0.4], [sx * s * 0.1, -s * 0.28]]));
  part(c, s, p, circ(c, 0, s * 0.04, s * 0.4));
  part(c, s, pal('touch.bubblegum'), ell(c, 0, s * 0.14, s * 0.18, s * 0.13), { shade: false });
  dot(c, -s * 0.06, s * 0.14, s * 0.025, INK); dot(c, s * 0.06, s * 0.14, s * 0.025, INK);
  eye(c, -s * 0.18, -s * 0.08, s * 0.04); eye(c, s * 0.18, -s * 0.08, s * 0.04);
});
def('sheep', 'Sheep', 'animal farm', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('fur.charcoal'), ell(c, sx * s * 0.3, s * 0.0, s * 0.12, s * 0.06, sx * 0.4));
  for (const [x, y, r] of [[-0.26, -0.18, 0.18], [0.0, -0.28, 0.2], [0.26, -0.18, 0.18], [-0.3, 0.08, 0.17], [0.3, 0.08, 0.17], [0, -0.04, 0.3]]) part(c, s, SNOW, circ(c, x * s, y * s, r * s), { w: 0.04 });
  part(c, s, pal('fur.charcoal'), ell(c, 0, s * 0.14, s * 0.19, s * 0.25));
  eye(c, -s * 0.08, s * 0.08, s * 0.035); eye(c, s * 0.08, s * 0.08, s * 0.035);
});
def('cow', 'Cow', 'animal farm', (c, s) => {
  for (const sx of [-1, 1]){ part(c, s, pal('earth.sand'), poly(c, [[sx * s * 0.18, -s * 0.2], [sx * s * 0.24, -s * 0.42], [sx * s * 0.34, -s * 0.2]])); part(c, s, SNOW, ell(c, sx * s * 0.4, -s * 0.06, s * 0.13, s * 0.07, sx * 0.4)); }
  part(c, s, SNOW, ell(c, 0, s * 0.0, s * 0.3, s * 0.36));
  c.save(); ell(c, 0, 0, s * 0.3, s * 0.36)(); c.clip(); ell(c, -s * 0.24, -s * 0.2, s * 0.14, s * 0.14)(); c.fillStyle = pal('fur.charcoal'); c.fill(); c.restore();
  part(c, s, pal('touch.bubblegum', 'light'), ell(c, 0, s * 0.22, s * 0.22, s * 0.14), { shade: false });
  dot(c, -s * 0.07, s * 0.22, s * 0.025, INK); dot(c, s * 0.07, s * 0.22, s * 0.025, INK);
  eye(c, -s * 0.12, -s * 0.1, s * 0.04); eye(c, s * 0.12, -s * 0.1, s * 0.04);
});
def('horse', 'Horse', 'animal farm', (c, s) => {
  for (const sx of [-1, 1]) part(c, s, pal('fur.brown'), poly(c, [[sx * s * 0.22, -s * 0.2], [sx * s * 0.2, -s * 0.46], [sx * s * 0.06, -s * 0.28]]));
  part(c, s, pal('fur.charcoal'), ell(c, 0, -s * 0.2, s * 0.1, s * 0.1));
  part(c, s, pal('fur.brown'), ell(c, 0, s * 0.04, s * 0.27, s * 0.4));
  part(c, s, pal('fur.charcoal'), poly(c, [[-s * 0.08, -s * 0.3], [s * 0.08, -s * 0.3], [0, -s * 0.08]]), { shade: false });
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.28, s * 0.17, s * 0.13), { shade: false });
  dot(c, -s * 0.06, s * 0.28, s * 0.022, INK); dot(c, s * 0.06, s * 0.28, s * 0.022, INK);
  eye(c, -s * 0.13, -s * 0.02, s * 0.04); eye(c, s * 0.13, -s * 0.02, s * 0.04);
});
def('mouse', 'Mouse', 'animal small', (c, s) => {
  const g = pal('shade.light');
  for (const sx of [-1, 1]){ part(c, s, g, circ(c, sx * s * 0.28, -s * 0.18, s * 0.17)); dot(c, sx * s * 0.28, -s * 0.18, s * 0.09, pink); }
  part(c, s, g, ell(c, 0, s * 0.08, s * 0.36, s * 0.32));
  eye(c, -s * 0.13, s * 0.0, s * 0.04); eye(c, s * 0.13, s * 0.0, s * 0.04);
  dot(c, 0, s * 0.16, s * 0.04, pal('touch.bubblegum')); whisk(c, s, 0.1, 0.18, 0.28); cheeks(c, s, 0.1, 0.24);
});
def('hedgehog', 'Hedgehog', 'animal forest small', (c, s) => {
  const spines = []; for (let i = 0; i <= 14; i++){ const a = Math.PI + i * Math.PI / 14 - 0.1; spines.push([Math.cos(a) * s * (i % 2 ? 0.34 : 0.48), s * 0.2 + Math.sin(a) * s * (i % 2 ? 0.34 : 0.54)]); }
  part(c, s, pal('earth.bark'), poly(c, [...spines, [s * 0.44, s * 0.3], [-s * 0.4, s * 0.3]]));
  part(c, s, pal('earth.sand'), ell(c, s * 0.14, s * 0.14, s * 0.26, s * 0.2), { shade: false });
  dot(c, s * 0.38, s * 0.14, s * 0.035, INK); eye(c, s * 0.12, s * 0.06, s * 0.04);
  for (const x of [-0.2, 0.08]) part(c, s, pal('earth.sand'), ell(c, x * s, s * 0.36, s * 0.09, s * 0.05), { shade: false });
});
def('ladybug', 'Ladybug', 'animal garden small', (c, s) => {
  c.lineWidth = s * 0.035; c.strokeStyle = INK; c.lineCap = 'round'; for (const sx of [-1, 1]){ c.beginPath(); c.moveTo(sx * s * 0.08, -s * 0.38); c.quadraticCurveTo(sx * s * 0.14, -s * 0.5, sx * s * 0.22, -s * 0.48); c.stroke(); }
  part(c, s, INK, ell(c, 0, -s * 0.28, s * 0.17, s * 0.12), { shade: false });
  part(c, s, pal('touch.cherry'), ell(c, 0, s * 0.08, s * 0.4, s * 0.4));
  c.beginPath(); c.moveTo(0, -s * 0.28); c.lineTo(0, s * 0.48); line(c, s, 0.04);
  for (const [x, y] of [[-0.2, -0.04], [0.2, -0.04], [-0.22, 0.22], [0.22, 0.22]]) dot(c, x * s, y * s, s * 0.07, INK);
});
def('snail', 'Snail', 'animal slow garden', (c, s) => {
  for (const x of [0.28, 0.38]){ c.beginPath(); c.moveTo(x * s, -s * 0.04); c.lineTo((x + 0.04) * s, -s * 0.3); line(c, s, 0.035); dot(c, (x + 0.04) * s, -s * 0.31, s * 0.04, INK); }
  part(c, s, pal('earth.sand'), () => { c.beginPath(); c.moveTo(-s * 0.46, s * 0.36); c.lineTo(s * 0.34, s * 0.36); c.quadraticCurveTo(s * 0.48, s * 0.36, s * 0.46, s * 0.14); c.quadraticCurveTo(s * 0.4, -s * 0.02, s * 0.3, s * 0.0); c.lineTo(s * 0.1, s * 0.2); c.lineTo(-s * 0.46, s * 0.2); c.closePath(); });
  part(c, s, pal('touch.tangerine'), circ(c, -s * 0.1, -s * 0.02, s * 0.3));
  c.beginPath(); c.moveTo(-s * 0.1, -s * 0.02); c.arc(-s * 0.1, -s * 0.02, s * 0.06, 0, 4.5); c.arc(-s * 0.1, -s * 0.02, s * 0.16, 4.5, 0.4, true); line(c, s, 0.035);
  c.beginPath(); c.arc(-s * 0.1, -s * 0.02, s * 0.2, 3.4, 6.1); line(c, s, 0.035);
});
def('crab', 'Crab', 'animal sea', (c, s) => {
  for (const sx of [-1, 1]){ c.beginPath(); c.moveTo(sx * s * 0.2, s * 0.2); c.lineTo(sx * s * 0.44, s * 0.36); c.moveTo(sx * s * 0.14, s * 0.26); c.lineTo(sx * s * 0.34, s * 0.44); line(c, s, 0.05); }
  for (const sx of [-1, 1]){ c.beginPath(); c.moveTo(sx * s * 0.3, -s * 0.04); c.lineTo(sx * s * 0.4, -s * 0.2); line(c, s, 0.05); part(c, s, pal('touch.cherry'), poly(c, [[sx * s * 0.3, -s * 0.22], [sx * s * 0.5, -s * 0.46], [sx * s * 0.46, -s * 0.12]])); part(c, s, pal('touch.cherry'), circ(c, sx * s * 0.36, -s * 0.2, s * 0.1)); }
  part(c, s, pal('touch.cherry'), ell(c, 0, s * 0.12, s * 0.34, s * 0.24));
  for (const sx of [-1, 1]){ c.beginPath(); c.moveTo(sx * s * 0.1, s * 0.0); c.lineTo(sx * s * 0.1, -s * 0.12); line(c, s, 0.035); eye(c, sx * s * 0.1, -s * 0.14, s * 0.055); }
  smile(c, s, 0, s * 0.14, s * 0.08);
});
def('octopus', 'Octopus', 'animal sea', (c, s) => {
  for (const x of [-0.3, -0.1, 0.1, 0.3]) part(c, s, pal('touch.grape'), ell(c, x * s, s * 0.32, s * 0.08, s * 0.16, x * -0.6));
  part(c, s, pal('touch.grape'), ell(c, 0, -s * 0.08, s * 0.36, s * 0.36));
  eye(c, -s * 0.13, -s * 0.06, s * 0.06); eye(c, s * 0.13, -s * 0.06, s * 0.06); smile(c, s, 0, s * 0.08, s * 0.08);
  cheeks(c, s, 0.06, 0.24);
});
def('dolphin', 'Dolphin', 'animal sea', (c, s) => {
  const b = pal('touch.skyBlue');
  part(c, s, b, poly(c, [[-s * 0.36, s * 0.04], [-s * 0.48, -s * 0.22], [-s * 0.26, -s * 0.06], [-s * 0.18, -s * 0.2]]));
  part(c, s, b, ell(c, -s * 0.02, s * 0.06, s * 0.4, s * 0.24, -0.35));
  part(c, s, b, ell(c, s * 0.42, -s * 0.18, s * 0.12, s * 0.05, -0.35));
  part(c, s, pal('touch.skyBlue', 'light'), ell(c, s * 0.04, s * 0.18, s * 0.28, s * 0.1, -0.35), { shade: false });
  part(c, s, b, poly(c, [[-s * 0.06, -s * 0.12], [s * 0.04, -s * 0.34], [s * 0.12, -s * 0.06]]));
  eye(c, s * 0.2, -s * 0.12, s * 0.035);
});
def('koala', 'Koala', 'animal', (c, s) => {
  const g = pal('shade.light');
  for (const sx of [-1, 1]){ part(c, s, g, circ(c, sx * s * 0.34, -s * 0.18, s * 0.17)); dot(c, sx * s * 0.34, -s * 0.18, s * 0.09, SNOW); }
  part(c, s, g, circ(c, 0, s * 0.04, s * 0.36));
  part(c, s, INK, ell(c, 0, s * 0.06, s * 0.08, s * 0.12), { shade: false }); dot(c, -s * 0.025, s * 0.02, s * 0.02, SNOW);
  eye(c, -s * 0.16, -s * 0.04, s * 0.04); eye(c, s * 0.16, -s * 0.04, s * 0.04);
});
def('kangaroo', 'Kangaroo', 'animal hop', (c, s) => {
  const f = pal('earth.clay');
  part(c, s, f, poly(c, [[-s * 0.1, s * 0.3], [-s * 0.5, s * 0.46], [-s * 0.2, s * 0.14]]));
  part(c, s, f, ell(c, 0, s * 0.18, s * 0.26, s * 0.3));
  part(c, s, pal('earth.sand'), ell(c, s * 0.04, s * 0.26, s * 0.14, s * 0.14), { shade: false });
  for (const sx of [-1, 1]) part(c, s, f, ell(c, sx * s * 0.1 + s * 0.02, -s * 0.3, s * 0.06, s * 0.14, sx * 0.2));
  part(c, s, f, ell(c, s * 0.04, -s * 0.08, s * 0.17, s * 0.15));
  part(c, s, pal('earth.sand'), ell(c, s * 0.04, -s * 0.02, s * 0.1, s * 0.08), { shade: false });
  dot(c, s * 0.04, -s * 0.05, s * 0.025, INK); eye(c, -s * 0.04, -s * 0.12, s * 0.03); eye(c, s * 0.12, -s * 0.12, s * 0.03);
});
def('flamingo', 'Flamingo', 'animal', (c, s) => {
  const p = pal('touch.bubblegum');
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(-s * 0.04, s * 0.2); c.lineTo(-s * 0.04, s * 0.46); c.moveTo(s * 0.1, s * 0.2); c.lineTo(s * 0.14, s * 0.34); c.lineTo(s * 0.04, s * 0.4); c.stroke();
  stroke2(c, s, p, 0.1, () => { c.beginPath(); c.moveTo(s * 0.12, s * 0.04); c.bezierCurveTo(s * 0.4, -s * 0.06, s * 0.36, -s * 0.36, s * 0.12, -s * 0.34); });
  part(c, s, p, ell(c, -s * 0.04, s * 0.1, s * 0.3, s * 0.18, -0.2));
  part(c, s, p, circ(c, s * 0.1, -s * 0.34, s * 0.09));
  part(c, s, INK, poly(c, [[s * 0.03, -s * 0.37], [-s * 0.1, -s * 0.28], [s * 0.04, -s * 0.28]]), { shade: false });
  dot(c, s * 0.12, -s * 0.36, s * 0.018, INK);
});
def('parrot', 'Parrot', 'animal fly', (c, s) => {
  part(c, s, pal('touch.skyBlue'), poly(c, [[-s * 0.14, s * 0.2], [-s * 0.34, s * 0.5], [-s * 0.02, s * 0.46], [s * 0.1, s * 0.22]]));
  part(c, s, pal('touch.cherry'), ell(c, 0, s * 0.06, s * 0.28, s * 0.36));
  part(c, s, pal('touch.mint'), ell(c, -s * 0.14, s * 0.12, s * 0.1, s * 0.22, 0.2));
  part(c, s, pal('touch.cherry'), circ(c, s * 0.02, -s * 0.2, s * 0.2));
  part(c, s, pal('touch.sunflower'), poly(c, [[s * 0.1, -s * 0.28], [s * 0.34, -s * 0.2], [s * 0.2, -s * 0.06], [s * 0.1, -s * 0.12]]));
  eye(c, s * 0.0, -s * 0.24, s * 0.045);
});
def('swan', 'Swan', 'animal pond', (c, s) => {
  part(c, s, SNOW, () => { c.beginPath(); c.moveTo(-s * 0.46, s * 0.1); c.quadraticCurveTo(-s * 0.3, s * 0.0, -s * 0.2, -s * 0.1); c.quadraticCurveTo(s * 0.0, s * 0.14, s * 0.36, s * 0.02); c.quadraticCurveTo(s * 0.34, s * 0.4, -s * 0.06, s * 0.4); c.quadraticCurveTo(-s * 0.4, s * 0.4, -s * 0.46, s * 0.1); c.closePath(); });
  stroke2(c, s, SNOW, 0.12, () => { c.beginPath(); c.moveTo(s * 0.26, s * 0.06); c.bezierCurveTo(s * 0.46, -s * 0.1, s * 0.4, -s * 0.3, s * 0.22, -s * 0.34); });
  part(c, s, SNOW, circ(c, s * 0.2, -s * 0.34, s * 0.09));
  part(c, s, pal('touch.tangerine'), poly(c, [[s * 0.26, -s * 0.38], [s * 0.44, -s * 0.33], [s * 0.26, -s * 0.29]]), { shade: false });
  dot(c, s * 0.2, -s * 0.36, s * 0.018, INK);
});
def('seal', 'Seal', 'animal sea', (c, s) => {
  const g = pal('space.rock');
  part(c, s, g, poly(c, [[-s * 0.34, s * 0.26], [-s * 0.5, s * 0.46], [-s * 0.24, s * 0.4]]));
  part(c, s, g, ell(c, -s * 0.06, s * 0.14, s * 0.34, s * 0.3, -0.5));
  part(c, s, g, circ(c, s * 0.16, -s * 0.16, s * 0.2));
  part(c, s, pal('space.dust'), ell(c, s * 0.2, -s * 0.1, s * 0.12, s * 0.08), { shade: false });
  dot(c, s * 0.24, -s * 0.14, s * 0.03, INK); eye(c, s * 0.08, -s * 0.22, s * 0.035); eye(c, s * 0.24, -s * 0.22, s * 0.035);
  whisk(c, s, -0.2, -0.1, 0.0);
});

/* food */
def('banana', 'Banana', 'food fruit', (c, s) => {
  stroke2(c, s, pal('touch.sunflower'), 0.2, () => { c.beginPath(); c.arc(0, -s * 0.12, s * 0.4, Math.PI * 0.12, Math.PI * 0.88); });
  dot(c, -s * 0.37, s * 0.08, s * 0.045, pal('earth.bark')); dot(c, s * 0.37, s * 0.08, s * 0.045, pal('earth.bark'));
  c.beginPath(); c.arc(0, -s * 0.12, s * 0.34, Math.PI * 0.2, Math.PI * 0.8); c.strokeStyle = pal('touch.sunflower', 'light'); c.lineWidth = s * 0.04; c.stroke();
});
def('orange', 'Orange', 'food fruit', (c, s) => {
  part(c, s, pal('touch.tangerine'), circ(c, 0, s * 0.08, s * 0.38));
  c.save(); ell(c, -s * 0.14, -s * 0.04, s * 0.09, s * 0.06, -0.6)(); wash(c, SNOW, 0.5); c.restore();
  part(c, s, pal('meadow.fresh'), ell(c, s * 0.14, -s * 0.34, s * 0.14, s * 0.06, -0.4));
  c.beginPath(); c.moveTo(0, -s * 0.28); c.lineTo(0, -s * 0.38); line(c, s, 0.05);
});
def('grapes', 'Grapes', 'food fruit', (c, s) => {
  part(c, s, pal('meadow.fresh'), ell(c, s * 0.18, -s * 0.34, s * 0.15, s * 0.06, -0.4));
  c.beginPath(); c.moveTo(0, -s * 0.2); c.lineTo(s * 0.02, -s * 0.38); line(c, s, 0.05);
  for (const [x, y] of [[-0.24, -0.08], [0, -0.08], [0.24, -0.08], [-0.12, 0.12], [0.12, 0.12], [0, 0.32]]) part(c, s, pal('touch.grape'), circ(c, x * s, y * s, s * 0.13));
  c.save(); c.fillStyle = SNOW; c.globalAlpha *= 0.55; for (const [x, y] of [[-0.28, -0.12], [-0.04, -0.12], [0.2, -0.12], [-0.16, 0.08], [0.08, 0.08], [-0.04, 0.28]]){ c.beginPath(); c.arc(x * s, y * s, s * 0.025, 0, 7); c.fill(); } c.restore();
});
def('cherry', 'Cherries', 'food fruit', (c, s) => {
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(-s * 0.2, s * 0.14); c.quadraticCurveTo(-s * 0.1, -s * 0.2, s * 0.12, -s * 0.38); c.moveTo(s * 0.2, s * 0.2); c.quadraticCurveTo(s * 0.2, -s * 0.12, s * 0.12, -s * 0.38); c.stroke();
  part(c, s, pal('meadow.fresh'), ell(c, s * 0.28, -s * 0.34, s * 0.16, s * 0.06, -0.3));
  for (const x of [-0.2, 0.2]){ part(c, s, pal('touch.cherry'), circ(c, x * s, s * 0.22, s * 0.2)); c.save(); ell(c, (x - 0.07) * s, s * 0.14, s * 0.05, s * 0.035, -0.6)(); wash(c, SNOW, 0.6); c.restore(); }
});
def('watermelon', 'Watermelon', 'food fruit', (c, s) => {
  part(c, s, pal('meadow.deep'), () => { c.beginPath(); c.arc(0, -s * 0.18, s * 0.46, 0, Math.PI); c.closePath(); });
  part(c, s, SNOW, () => { c.beginPath(); c.arc(0, -s * 0.18, s * 0.39, 0, Math.PI); c.closePath(); }, { shade: false, w: 0.001 });
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.arc(0, -s * 0.18, s * 0.34, 0, Math.PI); c.closePath(); }, { w: 0.001 });
  for (const [x, y] of [[-0.18, 0.02], [0, 0.1], [0.18, 0.02], [-0.08, 0.2], [0.1, 0.22]]){ c.save(); c.translate(x * s, y * s); c.rotate(-0.2); c.fillStyle = INK; c.beginPath(); c.ellipse(0, 0, s * 0.03, s * 0.05, 0, 0, 7); c.fill(); c.restore(); }
});
def('carrot', 'Carrot', 'food', (c, s) => {
  for (const a of [-0.5, 0, 0.5]) part(c, s, pal('meadow.fresh'), () => { c.save(); c.translate(s * 0.22, -s * 0.22); c.rotate(a + 0.7); c.beginPath(); c.ellipse(0, -s * 0.15, s * 0.06, s * 0.15, 0, 0, 7); c.restore(); });
  part(c, s, pal('touch.tangerine'), () => { c.beginPath(); c.moveTo(-s * 0.34, s * 0.46); c.lineTo(s * 0.08, -s * 0.28); c.quadraticCurveTo(s * 0.26, -s * 0.34, s * 0.36, -s * 0.18); c.quadraticCurveTo(s * 0.4, -s * 0.06, s * 0.3, s * 0.0); c.closePath(); });
  c.lineWidth = s * 0.035; c.strokeStyle = INK; c.lineCap = 'round'; for (const [a, b, d, e] of [[0.02, 0.1, 0.1, 0.02], [-0.1, 0.24, 0.0, 0.16], [0.08, -0.06, 0.18, -0.1]]){ c.beginPath(); c.moveTo(a * s, b * s); c.lineTo(d * s, e * s); c.stroke(); }
});
def('cookie', 'Cookie', 'food treat', (c, s) => {
  part(c, s, pal('earth.sand'), circ(c, 0, 0, s * 0.42));
  for (const [x, y, r] of [[-0.16, -0.14, 0.06], [0.14, -0.2, 0.05], [0.2, 0.06, 0.06], [-0.2, 0.14, 0.055], [0.0, 0.0, 0.05], [0.06, 0.24, 0.05]]) dot(c, x * s, y * s, r * s, pal('earth.bark'));
});
def('icecream', 'Ice cream', 'food treat', (c, s) => {
  part(c, s, pal('earth.sand'), poly(c, [[-s * 0.22, s * 0.02], [s * 0.22, s * 0.02], [0, s * 0.48]]));
  c.save(); poly(c, [[-s * 0.22, s * 0.02], [s * 0.22, s * 0.02], [0, s * 0.48]])(); c.clip(); c.lineWidth = s * 0.025; c.strokeStyle = INK; for (const k of [-0.2, 0, 0.2, 0.4]){ c.beginPath(); c.moveTo(-s * 0.3, s * (k + 0.04)); c.lineTo(s * 0.3, s * (k + 0.34)); c.moveTo(s * 0.3, s * (k + 0.04)); c.lineTo(-s * 0.3, s * (k + 0.34)); c.stroke(); } c.restore();
  part(c, s, pal('touch.bubblegum'), circ(c, 0, -s * 0.12, s * 0.28));
  part(c, s, pal('touch.bubblegum'), ell(c, -s * 0.18, s * 0.02, s * 0.1, s * 0.07), { shade: false });
  part(c, s, pal('touch.bubblegum'), ell(c, s * 0.16, s * 0.02, s * 0.1, s * 0.07), { shade: false });
  part(c, s, pal('touch.cherry'), circ(c, 0, -s * 0.4, s * 0.07));
});
def('pizza', 'Pizza', 'food', (c, s) => {
  part(c, s, pal('touch.sunflower'), poly(c, [[-s * 0.42, -s * 0.26], [s * 0.42, -s * 0.26], [0, s * 0.46]]));
  part(c, s, pal('earth.clay'), rrect(c, -s * 0.46, -s * 0.36, s * 0.92, s * 0.14, s * 0.07));
  for (const [x, y, r] of [[-0.14, -0.08, 0.075], [0.16, -0.06, 0.07], [0.0, 0.12, 0.07]]) part(c, s, pal('touch.cherry'), circ(c, x * s, y * s, r * s), { w: 0.035 });
});

/* nature */
def('sunflower', 'Sunflower', 'nature garden', (c, s) => {
  for (let i = 0; i < 10; i++){ const a = i * Math.PI / 5; part(c, s, pal('touch.sunflower'), ell(c, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, s * 0.15, s * 0.075, a), { shade: i > 4, w: 0.04 }); }
  part(c, s, pal('earth.bark'), circ(c, 0, 0, s * 0.2));
  dot(c, -s * 0.06, -s * 0.06, s * 0.04, pal('earth.bark', 'light'));
});
def('tulip', 'Tulip', 'nature garden', (c, s) => {
  c.beginPath(); c.moveTo(0, s * 0.0); c.lineTo(0, s * 0.46); line(c, s, 0.07); c.strokeStyle = pal('meadow.fresh'); c.lineWidth = s * 0.04; c.stroke();
  for (const sx of [-1, 1]) part(c, s, pal('meadow.fresh'), () => { c.beginPath(); c.moveTo(0, s * 0.42); c.quadraticCurveTo(sx * s * 0.34, s * 0.34, sx * s * 0.3, s * 0.08); c.quadraticCurveTo(sx * s * 0.1, s * 0.2, 0, s * 0.42); c.closePath(); });
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.moveTo(-s * 0.26, -s * 0.28); c.lineTo(-s * 0.14, -s * 0.12); c.lineTo(0, -s * 0.3); c.lineTo(s * 0.14, -s * 0.12); c.lineTo(s * 0.26, -s * 0.28); c.quadraticCurveTo(s * 0.3, s * 0.02, 0, s * 0.06); c.quadraticCurveTo(-s * 0.3, s * 0.02, -s * 0.26, -s * 0.28); c.closePath(); });
});
def('mapleleaf', 'Maple leaf', 'nature autumn', (c, s) => {
  c.beginPath(); c.moveTo(0, s * 0.2); c.lineTo(0, s * 0.46); line(c, s, 0.06);
  part(c, s, pal('autumn.rust'), poly(c, [[0, -s * 0.46], [s * 0.1, -s * 0.28], [s * 0.2, -s * 0.34], [s * 0.18, -s * 0.12], [s * 0.4, -s * 0.18], [s * 0.3, s * 0.02], [s * 0.46, s * 0.1], [s * 0.2, s * 0.24], [s * 0.04, s * 0.2], [0, s * 0.3], [-s * 0.04, s * 0.2], [-s * 0.2, s * 0.24], [-s * 0.46, s * 0.1], [-s * 0.3, s * 0.02], [-s * 0.4, -s * 0.18], [-s * 0.18, -s * 0.12], [-s * 0.2, -s * 0.34], [-s * 0.1, -s * 0.28]]));
  c.beginPath(); c.moveTo(0, s * 0.2); c.lineTo(0, -s * 0.2); c.moveTo(0, s * 0.04); c.lineTo(s * 0.22, -s * 0.08); c.moveTo(0, s * 0.04); c.lineTo(-s * 0.22, -s * 0.08); c.lineWidth = s * 0.025; c.strokeStyle = INK; c.stroke();
});
def('mushroom', 'Mushroom', 'nature forest', (c, s) => {
  part(c, s, SNOW, rrect(c, -s * 0.14, -s * 0.04, s * 0.28, s * 0.46, s * 0.08));
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.ellipse(0, -s * 0.04, s * 0.46, s * 0.4, 0, Math.PI, 0); c.quadraticCurveTo(0, s * 0.08, -s * 0.46, -s * 0.04); c.closePath(); });
  for (const [x, y, r] of [[-0.22, -0.18, 0.07], [0.04, -0.28, 0.07], [0.26, -0.14, 0.06]]) dot(c, x * s, y * s, r * s, SNOW);
});
def('snowman', 'Snowman', 'snow', (c, s) => {
  part(c, s, SNOW, circ(c, 0, s * 0.24, s * 0.26));
  part(c, s, SNOW, circ(c, 0, -s * 0.12, s * 0.2));
  part(c, s, pal('touch.cherry'), rrect(c, -s * 0.2, s * 0.04, s * 0.4, s * 0.07, s * 0.035), { shade: false });
  part(c, s, pal('fur.charcoal'), rrect(c, -s * 0.2, -s * 0.28, s * 0.4, s * 0.05, s * 0.02), { shade: false });
  part(c, s, pal('fur.charcoal'), rrect(c, -s * 0.12, -s * 0.46, s * 0.24, s * 0.2, s * 0.03), { shade: false });
  dot(c, -s * 0.07, -s * 0.14, s * 0.025, INK); dot(c, s * 0.07, -s * 0.14, s * 0.025, INK);
  part(c, s, pal('touch.tangerine'), poly(c, [[0, -s * 0.1], [s * 0.18, -s * 0.07], [0, -s * 0.04]]), { shade: false, w: 0.035 });
  for (const y of [0.18, 0.3]) dot(c, 0, y * s, s * 0.025, INK);
});
def('cactus', 'Cactus', 'nature', (c, s) => {
  const g = pal('meadow.fresh');
  part(c, s, g, rrect(c, -s * 0.34, -s * 0.12, s * 0.12, s * 0.3, s * 0.06)); part(c, s, g, rrect(c, -s * 0.34, s * 0.08, s * 0.3, s * 0.12, s * 0.06));
  part(c, s, g, rrect(c, s * 0.22, -s * 0.26, s * 0.12, s * 0.26, s * 0.06)); part(c, s, g, rrect(c, s * 0.0, -s * 0.02, s * 0.34, s * 0.12, s * 0.06));
  part(c, s, g, rrect(c, -s * 0.14, -s * 0.42, s * 0.28, s * 0.72, s * 0.14));
  part(c, s, pal('earth.clay'), poly(c, [[-s * 0.26, s * 0.3], [s * 0.26, s * 0.3], [s * 0.2, s * 0.48], [-s * 0.2, s * 0.48]]));
  for (const [x, y] of [[-0.04, -0.28], [0.05, -0.12], [-0.04, 0.04], [0.04, 0.18]]) dot(c, x * s, y * s, s * 0.018, INK);
});
def('seedling', 'Seedling', 'nature garden', (c, s) => {
  part(c, s, pal('earth.clay'), ell(c, 0, s * 0.38, s * 0.34, s * 0.12));
  c.beginPath(); c.moveTo(0, s * 0.34); c.quadraticCurveTo(s * 0.02, s * 0.1, 0, -s * 0.06); line(c, s, 0.1); c.strokeStyle = pal('meadow.fresh'); c.lineWidth = s * 0.05; c.stroke();
  for (const sx of [-1, 1]) part(c, s, pal('meadow.fresh'), () => { c.beginPath(); c.moveTo(0, -s * 0.04); c.quadraticCurveTo(sx * s * 0.1, -s * 0.4, sx * s * 0.44, -s * 0.32); c.quadraticCurveTo(sx * s * 0.34, s * 0.0, 0, -s * 0.04); c.closePath(); });
});
def('shell', 'Shell', 'nature beach', (c, s) => {
  part(c, s, pal('earth.peach'), () => { c.beginPath(); c.moveTo(-s * 0.14, s * 0.38); c.lineTo(-s * 0.44, s * 0.0); c.arc(0, s * 0.0, s * 0.44, Math.PI, 0); c.lineTo(s * 0.14, s * 0.38); c.closePath(); });
  c.save(); c.beginPath(); c.moveTo(-s * 0.14, s * 0.38); c.lineTo(-s * 0.44, s * 0.0); c.arc(0, s * 0.0, s * 0.44, Math.PI, 0); c.lineTo(s * 0.14, s * 0.38); c.closePath(); c.clip();
  c.lineWidth = s * 0.03; c.strokeStyle = INK; for (const a of [-2.7, -2.2, -1.57, -0.94, -0.44]){ c.beginPath(); c.moveTo(0, s * 0.4); c.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5); c.stroke(); } c.restore();
  part(c, s, pal('earth.sand'), rrect(c, -s * 0.16, s * 0.34, s * 0.32, s * 0.1, s * 0.04), { shade: false });
});

/* things */
def('car', 'Car', 'thing', (c, s) => {
  part(c, s, pal('touch.cherry'), rrect(c, -s * 0.2, -s * 0.24, s * 0.4, s * 0.28, s * 0.1));
  part(c, s, pal('touch.cherry'), rrect(c, -s * 0.46, -s * 0.04, s * 0.92, s * 0.34, s * 0.1));
  part(c, s, pal('sea.sunlit'), rrect(c, -s * 0.13, -s * 0.18, s * 0.11, s * 0.16, s * 0.03), { shade: false, w: 0.035 }); part(c, s, pal('sea.sunlit'), rrect(c, s * 0.03, -s * 0.18, s * 0.11, s * 0.16, s * 0.03), { shade: false, w: 0.035 });
  part(c, s, pal('touch.sunflower'), circ(c, s * 0.4, s * 0.08, s * 0.05), { shade: false, w: 0.03 });
  for (const x of [-0.26, 0.26]){ part(c, s, pal('fur.charcoal'), circ(c, x * s, s * 0.3, s * 0.12)); dot(c, x * s, s * 0.3, s * 0.04, pal('shade.light')); }
});
def('train', 'Train', 'thing', (c, s) => {
  part(c, s, INK, rrect(c, -s * 0.28, -s * 0.34, s * 0.12, s * 0.2, s * 0.03), { shade: false });
  part(c, s, pal('touch.mint'), rrect(c, -s * 0.46, -s * 0.16, s * 0.56, s * 0.34, s * 0.07));
  part(c, s, pal('touch.skyBlue'), rrect(c, s * 0.1, -s * 0.34, s * 0.34, s * 0.52, s * 0.05));
  part(c, s, pal('sea.sunlit'), rrect(c, s * 0.18, -s * 0.26, s * 0.18, s * 0.18, s * 0.03), { shade: false, w: 0.035 });
  part(c, s, pal('touch.sunflower'), rrect(c, s * 0.04, -s * 0.38, s * 0.46, s * 0.07, s * 0.03), { shade: false, w: 0.035 });
  part(c, s, pal('touch.sunflower'), circ(c, -s * 0.46, s * 0.0, s * 0.05), { shade: false, w: 0.03 });
  for (const x of [-0.3, -0.06, 0.28]){ part(c, s, pal('touch.cherry'), circ(c, x * s, s * 0.3, x > 0 ? s * 0.12 : s * 0.1)); dot(c, x * s, s * 0.3, s * 0.035, pal('shade.light')); }
});
def('castle', 'Castle', 'place', (c, s) => {
  const stone = pal('earth.sand');
  for (const sx of [-1, 1]){ part(c, s, stone, rrect(c, sx * s * 0.3 - s * 0.1, -s * 0.12, s * 0.2, s * 0.56, s * 0.02)); part(c, s, pal('earth.plumRoof'), poly(c, [[sx * s * 0.3 - s * 0.14, -s * 0.12], [sx * s * 0.3, -s * 0.4], [sx * s * 0.3 + s * 0.14, -s * 0.12]])); }
  part(c, s, stone, rrect(c, -s * 0.22, -s * 0.2, s * 0.44, s * 0.64, s * 0.02));
  part(c, s, pal('earth.plumRoof'), poly(c, [[-s * 0.26, -s * 0.2], [0, -s * 0.5], [s * 0.26, -s * 0.2]]));
  part(c, s, pal('touch.cherry'), poly(c, [[0, -s * 0.5], [s * 0.2, -s * 0.44], [0, -s * 0.38]]), { shade: false, w: 0.03 });
  part(c, s, pal('earth.bark'), () => { c.beginPath(); c.moveTo(-s * 0.1, s * 0.44); c.lineTo(-s * 0.1, s * 0.22); c.arc(0, s * 0.22, s * 0.1, Math.PI, 0); c.lineTo(s * 0.1, s * 0.44); c.closePath(); }, { shade: false });
  for (const [x, y] of [[-0.3, 0.04], [0.3, 0.04], [0, -0.06]]) part(c, s, pal('earth.bark'), rrect(c, (x - 0.025) * s, y * s, s * 0.05, s * 0.1, s * 0.02), { shade: false, w: 0.03 });
});
def('tent', 'Tent', 'place', (c, s) => {
  part(c, s, pal('meadow.soft'), ell(c, 0, s * 0.38, s * 0.46, s * 0.09), { shade: false });
  part(c, s, pal('touch.tangerine'), poly(c, [[0, -s * 0.38], [s * 0.46, s * 0.4], [-s * 0.46, s * 0.4]]));
  part(c, s, pal('shade.shadow'), poly(c, [[0, -s * 0.06], [s * 0.18, s * 0.4], [-s * 0.18, s * 0.4]]), { shade: false });
  c.beginPath(); c.moveTo(0, -s * 0.38); c.lineTo(0, -s * 0.06); line(c, s, 0.035);
  part(c, s, pal('touch.cherry'), poly(c, [[0, -s * 0.38], [s * 0.18, -s * 0.32], [0, -s * 0.26]]), { shade: false, w: 0.03 });
});
def('drum', 'Drum', 'thing music', (c, s) => {
  c.lineCap = 'round'; for (const sx of [-1, 1]){ c.beginPath(); c.moveTo(sx * s * 0.08, -s * 0.06); c.lineTo(sx * s * 0.36, -s * 0.46); c.lineWidth = s * 0.1; c.strokeStyle = INK; c.stroke(); c.lineWidth = s * 0.045; c.strokeStyle = pal('earth.sand'); c.stroke(); }
  part(c, s, pal('touch.cherry'), () => { c.beginPath(); c.moveTo(-s * 0.4, -s * 0.06); c.lineTo(-s * 0.4, s * 0.3); c.ellipse(0, s * 0.3, s * 0.4, s * 0.12, 0, Math.PI, 0, true); c.lineTo(s * 0.4, -s * 0.06); c.closePath(); });
  part(c, s, pal('shade.light'), ell(c, 0, -s * 0.06, s * 0.4, s * 0.13), { shade: false });
  c.save(); c.beginPath(); c.rect(-s * 0.4, -s * 0.06, s * 0.8, s * 0.5); c.clip(); c.beginPath(); c.moveTo(-s * 0.36, s * 0.04); for (let i = 0; i < 4; i++){ c.lineTo((-0.36 + (i + 0.5) * 0.18) * s, s * 0.3); c.lineTo((-0.36 + (i + 1) * 0.18) * s, s * 0.04); } c.lineWidth = s * 0.035; c.strokeStyle = pal('touch.sunflower'); c.stroke(); c.restore();
});
def('guitar', 'Guitar', 'thing music', (c, s) => {
  c.save(); c.rotate(-0.7);
  part(c, s, pal('earth.bark'), rrect(c, -s * 0.05, -s * 0.5, s * 0.1, s * 0.44, s * 0.02));
  part(c, s, pal('fur.charcoal'), rrect(c, -s * 0.08, -s * 0.58, s * 0.16, s * 0.12, s * 0.03), { shade: false });
  part(c, s, pal('earth.clay'), circ(c, 0, s * 0.08, s * 0.16)); part(c, s, pal('earth.clay'), circ(c, 0, s * 0.3, s * 0.22));
  dot(c, 0, s * 0.2, s * 0.07, INK);
  c.beginPath(); c.moveTo(0, s * 0.06); c.lineTo(0, s * 0.4); c.lineWidth = s * 0.02; c.strokeStyle = INK; c.stroke();
  c.restore();
});
def('teddy', 'Teddy bear', 'thing toy', (c, s) => {
  const b = pal('earth.clay');
  for (const sx of [-1, 1]){ part(c, s, b, circ(c, sx * s * 0.2, s * 0.38, s * 0.1)); part(c, s, b, ell(c, sx * s * 0.3, s * 0.18, s * 0.08, s * 0.11, sx * -0.5)); }
  part(c, s, b, ell(c, 0, s * 0.24, s * 0.26, s * 0.24));
  part(c, s, pal('earth.sand'), ell(c, 0, s * 0.27, s * 0.14, s * 0.15), { shade: false });
  for (const sx of [-1, 1]) part(c, s, b, circ(c, sx * s * 0.24, -s * 0.28, s * 0.1));
  part(c, s, b, circ(c, 0, -s * 0.12, s * 0.28));
  part(c, s, pal('earth.sand'), ell(c, 0, -s * 0.05, s * 0.12, s * 0.09), { shade: false });
  dot(c, 0, -s * 0.08, s * 0.03, INK); eye(c, -s * 0.11, -s * 0.18, s * 0.035); eye(c, s * 0.11, -s * 0.18, s * 0.035);
  part(c, s, pal('touch.cherry'), poly(c, [[0, s * 0.1], [-s * 0.12, s * 0.04], [-s * 0.12, s * 0.16]]), { shade: false, w: 0.035 }); part(c, s, pal('touch.cherry'), poly(c, [[0, s * 0.1], [s * 0.12, s * 0.04], [s * 0.12, s * 0.16]]), { shade: false, w: 0.035 });
});
def('basketball', 'Basketball', 'thing ball', (c, s) => {
  part(c, s, pal('touch.tangerine'), circ(c, 0, 0, s * 0.42));
  c.save(); c.beginPath(); c.arc(0, 0, s * 0.42, 0, 7); c.clip(); c.lineWidth = s * 0.035; c.strokeStyle = INK;
  c.beginPath(); c.moveTo(-s * 0.42, 0); c.lineTo(s * 0.42, 0); c.moveTo(0, -s * 0.42); c.lineTo(0, s * 0.42); c.stroke();
  c.beginPath(); c.arc(-s * 0.5, 0, s * 0.34, -1.1, 1.1); c.stroke(); c.beginPath(); c.arc(s * 0.5, 0, s * 0.34, Math.PI - 1.1, Math.PI + 1.1); c.stroke(); c.restore();
});
def('soccerball', 'Football', 'thing ball', (c, s) => {
  part(c, s, SNOW, circ(c, 0, 0, s * 0.42));
  const pent = (r, x, y, rot) => { c.beginPath(); for (let k = 0; k < 5; k++){ const a = rot + k * Math.PI * 2 / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };
  c.save(); c.beginPath(); c.arc(0, 0, s * 0.42, 0, 7); c.clip(); c.fillStyle = pal('fur.charcoal'); c.strokeStyle = INK; c.lineWidth = s * 0.03; c.lineJoin = 'round';
  for (let k = 0; k < 5; k++){ const a = -Math.PI / 2 + k * Math.PI * 2 / 5; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14); c.lineTo(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28); c.stroke(); pent(s * 0.13, Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46, a + Math.PI / 5 * 0 + 0.3); c.fill(); }
  pent(s * 0.15, 0, 0, -Math.PI / 2); c.fill(); c.stroke(); c.restore();
  c.save(); c.beginPath(); c.arc(0, 0, s * 0.42, 0, 7); c.clip(); c.beginPath(); c.arc(s * 0.3, s * 0.34, s * 0.46, 0, 7); wash(c, SHADOW, 0.16); c.restore();
  c.beginPath(); c.arc(0, 0, s * 0.42, 0, 7); line(c, s, 0.05);
});
def('umbrella', 'Umbrella', 'thing rain', (c, s) => {
  c.beginPath(); c.moveTo(0, -s * 0.06); c.lineTo(0, s * 0.34); c.arc(-s * 0.08, s * 0.34, s * 0.08, 0, Math.PI); line(c, s, 0.09); c.strokeStyle = pal('earth.bark'); c.lineWidth = s * 0.04; c.stroke();
  const top = -s * 0.04, R = s * 0.46;
  for (let i = 0; i < 4; i++) part(c, s, i % 2 ? SNOW : pal('touch.cherry'), () => { c.beginPath(); c.moveTo(0, top); c.arc(0, top, R, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); c.closePath(); }, { w: 0.04 });
});
def('balloonemoji', 'Party balloon', 'thing party', (c, s) => {
  c.beginPath(); c.moveTo(0, s * 0.3); c.quadraticCurveTo(-s * 0.1, s * 0.4, s * 0.04, s * 0.5); line(c, s, 0.025);
  part(c, s, pal('touch.cherry'), poly(c, [[0, s * 0.3], [-s * 0.06, s * 0.38], [s * 0.06, s * 0.38]]), { shade: false, w: 0.03 });
  part(c, s, pal('touch.cherry'), ell(c, 0, -s * 0.08, s * 0.3, s * 0.38));
  c.save(); ell(c, -s * 0.12, -s * 0.22, s * 0.06, s * 0.1, 0.4)(); wash(c, SNOW, 0.6); c.restore();
});

const MONO = (c, s, o, vw, vh, parts) => {
  if (typeof Path2D === 'undefined') return;
  const k = s / Math.max(vw, vh);
  c.save(); c.translate(-vw * k / 2, -vh * k / 2); c.scale(k, k);
  c.fillStyle = o.tint || INK;
  const a = c.globalAlpha;
  for (const [d, op, rule] of parts){ c.globalAlpha = a * op; c.fill(new Path2D(d), rule || 'nonzero'); }
  c.globalAlpha = a; c.restore();
};
const PEOPLE_BEHIND = 'M25.1 10 a4.6 4.6 0 1 1 -9.2 0 a4.6 4.6 0 1 1 9.2 0 Z M12.5 27 c0-5.6 3.6-9.4 8-9.4 s8 3.8 8 9.4 z';
const PEOPLE_FRONT = 'M17 11.5 a5 5 0 1 1 -10 0 a5 5 0 1 1 10 0 Z M2.5 28.5 c0-6.2 4.2-10.4 9.5-10.4 s9.5 4.2 9.5 10.4 z';
def('people', 'People', 'person players', (c, s, o) => MONO(c, s, o, 32, 32, [[PEOPLE_BEHIND, 0.55], [PEOPLE_FRONT, 1]]));
const PAD_GRIPS = 'M14 7 L9 7 C7.4 7 6.6 8 6.2 9.4 L2.6 22.4 C1.4 27 6 29.6 9 26.6 L12.6 23 H14 Z M34 7 L39 7 C40.6 7 41.4 8 41.8 9.4 L45.4 22.4 C46.6 27 42 29.6 39 26.6 L35.4 23 H34 Z';
const PAD_FRAME = 'M16 5 H32 A3 3 0 0 1 35 8 V21 A3 3 0 0 1 32 24 H16 A3 3 0 0 1 13 21 V8 A3 3 0 0 1 16 5 Z M17.2 8 H30.8 A1.2 1.2 0 0 1 32 9.2 V19.8 A1.2 1.2 0 0 1 30.8 21 H17.2 A1.2 1.2 0 0 1 16 19.8 V9.2 A1.2 1.2 0 0 1 17.2 8 Z';
def('tabletgrip', 'Orlis PlayPad', 'thing controller tablet playpad', (c, s, o) => MONO(c, s, o, 48, 32, [[PAD_GRIPS, 1], [PAD_FRAME, 0.55, 'evenodd']]));
