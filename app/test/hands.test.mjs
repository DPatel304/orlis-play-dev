import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pose, sizeOf, seated, CLOSE, STAY_CLOSE, WATCH_AFTER, headOf, L } from '../src/tracking/pose.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { mapToCrop, mapFromCrop } from '../src/tracking/zoom.js';
import { handBudget, HAND_MAX_CROPS, ZOOM_MAX_MS, SLOW_MS } from '../src/tracking/budget.js';
import { handRegion, handShape, fitHand, takeRun, newFit, ease, holdWeight, palmFrom, gripNow, pickHands, toTracker, HAND_PX, HAND_SIDE, HAND_AHEAD, HOLD_MS, FADE_MS, MIN_CONF, STALE_MS, H as HP } from '../src/tracking/hands.js';
import { handPoints, handInCrop, fakeHander, PALM_ALONG, PALM_ACROSS } from './harness/synth-hand.mjs';
import { palmHander, PALM } from '../tools/playtest/palmcmp.mjs';
import * as rig from '../tools/playtest/rig.mjs';
import { figure } from './harness/synth-frames.mjs';

const VW = 640, VH = 360, A = 16 / 9, lib = { sizeOf, seated, CLOSE, STAY: STAY_CLOSE, WATCH_AFTER, headOf };
const on = (...k) => forceSwitches(Object.fromEntries(['appearance', 'zoom', 'info', 'record', 'steady', 'camera', 'light', 'screenlight', 'apart', 'bands', 'hands'].map(s => [s, k.includes(s)])));
const off = () => forceSwitches(null);
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

/* ---------- the crop ---------- */
test('hand crops: a square sized from the forearm, its centre a little beyond the wrist, inside the picture, at about 200 pixels', () => {
  const lm = figure(0.5, 0.6, 0.1), e = lm[L.R_ELBOW], w = lm[L.R_WRIST];
  const F = Math.hypot((w.x - e.x) * A, w.y - e.y), r = handRegion(lm, 1, VW, VH);
  assert.ok(near(r.F, F));
  assert.ok(near(r.region.px.size, Math.round(Math.max(0.12, Math.min(0.5, HAND_SIDE * F)) * VH), 1), 'side from the forearm: ' + r.region.px.size);
  assert.ok(near(r.region.w * VW, r.region.h * VH, 1e-6), 'square in pixels');
  assert.ok(HAND_PX >= 192 && HAND_PX <= 224, 'drawn at about 200 px');
  /* the video is the mirror of the tracker's space: the wrist (and a bit beyond) is inside the square */
  const vx = 1 - w.x, ahead = { x: 1 - (w.x + r.u.x * HAND_AHEAD * F / A), y: w.y + r.u.y * HAND_AHEAD * F };
  assert.ok(vx > r.region.x0 && vx < r.region.x0 + r.region.w && w.y > r.region.y0 && w.y < r.region.y0 + r.region.h);
  assert.ok(Math.abs(r.region.x0 + r.region.w / 2 - ahead.x) < 1.5 / VW && Math.abs(r.region.y0 + r.region.h / 2 - ahead.y) < 1.5 / VH, 'centred beyond the wrist');
  /* a long forearm gives a bigger square; at the edge it slides in */
  const big = figure(0.5, 0.6, 0.2); assert.ok(handRegion(big, 1, VW, VH).region.px.size > r.region.px.size);
  const edge = figure(0.97, 0.6, 0.1); const re = handRegion(edge, 1, VW, VH).region;
  assert.ok(re.x0 >= 0 && re.x0 + re.w <= 1 + 1e-12 && re.y0 >= 0 && re.y0 + re.h <= 1 + 1e-12);
  /* an arm that cannot be read gives nothing */
  const hid = figure(0.5, 0.6, 0.1); hid[L.R_ELBOW].v = 0.05; assert.equal(handRegion(hid, 1, VW, VH), null);
  const hid2 = figure(0.5, 0.6, 0.1); hid2[L.R_WRIST].v = 0.2; assert.equal(handRegion(hid2, 1, VW, VH), null);
});

