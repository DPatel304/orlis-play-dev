/* Steadier hands (Settings > Testing > "Steadier hands"; off unless the owner turns it on). Four things on top of the One Euro filter
   that pose.js already runs on every landmark (the filter itself is passed in, so this file stays free of pose.js):

   1. SMOOTHING BY HOW SURE AND HOW BIG. A point the model is less sure of (its visibility) is smoothed harder: the cutoff at rest is
      scaled from MIN_SCALE (a guess) to 1 (clearly seen). And the speed term (BETA) is scaled by body size: speeds are measured in
      torso lengths, so a child (a small torso in the picture) whose hand moves as fast, for their body, as a grown-up's is not
      flattened into the slow lane.
   2. NO IMPLAUSIBLE JUMPS. A wrist or elbow that moves faster than a person can (MAX_SPEED torso lengths a second) is held where the
      filter says it was heading for that look - at most HOLD_MAX looks in a row, then it is believed (it may be a real change: the
      body came back from behind someone).
   3. LIMBS KEEP THEIR LENGTH. In the first LEARN_S seconds each arm's upper-arm and forearm lengths (as torso lengths) are learned from
      looks where shoulder, elbow and wrist are all clearly seen (a high percentile: foreshortening only makes an arm look shorter).
      After that the elbow and wrist are softly pulled back when farther from the shoulder (or elbow) than the arm can be (PULL of the
      excess, so a real, brief stretch still shows a little).
   4. DRAWN AHEAD (lead): the hand that is DRAWN (the glow orb) is shown where the line through the last two samples puts it about one
      look ahead, at most LEAD_CAP torso lengths from where it honestly is. Hit tests do not use it: p.lm and p.hands x, y stay the
      honest, filtered position; the drawn one is p.hands.left.dx / dy (and right), read by the orb drawing only (games/play/engine.js).

   Everything is a plain function of numbers; pose.js calls steadyFilter in place of its own loop and, if it throws, runs its own loop.  */
import { L } from './pose-shared.js';

export const REF_TORSO = 0.2;                 /* the torso (picture heights) the filter's BETA was tuned for: between a child's and a grown-up's */
export const VIS_LO = 0.3, VIS_HI = 0.9, MIN_SCALE = 0.35;
export const BETA_SCALE = [0.6, 2.5];
export const MAX_SPEED = 14, HOLD_MAX = 3;    /* torso lengths per second (a torso is about half a metre: 7 m/s); looks held in a row */
export const LEARN_S = 4, LEARN_MIN_S = 1.0, LEARN_N = 8, LEARN_KEEP = 48, LEARN_PCT = 0.85, SLACK = 1.12, PULL = 0.7;
export const LEAD_CAP = 0.5;
const A = 16 / 9;
const ARMS = [{ s: L.L_SHOULDER, e: L.L_ELBOW, w: L.L_WRIST }, { s: L.R_SHOULDER, e: L.R_ELBOW, w: L.R_WRIST }];
const vis = (k) => (k.v ?? k.visibility ?? 1);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const len = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y);
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export function newState(){ return { age: 0, size: 0, held: {}, last: {}, arm: [{ ua: [], fa: [], u: 0, f: 0 }, { ua: [], fa: [], u: 0, f: 0 }], clamped: 0, rejected: 0, lead: {} }; }

/* Pull point `b` toward `a` so that it is no farther than `max` (picture heights), keeping `1 - pull` of the excess. */
function pullIn(a, b, max, pull){
  const d = len(a, b);
  if (!(d > max) || d <= 0) return false;
  const to = max + (d - max) * (1 - pull), k = to / d;
  b.x = a.x + (b.x - a.x) * k; b.y = a.y + (b.y - a.y) * k;
  return true;
}

