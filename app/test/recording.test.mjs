import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, sizeOf, seated, CLOSE, STAY_CLOSE, WATCH_AFTER, headOf } from '../src/tracking/pose.js';
import { Recorder, fileName, saveRecording, unpack } from '../src/tracking/recorder.js';
import { forceSwitches } from '../src/tracking/switches.js';
import * as rig from '../tools/playtest/rig.mjs';
import { TrackMetrics } from '../tools/playtest/metrics.mjs';
import { replay } from '../tools/replay.mjs';

const lib = { sizeOf, seated, CLOSE, STAY: STAY_CLOSE, WATCH_AFTER, headOf };
const DT = 1 / 30;

/* two children walk past each other twice; the people lists are recorded as the tracker gets them, and kept as they were */
function record(secs = 16){
  rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
  rig.resetPose(pose);
  const world = rig.makeWorld('2x', 3, {});
  const brain = { act(ctx, p, now){ const home = p.mem.home ??= p.sx; p.walkTo(Math.floor(now / 6) % 2 ? 1 - home : home); } };
  const rec = new Recorder(), live = new TrackMetrics();
  rec.begin({ game: 'test', lineup: 2 });
  const feeder = new rig.Feeder(pose, lib, { assist: false, cap: 2, metrics: live });
  const orig = pose._assign.bind(pose);
  pose._assign = (people, dt, frame) => { rec.add(feeder.t * 1000, dt, people, null, { w: 640, h: 360 }); return orig(people, dt, frame); };
  try { for (let i = 0; i < secs / DT; i++){ world.step(DT, brain, {}); feeder.step(world, DT); } } finally { pose._assign = orig; }
  return { rec, live: live.result() };
}

test('a recording holds points only, round-trips through JSON, and keeps just the newest minutes', () => {
  const { rec } = record(6);
  const text = rec.parts().join('');
  const file = JSON.parse(text);
  assert.equal(file.orlis, 'track'); assert.equal(file.frames.length, rec.count);
  assert.equal(file.rounds[0].game, 'test'); assert.equal(file.frame.w, 640);
  assert.ok(!/data:|base64|pixels/i.test(text.slice(0, 2000)));
  const p0 = unpack(file.frames[0].p[0]);
  assert.equal(p0.length, 33);
  const small = new Recorder({ ms: 1000 });
  small.begin({ game: 'g', lineup: 1 });
  for (let i = 0; i < 2000; i++) small.add(i * 33, 0.033, [p0]);
  assert.ok(small.seconds <= 4.5 && small.seconds >= 0.9, 'kept about the newest second (a little slack): ' + small.seconds); assert.ok(small.count < 2000);
  assert.ok(JSON.parse(small.parts().join('')).rounds.length === 1);
});

test('replaying a recording gives the live run\'s numbers (to the rounding of the file)', () => {
  const { rec, live } = record(16);
  const file = JSON.parse(rec.parts().join(''));
  const r = replay(file, []);
  assert.equal(r.looks, live.looks);
  assert.equal(r.dropouts, live.dropouts);
  assert.equal(r.jumps.during + r.jumps.after + r.jumps.other, live.jumps.during + live.jumps.after + live.jumps.other);
  assert.equal(r.suspectSwaps, live.suspectSwaps);
  assert.ok(r.msPerLook >= 0);
});

test('forced switches are released after a replay', () => {
  const { rec } = record(3);
  replay(JSON.parse(rec.parts().join('')), ['steady']);
  assert.equal(pose.recordingInfo().on, false);
});

test('saving makes a gzip (or plain) file with a dated name, through a download link', async () => {
  const { rec } = record(3);
  assert.match(fileName(true, new Date(2026, 10, 28, 14, 5)), /^orlis-track-2026-11-28-1405\.json\.gz$/);
  assert.match(fileName(false), /\.json$/);
  const made = [];
  const doc = { body: { append: (a) => made.push(a) }, createElement: () => ({ click(){ this.clicked = true; }, remove(){} }) };
  const saved = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = () => 'blob:x';
  try {
    const r = await saveRecording(rec, { doc });
    assert.ok(r.bytes > 100); assert.equal(made[0].download, r.name); assert.ok(made[0].clicked);
  } finally { globalThis.URL.createObjectURL = saved; }
  await assert.rejects(() => saveRecording(new Recorder(), { doc }));
});

test('pose records only while a round is playing and the switch is on', () => {
  forceSwitches({ record: false });
  pose.recorder = null; pose._recRound = false;
  pose.recordRound({ game: 'x', lineup: 2 });
  assert.equal(pose._recRound, false); assert.equal(pose.recorder, null);
  forceSwitches({ record: true });
  pose.recordRound({ game: 'x', lineup: 2 });
  assert.equal(pose._recRound, true); assert.equal(pose.recorder.rounds.length, 1);
  pose.recordRound({ game: 'x', lineup: 2 });
  assert.equal(pose.recorder.rounds.length, 1);
  pose.recordRound(null); assert.equal(pose._recRound, false);
  forceSwitches(null); pose.recorder = null;
});
