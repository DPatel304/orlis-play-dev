import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/games/peekaboo/world.js';
import { createRound, HIDE_TIME, SEEK_TIME, REVEAL_TIME } from '../src/games/peekaboo/rules.js';

const DT = 1 / 20;                                   /* a fixed step: 20 a second */
const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const fresh = () => {
  const world = createWorld({ rng: seeded() });
  const round = createRound(world, { hider: 0, seekers: [1, 2], rng: seeded() });
  return { world, round, me: round.state };
};
/* run n steps with the same inputs (a function gets the step number); collect every event */
const run = (round, n, inputs = {}) => {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...round.step(DT, typeof inputs === 'function' ? inputs(i) : inputs));
  return ev;
};
const seek = round => { run(round, Math.round(HIDE_TIME / DT)); assert.equal(round.state.phase, 'seek'); };
/* put the hider in a place (or at a point) without walking */
const put = (world, me, id, dx = 0, dz = 0) => {
  const p = world.place(id); me.x = p.x + dx; me.z = p.z + dz; me.place = id;
};
const lamp = (me, seat = 1) => ({ seat, x: me.x, z: me.z });
/* seconds of holding one lantern on the hider until found */
const timeToFind = (round, me) => {
  for (let i = 1; i < 400; i++) {
    const ev = round.step(DT, { lanterns: [lamp(me)] });
    if (ev.some(e => e.type === 'found')) return i * DT;
  }
  return Infinity;
};

test('the layout: nine places, three of each kind, none within 4 steps of another or behind the shed', () => {
  const { world } = fresh();
  assert.equal(world.places.length, 9);
  for (const k of ['grass', 'bush', 'pot']) assert.equal(world.places.filter(p => p.kind === k).length, 3);
  for (const a of world.places) {
    for (const b of world.places) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 4, `${a.id} ${b.id}`);
    assert.ok(!(a.x > world.shed.x0 && a.x < world.shed.x1 && a.z > world.shed.z0 - 1), `${a.id} behind the shed`);
    assert.equal(world.clamp(a.x, a.z).x, a.x, `${a.id} is reachable (not inside a blocker)`);
    assert.equal(world.clamp(a.x, a.z).z, a.z);
  }
});

test('1. hide lasts 10 s, seek 60 s, reveal 4 s, then the next round with the same hider', () => {
  const { round, me } = fresh();
  const names = [];
  const go = (secs, inputs) => run(round, Math.round(secs / DT), inputs).forEach(e => e.type === 'phase' && names.push(e.name));
  go(HIDE_TIME - DT); assert.equal(me.phase, 'hide');
  go(DT); assert.equal(me.phase, 'seek');
  go(SEEK_TIME - DT); assert.equal(me.phase, 'seek');
  go(DT); assert.equal(me.phase, 'reveal');
  go(REVEAL_TIME - DT); assert.equal(me.phase, 'reveal');
  go(DT, { seekers: [3] });
  assert.equal(me.phase, 'hide');
  assert.deepEqual(names, ['seek', 'reveal', 'hide']);
  assert.equal(me.round, 2);
  assert.equal(me.hider, 0, 'same hider');
  assert.deepEqual(me.seekers, [3], 'seekers are reset at each hide');
  assert.equal(me.meter, 0);
});

test('2. lanterns do nothing during hide', () => {
  const { round, me } = fresh();
  run(round, 100, () => ({ lanterns: [lamp(me)] }));
  assert.equal(me.phase, 'hide');
  assert.equal(me.meter, 0);
  assert.equal(round.snapshot().near, 1);
});

test('3. one lantern finds the hider in T: open 0.4, grass 0.8, bush 1.2, pot 2.0', () => {
  for (const [id, T] of [[null, 0.4], ['grass1', 0.8], ['bush1', 1.2], ['pot1', 2.0]]) {
    const { world, round, me } = fresh();
    seek(round);
    if (id) put(world, me, id); else { me.x = 15; me.z = 15; me.place = null; }
    const t = timeToFind(round, me);
    assert.ok(Math.abs(t - T) <= DT + 1e-9, `${id || 'open'}: ${t} vs ${T}`);
    assert.equal(me.phase, 'reveal');
    assert.equal(me.result, 'found');
  }
});

