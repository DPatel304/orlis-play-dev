/* A1 (decision 0042): the one cube character, old looks carried over, and U8: the avatar's colour is the player colour. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, CUBO, FAVS, normalizeLook, fromOld, nearestFav, storable, surprise, isPaletteName } from '../src/ui/look.js';
import { body, head, portrait, figure, cuboFigure } from '../src/ui/avatar-art.js';
import { makeCrew, GENERIC } from '../src/ui/crew.js';
import { resolveColours, setPlayerColours } from '../src/tracking/player-colours.js';
import { PLAYER_COLORS, DEFAULT_PLAYER_FAVS } from '../src/tracking/pose-shared.js';
import { PALETTE } from '../src/games/assets/palette.js';

const OLD = { skin: '#f3c393', hair: 'ponytail', hairColor: '#5a3825', eyes: 'sparkle', mouth: 'oh', color: '#ff5d8f', outfit: 'stars', extra: 'glasses' };

/* ---- looks ---- */
test('a look is names, not codes: the parts are palette favourites and palette names', () => {
  assert.deepEqual(PARTS.colour, Object.keys(PALETTE.fav));
  for (const n of PARTS.outfitColour) assert.ok(isPaletteName(n), n);
  assert.ok(!isPaletteName('#ffffff')); assert.ok(!isPaletteName('touch.nope')); assert.ok(!isPaletteName('fav.sky.shade'));
});

test('Guest and a profile with no look are Cubo: the blue one, the default face', () => {
  for (const v of [null, undefined, 'x', 3, []]){
    const l = normalizeLook(v);
    assert.equal(l.colour, 'sky'); assert.deepEqual(l.face, { eyes: 'dot', mouth: 'smile' }); assert.equal(l.top, 'none'); assert.equal(l.outfit, 'plain'); assert.equal(l.extra, 'none');
  }
  assert.deepEqual(normalizeLook(null), CUBO);
});

test('an old look is carried over: its favourite colour, the nearest face, a hair piece for its hair', () => {
  const l = normalizeLook(OLD);
  assert.equal(l.colour, 'pink', 'its favourite colour, by name');
  assert.deepEqual(l.face, { eyes: 'star', mouth: 'o' }, 'sparkly eyes -> stars, "oh" -> o');
  assert.equal(l.top, 'tuft', 'a ponytail becomes a tuft');
  assert.equal(l.outfit, 'stars'); assert.equal(l.extra, 'glasses');
  assert.equal(normalizeLook({ ...OLD, outfit: 'hoodie' }).outfit, 'plain', 'an old hoodie keeps all their colour');
  assert.equal(normalizeLook({ ...OLD, hair: 'long' }).top, 'bob');
  assert.equal(normalizeLook({ ...OLD, hair: 'bob' }).top, 'bob');
  assert.equal(normalizeLook({ ...OLD, hair: 'curly' }).top, 'tuft');
  assert.equal(normalizeLook({ ...OLD, hair: 'none', extra: 'none' }).top, 'none', 'no hair, no hair piece');
  assert.equal(normalizeLook({ ...OLD, hair: 'none', extra: 'crown' }).top, 'crown', 'a hat from the old extra is the topper');
  assert.equal(normalizeLook({ ...OLD, hair: 'none', extra: 'headphones' }).top, 'phones');
  assert.equal(normalizeLook({ ...OLD, hair: 'short', extra: 'cap' }).top, 'cap', 'a hat wins over hair');
  assert.equal(normalizeLook({ ...OLD, hair: 'long', extra: 'glasses' }).top, 'bob', 'glasses are not a hat: the hair stays');
});

test('every old face, colour and outfit lands on a valid new one', () => {
  for (const eyes of ['dots', 'happy', 'sparkle', 'wink']) for (const mouth of ['smile', 'grin', 'oh', 'tongue']){
    const l = fromOld({ ...OLD, eyes, mouth });
    assert.ok(PARTS.eyes.includes(l.face.eyes) && PARTS.mouth.includes(l.face.mouth), `${eyes}/${mouth}`);
  }
  for (const hex of ['#3da9ff', '#ff8a3d', '#22c55e', '#a855f7', '#ff5d8f', '#facc15', '#14b8a6', '#ef4444'])
    assert.equal(PALETTE.fav[normalizeLook({ ...OLD, color: hex }).colour], hex, 'an exact favourite keeps its name');
  /* the old player colours (and any code) land on the nearest favourite */
  assert.equal(nearestFav('#3fcf7f'), 'green'); assert.equal(nearestFav('#c46bff'), 'purple'); assert.equal(nearestFav('#ff0000'), 'red');
  assert.equal(nearestFav('#0000ff'), 'sky'); assert.equal(nearestFav('nonsense'), 'sky');
  assert.equal(normalizeLook({ color: '#3fcf7f' }).colour, 'green');
});

