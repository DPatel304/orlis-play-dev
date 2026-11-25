/* The body gestures of Cubo's Create (decisions 0060, 0061), as pure logic with no DOM, so they can be tested with scripted bodies.
   Two gestures only: reach-and-hold to pick, and both arms up to go on. (No swipe.) A jump spins the names, on the Name step only.

     armsUp(lm)               both wrists above the head (pose landmarks, 0..1, y down)
     ArmsWatch                "both arms up" held ARMS_HOLD seconds: .step(dt, lm) -> true once; arms must come down to count again
     Dwell                    a hand held HOLD seconds inside one big target: .step(dt, key|null) -> { progress 0..1, fired }
     worldAt(x, n, current)   the world a hip x (0..1) stands in, with hysteresis so standing on a boundary doesn't flicker (stepping sideways still works)
     meterStop(y, top, bottom, n, current)   the stop a raised hand's height (y, 0 top .. 1 bottom) is at on a meter, with a little hysteresis
     Builder                  who builds: the first player the camera admits; others only watch
     handActive(lm, side)     the forearm is not hanging straight down (a hand at rest at the hip never touches anything; one reaching out does)
     jumped(list, i)          whether player i is in JumpWatch's list of jumpers this step                                          */
import { L } from '../tracking/pose-shared.js';

export const ARMS_HOLD = 0.6;       /* seconds both wrists stay above the head */
export const ARMS_MARGIN = 0.03;    /* how far above the nose a wrist must be (screen heights) */
export const HOLD = 0.7;            /* seconds a hand is held on a target to pick it */
export const DWELL = HOLD;          /* (the old name) */
export const METER_HOLD = 1.0;      /* seconds a raised hand is held still on the meter to set the stop */
export const METER_HYST = 0.3;      /* of a stop: how far past the middle between two stops before the meter moves on */
export const DWELL_GRACE = 0.18;    /* a hand that wobbles out of the target for less than this does not start over */
export const WORLD_SPAN = [0.2, 0.8];   /* the stretch of the picture a player's hips walk along (the sides of the picture are not reachable) */
export const WORLD_HYST = 0.25;     /* of a world's width: how far past a boundary before the world changes */
export const HANG = 0.6;            /* a forearm whose wrist is more than this share of its length below the elbow is hanging, not reaching */
export const LOST_BUILDER = 2.5;    /* seconds the builder may be out of the picture before the next person takes over */

const seen = (k) => k && (k.v ?? k.visibility ?? 1) > 0.4;

/* both wrists above the head: the nose, with a margin */
export function armsUp(lm){
  if (!lm) return false;
  const nose = lm[L.NOSE], a = lm[L.L_WRIST], b = lm[L.R_WRIST];
  if (!seen(nose) || !seen(a) || !seen(b)) return false;
  return a.y < nose.y - ARMS_MARGIN && b.y < nose.y - ARMS_MARGIN;
}

/* Standing arms hang with the wrist right under the elbow, and big targets sit where hands hang, so a resting hand must not touch them. A hand counts
   for touching, grabbing and pushing once its forearm is out of the hang: the wrist well off the straight line down from the elbow. side: 'left' | 'right'. */
export function handActive(lm, side){
  if (!lm) return true;                                           /* (no body to judge: the mouse) */
  const w = lm[side === 'left' ? L.L_WRIST : L.R_WRIST], e = lm[side === 'left' ? L.L_ELBOW : L.R_ELBOW];
  if (!seen(w)) return false;
  if (!seen(e)) return true;
  const dx = (w.x - e.x) * 16 / 9, dy = w.y - e.y, len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  return dy < HANG * len;
}

export class ArmsWatch {
  constructor(hold = ARMS_HOLD){ this.hold = hold; this.t = 0; this.done = false; }
  /* progress 0..1 of the hold (for a ring) */
  get progress(){ return this.done ? 1 : Math.min(1, this.t / this.hold); }
  reset(){ this.t = 0; this.done = false; }
  step(dt, lm){
    if (!armsUp(lm)){ this.t = 0; this.done = false; return false; }
    if (this.done) return false;
    this.t += dt;
    if (this.t >= this.hold){ this.done = true; return true; }
    return false;
  }
}

