/* Orlis avatars: each child's own character, drawn on a canvas in Orlis
   Play's look (Last Known Position's: round, chunky, lit from the left,
   with a soft dark outline) and in their own colours.

   A look is a small object - what the avatar maker saves on a profile:
     { skin, hair, hairColor, eyes, mouth, color, outfit, extra }
   Every part has a few choices (PARTS); a missing or unknown one falls
   back to the first, so an old or odd look still draws.

     head(c, x, y, r, look, t)          the head, centred at (x, y), radius r
     body(c, x, base, h, look, t, pose) the whole avatar standing, feet at
                                        (x, base), h tall; pose: 'stand',
                                        'wave', 'cheer', 'reach' (arms up)
     portrait(c, x, y, s, look, t)      a head on a rounded square of their
                                        colour (for tiles and name chips) */

export const PARTS = {
  skin: ['#ffdfc4', '#f3c393', '#dda46d', '#b97c4b', '#8d5524', '#5e3a20'],
  hair: ['short', 'curly', 'ponytail', 'buns', 'long', 'spiky', 'bob', 'none'],
  hairColor: ['#2a1d18', '#5a3825', '#9a4a26', '#e2b65a', '#f08c3a', '#4f7cff', '#ff6fae', '#9b6bff'],
  eyes: ['dots', 'happy', 'sparkle', 'wink'],
  mouth: ['smile', 'grin', 'oh', 'tongue'],
  color: ['#3da9ff', '#ff8a3d', '#22c55e', '#a855f7', '#ff5d8f', '#facc15', '#14b8a6', '#ef4444'],
  outfit: ['plain', 'stripes', 'stars', 'dots', 'hoodie'],
  extra: ['none', 'cap', 'bow', 'glasses', 'headphones', 'crown', 'flower']
};
const INK = '#1f1a3a';
/* The style: how avatars are drawn. The default is Orlis Play's house
   style: no outlines, flat colour cel-shaded - one shadow tone on the right,
   the sun being up on the left - and a soft rim of sunlight on the left.
     outline  the outline's colour (null: none), width  its thickness (x1)
     shade    'cel' (the house style), 'lit' (soft gradients, lit from the
              left), 'flat' (one colour each), 'clay' (soft, a shine on top)
     feature  the colour of eyes, brows and mouth
     rim      the rim light's colour (null: none; 'cel' only) */
