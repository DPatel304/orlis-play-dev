/* The Peekaboo TV view in a real browser (plan package K4), run in a plain Node process by peekaboo-tv.test.mjs: the real game object is driven with a
   fake phone and fake hands (test/harness/peekaboo-page.js) and the 3D garden is drawn through every phase without errors; what the view shows is
   read from its scene. The game also opens in the real shell as far as the join card. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startRig, toJoinCard, until } from './harness/pads-rig.mjs';

let rig;
before(async () => { rig = await startRig(); });
after(async () => { await rig?.close(); });

test('the TV view draws hide, seek (two lanterns, a rustle, a silhouette in the light), found and hidden without errors', async () => {
  const tv = await rig.tv(null, { extra: '&home' });
  const { page } = tv, go = (fn) => page.evaluate(fn);
  await page.locator('.btn.burger').waitFor({ timeout: 30000 });
  await go(async () => { window.pk = (await import('/test/harness/peekaboo-page.js')).setup(); window.pk.loop(); });

  /* hide: dim, no lanterns, nobody drawn */
  await go(() => { const pk = window.pk; pk.start(); pk.stick(1, 0); pk.step(2); pk.stick(0, 0); pk.step(2); });
  await until(() => go(() => { const l = window.pk.look(); return l && l.phase === 'hide'; }), 20000, 'the 3D view');
  await until(() => go(() => window.pk.look().dim > 0.4), 5000, 'the dim');
  let look = await go(() => window.pk.look());
  assert.equal(look.lanterns, 0); assert.equal(look.hider, false);

  /* seek: both lanterns show; the one on the hider shows a faint silhouette; the bush rustles */
  await go(() => { const pk = window.pk, s = pk.inst.round.state; pk.step(6.2); pk.inst.draw(pk.c, pk.W, pk.H); pk.stick(-0.25, 0.1);
    pk.step(0.3, () => pk.hands([{ seat: 0, x: s.x - 1.1, z: s.z + 0.5 }, { seat: 1, x: 9, z: 14 }])); pk.inst.draw(pk.c, pk.W, pk.H); });
  look = await go(() => window.pk.look());
  assert.equal(look.phase, 'seek'); assert.equal(look.lanterns, 2); assert.equal(look.rustling, 1, 'the bush shakes');
  await until(() => go(() => window.pk.look().hider), 3000, 'the silhouette');
  assert.ok((await go(() => window.pk.look())).hiderOpacity < 0.9, 'only a faint silhouette while the meter fills');
  /* the lantern goes away: the silhouette fades and the lantern pool goes */
  await go(() => { window.pk.hands([]); window.pk.stick(0, 0); window.pk.step(1.5); });
  await until(() => go(() => { const l = window.pk.look(); return l.lanterns === 0 && !l.hider; }), 5000, 'lanterns and silhouette to go');

  /* found */
  await go(() => { const pk = window.pk, s = pk.inst.round.state; pk.step(8, () => pk.hands([{ seat: 0, x: s.x, z: s.z + 0.2 }])); });
  await until(() => go(() => { const l = window.pk.look(); return l.phase === 'reveal' && l.hider && l.hiderOpacity > 0.95; }), 8000, 'the reveal');
  assert.equal(await go(() => window.pk.inst.result), 'found');

  /* hidden */
  await go(() => { const pk = window.pk; pk.start(); pk.hands([]); pk.step(10 + 60 + 1); });
  await until(() => go(() => { const l = window.pk.look(); return l && l.phase === 'reveal' && l.hider && l.hiderOpacity > 0.95; }), 20000, 'the reveal after a hidden round');
  assert.equal(await go(() => window.pk.inst.result), 'hidden');
  assert.deepEqual(tv.errors.map(String), [], 'no errors on the TV');
});

test('the game opens in the real shell as far as the join card, and its home tile still is not 3D', async () => {
  const tv = await rig.tv('peekaboo');
  await toJoinCard(tv);
  assert.equal(await tv.page.locator('.joinstart.wait').count(), 1, 'Start waits for the hider\'s phone');
  assert.equal(await tv.page.evaluate(() => window.__pads.game.id), 'peekaboo');
  assert.deepEqual(tv.errors.map(String), [], 'no errors on the TV');
  const home = await rig.tv(null, { extra: '&home' });
  await home.page.locator('.btn.burger').waitFor({ timeout: 30000 });
  await home.page.waitForTimeout(1500);
  assert.equal(await home.page.evaluate(() => document.querySelectorAll('canvas[style*="position:fixed"]').length > 1), false, 'no 3D layer on the home screen');
  assert.deepEqual(home.errors.map(String), []);
});
