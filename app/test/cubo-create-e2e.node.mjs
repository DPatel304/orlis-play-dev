/* Cubo's Create, end to end (decision 0060): the real page in headless Chromium (Vite dev server), driven the three ways a family drives it, from the
   Create tab to a saved, playing game and back:

     remote only   arrows, OK (Enter), Back (Escape)
     mouse only    clicks on the big targets (the camera is not there: the tracker falls back to the mouse)
     body only     a scripted person fed through the tracker (pose._assign): arms up, walking, reaching into things and holding, a swipe, a jump
                   (the page's camera is switched on by the page itself or nobody is seen: harness/cubo-rig.mjs)

   Plus: the slots full, cancelling half-way and coming back, the camera check, a second person (only the first builds), the server out of reach
   and refusing. Every test fails on any page error or console error. Run by cubo-create-e2e.test.mjs in a plain Node process (see
   pad-page.test.mjs); set CUBO_E2E_SHOTS=<folder> to also keep a picture of every step (docs/calm/cubo-create-e2e-*.png). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startCuboRig, until, sleep, SHOTS, PROFILES } from './harness/cubo-rig.mjs';
import { T } from './harness/slowness.mjs';

let rig;
before(async () => { rig = await startCuboRig(); });
after(async () => { await rig?.close(); });

const ONE = [PROFILES[0]];                       /* a family of one: no Who's who before the first game */
const SIZES = SHOTS ? [[1920, 1080], [1280, 720]] : [[1280, 720]];
const LINES = {
  start: "Let's make a game! Raise both arms to start.",
  where: 'Where shall we play? Step to look. Arms up to choose!',
  game: 'What kind of game? Touch one!',
  rules: 'Fast or slow? Push it!',
  name: 'Jump to spin! Arms up to keep it!',
  play: 'Here we go!'
};

/* ---------- helpers ---------- */
const said = async (s) => (await s.hearLog()).map(x => x.line);
const count = (list, line) => list.filter(l => l === line).length;
const st = (s) => s.state();
const mark = async (s) => (await s.hearLog()).length;
const saidSince = async (s, n) => (await s.hearLog()).slice(n).map(x => x.line);
/* every pair of big things on a step is clear of the others (a bubble over a card, a tip over the dots, a tray over a slider) */
async function layoutProblems(s){
  return s.page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.closest('.hide') ? r : null; };
    const pick = (sel, name) => [...document.querySelectorAll(`.cc ${sel}`)].map((e, i) => ({ name: `${name}${i}`, r: vis(e), e })).filter(x => x.r);
    const things = [
      ...pick('.ccbubble', 'bubble'), ...pick('.ccback', 'back'), ...pick('.ccarms', 'arms'), ...pick('.ccworld', 'world'), ...pick('.ccdots', 'dots'),
      ...pick('.cctip', 'tip'), ...pick('.ccside', 'side'), ...pick('.cccard', 'card'), ...pick('.ccchip', 'chip'), ...pick('.ccspot', 'spot'),
      ...pick('.cctray', 'tray'), ...pick('.ccslider', 'slider'), ...pick('.ccspin', 'spin'), ...pick('.ccgo', 'go')
    ];
    const out = [], W = innerWidth, H = innerHeight;
    for (const a of things){
      if (a.r.left < -1 || a.r.top < -1 || a.r.right > W + 1 || a.r.bottom > H + 1) out.push(`${a.name} off the screen`);
      for (const b of things){
        if (a.name >= b.name) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 3 && h > 3) out.push(`${a.name} overlaps ${b.name} by ${Math.round(w)}x${Math.round(h)}`);
      }
    }
    return out;
  });
}
async function noOverlaps(s, label){ const p = await layoutProblems(s); assert.deepEqual(p, [], `${label}: things overlap or leave the screen at ${s.w}x${s.h}`); }
/* the remote's focus is always on screen: with the remote in use, exactly one visible focused element, in the flow's zone and item, wearing a ring */
async function focusIs(s, zone, item, shot = null){
  const f = await s.page.evaluate(() => {
    const els = [...document.querySelectorAll('.cc .sel')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.closest('.hide'); });
    const e = els[0], cs = e && getComputedStyle(e);
    return { n: els.length, remote: document.body.classList.contains('remote'), zone: e && e.dataset.zone, item: e && Number(e.dataset.item), ring: !!cs && /rgb/.test(cs.boxShadow) && cs.boxShadow.split(') ').length >= 3 };
  });
  assert.equal(f.remote, true, 'the remote is in use');
  assert.equal(f.n, 1, `exactly one visible focused element on ${zone} (found ${f.n})`);
  assert.equal(f.zone, zone); assert.equal(f.item, item);
  assert.equal(f.ring, true, `the focused ${zone} wears the ring`);
  const fl = await st(s);
  const want = await s.page.evaluate(async (fl) => (await import('/src/create/cubo-flow.js')).focusOf(fl), fl);
  assert.deepEqual({ zone: f.zone, item: f.item }, want, 'the screen shows what the flow says');
  if (shot) await s.focusShot(shot);
}
const noErrors = (s) => assert.deepEqual(s.errors, [], 'no page or console errors');
const wheelTop = (s) => s.page.evaluate(() => document.querySelector('.cc').wheel.top());
const wheelPos = (s) => s.page.evaluate(() => document.querySelector('.cc').wheel.pos);
const groupIds = (s, group) => s.page.evaluate(async (g) => (await import('/src/create/recipe.js')).choices.what.find(c => c.id === g).pieces.map(p => p.id), group);
const posts = (s) => s.fake.store.calls.filter(c => c === 'POST /api/creations').length;
const toastText = (s) => s.page.evaluate(() => [...document.querySelectorAll('.toast, .toasts > *')].map(e => e.textContent).join(' | '));

