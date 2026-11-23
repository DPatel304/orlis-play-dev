/* The home page as built (ui/home.js), in the little DOM: its three rows, focus and the backdrop that follows it, the hero shrinking to a banner,
   the big Play, what each tile opens, and the profile sheet behind the profile face. (Hand mode is hand.test.mjs and test/preview/hand-home.mjs.) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
resetDom();
const El = document.createElement('div').constructor;
El.prototype.getContext = () => null;
globalThis.requestAnimationFrame = () => 0;
/* the window's key listeners, kept so a test can press a key */
const keyHandlers = [];
globalThis.addEventListener = (type, fn, cap) => { if (type === 'keydown') keyHandlers.push(fn); };
globalThis.removeEventListener = (type, fn) => { const i = keyHandlers.indexOf(fn); if (i >= 0) keyHandlers.splice(i, 1); };
const press = (key) => { let stopped = false; const e = { key, preventDefault(){}, stopImmediatePropagation(){ stopped = true; }, target: null }; for (const fn of [...keyHandlers]){ fn(e); if (stopped) break; } };

const { menu, hooks } = await import('../src/ui/home.js');
const { account } = await import('../src/ui/account.js');
const { week } = await import('../src/ui/week.js');
const { appMode } = await import('../src/ui/mode.js');
hooks.world = (g) => `world:${g.id}`;
const txt = (el) => [el._text, ...el.children.map(txt)].join('');
const q = (root, sel) => root.querySelector(sel), qa = (root, sel) => root.querySelectorAll(sel);

function build(extra = {}){
  const ui = resetDom(); El.prototype.getContext = () => null;
  keyHandlers.length = 0;
  const calls = [];
  const nav = { home: () => calls.push('home'), store: () => calls.push('store'), create: () => calls.push('create'), requests: () => calls.push('requests'), pro: () => calls.push('pro') };
  const page = menu({ onPlay: (g) => calls.push('play:' + g.id), onRecalibrate(){}, onWho: () => calls.push('who'), nav, ...extra });
  return { ui, page, calls, s: q(ui, '.home') };
}
const hero = (s) => (q(s, '.htile.on').getAttribute('aria-label') || '').replace(/^\S+ /, '');   /* no title and no Play button: the lit tile names the game */
const layersOn = (s) => qa(s, '.hbg').filter(l => l.classList.contains('on')).map(l => l.style.backgroundImage);
const lit = (s) => qa(s, '.htile').filter(t => t.classList.contains('on')).map(t => txt(t.querySelector('.hname')));

test('one page, three rows: Your games, New to try, Make a game - and no tabs', () => {
  const { s, page } = build();
  assert.deepEqual(qa(s, '.hlab').map(txt), ['Your games', 'New to try', 'Make a game']);
  assert.ok(qa(s, '.tvtab').length === 0 && !q(s, '.tvtabs'), 'no tabs along the top');
  assert.ok(q(s, '.lg') && q(s, '.hme'), 'the logo top left, the profile face top right');
  const tiles = qa(s, '.htile');
  assert.ok(tiles.filter(t => t.classList.contains('game')).length >= 6, 'the games');
  assert.deepEqual(qa(s, '.htile.mk').map(t => txt(t.querySelector('.hname'))), ['More to try', 'Ask for a game', 'Your requests'], 'a grown-up sees Ask and Requests; Create Pro is for creators');
  page.leave();
});

test('at rest the first game is focused: its name, one line and the players as figures (no Play button); its world is the backdrop', () => {
  const { s, page } = build();
  assert.ok(s.classList.contains('rest') && !s.classList.contains('scrolled'));
  const first = page.items[0].item.g;
  assert.equal(hero(s), first.name);
  assert.deepEqual(lit(s), [first.name]);
  assert.ok(txt(q(s, '.hblurb')).length > 3, 'one line');
  assert.ok(!q(s, '.ht') && qa(s, '.chip').length === 0, 'no hero title and no chips');
  const pl = q(s, '.hplayers');
  assert.ok(pl && txt(pl) === '' && /^(\d player|\d to \d players|\d players)/.test(pl.getAttribute('aria-label')), 'players: figures by the description, no number');
  assert.ok(qa(pl, '.oicon').length >= 1 && qa(pl, '.oicon').length <= 4, 'one figure per player, up to 4');
  assert.ok(!/min|sec/.test(txt(q(s, '.hinfo'))), 'no time');
  assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Play ' + first.name);
  assert.ok(!q(s, '.hplay'), 'no Play button');
  assert.deepEqual(layersOn(s), [`url(world:${first.id})`], 'the focused game\'s world fills the screen');
  page.leave();
});

test('moving focus changes the title and crossfades the backdrop (the other layer takes the new world, the old one fades)', () => {
  const { s, page } = build();
  const before = qa(s, '.hbg').find(l => l.classList.contains('on'));
  page.focusAt({ row: 0, col: 3 });
  const g = page.items[3].item.g;
  assert.equal(hero(s), g.name);
  const after = qa(s, '.hbg').find(l => l.classList.contains('on'));
  assert.notEqual(after, before, 'the other layer');
  assert.equal(before.classList.contains('on'), false, 'the first fades out');
  assert.equal(after.style.backgroundImage, `url(world:${g.id})`);
  page.focusAt({ row: 0, col: 3 });
  assert.equal(qa(s, '.hbg').filter(l => l.classList.contains('on')).length, 1, 'never both');
  page.leave();
});

