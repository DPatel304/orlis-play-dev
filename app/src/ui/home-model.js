/* The home page's rows and focus, with no DOM (so they can be tested): decision 0045, "Home: one page, no tabs".

   Three rows, top to bottom:
     games  "Your games"     the games on this PC
     new    "New to try"     what Discover was: games to get (with Get and download progress on their tiles), then "More to try"
     make   "Make a game"    Ask for a game, Your requests, and Create Pro (grown-ups, and Creator mode)
   A fourth, "Testing", comes only while a creator has put a game on this TV to try.

   Focus is { row, col }. Left and right stay in the row; up and down change row, landing on the column last used there
   (clamped to the row's length). Moving up from the first row goes to the page's top (the Play button), and down from
   the Play button goes back to the first row. */

export const TITLES = { games: 'Your games', new: 'New to try', make: 'Make a game', testing: 'Testing' };

/* the Make a game tiles: what each opens, and whether only grown-ups see it */
export const MAKE = [
  { id: 'ask', name: 'Ask for a game', line: 'Tell us the game you imagine', prop: 'sparkle', tone: 'm1' },
  { id: 'requests', name: 'Your requests', line: 'Games being made for you', prop: 'chest', tone: 'm2' },
  { id: 'pro', name: 'Create Pro', line: 'Build games with Claude Code', prop: 'block', tone: 'm3', tag: 'Grown-ups' }
];

/* pool: the games on this PC (shown in the order given); toGet: Discover games not on this PC yet (stand-ins that know their entry);
   make: which Make tiles to show (ids), [] for none (a child); more: whether Discover has a page to open ("More to try");
   testing: games a creator is trying on this TV. */
export function homeRows({ pool = [], toGet = [], make = [], more = false, testing = [] } = {}){
  const rows = [];
  if (pool.length) rows.push({ id: 'games', title: TITLES.games, items: pool.map(g => ({ kind: 'game', g })) });
  const fresh = toGet.slice(0, 6).map(g => ({ kind: 'get', g }));
  if (fresh.length || (more && pool.length)) rows.push({ id: 'new', title: TITLES.new, items: [...fresh, ...(more ? [{ kind: 'more' }] : [])] });
  const tiles = MAKE.filter(m => make.includes(m.id)).map(m => ({ kind: 'make', ...m }));
  if (tiles.length) rows.push({ id: 'make', title: TITLES.make, items: tiles });
  if (testing.length) rows.push({ id: 'testing', title: TITLES.testing, items: testing.map(d => ({ kind: 'test', d })) });
  return rows;
}

/* which Make tiles a person sees: a child none; a grown-up Ask and Requests; a creator (or the owner) Create Pro as well;
   the Creator app is only Create Pro */
export function makeFor({ kid = false, creator = false, creatorApp = false } = {}){
  if (kid) return [];
  if (creatorApp) return creator ? ['pro'] : ['ask'];
  return creator ? ['ask', 'requests', 'pro'] : ['ask', 'requests'];
}

/* where focus starts: the game picked this session, else the one played last, else the first tile of the first row */
export function startFocus(rows, { session = null, last = null } = {}){
  const find = (id) => { for (let r = 0; r < rows.length; r++){ const c = rows[r].items.findIndex(it => it.g && it.g.id === id); if (c >= 0) return { row: r, col: c }; } return null; };
  return (session && find(session)) || (last && find(last)) || { row: 0, col: 0 };
}

/* One step of focus. mem: the column last used in each row (kept by the caller). Returns { row, col } or 'top' (up from the first
   row: the Play button) or null (nowhere to go). from 'top', 'down' goes to the first row. */
export function step(rows, pos, dir, mem = {}){
  if (pos === 'top') return dir === 'down' && rows.length ? { row: 0, col: Math.min(mem[0] ?? 0, rows[0].items.length - 1) } : null;
  const { row, col } = pos;
  if (dir === 'left') return col > 0 ? { row, col: col - 1 } : null;
  if (dir === 'right') return col < rows[row].items.length - 1 ? { row, col: col + 1 } : null;
  if (dir === 'up') return row > 0 ? { row: row - 1, col: Math.min(mem[row - 1] ?? col, rows[row - 1].items.length - 1) } : 'top';
  if (dir === 'down') return row < rows.length - 1 ? { row: row + 1, col: Math.min(mem[row + 1] ?? col, rows[row + 1].items.length - 1) } : null;
  return null;
}

/* The big hero for whatever is focused: its title, one line, the chips and the one big button. cap: how many players this PC can seat. */
export function heroOf(item, { blurb = '', cap = 4 } = {}){
  if (!item) return { title: '', line: '', chips: [], cta: null };
  if (item.kind === 'game' || item.kind === 'get'){
    const g = item.g, lo = Math.min(g.minPlayers || 1, cap), hi = Math.min(g.maxPlayers || 4, cap);
    const players = g.passive ? 'A story' : lo === hi ? `${hi} player${hi > 1 ? 's' : ''}` : `${lo} to ${hi} players`;
    const secs = g.secs, time = g.passive ? '' : g.endless || !secs ? 'No time limit' : secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs} sec`;
    return { title: g.name, line: blurb, chips: [players, time].filter(Boolean), cta: item.kind === 'get' ? { label: 'Get', icon: 'get' } : { label: 'Play', icon: 'play' } };
  }
  if (item.kind === 'more') return { title: 'More to try', line: 'Every game the family can get', chips: [], cta: { label: 'Open', icon: 'play' } };
  if (item.kind === 'make') return { title: item.name, line: item.line, chips: item.tag ? [item.tag] : [], cta: { label: item.id === 'requests' ? 'Open' : item.id === 'pro' ? 'Open' : 'Ask', icon: 'play' } };
  if (item.kind === 'test') return { title: item.d.name, line: 'On this TV to try', chips: [item.d.asking ? 'Asking to publish' : 'Testing'], cta: { label: 'Try it', icon: 'play' } };
  return { title: '', line: '', chips: [], cta: null };
}

/* Is the hero big (the page at rest) or a banner (scrolled)? Only the first row keeps it big. */
export const bigHero = (pos, rows) => pos === 'top' || !rows.length || pos.row === 0;
