/* The Peekaboo tablet view (plan package K5), end to end: the Node pad hub, the built pad page, the real tablet program in headless Chromium (WebGL, software),
   and a stand-in game host running the real rules (harness/peekaboo-rig.mjs). Run in a plain Node process by peekaboo-pad.test.mjs.
   Spec: docs/specs/peekaboo-views.md, "Tests", K5: the tablet joins, the round starts, the stick moves the hider on the host, entering a pot then
   "Step out" works, the found result reaches the tablet. Not covered: a real Android tablet (frame rate, touch feel, sound). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startPeekabooRig, TABLET, sleep, until } from './harness/peekaboo-rig.mjs';
import { T } from './harness/slowness.mjs';

let rig, tab;
before(async () => {
  rig = await startPeekabooRig();
  tab = await rig.tablet({ ...TABLET, deviceScaleFactor: 1 });       /* (1x: software GL has to draw it) */
});
after(async () => { await rig?.close(); });

const host = () => rig.host, round = () => rig.host.round.state;
const pk = (fn, arg) => tab.page.evaluate(fn, arg);
async function drag(dx, dy) {                                         /* a thumb on the stick: from the middle of the base, dx/dy of its radius */
  const b = await tab.page.locator('.pk-base').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await tab.page.mouse.move(cx, cy); await tab.page.mouse.down();
  await tab.page.mouse.move(cx + dx * b.width / 2, cy + dy * b.height / 2, { steps: 3 });
}
const release = () => tab.page.mouse.up();
const fresh = () => { const r = round(); if (r.phase === 'hide' || r.phase === 'seek') r.t = Math.min(r.t, 3); };   /* (software GL is slow: keep the round clock from running out) */

test('1. the tablet joins: the 3D view is up, the round starts in the hide phase, with the leaves, the ring and the stick', async () => {
  assert.equal(await pk(() => window.__pk.net.phase), 'hide');
  assert.equal(await tab.page.locator('.pk-gl').count(), 1);
  assert.equal(await tab.page.locator('.pk-leaves i').count(), 3);
  assert.equal(await tab.page.locator('.pk-base').count(), 1);
  assert.equal(await tab.page.locator('.pk-out.show').count(), 0, 'no "Step out" in the open');
  const px = await pk(() => { const c = document.querySelector('.pk-gl'); return c.width > 100 && c.height > 100; });
  assert.ok(px, 'the canvas has a size');
  assert.ok(rig.host.sent.state > 3, 'states arrive');
  assert.match(await tab.page.locator('.pk-banner').textContent(), /Hide!/);
});

test('2. the stick moves the hider: on the tablet at once, then on the host (up = away from the TV), and a release stops it', async () => {
  fresh(); const z0 = round().z, x0 = round().x, n0 = rig.host.inputs.length;
  await drag(0, -0.9);                                                // thumb pushed up
  await until(() => round().z > z0 + 0.8, 8000, 'the host hider moved away from the TV');
  const mine = await pk(() => ({ z: window.__pk.me.z, x: window.__pk.me.x }));
  assert.ok(mine.z > z0 + 0.2, 'the tablet moved its own hider too');
  assert.ok(Math.abs(round().x - x0) < 0.3, 'straight ahead');
  const sent = rig.host.inputs.slice(n0).filter(m => m.stick);
  assert.ok(sent.length >= 3 && sent.some(m => m.stick.y > 0.5) && sent.every(m => m.stick.y >= 0), 'stick messages go out while held (about 20 a second), y up is positive');
  await release();
  await until(() => { const l = rig.host.inputs.at(-1); return l && l.stick && l.stick.x === 0 && l.stick.y === 0; }, 3000, 'a zero stick on release');
  const z1 = round().z; await sleep(500);
  assert.ok(Math.abs(round().z - z1) < 0.05, 'stopped');
  /* the tablet and the host agree once still */
  await until(async () => Math.abs((await pk(() => window.__pk.me.z)) - round().z) < 0.15, 4000, 'tablet follows the host');
});

