import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L, mergeZoomed, onePerPerson, sizeOf } from '../src/tracking/pose.js';
import { squareRegion, mapFromCrop, mapToCrop, mapLandmarksFromCrop, pickTargets, ZOOM_BODY, BODY_PER_TORSO } from '../src/tracking/zoom.js';
import { zoomBudget, ZOOM_MAX_MS, MAX_CROPS, SLOW_MS } from '../src/tracking/budget.js';
import { figure } from './harness/synth-frames.mjs';

const VW = 640, VH = 360;
const raw = (lm) => lm.map(k => ({ ...k, x: 1 - k.x, visibility: k.v }));      /* what the tracker answers (not mirrored) */
const vis = (lm, v) => lm.map(k => ({ ...k, v }));
function reset(){
  pose.mouse.active = false;
  pose.players.forEach((p) => {
    Object.assign(p, { present: false, lostFor: 99, watching: 0, at: null, lm: null, raw: null, filt: null, seg: null, head: null, app: null, goneAt: null, zoomAt: 0,
      hands: { left: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 }, right: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 } }, centre: { x: .5, y: .5 }, scale: .3 });
  });
  pose._cands = []; pose.personCount = 0; pose.seenCount = 0; pose.cap = 4;
  Object.assign(pose, { skip: 1, zoomer: null, worker: null, fullMs: 0, cropMs: 0, _zn: 0, _zoomInfo: null, _zoomOffUntil: 0, _zoomFails: 0, _zoomDead: false });
  pose.zoomOn = () => true; pose.clock = () => 10000;
}
const player = (slot, x, y, size, extra = {}) => Object.assign(pose.players[slot], { present: true, lostFor: 0, at: { x, y, vx: 0, vy: 0, size } }, extra);

test('crop regions are square in pixels, padded around the body, whole pixels, and stay inside the picture', () => {
  const r = squareRegion(0.5, 0.5, 0.6, VW, VH);
  assert.equal(r.px.size, Math.round(0.6 * VH));
  assert.ok(Math.abs(r.w * VW - r.h * VH) < 1e-9, 'square in pixels');
  assert.ok(Math.abs(r.x0 + r.w / 2 - 0.5) < 1 / VW && Math.abs(r.y0 + r.h / 2 - 0.5) < 1 / VH, 'centred');
  assert.ok(Number.isInteger(r.px.x) && Number.isInteger(r.px.y));
  /* at the edges the square slides in, it doesn't shrink or leave the picture */
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.02, 0.5], [0.5, 0.99]]){
    const e = squareRegion(cx, cy, 0.6, VW, VH);
    assert.equal(e.px.size, r.px.size, 'same size at the edge');
    assert.ok(e.x0 >= 0 && e.y0 >= 0 && e.x0 + e.w <= 1 + 1e-12 && e.y0 + e.h <= 1 + 1e-12, `inside at ${cx},${cy}`);
  }
  assert.equal(squareRegion(0, 0, 0.6, VW, VH).x0, 0); assert.equal(squareRegion(1, 1, 0.6, VW, VH).px.x + r.px.size, VW);
  /* asked for more than the picture has: the whole height, square */
  const big = squareRegion(0.5, 0.5, 3, VW, VH);
  assert.equal(big.px.size, VH); assert.equal(big.y0, 0); assert.ok(big.x0 > 0 && big.x0 + big.w < 1);
  assert.equal(squareRegion(0.5, 0.5, 0.5, 300, 600).px.size, 300, 'a tall picture: no wider than it is');
});

test('landmarks map from the crop to the picture and back exactly', () => {
  const r = squareRegion(0.83, 0.41, 0.55, VW, VH);
  let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 200; i++){
    const k = { x: rnd(), y: rnd(), z: rnd() - 0.5, visibility: rnd() }, back = mapToCrop(mapFromCrop(k, r), r);
    assert.ok(Math.abs(back.x - k.x) < 1e-12 && Math.abs(back.y - k.y) < 1e-12);
    assert.equal(back.z, k.z); assert.equal(back.visibility, k.visibility);
    const f = mapFromCrop(k, r);
    assert.ok(f.x >= r.x0 - 1e-12 && f.x <= r.x0 + r.w + 1e-12);
  }
  assert.deepEqual(mapFromCrop({ x: 0, y: 0 }, r), { x: r.x0, y: r.y0 });
  assert.ok(Math.abs(mapFromCrop({ x: 1, y: 1 }, r).x - (r.x0 + r.w)) < 1e-15);
  /* a body found in the crop lands where the full-frame body is: crop it, "detect" it, map it back */
  const body = raw(figure(0.7, 0.55, 0.06)), inCrop = body.map(k => mapToCrop(k, r));
  mapLandmarksFromCrop(inCrop, r).forEach((k, i) => { assert.ok(Math.abs(k.x - body[i].x) < 1e-12 && Math.abs(k.y - body[i].y) < 1e-12); });
});

