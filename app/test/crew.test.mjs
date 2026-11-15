import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCrew, SAME_CLOTHES, LOOK_EVERY } from '../src/ui/crew.js';

const RED = [200, 40, 40], BLUE = [40, 60, 210], GREEN = [40, 180, 60];
const here = (...on) => [0, 1, 2, 3].map(i => on.includes(i));

test('the line-up seats each child on their player', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1), (i) => [RED, BLUE][i]);
  c.set(0, 'ellie'); c.set(1, 'sam');
  assert.equal(c.of(0), 'ellie'); assert.equal(c.of(1), 'sam');
  assert.equal(c.playerOf('sam'), 1);
});

test('picking a child for a second player moves them, never two of them', () => {
  const c = makeCrew();
  c.set(0, 'ellie'); c.set(2, 'ellie');
  assert.equal(c.of(0), null); assert.equal(c.of(2), 'ellie');
});

test('the only child away is whoever comes back, and their name pops', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1), (i) => [RED, BLUE][i]);
  c.set(0, 'ellie'); c.set(1, 'sam');
  c.step(0.1, here(1), (i) => [RED, BLUE][i]);          /* Ellie steps out */
  assert.equal(c.of(0), null); assert.ok(c.away.has('ellie'));
  c.step(0.1, here(1, 2), (i) => [null, BLUE, GREEN][i]); /* someone comes in, on another place */
  assert.equal(c.of(2), 'ellie');
  assert.deepEqual(c.popped(), [{ i: 2, id: 'ellie' }]);
  assert.deepEqual(c.popped(), []);
});

test('with two away, the clothes say who is back', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1, 2), (i) => [RED, BLUE, GREEN][i]);
  c.set(0, 'ellie'); c.set(1, 'sam'); c.set(2, 'ava');
  c.step(0.1, here(2), () => GREEN);                      /* Ellie and Sam step out */
  c.step(0.1, here(0, 2), (i) => [[45, 65, 200], null, GREEN][i]);   /* blue clothes back */
  assert.equal(c.of(0), 'sam');
  c.step(0.1, here(0, 1, 2), (i) => [BLUE, [190, 50, 45], GREEN][i]);
  assert.equal(c.of(1), 'ellie');
});

test('someone in clothes nobody away was wearing stays a guest', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1), (i) => [RED, BLUE][i]);
  c.set(0, 'ellie'); c.set(1, 'sam');
  c.step(0.1, here(), () => null);
  c.step(0.1, here(3), () => GREEN);
  assert.equal(c.of(3), null);
  assert.ok(SAME_CLOTHES < Math.hypot(GREEN[0] - RED[0], GREEN[1] - RED[1], GREEN[2] - RED[2]));
});

test('two away in clothes too alike to tell apart: a guest, not a guess', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1), () => RED);
  c.set(0, 'ellie'); c.set(1, 'sam');
  c.step(0.1, here(), () => null);
  c.step(0.1, here(2), () => RED);
  assert.equal(c.of(2), null);
});

test("a player's clothes are looked at again as they play", () => {
  const c = makeCrew();
  let col = RED;
  c.step(0.1, here(0), () => col);
  col = BLUE;
  c.step(LOOK_EVERY, here(0), () => col);
  assert.ok(c.clothes[0][2] > RED[2]);
});
