/* Drawing the hand between camera samples: evenly spaced frames, a capped lead when a sample is late, no overshoot, and the
   home screen looking at the full rate while a hand points. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, between, LEAD_MAX } from '../src/tracking/pose.js';
import { easeCursor } from '../src/ui/cursor.js';
import { simulate, jumps } from '../tools/hand-smooth-sim.mjs';

const line = (speed) => (t) => ({ x: 0.1 + speed * t, y: 0.5 });

test('a hand at constant speed, sampled at 15 Hz and drawn at 165 Hz: evenly spaced, no repeated frames', () => {
  const frames = simulate({ path: line(0.2), sampleHz: 15, drawHz: 165, seconds: 3 }).filter(f => f.t > 1000);
  const d = frames.slice(1).map((f, i) => f.x - frames[i].x);
  const mean = d.reduce((a, b) => a + b) / d.length;
  assert.ok(d.every(v => v > 0), 'it moves on every frame');
  assert.ok(d.every(v => Math.abs(v - mean) < mean * 0.15), 'by about the same step each time: ' + Math.min(...d) + ' to ' + Math.max(...d));
  const held = simulate({ path: line(0.2), sampleHz: 15, drawHz: 165, seconds: 3, mode: 'held' }).filter(f => f.t > 1000);
  assert.ok(held.slice(1).filter((f, i) => f.x === held[i].x).length > held.length * 0.8, 'before, most frames were repeats');
});

test('a late sample: it goes on a little (never more than the cap), then catches up without overshooting', () => {
  const path = line(0.3);
  const late = simulate({ path, sampleHz: 18, seconds: 3, late: (k) => k === 30 ? 120 : 0 });
  const stall = late.filter(f => f.t > 1000 && f.t < 2200);
  /* nowhere further on than the sample interval lag allows, plus the cap, of the true hand; and never ahead of it */
  assert.ok(stall.every(f => f.x <= f.want + 1e-9), 'never ahead of the hand');
  const steps = stall.slice(1).map((f, i) => f.x - stall[i].x);
  assert.ok(steps.every(v => v >= -1e-9), 'and never steps backwards when the sample comes');
  const j = jumps(late, 1920, 1000);
  assert.ok(j.maxJump < 15, 'no jump when it catches up: ' + j.maxJump);
  assert.equal(LEAD_MAX, 0.03);
  assert.equal(between(0, 1, 0.5, 0.1, 0.1 + 0.5), 1 + 5 * LEAD_MAX, 'the lead is capped (at the sample\'s own speed)');
});

test('a sudden stop does not overshoot, even when the next sample is late', () => {
  const stopAt = 1.5, path = (t) => ({ x: 0.1 + 0.5 * Math.min(t, stopAt) * 0.6, y: 0.5 });
  for (const late of [() => 0, (k) => k > 27 ? 150 : 0]){
    const frames = simulate({ path, sampleHz: 18, seconds: 4, late });
    const end = 0.1 + 0.5 * stopAt * 0.6;
    assert.ok(frames.every(f => f.x <= end + 0.002), 'never past where the hand stopped: ' + Math.max(...frames.map(f => f.x - end)));
    const last = frames.at(-1);
    assert.ok(Math.abs(last.x - end) < 0.002, 'and it settles there: ' + last.x);
  }
});

test('holding still is perfectly still: no jitter and no drift', () => {
  const frames = simulate({ path: () => ({ x: 0.4, y: 0.5 }), seconds: 4 }).filter(f => f.t > 500);
  assert.ok(frames.every(f => Math.abs(f.x - 0.4) < 1e-9));
  const f = {}; let p;
  for (let i = 0; i < 400; i++) p = easeCursor(f, 0.3, 0.6, 1 / 165);
  assert.ok(Math.abs(p.x - 0.3) < 1e-9 && Math.abs(p.y - 0.6) < 1e-9, 'the eased cursor ends exactly on the hand');
});

test('the cursor follows a hand across the screen almost at once', () => {
  const f = {}; let p = easeCursor(f, 0.2, 0.5, 1 / 165);
  for (let i = 0; i < 33; i++) p = easeCursor(f, 0.2 + 0.4 * (i / 33), 0.5, 1 / 165);   /* 0.2 s at 2 screens/s */
  assert.ok(0.2 + 0.4 - p.x < 0.04, 'within 4% of the screen of a fast hand: ' + (0.6 - p.x));
});

test('the results line strings its sentences with one full stop between, never ".."', async () => {
  const { joinLine } = await import('../src/ui/smoothness.js');
  assert.equal(joinLine('You saved the whole harvest together!', 'Smoothness: 60'), 'You saved the whole harvest together! Smoothness: 60');
  assert.equal(joinLine('Your best run: 4 in a row.', 'Smoothness: 60'), 'Your best run: 4 in a row. Smoothness: 60');
  assert.equal(joinLine('You got 3 stars', 'Smoothness: 60 (3D stage)', 'per frame: 1 ms'), 'You got 3 stars. Smoothness: 60 (3D stage). per frame: 1 ms');
  assert.equal(joinLine(null, '', 'Only this.'), 'Only this.');
  assert.equal(joinLine('', 'Smoothness: 60', ''), 'Smoothness: 60');
  assert.ok(!joinLine('A..', 'B.', 'C').includes('..'));
  assert.equal(joinLine('Wait...', 'ok'), 'Wait... ok', 'a real ellipsis stays');
});