test('4. two lanterns fill no faster than one; unlit the meter drains at half speed and stops at 0', () => {
  const { world, round, me } = fresh();
  seek(round); put(world, me, 'grass1');          /* T = 0.8 */
  run(round, 8, { lanterns: [lamp(me, 1)] });
  const one = me.meter;
  assert.ok(Math.abs(one - 8 * DT / 0.8) < 1e-9);
  const b = fresh(); seek(b.round); put(b.world, b.me, 'grass1');
  run(b.round, 8, { lanterns: [lamp(b.me, 1), lamp(b.me, 2)] });
  assert.ok(Math.abs(b.me.meter - one) < 1e-9, 'same as one lantern');
  run(round, 4, {});                                /* unlit: drains 4 * DT / 1.6 */
  assert.ok(Math.abs(me.meter - (one - 4 * DT / 1.6)) < 1e-9);
  run(round, 200, {});
  assert.equal(me.meter, 0);
});

test('5. sneaking: moving in seek works; leaving a bush for open ground changes T to 0.4 s at once', () => {
  const { world, round, me } = fresh();
  seek(round); put(world, me, 'bush1');
  run(round, 6, () => ({ lanterns: [lamp(me)] }));         /* standing still in the bush */
  assert.ok(Math.abs(me.meter - 6 * DT / 1.2) < 1e-9);
  const x0 = me.x;
  let before = me.meter, left = false;
  for (let i = 0; i < 40 && !left; i++) {
    before = me.meter;
    round.step(DT, { stick: { x: 1, y: 0 }, lanterns: [lamp(me)] });
    left = me.place === null;
  }
  assert.ok(me.x > x0, 'the hider moved while seeking');
  assert.ok(left, 'out of the bush');
  assert.ok(Math.abs(me.meter - before - DT / 0.4) < 1e-9, 'that very step already counts at 0.4 s');
});

test('6. pot: the stick is ignored inside; out steps to the front edge and moving works again', () => {
  const { world, round, me } = fresh();
  seek(round);
  const p = world.place('pot1');
  me.x = p.x - 3; me.z = p.z; me.place = null;
  run(round, 30, { stick: { x: 1, y: 0 } });                /* walk into the pot */
  assert.equal(me.place, 'pot1');
  const at = { x: me.x, z: me.z };
  const ev = run(round, 10, { stick: { x: 1, y: 1 } });
  assert.deepEqual({ x: me.x, z: me.z }, at, 'stick ignored');
  assert.ok(!ev.some(e => e.type === 'leave'));
  const ev2 = round.step(DT, { act: 'out' });
  assert.deepEqual(ev2, [{ type: 'leave', placeId: 'pot1' }]);
  assert.equal(me.place, null);
  assert.ok(me.z < p.z - p.r, 'at the front edge (toward the TV)');
  assert.ok(Math.abs(me.x - p.x) < 1e-9);
  const z0 = me.z;
  run(round, 5, { stick: { x: 0, y: -1 } });
  assert.ok(me.z < z0, 'moving works again');
});

test('7. rustle: moving near a bush rustles; grass does not; standing still never does', () => {
  const { world, round, me } = fresh();
  seek(round);
  put(world, me, 'bush1', 0, -2.4); me.place = null;        /* 2.4 from the centre: 1.2 outside the edge */
  assert.ok(!run(round, 20, {}).some(e => e.type === 'rustle'), 'standing still near a bush');
  put(world, me, 'bush1');
  assert.ok(!run(round, 20, {}).some(e => e.type === 'rustle'), 'standing still in a bush');
  const ev = run(round, 4, { stick: { x: 1, y: 0 } });
  assert.ok(ev.some(e => e.type === 'rustle' && e.placeId === 'bush1'), 'moving in a bush');
  put(world, me, 'bush1', 0, -2.4); me.place = null; run(round, 1, {});   /* a pause first */
  assert.ok(run(round, 2, { stick: { x: 1, y: 0 } }).some(e => e.type === 'rustle'), 'moving close to a bush');
  put(world, me, 'grass1');
  assert.ok(!run(round, 20, { stick: { x: 0, y: 1 } }).some(e => e.type === 'rustle'), 'moving in grass');
});

