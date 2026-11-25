/* How a hand feels (decision 0062): the glow orb every game, menu and Create screen draws for a player's hand, and the little things
   around it - smoothing, a comet stretch, a trail, a squash and burst on impact, a gentle pull toward a target, a glow on targets
   a hand is near. Ported from docs/hand-feel-demo.html (the Hand Feel Lab), in the app's units: positions are shares of the picture
   (x of its width, y of its height); sizes, speeds and distances are in screen HEIGHTS (a speed of 1 crosses the picture's height in a second).

   Only what is DRAWN moves here. What a hand touches is worked out by each game from the hand itself (pose), never from the orb:
   the pull and the smoothing change nothing about hits or scores, and nothing here ever stops game time.

   Nothing in this file reads the camera, the sound engine or the page, so a game running in the sandbox carries it as it is.
   Every number below is a starting guess, to be tuned at home on a real webcam (decision 0062). */
import { color } from '../games/assets/palette.js';
import { fxState } from '../games/common.js';

export const FEEL = {
  /* smoothing: a One Euro filter on what is drawn. The tracker's own filter (pose.js: 0.7 Hz at rest, + 6 Hz per screen-width/s) and its
     drawing between samples already settle the hand, so this one is light: 4 Hz at rest (a 40 ms settle, only to take the last of the
     jitter off), and 60 Hz more per screen-height/s, so a quick move is followed at once (about 1 ms behind at a swipe). */
  minCutoff: 4, beta: 60, dCutoff: 1,
  /* the orb: radius (screen heights), how far its halo reaches (in radii), how fast the halo breathes (rad/s) */
  radius: 0.03, haloReach: 2.5, breathe: 3.2,
  /* the comet: speed (heights/s) where the stretch starts, and the extra speed to full stretch */
  stretchFrom: 0.35, stretchSpan: 1.25,
  /* the trail: behind a hand faster than trailFrom (to full at trailFrom + trailSpan), for trailLife seconds */
  trailFrom: 0.42, trailSpan: 0.97, trailLife: 0.24,
  /* the pull: starts this far (heights) beyond a target's radius, and draws the orb this share of the way to the centre at the
     centre's doorstep (smooth: nothing at the edge); eased over pullEase seconds so entering and leaving it never jumps */
  pullAdd: 0.14, pullK: 0.5, pullEase: 0.045,
  /* hover: a target's glow rises from 0 at this far (heights) beyond its radius to 1 at the radius; targets grow up to 8% */
  hoverAdd: 0.11, hoverGrow: 0.08,
  /* the squash on impact (a spring), and the burst: sparks, and a ring wave */
  squash: 0.34, sparks: 18, sparksReduced: 10, sparkLife: 0.55, ringLife: 0.45, maxSparks: 140,
  /* the whoosh on a fast move: faster than whooshAt (heights/s), at most once in whooshEvery seconds */
  whooshAt: 1.04, whooshSpan: 1.25, whooshEvery: 0.4,
  /* two players' orbs are drawn apart when nearer than this many orb diameters (eased over apartEase seconds); drawing only */
  apartAt: 1.05, apartEase: 0.09
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth01 = (t) => t * t * (3 - 2 * t);
const TAU = 6.2832;

/* ---------- colours (from a palette hex; no colour codes written here) ---------- */
const hexRgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const byte = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
/* a colour with an alpha, as 8-digit hex */
export const withAlpha = (hex, a) => hex.slice(0, 7) + byte(a * 255);
/* a colour mixed toward a grey level (255 = white, 0 = black) by a */
export const mixHex = (hex, to, a) => '#' + hexRgb(hex).map(v => byte(v + (to - v) * a)).join('');
const WHITE = () => color('earth.snow'), GOLD = () => color('touch.sunflower'), SHADOW = () => color('shade.shadow'), INK = () => color('shade.ink');

/* ---------- smoothing ---------- */
const alphaOf = (cut, dt) => { const tau = 1 / (2 * Math.PI * cut); return 1 / (1 + tau / Math.max(dt, 1e-3)); };
/* One coordinate through the One Euro filter: f holds { x, dx } between frames. Steady at rest (the cutoff is low), quick when it
   moves (the cutoff rises with the speed). Units: shares of the picture per second. */
export function euro(f, x, dt, minCutoff = FEEL.minCutoff, beta = FEEL.beta, dCutoff = FEEL.dCutoff){
  if (f.x == null){ f.x = x; f.dx = 0; return x; }
  const dx = (x - f.x) / Math.max(dt, 1e-3);
  f.dx += (dx - f.dx) * alphaOf(dCutoff, dt);
  f.x += (x - f.x) * alphaOf(minCutoff + beta * Math.abs(f.dx), dt);
  return f.x;
}

/* ---------- the pull ---------- */
/* Where a hand at (x, y) is DRAWN, given targets [{ x, y, r }] (x, y shares of the picture; r in screen heights): eased toward the
   nearest target's centre when within its reach, most when near the middle, nothing at the edge. aspect = width / height.
   o.reachMul/reachAdd: reach = r * reachMul + reachAdd (a target may carry its own `reach`); o.k: the most it moves (a share of the way).
   This is the one pull in the app: Cubo's Create's magnet (magnet.js) asks it with its own numbers. It never changes what is touched. */
export function pull(x, y, targets, aspect = 16 / 9, o = {}){
  if (!targets || !targets.length) return { x, y };
  const mul = o.reachMul ?? 1, add = o.reachAdd ?? FEEL.pullAdd, k = o.k ?? FEEL.pullK;
  let best = null, bd = Infinity, br = 0;
  for (const t of targets){
    const reach = t.reach ?? (t.r * mul + add), d = Math.hypot((t.x - x) * aspect, t.y - y);
    if (d < reach && d < bd){ best = t; bd = d; br = reach; }
  }
  if (!best) return { x, y };
  const m = k * smooth01(1 - bd / br);
  return { x: x + (best.x - x) * m, y: y + (best.y - y) * m };
}

/* How near any of the hands is to a target at (x, y) with radius r (screen heights): 0 far, 1 on it (smooth in between).
   A game grows the target up to 8% (FEEL.hoverGrow) and adds a glow by it. Honest: from where the hands are, not where they are drawn. */
export function nearness(x, y, r, hands, aspect = 16 / 9){
  let d = Infinity;
  for (const h of hands) d = Math.min(d, Math.hypot((h.x - x) * aspect, h.y - y));
  if (d === Infinity) return 0;
  return 1 - smooth01(clamp((d - r) / FEEL.hoverAdd, 0, 1));
}

/* ---------- one orb: where it is drawn, how it moves ---------- */
export class Orb {
  constructor(){
    this.fx = {}; this.fy = {};
    this.x = null; this.y = null;               /* drawn */
    this.hx = null; this.hy = null;             /* smoothed, before the pull */
    this.ox = 0; this.oy = 0;                   /* the pull's offset, eased */
    this.vx = 0; this.vy = 0; this.speed = 0;   /* heights per second, lightly smoothed */
    this.sq = 0; this.sqv = 0;                  /* squash on impact (a spring) */
    this.trail = [];
    this.t = 0;
  }
  /* A new sample: (x, y) is the hand. filter: false when something else has already smoothed it (the menu cursor does).
     Returns this. */
  update(x, y, dt, aspect = 16 / 9, targets = null, filter = true){
    dt = clamp(dt, 0.001, 0.1);
    this.t += dt;
    const first = this.hx == null;
    const sx = filter ? euro(this.fx, x, dt) : x, sy = filter ? euro(this.fy, y, dt) : y;
    const px = this.hx, py = this.hy;
    this.hx = sx; this.hy = sy;
    /* the pull: an offset toward the nearest target, eased */
    const want = targets && targets.length ? pull(sx, sy, targets, aspect) : { x: sx, y: sy };
    const ke = 1 - Math.exp(-dt / FEEL.pullEase);
    if (first){ this.ox = 0; this.oy = 0; }
    else { this.ox += (want.x - sx - this.ox) * ke; this.oy += (want.y - sy - this.oy) * ke; }
    this.x = sx + this.ox; this.y = sy + this.oy;
    /* velocity, from the smoothed hand (so the pull's own movement never makes a comet) */
    if (!first){
      const ks = 1 - Math.exp(-dt / 0.09);
      this.vx += (((sx - px) * aspect) / dt - this.vx) * ks; this.vy += ((sy - py) / dt - this.vy) * ks;
    }
    this.speed = Math.hypot(this.vx, this.vy);
    /* the squash spring */
    this.sqv += (-170 * this.sq - 15 * this.sqv) * dt; this.sq += this.sqv * dt;
    /* the trail */
    this.trail.push({ x: this.x, y: this.y, t: this.t });
    while (this.trail.length && this.t - this.trail[0].t > FEEL.trailLife) this.trail.shift();
    return this;
  }
  /* an impact: squash flat, then spring back */
  squashNow(){ this.sq = FEEL.squash; this.sqv = 0; }
}

/* The burst's own dice: never Math.random, so a hit's sparks can't disturb a game's own dice (the playtest rig seeds Math.random; a round
   must come out the same with or without the orbs). */
function dice(seed = 0x9e3779b9){
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- the burst: sparks and a ring wave where something was hit ---------- */
export class Bursts {
  constructor(rand = dice(), reduced = false){ this.sparks = []; this.rings = []; this.rand = rand; this.reduced = reduced; }
  add(x, y, col){
    const r = this.rand, n = this.reduced ? FEEL.sparksReduced : FEEL.sparks, cols = [col, WHITE(), col, GOLD()];
    for (let i = 0; i < n; i++){
      const a = r() * TAU, s = 0.22 + r() * 0.42;
      const life = FEEL.sparkLife + r() * 0.3;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.17, r: 0.004 + r() * 0.007, col: cols[i % 4], life, max: life });
    }
    if (this.sparks.length > FEEL.maxSparks) this.sparks.splice(0, this.sparks.length - FEEL.maxSparks);
    this.rings.push({ x, y, col, life: FEEL.ringLife, max: FEEL.ringLife });
    if (this.rings.length > 12) this.rings.shift();
  }
  step(dt, aspect = 16 / 9){
    for (const p of this.sparks){ p.life -= dt; p.vy += 0.97 * dt; p.x += p.vx * dt / aspect; p.y += p.vy * dt; }
    this.sparks = this.sparks.filter(p => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
  }
  get alive(){ return this.sparks.length + this.rings.length; }
  draw(c, W, H){
    if (fxState.hidden) return;
    for (const r of this.rings){
      const k = 1 - r.life / r.max;
      c.strokeStyle = withAlpha(r.col, 0.7 * (1 - k)); c.lineWidth = H * (0.0097 * (1 - k) + 0.0014);
      c.beginPath(); c.arc(r.x * W, r.y * H, H * (0.028 + k * 0.167), 0, TAU); c.stroke();
    }
    for (const p of this.sparks){
      c.globalAlpha = clamp(p.life / 0.3, 0, 1); c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x * W, p.y * H, p.r * H, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }
}

/* ---------- drawing ---------- */
/* The trail: a short fading ribbon behind a quick hand only. */
export function drawTrail(c, W, H, o, col){
  const k = clamp((o.speed - FEEL.trailFrom) / FEEL.trailSpan, 0, 1);
  if (k < 0.02 || o.trail.length < 3) return;
  const n = o.trail.length;
  c.lineCap = 'round';
  for (let i = 1; i < n; i++){
    const a = o.trail[i - 1], b = o.trail[i], f = i / n;
    c.strokeStyle = withAlpha(col, 0.5 * f * k);
    c.lineWidth = H * (0.0083 + 0.061 * f * k);
    c.beginPath(); c.moveTo(a.x * W, a.y * H); c.lineTo(b.x * W, b.y * H); c.stroke();
  }
}

/* The orb: a soft shadow, a breathing halo, a comet along the motion, and a bright core.
   opts.boost: 0.. a streak's glow (a bigger, brighter halo); opts.flash: a combo flare; opts.progress: 0..1 hold ring round it;
   opts.phase: so two orbs don't breathe in step. */
export function drawOrb(c, W, H, o, col, opts = {}){
  const R = H * FEEL.radius, boost = opts.boost || 0, flash = opts.flash || 0;
  const st = clamp((o.speed - FEEL.stretchFrom) / FEEL.stretchSpan, 0, 1), ang = Math.atan2(o.vy, o.vx);
  const x = o.x * W, y = o.y * H, sq = o.sq || 0;
  /* the shadow on the "floor" under the hand (it does not tilt) */
  c.save(); c.translate(x, y + R * 2 + R * 0.36 * clamp(o.speed / 1.9, 0, 1)); c.scale(1, 0.26);
  const sg = c.createRadialGradient(0, 0, R * 0.18, 0, 0, R * 2);
  sg.addColorStop(0, withAlpha(SHADOW(), 0.3)); sg.addColorStop(1, withAlpha(SHADOW(), 0));
  c.fillStyle = sg; c.beginPath(); c.arc(0, 0, R * 2, 0, TAU); c.fill(); c.restore();

  c.save(); c.translate(x, y); c.scale(1 + sq, 1 - sq);
  /* halo: bigger and brighter on a streak, flaring on a new level */
  const breathe = 1 + 0.07 * Math.sin(o.t * FEEL.breathe + (opts.phase || 0));
  const hr = R * FEEL.haloReach * breathe * (1 + boost * 0.5 + flash * 0.6);
  let g = c.createRadialGradient(0, 0, R * 0.3, 0, 0, hr);
  g.addColorStop(0, withAlpha(col, clamp(0.5 + boost * 0.3 + flash * 0.2, 0, 1))); g.addColorStop(1, withAlpha(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, hr, 0, TAU); c.fill();
  /* comet: stretched along the motion, the tail behind */
  c.rotate(ang);
  if (st > 0.02){
    const Lc = R * (1.09 + 4.1 * st);
    g = c.createLinearGradient(0, 0, -Lc, 0);
    g.addColorStop(0, withAlpha(col, 0.75)); g.addColorStop(1, withAlpha(col, 0));
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -R * 0.95); c.quadraticCurveTo(-Lc * 0.5, -R * 0.6, -Lc, 0);
    c.quadraticCurveTo(-Lc * 0.5, R * 0.6, 0, R * 0.95); c.closePath(); c.fill();
  }
  c.scale(1 + 0.45 * st, 1 - 0.18 * st);
  /* core: white highlight into the player's colour, a soft rim */
  g = c.createRadialGradient(-R * 0.2, -R * 0.25, R * 0.05, 0, 0, R);
  g.addColorStop(0, WHITE()); g.addColorStop(0.35, mixHex(col, 255, 0.55)); g.addColorStop(0.75, col); g.addColorStop(1, withAlpha(col, 0.55));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.restore();

  /* the hold ring (menus): fills round the orb as a wave or a hold is read */
  if (opts.progress > 0){
    const rr = R * 1.6;
    c.save(); c.lineCap = 'round';
    c.lineWidth = Math.max(5, H * 0.011); c.strokeStyle = withAlpha(INK(), 0.4);
    c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
    c.strokeStyle = WHITE(); c.beginPath(); c.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + clamp(opts.progress, 0, 1) * TAU); c.stroke();
    c.restore();
  }
}

/* ---------- all of a screen's orbs together: what a game (or the engine) holds ---------- */
export class HandFeel {
  constructor({ rand = dice(), reduced = false } = {}){
    this.orbs = new Map();          /* key -> { orb, who, col, hx, hy } */
    this.bursts = new Bursts(rand, reduced);
    this.t = 0; this.aspect = 16 / 9; this.whooshAt = 0;
    this._targets = null; this._hands = [];
  }
  /* the targets for the next step (once a frame; {x, y, r}) */
  targets(list){ this._targets = Array.isArray(list) ? list : null; }
  /* hands: [{ key, who, x, y, col }] this frame; onWhoosh(k) is asked for a soft whoosh (k: 0..1) when one moves fast */
  step(dt, hands, onWhoosh = null){
    this.t += dt;
    const seen = new Set(), tg = this._targets; this._targets = null;
    this._hands = hands;
    let fastest = 0;
    for (const h of hands){
      seen.add(h.key);
      let e = this.orbs.get(h.key);
      if (!e){ e = { orb: new Orb(), who: h.who }; this.orbs.set(h.key, e); }
      e.who = h.who; e.col = h.col; e.hx = h.x; e.hy = h.y;
      e.orb.update(h.x, h.y, dt, this.aspect, tg);
      fastest = Math.max(fastest, e.orb.speed);
    }
    for (const k of [...this.orbs.keys()]) if (!seen.has(k)) this.orbs.delete(k);
    this.bursts.step(dt, this.aspect);
    this._spread(dt);
    if (onWhoosh && fastest > FEEL.whooshAt && this.t >= this.whooshAt){
      this.whooshAt = this.t + FEEL.whooshEvery;
      onWhoosh(clamp((fastest - FEEL.whooshAt) / FEEL.whooshSpan, 0, 1));
    }
  }
  /* something was hit at (x, y) by player `who`: the nearest of their orbs squashes, and a burst plays where it happened */
  hit(x, y, who, col){
    let best = null, bd = Infinity;
    for (const e of this.orbs.values()){
      if (e.who !== who) continue;
      const d = Math.hypot((e.orb.x - x) * this.aspect, e.orb.y - y);
      if (d < bd){ bd = d; best = e; }
    }
    if (best) best.orb.squashNow();
    this.bursts.add(x, y, col || (best && best.col) || WHITE());
  }
  /* Two players' orbs that come within about one orb diameter are DRAWN apart (e.nx, e.ny: shares of the picture, eased), so they never
     sit on top of each other. Only the drawing: orb.x / orb.y, hit() and every game's own hit tests keep the real positions.
     An orb is never moved away from another orb of the same player (two hands of one child may meet). */
  _spread(dt){
    const list = [...this.orbs.values()], A = this.aspect, D = FEEL.radius * 2 * FEEL.apartAt;
    for (const e of list){ e.tx = 0; e.ty = 0; }
    for (let pass = 0; pass < 2; pass++){
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++){
        const a = list[i], b = list[j];
        if (a.who === b.who || a.orb.x == null || b.orb.x == null) continue;
        let dx = ((b.orb.x + b.tx) - (a.orb.x + a.tx)) * A, dy = (b.orb.y + b.ty) - (a.orb.y + a.ty);
        let d = Math.hypot(dx, dy);
        if (d >= D) continue;
        if (d < 1e-4){ dx = (a.who < b.who) ? 1 : -1; dy = 0; d = 1; }     /* exactly on top: the lower player goes left, steadily */
        const push = (D - d) / 2, ux = dx / d, uy = dy / d;
        a.tx -= ux * push / A; a.ty -= uy * push; b.tx += ux * push / A; b.ty += uy * push;
      }
    }
    const k = 1 - Math.exp(-dt / FEEL.apartEase);
    for (const e of list){ e.nx = (e.nx || 0) + (e.tx - (e.nx || 0)) * k; e.ny = (e.ny || 0) + (e.ty - (e.ny || 0)) * k; }
  }
  near(x, y, r){ return nearness(x, y, r, this._hands, this.aspect); }
  /* the orbs now: [{ key, who, col, orb, shown }]; orb is where the hand is, shown is the same orb as drawn (nudged clear of other players') */
  list(){ return [...this.orbs.entries()].map(([key, e]) => ({ key, who: e.who, col: e.col, orb: e.orb, shown: this._shown(e) })); }
  /* the orb as drawn: itself, or (when nudged apart from another player's) a copy moved by the eased offset, trail and all */
  _shown(e){
    const nx = e.nx || 0, ny = e.ny || 0;
    if (Math.abs(nx) < 1e-4 && Math.abs(ny) < 1e-4) return e.orb;
    const o = e.orb;
    return { ...o, x: o.x + nx, y: o.y + ny, trail: o.trail.map(p => ({ ...p, x: p.x + nx, y: p.y + ny })) };
  }
  /* trails, bursts, then the orbs; look(who) gives the extras for a player's orbs ({ boost, flash }) */
  draw(c, W, H, look = null){
    this.aspect = W / H;
    const list = [...this.orbs.values()];
    for (const e of list) drawTrail(c, W, H, this._shown(e), e.col);
    this.bursts.draw(c, W, H);
    list.forEach((e, i) => drawOrb(c, W, H, this._shown(e), e.col, { ...(look ? look(e.who) : null), phase: i * 1.7 }));
  }
}
