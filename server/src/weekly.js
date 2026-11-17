/* This week, for the whole family - a reason to come back every Monday.

   Featured: which of Discover's games the Play page puts up front. The
   owner's pins come first; the rest take turns, a new few every Monday.

   Challenges: three goals a week the family reaches together, made of the
   rounds everyone plays (each Orlis Play tells the server when a round
   ends: which game, how long). Reaching one wins the family a trophy. They
   reset every Monday; nothing is lost for missing a week. */
import { Fail } from './http.js';

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
export function featuredIds(ids, pins = [], now = new Date(), n = 6){
  const pinned = pins.filter(id => ids.includes(id));
  const rest = ids.filter(id => !pinned.includes(id)).sort();
  const k = rest.length ? (weekIndex(now) * 3) % rest.length : 0;
  return [...pinned, ...rest.slice(k), ...rest.slice(0, k)].slice(0, n);
}

/* The games every Orlis Play has, for challenges about one game. */
export const BUILT_IN = [['pop-party', 'Pop Party'], ['sky-painter', 'Sky Painter'], ['leaf-pile', 'Leaf Pile'], ['sleepy-bear', 'Sleepy Bear'], ['stack-it-high', 'Stack It High']];

/* This week's three: a game to play a few rounds of, some different games,
   and - every other week - minutes moving together, else a second game. */
export function challenges(now = new Date()){
  const w = weekIndex(now), pool = BUILT_IN;
  const [a, an] = pool[w % pool.length], [b, bn] = pool[(w + 2) % pool.length];
  return [
    { id: `rounds-${a}`, kind: 'rounds', game: a, need: 5, title: `Play 5 rounds of ${an}` },
    { id: 'different', kind: 'different', need: 4, title: 'Play 4 different games' },
    w % 2
      ? { id: 'minutes', kind: 'minutes', need: 30, title: 'Move together for 30 minutes' }
      : { id: `rounds-${b}`, kind: 'rounds', game: b, need: 3, title: `Play 3 rounds of ${bn}` }
  ];
}
/* How far the family's got, from this week's rounds. */
export function progress(list, plays){
  return list.map(c => {
    const have = c.kind === 'rounds' ? plays.filter(p => p.game_id === c.game).length
      : c.kind === 'different' ? new Set(plays.map(p => p.game_id)).size
      : Math.floor(plays.reduce((s, p) => s + p.secs, 0) / 60);
    return { ...c, have: Math.min(have, c.need), done: have >= c.need };
  });
}

export function weekly(db, { now = () => new Date() } = {}){
  const q = (s) => db.prepare(s);
  const pins = () => q('SELECT game_id FROM featured ORDER BY pinned_at').all().map(r => r.game_id);
  return {
    pins,
    featured: (ids) => featuredIds(ids, pins(), now()),
    routes(who, owner, log, gameName = () => null){
      return [
        /* a round's over: which game, the best score, how long, how many played */
        ['POST', '/api/plays', ({ headers, body }) => {
          const a = who(headers, { waiting: true });
          const id = String(body.gameId || '').slice(0, 80);
          if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Fail(400, 'bad_game', 'Which game?');
          const secs = Math.max(0, Math.min(3600, Math.round(Number(body.secs) || 0)));
          const value = Math.max(0, Math.min(1e9, Math.round(Number(body.value) || 0)));
          const players = Math.max(1, Math.min(4, Math.round(Number(body.players) || 1)));
          q('INSERT INTO plays (household_id, account_id, game_id, value, secs, players, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(a.household_id, a.id, id, value, secs, players, now().toISOString());
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
          const trophies = q('SELECT COUNT(*) AS n FROM trophies WHERE household_id = ?').get(a.household_id).n;
          return { week, ends: to.toISOString(), challenges: list, trophies };
        }],
        /* the owner puts a Discover game up front, or lets it take turns */
        ['POST', '/api/store/:id/feature', ({ headers, params, body, ip }) => {
          const me = owner(headers, ip);
          const on = body.on === true;
          if (on) q('INSERT OR IGNORE INTO featured (game_id, pinned_at) VALUES (?, ?)').run(params.id, now().toISOString());
          else q('DELETE FROM featured WHERE game_id = ?').run(params.id);
          log.add(me, on ? 'featured' : 'unfeatured', { gameId: params.id, name: gameName(params.id) });
          return { id: params.id, featured: on };
        }]
      ];
    }
  };
}
