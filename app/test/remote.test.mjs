import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom, FakeEl } from './harness/browser.mjs';
import { remote } from '../src/ui/remote.js';
import { boot, HOLD, BOOT, MERGE, NAME, WINK } from '../src/ui/boot.js';
import { sfx } from '../src/audio/sound.js';

/* A button laid out at (x, y), w x h. */
function btn(parent, name, x, y, w = 200, h = 120, cls = 'btn'){
  const b = new FakeEl('button'); b.className = cls; b.name = name;
  b.rect = { left: x, top: y, width: w, height: h };
  b.clicks = 0; b.click = () => { b.clicks++; };
  parent.appendChild(b); return b;
}
function screen(ui, cls){ const s = new FakeEl('div'); s.className = 'screen ' + cls; ui.appendChild(s); return s; }
const press = (key) => remote.key({ key, preventDefault(){} });

/* The home screen's rows: three tiles, then one, then a row of five. */
function home(){
  const ui = resetDom(), s = screen(ui, 'tvhome');
  const r1 = [0, 1, 2].map(k => btn(s, 'a' + k, 80 + k * 340, 600));
  const r2 = [btn(s, 'b0', 80, 900)];
  const r3 = [0, 1, 2, 3, 4].map(k => btn(s, 'c' + k, 80 + k * 250, 1200));
  remote.cur = null;
  return { ui, s, r1, r2, r3 };
}

test('the remote moves to the next row down - never skipping one - then the nearest tile in it', () => {
  const { r1, r2, r3 } = home();
  remote.mark(r1[1]);
  press('ArrowDown');
  assert.equal(remote.cur, r2[0], 'the next row, even though a tile further down is straighter below');
  press('ArrowDown');
  assert.equal(remote.cur, r3[0]);
  press('ArrowRight'); press('ArrowRight');
  assert.equal(remote.cur, r3[2]);
  press('ArrowUp');
  assert.equal(remote.cur, r2[0]);
  press('ArrowUp');
  assert.equal(remote.cur, r1[0], 'the nearest tile in the row above');
});

test('left and right stay on the row, stopping at its end', () => {
  const { r1 } = home();
  remote.mark(r1[2]);
  press('ArrowRight');
  assert.equal(remote.cur, r1[2], 'nowhere further right on this row');
  press('ArrowLeft');
  assert.equal(remote.cur, r1[1]);
});

test('a screen hears which tile the remote moved to', () => {
  const { r1 } = home();
  let heard = null;
  r1[1].addEventListener('remotefocus', () => { heard = 'a1'; });
  remote.mark(r1[0]);
  press('ArrowRight');
  assert.equal(heard, 'a1');
});

test('OK presses the highlighted button; an open window comes first', () => {
  const { ui, r1 } = home();
  remote.mark(r1[0]);
  press('Enter');
  assert.equal(r1[0].clicks, 1);
  const win = screen(ui, 'dim');
  const a = btn(win, 'quieter', 600, 400), b = btn(win, 'louder', 900, 400);
  press('ArrowRight');
  assert.ok(remote.cur === a || remote.cur === b, 'moving inside the window, not the screen behind');
  press('Enter');
  assert.equal(r1[0].clicks, 1, 'the screen behind is left alone');
});

test('Back closes an open window; with none, it goes back (pauses a game, leaves the scores)', () => {
  const { ui } = home();
  const win = screen(ui, 'dim');
  const close = btn(win, 'close', 700, 800, 200, 100, 'btn close');
  let backs = 0; remote.back = () => backs++;
  press('Escape');
  assert.equal(close.clicks, 1);
  assert.equal(backs, 0);
  win.remove();
  press('BrowserBack');
  assert.equal(backs, 1);
});

test('Back closes a small card (Create\'s, Family\'s) as a tap outside it does, and goes no further', () => {
  const { ui } = home();
  const card = screen(ui, 'dim fpopwrap');
  btn(card, 'ok', 700, 800, 200, 100, 'btn go');
  let shut = 0; card.addEventListener('pointerdown', (e) => { if (e.target === card) shut++; });
  let backs = 0; remote.back = () => backs++;
  press('Backspace');
  assert.equal(shut, 1, 'the card closed');
  assert.equal(backs, 0, 'and the page behind stays');
});

test('the boot books its one intro sound at the start (none at the wink), and hands over without waiting for the camera', () => {
  resetDom();
  let chimed = 0, at = null; sfx.boot = (o) => { chimed++; at = o; };
  const show = boot();
  for (let k = 0; k < (WINK + 0.4) * 60; k++) show.tick(1 / 60);
  assert.equal(chimed, 1, 'one sound, booked once');
  assert.ok(Math.abs(at.merge - MERGE) < 0.05 && Math.abs(at.name - NAME) < 0.05, 'timed to the landing and the name');
  assert.ok(NAME - MERGE >= 0.6, 'the name waits a moment after the squares land');
  for (let k = 0; k < (HOLD - WINK - 0.4) * 60; k++) show.tick(1 / 60);
  show.camReady = false;
  for (let k = 0; k < 10 * 60; k++) show.tick(1 / 60);
  assert.ok(!show.done && Math.abs(show.t - HOLD) < 1e-6, 'it can still hold on the cube, if asked to');
  show.camReady = true;
  for (let k = 0; k < (BOOT - HOLD + 0.1) * 60; k++) show.tick(1 / 60);
  assert.ok(show.done);
  delete sfx.boot;
  assert.equal(boot().camReady, true, 'nothing to wait for now: the camera starts with a game');
});

/* Settings' Volume: a slider the remote can reach, and move with Left and Right in steps */
function volumeRow(){
  const ui = resetDom(), s = screen(ui, 'dim setscreen');
  const mute = btn(s, 'mute', 100, 300, 120, 60);
  const sl = new FakeEl('input'); sl.type = 'range'; sl.min = 0; sl.max = 1; sl.step = 0.05; sl.value = 0.5; sl.className = 'setslider';
  sl.rect = { left: 300, top: 300, width: 600, height: 60 }; sl.focus = () => {}; sl.blur = () => {};
  s.appendChild(sl);
  const other = btn(s, 'display', 100, 500, 300, 120);
  const heard = []; sl.addEventListener('input', () => heard.push(+sl.value));
  remote.cur = null;
  return { sl, mute, other, heard };
}
test('the remote reaches the Volume slider and Left and Right move it in steps, telling the page each time', () => {
  const { sl, mute, heard } = volumeRow();
  remote.mark(mute);
  press('ArrowRight');
  assert.equal(remote.cur, sl, 'Right from Mute lands on the slider');
  press('ArrowRight'); press('ArrowRight');
  assert.equal(+sl.value, 0.7);
  press('ArrowLeft');
  assert.equal(+sl.value, 0.6);
  assert.deepEqual(heard, [0.6, 0.7, 0.6], 'one input event per step');
  assert.equal(remote.cur, sl, 'it keeps the highlight while it is moved');
});
test('a slider stops at its ends, and Left at the bottom moves on to the button beside it; Up and Down leave it', () => {
  const { sl, mute, other } = volumeRow();
  remote.mark(sl);
  for (let i = 0; i < 12; i++) press('ArrowRight');
  assert.equal(+sl.value, 1);
  assert.equal(remote.cur, sl, 'nothing further right');
  for (let i = 0; i < 12; i++) press('ArrowLeft');
  assert.equal(+sl.value, 0);
  assert.equal(remote.cur, mute, 'Left past the bottom goes on to Mute');
  remote.mark(sl);
  press('ArrowDown');
  assert.equal(remote.cur, other);
});
