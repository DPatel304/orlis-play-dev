/* The move card: one little picture of a move, for the ones who can't read. Every game that shows one uses this, so it
   always looks the same and sits in the same place. It is the Orlis cube from the corner of the home screen, grown arms
   and legs, on a deep-indigo card with a white edge. The edge keeps the card from sinking into dark scenes, the indigo
   keeps it from melting into bright ones, and the white outline on the body keeps the arms and legs readable on both.
   (A pose is a few joints; the figure moves a little, so it shows the move and not just a freeze-frame.) */
const L = (a, b, k) => a + (b - a) * k, S = Math.sin;

/* the two colours every card has (one fill, one edge), and where it goes: size is a share of the screen's height, x and y
   are where its middle is, as a share of the screen. */
export const CARD = { fill: '#1f1b5c', edge: '#ffffff', body: '#5d86f2', size: 0.3, x: 0.86, y: 0.5 };
const FACES = { top: ['#e9fbff', '#f3e8ff'], left: ['#5eead4', '#60a5fa'], right: ['#60a5fa', '#c084fc'] };
const INK = '#1e1b4b';

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

const grad = (c, x0, y0, x1, y1, cols) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); return g; };

/* the Orlis cube as a head: r is half its height; it blinks now and then */
function cube(c, cx, cy, r, blink){
  c.save(); c.translate(cx, cy); c.scale(r, r);
  const path = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const hex = [[0, -1], [0.866, -0.5], [0.866, 0.5], [0, 1], [-0.866, 0.5], [-0.866, -0.5]];
  path(hex); c.fillStyle = CARD.edge; c.fill();
  path([[-0.866, -0.5], [0, 0], [0, 1], [-0.866, 0.5]]); c.fillStyle = grad(c, -0.866, -0.5, 0, 1, FACES.left); c.fill();
  path([[0, 0], [0.866, -0.5], [0.866, 0.5], [0, 1]]); c.fillStyle = grad(c, 0, -0.5, 0.866, 0.5, FACES.right); c.fill();
  path([[-0.866, -0.5], [0, -1], [0.866, -0.5], [0, 0]]); c.fillStyle = grad(c, -0.866, -1, 0.866, 0, FACES.top); c.fill();
  path(hex); c.strokeStyle = CARD.edge; c.lineWidth = 0.085; c.lineJoin = 'round'; c.stroke();
  c.transform(0.866, -0.5, 0, 1, 0, 0);                              /* the face, on the right side */
  c.fillStyle = INK; const ry = blink ? 0.05 : 0.125;
  for (const x of [0.3, 0.7]){ c.beginPath(); c.ellipse(x, 0.38, 0.085, ry, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = '#fff'; c.globalAlpha *= 0.9;
  for (const x of [0.276, 0.676]){ c.beginPath(); c.ellipse(x, 0.34, 0.026, 0.034, 0, 0, 6.2832); c.fill(); }
  c.globalAlpha /= 0.9;
  c.strokeStyle = INK; c.lineWidth = 0.055; c.lineCap = 'round'; c.beginPath(); c.moveTo(0.32, 0.58); c.quadraticCurveTo(0.5, 0.76, 0.68, 0.58); c.stroke();
  c.restore();
}

/* draw the card for a pose. K: the card's side in pixels. cx, cy: its middle. t: seconds. alpha: fade (0..1). */
export function drawCard(c, pose, K, cx, cy, t, alpha = 1){
  const make = POSES[pose]; if (!make) return;
  const p = 0.5 + 0.5 * S(t * 4), q = make(p, t), s = K * 0.282, yo = q.yOff || 0, lean = q.lean || 0;
  const sh = { x: lean * 0.6, y: -0.6 + yo }, hip = { x: lean * 0.1, y: -0.05 + yo };
  const legs = q.legs || [[[-0.15, 0.32], [-0.2, 0.7]], [[0.15, 0.32], [0.2, 0.7]]];
  c.save(); c.globalAlpha *= alpha;
  /* the card: indigo with a white edge, and a shadow so it lifts off the scene */
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = K * 0.07; c.shadowOffsetY = K * 0.027;
  c.fillStyle = CARD.fill; c.beginPath(); c.roundRect(cx - K / 2, cy - K / 2, K, K, K * 0.16); c.fill();
  c.shadowColor = 'transparent';
  const e = K * 0.03; c.strokeStyle = CARD.edge; c.lineWidth = e; c.beginPath(); c.roundRect(cx - K / 2 + e / 2, cy - K / 2 + e / 2, K - e, K - e, K * 0.15); c.stroke();
  c.translate(cx, cy + K * 0.153); c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s))); c.stroke(); };
  const ends = (r, col) => { c.fillStyle = col; for (const l of [...q.arms, ...legs]){ const p2 = l[l.length - 1]; c.beginPath(); c.arc(p2[0] * s, p2[1] * s, r, 0, 6.2832); c.fill(); } };
  const pass = (w, col) => { c.strokeStyle = col; c.lineWidth = w; line([[sh.x, sh.y - 0.2], [hip.x, hip.y]]);
    for (const a of q.arms) line([[sh.x, sh.y], ...a]); for (const l of legs) line([[hip.x, hip.y], ...l]); };
  pass(s * 0.27, CARD.edge); ends(s * 0.17, CARD.edge);              /* the white outline, then the body over it */
  pass(s * 0.15, CARD.body); ends(s * 0.1, CARD.body);
  if (q.sparkle){                                                    /* freeze: a few twinkles of ice */
    c.fillStyle = CARD.edge;
    [[-1.3, -1.5], [1.3, -0.9], [-1.25, 0.1], [1.2, 0.35]].forEach(([x, y], i) => { const r = s * (0.08 + 0.07 * (0.5 + 0.5 * S(t * 3 + i * 1.7)));
      c.beginPath(); c.moveTo(x * s, y * s - r * 2); c.lineTo(x * s + r, y * s); c.lineTo(x * s, y * s + r * 2); c.lineTo(x * s - r, y * s); c.closePath(); c.fill(); });
  }
  cube(c, (sh.x * 0.4 + lean * 0.15) * s, (-1.22 + yo * 0.35) * s, s * 0.62, S(t * 1.3) > 0.97);
  c.restore();
}

/* the card where every game puts it: the same spot on the screen, the same size. */
export function figureCard(c, W, H, pose, t, alpha = 1){
  const K = H * CARD.size; drawCard(c, pose, K, W * CARD.x, H * CARD.y, t, alpha);
}
