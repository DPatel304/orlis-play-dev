import test from 'node:test';
import assert from 'node:assert/strict';
import { hudZones, underHud, clearOf, badge, hud, sayBubble, spoken, PANEL_ROWS, scorePill, chip, statusBar, BAR_COLORS } from '../src/games/hud.js';
import { COLS, ROWS, SLOTS, gridOf, block, cell } from '../src/games/grid.js';

const overlap = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

test('the shell\'s areas never overlap each other, on a wide screen or a squarer one', () => {
  for (const [W, H] of [[1920, 1080], [1280, 720], [1024, 768], [800, 600]]){
    const z = hudZones(W, H), names = Object.keys(z);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
      assert.ok(!overlap(z[names[i]], z[names[j]]), `${names[i]} and ${names[j]} at ${W}x${H}`);
    for (const n of names){ const r = z[n]; assert.ok(r.x >= -1 && r.y >= -1 && r.x + r.w <= W + 1 && r.y + r.h <= H + 1, `${n} stays on screen at ${W}x${H}`); }
  }
});

test('the first words of a round arrive big and dock; later words do not', () => {
  const calls = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 100 }) : (...a) => { calls.push([k, a]); }, set: () => true });
  const scaleAt = (text, t) => { calls.length = 0; sayBubble(c, 1600, 900, { text, t }); const s = calls.find(x => x[0] === 'scale'); return s ? s[1][0] : null; };
  hud.quiet = false; hud.introText = null;
  const big = scaleAt('Pop them!', 1.0), docked = scaleAt('Pop them!', 3.5);
  assert.ok(big > 1.5, 'big at first'); assert.ok(docked <= 1.001, 'small once docked'); assert.ok(scaleAt('A second ball!', 1.0) <= 1.001, 'later words are never big');
  hud.introText = null;
});

test('underHud says where a target must not go', () => {
  const W = 1600, H = 900, pt = (name, fx = 0.5, fy = 0.5) => { const r = hudZones(W, H)[name]; return [r.x + r.w * fx, r.y + r.h * fy]; };
  assert.ok(underHud(W, H, ...pt('top')), 'under the goal bar and words');
  assert.ok(underHud(W, H, ...pt('clock')), 'under the clock');
  assert.ok(underHud(W, H, ...pt('score')), 'under the corner');
  assert.ok(underHud(W, H, ...pt('card')), 'under the move card');
  assert.ok(underHud(W, H, ...pt('badge')), 'under the badge');
  assert.ok(!underHud(W, H, 800, 600), 'the middle of the screen is the game\'s');
});

test('the badge draws a pill, and nothing on the results screen or with nothing to say', () => {
  const calls = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls.push(k); }, set: () => true });
  hud.quiet = false; badge(c, 1600, 900, { icon: 'sparkles', value: 3 });
  assert.ok(calls.includes('roundRect') && calls.includes('fillText'), 'a pill with its number');
  calls.length = 0; badge(c, 1600, 900, {}); assert.equal(calls.length, 0, 'nothing to say, nothing drawn');
  hud.quiet = true; badge(c, 1600, 900, { value: 3 }); assert.equal(calls.length, 0, 'quiet: no badge'); hud.quiet = false;
});

test('the grid: square cells that fit, the same pieces in the same cells, at any screen shape', () => {
  for (const [W, H] of [[1920, 1080], [1280, 720], [1024, 768], [800, 600], [2560, 1080]]){
    const { C, s } = gridOf(W, H);
    assert.ok(COLS * C <= W - 2 * s + 0.01 && (ROWS) * C <= H - 2 * s + 0.01, `${COLS} x ${ROWS} cells fit at ${W}x${H}`);
    for (const [name, spec] of Object.entries(SLOTS)){ const b = block(W, H, ...spec); assert.ok(b.x >= -0.01 && b.y >= -0.01 && b.x + b.w <= W + 0.01 && b.y + b.h <= H + 0.01, `${name} is on screen at ${W}x${H}`); }
    const clock = block(W, H, ...SLOTS.clock); assert.ok(Math.abs(clock.x + clock.w - (W - s)) < 1, `the clock ends at the right margin at ${W}x${H}`);
    const goal = block(W, H, ...SLOTS.goal); assert.ok(Math.abs(goal.x + goal.w / 2 - W / 2) < 1 && goal.y < clock.y + 1, `the goal bar is in the top row, in the middle at ${W}x${H}`);
    const card = block(W, H, ...SLOTS.card); assert.ok(Math.abs(card.x - (s + C)) < 1, `the card hangs from the left edge at ${W}x${H}`); assert.ok(Math.abs(H - s - card.y - card.h - C) < 1, `the card sits above the bottom row at ${W}x${H}`);
    const first = cell(W, H, 1, 0), last = cell(W, H, 1, 3);
    assert.ok(last.y + last.h < block(W, H, 0, 4).y + 1, `the corner's four rows stay in the top band at ${W}x${H}`);
    assert.ok(first.x + first.w * 6 < goal.x, `the scores' row leaves the goal bar alone at ${W}x${H}`);
  }
});

