/* Signing in, in the Windows app: finding the family's Orlis server on the
   home Wi-Fi, an account (a grown-up's), and "Who's playing?" - the kids'
   profiles under it.

   Once signed in, a device stays signed in: the account and its profiles are
   kept here, so the games play with no server in reach (it's only needed to
   join, sign in, and - next - to sync games). When the server is reachable,
   the profiles are quietly brought up to date.

   Only in the Windows app (window.__TAURI__). Opened any other way - the
   browser, the tests - there's no account step at all. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { openMaker, withFace, MAKING } from './avatar-maker.js';
import { setup } from './setup.js';
import { claudeChecklist } from './connect-claude.js';
import { HOME_SERVER } from './home-server.js';

const KEY = 'orlis.account';
export const AVATARS = {
  cube: '\u{1F9CA}', rocket: '\u{1F680}', star: '\u{2B50}', moon: '\u{1F319}', balloon: '\u{1F388}', fish: '\u{1F41F}',
  dino: '\u{1F996}', cat: '\u{1F431}', dog: '\u{1F436}', owl: '\u{1F989}', bee: '\u{1F41D}', leaf: '\u{1F343}'
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
    const err = new Error('Couldn\'t reach the Orlis server. Is it running, and is this PC on its Wi-Fi (or on Tailscale)?');
    err.status = 0; throw err;
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok){ const err = new Error(data.message || 'Something went wrong.'); err.status = r.status; err.code = data.error; throw err; }
  return data;
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
export function welcome(done, { auto = true } = {}){
  clearUI();
  const s = screen('dim account');
  /* (a screen that keeps checking - the setup checklist - stops when another's shown) */
  let watching = null;
  const stopWatching = () => { if (watching){ clearTimeout(watching); watching = null; } };
  const show = (...nodes) => { stopWatching(); s.innerHTML = ''; s.append(...nodes); };
  const msg = h('p', 'lede formmsg', '');
  const say = (t, bad) => { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };

  /* a form: labelled boxes, one button that sends, Enter sends too */
  function form(fields, label, send){
    const f = h('form', 'acctform');
    const boxes = {};
    for (const [key, text, type, extra] of fields){
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
      boxes[key] = i; l.appendChild(i); f.appendChild(l);
    }
    const go = button(label, 'go');
    go.type = 'submit';
    let busy = false;
    const submit = async (e) => {
      e?.preventDefault?.();
      if (busy) return;
      busy = true; go.classList.add('busy'); say('');
      try { await send(Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, b.type === 'checkbox' ? b.checked : b.value]))); }
      catch (err){ sfx.boing?.(0.6); say(err.message, true); }
      busy = false; go.classList.remove('busy');
    };
    f.addEventListener('submit', submit);
    go.addEventListener('pick', submit);
    f.append(go);
    setTimeout(() => { const first = Object.values(boxes).find(b => b.type !== 'checkbox'); first?.focus(); }, 50);
    return f;
  }

  /* 1: find the server */
  async function look(){
    const saved = account.state && account.state.server;
    let found = [];
    if (saved){ try { const r = await hello(saved.url); found = [{ url: saved.url, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false }]; } catch {} }
    if (!found.length){
      const list = await findServers();
      for (const sv of list){ try { const r = await hello(sv.url); found.push({ url: sv.url, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false }); } catch {} }
    }
    /* none on this Wi-Fi: the family's server, on the internet */
    if (!found.length && HOME_SERVER){
      try { const r = await hello(HOME_SERVER); found.push({ url: HOME_SERVER, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false }); } catch {}
    }
    return found;
  }
  async function find(){
    show(h('h2', '', 'Finding your Orlis server…'));
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
  function notFound(){
    const addr = form([['url', 'Server address', 'text']], 'Connect', async ({ url }) => {
      const u = serverUrl(url);
      const r = await hello(u);
      connect({ url: u, id: r.id, name: r.name, setup: r.setup, invite: r.invite !== false });
    });
    const typed = h('details', 'setuptype'); typed.append(h('summary', '', 'Type an address'), addr);
    show(h('h2', '', 'Can’t reach your Orlis server'),
      h('p', 'lede', 'Check this PC is online. It’ll keep trying.'),
      msg, onPick(button('Try again', 'wide'), () => { sfx.select(); find(); }), typed);
    const me = s.lastChild;
    const tick = async () => {
      if (!s.contains(me)) return;
      const found = await look();
      if (!s.contains(me)) return;
      if (found.length){ sfx.gold?.(); return found.length === 1 ? connect(found[0]) : choose(found); }
      watching = setTimeout(tick, 8000);
    };
    watching = setTimeout(tick, 8000);
  }

  /* 2: in - set up, sign in, or join */
  function connect(sv){
    account.set({ server: { url: sv.url, name: sv.name, ...(sv.id ? { id: sv.id } : {}) } });
    if (sv.setup) return setupOwner(sv);
    /* (someone new, over Tailscale: straight to making an account - they've
       never been signed in on this PC) */
    if (sv.invite === false && !account.state.account) return join(sv);
    signIn(sv);
  }
  const device = () => (navigator.userAgent.includes('Windows') ? 'Windows PC' : 'A device');
  const finish = (r, joined = false) => {
    account.set({ token: r.token, account: r.account, household: r.household || null, profiles: r.profiles, current: null });
    /* asked to join: waiting for the owner to let them in */
    if (r.account && r.account.waiting) return waiting(joined);
    sfx.gold?.();
    /* someone joining with the Dev Kit, in the Windows app: setting it up first */
    if (joined && r.account && r.account.devkit && setup.available) return ready();
    if (joined && r.account) return welcomeIn();
    who();
  };

  function setupOwner(sv){
    show(h('h2', '', 'Set up Orlis Play'),
      h('p', 'lede', `A new server: "${sv.name}". The first account is the owner's - yours.`),
      form([
        ['email', 'Your email', 'email', 'email'],
        ['password', 'A password (8 or more characters)', 'password', 'new-password'],
        ['name', 'Your first name (your profile)', 'text'],
        ['adult', 'I\'m a parent or guardian, 18 or over', 'check']
      ], 'Create account', async (v) => finish(await call(sv.url, 'POST', '/api/signup', { ...v, device: device() }))),
      msg);
  }
  function signIn(sv){
    show(h('h2', '', 'Sign in'), h('p', 'lede', `to "${sv.name}"`),
      form([
        ['email', 'Email', 'email', 'email'],
        ['password', 'Password', 'password', 'current-password']
      ], 'Sign in', async (v) => finish(await call(sv.url, 'POST', '/api/signin', { ...v, device: device() }))),
      msg,
      /* (no invite needed: over Tailscale, or when the owner lets people in) */
      onPick(button(sv.invite === false ? 'New here? Make an account' : 'New here? Join with an invite', sv.invite === false ? 'wide' : 'link'), () => { sfx.select(); join(sv); }));
  }
  function join(sv){
    const free = sv.invite === false;
    show(h('h2', '', free ? 'Make an account' : 'Join with an invite'),
      h('p', 'lede', free ? `For "${sv.name}"` : 'Ask the owner for an invite code.'),
      form([
        ...(free ? [] : [['invite', 'Invite code', 'text']]),
        ['email', 'Your email (a grown-up\'s)', 'email', 'email'],
        ['password', 'A password (8 or more characters)', 'password', 'new-password'],
        ['name', 'Your first name (your profile)', 'text'],
        ['adult', 'I\'m a parent or guardian, 18 or over', 'check']
      ], 'Join', async (v) => finish(await call(sv.url, 'POST', '/api/signup', { ...v, device: device() }), true)),
      msg,
      onPick(button('Already have an account? Sign in', 'link'), () => { sfx.select(); signIn(sv); }));
  }

  /* 2b: a new creator - getting ready to make games: Claude Code (a button
     installs it), then a first game, made and ready to try in a moment. */
  /* 2c: waiting for the owner's OK - it checks by itself, and moves on as
     soon as they're let in */
  function waiting(joined = true){
    show(h('h2', '', 'Almost there!'),
      h('p', 'lede', 'The owner will let you in soon. Play while you wait.'),
      h('div', 'waitdots', '<span></span><span></span><span></span>'),
      onPick(button('Play while you wait', 'wide'), () => { sfx.select(); who(); }),
      onPick(button('Sign out', 'link'), () => { sfx.back?.(); account.signOut(); find(); }));
    const me = s.lastChild;
    const tick = async () => {
      if (!s.contains(me)) return;
      try {
        await account.refresh();
        if (!account.signedIn){ return find(); }          /* (turned down: their account's gone) */
        if (account.state.account && !account.state.account.waiting){ sfx.gold?.(); return joined ? welcomeIn() : who(); }
      } catch {}
      if (s.contains(me)) watching = setTimeout(tick, 5000);
    };
    watching = setTimeout(tick, 5000);
  }

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
    for (const p of account.state.profiles || []){
      tiles.appendChild(withFace(onPick(button(`<span class="av">${AVATARS[p.avatar] || AVATARS.cube}</span><span class="nm">${esc(p.name)}</span>`, 'who'), () => {
        sfx.select(); account.set({ current: p.id }); done(p);
      }), p, 220));
    }
    if ((account.state.profiles || []).length < 8) tiles.appendChild(onPick(button('<span class="av">+</span><span class="nm">Add a kid</span>', 'who add'), () => { sfx.select(); addKid(); }));
    show(h('h2', '', 'Who\'s playing?'), tiles, msg);
  }
  function addKid(){
    let pick = 'rocket';
    const grid = h('div', 'avatars');
    const mark = () => [...grid.children].forEach(b => b.classList.toggle('chosen', b.dataset.av === pick));
    for (const [id, em] of Object.entries(AVATARS)){
      const b = onPick(button(em, 'av'), () => { pick = id; mark(); }); b.type = 'button'; b.dataset.av = id; grid.appendChild(b);
    }
    mark();
    const f = form([['name', 'Their first name or a nickname', 'text']], 'Add', async ({ name }) => {
      const p = await account.call('POST', '/api/profiles', { name, avatar: pick });
      account.set({ profiles: [...(account.state.profiles || []), p] });
      /* straight on to making their avatar (Cancel keeps the picture) */
      if (MAKING) openMaker(p, { onDone: who });
      who();
    });
    f.insertBefore(grid, f.lastChild);
    show(h('h2', '', 'Add a kid'), h('p', 'lede', 'Just a name and a picture - nothing else is needed.'), f, msg,
      onPick(button('Back', 'link'), () => { sfx.back?.(); who(); }));
  }

  /* (still waiting: straight on to the starter games - it lets them know when they're in) */
  if (account.signedIn) who(); else find();
  return { tick(){}, draw(){} };
}

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
