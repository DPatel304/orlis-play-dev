/* The Store: the games this server hands out, as .orlis files under
   "games/" in its file store (files.js - on the laptop, the "games" folder
   in its data folder). Drop a .orlis file in and it's in the Store; take it
   out and it's gone. A newer version of a game replaces
   the older one by being newer.

   The server comes with some games of its own (its "starter" games, built
   into it); the first time it runs, it puts them in the folder. They're
   only put back if they're missing or older, so a game removed on purpose
   is noticed by its file being gone - see STARTERS_DONE. */
import { readOrlis, manifestOf, sha256 } from './orlis-file.js';
import { Fail, Raw } from './http.js';

export const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++){ if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
};

/* store(files, starters): the Store, kept in the file store (files.js)
   under "games/". (Async to make: the starter games go in first.) */
const DIR = 'games/', DONE = 'games/.starters';
export async function store(files, starters = []){
  /* the starter games, put in (or brought up to date) on start */
  const doneText = await files.get(DONE);
  const had = doneText ? new Set(doneText.toString('utf8').split('\n').filter(Boolean)) : new Set();
  for (const { name, data } of starters){
    try {
      const m = manifestOf(readOrlis(data));
      const target = DIR + name;
      const old = await files.get(target);
      const there = old ? (() => { try { return manifestOf(readOrlis(old)); } catch { return null; } })() : null;
      const key = `${m.id}@${m.version}`;
      /* new to this server, or an update to one it has - but not one the
         owner took out after it was put in */
      if ((!there && !had.has(m.id)) || (there && newer(m.version, there.version))) await files.put(target, data);
      had.add(m.id); had.add(key);
    } catch (e){ console.error(`starter game ${name} skipped: ${e.message}`); }
  }
  await files.put(DONE, Buffer.from([...had].join('\n')));

  /* what's in it now: each file read again only when it's changed */
  let cache = new Map();          /* key -> { modified, size, entry } */
  async function games(){
    const seen = new Map(), listed = await files.list(DIR);
    for (const f of listed){
      if (!f.key.toLowerCase().endsWith('.orlis')) continue;
      let c = cache.get(f.key);
      if (!c || c.modified !== f.modified || c.size !== f.size){
        try {
          const data = await files.get(f.key); if (!data) continue;
          const m = manifestOf(readOrlis(data));
          c = { modified: f.modified, size: f.size, entry: { ...m, bytes: data.length, sha256: sha256(data), added: new Date(f.modified).toISOString(), file: f.key } };
        } catch (e){ c = { modified: f.modified, size: f.size, entry: null, error: e.message }; }
        cache.set(f.key, c);
      }
      if (!c.entry) continue;
      const prev = seen.get(c.entry.id);
      if (!prev || newer(c.entry.version, prev.version)) seen.set(c.entry.id, c.entry);
    }
    const now = new Set(listed.map(f => f.key));
    for (const k of cache.keys()) if (!now.has(k)) cache.delete(k);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  /* a game going into the Store (approved) */
  async function add(id, bytes){ await files.put(`${DIR}${id}.orlis`, bytes); }
  const pub = ({ file, ...g }) => g;

  return {
    dir: files.where(DIR), games, add,
    /* reach: { of(gameId) -> 'everyone' | 'family', canSee(account, gameId) }
       - a family's own games are for that family until the owner shares them */
    routes: (who, owner, log = { add(){} }, reach = { of: () => 'everyone', canSee: () => true }, week = null) => [
      ['GET', '/api/store', async ({ headers, ip }) => {
        const a = headers['x-orlis-manage'] !== undefined ? owner(headers, ip) : who(headers);
        const all = a.role === 'owner';
        const seen = (await games()).filter(g => all || reach.canSee(a, g.id));
        /* (this week's featured, for the Play page: the owner's pins, then turns) */
        const pins = week ? week.pins() : [];
        return { games: seen.map(g => ({ ...pub(g), reach: reach.of(g.id), pinned: pins.includes(g.id) })), featured: week ? week.featured(seen.map(g => g.id)) : [] };
      }],
      ['GET', '/api/store/:id/file', async ({ headers, params }) => {
        const a = who(headers);
        const g = (await games()).find(x => x.id === params.id && (a.role === 'owner' || reach.canSee(a, x.id)));
        const data = g && await files.get(g.file);
        if (!data) throw new Fail(404, 'no_game', 'That game isn\'t in the Store.');
        return new Raw(data, `${g.id}-${g.version}.orlis`);
      }],
      /* the owner takes a game out of the Store (every version of it; a
         starter game isn't put back) */
      ['DELETE', '/api/store/:id', async ({ headers, params, ip }) => {
        const me = owner(headers, ip);
        const was = (await games()).find(g => g.id === params.id);
        let n = 0;
        for (const [f, c] of cache) if (c.entry && c.entry.id === params.id){ try { if (await files.del(f)) n++; } catch {} }
        if (!n) throw new Fail(404, 'no_game', 'That game isn\'t in the Store.');
        cache = new Map();
        log.add(me, 'removed', { gameId: params.id, name: was && was.name, version: was && was.version, note: was && was.by ? `by ${was.by}` : null });
        return { ok: true };
      }]
    ]
  };
}
