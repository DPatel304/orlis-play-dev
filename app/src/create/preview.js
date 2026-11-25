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

/* the scripted player: it chases what it should catch, stack or bat up (the lowest first, a falling ball before it drops) and just waves about
   when nothing is there yet. It does not chase a Dodge thing or a bomb, and it waves from the roomiest spot when Dodge things are about (a hand that never
   did would be hit by nearly every one, and a round of only Dodge things would score nothing), so now and then one still touches it. */
const CHASE = /^(collect|stack|keepup|golden)/, AVOID = /^dodge/;
export function makeHand(){
  const h = hand();
  let t = 0, bx = 0.5, by = 0.6;
  return {
    h,
    step(dt, things){
      t += dt;
      const aim = (things || []).filter(x => !x.dead && x.d && CHASE.test(x.d.name || '') && x.y > 0.12 && x.y < 0.95);
      let tx = 0.5 + 0.34 * Math.sin(t * 0.9), ty = 0.6 + 0.1 * Math.sin(t * 1.6), kind = '';
      if (aim.length){
        /* the lowest one (the one about to be lost) */
        const best = aim.reduce((a, b) => b.y > a.y ? b : a);
        kind = (best.d.name || '').startsWith('keepup') ? 'keepup' : '';
        tx = best.x; ty = kind ? Math.min(0.88, best.y + 0.06) : best.y;
      }
      if (!aim.length){
        /* with Dodge things about, wave from the roomiest spot near the usual wave (the one furthest from them all) */
        const bad = (things || []).filter(x => !x.dead && x.d && AVOID.test(x.d.name || '') && x.y > -0.1 && x.y < 1.1);
        if (bad.length){
          let best = -1e9;
          for (let gx = 0.08; gx <= 0.92; gx += 0.06) for (let gy = 0.3; gy <= 0.85; gy += 0.06){
            const room = Math.min(...bad.map(x => Math.hypot(gx - x.x, (gy - x.y) * 1.2))) - 0.25 * Math.hypot(gx - tx, gy - ty);
            if (room > best){ best = room; bx = gx; by = gy; }
          }
          tx = bx; ty = by;
        }
      }
      const k = Math.min(1, dt * (kind ? 5 : 3)), nx = h.x + (tx - h.x) * k, ny = h.y + (ty - h.y) * k;
      h.vx = (nx - h.x) / (dt || 1); h.vy = (ny - h.y) / (dt || 1); h.speed = Math.hypot(h.vx, h.vy); h.x = nx; h.y = ny;
    }
  };
}

function round(picks, { ui = { say: sayBubble, goal: goalBar }, a = assets } = {}){
  const p = clean(picks), hd = makeHand();
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

/* a small seeded random (mulberry32), so a headless round plays out the same every time */
export function seeded(seed = 1){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* No canvas, a recording of what the scripted hand did in `secs` of the round (for the tests). Seeded, so the round is the same every run. */
export function headless(picks, secs = 20, seed = 1){
  const sounds = [], sfx = new Proxy({}, { get: (_, k) => () => sounds.push(k) });
  const none = { scene(){}, draw(){}, text(){} };
  const p = clean(picks), hd = makeHand(), pose = { players: [{ present: true, hands: { left: null, right: hd.h } }], mouse: { active: true } };
  const play = makePlay(build(p), { pose, sfx, assets: none, ui: { say(){}, goal(){} }, colors: ['#3da9ff'], max: 4, random: seeded(seed) }).create(1);
  const dt = 1 / 30;
  for (let t = 0; t < secs; t += dt){ hd.step(dt, play.things); play.step(dt, SIZE.w, SIZE.h); }
  return { round: play, score: play.total, sounds, hand: hd.h };
}
