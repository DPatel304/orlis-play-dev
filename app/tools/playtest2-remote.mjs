/* Playtest 2: what the remote (arrow keys, Enter, Escape) does on Home, key by key: which tile or tab is lit after each press. Reproduces the
   remote findings in docs/playtest2/REPORT.md.   cd app && npx vite --port 5191 --strictPort &   node tools/playtest2-remote.mjs */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const { start } = await import(join(here, '../../server/src/app.js'));
const BASE = process.env.BASE || 'http://127.0.0.1:5191';
const s = await start({ dataDir: mkdtempSync(join(tmpdir(), 'orlis-pt2-')), port: 0, discoveryPort: false, starters: [], tailscaleJoin: () => true });
const S = `http://127.0.0.1:${s.port}`;
const api = async (m, p, b, tok) => { const r = await fetch(S + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
const me = await api('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
const state = { server: { url: S, name: 'Orlis' }, token: me.token, account: me.account, household: me.household, profiles: me.profiles, current: me.profiles[0].id };
const TAURI = `window.__TAURI__ = { core: { invoke: async (c) => c === 'find_servers' ? [] : null }, window: { getCurrentWindow: () => ({ close(){}, minimize(){}, toggleMaximize(){} }) } };`;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.route(/\.ts\.net\//, r => r.abort());
await ctx.addInitScript(TAURI + `try { if (!localStorage.getItem('orlis.account')) localStorage.setItem('orlis.account', ${JSON.stringify(JSON.stringify(state))}); } catch {}`);
const pg = await ctx.newPage();
const foc = () => pg.evaluate(() => [...document.querySelectorAll('.kfocus, .sel, :focus-visible')].map(e => String(e.className).replace(/\s+/g, '.') + ':' + e.textContent.trim().slice(0, 14)).join(' | ') + '   mode=' + window.__mode() + ' remote=' + document.body.classList.contains('remote'));
await pg.goto(`${BASE}/?splash=0&fx=0&mode=player`);
await pg.waitForSelector('.htile.game', { timeout: 90000 });
await pg.waitForTimeout(1500);
console.log('start', await foc());
for (const k of ['ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft']){ await pg.keyboard.press(k); await pg.waitForTimeout(400); console.log(k.padEnd(10), await foc()); }
/* Discover and back: is the remote still lit, and does Up reach the tabs? */
await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(300);
console.log('--- Home > Discover (Enter) > Escape');
await pg.keyboard.press('Enter'); await pg.waitForTimeout(2500); console.log('Enter     ', await foc());
await pg.keyboard.press('Escape'); await pg.waitForTimeout(2500); console.log('Escape    ', await foc());
for (const k of ['ArrowUp', 'ArrowRight', 'ArrowDown']){ await pg.keyboard.press(k); await pg.waitForTimeout(500); console.log(k.padEnd(10), await foc()); }
/* Settings > Volume by remote: can the slider be reached and moved? */
console.log('--- Settings: the Volume slider by remote');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
for (let i = 0; i < 4; i++){ await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(250); }
for (let i = 0; i < 3; i++){ await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(250); }
await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(250); await pg.keyboard.press('Enter'); await pg.waitForTimeout(1200);
const vol = () => pg.evaluate(() => { const r = document.querySelector('.setslider'); return r ? `slider=${r.value} active=${document.activeElement && document.activeElement.className}` : 'no slider'; });
console.log('settings open:', await vol(), await foc());
for (const k of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp']){ await pg.keyboard.press(k); await pg.waitForTimeout(300); console.log(k.padEnd(10), await vol(), '|', await foc()); }
await b.close(); await s.close();
