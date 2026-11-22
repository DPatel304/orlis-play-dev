/* The host session (plan package P4; spec docs/specs/session.md; decisions 0027, 0028, 0032, 0042).
   Pure logic: no DOM, no WebSocket. It is fed hub events (open, close, message) and calls `send(to, m)` / `send.close(to)`.
   Clock, rng, storage (through the trust store) and transport are all injected, so it is unit-tested with fakes. */
import { PALETTE } from '../games/assets/palette.js';

/* The pictures a join can use: asset ids that both the TV card and the pad page can draw. */
export const PICTURE_POOL = ['balloon', 'cat', 'star', 'sun', 'fish', 'tree', 'moon', 'house', 'kite', 'tent', 'bear', 'rocket'];
export const MAX_WRONG = 5;          /* wrong picture tries before a wait */
export const WAIT_MS = 60000;        /* how long new phones wait after that */
export const OFFER_END_MS = 120000;  /* paused this long: the TV offers to end the round */

const FAVS = Object.keys(PALETTE.fav);

/* Until the avatar work lands (U8): the person's favourite if free, else the first free favourite, else their favourite anyway.
   `who` is { id, name, avatar, favourite }; `taken` is the list of fav names already in use. */
export function defaultColourFor(who, taken) {
  const fav = who && who.favourite && FAVS.includes(who.favourite) ? who.favourite : null;
  if (fav && !taken.includes(fav)) return fav;
  return FAVS.find(f => !taken.includes(f)) || fav || FAVS[0];
}

