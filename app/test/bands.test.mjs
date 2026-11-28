import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { pose, sizeOf, seated, CLOSE, STAY_CLOSE, WATCH_AFTER, headOf, L } from '../src/tracking/pose.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { squareRegion } from '../src/tracking/zoom.js';
import { Recorder, unpackBlobs } from '../src/tracking/recorder.js';
import { MAX_BAND_CROPS, BAND_COST, BAND_ABSENT, BAND_PX, BandLearner, sampleBand, wristWindow, findBlobs, bodyBlobs, bandsSeen, bandCost, refineWrist, pixelClass, rgbToHsv, hueDiff, torsoShare, bandWeight, SHIRT_WEIGHT, ARMS, packRange, unpackRange, drift } from '../src/tracking/bands.js';
import * as rig from '../tools/playtest/rig.mjs';
import { scenarios, run } from '../tools/playtest/bandcmp.mjs';
import { figure, drawFigure, drawRect, cropOfScene, hueShift, blankFrame, BANDS, SHIRTS } from './harness/synth-frames.mjs';

const VW = 1920, VH = 1080, lib = { sizeOf, seated, CLOSE, STAY: STAY_CLOSE, WATCH_AFTER, headOf };
const on = (...k) => forceSwitches(Object.fromEntries(['appearance', 'zoom', 'info', 'record', 'steady', 'camera', 'light', 'screenlight', 'apart', 'bands', 'hands'].map(s => [s, k.includes(s)])));
const off = () => forceSwitches(null);

/* a body with both hands raised (for learning) or by its sides, at x */
const body = (x, { raised = false, torso = 0.1 } = {}) => {
  const lm = figure(x, 0.6, torso), sw = (lm[L.R_SHOULDER].x - lm[L.L_SHOULDER].x) / 2, shY = lm[L.L_SHOULDER].y;
  if (raised){
    lm[L.L_ELBOW] = { ...lm[L.L_ELBOW], x: x - sw * 1.6, y: shY - 0.01 }; lm[L.R_ELBOW] = { ...lm[L.R_ELBOW], x: x + sw * 1.6, y: shY - 0.01 };
    lm[L.L_WRIST] = { ...lm[L.L_WRIST], x: x - sw * 1.7, y: shY - torso * 0.55 }; lm[L.R_WRIST] = { ...lm[L.R_WRIST], x: x + sw * 1.7, y: shY - torso * 0.55 };
  }
  return lm;
};
const sceneOf = (lms, { bands = [BANDS.pink, BANDS.pink], extra = null, prev = null } = {}) => (f) => { if (extra) extra(f); lms.forEach((lm, i) => drawFigure(f, lm, { shirt: SHIRTS.red, bands: bands[i] ? [bands[i], bands[i]] : null, prev })); };
const cropAt = (draw, win) => cropOfScene(draw, squareRegion(1 - win.cx, win.cy, win.side, VW, VH), BAND_PX);
const RANGE_PINK = () => { const l = new BandLearner(); const lm = body(0.5, { raised: true }); const draw = sceneOf([lm]); for (let i = 0; i < 8; i++) l.add([0, 1].map(s => { const w = wristWindow(lm, s, {}); return sampleBand(cropAt(draw, w), w); })); return l.result(); };

/* ---------- colour ---------- */
test('colour helpers: hue in degrees, nearest-hue classes, a warm light moves a band by its shift and still matches', () => {
  assert.deepEqual(rgbToHsv(255, 0, 0).map(x => Math.round(x * 100) / 100), [0, 1, 1]);
  assert.equal(Math.round(rgbToHsv(0, 255, 0)[0]), 120); assert.equal(Math.round(rgbToHsv(0, 0, 255)[0]), 240);
  assert.equal(hueDiff(350, 10), 20); assert.equal(hueDiff(10, 350), 20);
  const r = RANGE_PINK();
  assert.equal(r.state, 'ok');
  const rg = [{ k: 0, range: r.range }];
  assert.equal(pixelClass(rg, ...BANDS.pink), 0);
  assert.equal(pixelClass(rg, ...BANDS.cyan), -1); assert.equal(pixelClass(rg, ...SHIRTS.red), -1); assert.equal(pixelClass(rg, 224, 172, 140), -1, 'skin is not the band');
  assert.equal(pixelClass(rg, 120, 118, 116), -1, 'grey is nobody\'s band');
  /* a warm lamp: every hue +14 degrees; the learnt range was wide enough (at least +-15) to hold the band */
  const warm = hueShift({ data: new Uint8ClampedArray([...BANDS.pink, 255]), width: 1, height: 1 }, 14).data;
  assert.equal(pixelClass(rg, warm[0], warm[1], warm[2]), 0, 'the same band under a +14 degree lamp');
  const cool = hueShift({ data: new Uint8ClampedArray([...BANDS.pink, 255]), width: 1, height: 1 }, -14).data;
  assert.equal(pixelClass(rg, cool[0], cool[1], cool[2]), 0, '...and under a -14 degree one');
  /* the range follows a slow change of light, within a limit */
  const d = { ...r.range }; for (let i = 0; i < 60; i++) drift(d, d.h0 + 40);
  assert.ok(Math.abs(((d.h - d.h0 + 540) % 360) - 180) <= 20.001, 'drifts at most 20 degrees');
});

