/* The body gestures of Cubo's Create (decision 0060), as pure logic with no DOM, so they can be tested with scripted bodies.

     armsUp(lm)               both wrists above the head (pose landmarks, 0..1, y down)
     ArmsWatch                "both arms up" held ARMS_HOLD seconds: .step(dt, lm) -> true once; arms must come down to count again
     Dwell                    a hand held DWELL seconds inside one big target: .step(dt, key|null) -> { progress 0..1, fired }
     SwipeWatch               a fast horizontal wrist move: .step(dt, handX, handY) -> -1 | 0 | 1 (left, none, right)
     worldAt(x, n, current)   the world a hip x (0..1) stands in, with hysteresis so standing on a boundary doesn't flicker
     stopAt(x, left, right, n, current)   the slider stop a hand at x pushes to (with a little hysteresis)
     Grabber                  a hand in the grab spot as a thing passes: .step(dt, inSpot, thingId) -> the id grabbed, or null
     Builder                  who builds: the first player the camera admits; others only watch
     handActive(lm, side)     the forearm is not hanging straight down (a hand at rest at the hip never touches anything; one reaching out does)
     jumped(list, i)          whether player i is in JumpWatch's list of jumpers this step                                          */
import { L } from '../tracking/pose-shared.js';

export const ARMS_HOLD = 0.6;       /* seconds both wrists stay above the head */
export const ARMS_MARGIN = 0.03;    /* how far above the nose a wrist must be (screen heights) */
export const DWELL = 0.7;           /* seconds a hand rests in a big target to touch it */
export const DWELL_GRACE = 0.18;    /* a hand that wobbles out of the target for less than this does not start over */
export const SWIPE_DIST = 0.16;     /* screen widths moved sideways ... */
export const SWIPE_WINDOW = 0.25;   /* ... within this many seconds ... */
export const SWIPE_SLANT = 0.6;     /* ... and sideways must beat up-and-down by this much */
export const SWIPE_COOL = 0.5;      /* seconds before the next swipe counts */
export const WORLD_SPAN = [0.2, 0.8];   /* the stretch of the picture a player's hips walk along (the sides of the picture are not reachable) */
export const WORLD_HYST = 0.25;     /* of a world's width: how far past a boundary before the world changes */
export const STOP_HYST = 0.2;       /* of a stop's width, likewise for sliders */
export const GRAB_COOL = 0.45;      /* seconds between two grabs */
export const GRAB_HOLD = 0.08;      /* a hand has to be in the grab spot this long (a flick across it is not a grab) */
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
  constructor(secs = DWELL){ this.secs = secs; this.key = null; this.t = 0; this.away = 0; this.spent = null; this.blocked = false; }
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

export class SwipeWatch {
  constructor(){ this.trail = []; this.cool = 0; }
  reset(){ this.trail = []; this.cool = 0; }
  /* x, y: the wrist in screen widths and heights; pass null when it is not seen */
  step(dt, x, y){
    this.cool = Math.max(0, this.cool - dt);
    if (x == null){ this.trail = []; return 0; }
    for (const p of this.trail) p.age += dt;
    this.trail = this.trail.filter(p => p.age <= SWIPE_WINDOW);
    this.trail.push({ x, y, age: 0 });
    if (this.cool > 0 || this.trail.length < 3) return 0;
    const a = this.trail[0], dx = x - a.x, dy = y - a.y;
    if (Math.abs(dx) >= SWIPE_DIST && Math.abs(dx) > Math.abs(dy) / SWIPE_SLANT){
      this.cool = SWIPE_COOL; this.trail = [];
      return Math.sign(dx);
    }
    return 0;
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

/* the slider stop under a hand: the track runs from `left` to `right` (screen widths), the stops evenly along it */
export function stopAt(x, left, right, n, current = 0){
  if (n < 2) return 0;
  const f = (x - left) / (right - left) * (n - 1);                  /* 0..n-1, in stops */
  const nearest = Math.max(0, Math.min(n - 1, Math.round(f)));
  if (Math.abs(f - current) < 0.5 + STOP_HYST) return Math.max(0, Math.min(n - 1, current));
  return nearest;
}

export class Grabber {
  constructor(){ this.held = 0; this.cool = 0; this.last = null; }
  reset(){ this.held = 0; this.cool = 0; this.last = null; }
  /* inSpot: a hand is in the glowing spot; thingId: the thing at the top just now (or null). Returns the id grabbed, once. */
  step(dt, inSpot, thingId){
    this.cool = Math.max(0, this.cool - dt);
    if (!inSpot){ this.held = 0; this.last = null; return null; }
    this.held += dt;
    if (thingId == null || this.held < GRAB_HOLD || this.cool > 0) return null;
    if (thingId === this.last) return null;                          /* the same thing, still passing */
    this.last = thingId; this.cool = GRAB_COOL;
    return thingId;
  }
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
   { index, lm, hands: [{x,y,active}, {x,y,active}] (screen shares, both wrists; active: not hanging at the side), hipX, arms: true on the step both arms have been up long enough, armsProgress, swipe: -1|0|1 } */
export class BodyReader {
  constructor(){ this.builder = new Builder(); this.armsW = new ArmsWatch(); this.swipes = [new SwipeWatch(), new SwipeWatch()]; this.index = null; }
  reset(){ this.armsW.reset(); this.swipes.forEach(s => s.reset()); }
  step(dt, players){
    const index = this.builder.step(dt, players), p = index == null ? null : players[index];
    if (index !== this.index){ this.index = index; this.reset(); }
    if (!p || !p.present){ this.reset(); return { index, lm: null, hands: [], hipX: null, arms: false, armsProgress: 0, swipe: 0 }; }
    const lm = p.lm || null;
    const hands = [['left', p.hands.left], ['right', p.hands.right]].map(([side, h]) => ({ x: h.x, y: h.y, active: handActive(lm, side) }));
    const arms = this.armsW.step(dt, lm);
    let swipe = 0;
    hands.forEach((h, i) => { const s = this.swipes[i].step(dt, h.x, h.y); if (s) swipe = s; });
    return { index, lm, hands, hipX: lm && lm[L.L_HIP] && lm[L.R_HIP] ? (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2 : p.centre.x, arms, armsProgress: this.armsW.progress, swipe };
  }
}
