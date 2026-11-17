// The Request a game rehearsal: a grown-up who isn't a creator describes a game
// in the app, sees how it's going, takes one back; the owner makes one (Claude
// Code standing in), OKs it; they ask for a change; and one is declined, with why.
//   cd app && npx vite --port 5191 &
//   NODE_PATH=$(npm root -g) node tools/rehearsal-request.cjs http://localhost:5191/ /tmp/req ../server
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const [appUrl, out, serverDir] = process.argv.slice(2);
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-req-'));
const srv = cp.spawn(process.execPath, ['--no-warnings', 'src/main.js'], { cwd: serverDir,
  env: { ...process.env, ORLIS_DATA: data, ORLIS_NAME: 'Home', ORLIS_APPROVE_JOINS: 'false', ORLIS_EVERYONE_CREATES: 'false', ORLIS_MAKER: 'false', ORLIS_NO_TRAY: '1', ORLIS_NO_UPDATE: '1' } });
const S = 'http://127.0.0.1:47871';
const log = (...a) => console.log(...a);
const fail = [];
const check = (ok, what) => { log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* (one page: Play, Discover and Create are reached from the corner menu) */
const goTo = async (pg, t) => { await pg.keyboard.press('Escape').catch(() => {}); const it = await pg.$(`.tvtab:not(.on) >> text="${t}"`); if (it) await it.click(); };
const menuItems = async (pg) => pg.$$eval('.tvtab', e => e.map(x => x.textContent));
let KEY = null;
const api = async (m, p, b, t, raw) => {
  const r = await fetch(S + p, { method: m, headers: { 'Content-Type': raw ? 'application/octet-stream' : 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(KEY ? { 'X-Orlis-Manage': KEY } : {}) }, body: raw || (b ? JSON.stringify(b) : undefined) });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const TAURI = `window.__TAURI__ = { core: { invoke: async (c) => c === 'find_servers' ? [{ url: '${S}', name: 'Home' }] : null }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;
const txt = async (pg, sel) => ((await pg.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const shot = (pg, n) => pg.screenshot({ path: `${out}-${n}.png` });
const tap = async (pg, sel) => { await pg.click(sel); await pg.waitForTimeout(350); };

(async () => {
  for (let i = 0; i < 40; i++){ try { await fetch(S + '/api/hello'); break; } catch { await wait(250); } }
  KEY = fs.readFileSync(path.join(data, 'manage.key'), 'utf8').trim();
  const { make } = await import(path.resolve(serverDir, 'src/maker.js'));
  const owner = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
  const inv = await api('POST', '/api/invites', { household: 'new' }, owner.token);
  check(inv.role === 'player', 'with "everyone creates" off, the invite is for a grown-up who isn\'t a creator');
  const bro = await api('POST', '/api/signup', { email: 'bro@example.com', password: 'correct horse', name: 'Sam', adult: true, family: 'Uncle B', invite: inv.code });
  const me = await api('GET', '/api/me', null, bro.token);
  const state = { server: { url: S, name: 'Home' }, token: bro.token, account: me.account || bro.account, household: me.household || bro.household, profiles: me.profiles || bro.profiles, current: (me.profiles || bro.profiles)[0].id };

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route(/\.ts\.net\//, r => r.abort());   /* (never the real family server on the internet) */
  await ctx.addInitScript(TAURI + `if (!localStorage.getItem('orlis.account')) localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))});`);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) errs.push(e.message); });
  await pg.goto(appUrl + '?debug&splash=0');
  await pg.waitForSelector('.tvtop', { timeout: 25000 });
  await pg.waitForTimeout(1200);
  const toCreate = async () => { await pg.keyboard.press('Escape').catch(() => {});
    await goTo(pg, 'Discover'); await pg.waitForTimeout(1200);
    await goTo(pg, 'Create'); await pg.waitForTimeout(1800); };
  await toCreate();

  log('\n1. A grown-up who isn\'t a creator: Create has Request a game (and nothing to make or send)');
  const page = await txt(pg, '.createpage');
  check(page.includes('Make a game'), 'Make a game is there');
  check(!page.includes('Dev Kit') && !page.includes('Send a game'), 'no Dev Kit, nothing to send');
  check(page.includes('None yet'), 'Your games: none yet');
  check(page.includes('3 of 3 left'), 'game slots shown: 3 of 3 left');
  await shot(pg, '01-create');

  log('\n2. The wizard, by tapping');
  await tap(pg, '.sbtn >> text=Make a game');
  await shot(pg, '02-start');
  await tap(pg, '.reqtile >> text=Make something new');
  check((await txt(pg, '.builder h2')) === 'How is it seen?', 'how it\'s seen');
  check(await pg.isDisabled('.reqfoot .btn.go'), 'Next waits for a pick');
  await tap(pg, '.reqtile >> text=Your hands');
  check((await txt(pg, '.builder h2')) === 'What do you do?', 'what you do');
  await shot(pg, '03-actions');
  await tap(pg, '.reqtile >> text=Catch');
  await tap(pg, '.reqchip >> text=fireflies');
  await tap(pg, '.reqchip >> text=a meadow');
  check((await txt(pg, '.reqsum')).startsWith('A first-person catch game: you catch fireflies as they fall or fly by in a meadow.'), 'the sentence writes itself: "' + (await txt(pg, '.reqsum')).slice(0, 80) + '…"');
  await shot(pg, '04-thing');
  await tap(pg, '.reqfoot .btn.go');
  await tap(pg, '.reqchip >> text=It gets faster');
  await tap(pg, '.reqchip >> text=A golden one worth extra');
  await tap(pg, '.reqchip >> text=Silly sounds');
  check((await pg.$$('.reqchip.on')).length === 2, 'two twists at most');
  await tap(pg, '.reqfoot .btn.go');
  await tap(pg, '.reqchip >> text=Calm');
  await shot(pg, '05-who');
  await tap(pg, '.reqfoot .btn.go');
  check((await txt(pg, '.builder h2')).startsWith('What does it look like'), 'the look (optional)');
  check((await txt(pg, '.reqfoot .btn.go')) === 'Skip', 'nothing picked: the button says Skip');
  await tap(pg, '.reqtile >> text=Warm and cozy');
  check((await txt(pg, '.reqfoot .btn.go')) === 'Next', 'picked: it says Next');
  await shot(pg, '05b-look');
  await tap(pg, '.reqfoot .btn.go');
  check((await txt(pg, '.builder h2')).startsWith('What is it called'), 'its name (optional)');
  await pg.fill('.reqname', 'Firefly Jar');
  await shot(pg, '05c-name');
  await tap(pg, '.reqfoot .btn.go');
  await pg.fill('.reqwords', 'Catch the fireflies in a jar. When the jar is full it glows and they all fly free.');
  check((await txt(pg, '.reqcount')) === '18 of 500 words', 'words counted: ' + (await txt(pg, '.reqcount')));
  check((await txt(pg, '.reqtip')).includes('Windows key + H'), 'the speak-instead tip');
  await shot(pg, '06-words');
  /* closed half way: the draft keeps */
  await tap(pg, '.bclose'); await pg.waitForTimeout(400);
  check(!(await pg.$('.builder')), 'closed with Close');
  await tap(pg, '.sbtn >> text=Make a game');
  check((await pg.inputValue('.reqwords').catch(() => '')).includes('jar is full'), 'opened again: it carries on where it was, words and all');
  check((await txt(pg, '.reqsum')).includes('fireflies'), 'the draft kept the fireflies');
  await tap(pg, '.reqfoot .btn.go');
  check((await txt(pg, '.builder h2')) === 'Ready?', 'review');
  check((await txt(pg, '.reqquote')).includes('jar is full'), 'their words, shown back');
  const rows = await pg.$$eval('.brow', e => e.map(x => x.querySelector('.bk').textContent + ': ' + x.querySelector('.bv').textContent));
  check(rows.some(x => /Its name: Firefly Jar/.test(x)) && rows.some(x => /The look: warm and cozy/.test(x)), 'every answer listed: ' + rows.slice(0, 4).join(' | '));
  await shot(pg, '07-review');
  /* change one from the list, and come back to the review */
  await pg.click('.brow:has-text("The look") >> text=Change'); await pg.waitForTimeout(400);
  check((await txt(pg, '.builder h2')).startsWith('What does it look like'), 'Change goes to that step');
  check((await txt(pg, '.reqfoot .btn.go')) === 'Back to review', 'with a way back to the review');
  await tap(pg, '.reqtile >> text=A starry night');
  await tap(pg, '.reqfoot .btn.go >> text=Back to review');
  check((await txt(pg, '.builder h2')) === 'Ready?', 'back at the review');
  check((await pg.$$eval('.brow', e => e.map(x => x.textContent).join('|'))).includes('a starry night'), 'the change is there');
  /* Back goes up one */
  await tap(pg, '.reqfoot .btn >> text=Back');
  check((await txt(pg, '.builder h2')).startsWith('Anything else'), 'Back goes up one step');
  await tap(pg, '.reqfoot .btn.go');
  await tap(pg, '.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.builder >> text=Sent!', { timeout: 5000 });
  await shot(pg, '08-sent');
  await tap(pg, '.reqfoot .btn.go >> text=OK');
  await pg.waitForTimeout(800);
  check((await txt(pg, '.createpage')).includes('Asked'), 'listed: Asked');
  const list = await api('GET', '/api/requests');
  check(list.requests.length === 1 && list.requests[0].family === 'Uncle B', 'the owner has it, from Uncle B');
  check(/calm/.test(list.requests[0].sentence) && list.requests[0].recipe.twists.length === 2, 'with what was picked: ' + list.requests[0].sentence);

  log('\n3. Surprise me, then take it back');
  await tap(pg, '.sbtn >> text=Make a game');
  await tap(pg, '.reqtile >> text=Surprise me');
  check((await txt(pg, '.builder h2')) === 'Ready?', 'everything picked, straight to review: ' + (await txt(pg, '.reqsum')).slice(0, 90));
  await tap(pg, '.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.builder >> text=Sent!');
  await tap(pg, '.reqfoot .btn.go >> text=OK');
  await pg.waitForTimeout(800);
  check((await pg.$$('.citem >> text=Take back')).length === 2, 'both can be taken back while they wait');
  await shot(pg, '09-two');
  await pg.click('.citem >> nth=0 >> text=Take back'); await pg.waitForTimeout(900);
  check((await pg.$$('.citem >> text=Take back')).length === 1, 'taken back');

  log('\n4. The owner makes the fireflies one (Claude Code standing in), and OKs it');
  const fire = (await api('GET', '/api/requests')).requests.find(r => /fireflies/.test(r.sentence) && r.state === 'waiting');
  check(!!fire, 'the fireflies one is still there');
  await api('POST', `/api/requests/${fire.id}/make`);
  await toCreate();
  check((await txt(pg, '.createpage')).includes('Being made'), 'they see: Being made');
  const job = (await api('POST', '/api/jobs/next')).job;
  const bytes = await make(job, fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-job-')), async (dir) => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'orlis.json'), 'utf8')); m.name = 'Firefly Jar'; m.blurb = 'Catch fireflies and fill the jar with light';
    fs.writeFileSync(path.join(dir, 'orlis.json'), JSON.stringify(m, null, 2));
  });
  await api('POST', `/api/jobs/${job.id}/done`, null, null, bytes);
  /* (staying on Create: it sees by itself) */
  await pg.waitForFunction(() => document.querySelector('.createpage').textContent.includes('Firefly Jar'), null, { timeout: 20000 }).catch(() => {});
  check((await txt(pg, '.createpage')).includes('Firefly Jar') && (await txt(pg, '.createpage')).includes('Waiting for OK'), 'made: Firefly Jar, waiting for the owner\'s OK');
  const sub = (await api('GET', '/api/submissions')).submissions.find(x => x.state === 'waiting');
  await api('POST', `/api/submissions/${sub.id}/tried`, { secs: 30 });
  await api('POST', `/api/submissions/${sub.id}/approve`);
  await toCreate();
  check((await txt(pg, '.createpage')).includes('In Discover'), 'In Discover');
  await shot(pg, '10-in-store');

  log('\n5. Ask for a change');
  await tap(pg, '.citem >> text=Change it');
  await shot(pg, '11-change');
  await tap(pg, '.reqpop .btn.go >> text=Send request');
  check((await txt(pg, '.reqpop .ferr')).includes('Tap one'), 'nothing picked: says what to do');
  await tap(pg, '.reqchip >> text=Slower');
  await tap(pg, '.reqchip >> text=Sillier');
  check((await txt(pg, '.reqsum')) === 'A change to Firefly Jar: make it slower, make it sillier.', 'the change, said back');
  await tap(pg, '.reqpop .btn.go >> text=Send request');
  await pg.waitForTimeout(900);
  const asked = (await api('GET', '/api/requests')).requests;
  check(asked.some(r => r.kind === 'change' && /slower/.test(r.sentence)), 'the owner has the change');

  log('\n6. Like a game I know: the Store\'s games to pick from');
  await tap(pg, '.sbtn >> text=Make a game');
  await tap(pg, '.reqtile >> text=Start over').catch(() => {});
  await tap(pg, '.reqtile >> text=Like a game I know');
  await pg.waitForSelector('.reqtile >> text=Firefly Jar', { timeout: 5000 }).catch(() => {});
  check(!!(await pg.$('.reqtile >> text=Firefly Jar')), 'Firefly Jar is one to pick');
  await tap(pg, '.reqtile >> text=Firefly Jar');
  check((await txt(pg, '.builder h2')).startsWith('Anything different?'), 'what\'s different (optional)');
  check(!(await pg.isDisabled('.reqfoot .btn.go')), 'Next is fine without a pick');
  await tap(pg, '.reqfoot .btn.go');
  await tap(pg, '.reqchip >> text=snowflakes');
  check((await txt(pg, '.reqsum')).startsWith('Like Firefly Jar, but with snowflakes.'), 'the sentence: ' + (await txt(pg, '.reqsum')).slice(0, 60));
  await shot(pg, '12-like');
  await pg.keyboard.press('Escape'); await pg.mouse.click(10, 450); await pg.waitForTimeout(400);

  log('\n7. A declined one says why');
  const change = (await api('GET', '/api/requests')).requests.find(r => r.kind === 'change');
  await api('POST', `/api/requests/${change.id}/decline`, { note: 'Let’s talk about it at the weekend' });
  await toCreate();
  check((await txt(pg, '.createpage')).includes('Not this time') && (await txt(pg, '.createpage')).includes('at the weekend'), 'Not this time, with the owner\'s note');
  await shot(pg, '13-declined');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  srv.kill();
  log(fail.length ? `\n${fail.length} PROBLEM(S):\n - ${fail.join('\n - ')}` : '\nALL GOOD');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
