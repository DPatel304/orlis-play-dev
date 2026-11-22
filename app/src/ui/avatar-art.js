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
    /* the face: always the same painted style - big friendly eyes with a shine, a wide mouth */
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
/* the Chibi body (the owner's choice): the cube head is about 1.25 times the body's width, a boxy torso, short chunky legs with small rounded
   feet, arms a little away from the body with round mitten hands. All numbers are fractions of the head's size S; tot is the whole height. */
const BODY = { tot: 0.88, bw: 0.37, bh: 0.28, r: 0.075, legW: 0.14, armW: 0.1, out: 0.075, armLen: 0.8, hand: 0.058 };
const SIZE = (S) => ({ hw: S * 0.46, hh: S * 0.42, bw: S * BODY.bw, bh: S * BODY.bh });

/* the torso: origin at the middle of its top edge, bw wide, bh tall (it stretches to a player's real body in figure) */
function drawTorso(x, a, S, bw, bh){
  const c = a.c;
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  x.fillStyle = a.fit === 'plain' || a.fit === 'overalls' ? c : a.c2; rr(x, -bw / 2, 0, bw, bh, S * BODY.r); x.fill();
  x.save(); rr(x, -bw / 2, 0, bw, bh, S * BODY.r); x.clip();
  if (a.fit === 'stripes'){ x.fillStyle = c; for (let k = 0; k < 4; k++) x.fillRect(-bw / 2, bh * (k * 0.26 + 0.06), bw, bh * 0.12); }
  if (a.fit === 'dots'){ x.fillStyle = c; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++){ x.beginPath(); x.arc(-bw * 0.3 + i * bw * 0.3 + (j % 2) * bw * 0.08, bh * (0.2 + j * 0.3), S * 0.018, 0, 7); x.fill(); } }
  if (a.fit === 'stars'){ x.fillStyle = c; const r = S * 0.055; x.beginPath(); for (let k = 0; k < 10; k++){ const an = -Math.PI / 2 + k * Math.PI / 5, R = k % 2 ? r * 0.45 : r; x.lineTo(Math.cos(an) * R, bh * 0.45 + Math.sin(an) * R); } x.closePath(); x.fill(); }
  if (a.fit === 'overalls'){ x.fillStyle = a.c2; x.fillRect(-bw / 2, bh * 0.45, bw, bh); x.fillRect(-bw * 0.32, 0, bw * 0.14, bh * 0.5); x.fillRect(bw * 0.18, 0, bw * 0.14, bh * 0.5); }
  if (a.fit === 'hoodie'){ x.fillStyle = toneRaw(a, 'shade'); x.fillRect(-bw * 0.22, bh * 0.55, bw * 0.44, bh * 0.3); }
  x.fillStyle = alpha('shade.shadow', 0.18); x.fillRect(bw * 0.18, 0, bw * 0.4, bh);
  x.restore();
  x.strokeStyle = INK(); x.lineWidth = S * 0.016; rr(x, -bw / 2, 0, bw, bh, S * BODY.r); x.stroke();
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
  line(x, pts, S * (thick ? 0.16 : BODY.legW) + S * 0.032, INK());
  line(x, pts, S * (thick ? 0.16 : BODY.legW), a.fit === 'overalls' ? toneRaw(a, 'shade') : a.shade);
  x.restore();
}
/* a small rounded foot, ink-dark, a little wider than the leg, peeking out under it: px is its middle, py the ground under it */
function drawFoot(x, S, px, py, big = false){ const k = big ? 1.3 : 1, w = S * 0.17 * k, h = S * 0.06 * k; x.fillStyle = INK(); rr(x, px - w / 2, py - h, w, h, h * 0.5); x.fill(); }
/* an arm: a sleeve along the points, a hand at the end; the left one is in shade */
function drawArm(x, a, S, pts, left, thick = false){
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  const sleeve = a.fit === 'hoodie' ? a.c2 : a.c;
  line(x, pts, S * (thick ? 0.13 : BODY.armW) + S * 0.032, INK());
  line(x, pts, S * (thick ? 0.13 : BODY.armW), left ? (a.fit === 'hoodie' ? toneRaw(a, 'shade') : a.shade) : sleeve);
  x.fillStyle = a.light; const e = pts[pts.length - 1]; dot(x, e[0], e[1], S * (thick ? 0.062 : BODY.hand)); x.fill(); x.strokeStyle = INK(); x.lineWidth = S * 0.016; x.stroke();
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
  /* a clear stride, seen from the side: one foot forward and planted, one back, the arms swinging against the legs, a small bob */
  march: (i) => {
    const A = { yo: 0, legs: [[null, [-0.17, -0.02]], [null, [0.19, 0]]], arms: [[[-0.31, -0.22]], [[0.27, -0.17]]] };
    const B = { yo: -0.012, legs: [[null, [-0.06, 0]], [null, [0.09, -0.05]]], arms: [[[-0.27, -0.19]], [[0.27, -0.19]]] };
    return [A, B, mirror(A), mirror(B)][i % 4];
  },
  /* a longer stride, leaving the ground between steps, leaning into it */
  /* a run, in four stills (each ~0.2 s): in the air with the front knee up and the foot under it, the back leg pushing off diagonally; then
     landing low on the front foot with the other leg trailing; then the same on the other side. The torso and head stay fully upright (no lean at all; the speed is
     in the legs, the arms and the bob), the arms are bent and pump close to the body against the legs, and the body bobs up and down between the stills. */
  run: (i) => {
    const hip = (side, yo) => [side * 0.104, -0.135 + yo];
    const front = (side, yo, air) => { const [hx, hy] = hip(side, yo); return air ? [[hx + 0.086, hy + 0.025], [hx + 0.076, hy + 0.16]] : [[hx + 0.046, hy + 0.01], [hx + 0.026, hy + 0.135]]; };
    const back = (side, yo, air) => { const [hx, hy] = hip(side, yo); return air ? [[hx - 0.046, hy + 0.045], [hx - 0.096, hy + 0.17]] : [[hx - 0.026, hy + 0.035], [hx - 0.066, hy + 0.135]]; };
    const arm = (side, yo, ph) => { const x = side * 0.255, up = ph === 'fwd', mid = ph === 'mid'; return [[x, -0.31 + yo * 0.5], [x + side * 0.02, (up ? -0.41 : mid ? -0.33 : -0.235) + yo * 0.5]]; };
    const k = i % 4, air = k % 2 === 0, yo = air ? -0.04 : 0, rightFront = k < 2, f = rightFront ? 1 : -1;
    return { yo, legs: [f > 0 ? back(-1, yo, air) : front(-1, yo, air), f > 0 ? front(1, yo, air) : back(1, yo, air)],
      arms: [arm(-1, yo, air ? (f > 0 ? 'fwd' : 'back') : 'mid'), arm(1, yo, air ? (f > 0 ? 'back' : 'fwd') : 'mid')] };
  },
  /* off the ground, in four stills: the landing squash (the whole body squashes, feet apart), the take-off (legs stretched down, toes pointed,
     arms up), the top (knees tucked out to the sides, arms high), the way down (legs reaching for the ground). The shadow stays on the grass. */
  jump: (i) => {
    const arms = (up, k) => [[[-0.31 - k * 0.04, -0.52 - up], [-0.3 - k * 0.07, -0.68 - up]], [[0.31 + k * 0.04, -0.52 - up], [0.3 + k * 0.07, -0.68 - up]]];
    if (i % 4 === 0) return { yo: 0.02, squash: 0.09, legs: [[null, [-0.15, 0]], [null, [0.15, 0]]], arms: [[[-0.34, -0.17]], [[0.34, -0.17]]] };
    if (i % 4 === 1) return { yo: -0.2, legs: [[null, [-0.07, -0.2 + 0.03]], [null, [0.07, -0.2 + 0.03]]], arms: arms(0.2, 0) };
    if (i % 4 === 2) return { yo: -0.32, legs: [[[-0.115, -0.32 - 0.1], [-0.085, -0.32 + 0.02]], [[0.115, -0.32 - 0.1], [0.085, -0.32 + 0.02]]], arms: arms(0.32, 1) };
    return { yo: -0.17, legs: [[null, [-0.1, -0.17 + 0.02]], [null, [0.1, -0.17 + 0.02]]], arms: arms(0.17, 0.5) };
  },
  /* a squat, from the front, in four stills (down, down, hold, hold): the body and head sink and squash, the feet stay flat on the floor a little
     wider than the hips, the knees bow out to the sides and the shins come back down to the feet; the arms reach out in front for balance, seen
     from the front as short arms with the mittens at chest height, slightly apart (drawn over the torso) */
  squat: (i) => {
    const p = [0.5, 1, 1, 1][i % 4], yo = 0.04 * p, hy = -0.135 + yo, s = (side, a, b) => [side * a, b];
    const leg = (side) => [[side * (0.104 + 0.15 * p), hy], [side * (0.104 + 0.07 * p), 0, 0.035]];
    return { yo, squash: 0.1 * p, armsFront: true, legs: [leg(-1), leg(1)],
      arms: [[s(-1, 0.19, -0.29 + yo), s(-1, 0.115, -0.275 + yo)], [s(1, 0.19, -0.29 + yo), s(1, 0.115, -0.275 + yo)]] };
  },
  /* frozen: arms out, shivering */
  freeze: (i) => ({ yo: 0, dx: (i % 2 ? 1 : -1) * 0.009, arms: [[[-0.4, -0.29]], [[0.4, -0.29]]] })
};
/* the move cards' drawings were made for taller legs and arms: this carries one over to the short Chibi body (legs scaled about the ground,
   arms about the shoulder) */
