import test from 'node:test';
import assert from 'node:assert/strict';
import { POSES, POSE_NAMES, CARD, figureCard } from '../src/games/figure.js';

/* a canvas that only counts what's drawn */
const fakeCanvas = () => {
  const calls = [];
  return new Proxy({}, { get: (_, k) => k === 'calls' ? calls : k === 'createLinearGradient' ? () => ({ addColorStop(){} }) : (...a) => { calls.push(k); }, set: () => true });
};

test('the move card has the poses the games ask for', () => {
  for (const n of ['reach', 'flap', 'wave', 'clap', 'hug', 'jump', 'squat', 'march', 'lean', 'duck', 'run', 'dance', 'freeze', 'side'])
    assert.ok(POSE_NAMES.includes(n), `has ${n}`);
  assert.equal(POSE_NAMES.length, 14);
});

test('every pose draws a card, with two arms and two legs, at any moment', () => {
  for (const n of POSE_NAMES) for (const t of [0, 0.3, 0.77, 1.9, 5.2]){
    const q = POSES[n](0.5 + 0.5 * Math.sin(t * 4), t);
    assert.equal(q.arms.length, 2, `${n}: two arms`);
    if (q.legs) assert.equal(q.legs.length, 2, `${n}: two legs`);
    for (const p of [...q.arms.flat(), ...(q.legs || []).flat()]) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${n}: joints are numbers`);
    const c = fakeCanvas(); figureCard(c, 1600, 900, n, t);
    assert.ok(c.calls.includes('roundRect') && c.calls.includes('stroke'), `${n}: a card with its edge`);
  }
});

test('the card is one fill, one edge, one spot', () => {
  assert.match(CARD.fill, /^#[0-9a-f]{6}$/i); assert.match(CARD.edge, /^#[0-9a-f]{6}$/i);
  assert.ok(CARD.x > 0.5 && CARD.x < 1 && CARD.y > 0 && CARD.y < 1);
});
