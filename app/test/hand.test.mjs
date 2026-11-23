/* Hand mode on Home (U7): the reach box, the one driver, the row-edge strip, and point-and-wave picking through cursor.js - all with
   scripted poses (a body is shoulders and a wrist), looked at ten times a second as Home looks at them. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
import { pose } from '../src/tracking/pose.js';
import { L } from '../src/tracking/pose-shared.js';
import { cursor, button, onPick, CLICK_TURNS, WAVE_SWING } from '../src/ui/cursor.js';
import { reachBox, toScreen, mapHand, Driver, EdgeHold, REACH, HANG, LOOKS, HOLD_EDGE, DROP_AFTER } from '../src/ui/hand.js';

const LOOK = 1 / LOOKS.hz;     /* seconds between looks */

/* a body: shoulders 0.12 wide around (cx, sy); the wrist where it is */
function body(cx, sy = 0.4, sw = 0.12){
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: sy, v: 0.95 }));
  lm[L.L_SHOULDER] = { x: cx - sw / 2, y: sy, v: 0.95 };
  lm[L.R_SHOULDER] = { x: cx + sw / 2, y: sy, v: 0.95 };
  return lm;
}
/* where in the camera a hand must be to point at (nx, ny) of the screen, for this body */
function handAt(lm, nx, ny){
  const b = reachBox(lm);
  return { x: b.x0 + nx * (b.x1 - b.x0), y: b.y0 + ny * (b.y1 - b.y0) };
}
function seat(i, cx, sy){
  const p = pose.players[i];
  p.present = true; p.lostFor = 0; p.lm = body(cx, sy);
  return p;
}
function put(p, x, y){ p.hands.right.x = x; p.hands.right.y = y; p.hands.left.x = x; p.hands.left.y = y; p.lm[L.R_WRIST] = { x, y, v: 0.95 }; p.lm[L.L_WRIST] = { x, y, v: 0.1 }; }

function setup(){
  const ui = resetDom();
  pose.mouse.active = false;
  for (const p of pose.players){ p.present = false; p.lm = null; }
  cursor.enabled = true; cursor.map = mapHand; cursor.skin = true;
  cursor.rings.length = 0; cursor.reset(); for (const s of cursor._state) s.cool = 0;
  const driver = new Driver();
  cursor.gate = { driver: () => driver.who, takeOver: (i) => driver.takeOver(i) };
  return { ui, driver };
}
function done(){ cursor.map = null; cursor.gate = null; cursor.skin = false; pose.mouse.active = true; for (const p of pose.players){ p.present = false; p.lm = null; } }
/* a button placed by fractions of the screen (the test screen is whatever size the harness says) */
function place(el, fl, ft, fw, fh){ const left = fl * innerWidth, top = ft * innerHeight, width = fw * innerWidth, height = fh * innerHeight; el.rect = { left, top, width, height, right: left + width, bottom: top + height }; return el; }
const centre = (el) => ({ x: (el.rect.left + el.rect.width / 2) / innerWidth, y: (el.rect.top + el.rect.height / 2) / innerHeight });

/* one look: the cursor and the driver see the poses */
function look(ui, driver){
  const active = pose.players.map(p => !!(p.present && p.lm && mapHand(p, pose.cursorHand(p))));
  driver.update(LOOK, active, pose.players.map(p => p.present));
  cursor.update(LOOK, ui);
}
function point(ui, driver, p, n, secs){ const h = handAt(p.lm, n.x, n.y); put(p, h.x, h.y); for (let t = 0; t < secs; t += LOOK) look(ui, driver); }
function wave(ui, driver, p, n, turns = CLICK_TURNS + 1){
  const h = handAt(p.lm, n.x, n.y), b = reachBox(p.lm), amp = WAVE_SWING * 1.8 * (b.x1 - b.x0);
  for (let i = 0; i <= turns; i++){ put(p, h.x + (i % 2 ? 1 : -1) * amp, h.y); look(ui, driver); }
}

test('the reach box sits in front of the shoulders: the middle of it is the middle of the screen, its corners the corners', () => {
  const lm = body(0.5, 0.4);
  const b = reachBox(lm), mid = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  assert.deepEqual(toScreen(b, mid.x, mid.y), { x: 0.5, y: 0.5 });
  assert.deepEqual(toScreen(b, b.x0, b.y0), { x: 0, y: 0 });
  assert.deepEqual(toScreen(b, b.x1, b.y1), { x: 1, y: 1 });
  assert.ok(b.x1 - b.x0 > 2 * 0.12, 'a little wider than the arms');
  assert.ok(b.y0 < 0.4 && b.y1 > 0.4, 'from above the shoulders to the belly');
  assert.equal(toScreen(b, 2, 0.4).x, 1, 'beyond the box is clamped to the screen edge');
});

