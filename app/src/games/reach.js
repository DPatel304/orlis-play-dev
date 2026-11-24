/* Reach: where on the screen a player's hands can get to, from their own body. A child stands lower in the picture and has shorter
   arms than a grown-up, so a game that drops things from the top of the screen, or lifts a ball up to the ceiling, plays for
   whoever is tallest. A game that asks a Reach where to put things puts them where this player can touch them.

   The top is about where the wrist gets with an arm raised: the shoulder, less ARM_UP arm lengths (a little under a straight arm;
   a hop or a tiptoe is extra). The arm is measured on the body itself - shoulder to elbow to wrist - so it scales with how close
   they stand and how big they are, and when the arm can't be seen it is a torso's worth (ARM_PER_TORSO). The bottom is about knee
   height: lower than that is a stoop. `x` is the middle of the body, for putting things in front of them.

   Everything is smoothed (a squat, a hop or a flickering landmark should not make the band jump), and a player who isn't seen
   keeps the band they had. Positions are fractions of the picture, as in the rest of the games (x of the width, y of the height);
   distances along x are measured in picture heights, so a torso is the same length whichever way it points. */
import { L } from '../tracking/pose-shared.js';

const ASPECT = 16 / 9;
/* the wrist, raised: this many arm lengths above the shoulder */
export const ARM_UP = 0.9;
/* with the arm out of sight: an arm is this many torsos (shoulders to hips) */
export const ARM_PER_TORSO = 0.95;
/* with the knees out of sight: knees are this many torsos below the hips */
export const KNEE_PER_TORSO = 0.66;
/* a measured arm stays within this much of a torso's worth, so one wrong landmark can't stretch it */
const ARM_SPREAD = [0.7, 1.4];
/* how fast the band follows the body (seconds), up and down, and sideways */
export const TAU_Y = 0.9, TAU_X = 0.4;
/* the band is never thinner than this, nor higher or lower than this (picture heights) */
export const MIN_BAND = 0.12, HIGHEST = 0.04, LOWEST = 0.97;

const seen = (k) => !!k && (k.v ?? k.visibility ?? 1) > 0.5;
const len = (a, b) => Math.hypot((a.x - b.x) * ASPECT, a.y - b.y);
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;

/* One look at a body: { x, top, bottom, arm } - not smoothed - or null when there's no body to look at. A tracked player has
   landmarks `lm`; one with none (a test, a mouse) falls back on the centre and scale the tracker keeps. */
export function measure(p){
  if (!p) return null;
  const lm = p.lm;
  let shY, shX, hipY, hipX, torso, arm = 0, knees = [];
  if (lm){
    const sh = [lm[L.L_SHOULDER], lm[L.R_SHOULDER]].filter(seen), hip = [lm[L.L_HIP], lm[L.R_HIP]].filter(seen);
    if (!sh.length) return null;
    shY = mean(sh.map(k => k.y)); shX = mean(sh.map(k => k.x));
    if (hip.length){
      hipY = mean(hip.map(k => k.y)); hipX = mean(hip.map(k => k.x));
      torso = Math.hypot((hipX - shX) * ASPECT, hipY - shY);
    }
    knees = [lm[L.L_KNEE], lm[L.R_KNEE]].filter(seen);
    for (const [s, e, w] of [[L.L_SHOULDER, L.L_ELBOW, L.L_WRIST], [L.R_SHOULDER, L.R_ELBOW, L.R_WRIST]]){
      if (seen(lm[s]) && seen(lm[e]) && seen(lm[w])) arm = Math.max(arm, len(lm[s], lm[e]) + len(lm[e], lm[w]));
    }
  } else if (p.centre){
    torso = Math.max(0.04, (p.scale || 0.3) / 2.4);
    shY = p.centre.y - torso / 2; shX = p.centre.x;
    hipY = p.centre.y + torso / 2; hipX = p.centre.x;
  } else return null;
  if (!torso) torso = 0.2;           /* shoulders only: a grown-up's torso at the usual distance, near enough */
  const fair = ARM_PER_TORSO * torso;
  arm = arm ? Math.min(fair * ARM_SPREAD[1], Math.max(fair * ARM_SPREAD[0], arm)) : fair;
  const bottom = knees.length ? mean(knees.map(k => k.y)) : (hipY ?? shY + torso) + KNEE_PER_TORSO * torso;
  return { x: hipX == null ? shX : (shX + hipX) / 2, top: shY - ARM_UP * arm, bottom, arm };
}

/* A player's reachable band, steadied over time. One per player: call step() every frame the player is there. */
export class Reach {
  constructor(){ this.top = 0.3; this.bottom = 0.85; this.x = 0.5; this.arm = 0.2; this.ready = false; }

  /* `mouse`: the pointer can go anywhere, so the whole picture is reach. */
  step(dt, p, mouse = false){
    const m = mouse ? { x: p && p.centre ? p.centre.x : 0.5, top: HIGHEST + 0.04, bottom: LOWEST - 0.04, arm: 0.3 } : measure(p);
    if (!m) return this;
    const top = Math.min(0.8, Math.max(HIGHEST, m.top)), bottom = Math.min(LOWEST, Math.max(top + MIN_BAND, m.bottom));
    if (!this.ready){ Object.assign(this, { top, bottom, x: m.x, arm: m.arm, ready: true }); return this; }
    const ky = 1 - Math.exp(-Math.max(0, dt) / TAU_Y), kx = 1 - Math.exp(-Math.max(0, dt) / TAU_X);
    this.top += (top - this.top) * ky; this.bottom += (bottom - this.bottom) * ky; this.arm += (m.arm - this.arm) * ky;
    this.x += (m.x - this.x) * kx;
    return this;
  }

  get height(){ return this.bottom - this.top; }
  /* a height `f` of the way down the band: 0 is the top, 1 the knees */
  at(f){ return this.top + this.height * f; }
  /* is this height in the band (give or take `slack`)? */
  has(y, slack = 0){ return y >= this.top - slack && y <= this.bottom + slack; }
}

/* A Reach for each of n players. */
export const reaches = (n) => Array.from({ length: n }, () => new Reach());
