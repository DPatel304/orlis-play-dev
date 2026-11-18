/* Animal Gym: a gentle workout, led by an animal coach. Each stretch of the round is one animal's move - stretch up like
   a giraffe, hop like a bunny, flap like a bird, squat like a frog, stomp like an elephant, wobble like a penguin - and
   every try fills the same energy bar, whoever does it. When the bar's full the coach cheers and the next animal comes;
   when the time's up it comes anyway. Nothing to lose, no wrong moves: a try is a try.

   Three minutes: a warm-up stretch, six animals, and a slow cool-down stretch to finish.

   The moves are the body's, from the camera's landmarks (a jump uses the jump watch the other games use). With no
   landmarks - the mouse, in testing - a fast hand counts as a try, so the game can still be played. */
import { Juice } from './common.js';
import { figureCard } from './figure.js';
import { sayBubble, goalBar } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { L } from '../tracking/pose-shared.js';
import { sfx } from '../audio/sound.js';
import { JumpWatch } from '../tracking/jump.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* tries per player that fill one animal's bar */
export const REPS = 6;
export const MOVES = {
  reach: { animal: '\u{1F992}', name: 'Giraffe', text: 'Stretch up tall like a giraffe!' },
  jump:  { animal: '\u{1F430}', name: 'Bunny', text: 'Hop like a bunny!' },
  flap:  { animal: '\u{1F426}', name: 'Bird', text: 'Flap your wings like a bird!' },
  squat: { animal: '\u{1F438}', name: 'Frog', text: 'Squat down low like a frog!' },
  march: { animal: '\u{1F418}', name: 'Elephant', text: 'Lift your knees like an elephant!' },
  lean:  { animal: '\u{1F427}', name: 'Penguin', text: 'Wobble side to side like a penguin!' }
};
/* 15 + 6 x 24 + 21 = 180 seconds */
export const SCHEDULE = [
  { move: 'reach', len: 15, text: 'Warm up: stretch up tall like a giraffe!' },
  { move: 'jump', len: 24 }, { move: 'flap', len: 24 }, { move: 'squat', len: 24 },
  { move: 'march', len: 24 }, { move: 'lean', len: 24 }, { move: 'jump', len: 24 },
  { move: 'reach', len: 21, text: 'Slow stretch… and breathe.' }
];
/* thresholds, in body sizes (pose's scale) */
export const T = { reachUp: 0.15, flapUp: 0.05, flapDown: 0.1, squatDown: 0.16, squatUp: 0.07, kneeUp: 0.2, lean: 0.1, handFast: 0.5 };

