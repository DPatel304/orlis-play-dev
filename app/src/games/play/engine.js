/* The engine of Orlis.play: turns a game description (see vocabulary.js) into a game the shell can run - things appear and move,
   hands touch them, rules fire, the screen is drawn from the asset library, and the shared screen (hint words, goal bar, move
   card, scores) is filled in. It draws only with the library and has no code of a creator's in it.

   env says what to use: { pose, sfx, assets, ui: { say, goal }, colors, max } - the sandbox's own in a creator's game, stand-ins in the tests. */
import { MOVES, COLORS } from './vocabulary.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HAND_REACH = 0.045, SWIPE = 0.45, FLOOR = 0.9, CEIL = 0.2;
/* a colour word (red), a palette name (touch.mint, from the master palette via assets.color) or a #rrggbb */
const hexOf = (c, env) => COLORS[c] || (typeof c === 'string' && c.includes('.') && env && env.assets && env.assets.color ? env.assets.color(c) : c);

export function makePlay(spec, env){
  return { secs: spec.endless ? 600 : (spec.secs ?? 90), endless: !!spec.endless, create(n){ return new PlayRound(spec, n, env); } };
}

class PlayRound {
  constructor(spec, players, env){
    this.spec = spec; this.n = players; this.env = env; this.rnd = env.random || Math.random;
    this.defs = spec.things.map((t, i) => {
      const move = t.moves || 'stay';
      return { ...t, id: i, move, sz: t.size ?? 0.09, sp: t.speed ?? MOVES[move].speed, timer: 0.4 };
    });
    this.score = Array.from({ length: env.max }, () => 0); this.total = 0;
    this.things = []; this.fx = []; this.texts = [];
    this.t = 0; this.over = false; this.hint = spec.hint || null; this.hintIcon = spec.hintIcon || ''; this.hintT = 0; this.goalDone = false; this.endIn = -1; this.cheering = 0;
    /* what's there from the start */
    this.defs.forEach((d, k) => { if (!d.appears){ const c = d.count ?? 1; for (let i = 0; i < c; i++) this._make(d, d.at ? { ...d.at } : c === 1 ? { x: 0.5, y: d.move === 'bounce' ? 0.4 : 0.5 } : { x: 0.15 + this.rnd() * 0.7, y: 0.3 + this.rnd() * 0.3 }); } });
  }

  _make(d, at){
    if (this.things.length >= 80) return null;
    const r = this.rnd, from = (d.appears && d.appears.from) || (d.move === 'fall' ? 'top' : d.move === 'rise' ? 'bottom' : d.move === 'drift' ? (r() < 0.5 ? 'left' : 'right') : 'anywhere');
    let x = 0.5, y = 0.5, dir = r() < 0.5 ? -1 : 1;
    if (at){ x = at.x; y = at.y; }
    else if (from === 'top'){ x = 0.08 + r() * 0.84; y = -0.06; }
    else if (from === 'bottom'){ x = 0.08 + r() * 0.84; y = 1.06; }
    else if (from === 'left'){ x = -0.06; y = 0.2 + r() * 0.5; dir = 1; }
    else if (from === 'right'){ x = 1.06; y = 0.2 + r() * 0.5; dir = -1; }
    else { x = 0.12 + r() * 0.76; y = 0.2 + r() * 0.55; }
    const pieces = Array.isArray(d.piece) ? d.piece : [d.piece], cols = d.color === undefined ? [null] : Array.isArray(d.color) ? d.color : [d.color];
    const th = { d, x, y, vx: 0, vy: 0, rot: 0, spin: d.spins ? (r() - 0.5) * 3 : 0, sz: d.sz, piece: pieces[(r() * pieces.length) | 0], color: cols[(r() * cols.length) | 0],
      age: 0, ph: r() * 6.28, dir, cool: 0, base: y, dead: false, fired: {}, tx: x, ty: y, tt: 0, sp: d.sp * (0.8 + r() * 0.4), flip: false };
    this.things.push(th);
    return th;
  }

