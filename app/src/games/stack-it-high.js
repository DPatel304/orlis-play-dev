/* Stack It High: a building sandbox. Big, heavy painted blocks - a cube, a long plank, a pillar, a roof, an arch, a dome - drop in
   from the sky, one every so often, slowly and with a soft thud and a puff of dust, and rest on the ground or on whatever they
   land on. Nobody wins and nothing is "finished": build whatever you like, together, on one shared ground.

   A block is too big for one hand. Put both hands on it - one each side - and hold for a moment: it glows in your colour, and
   then it follows the middle of your hands, heavy and smooth, with a little lag and sway. Tilt your hands (one higher than the
   other) and a plank or a cube turns a quarter turn. Let go by moving your hands apart, dropping them, or pressing down once it
   sits on something. One hand only wobbles a block and nudges it a little, so you can tell it needs two; a block somebody has
   hold of can't be taken, and one with something on it stays put, so a building never falls down. With a mouse, a click picks a
   block up and a click puts it down.

   The ground rules are in stack-blocks.js (a block lands straight down on the highest thing under it, and tips gently off an
   edge if its middle is over thin air). Each player's number is the blocks they have set down somewhere new; at the end the
   camera pans across what everyone built and the results say how many blocks tall the tallest thing was.
   First person: the players are their hands. */
import { color, alpha } from './assets/palette.js';
import { Juice, fxState } from './common.js';
import { reaches } from './reach.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';
import { Yard, SHAPES, SHAPE_NAMES, PAINTS, GROUND, topH, liftAt, FADE_SECS } from './stack-blocks.js';

export const ROUND = 180;
/* both hands must stay on a block this long (seconds) before it is yours; a hand counts as on it within NEAR (picture heights) of its edge */
export const GRAB_SECS = 0.3, NEAR = 0.05;
/* hands further apart than the block's width plus this let it go; a hand this far below the block's bottom has dropped it; hands
   pressing down this far below the middle of a block that already sits on something set it down */
export const LET_GO = 0.14, DROPPED = 0.02, PRESS = 0.05;
/* how stiffly a held block follows the middle of the hands (the higher, the quicker; it is a heavy block, so not very) */
const FOLLOW = 9;
/* the hands tilted this much (radians) for this long (seconds) turn a plain block a quarter turn */
const TILT = 0.5, TILT_SECS = 0.35;
/* how many blocks there can be at most (more people, a bit more), how many that nobody has touched yet may lie about, and how long
   (seconds) between new ones (the first few come quicker) */
export const capFor = (n) => 10 + 2 * Math.max(1, n);
const UNUSED = (n) => 2 + Math.max(1, n);
const EVERY = [4.5, 6.5], FIRST = 1.6, STARTERS = 3;
/* a held block may not go quicker than this (picture heights a second): it is heavy */
const HEAVY = 1.6;

export default {
  id: 'stack-it-high', unit: 'blocks', name: 'Stack It High', stars: 1, accent: color('touch.lagoon'), secs: ROUND,
  moves: ['lift'],
  create(n){ return new StackItHigh(n); }
};