test('a hand found in the crop is mapped back to the picture exactly: the round trip, and the palm where it was put', () => {
  const lm = figure(0.4, 0.6, 0.1), r = handRegion(lm, 0, VW, VH), w = lm[L.L_WRIST];
  const S = 0.5 * r.F;
  /* every point maps from the crop to the picture and back to the same place */
  const pts = handInCrop({ grip: 'open', wrist: { x: w.x, y: w.y }, u: r.u, S, region: r.region, vw: VW, vh: VH });
  for (const k of pts){ const back = mapToCrop(mapFromCrop(k, r.region), r.region); assert.ok(near(back.x, k.x, 1e-12) && near(back.y, k.y, 1e-12)); }
  /* the fake detector answers for the hand in the region; the palm centre comes back where the synthetic hand's palm is */
  const det = fakeHander(() => [{ wrist: { x: w.x, y: w.y }, u: r.u, S, grip: 'open' }], { score: 0.9 });
  const out = det.detect({ videoWidth: VW, videoHeight: VH }, r.region);
  const fit = fitHand({ hand: out.landmarks[0], score: out.handedness[0][0].score, region: r.region, wrist: { x: w.x, y: w.y }, F: r.F, u: r.u });
  const want = { x: w.x + (r.u.x * PALM_ALONG - r.u.y * PALM_ACROSS) * S / A, y: w.y + (r.u.y * PALM_ALONG + r.u.x * PALM_ACROSS) * S };
  assert.ok(near(fit.palm.x, want.x, 1e-9) && near(fit.palm.y, want.y, 1e-9), `palm ${fit.palm.x},${fit.palm.y} against ${want.x},${want.y}`);
  assert.ok(near(fit.a, PALM_ALONG * S / r.F, 1e-9), 'along the forearm, in forearm lengths'); assert.ok(near(fit.c, PALM_ACROSS * S / r.F, 1e-9));
  assert.equal(fit.grip, 'open'); assert.ok(fit.conf > 0.8);
  /* the wrist the hand model finds is the tracker's, to the pixel; the offset from the wrist rebuilds the palm */
  const back = palmFrom({ x: w.x, y: w.y }, lm[L.L_ELBOW], { a: fit.a, c: fit.c });
  assert.ok(near(back.x, want.x, 1e-9) && near(back.y, want.y, 1e-9));
  /* the video is mirrored: toTracker flips x only */
  assert.deepEqual(toTracker({ x: 0.25, y: 0.5, z: 1 }), { x: 0.75, y: 0.5, z: 1 });
});

test('somebody else\'s hand, nothing found, or too few points: nothing is taken', () => {
  const lm = figure(0.4, 0.6, 0.1), r = handRegion(lm, 0, VW, VH), w = lm[L.L_WRIST], S = 0.5 * r.F;
  const hand = handInCrop({ grip: 'open', wrist: { x: w.x + 1.2 * r.F / A, y: w.y }, u: r.u, S, region: r.region, vw: VW, vh: VH });   /* a hand 1.2 forearms away */
  assert.equal(fitHand({ hand, score: 0.9, region: r.region, wrist: { x: w.x, y: w.y }, F: r.F, u: r.u }), null);
  assert.equal(fitHand({ hand: null, score: 0.9, region: r.region, wrist: w, F: r.F, u: r.u }), null);
  assert.equal(fitHand({ hand: hand.slice(0, 10), score: 0.9, region: r.region, wrist: w, F: r.F, u: r.u }), null);
});