const STYLE = { outline: null, width: 1, shade: 'cel', feature: '#2d2a26', rim: 'rgba(255,240,200,.95)' };
let S = { ...STYLE };
export function setStyle(s = {}){ S = { ...STYLE, ...s }; }
/* a shape's outline, if the style has one */
const edge = (c) => { if (!S.outline) return; c.strokeStyle = S.outline; c.stroke(); };
/* a fill in a colour, shaded the style's way, over a shape about r across centred (cx, cy) */
function shaded(c, col, cx, cy, r){
  if (S.shade === 'flat' || S.shade === 'cel') return col;
  if (S.shade === 'clay'){
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.05, cx, cy, r * 1.15);
    g.addColorStop(0, mix(col, '#ffffff', 0.45)); g.addColorStop(0.35, mix(col, '#ffffff', 0.12)); g.addColorStop(0.8, col); g.addColorStop(1, mix(col, '#000000', 0.28));
    return g;
  }
  const g = c.createLinearGradient(cx - r, cy, cx + r, cy); g.addColorStop(0, mix(col, '#ffffff', 0.3)); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#000000', 0.3));
  return g;
}
/* (colours can also be any colour code: a game may soften or tint them) */
const COLOURS = new Set(['skin', 'hairColor', 'color']);
const pick = (look, k) => (look && (PARTS[k].includes(look[k]) || (COLOURS.has(k) && /^#[0-9a-f]{6}$/i.test(look[k] || ''))) ? look[k] : PARTS[k][0]);

/* #rrggbb mixed toward another */
function mix(a, b, k){
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); };

/* The cel pass: the figure drawn flat into a scratch canvas, a hard-edged
   shadow tone laid over its right side (the line from (top, bottom) x),
   then put down over a copy of its shape in sunlight, nudged up-left - the
   rim. Only the outermost call does it (a body's head is part of the body). */
let depth = 0;
const scratch = [null, null];
function sheet(i, w, h){
  if (!scratch[i]){ if (typeof document === 'undefined') return null; scratch[i] = document.createElement('canvas'); }
  const cv = scratch[i]; if (cv.width < w) cv.width = w; if (cv.height < h) cv.height = h;
  return cv;
}
function cel(c, box, line, rimOff, draw){
  const m = S.shade === 'cel' && depth === 0 && c.getTransform ? c.getTransform() : null;
  if (!m || typeof m.a !== 'number'){ depth++; try { draw(c); } finally { depth--; } return; }
  const [bx, by, bw, bh] = box, k = Math.min(3, Math.max(0.25, Math.hypot(m.a, m.b)));
  const w = Math.ceil(bw * k), h = Math.ceil(bh * k);
  const A = sheet(0, w, h), B = sheet(1, w, h);
  if (!A || !B){ depth++; try { draw(c); } finally { depth--; } return; }
  const a = A.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, w, h);
  a.setTransform(k, 0, 0, k, -bx * k, -by * k);
  depth++; try { draw(a); } finally { depth--; }
  a.save(); a.setTransform(k, 0, 0, k, -bx * k, -by * k); a.globalCompositeOperation = 'source-atop'; a.fillStyle = 'rgba(52,40,96,.2)';
  a.beginPath(); a.moveTo(line[0], by); a.lineTo(bx + bw, by); a.lineTo(bx + bw, by + bh); a.lineTo(line[1], by + bh); a.closePath(); a.fill(); a.restore();
  const sw = w / k, sh = h / k;
  if (S.rim){
    const b = B.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.drawImage(A, 0, 0, w, h, 0, 0, w, h);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = S.rim; b.fillRect(0, 0, w, h); b.globalCompositeOperation = 'source-over';
    c.drawImage(B, 0, 0, w, h, bx - rimOff, by - rimOff * 0.75, sw, sh);
  }
  c.drawImage(A, 0, 0, w, h, bx, by, sw, sh);
}

/* A random look ("Surprise me"). */
export function surprise(rand = Math.random){
  const o = {};
  for (const k of Object.keys(PARTS)) o[k] = PARTS[k][Math.floor(rand() * PARTS[k].length)];
  return o;
}

/* ---------- the head ---------- */
export function head(c, x, y, r, look, t = 0, opts = {}){
  cel(c, [x - r * 1.9, y - r * 1.8, r * 3.8, r * 3.3], [x + r * 0.5, x + r * 0.62], r * 0.07, (cc) => headFlat(cc, x, y, r, look, t, opts));
}
function headFlat(c, x, y, r, look, t, { back = false } = {}){
  const skin = pick(look, 'skin'), hc = pick(look, 'hairColor'), style = pick(look, 'hair');
  const lw = Math.max(1.5, r * 0.07) * (S.width || 1), fw = Math.max(1.5, r * 0.07);
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  /* seen from behind: the back of the head - their hair (and its ponytail,
     buns or length), ears, no face */
  if (back){
    c.strokeStyle = INK; c.lineWidth = lw;
    c.fillStyle = shaded(c, skin, 0, 0, r); for (const d of [-1, 1]){ circle(c, d * r * 0.96, r * 0.08, r * 0.2); c.fill(); edge(c); }
    c.fillStyle = style === 'none' ? shaded(c, skin, 0, 0, r) : shaded(c, hc, 0, 0, r);
    c.beginPath(); c.ellipse(0, 0, r, r * 0.97, 0, 0, Math.PI * 2); c.fill(); edge(c);
    c.fillStyle = hc;
    if (style === 'long' || style === 'bob'){ c.beginPath(); c.moveTo(-r * 1.0, 0); c.quadraticCurveTo(-r * 1.05, style === 'long' ? r * 1.2 : r * 0.75, 0, style === 'long' ? r * 1.25 : r * 0.8); c.quadraticCurveTo(r * 1.05, style === 'long' ? r * 1.2 : r * 0.75, r * 1.0, 0); c.closePath(); c.fill(); edge(c); }
    if (style === 'ponytail'){ const sw = Math.sin(t * 3) * r * 0.1; c.beginPath(); c.moveTo(-r * 0.22, r * 0.2); c.quadraticCurveTo(sw, r * 1.5, r * 0.22, r * 0.2); c.closePath(); c.fill(); edge(c); c.fillStyle = pick(look, 'color'); circle(c, 0, r * 0.22, r * 0.14); c.fill(); edge(c); }
    if (style === 'buns') for (const d of [-1, 1]){ c.fillStyle = hc; circle(c, d * r * 0.72, -r * 0.82, r * 0.36); c.fill(); edge(c); }
    if (style === 'curly') for (let k = 0; k < 11; k++){ const a = Math.PI * (0.95 + k * 0.11); c.fillStyle = hc; circle(c, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.85, r * 0.28); c.fill(); edge(c); }
    if (style !== 'none'){ c.strokeStyle = mix(hc, '#ffffff', 0.25); c.lineWidth = lw * 1.2; c.beginPath(); c.arc(-r * 0.1, -r * 0.1, r * 0.75, Math.PI * 1.2, Math.PI * 1.5); c.stroke(); }
    c.restore();
    return;
  }
  const hairDark = mix(hc, '#000000', 0.25), hairLite = mix(hc, '#ffffff', 0.25);

  /* hair behind the head */
  c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = lw;
  if (style === 'long'){ c.beginPath(); c.moveTo(-r * 1.02, -r * 0.2); c.quadraticCurveTo(-r * 1.15, r * 0.9, -r * 0.7, r * 1.15); c.lineTo(r * 0.7, r * 1.15); c.quadraticCurveTo(r * 1.15, r * 0.9, r * 1.02, -r * 0.2); c.closePath(); c.fill(); edge(c); }
  if (style === 'ponytail'){ const sw = Math.sin(t * 3) * r * 0.08; c.beginPath(); c.moveTo(r * 0.75, -r * 0.55); c.quadraticCurveTo(r * 1.55 + sw, -r * 0.2, r * 1.2 + sw, r * 0.75); c.quadraticCurveTo(r * 1.05, r * 0.2, r * 0.6, -r * 0.2); c.closePath(); c.fill(); edge(c); }
  if (style === 'bob'){ c.beginPath(); c.moveTo(-r * 1.05, -r * 0.1); c.quadraticCurveTo(-r * 1.12, r * 0.62, -r * 0.82, r * 0.7); c.lineTo(r * 0.82, r * 0.7); c.quadraticCurveTo(r * 1.12, r * 0.62, r * 1.05, -r * 0.1); c.closePath(); c.fill(); edge(c); }
  if (style === 'buns'){ for (const d of [-1, 1]){ circle(c, d * r * 0.72, -r * 0.82, r * 0.36); c.fill(); edge(c); } }

  /* ears and face: skin, lit from the left */
  let sk;
  if (S.shade === 'lit'){ sk = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r * 1.1); sk.addColorStop(0, mix(skin, '#ffffff', 0.18)); sk.addColorStop(0.7, skin); sk.addColorStop(1, mix(skin, '#3a1f10', 0.2)); }
  else sk = shaded(c, skin, 0, 0, r);
  c.fillStyle = sk;
  for (const d of [-1, 1]){ circle(c, d * r * 0.96, r * 0.08, r * 0.2); c.fill(); edge(c); }
  c.beginPath(); c.ellipse(0, 0, r, r * 0.97, 0, 0, Math.PI * 2); c.fill(); edge(c);
  /* cheeks */
  c.fillStyle = 'rgba(255,110,120,.28)'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(d * r * 0.52, r * 0.3, r * 0.17, r * 0.11, 0, 0, Math.PI * 2); c.fill(); }

  /* the face */
  const eyes = pick(look, 'eyes'), mouth = pick(look, 'mouth');
  const blink = (t % 4.2) > 4.05;
  c.fillStyle = S.feature; c.strokeStyle = S.feature; c.lineWidth = fw * 1.1;
  for (const d of [-1, 1]){
    const ex = d * r * 0.36, ey = -r * 0.02;
    if (blink || eyes === 'happy' || (eyes === 'wink' && d > 0)){ c.beginPath(); c.arc(ex, ey + r * 0.06, r * 0.13, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); continue; }
    const er = eyes === 'sparkle' ? r * 0.15 : r * 0.11;
    c.beginPath(); c.ellipse(ex, ey, er * 0.85, er, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; circle(c, ex - er * 0.3, ey - er * 0.35, er * 0.32); c.fill();
    if (eyes === 'sparkle'){ circle(c, ex + er * 0.3, ey + er * 0.3, er * 0.16); c.fill(); }
    c.fillStyle = S.feature;
  }
  /* brows */
  c.lineWidth = fw * 0.9; for (const d of [-1, 1]){ c.beginPath(); c.moveTo(d * r * 0.24, -r * 0.27); c.quadraticCurveTo(d * r * 0.36, -r * 0.34, d * r * 0.48, -r * 0.28); c.stroke(); }
  /* the mouth */
  c.lineWidth = fw * 1.1;
  if (mouth === 'smile'){ c.beginPath(); c.arc(0, r * 0.22, r * 0.22, Math.PI * 0.18, Math.PI * 0.82); c.stroke(); }
  else if (mouth === 'grin' || mouth === 'tongue'){
    c.fillStyle = '#7a1f2b'; c.beginPath(); c.moveTo(-r * 0.27, r * 0.3); c.quadraticCurveTo(0, r * 0.68, r * 0.27, r * 0.3); c.closePath(); c.fill(); edge(c);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-r * 0.22, r * 0.32); c.lineTo(r * 0.22, r * 0.32); c.lineTo(r * 0.18, r * 0.39); c.lineTo(-r * 0.18, r * 0.39); c.closePath(); c.fill();
    if (mouth === 'tongue'){ c.fillStyle = '#ff7b93'; c.beginPath(); c.ellipse(r * 0.05, r * 0.5, r * 0.11, r * 0.08, 0, 0, Math.PI * 2); c.fill(); }
  }
  else { c.fillStyle = '#7a1f2b'; c.beginPath(); c.ellipse(0, r * 0.42, r * 0.1, r * 0.13, 0, 0, Math.PI * 2); c.fill(); edge(c); }

  /* hair on top */
  c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = lw;
  const cap = () => { c.beginPath(); c.moveTo(-r * 1.0, -r * 0.05); c.bezierCurveTo(-r * 1.1, -r * 1.25, r * 1.1, -r * 1.25, r * 1.0, -r * 0.05); };
  if (style === 'short' || style === 'ponytail' || style === 'buns' || style === 'long' || style === 'bob'){
    cap(); c.quadraticCurveTo(r * 0.55, -r * 0.62, r * 0.1, -r * 0.5); c.quadraticCurveTo(-r * 0.45, -r * 0.42, -r * 1.0, -r * 0.05); c.closePath(); c.fill(); edge(c);
  } else if (style === 'curly'){
    for (let k = 0; k < 9; k++){ const a = Math.PI * (1.02 + k * 0.12); circle(c, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.82 - r * 0.08, r * 0.3); c.fill(); edge(c); }
    c.beginPath(); c.ellipse(0, -r * 0.62, r * 0.78, r * 0.32, 0, 0, Math.PI * 2); c.fill();
  } else if (style === 'spiky'){
    c.beginPath(); c.moveTo(-r * 1.0, -r * 0.1);
    for (let k = 0; k <= 8; k++){ const a = Math.PI * (1.12 + k * 0.76 / 8); const tip = k % 2 ? 1.32 : 0.95; c.lineTo(Math.cos(a) * r * tip, Math.sin(a) * r * tip - r * 0.05); }
    c.lineTo(r * 1.0, -r * 0.1); c.quadraticCurveTo(0, -r * 0.5, -r * 1.0, -r * 0.1); c.closePath(); c.fill(); edge(c);
  }
  /* a shine on the hair */
  if (style !== 'none'){ c.strokeStyle = hairLite; c.lineWidth = lw * 1.2; c.beginPath(); c.arc(-r * 0.15, -r * 0.2, r * 0.75, Math.PI * 1.25, Math.PI * 1.45); c.stroke(); }
  void hairDark;

  /* the extra */
  const extra = pick(look, 'extra'), fav = pick(look, 'color');
  c.strokeStyle = INK; c.lineWidth = lw;
  if (extra === 'cap'){
    c.fillStyle = fav; c.beginPath(); c.moveTo(-r * 0.98, -r * 0.3); c.bezierCurveTo(-r * 1.0, -r * 1.3, r * 1.0, -r * 1.3, r * 0.98, -r * 0.3); c.closePath(); c.fill(); edge(c);
    c.fillStyle = mix(fav, '#000000', 0.2); c.beginPath(); c.ellipse(r * 0.55, -r * 0.3, r * 0.75, r * 0.16, -0.08, 0, Math.PI * 2); c.fill(); edge(c);
    c.fillStyle = '#fff'; circle(c, 0, -r * 1.02, r * 0.1); c.fill();
  } else if (extra === 'bow'){
    c.fillStyle = fav; for (const d of [-1, 1]){ c.beginPath(); c.moveTo(r * 0.55, -r * 0.82); c.lineTo(r * 0.55 + d * r * 0.4, -r * 1.05); c.lineTo(r * 0.55 + d * r * 0.4, -r * 0.6); c.closePath(); c.fill(); edge(c); }
    circle(c, r * 0.55, -r * 0.82, r * 0.12); c.fill(); edge(c);
  } else if (extra === 'glasses'){
    c.strokeStyle = S.feature; c.lineWidth = fw * 1.2; c.fillStyle = 'rgba(200,235,255,.35)';
    for (const d of [-1, 1]){ circle(c, d * r * 0.36, -r * 0.02, r * 0.22); c.fill(); edge(c); }
    c.beginPath(); c.moveTo(-r * 0.14, -r * 0.04); c.lineTo(r * 0.14, -r * 0.04); c.stroke();
  } else if (extra === 'headphones'){
    c.strokeStyle = INK; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, -r * 0.05, r * 1.08, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.strokeStyle = fav; c.lineWidth = r * 0.1; c.stroke();
    c.lineWidth = lw; c.strokeStyle = INK; c.fillStyle = fav;
    for (const d of [-1, 1]){ c.beginPath(); c.ellipse(d * r * 1.02, r * 0.05, r * 0.22, r * 0.32, 0, 0, Math.PI * 2); c.fill(); edge(c); }
  } else if (extra === 'crown'){
    c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(-r * 0.55, -r * 0.82); c.lineTo(-r * 0.6, -r * 1.35); c.lineTo(-r * 0.3, -r * 1.08); c.lineTo(0, -r * 1.45); c.lineTo(r * 0.3, -r * 1.08); c.lineTo(r * 0.6, -r * 1.35); c.lineTo(r * 0.55, -r * 0.82); c.closePath(); c.fill(); edge(c);
    c.fillStyle = fav; circle(c, 0, -r * 0.98, r * 0.09); c.fill();
  } else if (extra === 'flower'){
    c.fillStyle = fav; for (let k = 0; k < 5; k++){ const a = k / 5 * Math.PI * 2 + t * 0.5; circle(c, r * 0.62 + Math.cos(a) * r * 0.18, -r * 0.72 + Math.sin(a) * r * 0.18, r * 0.14); c.fill(); edge(c); }
    c.fillStyle = '#fde047'; circle(c, r * 0.62, -r * 0.72, r * 0.1); c.fill();
  }
  c.restore();
}

