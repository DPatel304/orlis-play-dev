/* A throwaway data folder for looking at the management page (and timing its lists): made-up families, kids, games,
   plays and history, put straight into the database. Not a test - run it by hand:

     node server/test/preview/seed.mjs <folder> [families=2500] [plays=200000] [games=150]

   then  node server/test/preview/serve.mjs <folder>  and open the address it prints. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../../src/db.js';
import { writeOrlis } from '../../src/orlis-file.js';
import { hashPassword } from '../../src/secure.js';

export function seed(dir, { families = 2500, plays = 200000, games = 150, now = Date.now() } = {}){
  mkdirSync(join(dir, 'games'), { recursive: true });
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(r() * a.length)];
  const SUR = ['Lee', 'Garcia', 'Patel', 'Nguyen', 'Smith', 'Kim', 'Okafor', 'Rossi', 'Müller', 'Silva', 'Cohen', 'Haddad', 'Jensen', 'Tanaka', 'Brown', 'Martin', 'Novak', 'Ahmed', 'Wilson', 'Dubois', 'Kowalski', 'Singh', 'Moreau', 'Costa', 'Ibrahim', 'Larsen', 'Schmidt', 'Reyes', 'Walker', 'Chen'];
  const FIRST = ['Sam', 'Ana', 'Ivy', 'Leo', 'Maya', 'Noah', 'Zoe', 'Eli', 'Mia', 'Omar', 'Lena', 'Theo', 'Ruby', 'Kai', 'Nora', 'Ben', 'Aria', 'Max', 'Lily', 'Finn', 'Sofia', 'Jude', 'Isla', 'Ravi'];
  const AVATARS = ['cube', 'rocket', 'star', 'moon', 'balloon', 'fish', 'dino', 'cat', 'dog', 'owl', 'bee', 'leaf'];
  const COLOURS = ['sky', 'orange', 'green', 'purple', 'pink', 'yellow', 'teal', 'red'];
  const iso = (ms) => new Date(ms).toISOString();
  const db = openDb(join(dir, 'orlis.db'));
  const hash = hashPassword('correct horse');
  const id = (p, n) => `${p}${n.toString(16).padStart(6, '0')}`;

  /* games: .orlis files in the Store */
  const WORDS = ['Pop', 'Sky', 'Leaf', 'Sleepy', 'Stack', 'Peekaboo', 'Bubble', 'Rocket', 'Garden', 'Frog', 'Comet', 'Pancake', 'Jelly', 'Robot', 'Lantern', 'Snow', 'Dino', 'Kite', 'Treasure', 'Bounce'];
  const NOUN = ['Party', 'Painter', 'Pile', 'Bear', 'It High', 'Garden', 'Bash', 'Dash', 'Hop', 'Catch', 'Rescue', 'Race', 'Tower', 'Parade', 'Quest', 'Drop'];
  const TAGS = ['party', 'active', 'calm', 'puzzle', 'story'];
  const COLS = ['#3da9ff', '#ff8a3d', '#22c55e', '#a855f7', '#ff5d8f', '#facc15', '#14b8a6', '#ef4444'];
  const list = [], seen = new Set();
  while (list.length < games){
    const name = `${pick(WORDS)} ${pick(NOUN)}`;
    const gid = name.toLowerCase().replace(/[^a-z]+/g, '-');
    if (seen.has(gid)) continue; seen.add(gid);
    list.push({ id: gid, name, tag: pick(TAGS), by: list.length > 6 && r() < .35 ? `The ${pick(SUR)}s` : '', cols: [pick(COLS), pick(COLS)], version: `1.${Math.floor(r() * 6)}` });
  }
  for (const g of list){
    const manifest = { format: 1, id: g.id, name: g.name, version: g.version, kit: 2, blurb: `${g.name}: a quick one for the whole family.`, by: g.by, tags: [g.tag], uses: r() < .5 ? 'body' : 'hands',
      icon: { cols: g.cols, glyph: '<circle cx="50" cy="50" r="30" fill="#fff"/>' },
      cover: `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="${g.cols[0]}"/><circle cx="110" cy="40" r="34" fill="${g.cols[1]}"/><rect x="14" y="60" width="70" height="26" rx="10" fill="#ffffff" opacity=".6"/></svg>` };
    writeFileSync(join(dir, 'games', `${g.id}.orlis`), writeOrlis({ 'manifest.json': JSON.stringify(manifest), 'game.js': 'export default {};' }));
  }
  writeFileSync(join(dir, 'games', '.starters'), '');

  db.exec('BEGIN');
  const addHousehold = db.prepare('INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)');
  const addAccount = db.prepare('INSERT INTO accounts (id, email, password_hash, role, created_at, household_id, pending, slots) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const addProfile = db.prepare('INSERT INTO profiles (id, account_id, name, avatar, look, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const addPlay = db.prepare('INSERT INTO plays (household_id, account_id, game_id, value, secs, players, at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const addHistory = db.prepare('INSERT INTO history (at, who, what, game_id, name, version, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const fams = [];
  for (let i = 0; i < families; i++){
    const sur = pick(SUR), hid = id('h', i), aid = id('a', i);
    const joined = i === 0 ? now - 200 * 864e5 : now - Math.floor(r() ** 1.6 * 300 * 864e5);
    const pending = i >= 1 && i <= 5 ? 1 : 0;
    const joinedAt = pending ? now - i * 23 * 60e3 : joined;
    const email = i === 0 ? 'owner@example.com' : `${FIRST[i % FIRST.length].toLowerCase()}.${sur.toLowerCase().replace(/[^a-z]/g, '')}${i}@example.com`;
    addHousehold.run(hid, i === 0 ? 'The Patels' : `The ${sur}${sur.endsWith('s') ? 'es' : 's'}`, iso(joinedAt));
    addAccount.run(aid, email, hash, i === 0 ? 'owner' : 'creator', iso(joinedAt), hid, pending, r() < .05 ? 6 : 3);
    const kids = 1 + Math.floor(r() * 4);
    for (let k = 0; k < kids; k++){
      addProfile.run(id('p', i * 10 + k), aid, pick(FIRST), pick(AVATARS), r() < .8 ? JSON.stringify({ colour: pick(COLOURS) }) : null, iso(joinedAt + k));
    }
    if (r() < .3){ addAccount.run(id('b', i), `partner${i}@example.com`, hash, 'creator', iso(joinedAt + 1000), hid, 0, 3); }
    fams.push({ hid, aid, joined: joinedAt, pending, active: r() < .92 });
  }
  /* plays: heavy-tailed over families and games, most of them recent */
  const heavy = (n) => Math.floor(r() ** 2.4 * n);
  for (let n = 0; n < plays; n++){
    const f = fams[heavy(fams.length)];
    if (f.pending || !f.active) continue;
    const at = Math.max(f.joined, now - Math.floor(r() ** 1.5 * 120 * 864e5));
    addPlay.run(f.hid, f.aid, list[heavy(list.length)].id, Math.floor(r() * 500), 30 + Math.floor(r() * 270), 1 + Math.floor(r() * 3), iso(at));
  }
  /* history */
  const KINDS = ['first-play', 'joined', 'asked-to-join', 'made', 'featured', 'join-approved', 'backup', 'sent', 'approved', 'beta-approved', 'slots', 'played'];
  for (let n = 19999; n >= 0; n--){      /* (oldest first, so the ids go up with time, as they do for real) */
    const f = pick(fams), g = pick(list), what = pick(KINDS), at = iso(now - Math.floor(n * n / 4e5 * 60e3 + n * 7e3));
    const who = ['join-approved', 'featured', 'beta-approved', 'slots', 'approved', 'played'].includes(what) ? 'owner@example.com' : what === 'backup' ? 'Orlis Server' : `${pick(FIRST).toLowerCase()}@example.com`;
    addHistory.run(at, who, what, ['first-play', 'made', 'featured', 'sent', 'approved', 'played'].includes(what) ? g.id : null, ['first-play', 'made', 'featured', 'sent', 'approved', 'played'].includes(what) ? g.name : null,
      what === 'sent' || what === 'approved' ? g.version : null, what === 'backup' ? 'daily · 212 KB' : what === 'slots' ? `${f.hid}: 3 to 4` : what === 'first-play' ? `The ${pick(SUR)}s · 2 players` : what === 'asked-to-join' ? `x@example.com · The ${pick(SUR)}s` : `x${n}@example.com`);
  }
  /* waiting for review (two), and beta asks (two) */
  const addSub = db.prepare("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at, tried_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)");
  addSub.run('s1', 'bubble-quest-2', 'Bubble Quest 2', '1.0', fams[10].aid, 4821, 'ab'.repeat(32), iso(now - 6 * 3600e3), null);
  addSub.run('s2', 'frog-hop-deluxe', 'Frog Hop Deluxe', '1.1', fams[20].aid, 6120, 'cd'.repeat(32), iso(now - 3 * 3600e3), iso(now - 3600e3));
  const addBeta = db.prepare("INSERT INTO beta (email, status, created_at) VALUES (?, 'requested', ?)");
  addBeta.run('nina@example.com', iso(now - 50 * 60e3)); addBeta.run('hugo@example.com', iso(now - 140 * 60e3));
  db.prepare("INSERT INTO beta (email, status, created_at, decided_at) VALUES ('anna@example.com', 'joined', ?, ?)").run(iso(now - 9 * 864e5), iso(now - 9 * 864e5));
  db.prepare("INSERT INTO featured (game_id, pinned_at) VALUES (?, ?)").run(list[0].id, iso(now - 864e5));
  db.prepare("INSERT INTO featured (game_id, pinned_at) VALUES (?, ?)").run(list[2].id, iso(now - 2 * 864e5));
  db.prepare('INSERT INTO reach (game_id, household_id) VALUES (?, ?)').run(list[30].id, fams[3].hid);
  db.exec('COMMIT');
  db.close();
  return { dir, families, plays, games, list };
}

if (process.argv[1] && process.argv[1].endsWith('seed.mjs')){
  const [dir, f, p, g] = process.argv.slice(2);
  if (!dir){ console.error('usage: node seed.mjs <folder> [families] [plays] [games]'); process.exit(1); }
  if (existsSync(join(dir, 'orlis.db'))){ console.error(`${dir} already has a database - use an empty folder`); process.exit(1); }
  const t = Date.now();
  seed(dir, { families: Number(f) || 2500, plays: Number(p) || 200000, games: Number(g) || 150 });
  console.log(`seeded ${dir} in ${Date.now() - t} ms`);
}
