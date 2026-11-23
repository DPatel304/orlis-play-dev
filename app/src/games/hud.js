/* The shared HUD (decision 0034, plan package U3): one set of pieces, drawn one way, in the Orlis UI kit's look (paper, one ink border,
   one soft shadow, Outfit, painted icons). A game never places or sizes anything: it answers hud() with what it wants in each dock and
   the shell (drawShellHud) lays the pieces out on the grid (grid.js), draws them, dims the quiet ones and bounces the changing ones.

   Fixed anchors (the same place in every game; a game may give one back, never move it):
     clock (8,0,4,1)   hint words (6,2,8,1; row 1 when there is no goal)   move card (1,7,3,3)
   Docks (a game chooses what goes in; each has a cap):
     goal    (8,1,4,1)    one bar with three stars                              hud().goal    0..1, or { fill, color }
     corner  (1,0,6,4)    score pills (2 to a row), then chips and bars         hud().corner  [{ icon, value } | { icon, fill, color }]
     top     (13,0,6,3)   up to three badges, or one portrait with a notice    hud().top     { badges: [{ icon, value }] } | { portrait, pose, notice }
     left    (0,4,1,3)    one tall meter                                         hud().left    { icon, fill, color }
     right   (19,4,1,3)   one tall meter                                         hud().right   { icon, fill, color }
     bottom  (5,10,10,1)  one wide bar, or the players' faces                    hud().bottom  { icon, fill, color } | { faces: true }
     badge   (14,9,5,1)   one badge, as wide as its contents                    hud().badge   { icon, value, bump }
   Also: hud().score (per player; the shell draws the pills), scoreStyle ('face' | 'big' | 'faces'), hideScore, hideClock, words { icon, text, t, until }.
   Six piece types only: score pill, chip, bar, meter, badge, portrait-with-notice. Icons are painted library icons (assets/icons.js) named by id.
   Dock pieces dim to 70% after 3 s without a change and come back when they change; anchors never dim. */
import { slot, block, gridOf, SLOTS } from './grid.js';
import { portrait } from '../ui/avatar-art.js';
import { assets } from './assets/index.js';
import { color as pal, alpha as palAlpha } from './assets/palette.js';
import { iconOf, splitHint } from './assets/legacy-emoji.js';
export const hud = { quiet: false };

/* Outfit (decision 0045): the font for everything you read or press, the HUD included; the games' own painted lettering keeps its own fonts */
const FONT = 'Outfit, ui-rounded, "Segoe UI", system-ui, sans-serif';
try { if (typeof document !== 'undefined' && document.fonts) document.fonts.load('700 40px Outfit'); } catch (e){}
const INK = () => pal('shade.ink'), PAPER = () => pal('shade.card'), TRACK = () => pal('shade.line');
const SHADE = () => palAlpha('shade.shadow', 0.18);

