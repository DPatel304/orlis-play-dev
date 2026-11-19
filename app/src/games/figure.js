/* The move card: one little picture of a move, for the ones who can't read. Every game that shows one uses this, so it
   always looks the same and sits in the same place. It is Cubo, the Orlis cube, drawn flat like a sticker: a square head
   looking straight at you, a body with arms and legs, all with a dark outline, on a white card with a thick indigo border.
   The card floats (a soft shadow under it) and slides in from the right, where it sits in the top-right corner, when a move starts, and out again when it ends.
   Cubo moves like stop-motion: each move is three or four still drawings that repeat, and his face is part of each
   drawing, so he looks excited when his hands go up and strains a little in the squat. */
const L = (a, b, k) => a + (b - a) * k;

/* the look, in one place. size is a share of the screen's height; x and y are where the card's middle is, as a share of the
   screen. head: how big his head is, as a share of what it was first drawn at. */
export const CARD = { fill: '#ffffff', edge: '#2b2275', edgeW: 0.07, body: '#7aa2f7', line: '#2b2275', ink: '#1e1b4b',
  arrow: '#ff7a59', head: ['#60a5fa', '#c084fc'], top: ['#e9fbff', '#f3e8ff'], left: '#5eead4', size: 0.26, x: 0.855, y: 0.19, headSize: 0.75 };
/* how it moves: drawings a second, and how long the card takes to slide in and out (quick enough to start the move in time) */
export const MOTION = { fps: 5, slideIn: 0.45, slideOut: 0.3 };

/* every move is exactly four drawings (the same beat everywhere: 0.8 s a loop). */
export const DRAWINGS = 4;

