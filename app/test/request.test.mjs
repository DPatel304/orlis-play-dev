import test from 'node:test';
import assert from 'node:assert/strict';
import { sentence, changeSentence, ACTIONS, TWISTS, CHIPS, LOOKS } from '../src/ui/request.js';
import { sentence as serverSentence, tidy, ACTIONS as SA, TWISTS as ST, CHIPS as SC, LOOKS as SL } from '../../server/src/requests.js';

const fireflies = { start: 'new', view: 'hands', action: 'catch', thing: 'fireflies', place: 'a meadow at night', twists: ['faster', 'golden'], ages: '4-6', energy: 'calm', minutes: 5, players: 2, words: '' };

test('the sentence they see as they pick is the one the owner gets', () => {
  assert.equal(sentence(fireflies), 'A first-person catch game: you catch fireflies as they fall or fly by in a meadow at night. It gets a little faster as it goes; a golden one now and then, worth extra. For ages 4 to 6, calm, about 5 minutes, one or two players.');
  for (const action of Object.keys(ACTIONS)) for (const view of ['hands', 'character']) for (const players of [1, 2]){
    const r = { ...fireflies, action, view, players, twists: ['story'] };
    assert.equal(sentence(r), serverSentence(tidy(r)), `${action} ${view} ${players}`);
  }
  const like = { ...fireflies, start: 'like', like: 'pop-party', action: null, thing: 'snowflakes', place: '' };
  assert.equal(sentence(like, { likeName: 'Pop Party' }), serverSentence(tidy(like), { likeName: 'Pop Party' }));
  assert.match(sentence(like, { likeName: 'Pop Party' }), /^Like Pop Party, but with snowflakes\./);
});

test('the same choices as the server, so nothing picked is turned away', () => {
  assert.deepEqual(Object.keys(ACTIONS), Object.keys(SA));
  assert.deepEqual(Object.keys(TWISTS), Object.keys(ST));
  assert.deepEqual(Object.keys(CHIPS), Object.keys(SC));
  assert.deepEqual(LOOKS, SL);
  assert.equal(changeSentence('Firefly Jar', ['slower'], ''), 'A change to Firefly Jar: make it slower.');
});

test('the look is in the sentence, the same on both sides, and only a known one is kept', () => {
  const r = { ...fireflies, look: 'night' };
  assert.match(sentence(r), /The look: a starry night\.$/);
  assert.equal(sentence(r), serverSentence(tidy(r)));
  assert.equal(tidy({ ...fireflies, look: 'nonsense' }).look, null);
  assert.ok(!/The look/.test(sentence(fireflies)), 'no look picked: nothing said');
});