/* the words as they are said: no pictures */
export const spoken = (text) => String(text).replace(/[^\p{L}\p{N}\s'’!?.,…-]/gu, '').replace(/\s+/g, ' ').trim();
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
/* the first words of a round arrive big, in the middle of the screen, then shrink and dock into their place; the shell clears this at each round's start */
hud.introText = null; hud.spoken = false; hud.speak = null;   /* (the shell sets speak: the first words of a round are said once, as the game starts) */
const INTRO = { scale: 2, hold: 2.0, travel: 0.55 };

/* ---------- the kit's one piece look ---------- */

/* the colours a bar or meter may be filled with: not a player's colour, and not the arrows' orange (palette names) */
export const BAR_COLORS = { gold: pal('ui.gold'), rose: pal('ui.go'), indigo: '#5b5fc7' };
const barColor = (name) => BAR_COLORS[name] || (typeof name === 'string' && name.includes('.') ? pal(name) : BAR_COLORS.gold);

/* the cell size, to scale every piece from */
const unit = (W, H) => gridOf(W, H).C;

/* a paper piece: a flat soft shadow under it, the paper, one ink border. bw: the border's width in pixels. */
function paper(c, x, y, w, h, r, bw, sh = bw * 1.6){
  c.fillStyle = SHADE(); c.beginPath(); c.roundRect(x, y + sh, w, h, r); c.fill();
  c.fillStyle = PAPER(); c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
  c.strokeStyle = INK(); c.lineWidth = bw; c.beginPath(); c.roundRect(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2)); c.stroke();
}
const bounce = (bump) => 1 + 0.18 * Math.sin(Math.min(1, Math.max(0, bump)) * Math.PI);
const scaled = (c, x, y, w, h, bump) => { c.translate(x + w / 2, y + h / 2); const k = bounce(bump); c.scale(k, k); c.translate(-w / 2, -h / 2); };
/* a painted icon by id, centred. An unknown id draws nothing (the library would draw a "?" box, which has no place on a HUD). */
const iconAt = (c, id, x, y, size, o) => { if (id && assets.has(id)) assets.draw(c, id, x, y, size, o); };
export { iconOf };
const fit = (c, text, font, maxW, size) => { c.font = font(size); const w = c.measureText(text).width; return w > maxW ? Math.max(8, size * maxW / w) : size; };

/* ---------- the hint words (a fixed anchor) ---------- */

/* icon: a library icon id (or none). text: the words. t: seconds since they changed (they ease in). x, y: where, as a share of the screen. until: seconds
   after which they ease away (a hint that has done its job). The first words of a round arrive big and dock. */
export function sayBubble(c, W, H, { icon = '', text: raw, t = 1, x = null, y = null, until = Infinity, row = 2 }){
  if (hud.quiet || !raw) return;
  const old = splitHint(raw), text = old.text; if (!icon) icon = old.icon;   /* (a hint from an older game may still start with an emoji: it becomes the icon that says the same) */
  if (!text) return;
  const C = unit(W, H), ws = slot(W, H, 'words'), rowShift = row === 2 ? 0 : (2 - row) * C;
  if (x === null) x = ws.cx / W; if (y === null) y = (ws.cy - rowShift) / H;   /* the words' place in the grid (a game can still nudge it) */
  const id = iconOf(icon);
  if (hud.introText === null) hud.introText = text;
  if (text === hud.introText && t > 0.05 && !hud.spoken){ hud.spoken = true; if (hud.speak) hud.speak(spoken(text)); }
  const out = isFinite(until) ? Math.max(0, Math.min(1, (until - t) / 0.5)) : 1;
  if (out <= 0) return;
  let k = Math.min(1, t / 0.25), scale = 0.9 + 0.1 * k, px = W * x, py = H * y;
  if (text === hud.introText && t < INTRO.hold + INTRO.travel){
    const e = ease((t - INTRO.hold) / INTRO.travel), bx = W / 2, by = H * 0.42;
    scale = INTRO.scale * (0.6 + 0.4 * ease(t / 0.35)) * (1 - e) + e;
    px = bx + (px - bx) * e; py = by + (py - by) * e;
  }
  const h = C * 0.86, font = (s) => `700 ${Math.round(s)}px ${FONT}`;
  const size = fit(c, text, font, C * 6 - h * (id ? 1.5 : 0.9), C * 0.5);
  c.save(); c.font = font(size);
  const iw = id ? h * 0.78 : 0, w = c.measureText(text).width + h * 0.7 + iw + (id ? h * 0.12 : 0);
  c.globalAlpha = k * out; c.translate(px, py); c.scale(scale, scale);
  paper(c, -w / 2, -h / 2, w, h, h / 2, C * 0.05);
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = INK();
  let tx = -w / 2 + h * 0.35;
  if (id){ iconAt(c, id, tx + iw / 2, 0, h * 0.72); tx += iw + h * 0.12; }
  c.fillText(text, tx, h * 0.03);
  c.restore();
}

/* ---------- the goal bar (a dock) ---------- */

/* The goal bar: a paper bar that fills with gold, with three stars on the way that light up as they are passed (the last is the goal).
   k: how full, 0 to 1. The clock's width, right under it. (A game's own fill colour is not used: gold is the goal's colour.) */
export function goalBar(c, W, H, k, { x = null, y = null, r = null } = {}){
  if (hud.quiet) return;
  const gs = r || slot(W, H, 'goal'), C = unit(W, H), h = gs.h, w = gs.w, bx = (x === null ? gs.x : W * x - w / 2), by = y === null ? gs.y : H * y - h / 2;
  const f = Math.min(1, Math.max(0, k)), th = h * 0.36, tx = bx + h * 0.4, tw = w - h * 0.8, ty = by + (h - th) / 2;
  c.save();
  paper(c, bx, by, w, h, h / 2, C * 0.05);
  c.fillStyle = TRACK(); c.beginPath(); c.roundRect(tx, ty, tw, th, th / 2); c.fill();
  if (f > 0){ c.fillStyle = pal('ui.gold'); c.beginPath(); c.roundRect(tx, ty, Math.max(th, tw * f), th, th / 2); c.fill(); }
  for (const p of [1 / 3, 2 / 3, 1]){
    const on = f >= p - 0.001, sx = tx + tw * p - (p === 1 ? h * 0.1 : 0), sy = by + h / 2, pop = on ? Math.max(0, 1 - (f - p) * 8) : 0;
    iconAt(c, 'star', sx, sy, h * (0.56 + pop * 0.25), { color: on ? pal('ui.gold') : pal('shade.line'), alpha: on ? 1 : 0.9 });
  }
  c.restore();
}

/* ---------- the standard screen: where everything lives (see UI-STANDARD.md) ---------- */

/* The shell's areas, as rectangles in pixels for a screen W by H, worked out from the grid (grid.js). A game keeps anything
   a player has to touch, catch or read out of these; the shell draws on top of them. With a hud() answer, the docks the game
   fills are added (a dock it leaves empty is its world); without one, the four always-there areas. */
export function hudZones(W, H, spec = null){
  const z = (...b) => { const r = block(W, H, ...b); return { x: r.x, y: r.y, w: r.w, h: r.h }; };
  const out = {
    top:   z(7, 0, 6, 3),         /* the clock, the goal bar and the hint words */
    score: z(0, 0, 7, 4),         /* the game's own corner: scores, chips, bars */
    card:  z(1, 7, 3, 3),         /* the move card, bottom left */
    badge: z(14, 9, 5, 1),        /* the game's one badge, bottom right */
  };
  if (spec){
    if (spec.top) out.topright = z(13, 0, 6, 3);
    if (spec.left) out.left = z(0, 4, 1, 3);
    if (spec.right) out.right = z(19, 4, 1, 3);
    if (spec.bottom) out.bottom = z(5, 10, 10, 1);
  }
  return out;
}
/* is this point (pixels) under one of the shell's areas? (for placing targets) */
export function underHud(W, H, x, y, spec = null){
  return Object.values(hudZones(W, H, spec)).some(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
}

/* The game's one badge, bottom right: a streak, lives, a combo. A paper pill with an optional painted icon and a word or number, and the
   same bounce when it changes (bump: 1 right then, back to 0). */
export function badge(c, W, H, { icon = '', value = '', bump = 0, r = null } = {}){
  if (hud.quiet || (icon === '' && value === '')) return;
  const bs = r || slot(W, H, 'badge'), C = unit(W, H), h = bs.h, font = `700 ${Math.round(h * 0.6)}px ${FONT}`, id = iconOf(icon);
  c.save(); c.font = font;
  const tw = c.measureText(String(value)).width, iw = id ? h * 0.8 : 0, w = h * 0.7 + iw + tw + (value !== '' && id ? h * 0.1 : 0);
  c.translate(bs.x + bs.w - w / 2, bs.y + h / 2); const k = bounce(bump); c.scale(k, k); c.translate(-w / 2, -h / 2);
  paper(c, 0, 0, w, h, h / 2, C * 0.045);
  c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = INK();
  if (id) iconAt(c, id, h * 0.35 + iw / 2, h / 2, h * 0.68);
  c.fillText(String(value), h * 0.35 + iw + (id ? h * 0.1 : 0), h / 2 + h * 0.03);
  c.restore();
}

/* ---------- the pieces ---------- */
export const PANEL_ROWS = 4;

/* A player's face: their avatar (portrait) on a tile in their colour, ringed in it. present: false greys it out (out of the camera's view). */
function face(c, cx, cy, s, colour, look, present = true){
  const ring = present ? colour : pal('shade.mid'), r = s * 0.24, w = s * 0.1;
  c.save();
  c.fillStyle = ring; c.beginPath(); c.roundRect(cx - s / 2 - w, cy - s / 2 - w, s + 2 * w, s + 2 * w, r + w); c.fill();
  c.strokeStyle = INK(); c.lineWidth = Math.max(1, s * 0.04); c.beginPath(); c.roundRect(cx - s / 2 - w, cy - s / 2 - w, s + 2 * w, s + 2 * w, r + w); c.stroke();
  if (!present) c.globalAlpha *= 0.55;
  if (look) portrait(c, cx, cy, s, look, 0);
  else { c.fillStyle = PAPER(); c.beginPath(); c.roundRect(cx - s / 2, cy - s / 2, s, s, r); c.fill(); }
  c.restore();
}

/* A player's score: a paper pill with their face (their colour as a ring) and the number. style: 'face' (face and number), 'big' (a big face with a
   small number on it, so four fit in one row) or 'faces' (the face only: who is playing and whether the camera sees them).
   bump: 1 right as the number goes up, easing to 0. mark: { look } (their character). Returns the pill's width. */
export function scorePill(c, x, y, h, color, n, bump = 0, mark = null, { style = 'face', present = true, bw = null } = {}){
  const bwid = bw || Math.max(2, h * 0.06), look = mark && mark.look ? mark.look : null;
  const font = `700 ${Math.round(h * 0.6)}px ${FONT}`, s = h * 0.62;
  c.save(); c.font = font;
  const tw = style === 'face' ? c.measureText(String(n)).width : 0;
  const w = style === 'face' ? Math.max(h * 2.4, h * 1.35 + tw + h * 0.45) : h * 1.08;
  scaled(c, x, y, w, h, bump);
  if (style === 'face'){
    paper(c, 0, 0, w, h, h / 2, bwid);
    face(c, h * 0.62, h / 2, s, color, look, present);
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = present ? INK() : pal('shade.mid');
    c.fillText(String(n), h * 1.3 + (w - h * 1.3) / 2, h / 2 + h * 0.04);
  } else {
    paper(c, 0, 0, w, h, h / 2, bwid);
    face(c, w / 2, h / 2, s * (style === 'big' ? 1.1 : 1), color, look, present);
    if (style === 'big'){
      const q = h * 0.34, qx = w - q * 0.55, qy = h - q * 0.5; c.fillStyle = PAPER(); c.beginPath(); c.arc(qx, qy, q * 0.62, 0, 6.2832); c.fill(); c.strokeStyle = INK(); c.lineWidth = bwid * 0.8; c.stroke();
      c.font = `700 ${Math.round(q * 0.9)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK(); c.fillText(String(n), qx, qy + q * 0.04);
    }
  }
  c.restore();
  return w;
}

/* A chip: a painted icon and a number, for crystals, gold, lives. w: the width to fill (else as wide as its number). Returns the width. */
export function chip(c, x, y, h, { icon = '', value = '', bump = 0, w = null, bw = null } = {}){
  const font = `700 ${Math.round(h * 0.6)}px ${FONT}`, bwid = bw || Math.max(2, h * 0.05);
  c.save(); c.font = font; const width = w || h * 1.25 + c.measureText(String(value)).width + h * 0.25;
  scaled(c, x, y, width, h, bump);
  paper(c, 0, 0, width, h, h / 2, bwid);
  iconAt(c, iconOf(icon), h * 0.55, h / 2, h * 0.66);
  c.font = font; c.fillStyle = INK(); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(String(value), h * 1.05, h / 2 + h * 0.04);
  c.restore();
  return width;
}

/* A bar: a painted icon and a track that fills (fill 0 to 1) in one of BAR_COLORS: XP, health, progress. */
export function statusBar(c, x, y, h, { icon = '', fill = 0, color = 'gold', w = h * 3.6, bw = null } = {}){
  const th = h * 0.38, tx = x + h * 1.0, tw = w - h * 1.3, ty = y + (h - th) / 2, bwid = bw || Math.max(2, h * 0.05);
  c.save(); paper(c, x, y, w, h, h / 2, bwid);
  iconAt(c, iconOf(icon), x + h * 0.55, y + h / 2, h * 0.66);
  c.fillStyle = TRACK(); c.beginPath(); c.roundRect(tx, ty, tw, th, th / 2); c.fill();
  const f = Math.min(1, Math.max(0, fill)); if (f > 0){ c.fillStyle = barColor(color); c.beginPath(); c.roundRect(tx, ty, Math.max(th, tw * f), th, th / 2); c.fill(); }
  c.restore();
}

/* A meter: the bar stood on its end, for a side rail. r: the rectangle in pixels. */
export function meter(c, r, { icon = '', fill = 0, color = 'gold' } = {}){
  const w = r.w, th = w * 0.4, tx = r.x + (w - th) / 2, ty = r.y + w * 1.15, tb = r.y + r.h - w * 0.35, tl = tb - ty, bwid = Math.max(2, w * 0.06);
  c.save(); paper(c, r.x, r.y, w, r.h, w / 2, bwid);
  iconAt(c, iconOf(icon), r.x + w / 2, r.y + w * 0.62, w * 0.62);
  c.fillStyle = TRACK(); c.beginPath(); c.roundRect(tx, ty, th, tl, th / 2); c.fill();
  const f = Math.min(1, Math.max(0, fill)); if (f > 0){ const fh = Math.max(th, tl * f); c.fillStyle = barColor(color); c.beginPath(); c.roundRect(tx, tb - fh, th, fh, th / 2); c.fill(); }
  c.restore();
}

/* A portrait with a notice: a character on a paper card; big (3 x 3) with a short notice while it talks, small (2 x 2) when quiet. */
export function noticePortrait(c, r, { portrait: id = 'cubo', pose = 'wave', t = 0, notice = '', face: f = null } = {}, { C = r.h } = {}){
  const bwid = Math.max(2, C * 0.06);
  c.save(); paper(c, r.x, r.y, r.w, r.h, r.w * 0.2, bwid);
  c.beginPath(); c.roundRect(r.x + bwid, r.y + bwid, r.w - 2 * bwid, r.h - 2 * bwid, r.w * 0.2 - bwid); c.clip();
  assets.draw(c, id, r.x + r.w / 2, r.y + r.h * 0.56, r.h * 0.96, { pose, t, face: f });
  c.restore();
}
function noticePill(c, r, text){
  const h = r.h, C = h, font = (s) => `700 ${Math.round(s)}px ${FONT}`;
  const size = fit(c, text, font, r.w - h * 0.7, h * 0.46);
  c.save(); paper(c, r.x, r.y, r.w, r.h, h / 2, C * 0.05); c.font = font(size); c.fillStyle = INK(); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, r.x + h * 0.35, r.y + h / 2 + h * 0.03); c.restore();
}

/* The clock: numbers beside a thin sun-coloured ring that empties as the time runs out (an anchor: it never dims). */
export function clockPill(c, W, H, secsLeft, total = 0){
  const cs = slot(W, H, 'clock'), C = unit(W, H), t = Math.max(0, Math.ceil(secsLeft));
  const text = t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : String(t);
  const h = cs.h, font = `700 ${Math.round(h * 0.62)}px ${FONT}`;
  c.save(); c.font = font;
  const rr = h * 0.27, w = Math.max(h * 2.6, h * 0.55 + rr * 2 + h * 0.25 + c.measureText(text).width + h * 0.5), x = cs.cx - w / 2;
  paper(c, x, cs.y, w, h, h / 2, C * 0.05);
  const rx = x + h * 0.32 + rr, ry = cs.cy, k = total > 0 ? Math.min(1, Math.max(0, secsLeft / total)) : 1;
  c.lineWidth = h * 0.11; c.lineCap = 'round'; c.strokeStyle = TRACK(); c.beginPath(); c.arc(rx, ry, rr, 0, 6.2832); c.stroke();
  if (k > 0.001){ c.strokeStyle = pal('ui.gold'); c.beginPath(); c.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + k * 6.2832); c.stroke(); }
  c.font = font; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = t <= 10 ? pal('touch.cherry', 'shade') : INK();
  c.fillText(text, rx + rr + h * 0.3, cs.cy + h * 0.04);
  c.restore();
}

/* ---------- the docks: where each piece goes, and how much a dock holds ---------- */

/* the dock cells: [column, row, columns wide, rows tall] (the fixed anchors are in grid.js SLOTS too) */
export const DOCKS = {
  clock: SLOTS.clock, goal: SLOTS.goal, words: SLOTS.words, card: SLOTS.card,
  corner: [1, 0, 6, 4], top: [13, 0, 6, 3], left: [0, 4, 1, 3], right: [19, 4, 1, 3], bottom: [5, 10, 10, 1], badge: SLOTS.badge,
};
/* what each dock holds, at most */
export const CAPS = { scores: 4, cornerRows: PANEL_ROWS, badges: 3, rail: 1, bottom: 1, badge: 1, goal: 1 };

/* one piece's rectangle in a dock, in pixels, with a little room round it so neighbours never touch */
function at(W, H, dock, dc = 0, dr = 0, cs = null, rs = null){
  const d = DOCKS[dock], b = block(W, H, d[0] + dc, d[1] + dr, cs == null ? d[2] : cs, rs == null ? d[3] : rs), p = unit(W, H) * 0.07;
  return { x: b.x + p, y: b.y + p, w: b.w - 2 * p, h: b.h - 2 * p };
}

/* Everything the game asked for, laid out: a list of pieces { key, kind, rect, ... }, in the order they are drawn. A piece a game does not ask for is
   not here (its cells are the game's world), and what goes beyond a dock's cap is dropped. Pure: no canvas. env: { players: [ids], now } */
export function layoutDocks(W, H, spec, env = {}){
  const out = [], s = spec || {}, ids = (env.players || []).slice(0, CAPS.scores);
  const style = s.scoreStyle || 'face', showScores = !s.hideScore || style === 'faces';
  if (!s.hideClock) out.push({ key: 'clock', kind: 'clock', anchor: true });
  let scoreRows = 0;
  if (showScores && ids.length){
    const per = style === 'big' || style === 'faces' ? 4 : 2, cw = style === 'face' ? 3 : 1.5;
    ids.forEach((id, k) => { const row = Math.floor(k / per); scoreRows = Math.max(scoreRows, row + 1);
      out.push({ key: 'p' + id, kind: 'score', player: id, value: (s.score || [])[id], style, rect: at(W, H, 'corner', (k % per) * cw, row, cw, 1) }); });
    if (style !== 'face') scoreRows = 1;
  }
  const rows = (s.corner || s.panel || []); let row = scoreRows, k = 0;
  for (const r of rows){
    if (row >= CAPS.cornerRows) break;
    if (r.fill !== undefined){ if (k % 2){ row++; k = 0; } if (row >= CAPS.cornerRows) break; out.push({ key: 'c' + out.length, kind: 'bar', ...r, rect: at(W, H, 'corner', 0, row, 6, 1) }); row++; k = 0; }
    else { out.push({ key: 'c' + out.length, kind: 'chip', ...r, rect: at(W, H, 'corner', (k % 2) * 3, row, 3, 1) }); k++; if (k === 2){ row++; k = 0; } }
  }
  if (s.goal != null && s.goal !== false) out.push({ key: 'goal', kind: 'goal', fill: typeof s.goal === 'object' ? s.goal.fill : s.goal, rect: at(W, H, 'goal') });
  if (s.words && s.words.text) out.push({ key: 'words', kind: 'words', anchor: true, row: s.goal != null && s.goal !== false ? 2 : 1, ...s.words });
  const t = s.top;
  if (t && t.portrait){
    const talk = !!t.notice;
    out.push({ key: 'top', kind: 'portrait', ...t, rect: talk ? at(W, H, 'top', 3, 0, 3, 3) : at(W, H, 'top', 4, 0, 2, 2) });
    if (talk) out.push({ key: 'notice', kind: 'notice', text: t.notice, rect: at(W, H, 'top', 0, 0, 3, 1) });
  } else if (t && t.badges) t.badges.slice(0, CAPS.badges).forEach((b, i) => out.push({ key: 'tb' + i, kind: 'chip', ...b, rect: at(W, H, 'top', 6 - (i + 1) * 2, 0, 2, 1) }));
  for (const side of ['left', 'right']) if (s[side]) out.push({ key: side, kind: 'meter', ...s[side], rect: at(W, H, side) });
  if (s.bottom){
    if (s.bottom.faces) ids.forEach((id, i) => out.push({ key: 'bf' + id, kind: 'face', player: id, rect: at(W, H, 'bottom', 3 + i * 1.5, 0, 1, 1) }));
    else out.push({ key: 'bottom', kind: 'bar', ...s.bottom, rect: at(W, H, 'bottom') });
  }
  if (s.badge && (s.badge.icon || s.badge.value !== undefined && s.badge.value !== '')) out.push({ key: 'badge', kind: 'badge', ...s.badge, rect: at(W, H, 'badge') });
  return out;
}

/* what each piece looked like last time, for the bounce (when a number goes up) and the dimming (3 s without a change) */
const seen = new Map();
hud.resetPieces = () => seen.clear();
export const IDLE_SECS = 3, IDLE_ALPHA = 0.7;
export function pieceState(key, sig, now, number = null){
  let p = seen.get(key);
  if (!p){ p = { sig, num: number, changed: now, bumped: -1e9 }; seen.set(key, p); }
  else if (p.sig !== sig){ if (number != null && p.num != null && number > p.num) p.bumped = now; p.sig = sig; p.num = number; p.changed = now; }
  return { bump: Math.max(0, 1 - (now - p.bumped) / 450), alpha: now - p.changed > IDLE_SECS * 1000 ? IDLE_ALPHA : 1 };
}

/* Draw the whole HUD for one frame. spec: the game's hud(). env: { players: [ids shown], colors: [by player], lookOf(i), present(i), clock: { left, total }, now } */
export function drawShellHud(c, W, H, spec, env = {}){
  const now = env.now != null ? env.now : performance.now(), pieces = layoutDocks(W, H, spec, env), C = unit(W, H);
  c.save(); c.textBaseline = 'top';
  for (const p of pieces){
    if (p.kind === 'clock'){ clockPill(c, W, H, env.clock ? env.clock.left : 0, env.clock ? env.clock.total : 0); continue; }
    if (p.kind === 'words'){ sayBubble(c, W, H, { icon: p.icon, text: p.text, t: p.t, until: p.until, row: p.row }); continue; }
    const sig = p.kind === 'score' ? p.value : p.kind === 'bar' || p.kind === 'meter' || p.kind === 'goal' ? Math.round((p.fill || 0) * 50) : p.kind === 'chip' || p.kind === 'badge' ? p.value : p.kind === 'portrait' || p.kind === 'notice' ? (p.notice || p.text || '') : '';
    const st = pieceState(p.key, sig, now, typeof p.value === 'number' ? p.value : null), bump = p.bump != null ? Math.max(p.bump, st.bump) : st.bump, r = p.rect;
    c.save(); c.globalAlpha *= p.kind === 'portrait' || p.kind === 'notice' ? 1 : st.alpha;
    switch (p.kind){
      case 'score': scorePill(c, r.x, r.y, r.h, env.colors ? env.colors[p.player] : pal('fav.sky'), p.value == null ? 0 : p.value, bump, { look: env.lookOf ? env.lookOf(p.player) : null }, { style: p.style, present: env.present ? env.present(p.player) : true }); break;
      case 'face': scorePill(c, r.x, r.y, r.h, env.colors ? env.colors[p.player] : pal('fav.sky'), 0, 0, { look: env.lookOf ? env.lookOf(p.player) : null }, { style: 'faces', present: env.present ? env.present(p.player) : true }); break;
      case 'chip': chip(c, r.x, r.y, r.h, { icon: p.icon, value: p.value, bump, w: r.w }); break;
      case 'bar': statusBar(c, r.x, r.y, r.h, { icon: p.icon, fill: p.fill, color: p.color, w: r.w }); break;
      case 'goal': goalBar(c, W, H, p.fill, { r }); break;
      case 'meter': meter(c, r, p); break;
      case 'portrait': noticePortrait(c, r, { ...p, t: now / 1000 }, { C }); break;
      case 'notice': noticePill(c, r, p.text); break;
      case 'badge': badge(c, W, H, { icon: p.icon, value: p.value, bump, r }); break;
    }
    c.restore();
  }
  c.restore();
  return pieces;
}
