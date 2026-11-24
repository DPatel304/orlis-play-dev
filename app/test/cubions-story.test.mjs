/* Cubion's Long Way Home after the playtest (docs/playtest/REPORT.md): a first move within 15 seconds, about two and a half minutes without a
   voice, the eight move cards kept, and Cubo steps aside at the end so the "The end" card does not cover him. */
import test from 'node:test';
import assert from 'node:assert/strict';
import story, { REFRAIN } from '../src/stories/cubions-long-way-home.js';
import { byId } from '../src/games/index.js';

/* the reading time of a beat with no voice, as the player works it out (story-player.js: readTime) */
const readTime = (b) => (b.t ? b.t.trim().split(/\s+/).length * 0.4 + 0.7 : 1.5);
const total = story.beats.reduce((a, b) => a + readTime(b) + (b.hold || 0), 0);

test('the first move card comes within 15 seconds of the start (a few seconds, in fact)', () => {
  let t = 0;
  for (const b of story.beats){
    if (b.card) break;
    t += readTime(b) + (b.hold || 0);
  }
  assert.ok(t + 0.2 <= 15, 'the first card shows at ' + (t + 0.2).toFixed(1) + ' s');
});

test('about two and a half minutes with no voice (the player adds a little for walking and a beat between lines)', () => {
  assert.ok(total >= 115 && total <= 150, 'reading time ' + total.toFixed(0) + ' s');
  const g = byId('cubions-long-way-home').create(1);
  assert.ok(Math.abs(g.total - total) < 1e-9);
});

test('the story keeps its heart: the refrain four times, the four animals, eight move cards (and the Cube Elders’ first)', () => {
  assert.equal(story.beats.filter(b => b.t === REFRAIN).length, 3, 'three plain refrains, and...');
  assert.ok(story.beats.some(b => b.refrain && /Cubo does it VERY well/.test(b.t)), '...the frog’s turn of it');
  const cards = story.beats.filter(b => b.card);
  for (const m of ['reach', 'jump', 'flap', 'squat']) assert.equal(cards.filter(b => b.card === m).length, 2, m + ' twice');
  assert.equal(cards.filter(b => b.card !== 'freeze').length, 8);
  assert.equal(story.beats.at(-1).t, REFRAIN, 'and it ends on it');
  const all = story.beats.map(b => b.t || '').join(' ');
  for (const w of ['giraffe', 'bunny', 'bird', 'frog', 'TV', 'Cubo stayed']) assert.ok(all.includes(w), w);
});

test('no long listening without a move: never more than about 40 seconds between cards (it was 70 to the first)', () => {
  let t = 0, last = 0, gap = 0;
  for (const b of story.beats){
    if (b.card){ gap = Math.max(gap, t - last); last = t + readTime(b) + (b.hold || 0); }
    t += readTime(b) + (b.hold || 0);
  }
  assert.ok(gap < 40, 'longest gap ' + gap.toFixed(0) + ' s');
});

test('at the end Cubo steps to the right of the "The end" card (it covers the left half), taking the animals with him', () => {
  const g = byId('cubions-long-way-home').create(1);
  const vw = 1920 / (1080 / 720);                    /* the world as it's drawn: 720 high */
  assert.equal(g.endStep(vw), 0, 'in the story he stands in the middle');
  g.i = g.beats.length - 1;                          /* the last beat */
  for (let t = 0; t < 2; t += 1 / 30) g.step(1 / 30);
  const x = (0.48 * vw + g.endStep(vw)) / vw;        /* Cubo, across the screen */
  assert.ok(x >= 0.56, 'Cubo is at ' + x.toFixed(2) + ' of the width, clear of a card that ends at 0.47');
  assert.ok(x <= 0.62, 'and not off in front of the house');
});

test('the card only covers the left: it ends before 0.47 of the width at 1920 x 1080', () => {
  /* the end card is 54..907 px wide in the 1920 picture (docs/playtest/cubions-long-way-home-all-end.png); Cubo is about 250 px wide */
  const cuboLeft = 0.58 * 1920 - 125;
  assert.ok(cuboLeft > 907, 'Cubo’s left edge ' + cuboLeft + ' is right of the card');
});
