/* Each game's cover for its tile - its own art (covers.js) or, for a game
   without any, a picture of it playing - with its title on; and the art
   alone, for its banner when it has no trailer. Made once and kept (in
   memory, and between launches; by game and version, so a new version gets
   a new cover). */
import { still } from './trailer.js';
import { makeCover, hasArt } from './covers.js';

const KEY = 'orlis.covers', MAX = 24;
const V = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
const keyOf = (g) => `${g.id}@${(g.store && g.store.version) || V}`;
let saved = null;
const load = () => { if (saved) return saved; try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { saved = {}; } return saved; };
const keep = () => { try { const ks = Object.keys(saved); while (ks.length > MAX) delete saved[ks.shift()]; localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
const images = new Map();

/* the cover (title on), as a data: URL, if there is one yet */
export function shotOf(g){ const s = load()[keyOf(g)]; return (s && s.cover) || null; }
/* the art alone, as an image, for painting a banner */
export function shotImage(g){
  const s = load()[keyOf(g)], url = s && s.art; if (!url) return null;
  if (!images.has(url)){ const im = new Image(); im.src = url; images.set(url, im); }
  const im = images.get(url);
  return im.complete && im.naturalWidth ? im : null;
}
function put(g, made, withArt){
  try {
    load()[keyOf(g)] = { cover: made.cover.toDataURL('image/jpeg', 0.8), art: withArt ? made.art.toDataURL('image/jpeg', 0.75) : null };
    keep();
    return true;
  } catch { return false; }
}
/* a cover from a picture of the game playing (a downloaded game's banner) */
export function keepShot(g, canvas){
  const made = makeCover(g, { still: canvas, accent: g.accent });
  return !!made && put(g, made, false);
}
/* A Discover entry's cover, for its tile: one already made (it's been here
   before, or played), else made now if there's art for it. null: no cover
   yet (a community game not on this PC: its tile keeps its icon art). */
export function coverFor(entry){
  const g = { id: entry.id, name: entry.name, accent: entry.icon && entry.icon.cols && entry.icon.cols[0], store: { version: entry.version } };
  const had = shotOf(g);
  if (had) return had;
  if (!hasArt(g.id)) return null;
  const made = makeCover(g);
  return made && put(g, made, true) ? shotOf(g) : null;
}
/* Make the missing ones, one at a time, between frames; onShot(game) as
   each is ready. Gives back a stop(). */
export function makeShots(games, onShot){
  const todo = games.filter(g => !g.sandboxed && !g.discover && !shotOf(g));
  let stopped = false;
  const next = () => {
    if (stopped || !todo.length) return;
    const g = todo.shift();
    const made = hasArt(g.id) ? makeCover(g) : (() => { const s = still(g); return s && makeCover(g, { still: s, accent: g.accent }); })();
    if (made && put(g, made, true)) onShot(g);
    setTimeout(next, 120);
  };
  setTimeout(next, 400);
  return () => { stopped = true; };
}