/* ---------- the classifier ---------- */
const rot = (pts, a, s = 1) => pts.map(([x, y]) => ({ x: (x * Math.cos(a) - y * Math.sin(a)) * s + 0.5, y: (x * Math.sin(a) + y * Math.cos(a)) * s + 0.5, z: 0 }));
test('open, closed or pointing, from the fingertips\' distance from the palm in hand sizes - whichever way the hand is turned, and however big', () => {
  for (const [grip, want] of [['open', 'open'], ['closed', 'closed'], ['point', 'point'], ['half', null]]){
    for (const [a, s] of [[0, 0.1], [1.1, 0.25], [-2.3, 0.05], [3.0, 0.4]]){
      const sh = handShape(rot(handPoints(grip), a, s));
      assert.equal(sh.grip, want, `${grip} turned ${a} at ${s}`);
      assert.ok(near(sh.size, s, 1e-9), 'the hand\'s size is wrist to middle knuckle');
    }
  }
  const sh = handShape(rot(handPoints('open'), 0, 1));
  assert.ok(near(sh.palm.x - 0.5, PALM_ALONG, 1e-6) && Math.abs(sh.palm.y - 0.5) < 0.02, 'the palm centre: the mean of the wrist and the knuckles');
  assert.ok(sh.ext.every(x => x > 0.8)); assert.ok(handShape(rot(handPoints('closed'), 0, 1)).ext.every(x => x < 0.6));
  assert.equal(handShape(null), null); assert.equal(handShape([]), null);
  assert.equal(handShape(Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))), null, 'no size: nothing');
});

/* ---------- the budget ---------- */
test('the budget: none while looks are skipped or until timed, at most two, and the full look, the zoom\'s crops and these stay under the same limit as the zoom\'s', () => {
  assert.equal(HAND_MAX_CROPS, 2);
  assert.equal(handBudget({ skip: 2, fullMs: 5, handMs: 5 }), 0, 'looks already skipped');
  assert.equal(handBudget({ fullMs: 0, handMs: 5 }), 0, 'nothing timed yet: no guessing');
  assert.equal(handBudget({ fullMs: 8, handMs: 3 }), 2, 'plenty of room: two at most');
  assert.equal(handBudget({ fullMs: 8, handMs: 0 }), 2, 'untimed hand crops count as a full look: 8 + 8 + 8 = 24');
  assert.equal(handBudget({ fullMs: 12, handMs: 0 }), 1);
  assert.equal(handBudget({ fullMs: 8, spentMs: 8, handMs: 8 }), 1, 'zoom already spent some');
  assert.equal(handBudget({ fullMs: 20, handMs: 6 }), 0, 'no room left under ZOOM_MAX_MS');
  assert.equal(handBudget({ fullMs: 8, handMs: 40 }), 0, 'a slow hand model is not asked');
  assert.ok(ZOOM_MAX_MS < SLOW_MS);
});
test('round robin: hands that move or are near a target first, otherwise the one waiting longest, so every hand gets its turn', () => {
  const hand = (key, extra = {}) => ({ key, speed: 0, nearTarget: false, last: -Infinity, ...extra });
  const all = Array.from({ length: 8 }, (_, i) => hand(i));
  /* nothing moving: two a look, the stalest, and everybody within four looks */
  const seen = new Set(); let now = 1000; const lastOf = new Map(all.map(h => [h.key, -Infinity]));
  for (let look = 0; look < 4; look++){
    const picks = pickHands(all.map(h => ({ ...h, last: lastOf.get(h.key) })), { now, max: 2 });
    assert.equal(picks.length, 2);
    for (const p of picks){ assert.ok(!seen.has(p.key), 'nobody twice before everybody once'); seen.add(p.key); lastOf.set(p.key, now); }
    now += 33;
  }
  assert.equal(seen.size, 8);
  /* a moving hand and a hand near a target go ahead of still ones, however long those have waited */
  const mix = [hand(0, { last: 100 }), hand(1, { speed: 0.8, last: 900 }), hand(2, { nearTarget: true, last: 950 }), hand(3, { last: 50 })];
  assert.deepEqual(pickHands(mix, { now: 1000, max: 2 }).map(h => h.key), [1, 2]);
  /* ...but a still hand not looked at for STALE_MS counts as waiting too */
  const stale = [hand(0, { last: 1000 }), hand(1, { speed: 0.8, last: 5000 }), hand(2, { last: 1000 - STALE_MS - 10 })];
  assert.equal(pickHands(stale, { now: 6500, max: 3 })[0].key, 2, 'stalest first within the tier');
  assert.equal(pickHands(mix, { now: 1000, max: 0 }).length, 0); assert.equal(pickHands([], { now: 0 }).length, 0);
  /* a moving pair: they alternate by waiting time */
  const mv = [hand(0, { speed: 1 }), hand(1, { speed: 1 }), hand(2, { speed: 1 })];
  const lastMv = [0, 0, 0]; const order = [];
  for (let look = 0; look < 6; look++){ const p = pickHands(mv.map((h, i) => ({ ...h, last: lastMv[i] })), { now: look * 33, max: 1 })[0]; order.push(p.key); lastMv[p.key] = look * 33 + 1; }
  assert.deepEqual(order, [0, 1, 2, 0, 1, 2]);
});

