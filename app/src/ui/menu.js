import { GAMES, STARTER_GAMES } from '../games/index.js';
import { button, onPick, cursor } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio, sfx, ambience } from '../audio/sound.js';
import { pose, MAX_PLAYERS } from '../tracking/pose.js';
import { poster } from './posters.js';
import { PAPER } from './boot.js';
import { remote } from './remote.js';
import { trailer } from './trailer.js';
import { topBar } from './tabs.js';
import { account } from './account.js';
import { week } from './week.js';
import { library } from './library.js';
import { toast } from './toast.js';
import { splashWanted, showChallenges } from './challenges.js';
import { launch } from './launch.js';
import { shotOf, shotImage, keepShot, makeShots } from './shots.js';
import { banner as wideBanner, discoverCoverUrl, seeAllCoverUrl, buildingCoverUrl } from './covers.js';
import { looksOf } from './request.js';

/* Home: Orlis Play's front room, the way a TV box does it. Along the top, the
   name, who's here (a bubble each, with their face), whether the camera's
   working, and the time. Under it a big banner for the game you're on - its
   living picture, its name, a line about it, how many can play, and Play.
   Under that, the games in a row. The console's own places - settings, the
   store - are in the menu behind the button in the corner. Moving along (pointing, or the remote's arrows) changes the banner; a row
   slides along to keep the one you're on in view, so there's room for as
   many games as there are.

   Arriving from the boot (arrive), the tiles fly out from where the cube
   broke apart, into their places. */
/* A line about each game. */
const BLURB = {
  'pop-party': 'Reach up and pop the balloons before they float away',
  'uncle-bs-boat': 'Cup your hands and catch fish with Uncle B',
  'dance-party': 'Copy the dancers and move to the music',
  'last-known-position': 'Run, jump and explore a strange planet',
  'castle-defense': 'Build towers together and keep the castle safe',
  'sleepy-bear': 'Dance to the music - then freeze before the bear peeks!',
  'leaf-pile': 'Sweep the autumn leaves into a big pile - then jump in!',
  'stack-it-high': 'Catch the falling blocks and build a tower to the sky',
  'sky-painter': 'Paint the sky with your arms - what’s hiding there?'
};
/* Each game's icon, in the cube's style: a rounded square in two colours,
   a simple white picture on it. */
export const ICONS = {
  'pop-party': { cols: ['#ff7eb3', '#ffa25a'], glyph: 'balloon' },
  'last-known-position': { cols: ['#7fb8c9', '#b4c79a'], glyph: 'rocket' },
  'uncle-bs-boat': { cols: ['#0ea5e9', '#5eead4'], glyph: 'boat' },
  'dance-party': { cols: ['#f43f5e', '#fbbf24'], glyph: 'note' },
  'castle-defense': { cols: ['#10b981', '#a3e635'], glyph: 'tower' },
  'sleepy-bear': { cols: ['#b07a4f', '#f2c48a'], glyph: 'bear' },
  'leaf-pile': { cols: ['#e07b39', '#f2c14e'], glyph: 'leaf' },
  'stack-it-high': { cols: ['#4fb3a8', '#a98bff'], glyph: 'blocks' },
  'sky-painter': { cols: ['#5b8fd6', '#9fd8e6'], glyph: 'brush' }
};
const GLYPHS = {
  balloon: '<path d="M50 14c15 0 25 11 25 26 0 17-14 30-25 33-11-3-25-16-25-33 0-15 10-26 25-26z" fill="#fff"/><path d="M46 73h8l-4 6z" fill="#fff"/><path d="M50 79c-5 6 5 9 0 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="41" cy="31" rx="5" ry="8" transform="rotate(-25 41 31)" fill="#000" opacity=".12"/>',
  rocket: '<path d="M50 10c11 9 16 24 16 40 0 9-2 17-5 24H39c-3-7-5-15-5-24 0-16 5-31 16-40z" fill="#fff"/><circle cx="50" cy="40" r="7" fill="#000" opacity=".16"/><path d="M34 56l-11 16 13-3zM66 56l11 16-13-3z" fill="#fff"/><path d="M43 78h14l-7 12z" fill="#fff" opacity=".8"/>',
  boat: '<path d="M18 60h64l-10 16H28z" fill="#fff"/><path d="M50 18v38H24z" fill="#fff"/><path d="M54 26v30h20z" fill="#fff" opacity=".85"/>',
  note: '<ellipse cx="38" cy="72" rx="12" ry="9" transform="rotate(-20 38 72)" fill="#fff"/><path d="M47 70V20l26 8v12l-20-6v36" fill="#fff"/>',
  bear: '<circle cx="30" cy="30" r="11" fill="#fff"/><circle cx="70" cy="30" r="11" fill="#fff"/><ellipse cx="50" cy="55" rx="30" ry="27" fill="#fff"/><ellipse cx="50" cy="66" rx="12" ry="9" fill="#000" opacity=".14"/><path d="M36 50q4-4 8 0M56 50q4-4 8 0" stroke="#000" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>',
  leaf: '<path d="M22 74C22 40 46 20 80 20c0 34-20 58-54 58z" fill="#fff"/><path d="M24 76L66 34" stroke="#000" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/>',
  blocks: '<rect x="30" y="58" width="40" height="24" rx="6" fill="#fff"/><rect x="34" y="36" width="32" height="22" rx="6" fill="#fff" opacity=".9"/><rect x="38" y="16" width="24" height="20" rx="5" fill="#fff" opacity=".8"/>',
  brush: '<path d="M70 14l16 16-30 30-16-16z" fill="#fff"/><path d="M38 46l16 16c-4 12-14 20-30 22 2-16 8-30 14-38z" fill="#fff" opacity=".85"/>',
  tower: '<path d="M30 30h8v-8h8v8h8v-8h8v8h8v14H30z" fill="#fff"/><path d="M34 44h32v36H34z" fill="#fff"/><path d="M45 80V64a5 5 0 0 1 10 0v16z" fill="#000" opacity=".15"/>'
};
/* A game's icon: its own, or the one its Store entry gave it (a picture
   drawn in simple shapes - anything that could run code is turned away). */
