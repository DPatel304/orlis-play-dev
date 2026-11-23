/* Peekaboo Garden on the host (plan package K4): the manifest, the fixed camera, the lanterns made from hands, the messages to the hider's
   tablet, and whole rounds to "found" and to "hidden". The 3D drawing is tested in peekaboo-tv.node.mjs (a real browser). */
import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/peekaboo.js';
import { GAMES } from '../src/games/index.js';
import { pose } from '../src/tracking/pose.js';
import { floorPoint, screenPoint } from '../src/games/peekaboo/camera.js';
import { LIGHT_RADIUS, HIDE_TIME, SEEK_TIME, REVEAL_TIME } from '../src/games/peekaboo/rules.js';
import { createWorld } from '../src/games/peekaboo/world.js';

const W = 1920, H = 1080, DT = 1 / 60;

function fakePads() {
  const handlers = {}, sent = [], states = [];
  return {
    seats: [
      { n: 0, kind: 'tracked', who: 'mia', name: 'Mia', avatar: null, colour: 'pink' },
      { n: 1, kind: 'tracked', who: 'sam', name: 'Sam', avatar: null, colour: 'orange' },
      { n: 2, kind: 'pad', who: 'ola', name: 'Ola', avatar: null, colour: 'green' }],
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); return () => { handlers[name] = handlers[name].filter(f => f !== fn); }; },
    send(to, m) { sent.push({ to, m }); }, state(s) { states.push(s); },
    fire(name, arg) { (handlers[name] || []).forEach(f => f(arg)); }, handlers, sent, states
  };
}
/* seekers' hands: list of { seat, x, z, speed } floor points shown on the screen at those places */
function hands(list) {
  for (let i = 0; i < 4; i++) pose.players[i].present = false;
  for (const l of list) {
    const p = pose.players[l.seat], s = screenPoint(l.x, l.z, 0, W / H);
    p.present = true;
    p.hands.left = { x: s.x, y: s.y, vx: 0, vy: 0, speed: l.left ?? 1 };
    p.hands.right = { x: s.x, y: s.y, vx: 0, vy: 0, speed: l.right ?? 1 };
  }
}
const run = (g, secs, each) => { for (let i = 0; i < Math.round(secs / DT) && !g.over; i++) { if (each) each(); g.step(DT, W, H); } };
const types = (pads) => pads.sent.map(s => s.m.e);

test('the manifest: a phone is the hider, one or two seekers on the camera, listed in the games', () => {
  assert.equal(game.id, 'peekaboo'); assert.equal(game.name, 'Peekaboo Garden');
  assert.deepEqual(game.seats, { tracked: [1, 2], pads: [1, 1] });
  assert.deepEqual(game.pads, { program: '/pads/peekaboo/', need: 'view3d' });
  assert.equal(game.requiredPads, 1);
  assert.ok(GAMES.includes(game));
});

test('the fixed camera: the screen and the floor map both ways, and the whole garden is in view', () => {
  for (const asp of [16 / 9, 4 / 3]) {
    for (const [x, z] of [[3, 3], [15, 15], [27, 5], [10, 25]]) {
      const s = screenPoint(x, z, 0, asp), f = floorPoint(s.x, s.y, asp);
      assert.ok(Math.abs(f.x - x) < 1e-6 && Math.abs(f.z - z) < 1e-6, `${x},${z} round trip`);
    }
    for (const [x, z] of [[0, 0], [30, 0], [0, 30], [30, 30]]) { const s = screenPoint(x, z, 0, asp); assert.ok(s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1, `corner ${x},${z} on screen at ${asp.toFixed(2)}`); }
  }
  assert.equal(floorPoint(0.5, -2, 16 / 9), null, 'a ray above the floor gives nothing');
  const near = screenPoint(15, 2).y, far = screenPoint(15, 28).y;
  assert.ok(near > far, 'the front of the garden (near the TV) is at the bottom of the screen');
});

