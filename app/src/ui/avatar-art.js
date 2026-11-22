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
import { PARTS, CUBO, normalizeLook, surprise as randomLook } from './look.js';
import { POSES, FRAMES, frameAt } from '../games/figure.js';

export { PARTS };
export const surprise = randomLook;
/* (kept so older callers compile: there is one style now) */
export function setStyle(){}

/* ---------- the colours of one look ---------- */
/* two more mouths for Cubo's story faces (an open grin, a gasp); they are not in the creator's choices (look.js PARTS) */
const STORY_MOUTH = new Set(['open', 'gasp']);
const BROWS = new Set(['up', 'raise']);
/* what is moving in the face right now (set by body for the one figure it draws): { blink, look: [x, y], talk: 0..1 | null } */
let live = null;
const cache = new WeakMap();
function resolve(look){
  const key = look && typeof look === 'object' ? look : null;
  const hit = key && cache.get(key); if (hit) return hit;
  const L = normalizeLook(look), c = color('fav.' + L.colour), c2 = color(L.outfitColour), white = L.outfitColour === 'shade.card';
  const a = {
    c, c2, c2n: L.outfitColour, t2n: white ? 'ui.go' : L.outfitColour, white, brow: BROWS.has(look && look.face && look.face.brow) ? look.face.brow : null, eyes: L.face.eyes, mouth: STORY_MOUTH.has(look && look.face && look.face.mouth) ? look.face.mouth : L.face.mouth, top: L.top, fit: L.outfit, extra: L.extra,
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
  const blink = live ? live.blink : (t % 4.3) > 4.18;
  const glance = live && live.look || [0, 0], talk = live && live.talk != null ? live.talk : null;

  if (!back){
    /* the face: always the same painted style - big friendly eyes with a shine, a soft blush, a wide mouth */
    const fy = hy + hh * 0.5, ex = hw * 0.2, er = S * 0.05;
    x.fillStyle = ink; x.strokeStyle = ink; x.lineWidth = S * 0.014;
    /* tall oval eyes (old Cubo's size) with a clear white shine, upper left, about a fifth of the eye's width across */
    const oval = (cx, ey, rx, ry) => { x.beginPath(); x.ellipse(cx, ey, rx, ry, 0, 0, 7); x.fill(); x.fillStyle = color('earth.snow'); dot(x, cx - rx * 0.3, ey - ry * 0.34, rx * 0.4); x.fill(); x.fillStyle = ink; };
    [-1, 1].forEach((s) => {
      const cx = s * ex - hw * 0.04 + glance[0] * er * 0.4, ey = fy + glance[1] * er * 0.3, rx = er * 0.64, ry = er * 0.98;
      if (blink && a.eyes !== 'happy' && a.eyes !== 'sleepy' && !(a.eyes === 'wink' && s > 0)){ x.beginPath(); x.moveTo(cx - rx, ey); x.lineTo(cx + rx, ey); x.stroke(); return; }
      if (a.eyes === 'dot') oval(cx, ey, rx, ry);
      if (a.eyes === 'wide') oval(cx, ey, rx * 1.12, ry * 1.12);
      if (a.eyes === 'happy' || (a.eyes === 'wink' && s > 0)){ x.beginPath(); x.arc(cx, ey + er * 0.45, er * 0.85, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
      if (a.eyes === 'wink' && s < 0) oval(cx, ey, rx, ry);
      if (a.eyes === 'sleepy'){ x.beginPath(); x.moveTo(cx - rx, ey); x.lineTo(cx + rx, ey); x.stroke(); }
      if (a.eyes === 'star'){ x.beginPath(); for (let k = 0; k < 10; k++){ const an = -Math.PI / 2 + k * Math.PI / 5, R = k % 2 ? er * 0.65 : er * 1.5; x.lineTo(cx + Math.cos(an) * R, ey + Math.sin(an) * R); } x.closePath(); x.fill(); }
      /* eyebrows only for an expression: both arched high for a gasp, one raised over the open eye for a wink */
      if (a.brow === 'up' || (a.brow === 'raise' && s < 0)){
        x.lineWidth = S * 0.014;
        const by0 = ey - ry * (a.brow === 'up' ? 2.05 : 1.85);
        x.beginPath(); x.moveTo(cx - rx * 1.2, by0 + er * 0.3); x.quadraticCurveTo(cx, by0 - er * 0.55, cx + rx * 1.2, by0 + er * 0.3);
        x.stroke();
      }
    });
    const my = fy + hh * 0.22, mx = -hw * 0.04;
    /* a soft, warm blush under the eyes on every face */
    x.fillStyle = alpha('fav.pink', 0.85, 'light');
    [-1, 1].forEach((s) => { x.beginPath(); x.ellipse(s * hw * 0.36 - hw * 0.04, fy + S * 0.085, S * 0.032, S * 0.02, 0, 0, 7); x.fill(); });
    x.fillStyle = ink;
    /* while he talks the mouth opens and closes (a gasp or an "o" stays as it is) */
    const mouth = talk != null && a.mouth !== 'gasp' && a.mouth !== 'o' ? 'open' : a.mouth, k = talk != null && mouth === 'open' ? 0.3 + 0.7 * talk : 1;
    if (mouth === 'smile'){ x.beginPath(); x.arc(mx, my - S * 0.025, S * 0.052, Math.PI * 0.2, Math.PI * 0.8); x.stroke(); }
    if (mouth === 'grin'){ x.beginPath(); x.moveTo(mx - S * 0.065, my - S * 0.012); x.quadraticCurveTo(mx, my + S * 0.07, mx + S * 0.065, my - S * 0.012); x.closePath(); x.fill(); }
    if (mouth === 'open'){ x.beginPath(); x.moveTo(mx - S * 0.075, my - S * 0.03); x.quadraticCurveTo(mx, my - S * 0.015, mx + S * 0.075, my - S * 0.03); x.quadraticCurveTo(mx + S * 0.06, my + S * 0.075 * k, mx, my + S * 0.075 * k); x.quadraticCurveTo(mx - S * 0.06, my + S * 0.075 * k, mx - S * 0.075, my - S * 0.03); x.closePath(); x.fill(); x.save(); x.clip(); x.fillStyle = color('touch.bubblegum', 'light'); x.beginPath(); x.ellipse(mx, my + S * 0.08 * k, S * 0.036, S * 0.032 * k, 0, 0, 7); x.fill(); x.restore(); x.fillStyle = ink; }
    if (mouth === 'gasp'){ x.beginPath(); x.ellipse(mx, my + S * 0.015, S * 0.036, S * 0.056, 0, 0, 7); x.fill(); }
    if (mouth === 'o'){ x.beginPath(); x.ellipse(mx, my, S * 0.02, S * 0.028, 0, 0, 7); x.fill(); }
    if (mouth === 'cat'){ x.beginPath(); x.arc(mx - S * 0.022, my - S * 0.01, S * 0.022, 0, Math.PI); x.arc(mx + S * 0.022, my - S * 0.01, S * 0.022, 0, Math.PI); x.stroke(); }
    if (mouth === 'tongue'){ x.beginPath(); x.arc(mx, my - S * 0.025, S * 0.052, Math.PI * 0.2, Math.PI * 0.8); x.stroke(); x.fillStyle = color('touch.bubblegum', 'light'); x.beginPath(); x.ellipse(mx + S * 0.008, my + S * 0.02, S * 0.016, S * 0.02, 0, 0, 7); x.fill(); }
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
  x.strokeStyle = INK(); x.lineWidth = S * 0.016; rr(x, -bw / 2, 0, bw, bh, S * 0.05); x.stroke();
  if (a.extra === 'scarf'){ x.fillStyle = a.c2 === c ? color('ui.gold') : a.t2; rr(x, -bw * 0.55, -S * 0.01, bw * 1.1, S * 0.05, S * 0.025); x.fill(); rr(x, bw * 0.1, S * 0.02, S * 0.05, S * 0.1, S * 0.02); x.fill(); }
  x.restore();
}
/* the cape: behind everything, hanging from the shoulders (origin: middle of the torso's top edge) */
function drawCape(x, a, S, bw, bh){
  if (a.extra !== 'cape') return;
  x.fillStyle = toneT(a, 'shade'); x.beginPath(); x.moveTo(-bw * 0.55, S * 0.02); x.lineTo(bw * 0.55, S * 0.02); x.lineTo(bw * 0.8, bh * 1.35); x.lineTo(-bw * 0.8, bh * 1.35); x.closePath(); x.fill();
  x.strokeStyle = INK(); x.lineWidth = S * 0.016; x.lineJoin = 'round'; x.stroke();
}
/* a leg: points down from the hip; the foot is an ink pill */
function drawLeg(x, a, S, pts, thick = false){
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  line(x, pts, S * (thick ? 0.16 : 0.11) + S * 0.032, INK());
  line(x, pts, S * (thick ? 0.16 : 0.11), a.fit === 'overalls' ? toneRaw(a, 'shade') : a.shade);
  x.restore();
}
function drawFoot(x, S, px, py, big = false){ const k = big ? 1.4 : 1; x.fillStyle = INK(); rr(x, px - S * 0.06 * k, py - S * 0.045 * k, S * 0.12 * k, S * 0.045 * k, S * 0.02); x.fill(); }
/* an arm: a sleeve along the points, a hand at the end; the left one is in shade */
function drawArm(x, a, S, pts, left, thick = false){
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  const sleeve = a.fit === 'hoodie' ? a.c2 : a.c;
  line(x, pts, S * (thick ? 0.13 : 0.08) + S * 0.032, INK());
  line(x, pts, S * (thick ? 0.13 : 0.08), left ? (a.fit === 'hoodie' ? toneRaw(a, 'shade') : a.shade) : sleeve);
  x.fillStyle = a.light; const e = pts[pts.length - 1]; dot(x, e[0], e[1], S * (thick ? 0.062 : 0.038)); x.fill(); x.strokeStyle = INK(); x.lineWidth = S * 0.016; x.stroke();
  x.restore();
}

/* ---------- the edge around everything drawn ----------
   Only the outermost call draws it (a body's head is part of the body). By default it is a plain thick ink outline, which needs nothing
   but the canvas - this is what the creator kit carries into a game (the server's scan of a game's code keeps out anything that makes
   pictures as it runs). The app itself calls setPaperCut(fn) at startup (paper-cut.js) with the real thing: a thin cream paper edge and a
   soft shadow. fn(c, box, S, flat, scale): draw the figure with flat(canvas), which is the figure drawn flat. */
let depth = 0;
let cutter = null;
export function setPaperCut(fn){ cutter = fn; }
function plain(c, draw){ depth++; try { draw(c); } finally { depth--; } }
function paper(c, box, S, draw){
  const m = depth === 0 && c.getTransform ? c.getTransform() : null;
  if (!m || typeof m.a !== 'number') return plain(c, draw);
  const sc = Math.hypot(m.a, m.b) || 1, flat = (cc) => plain(cc, draw);
  if (cutter) return cutter(c, box, S, flat, sc);
  /* the plain outline: the figure drawn again and again around itself, each time with an ink shadow that has no blur */
  const e = S * 0.014 * sc;
  for (let i = 0; i < 8; i++){
    const an = i / 8 * Math.PI * 2;
    c.save(); c.shadowColor = INK(); c.shadowBlur = 0; c.shadowOffsetX = Math.cos(an) * e; c.shadowOffsetY = Math.sin(an) * e;
    flat(c); c.restore();
  }
  flat(c);
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
/* the story's moves, drawn for this body (units of the character's height S, y up from the feet's line as negative numbers). A move is four
   stills that repeat, like the move cards': { yo: body lift, rot: lean (radians), dx: sideways shiver, legs: [[knee|null, foot], left, right],
   arms: [points after the shoulder, left, right] } */
const mirror = (m) => ({ ...m, legs: [m.legs[1], m.legs[0]].map(([k, f]) => [k && [-k[0], k[1]], [-f[0], f[1]]]), arms: [m.arms[1], m.arms[0]].map(pts => pts.map(([px, py]) => [-px, py])) });
const MOVES = {
  /* a clear stride, seen from the side: one leg forward and planted, one back on its toe, the arms swinging against the legs, a small bob */
  march: (i) => {
    const A = { yo: 0, legs: [[null, [-0.19, -0.035]], [null, [0.21, 0]]], arms: [[[-0.3, -0.36]], [[0.22, -0.2]]] };
    const B = { yo: -0.014, legs: [[null, [-0.08, 0]], [[0.13, -0.15], [0.1, -0.07]]], arms: [[[-0.23, -0.25]], [[0.23, -0.25]]] };
    return [A, B, mirror(A), mirror(B)][i % 4];
  },
  /* a longer stride, leaving the ground between steps, leaning into it */
  run: (i) => {
    const A = { yo: -0.07, rot: 0.3, legs: [[[-0.1, -0.13], [-0.29, -0.13]], [[0.15, -0.2], [0.29, -0.1]]], arms: [[[-0.3, -0.45], [-0.38, -0.33]], [[0.3, -0.4], [0.36, -0.55]]] };
    const B = { yo: 0, rot: 0.3, legs: [[[-0.1, -0.15], [-0.2, -0.06]], [null, [0.24, 0]]], arms: [[[-0.28, -0.42], [-0.3, -0.3]], [[0.3, -0.42], [0.32, -0.5]]] };
    return [A, B, mirror(A), mirror(B)][i % 4];
  },
  /* off the ground: a squat to spring from, then up with the knees tucked and the arms high (the shadow stays on the grass) */
  jump: (i) => {
    if (i % 4 === 0) return { yo: 0.04, squash: 0.07, legs: [[[-0.13, -0.12], [-0.12, 0]], [[0.13, -0.12], [0.12, 0]]], arms: [[[-0.27, -0.28]], [[0.27, -0.28]]] };
    const up = i % 4 === 2 ? 0.34 : 0.22;
    return { yo: -up, legs: [[[-0.12, -0.13 - up], [-0.09, -0.07 - up]], [[0.12, -0.13 - up], [0.09, -0.07 - up]]], arms: [[[-0.3, -0.62 - up * 0.5], [-0.3, -0.8 - up * 0.5]], [[0.3, -0.62 - up * 0.5], [0.3, -0.8 - up * 0.5]]] };
  },
  /* frozen: arms out, shivering */
  freeze: (i) => ({ yo: 0, dx: (i % 2 ? 1 : -1) * 0.009, arms: [[[-0.37, -0.45]], [[0.37, -0.45]]] })
};
export function body(c, x, base, h, look, t = 0, pose = 'stand', { back = false, face: alive = null } = {}){
  const a = resolve(look), S = h, { hh, bw, bh } = SIZE(S), by = -S + hh + S * 0.015, legH = S - (by + S) - bh + S * 0.02;
  /* the other moves (squat, lean, flap, dance ...) come from the move cards' drawings (figure.js POSES), carried over to this body */
  let mv = null;
  if (!(pose in ARMS)){
    const i = frameAt(pose, t).i;
    if (MOVES[pose]){ mv = MOVES[pose](i); }
    else if (POSES[pose]){
      const q = POSES[pose](frameAt(pose, t).p), U = S * 0.5, V = S * 0.435, sy1 = by + S * 0.06;
      const fx = (px) => px * U / S, fy = (py) => (py * V - V * 0.7) / S;
      mv = { yo: (q.yOff || 0) * V / S, rot: (q.lean || 0) * 0.35,
        legs: q.legs ? q.legs.map(([k, f]) => [[fx(k[0]), fy(k[1])], [fx(f[0]), fy(f[1])]]) : null,
        arms: q.arms.map(ar => ar.map(([px, py]) => [fx(px), (sy1 + (py + 0.6) * V) / S])) };
    }
  }
  const yo = mv ? mv.yo * S : 0, rot = mv && mv.rot || 0, dx = mv && mv.dx ? mv.dx * S : 0;
  const sy0 = by + S * 0.06;
  /* their shadow on the ground (outside the cut: it has no paper edge) */
  c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(x, base, S * 0.27, S * 0.04, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(x + dx, base);
  const sq = mv && mv.squash || 0; if (sq) c.scale(1 + sq * 0.7, 1 - sq);
  live = alive;
  paper(c, [-S * 0.75, -S * 1.3, S * 1.5, S * 1.34], S, (cc) => {
    const ly = by + bh - S * 0.02;
    const lean = () => { if (rot){ cc.translate(0, ly); cc.rotate(rot); cc.translate(0, -ly); } };
    cc.save(); lean(); cc.save(); cc.translate(0, by + yo); drawCape(cc, a, S, bw, bh); cc.restore(); cc.restore();
    if (mv && mv.legs){
      mv.legs.forEach(([kn, ft], i) => {
        const d = i ? 1 : -1, hip = [d * bw * 0.24, ly + yo + S * 0.05], fp = [ft[0] * S, ft[1] * S];
        const end = [fp[0], Math.max(fp[1] - S * 0.05, hip[1] + S * 0.02)];
        drawLeg(cc, a, S, kn ? [hip, [kn[0] * S, kn[1] * S], end] : [hip, end]);
        drawFoot(cc, S, fp[0], fp[1]);
      });
    } else {
      for (const d of [-1, 1]){ drawLeg(cc, a, S, [[d * bw * 0.24, ly + yo + S * 0.05], [d * bw * 0.24, ly + legH - S * 0.05]]); }
      drawFoot(cc, S, -bw * 0.26, 0); drawFoot(cc, S, bw * 0.26, 0);
    }
    cc.save(); lean();
    const reach = ARMS[pose] || ARMS.stand;
    for (const d of [-1, 1]){
      const sx = d * (bw * 0.5 + S * 0.03), sy = sy0 + yo;
      let pts;
      if (mv && mv.arms){ pts = [[sx, sy], ...mv.arms[d < 0 ? 0 : 1].map(([px, py]) => [px * S, py * S])]; }
      else { const up = reach(d, S, bw, by, t); pts = up ? [[sx, sy], [(sx + up[0]) / 2 + d * S * 0.02, (sy + up[1]) / 2], up] : [[sx, sy], [sx, by + bh * 0.88]]; }
      drawArm(cc, a, S, pts, d < 0);
    }
    cc.save(); cc.translate(0, by + yo); drawTorso(cc, a, S, bw, bh); cc.restore();
    cc.save(); cc.translate(0, -S + yo); drawHead(cc, a, S, back, t); cc.restore();
    cc.restore();
  });
  live = null;
  c.restore();
}

/* ---------- Cubo: the blue one, doing one of the story's moves with the story's faces ----------
   pose: any move card's name (or stand, wave, cheer, reach); face: smile, grin, wow, wink, tongue, joy or smirk (default: the face that goes
   with that drawing of the move). Used by the story, the cover, pause and results screens and the creator library. */
const CUBO_FACE = { smile: ['dot', 'smile'], grin: ['dot', 'open'], wow: ['wide', 'gasp', 'up'], wink: ['wink', 'open', 'raise'], tongue: ['dot', 'tongue'], joy: ['happy', 'open'], smirk: ['dot', 'cat'] };
const CUBO_LOOKS = Object.fromEntries(Object.entries(CUBO_FACE).map(([k, [eyes, mouth, brow]]) => [k, { ...CUBO, face: { eyes, mouth, brow } }]));
/* a blink every 3 to 5 seconds, at random (the same random for the same moment), and gentle: a tenth of a second */
const rand = (k) => { const v = Math.sin(k * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); };
export function blinkAt(t){
  const u = ((t % 900) + 900) % 900;
  let at = 1 + rand(0) * 2;
  for (let k = 1; at < u && k < 400; k++){ const next = at + 3 + rand(k) * 2; if (u < at + 0.11) return true; at = next; if (u < at) return false; }
  return u >= at && u < at + 0.11;
}
/* opts.look: which way his eyes glance ([x, y], -1..1); opts.talk: true while the voice reads about him */
export function cuboFigure(c, x, base, h, pose = 'stand', t = 0, face = null, { look = null, talk = false } = {}){
  const f = face || (FRAMES[pose] ? frameAt(pose, t).face : 'smile');
  const m = talk ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.4 + Math.sin(t * 1.7) * 1.5) : null;
  body(c, x, base, h, CUBO_LOOKS[f] || CUBO_LOOKS.smile, t, pose, { face: { blink: blinkAt(t), look, talk: m } });
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
