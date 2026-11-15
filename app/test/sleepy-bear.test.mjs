import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import { music } from '../src/audio/sound.js';
import sleepyBear, { motionOf, STILL, WOBBLE, GRACE } from '../src/games/sleepy-bear.js';

const DT = 1 / 30;
/* (sound is a silent stand-in in tests: listen for the music being held) */
let held = false;
music.hold = (on) => { held = !!on; };
/* a body at x, its points a little apart */
const bodyAt = (x, y = 0.5) => Array.from({ length: 33 }, (_, i) => ({ x: x + (i % 5) * 0.01, y: y + (i % 7) * 0.01, v: 0.9 }));
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = i < n ? bodyAt(0.3 + i * 0.4) : null;
    p.hands.left = { x: 0.3, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.7, y: 0.5, vx: 0, vy: 0, speed: 0 };
  });
}
/* each frame: player i moves by speed[i] screen widths a second (side to side) */
function run(g, secs, speeds){
  for (let t = 0; t < secs; t += DT){
    pose.players.forEach((p, i) => {
      if (!p.present) return;
      const v = speeds[i] || 0, off = Math.sin(t * 10) > 0 ? 1 : -1;
      p.lm = p.lm.map(k => ({ ...k, x: k.x + off * v * DT }));
    });
    g.step(DT, 1920, 1080);
  }
}
const toFreeze = (g, speeds) => { let n = 0; while (g.phase !== 'freeze' && n++ < 2000) run(g, DT, speeds); };
const toDance = (g, speeds) => { let n = 0; while (g.phase !== 'dance' && n++ < 2000) run(g, DT, speeds); };

test('movement is how fast the body points go, in screen widths a second', () => {
  const a = bodyAt(0.5), b = bodyAt(0.51);
  assert.ok(Math.abs(motionOf({ present: true, lm: b }, a, 0.1) - 0.1) < 1e-9);
  assert.equal(motionOf({ present: false, lm: b }, a, 0.1), 0);
  assert.ok(STILL < WOBBLE);
});

test('holding still through a freeze earns a star; the music stops, then comes back', () => {
  players(2);
  const g = sleepyBear.create(2);
  toFreeze(g, [0.5, 0.5]);
  assert.equal(held, true, 'the music stops for the freeze');
  toDance(g, [0, 0]);
  assert.equal(held, false, 'and comes back for the dance');
  assert.deepEqual(g.score.slice(0, 2), [1, 1]);
});

test('a wobble makes the bear grumble - no star that time, but nothing is taken away', () => {
  players(2);
  const g = sleepyBear.create(2);
  toFreeze(g, [0.5, 0.5]); toDance(g, [0, 0]);          /* a star each */
  toFreeze(g, [0.5, 0.5]);
  run(g, GRACE + 0.3, [0, WOBBLE * 3]);                   /* player 2 wobbles */
  assert.equal(g.caught[1], true);
  assert.ok(g.bear.grumble > 0, 'the bear grumbles');
  toDance(g, [0, 0]);
  assert.deepEqual(g.score.slice(0, 2), [2, 1], 'player 1 earns another; player 2 keeps theirs');
});

test('moving in the first moment of a freeze is fine: nobody stops on the beat', () => {
  players(1);
  const g = sleepyBear.create(1);
  toFreeze(g, [0.5]);
  run(g, GRACE * 0.8, [WOBBLE * 3]);
  assert.equal(g.caught[0], false);
});

test('the round ends with the music playing again', () => {
  players(1);
  const g = sleepyBear.create(1);
  run(g, sleepyBear.secs + 1, [0]);
  assert.equal(g.over, true);
  assert.equal(held, false);
});

test('waving just your arms in a freeze is a wobble', () => {
  const a = bodyAt(0.5), b = a.map((k, i) => i === 15 || i === 16 ? { ...k, y: k.y + 0.03 } : { ...k });
  assert.ok(motionOf({ present: true, lm: b }, a, 0.1) > WOBBLE);
});