test('lanterns: a seeker\'s busiest hand becomes a point on the floor; no hand seen, no lantern', () => {
  const pads = fakePads(), g = game.create(2, { pads });
  g.round.state.phase = 'seek'; g.round.state.t = 0;
  hands([{ seat: 0, x: 10, z: 12, left: 0.1, right: 2 }, { seat: 1, x: 20, z: 8 }]);
  run(g, 1);
  assert.equal(g.lanterns.length, 2);
  const a = g.lanterns.find(l => l.seat === 0), b = g.lanterns.find(l => l.seat === 1);
  assert.ok(Math.hypot(a.x - 10, a.z - 12) < 0.05 && Math.hypot(b.x - 20, b.z - 8) < 0.05, 'the lantern is where the hand points on the floor');
  /* the busiest hand is the one that moved most lately: swap which hand moves */
  const p = pose.players[0], s2 = screenPoint(5, 20, 0, W / H);
  p.hands.left = { x: s2.x, y: s2.y, vx: 0, vy: 0, speed: 5 }; p.hands.right = { x: p.hands.right.x, y: p.hands.right.y, vx: 0, vy: 0, speed: 0 };
  run(g, 2);
  const a2 = g.lanterns.find(l => l.seat === 0);
  assert.ok(Math.hypot(a2.x - 5, a2.z - 20) < 0.3, 'the lantern follows the hand that moves more');
  hands([{ seat: 1, x: 20, z: 8 }]); run(g, 0.1);
  assert.deepEqual(g.lanterns.map(l => l.seat), [1], 'seeker 0 is not seen: no lantern');
  const snap = g.snapshot();
  assert.deepEqual(Object.keys(snap).sort(), ['clock', 'hider', 'lanterns', 'leaves', 'meter', 'near', 'phase', 'rustles']);
  assert.deepEqual(snap.lanterns.map(l => Object.keys(l).sort()), [['seat', 'x', 'z']]);
  assert.ok(Array.isArray(snap.rustles));
});

test('no lanterns during hide, and none are sent to the tablet', () => {
  const pads = fakePads(), g = game.create(2, { pads });
  hands([{ seat: 0, x: 15, z: 3 }]);
  run(g, 2);
  assert.equal(g.round.state.phase, 'hide'); assert.deepEqual(g.lanterns, []);
  assert.deepEqual(pads.states[pads.states.length - 1].lanterns, []);
});

test('the tablet\'s input moves the hider; only the hider\'s seat is heard; the state goes out about 20 times a second', () => {
  const pads = fakePads(), g = game.create(2, { pads });
  const x0 = g.round.state.x;
  pads.fire('input', { seat: 1, who: 'sam', m: { t: 'in', stick: { x: 1, y: 0 } } });    /* a seeker's seat: ignored */
  run(g, 0.5); assert.equal(g.round.state.x, x0);
  pads.fire('input', { seat: 2, who: 'ola', m: { t: 'in', stick: { x: 1, y: 0 } } });
  run(g, 1);
  assert.ok(g.round.state.x > x0 + 2, 'the stick moves the hider');
  pads.fire('input', { seat: 2, who: 'ola', m: { t: 'in', stick: { x: 0, y: 0 } } });
  const x1 = g.round.state.x; run(g, 0.5); assert.equal(g.round.state.x, x1, 'released: stands still');
  assert.ok(pads.states.length >= 14 && pads.states.length <= 40, `state sent ${pads.states.length} times in 2 s`);
  assert.equal(pads.sent[0].m.e, 'phase'); assert.equal(pads.sent[0].m.name, 'hide'); assert.equal(pads.sent[0].to, 2, 'events go to the hider\'s seat');
});

test('a pot: enter, the stick is ignored, "out" steps out (events reach the tablet)', () => {
  const pads = fakePads(), g = game.create(2, { pads }), pot = createWorld().places.find(p => p.kind === 'pot');
  g.round.state.x = pot.x - 1; g.round.state.z = pot.z;
  pads.fire('input', { seat: 2, m: { stick: { x: 1, y: 0 } } }); run(g, 0.5);
  assert.equal(g.round.state.place, pot.id); assert.ok(types(pads).includes('enter'));
  const x = g.round.state.x; run(g, 0.5); assert.equal(g.round.state.x, x, 'stuck in the pot while the stick is held');
  pads.fire('input', { seat: 2, m: { act: 'out' } }); run(g, 0.1);
  assert.equal(g.round.state.place, null); assert.ok(types(pads).includes('leave'));
});

