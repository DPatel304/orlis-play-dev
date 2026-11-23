/* Pictures of the clean menus (plan packages U5, U7 and the U6 fixes; decision 0045), at 1920x1080, deviceScaleFactor 1, into docs/u5/.
   Each one matches a frame of the approved mockup (docs/screens-mockup.html). The real app is driven in headless Chromium, with a stand-in for the
   Windows app's shell (window.__TAURI__) and a pretend family server answered from the page, so the sign-in screens, Who's playing? and the
   profile are the real ones. A camera is faked (and the tracker's picture replaced by scripted bodies).

     cd app && npx vite --port 5191 --strictPort &
     node tools/u5-shots.mjs [out-dir] [--only home-rest,pause]

   Needs Playwright and Chrome (PLAYWRIGHT_PATH, CHROME_PATH override the defaults). Frame rates in headless Chromium mean nothing; the pictures do. */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const only = (opt('only', '') || '').split(',').filter(Boolean);
const BASE = opt('url', 'http://127.0.0.1:5191');
const OUT = resolve(args[0] || join(here, '..', 'docs', 'u5'));
mkdirSync(OUT, { recursive: true });
const want = (n) => !only.length || only.includes(n);

/* ---------- the pretend family ---------- */
const LOOKS = {
  mia: { colour: 'sky', face: { eyes: 'happy', mouth: 'grin' }, top: 'bow', outfit: 'stripes', outfitColour: 'ui.gold', extra: 'cheeks' },
  leo: { colour: 'orange', face: { eyes: 'wink', mouth: 'cat' }, top: 'cap', outfit: 'overalls', outfitColour: 'touch.skyBlue', extra: 'none' },
  ava: { colour: 'green', face: { eyes: 'star', mouth: 'grin' }, top: 'flower', outfit: 'dots', outfitColour: 'ui.go', extra: 'freckles' }
};
const PROFILES = [
  { id: 'p-mia', name: 'Mia', avatar: 'cube', look: LOOKS.mia, accountId: 'a1' },
  { id: 'p-leo', name: 'Leo', avatar: 'cube', look: LOOKS.leo, accountId: 'a1' },
  { id: 'p-ava', name: 'Ava', avatar: 'cube', look: LOOKS.ava, accountId: 'a1' },
  { id: 'p-guest', name: 'Guest', avatar: 'cube', look: null, accountId: 'a1' }
];
const SERVER = { url: 'http://orlis.test', name: 'The Parkers’ Orlis', id: 'srv1' };
const ME = { server: SERVER, token: 't', account: { id: 'a1', email: 'grown-up@family.example', role: 'owner', devkit: true }, household: { id: 'h1', name: 'The Parkers' }, profiles: PROFILES, current: 'p-mia' };
const STORE = { featured: ['s-ptero', 's-keep', 's-gym'], games: [
  { id: 's-ptero', name: 'Pterry Flight', version: '1.0', blurb: 'Glide over a world of dinosaurs', icon: { cols: ['#e0915b', '#6fc3c0'], glyph: '' }, added: '2026-11-20T00:00:00Z' },
  { id: 's-keep', name: 'Keep It Up!', version: '1.0', blurb: 'Keep the ball up in the air', icon: { cols: ['#4da3ff', '#ff7eb3'], glyph: '' }, added: '2026-11-19T00:00:00Z' },
  { id: 's-gym', name: 'Animal Gym', version: '1.0', blurb: 'Move like the animals', icon: { cols: ['#34b27b', '#ffd35c'], glyph: '' }, added: '2026-11-18T00:00:00Z' }] };

const flags = ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: flags });