/* ---------- learning ---------- */
test('learning a band: the colour from both wrists in this room\'s light; none for skin only, a grey band, colours that differ, or one wrist', () => {
  const learn = (bandsL, bandsR, lmFn = () => body(0.5, { raised: true })) => {
    const l = new BandLearner(), lm = lmFn();
    const draw = (f) => drawFigure(f, lm, { shirt: SHIRTS.red, bands: [bandsL, bandsR] });
    for (let i = 0; i < 10; i++) l.add([0, 1].map(s => { const w = wristWindow(lm, s, {}); return sampleBand(cropAt(draw, w), w); }));
    return l.result();
  };
  const ok = learn(BANDS.pink, BANDS.pink);
  assert.equal(ok.state, 'ok');
  const hue = rgbToHsv(...BANDS.pink)[0];
  assert.ok(hueDiff(ok.range.h, hue) < 6, 'the hue learnt ' + ok.range.h + ' for ' + hue);
  assert.ok(ok.range.hw >= 20, 'wide enough for a warm lamp');
  /* the learner says "learning" until it has enough looks */
  const part = new BandLearner(); assert.equal(part.result().state, 'learning'); assert.equal(part.result(true).state, 'none', 'nothing seen: none');
  assert.equal(learn(null, null).state, 'none', 'no band: skin on the wrists');
  assert.equal(learn([150, 150, 150], [150, 150, 150]).state, 'none', 'a grey band is not vivid');
  assert.equal(learn(BANDS.pink, BANDS.cyan).state, 'none', 'different colours on the two wrists');
  assert.equal(learn(BANDS.pink, null).state, 'none', 'a band on one wrist only');
  /* with the hands down (not raised) the band is still read: the learner only needs the samples; the pose.js step asks for raised hands */
  assert.equal(learn(BANDS.lime, BANDS.lime).state, 'ok'); assert.equal(learn(BANDS.orange, BANDS.orange).state, 'ok', 'an orange band against skin');
  /* the pack/unpack for a recording keeps the range */
  const u = unpackRange(packRange(ok.range));
  assert.ok(hueDiff(u.h, ok.range.h) <= 0.5 && Math.abs(u.hw - ok.range.hw) <= 0.5);
});

test('a shirt in the band\'s colour lowers the band\'s weight for that player', () => {
  const r = RANGE_PINK(), lm = body(0.5);
  const pic = (shirt) => { const f = blankFrame(); drawFigure(f, lm, { shirt }); return f; };
  assert.ok(torsoShare(pic(BANDS.pink), lm, r.range) > 0.5);
  assert.ok(torsoShare(pic(SHIRTS.blue), lm, r.range) < 0.05);
  assert.equal(bandWeight(torsoShare(pic(BANDS.pink), lm, r.range)), SHIRT_WEIGHT);
  assert.equal(bandWeight(torsoShare(pic(SHIRTS.blue), lm, r.range)), 1);
  assert.equal(bandWeight(null), 1, 'a picture that cannot be read: full weight');
});

