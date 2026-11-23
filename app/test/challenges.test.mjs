/* Weekly challenges (decision 0051): the cards come up by themselves only in a new week; the pill glows when there is news; blocks are
   capped at ten; the week's dots; the results screen's progress line and stamped star (instead of a toast). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resetDom } from './harness/browser.mjs';
resetDom();
const El = document.createElement('div').constructor;
El.prototype.getContext = () => null;
globalThis.requestAnimationFrame = () => 0;

const kit = await import('../src/ui/chkit.js');
const { challengePill, showChallenges } = await import('../src/ui/challenges.js');
const { results } = await import('../src/ui/screens.js');
const { moveEl, showNews, deliverRoundNews } = await import('../src/ui/chnews.js');
const { movesOf } = await import('../src/ui/week.js');
const { sfx } = await import('../src/audio/sound.js');
const txt = (el) => [el._text, ...el.children.map(txt)].join('');

const mk = (week, list) => ({ week, ends: '2026-12-01T00:00:00.000Z', stars: 2, challenges: list });
const A = { id: 'rounds-pop-party', kind: 'rounds', title: 'Play 5 rounds of Pop Party', need: 5, have: 2 };
const B = { id: 'different', kind: 'different', title: 'Play 4 different games', need: 4, have: 1 };
const W1 = mk('2026-11-23', [A, B]), W2 = mk('2026-11-30', [A, B]);
const fresh = () => { resetDom(); El.prototype.getContext = () => null; kit.forgetMemory(); globalThis.location = { protocol: 'http:', href: 'http://localhost/', search: '' }; };

test('the splash: only the first time in a new challenge week, then never; ?splash=0 never', () => {
  fresh();
  assert.equal(kit.splashWanted(W1), true, 'first time ever');
  kit.markSplash(W1);
  assert.equal(kit.splashWanted(W1), false, 'same week again: no');
  assert.equal(kit.splashWanted({ ...W1, challenges: [{ ...A, have: 4 }, B] }), false, 'progress does not make it come back');
  assert.equal(kit.splashWanted(W2), true, 'a new week: yes');
  kit.markSplash(W2);
  assert.equal(kit.splashWanted(W2), false);
  assert.equal(kit.splashWanted(null), false);
  fresh(); globalThis.location.search = '?splash=0';
  assert.equal(kit.splashWanted(W1), false, 'rehearsals');
  fresh();
});

test('the splash is still once a week when storage is closed', () => {
  fresh();
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem(){ throw new Error('closed'); }, setItem(){ throw new Error('closed'); } };
  try {
    assert.equal(kit.splashWanted(W1), true);
    kit.markSplash(W1);
    assert.equal(kit.splashWanted(W1), false, 'remembered for the run');
  } finally { globalThis.localStorage = was; kit.forgetMemory(); }
});

test('the glow: a new week not opened, or a challenge finished since; opening clears it', () => {
  fresh();
  assert.equal(kit.hasNews(W1), true, 'a new week, not opened yet');
  assert.ok(challengePill(W1).classList.contains('news'), 'the pill glows');
  kit.markOpened(W1);
  assert.equal(kit.hasNews(W1), false, 'opened: quiet');
  assert.ok(!challengePill(W1).classList.contains('news'));
  const finished = mk('2026-11-23', [{ ...A, have: 5, done: true }, B]);
  assert.equal(kit.hasNews(finished), true, 'one finished since: glow');
  kit.markOpened(finished);
  assert.equal(kit.hasNews(finished), false);
  assert.equal(kit.hasNews(W2), true, 'the next Monday: glow again');
  assert.equal(kit.hasNews(mk('x', [])), false, 'nothing to say, no glow');
});

test('opening the cards clears the glow on the pill and remembers it; an arrival splash is remembered too', () => {
  fresh();
  const pill = challengePill(W1); document.body.appendChild(pill);
  assert.ok(pill.classList.contains('news'));
  const shown = showChallenges(W1, { auto: false, from: pill });
  assert.ok(shown && shown.layer, 'the cards came up');
  assert.ok(!pill.classList.contains('news'), 'glow cleared');
  assert.equal(kit.hasNews(W1), false);
  shown.close();
  fresh();
  showChallenges(W2, { auto: true, first: true }).close();
  assert.equal(kit.splashWanted(W2), false, 'the arrival splash counts');
});

test('blocks: one per step, at most ten; bigger targets group', () => {
  for (const need of [1, 3, 5, 10]) assert.deepEqual([kit.blocksFor(need).n, kit.blocksFor(need).per], [need, 1]);
  assert.deepEqual([kit.blocksFor(30).n, kit.blocksFor(30).per], [10, 3], '30 minutes = 10 blocks of 3');
  assert.deepEqual([kit.blocksFor(11).n, kit.blocksFor(11).per], [6, 2]);
  for (let need = 1; need <= 400; need++) assert.ok(kit.blocksFor(need).n <= 10 && kit.blocksFor(need).n >= 1, `need ${need}`);
  assert.deepEqual(kit.litBlocks(12, 30), { full: 4, part: false });
  assert.deepEqual(kit.litBlocks(13, 30), { full: 4, part: true });
  assert.deepEqual(kit.litBlocks(30, 30), { full: 10, part: false });
  assert.deepEqual(kit.litBlocks(0, 30), { full: 0, part: false });
  const el = kit.blocksEl(30); kit.setBlocks(el, 12, 30);
  assert.equal(el.children.length, 10);
  assert.equal(el.children.filter(b => b.className === 'on').length, 4);
});

test('the week: seven dots, past days filled, today marked, and how many days are left', () => {
  const mon = kit.weekDays(W1, new Date(2026, 10, 23, 12)), thu = kit.weekDays(W1, new Date(2026, 10, 26, 9)), sun = kit.weekDays(W1, new Date(2026, 10, 29, 20));
  assert.deepEqual([mon.today, mon.left], [0, 7]);
  assert.deepEqual(thu.days.map(d => d.state), ['past', 'past', 'past', 'today', 'next', 'next', 'next']);
  assert.equal(thu.left, 4);
  assert.equal(sun.left, 1);
  assert.equal(kit.leftText(1), '1 day left'); assert.equal(kit.leftText(4), '4 days left');
  const el = kit.weekEl(W1, new Date(2026, 10, 26)); assert.equal(el.querySelectorAll('.chday').length, 7);
  assert.equal(el.querySelectorAll('.today').length, 1);
});

test('week.played says what a round moved: progress, and what it finished', () => {
  const was = new Map([[A.id, { ...A, have: 2 }], [B.id, { ...B, have: 3, need: 4 }]]);
  const now = [{ ...A, have: 3 }, { ...B, have: 4, done: true }];
  const m = movesOf(was, now);
  assert.deepEqual(m.map(x => [x.id, x.before, x.after, x.finished, x.slot]), [[A.id, 2, 3, false, 0], ['different', 3, 4, true, 1]]);
  assert.deepEqual(movesOf(was, [{ ...A, have: 2 }, { ...B, have: 3 }]), [], 'nothing moved');
  assert.deepEqual(movesOf(new Map([[A.id, { ...A, have: 5, done: true }]]), [{ ...A, have: 5, done: true }]), [], 'already done: not news');
});

test('the results screen: a progress line when a round moved a challenge, a stamped star when it finished one', () => {
  fresh();
  const stars = []; const was = sfx.sparkles; sfx.sparkles = () => stars.push(1);
  try {
    const ui = document.getElementById('ui');
    const game = { id: 'pop-party', name: 'Pop Party', accent: '#6d5efc' };
    const scr = results(game, () => {}, () => {}, 'Home', null, { total: 12, kids: [] });
    assert.equal(typeof scr.news, 'function');
    const host = ui.querySelector('.chnews'); assert.ok(host, 'a place for it');
    assert.equal(host.children.length, 0, 'nothing until the server has answered');
    const row = ui.querySelector('.btnrow'); assert.ok(row, 'Play again / Home are there');
    scr.news([{ id: A.id, kind: 'rounds', title: A.title, need: 5, before: 2, after: 3, finished: false, slot: 0 }]);
    assert.equal(host.querySelectorAll('.chmove').length, 1);
    assert.ok(txt(host.querySelector('.chmove')).includes(A.title), 'its title');
    assert.equal(host.querySelectorAll('.chstamp').length, 0, 'no star: not finished');
    assert.equal(host.querySelector('.chblocks').children.length, 5, 'blocks');
    scr.news([{ id: 'different', kind: 'different', title: B.title, need: 4, before: 3, after: 4, finished: true, slot: 1 }]);
    assert.equal(host.querySelectorAll('.chmove').length, 1, 'replaced, not piled up');
    assert.ok(host.querySelector('.chmove').classList.contains('finished'));
    assert.equal(host.querySelectorAll('.chstamp').length, 1, 'the star');
    scr.leave();
  } finally { sfx.sparkles = was; }
});

test('a finished challenge stamps its star and plays the sparkles; a moved one does not', async () => {
  fresh();
  const calls = []; const was = sfx.sparkles; sfx.sparkles = () => calls.push('sparkles');
  try {
    const host = document.createElement('div');
    const stop = showNews(host, [{ id: 'x', kind: 'minutes', title: 'Move', need: 30, before: 12, after: 15, finished: false, slot: 2 }]);
    await new Promise(r => setTimeout(r, 1500));
    assert.deepEqual(calls, []);
    stop();
    const host2 = document.createElement('div');
    const stop2 = showNews(host2, [{ id: 'y', kind: 'minutes', title: 'Move', need: 30, before: 29, after: 30, finished: true, slot: 2 }]);
    await new Promise(r => setTimeout(r, 1500));
    assert.deepEqual(calls, ['sparkles']);
    assert.ok(host2.querySelector('.chstamp').classList.contains('on'));
    stop2();
  } finally { sfx.sparkles = was; }
});

test('the round news lands only if the results screen is still up (a fake week.played)', async () => {
  const got = [];
  const scene = { news: (m) => got.push(m) };
  const moves = [{ id: 'a', before: 0, after: 1, need: 3, title: 't', kind: 'rounds', finished: false }];
  await deliverRoundNews(Promise.resolve(moves), () => scene);
  assert.equal(got.length, 1, 'delivered');
  await deliverRoundNews(Promise.resolve(moves), () => null);
  assert.equal(got.length, 1, 'the player has moved on: dropped');
  await deliverRoundNews(Promise.resolve([]), () => scene);
  assert.equal(got.length, 1, 'nothing moved: nothing shown');
  await deliverRoundNews(Promise.reject(new Error('offline')), () => scene);
  assert.equal(got.length, 1, 'the server failed: quiet');
});

test('no "Star earned" toast any more: the results screen says it', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!/Star earned/.test(main), 'the toast is gone from main.js');
  assert.ok(/deliverRoundNews/.test(main), 'the results screen gets it instead');
});
