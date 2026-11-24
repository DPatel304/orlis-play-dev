/* Signing in, in the Windows app: finding the family's Orlis server on the
   home Wi-Fi, an account (a grown-up's), and "Who's playing?" - the kids'
   profiles under it.

   Once signed in, a device stays signed in: the account and its profiles are
   kept here, so the games play with no server in reach (it's only needed to
   join, sign in, and - next - to sync games). When the server is reachable,
   the profiles are quietly brought up to date.

   Only in the Windows app (window.__TAURI__). Opened any other way - the
   browser, the tests - there's no account step at all. */
import { frontScene } from './front.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { withFace, faceOf } from './avatar-maker.js';
import { CUBO } from './look.js';
import { editProfile, renameFamily } from './kid-editor.js';
import { setup } from './setup.js';
import { claudeChecklist } from './connect-claude.js';
import { HOME_SERVER } from './home-server.js';
import { logo, homeButton, icon } from './brand.js';

import { iconHTML } from './icons.js';

const KEY = 'orlis.account';
export const AVATARS = {
  cube: 'block', rocket: 'rocket', star: 'glowstar', moon: 'moon', balloon: 'balloon', fish: 'fish',
  dino: 'dinosaur', cat: 'cat', dog: 'dog', owl: 'owl', bee: 'bee', leaf: 'leaf'
};
const TIMEOUT = 4000;

const inApp = () => typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.core);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const save = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

export const account = {
  /* { server: { url, id, name }, token, account: { id, email, role }, household: { id, name }, profiles: [...] (the whole family's), current } */
  state: load(),
  get needed(){ return inApp(); },
  get signedIn(){ return !!(this.state && this.state.token); },
  /* asked to join, not let in yet */
  get waiting(){ return !!(this.signedIn && this.state.account && this.state.account.waiting); },
  get current(){ const s = this.state; return s && s.profiles ? s.profiles.find(p => p.id === s.current) || null : null; },
  /* Is a child playing? Each grown-up's own profile is the first on their
     account; every other profile is a child's. */
  get isKid(){
    const me = this.current, all = (this.state && this.state.profiles) || [];
    if (!me) return false;
    const first = all.find(p => p.accountId === me.accountId);
    return !!first && first.id !== me.id;
  },
  get role(){ return this.state && this.state.account ? this.state.account.role : null; },
  set(patch){
    const was = this.waiting;
    this.state = { ...(this.state || {}), ...patch }; save(this.state);
    /* let in (however it was found out): the app says so, and opens up */
    if (was && !this.waiting && this.signedIn && typeof window !== 'undefined') window.dispatchEvent(new Event('orlisletin'));
  },
  signOut(){
    const s = this.state;
    if (s && s.token && s.server) call(s.server.url, 'POST', '/api/signout', null, s.token).catch(() => {});
    this.state = s && s.server ? { server: s.server } : null;
    save(this.state);
  },
  /* With the server in reach: the profiles as they are now. Out of reach,
     nothing changes. Signed out somewhere else: signed out here too. */
  async refresh(){
    const s = this.state;
    if (!s || !s.token || !s.server) return;
    try {
      const me = await call(s.server.url, 'GET', '/api/me', null, s.token);
      this.set({ account: me.account, household: me.household || null, profiles: me.profiles });
    } catch (e){ if (e.status === 401) this.signOut(); }
  },
  call: async (method, path, body) => {
    const s = account.state;
    try { return await call(s.server.url, method, path, body, s.token); }
    catch (e){
      /* out of reach: perhaps the server's laptop has a new address */
      if (e.status === 0 && await account.findAgain()) return call(account.state.server.url, method, path, body, s.token);
      throw e;
    }
  },

  /* The server's laptop can get a new address on the Wi-Fi (a router does
     that, now and then) - and someone who only comes by once a month would
     never reach it again. So: out of reach at the old address, look for the
     same server on this Wi-Fi (the same id, or - signed in before servers
     had ids - the same name) and keep its new address. True if it's found
     somewhere new. (At most once a minute: it takes a moment.) */
  lastLook: 0,
  async findAgain(){
    const s = this.state;
    if (!s || !s.server || Date.now() - this.lastLook < 60 * 1000) return false;
    this.lastLook = Date.now();
    for (const f of await findServers()){
      if (!f || !f.url || f.url === s.server.url) continue;
      try {
        const r = await hello(f.url);
        if (s.server.id ? r.id !== s.server.id : r.name !== s.server.name) continue;
        this.set({ server: { ...s.server, url: f.url, id: r.id || s.server.id } });
        return true;
      } catch {}
    }
    return false;
  }
};