/* ---------- finding blobs ---------- */
const find = (lm, side, draw, ranges, opts = {}) => {
  const win = wristWindow(lm, side, opts);
  return { win, blobs: findBlobs(cropAt(draw, win), ranges, win) };
};
test('a band at the wrist is found: its centre within a hair of the wrist, a sensible size', () => {
  const lm = body(0.4), rg = [{ k: 2, range: RANGE_PINK().range }];
  for (const side of [0, 1]){
    const { win, blobs } = find(lm, side, sceneOf([lm]), rg);
    assert.equal(blobs.length, 1); assert.equal(blobs[0].k, 2);
    const w = lm[ARMS[side].w];
    assert.ok(Math.hypot((blobs[0].x - w.x) * 16 / 9, blobs[0].y - w.y) < 0.008, 'centre');
    assert.ok(blobs[0].conf > 0.6 && blobs[0].size < win.F);
  }
});
test('distractors: a cushion (too big), a patch off the forearm line, a patch far along it, and a smear that is too long are not a band', () => {
  const lm = body(0.4), rg = [{ k: 0, range: RANGE_PINK().range }], w = lm[L.R_WRIST];
  const bandless = [null, null];
  /* a cushion in the band's colour right behind the wrist: big */
  let r = find(lm, 1, sceneOf([lm], { bands: bandless, extra: (f) => drawRect(f, w.x, w.y, 0.2, 0.16, BANDS.pink) }), rg);
  assert.equal(r.blobs.length, 0, 'too big');
  /* a small patch beside the arm (a toy), 0.8 forearms across the line */
  const F = r.win.F;
  r = find(lm, 1, sceneOf([lm], { bands: bandless, extra: (f) => drawRect(f, w.x + 0.8 * F / (16 / 9), w.y, 0.016, 0.02, BANDS.pink) }), rg);
  assert.equal(r.blobs.length, 0, 'off the forearm line');
  /* a small patch up the forearm, far from the wrist */
  const e = lm[L.R_ELBOW];
  r = find(lm, 1, sceneOf([lm], { bands: bandless, extra: (f) => drawRect(f, w.x, w.y - 0.9 * F, 0.016, 0.02, BANDS.pink) }), rg);
  assert.equal(r.blobs.length, 0, 'far along the forearm');
  assert.ok(e.y < w.y);
  /* the same patch right at the wrist is the band */
  r = find(lm, 1, sceneOf([lm], { bands: bandless, extra: (f) => drawRect(f, w.x, w.y, 0.016, 0.02, BANDS.pink) }), rg);
  assert.equal(r.blobs.length, 1);
  /* another colour's band is not this player's */
  r = find(lm, 1, sceneOf([lm], { bands: [BANDS.cyan, BANDS.cyan] }), rg);
  assert.equal(r.blobs.length, 0);
});
test('a smear along the motion still counts (a fast swing), and is looked for around where the hand was heading when the tracker lost the wrist', () => {
  const lm = body(0.4), rg = [{ k: 0, range: RANGE_PINK().range }], w = lm[L.R_WRIST];
  const prev = [{ x: w.x, y: w.y }, { x: w.x - 0.012, y: w.y + 0.05 }];       /* the right hand came up 0.05 H in this look */
  const r = find(lm, 1, sceneOf([lm], { prev }), rg, { pred: { x: w.x, y: w.y + 0.02, speed: 1.5 } });
  assert.equal(r.blobs.length, 1, 'a smeared band');
  assert.ok(Math.hypot((r.blobs[0].x - w.x) * 16 / 9, r.blobs[0].y - w.y) < 0.02);
  /* the tracker lost the wrist (low confidence, left at the elbow): the window is where it was heading; the band is found there */
  const lost = lm.map(k => ({ ...k })); lost[L.R_WRIST] = { ...lost[L.R_ELBOW], v: 0.1 };
  const win = wristWindow(lost, 1, { pred: { x: w.x, y: w.y + 0.01, speed: 1 } });
  assert.ok(win && win.lost);
  const blobs = findBlobs(cropAt(sceneOf([lm]), win), rg, win);
  assert.equal(blobs.length, 1);
  assert.equal(wristWindow(lost, 1, {}), null, 'lost and nothing to say where it was heading: nothing to look at');
  const rec = refineWrist(lost[L.R_WRIST], { ...blobs[0] });
  assert.ok(rec.recovered && rec.v >= 0.5 && Math.hypot((rec.x - w.x) * 16 / 9, rec.y - w.y) < 0.02);
});
test('left and right: a band both arms could claim goes to the arm whose forearm line it continues; one band is never two', () => {
  const lm = body(0.5), rg = [{ k: 0, range: RANGE_PINK().range }];
  /* hands together in front: the right wrist is brought to the left one */
  const t = lm.map(k => ({ ...k })), a = t[L.L_WRIST];
  t[L.R_WRIST] = { ...t[L.R_WRIST], x: a.x + 0.012, y: a.y - 0.01 };
  const draw = (f) => drawFigure(f, t, { shirt: SHIRTS.red, bands: [BANDS.pink, null] });          /* one band, on the left wrist only */
  const wins = [0, 1].map(s => wristWindow(t, s, {}));
  const crops = wins.map(w => cropAt(draw, w));
  const { blobs } = bodyBlobs(wins, crops, rg);
  assert.equal(blobs.length, 1, 'one band, one blob');
  assert.equal(blobs[0].side, 0, 'on the arm whose line it is on');
  /* hands touching, one band between them: still one blob, never two */
  const t2 = lm.map(k => ({ ...k })); t2[L.R_WRIST] = { ...t2[L.R_WRIST], x: a.x + 0.003, y: a.y };
  const d2 = (f) => drawFigure(f, t2, { shirt: SHIRTS.red, bands: [BANDS.pink, null] }), w2 = [0, 1].map(s => wristWindow(t2, s, {}));
  assert.equal(bodyBlobs(w2, w2.map(w => cropAt(d2, w)), rg).blobs.length, 1);
  /* arms crossed: each band sits on its own arm's line, so each stays with its own arm */
  const x = lm.map(k => ({ ...k }));
  x[L.L_WRIST] = { ...x[L.L_WRIST], x: lm[L.R_WRIST].x - 0.005, y: lm[L.L_WRIST].y - 0.01 }; x[L.R_WRIST] = { ...x[L.R_WRIST], x: lm[L.L_WRIST].x + 0.005, y: lm[L.R_WRIST].y - 0.01 };
  const dx = sceneOf([x]), ws = [0, 1].map(s => wristWindow(x, s, {}));
  const both = bodyBlobs(ws, ws.map(w => cropAt(dx, w)), rg).blobs;
  assert.deepEqual(both.map(b => b.side).sort(), [0, 1]);
  for (const b of both){ const w = x[ARMS[b.side].w]; assert.ok(Math.hypot((b.x - w.x) * 16 / 9, b.y - w.y) < 0.02, 'each blob is at its own arm\'s wrist'); }
});