test('the three pieces draw, and bars only use the allowed colours', () => {
  const calls = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 30 }) : (...a) => { calls.push(k); }, set: () => true });
  scorePill(c, 10, 10, 50, '#3da9ff', 7, 0.5); chip(c, 10, 70, 50, { icon: 'gem', value: 12 }); statusBar(c, 10, 130, 50, { icon: 'glowstar', fill: 0.6, color: 'rose' });
  assert.ok(calls.filter(x => x === 'roundRect').length >= 5 && calls.includes('fillText'), 'pill, chip and bar all draw');
  const taken = ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff', '#ff7a59'];
  for (const col of Object.values(BAR_COLORS)) assert.ok(!taken.includes(col), `${col} is not a player colour or the arrow orange`);
});

test('the first words of a round are said once, without their pictures', () => {
  assert.equal(spoken('\u{1F388} Pop the balloons!'), 'Pop the balloons!');
  assert.equal(spoken('\u{1F992} Stretch up tall!'), 'Stretch up tall!');
  const said = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 100 }) : () => {}, set: () => true });
  hud.quiet = false; hud.introText = null; hud.spoken = false; hud.speak = (t) => said.push(t);
  sayBubble(c, 1600, 900, { icon: 'volleyball', text: 'Keep it up!', t: 0 });            /* not yet: the game hasn't started */
  assert.equal(said.length, 0);
  sayBubble(c, 1600, 900, { icon: 'volleyball', text: 'Keep it up!', t: 0.3 }); sayBubble(c, 1600, 900, { icon: 'volleyball', text: 'Keep it up!', t: 0.6 });
  sayBubble(c, 1600, 900, { text: '3 in a row!', t: 0.3 });
  assert.deepEqual(said, ['Keep it up!'], 'said once, and later words are not said');
  hud.speak = null; hud.introText = null; hud.spoken = false;
});

test('every game\'s first words are short: a painted icon from the library and at most four words, with no emoji', async () => {
  const { GAMES } = await import('../src/games/index.js'); const { assets } = await import('../src/games/assets/index.js');
  for (const g of GAMES){ if (g.id === 'last-known-position' || g.id === 'castle-defense' || g.id === 'sky-painter' || g.id === 'story-player') continue;
    const i = g.create(1), t = i.say && i.say.text; if (!t) continue;
    const words = spoken(t).split(' ').filter(Boolean); assert.ok(words.length <= 4, `${g.id}: "${t}" is ${words.length} words`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), `${g.id}: "${t}" has no emoji in it`);
    assert.ok(i.say.icon && assets.has(i.say.icon), `${g.id}: its first words carry a library icon (${i.say.icon})`); }
});

test('clearOf: how low the top of the shell reaches at an x, so a ball or block kept under it is never behind a clock, words or score chip', () => {
  for (const [W, H] of [[1920, 1080], [1280, 720]]){
    const z = hudZones(W, H);
    /* in the middle: under the goal bar and the words; at the right: under the clock; at the left: under the scores; elsewhere: nothing */
    assert.ok(Math.abs(clearOf(W, H, 0.5) - ((z.top.y + z.top.h) / H + 0.04)) < 1e-9);
    assert.ok(clearOf(W, H, 0.95) >= (z.clock.y + z.clock.h) / H);
    assert.ok(clearOf(W, H, 0.1) > 0.2 && clearOf(W, H, 0.1) < 0.3, 'the second row of chips, no lower');
    assert.equal(clearOf(W, H, 0.7), 0);
    for (const x of [0.1, 0.3, 0.5, 0.95]) assert.ok(!underHud(W, H, x * W, clearOf(W, H, x) * H + 1) || x < 0.35 && clearOf(W, H, x) * H + 1 < z.score.y + z.score.h, `x ${x}`);
  }
});
