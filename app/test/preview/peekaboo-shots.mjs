/* The owner's pictures for the Peekaboo TV view (plan package K4) into docs/k4/, at device scale 2, from the real game object driven with a fake
   phone and fake hands (test/harness/peekaboo-page.js):
     tv-hide.png     hide: the scene dims, "Seekers, close your eyes!", the sun ring filling
     tv-seek.png     seek: two lanterns, a bush rustling, the sun on its arc
     tv-found.png    reveal: the hider pops out, waves, "Found by Mia in 0:xx!"
     tv-hidden.png   reveal: "You stayed hidden!", the hider cheers
   Run:  cd app && node test/preview/peekaboo-shots.mjs */
import path from 'node:path';
import fs from 'node:fs';
import { startRig, APP } from '../harness/pads-rig.mjs';

const OUT = path.join(APP, '..', 'docs', 'k4');
fs.mkdirSync(OUT, { recursive: true });
const rig = await startRig();
try {
  const tv = await rig.tv(null, { scale: 2, extra: '&home' });
  const { page } = tv;
  await page.locator('.screen.home').waitFor({ timeout: 30000 });
  await page.evaluate(async () => { window.pk = (await import('/test/harness/peekaboo-page.js')).setup(); window.pk.loop(); });
  const shot = (name) => page.screenshot({ path: path.join(OUT, name) });
  const go = (fn, arg) => page.evaluate(fn, arg);
  const ready = async () => { for (let i = 0; i < 100; i++) { await go(() => window.pk.frames(2)); if (await go(() => !!window.pk.inst.view)) return; await page.waitForTimeout(100); } throw new Error('no 3D view'); };

  /* hide, five seconds in; the hider has walked into the bush at the right */
  await go(() => { const pk = window.pk; pk.start(); pk.stick(1, 0); pk.step(2); pk.stick(0, 0); pk.step(3); });
  await ready(); await page.waitForTimeout(800); await shot('tv-hide.png');
  /* seek: two lanterns, one close to the hider, a bush rustling */
  await go(() => { const pk = window.pk, s = pk.inst.round.state; pk.step(5.2); pk.inst.draw(pk.c, pk.W, pk.H); pk.stick(-0.25, 0.1);
    pk.step(0.3, () => pk.hands([{ seat: 0, x: s.x - 1.1, z: s.z + 0.5 }, { seat: 1, x: 9, z: 14 }])); pk.inst.draw(pk.c, pk.W, pk.H); });
  await page.waitForTimeout(100); await shot('tv-seek.png');
  /* found: hold the lantern on the hider until it is found, then the reveal a moment in */
  await go(() => { const pk = window.pk, s = pk.inst.round.state; pk.stick(0, 0);
    pk.step(0.5); pk.step(6, () => pk.hands([{ seat: 0, x: s.x, z: s.z + 0.3 }, { seat: 1, x: 9, z: 14 }])); pk.step(0.9); });
  await page.waitForTimeout(1200); await shot('tv-found.png');
  /* stayed hidden: nobody finds them */
  await go(() => { const pk = window.pk; pk.start(); pk.stick(1, 0); pk.step(2); pk.stick(0, 0); pk.hands([]); pk.step(8 + 60 + 1.0); });
  await page.waitForTimeout(1200); await shot('tv-hidden.png');
  console.log('pictures in', OUT, 'errors:', tv.errors.map(String));
} finally { await rig.close(); }
