/* Props, drawn in code in the Orlis house style (decisions 0040 and 0041): every colour a palette name, flat fills, one shade tone and one
   soft highlight (light from the upper left, shade on the lower right), and the ink edge only on characters and touchables (balloon, heart,
   star, block, beach ball, chest, basket, raven), never on scenery.
   Each is a function (c, s, o): c is already moved to the middle of the asset, s is its height in pixels, o its options
   (o.color for the ones that take a colour; o.t for the ones that move). Widths follow from `aspect` in the table. */
import { color as pal, alpha as palAlpha } from './palette.js';
const INK = pal('shade.ink'), SHADOW = pal('shade.shadow'), SNOW = pal('earth.snow');
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const outline = (c, s, w = 0.045) => { c.lineWidth = s * w; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); };
/* fill the current path with a palette colour at a given strength, and put the transparency back (the washes: the shade tone is the
   palette's shadow colour at 20%, the soft highlight is white at about 45%) */
const wash = (c, col, a) => { const g = c.globalAlpha; c.fillStyle = col; c.globalAlpha = g * a; c.fill(); c.globalAlpha = g; };
const shadeWash = (c) => wash(c, SHADOW, 0.2), lightWash = (c, a = 0.45) => wash(c, SNOW, a);
const flat = (c, col) => { c.fillStyle = col; c.fill(); };

export const BALLOON_COLORS = ['touch.cherry', 'touch.tangerine', 'touch.sunflower', 'touch.mint', 'touch.skyBlue', 'touch.grape', 'touch.bubblegum'].map(n => pal(n));
const WEDGES = BALLOON_COLORS.slice(0, 6);

