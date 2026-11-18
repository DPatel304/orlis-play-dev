/* The move card: one little picture of a move, for the ones who can't read. Every game that shows one uses this, so it
   always looks the same and sits in the same place. It is Cubo, the Orlis cube, drawn flat like a sticker: a square head
   looking straight at you with a big face, a body with arms and legs, all with a dark outline, on a white card with a
   thick indigo border. The card floats: a soft shadow under it and a gentle bob, so it sits on top of the game and never
   melts into the scene behind it. Cubo makes a new face every couple of seconds while he does the move.
   (A pose is a few joints; the figure moves a little, so it shows the move and not just a freeze-frame.) */
const L = (a, b, k) => a + (b - a) * k, S = Math.sin;

/* the look, in one place. size is a share of the screen's height; x and y are where its middle is, as a share of the screen. */
export const CARD = { fill: '#ffffff', edge: '#2b2275', edgeW: 0.07, body: '#7aa2f7', line: '#2b2275', ink: '#1e1b4b',
  head: ['#5eead4', '#60a5fa', '#c084fc'], size: 0.3, x: 0.86, y: 0.5 };

/* each: (p 0..1 pulse, t seconds) -> { yOff, lean, arms: [[points after the shoulder]...], legs: [[knee, foot]...], sparkle } */
export const POSES = {
  reach:  (p) => ({ arms: [[[L(-0.3, -0.85, p), L(0.15, -1.25, p)]], [[L(0.3, 0.85, p), L(0.15, -1.25, p)]]] }),
  flap:   (p) => ({ arms: [[[-0.9, L(0.05, -0.85, p)]], [[0.9, L(0.05, -0.85, p)]]] }),
  wave:   (p, t) => ({ arms: [[[-0.3, 0.2]], [[0.5, -0.5], [0.5 + 0.28 * S(t * 8), -1.0]]] }),
  clap:   (p) => ({ arms: [[[-0.5, -0.2], [L(-0.6, -0.05, p), -0.38]], [[0.5, -0.2], [L(0.6, 0.05, p), -0.38]]] }),
  hug:    (p) => ({ arms: [[[-0.55, -0.3], [L(0.2, 0.3, p), -0.5]], [[0.55, -0.3], [L(-0.2, -0.3, p), -0.42]]] }),
  jump:   (p) => { const y = -p * 0.45; return { yOff: y, arms: [[[-0.55, L(0, -0.6, p)]], [[0.55, L(0, -0.6, p)]]],
    legs: [[[-0.1, 0.35 + y * 0.4], [-0.15, 0.7 + y]], [[0.1, 0.35 + y * 0.4], [0.15, 0.7 + y]]] }; },
  squat:  (p) => { const y = p * 0.4; return { yOff: y, arms: [[[-0.6, -0.2 + y]], [[0.6, -0.2 + y]]],
    legs: [[[-0.5, 0.3], [-0.3, 0.7]], [[0.5, 0.3], [0.3, 0.7]]] }; },
  march:  (p, t) => { const u = S(t * 4) > 0; return { arms: [[[-0.45, 0]], [[0.45, 0]]],
    legs: [[[u ? -0.45 : -0.15, u ? 0.15 : 0.32], [u ? -0.45 : -0.2, u ? 0.5 : 0.7]], [[0.15, 0.32], [0.2, 0.7]]] }; },
  lean:   (p) => { const l = L(-0.4, 0.4, p); return { lean: l, arms: [[[-0.5 + l, 0.1]], [[0.5 + l, 0.1]]] }; },
  duck:   (p) => ({ yOff: L(0.4, 0.5, p), lean: 0.3, arms: [[[-0.7, -0.55], [-0.5, -1.0]], [[0.7, -0.55], [0.5, -1.0]]],
    legs: [[[-0.5, 0.3], [-0.3, 0.7]], [[0.5, 0.3], [0.3, 0.7]]] }),
  run:    (p, t) => { const a = S(t * 8), up = (v) => 0.22 * Math.max(0, -v); return { lean: 0.25,
    arms: [[[-0.5 * a - 0.1, -0.15]], [[0.5 * a + 0.1, -0.15]]],
    legs: [[[0.35 * a, 0.3], [0.62 * a, 0.7 - up(a)]], [[-0.35 * a, 0.3], [-0.62 * a, 0.7 - up(-a)]]] }; },
  dance:  (p, t) => { const l = S(t * 4) * 0.3; return { lean: l,
    arms: [[[-0.95 + l, -1.0 + 0.2 * S(t * 8)]], [[0.95 + l, -1.0 - 0.2 * S(t * 8)]]] }; },
  freeze: () => ({ sparkle: true, arms: [[[-0.42, 0.3]], [[0.42, 0.3]]], legs: [[[-0.15, 0.32], [-0.2, 0.7]], [[0.15, 0.32], [0.2, 0.7]]] }),
  side:   (p) => ({ lean: L(0, 0.25, p), arms: [[[-0.6, -0.25], [-0.25, 0.0]], [[0.6, -0.25], [0.25, 0.0]]],
    legs: [[[-0.15, 0.32], [-0.2, 0.7]], [[L(0.25, 0.6, p), 0.32], [L(0.3, 0.95, p), 0.7]]] }),
};
export const POSE_NAMES = Object.keys(POSES);