/* An address someone typed or pasted, as the server's web address: a web
   address (https://..., as Tailscale Funnel gives) as it is; a bare
   laptop address (192.168.1.20) on the home Wi-Fi gets http and the
   server's port. */
export function serverUrl(text){
  let u = String(text || '').trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(u)) return u;
  if (!/^http:\/\//i.test(u)) u = 'http://' + u;
  return /:\d+$/.test(u) ? u : u + ':47871';
}

export async function call(url, method, path, body, token){
  let r;
  try {
    r = await fetch(url.replace(/\/$/, '') + path, {
      method, signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e){
    const err = new Error('Orlis is asleep right now. Try again in a little while.');
    err.status = 0; throw err;
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok){ const err = new Error(data.message || 'Something went wrong.'); err.status = r.status; err.code = data.error; throw err; }
  return data;
}

/* Is this PC on the internet at all? (Microsoft's own connection-check
   address: any answer means yes, even one we may not read.) Kept on an object
   so the tests can swap it. */
export const net = {
  online: async () => {
    try { await fetch('https://www.msftconnecttest.com/connecttest.txt', { mode: 'no-cors', signal: AbortSignal.timeout(4000) }); return true; }
    catch { return false; }
  }
};
/* What the "can't find Orlis" screen says: this PC is offline, or Orlis (the
   owner's laptop) is just asleep. */
export function notFoundWords(online){
  return online
    ? { asleep: true, heading: 'Orlis is asleep right now', lede: 'It’ll wake up soon and connect by itself - no need to do anything.' }
    : { asleep: false, heading: 'This laptop isn’t online', lede: 'Connect to Wi-Fi - Orlis will carry on by itself.' };
}

/* Cubo asleep: his head with closed eyes and a small round mouth, and three z's that float up (still with reduced motion) */
export function sleepyCubo(){
  const el = h('div', 'napcubo');
  el.setAttribute('aria-hidden', 'true');
  el.appendChild(faceOf({ look: { ...CUBO, face: { eyes: 'sleepy', mouth: 'o' } } }, 160, { tile: false, bare: true }));
  for (let i = 0; i < 3; i++) el.appendChild(h('i', 'z', 'z'));
  return el;
}

/* Orlis servers on the Wi-Fi, found by the app (a broadcast) - each with its
   name and address. */
async function findServers(){
  try { return await window.__TAURI__.core.invoke('find_servers'); }
  catch { return []; }
}
async function hello(url){
  const r = await call(url, 'GET', '/api/hello');
  if (r.app !== 'orlis') throw new Error('That isn\'t an Orlis server.');
  return r;
}

/* ---------- the screens ----------
   One overlay at a time, swapped in place: finding the server, then signing
   in or joining (or, on a brand-new server, setting up as the owner), then
   "Who's playing?". done() once a profile's picked. */
export function welcome(done, { auto = true, glide = false, onBack = null } = {}){
  clearUI();
  const s = screen('dim account');
  /* the logo top left (or, asked for from inside the app, the big Home button where it sits), a painted world softly blurred behind
     (front.js), and everything else on one white card in the middle */
  const card = h('div', 'acctcard' + (glide ? ' glide' : ''));
  let top = logo({ size: 'calc(var(--u)*6.4)', light: true });
  if (onBack){ top = homeButton(() => { sfx.back?.(); onBack(); }); top.classList.add('close'); }      /* (the remote's Back presses it) */
  s.append(top, card);
  /* (a screen that keeps checking - the setup checklist - stops when another's shown) */
  let watching = null;
  const stopWatching = () => { if (watching){ clearTimeout(watching); watching = null; } };
  const show = (...nodes) => { stopWatching(); card.innerHTML = ''; card.classList.remove('whoscreen'); card.append(...nodes); card.scrollTop = 0; };
  const msg = h('p', 'lede formmsg', '');
  const say = (t, bad) => { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };

  /* a form: labelled boxes, one button that sends, Enter sends too */
  function form(fields, label, send){
    const f = h('form', 'acctform');
    /* (no browser bubbles - every problem shows the same way, under the card) */
    f.noValidate = true;
    const boxes = {};
    for (const [key, text, type, extra, opts = {}] of fields){
      if (type === 'check'){
        const l = h('label', 'check');
        const c = document.createElement('input'); c.type = 'checkbox'; boxes[key] = c;
        l.append(c, h('span', '', text));
        f.appendChild(l);
        continue;
      }
      const l = h('label', 'field', `<span>${text}</span>`);
      const i = document.createElement('input');
      i.type = type || 'text'; i.autocomplete = extra || 'off'; i.spellcheck = false;
      if (opts.value) i.value = opts.value;
      if (opts.hidden){ i.type = 'hidden'; boxes[key] = i; f.appendChild(i); continue; }
      boxes[key] = i;
      /* a password: an eye in the box, to see what you typed */
      if (i.type === 'password'){
        const wrap = h('span', 'pwwrap'), eye = document.createElement('button');
        eye.type = 'button'; eye.className = 'eye'; eye.tabIndex = -1;
        const set = (on) => { i.type = on ? 'text' : 'password'; eye.innerHTML = on ? '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'; eye.title = on ? 'Hide password' : 'Show password'; eye.setAttribute('aria-label', eye.title); };
        set(false);
        eye.addEventListener('click', (e) => { e.preventDefault(); set(i.type === 'password'); i.focus(); });
        i.dataset.pw = '1';
        wrap.append(i, eye); l.appendChild(wrap);
      } else l.appendChild(i);
      f.appendChild(l);
    }
    const go = button(label, 'go');
    go.type = 'submit';
    let busy = false;
    const submit = async (e) => {
      e?.preventDefault?.();
      if (busy) return;
      busy = true; go.classList.add('busy'); say('');
      try {
        problem();
        await send(Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, b.type === 'checkbox' ? b.checked : b.value]))); }
      catch (err){ sfx.boing?.(0.6); say(err.message, true); }
      busy = false; go.classList.remove('busy');
    };
    /* the quick checks, before asking the server: an email that looks like
       one, and a password typed in */
    const problem = () => {
      for (const b of Object.values(boxes)){
        const v = b.value.trim(), stop = (t) => { b.focus(); throw new Error(t); };
        if (b.type === 'email' && !v) stop('Type your email first.');
        if (b.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) stop('That email needs an @ and a dot.');
        if ((b.type === 'password' || b.dataset.pw) && !b.value) stop('Type your password first.');
      }
    };
    f.addEventListener('submit', submit);
    go.addEventListener('pick', submit);
    f.append(go);
    setTimeout(() => { const first = Object.values(boxes).find(b => b.type !== 'checkbox' && b.type !== 'hidden'); first?.focus(); }, 50);
    return f;
  }

  /* 1: find the server */
  async function look(){
    const saved = account.state && account.state.server;
    let found = [];
    if (saved){ try { const r = await hello(saved.url); found = [{ url: saved.url, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false }]; } catch {} }
    /* the family's server, on the internet */
    if (!found.length && HOME_SERVER){
      try { const r = await hello(HOME_SERVER); found.push({ url: HOME_SERVER, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false }); } catch {}
    }
    /* not there (or none built in): one on this Wi-Fi */
    if (!found.length){
      const list = await findServers();
      for (const sv of list){ try { const r = await hello(sv.url); found.push({ url: sv.url, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false }); } catch {} }
    }
    return found;
  }
  async function find(){
    show(h('p', 'finding', 'Finding your Orlis<span class="dots"><i></i><i></i><i></i></span>'));
    const found = await look();
    if (found.length === 1) return connect(found[0]);
    if (found.length > 1) return choose(found);
    notFound();
  }
  function choose(list){
    show(h('h2', '', 'Which Orlis server?'), ...list.map(sv => onPick(button(sv.name, 'wide'), () => connect(sv))));
  }
  /* Not found: most likely no internet just now. It keeps trying by itself,
     and connects as soon as the server answers; or type its address. */
  async function notFound(){
    let words = notFoundWords(await net.online());
    const addr = form([['url', 'Server address', 'text']], 'Connect', async ({ url }) => {
      const u = serverUrl(url);
      const r = await hello(u);
      connect({ url: u, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false });
    });
    const typed = h('details', 'setuptype'); typed.append(h('summary', '', 'Type an address'), addr);
    const head = h('h2', '', words.heading), lede = h('p', 'lede', words.lede);
    /* asleep: Cubo dozing above the heading, eyes shut, a few z's drifting up (owner, 2026-11-24) */
    const nap = sleepyCubo(); nap.hidden = !words.asleep;
    show(nap, head, lede,
      msg, onPick(button('Try again', 'wide'), () => { sfx.select(); find(); }), typed);
    const me = card.lastChild;
    const tick = async () => {
      if (!s.contains(me)) return;
      const found = await look();
      if (!s.contains(me)) return;
      if (found.length){ sfx.gold?.(); return found.length === 1 ? connect(found[0]) : choose(found); }
      /* (still not there: say again which it is - the words may have changed) */
      words = notFoundWords(await net.online());
      if (!s.contains(me)) return;
      head.textContent = words.heading; lede.textContent = words.lede; nap.hidden = !words.asleep;
      watching = setTimeout(tick, 8000);
    };
    watching = setTimeout(tick, 8000);
  }

  /* 2: in - set up, sign in, or join */
  function connect(sv){
    account.set({ server: { url: sv.url, name: sv.name, ...(sv.id ? { id: sv.id } : {}) } });
    if (sv.setup) return setupOwner(sv);
    getIn(sv);
  }
  const device = () => (navigator.userAgent.includes('Windows') ? 'Windows PC' : 'A device');
  const finish = (r, joined = false) => {
    account.set({ token: r.token, account: r.account, household: r.household || null, profiles: r.profiles, current: null });
    /* asked to join: straight on to the starter games while the owner lets them in */
    if (r.account && r.account.waiting) return who();
    sfx.gold?.();
    /* someone joining with the Dev Kit, in the Windows app: setting it up first */
    if (joined && r.account && r.account.devkit && setup.available) return ready();
    if (joined && r.account) return welcomeIn();
    who();
  };


  /* Accounts are for grown-ups; making one says you are (no tick box -
     pressing Create account is the yes). Kids play on profiles. */
  const grownups = () => h('p', 'grownups', 'For grown-ups (18+).');
  function setupOwner(sv){
    show(h('h2', '', 'Set up Orlis Play'),
      h('p', 'lede', `A new server: "${sv.name}". The first account is the owner's - yours.`),
      form([
        ['email', 'Your email', 'email', 'email'],
        ['password', 'Password (8+ characters)', 'password', 'new-password'],
        ['name', 'Username', 'text']
      ], 'Create account', async (v) => finish(await call(sv.url, 'POST', '/api/signup', { ...v, adult: true, device: device() }))),
      grownups(), msg);
  }

  /* Getting in: just an email. An account with it - its password; none -
     what a new account needs. */
  function getIn(sv, typed = ''){
    const f = form([['email', 'Email', 'email', 'email', { value: typed }]], 'Continue', async ({ email }) => {
        /* (a server from before email-first sign-in hasn't this - it needs its update) */
        const r = await call(sv.url, 'POST', '/api/account-exists', { email }).catch((e) => {
          if (e.status === 404) throw new Error('The Orlis server needs an update. On its laptop, right-click the Orlis icon by the clock, then Restart.');
          throw e;
        });
        sfx.select?.();
        return r.exists ? signIn(sv, email.trim()) : join(sv, email.trim());
      });
    f.classList.add('getin');
    show(h('h2', '', 'Sign in'), h('p', 'lede', `To ${esc(sv.name || 'your Orlis')}`), f, msg);
  }
  /* the card's corner icons: back (top-left), help (top-right) - small, so
     the form is what you see */
  const corner = (label, cls, title, fn) => { const b = onPick(button(label, 'cardicon ' + cls), fn); b.title = title; b.setAttribute('aria-label', title); return b; };
  const another = (sv, email) => corner(icon('back'), 'back', 'Use a different email', () => { sfx.back?.(); getIn(sv, email); });
  function signIn(sv, email){
    show(h('h2', '', 'Sign in'), h('p', 'lede', `To ${esc(sv.name || 'your Orlis')}`),
      form([
        ['email', 'Email', 'email', 'username', { value: email }],
        ['password', 'Password', 'password', 'current-password']
      ], 'Sign in', async (v) => finish(await call(sv.url, 'POST', '/api/signin', { ...v, device: device() }))),
      msg,
      corner('?', 'help', 'Forgot password?', () => { sfx.select?.(); forgot(sv, email); }),
      another(sv, email));
  }
  /* a forgotten password: whoever runs the server sets a new one */
  function forgot(sv, email){
    show(h('h2', '', 'Forgot your password?'),
      h('p', 'lede', 'Ask whoever runs your Orlis server to give you a new one.'),
      h('p', 'lede small', 'If that’s you: on the server’s laptop, right-click the Orlis icon by the clock, then <b>Manage Orlis Server</b> › Families › <b>New password</b>.'),
      corner(icon('back'), 'back', 'Back to sign in', () => { sfx.back?.(); signIn(sv, email); }));
  }
  function join(sv, email){
    const free = sv.invite === false;
    show(h('h2', '', 'Make an account'), h('p', 'lede', esc(email)),
      form([
        ['email', '', 'email', 'username', { value: email, hidden: true }],
        ...(free ? [] : [['invite', 'Invite code (from the owner)', 'text']]),
        ['password', 'Password (8+ characters)', 'password', 'new-password'],
        ['name', 'Username', 'text']
      ], 'Create account', async (v) => finish(await call(sv.url, 'POST', '/api/signup', { ...v, adult: true, device: device() }), true)),
      grownups(), msg, another(sv, email));
  }

  /* 2b: a new creator - getting ready to make games: Claude Code (a button
     installs it), then a first game, made and ready to try in a moment. */
  /* 2a: a new grown-up - straight on to making their first game, or later */
  function welcomeIn(){
    show(h('h2', '', 'You’re in!'),
      onPick(button('Make a game', 'wide'), () => { sfx.select(); account.set({ firstGame: 'make' }); who(); }),
      onPick(button('Later', 'link'), () => { sfx.back?.(); who(); }));
  }

  function ready(){
    const first = onPick(button('Make my first game', 'wide'), () => { sfx.select(); check.stop(); account.set({ firstGame: true }); who(); });
    const check = claudeChecklist({ onConnected: () => first.classList.add('glow') });
    show(h('h2', '', 'You’re in!'),
      h('p', 'lede', 'Set up your Dev Kit:'),
      check.el, msg, first,
      onPick(button('Later', 'link'), () => { sfx.back?.(); check.stop(); who(); }));
  }

  /* 3: who's playing - straight past it when there's only one profile to
     pick (on the way in; asked for from the home screen, it always shows,
     so there's a way to add a kid) */
  function who(){
    const list = account.state.profiles || [];
    if (auto && list.length === 1){ account.set({ current: list[0].id }); return done(list[0]); }
    auto = false;
    const tiles = h('div', 'whotiles');
    /* the grown-up who made the account is the head of the family; everyone else is a family member (under 18) */
    const head = (account.state.profiles || []).find(q => q.accountId === (account.state.account && account.state.account.id));
    const grown = !account.isKid;
    const changed = async () => { await account.refresh(); who(); };
    for (const p of account.state.profiles || []){
      const cell = h('div', 'whocell');
      cell.appendChild(withFace(onPick(button(`<span class="av">${iconHTML(AVATARS[p.avatar] || AVATARS.cube, 128)}</span><span class="nm">${esc(p.name)}</span>`, 'who'), () => {
        sfx.select(); account.set({ current: p.id }); done(p);
      }), p, 220));
      /* (a grown-up looks after the family right here: a pencil on each) */
      if (grown){ const pen = onPick(button(icon('pencil'), 'whoedit'), () => { sfx.select(); editProfile(p, { self: p === head, onDone: changed }); }); pen.title = 'Change'; pen.setAttribute('aria-label', `Change ${p.name}`); cell.appendChild(pen); }
      tiles.appendChild(cell);
    }
    if (grown && (account.state.profiles || []).length < 8) tiles.appendChild(onPick(button(`<span class="av">${icon('plus')}</span><span class="nm">Add</span>`, 'who add'), () => { sfx.select(); editProfile(null, { onDone: changed }); }));
    /* the family's name is the title (no "Who's playing?": the faces say it) */
    const fam = account.state.household && account.state.household.name;
    const title = h('h2', 'whotitle', esc(fam || 'Who\u2019s playing?'));
    if (grown){ const pen = onPick(button(icon('pencil'), 'whoedit title'), () => { sfx.select(); renameFamily({ onDone: changed }); }); pen.title = 'The family’s name'; pen.setAttribute('aria-label', 'Change the family’s name'); title.appendChild(pen); }
    const nodes = [
      /* opened from inside the app: a way back (Escape does it too, through the Back key) */
      title, fam ? h('p', 'whosub', 'Who\u2019s playing?') : null, tiles,
      /* signing out lives here, with the family (a child playing doesn't see it) */
      grown && account.signedIn ? onPick(button('Sign out', 'link famlink'), () => { sfx.back?.(); account.signOut(); location.reload(); }) : null,
      msg].filter(Boolean);
    show(...nodes);
    card.classList.add('whoscreen');                 /* (big faces across the screen: no card) */
  }
  /* (still waiting: straight on to the starter games - it lets them know when they're in) */
  if (account.signedIn) who(); else find();
  return frontScene({ glide });
}

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