test('3. a pot: walking in shows "Step out", the stick is ignored inside, "Step out" puts the hider back out and the button goes', async () => {
  fresh(); const r = round(); r.x = 9.7; r.z = 9.9;                              /* near pot1 (9, 11); the tablet takes the host\'s word */
  await until(async () => Math.hypot((await pk(() => window.__pk.me.x)) - 9.7, (await pk(() => window.__pk.me.z)) - 9.9) < 0.5, 10000, 'tablet moved to the host spot');
  await drag(-0.5, -0.9);
  await until(() => round().place === 'pot1', 8000, 'the host hider is in pot1');
  await until(() => pk(() => window.__pk.me.place === 'pot1'), 3000, 'and so is the tablet');
  await release();
  await tab.page.locator('.pk-out.show').waitFor({ timeout: T(5000) });
  assert.match(await tab.page.locator('.pk-out').textContent(), /Step out/);
  const inPotAt = { x: round().x, z: round().z };
  await drag(1, 0); await sleep(700);                                   /* the stick does nothing in a pot */
  assert.ok(Math.hypot(round().x - inPotAt.x, round().z - inPotAt.z) < 0.01, 'the host ignored the stick in the pot');
  await release();
  await tab.page.locator('.pk-out').tap();
  await until(() => round().place === null, 5000, 'the host let the hider out');
  assert.ok(round().z < 11 - 0.7, 'out at the front edge (nearest the TV)');
  await tab.page.locator('.pk-out.show').waitFor({ state: 'detached', timeout: T(3000) }).catch(() => {});
  assert.equal(await tab.page.locator('.pk-out.show').count(), 0, 'the button is gone');
  assert.ok(rig.host.sent.ev.includes('enter') && rig.host.sent.ev.includes('leave'), 'enter and leave events were sent');
  /* (the stray `act` is sent once, and again only while the host still says "pot") */
  assert.ok(rig.host.inputs.filter(m => m.act === 'out').length <= 3);
});

test('4. seeking: "They\'re looking!", a lantern pool appears, the screen edge glows as it nears, and the found result reaches the tablet', async () => {
  const r = round(); r.phase = 'seek'; r.t = 0; r.meter = 0; rig.host.sendState();
  await until(() => pk(() => window.__pk.net.phase === 'seek'), 3000, 'seek phase on the tablet');
  assert.match(await tab.page.locator('.pk-banner').textContent(), /They're looking!/);
  /* a lantern 3 steps off: near falls, the glow comes up, but not found */
  rig.host.lanterns = [{ seat: 1, x: r.x + 3, z: r.z + 1 }];
  await until(async () => Number(await tab.page.locator('.pk-glow').evaluate(e => e.style.opacity || 0)) > 0.1, 6000, 'edge glow');
  assert.ok(await pk(() => window.__pk.net.lanterns.length === 1));
  assert.ok(await pk(() => window.__pk.scene.children.some(o => o.material && o.material.blending === 2 && o.visible)), 'a light pool is drawn on the lawn');
  /* the lantern finds the hider (in the open: 0.4 s) */
  rig.host.lanterns = [{ seat: 1, x: r.x, z: r.z }];
  await tab.page.locator('.pk-result.pk-on').waitFor({ timeout: T(8000) });
  assert.match(await tab.page.locator('.pk-result').textContent(), /They found you!/);
  assert.equal(await pk(() => window.__pk.net.phase), 'reveal');
  assert.equal(await pk(() => window.__pk.cs.face), 'front', 'the card turns to face you');
});

test('5. the next round starts with the same hider ("Hide!" again); time up shows "You stayed hidden!"', async () => {
  rig.host.lanterns = [];
  await until(() => pk(() => window.__pk.net.phase === 'hide'), 12000, 'next hide');
  assert.match(await tab.page.locator('.pk-banner').textContent(), /Hide!/);
  assert.equal(await tab.page.locator('.pk-result.pk-on').count(), 0, 'the result card is gone');
  const r = round(); r.phase = 'seek'; r.t = 59.95; rig.host.sendState();
  await tab.page.locator('.pk-result.pk-on').waitFor({ timeout: T(8000) });
  assert.match(await tab.page.locator('.pk-result').textContent(), /You stayed hidden!/);
});

test('6. a pause stops the stick and dims the screen; resume carries on; no page errors in all of it', async () => {
  await until(() => pk(() => window.__pk.net.phase === 'hide'), 12000, 'hide again');
  rig.host.send(rig.host.to, { t: 'pause', why: 'seat' });
  await tab.page.locator('.pk-pause.on').waitFor({ timeout: T(3000) });
  rig.host.send(rig.host.to, { t: 'resume' });
  await tab.page.locator('.pk-pause.on').waitFor({ state: 'detached', timeout: T(3000) }).catch(() => {});
  assert.equal(await tab.page.locator('.pk-pause.on').count(), 0);
  assert.deepEqual(tab.errors.filter(e => !/GL Driver|ReadPixels/.test(String(e))).map(String), []);
});