const gradient = (c, x0, y0, x1, y1, cols) => { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; };

/* Cubo's faces: simple ones that read from across the room. Each draws on a head whose middle is (0, 0) and whose side is w. */
const eyes = (c, w, ry, dx = 0.2) => { c.fillStyle = CARD.ink; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx * dx * w, -0.04 * w, w * 0.07, ry, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = '#fff'; for (const sx of [-1, 1]){ c.beginPath(); c.ellipse(sx * dx * w - w * 0.02, -0.04 * w - ry * 0.35, w * 0.022, ry * 0.28, 0, 0, 6.2832); c.fill(); } };
const stroke = (c, w, lw = 0.05) => { c.strokeStyle = CARD.ink; c.lineWidth = w * lw; c.lineCap = 'round'; c.lineJoin = 'round'; };
const smile = (c, w, r = 0.2, y = 0.08) => { stroke(c, w); c.beginPath(); c.arc(0, y * w, r * w, 0.3, Math.PI - 0.3); c.stroke(); };
const happyEye = (c, w, sx) => { stroke(c, w, 0.055); c.beginPath(); c.arc(sx * 0.2 * w, 0.0, w * 0.075, Math.PI + 0.35, -0.35); c.stroke(); };
export const FACES = {
  smile:  (c, w, blink) => { eyes(c, w, blink ? w * 0.025 : w * 0.105); smile(c, w); },
  grin:   (c, w, blink) => { eyes(c, w, blink ? w * 0.025 : w * 0.105);
    c.fillStyle = CARD.ink; c.beginPath(); c.moveTo(-0.24 * w, 0.1 * w); c.quadraticCurveTo(0, 0.42 * w, 0.24 * w, 0.1 * w); c.closePath(); c.fill();
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(0, 0.27 * w, 0.1 * w, 0.045 * w, 0, 0, 6.2832); c.fill(); },
  wow:    (c, w) => { eyes(c, w, w * 0.13, 0.21); stroke(c, w); c.fillStyle = CARD.ink; c.beginPath(); c.ellipse(0, 0.22 * w, 0.07 * w, 0.09 * w, 0, 0, 6.2832); c.fill(); },
  wink:   (c, w) => { c.fillStyle = CARD.ink; c.beginPath(); c.ellipse(-0.2 * w, -0.04 * w, w * 0.07, w * 0.105, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-0.22 * w, -0.08 * w, w * 0.022, w * 0.03, 0, 0, 6.2832); c.fill();
    stroke(c, w, 0.055); c.beginPath(); c.moveTo(0.12 * w, -0.04 * w); c.lineTo(0.28 * w, -0.04 * w); c.stroke(); smile(c, w, 0.2, 0.1); },
  tongue: (c, w, blink) => { eyes(c, w, blink ? w * 0.025 : w * 0.105); smile(c, w, 0.2, 0.08);
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.roundRect(-0.07 * w, 0.2 * w, 0.14 * w, 0.14 * w, [0, 0, 0.07 * w, 0.07 * w]); c.fill(); stroke(c, w, 0.03); c.stroke(); },
  joy:    (c, w) => { happyEye(c, w, -1); happyEye(c, w, 1);
    c.fillStyle = CARD.ink; c.beginPath(); c.moveTo(-0.22 * w, 0.1 * w); c.quadraticCurveTo(0, 0.4 * w, 0.22 * w, 0.1 * w); c.closePath(); c.fill(); },
  grit:   (c, w, blink) => { eyes(c, w, blink ? w * 0.025 : w * 0.09, 0.2); stroke(c, w, 0.06);
    c.beginPath(); c.moveTo(-0.32 * w, -0.2 * w); c.lineTo(-0.1 * w, -0.13 * w); c.moveTo(0.32 * w, -0.2 * w); c.lineTo(0.1 * w, -0.13 * w); c.stroke();
    c.beginPath(); c.moveTo(-0.14 * w, 0.2 * w); c.quadraticCurveTo(0, 0.14 * w, 0.14 * w, 0.2 * w); c.stroke(); },
  smirk:  (c, w, blink) => { eyes(c, w, blink ? w * 0.025 : w * 0.1); stroke(c, w); c.beginPath(); c.moveTo(-0.12 * w, 0.2 * w); c.quadraticCurveTo(0.08 * w, 0.26 * w, 0.24 * w, 0.1 * w); c.stroke(); },
};
export const FACE_NAMES = Object.keys(FACES);

