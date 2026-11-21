/* Orlis avatars (decision 0042): every child is the same little cube character - the same cube head (rounded corners, a light top edge,
   a shaded side), one body with stubby arms and legs, a painted face, the thin paper edge and a soft shadow. A child chooses only five
   things (see look.js): their colour (a favourite, which is also their player colour), their face, something on top (hair pieces too),
   an outfit with a second colour, and one extra. Cubo is the blue one with the default face.

   Colours are palette names (0040) and the shade and highlight come from the base by rule (0041): shade toward the palette's purple-grey,
   light toward white, so nothing here picks a shade by hand and nothing is a raw colour code.

     head(c, x, y, r, look, t, opts)        the cube head, centred at (x, y), r = half its width; opts.back: seen from behind (no face)
     body(c, x, base, h, look, t, pose)     the whole character standing, feet at (x, base), h tall; pose: 'stand', 'wave', 'cheer', 'reach'
     portrait(c, x, y, s, look, t)          a head on a rounded tile, for name chips and tiles
     figure(c, lm, W, H, look, t, opts)     the character drawn over a player's tracked body (arms where theirs are, head tilting with theirs)
     surprise(rand)                         a random look
   `look` may be any look that was ever stored (look.js carries old ones over) or null (Cubo). */
import { color, alpha } from '../games/assets/palette.js';
import { PARTS, normalizeLook, surprise as randomLook } from './look.js';

export { PARTS };
export const surprise = randomLook;
/* (kept so older callers compile: there is one style now) */
export function setStyle(){}

/* ---------- the colours of one look ---------- */
const cache = new WeakMap();
function resolve(look){
  const key = look && typeof look === 'object' ? look : null;
  const hit = key && cache.get(key); if (hit) return hit;
  const L = normalizeLook(look), c = color('fav.' + L.colour), c2 = color(L.outfitColour), white = L.outfitColour === 'shade.card';
  const a = {
    c, c2, c2n: L.outfitColour, t2n: white ? 'ui.go' : L.outfitColour, white, eyes: L.face.eyes, mouth: L.face.mouth, top: L.top, fit: L.outfit, extra: L.extra,
    shade: color('fav.' + L.colour, 'shade'), light: color('fav.' + L.colour, 'light'),
    /* the second colour for things that must not vanish into a white body (hats, a scarf, a cape) */
    t2: white ? color('ui.go') : c2
  };
  if (key) cache.set(key, a);
  return a;
}
const INK = () => color('shade.ink');

const rr = (x, a, b, w, h, q) => { x.beginPath(); x.moveTo(a + q, b); x.arcTo(a + w, b, a + w, b + h, q); x.arcTo(a + w, b + h, a, b + h, q); x.arcTo(a, b + h, a, b, q); x.arcTo(a, b, a + w, b, q); x.closePath(); };
const dot = (x, px, py, r) => { x.beginPath(); x.arc(px, py, Math.max(0.1, r), 0, Math.PI * 2); };
const line = (x, pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); };

