/* The engine of Orlis.play: turns a game description (see vocabulary.js) into a game the shell can run - things appear and move,
   hands touch them, rules fire, the screen is drawn from the asset library, and the shared screen (hint words, goal bar, move
   card, scores) is filled in. It draws only with the library and has no code of a creator's in it.

   env says what to use: { pose, sfx, assets, ui: { say, goal }, colors, max } - the sandbox's own in a creator's game, stand-ins in the tests. */
import { MOVES, COLORS, LIMITS } from './vocabulary.js';
import { HandFeel, FEEL } from '../../ui/handfeel.js';
import { handsMode } from '../../ui/handsmode.js';
import { reaches } from '../reach.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HAND_REACH = 0.045, SWIPE = 0.45, FLOOR = 0.9, CEIL = 0.2;
/* a thing that comes out from under the shell's areas (the clock, goal bar and score corner) grows in below them over POPIN seconds, and one
   floating up into them goes (fades) over LEAVE: nothing is ever touched, or looked for, under them (playtest 2, finding 1) */
const POPIN = 0.4, LEAVE = 0.35;
/* Fair for the smallest player (playtest 2, finding 4; games/reach.js says where each player's hands can get to): things that fall or float are
   only there to touch once they are within the reach of the player who reaches least (a grown-up cannot take what a child cannot get to yet);
   they come down the lanes where people stand, a turn each; they go no faster than that player's reach is crossed in BAND_SECS seconds; and they
   are a little bigger for a short arm (up to BIG_MAX times, for an arm of ARM_REF or less). */
const BAND_SECS = 3, ARM_REF = 0.19, BIG_MAX = 1.35, LANE_SPREAD = 0.07, LANE_ANYWHERE = 0.2, GHOST = 0.72;
/* ...and a thing that came down somebody's lane is theirs first: for its first RESERVE seconds in reach only they can touch it (it has their colour round it),
   then anyone can - so a quick grown-up cannot sweep a child's lane clear before the child has had a go */
const RESERVE = 1.4;
/* A ball each (a thing with "each"): it floats in its player's own part of the screen (a lane: LANE_MOST of the way to the next player at most, LANE_LEAST at least),
   is batted up only by that player, goes up to the top of that player's own reach (no faster than RALLY, no slower than LIFT_MIN, in screen heights
   a second: a grown-up's ball cannot be rattled at the ceiling, and a child's never goes where only a grown-up can meet it), and can be batted again only after it has come down below REHIT of the way down its player's reach (0 the top, 1 the knees). A player who
   is gone more than GONE seconds takes their ball with them. A ball cannot be batted again for BAT seconds (a ball under the corner has little room to go up in,
   and a quick hand could otherwise rattle it three times a second). */
const LANE_MOST = 0.2, LANE_LEAST = 0.07, RALLY = 0.45, LIFT_MIN = 0.25, REHIT = 0.45, GONE = 5, BAT = 0.7;
const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
/* a result of a rule: its word, and whether it is a loss (a thing with one is something to dodge, never something to reach for) */
const keyOf = (x) => typeof x === 'string' ? x : Object.keys(x)[0];
const isLoss = (x) => keyOf(x) === 'hurt' || (typeof x === 'object' && keyOf(x) === 'score' && x.score < 0);
/* A Dodge game's health (decisions 0063 and 0064; "health: true"): a hit takes CHUNK of a bar (full is 1; ten hits to empty), and the player is safe for SAFE seconds
   after it, so one thing cannot take several. An empty bar puts that player OUT for the rest of the round (no dizzy spell, no refill): their hands grey and stop
   counting and nothing steers toward them. The round ends when time runs out or everyone playing is out, after a beat of END_BEAT seconds. Things steer toward the
   players (SEEK_TURN radians a second at most, and straight on once within SEEK_COMMIT of them, so a player who moves is missed) and give up after SEEK_LIFE seconds.
   Tuned with the playtest rig so a child in a family and a grown-up last about as long, and standing still runs out sooner than moving. */
const CHUNK = 0.1, SAFE = 2, END_BEAT = 1.6;
const SEEK_TURN = 0.35, SEEK_COMMIT = 0.3, SEEK_LIFE = 14;
/* the tower a "stack" builds (as in Stack It High): one block's size (screen heights), where its ground is, where across the picture it stands,
   how long a block flies to it, how many blocks make a full one by default, and the bonus a full one is worth as it blasts off */
