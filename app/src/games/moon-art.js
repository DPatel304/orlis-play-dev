/* A made-up body for a pointer: standIn() gives the 33 landmarks of a standing player from a single point (the mouse, or a picture on the
   menu), with one arm reaching toward a spot. (This file used to paint the moon for Moon Bounce; that game is gone.) */
import { L } from '../tracking/pose.js';

/* A standing pose made up from a single point - the mouse, or a picture on
   the menu - with one hand reaching to (hx, hy). Mirrored like the real ones. */
export function standIn(x, hx = null, hy = null, s = 0.3){
  const lm = Array.from({ length: 33 }, () => ({ x, y: 0.6, v: 0.9 }));
  const at = (i, dx, dy) => { lm[i] = { x: x + dx * s * 0.6, y: 0.55 + dy * s, v: 0.9 }; };
  at(L.NOSE, 0, -0.45); at(L.L_EYE, 0.04, -0.48); at(L.R_EYE, -0.04, -0.48); at(7, 0.08, -0.46); at(8, -0.08, -0.46);
  at(L.L_SHOULDER, 0.2, -0.25); at(L.R_SHOULDER, -0.2, -0.25);
  at(L.L_ELBOW, 0.32, -0.02); at(L.R_ELBOW, -0.32, -0.02);
  at(L.L_WRIST, 0.34, 0.2); at(L.R_WRIST, -0.34, 0.2);
  at(L.L_HIP, 0.13, 0.25); at(L.R_HIP, -0.13, 0.25);
  at(L.L_KNEE, 0.15, 0.55); at(L.R_KNEE, -0.15, 0.55);
  at(L.L_ANKLE, 0.15, 0.85); at(L.R_ANKLE, -0.15, 0.85);
  if (hx != null) armToward(lm, hx, hy, s * 0.5);
  return lm;
}

/* Point a made-up body's right arm at (hx, hy), reaching no further than
   `reach` screen heights from the shoulder: the body has proportions, a
   mouse pointer doesn't. aspect is the screen's width over its height. */
export function armToward(lm, hx, hy, reach, aspect = 16 / 9){
  const sh = lm[L.R_SHOULDER];
  const dx = (hx - sh.x) * aspect, dy = hy - sh.y, k = Math.min(1, reach / (Math.hypot(dx, dy) || 1));
  const wx = sh.x + (hx - sh.x) * k, wy = sh.y + dy * k;
  lm[L.R_WRIST] = { x: wx, y: wy, v: 0.9 };
  lm[L.R_ELBOW] = { x: (sh.x + wx) / 2 - reach * 0.08 / aspect, y: (sh.y + wy) / 2 + reach * 0.08, v: 0.9 };
  return lm;
}

