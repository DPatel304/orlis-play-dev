/* Hand mode on the home screen (U7, decision 0045): the camera stays on, lightly, in Big Picture, and a child points and waves.

   - A reach box: a box in front of the player's own shoulders (about chin to belly, a little wider than the arms) maps to the whole
     screen, so a child points at every tile without stretching or walking. It follows their shoulders, so it works from any spot.
   - Point, then wave to choose: cursor.js does the lighting and the waving (a wave clicks; holding still never starts anything).
     This file gives it the mapping (cursor.map) and the one driver (cursor.gate).
   - One driver: whoever raises a hand first drives, with the cursor in their colour; others take over by waving.
   - The row-edge strip: pointing at the bottom (or top) edge of the screen, held, moves between rows - no swipes, no stretching.
   - Light: one look at about 10 a second while someone is in view, one a second while nobody is (pose.lite), only at home.

   Pure functions here are tested without a DOM (test/hand.test.mjs). */
import { L } from '../tracking/pose-shared.js';

/* the box, in shoulder widths: this far each side of the shoulders' middle, above the shoulder line (chin), below it (belly) */
export const REACH = { halfW: 1.5, up: 0.6, down: 0.95 };
/* a hand lower than the belly by this much is hanging at the child's side: not pointing */
export const HANG = 0.2;
export const LOOKS = { hz: 10, idleHz: 1 };       /* the camera's looks a second at home: someone in view, and nobody */
const ASPECT = 16 / 9;                            /* the camera's picture (CAM: 640 x 360) */

/* The reach box for one body, in the camera's (mirrored, 0 to 1) coordinates; null when the shoulders aren't seen. */
export function reachBox(lm, reach = REACH){
  const a = lm && lm[L.L_SHOULDER], b = lm && lm[L.R_SHOULDER];
  if (!a || !b || (a.v ?? 1) < 0.4 || (b.v ?? 1) < 0.4) return null;
  const sw = Math.abs(b.x - a.x), sy = (a.y + b.y) / 2, cx = (a.x + b.x) / 2;
  if (sw < 0.01) return null;
  const swy = sw * ASPECT;
  return { x0: cx - reach.halfW * sw, x1: cx + reach.halfW * sw, y0: sy - reach.up * swy, y1: sy + reach.down * swy, hang: sy + (reach.down + HANG) * swy };
}

/* Where a hand at (hx, hy) points on the screen (0 to 1 each way), clamped to the screen; null for a hand hanging at the side. */
export function toScreen(box, hx, hy){
  if (!box || hy > box.hang) return null;
  const cl = (v) => Math.max(0, Math.min(1, v));
  return { x: cl((hx - box.x0) / (box.x1 - box.x0)), y: cl((hy - box.y0) / (box.y1 - box.y0)) };
}

/* cursor.map for home: the pose's cursor hand, through the player's own reach box. */
export function mapHand(p, h){
  const box = reachBox(p.lm);
  return box ? toScreen(box, h.x, h.y) : null;
}

/* One driver: the first player with a hand up (in the box) drives. They keep it while they point; they let go when they've gone,
   or have had no hand up for DROP_AFTER seconds. Anyone else takes over by waving (takeOver). */
export const DROP_AFTER = 3;
export class Driver {
  constructor(){ this.who = null; this.idle = 0; }
  /* active: for each player index, whether a hand is up (in the box) - an array of booleans, in place order; present: who is there */
  update(dt, active, present){
    if (this.who !== null && !present[this.who]){ this.who = null; this.idle = 0; }
    if (this.who !== null){
      this.idle = active[this.who] ? 0 : this.idle + dt;
      if (this.idle > DROP_AFTER){ this.who = null; this.idle = 0; }
    }
    if (this.who === null){
      const first = active.findIndex((a, i) => a && present[i]);
      if (first >= 0){ this.who = first; this.idle = 0; }
    }
    return this.who;
  }
  takeOver(i){ this.who = i; this.idle = 0; }
}

/* The row-edge strip: the driver's cursor held at the bottom edge (next row) or the top edge (the row before), HOLD seconds, moves
   between rows. progress is 0 to 1 for the ring on the strip; step is +1 or -1 once it fills (then it rests until the cursor leaves). */
export const EDGE = 0.9, EDGE_TOP = 0.08, HOLD_EDGE = 0.9;
export class EdgeHold {
  constructor(){ this.t = 0; this.dir = 0; }
  /* y: the cursor's height on screen (0 to 1) or null for no cursor; canUp, canDown: whether there is a row that way */
  update(dt, y, { canUp = false, canDown = false } = {}){
    const dir = y == null ? 0 : y >= EDGE && canDown ? 1 : y <= EDGE_TOP && canUp ? -1 : 0;
    if (dir !== this.dir){ this.dir = dir; this.t = 0; }
    if (!dir){ return { dir: 0, progress: 0, step: 0 }; }
    this.t += dt;
    /* (held on, it pages again after another hold: "they page while pointed at") */
    if (this.t >= HOLD_EDGE){ this.t = 0; return { dir, progress: 1, step: dir }; }
    return { dir, progress: this.t / HOLD_EDGE, step: 0 };
  }
}
