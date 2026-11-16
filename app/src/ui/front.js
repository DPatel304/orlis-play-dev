/* The front door's picture, behind signing in and "Who's playing?": the
   intro's cube, resting on the left with the name and the tagline under it,
   the four players' lights settled softly in the corners. It blinks, winks
   now and then, and breathes.

   Straight after the intro (glide), it starts where the intro left off - the
   cube in the middle - and glides over to the left; otherwise it fades in
   there. A window that's tall rather than wide has it at the top instead,
   the card under it (style.css matches). */
import { cube, wordmark, tagline, PAPER } from './boot.js';
import { PLAYER_COLORS } from '../tracking/pose.js';

const GLIDE = 1.0, FADE = 0.4, TAU = Math.PI * 2;
const cl = (v) => Math.max(0, Math.min(1, v));
const eio = (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const lerp = (a, b, k) => a + (b - a) * k;

function glow(c, x, y, r, col, a){
  if (r <= 0 || a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(243,244,247,0)');
  c.save(); c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
}

/* where everything rests: wide - on the left; tall - at the top */
export const tall = (W, H) => W / H < 1.25;
function rest(W, H, u){
  const m = Math.min(W, H);
  return tall(W, H) ? { cx: W / 2, cy: H * 0.13, s: m * 0.065, name: m * 0.055, tag: false }
                    : { cx: W * 0.3, cy: H * 0.4, s: 120 * u, name: 84 * u, tag: true };
}

export function frontScene({ glide = false } = {}){
  let t = 0, blinkAt = 3, blinks = 0, shut = 0, wink = 0;
  return {
    tick(dt){
      t += dt;
      /* a blink every few seconds; every third one's a wink */
      if (t >= blinkAt){ blinks++; if (blinks % 3 === 0) wink = 0.3; else shut = 0.13; blinkAt = t + 3.2 + ((blinks * 1.7) % 2.2); }
      shut = Math.max(0, shut - dt); wink = Math.max(0, wink - dt);
    },
    draw(c, W, H){
      const u = Math.min(W / 1920, H / 1080), to = rest(W, H, u);
      /* from the intro's last moment: the cube in the middle, big */
      const k = glide ? eio(cl(t / GLIDE)) : 1, a = glide ? 1 : cl(t / FADE);
      const from = { cx: W / 2, cy: H * 0.42, s: 185 * u, name: 96 * u };
      const cx = lerp(from.cx, to.cx, k), cy = lerp(from.cy, to.cy, k), s = lerp(from.s, to.s, k) * (1 + 0.015 * Math.sin(t * 3));
      const nameSize = lerp(from.name, to.name, k);
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      c.save(); c.globalAlpha = a;
      /* the lights, settling into the corners */
      const lit = glide ? cl((t - 0.3) / 0.9) : 1;
      [[0.1, 0.16], [0.9, 0.18], [0.12, 0.86], [0.88, 0.84]].forEach(([fx, fy], i) => glow(c, W * fx, H * fy, 260 * u, PLAYER_COLORS[i], 0.35 * lit));
      /* the intro's big soft halo, fading as it moves */
      glow(c, cx, cy, 620 * u * lerp(1, 0.55, k), 'rgba(147,197,253,.5)', lerp(1, 0.45, k));
      cube(c, cx, cy, s, { open: shut > 0 ? 0.05 : 1, winkR: wink > 0, smile: true });
      /* the four dots under the cube, as the intro left them - gone as it moves */
      const dots = 1 - cl(k * 2.5);
      if (dots > 0) PLAYER_COLORS.forEach((col, i) => { c.globalAlpha = a * dots; c.fillStyle = col; c.beginPath(); c.arc(cx + (-72 + i * 48) * u, cy + s * 1.42, 10 * u, 0, TAU); c.fill(); });
      c.globalAlpha = a;
      wordmark(c, cx, cy + s * 1.9 + lerp(0, 10, k) * u, nameSize);
      const tagA = to.tag ? 1 : 1 - k;
      if (tagA > 0) tagline(c, cx, cy + s * 1.9 + nameSize * 0.8, lerp(30, 26, k) * u, a * tagA);
      c.restore();
    }
  };
}