test('the box follows the child: the same reach points at the same place wherever they stand, and a smaller child reaches the same screen', () => {
  const a = body(0.3, 0.4), c = body(0.7, 0.45, 0.08);
  for (const lm of [a, c]){
    const h = handAt(lm, 0.25, 0.75);
    const s = toScreen(reachBox(lm), h.x, h.y);
    assert.ok(Math.abs(s.x - 0.25) < 1e-9 && Math.abs(s.y - 0.75) < 1e-9);
  }
  assert.ok((reachBox(c).x1 - reachBox(c).x0) < (reachBox(a).x1 - reachBox(a).x0), 'a smaller (further away) child has a smaller box');
});

test('a hand hanging at the child\'s side is not pointing at anything; unseen shoulders give no box', () => {
  const lm = body(0.5, 0.4), b = reachBox(lm);
  assert.equal(toScreen(b, 0.5, b.hang + 0.01), null);
  assert.notEqual(toScreen(b, 0.5, b.y1 + HANG * 0.5 * 0.12 * 16 / 9), null, 'a little below the belly still counts');
  const dark = body(0.5, 0.4); dark[L.L_SHOULDER].v = 0.1;
  assert.equal(reachBox(dark), null);
  assert.equal(reachBox(null), null);
  assert.ok(REACH.down < 1.3, 'the box ends before the hips, where arms hang');
});

test('one driver: the first hand up drives; another hand up does not take over; they let go after a while with no hand up; a wave takes over', () => {
  const d = new Driver();
  assert.equal(d.update(0.1, [false, false], [true, true]), null, 'nobody has a hand up');
  assert.equal(d.update(0.1, [false, true], [true, true]), 1, 'the first hand up drives');
  assert.equal(d.update(0.1, [true, true], [true, true]), 1, 'a second hand up changes nothing');
  for (let t = 0; t < DROP_AFTER - 0.3; t += 0.1) d.update(0.1, [true, false], [true, true]);
  assert.equal(d.who, 1, 'still theirs for a moment with the hand down');
  for (let t = 0; t < 0.6; t += 0.1) d.update(0.1, [true, false], [true, true]);
  assert.equal(d.who, 0, 'let go, and the one with a hand up drives');
  d.takeOver(1); assert.equal(d.who, 1);
  assert.equal(d.update(0.1, [true, false], [true, false]), 0, 'the driver walked away: the one still here drives');
});

test('the row-edge strip: held at the bottom for a moment moves down a row, and keeps paging while held; not without a row that way', () => {
  const e = new EdgeHold();
  assert.deepEqual(e.update(0.1, 0.5, { canDown: true }), { dir: 0, progress: 0, step: 0 });
  let steps = 0, last = null;
  for (let t = 0; t < HOLD_EDGE - 0.15; t += 0.1){ last = e.update(0.1, 0.97, { canDown: true }); steps += last.step; }
  assert.equal(steps, 0); assert.ok(last.progress > 0.5 && last.progress < 1, 'the ring fills');
  for (let t = 0; t < 0.3; t += 0.1) steps += e.update(0.1, 0.97, { canDown: true }).step;
  assert.equal(steps, 1, 'one row down');
  for (let t = 0; t < HOLD_EDGE + 0.2; t += 0.1) steps += e.update(0.1, 0.97, { canDown: true }).step;
  assert.equal(steps, 2, 'held on, it pages again');
  e.update(0.1, 0.5, { canDown: true });
  const up = new EdgeHold(); let ups = 0;
  for (let t = 0; t < HOLD_EDGE + 0.3; t += 0.1) ups += up.update(0.1, 0.02, { canUp: true }).step;
  assert.equal(ups, -1, 'the top edge goes back up');
  const none = new EdgeHold(); let n = 0;
  for (let t = 0; t < 3; t += 0.1) n += Math.abs(none.update(0.1, 0.97, { canDown: false }).step);
  assert.equal(n, 0, 'no row below: the strip does nothing');
  const gone = new EdgeHold(); for (let t = 0; t < 0.5; t += 0.1) gone.update(0.1, 0.97, { canDown: true });
  assert.equal(gone.update(0.1, null, { canDown: true }).progress, 0, 'the cursor leaving empties the ring');
});

