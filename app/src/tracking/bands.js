/* Coloured wristbands (Settings > Testing > "Track coloured wristbands"; off unless the owner turns it on).

   A player wears a band of one bright colour on each wrist (the same colour on both). Three things come of it:
     (a) the wrist's place is refined: the band's blob, found in a small cut-out around where the wrist is, pulls the tracker's wrist toward it;
     (b) a wrist the tracker lost or blurred in a fast swing is recovered: a colour smear along the motion still counts;
     (c) WHO IS WHO: a body whose wrist shows player 2's band is player 2's (pose.js `_byBands` adds BAND_COST to a player-to-body pair that
         shows somebody else's band and not its own; it can only add cost to pairs the ordinary gating already allows, so it never makes a
         far body a match).

   LEARNING (camera check, "Raise your hands for a second"): from the pixels at and just behind each wrist, along the forearm, in this room's
   light, the band's hue / saturation / value range. Both wrists must agree (the same hue within BOTH_WITHIN degrees) and the colour must be vivid
   and tight; with no band (skin colour only, low saturation, colours that differ wrist to wrist) the player is marked "none" and nothing
   else happens for them.

   FINDING (every look, only for players with a band): for each detected body and each wrist a small square (BAND_PX pixels a side, cut out
   of the full video by pose.js - never the 80 px whole-frame copy, which is too small for a band) around where the wrist is, or, if the
   tracker lost it, where the player's hand was heading. The pixels in a player's band range are grouped into blobs; blobs are rejected when
   too big (a cushion, a shirt), too small, or off the line of the forearm (the elbow-to-wrist line, continued): a blob belongs to the arm
   whose chain it continues, never to the other one because of colour. The best blob's centroid and size are the evidence.

   Everything here is a plain function of numbers and pixel arrays ({ data: RGBA bytes, width, height, x0, y0, w, h, mirrored } - a crop of
   the VIDEO's own space: x0, y0, w, h as fractions of the video, mirrored: the tracker's x is 1 - the video's); no canvas, no camera. Units
   are picture heights (H) where a distance matters; 1 W = 16/9 H. A crop is looked at and dropped: never shown, kept or sent (decisions
   0007, 0011); what is recorded is the learnt colour range and the blob centroids. */
import { L } from './pose-shared.js';

export const A = 16 / 9;
export const BAND_PX = 56;                /* a crop's side in pixels (48 to 64 is what a band needs) */
export const MAX_BAND_CROPS = 8;          /* at most this many cut-outs a look (4 bodies, 2 wrists) */
export const BAND_COST = 0.35;            /* picture heights added to a pair that shows another player's band and not its own (MATCH is 0.25) */
export const BAND_ABSENT = 0.15;          /* ...and to a pair, for a player with a band, whose body shows both wrists in clear view and no band of theirs */
export const BAND_BLEND = 0.8;            /* how far a sure blob pulls a visible wrist toward it (times its confidence, less when the tracker is sure) */
export const BAND_MIN_CONF = 0.3;         /* a blob less sure than this is not used at all */
export const RECOVER_VIS = 0.3;           /* a wrist less visible than this counts as lost */
export const SHIRT_SHARE = 0.12;          /* the band's colour on this share of the player's torso: their shirt matches */
export const SHIRT_WEIGHT = 0.35;         /* ...and the band counts for this much for that player */
export const BAND_MAX_MS = 6;             /* bands cost at most this much a look (smoothed) before they are left alone for 3 s */
export const MIN_BLOB_PX = 3;
export const MAX_EXT = 0.55, MAX_AREA = 0.25;      /* a blob at most this many forearms long (plus any motion), this many forearms squared in area */
export const ALONG = 0.55, ACROSS = 0.3;           /* ...within this far of the wrist along the forearm line, this far across it (forearms) */
export const LEARN_LOOKS = 6, LEARN_MAX = 40;      /* looks (both hands raised) to settle on a colour; looks after which "none" is the answer */
export const BOTH_WITHIN = 30, RESULTANT = 0.85, MIN_SAT = 0.4, MIN_BANDLIKE = 0.18;
export const HUE_FLOOR = 20, HUE_CEIL = 32;        /* half-width of a learnt hue range: at least a +-15 degree warm-light shift fits */
export const DRIFT_MAX = 20, DRIFT_K = 0.1;        /* a range follows a slowly changing light: at most this far from where it was learnt */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const vis = (k) => (k ? (k.v ?? k.visibility ?? 1) : 0);
const len = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y);

export const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/* [hue 0..360, saturation 0..1, value 0..1] */
export function rgbToHsv(r, g, b){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0){ if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
  return [h, mx === 0 ? 0 : d / mx, mx / 255];
}