test('8. bounds and blockers: the hedge and the shed stop the hider', () => {
  const { world, round, me } = fresh();
  run(round, 400, { stick: { x: -1, y: -1 } });
  assert.ok(me.x >= 0.5 && me.z >= 0.5);
  run(round, 600, { stick: { x: 1, y: 1 } });
  assert.ok(me.x <= 29.5 && me.z <= 29.5);
  const r2 = fresh(); r2.me.x = 15; r2.me.z = 18;
  run(r2.round, 200, { stick: { x: 0, y: 1 } });
  assert.ok(r2.me.z <= r2.world.shed.z0, 'stopped at the shed front');
  assert.ok(r2.me.z > 20);
  const r3 = fresh(); r3.me.x = 22 - 3; r3.me.z = 14;      /* a tree is at 22, 14 */
  run(r3.round, 100, { stick: { x: 1, y: 0 } });
  assert.ok(Math.hypot(r3.me.x - 22, r3.me.z - 14) >= 0.8, 'not inside the trunk');
});

test('9. leaves: 3 in a pot or bush, 2 in grass, 1 in the open, one less while moving', () => {
  const { world, round, me } = fresh();
  const leaves = () => round.snapshot().leaves;
  me.x = 15; me.z = 15; me.place = null;
  round.step(DT, {}); assert.equal(leaves(), 1);
  round.step(DT, { stick: { x: 1, y: 0 } }); assert.equal(leaves(), 0);
  put(world, me, 'grass1'); round.step(DT, {}); assert.equal(leaves(), 2);
  round.step(DT, { stick: { x: 0, y: 1 } }); assert.equal(leaves(), 1);
  put(world, me, 'bush1'); round.step(DT, {}); assert.equal(leaves(), 3);
  round.step(DT, { stick: { x: 0, y: 0.5 } }); assert.equal(leaves(), 2);
  put(world, me, 'pot1'); round.step(DT, {}); assert.equal(leaves(), 3);
});

test('10. foundBy is the seeker whose lantern added most to the meter', () => {
  for (const [first, second, who] of [[1, 2, 1], [2, 1, 2]]) {
    const { world, round, me } = fresh();
    seek(round); put(world, me, 'bush1');                   /* T = 1.2 */
    let ev = run(round, 14, { lanterns: [lamp(me, first)] });   /* 0.7 s */
    ev = run(round, 40, { lanterns: [lamp(me, second)] });      /* the rest */
    const found = ev.find(e => e.type === 'found');
    assert.equal(found.by, who);
    assert.equal(me.foundBy, who);
  }
});

test('11. time is up: hidden', () => {
  const { round, me } = fresh();
  seek(round);
  const ev = run(round, Math.round(SEEK_TIME / DT), { lanterns: [{ seat: 1, x: 0, z: 0 }] });
  assert.ok(ev.some(e => e.type === 'hidden'));
  assert.equal(me.phase, 'reveal');
  assert.equal(me.result, 'hidden');
  assert.equal(me.foundBy, null);
});

test('near: 0 when lit, 1 at 6 steps or more, between in the middle; snapshot has the spec shape', () => {
  const { round, me } = fresh();
  seek(round); me.x = 15; me.z = 15;
  round.step(DT, { lanterns: [{ seat: 1, x: 15, z: 15.5 }] });
  assert.equal(round.snapshot().near, 0);
  round.step(DT, { lanterns: [{ seat: 1, x: 15, z: 21 }] });
  assert.equal(round.snapshot().near, 1);
  round.step(DT, { lanterns: [{ seat: 1, x: 15, z: 18.75 }] });
  assert.ok(Math.abs(round.snapshot().near - 0.5) < 1e-9);
  assert.deepEqual(Object.keys(round.snapshot()).sort(), ['clock', 'hider', 'leaves', 'meter', 'near', 'phase']);
  assert.deepEqual(Object.keys(round.snapshot().hider).sort(), ['facing', 'moving', 'place', 'x', 'z']);
});