/* a new face every couple of seconds, picked at random (but the same on every run for the same moment: it's drawn from the clock) */
const PERIOD = 2.3;
const seq = ['smile'];                                              /* (built as it's needed: each is picked, then nudged if it matches the last) */
export function faceAt(t){
  const n = Math.max(0, Math.floor(t / PERIOD));
  while (seq.length <= n){
    const i = seq.length; let name = FACE_NAMES[(Math.imul(i + 7, 2654435761) >>> 0) % FACE_NAMES.length];
    if (name === seq[i - 1]) name = FACE_NAMES[(FACE_NAMES.indexOf(name) + 3) % FACE_NAMES.length];
    seq.push(name);
  }
  return { name: seq[n], pop: Math.max(0, 1 - (t - n * PERIOD) * 6) };
}

/* the head: a flat square in the cube's colours, with an outline, looking straight at you. r: half its side. */
function head(c, cx, cy, r, t, face){
  const w = r * 2, f = face ? { name: face, pop: 0 } : faceAt(t), blink = S(t * 1.3) > 0.97, ow = w * 0.06, rad = w * 0.2;
  c.save(); c.translate(cx, cy); const k = 1 + 0.1 * f.pop; c.scale(k, k);
  c.fillStyle = CARD.line; c.beginPath(); c.roundRect(-w / 2 - ow, -w / 2 - ow, w + ow * 2, w + ow * 2, rad + ow); c.fill();
  c.fillStyle = gradient(c, -w / 2, -w / 2, w / 2, w / 2, CARD.head); c.beginPath(); c.roundRect(-w / 2, -w / 2, w, w, rad); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.roundRect(-w * 0.4, -w * 0.42, w * 0.46, w * 0.08, w * 0.04); c.fill();
  (FACES[f.name] || FACES.smile)(c, w, blink);
  c.restore();
}

/* draw the card for a pose. K: the card's side in pixels. cx, cy: its middle. t: seconds. alpha: fade (0..1). face: force a face (for looking). */
export function drawCard(c, pose, K, cx, cy, t, alpha = 1, face = null){
  const make = POSES[pose]; if (!make) return;
  const p = 0.5 + 0.5 * S(t * 4), q = make(p, t), s = K * 0.262, yo = q.yOff || 0, lean = q.lean || 0;
  const sh = { x: lean * 0.6, y: -0.6 + yo }, hip = { x: lean * 0.1, y: -0.05 + yo };
  const legs = q.legs || [[[-0.15, 0.32], [-0.2, 0.7]], [[0.15, 0.32], [0.2, 0.7]]];
  const bob = S(t * 1.7) * K * 0.012;                                 /* floating: a slow bob, and a slight sway */
  c.save(); c.globalAlpha *= alpha; c.translate(cx, cy + bob); c.rotate(S(t * 1.1) * 0.012);
  /* the card: white, a thick indigo border, and a big soft shadow well under it, so it lifts off whatever is behind */
  const e = K * CARD.edgeW, rr = K * 0.17;
  c.shadowColor = 'rgba(10,10,50,.42)'; c.shadowBlur = K * 0.14; c.shadowOffsetY = K * (0.085 - bob / K * 2);
  c.fillStyle = CARD.fill; c.beginPath(); c.roundRect(-K / 2, -K / 2, K, K, rr); c.fill();
  c.shadowColor = 'transparent';
  c.strokeStyle = CARD.edge; c.lineWidth = e; c.beginPath(); c.roundRect(-K / 2 + e / 2, -K / 2 + e / 2, K - e, K - e, rr - e / 2); c.stroke();
  c.translate(0, K * 0.16); c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s))); c.stroke(); };
  const ends = (r, col) => { c.fillStyle = col; for (const l of [...q.arms, ...legs]){ const p2 = l[l.length - 1]; c.beginPath(); c.arc(p2[0] * s, p2[1] * s, r, 0, 6.2832); c.fill(); } };
  const pass = (w, col) => { c.strokeStyle = col; c.lineWidth = w; line([[sh.x, sh.y - 0.2], [hip.x, hip.y]]);
    for (const a of q.arms) line([[sh.x, sh.y], ...a]); for (const l of legs) line([[hip.x, hip.y], ...l]); };
  pass(s * 0.3, CARD.line); ends(s * 0.17, CARD.line);               /* the dark outline, then the body over it */
  pass(s * 0.17, CARD.body); ends(s * 0.11, CARD.body);
  head(c, (sh.x * 0.4 + lean * 0.15) * s, (-1.3 + yo * 0.35) * s, s * 0.6, t, face);
  c.restore();
}

/* the card where every game puts it: the same spot on the screen, the same size. */
export function figureCard(c, W, H, pose, t, alpha = 1){
  const K = H * CARD.size; drawCard(c, pose, K, W * CARD.x, H * CARD.y, t, alpha);
}
