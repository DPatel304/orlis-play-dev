import test from 'node:test';
import assert from 'node:assert/strict';
import * as crewModule from '../src/ui/crew.js';
const { makeCrew } = crewModule;

const here = (...on) => [0, 1, 2, 3].map(i => on.includes(i));

test('the line-up seats each child on their player', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1));
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
  c.step(0.1, here(0, 1));
  c.set(0, 'ellie'); c.set(1, 'sam');
  c.step(0.1, here(1));          /* Ellie steps out */
  assert.equal(c.of(0), null); assert.ok(c.away.has('ellie'));
  c.step(0.1, here(1, 2)); /* someone comes in, on another place */
  assert.equal(c.of(2), 'ellie');
  assert.deepEqual(c.popped(), [{ i: 2, id: 'ellie' }]);
  assert.deepEqual(c.popped(), []);
});

test('with two away, nobody is guessed: they stay guests until the pause screen sorts it', () => {
  const c = makeCrew();
  c.step(0.1, here(0, 1, 2));
  c.set(0, 'ellie'); c.set(1, 'sam'); c.set(2, 'ava');
  c.step(0.1, here(2));                                   /* Ellie and Sam step out */
  c.step(0.1, here(0, 2));
  assert.equal(c.of(0), null);
  assert.deepEqual(c.popped(), []);
});

test('the crew never looks at the camera picture', () => {
  assert.equal(typeof crewModule.clothesOf, 'undefined');
});