const safeSvg = (svg) => typeof svg === 'string' && svg.length < 4000 && !/<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href/i.test(svg) ? svg : null;
export const iconOf = (g) => ICONS[g.id]
  || (g.store && g.store.icon && { cols: g.store.icon.cols.length === 2 ? g.store.icon.cols : [g.accent, g.accent], glyph: 'balloon', svg: safeSvg(g.store.icon.glyph) })
  || { cols: [g.accent, g.accent], glyph: 'balloon' };
export { GLYPHS };

/* A game's look - in the Store, and on Home: its icon, and its art - the icon's colours,
   big and soft, with its picture - for anywhere it isn't playing itself. */
export function looks(g){
  const ic = iconOf({ id: g.id, accent: (g.icon && g.icon.cols && g.icon.cols[0]) || '#6d5efc', store: { icon: g.icon || { cols: [] } } });
  const glyph = ic.svg || GLYPHS[ic.glyph] || GLYPHS.balloon;
  const icon = (cls = 'sicon') => {
    const d = h('div', cls, `<svg viewBox="0 0 100 100" aria-hidden="true">${glyph}</svg>`);
    d.style.setProperty('--c1', ic.cols[0]); d.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
    return d;
  };
  const art = (cls = 'sart') => {
    const d = h('div', cls, `<svg class="g" viewBox="0 0 100 100" aria-hidden="true">${glyph}</svg>`);
    d.style.setProperty('--c1', ic.cols[0]); d.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
    return d;
  };
  return { icon, art, accent: ic.cols[0] };
}


/* The pick made this session ({ id, row }): coming back (from a game, or another page) it's still the one. A fresh start picks the first Featured game. */
let sessionPick = null;
/* Games kept off the home screen for now (still there, just not shown). */
export const HIDDEN = new Set(['uncle-bs-boat', 'dance-party', 'castle-defense']);
/* What was picked last - kept between launches, by game. */
const LAST = 'orlis.lastGame';
let lastFocus = null;
/* the Play page's big banner (cinema) carries over a refresh of the page, not a visit */
let keepCinema = null;
const remembered = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
const remember = (id) => { try { localStorage.setItem(LAST, id); } catch {} };
/* What's been played lately, newest first (Jump back in). */
const RECENT = 'orlis.recent';
export const recent = () => { try { const r = JSON.parse(localStorage.getItem(RECENT)); return Array.isArray(r) ? r : []; } catch { return []; } };
export function played(id){ try { localStorage.setItem(RECENT, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 8))); } catch {} }
/* Featured, when the family's server can't say this week's: these. */
export const FEATURED = ['pop-party', 'sky-painter', 'last-known-position', 'stack-it-high', 'sleepy-bear', 'leaf-pile'];
/* Play's rows: Jump back in (if anything's been played), Featured this week
   (the server's pick from Discover - games to get - else a few from this
   PC, once there are enough to mean something), and All, A-Z. The same
   game can be in more than one. */
export function playRows(pool, lately = recent(), featured = []){
  const byId = new Map(pool.map(g => [g.id, g])), rows = [];
  const back = lately.map(id => byId.get(id)).filter(Boolean).slice(0, 6);
  if (back.length) rows.push({ id: 'back', title: 'Jump back in', games: back });
  if (featured.length) rows.push({ id: 'featured', title: 'Featured this week', games: featured.slice(0, 3) });
  else if (pool.length > 3){
    const feat = [...pool.filter(g => g.store), ...FEATURED.map(id => byId.get(id)).filter(Boolean)];
    rows.push({ id: 'featured', title: 'Featured', games: feat.filter((g, i) => feat.indexOf(g) === i).slice(0, 3) });
  }
  rows.push({ id: 'all', title: 'My games', games: [...pool].sort((a, b) => a.name.localeCompare(b.name)) });
  return rows;
}
const HOVER_FOCUS = 0.05;      /* seconds of a hand on a tile to pick it (the cursor's already sticky) */
const LAUNCH = launch.OPEN;    /* seconds of going in (the tile opening up) */
const POINT_AGAIN = 0.04;      /* how far (of the screen) a hand moves to take over from the remote */
const FLY = 0.7, FLY_STAGGER = 0.05;   /* arriving: each tile's flight, one after another */