  /* every hand that's playing (with the mouse, one hand) */
  _hands(){
    const out = [];
    for (let i = 0; i < this.n; i++){
      const p = this.env.pose.players[i];
      if (!p || !p.present) continue;
      for (const h of this.env.pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right]) if (h) out.push({ i, h });
    }
    return out;
  }

  step(dt, W, H){
    this.t += dt; this.hintT += dt; this.cheering = Math.max(0, this.cheering - dt);
    const aspect = W / H, secs = this.spec.endless ? 600 : (this.spec.secs ?? 90);
    if (this.endIn >= 0){ this.endIn -= dt; if (this.endIn <= 0) this.over = true; }
    else if (!this.spec.endless && this.t >= secs) this.over = true;
    /* more keep coming */
    for (const d of this.defs){
      if (!d.appears) continue;
      d.timer -= dt;
      if (d.timer > 0) continue;
      const a = d.appears, e0 = a.every, e1 = a.everyEnd ?? a.every;
      d.timer = e0 + (e1 - e0) * clamp(this.t / secs, 0, 1);
      if (this.things.filter(x => x.d === d && !x.dead).length < (a.max ?? 8)) this._make(d);
    }
    const hands = this._hands();
    for (const th of this.things){
      if (th.dead) continue;
      th.age += dt; th.cool = Math.max(0, th.cool - dt); th.rot += th.spin * dt;
      this._move(th, dt);
      /* the rules */
      for (const rule of th.d.rules || []){
        if (th.dead) break;
        if (rule.when === 'touched' || rule.when === 'swiped'){
          if (th.cool > 0) continue;
          for (const { i, h } of hands){
            const dx = (th.x - h.x) * aspect, dy = th.y - h.y;
            if (Math.hypot(dx, dy) > th.sz / 2 + HAND_REACH) continue;
            if (rule.when === 'swiped' && !(h.speed > SWIPE)) continue;
            th.cool = th.d.move === 'bounce' ? 0.25 : 0.2;
            this._fire(th, rule, i, h);
            break;
          }
        } else if (rule.when === 'leftScreen'){
          const out = th.y > 1.1 || th.y < -0.1 || th.x < -0.1 || th.x > 1.1;
          if (out && th.age > 0.3 && !th.fired.left){ th.fired.left = true; this._fire(th, rule, -1); }
        } else if (rule.when === 'lands'){
          if (th.landedNow || (th.landed && !th.fired.lands)){ th.fired.lands = true; this._fire(th, rule, -1); }
        } else if (rule.when === 'age'){
          if (th.age >= rule.after && !th.fired['age' + rule.after]){ th.fired['age' + rule.after] = true; this._fire(th, rule, -1); }
        }
      }
      /* (gone: off the screen with nothing to say about it) */
      if (th.d.appears && (th.y > 1.15 || th.y < -0.15 || th.x < -0.15 || th.x > 1.15) && th.age > 0.5) th.dead = true;
    }
    this.things = this.things.filter(t => !t.dead);
    for (const f of this.fx) f.age += dt; this.fx = this.fx.filter(f => f.age < 0.6);
    for (const x of this.texts){ x.age += dt; x.y -= 0.07 * dt; } this.texts = this.texts.filter(x => x.age < 0.9);
    /* the goal */
    const g = this.spec.goal;
    if (g && !this.goalDone && this.total >= g.score){
      this.goalDone = true; this._celebrate();
      if (g.ends) this.endIn = 2.5;
    }
  }

  _move(th, dt){
    const d = th.d, t = this.t, sp = th.sp, sway = d.sway || 0;
    th.landedNow = false;
    switch (d.move){
      case 'fall': th.y += sp * dt; th.x += Math.sin(t * 1.5 + th.ph) * sway * dt * 4; if (th.y >= FLOOR && !th.landed && !d.appears){ th.y = FLOOR; th.landed = true; } break;
      case 'rise': th.y -= sp * dt; th.x += Math.sin(t * 1.5 + th.ph) * sway * dt * 4 + Math.sin(t * 0.8 + th.ph) * 0.01 * dt * 4; break;
      case 'drift': th.x += th.dir * sp * dt; th.y += Math.sin(t * 1.2 + th.ph) * 0.02 * dt; th.flip = th.dir < 0 === !!d.flips; break;
      case 'bob': th.y = th.base + Math.sin(t * 2 + th.ph) * 0.012; break;
      case 'wander':
        th.tt -= dt;
        if (th.tt <= 0){ th.tt = 2 + this.rnd() * 2; th.tx = 0.1 + this.rnd() * 0.8; th.ty = 0.22 + this.rnd() * 0.55; }
        { const dx = th.tx - th.x, dy = th.ty - th.y, m = Math.hypot(dx, dy) || 1; th.x += dx / m * Math.min(m, sp * dt); th.y += dy / m * Math.min(m, sp * dt); th.flip = (dx < 0) === !!d.flips; }
        break;
      case 'bounce':
        th.vy += 0.5 * dt; th.x += th.vx * dt; th.y += th.vy * dt; th.vx *= Math.pow(0.6, dt); th.rot += th.spin * dt; th.spin *= Math.pow(0.5, dt);
        if (th.x < 0.05){ th.x = 0.05; th.vx = Math.abs(th.vx) * 0.7; } if (th.x > 0.95){ th.x = 0.95; th.vx = -Math.abs(th.vx) * 0.7; }
        if (th.y < CEIL){ th.y = CEIL; th.vy = Math.abs(th.vy) * 0.3; }
        if (th.y > FLOOR){ th.y = FLOOR; if (th.vy > 0.2) th.landedNow = true; th.vy = -0.55; th.vx *= 0.5; th.spin = (this.rnd() - 0.5) * 6; }
        break;
      default: break;          /* stay */
    }
  }

  _fire(th, rule, who, hand){
    for (const res of rule.then){
      const key = typeof res === 'string' ? res : Object.keys(res)[0], v = typeof res === 'object' ? res[key] : undefined;
      const colour = who >= 0 ? this.env.colors[who] : hexOf(th.color, this.env) || '#ffe680';
      switch (key){
        case 'score': {
          const n = v ?? 1, add = (a, i) => { a[i] = Math.max(0, a[i] + n); };
          this.total = Math.max(0, this.total + n);
          /* a point from the game itself (a thing left the screen, a ball landed) goes to everyone playing; a loss never takes a score below 0 */
          if (who >= 0) add(this.score, who); else for (let i = 0; i < this.n; i++){ const p = this.env.pose.players[i]; if (p && p.present) add(this.score, i); }
          this.texts.push({ x: th.x, y: th.y - th.sz * 0.6, text: (n < 0 ? '' : '+') + n, color: colour, age: 0 }); break;
        }
        case 'sparkle': this.fx.push({ kind: 'sparkle', x: th.x, y: th.y, size: th.sz * 2.2, color: hexOf(th.color, this.env) || '#ffe680', age: 0 }); break;
        case 'pop': this.fx.push({ kind: 'popring', x: th.x, y: th.y, size: th.sz * 2.4, color: colour, age: 0 }); break;
        case 'vanish': th.dead = true; break;
        case 'grow': th.sz = clamp(th.sz * (v ?? 1.3), 0.02, 0.4); break;
        case 'become': th.piece = v; break;
        case 'sound': this.env.sfx[v] && this.env.sfx[v](); break;
        case 'say': if (v && typeof v === 'object'){ this.hint = v.text; this.hintIcon = v.icon || ''; } else { this.hint = v; this.hintIcon = ''; } this.hintT = 0; break;
        case 'spawn': { const d = this.defs.find(x => x.name === v); if (d) this._make(d, { x: th.x, y: th.y }); break; }
        case 'kickUp':
          th.vy = -(0.62 + clamp(-((hand && hand.vy) || 0) * 0.15, 0, 0.2)); th.vx = clamp(th.vx * 0.3 + ((hand && hand.vx) || 0) * 0.5, -0.45, 0.45); th.spin = th.vx * 8 + (this.rnd() - 0.5) * 4; break;
        case 'celebrate': this._celebrate(); break;
        default: break;
      }
    }
  }

  _celebrate(){
    this.cheering = 1.2;
    for (let k = 0; k < 12; k++) this.fx.push({ kind: 'sparkle', x: 0.15 + this.rnd() * 0.7, y: 0.2 + this.rnd() * 0.5, size: 0.25 * 720, color: ['#ffd35c', '#ff7eb3', '#7fd6a2', '#7ab8ff'][k % 4], age: -k * 0.04, big: true });
    this.env.sfx.hooray && this.env.sfx.hooray();
  }

  draw(c, W, H){
    const A = this.env.assets, secs = this.spec.endless ? 600 : (this.spec.secs ?? 90);
    A.scene(c, W, H, this.spec.scene || 'meadow', { t: this.t, p: clamp(this.t / secs, 0, 1) });
    for (const th of [...this.things].sort((a, b) => a.y - b.y))
      A.draw(c, th.piece, th.x * W, th.y * H, th.sz * H, { color: th.color ? hexOf(th.color, this.env) : undefined, rotate: th.rot, flip: th.flip, t: th.age, shadow: th.d.move === 'bounce' });
    for (const f of this.fx) if (f.age >= 0) A.draw(c, f.kind, f.x * W, f.y * H, f.big ? H * 0.28 : f.size * H, { color: f.color, t: f.age / 0.6 });
    for (const x of this.texts) A.text(c, x.text, x.x * W, x.y * H, H * 0.05, { color: '#fff', outline: x.color, alpha: 1 });
    const hf = this.spec.hintFor ?? 8;
    if (this.hint) this.env.ui.say(c, W, H, { icon: this.hintIcon, text: this.hint, t: this.hintT, until: hf });
    if (this.spec.goal) this.env.ui.goal(c, W, H, clamp(this.total / this.spec.goal.score, 0, 1));
    /* the players' hands, last, on top of everything */
    for (const { i, h } of this._hands()) A.draw(c, 'hand', h.x * W, h.y * H, H * 0.12, { color: this.env.colors[i] });
  }

  /* the move card, bottom left, for the first cardFor seconds (or all round) */
  card(){ const s = this.spec; return s.card && (s.cardFor == null || this.t < s.cardFor) ? s.card : null; }
  hud(){ return { score: this.score, showLives: false, hideScore: !!this.spec.team }; }
  value(){ return this.spec.team ? this.total : Math.max(0, ...this.score.slice(0, this.n)); }
  get mood(){ return clamp(0.2 + this.cheering * 0.5 + Math.min(0.4, this.total / 100), 0, 1); }
}
