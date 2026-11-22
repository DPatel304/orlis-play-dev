/* The pad page (plan package P3; protocol: docs/specs/pad-protocol.md; screens: docs/pads-mockup.html).
   Opening -> pictures (a new phone) -> who are you -> you're in -> "I'm ready" -> the game's pad program (or "Look at the TV!").
   A phone that has joined before comes straight back with its device token. Plain modules, no framework. */
import '../src/ui/paper-cut.js';   /* (the character's paper-cut edge; see avatar-art.js) */
import { createLink, CLOSE } from './link.js';
import { keepAwake } from './awake.js';
import { paintPicture, paintCubo, paintPerson, personColour, hasGL } from './art.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const WAIT_MS = Math.max(200, Math.min(60000, Number(params.get('waitms')) || 60000));

/* ---------- what the phone remembers (a conveniences only: the page works without it) ---------- */
const mem = {
  get(k) { try { return localStorage.getItem('orlis.pad.' + k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('orlis.pad.' + k); else localStorage.setItem('orlis.pad.' + k, v); } catch { /* private window */ } }
};
const readMe = () => { try { const o = JSON.parse(mem.get('me')); return o && typeof o.id === 'string' ? o : null; } catch { return null; } };

const S = {
  phase: 'join',            /* join -> ready (the "You're in" screen) -> play (after "I'm ready") */
  device: mem.get('device') || null,
  me: readMe(),             /* { id, name, avatar } */
  people: [], welcome: null,
  picks: [], locked: false, grid: [],
  joined: false,            /* we have been welcomed in this page's life */
  picked: false,            /* picked who we are since the last hello (so: "Hi", not "Welcome back") */
  changing: false, terminal: null, seq: 0,
  program: null, lastState: null, stateFns: [], eventFns: [], waitTimer: 0, wiggleTimer: 0
};

/* ---------- tiny DOM helpers ---------- */
function el(tag, cls, kids) {
  const e = document.createElement(tag); if (cls) e.className = cls;
  for (const k of [].concat(kids == null ? [] : kids)) e.append(k);
  return e;
}
const canvas = (cls) => { const c = document.createElement('canvas'); if (cls) c.className = cls; return c; };
/* paint after the element is in the page (so it can size itself from its box) */
const later = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

function show(name, node) {
  clearTimeout(S.waitTimer); clearTimeout(S.wiggleTimer);
  app.replaceChildren(node);
  document.body.dataset.screen = name;
  return node;
}

function message(name, art, title, sub, extra) {
  const cv = canvas(art.twirl ? 'twirl' : '');
  const node = el('div', 'screen', el('div', 'msg', [cv, el('h5', '', title.split('\n').flatMap((t, i) => i ? [document.createElement('br'), t] : [t])), sub ? el('p', 'sm', sub) : null, extra].filter(Boolean)));
  show(name, node);
  later(() => { if (art.cubo) paintCubo(cv, { pose: art.cubo }); else paintPicture(cv, art.id); });
  return node;
}
const dots = () => el('span', 'dots', [el('i'), el('i'), el('i')]);

/* ---------- the screens ---------- */
const showOpening = () => message('opening', { cubo: 'freeze', twirl: true }, 'Finding the TV');
const showStart = () => message('start', { id: 'house' }, 'Start Orlis\non the TV', "We'll join when it's on", dots());
const showFull = () => message('full', { id: 'tent' }, 'This game\nis full', 'Wait for the next one');
const showNoPhones = () => message('nophones', { id: 'tent' }, "This game doesn't\nuse phones", 'Look at the TV!');
const showVersion = () => message('version', { id: 'rocket' }, 'Orlis got\nan update', 'Getting it now');

function showWait() {
  const bar = el('i');
  const node = message('wait', { id: 'sun' }, "Let's wait\na moment", 'Then try the pictures again', el('div', 'ringbar', bar));
  later(() => { bar.style.transitionDuration = WAIT_MS + 'ms'; bar.style.width = '100%'; });
  S.waitTimer = setTimeout(() => { S.picks = []; S.locked = false; hello(); }, WAIT_MS);
  return node;
}

function showPics() {
  S.locked = false;
  const slots = el('div', 'picked'), grid = el('div', 'grid9');
  const node = el('div', 'screen', [el('h4', '', ['Tap the three', document.createElement('br'), 'on the TV']), slots, grid]);
  show('pics', node);
  const draw = () => {
    slots.replaceChildren(...[0, 1, 2].map(i => {
      const id = S.picks[i];
      const b = el('button', 'slot' + (id ? ' full' : ''));
      b.type = 'button'; b.setAttribute('aria-label', id ? 'Take back ' + id : 'empty');
      b.dataset.slot = i;
      if (id) { const cv = canvas(); b.append(cv); later(() => paintPicture(cv, id, 90)); b.onclick = () => { if (S.locked) return; S.picks.splice(i, 1); draw(); }; }
      return b;
    }));
    for (const c of grid.children) c.classList.toggle('used', S.picks.includes(c.dataset.id));
    grid.classList.toggle('dimmed', S.locked);
  };
  for (const id of S.grid) {
    const b = el('button', 'cell'), cv = canvas();
    b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-label', id); b.append(cv);
    b.onclick = () => {
      if (S.locked || S.picks.length >= 3 || S.picks.includes(id)) return;
      S.picks.push(id); draw();
      if (S.picks.length === 3) { S.locked = true; draw(); hello([...S.picks]); }
    };
    grid.append(b);
    later(() => paintPicture(cv, id, 150));
  }
  draw();
  S.redrawPics = draw;
  return node;
}

/* wrong pictures: the slots wiggle, then empty after a second. No red. */
function wrongPictures() {
  const node = document.querySelector('.screen');
  if (!node || document.body.dataset.screen !== 'pics') { showPics(); }
  const h = document.querySelector('.screen h4'); if (h) h.replaceChildren('Not quite.', document.createElement('br'), 'Look again!');
  document.querySelector('.picked').classList.add('shake');
  S.locked = true; S.redrawPics && S.redrawPics();
  clearTimeout(S.wiggleTimer);
  S.wiggleTimer = setTimeout(() => {
    S.picks = []; S.locked = false;
    const hh = document.querySelector('.screen h4'); if (hh) hh.replaceChildren('Tap the three', document.createElement('br'), 'on the TV');
    const p = document.querySelector('.picked'); if (p) p.classList.remove('shake');
    S.redrawPics && S.redrawPics();
  }, 1000);
}

function showPeople(people) {
  S.people = people;
  const grid = el('div', 'people');
  const node = el('div', 'screen', [el('h4', '', 'Who are you?'), grid]);
  show('people', node);
  people.forEach((p, i) => {
    const b = el('button', 'person'), cv = canvas();
    b.type = 'button'; b.dataset.who = p.id; b.style.setProperty('--c', personColour(p, i));
    b.append(cv, p.name || p.id);
    b.onclick = () => { b.classList.add('chosen'); S.picked = true; S.me = { id: p.id, name: p.name || p.id, avatar: p.avatar || null }; link.send({ t: 'pick', who: p.id }); };
    grid.append(b);
    later(() => paintPerson(cv, p, 160));
  });
}

const cap = (s) => String(s || '').slice(0, 1).toUpperCase() + String(s || '').slice(1);

function showReady() {
  const m = S.welcome, me = S.me || { id: m.who, name: cap(m.who), avatar: null };
  const name = me.name || cap(me.id), back = !S.picked;
  const cv = canvas();
  const kids = [el('div', 'me', cv), el('h5', '', back ? ['Welcome back,', document.createElement('br'), name + '!'] : 'Hi ' + name + '!')];
  if (!back) kids.push(el('p', 'sm', "You're in"));
  const go = el('button', 'go', "I'm ready"); go.type = 'button'; go.dataset.act = 'ready';
  const change = el('button', 'change'); change.type = 'button'; change.dataset.act = 'change';
  change.append(me.id === 'guest' ? 'Not you? ' : 'Not ' + name + '? ', el('u', '', 'Change'));
  kids.push(el('div', 'grow'), go, change);
  const node = el('div', 'screen ready', kids);
  node.style.setProperty('--c', m.colour || personColour(me));
  show('ready', node);
  later(() => paintPerson(cv, me, 220));
  go.onclick = imReady;
  change.onclick = () => { S.changing = true; link.send({ t: 'who?' }); };
}

function imReady() {
  keepAwake();                       /* inside the tap: fullscreen where allowed, and the muted looping video */
  link.send({ t: 'ready' });
  S.phase = 'play';
  showPlay();
}

/* ---------- the game's pad program ---------- */
function showPlay() {
  const m = S.welcome, me = S.me || { id: m.who, name: cap(m.who) };
  const cv = canvas();
  const look = el('div', 'look', [el('div', 'me', cv), el('h5', '', 'Look at the TV!')]);
  look.style.setProperty('--c', m.colour || personColour(me));
  const root = el('div', 'padroot'); root.hidden = true;
  show('play', el('div', 'screen play', [look, root]));
  later(() => paintPerson(cv, me, 200));
  mountProgram(m, root, look);
}

function resolvePad(url) {
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return null;          /* a pad program comes from the Box, never from elsewhere */
    if (u.pathname.endsWith('/')) u.pathname += 'pad.js';
    return u.href;
  } catch { return null; }
}

