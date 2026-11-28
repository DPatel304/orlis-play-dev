/* Telling players apart better (Settings > Testing > "Tell players apart better"; off unless the owner turns it on). The pure parts; pose.js
   `_assign` uses them. Four things (see pose.js for how they enter the choice of who is who):

   1. A BODY-SHAPE SIGNATURE per player: from the body points only (never the picture), the proportions that stay the same as a person
      moves - height from nose to ankles, shoulder width, hip width, upper arm, forearm, thigh and shin, each as a share of the torso
      (shoulders to hips) - learned over the player's first seconds from looks where the body is clearly seen, upright and clear of
      everyone else, then refreshed slowly. Used the way appearance.js uses clothes: an extra cost, only where two bodies are close in
      cost, never a rule, never more than SHAPE_COST picture heights. Two children of one size and build have the same shape: it helps
      tell a child from a grown-up, or a long-legged child from a stocky one, not twins.
   2. THE BEST WHOLE ASSIGNMENT, not the greedy one: with up to a few players and a few bodies every way of pairing them is tried
      (bestAssignment), under the same gates and costs as the greedy pairing: the cheapest total, where each player who gets a body earns
      MATCH_BONUS (so a body is taken unless another pairing is clearly better, never for the sake of a count).
   3. AN AMBIGUITY HOLD (the Hold class): while two players' bodies overlap heavily the model often merges them or flips which skeleton is
      whose. For that time both players stay put in the game (they are not aged toward gone, up to HOLD_MAX_S), each expected where it was heading
      when the overlap began, and nobody is swapped on the way. When two bodies come clear of each other the pairing is decided once: "same" (each
      player takes the body on the side they were on) or "swapped", whichever is cheaper by motion (where each was heading), clothes (if on)
      and shape.
   4. A LONGER MEMORY: a player who left is remembered for MEMORY_MS (30 s; clothes alone remembered 5 s), by clothes and/or shape, so
      they get their own place back; newcomers who match no one go to places nobody is remembered in first.                            */
import { L } from './pose-shared.js';

export const SHAPE_COST = 0.12;      /* at most this much (picture heights) is added to a player-to-body cost for a different shape */
export const SHAPE_SLACK = 0.05;     /* relative differences under this are noise: they cost nothing */
export const SHAPE_FULL = 0.25;      /* ...and at this much difference the whole SHAPE_COST is added */
export const SHAPE_MIN_N = 4;        /* looks needed before a learned shape counts */
export const SHAPE_REJOIN = 0.16;    /* a newcomer is a returning player only if their shape is this close (relative difference) or closer */
export const SHAPE_FAST_MS = 150, SHAPE_SLOW_MS = 1500;
export const MEMORY_MS = 30000;
export const MATCH_BONUS = 0.2;      /* what getting a body is worth, in picture heights of cost (see bestAssignment) */
export const HOLD_ON = 0.6, HOLD_OFF = 1.25, HOLD_MAX_S = 3;     /* in torso lengths: hold starts when hips are this close (and boxes overlap by HOLD_OVER), ends when bodies are this far apart */
export const HOLD_OVER = 0.4, HOLD_TOUCH = 0.5, HOLD_MARGIN = 0.03;   /* ...it is decided only if the bodies really merged or touched (closer than HOLD_TOUCH), and only if one choice is cheaper by HOLD_MARGIN */
const A = 16 / 9;
const vis = (k) => (k.v ?? k.visibility ?? 1);
const len = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const SHAPE_DIMS = ['tall', 'sw', 'hw', 'ua', 'fa', 'th', 'sn'];
const WEIGHT = [1.0, 0.8, 0.5, 0.5, 0.5, 0.7, 0.7];

/* One look at a body's proportions: an array of SHAPE_DIMS numbers (NaN where a point is not clearly seen), or null when it cannot be read
   (no torso) or the body is not upright enough (bent or leaning: proportions shift). */