const BLOCK = 0.075, GROUND = 0.93, TOWER_X = 0.5, FLY = 0.5, FULL = 6, BONUS = 5;
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
      /* (fair: something to touch that falls or floats - a Dodge thing is not made bigger or slower for a short player, who is smaller to hit already) */
      const fair = (move === 'fall' || move === 'rise') && (t.rules || []).some(r => (r.when === 'touched' || r.when === 'swiped') && !r.then.some(isLoss));
      return { ...t, id: i, move, sz: t.size ?? 0.09, sp: t.speed ?? MOVES[move].speed, timer: 0.4, fair, each: t.each === true && move === 'bounce' };
    });
    this.score = Array.from({ length: env.max }, () => 0); this.total = 0;
    this.things = []; this.fx = []; this.texts = [];
    this.feel = new HandFeel();         /* the players' glow orbs (ui/handfeel.js): only what is drawn; hits are worked out below from the hands themselves */
    this.counts = {};                 /* how many times each named thing scored (a catch, a dodge, a bat, a block stacked), for the results */
    this.tower = []; this.fliers = []; this.rockets = []; this.towers = 0; this.wob = 0;
    this.reach = reaches(env.max); this.here = []; this.low = null; this.laneTurns = {};
    this.eachT = {}; this.eachHad = {}; this.eachGone = {}; this.aimTurns = {}; this.seen = {};
    /* health (a Dodge game): each player's bar (1 full), the seconds they are safe, the flash of a hit, whether they are out (and when: seconds into the round), and how many hits */
    this.health = spec.health === true;
    const z = () => Array.from({ length: env.max }, () => 0);
    this.hp = Array.from({ length: env.max }, () => 1); this.safe = z(); this.flash = z(); this.out = Array.from({ length: env.max }, () => false); this.outAt = Array.from({ length: env.max }, () => null); this.hits = z(); this.allOut = false;
    this.aspect = 16 / 9; this.zones = []; this._zoneKey = ''; this.t = 0;
    this._refreshZones(1920, 1080);
    this.over = false; this.hint = spec.hint || null; this.hintIcon = spec.hintIcon || ''; this.hintT = 0; this.goalDone = false; this.endIn = -1; this.cheering = 0;
    /* what's there from the start */
    this.defs.forEach((d, k) => { if (!d.appears){ const c = d.count ?? 1; for (let i = 0; i < c; i++) this._make(d, d.at ? { ...d.at } : c === 1 ? { x: 0.5, y: d.move === 'bounce' ? 0.4 : 0.5 } : { x: 0.15 + this.rnd() * 0.7, y: 0.3 + this.rnd() * 0.3 }); } });
  }

  /* ---------- who is here, and what the one who reaches least can get to ---------- */
  /* where each player's hands can get to (games/reach.js, from their own body); `low` is the band of whoever reaches least: the lowest top, the highest bottom */
  _reaches(dt){
    const pose = this.env.pose, mouse = !!(pose.mouse && pose.mouse.active), here = [];
    for (let i = 0; i < this.n; i++){
      const p = pose.players[i]; if (!p || !p.present) continue;
      this.seen[i] = true;
      const r = this.reach[i].step(dt, p, mouse);
      if (r.ready) here.push({ i, x: r.x, top: r.top, bottom: r.bottom, arm: r.arm });
    }
    this.here = here;
    this.low = here.length ? { top: Math.max(...here.map(h => h.top)), bottom: Math.max(...here.map(h => h.bottom)), arm: Math.min(...here.map(h => h.arm)) } : null;
  }
  _here(i){ return this.here.some(h => h.i === i); }
  /* is a thing that falls or floats within reach of the player who reaches least? (others - balls, things that stay or drift - always are) */
  _live(th){
    const low = this.low;
    if (!low || !th.d.fair) return true;
    return th.d.move === 'fall' ? th.y >= low.top - 0.02 : th.y <= low.bottom + 0.02;
  }
  /* where across the screen the next thing comes down: mostly where somebody stands, a turn each (the one who has had the fewest first), a little spread; laneOwner is whose lane it is (null: nobody's) */
  _lane(){
    const h = this.here; this.laneOwner = null;
    if (!h.length || this.rnd() < LANE_ANYWHERE) return 0.08 + this.rnd() * 0.84;
    let pick = h[0];
    for (const q of h){ const a = this.laneTurns[q.i] || 0, b = this.laneTurns[pick.i] || 0; if (a < b || (a === b && this.rnd() < 0.5)) pick = q; }
    this.laneTurns[pick.i] = (this.laneTurns[pick.i] || 0) + 1;
    this.laneOwner = pick.i;
    return clamp(pick.x + (this.rnd() - 0.5) * 2 * LANE_SPREAD, 0.06, 0.94);
  }

  /* ---------- steering toward the players, and health ---------- */
  _present(i){ const p = this.env.pose.players[i]; return !!(p && p.present); }
  /* which player the next thing heads for: a turn each, the one who has had the fewest first (null: nobody is here) */
  _nextTarget(){
    let pick = null;
    for (let i = 0; i < this.n; i++){ if (!this._present(i) || this.out[i]) continue; if (pick == null || (this.aimTurns[i] || 0) < (this.aimTurns[pick] || 0)) pick = i; }
    if (pick != null) this.aimTurns[pick] = (this.aimTurns[pick] || 0) + 1;
    return pick;
  }
  /* where a thing is heading: the middle of its player's hands (where they are, and where they put them), else the middle of their reach */
  _seekTarget(th){
    if (th.target == null || !this._present(th.target) || this.out[th.target]) th.target = this._nextTarget();
    const i = th.target; if (i == null) return null;
    const hs = this._hands().filter(o => o.i === i);
    if (hs.length) return { x: hs.reduce((a, o) => a + o.h.x, 0) / hs.length, y: clamp(hs.reduce((a, o) => a + o.h.y, 0) / hs.length, 0.08, 0.95) };
    const r = this.reach[i]; return r.ready ? { x: r.x, y: r.at(0.5) } : { x: 0.5, y: 0.6 };
  }
  /* a player is touched by something to dodge: with a health bar, a chunk comes off (n chunks), with a flash, a wobble and an ouch, and they are safe for a moment;
     an empty bar puts them out for the rest of the round. Without a bar, it costs them a point. */
  _hurt(who, n, th){
    const sfx = this.env.sfx;
    if (!this.health){
      if (who >= 0) this._points(-n, who, th.x, th.y - th.sz * 0.6, this.env.colors[who]);
      this.wob = 0.5; sfx.ouch && sfx.ouch(); return;
    }
    if (who < 0 || this.safe[who] > 0 || this.out[who]) return;
    this.hits[who]++; this.hp[who] = Math.max(0, this.hp[who] - CHUNK * n); this.safe[who] = SAFE; this.flash[who] = 1; this.wob = 0.5;
    if (this.hp[who] <= 1e-6){
      this.hp[who] = 0; this.out[who] = true; this.outAt[who] = this.t;
      sfx.ouch && sfx.ouch(2);
    } else sfx.ouch && sfx.ouch();
  }
  _healthStep(dt){
    for (let i = 0; i < this.env.max; i++){ this.flash[i] = Math.max(0, this.flash[i] - dt * 2); this.safe[i] = Math.max(0, this.safe[i] - dt); }
    /* everyone playing (here now, or out) is out: a short beat, a sound, then the round is over (a player who left and is not out is not counted; one who comes back
       stays out, and one who joins later starts full) */
    if (this.endIn < 0 && !this.over){
      let any = false, all = true;
      for (let i = 0; i < this.n; i++){ if (!this.seen[i]) continue; if (this.out[i]) any = true; else if (this._present(i)){ all = false; break; } }
      if (any && all){ this.allOut = true; this.endIn = END_BEAT; const sfx = this.env.sfx; sfx.slowmo && sfx.slowmo(); }
    }
  }
  /* how fast things come in a Dodge game: with more players still in, a bit faster (the square root of how many), so each of them is troubled about as much
     whether they play alone or four together */
  _pace(){
    if (!this.health) return 1;
    let k = 0; for (let i = 0; i < this.n; i++) if (this._present(i) && !this.out[i]) k++;
    return Math.sqrt(Math.max(1, k));
  }
  /* a player who is out: grey hands, and nothing counts for them */
  _grey(){ const a = this.env.assets; return a && a.color ? a.color('shade.mid') : 'gray'; }
  _colorOf(i){ return this.health && this.out[i] ? this._grey() : this.env.colors[i]; }

  /* ---------- a ball each ---------- */
  /* where player i's ball floats: the middle of their lane and how far it goes either side (never into the next player's) */
  _lane1(i){
    const r = this.reach[i], x = r.ready ? r.x : 0.5;
    let gap = 1;
    for (const h of this.here) if (h.i !== i) gap = Math.min(gap, Math.abs(h.x - x));
    return { x, hw: clamp(gap * 0.45, LANE_LEAST, LANE_MOST) };
  }
  /* every player here has their ball (up to "appears.max" of them): one floats in a moment after one is lost, and a player who is gone takes theirs with them */
  _balls(dt){
    for (const d of this.defs){
      if (!d.each) continue;
      const per = clamp((d.appears && d.appears.max) ?? 1, 1, 3), wait = d.appears && d.appears.wait != null ? d.appears.wait : 1;
      for (let i = 0; i < this.n; i++){
        const key = d.id + ':' + i, p = this.env.pose.players[i], mine = this.things.filter(t => t.d === d && t.owner === i && !t.dead);
        if (!p || !p.present){ this.eachGone[key] = (this.eachGone[key] || 0) + dt; if (this.eachGone[key] > GONE) for (const t of mine) t.dead = true; continue; }
        this.eachGone[key] = 0;
        if (this.eachT[key] == null) this.eachT[key] = 0.4;
        if (mine.length < (this.eachHad[key] ?? 0)) this.eachT[key] = wait;                  /* one was lost: the next floats in after the wait */
        this.eachHad[key] = mine.length;
        if (mine.length >= per) continue;
        this.eachT[key] -= dt;
        if (this.eachT[key] > 0) continue;
        this.eachT[key] = 0.4;
        const l = this._lane1(i), th = this._make(d, { x: l.x + (this.rnd() - 0.5) * l.hw, y: clamp(this.reach[i].ready ? this.reach[i].top : 0.3, 0.25, 0.5) });
        if (th){ th.owner = i; th.resv = 0; this.eachHad[key] = mine.length + 1; }
      }
    }
  }

  /* ---------- the shell's areas: where nothing may be touched, and nothing should start ---------- */
  /* (re)read where the clock, goal bar, score corner and move card are, for this screen's shape (the move card only while it is up) */
  _refreshZones(W, H){
    const key = W + 'x' + H + (this.card() ? 'c' : '');
    if (key === this._zoneKey) return;
    this._zoneKey = key; this.aspect = W / H;
    const zs = this.env.ui && this.env.ui.zones;
    this.zones = zs ? Object.values(zs(W, H, this.hud())).map(z => ({ x0: z.x / W, y0: z.y / H, x1: (z.x + z.w) / W, y1: (z.y + z.h) / H })) : [];
  }
  /* is a thing of radius r (screen heights) at (x, y) under one of them? */
  _under(x, y, r = 0){ const rx = r / this.aspect; return this.zones.some(z => x + rx > z.x0 && x - rx < z.x1 && y + r > z.y0 && y - r < z.y1); }
  /* the lowest edge of the areas along the top over this column (0: none; sway: how far it may sway sideways as it falls): what comes from above starts below it */
  _roof(x, r, sway = 0){ const rx = r / this.aspect + sway * 2.7; let low = 0; for (const z of this.zones) if (z.y0 < 0.4 && x + rx > z.x0 && x - rx < z.x1) low = Math.max(low, z.y1); return low; }
  /* a spot from f() that is clear of them (a few tries; the last one if none is) */
  _clearSpot(f, r){ let p = f(); for (let k = 0; k < 14 && this._under(p.x, p.y, r); k++) p = f(); return p; }
  /* the heights a thing crossing the whole width can use: between the areas (r: its radius), within lo..hi */
  _band(r, lo, hi){
    const iv = this.zones.map(z => [z.y0 - r - 0.01, z.y1 + r + 0.01]).sort((a, b) => a[0] - b[0]), free = [];
    let at = lo;
    for (const [a, b] of iv){ if (a > at) free.push([at, Math.min(a, hi)]); at = Math.max(at, b); }
    if (at < hi) free.push([at, hi]);
    const ok = free.filter(f => f[1] - f[0] > 0.04);
    return ok.length ? ok : [[lo, hi]];
  }
  _bandY(r, lo, hi){
    const f = this._band(r, lo, hi), total = f.reduce((s, v) => s + v[1] - v[0], 0);
    let k = this.rnd() * total;
    for (const [a, b] of f){ if (k <= b - a) return a + k; k -= b - a; }
    return f[0][0];
  }
  /* a ball (or anything that bounces) meeting one of the areas goes round it, as off a wall */
  _offZones(th){
    const r = th.sz / 2, rx = r / this.aspect;
    for (const z of this.zones){
      const l = th.x + rx - z.x0, rr = z.x1 - (th.x - rx), t = th.y + r - z.y0, b = z.y1 - (th.y - r);
      if (l <= 0 || rr <= 0 || t <= 0 || b <= 0) continue;
      const m = Math.min(l, rr, t, b);
      if (m === b){ th.y = z.y1 + r; th.vy = Math.max(th.vy, 0.15); }
      else if (m === t){ th.y = z.y0 - r; th.vy = -Math.abs(th.vy) * 0.5; }
      else if (m === l){ th.x = z.x0 - rx; th.vx = -Math.abs(th.vx) * 0.7; }
      else { th.x = z.x1 + rx; th.vx = Math.abs(th.vx) * 0.7; }
    }
  }

  _make(d, at){
    if (this.things.length >= 80) return null;
    const r = this.rnd, from = (d.appears && d.appears.from) || (d.move === 'seek' ? ['left', 'right', 'top'][(r() * 3) | 0] : d.move === 'fall' ? 'top' : d.move === 'rise' ? 'bottom' : d.move === 'drift' ? (r() < 0.5 ? 'left' : 'right') : 'anywhere');
    /* (a bit bigger for a short arm, and never faster than the one who reaches least can follow: only for what falls or floats to be touched) */
    const fair = d.fair, big = fair && this.low ? clamp(ARM_REF / Math.max(0.05, this.low.arm), 1, BIG_MAX) : 1, sz = clamp(d.sz * big, LIMITS.size[0], LIMITS.size[1]), rad = sz / 2;
    let x = 0.5, y = 0.5, dir = r() < 0.5 ? -1 : 1, pop = false;
    if (at){ x = at.x; y = at.y; }
    else if (from === 'top'){
      x = this._lane(); y = -0.06;
      /* (a column with the clock, goal bar or score over it: the thing grows in just below them) */
      const roof = this._roof(x, rad, d.sway || 0); if (roof > 0){ y = roof + rad + 0.01; pop = true; }
    }
    else if (from === 'bottom'){ x = this._lane(); y = 1.06; }
    else if (from === 'left'){ x = -0.06; y = this._bandY(rad, 0.2, 0.7); dir = 1; }
    else if (from === 'right'){ x = 1.06; y = this._bandY(rad, 0.2, 0.7); dir = -1; }
    else { const p = this._clearSpot(() => ({ x: 0.12 + r() * 0.76, y: 0.2 + r() * 0.55 }), rad); x = p.x; y = p.y; }
    const pieces = Array.isArray(d.piece) ? d.piece : [d.piece], cols = d.color === undefined ? [null] : Array.isArray(d.color) ? d.color : [d.color];
    const th = { d, x, y, vx: 0, vy: 0, rot: 0, spin: d.spins ? (r() - 0.5) * 3 : 0, sz, owner: fair && (from === 'top' || from === 'bottom') && !at ? this.laneOwner : null, resv: RESERVE, piece: pieces[(r() * pieces.length) | 0], color: cols[(r() * cols.length) | 0],
      age: 0, ph: r() * 6.28, dir, cool: 0, base: y, dead: false, fired: {}, tx: x, ty: y, tt: 0, sp: Math.min(d.sp * (0.8 + r() * 0.4), fair && this.low ? Math.max(0.05, (this.low.bottom - this.low.top) / BAND_SECS) : 9), flip: false, pop, leaving: 0 };
    if (d.move === 'seek'){
      /* it heads for a player, a turn each (the one who has had the fewest first) */
      th.target = this._nextTarget(); const tg = this._seekTarget(th);
      th.ang = tg ? Math.atan2(tg.y - th.y, (tg.x - th.x) * this.aspect) : (from === 'right' ? Math.PI : from === 'top' ? Math.PI / 2 : 0);
    }
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
    this.t += dt; this.hintT += dt; this.cheering = Math.max(0, this.cheering - dt); this.wob = Math.max(0, this.wob - dt);
    const aspect = W / H, secs = this.spec.endless ? 600 : (this.spec.secs ?? 90);
    this._refreshZones(W, H); this._reaches(dt); if (this.health) this._healthStep(dt);
    if (this.endIn >= 0){ this.endIn -= dt; if (this.endIn <= 0) this.over = true; }
    else if (!this.spec.endless && this.t >= secs) this.over = true;
    /* more keep coming */
    this._balls(dt);
    for (const d of this.defs){
      if (!d.appears || d.each) continue;
      d.timer -= dt * this._pace();
      if (d.timer > 0) continue;
      const a = d.appears, e0 = a.every, e1 = a.everyEnd ?? a.every;
      d.timer = e0 + (e1 - e0) * clamp(this.t / secs, 0, 1);
      if (this.things.filter(x => x.d === d && !x.dead).length < (a.max ?? 8)) this._make(d);
    }
    const hands = this._hands();
    /* the orbs follow the hands; what a hand can touch (a good thing, never a thing to dodge) draws it a little toward that thing */
    this.feel.aspect = aspect;
    this.feel.targets(this.things.filter(th => !th.dead && !th.leaving && !this._under(th.x, th.y) && this._live(th) && this._touchable(th) && th.x > -0.05 && th.x < 1.05 && th.y > -0.05 && th.y < 1.05).map(th => ({ x: th.x, y: th.y, r: th.sz / 2 })));
    this.feel.step(dt, hands.map(({ i, h }, k) => ({ key: i + (h === this.env.pose.players[i].hands.left ? 'L' : 'R'), who: i, x: h.x, y: h.y, col: this._colorOf(i) })),
      (k) => { const f = this.env.sfx.handWhoosh; if (f) f.call(this.env.sfx, k); });
    for (const th of this.things){
      if (th.dead) continue;
      th.age += dt; th.cool = Math.max(0, th.cool - dt); th.rot += th.spin * dt;
      if (th.resv > 0 && this._live(th) && !this._under(th.x, th.y)) th.resv = Math.max(0, th.resv - dt);
      this._move(th, dt);
      /* floating up into the shell's areas: it goes, as it would at the edge of the screen */
      if (th.d.move === 'rise' && !th.leaving && th.age > 0.3 && th.y < 0.5 && this._under(th.x, th.y, th.sz * 0.5)) th.leaving = 1e-6;
      if (th.leaving > 0){ th.leaving += dt; if (th.leaving >= LEAVE){ th.dead = true; for (const rule of th.d.rules || []) if (rule.when === 'leftScreen' && !th.fired.left){ th.fired.left = true; this._fire(th, rule, -1); } continue; } }
      /* the rules */
      for (const rule of th.d.rules || []){
        if (th.dead) break;
        if (rule.when === 'touched' || rule.when === 'swiped'){
          if (th.cool > 0 || th.leaving > 0 || this._under(th.x, th.y) || !this._live(th)) continue;   /* (under the clock, the goal bar, the scores, or not yet in reach of the smallest player: not there to touch) */
          for (const { i, h } of hands){
            if (th.resv > 0 && th.owner != null && th.owner !== i && this._here(th.owner)) continue;   /* (reserved for the player whose lane it came down) */
            if (th.d.each && (th.owner !== i || th.up)) continue;
            if (this.health && (this.out[i] || (this.safe[i] > 0 && rule.then.some(x => keyOf(x) === 'hurt')))) continue;   /* (out: their hands do not count; just hurt: a thing goes through them) */                                     /* (a ball each: only its player, and not again until it has come down) */
            const dx = (th.x - h.x) * aspect, dy = th.y - h.y;
            if (Math.hypot(dx, dy) > th.sz / 2 + HAND_REACH) continue;
            if (rule.when === 'swiped' && !(h.speed > SWIPE)) continue;
            th.cool = th.d.each ? BAT : th.d.move === 'bounce' ? 0.25 : 0.2;
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
    /* (a thing that has gone, and a "wait" to bring another: it comes no sooner) */
    for (const th of this.things) if (th.dead && th.d.appears && th.d.appears.wait) th.d.timer = Math.max(th.d.timer, th.d.appears.wait);
    this.things = this.things.filter(t => !t.dead);
    this._tower(dt);
    for (const f of this.fx) f.age += dt; this.fx = this.fx.filter(f => f.age < 0.6);
    for (const x of this.texts){ x.age += dt; x.y -= 0.07 * dt; } this.texts = this.texts.filter(x => x.age < 0.9);
    /* the goal */
    const g = this.spec.goal;
    if (g && !this.goalDone && this.total >= g.score){
      this.goalDone = true; this._celebrate();
      if (g.ends) this.endIn = 2.5;
    }
  }

  /* a thing a hand is meant to touch: one with a touched or swiped rule that is not a loss (a thing to dodge is not a target) */
  _touchable(th){
    return (th.d.rules || []).some(r => (r.when === 'touched' || r.when === 'swiped') && !r.then.some(isLoss));
  }

  _move(th, dt){
    const d = th.d, t = this.t, sp = th.sp, sway = d.sway || 0;
    th.landedNow = false;
    switch (d.move){
      case 'fall': th.y += sp * dt; th.x += Math.sin(t * 1.5 + th.ph) * sway * dt * 4; if (th.y >= FLOOR && !th.landed && !d.appears){ th.y = FLOOR; th.landed = true; } break;
      case 'rise': th.y -= sp * dt; th.x += Math.sin(t * 1.5 + th.ph) * sway * dt * 4 + Math.sin(t * 0.8 + th.ph) * 0.01 * dt * 4; break;
      case 'drift': th.x += th.dir * sp * dt; th.y += Math.sin(t * 1.2 + th.ph) * 0.02 * dt; th.flip = th.dir < 0 === !!d.flips; break;
      case 'seek': {
        const tg = this._seekTarget(th);
        if (tg){
          const dx = (tg.x - th.x) * this.aspect, dy = tg.y - th.y;
          if (Math.hypot(dx, dy) > SEEK_COMMIT){ const diff = Math.atan2(dy, dx) - th.ang; th.ang += clamp(Math.atan2(Math.sin(diff), Math.cos(diff)), -SEEK_TURN * dt, SEEK_TURN * dt); }
        }
        th.x += Math.cos(th.ang) * sp * dt / this.aspect; th.y += Math.sin(th.ang) * sp * dt;
        th.flip = (Math.cos(th.ang) < 0) === !!d.flips;
        if (th.age > SEEK_LIFE && !th.leaving) th.leaving = 1e-6;
        break;
      }
      case 'bob': th.y = th.base + Math.sin(t * 2 + th.ph) * 0.012; break;
      case 'wander':
        th.tt -= dt;
        if (th.tt <= 0){ th.tt = 2 + this.rnd() * 2; const p = this._clearSpot(() => ({ x: 0.1 + this.rnd() * 0.8, y: 0.22 + this.rnd() * 0.55 }), th.sz / 2); th.tx = p.x; th.ty = p.y; }
        { const dx = th.tx - th.x, dy = th.ty - th.y, m = Math.hypot(dx, dy) || 1; th.x += dx / m * Math.min(m, sp * dt); th.y += dy / m * Math.min(m, sp * dt); th.flip = (dx < 0) === !!d.flips; }
        break;
      case 'bounce':
        if (d.each){
          const l = this._lane1(th.owner), k = clamp((l.x - th.x) * 2.2, -0.25, 0.25) * dt;
          th.vx += k + (Math.abs(th.x - l.x) > l.hw ? clamp(l.x - th.x, -0.1, 0.1) * dt * 6 : 0);
          const r = this.reach[th.owner];
          if (th.up && th.vy > 0 && th.y > (r.ready ? r.at(REHIT) : 0.5)) th.up = false;
        }
        th.vy += 0.5 * dt; th.x += th.vx * dt; th.y += th.vy * dt; th.vx *= Math.pow(0.6, dt); th.rot += th.spin * dt; th.spin *= Math.pow(0.5, dt);
        if (th.x < 0.05){ th.x = 0.05; th.vx = Math.abs(th.vx) * 0.7; } if (th.x > 0.95){ th.x = 0.95; th.vx = -Math.abs(th.vx) * 0.7; }
        if (th.y < CEIL){ th.y = CEIL; th.vy = Math.abs(th.vy) * 0.3; }
        if (th.y > FLOOR){ th.y = FLOOR; if (th.vy > 0.2) th.landedNow = true; th.vy = -0.55; th.vx *= 0.5; th.spin = (this.rnd() - 0.5) * 6; }
        this._offZones(th);
        break;
      default: break;          /* stay */
    }
  }

  /* points (or a loss) for whoever did it, or for everyone playing when nobody did; a score never goes below 0 */
  _points(n, who, x, y, colour){
    const add = (a, i) => { a[i] = Math.max(0, a[i] + n); };
    this.total = Math.max(0, this.total + n);
    if (who >= 0) add(this.score, who); else for (let i = 0; i < this.n; i++){ const p = this.env.pose.players[i]; if (p && p.present) add(this.score, i); }
    this.texts.push({ x, y, text: (n < 0 ? '' : '+') + n, color: colour, age: 0 });
  }

  _fire(th, rule, who, hand){
    /* a rule that scores a point (or stacks a block) is one more for its thing, in the results */
    if (rule.then.some(r => { const k = typeof r === 'string' ? r : Object.keys(r)[0], v = typeof r === 'object' ? r[k] : undefined; return k === 'stack' || (k === 'score' && (v ?? 1) > 0); })){
      const nm = th.d.name || ''; this.counts[nm] = (this.counts[nm] || 0) + 1;
    }
    /* a hand caught, popped, batted or grabbed something good: the orb squashes and a burst plays where it was */
    if (who >= 0 && hand && this._touchable(th) && (rule.when === 'touched' || rule.when === 'swiped') && !rule.then.some(isLoss)){
      this.feel.hit(th.x, th.y, who, this.env.colors[who]);
      this.fx.push({ kind: 'hitburst', x: th.x, y: th.y, size: 0.32, color: this.env.colors[who], age: 0 });
    }
    for (const res of rule.then){
      const key = typeof res === 'string' ? res : Object.keys(res)[0], v = typeof res === 'object' ? res[key] : undefined;
      const colour = who >= 0 ? this.env.colors[who] : hexOf(th.color, this.env) || '#ffe680';
      switch (key){
        case 'score': {
          /* a point from the game itself (a thing left the screen, a ball landed) goes to everyone playing */
          this._points(v ?? 1, who, th.x, th.y - th.sz * 0.6, colour); break;
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
          if (th.d.each && this.reach[th.owner].ready){
            /* up to the top of its own player's reach (and no faster than RALLY, so a tall player's ball hangs about as long as a short one's), a little the way the hand was going */
            /* (and not up into the clock, the goal bar or the scores: the top it aims for is below whatever is over it) */
            const roof = this._roof(th.x, th.sz / 2), top = Math.max(this.reach[th.owner].top, roof ? roof + th.sz / 2 : 0);
            th.vy = -clamp(Math.sqrt(Math.max(0, th.y - (top + 0.02))), LIFT_MIN, RALLY); th.up = true;
            th.vx = clamp(th.vx * 0.3 + ((hand && hand.vx) || 0) * 0.3, -0.25, 0.25); th.spin = th.vx * 8 + (this.rnd() - 0.5) * 4; break;
          }
          th.vy = -(0.62 + clamp(-((hand && hand.vy) || 0) * 0.15, 0, 0.2)); th.vx = clamp(th.vx * 0.3 + ((hand && hand.vx) || 0) * 0.5, -0.45, 0.45); th.spin = th.vx * 8 + (this.rnd() - 0.5) * 4; break;
        case 'hurt': this._hurt(who, v ?? 1, th); break;
        case 'celebrate': this._celebrate(); break;
        case 'wobble': this.wob = 0.5; break;
        case 'stack': this.fliers.push({ piece: th.piece, color: th.color, x0: th.x, y0: th.y, s0: th.sz, t: 0, who, colour, full: clamp(Math.round(v ?? FULL), LIMITS.tower[0], LIMITS.tower[1]) }); break;
        default: break;
      }
    }
  }

  /* the tower: blocks fly onto it; a full one blasts off, with a bonus, and a new one begins */
  _tower(dt){
    for (let i = 0; i < this.fliers.length; i++){
      const f = this.fliers[i]; f.t += dt;
      if (f.t < FLY) continue;
      this.fliers.splice(i--, 1);
      this.tower.push({ piece: f.piece, color: f.color });
      const sfx = this.env.sfx; sfx.pop && sfx.pop(0.8 + this.tower.length * 0.12);
      if (this.tower.length >= f.full){
        this.rockets.push({ blocks: this.tower, t: 0, y: 0, v: 0, x: TOWER_X }); this.tower = []; this.towers++;
        this._points(BONUS, f.who, TOWER_X, GROUND - 0.4, f.colour);
        this.hint = 'Blast off!'; this.hintIcon = 'rocket'; this.hintT = 0;
        sfx.liftoff && sfx.liftoff(); sfx.hooray && sfx.hooray();
        this.fx.push({ kind: 'sparkle', x: TOWER_X, y: GROUND - 0.2, size: 0.3, color: COLORS.yellow, age: 0 });
      }
    }
    for (const r of this.rockets){ r.t += dt; if (r.t > 1) r.v += dt * 0.9; r.y += r.v * dt; }
    this.rockets = this.rockets.filter(r => r.y < 1.4);
  }

  _drawTower(c, W, H){
    const A = this.env.assets, s = BLOCK * H, ink = (n) => (A.color ? A.color(n) : COLORS.gold);
    if (this.tower.length || this.fliers.length || this.rockets.length){
      c.save(); c.globalAlpha = 0.18; c.fillStyle = ink('shade.shadow'); c.beginPath(); c.ellipse(TOWER_X * W + s * 0.2, GROUND * H, s * 0.95, s * 0.16, 0, 0, 6.2832); c.fill(); c.restore();
    }
    const sway = Math.sin(this.t * 1.6) * 0.0006;
    this.tower.forEach((b, n) => A.draw(c, b.piece, (TOWER_X + sway * n) * W, (GROUND - (n + 0.5) * BLOCK) * H, s, { color: b.color ? hexOf(b.color, this.env) : undefined, shadow: true }));
    for (const r of this.rockets){
      const x = r.x * W + (r.t < 1 ? Math.sin(r.t * 60) * H * 0.003 : 0), base = (GROUND - r.y) * H, n = r.blocks.length;
      if (r.t > 0.6){
        const fl = s * (0.8 + Math.random() * 0.4);
        c.fillStyle = ink('touch.sunflower'); c.beginPath(); c.moveTo(x - s * 0.35, base); c.lineTo(x, base + fl * 1.6); c.lineTo(x + s * 0.35, base); c.fill();
        c.fillStyle = ink('touch.tangerine'); c.beginPath(); c.moveTo(x - s * 0.2, base); c.lineTo(x, base + fl); c.lineTo(x + s * 0.2, base); c.fill();
      }
      c.fillStyle = ink('touch.cherry');
      for (const d of [-1, 1]){ c.beginPath(); c.moveTo(x + d * s * 0.5, base - s * 1.4); c.lineTo(x + d * s * 0.95, base); c.lineTo(x + d * s * 0.5, base); c.fill(); }
      r.blocks.forEach((b, j) => A.draw(c, b.piece, x, base - (j + 0.5) * s, s, { color: b.color ? hexOf(b.color, this.env) : undefined }));
      c.beginPath(); c.moveTo(x - s * 0.5, base - n * s); c.quadraticCurveTo(x, base - n * s - s * 1.5, x + s * 0.5, base - n * s); c.fill();
    }
  }

  _celebrate(){
    this.cheering = 1.2;
    for (let k = 0; k < 12; k++) this.fx.push({ kind: 'sparkle', x: 0.15 + this.rnd() * 0.7, y: 0.2 + this.rnd() * 0.5, size: 0.25 * 720, color: ['#ffd35c', '#ff7eb3', '#7fd6a2', '#7ab8ff'][k % 4], age: -k * 0.04, big: true });
    this.env.sfx.hooray && this.env.sfx.hooray();
  }

  draw(c, W, H){
    const A = this.env.assets, secs = this.spec.endless ? 600 : (this.spec.secs ?? 90);
    const wob = this.wob > 0;
    if (wob){ c.save(); c.translate(Math.sin(this.t * 55) * H * 0.008 * this.wob * 2, Math.cos(this.t * 47) * H * 0.004 * this.wob * 2); }
    A.scene(c, W, H, this.spec.scene || 'meadow', { t: this.t, p: clamp(this.t / secs, 0, 1) });
    if (this.tower.length || this.fliers.length || this.rockets.length) this._drawTower(c, W, H);
    const orbs = handsMode() === 'orb';
    for (const th of [...this.things].sort((a, b) => a.y - b.y)){
      /* a hand near something it can touch: it grows up to 8% and glows (only drawn so) */
      const k = orbs && this._touchable(th) && !th.leaving ? this.feel.near(th.x, th.y, th.sz / 2) : 0;
      if (k > 0.01) A.draw(c, 'dot', th.x * W, th.y * H, th.sz * H * 2.4, { color: COLORS.yellow, alpha: 0.7 * k });
      /* (a ball each: its player's colour round it) */
      if (th.d.each && th.owner != null) A.draw(c, 'dot', th.x * W, th.y * H, th.sz * H * 1.7, { color: this.env.colors[th.owner], alpha: 0.5 });
      /* (a thing that is still somebody's first: their colour round it) */
      if (th.resv > 0 && th.owner != null && this._live(th) && this._here(th.owner)) A.draw(c, 'dot', th.x * W, th.y * H, th.sz * H * 1.7, { color: this.env.colors[th.owner], alpha: 0.5 * Math.min(1, th.resv / 0.3) });
      /* (growing in below the shell's areas, or going as it floats up into them) */
      const born = th.pop ? ease(th.age / POPIN) : 1, gone = th.leaving > 0 ? 1 - th.leaving / LEAVE : 1;
      A.draw(c, th.piece, th.x * W, th.y * H, th.sz * H * (1 + FEEL.hoverGrow * k) * (0.4 + 0.6 * born), { color: th.color ? hexOf(th.color, this.env) : undefined, rotate: th.rot, flip: th.flip, t: th.age, shadow: th.d.move === 'bounce', ...(born < 1 || gone < 1 || !this._live(th) ? { alpha: born * gone * (this._live(th) ? 1 : GHOST) } : {}) });
    }
    /* blocks on their way to the tower */
    this.fliers.forEach((f, i) => {
      const k = clamp(f.t / FLY, 0, 1), e = 1 - Math.pow(1 - k, 3), slot = this.tower.length + this.fliers.slice(0, i).length;
      const x = f.x0 + (TOWER_X - f.x0) * e, y = f.y0 + ((GROUND - (slot + 0.5) * BLOCK) - f.y0) * e - Math.sin(k * Math.PI) * 0.12, sz = f.s0 + (BLOCK - f.s0) * e;
      A.draw(c, f.piece, x * W, y * H, sz * H, { color: f.color ? hexOf(f.color, this.env) : undefined, rotate: k * 6.28, t: f.t });
    });
    for (const f of this.fx) if (f.age >= 0) A.draw(c, f.kind, f.x * W, f.y * H, f.big ? H * 0.28 : f.size * H, { color: f.color, t: f.age / 0.6 });
    for (const x of this.texts) A.text(c, x.text, x.x * W, x.y * H, H * 0.05, { color: '#fff', outline: x.color, alpha: 1 });
    if (wob) c.restore();
    const hf = this.spec.hintFor ?? 8;
    if (this.hint) this.env.ui.say(c, W, H, { icon: this.hintIcon, text: this.hint, t: this.hintT, until: hf });
    if (this.spec.goal) this.env.ui.goal(c, W, H, clamp(this.total / this.spec.goal.score, 0, 1));
    /* the players' hands, last, on top of everything */
    const glow = this.feel.list();
    if (orbs && glow.length) for (const e of glow) A.draw(c, 'hand', e.orb.x * W, e.orb.y * H, H * 0.12, { color: e.col, orb: e.orb, W, H });
    else for (const { i, h } of this._hands()) A.draw(c, 'hand', h.x * W, h.y * H, H * 0.12, { color: this._colorOf(i) });
    /* everyone is out: the picture dims over the short beat before the round ends */
    if (this.allOut){ c.save(); c.globalAlpha = 0.35 * clamp(1 - this.endIn / END_BEAT, 0, 1); c.fillStyle = A.color ? A.color('shade.shadow') : 'black'; c.fillRect(0, 0, W, H); c.restore(); }
  }

  /* the move card, bottom left, for the first cardFor seconds (or all round) */
  card(){ const s = this.spec; return s.card && (s.cardFor == null || this.t < s.cardFor) ? s.card : null; }
  /* (unused: the areas this game gives back to its world - it has no badge, and the move card is only there for a while - so nothing keeps out of them) */
  hud(){
    const h = { score: this.score, showLives: false, hideScore: !!this.spec.team || this.health, unused: this.card() ? ['badge'] : ['badge', 'card'] };
    /* a Dodge game: a health bar each, where the score pill would be (fill 1 is full; hit: the flash of a hit, 1 to 0; out: the bar ran out) */
    if (this.health) h.health = Array.from({ length: this.env.max }, (_, i) => ({ fill: this.hp[i], hit: this.flash[i], out: this.out[i] }));
    return h;
  }
  /* what the round was worth (a Dodge game has no score: 0) */
  value(){ return this.health ? 0 : this.spec.team ? this.total : Math.max(0, ...this.score.slice(0, this.n)); }
  get mood(){ return clamp(0.2 + this.cheering * 0.5 + Math.min(0.4, this.total / 100), 0, 1); }
}
