// The creator rehearsal: the whole journey with fake people, end to end.
//   cd app && npx vite --port 5191 &      (the app, in a browser standing in for Windows)
//   NODE_PATH=$(npm root -g) node tools/rehearsal.cjs http://localhost:5191/ /tmp/rehearsal ../server
// Needs Playwright and the `claude` command (Claude Code, signed in). REUSE=1 skips
// Claude Code and uses the game it made last time (/tmp/rehearsal-game.js).
// Screenshots land next to the second argument.
// The whole creator journey, end to end, with fake people:
//   the owner sets up and makes a creator invite; the "brother" joins with it
//   in the app, makes a game (with the real Claude Code, prompted the way the
//   app prompts it), tries it, sends it; the owner plays it from the Store and
//   approves it on the management page; another family downloads it and plays.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const [appUrl, out, serverDir] = process.argv.slice(2);
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-e2e-'));
const srv = cp.spawn(process.execPath, ['--no-warnings', 'src/main.js'], { cwd: serverDir, env: { ...process.env, ORLIS_DATA: data, ORLIS_NAME: 'Home' } });
const S = 'http://127.0.0.1:47871';
const api = async (m, p, b, t, extra = {}) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...extra }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const log = (...a) => console.log(...a);
const fail = [];
const check = (ok, what) => { log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const IDEA = 'Fireflies drift around a dusky meadow. Cup your hands near one to catch it, then carry it to the glass jar in the middle - the jar glows brighter with every firefly. When it is full, all the fireflies are set free in a big sparkle.';
const FIRST = (idea) => `Read CLAUDE.md, then turn the game in game.js into this idea: ${idea} Keep it simple and fun for young children. Fill in orlis.json for it too (a name, blurb, about, the moves, and an icon). When it's ready, tell me to press Try it in Orlis Play.`;

/* the Windows app, standing in: game folders kept in memory, Claude Code "opened" */
const TAURI = `window.__fs = window.__fs || {}; window.__calls = [];
window.__TAURI__ = { core: { invoke: async (c, a) => { __calls.push([c, a && (a.folder || a.name)]);
  if (c === 'setup_status') return { tailscale: { installed: true, state: 'on' }, claude: { installed: true, signedIn: true } };
  if (c === 'find_servers') return [{ url: '${S}', name: 'Home' }];
  if (c === 'games_list') return Object.entries(__fs).map(([folder, f]) => ({ folder, manifest: f['orlis.json'], changed: f.at }));
  if (c === 'game_make'){ let n = a.name, k = 2; while (__fs[n]) n = a.name + ' ' + k++; __fs[n] = { ...a.files, at: Date.now() }; return n; }
  if (c === 'game_write'){ if (!__fs[a.folder]) throw 'no such game'; for (const k of Object.keys(a.files)) if (!k.startsWith('.claude/') && k !== '.orlis/preview.txt') throw 'not allowed'; Object.assign(__fs[a.folder], a.files); return null; }
  if (c === 'game_read') return { game: __fs[a.folder]['game.js'], manifest: __fs[a.folder]['orlis.json'] };
  if (c === 'game_show') return null;
  if (c === 'claude_open'){ window.__claudeAsked = a; return { opened: true }; }
  if (c === 'game_version'){ const m = JSON.parse(__fs[a.folder]['orlis.json']); m.version = a.version; __fs[a.folder]['orlis.json'] = JSON.stringify(m, null, 2); return null; }
  return null; } }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;
/* two pretend children, moving their hands around the room */
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

async function page(b, state, name){
  const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  pg.errs = [];
  pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) pg.errs.push(name + ': ' + e.message); });
  await pg.addInitScript(TAURI + FAKE + (state ? `localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))});` : ''));
  await pg.goto(appUrl + '?debug');
  return pg;
}
const stateOf = (me) => ({ server: { url: S, name: 'Home' }, token: me.token, account: me.account, household: me.household, profiles: me.profiles, current: me.profiles[0].id });
const txt = async (pg, sel) => ((await pg.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim();

(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const b = await chromium.launch();

  log('\n1. The owner sets up the server and makes a creator invite');
  const owner = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
  check(owner.account && owner.account.role === 'owner', 'first account is the owner');
  const inv = await api('POST', '/api/invites', { household: 'new', role: 'creator' }, owner.token);
  check(inv.code && inv.role === 'creator', 'creator invite made: ' + inv.code);

  log('\n2. The brother joins with the invite, in the app');
  const bro = await page(b, null, 'brother');
  await bro.waitForSelector('text=Which Orlis server?', { timeout: 20000 }).catch(() => {});
  await bro.click('.btn >> text=Home').catch(() => {});
  await bro.waitForSelector('text=New here? Join with an invite', { timeout: 15000 });
  await bro.click('text=New here? Join with an invite');
  await bro.waitForTimeout(400);
  const inputs = await bro.$$('form input');
  const vals = [inv.code, 'brother@example.com', 'correct horse', 'Uncle B'];
  for (let i = 0; i < 4; i++) await inputs[i].fill(vals[i]);
  await bro.check('form input[type=checkbox]');
  await bro.click('form .btn.go');
  /* (someone new: "You're in!" - then Later, for now) */
  await bro.waitForSelector('text=You’re in!', { timeout: 20000 }); await bro.waitForTimeout(500);
  await bro.click('.btn >> text=Later');
  await bro.waitForSelector('.tvtop', { timeout: 20000 });
  await bro.waitForTimeout(1000);
  /* the owner gives him the Dev Kit; his app sees it when it next opens */
  {
    const st = await bro.evaluate(() => JSON.parse(localStorage.getItem('orlis.account')));
    const k = fs.readFileSync(path.join(data, 'manage.key'), 'utf8').trim();
    await api('POST', `/api/accounts/${st.account.id}/devkit`, { on: true }, null, { 'X-Orlis-Manage': k });
    await bro.reload(); await bro.waitForSelector('.tvtop', { timeout: 25000 }); await bro.waitForTimeout(1500);
  }
  const broAcct = await bro.evaluate(() => JSON.parse(localStorage.getItem('orlis.account')));
  check(broAcct.account.devkit === true, 'the owner gave him the Dev Kit');
  check(broAcct.account.role === 'creator', 'joined as a creator, in a family of his own');
  const tabs = await bro.$$eval('.tvtabs .tvtab', t => t.map(x => x.textContent));
  check(tabs.includes('Create'), 'he sees the Create tab: ' + JSON.stringify(tabs));

  log('\n3. He makes a new game');
  await bro.click('.tvtab >> text=Create'); await bro.waitForTimeout(1500);
  await bro.click('.sbtn >> text=Dev Kit'); await bro.waitForTimeout(600);
  await bro.click('.fpop .btn >> text=Build a game'); await bro.waitForTimeout(800);
  await bro.fill('.fpop input.finput', 'Firefly Jar'); await bro.fill('.fpop textarea', IDEA);
  await bro.click('.fpop .btn.go'); await bro.waitForTimeout(1500);
  const asked = await bro.evaluate(() => window.__claudeAsked);
  check(asked && /Firefly Jar/.test(asked.folder) && asked.prompt.includes('Fireflies drift'), 'Claude Code opened on the new folder, with his idea');
  await bro.screenshot({ path: out + '-03-new.png' });
  await bro.keyboard.press('Escape');
  const folder = asked.folder;
  const files = await bro.evaluate((f) => window.__fs[f], folder);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-game-'));
  for (const [k, v] of Object.entries(files)){ if (k === 'at') continue; fs.mkdirSync(path.dirname(path.join(dir, k)), { recursive: true }); fs.writeFileSync(path.join(dir, k), v); }
  check(fs.existsSync(path.join(dir, 'CLAUDE.md')) && fs.existsSync(path.join(dir, '.claude/settings.json')), 'the folder has the kit: CLAUDE.md, the skill, the locked-down settings');
  check(/Look and feel|house style/i.test(fs.readFileSync(path.join(dir, '.claude/skills/orlis-game/SKILL.md'), 'utf8')), 'the guide teaches the house style');

  log('\n4. Claude Code with the kit exactly as shipped (no PowerShell here: the guard can\'t run)');
  const before = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
  const locked = process.env.REUSE ? { stdout: '(skipped this run)' } : cp.spawnSync('claude', ['-p', 'Change ROUND in game.js to 60.'], { cwd: dir, encoding: 'utf8', timeout: 300000 });
  const after = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
  check(before === after, 'nothing changed: with the guard missing, every action is blocked (fails safe)');
  log('    Claude said: ' + (locked.stdout || '').trim().slice(0, 300).replace(/\n/g, ' '));

  log('\n5. Claude Code makes the game (the kit, minus only the Windows guard scripts)');
  const settings = JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'));
  delete settings.hooks; fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify(settings, null, 2));
  const t0 = Date.now();
  const reuse = process.env.REUSE && fs.existsSync(out + '-game.js');
  if (reuse){ fs.writeFileSync(path.join(dir, 'game.js'), fs.readFileSync(out + '-game.js')); fs.writeFileSync(path.join(dir, 'orlis.json'), fs.readFileSync(out + '-orlis.json')); }
  const made = reuse ? { stdout: '(the game Claude made on the last run)' } : cp.spawnSync('claude', ['-p', FIRST(IDEA)], { cwd: dir, encoding: 'utf8', timeout: 1200000 });
  log(`    (${Math.round((Date.now() - t0) / 1000)}s) Claude said: ` + (made.stdout || made.stderr || '').trim().slice(-500).replace(/\n/g, ' '));
  const game = fs.readFileSync(path.join(dir, 'game.js'), 'utf8'), manifest = fs.readFileSync(path.join(dir, 'orlis.json'), 'utf8');
  fs.writeFileSync(out + '-game.js', game); fs.writeFileSync(out + '-orlis.json', manifest);
  check(game !== before && /firefl/i.test(game), 'game.js is now Firefly Jar (' + game.split('\n').length + ' lines)');
  check(/firefl/i.test(manifest) && JSON.parse(manifest).blurb, 'orlis.json filled in: ' + JSON.parse(manifest).name + ' - ' + JSON.parse(manifest).blurb);
  const extra = fs.readdirSync(dir).filter(f => !['game.js', 'orlis.json', 'CLAUDE.md', '.claude', '.orlis'].includes(f));
  check(!extra.length, 'it touched only the two game files' + (extra.length ? ' - also: ' + extra : ''));
  await bro.evaluate(([f, g, m]) => { window.__fs[f]['game.js'] = g; window.__fs[f]['orlis.json'] = m; window.__fs[f].at = Date.now(); }, [folder, game, manifest]);

  log('\n6. He tries it on his TV');
  await bro.click('.tvtab >> text=Home').catch(() => {}); await bro.waitForTimeout(800);
  await bro.click('.tvtab >> text=Create'); await bro.waitForTimeout(1500);
  await bro.click(`.slock >> text=${JSON.parse(manifest).name}`); await bro.waitForTimeout(600);
  await bro.click('.fpop .btn >> text=Try it'); await bro.waitForTimeout(2500);
  await bro.evaluate(() => window.__fakeOn());
  await bro.waitForTimeout(15000);
  const trying = await bro.evaluate(() => { const i = window.__round && window.__round(); return i ? { sandboxed: !!i.box, failed: i.failed || null } : null; });
  check(trying && trying.sandboxed && !trying.failed, 'it runs, sealed in the sandbox: ' + JSON.stringify(trying));
  await bro.screenshot({ path: out + '-06-trying.png' });
  await bro.waitForTimeout(8000);
  await bro.screenshot({ path: out + '-06-trying2.png' });
  await bro.keyboard.press('Escape'); await bro.waitForTimeout(600);
  await bro.click('.screen.dim .btn >> nth=1'); await bro.waitForTimeout(2000);
  const note = await bro.evaluate((f) => window.__fs[f]['.orlis/preview.txt'], folder);
  check(note && /no errors/.test(note), 'the note left for Claude says it played fine: ' + JSON.stringify(note).slice(0, 120));
  await bro.keyboard.press('Escape').catch(() => {});

  log('\n7. A version with something it shouldn\'t do is stopped before it\'s sent');
  await bro.evaluate((f) => { window.__good = window.__fs[f]['game.js']; window.__fs[f]['game.js'] += '\nfetch("https://example.com/collect");\n'; }, folder);
  await bro.click('.tvtab >> text=Home').catch(() => {}); await bro.waitForTimeout(600);
  await bro.click('.tvtab >> text=Create'); await bro.waitForTimeout(1500);
  await bro.click(`.slock >> text=${JSON.parse(manifest).name}`); await bro.waitForTimeout(600);
  await bro.click('.fpop .btn >> text=Check and send'); await bro.waitForTimeout(1500);
  const said = await txt(bro, '.fpop');
  check(/internet|fetch|can.t|problem/i.test(said), 'refused, with a plain reason: ' + said.slice(0, 160));
  const subs0 = await api('GET', '/api/submissions?all=1', null, owner.token);
  check(!(subs0.submissions || []).length, 'nothing reached the server');
  await bro.evaluate((f) => { window.__fs[f]['game.js'] = window.__good; }, folder);
  await bro.keyboard.press('Escape').catch(() => {});

  log('\n8. He checks and sends the good one (on the home Wi-Fi: it goes straight away)');
  await bro.click('.tvtab >> text=Home').catch(() => {}); await bro.waitForTimeout(600);
  await bro.click('.tvtab >> text=Create'); await bro.waitForTimeout(1500);
  await bro.click(`.slock >> text=${JSON.parse(manifest).name}`); await bro.waitForTimeout(600);
  await bro.click('.fpop .btn >> text=Check and send'); await bro.waitForTimeout(3000);
  log('    app says: ' + (await txt(bro, '.csaid')).slice(0, 160));
  const subs = await api('GET', '/api/submissions?all=1', null, owner.token);
  const sub = (subs.submissions || []).find(x => /firefl/i.test(x.name));
  check(sub && sub.state === 'waiting', 'it is waiting for the owner: ' + JSON.stringify(sub && [sub.name, sub.version, sub.state, sub.family]));
  await bro.screenshot({ path: out + '-08-sent.png' });

  log('\n9. The owner plays it from the Store (waiting games are at the top, only for them)');
  const own = await page(b, stateOf(await api('POST', '/api/signin', { email: 'deep@example.com', password: 'correct horse' })), 'owner');
  own.on('request', r => { if (/submissions/.test(r.url())) log('    app -> ' + r.method() + ' ' + r.url().replace(S, '')); });
  own.on('response', async r => { if (/tried/.test(r.url())) log('    tried -> ' + r.status() + ' ' + (await r.text().catch(() => ''))); });
  await own.waitForSelector('.tvtop', { timeout: 20000 }); await own.waitForTimeout(1000);
  await own.click('.tvtab >> text=Store'); await own.waitForTimeout(2500);
  check((await txt(own, 'body')).includes('Waiting for your OK'), 'the Store shows "Waiting for your OK"');
  await own.screenshot({ path: out + '-09-store.png' });
  const keyFile = path.join(data, 'manage.key'), key = fs.readFileSync(keyFile, 'utf8').trim();
  const early = await api('POST', `/api/submissions/${sub.id}/approve`, null, null, { 'X-Orlis-Manage': key });
  check(early.status >= 400, 'approving before playing it is refused');
  await own.click(`.slock >> text=${sub.name}`); await own.waitForTimeout(800);
  await own.click('.sbtn >> text=Try it'); await own.waitForTimeout(2500);
  await own.evaluate(() => window.__fakeOn());
  await own.waitForTimeout(30000);
  await own.screenshot({ path: out + '-09-owner-plays.png' });
  await own.keyboard.press('Escape'); await own.waitForTimeout(500);
  await own.click('.screen.dim .btn >> nth=1'); await own.waitForTimeout(1500);
  const tried = (await api('GET', '/api/submissions?all=1', null, owner.token)).submissions.find(x => x.id === sub.id);
  check(tried && tried.tried, 'the server knows the owner played it');

  log('\n10. The owner approves it on the management page');
  const mg = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  mg.on('pageerror', e => fail.push('manage: ' + e.message));
  await mg.goto(`${S}/manage?k=${key}`); await mg.waitForTimeout(800);
  await mg.click('nav button[data-t=approvals]'); await mg.waitForTimeout(800);
  await mg.screenshot({ path: out + '-10-approvals.png' });
  log('    manage page: ' + (await txt(mg, 'body')).slice(0, 400));
  await mg.click('button >> text=Approve'); await mg.waitForTimeout(1200);
  const store = await api('GET', '/api/store', null, owner.token);
  const inStore = (store.games || []).find(g => /firefl/i.test(g.name));
  check(inStore, 'it is in the Store: ' + JSON.stringify(inStore && [inStore.name, inStore.version, inStore.by]));
  const hist = await api('GET', '/api/history', null, null, { 'X-Orlis-Manage': key });
  check(['sent', 'played', 'approved'].every(k => (hist.history || []).some(e => e.what === k || e.action === k || JSON.stringify(e).includes(`"${k}"`))), 'the history shows it sent, played and approved');

  log('\n11. Another family downloads it and plays it');
  const inv2 = await api('POST', '/api/invites', { household: 'new' }, owner.token);
  const cousin = await api('POST', '/api/signup', { email: 'cousin@example.com', password: 'correct horse', name: 'Aunt Mo', adult: true, invite: inv2.code });
  check(cousin.account && cousin.account.role === 'creator', 'they join as creators too (everyone does, for now)');
  const cz = await page(b, stateOf(cousin), 'cousin');
  await cz.waitForSelector('.tvtop', { timeout: 20000 }); await cz.waitForTimeout(1000);
  await cz.click('.tvtab >> text=Store'); await cz.waitForTimeout(2500);
  check(!(await txt(cz, 'body')).includes('Waiting for your OK'), 'they never see games waiting for approval');
  await cz.screenshot({ path: out + '-11-store.png', fullPage: true });
  log('    store: ' + (await txt(cz, 'body')).slice(0, 500));
  check((await txt(cz, 'body')).includes('Featured · Newest' + inStore.name), 'it is the featured, newest game');
  await cz.click('.sbtn >> text=Get >> nth=0'); await cz.waitForTimeout(3000);
  await cz.screenshot({ path: out + '-11-got.png' });
  await cz.click('.tvtab >> text=Home').catch(() => {}); await cz.click('.sbtn.back').catch(() => {}); await cz.waitForTimeout(500);
  await cz.click('.tvtab >> text=Home').catch(() => {}); await cz.waitForTimeout(1500);
  check((await txt(cz, '.shelves')).includes(inStore.name), 'it is on their Home');
  await cz.click(`.slock >> text=${inStore.name}`); await cz.waitForTimeout(3000);
  await cz.evaluate(() => window.__fakeOn());
  await cz.waitForTimeout(12000);
  const playing = await cz.evaluate(() => { const i = window.__round && window.__round(); return i ? { sandboxed: !!i.box, failed: i.failed || null } : null; });
  check(playing && playing.sandboxed && !playing.failed, 'they are playing it, sealed in the sandbox');
  await cz.screenshot({ path: out + '-11-playing.png' });

  log('\n12. Back on the brother\'s Create tab: it says approved');
  await bro.click('.tvtab >> text=Home').catch(() => {}); await bro.waitForTimeout(600);
  await bro.click('.tvtab >> text=Create'); await bro.waitForTimeout(2500);
  const yours = await txt(bro, 'body');
  check(/approved|in the Store/i.test(yours), 'his Create tab shows it approved');
  await bro.screenshot({ path: out + '-12-approved.png' });

  for (const p of [bro, own, cz]) for (const e of p.errs) fail.push('page error - ' + e);
  log('\n' + (fail.length ? `PROBLEMS (${fail.length}):\n  - ` + fail.join('\n  - ') : 'ALL GOOD'));
  await b.close(); srv.kill(); process.exit(0);
})().catch(e => { console.log('FAIL', e.stack || e.message); srv.kill(); process.exit(1); });