class StackItHigh {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);          /* blocks each player has put down somewhere new */
    this.yard = new Yard();
    this.A = 16 / 9;
    this.reach = reaches(MAX_PLAYERS);
    this.hold = Array.from({ length: MAX_PLAYERS }, () => null);        /* what each player carries: { id, tilt, armed, dropT, pressT, mouse } */
    this.pend = Array.from({ length: MAX_PLAYERS }, () => null);        /* what each is about to pick up: { id, t } */
    this.cool = Array.from({ length: MAX_PLAYERS }, () => 0);           /* a moment after letting go before the next grab */
    this.last = Array.from({ length: MAX_PLAYERS }, () => null);        /* each one's hands a frame ago, for how fast they move */
    this.clicks = 0;
    this.stacked = 0;          /* blocks put down, all together */
    this.peak = 0;             /* the most blocks high anything has stood */
    this.spawnT = FIRST; this.spawned = 0; this.bag = [];
    this.t = 0; this.over = false;
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
    this.fx = [];
    this.cam = null; this.out = null;
    this.first = false;
    this.say = { icon: 'block', text: 'Lift with both hands!', t: 0 };
  }

  get blocks(){ return this.yard.blocks; }
  _present(){ let n = 0; for (let i = 0; i < this.players; i++) if (pose.players[i] && pose.players[i].present) n++; return n; }

  /* each present player's hands, in picture heights across (X) and down (Y), the left one first: [{ i, lo, hi, mouse, spread }].
     Each hand also has v, how quick it is going (picture heights a second). */
  _hands(dt){
    const out = [], A = this.A;
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p || !p.present){ this.last[i] = null; continue; }
      const mouse = !!pose.mouse.active;
      const a = mouse ? { X: pose.mouse.x * A, Y: pose.mouse.y } : { X: p.hands.left.x * A, Y: p.hands.left.y };
      const b = mouse ? a : { X: p.hands.right.x * A, Y: p.hands.right.y };
      const was = this.last[i];
      a.v = was && dt > 0 ? Math.hypot(a.X - was[0].X, a.Y - was[0].Y) / dt : 0;
      b.v = b === a ? a.v : was && dt > 0 ? Math.hypot(b.X - was[1].X, b.Y - was[1].Y) / dt : 0;
      this.last[i] = [{ X: a.X, Y: a.Y }, { X: b.X, Y: b.Y }];
      const [lo, hi] = a.X <= b.X ? [a, b] : [b, a];
      out.push({ i, lo, hi, mouse, spread: hi.X - lo.X });
    }
    return out;
  }

  /* is this hand on (or just beside) the block? */
  _near(h, b, m = NEAR){ return Math.abs(h.X - b.X) <= b.w / 2 + m && Math.abs(h.Y - b.Y) <= b.h / 2 + m; }
  /* both hands on it, one each side of its middle */
  _both(hd, b){ return !hd.mouse && this._near(hd.lo, b) && this._near(hd.hi, b) && hd.lo.X <= b.X && hd.hi.X >= b.X; }

  step(dt, W, H){
    if (this.out) return;
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    this.A = W / H; this.yard.A = this.A;
    const hands = this._hands(dt);
    for (const hd of hands) this.reach[hd.i].step(dt, pose.players[hd.i], pose.mouse.active);
    for (let i = 0; i < MAX_PLAYERS; i++) this.cool[i] = Math.max(0, this.cool[i] - dt);

    this._carry(dt, hands);
    this._grab(dt, hands);
    this._touch(dt, hands);
    this._spawn(dt);
    this._after(this.yard.step(dt));
    this._tidy(dt);
    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND) * 0.6, storm: false, wind: 0.004, joy: Math.min(1, this.peak / 6), look: 0.5, rainbow: false });
    /* the blocks a pair of hands can lift: the drawn hand leans a little toward one close by (a short reach, as it takes both hands) */
    this.avatars.targets(this._pickable().map(b => ({ x: b.X / this.A, y: b.Y, r: Math.max(b.w, b.h) / 2, reach: Math.max(b.w, b.h) / 2 + 0.04 })));
    this.avatars.step(dt, this.players);
  }

  /* ---------- picking up ---------- */
  _grab(dt, hands){
    for (const b of this.blocks) b.pend = null;
    const click = pose.mouse.active ? (pose.mouse.clicks || 0) : 0, clicked = click !== this.clicks; this.clicks = click;
    for (const hd of hands){
      const i = hd.i;
      if (this.hold[i] || this.cool[i] > 0){ this.pend[i] = null; continue; }
      if (hd.mouse){
        /* a click on a block picks it up (the mouse is the testing and no-camera way) */
        if (!clicked) continue;
        const b = this._pickable().filter(c => this._near(hd.lo, c, 0.03)).sort((p, q) => Math.hypot(p.X - hd.lo.X, p.Y - hd.lo.Y) - Math.hypot(q.X - hd.lo.X, q.Y - hd.lo.Y))[0];
        if (b) this._take(b, i, true);
        continue;
      }
      /* the nearest block both hands are on, that is free to lift */
      const b = this._pickable().filter(c => this._both(hd, c)).sort((p, q) => Math.hypot(p.X - (hd.lo.X + hd.hi.X) / 2, p.Y - (hd.lo.Y + hd.hi.Y) / 2) - Math.hypot(q.X - (hd.lo.X + hd.hi.X) / 2, q.Y - (hd.lo.Y + hd.hi.Y) / 2))[0];
      const pend = this.pend[i];
      if (!b){ this.pend[i] = null; continue; }
      if (!pend || pend.id !== b.id) this.pend[i] = { id: b.id, t: 0 };
      this.pend[i].t += dt;
      b.pend = { who: i, p: Math.min(1, this.pend[i].t / GRAB_SECS) };
      if (this.pend[i].t >= GRAB_SECS){ this.pend[i] = null; this._take(b, i, false); }
    }
  }
  /* the blocks anyone may lift: standing still, free on top, not fading */
  _pickable(){ return this.blocks.filter(b => this.yard.liftable(b)); }
  _take(b, i, mouse){
    this.yard.lift(b, i); b.used = true;
    this.avatars.hit(b.X / this.A, b.Y, i);
    this.hold[i] = { id: b.id, tilt: 0, tiltT: 0, armed: true, dropT: 0, pressT: 0, mouse, vx: 0, vy: 0 };
    this.pend[i] = null; b.pend = null;
    b.wob = Math.max(b.wob, 0.06);
    sfx.pick?.();
    if (!this.first){ this.first = true; this.say = { icon: 'block', text: 'Hands apart to drop!', t: 0 }; }
  }

  /* ---------- carrying ---------- */
  _carry(dt, hands){
    const A = this.A, byI = new Map(hands.map(h => [h.i, h]));
    for (let i = 0; i < MAX_PLAYERS; i++){
      const hold = this.hold[i];
      if (!hold) continue;
      const b = this.yard.byId(hold.id), hd = byI.get(i);
      if (!b || b.held !== i){ this.hold[i] = null; continue; }
      if (!hd){ this._let(i, b); continue; }        /* the player has gone: it falls */
      if (hd.mouse){
        if ((pose.mouse.clicks || 0) !== this.clicks){ this._let(i, b); this.clicks = pose.mouse.clicks || 0; continue; }
      } else {
        /* let go: hands apart, dropped, or pressed down on something */
        const mid = (hd.lo.Y + hd.hi.Y) / 2, high = Math.min(hd.lo.Y, hd.hi.Y);       /* (the higher of the two: a tilt has one hand low) */
        const resting = b.Y + b.h / 2 >= this.yard.land(b).bottom - 0.004;
        hold.dropT = high > b.Y + b.h / 2 + DROPPED ? hold.dropT + dt : 0;
        hold.pressT = resting && mid > b.Y + PRESS ? hold.pressT + dt : 0;
        if (hd.spread > b.w + LET_GO || hold.dropT > 0.15 || hold.pressT > 0.2){ this._let(i, b); continue; }
        /* tilted hands turn it */
        const tilt = Math.atan2(hd.hi.Y - hd.lo.Y, Math.max(0.05, hd.spread));
        if (Math.abs(tilt) < TILT * 0.4){ hold.armed = true; hold.tiltT = 0; }
        else if (hold.armed && Math.abs(tilt) > TILT){
          hold.tiltT += dt;
          if (hold.tiltT > TILT_SECS){ hold.armed = false; hold.tiltT = 0; if (this.yard.turn(b, tilt)){ b.spinAng = tilt > 0 ? -Math.PI / 2 : Math.PI / 2; sfx.pat?.(); } }
        } else hold.tiltT = 0;
      }
      /* it follows the middle of the hands, heavy: a spring with no bounce, and not faster than something this big can go */
      const tx = hd.mouse ? hd.lo.X : (hd.lo.X + hd.hi.X) / 2, ty = hd.mouse ? hd.lo.Y : (hd.lo.Y + hd.hi.Y) / 2;
      hold.vx += (FOLLOW * FOLLOW * (tx - b.X) - 2 * FOLLOW * hold.vx) * dt; hold.vy += (FOLLOW * FOLLOW * (ty - b.Y) - 2 * FOLLOW * hold.vy) * dt;
      const sp = Math.hypot(hold.vx, hold.vy);
      if (sp > HEAVY){ hold.vx *= HEAVY / sp; hold.vy *= HEAVY / sp; }
      b.X += hold.vx * dt; b.Y += hold.vy * dt;
      b.X = Math.min(A - b.w / 2, Math.max(b.w / 2, b.X)); b.Y = Math.max(b.h / 2 - 0.02, b.Y);
      this.yard.rideOn(b, dt);
      /* a little sway, the way a heavy thing swings when it is carried */
      b.ang += ((Math.max(-0.16, Math.min(0.16, hold.vx * 0.25)) + Math.sin(this.t * 2.3 + b.ph) * 0.02) - b.ang) * Math.min(1, dt * 6);
    }
  }
  _let(i, b){
    this.yard.drop(b); this.hold[i] = null; this.cool[i] = 0.8;
    b.ang *= 0.5;
    sfx.whoosh?.();
  }

  /* ---------- one hand only: a block just wobbles and shuffles a little, then settles back where it was ---------- */
  _touch(dt, hands){
    for (const b of this.blocks){
      b.wobV += -b.wob * 90 * dt - b.wobV * 4 * dt; b.wob += b.wobV * dt;
      if (Math.abs(b.wob) < 1e-4 && Math.abs(b.wobV) < 1e-3){ b.wob = 0; b.wobV = 0; }
      b.nx -= b.nx * Math.min(1, dt * 5);
      if (b.spinAng){ b.spinAng -= b.spinAng * Math.min(1, dt * 9); if (Math.abs(b.spinAng) < 0.002) b.spinAng = 0; }
      if (b.state === 'rest' || b.state === 'held'){ if (b.state === 'rest') b.ang -= b.ang * Math.min(1, dt * 5); }
    }
    for (const hd of hands){
      if (hd.mouse) continue;
      for (const b of this.blocks){
        if (b.state !== 'rest' && b.state !== 'held' || b.held === hd.i) continue;
        const lo = this._near(hd.lo, b, 0.02), hi = this._near(hd.hi, b, 0.02);
        if (!lo && !hi) continue;
        const h = lo && hi ? (hd.lo.v > hd.hi.v ? hd.lo : hd.hi) : lo ? hd.lo : hd.hi;
        if (h.v < 0.12) continue;
        b.wobV += Math.min(1.2, h.v * 0.5) * dt * 14 * (h.X < b.X ? 1 : -1); b.wob = Math.max(-0.12, Math.min(0.12, b.wob));
        b.nx = Math.max(-0.02, Math.min(0.02, b.nx + (h.X < b.X ? 1 : -1) * Math.min(0.01, h.v * dt * 0.12)));
        if (!b.tapped || this.t - b.tapped > 0.4){ b.tapped = this.t; sfx.pat?.(); }
      }
    }
  }

  /* ---------- the sky ---------- */
  _spawn(dt){
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const y = this.yard, n = this._present();
    if (!n){ this.spawnT = 0.5; return; }
    /* too many: an old one nobody is using fades away to make room (one that has something on it never does) */
    if (y.count() >= capFor(n)){ const old = y.idle(); if (old) y.fadeOut(old); this.spawnT = old ? 0.4 : 1; return; }
    const sky = this.blocks.filter(b => b.sky && b.state === 'fall' && !b.fade);
    const unused = this.blocks.filter(b => !b.used && !b.fade).length;
    if (sky.length >= 2 || unused >= UNUSED(n)){ this.spawnT = 0.6; return; }
    if (!this.bag.length) this.bag = shuffled(SHAPE_NAMES, Math.random);
    const kind = this.bag.pop(), s = SHAPES[kind], A = this.A;
    /* where it can come down: somewhere a child can still get both hands on it, and where it will stay put */
    let low = 0.2; for (let i = 0; i < this.players; i++) if (pose.players[i] && pose.players[i].present) low = Math.max(low, this.reach[i].top);
    const anchors = []; for (let i = 0; i < this.players; i++) if (pose.players[i] && pose.players[i].present) anchors.push(pose.mouse.active ? A * 0.5 : this.reach[i].x * A);
    let best = null;
    for (let k = 0; k < 14; k++){
      const a = anchors[(Math.random() * anchors.length) | 0] ?? A / 2;
      const X = Math.min(A - s.w / 2 - 0.06, Math.max(s.w / 2 + 0.06, a + (Math.random() - 0.5) * 0.9));
      const l = y.land({ kind, w: s.w, h: s.h, X }, X);
      if (!l.stable || l.bottom - s.h < low + 0.02) continue;
      if (sky.some(o => Math.abs(o.X - X) < (o.w + s.w) / 2 + 0.1)) continue;
      const score = (l.bottom < GROUND - 0.01 ? 0.5 : 0) + Math.random() * 0.4 + (this.blocks.some(o => !o.used && Math.abs(o.X - X) < 0.3) ? 0.3 : 0);
      if (!best || score < best.score) best = { X, score };
    }
    if (!best){ this.bag.push(kind); this.spawnT = 0.7; const old = y.idle(); if (old) y.fadeOut(old); return; }      /* (no room: the ground is full) */
    const prev = this.lastCol, col = Math.random() < 0.7 ? s.col : PAINTS[(Math.random() * PAINTS.length) | 0];
    const b = y.add(kind, best.X, null, { col: col === prev ? s.col : col, mark: ['star', 'heart', 'dot'][(Math.random() * 3) | 0], extra: { sky: true, used: false } });
    b.vy = 0.05; this.lastCol = b.col;
    this.spawned++;
    this.spawnT = this.spawned < STARTERS ? FIRST : (EVERY[0] + Math.random() * (EVERY[1] - EVERY[0])) / (1 + 0.2 * (n - 1));
  }

  /* a block came to rest */
  _after(events){
    for (const e of events){
      const b = e.b;
      if (e.speed > 0.2){
        sfx.thud?.(); this.j.kick(1.2 + e.speed * 2);
        const bottom = (b.Y + b.h / 2) * 1;
        for (let k = 0; k < 7; k++) this.fx.push({ X: b.X + (Math.random() - 0.5) * b.w, Y: bottom - 0.004, vx: (k % 2 ? 1 : -1) * (0.04 + Math.random() * 0.1), vy: -0.02 - Math.random() * 0.05, life: 0.7 + Math.random() * 0.4, age: 0, r: 0.012 + Math.random() * 0.012 });
        b.wob = Math.max(b.wob, 0.05 + e.speed * 0.1);
      }
      if (!e.stable) continue;
      /* put down by somebody, somewhere new: that is a block placed */
      if (b.from && b.by >= 0){
        if (Math.hypot(b.X - b.from.X, b.Y - b.from.Y) >= 0.1){ this.score[b.by]++; this.stacked++; this.avatars.hit(b.X / this.A, b.Y, b.by); }
        b.from = null; b.by = -1;
      }
      b.sky = false;
      const tall = this.yard.tallest();
      if (tall > this.peak){
        this.peak = tall;
        if (tall >= 3 && this._present() < 2) this.say = { icon: 'block', text: `${tall} blocks tall!`, t: 0 };
        if (tall >= 3) sfx.pop?.(0.6 + tall * 0.1);
      }
    }
  }
  _tidy(dt){
    for (const f of this.fx){ f.age += dt; f.X += f.vx * dt; f.Y += f.vy * dt; f.vx *= Math.pow(0.2, dt); }
    this.fx = this.fx.filter(f => f.age < f.life);
    /* a block that is held by a player who is gone, or any that has strayed out of the world, falls back in */
    for (const b of this.blocks) if (b.Y > 2 || b.X < -1 || b.X > this.A + 1) b.fade = Math.max(b.fade, 0.999);
  }

  /* ---------- the end: the camera pans across what was built ---------- */
  outro(dt, W, H){
    this.A = W / H; this.yard.A = this.A;
    if (!this.out){
      for (let i = 0; i < MAX_PLAYERS; i++){ const b = this.hold[i] && this.yard.byId(this.hold[i].id); if (b) this.yard.drop(b); this.hold[i] = null; this.pend[i] = null; }
      const built = this.blocks.filter(b => !b.fade);
      const lo = Math.min(...built.map(b => b.X - b.w / 2)), hi = Math.max(...built.map(b => b.X + b.w / 2));
      const Z = 1.5, vh = this.A / (2 * Z), mid = built.length ? (lo + hi) / 2 : this.A / 2;
      const c0 = Math.min(this.A - vh, Math.max(vh, lo + 0.15)), c1 = Math.min(this.A - vh, Math.max(vh, hi - 0.15));
      const pan = built.length && c1 - c0 > 0.15;
      const still = Math.min(this.A - vh, Math.max(vh, mid));
      this.out = { t: 0, Z, c0: pan ? c0 : still, c1: pan ? c1 : still, pan, built: built.length > 0 };
      this.say = { icon: 'block', text: built.length ? 'Look what you built!' : 'Nice try!', t: 0 };
    }
    const o = this.out; o.t += dt; this.t += dt;
    const IN = 0.9, PAN = o.pan ? 4.2 : 1.8, BACK = 0.9, end = o.built ? IN + PAN + BACK + 0.2 : 1.5;
    const ease = (k) => k * k * (3 - 2 * k), k = (v) => Math.min(1, Math.max(0, v));
    const zin = ease(k(o.t / IN)), zout = ease(k((o.t - IN - PAN) / BACK));
    const z = 1 + (o.Z - 1) * zin * (1 - zout);
    const cx = o.c0 + (o.c1 - o.c0) * ease(k((o.t - IN) / PAN));
    const centre = this.A / 2;
    this.cam = o.built ? { z, cx: centre + (cx - centre) * (1 - zout) } : null;
    this.yard.step(dt); this._tidy(dt);
    this.j.step(dt);
    this.scene.step(dt, { t: this.t, p: 0.65, storm: false, wind: 0.004, joy: 1, look: 0.5, rainbow: true });
    this.avatars.step(dt, this.players);
    for (const b of this.blocks) { b.wobV += -b.wob * 90 * dt - b.wobV * 4 * dt; b.wob += b.wobV * dt; }
    return o.t >= end;
  }

  /* ---------- drawing ---------- */
  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    c.save();
    if (this.cam){ const gy = GROUND * H; c.translate(W / 2, gy); c.scale(this.cam.z, this.cam.z); c.translate(-this.cam.cx * H, -gy); }
    this._world(c, W, H);
    c.restore();
    this.scene.drawFront(c, W, H);
    if (shook) c.restore();
    c.globalAlpha = 1;
    /* carried blocks go under the hand markers, so both hands stay in sight on either side */
    for (const b of this.blocks) if (b.held != null && !this.cam) drawPiece(c, b, H, this.t, b.held);
    this.avatars.drawMitts(c, W, H, this.players);
  }
  _world(c, W, H){
    const y = this.yard;
    /* where a block that is falling or carried would land: a faint shadow on what is under it */
    for (const b of this.blocks){
      if (b.fade || (b.state !== 'fall' && b.state !== 'held')) continue;
      const l = y.land(b), gap = l.bottom - (b.Y + b.h / 2), near = Math.max(0, 1 - gap / 0.7);
      c.fillStyle = alpha('shade.shadow', 0.1 + 0.12 * near);
      c.beginPath(); c.ellipse(b.X * H, l.bottom * H, b.w * H * 0.5 * (0.8 + 0.2 * near), H * 0.01 * (0.6 + near * 0.6), 0, 0, 6.2832); c.fill();
    }
    for (const b of this.blocks) if (b.held == null || this.cam){
      /* a hand near a block that can be lifted: it grows up to 8% and glows */
      const k = !this.cam && b.held == null && this.yard.liftable(b) ? this.avatars.near(b.X / this.A, b.Y, Math.max(b.w, b.h) / 2) : 0;
      drawPiece(c, b, H, this.t, b.held, k);
    }
    for (const f of fxState.hidden ? [] : this.fx){
      c.globalAlpha = 0.5 * (1 - f.age / f.life); c.fillStyle = color('earth.sand');
      c.beginPath(); c.arc(f.X * H, f.Y * H, H * f.r * (1 + f.age * 2.2), 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* the move card: both arms lifting, for the first few seconds */
  card(){ return this.t < 8 ? 'lift' : null; }
  hud(){ return { score: this.score, showLives: false, words: this.say }; }
  /* lifting a block with both arms is how you play; Back on the remote pauses */
  pausable(){ return false; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  /* nobody wins a sandbox: with company it is a tie (everyone built it together) */
  winner(){
    let played = 0;
    for (let i = 0; i < this.players; i++) if (this.score[i] > 0 || pose.players[i].present) played++;
    return played < 2 ? null : -1;
  }
  /* what you made, in a line or two */
  summary(){
    const tall = Math.max(this.peak, this.yard.tallest()), n = this.stacked;
    const a = tall >= 2 ? `You built something ${tall} blocks tall!` : '', b = n > 0 ? `You stacked ${n} block${n === 1 ? '' : 's'}!` : '';
    return [a, b].filter(Boolean).join(' ') || null;
  }
  value(){ return this.stacked; }
}

/* a shuffled copy (the same kinds of block come round, in a new order each time) */
function shuffled(list, rnd){
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--){ const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------- the painting of a block ---------- */
/* the outline of a shape, in pixels, middle at (0, 0): wp wide and hp high; the arch's doorway is a second path (even-odd) */
function shapePath(c, kind, wp, hp, hole){
  const w = wp / 2, h = hp / 2, r = Math.min(wp, hp) * 0.14;
  c.beginPath();
  if (kind === 'roof'){
    const ridge = wp * 0.07;
    c.moveTo(-w, h); c.lineTo(-ridge, -h); c.lineTo(ridge, -h); c.lineTo(w, h); c.closePath();
  } else if (kind === 'dome'){
    c.moveTo(-w, h); c.arc(0, h, w, Math.PI, 2 * Math.PI); c.closePath();
  } else {
    c.roundRect(-w, -h, wp, hp, kind === 'arch' ? [r, r, 0, 0] : r);
    if (kind === 'arch'){ const q = hole * (wp / SHAPES.arch.w); c.moveTo(-q, h); c.arc(0, h, q, Math.PI, 2 * Math.PI); c.closePath(); }
  }
}
/* a painted block: flat colour, a shaded underside and side, a light edge on top, and a little mark. Used by the game and the cover. */
export function drawBlock(c, x, y, kind, wp, hp, rot, col, mark = 'dot', { glow = null, alphaK = 1 } = {}){
  const s = SHAPES[kind];
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= alphaK;
  const base = color(col), shade = color(col, 'shade'), light = color(col, 'light');
  const path = () => { shapePath(c, kind, wp, hp, s.hole); };
  if (glow){ c.save(); c.shadowColor = glow; c.shadowBlur = hp * 0.35 + 18; path(); c.fillStyle = glow; c.fill('evenodd'); c.restore(); }
  path(); c.fillStyle = base; c.fill('evenodd');
  c.save(); path(); c.clip('evenodd');
  c.fillStyle = shade; c.globalAlpha *= 0.55; c.fillRect(wp * 0.22, -hp, wp, hp * 2); c.fillRect(-wp, hp * 0.3, wp * 2, hp);
  c.globalAlpha = (c.globalAlpha / 0.55) * 0.6; c.fillStyle = light; c.fillRect(-wp * 0.5, -hp * 0.5, wp, Math.max(2, hp * 0.07));
  c.restore();
  /* a mark on its face */
  c.fillStyle = alpha('earth.snow', 0.85);
  const m = Math.min(wp, hp);
  if (kind === 'cube'){
    if (mark === 'star'){ c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? m * 0.1 : m * 0.24; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fill(); }
    else if (mark === 'heart'){ const q = m; c.beginPath(); c.moveTo(0, q * 0.16); c.bezierCurveTo(-q * 0.31, -q * 0.05, -q * 0.15, -q * 0.29, 0, -q * 0.13); c.bezierCurveTo(q * 0.15, -q * 0.29, q * 0.31, -q * 0.05, 0, q * 0.16); c.fill(); }
    else { c.beginPath(); c.arc(0, 0, m * 0.17, 0, 6.2832); c.fill(); }
  } else if (kind === 'plank'){
    const n = wp > hp ? 3 : 1; for (let k = 0; k < n; k++){ c.beginPath(); c.arc((k - (n - 1) / 2) * wp * 0.28, 0, hp * 0.16, 0, 6.2832); c.fill(); }
  } else if (kind === 'pillar'){
    for (const f of [-0.3, 0.3]) c.fillRect(-wp * 0.36, hp * f - hp * 0.02, wp * 0.72, hp * 0.04);
  } else if (kind === 'roof'){
    c.beginPath(); c.arc(0, hp * 0.18, hp * 0.12, 0, 6.2832); c.fill();
  } else if (kind === 'dome'){
    c.beginPath(); c.arc(0, hp * 0.05, hp * 0.12, 0, 6.2832); c.fill();
  } else if (kind === 'arch'){
    c.beginPath(); c.arc(0, -hp * 0.3, hp * 0.08, 0, 6.2832); c.fill();
  }
  c.restore();
}
/* one block of the yard, with the sway, the wobble and the glow of whoever is carrying it or is about to */
function drawPiece(c, b, H, t, holder, near = 0){
  const x = (b.X + b.nx) * H, y = b.Y * H, a = b.fade ? Math.max(0, 1 - b.fade) : 1;
  const rot = b.ang + b.wob * 0.9 + (b.spinAng || 0) + (b.state === 'slide' ? b.dir * Math.min(0.3, b.spin * 0.4) : 0);
  /* the corner it turns about is its bottom: tilt there, not at the middle */
  const bx = x, by = y + b.h * H / 2;
  c.save(); c.translate(bx, by); c.rotate(rot); if (near > 0) c.scale(1 + 0.08 * near, 1 + 0.08 * near); c.translate(-bx, -by);
  let glow = null;
  if (holder != null) glow = PLAYER_COLORS[holder];
  else if (near > 0.2) glow = color('sky.sunGlow');
  if (b.pend){
    const col = PLAYER_COLORS[b.pend.who], p = b.pend.p;
    c.save(); c.globalAlpha = 0.25 + 0.5 * p; c.strokeStyle = col; c.lineWidth = Math.max(3, H * 0.006);
    c.beginPath(); c.roundRect(x - b.w * H / 2 - H * 0.012, y - b.h * H / 2 - H * 0.012, b.w * H + H * 0.024, b.h * H + H * 0.024, H * 0.02); c.stroke(); c.restore();
  }
  drawBlock(c, x, y, b.kind, b.w * H, b.h * H, 0, b.col, b.mark, { glow, alphaK: a });
  c.restore();
}
export { topH, liftAt, FADE_SECS };
