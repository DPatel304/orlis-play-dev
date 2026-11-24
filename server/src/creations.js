/* The family's own games, made in Create (decisions 0056, 0057): picked from pictures on the TV and kept on the family's server, so
   every TV in the house sees them. A creation is a description in the Orlis.play vocabulary (games/play/) plus the picks that made it,
   so the builder can open it again. No code is in it: only the vocabulary, checked here as the app checks it.

   Three slots per household. Only that household's own grown-ups (and the profiles under them) can list, save or remove them. */
import { Fail } from './http.js';
import { now } from './db.js';
import { newId } from './secure.js';
import { badWords } from './words.js';
import { validate } from '../../app/src/games/play/validate.js';
import { playEnv } from '../../app/src/games/play/env.js';

export const LIMITS = { slots: 3, name: [1, 40], picks: 2000, desc: 20000, things: 5 };

export function creations(db){
  const q = (sql) => db.prepare(sql);
  const env = playEnv();
  const json = (t) => { try { return JSON.parse(t); } catch { return null; } };
  const out = (r) => ({ id: r.id, name: r.name, makerId: r.maker_id, picks: json(r.picks) || {}, desc: json(r.description) || {}, createdAt: r.created_at, updatedAt: r.updated_at });
  const list = (hh) => q('SELECT * FROM creations WHERE household_id = ? ORDER BY created_at, rowid').all(hh).map(out);
  /* every piece of text anywhere in a description (a word that isn't for children is turned away) */
  const strings = (v, acc = []) => { if (typeof v === 'string') acc.push(v); else if (Array.isArray(v)) v.forEach(x => strings(x, acc)); else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, acc)); return acc; };

  return {
    routes: (who) => [
      /* the family's creations, and how many slots there are */
      ['GET', '/api/creations', ({ headers }) => {
        const a = who(headers);
        return { creations: list(a.household_id), max: LIMITS.slots };
      }],
      /* make one, or (with an id of theirs) change one in its own slot */
      ['POST', '/api/creations', ({ headers, body }) => {
        const a = who(headers), b = body || {};
        const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
        if (name.length < LIMITS.name[0] || name.length > LIMITS.name[1]) throw new Fail(400, 'bad_name', `A game's name is ${LIMITS.name[0]} to ${LIMITS.name[1]} letters.`);
        if (!b.picks || typeof b.picks !== 'object' || Array.isArray(b.picks) || JSON.stringify(b.picks).length > LIMITS.picks || (Array.isArray(b.picks.things) && (!b.picks.things.length || b.picks.things.length > LIMITS.things))) throw new Fail(400, 'bad_picks', 'Those picks could not be kept.');
        const text = JSON.stringify(b.desc ?? null);
        if (text.length > LIMITS.desc) throw new Fail(400, 'bad_game', 'That game is too big.');
        const problems = validate(b.desc, env);
        if (problems.length) throw new Fail(400, 'bad_game', problems.slice(0, 3).join(' '));
        const bad = badWords([name, ...strings(b.desc)].join(' '));
        if (bad.length) throw new Fail(400, 'bad_words', 'A word in that game is not for children.');
        /* the maker is one of the family's profiles */
        const maker = q('SELECT p.id FROM profiles p JOIN accounts x ON x.id = p.account_id WHERE p.id = ? AND x.household_id = ?').get(String(b.makerId || ''), a.household_id);
        if (!maker) throw new Fail(400, 'bad_maker', 'Who made it? Pick one of the family.');
        const t = now();
        if (b.id !== undefined){
          const mine = q('SELECT id FROM creations WHERE id = ? AND household_id = ?').get(String(b.id), a.household_id);
          if (!mine) throw new Fail(404, 'no_creation', 'That game is not in your family any more.');
          q('UPDATE creations SET name = ?, picks = ?, description = ?, maker_id = ?, updated_at = ? WHERE id = ?').run(name, JSON.stringify(b.picks), text, maker.id, t, mine.id);
          return out(q('SELECT * FROM creations WHERE id = ?').get(mine.id));
        }
        if (q('SELECT COUNT(*) AS n FROM creations WHERE household_id = ?').get(a.household_id).n >= LIMITS.slots)
          throw new Fail(409, 'full', `Your slots are full: all ${LIMITS.slots} are used. Remove a game to make another.`);
        const id = newId();
        q('INSERT INTO creations (id, household_id, maker_id, name, picks, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, a.household_id, maker.id, name, JSON.stringify(b.picks), text, t, t);
        return [201, out(q('SELECT * FROM creations WHERE id = ?').get(id))];
      }],
      /* take one out (its slot is free again) */
      ['DELETE', '/api/creations/:id', ({ headers, params }) => {
        const a = who(headers);
        const r = q('DELETE FROM creations WHERE id = ? AND household_id = ?').run(params.id, a.household_id);
        if (!r.changes) throw new Fail(404, 'no_creation', 'That game is already gone.');
        return { ok: true };
      }]
    ]
  };
}