/* each pose: p (0..1) is how far into the move this drawing is -> { yOff, lean, arms: [[points after the shoulder]...], legs: [[knee, foot]...] } */
export const POSES = {
  reach:  (p) => ({ arms: [[[L(-0.3, -0.85, p), L(0.15, -1.25, p)]], [[L(0.3, 0.85, p), L(0.15, -1.25, p)]]] }),
  flap:   (p) => ({ arms: [[[-0.9, L(0.05, -0.85, p)]], [[0.9, L(0.05, -0.85, p)]]] }),
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


/* the arrows: orange means "move this way". They show on the drawings that lead into a move, and not while he holds the
   pose, so the card stays clean. Each is [fromX, fromY, toX, toY, bend], in body sizes from the middle of the figure. */
const UP = [[-1.3, -0.05, -1.3, -1.1], [1.3, -0.05, 1.3, -1.1]], DOWN = [[-1.3, -1.1, -1.3, -0.05], [1.3, -1.1, 1.3, -0.05]];
const IN = (y) => [[-1.4, y, -0.8, y], [1.4, y, 0.8, y]], RIGHT = (y) => [[-0.5, y, 0.9, y]], LEFT = (y) => [[0.5, y, -0.9, y]];
export const MARKS = {
  reach:  { 0: UP, 1: UP },
  flap:   { 0: UP, 1: UP, 3: DOWN },
  wave:   { 0: RIGHT(-1.8), 1: LEFT(-1.8), 2: RIGHT(-1.8), 3: LEFT(-1.8) },
  clap:   { 0: IN(-0.38), 1: IN(-0.38) },
  hug:    { 0: IN(-0.45), 1: IN(-0.45) },
  jump:   { 0: UP, 1: UP, 3: DOWN },
  squat:  { 0: DOWN, 1: DOWN },
  march:  { 1: [[-1.2, 0.55, -1.2, -0.2]], 3: [[1.2, 0.55, 1.2, -0.2]] },
  lean:   { 1: RIGHT(-1.9), 3: LEFT(-1.9) },
  duck:   { 0: DOWN, 1: DOWN },
  run:    { 0: [[-1.4, -0.2, -0.6, -0.2]], 2: [[-1.4, -0.2, -0.6, -0.2]] },
  dance:  { 1: RIGHT(-1.9), 3: LEFT(-1.9) },
  freeze: {},
  side:   { 0: [[0.5, 1.0, 1.4, 1.0]], 1: [[0.5, 1.0, 1.4, 1.0]] },
};
function arrow(c, s, [x1, y1, x2, y2, bend = 0]){
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2, ang = Math.atan2(y2 - my, x2 - mx), tip = 0.12;
  const shaft = () => { c.beginPath(); c.moveTo(x1 * s, y1 * s); c.quadraticCurveTo(mx * s, my * s, (x2 - Math.cos(ang) * tip) * s, (y2 - Math.sin(ang) * tip) * s); };
  const tipPath = () => { const hl = s * 0.34, hw = s * 0.26, X = x2 * s, Y = y2 * s, ca = Math.cos(ang), sa = Math.sin(ang);
    c.beginPath(); c.moveTo(X, Y); c.lineTo(X - ca * hl + sa * hw, Y - sa * hl - ca * hw); c.lineTo(X - ca * hl - sa * hw, Y - sa * hl + ca * hw); c.closePath(); };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = CARD.line; c.fillStyle = CARD.line; c.lineWidth = s * 0.27; shaft(); c.stroke(); tipPath(); c.fill(); c.lineWidth = s * 0.1; c.stroke();   /* the dark outline */
  c.strokeStyle = CARD.arrow; c.fillStyle = CARD.arrow; c.lineWidth = s * 0.13; shaft(); c.stroke(); tipPath(); c.fill();
  c.restore();
}

const gradient = (c, x0, y0, x1, y1, cols) => { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; };

/* Cubo's faces: simple ones that read from across the room, built like the cube's own (tall oval eyes with a spark, a soft
   smile). Each draws on a head whose middle is (0, 0) and whose side is w. */
const eyes = (c, w, ry, dx = 0.2) => { c.fillStyle = CARD.ink; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx * dx * w, -0.12 * w, w * 0.085, ry, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = '#fff'; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx * dx * w - w * 0.024, -0.12 * w - w * 0.04, w * 0.026, w * 0.034, 0, 0, 6.2832); c.fill(); } };
const stroke = (c, w, lw = 0.05) => { c.strokeStyle = CARD.ink; c.lineWidth = w * lw; c.lineCap = 'round'; c.lineJoin = 'round'; };
const smile = (c, w, r = 0.18, y = 0.08) => { stroke(c, w, 0.055); c.beginPath(); c.moveTo(-r * w, y * w); c.quadraticCurveTo(0, (y + 0.18) * w, r * w, y * w); c.stroke(); };
const happyEye = (c, w, sx) => { stroke(c, w, 0.055); c.beginPath(); c.arc(sx * 0.2 * w, -0.08 * w, w * 0.08, Math.PI + 0.35, -0.35); c.stroke(); };
export const FACES = {
  smile:  (c, w) => { eyes(c, w, w * 0.125); smile(c, w); },
  grin:   (c, w) => { eyes(c, w, w * 0.125);
    c.fillStyle = CARD.ink; c.beginPath(); c.moveTo(-0.24 * w, 0.1 * w); c.quadraticCurveTo(0, 0.42 * w, 0.24 * w, 0.1 * w); c.closePath(); c.fill();
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(0, 0.27 * w, 0.1 * w, 0.045 * w, 0, 0, 6.2832); c.fill(); },
  wow:    (c, w) => { eyes(c, w, w * 0.15, 0.21); c.fillStyle = CARD.ink; c.beginPath(); c.ellipse(0, 0.22 * w, 0.07 * w, 0.09 * w, 0, 0, 6.2832); c.fill(); },
  wink:   (c, w) => { c.fillStyle = CARD.ink; c.beginPath(); c.ellipse(-0.2 * w, -0.12 * w, w * 0.085, w * 0.125, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-0.224 * w, -0.16 * w, w * 0.026, w * 0.034, 0, 0, 6.2832); c.fill();
    stroke(c, w, 0.055); c.beginPath(); c.moveTo(0.12 * w, -0.12 * w); c.lineTo(0.28 * w, -0.12 * w); c.stroke(); smile(c, w); },
  tongue: (c, w) => { eyes(c, w, w * 0.125); smile(c, w);
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.roundRect(-0.07 * w, 0.14 * w, 0.14 * w, 0.14 * w, [0, 0, 0.07 * w, 0.07 * w]); c.fill(); stroke(c, w, 0.03); c.stroke(); },
  joy:    (c, w) => { happyEye(c, w, -1); happyEye(c, w, 1);
    c.fillStyle = CARD.ink; c.beginPath(); c.moveTo(-0.22 * w, 0.1 * w); c.quadraticCurveTo(0, 0.4 * w, 0.22 * w, 0.1 * w); c.closePath(); c.fill(); },
  smirk:  (c, w) => { eyes(c, w, w * 0.12); stroke(c, w); c.beginPath(); c.moveTo(-0.12 * w, 0.2 * w); c.quadraticCurveTo(0.08 * w, 0.26 * w, 0.24 * w, 0.1 * w); c.stroke(); },
};
export const FACE_NAMES = Object.keys(FACES);

/* the head: a flat square in the cube's colours, with an outline, looking straight at you. r: half its side. */
function head(c, cx, cy, r, face){
  const w = r * 2, ow = w * 0.06, rad = w * 0.2;
  c.save(); c.translate(cx, cy);
  c.fillStyle = CARD.line; c.beginPath(); c.roundRect(-w / 2 - ow, -w / 2 - ow, w + ow * 2, w + ow * 2, rad + ow); c.fill();
  /* the cube's own colours: its blue-to-purple front, the pale top edge, a sliver of the teal side */
  c.save(); c.beginPath(); c.roundRect(-w / 2, -w / 2, w, w, rad); c.clip();
  c.fillStyle = gradient(c, -w / 2, -w / 2, w / 2, w / 2, CARD.head); c.fillRect(-w / 2, -w / 2, w, w);
  c.fillStyle = CARD.left; c.globalAlpha *= 0.9; c.fillRect(-w / 2, -w / 2, w * 0.1, w); c.globalAlpha /= 0.9;
  c.fillStyle = gradient(c, -w / 2, -w / 2, w / 2, -w * 0.3, CARD.top); c.fillRect(-w / 2, -w / 2, w, w * 0.17);
  c.restore();
  (FACES[face] || FACES.smile)(c, w);
  c.restore();
}

