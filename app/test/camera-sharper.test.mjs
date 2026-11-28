import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { describeTrack, fpsPlan, exposurePlan, COOLDOWN_MS, BRIGHT_ON, DARK_BACK } from '../src/tracking/camera.js';
import { meanLuminance } from '../src/tracking/lighting.js';
import { blankFrame } from './harness/synth-frames.mjs';

const track = ({ caps = {}, set = {}, applied = [], fail = false } = {}) => ({
  getCapabilities: () => caps, getSettings: () => set, readyState: 'live', stop(){},
  applyConstraints: async (c) => { applied.push(c); if (fail) throw new Error('OverconstrainedError'); }
});
const usb = { frameRate: { min: 5, max: 60 }, exposureMode: ['continuous', 'manual'], exposureTime: { min: 3, max: 2047, step: 1 }, exposureCompensation: { min: -2, max: 2 }, brightness: {} };

test('describeTrack: what a camera offers, as plain data; nothing from a camera that says little', () => {
  const d = describeTrack(track({ caps: usb, set: { frameRate: 30, width: 640, height: 360, exposureTime: 330 } }));
  assert.deepEqual(d.fps, { min: 5, max: 60, step: 0 }); assert.equal(d.fpsNow, 30); assert.deepEqual(d.exposureModes, ['continuous', 'manual']);
  assert.equal(d.exposureTime.max, 2047); assert.equal(d.exposureNow, 330); assert.ok(d.other.includes('brightness'));
  const laptop = describeTrack(track({ caps: { width: { max: 1280 }, frameRate: { min: 1, max: 30 } }, set: { frameRate: 30 } }));
  assert.equal(laptop.exposureTime, null); assert.equal(fpsPlan(laptop), null);
  assert.deepEqual(describeTrack(null).other, []);
  assert.deepEqual(describeTrack({ getCapabilities(){ throw new Error('x'); } }).fps, null);
});

test('fpsPlan: asks again only when the camera can do 60 and is not', () => {
  assert.deepEqual(fpsPlan(describeTrack(track({ caps: usb, set: { frameRate: 30 } }))), { frameRate: { ideal: 60 } });
  assert.equal(fpsPlan(describeTrack(track({ caps: usb, set: { frameRate: 60 } }))), null);
  assert.equal(fpsPlan(describeTrack(track({ caps: { frameRate: { min: 1, max: 30 } }, set: { frameRate: 30 } }))), null);
});

test('exposurePlan: halves a long exposure in a bright picture, goes back when it is dark, waits between changes, does nothing without the controls', () => {
  const d = describeTrack(track({ caps: usb, set: { exposureTime: 330 } }));
  let r = exposurePlan(d, BRIGHT_ON + 0.05, null, 10000);
  assert.deepEqual(r.constraints, { advanced: [{ exposureMode: 'manual', exposureTime: 165 }] }); assert.equal(r.state.mode, 'short');
  assert.equal(exposurePlan(d, 0.1, r.state, 10000 + COOLDOWN_MS - 1).constraints, null, 'not within the cooldown');
  const back = exposurePlan(d, DARK_BACK - 0.05, r.state, 10000 + COOLDOWN_MS + 1);
  assert.deepEqual(back.constraints, { advanced: [{ exposureMode: 'continuous' }] }); assert.equal(back.state.mode, 'auto');
  assert.equal(exposurePlan(d, 0.4, null, 10000).constraints, null, 'a middling picture: no change');
  assert.equal(exposurePlan(describeTrack(track({ caps: { frameRate: { max: 30 } } })), 0.9, null, 10000).constraints, null);
  const tiny = describeTrack(track({ caps: { ...usb, exposureTime: { min: 330, max: 400 } }, set: { exposureTime: 330 } }));
  assert.equal(exposurePlan(tiny, 0.9, null, 10000).constraints, null, 'already at the shortest');
});

test('meanLuminance of synthetic frames', () => {
  assert.ok(Math.abs(meanLuminance(blankFrame(8, 8, [255, 255, 255])) - 1) < 1e-9);
  assert.ok(meanLuminance(blankFrame(8, 8, [0, 0, 0])) < 1e-9);
  assert.ok(Math.abs(meanLuminance(blankFrame(8, 8, [128, 128, 128])) - 128 / 255) < 1e-6);
  assert.equal(meanLuminance(null), null);
});

async function openWith(on, tr){
  const asked = [];
  const saved = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: async (c) => { asked.push(c); return { getTracks: () => [tr], getVideoTracks: () => [tr] }; } } }, configurable: true });
  forceSwitches({ camera: on });
  pose.video = { play: async () => {}, srcObject: null };
  try { await pose._open('', false); await new Promise(r => setTimeout(r, 5)); } finally { forceSwitches(null); Object.defineProperty(globalThis, 'navigator', { value: saved, configurable: true }); }
  return asked[0].video;
}

test('Sharper camera off: the camera is asked for exactly what it was before; on: 60 ideal, and a second ask when it stays at 30', async () => {
  const off = await openWith(false, track({ caps: usb, set: { frameRate: 30 } }));
  assert.deepEqual(off.frameRate, { ideal: 30 }); assert.ok(!pose._camTrack);
  const applied = [];
  const on = await openWith(true, track({ caps: usb, set: { frameRate: 30 }, applied }));
  assert.deepEqual(on.frameRate, { ideal: 60 });
  assert.deepEqual(applied, [{ frameRate: { ideal: 60 } }]);
  assert.equal(pose.camInfo.fps.max, 60);
  const none = await openWith(true, track({ caps: {}, set: {}, fail: true }));
  assert.deepEqual(none.frameRate, { ideal: 60 });          /* a camera with nothing to offer: nothing breaks */
  pose._camTrack = null;
});

test('Sharper camera: a bright picture shortens the exposure through the tracker, a dark one puts it back', () => {
  const applied = [], tr = track({ caps: usb, set: { frameRate: 60, exposureTime: 330 }, applied });
  forceSwitches({ camera: true });
  pose._camTrack = tr; pose._camState = null; pose._camLum = null; pose._lumAt = 0;
  let pic = blankFrame(8, 8, [220, 220, 215]);
  pose._grab = () => pic;
  try {
    pose._camTick(10000);
    assert.equal(applied.length, 1); assert.equal(applied[0].advanced[0].exposureTime, 165);
    pic = blankFrame(8, 8, [20, 20, 20]);
    for (let t = 16000; t < 30000; t += 600) pose._camTick(t);
    assert.deepEqual(applied.at(-1), { advanced: [{ exposureMode: 'continuous' }] });
    const n = applied.length;
    forceSwitches({ camera: false }); pose._camTick(40000);
    assert.equal(pose._camTrack, null); assert.ok(applied.length >= n);
  } finally { forceSwitches(null); delete pose._grab; pose._camTrack = null; }
});
