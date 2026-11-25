/* Animal Gym: a gentle workout, led by an animal coach. Each stretch of the round is one animal's move - stretch up like
   a giraffe, hop like a bunny, flap like a bird, squat like a frog, stomp like an elephant, wobble like a penguin - and
   every try fills the same energy bar, whoever does it. When the bar's full the coach cheers ("Great job!") and, after a short
   well-done beat (BEAT), the next animal comes; if nothing is happening (no try for STUCK seconds - the move isn't being seen, or
   nobody is trying) or the animal has had CAP seconds, it changes anyway. Nothing to
   lose, no wrong moves: a try is a try.

   Three minutes: a warm-up stretch, as many animals as fit (they come as fast as the family fills the bars; about a dozen and
   a half), and the last COOL seconds are a slow cool-down stretch to finish, so the round is always ROUND seconds long.

   The moves are the body's, from the camera's landmarks (a jump uses the jump watch the other games use). With no
   landmarks - the mouse, in testing - a fast hand counts as a try, so the game can still be played. */
import { color, alpha } from './assets/palette.js';
import { Juice } from './common.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { L } from '../tracking/pose-shared.js';
import { sfx } from '../audio/sound.js';
import { JumpWatch, HOP } from '../tracking/jump.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';
import { poseAt, drawCoach, coachUnit } from './animal-coaches.js';

/* the coach stands on the ground at this share of the height, and is this share tall at its tallest */
const GROUND = 0.79, SHARE = 0.5;
const reducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export const ROUND = 180;
/* tries per player that fill one animal's bar */
export const REPS = 6;
export const MOVES = {
  reach: { animal: 'giraffe', name: 'Giraffe', text: 'Stretch up tall!' },
  jump:  { animal: 'bunny', name: 'Bunny', text: 'Hop like a bunny!' },
  flap:  { animal: 'bird', name: 'Bird', text: 'Flap your wings!' },
  squat: { animal: 'frog', name: 'Frog', text: 'Squat down low!' },
  march: { animal: 'elephant', name: 'Elephant', text: 'Lift your knees!' },
  lean:  { animal: 'penguin', name: 'Penguin', text: 'Wobble side to side!' }
};
/* the warm-up is a stretch; then the animals come round in this order, over and over (a hop first, then a different move each
   time); the last COOL seconds of the round are a slow stretch */
export const WARMUP = 'reach', ORDER = ['jump', 'flap', 'squat', 'march', 'lean'];
/* seconds of "well done" between a full bar and the next animal; with no try at all for STUCK seconds, or after CAP seconds
   however it is going, on to the next animal; the cool-down */
export const BEAT = 2, STUCK = 8, CAP = 24, COOL = 20;
/* thresholds, in body sizes (pose's scale) */
export const T = { reachUp: 0.15, flapUp: 0.05, flapDown: 0.1, squatDown: 0.13, squatUp: 0.06, kneeUp: 0.2, lean: 0.1, handFast: 0.5 };

export default {
  id: 'animal-gym', unit: 'moves', name: 'Animal Gym', stars: 1, accent: color('touch.mint', 'shade'),
  secs: ROUND, moves: ['jump', 'stretch', 'squat'], keepSitters: true,
  create(n){ return new AnimalGym(n); }
};

const seen = (p, i) => p.lm && p.lm[i] && (p.lm[i].v ?? 1) > 0.4 ? p.lm[i] : null;

