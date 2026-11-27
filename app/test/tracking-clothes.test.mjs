import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import { sampleSignature, sigDistance, appearanceCost, APPEAR_COST, APPEAR_SLACK, REMEMBER_MS } from '../src/tracking/appearance.js';
import { switchOn, setSwitch } from '../src/tracking/switches.js';
import { blankFrame, figure, drawFigure, dimFrame, SHIRTS } from './harness/synth-frames.mjs';

/* Synthetic frames: coloured figures drawn where the synthetic landmarks are (test/harness/synth-frames.mjs). Players are fed through
   the real pose._assign with the picture as its third argument, as pose.js does when Settings > Testing > Recognise players by clothes
   is on; without the picture it is the tracker as it always was. */

function reset(){
  pose.mouse.active = false;
  pose.players.forEach((p) => {
    Object.assign(p, { present: false, lostFor: 99, watching: 0, at: null, lm: null, raw: null, filt: null, seg: null, head: null, app: null, goneAt: null,
      hands: { left: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 }, right: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 } }, centre: { x: .5, y: .5 }, scale: .3 });
  });
  pose._cands = []; pose.personCount = 0; pose.seenCount = 0; pose.cap = 4;
}
const DT = 1 / 15;
let T = 0;
function clock(){ T = 0; pose.clock = () => T * 1000; }
/* one look: bodies [{ x, shirt }] standing at the same height, with the picture (or none) */
function look(bodies, on, { dim = 1, y = 0.62 } = {}){
  T += DT;
  const lms = bodies.map(b => figure(b.x, b.y ?? y, 0.15));
  let fr = blankFrame();
  bodies.forEach((b, i) => drawFigure(fr, lms[i], { shirt: b.shirt }));
  if (dim !== 1) fr = dimFrame(fr, dim);
  pose._assign(lms, DT, on ? fr : undefined);
}
const slotAt = (x) => pose.players.findIndex(p => p.present && p.at && Math.abs(p.at.x - x) < 0.02);

test('the three tracking switches are off unless turned on, and are kept', () => {
  for (const k of ['appearance', 'zoom', 'info']) assert.equal(switchOn(k), false, k + ' starts off');
  assert.equal(pose.appearanceOn(), false); assert.equal(pose.zoomOn(), false); assert.equal(pose.infoOn(), false);
  setSwitch('appearance', true); assert.equal(pose.appearanceOn(), true);
  setSwitch('appearance', false); assert.equal(pose.appearanceOn(), false);
});

test('a signature tells shirts apart, ignores where the person stands, and survives a 30% darker room', () => {
  const sig = (shirt, x = 0.5, dim = 1) => {
    const lm = figure(x, 0.62, 0.15), fr = blankFrame(); drawFigure(fr, lm, { shirt });
    return sampleSignature(dim === 1 ? fr : dimFrame(fr, dim), lm);
  };
  const red = sig(SHIRTS.red);
  assert.ok(red && Math.abs(red.reduce((a, b) => a + b, 0) - 1) < 1e-4, 'a histogram that sums to one');
  assert.ok(sigDistance(red, sig(SHIRTS.red, 0.3)) < APPEAR_SLACK, 'the same shirt elsewhere in the picture');
  for (const other of ['blue', 'green', 'yellow', 'black', 'white']) assert.ok(sigDistance(red, sig(SHIRTS[other])) > 0.6, 'red against ' + other);
  for (const c of ['red', 'blue', 'green', 'yellow']) assert.ok(sigDistance(sig(SHIRTS[c]), sig(SHIRTS[c], 0.5, 0.7)) < APPEAR_SLACK, c + ' at 70% light');
  assert.equal(appearanceCost(0), 0); assert.equal(appearanceCost(APPEAR_SLACK), 0); assert.ok(Math.abs(appearanceCost(1) - APPEAR_COST) < 1e-9);
  /* can't be read: a corner of the torso not seen, or no picture */
  const lm = figure(0.5, 0.62, 0.15); lm[11].v = 0.2;
  assert.equal(sampleSignature(blankFrame(), lm), null); assert.equal(sampleSignature(null, figure(0.5, 0.62, 0.15)), null);
});

