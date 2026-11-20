import test from 'node:test';
import assert from 'node:assert/strict';
import { Stage, toWorld, fromWorld, WORLD_H, FG_Z } from '../src/stage/stage.js';

/* a canvas that records the order of what is drawn, and accepts anything else */
function recorder(){
  const log = [];
  const c = new Proxy({}, {
    get(_, k){
      if (typeof k === 'symbol') return undefined;
      if (k === 'log') return log;
      if (k === 'translate') return (x, y) => log.push(['actor', Math.round(x), Math.round(y)]);
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(){ return true; }
  });
  return c;
}

test('screen positions and the 3D world map back and forth, on any screen shape', () => {
  for (const asp of [4 / 3, 16 / 9, 21 / 9]){
    for (const [x, y] of [[0, 0], [0.5, 0.5], [1, 1], [0.2, 0.9]]){
      const w = toWorld(x, y, asp), b = fromWorld(w.x, w.y, asp);
      assert.ok(Math.abs(b.x - x) < 1e-9 && Math.abs(b.y - y) < 1e-9);
    }
  }
  assert.equal(toWorld(0.5, 0, 1).y, WORLD_H, 'the top of the screen is the top of the world');
  assert.equal(toWorld(0.5, 1, 1).y, 0);
  assert.ok(toWorld(0.5, 0.5, 2).x === 0, 'the middle is the middle');
});

test('without 3D the stage paints the same picture: backdrop, actors behind the grass, grass, actors in front', () => {
  const log = [];
  const backdrop = { drawBack(){ log.push('back'); }, drawFront(){ log.push('front'); } };
  const stage = new Stage({ backdrop, gl: false });
  const c = recorder();
  const front = stage.actor('balloon', { x: 0.5, y: 0.5, z: FG_Z + 1, size: 0.1 });
  const back = stage.actor('tree', { x: 0.25, y: 0.5, z: FG_Z - 1, size: 0.2 });
  const hidden = stage.actor('rock', { x: 0.75, y: 0.5, z: 3, size: 0.1, visible: false });
  const orig = c.translate;
  const spy = new Proxy(c, { get(t, k){ if (k === 'translate') return (x, y) => log.push('actor@' + Math.round(x)); return t[k]; }, set(){ return true; } });
  stage.draw(spy, 1000, 500);
  const actors = log.filter(s => String(s).startsWith('actor@'));
  assert.deepEqual(log.filter(s => !String(s).startsWith('actor@')), ['back', 'front']);
  assert.equal(log[0], 'back');
  assert.equal(log.indexOf('actor@250') < log.indexOf('front'), true, 'the tree stands behind the grass');
  assert.equal(log.indexOf('actor@500') > log.indexOf('front'), true, 'the balloon floats in front of it');
  assert.ok(!log.includes('actor@750'), 'an invisible actor is not drawn');
  assert.equal(actors.length, 2);
  stage.remove(front);
  assert.equal(stage.actors.length, 2);
});

test('confetti rises, falls and goes away', () => {
  const stage = new Stage({ gl: false });
  stage.burst(0.5, 0.5, '#ff5b5b', 12);
  assert.equal(stage.shards.length, 12);
  for (let i = 0; i < 120; i++) stage.step(1 / 60);
  assert.equal(stage.shards.length, 0, 'all of it is gone after a couple of seconds');
  for (let i = 0; i < 50; i++) stage.burst(0.5, 0.5);
  assert.ok(stage.shards.length <= 300, 'there is a cap');
});

import { smoothness } from '../src/ui/smoothness.js';
test('the owner\'s smoothness line: a steady round and a stuttery one read differently', () => {
  const steady = Array.from({ length: 600 }, () => 16.7);
  const stutter = Array.from({ length: 600 }, (_, i) => (i % 10 === 0 ? 70 : 16.7));
  assert.match(smoothness(steady, '3D stage'), /60 frames a second on average, the slowest 5% over 17 ms \(3D stage\)/);
  assert.match(smoothness(stutter), /the slowest 5% over 70 ms/);
  assert.equal(smoothness([16, 16]), '', 'too few frames to say anything');
  assert.equal(smoothness(null), '');
});

import { buildReport } from '../src/ui/perfreport.js';
test('the performance report says how a round went, and where it stuttered', () => {
  const frames = Array.from({ length: 1200 }, (_, i) => (i > 600 && i < 620 ? 90 : 16.7));
  const r = buildReport({ build: 'b1', game: 'Pop Party [pop-party]', mode: 'gl', frames, gpu: 'NVIDIA RTX', screen: '1920x1080', pose: { fps: 30, inferMs: 12.34, people: 2 }, stagePerf: 'per frame: x' });
  assert.match(r, /build: b1/); assert.match(r, /graphics: NVIDIA RTX/); assert.match(r, /camera tracking: 30 fps, inference 12.3 ms, 2 player/);
  assert.match(r, /19 over 100 ms|stutters: 19 frames slower than 30 fps/);
  assert.match(r, /frames a second, every 5 s: \d+( \d+)+/);
  assert.match(r, /per frame: x/);
  assert.match(buildReport({ frames: [16] }), /not enough frames/);
});
