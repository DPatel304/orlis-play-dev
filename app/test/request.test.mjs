import test from 'node:test';
import assert from 'node:assert/strict';
import { sentence, changeSentence, ACTIONS, CHIPS, LOOKS, ideas, nameIdeas, NAME_MAX, SHORT, LONG } from '../src/ui/request.js';
import { sentence as serverSentence, tidy, ACTIONS as SA, CHIPS as SC, LOOKS as SL, LIMITS } from '../../server/src/requests.js';

const fireflies = { start: 'new', view: 'hands', action: 'pop', thing: 'bubbles', place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: 3, players: 2, words: '' };

test('the sentence they see as they pick is the one the owner gets', () => {
  assert.equal(sentence(fireflies), 'A first-person pop game: you pop bubbles by touching them. For ages 4 to 6, bouncy, about 3 minutes, one or two players.');
  for (const action of Object.keys(ACTIONS)) for (const minutes of [SHORT, LONG]){
    const r = { ...fireflies, action, minutes };
    assert.equal(sentence(r), serverSentence(tidy(r)), `${action} ${minutes}`);
  }
  const like = { ...fireflies, start: 'like', like: 'pop-party', action: null, thing: 'snowflakes' };
  assert.equal(sentence(like, { likeName: 'Pop Party' }), serverSentence(tidy(like), { likeName: 'Pop Party' }));
  assert.match(sentence(like, { likeName: 'Pop Party' }), /^Like Pop Party, but with snowflakes\./);
});

test('only four things to make for now, and the server understands every one', () => {
  assert.deepEqual(Object.keys(ACTIONS), ['pop', 'steer', 'copy', 'paint']);
  for (const k of Object.keys(ACTIONS)) assert.ok(SA[k], k);
  assert.deepEqual(Object.keys(CHIPS), Object.keys(SC));
  assert.deepEqual(LOOKS, SL);
  assert.equal(changeSentence('Firefly Jar', ['slower'], ''), 'A change to Firefly Jar: make it slower.');
});

test('short is 3 minutes and long is 10, and the server keeps both', () => {
  assert.equal(SHORT, 3); assert.equal(LONG, 10);
  assert.equal(tidy({ ...fireflies, minutes: SHORT }).minutes, 3);
  assert.equal(tidy({ ...fireflies, minutes: LONG }).minutes, 10);
});

test('suggestions come three at a time and a refresh brings the next three', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.deepEqual(ideas(pool, 0), ['a', 'b', 'c']);
  assert.deepEqual(ideas(pool, 1), ['d', 'e', 'f']);
  assert.deepEqual(ideas(pool, 2), ['g', 'a', 'b'], 'wraps round');
  assert.deepEqual(ideas(['x', 'y'], 0), ['x', 'y']);
  for (const a of Object.values(ACTIONS)) assert.ok(a.things.length >= 9, 'enough for three rounds');
});

test('a name fits its card: the same limit in the app and on the server, and no idea runs over', () => {
  assert.equal(NAME_MAX, LIMITS.name);
  assert.equal(tidy({ ...fireflies, name: 'x'.repeat(60) }).name.length, NAME_MAX);
  for (const [action, a] of Object.entries(ACTIONS)) for (const thing of a.things){
    const names = nameIdeas({ action, thing });
    assert.ok(names.length >= 6, `${action} ${thing}`);
    for (const n of names) assert.ok(n.length <= NAME_MAX, `${n} is ${n.length}`);
  }
});

test('the look is in the sentence, the same on both sides, and only a known one is kept', () => {
  const r = { ...fireflies, look: 'night' };
  assert.match(sentence(r), /The look: a starry night\.$/);
  assert.equal(sentence(r), serverSentence(tidy(r)));
  assert.equal(tidy({ ...fireflies, look: 'nonsense' }).look, null);
  assert.ok(!/The look/.test(sentence(fireflies)), 'no look picked: nothing said');
});
