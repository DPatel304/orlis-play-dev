/* The master palette (decision 0040): valid colours, stable names, the page and the code agree, touchables stay the brightest. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE, WORLDS, color, unknownColors } from '../src/games/assets/palette.js';
import { assets } from '../src/games/assets/index.js';

const HEX = /^#[0-9a-f]{6}$/;
/* how vivid a colour is: the spread between its strongest and weakest channel (pastels and darks score low) */
const sat = (h) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return Math.max(r, g, b) - Math.min(r, g, b); };

test('every palette colour is a lowercase six-digit code', () => {
  for (const [g, set] of Object.entries(PALETTE)) for (const [k, v] of Object.entries(set)) assert.match(v, HEX, `${g}.${k}`);
});

test('colours are asked for by name, and an unknown name gives a calm colour and is noted', () => {
  assert.equal(color('touch.mint'), PALETTE.touch.mint);
  assert.equal(assets.color('night.sky'), PALETTE.night.sky);
  const v = color('touch.nope');
  assert.ok(unknownColors.has('touch.nope'));
  assert.ok(sat(v) < 0.5, 'the fallback is not a bright colour');
});

test('each Phase 1 world is made of palette groups', () => {
  assert.deepEqual(Object.keys(WORLDS).sort(), ['meadow', 'night', 'sea', 'space']);
  for (const groups of Object.values(WORLDS)) for (const g of groups) assert.ok(PALETTE[g], g);
});

test('touchables are more vivid than any scenery colour', () => {
  /* the warm accents (clay, brick) come close; they are kept to small props (a pot, a roof), never large areas */
  const SMALL_ACCENTS = ['earth.clay', 'earth.brick', 'space.planet'];
  const minTouch = Math.min(...Object.values(PALETTE.touch).map(sat));
  for (const g of ['sky', 'meadow', 'earth', 'night', 'space', 'sea'])
    for (const [k, v] of Object.entries(PALETTE[g])) if (!SMALL_ACCENTS.includes(`${g}.${k}`)) assert.ok(sat(v) < minTouch, `${g}.${k} (${v}) is as vivid as a touchable`);
});

test('the palette page shows the same touchable and favourite colours', () => {
  const page = readFileSync(new URL('../../docs/palette.html', import.meta.url), 'utf8');
  for (const v of [...Object.values(PALETTE.touch), ...Object.values(PALETTE.fav)]) assert.ok(page.includes(v), v);
});