/* a fresh page: optionally the Windows app's shell (a signed-in or signed-out family), the pretend server, and Big Picture */
async function open({ app = false, signedIn = true, bigPicture = false, query = '', store = false, requests = [], slots = { used: 1, total: 3 }, waiting = false } = {}){
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, permissions: ['camera'] });
  const page = await ctx.newPage();
  const acct = waiting ? { ...ME.account, waiting: true, role: 'creator' } : ME.account;
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.route('http://orlis.test/**', async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname, cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (o, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (path === '/api/hello') return json({ app: 'orlis', id: SERVER.id, name: SERVER.name, setup: false, invite: true });
    if (path === '/api/account-exists') return json({ exists: true });
    if (path === '/api/signin') return json({ token: 't', account: acct, household: ME.household, profiles: PROFILES });
    if (path === '/api/me') return json({ account: acct, household: ME.household, profiles: PROFILES });
    if (path === '/api/store') return json(store ? STORE : { games: [], featured: [] });
    if (path === '/api/challenges') return json({ week: 1, ends: '2026-12-01', challenges: [], stars: 0 });
    if (path === '/api/requests') return json({ requests, slots });
    return json({});
  });
  await page.addInitScript(({ app, signedIn, bigPicture, ME, SERVER }) => {
    if (app){
      window.__TAURI__ = { core: { invoke: async (cmd) => (cmd === 'find_servers' ? [{ url: SERVER.url, name: SERVER.name }] : null) }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };
      localStorage.setItem('orlis.account', JSON.stringify(signedIn ? ME : { server: SERVER }));
    } else if (signedIn) localStorage.setItem('orlis.account', JSON.stringify(ME));
    if (bigPicture){ window.ORLIS_DISPLAY = 'bigpicture'; window.orlisDisplay = { mode: 'bigpicture', set: async () => {} }; }
    window.ORLIS_LABEL = { beta: false };                  /* (no build stamp in the pictures) */
  }, { app, signedIn, bigPicture, ME: waiting ? { ...ME, account: { ...ME.account, waiting: true, role: 'creator' } } : ME, SERVER });
  await page.goto(`${BASE}/?fx=0&splash=0${query}`);
  return { page, ctx };
}
const sleep = (page, ms) => page.waitForTimeout(ms);
const shoot = async (page, name) => { await page.screenshot({ path: join(OUT, name + '.png') }); console.log('  ' + name + '.png'); };
const toHome = async (page) => { await page.waitForFunction(() => window.__scene && window.__scene().rows, null, { timeout: 40000 }); await sleep(page, 1800); };

/* ---------- Home ---------- */
if (want('home-rest') || want('home-focus') || want('home-scrolled') || want('home-profile')){
  const { page, ctx } = await open({ store: true, query: '&hidden=1' });
  await toHome(page);
  /* (a profile face, and the games to get) */
  await page.evaluate(async () => { const w = window.__week; w.store = { featured: ['s-ptero', 's-keep', 's-gym'], games: [
    { id: 's-ptero', name: 'Pterry Flight', version: '1.0', blurb: 'Glide over a world of dinosaurs', icon: { cols: ['#e0915b', '#6fc3c0'], glyph: '' } },
    { id: 's-keep', name: 'Keep It Up!', version: '1.0', blurb: 'Keep the ball up in the air', icon: { cols: ['#4da3ff', '#ff7eb3'], glyph: '' } },
    { id: 's-gym', name: 'Animal Gym', version: '1.0', blurb: 'Move like the animals', icon: { cols: ['#34b27b', '#ffd35c'], glyph: '' } }] }; window.__home(); });
  await toHome(page); await sleep(page, 1500);
  if (want('home-rest')) { await shoot(page, 'home-rest'); }
  if (want('home-focus')) { await page.evaluate(() => { const s = window.__scene(); s.focusAt({ row: 0, col: s.items.findIndex(t => t.item.g && t.item.g.id === 'sleepy-bear') }); }); await sleep(page, 900); await shoot(page, 'home-focus-moved'); }
  if (want('home-scrolled')) { await page.evaluate(() => { const s = window.__scene(); s.focusAt({ row: 1, col: 1 }); }); await sleep(page, 1100); await shoot(page, 'home-scrolled'); }
  if (want('home-profile')) { await page.evaluate(() => window.__scene().focusAt({ row: 0, col: 0 })); await sleep(page, 700); await page.click('.hme'); await sleep(page, 700); await shoot(page, 'home-profile'); }
  await ctx.close();
}

