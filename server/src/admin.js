/* What the management page asks (manage-page.js): lists that page, search,
   filter and sort on the server - thousands of families, hundreds of games and
   a long history never go to the page all at once - and the numbers for its
   Overview. Everything here is the owner's, like the page's other routes
   (owner(headers, ip): this laptop, with the manage key; or the signed-in
   owner), and read-only: what the page changes, it changes through the
   routes that were there already (approve, slots, password, feature...).

     GET /api/admin/overview            health, stats, 14-day series, queue, latest activity, top games
     GET /api/admin/queue               who's waiting (joins, beta asks, games) and the allowlist
     GET /api/admin/families            ?q= &status= &sort= &dir= &page= &per=   -> { total, rows, counts }
     GET /api/admin/families/:id        one family, for the side panel
     GET /api/admin/families.csv        the same filter, as a file
     GET /api/admin/games               ?q= &status= &cat= &sort= &dir= &page= &per=
     GET /api/admin/games/:id           one game, for the side panel
     GET /api/admin/activity            ?type= &q= &before= &limit=   newest first, keyset paging
     GET /api/admin/settings            what the Settings page shows that no other route does */
import { statfsSync } from 'node:fs';
import { Fail, Raw, stats } from './http.js';
import { AVATARS } from './api.js';
import { BUILT_IN } from './weekly.js';
import { BUILT_IN_GAMES } from './builtin.js';
import { KEEP } from './backup.js';
import { LIMITS as CREATE } from './creations.js';

/* game slots: the games a family can keep that it made in Create - 3 each, fixed (creations.js) */
export const DEFAULT_SLOTS = CREATE.slots;
const DAY = 864e5;
export const PER = { default: 25, max: 100 };
export const FAMILY_SORTS = { name: 'name COLLATE NOCASE', status: 'status', last: 'last', plays: 'plays', made: 'made', joined: 'joined' };
export const GAME_SORTS = ['title', 'cat', 'maker', 'status', 'plays', 'fams', 'feat'];
export const FAMILY_STATUS = ['active', 'new', 'waiting', 'inactive'];
export const GAME_STATUS = ['live', 'featured', 'review', 'hidden'];

/* the eight favourite colours, as the avatar maker names them (looks.js) */
const FAVOURITES = { sky: '#3da9ff', orange: '#ff8a3d', green: '#22c55e', purple: '#a855f7', pink: '#ff5d8f', yellow: '#facc15', teal: '#14b8a6', red: '#ef4444' };
const FAVOURITE_LIST = Object.values(FAVOURITES);

/* ---------- the health strip's colours ---------- */
/* disk: amber from 80% used, red from 95% */
export const diskLevel = (pct) => pct >= 95 ? 'bad' : pct >= 80 ? 'warn' : 'ok';
/* a day with no backup is a warning; two, red */
export const backupLevel = (lastAt, now = Date.now()) => !lastAt ? 'warn' : now - Date.parse(lastAt) > 2 * DAY ? 'bad' : now - Date.parse(lastAt) > 36 * 3600e3 ? 'warn' : 'ok';
export const errorLevel = (n) => n >= 10 ? 'bad' : n > 0 ? 'warn' : 'ok';

/* how the history's kinds read in Activity: a short dotted code, and whether it's
   one of the heads-ups (a note by the clock, and an email: heads.js) */
