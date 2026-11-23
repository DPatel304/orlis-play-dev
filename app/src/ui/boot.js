/* The app turning on: Orlis Play's intro, about two and a half seconds, the same every time (decision 0045: the two squares).
   A blue square pops in, the violet one hops onto it (a warm chord swells and settles as it lands), the name comes up beside
   them (two sparkles) - "Orlis Play", "Play" in the gradient - and the squares do a little wink-squash. Then it hands over to the home screen.
   (camReady: the intro can wait, still, for something to be ready before it hands over - nothing does now; the camera waits for
   a game.) A click or a key skips to the end. */
import { sfx } from '../audio/sound.js';
import { screen, h, clearUI } from './screens.js';
import { tok, twoSquares } from './brand.js';
import { color } from '../games/assets/palette.js';

/* Seconds: the blue square arrives; the violet one lands; the name; the squash; where it waits for the camera; the hand-over; the end. */
/* (owner, 2026-11-23: the name waits a little longer after the squares land - 1.6 s, was 1.15) */
export const ARRIVE = 0.45, MERGE = 0.95, NAME = 1.6, WINK = 2.15, HOLD = 3.65, BREAK = 3.7, BOOT = 3.95;   /* (owner: it rests on the logo a second longer) */
/* The look: the room (style.css --paper). */
export const PAPER = tok('--paper', 'white');
export const SYS = '"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif';

/* settle: signing in comes next - after the squash the logo stays, and the sign-in screen carries on from here. */
export const SETTLE = WINK + 0.8;
export function boot({ settle = false } = {}){
  clearUI();
  const s = screen('boot');
  const wait = h('p', 'bootwait', 'Starting the camera…');
  s.appendChild(wait);

  let t = 0, idle = 0, chimed = false, skip = false;
  const end = () => { skip = true; };
  addEventListener('keydown', end, { once: true });
  addEventListener('pointerdown', end, { once: true });

  const show = {
    camReady: true,
    get t(){ return t; },
    get done(){ return t >= (settle ? SETTLE : BOOT); },
    tick(dt){
      idle += dt;
      if (skip && t < HOLD) t = settle ? SETTLE : HOLD;
      if (t < HOLD || show.camReady) t += dt;
      if (t > HOLD && !show.camReady) t = HOLD;
      wait.classList.toggle('show', t >= HOLD && !show.camReady && idle > HOLD + 1);
      /* the intro's one sound (decision 0050, "soft bloom"), booked from the start: a warm chord swells as the squares come together,
         one soft note as they land, two sparkles as the name comes in. Nothing at the wink. (skipped: no sound) */
      if (!chimed && !skip){ chimed = true; sfx.boot({ merge: MERGE - t, name: NAME - t }); }
    },
    draw(c, W, H){ drawBoot(c, W, H, t, idle); }
  };
  return show;
}

/* ---------- the picture ---------- */
const cl = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => cl((t - a) / (b - a));
const eo = (k) => 1 - Math.pow(1 - k, 3);
const back = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;

/* a rounded square, centred, turned a little */
function square(c, x, y, size, turn, fill, edge = null){
  c.save(); c.translate(x, y); c.rotate(turn); c.fillStyle = fill;
  c.beginPath(); c.roundRect(-size / 2, -size / 2, size, size, size * 0.27); c.fill();
  if (edge){ c.lineWidth = size * 0.06; c.strokeStyle = edge; c.stroke(); }
  c.restore();
}

/* The two squares, and the name beside them. `k` squashes the blue one as the violet one lands. */
export function drawMark(c, cx, cy, s, t = 99, { name = true, a = 1 } = {}){
  const blue = tok('--blue', color('fav.sky')), violet = tok('--violet', color('fav.purple')), ink = tok('--ink', color('shade.ink'));
  const pop = back(seg(t, 0, ARRIVE)), hop = seg(t, ARRIVE, MERGE), land = seg(t, MERGE, MERGE + 0.25);
  /* the squash when it lands, and the little one at the wink */
  const sq = (hop >= 1 ? Math.sin(land * Math.PI) * 0.08 : 0) + (t >= WINK && t < WINK + 0.3 ? Math.sin(seg(t, WINK, WINK + 0.3) * Math.PI) * 0.05 : 0);
  c.save(); c.globalAlpha = a;
  const bx = cx - s * 0.18, by = cy + s * 0.2;
  c.save(); c.translate(bx, by + s * 0.28); c.scale(1 + sq, 1 - sq); c.translate(-bx, -(by + s * 0.28));
  square(c, bx, by, s * 0.56 * pop, 0, blue); c.restore();
  /* the violet square arcs in from the left and lands upper right of the blue one */
  const fx = bx - s * 0.7, fy = by - s * 0.1, tx = cx + s * 0.12, ty = cy - s * 0.2;
  const e = eo(hop), vx = lerp(fx, tx, e), vy = lerp(fy, ty, e) - Math.sin(hop * Math.PI) * s * 0.42;
  if (t > ARRIVE * 0.6) square(c, vx, vy, s * 0.5 * cl(seg(t, ARRIVE * 0.6, ARRIVE)), lerp(-0.2, 0.17, e), violet);
  c.restore();
  if (!name) return;
  const wa = eo(seg(t, NAME, NAME + 0.4));
  if (wa <= 0) return;
  c.save(); c.globalAlpha = wa * a; c.textAlign = 'left'; c.textBaseline = 'middle';
  const size = s * 0.52, x0 = cx + s * 0.62, y0 = cy + (1 - wa) * s * 0.06;
  c.font = `700 ${Math.round(size)}px ${SYS}`;
  const wa1 = c.measureText('Orlis ').width, wb = c.measureText('Play').width;
  c.fillStyle = ink; c.fillText('Orlis ', x0, y0);
  const g = c.createLinearGradient(x0 + wa1, 0, x0 + wa1 + wb, 0); g.addColorStop(0, blue); g.addColorStop(1, violet);
  c.fillStyle = g; c.fillText('Play', x0 + wa1, y0);
  c.restore();
}

function drawBoot(c, W, H, t){
  const u = Math.min(W / 1920, H / 1080);
  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  /* centre the pair and the name together: the mark is about 0.9 s wide and the name about 1.6 s */
  const s = 240 * u;
  drawMark(c, W / 2 - s * 0.95, H * 0.46, s, t);
}

/* The two squares as a little picture, for a corner or a title bar: an SVG (the same one the logo uses). */
export const mark = () => twoSquares('lm');

/* the name, for places that need it as plain words */
export const NAME_A = 'Orlis', NAME_B = 'Play', TAGLINE = 'Get up. Get together.';
