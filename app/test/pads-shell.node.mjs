/* The real game shell with a phone (plan packages S1 and P5), end to end: the Node pad hub, the built pad page in a phone, and the REAL shell
   (Vite dev server) in a TV-sized browser running the pad lab. Run in a plain Node process by pads-shell.test.mjs. */
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startRig, joinPhone, toJoinCard, until, ANDROID, PHONE } from './harness/pads-rig.mjs';

let rig;
before(async () => { rig = await startRig(); });
after(async () => { await rig?.close(); });
afterEach(async () => { await rig?.reset(); });

const dotX = (tv) => tv.page.evaluate(() => { const r = window.__round && window.__round(); const d = r && r.dots && Object.values(r.dots)[0]; return d ? d.x : null; });
async function stick(phone, dx, dy) {
  const box = await phone.page.locator('.labstick').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await phone.page.mouse.move(cx, cy); await phone.page.mouse.down(); await phone.page.mouse.move(cx + dx * box.width / 2, cy + dy * box.height / 2, { steps: 3 });
}

test('a phone joins with the pictures on the TV card, Start, the stick moves the dot, a dropped phone pauses the game with the pill, and it resumes', async () => {
  const tv = await rig.tv('pad-lab');
  await toJoinCard(tv);

  /* the card: a QR that opens the pad page (no secret), the three pictures, empty slots, Start; no Wi-Fi line yet */
  const qr = await tv.page.locator('.jqr canvas').getAttribute('data-url');
  assert.equal(qr, rig.hub.url + '/', 'the QR opens the pad page at the hub address');
  assert.ok(!/key|secret/i.test(qr), 'no secret in the QR');
  const ids = await tv.page.locator('.jpics canvas').evaluateAll(els => els.map(e => e.dataset.id));
  assert.equal(ids.length, 3);
  assert.deepEqual(ids, await tv.page.evaluate(() => window.__pads.session.join.pictures), 'the card shows the session pictures');
  assert.equal(await tv.page.locator('.jslot.empty').count(), 2);
  assert.equal(await tv.page.locator('.jwifi:not(.hide)').count(), 0);
  assert.equal(await tv.page.locator('.joinstart.wait').count(), 1, 'Start waits for the phone the game needs');

  /* a phone joins with exactly those pictures; its face fills in, with a tick when it is ready */
  const sam = await rig.phone(PHONE);
  const used = await joinPhone(rig, tv, sam, 'sam', { ready: false });
  assert.deepEqual(used, ids);
  await tv.page.locator('.jslot.full[data-who="sam"]').waitFor({ timeout: 5000 });
  assert.equal(await tv.page.locator('.jslot[data-who="sam"].ready').count(), 0, 'no tick before ready');
  await sam.page.getByRole('button', { name: "I'm ready" }).tap();
  await tv.page.locator('.jslot.ready[data-who="sam"] .jtick').waitFor({ timeout: 5000 });
  assert.equal(await tv.page.locator('.joinstart.wait').count(), 0, 'Start is ready');
  await sam.page.waitForFunction(() => document.body.dataset.program === 'on');

  /* the TV starts (a click stands in for wave or remote); a phone never does */
  await tv.page.locator('.joinstart').click();
  await until(() => tv.page.evaluate(() => !!(window.__round && window.__round() && window.__round().pads)), 8000, 'the round to start');
  assert.equal(await tv.page.evaluate(() => window.__pads.session.phase), 'playing');
  await until(() => tv.page.evaluate(() => Object.keys(window.__round().dots).length === 1), 5000, 'the join to reach the game');

  /* the stick moves the dot */
  const x0 = await dotX(tv);
  await stick(sam, 1, 0);
  await until(async () => (await dotX(tv)) > x0 + 0.05, 5000, 'the dot to move right');
  await sam.page.mouse.up();
  await until(async () => { const a = await dotX(tv); await new Promise(r => setTimeout(r, 200)); return Math.abs((await dotX(tv)) - a) < 1e-6; }, 5000, 'the dot to stop');
  assert.ok((await tv.page.evaluate(() => window.__round().heard)) >= 2, 'the game heard the phone');

  /* the phone drops: the TV pauses with "Waiting for Sam's phone", and the dot stops being steppable */
  const seat = await tv.page.evaluate(() => window.__pads.session.seats.find(s => s.kind === 'pad').n);
  await tv.page.evaluate((n) => window.__pads.link.send.close(window.__pads.connOf(n)), seat);
  await tv.page.locator('.waitpill').waitFor({ timeout: 5000 });
  assert.equal((await tv.page.locator('.waitpill .wt').innerText()).trim(), "Waiting for Sam's phone");
  assert.equal(await tv.page.locator('.waitpill .padface canvas').count(), 1, 'with Sam’s face');
  assert.equal(await tv.page.evaluate(() => window.__pads.session.phase), 'paused');
  /* the phone comes back by itself, the pill goes and the game carries on */
  await tv.page.locator('.waitpill').waitFor({ state: 'detached', timeout: 12000 });
  assert.equal(await tv.page.evaluate(() => window.__pads.session.phase), 'playing');
  await sam.page.locator('.labstick').waitFor({ timeout: 5000 });
  const x1 = await dotX(tv);
  await stick(sam, -1, 0);
  await until(async () => (await dotX(tv)) < x1 - 0.05, 6000, 'the dot to move left after resuming');
  await sam.page.mouse.up();
  assert.deepEqual(tv.errors.map(String), [], 'no errors on the TV');
});

