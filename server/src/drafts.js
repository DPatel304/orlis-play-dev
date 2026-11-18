/* A creator's games on their way to their own family's TV, with no one else
   in between.

   Test:     the creator's laptop puts the game here (a draft). The family's
             Player app (the Orlis on the TV) lists the drafts and plays one
             without installing it.
   Publish:  the draft goes into the Store for the creator's family only
             (reach), so the Player app downloads it and it shows under Play.

   The same checks as any game (checkGame) - the sandbox is the safety - but
   no owner's OK: it never leaves the family. Sending a game on to everyone
   (Discover) is a separate step, for later. */
import { Fail, Raw } from './http.js';
import { newer } from './store.js';
import { checkGame } from './submissions.js';
import { readOrlis, writeOrlis, manifestOf, sha256 } from './orlis-file.js';
import { GUARDRAILS, TOOL_DEVICE } from './guardrails.js';
import { hashToken } from './secure.js';

export const LIMITS = { drafts: 20 };
/* a creator's app says "I'm here" this often; gone if it's been quiet this long */
export const HERE_MS = 40 * 1000;
/* a waiting request is answered, empty, after this long (the TV just asks again) */
export const WAIT_MS = 45 * 1000;

export function drafts(db, files, shop, log = { add(){} }){
  const q = (sql) => db.prepare(sql);
  const keyOf = (household, id) => `drafts/${household}/${id}.orlis`;
  const prefix = (household) => `drafts/${household}/`;
  const familyName = (a) => { const r = q('SELECT name FROM households WHERE id = ?').get(a.household_id); return r ? r.name : 'A family'; };
  /* Who's waiting, and what changed: per family, a number that goes up on every Test, removal, publish, and
     when a creator arrives or leaves. The TV holds a request open until the number is past the one it has - so
     nothing is asked or answered until something happens. */
  const fam = new Map();       /* household -> { n, here: ms of the last "I'm here", waiting: [fn] } */
  const state = (hh) => { let f = fam.get(hh); if (!f){ f = { n: 1, here: 0, waiting: [] }; fam.set(hh, f); } return f; };
  const isHere = (f) => Date.now() - f.here < HERE_MS;
  const bump = (hh) => { const f = state(hh); f.n++; const w = f.waiting; f.waiting = []; for (const fn of w) fn(); };
  const touch = (hh) => { const f = state(hh), was = isHere(f); f.here = Date.now(); if (!was) bump(hh); };
  /* (a creator who went quiet: the TV is told) */
  const sweep = setInterval(() => { for (const [hh, f] of fam) if (f.here && !isHere(f)){ f.here = 0; bump(hh); } }, 10 * 1000);
  sweep.unref();
  /* was this asked by the laptop tool (Claude's hands), not a person at the app or the TV? */
  const fromTool = (a) => { const r = q('SELECT device FROM sessions WHERE token_hash = ?').get(a.token_hash); return !!r && r.device === TOOL_DEVICE; };
  /* the questions on the TV: "publish this?" - household -> Map(game id -> { sha, until }) */
  const asking = new Map();
  const asks = (hh) => { let m = asking.get(hh); if (!m){ m = new Map(); asking.set(hh, m); } for (const [id, v] of m) if (v.until <= Date.now()) m.delete(id); return m; };
  /* rates: when each family last did it */
  const lately = { test: new Map(), ask: new Map() };
  const rate = (kind, hh, max, ms, what) => {
    const t = Date.now(), all = (lately[kind].get(hh) || []).filter(x => t - x < ms);
    if (all.length >= max) throw new Fail(429, 'paused', `That's a lot of ${what} at once. Wait a minute, then try again.`);
    all.push(t); lately[kind].set(hh, all);
  };
  const creator = (a) => { if (a.role !== 'creator' && a.role !== 'owner') throw new Fail(403, 'not_creator', 'Only creators can make games for the TV.'); return a; };

  async function mine(a){
    const out = [];
    for (const f of await files.list(prefix(a.household_id))){
      try {
        const data = await files.get(f.key); if (!data) continue;
        const m = manifestOf(readOrlis(data));
        const ask = asks(a.household_id).get(m.id);
        out.push({ id: m.id, name: m.name, version: m.version, blurb: m.blurb, icon: m.icon, cover: m.cover, bytes: data.length, sha256: sha256(data), updatedAt: new Date(f.modified).toISOString(), asking: !!ask && ask.sha === sha256(data) });
      } catch {}
    }
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }
  /* may this family put this id in the Store */
  async function ownId(a, m){
    const inStore = (await shop.games()).find(g => g.id === m.id);
    const theirs = q('SELECT household_id FROM reach WHERE game_id = ?').get(m.id);
    if (inStore && (a.role !== 'owner') && (!theirs || theirs.household_id !== a.household_id)) throw new Fail(409, 'taken', `"${m.id}" is already a game in the Store that isn't yours. Give your game an id of its own.`);
    return inStore;
  }

  return {
    routes: (who) => [
      /* Test: the game goes where the TV can find it */
      ['POST', '/api/drafts', async ({ headers, raw }) => {
        const a = creator(who(headers));
        if (!raw || !raw.length) throw new Fail(400, 'no_file', 'Send the game\'s .orlis file.');
        const { manifest: m } = checkGame(raw);
        await ownId(a, m);
        rate('test', a.household_id, GUARDRAILS.testsPerMinute, 60e3, 'tests');
        const had = (await mine(a)).some(d => d.id === m.id);
        if (!had && (await mine(a)).length >= LIMITS.drafts) throw new Fail(400, 'too_many', `You have ${LIMITS.drafts} games being tested already. Remove one first.`);
        await files.put(keyOf(a.household_id, m.id), raw);
        touch(a.household_id); asks(a.household_id).delete(m.id); bump(a.household_id);
        log.add(a, 'tested', { gameId: m.id, name: m.name, version: m.version, note: `${fromTool(a) ? 'by the laptop tool' : 'from the app'} · fingerprint ${sha256(raw).slice(0, 12)}` });
        return [201, { id: m.id, name: m.name, version: m.version }];
      }],
      /* the family's: the Player app lists these ("Testing") */
      ['GET', '/api/drafts', async ({ headers }) => ({ drafts: await mine(who(headers)) })],
      /* the creator's app, open on Create Pro: still here */
      ['POST', '/api/drafts/here', ({ headers }) => { const a = creator(who(headers)); touch(a.household_id); return { ok: true }; }],
      /* the TV: wait until something has happened since the number it has. Answered at once if it already has;
         else when a Test (or the like) happens; else, empty, after a while. Drafts show only while a creator is here. */
      ['GET', '/api/drafts/wait', async ({ headers, query }) => {
        const a = who(headers), f = state(a.household_id);
        const since = Number(query.get('since')) || 0;
        const ms = Math.min(Math.max(Number(query.get('ms')) || WAIT_MS, 50), WAIT_MS);
        if (f.n <= since) await new Promise((ok) => { const t = setTimeout(() => { f.waiting = f.waiting.filter(x => x !== done); ok(); }, ms); const done = () => { clearTimeout(t); ok(); }; f.waiting.push(done); });
        const here = isHere(state(a.household_id));
        return { n: f.n, here, drafts: here ? await mine(a) : [] };
      }],
      ['GET', '/api/drafts/:id/file', async ({ headers, params }) => {
        const a = who(headers);
        const data = await files.get(keyOf(a.household_id, params.id));
        if (!data) throw new Fail(404, 'no_draft', 'That game isn\'t being tested.');
        return new Raw(data, `${params.id}.orlis`);
      }],
      /* "not now", on the TV: the question goes away */
      ['DELETE', '/api/drafts/:id/ask', ({ headers, params }) => {
        const a = who(headers);
        if (fromTool(a)) throw new Fail(403, 'tool', 'A person answers that, on the TV.');
        const had = asks(a.household_id).delete(params.id);
        if (had){ bump(a.household_id); log.add(a, 'publish-declined', { gameId: params.id }); }
        return { ok: true };
      }],
      ['DELETE', '/api/drafts/:id', async ({ headers, params }) => {
        const a = creator(who(headers));
        if (!(await files.del(keyOf(a.household_id, params.id)))) throw new Fail(404, 'no_draft', 'That game isn\'t being tested.');
        bump(a.household_id);
        log.add(a, 'taken-off', { gameId: params.id });
        return { ok: true };
      }],
      /* Publish: into the Store, for this family only */
      ['POST', '/api/drafts/:id/publish', async ({ headers, params }) => {
        const a = creator(who(headers));
        const raw = await files.get(keyOf(a.household_id, params.id));
        if (!raw) throw new Fail(404, 'no_draft', 'Test the game first: it isn\'t on the TV yet.');
        const { parts, manifest } = checkGame(raw);
        /* the laptop tool (Claude) can only ask: a grown-up presses Publish on the TV */
        if (GUARDRAILS.tvConfirmPublish && fromTool(a)){
          rate('ask', a.household_id, GUARDRAILS.asksPerHour, 3600e3, 'publish questions');
          asks(a.household_id).set(manifest.id, { sha: sha256(raw), until: Date.now() + GUARDRAILS.askMinutes * 60e3 });
          bump(a.household_id);
          log.add(a, 'publish-asked', { gameId: manifest.id, name: manifest.name, version: manifest.version, note: 'waiting for a grown-up on the TV' });
          return [202, { asking: true, game: { id: manifest.id, name: manifest.name, version: manifest.version } }];
        }
        const inStore = await ownId(a, manifest);
        if (inStore && !newer(manifest.version, inStore.version)) throw new Fail(409, 'old_version', `Version ${inStore.version} of ${manifest.name} is already published. Make a newer version.`);
        const m = JSON.parse(parts['manifest.json'].toString('utf8'));
        m.by = familyName(a);
        m.starter = false;
        const file = writeOrlis({ 'manifest.json': JSON.stringify(m, null, 2), 'game.js': parts['game.js'] });
        await shop.add(manifest.id, file);
        if (!inStore || q('SELECT 1 FROM reach WHERE game_id = ?').get(manifest.id)) q('INSERT OR REPLACE INTO reach (game_id, household_id) VALUES (?, ?)').run(manifest.id, a.household_id);
        try { await files.del(keyOf(a.household_id, manifest.id)); } catch {}
        asks(a.household_id).delete(manifest.id);
        bump(a.household_id);
        log.add(a, 'published', { gameId: manifest.id, name: manifest.name, version: manifest.version, note: `for ${m.by} only` });
        return { ok: true, game: { id: manifest.id, name: manifest.name, version: manifest.version, by: m.by, reach: 'family' } };
      }]
    ]
  };
}
