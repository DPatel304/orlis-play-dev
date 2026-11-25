#!/usr/bin/env node
/* The `orlis` command: what Claude Code runs, in a game's folder, to test and publish on the family's TV box.

     orlis connect <address> <code>   once, by the creator (not Claude): trade a pairing code for this laptop's sign-in
     orlis check                      the game's checks, in plain words
     orlis test                       check, pack, and put it on the TV's Testing row
     orlis publish                    ask to make the tested game one of the family's games: a grown-up presses Publish on the TV
     orlis take-off                   take it off the TV's Testing row
     orlis status                     what's being tested and what's published

   It works only on the current folder (game.js and orlis.json) and only talks to the server it was paired
   with, which it finds in its own settings - never from the command line - so a command can't be sent anywhere
   else. Those settings (address and sign-in) live in the user's profile, outside the game folder. The server
   checks everything again, so nothing here is trusted. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { check, pack, nextVersion } from '../../src/ui/creator-kit.js';

/* how long to wait for the TV's Orlis: 15 and 20 seconds, or ORLIS_TIMEOUT_MS if set (the tests set it longer when the machine is busy) */
const WAIT = (ms) => Math.max(ms, Number(process.env.ORLIS_TIMEOUT_MS) || 0);
const say = (t) => console.log(t);
const stop = (t, code = 1) => { console.error(t); process.exit(code); };

/* where the tool keeps its sign-in */
export const settingsFile = () => {
  const home = process.env.ORLIS_HOME || (process.platform === 'win32' ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Orlis') : join(homedir(), '.config', 'orlis'));
  return join(home, 'creator.json');
};
const load = () => { try { return JSON.parse(readFileSync(settingsFile(), 'utf8')); } catch { return null; } };
const save = (v) => { const f = settingsFile(); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 2)); try { chmodSync(f, 0o600); } catch {} };

/* the game in this folder */
const game = () => {
  const dir = process.cwd();
  const read = (n) => existsSync(join(dir, n)) ? readFileSync(join(dir, n), 'utf8') : null;
  return { dir, game: read('game.js'), manifest: read('orlis.json') };
};

async function call(method, path, { body, raw, quiet } = {}){
  const s = load();
  if (!s) stop('Not connected yet. The creator connects this laptop once (in a terminal): orlis connect <address> <code>');
  let r;
  try {
    r = await fetch(s.server.replace(/\/$/, '') + path, { method, signal: AbortSignal.timeout(WAIT(20000)),
      headers: { Authorization: `Bearer ${s.token}`, ...(raw ? { 'Content-Type': 'application/octet-stream' } : body ? { 'Content-Type': 'application/json' } : {}) },
      body: raw || (body ? JSON.stringify(body) : undefined) });
  } catch { stop('Can’t reach the TV’s Orlis. Is it on, on the same Wi-Fi as this laptop?'); }
  let data = {}; try { data = await r.json(); } catch {}
  if (!r.ok && !quiet) stop(r.status === 401 ? 'The sign-in has ended. The creator connects again: orlis connect <address> <code>' : (data.message || `The TV’s Orlis said no (${r.status}).`));
  return { ok: r.ok, status: r.status, data };
}

const problems = (g) => check({ game: g.game, manifest: g.manifest });
function mustPass(g){
  if (g.game === null || g.manifest === null) stop('This folder has no game.js and orlis.json. Run orlis in a game folder.');
  const p = problems(g);
  if (p.length) stop(`It needs fixing first:\n${p.map(x => `- ${x}`).join('\n')}`);
}

const commands = {
  async connect([address, code]){
    if (!address || !code) stop('Use: orlis connect <address> <code>   (the address and code are shown in Create Pro)');
    const url = /^https?:\/\//.test(address) ? address : `http://${address}`;
    let r;
    try { r = await fetch(url.replace(/\/$/, '') + '/api/pair/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(WAIT(15000)) }); }
    catch { stop('Can’t reach that address. Is the TV’s Orlis on, on the same Wi-Fi?'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) stop(d.message || 'That didn’t work.');
    save({ server: url.replace(/\/$/, ''), token: d.token, email: d.email });
    say(`Connected as ${d.email}. In a game folder, Claude can now run: orlis test`);
  },
  async check(){ const g = game(); mustPass(g); say('All good: the game passes its checks.'); },
  async test(){
    const g = game(); mustPass(g);
    let m = JSON.parse(g.manifest);
    /* a newer number than the family's published one (or the Store would ignore it) */
    const st = (await call('GET', '/api/store')).data;
    const was = ((st && st.games) || []).find(x => x.id === m.id && x.mine);
    if (was){
      const a = String(m.version).split('.').map(Number), b = String(was.version).split('.').map(Number);
      const older = (() => { for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); return true; })();
      if (older){ m.version = nextVersion(was.version); writeFileSync(join(g.dir, 'orlis.json'), JSON.stringify(m, null, 2) + '\n'); g.manifest = JSON.stringify(m); say(`(Version is now ${m.version}, since ${was.version} is already published.)`); }
    }
    const { bytes } = await pack({ game: g.game, manifest: g.manifest });
    const r = await call('POST', '/api/drafts', { raw: Buffer.from(bytes) });
    say(`${r.data.name} (version ${r.data.version}) is on the TV. On the TV: Play, then the Testing row.`);
  },
  async publish(){
    const g = game(); if (g.manifest === null) stop('This folder has no orlis.json. Run orlis in a game folder.');
    let m; try { m = JSON.parse(g.manifest); } catch { stop('orlis.json isn’t valid JSON.'); }
    const r = await call('POST', `/api/drafts/${encodeURIComponent(m.id)}/publish`);
    if (r.data.asking) say(`Asked: ${r.data.game.name} (version ${r.data.game.version}) is waiting for a grown-up to press Publish on the TV. (It isn't published until they do.)`);
    else say(`${r.data.game.name} (version ${r.data.game.version}) is published: it downloads to the TV by itself, under Play.`);
  },
  async 'take-off'(){
    const g = game(); if (g.manifest === null) stop('This folder has no orlis.json. Run orlis in a game folder.');
    let m; try { m = JSON.parse(g.manifest); } catch { stop('orlis.json isn’t valid JSON.'); }
    await call('DELETE', `/api/drafts/${encodeURIComponent(m.id)}`);
    say('It’s off the TV’s Testing row.');
  },
  async status(){
    const tests = (await call('GET', '/api/drafts')).data.drafts || [];
    const made = (((await call('GET', '/api/store')).data.games) || []).filter(x => x.mine);
    say(tests.length ? `Testing on the TV:\n${tests.map(d => `- ${d.name} (version ${d.version})`).join('\n')}` : 'Nothing is being tested on the TV.');
    say(made.length ? `Published for the family:\n${made.map(d => `- ${d.name} (version ${d.version})`).join('\n')}` : 'Nothing is published yet.');
  }
};

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) stop('Use one of: connect, check, test, publish, take-off, status');
commands[name](args).catch((e) => stop(e.message || String(e)));
