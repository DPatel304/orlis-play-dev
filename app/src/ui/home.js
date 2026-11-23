/* Home: one page, no tabs (decision 0045; the approved mockup is docs/screens-mockup.html).

   The focused game's painted world fills the screen, with its name in big plain outlined letters, one line, how many play and for how
   long, and one big Play. Under it, three rows: "Your games", "New to try" (what Discover was, with Get and download progress on its
   tiles) and "Make a game" (Create: Ask for a game, Your requests, Create Pro). Moving to another row (down, or pointing at the row
   edge) shrinks the hero to a banner. The profile face, top right, opens Profile, Settings and Sign out.

   Remote, keyboard and mouse work as they always have (arrows move, OK picks, a click plays). In Big Picture the camera stays on,
   lightly, and a child points and waves (hand.js): pointing lights a tile and shows "Wave to play" with their face; a wave plays;
   holding still never starts anything; holding the cursor at the row edge moves between rows. The first hand up drives.

   The rows and focus live in home-model.js (tested); the hand's pieces in hand.js (tested). */
import { GAMES, LABS, STARTER_GAMES } from '../games/index.js';
import { button, onPick, cursor } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx, ambience } from '../audio/sound.js';
import { pose } from '../tracking/pose.js';
import { remote } from './remote.js';
import { account } from './account.js';
import { faceOf } from './avatar-maker.js';
import { crew } from './crew.js';
import { week } from './week.js';
import { appMode } from './mode.js';
import { library } from './library.js';
import { toast } from './toast.js';
import { splashWanted, showChallenges, challengePill } from './challenges.js';
import { launch } from './launch.js';
import { shotOf, shotImage, makeShots } from './shots.js';
import { makeCover, generatedArt, hasArt } from './covers.js';
import { testingRow } from './building.js';
import { logo, icon, propIcon } from './brand.js';
import { BLURB, iconOf, HIDDEN, openProfileSheet } from './menu.js';
import { homeRows, makeFor, startFocus, step, heroOf, bigHero } from './home-model.js';
import { Driver, EdgeHold, mapHand } from './hand.js';
import { color } from '../games/assets/palette.js';

const HOVER_FOCUS = 0.05;      /* seconds of a hand on a tile to pick it (the cursor's already sticky) */
const LAUNCH = launch.OPEN;    /* seconds of going in (the tile opening up) */
const POINT_AGAIN = 0.04;      /* how far (of the screen) a hand moves to take over from the remote */
const WORLD = { w: 1280, h: 720 };

/* The pick made this session ({ id }): coming back (from a game, or another page) it's still the one. */
let sessionPick = null;
const LAST = 'orlis.lastGame';
const remembered = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
const remember = (id) => { try { localStorage.setItem(LAST, id); } catch {} };

