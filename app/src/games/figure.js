/* The move card: one little picture of a move, for the ones who can't read. Every game that shows one uses this, so it
   always looks the same and sits in the same place. It is Cubo, the Orlis cube, the block-limb character of avatar-art.js (a square head
   looking straight at you, a body with block arms and legs, the ink outline), on a paper card with the kit's strongest ink border.
   The card floats (a soft shadow under it) and slides in from the right, where it sits in the top-right corner, when a move starts, and out again when it ends.
   Cubo moves like stop-motion: each move is three or four still drawings that repeat, and his face is part of each
   drawing, so he looks excited when his hands go up and strains a little in the squat. */
import { slot } from './grid.js';
import { cuboFigure, poseBounds } from '../ui/avatar-art.js';
import { color as pal, alpha as palAlpha } from './assets/palette.js';
const L = (a, b, k) => a + (b - a) * k;

/* the look, in one place. (Where the card goes, and how big it is, is the grid's: the card's block in grid.js. head: how big his
   head is, as a share of what it was first drawn at.) */
export const CARD = { fill: pal('shade.card'), edge: pal('shade.ink'), edgeW: 0.036, body: pal('touch.skyBlue'), line: pal('shade.ink'), ink: pal('shade.ink'),
  arrow: pal('touch.tangerine'), head: pal('touch.skyBlue'), top: pal('touch.skyBlue', 'light'), left: pal('touch.skyBlue', 'shade'), headSize: 0.75,
  pink: pal('earth.brick'), ice: pal('sea.sunlit'), white: pal('earth.snow') };
/* how it moves: drawings a second, and how long the card takes to slide in and out (quick enough to start the move in time) */
export const MOTION = { fps: 5, slideIn: 0.45, slideOut: 0.3 };

/* every move is exactly four drawings (the same beat everywhere: 0.8 s a loop). */
export const DRAWINGS = 4;

/* each pose: p (0..1) is how far into the move this drawing is -> { yOff, lean, arms: [[points after the shoulder]...], legs: [[knee, foot]...] } */
export const POSES = {
  reach:  (p) => ({ arms: [[[L(-0.3, -0.85, p), L(0.15, -1.25, p)]], [[L(0.3, 0.85, p), L(0.15, -1.25, p)]]] }),
  flap:   (p) => ({ arms: [[[-0.9, L(0.05, -0.85, p)]], [[0.9, L(0.05, -0.85, p)]]] }),
  /* both arms lifting something big: out at the sides and low, then up and in under it (the elbows stay out) */
  lift:   (p) => ({ yOff: -p * 0.04, arms: [[[L(-0.85, -0.7, p), L(0.1, -0.45, p)], [L(-0.95, -0.3, p), L(0.35, -1.05, p)]], [[L(0.85, 0.7, p), L(0.1, -0.45, p)], [L(0.95, 0.3, p), L(0.35, -1.05, p)]]] }),
  wave:   (p) => ({ arms: [[[-0.3, 0.2]], [[0.5, -0.5], [L(0.25, 0.8, p), -1.0]]] }),
  clap:   (p) => ({ arms: [[[-0.5, -0.2], [L(-0.6, -0.05, p), -0.38]], [[0.5, -0.2], [L(0.6, 0.05, p), -0.38]]] }),
  hug:    (p) => ({ arms: [[[-0.55, -0.3], [L(0.2, 0.3, p), -0.5]], [[0.55, -0.3], [L(-0.2, -0.3, p), -0.42]]] }),
  jump:   (p) => { const y = -p * 0.45; return { yOff: y, arms: [[[-0.55, L(0, -0.6, p)]], [[0.55, L(0, -0.6, p)]]],
    legs: [[[-0.1, 0.35 + y * 0.4], [-0.15, 0.7 + y]], [[0.1, 0.35 + y * 0.4], [0.15, 0.7 + y]]] }; },
  squat:  (p) => { const y = p * 0.4; return { yOff: y, arms: [[[-0.6, -0.2 + y]], [[0.6, -0.2 + y]]],
    legs: [[[-0.5, 0.3], [-0.3, 0.7]], [[0.5, 0.3], [0.3, 0.7]]] }; },
  march:  (p) => { const l = p > 0.25 && p < 0.75, r = p >= 0.75; return { arms: [[[-0.45, 0]], [[0.45, 0]]],
    legs: [[[l ? -0.45 : -0.15, l ? 0.15 : 0.32], [l ? -0.45 : -0.2, l ? 0.5 : 0.7]], [[r ? 0.45 : 0.15, r ? 0.15 : 0.32], [r ? 0.45 : 0.2, r ? 0.5 : 0.7]]] }; },
  lean:   (p) => { const l = L(-0.4, 0.4, p); return { lean: l, arms: [[[-0.5 + l, 0.1]], [[0.5 + l, 0.1]]] }; },
  duck:   (p) => ({ yOff: L(0.4, 0.5, p), lean: 0.3, arms: [[[-0.7, -0.55], [-0.5, -1.0]], [[0.7, -0.55], [0.5, -1.0]]],
    legs: [[[-0.5, 0.3], [-0.3, 0.7]], [[0.5, 0.3], [0.3, 0.7]]] }),
  run:    (p) => { const a = L(-1, 1, p), up = (v) => 0.22 * Math.max(0, -v); return { lean: 0.25,
    arms: [[[-0.5 * a - 0.1, -0.15]], [[0.5 * a + 0.1, -0.15]]],
    legs: [[[0.35 * a, 0.3], [0.62 * a, 0.7 - up(a)]], [[-0.35 * a, 0.3], [-0.62 * a, 0.7 - up(-a)]]] }; },
  dance:  (p) => { const l = L(-0.3, 0.3, p); return { lean: l,
    arms: [[[-0.95 + l, L(-0.8, -1.2, p)]], [[0.95 + l, L(-1.2, -0.8, p)]]] }; },
  freeze: (p) => ({ yOff: p * 0.03, arms: [[[-0.42 - p * 0.04, 0.3]], [[0.42 + p * 0.04, 0.3]]] }),   /* a tiny shiver */
  side:   (p) => ({ lean: L(0, 0.25, p), arms: [[[-0.6, -0.25], [-0.25, 0.0]], [[0.6, -0.25], [0.25, 0.0]]],
    legs: [[[-0.15, 0.32], [-0.2, 0.7]], [[L(0.25, 0.6, p), 0.32], [L(0.3, 0.95, p), 0.7]]] }),
};
export const POSE_NAMES = Object.keys(POSES);