test('no phone after 90 seconds: the one calm Wi-Fi line; it goes when a phone joins', async () => {
  const tv = await rig.tv('pad-lab');
  await toJoinCard(tv);
  await tv.page.evaluate(() => { window.__scene().age = 89; });
  await tv.page.waitForTimeout(300);
  assert.equal(await tv.page.locator('.jwifi:not(.hide)').count(), 0, 'not at 89 s');
  await tv.page.evaluate(() => { window.__scene().age = 90; });
  await tv.page.locator('.jwifi:not(.hide)').waitFor({ timeout: 3000 });
  assert.match(await tv.page.locator('.jwifi').innerText(), /same Wi-Fi/);
  const p = await rig.phone(ANDROID);
  await joinPhone(rig, tv, p, 'mia', { ready: false });
  await tv.page.locator('.jwifi.hide').waitFor({ state: 'attached', timeout: 5000 });
  assert.equal(await tv.page.locator('.jwifi:not(.hide)').count(), 0, 'gone once a phone has joined');
});

test('Settings lists the trusted phones with who and when; Remove makes that phone use the pictures again; Forget all phones', async () => {
  const tv = await rig.tv('pad-lab');
  await toJoinCard(tv);
  const a = await rig.phone(PHONE), b = await rig.phone(ANDROID);
  await joinPhone(rig, tv, a, 'sam', { ready: false });
  await joinPhone(rig, tv, b, 'mia', { ready: false });
  /* the list, as Settings opens it (the module instance is the shell's own) */
  await tv.page.evaluate(async () => { const m = await import('/src/ui/trusted-phones.js'); m.openTrustedPhones(); });
  await tv.page.locator('.trustcard .trow').first().waitFor({ timeout: 5000 });
  const rows = await tv.page.locator('.trustcard .trow').evaluateAll(els => els.map(e => ({ dev: e.querySelector('.dev').textContent, nm: e.querySelector('.nm').textContent, when: e.querySelector('.when').textContent, face: !!e.querySelector('.padface canvas') })));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.dev).sort(), ['Android phone', 'iPhone']);
  assert.deepEqual(rows.map(r => r.nm).sort(), ['Mia', 'Sam']);
  assert.ok(rows.every(r => r.when === 'Today' && r.face));
  /* Remove Sam's phone: gone from the list and the store, and the phone is closed and has to use the pictures again */
  const samRow = tv.page.locator('.trustcard .trow', { hasText: 'Sam' });
  const tok = await samRow.getAttribute('data-token');
  await samRow.locator('.trustrm').click();
  await until(async () => (await tv.page.locator('.trustcard .trow').count()) === 1, 4000, 'the row to go');
  assert.equal(await tv.page.evaluate((t) => !!JSON.parse(localStorage.getItem('orlis.trustedPads') || '{}')[t], tok), false);
  await a.page.getByText('Tap the three', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(async () => {
    /* (the phone may first show "Welcome" screens while it rejoins: it must end up asking for the pictures, not seating itself) */
    throw new Error('the removed phone did not ask for the pictures: ' + await a.page.evaluate(() => document.body.dataset.screen));
  });
  await tv.page.locator('.trustall').click();
  await until(async () => (await tv.page.locator('.trustcard .trow').count()) === 0, 4000, 'all rows to go');
  assert.equal(await tv.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('orlis.trustedPads') || '{}')).length), 0);
});
