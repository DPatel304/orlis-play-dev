/* The home page as built (ui/home.js), in the little DOM: Featured and My library, the Play and Create tabs and the remote's way to them, focus and
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
  const kept = localStorage.getItem('orlis.lastGame');   /* (resetDom clears the storage; the game last played stays, as it would between visits) */
  const ui = resetDom(); El.prototype.getContext = () => null;
  if (kept != null) localStorage.setItem('orlis.lastGame', kept);
  keyHandlers.length = 0;
  const calls = [];
  const nav = { home: () => calls.push('home'), store: () => calls.push('store'), create: () => calls.push('create'), pro: () => calls.push('pro') };
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

test('Play: two rows, Featured and My library, both labelled; the logo with the Play and Create tabs; no New to try or Make a game', () => {
  const { s, page } = build();
  assert.deepEqual(qa(s, '.hlab').map(txt), ['Featured', 'My library']);
  assert.ok(q(s, '.lg') && q(s, '.hme'), 'the logo top left, the profile face top right');
  assert.deepEqual(qa(s, '.ptab').map(t => t.getAttribute('aria-label')), ['Play', 'Create'], 'the tabs beside the logo');
  assert.equal(q(s, '.ptab.cur').getAttribute('aria-label'), 'Play', 'Play is the current tab');
  assert.ok(qa(s, '.htile.game').length >= 6, 'the games');
  assert.deepEqual(qa(s, '.htile.get').map(label), [], 'nothing featured here (no server): the row is just the Discover tile');
  assert.deepEqual(qa(s, '.htile.disc').map(label), ['Discover']);
  assert.ok(qa(s, '.htile.mk').length === 0, 'no Make a game tiles');
  page.leave();
});

/* what the server sends for Featured (decision 0058): [slot 1, 2, 3], each { id, name, builtIn, rotating, ...the Store entry } */
const slot = (n, id, more = {}) => { const e = SAMPLE.find(x => x.id === id); return { slot: n, id, name: e ? e.name : id, builtIn: !e, rotating: false, ...(e || {}), ...more }; };
const withLast = (id, fn) => {
  const was = (() => { try { return localStorage.getItem('orlis.lastGame'); } catch { return null; } })();
  if (id) localStorage.setItem('orlis.lastGame', id); else localStorage.removeItem('orlis.lastGame');
  try { return fn(); } finally { was == null ? localStorage.removeItem('orlis.lastGame') : localStorage.setItem('orlis.lastGame', was); }
};

test('Featured (0058): Play again (the game last played), then the owner\'s slots 1 to 3, then Discover; a built-in game plays, a Store game not here is a Get, an empty slot rotates', () => {
  withLast('pop-party', () => withWeek({ games: SAMPLE, featuredSlots: [slot(1, 'sleepy-bear'), slot(2, 's1'), slot(3, 's3', { rotating: true })] }, () => {
    const { s, page } = build();
    const row = page.rows[0];
    assert.equal(row.title, 'Featured');
    assert.deepEqual(row.items.map(i => i.kind), ['game', 'game', 'get', 'get', 'discover']);
    assert.deepEqual(row.items.map(i => i.g ? i.g.id : 'discover'), ['pop-party', 'sleepy-bear', 's1', 's3', 'discover'], 'last played, slot 1, slot 2, slot 3 (rotating), Discover');
    assert.deepEqual(row.items.map(i => !!i.again), [true, false, false, false, false]);
    const tiles = qa(s, '.hrow')[0].children;
    assert.ok(q(tiles[0], '.getpill.again') && /Play again/.test(txt(q(tiles[0], '.getpill'))), 'a "Play again" pill on the thumbnail');
    assert.ok(tiles[0].classList.contains('again') && tiles[0].classList.contains('game'));
    assert.equal(tiles[0].getAttribute('aria-label'), 'Play again Pop Party');
    assert.ok(!q(tiles[1], '.getpill'), 'a game on this PC (a built-in one too) is a normal tile that plays');
    assert.equal(tiles[1].getAttribute('aria-label'), 'Play Sleepy Bear');
    assert.ok(q(tiles[2], '.getpill') && !q(tiles[2], '.again') && q(tiles[2], '.gotbar'), 'a game not on this PC: Get, with its progress bar');
    assert.equal(tiles[2].getAttribute('aria-label'), 'Get Comet Catch');
    assert.equal(tiles[3].getAttribute('aria-label'), 'Get Moon Hop', 'a slot left empty holds the rotation\'s game');
    assert.equal(qa(s, '.htile.again').length, 1, 'one Play again tile');
    assert.deepEqual(page.pos, { row: 0, col: 0 }, 'Home opens on the first Featured tile');
    page.leave();
  }));
});

