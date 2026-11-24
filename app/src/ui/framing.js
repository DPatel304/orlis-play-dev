/* Is everyone fully in view? The pure part of the camera check in "get ready" (the scene is framing-check.js).

   Worked out from the pose landmarks alone (never the camera picture): a player is framed when the head has some room above it
   (to reach up), the feet are in, and the body is clear of both side edges. Landmarks arrive mirrored, in 0..1 of the screen,
   y down, so "left" is the left of the screen.

     frameOf(lm)               { top, feet, left, right, close, ok }   what is cut, for one body
     sayFor(f)                 the few words that put it right, or null when framed
     FramingWatch              steadies it over frames (landmark visibility flickers); .step(dt, players), .report(players)
     framingShown() / markFramingShown()   whether the first-time reassurance has been shown on this PC (localStorage) */
import { L } from '../tracking/pose-shared.js';

export const FRAME = {
  top: 0.10,      /* the nose needs at least this much picture above it: room for reaching up */
  feet: 0.97,     /* the lowest foot point must be above this */
  side: 0.06      /* shoulders, hips and nose stay this far from each side edge */
};
/* From nose to ankle a standing body is about this many torso lengths (shoulders to hips); the picture left once the head's room
   and a little floor are taken off is FIT_ROOM. A torso longer than FIT_ROOM / FIT_TORSOS cannot fit however it is placed. */
const FIT_TORSOS = 2.9, FIT_ROOM = 0.87;
const FEET = [L.L_ANKLE, L.R_ANKLE, 29, 30, 31, 32];     /* ankles, heels, toes */
const FEET_SEEN = 0.25;                                     /* (ankle visibility on a standing figure flickers, so this is low) */

const vis = (k) => (k && (k.v ?? k.visibility ?? 1)) || 0;

export function frameOf(lm){
  const nose = lm[L.NOSE];
  const top = !nose || nose.y < FRAME.top;
  const feetSeen = FEET.map(i => lm[i]).filter(k => k && vis(k) > FEET_SEEN);
  const feet = !feetSeen.length || Math.max(...feetSeen.map(k => k.y)) > FRAME.feet;
  const mid = [L.NOSE, L.L_SHOULDER, L.R_SHOULDER, L.L_HIP, L.R_HIP].map(i => lm[i]).filter(Boolean);
  const left = mid.some(k => k.x < FRAME.side);
  const right = mid.some(k => k.x > 1 - FRAME.side);
  const torso = Math.hypot(((lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) - (lm[L.L_HIP].x + lm[L.R_HIP].x)) / 2 * 16 / 9,
    ((lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) - (lm[L.L_HIP].y + lm[L.R_HIP].y)) / 2);
  const close = torso * FIT_TORSOS > FIT_ROOM;
  return { top, feet, left, right, close, ok: !top && !feet && !left && !right };
}

/* The few words for one body, or null when framed. Too close first (nothing else helps until they step back), then the sides, then
   the camera itself when only the head or only the feet are cut with the body small enough to fit. */
export function sayFor(f){
  if (!f || f.ok) return null;
  if (f.close || (f.top && f.feet)) return 'Step back until you fit in the frame';
  if (f.left && !f.right) return 'Move right a little';
  if (f.right && !f.left) return 'Move left a little';
  if (f.left && f.right) return 'Step back until you fit in the frame';
  if (f.top) return 'Raise the camera';
  if (f.feet) return 'Tilt the camera down';
  return null;
}

const FLAGS = ['top', 'feet', 'left', 'right', 'close'];
const ON = 0.6, RATE = 4, MIN_SEEN = 0.4;
/* Steadies the verdict: each flag is averaged over about a quarter of a second and counts only above ON, and a player is judged
   only after being seen MIN_SEEN seconds. */
