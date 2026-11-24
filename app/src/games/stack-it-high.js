/* Stack It High: soft blocks float down from the sky; catch one, carry it
   over to your tower, and it hops on top. Build it higher and higher - and
   when it's tall enough the tower turns into a rocket and blasts off, and
   you start a new one.

   Everyone builds their own: your blocks come in your own colour, fall into
   your part of the picture, and hang in the air where you can reach them, so
   a grown-up can't take a child's block and a child never has to reach for
   the top of the screen. Only you can pick up your colour, and it only goes
   on your tower. Each tower is as tall as its builder can reach (a child's a
   few blocks shorter than a grown-up's), so the last block is always within
   reach without a hop. A hand that touches a block holds it and carries it
   until it's over the tower, where it snaps on - generously, so a toddler's
   aim is plenty. The tower sways a little more the taller it grows, but never
   falls: nothing in this game goes wrong. Each player's count is the blocks
   they put on. First person: the players are their hands. */
import { color, alpha } from './assets/palette.js';
import { Juice } from './common.js';
import { clearOf } from './hud.js';
import { reaches } from './reach.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* blocks in a finished tower at most (it blasts off) and at least, a block's size (screen heights), and where the ground is
   (a tower's place across the picture is its builder's: `x` here is where one stands when nobody has said) */
export const TOWER_FULL = 8, MIN_TOWER = 4, BLOCK = 0.085, TOWER = { x: 0.5, base: 0.93 };
/* a hand this near a block (screen heights) holds it; a carried block this
   near the tower's middle (screen heights, sideways) goes on */
export const GRAB = 0.075, SNAP = 0.13;
/* a carried block rides this far (in blocks) above the hand, and goes on once it is within this many blocks of the tower's top,
   so the hand has to get no higher than HAND_OVER above the top of what's built */
const CARRY = 0.9, FIT = 0.6;
export const HAND_OVER = BLOCK * (CARRY + FIT);
/* how long (seconds) a block takes to float down to where it waits (the same for everyone, whether they wait high or low), how fast one a hand dropped falls (screen heights a second), how many hang
   waiting for each player, how far from the tower they come down (sideways), and the least room between two towers */
const FALL_SECS = [2.8, 4.2], DROPPED = 0.1, WAITING = 2, SIDE = [0.04, 0.1], GAP = 0.12;
/* a player who's gone for this long (seconds) takes their waiting blocks with them */
const GONE = 8;

export default {
  id: 'stack-it-high', unit: 'blocks', name: 'Stack It High', stars: 1, accent: color('touch.lagoon'), secs: ROUND,
  moves: ['reach'],
  create(n){ return new StackItHigh(n); }
};
const MARKS = ['star', 'heart', 'dot'];

/* How many blocks a tower of someone with this reach is: the last block goes on when the hand is within HAND_OVER of the top of the
   blocks under it, and that must be a place the hand can get to (a little under the reach, for a wobble). */
export function towerHeight(reach, margin = 0.01){
  const under = Math.floor((TOWER.base + HAND_OVER - margin - reach.top) / BLOCK);
  return Math.max(MIN_TOWER, Math.min(TOWER_FULL, under + 1));
}

