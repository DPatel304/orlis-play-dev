/* In-page driver for tools/playtest-shots.mjs: the same scripted bodies (rig.mjs), fed through the app's real tracker (pose._assign), playing
   the real game that is running in the browser. Loaded by the shots script with a dynamic import from the dev server; not used by anything else. */
import { makeWorld, Feeder, resetPose, BRAINS } from './rig.mjs';
import { pose, sizeOf, seated, CLOSE, WATCH_AFTER, headOf } from '../../src/tracking/pose.js';

const lib = { sizeOf, seated, CLOSE, WATCH_AFTER, headOf };
let world = null, feeder = null, ctx = null, brain = null, timer = null, gameId = null;

/* Make the people, take over the tracker, and (re)start the round with room for four. Returns when the game is being played. */
export async function start({ lineup, seed = 1, id }){
  gameId = id; brain = BRAINS[id];
  pose.update = () => {};                                         /* (no camera: the bodies below are the camera) */
  resetPose(pose);
  world = makeWorld(lineup, seed, {});
  feeder = new Feeder(pose, lib, { assist: true, cap: 4 });
  ctx = { inst: null, world, game: window.__game ? window.__game() : null };
  pose.on = true; pose.ready = true;
  const passive = !!(ctx.game && ctx.game.passive);
  clearInterval(timer);
  /* until the round starts the people just stand in view (the line-up screen, the 3-2-1) */
  timer = setInterval(() => { if (!ctx.inst && !passive){ world.step(1 / 30, null, null); feeder.step(world, 1 / 30); } }, 33);
  for (let i = 0; i < 40; i++){ world.step(1 / 30, null, null); feeder.step(world, 1 / 30); }
  const old = window.__round();
  /* (a story is passive: no camera, nobody to count: the round the address started is the one to look at) */
  if (!passive) window.__go.toGame(window.__game() || (await import('../../src/games/index.js')).byId(id));
  /* wait for a new round */
  await new Promise((res, rej) => {
    if (passive){ const w0 = setInterval(() => { if (window.__round() && window.__mode() === 'play'){ clearInterval(w0); res(); } }, 50); return; }
    const t0 = performance.now();
    const w = setInterval(() => {
      const inst = window.__round();
      if (inst && inst !== old && window.__mode() === 'play'){ clearInterval(w); res(); }
      else if (performance.now() - t0 > 30000){ clearInterval(w); rej(new Error('round never started, mode ' + window.__mode())); }
    }, 50);
  });
  const inst = window.__round();
  ctx.inst = inst; ctx.game = window.__game();
  const orig = inst.step.bind(inst);
  inst.step = (dt, W, H) => { dt = Math.min(dt, 1 / 20); if (!ctx.game.passive){ world.step(dt, brain, ctx); feeder.step(world, dt); } return orig(dt, W, H); };
  return { players: inst.players, mode: window.__mode() };
}

/* run the game forward by `secs` seconds without waiting for it (30 fps steps, the bodies playing) */
export function ff(secs, until = null){
  const inst = ctx.inst; let n = 0;
  for (let i = 0; i < Math.round(secs * 30); i++){
    inst.step(1 / 30, window.innerWidth, window.innerHeight); n++;
    if (inst.over || (until && until(inst))) break;
  }
  return { steps: n, t: inst.t, over: !!inst.over };
}
export const state = () => ({ t: ctx.inst && ctx.inst.t, score: ctx.inst && ctx.inst.score && ctx.inst.score.slice(0, 4), present: pose.players.map(p => p.present), mode: window.__mode() });

/* the middle of a round: a moment worth a picture (a freeze, a flap, a card), after a time that suits the game */
const MID = {
  'pop-party': [60, null], 'sky-painter': [50, (g) => !g.alive && g.covered > 0.4 && g.covered < 0.7], 'sleepy-bear': [70, (g) => g.phase === 'freeze' && g.inPhase > 1.5], 'leaf-pile': [100, null],
  'stack-it-high': [90, null], 'animal-gym': [70, (g) => g.move === 'flap' && g.segT > 4], 'keep-it-up': [90, null], 'ptero-flight': [45, null],
  'save-the-harvest': [20, (g) => g.phase === 'move' && g.pt > 1.2 && g.kind !== 'raven'], 'cubions-long-way-home': [90, (g) => !!g.card()]
};
export function toMid(){
  const [t, pred] = MID[gameId] || [60, null], inst = ctx.inst;
  ff(Math.max(0, t - inst.t));
  if (pred) ff(40, pred);
  return state();
}
/* nearly the end (or the end, for a game that ends itself) */
export function toEnd(){
  const inst = ctx.inst, game = ctx.game;
  if (game.endless) ff(420, (g) => g.over || g.phase === 'end' || g.win);
  else ff(Math.max(0, game.secs - 2 - inst.t));
  return state();
}
