/* Pads in the game shell (plan package S1; spec docs/specs/session.md, "The game API for pads").
   This is the glue between the host session (session.js), the host link (host-link.js) and a game. No DOM here, so it is unit-tested with fakes.

     const rt = createPads({ game, people, trust, config });      // the shell's side: session, link, start / end / stop, tracked seats
     rt.forRound()                                               // the game's side (below), one per round: game.create(players, { pads })

   What a game gets (`pads`):
     pads.on('input', ({ seat, who, m }) => ...)     a phone's `in` message (m has its fields, `seq` and `t:'in'`)
     pads.on('join' | 'leave', ({ seat, who, name, colour }) => ...)   a phone took its seat (or came back) / its phone dropped or was removed;
                                                     on('join') also fires at once for every phone already in
     pads.on('pause' | 'resume', fn)                 the shell pauses the round while a needed phone is away; the game just stops stepping
     pads.send(seat | '*', m)                        one-off event to one phone or all: arrives on the pad as `ev` ({ e: m.e || 'msg', ...m })
     pads.state(obj)                                 shared state for every phone; throttled here to about 18 a second (the latest wins)
     pads.seats                                      [{ n, kind, who, name, avatar, colour, state, device, ready }] (tracked seats first)
   A game never starts or ends the session: only the TV's Start (the shell) does. */
import { createSession } from './session.js';
import { createHostLink, hubConfig } from './host-link.js';
import { createTrust } from './trust.js';
import { FAVS, nearestFav, normalizeLook } from '../ui/look.js';
import { color } from '../games/assets/palette.js';
import { DEFAULT_PLAYER_FAVS } from '../tracking/pose-shared.js';

export const STATE_GAP_MS = 55;          /* shared state goes out at most about 18 times a second */
export const WIFI_HINT_AFTER = 90;       /* seconds with no phone before the TV adds its one Wi-Fi line (pad protocol, "Discovery hint") */

/* Does this game use phones at all? (`seats.pads[1] > 0` in its manifest) */
export const usesPads = (g) => !!(g && g.seats && Array.isArray(g.seats.pads) && (g.seats.pads[1] | 0) > 0);

/* ----- where the hub is ----- */
/* The app (Tauri) sets window.__ORLIS_PAD_HUB__ = { port, key, lan? }. In the browser dev build there is no hub, so the owner (or a dev
   server) may point at the Node hub (tools/pad-hub.mjs) with  ?padhub=<port>:<key>  and, for the QR, optionally  &padhost=<this computer's LAN address>. */
export function padHub({ g = globalThis, search = '', allowDev = false } = {}) {
  const real = hubConfig(g);
  if (real) { const c = g.__ORLIS_PAD_HUB__; return { ...real, ...(c.lan ? { lan: String(c.lan) } : {}), ...(c.url ? { url: String(c.url) } : {}) }; }
  if (!allowDev) return null;
  let p; try { p = new URLSearchParams(search); } catch { return null; }
  const v = p.get('padhub'); if (!v) return null;
  const i = v.indexOf(':'), port = Number(v.slice(0, i)), key = v.slice(i + 1);
  if (i < 0 || !(port > 0 && port < 65536) || !key) return null;
  return { port, key, ...(p.get('padhost') ? { lan: p.get('padhost') } : {}) };
}

/* The address the QR opens: the pad page on the hub's LAN address (no secret in it). A hub config may carry `url` (the whole address) or `lan`
   (this computer's address on the home network); else the address this page was opened from, if it is not "localhost". */
export function padPageUrl(config, loc = (typeof location !== 'undefined' ? location : null)) {
  if (!config) return null;
  if (config.url) return String(config.url);
  const loopback = (h) => !h || h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  const host = config.lan || (loc && !loopback(loc.hostname) ? loc.hostname : '127.0.0.1');
  return `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${config.port}/`;
}

/* ----- people and colours ----- */
/* The household's profiles as the session wants them: { id, name, avatar (look or null), favourite }, then Guest (drawn as Cubo). */
export function peopleFrom(profiles) {
  const out = [];
  for (const p of profiles || []) {
    if (!p || p.id == null || p.id === 'guest') continue;
    const look = p.look && typeof p.look === 'object' ? normalizeLook(p.look) : null;
    out.push({ id: String(p.id), name: String(p.name || 'Player'), avatar: look, favourite: look ? look.colour : undefined });
  }
  out.push({ id: 'guest', name: 'Guest', avatar: null });
  return out;
}

/* U8 for phones: the favourite they asked for if it is free, else the nearest free one; no favourite (a guest): the next free in the usual order. */
export function colourFor(who, taken) {
  const want = who && FAVS.includes(who.favourite) ? who.favourite : null;
  if (want && !taken.includes(want)) return want;
  const free = FAVS.filter(f => !taken.includes(f));
  if (!free.length) return want || FAVS[0];
  if (want) return nearestFav(color('fav.' + want), free);
  return DEFAULT_PLAYER_FAVS.find(f => free.includes(f)) || free[0];
}

/* ----- the pause pill ----- */
/* "Waiting for Sam's phone" (no name known: "Waiting for a phone") */
export const waitingText = (name) => (name ? `Waiting for ${name}'s phone` : 'Waiting for a phone');