class StackItHigh {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.blocks = [];          /* loose ones: floating down, hanging waiting, or held */
    /* each player's own tower: { x, tower: [placed: { col, mark, dx, rot, pop }], full, rocket, spawnT, gone, away } */
    this.lanes = Array.from({ length: MAX_PLAYERS }, () => ({ x: null, tower: [], full: TOWER_FULL, rocket: null, spawnT: 1, gone: 0, away: 0 }));
    this.reach = reaches(MAX_PLAYERS);
    this.towers = 0;           /* rockets launched, all together */
    this.t = 0; this.over = false;
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
    this.fx = [];
    this.say = { icon: 'block', text: 'Stack the blocks!', t: 0 };
  }

  /* a new block for player `who`: it comes down beside their tower and waits at a height they can reach (and never behind the
     clock, the words or the scores) */
  _spawn(who = 0, W = 1920, H = 1080){
    const lane = this.lanes[who], r = this.reach[who];
    const side = Math.random() < 0.5 ? -1 : 1, off = SIDE[0] + Math.random() * (SIDE[1] - SIDE[0]);
    const x0 = lane.x ?? r.x, x = Math.min(0.92, Math.max(0.08, x0 + side * off));
    const settle = Math.max(clearOf(W, H, x), r.at(0.15 + Math.random() * 0.5));
    const b = {
      x, y: -BLOCK, vy: (settle + BLOCK) / (FALL_SECS[0] + Math.random() * (FALL_SECS[1] - FALL_SECS[0])),
      rot: (Math.random() - 0.5) * 0.6, spin: (Math.random() - 0.5) * 0.8,
      owner: who, col: PLAYER_COLORS[who], mark: MARKS[(Math.random() * MARKS.length) | 0],
      held: null, settle, age: 0, ph: Math.random() * 6.28
    };
    this.blocks.push(b);
    return b;
  }

  /* every hand: [player, which, hand] */
  _hands(){
    const out = [];
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p || !p.present) continue;
      if (pose.mouse.active) out.push([i, 'r', p.hands.right]);
      else out.push([i, 'l', p.hands.left], [i, 'r', p.hands.right]);
    }
    return out;
  }
  /* where the top of player i's tower is (a screen height down from the top) */
  _top(i = 0){ return TOWER.base - this.lanes[i].tower.length * BLOCK; }
  towerX(i = 0){ return this.lanes[i].x ?? TOWER.x; }

  /* each player's tower stands where they first were, and stays: other towers keep their distance. It moves only when its builder
     has been somewhere else for a while with nothing in their hands. */
  _lane(i, dt, carrying){
    const lane = this.lanes[i], r = this.reach[i];
    const others = this.lanes.filter((l, k) => k !== i && l.x != null);
    if (lane.x == null){
      let x = Math.min(0.9, Math.max(0.1, r.x));
      for (let n = 0; n < 8; n++){
        const near = others.find(o => Math.abs(o.x - x) < GAP);
        if (!near) break;
        x = near.x + (x >= near.x ? GAP : -GAP);
      }
      lane.x = Math.min(0.9, Math.max(0.1, x));
      return;
    }
    if (carrying || Math.abs(r.x - lane.x) < 0.25){ lane.away = 0; return; }
    lane.away += dt;
    if (lane.away < 4) return;
    let x = lane.x + Math.sign(r.x - lane.x) * Math.min(Math.abs(r.x - lane.x), 0.2 * dt);
    for (const o of others) if (Math.abs(o.x - x) < GAP && Math.abs(o.x - x) < Math.abs(o.x - lane.x)) x = lane.x;
    lane.x = Math.min(0.9, Math.max(0.1, x));
  }

  step(dt, W, H){
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;
    const hands = this._hands();
    const holding = new Set(this.blocks.filter(b => b.held).map(b => b.held.key));

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i], lane = this.lanes[i];
      if (!p || !p.present){ lane.gone += dt; continue; }
      lane.gone = 0;
      this.reach[i].step(dt, p, pose.mouse.active);
      this._lane(i, dt, holding.has(i + 'l') || holding.has(i + 'r'));
      /* a tower is as tall as its builder reaches; it can't change once it has started */
      if (!lane.tower.length) lane.full = towerHeight(this.reach[i]);
      /* new blocks float down, a couple at a time for each */
      lane.spawnT -= dt;
      const loose = this.blocks.filter(b => b.owner === i && !b.held).length;
      if (lane.spawnT <= 0 && loose < WAITING && !lane.rocket){ lane.spawnT = 1.6 + Math.random() * 1.6; this._spawn(i, W, H); }
    }

    for (const b of this.blocks){
      b.age += dt;
      const lane = this.lanes[b.owner];
      if (b.held){
        /* carried: it sits on the hand; a hand that's gone lets it fall (and wait again where it's reachable) */
        const h = hands.find(([i, k]) => i + k === b.held.key);
        if (!h){ b.held = null; b.vy = DROPPED; b.settle = Math.max(b.y, clearOf(W, H, b.x), this.reach[b.owner].at(0.5)); continue; }
        b.x += (h[2].x - b.x) * Math.min(1, dt * 18); b.y += (h[2].y - BLOCK * CARRY - b.y) * Math.min(1, dt * 18);
        b.rot *= Math.pow(0.1, dt);
        /* over its own tower: on it goes */
        if (!lane.rocket && Math.abs(b.x - this.towerX(b.owner)) * aspect < SNAP && b.y < this._top(b.owner) + BLOCK * FIT) this._place(b);
        continue;
      }
      if (b.y < b.settle){
        b.y += b.vy * dt; b.rot += b.spin * dt;
        b.x += Math.sin(this.t * 0.9 + b.age) * 0.01 * dt;
        if (b.y >= b.settle){ b.y = b.settle; sfx.pat?.(); }
      } else {
        /* it hangs there, bobbing a little, and turns to sit straight */
        b.y = b.settle + Math.sin(this.t * 2 + b.ph) * 0.006; b.rot *= Math.pow(0.3, dt);
      }
      /* a free hand of its own player touching it picks it up */
      for (const [i, k, h] of hands){
        const key = i + k;
        if (i !== b.owner || holding.has(key)) continue;
        if (Math.hypot((h.x - b.x) * aspect, h.y - b.y) < GRAB + BLOCK * 0.5){ b.held = { key, who: i }; holding.add(key); sfx.pick?.(); break; }
      }
    }
    /* a player who's been gone a while takes their blocks with them */
    this.blocks = this.blocks.filter(b => !b.placed && (b.held || this.lanes[b.owner].gone < GONE));

    /* the rockets: off they go, then a new tower */
    this.lanes.forEach((lane, i) => {
      const r = lane.rocket;
      if (!r) return;
      r.t += dt; if (r.t > 1) r.v += dt * 0.9; r.y += r.v * dt;
      if (r.t > 1 && Math.random() < dt * 30) this.fx.push({ x: r.x + (Math.random() - 0.5) * 0.04, y: TOWER.base - r.y, vx: (Math.random() - 0.5) * 0.1, vy: 0.2, life: 0.9, age: 0, col: [color('touch.sunflower'), color('touch.tangerine'), color('earth.snow')][(Math.random() * 3) | 0] });
      if (r.y > 1.4){ lane.rocket = null; if (this._present() < 2) this.say = { text: 'Build another one!', t: 0 }; }
    });
    for (const f of this.fx){ f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.fx = this.fx.filter(f => f.age < f.life);
    for (const lane of this.lanes) for (const k of lane.tower) k.pop = Math.max(0, k.pop - dt * 3);

    const joy = Math.max(0, ...this.lanes.map(l => l.tower.length / l.full));
    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND) * 0.6, storm: false, wind: 0.004, joy, look: 0.5, rainbow: this.lanes.some(l => l.rocket) });
    this.avatars.step(dt, this.players);
  }

  _present(){ let n = 0; for (let i = 0; i < this.players; i++) if (pose.players[i] && pose.players[i].present) n++; return n; }

  _place(b){
    const lane = this.lanes[b.owner];
    b.placed = true;
    lane.tower.push({ col: b.col, mark: b.mark, dx: (Math.random() - 0.5) * 0.012, rot: (Math.random() - 0.5) * 0.08, pop: 1 });
    this.score[b.owner]++;
    sfx.pop?.(0.8 + lane.tower.length * 0.12);
    /* one builder is told the count; with more, the towers speak for themselves */
    if (this._present() < 2) this.say = { text: `${lane.tower.length} block${lane.tower.length > 1 ? 's' : ''} high!`, t: 0 };
    if (lane.tower.length >= lane.full) this._launch(b.owner);
  }
  /* the tower's done: it's a rocket now */
  _launch(i){
    const lane = this.lanes[i];
    this.towers++;
    lane.rocket = { blocks: lane.tower, y: 0, v: 0, t: 0, x: lane.x };
    lane.tower = [];
    this.say = { text: '3… 2… 1… Blast off!', t: 0 };
    sfx.liftoff?.(); sfx.hooray?.();
    this.j.kick(8);
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    const s = BLOCK * H;
    this.lanes.forEach((lane, i) => {
      if (lane.x == null || (lane.gone > GONE && !lane.tower.length && !lane.rocket)) return;
      const x0 = lane.x;
      /* the tower, swaying a little more the taller it is */
      const sway = Math.sin(this.t * 1.6 + i) * 0.0008 * lane.tower.length;
      c.fillStyle = alpha('shade.shadow', 0.18); c.beginPath(); c.ellipse(x0 * W + s * 0.3, TOWER.base * H, s * 1.1, s * 0.18, 0, 0, 6.2832); c.fill();
      lane.tower.forEach((k, n) => {
        const x = (x0 + k.dx + sway * n) * W, y = (TOWER.base - (n + 0.5) * BLOCK) * H;
        block(c, x, y, s * (1 + k.pop * 0.12), k.rot + sway * n * 2, k.col, k.mark);
      });
      /* where the next block goes: a soft outline on top, in the builder's colour, glowing while they carry one */
      if (!lane.rocket){
        const carrying = this.blocks.some(b => b.held && b.owner === i);
        const y = (this._top(i) - BLOCK * 0.5) * H;
        c.save(); c.globalAlpha = carrying ? 0.55 + 0.25 * Math.sin(this.t * 5) : 0.3;
        c.strokeStyle = carrying ? color('earth.snow') : PLAYER_COLORS[i]; c.lineWidth = Math.max(3, H * 0.004); c.setLineDash([H * 0.012, H * 0.01]);
        c.beginPath(); c.roundRect(x0 * W - s / 2, y - s / 2, s, s, s * 0.2); c.stroke(); c.restore();
      }
      if (lane.rocket) this._rocket(c, W, H, s, lane, i);
    });
    this.scene.drawFront(c, W, H);
    for (const b of this.blocks) if (!b.held) block(c, b.x * W, b.y * H, s, b.rot, b.col, b.mark);
    if (shook) c.restore();
    for (const f of this.fx){ c.globalAlpha = 1 - f.age / f.life; c.fillStyle = f.col; c.beginPath(); c.arc(f.x * W, f.y * H, H * 0.012 * (1 + f.age), 0, 6.2832); c.fill(); }
    c.globalAlpha = 1;
    this.avatars.drawMitts(c, W, H, this.players);
    /* carried blocks ride on top of the hands */
    for (const b of this.blocks) if (b.held) block(c, b.x * W, b.y * H, s, b.rot, b.col, b.mark);
  }

  /* a finished tower, as a rocket: a nose cone on top, fins, flames - in its builder's colour */
  _rocket(c, W, H, s, lane, i){
    const r = lane.rocket, x = r.x * W, base = (TOWER.base - r.y) * H, n = r.blocks.length, own = PLAYER_COLORS[i];
    const shake = r.t < 1 ? Math.sin(r.t * 60) * H * 0.003 : 0;
    if (r.t > 0.6){
      const fl = s * (0.8 + Math.random() * 0.4);
      c.fillStyle = color('touch.sunflower'); c.beginPath(); c.moveTo(x - s * 0.35, base); c.lineTo(x, base + fl * 1.6); c.lineTo(x + s * 0.35, base); c.fill();
      c.fillStyle = color('touch.tangerine'); c.beginPath(); c.moveTo(x - s * 0.2, base); c.lineTo(x, base + fl); c.lineTo(x + s * 0.2, base); c.fill();
    }
    for (const d of [-1, 1]){ c.fillStyle = own; c.beginPath(); c.moveTo(x + d * s * 0.5, base - s * 1.4); c.lineTo(x + d * s * 0.95, base); c.lineTo(x + d * s * 0.5, base); c.fill(); }
    r.blocks.forEach((k, j) => block(c, x + shake, base - (j + 0.5) * s, s, 0, k.col, k.mark));
    c.fillStyle = own; c.beginPath(); c.moveTo(x - s * 0.5 + shake, base - n * s); c.quadraticCurveTo(x + shake, base - n * s - s * 1.5, x + s * 0.5 + shake, base - n * s); c.fill();
  }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'reach' : null; }
  hud(){ return { score: this.score, showLives: false, words: this.say }; }
  /* reaching up high is how you catch the blocks; Back on the remote pauses */
  pausable(){ return false; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  winner(){
    const played = this.score.slice(0, this.players).map((s, i) => i).filter(i => this.score[i] > 0 || pose.players[i].present);
    if (played.length < 2) return null;
    const top = Math.max(...played.map(i => this.score[i]));
    const best = played.filter(i => this.score[i] === top);
    return best.length > 1 ? -1 : best[0];
  }
  value(){ return Math.max(0, ...this.score.slice(0, this.players)); }
}

