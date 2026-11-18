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

export const LIMITS = { drafts: 20 };

export function drafts(db, files, shop, log = { add(){} }){
  const q = (sql) => db.prepare(sql);
  const keyOf = (household, id) => `drafts/${household}/${id}.orlis`;
  const prefix = (household) => `drafts/${household}/`;
  const familyName = (a) => { const r = q('SELECT name FROM households WHERE id = ?').get(a.household_id); return r ? r.name : 'A family'; };
  const creator = (a) => { if (a.role !== 'creator' && a.role !== 'owner') throw new Fail(403, 'not_creator', 'Only creators can make games for the TV.'); return a; };

  async function mine(a){
    const out = [];
    for (const f of await files.list(prefix(a.household_id))){
      try {
        const data = await files.get(f.key); if (!data) continue;
        const m = manifestOf(readOrlis(data));
        out.push({ id: m.id, name: m.name, version: m.version, blurb: m.blurb, icon: m.icon, cover: m.cover, bytes: data.length, sha256: sha256(data), updatedAt: new Date(f.modified).toISOString() });
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
        const had = (await mine(a)).some(d => d.id === m.id);
        if (!had && (await mine(a)).length >= LIMITS.drafts) throw new Fail(400, 'too_many', `You have ${LIMITS.drafts} games being tested already. Remove one first.`);
        await files.put(keyOf(a.household_id, m.id), raw);
        return [201, { id: m.id, name: m.name, version: m.version }];
      }],
      /* the family's: the Player app lists these ("Testing") */
      ['GET', '/api/drafts', async ({ headers }) => ({ drafts: await mine(who(headers)) })],
      ['GET', '/api/drafts/:id/file', async ({ headers, params }) => {
        const a = who(headers);
        const data = await files.get(keyOf(a.household_id, params.id));
        if (!data) throw new Fail(404, 'no_draft', 'That game isn\'t being tested.');
        return new Raw(data, `${params.id}.orlis`);
      }],
      ['DELETE', '/api/drafts/:id', async ({ headers, params }) => {
        const a = creator(who(headers));
        if (!(await files.del(keyOf(a.household_id, params.id)))) throw new Fail(404, 'no_draft', 'That game isn\'t being tested.');
        return { ok: true };
      }],
      /* Publish: into the Store, for this family only */
      ['POST', '/api/drafts/:id/publish', async ({ headers, params }) => {
        const a = creator(who(headers));
        const raw = await files.get(keyOf(a.household_id, params.id));
        if (!raw) throw new Fail(404, 'no_draft', 'Test the game first: it isn\'t on the TV yet.');
        const { parts, manifest } = checkGame(raw);
        const inStore = await ownId(a, manifest);
        if (inStore && !newer(manifest.version, inStore.version)) throw new Fail(409, 'old_version', `Version ${inStore.version} of ${manifest.name} is already published. Make a newer version.`);
        const m = JSON.parse(parts['manifest.json'].toString('utf8'));
        m.by = familyName(a);
        m.starter = false;
        const file = writeOrlis({ 'manifest.json': JSON.stringify(m, null, 2), 'game.js': parts['game.js'] });
        await shop.add(manifest.id, file);
        if (!inStore || q('SELECT 1 FROM reach WHERE game_id = ?').get(manifest.id)) q('INSERT OR REPLACE INTO reach (game_id, household_id) VALUES (?, ?)').run(manifest.id, a.household_id);
        try { await files.del(keyOf(a.household_id, manifest.id)); } catch {}
        log.add(a, 'published', { gameId: manifest.id, name: manifest.name, version: manifest.version, note: `for ${m.by} only` });
        return { ok: true, game: { id: manifest.id, name: manifest.name, version: manifest.version, by: m.by, reach: 'family' } };
      }]
    ]
  };
}