/* after the name: the Who's who (a family of two), the game, its scores, Change it (back into the flow with the picks kept) and Home */
async function playThenChange(s, how, saved){
  if (await s.mode() === 'lineup'){
    if (how === 'remote') await s.keys('ArrowRight', 'Enter'); else await s.click('.screen.lineup .btn.go');
  }
  await s.modeIs('play', 20000);
  const g = await s.page.evaluate(() => ({ made: window.__game().made && window.__game().made.id, name: window.__game().name }));
  assert.equal(g.made, saved.id, 'the game that plays is the one just saved');
  await until(() => s.page.evaluate(() => !!window.__round() && window.__round().t > 0.5), 15000, 'the round to run');
  await s.shot('playing');
  await s.page.evaluate(() => window.__finish());
  await s.modeIs('results', 20000);
  await sleep(1500);                                               /* (the scores card fades in) */
  await s.shot('results');
  const names = await s.page.evaluate(() => [...document.querySelectorAll('.screen .btn')].map(b => b.textContent.trim()));
  assert.deepEqual(names, ['Play again', 'Change it', 'Home'], 'the scores of a made game');
}

/* ======================================================================================================================================== */
/* REMOTE ONLY                                                                                                                              */
/* ======================================================================================================================================== */
for (const [w, h] of SIZES){
  test(`remote only (${w}x${h}): the Create tab to a saved, playing game, Change it, Home - Back goes one step at every step`, async () => {
    const s = await rig.open({ w, h });
    await s.stepIs('start');
    /* the start: the remote starts on the banner (not the tab bar's Create tab or the profile), and Cubo says his line once */
    assert.equal(await s.page.evaluate(() => window.__cam.wanted), true, 'Create switches the camera on (the body is what makes a game here)');
    assert.deepEqual(await said(s), [LINES.start]);
    await s.shot('start');
    await s.keys('Enter');
    await s.stepIs('where');
    assert.equal(await s.mode(), 'create', 'Enter on the start screen begins Cubo\'s Create (it did not open the menu or Settings)');
    assert.equal(await s.page.evaluate(() => !!document.querySelector('.dim')), false, 'no menu opened');
    assert.deepEqual(await said(s), [LINES.start, LINES.where], 'Cubo says the Where line once');
    assert.equal(await s.bubble(), LINES.where);
    await s.shot('where'); await noOverlaps(s, 'where');
    /* Where: the arrows walk through the worlds; the name and the dots follow */
    await s.keys('ArrowRight', 'ArrowRight');
    await focusIs(s, 'world', 2, 'where');
    assert.equal((await st(s)).worldIx, 2);
    assert.equal(await s.text('.ccworld'), await s.page.evaluate(async () => (await import('/src/create/recipe.js')).choices.where[2].label));
    assert.equal(await s.page.evaluate(() => [...document.querySelectorAll('.ccdot')].findIndex(d => d.classList.contains('on'))), 2);
    await s.keys('ArrowLeft');
    assert.equal((await st(s)).worldIx, 1);
    /* Back goes one step back (to the start), Enter goes on again */
    await s.keys('Escape'); await s.stepIs('start');
    assert.equal(await s.visible('.chero'), true, 'the start screen is back');
    await s.keys('Enter'); await s.stepIs('where'); assert.equal((await st(s)).worldIx, 1, 'the world picked is kept');
    await s.keys('Enter'); await s.stepIs('game');
    assert.equal(await s.bubble(), LINES.game);
    await s.shot('game'); await noOverlaps(s, 'game');
    await s.keys('Escape'); await s.stepIs('where');
    await s.keys('Enter'); await s.stepIs('game');
    /* the game: arrows move over the four cards (a 2 by 2), OK picks */
    await s.keys('ArrowRight');
    assert.equal(await s.page.evaluate(() => [...document.querySelectorAll('.cccard')].findIndex(c => c.classList.contains('sel'))), 1);
    await focusIs(s, 'card', 1, 'game');
    await s.keys('ArrowDown'); assert.equal((await st(s)).gameIx, 3);
    await s.keys('ArrowLeft'); assert.equal((await st(s)).gameIx, 2);
    await s.keys('ArrowUp'); assert.equal((await st(s)).gameIx, 0);
    await s.keys('ArrowRight', 'ArrowDown');                      /* Stack */
    await s.keys('Enter'); await s.stepIs('what');
    assert.equal(await s.bubble(), 'What shall we stack? Pick a group, then grab!');
    await s.shot('what-groups'); await noOverlaps(s, 'what, groups');
    await s.keys('ArrowRight'); await focusIs(s, 'groups', 1, 'what-groups'); await s.keys('ArrowLeft');
    await s.keys('ArrowDown');     /* (nothing picked, nothing below: the focus stays where it is) */
    await focusIs(s, 'groups', 0);
    /* What: a group (Back out of it first, one step), then grab from the wheel with OK */
    await s.keys('ArrowRight', 'Enter');
    assert.equal((await st(s)).group, 'animals');
    await s.keys('Escape'); assert.equal((await st(s)).group, null, 'Back leaves the group first'); assert.equal(await s.step(), 'what');
    await focusIs(s, 'groups', 1);
    await s.keys('Enter');                                         /* the same group again (the lit one) */
    assert.equal((await st(s)).group, 'animals');
    await focusIs(s, 'wheel', 0, 'what-wheel-focus');
    await s.keys('ArrowDown'); assert.equal((await st(s)).zone, 'wheel', 'with nothing picked there is no tray or Done to go down to'); await focusIs(s, 'wheel', 0);
    const ids = await groupIds(s, 'animals');
    /* the wheel does not drift under the remote: one press is one thing, and OK takes what is at the top */
    await s.keys('ArrowRight');
    const p0 = await wheelPos(s); await sleep(900); const p1 = await wheelPos(s);
    assert.ok(Math.abs(p1 - p0) < 0.05, `the wheel waits for the next press (moved ${p0} -> ${p1})`);
    const top = ids[await wheelTop(s)];
    await s.keys('Enter');
    assert.deepEqual((await st(s)).tray, [top], 'OK grabs the thing at the top');
    await s.keys('ArrowRight', 'ArrowRight');
    const top2 = ids[await wheelTop(s)]; await s.keys('Enter');
    assert.deepEqual((await st(s)).tray, [top, top2]);
    await s.shot('what-wheel'); await noOverlaps(s, 'what, wheel and tray');
    /* the tray: down into it, OK puts one back, up and grab another, down to Done */
    await s.keys('ArrowDown'); assert.equal((await st(s)).zone, 'tray');
    await focusIs(s, 'tray', 0, 'what-tray');
    await s.keys('Enter'); assert.deepEqual((await st(s)).tray, [top2], 'OK in the tray takes one back');
    await s.keys('ArrowUp'); assert.equal((await st(s)).zone, 'wheel');
    await s.keys('ArrowLeft'); const top3 = ids[await wheelTop(s)]; await s.keys('Enter');
    assert.equal((await st(s)).tray.length, 2); assert.ok((await st(s)).tray.includes(top3));
    await s.keys('ArrowDown', 'ArrowDown'); assert.equal((await st(s)).zone, 'done');
    await s.shot('what-done'); await focusIs(s, 'done', 0, 'what-done');
    const things = (await st(s)).tray.slice();
    await s.keys('Enter'); await s.stepIs('rules');
    assert.deepEqual((await st(s)).picks.things.map(t => t.id), things);
    assert.equal(await s.bubble(), LINES.rules);
    /* Rules: arrows push the sliders and move between them; Back and forward again keeps them */
    await s.keys('ArrowRight', 'ArrowRight'); assert.equal((await st(s)).picks.speed, 5);
    await focusIs(s, 'slider', 0, 'rules-speed');
    await s.keys('ArrowDown', 'ArrowRight'); assert.equal((await st(s)).picks.many, 4);
    await focusIs(s, 'slider', 1, 'rules-many');
    await s.keys('ArrowDown'); await focusIs(s, 'done', 0, 'rules-done'); await s.keys('ArrowUp'); await focusIs(s, 'slider', 1);
    await s.shot('rules'); await noOverlaps(s, 'rules');
    await s.keys('Escape'); await s.stepIs('what'); assert.equal((await st(s)).group, null);
    await s.keys('Enter'); assert.equal((await st(s)).group, 'animals');
    await s.keys('ArrowDown', 'ArrowDown'); assert.equal((await st(s)).zone, 'done');
    await s.keys('Enter'); await s.stepIs('rules');
    assert.equal((await st(s)).picks.speed, 5, 'the speed is kept'); assert.equal((await st(s)).picks.many, 4, 'the number is kept');
    await s.keys('Enter', 'Enter', 'Enter');                        /* OK down the two sliders and the arms, then on */
    await s.stepIs('name');
    assert.equal(await s.bubble(), LINES.name);
    await s.shot('name'); await noOverlaps(s, 'name');
    await focusIs(s, 'keep', 0, 'name');
    /* Name: arrows turn the wheel of names; OK keeps the one in the middle and saves */
    const names = (await st(s)).names;
    assert.ok(names.length >= 6, 'a wheel of names');
    await s.keys('ArrowRight', 'ArrowRight'); assert.equal((await st(s)).nameIx, 2);
    await s.keys('ArrowLeft'); assert.equal((await st(s)).nameIx, 1);
    await s.keys('Escape'); await s.stepIs('rules'); await s.keys('Enter', 'Enter', 'Enter'); await s.stepIs('name');
    await s.keys('ArrowRight'); const chosen = names[(await st(s)).nameIx];
    const before = await mark(s);
    await s.keys('Enter', 'Enter', 'Enter');                         /* (pressing again while it saves does nothing: not the tab bar, not Settings) */
    await until(async () => (await s.mode()) !== 'create', 20000, 'the game to start');
    assert.equal(posts(s), 1, 'saved once');
    const saved = s.fake.store.creations[0];
    assert.equal(saved.name, chosen); assert.equal(saved.makerId, PROFILES[PROFILES.length - 1].id);
    assert.deepEqual(saved.picks.things.map(t => t.id).sort(), things.slice().sort());
    assert.ok(saved.picks.things.every(t => t.job === 'stack'));
    assert.equal(count(await saidSince(s, before), LINES.play), 1, 'Cubo says "Here we go!" once');
    /* play, the scores, Change it */
    await playThenChange(s, 'remote', saved);
    const mk = await mark(s);
    await s.keys('ArrowDown', 'Enter');                              /* Change it */
    await s.modeIs('create'); await s.stepIs('where');
    assert.equal(await s.bubble(), LINES.where);
    assert.deepEqual(await saidSince(s, mk), [LINES.where], 'Change it opens at Where, saying only that');
    assert.equal((await st(s)).editing, saved.id); assert.deepEqual((await st(s)).tray.slice().sort(), things.slice().sort(), 'the picks are kept');
    assert.equal((await st(s)).picks.speed, 5);
    await s.shot('change-it');
    await s.keys('Enter', 'Enter'); await s.stepIs('what');           /* where, then the same kind of game */
    await s.keys('Enter'); await s.keys('ArrowDown', 'ArrowDown', 'Enter'); await s.stepIs('rules');
    assert.equal((await st(s)).picks.speed, 5, 'the old rules came back with it');
    await s.keys('Enter', 'Enter', 'Enter'); await s.stepIs('name');
    await s.keys('Enter');
    await until(async () => (await s.mode()) === 'play', 20000, 'the changed game to play');
    assert.equal(posts(s), 2); assert.equal(s.fake.store.creations.length, 1, 'saved back into the same slot, not a second one');
    assert.equal(s.fake.store.creations[0].id, saved.id);
    await s.page.evaluate(() => window.__finish()); await s.modeIs('results', 20000);
    await s.keys('ArrowDown', 'ArrowRight', 'Enter');                /* Home */
    await s.modeIs('menu', 15000);
    noErrors(s);
    await s.ctx.close();
  });
}