/* ---------- the arms ---------- */
export const ARMS = [{ s: L.L_SHOULDER, e: L.L_ELBOW, w: L.L_WRIST }, { s: L.R_SHOULDER, e: L.R_ELBOW, w: L.R_WRIST }];
/* torso length (picture heights) of a body */
export function torsoOf(lm){
  const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, sy = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2;
  const hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
  return Math.hypot((hx - sx) * A, hy - sy);
}

/* The small square to cut out around a wrist, in the tracker's space, and what the search needs to judge a blob there.
   lm: the body's landmarks (tracker space); side: 0 left, 1 right; pred: where the tracker's player had the wrist and where it was heading
   ({ x, y }), used when the wrist is lost; dt: seconds since the last look. Gives null when the arm cannot be read at all.
     cx, cy    the centre of the square
     side      its side, in picture heights
     F         the forearm's length (H), kept within what a body of this size can have
     u         the forearm's direction, elbow to wrist (H units, unit length), or null when the elbow is not seen
     wrist     the wrist the search is about (the tracker's, or the predicted one if it was lost), tracker space
     travel    how far the wrist may have moved since the last look (H): lets a smear be long and the blob be further away
     lost      the tracker's wrist was not seen and the predicted one is used                                                   */
export function wristWindow(lm, side, { pred = null, dt = 1 / 30, maxSide = 0.45, minSide = 0.1 } = {}){
  const { e: ei, w: wi, s: si } = ARMS[side], W = lm[wi], E = lm[ei], S = lm[si];
  if (!W || !S) return null;
  const T = torsoOf(lm);
  if (!(T > 0.02)) return null;
  const eSeen = vis(E) >= 0.3, lost = vis(W) < RECOVER_VIS;
  if (lost && !pred) return null;
  const wrist = lost ? pred : { x: W.x, y: W.y };
  let F = eSeen ? len(E, wrist) : T * 0.5;
  F = clamp(F, 0.35 * T, 0.65 * T);
  let u = null;
  if (eSeen){ const dx = (wrist.x - E.x) * A, dy = wrist.y - E.y, d = Math.hypot(dx, dy); if (d > 1e-6) u = { x: dx / d, y: dy / d }; }
  /* how far the wrist may have moved this look: from the predicted place to the tracker's, or by a fast swing's worth when the tracker lost it */
  let travel = pred ? Math.min(2 * F, len(W, pred) + (pred.speed ? pred.speed * dt * A * 0.5 : 0)) : 0;
  if (lost) travel = Math.max(travel, 0.6 * F);
  const sideH = clamp(1.5 * F + 2 * travel, minSide, maxSide);
  return { cx: wrist.x, cy: wrist.y, side: sideH, F, u, wrist, travel, lost };
}

/* ---------- finding blobs ---------- */
/* which of the ranges ([{ k, range }]) a pixel is in (the nearest hue if several), or -1 */
export function pixelClass(ranges, r, g, b){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 20) return -1;
  const v = mx / 255, s = d / mx;
  let h;
  if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h *= 60;
  let best = -1, bd = 1e9;
  for (let q = 0; q < ranges.length; q++){
    const R = ranges[q].range;
    if (s < R.smin || v < R.vmin || v > R.vmax) continue;
    const dh = hueDiff(h, R.h);
    if (dh <= R.hw && dh < bd){ bd = dh; best = q; }
  }
  return best;
}

/* The tracker-space point of a pixel of a crop */
const pxTo = (c, ix, iy) => { const vx = c.x0 + (ix + 0.5) / c.width * c.w; return { x: c.mirrored ? 1 - vx : vx, y: c.y0 + (iy + 0.5) / c.height * c.h }; };

/* All the blobs of each range in a crop, then the best acceptable one per range for this window (win from wristWindow).
   Gives [{ k, x, y, size, area, ext, along, perp, conf, hue }] (x, y in tracker space; size: the blob's width in H, sqrt of its area). */