/* ---------- the numbers ---------- */
test('the identity cost: another player\'s band on the body costs BAND_COST, a missing own band in clear view costs BAND_ABSENT, nothing for the own band or no look', () => {
  const by = (o) => new Map(Object.entries(o).map(([k, v]) => [+k, v]));
  assert.equal(bandCost(by({ 1: 1 }), 0), BAND_COST, 'another\'s band, not mine');
  assert.equal(bandCost(by({ 0: 1 }), 0), 0, 'mine');
  assert.equal(bandCost(by({ 0: 1, 1: 1 }), 0), 0, 'both: not decided by colour');
  assert.ok(Math.abs(bandCost(by({ 1: 0.5 }), 0) - 0.5 * BAND_COST) < 1e-9, 'a less sure band, a smaller cost');
  assert.equal(bandCost(new Map(), 0), 0); assert.equal(bandCost(null, 0), 0);
  assert.equal(bandCost(new Map(), 0, { has: true, clear: 0 }), 0, 'not looked at: nothing');
  assert.equal(bandCost(new Map(), 0, { has: true, clear: 2 }), BAND_ABSENT, 'looked at, in clear view, no band of mine');
  assert.equal(bandCost(new Map(), 0, { has: false, clear: 2 }), 0, 'no band to miss');
  assert.ok(BAND_COST > 0.25, 'strong: more than the tracker\'s own gate (MATCH 0.25) in picture heights');
  assert.ok(bandsSeen([{ k: 1, conf: 0.5 }, { k: 1, conf: 0.5 }]).get(1) > 0.7, 'both wrists show it: surer');
});
test('refining a visible wrist: pulled toward the band by its confidence, less when the tracker is sure; not at all for a doubtful blob', () => {
  const w = { x: 0.5, y: 0.5, v: 0.95 };
  const r = refineWrist(w, { x: 0.52, y: 0.5, conf: 1 });
  assert.ok(r.x > 0.5 && r.x < 0.52 && r.y === 0.5 && !r.recovered);
  const weak = refineWrist({ ...w, v: 0.5 }, { x: 0.52, y: 0.5, conf: 1 });
  assert.ok(weak.x > r.x, 'a less sure tracker is pulled further');
  assert.equal(refineWrist(w, { x: 0.52, y: 0.5, conf: 0.1 }), null);
  assert.equal(refineWrist(w, null), null);
});