/* What Create is, until it's here. */
export const CREATE_SOON = {
  icon: '\u{1F58C}\u{FE0F}', name: 'Create', line: 'Make your own games',
  about: 'Build your own movement games, then play them by moving. Share the ones you like with the family in Discover.'
};

/* nav: { home(), store(), create() } - the tabs in the top bar. */
export function menu({ onPlay, onRecalibrate, onWho, nav = {}, arrive = false, onFresh = null }){
  clearUI();
  const s = screen('tvhome homepage onhero' + (arrive ? ' arrive' : ''));

  /* the top bar, with the tabs */
  const bar = topBar('home', nav, { onWho, onRecalibrate, isBusy: () => !!going });
  s.appendChild(bar.el);
  if (pose.mouse.active && pose.reason !== 'debug') s.appendChild(h('div', 'warnstrip', '⚠ No camera — the mouse is playing'));

  const items = [];
  /* (waiting to be let in: the starter games only) */
  const waiting = account.waiting;
  const pool = GAMES.filter(g => !HIDDEN.has(g.id) && (!waiting || STARTER_GAMES.includes(g.id)));
  /* this week's featured, from Discover: a game already here as itself;
     one to get as a stand-in that knows its Discover entry */
  const featured = waiting ? [] : week.featured().map(e => (library.installed.has(e.id) && GAMES.find(x => x.id === e.id))
    || { id: e.id, name: e.name, accent: (e.icon && e.icon.cols && e.icon.cols[0]) || '#6d5efc', store: { icon: e.icon, blurb: e.blurb, version: e.version, cover: e.cover || '' }, discover: e });
  const ROWS = pool.length ? playRows(pool, recent(), featured) : [];
  /* (one picture and one trailer per game, wherever it shows up) */
  const paints = new Map(), trailers = new Map();
  const entry = (g, shelf) => {
    if (!paints.has(g.id)) paints.set(g.id, poster(g));
    return { kind: 'game', g, shelf, accent: iconOf(g).cols[0], icon: iconOf(g), name: g.name, blurb: BLURB[g.id] || (g.store && g.store.blurb) || '', paint: paints.get(g.id) };
  };
  ROWS.forEach((r, k) => { for (const g of r.games) items.push(entry(g, k)); });

  /* the banner: the game you're on, playing itself, right across the top -
     the same banner as the Store's and Create's */
  const hero = h('section', 'shero');
  const heroPic = document.createElement('canvas'); heroPic.className = 'sheropic shown';
  const hname = h('h1', ''), hblurb = h('p', ''), hmoves = h('div', 'schips');
  /* (no Play button: picking a tile plays it - the banner shows the one you're on) */
  const btns = h('div', 'sbtns');
  const htext = h('div', 'shtext'); htext.append(hname, hblurb, hmoves, btns);
  hero.append(heroPic, h('div', 'shshade'), htext);
  s.appendChild(hero);

  /* no games yet (a new install: they come from the Store) - a way there */
  if (!items.length){
    hname.textContent = 'Get your first game'; hblurb.textContent = 'Pop Party is waiting for you in Discover.';
    if (nav.store) btns.appendChild(onPick(button('Open Discover', 'sbtn play'), () => { sfx.select(); nav.store(); }));
    ambience.start();
    return {
      focus: 0,
      tick(dt){ bar.tick(dt); },
      draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); }
    };
  }

  /* the rows */
  const shelves = h('div', 'shelves'), wrap = h('div', 'shelfwrap');
  shelves.appendChild(wrap); s.appendChild(shelves);
  const rows = [];
  for (let k = 0; k < ROWS.length; k++){
    const list = items.map((it, n) => ({ it, n })).filter(({ it }) => it.shelf === k);
    if (!list.length) continue;
    const sec = h('section', 'shelf');
    const row = h('div', 'shelfrow');
    const head = h('h3', '', ROWS[k].title);
    /* (the Featured row has big tiles, and ends with the Discover tile) */
    if (ROWS[k].id === 'featured') sec.classList.add('fr');
    sec.append(head, row);
    wrap.appendChild(sec);
    rows.push({ sec, row, ns: list.map(({ n }) => n) });
    for (const { it, n } of list) items[n].rowAt = rows.length - 1;
  }
  /* a tile's picture: a still of the game itself, once there is one (else
     its colours and icon) */
  const picture = (pic, g) => { const url = shotOf(g); if (url){ pic.style.backgroundImage = `url(${url})`; pic.classList.add('shot'); pic.closest('.slock')?.classList.add('covered'); } };
  /* a game's card: its art, and its name under it, big enough to read
     from the sofa (no icon - the art says it - and no small print) */
  const gameCard = (it) => {
    const card = button('', 'slock');
    card.style.setProperty('--accent', it.accent);
    const L = looks({ id: it.g.id, icon: it.g.store && it.g.store.icon });
    const pic = L.art('sthumb');
    picture(pic, it.g);
    const meta = h('div', 'smeta', '<div class="stxt"><div class="nm"></div></div>');
    meta.querySelector('.nm').textContent = it.name;
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').replaceWith(meta);
    if (pic.classList.contains('shot')) card.classList.add('covered');
    return { card, pic };
  };
  const cards = items.map((it, n) => {
    const { card, pic } = gameCard(it);
    /* (one from Discover, not on this PC yet) */
    /* (Get is always top right: no title lettering goes there - the 'pop' one is kept short of it) */
    if (it.g.discover) card.insertAdjacentHTML('beforeend', '<span class="getpill">\u2193 Get</span>');
    onPick(card, () => choose(n));
    card.addEventListener('mouseenter', () => { if (!going && !bar.menuOpen) move(n); });
    card.addEventListener('remotefocus', () => move(n));
    rows[it.rowAt].row.appendChild(card);
    return { card, pic, paint: it.paint, hot: 0, it, still: false };
  });
  const extraTile = (glyph, name, fn) => {
    const t = button('', 'slock addtile');
    t.insertBefore(h('div', 'sthumb', `<span class="plus">${glyph}</span>`), t.firstChild);
    t.querySelector('.lbl').replaceWith(h('div', 'smeta', `<div class="stxt"><div class="nm">${name}</div></div>`));
    onPick(t, () => { if (going) return; sfx.select(); fn(); });
    /* (reached with the remote or keys: the row slides to show it, and the games lose their highlight) */
    t.addEventListener('remotefocus', () => { cards.forEach(c => c.card.classList.remove('focus')); slideRow(t); });
    return t;
  };
  /* the end of Featured: the Discover tile - the rest of Discover, with how many are new this week (or to get) */
  const fi = ROWS.findIndex(r => r.id === 'featured');
  if (fi >= 0 && nav.store){
    const fr = rows.find(r => r.ns.length && items[r.ns[0]].shelf === fi);
    if (fr){
      const t = extraTile('', 'Discover', () => nav.store());
      t.classList.add('discovertile', 'pictile', 'covered');
      const th = t.querySelector('.sthumb'); th.innerHTML = '';
      const pic = discoverCoverUrl(); if (pic) th.style.backgroundImage = `url(${pic})`;
      const games = (week.store && week.store.games) || [];
      const toGet = games.filter(g => !library.installed.has(g.id));
      const fresh = toGet.filter(g => g.added && Date.now() - Date.parse(g.added) < 7 * 864e5).length;
      const chip = fresh ? `${fresh} new this week` : toGet.length ? `${toGet.length} to get` : '';
      if (chip) th.appendChild(h('span', 'newchip', chip));
      fr.row.appendChild(t);
    }
  }
  /* the end of My games: every game at once - a tile drawn like the covers */
  if (rows.length){
    const seeAll = extraTile('', 'See all', () => allGames());
    seeAll.classList.add('pictile', 'covered');
    const th = seeAll.querySelector('.sthumb'); th.innerHTML = '';
    const pic = seeAllCoverUrl(); if (pic) th.style.backgroundImage = `url(${pic})`;
    rows[rows.length - 1].row.appendChild(seeAll);
  }

  /* Under construction: the games asked for and not here yet - at the very end, out of the way
     (nothing to do about one while it's being made, so nothing to pick, and no stop on the way down) */
  let tail = null;
  const made = !waiting && rows.length ? week.building() : [];
  if (made.length){
    tail = h('section', 'shelf building');
    const trow = h('div', 'shelfrow');
    tail.append(h('h3', '', 'Under construction'), trow);
    const STATE = { waiting: ['In line', 15], making: ['Building…', 55], made: ['Waiting for OK', 90], ready: ['Waiting for OK', 90], declined: ['Not this time', 0] };
    for (const x of made){
      const [label, pct] = STATE[x.state] || ['Building…', 50];
      const recipe = x.recipe || {};
      const name = (recipe.name || '').trim() || (x.game && x.game.name) || 'Your game';
      const t = button('', 'slock pictile covered buildingtile ' + x.state);
      const th = h('div', 'sthumb');
      const pic = buildingCoverUrl({ name, cols: looksOf(recipe).cols, label, pct }); if (pic) th.style.backgroundImage = `url(${pic})`;
      t.insertBefore(th, t.firstChild);
      t.querySelector('.lbl').replaceWith(h('div', 'smeta', ''));
      t.setAttribute('aria-label', `${name}: ${label}`);
      if (x.state === 'declined' && x.note) onPick(t, () => { sfx.select(); toast(`${name}: “${x.note}”`, { ms: 6000 }); });
      t.tabIndex = -1;
      trow.appendChild(t);
    }
    wrap.appendChild(tail);
  }

  /* this week's family challenges: three big cards on arriving (once each time the
     app starts), then a pill in the top bar (challenges.js) */
  const ch = week.challenges;
  let holdArrive = false;
  if (!waiting && ch && ch.challenges && ch.challenges.length && splashWanted()){
    /* (up at once, over a plain page: no glimpse of Play first; the tiles fly in as the cards leave) */
    holdArrive = true;
    showChallenges(ch, { auto: true, first: true, from: bar.pill, onLeave: () => { holdArrive = false; } });
  }

  /* All games: a grid of every game, with a filter along the top */
  function allGames(){
    const g = screen('dim allgames');
    const grid = h('div', 'allgrid'), chips = h('div', 'allchips');
    const close = onPick(button('←', 'cardicon close allback'), () => { sfx.back?.(); g.remove(); remote.mark(cards[focus].card); });
    close.title = 'Back'; close.setAttribute('aria-label', 'Back');
    g.append(h('div', 'allhead'), chips, grid);
    g.firstChild.append(close, h('h2', '', 'My games'));
    const allRow = ROWS.length - 1;
    const sets = [['All', ROWS[allRow].games], ...ROWS.slice(0, allRow).map(r => [r.title, r.games])];
    const fill = (k) => {
      [...chips.children].forEach((c, i) => c.classList.toggle('on', i === k));
      grid.innerHTML = '';
      for (const game of sets[k][1]){
        const n = items.findIndex(x => x.shelf === allRow && x.g === game);
        const { card } = gameCard(items[n]);
        onPick(card, () => { g.remove(); choose(n); });
        grid.appendChild(card);
      }
    };
    sets.forEach(([t], k) => chips.appendChild(onPick(button(t, 'allchip'), () => { sfx.select?.(); fill(k); })));
    fill(0);
  }
  /* (which build this is: in the Beta, and while it's being made - not in
     the released app) */
  const beta = typeof window === 'undefined' || !window.ORLIS_LABEL || window.ORLIS_LABEL.beta;
  if (beta) s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  let scrollY = 0;
  /* (by game, not place: the rows change as games are played) */
  const rowOf = (it) => (ROWS[it.shelf] || {}).id;
  const fromSession = sessionPick ? items.findIndex(it => it.g.id === sessionPick.id && rowOf(it) === sessionPick.row) : -1;
  const firstFeatured = items.findIndex(it => rowOf(it) === 'featured');
  lastFocus = fromSession >= 0 ? fromSession : firstFeatured >= 0 ? firstFeatured : Math.max(0, items.findIndex(it => it.g.id === remembered()));
  let focus = Math.min(lastFocus, items.length - 1), t = 0, going = null, flown = !arrive;
  /* After the remote's used, pointing takes over again only once a hand (or
     the mouse) actually moves - not because the rows slid under one that's
     resting. */
  let keySeen = remote.lastKey, anchor = null;
  /* Cinema: on arriving, the banner is a trailer filling most of the screen, with just the row of the
     picked game along the bottom. Moving about shrinks it to the usual size (the rows come up); stay
     on one game a little while and it grows back. */
  const CINEMA_AFTER = 7;       /* seconds of nothing, and the big banner returns */
  const MOVED_ENOUGH = 0.22;    /* how far a hand or the mouse travels (screen widths) before it counts as moving about */
  let cinema = ROWS.some(r => r.id === 'featured') && (keepCinema === null ? true : keepCinema);
  keepCinema = null;
  let idleT = 0, motion = 0, ringsAt = null;
  s.classList.toggle('cinema', cinema);
  const setCinema = (on) => { if (cinema === on) return; cinema = on; s.classList.toggle('cinema', on); idleT = 0; motion = 0; show(); };
  const stir = () => { idleT = 0; };
  s.addEventListener('pointerdown', stir); addEventListener('keydown', stir, true);

  function show(){
    const it = items[focus];
    cards.forEach(({ card }, n) => card.classList.toggle('focus', n === focus));
    remote.mark(cards[focus].card);
    hero.style.setProperty('--accent', it.accent);
    hname.textContent = it.name; hblurb.textContent = it.blurb;
    hmoves.innerHTML = `<span class="schip">${howMany(it.g)}</span>`;
    /* keep the row in view, and the tile along it */
    const r = rows[it.rowAt];
    /* (up only as far as it takes to see the whole row - with everything on
       screen, not at all) */
    const top = r.sec.offsetTop - rows[0].sec.offsetTop, bottom = (tail && it.rowAt === rows.length - 1 ? tail.offsetTop + tail.offsetHeight : r.sec.offsetTop + r.sec.offsetHeight) - rows[0].sec.offsetTop, view = shelves.clientHeight - rows[0].sec.offsetTop;
    /* (in cinema the row is all there is down there: its top at the shelves' top) */
    if (cinema) scrollY = top;
    else if (top < scrollY) scrollY = top;
    else if (bottom > scrollY + view) scrollY = Math.min(top, bottom - view);
    wrap.style.transform = `translateY(${-scrollY}px)`;
    slideRow(cards[focus].card);
  }
  /* slide a row along so the tile (and a little past it) is in view */
  function slideRow(tile){
    const row = tile.closest('.shelfrow'); if (!row) return;
    const over = tile.offsetLeft + tile.offsetWidth - row.clientWidth + tile.offsetWidth * 0.3;
    row.style.transform = `translateX(${-Math.max(0, over)}px)`;
  }
  function move(to){
    to = Math.max(0, Math.min(items.length - 1, to));
    if (to === focus) return;
    stir(); if (cinema) setCinema(false);
    focus = to; lastFocus = to; remember(items[to].g.id); sessionPick = { id: items[to].g.id, row: (ROWS[items[to].shelf] || {}).id }; sfx.nav(); ambience.lift(); show();
  }
  /* A pick goes straight in - one from Discover is got first. */
  let getting = false;
  async function choose(n){
    if (going || getting || bar.menuOpen) return;
    move(n);
    sfx.select();
    let g = items[n].g;
    if (g.discover){
      getting = true; cards[n].card.classList.add('getting');
      toast(`Getting ${g.name}\u2026`);
      try { g = await library.install(g.discover); sfx.gold?.(); }
      catch (e){ getting = false; cards[n].card.classList.remove('getting'); toast(e.message || 'That didn\u2019t download. Try again.', { bad: true }); return; }
      getting = false;
    }
    going = { t: 0, g };
    /* the tile opens up to fill the screen (its cover, title and all) and stays while the game gets ready */
    const th = cards[n].card.querySelector('.sthumb') || cards[n].card;
    launch.begin({ rect: th.getBoundingClientRect(), url: shotOf(g) || (items[n].g === g ? shotOf(items[n].g) : null), accent: items[n].accent, name: g.name });
  }
  show();
  ambience.start();
  /* this week's featured and challenges, fresh from the server (shown
     again if they changed - not mid-pick) */
  if (onFresh) week.refresh().then(changed => { if (changed && !going && !getting && !holdArrive){ keepCinema = cinema; onFresh(); } }, () => {});
  /* the pictures still to make (one at a time, between frames) */
  const pictured = (g) => cards.forEach(c => { if (c.it.g.id === g.id) picture(c.pic, g); });
  const stopShots = makeShots([...new Map(items.map(it => [it.g.id, it.g])).values()], pictured);
  let onBanner = 0;

  return {
    leave(){ stopShots(); },
    get focus(){ return focus; },
    tick(dt){
      if (!holdArrive) t += dt;
      /* arriving: each tile flies out from the middle of the screen, where the cube was */
      if (!flown){
        flown = true;
        const cx = innerWidth / 2, cy = innerHeight * 0.42;
        cards.forEach(({ card }, n) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--fx', `${cx - (r.left + r.width / 2)}px`);
          card.style.setProperty('--fy', `${cy - (r.top + r.height / 2)}px`);
          card.style.setProperty('--fr', `${((n * 1.3 + 0.5) % 3) - 1.5}rad`);
          card.style.animationDelay = `${n * FLY_STAGGER}s`;
          card.classList.add('fly');
        });
        setTimeout(() => cards.forEach(({ card }) => card.classList.remove('fly')), (FLY + items.length * FLY_STAGGER) * 1000 + 100);
      }
      if (remote.lastKey !== keySeen){ keySeen = remote.lastKey; anchor = cursor.rings.map(r => [r.x, r.y]); }
      if (anchor && (cursor.rings.length !== anchor.length || cursor.rings.some((r, i) => Math.hypot(r.x - anchor[i][0], r.y - anchor[i][1]) > POINT_AGAIN))) anchor = null;
      /* The tile pointed at is the picked one. */
      if (!anchor && !bar.menuOpen) for (let n = 0; n < cards.length; n++){
        const cd = cards[n];
        cd.hot = cd.card.classList.contains('hot') && n !== focus ? cd.hot + dt : 0;
        if (cd.hot >= HOVER_FOCUS){ cd.hot = 0; move(n); }
      }
      bar.tick(dt);
      /* cinema: moving about (a hand, the mouse) shrinks the banner; a while of nothing brings it back */
      const rings = cursor.rings.map(r => [r.x, r.y]);
      if (ringsAt && rings.length === ringsAt.length){
        const d = rings.reduce((a, r, i) => a + Math.hypot(r[0] - ringsAt[i][0], r[1] - ringsAt[i][1]), 0);
        if (d > 3){ idleT = 0; if (cinema){ motion += d / innerWidth; if (motion > MOVED_ENOUGH) setCinema(false); } }
      }
      ringsAt = rings;
      if (!going && !getting && !holdArrive && !bar.menuOpen && !document.querySelector('.dim')){
        idleT += dt;
        if (!cinema && idleT > CINEMA_AFTER && ROWS.some(r => r.id === 'featured')) setCinema(true);
      } else idleT = 0;
      /* a downloaded game's picture: from its banner, once it's been playing a moment */
      onBanner = items[focus] && items[focus].trailer ? onBanner + dt : 0;
      const on = items[focus];
      if (onBanner > 2.5 && (on.g.sandboxed || on.g.discover) && !shotOf(on.g)){
        /* (the whole frame, not the banner's slice of it) */
        const film = document.createElement('canvas'); film.width = 1440; film.height = 810;
        try { on.trailer.draw(film.getContext('2d'), 1440, 810); } catch (e){}
        if (keepShot(on.g, film)) pictured(on.g);
      }
      /* the banner's trailer: the picked game, playing itself */
      const it = items[focus];
      if (it.trailer === undefined){
        /* (one from Discover: its preview, fetched once, while its art shows) */
        if (it.g.discover){
          if (!trailers.has(it.g.id)){ trailers.set(it.g.id, null); library.preview(it.g.discover).then(game => trailers.set(it.g.id, trailer(game) || null), () => {}); }
          if (trailers.get(it.g.id)) it.trailer = trailers.get(it.g.id);
        } else { if (!trailers.has(it.g.id)) trailers.set(it.g.id, trailer(it.g)); it.trailer = trailers.get(it.g.id); }
      }
      if (it.trailer && !going){
        it.trailer.step(Math.min(dt, 1 / 20), TW, TH);
      }
      if (going){
        going.t += dt;
        if (going.t >= LAUNCH){ ambience.stop(); const g = going.g; going = null; onPlay(g); }
      }
    },
    draw(c, W, H){
      /* the room: plain paper, like the Store's and Create's */
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      /* the banner's living picture; the tiles' still ones */
      const it = items[focus];
      if (it.trailer) paint(heroPic, (c, w, hh) => cover(c, w, hh, it.trailer), t, 1);
      else {
        /* no trailer: the game's still, else its poster */
        const wide = wideBanner(it.g);
        const im = wide ? null : shotImage(it.g);
        paint(heroPic, wide ? wide : im ? (c, w, hh) => { const k = Math.max(w / im.width, hh / im.height); c.drawImage(im, (w - im.width * k) / 2, (hh - im.height * k) * 0.4, im.width * k, im.height * k); } : it.paint, t);
      }
    }
  };
}

