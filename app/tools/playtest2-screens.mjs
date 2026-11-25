/* Playtest 2, the screens: every screen of the Orlis app at 1920x1080 and 1280x720, driven by remote (arrows, Enter, Escape), by mouse, and (where the
   page takes the body) by body. Writes pictures <area>-<what>[-720].png and a screens.json (focus, overlap, clipping, console errors, timings).

     cd app && npx vite --port 5191 --strictPort &
     node tools/playtest2-screens.mjs [out dir (../docs/playtest2)]        (BASE=http://127.0.0.1:5191)

   The family's server is the real one (server/src/app.js) on a temp data folder with two Store games; the PC is pretend Windows (a stub for
   window.__TAURI__). Home, Discover and Who's playing take the remote and the mouse only (the camera is off there: main.js BODY_PAGES); the body is used on
   Create (see test/cubo-create-e2e.node.mjs), the camera check, pause and results. Not a test: it finds things and writes them down. */
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const OUT = resolve(process.cwd(), process.argv[2] || '../docs/playtest2'), BASE = process.env.BASE || 'http://127.0.0.1:5191';
mkdirSync(OUT, { recursive: true });
const { start } = await import(join(here, '../../server/src/app.js'));
const { readOrlis, writeOrlis } = await import(join(here, '../../server/src/orlis-file.js'));
const { buildOrlis } = await import(join(here, '../kit/build-orlis.mjs'));
const { HOME_SERVER } = await import(join(here, '../src/ui/home-server.js'));

/* ---- the family's server, with two Store games (Pop Party's package under other names) ---- */
await buildOrlis('pop-party');
const base = readOrlis(readFileSync(join(here, '../dist-games/pop-party.orlis')));
const variant = (id, name, cols, blurb) => {
  const m = JSON.parse(base['manifest.json']); Object.assign(m, { id, name, version: '1.0', by: 'Mia', blurb, icon: { ...m.icon, cols } });
  const code = String(base['game.js']).split('"pop-party"').join(JSON.stringify(id)).split("'pop-party'").join(JSON.stringify(id)).split('"Pop Party"').join(JSON.stringify(name)).split("'Pop Party'").join(JSON.stringify(name));
  return { name: `${id}.orlis`, data: writeOrlis({ ...base, 'manifest.json': JSON.stringify(m), 'game.js': code }) };
};
const starters = [variant('bubble-dash', 'Bubble Dash', ['#38bdf8', '#818cf8'], 'Pop the bubbles before they float off'), variant('comet-catch', 'Comet Catch', ['#f59e0b', '#ef4444'], 'Catch the falling comets'),
  variant('puddle-jump', 'Puddle Jump', ['#34d399', '#0ea5e9'], 'Jump over the puddles')];