/* a soft block: rounded, cel-shaded (shadow on the right and underneath),
   a white star, heart or dot on its face */
export function block(c, x, y, s, rot, col, mark){
  c.save(); c.translate(x, y); c.rotate(rot);
  const half = s / 2, r = s * 0.2;
  c.fillStyle = col; c.beginPath(); c.roundRect(-half, -half, s, s, r); c.fill();
  c.save(); c.beginPath(); c.roundRect(-half, -half, s, s, r); c.clip();
  c.fillStyle = alpha('shade.shadow', 0.18); c.fillRect(half * 0.36, -half, half, s); c.fillRect(-half, half * 0.4, s, half);
  c.restore();
  c.fillStyle = alpha('earth.snow', 0.85);
  if (mark === 'star'){ c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? s * 0.1 : s * 0.24; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fill(); }
  else if (mark === 'heart'){ c.beginPath(); c.moveTo(0, s * 0.16); c.bezierCurveTo(-s * 0.31, -s * 0.05, -s * 0.15, -s * 0.29, 0, -s * 0.13); c.bezierCurveTo(s * 0.15, -s * 0.29, s * 0.31, -s * 0.05, 0, s * 0.16); c.fill(); }
  else { c.beginPath(); c.arc(0, 0, s * 0.18, 0, 6.2832); c.fill(); }
  c.restore();
}