/* ---------- in the tracker ---------- */
function reset(){
  rig.resetPose(pose); pose.cap = 4; pose.clock = () => 10000; pose._cands = [];
  Object.assign(pose, { skip: 1, worker: null, bandMs: 0, _bandOffUntil: 0, _cropFails: 0 });
}
const seat = (slot, x, band = true) => {
  const lm = body(x), p = pose.players[slot];
  p.lm = null; pose._apply(p, lm, 1 / 30); p.present = true; p.lostFor = 0; p.head = headOf(lm); p.at = null; pose._track(p, { x, y: 0.6, size: sizeOf(lm) }, 1 / 30);
  if (band) p.band = { state: 'ok', range: RANGE_PINK().range, weight: 1, seen: false };
  return p;
};
const blob = (k, side = 0, conf = 1) => ({ k, side, x: 0.5, y: 0.7, size: 0.01, conf });
const evOf = (map) => ({ blobsFor: (lm) => map.get(lm) || { blobs: [], clear: 0 } });

test('who is who: a body that shows the other player\'s band is not given to this one, even when it is nearer; a far body is never brought in', () => {
  on('bands'); reset();
  seat(0, 0.46); seat(1, 0.56);
  const A = body(0.47), B = body(0.55);
  const sc = new Map([[A, { blobs: [blob(1), blob(1, 1)], clear: 2 }], [B, { blobs: [blob(0), blob(0, 1)], clear: 2 }]]);
  pose._assign([A, B], 1 / 30, undefined, evOf(sc));
  assert.equal(pose.lastAssign.get(0).lm, B, 'player 0 takes the body with their band'); assert.equal(pose.lastAssign.get(1).lm, A);
  /* the same without the switch: by distance alone, the nearer */
  off(); reset(); seat(0, 0.46); seat(1, 0.56);
  pose._assign([A, B], 1 / 30, undefined, evOf(sc));
  assert.equal(pose.lastAssign.get(0).lm, A, 'off: nearest body');
  /* gating: the only body is far (0.4 away) and shows the player\'s own band: not a match */
  on('bands'); reset(); seat(0, 0.2);
  const far = body(0.7);
  pose._assign([far], 1 / 30, undefined, evOf(new Map([[far, { blobs: [blob(0)], clear: 2 }]])));
  assert.equal(pose.lastAssign.has(0), false, 'band evidence cannot pull a body beyond the tracker\'s own gate');
  off();
});

test('a lost wrist is put on its band; a visible one is pulled a little; the caller\'s landmarks are never changed', () => {
  on('bands'); reset();
  seat(0, 0.5);
  const lm = body(0.5), w0 = { ...lm[L.R_WRIST] };
  lm[L.R_WRIST] = { ...lm[L.R_WRIST], v: 0.1, x: lm[L.R_ELBOW].x, y: lm[L.R_ELBOW].y };           /* lost: at the elbow */
  const copy = JSON.stringify(lm);
  const b = { k: 0, side: 1, x: w0.x, y: w0.y, size: 0.01, conf: 0.9 };
  pose._assign([lm], 1 / 30, undefined, evOf(new Map([[lm, { blobs: [b], clear: 1 }]])));
  assert.equal(JSON.stringify(lm), copy, 'the input is untouched (it is what is recorded)');
  const got = pose.players[0].lm[L.R_WRIST];
  assert.ok(Math.hypot((got.x - w0.x) * 16 / 9, got.y - w0.y) < 0.02, 'the filtered wrist is where the band is, not at the elbow');
  assert.ok(pose.bandsRecovered >= 1);
  off();
});

test('off: byte-identical. Even with a band source offered, every number of every player is the same as with none', () => {
  const once = (src, sw) => {
    sw(); reset();
    const world = rig.makeWorld('4m', 3, { jitter: 0.0018 }), feeder = new rig.Feeder(pose, lib, { assist: true, cap: 4, bands: src });
    const out = [];
    for (let i = 0; i < 240; i++){ world.step(1 / 30, null, null); feeder.step(world, 1 / 30); if (i % 8 === 0) out.push(JSON.stringify(pose.players.map(p => [p.present, p.lm && p.lm.map(k => [k.x, k.y, k.v]), p.hands]))); }
    return out.join('|');
  };
  const trap = () => ({ vw: VW, vh: VH, crop(){ throw new Error('a crop was asked for with the switch off'); }, picture(){ throw new Error('picture'); }, blobsFor(){ throw new Error('blobs'); } });
  const plain = once(null, off), offered = once(trap, off);
  assert.equal(offered, plain);
  /* bands on but nobody has a band: nothing is cut out, nothing changes */
  const noBands = once(trap, () => on('bands'));
  assert.equal(noBands, plain);
  off();
});

