import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateLight, verdict, LightWatch, Lift, tipFor, personBox, TIPS } from '../src/tracking/lighting.js';
import { screenLight, MAX } from '../src/ui/screenlight.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { blankFrame, drawFigure, figure } from './harness/synth-frames.mjs';
import { placeCard, bodyBox } from '../src/ui/framing.js';

const scene = (bg, shirt, trousers = [30, 35, 60], x = 0.5) => { const f = blankFrame(96, 54, bg), lm = figure(x, 0.55, 0.2); drawFigure(f, lm, { shirt, trousers }); return { f, lm }; };

test('lighting: a normal room, a dark room and a bright window behind are told apart (synthetic frames)', () => {
  const normal = scene([150, 145, 135], [200, 60, 60]);
  const dark = scene([14, 14, 18], [30, 12, 12], [10, 12, 18]);
  const backlit = scene([240, 240, 228], [40, 40, 70], [30, 30, 50]);
  const en = estimateLight(normal.f, [normal.lm]), ed = estimateLight(dark.f, [dark.lm]), eb = estimateLight(backlit.f, [backlit.lm]);
  console.log('lighting estimates (mean / person / background):', [en, ed, eb].map(e => [e.mean, e.person, e.background].map(v => v.toFixed(2)).join('/')).join('  |  '));
  assert.equal(verdict(en), 'ok'); assert.equal(verdict(ed), 'dark'); assert.equal(verdict(eb), 'backlit');
  assert.ok(eb.gap > 0.3 && eb.bodies === 1);
  assert.equal(verdict(null), 'ok');
});

test('lighting: a dim picture that is only a dim room with nobody in it is "dark"; a bright room with a bright shirt is not backlit', () => {
  const f = blankFrame(96, 54, [20, 20, 20]);
  const e = estimateLight(f, []);
  assert.equal(e.person, null); assert.equal(verdict(e), 'dark');
  const bright = scene([230, 230, 220], [250, 250, 245], [220, 220, 210]);
  assert.equal(verdict(estimateLight(bright.f, [bright.lm])), 'ok');
});

test('lighting: the person box follows the landmarks (mirrored), and a body not clearly seen has none', () => {
  const lm = figure(0.3, 0.55, 0.2);
  const b = personBox(lm);
  assert.ok(b.x0 < 0.3 && b.x1 > 0.3 && b.y1 > 0.55);
  lm[0].v = 0.1;
  assert.equal(personBox(lm), null);
});

test('LightWatch: needs the verdict to hold before it speaks, and to clear (with a margin) before it stops', () => {
  const w = new LightWatch({ sustain: 2, clear: 1.5 });
  const ed = estimateLight(scene([14, 14, 18], [30, 12, 12], [10, 12, 18]).f, []);
  const ok = estimateLight(scene([150, 145, 135], [200, 60, 60]).f, []);
  for (let i = 0; i < 15; i++) w.step(0.1, ed);
  assert.equal(w.state, 'ok', '1.5 s is not enough');
  for (let i = 0; i < 10; i++) w.step(0.1, ed);
  assert.equal(w.state, 'dark'); assert.equal(w.tip, TIPS.dark); assert.equal(w.tip, 'Turn on a light near you');
  w.step(0.1, { mean: 0.22, person: null, background: null, gap: null, bodies: 0 });
  assert.equal(w.state, 'dark', 'just over the line is not clear yet');
  for (let i = 0; i < 20; i++) w.step(0.1, ok);
  assert.equal(w.state, 'ok'); assert.equal(w.tip, null);
  assert.equal(tipFor('backlit'), 'A bright window behind you makes you hard to see');
});

test('the tip card is placed clear of the players and the other card (placeCard)', () => {
  const W = 1920, H = 1080;
  const lm = figure(0.5, 0.55, 0.2);
  const box = bodyBox(lm.map(k => ({ ...k, v: 0.9 })), W, H);
  const words = { x0: 600, y0: 13, x1: 1320, y1: 100 };
  const t = placeCard(W, H, 700, 70, [box], [words]);
  const hit = (x, y, w, h, b) => Math.min(x + w, b.x1) > Math.max(x, b.x0) && Math.min(y + h, b.y1) > Math.max(y, b.y0);
  assert.ok(!hit(t.x, t.y, 700, 70, box) && !hit(t.x, t.y, 700, 70, words), JSON.stringify(t));
});

test('Lift: dark for a while lifts the screen over about 2 s; light again lowers it; a cutscene holds it down; never flickers around the line', () => {
  const l = new Lift();
  let t = 0; const at = [];
  for (; t < 20; t += 0.1){ l.step(0.1, 0.1); if (Math.abs(t - 1) < 0.05 || Math.abs(t - 7) < 0.05 || Math.abs(t - 12) < 0.05) at.push(l.level); }
  assert.equal(l.dark, true);
  assert.ok(at[0] < 1 && at[0] > 0.1, 'easing, not sudden');
  assert.ok(l.level === 1);
  const blocked = new Lift(); for (let i = 0; i < 200; i++) blocked.step(0.1, 0.1, { blocked: true });
  assert.equal(blocked.level, 0);
  /* the veil lights the room a little: dark 0.12 base + 0.1 * level. It must settle, not flip on and off, over 10 minutes. */
  const m = new Lift(); let flips = 0, last = false;
  for (let k = 0; k < 6000; k++){ const room = 0.12 + 0.12 * m.level; m.step(0.1, room); if (m.dark !== last){ flips++; last = m.dark; } }
  assert.ok(flips <= 3, 'flips: ' + flips);
  /* a bright room never lifts */
  const b = new Lift(); for (let i = 0; i < 600; i++) b.step(0.1, 0.5);
  assert.equal(b.level, 0);
});

test('screenLight: off does nothing at all; on, a dark room puts a low-opacity white veil, lower in a game, and a flash hold takes it down', () => {
  const made = [];
  const doc = { createElement: () => { const e = { style: {}, setAttribute(){}, id: '' }; made.push(e); return e; }, body: { appendChild(){} } };
  forceSwitches({ screenlight: false });
  assert.equal(screenLight.step(1, 'menu', 0.05, doc), 0); assert.equal(made.length, 0);
  forceSwitches({ screenlight: true });
  try {
    for (let i = 0; i < 400; i++) screenLight.step(0.1, 'menu', 0.05, doc);
    assert.ok(Math.abs(made[0].style.opacity - MAX.menu) < 1e-6, 'menu veil ' + made[0].style.opacity);
    assert.equal(screenLight.state(), 'dark, screen lifted');
    screenLight.step(0.1, 'play', 0.05, doc);
    assert.ok(Number(made[0].style.opacity) <= MAX.play + 1e-9 && MAX.play < MAX.menu);
    screenLight.hold(5);
    for (let i = 0; i < 40; i++) screenLight.step(0.1, 'play', 0.05, doc);
    assert.equal(Number(made[0].style.opacity), 0);
    assert.ok(made[0].style.pointerEvents === 'none');
  } finally { forceSwitches(null); screenLight.step(0.1, 'menu', 0.5, doc); }
});