export function shapeOf(lm){
  const ok = (...ks) => ks.every(i => lm[i] && vis(lm[i]) >= 0.6);
  if (!ok(L.L_SHOULDER, L.R_SHOULDER, L.L_HIP, L.R_HIP)) return null;
  const sh = mid(lm[L.L_SHOULDER], lm[L.R_SHOULDER]), hp = mid(lm[L.L_HIP], lm[L.R_HIP]), T = len(sh, hp);
  if (!(T > 0.02)) return null;
  if (Math.abs(sh.x - hp.x) * A > 0.3 * T || hp.y <= sh.y) return null;      /* leaning or bent over */
  const v = new Float64Array(SHAPE_DIMS.length).fill(NaN);
  if (ok(L.NOSE, L.L_ANKLE, L.R_ANKLE) && lm[L.L_ANKLE].y < 0.98 && lm[L.R_ANKLE].y < 0.98) v[0] = len(lm[L.NOSE], mid(lm[L.L_ANKLE], lm[L.R_ANKLE])) / T;
  v[1] = len(lm[L.L_SHOULDER], lm[L.R_SHOULDER]) / T;
  v[2] = len(lm[L.L_HIP], lm[L.R_HIP]) / T;
  const side = (pairs, minVis) => { const xs = pairs.filter(([a, b]) => lm[a] && lm[b] && vis(lm[a]) >= minVis && vis(lm[b]) >= minVis).map(([a, b]) => len(lm[a], lm[b]) / T); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN; };
  v[3] = side([[L.L_SHOULDER, L.L_ELBOW], [L.R_SHOULDER, L.R_ELBOW]], 0.7);
  v[4] = side([[L.L_ELBOW, L.L_WRIST], [L.R_ELBOW, L.R_WRIST]], 0.7);
  v[5] = side([[L.L_HIP, L.L_KNEE], [L.R_HIP, L.R_KNEE]], 0.6);
  v[6] = side([[L.L_KNEE, L.L_ANKLE], [L.R_KNEE, L.R_ANKLE]], 0.6);
  return v;
}
export const dimsOf = (v) => v ? v.filter(Number.isFinite).length : 0;

/* A player's learned shape: { v: means, n: looks counted per dimension, looks, t }. learnShape folds a look in (the mean, then a slow follow). */
export function learnShape(sig, sample, now){
  if (!sample) return sig;
  const s = sig || { v: new Float64Array(SHAPE_DIMS.length).fill(NaN), n: new Float64Array(SHAPE_DIMS.length), looks: 0, t: now, score: null };
  for (let i = 0; i < SHAPE_DIMS.length; i++){
    if (!Number.isFinite(sample[i])) continue;
    if (!Number.isFinite(s.v[i])){ s.v[i] = sample[i]; s.n[i] = 1; continue; }
    s.n[i]++;
    s.v[i] += (sample[i] - s.v[i]) * Math.max(0.04, 1 / s.n[i]);
  }
  s.looks++; s.t = now;
  return s;
}

/* How different a body's proportions are from a learned shape: the weighted mean of relative differences over the dimensions both have,
   0 for the same shape, 0.25+ for someone built quite differently. null when there is too little to compare. */
export function shapeDistance(sig, sample){
  if (!sig || !sample || sig.looks < SHAPE_MIN_N) return null;
  let sum = 0, w = 0, dims = 0;
  for (let i = 0; i < SHAPE_DIMS.length; i++){
    if (!Number.isFinite(sample[i]) || !Number.isFinite(sig.v[i]) || sig.n[i] < 2) continue;
    sum += WEIGHT[i] * Math.abs(sample[i] - sig.v[i]) / ((sample[i] + sig.v[i]) / 2); w += WEIGHT[i]; dims++;
  }
  return dims >= 2 ? sum / w : null;
}
/* What a shape distance adds to a player-to-body cost: nothing within the slack, then up to SHAPE_COST. */
export const shapeCost = (d) => d == null ? 0 : SHAPE_COST * Math.min(1, Math.max(0, d - SHAPE_SLACK) / (SHAPE_FULL - SHAPE_SLACK));