test('fail safe: a source that throws, crops that fail, or a body with no elbow leave the look as it would have been without bands', () => {
  const seq = (src, sw) => {
    sw(); reset();
    seat(0, 0.35); seat(1, 0.65);
    const a = body(0.36), b = body(0.64); b[L.R_ELBOW] = { ...b[L.R_ELBOW], v: 0.05 };
    pose._assign([a, b], 1 / 30, undefined, src);
    return JSON.stringify(pose.players.map(p => [p.present, p.lm && p.lm[L.R_WRIST]]));
  };
  const base = seq(undefined, off);
  assert.equal(seq({ vw: VW, vh: VH, crop(){ throw new Error('boom'); } }, () => on('bands')), base, 'crop throws');
  assert.equal(seq({ vw: VW, vh: VH, crop(){ return null; } }, () => on('bands')), base, 'no crops');
  assert.equal(seq({ blobsFor(){ throw new Error('boom'); } }, () => on('bands')), base, 'blobs throw');
  assert.equal(seq({ vw: 0, vh: 0, crop(){ return null; } }, () => on('bands')), base, 'no video size');
  off();
});

test('the budget: no crops without a banded player, at most 8 with four, and bands are not looked at while looks are skipped, in the worker, or when slow', () => {
  on('bands'); reset();
  let n = 0;
  const src = { vw: VW, vh: VH, crop(r){ n++; return null; }, picture: () => null };
  const bodies = [0.15, 0.4, 0.62, 0.85].map(x => body(x));
  pose._assign(bodies, 1 / 30, undefined, src);
  assert.equal(n, 0, 'nobody has a band: nothing is cut out');
  reset(); [0.15, 0.4, 0.62, 0.85].forEach((x, i) => seat(i, x));
  const bs = [0.15, 0.4, 0.62, 0.85].map(x => body(x));
  n = 0; pose._assign(bs, 1 / 30, undefined, src);
  assert.equal(n, 8); assert.equal(n, MAX_BAND_CROPS);
  /* where the crops come from (pose.js): none while skipping, in the worker, or after bands were slow */
  pose.video = { videoWidth: 640, videoHeight: 360 };
  assert.ok(pose._bandSource(), 'normally a source');
  pose.skip = 2; assert.equal(pose._bandSource(), undefined, 'looks are being skipped');
  pose.skip = 1; pose.worker = {}; assert.equal(pose._bandSource(), undefined, 'the tracker is in its worker');
  assert.equal(pose.trackInfo().bands, 'off (worker)');
  pose.worker = null; pose._bandOffUntil = performance.now() + 1000; assert.equal(pose._bandSource(), undefined, 'cost too much lately');
  pose._bandOffUntil = 0; off(); assert.equal(pose._bandSource(), undefined, 'off');
  pose.video = null;
});

test('the readout: band yes / no / none per player, and the cost per look', () => {
  on('bands'); reset();
  seat(0, 0.3); seat(1, 0.7, false); pose.players[1].band = { state: 'none' };
  pose.players[0].band.seen = true;
  let i = pose.trackInfo();
  assert.deepEqual(i.rows.map(r => r.band), ['yes', 'none']);
  pose.players[0].band.seen = false;
  assert.equal(pose.trackInfo().rows[0].band, 'no');
  assert.equal(i.bands, 'on');
  off(); assert.equal(pose.trackInfo().rows[0].band, null); assert.equal(pose.trackInfo().bands, 'off');
});

test('learning in the tracker: raise both hands and each player\'s band is learnt (or "none"); hands down: still learning, then none when it is settled', () => {
  on('bands'); reset();
  const lms = [body(0.3, { raised: true }), body(0.7, { raised: true })], bandOf = [BANDS.lime, null];
  const src = { vw: VW, vh: VH, crop: (r) => cropOfScene(sceneOf(lms, { bands: bandOf }), r, BAND_PX), picture: () => null };
  seat(0, 0.3, false); seat(1, 0.7, false);
  pose.bandsLearn(true);
  /* hands down: nothing to learn from */
  const down = [body(0.3), body(0.7)];
  for (let i = 0; i < 4; i++) pose._assign(down, 1 / 30, undefined, { ...src, crop: (r) => cropOfScene(sceneOf(down, { bands: bandOf }), r, BAND_PX) });
  assert.deepEqual(pose.bandsState().filter(s => s.present).map(s => s.state), [null, null]);
  for (let i = 0; i < 10; i++) pose._assign(lms, 1 / 30, undefined, src);
  assert.deepEqual(pose.bandsState().filter(s => s.present).map(s => s.state), ['ok', 'none']);
  pose.bandsLearn(false);
  assert.equal(pose.players[0].band.state, 'ok'); assert.ok(hueDiff(pose.players[0].band.range.h, rgbToHsv(...BANDS.lime)[0]) < 8);
  assert.equal(pose.players[1].band.state, 'none');
  /* the players' places are looked for by colour from now on */
  assert.equal(pose._bandKit()[0].h > 0, true); assert.equal(pose._bandKit()[1], null);
  off();
});

