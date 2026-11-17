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
  await pg.goto(appUrl + '?debug&splash=0&fx=0');
  await pg.waitForSelector('.tvtop', { timeout: 25000 });
  await pg.waitForTimeout(1200);
  const toCreate = async () => { await pg.keyboard.press('Escape').catch(() => {});
    await goTo(pg, 'Discover'); await pg.waitForTimeout(1200);
    await goTo(pg, 'Create'); await pg.waitForTimeout(1800); };
  await toCreate();

  log('\n1. A grown-up who isn\'t a creator: Create opens straight into making a game (no buttons, no Dev Kit)');
  await pg.waitForSelector('.builder', { timeout: 8000 });
  const page = await txt(pg, '.createpage');
  check(!page.includes('Dev Kit') && !page.includes('Send a game'), 'no Dev Kit, nothing to send');
  check(!(await pg.$('.sbtn >> text=Make a game')), 'no Make a game button');
  check((await txt(pg, '.builder h2')) === 'How do you want to start?', 'the first question is already there');
  check(page.includes('None yet'), 'Your games: none yet');
  check(page.includes('3 of 3 left'), 'game slots shown: 3 of 3 left');
  await shot(pg, '01-create');

  log('\n2. The flow, by tapping: the page keeps moving down, the answers stay above');
  await tap(pg, '.reqtile >> text=Make something new');
  check((await txt(pg, '.bq.cur h2')) === 'What do you do?', 'what you do');
  check((await pg.$$('.bq.done')).length === 1, 'the first answer stays above, small');
  check((await pg.$$eval('.bq.cur .reqtile b', e => e.map(x => x.textContent))).join('|') === 'Pop|Fly or steer|Copy the moves|Paint', 'only pop, fly or steer, copy the moves and paint');
  await shot(pg, '02-actions');
  await tap(pg, '.reqtile >> text=Fly or steer');
  check((await txt(pg, '.bq.cur h2')) === 'What do you fly or steer?', 'what do you fly');
  check((await pg.$$('.bq.cur .reqchip')).length === 3, 'three suggestions');
  const first3 = await pg.$$eval('.bq.cur .reqchip', e => e.map(x => x.textContent).join('|'));
  await tap(pg, '.bq.cur .brefresh');
  const next3 = await pg.$$eval('.bq.cur .reqchip', e => e.map(x => x.textContent).join('|'));
  check(first3 !== next3 && (await pg.$$('.bq.cur .reqchip')).length === 3, 'refresh brings three more: ' + first3 + ' -> ' + next3);
  check(!(await txt(pg, '.createpage')).includes('Where is it'), 'no "where is it"');
  await shot(pg, '03-thing');
  await pg.fill('.bq.cur .finput', 'a friendly dragon');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  check((await txt(pg, '.bq.cur h2')).startsWith('What does it look like'), 'the look (optional)');
  check((await pg.$$('.bq.done')).length === 3, 'three answers above now');
  await tap(pg, '.reqtile >> text=Warm and cozy');
  check((await txt(pg, '.bq.cur h2')) === 'How long is it?', 'how long');
  check((await pg.$$eval('.bq.cur .reqtile small', e => e.map(x => x.textContent))).join('|') === 'About 3 minutes|About 10 minutes', 'short is 3, long is 10');
  await tap(pg, '.reqtile >> text=Long');
  check((await txt(pg, '.bq.cur h2')).startsWith('What is it called'), 'its name (optional)');
  check((await pg.$$('.bq.cur .reqchip')).length === 3, 'three name ideas');
  check((await pg.getAttribute('.reqname', 'maxlength')) === '24', 'a name holds 24 letters');
  await pg.fill('.reqname', 'Firefly Jar');
  check((await txt(pg, '.reqcount')) === '11 of 24 letters', 'letters counted: ' + (await txt(pg, '.reqcount')));
  await shot(pg, '04-name');
  await tap(pg, '.bctl .barrow[title="Down one question"]');
  check((await txt(pg, '.bq.cur h2')).startsWith('Anything else'), 'anything else (optional)');
  await pg.fill('.reqwords', 'Catch the fireflies in a jar. When the jar is full it glows and they all fly free.');
  check((await txt(pg, '.reqcount')) === '18 of 500 words', 'words counted: ' + (await txt(pg, '.reqcount')));
  await shot(pg, '05-words');
  /* up one, and down again */
  await tap(pg, '.bctl .barrow[title="Up one question"]');
  check((await txt(pg, '.bq.cur h2')).startsWith('What is it called'), 'the up arrow goes up one question');
  await tap(pg, '.bctl .barrow[title="Down one question"]');
  /* closed half way: the draft keeps, and the banner brings it back */
  await tap(pg, '.bctl .bx'); await pg.waitForTimeout(500);
  check(!(await pg.$('.builder')), 'closed with the x');
  await pg.click('.shero.again'); await pg.waitForSelector('.builder');
  check((await pg.inputValue('.reqwords').catch(() => '')).includes('jar is full'), 'opened again: it carries on where it was, words and all');
  await tap(pg, '.bctl .barrow[title="Down one question"]');
  check((await txt(pg, '.bq.cur h2')) === 'Ready?', 'review');
  check((await txt(pg, '.reqquote')).includes('jar is full'), 'their words, shown back');
  const done = await pg.$$eval('.bq.done', e => e.map(x => x.textContent));
  check(done.some(x => /Firefly Jar/.test(x)) && done.some(x => /Long/.test(x)) && done.some(x => /dragon/.test(x)), 'every answer listed above: ' + done.slice(0, 3).join(' | '));
  await shot(pg, '06-review');
  /* change one from the list above, and walk back down */
  await pg.click('.bq.done:has-text("What does it look like")'); await pg.waitForTimeout(400);
  check((await txt(pg, '.bq.cur h2')).startsWith('What does it look like'), 'tapping an answer goes back to that question');
  await tap(pg, '.reqtile >> text=A starry night');
  check((await txt(pg, '.bq.cur h2')) === 'How long is it?', 'and carries on down');
  await tap(pg, '.reqtile >> text=Short');
  await tap(pg, '.bctl .barrow[title="Down one question"]'); await tap(pg, '.bctl .barrow[title="Down one question"]');
  check((await txt(pg, '.bq.cur h2')) === 'Ready?', 'back at the review');
  check((await pg.$$eval('.bq.done', e => e.map(x => x.textContent).join('|'))).includes('a starry night'), 'the change is there');
  await tap(pg, '.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.builder >> text=Sent!', { timeout: 5000 });
  await shot(pg, '08-sent');
  await tap(pg, '.reqfoot .btn.go >> text=OK');
  await pg.waitForTimeout(800);
  check((await txt(pg, '.createpage')).includes('Asked'), 'listed: Asked');
  const list = await api('GET', '/api/requests');
  check(list.requests.length === 1 && list.requests[0].family === 'Uncle B', 'the owner has it, from Uncle B');
  check(/dragon/.test(list.requests[0].sentence) && /3 minutes/.test(list.requests[0].sentence) && list.requests[0].recipe.view === 'hands', 'with what was picked: ' + list.requests[0].sentence);

  log('\n3. Surprise me, then take it back');
  await pg.click('.shero.again'); await pg.waitForSelector('.builder');
  await tap(pg, '.reqtile >> text=Surprise me');
  check((await txt(pg, '.bq.cur h2')) === 'Ready?', 'everything picked, straight to review: ' + (await txt(pg, '.reqsum')).slice(0, 90));
  await tap(pg, '.reqfoot .btn.go >> text=Send request');
  await pg.waitForSelector('.builder >> text=Sent!');
  await tap(pg, '.reqfoot .btn.go >> text=OK');
  await pg.waitForTimeout(800);
  check((await pg.$$('.citem >> text=Take back')).length === 2, 'both can be taken back while they wait');
  await shot(pg, '09-two');
  await pg.click('.citem >> nth=0 >> text=Take back'); await pg.waitForTimeout(900);
  check((await pg.$$('.citem >> text=Take back')).length === 1, 'taken back');

  log('\n4. The owner makes the fireflies one (Claude Code standing in), and OKs it');
  const fire = (await api('GET', '/api/requests')).requests.find(r => /dragon/.test(r.sentence) && r.state === 'waiting');
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
  if (!(await pg.$('.builder'))){ await pg.click('.shero.again'); await pg.waitForSelector('.builder'); }
  await tap(pg, '.reqtile >> text=Like a game I know');
  await pg.waitForSelector('.reqtile >> text=Firefly Jar', { timeout: 5000 }).catch(() => {});
  check(!!(await pg.$('.reqtile >> text=Firefly Jar')), 'Firefly Jar is one to pick');
  await tap(pg, '.reqtile >> text=Firefly Jar');
  check((await txt(pg, '.bq.cur h2')).startsWith('Anything different?'), 'what\'s different (optional)');
  check(!(await pg.isDisabled('.bctl .barrow[title="Down one question"]')), 'down is fine without a pick');
  await tap(pg, '.bctl .barrow[title="Down one question"]');
  await pg.fill('.bq.cur .finput', 'snowflakes');
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
