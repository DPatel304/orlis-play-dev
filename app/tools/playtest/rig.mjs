/* The playtest rig: scripted bodies that play Orlis games the way a child or a grown-up would.
   (Used by tools/playtest.mjs in Node and by tools/playtest-shots.mjs in the browser. No Node-only imports here.)

   WHAT IS HERE
   - Person: a body in the picture. Child (6-8) or adult, with its own size in the frame, reach, speed, reaction time, jitter and
     attention. It has two hands that move at human speed (child up to 2.5 m/s, adult 2 m/s, mapped to the picture's scale),
     can walk sideways, bend, squat, hop, lean and lift its knees. All 33 landmarks are made from that.
   - World: the people in one room; they bump into each other (same row) or stand in front (children in front of grown-ups).
   - detect(): what a camera model would report: landmarks with noise, visibility lost off the edge and behind someone in front.
   - Feeder: feeds the detections through the REAL tracker (pose._assign: who is a player, who joins, who is a "watcher", the
     one-per-person merging, the smoothing) and tells you who is in which place.
   - BRAINS: how each game is played (chase balloons, freeze, sweep leaves, carry blocks, paint, do the animal's move,
     bat the ball, steer, copy the card).

   UNITS. Picture positions are fractions of the picture (x of the width, y of the height), as the games use them. Where a
   distance matters (reach, speed) it is in "H" units (picture heights; 1 W = 16/9 H) and metres are mapped with the person's
   own picture scale (picture height of the person / real height). */
import { L } from '../../src/tracking/pose-shared.js';

