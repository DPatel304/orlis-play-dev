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
/* a pale icy wash over the colours of a look (the outline is not one of them) */
const mixHex = (c1, c2, k) => { if (!/^#[0-9a-f]{6}$/i.test(c1) || !/^#[0-9a-f]{6}$/i.test(c2)) return c1; const A = parseInt(c1.slice(1), 16), B = parseInt(c2.slice(1), 16), ch = (sh) => Math.round(((A >> sh) & 255) * (1 - k) + ((B >> sh) & 255) * k); return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); };
const frosted = new WeakMap();
const frost = (a) => { let f = frosted.get(a); if (!f){ const ice = color('sea.sunlit'), m = (c) => mixHex(c, ice, 0.25); f = { ...a, c: m(a.c), c2: m(a.c2), shade: m(a.shade), light: m(a.light), t2: m(a.t2) }; frosted.set(a, f); } return f; };

const rr = (x, a, b, w, h, q) => { x.beginPath(); x.moveTo(a + q, b); x.arcTo(a + w, b, a + w, b + h, q); x.arcTo(a + w, b + h, a, b + h, q); x.arcTo(a, b + h, a, b, q); x.arcTo(a, b, a + w, b, q); x.closePath(); };
const dot = (x, px, py, r) => { x.beginPath(); x.arc(px, py, Math.max(0.1, r), 0, Math.PI * 2); };

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
/* the Chibi body (the owner's choice, decision 0042): the cube head is about 1.25 times the body's width, a short boxy torso with no neck, and
   straight block arms and legs (see the limbs below). All numbers are fractions of the head's size S; tot is the whole height. */
const BODY = { tot: 0.875, bw: 0.37, bh: 0.28, r: 0.075, legLen: 0.19, legW: 0.17, legGap: 0.03, armLen: 0.255, armW: 0.11, armGap: 0.025, hand: 0.07, foot: 0.05, blockR: 0.03 };
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
/* ---------- the arms and legs: straight blocks ----------
   An arm is a block 0.11 wide and 0.255 long hanging beside the torso with a small gap, ending in a light square hand; a leg is a block 0.17
   wide and 0.19 long with a slim gap between the two, ending in a dark square foot. No seam lines (smooth, owner 2026-11-25); where a pose needs it a limb
   bends at its elbow or knee and is drawn as two blocks sharing one outline. Angles are in degrees: 0 is straight
   down, plus is towards the right of the picture (so for the left arm, plus is inwards, over the body). */
const DEG = Math.PI / 180;
/* one block: its top (y0) and bottom (y1) along its own length from the joint (px, py), rotated by th; w wide; `end` paints the hand or foot.
   pass: 'ink' draws only its outline, 'fill' only its colours, both by default - so a bent limb's two blocks share one outline and read as
   one smooth piece (owner, 2026-11-25: no seam lines across the arms and legs) */
function block(x, S, px, py, th, y0, y1, w, fill, end, pass = 'both'){
  const r = Math.min(S * BODY.blockR, (y1 - y0) / 2, w / 2);
  x.save(); x.translate(px, py); x.rotate(-th * DEG);
  if (pass !== 'fill'){ x.strokeStyle = INK(); x.lineWidth = S * 0.016 * (pass === 'ink' ? 2 : 1); x.lineJoin = 'round'; rr(x, -w / 2, y0, w, y1 - y0, r); x.stroke(); }
  if (pass !== 'ink'){
    rr(x, -w / 2, y0, w, y1 - y0, r); x.fillStyle = fill; x.fill();
    if (end){ x.save(); rr(x, -w / 2, y0, w, y1 - y0, r); x.clip(); x.fillStyle = end.col; x.fillRect(-w / 2 - 1, y1 - end.len, w + 2, end.len + 1); x.restore(); }
  }
  if (pass === 'both'){ x.strokeStyle = INK(); x.lineWidth = S * 0.016; x.lineJoin = 'round'; rr(x, -w / 2, y0, w, y1 - y0, r); x.stroke(); }
  x.restore();
}
/* a limb of two blocks: it is one straight block when both angles are the same, and bends at the elbow or knee when they are not (both
   outlines first, then both fills, so there is no line where they meet).
   (px, py) is its joint at the body, `reach` its length from there, `elbow` the bend's distance from the joint, `top` how far the first block
   reaches up behind the body. */
function limb(x, S, px, py, a1, a2, reach, elbow, top, w, fill, end){
  const ex = px + Math.sin(a1 * DEG) * elbow, ey = py + Math.cos(a1 * DEG) * elbow;
  if (Math.abs(a1 - a2) < 0.5) return block(x, S, px, py, a1, -top, reach, w, fill, end);
  for (const pass of ['ink', 'fill']){
    block(x, S, px, py, a1, -top, elbow + S * 0.02, w, fill, null, pass);
    block(x, S, ex, ey, a2, -S * 0.03, reach - elbow, w, fill, end, pass);
  }
}
/* a bold motion arrow (the ink colour, rounded; the paper edge goes round it with the rest): from (px, py) along th, len long */
function motionArrow(x, S, px, py, th, len){
  const dx = Math.sin(th * DEG), dy = Math.cos(th * DEG), head = S * 0.085, hw = S * 0.1, tx = px + dx * len, ty = py + dy * len;
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = INK();
  x.lineWidth = S * 0.05; x.beginPath(); x.moveTo(px, py); x.lineTo(tx - dx * head * 0.6, ty - dy * head * 0.6); x.stroke();
  x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx - dx * head - dy * hw / 2, ty - dy * head + dx * hw / 2); x.lineTo(tx - dx * head + dy * hw / 2, ty - dy * head - dx * hw / 2); x.closePath(); x.fill();
  x.lineWidth = S * 0.02; x.stroke();
  x.restore();
}
/* a leg, hanging from the hip joint (hx, hy) at the bottom edge of the torso; s shortens it (a squat, a lifted foot); a1 the thigh, a2 the shin */
function drawLeg(x, a, S, hx, hy, a1, a2, s = 1){
  const L = S * BODY.legLen * s, w = S * BODY.legW;
  limb(x, S, hx, hy, a1, a2, L, L / 2, S * 0.03, w, a.fit === 'overalls' ? toneRaw(a, 'shade') : a.shade, { col: INK(), len: Math.min(S * BODY.foot, L * 0.4) });
}
/* an arm, hanging from the shoulder joint (sx, sy) (the middle of its top square); the left one is in shade */
function drawArm(x, a, S, sx, sy, a1, a2, left){
  const w = S * BODY.armW, reach = S * BODY.armLen - w / 2, hand = S * BODY.hand, elbow = (S * BODY.armLen - hand) / 2 + S * 0.03 - w / 2;
  const sleeve = a.fit === 'hoodie' ? a.c2 : a.c;
  limb(x, S, sx, sy, a1, a2, reach, elbow, w / 2, w, left ? (a.fit === 'hoodie' ? toneRaw(a, 'shade') : a.shade) : sleeve, { col: a.light, len: hand });
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
function paper(c, box, S, draw, bare = false){
  const m = depth === 0 && c.getTransform ? c.getTransform() : null;
  if (!m || typeof m.a !== 'number' || bare) return plain(c, draw);
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
/* opts.bare: no cream paper edge or shadow around it - just the black outline (the profile head on Home, owner 2026-11-23).
   opts.face: what is moving in the face right now, over the look's own: { blink, look: [x, y], eyes, mouth, brow } (see cubo-idle.js) */
export function head(c, x, y, r, look, t = 0, { back = false, bare = false, face = null } = {}){
  let a = resolve(look); const S = r * 2 / 0.46, { hw, hh } = SIZE(S);
  if (face){
    const o = {}; for (const k of ['eyes', 'mouth', 'brow']) if (face[k] !== undefined) o[k] = face[k];
    a = { ...a, ...o };
  }
  const was = live; if (face) live = { blink: !!face.blink, look: face.look || [0, 0], talk: null };
  try {
    c.save(); c.translate(x, y - hh / 2);
    paper(c, [-hw / 2 - S * 0.03, -S * 0.2, hw + S * 0.06, S * 0.2 + hh + S * 0.03], S, (cc) => drawHead(cc, a, S, back, t), bare);
    c.restore();
  } finally { live = was; }
}

/* ---------- the whole character ----------
   A pose is a rig, in units of the character's size S (y is down, 0 is the floor line), angles in degrees (see the limbs above):
   { yo: the body lifted (up is minus), k: how long the legs are (1 = standing, a squat is simply shorter legs), squash, rot: lean (radians),
     dx: sideways shiver, armsFront: arms drawn over the torso, legs: [left, right] of { a1: thigh, a2: shin, s: this leg's own length },
     arms: [left, right] of { a1: upper arm, a2: forearm } } */
const LG = (a1 = 0, a2 = a1, s = 1) => ({ a1, a2, s });
const AR = (a1 = 0, a2 = a1) => ({ a1, a2 });
const Lp = (a, b, p) => a + (b - a) * p, P = (name, i) => FRAMES[name][i % 4][0];
const rig = (o) => ({ yo: 0, k: 1, legs: [LG(), LG()], arms: [AR(), AR()], ...o });
/* the same pose the other way round */
const mirror = (m) => ({ ...m, rot: m.rot && -m.rot, legs: [m.legs[1], m.legs[0]].map(l => ({ ...l, a1: -l.a1, a2: -l.a2 })), arms: [m.arms[1], m.arms[0]].map(r => ({ a1: -r.a1, a2: -r.a2 })) });
/* the moves with a hand-held arm (wave, cheer, reach): [left arm, right arm], null = hanging */
const ARMS = {
  stand: () => null,
  wave: (d, t) => d < 0 ? AR(-152 + Math.sin(t * 10) * 9) : null,
  cheer: (d) => AR(d * 142),
  reach: (d) => AR(d * 168)
};
/* the story's moves, drawn for this body: four stills that repeat, like the move cards' */
const MOVES = {
  /* a clear stride, seen from the front: one foot out and planted, the other stepping through, the arms swinging against the legs */
  march: (i) => {
    const A = rig({ legs: [LG(-9), LG(9)], arms: [AR(-24), AR(8)] });
    const B = rig({ legs: [LG(-3), LG(6, 6, 0.72)], arms: [AR(-8), AR(12)] });
    return [A, B, mirror(A), mirror(B)][i % 4];
  },
  /* a run, in four stills (each ~0.2 s): in the air with the front knee up and out and the foot under it, the back leg pushing off
     diagonally; then landing low on the front foot with the other leg trailing; then the same on the other side. The torso and head stay fully
     upright (no lean at all; the speed is in the legs, the arms and the bob), the arms are bent at the elbow and pump close to the body
     against the legs, and the body bobs up and down between the stills. */
  run: (i) => {
    const k = i % 4, air = k % 2 === 0, f = k < 2 ? 1 : -1;
    const legOf = (side) => { const front = side === f;
      return air ? (front ? LG(side * 68, side * -12) : LG(side * 25, side * 45)) : (front ? LG(side * 12) : LG(side * 30, side * 50)); };
    const armOf = (side) => { const fwd = side === -f;
      return air ? (fwd ? AR(side * 10, side * 68) : AR(side * 30, side * 22)) : AR(side * 20, side * 80); };
    return rig({ yo: air ? -0.04 : 0.004, legs: [legOf(-1), legOf(1)], arms: [armOf(-1), armOf(1)] });
  },
  /* off the ground, in four stills: the landing squash (the whole body squashes, feet apart), the take-off (legs stretched down together,
     arms up), the top (legs together, arms up in a V), the way down (legs reaching for the ground). The shadow stays on the grass. */
  jump: (i) => {
    if (i % 4 === 0) return rig({ yo: 0, k: 0.85, squash: 0.09, legs: [LG(-12), LG(12)], arms: [AR(-38), AR(38)] });
    if (i % 4 === 1) return rig({ yo: -0.2, legs: [LG(-2), LG(2)], arms: [AR(-150), AR(150)] });
    if (i % 4 === 2) return rig({ yo: -0.32, legs: [LG(-8, 4), LG(8, -4)], arms: [AR(-148), AR(148)] });
    return rig({ yo: -0.17, legs: [LG(-5), LG(5)], arms: [AR(-128), AR(128)] });
  },
  /* a squat, from the front, in four stills (down, down, hold, hold): the legs simply get shorter (0.65 of their length at the bottom; the
     same straight blocks and feet, a touch wider apart), the torso comes down with them, and the arms come forward, slightly apart, over it */
  squat: (i) => {
    const p = [0.4, 0.8, 1, 1][i % 4];
    return rig({ k: 1 - 0.35 * p, armsFront: true, legs: [LG(-4 * p), LG(4 * p)], arms: [AR(36 * p), AR(-36 * p)] });
  },
  /* a clap: the hands come in over the chest until the hand ends touch, with a small burst over them */
  clap: (i) => { const p = P('clap', i); return rig({ sho: { x: Lp(0.265, 0.19, p), y: Lp(0.055, 0.1, p) }, armsFront: true, mark: p > 0.99 ? 'burst' : null, arms: [AR(Lp(-40, 55, p)), AR(Lp(40, -55, p))] }); },
  /* a hug: the arms come in and cross over the body, one over the other */
  hug: (i) => { const p = P('hug', i); return rig({ sho: { x: Lp(0.265, 0.1, p), y: Lp(0.055, 0.11, p) }, armsFront: true, arms: [AR(Lp(-50, 72, p)), AR(Lp(50, -72, p))] }); },
  /* a duck: the legs get shorter (as in the squat) so he drops low, the head sinks between the shoulders, both hands go up on his head (the arms
     bend at the elbow; his arms are short, so they reach the sides of his head), and a small arrow points down over him */
  duck: (i) => { const p = 0.3 + 0.7 * P('duck', i); return rig({ k: Lp(1, 0.55, p), headDrop: Lp(0, 0.16, p), armsOver: true, mark: 'down', arms: [AR(Lp(0, -150, p), Lp(0, 150, p)), AR(Lp(0, 150, p), Lp(0, -150, p))] }); },
  /* a step sideways: one leg straight down, the other straight out at an angle, the arms out, and an arrow beside the leg that goes out */
  side: (i) => { const p = P('side', i); return rig({ rot: Lp(0, 0.05, p), mark: 'step', legs: [LG(0), LG(Lp(0, 30, p))], arms: [AR(-Lp(10, 74, p)), AR(Lp(10, 74, p))] }); },
  /* frozen: stiff and still, the arms a little out from the body. The only motion is a tiny shiver (about a pixel). When he shows it as a move to copy
     (arrows) he also gets a pale frost tint, ice sparkles round him and two short stillness ticks either side of his head - and no arrows, which mean "move" */
  freeze: (i) => rig({ dx: (i % 2 ? 1 : -1) * 0.006, mark: 'ice', frame: i, arms: [AR(-26), AR(26)] })
};
/* the other move cards (flap, clap, hug, lean, duck, dance, side) are drawn from the cards' own drawings (figure.js POSES): their arm and leg
   points give the angles of the blocks (the lengths are always the blocks' own) */
const aim = (p, q) => Math.atan2(q[0] - p[0], q[1] - p[1]) / DEG;
function fromCard(pose, p){
  const q = POSES[pose](p), U = 0.5, V = 0.435, sx = 0.215, sy = -0.385;
  const fx = (px) => px * U, fy = (py) => py * V - V * 0.7;
  const arms = q.arms.map((ar, i) => { const d = i ? 1 : -1, o = [d * sx, sy];
    const pts = ar.map(([px, py]) => [d * sx + (px * U - d * sx) * 0.8, sy + (sy + (py + 0.6) * V - sy) * 0.8]);
    return AR(aim(o, pts[0]), pts[1] ? aim(pts[0], pts[1]) : aim(o, pts[0])); });
  const m = rig({ rot: (q.lean || 0) * 0.35, arms, yo: (q.yOff || 0) * V * 0.43, armsFront: pose === 'clap' || pose === 'hug' || pose === 'duck' || pose === 'side' });
  if (q.legs){
    const L = BODY.legLen, reach = [];
    m.legs = q.legs.map(([kn, ft], i) => { const d = i ? 1 : -1, hip = [d * 0.1, -0.135 + m.yo], k = [fx(kn[0]) * 0.8, fy(kn[1]) * 0.43], f = [fx(ft[0]) * 0.8, fy(ft[1]) * 0.43];
      const cl = (v) => Math.max(-50, Math.min(50, v)), l = LG(cl(aim(hip, k)), cl(aim(k, f))); reach.push((Math.cos(l.a1 * DEG) + Math.cos(l.a2 * DEG)) * L / 2); return l; });
    /* the legs' own length decides how low the body sits: the lower foot is on the floor */
    m.yo = L - Math.max(...reach);
  }
  return m;
}
function rigOf(pose, t, idle){
  if (pose in ARMS){
    const f = ARMS[pose];
    return rig({ arms: [f(-1, t) || AR(), f(1, t) || AR()] });
  }
  const i = frameAt(pose, t).i;
  if (MOVES[pose]) return MOVES[pose](i);
  if (POSES[pose]) return fromCard(pose, frameAt(pose, t).p);
  return rig({});
}
/* standing still he breathes: a gentle bob (about 2% of his height, every 2.5 s - the legs lengthen and shorten a little, the feet stay put)
   and a slight sway of the arms (not for the small portraits) */
function idleRig(t){
  const b = Math.sin(t * Math.PI * 2 / 2.5), sway = (d) => d * (1.5 + 2.2 * Math.sin(t * Math.PI * 2 / 2.5 + 1.3 + d));
  return rig({ k: 1 - 0.01 * b / BODY.legLen, arms: [AR(sway(-1)), AR(sway(1))] });
}

/* where an arm's arrow starts (S units, from the arm's joint): beside the arm on its outer side, but never touching the head (or the hat, hair or ears
   on it): if the outer side would, try the arm's other side, then slide it outward along the arm until it is clear (keeping a gap).
   head: { x0, x1, y0, y1 } in S units. */
const HAT_UP = { none: 0, tuft: 0.1, bob: 0.04, cap: 0.06, beanie: 0.11, bow: 0.08, crown: 0.1, phones: 0, ears: 0.17, flower: 0.05 };
function armArrow(a1, d, sx, sy, head){
  const u = [Math.sin(a1 * DEG), Math.cos(a1 * DEG)];
  let px = Math.cos(a1 * DEG), py = -Math.sin(a1 * DEG);
  if (Math.abs(px) < 0.45 ? py > 0 : px * d < 0){ px = -px; py = -py; }
  const off = BODY.armW / 2 + 0.09, len = BODY.armLen, m = 0.09;
  const at = (side, shift) => [sx + side * px * off + u[0] * shift, sy + side * py * off + u[1] * shift];
  const clear = ([x, y]) => { for (let k = 0; k <= 10; k++){ const f = k / 10, qx = x + u[0] * len * f, qy = y + u[1] * len * f;
    if (qx > head.x0 - m && qx < head.x1 + m && qy > head.y0 - m && qy < head.y1 + m) return false; } return true; };
  const tries = [[1, 0], [-1, 0]];
  for (let sh = 0.03; sh <= 0.45; sh += 0.03) tries.push([1, sh], [-1, sh]);
  for (const [side, shift] of tries){ const q = at(side, shift); if (clear(q)) return q; }
  return at(1, 0);
}
/* where a pose is drawn, in units of the character's size S measured from the middle of the feet's line (y is down): the box round all four of its
   drawings, with its arrows and marks, for the move cards to centre and size him by */
const boundsCache = new Map();
export function poseBounds(pose, arrows = true){
  const key = pose + arrows, hit = boundsCache.get(key); if (hit) return hit;
  let x0 = -0.3, x1 = 0.3, y0 = 0, y1 = 0.04;
  const add = (x, y, m = 0.06) => { x0 = Math.min(x0, x - m); x1 = Math.max(x1, x + m); y0 = Math.min(y0, y - m); y1 = Math.max(y1, y + m); };
  const dirOf = (a) => [Math.sin(a * DEG), Math.cos(a * DEG)], L = BODY.legLen, lx = (BODY.legGap + BODY.legW) / 2;
  for (let i = 0; i < 4; i++){
    const rg = rigOf(pose, (i + 0.01) / 5), hipY = -L * rg.k + rg.yo, torsoTop = hipY - BODY.bh, headTop = torsoTop + 0.015 - 0.42 + (rg.headDrop || 0), m = rg.rot ? 0.05 : 0;
    add(-0.23, headTop, 0.04 + m); add(0.23, headTop, 0.04 + m); add(-0.185, torsoTop, 0.04 + m); add(0.185, hipY, 0.04 + m);
    [-1, 1].forEach((d, k) => {
      const lg = rg.legs[k], e = L * lg.s * rg.k / 2, q = dirOf(lg.a1), r = dirOf(lg.a2), p1 = [d * lx + q[0] * e, hipY + q[1] * e];
      add(p1[0], p1[1], 0.085); add(p1[0] + r[0] * e, p1[1] + r[1] * e, 0.085);
      const sx = d * (rg.sho ? rg.sho.x : 0.265), sy = torsoTop + (rg.sho ? rg.sho.y : 0.055), ar = rg.arms[k], u = dirOf(ar.a1), v = dirOf(ar.a2), el = 0.0675, hd = 0.1325;
      add(sx, sy, 0.06); add(sx + u[0] * el, sy + u[1] * el, 0.07); add(sx + u[0] * el + v[0] * hd, sy + u[1] * el + v[1] * hd, 0.07 + m);
      if (arrows && !rg.sho && Math.abs(ar.a1 - ar.a2) <= 1 && Math.abs(ar.a1) >= 55){
        const st = armArrow(ar.a1, d, sx, sy, { x0: -0.25, x1: 0.25, y0: headTop, y1: headTop + 0.42 });
        add(st[0], st[1], 0.05); add(st[0] + u[0] * BODY.armLen, st[1] + u[1] * BODY.armLen, 0.07 + m);
      }
    });
    if (arrows && rg.mark === 'down') add(0, headTop - 0.24, 0.07);
    if (arrows && rg.mark === 'ice'){ add(-0.46, -0.9, 0.07); add(0.46, 0, 0.07); add(0.4, headTop + 0.21, 0.05); }
    if (arrows && rg.mark === 'burst') add(0, torsoTop + 0.04, 0.05);
    if (arrows && rg.mark === 'step') add(lx + L * Math.sin(rg.legs[1].a1 * DEG) + 0.17 + 0.16, -0.07, 0.07);
  }
  const b = { x0, x1, y0, y1 }; boundsCache.set(key, b); return b;
}

/* opts.arrows: he is showing a move to copy (a move card, a story beat that says "do this"): a bold arrow beside each straight, stretched-out arm
   (freeze, the arms-up V, a cheer, a reach, a flap), parallel to it, makes the reach read bigger than the stubby arms. Acting in a story beat has none. */
export function body(c, x, base, h, look, t = 0, pose = 'stand', { back = false, face: alive = null, still = false, arrows = false } = {}){
  const a0 = resolve(look), S = h, { hh, bw, bh } = SIZE(S);
  const rg = pose === 'stand' && !still && !back ? idleRig(t) : rigOf(pose, t), a = arrows && rg.mark === 'ice' ? frost(a0) : a0;
  const hipY = -S * BODY.legLen * rg.k + rg.yo * S, torsoTop = hipY - bh, headTop = torsoTop + S * 0.015 - hh + (rg.headDrop || 0) * S, rot = rg.rot || 0, dx = (rg.dx || 0) * S;
  const lx = S * (BODY.legGap + BODY.legW) / 2, ax = bw / 2 + S * (BODY.armGap + BODY.armW / 2), ay = torsoTop + S * BODY.armW / 2;
  /* where the arms hang from: the torso's top corners, or (clap, hug) further in over the chest */
  const shx = rg.sho ? rg.sho.x * S : ax, shy = rg.sho ? torsoTop + rg.sho.y * S : ay;
  /* their shadow on the ground (outside the cut: it has no paper edge) */
  c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(x, base, S * 0.3, S * 0.04, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(x + dx, base);
  const sq = rg.squash || 0; if (sq) c.scale(1 + sq * 0.7, 1 - sq);
  live = alive;
  paper(c, [-S * 0.75, -S * 1.3, S * 1.5, S * 1.34], S, (cc) => {
    const lean = () => { if (rot){ cc.translate(0, hipY); cc.rotate(rot); cc.translate(0, -hipY); } };
    cc.save(); lean(); cc.save(); cc.translate(0, torsoTop); drawCape(cc, a, S, bw, bh); cc.restore(); cc.restore();
    [-1, 1].forEach((d, i) => { const l = rg.legs[i]; drawLeg(cc, a, S, d * lx, hipY, l.a1, l.a2, l.s * rg.k); });
    cc.save(); lean();
    const arms = () => [-1, 1].forEach((d, i) => drawArm(cc, a, S, d * shx, shy, rg.arms[i].a1, rg.arms[i].a2, d < 0));
    if (!rg.armsFront && !rg.armsOver) arms();
    cc.save(); cc.translate(0, torsoTop); drawTorso(cc, a, S, bw, bh); cc.restore();
    if (rg.armsFront) arms();
    cc.save(); cc.translate(0, headTop); drawHead(cc, a, S, back, t); cc.restore();
    if (rg.armsOver) arms();
    if (arrows) [-1, 1].forEach((d, i) => { const r = rg.arms[i];
      if (rg.sho || rg.mark === 'ice' || Math.abs(r.a1 - r.a2) > 1 || Math.abs(r.a1) < 55) return;
      /* beside the arm, not on its end: parallel to it, on its outer side (the upper side when it points straight out), one arm-width and a clear gap
         away, about the arm's own length, pointing the way the arm goes; never over the head or what he wears on it */
      const head = { x0: a.top === 'phones' ? -0.29 : -0.25, x1: a.top === 'phones' ? 0.29 : 0.25, y0: headTop / S - HAT_UP[a.top || 'none'], y1: headTop / S + 0.42 };
      const st = armArrow(r.a1, d, d * ax / S, ay / S, head), pulse = still ? 1 : 1 + 0.15 * Math.sin(t * Math.PI * 2 * 1.6);
      motionArrow(cc, S, st[0] * S, st[1] * S, r.a1, S * BODY.armLen * pulse); });
    /* the move's own marks: a small burst over the clapping hands, a down arrow over a ducking head, a step arrow beside the leg that goes out */
    if (arrows && rg.mark){
      const pulse = still ? 1 : 1 + 0.15 * Math.sin(t * Math.PI * 2 * 1.6);
      if (rg.mark === 'burst'){ cc.save(); cc.strokeStyle = INK(); cc.lineWidth = S * 0.025; cc.lineCap = 'round';
        for (const an of [-150, -120, -90, -60, -30]){ const u = [Math.cos(an * DEG), Math.sin(an * DEG)], r0 = S * 0.04 * pulse, r1 = S * (an === -90 ? 0.1 : 0.08) * pulse;
          cc.beginPath(); cc.moveTo(u[0] * r0, torsoTop + S * 0.12 + u[1] * r0); cc.lineTo(u[0] * r1, torsoTop + S * 0.12 + u[1] * r1); cc.stroke(); }
        cc.restore(); }
      if (rg.mark === 'ice'){ cc.save(); cc.strokeStyle = INK(); cc.lineWidth = S * 0.02; cc.lineCap = 'round'; cc.lineJoin = 'round';
        const hy = headTop + S * 0.21;
        for (const d of [-1, 1]) for (const o of [0.31, 0.37]){ cc.beginPath(); cc.moveTo(d * o * S, hy - S * 0.045); cc.lineTo(d * o * S, hy + S * 0.045); cc.stroke(); }
        [[-0.42, -0.86], [0.44, -0.44], [-0.45, -0.06], [0.45, -0.14]].forEach(([sx, sy], j) => { if ((j + (rg.frame || 0)) % 2) return;   /* ice sparkles, a different pair each drawing */
          const r = S * 0.045; cc.beginPath(); cc.moveTo(sx * S, sy * S - r * 1.5); cc.lineTo(sx * S + r, sy * S); cc.lineTo(sx * S, sy * S + r * 1.5); cc.lineTo(sx * S - r, sy * S); cc.closePath();
          cc.fillStyle = color('sea.sunlit'); cc.fill(); cc.lineWidth = S * 0.014; cc.stroke(); });
        cc.restore(); }
      if (rg.mark === 'down') motionArrow(cc, S, 0, headTop - S * 0.24, 0, S * 0.14 * pulse);
      if (rg.mark === 'step') motionArrow(cc, S, lx + S * BODY.legLen * Math.sin(rg.legs[1].a1 * DEG) + S * 0.17, -S * 0.07, 90, S * 0.16 * pulse);
    }
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
/* opts.look: which way his eyes glance ([x, y], -1..1); opts.talk: true while the voice reads about him; opts.arrows: he is showing a move to copy (see body) */
export function cuboFigure(c, x, base, h, pose = 'stand', t = 0, face = null, { look = null, talk = false, arrows = false } = {}){
  const f = face || (pose === 'squat' ? 'grin' : FRAMES[pose] ? frameAt(pose, t).face : 'smile');
  const m = talk ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.4 + Math.sin(t * 1.7) * 1.5) : null;
  body(c, x, base, h, CUBO_LOOKS[f] || CUBO_LOOKS.smile, t, pose, { face: { blink: blinkAt(t), look, talk: m }, arrows });
}

/* ---------- a portrait: for tiles and name chips ---------- */
export function portrait(c, x, y, s, look, t = 0, { tile = true, bare = false, face = null } = {}){
  const a = resolve(look);
  c.save();
  if (tile){
    c.beginPath(); c.roundRect ? c.roundRect(x - s / 2, y - s / 2, s, s, s * 0.22) : c.rect(x - s / 2, y - s / 2, s, s);
    c.fillStyle = a.light; c.fill(); c.clip();
  }
  /* just the cube head, floating (owner, 2026-11-23: no shoulders peeking in at the bottom) */
  head(c, x, y, s * 0.4, look, t, { bare, face });
  c.restore();
}

/* ---------- the character as a player: posed by the camera ----------
   The character drawn where a player is, as a mirror: it takes only the DIRECTIONS of the player's limbs from the camera (the angles of
   their upper arms, forearms, thighs and shins, how much their torso leans, how their head tilts), never their lengths. It is always the
   Chibi character with its own fixed proportions (the same block arms and legs, which bend at their elbow and knee), sized from the
   player's head-to-hip span, standing on the floor line under the player (the lower ankle - so it lifts when they jump), with its hips over
   theirs. Only the drawing is done here: games use the real landmarks for hit points, and this changes none of that.
   lm: the pose landmarks (0..1, mirrored); lift: how far up to draw them (px). */
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
  /* the size: from their head-to-hip span (the character's head centre to the bottom of its torso is 0.475 of its head size) */
  const nose = seen(NOSE) ? P(NOSE) : [ms[0], ms[1] - sw * 0.8];
  const D = Math.max(sw * 1.6, Math.min(sw * 4, Math.hypot(nose[0] - mh[0], nose[1] - mh[1])));
  const S = D / 0.475, { hh, bw, bh } = SIZE(S);
  const a = resolve(look);
  /* which of their sides is on the left of the picture */
  const sl = ls[0] <= rs[0] ? -1 : 1;
  const cs = Math.cos(lean), sn = Math.sin(lean);
  const rot = (px, py) => [px * cs - py * sn, px * sn + py * cs];               /* the torso's own frame -> the picture (origin: the middle of the torso's bottom edge) */
  const dir = (p, q, fb) => { const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy); return d > 1e-6 ? [dx / d, dy / d] : fb; };
  const ang = (u) => Math.atan2(u[0], u[1]) / DEG;
  /* the legs: two blocks each, pointing the way their thigh and shin do; the hips go where they must for the feet to be on the floor */
  const DOWN = [0, 1], LL = S * BODY.legLen, lw = S * (BODY.legGap + BODY.legW) / 2;
  const legs = [[L_HIP, L_KN, L_AN, lh, true], [R_HIP, R_KN, R_AN, rh, false]].map(([hi, ki, ai, h0, left]) => {
    const side = left ? sl : -sl, j = rot(side * lw, 0), kn = seen(ki) ? P(ki) : null, an = seen(ai) ? P(ai) : null;
    const u = kn ? dir(h0, kn, DOWN) : DOWN, v = kn && an ? dir(kn, an, u) : u, a1 = ang(u), a2 = ang(v);
    return { j, a1, a2, left, foot: j[1] + (Math.cos(a1 * DEG) + Math.cos(a2 * DEG)) * LL / 2 };
  });
  /* the floor line: their lower ankle (a little under their hips if the camera can't see their feet) */
  const ank = [L_AN, R_AN].filter(seen).map(i => P(i)[1]);
  const floor = ank.length ? Math.max(...ank) : mh[1] + D * 1.1;
  const ox = mh[0], oy = floor - Math.max(legs[0].foot, legs[1].foot);
  /* the arms: an upper arm and a forearm along their angles, always the blocks' own length (the shoulder is at the top corner of the torso) */
  const sj = (side) => rot(side * (bw / 2 + S * (BODY.armGap + BODY.armW / 2)), -bh + S * BODY.armW / 2);
  const arms = [[L_SH, L_EL, L_WR, ls, true], [R_SH, R_EL, R_WR, rs, false]].map(([si, ei, wi, s0, left]) => {
    const side = left ? sl : -sl, j = sj(side), el = seen(ei) ? P(ei) : null, wr = seen(wi) ? P(wi) : null;
    const u = el ? dir(s0, el, DOWN) : wr ? dir(s0, wr, DOWN) : DOWN, v = el && wr ? dir(el, wr, u) : u;
    return { j, a1: ang(u), a2: ang(v), left };
  });
  const tilt = seen(L_EYE) && seen(R_EYE) ? Math.atan2(P(R_EYE)[1] - P(L_EYE)[1], P(R_EYE)[0] - P(L_EYE)[0]) : 0;
  const tip = Math.abs(tilt) > Math.PI / 2 ? tilt - Math.sign(tilt) * Math.PI : tilt;
  paper(c, [ox - S, oy - S * 0.95, S * 2, S * 1.4], S, (cc) => {
    cc.save(); cc.translate(ox, oy);
    /* the cape, then the legs and feet, the arms, the torso, the head */
    cc.save(); cc.rotate(lean); cc.translate(0, -bh); drawCape(cc, a, S, bw, bh); cc.restore();
    for (const l of legs) drawLeg(cc, a, S, l.j[0], l.j[1], l.a1, l.a2);
    for (const ar of arms) drawArm(cc, a, S, ar.j[0], ar.j[1], ar.a1, ar.a2, ar.left);
    cc.save(); cc.rotate(lean); cc.translate(0, -bh); drawTorso(cc, a, S, bw, bh); cc.restore();
    cc.save(); cc.rotate(lean); cc.translate(0, -bh - hh / 2 + S * 0.015); cc.rotate(tip * 0.8); cc.translate(0, -hh / 2); drawHead(cc, a, S, false, t); cc.restore();
    cc.restore();
  });
}
