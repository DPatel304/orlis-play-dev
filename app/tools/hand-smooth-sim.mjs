/* A simulated camera and screen for the hand's drawing: samples of one wrist come at sampleHz, the screen draws at drawHz.
   Used by test/smooth.test.mjs and tools/hand-smooth-measure.mjs. Needs the test harness (node --import ./test/harness/register.mjs). */
import { pose, L } from '../src/tracking/pose.js';
import { easeCursor } from '../src/ui/cursor.js';

const lmFor = (wx, wy) => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 0.9 }));
  lm[L.L_SHOULDER] = { x: 0.44, y: 0.4, z: 0, v: 0.9 }; lm[L.R_SHOULDER] = { x: 0.56, y: 0.4, z: 0, v: 0.9 };
  lm[L.L_HIP] = { x: 0.46, y: 0.7, z: 0, v: 0.9 }; lm[L.R_HIP] = { x: 0.54, y: 0.7, z: 0, v: 0.9 };
  lm[L.R_WRIST] = { x: wx, y: wy, z: 0, v: 0.95 }; lm[L.L_WRIST] = { x: 0.4, y: 0.7, z: 0, v: 0.1 };
  return lm;
};

/* path(tSeconds) -> { x, y } (screen widths); late(k) -> extra ms of delay for the kth sample (default none).
   mode 'held': what was drawn before (the newest sample, held until the next); 'smooth': drawn between samples, then eased.
   Gives one entry a frame: { t, x, y, want } with x, y the cursor's place and want the hand's true place (in screen widths). */
export function simulate({ path, sampleHz = 18, drawHz = 165, seconds = 3, mode = 'smooth', late = () => 0 }){
  let T = 0;
  const saved = { clock: pose.clock, mouse: pose.mouse.active };
  pose.clock = () => T; pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true; p.lostFor = 0; p.lm = null; p.seg = null; p.filt = null;
  const frames = [], f = {};
  const frame = 1000 / drawHz;
  let k = 0, next = 0, lastT = 0;
  for (let t = 0; t <= seconds * 1000; t += frame){
    T = t;
    if (t >= next){
      const w = path(next / 1000);
      pose._apply(p, lmFor(w.x, w.y), 1 / sampleHz);
      k++; next += 1000 / sampleHz + late(k);
    }
    if (mode === 'smooth') pose.at(t);
    const h = pose.cursorHand(p);
    const c = mode === 'smooth' ? easeCursor(f, h.x, h.y, (t - lastT) / 1000 || 1 / drawHz) : { x: h.x, y: h.y };
    lastT = t;
    const want = path(t / 1000);
    frames.push({ t, x: c.x, y: c.y, want: want.x });
  }
  pose.clock = saved.clock; pose.mouse.active = saved.mouse;
  p.present = false; p.lm = null; p.seg = null;
  return frames;
}

/* The numbers: the largest and the usual jump between drawn frames, in pixels of a screen that wide, and the frames where it did not move. */
export function jumps(frames, width = 1920, from = 1000){
  const fs = frames.filter(f => f.t >= from), d = [];
  for (let i = 1; i < fs.length; i++) d.push(Math.abs(fs[i].x - fs[i - 1].x) * width);
  const sorted = [...d].sort((a, b) => a - b);
  const err = fs.map(f => Math.abs(f.x - f.want) * width);
  return {
    maxJump: Math.max(...d), meanJump: d.reduce((a, b) => a + b, 0) / d.length, medianJump: sorted[d.length >> 1],
    still: d.filter(v => v < 0.01).length / d.length, meanLag: err.reduce((a, b) => a + b, 0) / err.length
  };
}