/* the drawings of each move, in order, repeating: p for the body and the face that goes with it. Three or four stills,
   so he jumps from one to the next, like stop-motion. */
export const FRAMES = {
  reach:  [[0, 'smile'], [0.5, 'grin'], [1, 'wow'], [1, 'wow']],
  flap:   [[0, 'smile'], [0.5, 'grin'], [1, 'joy'], [0.5, 'grin']],
  lift:   [[0, 'smile'], [0.5, 'grin'], [1, 'wow'], [1, 'grin']],
  wave:   [[0, 'grin'], [1, 'smile'], [0, 'grin'], [1, 'wink']],
  clap:   [[0, 'smile'], [0.5, 'grin'], [1, 'joy'], [0.5, 'grin']],
  hug:    [[0, 'smile'], [0.5, 'joy'], [1, 'joy'], [1, 'joy']],
  jump:   [[0, 'smile'], [0.5, 'grin'], [1, 'wow'], [0.5, 'grin']],
  squat:  [[0, 'smile'], [0.5, 'smirk'], [1, 'tongue'], [1, 'tongue']],
  march:  [[0, 'grin'], [0.5, 'smile'], [0, 'grin'], [1, 'smile']],               /* down, left knee up, down, right knee up */
  lean:   [[0, 'smile'], [0.5, 'grin'], [1, 'smirk'], [0.5, 'grin']],
  duck:   [[0, 'smile'], [0.5, 'wink'], [1, 'wink'], [1, 'wink']],
  run:    [[0, 'grin'], [0.5, 'smile'], [1, 'grin'], [0.5, 'smile']],
  dance:  [[0, 'joy'], [0.5, 'grin'], [1, 'joy'], [0.5, 'tongue']],
  freeze: [[0, 'wow'], [1, 'wow'], [0, 'wow'], [1, 'wow']],
  side:   [[0, 'smile'], [0.5, 'smirk'], [1, 'smirk'], [1, 'smirk']],
};
/* which drawing a move is on at time t (seconds since it began) */
export const frameAt = (pose, t) => { const f = FRAMES[pose] || FRAMES.freeze, i = Math.floor(Math.max(0, t) * MOTION.fps) % f.length; return { i, p: f[i][0], face: f[i][1] }; };


