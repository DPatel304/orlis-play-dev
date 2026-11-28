/* Exact hands (Settings > Testing > "Exact hands"; off unless the owner turns it on).

   The body tracker's wrist is the joint; the hand a child means is a hand's width further on. MediaPipe's hand model, run in IMAGE mode on a
   square cut-out around a wrist (taken by pose.js, as zoom.js takes its crops), gives 21 points of the hand. From them:
     - the PALM CENTRE: the mean of the wrist and the knuckles (the thumb's and the four fingers'), the place the hand really is;
     - the GRIP: 'open', 'closed' or 'point', from how far each fingertip is from the palm, as a share of the hand's size;
     - a CONFIDENCE.
   The palm centre is kept as an offset from the wrist, in the forearm's own frame (along the forearm, across it, in forearm lengths), so it
   goes on turning and moving with the arm between runs: the hand model only runs on a few hands a look (budget.js handBudget; hands that move
   or are near a target first, the rest in turn), and the offset is carried forward from the last run, eased so the drawn orb never jumps, and
   faded back to the wrist if it goes unrefreshed for too long. pose.js puts the palm where the hand is (`hands.left.x, y`, which hit tests
   and the orb use) and exposes `hands.left.grip`.

   Pure functions on plain numbers: crop geometry (squares as in zoom.js, so the same exact round trip), the classifier on landmark sets,
   the choice of which hands to look at. Landmarks of a crop are in the crop's own 0..1 square (isotropic: the square is square in pixels).
   Tracker space is the mirrored one (x is 1 - the video's).                                                                                  */
import { L } from './pose-shared.js';
import { squareRegion, mapFromCrop } from './zoom.js';

export const A = 16 / 9;
export const HAND_PX = 208;              /* a crop is drawn at this many pixels a side for the hand model (192 to 224) */
export const HAND_SIDE = 2.2;            /* the crop's side in forearm lengths */
export const HAND_AHEAD = 0.4;           /* its centre this many forearms beyond the wrist, toward the hand */
export const HAND_MIN_SIDE = 0.12, HAND_MAX_SIDE = 0.5;     /* picture heights */
export const HAND_MAX = 2;               /* hand crops a look (budget.js carries the same number) */
export const HOLD_MS = 2000, FADE_MS = 600;   /* a palm offset is carried this long unrefreshed, then fades to the wrist over this */
export const MIN_CONF = 0.45;            /* a run less sure than this is not used */
export const MOVING = 0.3;               /* a hand faster than this (picture widths a second) is "moving" */
export const NEAR = 0.15;                /* a hand within this (picture heights) of a target is "near" */
export const STALE_MS = 1500;            /* a hand not looked at for this long goes up a tier */
export const EASE_K = 10;                /* the shown offset follows the target at this rate (per second) */
export const FIT_K = 0.5;                /* a new run moves the target this much of the way (times its confidence) */
export const EXT = 0.8, CURL = 0.6;      /* a finger is extended when its tip is this many hand sizes from the palm, curled under this (the real hand model's open hands read 0.8 to 1.2, fists 0.1 to 0.5) */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const vis = (k) => (k ? (k.v ?? k.visibility ?? 1) : 0);
const len = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y);
export const toTracker = (k) => ({ ...k, x: 1 - k.x });

/* hand landmark indices (MediaPipe) */
export const H = { WRIST: 0, THUMB_MCP: 2, THUMB_TIP: 4, INDEX_MCP: 5, INDEX_TIP: 8, MIDDLE_MCP: 9, MIDDLE_TIP: 12, RING_MCP: 13, RING_TIP: 16, PINKY_MCP: 17, PINKY_TIP: 20 };
const PALM_PTS = [H.WRIST, H.THUMB_MCP, H.INDEX_MCP, H.MIDDLE_MCP, H.RING_MCP, H.PINKY_MCP];
const FINGERS = [[H.INDEX_TIP, H.INDEX_MCP], [H.MIDDLE_TIP, H.MIDDLE_MCP], [H.RING_TIP, H.RING_MCP], [H.PINKY_TIP, H.PINKY_MCP]];

/* ---------- the crop ---------- */
/* The square to cut out around a wrist (side: 0 left, 1 right) of a body (tracker landmarks), in the VIDEO's space (zoom.js squareRegion),
   or null when the arm cannot be read. The side is HAND_SIDE forearms, its centre HAND_AHEAD forearms beyond the wrist along the forearm. */
export function handRegion(lm, side, vw, vh){
  const e = lm[side ? L.R_ELBOW : L.L_ELBOW], w = lm[side ? L.R_WRIST : L.L_WRIST];
  if (!e || !w || vis(w) < 0.5 || vis(e) < 0.3) return null;
  const F = len(e, w);
  if (!(F > 0.02)) return null;
  const ux = (w.x - e.x) * A / F, uy = (w.y - e.y) / F;
  const cx = w.x + ux * HAND_AHEAD * F / A, cy = w.y + uy * HAND_AHEAD * F;
  return { region: squareRegion(1 - cx, cy, clamp(HAND_SIDE * F, HAND_MIN_SIDE, HAND_MAX_SIDE), vw, vh), F, u: { x: ux, y: uy } };
}

/* ---------- the classifier ---------- */
/* From a hand's 21 landmarks (any isotropic space): the palm centre, the hand's size (wrist to the middle knuckle), each finger's tip distance
   from the palm in hand sizes, and the grip: 'open' (three or more fingers out), 'point' (the index out, the other three in), 'closed' (none
   out), else null (in between or unclear). */