export class FramingWatch {
  constructor(){ this.each = []; }
  reset(){ this.each = []; }
  step(dt, players){
    players.forEach((p, i) => {
      if (!p || !p.present || !p.lm){ this.each[i] = null; return; }
      const e = this.each[i] || (this.each[i] = { seen: 0, avg: Object.fromEntries(FLAGS.map(k => [k, 0])), first: true });
      const f = frameOf(p.lm);
      e.seen += dt;
      for (const k of FLAGS) e.avg[k] = e.first ? (f[k] ? 1 : 0) : e.avg[k] + ((f[k] ? 1 : 0) - e.avg[k]) * Math.min(1, dt * RATE);
      e.first = false;
    });
  }
  /* { nobody, present, pending, ok, bad: [{ i, say, ...flags }] } for the players now (those not yet judged are pending, and count as framed). */
  report(players){
    const bad = []; let present = 0, pending = 0;
    players.forEach((p, i) => {
      const e = this.each[i];
      if (!p || !p.present || !p.lm || !e) return;
      present++;
      if (e.seen < MIN_SEEN){ pending++; return; }
      const f = Object.fromEntries(FLAGS.map(k => [k, e.avg[k] > ON]));
      f.ok = !f.top && !f.feet && !f.left && !f.right;
      if (!f.ok) bad.push({ i, ...f, say: sayFor(f) });
    });
    return { nobody: present === 0, present, pending, ok: bad.length === 0, bad };
  }
}

/* The first time on this PC (the reassurance shows even when everyone is framed). Storage can be blocked: then it shows every time. */
const KEY = 'orlis_framing_shown';
export function framingShown(){ try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
export function markFramingShown(){ try { localStorage.setItem(KEY, '1'); } catch { /* shown again next time */ } }

/* ---------- where the words card goes ---------- */

/* The rectangle a body fills on a W x H screen (pixels), with room for the head and the limbs' thickness, so a card kept off it never
   touches the figure. lm: the body's landmarks (screen fractions). Returns { x0, y0, x1, y1 } or null when it cannot be worked out. */
export function bodyBox(lm, W, H){
  const idx = [L.NOSE, L.L_SHOULDER, L.R_SHOULDER, L.L_ELBOW, L.R_ELBOW, L.L_WRIST, L.R_WRIST, L.L_HIP, L.R_HIP, L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE];
  const pts = idx.map(i => lm[i]).filter(k => k && (k.v ?? 1) > 0.3);
  if (!pts.length || !lm[L.L_SHOULDER] || !lm[L.R_SHOULDER]) return null;
  const sw = Math.hypot((lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) * W, (lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y) * H), pad = sw * 0.5;
  const xs = pts.map(k => k.x * W), ys = pts.map(k => k.y * H);
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad * 1.6, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
}

/* Where the words card goes: a w x h card on a W x H screen that overlaps no figure. It prefers the top centre (where it has always been), then
   the bottom centre, then the corners and the middle of each side, and takes the first that is clear; if none is clear it takes the one
   covering the least. `boxes`: the figures' rectangles (bodyBox). `keep`: other rectangles to stay off (the "Play anyway" button, when it is up).
   Returns { x, y } for the card's top left corner. */
export function placeCard(W, H, w, h, boxes, keep = []){
  const m = Math.round(H * 0.012), side = Math.round(W * 0.02), xc = (W - w) / 2, yc = (H - h) / 2, lo = H - h - m * 2.5;
  const spots = [[xc, m], [xc, lo], [side, m], [W - w - side, m], [side, lo], [W - w - side, lo], [side, yc], [W - w - side, yc]];
  const hit = (x, y, b) => Math.max(0, Math.min(x + w, b.x1) - Math.max(x, b.x0)) * Math.max(0, Math.min(y + h, b.y1) - Math.max(y, b.y0));
  let best = null;
  for (const [x, y] of spots){
    const cost = [...boxes, ...keep].reduce((s, b) => s + (b ? hit(x, y, b) : 0), 0);
    if (!best || cost < best.cost) best = { x, y, cost };
    if (cost === 0) break;
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}
