/* A game made in Create, as a game the shell can play (decision 0056): the saved description runs on the real Orlis.play engine with the real
   camera, drawing and sounds, and the shell wraps it like any game (move card, clock, scores, results). It is data only: no code of anyone's.

     madeGame(creation)    -> a game module { id: 'made:<id>', name, secs, create(n), made: { id, makerId }, ... }
     isMade(game)          is it one of these
     madeCover(creation)   -> a picture for its tile (a data: URL), drawn from its world and its piece; null where nothing can be drawn
     madeWorld(creation)   -> the wide picture behind Play's hero
   The Create screens' live preview uses the same engine (create/preview.js). */
import { makePlay } from '../games/play/engine.js';
import { assets } from '../games/assets/index.js';
import { sayBubble, goalBar, hudZones } from '../games/hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { color } from '../games/assets/palette.js';
import { build, clean, sentence, pieceInfo, bombOn, NAME_MAX } from './recipe.js';

/* What the game was, for the results card (the same fields the built-in games use: unit, prop, done). One thing with one job says it plainly
   ("apples caught", "bounces"); things sharing a job say "things caught"; a mix is counted in points, with the main (first) thing as the icon,
   and the round adds a short line of what was done ("12 caught, 3 stacked": see summaryOf). */
const DONE = { collect: 'caught', dodge: 'dodged', stack: 'stacked' };
export function resultsOf(picks){
  const p = clean(picks || {}), first = pieceInfo(p.things[0].id), jobs = [...new Set(p.things.map(t => t.job))];
  if (jobs.length > 1) return { unit: 'points', prop: [first.id], done: ['points', ''], mix: true };
  const j = jobs[0], one = p.things.length === 1;
  if (j === 'keepup') return { unit: 'bounces', prop: [first.id], done: ['bounces', ''] };
  if (j === 'stack') return { unit: one ? first.plural : 'blocks', prop: [first.id], done: [one ? first.plural : 'blocks', DONE.stack] };
  return { unit: one ? first.plural : 'things', prop: [first.id], done: [one ? first.plural : 'things', DONE[j]] };
}
/* the short line for a mix: what each job did (the biggest three, in the order Collect, Dodge, Keep up, Stack: "12 caught, 3 stacked"); null for
   one job, or nothing done. counts: how many times each named thing scored (the engine's round.counts: names are "<job>-<piece>", and
   "golden" is a Collect). */
const LINE = [['collect', (n) => `${n} caught`], ['dodge', (n) => `${n} dodged`], ['keepup', (n) => `${n} ${n === 1 ? 'bounce' : 'bounces'}`], ['stack', (n) => `${n} stacked`]];
export function summaryOf(picks, counts){
  if (!resultsOf(picks).mix) return null;
  const by = {};
  for (const [name, n] of Object.entries(counts || {})){ const j = name === 'golden' ? 'collect' : name.split('-')[0]; if (LINE.some(l => l[0] === j)) by[j] = (by[j] || 0) + n; }
  const top = LINE.filter(([j]) => by[j] > 0).sort((a, b) => by[b[0]] - by[a[0]]).slice(0, 3).map(l => l[0]);
  return LINE.filter(([j]) => top.includes(j)).map(([j, say]) => say(by[j])).join(', ') || null;
}

/* the line under a Dodge game's bars: how many times a bar emptied between everyone (nobody is ever out, so it is always kind) */
export const healthLine = (emptied) => emptied > 0 ? 'Everybody kept going!' : 'Nobody got dizzy!';

export const isMade = (g) => !!(g && g.made);

/* each world's colour for the tile, the loading cover and the badge */
const ACCENT = { meadow: ['meadow.fresh', 'sky.high'], night: ['fav.purple', 'night.sky'], beach: ['sea.far', 'earth.path'], snow: ['sky.high', 'earth.snow'], sunset: ['dusk.rose', 'dusk.deep'], autumn: ['autumn.amber', 'autumn.straw'] };
const accentOf = (scene) => (ACCENT[scene] || ACCENT.meadow).map(n => color(n));

