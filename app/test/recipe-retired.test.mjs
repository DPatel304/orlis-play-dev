/* Bumblebee left the picker (owner, 2026-11-25): it looked the same as Bee. An old saved game that picked it becomes a bee. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { choices, clean } from '../src/create/recipe.js';

test('no Bumblebee in the picker; an old pick of it becomes a bee', () => {
  const all = choices.what.flatMap(c => c.pieces.map(p => p.id));
  assert.ok(all.includes('bee') && !all.includes('bumblebee'));
  assert.deepEqual(clean({ things: [{ id: 'bumblebee', job: 'dodge' }] }).things, [{ id: 'bee', job: 'dodge' }]);
  assert.deepEqual(clean({ things: [{ id: 'bee', job: 'dodge' }, { id: 'bumblebee', job: 'dodge' }] }).things, [{ id: 'bee', job: 'dodge' }], 'never two bees');
});
