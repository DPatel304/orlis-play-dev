/* A game made in Create, as a game the shell can play (decision 0056): the saved description runs on the real Orlis.play engine with the real
   camera, drawing and sounds, and the shell wraps it like any game (move card, clock, scores, results). It is data only: no code of anyone's.

     madeGame(creation)    -> a game module { id: 'made:<id>', name, secs, create(n), made: { id, makerId }, ... }
     isMade(game)          is it one of these
     madeCover(creation)   -> a picture for its tile (a data: URL), drawn from its world and its piece; null where nothing can be drawn
     madeWorld(creation)   -> the wide picture behind Play's hero
   The Create screens' live preview uses the same engine (create/preview.js). */
import { makePlay } from '../games/play/engine.js';
import { assets } from '../games/assets/index.js';
import { sayBubble, goalBar } from '../games/hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { color } from '../games/assets/palette.js';
import { build, clean, sentence } from './recipe.js';

export const isMade = (g) => !!(g && g.made);
export const madeId = (g) => (g && g.made ? g.made.id : null);

/* each world's colour for the tile, the loading cover and the badge */
const ACCENT = { meadow: ['meadow.fresh', 'sky.high'], night: ['fav.purple', 'night.sky'], beach: ['sea.far', 'earth.path'], snow: ['sky.high', 'earth.snow'], sunset: ['dusk.rose', 'dusk.deep'], autumn: ['autumn.amber', 'autumn.straw'] };
const accentOf = (scene) => (ACCENT[scene] || ACCENT.meadow).map(n => color(n));

export function madeGame(c){
  const picks = clean(c.picks || {}), spec = c.desc && typeof c.desc === 'object' && Array.isArray(c.desc.things) ? c.desc : build(picks);
  const [a, b] = accentOf(spec.scene);
  const env = { pose, sfx, assets, ui: { say: (cv, ...args) => sayBubble(cv, ...args), goal: (cv, ...args) => goalBar(cv, ...args) }, colors: PLAYER_COLORS, max: MAX_PLAYERS };
  const play = makePlay(spec, env);
  return {
    id: 'made:' + c.id, name: c.name || spec.title || 'My game', unit: 'points', accent: a, secs: play.secs, endless: play.endless,
    moves: spec.card ? [spec.card] : ['reach'], minPlayers: 1, maxPlayers: MAX_PLAYERS,
    store: { icon: { cols: [a, b] }, blurb: sentence(picks), version: c.updatedAt || '1' },
    made: { id: c.id, makerId: c.makerId || null, creation: c },
    create(n){
      const round = play.create(n);
      /* what the shell asks every game for, at the end of a round */
      round.tally = () => {
        const rows = [];
        for (let i = 0; i < n; i++){ if (!round.score[i] && !(pose.players[i] && pose.players[i].present)) continue; rows.push({ label: `Player ${i + 1}`, value: round.score[i], color: PLAYER_COLORS[i] }); }
        return rows;
      };
      round.winner = () => {
        const there = round.score.slice(0, n).map((_s, i) => i).filter(i => round.score[i] > 0 || (pose.players[i] && pose.players[i].present));
        if (there.length < 2) return null;
        const top = Math.max(...there.map(i => round.score[i])), best = there.filter(i => round.score[i] === top);
        return best.length > 1 ? -1 : best[0];
      };
      return round;
    }
  };
}

/* ---------- pictures ---------- */
const covers = new Map();
const canvasFor = (w, h) => {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext && cv.getContext('2d');
  return c ? { cv, c } : null;
};
const keyOf = (c, kind) => `${kind}:${c.id}@${c.updatedAt || ''}:${(c.picks && c.picks.where) || ''}:${(c.picks && c.picks.what) || ''}`;

/* the world, with the game's piece scattered in it (and a golden one, and a bomb, if it has them) */
function paint(c, picks, W, H){
  const p = clean(picks || {});
  assets.scene(c, W, H, p.where, { t: 1.2, p: 0.35 });
  const spots = p.how === 'keepup' ? [[0.5, 0.45, 0.4]] : p.how === 'catch' ? [[0.2, 0.3, 0.22], [0.46, 0.5, 0.26], [0.74, 0.28, 0.22], [0.62, 0.72, 0.2], [0.3, 0.7, 0.18]]
    : [[0.22, 0.42, 0.24], [0.5, 0.28, 0.26], [0.78, 0.46, 0.24], [0.36, 0.72, 0.2], [0.68, 0.74, 0.2]];
  spots.forEach(([x, y, s], i) => assets.draw(c, p.what, x * W, y * H, s * H, { rotate: (i - 2) * 0.18, shadow: p.how === 'catch' && i === 3 }));
  if (p.how !== 'keepup'){
    if (p.golden) assets.draw(c, p.what, 0.86 * W, 0.2 * H, 0.2 * H, { color: color('ui.gold'), rotate: 0.2 });
    if (p.bomb) assets.draw(c, 'rock', 0.1 * W, 0.78 * H, 0.17 * H, {});
  }
}
/* the tile's picture; with `title`, the game's name painted on it the way the built-in covers carry theirs (Play's tiles), else bare (Create's slots show the name themselves) */
export function madeCover(creation, w = 960, h = 600, { title = false } = {}){
  const key = keyOf(creation, 'cover' + w + (title ? 't' : '')) + (title ? creation.name : '');
  if (covers.has(key)) return covers.get(key);
  let url = null;
  try {
    const t = canvasFor(w, h);
    if (t){
      paint(t.c, creation.picks, w, h);
      if (title && creation.name){
        const name = String(creation.name).slice(0, 24), size = Math.min(h * 0.15, (w * 0.9) / (name.length * 0.56));
        assets.text(t.c, name, w * 0.05, h * 0.88, size, { align: 'left', color: color('earth.snow'), outline: color('shade.ink') });
      }
      url = t.cv.toDataURL('image/jpeg', 0.82);
    }
  } catch { url = null; }
  covers.set(key, url);
  return url;
}
export const madeWorld = (creation) => madeCover(creation, 1280, 720);
