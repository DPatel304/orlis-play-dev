/* The master palette (decision 0040): valid colours, stable names, the page and the code agree, touchables stay the brightest. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE, WORLDS, TONES, tone, color, unknownColors } from '../src/games/assets/palette.js';
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

/* ---- shade and highlight by rule (decision 0041) ---- */
const rgbOf = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luma = (h) => { const [r, g, b] = rgbOf(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const lab = (c) => { const [r, g, b] = c.map(lin); const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(...p.map((v, i) => v - q[i])); };
const over = (base, top, a) => base.map((v, i) => v * (1 - a) + top[i] * a);

test('every palette colour has a valid shade and light, darker and lighter than the base', () => {
  for (const [g, set] of Object.entries(PALETTE)) for (const [k, v] of Object.entries(set)) {
    const s = color(`${g}.${k}`, 'shade'), l = color(`${g}.${k}`, 'light');
    assert.match(s, HEX, `${g}.${k} shade`); assert.match(l, HEX, `${g}.${k} light`);
    assert.equal(color(`${g}.${k}.shade`), s); assert.equal(assets.color(`${g}.${k}`, 'light'), l);
    if (v !== '#ffffff') assert.ok(luma(l) > luma(v), `${g}.${k} light is lighter`);
    /* a colour already darker than the shadow purple-grey (the inks, the night shades) can only move toward it */
    if (luma(v) > luma(PALETTE.shade.shadow)) assert.ok(luma(s) < luma(v), `${g}.${k} shade is darker`);
  }
  assert.equal(color('touch.mint'), PALETTE.touch.mint);
  assert.ok(TONES.shade > 0 && TONES.light > 0 && tone('#123456', 'x') === '#123456');
});

test("the rule's shade and highlight are close to Pop Party's own for the eight touchables", () => {
  /* Pop Party paints its shade as the shadow purple-grey at 20% over the balloon and its highlight as white at 80% (pop-party.js _balloon) */
  const S = rgbOf(PALETTE.shade.shadow), W = [255, 255, 255];
  const worst = { shade: 0, light: 0 }, sum = { shade: 0, light: 0 };
  for (const [k, v] of Object.entries(PALETTE.touch)) {
    const b = rgbOf(v);
    const ds = dE(rgbOf(color(`touch.${k}`, 'shade')), over(b, S, 0.2)), dl = dE(rgbOf(color(`touch.${k}`, 'light')), over(b, W, 0.8));
    worst.shade = Math.max(worst.shade, ds); worst.light = Math.max(worst.light, dl); sum.shade += ds; sum.light += dl;
  }
  /* tuned values give a worst of about 2.7 (shade) and 3.5 (light) delta E, and an average under 2.3; the bar is 5 for each, 3 on average */
  assert.ok(worst.shade < 5 && worst.light < 5, JSON.stringify(worst));
  assert.ok(sum.shade / 8 < 3 && sum.light / 8 < 3, JSON.stringify(sum));
});