/* ---------- Hand mode: pointing, and between rows ---------- */
/* a standing body through pose._assign, ten looks a second, with the pointing hand where the script says */
const SCRIPT = `(() => {
  const pose = window.__pose; pose.update = () => {};
  const S = { hand: { x: 0.5, y: 0.35 }, gone: false }; window.__S = S;
  const body = () => { const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 0.95 })); const set = (i, x, y) => { lm[i] = { x, y, z: 0, v: 0.95 }; };
    set(0, 0.5, 0.2); set(2, 0.48, 0.18); set(5, 0.52, 0.18); set(11, 0.44, 0.32); set(12, 0.56, 0.32); set(13, 0.4, 0.42); set(14, 0.6, 0.42); set(15, 0.4, 0.55);
    set(23, 0.46, 0.62); set(24, 0.54, 0.62); set(25, 0.46, 0.8); set(26, 0.54, 0.8); set(27, 0.46, 0.95); set(28, 0.54, 0.95); set(16, S.hand.x, S.hand.y); return lm; };
  setInterval(() => { if (S.gone) { pose._assign([], 0.1); return; } pose.on = true; pose.ready = true; pose._assign([body()], 0.1); }, 100);
})()`;
/* Mia's hand (the scripted one) over a button, waving until the ring is part way round - then stopped, for the picture */
async function waveAt(page, sel){
  const b = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; }, sel);
  await page.evaluate(([x, y]) => { window.__S.hand = { x, y }; }, [b.x, b.y]); await sleep(page, 900);
  for (let i = 0; i < 8; i++){
    const turns = await page.evaluate(() => window.__cursor._state[0].turns);
    if (turns >= 1) break;
    await page.evaluate(([x, y]) => { window.__S.hand = { x, y }; }, [b.x + (i % 2 ? 0.04 : -0.04), b.y]); await sleep(page, 110);
  }
}

/* ---------- a round: loading, pause, results ---------- */
/* Home, then Pop Party picked with the mouse (so the launch cover and the loading card show), with `kids` standing in front of the camera (scripted
   bodies; pose.cap lets that many in) and lined up as Mia, Leo and Ava. shot(name, wait) takes the loading picture on the way in. */
async function startRound(kids, { loading = false, best = null } = {}){
  const { page, ctx } = await open({ query: '&hand=1' });
  await toHome(page);
  if (best) await page.evaluate(([k, v]) => localStorage.setItem(k, v), best);        /* (an earlier best, so this one is a new best) */
  await page.evaluate(({ kids }) => {
    const pose = window.__pose; pose.cap = kids.length; pose.update = () => {};
    window.__crew.lined = true; kids.forEach((id, i) => window.__crew.set(i, id));
    const S = { hand: null }; window.__S = S;
    const xs = kids.length === 1 ? [0.5] : kids.length === 2 ? [0.35, 0.65] : [0.25, 0.5, 0.75];
    const body = (cx, i) => { const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, v: 0.95 })); const set = (k, dx, y) => { lm[k] = { x: cx + dx, y, z: 0, v: 0.95 }; };
      set(0, 0, 0.2); set(2, -0.02, 0.18); set(5, 0.02, 0.18); set(11, -0.06, 0.32); set(12, 0.06, 0.32); set(13, -0.1, 0.42); set(14, 0.1, 0.42); set(15, -0.1, 0.55); set(16, 0.1, 0.55);
      set(23, -0.04, 0.62); set(24, 0.04, 0.62); set(25, -0.04, 0.8); set(26, 0.04, 0.8); set(27, -0.04, 0.95); set(28, 0.04, 0.95);
      if (i === 0 && S.hand) lm[16] = { x: S.hand.x, y: S.hand.y, z: 0, v: 0.95 };
      return lm; };
    setInterval(() => { pose.on = true; pose.ready = true; pose._assign(xs.map(body), 0.1); }, 100);
  }, { kids });
  await sleep(page, 1200);
  await page.evaluate(() => { const t = [...document.querySelectorAll('.htile.game')].find(e => e.querySelector('.hname')?.textContent === 'Pop Party'); t.click(); });
  if (loading){ await sleep(page, 1050); await shoot(page, 'loading'); }
  await page.waitForFunction(() => window.__mode && window.__mode() === 'play', null, { timeout: 30000 });
  await sleep(page, 2500);
  return { page, ctx };
}
if (want('loading') || want('pause')){
  const { page, ctx } = await startRound(['p-mia', 'p-leo', 'p-ava'], { loading: want('loading') });
  if (want('pause')){
    await page.evaluate(() => window.__go.openPause());
    await sleep(page, 900);
    await waveAt(page, '.pause .btn.cbtn');
    await shoot(page, 'pause');
  }
  await ctx.close();
}
for (const [name, kids, scores] of [['results-1', ['p-mia'], [21]], ['results-3', ['p-mia', 'p-leo', 'p-ava'], [12, 9, 17]]]){
  if (!want(name)) continue;
  const { page, ctx } = await startRound(kids, { best: kids.length === 1 ? ['orlis_best_pop-party_1p', '15'] : null });
  await page.evaluate((scores) => { const r = window.__round(); scores.forEach((v, i) => { r.score[i] = v; }); window.__finish(); }, scores);
  await page.waitForFunction(() => window.__mode() === 'results', null, { timeout: 90000 });
  await sleep(page, 2500);
  await waveAt(page, '.end .btn.cbtn');
  await shoot(page, name);
  await ctx.close();
}