test('Featured: no Play again tile when nothing was played, when the game is already in a slot, or when it is no longer on this PC; a game is never twice', () => {
  const slots = [slot(1, 'sleepy-bear'), slot(2, 's1'), slot(3, 's2')];
  withWeek({ games: SAMPLE, featuredSlots: slots }, () => {
    withLast(null, () => {
      const { page } = build();
      assert.deepEqual(page.rows[0].items.map(i => i.g ? i.g.id : 'discover'), ['sleepy-bear', 's1', 's2', 'discover'], 'nothing played yet: the slots and Discover');
      page.leave();
    });
    withLast('sleepy-bear', () => {
      const { page } = build();
      assert.deepEqual(page.rows[0].items.map(i => i.g ? i.g.id : 'discover'), ['sleepy-bear', 's1', 's2', 'discover'], 'played last, and in slot 1: only the slot');
      assert.ok(page.rows[0].items.every(i => !i.again));
      page.leave();
    });
    withLast('gone-game', () => {
      const { page } = build();
      assert.ok(page.rows[0].items.every(i => !i.again), 'not on this PC any more');
      page.leave();
    });
  });
});

test('Featured: a Store game in a slot that is on this PC is a normal tile that plays; no server: Play again and Discover; an older server (only a list of ids): those fill the slots', async () => {
  withLast('leaf-pile', () => {
    const { page: none } = build();
    assert.deepEqual(none.rows[0].items.map(i => i.kind), ['game', 'discover'], 'no server: the last game played, then Discover');
    none.leave();
  });
  /* a game downloaded from the Store is in the library (and on Home's list of games): in a slot it is a normal tile */
  const { GAMES } = await import('../src/games/index.js');
  const mine = { ...GAMES.find(x => x.id === 'leaf-pile'), id: 's4', name: 'Star Sweep', store: { version: '1.0', blurb: 'Sweep', icon: SAMPLE[3].icon } };
  GAMES.unshift(mine); library.installed.set('s4', '1.0');
  try {
    withLast(null, () => withWeek({ games: SAMPLE, featuredSlots: [slot(1, 's4'), slot(2, 's1'), slot(3, 's2')] }, () => {
      const { page } = build();
      assert.deepEqual(page.rows[0].items.map(i => i.kind), ['game', 'get', 'get', 'discover'], 'Star Sweep is here: it plays; the others are Gets');
      assert.equal(page.rows[0].items[0].g, mine);
      page.leave();
    }));
  } finally { GAMES.splice(GAMES.indexOf(mine), 1); library.installed.delete('s4'); }
  withLast(null, () => withWeek({ featured: ['s1', 's2', 's3', 's4'], games: SAMPLE }, () => {
    const { s, page } = build();
    assert.deepEqual(qa(s, '.htile.get').map(label), ['Comet Catch', 'Bubble Dash', 'Moon Hop'], 'an older server: its three Discover ids, as Get tiles');
    assert.deepEqual(page.rows[0].items.map(i => i.kind), ['get', 'get', 'get', 'discover']);
    page.leave();
  }));
});

test('coming back from a round returns to the game just played, in the row it was picked in (Featured or My library)', () => {
  hooks.forget();
  withLast(null, () => withWeek({ games: SAMPLE, featuredSlots: [slot(1, 'sleepy-bear'), slot(2, 's1'), slot(3, 's2')] }, () => {
    const a = build();
    const lib = a.page.rows[1].items.findIndex(i => i.g.id === 'sleepy-bear');
    a.page.focusAt({ row: 1, col: lib });
    a.page.leave();
    const b = build();
    assert.deepEqual(b.page.pos, { row: 1, col: lib }, 'back on Sleepy Bear in My library, though it is in Featured too');
    b.page.focusAt({ row: 0, col: 0 });
    b.page.leave();
    const c = build();
    assert.deepEqual(c.page.pos, { row: 0, col: 0 }, 'picked in Featured: back there');
    c.page.leave(); hooks.forget();
  }));
});

