/* The big blocks of Stack It High and the little physics they live by.

   No physics engine: every block is a shape with a flat or gently curved top, and the whole world is one row of things standing on
   the ground. Positions are in "H": X across the picture in picture heights (x of the width * the aspect), Y down it as a fraction of
   the height, so a block is the same size on any screen and the numbers are the same in a test as on the TV.

   The rules (kept this small on purpose, so a child can read them off the screen):
   - A block that is let go, or dropped from the sky, falls straight down and stops on the highest thing under its feet: the ground
     or the top of another block. (Its feet are a row of points along its bottom; an arch's are its two legs, with the doorway clear.)
   - It stays if its middle is over what it touches (give or take a hand). If its middle hangs beyond that, it tips and slides off
     gently, and falls the rest of the way down beside it.
   - Nothing ever moves on its own once it is standing, so a building never collapses: a block with something on it can't be lifted,
     and one with something on it never fades away. */

export const GROUND = 0.93;
/* gravity and the fastest a block falls (picture heights a second): slow and heavy */
export const GRAVITY = 0.55, FALL_MAX = 0.5;
/* how fast a block slides off an edge, how far over an edge its middle may hang and still stay (a hand's width), the gap between
   the points along a block's bottom, and how close to the lowest of them still counts as touching */
export const SLIDE = 0.14, HANG = 0.02, STEP = 0.015, TOUCH = 0.004;
/* how long a block takes to fade away (seconds) */
export const FADE_SECS = 1.4;

/* The shapes. w, h: the size in picture heights (a cube is about a sixth of the screen); rect: a plain box (it can be turned on its
   side); hole: the radius of an arch's doorway; col: its paint (palette names, never raw colours). */
export const SHAPES = {
  cube:   { w: 0.167, h: 0.167, rect: true, col: 'touch.lagoon' },
  plank:  { w: 0.50, h: 0.075, rect: true, col: 'touch.sunflower' },
  pillar: { w: 0.085, h: 0.22, rect: true, col: 'touch.bubblegum' },
  roof:   { w: 0.30, h: 0.15, col: 'touch.cherry' },
  arch:   { w: 0.30, h: 0.17, hole: 0.075, col: 'touch.grape' },
  dome:   { w: 0.26, h: 0.13, col: 'touch.mint' }
};
export const SHAPE_NAMES = Object.keys(SHAPES);
/* the paints a block may wear: the one of its shape most of the time, another now and then so a heap is not one colour each */
export const PAINTS = ['touch.lagoon', 'touch.sunflower', 'touch.bubblegum', 'touch.cherry', 'touch.grape', 'touch.mint', 'touch.tangerine', 'touch.skyBlue'];

/* how high the block's top is (above its bottom) at `dx` from its middle */
export function topH(b, dx){
  const a = Math.abs(dx);
  if (a > b.w / 2) return 0;
  if (b.kind === 'roof'){ const t = Math.max(0, (a - 0.02) / (b.w / 2 - 0.02)); return b.h * (1 - t); }
  if (b.kind === 'dome'){ const r = b.w / 2; return b.h * Math.sqrt(Math.max(0, 1 - (dx / r) * (dx / r))); }
  return b.h;
}
/* how far above its bottom a point of the block's underside is at `dx` (an arch's doorway; all else is flat) */
export function liftAt(b, dx){
  const r = SHAPES[b.kind].hole;
  return r && Math.abs(dx) < r ? Math.sqrt(r * r - dx * dx) : 0;
}

export class Yard {
  constructor(aspect = 16 / 9){
    this.A = aspect;
    this.blocks = [];
    this.nextId = 1;
  }

  /* a new block, by default up in the sky above X, about to fall */
  add(kind, X, Y = null, opt = {}){
    const s = SHAPES[kind];
    const b = { id: this.nextId++, kind, w: s.w, h: s.h, q: 0, X, Y: Y == null ? -s.h : Y, vy: 0, state: 'fall', col: opt.col || s.col, mark: opt.mark || 'dot',
      supports: [], held: null, age: 0, touched: 0, fade: 0, dir: 0, ang: 0, spin: 0, wob: 0, wobV: 0, nx: 0, ph: Math.random() * 6.28, from: null, by: -1, pend: null, used: false, sky: false, spinAng: 0, tapped: 0, ...opt.extra };
    this.blocks.push(b);
    return b;
  }

  /* the points along a block's bottom */
  feet(b){
    const n = Math.max(1, Math.ceil(b.w / STEP)), out = [];
    for (let k = 0; k <= n; k++){ const dx = -b.w / 2 + b.w * k / n; out.push([dx, liftAt(b, dx)]); }
    return out;
  }
  /* the highest thing at X: { y, id } (id 0 is the ground). A block that is held, falling, sliding or fading is not a thing to stand on. */
  surface(X, skip = null){
    let y = GROUND, id = 0;
    for (const c of this.blocks){
      if (c === skip || c.state !== 'rest' || c.fade) continue;
      const dx = X - c.X;
      if (Math.abs(dx) > c.w / 2) continue;
      const ty = c.Y + c.h / 2 - topH(c, dx);
      if (ty < y){ y = ty; id = c.id; }
    }
    return { y, id };
  }
  /* where the bottom of block b would come to rest if it were over X: { bottom, minDx, maxDx, ids, stable, dir } */
  land(b, X = b.X){
    let bottom = Infinity;
    const at = this.feet(b).map(([dx, lift]) => { const s = this.surface(X + dx, b); return { dx, y: s.y + lift, id: s.id }; });
    for (const f of at) if (f.y < bottom) bottom = f.y;
    const touch = at.filter(f => f.y <= bottom + TOUCH);
    const minDx = Math.min(...touch.map(f => f.dx)), maxDx = Math.max(...touch.map(f => f.dx));
    const stable = minDx <= HANG && maxDx >= -HANG;
    return { bottom, minDx, maxDx, ids: [...new Set(touch.map(f => f.id))], stable, dir: stable ? 0 : (minDx > HANG ? -1 : 1) };
  }

