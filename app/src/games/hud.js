/* The words and the meter every game puts on its sky, drawn one way: a speech bubble under the clock, and under that, if
   the game has something to fill, a bar. (The clock is the shell's, top centre; a score, if a game shows one, is the
   game's own, top right.) They go away on the results screen, so nothing from the game sits behind "Well played!". */
import { slot, slotBlock, gridOf, block } from './grid.js';
export const hud = { quiet: false };

const INK = '#33322e', PAPER = 'rgba(250,247,238,.95)';
const FONT = 'Inter, Segoe UI, sans-serif';

/* text: the words. t: seconds since they changed (they ease in). x, y: where, as a share of the screen. until: seconds
   after which they ease away (a hint that has done its job). */
export function sayBubble(c, W, H, { text, t = 1, x = null, y = null, until = Infinity }){
  if (hud.quiet || !text) return;
  const ws = slot(W, H, 'words'); if (x === null) x = ws.cx / W; if (y === null) y = ws.cy / H;   /* the words' place in the grid (a game can still nudge it) */
  const k = Math.min(1, t / 0.25), out = isFinite(until) ? Math.max(0, Math.min(1, (until - t) / 0.5)) : 1;
  if (out <= 0) return;
  const size = Math.round(H * 0.04);
  c.save(); c.font = `800 ${size}px ${FONT}`;
  const w = c.measureText(text).width + size * 1.6;
  c.globalAlpha = k * out; c.translate(W * x, H * y); c.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  c.fillStyle = PAPER; c.beginPath(); c.roundRect(-w / 2, -size * 0.95, w, size * 1.9, size * 0.95); c.fill();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 2);
  c.restore();
}

/* k: how full, 0 to 1. color: the fill (gold when done). Under the words. */
export function goalBar(c, W, H, k, { color = '#7398c4', x = null, y = null } = {}){
  if (hud.quiet) return;
  const gs = slot(W, H, 'goal'), w = gs.w, h = H * 0.022, bx = (x === null ? gs.cx : W * x) - w / 2, by = y === null ? gs.cy - h / 2 : H * y;
  c.save();
  c.fillStyle = 'rgba(250,247,238,.9)'; c.beginPath(); c.roundRect(bx, by, w, h, h / 2); c.fill();
  if (k > 0){ c.fillStyle = color; c.beginPath(); c.roundRect(bx + 3, by + 3, Math.max(h - 6, (w - 6) * Math.min(1, k)), h - 6, (h - 6) / 2); c.fill(); }
  c.restore();
}

/* ---------- the standard screen: where everything lives (see UI-STANDARD.md) ---------- */

/* The shell's areas, as rectangles in pixels for a screen W by H, worked out from the grid (grid.js). A game keeps anything
   a player has to touch, catch or read out of these; the shell draws on top of them. */