/* ======================================================================================================================================== */
/* MOUSE ONLY                                                                                                                               */
/* ======================================================================================================================================== */
test('mouse only: clicks on the big targets, start to a saved, playing game, Change it, Home', async () => {
  const s = await rig.open({ w: 1280, h: 720, mouse: true, profiles: PROFILES });
  await s.stepIs('start');
  await s.click('.chero');
  await s.stepIs('where');
  assert.deepEqual((await said(s)).filter(l => l === LINES.where).length, 1);
  await s.click('.ccdot', 2); assert.equal((await st(s)).worldIx, 2);
  await s.click('.ccside.right'); assert.equal((await st(s)).worldIx, 3);
  await s.click('.ccside.left'); assert.equal((await st(s)).worldIx, 2);
  await s.click('.ccback'); await s.stepIs('start');
  await s.click('.chero'); await s.stepIs('where');
  assert.equal((await st(s)).worldIx, 2);
  await s.click('.ccarms'); await s.stepIs('game');
  await s.click('.ccback'); await s.stepIs('where');
  await s.click('.ccarms'); await s.stepIs('game');
  await s.click('.cccard', 2); await s.stepIs('what');
  assert.equal((await st(s)).job, 'keepup');
  await s.click('.ccback'); await s.stepIs('game');
  await s.click('.cccard', 1); await s.stepIs('what');              /* Dodge */
  assert.equal((await st(s)).job, 'dodge');
  assert.equal(await s.visible('.ccarms'), false, 'Arms up only shows once something is picked');
  await s.click('.ccchip', 3); assert.equal((await st(s)).group, 'toys');
  await s.click('.ccback'); assert.equal((await st(s)).group, null); assert.equal(await s.step(), 'what');
  await s.click('.ccchip', 0); assert.equal((await st(s)).group, 'food');
  await noOverlaps(s, 'what (mouse)');
  /* a click on the glowing spot takes the thing at the top (the wheel turns by itself: wait for one not already in the tray) */
  const grabOne = async () => {
    const st0 = await st(s), ids = await groupIds(s, st0.group);
    await until(async () => !(await st(s)).tray.includes(ids[await wheelTop(s)]), 8000, 'a thing not yet picked at the top');
    const top = ids[await wheelTop(s)];
    await s.click('.ccspot');
    assert.ok((await st(s)).tray.includes(top), 'the click took the one at the top');
  };
  await grabOne();
  /* a click while the thing picked is still at the top says so (and takes nothing) */
  const idsNow = await groupIds(s, 'food');
  if ((await st(s)).tray.includes(idsNow[await wheelTop(s)])){
    await s.click('.ccspot');
    /* (the wheel may have turned on to a new thing between the check and the click: then that one is taken, which is right too) */
    if ((await st(s)).tray.length === 1) await until(async () => /have that one/i.test(await toastText(s)), 3000, 'the words');
  }
  if ((await st(s)).tray.length < 2) await grabOne();
  assert.equal((await st(s)).tray.length, 2);
  assert.equal(await s.visible('.ccarms'), true);
  await s.click('.cctrayslot:not(.empty)', 0); assert.equal((await st(s)).tray.length, 1, 'a click on the tray takes one back');
  await grabOne();
  await s.click('.ccarms'); await s.stepIs('rules');
  await s.click('.ccstop', 6); assert.equal((await st(s)).picks.speed, 6);
  await s.click('.ccstop', 7 + 1); assert.equal((await st(s)).picks.many, 1);
  await noOverlaps(s, 'rules (mouse)');
  await s.click('.ccarms'); await s.stepIs('name');
  const ix0 = (await st(s)).nameIx;
  await s.click('.ccspin'); assert.notEqual((await st(s)).nameIx, ix0, 'Spin turns the wheel');
  const chosen = (await st(s)).names[(await st(s)).nameIx];
  await s.click('.ccarms');
  await until(async () => (await s.mode()) !== 'create', 20000, 'the game to start');
  assert.equal(posts(s), 1);
  const saved = s.fake.store.creations[0];
  assert.equal(saved.name, chosen); assert.ok(saved.picks.things.every(t => t.job === 'dodge'));
  await playThenChange(s, 'mouse', saved);
  await s.page.locator('.screen .btn', { hasText: 'Change it' }).click();
  await s.modeIs('create'); await s.stepIs('where');
  assert.equal((await st(s)).editing, saved.id); assert.equal((await st(s)).picks.many, 1);
  await s.click('.ccback');                                           /* Back from Where, while changing a game: out, to the start */
  await s.stepIs('start');
  assert.equal(await s.visible('.chero'), true);
  assert.equal(await s.page.locator('.cslot.full').count(), 1, 'the game is in its slot');
  await s.page.locator('.ptab', { hasText: 'Play' }).click();
  await s.modeIs('menu');
  noErrors(s);
  await s.ctx.close();
});

