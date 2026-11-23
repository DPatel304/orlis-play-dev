/* Discover's categories (decision 0055). The Discover page itself is home.js's discoverPage() (Home's own hero and rows); the owner's
   "Waiting for your OK" row and Try it are in submissions.js, and removing a downloaded game is in mygames.js (the profile sheet).
   What is left here is the sorting: which games go in which row, and "is this version newer". */

export const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

const FEATURED = 5;          /* games the featured list holds */
const FEW = 4;               /* fewer games than this: one row */
const added = (g) => Date.parse(g.added || '') || 0;

/* The rows, top to bottom: how Discover is sorted. A row with nothing in it isn't shown, and
   Discover only ever lists games that aren't on this PC yet.
   A game says what it is with its tags ("High energy", "Calm", "Music", "Dance", "Together") and the
   rest is read from how it plays (full body, how many players, the age it's for). */
const FORTNIGHT = 14 * 864e5;
const tagged = (g, ...names) => (g.tags || []).some(t => names.includes(String(t).toLowerCase()));
export const ROWS = [
  { name: 'New', sub: 'Added in the last two weeks', pick: (gs, now) => [...gs].filter(g => now - added(g) < FORTNIGHT).sort((a, b) => added(b) - added(a)).slice(0, 12) },
  { name: 'High energy', sub: 'Get your whole body moving', pick: (gs) => gs.filter(g => g.uses === 'body' || tagged(g, 'high energy', 'energetic')) },
  { name: 'Music & dance', sub: 'Move to the beat', pick: (gs) => gs.filter(g => tagged(g, 'music', 'dance')) },
  { name: 'Solo', sub: 'Just you', pick: (gs) => gs.filter(g => (g.players || [1, 4])[1] === 1) },
  { name: 'Together', sub: 'Best with a crowd', pick: (gs) => gs.filter(g => tagged(g, 'together')) },
  { name: 'Calm', sub: 'Slow and cozy', pick: (gs) => gs.filter(g => tagged(g, 'calm')) },
  { name: 'Little kids', sub: 'Ages 5 and under', pick: (gs) => gs.filter(g => g.ages && g.ages <= 5) },
  { name: 'From family & friends', sub: 'Made in Create', pick: (gs) => gs.filter(g => g.by && g.by !== 'Orlis Play') }
];
/* What the page shows for a list of games: the featured ones, and rows. */
export function layout(games, now = Date.now()){
  const featured = [...games].sort((a, b) => added(b) - added(a)).slice(0, FEATURED);
  if (games.length < FEW) return { featured, rows: [{ name: 'All games', pick: () => [...games].sort((a, b) => a.name.localeCompare(b.name)), list: [...games].sort((a, b) => a.name.localeCompare(b.name)) }] };
  return { featured, rows: ROWS.map(r => ({ ...r, list: r.pick(games, now) })).filter(r => r.list.length) };
}