test('at rest Home opens on Featured with My library peeking in below it (owner, 2026-11-24); a game there shows its line, figures and world', () => {
  const { s, page } = build();
  assert.ok(s.classList.contains('rest') && !s.classList.contains('scrolled'));
  assert.deepEqual(page.pos, { row: 0, col: 0 }, 'the first Featured tile');
  let secs = qa(s, '.hsec');
  assert.ok(!secs[0].classList.contains('away') && !secs[1].classList.contains('away'), 'Featured and My library both show');
  assert.ok(secs[1].classList.contains('peek') && !secs[0].classList.contains('peek'), 'My library is the one peeking in');
  page.focusAt({ row: 1, col: 0 });
  const first = page.rows[1].items[0].g;
  assert.ok(s.classList.contains('rest'), 'My library still has the big hero');
  assert.equal(hero(s), first.name);
  assert.deepEqual(lit(s), [first.name]);
  assert.ok(txt(q(s, '.hblurb')).length > 3, 'one line');
  const pl = q(s, '.hhow.hh-players');
  assert.ok(pl && /^(\d player|\d to \d players|\d players)/.test(pl.getAttribute('aria-label')), 'players: the people icon and the number, on the how-you-play row');
  assert.ok(!/min|sec/.test(txt(q(s, '.hinfo'))), 'no time');
  assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Play ' + first.name);
  assert.ok(!q(s, '.hplay'), 'no Play button');
  assert.deepEqual(layersOn(s), [`url(world:${first.id})`], 'the focused game\'s world fills the screen');
  secs = qa(s, '.hsec');
  assert.ok(secs[0].classList.contains('away') && !secs[1].classList.contains('away'), 'Featured steps out of the way, My library shows');
  page.leave();
});