/* ---------- the worlds: each game's wide painted picture, made once ---------- */
const worlds = new Map();
const jpeg = (cv) => { try { return cv.toDataURL('image/jpeg', 0.78); } catch { return null; } };
/* (the pictures can be stood in for, in the tests: hooks.world) */
export const hooks = { world: null };
export function worldOf(g){
  if (hooks.world) return hooks.world(g);
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

/* Is hand mode on this build: Big Picture (the TV), or ?hand=1 in the address (to try it in a browser). */
export const handWanted = () => typeof window !== 'undefined' && (window.ORLIS_DISPLAY === 'bigpicture' || /[?&]hand=1\b/.test(location.search));

/* nav: { home(), store(), create(), pro(), requests() } */
export function menu({ onPlay, onRecalibrate, onWho, nav = {}, arrive = false, onFresh = null }){
  clearUI();
  const s = screen('home rest' + (arrive ? ' arrive' : ''));

  /* ---------- what's here ---------- */
  const waiting = account.waiting;
  const showHidden = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search) && /[?&]hidden=1/.test(location.search);
  const labs = showHidden || account.role === 'owner' ? LABS : [];
  const pool = GAMES.concat(labs).filter(g => (showHidden || !HIDDEN.has(g.id)) && (!waiting || STARTER_GAMES.includes(g.id)));
  /* Discover's games not on this PC yet: a stand-in each that knows its entry (this week's featured first) */
  const standIn = (e) => ({ id: e.id, name: e.name, accent: (e.icon && e.icon.cols && e.icon.cols[0]) || color('fav.purple'), store: { icon: e.icon, blurb: e.blurb, version: e.version, cover: e.cover || '' }, discover: e });
  const games = waiting ? [] : ((week.store && week.store.games) || []);
  const featured = waiting ? [] : week.featured();
  const toGet = [...featured, ...games].filter((e, i, all) => !library.installed.has(e.id) && all.indexOf(e) === i).map(standIn);
  const creator = account.signedIn && ['creator', 'owner'].includes(account.role);
  const make = !appMode.tabs().includes('create') && !appMode.creator() ? [] : waiting ? ['ask'] : makeFor({ kid: account.isKid, creator, creatorApp: appMode.creator() }).filter(id => id !== 'pro' || nav.pro).filter(id => id !== 'requests' || nav.requests);
  const rows = homeRows({ pool, toGet, make, more: !!nav.store && !waiting && !appMode.creator(), testing: waiting ? [] : (week.drafts || []) });

  /* ---------- the page ---------- */
  const bgwrap = h('div', 'hbgwrap');
  const layers = [h('div', 'hbg'), h('div', 'hbg')];
  bgwrap.append(...layers, h('div', 'hscrim'));
  const box = h('div', 'hbox');
  const top = h('div', 'htop');
  top.appendChild(logo({ size: 'calc(var(--u)*6.4)', light: true }));
  const sys = h('div', 'hsys');
  /* this week's challenges, as a small pill beside the profile face */
  const ch = week.challenges;
  const pill = !appMode.creator() && account.signedIn && !waiting && ch && ch.challenges && ch.challenges.length ? challengePill(ch) : null;
  if (pill) sys.appendChild(pill);
  const who = account.current;
  const me = button('', 'hme');
  me.querySelector('.lbl').replaceWith(h('span', 'hface'));
  me.querySelector('.hface').appendChild(faceOf(who || {}, 160, { tile: false }));   /* a floating head, no tile (owner) */
  me.setAttribute('aria-label', who ? `${who.name}: profile, settings` : 'Menu');
  let sheet = null;
  const openMe = () => {
    if (sheet || going) return;
    sheet = openProfileSheet({ onRecalibrate, onWho, onClosed: () => { sheet = null; if (items.length) remote.mark(currentEl()); } });
  };
  onPick(me, () => { sfx.select(); openMe(); });
  sys.appendChild(me);
  top.appendChild(sys);

  const info = h('div', 'hinfo');
  const ht = h('div', 'ht'), blurb = h('div', 'hblurb'), meta = h('div', 'hmeta');
  const play = button('', 'hplay ringed');
  info.append(ht, blurb, meta);
  const rowsEl = h('div', 'hrows');
  box.append(top, info, rowsEl);
  s.append(bgwrap, box);

  /* no games yet (nothing on this PC and nothing to get): a way to Discover */
  const empty = !rows.length;
  if (empty){
    ht.textContent = 'Get your first game'; blurb.textContent = 'Pop Party is waiting for you in Discover.';
    if (nav.store){ play.querySelector('.lbl').innerHTML = `${icon('play')}<span>Open Discover</span>`; onPick(play, () => { sfx.select(); nav.store(); }); meta.appendChild(play); }
    ambience.start();
    return { focus: 0, tick(){}, draw(){}, leave(){} };
  }

  /* ---------- tiles ---------- */
  const tiles = [];                                   /* tiles[row][col] = { el, item, pic } */
  const gamePic = (g) => shotOf(g);
  const paintTile = (t) => {
    const url = t.item.g && gamePic(t.item.g);
    if (url){ t.el.style.backgroundImage = `url(${url})`; t.el.classList.add('covered'); }
  };
  const makeTile = (item) => {
    const el = button('', 'htile ' + item.kind);
    el.querySelector('.lbl').replaceWith(h('span', 'hname'));
    const t = { el, item };
    if (item.kind === 'game' || item.kind === 'get'){
      const ic = iconOf(item.g);
      el.style.setProperty('--c1', ic.cols[0]); el.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
      el.querySelector('.hname').textContent = item.g.name;
      paintTile(t);
      if (item.kind === 'get') el.insertAdjacentHTML('beforeend', `<span class="getpill">${icon('get')}Get</span><span class="gotbar"><i></i></span>`);
    } else if (item.kind === 'more'){
      el.classList.add('mk', 'm4'); el.appendChild(propIcon('star')); el.querySelector('.hname').textContent = 'More to try';
    } else if (item.kind === 'make'){
      el.classList.add('mk', item.tone); el.appendChild(propIcon(item.prop));
      if (item.tag) el.insertAdjacentHTML('beforeend', `<span class="gu">${item.tag}</span>`);
      el.querySelector('.hname').textContent = item.name;
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
  onPick(play, () => { const t = current(); if (t) activate(t); });
  play.querySelector('.lbl').innerHTML = `${icon('play')}<span>Play</span>`;
  play.addEventListener('remotefocus', () => focusAt('top', { remote: true }));
  /* hand mode: the row-edge strip (a pill at the bottom, and one at the top once scrolled) and the "Wave to play" pill */
  const edgeDown = h('div', 'hedge down', `${icon('down')}<span></span>`), edgeUp = h('div', 'hedge up', `${icon('up')}<span></span>`);
  const say = h('div', 'hsay'), sayFace = h('span', 'sface'), sayText = h('span', 'stext');
  say.append(sayFace, sayText);
  const dot = h('div', 'hcur', '<i class="rg"></i><i class="dot"></i>');
  s.append(edgeUp, edgeDown, say, dot);

  /* ---------- focus ---------- */
  let pos = startFocus(rows, { session: sessionPick && sessionPick.id, last: remembered() });
  const mem = {};
  let going = null, getting = false, handActive = false, bg = 0, lastWorld = null;
  const current = () => (pos === 'top' ? tiles[mem.last ? mem.last.row : 0][mem.last ? mem.last.col : 0] : tiles[pos.row][pos.col]);
  const currentEl = () => (pos === 'top' ? play : current().el);

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
    ht.textContent = hero.title; blurb.textContent = hero.line;
    meta.innerHTML = '';
    for (const c of hero.chips){ const chip = h('span', 'chip'); chip.textContent = c; meta.appendChild(chip); }
    if (hero.cta){ play.querySelector('.lbl').innerHTML = `${icon(hero.cta.icon)}<span>${hero.cta.label}</span>`; meta.appendChild(play); }
    ht.classList.toggle('long', hero.title.length > 16);
    s.style.setProperty('--accent', it.g ? iconOf(it.g).cols[0] : 'var(--blue)');
    setWorld(it.g ? worldOf(it.g) : null);
  }
  function layout(){
    const big = bigHero(pos, rows), r = pos === 'top' ? 0 : pos.row;
    s.classList.toggle('rest', big); s.classList.toggle('scrolled', !big);
    /* the rows: at rest the first sits low with the next one's label peeking; scrolled, the lit row and the one after fill the page */
    const first = big ? 0 : Math.max(1, r - 1);
    rowsEl.style.setProperty('--first', first);
    tiles.forEach((rowTiles, k) => rowTiles[0].sec.classList.toggle('away', k < first || (!big && k === 0)));
    /* the row edge pills: the next row's name along the bottom, the one before along the top */
    const down = rows[r + 1], up = !big && rows[r - 1];
    edgeDown.hidden = !down || !handActive; edgeUp.hidden = !up || !handActive;
    if (down) edgeDown.querySelector('span').textContent = down.title;
    if (up) edgeUp.querySelector('span').textContent = up.title;
  }
  function slide(t){
    if (!t) return;
    const view = box.clientWidth - t.rowEl.offsetLeft;
    const over = t.el.offsetLeft + t.el.offsetWidth + t.el.offsetWidth * 0.3 - view;
    t.rowEl.style.transform = `translateX(${-Math.max(0, over)}px)`;
  }
  function focusAt(p, { pointer = false, remote: fromRemote = false, quiet = false } = {}){
    if (p === 'top'){
      if (pos === 'top') return;
      mem.last = pos; pos = 'top'; items.forEach(t => t.el.classList.remove('on')); play.classList.add('on'); layout(); remote.mark(play);
      if (!quiet) sfx.nav(); return;
    }
    if (pos !== 'top' && pos.row === p.row && pos.col === p.col && !quiet){ return; }
    const was = pos; pos = p; mem[p.row] = p.col; mem.last = p;
    play.classList.remove('on');
    items.forEach(t => t.el.classList.toggle('on', t.row === p.row && t.col === p.col));
    const t = current();
    paintHero(t); layout(); slide(t);
    if (!fromRemote) remote.mark(t.el); else remote.mark(t.el);
    if (t.item.g && t.item.kind === 'game'){ remember(t.item.g.id); sessionPick = { id: t.item.g.id }; }
    if (!quiet && was !== p){ sfx.nav(); ambience.lift(); }
  }

  /* ---------- picking ---------- */
  async function activate(t){
    if (going || getting || sheet) return;
    const it = t.item;
    focusAt({ row: t.row, col: t.col }, { quiet: true });
    sfx.select();
    if (it.kind === 'more') return nav.store && nav.store();
    if (it.kind === 'make') return it.id === 'ask' ? nav.create && nav.create() : it.id === 'requests' ? nav.requests && nav.requests() : nav.pro && nav.pro();
    if (it.kind === 'test') return tryDraft(it.d);
    let g = it.g;
    /* one from Discover is got first, with its progress on the tile */
    if (it.kind === 'get'){
      getting = true; t.el.classList.add('getting');
      try { g = await library.install(g.discover, (p) => { const pct = `${Math.round(p * 100)}%`; t.el.style.setProperty('--got', pct); t.el.dataset.got = pct; }); sfx.gold?.(); }
      catch (e){ getting = false; t.el.classList.remove('getting'); t.el.style.removeProperty('--got'); toast(e.message || 'That didn’t download. Try again.', { bad: true }); return; }
      getting = false; t.el.classList.remove('getting');
    }
    going = { t: 0, g };
    /* the tile opens up to fill the screen (its cover, title and all) and stays while the game gets ready */
    launch.begin({ rect: t.el.getBoundingClientRect(), url: shotOf(g), accent: iconOf(it.g).cols[0], name: g.name });
  }
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
  const ARROWS = { ArrowUp: 'up', ArrowDown: 'down' };
  const keys = (e) => {
    const dir = ARROWS[e.key];
    if (!dir || !s.isConnected || sheet || going || document.querySelector('.dim:not(.lost)')) return;
    const to = step(rows, pos, dir, mem);
    e.preventDefault(); e.stopImmediatePropagation();
    document.body.classList.add('remote'); remote.lastKey++;
    if (to) focusAt(to, { remote: true });
  };
  addEventListener('keydown', keys, true);

  /* ---------- the first look ---------- */
  focusAt(pos === 'top' ? { row: 0, col: 0 } : pos, { quiet: true });
  slide(current());
  ambience.start();
  /* this week's featured and challenges, fresh from the server (shown again if they changed - not mid-pick) */
  if (onFresh) week.refresh().then(changed => { if (changed && !going && !getting && !holdArrive && s.isConnected) onFresh(); }, () => {});
  /* the pictures still to make (one at a time, between frames) */
  const stopShots = makeShots([...new Map(items.filter(t => t.item.g).map(t => [t.item.g.id, t.item.g])).values()], (g) => items.forEach(t => { if (t.item.g && t.item.g.id === g.id) paintTile(t); }));
  /* this week's challenge cards, on arriving (once each time the app starts) */
  let holdArrive = false;
  if (!waiting && ch && ch.challenges && ch.challenges.length && splashWanted()){
    holdArrive = true;
    showChallenges(ch, { auto: true, first: true, from: pill, onLeave: () => { holdArrive = false; } });
  }
  const beta = typeof window === 'undefined' || !window.ORLIS_LABEL || window.ORLIS_LABEL.beta;
  if (beta) s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  /* ---------- hand mode ---------- */
  const driver = new Driver(), edge = new EdgeHold();
  const gate = { driver: () => driver.who, takeOver: (i) => { driver.takeOver(i); sfx.select?.(); } };
  let keySeen = remote.lastKey, anchor = null, lit = null;
  const startHand = () => {
    handActive = true; cursor.enabled = true; cursor.map = mapHand; cursor.gate = gate; cursor.skin = true;
    s.classList.add('hand'); layout();
  };
  const stopHand = () => {
    handActive = false; cursor.map = null; cursor.gate = null; cursor.skin = false; driver.who = null;
    s.classList.remove('hand'); dot.classList.remove('show'); say.classList.remove('show'); edgeDown.hidden = edgeUp.hidden = true;
  };
  /* whoever drives gets their own colour and face: their place's colour, and the profile that's lined up there (else the signed-in one) */
  const faceFor = (i) => { const p = crew.profileOf(i) || account.current || {}; return faceOf(p, 96); };

  /* the tile pointed at: its lift, its "Wave to play" and the ring on the cursor */
  function hand(dt){
    const want = handWanted() && pose.on && !pose.mouse.active && !!pose.lite;
    if (want && !handActive) startHand(); else if (!want && handActive) stopHand();
    if (!handActive) return;
    /* who has a hand up in the box (the driver's cursor ring is in cursor.rings) */
    const active = pose.players.map(p => !!(p.present && p.lm && mapHand(p, pose.cursorHand(p))));
    driver.update(dt, active, pose.players.map(p => p.present));
    const ring = cursor.rings.find(r => r.id === driver.who) || null;
    cursor.enabled = !sheet && !going;
    /* the cursor in the driver's colour */
    const overButton = !!document.querySelector('.hot');
    if (ring && !overButton && !(edgeDown.classList.contains('lit') || edgeUp.classList.contains('lit'))){
      dot.classList.add('show');
      dot.style.left = `${ring.x * 100}%`; dot.style.top = `${ring.y * 100}%`;
      s.style.setProperty('--c', ring.color); dot.style.setProperty('--k', `${Math.round(ring.progress * 100)}%`);
    } else dot.classList.remove('show');
    /* the lit one: a tile (or the Play button or the profile face) the cursor has settled on */
    const hot = [...items.map(t => t.el), play, me].find(el => el.classList.contains('hot')) || null;
    document.querySelectorAll('.htile, .hplay, .hme').forEach(el => { if (el !== hot) el.classList.remove('lit'); });
    if (hot && ring){
      hot.classList.add('lit');
      const word = hot === me ? 'Wave to open' : hot === play ? `Wave to ${play.textContent.trim().toLowerCase()}` : current() && hot === current().el && current().item.kind === 'get' ? 'Wave to get' : current() && hot === current().el && ['make', 'more', 'test'].includes(current().item.kind) ? 'Wave to open' : 'Wave to play';
      sayText.textContent = word;
      if (lit !== ring.id){ sayFace.innerHTML = ''; sayFace.appendChild(faceFor(ring.id)); lit = ring.id; }
      say.style.setProperty('--c', ring.color);
      const r = hot.getBoundingClientRect();
      say.style.left = `${r.left + r.width / 2}px`; say.style.top = `${Math.max(8, r.top - say.offsetHeight - 10)}px`;
      say.classList.add('show');
    } else say.classList.remove('show');
    /* the row-edge strip: the cursor held at the bottom (or top) edge moves between rows */
    const r = pos === 'top' ? 0 : pos.row;
    const e = edge.update(dt, ring && !sheet && !going ? ring.y : null, { canDown: !!rows[r + 1], canUp: !bigHero(pos, rows) && r > 0 });
    edgeDown.style.setProperty('--k', `${Math.round((e.dir > 0 ? e.progress : 0) * 100)}%`); edgeUp.style.setProperty('--k', `${Math.round((e.dir < 0 ? e.progress : 0) * 100)}%`);
    edgeDown.classList.toggle('lit', e.dir > 0); edgeUp.classList.toggle('lit', e.dir < 0);
    if (e.step){ sfx.nav(); const to = step(rows, pos === 'top' ? { row: 0, col: mem[0] ?? 0 } : pos, e.step > 0 ? 'down' : 'up', mem); if (to && to !== 'top') focusAt(to, { quiet: false }); }
  }

  return {
    leave(){ stopShots(); stopHand(); removeEventListener('keydown', keys, true); cursor.skin = false; cursor.enabled = false; },
    get focus(){ return pos === 'top' ? 0 : items.indexOf(current()); },
    get pos(){ return pos; },
    get hand(){ return handActive; },
    /* (for the tests and the pictures) */
    focusAt, rows, items,
    tick(dt){
      /* After the remote's used, pointing takes over again only once a hand (or the mouse) actually moves - not because the rows slid under one that's resting. */
      if (remote.lastKey !== keySeen){ keySeen = remote.lastKey; anchor = cursor.rings.map(r => [r.x, r.y]); }
      if (anchor && (cursor.rings.length !== anchor.length || cursor.rings.some((r, i) => Math.hypot(r.x - anchor[i][0], r.y - anchor[i][1]) > POINT_AGAIN))) anchor = null;
      hand(dt);
      /* The tile pointed at is the picked one. */
      if (!anchor && !sheet && !going) for (const t of items){
        const hot = t.el.classList.contains('hot') && !(pos !== 'top' && pos.row === t.row && pos.col === t.col);
        t.hot = hot ? (t.hot || 0) + dt : 0;
        if (t.hot >= HOVER_FOCUS){ t.hot = 0; focusAt({ row: t.row, col: t.col }, { pointer: true }); }
      }
      if (going){
        going.t += dt;
        if (going.t >= LAUNCH){ ambience.stop(); const g = going.g; going = null; stopHand(); onPlay(g); }
      }
    },
    draw(){}
  };
}