/* ======================================================================================================================================== */
/* BODY ONLY                                                                                                                                */
/* ======================================================================================================================================== */
test('body only: arms up, walking, reaching into things and holding, a swipe, a slider pushed, a jump - to a saved, playing game', async () => {
  const s = await rig.open({ w: 1280, h: 720, profiles: ONE });
  const b = s.body;
  await s.stepIs('start');
  assert.equal(await s.page.evaluate(() => window.__cam.wanted), true, 'Create switches the camera on');
  await sleep(600);
  /* a person standing in front of the screen does nothing by standing there */
  await sleep(1500);
  assert.equal(await s.step(), 'start', 'standing still starts nothing');
  /* both arms up, held */
  await b.armsUp(0, true);
  await until(async () => (await s.step()) === 'where', 8000, 'arms up to start');
  await b.armsDown(0);
  assert.equal(count(await said(s), LINES.where), 1);
  /* Where: standing in the middle leaves the world as it is; walking across the picture changes it */
  await sleep(1500);
  const w0 = (await st(s)).worldIx;
  await b.walk(0, 0.52); await b.walk(0, 0.5); await sleep(500);
  assert.equal((await st(s)).worldIx, w0, 'a sway is not a walk');
  await b.walk(0, 0.3); await sleep(400);
  assert.equal((await st(s)).worldIx, 1, 'walking left to the second world');
  await b.walk(0, 0.7); await sleep(400);
  assert.equal((await st(s)).worldIx, 4);
  await s.shot('where'); await noOverlaps(s, 'where (body)');
  await b.walk(0, 0.5);
  const world = (await st(s)).worldIx;
  await b.armsUp(0, true);
  await s.stepIs('game', 8000);
  await b.armsDown(0);
  assert.equal((await st(s)).picks.where, await s.page.evaluate(async (i) => (await import('/src/create/recipe.js')).choices.where[i].id, world), 'the world stood in is the world picked');
  /* the game: a hand reaches into a card and rests there until its ring is full (Dodge: up on the right, where an arm reaches) */
  await sleep(1200);
  await b.reachEl('.cccard', 1);
  await sleep(300);
  assert.equal(await s.step(), 'game', 'a touch takes a moment: the ring fills first');
  await s.shot('game-reach');
  await until(async () => (await s.step()) === 'what', 12000, 'a hand held in the Dodge card');
  await b.release(0);
  assert.equal((await st(s)).job, 'dodge');
  /* What: a hand in the Sky bubble (the middle one: it must not grab at once), then into the glowing spot */
  await sleep(1500);
  await b.reachEl('.ccchip', 2);
  await until(async () => (await st(s)).group === 'sky', 12000, 'a hand held in the Sky bubble');
  const tray0 = (await st(s)).tray.length;
  await sleep(1800);
  assert.equal((await st(s)).tray.length, tray0, 'a hand resting where the bubble was grabs nothing');
  await b.release(0); await sleep(500);
  await s.shot('what-wheel-body');
  /* a swipe spins the wheel faster */
  const v0 = await s.page.evaluate(() => document.querySelector('.cc').wheel.vel);
  await b.swipe(1);
  const spun = await s.page.evaluate(() => document.querySelector('.cc').wheel.vel);
  await b.release(0);
  assert.ok(Math.abs(spun) > Math.abs(v0) || (await wheelPos(s)) !== 0, 'a quick wrist swipe turns the wheel');
  await sleep(800);
  await b.reachEl('.ccspot', 0);
  await until(async () => (await st(s)).tray.length >= 1, 20000, 'a hand in the grab spot as a thing passes');
  const first = (await st(s)).tray[0];
  await b.release(0); await sleep(600);
  await b.reachEl('.ccspot', 0);
  await until(async () => (await st(s)).tray.length >= 2, 20000, 'a second grab');
  await b.release(0);
  assert.notEqual((await st(s)).tray[1], first);
  await s.shot('what-wheel');
  await noOverlaps(s, 'what (body)');
  await b.armsUp(0, true);
  await s.stepIs('rules', 8000); await b.armsDown(0);
  /* Rules: pushing a slider with a hand; Cubo does not pick over a choice already made */
  await sleep(1500);
  const track = await s.page.evaluate(() => { const r = document.querySelectorAll('.ccstop'); const a = r[0].getBoundingClientRect(), z = r[6].getBoundingClientRect(); return { x0: (a.left + a.width / 2) / innerWidth, x1: (z.left + z.width / 2) / innerWidth, y: (a.top + a.height / 2) / innerHeight }; });
  await b.reachXY(track.x0 + (track.x1 - track.x0) * 5 / 6, track.y);
  await until(async () => (await st(s)).picks.speed === 5, 6000, 'a hand pushing the speed slider');
  await b.reachXY(track.x0 + (track.x1 - track.x0) * 1 / 6, track.y);
  await until(async () => (await st(s)).picks.speed === 1, 6000, 'pushed back');
  await b.release(0);
  await s.shot('rules');
  await noOverlaps(s, 'rules (body)');
  assert.equal(await s.step(), 'rules');
  await sleep(300);
  await b.armsUp(0, true);
  await s.stepIs('name', 8000); await b.armsDown(0);
  assert.equal((await st(s)).picks.speed, 1, 'the pushed speed is what was kept');
  /* Name: a jump spins the wheel */
  await sleep(1400);
  const n0 = (await st(s)).nameIx;
  await b.jump(0);
  await until(async () => (await st(s)).nameIx !== n0, 5000, 'a jump spinning the names');
  await s.shot('name');
  await sleep(1000);
  const chosen = (await st(s)).names[(await st(s)).nameIx];
  await b.armsUp(0, true);
  await until(async () => (await s.mode()) === 'play', 25000, 'arms up to keep the name and play');
  await b.armsDown(0);
  const saved = s.fake.store.creations[0];
  assert.equal(posts(s), 1); assert.equal(saved.name, chosen); assert.equal(saved.picks.speed, 1);
  assert.ok(saved.picks.things.every(t => t.job === 'dodge'));
  await until(() => s.page.evaluate(() => !!window.__round() && window.__round().t > 0.5), 15000, 'the round to run');
  await s.page.evaluate(() => window.__finish());
  await s.modeIs('results', 20000);
  noErrors(s);
  await s.ctx.close();
});

