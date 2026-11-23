/* The owner's pictures of Peekaboo Garden from the REAL flow (plans K4 + K5): the real shell and game on the TV, the real tablet program on a tablet, joined
   through the join card, the hider moved by the tablet's real stick, the seekers' hands fake. At device scale 2 (TV 1280x720, tablet 1280x800).
     docs/k5/  hide.png  mid-flip.png  in-pot.png  seek-lantern.png  pair-tablet.png  (+ tablet-found.png, tablet-hidden.png)
     docs/k4/  tv-hide.png  tv-seek.png  tv-found.png  tv-hidden.png  pair-tv.png
   pair-tv.png and pair-tablet.png are taken at the same moment in seek (two screenshots started together); seek-lantern.png and tv-seek.png are copies of them.
   Run:  cd app && node test/preview/k5-pair-shots.mjs      (headless Chromium draws WebGL in software: slow, and the frame rate means nothing) */
import path from 'node:path';
import fs from 'node:fs';
import { startPair, until, sleep } from '../harness/peekaboo-pair.mjs';
import { APP } from '../harness/pads-rig.mjs';

const K5 = process.env.K5_OUT || path.join(APP, '..', 'docs', 'k5'), K4 = process.env.K4_OUT || path.join(APP, '..', 'docs', 'k4');
fs.mkdirSync(K5, { recursive: true }); fs.mkdirSync(K4, { recursive: true });
const P = await startPair({ scale: 2 });
const { tv, tab } = P;
const say = (m) => console.log(m);
try {
  const settle = async (ms) => { await tab.page.evaluate(() => { window.__pk.maxDt = 0.25; }); await sleep(ms); await tab.page.evaluate(() => { window.__pk.maxDt = 0.1; }); };
  /* hold the round clock where it is (the software TV is slow, the pictures must not wait for 10 or 60 seconds) */
  let holdT = null; const holder = setInterval(() => { if (holdT != null) P.setT(holdT).catch(() => {}); }, 250);
  const both = (name4, name5) => Promise.all([name4 && tv.page.screenshot({ path: path.join(K4, name4) }), name5 && tab.page.screenshot({ path: path.join(K5, name5) })]);
  const still = async () => { await P.release().catch(() => {}); };
  const walkTo = async (x, z, ms = 150) => {
    for (let i = 0; i < 120; i++) {
      const s = await P.state(), dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz); if (d < 0.3) break;
      await P.release().catch(() => {}); await P.drag(dx / d * 0.9, -dz / d * 0.9); await sleep(ms);
    }
    await still();
  };

  /* hide */
  holdT = 6;
  await P.drag(0.35, -0.9); await sleep(1200); await still();
  await tab.page.evaluate(() => window.__pk.say('Hide!', 600000));
  await settle(3000);
  await both('tv-hide.png', 'hide.png'); say('hide');

  /* mid-flip: turn from right to left, hold it a third of the way through */
  await tab.page.evaluate(() => { window.__pk.cs.dur = 1e6; window.__pk.say('', 1); });
  await P.drag(1, -0.1); await sleep(900); await still();
  await P.drag(-1, -0.1);
  await until(() => tab.page.evaluate(() => !!window.__pk.cs.flip), 6000, 'a flip');
  await tab.page.evaluate(() => { window.__pk.cs.flip.p = 0.35; });
  await still(); await settle(2500);
  await tab.page.screenshot({ path: path.join(K5, 'mid-flip.png') }); say('mid-flip');
  await tab.page.evaluate(() => { window.__pk.cs.dur = 0.26; window.__pk.cs.flip = null; });

  /* in a pot (pot1 at 9, 11) */
  await tv.page.evaluate(() => { const s = window.__round().round.state; s.x = 9.7; s.z = 9.6; });
  await until(async () => Math.hypot((await tab.page.evaluate(() => window.__pk.me.x)) - 9.7, (await tab.page.evaluate(() => window.__pk.me.z)) - 9.6) < 0.5, 12000, 'tablet at the pot');
  await P.drag(-0.5, -0.9);
  await until(async () => (await P.state()).place === 'pot1', 10000, 'in the pot');
  await still(); await settle(2500);
  await tab.page.screenshot({ path: path.join(K5, 'in-pot.png') }); say('in-pot');
  await tab.page.locator('.pk-out').tap();
  await until(async () => (await P.state()).place === null, 6000, 'out');

  /* seek: the hider in bush3 (21, 4), two lanterns, one near; a nudge so the bush rustles */
  await tv.page.evaluate(() => { const s = window.__round().round.state; s.x = 21.2; s.z = 4.5; s.place = 'bush3'; });
  await until(async () => Math.hypot((await tab.page.evaluate(() => window.__pk.me.x)) - 21.2, (await tab.page.evaluate(() => window.__pk.me.z)) - 4.5) < 0.3, 15000, 'tablet at the bush');
  holdT = null; await P.setT(9.95); await until(async () => (await P.state()).phase === 'seek', 30000, 'seek'); holdT = 15;
  await P.drag(0.15, 0.15); await sleep(500); await still();
  const s = await P.state();
  await P.hands([{ seat: 0, x: s.x + 3.2, z: s.z + 1.2 }, { seat: 1, x: s.x - 5, z: s.z + 5 }]);
  await until(async () => Number(await tab.page.locator('.pk-glow').evaluate(e => e.style.opacity || 0)) > 0.3, 12000, 'the glow');
  await settle(3500);
  await both('pair-tv.png', 'pair-tablet.png'); say('pair');
  fs.copyFileSync(path.join(K4, 'pair-tv.png'), path.join(K4, 'tv-seek.png')); fs.copyFileSync(path.join(K5, 'pair-tablet.png'), path.join(K5, 'seek-lantern.png'));

  /* found */
  holdT = null;                                           /* (a held seek clock would end the reveal at once) */
  const f = await P.state();
  await P.hands([{ seat: 0, x: f.x, z: f.z }, { seat: 1, x: f.x - 5, z: f.z + 5 }]);
  await until(async () => (await P.state()).phase === 'reveal', 20000, 'found');
  holdT = 2.2; await sleep(500); await P.hands([]);
  await until(() => tv.page.evaluate(() => { const v = window.__round().view; return v && v.hider.visible && v.hider.material.opacity > 0.95; }), 20000, 'the hider drawn on the TV');
  await settle(3000);
  await both('tv-found.png', 'tablet-found.png'); say('found');

  /* hidden: play again, seek, time runs out */
  holdT = null; await P.setT(3.95); await tv.page.getByText('Play again').first().waitFor({ timeout: 60000 });
  await tv.page.getByText('Play again').first().click();
  await until(async () => { const go = tv.page.locator('.joinstart:not(.wait)'); if (await go.count()) await go.first().click().catch(() => {}); const q = await P.state().catch(() => null); return q && q.phase === 'hide' && q.t < 3; }, 60000, 'a new round');
  await P.hands([{ seat: 0, x: 25, z: 26 }, { seat: 1, x: 5, z: 26 }]);
  holdT = null; await P.setT(9.95); await until(async () => (await P.state()).phase === 'seek', 30000, 'seek'); await P.setT(59.9);
  await until(async () => (await P.state()).phase === 'reveal', 30000, 'time up');
  holdT = 2.2;
  await until(() => tv.page.evaluate(() => { const v = window.__round().view; return v && v.hider.visible && v.hider.material.opacity > 0.95; }), 20000, 'the hider drawn on the TV');
  await settle(3000);
  await both('tv-hidden.png', 'tablet-hidden.png'); say('hidden');
  clearInterval(holder);
  say('errors: ' + JSON.stringify([...tv.errors, ...tab.errors].map(String).filter(e => !/GL Driver|ReadPixels/.test(e))));
} finally { await P.close(); }