/* Cubo's faces: simple ones that read from across the room, built like the cube's own (tall oval eyes with a spark, a soft
   smile). Each draws on a head whose middle is (0, 0) and whose side is w. */
const eyes = (c, w, ry, dx = 0.2) => { c.fillStyle = CARD.ink; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx * dx * w, -0.12 * w, w * 0.085, ry, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = CARD.white; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx * dx * w - w * 0.024, -0.12 * w - w * 0.04, w * 0.026, w * 0.034, 0, 0, 6.2832); c.fill(); } };
const stroke = (c, w, lw = 0.05) => { c.strokeStyle = CARD.ink; c.lineWidth = w * lw; c.lineCap = 'round'; c.lineJoin = 'round'; };
const smile = (c, w, r = 0.18, y = 0.08) => { stroke(c, w, 0.055); c.beginPath(); c.moveTo(-r * w, y * w); c.quadraticCurveTo(0, (y + 0.18) * w, r * w, y * w); c.stroke(); };
const happyEye = (c, w, sx) => { stroke(c, w, 0.055); c.beginPath(); c.arc(sx * 0.2 * w, -0.08 * w, w * 0.08, Math.PI + 0.35, -0.35); c.stroke(); };
export const FACES = {
  smile:  (c, w) => { eyes(c, w, w * 0.125); smile(c, w); },
  grin:   (c, w) => { eyes(c, w, w * 0.125);
    c.fillStyle = CARD.ink; c.beginPath(); c.moveTo(-0.24 * w, 0.1 * w); c.quadraticCurveTo(0, 0.42 * w, 0.24 * w, 0.1 * w); c.closePath(); c.fill();
    c.fillStyle = CARD.pink; c.beginPath(); c.ellipse(0, 0.27 * w, 0.1 * w, 0.045 * w, 0, 0, 6.2832); c.fill(); },
  wow:    (c, w) => { eyes(c, w, w * 0.15, 0.21); c.fillStyle = CARD.ink; c.beginPath(); c.ellipse(0, 0.22 * w, 0.07 * w, 0.09 * w, 0, 0, 6.2832); c.fill(); },
  wink:   (c, w) => { c.fillStyle = CARD.ink; c.beginPath(); c.ellipse(-0.2 * w, -0.12 * w, w * 0.085, w * 0.125, 0, 0, 6.2832); c.fill();
    c.fillStyle = CARD.white; c.beginPath(); c.ellipse(-0.224 * w, -0.16 * w, w * 0.026, w * 0.034, 0, 0, 6.2832); c.fill();
    stroke(c, w, 0.055); c.beginPath(); c.moveTo(0.12 * w, -0.12 * w); c.lineTo(0.28 * w, -0.12 * w); c.stroke(); smile(c, w); },
  tongue: (c, w) => { eyes(c, w, w * 0.125); smile(c, w);
    c.fillStyle = CARD.pink; c.beginPath(); c.roundRect(-0.07 * w, 0.14 * w, 0.14 * w, 0.14 * w, [0, 0, 0.07 * w, 0.07 * w]); c.fill(); stroke(c, w, 0.03); c.stroke(); },
  joy:    (c, w) => { happyEye(c, w, -1); happyEye(c, w, 1);
    c.fillStyle = CARD.ink; c.beginPath(); c.moveTo(-0.22 * w, 0.1 * w); c.quadraticCurveTo(0, 0.4 * w, 0.22 * w, 0.1 * w); c.closePath(); c.fill(); },
  smirk:  (c, w) => { eyes(c, w, w * 0.12); stroke(c, w); c.beginPath(); c.moveTo(-0.12 * w, 0.2 * w); c.quadraticCurveTo(0.08 * w, 0.26 * w, 0.24 * w, 0.1 * w); c.stroke(); },
};
export const FACE_NAMES = Object.keys(FACES);

const easeOut = (k) => 1 - Math.pow(1 - k, 3), easeIn = (k) => k * k * k;