/* ======================================================================================================================================== */
/* AND ALSO                                                                                                                                 */
/* ======================================================================================================================================== */
test('slots full: Make a game says so and starts nothing; remove one and it starts', async () => {
  const items = [1, 2, 3].map(i => ({ id: 'srv-' + i, name: 'Game ' + i, makerId: 'p1', picks: { things: [{ id: 'apple', job: 'collect' }], where: 'meadow' }, desc: 'x', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }));
  for (const [w, h] of SIZES){
    const s = await rig.open({ w, h, items, profiles: ONE });
    await s.stepIs('start');
    assert.match(await s.text('.chero'), /slots are full/i);
    await s.shot('slots-full');
    const before = await mark(s);
    await s.keys('Enter'); await sleep(500);
    assert.equal(await s.step(), 'start', 'nothing started');
    await s.body.armsUp(0, true); await sleep(1800); await s.body.armsDown(0); await sleep(500);
    assert.equal(await s.step(), 'start', 'arms up starts nothing either');
    assert.ok((await saidSince(s, before)).includes('Your slots are full - remove one to make another'), 'Cubo says it');
    assert.equal(await s.page.locator('.cslot.full').count(), 3);
    /* remove one: Play / Change / Remove, then "Sure?" */
    await s.page.locator('.cslot.full').nth(1).click();
    await s.page.locator('.cgamepop .btn.danger').waitFor();
    await s.page.locator('.cgamepop .btn.danger').click(); await s.page.locator('.cgamepop .btn.danger', { hasText: 'Sure' }).click();
    await until(async () => (await s.page.locator('.cslot.full').count()) === 2, 5000, 'the game to go');
    assert.equal(s.fake.store.creations.length, 2);
    await s.page.locator('.cgamepop').waitFor({ state: 'detached', timeout: T(4000) }).catch(() => {});
    assert.doesNotMatch(await s.text('.chero'), /slots are full/i);
    await s.keys('Enter'); await s.stepIs('where');
    noErrors(s);
    await s.ctx.close();
  }
});