/* ---------- recording ---------- */
test('a recording holds the learnt range and the blob centres - numbers, never a picture', () => {
  on('bands', 'record'); reset();
  const rec = new Recorder();
  rec.begin({ game: 'g', lineup: 2, bands: [{ h: 325, hw: 22, smin: 0.5, vmin: 0.4, weight: 1 }, null] });
  const people = [body(0.3), body(0.7)];
  rec.add(1000, 1 / 30, people, null, { w: 640, h: 360 });
  rec.bandsOfLast([{ clear: 2, blobs: [{ x: 0.3, y: 0.7, size: 0.012, k: 0, side: 1, conf: 0.93 }] }, null]);
  const text = rec.parts().join(''), j = JSON.parse(text);
  assert.equal(j.rounds[0].bands[0].h, 325); assert.equal(j.rounds[0].bands[1], null);
  assert.deepEqual(j.frames[0].b[0][1][0].slice(3), [0, 1, 93]); assert.deepEqual(j.frames[0].b[1], [0, []]);
  assert.ok(!/"data"|rgba|base64|imageData/i.test(text), 'no pixels');
  const back = unpackBlobs(j.frames[0].b[0]);
  assert.equal(back.clear, 2); assert.ok(Math.abs(back.blobs[0].x - 0.3) < 1e-4 && back.blobs[0].k === 0 && back.blobs[0].side === 1 && Math.abs(back.blobs[0].conf - 0.93) < 0.01);
  /* a look with no blobs and nothing clear adds nothing to the file */
  const r2 = new Recorder(); r2.begin({}); r2.add(1, 0.03, people, null, null); r2.bandsOfLast([null, null]);
  assert.equal(r2.frames[0].b, undefined);
  off();
});
test('pose records the blobs of the look it just took', () => {
  on('bands', 'record'); reset();
  pose.recorder = null; pose._recRound = false;
  seat(0, 0.3);
  pose.recordRound({ game: 'g', lineup: 1 });
  const lm = body(0.31), people = [lm];
  pose._record(people, 1 / 30);
  pose._assign(people, 1 / 30, undefined, evOf(new Map([[lm, { blobs: [blob(0)], clear: 2 }]])));
  pose.recorder.bandsOfLast(people.map(l => pose._bandEv.get(l) || null));
  assert.equal(pose.recorder.frames[0].b[0][1].length, 1);
  assert.ok(pose.recorder.rounds[0].bands[0].h > 0, 'the learnt colour is in the round\'s header');
  pose.recorder = null; pose._recRound = false; off();
});

/* ---------- on the rig: synthetic frames with the truth known ---------- */
const sc = (id) => scenarios(rig).find(s => s.id === id);
const go = (id, sw, seed = 1, secs = null) => { const s = sc(id); return run({ pose, rig, lib, sc: secs ? { ...s, secs } : s, seed, on: sw, jitter: 0.0018 }); };

test('rig: bands are learnt right in every scenario, "none" for a player without one', () => {
  for (const id of ['swing', 'cross', 'cross-one', 'cushion', 'shirt-own', 'warm']){
    const r = go(id, ['bands'], 1, 6);
    assert.equal(r.learntRight, 2, id + ' learnt ' + JSON.stringify(r.learnt));
  }
  assert.deepEqual(go('cross-one', ['bands'], 1, 4).learnt, ['ok', 'none']);
});
test('rig: a wrist the tracker lost in a fast swing is recovered from its band, and a cushion in the band\'s colour does not pull it astray', () => {
  const offR = go('swing', [], 1, 20), onR = go('swing', ['bands'], 1, 20);
  assert.ok(offR.rmsLost > 0.04, 'the lost wrists are far off without bands: ' + offR.rmsLost);
  assert.ok(onR.rmsLost < offR.rmsLost / 3, `recovered: ${onR.rmsLost} against ${offR.rmsLost}`);
  assert.ok(onR.big < offR.big / 5);
  const cu = go('cushion', ['bands'], 1, 20), cuOff = go('cushion', [], 1, 20);
  assert.ok(cu.rms < cuOff.rms, `with a cushion about: ${cu.rms} against ${cuOff.rms}`);
});
test('rig: crossing with the same shirts and different bands, nobody changes places; with the shirt in the other\'s band colour, and under a warm lamp, too', () => {
  for (const id of ['cross', 'shirt-other', 'shirt-own', 'warm']){
    const offR = go(id, [], 1, 45), onR = go(id, ['bands'], 1, 45);
    assert.ok(onR.m.wrongLooks <= offR.m.wrongLooks, `${id}: ${onR.m.wrongLooks} against ${offR.m.wrongLooks}`);
    assert.equal(onR.wrongEnd, 0, id + ' ends in the right places');
  }
  /* alone with Tell players apart better, and one player only with a band */
  const a = go('cross-one', ['apart'], 1, 45), b = go('cross-one', ['apart', 'bands'], 1, 45);
  assert.ok(b.m.wrongLooks <= a.m.wrongLooks);
});
test('rig: ms per look is small and the crops are in memory (the real video copy is not measured here)', () => {
  const r = go('cross', ['bands'], 1, 10);
  assert.ok(r.bandMs > 0 && r.bandMs < BAND_PXMS, 'band look ' + r.bandMs + ' ms');
});
const BAND_PXMS = 6;