/* ---------- the carried palm: easing, holding, fading ---------- */
test('easing: the shown palm never jumps to a new run; it holds for HOLD_MS, then fades back to the wrist', () => {
  const f = newFit();
  assert.equal(takeRun(f, { a: 0.3, c: 0.05, grip: 'open', conf: 0.9 }, 0), true);
  assert.deepEqual(ease(f, 0, 0), { a: 0.3, c: 0.05 }, 'the first run is shown whole');
  /* a second run says the palm is further on: the target moves only part way, the shown offset follows, step by step */
  takeRun(f, { a: 0.5, c: 0.05, grip: 'open', conf: 0.9 }, 100);
  assert.ok(f.a > 0.3 && f.a < 0.5, 'the target moves part of the way: ' + f.a);
  let last = f.sa; const steps = [];
  for (let t = 100; t < 600; t += 33){ const s = ease(f, t, 0.033); steps.push(s.a - last); last = s.a; }
  assert.ok(steps.every(d => d >= 0 && d < 0.1), 'small steps toward the target: ' + steps.map(x => x.toFixed(3)));
  assert.ok(near(last, f.a, 0.01), 'and arrives');
  assert.equal(ease(f, 700, 0).a, last, 'no time passing, no movement (drawing between looks)');
  /* between runs the offset is carried; much later it fades to the wrist */
  assert.equal(holdWeight(f, 100 + HOLD_MS - 1), 1); assert.equal(holdWeight(f, 100 + HOLD_MS + FADE_MS), 0); assert.ok(holdWeight(f, 100 + HOLD_MS + FADE_MS / 2) > 0.4);
  for (let t = 100 + HOLD_MS; t < 100 + HOLD_MS + 4 * FADE_MS; t += 33) ease(f, t, 0.033);
  assert.ok(Math.abs(ease(f, 5000, 0).a) < 0.01, 'back at the wrist');
  assert.equal(gripNow(f, 100 + HOLD_MS - 1), 'open'); assert.equal(gripNow(f, 100 + HOLD_MS + 1), null, 'a grip not seen for a while is not claimed');
  /* a doubtful run changes nothing */
  const g = newFit(); assert.equal(takeRun(g, { a: 1, c: 0, grip: 'point', conf: MIN_CONF - 0.01 }, 0), false); assert.equal(g.runs, 0); assert.equal(takeRun(g, null, 0), false);
  assert.equal(holdWeight(g, 0), 0); assert.equal(gripNow(g, 0), null);
  /* the palm turns with the forearm: a hand held out sideways has its palm out sideways */
  const w = { x: 0.5, y: 0.5, v: 1 }, up = palmFrom(w, { x: 0.5, y: 0.6, v: 1 }, { a: 0.5, c: 0 }), side = palmFrom(w, { x: 0.5 - 0.1 / A, y: 0.5, v: 1 }, { a: 0.5, c: 0 });
  assert.ok(up.y < 0.5 && near(up.x, 0.5, 1e-12)); assert.ok(side.x > 0.5 && near(side.y, 0.5, 1e-12));
  assert.equal(palmFrom(w, { x: 0.5, y: 0.6, v: 0.1 }, { a: 1, c: 0 }), null, 'no elbow: no palm');
});