test('cancel half-way and come back: Back to the start, out to Home and in again - nothing is left over, nothing fires twice', async () => {
  const s = await rig.open({ w: 1280, h: 720, profiles: ONE });
  await s.stepIs('start');
  await s.keys('Enter'); await s.stepIs('where'); await s.keys('ArrowRight', 'Enter'); await s.stepIs('game');
  await s.keys('Enter'); await s.stepIs('what'); await s.keys('ArrowRight', 'Enter'); await s.keys('Enter');
  assert.equal((await st(s)).tray.length, 1);
  /* all the way back */
  for (const want of ['what', 'game', 'where', 'start']){ await s.keys('Escape'); await s.stepIs(want); }
  assert.equal(await s.mode(), 'create');
  await s.keys('Escape'); await s.modeIs('menu');                   /* Back on the start screen leaves Create for Home */
  await s.page.evaluate(() => window.__go.toCreate()); await s.stepIs('start');
  assert.equal((await st(s)).tray.length, 0, 'a fresh start');
  const before = await mark(s);
  await s.keys('Enter'); await s.stepIs('where');
  await sleep(500);
  assert.equal((await st(s)).step, 'where', 'one press is one step (the old page is not listening)');
  assert.deepEqual(await saidSince(s, before), [LINES.where]);
  /* Home tab mid-flow does not leave a flow running behind */
  await s.keys('Escape'); await s.keys('Escape'); await s.modeIs('menu');
  await s.page.evaluate(() => window.__go.toCreate()); await s.stepIs('start');
  assert.equal(posts(s), 0, 'nothing was saved');
  noErrors(s);
  await s.ctx.close();
});

