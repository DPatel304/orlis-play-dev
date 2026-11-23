/* The front door's picture, behind signing in and "Who's playing?" (decision 0045): a painted game world, softly blurred and dimmed,
   so the white card or the big faces sit on something alive. The logo (top left, a DOM element on the account screen) does the
   rest. Straight after the intro (glide), the world fades in over the paper the intro ended on.

   The world is made once and kept: a game's wide art, blurred on a small canvas (cheap to draw every frame). */
import { makeCover } from './covers.js';
import { tok } from './brand.js';
import { color } from '../games/assets/palette.js';

const FADE = 0.5;
const cl = (v) => Math.max(0, Math.min(1, v));
let blurred = null;
function world(){
  if (blurred !== null) return blurred || null;
  blurred = false;
  if (typeof document === 'undefined') return null;
  try {
    const made = makeCover({ id: 'pop-party', name: 'Pop Party' }, { w: 640, h: 360 });
    if (!made) return null;
    const k = document.createElement('canvas'); k.width = 640; k.height = 360;
    const c = k.getContext('2d');
    c.filter = 'blur(14px) saturate(1.1)';
    c.drawImage(made.art, -40, -24, 720, 408);            /* (a little over, so the blur's soft edge is off screen) */
    c.filter = 'none';
    blurred = k;
  } catch { blurred = false; }
  return blurred || null;
}

export function frontScene({ glide = false } = {}){
  let t = 0;
  return {
    tick(dt){ t += dt; },
    draw(c, W, H){
      c.fillStyle = tok('--paper', color('earth.snow')); c.fillRect(0, 0, W, H);
      const w = world(); if (!w) return;
      const a = glide ? cl(t / FADE) : 1;
      c.save(); c.globalAlpha = a;
      const k = Math.max(W / w.width, H / w.height);
      c.drawImage(w, (W - w.width * k) / 2, (H - w.height * k) / 2, w.width * k, w.height * k);
      c.fillStyle = tok('--ink', color('shade.ink')); c.globalAlpha = a * 0.4; c.fillRect(0, 0, W, H);
      c.restore();
    }
  };
}
