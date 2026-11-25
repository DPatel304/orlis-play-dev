/* The comfort zone of Cubo's Create (decision 0061), as pure logic with no DOM: where a player can comfortably touch things, and the layouts that follow.

   Every target sits between the chest and just above the head of the FIRST player, around where they stand and as far out as their arm reaches,
   and never below their hips (standing, low things are hard to reach; a child's zone is lower and narrower than a grown-up's, and follows them).
   It is built on a player's Reach (games/reach.js: the band the wrists get to, steadied over time), and eased again here with a dead band, so
   targets glide to a new place and do not jitter with the tracker. With no body (the remote, the mouse) there is a default zone, centred.

     Comfort                  .step(dt, player, mouse) -> the zone  { x, top, bottom, floor, half, arm, body }  (shares of the picture: x of its width, y of its height)
     DEFAULT_ZONE             the zone with nobody there
     rowOf(zone, n, o)        n targets side by side in the zone's width -> [{ x, w }]
     cardsBand(zone)          the rows' vertical place: tall cards from the head down, group tiles at shoulder height -> { y, h }
     meterBand(zone)          the stretch of height a raised hand runs along for the meter -> { top, bottom }
     near(d, size)            0..1: how close a hand is to a target (d: its distance from the target's edge, size: the target's smaller side)  */
import { Reach, ARM_UP } from '../games/reach.js';
import { L } from '../tracking/pose-shared.js';

export const ASPECT = 16 / 9;
export const DEFAULT_ZONE = { x: 0.5, top: 0.3, bottom: 0.6, floor: 0.8, half: 0.3, arm: 0.3, body: false };
export const TAU_Y = 0.9, TAU_X = 0.5;             /* seconds the zone takes to follow a body, up and down, and sideways */
export const DEAD = 0.01;                          /* the zone does not move for less than this (picture shares): tracker jitter never moves a target */
export const TOP_LIMIT = 0.14;                     /* the zone never reaches above this (the step dots and the corner targets are there) */
export const MIN_BAND = 0.2;                       /* the zone is at least this tall */
export const MIN_HALF = 0.1, MAX_HALF = 0.34;      /* how far (of the picture's width) either side of the body targets may go */
export const ARM_SLACK = 1.1;                      /* a little more than an arm's length: a hand leans and steps */

const seen = (k) => !!k && (k.v ?? k.visibility ?? 1) > 0.4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;

/* the zone for one look at a body (not steadied): from the landmarks, with the Reach for the arm and the highest the wrist gets. null: no body. */
export function zoneOf(p, reach){
  const lm = p && p.lm;
  if (!lm) return null;
  const sh = [lm[L.L_SHOULDER], lm[L.R_SHOULDER]].filter(seen);
  if (!sh.length) return null;
  const hips = [lm[L.L_HIP], lm[L.R_HIP]].filter(seen);
  const shY = mean(sh.map(k => k.y));
  const hipY = hips.length ? mean(hips.map(k => k.y)) : shY + (reach.arm || 0.25) * 0.85;
  const torso = Math.max(0.08, hipY - shY);
  const nose = seen(lm[L.NOSE]) ? lm[L.NOSE].y : shY - 0.45 * torso;
  /* just above the head: a head is about half a torso tall, and a hand held at its top is comfortable */
  const headTop = nose - 0.45 * torso, chest = shY + 0.35 * torso;
  let top = Math.max(headTop, reach.top, TOP_LIMIT);
  const floor = Math.min(0.92, hipY);
  const bottom = Math.min(chest, floor - 0.1 * torso);
  if (bottom - top < MIN_BAND) top = Math.max(0.1, bottom - MIN_BAND);
  const half = clamp(reach.arm / ASPECT * ARM_SLACK, MIN_HALF, MAX_HALF);
  return { x: reach.x, top, bottom: Math.max(top + MIN_BAND, bottom), floor: Math.max(top + MIN_BAND, floor), half, arm: reach.arm, body: true };
}

/* One per screen of Create: call step() every frame. */
export class Comfort {
  constructor(){ this.reach = new Reach(); this.z = { ...DEFAULT_ZONE }; this.ready = false; }
  /* player: the builder (null: nobody to look at); mouse: the pointer stands in for the camera (a default zone) */
  step(dt, player, mouse = false){
    let goal = null;
    if (player && player.present && !mouse){ this.reach.step(dt, player, false); goal = zoneOf(player, this.reach); }
    if (!goal) goal = { ...DEFAULT_ZONE };
    if (!this.ready || dt <= 0){ this.z = { ...goal }; this.ready = true; return this.z; }
    const ky = 1 - Math.exp(-dt / TAU_Y), kx = 1 - Math.exp(-dt / TAU_X);
    const z = this.z;
    for (const [k, kk] of [['x', kx], ['top', ky], ['bottom', ky], ['floor', ky], ['half', kx]]){
      if (Math.abs(goal[k] - z[k]) > DEAD) z[k] += (goal[k] - z[k]) * kk;
    }
    z.arm = goal.arm; z.body = goal.body;
    return z;
  }
}

/* n targets side by side across the zone's width: each w wide (shares), the row centred on the body, kept on the screen.
   o: minW, maxW (of the picture's width), gap. Wide enough to read, narrow enough that the ends are an arm away. */
export function rowOf(z, n, { minW = 0.075, maxW = 0.13, gap = 0.012 } = {}){
  const w = clamp((2 * z.half - gap * (n - 1)) / n, minW, maxW);
  const row = n * w + (n - 1) * gap;
  const x0 = clamp(z.x - row / 2, 0.02, 0.98 - row);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), w }));
}

/* the rows' place up and down (shares of the picture's height): 'cards' are tall, from the head down toward the hips; 'tiles' sit at shoulder height */
export function cardsBand(z, kind = 'cards'){
  if (kind === 'tiles'){
    const h = Math.min(0.3, Math.max(0.2, z.bottom - z.top)), mid = (z.top + z.bottom) / 2;
    const y = clamp(mid - h / 2, TOP_LIMIT, z.floor - h);
    return { y, h };
  }
  const y = z.top, h = Math.max(0.2, Math.min(0.34, z.floor - z.top));
  return { y, h };
}

/* the height a raised hand runs along on the meter: from the hips (the lowest stop) up to the top of the zone. (Hands go above the head: the top is
   as high as the wrist gets with the arm up, never lower than the zone's top.) */
export function meterBand(z){
  const top = Math.max(0.21, Math.min(z.top, z.floor - 0.3));       /* (below the corner targets) */
  const bottom = Math.max(top + 0.3, z.floor);
  return { top, bottom };
}

/* how near a hand is to a target: 0 far, 1 on it. d: the distance to the target's edge (0 when inside), size: its smaller side, in the same unit */
export const near = (d, size) => clamp(1 - d / (size * 0.9), 0, 1);

/* a Reach's highest wrist for a body (for tests and the screen's own sanity) */
export const wristTop = (shoulderY, arm) => shoulderY - ARM_UP * arm;
