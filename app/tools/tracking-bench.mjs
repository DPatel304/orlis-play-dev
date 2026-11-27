/* What the two tracking switches cost per frame, headless (no camera, no model):

     cd app && node tools/tracking-bench.mjs            # the tracker's own work: _assign with and without the clothes picture, pickTargets, mergeZoomed
     node tools/tracking-bench.mjs --browser            # + in headless Chromium: the 80 px copy of a 640x360 picture and the 256 px crop (drawImage + getImageData)

   Not measured here (no model loads in this environment: "local pose runtime would not load"): the body tracker's own time for a crop,
   which budget.js's zoomBudget holds to a few ms by only allowing as many crops as fit under ZOOM_MAX_MS on the machine's measured numbers.
   Numbers from a headless box mean little in absolute terms; the DIFFERENCE between rows is the point. */
import '../test/harness/browser.mjs';
import { register } from 'node:module';
import { createRequire } from 'node:module';
register('../test/harness/hooks.mjs', import.meta.url);
const { pose, mergeZoomed, sizeOf } = await import('../src/tracking/pose.js');
const { pickTargets, squareRegion, mapLandmarksFromCrop, mapToCrop } = await import('../src/tracking/zoom.js');
const { blankFrame, figure, drawFigure, SHIRTS } = await import('../test/harness/synth-frames.mjs');

const DT = 1 / 30;
const reset = () => {
  pose.players.forEach(p => Object.assign(p, { present: false, lostFor: 99, watching: 0, at: null, lm: null, filt: null, seg: null, head: null, app: null, goneAt: null }));
  pose._cands = []; pose.cap = 4; let t = 0; pose.clock = () => (t += DT) * 1000;
};
const shirts = [SHIRTS.red, SHIRTS.blue, SHIRTS.green, SHIRTS.yellow];
/* four players; `close` puts two of them side by side so the picture is read to tell them apart */
function scene(close){
  const xs = close ? [0.2, 0.46, 0.54, 0.85] : [0.15, 0.4, 0.62, 0.85];
  return xs.map((x, i) => ({ x, lm: figure(x, 0.62, 0.15), shirt: shirts[i] }));
}
function runAssign(on, close, N = 3000){
  reset();
  const bodies = scene(close), lms = bodies.map(b => b.lm), fr = blankFrame();
  bodies.forEach(b => drawFigure(fr, b.lm, { shirt: b.shirt }));
  for (let i = 0; i < 40; i++) pose._assign(lms.map(l => l.map(k => ({ ...k }))), DT, on ? fr : undefined);     /* (in, and learned) */
  const input = lms.map(l => l.map(k => ({ ...k })));
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) pose._assign(input, DT, on ? fr : undefined);
  return Number(process.hrtime.bigint() - t0) / 1e6 / N;
}
const med = (f, n = 7) => { const a = Array.from({ length: n }, f).sort((x, y) => x - y); return a[n >> 1]; };
const row = (name, ms, base) => console.log(name.padEnd(58), ms.toFixed(4).padStart(9), 'ms', base != null ? ('  (+' + (ms - base).toFixed(4) + ')') : '');

console.log('tracker work per look, 4 players (median of 7 runs of 3000 looks):');
const off = med(() => runAssign(false, false)), offC = med(() => runAssign(false, true));
row('_assign, switches off, players apart', off);
row('_assign, clothes on, players apart (learning only)', med(() => runAssign(true, false)), off);
row('_assign, switches off, two players side by side', offC);
row('_assign, clothes on, two side by side (picture read to decide)', med(() => runAssign(true, true)), offC);

{
  reset();
  const bodies = scene(false);
  bodies.forEach((b, i) => { Object.assign(pose.players[i], { present: true, lostFor: 0, at: { x: b.x, y: 0.62, vx: 0, vy: 0, size: 0.07 } }); });
  const dets = bodies.map(b => ({ x: b.x, y: 0.62, size: 0.07 }));
  const N = 20000; let t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) pickTargets(pose.players, dets, { vw: 640, vh: 360, now: 0 });
  row('zoom: pickTargets (4 small players)', Number(process.hrtime.bigint() - t0) / 1e6 / N);
  const targets = pickTargets(pose.players, dets, { vw: 640, vh: 360, now: 0 });
  const raw = bodies.map(b => b.lm.map(k => ({ ...k, x: 1 - k.x, visibility: k.v })));
  const crops = targets.map(t => ({ target: { ...t, expect: 0.07 }, lm: mapLandmarksFromCrop(raw[t.slot].map(k => mapToCrop(k, t.region)), t.region) }));
  t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) mergeZoomed(raw, crops);
  row('zoom: mergeZoomed (4 bodies, 2 crops)', Number(process.hrtime.bigint() - t0) / 1e6 / N);
}

if (process.argv.includes('--browser')){
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch(); const page = await browser.newPage();
  const r = await page.evaluate(() => {
    const src = document.createElement('canvas'); src.width = 640; src.height = 360;
    const c = src.getContext('2d'); for (let i = 0; i < 40; i++){ c.fillStyle = `hsl(${i * 9} 60% 50%)`; c.fillRect(i * 16, (i * 7) % 300, 60, 90); }
    const small = document.createElement('canvas'); small.width = 80; small.height = 45; const sx = small.getContext('2d', { willReadFrequently: true });
    const crop = document.createElement('canvas'); crop.width = 256; crop.height = 256; const cx = crop.getContext('2d');
    const time = (fn, n = 400) => { for (let i = 0; i < 40; i++) fn(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };
    return {
      grab: time(() => { sx.drawImage(src, 0, 0, 80, 45); sx.getImageData(0, 0, 80, 45); }),
      cropDraw: time(() => { cx.drawImage(src, 100, 40, 240, 240, 0, 0, 256, 256); })
    };
  });
  row('browser: 80x45 copy of a 640x360 picture + getImageData', r.grab);
  row('browser: 240 px crop drawn into the 256 px square', r.cropDraw);
  await browser.close();
}
process.exit(0);