export function findBlobs(crop, ranges, win){
  const out = [];
  if (!crop || !crop.data || !ranges.length || !win) return out;
  const { data, width: Wp, height: Hp } = crop, n = Wp * Hp;
  const cls = new Int8Array(n).fill(-1);
  let any = false;
  for (let i = 0, o = 0; i < n; i++, o += 4){
    const q = pixelClass(ranges, data[o], data[o + 1], data[o + 2]);
    if (q >= 0){ cls[i] = q; any = true; }
  }
  if (!any) return out;
  const pxH = crop.h / Hp * 1;              /* one pixel's height in H (the crop is square in pixels, so its width in H is the same) */
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  const best = new Array(ranges.length).fill(null);
  for (let i0 = 0; i0 < n; i0++){
    if (cls[i0] < 0 || seen[i0]) continue;
    const q = cls[i0];
    let sp = 0, cnt = 0, sx = 0, sy = 0, x0 = Wp, x1 = -1, y0 = Hp, y1 = -1, hs = 0;
    stack[sp++] = i0; seen[i0] = 1;
    while (sp){
      const i = stack[--sp], x = i % Wp, y = (i / Wp) | 0;
      cnt++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const o = i * 4; hs += rgbToHsv(data[o], data[o + 1], data[o + 2])[0];
      if (x > 0 && cls[i - 1] === q && !seen[i - 1]){ seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < Wp - 1 && cls[i + 1] === q && !seen[i + 1]){ seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && cls[i - Wp] === q && !seen[i - Wp]){ seen[i - Wp] = 1; stack[sp++] = i - Wp; }
      if (y < Hp - 1 && cls[i + Wp] === q && !seen[i + Wp]){ seen[i + Wp] = 1; stack[sp++] = i + Wp; }
    }
    if (cnt < MIN_BLOB_PX) continue;
    const c = pxTo(crop, sx / cnt, sy / cnt), F = win.F, tr = win.travel || 0;
    const area = cnt * pxH * pxH, ext = Math.max(x1 - x0 + 1, y1 - y0 + 1) * pxH;
    if (ext > MAX_EXT * F + tr * 1.2 || area > MAX_AREA * F * F + tr * F * 0.3) continue;       /* too big: a cushion, a shirt */
    const dx = (c.x - win.wrist.x) * A, dy = c.y - win.wrist.y;
    let along, perp;
    if (win.u){ along = dx * win.u.x + dy * win.u.y; perp = Math.abs(dx * win.u.y - dy * win.u.x); }
    else { along = 0; perp = Math.hypot(dx, dy); }
    const reach = ALONG * F + tr, wide = ACROSS * F + tr * 0.5;
    if (win.u ? (Math.abs(along) > reach || perp > wide) : perp > reach) continue;            /* off the line of the forearm */
    const d = Math.hypot(along, perp), a = area / (F * F);
    const sizeFit = a < 0.01 ? a / 0.01 : a <= 0.15 ? 1 : clamp(1 - (a - 0.15) / 0.10, 0, 1);
    const conf = clamp(sizeFit * (1 - 0.6 * d / (reach + 1e-9)), 0, 1) * Math.min(1, cnt / 6);
    if (!best[q] || conf > best[q].conf) best[q] = { k: ranges[q].k, x: c.x, y: c.y, size: Math.sqrt(area), area, ext, along, perp, conf, hue: hs / cnt };
  }
  for (const b of best) if (b) out.push(b);
  return out;
}

/* One body's wrists, both searched; a blob seen by both arms goes to the arm whose line it is nearer.
   crops: the crop for each side's window (or null); wins: [win0, win1] (or null for an arm that cannot be read).
   Gives { blobs: [{ k, side, x, y, size, conf, hue }], clear } where clear is how many wrists (0 to 2) were looked at in clear view: the tracker
   sees them (not lost) and a cut-out was taken - so that no band there means something. */
export function bodyBlobs(wins, crops, ranges){
  const per = [[], []];
  for (let s = 0; s < 2; s++) if (wins[s] && crops[s]) per[s] = findBlobs(crops[s], ranges, wins[s]);
  /* the same blob in both windows (hands together, arms crossed): the arm whose forearm line it continues keeps it */
  for (const a of per[0]) for (const b of per[1]){
    if (a.k !== b.k || a.drop || b.drop) continue;
    if (len(a, b) > 0.3 * Math.max(wins[0].F, wins[1].F)) continue;
    if (a.perp <= b.perp) b.drop = true; else a.drop = true;
  }
  const out = [];
  for (let s = 0; s < 2; s++) for (const b of per[s]) if (!b.drop && b.conf >= BAND_MIN_CONF) out.push({ k: b.k, side: s, x: b.x, y: b.y, size: b.size, conf: b.conf, hue: b.hue });
  let clear = 0;
  for (let s = 0; s < 2; s++) if (wins[s] && crops[s] && !wins[s].lost) clear++;
  return { blobs: out, clear };
}

/* A body's evidence as { player slot -> how sure its band is on this body } (the best of its wrists, more if both show it) */
export function bandsSeen(blobs){
  const by = new Map();
  for (const b of blobs){ const c = by.get(b.k) || 0; by.set(b.k, 1 - (1 - c) * (1 - b.conf)); }
  return by;
}

