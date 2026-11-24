/* The server's data: one file (orlis.db) beside it, in SQLite - built into
   Node, so there's nothing to install. Kept to plain SQL so it can move to a
   cloud PostgreSQL later.

   Changes to the layout are numbered steps below; a new file runs them all,
   an older one runs only the ones it hasn't had yet. Never edit a step once
   it's been released - add a new one. */
import { DatabaseSync } from 'node:sqlite';

export const STEPS = [
  /* 1: accounts (a parent's), the kids' profiles under them, signed-in
     devices, and invite codes. */
  `
  CREATE TABLE accounts (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner', 'creator', 'player')),
    created_at    TEXT NOT NULL
  );
  CREATE TABLE profiles (
    id         TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    avatar     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX profiles_account ON profiles(account_id);
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen  TEXT NOT NULL
  );
  CREATE TABLE invites (
    code       TEXT PRIMARY KEY,
    role       TEXT NOT NULL CHECK (role IN ('creator', 'player')),
    created_by TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    used_by    TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    used_at    TEXT
  );
  `,
  /* 2: households - a family: its grown-ups' accounts, and the kids'
     profiles under them, which the whole family shares. An invite is to
     join a family (household_id), or to start a new one (none). Each
     account there already becomes a family of its own. */
  `
  CREATE TABLE households (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  ALTER TABLE accounts ADD COLUMN household_id TEXT REFERENCES households(id);
  ALTER TABLE invites ADD COLUMN household_id TEXT REFERENCES households(id) ON DELETE CASCADE;
  INSERT INTO households (id, name, created_at)
    SELECT 'h-' || a.id,
           COALESCE((SELECT p.name FROM profiles p WHERE p.account_id = a.id ORDER BY p.created_at, p.rowid LIMIT 1), 'A') || '''s family',
           a.created_at
    FROM accounts a;
  UPDATE accounts SET household_id = 'h-' || id;
  CREATE INDEX accounts_household ON accounts(household_id);
  `,
  /* 3: games a creator has sent in, waiting for the owner's OK (the file
     itself is in "submissions" in the data folder) */
  `
  CREATE TABLE submissions (
    id         TEXT PRIMARY KEY,
    game_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    version    TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    bytes      INTEGER NOT NULL,
    sha256     TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('waiting', 'approved', 'declined', 'withdrawn')),
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX submissions_account ON submissions(account_id);
  `,
  /* 4: when the owner played a game waiting for their OK (it can't be
     approved before). */
  `
  ALTER TABLE submissions ADD COLUMN tried_at TEXT;
  `,
  /* 5: what happened to the family's games, kept for good (history.js) */
  `
  CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    who TEXT NOT NULL,
    what TEXT NOT NULL,
    game_id TEXT,
    name TEXT,
    version TEXT,
    note TEXT
  );
  `,
  /* 6: each profile's avatar - its look, from the avatar maker (looks.js) */
  `
  ALTER TABLE profiles ADD COLUMN look TEXT;
  `,
  /* 7: games asked for (Request a game - requests.js), and the jobs the
     owner's laptop picks up to make them: a queue of its own, so whatever
     makes the games can be somewhere else from the server (in the cloud,
     the server; on the laptop, Claude Code) */
  `
  CREATE TABLE requests (
    id           TEXT PRIMARY KEY,
    account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('new', 'change')),
    game_id      TEXT,
    recipe       TEXT NOT NULL,
    sentence     TEXT NOT NULL,
    words        TEXT NOT NULL DEFAULT '',
    prompt       TEXT,
    status       TEXT NOT NULL CHECK (status IN ('waiting', 'making', 'made', 'declined', 'withdrawn')),
    note         TEXT NOT NULL DEFAULT '',
    problem      TEXT,
    submission_id TEXT,
    created_at   TEXT NOT NULL,
    decided_at   TEXT
  );
  CREATE INDEX requests_account ON requests(account_id);
  CREATE TABLE jobs (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    request_id  TEXT REFERENCES requests(id) ON DELETE CASCADE,
    status      TEXT NOT NULL CHECK (status IN ('queued', 'taken', 'done', 'failed')),
    taken_at    TEXT,
    finished_at TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX jobs_status ON jobs(status, created_at);
  `,
  /* 8: the Dev Kit - building games yourself, with Claude Code. Off unless
     the owner switches it on for someone (the owner always has it). */
  `
  ALTER TABLE accounts ADD COLUMN devkit INTEGER NOT NULL DEFAULT 0;
  `,
  /* 9: making is private; reaching everyone is earned. A game in the Store
     with a row here is for that one family; with none, for everyone (the
     owner's games, starter games, and anything shared). And each grown-up's
     game slots - how many made-for-them games they can keep. */
  `
  CREATE TABLE reach (
    game_id      TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE
  );
  ALTER TABLE accounts ADD COLUMN slots INTEGER NOT NULL DEFAULT 3;
  `,
  /* 10: joining with the owner's OK - an account that's asked to join waits
     (pending) until the owner lets them in */
  `
  ALTER TABLE accounts ADD COLUMN pending INTEGER NOT NULL DEFAULT 0;
  `,
  /* 11: the closed beta - emails that asked to join, and what the owner said
     (approved ones get the download link, and are straight in on signing up) */
  `
  CREATE TABLE beta (
    email      TEXT PRIMARY KEY,
    status     TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'declined', 'joined')),
    created_at TEXT NOT NULL,
    decided_at TEXT,
    sent_at    TEXT
  );
  `,
  /* 12: this week - the rounds each family plays (for the weekly family
     challenges), the trophies won, and the Discover games the owner features */
  `
  CREATE TABLE plays (
    household_id TEXT NOT NULL,
    account_id   TEXT NOT NULL,
    game_id      TEXT NOT NULL,
    value        INTEGER NOT NULL DEFAULT 0,
    secs         INTEGER NOT NULL DEFAULT 0,
    players      INTEGER NOT NULL DEFAULT 1,
    at           TEXT NOT NULL
  );
  CREATE INDEX plays_week ON plays (household_id, at);
  CREATE TABLE trophies (
    household_id TEXT NOT NULL,
    week         TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    at           TEXT NOT NULL,
    PRIMARY KEY (household_id, week, challenge_id)
  );
  CREATE TABLE featured (
    game_id   TEXT PRIMARY KEY,
    pinned_at TEXT NOT NULL
  );
  `,
  /* 13: the family's own games, made in Create from pictures (a description in the Orlis.play vocabulary, and the picks that made it) */
  `
  CREATE TABLE creations (
    id           TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    maker_id     TEXT NOT NULL,
    name         TEXT NOT NULL,
    picks        TEXT NOT NULL,
    description  TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );
  CREATE INDEX creations_household ON creations(household_id, created_at);
  `,
  /* 14: indexes for the management page's lists, which page, search and sort
     on the server (admin.js) over thousands of families and a long history.
     (plays by family and time - plays_week - and accounts by family -
     accounts_household - are already there.) */
  `
  CREATE INDEX plays_game_at ON plays (game_id, at);
  CREATE INDEX plays_at ON plays (at, game_id, household_id, secs);
  CREATE INDEX households_created ON households (created_at);
  CREATE INDEX accounts_pending ON accounts (created_at) WHERE pending = 1;
  CREATE INDEX history_what ON history (what, id);
  CREATE INDEX submissions_status ON submissions (status, created_at);
  `
];

export function openDb(file){
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get();
  let v = row ? row.version : 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  while (v < STEPS.length){
    db.exec('BEGIN');
    try {
      db.exec(STEPS[v]);
      v++;
      db.prepare('UPDATE schema_version SET version = ?').run(v);
      db.exec('COMMIT');
    } catch (e){ db.exec('ROLLBACK'); throw e; }
  }
  return db;
}

export const SCHEMA = STEPS.length;
export const now = () => new Date().toISOString();
