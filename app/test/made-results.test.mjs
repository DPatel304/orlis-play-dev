/* What a made game says on its results card: the picked piece as the icon, and "apples caught", "bees dodged", "bounces" (same fields the
   built-in games use: unit, prop, done). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
resetDom();
const { madeGame, resultsOf } = await import('../src/create/made-game.js');
const { resultWords, countText } = await import('../src/ui/units.js');

const make = (picks) => madeGame({ id: 'x', name: 'Mine', picks });

test('each recipe has its own verb, the piece is the icon', () => {
  assert.deepEqual(resultWords(make({ how: 'catch', what: 'apple' }), 12), ['apples', 'caught']);
  assert.deepEqual(resultWords(make({ how: 'pop', what: 'balloon' }), 12), ['balloons', 'popped']);
  assert.deepEqual(resultWords(make({ how: 'collect', what: 'star' }), 12), ['stars', 'collected']);
  assert.deepEqual(resultWords(make({ how: 'dodge', what: 'bee' }), 12), ['bees', 'dodged']);
  assert.deepEqual(resultWords(make({ how: 'keepup', what: 'beachball' }), 12), ['bounces']);
  assert.deepEqual(make({ how: 'catch', what: 'pear' }).prop, ['pear']);
});

test('one of a thing is said in the singular, odd plurals included', () => {
  assert.deepEqual(resultWords(make({ how: 'catch', what: 'apple' }), 1), ['apple', 'caught']);
  assert.equal(countText(1, resultsOf({ how: 'catch', what: 'cookie' }).unit), '1 cookie');
  assert.equal(countText(1, resultsOf({ how: 'catch', what: 'fish' }).unit), '1 fish');
  assert.equal(countText(1, resultsOf({ how: 'catch', what: 'mapleleaf' }).unit), '1 maple leaf');
  assert.equal(countText(1, resultsOf({ how: 'catch', what: 'strawberry' }).unit), '1 strawberry');
  assert.equal(countText(3, resultsOf({ how: 'catch', what: 'dice' }).unit), '3 dice');
});