function randomToken() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createSession({ game, people, trust, send, colourFor = defaultColourFor, now = Date.now, rng = Math.random,
  newToken = randomToken, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const padRange = (game && game.seats && game.seats.pads) || [0, 0];
  const trackedRange = (game && game.seats && game.seats.tracked) || [0, 0];
  const maxPads = padRange[1] | 0;
  const conns = new Map();            /* hub id -> { ua, verified, device } */
  const padSeats = [];                /* index -> { device, conn, who, name, avatar, colour, state, ready } or null */
  let tracked = [];                   /* [{ who, name, avatar, colour }] */
  let phase = 'lobby';
  let tick = 0;
  let wrong = 0, lockedUntil = 0;
  let pausedAt = 0, offered = false, timer = null;
  const listeners = {};

  /* ----- the join: three pictures and a grid of nine (0032) ----- */
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = shuffle([...PICTURE_POOL]);
  const join = { pictures: pool.slice(0, 3), grid: shuffle(pool.slice(0, 9)) };

  const emit = (name, arg) => { for (const fn of [...(listeners[name] || [])]) fn(arg); };
  const people_ = () => { try { return people() || []; } catch { return []; } };
  const findPerson = (id) => people_().find(p => p.id === id) || null;
  const takenColours = (except) => [...tracked, ...padSeats].filter(s => s && s !== except && s.colour).map(s => s.colour);
  const lowestFree = () => { for (let i = 0; i < maxPads; i++) if (!padSeats[i]) return i; return -1; };
  const seatIndexOfDevice = (token) => padSeats.findIndex(s => s && s.device === token);
  const seatIndexOfConn = (from) => padSeats.findIndex(s => s && s.conn === from);
  const requiredIdx = () => {
    const r = game && game.requiredPads;
    if (Array.isArray(r)) return r.map(n => n | 0);       /* explicit pad seat indexes (0 is the first pad seat) */
    return Array.from({ length: Math.max(0, r | 0) }, (_, i) => i);   /* a number: the first N pad seats */
  };

  /* ----- seats ----- */
  function seatView(s, n, kind) {
    if (!s) return { n, kind, who: null, name: null, avatar: null, colour: null, state: 'empty', device: null, ready: false };
    return { n, kind, who: s.who, name: s.name, avatar: s.avatar || null, colour: s.colour, state: kind === 'tracked' ? 'live' : s.state, device: s.device || null, ready: kind === 'tracked' ? true : !!s.ready };
  }
  function seatList() {
    const out = tracked.map((s, i) => seatView(s, i, 'tracked'));
    let len = padSeats.length;
    while (len > 0 && !padSeats[len - 1]) len--;
    len = Math.max(len, padRange[0] | 0, requiredIdx().reduce((m, i) => Math.max(m, i + 1), 0));
    for (let i = 0; i < len; i++) out.push(seatView(padSeats[i], tracked.length + i, 'pad'));
    return out;
  }
  const seatNumber = (idx) => tracked.length + idx;

  function setSeat(idx, token, from, person) {
    const prev = padSeats[idx];
    const sameWho = prev && prev.who === person.id;
    const seat = prev || { device: token, ready: false };
    Object.assign(seat, { device: token, conn: from, who: person.id, name: person.name, avatar: person.avatar || null, state: 'live' });
    if (!sameWho || !seat.colour) seat.colour = colourFor(person, takenColours(seat));
    if (!sameWho) seat.ready = false;
    padSeats[idx] = seat;
    return seat;
  }
  function welcome(from, idx, token) {
    const s = padSeats[idx], c = conns.get(from);
    if (c) { c.device = token; c.verified = true; }
    send(from, { t: 'welcome', device: token, seat: seatNumber(idx), who: s.who, name: s.name, avatar: s.avatar, colour: PALETTE.fav[s.colour] || s.colour,
      game: game.id, pad: game.pads && game.pads.program, need: game.pads && game.pads.need });
  }
  const peopleMsg = () => ({ t: 'who?', people: people_().map(p => ({ id: p.id, name: p.name, avatar: p.avatar || null })) });
  const reject = (to, why) => send(to, { t: 'reject', why });

  /* ----- hello, pick, who?, ready ----- */
  function hello(from, c, m) {
    if (m.v !== 1) return reject(from, 'version');
    if (!(maxPads > 0)) return reject(from, 'game');
    const rec = typeof m.device === 'string' ? trust.get(m.device) : null;
    if (rec) {                                                   /* trusted: straight back */
      const person = findPerson(rec.who);
      c.device = m.device; c.verified = true;
      let idx = seatIndexOfDevice(m.device);
      if (idx < 0) { idx = lowestFree(); if (idx < 0) { c.device = null; return reject(from, 'full'); } }
      if (!person) { return send(from, peopleMsg()); }           /* that person is gone from the Box: pick again */
      const old = padSeats[idx] && padSeats[idx].conn;
      if (old && old !== from) { send.close(old); const oc = conns.get(old); if (oc) oc.device = null; }
      setSeat(idx, m.device, from, person);
      trust.touch(m.device);
      welcome(from, idx, m.device);
      emit('change'); checkPause();
      return;
    }
    if (lockedUntil && now() >= lockedUntil) { lockedUntil = 0; wrong = 0; }
    if (now() < lockedUntil) return reject(from, 'wait');
    if (!m.join) return send(from, { t: 'pics?', grid: join.grid.slice() });
    if (JSON.stringify(m.join) !== JSON.stringify(join.pictures)) {
      wrong++;
      if (wrong >= MAX_WRONG) { lockedUntil = now() + WAIT_MS; return reject(from, 'wait'); }
      return reject(from, 'join');
    }
    wrong = 0; c.verified = true;
    send(from, peopleMsg());
  }

  function pick(from, c, m) {
    if (!c.verified && !c.device) return;
    const person = findPerson(m.who);
    if (!person) return;
    let token = c.device, idx;
    if (token && trust.get(token)) {                              /* changing who: the same token and seat */
      idx = seatIndexOfDevice(token);
      if (idx < 0) { idx = lowestFree(); if (idx < 0) return reject(from, 'full'); }
      trust.set(token, { ...trust.get(token), who: person.id, ua: c.ua, lastSeen: now() });
    } else {
      idx = lowestFree(); if (idx < 0) return reject(from, 'full');
      token = newToken();
      trust.set(token, { who: person.id, ua: c.ua, lastSeen: now() });
    }
    setSeat(idx, token, from, person);
    welcome(from, idx, token);
    emit('change'); checkPause();
  }

  /* ----- pause and resume (0028) ----- */
  function missing() {
    return requiredIdx().map(i => ({ i, s: padSeats[i] })).filter(x => !x.s || x.s.state !== 'live');
  }
  function checkPause() {
    if (phase === 'playing') {
      const gone = missing();
      if (!gone.length) return;
      phase = 'paused'; pausedAt = now(); offered = false;
      const s = gone[0].s, msg = { t: 'pause', why: 'seat', who: s ? s.who : null, name: s ? s.name : null };
      send('*', msg);
      if (timer != null) clearTimer(timer);
      timer = setTimer(() => { timer = null; api.tick(); }, OFFER_END_MS);
      emit('pause', { why: 'seat', who: msg.who, name: msg.name });
      emit('change');
    } else if (phase === 'paused' && !missing().length) {
      phase = 'playing';
      if (timer != null) { clearTimer(timer); timer = null; }
      send('*', { t: 'resume', why: 'seat' });
      emit('resume', { why: 'seat' });
      emit('change');
    }
  }

  const api = {
    get join() { return { pictures: join.pictures.slice(), grid: join.grid.slice() }; },
    get seats() { return seatList(); },
    get phase() { return phase; },
    /* true when `start()` would work: in the lobby (or after a round) with every required phone in. The TV's Start button dims on it. */
    get canStart() { return (phase === 'lobby' || phase === 'over') && !missing().length; },

    open(from, ua) { conns.set(from, { ua: ua || '', verified: false, device: null }); },
    close(from) {
      conns.delete(from);
      const idx = seatIndexOfConn(from);
      if (idx < 0) return;
      padSeats[idx].conn = null; padSeats[idx].state = 'away';
      emit('change'); checkPause();
    },
    message(from, m) {
      const c = conns.get(from);
      if (!c || !m || typeof m.t !== 'string') return;
      switch (m.t) {
        case 'hello': return hello(from, c, m);
        case 'pick': return pick(from, c, m);
        case 'who?': {
          if (!c.verified && !c.device) return;
          const idx = seatIndexOfConn(from);
          if (idx >= 0) padSeats[idx].ready = false;
          send(from, peopleMsg()); emit('change');
          return;
        }
        case 'ready': {
          const idx = seatIndexOfConn(from); if (idx < 0) return;
          padSeats[idx].ready = true;
          emit('ready', seatView(padSeats[idx], seatNumber(idx), 'pad')); emit('change');
          return;
        }
        case 'ping': return send(from, { t: 'pong', n: m.n, tick });
        case 'in': {
          const idx = seatIndexOfConn(from); if (idx < 0) return;
          emit('input', { seat: seatNumber(idx), who: padSeats[idx].who, m });
          return;
        }
      }
    },

    start() {
      if (phase !== 'lobby' && phase !== 'over') return false;
      if (missing().length) return false;
      phase = 'playing';
      emit('change');
      return true;
    },
    end() {
      phase = 'over';
      if (timer != null) { clearTimer(timer); timer = null; }
      emit('change');
    },
    state(obj) { tick++; send('*', { ...obj, t: 'state', tick }); },
    event(name, fields) { send('*', { ...fields, t: 'ev', e: name }); },
    setTracked(list) {
      tracked = [];
      for (const p of list || []) {
        const who = { id: p.who, name: p.name, avatar: p.avatar || null, favourite: p.favourite };
        tracked.push({ who: p.who, name: p.name, avatar: p.avatar || null, colour: colourFor(who, takenColours(null)) });
      }
      emit('change');
    },
    forget(device) {
      const had = trust.remove(device);
      const idx = seatIndexOfDevice(device);
      if (idx >= 0) {
        const conn = padSeats[idx].conn;
        padSeats[idx] = null;
        if (conn) { send.close(conn); const c = conns.get(conn); if (c) { c.device = null; c.verified = false; } }
        emit('change'); checkPause();
      }
      return had;
    },
    /* The 120 s offer. It also runs from a timer the session sets itself; a test (or a shell with its own loop) can call it after moving the clock. */
    tick() {
      if (phase === 'paused' && !offered && now() - pausedAt >= OFFER_END_MS) { offered = true; emit('offerEnd'); }
    },
    on(name, fn) { (listeners[name] ||= []).push(fn); return () => { listeners[name] = listeners[name].filter(f => f !== fn); }; }
  };
  return api;
}