async function mountProgram(m, root, look) {
  S.stateFns = []; S.eventFns = []; S.lastState = null;
  if (!m.pad) return;
  const href = resolvePad(m.pad); if (!href) return;
  try {
    const mod = await import(/* @vite-ignore */ href);
    const start = mod.default || mod.start || mod.mount;
    if (typeof start !== 'function') return;
    const api = {
      seat: m.seat, colour: m.colour, who: S.me, game: m.game, need: m.need, root,
      send: (o) => link.send({ t: 'in', seq: ++S.seq, ...o }),
      onState: (fn) => { S.stateFns.push(fn); if (S.lastState) fn(S.lastState); },
      onEvent: (fn) => { S.eventFns.push(fn); },
      rtt: () => link.rtt, connected: () => link.open
    };
    if (S.phase !== 'play') return;
    root.hidden = false; look.hidden = true;
    S.program = await start(api) || true;
    document.body.dataset.program = 'on';
  } catch (e) {
    root.hidden = true; look.hidden = false; root.replaceChildren();
    document.body.dataset.program = 'failed';
    console.warn('pad program failed', e);
  }
}

/* ---------- "Joining again" ---------- */
let overlay = null;
function setRejoining(on) {
  document.body.dataset.link = on ? 'rejoining' : 'ok';
  if (on && !overlay && S.joined) {
    const cv = canvas();
    overlay = [el('div', 'grey'), el('div', 'pill', [cv, 'Joining again'])];
    document.body.append(...overlay);
    later(() => paintCubo(cv, { pose: 'freeze', px: 34 }));
  } else if (!on && overlay) { overlay.forEach(n => n.remove()); overlay = null; }
}