test('who is looked at: the small, and the one just gone missing; nobody when everyone is big enough', () => {
  reset();
  const big = { x: 0.3, y: 0.62, size: 0.2 }, kid = { x: 0.7, y: 0.6, size: 0.09 };       /* body 0.27 of the picture's height */
  assert.ok(kid.size * BODY_PER_TORSO < ZOOM_BODY);
  player(0, big.x, big.y, big.size); player(1, kid.x, kid.y, kid.size);
  const t = pickTargets(pose.players, [big, kid], { vw: VW, vh: VH, now: 10000 });
  assert.deepEqual(t.map(x => [x.slot, x.kind]), [[1, 'small']]);
  const reg = t[0].region;      /* the video is not mirrored: the child at x 0.7 is at 0.3 in the camera's picture */
  assert.ok(0.3 > reg.x0 && 0.3 < reg.x0 + reg.w && 0.6 > reg.y0 && 0.6 < reg.y0 + reg.h);
  assert.ok(reg.h * VH >= 0.4 * VH - 1, 'not smaller than the minimum');
  /* everyone big: nothing */
  reset(); player(0, 0.3, 0.62, 0.2); player(1, 0.7, 0.62, 0.19);
  assert.deepEqual(pickTargets(pose.players, [{ x: 0.3, y: 0.62, size: 0.2 }, { x: 0.7, y: 0.62, size: 0.19 }], { vw: VW, vh: VH, now: 10000 }), []);
  /* a big player not in the full-frame look (gone for 0.3 s): looked for where they were heading, even though they are big */
  reset(); player(0, 0.3, 0.62, 0.2); player(1, 0.7, 0.62, 0.19, { lostFor: 0.3 });
  const m = pickTargets(pose.players, [{ x: 0.3, y: 0.62, size: 0.2 }], { vw: VW, vh: VH, now: 10000 });
  assert.deepEqual(m.map(x => [x.slot, x.kind]), [[1, 'missing']]);
  assert.ok(0.3 > m[0].region.x0 && 0.3 < m[0].region.x0 + m[0].region.w, 'at where they were (the video is not mirrored)');
  /* gone (not a player any more) less than a second ago: still looked for; after that, not */
  reset(); player(0, 0.3, 0.62, 0.2); player(1, 0.7, 0.62, 0.19, { present: false, goneAt: 9500 });
  assert.equal(pickTargets(pose.players, [{ x: 0.3, y: 0.62, size: 0.2 }], { vw: VW, vh: VH, now: 10000 }).length, 1);
  pose.players[1].goneAt = 8500;
  assert.equal(pickTargets(pose.players, [{ x: 0.3, y: 0.62, size: 0.2 }], { vw: VW, vh: VH, now: 10000 }).length, 0);
  /* small relative to the biggest in view (torso under STAY_CLOSE of it, 'with a margin'), though not tiny in the picture */
  reset(); player(0, 0.3, 0.62, 0.3); player(1, 0.7, 0.62, 0.12);
  assert.deepEqual(pickTargets(pose.players, [{ x: 0.3, y: 0.62, size: 0.3 }, { x: 0.7, y: 0.62, size: 0.12 }], { vw: VW, vh: VH, now: 10000 }).map(x => x.slot), [1]);
});
test('at most two crops, the missing first, the longest-unlooked next, and one crop for two players close together', () => {
  reset();
  const dets = [];
  [[0, 0.1], [1, 0.4], [2, 0.7], [3, 0.95]].forEach(([i, x]) => { player(i, x, 0.6, 0.08); dets.push({ x, y: 0.6, size: 0.08 }); });
  pose.players[0].zoomAt = 5; pose.players[2].zoomAt = 1; pose.players[3].zoomAt = 3; pose.players[1].zoomAt = 9;
  const t = pickTargets(pose.players, dets, { vw: VW, vh: VH, now: 10000 });
  assert.equal(t.length, MAX_CROPS); assert.deepEqual(t.map(x => x.slot), [2, 3]);
  assert.equal(pickTargets(pose.players, dets, { vw: VW, vh: VH, now: 10000, max: 1 }).length, 1);
  /* two small players side by side: one square holds both */
  reset(); player(0, 0.5, 0.6, 0.08); player(1, 0.56, 0.6, 0.08);
  assert.equal(pickTargets(pose.players, [{ x: 0.5, y: 0.6, size: 0.08 }, { x: 0.56, y: 0.6, size: 0.08 }], { vw: VW, vh: VH, now: 10000 }).length, 1);
});

