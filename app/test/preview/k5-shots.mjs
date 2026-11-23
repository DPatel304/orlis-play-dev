/* The owner's pictures for the hider's tablet (plan package K5), into docs/k5/ (or the folder in K5_OUT), at device scale 2, landscape tablet 1280x800,
   from the real tablet program with the real rules behind it (a stand-in host, see harness/peekaboo-rig.mjs):
     hide.png          the hide phase: "Hide!", the sun ring, three leaves, the stick
     seek-lantern.png  seeking, a lantern near: the screen edge glows, the light pool on the lawn, a leaf paler
     in-pot.png        inside a pot with the "Step out" button
     mid-flip.png      the card halfway through a turn
   Run:  cd app && node test/preview/k5-shots.mjs
   (Headless Chromium draws WebGL in software: the pictures are about the look, the frame rate here means nothing.) */
import path from 'node:path';
import fs from 'node:fs';
import { startPeekabooRig, APP, sleep, until } from '../harness/peekaboo-rig.mjs';

const OUT = process.env.K5_OUT || path.join(APP, '..', 'docs', 'k5');
fs.mkdirSync(OUT, { recursive: true });
const rig = await startPeekabooRig();
try {
  const { page, errors } = await rig.tablet();
  const host = rig.host, r = host.round.state;
  await page.evaluate(() => { window.__pk.setPixelRatio(2); });   /* */
  const settle = async (ms) => { await page.evaluate(() => { window.__pk.maxDt = 0.25; }); await sleep(ms); await page.evaluate(() => { window.__pk.maxDt = 0.1; }); };
  const shot = async (name) => { await settle(2500); await page.screenshot({ path: path.join(OUT, name) }); console.log('saved', name); };
  const stick = async (x, y, ms) => { host.stick = { x, y }; await page.evaluate(([x, y]) => { window.__pk.input.x = x; window.__pk.input.y = y; window.__pk.input.held = true; }, [x, y]); await sleep(ms); };
  const still = async () => { host.stick = { x: 0, y: 0 }; await page.evaluate(() => { window.__pk.input.x = 0; window.__pk.input.y = 0; window.__pk.input.held = false; }); };
  const walkTo = async (x, z) => {         /* walk with the real stick messages until near */
    for (let i = 0; i < 200; i++) {
      if (r.phase === 'seek') r.t = Math.min(r.t, 20);          /* (the round clock must not run out while the pictures are slow) */
      const dx = x - r.x, dz = z - r.z, d = Math.hypot(dx, dz); if (d < 0.25) break;
      await stick(dx / d, dz / d, 120);
    }
    await still();
  };

  /* 1. hide: a few steps from the start, bushes and trees around */
  r.t = 0; await sleep(300);
  await stick(0.35, 1, 1200); await still();
  await page.evaluate(() => window.__pk.say('Hide!', 60000));
  await settle(2000); await page.screenshot({ path: path.join(OUT, 'hide.png') }); console.log('saved hide.png');

  /* 2. mid-flip: turn left while walking right, and take the frame half way */
  await page.evaluate(() => { window.__pk.cs.dur = 1e6; });          /* slow turn, so a frame can be caught in the middle (software GL is slow anyway) */
  await stick(1, 0.1, 900);
  await page.evaluate(() => { window.__pk.input.x = -1; window.__pk.input.y = 0; });
  host.stick = { x: -1, y: 0 };
  await until(() => page.evaluate(() => !!window.__pk.cs.flip), 4000, 'a flip starts');
  await page.evaluate(() => { window.__pk.cs.flip.p = 0.2; });        /* held a fifth of the way through: the card is a narrow card, back toward front */
  await still();
  await settle(2500);
  await page.screenshot({ path: path.join(OUT, 'mid-flip.png') }); console.log('saved mid-flip.png');
  await page.evaluate(() => { window.__pk.cs.dur = 0.26; window.__pk.cs.flip = null; window.__pk.cs.mir = -1; });
  await still();

  r.phase = 'seek'; r.t = 12; host.sendState();
  /* 3. in a pot: walk into pot1 (9, 11) */
  await walkTo(9.2, 10.4);
  await until(() => page.evaluate(() => window.__pk.me.place === 'pot1'), 3000, 'in the pot').catch(async (e) => { console.log(JSON.stringify(await page.evaluate(() => ({ me: window.__pk.me, net: { p: window.__pk.net.phase, h: window.__pk.net.host } }))), r.x, r.z, r.place, r.phase); throw e; });
  await shot('in-pot.png');

  /* 4. seek, a lantern near: step out, go to the bush, and a lantern a few steps off to the left */
  await page.getByRole('button', { name: /Step out/ }).tap();
  await until(() => page.evaluate(() => window.__pk.me.place === null), 3000, 'out');
  await walkTo(21, 4.4);
  r.t = 5; host.sendState();
  await page.evaluate(() => { window.__pk.cs.dur = 0.26; }); host.sendState();
  await sleep(300);
  host.lanterns = [{ seat: 1, x: r.x - 3.2, z: r.z + 1.8 }];
  await sleep(1500);
  await shot('seek-lantern.png');
  console.log('page errors:', errors.length ? errors.map(String) : 'none');
} finally { await rig.close(); }