/* ---------- talking to the hub ---------- */
function hello(join = null) {
  S.picked = false;
  link.send({ t: 'hello', v: 1, device: S.device, join, screen: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 }, gl: hasGL() });
}

function resetToJoin() {
  S.phase = 'join'; S.joined = false; S.program = null; S.picks = []; S.locked = false;
  setRejoining(false);
}

function onMessage(m) {
  if (!m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'pics?':
      setRejoining(false); S.terminal = null; S.grid = Array.isArray(m.grid) ? m.grid.slice(0, 9) : []; S.picks = []; showPics(); break;
    case 'who?':
      setRejoining(false); showPeople(Array.isArray(m.people) ? m.people : []); break;
    case 'welcome': {
      setRejoining(false); S.terminal = null;
      S.device = m.device; mem.set('device', m.device);
      S.welcome = m; S.joined = true;
      const known = S.people.find(p => p.id === m.who) || (S.me && S.me.id === m.who ? S.me : null);
      S.me = known ? { id: known.id, name: known.name || cap(known.id), avatar: known.avatar || null } : { id: m.who, name: m.name || cap(m.who), avatar: null };
      mem.set('me', JSON.stringify(S.me));
      if (S.phase === 'play' && !S.changing) break;         /* rejoined in the game: same seat, nothing to redraw */
      S.changing = false; S.phase = 'ready'; showReady();
      break;
    }
    case 'reject':
      setRejoining(false);
      if (m.why === 'join') wrongPictures();
      else if (m.why === 'wait') showWait();
      else if (m.why === 'full') { S.terminal = 'full'; showFull(); link.slow(8000); }
      else if (m.why === 'version') {
        S.terminal = 'version'; showVersion();
        let last = 0; try { last = Number(sessionStorage.getItem('orlis.pad.reload')) || 0; sessionStorage.setItem('orlis.pad.reload', String(Date.now())); } catch { /* fine */ }
        if (Date.now() - last > 15000) setTimeout(() => location.reload(), 1500);
      }
      else if (m.why === 'game') { S.terminal = 'game'; showNoPhones(); }
      break;
    case 'state': S.lastState = m; S.stateFns.forEach(f => { try { f(m); } catch { /* the pad program's problem */ } }); break;
    case 'ev': case 'pause': case 'resume':
      { const e = m.t === 'ev' ? m : { ...m, e: m.t }; S.eventFns.forEach(f => { try { f(e); } catch { /* ditto */ } }); }
      break;
    default: break;     /* pong is handled by the link */
  }
}

function onClose({ code }) {
  if (S.terminal === 'game' || S.terminal === 'version') return;
  if (code === CLOSE.noGame) { resetToJoin(); S.terminal = null; showStart(); return; }
  if (code === CLOSE.full) { S.terminal = 'full'; showFull(); link.slow(8000); return; }
  if (S.joined && S.phase !== 'join') { setRejoining(true); return; }       /* mid-game drop: keep the screen, grey it, rejoin by itself */
  if (S.terminal === 'full') return;
  if (!['start', 'wait'].includes(document.body.dataset.screen)) showOpening();
}

const link = createLink({
  url: () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=pad`,
  onOpen: () => hello(), onMessage, onClose
});

document.body.dataset.link = 'ok';
showOpening();
link.start();
