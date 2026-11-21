import test from 'node:test';
import assert from 'node:assert/strict';
import { trailer } from '../src/ui/trailer.js';
import { byId } from '../src/games/index.js';
import { pose } from '../src/tracking/pose.js';

const fake = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });

for (const id of ['pop-party', 'last-known-position']){
  test(`${id}'s trailer plays itself, and leaves the real players alone`, () => {
    const players = pose.players, mouse = pose.mouse;
    players[0].present = true; players[0].hands.right.x = 0.1;
    const tr = trailer(byId(id));
    assert.ok(tr, 'it has one');
    for (let k = 0; k < 20 * 30; k++) tr.step(1 / 30, 1440, 810);
    tr.draw(fake(), 1440, 810);
    assert.equal(pose.players, players, 'the real players are back after');
    assert.equal(pose.mouse, mouse);
    assert.equal(players[0].hands.right.x, 0.1, 'and untouched');
    players[0].present = false;
  });
}

test('a game without a trailer shows its poster instead', () => {
  assert.equal(trailer({ id: 'nothing-yet' }), null);
});

test("a story's cover still leaves its caption plate out (the title is painted on the cover)", () => {
  const g = byId('cubions-long-way-home');
  const calls = [];
  const rec = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : (...a) => { calls.push(k); }, set: () => true });
  const inst = g.create(1);
  Object.defineProperty(inst, 'beat', { get: () => ({ t: 'Sit back and listen' }) });   /* (the story's current line) */
  inst.plate(rec, 1440, 810);
  assert.ok(calls.includes('roundRect'), 'the plate is drawn in play');
  calls.length = 0;
  inst.stillMode = true;
  inst.plate(rec, 1440, 810);
  assert.equal(calls.length, 0, 'and left out of a still');
});