/* ---------- the head: origin at the middle of its top edge; S is the character's height ---------- */
function drawHead(x, a, S, back, t){
  const c = a.c, hw = S * 0.46, hh = S * 0.42, hx = -hw / 2, hy = 0, q = hw * 0.2, ink = INK();
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  /* the cube: base, a light top edge, a shaded side, the thin ink edge */
  x.fillStyle = c; rr(x, hx, hy, hw, hh, q); x.fill();
  x.save(); rr(x, hx, hy, hw, hh, q); x.clip();
  x.fillStyle = a.light; x.fillRect(hx, hy, hw, hh * 0.14);
  x.fillStyle = a.shade; x.fillRect(hx + hw * 0.8, hy, hw * 0.2, hh);
  x.restore();
  x.strokeStyle = ink; x.lineWidth = S * 0.016; rr(x, hx, hy, hw, hh, q); x.stroke();
  const blink = (t % 4.3) > 4.18;

  if (!back){
    /* the face: always the same painted style */
    const fy = hy + hh * 0.52, ex = hw * 0.19, er = S * 0.026;
    x.fillStyle = ink; x.strokeStyle = ink; x.lineWidth = S * 0.014;
    [-1, 1].forEach((s) => {
      const cx = s * ex - hw * 0.04;
      if (blink && a.eyes !== 'happy' && a.eyes !== 'sleepy'){ x.beginPath(); x.moveTo(cx - er, fy); x.lineTo(cx + er, fy); x.stroke(); return; }
      if (a.eyes === 'dot'){ x.beginPath(); x.ellipse(cx, fy, er * 0.8, er * 1.1, 0, 0, 7); x.fill(); }
      if (a.eyes === 'wide'){ x.beginPath(); x.ellipse(cx, fy, er, er * 1.3, 0, 0, 7); x.fill(); x.fillStyle = color('earth.snow'); dot(x, cx + er * 0.3, fy - er * 0.4, er * 0.35); x.fill(); x.fillStyle = ink; }
      if (a.eyes === 'happy' || (a.eyes === 'wink' && s > 0)){ x.beginPath(); x.arc(cx, fy + er * 0.5, er, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
      if (a.eyes === 'wink' && s < 0){ x.beginPath(); x.ellipse(cx, fy, er * 0.8, er * 1.1, 0, 0, 7); x.fill(); }
      if (a.eyes === 'sleepy'){ x.beginPath(); x.moveTo(cx - er, fy); x.lineTo(cx + er, fy); x.stroke(); }
      if (a.eyes === 'star'){ x.beginPath(); for (let k = 0; k < 10; k++){ const an = -Math.PI / 2 + k * Math.PI / 5, R = k % 2 ? er * 0.5 : er * 1.2; x.lineTo(cx + Math.cos(an) * R, fy + Math.sin(an) * R); } x.closePath(); x.fill(); }
    });
    const my = fy + hh * 0.22, mx = -hw * 0.04;
    if (a.mouth === 'smile'){ x.beginPath(); x.arc(mx, my - S * 0.02, S * 0.035, Math.PI * 0.2, Math.PI * 0.8); x.stroke(); }
    if (a.mouth === 'grin'){ x.beginPath(); x.moveTo(mx - S * 0.045, my - S * 0.01); x.quadraticCurveTo(mx, my + S * 0.05, mx + S * 0.045, my - S * 0.01); x.closePath(); x.fill(); }
    if (a.mouth === 'o'){ x.beginPath(); x.ellipse(mx, my, S * 0.014, S * 0.02, 0, 0, 7); x.fill(); }
    if (a.mouth === 'cat'){ x.beginPath(); x.arc(mx - S * 0.015, my - S * 0.01, S * 0.015, 0, Math.PI); x.arc(mx + S * 0.015, my - S * 0.01, S * 0.015, 0, Math.PI); x.stroke(); }
    if (a.mouth === 'tongue'){ x.beginPath(); x.arc(mx, my - S * 0.02, S * 0.035, Math.PI * 0.2, Math.PI * 0.8); x.stroke(); x.fillStyle = color('touch.bubblegum', 'light'); x.beginPath(); x.ellipse(mx + S * 0.006, my + S * 0.015, S * 0.012, S * 0.014, 0, 0, 7); x.fill(); }
    if (a.extra === 'cheeks' || a.extra === 'freckles'){
      x.fillStyle = a.extra === 'cheeks' ? alpha('touch.bubblegum', 0.45) : a.shade;
      [-1, 1].forEach((s) => {
        if (a.extra === 'cheeks'){ x.beginPath(); x.ellipse(s * hw * 0.3 - hw * 0.04, my - S * 0.015, S * 0.028, S * 0.016, 0, 0, 7); x.fill(); }
        else for (let k = 0; k < 3; k++){ x.beginPath(); x.arc(s * hw * 0.3 - hw * 0.04 + (k - 1) * S * 0.014, my - S * 0.02 + (k % 2) * S * 0.008, S * 0.006, 0, 7); x.fill(); }
      });
    }
    if (a.extra === 'glasses'){ x.strokeStyle = ink; x.lineWidth = S * 0.012; [-1, 1].forEach((s) => { x.beginPath(); x.arc(s * ex - hw * 0.04, fy, S * 0.045, 0, 7); x.stroke(); }); x.beginPath(); x.moveTo(-ex + S * 0.045 - hw * 0.04, fy); x.lineTo(ex - S * 0.045 - hw * 0.04, fy); x.stroke(); }
  }

  /* on top: hair pieces (a tuft, a bob) and hats */
  const t2 = a.t2, t2s = toneT(a, 'shade'), t2l = toneT(a, 'light');
  if (a.top === 'tuft'){ x.fillStyle = a.shade; x.beginPath(); x.moveTo(-S * 0.04, hy + S * 0.01); x.quadraticCurveTo(-S * 0.02, hy - S * 0.09, S * 0.05, hy - S * 0.07); x.quadraticCurveTo(S * 0.01, hy - S * 0.03, S * 0.04, hy + S * 0.01); x.closePath(); x.fill(); }
  if (a.top === 'bob'){ x.fillStyle = t2s; rr(x, hx - S * 0.02, hy - S * 0.03, hw + S * 0.04, hh * 0.35, q); x.fill(); rr(x, hx - S * 0.02, hy, S * 0.06, hh * 0.75, S * 0.03); x.fill(); rr(x, hx + hw - S * 0.04, hy, S * 0.06, hh * 0.75, S * 0.03); x.fill(); }
  if (a.top === 'cap'){ x.fillStyle = t2; rr(x, hx - S * 0.01, hy - S * 0.05, hw + S * 0.02, S * 0.1, S * 0.05); x.fill(); x.fillStyle = t2s; rr(x, hx + hw * 0.45, hy + S * 0.025, hw * 0.7, S * 0.035, S * 0.02); x.fill(); }
  if (a.top === 'beanie'){ x.fillStyle = t2; rr(x, hx - S * 0.01, hy - S * 0.07, hw + S * 0.02, S * 0.12, S * 0.06); x.fill(); x.fillStyle = t2l; dot(x, 0, hy - S * 0.08, S * 0.035); x.fill(); x.fillStyle = t2s; x.fillRect(hx - S * 0.01, hy + S * 0.02, hw + S * 0.02, S * 0.03); }
  if (a.top === 'bow'){ x.fillStyle = t2; x.beginPath(); x.moveTo(hw * 0.25, hy - S * 0.01); x.lineTo(hw * 0.05, hy - S * 0.07); x.lineTo(hw * 0.05, hy + S * 0.05); x.closePath(); x.fill(); x.beginPath(); x.moveTo(hw * 0.25, hy - S * 0.01); x.lineTo(hw * 0.45, hy - S * 0.07); x.lineTo(hw * 0.45, hy + S * 0.05); x.closePath(); x.fill(); x.fillStyle = t2s; dot(x, hw * 0.25, hy - S * 0.01, S * 0.02); x.fill(); }
  if (a.top === 'crown'){ x.fillStyle = color('ui.gold'); x.beginPath(); x.moveTo(-hw * 0.3, hy + S * 0.01); x.lineTo(-hw * 0.3, hy - S * 0.07); x.lineTo(-hw * 0.15, hy - S * 0.03); x.lineTo(0, hy - S * 0.09); x.lineTo(hw * 0.15, hy - S * 0.03); x.lineTo(hw * 0.3, hy - S * 0.07); x.lineTo(hw * 0.3, hy + S * 0.01); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = S * 0.008; x.stroke(); }
  if (a.top === 'phones'){ x.strokeStyle = t2; x.lineWidth = S * 0.025; x.beginPath(); x.arc(0, hy + hh * 0.3, hw * 0.58, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); x.fillStyle = t2; rr(x, hx - S * 0.035, hy + hh * 0.3, S * 0.05, S * 0.1, S * 0.02); x.fill(); rr(x, hx + hw - S * 0.015, hy + hh * 0.3, S * 0.05, S * 0.1, S * 0.02); x.fill(); }
  if (a.top === 'ears'){ x.fillStyle = c; [-1, 1].forEach((s) => { rr(x, s * hw * 0.22 - S * 0.03, hy - S * 0.16, S * 0.06, S * 0.18, S * 0.03); x.fill(); }); x.fillStyle = a.light; [-1, 1].forEach((s) => { rr(x, s * hw * 0.22 - S * 0.015, hy - S * 0.14, S * 0.03, S * 0.12, S * 0.015); x.fill(); }); }
  if (a.top === 'flower'){ x.fillStyle = color('shade.card'); for (let k = 0; k < 5; k++){ const an = k / 5 * 6.283; x.beginPath(); x.arc(hw * 0.3 + Math.cos(an) * S * 0.028, hy - S * 0.01 + Math.sin(an) * S * 0.028, S * 0.022, 0, 7); x.fill(); } x.fillStyle = color('ui.gold'); x.beginPath(); x.arc(hw * 0.3, hy - S * 0.01, S * 0.018, 0, 7); x.fill(); }
  x.restore();
}
/* the look's second colour in a tone: as it is (the hoodie, the overalls), or toneT for what must not vanish into a white body (hats, cape) */
const toneRaw = (a, which) => color(a.c2n, which);
const toneT = (a, which) => color(a.t2n, which);

/* ---------- the body parts, in the character's own proportions ---------- */
const SIZE = (S) => ({ hw: S * 0.46, hh: S * 0.42, bw: S * 0.34, bh: S * 0.27 });

/* the torso: origin at the middle of its top edge, bw wide, bh tall (it stretches to a player's real body in figure) */
function drawTorso(x, a, S, bw, bh){
  const c = a.c;
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  x.fillStyle = a.fit === 'plain' || a.fit === 'overalls' ? c : a.c2; rr(x, -bw / 2, 0, bw, bh, S * 0.05); x.fill();
  x.save(); rr(x, -bw / 2, 0, bw, bh, S * 0.05); x.clip();
  if (a.fit === 'stripes'){ x.fillStyle = c; for (let k = 0; k < 4; k++) x.fillRect(-bw / 2, bh * (k * 0.26 + 0.06), bw, bh * 0.12); }
  if (a.fit === 'dots'){ x.fillStyle = c; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++){ x.beginPath(); x.arc(-bw * 0.3 + i * bw * 0.3 + (j % 2) * bw * 0.08, bh * (0.2 + j * 0.3), S * 0.018, 0, 7); x.fill(); } }
  if (a.fit === 'stars'){ x.fillStyle = c; const r = S * 0.055; x.beginPath(); for (let k = 0; k < 10; k++){ const an = -Math.PI / 2 + k * Math.PI / 5, R = k % 2 ? r * 0.45 : r; x.lineTo(Math.cos(an) * R, bh * 0.45 + Math.sin(an) * R); } x.closePath(); x.fill(); }
  if (a.fit === 'overalls'){ x.fillStyle = a.c2; x.fillRect(-bw / 2, bh * 0.45, bw, bh); x.fillRect(-bw * 0.32, 0, bw * 0.14, bh * 0.5); x.fillRect(bw * 0.18, 0, bw * 0.14, bh * 0.5); }
  if (a.fit === 'hoodie'){ x.fillStyle = toneRaw(a, 'shade'); x.fillRect(-bw * 0.22, bh * 0.55, bw * 0.44, bh * 0.3); }
  x.fillStyle = alpha('shade.shadow', 0.18); x.fillRect(bw * 0.18, 0, bw * 0.4, bh);
  x.restore();
  if (a.extra === 'scarf'){ x.fillStyle = a.c2 === c ? color('ui.gold') : a.t2; rr(x, -bw * 0.55, -S * 0.01, bw * 1.1, S * 0.05, S * 0.025); x.fill(); rr(x, bw * 0.1, S * 0.02, S * 0.05, S * 0.1, S * 0.02); x.fill(); }
  x.restore();
}
/* the cape: behind everything, hanging from the shoulders (origin: middle of the torso's top edge) */
function drawCape(x, a, S, bw, bh){
  if (a.extra !== 'cape') return;
  x.fillStyle = toneT(a, 'shade'); x.beginPath(); x.moveTo(-bw * 0.55, S * 0.02); x.lineTo(bw * 0.55, S * 0.02); x.lineTo(bw * 0.8, bh * 1.35); x.lineTo(-bw * 0.8, bh * 1.35); x.closePath(); x.fill();
}
/* a leg: points down from the hip; the foot is an ink pill */
function drawLeg(x, a, S, pts, thick = false){
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  line(x, pts, S * (thick ? 0.16 : 0.11), a.fit === 'overalls' ? toneRaw(a, 'shade') : a.shade);
  x.restore();
}
function drawFoot(x, S, px, py, big = false){ const k = big ? 1.4 : 1; x.fillStyle = INK(); rr(x, px - S * 0.06 * k, py - S * 0.045 * k, S * 0.12 * k, S * 0.045 * k, S * 0.02); x.fill(); }
/* an arm: a sleeve along the points, a hand at the end; the left one is in shade */
function drawArm(x, a, S, pts, left, thick = false){
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  const sleeve = a.fit === 'hoodie' ? a.c2 : a.c;
  line(x, pts, S * (thick ? 0.13 : 0.08), left ? (a.fit === 'hoodie' ? toneRaw(a, 'shade') : a.shade) : sleeve);
  x.fillStyle = a.light; const e = pts[pts.length - 1]; dot(x, e[0], e[1], S * (thick ? 0.062 : 0.038)); x.fill();
  x.restore();
}

/* ---------- the paper cut: the thin paper edge and a soft shadow around everything drawn ----------
   The figure is drawn flat into a scratch canvas; a cream copy of its shape is laid down at eight small offsets (the edge), the first with
   a soft shadow; then the figure on top. Only the outermost call does it (a body's head is part of the body). */
let depth = 0;
const scratch = [null, null];
function sheet(i, w, h){
  if (!scratch[i]){ if (typeof document === 'undefined') return null; scratch[i] = document.createElement('canvas'); }
  const cv = scratch[i]; if (cv.width < w) cv.width = w; if (cv.height < h) cv.height = h;
  return cv;
}
function plain(c, draw){ depth++; try { draw(c); } finally { depth--; } }
function paper(c, box, S, draw){
  const m = depth === 0 && c.getTransform ? c.getTransform() : null;
  if (!m || typeof m.a !== 'number') return plain(c, draw);
  const sc = Math.hypot(m.a, m.b) || 1, k = Math.min(3, Math.max(0.25, sc)), e = S * 0.009, pad = e + S * 0.06;
  const bx = box[0] - pad, by = box[1] - pad, w = Math.ceil((box[2] + pad * 2) * k), h = Math.ceil((box[3] + pad * 2) * k);
  const A = sheet(0, w, h), B = sheet(1, w, h);
  if (!A || !B || !A.getContext) return plain(c, draw);
  const a = A.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, A.width, A.height);
  a.setTransform(k, 0, 0, k, -bx * k, -by * k);
  plain(a, draw);
  const b = B.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.drawImage(A, 0, 0, w, h, 0, 0, w, h);
  b.globalCompositeOperation = 'source-in'; b.fillStyle = color('shade.card'); b.fillRect(0, 0, w, h); b.globalCompositeOperation = 'source-over';
  const sw = w / k, sh = h / k;
  c.save();
  for (let i = 0; i < 8; i++){
    const an = i / 8 * Math.PI * 2;
    if (i === 0){ c.shadowColor = alpha('shade.shadow', 0.26); c.shadowBlur = S * 0.014 * sc; c.shadowOffsetX = S * 0.04 * sc; c.shadowOffsetY = S * 0.04 * sc; }
    else { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
    c.drawImage(B, 0, 0, w, h, bx + Math.cos(an) * e, by + Math.sin(an) * e, sw, sh);
  }
  c.restore();
  c.drawImage(A, 0, 0, w, h, bx, by, sw, sh);
}

/* ---------- the head ---------- */
export function head(c, x, y, r, look, t = 0, { back = false } = {}){
  const a = resolve(look), S = r * 2 / 0.46, { hw, hh } = SIZE(S);
  c.save(); c.translate(x, y - hh / 2);
  paper(c, [-hw / 2 - S * 0.03, -S * 0.2, hw + S * 0.06, S * 0.2 + hh + S * 0.03], S, (cc) => drawHead(cc, a, S, back, t));
  c.restore();
}

/* ---------- the whole character, standing ---------- */
const ARMS = {
  stand: () => null,
  wave: (d, S, bw, by, t) => d < 0 ? [-bw * 0.5 - S * 0.17, by - S * 0.1 + Math.sin(t * 10) * S * 0.02] : null,
  cheer: (d, S, bw, by) => [d * (bw * 0.5 + S * 0.14), by - S * 0.3],
  reach: (d, S, bw, by) => [d * (bw * 0.5 + S * 0.09), by - S * 0.42]
};
export function body(c, x, base, h, look, t = 0, pose = 'stand', { back = false } = {}){
  const a = resolve(look), S = h, { hh, bw, bh } = SIZE(S), by = -S + hh + S * 0.015, legH = S - (by + S) - bh + S * 0.02;
  /* their shadow on the ground (outside the cut: it has no paper edge) */
  c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(x, base, S * 0.27, S * 0.04, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(x, base);
  paper(c, [-S * 0.75, -S * 1.3, S * 1.5, S * 1.34], S, (cc) => {
    cc.save(); cc.translate(0, by); drawCape(cc, a, S, bw, bh); cc.restore();
    const ly = by + bh - S * 0.02;
    for (const d of [-1, 1]){ drawLeg(cc, a, S, [[d * bw * 0.24, ly + S * 0.05], [d * bw * 0.24, ly + legH - S * 0.05]]); }
    drawFoot(cc, S, -bw * 0.26, 0); drawFoot(cc, S, bw * 0.26, 0);
    const reach = ARMS[pose] || ARMS.stand;
    for (const d of [-1, 1]){
      const sx = d * (bw * 0.5 + S * 0.03), sy = by + S * 0.06;
      const up = reach(d, S, bw, by, t);
      const pts = up ? [[sx, sy], [(sx + up[0]) / 2 + d * S * 0.02, (sy + up[1]) / 2], up] : [[sx, sy], [sx, by + bh * 0.88]];
      drawArm(cc, a, S, pts, d < 0);
    }
    cc.save(); cc.translate(0, by); drawTorso(cc, a, S, bw, bh); cc.restore();
    cc.save(); cc.translate(0, -S); drawHead(cc, a, S, back, t); cc.restore();
  });
  c.restore();
}

/* ---------- a portrait: for tiles and name chips ---------- */
export function portrait(c, x, y, s, look, t = 0){
  const a = resolve(look);
  c.save();
  c.beginPath(); c.roundRect ? c.roundRect(x - s / 2, y - s / 2, s, s, s * 0.22) : c.rect(x - s / 2, y - s / 2, s, s);
  c.fillStyle = a.light; c.fill(); c.clip();
  /* the shoulders, then the cube head */
  c.fillStyle = a.c; c.beginPath(); c.ellipse(x, y + s * 0.62, s * 0.34, s * 0.2, 0, 0, Math.PI * 2); c.fill();
  head(c, x, y + s * 0.02, s * 0.36, look, t);
  c.restore();
}

/* ---------- the character as a player: posed by the camera ----------
   The whole character drawn on a player's body as the camera sees it - arms where their arms are, the head where their head is, leaning as
   they lean - so a child sees themselves as their avatar, like a mirror. lm: the pose landmarks (0..1, mirrored); lift: how far up to draw
   them (px). */
const NOSE = 0, L_EYE = 2, R_EYE = 5, L_EAR = 7, R_EAR = 8, L_SH = 11, R_SH = 12, L_EL = 13, R_EL = 14,
  L_WR = 15, R_WR = 16, L_HIP = 23, R_HIP = 24, L_KN = 25, R_KN = 26, L_AN = 27, R_AN = 28;
export function figure(c, lm, W, H, look, t = 0, { lift = 0 } = {}){
  if (!lm || !lm[L_SH] || !lm[R_SH]) return;
  const P = (i) => [lm[i].x * W, lm[i].y * H - lift];
  const seen = (i) => lm[i] && (lm[i].v ?? lm[i].visibility ?? 1) > 0.3;
  const ls = P(L_SH), rs = P(R_SH);
  const sw = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]);
  if (sw < 6) return;
  /* the character is a little wider than a body: its torso is as wide as the shoulders, its head a third wider again */
  const S = sw * 3.3, { hw, hh } = SIZE(S);
  /* the head sits on the shoulders (its bottom edge just over the torso's top, the neck hidden), leaning as the body leans and a little
     toward where their nose is */
  const nose = P(NOSE), hip = (i) => (seen(i) ? P(i) : null);
  const lh0 = hip(L_HIP), rh0 = hip(R_HIP);
  const msx = (ls[0] + rs[0]) / 2, msy = (ls[1] + rs[1]) / 2;
  const lean = lh0 && rh0 ? Math.atan2(-((lh0[0] + rh0[0]) / 2 - msx), (lh0[1] + rh0[1]) / 2 - msy) : 0;
  const up = [Math.sin(lean), -Math.cos(lean)], rise = hh / 2 - S * 0.045;
  const hx = msx + up[0] * rise + Math.max(-sw * 0.3, Math.min(sw * 0.3, (nose[0] - msx) * 0.4)), hy = msy + up[1] * rise;
  const tilt = seen(L_EYE) && seen(R_EYE) ? Math.atan2(P(R_EYE)[1] - P(L_EYE)[1], P(R_EYE)[0] - P(L_EYE)[0]) : 0;
  const tip = Math.abs(tilt) > Math.PI / 2 ? tilt - Math.sign(tilt) * Math.PI : tilt;
  const pts = [ls, rs, [hx, hy]];
  for (const i of [L_EL, R_EL, L_WR, R_WR, L_HIP, R_HIP, L_KN, R_KN, L_AN, R_AN]) if (seen(i)) pts.push(P(i));
  const pad = S * 0.45;
  const x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad;
  const y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
  const a = resolve(look);
  paper(c, [x0, y0, x1 - x0, y1 - y0], S, (cc) => figureFlat(cc, a, P, seen, S, hx, hy, tip, t, hw, hh));
}
function figureFlat(c, a, P, seen, S, hx, hy, tilt, t, hw, hh){
  const { bw } = SIZE(S);
  const ls = P(L_SH), rs = P(R_SH), down = (p, by) => [p[0], p[1] + by];
  /* hips: as seen, or a torso's length under the shoulders */
  const lh = seen(L_HIP) ? P(L_HIP) : down(ls, S * 0.4), rh = seen(R_HIP) ? P(R_HIP) : down(rs, S * 0.4);
  const ms = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2], mh = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2];
  const D = Math.hypot(mh[0] - ms[0], mh[1] - ms[1]), ang = Math.atan2(-(mh[0] - ms[0]), mh[1] - ms[1]);
  const bh = Math.max(S * 0.27, D + S * 0.05);
  /* the cape, then the legs and feet */
  c.save(); c.translate(ms[0], ms[1]); c.rotate(ang); c.translate(0, -S * 0.03); drawCape(c, a, S, bw, bh); c.restore();
  for (const [h, k, an] of [[lh, L_KN, L_AN], [rh, R_KN, R_AN]]){
    const leg = [h]; if (seen(k)){ leg.push(P(k)); if (seen(an)) leg.push(P(an)); } else leg.push(down(h, S * 0.3));
    drawLeg(c, a, S, leg, true);
    if (leg.length === 3) drawFoot(c, S, leg[2][0], leg[2][1] + S * 0.07, true);
  }
  /* the arms: a sleeve to the elbow, the forearm, then the hand */
  for (const [s, e, w, left] of [[ls, L_EL, L_WR, true], [rs, R_EL, R_WR, false]]){
    let pts;
    if (!seen(e)) pts = [s, down(s, S * 0.26)];
    else { pts = [s, P(e)]; if (seen(w)) pts.push(P(w)); }
    drawArm(c, a, S, pts, left, true);
  }
  /* the torso, shoulders to hips */
  c.save(); c.translate(ms[0], ms[1]); c.rotate(ang); c.translate(0, -S * 0.03); drawTorso(c, a, S, bw, bh); c.restore();
  /* the head, tilted as theirs is */
  c.save(); c.translate(hx, hy); c.rotate(tilt * 0.8); c.translate(0, -hh / 2); drawHead(c, a, S, false, t); c.restore();
}