/* What the TV shows while the session is paused: who we are waiting for, and (after 120 s) the offer to end. Plain state, fed by session events. */
export function pauseWatch(session) {
  const st = { waiting: null, offered: false, listeners: [] };
  const fire = () => st.listeners.forEach(fn => fn(st));
  session.on('pause', (e) => { st.waiting = { who: e.who || null, name: e.name || null }; st.offered = false; fire(); });
  session.on('resume', () => { st.waiting = null; st.offered = false; fire(); });
  session.on('offerEnd', () => { if (st.waiting) { st.offered = true; fire(); } });
  session.on('change', () => { if (st.waiting && session.phase !== 'paused') { st.waiting = null; st.offered = false; fire(); } });
  return {
    get waiting() { return st.waiting; },
    get offered() { return st.offered; },
    get text() { return st.waiting ? waitingText(st.waiting.name) : ''; },
    on(fn) { st.listeners.push(fn); return () => { st.listeners = st.listeners.filter(f => f !== fn); }; }
  };
}

/* ----- the runtime ----- */
let current = null;
/* The running pads, if a game with phones is on (Settings uses it to remove a phone that is connected right now). */
export const currentPads = () => current;

export function createPads({ game, people, trust = createTrust(), config, createLink = createHostLink, WebSocketImpl, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout, stateGap = STATE_GAP_MS, newToken, rng, colourForFn = colourFor }) {
  const link = createLink(config, { ...(WebSocketImpl ? { WebSocketImpl } : {}), setTimer, clearTimer });
  const conns = new Map();                                   /* seat number -> hub id of its phone (learned from welcome) */
  const send = (to, m) => { if (m && m.t === 'welcome') conns.set(m.seat, to); link.send(to, m); };
  send.close = (to) => link.send.close(to);
  const session = createSession({ game, people, trust, send, colourFor: colourForFn, now, setTimer, clearTimer, ...(newToken ? { newToken } : {}), ...(rng ? { rng } : {}) });
  link.attach(session);

  /* ----- the game's events ----- */
  const subs = {};
  const emit = (name, arg) => { for (const fn of [...(subs[name] || [])]) { try { fn(arg); } catch (e) { if (typeof console !== 'undefined') console.warn('pads handler', e); } } };
  let live = new Map();                                      /* seat n -> who, for the phones that are live now */
  const padSeats = () => session.seats.filter(s => s.kind === 'pad');
  const seatInfo = (s) => ({ seat: s.n, who: s.who, name: s.name, avatar: s.avatar, colour: s.colour });
  session.on('change', () => {
    const next = new Map(padSeats().filter(s => s.state === 'live').map(s => [s.n, s]));
    for (const [n, s] of live) { const t = next.get(n); if (!t || t.who !== s.who) { conns.delete(n); emit('leave', seatInfo(s)); } }
    for (const [n, s] of next) { const t = live.get(n); if (!t || t.who !== s.who) emit('join', seatInfo(s)); }
    live = next;
  });
  session.on('input', (e) => emit('input', e));
  session.on('pause', (e) => emit('pause', e));
  session.on('resume', (e) => emit('resume', e));

  /* ----- throttled shared state ----- */
  let pending = null, lastAt = -Infinity, timer = null;
  const flush = () => { if (pending) { const o = pending; pending = null; lastAt = now(); session.state(o); } };
  const state = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    pending = obj;
    const wait = lastAt + stateGap - now();
    if (wait <= 0) { if (timer != null) { clearTimer(timer); timer = null; } flush(); }
    else if (timer == null) timer = setTimer(() => { timer = null; flush(); }, wait);
  };

  /* one object per round, so a game's handlers go away with its round (the runtime lives on across "play again") */
  const makeApi = () => {
    const mine = [];
    return {
      on(name, fn) {
        (subs[name] ||= []).push(fn);
        const off = () => { subs[name] = (subs[name] || []).filter(f => f !== fn); };
        mine.push(off);
        /* a game made after the phones joined (the join card comes first) hears about the phones already in, at once */
        if (name === 'join') for (const q of live.values()) { try { fn(seatInfo(q)); } catch (e) { if (typeof console !== 'undefined') console.warn('pads handler', e); } }
        return off;
      },
      send(to, m) {
        if (!m || typeof m !== 'object') return;
        const msg = { ...m, t: 'ev', e: typeof m.e === 'string' ? m.e : 'msg' };
        if (to === '*') link.send('*', msg);
        else { const id = conns.get(to); if (id) link.send(id, msg); }
      },
      state,
      get seats() { return session.seats; },
      get phase() { return session.phase; },
      dispose() { mine.splice(0).forEach(f => f()); }      /* (the shell calls this when the round is over) */
    };
  };

  const rt = {
    game, session, link, trust, forRound: makeApi,
    pause: pauseWatch(session),
    get config() { return config; },
    get padUrl() { return padPageUrl(config); },
    connOf: (seat) => conns.get(seat) || null,        /* (for tests) */
    connect() { return link.start(); },                /* connect to the hub (a no-op without one) */
    /* the TV's Start: true when the round can begin (the required phones are in) */
    go() { return session.start(); },
    end() { flush(); session.end(); },
    setTracked(list) { session.setTracked(list); },
    stop() { if (timer != null) { clearTimer(timer); timer = null; } pending = null; link.stop(); if (current === rt) current = null; }
  };
  current = rt;
  return rt;
}

/* Play again with the phones that are already in: true when the new round can start at once, with no join card
   (a fresh start from home, or a needed phone gone, still shows the card). */
export function skipJoinCard(rt, again, tracked) {
  if (!again || !rt) return false;
  rt.setTracked(tracked());
  return !!rt.go();
}
