/* Cubo's Create, end to end (decisions 0060, 0061): the real page in headless Chromium (Vite dev server), driven the three ways a family drives it, from the
   Create tab to a saved, playing game and back:

     remote only   arrows, OK (Enter), Back (Escape)
     mouse only    clicks on the big targets (the camera is not there: the tracker falls back to the mouse)
     body only     a scripted person (a grown-up, and a child) fed through the tracker (pose._assign): reaching and holding a hand on targets, both arms up,
                   walking, a raised hand's height on the meter, a jump (the page's camera is switched on by the page itself or nobody is seen: harness/cubo-rig.mjs)

   Plus: the slots full, cancelling half-way and coming back, the camera check, a second person (only the first builds), the server out of reach and refusing.
   Every test fails on any page error or console error.

   Steady under load: every wait ends the moment its thing happens, and its deadline scales with how busy the machine is (harness/slowness.mjs T(), used by
   until() and the rig); waits for "a moment of the page" use the page's own clock (s.pageWait), which runs as slowly as the page does, so nothing is a fixed sleep.
   Run by cubo-create-e2e.test.mjs in a plain Node process (see pad-page.test.mjs); set CUBO_E2E_SHOTS=<folder> to also keep pictures (docs/calm/cubo2-*.png). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startCuboRig, until, SHOTS, PROFILES } from './harness/cubo-rig.mjs';
import { T } from './harness/slowness.mjs';

let rig;
before(async () => { rig = await startCuboRig(); });
after(async () => { await rig?.close(); });

const ONE = [PROFILES[0]];                       /* a family of one: no Who's who before the first game */
const SIZES = SHOTS ? [[1920, 1080], [1280, 720]] : [[1280, 720]];
const LINES = {
  start: "Let's make a game! Raise both arms to start.",
  where: 'Where shall we play?',
  game: 'What kind of game?',
  speed: 'How fast? Raise your hand!',
  many: 'How many? Raise your hand!',
  name: 'Jump to spin! Arms up to keep it!',
  play: 'Here we go!'
};
const DEMO = { hold: 'Hold your hand on one!', arms: "Arms up when you're done!" };