test('the camera check: someone cut off sees it, steps back, and it passes by itself; Back leaves it', async () => {
  for (const [w, h] of SIZES){
    const s = await rig.open({ w, h, profiles: ONE });
    const b = s.body;
    await s.stepIs('start'); await sleep(500);
    await b.legs(0, false);                                          /* legs out of the picture */
    await sleep(1200);
    await b.armsUp(0, true);
    await until(() => s.page.evaluate(() => !!document.querySelector('.screen.framing')), 8000, 'the camera check');
    await b.armsDown(0);
    await sleep(800);
    assert.equal(await s.step(), 'start', 'the flow waits while the check is up');
    await s.shot('camera-check');
    assert.match(await s.page.evaluate(() => document.querySelector('.screen.framing').innerText), /camera|step back|fit/i);
    await b.legs(0, true);                                           /* stepped back: in view */
    await until(async () => (await s.step()) === 'where', 15000, 'the check to pass and the flow to go on');
    assert.equal(await s.page.evaluate(() => !!document.querySelector('.screen.framing')), false);
    /* and Back out of a check goes back to the start screen, not Home */
    await s.keys('Escape'); await s.stepIs('start');
    await b.legs(0, false); await sleep(1000);
    await s.keys('Enter');
    await until(() => s.page.evaluate(() => !!document.querySelector('.screen.framing')), 8000, 'the check again');
    await s.keys('Escape');
    await sleep(500);
    assert.equal(await s.mode(), 'create', 'Back out of the check stays on Create');
    assert.equal(await s.page.evaluate(() => !!document.querySelector('.screen.framing')), false);
    assert.equal(await s.step(), 'start');
    noErrors(s);
    await s.ctx.close();
  }
});