/* Two players stand side by side, then trade places in a single look (the tracker's nearest-hips rule has nothing to go on).
   Without the picture the slots trade; with it, each keeps their own. */
function swapRun(on, a, b, { dim = 1 } = {}){
  reset(); clock();
  for (let f = 0; f < 22; f++) look([{ x: 0.46, shirt: a }, { x: 0.54, shirt: b }], on);
  const sa = slotAt(0.46), sb = slotAt(0.54);
  for (let f = 0; f < 12; f++) look([{ x: 0.54, shirt: a }, { x: 0.46, shirt: b }], on, { dim });   /* (a now on the right) */
  return { sa, sb, a: pose.players[sa], b: pose.players[sb] };
}
test('two players in different shirts trade places: each keeps their own slot', () => {
  const off = swapRun(false, SHIRTS.red, SHIRTS.blue);
  assert.notEqual(off.sa, off.sb);
  assert.ok(Math.abs(off.a.at.x - 0.46) < 0.02, 'without clothes the tracker follows the places (the swap this feature is for)');
  const on = swapRun(true, SHIRTS.red, SHIRTS.blue);
  assert.ok(on.a.present && on.b.present);
  assert.ok(Math.abs(on.a.at.x - 0.54) < 0.02 && Math.abs(on.b.at.x - 0.46) < 0.02, 'with clothes the red player is still the red one');
  assert.equal(pose.personCount, 2);
});
test('a lighting change (the picture 30% darker) does not break the match', () => {
  const on = swapRun(true, SHIRTS.green, SHIRTS.yellow, { dim: 0.7 });
  assert.ok(Math.abs(on.a.at.x - 0.54) < 0.02 && Math.abs(on.b.at.x - 0.46) < 0.02);
  const on2 = swapRun(true, SHIRTS.red, SHIRTS.blue, { dim: 0.7 });
  assert.ok(Math.abs(on2.a.at.x - 0.54) < 0.02 && Math.abs(on2.b.at.x - 0.46) < 0.02);
});
test('players in the same colour: the slots end exactly where they do without clothes', () => {
  const trail = (on) => {
    reset(); clock(); const out = [];
    for (let f = 0; f < 50; f++){
      const x = f < 25 ? 0.46 : f < 35 ? 0.46 + (f - 25) * 0.008 : 0.54, x2 = f < 25 ? 0.54 : f < 35 ? 0.54 - (f - 25) * 0.008 : 0.46;
      look([{ x, shirt: SHIRTS.red }, { x: x2, shirt: SHIRTS.red }], on);
      out.push(pose.players.map(p => p.present ? +p.at.x.toFixed(4) : null).join());
    }
    return out;
  };
  assert.deepEqual(trail(true), trail(false));
});
test('players walking past each other keep their slots, with and without clothes', () => {
  for (const on of [false, true]){
    reset(); clock();
    for (let f = 0; f < 70; f++){
      const u = Math.max(0, f - 20) / 50;
      T += DT;
      const A = figure(0.25 + 0.5 * u, 0.62, 0.15), B = figure(0.75 - 0.5 * u, 0.66, 0.16), fr = blankFrame();
      drawFigure(fr, B, { shirt: SHIRTS.blue }); drawFigure(fr, A, { shirt: SHIRTS.red });
      if (f === 19){ reset.sa = slotAt(0.25); reset.sb = slotAt(0.75); }
      pose._assign([A, B], DT, on ? fr : undefined);
    }
    assert.ok(Math.abs(pose.players[reset.sa].at.x - 0.75) < 0.03 && Math.abs(pose.players[reset.sb].at.x - 0.25) < 0.03, 'on=' + on);
  }
});