/* ---------- the account screens, Settings and Create (the Windows app's shell, Big Picture) ---------- */
if (want('signin')){
  const { page, ctx } = await open({ app: true, signedIn: false, bigPicture: true });
  await page.waitForSelector('.acctform input[type=email]', { timeout: 40000 });
  await page.fill('.acctform input[type=email]', 'grown-up@family.example'); await page.keyboard.press('Enter');
  await page.waitForSelector('.acctform input[type=password]', { timeout: 15000 });
  await page.fill('.acctform input[type=password]', 'hunter2hunter2'); await page.click('.acctform input[type=email]');
  await sleep(page, 900); await shoot(page, 'signin');
  await ctx.close();
}
if (want('who') || want('settings') || want('edit-child')){
  const { page, ctx } = await open({ app: true, signedIn: true, bigPicture: true });
  await page.waitForSelector('.whotiles .btn.who', { timeout: 40000 });
  await sleep(page, 1500);
  if (want('who')){ const leo = await page.$$('.whotiles .btn.who'); await leo[1].hover(); await sleep(page, 700); await shoot(page, 'whos-playing'); await page.mouse.move(5, 5); }
  if (want('edit-child')){ await page.click('.whocell:nth-child(2) .whoedit'); await sleep(page, 800); await shoot(page, 'edit-child'); await page.keyboard.press('Escape'); }
  if (want('settings')){
    await page.click('.whotiles .btn.who >> nth=0'); await toHome(page);
    await page.click('.hme'); await sleep(page, 500); await page.click('.sheetitem >> nth=1'); await sleep(page, 900); await shoot(page, 'settings');
  }
  await ctx.close();
}
async function create(name, { fn, ...o }){
  if (!want(name)) return;
  const { page, ctx } = await open({ app: true, signedIn: true, bigPicture: true, ...o });
  await page.waitForSelector('.whotiles .btn.who', { timeout: 40000 }); await sleep(page, 600); await page.click('.whotiles .btn.who >> nth=0');
  await toHome(page); await page.evaluate(fn); await sleep(page, 2500);
  await shoot(page, name);
  await ctx.close();
}
await create('create', { fn: () => window.__go.toCreate() });
await create('create-pro', { fn: () => window.__go.toPro() });
await create('create-no-slots', { fn: () => window.__go.toCreate(), slots: { used: 0, total: 0 } });
await create('create-slots-used', { fn: () => window.__go.toCreate(), slots: { used: 3, total: 3 } });
await create('create-requests', { fn: () => window.__go.toCreate('requests'), requests: [{ id: 'r1', state: 'making', recipe: { thing: 'balloons', action: 'pop' }, sentence: 'A game where you pop balloons.' }, { id: 'r2', state: 'waiting', recipe: { name: 'Rainbow Flyer', thing: 'rainbows', action: 'steer' }, sentence: '' }] });
await create('create-pending', { fn: () => window.__go.toCreate(), waiting: true });

await browser.close();
