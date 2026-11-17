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
const tap = async (pg, sel) => { await pg.click(sel); await pg.waitForTimeout(sel.includes('bcard') || sel.includes('bpill') ? 1000 : 350); };

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

  log('\n1. A grown-up who isn\'t a creator: Create is the flow, nothing else (no banner, no Your games, no buttons)');
  await pg.waitForSelector('.builder', { timeout: 8000 });
  const page = await txt(pg, '.createpage');
  check(!page.includes('Dev Kit') && !page.includes('Send a game') && !page.includes('Your games') && !page.includes('None yet'), 'no Dev Kit, no Your games');
  check(!(await pg.$('.shero')), 'no banner: straight into the questions');
  check((await txt(pg, '.bh')) === 'What do you do?', 'the first question is already there: always a new game, nothing to choose about starting');
  check(!(await txt(pg, '.createpage')).includes('Like a game') && !(await txt(pg, '.createpage')).includes('Surprise'), 'no copy-a-game, no surprise');
  await pg.waitForTimeout(900);
  check((await pg.$eval('.createpage', e => e.classList.contains('chromeaway'))), 'the tabs, the cube and the name have slid away');
  check((await pg.$$('.bst')).length === 7 && (await pg.$$('.bst.todo')).length === 6, 'the build list is on the right: seven steps, the first one being built');
  await shot(pg, '01-create');

  log('\n2. The flow, by tapping: one big picture question at a time, the answers as chips above');
  check((await txt(pg, '.bh')) === 'What do you do?', 'what you do');
  check((await pg.$$('.bst.ok')).length === 0 && (await pg.$$('.bq .done')).length === 0, 'no answers yet: no bricks, no rows above');
  check((await pg.$$eval('.bgrid .blb', e => e.map(x => x.textContent))).join('|') === 'Pop|Fly or steer|Copy the moves|Paint', 'only pop, fly or steer, copy the moves and paint');
  check((await pg.$eval('.bcard', e => e.getBoundingClientRect().height)) > 300, 'big cards');
  await shot(pg, '02-actions');
  await pg.click('.bcard >> text=Fly or steer'); await pg.waitForTimeout(260); await shot(pg, '02b-flying'); await pg.waitForTimeout(900);
  check((await txt(pg, '.bh')) === 'What do you fly?', 'what do you fly');
  check((await pg.$$('.bst.ok')).length === 1, 'the first answer is a brick in the list');
  check((await pg.$$('.bgrid .bcard')).length === 3, 'three picture cards');
  const first3 = await pg.$$eval('.bgrid .blb', e => e.map(x => x.textContent).join('|'));
  await tap(pg, '.bmore');
  const next3 = await pg.$$eval('.bgrid .blb', e => e.map(x => x.textContent).join('|'));
  check(first3 !== next3 && (await pg.$$('.bgrid .bcard')).length === 3, 'refresh brings three more: ' + first3 + ' -> ' + next3);
  check(!(await txt(pg, '.createpage')).includes('Where is it'), 'no "where is it"');
  await shot(pg, '03-thing');
  await pg.fill('.btype', 'a friendly dragon');
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  check((await txt(pg, '.bh')) === 'What does it look like?', 'the look');
  check(!(await pg.$('.bpill:not(.big)')), 'no Skip button: the arrows do the moving');
  check((await pg.$$('.bst.ok')).length === 2, 'two bricks built');
  await tap(pg, '.bcard >> text=Cozy');
  check((await txt(pg, '.bh')) === 'How long is it?', 'how long');
  check((await pg.$$eval('.bsub', e => e.map(x => x.textContent))).join('|') === '3 minutes|10 minutes', 'short is 3, long is 10');
  await tap(pg, '.bcard >> text=Long');
  check((await txt(pg, '.bh')) === 'What’s it called?', 'its name');
  check((await pg.$$('.bgrid .bcard')).length === 3, 'three name ideas, drawn as covers');
  check((await pg.getAttribute('.btype', 'maxlength')) === '24', 'a name holds 24 letters');
  await pg.fill('.btype', 'Firefly Jar');
  check((await txt(pg, '.bcount')) === '11 of 24 letters', 'letters counted: ' + (await txt(pg, '.bcount')));
  await shot(pg, '04-name');
  await tap(pg, '.bdown');
  check((await txt(pg, '.bh')) === 'Anything else?', 'anything else');
  await pg.fill('.bwords', 'Catch the fireflies in a jar. When the jar is full it glows and they all fly free.');
  check((await txt(pg, '.bcount')) === '18 of 500 words', 'words counted: ' + (await txt(pg, '.bcount')));
  await shot(pg, '05-words');
  /* up one, and on again */
  await tap(pg, '.bst.ok:has-text("Its name")');
  check((await txt(pg, '.bh')) === 'What’s it called?', 'tapping a brick goes back to that question');
  await tap(pg, '.bdown');
  await tap(pg, '.bdown');
  check((await txt(pg, '.bh')) === 'Ready?', 'review');
  check((await txt(pg, '.reqquote')).includes('jar is full'), 'their words, shown back');
  await shot(pg, '06-review');
  /* change one from the chips, and walk back down */
  await pg.click('.bst.ok:has-text("The look")'); await pg.waitForTimeout(500);
  check((await txt(pg, '.bh')) === 'What does it look like?', 'tapping a chip goes back to that question');
  await tap(pg, '.bcard >> text=Night');
  check((await txt(pg, '.bh')) === 'How long is it?', 'and carries on down');
  await tap(pg, '.bcard >> text=Short');
  await tap(pg, '.bdown'); await tap(pg, '.bdown');
  check((await txt(pg, '.bh')) === 'Ready?', 'back at the review');
  check((await txt(pg, '.bsum .bnote')).includes('starry night'), 'the change is there');
  check((await pg.$$('.bst.ok')).length === 6, 'every brick built, only Ready left');
  await tap(pg, '.bpill >> text=Send it');
  await pg.waitForSelector('.bsent', { timeout: 5000 });
  check((await txt(pg, '.bsent')).includes('On its way'), 'sent: On its way, under construction on Play');
  await shot(pg, '08-sent');
  const list = await api('GET', '/api/requests');
  check(list.requests.length === 1 && list.requests[0].family === 'Uncle B', 'the owner has it, from Uncle B');
  check(/dragon/.test(list.requests[0].sentence) && /3 minutes/.test(list.requests[0].sentence) && list.requests[0].recipe.view === 'hands', 'with what was picked: ' + list.requests[0].sentence);
  await tap(pg, '.bpill >> text=Make another');
  check((await txt(pg, '.bh')) === 'What do you do?', 'Make another starts a fresh flow');
  /* leave half way and come back: always the first question, nothing kept */
  await tap(pg, '.bcard >> text=Pop');
  await goTo(pg, 'Play'); await pg.waitForTimeout(1500);
  await goTo(pg, 'Create'); await pg.waitForSelector('.builder'); await pg.waitForTimeout(1200);
  check((await txt(pg, '.bh')) === 'What do you do?' && (await pg.$$('.bst.ok')).length === 0, 'back on Create it always opens on the first question');

  log('\n3. A quick one (pop something, move on past the rest), then it shows on Play under construction');
  await tap(pg, '.bcard >> text=Pop');
  for (let i = 0; i < 5; i++) await tap(pg, '.bdown');
  check((await txt(pg, '.bh')) === 'Ready?', 'every optional question can be moved past: ' + (await txt(pg, '.bsum .bnote')).slice(0, 90));
  await tap(pg, '.bpill >> text=Send it');
  await pg.waitForSelector('.bsent');
  await tap(pg, '.bpill >> text=See it on Play');
  await pg.waitForSelector('.shelf.building', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  check((await pg.$$('.shelf.building .buildingtile')).length === 2, 'two games under construction on Play');
  check((await txt(pg, '.shelf.building h3')) === 'Under construction', 'the row is called Under construction');
  const shelves = await pg.$$eval('.shelf h3', e => e.map(x => x.textContent));
  check(shelves[shelves.length - 1] === 'Under construction', 'last, out of the way: ' + shelves.join(' | '));
  await pg.$eval('.shelf.building', e => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await shot(pg, '09-play');

  log('\n4. The owner makes the dragon one (Claude Code standing in): Play shows it being built, then it is gone from the row');
  const fire = (await api('GET', '/api/requests')).requests.find(r => /dragon/.test(r.sentence) && r.state === 'waiting');
  check(!!fire, 'the dragon one is still there');
  await api('POST', `/api/requests/${fire.id}/make`);
  /* (a fresh start of the app: it brings this week's data up to date before the first page) */
  const refresh = async () => { await pg.reload(); await pg.waitForSelector('.tvtop', { timeout: 25000 }); await pg.waitForTimeout(1500); };
  const toPlay = async () => { await goTo(pg, 'Play'); await pg.waitForTimeout(1800); };
  const job = (await api('POST', '/api/jobs/next')).job;
  await refresh(); await goTo(pg, 'Create'); await pg.waitForTimeout(800); await toPlay();
  log('    (states: ' + (await api('GET', '/api/requests')).requests.map(r => r.state).join(',') + '; tiles: ' + (await pg.$$eval('.buildingtile', e => e.map(x => x.className.replace(/.*buildingtile/, '')).join(','))) + ')');
  check((await pg.$$('.buildingtile.making')).length === 1, 'Play: one is Building…');
  const bytes = await make(job, fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-job-')), async (dir) => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'orlis.json'), 'utf8')); m.name = 'Firefly Jar'; m.blurb = 'Catch fireflies and fill the jar with light';
    fs.writeFileSync(path.join(dir, 'orlis.json'), JSON.stringify(m, null, 2));
  });
  await api('POST', `/api/jobs/${job.id}/done`, null, null, bytes);
  await refresh(); await goTo(pg, 'Create'); await pg.waitForTimeout(800); await toPlay();
  check((await pg.$$('.buildingtile.made, .buildingtile.ready')).length === 1, 'Play: it is waiting for the owner\'s OK');
  const sub = (await api('GET', '/api/submissions')).submissions.find(x => x.state === 'waiting');
  await api('POST', `/api/submissions/${sub.id}/tried`, { secs: 30 });
  await api('POST', `/api/submissions/${sub.id}/approve`);
  await refresh(); await goTo(pg, 'Create'); await pg.waitForTimeout(800); await toPlay();
  check((await pg.$$('.shelf.building .buildingtile')).length === 1, 'approved: it has left the Under construction row');
  await shot(pg, '10-play-after');

  log('\n6. A declined one says why, on Play');
  const other = (await api('GET', '/api/requests')).requests.find(r => r.state === 'waiting');
  await api('POST', `/api/requests/${other.id}/decline`, { note: 'Let’s talk about it at the weekend' });
  await refresh(); await goTo(pg, 'Create'); await pg.waitForTimeout(800); await toPlay();
  check((await pg.$$('.buildingtile.declined')).length === 1, 'Play: Not this time');
  await pg.$eval('.shelf.building', e => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await pg.click('.buildingtile.declined'); await pg.waitForTimeout(500);
  check((await txt(pg, 'body')).includes('at the weekend'), 'tapping it shows the owner\'s note');
  await shot(pg, '13-declined');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  srv.kill();
  log(fail.length ? `\n${fail.length} PROBLEM(S):\n - ${fail.join('\n - ')}` : '\nALL GOOD');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
