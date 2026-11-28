/* A fake hand detector for the Exact hands tests and rig: synthetic hand landmarks (21 points of MediaPipe's hand model) in a hand's own frame,
   placed at a wrist along a forearm and mapped into a crop's 0..1 square, as the real model answers for a crop. No model, no picture.
   The hand's size S is the wrist to the middle knuckle; the palm centre (the mean of the wrist and the knuckles) is 0.7 S along the hand's axis. */
import { H as HP } from '../../src/tracking/hands.js';

/* [along, across] of each landmark in hand sizes, for a hand with fingers 'out' (extended) or curled; thumb: out or in */
const MCP = { index: [0.95, 0.3], middle: [1.0, 0.0], ring: [0.95, -0.28], pinky: [0.85, -0.52] };
const REACH = { index: 0.95, middle: 1.0, ring: 0.95, pinky: 0.8 };       /* how far past its knuckle an extended finger's tip is */
export const PALM_ALONG = (0 + 0.45 + 0.95 + 1.0 + 0.95 + 0.85) / 6;       /* where the palm centre is along the axis (hand sizes from the wrist) */
export const PALM_ACROSS = (0 + 0.55 + 0.3 + 0.0 - 0.28 - 0.52) / 6;       /* ...and across it (the thumb side is +) */

/* grip: 'open' | 'closed' | 'point' | 'half' (two fingers out, two in: the classifier says nothing) */
export function handPoints(grip){
  const out = { index: grip === 'open' || grip === 'point' || grip === 'half', middle: grip === 'open' || grip === 'half', ring: grip === 'open', pinky: grip === 'open' };
  const P = new Array(21);
  P[0] = [0, 0];
  const thumbOut = grip === 'open' || grip === 'point';
  P[1] = [0.25, 0.35]; P[2] = [0.45, 0.55];
  P[3] = thumbOut ? [0.7, 0.7] : [0.6, 0.4]; P[4] = thumbOut ? [0.9, 0.8] : [0.72, 0.25];
  const base = { index: 5, middle: 9, ring: 13, pinky: 17 };
  for (const f of Object.keys(base)){
    const [a, c] = MCP[f], i = base[f];
    P[i] = [a, c];
    if (out[f]){ P[i + 1] = [a + REACH[f] * 0.45, c]; P[i + 2] = [a + REACH[f] * 0.72, c]; P[i + 3] = [a + REACH[f], c]; }
    else { P[i + 1] = [a + 0.3, c]; P[i + 2] = [a + 0.12, c]; P[i + 3] = [a - 0.12, c]; }
  }
  return P;
}

/* The 21 points as an isotropic crop-square landmark list: the hand's wrist at `wrist` (tracker space, x of the width), the axis along `u` (unit, in
   picture-height units: x already times 16/9), size S in picture heights; the crop is a zoom.js region of the VIDEO (the mirror of tracker space)
   with the video's pixel size (vw, vh). Gives [{ x, y, z }] in the crop's 0..1 square. */
export function handInCrop({ grip = 'open', wrist, u, S, region, vw, vh, noise = 0, rnd = Math.random }){
  const A = 16 / 9, px = [-u.y, u.x];
  return handPoints(grip).map(([a, c]) => {
    const dxH = (u.x * a + px[0] * c) * S + (noise ? (rnd() - 0.5) * 2 * noise : 0), dyH = (u.y * a + px[1] * c) * S + (noise ? (rnd() - 0.5) * 2 * noise : 0);
    const tx = wrist.x + dxH / A, ty = wrist.y + dyH;           /* tracker space */
    const vx = 1 - tx;
    return { x: (vx - region.x0) / region.w, y: (ty - region.y0) / region.h, z: 0 };
  });
}

/* A fake detector: detect(video, region) -> { landmarks: [[21]], handedness: [[{ score }]] } for whichever of `hands()` ([{ wrist, u, S, grip }] in
   tracker space) lies in the region (the one nearest its centre), or { landmarks: [] }. */
export function fakeHander(hands, { score = 0.9, noise = 0, seed = 1 } = {}){
  let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const calls = [];
  return {
    calls,
    detect(video, region){
      calls.push(region);
      const vw = video.videoWidth, vh = video.videoHeight, cx = region.x0 + region.w / 2, cy = region.y0 + region.h / 2;
      let best = null, bd = Infinity;
      for (const h of hands()){
        const mid = { x: 1 - (h.wrist.x + h.u.x * 0.45 * h.S / (16 / 9)), y: h.wrist.y + h.u.y * 0.45 * h.S };
        const inside = (1 - h.wrist.x) >= region.x0 && (1 - h.wrist.x) <= region.x0 + region.w && h.wrist.y >= region.y0 && h.wrist.y <= region.y0 + region.h;
        const d = Math.hypot(mid.x - cx, mid.y - cy);
        if (inside && d < bd){ bd = d; best = h; }
      }
      if (!best) return { landmarks: [] };
      return { landmarks: [handInCrop({ ...best, region, vw, vh, noise, rnd })], handedness: [[{ score, categoryName: 'Left' }]] };
    }
  };
}
export { HP };