test('pointing lights a tile and holding still never starts it; a wave picks it (the camera looking ten times a second)', () => {
  const { ui, driver } = setup();
  const tile = place(button('Pop Party', 'htile'), 0.5, 0.37, 0.21, 0.23);
  ui.appendChild(tile);
  let picks = 0; onPick(tile, () => picks++);
  const kid = seat(0, 0.5, 0.4);
  point(ui, driver, kid, centre(tile), 12);
  assert.ok(tile.classList.contains('hot'), 'lit');
  assert.equal(driver.who, 0, 'the child pointing drives');
  assert.equal(cursor.rings.length, 1);
  assert.equal(picks, 0, 'twelve seconds of pointing, still nothing');
  wave(ui, driver, kid, centre(tile));
  assert.equal(picks, 1, 'a wave picks it');
  done();
});

test('a hand hanging at the side lights nothing and a wave there does nothing', () => {
  const { ui, driver } = setup();
  const tile = place(button('Pop Party', 'htile'), 0, 0.65, 1, 0.35);
  ui.appendChild(tile);
  let picks = 0; onPick(tile, () => picks++);
  const kid = seat(0, 0.5, 0.4), b = reachBox(kid.lm);
  const hang = { x: kid.lm[L.R_SHOULDER].x + 0.03, y: b.hang + 0.05 };
  for (let i = 0; i < 20; i++){ put(kid, hang.x + (i % 2 ? 0.05 : -0.05), hang.y); look(ui, driver); }
  assert.equal(picks, 0); assert.ok(!tile.classList.contains('hot'));
  assert.equal(driver.who, null, 'a hand at the side is not a hand up');
  done();
});

test('the first hand up drives, others take over by waving - and only the driver can pick', () => {
  const { ui, driver } = setup();
  const a = place(button('One', 'htile'), 0.05, 0.37, 0.16, 0.19), b = place(button('Two', 'htile'), 0.62, 0.37, 0.16, 0.19);
  ui.append(a, b);
  const got = []; onPick(a, () => got.push('a')); onPick(b, () => got.push('b'));
  const mia = seat(0, 0.3, 0.4), leo = seat(1, 0.7, 0.4);
  point(ui, driver, mia, centre(a), 1);
  assert.equal(driver.who, 0, 'Mia raised a hand first');
  put(leo, handAt(leo.lm, centre(b).x, centre(b).y).x, handAt(leo.lm, centre(b).x, centre(b).y).y);
  for (let i = 0; i < 20; i++) look(ui, driver);
  assert.equal(driver.who, 0, 'Leo has a hand up too, but Mia still drives');
  assert.ok(a.classList.contains('hot') && !b.classList.contains('hot'), 'only the driver points');
  wave(ui, driver, leo, centre(b));
  assert.equal(driver.who, 1, 'Leo waved: he drives now');
  assert.deepEqual(got, [], 'and the wave that took over picked nothing');
  for (let i = 0; i < 12; i++) look(ui, driver);
  point(ui, driver, leo, centre(b), 1);
  wave(ui, driver, leo, centre(b));
  assert.deepEqual(got, ['b'], 'now his wave picks');
  done();
});

test('the scripted pose picks a tile three times out of three', () => {
  const { ui, driver } = setup();
  const tiles = [0, 1, 2].map(i => place(button('T' + i, 'htile'), 0.04 + i * 0.3, 0.65, 0.26, 0.28));
  ui.append(...tiles);
  const picked = [];
  tiles.forEach((t, i) => onPick(t, () => picked.push(i)));
  const kid = seat(0, 0.5, 0.4);
  for (const i of [1, 2, 0]){
    point(ui, driver, kid, centre(tiles[i]), 1.2);
    wave(ui, driver, kid, centre(tiles[i]));
    for (let k = 0; k < 12; k++) look(ui, driver);          /* (the cool-down after a pick, hand moving on) */
  }
  assert.deepEqual(picked, [1, 2, 0]);
  done();
});

test('the camera looks lightly at home: ten a second with someone in view and hands down, two with nobody - the full rate while a hand points', () => {
  assert.deepEqual(LOOKS, { hz: 10, idleHz: 2 });
});
