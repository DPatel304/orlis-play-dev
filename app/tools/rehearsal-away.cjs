// The away rehearsal: creators who live somewhere else and only come by now and then.
//   cd app && npx vite --port 5191 &
//   NODE_PATH=$(npm root -g) node tools/rehearsal-away.cjs http://localhost:5191/ /tmp/away ../server <game.js> <orlis.json>
// <game.js>/<orlis.json>: a game Claude Code made before (tools/rehearsal.cjs saves
// one), so the first version needn't be made again; the changes after it are made
// by the real Claude Code (`claude`, signed in). Screenshots land next to /tmp/away.
//
// The story: your brother and your dad set up at your house (all new accounts are
// creators), go home, make games and changes there - away from the server - and
// they wait on their PCs. They come by (your laptop has a new Wi-Fi address by
// then), the games go in by themselves, you play and approve them, another family
// gets them; then more changes at home, the next visit, an update, a "not yet".
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const [appUrl, out, serverDir, gameFile, manifestFile] = process.argv.slice(2);
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-away-'));
const srv = cp.spawn(process.execPath, ['--no-warnings', 'src/main.js'], { cwd: serverDir, env: { ...process.env, ORLIS_DATA: data, ORLIS_NAME: 'Home', ORLIS_APPROVE_JOINS: 'false' } });
const S = 'http://127.0.0.1:47871', MOVED = 'http://localhost:47871';
const api = async (m, p, b, t, extra = {}) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...extra }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const log = (...a) => console.log(...a);
const fail = [];
const check = (ok, what) => { log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* (one page: Play, Discover and Create are reached from the corner menu) */
const goTo = async (pg, t) => { await pg.keyboard.press('Escape').catch(() => {}); const it = await pg.$(`.tvtab:not(.on) >> text="${t}"`); if (it) await it.click(); };
const menuItems = async (pg) => pg.$$eval('.tvtab', e => e.map(x => x.textContent));

/* the Windows app, standing in: game folders kept (across restarts), Claude Code
   "opened", and the Wi-Fi: at home (no server), or at your house (and where). */
const TAURI = `window.__fs = JSON.parse(localStorage.getItem('test.fs') || '{}'); const keep = () => localStorage.setItem('test.fs', JSON.stringify(__fs));
window.__TAURI__ = { core: { invoke: async (c, a) => {
  if (c === 'setup_status') return { tailscale: { installed: true, state: 'on' }, claude: { installed: true, signedIn: true } };
  if (c === 'find_servers'){ const n = await window.__net(); return n.away ? [] : [{ url: n.moved ? '${MOVED}' : '${S}', name: 'Home' }]; }
  if (c === 'games_list') return Object.entries(__fs).map(([folder, f]) => ({ folder, manifest: f['orlis.json'], changed: f.at }));
  if (c === 'game_make'){ let n = a.name, k = 2; while (__fs[n]) n = a.name + ' ' + k++; __fs[n] = { ...a.files, at: Date.now() }; keep(); return n; }
  if (c === 'game_write'){ for (const k of Object.keys(a.files)) if (!k.startsWith('.claude/') && k !== '.orlis/preview.txt') throw 'not allowed'; Object.assign(__fs[a.folder], a.files); keep(); return null; }
  if (c === 'game_read') return { game: __fs[a.folder]['game.js'], manifest: __fs[a.folder]['orlis.json'] };
  if (c === 'claude_open'){ window.__claudeAsked = a; return { opened: true }; }
  if (c === 'game_version'){ const m = JSON.parse(__fs[a.folder]['orlis.json']); m.version = a.version; __fs[a.folder]['orlis.json'] = JSON.stringify(m, null, 2); keep(); return null; }
  return null; } }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;
const FAKE = `window.__fakeOn = () => {
  const P = window.__pose; P.update = () => {}; P.mouse.active = false; let t = 0;
  setInterval(() => { t += 1 / 30;
    [0.3, 0.7].forEach((cx, i) => {
      const p = P.players[i]; p.present = true;
      const x = cx + Math.sin(t * 0.9 + i * 2) * 0.25, y = 0.5 + Math.sin(t * 0.63 + i) * 0.35;
      const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.6, v: 0.9 }));
      lm[15] = { x: x - 0.04, y: y + 0.03, v: 0.9 }; lm[16] = { x, y, v: 0.9 }; lm[11] = { x: cx + 0.06, y: 0.45, v: 0.9 }; lm[12] = { x: cx - 0.06, y: 0.45, v: 0.9 }; lm[0] = { x: cx, y: 0.35, v: 0.9 };
      p.lm = lm; p.centre = { x: cx, y: 0.6 }; p.scale = 0.3;
      p.hands.left = { x: x - 0.04, y: y + 0.03, vx: 0.4, vy: 0, speed: 0.4 }; p.hands.right = { x, y, vx: 0.4, vy: 0, speed: 0.4 };
    });
    P.personCount = 2;
  }, 33);
};`;

/* a person's PC: its own browser profile (kept across restarts), its own Wi-Fi */
async function pc(b, name, state){
  const n = { away: false, moved: false };
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route(/\.ts\.net\//, r => r.abort());   /* (never the real family server on the internet) */
  await ctx.exposeFunction('__net', () => n);
  await ctx.route(/:47871\//, (r) => {
    const u = new URL(r.request().url());
    if (n.away || (n.moved && u.hostname === '127.0.0.1')) return r.abort('connectionrefused');
    return r.continue();
  });
  await ctx.addInitScript(TAURI + FAKE + (state ? `if (!localStorage.getItem('orlis.account')) localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))});` : ''));
  const pg = await ctx.newPage();
  pg.errs = [];
  pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) pg.errs.push(name + ': ' + e.message); });
  pg.net = n; pg.who = name;
  await pg.goto(appUrl + '?debug');
  return pg;
}
const stateOf = (me) => ({ server: { url: S, name: 'Home' }, token: me.token, account: me.account, household: me.household, profiles: me.profiles, current: me.profiles[0].id });
const txt = async (pg, sel) => ((await pg.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const shot = (pg, n) => pg.screenshot({ path: `${out}-${n}.png` });
/* the app closed and opened again */
async function restart(pg){ await pg.reload(); await pg.waitForSelector('.tvtop', { timeout: 25000 }); await pg.waitForTimeout(1500); }
async function tab(pg, t){ await pg.keyboard.press('Escape').catch(() => {}); await goTo(pg, t); await pg.waitForTimeout(t === 'Create' ? 2000 : 1500); }
const fsOf = (pg, folder) => pg.evaluate((f) => window.__fs[f], folder);
const setFiles = (pg, folder, files) => pg.evaluate(([f, x]) => { Object.assign(window.__fs[f], x, { at: Date.now() }); localStorage.setItem('test.fs', JSON.stringify(window.__fs)); }, [folder, files]);

async function join(pg, code, email, name){
  /* getting in: their email, then what a new account needs (with the invite code) */
  await pg.waitForSelector('.getin', { timeout: 20000 });
  await pg.fill('form input[type=email]', email); await pg.click('form .btn.go');
  await pg.waitForSelector('text=Make an account', { timeout: 10000 }); await pg.waitForTimeout(300);
  const inputs = await pg.$$('form input:not([type=hidden]):not([type=checkbox])');
  for (const [i, v] of [code, 'correct horse', name].entries()) await inputs[i].fill(v);
  /* (no grown-up tick box: making the account says so) */
  await pg.click('form .btn.go');
  /* (someone new: "You're in!" - then Later, for now) */
  await pg.waitForSelector('text=You’re in!', { timeout: 20000 }); await pg.waitForTimeout(500);
  await pg.click('.btn >> text=Later');
  await pg.waitForSelector('.tvtop', { timeout: 20000 }); await pg.waitForTimeout(1000);
  /* the owner gives them the Dev Kit (the management page's switch), and
     their app sees it the next time it opens */
  const st = await pg.evaluate(() => JSON.parse(localStorage.getItem('orlis.account')));
  const key = fs.readFileSync(path.join(data, 'manage.key'), 'utf8').trim();
  await api('POST', `/api/accounts/${st.account.id}/devkit`, { on: true }, null, { 'X-Orlis-Manage': key });
  await restart(pg);
  return pg.evaluate(() => JSON.parse(localStorage.getItem('orlis.account')));
}
async function newGame(pg, name, idea){
  await tab(pg, 'Create');
  await pg.click('.sbtn >> text=Dev Kit'); await pg.waitForTimeout(600);
  await pg.click('.fpop .btn >> text=Build a game'); await pg.waitForTimeout(800);
  await pg.fill('.fpop input.finput', name); await pg.fill('.fpop textarea', idea);
  await pg.click('.fpop .btn.go'); await pg.waitForTimeout(1500);
  await pg.keyboard.press('Escape');
  return pg.evaluate(() => window.__claudeAsked.folder);
}
async function openGame(pg, name){ await tab(pg, 'Create'); await pg.click(`.slock >> text=${name}`); await pg.waitForTimeout(700); }
async function sendIt(pg, name){
  await openGame(pg, name);
  await pg.click('.fpop .btn >> text=Check and send'); await pg.waitForTimeout(3000);
  return txt(pg, '.toast');
}
async function tryIt(pg, name, secs){
  await openGame(pg, name);
  await pg.click('.fpop .btn >> text=Try it'); await pg.waitForTimeout(2500);
  await pg.evaluate(() => window.__fakeOn());
  await pg.waitForTimeout(secs * 1000);
  const r = await pg.evaluate(() => { const i = window.__round && window.__round(); return i ? { sandboxed: !!i.box, failed: i.failed || null } : null; });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  await pg.click('.screen.dim .btn >> nth=1'); await pg.waitForTimeout(2000);
  await pg.keyboard.press('Escape').catch(() => {});
  return r;
}
const outboxOf = (pg) => pg.evaluate(async () => (await window.__outbox.list()).map(x => [x.name, x.version, x.problem]));

/* the real Claude Code, asked for a change in the game's folder, the way the
   creator would ask it (the kit as made, minus only the Windows guard scripts) */
function claude(files, prompt){
  if (process.env.NOCLAUDE) return { 'game.js': files['game.js'] + `\n/* ${prompt} */\n`, 'orlis.json': files['orlis.json'] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-claude-'));
  for (const [k, v] of Object.entries(files)){ if (k === 'at') continue; fs.mkdirSync(path.dirname(path.join(dir, k)), { recursive: true }); fs.writeFileSync(path.join(dir, k), v); }
  const st = JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8')); delete st.hooks;
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify(st, null, 2));
  const t0 = Date.now();
  const r = cp.spawnSync('claude', ['-p', prompt], { cwd: dir, encoding: 'utf8', timeout: 1200000 });
  log(`    Claude (${Math.round((Date.now() - t0) / 1000)}s): ` + (r.stdout || r.stderr || '').trim().slice(-300).replace(/\n/g, ' '));
  return { 'game.js': fs.readFileSync(path.join(dir, 'game.js'), 'utf8'), 'orlis.json': fs.readFileSync(path.join(dir, 'orlis.json'), 'utf8') };
}

(async () => {
  await wait(1500);
  const b = await chromium.launch();
  const key = fs.readFileSync(path.join(data, 'manage.key'), 'utf8').trim();
  const M = { 'X-Orlis-Manage': key };

  log('\n1. You set up, and make two invites (as the management page does: no role given)');
  const owner = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
  const invB = await api('POST', '/api/invites', { household: 'new' }, owner.token);
  const invD = await api('POST', '/api/invites', { household: 'new' }, owner.token);
  check(invB.role === 'creator' && invD.role === 'creator', 'both invites make creators');

  log('\n2. Before they come over: setting up at their own home finds no server');
  const early = await pc(b, 'early');
  early.net.away = true; await early.reload();
  await early.waitForSelector('text=Can’t reach your Orlis server', { timeout: 20000 }).catch(() => {});
  check((await txt(early, 'body')).includes('Can’t reach your Orlis server') && !(await txt(early, 'body')).includes('Tailscale'), 'the app says plainly it can’t reach the server (no Tailscale): "' + (await txt(early, 'h2')) + '"');
  await shot(early, '02-not-found');
  await early.context().close();

  log('\n3. At your house: your brother and your dad join, in the app');
  const bro = await pc(b, 'brother'), dad = await pc(b, 'dad');
  const broAcct = await join(bro, invB.code, 'brother@example.com', 'Uncle B');
  const dadAcct = await join(dad, invD.code, 'dad@example.com', 'Grandpa');
  check(broAcct.account.role === 'creator' && dadAcct.account.role === 'creator', 'both are creators');
  check(broAcct.server.id && broAcct.server.id.length === 18, 'the app keeps the server\'s id');
  check((await menuItems(bro)).includes('Create'), 'the Create tab is there');

  log('\n4. They go home (no server there) and restart the app');
  bro.net.away = dad.net.away = true;
  await restart(bro); await restart(dad);
  check(await bro.$('.tvtop'), 'it opens straight to Home - still signed in, nothing to set up');
  await tab(bro, 'Create');
  check(/Can.t reach the Orlis server/.test(await txt(bro, 'body')), 'Create says the server\'s out of reach, plainly');
  await shot(bro, '04-home-create');

  log('\n5. At home, your brother makes Firefly Jar, tries it, and sends it');
  const folder = await newGame(bro, 'Firefly Jar', 'Fireflies drift around a dusky meadow. Cup your hands near one to catch it, then carry it to the jar in the middle.');
  const made = await fsOf(bro, folder);
  const id = JSON.parse(made['orlis.json']).id;
  check(/^firefly-jar-[a-z2-9]{4}$/.test(id), 'its id is its own: ' + id);
  const m0 = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); m0.id = id; m0.version = '0.1';
  await setFiles(bro, folder, { 'game.js': fs.readFileSync(gameFile, 'utf8'), 'orlis.json': JSON.stringify(m0, null, 2) });   /* (what Claude made, last time) */
  const t1 = await tryIt(bro, 'Firefly Jar', 14);
  check(t1 && t1.sandboxed && !t1.failed, 'Try it works with no server: ' + JSON.stringify(t1));
  let said = await sendIt(bro, 'Firefly Jar');
  check(/send when the Orlis server’s in reach/.test(said), 'Check and send: "' + said + '"');
  check(JSON.stringify(await outboxOf(bro)) === JSON.stringify([['Firefly Jar', '0.1', '']]), 'it waits on his PC: ' + JSON.stringify(await outboxOf(bro)));
  await tab(bro, 'Create'); await shot(bro, '05-waiting');

  log('\n6. Still at home: a change, with Claude Code, and sent again');
  await setFiles(bro, folder, claude(await fsOf(bro, folder), 'The fireflies are a bit fast for my 3-year-old. Make them drift more slowly and make them easier to catch.'));
  said = await sendIt(bro, 'Firefly Jar');
  check(JSON.stringify(await outboxOf(bro)) === JSON.stringify([['Firefly Jar', '0.2', '']]), 'the newer one replaces it, as 0.2: ' + JSON.stringify(await outboxOf(bro)));
  check(JSON.parse((await fsOf(bro, folder))['orlis.json']).version === '0.2', 'and his folder says 0.2 too');

  log('\n7. Your dad makes a game he also calls Firefly Jar, and sends it');
  const dFolder = await newGame(dad, 'Firefly Jar', 'Catch the fireflies');
  const dId = JSON.parse((await fsOf(dad, dFolder))['orlis.json']).id;
  check(dId !== id, 'a different id from your brother\'s: ' + dId);
  await sendIt(dad, 'Firefly Jar');
  check((await outboxOf(dad)).length === 1, 'it waits on his PC');

  log('\n8. A week goes by: the PCs restart, still at home');
  await restart(bro); await restart(dad);
  check(JSON.stringify(await outboxOf(bro)) === JSON.stringify([['Firefly Jar', '0.2', '']]), 'still waiting after a restart, nothing lost');

  log('\n9. Your brother visits. Your laptop has a new address on the Wi-Fi by now');
  bro.net.away = false; bro.net.moved = true;
  await restart(bro);
  let subs = [];
  for (let i = 0; i < 20 && !subs.length; i++){ await wait(1000); subs = (await api('GET', '/api/submissions?all=1', null, owner.token)).submissions || []; }
  check(subs.length === 1 && subs[0].version === '0.2' && subs[0].gameId === id, 'it went in by itself, as soon as the app opened: ' + JSON.stringify(subs.map(s => [s.name, s.version, s.family])));
  check((await bro.evaluate(() => JSON.parse(localStorage.getItem('orlis.account')).server.url)) === MOVED, 'the app found your server at its new address, and keeps it');
  check(!(await outboxOf(bro)).length, 'his outbox is empty');
  await tab(bro, 'Create');
  check(/Waiting for the owner|waiting/i.test(await txt(bro, 'body')), 'his Create tab: waiting for your OK');
  await shot(bro, '09-sent');

  log('\n10. You play it from the Store and approve it');
  const own = await pc(b, 'owner', stateOf(await api('POST', '/api/signin', { email: 'deep@example.com', password: 'correct horse' })));
  await own.waitForSelector('.tvtop', { timeout: 20000 });
  async function ownerTries(){
    await tab(own, 'Discover'); await own.waitForTimeout(1000);
    await own.click('.slock >> text=Firefly Jar >> nth=0'); await own.waitForTimeout(800);
    await own.click('.sbtn >> text=Try it'); await own.waitForTimeout(2500);
    await own.evaluate(() => window.__fakeOn()); await own.waitForTimeout(32000);
    await own.keyboard.press('Escape'); await own.waitForTimeout(500);
    await own.click('.screen.dim .btn >> nth=1'); await own.waitForTimeout(1500);
  }
  await ownerTries();
  const ok1 = await api('POST', `/api/submissions/${subs[0].id}/approve`, null, null, M);
  check(ok1.ok, 'approved: ' + JSON.stringify(ok1.game || ok1.message));
  check(ok1.game && ok1.game.reach === 'family', 'approved: for his own family, to start with');
  /* you share it with everyone (the management page's Share with everyone) */
  check((await api('POST', `/api/store/${ok1.game.id}/reach`, { everyone: true }, null, M)).reach === 'everyone', 'you share it with everyone');
  await restart(bro); await tab(bro, 'Create');
  check(/Approved|In Discover/i.test(await txt(bro, 'body')), 'his Create tab says approved, while he\'s still here');

  log('\n11. Another family gets it');
  const invC = await api('POST', '/api/invites', { household: 'new' }, owner.token);
  const cousin = await api('POST', '/api/signup', { email: 'cousin@example.com', password: 'correct horse', name: 'Aunt Mo', adult: true, invite: invC.code });
  const cz = await pc(b, 'cousin', stateOf(cousin));
  await cz.waitForSelector('.tvtop', { timeout: 20000 });
  await tab(cz, 'Discover');
  await cz.click('.sbtn >> text=Get >> nth=0'); await cz.waitForTimeout(3000);
  const have = () => cz.evaluate((gid) => window.__library.installed.get(gid), id);
  check(await have() === '0.2', 'they have version 0.2');

  log('\n12. Your dad visits: his goes in too, and doesn\'t clash with your brother\'s');
  dad.net.away = false; dad.net.moved = true;
  await restart(dad); await wait(4000);
  subs = (await api('GET', '/api/submissions?all=1', null, owner.token)).submissions || [];
  const dSub = subs.find(s => s.gameId === dId);
  check(dSub && dSub.state === 'waiting', 'his is waiting for you: ' + JSON.stringify(dSub && [dSub.name, dSub.version, dSub.family]));
  check(!(await outboxOf(dad)).length, 'nothing left on his PC');
  await api('POST', `/api/submissions/${dSub.id}/tried`, { secs: 30 }, owner.token);
  const okD = await api('POST', `/api/submissions/${dSub.id}/approve`, null, null, M);
  await api('POST', `/api/store/${okD.game.id}/reach`, { everyone: true }, null, M);
  const store = (await api('GET', '/api/store', null, owner.token)).games.filter(g => g.name === 'Firefly Jar');
  check(store.length === 2 && new Set(store.map(g => g.by)).size === 2, 'two Firefly Jars in the Store, one from each family: ' + JSON.stringify(store.map(g => [g.id, g.by])));

  log('\n13. Your brother goes home and asks Claude for more');
  bro.net.away = true;
  await restart(bro); await tab(bro, 'Create');
  const away = await txt(bro, 'body');
  check(/As of /.test(away) && /Approved|In Discover/i.test(away), 'away, Create still shows how they went, as of his visit');
  await shot(bro, '13-away-sent');
  await setFiles(bro, folder, claude(await fsOf(bro, folder), 'When the jar is full, make a big rainbow arc across the sky as the fireflies fly out.'));
  said = await sendIt(bro, 'Firefly Jar');
  check(JSON.stringify(await outboxOf(bro)) === JSON.stringify([['Firefly Jar', '0.3', '']]), 'sent away from the server, it still gets the next number, 0.3: ' + JSON.stringify(await outboxOf(bro)));
  const t3 = await tryIt(bro, 'Firefly Jar', 10);
  check(t3 && !t3.failed, 'Claude\'s change plays: ' + JSON.stringify(t3));

  log('\n14. The next visit: the update goes in; you play it and approve it');
  bro.net.away = false;
  await restart(bro); await wait(3000);
  subs = (await api('GET', '/api/submissions?all=1', null, owner.token)).submissions || [];
  const up = subs.find(s => s.gameId === id && s.state === 'waiting');
  check(up && up.version === '0.3', 'version 0.3 is waiting for you');
  await ownerTries();
  const ok3 = await api('POST', `/api/submissions/${up.id}/approve`, null, null, M);
  check(ok3.ok && ok3.game.version === '0.3', 'approved: 0.3 is in the Store');

  log('\n15. The other family is offered the update');
  await restart(cz); await tab(cz, 'Discover');
  const hero = await txt(cz, 'body');
  check(hero.includes('Update to 0.3'), 'the Store says "Update to 0.3"');
  await shot(cz, '15-update');
  await cz.click('.sbtn >> text=Update to 0.3'); await cz.waitForTimeout(3000);
  check(await have() === '0.3', 'they have 0.3 now');
  await tab(cz, 'Play');
  await cz.click('.slock >> text=Firefly Jar >> nth=0'); await cz.waitForTimeout(3000);
  await cz.evaluate(() => window.__fakeOn()); await cz.waitForTimeout(10000);
  const p3 = await cz.evaluate(() => { const i = window.__round && window.__round(); return i ? { failed: i.failed || null } : null; });
  check(p3 && !p3.failed, 'and it plays');
  await shot(cz, '15-playing');

  log('\n16. A change you say "not yet" to');
  bro.net.away = true; await restart(bro);
  const f4 = await fsOf(bro, folder);
  await setFiles(bro, folder, { 'game.js': f4['game.js'] + '\n/* a hundred fireflies */\n' });
  await sendIt(bro, 'Firefly Jar');
  bro.net.away = false; await restart(bro); await wait(3000);
  const v4 = ((await api('GET', '/api/submissions?all=1', null, owner.token)).submissions || []).find(s => s.gameId === id && s.state === 'waiting');
  check(v4 && v4.version === '0.4', '0.4 went in');
  await api('POST', `/api/submissions/${v4.id}/decline`, { note: 'Too many fireflies at once for the little ones' }, null, M);
  await restart(bro); await tab(bro, 'Create');
  check((await txt(bro, 'body')).includes('Too many fireflies at once'), 'he sees your note');
  bro.net.away = true; await restart(bro); await tab(bro, 'Create');
  check((await txt(bro, 'body')).includes('Too many fireflies at once'), 'and still sees it at home');
  await shot(bro, '16-declined');
  check((await api('GET', '/api/store', null, owner.token)).games.find(g => g.id === id).version === '0.3', 'the Store keeps 0.3');

  log('\n17. The trail');
  const hist = ((await api('GET', '/api/history', null, null, M)).history || []).filter(e => e.game_id === id || e.gameId === id).map(e => `${e.what} ${e.version}`).reverse();
  log('    ' + hist.join(' · '));
  check(['sent 0.2', 'approved 0.2', 'sent 0.3', 'approved 0.3', 'sent 0.4', 'declined 0.4'].every(x => hist.includes(x)), 'every step is in the History');

  for (const p of [bro, dad, own, cz]) for (const e of p.errs) fail.push('page error - ' + e);
  log('\n' + (fail.length ? `PROBLEMS (${fail.length}):\n  - ` + fail.join('\n  - ') : 'ALL GOOD'));
  await b.close(); srv.kill(); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack || e.message); for (const x of fail) console.log('  - ' + x); srv.kill(); process.exit(1); });