test('down moves to the next row and shrinks the hero to a banner; up grows it back; up from the first row stays put', () => {
  const { s, page } = build();
  page.focusAt({ row: 0, col: 0 });
  press('ArrowDown');
  assert.deepEqual(page.pos, { row: 1, col: 0 });
  assert.ok(s.classList.contains('scrolled') && !s.classList.contains('rest'), 'a banner');
  assert.equal(hero(s), 'More to try', 'the hero says what the focused tile is');
  press('ArrowDown');
  assert.deepEqual(page.pos, { row: 2, col: 0 });
  assert.equal(hero(s), 'Ask for a game');
  assert.ok(qa(s, '.hsec')[0].classList.contains('away'), 'the first row steps out of the way');
  press('ArrowUp'); press('ArrowUp');
  assert.ok(s.classList.contains('rest'), 'back to the big hero');
  assert.ok(!qa(s, '.hsec')[0].classList.contains('away'));
  press('ArrowUp');
  assert.deepEqual(page.pos, { row: 0, col: 0 }, 'nowhere above the first row');
  page.leave();
});

test('what each tile opens: a game plays; More to try, Ask for a game and Your requests go to their pages; a game goes through the launch', async () => {
  const { s, page, calls } = build();
  const tile = (name) => qa(s, '.htile').find(t => txt(t.querySelector('.hname')) === name);
  tile('More to try').dispatchEvent(new CustomEvent('pick'));
  tile('Ask for a game').dispatchEvent(new CustomEvent('pick'));
  tile('Your requests').dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, ['store', 'create', 'requests']);
  page.focusAt({ row: 0, col: 0 });
  qa(s, '.htile')[0].dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, ['store', 'create', 'requests'], 'a game goes through the launch (its tile opening up), not at once');
  page.leave();
});

test('Create Pro is for creators; a child sees no Make a game row; the Creator app has only Create Pro', () => {
  const was = account.state;
  try {
    account.state = { token: 't', account: { id: 'a', role: 'creator' }, profiles: [{ id: 'p1', accountId: 'a', name: 'Dad' }], current: 'p1' };
    const a = build();
    assert.ok(qa(a.s, '.htile.mk').some(t => /Create Pro/.test(txt(t))), 'a creator');
    assert.ok(qa(a.s, '.gu').some(t => txt(t) === 'Grown-ups'), 'tagged for grown-ups');
    a.page.leave();
    account.state = { token: 't', account: { id: 'a', role: 'creator' }, profiles: [{ id: 'p1', accountId: 'a', name: 'Dad' }, { id: 'p2', accountId: 'a', name: 'Kid' }], current: 'p2' };
    const k = build();
    assert.ok(!qa(k.s, '.hlab').some(l => txt(l) === 'Make a game'), 'a child');
    k.page.leave();
  } finally { account.state = was; }
});

test('New to try has the games to get, with Get on each tile; a download shows its progress on the tile', () => {
  const was = week.store;
  try {
    week.store = { featured: ['s1'], games: [{ id: 's1', name: 'Comet Catch', version: '1.0', blurb: 'Catch comets', icon: { cols: ['#111111', '#222222'] } }, { id: 's2', name: 'Bubble Dash', version: '1.0', blurb: 'Dash', icon: { cols: ['#111111', '#222222'] } }] };
    const { s, page } = build();
    const gets = qa(s, '.htile.get');
    assert.deepEqual(gets.map(t => txt(t.querySelector('.hname'))), ['Comet Catch', 'Bubble Dash']);
    assert.ok(gets.every(t => q(t, '.getpill') && q(t, '.gotbar')), 'a Get pill and a progress bar on each');
    page.focusAt({ row: 1, col: 0 });
    assert.equal(hero(s), 'Comet Catch');
    assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Get Comet Catch');
    page.leave();
  } finally { week.store = was; }
});

test('the profile face opens the sheet: who is playing and their family, then Profile, Settings and Sign out', () => {
  const was = account.state;
  try {
    account.state = { token: 't', account: { id: 'a', email: 'grown-up@family.example', role: 'owner' }, household: { name: 'The Parkers' }, profiles: [{ id: 'p1', accountId: 'a', name: 'Mia' }], current: 'p1' };
    const { ui, s, page } = build();
    q(s, '.hme').dispatchEvent(new CustomEvent('pick'));
    const sheet = q(ui, '.hsheetwrap');
    assert.ok(sheet && sheet.classList.contains('dim'), 'a sheet over Home');
    assert.equal(txt(q(sheet, '.hswords')), 'MiaThe Parkers', 'their name, then the family');
    assert.deepEqual(qa(sheet, '.sheetitem').map(b => (/<span>([^<]*)<\/span>/.exec(b.innerHTML) || [])[1]), ['Profile', 'Settings', 'Sign out']);
    assert.ok(txt(q(sheet, '.hsfoot')).includes('grown-up@family.example'));
    page.leave();
  } finally { account.state = was; }
});

test('Home without games to show still says where to start; the Creator app has no Play', () => {
  assert.ok(appMode.tabs().includes('home'));
  assert.ok(menu.length <= 1);
});
