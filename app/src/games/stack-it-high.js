/* Stack It High: soft blocks float down from the sky; catch one, carry it
   over to the tower in the middle, and it hops on top. Build it together,
   higher and higher - and when it's tall enough the tower turns into a
   rocket and blasts off, and you start a new one.

   A hand that touches a block holds it (a block lying in the grass too),
   and carries it until it's over the tower, where it snaps on - generously,
   so a toddler's aim is plenty. The tower sways a little more the taller it
   grows, but never falls: nothing in this game goes wrong. Each player's
   count is the blocks they put on. First person: the players are their
   hands. */
import { Juice } from './common.js';
import { sayBubble } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* blocks in a finished tower (it blasts off), a block's size (screen
   heights), the tower's place, and where the ground is */
export const TOWER_FULL = 8, BLOCK = 0.085, TOWER = { x: 0.5, base: 0.93 };
/* a hand this near a block (screen heights) holds it; a carried block this
   near the tower's middle (screen heights, sideways) goes on */
export const GRAB = 0.075, SNAP = 0.13;
/* how fast blocks float down, and how many float at once */
const FALL = [0.06, 0.1], AIRBORNE = 2, ON_GRASS = 4;
const COLS = ['#ff7aa8', '#ffd25a', '#79b3aa', '#a98bff', '#f2a65a', '#9fd38a', '#7fb0e0', '#e88b8b'];
const MARKS = ['star', 'heart', 'dot'];

export default {
  id: 'stack-it-high', unit: 'blocks', name: 'Stack It High', stars: 1, accent: '#79b3aa', secs: ROUND,
  moves: ['reach'],
  create(n){ return new StackItHigh(n); }
};