export default {
  id: 'animal-gym', unit: 'moves', name: 'Animal Gym', stars: 1, accent: '#34b27b',
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
    this.seg = -1; this.segT = 0;
    this.fill = 0; this.cheered = false; this.circuits = 0;
    this.st = Array.from({ length: MAX_PLAYERS }, () => ({}));
    this.jw = new JumpWatch({ rise: 0.08, speed: 0.5 });
    this.pulse = 0;
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
    this.say = { text: '', t: 0 };
    this._enter(0);
  }

  /* which stretch of the schedule a time falls in */
  static segAt(t){ let a = 0; for (let i = 0; i < SCHEDULE.length; i++){ a += SCHEDULE[i].len; if (t < a) return i; } return SCHEDULE.length - 1; }
  get move(){ return SCHEDULE[Math.max(0, this.seg)].move; }

  _enter(i){
    this.seg = i; this.segT = 0; this.fill = 0; this.cheered = false;
    this.st.forEach((s, k) => { for (const key of Object.keys(s)) delete s[key]; });
    const seg = SCHEDULE[i];
    this.say = { text: seg.text || MOVES[seg.move].text, t: 0 };
    if (i > 0) sfx.whoosh?.();
  }

  step(dt, W, H){
    this.t += dt; this.segT += dt; this.say.t += dt;
    this.j.step(dt);
    this.pulse = Math.max(0, this.pulse - dt * 3);
    if (this.t >= ROUND){ this.over = true; }
    const at = AnimalGym.segAt(this.t);
    if (at !== this.seg) this._enter(at);

    const present = pose.players.slice(0, this.players).filter(p => p && p.present).length;
    const jumpers = this.jw.step(dt, pose.players, this.players);
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      let n = this.move === 'jump' ? (jumpers.includes(i) ? 1 : 0) : triesOf(this.move, p, this.st[i], dt);
      /* (with no landmarks a jump is a fast hand too) */
      if (this.move === 'jump' && p && p.present && !p.lm) n = triesOf('jump', p, this.st[i], dt);
      if (!n) continue;
      this.score[i] += n;
      this.fill = Math.min(1, this.fill + n / (REPS * Math.max(1, present)));
      this.pulse = 1;
      const c = p.centre || { x: 0.5, y: 0.5 };
      this.j.pop(c.x * W, (c.y - 0.15) * H, '+1', PLAYER_COLORS[i]);
      sfx.pop?.(0.5 + this.fill * 0.6);
    }
    if (this.fill >= 1 && !this.cheered){
      this.cheered = true; this.circuits++;
      this.say = { text: 'Great job!', t: 0 };
      this.j.kick(6); sfx.hooray?.();
      for (let k = 0; k < 14; k++) this.j.burst(W * (0.25 + Math.random() * 0.5), H * (0.3 + Math.random() * 0.3), ['#ffd35c', '#ff7eb3', '#7fd6a2', '#7ab8ff'][k % 4], 4, 1);
    }
    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND), storm: false, wind: 0.006, joy: 0.3 + 0.7 * this.fill, look: 0.5, rainbow: this.cheered });
    this.avatars.step(dt, this.players);
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    this.scene.drawFront(c, W, H);
    /* the coach: the animal, big, doing the move (and bouncing a little more with every try) */
    const m = MOVES[this.move], t = this.t, mv = this.move;
    let rot = 0, dx = 0, dy = 0, sx = 1, sy = 1;
    if (mv === 'reach'){ sy = 1 + 0.12 * Math.sin(t * 3); sx = 1 - 0.05 * Math.sin(t * 3); }
    else if (mv === 'jump'){ dy = -Math.abs(Math.sin(t * 5)) * H * 0.06; }
    else if (mv === 'flap'){ rot = Math.sin(t * 6) * 0.12; dy = -Math.abs(Math.sin(t * 6)) * H * 0.015; }
    else if (mv === 'squat'){ sy = 1 - 0.14 * (0.5 + 0.5 * Math.sin(t * 3)); sx = 1 + 0.06 * (0.5 + 0.5 * Math.sin(t * 3)); }
    else if (mv === 'march'){ rot = Math.sin(t * 4) * 0.1; dy = -Math.max(0, Math.sin(t * 4)) * H * 0.03; }
    else if (mv === 'lean'){ dx = Math.sin(t * 3) * W * 0.035; rot = Math.sin(t * 3) * 0.12; }
    const bob = Math.sin(t * 4) * H * 0.006 - this.pulse * H * 0.03, sc = 1 + this.pulse * 0.12;
    c.save(); c.translate(W * 0.5 + dx, H * 0.58 + bob + dy); c.rotate(rot); c.scale(sc * sx, sc * sy);
    c.fillStyle = 'rgba(58,51,96,.16)'; c.beginPath(); c.ellipse(0, H * 0.2, H * 0.17, H * 0.03, 0, 0, 6.2832); c.fill();
    c.font = `${Math.round(H * 0.34)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000';
    c.fillText(m.animal, 0, 0);
    c.restore();
    figureCard(c, W, H, mv, this.segT, { age: this.segT, left: SCHEDULE[this.seg].len - this.segT });
    /* the animal's name, and where we are in the workout (a dot for each stretch) */
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${Math.round(H * 0.045)}px Inter, Segoe UI, sans-serif`; c.fillStyle = '#33322e';
    c.fillText(m.name, W * 0.5, H * 0.8);
    const n = SCHEDULE.length, gap = H * 0.045, x0 = W * 0.5 - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++){
      c.fillStyle = i < this.seg ? '#34b27b' : i === this.seg ? '#ffb84d' : 'rgba(255,255,255,.8)';
      c.beginPath(); c.arc(x0 + i * gap, H * 0.87, H * (i === this.seg ? 0.014 : 0.011), 0, 6.2832); c.fill();
    }
    c.restore();
    this.j.draw(c, H);
    if (shook) c.restore();
    this.avatars.drawMitts(c, W, H, this.players);
    sayBubble(c, W, H, { text: this.say.text, t: this.say.t });
    goalBar(c, W, H, this.fill, { color: this.cheered ? '#e8b44a' : '#34b27b' });
  }

  hud(){ return { score: this.score, showLives: false, hideScore: true }; }
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
