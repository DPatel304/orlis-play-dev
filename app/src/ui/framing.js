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
