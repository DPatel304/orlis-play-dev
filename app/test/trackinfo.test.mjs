import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import { forceSwitches, SWITCH_KEYS, switchStates } from '../src/tracking/switches.js';
import { Hold } from '../src/tracking/shape.js';

test('the tracking details know the new signals: shape match, holding, recording time, camera, and nothing extra when the switches are off', () => {
  forceSwitches(Object.fromEntries(Object.keys(SWITCH_KEYS).map(k => [k, false])));
  pose.players[0].present = true; pose.players[0].at = { size: 0.15 };
  let i = pose.trackInfo();
  assert.equal(i.record, null); assert.equal(i.camera, null); assert.equal(i.light, null); assert.equal(i.rows[0].shape, null); assert.equal(i.rows[0].holding, false);
  forceSwitches({ record: true, camera: true, apart: true, steady: true, light: true });
  pose.recorder = null; pose._recRound = false; pose.recordRound({ game: 'g', lineup: 1 });
  pose.recorder.add(1000, 0.03, []); pose.recorder.add(66000, 0.03, []);
  pose.players[0].shape = { score: 0.93, looks: 9 };
  pose._hold = [new Hold(0, 1, { x: 0.4, y: 0.7, vx: 0, vy: 0 }, { x: 0.5, y: 0.7, vx: 0, vy: 0 })];
  pose.camInfo = { fpsNow: 59.7, exposureTime: { min: 1, max: 100 } }; pose._camState = { mode: 'short', at: 0 };
  i = pose.trackInfo();
  assert.equal(i.rows[0].shape, 0.93); assert.equal(i.rows[0].holding, true);
  assert.equal(i.record.recording, true); assert.ok(Math.abs(i.record.seconds - 65) < 0.01);
  assert.deepEqual(i.camera, { fps: 60, exposure: 'short', controls: true });
  assert.equal(i.apart, true); assert.equal(i.steady, true);
  assert.equal(Object.keys(switchStates()).length, Object.keys(SWITCH_KEYS).length);
  forceSwitches(null);
  pose.players[0].present = false; pose.players[0].at = null; pose.players[0].shape = null; pose._hold = []; pose.recorder = null; pose._recRound = false; pose.camInfo = null; pose._camState = null;
});