export function madeGame(c){
  const picks = clean(c.picks || {}), spec = c.desc && typeof c.desc === 'object' && Array.isArray(c.desc.things) ? c.desc : build(picks);
  const [a, b] = accentOf(spec.scene), results = resultsOf(picks);
  const env = { pose, sfx, assets, ui: { say: (cv, ...args) => sayBubble(cv, ...args), goal: (cv, ...args) => goalBar(cv, ...args), zones: hudZones }, colors: PLAYER_COLORS, max: MAX_PLAYERS };
  const play = makePlay(spec, env);
  return {
    id: 'made:' + c.id, name: c.name || spec.title || 'My game', unit: results.unit, prop: results.prop, done: results.done, accent: a, secs: play.secs, endless: play.endless,
    moves: spec.card ? [spec.card] : ['reach'], minPlayers: 1, maxPlayers: MAX_PLAYERS,
    store: { icon: { cols: [a, b] }, blurb: sentence(picks), version: c.updatedAt || '1' },
    made: { id: c.id, makerId: c.makerId || null, creation: c },
    create(n){
      const round = play.create(n);
      /* what the shell asks every game for, at the end of a round */
      round.tally = () => {
        const rows = [];
        for (let i = 0; i < n; i++){
          const here = pose.players[i] && pose.players[i].present;
          /* a Dodge game has no score: each player's bar as it ended and how many times it emptied (not a number) */
          if (round.health){ if (!here && !round.seen[i]) continue; rows.push({ label: `Player ${i + 1}`, value: 0, color: PLAYER_COLORS[i], health: { fill: round.hp[i], lost: round.lost[i], dizzy: round.dizzy[i] > 0 } }); continue; }
          if (!round.score[i] && !here) continue;
          rows.push({ label: `Player ${i + 1}`, value: round.score[i], color: PLAYER_COLORS[i] });
        }
        return rows;
      };
      /* a mix says what was done, in a line under the count; a Dodge game says how it went in a few words (nobody is ever out) */
      round.summary = () => round.health ? healthLine(round.lost.slice(0, n).reduce((a, v) => a + v, 0)) : summaryOf(picks, round.counts);
      round.winner = () => {
        if (round.health) return null;
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
const keyOf = (c, kind) => `${kind}:${c.id}@${c.updatedAt || ''}:${(c.picks && c.picks.where) || ''}:${JSON.stringify(clean(c.picks || {}).things)}`;

/* the world, with the game's things scattered in it (a little tower for a Stack, a ball up high, a golden one, a rock for a bomb) */
const SPOTS = [[0.2, 0.3, 0.22], [0.46, 0.5, 0.26], [0.74, 0.28, 0.22], [0.58, 0.74, 0.2], [0.3, 0.7, 0.18]];
function paint(c, picks, W, H){
  const p = clean(picks || {}), n = p.things.length;
  assets.scene(c, W, H, p.where, { t: 1.2, p: 0.35 });
  const stackers = p.things.filter(t => t.job === 'stack'), others = p.things.filter(t => t.job !== 'stack');
  stackers.slice(0, 1).forEach((t) => { for (let i = 0; i < 3; i++) assets.draw(c, t.id, 0.84 * W, (0.84 - i * 0.14) * H, 0.15 * H, { rotate: (i - 1) * 0.08, shadow: true }); });
  const from = others.length ? others : p.things;
  SPOTS.forEach(([x, y, s], i) => {
    const t = from[i % from.length];
    assets.draw(c, t.id, x * W, (t.job === 'keepup' ? Math.min(y, 0.42) : y) * H, s * H * (n > 3 ? 0.85 : 1), { rotate: (i - 2) * 0.18, shadow: t.job === 'keepup' });
  });
  const gold = p.things.find(t => t.job === 'collect');
  if (p.golden && gold) assets.draw(c, gold.id, 0.9 * W, 0.2 * H, 0.2 * H, { color: color('ui.gold'), rotate: 0.2 });
  if (p.bomb && bombOn(p)) assets.draw(c, 'rock', 0.1 * W, 0.78 * H, 0.17 * H, {});
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
        /* a long name goes on two lines, split at the space nearest the middle */
        const name = String(creation.name).slice(0, NAME_MAX), mid = Math.floor(name.length / 2);
        const cut = name.length > 16 ? [...name.matchAll(/ /g)].map(m => m.index).sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0] : undefined;
        const lines = cut === undefined ? [name] : [name.slice(0, cut), name.slice(cut + 1)];
        const size = Math.min(h * 0.15, (w * 0.9) / (Math.max(...lines.map(l => l.length)) * 0.56));
        lines.forEach((l, i) => assets.text(t.c, l, w * 0.05, h * (0.88 - (lines.length - 1 - i) * 0.17), size, { align: 'left', color: color('earth.snow'), outline: color('shade.ink') }));
      }
      url = t.cv.toDataURL('image/jpeg', 0.82);
    }
  } catch { url = null; }
  covers.set(key, url);
  return url;
}
export const madeWorld = (creation) => madeCover(creation, 1280, 720);
