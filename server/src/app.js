/* The Orlis server, started: its data file, the web side for the app, and
   the answer to "is there an Orlis server on this Wi-Fi?". */
import { beta } from './beta.js';
import { mailer } from './mail.js';
import { join } from 'node:path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { managePage } from './manage-page.js';
import { history } from './history.js';
import { hostname, networkInterfaces } from 'node:os';
import { openDb } from './db.js';
import { makeServer, activity, Fail, Page, isLocal, isTailscale } from './http.js';
import { backups } from './backup.js';
import { submissions } from './submissions.js';
import { api } from './api.js';
import { listenForApps, DISCOVERY_PORT } from './discovery.js';
import { store } from './store.js';
import { weekly } from './weekly.js';
import { folderFiles } from './files.js';
import { requests } from './requests.js';

/* The server's version: 0.1 and the build number, stamped in when the exe
   is built (build-exe.mjs); run from the code, plain 0.1.0. */
/* global __ORLIS_SERVER_VERSION__ */
export const VERSION = typeof __ORLIS_SERVER_VERSION__ === 'string' ? __ORLIS_SERVER_VERSION__ : '0.1.0';
export const PORT = 47871;
/* this laptop's addresses on the home network, for the app to be pointed at */
const ipv4 = () => Object.values(networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
const lan = (port) => ipv4().filter(a => !isTailscale(a)).map(a => `http://${a}:${port}`);
/* This laptop's Tailscale address, if Tailscale's on (for people who live elsewhere) */
const tailscaleAt = () => ipv4().find(isTailscale) || null;

/* How often it looks to see whether a daily backup is due, and how long
   nobody must have used it first. */
const BACKUP_LOOK = 60 * 60 * 1000, QUIET = 2 * 60 * 1000;

/* restart(): how to start this server again (to finish a restore) - given
   when something's there to do it. status.update: what the updater last
   found, for the owner's page. */
export async function start({ dataDir, port = PORT, discoveryPort = DISCOVERY_PORT, name, host = '0.0.0.0', starters = [], restart = null, status = { update: { state: 'off' } }, everyoneCreates = true, tailscaleJoin = true, approveJoins = false, downloadUrl = 'https://github.com/DPatel304/orlis-play-dev/releases/download/beta/Orlis-Play-Beta-Setup.exe', publicUrl = null, mail = null, internetPort = null, files = null, notify = null } = {}){
  mkdirSync(dataDir, { recursive: true });
  const safe = backups(dataDir, { version: VERSION });
  /* a restore the owner asked for, done before anything is opened */
  const restored = safe.applyPending();
  const db = openDb(join(dataDir, 'orlis.db'));
  /* the management page's key: the cube opens the page with it, so only
     someone at this laptop, using the cube, can manage the server */
  const keyFile = join(dataDir, 'manage.key');
  if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(24).toString('hex'));
  const manageKey = readFileSync(keyFile, 'utf8').trim();
  /* this server's own id, for good: the apps that know it find it again on
     the Wi-Fi when its address changes (a router gives the laptop a new one) */
  const idFile = join(dataDir, 'server.id');
  if (!existsSync(idFile)) writeFileSync(idFile, randomBytes(9).toString('hex'));
  const info = { id: readFileSync(idFile, 'utf8').trim(), name: name || 'Orlis', version: VERSION, everyoneCreates, tailscaleJoin, approveJoins, publicUrl };
  /* its files (the Store's games, games sent in): the data folder, on the laptop - files.js */
  const keep = files || folderFiles(dataDir);
  const shop = await store(keep, starters);
  const log = history(db);
  const week = weekly(db);
  const sent = submissions(db, keep, shop, log);
  /* a note for the owner, by the clock (the cube shows it - supervisor.js) */
  const tell = notify || ((title, text) => console.log(`@@say ${String(title).replace(/[|\n]/g, ' ')}|${String(text).replace(/\n/g, ' ')}`));
  const asked = requests(db, keep, shop, sent, log, tell);
  info.tell = tell;              /* (someone asking to join: a note by the clock) */
  /* the closed beta: its page, its requests, and the email that says you're in */
  const club = beta(db, { mail: mail || mailer({ dataDir }), log, notify: tell, downloadUrl });
  info.beta = club;
  /* who sees which game in the Store (db.js, step 9) */
  const reach = {
    of: (id) => db.prepare('SELECT 1 FROM reach WHERE game_id = ?').get(id) ? 'family' : 'everyone',
    canSee: (a, id) => { const r = db.prepare('SELECT household_id FROM reach WHERE game_id = ?').get(id); return !r || r.household_id === a.household_id; }
  };
  const owners = (who, owner) => [
    ...sent.routes(who, owner, (h, ip) => h['x-orlis-manage'] !== undefined ? owner(h, ip) : who(h)),
    ...asked.routes(who, owner, (h, ip) => h['x-orlis-manage'] !== undefined ? owner(h, ip) : who(h)),
    /* the management page itself: only to this laptop */
    ['GET', '/manage', ({ ip }) => {
      if (!isLocal(ip)) throw new Fail(404, 'not_found', 'Nothing here.');
      return new Page(managePage());
    }],
    ...shop.routes(who, owner, log, reach, week),
    ...week.routes(who, owner, log),
    ...club.routes(owner),
    /* the server's name, as families see it - the owner's to change (kept in
       settings.json, so it stays after a restart) */
    ['POST', '/api/server/name', ({ headers, ip, body }) => {
      owner(headers, ip);
      const n = String((body && body.name) || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!n) throw new Fail(400, 'name', 'Give it a name.');
      info.name = n;
      const file = join(dataDir, 'settings.json');
      let s = {};
      try { s = JSON.parse(readFileSync(file, 'utf8')) || {}; } catch {}
      writeFileSync(file, JSON.stringify({ ...s, name: n }, null, 2));
      return { name: n };
    }],
    /* the owner shares a family's game with everyone - or keeps it in the family */
    ['POST', '/api/store/:id/reach', async ({ headers, params, body, ip }) => {
      const me = owner(headers, ip);
      const g = (await shop.games()).find(x => x.id === params.id);
      if (!g) throw new Fail(404, 'no_game', 'That game isn\'t in the Store.');
      if (body.everyone === true){
        db.prepare('DELETE FROM reach WHERE game_id = ?').run(g.id);
        log.add(me, 'shared', { gameId: g.id, name: g.name, version: g.version, note: g.by ? `by ${g.by}` : null });
        return { id: g.id, reach: 'everyone' };
      }
      const fam = db.prepare("SELECT a.household_id AS h FROM submissions s JOIN accounts a ON a.id = s.account_id WHERE s.game_id = ? AND s.status = 'approved' ORDER BY s.decided_at DESC LIMIT 1").get(g.id);
      if (!fam || !fam.h) throw new Fail(400, 'not_a_familys', 'Only a game a family made can be kept to that family.');
      db.prepare('INSERT OR REPLACE INTO reach (game_id, household_id) VALUES (?, ?)').run(g.id, fam.h);
      log.add(me, 'family-only', { gameId: g.id, name: g.name, version: g.version, note: g.by ? `by ${g.by}` : null });
      return { id: g.id, reach: 'family' };
    }],
    /* what happened to the family's games, for the management page */
    ['GET', '/api/history', ({ headers, ip }) => { owner(headers, ip); return { history: log.list(300) }; }],
    /* the owner's page in the app: this server, its backups */
    ['GET', '/api/server', ({ headers, ip }) => {
      owner(headers, ip);
      return { name: info.name, version: VERSION, maker: status.maker || { state: 'off' }, addresses: lan(at), tailscale: tailscaleAt(), awayJoins: info.tailscaleJoin !== false, update: status.update, backups: safe.list(), restoring: safe.pending(), restored: restored ? restored.id : null, canRestart: !!restart };
    }],
    ['POST', '/api/backups', ({ headers, ip }) => { owner(headers, ip); return [201, safe.make('manual', db)]; }],
    ['POST', '/api/backups/:id/restore', ({ headers, params, ip }) => {
      owner(headers, ip);
      let b;
      try { b = safe.requestRestore(params.id); } catch (e){ throw new Fail(404, 'no_backup', 'No such backup.'); }
      if (restart) setTimeout(restart, 600);
      return { ok: true, backup: b, restarting: !!restart };
    }]
  ];
  const web = makeServer(api(db, info, owners, manageKey));
  await new Promise((ok, no) => { web.once('error', no); web.listen(port, host, ok); });
  const at = web.address().port;
  /* the internet door: for a tunnel (Tailscale Funnel) to hand in requests
     from the internet. Only this laptop can reach it, and everyone through it
     counts as the internet - never the owner, never the home Wi-Fi. */
  let door = null;
  if (internetPort !== null && internetPort !== false){
    door = web.internetDoor();
    /* (taken by something else: the server still starts, just without it) */
    try { await new Promise((ok, no) => { door.once('error', no); door.listen(internetPort, '127.0.0.1', ok); }); }
    catch (e){ console.error(`(the internet door couldn't open on port ${internetPort}: ${e.message})`); door = null; }
  }
  const udp = discoveryPort === false ? null
    : await listenForApps({ port: discoveryPort, answer: () => ({ id: info.id, name: info.name, port: at, version: VERSION }) });
  /* the daily backup, at a quiet moment */
  const look = () => { if (Date.now() - activity.last > QUIET) try { safe.daily(db); } catch (e){ console.error(`(backup didn't work: ${e.message})`); } };
  const first = setTimeout(look, 60 * 1000), every = setInterval(look, BACKUP_LOOK);
  first.unref?.(); every.unref?.();
  return {
    port: at, internetPort: door ? door.address().port : null, info, db, discovery: udp, store: shop, backups: safe, restored, manageKey,
    manageUrl: `http://127.0.0.1:${at}/manage?k=${manageKey}`,
    close: () => new Promise((ok) => { clearTimeout(first); clearInterval(every); udp?.close(); door?.close(); door?.closeAllConnections?.(); web.close(() => { db.close(); ok(); }); web.closeAllConnections?.(); })
  };
}
