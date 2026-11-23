/* The home page as built (ui/home.js), in the little DOM: Featured and Your games, the Play and Create tabs and the remote's way to them, focus and
   the backdrop that follows it, the hero shrinking to a banner, what each tile opens, the Discover page, and the profile sheet behind the profile face. */
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

const { menu, discoverPage, hooks } = await import('../src/ui/home.js');
const { account } = await import('../src/ui/account.js');
const { week } = await import('../src/ui/week.js');
const { appMode } = await import('../src/ui/mode.js');
const { library } = await import('../src/ui/library.js');
const { remote } = await import('../src/ui/remote.js');
hooks.world = (g) => `world:${g.id}`;
const txt = (el) => [el._text, ...el.children.map(txt)].join('');
const q = (root, sel) => root.querySelector(sel), qa = (root, sel) => root.querySelectorAll(sel);

function build(extra = {}){
  const ui = resetDom(); El.prototype.getContext = () => null;
  keyHandlers.length = 0;
  const calls = [];
  const nav = { home: () => calls.push('home'), store: () => calls.push('store'), create: () => calls.push('create'), requests: () => calls.push('requests'), pro: () => calls.push('pro') };
  const page = (extra.discover ? discoverPage : menu)({ onPlay: (g) => calls.push('play:' + g.id), onRecalibrate(){}, onWho: () => calls.push('who'), nav, ...extra });
  return { ui, page, calls, s: q(ui, '.home') };
}
const hero = (s) => (q(s, '.htile.on').getAttribute('aria-label') || '').replace(/^\S+ /, '');   /* no title and no Play button: the lit tile names the game */
const layersOn = (s) => qa(s, '.hbg').filter(l => l.classList.contains('on')).map(l => l.style.backgroundImage);
const lit = (s) => qa(s, '.htile').filter(t => t.classList.contains('on')).map(t => txt(t.querySelector('.hname')));

/* a week of featured games, to put on the page (and the library as it was) */
const SAMPLE = [
  { id: 's1', name: 'Comet Catch', version: '1.0', blurb: 'Catch comets', icon: { cols: ['#111111', '#222222'] } },
  { id: 's2', name: 'Bubble Dash', version: '1.0', blurb: 'Dash', icon: { cols: ['#111111', '#222222'] } },
  { id: 's3', name: 'Moon Hop', version: '1.0', blurb: 'Hop', icon: { cols: ['#111111', '#222222'] } },
  { id: 's4', name: 'Star Sweep', version: '1.0', blurb: 'Sweep', icon: { cols: ['#111111', '#222222'], }, tags: ['Calm'] }
];
const withWeek = (store, fn) => { const was = week.store; week.store = store; try { return fn(); } finally { week.store = was; } };
const withKid = (fn) => {
  const was = account.state;
  account.state = { token: 't', account: { id: 'a', role: 'creator' }, profiles: [{ id: 'p1', accountId: 'a', name: 'Dad' }, { id: 'p2', accountId: 'a', name: 'Kid' }], current: 'p2' };
  try { return fn(); } finally { account.state = was; }
};
const label = (t) => txt(t.querySelector('.hname'));

test('Play: two rows, Featured and Your games, both labelled; the logo with the Play and Create tabs; no New to try or Make a game', () => {
  const { s, page } = build();
  assert.deepEqual(qa(s, '.hlab').map(txt), ['Featured', 'Your games']);
  assert.ok(q(s, '.lg') && q(s, '.hme'), 'the logo top left, the profile face top right');
  assert.deepEqual(qa(s, '.ptab').map(t => t.getAttribute('aria-label')), ['Play', 'Create'], 'the tabs beside the logo');
  assert.equal(q(s, '.ptab.cur').getAttribute('aria-label'), 'Play', 'Play is the current tab');
  assert.ok(qa(s, '.htile.game').length >= 6, 'the games');
  assert.deepEqual(qa(s, '.htile.get').map(label), [], 'nothing featured here (no server): the row is just the Discover tile');
  assert.deepEqual(qa(s, '.htile.disc').map(label), ['Discover']);
  assert.ok(qa(s, '.htile.mk').length === 0, 'no Make a game tiles');
  page.leave();
});