const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-pt2-')), port: 0, discoveryPort: false, starters, tailscaleJoin: () => true });
const S = `http://127.0.0.1:${s.port}`;
const api = async (m, p, b, tok) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})); };
const me = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
const kid = await api('POST', '/api/profiles', { name: 'Mia', avatar: 'rocket' }, me.token);
const state = { server: { url: S, name: 'Orlis' }, token: me.token, account: me.account, household: me.household, profiles: [...me.profiles, kid], current: me.profiles[0].id };
const TAURI = `window.__TAURI__ = { core: { invoke: async (c) => c === 'find_servers' ? [{ url: '${S}', name: 'Home' }] : null }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const results = { made: new Date().toISOString().slice(0, 10), screens: [], focus: [], issues: [], timings: [], errors: [] };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ---- in the page: what is wrong with this screen? ---- */
const AUDIT = () => {
  const vw = innerWidth, vh = innerHeight, out = { offscreen: [], clipped: [], overlaps: [], focus: [], tiny: [], interactive: 0 };
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !e.closest('.hide, .away, [hidden]'); };
  const name = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + ':' + (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const inScroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement){ const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return true; } return false; };
  const inter = [...document.querySelectorAll('button, .btn, input, a[href], select, textarea, [tabindex]:not([tabindex="-1"])')].filter(vis);
  out.interactive = inter.length;
  for (const e of inter){
    const r = e.getBoundingClientRect();
    if (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2){ if (!inScroller(e)) out.offscreen.push(name(e) + ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`); }
    if (Math.min(r.width, r.height) < 40 * (vh / 1080) && !e.matches('input[type=range]')) out.tiny.push(name(e) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  /* text that runs out of its box or off the screen */
  for (const e of document.querySelectorAll('body *')){
    if (!vis(e) || !e.childNodes.length) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (e.scrollWidth > e.clientWidth + 2 && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis') out.clipped.push('clipped: ' + name(e));
    else if (e.scrollHeight > e.clientHeight + 3 && /(hidden|clip)/.test(cs.overflowY)) out.clipped.push('cut off below: ' + name(e));
    if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2) out.clipped.push('ellipsis: ' + name(e));
    if (r.right > vw + 2 && !inScroller(e)) out.clipped.push('text off the right edge: ' + name(e));
  }
  /* two controls on top of each other (neither inside the other) */
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++){
    const a = inter[i], b = inter[j]; if (a.contains(b) || b.contains(a)) continue;
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (w > 6 && h > 6 && !getComputedStyle(a).pointerEvents.includes('none') && !getComputedStyle(b).pointerEvents.includes('none')) out.overlaps.push(`${name(a)} x ${name(b)} ${Math.round(w)}x${Math.round(h)}`);
  }
  /* the remote's focus */
  for (const e of document.querySelectorAll('.kfocus, .sel, :focus-visible, .sheetitem.hot')){
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    out.focus.push({ el: name(e), inView: r.left >= -2 && r.top >= -2 && r.right <= vw + 2 && r.bottom <= vh + 2, ring: /rgb/.test(cs.boxShadow) || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.borderColor) });
  }
  out.remote = document.body.classList.contains('remote');
  out.active = document.activeElement ? name(document.activeElement) : null;
  return out;
};

class Run {
  constructor(w, h, opts = {}){ this.w = w; this.h = h; this.suffix = w === 1920 ? '' : '-720'; this.opts = opts; this.errors = []; this.log = []; }
  async open(account = true, route = null){
    this.ctx = await browser.newContext({ viewport: { width: this.w, height: this.h }, deviceScaleFactor: 1 });
    await this.ctx.route(/\.ts\.net\//, r => r.abort());
    if (route) await route(this.ctx);
    await this.ctx.addInitScript(TAURI + (account ? `try { if (!localStorage.getItem('orlis.account')) localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))}); } catch {}` : `try { localStorage.clear(); } catch {}`));
    this.pg = await this.ctx.newPage();
    this.pg.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) this.errors.push('pageerror: ' + e.message.split('\n')[0]); });
    this.pg.on('response', (rs) => { if (rs.status() === 404) results.errors.push(`${this.w}: 404 ${rs.url().replace(/^https?:\/\/[^/]+/, '')}`); });
    this.pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_ABORTED|GL Driver|GPU stall|ts\.net|ERR_FAILED|ERR_CONNECTION|404 \(Not Found\)/.test(m.text())) this.errors.push('console: ' + m.text().slice(0, 200)); });
    return this;
  }
  async close(){ results.errors.push(...this.errors.map(e => `${this.w}: ${e}`)); await this.ctx.close(); }
  shot(name){ return this.pg.screenshot({ path: join(OUT, `${name}${this.suffix}.png`) }); }
  /* time from now until sel is on screen */
  async timed(label, action, sel, ms = 30000){
    const t0 = Date.now();
    await action();
    let ok = true;
    try { await this.pg.waitForSelector(sel, { state: 'visible', timeout: ms }); } catch (e){ ok = false; }
    const t = Date.now() - t0;
    results.timings.push({ screen: label, w: this.w, ms: t, ok });
    if (!ok) results.issues.push({ w: this.w, screen: label, what: `never showed (${sel}) in ${ms} ms` });
    await wait(700);
    return t;
  }
  async audit(label){
    const a = await this.pg.evaluate(AUDIT).catch((e) => ({ error: String(e) }));
    results.screens.push({ screen: label, w: this.w, ...a });
    return a;
  }
  /* the remote: keys in order, one at a time, looking at the focus after each */
  async sweep(label, keys){
    const trail = [];
    for (const k of keys){
      await this.pg.keyboard.press(k); await wait(260);
      const a = await this.pg.evaluate(AUDIT);
      const f = a.focus;
      trail.push({ key: k, n: f.length, el: f[0] && f[0].el, inView: f.every(x => x.inView), ring: f.some(x => x.ring) });
    }
    const lost = trail.filter(t => t.n === 0), hidden = trail.filter(t => t.n && !t.inView), noring = trail.filter(t => t.n && !t.ring), multi = trail.filter(t => t.n > 1);
    results.focus.push({ screen: label, w: this.w, keys: keys.length, lost: lost.length, outOfView: hidden.length, noRing: noring.length, several: multi.length, trail: trail.map(t => `${t.key}>${t.el || 'NONE'}`) });
    return trail;
  }
}

