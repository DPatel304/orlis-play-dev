/* Looking closer at small or far players (Settings > Testing > "Look closer at small players"; off unless the owner turns it on).

   The body tracker shrinks the whole picture to a small square, so a child far from the camera, or half hidden behind a grown-up, is a
   few dozen pixels and is often missed. After the full-frame look, up to MAX_CROPS regions are cut out of the video (padded and made
   square), the tracker is run on each, and what it finds is mapped back to full-frame coordinates and merged with the full-frame
   result (pose.js `mergeZoomed`).

   This file is the geometry only - which players to look at, the square region around each, and the map between crop and picture -
   as pure functions on plain numbers, so it is all testable without a camera. Everything here is in fractions of the picture
   (x of the width, y of the height). Players' places are the tracker's (mirrored); a region is returned in the VIDEO's own space
   (not mirrored), which is what the crop is cut from and what the tracker's raw answer is in. */

export const ZOOM_BODY = 0.38;        /* a player whose whole body is under this share of the picture's height is "small" */
export const BODY_PER_TORSO = 1 / 0.33;   /* a body is about this many torso lengths (shoulders to hips) tall */
export const RELATIVE_MARGIN = 1.15;  /* ...or whose torso is under STAY_CLOSE (times this) of the biggest in view */
export const MISSING_MS = 1000;       /* a player not found for this long or less is looked for at where they were heading */
export const ZOOM_PAD = 1.6;          /* the square's side, in body heights (a body plus a fifth of a body of room each side) */
export const ZOOM_MIN_SIDE = 0.4;     /* ...but never smaller than this many picture heights (the tracker needs some context) */
export const MAX_CROPS = 2;
const MATCH = 0.25;                   /* a full-frame body within this of where a player should be is that player (same as the tracker's MATCH) */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* A square (in pixels) of `side` picture heights around (cx, cy), kept inside the picture and snapped to whole pixels.
   Near an edge the square slides in rather than shrinking, so the body keeps its room on the other side.
   Gives { x0, y0, w, h } as fractions of the picture, plus px: { x, y, size } in pixels. */
export function squareRegion(cx, cy, side, vw, vh){
  const size = Math.max(8, Math.min(Math.round(side * vh), vw, vh));
  const w = size / vw, h = size / vh;
  const px = Math.round(clamp(cx * vw - size / 2, 0, vw - size)), py = Math.round(clamp(cy * vh - size / 2, 0, vh - size));
  return { x0: px / vw, y0: py / vh, w, h, px: { x: px, y: py, size } };
}

/* A point (or a landmark) in the crop's own 0..1 square, and the picture's. They are exact inverses of each other. */
export const mapFromCrop = (k, r) => ({ ...k, x: r.x0 + k.x * r.w, y: r.y0 + k.y * r.h });
export const mapToCrop = (k, r) => ({ ...k, x: (k.x - r.x0) / r.w, y: (k.y - r.y0) / r.h });
export const mapLandmarksFromCrop = (lm, r) => lm.map(k => mapFromCrop(k, r));

const overlap = (a, b) => {   /* how much of the smaller region the two share */
  const w = Math.min(a.x0 + a.w, b.x0 + b.w) - Math.max(a.x0, b.x0), h = Math.min(a.y0 + a.h, b.y0 + b.h) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h / Math.min(a.w * a.h, b.w * b.h) : 0;
};

/* Who to look at more closely, at most `max` of them, most urgent first:
   - a player gone missing (no full-frame body near where they were heading) in the last MISSING_MS: look where they should be;
   - a player who is small: their body under ZOOM_BODY of the picture's height, or their torso under STAY_CLOSE of the biggest.
   Nobody small and nobody missing gives []. Players not looked at for longest go first, so two small players take turns.
   players: the tracker's players (present, lostFor, goneAt, at: { x, y, vx, vy, size }, zoomAt); dets: the full-frame bodies this look,
   { x, y, size } (tracker space); now: ms on the same clock as goneAt and zoomAt.
   Gives [{ slot, kind: 'missing' | 'small', region, expect }] (expect: the torso length to expect). */
export function pickTargets(players, dets, { vw, vh, now, max = MAX_CROPS, stayClose = 0.38 } = {}){
  const biggest = Math.max(0, ...dets.map(d => d.size), ...players.filter(p => p.present && p.at).map(p => p.at.size || 0));
  const found = [];
  players.forEach((p, slot) => {
    if (!p.at || !(p.at.size > 0)) return;
    const gone = !p.present && p.goneAt != null && now - p.goneAt <= MISSING_MS;
    if (!p.present && !gone) return;
    const ago = p.present ? p.lostFor || 0 : (now - p.goneAt) / 1000, k = Math.min(ago, 0.5);
    const px = p.at.x + (p.at.vx || 0) * k, py = p.at.y + (p.at.vy || 0) * k, size = p.at.size;
    const seen = dets.some(d => Math.hypot(d.x - px, d.y - py) < MATCH);
    const small = size * BODY_PER_TORSO < ZOOM_BODY || size < stayClose * RELATIVE_MARGIN * biggest;
    if (seen && !small) return;
    if (!seen && ago > MISSING_MS / 1000) return;
    const body = size * BODY_PER_TORSO;
    found.push({ slot, kind: seen ? 'small' : 'missing', expect: size, last: p.zoomAt || 0, cx: 1 - px, cy: py, side: clamp(body * ZOOM_PAD, ZOOM_MIN_SIDE, 1) });
  });
  found.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'missing' ? -1 : 1) || a.last - b.last);
  const out = [];
  for (const f of found){
    if (out.length >= max) break;
    const region = squareRegion(f.cx, f.cy, f.side, vw, vh);
    if (out.some(o => overlap(o.region, region) > 0.5)) continue;     /* two players in one crop: one look finds both */
    out.push({ slot: f.slot, kind: f.kind, region, expect: f.expect });
  }
  return out;
}