test('a rustle is sent to the tablet and listed in the snapshot for a second', () => {
  const pads = fakePads(), g = game.create(2, { pads }), bush = createWorld().places.find(p => p.kind === 'bush');
  g.round.state.x = bush.x - 3; g.round.state.z = bush.z;
  pads.fire('input', { seat: 2, m: { stick: { x: 1, y: 0 } } }); run(g, 0.7);
  assert.ok(pads.sent.some(s => s.m.e === 'rustle' && s.m.placeId === bush.id));
  assert.deepEqual(g.snapshot().rustles, [bush.id]);
  pads.fire('input', { seat: 2, m: { stick: { x: 0, y: 0 } } }); run(g, 1.2);
  assert.deepEqual(g.snapshot().rustles, [], 'a second later it is gone');
});

test('a whole round to found: the lantern holds on the hider; "Found by Mia in 0:xx!"; the round ends after the reveal', () => {
  const pads = fakePads(), g = game.create(2, { pads });
  run(g, HIDE_TIME + 0.05);
  assert.equal(g.round.state.phase, 'seek');
  const st = g.round.state;
  for (let i = 0; i < 1200 && g.round.state.phase === 'seek'; i++) { hands([{ seat: 0, x: st.x, z: st.z }, { seat: 1, x: 3, z: 25 }]); g.step(DT, W, H); }
  assert.equal(g.round.state.phase, 'reveal'); assert.equal(g.result, 'found'); assert.equal(g.foundBy, 0);
  const t = types(pads); assert.deepEqual(t.filter(e => e === 'found' || e === 'phase'), ['phase', 'phase', 'found', 'phase']);
  assert.deepEqual(pads.sent.filter(s => s.m.e === 'phase').map(s => s.m.name), ['hide', 'seek', 'reveal']);
  assert.equal(pads.sent.find(s => s.m.e === 'found').m.by, 0);
  assert.match(g.summary(), /^Found by Mia in 0:00!$/, 'in the open a lantern needs 0.4 s, so well under a second of seek');
  assert.ok(!g.over); run(g, REVEAL_TIME + 0.5); assert.ok(g.over, 'over after the reveal');
  assert.equal(g.value(), 1); assert.equal(g.winner(), 0);
  const rows = g.tally(); assert.equal(rows.length, 2); assert.deepEqual(rows.map(r => r.value), [1, 0]);
});

test('a whole round to hidden: nobody finds them; "You stayed hidden!"', () => {
  const pads = fakePads(), g = game.create(2, { pads });
  hands([{ seat: 0, x: 3, z: 25 }, { seat: 1, x: 27, z: 27 }]);
  run(g, HIDE_TIME + SEEK_TIME + 0.2);
  assert.equal(g.round.state.phase, 'reveal'); assert.equal(g.result, 'hidden');
  assert.ok(types(pads).includes('hidden')); assert.equal(g.summary(), 'You stayed hidden!');
  run(g, REVEAL_TIME + 0.5); assert.ok(g.over);
  const n = pads.sent.length; g.step(DT, W, H); assert.equal(pads.sent.length, n, 'nothing more after it is over');
});

test('pause: a game that is not stepped does not move; coming back tells the tablet the phase again; a dropped phone lets go of the stick', () => {
  const pads = fakePads(), g = game.create(2, { pads });
  pads.fire('input', { seat: 2, m: { stick: { x: 1, y: 0 } } }); run(g, 0.5);
  const t = g.round.state.t, x = g.round.state.x;
  pads.fire('leave', { seat: 2 });
  pads.fire('resume'); assert.deepEqual(pads.sent[pads.sent.length - 1], { to: 2, m: { e: 'phase', name: 'hide' } });
  assert.equal(g.round.state.t, t); assert.equal(g.round.state.x, x);
  run(g, 0.5); assert.equal(g.round.state.x, x, 'the stick was let go when the phone dropped');
  pads.fire('join', { seat: 2 });
  g.destroy(); assert.equal(Object.values(pads.handlers).flat().length, 0, 'handlers are released');
});

test('the shell\'s views of the game: hud, tally, winner, value, still', () => {
  hands([]);
  const g = game.create(1);
  g.stillMode = true;                          /* the home tile's picture: never the 3D layer */
  const c = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
  assert.doesNotThrow(() => g.draw(c, W, H));
  assert.equal(g.view, null); assert.equal(g.viewState, '');
  assert.equal(g.winner(), null); assert.equal(g.tally().length, 1); assert.equal(g.value(), 0);
  assert.equal(game.endless, true);
});
