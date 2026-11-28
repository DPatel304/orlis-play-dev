import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import { framingCheck, LIGHT_WAIT, TIP_S, SETTLE } from '../src/ui/framing-check.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { markFramingShown } from '../src/ui/framing.js';
import { figure } from './harness/synth-frames.mjs';

/* the camera check with Lighting tips on: a framed player in a dark room sees the tip ("Turn on a light near you") for a few seconds, then it goes on;
   with the switch off nothing changes (it finishes as soon as everyone is framed) */
function setup(light){
  if (!document.getElementById('ui')){ const u = document.createElement('div'); u.id = 'ui'; document.body.appendChild(u); }
  markFramingShown();
  const lm = figure(0.5, 0.55, 0.14).map(k => ({ ...k, v: 0.95 }));
  for (const i of [29, 30, 31, 32]) lm[i].y = 0.9;
  pose.players[0].present = true; pose.players[0].lm = lm;
  forceSwitches({ light });
  pose.lightLook = () => ({ mean: 0.07, person: 0.06, background: 0.07, gap: 0.01, bodies: 1 });
  let done = 0; const c = framingCheck({ onDone: () => { done++; }, players: 1 });
  return { c, done: () => done };
}
function run(c, secs){ for (let i = 0; i < secs * 30; i++) c.tick(1 / 30); }

test('Lighting tips: a dark room shows the tip in the camera check, then goes on; off, it goes on at once', () => {
  const off = setup(false);
  run(off.c, SETTLE + 0.3);
  assert.equal(off.done(), 1, 'off: finished as before');
  off.c.leave();
  const on = setup(true);
  run(on.c, SETTLE + 0.3);
  assert.equal(on.done(), 0, 'on: still looking at the light');
  run(on.c, LIGHT_WAIT + 0.5);
  assert.equal(on.done(), 0, 'on: the tip is up');
  run(on.c, TIP_S + 0.5);
  assert.equal(on.done(), 1, 'on: then it goes on by itself');
  on.c.leave();
  forceSwitches(null); delete pose.lightLook; pose.players[0].present = false; pose.players[0].lm = null;
});