/* What it adds to the cost of pairing player i with a body that shows these bands (by: from bandsSeen; clear: how many wrists of the body were in
   clear view; has: player i has a learnt band): BAND_COST times how much more it shows somebody else's band than the player's own, and, for a
   player with a band, BAND_ABSENT (times clear / 2) when the body's wrists are in clear view and the player's band is not on them. Nothing for a
   body not looked at, or one that shows the player's own band. */
export function bandCost(by, i, { has = false, clear = 0 } = {}){
  const own = by ? by.get(i) || 0 : 0;
  let other = 0;
  if (by) for (const [k, c] of by) if (k !== i && c > other) other = c;
  return BAND_COST * Math.max(0, other - own) + (has ? BAND_ABSENT * Math.min(1, clear / 2) * (1 - Math.min(1, own / 0.5)) : 0);
}

/* ---------- refining and recovering the wrist ---------- */
/* Where a wrist should be given its band's blob. w: the tracker's wrist ({ x, y, v }), blob: { x, y, conf }. Gives { x, y, v } or null (no change).
   A lost wrist is put on the blob; a visible one is pulled toward it by the blob's confidence (less so the surer the tracker is). */
export function refineWrist(w, blob){
  if (!w || !blob || !(blob.conf >= BAND_MIN_CONF)) return null;
  const v = vis(w);
  if (v < RECOVER_VIS) return { x: blob.x, y: blob.y, v: Math.max(v, 0.5 + 0.3 * blob.conf), recovered: true };
  const k = clamp(blob.conf * BAND_BLEND * (1 - 0.5 * clamp((v - 0.3) / 0.6, 0, 1)), 0, 0.9);
  return { x: w.x + (blob.x - w.x) * k, y: w.y + (blob.y - w.y) * k, v };
}

/* ---------- learning ---------- */
/* The pixels of one wrist, read for learning: points at and behind the wrist along the forearm (and a little across), and a reference, the
   bare forearm's (or sleeve's) own colour further up. Gives { px: [[h, s, v]...] of the band-like ones, total } or null. */
export function sampleBand(crop, win){
  if (!crop || !crop.data || !win || !win.u) return null;
  const px = (t, c) => {
    const x = win.wrist.x - win.u.x * (t * win.F) / A + (-win.u.y) * (c * win.F) / A, y = win.wrist.y - win.u.y * (t * win.F) + win.u.x * (c * win.F);
    const vx = crop.mirrored ? 1 - x : x;
    const ix = Math.floor((vx - crop.x0) / crop.w * crop.width), iy = Math.floor((y - crop.y0) / crop.h * crop.height);
    if (ix < 0 || iy < 0 || ix >= crop.width || iy >= crop.height) return null;
    const o = (iy * crop.width + ix) * 4;
    return [crop.data[o], crop.data[o + 1], crop.data[o + 2]];
  };
  const refs = [];
  for (let t = 0.55; t <= 0.85; t += 0.1) for (const c of [-0.05, 0.05]){ const p = px(t, c); if (p) refs.push(rgbToHsv(...p)); }
  const ref = refs.length ? { h: median(refs.map(r => r[0])), s: median(refs.map(r => r[1])) } : null;
  const out = []; let total = 0;
  for (let t = -0.08; t <= 0.32; t += 0.08) for (const c of [-0.06, 0, 0.06]){
    const p = px(t, c); if (!p) continue;
    total++;
    const [h, s, v] = rgbToHsv(...p);
    if (s < 0.35 || v < 0.2) continue;
    if (ref && !(hueDiff(h, ref.h) >= 25 || (s - ref.s) >= 0.3)) continue;
    out.push([h, s, v]);
  }
  return { px: out, total };
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

/* Gathers a player's wrist samples over some looks and says what the band is. */
export class BandLearner {
  constructor(){ this.side = [0, 1].map(() => ({ c: 0, s: 0, n: 0, sat: 0, val: 0, total: 0, looks: 0 })); this.looks = 0; }
  /* one look: samples[side] from sampleBand, both wrists raised */
  add(samples){
    if (!samples[0] || !samples[1]) return;
    this.looks++;
    for (let s = 0; s < 2; s++){
      const a = this.side[s], m = samples[s];
      a.total += m.total; a.looks++;
      for (const [h, sat, v] of m.px){ a.c += Math.cos(h * Math.PI / 180); a.s += Math.sin(h * Math.PI / 180); a.n++; a.sat += sat; a.val += v; }
    }
  }
  /* 'learning' until LEARN_LOOKS looks are in; then { state: 'ok', range } or { state: 'none' }. final: decide now with what there is. */
  result(final = false){
    if (this.looks < LEARN_LOOKS && !final) return { state: 'learning', progress: this.looks / LEARN_LOOKS };
    if (this.looks < Math.min(3, LEARN_LOOKS)) return { state: 'none' };
    const hs = [], d = this.side.map((a) => {
      const frac = a.total ? a.n / a.total : 0;
      if (a.n < 6 || frac < MIN_BANDLIKE) return null;
      const R = Math.hypot(a.c, a.s) / a.n;
      if (R < RESULTANT) return null;
      const h = (Math.atan2(a.s, a.c) * 180 / Math.PI + 360) % 360, sigma = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(R, 1e-6)))) * 180 / Math.PI;
      hs.push(h);
      return { h, sat: a.sat / a.n, val: a.val / a.n, sigma, n: a.n };
    });
    if (!d[0] || !d[1] || hueDiff(d[0].h, d[1].h) > BOTH_WITHIN) return { state: 'none' };
    const sat = (d[0].sat + d[1].sat) / 2, val = (d[0].val + d[1].val) / 2, sigma = Math.max(d[0].sigma, d[1].sigma);
    if (sat < MIN_SAT) return { state: 'none' };
    const mean = (Math.atan2(Math.sin(hs[0] * Math.PI / 180) + Math.sin(hs[1] * Math.PI / 180), Math.cos(hs[0] * Math.PI / 180) + Math.cos(hs[1] * Math.PI / 180)) * 180 / Math.PI + 360) % 360;
    const hw = clamp(HUE_FLOOR + sigma, HUE_FLOOR, HUE_CEIL) + hueDiff(d[0].h, d[1].h) / 2;
    return { state: 'ok', range: { h: mean, h0: mean, hw, smin: Math.max(0.3, sat * 0.55), vmin: Math.max(0.15, val * 0.45), vmax: 1 } };
  }
}