/* Replaces pose.js's per-landmark filtering: `lm` the new sample (mirrored landmarks), p.filt the One Euro states, p.lm the result. */
export function steadyFilter(p, lm, dt, { oneEuro, MIN_CUTOFF, BETA, sizeOf }){
  const st = p.steady || (p.steady = newState());
  st.age += dt;
  const raw = sizeOf(lm);
  if (raw > 0.02) st.size = st.size ? st.size + (raw - st.size) * 0.2 : raw;
  const size = st.size || REF_TORSO;
  /* the sample, with the arms made plausible: its own copy, never the caller's landmarks */
  const m = lm.map(k => ({ x: k.x, y: k.y, z: k.z, v: vis(k) }));
  for (let a = 0; a < 2; a++){
    const { s, e, w } = ARMS[a], S = m[s], E = m[e], W = m[w], arm = st.arm[a];
    if (vis(S) < 0.5) continue;
    if (st.age < LEARN_S && vis(E) >= 0.7 && vis(W) >= 0.7 && vis(S) >= 0.7){
      arm.ua.push(len(S, E) / size); arm.fa.push(len(E, W) / size);
      if (arm.ua.length > LEARN_KEEP){ arm.ua.shift(); arm.fa.shift(); }
      if (arm.ua.length >= LEARN_N){ arm.u = pct(arm.ua, LEARN_PCT); arm.f = pct(arm.fa, LEARN_PCT); }
    }
    if (!arm.u || st.age < LEARN_MIN_S) continue;
    if (vis(E) > 0.3 && pullIn(S, E, arm.u * size * SLACK, PULL)) st.clamped++;
    if (vis(W) > 0.3){
      if (vis(E) > 0.3 && pullIn(E, W, arm.f * size * SLACK, PULL)) st.clamped++;
      if (pullIn(S, W, (arm.u + arm.f) * size * SLACK, PULL)) st.clamped++;
    }
  }
  const beta = BETA * clamp(REF_TORSO / size, BETA_SCALE[0], BETA_SCALE[1]);
  const step = Math.max(dt, 1 / 120);
  for (let i = 0; i < m.length; i++){
    const f = (p.filt ||= [])[i] ||= { x: {}, y: {}, z: {} };
    let x = m[i].x, y = m[i].y;
    /* an implausible jump of a wrist or elbow, against the last look believed: hold where it was heading, a few looks at most */
    if (i >= L.L_ELBOW && i <= L.R_WRIST){
      const last = st.last[i];
      if (last && Math.hypot((x - last.x) * A, y - last.y) / step / size > MAX_SPEED && (st.held[i] || 0) < HOLD_MAX && f.x.x != null){
        x = f.x.x + (f.x.dx || 0) * step; y = f.y.x + (f.y.dx || 0) * step; st.held[i] = (st.held[i] || 0) + 1; st.rejected++;
      } else { st.held[i] = 0; st.last[i] = { x, y }; }
    }
    const vs = clamp((m[i].v - VIS_LO) / (VIS_HI - VIS_LO), 0, 1), cut = MIN_CUTOFF * (MIN_SCALE + (1 - MIN_SCALE) * vs);
    p.lm[i].x = oneEuro(f.x, x, dt, cut, beta);
    p.lm[i].y = oneEuro(f.y, y, dt, cut, beta);
    p.lm[i].z = oneEuro(f.z, m[i].z ?? 0, dt, cut, beta);
    p.lm[i].v = lm[i].v;
  }
}

/* The drawn (led) position of a wrist: the honest one at (hx, hy) plus the wrist's velocity (the last sample's own: (b - before) / iv, eased
   over LEAD_TAU so a new sample never makes a step) times one look (iv, at most LEAD_MAX seconds), at most LEAD_CAP torso lengths from the
   honest one. `st` is the player's steady state, `key` which wrist, `g` is p.seg, `j` the wrist's offset (landmark index * 3), `now` ms.
   Gives { x, y }. */
export const LEAD_TAU = 0.03, LEAD_MAX = 0.05;
export function led(st, key, g, j, now, size, hx, hy){
  const v = st.lead[key] || (st.lead[key] = { vx: 0, vy: 0, t: now, g: null });
  const tx = (g.b[j] - g.before[j]) / g.iv, ty = (g.b[j + 1] - g.before[j + 1]) / g.iv;
  if (v.g !== g){ v.g = g; v.vx = tx; v.vy = ty; v.t = now; }
  const k = 1 - Math.exp(-Math.max(0, now - v.t) / 1000 / LEAD_TAU);
  v.vx += (tx - v.vx) * k; v.vy += (ty - v.vy) * k; v.t = now;
  const lead = Math.min(g.iv, LEAD_MAX);
  let dx = v.vx * lead * A, dy = v.vy * lead;
  const d = Math.hypot(dx, dy), cap = LEAD_CAP * (size || REF_TORSO);
  if (d > cap){ dx *= cap / d; dy *= cap / d; }
  return { x: hx + dx / A, y: hy + dy };
}