const SIZES = [[1920, 1080], [1280, 720]];
const note = (r, screen, what) => { results.issues.push({ w: r.w, screen, what }); console.log('  !', r.w, screen, '-', what); };

for (const [w, h] of SIZES){
  console.log('=== ' + w + 'x' + h);
  /* ---------- A. before signing in ---------- */
  let r = await new Run(w, h).open(false, null);
  let t = await r.timed('sign-in (first screen)', () => r.pg.goto(`${BASE}/?splash=0&fx=0`), 'input, .acctcard, .formmsg, button', 60000);
  await wait(1500); await r.shot('signin-first'); await r.audit('sign-in first screen');
  console.log('sign-in', t, 'ms', await r.pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)));
  await r.close();

  /* the server never answers: "Orlis is asleep" (the PC is online) and "not online" */
  for (const [label, online, file] of [['asleep', true, 'signin-asleep'], ['offline', false, 'signin-offline']]){
    r = await new Run(w, h).open(false, async (ctx) => {
      await ctx.route('https://www.msftconnecttest.com/**', (rt) => online ? rt.fulfill({ status: 200, body: 'Microsoft Connect Test' }) : rt.abort());
      await ctx.route(HOME_SERVER.replace(/\/$/, '') + '/**', (rt) => rt.abort());
    });
    await r.ctx.addInitScript(`window.__TAURI__ = { core: { invoke: async () => [] } };`);
    t = await r.timed('sign-in ' + label, () => r.pg.goto(`${BASE}/?splash=0&fx=0`), 'text=/asleep|online/', 60000);
    await r.shot(file); await r.audit('sign-in ' + label);
    console.log(label, t, 'ms', (await r.pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300))));
    await r.close();
  }

  /* ---------- B. signed in: Who's playing, Home, Discover, a game page, Profile, Settings ---------- */
  r = await new Run(w, h).open(true);
  const pg = r.pg;
  t = await r.timed("Who's playing", () => pg.goto(`${BASE}/?splash=0&fx=0&mode=player`), '.acctcard .who', 60000);
  await r.shot('who-playing'); await r.audit("Who's playing");
  console.log('who', t);
  /* by remote: what is lit first, then the arrows */
  await pg.keyboard.press('ArrowRight'); await wait(300);
  await r.sweep("Who's playing (remote)", ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp']);
  await r.shot('who-remote');
  /* pick the first grown-up by mouse */
  t = await r.timed('Home (after Who)', () => pg.click('.acctcard .who >> text=Deep'), '.htile.game', 60000);
  await wait(1500); await r.shot('home-featured'); const home = await r.audit('Home (Featured)');
  console.log('home', t, 'focus', JSON.stringify(home.focus), 'off', home.offscreen.slice(0, 3));
  /* remote on Home: along the Featured row, down to My library, along it, back up */
  await r.sweep('Home (remote)', ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
  await r.shot('home-remote-end');
  await pg.keyboard.press('ArrowDown'); await wait(500); await pg.keyboard.press('ArrowDown'); await wait(800);
  await r.shot('home-library'); await r.audit('Home (My library, remote)');
  console.log('home library focus', JSON.stringify((await pg.evaluate(AUDIT)).focus));
  /* by mouse: hover a tile (does it show it is lit?) */
  await pg.hover('.htile.game >> nth=2'); await wait(500); await r.shot('home-hover');
  /* the remote: Up until the top bar is lit (as many Ups as there are rows above) */
  const toTabs = async () => { for (let i = 0; i < 5; i++){ const f = (await pg.evaluate(AUDIT)).focus.map(x => x.el).join(' '); if (/ptab|chpill|hme/.test(f)) return i; await pg.keyboard.press('ArrowUp'); await wait(350); } return -1; };
  /* ---- Back, from the remote only: where does it go? ---- */
  const where = async () => pg.evaluate(() => ({ mode: window.__mode && window.__mode(), tab: (document.querySelector('.ptab.cur') || {}).textContent || null, title: (document.querySelector('h1,h2,.hhead') || {}).textContent || null }));

  /* ---- Discover (by mouse), its tiles by remote, Back ---- */
  await pg.keyboard.press('ArrowUp'); await wait(300);
  t = await r.timed('Discover', () => pg.click('.htile.discover'), '.homebtn', 60000);
  await wait(800); await r.shot('discover'); const dsc = await r.audit('Discover');
  console.log('discover', t, 'ms', 'focus', JSON.stringify(dsc.focus.map(f => f.el)), 'overlap', dsc.overlaps.length);
  await r.sweep('Discover (remote)', ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowLeft']);
  await r.shot('discover-remote');
  await pg.keyboard.press('Escape'); await wait(1200);
  const afterBack = await where(); results.screens.push({ screen: 'Discover > Back (Escape)', w, ...afterBack });
  console.log('discover Back ->', JSON.stringify(afterBack));
  if (afterBack.mode !== 'menu'){ note(r, 'Discover', 'Escape does not go Home (mode ' + afterBack.mode + ')'); await pg.evaluate(() => window.__go.toMenu()); await wait(1500); }

  /* ---- Create (the tab, by remote: Up, Right, Enter) ---- */
  const ups = await toTabs(); results.screens.push({ screen: 'Home: Ups from My library to the top bar', w, ups });
  await pg.keyboard.press('ArrowRight'); await wait(300);
  const tabFocus = (await pg.evaluate(AUDIT)).focus.map(f => f.el);
  t = await r.timed('Create home (remote Enter on the tab)', () => pg.keyboard.press('Enter'), '.cmake .chero, .chero', 60000);
  console.log('create via remote: focus on tab was', JSON.stringify(tabFocus), t, 'ms');
  await wait(1000); await r.shot('create-home'); const cr = await r.audit('Create home');
  console.log('create', 'overlap', cr.overlaps.length, 'off', cr.offscreen.length, 'clipped', cr.clipped.length);
  await r.sweep('Create home (remote)', ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp']);
  await r.shot('create-home-remote');
  await pg.keyboard.press('Escape'); await wait(1200);
  const cb = await where(); results.screens.push({ screen: 'Create home > Back (Escape)', w, ...cb }); console.log('create Back ->', JSON.stringify(cb));
  if (cb.mode === 'create') await pg.evaluate(() => window.__go.toMenu());
  await wait(1500);

  /* ---- the profile face: Profile, Settings, Testing ---- */
  await toTabs(); for (let i = 0; i < 3; i++){ await pg.keyboard.press('ArrowRight'); await wait(250); }
  console.log('on the way to the face the remote lit', JSON.stringify((await pg.evaluate(AUDIT)).focus.map(f => f.el)));
  t = await r.timed('Profile sheet (face, remote Enter)', () => pg.keyboard.press('Enter'), '.hsheet', 30000);
  await r.shot('profile-sheet'); const ps = await r.audit('Profile sheet');
  console.log('profile sheet', t, 'items', await pg.$$eval('.sheetitem', e => e.map(x => x.textContent.trim())), 'overlap', ps.overlaps.length);
  await r.sweep('Profile sheet (remote)', ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp']);
  t = await r.timed('Settings', async () => { await pg.locator('.sheetitem', { hasText: 'Settings' }).click(); }, '.setcard', 30000);
  await wait(500); await r.shot('settings'); const st = await r.audit('Settings');
  console.log('settings', t, 'ms', 'overlap', st.overlaps.length, 'off', st.offscreen.length, 'clipped', st.clipped.length);
  await r.sweep('Settings (remote)', ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);
  await r.shot('settings-remote-end');
  await pg.evaluate(() => { const c = document.querySelector('.setcard'); if (c) c.scrollTop = 99999; const s = document.querySelector('.setscreen'); if (s) s.scrollTop = 99999; });
  await wait(500); await r.shot('settings-testing'); const st2 = await r.audit('Settings > Testing (scrolled)');
  console.log('settings testing rows', await pg.$$eval('.setrow .setname, .setgroup', e => e.map(x => x.textContent.trim())).catch(() => []));
  await pg.keyboard.press('Escape'); await wait(1000);
  const sb = await where(); results.screens.push({ screen: 'Settings > Back (Escape)', w, ...sb }); console.log('settings Back ->', JSON.stringify(sb), 'sheet open:', await pg.$('.hsheet') != null, 'settings open:', await pg.$('.setcard') != null);
  if (await pg.$('.setcard')){ note(r, 'Settings', 'Escape does not close Settings'); await pg.locator('.setscreen .homebtn').click().catch(() => {}); await wait(600); }
  /* Profile (Who's playing) from the sheet; Games on this TV */
  if (!(await pg.$('.hsheet'))) await pg.click('.hme').catch(() => {}); await wait(600);
  if (await pg.$('.sheetitem >> text=Games on this TV')){
    await pg.locator('.sheetitem', { hasText: 'Games on this TV' }).click(); await wait(1500); await r.shot('games-on-this-tv'); await r.audit('Games on this TV');
    await pg.keyboard.press('Escape'); await wait(800);
  }
  await pg.keyboard.press('Escape'); await wait(600);
  await pg.evaluate(() => window.__go.toMenu()); await wait(1500);

  /* ---- Get (install and play), then an Update ---- */
  await pg.evaluate(() => window.__go.toStore()); await pg.waitForSelector('.htile.get', { timeout: 30000 }); await wait(1000);
  const t0 = Date.now();
  await pg.keyboard.press('Enter');       /* the remote's OK on the lit Get tile */
  let got = null;
  for (let i = 0; i < 80 && !got; i++){ await wait(250); const m = await pg.evaluate(() => ({ mode: window.__mode(), getting: !!document.querySelector('.htile.getting'), txt: document.body.innerText.slice(0, 80) })); if (i === 1) await r.shot('get-progress'); if (m.mode !== 'store') got = m; }
  results.timings.push({ screen: 'Get (OK on the tile) until the next screen', w, ms: Date.now() - t0 });
  console.log('Get ->', JSON.stringify(got), Date.now() - t0, 'ms');
  await wait(1500); await r.shot('get-next'); await r.audit('after Get (lineup)');
  await r.close();
}

/* ---------- C. the camera check, the line-up, pause (a game, with the scripted bodies: no ?debug, so the real camera path is used) ---------- */
for (const [w, h] of SIZES){
  console.log('=== game screens ' + w + 'x' + h);
  const r = await new Run(w, h).open(true), pg = r.pg;
  await pg.goto(`${BASE}/?splash=0&fx=0&mode=player`);
  await pg.waitForSelector('.acctcard .who', { timeout: 60000 }); await pg.click('.acctcard .who >> text=Deep'); await pg.waitForSelector('.htile.game', { timeout: 60000 }); await wait(1000);
  await pg.evaluate(async () => { window.__ptm = await import('/tools/playtest/page.mjs'); });
  /* the camera check: nobody in view (a fake camera shows no one), then four people */
  let t = await r.timed('Camera check (nobody in view)', () => pg.evaluate(() => window.__go.toCalibration()), '.screen', 30000);
  await wait(2500); await r.shot('camera-check-nobody'); const cc0 = await r.audit('Camera check (nobody)');
  console.log('camera check, nobody:', await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 260)), 'overlap', cc0.overlaps.length);
  await pg.evaluate(() => window.__ptm.bodies({ lineup: '4m' })); await wait(3500);
  await r.shot('camera-check-4'); const cc4 = await r.audit('Camera check (4 people)');
  console.log('camera check, four:', await pg.evaluate(() => `${window.__mode()} :: ` + document.body.innerText.replace(/\s+/g, ' ').slice(0, 260)));
  await pg.keyboard.press('Escape'); await wait(1200);
  console.log('camera check Back ->', await pg.evaluate(() => window.__mode()));
  /* the line-up ("Who's who?"), with the four people in view, then the round, then pause */
  await pg.evaluate(async () => { const { byId } = await import('/src/games/index.js'); window.__go.toGame(byId('pop-party')); });
  const t1 = Date.now();
  await pg.waitForFunction(() => ['lineup', 'framing', 'starting', 'play'].includes(window.__mode()), null, { timeout: 30000 }).catch(() => {});
  console.log('after toGame mode', await pg.evaluate(() => window.__mode()), Date.now() - t1, 'ms');
  await wait(1500); await r.shot('lineup-4'); await r.audit('Line-up (Who is who, 4 in view)');
  console.log('lineup text:', await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)));
  await pg.evaluate(() => window.__ptm.bodies({ lineup: '4m' }));
  for (let i = 0; i < 30; i++){ const m = await pg.evaluate(() => window.__mode()); if (m === 'play') break; if (m === 'lineup' || m === 'framing'){ await pg.keyboard.press('Enter'); } await wait(1000); }
  console.log('mode', await pg.evaluate(() => window.__mode()));
  await wait(4000); await r.shot('play-4-start');
  t = await r.timed('Pause (Escape)', () => pg.keyboard.press('Escape'), '.pause', 20000);
  await r.shot('pause-4'); const pa = await r.audit('Pause (4 players)');
  console.log('pause', t, 'ms', await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)), 'overlap', pa.overlaps.length, 'focus', JSON.stringify(pa.focus.map(f => f.el)));
  await r.sweep('Pause (remote)', ['ArrowRight', 'ArrowLeft', 'ArrowDown']);
  await r.shot('pause-4-remote');
  await pg.keyboard.press('Escape'); await wait(800);
  console.log('Escape again (resume) -> paused card gone:', (await pg.$('.pause')) == null, 'mode', await pg.evaluate(() => window.__mode()));
  /* everyone leaves: the "step back in" card */
  await pg.evaluate(() => window.__ptm.nobody()); await wait(4500); await r.shot('lost-everyone'); await r.audit('Everyone left (lost card)');
  console.log('everyone left:', await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)));
  await r.close();
}

/* ---------- the server's own pages: later (tools/playtest2-server.mjs) ---------- */
writeFileSync(join(OUT, 'screens.json'), JSON.stringify(results, null, 1));
console.log('issues', results.issues.length, 'errors', results.errors.length);
await browser.close(); await s.close();
