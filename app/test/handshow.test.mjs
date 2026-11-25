/* Hands on screen: three ways to draw them (glow orb, body outline, glow), remembered, cycled with H - and only the drawing changes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDS, handsMode, setHandsMode, cycleHands, handsName } from '../src/ui/handshow.js';
import { useHandsStore } from '../src/ui/handsmode.js';
import { Avatars } from '../src/ui/avatars.js';
import { cursor } from '../src/ui/cursor.js';
import { pose, L } from '../src/tracking/pose.js';

/* a canvas that remembers what it was asked to do */
function canvas(){
  const calls = [], grad = { addColorStop(){} };
  return new Proxy({ calls }, {
    get(t, k){ if (k in t) return t[k]; if (k === 'createRadialGradient' || k === 'createLinearGradient') return (...a) => { calls.push(k); return grad; }; return (...a) => { calls.push(k); }; },
    set(){ return true; }
  });
}
function seat(){
  const p = pose.players[0];
  p.present = true; p.lostFor = 0;
  p.lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.95 }));
  Object.assign(p.lm[L.L_SHOULDER], { x: 0.44, y: 0.4 }); Object.assign(p.lm[L.R_SHOULDER], { x: 0.56, y: 0.4 });
  Object.assign(p.lm[L.L_HIP], { x: 0.46, y: 0.7 }); Object.assign(p.lm[L.R_HIP], { x: 0.54, y: 0.7 });
  Object.assign(p.lm[L.NOSE], { x: 0.5, y: 0.3 });
  p.hands.left = { x: 0.3, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.7, y: 0.5, vx: 0, vy: 0, speed: 0 };
  return p;
}
const wasMouse = pose.mouse.active;

test('three ways, the glow orb the first, remembered, and H goes round them', () => {
  assert.deepEqual(HANDS.map(h => h[0]), ['orb', 'body', 'glow']);
  assert.equal(handsMode(), 'orb');
  assert.equal(cycleHands(), 'Body outline'); assert.equal(handsMode(), 'body');
  assert.equal(cycleHands(), 'Glow'); assert.equal(handsName(), 'Soft glow');
  assert.equal(cycleHands(), 'Glow orb');
  setHandsMode('glow');
  assert.equal(localStorage.getItem('orlis_handsmode'), 'glow', 'kept for next time');
  setHandsMode('nonsense'); assert.equal(handsMode(), 'glow', 'an unknown way changes nothing');
  setHandsMode('orb');
});

test('a stored "rings" (the old way) moves over to the glow orb, and is stored as it', () => {
  const was = localStorage.getItem('orlis_handsmode');
  try {
    localStorage.setItem('orlis_handsmode', 'rings');
    useHandsStore({ read: () => localStorage.getItem('orlis_handsmode'), write: (m) => localStorage.setItem('orlis_handsmode', m) });
    assert.equal(handsMode(), 'orb');
    assert.equal(localStorage.getItem('orlis_handsmode'), 'orb');
    assert.equal(setHandsMode('rings'), 'orb', 'an old name asked for is the orb');
  } finally { if (was == null) localStorage.removeItem('orlis_handsmode'); else localStorage.setItem('orlis_handsmode', was); setHandsMode('orb'); }
});

test('orb: the glow orbs; body: a faint outline and a glow; glow: a glow and nothing white as ever; body: a faint outline and a glow; glow: a glow and nothing white', () => {
  pose.mouse.active = false; seat();
  const a = new Avatars();
  const draw = (way) => { setHandsMode(way); const c = canvas(); a.drawMitts(c, 1920, 1080, 1); return c.calls; };
  const orb = draw('orb'), body = draw('body'), glow = draw('glow');
  assert.ok(orb.includes('fill') && orb.filter(k => k === 'createRadialGradient').length >= 4, 'an orb for each hand: a soft shadow, a halo and a bright core');
  assert.ok(!orb.includes('stroke'), 'no ring round it (no hold to show)');
  assert.ok(!glow.includes('stroke'), 'glow: no rim');
  assert.ok(glow.filter(k => k === 'createRadialGradient').length === 2, 'glow: one soft glow for each hand');
  assert.ok(body.filter(k => k === 'createRadialGradient').length === 2, 'body: a glow for each hand too');
  assert.ok(body.includes('stroke') && body.includes('lineTo'), 'body: and the outline of the player (limbs and torso)');
  assert.ok(!glow.includes('lineTo'), 'glow: no body');
  setHandsMode('orb'); pose.players[0].present = false; pose.mouse.active = wasMouse;
});

test('the orb cursor on menus is drawn only in the orb way', () => {
  cursor.rings.length = 0;
  cursor.rings.push({ x: 0.5, y: 0.5, color: '#f00', progress: 0.5, id: 0, waving: 1 });
  for (const way of ['orb', 'body', 'glow']){
    setHandsMode(way); const c = canvas(); cursor.draw(c, 1920, 1080);
    assert.equal(c.calls.includes('arc'), way === 'orb', way);
  }
  setHandsMode('orb'); cursor.rings.length = 0;
});

test('only the drawing changes: picking and pointing never ask which way hands are shown', () => {
  const src = readFileSync(new URL('../src/ui/cursor.js', import.meta.url), 'utf8');
  const update = src.slice(src.indexOf('  update(dt, root){'), src.indexOf('  /* The wave:'));
  assert.ok(!/handsMode/.test(update), 'cursor.update (pointing, waves, picks) does not look');
  const home = readFileSync(new URL('../src/ui/home.js', import.meta.url), 'utf8');
  assert.ok(!/handsMode|hcur/.test(home), 'home has no hand cursor of its own (decision 0049)');
});

test('Settings > Testing has the choice for the owner, and H does it in play', () => {
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.match(menu, /account\.role === 'owner'[\s\S]{0,400}Hands on screen/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /e\.key === 'h'[^\n]*account\.role === 'owner'[^\n]*cycleHands/);
});