test('the budget: none while looks are skipped or slow, none until timed, two at most', () => {
  assert.equal(zoomBudget({ skip: 2, fullMs: 5, cropMs: 5 }), 0, 'looks already skipped');
  assert.equal(zoomBudget({ skip: 1 }), 0, 'nothing timed');
  assert.equal(zoomBudget({ skip: 1, fullMs: 8 }), 2, 'a crop costs what a full look does');
  assert.equal(zoomBudget({ skip: 1, fullMs: 8, cropMs: 12 }), 1);
  assert.equal(zoomBudget({ skip: 1, fullMs: 14, cropMs: 12 }), 0, 'would run past the limit');
  assert.equal(zoomBudget({ skip: 1, fullMs: 2, cropMs: 1 }), MAX_CROPS);
  assert.ok(ZOOM_MAX_MS < SLOW_MS, 'zoom stays under where the pace backs off');
  for (let full = 1; full < 40; full += 3) for (let crop = 1; crop < 30; crop += 4){
    const n = zoomBudget({ skip: 1, fullMs: full, cropMs: crop });
    assert.ok(n === 0 || full + n * crop <= ZOOM_MAX_MS, `${full} + ${n} x ${crop}`);
  }
});

test('merging: a body the full frame missed is added; a clearer crop replaces a weaker twin; no one twice', () => {
  const adult = raw(figure(0.3, 0.62, 0.15)), kidTruth = raw(figure(0.7, 0.6, 0.05));
  const target = (lm) => { const hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2; return { slot: 1, expect: sizeOf(lm), region: squareRegion(hx, hy, 0.4, VW, VH) }; };
  const crop = (lm, v = 0.97) => ({ lm: lm.map(k => ({ ...k, visibility: v })), target: target(lm) });
  /* missed: added */
  let m = mergeZoomed([adult], [crop(kidTruth)]);
  assert.equal(m.length, 2);
  /* weak in the full frame, clear in the crop: the crop's replaces it, one entry */
  const weak = vis(kidTruth.map(k => ({ ...k, x: k.x + 0.004 })), 0.4).map(k => ({ ...k, visibility: k.v }));
  m = mergeZoomed([adult, weak], [crop(kidTruth)]);
  assert.equal(m.length, 2); assert.ok(m.some(lm => lm[0].visibility > 0.9 && Math.abs(lm[0].x - kidTruth[0].x) < 1e-9), 'the clearer one stays');
  assert.ok(!m.includes(weak));
  /* clear in the full frame, weaker in the crop: the full-frame body stays */
  const clear = kidTruth.map(k => ({ ...k, visibility: 0.99 }));
  m = mergeZoomed([adult, clear], [crop(kidTruth, 0.6)]);
  assert.equal(m.length, 2); assert.ok(m.includes(clear));
  /* the same person found in two crops: once */
  m = mergeZoomed([adult], [crop(kidTruth), crop(kidTruth.map(k => ({ ...k, x: k.x + 0.002 })))]);
  assert.equal(m.length, 2);
  assert.equal(onePerPerson(m).length, 2);
  /* something that isn't who the crop was for (twice the size; or outside the square) is not taken */
  assert.equal(mergeZoomed([adult], [{ lm: adult, target: target(kidTruth) }]).length, 1, 'a grown-up found in the child\'s crop is the grown-up, already there');
  assert.equal(mergeZoomed([adult], [{ lm: raw(figure(0.2, 0.9, 0.05)), target: target(kidTruth) }]).length, 1, 'outside the square');
  assert.equal(mergeZoomed([adult], []).length, 1);
});

/* the whole path through _update, with a fake video, a fake full-frame tracker and a fake closer-look detector */
function rig({ fullBodies, found, onDetect }){
  reset();
  const calls = [];
  const video = { readyState: 4, currentTime: 0, videoWidth: VW, videoHeight: VH, srcObject: null };
  pose.video = video; pose.ready = true; pose.on = true; pose.paused = false; pose._lastT = undefined; pose._frameAt = 0;
  pose.lm = { detectForVideo: () => ({ landmarks: fullBodies().map(raw) }) };
  pose.zoomer = { detect(v, region){ calls.push(region); if (onDetect) onDetect(region); return { landmarks: found(region).map(lm => lm.map(k => mapToCrop(k, region))) }; } };
  let clock = 0;
  const frame = () => { video.currentTime += 1 / 30; clock += 33; pose._update(clock, 1 / 30); };
  return { calls, frame, video };
}
const adultLm = () => figure(0.3, 0.62, 0.15), kidLm = (x = 0.7) => figure(x, 0.6, 0.075);

