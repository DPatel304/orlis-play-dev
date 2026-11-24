/* The live game beside the builder's choices (decision 0057): the real built description (create/recipe.js build) running on the real
   Orlis.play engine and library drawing, on a scripted hand that stands in for the camera - so things get caught and popped by themselves
   and every pick shows at once. No camera, no sound.

     const p = makePreview(canvas);  p.set(picks);  p.tick(dt)  (each frame: steps the game and draws it)  p.dispose()
   headless(picks, secs): the same round run with no canvas, for the tests (what the hand did, and the round). */
import { makePlay } from '../games/play/engine.js';
import { assets } from '../games/assets/index.js';
import { sayBubble, goalBar } from '../games/hud.js';
import { cardTucker, figureCard } from '../games/figure.js';
import { build, clean } from './recipe.js';

export const SIZE = { w: 960, h: 540 };
const SILENT = new Proxy({}, { get: () => () => {} });
const hand = () => ({ x: 0.5, y: 0.6, vx: 0, vy: 0, speed: 0 });

/* the scripted player: it chases the thing it should catch, pop or bat (and just waves about for Dodge, where touching costs); a gentle sweep
   when nothing is there yet */
export function makeHand(how){
  const h = hand();
  let t = 0;
  return {
    h,
    step(dt, things){
      t += dt;
      const aim = (things || []).filter(x => !x.dead && x.d && x.d.name !== 'bomb' && x.y > 0.12 && x.y < (how === 'catch' ? 0.95 : 0.88));
      let tx = 0.5 + 0.34 * Math.sin(t * 0.9), ty = (how === 'catch' ? 0.66 : 0.5) + 0.12 * Math.sin(t * 1.6);
      if (how !== 'dodge' && aim.length){
        /* the nearest one it can still reach (the lowest, for a falling thing) */
        const best = aim.reduce((a, b) => (how === 'catch' ? b.y > a.y : Math.hypot(b.x - h.x, b.y - h.y) < Math.hypot(a.x - h.x, a.y - h.y)) ? b : a);
        tx = best.x; ty = how === 'keepup' ? Math.min(0.88, best.y + 0.06) : best.y;
      }
      const k = Math.min(1, dt * (how === 'keepup' ? 5 : 2.6)), nx = h.x + (tx - h.x) * k, ny = h.y + (ty - h.y) * k;
      h.vx = (nx - h.x) / (dt || 1); h.vy = (ny - h.y) / (dt || 1); h.speed = Math.hypot(h.vx, h.vy); h.x = nx; h.y = ny;
    }
  };
}

function round(picks, { ui = { say: sayBubble, goal: goalBar }, a = assets } = {}){
  const p = clean(picks), hd = makeHand(p.how);
  const pose = { players: [{ present: true, hands: { left: null, right: hd.h } }], mouse: { active: true } };
  const play = makePlay(build(p), { pose, sfx: SILENT, assets: a, ui, colors: ['#3da9ff'], max: 4 }).create(1);
  return { play, hand: hd, picks: p };
}

export function makePreview(canvas){
  const c = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  const tucker = cardTucker();
  let r = null, lastKey = '', age = 0;
  const WARM = 2.2;                                 /* seconds the game has already run when a pick shows it, so it is never an empty screen */
  const start = (picks) => {
    r = round(picks); tucker.reset && tucker.reset();
    const dt = 1 / 30;
    for (let t = 0; t < WARM; t += dt){ r.hand.step(dt, r.play.things); r.play.step(dt, SIZE.w, SIZE.h); }
  };
  return {
    get picks(){ return r && r.picks; },
    get round(){ return r && r.play; },
    set(picks){
      const key = JSON.stringify(build(clean(picks)));
      if (key === lastKey) return false;
      lastKey = key; start(picks); return true;
    },
    tick(dt){
      if (!r) return;
      dt = Math.min(0.05, dt || 0.016); age += dt;
      r.hand.step(dt, r.play.things); r.play.step(dt, SIZE.w, SIZE.h);
      /* (a round that ends - the preview never does - starts again) */
      if (r.play.over){ const p = r.picks; start(p); }
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SIZE.w, SIZE.h);
      r.play.draw(c, SIZE.w, SIZE.h);
      const want = r.play.card(), k = tucker.step(want, dt);
      if (k) figureCard(c, SIZE.w, SIZE.h, k.pose, k.age, { age: k.age, left: k.left });
    },
    dispose(){ r = null; }
  };
}

/* No canvas, a recording of what the scripted hand did in `secs` of the round (for the tests). */
export function headless(picks, secs = 20){
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const none = { scene(){}, draw(){}, text(){} };
  const p = clean(picks), hd = makeHand(p.how), pose = { players: [{ present: true, hands: { left: null, right: hd.h } }], mouse: { active: true } };
  const play = makePlay(build(p), { pose, sfx, assets: none, ui: { say(){}, goal(){} }, colors: ['#3da9ff'], max: 4 }).create(1);
  const dt = 1 / 30;
  for (let t = 0; t < secs; t += dt){ hd.step(dt, play.things); play.step(dt, SIZE.w, SIZE.h); }
  return { round: play, score: play.total, sounds, hand: hd.h };
}