test('Featured: this week\'s three featured games not on this PC yet, then Discover; the games already here are left out', () => {
  withWeek({ featured: ['s1', 's2', 's3', 's4'], games: SAMPLE }, () => {
    library.installed.set('s2', '1.0');
    try {
      const { s, page } = build();
      assert.deepEqual(qa(s, '.htile.get').map(label), ['Comet Catch', 'Moon Hop', 'Star Sweep'], 'three, without the one already here');
      assert.deepEqual(page.rows[0].items.map(i => i.kind), ['get', 'get', 'get', 'discover']);
      assert.ok(qa(s, '.htile.get').every(t => q(t, '.getpill') && q(t, '.gotbar')), 'a Get pill and a progress bar on each');
      assert.ok(q(s, '.htile.disc'), 'the Discover tile');
      page.leave();
    } finally { library.installed.delete('s2'); }
  });
});

test('at rest the first of Your games is focused: its one line and the players as figures (no Play button); its world is the backdrop; only its row shows', () => {
  const { s, page } = build();
  assert.ok(s.classList.contains('rest') && !s.classList.contains('scrolled'));
  assert.deepEqual(page.pos, { row: 1, col: 0 });
  const first = page.rows[1].items[0].g;
  assert.equal(hero(s), first.name);
  assert.deepEqual(lit(s), [first.name]);
  assert.ok(txt(q(s, '.hblurb')).length > 3, 'one line');
  const pl = q(s, '.hhow.hh-players');
  assert.ok(pl && /^(\d player|\d to \d players|\d players)/.test(pl.getAttribute('aria-label')), 'players: the people icon and the number, on the how-you-play row');
  assert.ok(!/min|sec/.test(txt(q(s, '.hinfo'))), 'no time');
  assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Play ' + first.name);
  assert.ok(!q(s, '.hplay'), 'no Play button');
  assert.deepEqual(layersOn(s), [`url(world:${first.id})`], 'the focused game\'s world fills the screen');
  const secs = qa(s, '.hsec');
  assert.ok(secs[0].classList.contains('away') && !secs[1].classList.contains('away'), 'Featured steps out of the way, Your games shows');
  page.leave();
});

test('moving focus changes the hero and crossfades the backdrop (the other layer takes the new world, the old one fades)', () => {
  const { s, page } = build();
  const before = qa(s, '.hbg').find(l => l.classList.contains('on'));
  page.focusAt({ row: 1, col: 3 });
  const g = page.rows[1].items[3].g;
  assert.equal(hero(s), g.name);
  const after = qa(s, '.hbg').find(l => l.classList.contains('on'));
  assert.notEqual(after, before, 'the other layer');
  assert.equal(before.classList.contains('on'), false, 'the first fades out');
  assert.equal(after.style.backgroundImage, `url(world:${g.id})`);
  page.focusAt({ row: 1, col: 3 });
  assert.equal(qa(s, '.hbg').filter(l => l.classList.contains('on')).length, 1, 'never both');
  page.leave();
});

test('up from Your games shows Featured (the hero still big); a featured game is in the hero with Get; down goes back', () => {
  withWeek({ featured: ['s1'], games: SAMPLE.slice(0, 1) }, () => {
    const { s, page } = build();
    page.focusAt({ row: 1, col: 0 });
    assert.deepEqual(page.pos, { row: 1, col: 0 });
    press('ArrowUp');
    assert.deepEqual(page.pos, { row: 0, col: 0 });
    assert.ok(s.classList.contains('rest') && !s.classList.contains('scrolled'), 'still the big hero');
    assert.ok(!qa(s, '.hsec')[0].classList.contains('away') && qa(s, '.hsec')[1].classList.contains('away'), 'Featured shows now');
    assert.equal(hero(s), 'Comet Catch');
    assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Get Comet Catch');
    assert.equal(txt(q(s, '.hblurb')), 'Catch comets');
    assert.deepEqual(layersOn(s).length, 1);
    press('ArrowRight');   /* (the remote's nearest-tile move is remote.js's; the page's own keys leave it alone) */
    assert.deepEqual(page.pos, { row: 0, col: 0 });
    page.focusAt({ row: 0, col: 1 });
    assert.equal(hero(s), 'Discover', 'the Discover tile: its name in the hero');
    assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Open Discover');
    assert.equal(txt(q(s, '.hblurb')), 'Every game your family can get');
    press('ArrowDown');
    assert.deepEqual(page.pos, { row: 1, col: 0 });
    page.leave();
  });
});