test('a current look is kept, a damaged one is mended, and what is stored is plain and current', () => {
  const NEW = { colour: 'teal', face: { eyes: 'wink', mouth: 'cat' }, top: 'beanie', outfit: 'hoodie', outfitColour: 'ui.go', extra: 'scarf' };
  assert.deepEqual(normalizeLook(NEW), NEW);
  const mended = normalizeLook({ colour: 'mauve', face: { eyes: 'x' }, top: 'wizard', outfit: 5, outfitColour: '#fff', extra: 'jetpack' });
  assert.deepEqual(mended, CUBO);
  assert.deepEqual(storable(OLD), normalizeLook(OLD));
  assert.deepEqual(storable(storable(OLD)), storable(OLD), 'carrying over twice changes nothing');
  assert.deepEqual(storable(null), CUBO);
});

test('Surprise me makes whole, valid looks', () => {
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++){ const l = surprise(r); assert.deepEqual(normalizeLook(l), l); }
});

/* ---- the drawing ---- */
const fakeCtx = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get(t, k){ if (k in t) return t[k]; if (k === 'calls') return calls; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} }); return (...a) => { calls.push(k); }; },
    set(t, k, v){ t[k] = v; return true; }
  });
  return ctx;
};
test('the character draws for every look, old, new and none, in every pose, without a raw colour of its own', () => {
  for (const look of [null, OLD, GENERIC[0], GENERIC[3], surprise(), ...PARTS.top.map(top => ({ ...CUBO, top })), ...PARTS.outfit.map(outfit => ({ ...CUBO, outfit, outfitColour: 'ui.gold' })), ...PARTS.extra.map(extra => ({ ...CUBO, extra }))]){
    for (const pose of ['stand', 'wave', 'cheer', 'reach']){ const c = fakeCtx(); body(c, 100, 200, 180, look, 1.2, pose); assert.ok(c.calls.length > 20, pose); }
    const c = fakeCtx(); head(c, 50, 50, 30, look, 0); head(c, 50, 50, 30, look, 0, { back: true }); portrait(c, 50, 50, 60, look, 0);
    assert.ok(c.calls.length > 20);
  }
});

test('arrows show only when he shows a move to copy, and only beside a stretched-out arm', () => {
  const n = (pose, arrows) => { const c = fakeCtx(); cuboFigure(c, 100, 200, 180, pose, 0.3, null, { arrows }); return c.calls.length; };
  for (const pose of ['freeze', 'jump', 'cheer', 'reach']) assert.ok(n(pose, true) > n(pose, false), `${pose} shows arrows when asked`);
  for (const pose of ['stand', 'march', 'squat']) assert.equal(n(pose, true), n(pose, false), `${pose} has none to show`);
});

test('a camera player is drawn as the character over their body', () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  Object.assign(lm[11], { x: 0.45, y: 0.35 }); Object.assign(lm[12], { x: 0.55, y: 0.35 }); Object.assign(lm[23], { x: 0.46, y: 0.6 }); Object.assign(lm[24], { x: 0.54, y: 0.6 });
  Object.assign(lm[0], { x: 0.5, y: 0.2 });
  for (const look of [null, OLD, GENERIC[1]]){ const c = fakeCtx(); figure(c, lm, 1920, 1080, look, 0.5, { lift: 10 }); assert.ok(c.calls.length > 20); }
  const c = fakeCtx(); figure(c, null, 1920, 1080, null); assert.equal(c.calls.length, 0, 'nobody, nothing');
});