/* tries this frame by player p at the given move; st is that player's own memory for it */
export function triesOf(move, p, st, dt){
  if (!p || !p.present) return 0;
  const s = p.scale || 0.3;
  if (!p.lm){
    /* no landmarks (the mouse): a fast hand is a try, at most a few a second */
    st.cool = Math.max(0, (st.cool || 0) - dt);
    const h = p.hands || {}, fast = Math.max((h.left && h.left.speed) || 0, (h.right && h.right.speed) || 0) > T.handFast;
    if (fast && st.cool <= 0){ st.cool = 0.45; return 1; }
    return 0;
  }
  const nose = seen(p, L.NOSE), lw = seen(p, L.L_WRIST), rw = seen(p, L.R_WRIST), ls = seen(p, L.L_SHOULDER), rs = seen(p, L.R_SHOULDER);
  const lh = seen(p, L.L_HIP), rh = seen(p, L.R_HIP), lk = seen(p, L.L_KNEE), rk = seen(p, L.R_KNEE);
  if (move === 'reach'){
    if (!nose) return 0;
    const up = [lw, rw].some(w => w && (nose.y - w.y) / s > T.reachUp);
    if (up && !st.up){ st.up = true; return 1; }
    if (!up) st.up = false;
    return 0;
  }
  if (move === 'flap'){
    if (!ls || !rs) return 0;
    const shy = (ls.y + rs.y) / 2;
    const up = [lw, rw].some(w => w && (shy - w.y) / s > T.flapUp);
    const down = [lw, rw].every(w => !w || (w.y - shy) / s > T.flapDown);
    if (up && !st.up){ st.up = true; return 1; }
    if (down) st.up = false;
    return 0;
  }
  if (move === 'squat'){
    if (!p.centre) return 0;
    const y = p.centre.y;
    if (st.base == null) st.base = y;
    if (!st.down) st.base += (y - st.base) * Math.min(1, dt * 0.4);      /* standing height follows slowly */
    const low = (y - st.base) / s;
    if (!st.down && low > T.squatDown){ st.down = true; return 0; }
    if (st.down && low < T.squatUp){ st.down = false; return 1; }
    return 0;
  }
  if (move === 'march'){
    let n = 0;
    for (const [k, h, key] of [[lk, lh, 'l'], [rk, rh, 'r']]){
      if (!k || !h) continue;
      const lifted = (k.y - h.y) / s < T.kneeUp;
      if (lifted && !st[key]){ st[key] = true; n++; }
      if (!lifted) st[key] = false;
    }
    return n;
  }
  if (move === 'lean'){
    if (!ls || !rs || !lh || !rh) return 0;
    const dx = ((ls.x + rs.x) / 2 - (lh.x + rh.x) / 2) / s;
    const side = dx > T.lean ? 1 : dx < -T.lean ? -1 : 0;
    if (side && side !== st.side){ st.side = side; return 1; }
    return 0;
  }
  return 0;      /* (jumps come from the jump watch) */
}

