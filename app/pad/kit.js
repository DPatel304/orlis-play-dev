/* What the page lends to a pad program. Programs are plain files served by the hub, so they cannot import packages; the page imports
   what they may need and hands it over as `api.kit` (docs/specs/pad-protocol.md, "The pad page's side").
     kit.loadThree()      three.js (the listed parts, three-lite.js), loaded on first call into its own chunk
     kit.color(name)      a palette colour by name ('meadow.fresh'), kit.color(name, 'shade' | 'light') for its tone
     kit.assets           the painted asset library: kit.assets.draw(ctx, 'tree', x, y, size)
     kit.garden           Peekaboo's world and rules constants: createWorld, KINDS, SPEED, DEAD_ZONE, LIGHT_RADIUS, FAR, LEN, SIZE
     kit.character(look)  the player's block-limb character painted into one atlas canvas (see characterAtlas) */
import { assets } from '../src/games/assets/index.js';
import { color } from '../src/games/assets/palette.js';
import { body } from '../src/ui/avatar-art.js';
import { normalizeLook } from '../src/ui/look.js';
import { createWorld, KINDS, SIZE } from '../src/games/peekaboo/world.js';
import { SPEED, DEAD_ZONE, LIGHT_RADIUS, FAR, LEN } from '../src/games/peekaboo/rules.js';

/* The atlas: every drawing a hider card needs, in a grid of equal cells (one texture, nothing painted per frame).
   frames: { back: { stand, march: [4], run: [4] }, front: { stand, march: [4], run: [4], cheer, wave: [2] } }, each a cell number;
   cell n is at column n % cols, row floor(n / cols). The feet are on the line `base` (0..1 down the cell), the character is `S` cells tall. */
export const ATLAS = { cols: 5, rows: 5, cell: 256, S: 196, base: 0.93 };

export function characterAtlas(lookIn) {
  const { cols, rows, cell, S, base } = ATLAS, look = normalizeLook(lookIn);
  const cv = document.createElement('canvas'); cv.width = cols * cell; cv.height = rows * cell;
  const c = cv.getContext('2d');
  let n = 0;
  const put = (pose, t, back) => {
    const i = n++, cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * cell + cell * base;
    try { body(c, cx, cy, S, look, t, pose, { back, still: true }); } catch { /* a blank cell, never a crash on a child's tablet */ }
    return i;
  };
  const four = (pose, back) => [0, 1, 2, 3].map(k => put(pose, (k + 0.1) / 5, back));      /* the story's moves run at 5 drawings a second */
  const frames = {
    back: { stand: put('stand', 0, true), march: four('march', true), run: four('run', true) },
    front: { stand: put('stand', 0, false), march: four('march', false), run: four('run', false), cheer: put('cheer', 0, false), wave: [put('wave', 0, false), put('wave', 0.16, false)] }
  };
  return { canvas: cv, frames, ...ATLAS };
}

export const kit = {
  loadThree: () => import('./three-lite.js'),
  color: (name, tone) => color(name, tone),
  assets,
  garden: { createWorld, KINDS, SIZE, SPEED, DEAD_ZONE, LIGHT_RADIUS, FAR, LEN },
  character: characterAtlas
};