export const W = 1920, H = 1080, A = 16 / 9;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
export function mulberry32(seed){
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const between = (r, a, b) => a + (b - a) * r();

/* ------------------------------------------------------------------------------------------------------------------ the bodies */
/* Proportions are fractions of the person's height, measured from the top of the head. */
export const KINDS = {
  adult: {
    realM: 1.75, pic: 0.74, feetY: 0.93,                       /* 74% of the picture's height, standing a little back (feet higher in the frame) */
    nose: 0.065, shoulder: 0.185, hip: 0.52, knee: 0.74, ankle: 0.955, shw: 0.115, hipw: 0.085, arm: 0.31,
    vmax: 2.0, walk: 0.8, wn: 0.0016,                          /* hand speed cap (m/s), walking speed (m/s), jitter of the goal (H) */
    spring: { w: 10, z: 1.0 }, delay: [0.4, 0.8], hopM: 0.15, jumpM: 0.22, hopGainM: 0.15,
    lapseEvery: [35, 70], lapseLen: [0.6, 1.5], wander: 0, closeP: 0,
    fidget: 0.0012
  },
  child: {
    realM: 1.2, pic: 0.444, feetY: 0.97,                       /* about 60% of an adult's height, standing lower in the frame */
    nose: 0.09, shoulder: 0.22, hip: 0.55, knee: 0.765, ankle: 0.955, shw: 0.117, hipw: 0.09, arm: 0.30,
    vmax: 2.5, walk: 0.9, wn: 0.0055,
    spring: { w: 16, z: 0.5 }, delay: [0.25, 0.6], hopM: 0.16, jumpM: 0.20, hopGainM: 0.2,
    lapseEvery: [8, 20], lapseLen: [1, 3], wander: 0.45, closeP: 0.5,
    fidget: 0.004
  }
};

class Hand {
  constructor(person, side){
    this.p = person; this.side = side;                          /* 'l' is the screen-left one (the player's own left) */
    this.x = 0.5; this.y = 0.8; this.vx = 0; this.vy = 0;       /* picture fractions, velocities in picture fractions per second */
    this.q = []; this.n = { x: 0, y: 0 }; this.speedH = 0;
    this.path = 0;                                              /* H-units travelled, for the effort count */
  }
  /* the hands hang at the sides */
  restPoint(){
    const S = this.p.shoulderOf(this.side), P = this.p;
    return { x: S.x + (this.side === 'l' ? -1 : 1) * 0.045 * P.h * P.k / A, y: S.y + P.armLen * P.k * 0.92 };
  }
  push(e, now){ e.t = now; this.q.push(e); if (this.q.length > 60) this.q.shift(); }
  goal(x, y, now){ this.push({ m: 'goal', x, y }, now); }
  vel(vxH, vyH, now){ this.push({ m: 'vel', vx: vxH, vy: vyH }, now); }
  release(now){ this.push({ m: 'rest' }, now); }
  cmd(now){
    const due = now - this.p.delay;
    let c = null;
    for (let i = this.q.length - 1; i >= 0; i--) if (this.q[i].t <= due){ c = this.q[i]; break; }
    return c || { m: 'rest' };
  }
  step(dt, now, rng){
    const P = this.p, K = P.kind, c = this.cmd(now), S = P.shoulderOf(this.side), vmaxH = K.vmax * P.ppm * P.k;
    /* H-unit coordinates: x * A */
    let px = this.x * A, py = this.y, vx = this.vx * A, vy = this.vy;
    /* the goal wobbles a little (a child's more) */
    const tau = 0.35; this.n.x += (-this.n.x / tau) * dt + K.wn * Math.sqrt(2 * dt / tau) * gauss(rng);
    this.n.y += (-this.n.y / tau) * dt + K.wn * Math.sqrt(2 * dt / tau) * gauss(rng);
    if (c.m === 'vel'){
      const tv = 0.07 + (K === KINDS.adult ? 0.04 : 0), k = Math.min(1, dt / tv);
      vx += (c.vx - vx) * k; vy += (c.vy - vy) * k;
    } else {
      let gx, gy;
      if (c.m === 'goal'){ gx = c.x * A + this.n.x; gy = c.y + this.n.y; }
      else { const r = this.restPoint(); gx = r.x * A + this.n.x * 0.5; gy = r.y + this.n.y * 0.5; }
      const w = K.spring.w, z = K.spring.z;
      vx += (w * w * (gx - px) - 2 * z * w * vx) * dt; vy += (w * w * (gy - py) - 2 * z * w * vy) * dt;
    }
    const sp = Math.hypot(vx, vy);
    if (sp > vmaxH){ vx *= vmaxH / sp; vy *= vmaxH / sp; }
    px += vx * dt; py += vy * dt;
    /* the arm only goes so far from the shoulder */
    const R = P.armLen * P.k * (py < S.y ? 1.08 : 1.0), sx = S.x * A, dx = px - sx, dy = py - S.y, d = Math.hypot(dx, dy);
    if (d > R){
      const ux = dx / d, uy = dy / d; px = sx + ux * R; py = S.y + uy * R;
      const out = vx * ux + vy * uy; if (out > 0){ vx -= out * ux; vy -= out * uy; }
    }
    this.path += Math.hypot(px - this.x * A, py - this.y) / Math.max(1e-6, P.ppm * P.k) * 1;      /* (in metres) */
    this.x = px / A; this.y = py; this.vx = vx / A; this.vy = vy; this.speedH = Math.hypot(vx, vy);
  }
}

/* A person in the room. */
export class Person {
  constructor(spec, rng, idx){
    const K = KINDS[spec.kind];
    this.spec = spec; this.kind = K; this.name = spec.kind; this.isChild = spec.kind === 'child'; this.idx = idx; this.rng = rng;
    this.layer = spec.layer ?? (this.isChild ? 1 : 0);
    this.h = spec.h ?? K.pic;
    this.feetY = spec.feetY ?? K.feetY;                          /* where the feet stand in the picture (a body further back stands higher) */
    this.role = spec.role || null;                               /* 'sofa' | 'passer': a watcher, never driven by a game */
    this.seat = spec.role === 'sofa';                                    /* height in the picture (H) */
    this.realM = spec.realM ?? K.realM;
    this.ppm = this.h / this.realM;                              /* picture heights per metre */
    this.armLen = K.arm * this.h;                                /* shoulder to wrist (H) */
    this.x = spec.x; this.homeX = spec.x;                        /* hip centre, before the "closer" scale */
    this.k = 1; this.kGoal = 1;
    this.lift = 0; this.liftV = 0;                               /* jump height (m) */
    this.cmd = { crouch: 0, bend: 0, lean: 0, kl: 0, kr: 0, tip: 0, hold: false };     /* tip: up on tiptoe (m) */
    this.cur = { crouch: 0, bend: 0, lean: 0, kl: 0, kr: 0, tip: 0 };
    this.walkGoal = null; this.walkSpeedMul = 1; this.cmdQ = []; this.evQ = []; this._wantWalk = null; this.now = 0;
    this.reactScale = spec.react ?? 1; this.delay = between(rng, ...K.delay) * this.reactScale; this.delayT = 0;
    this.lapse = null; this.attnNext = between(rng, ...K.lapseEvery) * (this.isChild ? 0.6 : 1);
    this.closeNext = this.isChild ? between(rng, 20, 45) : 1e9; this.closeUntil = 0;
    this.L = new Hand(this, 'l'); this.R = new Hand(this, 'r');
    this.amp = { jump: 1, squat: 1, lean: 1, march: 1, tiptoe: 1 }; this.state = 'idle'; this.slot = -1; this.present = false; this.inScene = true;
    this.breath = rng() * 6; this.fid = { x: 0, y: 0 };
    this.stats = { frames: 0, on: 0, idle: 0, wait: 0, lapse: 0, armsUp: 0, bent: 0, hops: 0, closeTime: 0, offFrame: 0 };
    this.J = null; this.mem = {};
    this._joints(0);
  }
  /* screen position of a point given in the person's own frame (before the "closer" scale) */
  T(x, y){ return { x: 0.5 + (x - 0.5) * this.k, y: 0.5 + (y - 0.5) * this.k }; }
  /* inverse of T for x */
  untx(sx){ return 0.5 + (sx - 0.5) / this.k; }
  _joints(now){
    const P = this, K = this.kind, c = this.cur, h = this.h, liftH = (this.lift + c.tip) * this.ppm;
    const top = this.feetY - h - liftH, yOf = (f) => top + f * h;
    const crouchDrop = c.crouch * 0.30 * h, bendSh = c.bend * 0.26 * h, bendHead = c.bend * 0.30 * h, bendHip = c.bend * 0.05 * h;
    const lean = c.lean * 0.22 * h / A;
    const hipY = yOf(K.hip) + crouchDrop + bendHip, shY = yOf(K.shoulder) + crouchDrop + bendSh, noseY = yOf(K.nose) + crouchDrop + bendHead;
    const fx = this.fid.x, fy = this.fid.y;
    const hw = K.hipw * h / A, sw = K.shw * h / A, hx = this.x + fx;
    const shX = hx + lean, hdX = hx + lean * 1.25;
    const kneeRest = yOf(K.knee) + crouchDrop * 0.5, ankRest = yOf(K.ankle);
    const lift = (kl) => ({ ky: kneeRest - kl * (kneeRest - hipY) * 0.5, ay: ankRest - kl * 0.16 * h });
    let kl = lift(c.kl), kr = lift(c.kr);
    /* seated on a sofa: the thighs point at the camera, so the knees are nearly level with the hips; the shins hang straight down */
    if (this.seat){ const ky = hipY + 0.035 * h, ay = ky + 0.21 * h; kl = { ky, ay }; kr = { ky, ay }; }
    const j = {
      nose: this.T(hdX, noseY + fy), lEye: this.T(hdX - 0.02 * h / A, noseY - 0.012 * h + fy), rEye: this.T(hdX + 0.02 * h / A, noseY - 0.012 * h + fy),
      lEar: this.T(hdX - 0.045 * h / A, noseY - 0.004 * h + fy), rEar: this.T(hdX + 0.045 * h / A, noseY - 0.004 * h + fy),
      lSh: this.T(shX - sw, shY + fy), rSh: this.T(shX + sw, shY + fy),
      lHip: this.T(hx - hw, hipY), rHip: this.T(hx + hw, hipY),
      lKnee: this.T(hx - hw * 1.05, kl.ky), rKnee: this.T(hx + hw * 1.05, kr.ky),
      lAnk: this.T(hx - hw * 1.1, kl.ay), rAnk: this.T(hx + hw * 1.1, kr.ay),
      topY: this.T(hdX, top).y, hipY: this.T(hx, hipY).y, shY: this.T(shX, shY).y
    };
    this.J = j;
    return j;
  }
  shoulderOf(side){ return side === 'l' ? this.J.lSh : this.J.rSh; }
  get sx(){ return this.T(this.x, 0.5).x; }
  /* the middle of the body on the screen (the games' "centre": between hips and shoulders) */
  centre(){ const j = this.J; return { x: (j.lSh.x + j.rSh.x + j.lHip.x + j.rHip.x) / 4, y: (j.shY + j.hipY) / 2 }; }
  torso(){ const j = this.J; return Math.hypot(((j.lHip.x + j.rHip.x) - (j.lSh.x + j.rSh.x)) / 2, (j.hipY - j.shY)); }
  /* ---- reaching: can this body get a hand to (tx, ty) where it stands? */
  /* where the shoulders are when standing straight (no bend, squat or hop) */
  restShY(){ const K = this.kind; return this.T(0.5, this.feetY - this.h + K.shoulder * this.h).y; }
  /* can this body get a hand to (tx, ty) where it stands? rest: judge from standing straight (what it could do if it bent or hopped) */
  nearestSide(tx){ return Math.abs(tx - this.J.lSh.x) < Math.abs(tx - this.J.rSh.x) ? 'l' : 'r'; }
  reach(tx, ty, rest = false, hand = null){
    const S = (hand || this.nearestSide(tx)) === 'l' ? this.J.lSh : this.J.rSh;
    const sy = rest ? this.restShY() : S.y;
    const dx = (tx - S.x) * A, dy = ty - sy, d = Math.hypot(dx, dy), R = this.armLen * this.k;
    const Ru = dy < 0 ? R * 1.08 : R, side = S === this.J.lSh ? 'l' : 'r';
    if (d <= Ru) return { kind: 'ok', d, side, S };
    /* too high or too low for this body however it stands (hop, tiptoe, bend, squat) and wherever it walks: not reachable at all */
    const sy0 = this.restShY(), top = sy0 - R * 1.08 - this.kind.hopGainM * this.ppm * this.k, bottom = sy0 + R + 0.56 * this.h * this.k;
    if (ty < top - 0.004 || ty > bottom) return { kind: 'no', d, side, S };
    const extra = d - Ru;
    const horiz = Math.abs(dx) > Ru * 0.55;
    if (dy < -R * 0.3 && !horiz && extra <= this.kind.hopGainM * this.ppm * this.k) return { kind: 'hop', d, extra, side, S };
    if (dy > R * 0.5 && !horiz && extra <= 0.56 * this.h * this.k) return { kind: 'bend', d, extra, side, S };
    return { kind: 'walk', d, extra, side, S, dx };
  }
  /* the cheapest way to get a hand to (tx, ty): bend or squat for low things, hop for high ones, walk for far ones (and moves the hand) */
  approach(tx, ty, now, { allowHop = true, hand = null } = {}){
    const side = hand || this.nearestSide(tx), r = this.reach(tx, ty, true, side), Hd = side === 'l' ? this.L : this.R;
    if (r.kind === 'walk'){ const R = this.armLen * this.k; this.walkTo(this.sx + (tx - Math.sign(tx - r.S.x) * 0.55 * R / A) - r.S.x); }
    else if (r.kind === 'hop' && allowHop && this.lift <= 0.001){
      const dd = Math.hypot((tx - Hd.x) * A, ty - Hd.y);
      if (dd < 0.18) this.hop(this.kind.hopM);
    }
    const need = ty - (this.restShY() + this.armLen * this.k * 0.97);
    if (need > 0 && r.kind !== 'walk'){
      this.cmd.bend = clamp(need / (0.26 * this.h * this.k), 0, 1);
      this.cmd.crouch = clamp((need - 0.26 * this.h * this.k) / (0.30 * this.h * this.k), 0, 1);
    }
    Hd.goal(tx, ty, now);
    return r;
  }
  walkTo(sx){ const g = this.untx(clamp(sx, 0.07, 0.93)); if (this._wantWalk != null && Math.abs(this._wantWalk - g) < 0.004) return; this._wantWalk = g; this.defer(() => { this.walkGoal = g; }); }
  /* everything a person does comes a reaction time after they decide to do it */
  defer(fn){ this.evQ.push({ at: this.now + this.delay, fn }); }
  hop(m){ if (this.lift > 0.001 || this._hopWant) return; this._hopWant = true; this.defer(() => { this._hopWant = false; if (this.lift > 0.001) return; this.liftV = Math.sqrt(2 * 9.81 * m); this.lift = 1e-4; this.stats.hops++; }); }
  other(side){ return side === 'l' ? this.R : this.L; }
  releaseHands(now){ this.L.release(now); this.R.release(now); }
  /* fidgets and attention, then movement, then hands */
  update(dt, now, world){
    const K = this.kind, rng = this.rng;
    this.now = now;
    while (this.evQ.length && this.evQ[0].at <= now) this.evQ.shift().fn();
    /* the body's own moves (squat, bend, lean, knees) arrive a reaction time after they are asked for, like the hands' goals */
    this.cmdQ.push({ t: now, ...this.cmd }); while (this.cmdQ.length > 2 && this.cmdQ[1].t <= now - this.delay) this.cmdQ.shift();
    const dc = this.cmdQ[0].t <= now - this.delay || this.cmdQ.length === 1 ? this.cmdQ[0] : { crouch: 0, bend: 0, lean: 0, kl: 0, kr: 0, tip: 0 };
    /* reaction time wanders between its limits */
    this.delayT -= dt; if (this.delayT <= 0){ this.delayT = between(rng, 1, 3); this.delayTarget = between(rng, ...K.delay) * this.reactScale; }
    this.delay += ((this.delayTarget ?? this.delay) - this.delay) * Math.min(1, dt);
    /* attention: sometimes they stop for a while */
    if (this.lapse && now >= this.lapse.end){ this.lapse = null; this.attnNext = now + between(rng, ...K.lapseEvery); }
    else if (!this.lapse && now >= this.attnNext && !world.noLapse){
      const dur = between(rng, ...K.lapseLen);
      this.lapse = { end: now + dur, start: now };
      if (rng() < K.wander){ this.walkTo(this.sx + (rng() < 0.5 ? -1 : 1) * between(rng, 0.05, 0.12)); }
      if (this.isChild && rng() < K.closeP * 0.6) { this.closeUntil = Math.max(this.closeUntil, now + dur + between(rng, 1, 3)); this.kGoal = between(rng, 1.3, 1.5); }
    }
    /* sometimes a child just drifts closer to the screen */
    if (this.isChild && now >= this.closeNext){ if (rng() < K.closeP){ this.closeUntil = now + between(rng, 3, 6); this.kGoal = between(rng, 1.3, 1.5); } this.closeNext = now + between(rng, 30, 60); }
    if (this.closeUntil && now >= this.closeUntil){ this.closeUntil = 0; this.kGoal = 1; }
    if (!this.isChild && !this.closeUntil && rng() < dt * 0.05) this.kGoal = between(rng, 0.97, 1.03);
    this.k += (this.kGoal - this.k) * Math.min(1, dt * 1.2);
    if (this.k > 1.12) this.stats.closeTime += dt;
    /* walking */
    if (this.walkGoal != null){
      const dxs = (this.walkGoal - this.x), sp = K.walk * this.ppm * 0.5625 * this.walkSpeedMul;      /* m/s -> picture widths a second */
      if (Math.abs(dxs) < 0.004) this.walkGoal = null; else this.x += Math.sign(dxs) * Math.min(Math.abs(dxs), sp * dt);
    }
    /* body fidget and breathing (the camera sees a person is never quite still) */
    this.breath += dt * (this.isChild ? 2.2 : 1.6);
    this.fid.x += (-this.fid.x / 0.8) * dt + K.fidget * 0.4 * Math.sqrt(dt) * gauss(rng) * 4;
    this.fid.y = Math.sin(this.breath) * 0.0012 * (this.isChild ? 1.3 : 1);
    /* the jump */
    if (this.lift > 0){ this.liftV -= 9.81 * dt; this.lift += this.liftV * dt; if (this.lift <= 0){ this.lift = 0; this.liftV = 0; } }
    /* body modifiers ease toward what's asked */
    const c = this.cur, g = dc.hold ? this.cur : dc, ks = this.isChild ? 9 : 6;
    for (const key of ['crouch', 'bend', 'lean', 'kl', 'kr', 'tip']) c[key] += (g[key] - c[key]) * Math.min(1, dt * ks);
    this._joints(now);
    this.L.step(dt, now, rng); this.R.step(dt, now, rng);
    /* the effort counters */
    const st = this.stats; st.frames++; st[this.state] = (st[this.state] || 0) + 1;
    const shY = this.J.shY;
    if (this.L.y < shY - 0.02 || this.R.y < shY - 0.02) st.armsUp++;
    if (this.cur.bend > 0.35 || this.cur.crouch > 0.35) st.bent++;
  }
  /* the 33 landmarks as the screen sees them (before noise) */
  landmarks(){
    const j = this.J, lm = Array.from({ length: 33 }, () => ({ x: j.nose.x, y: j.nose.y, z: 0, v: 0.95 }));
    const set = (i, p, dx = 0, dy = 0) => { lm[i] = { x: p.x + dx, y: p.y + dy, z: 0, v: 0.95 }; };
    set(L.NOSE, j.nose); set(1, j.lEye, 0.006, 0); set(L.L_EYE, j.lEye); set(3, j.lEye, -0.006, 0); set(4, j.rEye, 0.006, 0); set(L.R_EYE, j.rEye); set(6, j.rEye, -0.006, 0);
    set(7, j.lEar); set(8, j.rEar); set(9, j.nose, -0.006, 0.03 * this.h); set(10, j.nose, 0.006, 0.03 * this.h);
    set(L.L_SHOULDER, j.lSh); set(L.R_SHOULDER, j.rSh);
    for (const [side, E, Wr, iW, iE] of [['l', null, this.L, L.L_WRIST, L.L_ELBOW], ['r', null, this.R, L.R_WRIST, L.R_ELBOW]]){
      const S = side === 'l' ? j.lSh : j.rSh, wx = Wr.x, wy = Wr.y;
      const sxH = S.x * A, syH = S.y, wxH = wx * A, wyH = wy, d = Math.hypot(wxH - sxH, wyH - syH), half = this.armLen * this.k / 2;
      const off = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
      const ux = (wxH - sxH) / (d || 1), uy = (wyH - syH) / (d || 1);
      let nx = -uy, ny = ux; if (ny < 0){ nx = -nx; ny = -ny; }                    /* the elbow hangs low */
      if ((side === 'l' ? -1 : 1) * nx < 0 && Math.abs(nx) > 0.2) { nx = -nx; ny = -ny; if (ny < 0){ nx = -nx; ny = -ny; } }
      const ex = (sxH + wxH) / 2 + nx * off, ey = (syH + wyH) / 2 + ny * off;
      lm[iE] = { x: ex / A, y: ey, z: 0, v: 0.95 }; lm[iW] = { x: wx, y: wy, z: 0, v: 0.95 };
      for (const q of side === 'l' ? [17, 19, 21] : [18, 20, 22]) lm[q] = { x: wx + (side === 'l' ? -0.004 : 0.004), y: wy + 0.012, z: 0, v: 0.9 };
    }
    set(L.L_HIP, j.lHip); set(L.R_HIP, j.rHip); set(L.L_KNEE, j.lKnee); set(L.R_KNEE, j.rKnee); set(L.L_ANKLE, j.lAnk); set(L.R_ANKLE, j.rAnk);
    set(29, j.lAnk, 0, 0.012); set(30, j.rAnk, 0, 0.012); set(31, j.lAnk, -0.004, 0.03 * this.h); set(32, j.rAnk, 0.004, 0.03 * this.h);
    return lm;
  }
}

/* The people in a room. */
export class World {
  constructor(specs, seed, { jitter = 0.0018, noLapse = false } = {}){
    this.seed = seed; this.t = 0; this.jitter = jitter; this.noLapse = noLapse;
    this.rng = mulberry32(seed * 7919 + 13);
    /* watchers (a person on the sofa behind, someone walking across the back) are in the picture but never play: the tracker sees them,
       no game drives them, and nothing is scored for them. */
    this.watchers = specs.filter(s => s.role).map((s, i) => new Person(s, mulberry32(seed * 7001 + i * 17 + 3), 100 + i));
    specs = specs.filter(s => !s.role);
    this.persons = specs.map((s, i) => new Person(s, mulberry32(seed * 104729 + i * 31 + 5), i));
    this.persons.sort((a, b) => a.x - b.x);
    this.persons.forEach((p, i) => { p.idx = i; });
  }
  get everyone(){ return this.persons.concat(this.watchers); }
  /* one frame: brains first (they set goals), then bodies */
  step(dt, brain, ctx){
    this.t += dt;
    for (const p of this.persons){
      p.cmd.crouch = p.cmd.bend = p.cmd.lean = p.cmd.kl = p.cmd.kr = p.cmd.tip = 0; p.cmd.hold = false;
      const lap = p.lapse;
      if (lap){ p.releaseHands(this.t); p.state = 'lapse'; }
      else if (brain && ctx) brain.act(ctx, p, this.t, dt);
      else { p.releaseHands(this.t); p.state = 'idle'; }
    }
    for (const p of this.persons) p.update(dt, this.t, this);
    for (const w of this.watchers) this._watcher(w, dt);
    this._separate();
  }
  /* the sofa person sits almost still and now and then raises an arm; the passer-by walks across the back at about 1.2 m/s, out of
     the picture, and back again some seconds later */
  _watcher(w, dt){
    const t = this.t, m = w.mem;
    w.cmd.crouch = w.cmd.bend = w.cmd.lean = w.cmd.kl = w.cmd.kr = 0; w.cmd.hold = false;
    if (w.role === 'sofa'){
      if (m.armUntil == null){ m.armUntil = 0; m.armNext = 6 + w.rng() * 10; m.side = 'l'; }
      if (t >= m.armNext){ m.armUntil = t + 0.8 + w.rng() * 1.5; m.armNext = t + 10 + w.rng() * 25; m.side = w.rng() < 0.5 ? 'l' : 'r'; }
      const H = m.side === 'l' ? w.L : w.R, O = m.side === 'l' ? w.R : w.L;
      if (t < m.armUntil) H.goal(w.shoulderOf(m.side).x + (m.side === 'l' ? -0.01 : 0.01), w.J.topY - w.armLen * w.k * 0.3, t); else H.release(t);
      O.release(t);
      /* shifts about on the cushions now and then */
      if (w.rng() < dt * 0.1) w.fid.x += (w.rng() - 0.5) * 0.01;
    } else {
      w.releaseHands(t);
      if (m.dir == null){ m.dir = w.rng() < 0.5 ? 1 : -1; m.wait = 1 + w.rng() * 6; w.inScene = false; w.x = m.dir > 0 ? -0.1 : 1.1; }
      if (!w.inScene){ m.wait -= dt; if (m.wait <= 0){ w.inScene = true; w.walkGoal = m.dir > 0 ? 1.12 : -0.12; w.walkSpeedMul = 1.5; } }
      else {
        w.x += 0;                                              /* (walking is Person.update's: toward walkGoal) */
        if (Math.abs(w.x - w.walkGoal) < 0.02 || w.walkGoal == null){ w.inScene = false; m.dir = -m.dir; m.wait = 4 + w.rng() * 10; w.x = m.dir > 0 ? -0.1 : 1.1; w.walkGoal = null; }
      }
    }
    w.update(dt, t, this);
  }
  /* people in the same row can't walk through each other; a child standing in front of a grown-up can overlap them */
  _separate(){
    for (let it = 0; it < 2; it++) for (let a = 0; a < this.persons.length; a++) for (let b = a + 1; b < this.persons.length; b++){
      const p = this.persons[a], q = this.persons[b];
      if (p.layer !== q.layer) continue;
      const min = (p.kind.shw * p.h + q.kind.shw * q.h) / A * 1.7 + 0.015, d = q.x - p.x;
      if (Math.abs(d) < min){ const push = (min - Math.abs(d)) / 2 * (d >= 0 ? 1 : -1); p.x -= push; q.x += push; }
    }
    for (const p of this.persons) p.x = clamp(p.x, 0.06, 0.94);
  }
  /* what a pose camera reports: landmarks (noise, lost behind someone in front, lost off the edge of the picture) */
  detect(){
    const out = [];
    for (const p of this.everyone){
      if (!p.inScene) continue;
      const lm = p.landmarks();
      const hid = (x, y) => this.everyone.some(q => q !== p && q.layer > p.layer && q.inScene && Math.abs(x - q.sx) < q.kind.shw * q.h * q.k / A * 1.25 && y > q.J.topY - 0.01 && y < q.J.hipY + 0.02);
      for (let i = 0; i < lm.length; i++){
        const k = lm[i];
        k.x += gauss(this.rng) * this.jitter; k.y += gauss(this.rng) * this.jitter;
        let v = 0.94 + (this.rng() - 0.6) * 0.08;
        if (k.x < 0 || k.x > 1 || k.y < 0 || k.y > 1) v = 0.08 + this.rng() * 0.1;
        else if (hid(k.x, k.y)){ v = 0.25 + this.rng() * 0.15; k.x += gauss(this.rng) * 0.012; k.y += gauss(this.rng) * 0.012; }
        k.v = v; k.visibility = v;
      }
      out.push({ person: p, lm });
    }
    return out;
  }
}

/* ------------------------------------------------------------------------------------------------------------------ line-ups */
export const LINEUPS = {
  '1c': [{ kind: 'child', x: 0.5 }],
  '1a': [{ kind: 'adult', x: 0.5 }],
  /* two (a grown-up and a child) and three (two grown-ups and a child), for the results screens */
  '2m': [{ kind: 'adult', x: 0.35 }, { kind: 'child', x: 0.62 }],
  '3m': [{ kind: 'adult', x: 0.25 }, { kind: 'child', x: 0.5 }, { kind: 'adult', x: 0.75 }],
  '4c': [{ kind: 'child', x: 0.2 }, { kind: 'child', x: 0.4 }, { kind: 'child', x: 0.6 }, { kind: 'child', x: 0.8 }],
  /* the family: two grown-ups at the ends, a child in front of each (lower, overlapping a little) */
  '4m': [{ kind: 'adult', x: 0.24 }, { kind: 'child', x: 0.35 }, { kind: 'child', x: 0.66 }, { kind: 'adult', x: 0.77 }]
};
/* the same, with a watcher or two: s = a person seated on the sofa behind (35-45% of a standing adult, mostly still, sometimes an arm up),
   p = someone walking across the back of the room. */
const SOFA = { kind: 'adult', role: 'sofa', x: 0.5 }, PASSER = { kind: 'adult', role: 'passer', x: 0.5 };
LINEUPS['1c+s'] = [...LINEUPS['1c'], SOFA]; LINEUPS['1c+p'] = [...LINEUPS['1c'], PASSER];
LINEUPS['1a+s'] = [...LINEUPS['1a'], SOFA]; LINEUPS['1a+p'] = [...LINEUPS['1a'], PASSER];
LINEUPS['4m+s'] = [...LINEUPS['4m'], SOFA]; LINEUPS['4m+p'] = [...LINEUPS['4m'], PASSER]; LINEUPS['4m+sp'] = [...LINEUPS['4m'], SOFA, PASSER];
LINEUPS['s'] = [SOFA]; LINEUPS['p'] = [PASSER]; LINEUPS['sp'] = [SOFA, PASSER];
export function makeWorld(lineup, seed, opts = {}){
  const rng = mulberry32(seed * 31 + 7);
  const react = opts.react ?? 1;
  const adultPic = KINDS.adult.pic + (rng() - 0.5) * 0.03;
  const specs = LINEUPS[lineup].map((s) => {
    if (s.role){
      /* watchers: about 40% of a standing adult's size (the sofa person seated, further back), the passer-by a little smaller and further back still */
      const f = s.role === 'sofa' ? 0.40 + (rng() - 0.5) * 0.10 : 0.40 + (rng() - 0.5) * 0.10;
      return { ...s, x: s.role === 'sofa' ? 0.3 + rng() * 0.4 : 0.5, layer: -1, react: 1, h: adultPic * f, realM: 1.75, feetY: s.role === 'sofa' ? 0.80 : 0.72 };
    }
    const x = clamp(s.x + (rng() - 0.5) * 0.06, 0.1, 0.9);
    if (s.kind === 'child'){
      const ratio = clamp(0.60 + gauss(rng) * 0.03, 0.54, 0.68);          /* "about 60% of an adult's height in the picture" */
      return { ...s, x, react, h: adultPic * ratio, realM: 1.2 + (rng() - 0.5) * 0.16 };
    }
    return { ...s, x, react, h: adultPic + (rng() - 0.5) * 0.02, realM: 1.75 + (rng() - 0.5) * 0.12 };
  });
  return new World(specs, seed, opts);
}

/* ------------------------------------------------------------------------------------------------------------------ the tracker */
export function resetPose(pose){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    Object.assign(p, { present: false, lostFor: 99, watching: 0, at: null, lm: null, raw: null, filt: null, seg: null, head: null,
      hands: { left: { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }, right: { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 } }, centre: { x: 0.5, y: 0.5 }, scale: 0.3 });
  });
  pose._cands = []; pose.personCount = 0; pose.seenCount = 0;
}