class AnimalGym {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.t = 0; this.over = false;
    this.seg = -1; this.segT = 0; this.cool = false; this.cheerT = 0; this.quiet = 0;
    this.fill = 0; this.cheered = false; this.circuits = 0;
    this.st = Array.from({ length: MAX_PLAYERS }, () => ({}));
    this.jw = new JumpWatch(HOP);
    this.pulse = 0;
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
    this.say = { text: '', t: 0 };
    this._enter(0);
  }

  /* the move of the i-th animal: the warm-up, then the animals in turn (the cool-down is a stretch too) */
  static moveOf(i, cool = false){ return cool || i <= 0 ? WARMUP : ORDER[(i - 1) % ORDER.length]; }
  get move(){ return AnimalGym.moveOf(Math.max(0, this.seg), this.cool); }

  _enter(i, cool = false){
    this.seg = i; this.segT = 0; this.fill = 0; this.cheered = false; this.cheerT = 0; this.quiet = 0; this.cool = cool;
    this.st.forEach((s, k) => { for (const key of Object.keys(s)) delete s[key]; });
    const mv = this.move;
    this.say = cool ? { icon: 'giraffe', text: 'Slow stretch…', t: 0 } : { icon: MOVES[mv].animal, text: MOVES[mv].text, t: 0 };
    if (i > 0) sfx.whoosh?.();
  }

  step(dt, W, H){
    this.t += dt; this.segT += dt; this.say.t += dt;
    if (this.cheered) this.cheerT += dt; else this.quiet += dt;
    this.j.step(dt);
    this.pulse = Math.max(0, this.pulse - dt * 3);
    if (this.t >= ROUND){ this.over = true; }
    /* the next animal: soon after the bar is full, or when this one has had its time; the last COOL seconds are the stretch */
    if (!this.cool && this.t >= ROUND - COOL) this._enter(this.seg + 1, true);
    else if (!this.cool && ((this.cheered && this.cheerT >= BEAT) || this.quiet >= STUCK || this.segT >= CAP)) this._enter(this.seg + 1);

    const present = pose.players.slice(0, this.players).filter(p => p && p.present).length;
    const jumpers = this.jw.step(dt, pose.players, this.players);
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      let n = this.move === 'jump' ? (jumpers.includes(i) ? 1 : 0) : triesOf(this.move, p, this.st[i], dt);
      /* (with no landmarks a jump is a fast hand too) */
      if (this.move === 'jump' && p && p.present && !p.lm) n = triesOf('jump', p, this.st[i], dt);
      if (!n) continue;
      this.quiet = 0;
      this.score[i] += n;
      this.fill = Math.min(1, this.fill + n / (REPS * Math.max(1, present)));
      this.pulse = 1;
      const c = p.centre || { x: 0.5, y: 0.5 };
      this.j.pop(c.x * W, (c.y - 0.15) * H, '+1', PLAYER_COLORS[i]);
      sfx.pop?.(0.5 + this.fill * 0.6);
    }
    if (this.fill >= 1 && !this.cheered){
      this.cheered = true; this.circuits++;
      this.say = { icon: 'glowstar', text: 'Great job!', t: 0 };
      this.j.kick(6); sfx.hooray?.();
      for (let k = 0; k < 14; k++) this.j.burst(W * (0.25 + Math.random() * 0.5), H * (0.3 + Math.random() * 0.3), [color('touch.sunflower'), color('touch.bubblegum'), color('touch.mint'), color('touch.skyBlue')][k % 4], 4, 1);
    }
    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND), storm: false, wind: 0.006, joy: 0.3 + 0.7 * this.fill, look: 0.5, rainbow: this.cheered });
    this.avatars.step(dt, this.players);
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    this.scene.drawFront(c, W, H);
    /* the coach: the animal, full-length and big, doing the move on the beat (with a hop and a sparkle for every try, a flourish on
       "Great job!"); its feet are on the ground of the scene */
    const m = MOVES[this.move], an = m.animal, reduced = reducedMotion();
    const o = { slow: this.cool, reduced, tryK: this.pulse, joy: this.cheered ? this.cheerT : -1 };
    drawCoach(c, an, poseAt(an, this.t, o), W * 0.5, H * GROUND, coachUnit(an, H, SHARE), o);
    /* the animal's name, and where we are in the workout (a dot for each stretch) */
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${Math.round(H * 0.045)}px Inter, Segoe UI, sans-serif`; c.fillStyle = color('shade.ink');
    c.fillText(m.name, W * 0.5, H * 0.855);
    /* where we are in the workout: a track that fills as the minutes go, with the animals done so far as dots on it */
    const tw = W * 0.26, tx = W * 0.5 - tw / 2, ty = H * 0.92, th = H * 0.014, k = Math.min(1, this.t / ROUND);
    c.fillStyle = alpha('earth.snow', 0.8); c.beginPath(); c.roundRect(tx, ty - th / 2, tw, th, th / 2); c.fill();
    c.fillStyle = color('touch.mint', 'shade'); c.beginPath(); c.roundRect(tx, ty - th / 2, Math.max(th, tw * k), th, th / 2); c.fill();
    c.fillStyle = color('ui.gold'); c.beginPath(); c.arc(tx + Math.max(th / 2, tw * k), ty, th * 0.9, 0, 6.2832); c.fill();
    c.restore();
    this.j.draw(c, H);
    if (shook) c.restore();
    this.avatars.drawMitts(c, W, H, this.players);
  }

  /* the move card: which move the card in the corner shows right now, or null for none (the move he is on, all round) */
  card(){ return this.move; }
  hud(){ return { score: this.score, showLives: false, goal: this.fill, words: this.say }; }
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
  value(){ return this.score.slice(0, this.players).reduce((a, b) => a + b, 0); }
}
