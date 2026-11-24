/* The home page's rows and focus, with no DOM (so they can be tested): decision 0055 (after 0045's one page).

   Play has two rows, top to bottom:
     featured  "Featured"     this week's featured games not on this PC yet (with Get and download progress on their tiles, at most three),
                              then the Discover tile, which opens the Discover page
     games     "My library"   the games on this PC (owner, 2026-11-24: was "Your games")
   A third, "Made by us" (0056, 0057), holds the games the family made in Create (with the maker's face on each tile); there is no row until there is one.
   A last, "Testing", comes only while a creator has put a game on this TV to try.
   The top tabs (Play, Create) are not rows: tabsFor() says whether they show, and the page keeps their focus.
   The Discover page (0055) uses the same rows and tiles: a row per category, from discoverRows().

   Focus is { row, col }. Left and right stay in the row; up and down change row, landing on the column last used there
   (clamped to the row's length). Up from the first row goes to the tabs (home.js), when there are tabs. */

export const TITLES = { waiting: 'Waiting for your OK', featured: 'Featured', games: 'My library', made: 'Made by us', testing: 'Testing', updates: 'Updates' };
export const FEATURED_MAX = 3;
/* how many rows keep the big hero (Play's two; Discover keeps it for its first row only) */
export const PLAY_BIG = 2;

/* pool: the games on this PC (shown in the order given); featured: this week's featured Discover games not on this PC yet (stand-ins that
   know their entry); discover: whether Discover has a page to open (the Discover tile); made: the family's own games from Create (each a game
   object, see create/made-game.js); testing: games a creator is trying on this TV. */
export function homeRows({ pool = [], featured = [], discover = false, made = [], testing = [] } = {}){
  const rows = [];
  const fresh = featured.slice(0, FEATURED_MAX).map(g => ({ kind: 'get', g }));
  if (fresh.length || discover) rows.push({ id: 'featured', title: TITLES.featured, items: [...fresh, ...(discover ? [{ kind: 'discover' }] : [])] });
  if (pool.length) rows.push({ id: 'games', title: TITLES.games, items: pool.map(g => ({ kind: 'game', g })) });
  if (made.length) rows.push({ id: 'made', title: TITLES.made, items: made.map(g => ({ kind: 'game', g, made: true })) });
  if (testing.length) rows.push({ id: 'testing', title: TITLES.testing, items: testing.map(d => ({ kind: 'test', d })) });
  return rows;
}

/* The Discover page's rows: the owner's games waiting for an OK (to try), then games to update, then a row per category (store.js layout()'s rows: { name, sub, list }). Every tile is a "get". */
export function discoverRows({ waiting = [], updates = [], rows = [] } = {}){
  const out = [];
  if (waiting.length) out.push({ id: 'waiting', title: TITLES.waiting, items: waiting.map(g => ({ kind: 'try', g })) });
  if (updates.length) out.push({ id: 'updates', title: TITLES.updates, items: updates.map(g => ({ kind: 'get', g, update: true })) });
  for (const r of rows) if (r.list && r.list.length) out.push({ id: 'cat:' + r.name, title: r.name, items: r.list.map(g => ({ kind: 'get', g })) });
  return out;
}

/* Which tabs show along the top (decisions 0055, 0057): Play and Create, for everyone in the Player app - children make games too; none for a profile
   still waiting to be let in, or in the Creator app. modeTabs: appMode.tabs(). (`kid` is still accepted and means nothing.) */
export function tabsFor({ waiting = false, creatorApp = false, modeTabs = ['home', 'store', 'create'] } = {}){
  if (waiting || creatorApp || !modeTabs.includes('create') || !modeTabs.includes('home')) return [];
  return ['play', 'create'];
}

/* where focus starts: back on the game picked this session (coming home from a round), else the first tile of the first row, so Home
   opens on Featured with My library peeking in below it (owner, 2026-11-24; it used to open on the game played last, in "Your games").
   `last` is still accepted and no longer used. */
export function startFocus(rows, { session = null, last = null } = {}){
  const find = (id) => { for (let r = 0; r < rows.length; r++){ const c = rows[r].items.findIndex(it => it.kind === 'game' && it.g && it.g.id === id); if (c >= 0) return { row: r, col: c }; } return null; };
  return (session && find(session)) || { row: 0, col: 0 };
}

