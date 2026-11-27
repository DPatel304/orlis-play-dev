/* Recognising a player by their clothes (Settings > Testing > "Recognise players by clothes"; off unless the owner turns it on).

   A SIGNATURE is a small colour histogram of the torso: the quad between the shoulders and hips (and the upper arms, lighter), read from a
   small copy of the video picture (about 80 px wide - see pose.js `_grab`). Each pixel goes into one of 26 bins:
     - 12 hues x 2 saturation levels (pale, vivid) for coloured pixels, the hue shared between the two nearest bins so a small shift in
       light doesn't throw a pixel across a boundary;
     - 2 bins for pixels with no real colour: dark (v < DARK) and light (everything grey to white, which lamp light moves between
       "grey" and "white" anyway).
   Dimming the room scales brightness and leaves hue and saturation, so a shirt keeps its bins. Two histograms are compared by
   intersection: distance = 1 - sum of the smaller of each bin, 0 for the same clothes, near 1 for nothing in common.

   Pure functions over a plain frame ({ data: RGBA bytes, width, height }); no canvas, so tests build frames in memory.
   Landmarks are the tracker's own (mirrored: screen-left is x small); the frame is the camera's picture, not mirrored, so x is flipped
   here (`mirrored`). */
import { L } from './pose-shared.js';

export const HUES = 12, SIG_BINS = HUES * 2 + 2;
const DARK = 0.2, GREY = 0.2, VIVID = 0.5;
const BIN_DARK = HUES * 2, BIN_LIGHT = HUES * 2 + 1;

/* how the appearance enters the choice of who is who (pose.js `_assign`), in picture heights of distance */
export const APPEAR_COST = 0.18;    /* at most this much is added for clothes that share nothing: enough to decide a tie, never to pick a far body */
export const APPEAR_SLACK = 0.15;   /* distances under this are noise (same clothes, a changed light): they cost nothing */
export const CONTEST = 0.18;        /* a player's best two candidates within this cost of each other are "close": only then is appearance used */
export const REMEMBER_MS = 5000;    /* a player who left is remembered this long, to give their place back */
export const REJOIN_MAX = 0.45;     /* a newcomer is a returning player only if their clothes are this close or closer */
export const SAMPLE_EVERY_MS = 250; /* the learning samples: a few a second */
export const LEARN_EVERY_MS = 2000; /* ...and once a signature is settled, a slow refresh this often */
export const MIN_PIXELS = 12;

const vis = (k) => (k.v ?? k.visibility ?? 1);

function addPixel(sig, r, g, b, w){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, d = mx - mn;
  if (v < DARK){ sig[BIN_DARK] += w; return; }
  const s = d / mx;
  if (s < GREY){ sig[BIN_LIGHT] += w; return; }
  let h;
  if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  const pos = h / 6 * HUES - 0.5, i0 = Math.floor(pos), f = pos - i0, sat = s >= VIVID ? 1 : 0;
  sig[(((i0 % HUES) + HUES) % HUES) * 2 + sat] += w * (1 - f);
  sig[((((i0 + 1) % HUES) + HUES) % HUES) * 2 + sat] += w * f;
}

/* The torso's signature, or null when it can't be read (a corner not clearly seen, too few pixels in the picture). */
export function sampleSignature(frame, lm, { mirrored = true } = {}){
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  const c = [L.L_SHOULDER, L.R_SHOULDER, L.L_HIP, L.R_HIP].map(i => lm[i]);
  if (c.some(k => !k || vis(k) < 0.5)) return null;
  const { data, width: W, height: H } = frame, sig = new Float32Array(SIG_BINS);
  let n = 0, total = 0;
  const px = (x, y, w) => {
    const fx = mirrored ? 1 - x : x;
    const ix = Math.round(fx * (W - 1)), iy = Math.round(y * (H - 1));
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const o = (iy * W + ix) * 4;
    addPixel(sig, data[o], data[o + 1], data[o + 2], w); total += w; n++;
  };
  const [ls, rs, lh, rh] = c;
  /* the torso: a grid inside the quad (not its edge, where the background and the arms are) */
  for (let a = 0; a < 5; a++){
    const u = 0.2 + 0.6 * a / 4;
    const tx = ls.x + (rs.x - ls.x) * u, ty = ls.y + (rs.y - ls.y) * u, bx = lh.x + (rh.x - lh.x) * u, by = lh.y + (rh.y - lh.y) * u;
    for (let b = 0; b < 6; b++){ const t = 0.15 + 0.7 * b / 5; px(tx + (bx - tx) * t, ty + (by - ty) * t, 1); }
  }
  /* the upper arms (sleeves), half as much, when the elbows are seen */
  for (const [s, e] of [[L.L_SHOULDER, L.L_ELBOW], [L.R_SHOULDER, L.R_ELBOW]]){
    if (!lm[e] || vis(lm[e]) < 0.5) continue;
    for (let t = 0.3; t < 0.8; t += 0.2) px(lm[s].x + (lm[e].x - lm[s].x) * t, lm[s].y + (lm[e].y - lm[s].y) * t, 0.5);
  }
  if (n < MIN_PIXELS || total <= 0) return null;
  for (let i = 0; i < SIG_BINS; i++) sig[i] /= total;
  return sig;
}

/* 0 for the same clothes, near 1 for nothing in common. */
export function sigDistance(a, b){
  if (!a || !b) return 0;
  let s = 0;
  for (let i = 0; i < SIG_BINS; i++) s += Math.min(a[i], b[i]);
  return Math.max(0, 1 - s);
}

/* What a distance adds to a player-to-body cost: nothing within the slack, then up to APPEAR_COST. */
export function appearanceCost(dist){
  return APPEAR_COST * Math.max(0, dist - APPEAR_SLACK) / (1 - APPEAR_SLACK);
}

/* The learned signature moves toward a new sample (k = how much of the new one). */
export function blendSignature(old, sample, k){
  if (!old) return sample;
  const out = new Float32Array(SIG_BINS);
  for (let i = 0; i < SIG_BINS; i++) out[i] = old[i] * (1 - k) + sample[i] * k;
  return out;
}