/* draw the card for a pose. K: the card's side in pixels. cx, cy: its middle. t: seconds into the move. alpha: fade (0..1).
   face: force a face (for looking at them). The picture is the block-limb Cubo himself (avatar-art.js), showing the move with its
   arrows (beside the arms, and the move's own marks; freeze gets its frost, sparkles and stillness ticks instead of arrows). */
export function drawCard(c, pose, K, cx, cy, t, alpha = 1, face = null){
  if (!POSES[pose]) return;
  const fr = frameAt(pose, t), bob = (fr.i % 2 ? 1 : -1) * K * 0.006;     /* floating: it steps up and down with the drawings */
  c.save(); c.globalAlpha *= alpha; c.translate(cx, cy + bob);
  /* the card: paper, the kit's strongest ink border (about twice a pill's), and the one flat soft shadow under it */
  const e = K * CARD.edgeW, rr = K * 0.17, sh = K * 0.045;
  c.fillStyle = palAlpha('shade.shadow', 0.18); c.beginPath(); c.roundRect(-K / 2, -K / 2 + sh, K, K, rr); c.fill();
  c.fillStyle = CARD.fill; c.beginPath(); c.roundRect(-K / 2, -K / 2, K, K, rr); c.fill();
  c.strokeStyle = CARD.edge; c.lineWidth = e; c.beginPath(); c.roundRect(-K / 2 + e / 2, -K / 2 + e / 2, K - e, K - e, rr - e / 2); c.stroke();
  /* him, big in the card: as big as fits his own drawn box (all four drawings, arrows and marks), which is what he is centred on */
  const b = poseBounds(pose, true), h = Math.min(K * 0.75, K * 0.74 / (b.x1 - b.x0), K * 0.74 / (b.y1 - b.y0));
  cuboFigure(c, -(b.x0 + b.x1) / 2 * h, -(b.y0 + b.y1) / 2 * h, h, pose, t, face, { arrows: true });
  c.restore();
}


/* the card where every game puts it: the same spot on the screen, the same size. age: seconds since the move began (it
   slides in from the side); left: seconds until it ends (it slides back out). */
export function figureCard(c, W, H, pose, t, { alpha = 1, age = Infinity, left = Infinity } = {}){
  const sl = slot(W, H, 'card'), K = Math.min(sl.w, sl.h), cx = sl.cx, cy = sl.cy, dir = cx < W / 2 ? -1 : 1, away = dir * ((dir < 0 ? cx : W - cx) + K * 0.6);   /* it comes from whichever side it lives on */
  const into = 1 - easeOut(Math.min(1, Math.max(0, age / MOTION.slideIn))), out = easeIn(Math.min(1, Math.max(0, 1 - left / MOTION.slideOut)));
  drawCard(c, pose, K, cx + away * Math.max(into, out), cy, Math.min(t, isFinite(age) ? age : t), alpha);
}


/* When the card shows, and when it tucks away (ui-review item 10). A game only says which move it wants (or none); this decides. A move shown for the
   first time this round stays 6 s (long enough to learn it), the same move asked again 3 s; then the card slides out and stays out until the game asks
   for a different move (or asks again after none). step(want, dt) returns what to draw ({ pose, age, left }, as figureCard takes) or null. */
export const CARD_HOLD = { first: 6, again: 3 };
export function cardTucker(){
  const k = { pose: null, age: 0, out: -1, last: null, hold: 0, shown: new Set() };
  return {
    reset(){ k.pose = null; k.age = 0; k.out = -1; k.last = null; k.hold = 0; k.shown.clear(); },
    step(want, dt){
      k.age += dt; if (k.out >= 0) k.out += dt;
      if (want && want !== k.last){ k.pose = want; k.age = 0; k.out = -1; k.hold = k.shown.has(want) ? CARD_HOLD.again : CARD_HOLD.first; k.shown.add(want); }
      k.last = want || null;
      if (k.pose && k.out < 0 && (!want || k.age > k.hold)) k.out = 0;
      if (!k.pose) return null;
      if (k.out > MOTION.slideOut){ k.pose = null; return null; }
      return { pose: k.pose, age: k.age, left: k.out < 0 ? Infinity : MOTION.slideOut - k.out };
    }
  };
}