test('a second person in view: only the first builds', async () => {
  const s = await rig.open({ w: 1280, h: 720, profiles: ONE, person: { x: 0.62 } });
  const b = s.body;
  await s.stepIs('start'); await sleep(800);
  /* a second person walks in from the left and raises both arms: nothing happens */
  await b.add(1, { x: 0.12 });
  await sleep(1500);
  assert.equal(await s.page.evaluate(() => window.__pose.players.filter(p => p.present).length), 2, 'two people are seen');
  await b.armsUp(1, true); await sleep(2200); await b.armsDown(1); await sleep(400);
  assert.equal(await s.step(), 'start', 'the second person cannot start it');
  await s.shot('second-person');
  await b.armsUp(0, true);
  await s.stepIs('where', 8000); await b.armsDown(0);
  /* the second person walks about: the world does not follow them; the first's hips do */
  await sleep(1300);
  await b.walk(1, 0.3); await b.walk(1, 0.1); await sleep(600);
  const w1 = (await st(s)).worldIx;
  await b.walk(0, 0.3); await sleep(500);
  assert.notEqual((await st(s)).worldIx, w1, 'the first person walks, the world follows');
  assert.equal((await st(s)).worldIx, 1);
  /* the second reaches into a card: nothing; the first does: it counts */
  await b.armsUp(0, true); await s.stepIs('game', 8000); await b.armsDown(0); await sleep(1300);
  await b.reachEl('.cccard', 0, { i: 1, side: 'l' });
  await sleep(1800);
  assert.equal(await s.step(), 'game', 'a second person touching a card does nothing');
  await b.release(1);
  await b.reachEl('.cccard', 1, { i: 0 });
  await until(async () => (await s.step()) === 'what', 12000, 'the builder touching a card');
  assert.equal((await st(s)).job, 'dodge');
  await b.release(0);
  noErrors(s);
  await s.ctx.close();
});

test('the server out of reach: the game is kept on this TV and plays; and when the server refuses, the name step comes back with its words', async () => {
  const quickly = async (s) => { await s.keys('Enter'); await s.stepIs('where'); await s.keys('Enter'); await s.stepIs('game'); await s.keys('Enter'); await s.stepIs('what'); await s.keys('Enter', 'Enter'); await s.keys('ArrowDown', 'ArrowDown', 'Enter'); await s.stepIs('rules'); await s.keys('Enter', 'Enter', 'Enter'); await s.stepIs('name'); };
  /* out of reach */
  let s = await rig.open({ w: 1280, h: 720, profiles: ONE, down: true });
  await s.stepIs('start'); await quickly(s); await s.keys('Enter');
  await s.modeIs('play', 25000);
  assert.equal(await s.page.evaluate(() => JSON.parse(localStorage.getItem('orlis.creations:here') || '[]').length), 1, 'kept on this TV');
  assert.equal(await s.page.evaluate(() => JSON.parse(localStorage.getItem('orlis.creations:here'))[0].pending), true, 'waiting to go up');
  noErrors(s);
  await s.ctx.close();
  /* refused: the server says the slots are full (another TV filled them) */
  s = await rig.open({ w: 1280, h: 720, profiles: ONE });
  await s.stepIs('start');
  s.fake.store.creations.push(...[1, 2, 3].map(i => ({ id: 'srv-x' + i, name: 'X' + i, picks: { things: [{ id: 'apple', job: 'collect' }] } })));
  await quickly(s);
  await s.keys('Enter');
  await until(async () => /slots are full/i.test(await toastText(s)), 8000, 'the server\'s words');
  await s.stepIs('name');
  assert.equal(await s.mode(), 'create');
  await s.shot('save-refused');
  await s.keys('Escape'); await s.stepIs('rules');
  s.errors = s.errors.filter(e => !/status of 409/.test(e));         /* (the browser's own note of the refusal this test asked for) */
  noErrors(s);
  await s.ctx.close();
});
