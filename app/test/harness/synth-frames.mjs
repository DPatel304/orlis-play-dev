/* Synthetic camera frames for the tracking tests: a picture in memory ({ data: RGBA bytes, width, height}, which is what
   getImageData gives) with coloured figures drawn where the synthetic landmarks are. There is no canvas in Node, so the figures are
   filled by a tiny rasteriser (convex quads and discs); that is all the clothes reader needs (torso, sleeves, head, legs).
   Landmarks are the tracker's (mirrored: the picture is drawn with x flipped, as the camera's is). */
import { L } from '../../src/tracking/pose-shared.js';

export function blankFrame(width = 96, height = 54, bg = [118, 112, 104]){
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++){ data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255; }
  return { data, width, height };
}

/* a convex polygon of normalised (tracker-space) points, filled; later shapes cover earlier ones */
function fillPoly(f, pts, rgb){
  const P = pts.map(p => ({ x: (1 - p.x) * (f.width - 1), y: p.y * (f.height - 1) }));
  const xs = P.map(p => p.x), ys = P.map(p => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(f.width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(f.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
    let pos = 0, neg = 0;
    for (let i = 0; i < P.length; i++){
      const a = P[i], b = P[(i + 1) % P.length], c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (c > 0) pos++; else if (c < 0) neg++;
    }
    if (pos && neg) continue;
    const o = (y * f.width + x) * 4; f.data[o] = rgb[0]; f.data[o + 1] = rgb[1]; f.data[o + 2] = rgb[2];
  }
}
function fillDisc(f, c, r, rgb){
  const n = 10, pts = Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos(i / n * 6.2832) * r / 1.78, y: c.y + Math.sin(i / n * 6.2832) * r }));
  fillPoly(f, pts, rgb);
}
const sleeve = (a, b, w) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d * w / 1.78, ny = dx / d * w; return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]; };

/* A standing person as the tracker sees one: `x` the hips' place across the picture, `hipY` down it, `torso` shoulders-to-hips in
   picture heights. Landmarks the tracker doesn't use are left in a plain place. */
export function figure(x, hipY, torso, { v = 0.95 } = {}){
  const lm = Array.from({ length: 33 }, () => ({ x, y: hipY, z: 0, v }));
  const sw = torso * 0.38 / 1.78 * 1.78 * 0.5, hw = sw * 0.75;      /* half-widths in picture widths (so they look right drawn) */
  const shY = hipY - torso, kneeY = hipY + torso * 1.25, ankY = hipY + torso * 2.4;
  const set = (k, px, py) => { lm[k] = { x: px, y: py, z: 0, v }; };
  set(L.NOSE, x, shY - torso * 0.55); set(L.L_EYE, x - 0.004, shY - torso * 0.6); set(L.R_EYE, x + 0.004, shY - torso * 0.6);
  set(L.L_SHOULDER, x - sw, shY); set(L.R_SHOULDER, x + sw, shY); set(L.L_HIP, x - hw, hipY); set(L.R_HIP, x + hw, hipY);
  set(L.L_ELBOW, x - sw * 1.25, shY + torso * 0.45); set(L.R_ELBOW, x + sw * 1.25, shY + torso * 0.45);
  set(L.L_WRIST, x - sw * 1.3, shY + torso * 0.9); set(L.R_WRIST, x + sw * 1.3, shY + torso * 0.9);
  set(L.L_KNEE, x - hw, kneeY); set(L.R_KNEE, x + hw, kneeY); set(L.L_ANKLE, x - hw, ankY); set(L.R_ANKLE, x + hw, ankY);
  return lm;
}

const dim = (rgb, k) => rgb.map(c => Math.round(c * k));
/* Draw a person into a frame: shirt on the torso and the upper arms, trousers on the legs, skin for the head. */
export function drawFigure(f, lm, { shirt = [200, 40, 40], trousers = [40, 50, 90], skin = [224, 172, 140] } = {}){
  const P = (k) => lm[k];
  const legs = (h, k, a) => fillPoly(f, sleeve(P(h), P(a), 0.018), trousers);
  legs(L.L_HIP, L.L_KNEE, L.L_ANKLE); legs(L.R_HIP, L.R_KNEE, L.R_ANKLE);
  fillPoly(f, [P(L.L_SHOULDER), P(L.R_SHOULDER), P(L.R_HIP), P(L.L_HIP)], shirt);
  fillPoly(f, sleeve(P(L.L_SHOULDER), P(L.L_ELBOW), 0.014), shirt); fillPoly(f, sleeve(P(L.R_SHOULDER), P(L.R_ELBOW), 0.014), shirt);
  fillPoly(f, sleeve(P(L.L_ELBOW), P(L.L_WRIST), 0.01), skin); fillPoly(f, sleeve(P(L.R_ELBOW), P(L.R_WRIST), 0.01), skin);
  fillDisc(f, P(L.NOSE), 0.03, skin);
}

/* The whole picture's light changed: every colour scaled (0.7 = darkened by 30%). */
export function dimFrame(f, k){
  const out = { ...f, data: new Uint8ClampedArray(f.data) };
  for (let i = 0; i < out.data.length; i += 4){ out.data[i] *= k; out.data[i + 1] *= k; out.data[i + 2] *= k; }
  return out;
}

export const SHIRTS = { red: [205, 45, 45], blue: [40, 90, 200], green: [50, 160, 70], yellow: [230, 200, 50], white: [235, 235, 235], black: [30, 30, 34] };
export { dim };