  /* which blocks stand on this one, how many blocks high it is (a block on the ground is 1), and whether it can be lifted */
  dependents(b){ return this.blocks.filter(c => c !== b && (c.state === 'rest' || c.state === 'slide') && c.supports.includes(b.id)); }
  level(b, seen = 0){
    if (b.state !== 'rest' && b.state !== 'slide' || seen > 40) return 0;
    let top = 0;
    for (const id of b.supports){ const s = this.byId(id); if (s) top = Math.max(top, this.level(s, seen + 1)); }
    return top + 1;
  }
  byId(id){ return this.blocks.find(c => c.id === id) || null; }
  tallest(){ let m = 0; for (const b of this.blocks) if (b.state === 'rest' && !b.fade) m = Math.max(m, this.level(b)); return m; }
  liftable(b){ return b.state === 'rest' && !b.held && !b.fade && this.dependents(b).length === 0; }

  /* turn a plain box a quarter turn (a cube looks the same; a plank stands up) */
  turn(b, dir = 1){
    if (!SHAPES[b.kind].rect) return false;
    b.q = (b.q + (dir < 0 ? 3 : 1)) % 4; [b.w, b.h] = [b.h, b.w];
    return true;
  }

  /* pick a block up (it leaves what it was standing on) and put it down (it falls from where it is) */
  lift(b, who){
    b.held = who; b.state = 'held'; b.supports = []; b.vy = 0; b.dir = 0; b.from = { X: b.X, Y: b.Y }; b.by = who; b.touched = 1;
  }
  drop(b){
    b.held = null; b.state = 'fall'; b.vy = 0.1;
    const l = this.land(b);
    if (b.Y + b.h / 2 > l.bottom) b.Y = l.bottom - b.h / 2;        /* (it was pushed into something: it sits on top of it) */
  }

  /* one step for everything not held. Returns what happened: [{ type: 'land', b, speed }, ...] */
  step(dt){
    const events = [];
    for (const b of this.blocks){
      b.age += dt;
      if (b.fade){ b.fade += dt / FADE_SECS; continue; }
      if (b.state === 'fall'){
        b.vy = Math.min(FALL_MAX, b.vy + GRAVITY * dt);
        const l = this.land(b), bottom = b.Y + b.h / 2, next = bottom + b.vy * dt;
        if (next >= l.bottom){
          const speed = b.vy;
          b.Y = l.bottom - b.h / 2; b.vy = 0;
          b.supports = l.ids.filter(id => id !== 0);
          if (l.stable){ b.state = 'rest'; b.dir = 0; } else { b.state = 'slide'; b.dir = l.dir; b.spin = 0; }
          events.push({ type: 'land', b, speed, stable: l.stable });
        } else b.Y = next - b.h / 2;
      } else if (b.state === 'slide'){
        b.spin = Math.min(1, b.spin + dt * 1.2);
        const v = SLIDE * Math.min(1, 0.25 + b.spin);
        b.X += b.dir * v * dt;
        const edge = b.w / 2 + 0.02;
        if (b.X < edge || b.X > this.A - edge){ b.X = Math.min(this.A - edge, Math.max(edge, b.X)); b.state = 'rest'; b.dir = 0; events.push({ type: 'land', b, speed: 0, stable: true }); continue; }
        const l = this.land(b), bottom = b.Y + b.h / 2;
        if (l.bottom > bottom + 0.02){ b.state = 'fall'; b.vy = 0.12; b.supports = []; }      /* clear of it: down it goes */
        else { b.Y = l.bottom - b.h / 2; b.supports = l.ids.filter(id => id !== 0); }
      } else if (b.state === 'rest'){
        b.touched = Math.max(0, b.touched - dt * 0.05);
      }
    }
    this.blocks = this.blocks.filter(b => b.fade < 1);
    return events;
  }

  /* stop a block that is held from going down into what it hangs over (it rides on top, easing up, not jumping) */
  rideOn(b, dt){
    const l = this.land(b), bottom = b.Y + b.h / 2;
    if (bottom > l.bottom) b.Y += (l.bottom - bottom) * Math.min(1, dt * 12);
    if (b.Y + b.h / 2 > GROUND) b.Y = GROUND - b.h / 2;
  }

  /* start a block fading (it stops being a thing to stand on at once) */
  fadeOut(b){ if (!b.fade){ b.fade = 1e-6; b.supports = []; } }
  /* the oldest block that nobody is using: loose on the ground (not part of a building), nothing on it, not held. null if none. */
  idle(){
    let best = null;
    for (const b of this.blocks){
      if (b.state !== 'rest' || b.fade || b.held || b.touched > 0.5) continue;
      if (b.supports.length) continue;
      if (this.dependents(b).length) continue;
      if (!best || b.age > best.age) best = b;
    }
    return best;
  }
  /* how many are there, not counting the fading */
  count(){ return this.blocks.filter(b => !b.fade).length; }
}
