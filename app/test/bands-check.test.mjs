import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L } from '../src/tracking/pose.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { framingCheck, SETTLE, BANDS_MIN, BANDS_MAX } from '../src/ui/framing-check.js';
import { markFramingShown } from '../src/ui/framing.js';
import * as rig from '../tools/playtest/rig.mjs';
import { figure } from './harness/synth-frames.mjs';

/* the camera check with Track coloured wristbands on: "Raise your hands for a second" until each player's band is learnt (or settled as "none"),
   then on; with the switch off nothing changes (it finishes as soon as everyone is framed) */
function mk(bands){
  if (!document.getElementById('ui')){ const u = document.createElement('div'); u.id = 'ui'; document.body.appendChild(u); }
  markFramingShown();
  rig.resetPose(pose); pose.cap = 4;
  const lm = figure(0.5, 0.55, 0.14).map(k => ({ ...k, v: 0.95 }));
  for (const i of [29, 30, 31, 32]) lm[i].y = 0.9;
  pose.players[0].present = true; pose.players[0].lm = lm;
  forceSwitches({ bands });
  let done = 0;
  const c = framingCheck({ onDone: () => { done++; }, players: 1 });
  return { c, done: () => done };
}
const tick = (c, secs) => { for (let i = 0; i < secs * 30; i++) c.tick(1 / 30); };

test('the camera check asks everyone to raise their hands, waits, gives up after a while, and goes on; off, it goes on at once', () => {
  const a = mk(false);
  tick(a.c, SETTLE + 0.3);
  assert.equal(a.done(), 1, 'off: finished as before'); assert.equal(pose._bandLearning, false);
  a.c.leave();
  const b = mk(true);
  tick(b.c, SETTLE + 0.3);
  assert.equal(b.done(), 0, 'on: waiting for hands');
  assert.equal(pose._bandLearning, true);
  assert.match(document.querySelector('.frmsay').textContent, /Raise your hands for a second/);
  /* the hands never go up: it gives up after BANDS_MAX seconds, settles the player as "none" and goes on */
  tick(b.c, BANDS_MAX + 0.5);
  assert.equal(b.done(), 1); assert.equal(pose._bandLearning, false);
  assert.ok(!pose.players[0].band || pose.players[0].band.state === 'none', 'no band learnt');
  b.c.leave();
  /* leaving the check early stops the learning */
  const c = mk(true);
  tick(c.c, SETTLE + 0.3);
  assert.equal(pose._bandLearning, true);
  c.c.leave();
  assert.equal(pose._bandLearning, false);
  assert.ok(BANDS_MIN < BANDS_MAX);
  /* everyone settled sooner: once the player's band is known (a looked-at "none" counts), it goes on after BANDS_MIN */
  const d = mk(true);
  tick(d.c, SETTLE + 0.3);
  pose.players[0].band = { state: 'none' };
  tick(d.c, BANDS_MIN + 0.2);
  assert.equal(d.done(), 1, 'settled: on');
  d.c.leave();
  pose.players[0].present = false; pose.players[0].lm = null; pose.players[0].band = null;
  forceSwitches(null);
});