/* ---------- the whole avatar, standing ---------- */
/* opts: { costume: 'space' (a space suit in their colour, a glass helmet),
   back: true (seen from behind) } */
export function body(c, x, base, h, look, t = 0, pose = 'stand', opts = {}){
  const u = h / 300;
  /* their shadow on the ground (outside the cel pass: no rim on it) */
  c.fillStyle = 'rgba(20,15,45,.22)'; c.beginPath(); c.ellipse(x, base, 60 * u, 12 * u, 0, 0, Math.PI * 2); c.fill();
  cel(c, [x - 160 * u, base - 400 * u, 320 * u, 425 * u], [x + 33 * u, x + 42 * u], h * 0.012, (cc) => bodyFlat(cc, x, base, h, look, t, pose, opts));
}
function bodyFlat(c, x, base, h, look, t, pose, { costume = null, back = false } = {}){
  const u = h / 300, fav = pick(look, 'color'), space = costume === 'space';
  const skin = pick(look, 'skin'), outfit = space ? 'plain' : pick(look, 'outfit');
  const lite = mix(fav, '#ffffff', 0.3), dark = mix(fav, '#000000', 0.3);
  const lw = Math.max(1.5, 5 * u) * (S.width || 1);
  c.save(); c.translate(x, base); c.lineJoin = 'round'; c.lineCap = 'round';
  const limb = (pts, w, col) => {
    for (const [ww, sc] of (S.outline ? [[w + lw * 2, S.outline], [w, col]] : [[w, col]])){ c.strokeStyle = sc; c.lineWidth = ww; c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a * u, b * u) : c.moveTo(a * u, b * u))); c.stroke(); }
  };
  const bob = Math.sin(t * 3) * 2;
  /* legs and shoes */
  for (const d of [-1, 1]){ limb([[d * 18, -105], [d * 20, -20]], 26 * u, space ? fav : mix('#3b4a6b', fav, 0.15)); c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.ellipse(d * 24 * u, -12 * u, 22 * u, 13 * u, 0, 0, Math.PI * 2); c.fill(); edge(c); c.fillStyle = fav; c.beginPath(); c.ellipse(d * 24 * u, -8 * u, 20 * u, 6 * u, 0, 0, Math.PI); c.fill(); }
  /* arms */
  const arms = {
    stand: (d) => [[d * 44, -200], [d * 56, -150], [d * 54, -112]],
    wave: (d) => d < 0 ? [[-44, -200], [-82, -228], [-96 + Math.sin(t * 10) * 10, -278]] : [[44, -200], [56, -150], [54, -112]],
    cheer: (d) => [[d * 44, -200], [d * 78, -238], [d * 92, -290]],
    reach: (d) => [[d * 44, -200], [d * 60, -250], [d * 66, -305]]
  }[pose] || ((d) => [[d * 44, -200], [d * 56, -150], [d * 54, -112]]);
  for (const d of [-1, 1]){ const a = arms(d); limb(a, 24 * u, outfit === 'hoodie' || space ? fav : skin); c.fillStyle = space ? '#ffffff' : skin; c.strokeStyle = INK; c.lineWidth = lw; circle(c, a[2][0] * u, a[2][1] * u, 15 * u); c.fill(); edge(c); if (outfit !== 'hoodie'){ limb(a.slice(0, 2), 26 * u, fav); } }
  /* the body: a rounded top in their colour, lit from the left */
  const g = shaded(c, fav, 0, -155 * u, 60 * u);
  c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = lw;
  c.beginPath(); c.moveTo(-46 * u, -208 * u + bob); c.quadraticCurveTo(0, -220 * u + bob, 46 * u, -208 * u + bob); c.quadraticCurveTo(58 * u, -150 * u, 44 * u, -98 * u); c.quadraticCurveTo(0, -88 * u, -44 * u, -98 * u); c.quadraticCurveTo(-58 * u, -150 * u, -46 * u, -208 * u + bob); c.closePath(); c.fill(); edge(c);
  c.save(); c.clip();
  if (outfit === 'stripes'){ c.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 5; k++) c.fillRect(-70 * u, (-196 + k * 22) * u, 140 * u, 9 * u); }
  if (outfit === 'dots'){ c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = -2; i <= 2; i++) for (let j = 0; j < 5; j++) { circle(c, (i * 24 + (j % 2) * 12) * u, (-195 + j * 22) * u, 5 * u); c.fill(); } }
  if (outfit === 'stars'){ c.fillStyle = 'rgba(255,255,255,.9)'; const st = (sx, sy, s) => { c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.45 : s; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } c.closePath(); c.fill(); }; st(0, -158 * u, 18 * u); }
  if (outfit === 'hoodie'){ c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-26 * u, -140 * u, 52 * u, 30 * u); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3 * u; for (const d of [-1, 1]){ c.beginPath(); c.moveTo(d * 10 * u, -205 * u); c.lineTo(d * 12 * u, -170 * u); c.stroke(); } }
  c.restore();
  if (space){
    /* the suit: a belt, and a glowing badge on the chest (a pack, from behind) */
    c.fillStyle = mix(fav, '#000000', 0.35); c.fillRect(-46 * u, -116 * u, 92 * u, 12 * u);
    if (back){ c.fillStyle = mix(fav, '#000000', 0.25); c.beginPath(); c.roundRect(-30 * u, -200 * u, 60 * u, 74 * u, 14 * u); c.fill(); edge(c); c.fillStyle = '#ffffff'; c.fillRect(-14 * u, -186 * u, 28 * u, 8 * u); }
    else { c.fillStyle = '#ffffff'; circle(c, 0, -170 * u, 13 * u); c.fill(); edge(c); c.fillStyle = mix(fav, '#ffffff', 0.4); circle(c, 0, -170 * u, 7 * u); c.fill(); }
  }
  if (outfit === 'hoodie'){ c.fillStyle = dark; c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.ellipse(0, -210 * u + bob, 50 * u, 16 * u, 0, 0, Math.PI * 2); c.fill(); edge(c); }
  /* the head - in a glass helmet, in space */
  const hy = -258 * u + bob;
  head(c, 0, hy, 52 * u, space ? { ...look, extra: look.extra === 'glasses' ? 'glasses' : 'none' } : look, t, { back });
  if (space){
    c.strokeStyle = INK; c.lineWidth = lw;
    c.fillStyle = 'rgba(190,235,255,.28)'; circle(c, 0, hy + 4 * u, 78 * u); c.fill(); edge(c);
    c.strokeStyle = '#ffffff'; c.lineWidth = 7 * u; c.beginPath(); c.arc(0, hy + 4 * u, 66 * u, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
    c.fillStyle = fav; c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.ellipse(0, hy + 76 * u, 60 * u, 13 * u, 0, 0, Math.PI * 2); c.fill(); edge(c);
    c.lineWidth = 5 * u; c.strokeStyle = INK; c.beginPath(); c.moveTo(44 * u, hy - 58 * u); c.lineTo(58 * u, hy - 100 * u); c.stroke();
    c.fillStyle = fav; c.lineWidth = lw; circle(c, 58 * u, hy - 104 * u, 10 * u); c.fill(); edge(c);
  }
  c.restore();
}

