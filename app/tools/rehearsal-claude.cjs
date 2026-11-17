// Connect Claude Code, on Create: a creator without Claude Code installs it and
// signs in, from the app (the Windows app standing in), and Build a game appears.
//   NODE_PATH=$(npm root -g) node tools/rehearsal-claude.cjs http://localhost:5191/ /tmp/claude ../server
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const [appUrl, out, serverDir] = process.argv.slice(2);
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orlis-claude-'));
const srv = cp.spawn(process.execPath, ['--no-warnings', 'src/main.js'], { cwd: serverDir, env: { ...process.env, ORLIS_DATA: data, ORLIS_NAME: 'Home', ORLIS_APPROVE_JOINS: 'false', ORLIS_MAKER: 'false', ORLIS_NO_TRAY: '1', ORLIS_NO_UPDATE: '1' } });
const S = 'http://127.0.0.1:47871';
const fail = [], log = console.log;
const check = (ok, what) => { log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fail.push(what); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* (one page: Play, Discover and Create are reached from the corner menu) */
const goTo = async (pg, t) => { await pg.keyboard.press('Escape').catch(() => {}); const it = await pg.$(`.tvtab:not(.on) >> text="${t}"`); if (it) await it.click(); };
const menuItems = async (pg) => pg.$$eval('.tvtab', e => e.map(x => x.textContent));
const api = async (m, p, b) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
/* the PC: Claude Code not there; the buttons "install" it and "sign in" (a moment later) */
const TAURI = `window.__claude = { installed: false, signedIn: false }; window.__asked = [];
window.__TAURI__ = { core: { invoke: async (c) => {
  if (c === 'find_servers') return [{ url: '${S}', name: 'Home' }];
  if (c === 'setup_status'){ await new Promise(r => setTimeout(r, 400)); return { tailscale: { installed: true, state: 'on' }, claude: { ...window.__claude } }; }   /* (slow, as a real PC can be) */
  if (c === 'install_claude'){ __asked.push(c); setTimeout(() => { __claude.installed = true; }, 1500); return null; }
  if (c === 'claude_signin'){ __asked.push(c); setTimeout(() => { __claude.signedIn = true; }, 1500); return null; }
  if (c === 'games_list') return [];
  return null; } }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;
const txt = async (pg, sel) => ((await pg.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim();

(async () => {
  for (let i = 0; i < 40; i++){ try { await fetch(S + '/api/hello'); break; } catch { await wait(250); } }
  const me = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels', device: 'PC' });
  const state = { server: { url: S, name: 'Home' }, token: me.token, account: me.account, household: me.household, profiles: me.profiles, current: me.profiles[0].id };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route(/\.ts\.net\//, r => r.abort());   /* (never the real family server on the internet) */
  await ctx.addInitScript(TAURI + `localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))});`);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => { if (!/sandboxed/.test(e.message)) errs.push(e.message); });
  await pg.goto(appUrl + '?debug&splash=0');
  await pg.waitForSelector('.tvtop', { timeout: 25000 });
  await pg.waitForTimeout(1000);
  await goTo(pg, 'Create'); await pg.waitForTimeout(1800);

  log('\n1. The owner (who has the Dev Kit), no Claude Code yet: Make a game, and Dev Kit');
  await pg.waitForTimeout(1500);
  const t = await txt(pg, '.sbtns');
  check((await pg.$$('.sbtns .sbtn')).length === 2, 'each button once: ' + (await pg.$$('.sbtns .sbtn')).length + ' buttons');
  const fit = await pg.$$eval('.sbtns .sbtn', bs => bs.map(b => b.scrollWidth <= b.clientWidth + 1));
  check(fit.every(Boolean), 'no button squashed (labels fit)');
  await pg.screenshot({ path: `${out}-0-create.png` });
  check(t.includes('Make a game') && t.includes('Dev Kit'), 'buttons: ' + t);
  await pg.click('.sbtn >> text=Dev Kit'); await pg.waitForTimeout(600);
  check((await txt(pg, '.fpop h2')) === 'Dev Kit setup', 'not set up yet: the setup');
  check((await pg.$$('.fpop .setupstep')).length === 2, 'two steps');
  await pg.screenshot({ path: `${out}-1-connect.png` });

  log('\n2. Install, then sign in - it ticks itself');
  await pg.click('.fpop .btn >> text=Install Claude Code'); await pg.waitForTimeout(300);
  check((await txt(pg, '.fpop .setupnote')).includes('installing'), 'says it\'s installing');
  await pg.waitForSelector('.fpop .setupstep.done', { timeout: 10000 });
  check((await pg.$$('.fpop .setupstep.done')).length === 1, 'installed: ticked');
  await pg.click('.fpop .btn >> text=Sign in to Claude'); await pg.waitForTimeout(300);
  check((await txt(pg, '.fpop .setupnote')).includes('sign in'), 'says how to sign in');
  await pg.waitForSelector('.fpop h2 >> text=Ready!', { timeout: 10000 }).catch(() => {});
  check((await txt(pg, '.fpop h2')) === 'Ready!', 'Ready!');
  check(await pg.isVisible('.fpop .btn >> text=Build a game'), 'Build a game');
  await pg.screenshot({ path: `${out}-2-connected.png` });
  check(JSON.stringify(await pg.evaluate(() => window.__asked)) === '["install_claude","claude_signin"]', 'the app asked Windows to install, then to sign in');
  await pg.click('.fpop .btn >> text=Later'); await pg.waitForTimeout(800);
  await pg.click('.sbtn >> text=Dev Kit'); await pg.waitForTimeout(500);
  check((await txt(pg, '.fpop h2')) === 'Dev Kit' && await pg.isVisible('.fpop .btn >> text=Build a game'), 'set up: Dev Kit has Build a game');
  await pg.screenshot({ path: out + '-3-devkit.png' });

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.kill();
  log(fail.length ? `\n${fail.length} PROBLEM(S):\n - ${fail.join('\n - ')}` : '\nALL GOOD');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
