/* Pterry Flight after the playtest (docs/playtest/REPORT.md): a minute and a half, rings and fruit to fly through, soft clouds that only wobble,
   and a player who rests their arms stops counting toward the steering. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import ptero, { steerOf, ROUND, TREAT, PUFF, FRUIT } from '../src/games/ptero-flight.js';

const DT = 1 / 30, W = 1920, H = 1080;
/* arms out and level at the shoulders, or tilted: wrist heights lY and rY; arms at rest: wrists by the hips */
const arms = (lY, rY, shY = 0.4) => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 1 }));
  Object.assign(lm[11], { x: 0.45, y: shY }); Object.assign(lm[12], { x: 0.55, y: shY });
  Object.assign(lm[15], { x: 0.25, y: lY }); Object.assign(lm[16], { x: 0.75, y: rY });
  return { present: true, lm, scale: 0.3, centre: { x: 0.5, y: 0.5 }, hands: { left: { x: 0.25, y: lY, speed: 0 }, right: { x: 0.75, y: rY, speed: 0 } } };
};
const resting = (shY = 0.4) => {
  const p = arms(shY + 0.3, shY + 0.3, shY);
  Object.assign(p.lm[15], { x: 0.42 }); Object.assign(p.lm[16], { x: 0.58 });
  p.hands = { left: { x: 0.42, y: shY + 0.3, speed: 0 }, right: { x: 0.58, y: shY + 0.3, speed: 0 } };
  return p;
};
const setup = (list) => { pose.mouse.active = false; pose.players.forEach((q, i) => { if (list[i]) Object.assign(q, list[i]); else { q.present = false; q.lm = null; } }); };
const run = (g, secs) => { for (let t = 0; t < secs; t += DT) g.step(DT, W, H); };

test('wings out count; arms resting by the sides do not', () => {
  assert.equal(steerOf(arms(0.4, 0.4)).out, true);
  assert.equal(steerOf(arms(0.3, 0.55)).out, true, 'tilted wings are still wings');
  assert.equal(steerOf(arms(0.5, 0.5)).out, true, 'wings low and out (a dive) are still wings');
  assert.equal(steerOf(resting()).out, false, 'hands down by the hips: resting');
  pose.mouse.active = true; pose.mouse.x = 0.5; pose.mouse.y = 0.5;
  assert.equal(steerOf({ present: true }).out, true, 'the mouse always steers');
  pose.mouse.active = false;
});

test('one child resting does not pull the pterodactyl down (the other keeps it climbing)', () => {
  setup([arms(0.2, 0.2), resting()]);
  const g = ptero.create(2);
  g.alt = 1.2; run(g, 1.5);
  assert.ok(g.pitch > 0.6, 'the climber alone sets the pitch: ' + g.pitch);
  /* (the old average of a climber at 1 and a rester at about -0.75 was 0.1: barely climbing) */
  const alt = g.alt; run(g, 1);
  assert.ok(g.alt > alt + 0.8, 'and it climbs well: ' + (g.alt - alt));
});

test('everyone resting: it glides on by itself (nothing dives), and says so kindly', () => {
  setup([resting(), resting()]);
  const g = ptero.create(2);
  g.alt = 3; run(g, 10);
  assert.ok(g.alt > 2, 'no dive to the floor: ' + g.alt);
  assert.match(g.hud().words.text, /glides on/i);
  assert.ok(g.z > 20, 'still flying on');
});

test('a player coming back to flying takes over smoothly, not with a jerk', () => {
  setup([resting()]);
  const g = ptero.create(1);
  g.alt = 3; run(g, 4);
  setup([arms(0.2, 0.2)]);
  g.step(DT, W, H);
  assert.ok(g.pitch < 0.35, 'the first moment is gentle: ' + g.pitch);
  run(g, 2);
  assert.ok(g.pitch > 0.7, 'then they steer: ' + g.pitch);
});

