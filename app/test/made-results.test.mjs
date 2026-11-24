/* What a made game says on its results card: the picked piece as the icon, and "apples caught", "bees dodged", "bounces" (same fields the
   built-in games use: unit, prop, done). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
resetDom();
const { madeGame, resultsOf } = await import('../src/create/made-game.js');
const { resultWords, countText } = await import('../src/ui/units.js');

const one = (id, job = 'collect') => ({ things: [{ id, job }] });
const make = (picks) => madeGame({ id: 'x', name: 'Mine', picks });

test('each recipe has its own verb, the piece is the icon', () => {
  assert.deepEqual(resultWords(make(one('apple', 'collect')), 12), ['apples', 'caught']);
  assert.deepEqual(resultWords(make(one('balloon', 'collect')), 12), ['balloons', 'caught']);
  assert.deepEqual(resultWords(make(one('star', 'collect')), 12), ['stars', 'caught']);
  assert.deepEqual(resultWords(make(one('bee', 'dodge')), 12), ['bees', 'dodged']);
  assert.deepEqual(resultWords(make(one('beachball', 'keepup')), 12), ['bounces']);
  assert.deepEqual(make(one('pear', 'collect')).prop, ['pear']);
});

test('one of a thing is said in the singular, odd plurals included', () => {
  assert.deepEqual(resultWords(make(one('apple', 'collect')), 1), ['apple', 'caught']);
  assert.equal(countText(1, resultsOf(one('cookie')).unit), '1 cookie');
  assert.equal(countText(1, resultsOf(one('fish')).unit), '1 fish');
  assert.equal(countText(1, resultsOf(one('mapleleaf')).unit), '1 maple leaf');
  assert.equal(countText(1, resultsOf(one('strawberry')).unit), '1 strawberry');
  assert.equal(countText(3, resultsOf(one('dice')).unit), '3 dice');
});