export const CODES = {
  joined: 'account.new', 'asked-to-join': 'join.ask', 'first-play': 'play.first',
  'join-approved': 'owner.join', 'join-declined': 'owner.join-no',
  'beta-requested': 'beta.ask', 'beta-approved': 'owner.allow', 'beta-declined': 'owner.allow-no',
  sent: 'game.sent', made: 'game.made', requested: 'game.ask', making: 'game.making', withdrawn: 'game.back',
  'request-declined': 'owner.ask-no', played: 'owner.try', approved: 'owner.publish', declined: 'owner.reject', removed: 'owner.remove',
  shared: 'owner.share', 'family-only': 'owner.hide', featured: 'owner.feature', unfeatured: 'owner.unfeature',
  creator: 'owner.role', 'not-creator': 'owner.role', 'devkit-on': 'owner.devkit', 'devkit-off': 'owner.devkit',
  slots: 'owner.slots', 'password-set': 'owner.password',
  tested: 'draft.test', published: 'draft.publish', 'publish-asked': 'draft.ask', 'publish-declined': 'draft.no', 'taken-off': 'draft.off',
  backup: 'backup'
};
export const HEADS_UP = new Set(['account.new', 'join.ask', 'play.first']);
const SAY = { sent: 'sent for your OK', played: 'played', approved: 'published', declined: 'rejected', withdrawn: 'taken back by its maker', removed: 'taken out of Discover',
  creator: 'made a creator', 'not-creator': 'no longer a creator', joined: 'joined', requested: 'asked for a game', making: 'making a requested game', made: 'made a requested game',
  'request-declined': 'request declined', 'devkit-on': 'given the Dev Kit', 'devkit-off': 'Dev Kit taken away', shared: 'shared with everyone', 'family-only': 'kept to its family',
  slots: 'game slots changed', 'asked-to-join': 'asked to join', 'join-approved': 'let in', 'join-declined': 'not let in', 'beta-requested': 'asked for the beta',
  'beta-approved': 'allowed', 'beta-declined': 'beta ask declined', 'password-set': 'new password set', featured: 'featured', unfeatured: 'unfeatured',
  tested: 'tested', published: 'published for its family', 'publish-asked': 'asked to publish', 'publish-declined': 'publish declined', 'taken-off': 'taken off', 'first-play': 'first play', backup: 'backup ok' };
/* the Activity page's chips: which kinds each shows */
const kindsOf = (test) => Object.keys(CODES).filter(k => test(CODES[k]));
export const ACTIVITY_TYPES = {
  joins: kindsOf(c => /^(account|join|beta)\./.test(c) || ['owner.join', 'owner.join-no', 'owner.allow', 'owner.allow-no'].includes(c)),
  plays: kindsOf(c => c === 'play.first'),
  games: kindsOf(c => /^(game|draft)\./.test(c) || ['owner.try', 'owner.publish', 'owner.reject', 'owner.remove', 'owner.share', 'owner.hide', 'owner.feature', 'owner.unfeature'].includes(c)),
  owner: kindsOf(c => c.startsWith('owner.')),
  backup: kindsOf(c => c === 'backup')
};

const like = (s) => '%' + String(s).replace(/[\\%_]/g, '\\$&') + '%';
const whole = (v, d, lo, hi) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const word = (v, list, d) => { const x = String(v == null ? '' : v).toLowerCase(); return list.includes(x) ? x : d; };
const isoDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysAgo = (from, n) => { const x = new Date(from); x.setDate(x.getDate() - n); return x; };