/* How many can play: '1-4 players', or just the one number. */
export function howMany(g){
  const lo = Math.min(g.minPlayers || 1, pose.cap), hi = Math.min(g.maxPlayers || MAX_PLAYERS, pose.cap);
  return lo === hi ? `${hi} player${hi > 1 ? 's' : ''}` : `${lo}\u2013${hi} players`;
}

/* The trailer plays at TV shape, TW x TH, and the banner shows the part of
   it the trailer says (anchor: how far down the middle of the view sits). */
const TW = 1440, TH = 810;
let film = null;
export function cover(c, w, h, tr){
  if (!film){ film = document.createElement('canvas'); film.width = TW; film.height = TH; }
  const fc = film.getContext && film.getContext('2d'); if (!fc) return;
  fc.setTransform(1, 0, 0, 1, 0, 0);
  tr.draw(fc, TW, TH);
  const k = w / TW, sh = Math.min(TH, h / k), sy = Math.max(0, Math.min(TH - sh, TH * (tr.anchor ?? 0.5) - sh / 2));
  c.drawImage(film, 0, sy, TW, sh, 0, 0, w, h);
}

/* A picture on its own small canvas, sized to it as laid out. */
export function paint(pic, fn, t, sharp = 2){
  if (!pic.getContext || !pic.getBoundingClientRect) return false;
  const w0 = pic.offsetWidth || pic.getBoundingClientRect().width, h0 = pic.offsetHeight || pic.getBoundingClientRect().height;
  if (!w0) return false;
  const k = Math.min(sharp, devicePixelRatio || 1);
  const w = Math.round(w0 * k), hgt = Math.round(h0 * k);
  if (pic.width !== w || pic.height !== hgt){ pic.width = w; pic.height = hgt; }
  const c = pic.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  fn(c, w0, h0, t);
  return true;
}