export function hudZones(W, H){
  const z = (...b) => { const r = block(W, H, ...b); return { x: r.x, y: r.y, w: r.w, h: r.h }; };
  return {
    top:   z(7, 0, 6, 3),         /* the clock, the hint words and the goal bar */
    score: z(0, 0, 7, 4),         /* the game's own corner: scores, chips, bars */
    card:  z(16, 0, 3, 3),        /* the move card */
    badge: z(14, 3, 5, 1),        /* the game's one badge, under the card */
  };
}
/* is this point (pixels) under one of the shell's areas? (for placing targets) */
export function underHud(W, H, x, y){
  return Object.values(hudZones(W, H)).some(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
}

/* The game's one badge, under the move card: a streak, lives, a combo. The same cream pill the scores use, with an optional picture
   (an emoji), a word or number, and the same bounce when it changes (bump: 1 right then, back to 0). */
export function badge(c, W, H, { icon = '', value = '', color = '#7398c4', bump = 0 } = {}){
  if (hud.quiet || (icon === '' && value === '')) return;
  const bs = slot(W, H, 'badge'), h = bs.h, font = `800 ${Math.round(h * 0.62)}px ${FONT}`;
  c.save(); c.font = font;
  const tw = c.measureText(String(value)).width, iw = icon ? h * 0.9 : 0, w = h * 0.7 + iw + tw + (value !== '' ? h * 0.2 : 0);
  c.translate(bs.x + bs.w - w / 2, bs.y + h / 2); const k = 1 + 0.28 * Math.sin(Math.min(1, bump) * Math.PI); c.scale(k, k); c.translate(-w / 2, -h / 2);
  c.shadowColor = 'rgba(20,20,60,.25)'; c.shadowBlur = h * 0.25; c.shadowOffsetY = h * 0.07;
  c.fillStyle = 'rgba(252,250,244,.96)'; c.beginPath(); c.roundRect(0, 0, w, h, h / 2); c.fill(); c.shadowColor = 'transparent';
  c.textBaseline = 'middle'; c.textAlign = 'left';
  if (icon){ c.font = `${Math.round(h * 0.56)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; c.fillStyle = '#000'; c.fillText(icon, h * 0.35, h / 2 + 2); }
  c.font = font; c.fillStyle = color; c.fillText(String(value), h * 0.35 + iw + (icon ? h * 0.1 : 0), h / 2 + 2);
  c.restore();
}

/* ---------- the status panel, top left: the game's own corner, built from three shared pieces ---------- */

/* The colours a bar may be filled with: not a player's colour, and not the arrows' orange. */
export const BAR_COLORS = { gold: '#f5c542', rose: '#e85d8a', indigo: '#5b5fc7' };
/* The scores take the first row of the corner; the game's own chips and bars take at most this many rows under them. */
export const PANEL_ROWS = 3;

const bounce = (bump) => 1 + 0.28 * Math.sin(Math.min(1, Math.max(0, bump)) * Math.PI);
function lift(c, h){ c.shadowColor = 'rgba(20,20,60,.25)'; c.shadowBlur = h * 0.25; c.shadowOffsetY = h * 0.07; }

/* A player's score: a pill in their colour with a big white number. bump: 1 right as it goes up, easing to 0. */
export function scorePill(c, x, y, h, color, n, bump = 0){
  const font = `800 ${Math.round(h * 0.66)}px ${FONT}`;
  c.save(); c.font = font; const w = Math.max(h * 1.35, h * 0.9 + c.measureText(String(n)).width);
  c.translate(x + w / 2, y + h / 2); const k = bounce(bump); c.scale(k, k); c.translate(-w / 2, -h / 2);
  lift(c, h); c.fillStyle = color; c.beginPath(); c.roundRect(0, 0, w, h, h / 2); c.fill(); c.shadowColor = 'transparent';
  c.strokeStyle = '#fff'; c.lineWidth = h * 0.07; c.beginPath(); c.roundRect(h * 0.035, h * 0.035, w - h * 0.07, h - h * 0.07, h / 2); c.stroke();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, h / 2 + 2);
  c.restore();
  return w;
}

/* A cream chip: a picture (an emoji) and a number, for crystals, gold, lives. */
export function chip(c, x, y, h, { icon = '', value = '', bump = 0 } = {}){
  const font = `800 ${Math.round(h * 0.66)}px ${FONT}`;
  c.save(); c.font = font; const w = h * 1.25 + c.measureText(String(value)).width + h * 0.2;
  c.translate(x + w / 2, y + h / 2); const k = bounce(bump); c.scale(k, k); c.translate(-w / 2, -h / 2);
  lift(c, h); c.fillStyle = 'rgba(252,250,244,.96)'; c.beginPath(); c.roundRect(0, 0, w, h, h / 2); c.fill(); c.shadowColor = 'transparent';
  c.textBaseline = 'middle'; c.textAlign = 'center';
  c.font = `${Math.round(h * 0.58)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; c.fillStyle = '#000'; c.fillText(icon, h * 0.55, h / 2 + 2);
  c.font = font; c.fillStyle = '#33322e'; c.textAlign = 'left'; c.fillText(String(value), h * 1.05, h / 2 + 2);
  c.restore();
  return w;
}

/* A cream bar: a picture and a track that fills (fill 0 to 1) in one of BAR_COLORS: XP, health, progress. */
export function statusBar(c, x, y, h, { icon = '', fill = 0, color = 'gold', w = h * 3.6 } = {}){
  const th = h * 0.38, tx = x + h * 0.98, tw = w - h * 1.2, ty = y + (h - th) / 2;
  c.save(); lift(c, h); c.fillStyle = 'rgba(252,250,244,.96)'; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill(); c.shadowColor = 'transparent';
  c.textBaseline = 'middle'; c.textAlign = 'center'; c.font = `${Math.round(h * 0.55)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  c.fillStyle = '#000'; c.fillText(icon, x + h * 0.5, y + h / 2 + 2);
  c.fillStyle = 'rgba(60,60,90,.15)'; c.beginPath(); c.roundRect(tx, ty, tw, th, th / 2); c.fill();
  const f = Math.min(1, Math.max(0, fill)); if (f > 0){ c.fillStyle = BAR_COLORS[color] || BAR_COLORS.gold; c.beginPath(); c.roundRect(tx, ty, Math.max(th, tw * f), th, th / 2); c.fill(); }
  c.restore();
}
