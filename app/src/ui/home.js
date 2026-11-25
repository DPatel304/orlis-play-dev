/* Home (Play) and Discover, one page builder (decisions 0045 to 0049, 0055; the approved mockup is docs/screens-mockup.html).

   The focused game's painted world fills the screen, with its one line and how many play (figures; the tile names the game). Under it,
   Play's two rows: "Featured" (0058: the game last played, tagged Play again, the owner's three slots, then the Discover tile) and "My library" (peeking in under Featured at rest). The Play and Create tabs
   sit beside the logo (for everyone, children too: 0057); up from the first row reaches them, left and right move between them, OK picks, down goes back.
   The Discover page is the same page with a row per category (rows, tiles and hero are the very same) and a Home button instead of the
   tabs. Moving to a row below the big ones (down) shrinks the hero to a banner. The profile face, top right, opens Profile, Settings and
   Sign out.

   Home is driven by the remote, keyboard and mouse only (arrows move, OK picks, a click plays). No hand mode: no pointing, no waving
   and no camera here (decision 0049); the cursor is off on this page.

   The rows and focus live in home-model.js (tested). */
import { GAMES, LABS, STARTER_GAMES } from '../games/index.js';
import { testGamesOn } from './testing.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx, ambience } from '../audio/sound.js';
import { pose } from '../tracking/pose.js';
import { remote } from './remote.js';
import { account } from './account.js';
import { faceOf } from './avatar-maker.js';
import { week } from './week.js';
import { appMode } from './mode.js';
import { library } from './library.js';
import { toast } from './toast.js';
import { splashWanted, showChallenges, challengePill } from './challenges.js';
import { launch } from './launch.js';
import { shotOf, coverOf, shotImage, makeShots } from './shots.js';
import { makeCover, generatedArt, hasArt } from './covers.js';
import { icon, homeButton, twoSquares } from './brand.js';
import { iconEl } from './icons.js';
import { BLURB, iconOf, HIDDEN, openProfileSheet } from './menu.js';
import { startIdleFace } from './cubo-idle.js';
import { reduced } from './chkit.js';
import { homeRows, discoverRows, featuredItems, tabsFor, startFocus, step, heroOf, bigHero, howYouPlay, needsTablet, PLAY_BIG } from './home-model.js';
import { layout as storeLayout, newer } from './store.js';
import { brandBar } from './tabs.js';
import { seesWaiting, tryIt } from './submissions.js';
import { color } from '../games/assets/palette.js';
import { creations } from '../create/creations.js';
import { madeGame, madeCover, madeWorld } from '../create/made-game.js';
import { makerFace } from '../create/maker.js';

const LAUNCH = 0.2;    /* seconds of going in (the loading screen fading in) */
const WORLD = { w: 1280, h: 720 };

/* The pick made this session ({ id, row }): coming back (from a game, or another page) it's still the one (in the row it was picked in). */
let sessionPick = null;
/* The game last played on this PC (the "Play again" tile in Featured, 0058): set when a round is started from Home. */
const LAST = 'orlis.lastGame';
const remembered = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
const remember = (id) => { try { localStorage.setItem(LAST, id); } catch {} };

/* ---------- the worlds: each game's wide painted picture, made once ---------- */
const worlds = new Map();
const jpeg = (cv) => { try { return cv.toDataURL('image/jpeg', 0.78); } catch { return null; } };
/* (the pictures can be stood in for, in the tests: hooks.world) */
export const hooks = { world: null, forget(){ sessionPick = null; } };   /* (forget: the pick made this session, for the tests) */
export function worldOf(g){
  if (hooks.world) return hooks.world(g);
  if (g.made) return madeWorld(g.made.creation);
  if (worlds.has(g.id)) return worlds.get(g.id);
  let url = null;
  try {
    if (hasArt(g.id)){ const made = makeCover({ id: g.id, name: g.name }, WORLD); url = made && jpeg(made.art); }
    if (!url){ const im = shotImage(g); if (im && im.src) url = im.src; }
    if (!url){ const ic = iconOf(g); url = jpeg(generatedArt(ic.cols, WORLD.w, WORLD.h)); }
  } catch { url = null; }
  worlds.set(g.id, url);
  return url;
}