test('a recording made with bands replays: the same round through the tracker with the recorded blobs and colours, and bands help there too', async () => {
  const { replay } = await import('../tools/replay.mjs');
  /* record a crossing round as pose.js would: each look's people, then the blobs found for them */
  const rec = new Recorder(), origAssign = pose._assign;
  rec.begin({ game: 'rig', lineup: 2 });
  pose._assign = function (people, dt, frame, src){
    const r = origAssign.call(this, people, dt, frame, src);
    rec.add(pose.clock(), dt, people, null, { w: 1920, h: 1080 });
    rec.bandsOfLast(people.map(lm => (pose._bandEv && pose._bandEv.get(lm)) || null));
    return r;
  };
  try { go('cross', ['bands'], 1, 60); } finally { pose._assign = origAssign; }
  rec.rounds[0].bands = pose._bandKit().some(Boolean) ? pose._bandKit() : [{ h: 325, hw: 24, smin: 0.5, vmin: 0.4, weight: 1 }, { h: 185, hw: 24, smin: 0.5, vmin: 0.4, weight: 1 }];
  assert.ok(rec.frames.some(f => f.b), 'blobs were recorded');
  const text = rec.parts().join(''), file = JSON.parse(text);
  assert.ok(!/"data"|base64|rgba/i.test(text), 'numbers only');
  /* replay it from the file's own numbers (as the tool reads a saved file): packed arrays become plain arrays */
  const frames = file.frames.map(f => ({ ...f, p: f.p.map(a => Int16Array.from(a)) }));
  const without = replay({ ...file, frames }, []), withBands = replay({ ...file, frames }, ['bands']);
  assert.equal(withBands.bandsMissing, 0);
  assert.ok(withBands.suspectSwaps <= without.suspectSwaps, `replayed: ${withBands.suspectSwaps} suspect swaps against ${without.suspectSwaps}`);
  /* a recording with no band colours says so rather than pretending */
  const bare = replay({ ...file, rounds: [{ at: 0, lineup: 2 }], frames }, ['bands']);
  assert.ok(bare.bandsMissing > 0);
  off();
});

/* ---------- the picture is never kept ---------- */
test('only pose.js copies the video; bands.js and hands.js take pixel arrays and keep none', () => {
  for (const f of ['bands.js', 'hands.js']){
    const src = readFileSync(new URL('../src/tracking/' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const no of [/drawImage\(/, /getImageData\(/, /OffscreenCanvas/, /createElement\(/, /localStorage/, /toDataURL|toBlob|convertToBlob/, /postMessage/, /fetch\(/]) assert.ok(!no.test(src), `${f} must not ${no}`);
  }
  const walk = (d) => readdirSync(new URL(d, import.meta.url), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]);
  const readers = walk('../src/').filter(p => p.endsWith('.js') && !p.endsWith('creator-kit.gen.js') && /getImageData\(/.test(readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.ok(!readers.some(p => p.includes('tracking/') && !p.endsWith('tracking/pose.js')), 'no other tracking file reads pixels: ' + readers.join(', '));
  /* what pose.js keeps of a crop is dropped: no field of pose holds one */
  const p = readFileSync(new URL('../src/tracking/pose.js', import.meta.url), 'utf8');
  assert.ok(!/this\._lastCrop|this\.crops\b/.test(p));
});