/* One step of focus. mem: the column last used in each row (kept by the caller). Returns { row, col } or null (nowhere to go). */
export function step(rows, pos, dir, mem = {}){
  const { row, col } = pos;
  if (dir === 'left') return col > 0 ? { row, col: col - 1 } : null;
  if (dir === 'right') return col < rows[row].items.length - 1 ? { row, col: col + 1 } : null;
  if (dir === 'up') return row > 0 ? { row: row - 1, col: Math.min(mem[row - 1] ?? col, rows[row - 1].items.length - 1) } : null;
  if (dir === 'down') return row < rows.length - 1 ? { row: row + 1, col: Math.min(mem[row + 1] ?? col, rows[row + 1].items.length - 1) } : null;
  return null;
}

/* The hero for whatever is focused (decision 0046): no title (the lit tile shows the name; `name` is for screen readers), one line, how many
   play (`players`: { lo, hi } or null, drawn as one figure or two; no time), and `cta` (what picking it does: it names the tile for screen readers
   and the hand's "Wave to ..."; there is no Play button). cap: how many players this PC can seat. */
export function heroOf(item, { blurb = '', cap = 4 } = {}){
  const none = { name: '', line: '', players: null, cta: null };
  if (!item) return none;
  if (item.kind === 'try'){
    const g = item.g, by = g.discover && g.discover.by;
    return { name: g.name, line: `${by ? `Sent by ${by}. ` : ''}Play it for 20 seconds with Try it, then approve it on the management page.`, players: null, cta: { label: 'Try it', icon: 'play' } };
  }
  if (item.kind === 'game' || item.kind === 'get'){
    const g = item.g, lo = Math.min(g.minPlayers || 1, cap), hi = Math.min(g.maxPlayers || 4, cap);
    const players = g.passive ? null : { lo, hi };
    return { name: g.name, line: blurb || (g.passive ? "A story" : ""), players, cta: item.kind === 'get' ? { label: item.update ? 'Update' : 'Get', icon: 'get' } : { label: 'Play', icon: 'play' } };
  }
  if (item.kind === 'discover') return { name: 'Discover', line: 'Every game your family can get', players: null, cta: { label: 'Open', icon: 'play' } };
  if (item.kind === 'test') return { name: item.d.name, line: item.d.asking ? 'On this TV, asking to publish' : 'On this TV to try', players: null, cta: { label: 'Try it', icon: 'play' } };
  return none;
}

/* Is the hero big (the page at rest) or a banner (scrolled)? Only the first `big` rows keep it big (Play: its two; Discover: the first). */
export const bigHero = (pos, rows, big = 1) => !rows.length || pos.row < big;

/* The "how you play" row (decisions 0052, trimmed by the owner 2026-11-23): only the players (people icon and number) and, when a tablet
   plays a part, PlayPad / PlayPad optional (0054). A story (`passive`) shows no row. Read from `seats` ({ pads: [lo, hi] }), `requiredPads`, and the counts. */
export const padsOf = (g) => { const p = g && g.seats && Array.isArray(g.seats.pads) ? g.seats.pads : null; return p ? { lo: Math.max(p[0] | 0, (g.requiredPads | 0) > 0 || Array.isArray(g.requiredPads) ? 1 : 0), hi: p[1] | 0 } : { lo: 0, hi: 0 }; };
/* does the game need a tablet? (the mark on its tile) */
export const needsTablet = (g) => { const p = padsOf(g); return !!g && !g.passive && p.hi === 1 && p.lo >= 1; };
export const playersText = (lo, hi) => lo === hi ? String(hi) : `${lo}–${hi}`;
export function howYouPlay(g, { cap = 4 } = {}){
  if (!g || g.passive) return [];
  const lo = Math.min(g.minPlayers || 1, cap), hi = Math.min(g.maxPlayers || 4, cap);
  const items = [{ id: 'players', icon: 'people', lo, hi, text: playersText(lo, hi), label: lo === hi ? `${hi} player${hi > 1 ? 's' : ''}` : `${lo} to ${hi} players` }];
  if (padsOf(g).hi === 1) items.push({ id: 'tablet', icon: 'tabletgrip', text: padsOf(g).lo >= 1 ? 'PlayPad' : 'PlayPad optional' });
  return items;
}
