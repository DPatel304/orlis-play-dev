/* Pop Party (stage lab): the core of Pop Party - rising balloons that hands pop - drawn through the stage (the painted backdrop and foreground
   behind paper cutouts) instead of straight onto the canvas. It is an experiment next to the real game, not a replacement: the same
   rules, none of the surprises (giants, parades, animals, the bouquet ending), so the two can be played side by side and measured.
   Open it with ?game=pop-party-stage. */
import { Stage } from '../../stage/stage.js';
import { Scene } from '../pop-party-scene.js';
import { SIZES, ROUND, FINALE, OPENING } from '../pop-party.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../../tracking/pose.js';
import { sfx } from '../../audio/sound.js';
import { Avatars } from '../../ui/avatars.js';

const HUES = [0, 28, 48, 135, 175, 215, 270, 325];
const MIN_REACH = 0.04;
const pick = (a) => a[(Math.random() * a.length) | 0];
const rand = ([a, b]) => a + Math.random() * (b - a);
export const BALLOON_SIZE = 2.5;                  /* a balloon's picture is 2.5 radii tall (radii are fractions of the screen height) */

/* Two versions to compare: the stage as built, and a lighter one for slower machines (the backdrop repainted a quarter as often and a
   little smaller, the 3D picture drawn at 70% and smoothed up, no edge smoothing). */
const make = (id, name, extra) => ({ id, unit: 'points', name, stars: 1, accent: '#ff5d9e', secs: ROUND, moves: ['reach'], create(n, opts){ return new PopPartyStage(n, { ...extra, ...opts }); } });
export const light = make('pop-party-stage-light', 'Pop Party (stage lab, light)', { backdropEvery: 4, backdropScale: 0.75, scale: 0.7, antialias: false });
/* The same game with no 3D at all: the stage paints the pictures straight onto the canvas, as the real game does. If this is smooth and the 3D versions are not, the 3D is the cost, not the stage's design. */
export const canvas = make('pop-party-stage-canvas', 'Pop Party (stage lab, canvas)', { gl: false });
export default make('pop-party-stage', 'Pop Party (stage lab)', {});

/* a few balloons from the start, a steady climb to a crowded sky, then a storm for the last seconds */
export function target(t){
  if (t >= FINALE) return 24;
  if (t < OPENING) return 3;
  return 3 + 13 * (t - OPENING) / (FINALE - OPENING);
}

class PopPartyStage {
  constructor(players, opts = {}){
    this.players = players;
    this.t = 0; this.spawn = 0; this.over = false;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.balloons = [];
    this.scene = new Scene();
    this.avatars = new Avatars();
    this.stage = new Stage({ backdrop: this.scene, gl: opts.gl !== false, backdropEvery: opts.backdropEvery, backdropScale: opts.backdropScale, scale: opts.scale, antialias: opts.antialias });
  }

  step(dt, W, H){
    this.t += dt;
    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / FINALE), storm: this.t >= FINALE, wind: Math.sin(this.t * 0.3) * 0.006, joy: 0.3, look: this._look(), rainbow: false });
    this.spawn -= dt;
    if (this.spawn <= 0 && this.balloons.length < target(this.t)){ this.balloons.push(this._make()); this.spawn = this.t >= FINALE ? 0.18 : 0.5; }
    for (const b of this.balloons){
      b.age += dt; b.y -= b.rise * dt; b.x = b.x0 + Math.sin(b.age * b.f + b.ph) * 0.02;
      this._place(b);
    }
    /* hands pop what they touch, the way Pop Party does */
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i]; if (!p.present) continue;
      const hands = pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right];
      for (const hand of hands) for (const b of this.balloons){
        if (!b.dead && Math.hypot((hand.x - b.x) * (W / H), hand.y - b.y) < Math.max(b.r * 1.15, MIN_REACH)) this._hit(b, i);
      }
    }
    this.balloons = this.balloons.filter(b => { if (b.dead || b.y < -0.2 - b.r * 3) { this.stage.remove(b.actor); return false; } return true; });
    this.stage.step(dt);
    this.avatars.step(dt, this.players);
  }

  _make(){
    const size = pick(SIZES), hue = pick(HUES), r = rand(size.r), x0 = 0.08 + Math.random() * 0.84;
    const actor = this.stage.actor('balloon', { x: x0, y: 1.2, z: 3 + Math.random() * 1.5, size: r * BALLOON_SIZE, fit: 0.55, draw: { color: `hsl(${hue} 78% 62%)` }, sway: 0.04 });
    return { actor, x0, x: x0, y: 1.2, r, rise: rand(size.rise), hue, worth: size.worth, f: 1.2 + Math.random() * 1.4, ph: Math.random() * 6.28, age: 0, dead: false };
  }
  /* b.x, b.y are where its body is; the picture's centre sits a little lower (its string hangs below) */
  _place(b){ b.actor.x = b.x; b.actor.y = b.y + 0.08 * b.actor.size; }

  _hit(b, who){
    b.dead = true; this.score[who] += b.worth;
    sfx.pop(Math.max(0, Math.min(1, (b.r - 0.04) / 0.058)), 0);
    this.scene.pop(b.x, b.hue);
    this.stage.burst(b.x, b.y, `hsl(${b.hue} 88% 58%)`, 7 + Math.round(b.r * 80));
  }

  _look(){
    let sum = 0, n = 0;
    for (let i = 0; i < this.players; i++){ const p = pose.players[i]; if (p.present && p.centre){ sum += p.centre.x; n++; } }
    return n ? sum / n : 0.5;
  }

  draw(c, W, H){
    this.stage.draw(c, W, H);
    this.avatars.drawMitts(c, W, H, this.players);       /* the hands go on top of everything, as in the real game */
  }

  card(){ return this.t < 8 ? 'reach' : null; }
  hud(){ return { score: this.score, showLives: false, hideScore: true }; }
  pausable(){ return false; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  winner(){ return null; }
  value(){ return Math.max(...this.score.slice(0, this.players)); }
  dispose(){ this.stage.dispose(); }
}
