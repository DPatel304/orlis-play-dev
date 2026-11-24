/* The turning wheel of things in Cubo's Create (decision 0060), as pure motion with no drawing.

   pos is where the wheel is, in things: thing i is at the top when pos is i. It turns slowly by itself (AUTO things a second); a swipe
   sets it spinning faster in the swipe's direction, and it settles back to the slow turn. With reduced motion it does not spin: it steps
   one thing every STEP_EVERY seconds, and a swipe steps it SWIPE_STEPS things. */
export const AUTO = 0.3;            /* things a second, on its own */
export const SPIN = 3.4;            /* things a second just after a swipe */
export const SETTLE = 1.1;          /* seconds for a swipe's speed to fade back (a time constant) */
export const STEP_EVERY = 2.4;      /* reduced motion: seconds between steps */
export const SWIPE_STEPS = 3;       /* reduced motion: things a swipe moves it on */
export const SHOWN = 8;             /* about how many things can be seen at once */
export const SPREAD = 26;           /* degrees between neighbours on the wheel */

export class Wheel {
  constructor(n = 1, reduced = false){ this.n = Math.max(1, n); this.pos = 0; this.vel = AUTO; this.reduced = reduced; this.wait = 0; }
  setSize(n){ this.n = Math.max(1, n); this.pos = ((this.pos % this.n) + this.n) % this.n; }
  /* which way a swipe turns it: swiping right turns the top of the wheel to the right, so things go right and pos goes down */
  kick(dir){
    if (!dir) return;
    if (this.reduced){ this.pos += -dir * SWIPE_STEPS; this.pos = Math.round(this.pos); this.wait = 0; }
    else this.vel = -dir * SPIN;
  }
  /* the remote: one thing along (dir -1 | 1: the next thing to the right is dir 1, so pos goes down) */
  nudge(dir){ this.pos = Math.round(this.pos) - dir; this.vel = AUTO; this.wait = 0; }
  step(dt){
    if (this.reduced){
      this.wait += dt;
      if (this.wait >= STEP_EVERY){ this.wait = 0; this.pos = Math.round(this.pos) + 1; }
      this.pos = Math.round(this.pos);
    } else {
      this.pos += this.vel * dt;
      this.vel += (AUTO - this.vel) * Math.min(1, dt / SETTLE);
    }
    this.pos = ((this.pos % this.n) + this.n) % this.n;
  }
  /* the thing at the top now (the nearest) */
  top(){ return Math.round(this.pos) % this.n; }
  /* every thing's place: angle in degrees from the top (negative left, positive right), nearest first wrapping, for the ones in view */
  placed(){
    const out = [];
    for (let i = 0; i < this.n; i++){
      let d = i - this.pos;
      d = ((d % this.n) + this.n) % this.n; if (d > this.n / 2) d -= this.n;
      const a = d === 0 ? 0 : -d * SPREAD;
      if (Math.abs(a) <= (SHOWN / 2 + 0.5) * SPREAD) out.push({ i, angle: a });
    }
    return out;
  }
}
