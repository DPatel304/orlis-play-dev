/* Each game's picture for its tile (and its banner, if it has no trailer):
   a still of the game itself, made once and kept - in memory, and between
   launches (by game and version, so a new version gets a new picture). */
import { still } from './trailer.js';

const KEY = 'orlis.shots', MAX = 24;
const V = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
const keyOf = (g) => `${g.id}@${(g.store && g.store.version) || V}`;
let saved = null;
const load = () => { if (saved) return saved; try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { saved = {}; } return saved; };
const keep = () => { try { const ks = Object.keys(saved); while (ks.length > MAX) delete saved[ks.shift()]; localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
const images = new Map();

/* the picture's address (a data: URL), if there is one yet */
export function shotOf(g){ return load()[keyOf(g)] || null; }
/* the picture as an image, for painting a banner */
export function shotImage(g){
  const url = shotOf(g); if (!url) return null;
  if (!images.has(url)){ const im = new Image(); im.src = url; images.set(url, im); }
  const im = images.get(url);
  return im.complete && im.naturalWidth ? im : null;
}
/* keep a picture (a canvas, any size: cut to 16:10 from the middle) */
export function keepShot(g, canvas){
  try {
    let src = canvas;
    const w = canvas.width, h = canvas.height, want = 1.6;
    if (Math.abs(w / h - want) > 0.02){
      const cw = Math.min(w, h * want), ch = cw / want;
      src = document.createElement('canvas'); src.width = 1152; src.height = 720;
      src.getContext('2d').drawImage(canvas, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, 1152, 720);
    }
    load()[keyOf(g)] = src.toDataURL('image/jpeg', 0.72);
    keep();
    return true;
  } catch { return false; }
}
/* Make the missing ones, one at a time, between frames; onShot(game) as
   each is ready. Gives back a stop(). */
export function makeShots(games, onShot){
  const todo = games.filter(g => !g.sandboxed && !g.discover && !shotOf(g));
  let stopped = false;
  const next = () => {
    if (stopped || !todo.length) return;
    const g = todo.shift();
    const c = still(g);
    if (c && keepShot(g, c)) onShot(g);
    setTimeout(next, 120);
  };
  setTimeout(next, 600);
  return () => { stopped = true; };
}