export function handShape(h){
  if (!h || h.length < 21) return null;
  let px = 0, py = 0;
  for (const i of PALM_PTS){ px += h[i].x; py += h[i].y; }
  const palm = { x: px / PALM_PTS.length, y: py / PALM_PTS.length };
  const size = Math.hypot(h[H.MIDDLE_MCP].x - h[H.WRIST].x, h[H.MIDDLE_MCP].y - h[H.WRIST].y);
  if (!(size > 1e-6)) return null;
  const ext = FINGERS.map(([t]) => Math.hypot(h[t].x - palm.x, h[t].y - palm.y) / size);
  const out = ext.map(r => r >= EXT), curled = ext.map(r => r <= CURL);
  const n = out.filter(Boolean).length;
  let grip = null;
  if (n >= 3) grip = 'open';
  else if (out[0] && !out[1] && !out[2] && !out[3] && curled.filter(Boolean).length >= 2) grip = 'point';
  else if (n === 0 && ext.reduce((s, r) => s + r, 0) / 4 <= 0.6) grip = 'closed';
  return { palm, size, ext, grip };
}

/* ---------- one run on one hand ---------- */
/* What one hand-model answer (hands: the landmarks of the hand found, 21 points of the crop's 0..1 square; score: its own confidence, 0..1)
   gives for the hand at wrist (tracker space) with the forearm (u: elbow to wrist, F: its length in H) the crop was cut for. The palm centre
   is mapped back to the picture exactly (zoom.js mapFromCrop, then mirrored into the tracker's space). Gives
     { palm: { x, y }, a, c, grip, conf, size }   (a, c: the palm's offset from the wrist in forearm lengths, along and across the forearm)
   or null: nothing found, or the hand found is not this wrist's (its wrist is further than 0.8 forearms from the tracker's). */
export function fitHand({ hand, score = 1, region, wrist, F, u }){
  if (!hand || hand.length < 21 || !region || !wrist || !(F > 0)) return null;
  const sh = handShape(hand);
  if (!sh) return null;
  const palm = toTracker(mapFromCrop(sh.palm, region)), w0 = toTracker(mapFromCrop(hand[H.WRIST], region));
  const off = len(w0, wrist);
  if (off > 0.8 * F) return null;                                  /* somebody else's hand, or a mistake */
  const dx = (palm.x - wrist.x) * A, dy = palm.y - wrist.y;
  const a = u ? (dx * u.x + dy * u.y) / F : 0, c = u ? (dx * -u.y + dy * u.x) / F : 0;
  const near = 1 - off / (0.8 * F);
  const conf = clamp((score ?? 1) * (0.5 + 0.5 * near), 0, 1);
  return { palm, a, c, grip: sh.grip, conf, size: sh.size };
}

/* ---------- the carried palm ---------- */
/* A hand's carried state: { a, c } target offset (forearm lengths), { sa, sc } what is shown (eased), conf, grip, t (when last run, ms). */
export function newFit(){ return { a: 0, c: 0, sa: 0, sc: 0, conf: 0, grip: null, t: -1e9, runs: 0 }; }
/* a run lands (fit from fitHand): the target moves toward it by FIT_K times its confidence (the first run takes it whole); too unsure: ignored */
export function takeRun(f, r, now){
  if (!r || r.conf < MIN_CONF) return false;
  if (!f.runs){ f.a = r.a; f.c = r.c; f.sa = r.a; f.sc = r.c; }
  else { const k = clamp(FIT_K * r.conf * 2, 0.2, 1); f.a += (r.a - f.a) * k; f.c += (r.c - f.c) * k; }
  f.conf = r.conf; f.grip = r.grip; f.t = now; f.runs++;
  return true;
}
/* How much of the offset still counts: 1 for HOLD_MS after a run, then fading to 0 over FADE_MS */
export const holdWeight = (f, now) => f.runs ? clamp(1 - (now - f.t - HOLD_MS) / FADE_MS, 0, 1) : 0;
/* A look's step of easing the shown offset toward the (weighted) target; dt seconds (0: nothing moves). Gives the shown { a, c }. */
export function ease(f, now, dt){
  const w = holdWeight(f, now), ta = f.a * w, tc = f.c * w;
  if (dt > 0){ const k = 1 - Math.exp(-EASE_K * dt); f.sa += (ta - f.sa) * k; f.sc += (tc - f.sc) * k; }
  return { a: f.sa, c: f.sc };
}
/* The palm's place from the wrist and the forearm (elbow): wrist + (u a + u-perp c) F. null when the elbow is not seen. */
export function palmFrom(w, e, shown){
  if (!w || !e || vis(e) < 0.3) return null;
  const F = len(e, w);
  if (!(F > 0.02)) return null;
  const ux = (w.x - e.x) * A / F, uy = (w.y - e.y) / F;
  return { x: w.x + (ux * shown.a - uy * shown.c) * F / A, y: w.y + (uy * shown.a + ux * shown.c) * F };
}
/* the grip to show: the last run's, while it still counts */
export const gripNow = (f, now) => f.runs && now - f.t <= HOLD_MS ? f.grip : null;

/* ---------- which hands to look at ---------- */
/* cands: [{ key, speed, nearTarget, last (ms of the last run, or -Infinity) }]. Hands that move or are near a target come first, as do hands
   not looked at for STALE_MS; within each tier the one waiting longest goes first, so the hands take turns. At most `max`. */
export function pickHands(cands, { now = 0, max = HAND_MAX } = {}){
  const tier = (c) => (c.speed >= MOVING || c.nearTarget || now - c.last > STALE_MS) ? 1 : 0;
  return [...cands].sort((a, b) => tier(b) - tier(a) || a.last - b.last || (a.key < b.key ? -1 : 1)).slice(0, Math.max(0, max));
}