/* ---------- a portrait: for tiles and name chips ---------- */
export function portrait(c, x, y, s, look, t = 0){
  const fav = pick(look, 'color');
  c.save();
  const r = s * 0.22;
  c.beginPath(); c.roundRect(x - s / 2, y - s / 2, s, s, r);
  let g = mix(fav, '#ffffff', 0.3);
  if (S.shade !== 'cel'){ g = c.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2); g.addColorStop(0, mix(fav, '#ffffff', 0.35)); g.addColorStop(1, fav); }
  c.fillStyle = g; c.fill(); c.clip();
  /* shoulders, then the head */
  c.fillStyle = mix(fav, '#000000', 0.18); c.beginPath(); c.ellipse(x, y + s * 0.55, s * 0.36, s * 0.22, 0, 0, Math.PI * 2); c.fill();
  head(c, x, y + s * 0.05, s * 0.3, look, t);
  c.restore();
}

/* ---------- the avatar as a player: posed by the camera ----------
   The whole avatar drawn on a player's body as the camera sees it - arms
   where their arms are, head where their head is, leaning as they lean -
   so a child sees themselves as their avatar, like a mirror. lm: the
   pose landmarks (0..1, mirrored); lift: how far up to draw them (px). */
const NOSE = 0, L_EYE = 2, R_EYE = 5, L_EAR = 7, R_EAR = 8, L_SH = 11, R_SH = 12, L_EL = 13, R_EL = 14,
  L_WR = 15, R_WR = 16, L_HIP = 23, R_HIP = 24, L_KN = 25, R_KN = 26, L_AN = 27, R_AN = 28;
