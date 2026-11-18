// The modes, against a real server: with nothing said the app is the Creator app (for now): only Create
// and Create Pro, it can't play, and has no volume or camera in Settings; as the Player app
// (?mode=player) it has Play, Discover and Create and no Create Pro.
// Create Pro is the Dev Kit - the Windows app is pretend here (the folders are kept in memory).
//   cd app && npx vite --port 5191 &
//   NODE_PATH=$(npm root -g) node tools/rehearsal-creator.cjs http://localhost:5191/ /tmp/creator ../server
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const [appUrl, out, serverDir] = process.argv.slice(2);
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-creator-'));
const srv = cp.spawn(process.execPath, ['--no-warnings', 'src/main.js'], { cwd: serverDir,
  env: { ...process.env, ORLIS_DATA: data, ORLIS_NAME: 'Home', ORLIS_MAKER: 'false', ORLIS_NO_TRAY: '1', ORLIS_NO_UPDATE: '1' } });
const S = 'http://127.0.0.1:47871';
const log = (...a) => console.log(...a);
const fail = [];
const check = (ok, what) => { log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let KEY = null;
const api = async (m, p, b, t, extra = {}) => {
  const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(KEY ? { 'X-Orlis-Manage': KEY } : {}), ...extra }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
/* the pretend Windows app is the one the creator rehearsal uses */
const src = fs.readFileSync(path.join(__dirname, 'rehearsal.cjs'), 'utf8');
const a = src.indexOf('const TAURI = `') + 'const TAURI = `'.length;
const TAURI = new Function('S', 'return `' + src.slice(a, src.indexOf('`;\n', a)) + '`')(S);
const tabsOf = (pg) => pg.$$eval('.tvtab', e => e.map(x => x.textContent.trim()));
const txt = async (pg, sel) => ((await pg.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim();

(async () => {
  for (let i = 0; i < 40; i++){ try { await fetch(S + '/api/hello'); break; } catch { await wait(250); } }
  KEY = fs.readFileSync(path.join(data, 'manage.key'), 'utf8').trim();
  const me = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
  await api('POST', `/api/accounts/${me.account.id}/devkit`, { on: true });
  const state = { server: { url: S, name: 'Home' }, token: me.token, account: { ...me.account, devkit: true }, household: me.household, profiles: me.profiles, current: me.profiles[0].id };
  const b = await chromium.launch();
  const open = async (query) => {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.route(/\.ts\.net\//, r => r.abort());
    await ctx.addInitScript(TAURI + `localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))});`);
    const pg = await ctx.newPage(); pg.errs = [];
    pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) pg.errs.push(e.message); });
    await pg.goto(appUrl + '?debug&splash=0&fx=0' + query);
    await pg.waitForSelector('.tvtop', { timeout: 25000 }); await pg.waitForTimeout(1500);
    return pg;
  };

  log('\n1. Nothing said: the Creator app, for now');
  let pg = await open('');
  check((await tabsOf(pg)).join('|') === 'Create|Create Pro' && !!(await pg.$('.tvtab.on >> text=Create Pro')), 'Create and Create Pro, opening on Create Pro: ' + (await tabsOf(pg)).join(', '));
  await pg.context().close();

  log('\n1b. Switching, for testing: Settings has a Mode switch');
  pg = await open('');
  await pg.keyboard.press('Escape'); await wait(900);
  await pg.click('.burger'); await wait(400); await pg.click('.popitem >> text=Settings'); await wait(500);
  check((await pg.$$eval('.setname', e => e.map(x => x.textContent))).includes('Mode'), 'Settings has a Mode row');
  await pg.click('.seg .setbtn >> text=Player'); await wait(1800);
  check((await tabsOf(pg)).join('|') === 'Play|Discover|Create' && !!(await pg.$('.tvtab.on >> text=Play')), 'Player: Play, Discover, Create, on Play: ' + (await tabsOf(pg)).join(', '));
  await pg.click('.burger'); await wait(400); await pg.click('.popitem >> text=Settings'); await wait(500);
  await pg.click('.seg .setbtn >> text=Creator'); await wait(1800);
  check((await tabsOf(pg)).join('|') === 'Create|Create Pro', 'and back to Creator: ' + (await tabsOf(pg)).join(', '));
  await pg.context().close();

  log('\n2. The Player app: Play, Discover and Create, no Create Pro');
  pg = await open('&mode=player');
  const fam = await tabsOf(pg);
  check(fam.join('|') === 'Play|Discover|Create' && !!(await pg.$('.tvtab.on >> text=Play')), 'Play, Discover, Create, opening on Play: ' + fam.join(', '));
  await pg.context().close();

  log('\n3. The Creator app: only Create and Create Pro; it cannot play');
  pg = await open('&mode=creator');
  check(!!(await pg.$('.tvtab.on >> text=Create Pro')), 'it opens on Create Pro, not Play');
  check((await pg.$$('.shelf')).length === 0 && !(await pg.$('.shero .sbtn.play')), 'no games on show');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(900);
  const st = await tabsOf(pg);
  check(st.join('|') === 'Create|Create Pro' && !!(await pg.$('.tvtab.on >> text=Create Pro')), 'the tabs are Create and Create Pro: ' + st.join(', '));
  check(!(await pg.$('.challengepill, .chpill')), 'no weekly challenges');
  await pg.mouse.move(800, 20); await wait(300);
  await pg.screenshot({ path: out + '-creator-create.png' });
  /* Settings: nothing about volume or the camera */
  await pg.click('.burger'); await wait(400);
  await pg.click('.popitem >> text=Settings'); await wait(500);
  const rows = await pg.$$eval('.setname', e => e.map(x => x.textContent));
  check(!rows.includes('Volume') && !rows.includes('Camera') && rows.includes('Display'), 'Settings has no volume or camera: ' + rows.join(', '));
  await pg.click('.setclose'); await wait(400);
  await pg.evaluate(() => [...document.querySelectorAll('.tvtab')].find(t => t.textContent.trim() === 'Create').click()); await wait(1800);
  /* the questions work, and what is on its way shows below them */
  check((await pg.getAttribute('.bh', 'data-q')) === 'What do you do?', 'the questions are here');
  await pg.click('.bcard >> text=Pop'); await wait(1000);
  await pg.click('.bdown'); await wait(400);
  for (let i = 0; i < 3; i++){ await pg.click('.bdown'); await wait(400); }
  await pg.click('.bpill >> text=Send it');
  await pg.waitForSelector('.bsent', { timeout: 8000 });
  check((await txt(pg, '.bsent')).includes('below') && !(await pg.$('.bpill >> text=See it on Play')), 'sent: it says where to look, and there is no Play to go to');
  await pg.click('.bpill >> text=Make another'); await wait(1500);
  check(!!(await pg.$('.shelf.building .buildingtile')), 'what is on its way is shown under the questions');
  await pg.$eval('.shelf.building', e => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await pg.screenshot({ path: out + '-creator-below.png' });

  log('\n4. Create Pro: the Dev Kit');
  await pg.keyboard.press('Escape'); await wait(900);
  await pg.click('.tvtab >> text=Create Pro'); await wait(1800);
  check(!!(await pg.$('.createpage')) && (await txt(pg, '.shero h1')).includes('Claude Code'), 'Create Pro: ' + (await txt(pg, '.shero h1')));
  const btns = await pg.$$eval('.sbtns .sbtn', e => e.map(x => x.textContent.trim()));
  check(btns.some(x => /Build a game/.test(x)) && btns.some(x => /Dev Kit/.test(x)), 'its buttons: ' + btns.join(' | '));
  check(!(await pg.$('.builder')), 'no picture questions on this page');
  await pg.click('.sbtn >> text=Build a game'); await wait(800);
  await pg.fill('.fpop input.finput', 'Firefly Jar'); await pg.fill('.fpop textarea', 'Catch fireflies in a jar');
  await pg.click('.fpop .btn.go'); await wait(1500);
  const asked = await pg.evaluate(() => window.__claudeAsked);
  check(!!asked && /Firefly Jar/.test(asked.folder), 'Claude Code opened on the new folder');
  await pg.keyboard.press('Escape'); await wait(500);
  await pg.screenshot({ path: out + '-pro.png' });
  const card = await pg.$('.sshelf .slock');
  if (card){
    await card.click(); await wait(600);
    const acts = await pg.$$eval('.cacts .btn', e => e.map(x => x.textContent.trim()));
    check(!acts.some(x => /Try it|send/i.test(x)) && acts.includes('Test on the TV') && acts.includes('Publish'), 'a game here: Test on the TV and Publish, no Try it, no Send: ' + acts.join(' | '));
    await pg.click('.cacts .btn >> text=Publish'); await wait(800);
    check((await txt(pg, '.ferr, .toast')).length >= 0 && (await api('GET', '/api/store', null, me.token)).games.every(g => !/firefly/i.test(g.id)), 'Publish before Test does nothing');
    await pg.keyboard.press('Escape'); await wait(300);
    await pg.click('.sshelf .slock'); await wait(600);
    await pg.click('.cacts .btn >> text=Test on the TV'); await wait(2500);
    const dr = (await api('GET', '/api/drafts', null, me.token)).drafts || [];
    check(dr.length === 1 && /firefly/i.test(dr[0].id), 'Test put it on the TV: ' + dr.map(d => d.id).join(','));
    await pg.screenshot({ path: out + '-tested.png' });
    const tvp = await open('&mode=player'); await wait(3000);
    check((await tvp.$$eval('.shelf.testing .testtile', e => e.length)) === 1, 'the TV (Player app) shows it in a Testing row');
    await tvp.$eval('.shelf.testing', e => e.scrollIntoView({ block: 'center' })).catch(() => {});
    await tvp.screenshot({ path: out + '-tv-testing.png' });
    await tvp.context().close();
    await pg.click('.sshelf .slock'); await wait(600);
    await pg.click('.cacts .btn >> text=Publish'); await wait(2500);
    const st2 = (await api('GET', '/api/store', null, me.token)).games.find(g => /firefly/i.test(g.id));
    check(!!st2 && st2.reach === 'family' && st2.mine === true, 'Publish put it in the family\'s Store: ' + (st2 && st2.id));
    await pg.screenshot({ path: out + '-published.png' });
    const tvp2 = await open('&mode=player'); await wait(5000);
    const names = await tvp2.$$eval('.pictile .nm, .slock .nm', e => e.map(x => x.textContent));
    check(!(await tvp2.$('.shelf.testing')), 'and the Testing row is gone');
    check(await tvp2.evaluate(() => [...window.__library.installed.keys()].some(k => /firefly/.test(k))), 'the TV downloaded it by itself: ' + (await tvp2.evaluate(() => [...window.__library.installed.keys()].join(','))));
    await tvp2.screenshot({ path: out + '-tv-published.png' });
    await tvp2.context().close();
  } else check(false, 'the new game is listed under Built by you');
  check(!pg.errs.length, 'no page errors' + (pg.errs.length ? ': ' + pg.errs.join(' | ') : ''));
  await b.close();
  srv.kill();
  log(fail.length ? `\n${fail.length} PROBLEM(S):\n - ${fail.join('\n - ')}` : '\nALL GOOD');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
