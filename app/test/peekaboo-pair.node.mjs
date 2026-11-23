/* Peekaboo Garden, both sides together (plans K4 + K5): the real shell and the real game on the TV page, the Node hub, the built pad page and the real
   tablet program on a tablet page, no stand-in host (harness/peekaboo-pair.mjs). The seekers' hands are fake pose players. Run in a plain Node process by
   peekaboo-pair.test.mjs. Not covered: a real camera, a real Android tablet (frame rate, touch, sound). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startPair, until, sleep } from './harness/peekaboo-pair.mjs';

let P;
before(async () => { P = await startPair(); });
after(async () => { await P?.close(); });

const tabText = (sel) => P.tab.page.locator(sel).textContent();

test('1. the tablet joined from the join card and the TV started: both sides are in the hide phase on the same round', async () => {
  const s = await P.state();
  assert.equal(s.phase, 'hide');
  assert.equal(await P.tab.page.evaluate(() => window.__pk.net.phase), 'hide');
  assert.equal(await P.tv.page.evaluate(() => window.__pads.session.phase), 'playing');
  assert.equal(await P.tv.page.evaluate(() => window.__round().seekers.length), 2, 'two seekers (the fake hands)');
  assert.ok(s.hiderSeat >= 2, 'the hider is the phone, numbered after the camera players');
  assert.match(await tabText('.pk-banner'), /Hide!/);
});

test('2. the hider moves from the tablet: the stick drives the real game on the TV (up = away from the TV)', async () => {
  await P.setT(1);
  const z0 = (await P.state()).z;
  await P.drag(0, -0.9);
  await until(async () => (await P.state()).z > z0 + 0.8, 12000, 'the game hider moved');
  await P.release();
  await until(async () => { const a = (await P.state()).z; await sleep(300); return Math.abs((await P.state()).z - a) < 0.01; }, 6000, 'the hider stops after release');
  await until(async () => Math.abs((await P.tab.page.evaluate(() => window.__pk.me.z)) - (await P.state()).z) < 0.2, 6000, 'tablet and game agree');
  assert.equal(await P.tv.page.evaluate(() => window.__round().stick.y), 0, 'the host saw the stick let go');
});

test('3. a pot and "Step out" through the real game', async () => {
  await P.setT(1);
  await P.tv.page.evaluate(() => { const s = window.__round().round.state; s.x = 9.7; s.z = 9.9; });
  await until(async () => Math.hypot((await P.tab.page.evaluate(() => window.__pk.me.x)) - 9.7, (await P.tab.page.evaluate(() => window.__pk.me.z)) - 9.9) < 0.5, 10000, 'tablet to the game spot');
  await P.drag(-0.5, -0.9);
  await until(async () => (await P.state()).place === 'pot1', 10000, 'the game hider in pot1');
  await P.release();
  await P.tab.page.locator('.pk-out.show').waitFor({ timeout: 5000 });
  await P.tab.page.locator('.pk-out').tap();
  await until(async () => (await P.state()).place === null, 6000, 'out of the pot');
  await P.tab.page.locator('.pk-out.show').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
  assert.equal(await P.tab.page.locator('.pk-out.show').count(), 0);
});

test('4. seek: a fake hand\'s lantern comes near (the tablet glows), then lights the hider; found reaches the TV and the tablet', async () => {
  await P.setT(9.9);
  await until(async () => (await P.state()).phase === 'seek', 8000, 'seek');
  await until(() => P.tab.page.evaluate(() => window.__pk.net.phase === 'seek'), 5000, 'the tablet in seek');
  assert.match(await tabText('.pk-banner'), /They're looking!/);
  const s = await P.state();
  await P.hands([{ seat: 0, x: s.x + 3, z: s.z + 1 }, { seat: 1, x: 5, z: 26 }]);
  await until(async () => Number(await P.tab.page.locator('.pk-glow').evaluate(e => e.style.opacity || 0)) > 0.1, 8000, 'the tablet edge glow');
  assert.ok(await P.tab.page.evaluate(() => window.__pk.net.lanterns.length >= 1), 'the lantern reached the tablet');
  assert.equal((await P.state()).phase, 'seek', 'not found yet');
  await P.hands([{ seat: 0, x: s.x, z: s.z }, { seat: 1, x: 5, z: 26 }]);
  await until(async () => (await P.state()).phase === 'reveal', 15000, 'found');
  const f = await P.state();
  assert.equal(f.result, 'found'); assert.equal(f.foundBy, 0, 'found by the seeker whose hand lit them');
  await P.tab.page.locator('.pk-result.pk-on').waitFor({ timeout: 8000 });
  assert.match(await tabText('.pk-result'), /They found you!/);
  assert.equal(await P.tab.page.evaluate(() => window.__pk.cs.face), 'front');
  assert.match(await P.tv.page.evaluate(() => window.__round().line()), /^Found by .+ in \d+:\d\d!$/);
});

test('5. Play again keeps the same hider (same phone, same seat) and the tablet starts a fresh "Hide!"', async () => {
  const seatBefore = (await P.state()).hiderSeat, devBefore = await P.tab.page.evaluate(() => localStorage.getItem('orlis.pad.device'));
  await P.hands([{ seat: 0, x: 25, z: 26 }, { seat: 1, x: 5, z: 26 }]);
  await P.setT(3.9);                                       /* (the TV draws in software here: skip most of the 4 s reveal) */
  await P.tv.page.getByText('Play again').first().waitFor({ timeout: 45000 });
  await P.tv.page.getByText('Play again').first().click();
  /* the shell shows the join card again for the same phones (the hider is still in, ready); the TV presses Start */
  await until(async () => {
    const go = P.tv.page.locator('.joinstart:not(.wait)');
    if (await go.count()) { await go.first().click().catch(() => {}); }
    const s = await P.state().catch(() => null); return s && s.phase === 'hide' && s.result == null && s.t < 3;
  }, 40000, 'a new round');
  assert.equal(await P.tv.page.locator('.joinstart.wait').count(), 0, 'Start never waited: the same phone was still in');
  const s = await P.state();
  assert.equal(s.hiderSeat, seatBefore, 'the same hider');
  assert.equal(await P.tab.page.evaluate(() => localStorage.getItem('orlis.pad.device')), devBefore, 'the same phone, no new join');
  await until(() => P.tab.page.evaluate(() => window.__pk.net.phase === 'hide'), 8000, 'the tablet in the new hide');
  assert.equal(await P.tab.page.locator('.pk-result.pk-on').count(), 0, 'the old result card is gone');
  assert.match(await tabText('.pk-banner'), /Hide!/);
  /* the tablet is back at the start spot and the stick still works */
  await until(async () => Math.abs((await P.tab.page.evaluate(() => window.__pk.me.z)) - (await P.state()).z) < 0.3, 6000, 'tablet at the new start');
  const z0 = (await P.state()).z; await P.setT(1);
  await P.drag(0, -0.9);
  await until(async () => (await P.state()).z > z0 + 0.5, 10000, 'the hider moves again');
  await P.release();
});

