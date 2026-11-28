/* How bright the room looks to the camera, and what to say about it. Pure functions over a plain frame ({ data: RGBA bytes, width, height },
   which is what the tracker's small copy of the picture is - see pose.js `_grab`; tests build frames in memory). Only numbers come out:
   the picture is not kept, shown or sent.

     meanLuminance(frame)           0 (black) to 1 (white): the average brightness of the whole picture
     estimateLight(frame, bodies)   { mean, person, background, gap, bodies }: the same, for the people (the box round the head, shoulders
                                    and hips of each body in view) and for everything outside those boxes. Landmarks are the tracker's
                                    (mirrored); the frame is the camera's, not mirrored, so x is flipped here, as appearance.js does
     LightWatch                     steadies the verdict over time: 'ok' | 'dark' | 'backlit' (enter after SUSTAIN_S, leave with a margin)
     tipFor(state)                  the few words, or null
     Lift                           the "screen as a light" level, 0..1, eased: dark for a few seconds -> up over EASE_S, and back          */
import { L } from './pose-shared.js';

export function meanLuminance(frame, stride = 1){
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  const { data, width, height } = frame;
  let sum = 0, n = 0;
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride){
    const o = (y * width + x) * 4;
    sum += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]; n++;
  }
  return n ? sum / n / 255 : null;
}

/* thresholds (guesses until tried with a real camera: the camera's own auto exposure pulls a dim room toward the middle, so "dark" is low) */
export const DARK_MEAN = 0.2;          /* the whole picture this dim or dimmer: too dark */
export const BACKLIT_GAP = 0.22;       /* the background brighter than the people by this much... */
export const BACKLIT_BG = 0.5;         /* ...and itself at least this bright (a bright window or lamp behind) ... */
export const BACKLIT_PERSON = 0.62;    /* ...while the people are no brighter than this, and clearly darker than it (BACKLIT_RATIO) */
export const BACKLIT_RATIO = 0.8;
const BOX_KEYS = [L.NOSE, L.L_SHOULDER, L.R_SHOULDER, L.L_HIP, L.R_HIP];
const seen = (k) => k && (k.v ?? k.visibility ?? 1) > 0.5;

/* The box round one body's head, shoulders and hips (fractions of the picture, mirrored), or null when they are not clearly seen. */
export function personBox(lm){
  const pts = BOX_KEYS.map(i => lm[i]);
  if (!lm || !pts.every(seen)) return null;
  const xs = pts.map(k => k.x), ys = pts.map(k => k.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0;
  return { x0: Math.max(0, x0), x1: Math.min(1, x1), y0: Math.max(0, y0 - h * 0.12), y1: Math.min(1, y1 + h * 0.05) };
}

export function estimateLight(frame, bodies = [], { mirrored = true } = {}){
  const mean = meanLuminance(frame);
  if (mean == null) return null;
  const boxes = bodies.map(personBox).filter(Boolean);
  const out = { mean, person: null, background: null, gap: null, bodies: boxes.length };
  if (!boxes.length) return out;
  const { data, width: W, height: H } = frame;
  let ps = 0, pn = 0, bs = 0, bn = 0;
  for (let y = 0; y < H; y++){
    const fy = (y + 0.5) / H;
    for (let x = 0; x < W; x++){
      const fx = (x + 0.5) / W, mx = mirrored ? 1 - fx : fx, o = (y * W + x) * 4;
      const v = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
      if (boxes.some(b => mx >= b.x0 && mx <= b.x1 && fy >= b.y0 && fy <= b.y1)){ ps += v; pn++; } else { bs += v; bn++; }
    }
  }
  if (pn < 6 || bn < 6) return out;
  out.person = ps / pn / 255; out.background = bs / bn / 255; out.gap = out.background - out.person;
  return out;
}

/* One estimate's verdict, before any steadying. */
export function verdict(e){
  if (!e) return 'ok';
  if (e.person != null && e.gap > BACKLIT_GAP && e.background >= BACKLIT_BG && e.person <= BACKLIT_PERSON && e.person <= e.background * BACKLIT_RATIO) return 'backlit';
  if (e.mean < DARK_MEAN) return 'dark';
  return 'ok';
}
export const TIPS = { dark: 'Turn on a light near you', backlit: 'A bright window behind you makes you hard to see' };
export const tipFor = (state) => TIPS[state] || null;

export const SUSTAIN_S = 2, CLEAR_S = 1.5;
/* A verdict has to hold for SUSTAIN_S seconds to show, and the estimate has to clear it (by a margin) for CLEAR_S to go. */
export class LightWatch {
  constructor({ sustain = SUSTAIN_S, clear = CLEAR_S } = {}){ this.sustain = sustain; this.clear = clear; this.reset(); }
  reset(){ this.state = 'ok'; this._cand = 'ok'; this._for = 0; this.last = null; }
  step(dt, est){
    this.last = est;
    let v = verdict(est);
    /* hysteresis: once showing, the margin to leave is wider (a verdict is held until the estimate is clearly better) */
    if (this.state === 'dark' && v === 'ok' && est && est.mean < DARK_MEAN + 0.05) v = 'dark';
    if (this.state === 'backlit' && v === 'ok' && est && est.person != null && est.gap > BACKLIT_GAP - 0.08 && est.background >= BACKLIT_BG - 0.05) v = 'backlit';
    if (v === this._cand) this._for += dt; else { this._cand = v; this._for = dt; }
    const need = v === 'ok' ? this.clear : this.sustain;
    if (v !== this.state && this._for >= need) this.state = v;
    return this.state;
  }
  get tip(){ return tipFor(this.state); }
}

/* The screen as a light ("Brighten the screen in dark rooms"). The picture's mean brightness is smoothed over a few seconds; below
   ON_BELOW the room counts as dark, and it counts as light again above OFF_ABOVE and only after at least MIN_ON_S (the lifted screen
   itself brightens the room a little: without a margin and a minimum time it would flicker on and off). The level eases between 0 and 1
   over EASE_S seconds and is held at 0 while `blocked` (a cutscene, a flash). */
export const LIFT = { onBelow: 0.2, offAbove: 0.34, minOnS: 30, smoothS: 3, easeS: 2 };
export class Lift {
  constructor(cfg = {}){ this.c = { ...LIFT, ...cfg }; this.reset(); }
  reset(){ this.lum = null; this.dark = false; this.level = 0; this.onFor = 0; }
  step(dt, lum, { blocked = false } = {}){
    const c = this.c;
    if (lum != null) this.lum = this.lum == null ? lum : this.lum + (lum - this.lum) * (1 - Math.exp(-dt / c.smoothS));
    if (this.lum != null){
      if (!this.dark && this.lum < c.onBelow){ this.dark = true; this.onFor = 0; }
      else if (this.dark){ this.onFor += dt; if (this.lum > c.offAbove && this.onFor >= c.minOnS) this.dark = false; }
    }
    const target = this.dark && !blocked ? 1 : 0, k = dt / c.easeS;
    this.level = target > this.level ? Math.min(target, this.level + k) : Math.max(target, this.level - k);
    return this.level;
  }
}
