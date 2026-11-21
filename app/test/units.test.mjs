import test from 'node:test';
import assert from 'node:assert/strict';
import { countText, singular } from '../src/ui/units.js';
import { GAMES } from '../src/games/index.js';

test('one and many: "1 balloon", "12 balloons"', () => {
  assert.equal(countText(1, 'balloons'), '1 balloon');
  assert.equal(countText(12, 'balloons'), '12 balloons');
  assert.equal(countText(0, 'balloons'), '0 balloons');
  assert.equal(countText(1, 'points'), '1 point');
});

test('irregular and unchanging words', () => {
  assert.equal(singular('leaves'), 'leaf');
  assert.equal(singular('stories'), 'story');
  assert.equal(countText(1, 'fruit'), '1 fruit');
  assert.equal(countText(5, 'fruit'), '5 fruit');
  assert.equal(countText(1, 'bits of sky painted'), '1 bit of sky painted');
});

test('every game has a unit that reads well at 1 and at 2', () => {
  for (const g of GAMES){
    if (g.id === 'last-known-position') continue;
    assert.ok(g.unit, `${g.id} has a unit`);
    const one = countText(1, g.unit), many = countText(2, g.unit);
    assert.match(one, /^1 \S/, `${g.id}: ${one}`);
    if (g.unit !== 'fruit') assert.notEqual(one, many.replace('2', '1'), `${g.id}: "${one}" and "${many}" should differ (a plural unit)`);   /* (fruit is the same word either way) */
  }
});