export const PROPS = {
  /* [id]: [name, tags, aspect, draw] */
  chest: ['Treasure chest', 'thing treasure', 1.3, (c, s) => {
    const w = s * 1.3, h = s;
    c.fillStyle = pal('earth.clay.shade'); rr(c, -w * 0.45, -h * 0.05, w * 0.9, h * 0.5, s * 0.08); c.fill(); outline(c, s);
    c.fillStyle = pal('earth.clay'); c.beginPath(); c.moveTo(-w * 0.45, -h * 0.05); c.quadraticCurveTo(0, -h * 0.62, w * 0.45, -h * 0.05); c.closePath(); c.fill(); outline(c, s);
    c.fillStyle = pal('ui.gold'); c.fillRect(-w * 0.05, -h * 0.05, w * 0.1, h * 0.5); c.beginPath(); c.arc(0, h * 0.1, s * 0.07, 0, 7); c.fill();
  }],
  basket: ['Basket', 'thing garden', 1.25, (c, s) => {
    const w = s * 1.25;
    c.fillStyle = pal('earth.sand'); c.beginPath(); c.moveTo(-w * 0.45, -s * 0.12); c.lineTo(-w * 0.34, s * 0.42); c.quadraticCurveTo(0, s * 0.55, w * 0.34, s * 0.42); c.lineTo(w * 0.45, -s * 0.12); c.closePath(); c.fill(); outline(c, s, 0.05);
    c.strokeStyle = pal('earth.sand.shade'); c.lineWidth = s * 0.03; for (let i = -3; i <= 3; i++){ c.beginPath(); c.moveTo(i * w * 0.12, -s * 0.1); c.lineTo(i * w * 0.1, s * 0.46); c.stroke(); }
    c.fillStyle = pal('earth.sand.light'); rr(c, -w * 0.5, -s * 0.2, w, s * 0.16, s * 0.08); c.fill(); outline(c, s, 0.05);
  }],
  beachball: ['Beach ball', 'thing ball', 1, (c, s, o) => {
    const r = s / 2, rot = (o.t || 0) * 0.4;
    c.save(); c.rotate(rot);
    WEDGES.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * Math.PI * 2 / 6, (i + 1) * Math.PI * 2 / 6); c.closePath(); c.fill(); });
    c.restore();
    c.beginPath(); c.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, 7); lightWash(c, 0.45);
    c.beginPath(); c.arc(0, 0, r, 0, 7); outline(c, s, 0.04);
  }],
  balloon: ['Balloon', 'thing party', 0.8, (c, s, o) => {
    const col = o.color || BALLOON_COLORS[0], w = s * 0.8, h = s * 0.82;
    c.strokeStyle = pal('shade.mid'); c.lineWidth = s * 0.02; c.beginPath(); c.moveTo(0, h * 0.5); c.quadraticCurveTo(-s * 0.08, s * 0.7, 0, s * 0.95); c.stroke();
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.08, w / 2, h / 2, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(-s * 0.05, h * 0.42); c.lineTo(s * 0.05, h * 0.42); c.lineTo(0, h * 0.5); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(w * 0.1, -s * 0.02, w * 0.34, h * 0.4, 0, -1.2, 1.9); shadeWash(c);
    c.beginPath(); c.ellipse(-w * 0.2, -s * 0.22, w * 0.1, h * 0.14, -0.5, 0, 7); lightWash(c);
    c.beginPath(); c.ellipse(0, -s * 0.08, w / 2, h / 2, 0, 0, 7); outline(c, s, 0.03);
  }],
  heart: ['Heart', 'thing love', 1.1, (c, s, o) => {
    const k = s / 2, shape = () => { c.beginPath(); c.moveTo(0, k * 0.8); c.bezierCurveTo(-k * 1.6, -k * 0.2, -k * 0.7, -k * 1.2, 0, -k * 0.45); c.bezierCurveTo(k * 0.7, -k * 1.2, k * 1.6, -k * 0.2, 0, k * 0.8); c.closePath(); };
    shape(); flat(c, o.color || pal('touch.bubblegum')); c.save(); c.clip(); c.beginPath(); c.arc(k * 0.8, k * 0.5, k * 1.1, 0, 7); shadeWash(c); c.restore(); shape(); outline(c, s, 0.04);
  }],
  star: ['Star', 'thing night', 1, (c, s, o) => {
    const r = s / 2, shape = () => { c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); };
    shape(); flat(c, o.color || pal('touch.sunflower')); c.save(); shape(); c.clip(); c.beginPath(); c.arc(r * 0.7, r * 0.4, r, 0, 7); shadeWash(c); c.restore();
    shape(); outline(c, s, 0.04);
  }],
  block: ['Toy block', 'thing toy', 1, (c, s, o) => {
    const w = s, col = o.color || pal('touch.skyBlue');
    rr(c, -w / 2, -w / 2, w, w, s * 0.12); flat(c, col); c.save(); rr(c, -w / 2, -w / 2, w, w, s * 0.12); c.clip(); c.beginPath(); c.rect(w * 0.1, -w / 2, w, w); shadeWash(c); c.restore();
    rr(c, -w * 0.38, -w * 0.38, w * 0.3, w * 0.12, w * 0.05); lightWash(c, 0.35); rr(c, -w / 2, -w / 2, w, w, s * 0.12); outline(c, s, 0.05);
  }],
  tree: ['Tree', 'nature tree', 0.95, (c, s) => {
    c.fillStyle = pal('earth.bark'); c.beginPath(); c.moveTo(-s * 0.07, s * 0.5); c.quadraticCurveTo(-s * 0.04, s * 0.15, -s * 0.05, -s * 0.05); c.lineTo(s * 0.05, -s * 0.05); c.quadraticCurveTo(s * 0.04, s * 0.15, s * 0.08, s * 0.5); c.closePath(); c.fill();
    for (const [dx, dy, r, tn] of [[-0.2, -0.15, 0.26, null], [0.2, -0.15, 0.25, 'shade'], [0, -0.3, 0.27, null], [0, -0.1, 0.28, null]]){ c.fillStyle = pal('meadow.fresh', tn); c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, 7); c.fill(); }
    c.beginPath(); c.ellipse(-s * 0.1, -s * 0.34, s * 0.09, s * 0.06, -0.6, 0, 7); lightWash(c, 0.4);
  }],
  pine: ['Pine tree', 'nature tree snow', 0.7, (c, s) => {
    c.fillStyle = pal('earth.bark'); c.fillRect(-s * 0.04, s * 0.32, s * 0.08, s * 0.18);
    [[0.34, 0.58, 'shade'], [0.12, 0.48, null], [-0.1, 0.36, null]].forEach(([y, w, tn]) => { c.fillStyle = pal('meadow.fresh', tn); c.beginPath(); c.moveTo(0, y * s - s * 0.3); c.lineTo(w * s / 1.4, y * s + s * 0.16); c.lineTo(-w * s / 1.4, y * s + s * 0.16); c.closePath(); c.fill(); });
    c.beginPath(); c.moveTo(0, -s * 0.44); c.lineTo(s * 0.12, -s * 0.28); c.lineTo(-s * 0.12, -s * 0.28); c.closePath(); wash(c, SNOW, 0.7);
  }],
  bush: ['Bush', 'nature garden', 1.4, (c, s) => {
    for (const [dx, dy, r, tn] of [[-0.3, 0.1, 0.28, null], [0.3, 0.1, 0.28, 'shade'], [0, -0.02, 0.34, null]]){ c.fillStyle = pal('meadow.fresh', tn); c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, 7); c.fill(); }
    c.beginPath(); c.ellipse(-s * 0.1, -s * 0.16, s * 0.1, s * 0.06, -0.6, 0, 7); lightWash(c, 0.4);
  }],
  cloud: ['Cloud', 'sky', 2, (c, s, o) => {
    const k = s;
    c.beginPath();
    for (const [dx, dy, r] of [[-0.55, 0.1, 0.3], [-0.2, -0.1, 0.4], [0.25, -0.02, 0.36], [0.6, 0.12, 0.28]]){ c.moveTo(dx * k + r * k, dy * k); c.arc(dx * k, dy * k, r * k, 0, 7); }
    c.rect(-0.55 * k, 0.1 * k, 1.15 * k, 0.3 * k);
    if (o.color) flat(c, o.color); else wash(c, SNOW, 0.92);
  }],
  sun: ['Sun', 'sky', 1, (c, s, o) => {
    const t = o.t || 0, r = s * 0.28, gold = pal('sky.sunGlow'), g0 = c.globalAlpha;
    c.strokeStyle = gold; c.globalAlpha = g0 * 0.8; c.lineWidth = s * 0.06; c.lineCap = 'round';
    for (let i = 0; i < 10; i++){ const a = i * Math.PI / 5 + t * 0.2; c.beginPath(); c.moveTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); c.lineTo(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8); c.stroke(); }
    c.globalAlpha = g0;
    c.fillStyle = gold; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(-r * 0.35, -r * 0.1, r * 0.08, 0, 7); c.arc(r * 0.35, -r * 0.1, r * 0.08, 0, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = r * 0.07; c.beginPath(); c.arc(0, r * 0.15, r * 0.3, 0.2, Math.PI - 0.2); c.stroke();
    c.beginPath(); c.arc(-r * 0.6, r * 0.2, r * 0.14, 0, 7); c.arc(r * 0.6, r * 0.2, r * 0.14, 0, 7); wash(c, pal('earth.brick'), 0.4);
  }],
  rainbow: ['Rainbow', 'sky', 2, (c, s) => {
    const cols = ['touch.cherry', 'touch.tangerine', 'touch.sunflower', 'touch.mint', 'touch.skyBlue', 'touch.grape'], w = s * 2, r0 = w / 2, g0 = c.globalAlpha;
    cols.forEach((col, i) => { c.strokeStyle = pal(col); c.globalAlpha = g0 * 0.7; c.lineWidth = s * 0.1; c.beginPath(); c.arc(0, s * 0.5, r0 - i * s * 0.1 - s * 0.05, Math.PI, 0); c.stroke(); });
    c.globalAlpha = g0;
  }],
  rock: ['Rock', 'nature', 1.3, (c, s) => {
    const shape = () => { c.beginPath(); c.moveTo(-s * 0.6, s * 0.4); c.quadraticCurveTo(-s * 0.55, -s * 0.3, -s * 0.1, -s * 0.38); c.quadraticCurveTo(s * 0.4, -s * 0.4, s * 0.6, s * 0.4); c.closePath(); };
    shape(); flat(c, pal('space.rock'));
    c.save(); c.clip(); c.beginPath(); c.arc(s * 0.5, s * 0.3, s * 0.6, 0, 7); shadeWash(c); c.restore();
  }],
  puddle: ['Puddle', 'nature', 2.4, (c, s) => {
    c.beginPath(); c.ellipse(0, 0, s * 1.2, s * 0.5, 0, 0, 7); wash(c, pal('sky.high'), 0.85);
    c.beginPath(); c.ellipse(-s * 0.3, -s * 0.12, s * 0.35, s * 0.1, 0, 0, 7); lightWash(c, 0.5);
  }],
  /* a player's hand: the glowing mitt every Orlis game shows (o.color: the player's colour). The soft glow is an effect, so it stays a gradient. */
  hand: ['Hand', 'player hand', 1, (c, s, o) => {
    const r = s * 0.25, col = o.color || pal('fav.sky');
    const g = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.4); g.addColorStop(0, o.color ? col + 'aa' : palAlpha('fav.sky', 0.67)); g.addColorStop(1, o.color ? col + '00' : palAlpha('fav.sky', 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 2.4, 0, 7); c.fill();
    c.fillStyle = SNOW; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.lineWidth = r * 0.28; c.strokeStyle = col; c.stroke();
    c.fillStyle = col; c.beginPath(); for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4, d = i % 2 ? r * 0.22 : r * 0.55; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); } c.closePath(); c.fill();
  }],
  /* a soft glowing dot (o.color), for trails and little lights (an effect, so it keeps its soft glow) */
  dot: ['Glow dot', 'effect light', 1, (c, s, o) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, s / 2); g.addColorStop(0, o.color || pal('touch.sunflower')); g.addColorStop(1, o.color ? o.color + '00' : palAlpha('touch.sunflower', 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, s / 2, 0, 7); c.fill();
  }],
  ring: ['Ring', 'effect', 1, (c, s, o) => { c.strokeStyle = o.color || SNOW; c.lineWidth = s * 0.08; c.beginPath(); c.arc(0, 0, s * 0.44, 0, 7); c.stroke(); }],
  /* the raven from Save the Harvest */
  raven: ['Raven', 'animal fly', 1.8, (c, s, o) => {
    const k = s / 90, flap = Math.sin((o.t || 0) * 8) * 0.5 + 0.5, coat = pal('fur.charcoal');
    c.save(); c.scale(k, k); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 5; c.fillStyle = coat;
    c.beginPath(); c.ellipse(0, 0, 44, 30, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(6, -46 - flap * 30, 58, -26 - flap * 30); c.quadraticCurveTo(28, -10, 10, 2); c.closePath(); c.fillStyle = coat; c.fill(); lightWash(c, 0.12); c.stroke();
    c.beginPath(); c.arc(-34, -18, 20, 0, 7); c.fillStyle = coat; c.fill(); c.stroke();
    c.fillStyle = pal('earth.clay'); c.beginPath(); c.moveTo(-52, -18); c.lineTo(-72, -10); c.lineTo(-52, -8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = SNOW; c.beginPath(); c.arc(-38, -24, 7, 0, 7); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(-40, -24, 3.5, 0, 7); c.fill(); c.restore();
  }],
  /* effects: a burst of sparkles that grows and fades over o.t (0 to 1) */
  sparkle: ['Sparkle burst', 'effect', 1, (c, s, o) => {
    const k = Math.max(0, Math.min(1, o.t == null ? 0.5 : o.t)), a = 1 - k;
    c.globalAlpha *= a; c.fillStyle = o.color || pal('touch.sunflower');
    for (let i = 0; i < 8; i++){ const ang = i * Math.PI / 4, d = s * (0.15 + k * 0.35), r = s * 0.07 * (1 - k * 0.5); c.beginPath();
      for (let j = 0; j < 8; j++){ const q = j % 2 ? r * 0.4 : r, b = -Math.PI / 2 + j * Math.PI / 4; c.lineTo(Math.cos(ang) * d + Math.cos(b) * q, Math.sin(ang) * d + Math.sin(b) * q); } c.closePath(); c.fill(); }
  }],
  popring: ['Pop ring', 'effect', 1, (c, s, o) => {
    const k = Math.max(0, Math.min(1, o.t == null ? 0.5 : o.t)); c.globalAlpha *= 1 - k; c.strokeStyle = o.color || SNOW; c.lineWidth = s * 0.06 * (1 - k * 0.6);
    c.beginPath(); c.arc(0, 0, s * (0.2 + k * 0.3), 0, 7); c.stroke();
  }]
};