/* ---------- the best whole assignment ---------- */
/* options: [[{ j, cost }, ...] per player]; every way of giving each player at most one body, each body at most one player. The most players
   matched first, then the lowest total cost; ties go to the first found (players and bodies in the given order). Gives a Map player -> body. */
export function bestAssignment(options, bonus = MATCH_BONUS){
  const n = options.length, used = new Set(), cur = [], best = { count: -1, cost: Infinity, pick: null };
  /* a pairing's score is its total cost less `bonus` for every player who got a body: a body is worth taking unless it is much dearer than the
     rest (one player grabbing a far body to let another have a near one is not worth it), and with no rival a body is always taken */
  const go = (i, count, cost) => {
    if (i === n){
      if (cost < best.cost - 1e-12 || (Math.abs(cost - best.cost) <= 1e-12 && count > best.count)){ best.count = count; best.cost = cost; best.pick = cur.slice(); }
      return;
    }
    for (const o of options[i]){
      if (used.has(o.j)) continue;
      used.add(o.j); cur[i] = o.j; go(i + 1, count + 1, cost + o.cost - bonus); used.delete(o.j);
    }
    cur[i] = -1; go(i + 1, count, cost);
  };
  go(0, 0, 0);
  const out = new Map();
  if (best.pick) best.pick.forEach((j, i) => { if (j != null && j >= 0) out.set(i, j); });
  /* a player left without a body, with a body nobody else has, takes it (as the greedy pairing would: the gate decides, not the price) */
  const taken = new Set(out.values());
  for (let i = 0; i < n; i++){
    if (out.has(i)) continue;
    const o = options[i].find(q => !taken.has(q.j));
    if (o){ out.set(i, o.j); taken.add(o.j); }
  }
  return out;
}

/* ---------- the ambiguity hold ---------- */
/* One pair of players whose bodies overlap. `at` the moment it began (ms-free: seconds of tracker time are summed in `age`), sa and sb where each was and
   how it was moving, `side` which of them was on the left (+1: a left of b). */
export class Hold {
  constructor(a, b, sa, sb){
    this.a = a; this.b = b; this.sa = { ...sa }; this.sb = { ...sb }; this.age = 0;
    this.merged = false; this.minD = Infinity;         /* did the two ever show as one body / how close (in torso lengths) did two bodies come */
    this.side = sa.x <= sb.x ? 1 : -1;
  }
  /* where player `who` (this.a or this.b) is expected now, at constant velocity from when the overlap began */
  expect(who){ const s = who === this.a ? this.sa : this.sb; return { x: s.x + s.vx * this.age, y: s.y + s.vy * this.age }; }      /* (vx: sideways speed over the last half second) */
  /* pairing options for two bodies d1, d2 (their hips): [cost of each pairing] "same" (the player who was on the left takes the left body),
     "swapped"; costs are in picture heights: distance from where each is expected, plus extra(who, body) (clothes, shape) */
  decide(d1, d2, extra = () => 0){
    const left = d1.x <= d2.x ? [d1, d2] : [d2, d1], [lft, rgt] = left;
    const first = this.side > 0 ? this.a : this.b, second = first === this.a ? this.b : this.a;
    const dist = (who, d) => Math.abs(d.x - this.expect(who).x) * A;      /* (sideways only: how far up the picture a body stands, and its bobbing, say nothing about who it is) */
    const same = dist(first, lft) + dist(second, rgt) + extra(first, lft) + extra(second, rgt);
    const swap = dist(first, rgt) + dist(second, lft) + extra(first, rgt) + extra(second, lft);
    const swapped = swap < same;
    const pairOf = (f, s) => ({ [first]: f, [second]: s });
    return { swapped, same, swap, give: swapped ? pairOf(rgt, lft) : pairOf(lft, rgt) };
  }
}