export function figure(c, lm, W, H, look, t = 0, { lift = 0 } = {}){
  if (!lm || !lm[L_SH] || !lm[R_SH]) return;
  const P = (i) => [lm[i].x * W, lm[i].y * H - lift];
  const seen = (i) => lm[i] && (lm[i].v ?? lm[i].visibility ?? 1) > 0.3;
  const ls = P(L_SH), rs = P(R_SH);
  const sw = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]);
  if (sw < 6) return;
  /* (chunkier than a real body: a bigger head, thicker arms and legs - the
     avatars' own toddler-toy shape - with the hands still where theirs are) */
  const u = sw / 88, r = 64 * u;
  /* the head: between the ears (or at the nose), tilted with the eyes */
  const nose = P(NOSE), ears = seen(L_EAR) && seen(R_EAR) ? [P(L_EAR), P(R_EAR)] : null;
  const hx = ears ? (ears[0][0] + ears[1][0]) / 2 : nose[0], hy = (ears ? (ears[0][1] + ears[1][1]) / 2 : nose[1]) - r * 0.12;
  const tilt = seen(L_EYE) && seen(R_EYE) ? Math.atan2(P(R_EYE)[1] - P(L_EYE)[1], P(R_EYE)[0] - P(L_EYE)[0]) : 0;
  const tip = Math.abs(tilt) > Math.PI / 2 ? tilt - Math.sign(tilt) * Math.PI : tilt;
  /* the box everything is in, for the cel pass */
  const pts = [ls, rs, [hx, hy]];
  for (const i of [L_EL, R_EL, L_WR, R_WR, L_HIP, R_HIP, L_KN, R_KN, L_AN, R_AN]) if (seen(i)) pts.push(P(i));
  const pad = r * 2.2;
  const x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad;
  const y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
  const cx = (ls[0] + rs[0]) / 2;
  cel(c, [x0, y0, x1 - x0, y1 - y0], [cx + sw * 0.18, cx + sw * 0.28], r * 0.07, (cc) => figureFlat(cc, P, seen, u, r, hx, hy, tip, look, t));
}
function figureFlat(c, P, seen, u, r, hx, hy, tilt, look, t){
  const fav = pick(look, 'color'), skin = pick(look, 'skin'), legs = mix('#3b4a6b', fav, 0.15);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const line = (pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
  const ls = P(L_SH), rs = P(R_SH);
  /* hips: as seen, or a torso's length under the shoulders */
  const down = (p, by) => [p[0], p[1] + by];
  const lh = seen(L_HIP) ? P(L_HIP) : down(ls, 120 * u), rh = seen(R_HIP) ? P(R_HIP) : down(rs, 120 * u);
  /* legs: hip, knee, ankle, as far as the camera sees them */
  for (const [h, k, a] of [[lh, L_KN, L_AN], [rh, R_KN, R_AN]]){
    const leg = [h]; if (seen(k)) { leg.push(P(k)); if (seen(a)) leg.push(P(a)); } else leg.push(down(h, 90 * u));
    line(leg, 34 * u, legs);
    const foot = leg[leg.length - 1];
    if (leg.length === 3){ c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(foot[0], foot[1] + 6 * u, 22 * u, 13 * u, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = fav; c.beginPath(); c.ellipse(foot[0], foot[1] + 10 * u, 20 * u, 6 * u, 0, 0, Math.PI); c.fill(); }
  }
  /* the neck, then the body: shoulders to hips, rounded off */
  line([[(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2], [hx, hy + r * 0.6]], 22 * u, skin);
  c.fillStyle = fav; c.strokeStyle = fav; c.lineWidth = 46 * u;
  c.beginPath(); c.moveTo(ls[0], ls[1]); c.lineTo(rs[0], rs[1]); c.lineTo(rh[0], rh[1]); c.lineTo(lh[0], lh[1]); c.closePath(); c.fill(); c.stroke();
  const outfit = pick(look, 'outfit');
  if (outfit !== 'plain'){
    c.save(); c.clip();
    const mx = (ls[0] + rs[0] + lh[0] + rh[0]) / 4, my = (ls[1] + rs[1] + lh[1] + rh[1]) / 4;
    if (outfit === 'stripes'){ c.fillStyle = 'rgba(255,255,255,.45)'; for (let k = -2; k <= 2; k++) c.fillRect(mx - 120 * u, my + k * 22 * u - 4 * u, 240 * u, 9 * u); }
    if (outfit === 'stars'){ c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? 8 * u : 18 * u; c.lineTo(mx + Math.cos(a) * q, my - 8 * u + Math.sin(a) * q); } c.closePath(); c.fill(); }
    if (outfit === 'dots'){ c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++){ c.beginPath(); c.arc(mx + (i * 24 + (j % 2) * 12) * u, my + j * 22 * u, 5 * u, 0, Math.PI * 2); c.fill(); } }
    if (outfit === 'hoodie'){ c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(mx - 26 * u, my + 6 * u, 52 * u, 30 * u); }
    c.restore();
  }
  /* arms: a sleeve to the elbow, then the forearm, then the hand */
  for (const [s, e, w] of [[ls, L_EL, L_WR], [rs, R_EL, R_WR]]){
    if (!seen(e)) { line([s, down(s, 80 * u)], 32 * u, fav); continue; }
    const el = P(e);
    if (seen(w)){ const wr = P(w); line([el, wr], 28 * u, skin); c.fillStyle = skin; c.beginPath(); c.arc(wr[0], wr[1], 19 * u, 0, Math.PI * 2); c.fill(); }
    line([s, el], 32 * u, fav);
  }
  /* the head, tilted as theirs is */
  c.translate(hx, hy); c.rotate(tilt * 0.8);
  head(c, 0, 0, r, look, t);
  c.restore();
}