export function admin({ db, info, dataDir, shop, week, log, mail, mailState = { last: null, error: null }, safe, status = { update: { state: 'off' } }, startedAt = Date.now(), version = '',
  lan = () => [], tailscale = () => null, internetPort = () => null, statfs = statfsSync, now = () => new Date(), startupOn = null }){
  const q = (sql) => db.prepare(sql);
  const t = () => now().getTime();

  /* ---------- families ---------- */
  /* every family with its numbers, filtered by the search (each one's plays are a short run in the plays_week index) */
  function familyBase(search){
    const d7 = new Date(t() - 7 * DAY).toISOString(), d30 = new Date(t() - 30 * DAY).toISOString();
    const text = search ? like(search) : null;
    const rows = q(`SELECT h.id, h.name, h.created_at AS joined, (SELECT COUNT(*) FROM plays WHERE household_id = h.id) AS plays, (SELECT MAX(at) FROM plays WHERE household_id = h.id) AS last,
        (SELECT COUNT(*) FROM accounts WHERE household_id = h.id AND pending = 1) AS waiting,
        (SELECT COUNT(*) FROM creations WHERE household_id = h.id) AS made
      FROM households h
      WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.household_id = h.id)
        AND (:q IS NULL OR h.name LIKE :q ESCAPE '\\' OR h.id LIKE :q ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM accounts a WHERE a.household_id = h.id AND a.email LIKE :q ESCAPE '\\')
          OR EXISTS (SELECT 1 FROM profiles f JOIN accounts a ON a.id = f.account_id WHERE a.household_id = h.id AND f.name LIKE :q ESCAPE '\\'))`)
      .all({ q: text });
    return rows.map(r => ({ ...r, status: statusOf(r, d7, d30) }));
  }
  /* waiting: someone's asked to join; new: joined in the last 7 days; inactive: nothing played in 30+ days
     (or ever, once it's been 7 days); else active */
  const statusOf = (r, d7, d30) => r.waiting > 0 ? 'waiting' : r.joined >= d7 ? 'new' : !r.last || r.last < d30 ? 'inactive' : 'active';
  /* the filter, the sort and a page of it: { total, counts, list } (list: the page's, or all of them) */
  function familyPage(query, { all = false } = {}){
    const base = familyBase(String(query.get('q') || '').trim());
    const counts = { all: base.length, active: 0, new: 0, waiting: 0, inactive: 0 };
    for (const r of base) counts[r.status]++;
    const st = word(query.get('status'), FAMILY_STATUS, 'all');
    const sort = Object.hasOwn(FAMILY_SORTS, query.get('sort')) ? query.get('sort') : 'last';
    const dir = word(query.get('dir'), ['asc', 'desc'], sort === 'name' ? 'asc' : 'desc') === 'asc' ? 1 : -1;
    const per = whole(query.get('per'), PER.default, 1, PER.max);
    let list = st === 'all' ? base : base.filter(r => r.status === st);
    const total = list.length;
    /* (those with nothing to sort by - never played - go last either way) */
    const key = (r) => sort === 'name' ? String(r.name).toLowerCase() : r[sort];
    list = list.sort((a, b) => {
      const x = key(a), y = key(b);
      if (x == null || y == null){ if (x == null && y == null) return a.id < b.id ? -1 : 1; return x == null ? 1 : -1; }
      return (x > y ? 1 : x < y ? -1 : 0) * dir || (String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1);
    });
    const pages = Math.max(1, Math.ceil(total / per));
    const page = whole(query.get('page'), 1, 1, pages);
    return { total, counts, page, per, pages, list: all ? list : list.slice((page - 1) * per, page * per) };
  }
  /* the grown-ups, kids' profiles and slots for these families */
  function familyDetail(base){
    if (!base.length) return [];
    /* a page's families by id; all of them (the CSV) by the whole tables - either way grouped here, not searched for one by one */
    const some = base.length <= 100, ids = base.map(r => r.id), marks = ids.map(() => '?').join(','), where = some ? `WHERE a.household_id IN (${marks})` : '', args = some ? ids : [];
    const group = (rows) => { const m = new Map(); for (const r of rows){ if (!m.has(r.h)) m.set(r.h, []); m.get(r.h).push(r); } return m; };
    const accounts = group(q(`SELECT a.id, a.email, a.role, a.pending, a.created_at AS createdAt, a.household_id AS h FROM accounts a ${where} ORDER BY a.created_at, a.rowid`).all(...args));
    const profiles = group(q(`SELECT f.id, f.name, f.avatar, f.look, a.household_id AS h FROM profiles f JOIN accounts a ON a.id = f.account_id ${where} ORDER BY f.created_at, f.rowid`).all(...args));
    return base.map(r => {
      const acc = (accounts.get(r.id) || []).map(a => ({ id: a.id, email: a.email, role: a.role, waiting: !!a.pending, createdAt: a.createdAt }));
      return { id: r.id, name: r.name, status: r.status, last: r.last || null, plays: r.plays, joined: r.joined, accounts: acc, emails: acc.map(a => a.email),
        profiles: (profiles.get(r.id) || []).map(faceOf), made: r.made, slots: CREATE.slots };
    });
  }
  const lookOf = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
  function faceOf(p){
    const l = lookOf(p.look) || {};
    const colour = FAVOURITES[l.colour] || (typeof l.color === 'string' && /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : null)
      || FAVOURITE_LIST[Math.max(0, AVATARS.indexOf(p.avatar)) % FAVOURITE_LIST.length];
    return { name: p.name, avatar: p.avatar, colour };
  }

  /* ---------- games ---------- */
  const catOf = (g) => g.tags && g.tags[0] ? g.tags[0][0].toUpperCase() + g.tags[0].slice(1) : g.uses === 'body' ? 'Body' : g.uses === 'hands' ? 'Hands' : 'Other';
  const gameNames = async () => new Map([...BUILT_IN, ...BUILT_IN_GAMES, ...(await shop.games()).map(g => [g.id, g.name])]);
  /* each game's last 7 days (kept for a few seconds: it reads a week of plays) */
  let weekMemo = null;
  const weekPlays = () => {
    const stamp = q('SELECT MAX(rowid) AS p FROM plays').get();
    if (weekMemo && weekMemo.p === stamp.p && t() - weekMemo.at < 15000) return weekMemo.map;
    const from = new Date(t() - 7 * DAY).toISOString();
    const map = new Map(q('SELECT game_id AS id, COUNT(*) AS plays, COUNT(DISTINCT household_id) AS fams, AVG(secs) AS secs FROM plays INDEXED BY plays_at WHERE at >= ? GROUP BY game_id').all(from).map(r => [r.id, { ...r }]));
    weekMemo = { at: t(), p: stamp.p, map };
    return map;
  };
  async function gameRows(){
    const games = await shop.games(), slots = week.slots(), seen = weekPlays();
    const hidden = new Set(q('SELECT game_id FROM reach').all().map(r => r.game_id));
    const rows = games.map(g => {
      const n = seen.get(g.id) || { plays: 0, fams: 0 }, slot = slots.indexOf(g.id);
      return { key: `${g.id}@${g.version}`, id: g.id, version: g.version, title: g.name, cat: catOf(g), maker: g.by || 'Orlis', status: hidden.has(g.id) ? 'hidden' : 'live',
        plays: n.plays, fams: n.fams, slot: slot >= 0 ? slot + 1 : null, featured: slot >= 0, cols: (g.icon && g.icon.cols) || [], bytes: g.bytes, added: g.added, starter: !!g.starter };
    });
    /* the games built into Orlis Play, listed too (marked builtIn), so the owner can feature them (decision 0058); a Store game of the same id stands for it */
    for (const [id, name] of BUILT_IN_GAMES){
      if (games.some(g => g.id === id)){ rows.find(r => r.id === id).builtIn = true; continue; }
      const n = seen.get(id) || { plays: 0, fams: 0 }, slot = slots.indexOf(id);
      rows.push({ key: `${id}@built-in`, id, version: 'built in', title: name, cat: 'Built in', maker: 'Orlis', status: 'live', builtIn: true,
        plays: n.plays, fams: n.fams, slot: slot >= 0 ? slot + 1 : null, featured: slot >= 0, cols: [], bytes: 0, added: null, starter: false });
    }
    /* games waiting for the owner's OK (not in the Store yet - or a newer version of one that is) */
    for (const s of q(`SELECT s.id AS submission, s.game_id AS id, s.name, s.version, s.bytes, s.created_at AS added, s.tried_at AS tried, h.name AS family
        FROM submissions s JOIN accounts x ON x.id = s.account_id JOIN households h ON h.id = x.household_id WHERE s.status = 'waiting' ORDER BY s.created_at`).all()){
      rows.push({ key: `${s.id}@${s.version}:review`, id: s.id, version: s.version, title: s.name, cat: 'In review', maker: s.family, status: 'review', plays: 0, fams: 0, slot: null, featured: false, cols: [],
        bytes: s.bytes, added: s.added, submission: s.submission, tried: !!s.tried });
    }
    return rows;
  }
  function gamePage(rows, query){
    const text = String(query.get('q') || '').trim().toLowerCase(), cat = String(query.get('cat') || '');
    const base = rows.filter(g => (!text || `${g.title} ${g.maker} ${g.id}`.toLowerCase().includes(text)) && (!cat || g.cat === cat));
    const counts = { all: base.length, live: 0, featured: 0, review: 0, hidden: 0 };
    for (const g of base){ if (g.status === 'live') counts.live++; if (g.featured) counts.featured++; if (g.status === 'review') counts.review++; if (g.status === 'hidden') counts.hidden++; }
    const st = word(query.get('status'), GAME_STATUS, 'all');
    const sort = GAME_SORTS.includes(query.get('sort')) ? query.get('sort') : 'plays';
    const dir = word(query.get('dir'), ['asc', 'desc'], ['plays', 'fams', 'feat'].includes(sort) ? 'desc' : 'asc') === 'asc' ? 1 : -1;
    let list = base.filter(g => st === 'all' || (st === 'featured' ? g.featured : g.status === st));
    const key = (g) => sort === 'feat' ? (g.slot ? 4 - g.slot : 0) : sort === 'title' ? g.title.toLowerCase() : sort === 'maker' ? g.maker.toLowerCase() : g[sort];
    list = list.sort((a, b) => ((key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir) || (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0));
    const per = whole(query.get('per'), PER.default, 1, PER.max), pages = Math.max(1, Math.ceil(list.length / per)), page = whole(query.get('page'), 1, 1, pages);
    return { total: list.length, counts, featuredTotal: rows.filter(g => g.featured).length, page, per, pages, rows: list.slice((page - 1) * per, page * per) };
  }

  /* ---------- the queue ---------- */
  function queue(){
    const joins = q(`SELECT a.id, a.email, a.created_at AS at, h.name AS family, (SELECT p.name FROM profiles p WHERE p.account_id = a.id ORDER BY p.created_at, p.rowid LIMIT 1) AS name
      FROM accounts a JOIN households h ON h.id = a.household_id WHERE a.pending = 1 ORDER BY a.created_at LIMIT 200`).all().map(r => ({ kind: 'join', ...r }));
    const beta = q("SELECT email, created_at AS at FROM beta WHERE status = 'requested' ORDER BY created_at LIMIT 200").all().map(r => ({ kind: 'beta', ...r }));
    const games = q(`SELECT s.id, s.game_id AS gameId, s.name, s.version, s.bytes, s.created_at AS at, s.tried_at AS tried, x.email AS by, h.name AS family
      FROM submissions s JOIN accounts x ON x.id = s.account_id JOIN households h ON h.id = x.household_id WHERE s.status = 'waiting' ORDER BY s.created_at LIMIT 200`).all().map(r => ({ kind: 'game', ...r, tried: !!r.tried }));
    const items = [...joins, ...beta, ...games].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
    return { items, counts: { all: items.length, joins: joins.length + beta.length, games: games.length } };
  }

  /* ---------- activity ---------- */
  function activityRows(query){
    const type = word(query.get('type'), Object.keys(ACTIVITY_TYPES), 'all');
    const text = String(query.get('q') || '').trim();
    const limit = whole(query.get('limit'), 30, 1, 100);
    const where = [], args = [];
    if (type !== 'all'){ where.push(`what IN (${ACTIVITY_TYPES[type].map(() => '?').join(',')})`); args.push(...ACTIVITY_TYPES[type]); }
    if (text){ where.push("(who LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\' OR game_id LIKE ? ESCAPE '\\')"); args.push(like(text), like(text), like(text), like(text)); }
    const total = q(`SELECT COUNT(*) AS n FROM history${where.length ? ' WHERE ' + where.join(' AND ') : ''}`).get(...args).n;
    /* keyset paging: the next page is those before the last one shown - by its id, which only goes up with time (or by a time) */
    const before = String(query.get('before') || '');
    const paged = [...where], pargs = [...args];
    if (/^\d+$/.test(before)){ paged.push('id < ?'); pargs.push(Number(before)); }
    else if (before && !Number.isNaN(Date.parse(before))){ paged.push('at < ?'); pargs.push(new Date(before).toISOString()); }
    const rows = q(`SELECT * FROM history${paged.length ? ' WHERE ' + paged.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`).all(...pargs, limit + 1);
    const more = rows.length > limit;
    const mine = q("SELECT email FROM accounts WHERE role = 'owner' ORDER BY created_at LIMIT 1").get();
    const out = rows.slice(0, limit).map(r => {
      const code = CODES[r.what] || r.what;
      const you = mine && r.who === mine.email;
      let subject = you ? 'You' : r.who === 'Orlis Server' ? 'Server' : r.who, say = SAY[r.what] || r.what, rest = r.note || '';
      if (r.what === 'asked-to-join' || r.what === 'joined'){ const [, ...tail] = rest.split(' · '); rest = tail.join(' · '); }
      if (r.what === 'first-play'){ const [fam, ...tail] = rest.split(' · '); subject = fam || subject; rest = tail.join(' · '); say = `first play: ${r.name || r.game_id}`; }
      else if (r.name) say += ` ${r.name}${r.version ? '@' + r.version : ''}`;
      else if (r.game_id && r.what !== 'backup') say += ` ${r.game_id}`;
      if (r.what === 'backup'){ subject = 'Backup'; say = 'ok'; }
      return { id: r.id, at: r.at, code, head: HEADS_UP.has(code), subject, text: rest ? `${say} · ${rest}` : say };
    });
    return { rows: out, total, next: more ? String(out[out.length - 1].id) : null };
  }

  /* ---------- the Overview ---------- */
  const series = (count) => {
    const out = [], days = [], today = isoDay(now());
    for (let i = 13; i >= 0; i--){
      const a = daysAgo(today, i), b = daysAgo(today, i - 1);
      out.push(count(a.toISOString(), b.toISOString())); days.push(a.toISOString().slice(0, 10));
    }
    return { values: out, days };
  };
  function health(){
    const sent = stats.snapshot(t());
    const door = internetPort(), publicUrl = info.publicUrl || null;
    let disk = null;
    try {
      const s = statfs(dataDir), total = s.blocks * s.bsize, free = s.bavail * s.bsize;
      const pct = total ? Math.round((1 - s.bavail / s.blocks) * 100) : 0;
      disk = { path: dataDir, usedPct: pct, freeBytes: free, totalBytes: total, level: diskLevel(pct) };
    } catch {}
    const list = safe.list(), lastBackup = list[0] || null;
    const setup = mail.settings ? mail.settings() : null;
    return {
      funnel: { door: door !== null, port: door, publicUrl, lastSeen: sent.lastInternet ? new Date(sent.lastInternet).toISOString() : null, level: door === null ? 'warn' : 'ok' },
      smtp: { ready: !!mail.ready, user: setup ? setup.user : null, lastSent: mailState.last ? new Date(mailState.last).toISOString() : null, error: mailState.error || null, level: mail.ready ? (mailState.error ? 'warn' : 'ok') : 'bad' },
      backup: { last: lastBackup ? { at: lastBackup.at, reason: lastBackup.reason, bytes: lastBackup.bytes } : null, count: list.length, bytes: list.reduce((s, b) => s + (b.bytes || 0), 0), level: backupLevel(lastBackup && lastBackup.at, t()) },
      disk,
      server: { version, name: info.name, uptimeSecs: Math.round((t() - startedAt) / 1000) },
      errors: { count24h: sent.errors24h, p95ms: sent.p95 == null ? null : Math.round(sent.p95 * 10) / 10, samples: sent.samples, level: errorLevel(sent.errors24h) }
    };
  }
  /* the numbers that take a few reads of the plays: kept for up to 30 seconds, unless there's a new play or family since */
  let numbersMemo = null;
  function numbers(){
    const stamp = JSON.stringify(q('SELECT (SELECT MAX(rowid) FROM plays) AS p, (SELECT MAX(rowid) FROM households) AS h, (SELECT COUNT(*) FROM households) AS hn').get());
    if (numbersMemo && numbersMemo.stamp === stamp && t() - numbersMemo.at < 30000) return numbersMemo.value;
    const today = isoDay(now()), nowIso = now().toISOString();
    const families = q('SELECT COUNT(*) AS n FROM households h WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.household_id = h.id)').get().n;
    const weekAgo = new Date(t() - 7 * DAY).toISOString();
    const newWeek = q('SELECT COUNT(*) AS n FROM households h WHERE h.created_at >= ? AND EXISTS (SELECT 1 FROM accounts a WHERE a.household_id = h.id)').get(weekAgo).n;
    const active7 = q('SELECT COUNT(DISTINCT household_id) AS n FROM plays WHERE at >= ?').get(weekAgo).n;
    const between = (a, b) => q('SELECT COUNT(*) AS n FROM plays WHERE at >= ? AND at < ?').get(a, b).n;
    const elapsed = t() - today.getTime(), lastWeek = daysAgo(today, 7);
    const value = {
      families, newWeek, active7,
      playsToday: between(today.toISOString(), nowIso),
      playsThen: between(lastWeek.toISOString(), new Date(lastWeek.getTime() + elapsed).toISOString()),
      newSeries: series((a, b) => q('SELECT COUNT(*) AS n FROM households WHERE created_at >= ? AND created_at < ?').get(a, b).n),
      playSeries: series(between),
      week: [...weekPlays()].sort((a, b) => b[1].plays - a[1].plays).slice(0, 6)
    };
    numbersMemo = { stamp, at: t(), value };
    return value;
  }
  async function overview(){
    const n = numbers(), qu = queue(), names = await gameNames(), pins = week.slots();
    return {
      now: now().toISOString(), health: health(),
      stats: { families: { total: n.families, newThisWeek: n.newWeek }, active7: { households: n.active7, pct: n.families ? Math.round(n.active7 / n.families * 100) : 0 },
        plays: { today: n.playsToday, lastWeekSameTime: n.playsThen }, queue: qu.counts, games: (await gameRows()).length },   /* (the Games page's own set: the Store, the built-in games and those in review) */
      series: { days: n.newSeries.days, newFamilies: n.newSeries.values, plays: n.playSeries.values },
      queue: { counts: qu.counts, items: qu.items.slice(0, 4) },
      activity: activityRows(new URLSearchParams({ limit: '8' })).rows,
      top: n.week.map(([id, w]) => ({ id, title: names.get(id) || id, plays: w.plays, fams: w.fams, mins: Math.round((w.secs || 0) / 6) / 10, featured: pins.includes(id) }))
    };
  }

  /* ---------- the routes ---------- */
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           /* (a spreadsheet would run it as a formula) */
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return {
    routes: (owner) => [
      ['GET', '/api/admin/overview', async ({ headers, ip }) => { owner(headers, ip); return overview(); }],
      ['GET', '/api/admin/queue', ({ headers, ip }) => {
        owner(headers, ip);
        const allow = q("SELECT email, status, sent_at AS sentAt FROM beta WHERE status IN ('approved', 'joined') ORDER BY COALESCE(decided_at, created_at) DESC LIMIT 100").all().map(r => ({ ...r }));
        return { ...queue(), allowlist: allow, mail: !!mail.ready };
      }],
      ['GET', '/api/admin/families', ({ headers, ip, query }) => {
        owner(headers, ip);
        const r = familyPage(query);
        return { total: r.total, page: r.page, per: r.per, pages: r.pages, counts: r.counts, rows: familyDetail(r.list) };
      }],
      /* (before :id, so it isn't taken for one) */
      ['GET', '/api/admin/families.csv', ({ headers, ip, query }) => {
        owner(headers, ip);
        const r = familyPage(query, { all: true });
        const head = ['household id', 'family', 'grown-up emails', 'profiles', 'status', 'last played', 'plays', 'games made', 'game slots', 'joined'];
        const lines = [head.join(',')];
        for (const f of familyDetail(r.list)) lines.push([f.id, f.name, f.emails.join('; '), f.profiles.map(p => p.name).join('; '), f.status, f.last || '', f.plays, f.made, f.slots, f.joined].map(cell).join(','));
        return new Raw(Buffer.from(lines.join('\r\n') + '\r\n', 'utf8'), `orlis-families-${now().toISOString().slice(0, 10)}.csv`, 'text/csv; charset=utf-8');
      }],
      ['GET', '/api/admin/families/:id', ({ headers, ip, params }) => {
        owner(headers, ip);
        const one = q(`SELECT h.id, h.name, h.created_at AS joined, (SELECT COUNT(*) FROM plays WHERE household_id = h.id) AS plays, (SELECT MAX(at) FROM plays WHERE household_id = h.id) AS last,
            (SELECT COUNT(*) FROM accounts WHERE household_id = h.id AND pending = 1) AS waiting, (SELECT COUNT(*) FROM creations WHERE household_id = h.id) AS made FROM households h WHERE h.id = ? AND EXISTS (SELECT 1 FROM accounts a WHERE a.household_id = h.id)`).get(params.id);
        if (!one) throw new Fail(404, 'no_family', 'No such family.');
        one.status = statusOf(one, new Date(t() - 7 * DAY).toISOString(), new Date(t() - 30 * DAY).toISOString());
        const [row] = familyDetail([one]);
        const top = q('SELECT game_id AS id, COUNT(*) AS plays FROM plays WHERE household_id = ? GROUP BY game_id ORDER BY plays DESC, game_id LIMIT 5').all(one.id).map(r => ({ ...r }));
        return gameNames().then(names => ({ ...row, top: top.map(g => ({ ...g, title: names.get(g.id) || g.id })), tried: q('SELECT COUNT(DISTINCT game_id) AS n FROM plays WHERE household_id = ?').get(one.id).n }));
      }],
      ['GET', '/api/admin/games', async ({ headers, ip, query }) => {
        owner(headers, ip);
        const rows = await gameRows();
        const r = gamePage(rows, query);
        /* "Featured now": the three slots, in order (a game id, or null: the slot rotates) */
        const names = await gameNames();
        const featuredNow = week.slots().map((id, i) => ({ slot: i + 1, id, title: id ? names.get(id) || id : null, builtIn: !!id && BUILT_IN_GAMES.some(b => b[0] === id) }));
        return { ...r, featuredNow, cats: [...new Set(rows.map(g => g.cat))].sort((a, b) => a.localeCompare(b)) };
      }],
      ['GET', '/api/admin/games/:id', async ({ headers, ip, params }) => {
        owner(headers, ip);
        const g = (await shop.games()).find(x => x.id === params.id);
        const b = BUILT_IN_GAMES.find(x => x[0] === params.id);
        if (!g && b){
          const all = q('SELECT COUNT(*) AS n, COUNT(DISTINCT household_id) AS fams, AVG(secs) AS secs FROM plays WHERE game_id = ?').get(b[0]);
          return { id: b[0], version: 'built in', title: b[1], blurb: null, about: 'Built into Orlis Play.', tags: [], cover: null, cols: [], bytes: 0, added: null, maker: 'Orlis', builtIn: true,
            plays: { all: all.n, families: all.fams, mins: Math.round((all.secs || 0) / 6) / 10 }, approved: null };
        }
        if (!g) throw new Fail(404, 'no_game', 'That game isn\'t in the Store.');
        const all = q('SELECT COUNT(*) AS n, COUNT(DISTINCT household_id) AS fams, AVG(secs) AS secs FROM plays WHERE game_id = ?').get(g.id);
        const ok = q("SELECT at, who, note FROM history WHERE game_id = ? AND what = 'approved' ORDER BY id DESC LIMIT 1").get(g.id);
        return { id: g.id, version: g.version, title: g.name, blurb: g.blurb, about: g.about, tags: g.tags, cover: g.cover, cols: (g.icon && g.icon.cols) || [], bytes: g.bytes, added: g.added, maker: g.by || 'Orlis',
          plays: { all: all.n, families: all.fams, mins: Math.round((all.secs || 0) / 6) / 10 }, approved: ok ? { ...ok } : null };
      }],
      ['GET', '/api/admin/activity', ({ headers, ip, query }) => { owner(headers, ip); return activityRows(query); }],
      ['GET', '/api/admin/settings', async ({ headers, ip }) => {
        owner(headers, ip);
        const door = internetPort(), setup = mail.settings ? mail.settings() : null;
        let start = 'not Windows';
        if (startupOn){ try { start = (await startupOn()) ? 'on' : 'off'; } catch { start = 'unknown'; } }
        return {
          name: info.name, version, uptimeSecs: Math.round((t() - startedAt) / 1000), update: status.update || { state: 'off' },
          lan: lan(), tailscale: tailscale(), internet: { door, publicUrl: info.publicUrl || null, lastSeen: health().funnel.lastSeen },
          startWithWindows: start, dataDir,
          joining: { mode: info.approveJoins ? 'allowlist + ask' : 'allowlist + invite codes', approveJoins: !!info.approveJoins, awayJoins: info.tailscaleJoin !== false },
          defaultSlots: DEFAULT_SLOTS,
          mail: { ready: !!mail.ready, user: setup ? setup.user : null, host: setup ? setup.host : null, lastSent: mailState.last ? new Date(mailState.last).toISOString() : null, error: mailState.error || null },
          heads: ['join request', 'joined', 'first play'],
          backups: { keep: KEEP }
        };
      }]
    ]
  };
}