test('6. the tablet drops: the TV pauses with "Waiting for … phone"; it rejoins by itself and the game resumes; time up shows "You stayed hidden!"', async () => {
  const seat = await P.tv.page.evaluate(() => window.__pads.session.seats.find(s => s.kind === 'pad').n);
  await P.tv.page.evaluate(() => { window.__seen = new Set(); setInterval(() => window.__seen.add(window.__pads.session.phase), 15); });   /* (it comes back fast: keep a record) */
  await P.tv.page.evaluate((n) => window.__pads.link.send.close(window.__pads.connOf(n)), seat);
  await P.tv.page.locator('.waitpill').waitFor({ timeout: 8000 });
  assert.match((await P.tv.page.locator('.waitpill .wt').innerText()).trim(), /^Waiting for .+'s phone$/);
  assert.ok(await P.tv.page.evaluate(() => window.__seen.has('paused')), 'the session paused');
  /* (the tablet comes back within a second, so look while the pill is up: the round clock does not move) */
  const t0 = (await P.state()).t; await sleep(120); const t1 = (await P.state()).t;
  if (await P.tv.page.locator('.waitpill').count()) assert.ok(Math.abs(t1 - t0) < 0.02, `the round clock stands still while paused (${t0} -> ${t1})`);
  await P.tv.page.locator('.waitpill').waitFor({ state: 'detached', timeout: 15000 });
  assert.equal(await P.tv.page.evaluate(() => window.__pads.session.phase), 'playing');
  await P.tab.page.locator('.pk-base').waitFor({ timeout: 8000 });
  await until(() => P.tab.page.evaluate(() => window.__pk && window.__pk.net.seen), 8000, 'the tablet is back on the garden');
  /* the game goes on: seek, nobody finds the hider, time runs out */
  await P.setT(9.9); await until(async () => (await P.state()).phase === 'seek', 8000, 'seek');
  await P.setT(59.9);
  await until(async () => (await P.state()).phase === 'reveal', 8000, 'time up');
  assert.equal((await P.state()).result, 'hidden');
  await P.tab.page.locator('.pk-result.pk-on').waitFor({ timeout: 8000 });
  assert.match(await tabText('.pk-result'), /You stayed hidden!/);
  assert.equal(await P.tv.page.evaluate(() => window.__round().line()), 'You stayed hidden!');
  assert.deepEqual(P.tv.errors.filter(e => !/GL Driver|ReadPixels/.test(String(e))).map(String), [], 'no errors on the TV');
  assert.deepEqual(P.tab.errors.map(String), [], 'no errors on the tablet');
});
