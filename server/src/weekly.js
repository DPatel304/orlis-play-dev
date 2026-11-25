/* This week, for the whole family - a reason to come back every Monday.

   Featured (decision 0058): three numbered slots the owner fills with any game - a Discover game or one built into Orlis Play
   (builtin.js). A slot left empty takes a Discover game from the rotation, a new few every Monday. Older apps read the plain list of
   Discover ids ("featured" in /api/store: the slotted ones first, then the rotation); newer ones read "featuredSlots" (featuredSlots() below).

   Challenges: three goals a week the family reaches together, made of the
   rounds everyone plays (each Orlis Play tells the server when a round
   ends: which game, how long). Reaching one wins the family a star. They
   reset every Monday; nothing is lost for missing a week. */
import { Fail } from './http.js';
import { builtIn } from './builtin.js';

export const SLOTS = 3;

const DAY = 864e5;
/* Monday, 00:00 (the server's own time), of the week `now` is in */
export function weekStart(now = new Date()){
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
/* a number per week, the same all week (for taking turns) */
export const weekIndex = (now = new Date()) => Math.round(weekStart(now).getTime() / (7 * DAY));

/* This week's featured ids, of the games given: pins first, then turns. */
export function featuredIds(ids, pins = [], now = new Date(), n = 3){
  const pinned = pins.filter(id => ids.includes(id));
  const rest = ids.filter(id => !pinned.includes(id)).sort();
  const k = rest.length ? (weekIndex(now) * 3) % rest.length : 0;
  return [...pinned, ...rest.slice(k), ...rest.slice(0, k)].slice(0, n);
}

/* The games every Orlis Play has, for challenges about one game. */
export const BUILT_IN = [['pop-party', 'Pop Party'], ['sky-painter', 'Sky Painter'], ['leaf-pile', 'Leaf Pile'], ['sleepy-bear', 'Sleepy Bear'], ['stack-it-high', 'Stack It High']];

/* This week's three: a game to play a few rounds of, some different games, and a few rounds of a second game.
   (No "minutes moving together" challenge: owner, 2026-11-25, decision 0065.) */
export function challenges(now = new Date()){
  const w = weekIndex(now), pool = BUILT_IN;
  const [a, an] = pool[w % pool.length], [b, bn] = pool[(w + 2) % pool.length];
  return [
    { id: `rounds-${a}`, kind: 'rounds', game: a, need: 5, title: `Play 5 rounds of ${an}` },
    { id: 'different', kind: 'different', need: 4, title: 'Play 4 different games' },
    { id: `rounds-${b}`, kind: 'rounds', game: b, need: 3, title: `Play 3 rounds of ${bn}` }
  ];
}
/* How far the family's got, from this week's rounds. */
export function progress(list, plays){
  return list.map(c => {
    const have = c.kind === 'rounds' ? plays.filter(p => p.game_id === c.game).length
      : new Set(plays.map(p => p.game_id)).size;
    return { ...c, have: Math.min(have, c.need), done: have >= c.need };
  });
}

export function weekly(db, { now = () => new Date() } = {}){
  const q = (s) => db.prepare(s);
  /* the three slots, in order: a game id or null */
  const slots = () => {
    const out = Array(SLOTS).fill(null);
    for (const r of q('SELECT slot, game_id FROM featured_slots').all()) out[r.slot - 1] = r.game_id;
    return out;
  };
  const pins = () => slots().filter(Boolean);
  /* slot n (1 to 3) holds game id, or nothing (id null); a game is in one slot only, so putting it in another moves it. Answers what it replaced. */
  const setSlot = (n, id) => {
    const was = slots()[n - 1];
    db.exec('BEGIN');
    try {
      if (id){
        q('DELETE FROM featured_slots WHERE game_id = ? OR slot = ?').run(id, n);
        q('INSERT INTO featured_slots (slot, game_id, set_at) VALUES (?, ?, ?)').run(n, id, now().toISOString());
      } else q('DELETE FROM featured_slots WHERE slot = ?').run(n);
      db.exec('COMMIT');
    } catch (e){ db.exec('ROLLBACK'); throw e; }
    return was;
  };
  /* What the app reads (Home's Featured row): [slot 1, 2, 3], each { slot, id, name, builtIn, rotating, ...the Store entry, for a Store game }.
     entries: the Store games this family may see. A slot whose game this family cannot see counts as empty. An empty slot takes the next
     Discover game in the rotation (rotating: true), so there are three whenever there are games enough. */
  const featuredSlots = (entries) => {
    const slotted = slots().map((id) => {
      if (!id) return null;
      const b = builtIn(id), e = entries.find(x => x.id === id);
      if (!b && !e) return null;
      return { ...(e || {}), id, name: b ? b.name : e.name, builtIn: !!b };
    });
    const used = new Set(slotted.filter(Boolean).map(x => x.id));
    const fill = featuredIds(entries.map(e => e.id).filter(id => !used.has(id)), [], now(), slotted.filter(x => !x).length);
    return slotted.map((x, i) => {
      if (x) return { slot: i + 1, rotating: false, ...x };
      const next = fill.shift(), e = entries.find(y => y.id === next);
      return e ? { slot: i + 1, rotating: true, ...e, builtIn: false } : null;
    }).filter(Boolean);
  };
  return {
    pins, slots, setSlot, featuredSlots,
    featured: (ids) => featuredIds(ids, pins(), now()),
    routes(who, owner, log, gameName = () => null, heads = () => {}){
      /* slot N gets game id (or is emptied: id null): the game must be a built-in one or one in the Store; it goes in the history */
      const put = async (me, slotText, id) => {
        const n = Number(slotText);
        if (!Number.isInteger(n) || n < 1 || n > SLOTS) throw new Fail(400, 'bad_slot', 'Slots are 1, 2 and 3.');
        if (id == null || id === ''){
          const was = setSlot(n, null);
          if (was) log.add(me, 'unfeatured', { gameId: was, name: (builtIn(was) || {}).name || await gameName(was), note: `slot ${n}` });
          return { slot: n, id: null };
        }
        id = String(id).slice(0, 80);
        const name = (builtIn(id) || {}).name || await gameName(id);
        if (!name) throw new Fail(404, 'no_game', 'That game isn\'t in Orlis Play or the Store.');
        setSlot(n, id);
        log.add(me, 'featured', { gameId: id, name, note: `slot ${n}` });
        return { slot: n, id, name, builtIn: !!builtIn(id) };
      };
      return [
        /* a round's over: which game, the best score, how long, how many played */
        ['POST', '/api/plays', ({ headers, body }) => {
          const a = who(headers, { waiting: true });
          const id = String(body.gameId || '').slice(0, 80);
          if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Fail(400, 'bad_game', 'Which game?');
          const secs = Math.max(0, Math.min(3600, Math.round(Number(body.secs) || 0)));
          const value = Math.max(0, Math.min(1e9, Math.round(Number(body.value) || 0)));
          const players = Math.max(1, Math.min(4, Math.round(Number(body.players) || 1)));
          const before = q('SELECT COUNT(*) AS n FROM plays WHERE household_id = ?').get(a.household_id).n;
          q('INSERT INTO plays (household_id, account_id, game_id, value, secs, players, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(a.household_id, a.id, id, value, secs, players, now().toISOString());
          /* a family's very first game (not the owner's own): a heads-up for the owner */
          if (before === 0){
            const mine = q("SELECT household_id AS h FROM accounts WHERE role = 'owner' ORDER BY created_at LIMIT 1").get();
            const fam = q('SELECT name FROM households WHERE id = ?').get(a.household_id);
            if (!mine || mine.h !== a.household_id){
              Promise.resolve().then(() => gameName(id)).catch(() => null).then((n) => {
                /* (kept in the history too, for the management page's Activity) */
                try { log.add(a, 'first-play', { gameId: id, name: n || id, note: `${(fam && fam.name) || 'A family'}${players > 1 ? ` · ${players} players` : ''}` }); } catch {}
                try { heads(`${(fam && fam.name) || 'A family'} played their first game`, `${n || id}${players > 1 ? ` with ${players} players` : ''}`); } catch {}
              });
            }
          }
          return { ok: true };
        }],
        /* this week's challenges, and how far the family's got */
        ['GET', '/api/challenges', ({ headers }) => {
          const a = who(headers, { waiting: true });
          const from = weekStart(now()), to = new Date(from.getTime() + 7 * DAY);
          const plays = q('SELECT game_id, secs FROM plays WHERE household_id = ? AND at >= ? AND at < ?').all(a.household_id, from.toISOString(), to.toISOString());
          const list = progress(challenges(now()), plays);
          const week = from.toISOString().slice(0, 10);
          for (const c of list) if (c.done) q('INSERT OR IGNORE INTO trophies (household_id, week, challenge_id, at) VALUES (?, ?, ?, ?)').run(a.household_id, week, c.id, now().toISOString());
          /* (stars; the table is still called trophies, and the answer keeps that name too, for older apps) */
          const stars = q('SELECT COUNT(*) AS n FROM trophies WHERE household_id = ?').get(a.household_id).n;
          return { week, ends: to.toISOString(), challenges: list, stars, trophies: stars };
        }],
        /* the owner puts a game in Featured slot N (1 to 3) - { id }, a Discover game or a built-in one - or empties it ({ id: null }, or DELETE) */
        ['POST', '/api/featured/:slot', async ({ headers, params, body, ip }) => put(owner(headers, ip), params.slot, body && body.id)],
        ['DELETE', '/api/featured/:slot', async ({ headers, params, ip }) => put(owner(headers, ip), params.slot, null)],
        /* the older on/off: on puts the game in the first empty slot (none empty: refused), off takes it out of its slot */
        ['POST', '/api/store/:id/feature', async ({ headers, params, body, ip }) => {
          const me = owner(headers, ip);
          const have = slots(), at = have.indexOf(params.id);
          if (body && body.on === true){
            if (at >= 0) return { id: params.id, featured: true, slot: at + 1 };
            const free = have.indexOf(null);
            if (free < 0) throw new Fail(409, 'slots_full', 'Three games are featured already. Take one out first.');
            await put(me, free + 1, params.id);
            return { id: params.id, featured: true, slot: free + 1 };
          }
          if (at >= 0) await put(me, at + 1, null);
          return { id: params.id, featured: false };
        }]
      ];
    }
  };
}
