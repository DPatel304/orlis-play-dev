import test from 'node:test';
import assert from 'node:assert/strict';
import { hudZones, underHud, badge, hud, PANEL_ROWS, scorePill, chip, statusBar, BAR_COLORS } from '../src/games/hud.js';
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

test('underHud says where a target must not go', () => {
  const W = 1600, H = 900, pt = (name, fx = 0.5, fy = 0.5) => { const r = hudZones(W, H)[name]; return [r.x + r.w * fx, r.y + r.h * fy]; };
  assert.ok(underHud(W, H, ...pt('top')), 'under the clock and words');
  assert.ok(underHud(W, H, ...pt('score')), 'under the corner');
  assert.ok(underHud(W, H, ...pt('card')), 'under the move card');
  assert.ok(underHud(W, H, ...pt('badge')), 'under the badge');
  assert.ok(!underHud(W, H, 800, 600), 'the middle of the screen is the game\'s');
});

test('the badge draws a pill, and nothing on the results screen or with nothing to say', () => {
  const calls = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls.push(k); }, set: () => true });
  hud.quiet = false; badge(c, 1600, 900, { icon: '\u{1F525}', value: 3 });
  assert.ok(calls.includes('roundRect') && calls.includes('fillText'), 'a pill with its number');
  calls.length = 0; badge(c, 1600, 900, {}); assert.equal(calls.length, 0, 'nothing to say, nothing drawn');
  hud.quiet = true; badge(c, 1600, 900, { value: 3 }); assert.equal(calls.length, 0, 'quiet: no badge'); hud.quiet = false;
});

test('the grid: square cells that fit, the same pieces in the same cells, at any screen shape', () => {
  for (const [W, H] of [[1920, 1080], [1280, 720], [1024, 768], [800, 600], [2560, 1080]]){
    const { C, s } = gridOf(W, H);
    assert.ok(COLS * C <= W - 2 * s + 0.01 && (ROWS) * C <= H - 2 * s + 0.01, `${COLS} x ${ROWS} cells fit at ${W}x${H}`);
    for (const [name, spec] of Object.entries(SLOTS)){ const b = block(W, H, ...spec); assert.ok(b.x >= -0.01 && b.y >= -0.01 && b.x + b.w <= W + 0.01 && b.y + b.h <= H + 0.01, `${name} is on screen at ${W}x${H}`); }
    const clock = block(W, H, ...SLOTS.clock); assert.ok(Math.abs(clock.x + clock.w / 2 - W / 2) < 1, `the clock is in the middle at ${W}x${H}`);
    const card = block(W, H, ...SLOTS.card); assert.ok(Math.abs(W - card.x - card.w - (s + C)) < 1, `the card hangs from the right edge at ${W}x${H}`);
    const first = cell(W, H, 1, 0), last = cell(W, H, 1, 3);
    assert.ok(last.y + last.h < block(W, H, 0, 4).y + 1, `the corner's four rows stay in the top band at ${W}x${H}`);
    assert.ok(first.x + first.w * 5 < clock.x, `the scores' row leaves the clock alone at ${W}x${H}`);
  }
});

test('the three pieces draw, and bars only use the allowed colours', () => {
  const calls = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 30 }) : (...a) => { calls.push(k); }, set: () => true });
  scorePill(c, 10, 10, 50, '#3da9ff', 7, 0.5); chip(c, 10, 70, 50, { icon: '\u{1F48E}', value: 12 }); statusBar(c, 10, 130, 50, { icon: '\u2B50', fill: 0.6, color: 'rose' });
  assert.ok(calls.filter(x => x === 'roundRect').length >= 5 && calls.includes('fillText'), 'pill, chip and bar all draw');
  const taken = ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff', '#ff7a59'];
  for (const col of Object.values(BAR_COLORS)) assert.ok(!taken.includes(col), `${col} is not a player colour or the arrow orange`);
});