/* Feeds a World through the real tracker. `lib` is { sizeOf, seated, CLOSE, WATCH_AFTER, headOf }.
   assist: anyone the tracker would not let in (or drops) is let in anyway, so a game can still be judged; the time they
   would have been out is counted in person.notClose. */
export class Feeder {
  constructor(pose, lib, { assist = true, cap = 4, clock = null } = {}){
    this.pose = pose; this.lib = lib; this.assist = assist; this.t = 0;
    pose.cap = cap;
    pose.clock = () => this.t * 1000;
    this.ejectedWhileAssist = 0;
  }
  step(world, dt){
    const { pose, lib } = this;
    this.t += dt;
    const dets = world.detect();
    const sizes = dets.map(d => lib.sizeOf(d.lm)), biggest = Math.max(0, ...sizes);
    const stay = lib.STAY ?? lib.CLOSE;
    dets.forEach((d, i) => {
      const p = d.person;
      if (p.role){ p.sizeRatio = biggest ? sizes[i] / biggest : 1; return; }
      const close = sizes[i] >= stay * biggest, sat = lib.seated(d.lm);
      p.sizeRatio = biggest ? sizes[i] / biggest : 1;
      p.notClose = close ? 0 : (p.notClose || 0) + dt;
      p.notPlaying = (!sat && close) ? 0 : (p.notPlaying || 0) + dt;
      if (p.notPlaying > lib.WATCH_AFTER && !p.wouldEject){ p.wouldEject = true; p.ejections = (p.ejections || 0) + 1; }
      if (p.notPlaying === 0) p.wouldEject = false;
      const inFrame = d.lm[L.NOSE].v > 0.5;
      if (!inFrame || d.lm[L.L_WRIST].v < 0.3 || d.lm[L.R_WRIST].v < 0.3) p.stats.offFrame++;
    });
    pose._assign(dets.map(d => d.lm), dt);
    /* a watcher the tracker lets in is the thing to catch: count the frames someone in the picture beside it is a player */
    for (const d of dets){
      const p = d.person; if (!p.role) continue;
      p.frames = (p.frames || 0) + 1;
      /* a player whose head is nearer this watcher than anyone else in the picture is the watcher, let in */
      const dh = (q, o) => Math.hypot((q.head.x - o.J.nose.x) * A, q.head.y - o.J.nose.y);
      if (pose.players.some(q => q.present && q.head && dets.every(e => e.person === p || dh(q, p) < dh(q, e.person)) && dh(q, p) < 0.3 * p.h)) p.playerFrames = (p.playerFrames || 0) + 1;
    }
    if (this.assist){
      for (const d of dets){
        const p = d.person;
        if (p.role) continue;
        if (this._slotOf(p) >= 0){ p.noSlotFor = 0; continue; }
        /* give the tracker its chance first: a second to let someone in, half a second to pick someone up again */
        p.noSlotFor = (p.noSlotFor || 0) + dt;
        if (p.noSlotFor < (p.everIn ? 0.5 : 1.0)) continue;
        const free = pose.players.findIndex((q, i) => !q.present && i < pose.cap);
        if (free < 0) continue;
        const lm = d.lm, q = pose.players[free];
        const hip = { x: (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, y: (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2 };
        q.lm = null; pose._apply(q, lm, dt); q.head = lib.headOf(lm); q.at = null;
        pose._track(q, { x: hip.x, y: hip.y }, dt);
        q.present = true; q.lostFor = 0; q.watching = 0; p.forced = (p.forced || 0) + 1; p.noSlotFor = 0;
      }
      /* keep forced-in players in, whatever the tracker thinks of their size */
      for (const q of pose.players) if (q.present) q.watching = Math.min(q.watching, lib.WATCH_AFTER * 0.5);
    }
    pose.at(this.t * 1000);
    pose.personCount = pose.players.filter(p => p.present).length;
    this._map(world);
  }
  _slotOf(person){ return person.slot >= 0 && this.pose.players[person.slot] && this.pose.players[person.slot].present && this._near(person, this.pose.players[person.slot]) ? person.slot : -1; }
  _near(person, q){ const c = person.centre(); return Math.hypot((q.centre.x - c.x) * A, q.centre.y - c.y) < 0.35 * Math.max(person.h, 0.3); }
  /* who is in which place: the nearest body, once each */
  _map(world){
    const pose = this.pose, pairs = [];
    world.persons.forEach(p => { if (!p.inScene) return; const c = p.centre(); pose.players.forEach((q, i) => { if (!q.present) return; pairs.push({ p, i, d: Math.hypot((q.centre.x - c.x) * A, q.centre.y - c.y) }); }); });
    pairs.sort((a, b) => a.d - b.d);
    const usedP = new Set(), usedI = new Set();
    for (const { p, i, d } of pairs){ if (usedP.has(p) || usedI.has(i) || d > 0.4) continue; usedP.add(p); usedI.add(i); if (p.slot !== i && p.slot >= 0) p.slotChanges = (p.slotChanges || 0) + 1; p.slot = i; }
    for (const p of world.persons) if (!usedP.has(p)){ p.slot = -1; }
    for (const p of world.persons){ p.present = p.slot >= 0; if (p.present) p.everIn = true; }
  }
}

/* ------------------------------------------------------------------------------------------------------------------ the moves (shared by Animal Gym, Save the Harvest, the story) */
/* One person doing a move in rhythm. Returns true while it asks the body for something. */
export function doMove(p, move, now, dt){
  const K = p.kind, ch = p.isChild, ph = (p.mem.movePh = (p.mem.movePh || 0) + dt * (ch ? between(p.rng, 0.9, 1.15) : 0.85 + 0.1 * Math.sin(now))), cyc = ph;
  const per = (a, b) => ch ? a : b;       /* [child period, adult period] */
  const sh = p.J.shY, headTop = p.J.topY;
  if (move === 'reach'){
    const T = per(0.9, 1.4), u = (cyc % T) / T;
    const up = u < 0.55;
    const gy = up ? headTop - p.armLen * p.k * 0.45 : sh + p.armLen * p.k * 0.5;
    p.L.goal(p.J.lSh.x - 0.015, gy, now); p.R.goal(p.J.rSh.x + 0.015, gy, now);
  } else if (move === 'flap'){
    const T = per(0.55, 0.8), u = (cyc % T) / T, up = u < 0.5;
    const gy = up ? sh - p.armLen * p.k * 0.8 : sh + p.armLen * p.k * 0.55;
    p.L.goal(p.J.lSh.x - p.armLen * p.k * 0.85 / A, gy, now); p.R.goal(p.J.rSh.x + p.armLen * p.k * 0.85 / A, gy, now);
  } else if (move === 'squat'){
    const T = per(1.2, 2.0), u = (cyc % T) / T;
    p.cmd.crouch = u < 0.5 ? 0.85 * p.amp.squat : 0;
    p.L.goal(p.J.lSh.x - 0.04, sh + p.armLen * p.k * 0.6, now); p.R.goal(p.J.rSh.x + 0.04, sh + p.armLen * p.k * 0.6, now);
  } else if (move === 'march'){
    const T = per(0.9, 1.3), u = (cyc % T) / T;
    p.cmd.kl = u < 0.5 ? p.amp.march : 0; p.cmd.kr = u >= 0.5 ? p.amp.march : 0;
    p.L.release(now); p.R.release(now);
  } else if (move === 'lean'){
    const T = per(1.3, 2.0), u = (cyc % T) / T;
    p.cmd.lean = (Math.sin(u * 2 * Math.PI) > 0 ? 0.9 : -0.9) * p.amp.lean;
    p.L.release(now); p.R.release(now);
  } else if (move === 'tiptoe'){
    /* reaching for something high: up on the toes (4 to 6 cm) with the arms up, then down */
    const T = per(1.6, 2.2), u = (cyc % T) / T;
    p.cmd.tip = u < 0.5 ? (ch ? 0.05 : 0.06) * p.amp.tiptoe : 0;
    const up = u < 0.5, gy = up ? headTop - p.armLen * p.k * 0.5 : sh + p.armLen * p.k * 0.5;
    p.L.goal(p.J.lSh.x - 0.015, gy, now); p.R.goal(p.J.rSh.x + 0.015, gy, now);
  } else if (move === 'bend'){
    /* picking something off the floor: bend over, back up */
    const T = per(1.4, 2.0), u = (cyc % T) / T;
    p.cmd.bend = u < 0.5 ? 0.9 : 0;
    p.L.goal(p.J.lSh.x - 0.02, sh + p.armLen * p.k * 1.0, now); p.R.goal(p.J.rSh.x + 0.02, sh + p.armLen * p.k * 1.0, now);
  } else if (move === 'jump'){
    const T = per(1.1, 1.6);
    const n = Math.floor(cyc / T);
    if (p.mem.jumpN !== n){ p.mem.jumpN = n; p.hop(K.jumpM * (0.7 + 0.6 * p.rng()) * p.amp.jump); }
    p.L.goal(p.J.lSh.x - 0.03, sh + p.armLen * p.k * 0.5, now); p.R.goal(p.J.rSh.x + 0.03, sh + p.armLen * p.k * 0.5, now);
  }
}

/* ------------------------------------------------------------------------------------------------------------------ the brains */
const onScreen = (b) => b.x > 0.03 && b.x < 0.97 && b.y > 0.05 && b.y < 0.97;
/* where something that moves will be after `s` seconds, given what we have seen of it */
function lead(p, key, obj, s){
  const m = p.mem[key] || (p.mem[key] = new Map()), prev = m.get(obj);
  m.set(obj, { x: obj.x, y: obj.y, t: p.mem.now });
  if (!prev || p.mem.now === prev.t) return { x: obj.x, y: obj.y, vx: 0, vy: 0 };
  const dt = p.mem.now - prev.t, vx = (obj.x - prev.x) / dt, vy = (obj.y - prev.y) / dt;
  const f = p.isChild ? 0.6 : 1;
  return { x: obj.x + vx * s * f, y: obj.y + vy * s * f, vx, vy };
}
function idleStance(p, now, laneX){
  p.releaseHands(now);
  if (laneX != null && Math.abs(laneX - p.sx) > 0.03 && p.rng() < 0.01) p.walkTo(laneX);
}

export const BRAINS = {
  /* ------------------------------------------------------------ Pop Party: chase the balloons */
  'pop-party': {
    act(ctx, p, now){
      const g = ctx.inst; p.mem.now = now;
      const cands = [];
      for (const b of g.balloons){
        if (b.dead || !onScreen(b)) continue;
        if (b.giant) continue;
        const l = lead(p, 'bl', b, p.delay + 0.15);
        const r = p.reach(l.x, l.y);
        if (r.kind === 'no') continue;                        /* above (or below) what this body can ever reach */
        const walk = r.kind === 'walk' ? Math.max(0, Math.abs(l.x - p.sx) - p.armLen * 0.9 / A) : 0;
        const walkT = walk / (p.kind.walk * p.ppm * 0.5625);
        const handD = Math.hypot((l.x - (r.side === 'l' ? p.L.x : p.R.x)) * A, l.y - (r.side === 'l' ? p.L.y : p.R.y));
        let cost = walkT + handD / (p.kind.vmax * p.ppm * 0.6) + (r.kind === 'hop' ? 0.6 : r.kind === 'bend' ? 0.3 : 0);
        if (r.kind === 'walk' && walk > 0.28) continue;               /* too far to bother */
        cost -= Math.min(0.5, b.worth * 0.08);
        /* the others: don't crowd someone who is closer */
        for (const q of ctx.world.persons) if (q !== p && !q.lapse && q.tgt === b && Math.abs(q.sx - l.x) < Math.abs(p.sx - l.x)) cost += 0.8;
        cands.push({ b, l, r, cost });
      }
      const an = g.animal && g.animal.popT < 0 ? g.animal : null;
      if (an && an.x > 0.05 && an.x < 0.95){ const r = p.reach(an.x, an.y); if (r.kind !== 'no' && (r.kind !== 'walk' || Math.abs(an.x - p.sx) < 0.3)) cands.push({ b: an, l: { x: an.x, y: an.y }, r, cost: 0.6 + (r.kind === 'walk' ? 0.8 : 0) }); }
      /* the giant: slap it, in and out */
      const gb = g.balloons.find(b => b.giant && !b.dead && b.y - b.r < 0.7);
      if (gb){
        const dx = (gb.x - p.sx) * A, dy = gb.y - p.J.shY, side = gb.x < p.sx ? -1 : 1;
        const toward = Math.hypot(dx, dy) || 1;
        const inside = { x: gb.x - Math.sign(dx || 1) * 0, y: gb.y }, hit = Math.hypot(dx, dy) < p.armLen * p.k + gb.r * 0.8;
        if (hit){
          const phase = Math.floor(now * 2.2) % 2 === 0;
          const nx = dx / toward, ny = dy / toward;
          const ix = p.sx + (nx * Math.max(0, toward - gb.r * 0.6)) / A, iy = p.J.shY + ny * Math.max(0, toward - gb.r * 0.6);
          const ox = p.sx + (nx * Math.max(0, toward - gb.r * 1.05)) / A, oy = p.J.shY + ny * Math.max(0, toward - gb.r * 1.05);
          const hnd = side < 0 ? 'l' : 'r';
          const Hd = hnd === 'l' ? p.L : p.R;
          Hd.goal(phase ? ix : ox, phase ? iy : oy, now); p.other(hnd).release(now);
          p.state = 'on'; p.tgt = gb; return;
        }
      }
      cands.sort((a, b) => a.cost - b.cost);
      const stick = p.tgt && !p.tgt.dead && cands.find(c => c.b === p.tgt);
      const pick = (stick && now < (p.mem.until || 0)) ? stick : cands[0];
      if (!pick){ p.tgt = null; p.state = 'idle'; idleStance(p, now, 0.5 + (p.idx - (ctx.world.persons.length - 1) / 2) * 0.2); return; }
      if (p.tgt !== pick.b){ p.tgt = pick.b; p.mem.until = now + 0.6 + p.rng() * 0.5; }
      p.state = 'on';
      const side = pick.r.side;
      p.approach(pick.l.x, pick.l.y, now, { hand: side });
      p.other(side).goal(p.shoulderOf(side === 'l' ? 'r' : 'l').x, p.J.shY + p.armLen * p.k * 0.5, now);
    }
  },

  /* ------------------------------------------------------------ Sleepy Bear: dance, then freeze */
  'sleepy-bear': {
    act(ctx, p, now, dt){
      const g = ctx.inst;
      if (g.phase === 'dance'){
        p.mem.froze = null;
        p.state = 'on';
        p.mem.dt = (p.mem.dt || 0) + dt * (p.isChild ? 1.25 : 1);
        const t = p.mem.dt, A1 = p.isChild ? 1.1 : 0.9;
        p.cmd.lean = Math.sin(t * 5) * 0.8;
        const sh = p.J.shY, R = p.armLen * p.k;
        p.L.goal(p.J.lSh.x - 0.03 + Math.sin(t * 6) * 0.05, sh - R * 0.5 + Math.cos(t * 5.2) * R * 0.5 * A1, now);
        p.R.goal(p.J.rSh.x + 0.03 + Math.sin(t * 6 + 1) * 0.05, sh - R * 0.5 + Math.sin(t * 5.2) * R * 0.5 * A1, now);
        if (p.rng() < dt * 0.4) p.hop(p.kind.hopM * 0.6);
      } else {
        /* the music stopped: stop where you are (a reaction time later, then the arms slow down), and hold still. A child can't help giggling and shifting now and then. */
        if (p.mem.froze == null) p.mem.froze = now;
        p.state = 'on';
        p.cmd.hold = true; p.L.vel(0, 0, now); p.R.vel(0, 0, now);
        if (p.isChild){
          if (!p.mem.nextTwitch || p.mem.nextTwitch < now - 20) p.mem.nextTwitch = now + between(p.rng, 1, 5);
          if (now > p.mem.nextTwitch){ p.mem.twitchEnd = now + 0.3; p.mem.nextTwitch = now + between(p.rng, 3, 9); p.mem.twDir = p.rng() < 0.5 ? -1 : 1; }
          if (p.mem.twitchEnd && now < p.mem.twitchEnd){ p.cmd.hold = false; p.cmd.lean = p.mem.twDir * 0.7; }
        } else if (p.rng() < dt * 0.04){ p.mem.twitchEnd = now + 0.25; p.mem.twDir = p.rng() < 0.5 ? -1 : 1; }
        if (!p.isChild && p.mem.twitchEnd && now < p.mem.twitchEnd){ p.cmd.hold = false; p.cmd.lean = p.mem.twDir * 0.3; }
      }
    }
  },

  /* ------------------------------------------------------------ Leaf Pile: sweep leaves to the pile, then jump in */
  'leaf-pile': {
    act(ctx, p, now, dt){
      const g = ctx.inst;
      p.mem.now = now;
      if (g.ready){
        p.state = 'on';
        if (!p.mem.jumpAt){ p.mem.jumpAt = now + p.rng() * 0.6; }
        if (now >= p.mem.jumpAt && !p.mem.jumped){ p.mem.jumped = true; p.hop(p.kind.jumpM * (0.7 + 0.6 * p.rng())); }
        const sh = p.J.shY; p.L.goal(p.J.lSh.x - 0.03, sh - 0.05, now); p.R.goal(p.J.rSh.x + 0.03, sh - 0.05, now);
        return;
      }
      p.mem.jumped = false; p.mem.jumpAt = 0;
      /* the leaf I'm after */
      const dirOf = (L) => Math.sign(0.5 - L.x) || 1;
      if (!p.leaf || p.leaf.inPile || p.leaf.air || now > p.mem.leafUntil){
        let best = null, bc = 1e9;
        for (const L of g.leaves){
          if (L.inPile || L.air || L.y < 0.4 || L.x < 0.03 || L.x > 0.97) continue;
          if (Math.abs(L.x - 0.5) < 0.05) continue;
          const startX = L.x - dirOf(L) * 0.09;
          const dwalk = Math.max(0, Math.abs(startX - p.sx) * A - p.armLen * p.k * 0.8);
          let cost = dwalk * 2.2 + Math.abs(L.y - p.J.shY - p.armLen * p.k) * 0.5 + Math.abs(L.x - 0.5) * 0.4;
          for (const q of ctx.world.persons) if (q !== p && q.leaf === L) cost += 0.8;
          if (dwalk > 0.5) continue;
          if (cost < bc){ bc = cost; best = L; }
        }
        p.leaf = best; p.mem.leafUntil = now + 4; p.mem.stroke = null;
      }
      const Lf = p.leaf;
      if (!Lf){ p.state = 'idle'; idleStance(p, now, 0.5 + (p.idx - (ctx.world.persons.length - 1) / 2) * 0.2); return; }
      p.state = 'on';
      const dir = dirOf(Lf), sx0 = Lf.x - dir * 0.10, y0 = clamp(Lf.y, 0.4, 0.92), hand = p.nearestSide(sx0);
      const Hd = hand === 'l' ? p.L : p.R;
      p.other(hand).release(now);
      const needWalk = p.reach(sx0, y0, true, hand).kind === 'walk';
      let st = p.mem.stroke;
      if (!st || st.leaf !== Lf){ st = p.mem.stroke = { leaf: Lf, phase: 'approach', at: now, spd: between(p.rng, 0.65, 0.9) }; }
      p.approach(sx0, y0, now, { hand });
      if (st.phase === 'approach'){
        const d = Math.hypot((sx0 - Hd.x) * A, y0 - Hd.y);
        if (d < 0.05 && now - st.at > 0.1 && !needWalk){ st.phase = 'sweep'; st.at = now; }
        else if (now - st.at > 1.8){ st.at = now; }
      } else if (st.phase === 'sweep'){
        const vmaxH = p.kind.vmax * p.ppm * p.k;
        Hd.vel(dir * vmaxH * st.spd, (y0 - Hd.y) * 4, now);
        if (now - st.at > 0.55 || Math.abs(Hd.x - Lf.x) > 0.12 && Math.sign(Hd.x - Lf.x) === dir){ st.phase = 'back'; st.at = now; }
      } else {
        p.approach(sx0, y0 - 0.03, now, { hand });
        if (now - st.at > 0.35){ st.phase = 'approach'; st.at = now; st.spd = between(p.rng, 0.65, 0.9); }
      }
    }
  },

  /* ------------------------------------------------------------ Stack It High: catch a block, carry it to the tower */
  'stack-it-high': {
    act(ctx, p, now){
      const g = ctx.inst; p.mem.now = now;
      const slot = p.slot;
      if (slot < 0){ p.state = 'idle'; p.releaseHands(now); return; }
      /* (each player has their own blocks and tower: only those count) */
      const mine = g.blocks.find(b => b.held && b.owner === slot && b.held.who === slot);
      if (mine){
        p.state = 'on';
        const side = String(mine.held.key).endsWith('l') ? 'l' : 'r', Hd = side === 'l' ? p.L : p.R;
        /* the hand only has to get to the top of the tower and a little over (HAND_OVER); no further */
        const tx = g.towerX(slot), ty = g._top(slot) + 0.09;
        p.walkTo(tx + (p.sx < tx ? -1 : 1) * 0.045);
        Hd.goal(tx, ty, now); p.other(side).release(now);
        const r = p.reach(tx, ty); if (r.kind === 'hop' && Math.abs(p.sx - tx) < 0.12) p.hop(p.kind.hopM);
        return;
      }
      let best = null, bc = 1e9;
      for (const b of g.blocks){
        if (b.held || b.y < 0.0 || b.owner !== slot) continue;
        const r = p.reach(b.x, b.y);
        const walk = Math.max(0, Math.abs(b.x - p.sx) * A - p.armLen * p.k * 0.8);
        let cost = walk * 2.0 + (r.kind === 'hop' ? 0.5 : r.kind === 'bend' ? 0.3 : 0);
        if (r.kind === 'no' || walk > 0.6) continue;
        if (cost < bc){ bc = cost; best = { b, r }; }
      }
      if (!best){ p.tgt = null; p.state = 'idle'; idleStance(p, now, g.towerX(slot)); return; }
      p.tgt = best.b; p.state = 'on';
      const l = lead(p, 'bk', best.b, p.delay);
      p.approach(l.x, l.y, now, { hand: best.r.side });
      p.other(best.r.side).release(now);
    }
  },

  /* ------------------------------------------------------------ Sky Painter: sweep the blank parts */
  'sky-painter': {
    act(ctx, p, now, dt){
      const g = ctx.inst; p.mem.now = now;
      const [gx, gy] = [48, 27];
      if (g.alive){ p.state = 'wait'; p.releaseHands(now); return; }
      if (!p.mem.tgt || now > p.mem.until){
        /* pick an unpainted spot we can get a hand to (near us first), with a little randomness */
        let best = null, bc = 1e9;
        for (let n = 0; n < 40; n++){
          const cx = Math.floor(p.rng() * gx), cy = Math.floor(p.rng() * gy);
          if (g.cells[cy * gx + cx]) continue;
          const tx = (cx + 0.5) / gx, ty = (cy + 0.5) / gy, r = p.reach(tx, ty);
          if (r.kind === 'no') continue;
          const walk = Math.max(0, Math.abs(tx - p.sx) * A - p.armLen * p.k * 0.8);
          const cost = walk * 1.5 + (r.kind === 'hop' ? 0.4 : 0) + (r.kind === 'bend' ? 0.25 : 0) + p.rng() * 0.2 + Math.hypot((tx - p.L.x) * A, ty - p.L.y) * 0.2;
          if (walk > 0.7) continue;
          if (cost < bc){ bc = cost; best = { tx, ty }; }
        }
        if (best){ p.mem.tgt = best; p.mem.until = now + between(p.rng, 1.2, 2.5); p.mem.ph = 0; }
        else { p.mem.tgt = null; p.state = 'idle'; p.mem.until = now + 0.5; idleStance(p, now, 0.5); return; }
      }
      const t = p.mem.tgt; if (!t){ p.state = 'idle'; return; }
      p.state = 'on';
      p.mem.ph += dt * (p.isChild ? 4.5 : 3.2);
      const wob = Math.sin(p.mem.ph) * 0.07, wob2 = Math.cos(p.mem.ph * 0.8) * 0.05;
      const side = p.reach(t.tx, t.ty).side;
      p.approach(clamp(t.tx + wob, 0.02, 0.98), clamp(t.ty + wob2 * 1.6, 0.02, 0.98), now, { hand: side });
      p.other(side).release(now);
    }
  },

  /* ------------------------------------------------------------ Animal Gym: do the animal's move */
  'animal-gym': {
    act(ctx, p, now, dt){
      const g = ctx.inst;
      /* after the coach changes the move, it takes a moment to start */
      if (p.mem.seg !== g.seg){ p.mem.seg = g.seg; p.mem.startAt = now + 0.25 + p.rng() * 0.5; p.mem.movePh = 0; }
      if (now < p.mem.startAt){ p.state = 'wait'; p.releaseHands(now); return; }
      p.state = 'on';
      if (g.fill >= 1 && p.rng() < dt * 0.6){ /* the bar is full: carry on, but a bit looser */ }
      doMove(p, g.move, now, dt);
    }
  },

  /* ------------------------------------------------------------ Keep It Up: get under the ball */
  'keep-it-up': {
    act(ctx, p, now, dt){
      const g = ctx.inst; p.mem.now = now;
      /* the ball I'm after: the one nearest to where I stand that is coming down (or will be) */
      let best = null, bc = 1e9;
      for (const b of g.balls){
        if (b.gone) continue;
        const sy = p.restShY() + p.armLen * p.k * 0.2;           /* the height I like to hit it at: about chest high */
        /* when will it be at that height going down? a ball that never gets that high (a low bounce) is met lower down, bending for it */
        const gr = 0.5;
        let yHit = clamp(sy, 0.3, 0.8), disc = b.vy * b.vy + 2 * gr * (yHit - b.y);
        for (let k = 0; disc < 0 && k < 8; k++){ yHit = Math.min(0.88, yHit + 0.06); disc = b.vy * b.vy + 2 * gr * (yHit - b.y); }
        if (disc < 0) continue;
        const tt = (-b.vy + Math.sqrt(disc)) / gr;
        const x = clamp(b.x + b.vx * tt * 0.8, 0.05, 0.95);
        const walkNeed = Math.max(0, Math.abs(x - p.sx) * A - p.armLen * p.k * 0.9);
        const walkT = walkNeed / (p.kind.walk * p.ppm);
        const handT = 0.25;
        if (walkT > tt + 0.3) continue;
        let cost = Math.abs(x - p.sx) * 2 + tt * 0.3;
        for (const q of ctx.world.persons) if (q !== p && !q.lapse && q.tgt === b && Math.abs(q.sx - x) < Math.abs(p.sx - x) - 0.03) cost += 1.5;
        if (cost < bc){ bc = cost; best = { b, x, tt, yHit }; }
      }
      if (!best){ p.tgt = null; p.state = 'idle'; idleStance(p, now, null); return; }
      p.tgt = best.b; p.state = 'on';
      const side = best.x < p.sx ? 'l' : 'r';
      const r = p.reach(best.x, best.yHit);
      if (r.kind === 'walk') p.walkTo(best.x);
      p.approach(best.x, best.yHit - 0.02, now, { hand: r.side, allowHop: false });
      p.other(r.side).release(now);
    }
  },

  /* ------------------------------------------------------------ Pterry Flight: wings out, tilt to steer */
  'ptero-flight': {
    act(ctx, p, now, dt){
      const g = ctx.inst; p.state = 'on';
      const sh = p.J.shY, R = p.armLen * p.k;
      /* where is the wonder, relative to my heading? */
      let bank = 0, pitch = 0;
      let near = null, bd = 1e9;
      for (const w of g.wonders){ if (w.got) continue; const d = Math.hypot(w.x - g.x, w.z - g.z); if (d < bd){ bd = d; near = w; } }
      if (near){
        const ang = Math.atan2(near.x - g.x, near.z - g.z) - g.head, a = Math.atan2(Math.sin(ang), Math.cos(ang));
        bank = clamp(a * 1.6, -1, 1);
      } else bank = Math.sin(now * 0.4 + p.idx) * 0.3;
      /* about level: climb if low, dive if high */
      pitch = clamp((2.8 - g.alt) * 0.5, -0.7, 0.7);
      p.mem.bank = (p.mem.bank ?? 0) + (bank - (p.mem.bank ?? 0)) * Math.min(1, dt * 2);
      /* arms spread: the wrist heights make the bank and pitch (steerOf: bank = (right y - left y) / scale / 0.5) */
      const s = p.torso() * 2.4, my = sh - pitch * s * 0.5 * 0.9, dy = p.mem.bank * s * 0.5;
      const lx = p.J.lSh.x - R * 0.97 / A, rx = p.J.rSh.x + R * 0.97 / A;
      const lyT = my - dy / 2, ryT = my + dy / 2;
      p.L.goal(lx, clamp(lyT, sh - R * 0.98, sh + R * 0.98), now); p.R.goal(rx, clamp(ryT, sh - R * 0.98, sh + R * 0.98), now);
    }
  },

  /* ------------------------------------------------------------ Save the Harvest: whatever the wheel says, do that move */
  'save-the-harvest': {
    act(ctx, p, now, dt){
      const g = ctx.inst;
      if (g.phase !== 'move'){ p.state = 'wait'; p.mem.armed = true; p.releaseHands(now); return; }
      if (p.mem.armed !== false){ p.mem.armed = false; p.mem.startAt = now + 0.2 + p.rng() * 0.4; p.mem.movePh = 0; }
      if (now < p.mem.startAt){ p.state = 'wait'; p.releaseHands(now); return; }
      p.state = 'on';
      let move = { apple: 'reach', pear: 'jump', berry: 'squat', raven: 'flap' }[g.kind];
      if (g.kind === 'pear' && g.reachOk) move = 'reach';       /* the words say "Hop or reach up high!": a person who can't hop reaches */
      doMove(p, move, now, dt);
    }
  },

  /* ------------------------------------------------------------ the story: copy the card, if you like */
  'cubions-long-way-home': {
    act(ctx, p, now, dt){
      const g = ctx.inst, card = g.card && g.card();
      if (!card){ p.state = 'wait'; p.mem.cardAt = null; p.releaseHands(now); return; }
      if (p.mem.cardAt == null){ p.mem.cardAt = now + 0.3; p.mem.movePh = 0; }
      if (now < p.mem.cardAt){ p.state = 'wait'; return; }
      p.state = 'on';
      const m = { reach: 'reach', jump: 'jump', flap: 'flap', squat: 'squat' }[card];
      if (m) doMove(p, m, now, dt);
    }
  }
};
