import test from 'node:test';
import assert from 'node:assert/strict';
import { POSES, POSE_NAMES, CARD, FACES, FACE_NAMES, FRAMES, MOTION, DRAWINGS, frameAt, figureCard, drawCard } from '../src/games/figure.js';

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
    const q = POSES[n](frameAt(n, t).p);
    assert.equal(q.arms.length, 2, `${n}: two arms`);
    if (q.legs) assert.equal(q.legs.length, 2, `${n}: two legs`);
    for (const p of [...q.arms.flat(), ...(q.legs || []).flat()]) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${n}: joints are numbers`);
    const c = fakeCanvas(); figureCard(c, 1600, 900, n, t);
    assert.ok(c.calls.includes('roundRect') && c.calls.includes('stroke'), `${n}: a card with its edge`);
  }
});

test('the card is one fill, one edge (its spot is the grid\'s)', () => {
  assert.match(CARD.fill, /^#[0-9a-f]{6}$/i); assert.match(CARD.edge, /^#[0-9a-f]{6}$/i);
});

test('Cubo moves like stop-motion: a few drawings that repeat, each with its own face', () => {
  for (const n of POSE_NAMES){
    assert.equal(FRAMES[n] && FRAMES[n].length, DRAWINGS, `${n}: exactly four drawings, the same beat for every move`);
    for (const [p, face] of FRAMES[n]){ assert.ok(p >= 0 && p <= 1, `${n}: p in range`); assert.ok(FACES[face], `${n}: ${face} is a face`); }
  }
  /* he holds one drawing for a moment, then jumps to the next, and the set repeats */
  assert.equal(frameAt('reach', 0).i, 0); assert.equal(frameAt('reach', 0.1).i, 0, 'still the first drawing');
  assert.equal(frameAt('reach', 0.25).i, 1, 'then the next');
  assert.equal(frameAt('reach', 4 / MOTION.fps + 0.01).i, 0, 'and round again');
});

test('the card slides in from the side and back out, and is in place in between', () => {
  const xs = [];
  const track = (age, left) => { const c = fakeCanvas(), calls = []; const orig = c; const p = new Proxy({}, { get: (_, k) => k === 'translate' ? (x) => { calls.push(x); } : orig[k], set: () => true }); figureCard(p, 1600, 900, 'jump', 1, { age, left }); return calls[0]; };
  const home = track(5, 5), starting = track(0, 5), ending = track(5, 0.05);
  assert.ok(Math.abs(starting - home) > 100, 'starts off to the side'); assert.ok(Math.abs(ending - home) > 100, 'leaves to the same side');
  assert.ok(track(MOTION.slideIn, 5) - home < 1, 'in place by the end of the slide');
  assert.ok(MOTION.slideIn <= 0.6, 'quick enough to start the move in time');
});

test('every face draws on every pose', () => {
  for (const f of FACE_NAMES) for (const n of POSE_NAMES){ const c = fakeCanvas(); drawCard(c, n, 300, 500, 400, 1.3, 1, f); assert.ok(c.calls.includes('fill'), `${f} on ${n}`); }
});

test('the card is the block-limb Cubo, and he shows the move with arrows beside his stretched arms', () => {
  /* freeze holds his arms straight out: the card has the arrows; march does not stretch his arms: it has none */
  const n = (pose) => { const c = fakeCanvas(); drawCard(c, pose, 300, 500, 400, 0.3); return c.calls.filter(x => x === 'closePath').length; };
  assert.ok(n('freeze') > n('march'), 'freeze shows arrows on its card');
  assert.ok(n('reach') > n('march'), 'reach shows arrows on its card');
});

test('march lifts the left knee and then the right', () => {
  const left = POSES.march(0.5).legs, right = POSES.march(1).legs, down = POSES.march(0).legs;
  assert.ok(left[0][1][1] < down[0][1][1] && left[1][1][1] === down[1][1][1], 'left foot up');
  assert.ok(right[1][1][1] < down[1][1][1] && right[0][1][1] === down[0][1][1], 'right foot up');
});

test('the games that teach a move say which card to show, and it is one of the cards we have', async () => {
  const { GAMES } = await import('../src/games/index.js');
  const wants = ['animal-gym', 'pop-party', 'stack-it-high', 'keep-it-up', 'leaf-pile', 'ptero-flight', 'sky-painter', 'sleepy-bear'];
  for (const id of wants){
    const g = GAMES.find(x => x.id === id); assert.ok(g, `${id} exists`);
    const i = g.create(1); assert.equal(typeof i.card, 'function', `${id} has a card()`);
    const first = i.card(); assert.ok(first === null || POSE_NAMES.includes(first), `${id}: ${first} is a card`);
    if (id !== 'leaf-pile') assert.ok(first !== null, `${id} shows a card at the start`);   /* (leaf pile waits for its jump) */
    i.t = 30; i.say = { text: '', t: 30 }; const later = i.card(); assert.ok(later === null || POSE_NAMES.includes(later), `${id}: later card is a card`);
  }
});