test('moving focus changes the hero and crossfades the backdrop (the other layer takes the new world, the old one fades)', () => {
  const { s, page } = build();
  page.focusAt({ row: 1, col: 0 });
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

test('up from My library shows Featured (the hero still big); a featured game is in the hero with Get; down goes back', () => {
  withWeek({ featured: ['s1'], games: SAMPLE.slice(0, 1) }, () => {
    const { s, page } = build();
    page.focusAt({ row: 1, col: 0 });
    assert.deepEqual(page.pos, { row: 1, col: 0 });
    press('ArrowUp');
    assert.deepEqual(page.pos, { row: 0, col: 0 });
    assert.ok(s.classList.contains('rest') && !s.classList.contains('scrolled'), 'still the big hero');
    assert.ok(!qa(s, '.hsec')[0].classList.contains('away') && qa(s, '.hsec')[1].classList.contains('peek'), 'Featured shows now, My library peeking in below');
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

test('a child sees the Play and Create tabs too (0057); the Creator app has no tabs bar', () => {
  withKid(() => {
    const { s, page } = build();
    assert.deepEqual(qa(s, '.ptab').map(t => t.getAttribute('aria-label')), ['Play', 'Create']);
    assert.ok(q(s, '.lg'), 'the logo stays');
    assert.equal(page.tabs.length, 2);
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

test('the profile face opens the sheet: who is playing and their family, then Profile, Settings, Games on this TV (grown-ups) and Sign out', () => {
  const was = account.state;
  try {
    account.state = { token: 't', account: { id: 'a', email: 'grown-up@family.example', role: 'owner' }, household: { name: 'The Parkers' }, profiles: [{ id: 'p1', accountId: 'a', name: 'Mia' }], current: 'p1' };
    const { ui, s, page } = build();
    q(s, '.hme').dispatchEvent(new CustomEvent('pick'));
    const sheet = q(ui, '.hsheetwrap');
    assert.ok(sheet && sheet.classList.contains('dim'), 'a sheet over Home');
    assert.equal(txt(q(sheet, '.hswords')), 'MiaThe Parkers', 'their name, then the family');
    assert.deepEqual(qa(sheet, '.sheetitem').map(b => (/<span>([^<]*)<\/span>/.exec(b.innerHTML) || [])[1]), ['Profile', 'Settings', 'Games on this TV', 'Sign out']);
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

/* ---------- the owner's Waiting for your OK, and Games on this TV (0055) ---------- */
const SUBMISSION = { id: 'sub1', gameId: 'wave-bot', name: 'Wave Bot', version: '1.0', bytes: 100, sha256: 'x', family: 'The Lees', state: 'waiting', game: { icon: { cols: ['#111111', '#222222'] }, blurb: 'Wave at the robot' } };
const asRole = (role, fn) => {
  const was = account.state;
  account.state = { token: 't', account: { id: 'a', role }, profiles: [{ id: 'p1', accountId: 'a', name: 'Dad' }], current: 'p1' };
  try { return fn(); } finally { account.state = was; }
};
const withWaiting = async (entries, fn) => { const was = week.waiting; week.waiting = entries; try { return await fn(); } finally { week.waiting = was; } };

test('Discover, for the owner: a first row "Waiting for your OK" with Try it on each tile; a creator or anyone else does not see it', async () => {
  const { waitingEntries } = await import('../src/ui/submissions.js');
  const entries = waitingEntries([SUBMISSION, { ...SUBMISSION, id: 'sub2', state: 'approved' }]);
  assert.equal(entries.length, 1, 'only the waiting ones');
  assert.equal(entries[0].submission, 'sub1');
  await withWaiting(entries, () => withWeek({ featured: [], games: SAMPLE }, () => {
    asRole('owner', () => {
      const { s, page } = build({ discover: true });
      assert.equal(txt(qa(s, '.hlab')[0]), 'Waiting for your OK', 'the first row');
      assert.deepEqual(page.pos, { row: 0, col: 0 });
      const t = q(s, '.htile.try');
      assert.ok(t && /Try it/.test(txt(q(t, '.getpill'))), 'a Try it pill');
      assert.equal(q(s, '.htile.on').getAttribute('aria-label'), 'Try it Wave Bot');
      assert.match(txt(q(s, '.hblurb')), /Sent by The Lees.*approve it on the management page/);
      page.leave();
    });
    asRole('creator', () => {
      const { s, page } = build({ discover: true });
      assert.ok(!qa(s, '.hlab').some(l => txt(l) === 'Waiting for your OK') && !q(s, '.htile.try'), 'not the owner: nothing');
      page.leave();
    });
  }));
});

test('Try it plays the game from the sandbox and marks it as the trial of that submission (main.js tells the server once it has been played long enough)', async () => {
  const { tryIt } = await import('../src/ui/submissions.js');
  const was = library.preview;
  library.preview = async (e) => ({ id: e.id, name: e.name });
  try {
    const game = await tryIt({ id: 'wave-bot', name: 'Wave Bot', submission: 'sub1' });
    assert.equal(game.trial, 'sub1');
  } finally { library.preview = was; }
});

test('Games on this TV: the profile sheet offers it to grown-ups only; the list has a Remove (asks "Sure?" first) for each downloaded game', async () => {
  const { gamesOnTv, openGames, mayManageGames } = await import('../src/ui/mygames.js');
  library.installed.set('pop-party', '1.0'); library.installed.set('s9', '1.0');
  const removed = [], was = library.remove;
  library.remove = async (id) => { removed.push(id); library.installed.delete(id); };
  try {
    assert.deepEqual(gamesOnTv().map(g => g.id).sort(), ['pop-party', 's9'].sort());
    asRole('owner', () => assert.ok(mayManageGames()));
    withKid(() => assert.equal(mayManageGames(), false, 'a child'));
    const labels = (open) => { const ui = resetDom(); El.prototype.getContext = () => null; open(); return qa(ui, '.sheetitem').map(b => (/<span>([^<]*)<\/span>/.exec(b.innerHTML) || [])[1]); };
    const { openProfileSheet } = await import('../src/ui/menu.js');
    assert.ok(asRole('owner', () => labels(() => openProfileSheet({}))).includes('Games on this TV'));
    assert.ok(!withKid(() => labels(() => openProfileSheet({}))).includes('Games on this TV'), 'a child does not see it');

    const ui = resetDom(); El.prototype.getContext = () => null;
    let changed = 0;
    const sheet = openGames({ onChanged: () => changed++ });
    const rows = qa(ui, '.setrow');
    assert.equal(rows.length, 2);
    const rm = q(rows[0], '.gamerm');
    rm.dispatchEvent(new CustomEvent('pick'));
    assert.deepEqual(removed, [], 'the first press only asks');
    assert.ok(rm.classList.contains('sure'));
    rm.dispatchEvent(new CustomEvent('pick'));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(removed.length, 1);
    assert.equal(qa(ui, '.setrow').length, 1, 'gone from the list');
    sheet.close();
    assert.equal(changed, 1, 'Home is told it changed');
  } finally { library.remove = was; library.installed.delete('pop-party'); library.installed.delete('s9'); }
});

/* the owner's test games (Peekaboo Garden's 3D test, the phone stick's pad test): in My library only with Settings > Testing > Test games on */
test('My library shows the test games only when the owner has Test games on', async () => {
  const { setTestGames, testGamesOn } = await import('../src/ui/testing.js');
  /* (the page is built the way build() does, but with the switch set after the little DOM's storage is cleared) */
  const names = (role, on) => asRole(role, () => {
    const ui = resetDom(); El.prototype.getContext = () => null; keyHandlers.length = 0; setTestGames(on);
    const page = menu({ onPlay(){}, onRecalibrate(){}, onWho(){}, nav: { home(){}, store(){}, create(){}, pro(){} } });
    const n = qa(q(ui, '.home'), '.htile').map(label).join('|'); page.leave(); return n;
  });
  try {
    assert.ok(!/3D test|pad test/.test(names('owner', false)), 'off: not in My library');
    assert.equal(testGamesOn(), false);
    const on = names('owner', true); assert.equal(testGamesOn(), true);
    assert.ok(/Peekaboo Garden \(3D test\)/.test(on) && /Phone stick \(pad test\)/.test(on), 'on: both are there');
    assert.ok(!/3D test|pad test/.test(names('creator', true)), 'on, but not the owner: still not shown');
  } finally { setTestGames(false); }
});