/* The share of a body's torso (a grid inside the shoulders-hips quad) that is in the range: a shirt in the band's colour. frame: the small
   whole-picture copy ({ data, width, height }), mirrored as the camera's. null when it cannot be read. */
export function torsoShare(frame, lm, range, { mirrored = true } = {}){
  if (!frame || !frame.data || !range) return null;
  const c = [L.L_SHOULDER, L.R_SHOULDER, L.L_HIP, L.R_HIP].map(i => lm[i]);
  if (c.some(k => !k || vis(k) < 0.5)) return null;
  const [ls, rs, lh, rh] = c, { data, width: W, height: H } = frame;
  let n = 0, hit = 0;
  for (let a = 0; a < 5; a++){
    const u = 0.2 + 0.6 * a / 4;
    const tx = ls.x + (rs.x - ls.x) * u, ty = ls.y + (rs.y - ls.y) * u, bx = lh.x + (rh.x - lh.x) * u, by = lh.y + (rh.y - lh.y) * u;
    for (let b = 0; b < 6; b++){
      const t = 0.15 + 0.7 * b / 5, x = tx + (bx - tx) * t, y = ty + (by - ty) * t;
      const ix = Math.round((mirrored ? 1 - x : x) * (W - 1)), iy = Math.round(y * (H - 1));
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      const o = (iy * W + ix) * 4;
      n++; if (pixelClass([{ k: 0, range }], data[o], data[o + 1], data[o + 2]) === 0) hit++;
    }
  }
  return n ? hit / n : null;
}
export const bandWeight = (share) => share != null && share >= SHIRT_SHARE ? SHIRT_WEIGHT : 1;

/* A range follows a slowly changing light: its centre drifts toward the hue of the blobs seen (at most DRIFT_MAX from where it was learnt). */
export function drift(range, hue){
  if (!range || hue == null) return;
  const toward = ((hue - range.h + 540) % 360) - 180;
  range.h = ((range.h + toward * DRIFT_K) % 360 + 360) % 360;
  const off = ((range.h - range.h0 + 540) % 360) - 180;
  if (Math.abs(off) > DRIFT_MAX) range.h = ((range.h0 + Math.sign(off) * DRIFT_MAX) % 360 + 360) % 360;
}

/* ---------- what is kept in a recording ---------- */
export const packRange = (r) => r ? { h: Math.round(r.h0 ?? r.h), hw: Math.round(r.hw), smin: Math.round(r.smin * 100) / 100, vmin: Math.round(r.vmin * 100) / 100 } : null;
export const unpackRange = (r) => r ? { h: r.h, h0: r.h, hw: r.hw, smin: r.smin, vmin: r.vmin, vmax: 1 } : null;