function overlay(){
  const s = screen('dim');
  s.style.zIndex = 5;
  return s;
}

export { settings as openSettings };

function settings(onRecalibrate){
  const s = overlay(); s.classList.add('setscreen');
  const card = h('div', 'setcard');
  const close = () => { sfx.back?.(); s.remove(); };
  const head = h('div', 'sethead');
  head.append(h('h2', '', 'Settings'), onPick(button('✕', 'setclose'), close));
  card.appendChild(head);
  /* one setting a row: its name on the left, its control on the right */
  const row = (name, ...ctl) => {
    const r = h('div', 'setrow');
    const c = h('div', 'setctl'); c.append(...ctl);
    r.append(h('span', 'setname', name), c);
    card.appendChild(r);
    return c;
  };
  const small = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);

  /* sound */
  const sl = document.createElement('input');
  sl.type = 'range'; sl.min = 0; sl.max = 1; sl.step = 0.05; sl.value = audio.volume; sl.className = 'setslider';
  sl.addEventListener('input', () => audio.setVolume(+sl.value));
  /* the speaker beside the bar is the mute: crossed out when it's off */
  const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/>';
  const speakerIcon = (muted) => SPEAKER + (muted ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>') + '</svg>';
  const mute = small(speakerIcon(audio.muted), () => {
    const m = audio.toggleMute();
    mute.querySelector('.lbl').innerHTML = speakerIcon(m);
    mute.setAttribute('aria-label', m ? 'Unmute' : 'Mute'); sl.classList.toggle('off', m);
  }, 'spk');
  mute.title = 'Mute'; mute.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute'); sl.classList.toggle('off', audio.muted);
  row('Volume', mute, sl);

  /* a newer version (the Windows app): picked once it checks, picked again it installs and restarts on it */
  const appInfo = typeof window !== 'undefined' && window.orlisApp;
  if (appInfo){
    let next = null, busy = false;
    const up = small('Check for updates', async () => {
      if (busy) return;
      const say = (t) => { up.querySelector('.lbl').textContent = t; };
      busy = true; sfx.select();
      try {
        if (next){ say('Updating…'); await appInfo.installUpdate(); }
        else {
          say('Checking…');
          const r = await appInfo.checkUpdate();
          if (r.available){ next = r.version; say(`Update to ${appInfo.nameOf ? appInfo.nameOf(next) : next}`); }
          else say('Up to date');
        }
      } catch (e){ next = null; say('Couldn\'t check - try later'); }
      busy = false;
    });
    row('Updates', up, h('span', 'keyhint', `Orlis Play ${appInfo.label ? appInfo.label() : appInfo.version}`));
  }

  /* the screen: in the Windows app, a window or Big Picture (full screen,
     for the TV), kept for next time; in a browser, its own full screen */
  const display = typeof window !== 'undefined' && window.orlisDisplay;
  if (display){
    const seg = h('div', 'seg');
    const modes = [['window', 'Window'], ['bigpicture', 'Big Picture']];
    const mark = () => modes.forEach(([m], i) => seg.children[i].classList.toggle('chosen', display.mode === m));
    for (const [m, name] of modes){
      seg.appendChild(small(name, async () => {
        if (display.mode === m) return;
        sfx.select();
        try { await display.set(m); } catch (e) {}
        mark();
      }, 'mode'));
    }
    mark();
    row('Display', seg, h('span', 'keyhint', 'F11'));
  } else row('Display', small('Full screen', () => toggleFullscreen()));

  /* the camera: which one (when there's a choice), and finding everyone again */
  const camCtl = row('Camera', small('Re-calibrate', () => { s.remove(); onRecalibrate(); }));
  /* the camera's cost: a sharper picture, or tracking off the main thread */
  if (pose.reason !== 'debug'){
    const flag = (key, label, on, off, note) => {
      const get = () => { try { return localStorage.getItem(key) === '1'; } catch (e){ return false; } };
      const b = small(get() ? on : off, () => {
        const v = !get();
        try { localStorage.setItem(key, v ? '1' : '0'); } catch (e){}
        b.querySelector('.lbl').textContent = v ? on : off;
        b.classList.toggle('chosen', v);
      }, 'mode');
      b.classList.toggle('chosen', get());
      row(label, b, h('span', 'keyhint', note));
    };
    flag('orlis_camsharp', 'Camera detail', 'Sharper', 'Standard', 'next game');
    flag('orlis_trackworker', 'Smoother tracking', 'On', 'Off', 'experimental · next game');
  }
  if (pose.reason !== 'debug'){
    pose.cameras().then(list => {
      if (list.length < 2) return;
      const seg = h('div', 'seg');
      list.forEach(cam => {
        const b = small(cam.label.slice(0, 24), async () => {
          b.querySelector('.lbl').textContent = 'Switching…';
          try { await pose.use(cam.id); seg.querySelectorAll('.chosen').forEach(x => x.classList.remove('chosen')); b.classList.add('chosen'); b.querySelector('.lbl').textContent = cam.label.slice(0, 24); }
          catch (e){ b.querySelector('.lbl').textContent = 'Couldn\'t open it'; }
        }, 'mode');
        b.classList.toggle('chosen', cam.id === pose.activeId);
        seg.appendChild(b);
      });
      camCtl.prepend(seg);
    });
  }

  s.appendChild(card);
  /* a click outside the card closes it */
  s.addEventListener('pointerdown', (e) => { if (e.target === s) close(); });
}

export function toggleFullscreen(){
  /* the Windows app: Big Picture (the whole window full screen, no title
     bar) and back to a window - never the page alone, which left the window
     and its title bar as they were */
  if (typeof window !== 'undefined' && window.orlisDisplay){
    window.orlisDisplay.set(window.ORLIS_DISPLAY === 'bigpicture' ? 'window' : 'bigpicture').catch?.(() => {});
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