function chibiFit(mv){
  const sx = BODY.bw / 2 + 0.03, sy = -BODY.tot + 0.42 + 0.015 + 0.06;
  return { ...mv, yo: mv.yo * 0.43,
    legs: mv.legs && mv.legs.map(([k, f]) => [k && [k[0] * 0.8, k[1] * 0.43], [f[0] * 0.8, f[1] * 0.43]]),
    arms: mv.arms.map((ar, i) => ar.map(([px, py]) => { const d = i ? 1 : -1; return [d * sx + (px - d * sx) * 0.8, sy + (py - sy) * 0.8]; })) };
}
export function body(c, x, base, h, look, t = 0, pose = 'stand', { back = false, face: alive = null, still = false } = {}){
  const a = resolve(look), S = h, { hh, bw, bh } = SIZE(S), by = -S * BODY.tot + hh + S * 0.015, legH = S - (by + S) - bh + S * 0.02;
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
      mv = chibiFit(mv);
    }
  }
  /* standing still he breathes: a gentle bob (about 2% of his height, every 2.5 s) and a slight sway of the arms (not for the small portraits) */
  const idle = pose === 'stand' && !mv && !still && !back, breath = idle ? Math.sin(t * Math.PI * 2 / 2.5) : 0;
  const yo = mv ? mv.yo * S : breath * S * 0.01, rot = mv && mv.rot || 0, dx = mv && mv.dx ? mv.dx * S : 0;
  const sy0 = by + S * 0.06;
  /* their shadow on the ground (outside the cut: it has no paper edge) */
  c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(x, base, S * 0.3, S * 0.04, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(x + dx, base);
  const sq = mv && mv.squash || 0; if (sq) c.scale(1 + sq * 0.7, 1 - sq);
  live = alive;
  paper(c, [-S * 0.75, -S * 1.3, S * 1.5, S * 1.34], S, (cc) => {
    const ly = by + bh - S * 0.02;
    const lean = () => { if (rot){ cc.translate(0, ly); cc.rotate(rot); cc.translate(0, -ly); } };
    cc.save(); lean(); cc.save(); cc.translate(0, by + yo); drawCape(cc, a, S, bw, bh); cc.restore(); cc.restore();
    if (mv && mv.legs){
      mv.legs.forEach(([kn, ft], i) => {
        const d = i ? 1 : -1, hip = [d * bw * 0.28, ly + yo + S * 0.05], fp = [ft[0] * S, ft[1] * S], drop = ft[2] != null ? ft[2] : 0.07;
        const end = [fp[0], Math.max(fp[1] - S * drop, hip[1] + S * 0.02)];
        drawLeg(cc, a, S, kn ? [hip, [kn[0] * S, kn[1] * S], end] : [hip, end]);
        drawFoot(cc, S, fp[0], fp[1]);
      });
    } else {
      for (const d of [-1, 1]){ drawLeg(cc, a, S, [[d * bw * 0.28, ly + yo + S * 0.05], [d * bw * 0.28, ly + legH - S * 0.07]]); }
      drawFoot(cc, S, -bw * 0.28, 0); drawFoot(cc, S, bw * 0.28, 0);
    }
    cc.save(); lean();
    const reach = ARMS[pose] || ARMS.stand;
    const armsDraw = () => { for (const d of [-1, 1]){
      const sx = d * (bw * 0.5 + S * 0.03), sy = sy0 + yo;
      let pts;
      if (mv && mv.arms){ pts = [[sx, sy], ...mv.arms[d < 0 ? 0 : 1].map(([px, py]) => [px * S, py * S])]; }
      else { const up = reach(d, S, bw, by, t); pts = up ? [[sx, sy], [(sx + up[0]) / 2 + d * S * 0.02, (sy + up[1]) / 2], up] : [[sx, sy], [sx + d * S * BODY.out + (idle ? Math.sin(t * Math.PI * 2 / 2.5 + 1.3 + d) * S * 0.008 : 0), sy + (by + bh * 0.88 - sy) * BODY.armLen]]; }
      drawArm(cc, a, S, pts, d < 0);
    } };
    if (!(mv && mv.armsFront)) armsDraw();
    cc.save(); cc.translate(0, by + yo); drawTorso(cc, a, S, bw, bh); cc.restore();
    if (mv && mv.armsFront) armsDraw();
    cc.save(); cc.translate(0, -S * BODY.tot + yo + hh / 2); if (mv && mv.headUp) cc.rotate(-rot * mv.headUp); cc.translate(0, -hh / 2); drawHead(cc, a, S, back, t); cc.restore();
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
  const f = face || (pose === 'squat' ? 'grin' : FRAMES[pose] ? frameAt(pose, t).face : 'smile');
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
   The character drawn where a player is, as a mirror: it takes only the DIRECTIONS of the player's limbs from the camera (the angles of
   their upper arms, forearms, thighs and shins, how much their torso leans, how their head tilts), never their lengths. It is always the
   Chibi character with its own fixed proportions, sized from the player's head-to-hip span, standing on the floor line under the player
   (the lower ankle - so it lifts when they jump), with its hips over theirs. Arms and legs are two short chunky segments each, with mitten
   hands and rounded feet; a straight, reaching arm stretches up to 1.3 times. Only the drawing is done here: games use the real landmarks
   for hit points, and this changes none of that. lm: the pose landmarks (0..1, mirrored); lift: how far up to draw them (px). */
const NOSE = 0, L_EYE = 2, R_EYE = 5, L_SH = 11, R_SH = 12, L_EL = 13, R_EL = 14,
  L_WR = 15, R_WR = 16, L_HIP = 23, R_HIP = 24, L_KN = 25, R_KN = 26, L_AN = 27, R_AN = 28;
export function figure(c, lm, W, H, look, t = 0, { lift = 0 } = {}){
  if (!lm || !lm[L_SH] || !lm[R_SH]) return;
  const P = (i) => [lm[i].x * W, lm[i].y * H - lift];
  const seen = (i) => lm[i] && (lm[i].v ?? lm[i].visibility ?? 1) > 0.3;
  const ls = P(L_SH), rs = P(R_SH), sw = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]);
  if (sw < 6) return;
  const ms = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2];
  /* their hips (or a torso's length under the shoulders) and how far their torso leans */
  const hipOf = (i, sh) => (seen(i) ? P(i) : [sh[0], sh[1] + sw * 1.5]);
  const lh = hipOf(L_HIP, ls), rh = hipOf(R_HIP, rs), mh = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2];
  const lean = Math.max(-0.5, Math.min(0.5, Math.atan2(-(mh[0] - ms[0]), mh[1] - ms[1])));
  /* the size: from their head-to-hip span (the chibi's head centre to hip line is 0.505 of its head size) */
  const nose = seen(NOSE) ? P(NOSE) : [ms[0], ms[1] - sw * 0.8];
  const D = Math.max(sw * 1.6, Math.min(sw * 4, Math.hypot(nose[0] - mh[0], nose[1] - mh[1])));
  const S = D / (0.5 + 0.005), { hh, bw, bh } = SIZE(S);
  const a = resolve(look);
  /* which of their sides is on the left of the picture */
  const sl = ls[0] <= rs[0] ? -1 : 1;
  const cs = Math.cos(lean), sn = Math.sin(lean);
  const rot = (px, py) => [px * cs - py * sn, px * sn + py * cs];               /* the torso's own frame -> the picture (origin: the middle of the torso's bottom edge) */
  const dir = (p, q, fb) => { const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy); return d > 1e-6 ? [dx / d, dy / d] : fb; };
  /* the legs: two short segments each, pointing the way their thigh and shin do; the hips go where they must for the feet to be on the floor */
  const DOWN = [0, 1], hipJ = (side) => rot(side * bw * 0.28 / 1, S * 0.03);
  const legs = [[L_HIP, L_KN, L_AN, lh, true], [R_HIP, R_KN, R_AN, rh, false]].map(([hi, ki, ai, h0, left]) => {
    const side = left ? sl : -sl, j = hipJ(side), kn = seen(ki) ? P(ki) : null, an = seen(ai) ? P(ai) : null;
    const u = kn ? dir(h0, kn, DOWN) : DOWN, v = kn && an ? dir(kn, an, u) : u, L = S * 0.07;
    const k = [j[0] + u[0] * L, j[1] + u[1] * L], e = [k[0] + v[0] * L, k[1] + v[1] * L];
    return { j, k, e, left, foot: e[1] + S * 0.07 };
  });
  /* the floor line: their lower ankle (a little under their hips if the camera can't see their feet) */
  const ank = [L_AN, R_AN].filter(seen).map(i => P(i)[1]);
  const floor = ank.length ? Math.max(...ank) : mh[1] + D * 1.1;
  const ox = mh[0], oy = floor - Math.max(legs[0].foot, legs[1].foot);
  /* the arms: an upper arm and a forearm of fixed length along their angles; straight arms reach (up to 1.3x) */
  const sj = (side) => rot(side * (bw / 2 + S * 0.03), -bh + S * 0.06);
  const arms = [[L_SH, L_EL, L_WR, ls, true], [R_SH, R_EL, R_WR, rs, false]].map(([si, ei, wi, s0, left]) => {
    const side = left ? sl : -sl, j = sj(side), el = seen(ei) ? P(ei) : null, wr = seen(wi) ? P(wi) : null;
    const u = el ? dir(s0, el, DOWN) : wr ? dir(s0, wr, DOWN) : DOWN, v = el && wr ? dir(el, wr, u) : u;
    let reach = 0;
    if (el && wr){ const real = Math.hypot(el[0] - s0[0], el[1] - s0[1]) + Math.hypot(wr[0] - el[0], wr[1] - el[1]); reach = real > 1e-6 ? Math.max(0, Math.min(1, (Math.hypot(wr[0] - s0[0], wr[1] - s0[1]) / real - 0.7) / 0.3)) : 0; }
    else if (wr) reach = 1;
    const L = S * 0.1 * (1 + 0.3 * reach), e = [j[0] + u[0] * L, j[1] + u[1] * L], h2 = [e[0] + v[0] * L, e[1] + v[1] * L];
    return { pts: [j, e, h2], left };
  });
  const tilt = seen(L_EYE) && seen(R_EYE) ? Math.atan2(P(R_EYE)[1] - P(L_EYE)[1], P(R_EYE)[0] - P(L_EYE)[0]) : 0;
  const tip = Math.abs(tilt) > Math.PI / 2 ? tilt - Math.sign(tilt) * Math.PI : tilt;
  paper(c, [ox - S, oy - S * 0.95, S * 2, S * 1.4], S, (cc) => {
    cc.save(); cc.translate(ox, oy);
    /* the cape, then the legs and feet, the arms, the torso, the head */
    cc.save(); cc.rotate(lean); cc.translate(0, -bh); drawCape(cc, a, S, bw, bh); cc.restore();
    for (const l of legs){ drawLeg(cc, a, S, [l.j, l.k, l.e]); drawFoot(cc, S, l.e[0], l.e[1] + S * 0.07); }
    for (const ar of arms) drawArm(cc, a, S, ar.pts, ar.left);
    cc.save(); cc.rotate(lean); cc.translate(0, -bh); drawTorso(cc, a, S, bw, bh); cc.restore();
    cc.save(); cc.rotate(lean); cc.translate(0, -bh - hh / 2 + S * 0.015); cc.rotate(tip * 0.8); cc.translate(0, -hh / 2); drawHead(cc, a, S, false, t); cc.restore();
    cc.restore();
  });
}
