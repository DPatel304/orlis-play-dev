import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import { music } from '../src/audio/sound.js';
import sleepyBear, { WOBBLE, GRACE } from '../src/games/sleepy-bear.js';

/* The 2026-11 changes: a longer grace, stars only for dancers, and "Wobble!" shown by the player who wobbled. */
const DT = 1 / 30;
music.hold = () => {};
const bodyAt = (x, y = 0.5) => Array.from({ length: 33 }, (_, i) => ({ x: x + (i % 5) * 0.01, y: y + (i % 7) * 0.01, v: 0.9 }));
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = i < n ? bodyAt(0.3 + i * 0.4) : null; p.centre = { x: 0.3 + i * 0.4, y: 0.5 };
    p.hands.left = { x: 0.3, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.7, y: 0.5, vx: 0, vy: 0, speed: 0 };
  });
}
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
const fakeCtx = () => new Proxy({}, { get(t, k){ if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} }); if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set(t, k, v){ t[k] = v; return true; } });

test('the grace is longer than a reaction: a child (0.25-0.6 s) or a grown-up (0.4-0.8 s) has time to stop and still gets the star', () => {
  assert.ok(GRACE >= 1.2 && GRACE <= 1.6, 'about 1.2-1.5 s, was 0.7: ' + GRACE);
  players(1);
  const g = sleepyBear.create(1);
  toFreeze(g, [0.5]);
  run(g, 0.8, [0.5]);                                     /* still dancing for the first 0.8 s, as a slow-reacting grown-up would */
  assert.equal(g.caught[0], false, 'not a wobble');
  toDance(g, [0]);
  assert.equal(g.score[0], 1, 'and a star at the end');
});

test('a star is for dancing and then freezing: standing still all along earns none', () => {
  players(2);
  const g = sleepyBear.create(2);
  toFreeze(g, [0.5, 0]);                                  /* player 1 dances; player 2 stands still all along */
  assert.equal(g.danced[0], true); assert.equal(g.danced[1], false);
  toDance(g, [0, 0]);
  assert.deepEqual(g.score.slice(0, 2), [1, 0]);
  toFreeze(g, [0.5, 0.5]); toDance(g, [0, 0]);            /* next time they both dance, then stop */
  assert.deepEqual(g.score.slice(0, 2), [2, 1]);
});

test('dancing in the last few seconds counts; dancing long ago does not', () => {
  players(2);
  const g = sleepyBear.create(2);
  g.left = 99;
  run(g, 8, [0.5, 0]);
  /* player 2 danced for 1.5 s at the very start, 8 s ago: gone. (Run it again with a fresh game for the "recent" case.) */
  g._freeze();
  assert.equal(g.danced[0], true);
  assert.equal(g.danced[1], false);
  const h = sleepyBear.create(2);
  h.left = 99;
  run(h, 5, [0, 0]); run(h, 1.5, [0, 0.5]); run(h, 1, [0, 0]);
  h._freeze();
  assert.equal(h.danced[1], true, 'danced a second and a half ago');
  assert.equal(h.danced[0], false);
});

test('"Wobble!" belongs to the player who wobbled, not to a shared pill', () => {
  players(2);
  const g = sleepyBear.create(2);
  toFreeze(g, [0.5, 0.5]);
  run(g, GRACE + 0.2, [0, WOBBLE * 3]);
  assert.ok(g.wob[1] > 0, 'player 2 has their own Wobble!');
  assert.equal(g.wob[0], 0, 'player 1 does not');
  assert.ok(!/wobble/i.test(g.hud().words.text), 'no shared pill: "' + g.hud().words.text + '"');
  assert.doesNotThrow(() => g.draw(fakeCtx(), 1920, 1080), 'it draws (above the head)');
  run(g, 2, [0, 0]);
  assert.equal(g.wob[1], 0, 'and goes away again');
});
