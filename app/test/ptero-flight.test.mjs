import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import ptero, { steerOf, skyAt, hash, ROUND, ALT_MIN, ALT_MAX, FIND } from '../src/games/ptero-flight.js';

const DT = 1 / 30, W = 1920, H = 1080;
const arms = (lY, rY, shY = 0.4) => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 1 }));
  Object.assign(lm[11], { x: 0.45, y: shY }); Object.assign(lm[12], { x: 0.55, y: shY });
  Object.assign(lm[15], { x: 0.25, y: lY }); Object.assign(lm[16], { x: 0.75, y: rY });
  return { present: true, lm, scale: 0.3, centre: { x: 0.5, y: 0.5 }, hands: { left: { x: 0.25, y: lY, speed: 0 }, right: { x: 0.75, y: rY, speed: 0 } } };
};
const setup = (list) => { pose.mouse.active = false; pose.players.forEach((q, i) => { if (list[i]) Object.assign(q, list[i]); else { q.present = false; q.lm = null; } }); };

test('the lower arm is the way you turn; both arms high climb, both low dive', () => {
  pose.mouse.active = false;
  const level = steerOf(arms(0.4, 0.4));
  assert.ok(Math.abs(level.bank) < 0.01 && Math.abs(level.pitch) < 0.01, 'arms level at the shoulders: straight and level');
  assert.ok(steerOf(arms(0.4, 0.55)).bank > 0.5, 'right arm down: turn right');
  assert.ok(steerOf(arms(0.55, 0.4)).bank < -0.5, 'left arm down: turn left');
  assert.ok(steerOf(arms(0.2, 0.2)).pitch > 0.5, 'arms up: climb');
  assert.ok(steerOf(arms(0.6, 0.6)).pitch < -0.5, 'arms down: dive');
  assert.equal(steerOf({ present: false }), null);
});

test('the sky goes from morning to midday to sunset', () => {
  const a = skyAt(0), b = skyAt(0.45), c = skyAt(1);
  assert.notEqual(a.top, b.top); assert.notEqual(b.top, c.top);
  assert.match(skyAt(0.7).top, /^#[0-9a-f]{6}$/);
});

test('the world is the same every time you look at it', () => {
  assert.equal(hash(3, 4, 5), hash(3, 4, 5));
  assert.notEqual(hash(3, 4, 5), hash(4, 3, 5));
});

test('tipping the arms turns the pterodactyl, raising them lifts it, and it can never leave the safe heights', () => {
  setup([arms(0.4, 0.58)]);
  const g = ptero.create(1);
  const h0 = g.head;
  for (let k = 0; k < 90; k++) g.step(DT, W, H);
  assert.ok(g.head > h0 + 0.3, 'turned right: ' + (g.head - h0));
  setup([arms(0.15, 0.15)]);
  for (let k = 0; k < 900; k++) g.step(DT, W, H);
  assert.ok(g.alt <= ALT_MAX + 1e-9 && g.alt > ALT_MAX - 0.2, 'climbed to the top and stayed: ' + g.alt);
  setup([arms(0.7, 0.7)]);
  for (let k = 0; k < 900; k++) g.step(DT, W, H);
  assert.ok(g.alt >= ALT_MIN - 1e-9 && g.alt < ALT_MIN + 0.2, 'dived to the bottom and stayed: ' + g.alt);
});

test('flying over a wonder finds it, and everyone playing gets it in their book', () => {
  setup([arms(0.4, 0.4), { ...arms(0.4, 0.4) }]);
  const g = ptero.create(2);
  g.nextAt = 0; g.step(DT, W, H);
  assert.equal(g.wonders.length, 1);
  const w = g.wonders[0];
  g.x = w.x - 0.5; g.z = w.z - 0.5; g.alt = 2;
  g.step(DT, W, H);
  assert.equal(g.found.length, 1); assert.equal(g.value(), 1);
  assert.equal(g.score[0], 1); assert.equal(g.score[1], 1);
  assert.ok(Math.hypot(w.x - g.x, w.z - g.z) < FIND + 1);
});

test('too high above a wonder is a near miss, not a find', () => {
  setup([arms(0.4, 0.4)]);
  const g = ptero.create(1);
  g.nextAt = 0; g.step(DT, W, H);
  const w = g.wonders[0];
  g.x = w.x; g.z = w.z; g.alt = ALT_MAX;
  g.step(DT, W, H);
  assert.equal(g.found.length, 0);
});

test('nobody in the room: it drifts gently and keeps flying; the round is three minutes', () => {
  setup([]);
  const g = ptero.create(2);
  for (let t = 0; t < ROUND - 1; t += DT) g.step(DT, W, H);
  assert.equal(g.over, false); assert.ok(g.z > 0);
  for (let t = 0; t < 2; t += DT) g.step(DT, W, H);
  assert.equal(g.over, true);
  assert.equal(ROUND, 180);
});
