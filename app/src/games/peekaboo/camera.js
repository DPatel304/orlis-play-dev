/* Peekaboo Garden's fixed TV camera, as plain numbers (no three.js), so the host can turn a hand's screen point into a spot on the
   floor (the lantern) without any drawing, and the TV view can place its real camera on exactly the same line.
   Garden coordinates (world.js): origin front-left, +x right, +z away from the TV. Scene coordinates (the 3D view): the garden centred on 0,
   +x right, +z TOWARD the TV (so a camera at +z looks at the garden from the front). */
import { SIZE } from './world.js';

export const FOV = 46;                       /* degrees, vertical */
export const CAM_POS = [0, 32, 27];          /* high, in front, looking at the garden's middle */
export const CAM_TARGET = [0, 0, -3];
const HALF = SIZE / 2;

export const toScene = (x, z) => ({ x: x - HALF, z: HALF - z });
export const fromScene = (sx, sz) => ({ x: sx + HALF, z: HALF - sz });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const F = unit(sub(CAM_TARGET, CAM_POS)), R = unit(cross(F, [0, 1, 0])), U = cross(R, F);
const TAN = Math.tan(FOV * Math.PI / 360);

/* A point on the screen (nx, ny in 0..1, y down, as the hands are) to the floor of the garden: { x, z } in garden steps, or null when the
   ray points above the floor (a hand held right at the top of the screen). Kept inside the hedge. */
export function floorPoint(nx, ny, aspect = 16 / 9) {
  const sx = (nx * 2 - 1) * TAN * aspect, sy = -(ny * 2 - 1) * TAN;
  const d = [F[0] + R[0] * sx + U[0] * sy, F[1] + R[1] * sx + U[1] * sy, F[2] + R[2] * sx + U[2] * sy];
  if (d[1] >= -1e-6) return null;
  const t = -CAM_POS[1] / d[1];
  const p = fromScene(CAM_POS[0] + d[0] * t, CAM_POS[2] + d[2] * t);
  return { x: Math.min(SIZE, Math.max(0, p.x)), z: Math.min(SIZE, Math.max(0, p.z)) };
}

/* the other way: a garden point (with a height) to the screen, 0..1 with y down (for 2D marks over the 3D picture) */
export function screenPoint(x, z, y = 0, aspect = 16 / 9) {
  const s = toScene(x, z), d = sub([s.x, y, s.z], CAM_POS);
  const f = d[0] * F[0] + d[1] * F[1] + d[2] * F[2];
  const rx = d[0] * R[0] + d[1] * R[1] + d[2] * R[2], uy = d[0] * U[0] + d[1] * U[1] + d[2] * U[2];
  return { x: (rx / f / (TAN * aspect) + 1) / 2, y: (1 - uy / f / TAN) / 2 };
}