class StackItHigh {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.blocks = [];          /* loose ones: floating down, held, or in the grass */
    this.tower = [];           /* placed: { col, mark, dx, rot, pop } */
    this.rocket = null;        /* a finished tower, blasting off */
    this.towers = 0;
    this.spawnT = 1;
    this.t = 0; this.over = false;
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
    this.fx = [];
    this.say = { text: '\u{1F9F1} Stack the blocks!', t: 0 };
  }

  _spawn(){
    this.blocks.push({
      x: 0.12 + Math.random() * 0.76, y: -BLOCK, vy: FALL[0] + Math.random() * (FALL[1] - FALL[0]),
      rot: (Math.random() - 0.5) * 0.6, spin: (Math.random() - 0.5) * 0.8,
      col: COLS[(Math.random() * COLS.length) | 0], mark: MARKS[(Math.random() * MARKS.length) | 0],
      held: null, grass: 0, age: 0
    });
    /* not where the tower stands: a block falling onto it would be confusing */
    const b = this.blocks[this.blocks.length - 1];
    if (Math.abs(b.x - TOWER.x) < 0.12) b.x += b.x < TOWER.x ? -0.14 : 0.14;
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
  _top(){ return TOWER.base - this.tower.length * BLOCK; }

  step(dt, W, H){
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;

    /* new blocks float down */
    this.spawnT -= dt;
    const air = this.blocks.filter(b => !b.held && !b.grass).length, grass = this.blocks.filter(b => b.grass).length;
    if (this.spawnT <= 0 && air < AIRBORNE && grass < ON_GRASS && !this.rocket){ this.spawnT = 1.6 + Math.random() * 1.6; this._spawn(); }

    const hands = this._hands();
    const holding = new Set(this.blocks.filter(b => b.held).map(b => b.held.key));
    for (const b of this.blocks){
      b.age += dt;
      if (b.held){
        /* carried: it sits on the hand; a hand that's gone lets it fall */
        const h = hands.find(([i, k]) => i + k === b.held.key);
        if (!h){ b.held = null; b.vy = 0.1; continue; }
        b.x += (h[2].x - b.x) * Math.min(1, dt * 18); b.y += (h[2].y - BLOCK * 0.9 - b.y) * Math.min(1, dt * 18);
        b.rot *= Math.pow(0.1, dt);
        /* over the tower: on it goes */
        if (!this.rocket && Math.abs(b.x - TOWER.x) * aspect < SNAP && b.y < this._top() + BLOCK * 0.6) this._place(b);
        continue;
      }
      if (!b.grass){
        b.y += b.vy * dt; b.rot += b.spin * dt;
        b.x += Math.sin(this.t * 0.9 + b.age) * 0.01 * dt;
        if (b.y >= TOWER.base - BLOCK * 0.5){ b.y = TOWER.base - BLOCK * 0.5 + Math.random() * 0.02; b.grass = 1; sfx.pat?.(); }
      } else b.grass += dt;
      /* a free hand touching it picks it up */
      for (const [i, k, h] of hands){
        const key = i + k;
        if (holding.has(key)) continue;
        if (Math.hypot((h.x - b.x) * aspect, h.y - b.y) < GRAB + BLOCK * 0.5){ b.held = { key, who: i }; b.grass = 0; holding.add(key); sfx.pick?.(); break; }
      }
    }
    this.blocks = this.blocks.filter(b => !b.placed && !(b.grass > 20));

    /* the rocket: off it goes, then a new tower */
    if (this.rocket){
      const r = this.rocket;
      r.t += dt; if (r.t > 1) r.v += dt * 0.9; r.y += r.v * dt;
      if (r.t > 1 && Math.random() < dt * 30) this.fx.push({ x: TOWER.x + (Math.random() - 0.5) * 0.04, y: TOWER.base - r.y, vx: (Math.random() - 0.5) * 0.1, vy: 0.2, life: 0.9, age: 0, col: ['#ffd25a', '#f2a65a', '#ffffff'][(Math.random() * 3) | 0] });
      if (r.y > 1.4){ this.rocket = null; this.say = { text: 'Build another one!', t: 0 }; }
    }
    for (const f of this.fx){ f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.fx = this.fx.filter(f => f.age < f.life);
    for (const k of this.tower) k.pop = Math.max(0, k.pop - dt * 3);

    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND) * 0.6, storm: false, wind: 0.004, joy: this.tower.length / TOWER_FULL, look: 0.5, rainbow: !!this.rocket });
    this.avatars.step(dt, this.players);
  }

  _place(b){
    b.placed = true;
    this.tower.push({ col: b.col, mark: b.mark, dx: (Math.random() - 0.5) * 0.012, rot: (Math.random() - 0.5) * 0.08, pop: 1 });
    this.score[b.held.who]++;
    sfx.pop?.(0.8 + this.tower.length * 0.12);
    this.say = { text: `${this.tower.length} block${this.tower.length > 1 ? 's' : ''} high!`, t: 0 };
    if (this.tower.length >= TOWER_FULL) this._launch();
  }
  /* the tower's done: it's a rocket now */
  _launch(){
    this.towers++;
    this.rocket = { blocks: this.tower, y: 0, v: 0, t: 0 };
    this.tower = [];
    this.say = { text: '3… 2… 1… Blast off!', t: 0 };
    sfx.liftoff?.(); sfx.hooray?.();
    this.j.kick(8);
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    const s = BLOCK * H;
    /* the tower, swaying a little more the taller it is */
    const sway = Math.sin(this.t * 1.6) * 0.0008 * this.tower.length;
    c.fillStyle = 'rgba(58,51,96,.18)'; c.beginPath(); c.ellipse(TOWER.x * W + s * 0.3, TOWER.base * H, s * 1.1, s * 0.18, 0, 0, 6.2832); c.fill();
    this.tower.forEach((k, n) => {
      const x = (TOWER.x + k.dx + sway * n) * W, y = (TOWER.base - (n + 0.5) * BLOCK) * H;
      block(c, x, y, s * (1 + k.pop * 0.12), k.rot + sway * n * 2, k.col, k.mark);
    });
    /* where it goes next: a soft glowing outline on top */
    if (!this.rocket && this.blocks.some(b => b.held)){
      const y = (this._top() - BLOCK * 0.5) * H;
      c.save(); c.globalAlpha = 0.45 + 0.25 * Math.sin(this.t * 5); c.strokeStyle = '#fff'; c.lineWidth = Math.max(3, H * 0.004); c.setLineDash([H * 0.012, H * 0.01]);
      c.beginPath(); c.roundRect(TOWER.x * W - s / 2, y - s / 2, s, s, s * 0.2); c.stroke(); c.restore();
    }
    if (this.rocket) this._rocket(c, W, H, s);
    this.scene.drawFront(c, W, H);
    for (const b of this.blocks) if (!b.held) block(c, b.x * W, b.y * H, s, b.rot, b.col, b.mark);
    if (shook) c.restore();
    for (const f of this.fx){ c.globalAlpha = 1 - f.age / f.life; c.fillStyle = f.col; c.beginPath(); c.arc(f.x * W, f.y * H, H * 0.012 * (1 + f.age), 0, 6.2832); c.fill(); }
    c.globalAlpha = 1;
    this.avatars.drawMitts(c, W, H, this.players);
    /* carried blocks ride on top of the hands */
    for (const b of this.blocks) if (b.held) block(c, b.x * W, b.y * H, s, b.rot, b.col, b.mark);
    this._say(c, W, H);
  }

  /* the finished tower, as a rocket: a nose cone on top, fins, flames */
  _rocket(c, W, H, s){
    const r = this.rocket, x = TOWER.x * W, base = (TOWER.base - r.y) * H, n = r.blocks.length;
    const shake = r.t < 1 ? Math.sin(r.t * 60) * H * 0.003 : 0;
    if (r.t > 0.6){
      const fl = s * (0.8 + Math.random() * 0.4);
      c.fillStyle = '#ffd25a'; c.beginPath(); c.moveTo(x - s * 0.35, base); c.lineTo(x, base + fl * 1.6); c.lineTo(x + s * 0.35, base); c.fill();
      c.fillStyle = '#f2a65a'; c.beginPath(); c.moveTo(x - s * 0.2, base); c.lineTo(x, base + fl); c.lineTo(x + s * 0.2, base); c.fill();
    }
    for (const d of [-1, 1]){ c.fillStyle = '#e8513d'; c.beginPath(); c.moveTo(x + d * s * 0.5, base - s * 1.4); c.lineTo(x + d * s * 0.95, base); c.lineTo(x + d * s * 0.5, base); c.fill(); }
    r.blocks.forEach((k, i) => block(c, x + shake, base - (i + 0.5) * s, s, 0, k.col, k.mark));
    c.fillStyle = '#e8513d'; c.beginPath(); c.moveTo(x - s * 0.5 + shake, base - n * s); c.quadraticCurveTo(x + shake, base - n * s - s * 1.5, x + s * 0.5 + shake, base - n * s); c.fill();
  }

  /* (left of the tower, which grows up the middle) */
  _say(c, W, H){ sayBubble(c, W, H, { text: this.say.text, t: this.say.t }); }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'reach' : null; }
  hud(){ return { score: this.score, showLives: false }; }
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
  c.fillStyle = 'rgba(58,51,96,.18)'; c.fillRect(half * 0.36, -half, half, s); c.fillRect(-half, half * 0.4, s, half);
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.85)';
  if (mark === 'star'){ c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? s * 0.1 : s * 0.24; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fill(); }
  else if (mark === 'heart'){ c.beginPath(); c.moveTo(0, s * 0.16); c.bezierCurveTo(-s * 0.31, -s * 0.05, -s * 0.15, -s * 0.29, 0, -s * 0.13); c.bezierCurveTo(s * 0.15, -s * 0.29, s * 0.31, -s * 0.05, 0, s * 0.16); c.fill(); }
  else { c.beginPath(); c.arc(0, 0, s * 0.18, 0, 6.2832); c.fill(); }
  c.restore();
}