/* Both leave and one comes back within five seconds: they get their own place (and colour) back */
function leaveAndReturn(on, gap){
  reset(); clock();
  for (let f = 0; f < 25; f++) look([{ x: 0.3, shirt: SHIRTS.red }, { x: 0.7, shirt: SHIRTS.blue }], on);
  assert.equal(pose.personCount, 2);
  const slotBlue = slotAt(0.7); assert.equal(slotBlue, 1);
  for (let f = 0; f < gap * 15; f++) look([], on);
  assert.equal(pose.personCount, 0);
  for (let f = 0; f < 15; f++) look([{ x: 0.62, shirt: SHIRTS.blue }], on);
  return { slotBlue, now: slotAt(0.62) };
}
test('a player who leaves and comes back within 5 s gets their slot back', () => {
  assert.equal(leaveAndReturn(false, 3).now, 0, 'without clothes: the first free place (the old way)');
  assert.equal(leaveAndReturn(true, 3).now, 1, 'with clothes: their own');
  assert.equal(leaveAndReturn(true, 3.8).now, 1);
  assert.equal(leaveAndReturn(true, REMEMBER_MS / 1000 + 2).now, 0, 'after more than 5 s they are a newcomer again');
});
test('a newcomer in other clothes does not take the place of the one who left', () => {
  reset(); clock();
  for (let f = 0; f < 25; f++) look([{ x: 0.3, shirt: SHIRTS.red }, { x: 0.7, shirt: SHIRTS.blue }], true);
  for (let f = 0; f < 30; f++) look([], true);
  for (let f = 0; f < 15; f++) look([{ x: 0.5, shirt: SHIRTS.yellow }], true);
  assert.ok(slotAt(0.5) >= 2, 'a stranger takes a free place that is not being kept for red or blue');
  /* ...but with no other place to take, they take one */
  reset(); clock(); pose.cap = 2;
  for (let f = 0; f < 25; f++) look([{ x: 0.3, shirt: SHIRTS.red }, { x: 0.7, shirt: SHIRTS.blue }], true);
  for (let f = 0; f < 30; f++) look([], true);
  for (let f = 0; f < 15; f++) look([{ x: 0.5, shirt: SHIRTS.yellow }], true);
  assert.ok(slotAt(0.5) >= 0, 'the only places left are the kept ones');
});

test('without the picture nothing about clothes happens; a picture that fails is the same as none', () => {
  reset(); clock();
  for (let f = 0; f < 30; f++) look([{ x: 0.3, shirt: SHIRTS.red }, { x: 0.7, shirt: SHIRTS.blue }], false);
  assert.ok(pose.players.every(p => !p.app), 'nothing learned');
  const ref = () => { reset(); clock(); const o = []; for (let f = 0; f < 40; f++){ look([{ x: 0.46 + (f > 20 ? 0.01 : 0), shirt: SHIRTS.red }, { x: 0.54, shirt: SHIRTS.blue }], false); o.push(pose.players.map(p => p.present ? +p.at.x.toFixed(4) : null).join()); } return o; };
  const base = ref();
  for (const bad of [() => { throw new Error('no canvas'); }, () => null, () => ({ data: new Uint8ClampedArray(3), width: 5, height: 5 }), 'nonsense']){
    reset(); clock(); const o = [];
    for (let f = 0; f < 40; f++){
      T += DT;
      pose._assign([figure(0.46 + (f > 20 ? 0.01 : 0), 0.62, 0.15), figure(0.54, 0.62, 0.15)], DT, bad);
      o.push(pose.players.map(p => p.present ? +p.at.x.toFixed(4) : null).join());
    }
    assert.deepEqual(o, base);
  }
});

test('the picture is read a few times a second at most, and not at all for bodies far apart', () => {
  reset(); clock();
  let reads = 0, fr;
  for (let f = 0; f < 90; f++){      /* 6 s at 15 looks a second */
    T += DT;
    const lms = [figure(0.2, 0.62, 0.15), figure(0.8, 0.62, 0.15)];
    fr = blankFrame(); drawFigure(fr, lms[0], { shirt: SHIRTS.red }); drawFigure(fr, lms[1], { shirt: SHIRTS.blue });
    pose._assign(lms, DT, () => { reads++; return fr; });
  }
  assert.ok(reads > 0 && reads <= 14, 'reads ' + reads);
});
