import test from 'node:test';
import assert from 'node:assert/strict';
import { Stage, toWorld, fromWorld, WORLD_H, FG_Z } from '../src/stage/stage.js';
import stageGame, { target } from '../src/games/labs/pop-party-stage.js';
import { LABS, GAMES, byId } from '../src/games/index.js';
import { pose } from '../src/tracking/pose.js';
import { FINALE, OPENING } from '../src/games/pop-party.js';

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

test('the lab game: a few balloons from the start, a crowded sky by the end, hands pop and score', () => {
  assert.equal(target(0), 3);
  assert.ok(target(OPENING + 1) > 3 && target(FINALE - 1) < 17 && target(FINALE) === 24);
  pose.mouse.active = false;
  const p = pose.players[0]; p.present = true; pose.players[1].present = false;
  p.hands.left = { x: -1, y: -1, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: -1, y: -1, vx: 0, vy: 0, speed: 0 };
  const g = stageGame.create(1, { gl: false });
  for (let i = 0; i < 60 * 3; i++) g.step(1 / 60, 1920, 1080);
  assert.ok(g.balloons.length >= 3, 'something to reach for');
  assert.equal(g.stage.actors.length, g.balloons.length, 'each balloon is one actor');
  const b = g.balloons[0];
  p.hands.left = { x: b.x, y: b.y, vx: 0, vy: 0, speed: 0 };
  const before = g.score[0];
  g.step(1 / 60, 1920, 1080);
  assert.ok(g.score[0] > before, 'touching a balloon pops it for points');
  assert.ok(g.stage.shards.length > 0, 'with confetti');
  g.draw(recorder(), 1920, 1080);
  g.dispose();
  assert.equal(g.stage.actors.length, 0);
});

test('experiments are reachable by name, but never in the menu or the catalogue', () => {
  assert.ok(LABS.some(g => g.id === 'pop-party-stage'));
  assert.ok(!GAMES.some(g => g.id === 'pop-party-stage'));
  assert.equal(byId('pop-party-stage').id, 'pop-party-stage');
  assert.equal(byId('pop-party').id, 'pop-party');
});
