/* The whole of Peekaboo Garden, both sides, with nothing stood in: the real shell with the real game on a TV-sized page (Vite dev server), the Node pad hub,
   the built pad page and the real tablet program on a tablet-sized page. The seekers' hands are fake (pose players with hands at floor points, as K4's
   tests do); everything else is the real thing. Used by app/test/peekaboo-pair.node.mjs (the integrated test) and app/test/preview/k5-pair-shots.mjs
   (the owner's pictures). Plain Node, no test-runner code here. */
import { startRig, joinPhone, toJoinCard, until } from './pads-rig.mjs';
import { TABLET, sleep } from './peekaboo-rig.mjs';
import { T } from './slowness.mjs';

export { until, sleep };

export async function startPair({ scale = 1, hiderWho = 'ola' } = {}) {
  const rig = await startRig();
  const tv = await rig.tv('peekaboo', { scale });
  const { page } = tv;
  /* fake hands: the shell's pose is told who is in the picture each frame (the real tracker is switched off) */
  await page.waitForFunction(() => !!window.__pose, null, { timeout: T(30000) });
  await page.evaluate(async () => {
    const { screenPoint } = await import('/src/games/peekaboo/camera.js');
    const pose = window.__pose; pose.update = () => {};
    window.__hands = [{ seat: 0, x: 25, z: 26 }, { seat: 1, x: 5, z: 26 }];
    const frame = () => {
      const aspect = innerWidth / innerHeight;
      for (let i = 0; i < 4; i++) pose.players[i].present = false;
      for (const l of window.__hands) {
        const p = pose.players[l.seat], s = screenPoint(l.x, l.z, 0, aspect);
        p.present = true; p.lostFor = 0;
        for (const h of [p.hands.left, p.hands.right]) { h.x = s.x; h.y = s.y; h.speed = 1; }
      }
      requestAnimationFrame(frame);
    };
    frame();
  });
  await toJoinCard(tv);
  const tab = await rig.phone({ ...TABLET, deviceScaleFactor: scale });
  tab.errors = []; tab.page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver/.test(m.text())) tab.errors.push(new Error(m.text())); });
  await joinPhone(rig, tv, tab, hiderWho);
  await tv.page.locator('.jslot.ready').waitFor({ timeout: T(8000) });
  await tab.page.waitForFunction(() => document.body.dataset.program === 'on', null, { timeout: T(30000) });
  await tv.page.locator('.joinstart').click();
  await until(() => tv.page.evaluate(() => { const r = window.__round && window.__round(); return !!(r && r.round && r.round.state); }), 15000, 'the round to start');
  await tab.page.waitForFunction(() => window.__pk && window.__pk.net.seen, null, { timeout: T(30000) });
  const pair = {
    rig, tv, tab,
    /* the host's rules state, read on the TV page */
    state: () => tv.page.evaluate(() => { const s = window.__round().round.state; return { phase: s.phase, t: s.t, x: s.x, z: s.z, place: s.place, meter: s.meter, result: window.__round().result, foundBy: window.__round().foundBy, hiderSeat: window.__round().hiderSeat }; }),
    setT: (t) => tv.page.evaluate((t) => { window.__round().round.state.t = t; }, t),
    hands: (list) => tv.page.evaluate((l) => { window.__hands = l; }, list),
    /* a thumb on the tablet's stick: from the middle of the base, dx and dy of its radius (up is negative dy) */
    async drag(dx, dy) {
      const b = await tab.page.locator('.pk-base').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      await tab.page.mouse.move(cx, cy); await tab.page.mouse.down();
      await tab.page.mouse.move(cx + dx * b.width / 2, cy + dy * b.height / 2, { steps: 3 });
    },
    release: () => tab.page.mouse.up(),
    close: () => rig.close()
  };
  return pair;
}