const easeOut = (k) => 1 - Math.pow(1 - k, 3), easeIn = (k) => k * k * k;

/* draw the card for a pose. K: the card's side in pixels. cx, cy: its middle. t: seconds into the move. alpha: fade (0..1).
   face: force a face (for looking at them). */
export function drawCard(c, pose, K, cx, cy, t, alpha = 1, face = null){
  const make = POSES[pose]; if (!make) return;
  const fr = frameAt(pose, t), q = make(fr.p), s = K * 0.25, yo = q.yOff || 0, lean = q.lean || 0;
  const sh = { x: lean * 0.6, y: -0.6 + yo }, hip = { x: lean * 0.1, y: -0.05 + yo };
  const legs = q.legs || [[[-0.15, 0.32], [-0.2, 0.7]], [[0.15, 0.32], [0.2, 0.7]]];
  const bob = (fr.i % 2 ? 1 : -1) * K * 0.006;                           /* floating: it steps up and down with the drawings */
  c.save(); c.globalAlpha *= alpha; c.translate(cx, cy + bob);
  /* the card: white, a thick indigo border, and a big soft shadow well under it, so it lifts off whatever is behind */
  const e = K * CARD.edgeW, rr = K * 0.17;
  c.shadowColor = 'rgba(10,10,50,.42)'; c.shadowBlur = K * 0.14; c.shadowOffsetY = K * 0.085;
  c.fillStyle = CARD.fill; c.beginPath(); c.roundRect(-K / 2, -K / 2, K, K, rr); c.fill();
  c.shadowColor = 'transparent';
  c.strokeStyle = CARD.edge; c.lineWidth = e; c.beginPath(); c.roundRect(-K / 2 + e / 2, -K / 2 + e / 2, K - e, K - e, rr - e / 2); c.stroke();
  c.translate(0, K * 0.12); c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s))); c.stroke(); };
  const ends = (r, col) => { c.fillStyle = col; for (const l of [...q.arms, ...legs]){ const p2 = l[l.length - 1]; c.beginPath(); c.arc(p2[0] * s, p2[1] * s, r, 0, 6.2832); c.fill(); } };
  const hr = s * 0.6 * CARD.headSize, hy = sh.y - 0.08 - hr / s;          /* the head sits right on the shoulders, so he's all one piece */
  const pass = (w, col) => { c.strokeStyle = col; c.lineWidth = w; line([[sh.x, hy], [hip.x, hip.y]]);
    for (const a of q.arms) line([[sh.x, sh.y], ...a]); for (const l of legs) line([[hip.x, hip.y], ...l]); };
  pass(s * 0.3, CARD.line); ends(s * 0.17, CARD.line);                    /* the dark outline, then the body over it */
  pass(s * 0.17, CARD.body); ends(s * 0.11, CARD.body);
  head(c, sh.x * s, hy * s, hr, face || fr.face);
  for (const a of (MARKS[pose] || {})[fr.i] || []) arrow(c, s, a);
  if (pose === 'freeze') [[-1.3, -1.5], [1.3, -0.9], [-1.25, 0.1], [1.2, 0.35]].forEach(([x, y], j) => { if ((j + fr.i) % 2) return;   /* ice twinkles, a different pair each drawing */
    const r = s * 0.2; c.beginPath(); c.moveTo(x * s, y * s - r * 1.5); c.lineTo(x * s + r, y * s); c.lineTo(x * s, y * s + r * 1.5); c.lineTo(x * s - r, y * s); c.closePath();
    c.fillStyle = '#9be0ff'; c.fill(); c.strokeStyle = CARD.line; c.lineWidth = s * 0.07; c.lineJoin = 'round'; c.stroke(); });
  c.restore();
}

/* the card where every game puts it: the same spot on the screen, the same size. age: seconds since the move began (it
   slides in from the side); left: seconds until it ends (it slides back out). */
export function figureCard(c, W, H, pose, t, { alpha = 1, age = Infinity, left = Infinity } = {}){
  const K = H * CARD.size, dir = CARD.x < 0.5 ? -1 : 1, away = dir * ((dir < 0 ? W * CARD.x : W * (1 - CARD.x)) + K * 0.6);   /* it comes from whichever side it lives on */
  const into = 1 - easeOut(Math.min(1, Math.max(0, age / MOTION.slideIn))), out = easeIn(Math.min(1, Math.max(0, 1 - left / MOTION.slideOut)));
  drawCard(c, pose, K, W * CARD.x + away * Math.max(into, out), H * CARD.y, Math.min(t, isFinite(age) ? age : t), alpha);
}
