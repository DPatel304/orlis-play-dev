/* The Orlis runtime for a creator's game: everything a game made with
   Create uses, under one name - Orlis - with nothing to build or install.
   Orlis Play packs it in front of the creator's game.js (ui/creator-kit.js),
   with the game's orlis.json as Orlis.manifest; the game ends with
   Orlis.run({ ... }).

     Orlis.pose      the players, from the camera: body points only
     Orlis.sfx       Orlis Play's sounds: Orlis.sfx.pop(), Orlis.sfx.gold()...
     Orlis.music     its music: Orlis.music.intensity(0.8)...
     Orlis.assets    the picture library - the only way a game draws: Orlis.assets.draw(c, 'giraffe', x, y, size), .scene(c, W, H, 'meadow'), .text(c, 'Go!', x, y, size)
     Orlis.ui        the shared screen: Orlis.ui.say, goal, badge, zones, under (see the skill)
     Orlis.L, Orlis.BONES, Orlis.MAX_PLAYERS, Orlis.PLAYER_COLORS
     Orlis.run(game) start it (in the sandbox, as every downloaded game is)

   It also checks the words the game shows (below). */
import { run } from '../runtime/main.js';
import { pose, L, BONES, MAX_PLAYERS, PLAYER_COLORS } from '../runtime/pose.js';
import { sfx, music, ambience } from '../runtime/sound.js';
import { clean } from './words.js';
import { sayBubble, goalBar, badge, hudZones, underHud, hud } from '../../src/games/hud.js';
import { assets, lock, unwrap } from '../../src/games/assets/index.js';

/* Before the game's own code runs: every line of text it draws on screen
   goes through the words check first (a word that isn't for children comes
   out as stars), and the game can't put the plain drawing back. (The other
   ways to show words - pictures, web-page parts, other letters, hidden
   text - are turned away by the checks before a game is sent.) */
for (const C of [globalThis.CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D]){
  if (!C) continue;
  for (const k of ['fillText', 'strokeText']){
    const real = C.prototype[k];
    if (typeof real !== 'function') continue;
    Object.defineProperty(C.prototype, k, { value: function(text, ...rest){ return real.call(this, clean(text), ...rest); }, writable: false, configurable: false, enumerable: false });
  }
}

/* The words a game says on the shared screen: the first ones of a round are said aloud once, by Orlis Play (through the words
   check first). */
hud.speak = (text) => { try { parent.postMessage({ t: 'say', text: String(clean(text)).slice(0, 80) }, '*'); } catch {} };

const Orlis = {
  manifest: {},
  pose, sfx, music, ambience, L, BONES, MAX_PLAYERS, PLAYER_COLORS,
  /* The picture library: a game asks for a piece by name and the library draws it, the same in every game (see the skill). */
  assets,
  /* The shared screen, the same in every Orlis game (UI-STANDARD): hint words, a goal bar with three stars, one badge, and
     where the shell's pieces are, so nothing the players have to touch goes under them. */
  ui: { say: (c, ...a) => sayBubble(unwrap(c), ...a), goal: (c, ...a) => goalBar(unwrap(c), ...a), badge: (c, ...a) => badge(unwrap(c), ...a), zones: hudZones, under: underHud },
  run(game){
    const m = Orlis.manifest || {};
    /* (its id and name are the ones in orlis.json, whatever the code says) */
    /* (a game's round draws on a locked handle, never the real canvas: it can only place what the asset library draws) */
    const create = game.create;
    run({ ...game, create(n){ const round = create.call(game, n), draw = round && round.draw; if (typeof draw === 'function') round.draw = (c, W, H) => draw.call(round, lock(c), W, H); return round; },
      id: m.id, name: m.name || game.name, accent: game.accent || (m.icon && m.icon.cols && m.icon.cols[0]) });
  }
};
globalThis.Orlis = Orlis;
