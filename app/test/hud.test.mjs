import test from 'node:test';
import assert from 'node:assert/strict';
import { hud, sayBubble, goalBar } from '../src/games/hud.js';

/* a canvas that only counts what's drawn */
const fakeCanvas = () => {
  const calls = [];
  const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 100 }) : k === 'calls' ? calls : (...a) => { calls.push(k); }, set: () => true });
  return c;
};

test('the words and the bar every game shows are drawn one way, and go away on the results screen', () => {
  hud.quiet = false;
  let c = fakeCanvas(); sayBubble(c, 1600, 900, { text: 'Hello', t: 1 }); goalBar(c, 1600, 900, 0.5);
  assert.ok(c.calls.includes('fillText') && c.calls.filter(x => x === 'fill').length >= 3, 'a bubble with its words, and a bar with its fill');
  /* a hint that has done its job eases away */
  c = fakeCanvas(); sayBubble(c, 1600, 900, { text: 'Hello', t: 9, until: 7 });
  assert.equal(c.calls.length, 0, 'nothing is drawn after its time');
  /* the results screen: nothing from the game sits behind "Well played!" */
  hud.quiet = true;
  c = fakeCanvas(); sayBubble(c, 1600, 900, { text: 'Hello', t: 1 }); goalBar(c, 1600, 900, 0.5);
  assert.equal(c.calls.length, 0, 'quiet: no bubble, no bar');
  hud.quiet = false;
});

test('every game says what its score counts, for the line on the results', async () => {
  const { GAMES } = await import('../src/games/index.js');
  for (const g of GAMES) if (g.id !== 'last-known-position') assert.ok(g.unit, `${g.id} has a unit`);
});

test('every timed game is three minutes, so the games feel the same (Tower Defense has no clock: it runs until the castle falls)', async () => {
  const { GAMES } = await import('../src/games/index.js');
  for (const g of GAMES){
    if (g.id === 'last-known-position' || g.endless) continue;
    assert.equal(g.secs, 180, `${g.id} is 3 minutes`);
  }
});