/* ---------- in the tracker ---------- */
function reset(){
  rig.resetPose(pose); pose.cap = 4; pose.clock = () => 10000;
  Object.assign(pose, { skip: 1, worker: null, hander: null, handMs: 0, fullMs2: 0, handRuns: 0, _handsDead: false, _handsOffUntil: 0, _handsFails: 0, handTargets: null });
}
function world(seed = 1, palm = PALM, n = 90){
  reset();
  rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
  const w = rig.makeWorld('2x', seed, { jitter: 0.0018, palm }), f = new rig.Feeder(pose, lib, { assist: true, cap: 4, truth: true, hander: palmHander });
  for (let i = 0; i < n; i++){ w.step(1 / 30, null, null); f.step(w, 1 / 30); }
  return { w, f };
}
const handsOf = () => pose.players.filter(p => p.present).flatMap(p => [p.hands.left, p.hands.right]);

test('on: the hand is where its palm is, with a grip and a confidence; at most two hand-model runs a look; the hit-test point is the palm', () => {
  on('hands');
  const { w, f } = world();
  const before = pose.handRuns;
  for (let i = 0; i < 60; i++){ w.step(1 / 30, null, null); f.step(w, 1 / 30); }
  assert.equal(pose.handRuns - before, 120, 'two runs a look: 60 looks');
  /* the palm is a palm's length beyond the wrist the tracker reports: where the rig's hands really are */
  const p = pose.players[0], truth = w.persons.find(q => q.slot === 0);
  const wrist = p.lm[L.L_WRIST], d = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y);
  assert.ok(d(p.hands.left, truth.L) < 0.01, 'on the real hand: ' + d(p.hands.left, truth.L));
  assert.ok(d(wrist, truth.L) > 0.015, 'the wrist is short of it: ' + d(wrist, truth.L));
  assert.ok(['open', 'closed', 'point'].includes(p.hands.left.grip), 'grip ' + p.hands.left.grip); assert.ok(p.hands.left.palmConf > 0.5);
  assert.ok(handsOf().every(h => h.grip === null || ['open', 'closed', 'point'].includes(h.grip)));
  /* the cursor hand (hit tests) reads the same object */
  assert.equal(pose.cursorHand(p).x, (pose.cursorHand(p) === p.hands.left ? p.hands.left : p.hands.right).x);
  off();
});
test('off: byte-identical (no fields added, same numbers) even with a hand model offered', () => {
  const once = (hander) => {
    off(); reset();
    rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
    const w = rig.makeWorld('2x', 4, { jitter: 0.0018 }), fd = new rig.Feeder(pose, lib, { assist: true, cap: 4, hander });
    const out = [];
    for (let i = 0; i < 240; i++){ w.step(1 / 30, null, null); fd.step(w, 1 / 30); if (i % 6 === 0) out.push(JSON.stringify(pose.players.map(q => [q.present, q.hands, q.lm && q.lm.map(k => [k.x, k.y])]))); }
    return out.join('|');
  };
  const plain = once(null), offered = once(() => { throw new Error('asked for a hand model with the switch off'); });
  assert.equal(offered, plain);
  assert.ok(!/grip|palmConf/.test(plain), 'no new fields while off');
});
test('turning it off again takes the new fields away and puts the hand back on the wrist', () => {
  on('hands'); const { w, f } = world();
  assert.ok(pose.players[0].hands.left.grip !== undefined);
  off();
  for (let i = 0; i < 5; i++){ w.step(1 / 30, null, null); f.step(w, 1 / 30); }
  const p = pose.players[0];
  assert.equal(p.hands.left.grip, undefined); assert.equal(p.hands.left.palmConf, undefined);
  assert.ok(near(p.hands.left.x, p.lm[L.L_WRIST].x, 1e-12));
});
test('the hand model is asked for the right crops: wrists in the picture, 2 at most, none while looks are skipped, none in the worker, round robin', () => {
  on('hands'); const { w, f } = world(2, PALM, 60);
  const calls = []; const real = pose.hander; pose.hander = { detect(v, r){ calls.push(r); return real.detect(v, r); } };
  const V = { videoWidth: VW, videoHeight: VH };
  for (let i = 0; i < 4; i++){ calls.length = 0; pose.handMs = 0; assert.ok(pose._hands(V, 8, 20000 + i * 33, 0) >= 0); assert.ok(calls.length <= 2 && calls.length > 0, 'at most two: ' + calls.length); }
  /* skipping */
  calls.length = 0; pose.skip = 2; pose._hands(V, 8, 21000, 0); assert.equal(calls.length, 0, 'looks are being skipped'); pose.skip = 1;
  /* the worker */
  pose.worker = {}; pose._hands(V, 8, 21000, 0); assert.equal(calls.length, 0, 'worker mode'); assert.equal(pose.trackInfo().hands, 'off (worker)'); pose.worker = null;
  /* no room: a slow full look */
  pose.fullMs2 = 30; pose._hands(V, 30, 21000, 0); assert.equal(calls.length, 0, 'the full look took all the time there is');
  /* four hands in turn (two players): everyone visited within two looks */
  pose.handMs = 0; pose.fullMs2 = 8; calls.length = 0; const ids = new Set();
  for (let i = 0; i < 2; i++){ pose.clock = () => 30000 + i * 33; const two = pose.players.slice(0, 2), before = two.map(p => p.palm && p.palm.map(x => x.runs)); pose._hands(V, 8, 30000 + i * 33, 0); const after = two.map(p => p.palm.map(x => x.runs)); after.forEach((a, pi) => a.forEach((t, s) => { if (!before[pi] || t !== before[pi][s]) ids.add(pi * 2 + s); })); }
  assert.ok(ids.size >= 4, 'every hand was run within two looks: ' + [...ids]);
  off();
});
test('hands near a target are looked at first (a game can say where its targets are)', () => {
  on('hands'); const { w, f } = world(3, PALM, 60);
  const calls = []; const real = pose.hander; pose.hander = { detect(v, r){ calls.push(r); return real.detect(v, r); } };
  const w1 = pose.players[1].lm[L.R_WRIST];
  pose.handTargets = () => [{ x: w1.x, y: w1.y, r: 0.02 }];
  const V = { videoWidth: VW, videoHeight: VH };
  pose.handMs = 0; calls.length = 0; pose._hands(V, 8, 40000, 0);
  const r = calls[0], vx = 1 - w1.x;
  assert.ok(vx >= r.x0 && vx <= r.x0 + r.w && w1.y >= r.y0 && w1.y <= r.y0 + r.h, 'the first crop is the hand near the target');
  pose.handTargets = () => { throw new Error('a game\'s mistake'); };
  assert.doesNotThrow(() => pose._hands(V, 8, 40100, 0));
  off();
});
test('fail safe: a hand model that throws, answers nothing, or answers another person\'s hand leaves the hands as they were', () => {
  on('hands'); const { w, f } = world(1, PALM, 60);
  const snap = () => JSON.stringify(handsOf().map(h => [h.x, h.y, h.grip]));
  pose.handMs = 0;
  const V = { videoWidth: VW, videoHeight: VH }, hold = snap();
  pose.hander = { detect(){ return { landmarks: [] }; } }; pose._hands(V, 8, 50000, 0); assert.equal(snap(), hold, 'nothing found');
  pose.hander = { detect(){ return null; } }; pose._hands(V, 8, 50033, 0); assert.equal(snap(), hold, 'null');
  pose.hander = { detect(v, r){ return { landmarks: [handInCrop({ grip: 'open', wrist: { x: 0.05, y: 0.05 }, u: { x: 0, y: 1 }, S: 0.03, region: r, vw: VW, vh: VH })], handedness: [[{ score: 0.9 }]] }; } };
  pose._hands(V, 8, 50066, 0); assert.equal(snap(), hold, 'a hand somewhere else');
  pose.hander = { detect(){ throw new Error('boom'); } };
  assert.throws(() => pose._hands(V, 8, 50100, 0));
  /* `_update` catches it; three in a row and the hand model is left alone for 30 s */
  pose._handsFailed(60000); pose._handsFailed(60000); assert.equal(pose._handsOffUntil, 0); pose._handsFailed(60000);
  assert.equal(pose._handsOffUntil, 90000);
  const calls = []; pose.hander = { detect(){ calls.push(1); return { landmarks: [] }; } };
  pose._hands(V, 8, 70000, 0); assert.equal(calls.length, 0, 'left alone');
  pose._hands(V, 8, 91000, 0); assert.ok(calls.length > 0, 'and tried again later');
  pose._handsDead = true; calls.length = 0; pose._hands(V, 8, 100000, 0); assert.equal(calls.length, 0); assert.equal(pose.trackInfo().hands, 'unavailable');
  off();
});
test('a full look through _update with a hand model that throws: the players are still tracked', () => {
  on('hands'); reset();
  const lm = figure(0.5, 0.6, 0.1).map(k => ({ ...k, x: 1 - k.x, visibility: k.v }));
  let t = 0;
  Object.assign(pose, { mouse: { ...pose.mouse, active: false }, ready: true, on: true, paused: false, lm: { detectForVideo: () => ({ landmarks: [lm] }) }, hander: { detect(){ throw new Error('boom'); } },
    video: { readyState: 4, get currentTime(){ return t; }, videoWidth: VW, videoHeight: VH, srcObject: null } });
  pose._lastT = undefined; pose._since = 0;
  for (let i = 0; i < 40; i++){ t += 1 / 30; pose._update(i * 33, 1 / 30); }
  assert.ok(pose.players[0].present, 'tracked');
  assert.ok(pose._handsFails >= 0);
  Object.assign(pose, { ready: false, on: false, lm: null, video: null, hander: null }); off();
});
test('the readout: the grip and how sure, per hand', () => {
  on('hands'); const { w, f } = world();
  const row = pose.trackInfo().rows[0];
  assert.equal(row.hands.length, 2);
  assert.ok(row.hands[0] && ['open', 'closed', 'point'].includes(row.hands[0].grip) && row.hands[0].conf > 0.5);
  assert.equal(pose.trackInfo().hands, 'on');
  off(); assert.equal(pose.trackInfo().rows[0].hands, null);
});
test('the rig: a hand a palm\'s length beyond the wrist is far closer to the real hand with Exact hands on, held out and swung', () => {
  const err = (sw, swing) => {
    sw(); const { w, f } = world(5, PALM, 45);
    const brain = swing ? { act(ctx, p, now){ const up = Math.floor(now / 0.5 + (p.idx ? 0.5 : 0)) % 2, J = p.J, R = p.armLen * p.k; p.L.goal(J.lSh.x - 0.07, J.shY + (up ? -R * 0.8 : R * 0.8), now); p.R.goal(J.rSh.x + 0.07, J.shY + (up ? R * 0.8 : -R * 0.8), now); } }
      : { act(ctx, p){ const J = p.J, R = p.armLen * p.k; p.L.goal(J.lSh.x - 0.1, J.shY - R * 0.3, 0); p.R.goal(J.rSh.x + 0.1, J.shY - R * 0.3, 0); } };
    f.err = { n: 0, sum2: 0, max: 0, lostN: 0, lostSum2: 0, big: 0 };
    for (let i = 0; i < 300; i++){ w.step(1 / 30, brain, {}); f.step(w, 1 / 30); }
    return Math.sqrt(f.err.sum2 / f.err.n);
  };
  const still = [err(off, false), err(() => on('hands'), false)], swing = [err(off, true), err(() => on('hands'), true)];
  assert.ok(still[1] < still[0] * 0.8, `held out: ${still[0]} -> ${still[1]}`);
  assert.ok(swing[1] <= swing[0] * 1.02, `swung: ${swing[0]} -> ${swing[1]}`);
  off();
});

test('the classifier on what the real hand model gave (five public sample pictures, run in headless Chromium): open, closed, point, and "unclear" for two fingers', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/real-hands.json', import.meta.url), 'utf8'));
  let n = 0;
  for (const [name, pic] of Object.entries(fx.pictures)){
    pic.hands.forEach((h, i) => {
      const sh = handShape(h.map(([x, y]) => ({ x: x * pic.size[0], y: y * pic.size[1] })));      /* (the picture is not square: pixels, so isotropic) */
      assert.equal(sh.grip, fx.expect[name][i], `${name} #${i}: ${sh.ext.map(x => x.toFixed(2))}`); n++;
    });
  }
  assert.equal(n, 6);
});