/* nav: { home(), store(), create() } */
export const menu = (opts) => build(opts, 'play');
/* the Discover page (the app store): what's not on this PC yet, by category */
export const discoverPage = (opts) => build(opts, 'discover');

function build({ onPlay, onRecalibrate, onWho, nav = {}, arrive = false, onFresh = null }, kind){
  const discovering = kind === 'discover';
  clearUI();
  const s = screen('home rest' + (discovering ? ' discover' : '') + (arrive ? ' arrive' : ''));

  /* ---------- what's here ---------- */
  const waiting = account.waiting;
  const showHidden = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search) && /[?&]hidden=1/.test(location.search);
  const labs = showHidden || (account.role === 'owner' && testGamesOn()) ? LABS : [];   /* (the test games: Settings > Testing > Test games) */
  const pool = GAMES.concat(labs).filter(g => (showHidden || !HIDDEN.has(g.id)) && (!waiting || STARTER_GAMES.includes(g.id)));
  /* Discover's games not on this PC yet: a stand-in each that knows its entry (this week's featured first) */
  const standIn = (e) => ({ id: e.id, name: e.name, accent: (e.icon && e.icon.cols && e.icon.cols[0]) || color('fav.purple'), store: { icon: e.icon, blurb: e.blurb, version: e.version, cover: e.cover || '' }, discover: e });
  const games = waiting ? [] : ((week.store && week.store.games) || []);
  const notHere = (e) => !library.installed.has(e.id);
  /* Featured (0058): the game last played here ("Play again"), the owner's three slots (a game on this PC plays, one not here is a Get), then Discover */
  const lead = waiting ? [] : featuredItems({
    last: remembered(),
    slots: week.featuredSlots(),
    have: (id) => pool.find(g => g.id === id) || null,
    stand: (s) => s.builtIn || !s.version ? null : standIn(s)
  });
  /* the tabs (Play, Create): grown-ups in the Player app only */
  const tabIds = discovering ? [] : tabsFor({ waiting, creatorApp: appMode.creator(), modeTabs: appMode.tabs() });
  let rows, nothing = '';
  if (discovering){
    const have = library.installed;
    const upd = games.filter(e => have.has(e.id) && newer(e.version, have.get(e.id))).map(e => ({ ...standIn(e), update: true }));
    const fresh = games.filter(notHere);
    const cats = storeLayout(fresh).rows;
    /* (a game that fits no category still shows: the last row) */
    const placed = new Set(cats.flatMap(r => r.list.map(e => e.id)));
    const rest = fresh.filter(e => !placed.has(e.id));
    if (rest.length && cats.length) cats.push({ name: 'More games', list: rest });
    rows = discoverRows({ waiting: seesWaiting() ? (week.waiting || []).map(standIn) : [], updates: upd, rows: cats.map(r => ({ ...r, list: r.list.map(standIn) })) });
    nothing = !account.signedIn ? 'Sign in to see Discover.' : (week.store ? (games.length ? 'You have every game in Discover. New ones show up here as your family adds them.' : 'Nothing in Discover yet. Games the family adds to the Orlis server show up here.') : 'Loading Discover…');
  } else rows = homeRows({ pool, featuredItems: lead, discover: !!nav.store && !waiting && !appMode.creator(), testing: waiting ? [] : (week.drafts || []) });
  const bigRows = discovering ? 1 : PLAY_BIG;
  /* the family's own games from Create (0057): the third row, "Made by us" */
  if (!discovering && !waiting && !appMode.creator()){
    const madeRow = homeRows({ made: creations.items.map(madeGame) }).find(r => r.id === 'made');
    const at = rows.findIndex(r => r.id === 'testing');
    if (madeRow) rows.splice(at < 0 ? rows.length : at, 0, madeRow);
  }

  /* ---------- the page ---------- */
  const bgwrap = h('div', 'hbgwrap');
  const layers = [h('div', 'hbg'), h('div', 'hbg')];
  bgwrap.append(...layers, h('div', 'hscrim'));
  const box = h('div', 'hbox');
  const top = h('div', 'htop');
  const tabEls = [];
  if (discovering) top.appendChild(homeButton(() => nav.home && nav.home()));
  else { const bar = brandBar({ tabs: tabIds, current: 'play', nav: { play: nav.home, create: nav.create }, light: true }); top.appendChild(bar.el); tabEls.push(...bar.tabs); }
  const sys = h('div', 'hsys');
  /* this week's challenges, as a small pill beside the profile face */
  const ch = week.challenges;
  const pill = !discovering && !appMode.creator() && account.signedIn && !waiting && ch && ch.challenges && ch.challenges.length ? challengePill(ch) : null;
  if (pill) sys.appendChild(pill);
  const who = account.current;
  const me = button('', 'hme');
  me.querySelector('.lbl').replaceWith(h('span', 'hface'));
  const faceCv = faceOf(who || {}, 160, { tile: false, bare: true });   /* a floating head, no tile and no cream edge, only the black outline (owner) */
  me.querySelector('.hface').appendChild(faceCv);
  /* Cubo's head makes a small face now and then while nobody touches anything (it redraws only while one plays) */
  const idleFace = startIdleFace({ redraw: (f) => faceCv.redraw && faceCv.redraw(f), reduced: reduced() });
  const DEV_HOOK = typeof window !== 'undefined' && !!(import.meta.env && import.meta.env.DEV);
  if (DEV_HOOK) window.__cuboFace = (name) => name === 'rest' ? faceCv.redraw() : idleFace.play(name);   /* dev only: force an expression */
  me.setAttribute('aria-label', who ? `${who.name}: profile, settings` : 'Menu');
  let sheet = null;
  const openMe = () => {
    if (sheet || going) return;
    sheet = openProfileSheet({ onRecalibrate, onWho, onChanged: () => { if (onFresh) onFresh(); }, onClosed: () => { sheet = null; if (items.length) remote.mark(currentEl()); } });
  };
  onPick(me, () => { sfx.select(); openMe(); });
  sys.appendChild(me);
  if (!discovering) top.appendChild(sys);

  const info = h('div', 'hinfo');
  const blurb = h('div', 'hblurb'), how = h('div', 'hhows'), meta = h('div', 'hmeta');
  info.append(blurb, how, meta);
  const rowsEl = h('div', 'hrows');
  box.append(top, info, rowsEl);
  s.append(bgwrap, box);

  /* nothing to show: a way to Discover (Play), or why (Discover) */
  const empty = !rows.length;
  if (empty){
    blurb.textContent = discovering ? nothing : 'Get your first game: Pop Party is waiting for you in Discover.';
    if (!discovering && nav.store){   /* the one button on Home */
      const open = button('', 'hplay ringed');
      open.querySelector('.lbl').innerHTML = `${icon('play')}<span>Open Discover</span>`; onPick(open, () => { sfx.select(); nav.store(); }); meta.appendChild(open);
    }
    if (discovering && onFresh) week.refresh({ force: true }).then(changed => { if (changed && s.isConnected) onFresh(); }, () => {});
    ambience.start();
    return { focus: 0, tick(){}, draw(){}, leave(){ idleFace.stop(); if (DEV_HOOK) delete window.__cuboFace; } };
  }

  /* ---------- tiles ---------- */
  const tiles = [];                                   /* tiles[row][col] = { el, item, pic } */
  const gamePic = (g) => g.made ? madeCover(g.made.creation, 960, 600, { title: true }) : shotOf(g);
  const paintTile = (t) => {
    const url = t.item.g && gamePic(t.item.g);
    if (url){ t.el.style.backgroundImage = `url(${url})`; t.el.classList.add('covered'); }
  };
  const makeTile = (item) => {
    const el = button('', 'htile ' + item.kind);
    const hero = heroOf(item);
    if (hero.cta) el.setAttribute('aria-label', `${item.again ? 'Play again' : hero.cta.label} ${hero.name}`);
    if (item.again) el.classList.add('again');
    el.querySelector('.lbl').replaceWith(h('span', 'hname'));
    const t = { el, item };
    if (item.kind === 'game' || item.kind === 'get' || item.kind === 'try'){
      const ic = iconOf(item.g);
      el.style.setProperty('--c1', ic.cols[0]); el.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
      el.querySelector('.hname').textContent = item.g.name;
      paintTile(t);
      if (item.made){ const by = h('span', 'mkby'); by.setAttribute('aria-label', 'Made by us'); by.appendChild(makerFace(item.g.made.makerId, 96)); el.appendChild(by); }
      if (needsTablet(item.g)){ const b = h('span', 'tabmark'); b.setAttribute('role', 'img'); b.setAttribute('aria-label', 'Needs an Orlis PlayPad'); b.appendChild(iconEl('tabletgrip', 96, color('shade.ink'))); el.appendChild(b); }
      if (item.again) el.insertAdjacentHTML('beforeend', `<span class="getpill again">${icon('play')}Play again</span>`);
      if (item.kind === 'try') el.insertAdjacentHTML('beforeend', `<span class="getpill">${icon('play')}Try it</span>`);
      if (item.kind === 'get') el.insertAdjacentHTML('beforeend', `<span class="getpill">${icon('get')}${item.update ? 'Update' : 'Get'}</span><span class="gotbar"><i></i></span>`);
    } else if (item.kind === 'discover'){
      el.classList.add('disc'); el.insertAdjacentHTML('beforeend', twoSquares('dm')); el.querySelector('.hname').textContent = 'Discover';
    } else if (item.kind === 'test'){
      el.classList.add('mk', 'm3'); el.querySelector('.hname').textContent = item.d.name;
      if (item.d.asking) el.insertAdjacentHTML('beforeend', '<span class="gu">Publish?</span>');
    }
    return t;
  };
  rows.forEach((r, ri) => {
    const sec = h('section', 'hsec'), lab = h('div', 'hlab'), row = h('div', 'hrow');
    lab.textContent = r.title; sec.append(lab, row); rowsEl.appendChild(sec);
    tiles[ri] = r.items.map((item, ci) => {
      const t = makeTile(item); t.row = ri; t.col = ci; t.sec = sec; t.rowEl = row;
      onPick(t.el, () => activate(t));
      t.el.addEventListener('mouseenter', () => { if (!going && !sheet) focusAt({ row: ri, col: ci }, { pointer: true }); });
      t.el.addEventListener('remotefocus', () => focusAt({ row: ri, col: ci }, { remote: true }));
      row.appendChild(t.el);
      return t;
    });
  });
  const items = tiles.flat();
  /* ---------- focus ---------- */
  let pos = startFocus(rows, { session: sessionPick && sessionPick.id, sessionRow: sessionPick && sessionPick.row });
  const mem = {};
  let going = null, getting = false, bg = 0, lastWorld = null;
  const current = () => tiles[pos.row][pos.col];
  const currentEl = () => current().el;

  const setWorld = (url) => {
    if (url === lastWorld) return;
    lastWorld = url; bg ^= 1;
    const on = layers[bg], off = layers[bg ^ 1];
    on.style.backgroundImage = url ? `url(${url})` : '';
    on.classList.toggle('plain', !url);
    on.classList.add('on'); off.classList.remove('on');
  };
  function paintHero(t){
    const it = t.item, hero = heroOf(it, { blurb: it.g ? (BLURB[it.g.id] || (it.g.store && it.g.store.blurb) || '') : '', cap: pose.cap });
    blurb.textContent = hero.line;
    /* the "how you play" row on its own line: players (the people icon and the number), then PlayPad (0052, 0054); both icons white here */
    how.textContent = '';
    for (const x of it.g ? howYouPlay(it.g, { cap: pose.cap }) : []){
      const e = h('span', 'hhow hh-' + x.id); e.appendChild(iconEl(x.icon, x.icon === 'tabletgrip' ? 128 : 96, color('earth.snow'))); e.append(x.text);
      if (x.label) e.setAttribute('aria-label', x.label);
      how.appendChild(e);
    }
    s.style.setProperty('--accent', it.g ? iconOf(it.g).cols[0] : 'var(--blue)');
    setWorld(it.g ? worldOf(it.g) : null);
  }
  function layout(){
    const big = bigHero(pos, rows, bigRows), r = pos.row;
    s.classList.toggle('rest', big); s.classList.toggle('scrolled', !big);
    /* the rows: at rest the current one shows (its label above it) with the next one peeking in, cropped by the bottom edge, so it's
       plain there's more below (owner, 2026-11-24); scrolled, the lit row and the one after fill the page */
    const first = big ? r : Math.max(1, r - 1);
    rowsEl.style.setProperty('--first', first);
    tiles.forEach((rowTiles, k) => {
      rowTiles[0].sec.classList.toggle('away', big ? (k !== r && k !== r + 1) : k < first);
      rowTiles[0].sec.classList.toggle('peek', big && k === r + 1);
    });
  }
  function slide(t){
    if (!t) return;
    const view = box.clientWidth - t.rowEl.offsetLeft;
    const over = t.el.offsetLeft + t.el.offsetWidth + t.el.offsetWidth * 0.3 - view;
    t.rowEl.style.transform = `translateX(${-Math.max(0, over)}px)`;
  }
  function focusAt(p, { pointer = false, remote: fromRemote = false, quiet = false } = {}){
    if (pos.row === p.row && pos.col === p.col && !quiet){ return; }
    const was = pos; pos = p; mem[p.row] = p.col;
    items.forEach(t => t.el.classList.toggle('on', t.row === p.row && t.col === p.col));
    const t = current();
    paintHero(t); layout(); slide(t);
    if (!fromRemote) remote.mark(t.el); else remote.mark(t.el);
    if (t.item.g && t.item.kind === 'game') sessionPick = { id: t.item.g.id, row: rows[t.row].id };
    if (!quiet && was !== p){ sfx.nav(); ambience.lift(); }
  }

  /* ---------- picking ---------- */
  async function activate(t){
    if (going || getting || sheet) return;
    const it = t.item;
    focusAt({ row: t.row, col: t.col }, { quiet: true });
    sfx.select();
    if (it.kind === 'discover') return nav.store && nav.store();
    if (it.kind === 'test') return tryDraft(it.d);
    if (it.kind === 'try') return trySent(it.g.discover);
    let g = it.g;
    /* one from Discover is got first, with its progress on the tile */
    if (it.kind === 'get'){
      getting = true; t.el.classList.add('getting');
      try { g = await library.install(g.discover, (p) => { const pct = `${Math.round(p * 100)}%`; t.el.style.setProperty('--got', pct); t.el.dataset.got = pct; }); sfx.gold?.(); }
      catch (e){ getting = false; t.el.classList.remove('getting'); t.el.style.removeProperty('--got'); toast(e.message || 'That didn’t download. Try again.', { bad: true }); return; }
      getting = false; t.el.classList.remove('getting');
    }
    going = { t: 0, g };
    if (!g.made) remember(g.id);
    /* straight to the loading screen (a quick fade); it stays while the game gets ready */
    launch.begin({ url: g.made ? madeCover(g.made.creation, 960, 600, { title: true }) : coverOf(g), name: g.name, blurb: BLURB[g.id] || (g.store && g.store.blurb) || '' });
  }
  /* the owner tries a game a creator sent (not kept; played long enough, it can be approved on the management page) */
  const trySent = async (e) => {
    if (going || getting) return;
    toast(`Getting ${e.name}…`);
    try { const game = await tryIt(e); sfx.gold?.(); onPlay(game); }
    catch (err){ toast(err.message || 'That didn’t start.', { bad: true }); }
  };
  /* a creator's game on this TV to try: a grown-up answers the Publish question here */
  const tryDraft = async (d) => {
    if (going || getting) return;
    toast(`Getting ${d.name}…`);
    try {
      const game = await library.preview({ id: d.id, version: d.version, sha256: d.sha256, draft: true });
      game.back = () => nav.home && nav.home();
      sfx.gold?.(); onPlay(game);
    } catch (e){ toast(e.message || 'That didn’t start.', { bad: true }); }
  };

  /* ---------- the remote's up and down (left and right are remote.js's: the nearest tile that way) ---------- */
  const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const inTop = () => !!remote.cur && !!remote.cur.closest && remote.cur.closest('.htop') === top;
  const toTabs = () => {
    const t = tabEls.find(b => b.classList.contains('cur')) || tabEls[0];
    items.forEach(x => x.el.classList.remove('on'));
    remote.mark(t); sfx.nav();
  };
  const keys = (e) => {
    const dir = ARROWS[e.key];
    if (!dir || !s.isConnected || sheet || going || document.querySelector('.dim:not(.lost)')) return;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); document.body.classList.add('remote'); remote.lastKey++; };
    /* on the top bar: Left and Right go from tab to tab (past the last, the remote's own nearest-button takes over: the profile face),
       Down goes back into the page, Up stays */
    if (inTop()){
      const i = tabEls.indexOf(remote.cur);
      if (dir === 'down'){ stop(); focusAt(pos, { remote: true, quiet: true }); }
      else if (dir === 'up') stop();
      else if (i >= 0 && (dir === 'left' || i < tabEls.length - 1)){ stop(); const to = tabEls[i + (dir === 'left' ? -1 : 1)]; if (to){ remote.mark(to); sfx.nav(); } }
      return;
    }
    if (dir === 'left' || dir === 'right') return;   /* (remote.js: the nearest tile that way) */
    const to = step(rows, pos, dir, mem);
    stop();
    if (to) focusAt(to, { remote: true });
    else if (dir === 'up' && tabEls.length) toTabs();
  };
  addEventListener('keydown', keys, true);

  /* ---------- the first look ---------- */
  focusAt(pos, { quiet: true });
  slide(current());
  ambience.start();
  /* this week's featured and challenges, fresh from the server (shown again if they changed - not mid-pick) */
  if (onFresh && !discovering && !waiting && account.signedIn) creations.refresh().then((changed) => { if (changed && !going && !getting && !holdArrive && s.isConnected) onFresh(); }, () => {});
  if (onFresh) week.refresh().then(changed => { if (changed && !going && !getting && !holdArrive && s.isConnected) onFresh(); }, () => {});
  /* the pictures still to make (one at a time, between frames) */
  const stopShots = makeShots([...new Map(items.filter(t => t.item.g && !t.item.g.made).map(t => [t.item.g.id, t.item.g])).values()], (g) => items.forEach(t => { if (t.item.g && t.item.g.id === g.id) paintTile(t); }));
  /* this week's challenge cards, on arriving (only the first time in a new challenge week, 0051) */
  let holdArrive = false;
  if (!discovering && !waiting && ch && ch.challenges && ch.challenges.length && splashWanted(ch)){
    holdArrive = true;
    showChallenges(ch, { auto: true, first: true, from: pill, onLeave: () => { holdArrive = false; } });
  }
  const beta = typeof window === 'undefined' || !window.ORLIS_LABEL || window.ORLIS_LABEL.beta;
  if (beta) s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  return {
    leave(){ stopShots(); idleFace.stop(); if (DEV_HOOK) delete window.__cuboFace; removeEventListener('keydown', keys, true); },
    get focus(){ return items.indexOf(current()); },
    get pos(){ return pos; },
    /* (for the tests and the pictures) */
    focusAt, rows, items, tabs: tabEls, toTabs,
    tick(dt){
      if (going){
        going.t += dt;
        if (going.t >= LAUNCH){ ambience.stop(); const g = going.g; going = null; onPlay(g); }
      }
    },
    draw(){}
  };
}