/* ---------- helpers ---------- */
const said = async (s) => (await s.hearLog()).map(x => x.line);
const count = (list, line) => list.filter(l => l === line).length;
const st = (s) => s.state();
const mark = async (s) => (await s.hearLog()).length;
const saidSince = async (s, n) => (await s.hearLog()).slice(n).map(x => x.line);
const sleepPage = (s, secs) => s.pageWait(secs);
/* every pair of big things on a step is clear of the others (a bubble over a card, the label over the meter, the tray over the parade) */
async function layoutProblems(s){
  return s.page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.closest('.hide') && getComputedStyle(e).display !== 'none' ? r : null; };
    const pick = (sel, name) => [...document.querySelectorAll(`.cc ${sel}`)].map((e, i) => ({ name: `${name}${i}`, r: vis(e) })).filter(x => x.r);
    const things = [
      ...pick('.ccbubble', 'bubble'), ...pick('.ccback', 'back'), ...pick('.ccarms', 'arms'), ...pick('.ccsteps', 'steps'), ...pick('.ccworld', 'world'),
      ...pick('.cccard', 'card'), ...pick('.cctile', 'tile'), ...pick('.cctray', 'tray'), ...pick('.ccfloat', 'float'),
      ...pick('.ccq', 'question'), ...pick('.ccmpill', 'meter'), ...pick('.ccmend', 'end'), ...pick('.ccwheel', 'wheel'), ...pick('.ccgo', 'go')
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
async function noOverlaps(s, label){ assert.deepEqual(await layoutProblems(s), [], `${label}: things overlap or leave the screen at ${s.w}x${s.h}`); }
/* the remote's focus is always on screen: with the remote in use, exactly one visible focused element, in the flow's zone and item, wearing a ring */
async function focusIs(s, zone, item, shot = null){
  const f = await s.page.evaluate(() => {
    const els = [...document.querySelectorAll('.cc .sel')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.closest('.hide'); });
    const e = els[0], cs = e && getComputedStyle(e);
    return { n: els.length, remote: document.body.classList.contains('remote'), zone: e && e.dataset.zone, item: e && Number(e.dataset.item), ring: !!cs && /rgb/.test(cs.boxShadow) };
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
const groupIds = (s, group) => s.page.evaluate(async (g) => (await import('/src/create/recipe.js')).choices.what.find(c => c.id === g).pieces.map(p => p.id), group);
const posts = (s) => s.fake.store.calls.filter(c => c === 'POST /api/creations').length;
const toastText = (s) => s.page.evaluate(() => [...document.querySelectorAll('.toast, .toasts > *')].map(e => e.textContent).join(' | '));
/* wait for the step's lock (a hand resting where the last pick was is waited out) and its first frame */
const ready = (s) => s.settled(4000);
/* a flow with no tick for a moment: just let the page's own clock run */
const waitSaid = (s, line) => until(async () => (await said(s)).includes(line), 8000, `Cubo to say "${line}"`);

/* a person reaches with the nearer hand: the reach of the nearer shoulder to a target */
async function nearerHand(s, sel, nth = 0){
  const r = await s.reachInfo(sel, nth, 0, 'r'), l = await s.reachInfo(sel, nth, 0, 'l');
  if (!r || !l) return r || l;
  return l.d < r.d ? { ...l, side: 'l' } : { ...r, side: 'r' };
}
/* the targets of a step are in the first player's comfort zone: an arm's reach from where they stand, between chest and just above the head, never below the hips */
async function assertInReach(s, label){
  const ts = await s.targets(), bad = [];
  let items = 0, itemsInReach = 0;
  for (const t of ts){
    if (['back', 'arms'].includes(t.name) || t.name.startsWith('stop-')) continue;           /* (the two corners; the meter is a height, not a place) */
    const info = await nearerHand(s, `.cc [data-t="${t.name}"]`);
    if (!info) continue;
    const reach = info.arm * 1.15;
    const chest = info.shoulder + 0.35 * (info.hips - info.shoulder);
    if (info.bottom > info.hips + 0.003) bad.push(`${t.name} goes below the hips (${info.bottom.toFixed(3)} vs ${info.hips.toFixed(3)})`);
    if (t.name.startsWith('item-')){ items++; if (info.d <= reach) itemsInReach++; continue; }
    if (info.d > reach) bad.push(`${t.name} is ${info.d.toFixed(3)} from the shoulder: more than an arm (${reach.toFixed(3)})`);
    if (!t.name.startsWith('tray-') && !['groups'].includes(t.name) && (info.centreY < info.head - 0.1 || info.centreY > chest + 0.012)) bad.push(`${t.name} is not between chest and above the head (middle ${info.centreY.toFixed(3)}, head ${info.head.toFixed(3)}, chest ${chest.toFixed(3)})`);
  }
  if (items) assert.ok(itemsInReach >= 1 && items >= 3, `${label}: some of the parade is always in reach (${itemsInReach} of ${items})`);
  assert.deepEqual(bad, [], `${label}: targets out of comfort`);
}

/* after the name: the Who's who (a family of two), the game, its scores, Change it (back into the flow with the picks kept) and Home */
async function playThenChange(s, how, saved){
  if (await s.mode() === 'lineup'){
    if (how === 'remote') await s.keys('ArrowRight', 'Enter'); else await s.click('.screen.lineup .btn.go');
  }
  await s.modeIs('play', 20000);
  const g = await s.page.evaluate(() => ({ made: window.__game().made && window.__game().made.id, name: window.__game().name }));
  assert.equal(g.made, saved.id, 'the game that plays is the one just saved');
  await until(() => s.page.evaluate(() => !!window.__round() && window.__round().t > 0.5), 15000, 'the round to run');
  await s.page.evaluate(() => window.__finish());
  await s.modeIs('results', 20000);
  await until(() => s.page.evaluate(() => [...document.querySelectorAll('.screen .btn')].map(b => b.textContent.trim()).join('|') === 'Play again|Change it|Home'), 8000, 'the scores card');
}

/* ======================================================================================================================================== */
/* REMOTE ONLY                                                                                                                              */
/* ======================================================================================================================================== */
for (const [w, h] of SIZES){
  test(`remote only (${w}x${h}): the Create tab to a saved, playing game, Change it, Home - Back goes one step at every step`, async () => {
    const s = await rig.open({ w, h });
    await s.stepIs('start');
    assert.equal(await s.page.evaluate(() => window.__cam.wanted), true, 'Create switches the camera on (the body is what makes a game here)');
    assert.deepEqual(await said(s), [LINES.start]);
    await s.keys('Enter');
    await s.stepIs('where');
    assert.equal(await s.mode(), 'create', 'Enter on the start screen begins Cubo\'s Create (it did not open the menu or Settings)');
    assert.equal(await s.page.evaluate(() => !!document.querySelector('.dim')), false, 'no menu opened');
    assert.equal(await s.bubble(), LINES.where);
    await ready(s);
    await noOverlaps(s, 'where'); await assertInReach(s, 'where (default zone)');
    /* Where: left and right slide the carousel; the name follows */
    await s.keys('ArrowRight', 'ArrowRight');
    await focusIs(s, 'world', 2, 'where');
    assert.equal(await s.text('.ccworld'), await s.page.evaluate(async () => (await import('/src/create/recipe.js')).choices.where[2].label));
    await s.keys('ArrowLeft'); assert.equal((await st(s)).worldIx, 1);
    await s.keys('Escape'); await s.stepIs('start');
    assert.equal(await s.visible('.chero'), true, 'the start screen is back');
    await s.keys('Enter'); await s.stepIs('where'); assert.equal((await st(s)).worldIx, 1, 'the world picked is kept');
    await s.keys('Enter'); await s.stepIs('game');
    assert.equal(await s.bubble(), LINES.game);
    await ready(s); await s.shot('game'); await noOverlaps(s, 'game'); await assertInReach(s, 'game');
    await s.keys('Escape'); await s.stepIs('where'); await s.keys('Enter'); await s.stepIs('game');
    /* the game: one row of four, left and right, OK picks */
    await s.keys('ArrowRight'); await focusIs(s, 'card', 1, 'game');
    await s.keys('ArrowRight', 'ArrowRight'); assert.equal((await st(s)).gameIx, 3);
    await s.keys('ArrowLeft'); assert.equal((await st(s)).gameIx, 2);
    await s.keys('ArrowRight');                                   /* Stack */
    await s.keys('Enter'); await s.stepIs('what');
    assert.equal(await s.bubble(), 'What shall we stack? Hold one to open it!');
    await ready(s); await noOverlaps(s, 'what, tiles'); await assertInReach(s, 'what, tiles'); await s.shot('what-tiles');
    await s.keys('ArrowRight'); await focusIs(s, 'tiles', 1, 'what-tiles'); await s.keys('ArrowLeft');
    await s.keys('ArrowDown'); await focusIs(s, 'tiles', 0);       /* (nothing below the tiles) */
    /* a group (Back leaves it first), then the parade: OK grabs the lit one */
    await s.keys('ArrowRight', 'Enter');
    assert.equal((await st(s)).group, 'animals');
    await s.keys('Escape'); assert.equal((await st(s)).group, null, 'Back leaves the group first'); assert.equal(await s.step(), 'what');
    await focusIs(s, 'tiles', 1);
    await s.keys('Enter'); assert.equal((await st(s)).group, 'animals');
    await focusIs(s, 'parade', 0, 'what-parade');
    await ready(s); await noOverlaps(s, 'what, parade'); await assertInReach(s, 'what, parade');
    const ids = await groupIds(s, 'animals');
    /* the parade comes round to the one the remote lights, and waits there; OK takes it */
    await s.keys('ArrowRight', 'ArrowRight');
    await focusIs(s, 'parade', 2);
    assert.equal(await s.visible('.ccfloat.sel'), true, 'the lit thing is on screen');
    await s.keys('Enter'); assert.deepEqual((await st(s)).tray, [ids[2]], 'OK grabs the lit thing');
    await s.keys('ArrowRight', 'Enter'); assert.deepEqual((await st(s)).tray, [ids[2], ids[3]]);
    await s.shot('what-tray'); await noOverlaps(s, 'what, parade and tray');
    /* the tray: down into it, OK puts one back; up; Groups (up again) goes to the tiles; down to Done */
    await s.keys('ArrowDown'); await focusIs(s, 'tray', 0, 'what-tray');
    await s.keys('Enter'); assert.deepEqual((await st(s)).tray, [ids[3]], 'OK in the tray takes one back');
    await s.keys('ArrowUp'); await s.keys('ArrowUp'); await focusIs(s, 'groups', 0);
    await s.keys('Enter'); assert.equal((await st(s)).group, null, 'OK on Groups goes back to the tiles'); assert.deepEqual((await st(s)).tray, [ids[3]], 'the tray is kept');
    await s.keys('Enter'); await s.keys('ArrowDown', 'ArrowDown'); await focusIs(s, 'done', 0, 'what-done');
    const things = (await st(s)).tray.slice();
    await s.keys('Enter'); await s.stepIs('rules');
    assert.deepEqual((await st(s)).picks.things.map(t => t.id), things);
    assert.equal(await s.bubble(), LINES.speed);
    /* Rules: Up and Down move the stop, OK sets it and goes to the next question */
    await ready(s); await noOverlaps(s, 'rules'); await assertInReach(s, 'rules');
    await s.keys('ArrowUp', 'ArrowUp'); assert.equal((await st(s)).picks.speed, 5);
    await focusIs(s, 'meter', 0, 'rules-speed'); await s.shot('rules-speed');
    await s.keys('ArrowDown'); assert.equal((await st(s)).picks.speed, 4);
    await s.keys('Enter'); assert.equal((await st(s)).q, 'many'); assert.equal(await s.bubble(), LINES.many);
    await s.keys('ArrowDown', 'ArrowDown'); assert.equal((await st(s)).picks.many, 1);
    await focusIs(s, 'meter', 1, 'rules-many'); await noOverlaps(s, 'rules, how many');
    await s.keys('Escape'); assert.equal((await st(s)).q, 'speed', 'Back from how many to how fast');
    await s.keys('Escape'); await s.stepIs('what'); assert.equal((await st(s)).group, null);
    await s.keys('Enter', 'ArrowDown', 'ArrowDown', 'Enter'); await s.stepIs('rules');
    assert.equal((await st(s)).picks.speed, 4, 'the speed is kept'); assert.equal((await st(s)).picks.many, 1, 'the number is kept');
    await s.keys('Enter', 'Enter'); await s.stepIs('name');
    assert.equal(await s.bubble(), LINES.name);
    await ready(s); await s.shot('name'); await noOverlaps(s, 'name'); await assertInReach(s, 'name');
    await focusIs(s, 'keep', 0, 'name');
    const names = (await st(s)).names;
    assert.ok(names.length >= 6, 'a wheel of names');
    await s.keys('ArrowRight', 'ArrowRight'); assert.equal((await st(s)).nameIx, 2);
    await s.keys('ArrowLeft'); assert.equal((await st(s)).nameIx, 1);
    await s.keys('Escape'); await s.stepIs('rules'); await s.keys('Enter', 'Enter'); await s.stepIs('name');
    await s.keys('ArrowRight'); const chosen = names[(await st(s)).nameIx];
    const before = await mark(s);
    await s.keys('Enter', 'Enter', 'Enter');                         /* (pressing again while it counts down does nothing: not the tab bar, not Settings) */
    await until(async () => (await s.mode()) !== 'create', 25000, 'the game to start');
    assert.equal(posts(s), 1, 'saved once');
    const saved = s.fake.store.creations[0];
    assert.equal(saved.name, chosen); assert.equal(saved.makerId, PROFILES[PROFILES.length - 1].id);
    assert.deepEqual(saved.picks.things.map(t => t.id).sort(), things.slice().sort());
    assert.ok(saved.picks.things.every(t => t.job === 'stack'));
    assert.equal(count(await saidSince(s, before), LINES.play), 1, 'Cubo says "Here we go!" once');
    /* Cubo showed each gesture once, whatever the route */
    assert.ok(count(await said(s), DEMO.hold) <= 1 && count(await said(s), DEMO.arms) <= 1, 'each gesture shown at most once');
    await playThenChange(s, 'remote', saved);
    const mk = await mark(s);
    await s.keys('ArrowDown', 'Enter');                              /* Change it */
    await s.modeIs('create'); await s.stepIs('where');
    assert.equal(await s.bubble(), LINES.where);
    assert.ok(!(await saidSince(s, mk)).includes(DEMO.arms) || count(await said(s), DEMO.arms) <= 1, 'Cubo does not show arms up a second time');
    assert.equal((await st(s)).editing, saved.id); assert.deepEqual((await st(s)).tray.slice().sort(), things.slice().sort(), 'the picks are kept');
    assert.equal((await st(s)).picks.speed, 4);
    await s.keys('Enter'); await s.stepIs('game'); await s.keys('Enter'); await s.stepIs('what');
    await s.keys('Enter', 'ArrowDown', 'ArrowDown', 'Enter'); await s.stepIs('rules');
    assert.equal((await st(s)).picks.speed, 4, 'the old rules came back with it');
    await s.keys('Enter', 'Enter'); await s.stepIs('name');
    await s.keys('Enter');
    await until(async () => (await s.mode()) === 'play', 25000, 'the changed game to play');
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
  assert.equal(count(await said(s), LINES.where), 1);
  await ready(s);
  await noOverlaps(s, 'where (mouse)');
  await s.click('.ccpeek.right'); assert.equal((await st(s)).worldIx, 1);
  await s.click('.ccpeek.right'); assert.equal((await st(s)).worldIx, 2);
  await s.click('.ccpeek.left'); assert.equal((await st(s)).worldIx, 1);
  await until(async () => (await s.carousel()).t >= 1, 5000, 'the carousel to settle');
  await s.click('.ccback'); await s.stepIs('start');
  await s.click('.chero'); await s.stepIs('where');
  assert.equal((await st(s)).worldIx, 1);
  await s.click('.ccarms'); await s.stepIs('game');
  await s.click('.ccback'); await s.stepIs('where');
  await s.click('.ccarms'); await s.stepIs('game');
  assert.equal(await s.visible('.ccarms'), false, 'Arms up is not for choosing a game');
  await s.click('.cccard', 2); await s.stepIs('what');
  assert.equal((await st(s)).job, 'keepup');
  await s.click('.ccback'); await s.stepIs('game');
  await s.click('.cccard', 1); await s.stepIs('what');              /* Dodge */
  assert.equal((await st(s)).job, 'dodge');
  assert.equal(await s.visible('.ccarms'), false, 'Arms up only shows once something is picked');
  await s.click('.cctile', 3); assert.equal((await st(s)).group, 'toys');
  await s.click('.ccback'); assert.equal((await st(s)).group, null); assert.equal(await s.step(), 'what');
  await s.click('.cctile', 0); assert.equal((await st(s)).group, 'food');
  await noOverlaps(s, 'what (mouse)');
  /* a click on a thing in the parade takes it (the parade floats: click it where it is) */
  const ids = await groupIds(s, 'food');
  const grab = async (i) => { await s.page.locator(`.ccfloat[data-i="${i}"]`).dispatchEvent('click'); };
  await grab(0); assert.deepEqual((await st(s)).tray, [ids[0]]);
  await grab(0); await until(async () => /have that one/i.test(await toastText(s)), 3000, 'the words');
  await grab(1);
  assert.equal((await st(s)).tray.length, 2); assert.equal(await s.visible('.ccarms'), true);
  await s.click('.cctrayslot:not(.empty)', 0); assert.equal((await st(s)).tray.length, 1, 'a click on the tray takes one back');
  await grab(2);
  await s.click('.ccgroups'); assert.equal((await st(s)).group, null, 'Groups goes back to the tiles');
  await s.click('.cctile', 0);
  await s.click('.ccarms'); await s.stepIs('rules');
  await ready(s);
  await s.click('.ccmstop', 6); assert.equal((await st(s)).picks.speed, 6); assert.equal((await st(s)).q, 'many');
  await s.click('.ccmstop', 1); assert.equal((await st(s)).picks.many, 1);
  await noOverlaps(s, 'rules (mouse)');
  await s.click('.ccarms'); await s.stepIs('name');
  await ready(s);
  const ix0 = (await st(s)).nameIx;
  await s.click('.ccwheel'); assert.notEqual((await st(s)).nameIx, ix0, 'a click on the wheel spins it');
  const chosen = (await st(s)).names[(await st(s)).nameIx];
  await s.click('.ccarms');
  await until(async () => (await s.mode()) !== 'create', 25000, 'the game to start');
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
/* BODY ONLY: a grown-up and a child                                                                                                        */
/* ======================================================================================================================================== */
/* a hand held on a target (found each frame, so a floating one is followed) until `pred` is true; the ring, the tone and the glow are looked at on the way */
async function holdOn(s, sel, pred, { shot = null, label = sel, nth = 0 } = {}){
  const b = s.body;
  const near = await nearerHand(s, sel, nth);
  await b.reachNear(sel, nth, { side: near ? near.side : 'r' });
  try {
    if (shot){
      await until(async () => { const hd = await s.holding(); return hd && hd.k > 0.35; }, 8000, `the ring to fill round the hand on ${label}`);
      await s.shot(shot);
    }
    await until(pred, 12000, `holding ${label}`);
  } finally { await b.release(0); }
}
async function bodyFlow(s, { how }){
  const b = s.body, kid = !!s.kid;
  await s.stepIs('start');
  assert.equal(await s.page.evaluate(() => window.__cam.wanted), true, 'Create switches the camera on');
  await s.pageWait(1.5, 'of standing there');
  assert.equal(await s.step(), 'start', 'standing still starts nothing');
  if (how === 'hold-cubo'){
    /* touch and hold Cubo on the banner */
    await s.shot('start');
    await b.reachNear('.chcubo');
    await until(async () => (await s.step()) === 'where', 12000, 'a hand held on Cubo to start');
    await b.release(0);
  } else {
    await s.shot('start');
    await b.armsUp(0, true);
    await until(async () => (await s.step()) === 'where', 12000, 'arms up to start');
    await b.armsDown(0);
  }
  /* Where: Cubo shows arms up, once; the carousel; reach toward a peek and hold, and it slides */
  await ready(s);
  await waitSaid(s, DEMO.arms);
  assert.equal(count(await said(s), LINES.where), 1); assert.equal(count(await said(s), DEMO.arms), 1);
  await s.pageWait(0.5);
  const z = await s.zone();
  assert.equal(z.body, true, 'the zone follows the body');
  await assertInReach(s, 'where'); await noOverlaps(s, 'where');
  await s.shot('where');
  const w0 = (await st(s)).worldIx;
  await b.reachNear('.ccpeek.right');
  await until(async () => (await s.holding()), 8000, 'a ring round the hand on the next world');
  const hd = await s.holding(); assert.ok(hd.k > 0 && hd.k < 1);
  await s.shot('where-hold');
  const seen = [];
  await until(async () => { const c = await s.carousel(); seen.push(c.pos); return (await st(s)).worldIx !== w0 && c.t >= 1; }, 12000, 'the world to slide in');
  await b.release(0);
  assert.equal((await st(s)).worldIx, (w0 + 1) % 6);
  assert.ok(seen.some(p => p > w0 + 0.05 && p < w0 + 0.95) || (await s.sfx()).whoosh > 0, 'it slid (eased), with a whoosh');
  assert.ok((await s.sfx()).whoosh >= 1, 'a whoosh');
  assert.ok((await s.sfx()).rise.length >= 2, 'a rising tone while the hand held');
  await s.shot('where-peeks');
  /* stepping sideways still slides it */
  await b.walk(0, 0.3 + 0.0); await b.walk(0, 0.7);
  await until(async () => (await st(s)).worldIx >= 4, 8000, 'walking right to slide the carousel on');
  await b.walk(0, 0.58);
  /* arms up chooses (the world settles first: the slide that the walk back set going) */
  await s.pageWait(1.5);
  const world = (await st(s)).worldIx;
  await b.armsUp(0, true);
  await s.stepIs('game', 12000); await b.armsDown(0);
  assert.equal((await st(s)).picks.where, await s.page.evaluate(async (i) => (await import('/src/create/recipe.js')).choices.where[i].id, world), 'the world on show is the world picked');
  /* the game: one row of four at chest-to-head height; Cubo shows "hold" once; a hand near a card grows and glows it, and its Cubo moves */
  await ready(s);
  await waitSaid(s, DEMO.hold);
  assert.equal(count(await said(s), DEMO.hold), 1);
  await assertInReach(s, 'game'); await noOverlaps(s, 'game');
  await s.shot('game');
  const rises0 = (await s.sfx()).rise.length, pops0 = (await s.sfx()).pop;
  await b.reachNear('.cccard', 1);
  await until(async () => parseFloat(await s.page.evaluate(() => document.querySelectorAll('.cccard')[1].style.getPropertyValue('--near') || '0')) > 0.5, 8000, 'the card to grow and glow as the hand nears');
  assert.equal(await s.step(), 'game', 'a pick takes a moment: the ring fills first');
  await until(async () => (await s.holding()) && (await s.holding()).k > 0.3, 8000, 'the ring round the hand');
  await s.shot('game-hold');
  const pulled = await s.page.evaluate(async () => {            /* the marker is drawn pulled toward the card's centre */
    const { magnet } = await import('/src/ui/magnet.js'), h = document.querySelector('.cc').holding;
    if (!h || !magnet.targets.length) return null;
    const p = magnet.pull(h.x, h.y), t = magnet.targets.reduce((a, c) => (Math.hypot(c.x - h.x, c.y - h.y) < Math.hypot(a.x - h.x, a.y - h.y) ? c : a));
    return { moved: Math.hypot(p.x - h.x, p.y - h.y), before: Math.hypot(t.x - h.x, t.y - h.y), after: Math.hypot(t.x - p.x, t.y - p.y) };
  });
  assert.ok(pulled && pulled.after <= pulled.before + 1e-9, 'the hand marker is pulled toward the card’s centre (a magnet)');
  await until(async () => (await s.step()) === 'what', 12000, 'a hand held on the Dodge card');
  await b.release(0);
  assert.equal((await st(s)).job, 'dodge');
  const sf = await s.sfx(); assert.ok(sf.rise.length > rises0 + 1 && sf.rise.at(-1) > sf.rise[rises0], 'the tone rose'); assert.ok(sf.pop > pops0, 'a pop on the pick');
  assert.equal(count(await said(s), 'Dodge'), 1, 'its name is said once');
  /* What: five tiles at shoulder height; hold one; the parade; touch and hold a thing and it flies to the tray */
  await ready(s);
  await assertInReach(s, 'what, tiles'); await noOverlaps(s, 'what, tiles');
  await s.shot('what-tiles');
  await holdOn(s, '.cctile', async () => (await st(s)).group === 'sky', { label: 'the Sky tile', nth: 2 });
  await ready(s);
  await assertInReach(s, 'what, parade'); await noOverlaps(s, 'what, parade');
  await s.shot('what-parade');
  const grabOne = async (n, shot) => {
    /* a thing that is floating within this player's reach now */
    const item = await until(async () => {
      const ts = (await s.targets()).filter(t => t.name.startsWith('item-') && !(t.x < 0));
      for (const t of ts){
        const info = await s.reachInfo(`.cc [data-t="${t.name}"]`);
        const id = t.name.slice(5);
        if (info && info.d <= info.arm * 0.9 && !(await st(s)).tray.includes(id) && t.x + t.w / 2 > 0.12) return id;
      }
      return null;
    }, 20000, 'a thing in the parade within reach');
    await holdOn(s, `.cc [data-t="item-${item}"]`, async () => (await st(s)).tray.length >= n, { shot, label: `the ${item}` });
    return item;
  };
  const first = await grabOne(1, 'what-hold');
  assert.deepEqual((await st(s)).tray, [first]);
  await until(() => s.page.evaluate(() => document.querySelectorAll('.cctrayslot:not(.empty)').length === 1), 4000, 'the tray to show it');
  const second = await grabOne(2);
  assert.notEqual(second, first);
  await s.shot('what-tray');
  await noOverlaps(s, 'what, parade and tray'); await assertInReach(s, 'what, tray');
  /* holding on a tray thing puts it back */
  await holdOn(s, '.cc [data-t="tray-0"]', async () => (await st(s)).tray.length === 1, { label: 'the first thing in the tray' });
  assert.deepEqual((await st(s)).tray, [second]);
  await s.pageWait(0.4);
  await grabOne(2);
  /* Groups: back to the tiles, and in again */
  await holdOn(s, '.cc [data-t="groups"]', async () => (await st(s)).group === null, { label: 'Groups' });
  await ready(s);
  await holdOn(s, '.cctile', async () => (await st(s)).group === 'animals', { label: 'the Animals tile', nth: 1 });
  await ready(s);
  assert.equal((await st(s)).tray.length, 2, 'the tray is kept');
  const things = (await st(s)).tray.slice();
  await s.pageWait(0.5);
  await b.armsUp(0, true);
  await s.stepIs('rules', 12000); await b.armsDown(0);
  assert.deepEqual((await st(s)).picks.things.map(t => t.id), things);
  /* Rules: "How fast?" - a tall meter beside the player; the hand's height is the stop, live; held still it sets */
  await ready(s);
  await waitSaid(s, LINES.speed);
  await noOverlaps(s, 'rules'); await assertInReach(s, 'rules');
  const stopY = async (i) => s.page.evaluate((i) => { const r = document.querySelectorAll('.ccmstop')[i].getBoundingClientRect(); return (r.top + r.height / 2) / innerHeight; }, i);
  const px = (await s.zone()).x + 0.08 * (kid ? 0.7 : 1);
  await b.reachXY(px, await stopY(2));
  await until(async () => (await st(s)).picks.speed === 2, 8000, 'the hand at the third stop');
  assert.equal((await st(s)).q, 'speed', 'live: not set yet');
  await b.reachXY(px, await stopY(5));
  await until(async () => (await st(s)).picks.speed === 5, 8000, 'the hand raised to the sixth stop');
  assert.equal((await st(s)).q, 'speed', 'still live (the hand has not been still a second)');
  await s.shot('rules-raise');
  await until(async () => (await st(s)).q === 'many', 12000, 'the hand held still to set the speed');
  assert.equal((await st(s)).picks.speed, 5);
  await b.release(0);
  await waitSaid(s, LINES.many);
  await s.pageWait(0.3);
  await b.reachXY(px, await stopY(3));
  await until(async () => (await st(s)).picks.many === 3, 8000, 'the hand at the middle');
  await b.reachXY(px, await stopY(6));
  await until(async () => (await st(s)).picks.many === 6, 8000, 'the hand at the top: a storm');
  await s.shot('rules-many');
  await until(async () => (await st(s)).manySet, 12000, 'the hand held still to set how many');
  assert.equal(await s.step(), 'rules', 'set, not gone on: arms up goes on');
  await b.release(0);
  await b.armsUp(0, true);
  await s.stepIs('name', 12000); await b.armsDown(0);
  assert.equal((await st(s)).picks.speed, 5, 'the raised speed is what was kept'); assert.equal((await st(s)).picks.many, 6);
  /* Name: a jump spins; a hand held on the wheel spins; arms up keeps */
  await ready(s);
  await assertInReach(s, 'name'); await noOverlaps(s, 'name');
  const n0 = (await st(s)).nameIx;
  await b.jump(0);
  await until(async () => (await st(s)).nameIx !== n0, 8000, 'a jump spinning the names');
  const n1 = (await st(s)).nameIx;
  await s.pageWait(1);
  await holdOn(s, '.ccwheel', async () => (await st(s)).nameIx !== n1, { shot: 'name-hold', label: 'the wheel' });
  await s.shot('name');
  await s.pageWait(1);
  const chosen = (await st(s)).names[(await st(s)).nameIx];
  await b.armsUp(0, true);
  await until(async () => (await s.step()) === 'play', 12000, 'arms up to keep the name');
  await b.armsDown(0);
  await until(() => s.page.evaluate(() => !!document.querySelector('.ccgo') && /^[123]$/.test(document.querySelector('.ccgo').textContent)), 8000, 'the 3-2-1');
  await s.shot('countdown');
  await until(async () => (await s.mode()) === 'play', 25000, 'the countdown then the game');
  const saved = s.fake.store.creations[0];
  assert.equal(posts(s), 1); assert.equal(saved.name, chosen); assert.equal(saved.picks.speed, 5);
  assert.ok(saved.picks.things.every(t => t.job === 'dodge'));
  await until(() => s.page.evaluate(() => !!window.__round() && window.__round().t > 0.5), 15000, 'the round to run');
  await s.page.evaluate(() => window.__finish());
  await s.modeIs('results', 20000);
  /* Cubo showed each gesture once in the whole flow */
  assert.equal(count(await said(s), DEMO.hold), 1); assert.equal(count(await said(s), DEMO.arms), 1);
  noErrors(s);
}
for (const [w, h] of SIZES){
  test(`body only (${w}x${h}), a grown-up: reach and hold, arms up, the carousel, the parade, a raised hand on the meter, a jump - to a saved, playing game`, async () => {
    const s = await rig.open({ w, h, profiles: ONE });
    await bodyFlow(s, { how: 'hold-cubo' });
    await s.ctx.close();
  });
  test(`body only (${w}x${h}), a child: every target within a child's reach, never below the hips - to a saved, playing game`, async () => {
    const s = await rig.open({ w, h, profiles: ONE, kid: true });
    await bodyFlow(s, { how: 'arms' });
    await s.ctx.close();
  });
}

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
    await s.keys('Enter'); await s.pageWait(0.6);
    assert.equal(await s.step(), 'start', 'nothing started');
    await s.body.armsUp(0, true);
    await until(async () => (await saidSince(s, before)).filter(l => l === 'Your slots are full - remove one to make another').length >= 1, 8000, 'Cubo to say it for arms up too');
    await s.body.armsDown(0); await s.pageWait(0.5);
    assert.equal(await s.step(), 'start', 'arms up starts nothing either');
    assert.equal(await s.page.locator('.cslot.full').count(), 3);
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
  for (const want of ['what', 'game', 'where', 'start']){ await s.keys('Escape'); await s.stepIs(want); }
  assert.equal(await s.mode(), 'create');
  await s.keys('Escape'); await s.modeIs('menu');                   /* Back on the start screen leaves Create for Home */
  await s.page.evaluate(() => window.__go.toCreate()); await s.stepIs('start');
  assert.equal((await st(s)).tray.length, 0, 'a fresh start');
  const before = await mark(s);
  await s.keys('Enter'); await s.stepIs('where');
  await s.pageWait(0.5);
  assert.equal((await st(s)).step, 'where', 'one press is one step (the old page is not listening)');
  assert.equal(count(await saidSince(s, before), LINES.where), 1);
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
    await s.stepIs('start'); await s.pageWait(0.5);
    await b.legs(0, false);                                          /* legs out of the picture */
    await s.pageWait(1);
    await b.armsUp(0, true);
    await until(() => s.page.evaluate(() => !!document.querySelector('.screen.framing')), 12000, 'the camera check');
    await b.armsDown(0);
    await new Promise(r => setTimeout(r, 700));                      /* (the page's own clock is not running under the check) */
    assert.equal(await s.step(), 'start', 'the flow waits while the check is up');
    await s.shot('camera-check');
    assert.match(await s.page.evaluate(() => document.querySelector('.screen.framing').innerText), /camera|step back|fit/i);
    await b.legs(0, true);                                           /* stepped back: in view */
    await until(async () => (await s.step()) === 'where', 20000, 'the check to pass and the flow to go on');
    assert.equal(await s.page.evaluate(() => !!document.querySelector('.screen.framing')), false);
    await s.keys('Escape'); await s.stepIs('start');
    await b.legs(0, false); await s.pageWait(0.8);
    await s.keys('Enter');
    await until(() => s.page.evaluate(() => !!document.querySelector('.screen.framing')), 12000, 'the check again');
    await s.keys('Escape');
    await s.pageWait(0.4);
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
  await s.stepIs('start'); await s.pageWait(0.6);
  await b.add(1, { x: 0.12 });
  await until(() => s.page.evaluate(() => window.__pose.players.filter(p => p.present).length === 2), 10000, 'two people to be seen');
  await b.armsUp(1, true); await s.pageWait(2); await b.armsDown(1); await s.pageWait(0.4);
  assert.equal(await s.step(), 'start', 'the second person cannot start it');
  await s.shot('second-person');
  await b.armsUp(0, true);
  await s.stepIs('where', 12000); await b.armsDown(0);
  await ready(s);
  /* the second person walks about: the world does not follow them; the first's hips do */
  const w0 = (await st(s)).worldIx;
  await b.walk(1, 0.3); await b.walk(1, 0.1); await s.pageWait(0.6);
  assert.equal((await st(s)).worldIx, w0);
  await b.walk(0, 0.3);
  await until(async () => (await st(s)).worldIx !== w0, 8000, 'the first person walking to slide the world');
  await b.armsUp(0, true); await s.stepIs('game', 12000); await b.armsDown(0); await ready(s);
  /* the second reaches into a card: nothing; the first does: it counts */
  await b.reachEl('.cccard', 0, { i: 1, side: 'l' });
  await s.pageWait(2);
  assert.equal(await s.step(), 'game', 'a second person touching a card does nothing');
  await b.release(1);
  await b.reachNear('.cccard', 1, { i: 0 });
  await until(async () => (await s.step()) === 'what', 14000, 'the builder touching a card');
  assert.equal((await st(s)).job, 'dodge');
  await b.release(0);
  noErrors(s);
  await s.ctx.close();
});

test('the server out of reach: the game is kept on this TV and plays; and when the server refuses, the name step comes back with its words', async () => {
  const quickly = async (s) => { await s.keys('Enter'); await s.stepIs('where'); await s.keys('Enter'); await s.stepIs('game'); await s.keys('Enter'); await s.stepIs('what'); await s.keys('Enter', 'Enter'); await s.keys('ArrowDown', 'ArrowDown', 'Enter'); await s.stepIs('rules'); await s.keys('Enter', 'Enter'); await s.stepIs('name'); };
  let s = await rig.open({ w: 1280, h: 720, profiles: ONE, down: true });
  await s.stepIs('start'); await quickly(s); await s.keys('Enter');
  await s.modeIs('play', 30000);
  assert.equal(await s.page.evaluate(() => JSON.parse(localStorage.getItem('orlis.creations:here') || '[]').length), 1, 'kept on this TV');
  assert.equal(await s.page.evaluate(() => JSON.parse(localStorage.getItem('orlis.creations:here'))[0].pending), true, 'waiting to go up');
  noErrors(s);
  await s.ctx.close();
  s = await rig.open({ w: 1280, h: 720, profiles: ONE });
  await s.stepIs('start');
  s.fake.store.creations.push(...[1, 2, 3].map(i => ({ id: 'srv-x' + i, name: 'X' + i, picks: { things: [{ id: 'apple', job: 'collect' }] } })));
  await quickly(s);
  await s.keys('Enter');
  await until(async () => /slots are full/i.test(await toastText(s)), 10000, 'the server\'s words');
  await s.stepIs('name');
  assert.equal(await s.mode(), 'create');
  await s.shot('save-refused');
  await s.keys('Escape'); await s.stepIs('rules');
  s.errors = s.errors.filter(e => !/status of 409/.test(e));         /* (the browser's own note of the refusal this test asked for) */
  noErrors(s);
  await s.ctx.close();
});