test('a child the full frame lost is found by the closer look, mapped back, and tracked as before', () => {
  let kidSeen = true;
  const r = rig({ fullBodies: () => kidSeen ? [adultLm(), kidLm()] : [adultLm()], found: () => [raw(kidLm())] });
  r.frame(); r.frame();                                  /* timed: the first looks only measure */
  /* the kid joins: standing still a moment, seen in the full frame */
  pose.zoomOn = () => false;
  for (let i = 0; i < 40; i++) r.frame();
  pose.zoomOn = () => true;
  assert.equal(pose.personCount, 2, 'both in the game');
  assert.equal(r.calls.length, 0, 'no zoom while the switch was off');
  /* the full frame loses the child: the closer look finds them in the same place, so they never drop out */
  kidSeen = false; pose.fullMs = 8; pose.cropMs = 8;
  for (let i = 0; i < 20; i++) r.frame();
  assert.ok(r.calls.length > 0, 'looked');
  assert.ok(r.calls.length <= 2 * 20, 'at most two a look');
  assert.equal(pose.personCount, 2); assert.ok(pose.players.every(p => !p.present || p.lostFor < 0.2), 'nobody lost');
  const kid = pose.players.find(p => p.present && p.at.x > 0.5);
  assert.ok(kid && Math.abs(kid.at.x - 0.7) < 0.01, 'the child is where the crop put them (the full-frame coordinates)');
  assert.ok(pose.trackInfo().rows.some(row => row.zoom), 'the readout says the zoom looked at them');
});
test('no zoom while looks are being skipped, none when everyone is big, and no more than two crops', () => {
  const r = rig({ fullBodies: () => [adultLm(), kidLm()], found: () => [] });
  pose.zoomOn = () => false;
  for (let i = 0; i < 40; i++) r.frame();
  pose.zoomOn = () => true;
  const res = { landmarks: [adultLm(), kidLm()].map(raw) }, v = pose.video;
  pose.fullMs = 8; pose.cropMs = 8; pose._zn = 1;     /* (the next look is one where small players are looked at) */
  pose.skip = 2;
  assert.equal(pose._zoom(v, res, 8, 1000), null, 'looks being skipped: none');
  assert.equal(r.calls.length, 0);
  pose.skip = 1;
  assert.ok(pose._zoom(v, res, 8, 1000), 'the same look with nothing skipped: zooms');
  assert.equal(r.calls.length, 1);
  /* everyone big */
  const r2 = rig({ fullBodies: () => [figure(0.3, 0.62, 0.15), figure(0.7, 0.62, 0.14)], found: () => [] });
  for (let i = 0; i < 40; i++) r2.frame();
  pose.fullMs = 8; pose.cropMs = 8;
  for (let i = 0; i < 20; i++) r2.frame();
  assert.equal(r2.calls.length, 0, 'everyone big enough: none');
  /* four small players: still two at most per look */
  const bodies = () => [0.1, 0.35, 0.6, 0.85].map(x => kidLm(x));
  const r3 = rig({ fullBodies: bodies, found: () => [] });
  pose.zoomOn = () => false;
  for (let i = 0; i < 40; i++) r3.frame();
  pose.zoomOn = () => true; pose.fullMs = 5; pose.cropMs = 5; pose._zn = 0;
  assert.equal(pose.personCount, 4);
  let worst = 0;
  for (let i = 0; i < 20; i++){ const before = r3.calls.length; r3.frame(); worst = Math.max(worst, r3.calls.length - before); }
  assert.ok(worst >= 1 && worst <= 2, 'most crops in one look: ' + worst);
});
test('a closer look that throws, or is too slow, leaves the full-frame answer; it stops trying after a few', () => {
  let n = 0;
  const r = rig({ fullBodies: () => [adultLm(), kidLm()], found: () => { n++; throw new Error('detector died'); } });
  pose.zoomOn = () => false;
  for (let i = 0; i < 40; i++) r.frame();
  pose.zoomOn = () => true; pose.fullMs = 5; pose.cropMs = 5;
  for (let i = 0; i < 30; i++) r.frame();
  assert.equal(pose.personCount, 2, 'the same players as without it');
  assert.ok(n >= 3 && n <= 6, 'it tried ' + n + ' times, then rested');
  assert.ok(pose._zoomOffUntil > 0);
});
test('zoom is not used in the worker path, and the readout says so', () => {
  reset(); pose.worker = {};
  assert.equal(pose._zoom({ videoWidth: VW, videoHeight: VH }, { landmarks: [] }, 8, 1000), null);
  assert.equal(pose.trackInfo().zoom, 'off (worker)');
  pose.worker = null;
});
test('the zoom switch off: the full-frame look is used as it is, and nothing is timed or cut', () => {
  const r = rig({ fullBodies: () => [adultLm(), kidLm()], found: () => [raw(kidLm())] });
  pose.zoomOn = () => false; pose.fullMs = 5; pose.cropMs = 5;
  for (let i = 0; i < 40; i++) r.frame();
  assert.equal(r.calls.length, 0);
});