export class Dwell {
  constructor(secs = HOLD){ this.secs = secs; this.key = null; this.t = 0; this.away = 0; this.spent = null; this.blocked = false; }
  get progress(){ return this.key == null || this.spent === this.key ? 0 : Math.min(1, this.t / this.secs); }
  reset(){ this.key = null; this.t = 0; this.away = 0; this.spent = null; this.blocked = false; }
  /* a hand that is already resting in something when a step opens (still where the last pick was) does not touch it until it has left */
  block(){ this.blocked = true; }
  step(dt, key){
    if (this.blocked){
      if (key != null) return { key: null, progress: 0, fired: false };
      this.blocked = false;
    }
    if (key == null){
      this.away += dt;
      if (this.away > DWELL_GRACE){ this.key = null; this.t = 0; this.spent = null; }
      return { key: null, progress: this.progress, fired: false };
    }
    if (key !== this.key){
      /* a new target: start over (a target touched once must be left before it counts again) */
      if (this.spent !== key || this.away > DWELL_GRACE) this.spent = null;
      this.key = key; this.t = 0;
    }
    this.away = 0;
    if (this.spent === key) return { key, progress: 0, fired: false };
    this.t += dt;
    if (this.t >= this.secs){ this.spent = key; return { key, progress: 1, fired: true }; }
    return { key, progress: this.progress, fired: false };
  }
}

/* which world a hip x stands in: the span is cut in n equal parts; the world only changes once x is WORLD_HYST of a part past the boundary */
export function worldAt(x, n, current = 0){
  if (n < 2) return 0;
  const [a, b] = WORLD_SPAN, w = (b - a) / n;
  const f = (Math.max(a, Math.min(b, x)) - a) / w;                 /* 0..n, in worlds */
  const cur = Math.max(0, Math.min(n - 1, current));
  if (f > cur - WORLD_HYST && f < cur + 1 + WORLD_HYST) return cur;   /* still (about) inside the current one */
  return Math.max(0, Math.min(n - 1, Math.floor(f)));
}

/* the stop a raised hand is at on a meter: y runs from `bottom` (stop 0) up to `top` (the last stop); it only moves on once the hand is METER_HYST of a stop past the middle */
export function meterStop(y, top, bottom, n, current = 0){
  if (n < 2) return 0;
  const f = (bottom - y) / (bottom - top) * (n - 1);                 /* 0..n-1, in stops */
  const nearest = Math.max(0, Math.min(n - 1, Math.round(f)));
  if (Math.abs(f - current) < 0.5 + METER_HYST) return Math.max(0, Math.min(n - 1, current));
  return nearest;
}

/* The first player builds. `step(dt, players)` keeps who it is: the first present body; if they leave the picture for LOST_BUILDER seconds the next
   present one takes over. `index` is null while nobody is there. */
export class Builder {
  constructor(){ this.index = null; this.gone = 0; }
  step(dt, players){
    const here = (i) => !!(players[i] && players[i].present);
    if (this.index != null && here(this.index)){ this.gone = 0; return this.index; }
    if (this.index != null){
      this.gone += dt;
      if (this.gone < LOST_BUILDER) return this.index;
    }
    const next = players.findIndex((p) => p && p.present);
    this.index = next < 0 ? null : next; this.gone = 0;
    return this.index;
  }
}

export const jumped = (list, i) => Array.isArray(list) && list.includes(i);

/* Everything Cubo's Create reads from the bodies, for the builder only. step(dt, players) gives
   { index, lm, hands: [{x,y,active}, {x,y,active}] (screen shares, both wrists; active: not hanging at the side), hipX, arms: true on the step both arms have been up long enough, armsProgress } */
export class BodyReader {
  constructor(){ this.builder = new Builder(); this.armsW = new ArmsWatch(); this.index = null; }
  reset(){ this.armsW.reset(); }
  step(dt, players){
    const index = this.builder.step(dt, players), p = index == null ? null : players[index];
    if (index !== this.index){ this.index = index; this.reset(); }
    if (!p || !p.present){ this.reset(); return { index, lm: null, hands: [], hipX: null, arms: false, armsProgress: 0 }; }
    const lm = p.lm || null;
    const hands = [['left', p.hands.left], ['right', p.hands.right]].map(([side, h]) => ({ x: h.x, y: h.y, active: handActive(lm, side) }));
    const arms = this.armsW.step(dt, lm);
    return { index, lm, hands, hipX: lm && lm[L.L_HIP] && lm[L.R_HIP] ? (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2 : p.centre.x, arms, armsProgress: this.armsW.progress };
  }
}
