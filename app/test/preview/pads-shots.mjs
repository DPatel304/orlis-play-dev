/* The owner's pictures for the TV side of phones (plan package P5) into docs/p5/, at device scale 2, from the real shell:
     join-card.png    the join card with two phones joined (one ready)
     wifi-hint.png    no phone after 90 seconds: the one Wi-Fi line
     waiting-pill.png "Waiting for Sam's PlayPad", in a game
     trusted-phones.png  Settings > Trusted phones
   Run:  cd app && node test/preview/pads-shots.mjs */
import path from 'node:path';
import fs from 'node:fs';
import { startRig, joinPhone, toJoinCard, until, ANDROID, PHONE, APP } from '../harness/pads-rig.mjs';

const OUT = path.join(APP, '..', 'docs', 'p5');
fs.mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const rig = await startRig();
try {
  /* the card with two phones, and the Wi-Fi line on a fresh card */
  {
    const tv = await rig.tv('pad-lab', { scale: 2 });
    await toJoinCard(tv);
    await tv.page.evaluate(() => { window.__scene().age = 90; });
    await tv.page.locator('.jwifi:not(.hide)').waitFor();
    await tv.page.waitForTimeout(700);
    await shot(tv.page, 'wifi-hint.png');
    const sam = await rig.phone(PHONE), mia = await rig.phone(ANDROID);
    await joinPhone(rig, tv, sam, 'sam');
    await joinPhone(rig, tv, mia, 'mia', { ready: false });
    await tv.page.locator('.jslot.full[data-who="mia"]').waitFor();
    await tv.page.locator('.jslot.ready[data-who="sam"]').waitFor();
    await tv.page.waitForTimeout(900);
    await shot(tv.page, 'join-card.png');
    /* start, then the phone goes quiet: the pill (the session is told the phone left; its socket stays so it does not rejoin) */
    await tv.page.locator('.joinstart').click();
    await until(() => tv.page.evaluate(() => !!(window.__round && window.__round() && window.__round().pads)));
    await tv.page.waitForTimeout(600);
    const seat = await tv.page.evaluate(() => window.__pads.session.seats.find(s => s.kind === 'pad' && s.who === 'sam').n);
    await tv.page.evaluate((n) => window.__pads.session.close(window.__pads.connOf(n)), seat);
    await tv.page.locator('.waitpill').waitFor();
    await tv.page.waitForTimeout(900);
    await shot(tv.page, 'waiting-pill.png');
    await rig.reset();
  }
  /* Settings > Trusted phones, as a grown-up opens it from Home */
  {
    const day = 86400000, now = Date.now();
    const seed = { 'orlis.trustedPads': JSON.stringify({
      t1: { who: 'sam', ua: PHONE.userAgent, lastSeen: now - 1000 },
      t2: { who: 'mia', ua: 'Mozilla/5.0 (Linux; Android 14; Tab S9) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', lastSeen: now - day },
      t3: { who: 'guest', ua: ANDROID.userAgent, lastSeen: now - 21 * day } }) };
    const tv = await rig.tv(null, { scale: 2, seed, extra: '&home' });
    await tv.page.locator('.screen.home').waitFor({ timeout: 30000 });
    await tv.page.waitForTimeout(1500);
    await tv.page.locator('.screen.home').click();
    await tv.page.locator('.popitem', { hasText: 'Settings' }).click();
    await tv.page.locator('.setcard').waitFor();
    await tv.page.locator('.setbtn', { hasText: 'See the list' }).click();
    await tv.page.locator('.trustcard .trow').first().waitFor();
    await tv.page.waitForTimeout(600);
    await shot(tv.page, 'trusted-phones.png');
    await rig.reset();
  }
  console.log('pictures in', OUT);
} finally { await rig.close(); }