test('a row below the two big ones (Testing) shrinks the hero to a banner', () => {
  const was = week.drafts;
  week.drafts = [{ id: 'd1', name: 'Draft', version: '1', sha256: 'x' }];
  try {
    const { s, page } = build();
    press('ArrowDown');
    assert.deepEqual(page.pos, { row: 2, col: 0 });
    assert.ok(s.classList.contains('scrolled') && !s.classList.contains('rest'), 'a banner');
    assert.ok(qa(s, '.hsec')[0].classList.contains('away'), 'Featured is out of the way');
    press('ArrowUp');
    assert.ok(s.classList.contains('rest'), 'back to the big hero');
    page.leave();
  } finally { week.drafts = was; }
});

test('the tabs by remote: Up from the first row reaches them (Play lit), Left and Right move between them, Down goes back into the page', () => {
  const { s, page } = build();
  const [play, create] = page.tabs;
  assert.equal(page.tabs.length, 2);
  page.focusAt({ row: 0, col: 0 });
  press('ArrowUp');
  assert.equal(remote.cur, play, 'the current tab is focused');
  assert.ok(play.classList.contains('kfocus'));
  assert.ok(qa(s, '.htile.on').length === 0, 'no tile is lit while the tabs are');
  press('ArrowRight');
  assert.equal(remote.cur, create); assert.ok(create.classList.contains('kfocus') && !play.classList.contains('kfocus'));
  assert.ok(play.classList.contains('cur'), 'moving onto Create does not switch yet (OK does)');
  press('ArrowLeft');
  assert.equal(remote.cur, play);
  press('ArrowLeft');
  assert.equal(remote.cur, play, 'nowhere left of Play');
  press('ArrowUp');
  assert.equal(remote.cur, play, 'nothing above');
  press('ArrowDown');
  assert.deepEqual(page.pos, { row: 0, col: 0 });
  assert.equal(qa(s, '.htile.on').length, 1, 'the tile is lit again');
  assert.equal(remote.cur, q(s, '.htile.on'));
  page.leave();
});

test('picking Create (OK or a click) goes to Create; picking Play, the tab you are on, stays', () => {
  const { page, calls } = build();
  page.tabs[0].dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, [], 'Play is where we are');
  page.tabs[1].dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, ['create']);
  page.leave();
});

test('a child sees no tabs bar at all, just the logo; the Creator app has none either', () => {
  withKid(() => {
    const { s, page } = build();
    assert.equal(qa(s, '.ptab').length, 0); assert.ok(!q(s, '.ptabs'));
    assert.ok(q(s, '.lg'), 'the logo stays');
    assert.deepEqual(page.tabs, []);
    press('ArrowUp'); press('ArrowUp'); press('ArrowUp');
    assert.ok(!remote.cur || !remote.cur.classList.contains('ptab'), 'Up from the first row goes nowhere');
    assert.equal(page.pos.row, 0);
    page.leave();
  });
  const was = appMode.get;
  appMode.get = () => 'creator';
  try { const { s, page } = build(); assert.equal(qa(s, '.ptab').length, 0); page.leave(); } finally { appMode.get = was; }
});

test('what each tile opens: the Discover tile goes to Discover; a game goes through the launch', () => {
  const { s, page, calls } = build();
  qa(s, '.htile.disc')[0].dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, ['store']);
  page.focusAt({ row: 1, col: 0 });
  qa(s, '.htile.game')[0].dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, ['store'], 'a game goes through the launch (its tile opening up), not at once');
  page.leave();
});