/* ---- U8: the avatar colour is the player colour ---- */
const A = (c) => ({ colour: c });
test('different favourites keep their own colours, wherever they stand', () => {
  assert.deepEqual(resolveColours(['pink', 'teal', 'red', 'yellow']), ['pink', 'teal', 'red', 'yellow']);
  assert.deepEqual(resolveColours(['red', null, 'sky', 'orange']).filter((_, i) => i !== 1), ['red', 'sky', 'orange']);
});

test('a clash: the second child gets the nearest free favourite, the first keeps theirs', () => {
  const r = resolveColours(['green', 'green']);
  assert.equal(r[0], 'green'); assert.notEqual(r[1], 'green');
  assert.equal(r[1], 'teal', 'the nearest to green is teal');
  assert.equal(new Set(resolveColours(['sky', 'sky', 'sky', 'sky'])).size, 4, 'four of one all differ');
  /* a free colour that a later child wants is not taken from them */
  const r2 = resolveColours(['green', 'green', 'teal']);
  assert.deepEqual(r2.slice(0, 1).concat(r2[2]), ['green', 'teal']); assert.notEqual(r2[1], 'teal'); assert.notEqual(r2[1], 'green');
});

test('a guest gets the next free favourite, never one somebody has', () => {
  const r = resolveColours(['sky', null, null, 'green']);
  assert.equal(r[0], 'sky'); assert.equal(r[3], 'green');
  assert.ok(!['sky', 'green'].includes(r[1])); assert.ok(!['sky', 'green'].includes(r[2])); assert.notEqual(r[1], r[2]);
  assert.deepEqual(resolveColours([null, null, null, null]), DEFAULT_PLAYER_FAVS, 'with nobody known, the usual four');
  assert.ok(resolveColours([]).every(n => FAVS.includes(n)));
});

test('setPlayerColours fills PLAYER_COLORS in place, so every game that reads it follows', () => {
  const same = PLAYER_COLORS;
  setPlayerColours(['pink', 'pink', 'yellow', null]);
  assert.equal(PLAYER_COLORS, same, 'one array, filled in place');
  assert.equal(PLAYER_COLORS[0], PALETTE.fav.pink); assert.notEqual(PLAYER_COLORS[1], PALETTE.fav.pink); assert.equal(PLAYER_COLORS[2], PALETTE.fav.yellow);
  assert.equal(new Set(PLAYER_COLORS).size, 4);
  setPlayerColours([]);
  assert.deepEqual(PLAYER_COLORS, DEFAULT_PLAYER_FAVS.map(n => PALETTE.fav[n]));
});

test('the crew knows who is playing: each child\'s avatar colour is their player colour, a guest gets a free one', () => {
  const c = makeCrew();
  c.personal = true;
  c.profiles = [{ id: 'ellie', name: 'Ellie', look: A('pink') }, { id: 'sam', name: 'Sam', look: A('teal') }, { id: 'ava', name: 'Ava', look: OLD }, { id: 'max', name: 'Max', look: null }];
  c.set(0, 'sam'); c.set(1, 'ellie'); c.set(2, 'ava');
  const n = c.colourNames();
  assert.equal(n[0], 'teal'); assert.equal(n[1], 'pink');
  assert.notEqual(n[2], 'pink', 'Ava also loves pink: the second one gets another');
  assert.ok(!['teal', 'pink'].includes(n[3]), 'the empty place is a guest and gets a free one');
  assert.equal(c.colorOf(0), PALETTE.fav.teal);
  c.set(3, 'max');                                        /* no look: Cubo, sky */
  assert.equal(c.colourNames()[3], 'sky');
  assert.equal(c.lookOf(3).colour, 'sky');
  assert.equal(c.lookOf(2).colour, c.colourNames()[2], 'a child who clashed is drawn in the colour they play in'); assert.equal(c.lookOf(2).top, 'tuft', 'the rest of their look is theirs'); const g = makeCrew(); g.personal = true; assert.equal(g.lookOf(1).colour, 'orange', 'a guest is Cubo in a free colour');
  assert.equal(c.lookOf(0).colour, 'teal');
});

test('while making avatars is off, the four generic characters have the four usual colours', () => {
  const c = makeCrew();
  assert.deepEqual(c.colourNames(), DEFAULT_PLAYER_FAVS);
  assert.deepEqual(GENERIC.map(g => normalizeLook(g).colour), DEFAULT_PLAYER_FAVS);
});
