/* Keep It Up!: one big beach ball, and everybody keeps it in the air together. A hand that meets the ball bats it
   back up; the longer it stays up, the bigger the number grows, with a cheer at 10, 25, 50 and every 25 after that.
   Another ball joins in every 10 in a row, up to ten balls at once. A breeze sometimes blows them sideways.

   Nothing to lose: if the ball reaches the ground it just bounces back up and the count starts again. The best run
   is the round's best. Gentle by design - a hit always sends the ball up, a little toward where the hand was going. */
import { color, alpha } from './assets/palette.js';
import { Juice } from './common.js';
import { hudZones } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* in screen heights and seconds */
export const GRAV = 0.5, BALL_R = 0.065, REACH = 0.075, FLOOR = 0.9, LIFT = 0.62, MAX_SIDE = 0.45, COOL = 0.25;
export const MILESTONES = [10, 25, 50, 75, 100, 125, 150];
/* a new ball every BALL_EVERY in a row (10, 20, 30...), up to MAX_BALLS in the air at once */
export const BALL_EVERY = 10, MAX_BALLS = 10;
export const BREEZE_EVERY = [9, 15];
/* the beach ball's wedges are touchable colours */
const BALL_COLS = ['cherry', 'tangerine', 'sunflower', 'mint', 'skyBlue', 'grape'].map(n => color('touch.' + n));

export default {
  id: 'keep-it-up', unit: 'bounces', name: 'Keep It Up!', stars: 1, accent: color('touch.skyBlue'),
  secs: ROUND, moves: ['bat', 'reach'],
  create(n){ return new KeepItUp(n); }
};