test('rings and fruit appear in trails ahead, and flying through one is collected (never a point lost or won)', () => {
  setup([arms(0.4, 0.4)]);
  const g = ptero.create(1);
  g.nextTrail = 0; g.nextAt = 1e9; g.step(DT, W, H);
  assert.equal(g.treats.length, 5, 'a trail of five');
  assert.ok(g.treats.some(q => q.kind === 'ring') && g.treats.some(q => FRUIT.includes(q.kind)), 'rings and fruit');
  const q = g.treats[0];
  assert.ok(g.treats.every(t => t.alt >= 1.5 && t.alt <= 4.5), 'at heights it can fly');
  g.x = q.x - 0.5; g.z = q.z - 0.5; g.alt = q.alt + 3 > 5 ? q.alt - 0.2 : q.alt;      /* (close, but head and altitude whatever they are) */
  const score = g.score.slice();
  g.step(DT, W, H);
  assert.equal(g.treats[0].got || g.gathered > 0, true, 'collected');
  assert.deepEqual(g.score, score, 'no points for it');
  assert.equal(g.value(), 0, 'and it is not a wonder');
  /* too high above it: flies over */
  const h = g.treats.find(t => !t.got);
  g.x = h.x; g.z = h.z; g.alt = Math.min(5, h.alt + 2);
  const n = g.gathered; g.step(DT, W, H);
  assert.equal(g.gathered, n, 'too high is a miss, quietly');
  assert.ok(TREAT > 0);
});

test('a soft cloud is a wobble and a sound and nothing else: no points, no slowing, no end', () => {
  setup([arms(0.4, 0.4)]);
  const g = ptero.create(1);
  g.nextTrail = 1e9; g.nextAt = 1e9; g.nextPuff = 1e9;
  g.puffs.push({ x: 0, z: 3, alt: 2.6, bumped: false, born: 0 });
  g.score[0] = 4;
  g.x = 0; g.z = 2; g.head = 0; g.alt = 2.6;
  g.step(DT, W, H);
  assert.equal(g.bumps, 1);
  assert.ok(g.wob > 0.9, 'a wobble');
  assert.equal(g.score[0], 4, 'no points lost');
  assert.equal(g.over, false);
  const z = g.z; run(g, 1);
  assert.ok(g.z - z > 3.9, 'not slowed: ' + (g.z - z));
  assert.ok(g.wob < 0.5, 'and it settles');
  assert.ok(PUFF > 0);
});

test('clouds and rings come, but gently: a few clouds in the round, and clouds never sit on a trail', () => {
  setup([arms(0.4, 0.4)]);
  const g = ptero.create(1);
  let clouds = 0, rings = 0, seen = new Set(), seenT = new Set();
  for (let t = 0; t < ROUND; t += DT){
    g.step(DT, W, H);
    for (const p of g.puffs) if (!seen.has(p)){ seen.add(p); clouds++; if (g.treats.some(q => !q.got && Math.hypot(q.x - p.x, q.z - p.z) < 4)) assert.fail('a cloud on a trail'); }
    for (const q of g.treats) if (!seenT.has(q)){ seenT.add(q); rings++; }
  }
  assert.ok(clouds >= 2 && clouds <= 6, 'a few soft clouds: ' + clouds);
  assert.ok(rings >= 20, 'plenty to fly through: ' + rings);
  assert.ok(g.found.length >= 4, 'and wonders still turn up: ' + g.found.length);
  assert.ok(g.over, 'and it is over after a minute and a half');
});

test('the round ends with a line about wonders and sparkles, never a cloud', () => {
  setup([arms(0.4, 0.4)]);
  const g = ptero.create(1);
  assert.match(g.summary(), /lovely flight/i);
  g.gathered = 12; g.found.push({ text: 'x', emoji: 'egg' });
  assert.equal(g.summary(), 'You found 1 wonder and 12 sparkles!');
  g.bumps = 3;
  assert.doesNotMatch(g.summary(), /cloud|bump/i);
});