test('Discover is its own page: the Home button where the logo sits (no tabs, no profile face), rows by category, a Get on every tile', () => {
  withWeek({ featured: ['s1'], games: SAMPLE }, () => {
    const { s, page, calls } = build({ discover: true });
    assert.ok(s.classList.contains('discover'));
    assert.ok(q(s, '.homebtn') && !q(s, '.ptab') && !q(s, '.lg') && !q(s, '.hme'), 'Home button, no tabs');
    q(s, '.homebtn').dispatchEvent(new CustomEvent('pick'));
    assert.deepEqual(calls, ['home']);
    assert.ok(qa(s, '.hlab').length >= 1);
    const tiles = qa(s, '.htile');
    assert.deepEqual(tiles.map(label).sort(), SAMPLE.map(x => x.name).sort().filter(n => tiles.map(label).includes(n)));
    assert.ok(tiles.length >= 4 && tiles.every(t => t.classList.contains('get') && q(t, '.getpill') && q(t, '.gotbar')), 'every game: Get, with progress');
    assert.equal(q(s, '.htile.on').getAttribute('aria-label').split(' ')[0], 'Get');
    assert.ok(txt(q(s, '.hblurb')).length > 2, 'the focused game\'s description');
    press('ArrowDown'); press('ArrowUp');
    assert.ok(page.pos.row === 0);
    page.leave();
  });
});

test('Discover: games already here are not listed (an update to one is, under Updates); with nothing to get it says so', () => {
  library.installed.set('s1', '1.0'); library.installed.set('s2', '0.9');
  try {
    withWeek({ featured: [], games: SAMPLE }, () => {
      const { s, page } = build({ discover: true });
      assert.deepEqual(qa(s, '.hlab').map(txt)[0], 'Updates');
      assert.deepEqual(qa(s, '.getpill').filter(p => /Update/.test(txt(p))).length, 1, 'Bubble Dash has a newer version');
      assert.ok(!qa(s, '.htile').map(label).includes('Comet Catch'), 'on this PC already');
      page.leave();
    });
    withWeek({ featured: [], games: SAMPLE.slice(0, 2) }, () => {
      library.installed.set('s2', '1.0');
      const { s, page } = build({ discover: true });
      assert.equal(qa(s, '.htile').length, 0);
      assert.match(txt(q(s, '.hblurb')), /every game|Sign in|Nothing in Discover|Loading/);
      assert.ok(q(s, '.homebtn'), 'still a way home');
      page.leave();
    });
  } finally { library.installed.delete('s1'); library.installed.delete('s2'); }
});

test('Create Pro and Create are the Create tab\'s; a Create-less profile sees nothing about them on Play', () => {
  withKid(() => {
    const { s, page } = build();
    assert.ok(!qa(s, '.hlab').some(l => ['Make a game', 'New to try'].includes(txt(l))));
    page.leave();
  });
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

test('the Create page\'s top bar: the logo and the tabs with Create lit (Play goes home); without tabs, the Home button', async () => {
  const { topBar } = await import('../src/ui/tabs.js');
  const calls = [];
  const nav = { home: () => calls.push('home'), create: () => calls.push('create') };
  const bar = topBar('create', nav, { tabs: ['play', 'create'] });
  assert.equal(qa(bar.el, '.ptab').length, 2);
  assert.equal(q(bar.el, '.ptab.cur').getAttribute('aria-label'), 'Create');
  assert.ok(!q(bar.el, '.hbrand.light'), 'on paper');
  qa(bar.el, '.ptab')[0].dispatchEvent(new CustomEvent('pick')); qa(bar.el, '.ptab')[1].dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual(calls, ['home'], 'Play goes home; Create is where we are');
  const plain = topBar('create', nav, { tabs: [] });
  assert.ok(q(plain.el, '.homebtn') && !q(plain.el, '.ptab'));
});