class KeepItUp {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);     /* hits, per player */
    this.balls = [this._ball(0.5)];
    this.streak = 0; this.best = 0; this.hits = 0;
    this.t = 0; this.over = false;
    this.breezeT = 6 + Math.random() * 4; this.breeze = 0; this.breezeLeft = 0;
    this.say = { icon: 'volleyball', text: 'Keep it up!', t: 0 };
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
  }

  /* where a new ball starts: the place across the screen furthest from the balls already there */
  _freeSpot(){
    let best = 0.5, far = -1;
    for (let x = 0.12; x <= 0.88; x += 0.04){ const d = Math.min(...this.balls.map(b => Math.abs(b.x - x))); if (d > far){ far = d; best = x; } }
    return best;
  }
  _ball(x){ return { x, y: 0.5, vx: 0, vy: 0, rot: 0, spin: 0, cool: 0 }; }

  _next(){ return MILESTONES.find(m => m > this.streak) || (Math.floor(this.streak / 25) + 1) * 25; }

  step(dt, W, H){
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;
    /* the ball never goes up behind the clock, the goal bar or the words: there its ceiling is just under them */
    const top = hudZones(W, H).top, ceilUnder = (top.y + top.h) / H + 0.04;

    /* a breeze, now and then */
    this.breezeT -= dt;
    if (this.breezeT <= 0){
      this.breezeT = BREEZE_EVERY[0] + Math.random() * (BREEZE_EVERY[1] - BREEZE_EVERY[0]);
      this.breeze = (Math.random() < 0.5 ? -1 : 1) * 0.12; this.breezeLeft = 2.2;
    }
    if (this.breezeLeft > 0){ this.breezeLeft -= dt; if (this.breezeLeft <= 0) this.breeze = 0; }

    /* hands: any hand that's moving, or one the ball falls onto */
    const hands = [];
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p || !p.present) continue;
      for (const h of pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right]) if (h) hands.push([i, h]);
    }

    for (const b of this.balls){
      b.cool = Math.max(0, b.cool - dt);
      b.vy += GRAV * dt; b.vx += this.breeze * dt; b.vx *= Math.pow(0.6, dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; b.spin *= Math.pow(0.5, dt);
      if (b.x < 0.05){ b.x = 0.05; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x > 0.95){ b.x = 0.95; b.vx = -Math.abs(b.vx) * 0.7; }
      const ceil = b.x * W > top.x && b.x * W < top.x + top.w ? ceilUnder : 0.1;
      if (b.y < ceil){ b.y = ceil; b.vy = Math.abs(b.vy) * 0.3; }
      if (b.cool <= 0){
        for (const [i, h] of hands){
          const dx = (b.x - h.x) * aspect, dy = b.y - h.y;
          if (Math.hypot(dx, dy) > BALL_R + REACH) continue;
          if (!(h.speed > 0.15 || b.vy > 0.2)) continue;
          this._hit(b, i, h, W, H);
          break;
        }
      }
      /* the ground: a soft bounce, the count starts again */
      if (b.y > FLOOR){
        b.y = FLOOR; b.vy = -0.55; b.vx *= 0.5; b.spin = (Math.random() - 0.5) * 6;
        if (this.streak > 0) this._drop(b, W, H);
      }
    }
    if (this.balls.some(x => x.gone)) this.balls = this.balls.filter(x => !x.gone);
    this.scene.step(dt, { t: this.t, p: 0.3 + 0.5 * Math.min(1, this.t / ROUND), storm: false, wind: 0.01 + Math.abs(this.breeze) * 0.1, joy: Math.min(1, 0.3 + this.streak / 30), look: 0.5, rainbow: false });
    this.avatars.step(dt, this.players);
  }

  _hit(b, who, h, W, H){
    b.cool = COOL;
    b.vy = -(LIFT + Math.min(0.2, Math.max(0, -(h.vy || 0)) * 0.15));
    b.vx = Math.max(-MAX_SIDE, Math.min(MAX_SIDE, b.vx * 0.3 + (h.vx || 0) * 0.5));
    b.spin = (b.vx * 8) + (Math.random() - 0.5) * 4;
    this.score[who]++; this.hits++; this.streak++;
    if (this.streak > this.best) this.best = this.streak;
    this.j.burst(b.x * W, b.y * H, PLAYER_COLORS[who], 6, 0.6);
    sfx.pop?.(0.5 + Math.min(1, this.streak / 40) * 0.6);
    const added = this.streak % BALL_EVERY === 0 && this.balls.length < MAX_BALLS;
    if (added){
      this.balls.push(this._ball(this._freeSpot()));
      this.say = { text: this.balls.length === 2 ? 'A second ball!' : `${this.balls.length} balls!`, t: 0 };
      sfx.tada?.(this.balls.length);
    }
    if (MILESTONES.includes(this.streak) || (this.streak > 150 && this.streak % 25 === 0)){
      if (!added) this.say = { text: `${this.streak} in a row! Wow!`, t: 0 };
      this.j.kick(8); sfx.hooray?.();
      for (let k = 0; k < 16; k++) this.j.burst(W * (0.2 + Math.random() * 0.6), H * (0.2 + Math.random() * 0.4), [color('touch.sunflower'), color('touch.bubblegum'), color('touch.mint'), color('touch.skyBlue')][k % 4], 4, 1);
    } else if (this.streak >= 3) this.say = { text: `${this.streak} in a row!`, t: Math.min(this.say.t, 0.2) };
  }

  /* a ball touched the ground. With others still in the air, only that ball is lost (it pops) and the streak carries on;
     the last ball just bounces back up and the count starts again. */
  _drop(b, W, H){
    const live = this.balls.filter(x => !x.gone).length;
    if (live > 1){
      b.gone = true;
      this.j.burst(b.x * W, b.y * H, color('touch.sunflower'), 10, 0.8);
      this.say = { text: `Oops! ${live - 1} ${live - 1 === 1 ? 'ball' : 'balls'} left`, t: 0 };
      sfx.plop?.();
      return;
    }
    this.streak = 0;
    this.say = { text: 'Up we go again!', t: 0 };
    sfx.whoosh?.();
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    this.scene.drawFront(c, W, H);
    for (const b of this.balls){
      /* its shadow on the grass: smaller the higher it is */
      const hgt = Math.max(0, Math.min(1, (FLOOR - b.y) / 0.8)), sw = BALL_R * H * (1.1 - hgt * 0.5);
      c.fillStyle = alpha('shade.shadow', 0.2 - hgt * 0.1); c.beginPath(); c.ellipse(b.x * W, FLOOR * H + BALL_R * H * 0.9, sw, sw * 0.28, 0, 0, 6.2832); c.fill();
    }
    for (const b of this.balls) this._ballAt(c, b.x * W, b.y * H, BALL_R * H, b.rot);
    this.j.draw(c, H);
    if (this.breezeLeft > 0){
      c.save(); c.strokeStyle = alpha('earth.snow', 0.7); c.lineWidth = Math.max(2, H * 0.004); c.lineCap = 'round';
      const dir = Math.sign(this.breeze);
      for (let k = 0; k < 5; k++){
        const y = H * (0.2 + k * 0.1), x = ((this.t * 0.5 * dir + k * 0.23) % 1 + 1) % 1 * W;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * W * 0.08, y); c.stroke();
      }
      c.restore();
    }
    if (shook) c.restore();
    this.avatars.drawMitts(c, W, H, this.players);
  }

  /* a beach ball: coloured wedges, a shine */
  _ballAt(c, x, y, r, rot){
    c.save(); c.translate(x, y); c.rotate(rot);
    const n = BALL_COLS.length;
    for (let i = 0; i < n; i++){
      c.fillStyle = BALL_COLS[i]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * 6.2832 / n, (i + 1) * 6.2832 / n); c.closePath(); c.fill();
    }
    c.fillStyle = color('earth.snow'); c.beginPath(); c.arc(0, 0, r * 0.18, 0, 6.2832); c.fill();
    c.restore();
    c.save(); c.fillStyle = alpha('earth.snow', 0.35); c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.17, -0.6, 0, 6.2832); c.fill(); c.restore();
  }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'reach' : null; }
  hud(){ return { score: this.score, showLives: false, goal: this.streak / this._next(), words: this.say }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  /* (the shell shows no winner; this is the contract every game keeps) */
  winner(){
    const played = this.score.slice(0, this.players).map((s, i) => i).filter(i => this.score[i] > 0 || pose.players[i].present);
    if (played.length < 2) return null;
    const top = Math.max(...played.map(i => this.score[i]));
    const best = played.filter(i => this.score[i] === top);
    return best.length > 1 ? -1 : best[0];
  }
  /* the best run, for the bests the menu keeps - and what the results say, so the "New best!" is about the same thing */
  summary(n){ return this.best > 0 ? `${n > 1 ? 'Your best run together' : 'Your best run'}: ${this.best} in a row` : null; }
  value(){ return this.best; }
}
