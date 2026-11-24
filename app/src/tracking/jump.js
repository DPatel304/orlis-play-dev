/* Jumping, for the games that want it: Moon Bounce floats you up when you
   jump, and Snow Sled flies off its ramps.

   A jump is the middle of the body rising quickly above where it has been
   standing. "Where it has been standing" follows the body slowly while it is
   on the ground, so walking about, leaning or crouching shifts it without
   counting; a jump is too quick for it to follow. Distances are measured in
   body sizes (pose's `scale`), so a small child near the camera and a tall
   one further back jump the same.

   Once a jump has counted, that player has to come back down near their
   standing height before another can, so one jump is one jump however much
   they wriggle in the air.

   The camera's smoothing rounds a hop off: a 15 cm hop by a child reaches
   only a 10th of a body size in the smoothed picture, and the quickest
   rise (the take-off) comes a few frames BEFORE the highest point. So a
   jump is a rise and a speed that each happened within the last WINDOW
   seconds - not in one and the same frame - and the body size they are
   measured in is the player's standing size (their biggest torso lately),
   so crouching or bending, which shrink the torso in the picture, never
   make the same movement look bigger.

   A game can ask for a lighter touch - a smaller, slower rise - where a
   jump that isn't meant does no harm. It can also ask for the feet to
   leave the floor too: getting up from a crouch lifts the body as quickly
   as a jump does, but the feet stay where they are. (Where the feet can't
   be seen, the body alone decides.) */
import { L } from './pose.js';

export const RISE = 0.1;    /* body sizes above standing height */
export const SPEED = 0.6;   /* body sizes per second, upward */
/* The lighter touch for hops (Animal Gym, Leaf Pile, Save the Harvest): a child's 15 cm hop and a grown-up's 18 cm one count. */
export const HOP = { rise: 0.04, speed: 0.3, feet: true };
/* A body whose torso is changing size - bending over or straightening up, walking toward the camera or away from it - is not hopping: a
   hop doesn't change the torso. While it has changed by more than SHAPE from where it was a moment ago (and for SETTLE seconds after),
   nothing counts: rising out of a bend, or the whole body sliding up the picture as it backs off, is not a hop. */
const SHAPE = 0.08;
const SETTLE = 0.8;
const WINDOW = 0.35;        /* seconds within which the quick rise and the height must both have happened */
const UNIT_DOWN = 0.1;      /* how fast the body-size unit shrinks when the torso looks smaller, per second */
const FOLLOW = 0.7;         /* how fast standing height follows, per second */
/* ...but only slowly downward, so after a crouch or a squat, standing up
   again is back to standing height, not a jump above it. */
const FOLLOW_DOWN = 0.05;
const SLOW = 0.3;           /* body sizes a second: slower than this, standing height follows the body; quicker, it stays put */
const LANDED = 0.04;        /* body sizes from standing height that count as down again */
/* With feet: how much of the body's rise the ankles must rise too. */
const FEET = 0.5;
const FEET_FOLLOW = 0.5;      /* the floor follows the ankles slower still, or a hop would carry it up with it */
/* Asked to watch the feet but they can't be seen (a child up close, legs behind a table): the body alone decides, but a squat's
   stand-up looks just like a small hop to it, so it has to be this much bigger and quicker. */
const BLIND = 1.8;

/* Where player p's feet are: the middle of their ankles, if both are seen. */
function feetOf(p){
  const lm = p.lm, a = lm && lm[L.L_ANKLE], b = lm && lm[L.R_ANKLE];
  if (!a || !b || (a.v ?? 1) < 0.6 || (b.v ?? 1) < 0.6) return null;
  return (a.y + b.y) / 2;
}

export class JumpWatch {
  constructor({ rise = RISE, speed = SPEED, feet = false } = {}){
    this.rise = rise; this.speed = speed; this.feet = feet;
    this.base = []; this.last = []; this.up = []; this.floor = []; this.unit = []; this.sinceRise = []; this.sinceFast = []; this.shape = []; this.unsure = [];
  }

  /* players: pose.players, n: how many are playing. Returns the list of
     players who jumped this step. */
  step(dt, players, n = players.length){
    const out = [];
    for (let i = 0; i < n; i++){
      const p = players[i];
      if (!p || !p.present || !p.centre){ this.base[i] = this.last[i] = this.floor[i] = this.unit[i] = this.shape[i] = null; this.up[i] = false; continue; }
      const y = p.centre.y, sc = p.scale || 0.3;
      if (this.base[i] == null){ this.base[i] = this.last[i] = y; this.unit[i] = this.shape[i] = sc; this.unsure[i] = 0; this.sinceRise[i] = this.sinceFast[i] = 9; continue; }
      /* the body-size unit: their standing size, up at once, down slowly */
      const u0 = this.unit[i], s = this.unit[i] = sc > u0 ? sc : u0 + (sc - u0) * Math.min(1, dt * UNIT_DOWN);
      /* is the torso changing size? */
      const sh = this.shape[i] += (sc - this.shape[i]) * Math.min(1, dt / 0.6);
      this.unsure[i] = Math.abs(sc / sh - 1) > SHAPE ? SETTLE : Math.max(0, this.unsure[i] - dt);
      const rise = (this.base[i] - y) / s, speed = (this.last[i] - y) / s / Math.max(dt, 1e-3);
      this.last[i] = y;
      if (this.up[i]){
        if (rise < LANDED) this.up[i] = false;
        continue;
      }
      /* The floor: where the feet are while standing. */
      const f = this.feet ? feetOf(p) : null;
      if (f == null) this.floor[i] = null;
      else if (this.floor[i] == null) this.floor[i] = f;
      const lifted = f == null || this.floor[i] == null || (this.floor[i] - f) / s > this.rise * FEET;
      const k = this.feet && f == null ? BLIND : 1, need = this.rise * k;
      this.sinceRise[i] = rise > need ? 0 : this.sinceRise[i] + dt;
      this.sinceFast[i] = speed > this.speed * k ? 0 : this.sinceFast[i] + dt;
      if (this.sinceRise[i] < WINDOW && this.sinceFast[i] < WINDOW && rise > need * 0.5 && lifted && this.unsure[i] <= 0){ this.up[i] = true; this.sinceRise[i] = this.sinceFast[i] = 9; out.push(i); continue; }
      /* standing height drifts with a slow change only: a quick move (down into a squat, up out of it, a hop) leaves it where it was */
      if (Math.abs(speed) < SLOW) this.base[i] += (y - this.base[i]) * Math.min(1, dt * (y > this.base[i] ? FOLLOW_DOWN : FOLLOW));
      if (f != null) this.floor[i] += (f - this.floor[i]) * Math.min(1, dt * FEET_FOLLOW);
    }
    return out;
  }
}
